import { CONFIG } from "../core/config.js";

const definition = CONFIG.recordingResources;
const optionalFields = Object.freeze(["softBytes", "aggregateBytes", "maxChunks", "durationMs"]);
const validInteger = n => Number.isSafeInteger(n) && n >= definition.integer.min && n <= definition.integer.max;

const DECIMAL_BYTES_PER_MB = 1_000_000;
const MILLISECONDS_PER_MINUTE = 60_000;
const RECORDING_RESOURCE_INPUTS = Object.freeze({
  softBytes: Object.freeze({ label: "Soft recording size", unit: "MB", scale: DECIMAL_BYTES_PER_MB, canonicalUnit: "bytes" }),
  aggregateBytes: Object.freeze({ label: "Aggregate retained recording size", unit: "MB", scale: DECIMAL_BYTES_PER_MB, canonicalUnit: "bytes" }),
  maxChunks: Object.freeze({ label: "Maximum retained chunks", unit: "chunks", scale: 1, canonicalUnit: "chunks" }),
  durationMs: Object.freeze({ label: "Recording duration", unit: "minutes", scale: MILLISECONDS_PER_MINUTE, canonicalUnit: "milliseconds" }),
});

// Exact decimal/rational entry stays textual until whole canonical units and the
// CONFIG safe-integer domain are proven. No floating-point scaling or rounding.
function parseResourceInput(key, text) {
  const spec = RECORDING_RESOURCE_INPUTS[key];
  if (!spec || typeof text !== "string") return null;
  const raw = text.trim();
  let numerator, denominator;
  const fraction = key === "durationMs" && raw.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    numerator = BigInt(fraction[1]); denominator = BigInt(fraction[2]);
  } else {
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) return null;
    const [whole, fractional = ""] = raw.split(".");
    numerator = BigInt((whole || "0") + fractional);
    denominator = 10n ** BigInt(fractional.length);
  }
  if (denominator === 0n) return null;
  const scaled = numerator * BigInt(spec.scale);
  if (scaled % denominator !== 0n) return null;
  const canonical = scaled / denominator;
  if (canonical < BigInt(definition.integer.min) || canonical > BigInt(definition.integer.max)) return null;
  return Number(canonical);
}

function formatResourceInput(key, value) {
  if (value === null) return "";
  if (!RECORDING_RESOURCE_INPUTS[key] || !validInteger(value)) throw new TypeError("Invalid canonical recording resource value.");
  let numerator = BigInt(value), denominator = BigInt(RECORDING_RESOURCE_INPUTS[key].scale);
  let a = numerator, b = denominator;
  while (b) [a, b] = [b, a % b];
  numerator /= a; denominator /= a;
  let finite = denominator;
  for (const factor of [2n, 5n]) while (finite % factor === 0n) finite /= factor;
  // A canonical millisecond not divisible by three has repeating decimal minutes.
  // Show its reduced fraction exactly instead of silently approximating it.
  if (finite !== 1n) return `${numerator}/${denominator}`;
  let result = String(numerator / denominator), remainder = numerator % denominator;
  if (remainder) result += ".";
  while (remainder) {
    remainder *= 10n; result += String(remainder / denominator); remainder %= denominator;
  }
  return result;
}

function selectionFromResourceInputs(value) {
  const custom = {}, errors = {};
  for (const key of optionalFields) {
    const input = value?.custom?.[key], spec = RECORDING_RESOURCE_INPUTS[key];
    const parsed = input === null ? null : parseResourceInput(key, input);
    if (input !== null && parsed === null) errors[key] = `Enter a positive value in ${spec.unit} that resolves to whole ${spec.canonicalUnit} within the safe integer range.`;
    custom[key] = parsed;
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return validateSelection({ profile: value?.profile, custom: { ...custom, warningFraction: value?.custom?.warningFraction } });
}

function factoryCustom() {
  const { reserveBytes, ...values } = definition.factory;
  void reserveBytes;
  return Object.freeze(values);
}

// R is inactive without H; otherwise min(factory R, floor(H / 10)), at least
// one byte. H=1 is rejected because it cannot hold both reserve and payload.
function deriveReserve(aggregateBytes) {
  return aggregateBytes === null ? null
    : Math.max(definition.integer.min, Math.min(definition.factory.reserveBytes,
      Math.floor(aggregateBytes / definition.reserveDivisor)));
}

function validateSelection(value) {
  const errors = {};
  if (!value || !definition.profiles.includes(value.profile)) errors.profile = "Choose Balanced, Custom or Unrestricted.";
  const custom = {};
  for (const key of optionalFields) {
    const n = value?.custom?.[key];
    if (n !== null && !validInteger(n)) errors[key] = "Use Off or a positive safe integer in the labelled units.";
    custom[key] = n;
  }
  const warning = value?.custom?.warningFraction;
  if (warning !== null && warning !== definition.factory.warningFraction) errors.warningFraction = "Choose Off or the configured warning fraction.";
  custom.warningFraction = warning;
  const reserve = validInteger(custom.aggregateBytes) ? deriveReserve(custom.aggregateBytes) : null;
  if (reserve !== null && custom.aggregateBytes <= reserve) errors.aggregateBytes = "Aggregate limit must leave room after final-delivery headroom.";
  if (reserve !== null && validInteger(custom.softBytes) && custom.softBytes > custom.aggregateBytes - reserve) {
    errors.softBytes = "Soft Stop must fit within aggregate limit minus derived headroom.";
  }
  return Object.keys(errors).length ? { ok: false, errors }
    : { ok: true, errors, selection: Object.freeze({ profile: value.profile, custom: Object.freeze(custom) }) };
}

function defaultSelection() {
  return Object.freeze({ profile: definition.defaultProfile, custom: factoryCustom() });
}

function resolveRecordingPolicy(selection = defaultSelection()) {
  const result = validateSelection(selection);
  if (!result.ok) throw new TypeError(Object.values(result.errors).join(" "));
  const { profile, custom } = result.selection;
  if (profile === "balanced") return Object.freeze({ profile, ...definition.factory });
  if (profile === "unrestricted") return Object.freeze({ profile, softBytes: null, aggregateBytes: null,
    reserveBytes: null, maxChunks: null, durationMs: null, warningFraction: null });
  return Object.freeze({ profile, ...custom, reserveBytes: deriveReserve(custom.aggregateBytes) });
}

// Immutable session threshold includes P. Refusal never disposes the previous export.
function prepareRecordingPolicy(policy, previousExportBytes) {
  if (!Number.isSafeInteger(previousExportBytes) || previousExportBytes < 0) throw new TypeError("Invalid previous export size.");
  const { aggregateBytes: h, reserveBytes: r, softBytes: s } = policy;
  if (h !== null && (previousExportBytes >= h || h - previousExportBytes <= r)) {
    throw new RangeError("Previous export leaves insufficient final-delivery headroom. Download remains available; choose a larger limit or Unrestricted.");
  }
  return Object.freeze({ ...policy, previousExportBytes,
    effectiveSoftBytes: s === null ? null : h === null ? s : Math.min(s, h - previousExportBytes - r) });
}

function createRecordingPolicySettings({ storage = () => globalThis.localStorage } = {}) {
  let selection = defaultSelection(), initialized = false, persistence = "not-loaded", message = "";
  const listeners = new Set();
  const snapshot = () => Object.freeze({ selection, persistence, message });
  function initialize() {
    if (initialized) return snapshot();
    initialized = true;
    try {
      const backend = storage();
      if (!backend) throw new Error("Local storage unavailable");
      const raw = backend.getItem(definition.storage.key);
      if (raw !== null) {
        const stored = JSON.parse(raw);
        const result = validateSelection(stored);
        if (stored.version !== definition.storage.version || !result.ok) {
          persistence = "invalid";
          message = "Stored Recording Resources are invalid or from an unsupported version. Factory defaults are active for this session; choose settings to save a replacement.";
          return snapshot();
        }
        selection = result.selection;
      }
      persistence = "loaded";
      message = "Recording Resources loaded locally. Changes apply to the next Start.";
    } catch {
      persistence = "unavailable";
      message = "Recording Resources could not be loaded. Factory defaults are active for this session; saving may be unavailable.";
    }
    return snapshot();
  }
  function set(value) {
    initialize();
    const result = validateSelection(value);
    if (!result.ok) return result;
    selection = result.selection;
    try {
      const backend = storage();
      if (!backend) throw new Error("Local storage unavailable");
      backend.setItem(definition.storage.key, JSON.stringify({ version: definition.storage.version, ...selection }));
      persistence = "saved";
      message = "Saved locally for the next Start. Active captures keep their current policy.";
    } catch {
      persistence = "session-only";
      message = "Applied for this session only; local saving failed. This selection, including Unrestricted, remains active for the next Start on this page.";
    }
    for (const listener of listeners) listener(snapshot());
    return { ok: true, ...snapshot() };
  }
  return { initialize, read: () => { initialize(); return snapshot(); }, set,
    setFromInputs(value) {
      const result = selectionFromResourceInputs(value);
      return result.ok ? set(result.selection) : result;
    },
    reset: () => set(defaultSelection()),
    policy: () => { initialize(); return resolveRecordingPolicy(selection); },
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); } };
}
const recordingPolicySettings = createRecordingPolicySettings();
export { DECIMAL_BYTES_PER_MB, MILLISECONDS_PER_MINUTE, RECORDING_RESOURCE_INPUTS,
  parseResourceInput, formatResourceInput, selectionFromResourceInputs, optionalFields, defaultSelection, validateSelection, deriveReserve, resolveRecordingPolicy,
  prepareRecordingPolicy, createRecordingPolicySettings, recordingPolicySettings };
