import { CONFIG } from "./config.js";
import { resolveWaveformProfile } from "../audio/waveform-policy.js";

// Separate from scene preferences and URL presets. Version 1 stores only these
// two selections. Unknown versions/obsolete values use current CONFIG defaults.
const WAVEFORM_PREFERENCES_KEY = "auralprint.waveform-preferences";
const WAVEFORM_PREFERENCES_VERSION = 1;

function createApplicationPreferences({ policy = CONFIG.waveform, storage = () => globalThis.localStorage } = {}) {
  const listeners = new Set();
  const normalize = value => Object.freeze({
    selectedProfileId: resolveWaveformProfile(policy, value?.selectedProfileId)?.id ?? policy.defaultProfileId,
    aboveProfileBehavior: policy.aboveProfileBehaviors.some(p => p.id === value?.aboveProfileBehavior)
      ? value.aboveProfileBehavior : policy.defaultAboveProfileBehavior,
  });
  // The application runtime is independent of runtime.settings (scene-owned).
  const runtime = { settings: normalize(null) };
  let initialized = false;
  function initialize() {
    if (initialized) return runtime.settings;
    initialized = true;
    try {
      const stored = JSON.parse(storage()?.getItem(WAVEFORM_PREFERENCES_KEY) ?? "null");
      runtime.settings = normalize(stored?.version === WAVEFORM_PREFERENCES_VERSION ? stored : null);
    } catch { /* Denied/corrupt storage leaves CONFIG defaults usable in session. */ }
    return runtime.settings;
  }
  function set(selection) {
    initialize();
    const next = normalize({ ...runtime.settings, ...selection });
    if (next.selectedProfileId === runtime.settings.selectedProfileId
      && next.aboveProfileBehavior === runtime.settings.aboveProfileBehavior) return runtime.settings;
    runtime.settings = next;
    try {
      storage()?.setItem(WAVEFORM_PREFERENCES_KEY, JSON.stringify({ version: WAVEFORM_PREFERENCES_VERSION, ...next }));
    } catch { /* In-session settings remain effective when persistence fails. */ }
    for (const listener of listeners) listener(next);
    return next;
  }
  return { runtime, initialize, set, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
}

const applicationPreferences = createApplicationPreferences();
export { applicationPreferences, createApplicationPreferences, WAVEFORM_PREFERENCES_KEY, WAVEFORM_PREFERENCES_VERSION };
