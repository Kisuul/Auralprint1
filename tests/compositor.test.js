import test from "node:test";
import assert from "node:assert/strict";

import { IDENTITY_VIEW_TRANSFORM, createCompositor } from "../src/js/render/compositor.js";
import { runtime } from "../src/js/core/preferences.js";
import { state } from "../src/js/core/state.js";
import { Renderer } from "../src/js/render/renderer.js";

function createTarget(overrides = {}) {
  return {
    canvas: { id: "canvas" },
    ctx: { id: "ctx" },
    widthPx: 400,
    heightPx: 200,
    dpr: 2,
    ...overrides,
  };
}

function createVisualizerRecorder() {
  const calls = [];
  const instances = new Map();

  function factory() {
    return (node) => {
      const instance = {
        init(context) {
          calls.push({ kind: "init", id: node.id, context });
        },
        resize(boundsPx) {
          calls.push({ kind: "resize", id: node.id, boundsPx });
        },
        update(frame, dtSec) {
          calls.push({ kind: "update", id: node.id, frame, dtSec });
        },
        render(target, viewTransform) {
          calls.push({ kind: "render", id: node.id, target, viewTransform });
        },
        dispose() {
          calls.push({ kind: "dispose", id: node.id });
        },
      };

      instances.set(node.id, instance);
      return instance;
    };
  }

  return { calls, instances, factory };
}

test("compositor creates enabled nodes, forwards bounds, and renders with the identity ViewTransform", () => {
  const recorder = createVisualizerRecorder();
  const compositor = createCompositor({
    factories: {
      overlay: recorder.factory(),
      hidden: recorder.factory(),
    },
  });
  const target = createTarget();
  const frame = { bands: [] };

  compositor.syncScene({
    nodes: [
      {
        id: "overlay-root",
        type: "overlay",
        enabled: true,
        zIndex: 5,
        bounds: { x: 0.75, y: 0.25, w: 0.5, h: 0.5 },
        anchor: { x: 0.5, y: 0.5 },
        settings: {},
      },
      {
        id: "hidden-root",
        type: "hidden",
        enabled: false,
        zIndex: 0,
        bounds: { x: 0.5, y: 0.5, w: 1, h: 1 },
        anchor: { x: 0.5, y: 0.5 },
        settings: {},
      },
    ],
  }, target);

  compositor.update(frame, 0.125);
  compositor.render(target);

  assert.deepEqual(
    recorder.calls.filter((call) => call.kind === "init").map((call) => call.id),
    ["overlay-root"]
  );
  assert.deepEqual(
    recorder.calls.filter((call) => call.kind === "resize")[0].boundsPx,
    { x: 200, y: 0, width: 200, height: 100 }
  );

  const initCall = recorder.calls.find((call) => call.kind === "init");
  assert.equal(initCall.context.widthPx, 400);
  assert.equal(initCall.context.heightPx, 200);
  assert.equal(initCall.context.dpr, 2);

  const updateCall = recorder.calls.find((call) => call.kind === "update");
  assert.equal(updateCall.frame, frame);
  assert.equal(updateCall.dtSec, 0.125);

  const renderCall = recorder.calls.find((call) => call.kind === "render");
  assert.equal(renderCall.target, target);
  assert.equal(renderCall.viewTransform, IDENTITY_VIEW_TRANSFORM);
});

test("compositor renders in zIndex order and preserves scene order for zIndex ties", () => {
  const recorder = createVisualizerRecorder();
  const compositor = createCompositor({
    factories: {
      layer: recorder.factory(),
    },
  });
  const target = createTarget();

  compositor.syncScene({
    nodes: [
      {
        id: "mid-b",
        type: "layer",
        enabled: true,
        zIndex: 0,
        bounds: { x: 0.5, y: 0.5, w: 1, h: 1 },
        anchor: { x: 0.5, y: 0.5 },
        settings: {},
      },
      {
        id: "mid-a",
        type: "layer",
        enabled: true,
        zIndex: 0,
        bounds: { x: 0.5, y: 0.5, w: 1, h: 1 },
        anchor: { x: 0.5, y: 0.5 },
        settings: {},
      },
      {
        id: "back",
        type: "layer",
        enabled: true,
        zIndex: -2,
        bounds: { x: 0.5, y: 0.5, w: 1, h: 1 },
        anchor: { x: 0.5, y: 0.5 },
        settings: {},
      },
    ],
  }, target);

  compositor.update({ bands: [] }, 0.016);
  compositor.render(target);

  assert.deepEqual(
    recorder.calls.filter((call) => call.kind === "render").map((call) => call.id),
    ["back", "mid-b", "mid-a"]
  );
});

test("compositor disposes removed and disabled nodes during scene sync", () => {
  const recorder = createVisualizerRecorder();
  const compositor = createCompositor({
    factories: {
      layer: recorder.factory(),
    },
  });
  const target = createTarget();

  compositor.syncScene({
    nodes: [
      {
        id: "keep-me",
        type: "layer",
        enabled: true,
        zIndex: 0,
        bounds: { x: 0.5, y: 0.5, w: 1, h: 1 },
        anchor: { x: 0.5, y: 0.5 },
        settings: {},
      },
      {
        id: "remove-me",
        type: "layer",
        enabled: true,
        zIndex: 1,
        bounds: { x: 0.5, y: 0.5, w: 1, h: 1 },
        anchor: { x: 0.5, y: 0.5 },
        settings: {},
      },
    ],
  }, target);

  compositor.syncScene({
    nodes: [
      {
        id: "keep-me",
        type: "layer",
        enabled: false,
        zIndex: 0,
        bounds: { x: 0.5, y: 0.5, w: 1, h: 1 },
        anchor: { x: 0.5, y: 0.5 },
        settings: {},
      },
    ],
  }, target);

  assert.deepEqual(
    recorder.calls.filter((call) => call.kind === "dispose").map((call) => call.id).sort(),
    ["keep-me", "remove-me"]
  );
});

test("compositor reuses live instances until the target size changes, then re-resizes them", () => {
  const recorder = createVisualizerRecorder();
  const compositor = createCompositor({
    factories: {
      layer: recorder.factory(),
    },
  });
  const scene = {
    nodes: [
      {
        id: "resizable",
        type: "layer",
        enabled: true,
        zIndex: 0,
        bounds: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
        anchor: { x: 0.5, y: 0.5 },
        settings: {},
      },
    ],
  };

  compositor.syncScene(scene, createTarget());
  compositor.syncScene(scene, createTarget());
  compositor.syncScene(scene, createTarget({ widthPx: 800 }));

  const resizeCalls = recorder.calls.filter((call) => call.kind === "resize");
  const initCalls = recorder.calls.filter((call) => call.kind === "init");

  assert.equal(initCalls.length, 1);
  assert.equal(resizeCalls.length, 2);
  assert.deepEqual(resizeCalls[0].boundsPx, { x: 100, y: 50, width: 200, height: 100 });
  assert.deepEqual(resizeCalls[1].boundsPx, { x: 200, y: 50, width: 400, height: 100 });
});

test("Renderer.renderFrame keeps the live seam on plain frame data and clips legacy rendering to compositor bounds", () => {
  const previousRuntimeSettings = structuredClone(runtime.settings);
  const previousCanvas = state.canvas;
  const previousCtx = state.ctx;
  const previousWidthPx = state.widthPx;
  const previousHeightPx = state.heightPx;
  const previousDpr = state.dpr;
  const previousOrbs = state.orbs.slice();
  const previousBands = structuredClone(state.bands);

  const drawCalls = [];
  const fakeCtx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineJoin: "",
    lineCap: "",
    globalAlpha: 1,
    save() { drawCalls.push({ kind: "save" }); },
    restore() { drawCalls.push({ kind: "restore" }); },
    fillRect(x, y, width, height) { drawCalls.push({ kind: "fillRect", x, y, width, height }); },
    beginPath() { drawCalls.push({ kind: "beginPath" }); },
    moveTo(x, y) { drawCalls.push({ kind: "moveTo", x, y }); },
    lineTo(x, y) { drawCalls.push({ kind: "lineTo", x, y }); },
    stroke() { drawCalls.push({ kind: "stroke" }); },
    arc(x, y, radius) { drawCalls.push({ kind: "arc", x, y, radius }); },
    fill() { drawCalls.push({ kind: "fill" }); },
    rect(x, y, width, height) { drawCalls.push({ kind: "rect", x, y, width, height }); },
    clip() { drawCalls.push({ kind: "clip" }); },
  };

  let centerWaveformReads = 0;
  let analyserAccessed = false;

  try {
    runtime.settings = structuredClone(previousRuntimeSettings);
    runtime.settings.bands.count = 4;
    runtime.settings.bands.overlay.enabled = true;
    runtime.settings.bands.overlay.connectAdjacent = true;
    runtime.settings.bands.overlay.pointSizePx = 2;
    runtime.settings.bands.overlay.minRadiusFrac = 0.1;
    runtime.settings.bands.overlay.maxRadiusFrac = 0.4;
    runtime.settings.bands.overlay.waveformRadialDisplaceFrac = 0.15;
    runtime.settings.visuals.backgroundColor = "#000000";

    state.canvas = { id: "canvas" };
    state.ctx = fakeCtx;
    state.widthPx = 400;
    state.heightPx = 200;
    state.dpr = 1;
    state.orbs.length = 0;
    state.bands.lowHz = [0, 100, 200, 300];
    state.bands.highHz = [100, 200, 300, Infinity];
    state.bands.energies01 = [0.1, 0.3, 0.6, 0.2];
    state.bands.meta.sampleRateHz = 48000;
    state.bands.meta.nyquistHz = 24000;
    state.bands.meta.configCeilingHz = 22500;
    state.bands.meta.effectiveCeilingHz = 22500;
    state.bands.dominantIndex = 2;
    state.bands.dominantName = "Band 2";
    state.bands.ringPhaseRad = 0;

    const centerWaveform = Float32Array.from([0.1, -0.2, 0.3, -0.1]);
    const bandSnapshot = {
      ready: true,
      bands: {
        L: {
          id: "L",
          label: "Left",
          rms: 0.2,
          timeDomain: Float32Array.from([0.1, 0.0, -0.1, 0.05]),
          freqDb: null,
        },
        R: {
          id: "R",
          label: "Right",
          rms: 0.25,
          timeDomain: Float32Array.from([0.15, -0.05, 0.1, -0.15]),
          freqDb: null,
        },
        C: {
          id: "C",
          label: "Center",
          rms: 0.3,
          get timeDomain() {
            centerWaveformReads += 1;
            return centerWaveform;
          },
          freqDb: Float32Array.from([-24, -18, -12, -6]),
          get analyser() {
            analyserAccessed = true;
            throw new Error("Renderer must not reach through the frame bridge to analyser internals.");
          },
        },
      },
    };

    Renderer.renderFrame({
      bandSnapshot,
      dtSec: 1 / 60,
      nowSec: 12.5,
    });

    assert.equal(analyserAccessed, false);
    assert.equal(centerWaveformReads, 1);

    const clipIndex = drawCalls.findIndex((call) => call.kind === "clip");
    const rectIndex = drawCalls.findIndex((call) => call.kind === "rect");
    assert.notEqual(rectIndex, -1);
    assert.notEqual(clipIndex, -1);
    assert.ok(rectIndex < clipIndex);
    assert.deepEqual(drawCalls[rectIndex], {
      kind: "rect",
      x: 0,
      y: 0,
      width: 400,
      height: 200,
    });
  } finally {
    runtime.settings = previousRuntimeSettings;
    state.canvas = previousCanvas;
    state.ctx = previousCtx;
    state.widthPx = previousWidthPx;
    state.heightPx = previousHeightPx;
    state.dpr = previousDpr;
    state.orbs.length = 0;
    state.orbs.push(...previousOrbs);
    state.bands.lowHz = previousBands.lowHz.slice();
    state.bands.highHz = previousBands.highHz.slice();
    state.bands.energies01 = previousBands.energies01.slice();
    state.bands.meta.sampleRateHz = previousBands.meta.sampleRateHz;
    state.bands.meta.nyquistHz = previousBands.meta.nyquistHz;
    state.bands.meta.configCeilingHz = previousBands.meta.configCeilingHz;
    state.bands.meta.effectiveCeilingHz = previousBands.meta.effectiveCeilingHz;
    state.bands.dominantIndex = previousBands.dominantIndex;
    state.bands.dominantName = previousBands.dominantName;
    state.bands.ringPhaseRad = previousBands.ringPhaseRad;
  }
});
