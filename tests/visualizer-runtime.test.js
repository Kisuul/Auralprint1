import test from "node:test";
import assert from "node:assert/strict";

import { TAU } from "../src/js/core/constants.js";
import { CONFIG } from "../src/js/core/config.js";
import { runtime } from "../src/js/core/preferences.js";
import { state } from "../src/js/core/state.js";
import { ColorPolicy } from "../src/js/render/color-policy.js";
import { Orb } from "../src/js/render/orb.js";
import {
  SPECTRAL_RING_VISUALIZER_ID,
  createSpectralRingVisualizer,
  createOrbVisualizer,
  createVisualizerRuntime,
  selectOrbAnalysis,
} from "../src/js/render/visualizer-runtime.js";

function frame(overrides = {}) {
  return {
    dtSec: 0.25,
    nowSec: 10,
    simPaused: false,
    analysisFrame: {
      ready: true,
      channels: {
        L: { waveform: Float32Array.from([0.1]), energy01: 0.1, bandEnergies01: [0.9, 0.2, 0.1] },
        R: { waveform: Float32Array.from([0.2]), energy01: 0.2, bandEnergies01: [0.1, 0.8, 0.2] },
        C: { waveform: Float32Array.from([0.3]), energy01: 0.3, bandEnergies01: [0.4, 0.4, 0.9] },
      },
      spectrum: { energies01: [0.4, 0.4, 0.9], dominantIndex: 2 },
    },
    ...overrides,
  };
}

function fakeOrb(id, overrides = {}) {
  return {
    id,
    chanId: "L",
    bandIds: [],
    startAngleRad: 0.5,
    angleRad: 1,
    trail: { particles: [] },
    step() {},
    resetPhase() { this.angleRad = this.startAngleRad; },
    resetTrail() {},
    ...overrides,
  };
}

function overlayHarness({ enabled = true, phaseMode = "free", speed = 2, orbs = [] } = {}) {
  return {
    settingsRef: { settings: { bands: { overlay: {
      enabled, phaseMode, ringSpeedRadPerSec: speed,
    } } } },
    stateRef: { bands: { ringPhaseRad: 1 }, orbs },
  };
}

test("current visualizers have stable identities and deterministic overlay-before-orb composition", () => {
  const order = [];
  const runtime = createVisualizerRuntime({
    createSpectralRing: () => ({
      id: SPECTRAL_RING_VISUALIZER_ID, type: "spectral-ring", isVisible: () => true,
      update: () => order.push("update:overlay"), render: () => order.push("render:overlay"),
      reset() {}, dispose() {},
    }),
    createOrb: (orb) => ({
      id: orb.id, type: "orb", orb, isVisible: () => true,
      update: () => order.push(`update:${orb.id}`), render: () => order.push(`render:${orb.id}`),
      reset() {}, dispose() {},
    }),
  });
  const orbs = [fakeOrb("ORB0"), fakeOrb("ORB1")];
  runtime.rebuild(orbs);
  assert.deepEqual(runtime.getVisualizers().map(({ id, type }) => ({ id, type })), [
    { id: SPECTRAL_RING_VISUALIZER_ID, type: "spectral-ring" },
    { id: "ORB0", type: "orb" },
    { id: "ORB1", type: "orb" },
  ]);
  runtime.update(frame());
  runtime.render({ clearFrame: () => order.push("clear") }, frame());
  assert.deepEqual(order, [
    "update:ORB0", "update:ORB1", "update:overlay",
    "clear", "render:overlay", "render:ORB0", "render:ORB1",
  ]);
});

test("Orb adapter consumes AnalysisFrame routing and preserves pause and selected-band semantics", () => {
  const calls = [];
  const orb = fakeOrb("ORB0", {
    chanId: "R",
    bandIds: [0, 1],
    step(...args) { calls.push(args); },
  });
  const visualizer = createOrbVisualizer(orb);
  assert.equal(visualizer.id, orb.id);
  assert.equal(visualizer.type, "orb");
  visualizer.update(frame({ simPaused: true }));
  assert.equal(calls.length, 0);
  const context = frame();
  visualizer.update(context);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2], context.analysisFrame.channels.R);
  assert.equal(calls[0][3], 0.45);
  assert.equal(calls[0][4], 2);
  assert.equal(calls[0][5], 1);
});

test("selected Orb analysis routes L/R/C spectra and preserves first-band tie semantics", () => {
  const context = frame();
  assert.deepEqual(selectOrbAnalysis(fakeOrb("left", { chanId: "L", bandIds: [0, 1] }), context.analysisFrame), {
    band: context.analysisFrame.channels.L,
    energyOverride01: 0.55,
    selectedDominantBandIndex: 0,
  });
  assert.deepEqual(selectOrbAnalysis(fakeOrb("right", { chanId: "R", bandIds: [0, 1] }), context.analysisFrame), {
    band: context.analysisFrame.channels.R,
    energyOverride01: 0.45,
    selectedDominantBandIndex: 1,
  });
  assert.deepEqual(selectOrbAnalysis(fakeOrb("center", { chanId: "C", bandIds: [0, 1] }), context.analysisFrame), {
    band: context.analysisFrame.channels.C,
    energyOverride01: 0.4,
    selectedDominantBandIndex: 0,
  });
  assert.deepEqual(selectOrbAnalysis(fakeOrb("full", { bandIds: [] }), context.analysisFrame), {
    band: context.analysisFrame.channels.L,
    energyOverride01: null,
    selectedDominantBandIndex: null,
  });
  context.analysisFrame.channels.L.bandEnergies01 = null;
  assert.equal(selectOrbAnalysis(fakeOrb("missing", { chanId: "L", bandIds: [0] }), context.analysisFrame).energyOverride01, 0);
});

test("ColorPolicy scopes only inherited dominant color to a selected target", () => {
  const oldSettings = runtime.settings;
  try {
    runtime.settings = structuredClone(CONFIG.defaults);
    runtime.settings.bands.particleColorSource = "dominant";
    const inherited = { colorSource: "inherit", hueOffsetDeg: 17 };
    const explicit = { colorSource: "dominant", hueOffsetDeg: 17 };
    assert.deepEqual(ColorPolicy.pickParticleColorRgb01(0, inherited, 200, 7), ColorPolicy.bandRgb01(7, 17));
    assert.deepEqual(ColorPolicy.pickParticleColorRgb01(0, explicit, 200, 7), ColorPolicy.bandRgb01(200, 17));
    assert.deepEqual(ColorPolicy.pickParticleColorRgb01(0, inherited, 200, null), ColorPolicy.bandRgb01(200, 17));

    runtime.settings.bands.particleColorSource = "fixed";
    assert.deepEqual(ColorPolicy.pickParticleColorRgb01(0, inherited, 200, 7), ColorPolicy.pickParticleColorRgb01(0, { colorSource: "fixed", hueOffsetDeg: 17 }, 200, 7));
    runtime.settings.bands.particleColorSource = "angle";
    assert.deepEqual(ColorPolicy.pickParticleColorRgb01(1, inherited, 200, 7), ColorPolicy.pickParticleColorRgb01(1, { colorSource: "angle", hueOffsetDeg: 17 }, 200, 7));
  } finally {
    runtime.settings = oldSettings;
  }
});

test("Orb visualizer passes selected dominant context through Orb.step into inherited particle color", () => {
  const oldSettings = runtime.settings;
  const oldSize = [state.widthPx, state.heightPx];
  try {
    runtime.settings = structuredClone(CONFIG.defaults);
    runtime.settings.bands.particleColorSource = "dominant";
    state.widthPx = state.heightPx = 1000;
    const def = structuredClone(CONFIG.defaults.orbs[0]);
    def.chanId = "L"; def.bandIds = [0, 1]; def.colorSource = "inherit"; def.hueOffsetDeg = 23;
    def.particles.emitPerSecond = 10;
    const orb = new Orb(def);
    const visualizer = createOrbVisualizer(orb);
    visualizer.update(frame());
    assert.equal(orb.trail.particles.length > 0, true);
    assert.deepEqual(orb.trail.particles.at(-1).rgbStart, ColorPolicy.bandRgb01(0, 23));
  } finally {
    runtime.settings = oldSettings;
    [state.widthPx, state.heightPx] = oldSize;
  }
});

test("Spectral Ring freezes free motion while paused and preserves current Orb lock", () => {
  const free = overlayHarness();
  const freeVisualizer = createSpectralRingVisualizer(free);
  freeVisualizer.update(frame({ simPaused: true }));
  assert.equal(free.stateRef.bands.ringPhaseRad, 1);

  const carrier = fakeOrb("ORB0", { angleRad: 2.25 });
  const locked = overlayHarness({ phaseMode: "orb", orbs: [carrier] });
  createSpectralRingVisualizer(locked).update(frame({ simPaused: true }));
  assert.equal(locked.stateRef.bands.ringPhaseRad, 2.25);

  const wrapped = overlayHarness({ speed: -20 });
  createSpectralRingVisualizer(wrapped).update(frame());
  assert.ok(wrapped.stateRef.bands.ringPhaseRad >= 0);
  assert.ok(wrapped.stateRef.bands.ringPhaseRad < TAU);
});

test("Spectral Ring enablement controls render without introducing separate state", () => {
  let draws = 0;
  let renderedFrame = null;
  const disabledHarness = overlayHarness({ enabled: false });
  const runtime = createVisualizerRuntime({
    createSpectralRing: () => createSpectralRingVisualizer(disabledHarness),
    createOrb: createOrbVisualizer,
  });
  runtime.rebuild([]);
  runtime.render({ clearFrame() {}, drawSpectralRing() { draws++; } }, frame());
  assert.equal(draws, 0);
  disabledHarness.settingsRef.settings.bands.overlay.enabled = true;
  const context = frame();
  runtime.render({ clearFrame() {}, drawSpectralRing(value) { draws++; renderedFrame = value; } }, context);
  assert.equal(draws, 1);
  assert.equal(renderedFrame, context.analysisFrame);
  assert.equal(renderedFrame.channels.C.waveform, context.analysisFrame.channels.C.waveform);
  assert.equal(renderedFrame.spectrum.energies01, context.analysisFrame.spectrum.energies01);
});

test("visuals and track resets retain their distinct phase and trail contracts", () => {
  let trailResets = 0;
  const orb = fakeOrb("ORB0", {
    startAngleRad: 0.75,
    angleRad: 2,
    resetTrail() { trailResets++; },
  });
  const harness = overlayHarness({ orbs: [orb] });
  const runtime = createVisualizerRuntime({
    createSpectralRing: () => createSpectralRingVisualizer(harness),
    createOrb: createOrbVisualizer,
  });
  runtime.rebuild([orb]);
  runtime.reset("track");
  assert.equal(trailResets, 1);
  assert.equal(orb.angleRad, 2);
  assert.equal(harness.stateRef.bands.ringPhaseRad, 1);
  runtime.reset("visuals");
  assert.equal(trailResets, 2);
  assert.equal(orb.angleRad, 0.75);
  assert.equal(harness.stateRef.bands.ringPhaseRad, 0);
  harness.settingsRef.settings.bands.overlay.phaseMode = "orb";
  harness.stateRef.bands.ringPhaseRad = 2;
  runtime.reset("visuals");
  assert.equal(harness.stateRef.bands.ringPhaseRad, 0.75);
});

test("rebuild disposes old participants exactly once and wraps only current Orb objects", () => {
  const disposed = [];
  const runtime = createVisualizerRuntime({
    createSpectralRing: () => ({
      id: "spectral-ring", type: "spectral-ring", isVisible: () => true,
      update() {}, render() {}, reset() {}, dispose() { disposed.push("overlay"); },
    }),
    createOrb: (orb) => ({
      id: orb.id, type: "orb", orb, isVisible: () => true,
      update() {}, render() {}, reset() {}, dispose() { disposed.push(orb); },
    }),
  });
  const oldOrb = fakeOrb("old");
  const currentOrb = fakeOrb("current");
  runtime.rebuild([oldOrb]);
  runtime.rebuild([currentOrb]);
  assert.deepEqual(disposed, ["overlay", oldOrb]);
  assert.equal(runtime.getVisualizers()[1].orb, currentOrb);
  assert.notEqual(runtime.getVisualizers()[1].orb, oldOrb);
});

test("reconcile retains surviving adapters, disposes removals once, and reorders by Orb order", () => {
  const disposed = [];
  const created = [];
  const runtime = createVisualizerRuntime({
    createSpectralRing: () => ({ id: SPECTRAL_RING_VISUALIZER_ID, type: "spectral-ring", isVisible: () => true, update() {}, render() {}, reset() {}, dispose() { disposed.push("overlay"); } }),
    createOrb: (orb) => {
      const adapter = { id: orb.id, type: "orb", orb, isVisible: () => true, update() {}, render() {}, reset() {}, dispose() { disposed.push(orb.id); } };
      created.push(adapter);
      return adapter;
    },
  });
  const [a, b, c] = [fakeOrb("A"), fakeOrb("B"), fakeOrb("C")];
  runtime.rebuild([a, b, c]);
  const [, aa, ba, ca] = runtime.getVisualizers();
  const d = fakeOrb("D");
  runtime.reconcile([a, d, c]);
  assert.equal(runtime.getVisualizers()[1], aa);
  assert.equal(runtime.getVisualizers()[3], ca);
  assert.deepEqual(disposed, ["B"]);
  runtime.reconcile([c, a, d]);
  assert.deepEqual(runtime.getVisualizers().slice(1).map((v) => v.orb), [c, a, d]);
  assert.equal(runtime.getVisualizers()[1], ca);
  assert.equal(runtime.getVisualizers()[2], aa);
  assert.deepEqual(disposed, ["B"]);
  assert.equal(created.includes(ba), true);
});

test("zero-Orb orb-locked Spectral Ring remains stable and resets safely", () => {
  const harness = overlayHarness({ phaseMode: "orb", orbs: [] });
  const visualizer = createSpectralRingVisualizer(harness);
  visualizer.update(frame());
  assert.equal(harness.stateRef.bands.ringPhaseRad, 1);
  visualizer.reset("visuals");
  assert.equal(harness.stateRef.bands.ringPhaseRad, 0);
});

for (const [chanId, expected] of [['L', .9], ['R', .1], ['C', .5]]) {
  test(`AUD-003: mixed targets analyze only active ${chanId} bands`, () => {
    const analysis = frame().analysisFrame; analysis.channels.C.bandEnergies01[0] = .5;
    const before = structuredClone(analysis);
    const mixed = selectOrbAnalysis({ chanId, bandIds: [0, 255] }, analysis);
    assert.equal(mixed.energyOverride01, expected); assert.equal(mixed.selectedDominantBandIndex, 0);
    assert.equal(mixed.band, analysis.channels[chanId]); assert.deepEqual(analysis, before);
    const inactive = selectOrbAnalysis({ chanId, bandIds: [255] }, analysis);
    assert.equal(inactive.energyOverride01, 0); assert.equal(inactive.selectedDominantBandIndex, null);
    const empty = selectOrbAnalysis({ chanId, bandIds: [] }, analysis);
    assert.equal(empty.energyOverride01, null); assert.equal(empty.selectedDominantBandIndex, null);
    assert.equal(empty.band.energy01, analysis.channels[chanId].energy01);
  });
}

test('AUD-003: selected dominant excludes inactive indices and preserves first active tie', () => {
  const analysis = frame().analysisFrame; analysis.channels.C.bandEnergies01 = [.5, .5, .5];
  for (const [targets, dominant] of [[[255], null], [[255, 2, 0], 2], [[255, 0, 2], 0], [[100, 255], null]]) {
    const selection = selectOrbAnalysis({ chanId: 'C', bandIds: targets }, analysis);
    assert.equal(selection.selectedDominantBandIndex, dominant);
    assert.equal(selection.energyOverride01, dominant === null ? 0 : .5);
  }
});

test('AUD-003: active bank edges and each actual channel array bound targeting independently', () => {
  const analysis = frame().analysisFrame;
  analysis.spectrum.lowHz = [0, 10]; analysis.spectrum.highHz = [10, 20];
  assert.equal(selectOrbAnalysis({ bandIds: [2], chanId: 'C' }, analysis).energyOverride01, 0);
  assert.equal(selectOrbAnalysis({ bandIds: [2], chanId: 'C' }, analysis).selectedDominantBandIndex, null);
  analysis.channels.L.bandEnergies01 = [.9];
  assert.equal(selectOrbAnalysis({ bandIds: [0, 1], chanId: 'L' }, analysis).energyOverride01, .9);
  assert.equal(selectOrbAnalysis({ bandIds: [0, 1], chanId: 'R' }, analysis).energyOverride01, .45);
});

test('AUD-003: malformed targets, missing arrays and nonfinite energies yield finite bounded analysis', () => {
  const analysis = frame().analysisFrame;
  analysis.channels.C.bandEnergies01 = [NaN, Infinity, -Infinity, -2, 3, '0.5'];
  for (const [ids, expected, dominant] of [
    [[null, false, '0', 1.5, -1, 256, NaN, Infinity], 0, null],
    [[0, 1, 2], 0, 0], [[3, 4, 5], 1 / 3, 4],
  ]) {
    const selected = selectOrbAnalysis({ chanId: 'C', bandIds: ids }, analysis);
    assert.equal(selected.energyOverride01, expected); assert.equal(selected.selectedDominantBandIndex, dominant);
  }
  for (const energies of [null, undefined, [], { length: NaN }]) {
    analysis.channels.C.bandEnergies01 = energies;
    assert.equal(selectOrbAnalysis({ chanId: 'C', bandIds: [0] }, analysis).energyOverride01, 0);
    assert.equal(selectOrbAnalysis({ chanId: 'C', bandIds: [0] }, analysis).selectedDominantBandIndex, null);
  }
  assert.equal(selectOrbAnalysis({ bandIds: [0] }, null).energyOverride01, 0);
});

test('AUD-003: inherited target color uses active dominant; all-inactive keeps established global fallback', () => {
  const previous = runtime.settings; runtime.settings = structuredClone(CONFIG.defaults); runtime.settings.bands.count = 3;
  runtime.settings.bands.particleColorSource = 'dominant';
  try {
    const analysis = frame().analysisFrame, inherited = { chanId: 'L', bandIds: [0, 255], colorSource: 'inherit', hueOffsetDeg: 17 };
    const active = selectOrbAnalysis(inherited, analysis);
    assert.deepEqual(ColorPolicy.pickParticleColorRgb01(0, inherited, 2, active.selectedDominantBandIndex), ColorPolicy.bandRgb01(0, 17));
    assert.deepEqual(ColorPolicy.pickParticleColorRgb01(0, { ...inherited, colorSource: 'dominant' }, 2, active.selectedDominantBandIndex), ColorPolicy.bandRgb01(2, 17));
    inherited.bandIds = [255]; const inactive = selectOrbAnalysis(inherited, analysis);
    assert.equal(inactive.selectedDominantBandIndex, null);
    assert.deepEqual(ColorPolicy.pickParticleColorRgb01(0, inherited, 2, inactive.selectedDominantBandIndex), ColorPolicy.bandRgb01(2, 17));
  } finally { runtime.settings = previous; }
});
