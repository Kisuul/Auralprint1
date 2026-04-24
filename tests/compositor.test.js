import test from "node:test";
import assert from "node:assert/strict";

import { IDENTITY_VIEW_TRANSFORM, createCompositor } from "../src/js/render/compositor.js";
import { runtime } from "../src/js/core/preferences.js";
import { state } from "../src/js/core/state.js";
import { Renderer } from "../src/js/render/renderer.js";
import { getActiveOrbPrimaryAngleRad, resetOrbTrails, resetOrbsToDesignedPhases } from "../src/js/render/orb-runtime.js";
import { createVisualizerRegistry, registerBuiltInVisualizers } from "../src/js/render/visualizer.js";

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

function createDrawRecorderContext(drawCalls) {
  return {
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
}

function createVisualizerRecorder() {
  const calls = [];
  const instances = new Map();

  function factory() {
    return ({ node } = {}) => {
      const nodeId = node && node.id;
      const instance = {
        init(context) {
          calls.push({ kind: "init", id: nodeId, context });
        },
        resize(boundsPx) {
          calls.push({ kind: "resize", id: nodeId, boundsPx });
        },
        update(frame, dtSec) {
          calls.push({ kind: "update", id: nodeId, frame, dtSec });
        },
        render(target, viewTransform) {
          calls.push({ kind: "render", id: nodeId, target, viewTransform });
        },
        dispose() {
          calls.push({ kind: "dispose", id: nodeId });
        },
      };

      instances.set(nodeId, instance);
      return instance;
    };
  }

  return { calls, instances, factory };
}

function createRegistry(typeToImplementation = {}) {
  const registry = createVisualizerRegistry();
  for (const [type, implementation] of Object.entries(typeToImplementation)) {
    registry.register(type, implementation);
  }
  return registry;
}

function assertNearlyEqual(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) < 0.000001,
    `${message}: expected ${expected}, got ${actual}`
  );
}

function captureRenderGlobals() {
  return {
    runtimeSettings: structuredClone(runtime.settings),
    canvas: state.canvas,
    ctx: state.ctx,
    widthPx: state.widthPx,
    heightPx: state.heightPx,
    dpr: state.dpr,
    orbs: state.orbs.slice(),
    scene: structuredClone(state.scene),
    bands: structuredClone(state.bands),
    time: { ...state.time },
  };
}

function restoreRenderGlobals(snapshot) {
  runtime.settings = snapshot.runtimeSettings;
  state.canvas = snapshot.canvas;
  state.ctx = snapshot.ctx;
  state.widthPx = snapshot.widthPx;
  state.heightPx = snapshot.heightPx;
  state.dpr = snapshot.dpr;
  state.orbs.length = 0;
  state.orbs.push(...snapshot.orbs);
  state.scene.nodes = structuredClone(snapshot.scene.nodes);
  state.scene.selectedNodeId = snapshot.scene.selectedNodeId;
  state.bands.lowHz = snapshot.bands.lowHz.slice();
  state.bands.highHz = snapshot.bands.highHz.slice();
  state.bands.energies01 = snapshot.bands.energies01.slice();
  state.bands.meta.sampleRateHz = snapshot.bands.meta.sampleRateHz;
  state.bands.meta.nyquistHz = snapshot.bands.meta.nyquistHz;
  state.bands.meta.configCeilingHz = snapshot.bands.meta.configCeilingHz;
  state.bands.meta.effectiveCeilingHz = snapshot.bands.meta.effectiveCeilingHz;
  state.bands.dominantIndex = snapshot.bands.dominantIndex;
  state.bands.dominantName = snapshot.bands.dominantName;
  state.bands.ringPhaseRad = snapshot.bands.ringPhaseRad;
  state.time.lastTimestampMs = snapshot.time.lastTimestampMs;
  state.time.simPaused = snapshot.time.simPaused;
}

test("compositor creates enabled nodes, forwards bounds, and renders with the identity ViewTransform", () => {
  const recorder = createVisualizerRecorder();
  const compositor = createCompositor({
    registry: createRegistry({
      overlay: recorder.factory(),
      hidden: recorder.factory(),
    }),
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
    registry: createRegistry({
      layer: recorder.factory(),
    }),
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
    registry: createRegistry({
      layer: recorder.factory(),
    }),
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
    registry: createRegistry({
      layer: recorder.factory(),
    }),
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

test("compositor warns and skips unknown or metadata-only visualizer types without interrupting active nodes", () => {
  const recorder = createVisualizerRecorder();
  const registry = createRegistry({
    layer: recorder.factory(),
  });
  const warnings = [];
  registry.register("futureLayer", null, {
    capabilities: { runtimeImplemented: false, transitional: true },
  });

  const compositor = createCompositor({
    registry,
    onWarning(warning) {
      warnings.push(warning);
    },
  });
  const target = createTarget();

  compositor.syncScene({
    nodes: [
      {
        id: "good",
        type: "layer",
        enabled: true,
        zIndex: 0,
        bounds: { x: 0.5, y: 0.5, w: 1, h: 1 },
        anchor: { x: 0.5, y: 0.5 },
        settings: {},
      },
      {
        id: "unknown",
        type: "missingLayer",
        enabled: true,
        zIndex: 1,
        bounds: { x: 0.5, y: 0.5, w: 1, h: 1 },
        anchor: { x: 0.5, y: 0.5 },
        settings: {},
      },
      {
        id: "future",
        type: "futureLayer",
        enabled: true,
        zIndex: 2,
        bounds: { x: 0.5, y: 0.5, w: 1, h: 1 },
        anchor: { x: 0.5, y: 0.5 },
        settings: {},
      },
    ],
  }, target);

  compositor.update({ bands: [] }, 0.016);
  compositor.render(target);

  assert.deepEqual(
    recorder.calls.filter((call) => call.kind === "init").map((call) => call.id),
    ["good"]
  );
  assert.deepEqual(
    recorder.calls.filter((call) => call.kind === "render").map((call) => call.id),
    ["good"]
  );
  assert.equal(warnings.length, 2);
  assert.deepEqual(warnings.map((warning) => warning.nodeId), ["unknown", "future"]);
  assert.match(warnings[0].message, /Unknown visualizer type "missingLayer"\./);
  assert.match(warnings[1].message, /registered without a runtime implementation/);
});

test("compositor emits a default warning when a bad node is skipped without an explicit warning handler", () => {
  const recorder = createVisualizerRecorder();
  const registry = createRegistry({
    layer: recorder.factory(),
  });
  const target = createTarget();
  const previousWarn = console.warn;
  const warnCalls = [];

  console.warn = (message) => {
    warnCalls.push(message);
  };

  try {
    const compositor = createCompositor({ registry });

    compositor.syncScene({
      nodes: [
        {
          id: "good",
          type: "layer",
          enabled: true,
          zIndex: 0,
          bounds: { x: 0.5, y: 0.5, w: 1, h: 1 },
          anchor: { x: 0.5, y: 0.5 },
          settings: {},
        },
        {
          id: "missing",
          type: "missingLayer",
          enabled: true,
          zIndex: 1,
          bounds: { x: 0.5, y: 0.5, w: 1, h: 1 },
          anchor: { x: 0.5, y: 0.5 },
          settings: {},
        },
      ],
    }, target);

    compositor.update({ bands: [] }, 0.016);
    compositor.render(target);

    assert.deepEqual(
      recorder.calls.filter((call) => call.kind === "init").map((call) => call.id),
      ["good"]
    );
    assert.deepEqual(
      recorder.calls.filter((call) => call.kind === "render").map((call) => call.id),
      ["good"]
    );
    assert.equal(warnCalls.length, 1);
    assert.match(warnCalls[0], /\[Compositor\] Skipping node "missing" \(missingLayer\): Unknown visualizer type "missingLayer"\./);
  } finally {
    console.warn = previousWarn;
  }
});

test("built-in bandOverlay visualizer renders through the compositor and stops drawing once disabled", () => {
  const snapshot = captureRenderGlobals();
  const drawCalls = [];
  const fakeCtx = createDrawRecorderContext(drawCalls);

  try {
    runtime.settings = structuredClone(snapshot.runtimeSettings);
    runtime.settings.bands.count = 4;
    runtime.settings.bands.overlay.enabled = true;
    runtime.settings.bands.overlay.connectAdjacent = true;
    runtime.settings.bands.overlay.pointSizePx = 1;
    runtime.settings.bands.overlay.minRadiusFrac = 0.1;
    runtime.settings.bands.overlay.maxRadiusFrac = 0.4;
    runtime.settings.bands.overlay.waveformRadialDisplaceFrac = 0;

    state.canvas = { id: "canvas" };
    state.ctx = fakeCtx;
    state.widthPx = 400;
    state.heightPx = 200;
    state.dpr = 1;
    state.orbs.length = 0;
    state.bands.energies01 = [0, 0, 0, 0];
    state.bands.ringPhaseRad = 0;

    const registry = createVisualizerRegistry();
    registerBuiltInVisualizers(registry, {
      legacyRenderFactory: () => ({
        init() {},
        update() {},
        render() {},
        resize() {},
        dispose() {},
      }),
    });

    const compositor = createCompositor({ registry });
    const target = createTarget({ ctx: fakeCtx, widthPx: 800, heightPx: 600, dpr: 3 });
    const activeScene = {
      nodes: [
        {
          id: "overlay-root",
          type: "bandOverlay",
          enabled: true,
          zIndex: 0,
          bounds: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
          anchor: { x: 0.5, y: 0.5 },
          settings: {
            ...structuredClone(runtime.settings.bands.overlay),
            enabled: false,
            pointSizePx: 2,
          },
        },
      ],
    };
    const frame = {
      analysis: {
        timestamp: 1000,
        compat: {
          centerWaveform: Float32Array.from([0.1, -0.2, 0.3, -0.1]),
        },
      },
      bands: [
        { index: 0, energy: 1 },
        { index: 1, energy: 0 },
        { index: 2, energy: 0.5 },
        { index: 3, energy: 0.25 },
      ],
    };

    compositor.syncScene(activeScene, target);
    compositor.update(frame, 0.016);
    compositor.render(target);

    const clipCalls = drawCalls.filter((call) => call.kind === "clip");
    const rectCalls = drawCalls.filter((call) => call.kind === "rect");
    const arcCalls = drawCalls.filter((call) => call.kind === "arc");

    assert.equal(clipCalls.length, 1);
    assert.deepEqual(rectCalls[0], { kind: "rect", x: 200, y: 150, width: 400, height: 300 });
    assert.equal(drawCalls.filter((call) => call.kind === "stroke").length, 4);
    assert.equal(arcCalls.length, 4);
    assert.equal(runtime.settings.bands.overlay.pointSizePx, 1);
    assert.equal(activeScene.nodes[0].settings.enabled, false);
    assert.deepEqual(arcCalls[0], { kind: "arc", x: 640, y: 300, radius: 6 });
    assert.deepEqual(arcCalls[1], { kind: "arc", x: 400, y: 240, radius: 6 });
    assertNearlyEqual(arcCalls[2].x, 250, "Expected third frame-driven overlay point x");
    assertNearlyEqual(arcCalls[2].y, 300, "Expected third frame-driven overlay point y");
    assert.equal(arcCalls[2].radius, 6);
    assertNearlyEqual(arcCalls[3].x, 400, "Expected fourth frame-driven overlay point x");
    assertNearlyEqual(arcCalls[3].y, 405, "Expected fourth frame-driven overlay point y");
    assert.equal(arcCalls[3].radius, 6);

    const drawCountBeforeDisable = drawCalls.length;
    compositor.syncScene({
      nodes: [
        {
          ...activeScene.nodes[0],
          enabled: false,
        },
      ],
    }, target);
    compositor.update(frame, 0.016);
    compositor.render(target);

    assert.equal(drawCalls.length, drawCountBeforeDisable);
    compositor.dispose();
  } finally {
    restoreRenderGlobals(snapshot);
  }
});

test("built-in orb visualizer renders through the compositor and supports runtime reset helpers", () => {
  const snapshot = captureRenderGlobals();
  const drawCalls = [];
  const fakeCtx = createDrawRecorderContext(drawCalls);

  try {
    runtime.settings = structuredClone(snapshot.runtimeSettings);
    runtime.settings.orbs = [
      { id: "TEST_ORB", chanId: "C", bandIds: [1], chirality: 1, startAngleRad: 0 },
    ];
    runtime.settings.trace.lines = false;
    runtime.settings.particles.emitPerSecond = 1;
    runtime.settings.particles.sizeMaxPx = 4;
    runtime.settings.particles.sizeMinPx = 2;
    runtime.settings.particles.sizeToMinSec = 10;
    runtime.settings.particles.ttlSec = 20;
    runtime.settings.particles.overlapRadiusPx = 0;
    runtime.settings.motion.angularSpeedRadPerSec = 0;
    runtime.settings.motion.waveformRadialDisplaceFrac = 0;
    runtime.settings.audio.minRadiusFrac = 0.1;
    runtime.settings.audio.maxRadiusFrac = 0.5;
    runtime.settings.timing.maxDeltaTimeSec = 1;

    state.canvas = { id: "canvas" };
    state.ctx = fakeCtx;
    state.widthPx = 400;
    state.heightPx = 200;
    state.dpr = 1;
    state.time.simPaused = false;
    state.orbs.length = 0;

    const registry = createVisualizerRegistry();
    registerBuiltInVisualizers(registry);

    const compositor = createCompositor({ registry });
    const target = createTarget({ ctx: fakeCtx, widthPx: 400, heightPx: 200, dpr: 1 });
    const scene = {
      nodes: [
        {
          id: "orbs-root",
          type: "orbs",
          enabled: true,
          zIndex: 0,
          bounds: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
          anchor: { x: 0.5, y: 0.5 },
          settings: {},
        },
      ],
    };
    const frame = {
      analysis: {
        timestamp: 1000,
        channels: [
          {
            id: "C",
            label: "Center",
            energy: 0.25,
            timeDomain: Float32Array.from([0, 0, 0, 0]),
          },
        ],
      },
      bands: [
        { index: 0, energy: 0.1 },
        { index: 1, energy: 0.75 },
      ],
    };

    compositor.syncScene(scene, target);

    assert.equal(state.orbs.length, 1);
    assert.equal(getActiveOrbPrimaryAngleRad(), 0);

    compositor.update(frame, 1);
    assert.equal(state.orbs[0].trail.particles.length, 1);

    resetOrbTrails();
    assert.equal(state.orbs[0].trail.particles.length, 0);

    state.orbs[0].angleRad = Math.PI * 0.5;
    resetOrbsToDesignedPhases();
    assert.equal(state.orbs[0].angleRad, 0);
    assert.equal(state.bands.ringPhaseRad, 0);

    compositor.update(frame, 1);
    compositor.render(target);

    const rectCalls = drawCalls.filter((call) => call.kind === "rect");
    const clipCalls = drawCalls.filter((call) => call.kind === "clip");
    const arcCalls = drawCalls.filter((call) => call.kind === "arc");

    assert.equal(clipCalls.length, 1);
    assert.deepEqual(rectCalls[0], { kind: "rect", x: 100, y: 50, width: 200, height: 100 });
    assert.equal(arcCalls.length, 1);
    assert.deepEqual(arcCalls[0], { kind: "arc", x: 280, y: 100, radius: 4 });

    const drawCountBeforeDisable = drawCalls.length;
    compositor.syncScene({
      nodes: [
        {
          ...scene.nodes[0],
          enabled: false,
        },
      ],
    }, target);
    compositor.update(frame, 1);
    compositor.render(target);

    assert.equal(drawCalls.length, drawCountBeforeDisable);
    assert.equal(state.orbs.length, 0);
    compositor.dispose();
  } finally {
    restoreRenderGlobals(snapshot);
  }
});

test("built-in orb visualizer keeps compatibility state across multiple active orb nodes", () => {
  const snapshot = captureRenderGlobals();
  const drawCalls = [];
  const fakeCtx = createDrawRecorderContext(drawCalls);

  try {
    runtime.settings = structuredClone(snapshot.runtimeSettings);
    runtime.settings.trace.lines = false;
    runtime.settings.particles.emitPerSecond = 1;
    runtime.settings.motion.angularSpeedRadPerSec = 0;
    runtime.settings.motion.waveformRadialDisplaceFrac = 0;
    runtime.settings.audio.minRadiusFrac = 0.1;
    runtime.settings.audio.maxRadiusFrac = 0.5;
    runtime.settings.timing.maxDeltaTimeSec = 1;

    state.canvas = { id: "canvas" };
    state.ctx = fakeCtx;
    state.widthPx = 400;
    state.heightPx = 200;
    state.dpr = 1;
    state.time.simPaused = false;
    state.orbs.length = 0;

    const registry = createVisualizerRegistry();
    registerBuiltInVisualizers(registry);

    const compositor = createCompositor({ registry });
    const target = createTarget({ ctx: fakeCtx, widthPx: 400, heightPx: 200, dpr: 1 });
    const firstNode = {
      id: "orbs-a",
      type: "orbs",
      enabled: true,
      zIndex: 0,
      bounds: { x: 0.5, y: 0.5, w: 1, h: 1 },
      anchor: { x: 0.5, y: 0.5 },
      settings: [
        { id: "ORB_A", chanId: "C", bandIds: [], chirality: 1, startAngleRad: 0 },
      ],
    };
    const secondNode = {
      id: "orbs-b",
      type: "orbs",
      enabled: true,
      zIndex: 1,
      bounds: { x: 0.5, y: 0.5, w: 1, h: 1 },
      anchor: { x: 0.5, y: 0.5 },
      settings: [
        { id: "ORB_B", chanId: "C", bandIds: [], chirality: 1, startAngleRad: Math.PI },
      ],
    };
    const frame = {
      analysis: {
        timestamp: 1000,
        channels: [
          { id: "C", label: "Center", energy: 0.5, timeDomain: Float32Array.from([0, 0, 0, 0]) },
        ],
      },
      bands: [],
    };

    compositor.syncScene({ nodes: [firstNode, secondNode] }, target);
    assert.deepEqual(state.orbs.map((orb) => orb.id), ["ORB_A", "ORB_B"]);
    assert.equal(getActiveOrbPrimaryAngleRad(), 0);

    compositor.update(frame, 1);
    assert.deepEqual(state.orbs.map((orb) => orb.trail.particles.length), [1, 1]);

    resetOrbTrails();
    assert.deepEqual(state.orbs.map((orb) => orb.trail.particles.length), [0, 0]);

    state.orbs[0].angleRad = Math.PI * 0.25;
    state.orbs[1].angleRad = Math.PI * 0.75;
    resetOrbsToDesignedPhases();
    assert.equal(state.orbs[0].angleRad, 0);
    assert.equal(state.orbs[1].angleRad, Math.PI);
    assert.equal(state.bands.ringPhaseRad, 0);

    compositor.syncScene({
      nodes: [
        {
          ...firstNode,
          enabled: false,
        },
        secondNode,
      ],
    }, target);

    assert.deepEqual(state.orbs.map((orb) => orb.id), ["ORB_B"]);
    resetOrbsToDesignedPhases();
    assert.equal(state.orbs[0].angleRad, Math.PI);

    compositor.dispose();
    assert.equal(state.orbs.length, 0);
  } finally {
    restoreRenderGlobals(snapshot);
  }
});

test("built-in orb visualizer updates reused node settings through compositor sync", () => {
  const snapshot = captureRenderGlobals();
  const drawCalls = [];
  const fakeCtx = createDrawRecorderContext(drawCalls);

  try {
    runtime.settings = structuredClone(snapshot.runtimeSettings);
    runtime.settings.trace.lines = false;

    state.canvas = { id: "canvas" };
    state.ctx = fakeCtx;
    state.widthPx = 400;
    state.heightPx = 200;
    state.dpr = 1;
    state.orbs.length = 0;

    const registry = createVisualizerRegistry();
    registerBuiltInVisualizers(registry);

    const compositor = createCompositor({ registry });
    const target = createTarget({ ctx: fakeCtx, widthPx: 400, heightPx: 200, dpr: 1 });
    const baseNode = {
      id: "orbs-dynamic",
      type: "orbs",
      enabled: true,
      zIndex: 0,
      bounds: { x: 0.5, y: 0.5, w: 1, h: 1 },
      anchor: { x: 0.5, y: 0.5 },
      settings: [
        { id: "ORB_BEFORE", chanId: "C", bandIds: [], chirality: 1, startAngleRad: 0 },
      ],
    };

    compositor.syncScene({ nodes: [baseNode] }, target);
    assert.deepEqual(state.orbs.map((orb) => orb.id), ["ORB_BEFORE"]);
    assert.equal(state.orbs[0].startAngleRad, 0);

    compositor.syncScene({
      nodes: [
        {
          ...baseNode,
          settings: [
            { id: "ORB_AFTER", chanId: "L", bandIds: [1], chirality: -1, startAngleRad: Math.PI },
          ],
        },
      ],
    }, target);

    assert.deepEqual(state.orbs.map((orb) => orb.id), ["ORB_AFTER"]);
    assert.equal(state.orbs[0].chanId, "L");
    assert.deepEqual(state.orbs[0].bandIds, [1]);
    assert.equal(state.orbs[0].chirality, -1);
    assert.equal(state.orbs[0].startAngleRad, Math.PI);
    assert.equal(getActiveOrbPrimaryAngleRad(), Math.PI);

    compositor.dispose();
  } finally {
    restoreRenderGlobals(snapshot);
  }
});

test("Renderer.renderFrame keeps the live seam on plain frame data and clips compositor visualizers to bounds", () => {
  const snapshot = captureRenderGlobals();
  const drawCalls = [];
  const fakeCtx = createDrawRecorderContext(drawCalls);

  let centerWaveformReads = 0;
  let analyserAccessed = false;

  try {
    runtime.settings = structuredClone(snapshot.runtimeSettings);
    runtime.settings.bands.count = 4;
    runtime.settings.bands.overlay.enabled = true;
    runtime.settings.bands.overlay.connectAdjacent = true;
    runtime.settings.bands.overlay.pointSizePx = 2;
    runtime.settings.bands.overlay.minRadiusFrac = 0.1;
    runtime.settings.bands.overlay.maxRadiusFrac = 0.4;
    runtime.settings.bands.overlay.waveformRadialDisplaceFrac = 0.15;
    runtime.settings.trace.lines = false;
    runtime.settings.particles.emitPerSecond = 60;
    runtime.settings.particles.sizeMaxPx = 4;
    runtime.settings.particles.sizeMinPx = 2;
    runtime.settings.particles.sizeToMinSec = 10;
    runtime.settings.particles.ttlSec = 20;
    runtime.settings.particles.overlapRadiusPx = 0;
    runtime.settings.motion.angularSpeedRadPerSec = 0;
    runtime.settings.motion.waveformRadialDisplaceFrac = 0;
    runtime.settings.audio.minRadiusFrac = 0.1;
    runtime.settings.audio.maxRadiusFrac = 0.1;
    runtime.settings.timing.maxDeltaTimeSec = 1;
    runtime.settings.visuals.backgroundColor = "#000000";

    state.canvas = { id: "canvas" };
    state.ctx = fakeCtx;
    state.widthPx = 400;
    state.heightPx = 200;
    state.dpr = 1;
    state.orbs.length = 0;
    state.scene.nodes = [
      {
        id: "orbs-1",
        type: "orbs",
        enabled: true,
        zIndex: 0,
        bounds: { x: 0.5, y: 0.5, w: 1, h: 1 },
        anchor: { x: 0.5, y: 0.5 },
        settings: structuredClone(runtime.settings.orbs),
      },
      {
        id: "overlay-1",
        type: "bandOverlay",
        enabled: true,
        zIndex: 1,
        bounds: { x: 0.5, y: 0.5, w: 1, h: 1 },
        anchor: { x: 0.5, y: 0.5 },
        settings: structuredClone(runtime.settings.bands.overlay),
      },
    ];
    state.scene.selectedNodeId = "orbs-1";
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
    state.time.simPaused = false;

    const centerWaveform = Float32Array.from([0.1, -0.2, 0.3, -0.1]);
    const bandSnapshot = {
      ready: true,
      bands: {
        L: {
          id: "L",
          label: "Left",
          rms: 0.2,
          energy01: 0.2,
          timeDomain: Float32Array.from([0.1, 0.0, -0.1, 0.05]),
          freqDb: null,
        },
        R: {
          id: "R",
          label: "Right",
          rms: 0.25,
          energy01: 0.25,
          timeDomain: Float32Array.from([0.15, -0.05, 0.1, -0.15]),
          freqDb: null,
        },
        C: {
          id: "C",
          label: "Center",
          rms: 0.3,
          energy01: 0.3,
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

    const rectCalls = drawCalls.filter((call) => call.kind === "rect");
    const clipCalls = drawCalls.filter((call) => call.kind === "clip");
    assert.equal(rectCalls.length, 2);
    assert.equal(clipCalls.length, 2);
    assert.deepEqual(rectCalls[0], { kind: "rect", x: 0, y: 0, width: 400, height: 200 });
    assert.deepEqual(rectCalls[1], { kind: "rect", x: 0, y: 0, width: 400, height: 200 });
    assert.equal(drawCalls.filter((call) => call.kind === "stroke").length, 4);
    assert.equal(drawCalls.filter((call) => call.kind === "arc").length, 6);
  } finally {
    restoreRenderGlobals(snapshot);
  }
});
