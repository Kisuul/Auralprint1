import { CONFIG } from "../core/config.js";
import { applicationPreferences } from "../core/application-preferences.js";
import { evaluateWaveformPolicy } from "./waveform-policy.js";
import { probeWaveformMetadata } from "./waveform-metadata.js";
import { createWaveformCoordinator } from "./waveform-coordinator.js";
import { extractWaveform } from "./waveform-extractor.js";

// Scrubber-owned policy bridge, not a scheduler or source owner. The coordinator
// reserves the SAME slot for a bounded probe and any admitted full extraction.
function createWaveformAdmission({ onUpdate, policy = CONFIG.waveform, preferences = applicationPreferences,
  extract = extractWaveform, probe = probeWaveformMetadata } = {}) {
  let current = null;
  const valid = intent => current === intent && intent.isCurrent();
  function input(intent) {
    const duration = intent.media?.duration;
    return { fileSizeBytes: intent.file.size, durationSeconds: duration,
      durationState: intent.metadataFailed ? "unavailable" : (intent.media?.readyState === 0 || Number.isNaN(duration) || duration == null ? "pending" : "available"),
      metadataConfidence: "unknown", headerMetadata: intent.header,
      ...preferences.runtime.settings, requestKind: intent.manual ? "manual" : "automatic" };
  }
  function evaluate(intent) { return evaluateWaveformPolicy(input(intent), policy); }
  function presentDecision(intent, decision) {
    if (!valid(intent)) return;
    intent.decision = decision;
    onUpdate(decision.decision === "defer" ? "metadata" : "unavailable", null, decision);
  }
  const coordinator = createWaveformCoordinator({
    extract,
    async prepare(file, { isCurrent }) {
      const intent = current;
      if (!intent || !isCurrent() || intent.file !== file) return false;
      // A per-intent scalar result is reused. Refresh/manual clicks never reprobe.
      if (!intent.probed) {
        const header = await probe(file, policy);
        if (!isCurrent() || !valid(intent)) return false;
        intent.header = header;
        intent.probed = true;
      }
      if (!isCurrent() || !valid(intent)) return false;
      const decision = evaluate(intent);
      intent.decision = decision;
      if (decision.decision !== "admit") { presentDecision(intent, decision); return false; }
      return true;
    },
    onUpdate(status, peaks) {
      if (status === "empty") { onUpdate(status, null, null); return; }
      if (!current || !valid(current)) return;
      if (status === "ready") current.ready = true;
      if (status === "unavailable") current.failed = true;
      onUpdate(status, peaks, status === "unavailable" ? {reason:"extraction-failed"} : current.decision);
    },
  });
  function refresh() {
    const intent = current;
    if (!intent || !valid(intent) || intent.scheduled || intent.ready || intent.failed) return Promise.resolve();
    // Size/policy gates run BEFORE any prefix/full read, including queued work.
    const decision = evaluate(intent);
    intent.decision = decision;
    if (["encoded-budget", "invalid-file-size", "invalid-policy"].includes(decision.reason)
      || (intent.probed && decision.decision !== "admit")) {
      presentDecision(intent, decision); return Promise.resolve();
    }
    intent.scheduled = true;
    return coordinator.request(intent.file, {
      isCurrent: () => valid(intent),
      canDecode() {
        if (!valid(intent)) return false;
        const latest = evaluate(intent);
        if (latest.decision !== "admit") { presentDecision(intent, latest); return false; }
        return true;
      },
    }).then(() => {
      intent.scheduled = false;
      // An event during the last await cannot be lost. No repeated probe or retry
      // on native failure: only a formerly pending duration may now admit work.
      if (valid(intent) && intent.decision?.decision === "defer"
        && evaluate(intent).decision !== "defer") return refresh();
    });
  }
  function reset() {
    if (current) {
      for (const type of ["loadedmetadata", "durationchange", "error"]) current.media?.removeEventListener?.(type, current.listener);
      current.file = current.media = null;
    }
    current = null;
    coordinator.reset();
  }
  function loadFile(file, { media, isCurrent = () => true } = {}) {
    reset();
    const intent = {file, media, isCurrent, manual:false, probed:false, scheduled:false, ready:false, failed:false, metadataFailed:false};
    current = intent;
    intent.listener = event => {
      if (!valid(intent)) return;
      if (event.type === "error") intent.metadataFailed = true;
      void refresh();
    };
    for (const type of ["loadedmetadata", "durationchange", "error"]) media?.addEventListener?.(type, intent.listener);
    preferences.initialize();
    return refresh();
  }
  function generate() {
    const intent = current;
    if (!intent || !valid(intent) || intent.scheduled || intent.ready || intent.failed) return Promise.resolve();
    // Manual means bypass the convenience profile only. Revalidate everything.
    const decision = evaluateWaveformPolicy({...input(intent), requestKind:"manual"}, policy);
    if (decision.decision !== "admit") { presentDecision(intent, decision); return Promise.resolve(); }
    intent.manual = true;
    return refresh();
  }
  const unsubscribe = preferences.subscribe(() => { void refresh(); });
  return { loadFile, reset, generate, refresh, snapshot: coordinator.snapshot,
    dispose() { reset(); unsubscribe(); } };
}

export { createWaveformAdmission };
