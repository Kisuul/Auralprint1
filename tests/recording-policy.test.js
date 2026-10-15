import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG } from "../src/js/core/config.js";
import { PRESET_SCHEMA_VERSION } from "../src/js/core/constants.js";
import { defaultSelection, validateSelection, resolveRecordingPolicy, prepareRecordingPolicy, createRecordingPolicySettings } from "../src/js/recording/recording-policy.js";

const choice = (custom = {}, profile = "custom") => ({ profile, custom: { ...defaultSelection().custom, ...custom } });
test("N3 policy: exact decimal Balanced factory and immutable session thresholds", () => {
  assert.deepEqual(resolveRecordingPolicy(), { profile: "balanced", softBytes: 130000000, aggregateBytes: 270000000,
    reserveBytes: 10000000, maxChunks: 1200, durationMs: 300000, warningFraction: .8 });
  const session = prepareRecordingPolicy(resolveRecordingPolicy(), 150000000);
  assert.equal(session.effectiveSoftBytes, 110000000);
  assert.ok(Object.isFrozen(session));
  for (const p of [260000000,270000000,300000000]) assert.throws(() => prepareRecordingPolicy(resolveRecordingPolicy(), p));
});
test("N3 policy: Custom independent Off values, reserve and strict safe integers", () => {
  for (const key of ["softBytes","aggregateBytes","maxChunks","durationMs"]) {
    for (const bad of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,"10",undefined]) {
      assert.equal(validateSelection(choice({[key]:bad})).ok, false, `${key}: ${bad}`);
    }
    assert.equal(validateSelection(choice({[key]:null})).ok, true);
  }
  assert.equal(validateSelection(choice({aggregateBytes:1,softBytes:null})).ok, false);
  assert.equal(validateSelection(choice({aggregateBytes:100,softBytes:91})).ok, false);
  const p=resolveRecordingPolicy(choice({aggregateBytes:100,softBytes:90}));
  assert.equal(p.reserveBytes,10);
  assert.equal(resolveRecordingPolicy(choice({aggregateBytes:null})).reserveBytes,null);
});
test("N3 policy: Unrestricted has no application S/H/R/C/T fallback; technical P remains checked", () => {
  const p=resolveRecordingPolicy(choice({},"unrestricted"));
  for (const k of ["softBytes","aggregateBytes","reserveBytes","maxChunks","durationMs"]) assert.equal(p[k],null);
  assert.equal(prepareRecordingPolicy(p,Number.MAX_SAFE_INTEGER).effectiveSoftBytes,null);
  assert.throws(()=>prepareRecordingPolicy(p,Infinity));
});
function memory() { let raw=null;return {getItem:()=>raw,setItem:(k,v)=>{raw=v;},read:()=>raw}; }
test("N3 storage: local round trip, unknown fields stripped, reset independent of Scene/schema", () => {
  const store=memory(), a=createRecordingPolicySettings({storage:()=>store});
  a.set(choice({durationMs:null},"unrestricted"));
  assert.equal(createRecordingPolicySettings({storage:()=>store}).policy().profile,"unrestricted");
  const raw=JSON.parse(store.read());
  assert.equal(raw.version,CONFIG.recordingResources.storage.version);
  assert.deepEqual(Object.keys(raw).sort(),["custom","profile","version"]);
  raw.blob="never retained";store.setItem("",JSON.stringify(raw));
  const b=createRecordingPolicySettings({storage:()=>store});b.reset();
  assert.equal(b.policy().profile,"balanced");assert.equal(PRESET_SCHEMA_VERSION,10);
});
test("N3 storage: invalid records fall back truthfully without overwriting; unavailable saving retains Unrestricted", () => {
  for (const raw of ["{",JSON.stringify({version:22}),JSON.stringify({version:1,...choice({maxChunks:0},"unrestricted")})]) {
    let writes=0;const a=createRecordingPolicySettings({storage:()=>({getItem:()=>raw,setItem:()=>writes++})});
    assert.equal(a.policy().profile,"balanced");
    assert.ok(["invalid","unavailable"].includes(a.read().persistence));assert.equal(writes,0);
  }
  const a=createRecordingPolicySettings({storage:()=>{throw Error("denied");}});
  assert.equal(a.set(choice({},"unrestricted")).persistence,"session-only");
  assert.equal(a.policy().profile,"unrestricted");
  const session=prepareRecordingPolicy(a.policy(),0);a.reset();
  assert.equal(session.profile,"unrestricted");assert.equal(a.policy().profile,"balanced");
});
test("N3 policy settings never contaminate Scene presets or URL payload", async () => {
  const { encodePresetPayload } = await import("../src/js/presets/preset-codec.js");
  const { preferences } = await import("../src/js/core/preferences.js");
  const before=JSON.stringify(encodePresetPayload(preferences));
  const settings=createRecordingPolicySettings({storage:()=>memory()});settings.set(choice({},"unrestricted"));
  assert.equal(JSON.stringify(encodePresetPayload(preferences)),before);
  const payload=encodePresetPayload({...preferences,recordingResources:settings.read().selection});
  assert.equal(payload.schema,10);assert.equal(Object.hasOwn(payload.prefs,"recordingResources"),false);
  assert.doesNotMatch(JSON.stringify(payload),/aggregateBytes|softBytes|durationMs|unrestricted/);
});
