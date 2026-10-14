import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG } from "../src/js/core/config.js";
import { createWaveformAdmission } from "../src/js/audio/waveform-admission.js";
import { createApplicationPreferences } from "../src/js/core/application-preferences.js";
import { evaluateWaveformPolicy } from "../src/js/audio/waveform-policy.js";

const deferred = () => { let resolve, reject; const promise = new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject}; };
const flush = async () => { for(let i=0;i<40;i++)await Promise.resolve(); };
function harness(t,{notify=()=>{}}={}) {
  const preferences=createApplicationPreferences({storage:()=>null});
  const updates=[],operations=[],files=[],media=[];
  let occupancy=0,maxOccupancy=0,reduction;
  function operation(kind,file,promise) {
    operations.push({kind,name:file.name});maxOccupancy=Math.max(maxOccupancy,++occupancy);
    return Promise.resolve(promise).finally(()=>occupancy--);
  }
  const previous=globalThis.OfflineAudioContext;
  globalThis.OfflineAudioContext=class {
    decodeAudioData(bytes){const f=files.find(f=>f.bytes===bytes);return operation('decode',f,f.decode?.promise??{
      numberOfChannels:6,getChannelData(c){if(reduction)reduction();const a=new Float32Array(13);if(c===5)a[12]=-.5;return a;},
    });}
  };
  const bridge=createWaveformAdmission({preferences,onUpdate(status,peaks,detail){updates.push({status,peaks,detail});notify(status,detail);}});
  function track(name,duration=20){
    const el=Object.assign(new EventTarget(),{duration,readyState:Number.isNaN(duration)?0:1,attached:0});
    const add=el.addEventListener.bind(el),remove=el.removeEventListener.bind(el);
    el.addEventListener=(...a)=>{el.attached++;add(...a)};
    el.removeEventListener=(...a)=>{el.attached--;remove(...a)};media.push(el);
    const f={name,size:16,bytes:new ArrayBuffer(16),media:el};files.push(f);
    f.slice=(a,b)=>({arrayBuffer:()=>operation('prefix',f,f.prefix?.promise??new ArrayBuffer(b-a))});
    f.arrayBuffer=()=>operation('read',f,f.read?.promise??f.bytes);
    return f;
  }
  const load=(f,identity=()=>true)=>bridge.loadFile(f,{media:f.media,isCurrent:identity});
  t.after(()=>{bridge.dispose();globalThis.OfflineAudioContext=previous});
  return {bridge,preferences,track,load,updates,operations,media,get maxOccupancy(){return maxOccupancy},
    setReduction(fn){reduction=fn},get last(){return updates.at(-1)}};
}

test('I.2D reentrant File selection during Reset keeps newest intent and removes all listeners',async t=>{
 let h,reentered=false,newer;
 h=harness(t,{notify(status){if(status==='empty'&&!reentered){reentered=true;newer=h.load(b);}}});
 const a=h.track('older A'),b=h.track('newer B');
 const older=h.load(a);await Promise.all([older,newer]);await flush();h.bridge.reset();
 assert.deepEqual(h.operations.filter(o=>o.kind==='read').map(o=>o.name),['newer B'],'newer reentrant selection must win');
 assert.equal(a.media.attached+b.media.attached,0,'reentrant replacement must not orphan metadata listeners');
});

test('I.2D reentrant Clear during Reset cannot revive the older File request',async t=>{
 let h,reentered=false;
 h=harness(t,{notify(status){if(status==='empty'&&!reentered){reentered=true;h.bridge.reset();}}});
 await h.load(h.track('cancelled A'));await flush();
 assert.equal(h.operations.length,0,'newer reentrant Clear must invalidate older load');
 assert.equal(h.media[0].attached,0);
});

test('I.2D profile edit during offer notification is reconciled once after settlement',async t=>{
 let h,changed=false;
 h=harness(t,{notify(status,detail){if(status==='unavailable'&&detail?.manualEligible&&!changed){changed=true;h.preferences.set({selectedProfileId:'15m'});}}});
 await h.load(h.track('nine minutes',540));await flush();
 assert.deepEqual(h.operations.filter(o=>o.kind==='read').map(o=>o.name),['nine minutes'],'reentrant profile edit must re-evaluate current File');
 assert.equal(h.operations.filter(o=>o.kind==='prefix').length,1,'profile reconciliation must reuse the bounded probe');
 assert.equal(h.last.status,'ready');assert.equal(h.maxOccupancy,1);
});

for(const stage of ['prefix','read','decode'])test(`I.2D cross-stage occupancy under ${stage} A→B→C and obsolete rejection`,async t=>{
 const h=harness(t),a=h.track('A'),b=h.track('B'),c=h.track('C');a[stage]=deferred();
 const pa=h.load(a);await flush();const pb=h.load(b),pc=h.load(c);await flush();
 assert.equal(h.operations.some(o=>o.name!=='A'),false,'replacement must not start any optional operation before settlement');
 assert.equal(h.bridge.snapshot().pending,true);
 a[stage].reject(Error('obsolete '+stage));await Promise.all([pa,pb,pc]);await flush();
 assert.equal(h.maxOccupancy,1,'prefix/full-read/native stages must share one resource slot');
 assert.equal(h.operations.some(o=>o.name==='B'),false,'obsolete B must never start');
 assert.equal(h.operations.filter(o=>o.kind==='read'&&o.name==='C').length,1);
 assert.equal(h.last.status,'ready');assert.equal(h.last.peaks[511],.5);
 h.bridge.reset();assert.ok(h.media.every(m=>m.attached===0));
});

test('I.2D replacement inside synchronous reduction keeps its slot and fences stale peaks',async t=>{
 const h=harness(t),a=h.track('A'),b=h.track('B'),c=h.track('C');let reentered=false,pb,pc;
 h.setReduction(()=>{if(reentered)return;reentered=true;pb=h.load(b);pc=h.load(c);
   assert.equal(h.bridge.snapshot().occupied,true);assert.equal(h.operations.some(o=>o.name!=='A'),false,'reduction cannot release occupancy reentrantly');});
 await h.load(a);await Promise.all([pb,pc]);await flush();
 assert.equal(h.operations.some(o=>o.name==='B'),false);assert.equal(h.updates.filter(u=>u.status==='ready').length,1,'stale reduction must not commit');
 assert.equal(h.maxOccupancy,1);
});

test('I.2D manual authorization is not inherited by a repeated selection of the same File',async t=>{
 const h=harness(t),f=h.track('same File',540);await h.load(f);await h.bridge.generate();
 await h.load(f);assert.equal(h.last.detail.decision,'offer');assert.equal(h.operations.filter(o=>o.kind==='read').length,1,'new request must not borrow old manual authorization');
 await h.bridge.generate();assert.equal(h.operations.filter(o=>o.kind==='read').length,2);
});

test('I.2D post-read admission rechecks policy without native work or retry loops',async t=>{
 const h=harness(t),a=h.track('A',540);h.preferences.set({selectedProfileId:'15m'});a.read=deferred();
 const pa=h.load(a);await flush();h.preferences.set({selectedProfileId:'4m'});a.read.resolve(a.bytes);await pa;await flush();
 assert.equal(h.operations.filter(o=>o.kind==='decode').length,0,'post-read profile revocation must prevent native decoding');
 assert.equal(h.operations.filter(o=>o.kind==='read').length,1);assert.equal(h.last.detail.decision,'offer');
});

test('I.2D an unsettled decoder preserves one newest intent under preference storms',async t=>{
 const h=harness(t),a=h.track('A'),b=h.track('B',540);a.decode=deferred();
 const pa=h.load(a);await flush();const pb=h.load(b);
 for(let i=0;i<100;i++){h.preferences.set({selectedProfileId:i%2?'4m':'15m'});void h.bridge.generate();}
 await flush();assert.equal(h.operations.some(o=>o.name==='B'),false,'settings/manual storm cannot release native occupancy');
 assert.equal(h.bridge.snapshot().occupied,true);assert.equal(h.bridge.snapshot().pending,true);assert.equal(h.maxOccupancy,1);
 h.bridge.reset();a.decode.resolve({numberOfChannels:1,getChannelData:()=>new Float32Array([.5])});await Promise.all([pa,pb]);
 assert.equal(h.operations.some(o=>o.name==='B'),false);assert.ok(h.media.every(m=>m.attached===0));
});

test('I.2D integer workload oracle independently checks profiles, hard gates and expert source edits',()=>{
 let checked=0;
 for(const rate of [44100,48000,96000])for(const channels of [1,2,6,16])for(const seconds of [1,240,360,540,900,3600])for(const behavior of ['ask','generate-if-permitted','skip'])for(const manual of [false,true]) {
   const p=structuredClone(CONFIG.waveform);p.decodeSampleRateHz=rate;
   const encoded=1024,pcm=BigInt(seconds)*BigInt(rate)*BigInt(channels)*4n,profile=8n*60n*BigInt(rate)*2n*4n;
   const expected=pcm>BigInt(p.maxEstimatedDecodedPcmBytes)?'refuse':manual||pcm<=profile||behavior==='generate-if-permitted'?'admit':behavior==='ask'?'offer':'refuse';
   const actual=evaluateWaveformPolicy({fileSizeBytes:encoded,durationSeconds:seconds,channelCount:channels,metadataConfidence:'verified',durationState:'available',aboveProfileBehavior:behavior,requestKind:manual?'manual':'automatic'},p);
   assert.equal(actual.decision,expected,JSON.stringify({rate,channels,seconds,behavior,manual}));checked++;
 }
 assert.equal(checked,432);
 const p=structuredClone(CONFIG.waveform);p.maxEncodedBytes=Number.MAX_SAFE_INTEGER;p.maxEstimatedDecodedPcmBytes=Number.MAX_SAFE_INTEGER;
 assert.equal(evaluateWaveformPolicy({fileSizeBytes:Number.MAX_SAFE_INTEGER,durationSeconds:3600,channelCount:6,metadataConfidence:'verified',requestKind:'manual'},p).decision,'admit');
 for(const field of ['maxEncodedBytes','maxEstimatedDecodedPcmBytes','decodeSampleRateHz','fallbackEstimatedChannels'])for(const value of [NaN,Infinity,-1,Number.MAX_SAFE_INTEGER+1]){
   const bad={...p,[field]:value};assert.equal(evaluateWaveformPolicy({fileSizeBytes:16,durationSeconds:20},bad).reason,'invalid-policy');
 }
});
