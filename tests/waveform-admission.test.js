import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG } from "../src/js/core/config.js";
import { createApplicationPreferences } from "../src/js/core/application-preferences.js";
import { createWaveformAdmission } from "../src/js/audio/waveform-admission.js";
import { createWaveformCoordinator } from "../src/js/audio/waveform-coordinator.js";
import { pcmHeader } from "./helpers/waveform-wav.js";

const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b}); return {promise,resolve,reject}; };
const flush = async () => { for(let i=0;i<30;i++) await Promise.resolve(); };
function harness(t, duration=540) {
  const media = Object.assign(new EventTarget(), {duration, readyState:Number.isNaN(duration)?0:1, currentTime:0});
  const updates=[], probes=[], reads=[], decodes=[], files=[];
  let listeners=0,maxListeners=0,outstanding=0,maxOutstanding=0;
  const add=media.addEventListener.bind(media),remove=media.removeEventListener.bind(media);
  media.addEventListener=(...a)=>{maxListeners=Math.max(maxListeners,++listeners);add(...a)};
  media.removeEventListener=(...a)=>{listeners--;remove(...a)};
  const preferences=createApplicationPreferences({storage:()=>null});
  const previous=globalThis.OfflineAudioContext;
  globalThis.OfflineAudioContext=class {decodeAudioData(bytes){const f=files.find(f=>f.bytes===bytes);decodes.push(f.name);return f.decode?.promise??Promise.resolve({numberOfChannels:2,getChannelData:()=>new Float32Array([.25])})}};
  const admission=createWaveformAdmission({preferences,onUpdate:(status,peaks,detail)=>updates.push({status,peaks,detail})});
  t.after(()=>{admission.dispose();globalThis.OfflineAudioContext=previous});
  function file(name='fixture',size=16) {
    const f={name,size,bytes:new ArrayBuffer(16)};
    f.slice=(start,end)=>{probes.push({name,start,end});maxOutstanding=Math.max(maxOutstanding,++outstanding);return {arrayBuffer:()=>Promise.resolve(f.probe?.promise??new ArrayBuffer(end-start)).finally(()=>outstanding--)}};
    f.arrayBuffer=()=>{reads.push(name);return f.read?.promise??Promise.resolve(f.bytes)};
    files.push(f);return f;
  }
  const load=(f,opts={})=>admission.loadFile(f,{media,...opts});
  return {admission,preferences,media,updates,probes,reads,decodes,file,load,
    get last(){return updates.at(-1)},get listeners(){return listeners},get maxListeners(){return maxListeners},get maxOutstanding(){return maxOutstanding},
    metadata(duration){media.duration=duration;media.readyState=1;media.dispatchEvent(new Event('loadedmetadata'))}};
}

test('AUD-007 integrated nine-minute Ask offers without full read; repeated manual clicks admit once',async t=>{
 const h=harness(t);await h.load(h.file());assert.equal(h.last.detail.decision,'offer');assert.deepEqual(h.reads,[]);
 const calls=[h.admission.generate(),h.admission.generate(),h.admission.generate()];await Promise.all(calls);
 assert.deepEqual(h.reads,['fixture'],'repeated manual clicks must admit exactly once');assert.equal(h.decodes.length,1);assert.equal(h.probes.length,1);assert.equal(h.last.status,'ready');
});
for(const [profile,behavior,reads] of [['15m','ask',1],['8m','generate-if-permitted',1],['8m','skip',0]])test(`AUD-007 integrated ${profile}/${behavior}`,async t=>{
 const h=harness(t);h.preferences.set({selectedProfileId:profile,aboveProfileBehavior:behavior});await h.load(h.file());
 assert.equal(h.reads.length,reads);
 if(!reads){assert.equal(h.last.detail.manualEligible,true);await h.admission.generate();assert.equal(h.reads.length,1)}
});
for(const behavior of ['ask','generate-if-permitted','skip'])test(`AUD-007 hard PCM refusal under ${behavior} reads/decodes nothing and remains seek independent`,async t=>{
 const h=harness(t,3600);h.preferences.set({aboveProfileBehavior:behavior});await h.load(h.file());
 assert.equal(h.last.detail.reason,'pcm-budget');await h.admission.generate();
 assert.equal(h.reads.length,0,'hard PCM refusal must precede full read');assert.equal(h.decodes.length,0,'hard PCM refusal must precede native decode');
 h.media.currentTime=2700;assert.equal(h.media.currentTime,2700);assert.equal(h.probes.length,1);
});
test('AUD-007 hard encoded refusal performs neither prefix nor full read',async t=>{
 const h=harness(t,20);await h.load(h.file('over',CONFIG.waveform.maxEncodedBytes+1));await h.admission.generate();
 assert.equal(h.last.detail.reason,'encoded-budget');assert.equal(h.probes.length,0);assert.equal(h.reads.length,0,'encoded admission must precede full read');assert.equal(h.decodes.length,0);
});
test('AUD-007 bounded WAV prefix establishes six-channel admission metadata',async t=>{
 const h=harness(t,1),fixture=pcmHeader({frames:96000,rate:96000,channels:6}),f=h.file('six',fixture.fileSize);
 f.slice=(start,end)=>{h.probes.push({start,end});return {arrayBuffer:async()=>{const b=new Uint8Array(end-start);b.set(new Uint8Array(fixture.bytes));return b.buffer}}};
 await h.load(f);assert.equal(h.probes[0].end,65536);assert.equal(h.last.detail.metadata.channelCount,6);assert.equal(h.last.detail.metadata.confidence,'verified');
});
test('AUD-007 unknown-channel compressed media explicitly estimates channels',async t=>{
 const h=harness(t,20);await h.load(h.file());assert.equal(h.last.detail.metadata.assumption,'configured-channel-fallback');assert.equal(h.last.detail.metadata.channelCount,2);assert.equal(h.last.detail.metadata.confidence,'estimated');
});
test('AUD-007 pending duration waits once and metadata events do not repeat probes',async t=>{
 const h=harness(t,NaN);await h.load(h.file());assert.equal(h.last.status,'metadata');assert.equal(h.reads.length,0);assert.equal(h.admission.snapshot().occupied,false);
 for(let i=0;i<50;i++)await h.admission.refresh();assert.equal(h.probes.length,1,'metadata refresh must not repeat probe work');
 h.metadata(20);await flush();assert.equal(h.reads.length,1);assert.equal(h.probes.length,1);
});
for(const duration of [Infinity,-1,0])test(`AUD-007 invalid media duration ${duration} never extracts`,async t=>{
 const h=harness(t,duration);await h.load(h.file());assert.equal(h.last.detail.reason,'metadata-unavailable');assert.equal(h.reads.length,0);
});
test('AUD-007 NaN after media metadata readiness is unavailable, never zero or pending forever',async t=>{
 const h=harness(t,NaN);h.media.readyState=1;await h.load(h.file());
 assert.equal(h.last.detail.reason,'metadata-unavailable');assert.equal(h.reads.length,0);
 h.metadata(20);await flush();assert.equal(h.reads.length,1);
});
test('AUD-007 metadata error without duration refuses truthfully, playback is not owned here',async t=>{
 const h=harness(t,NaN);await h.load(h.file());h.media.dispatchEvent(new Event('error'));await flush();
 assert.equal(h.last.detail.reason,'metadata-unavailable');assert.equal(h.reads.length,0);
});
test('AUD-007 rejected prefix uses explicitly estimated fallback with known media duration',async t=>{
 const h=harness(t,20),f=h.file();f.slice=()=>({arrayBuffer:async()=>{throw Error('probe IO')}});await h.load(f);
 assert.equal(h.last.detail.metadata.confidence,'estimated');assert.equal(h.last.detail.metadata.assumption,'configured-channel-fallback');assert.equal(h.reads.length,1);
});
test('AUD-007 A→B→C shares one resource slot; stale metadata cannot activate A or B',async t=>{
 const h=harness(t,20),a=h.file('A'),b=h.file('B'),c=h.file('C');a.probe=deferred();
 const pa=h.load(a),pb=h.load(b),pc=h.load(c);await flush();assert.equal(h.probes.length,1,'rapid replacement must serialize metadata probes');
 assert.equal(h.maxListeners,3);assert.equal(h.listeners,3);assert.equal(h.admission.snapshot().pending,true);
 a.probe.resolve(new ArrayBuffer(16));await Promise.all([pa,pb,pc]);
 assert.deepEqual(h.probes.map(p=>p.name),['A','C']);assert.deepEqual(h.reads,['C'],'stale metadata must not activate obsolete File');assert.equal(h.maxOutstanding,1);assert.deepEqual(h.decodes,['C']);
});
test('AUD-007 delayed duration and old media callbacks cannot activate stale File',async t=>{
 const h=harness(t,NaN),a=h.file('A');await h.load(a);h.admission.reset();h.metadata(20);await flush();
 assert.equal(h.reads.length,0,'stale duration must not activate old File');assert.equal(h.listeners,0);
});
test('AUD-007 wrong-source manual action revalidates UI identity before requesting coordinator',async t=>{
 const h=harness(t);let valid=true;await h.load(h.file(),{isCurrent:()=>valid});valid=false;
 await h.admission.generate();assert.equal(h.reads.length,0,'manual generation must reject wrong-source identity');assert.equal(h.admission.snapshot().occupied,false);
});
test('AUD-007 queued manual request waits behind native settlement, never duplicates or releases early',async t=>{
 const h=harness(t,20),a=h.file('A'),b=h.file('B');a.decode=deferred();const pa=h.load(a);await flush();assert.deepEqual(h.decodes,['A']);
 h.media.duration=540;const pb=h.load(b);assert.equal(h.last.status,'waiting');
 await h.admission.generate();assert.deepEqual(h.reads,['A'],'pending manual action must not release native occupancy');
 a.decode.resolve({numberOfChannels:1,getChannelData:()=>new Float32Array([1])});await Promise.all([pa,pb]);
 assert.equal(h.last.detail.decision,'offer');await h.admission.generate();assert.deepEqual(h.reads,['A','B']);
});
test('AUD-007 metadata changes during encoded read are checked again before native decode',async t=>{
 const h=harness(t,20),f=h.file();f.read=deferred();const p=h.load(f);await flush();h.metadata(3600);f.read.resolve(f.bytes);await p;
 assert.equal(h.decodes.length,0,'changed PCM admission must prevent native decode');assert.equal(h.last.detail.reason,'pcm-budget');
});
test('AUD-007 optional native failure is terminal for this intent; later track recovers',async t=>{
 const h=harness(t,20),a=h.file('A');a.decode=deferred();const p=h.load(a);await flush();a.decode.reject(Error('native'));await p;
 assert.equal(h.last.status,'unavailable');for(let i=0;i<20;i++)await h.admission.refresh();assert.deepEqual(h.decodes,['A']);
 await h.load(h.file('B'));assert.equal(h.last.status,'ready');
});
test('AUD-007 coordinator prepare retains occupancy until actual probe settlement after Reset',async()=>{
 const gate=deferred(),started=[],updates=[];
 const c=createWaveformCoordinator({prepare:async f=>{started.push(f);await gate.promise;return true},extract:async()=>new Float32Array([1]),onUpdate:s=>updates.push(s)});
 const pa=c.request('A');c.reset();const pb=c.request('B');assert.deepEqual(started,['A'],'reset must retain unsettled prepare occupancy');assert.equal(c.snapshot().pending,true);
 gate.resolve();await Promise.all([pa,pb]);assert.deepEqual(started,['A','B']);assert.equal(updates.filter(s=>s==='ready').length,1);
});
