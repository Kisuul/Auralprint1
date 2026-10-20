import { CONFIG } from "../core/config.js";
import { applicationPreferences } from "../core/application-preferences.js";

const reasons = {
  "encoded-budget": "Waveform unavailable: encoded file exceeds the configured resource limit.",
  "pcm-budget": "Waveform unavailable: estimated PCM exceeds the configured resource limit.",
  "metadata-unavailable": "Waveform unavailable: usable audio metadata could not be established.",
  "invalid-file-size": "Waveform unavailable: file size is invalid.",
  "invalid-policy": "Waveform unavailable: source waveform configuration is invalid.",
  "invalid-request": "Waveform unavailable: waveform selection is invalid.",
  "extraction-failed": "Waveform unavailable: optional reading or decoding failed.",
};
function waveformStatusText(status, detail) {
  if (status === "empty") return "Load a File to generate its waveform.";
  if (status === "waiting") return "Waiting for the previous waveform operation to settle. Playback is available.";
  if (status === "metadata") return "Waiting for audio metadata. Playback is available.";
  if (status === "decoding") return "Generating waveform. Playback is available.";
  if (status === "ready") return detail?.metadata?.confidence === "estimated"
    ? "Waveform ready. Admission used estimated channel metadata." : "Waveform ready.";
  if (detail?.manualEligible) return detail.decision === "offer"
    ? "Above the automatic workload profile. Generate a waveform for this track?"
    : "Automatic generation skipped above the workload profile. You can generate this track manually.";
  return reasons[detail?.reason] ?? "Waveform unavailable.";
}

// Focused presentation owner; called only on state transitions, never per frame.
function createWaveformControls({ document: doc = globalThis.document, policy = CONFIG.waveform,
  preferences = applicationPreferences, generate } = {}) {
  const profile = doc.getElementById("selWaveformProfile");
  const behavior = doc.getElementById("selWaveformBehavior");
  const action = doc.getElementById("btnGenerateWaveform");
  const panelAction = doc.getElementById("btnGenerateWaveformOptions");
  const statusEl = doc.getElementById("waveformStatus");
  const announcement = doc.getElementById("waveformAnnouncement");
  const launcher = doc.getElementById("btnWaveformOptions");
  const panel = doc.getElementById("waveformOptions");
  const close = doc.getElementById("btnCloseWaveformOptions");
  if (!profile || !behavior || !action || !panelAction || !statusEl || !launcher || !panel || !close) return {update(){},dispose(){}};
  const cleanups=[];
  function listen(target, type, callback) { target.addEventListener(type,callback); cleanups.push(()=>target.removeEventListener(type,callback)); }
  function options(control, choices) {
    control.replaceChildren(...choices.map(choice => {
      const option=doc.createElement("option"); option.value=choice.id; option.textContent=choice.label; return option;
    }));
  }
  options(profile, policy.automaticProfiles.map(p=>({id:p.id,label:`Approx. ${p.approximateMinutes} minutes`})));
  options(behavior, policy.aboveProfileBehaviors);
  function synchronize() {
    const settings=preferences.initialize();
    if(profile.value!==settings.selectedProfileId)profile.value=settings.selectedProfileId;
    if(behavior.value!==settings.aboveProfileBehavior)behavior.value=settings.aboveProfileBehavior;
  }
  synchronize(); cleanups.push(preferences.subscribe(synchronize));
  listen(profile,"change",()=>preferences.set({selectedProfileId:profile.value}));
  listen(behavior,"change",()=>preferences.set({aboveProfileBehavior:behavior.value}));
  for(const button of [action,panelAction])listen(button,"click",()=>{void generate();});
  // Native auto popover supplies outside-click/Escape dismissal and focus return.
  // Fallback remains a small non-modal surface with the same keyboard controls.
  const native=typeof panel.showPopover==="function";
  if(!native) {
    panel.hidden=true;
    listen(launcher,"click",()=>{panel.hidden=!panel.hidden;launcher.setAttribute("aria-expanded",String(!panel.hidden));if(!panel.hidden)profile.focus();});
    listen(panel,"keydown",e=>{if(e.key==="Escape"){panel.hidden=true;launcher.setAttribute("aria-expanded","false");launcher.focus();}});
  } else listen(panel,"toggle",e=>launcher.setAttribute("aria-expanded",String(e.newState==="open")));
  listen(close,"click",()=>{if(native)panel.hidePopover();else {panel.hidden=true;launcher.setAttribute("aria-expanded","false");}launcher.focus();});
  function update(status, detail) {
    const text=waveformStatusText(status,detail);
    if(statusEl.textContent!==text)statusEl.textContent=text;
    if(announcement && announcement.textContent!==text)announcement.textContent=text;
    const eligible=!!detail?.manualEligible && status==="unavailable";
    if(action.hidden===eligible) {
      if(!eligible && doc.activeElement===action)launcher.focus();
      action.hidden=!eligible;
    }
    if(panelAction.hidden===eligible) {
      if(!eligible && doc.activeElement===panelAction)profile.focus();
      panelAction.hidden=!eligible;
    }
    // The visible action disappears synchronously on waiting/generation/change.
    // The status supplies the reason and announces actual optional-work state.
    if(launcher.title!==text)launcher.title=text;
  }
  return {update,dispose(){for(const cleanup of cleanups)cleanup();}};
}
export { createWaveformControls, waveformStatusText };
