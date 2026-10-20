import { CONFIG } from "../core/config.js";
import { defaultSelection, deriveReserve, recordingPolicySettings, RECORDING_RESOURCE_INPUTS, formatResourceInput, MILLISECONDS_PER_MINUTE, DECIMAL_BYTES_PER_MB } from "../recording/recording-policy.js";

const bytes = value => `${value.toLocaleString("en-US")} bytes`;
const megabytes = value => `${formatResourceInput("softBytes", value)} MB (${bytes(value)})`;
const limit = (value, unit) => value === null ? "Off" : unit === "bytes" ? bytes(value) : `${value.toLocaleString("en-US")} ${unit}`;
function recordingResourcePresentation(recording) {
  const p = recording.sessionPolicy;
  if (!p) return { progress: "No current capture. Policy is selected under Recording Resources.", warning: "" };
  const active = ["starting", "recording", "finalizing"].includes(recording.phase);
  const elapsed = Math.floor((recording.elapsedMs || 0) / 1000);
  const ratio = (value, threshold) => threshold === null ? "Off" : `${Math.floor(value / threshold * 100)}% of ${bytes(threshold)}`;
  const progress = `${active ? "Active" : "Last capture"} profile: ${p.profile}. Elapsed ${elapsed}s. `
    + `Delivered ${bytes(recording.deliveredBytes || 0)}; admitted ${bytes(recording.admittedBytes || 0)}. `
    + `Soft Stop: ${ratio(recording.admittedBytes || 0, p.effectiveSoftBytes)}. `
    + `Aggregate: ${p.aggregateBytes === null ? "Off" : ratio((recording.previousExportBytes || 0) + (recording.admittedBytes || 0), p.aggregateBytes)}. `
    + `Retained chunks: ${recording.retainedChunkCount || 0} / ${limit(p.maxChunks, "chunks")}. `
    + `Duration target: ${limit(p.durationMs, "ms")}. `
    + `Previous export at Start: ${bytes(recording.previousExportBytes || 0)}. `
    + `${recording.lastExportUrl ? "Latest successful export available to download." : "No successful export available."}`
    + (recording.rejectedEvents ? ` Rejected: ${recording.rejectedEvents} events, ${bytes(recording.rejectedBytes)}.` : "")
    + (recording.stopReason ? ` Stop reason: ${recording.stopReason}.` : "")
    + (recording.finalExportBytes !== null ? ` Final output: ${bytes(recording.finalExportBytes)}.` : "");
  return { progress, warning: active && recording.warnings?.length
    ? `Configured warning level reached: ${recording.warnings.join(", ")}. Native buffering and device limits still apply.` : "" };
}

const owners = new WeakMap();
function createRecordingResourcesControls({ document: doc = globalThis.document, settings = recordingPolicySettings } = {}) {
  const root = doc?.getElementById("recordingResources");
  if (!root) return { refresh() {} };
  if (owners.has(root)) return owners.get(root);
  const get = id => doc.getElementById(id);
  const profile = get("selRecordingProfile"), custom = get("recordingCustom"), summary = get("recordingPolicySummary");
  const error = get("recordingPolicyError"), storage = get("recordingPolicyStorage"), next = get("recordingPolicyNext");
  let lastRecording = null;
  const fields = ["softBytes", "aggregateBytes", "maxChunks", "durationMs"];
  const sync = (node,key,value) => { if(node && node[key] !== value) node[key] = value; };
  function refreshNext() {
    const recording = lastRecording;
    const active=recording && ["starting","recording","finalizing"].includes(recording.phase);
    sync(next,"textContent",active ? `Next Start: ${settings.read().selection.profile}. Current capture keeps frozen ${recording.sessionPolicy?.profile || "pending"} policy.` : `Next Start: ${settings.read().selection.profile}.`);
  }
  function summarize() {
    const { selection, message } = settings.read(), p = selection.profile, f = CONFIG.recordingResources.factory;
    sync(custom,"hidden",p !== "custom");
    const reserve = deriveReserve(selection.custom.aggregateBytes);
    sync(summary,"textContent", p === "balanced"
      ? `Automatic Stop target: ${f.durationMs / MILLISECONDS_PER_MINUTE} minutes (${limit(f.durationMs,"ms")}). Soft Stop ${megabytes(f.softBytes)}; aggregate ${megabytes(f.aggregateBytes)}; intended headroom ${megabytes(f.reserveBytes)}; ${f.maxChunks.toLocaleString("en-US")} chunks. Warnings at ${f.warningFraction * 100}%.`
      : p === "unrestricted"
        ? "Application size, chunk and automatic duration limits are Off. Browser and device limits still apply. A crash may lose the current unsaved capture. The latest successful export stays available until valid replacement or explicit disposal."
        : `Derived final-delivery headroom: ${reserve === null ? "Off" : megabytes(reserve)}. Headroom cannot guarantee that native final data fits. `
          + (selection.custom.softBytes === null && selection.custom.aggregateBytes !== null
            ? "Soft Stop is Off: recording may fail at hard aggregate admission instead of completing early. " : "")
          + "Size, duration and chunk limits operate independently: a two-hour duration still stops at an enabled size threshold and can fail hard admission at an aggregate or chunk limit. Turning duration Off leaves other limits active. Custom edits take effect after Apply, on the next Start.");
    sync(get("recordingUnitsNote"),"textContent",`1 MB = ${DECIMAL_BYTES_PER_MB.toLocaleString("en-US")} bytes; 1 minute = ${MILLISECONDS_PER_MINUTE.toLocaleString("en-US")} milliseconds. Decimal entries must resolve to whole bytes or milliseconds. Exact durations may display as fractions of a minute: 1/${MILLISECONDS_PER_MINUTE} means 1 millisecond. Fractions remain exact when saved or reloaded.`);
    sync(storage,"textContent",message);
    refreshNext();
    sync(get("recordingWarningsLabel"),"textContent",`Nonblocking warnings at ${f.warningFraction * 100}% of applicable limits`);
  }
  function synchronize() {
    const { selection } = settings.read();
    sync(profile,"value",selection.profile);
    for (const key of fields) {
      const value = selection.custom[key], toggle = get(`recording-${key}-enabled`), input = get(`recording-${key}`);
      sync(toggle,"checked",value !== null);
      sync(input,"disabled",value === null);
      sync(input,"value",formatResourceInput(key, value));
      const spec = RECORDING_RESOURCE_INPUTS[key];
      if (key !== "durationMs") {
        input.min = formatResourceInput(key, CONFIG.recordingResources.integer.min);
        input.max = formatResourceInput(key, CONFIG.recordingResources.integer.max);
      }
      sync(get(`recording-${key}-exact`),"textContent",value === null ? "Off" : `Exact setting: ${value.toLocaleString("en-US")} ${spec.canonicalUnit}.`);
      input.setAttribute("aria-invalid","false");
    }
    sync(get("recording-warnings"),"checked",selection.custom.warningFraction !== null);
    sync(error,"textContent","");summarize();
  }
  settings.initialize();synchronize();
  settings.subscribe(synchronize);
  profile.addEventListener("change",()=>settings.set({ ...settings.read().selection, profile:profile.value }));
  for(const key of fields) get(`recording-${key}-enabled`).addEventListener("change",()=>{
    const enabled=get(`recording-${key}-enabled`).checked,input=get(`recording-${key}`);
    sync(input,"disabled",!enabled);
    if(enabled && !input.value) input.value=formatResourceInput(key, defaultSelection().custom[key]);
  });
  get("btnApplyRecordingResources").addEventListener("click",()=>{
    const custom = {};
    for(const key of fields) {
      const raw=get(`recording-${key}`).value;
      custom[key]=get(`recording-${key}-enabled`).checked ? raw : null;
    }
    custom.warningFraction=get("recording-warnings").checked ? CONFIG.recordingResources.factory.warningFraction : null;
    const result=settings.setFromInputs({profile:profile.value,custom});
    if(!result.ok) {
      sync(error,"textContent",Object.entries(result.errors).map(([key,text])=>`${RECORDING_RESOURCE_INPUTS[key]?.label || key}: ${text}`).join(" "));
      for(const key of fields) get(`recording-${key}`).setAttribute("aria-invalid",String(!!result.errors[key]));
    }
  });
  get("btnResetRecordingResources").addEventListener("click",()=>settings.reset());
  const controller = { refresh(recording) {
    lastRecording=recording;
    const { progress, warning }=recordingResourcePresentation(recording);
    sync(get("recordingProgress"),"textContent",progress);
    sync(get("recordingWarnings"),"textContent",warning);
    refreshNext();
  } };
  owners.set(root,controller);return controller;
}
export { createRecordingResourcesControls, recordingResourcePresentation };
