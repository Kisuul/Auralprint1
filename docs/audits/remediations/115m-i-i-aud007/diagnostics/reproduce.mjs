// Test-only resource observations of the actual production Scrubber. No large allocation.
// Run from any cwd: node <this script> [output.json] [--negative-control]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {AudioEngine} from '../../../../../src/js/audio/audio-engine.js';
import {state} from '../../../../../src/js/core/state.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
let source=fs.readFileSync(path.join(root,'src/js/audio/scrubber.js'),'utf8');
const negative=process.argv.includes('--negative-control');
// Disposable in-memory mutation: allow obsolete successful decodes to commit.
if(negative) source=source.replace('if (decodeToken !== _decodeToken) return;\n      _waveform', '_waveform');
source=source.replace(/from "([^"]+)"/g,(_,s)=>`from ${JSON.stringify(pathToFileURL(path.resolve(root,'src/js/audio',s)).href)}`);
const {Scrubber}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve()};
let meter, lastRects=[], text={textContent:''};
globalThis.window=new EventTarget();globalThis.document={getElementById:()=>text};
const media={duration:20,currentTime:0};AudioEngine.getMediaEl=()=>media;
state.audio.isLoaded=true;state.audio.isPlaying=true;
const context=new Proxy({clearRect(){lastRects=[]},fillRect(...args){lastRects.push(args)}},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
const canvas=Object.assign(new EventTarget(),{clientWidth:100,clientHeight:36,width:100,height:36,getContext:()=>context,getBoundingClientRect:()=>({left:0,width:100})});
Scrubber.init(canvas);
globalThis.OfflineAudioContext=class {constructor(...args){meter.contexts++;meter.contextArgs.push(args)}decodeAudioData(buffer){const op=meter.files.find(f=>f.buffer===buffer);assert.ok(op);meter.decodeStarts++;meter.activeDecodes++;meter.maxDecodes=Math.max(meter.maxDecodes,meter.activeDecodes);op.nativeStarted=true;return op.decode.promise.then(v=>{meter.activeDecodes--;return v},e=>{meter.activeDecodes--;throw e})}};
const cases=[];
function setup(){Scrubber.reset();media.currentTime=0;meter={readStarts:0,activeReads:0,maxReads:0,decodeStarts:0,activeDecodes:0,maxDecodes:0,contexts:0,contextArgs:[],files:[]}}
function file(name,amp=.5){const f={name,buffer:new ArrayBuffer(16),read:deferred(),decode:deferred(),nativeStarted:false,amp};f.arrayBuffer=()=>{meter.readStarts++;meter.activeReads++;meter.maxReads=Math.max(meter.maxReads,meter.activeReads);return f.read.promise.then(()=>{meter.activeReads--;return f.buffer},e=>{meter.activeReads--;throw e})};meter.files.push(f);return f}
const pcm=f=>({numberOfChannels:2,getChannelData:()=>new Float32Array(13).fill(f.amp)});
function snapshot(stage){Scrubber.draw();return {stage,readStarts:meter.readStarts,activeReads:meter.activeReads,decodeStarts:meter.decodeStarts,activeDecodes:meter.activeDecodes,maxReads:meter.maxReads,maxDecodes:meter.maxDecodes,status:text.textContent,peakHeight:lastRects[1]?.[3]??null,logicallyCurrentJobs:/decoding/.test(text.textContent)?1:0,nativeAwaitingSettlement:meter.activeDecodes}}
function result(name,steps){cases.push({name,steps,fixtureEncodedBytes:16,fixtureDecodedBytesPerCompletion:104})}
async function read(f){f.read.resolve();await flush()}
async function finish(f,p){f.decode.resolve(pcm(f));await p}
// 1/2: reads overlap; stale A's read is not canceled but is discarded before decode.
setup();{const a=file('A'),b=file('B');const pa=Scrubber.loadFile(a),steps=[snapshot('A read started')];const pb=Scrubber.loadFile(b);steps.push(snapshot('B replaces A before read resolves'));await read(a);await pa;assert.equal(meter.decodeStarts,0);steps.push(snapshot('A read completed: no native decode'));await read(b);await finish(b,pb);assert.equal(meter.decodeStarts,1);result('replacement during encoded read',steps.concat(snapshot('B ready')))}
// 3: overlapping native operations; stale completion cannot overwrite B.
setup();{const a=file('A',.9),b=file('B',.25);const pa=Scrubber.loadFile(a);await read(a);const steps=[snapshot('A native decode started')];const pb=Scrubber.loadFile(b);await read(b);steps.push(snapshot('B native decode starts while A pending'));assert.equal(meter.activeDecodes,2);await finish(b,pb);const height=snapshot('B ready').peakHeight;steps.push(snapshot('B ready'));await finish(a,pa);assert.equal(snapshot('A settles stale').peakHeight,height,'stale decode must not overwrite newest waveform');result('replacement during native decode',steps.concat(snapshot('A settles stale')))}
// 4: A/B/C all enter decode, latest wins with three unresolved operations.
setup();{const files=['A','B','C'].map((n,i)=>file(n,(i+1)/4)),ps=[],steps=[];for(const f of files){ps.push(Scrubber.loadFile(f));await read(f);steps.push(snapshot(f.name+' starts decode'))}assert.equal(meter.activeDecodes,3);await finish(files[2],ps[2]);const h=snapshot('C ready').peakHeight;await finish(files[0],ps[0]);await finish(files[1],ps[1]);assert.equal(snapshot('all settled').peakHeight,h);result('rapid A/B/C switching',steps.concat(snapshot('all settled')))}
// 5: Clear/reset invalidates presentation, does not settle outstanding decode.
setup();{const a=file('A');const p=Scrubber.loadFile(a);await read(a);Scrubber.reset();const steps=[snapshot('Clear/reset while decode pending')];assert.equal(meter.activeDecodes,1);assert.equal(steps[0].peakHeight,null);await finish(a,p);assert.equal(snapshot('stale settlement after Clear').peakHeight,null);result('Clear invalidation',steps.concat(snapshot('stale settlement after Clear')))}
// 6/7/10: rejection current -> unavailable, valid later file recovers.
for(const stage of ['read','decode']){setup();const a=file('A'),p=Scrubber.loadFile(a);if(stage==='decode')await read(a);a[stage].reject(new Error('controlled '+stage+' refusal'));await p;const steps=[snapshot(stage+' rejected')];assert.match(steps[0].status,/unavailable/);const b=file('B'),pb=Scrubber.loadFile(b);await read(b);await finish(b,pb);assert.doesNotMatch(snapshot('B recovered').status,/decoding|unavailable/);result(stage+' rejection and later recovery',steps.concat(snapshot('B recovered')))}
// stale rejection is also fenced at both stages.
for(const stage of ['read','decode']){setup();const a=file('A'),pa=Scrubber.loadFile(a);if(stage==='decode')await read(a);const b=file('B'),pb=Scrubber.loadFile(b);await read(b);await finish(b,pb);a[stage].reject(new Error('stale refusal'));await pa;assert.doesNotMatch(snapshot('B unchanged').status,/unavailable/);result('stale '+stage+' rejection',[snapshot('B unchanged')])}
// 8: pending operation has no settlement dependency on next load; Reset has no cancellation.
setup();{const a=file('A'),pa=Scrubber.loadFile(a);await read(a);Scrubber.reset();const b=file('B'),pb=Scrubber.loadFile(b);await read(b);await finish(b,pb);const steps=[snapshot('B ready while A never settles during observation')];assert.equal(meter.activeDecodes,1);assert.doesNotMatch(steps[0].status,/decoding/);result('unsettled decode after Reset and replacement',steps);await finish(a,pa)}
// 9: media identity/currentTime and loaded/playing flags independent of failure; seek without peaks.
setup();{const a=file('A'),p=Scrubber.loadFile(a);a.read.reject(new Error('waveform unavailable'));await p;const e=new Event('mousedown');e.clientX=75;canvas.dispatchEvent(e);window.dispatchEvent(new Event('mouseup'));assert.equal(media.currentTime,15);assert.equal(state.audio.isLoaded,true);assert.equal(state.audio.isPlaying,true);result('waveform unavailable preserves media and seeking',[{...snapshot('seek on fallback'),mediaCurrentTime:media.currentTime,isLoaded:state.audio.isLoaded,isPlaying:state.audio.isPlaying,mediaIsMock:true}])}
// reset while read pending skips context allocation entirely.
setup();{const a=file('A'),p=Scrubber.loadFile(a);Scrubber.reset();await read(a);await p;assert.equal(meter.decodeStarts,0);result('Reset during read skips decoder',[snapshot('read settled after Reset')])}
const evidence={baseline:'704bf13d3a3dfb76032343226bad7240191ef6c6',node:process.version,kind:'controlled promises around production loadFile; counters measure initiations, not native RSS or physical threads',negativeControl:negative,cases};
const output=process.argv[2];if(output&&!output.startsWith('--'))fs.writeFileSync(output,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({pass:true,cases:cases.length,maxNativeInitiationsSimultaneously:3,maxReadsSimultaneously:2,negativeControl:negative}));
