// Prospective specification model. Does NOT import or test a production governor.
// Reported byte integers only; no media or synthetic Blob allocation.
import assert from 'node:assert/strict';
import {writeFileSync,existsSync} from 'node:fs';
const MAX=Number.MAX_SAFE_INTEGER;
export const checked=n=>{if(!Number.isSafeInteger(n)||n<0)throw Error('invalid-accounting');return n;};
export const add=(a,b)=>{checked(a);checked(b);if(b>MAX-a)throw Error('invalid-accounting');return a+b;};
export class PolicyModel{
 constructor({P=0,S=100,H=240,R=40,C=10,T=null,unrestricted=false}={}){
  checked(P);if(!unrestricted){for(const n of [S,H,R,C])checked(n);if(!S||!H||!R||!C||S>H-R)throw Error('invalid-policy');if(T!==null&&(!checked(T)))throw Error('invalid-policy');}
  Object.assign(this,{P,S:unrestricted?null:S,H:unrestricted?null:H,R:unrestricted?null:R,C:unrestricted?null:C,T:unrestricted?null:T,D:0,count:0,phase:'ready',token:0,oldUrl:P?'old':null,url:P?'old':null,revoked:[],stopCalls:0,reason:null,secondary:[],enabled:true,transportLocked:false,received:0,rejected:0});
 }
 start(){if(!this.enabled||['recording','finalizing'].includes(this.phase))return false;if(this.H!==null&&this.P>=this.H-this.R){this.phase='admission-blocked';return false;}this.effective=this.S===null?null:Math.min(this.S,this.H-this.P-this.R);this.D=0;this.count=0;this.received=0;this.rejected=0;this.stopCalls=0;this.reason=null;this.secondary=[];this.token++;this.phase='recording';this.transportLocked=true;return this.token;}
 request(reason,callback=()=>{}){if(this.phase!=='recording')return false;this.reason=reason;this.phase='finalizing';this.stopCalls++;try{callback();}catch{this.abort('stop-threw',false);}return true;}
 event(E,{token=this.token,elapsed=0,sync=()=>{}}={}){
  if(token!==this.token||!['recording','finalizing'].includes(this.phase))return false;
  try{checked(E);checked(elapsed);checked(this.D);checked(this.P);checked(this.count);this.received=add(this.received,E);if(!E)return true;
   const total=add(add(this.P,this.D),E),nextCount=add(this.count,1);
   if((this.H!==null&&total>this.H)||(this.C!==null&&nextCount>this.C)){this.rejected=add(this.rejected,E);this.abort('admission-rejected',false);return false;}
   this.D=add(this.D,E);this.count=nextCount;
   const capacity=this.effective!==null&&this.D>=this.effective,duration=this.T!==null&&elapsed>=this.T;
   if(capacity&&duration)this.secondary.push('duration-stop');if(capacity||duration)this.request(capacity?'capacity-stop':'duration-stop',sync);return true;
  }catch{this.abort('invalid-accounting',false);return false;}
 }
 tick(elapsed){checked(elapsed);if(this.T!==null&&elapsed>=this.T)this.request('duration-stop');}
 terminal({token=this.token,nativeInactive=true,cleanupOK=true}={}){if(token!==this.token||!['recording','finalizing'].includes(this.phase))return false;if(!nativeInactive||!cleanupOK){this.abort('shutdown-unconfirmed',false);return false;}if(!this.D){this.abort('empty-output',true);return false;}const old=this.url;this.url='new-'+this.token;this.P=this.D;this.exportBytes=this.D;this.D=0;this.count=0;this.phase='complete';this.transportLocked=false;this.token++;if(old)this.revoked.push(old);return true;}
 abort(reason,confirmed){this.reason=reason;this.admittedAtFailure=this.D;this.D=0;this.count=0;this.phase='failed';this.token++;this.enabled=!!confirmed;this.transportLocked=false;}
 cancel(confirmed=false){if(!['recording','finalizing'].includes(this.phase))return false;this.abort('cancelled',confirmed);return true;}
 dispose(){this.abort('disposed',false);if(this.url)this.revoked.push(this.url);this.P=0;this.url=null;this.phase='disposed';}
 snapshot(){return Object.fromEntries(Object.entries(this).filter(([k])=>!['S','H','R','C','T'].includes(k)));}
}
const cases=[];function run(name,fn){const observation=fn();cases.push({name,passed:true,...observation});}
const fresh=opts=>{const m=new PolicyModel(opts);assert.ok(m.start());return m;};
run('oversized-first',()=>{const m=fresh({P:30});assert.equal(m.event(211),false);assert.equal(m.D,0);assert.equal(m.P,30);assert.deepEqual(m.revoked,[]);return m.snapshot();});
run('soft-crossing-with-admitted-tail',()=>{const m=fresh();m.event(99);assert.equal(m.stopCalls,0);m.event(1);assert.equal(m.stopCalls,1);m.event(40);m.terminal();assert.equal(m.P,140);assert.equal(m.reason,'capacity-stop');return m.snapshot();});
run('oversized-final',()=>{const m=fresh({P:30});m.event(100);m.event(111);assert.equal(m.phase,'failed');assert.equal(m.P,30);return m.snapshot();});
run('many-tiny-and-count-boundary',()=>{const m=fresh({S:100,H:240,R:40,C:10});for(let i=0;i<10;i++)assert.ok(m.event(1));assert.equal(m.event(1),false);assert.equal(m.admittedAtFailure,10);return m.snapshot();});
run('delayed-native-delivery',()=>{const m=fresh({T:300000});m.tick(300000);assert.equal(m.D,0);assert.equal(m.phase,'finalizing');m.event(200);m.terminal();assert.equal(m.P,200);assert.equal(m.reason,'duration-stop');return m.snapshot();});
run('duration-byte-tie',()=>{const m=fresh({T:1000});m.event(100,{elapsed:1000});assert.equal(m.reason,'capacity-stop');assert.deepEqual(m.secondary,['duration-stop']);assert.equal(m.stopCalls,1);return m.snapshot();});
run('synchronous-terminal-callback',()=>{const m=fresh();m.event(100,{sync:()=>{m.event(3);m.terminal();}});assert.equal(m.phase,'complete');assert.equal(m.P,103);assert.equal(m.stopCalls,1);return m.snapshot();});
run('stop-throw',()=>{const m=fresh({P:20});m.event(2);m.request('manual-stop',()=>{throw Error('controlled stop refusal');});assert.equal(m.enabled,false);assert.equal(m.transportLocked,false);assert.equal(m.P,20);return m.snapshot();});
run('stop-no-terminal-then-explicit-cancel',()=>{const m=fresh({P:20});const token=m.token;m.event(3);m.request('manual-stop');m.tick(3600000);assert.equal(m.phase,'finalizing');assert.equal(m.P,20);m.cancel(false);assert.equal(m.transportLocked,false);assert.equal(m.start(),false);const before=m.snapshot();m.event(5,{token});m.terminal({token});assert.deepEqual(m.snapshot(),before);return m.snapshot();});
run('cancel-finalizing-confirmed',()=>{const m=fresh({P:20});m.event(3);m.request('manual-stop');m.cancel(true);assert.equal(m.P,20);assert.ok(m.start());return m.snapshot();});
run('restart-after-capacity',()=>{const m=fresh();const token=m.token;m.event(100);m.event(10);m.terminal();assert.ok(m.start());assert.equal(m.effective,90);m.event(99,{token});assert.equal(m.D,0);return m.snapshot();});
run('prior-over-aggregate-budget',()=>{const m=new PolicyModel({P:241});assert.equal(m.start(),false);assert.equal(m.P,241);assert.deepEqual(m.revoked,[]);return m.snapshot();});
run('reserve-insufficient-and-one-byte-start',()=>{const blocked=new PolicyModel({P:200});assert.equal(blocked.start(),false);const allowed=fresh({P:199});assert.equal(allowed.effective,1);allowed.event(1);assert.equal(allowed.stopCalls,1);return{blocked:blocked.snapshot(),positiveButNotUseful:allowed.snapshot()};});
run('hard-equality',()=>{const m=fresh({P:30});m.event(210);assert.equal(m.phase,'finalizing');m.terminal();assert.equal(m.P,210);return m.snapshot();});
run('invalid-counter-and-overflow',()=>{const invalid=[-1,1.5,NaN,Infinity,'1',MAX+1];const results=[];for(const E of invalid){const m=fresh();assert.equal(m.event(E),false);assert.equal(m.reason,'invalid-accounting');results.push({input:String(E),reason:m.reason});}const m=fresh({unrestricted:true});m.event(MAX);assert.equal(m.event(1),false);assert.equal(m.reason,'invalid-accounting');const bad=fresh();bad.count=NaN;assert.equal(bad.event(0),false);return{results,overflow:m.snapshot(),invalidCount:bad.snapshot()};});
run('unrestricted-no-hidden-policy-ceilings',()=>{const m=fresh({P:999999999999,unrestricted:true});m.event(10**12,{elapsed:10**12});assert.equal(m.stopCalls,0);m.request('manual-stop');m.terminal();assert.equal(m.P,10**12);return m.snapshot();});
run('missing-all-data',()=>{const m=fresh({P:20});m.request('manual-stop');m.terminal();assert.equal(m.reason,'empty-output');assert.equal(m.P,20);return m.snapshot();});
for(const phase of ['recording','finalizing'])run('encoder-error-'+phase,()=>{const m=fresh({P:20});m.event(3);if(phase==='finalizing')m.request('manual-stop');const token=m.token;m.abort('encoder-error',false);m.event(9,{token});assert.equal(m.P,20);assert.equal(m.D,0);assert.equal(m.enabled,false);return m.snapshot();});
run('source-eof-and-repeated-stop',()=>{const m=fresh();m.event(4);m.request('manual-stop');m.request('manual-stop');assert.equal(m.stopCalls,1);assert.equal(m.start(),false);m.terminal();assert.equal(m.transportLocked,false);return{...m.snapshot(),limitation:'No Queue/UI integration modeled; future production tests must consume owned deferred EOF exactly once.'};});
run('dispose-clears-prior',()=>{const m=fresh({P:20});const token=m.token;m.event(3);m.dispose();m.terminal({token});assert.equal(m.P,0);assert.deepEqual(m.revoked,['old']);return m.snapshot();});
run('cleanup-failure-no-success',()=>{const m=fresh({P:20});m.event(3);m.request('manual-stop');m.terminal({cleanupOK:false});assert.equal(m.phase,'failed');assert.equal(m.P,20);assert.equal(m.enabled,false);return m.snapshot();});
const report={kind:'prospective pure policy specification models; NOT production governor regressions',cases,passed:true,limitations:'No native scheduling, UI, media validity, allocation, or actual resource-governor implementation exercised. Native shutdown flags are invented controlled inputs.'};
if(process.argv[1]?.endsWith('policy-model.mjs')&&process.argv[2]){if(existsSync(process.argv[2]))throw Error('refusing to overwrite evidence');writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({cases:cases.length,passed:true}));}
