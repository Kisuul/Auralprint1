import test from "node:test";
import assert from "node:assert/strict";
import { createRecordingResourcesControls, recordingResourcePresentation } from "../src/js/ui/recording-resources.js";
import { createRecordingPolicySettings, prepareRecordingPolicy, resolveRecordingPolicy } from "../src/js/recording/recording-policy.js";
import { createRecordingState } from "../src/js/core/state.js";

function harness({ selection, unavailable = false } = {}) {
  const nodes=new Map();let writes=0;
  class Element {
    constructor(){this.listeners={};this.attributes={};for(const key of ["value","textContent","hidden","checked","disabled","min","max"]){let value=key==="hidden"||key==="checked"||key==="disabled"?false:"";Object.defineProperty(this,key,{get:()=>value,set:v=>{value=v;writes++;}});}}
    addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
    setAttribute(key,v){if(this.attributes[key]!==v){this.attributes[key]=v;writes++;}}
    getAttribute(key){return this.attributes[key];}
    fire(type){this.listeners[type]?.forEach(fn=>fn());}
  }
  const doc={getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);}};
  let raw=selection ? JSON.stringify({version:1,...selection}) : null;
  const backend={getItem:()=>raw,setItem:(k,v)=>{if(unavailable)throw Error("storage denied");raw=v;}};
  const settings=createRecordingPolicySettings({storage:()=>backend});
  const controller=createRecordingResourcesControls({document:doc,settings});
  return {doc,settings,controller,node:id=>doc.getElementById(id),writes:()=>writes,backend};
}
test("N3 UI profile/reset owns separate settings, custom Off validation and truthful storage",()=>{
  const h=harness();assert.match(h.node("recordingPolicySummary").textContent,/5 minutes.*130,000,000 bytes/);
  const selector=h.node("selRecordingProfile");selector.value="custom";selector.fire("change");
  assert.equal(h.node("recordingCustom").hidden,false);
  h.node("recording-softBytes").value="0";h.node("btnApplyRecordingResources").fire("click");
  assert.equal(h.node("recording-softBytes").getAttribute("aria-invalid"),"true");
  assert.equal(h.settings.read().selection.custom.softBytes,130000000);
  h.node("recording-softBytes-enabled").checked=false;h.node("recording-softBytes-enabled").fire("change");
  h.node("btnApplyRecordingResources").fire("click");assert.equal(h.settings.read().selection.custom.softBytes,null);
  assert.match(h.node("recordingPolicySummary").textContent,/may fail at hard aggregate admission/);
  selector.value="unrestricted";selector.fire("change");assert.match(h.node("recordingPolicySummary").textContent,/crash may lose.*unsaved/);
  h.node("btnResetRecordingResources").fire("click");assert.equal(h.settings.policy().profile,"balanced");
});
test("N3 UI editing next policy never rewrites frozen capture; no duplicate listeners or idle writes",()=>{
  const h=harness(),r=createRecordingState();r.phase="recording";r.sessionPolicy=prepareRecordingPolicy(h.settings.policy(),0);
  assert.equal(createRecordingResourcesControls({document:h.doc,settings:h.settings}),h.controller);
  assert.equal(h.node("selRecordingProfile").listeners.change.length,1);
  h.node("selRecordingProfile").value="unrestricted";h.node("selRecordingProfile").fire("change");
  h.controller.refresh(r);assert.match(h.node("recordingPolicyNext").textContent,/Next Start: unrestricted.*frozen balanced/);
  assert.match(h.node("recordingProgress").textContent,/Active profile: balanced/);
  const before=h.writes();for(let i=0;i<100;i++)h.controller.refresh(r);assert.equal(h.writes(),before);
  h.node("selRecordingProfile").value="custom";h.node("selRecordingProfile").fire("change");
  h.node("recording-durationMs").value="123";h.controller.refresh(r);assert.equal(h.node("recording-durationMs").value,"123","telemetry preserves draft and focus");
});
test("N3 UI exact progress, warnings, reason and completion telemetry",()=>{
  const r={...createRecordingState(),sessionPolicy:prepareRecordingPolicy(resolveRecordingPolicy(),100),phase:"finalizing",elapsedMs:300100,
    deliveredBytes:130000001,admittedBytes:130000001,retainedChunkCount:294,previousExportBytes:100,stopReason:"duration-stop",warnings:["duration"],lastExportUrl:"prior"};
  const p=recordingResourcePresentation(r);assert.match(p.progress,/130,000,001 bytes/);assert.match(p.progress,/duration-stop/);
  assert.match(p.progress,/export available to download/);assert.match(p.warning,/duration/);
  r.phase="complete";r.finalExportBytes=131000000;r.retainedChunkCount=0;
  const done=recordingResourcePresentation(r);assert.match(done.progress,/Last capture.*Final output: 131,000,000 bytes/);assert.equal(done.warning,"");
});

test("N3F Custom shows MB/minutes, while a duration-only edit preserves independent size/chunk limits",()=>{
  const h=harness();h.node("selRecordingProfile").value="custom";h.node("selRecordingProfile").fire("change");
  assert.equal(h.node("recording-softBytes").value,"130");assert.equal(h.node("recording-aggregateBytes").value,"270");
  assert.equal(h.node("recording-durationMs").value,"5");assert.equal(h.node("recording-maxChunks").value,"1200");
  h.node("recording-durationMs").value="120";h.node("btnApplyRecordingResources").fire("click");
  assert.deepEqual(h.settings.read().selection.custom,{softBytes:130000000,aggregateBytes:270000000,durationMs:7200000,maxChunks:1200,warningFraction:.8});
  assert.match(h.node("recordingPolicySummary").textContent,/operate independently.*two-hour/);
  assert.match(h.node("recordingUnitsNote").textContent,/1 MB = 1,000,000 bytes.*1 minute = 60,000 milliseconds/);
});
test("N3F one-field edit and reload preserve arbitrary canonical settings, including repeating minutes",()=>{
  const selection={profile:"custom",custom:{softBytes:130000001,aggregateBytes:270000007,durationMs:300001,maxChunks:1199,warningFraction:.8}};
  const h=harness({selection});
  assert.equal(h.node("recording-softBytes").value,"130.000001");assert.equal(h.node("recording-durationMs").value,"300001/60000");
  assert.match(h.node("recording-durationMs-exact").textContent,/300,001 milliseconds/);
  h.node("recording-maxChunks").value="1201";h.node("btnApplyRecordingResources").fire("click");
  const expected={...selection,custom:{...selection.custom,maxChunks:1201}};
  assert.deepEqual(h.settings.read().selection,expected);
  const reload=createRecordingPolicySettings({storage:()=>h.backend});assert.deepEqual(reload.read().selection,expected);
  for(const profile of ["balanced","unrestricted","custom"]) {h.node("selRecordingProfile").value=profile;h.node("selRecordingProfile").fire("change");}
  assert.deepEqual(h.settings.read().selection,expected);assert.equal(h.node("recording-durationMs").value,"300001/60000");
});
test("N3F inline conversion errors retain prior settings and draft; decimal MB accepts single bytes",()=>{
  const h=harness();h.node("selRecordingProfile").value="custom";h.node("selRecordingProfile").fire("change");
  for(const raw of ["0.0000001","9007199254.740992","1e3"]) {
    h.node("recording-softBytes").value=raw;h.node("btnApplyRecordingResources").fire("click");
    assert.equal(h.node("recording-softBytes").getAttribute("aria-invalid"),"true");assert.equal(h.node("recording-softBytes").value,raw);
    assert.equal(h.settings.read().selection.custom.softBytes,130000000);assert.match(h.node("recordingPolicyError").textContent,/whole bytes/);
  }
  h.node("recording-softBytes").value="130.000001";h.node("btnApplyRecordingResources").fire("click");
  assert.equal(h.settings.read().selection.custom.softBytes,130000001);
});
test("N3F duration Off persists independently; failed writes keep valid human-unit selections active",()=>{
  const h=harness({unavailable:true});h.node("selRecordingProfile").value="custom";h.node("selRecordingProfile").fire("change");
  h.node("recording-durationMs-enabled").checked=false;h.node("recording-durationMs-enabled").fire("change");h.node("btnApplyRecordingResources").fire("click");
  const p=h.settings.policy();assert.equal(p.durationMs,null);assert.equal(p.softBytes,130000000);assert.equal(p.maxChunks,1200);
  assert.match(h.node("recordingPolicyStorage").textContent,/session only.*saving failed/);
  h.node("selRecordingProfile").value="unrestricted";h.node("selRecordingProfile").fire("change");
  for(const key of ["softBytes","aggregateBytes","reserveBytes","durationMs","maxChunks"])assert.equal(h.settings.policy()[key],null);
  assert.equal(h.settings.read().selection.profile,"unrestricted");
});
test("N3F human-unit edits remain next-Start changes during a frozen current capture",()=>{
  const h=harness(),r=createRecordingState();r.phase="recording";r.sessionPolicy=prepareRecordingPolicy(h.settings.policy(),0);h.controller.refresh(r);
  h.node("selRecordingProfile").value="custom";h.node("selRecordingProfile").fire("change");
  h.node("recording-durationMs").value="120";h.node("btnApplyRecordingResources").fire("click");
  assert.equal(h.settings.policy().durationMs,7200000);assert.equal(r.sessionPolicy.durationMs,300000);
  assert.match(h.node("recordingPolicyNext").textContent,/Next Start: custom.*frozen balanced/);
});
