// Optional characterization, not policy tests. No production logic changes.
// Run from any cwd: node <this-file> <fresh-report.json>
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../../../', import.meta.url));
mkdirSync(join(root, 'work'), {recursive:true});
const scratch = mkdtempSync(join(root, 'work/aud006-model-'));
const input = join(root, 'src/js/recording/recorder-engine.js');
const raw = readFileSync(input, 'utf8');
const marker = '    init,';
assert.equal(raw.split(marker).length, 2);
const observed = raw
  .replace('"../core/config.js"', JSON.stringify(pathToFileURL(join(root, 'src/js/core/config.js')).href))
  .replace('"../core/state.js"', JSON.stringify(pathToFileURL(join(root, 'src/js/core/state.js')).href))
  .replace(marker, `    inspect: () => ({pending: runtime.pendingChunks.length,
    bytes: runtime.pendingChunks.reduce((n,b)=>n+b.size,0),
    completedBytes: runtime.completedBlob?.size || 0,
    nativeHeld: !!runtime.mediaRecorder, streamsHeld: !!runtime.mergedStream,
    timerHeld: runtime.timerIntervalId !== null, token: runtime.sessionToken,
    lifecycle: runtime.lifecycle.phase}),\n${marker}`);
writeFileSync(join(scratch, 'engine.mjs'), observed);
const { RecorderEngine: engine } = await import(pathToFileURL(join(scratch, 'engine.mjs')));
const { state, createRecordingState } = await import(pathToFileURL(join(root, 'src/js/core/state.js')));
const { CONFIG } = await import(pathToFileURL(join(root, 'src/js/core/config.js')));
const keys = ['window','MediaRecorder','MediaStream','Blob','setInterval','clearInterval'];
const saved = Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
const savedAudio = {...state.audio}, savedSource = {...state.source};
const urls = {create: URL.createObjectURL, revoke: URL.revokeObjectURL};
const originalError = console.error;
const results = [], expectedLogs = [];
console.error = (...args) => expectedLogs.push(String(args[0]));
let h;
class Stream {
  constructor() { this.tracks=[]; }
  addTrack(t) { this.tracks.push(t); }
  getTracks() { return this.tracks.slice(); }
  getVideoTracks() { return this.tracks.filter(t=>t.kind==='video'); }
  getAudioTracks() { return this.tracks.filter(t=>t.kind==='audio'); }
}
// Each input uses exactly ONE physical byte; assembly stores references only.
// Reported sizes model payload accounting and cannot measure native/heap memory.
class ModeledBlob {
  constructor(parts) { this.size=parts.reduce((n,b)=>n+b.size,0); }
}
class Recorder {
  static isTypeSupported() { return true; }
  constructor(stream) { this.stream=stream; this.state='inactive'; this.stops=0; h.natives.push(this); }
  start(timeslice) {
    this.timeslice=timeslice; this.state='recording';
    if(h.fault.startEvent==='data') this.data(7);
    if(h.fault.startEvent==='stop') { this.state='inactive'; this.onstop?.(); }
    if(h.fault.startEvent==='error') this.error();
  }
  data(size) { const data=new saved.Blob([new Uint8Array(1)]); Object.defineProperty(data,'size',{value:size}); this.ondataavailable?.({data}); }
  error() { this.onerror?.({error:new Error('modeled error')}); }
  finish() { this.onstop?.(); }
  stop() {
    this.stops++;
    if(h.fault.stopThrows) throw new Error('modeled stop refusal');
    this.state='inactive';
    if(h.fault.syncStop==='complete') { this.data(3); this.finish(); }
    if(h.fault.syncStop==='error') this.error();
    if(h.fault.reenter) h.reentrant=engine.stop();
  }
}
function setup() {
  if(h) engine.dispose();
  h={natives:[], tracks:[], fault:{}, created:[], revoked:[], timers:new Map(), clock:1000, releases:0, id:0};
  globalThis.window={MediaRecorder:Recorder}; globalThis.MediaRecorder=Recorder;
  globalThis.MediaStream=Stream; globalThis.Blob=ModeledBlob;
  globalThis.setInterval=fn=>{const id=++h.id; h.timers.set(id,fn);return id;};
  globalThis.clearInterval=id=>h.timers.delete(id);
  URL.createObjectURL=b=>{ if(h.fault.url) throw new Error('modeled URL refusal'); const u=`blob:modeled-${h.created.length}`; h.created.push({url:u,bytes:b.size}); return u; };
  URL.revokeObjectURL=u=>h.revoked.push(u);
  state.audio.isLoaded=true;
  const recording=createRecordingState(); recording.includePlaybackAudio=true;
  const track={kind:'audio',stops:0,stop(){this.stops++;}};
  const audio=new Stream(); audio.addTrack(track); h.upstream=track;
  engine.init({stateRef:recording, config:CONFIG.recording, nowMs:()=>h.clock,
    getRenderTap:()=>({canvas:{captureStream(){const s=new Stream();const t={kind:'video',stops:0,stop(){this.stops++;}}; h.tracks.push(t);s.addTrack(t);return s;}}}),
    getAudioTap:()=>({ensureStream:()=>audio,releaseStream(){h.releases++; if(h.fault.release) throw new Error('modeled owner failure');}})});
  h.recording=recording; return h;
}
const snap=()=>({phase:h.recording.phase, code:h.recording.lastCode, exportUrl:h.recording.lastExportUrl, exportBytes:h.recording.lastExportByteSize,...engine.inspect()});
function start(){assert.equal(engine.start().ok,true);return h.natives.at(-1);}
function complete(n=11){const r=start();r.data(n);engine.stop();r.finish();assert.equal(h.recording.phase,'complete');return h.recording.lastExportUrl;}
function run(name,fn) { setup(); const observations=fn(); results.push({name,...observations}); }
try {
  for(const [name,sizes] of [
    ['low-steady',Array(10).fill(1000)],['high-steady',Array(10).fill(8000000)],
    ['bursty',[1,1,50000000,1,2]],['many-tiny',Array(10000).fill(1)],
    ['large-single',[2**30]],['zero-size-ignored',[0,0,13]]]) {
    run(name,()=>{const r=start();for(const n of sizes) r.data(n);const active=snap();
      assert.equal(active.pending,sizes.filter(n=>n>0).length);assert.equal(active.bytes,sizes.reduce((a,b)=>a+b,0));
      assert.equal(r.stops,0);assert.equal(r.timeslice,1000);engine.stop();r.data(17);const finalizing=snap();r.finish();
      assert.equal(h.recording.lastExportByteSize,active.bytes+17);assert.equal(engine.inspect().pending,0);
      assert.equal(h.upstream.stops,0);return {reportedInputBytes:active.bytes,physicalInputBytes:sizes.length+1,active,finalizing,settled:snap()};});
  }
  run('delayed-no-delivery',()=>{const r=start();h.clock+=600000;for(const fn of h.timers.values())fn();const before=snap();assert.equal(before.pending,0);assert.equal(before.phase,'recording');assert.equal(h.recording.elapsedMs,600000);r.data(90000000);engine.stop();r.finish();return {delayMs:600000,before,settled:snap()};});
  run('hypothetical-final-overshoot',()=>{const r=start();r.data(99);engine.stop();r.data(500);const crossing=snap();r.finish();assert.equal(h.recording.lastExportByteSize,599);return {hypotheticalBudget:100,crossing,settled:snap(),note:'No governor installed; entire final event retained.'};});
  run('replacement-and-failed-replacement',()=>{const old=complete(41);const r=start();r.data(100);const overlap=snap();assert.equal(overlap.completedBytes,41);h.fault.url=true;engine.stop();r.finish();assert.equal(h.recording.lastExportUrl,old);assert.equal(engine.inspect().pending,0);assert.deepEqual(h.revoked,[]);return {overlap,settled:snap()};});
  run('repeated-cycles',()=>{for(let i=1;i<=25;i++)complete(i);assert.equal(h.created.length,25);assert.equal(h.revoked.length,24);assert.equal(h.timers.size,0);assert.equal(h.upstream.stops,0);return {cycles:25,created:25,revoked:24,settled:snap()};});
  run('error-before-late-stop-data',()=>{const old=complete();const r=start();r.data(30);const late={data:r.ondataavailable,stop:r.onstop};r.error();const failed=snap();assert.equal(failed.pending,0);assert.equal(failed.exportUrl,old);assert.equal(r.state,'recording');const next=start();const before=JSON.stringify(snap());late.data({data:{size:99}});late.stop();assert.equal(JSON.stringify(snap()),before);next.data(4);engine.stop();next.finish();return {failed,nativeAfterError:r.state,lateCallbacksFenced:true,settled:snap()};});
  run('error-after-stop-before-terminal-data',()=>{const old=complete();const r=start();r.data(27);engine.stop();const callbacks={data:r.ondataavailable,stop:r.onstop,error:r.onerror};r.error();const failed=snap();callbacks.data({data:{size:90}});callbacks.stop();assert.equal(snap().phase,'error');assert.equal(snap().pending,0);assert.equal(snap().exportUrl,old);return {failed,afterLate:snap(),stopAttempts:r.stops};});
  run('transport-mutations-continue-capture',()=>{const r=start();r.data(5);const before=snap();for(const type of ['track-change-start','track-change-complete','track-change-failed','audio-unloaded'])engine.onTransportMutation(type);const after=snap();assert.equal(after.pending,before.pending);assert.equal(after.phase,'recording');assert.equal(r.stops,0);engine.stop();r.finish();return {before,after,settled:snap(),note:'Message seam only; public UI source selectors lock during active recording.'};});
  run('missing-terminal-event',()=>{complete();const r=start();r.data(100);engine.stop();h.clock+=3600000;const retained=snap();assert.equal(retained.phase,'finalizing');assert.equal(retained.pending,1);assert.equal(retained.nativeHeld,true);assert.equal(retained.timerHeld,false);assert.equal(engine.start().ok,false);return {modeledWaitMs:3600000,retained,stops:r.stops,note:'Clock advanced; no real waiting/native leak assertion.'};});
  run('stop-throws-active-native',()=>{const old=complete();const r=start();r.data(55);h.fault.stopThrows=true;const result=engine.stop();assert.equal(result.ok,false);assert.equal(snap().pending,0);assert.equal(snap().exportUrl,old);assert.equal(r.state,'recording');return {settled:snap(),nativeState:r.state,stopAttempts:r.stops};});
  run('reentrant-stop',()=>{const r=start();r.data(4);h.fault.reenter=true;engine.stop();assert.equal(r.stops,1);assert.equal(h.reentrant.code,'finalizing');r.finish();return {stopAttempts:r.stops,settled:snap()};});
  for(const kind of ['complete','error'])run(`synchronous-stop-${kind}`,()=>{complete();const r=start();r.data(9);h.fault.syncStop=kind;const result=engine.stop();const immediate=snap();assert.equal(immediate.phase,'finalizing');assert.equal(immediate.lifecycle,kind==='complete'?'complete':'error');assert.equal(immediate.nativeHeld,false);assert.equal(immediate.pending,0);return {result:{ok:result.ok,code:result.code},immediate,finding:'Outer stop overwrites terminal canonical status with finalizing.'};});
  for(const kind of ['data','stop','error'])run(`synchronous-start-${kind}`,()=>{h.fault.startEvent=kind;const result=engine.start();const immediate=snap();assert.equal(immediate.phase,'recording');if(kind==='data') {assert.equal(immediate.pending,1);assert.equal(h.recording.chunkCount,0);}else {assert.equal(immediate.nativeHeld,false);assert.equal(immediate.timerHeld,true);}return {result:{ok:result.ok,code:result.code},immediate,canonicalChunkCount:h.recording.chunkCount,finding:'Outer start projection overwrites synchronous event outcome/counter.'};});
  run('dispose-finalizing-and-late-callbacks',()=>{complete();const r=start();r.data(10);const old={data:r.ondataavailable,stop:r.onstop};engine.stop();engine.dispose();const disposed=snap();old.data({data:{size:200}});old.stop();assert.equal(snap().pending,0);assert.equal(snap().completedBytes,0);assert.equal(snap().phase,'disabled');assert.equal(r.stops,1);assert.equal(h.upstream.stops,0);return {disposed,lateCallbacksFenced:true};});
  run('owner-release-failure-at-success',()=>{const r=start();r.data(11);h.fault.release=true;engine.stop();r.finish();assert.equal(h.recording.phase,'complete');assert.equal(h.upstream.stops,0);return {settled:snap(),finding:'Cleanup false is logged but ignored by ordinary successful finalization.'};});
  const report={baseline:readFileSync(join(root,'version'),'utf8').trim(),kind:'modeled encoded-payload characterization; NOT native memory',cases:results,expectedLogs};
  if(process.argv[2])writeFileSync(resolve(process.argv[2]),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({cases:results.length,passed:true,report:process.argv[2]||null}));
} finally {
  engine.dispose(); console.error=originalError; Object.assign(globalThis,saved); Object.assign(state.audio,savedAudio);Object.assign(state.source,savedSource); URL.createObjectURL=urls.create;URL.revokeObjectURL=urls.revoke;
  rmSync(scratch,{recursive:true,force:true});
}
