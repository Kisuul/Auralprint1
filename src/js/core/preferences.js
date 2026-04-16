import { CONFIG } from "./config.js";
import { deepClone } from "./utils.js";

/* =============================================================================
   Preferences + Runtime settings (derived)
   ========================================================================== */
const preferences = deepClone(CONFIG.defaults);
const runtime = { settings: deepClone(CONFIG.defaults) };

function replacePreferences(next) {
  const replacement = (next && typeof next === "object") ? next : deepClone(CONFIG.defaults);
  for (const key of Object.keys(preferences)) delete preferences[key];
  Object.assign(preferences, replacement);
  return preferences;
}

const BAND_NAMES = CONFIG.bandNames;
const BAND_NAME_TO_INDEX = new Map(BAND_NAMES.map((name, index) => [name, index]));

function resolveSettings() { runtime.settings = deepClone(preferences); }


function normalizeOrbChannelId(rawChanId, rawLegacyBandId) {
  const candidate = typeof rawChanId === "string"
    ? rawChanId
    : (typeof rawLegacyBandId === "string" ? rawLegacyBandId : "");
  const up = candidate.toUpperCase();
  return ["L", "R", "C"].includes(up) ? up : "C";
}

function sanitizeOrbBandIds(rawBandIds, rawBandNames) {
  const bandCount = BAND_NAMES.length;

  if (Array.isArray(rawBandIds)) {
    const out = [];
    const seen = new Set();
    for (const v of rawBandIds) {
      const n = Number(v);
      if (!Number.isInteger(n)) continue;
      if (n < 0 || n >= bandCount) continue;
      if (seen.has(n)) continue;
      seen.add(n);
      out.push(n);
    }
    return out;
  }

  if (Array.isArray(rawBandNames) && bandCount) {
    const out = [];
    const seen = new Set();
    for (const bandName of rawBandNames) {
      if (typeof bandName !== "string") continue;
      const idx = BAND_NAME_TO_INDEX.get(bandName);
      if (!Number.isInteger(idx) || seen.has(idx)) continue;
      seen.add(idx);
      out.push(idx);
    }
    return out;
  }

  return [];
}

function normalizeOrbDef(incomingOrb, fallbackOrb) {
  // Canonical orb fields (v6 schema): id, chanId, bandIds, chirality, startAngleRad.
  // When new fields are added (Build 115+), add them here AND in sanitizeAndApply,
  // AND bump PRESET_SCHEMA_VERSION so migration code stays honest.
  const fallback = fallbackOrb || {};
  const orb = (incomingOrb && typeof incomingOrb === "object") ? incomingOrb : {};
  const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

  const id = typeof orb.id === "string" && orb.id.trim()
    ? orb.id
    : (typeof fallback.id === "string" ? fallback.id : "ORB");

  const chiralityRaw = Number.isFinite(orb.chirality) ? orb.chirality : fallback.chirality;
  const chirality = chiralityRaw >= 0 ? 1 : -1;

  const startAngleRad = Number.isFinite(orb.startAngleRad)
    ? orb.startAngleRad
    : (Number.isFinite(fallback.startAngleRad) ? fallback.startAngleRad : 0);

  const chanId = (hasOwn(orb, "chanId") || hasOwn(orb, "bandId"))
    ? normalizeOrbChannelId(orb.chanId, orb.bandId)
    : normalizeOrbChannelId(fallback.chanId, fallback.bandId);
  const bandIds = (hasOwn(orb, "bandIds") || hasOwn(orb, "bandNames"))
    ? sanitizeOrbBandIds(orb.bandIds, orb.bandNames)
    : sanitizeOrbBandIds(fallback.bandIds, fallback.bandNames);

  return { id, chanId, bandIds, chirality, startAngleRad };
}

export { preferences, runtime, replacePreferences, BAND_NAMES, BAND_NAME_TO_INDEX, resolveSettings, normalizeOrbChannelId, sanitizeOrbBandIds, normalizeOrbDef };
