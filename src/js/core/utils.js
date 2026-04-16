/* ------------------------------ Utilities -------------------------------- */
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function fmt(n, d) { return Number(n).toFixed(d); }

function deepFreeze(obj) {
  Object.freeze(obj);
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v && typeof v === "object" && !Object.isFrozen(v)) deepFreeze(v);
  }
  return obj;
}

function deepClone(obj) {
  if (typeof structuredClone === "function") return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

function isValidHexColor(s) {
  return typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s);
}

function hexToRgb01(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

function rgb01ToCss({r,g,b}, alpha = 1) {
  const R = Math.round(clamp(r,0,1) * 255);
  const G = Math.round(clamp(g,0,1) * 255);
  const B = Math.round(clamp(b,0,1) * 255);
  return `rgba(${R},${G},${B},${clamp(alpha,0,1)})`;
}

function lerpRgb01(a, b, t) {
  return { r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) };
}

function dot(a, b, stride = 1) {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += stride) s += a[i] * b[i];
  return s;
}

function hsvToRgb01(hDeg, s, v) {
  const h = ((hDeg % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let rp=0, gp=0, bp=0;
  if (h < 60) { rp = c; gp = x; bp = 0; }
  else if (h < 120) { rp = x; gp = c; bp = 0; }
  else if (h < 180) { rp = 0; gp = c; bp = x; }
  else if (h < 240) { rp = 0; gp = x; bp = c; }
  else if (h < 300) { rp = x; gp = 0; bp = c; }
  else { rp = c; gp = 0; bp = x; }

  return { r: rp + m, g: gp + m, b: bp + m };
}

export { clamp, lerp, fmt, deepFreeze, deepClone, isValidHexColor, hexToRgb01, rgb01ToCss, lerpRgb01, dot, hsvToRgb01 };
