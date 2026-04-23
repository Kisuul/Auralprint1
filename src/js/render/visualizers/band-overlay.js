import { clamp, rgb01ToCss } from "../../core/utils.js";
import { TAU } from "../../core/constants.js";
import { runtime } from "../../core/preferences.js";
import { state } from "../../core/state.js";
import { Spaces } from "../../core/spaces.js";
import { ColorPolicy } from "../color-policy.js";

function overlayWaveformDisplacementPx(baseRadiusPx, angleRad, waveform, overlay) {
  if (!waveform || waveform.length === 0) return 0;
  const phase01 = ((angleRad % TAU) + TAU) % TAU / TAU;
  const idx = Math.floor(phase01 * (waveform.length - 1));
  const sample = waveform[idx];
  return baseRadiusPx * overlay.waveformRadialDisplaceFrac * sample;
}

function drawBandOverlay(ctx, centerWaveform, overlay) {
  const bands = runtime.settings.bands;
  const n = bands.count;
  if (!n) return;

  const phase = state.bands.ringPhaseRad;
  const minDim = Math.min(state.widthPx, state.heightPx);
  const minR = minDim * overlay.minRadiusFrac;
  const maxR = minDim * overlay.maxRadiusFrac;
  const safeMin = Math.min(minR, maxR);
  const safeMax = Math.max(minR, maxR);
  const pts = new Array(n);

  for (let i = 0; i < n; i++) {
    const angle = phase + (i * TAU / n);
    const e = clamp(state.bands.energies01[i] || 0, 0, 1);
    const baseR = safeMin + (safeMax - safeMin) * e;
    const disp = overlayWaveformDisplacementPx(baseR, angle, centerWaveform, overlay);
    const r = baseR + disp;

    pts[i] = {
      xSim: r * Math.cos(angle),
      ySim: r * Math.sin(angle),
    };
  }

  if (overlay.connectAdjacent) {
    ctx.save();
    ctx.lineWidth = overlay.lineWidthPx * state.dpr;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const c = ColorPolicy.bandRgb01(i);
      const a = Spaces.simToScreen(pts[i].xSim, pts[i].ySim);
      const b = Spaces.simToScreen(pts[j].xSim, pts[j].ySim);

      ctx.strokeStyle = rgb01ToCss(c, overlay.lineAlpha);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.save();
  const rPx = overlay.pointSizePx * state.dpr;
  for (let i = 0; i < n; i++) {
    const c = ColorPolicy.bandRgb01(i);
    const p = Spaces.simToScreen(pts[i].xSim, pts[i].ySim);

    ctx.fillStyle = rgb01ToCss(c, overlay.alpha);
    ctx.beginPath();
    ctx.arc(p.x, p.y, rPx, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

class BandOverlayVisualizer {
  constructor() {
    this.context = null;
    this.boundsPx = null;
    this.frame = null;
    this.dtSec = 0;
  }

  init(context) {
    this.context = context || null;
  }

  update(frame, dtSec) {
    this.frame = frame || null;
    this.dtSec = Number.isFinite(dtSec) ? dtSec : 0;
  }

  render(target, _viewTransform) {
    const overlay = runtime.settings.bands.overlay;
    const analysis = this.frame && this.frame.analysis ? this.frame.analysis : null;
    const centerWaveform = analysis && analysis.compat ? analysis.compat.centerWaveform : null;
    const ctx = (target && target.ctx) || (this.context && this.context.ctx) || state.ctx;

    if (!ctx || !overlay.enabled || !centerWaveform) return;

    ctx.save();
    if (this.boundsPx) {
      ctx.beginPath();
      ctx.rect(this.boundsPx.x, this.boundsPx.y, this.boundsPx.width, this.boundsPx.height);
      ctx.clip();
    }

    try {
      drawBandOverlay(ctx, centerWaveform, overlay);
    } finally {
      ctx.restore();
    }
  }

  resize(boundsPx) {
    this.boundsPx = boundsPx ? { ...boundsPx } : null;
  }

  dispose() {
    this.context = null;
    this.boundsPx = null;
    this.frame = null;
    this.dtSec = 0;
  }
}

export { BandOverlayVisualizer };
