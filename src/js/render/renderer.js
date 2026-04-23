import { clamp, lerp, hexToRgb01, rgb01ToCss, lerpRgb01 } from "../core/utils.js";
import { TAU } from "../core/constants.js";
import { BAND_NAMES, runtime } from "../core/preferences.js";
import { state } from "../core/state.js";
import { Spaces } from "../core/spaces.js";
import { ColorPolicy } from "./color-policy.js";
import { createCompositor } from "./compositor.js";
import { createVisualizerRegistry, registerBuiltInVisualizers } from "./visualizer.js";

/* =============================================================================
   Renderer
   ========================================================================== */
const Renderer = (() => {
  const LEGACY_COMPAT_OVERLAY_NODE = {
    id: "bandOverlayRoot",
    type: "bandOverlay",
    enabled: true,
    zIndex: 0,
    bounds: Object.freeze({ x: 0.5, y: 0.5, w: 1, h: 1 }),
    anchor: Object.freeze({ x: 0.5, y: 0.5 }),
    settings: Object.freeze({}),
  };
  const LEGACY_COMPAT_RENDER_NODE = Object.freeze({
    id: "legacyRenderRoot",
    type: "legacyRender",
    enabled: true,
    zIndex: 1,
    bounds: Object.freeze({ x: 0.5, y: 0.5, w: 1, h: 1 }),
    anchor: Object.freeze({ x: 0.5, y: 0.5 }),
    settings: Object.freeze({}),
  });
  const LEGACY_COMPAT_SCENE = {
    nodes: [LEGACY_COMPAT_OVERLAY_NODE, LEGACY_COMPAT_RENDER_NODE],
  };

  function clearFrame() {
    const ctx = state.ctx;
    const s = runtime.settings;
    ctx.fillStyle = s.visuals.backgroundColor;
    ctx.fillRect(0, 0, state.widthPx, state.heightPx);
  }

  function drawTrailLines(particles) {
    const s = runtime.settings;
    if (!s.trace.lines) return;

    const segments = s.trace.numLines;
    const neededPts = segments + 1;
    if (!particles || particles.length < 2) return;

    const startIdx = Math.max(0, particles.length - neededPts);
    const slice = particles.slice(startIdx);
    if (slice.length < 2) return;

    const ctx = state.ctx;
    const rgb = ColorPolicy.pickLineColorRgb01(particles);
    const stroke = rgb01ToCss(rgb, s.trace.lineAlpha);

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = s.trace.lineWidthPx * state.dpr;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const p0 = Spaces.simToScreen(slice[0].xSim, slice[0].ySim);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);

    for (let i = 1; i < slice.length; i++) {
      const pi = Spaces.simToScreen(slice[i].xSim, slice[i].ySim);
      ctx.lineTo(pi.x, pi.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawParticles(particles, nowSec) {
    const s = runtime.settings;
    const ctx = state.ctx;

    const bg = hexToRgb01(s.visuals.backgroundColor);

    const sizeMax = s.particles.sizeMaxPx * state.dpr;
    const sizeMin = Math.min(s.particles.sizeMinPx, s.particles.sizeMaxPx) * state.dpr;

    const toMin = Math.max(0.0001, s.particles.sizeToMinSec);
    const ttl = Math.max(0.0001, s.particles.ttlSec);
    const fadeSec = Math.max(0.0001, ttl - toMin);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const age = nowSec - p.bornSec;

      let size = sizeMin;
      if (age < toMin) {
        const t = clamp(age / toMin, 0, 1);
        size = lerp(sizeMax, sizeMin, t);
      }

      const fg = p.rgbStart || hexToRgb01(s.visuals.particleColor);

      let color = fg;
      if (age >= toMin) {
        const t = clamp((age - toMin) / fadeSec, 0, 1);
        color = lerpRgb01(fg, bg, t);
      }

      const ps = Spaces.simToScreen(p.xSim, p.ySim);
      ctx.fillStyle = rgb01ToCss(color, 1);
      ctx.beginPath();
      ctx.arc(ps.x, ps.y, size, 0, TAU);
      ctx.fill();
    }
  }

  function readWaveformPeak(timeDomain) {
    if (!timeDomain || !timeDomain.length) return 0;
    let peak = 0;
    for (let i = 0; i < timeDomain.length; i++) {
      const value = Math.abs(timeDomain[i]);
      if (value > peak) peak = value;
    }
    return peak;
  }

  function createBandFrameBridge() {
    const bandFrame = {
      analysis: {
        timestamp: 0,
        sampleRate: null,
        fftSize: null,
        channels: [],
        rms: [],
        peak: [],
        globalMax: 0,
        compat: {
          centerWaveform: null,
        },
      },
      bands: [],
      dominantBandIndex: -1,
      dominantBand: null,
      distribution: runtime.settings.bands.distributionMode,
      rms: [],
      maxEnergy: 0,
      minEnergy: 0,
    };

    const channelEntries = {
      L: { id: "L", label: "Left", magnitudes: null, phase: null },
      R: { id: "R", label: "Right", magnitudes: null, phase: null },
      C: { id: "C", label: "Center", magnitudes: null, phase: null },
    };

    function ensureBandEntries(count) {
      while (bandFrame.bands.length < count) {
        const index = bandFrame.bands.length;
        bandFrame.bands.push({
          index,
          name: BAND_NAMES[index] || `Band ${index}`,
          startHz: 0,
          endHz: 0,
          binStart: null,
          binEnd: null,
          energy: 0,
          peak: null,
        });
      }
      bandFrame.bands.length = count;
    }

    return function buildBandFrame(bandSnapshot, nowSec) {
      const count = runtime.settings.bands.count;
      const lowHz = Array.isArray(state.bands.lowHz) ? state.bands.lowHz : [];
      const highHz = Array.isArray(state.bands.highHz) ? state.bands.highHz : [];
      const energies = Array.isArray(state.bands.energies01) ? state.bands.energies01 : [];
      const nyquistHz = Number.isFinite(state.bands.meta.nyquistHz) ? state.bands.meta.nyquistHz : null;
      const snapshotBands = bandSnapshot && bandSnapshot.ready && bandSnapshot.bands ? bandSnapshot.bands : null;
      const orderedBands = snapshotBands
        ? [snapshotBands.L, snapshotBands.R, snapshotBands.C]
          .filter(Boolean)
          .map((liveBand) => ({
            id: liveBand.id,
            label: liveBand.label || liveBand.id,
            rms: Number.isFinite(liveBand.rms) ? liveBand.rms : 0,
            timeDomain: liveBand.timeDomain || null,
            freqDb: liveBand.freqDb || null,
          }))
        : [];
      const centerChannel = orderedBands.find((channel) => channel.id === "C") || null;
      const fftBins = centerChannel && centerChannel.freqDb ? centerChannel.freqDb.length : 0;

      ensureBandEntries(count);

      let maxEnergy = 0;
      let minEnergy = count > 0 ? 1 : 0;

      for (let i = 0; i < count; i++) {
        const band = bandFrame.bands[i];
        const startHz = Number.isFinite(lowHz[i]) ? lowHz[i] : 0;
        const highHzRaw = highHz[i];
        const boundedEndHz = Number.isFinite(nyquistHz)
          ? Math.min(nyquistHz, highHzRaw === Infinity ? nyquistHz : (Number.isFinite(highHzRaw) ? highHzRaw : startHz))
          : (highHzRaw === Infinity ? Infinity : (Number.isFinite(highHzRaw) ? highHzRaw : startHz));
        const energy = clamp(energies[i] || 0, 0, 1);

        band.index = i;
        band.name = BAND_NAMES[i] || `Band ${i}`;
        band.startHz = startHz;
        band.endHz = boundedEndHz;
        band.energy = energy;
        band.peak = null;

        if (fftBins > 0 && Number.isFinite(nyquistHz) && nyquistHz > 0) {
          const highForBins = boundedEndHz === Infinity ? nyquistHz : boundedEndHz;
          band.binStart = clamp(Math.floor((startHz / nyquistHz) * (fftBins - 1)), 0, fftBins - 1);
          band.binEnd = clamp(Math.ceil((highForBins / nyquistHz) * (fftBins - 1)), 0, fftBins - 1);
        } else {
          band.binStart = null;
          band.binEnd = null;
        }

        if (energy > maxEnergy) maxEnergy = energy;
        if (energy < minEnergy) minEnergy = energy;
      }

      bandFrame.analysis.channels.length = 0;
      bandFrame.analysis.rms.length = 0;
      bandFrame.analysis.peak.length = 0;
      bandFrame.analysis.compat.centerWaveform = centerChannel ? centerChannel.timeDomain : null;

      let globalMax = 0;
      for (const liveBand of orderedBands) {
        const channelEntry = channelEntries[liveBand.id] || {
          id: liveBand.id,
          label: liveBand.label || liveBand.id,
          magnitudes: null,
          phase: null,
        };
        channelEntry.label = liveBand.label || channelEntry.label;
        channelEntry.magnitudes = liveBand.id === "C" && liveBand.freqDb ? liveBand.freqDb : null;
        channelEntry.phase = null;
        bandFrame.analysis.channels.push(channelEntry);

        const rms = liveBand.rms;
        const peak = readWaveformPeak(liveBand.timeDomain);
        bandFrame.analysis.rms.push(rms);
        bandFrame.analysis.peak.push(peak);
        if (peak > globalMax) globalMax = peak;
      }

      const dominantBandIndex = count > 0
        ? clamp(Number.isInteger(state.bands.dominantIndex) ? state.bands.dominantIndex : 0, 0, count - 1)
        : -1;

      bandFrame.analysis.timestamp = Math.round((Number.isFinite(nowSec) ? nowSec : 0) * 1000);
      bandFrame.analysis.sampleRate = state.bands.meta.sampleRateHz;
      bandFrame.analysis.fftSize = centerChannel && centerChannel.freqDb
        ? centerChannel.freqDb.length * 2
        : (centerChannel && centerChannel.timeDomain
          ? centerChannel.timeDomain.length
          : runtime.settings.audio.fftSize);
      bandFrame.analysis.globalMax = globalMax;
      bandFrame.dominantBandIndex = dominantBandIndex;
      bandFrame.dominantBand = dominantBandIndex >= 0 ? bandFrame.bands[dominantBandIndex] : null;
      bandFrame.distribution = runtime.settings.bands.distributionMode;
      bandFrame.rms = bandFrame.analysis.rms;
      bandFrame.maxEnergy = maxEnergy;
      bandFrame.minEnergy = minEnergy;

      return bandFrame;
    };
  }

  class LegacyRenderCompatUnit {
    constructor() {
      this.context = null;
      this.boundsPx = null;
      this.frame = null;
      this.dtSec = 0;
    }

    init(context) {
      this.context = context;
    }

    resize(boundsPx) {
      this.boundsPx = boundsPx ? { ...boundsPx } : null;
    }

    update(frame, dtSec) {
      this.frame = frame;
      this.dtSec = dtSec;
    }

    render(_target, _viewTransform) {
      if (!state.orbs.length) return;

      const analysis = this.frame && this.frame.analysis ? this.frame.analysis : null;
      const nowSec = analysis && Number.isFinite(analysis.timestamp) ? (analysis.timestamp / 1000) : 0;
      const boundsPx = this.boundsPx;
      const ctx = state.ctx;

      ctx.save();
      if (boundsPx) {
        ctx.beginPath();
        ctx.rect(boundsPx.x, boundsPx.y, boundsPx.width, boundsPx.height);
        ctx.clip();
      }

      try {
        for (const orb of state.orbs) {
          const particles = orb.trail.particles;
          drawTrailLines(particles);
          drawParticles(particles, nowSec);
        }
      } finally {
        ctx.restore();
      }
    }

    dispose() {
      this.context = null;
      this.boundsPx = null;
      this.frame = null;
      this.dtSec = 0;
    }
  }

  const buildBandFrame = createBandFrameBridge();
  const visualizerRegistry = createVisualizerRegistry();
  registerBuiltInVisualizers(visualizerRegistry, {
    legacyRenderFactory: () => new LegacyRenderCompatUnit(),
  });
  const compositor = createCompositor({
    registry: visualizerRegistry,
    onWarning({ message }) {
      if (!message) return;
      console.warn(`[Compositor] ${message}`);
    },
  });

  function getRenderTarget() {
    return {
      canvas: state.canvas,
      ctx: state.ctx,
      widthPx: state.widthPx,
      heightPx: state.heightPx,
      dpr: state.dpr,
    };
  }

  function renderFrame({ bandSnapshot = null, dtSec = 0, nowSec = 0 } = {}) {
    clearFrame();

    const target = getRenderTarget();
    LEGACY_COMPAT_OVERLAY_NODE.enabled = !!runtime.settings.bands.overlay.enabled;
    compositor.syncScene(LEGACY_COMPAT_SCENE, target);
    compositor.update(buildBandFrame(bandSnapshot, nowSec), dtSec);
    compositor.render(target);
  }

  // RecorderEngine owns captureStream() and any MediaStream lifecycle.
  // Renderer exposes only the canonical display canvas as a read-only tap target.
  function getRecorderTap() {
    return {
      canvas: state.canvas,
      widthPx: state.widthPx,
      heightPx: state.heightPx,
      dpr: state.dpr,
    };
  }

  return { renderFrame, getRecorderTap };
})();

export { Renderer };
