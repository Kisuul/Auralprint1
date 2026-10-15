import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createRecordingState, state } from "../src/js/core/state.js";
import { defaultSelection, resolveRecordingPolicy } from "../src/js/recording/recording-policy.js";

// Observe pending references and authority without a production diagnostics API.
const url = new URL("../src/js/recording/recorder-engine.js", import.meta.url);
const source = readFileSync(url, "utf8").replace('    seenEvents: new WeakSet(),', '    retainedLedger: [], seenEvents: new WeakSet(),').replace('runtime.pendingChunks.push(data);', 'runtime.retainedLedger.push(data); runtime.pendingChunks.push(data);').replace(/from "(\.[^"]+)"/g, (_, path) => `from "${new URL(path,url).href}"`)
  .replace("    init,", "    inspect: () => ({ pending: runtime.pendingChunks.slice(), ledger: runtime.retainedLedger.slice(), unresolved: runtime.unresolvedOwnership, timer: runtime.timerIntervalId }),\n    init,");
const temp = mkdtempSync(join(tmpdir(), "n3-recorder-"));
const observed = join(temp, "engine.mjs");writeFileSync(observed, source);
after(() => rmSync(temp, { recursive:true, force:true }));
const { createRecorderEngine } = await import(pathToFileURL(observed).href);
const custom = (values = {}) => resolveRecordingPolicy({ profile:"custom", custom:{ ...defaultSelection().custom,
  softBytes:10, aggregateBytes:100, maxChunks:5, durationMs:1000, ...values } });
const unrestricted = () => resolveRecordingPolicy({ ...defaultSelection(), profile:"unrestricted" });

function harness(t, policy = custom()) {
  const saved=Object.fromEntries(["window","MediaStream","MediaRecorder","setInterval","clearInterval"].map(k=>[k,globalThis[k]]));
  const oldAudio={...state.audio};state.audio.isLoaded=true;
  const recording=createRecordingState(); recording.includePlaybackAudio=true;
  const engine=createRecorderEngine(), recorders=[], timers=new Map(), oldTimers=[], tracks=[], revoked=[], created=[];
  const faults={}, calls={ release:0, upstreamStop:0 };let clock=0,id=0;
  const urls={create:URL.createObjectURL,revoke:URL.revokeObjectURL};
  const upstream={kind:"audio",stop(){calls.upstreamStop++;}};
  class Stream {
    constructor(tracks=[]){this.tracks=tracks;}
    addTrack(t){this.tracks.push(t);} getTracks(){return this.tracks;}
    getVideoTracks(){return this.tracks.filter(t=>t.kind==="video");}
    getAudioTracks(){return this.tracks.filter(t=>t.kind==="audio");}
  }
  class Native {
    static isTypeSupported(){return true;}
    constructor(){this.state="inactive";this.stops=0;recorders.push(this);}
    start(){this.state="recording";faults.start?.(this);}
    stop(){this.stops++;if(faults.stopThrow) throw Error("stop refused");
      if(!faults.remainActive)this.state="inactive";faults.stop?.(this);}
    data(size, content){
      const blob=content===undefined ? {size} : new Blob([content]);
      this.ondataavailable?.({data:blob});return blob;
    }
    handlers(){return {data:this.ondataavailable,stop:this.onstop,error:this.onerror};}
  }
  globalThis.window={MediaRecorder:Native};globalThis.MediaRecorder=Native;globalThis.MediaStream=Stream;
  globalThis.setInterval=fn=>{timers.set(++id,fn);oldTimers.push(fn);return id;};globalThis.clearInterval=id=>timers.delete(id);
  URL.createObjectURL=blob=>{if(faults.url)throw Error("URL refused");const u=urls.create(blob);created.push(u);return u;};
  URL.revokeObjectURL=u=>{revoked.push({url:u,current:recording.lastExportUrl,pending:engine.inspect().pending.length});urls.revoke(u);};
  const init=()=>engine.init({stateRef:recording,getPolicy:()=>policy, nowMs:()=>clock,
    getRenderTap:()=>({canvas:{captureStream(){const t={kind:"video",stops:0,stop(){this.stops++;if(faults.render)throw Error("render cleanup refused");}};tracks.push(t);return new Stream([t]);}}}),
    getAudioTap:()=>({ensureStream:()=>new Stream(faults.audioEmpty?[]:[upstream]), releaseStream(){calls.release++;if(faults.release)throw Error("tap release refused");}})});
  init();
  t.after(()=>{faults.stopThrow=false;faults.remainActive=false;faults.release=false;faults.render=false;engine.dispose();
    created.forEach(u=>urls.revoke(u));URL.createObjectURL=urls.create;URL.revokeObjectURL=urls.revoke;Object.assign(globalThis,saved);Object.assign(state.audio,oldAudio);});
  const start=()=>{const result=engine.start();assert.equal(result.ok,true,result.message);return recorders.at(-1);};
  const complete=(content="old")=>{const r=start();r.data(null,content);engine.stop();r.onstop?.();assert.equal(recording.phase,"complete");return recording.lastExportUrl;};
  return {engine,recording,recorders,timers,oldTimers,tracks,calls,faults,revoked,created,init,start,complete,
    policy:p=>{policy=p;},clock:n=>{clock=n;},tick:()=>[...timers.values()].forEach(fn=>fn())};
}
for (const size of [9,10,11]) test(`N3 S boundary ${size}`,t=>{
  const h=harness(t),r=h.start();r.data(size);
  assert.equal(r.stops,size>=10?1:0);assert.equal(h.recording.admittedBytes,size);
  assert.equal(h.recording.stopReason,size>=10?"capacity-stop":null);
  assert.equal(h.engine.inspect().pending.length,1);
});
for (const size of [99,100,101]) test(`N3 H boundary ${size}`,t=>{
  const h=harness(t,custom({softBytes:null})),r=h.start(),blob=r.data(size);
  assert.equal(h.recording.deliveredBytes,size);
  if(size<=100){assert.equal(h.recording.admittedBytes,size);assert.ok(h.engine.inspect().pending.includes(blob));}
  else {assert.equal(h.recording.lastCode,"admission-rejected");assert.equal(h.recording.rejectedBytes,size);assert.equal(h.recording.rejectedEvents,1);assert.equal(h.engine.inspect().pending.length,0);assert.ok(!h.engine.inspect().ledger.includes(blob));}
});
for (const count of [4,5,6]) test(`N3 C boundary ${count}`,t=>{
  const h=harness(t,custom({softBytes:null})),r=h.start();for(let i=0;i<count;i++)r.data(1);
  assert.equal(h.recording.admittedBytes,Math.min(count,5));
  assert.equal(h.recording.phase,count>5?"error":"recording");
  assert.equal(h.engine.inspect().pending.length,count>5?0:count);
});
test("N3 aggregate includes P; Start refuses insufficient reserve and never deletes P",async t=>{
  const h=harness(t),url=h.complete("previous");h.policy(custom({softBytes:null}));const r=h.start();r.data(93);
  assert.equal(h.recording.lastCode,"admission-rejected");assert.equal(h.recording.previousExportBytes,8);
  assert.equal(await(await fetch(url)).text(),"previous");
  h.policy(custom({softBytes:null,aggregateBytes:8}));const before=h.recorders.length;
  assert.equal(h.engine.start().code,"policy-start-refused");assert.equal(h.recorders.length,before);
  assert.equal(h.recording.lastExportUrl,url);
});
test("N3 final tail beyond S remains whole inside H; old URL revoked after commit",async t=>{
  const h=harness(t),old=h.complete();h.faults.stop=r=>{r.data(null,"tail");r.onstop?.();};
  const r=h.start();r.data(null,"0123456789");
  assert.equal(r.stops,1);assert.equal(h.recording.phase,"complete");assert.equal(h.recording.stopReason,"capacity-stop");
  assert.equal(h.recording.finalExportBytes,14);assert.equal(h.recording.admittedBytes,14);
  assert.equal(h.recording.retainedChunkCount,0);assert.equal(h.engine.inspect().pending.length,0);
  assert.equal(await(await fetch(h.recording.lastExportUrl)).text(),"0123456789tail");
  assert.deepEqual(h.revoked.map(v=>v.url),[old]);assert.equal(h.revoked[0].current,h.recording.lastExportUrl);
});
test("N3 oversized final event rejects whole replacement and preserves old download",async t=>{
  const h=harness(t),old=h.complete();h.faults.stop=r=>{r.data(95);r.onstop?.();};const r=h.start();r.data(10);
  assert.equal(h.recording.lastCode,"admission-rejected");assert.equal(h.recording.terminalOutcome,"failed");
  assert.equal(h.recording.admittedBytes,10);assert.equal(h.recording.rejectedBytes,95);assert.equal(h.engine.inspect().pending.length,0);
  assert.equal(await(await fetch(old)).text(),"old");assert.equal(h.revoked.length,0);
});
for(const size of [-1,NaN,Infinity,1.5,"1",undefined,Number.MAX_SAFE_INTEGER+1]) test(`N3 invalid reported size ${size}`,t=>{
  const h=harness(t,unrestricted()),r=h.start();r.data(size);
  assert.equal(h.recording.lastCode,"accounting-invalid");assert.equal(h.recording.rejectedEvents,1);assert.equal(h.engine.inspect().pending.length,0);
});
test("N3 Unrestricted no hidden capacity; checked integer overflow fails explicitly",t=>{
  const h=harness(t,unrestricted()),r=h.start();h.clock(1e9);h.tick();
  for(let i=0;i<1201;i++)r.data(1);
  assert.equal(r.stops,0);assert.equal(h.recording.retainedChunkCount,1201);
  r.data(Number.MAX_SAFE_INTEGER-1201);assert.equal(h.recording.admittedBytes,Number.MAX_SAFE_INTEGER);
  r.data(1);assert.equal(h.recording.lastCode,"accounting-invalid");assert.equal(h.engine.inspect().pending.length,0);
});
test("N3 monotonic timer and same-check byte/time tie; old timer cannot stop newer session",t=>{
  const h=harness(t),r=h.start();h.clock(1000);r.data(10);
  assert.equal(h.recording.stopReason,"capacity-stop");assert.equal(h.recording.secondaryStopReason,"duration-stop");
  assert.equal(r.stops,1);h.engine.stop();h.engine.stop();assert.equal(r.stops,1);h.engine.cancel();
  h.clock(2000);const next=h.start();h.oldTimers[0]();assert.equal(next.stops,0);
  h.clock(3000);h.tick();assert.equal(next.stops,1);assert.equal(h.recording.stopReason,"duration-stop");
});
test("N3 duration checked on empty data and manual public Stop; no RAF dependency",t=>{
  const h=harness(t),r=h.start();h.clock(1000);r.data(0);
  assert.equal(h.recording.stopReason,"duration-stop");assert.equal(h.recording.chunkCount,0);
  h.engine.cancel();h.clock(2000);const next=h.start();h.clock(3000);h.engine.stop();
  assert.equal(h.recording.stopReason,"duration-stop");assert.equal(next.stops,1);
});
for(const schedule of ["data","terminal","error","stop-error"]) test(`N3 synchronous native Start schedule ${schedule}`,t=>{
  const h=harness(t);h.faults.stop=r=>{if(schedule==="stop-error")r.onerror?.({error:Error("stop error")});else r.onstop?.();};
  h.faults.start=r=>{if(schedule==="error")r.onerror?.({error:Error("start error")});
    else if(schedule==="terminal"){r.data(null,"hello");r.state="inactive";r.onstop?.();}
    else r.data(null,"0123456789");};
  const result=h.engine.start();assert.equal(result.phase,schedule.includes("error")?"error":"complete");
  assert.equal(h.recording.phase,result.phase);assert.equal(h.timers.size,0);
  assert.equal(h.recording.terminalOutcome,result.phase==="complete"?"complete":"failed");
});
test("N3 settings affect next Start; active policy and warnings remain truthful",t=>{
  const h=harness(t),r=h.start();h.policy(unrestricted());r.data(8);
  assert.equal(h.recording.sessionPolicy.profile,"custom");assert.ok(h.recording.warnings.includes("size"));r.data(2);
  assert.equal(h.recording.stopReason,"capacity-stop");h.engine.cancel();const next=h.start();next.data(1000);
  assert.equal(h.recording.sessionPolicy.profile,"unrestricted");assert.equal(next.stops,0);
});
for(const finalizing of [false,true]) test(`N3 Cancel ${finalizing?"finalizing":"recording"}: token fence, owned cleanup, export preserved`,async t=>{
  const h=harness(t),old=h.complete();const r=h.start();r.data(null,"new");const stale=r.handlers();if(finalizing)h.engine.stop();
  const result=h.engine.cancel();assert.equal(result.phase,"cancelled");assert.equal(h.recording.terminalOutcome,"cancelled");
  assert.equal(h.recording.nativeShutdown,"confirmed-stopped");assert.equal(h.calls.upstreamStop,0);assert.equal(h.engine.inspect().pending.length,0);
  assert.equal(await(await fetch(old)).text(),"old");const next=h.start();const status={...h.recording};
  stale.data({data:new Blob(["stale"])});stale.error({error:Error("stale")});stale.stop();h.oldTimers[0]();
  assert.deepEqual(h.recording,status);assert.equal(h.engine.inspect().pending.length,0,"stale data must never enter the new collection");assert.equal(next.state,"recording");
});
for(const fault of ["stopThrow","remainActive","release","render"]) test(`N3 ${fault}: truthful blocked recovery; Init powerless; export kept`,async t=>{
  const h=harness(t),old=h.complete();const r=h.start();r.data(null,"new");h.faults[fault]=true;
  const result=fault==="stopThrow"?h.engine.stop():h.engine.cancel();
  assert.equal(result.ok,false);assert.equal(h.recording.recorderEnabled,false);assert.equal(h.recording.retainedChunkCount,0);
  assert.ok(h.engine.inspect().unresolved);h.engine.init();h.engine.start();assert.equal(h.recorders.length,2);
  assert.equal(h.calls.upstreamStop,0);assert.equal(await(await fetch(old)).text(),"old");
  assert.equal(r.stops,1);assert.ok(!["recording","finalizing"].includes(h.recording.phase));
});
test("N3 missing terminal waits indefinitely until explicit Cancel, with prior download",async t=>{
  const h=harness(t),old=h.complete(),r=h.start();r.data(null,"new");h.engine.stop();h.clock(1e9);h.tick();
  assert.equal(h.recording.phase,"finalizing");assert.equal(h.timers.size,0);assert.equal(await(await fetch(old)).text(),"old");
  h.engine.cancel();assert.equal(h.recording.phase,"cancelled");assert.equal(h.recording.recorderEnabled,true);
});
test("N3 required cleanup fails before export commit: candidate revoked, P retained",async t=>{
  const h=harness(t),old=h.complete(),r=h.start();r.data(null,"new");h.engine.stop();h.faults.release=true;r.onstop?.();
  assert.equal(h.recording.lastCode,"cleanup-failed");assert.equal(h.recording.lastExportUrl,old);assert.equal(h.recording.recorderEnabled,false);
  assert.equal(h.recording.finalExportBytes,null);assert.equal(h.created.length,2);assert.equal(h.revoked[0].url,h.created[1]);
  assert.equal(await(await fetch(old)).text(),"old");assert.equal(h.calls.upstreamStop,0);
});
test("N3 identical event delivered twice is admitted once; duplicate terminal cannot replace twice",async t=>{
  const h=harness(t),r=h.start(),stale=r.handlers(),event={data:new Blob(["single"])};
  stale.data(event);stale.data(event);assert.equal(h.recording.deliveredBytes,6);assert.equal(h.recording.retainedChunkCount,1);
  h.engine.stop();stale.stop();stale.stop();assert.equal(h.created.length,1);
  assert.equal(await(await fetch(h.recording.lastExportUrl)).text(),"single");
});
test("N3 metadata projection failure restores previous fields and revokes only candidate",async t=>{
  const h=harness(t),old=h.complete(),before={url:h.recording.lastExportUrl,name:h.recording.lastExportFileName,size:h.recording.lastExportByteSize};
  const r=h.start();r.data(null,"replacement");h.engine.stop();
  let value=h.recording.lastExportFileName,once=true;
  Object.defineProperty(h.recording,"lastExportFileName",{configurable:true,get:()=>value,set(v){if(once){once=false;throw Error("projection refused");}value=v;}});
  r.onstop?.();assert.equal(h.recording.terminalOutcome,"failed");
  assert.deepEqual({url:h.recording.lastExportUrl,name:h.recording.lastExportFileName,size:h.recording.lastExportByteSize},before);
  assert.equal(await(await fetch(old)).text(),"old");assert.equal(h.revoked[0].url,h.created[1]);
});
test("N3 Dispose after unconfirmed abort destroys export but never claims resolved native ownership",t=>{
  const h=harness(t);h.complete();h.start();h.faults.remainActive=true;h.engine.cancel();
  const unresolved=h.engine.inspect().unresolved;const result=h.engine.dispose();
  assert.equal(result.ok,false);assert.equal(h.recording.lastExportUrl,null);assert.equal(h.recording.recorderEnabled,false);
  assert.equal(h.engine.inspect().unresolved,unresolved);assert.equal(h.engine.init().ok,false);
});
test("N3 acquisition cleanup failure remains blocking even before native construction",t=>{
  const h=harness(t);h.faults.audioEmpty=true;h.faults.release=true;
  assert.equal(h.engine.start().ok,false);assert.equal(h.recording.recorderEnabled,false);
  assert.equal(h.recorders.length,0);assert.ok(h.engine.inspect().unresolved.audioTap);
  h.engine.init();assert.equal(h.engine.start().ok,false);assert.equal(h.calls.upstreamStop,0);
});
