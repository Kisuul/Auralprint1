import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { rename, rm } from "node:fs/promises";

import { normalizeOrbDef } from "../src/js/core/preferences.js";
import { AudioEngine } from "../src/js/audio/audio-engine.js";
import { Scrubber, buildWaveformPeaks } from "../src/js/audio/scrubber.js";
import { paths } from "../scripts/build.mjs";
import { prepareWatchBuild } from "../scripts/watch.mjs";

function createAudioBuffer(channels) {
  return {
    numberOfChannels: channels.length,
    getChannelData(index) {
      return Float32Array.from(channels[index]);
    },
  };
}

function createScrubberHarness() {
  const canvasListeners = new Map();
  const windowListeners = new Map();
  const scrubberTime = { textContent: "" };
  const ctx2d = {
    clearRect() {},
    fillRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    save() {},
    restore() {},
    rect() {},
    clip() {},
    arc() {},
    fill() {},
  };
  const canvas = {
    clientWidth: 160,
    clientHeight: 32,
    width: 0,
    height: 0,
    getContext() {
      return ctx2d;
    },
    addEventListener(type, handler) {
      canvasListeners.set(type, handler);
    },
    getBoundingClientRect() {
      return { left: 10, width: 100 };
    },
  };

  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;

  globalThis.window = {
    addEventListener(type, handler) {
      windowListeners.set(type, handler);
    },
  };
  globalThis.document = {
    getElementById(id) {
      return id === "scrubberTime" ? scrubberTime : null;
    },
  };

  return {
    canvas,
    canvasListeners,
    windowListeners,
    restore() {
      globalThis.window = previousWindow;
      globalThis.document = previousDocument;
    },
  };
}

test("normalizeOrbDef preserves fallback routing when chanId and bandIds are omitted", () => {
  const fallback = {
    id: "ORB0",
    chanId: "R",
    bandIds: [4, 5],
    chirality: -1,
    startAngleRad: Math.PI,
  };

  const normalized = normalizeOrbDef({ id: "legacy" }, fallback);

  assert.equal(normalized.chanId, "R");
  assert.deepEqual(normalized.bandIds, [4, 5]);
});

test("normalizeOrbDef still honors explicit incoming routing and band selections", () => {
  const fallback = {
    id: "ORB1",
    chanId: "L",
    bandIds: [1, 2],
    chirality: -1,
    startAngleRad: 0,
  };

  const normalized = normalizeOrbDef({
    id: "custom",
    chanId: "C",
    bandIds: [],
  }, fallback);

  assert.equal(normalized.chanId, "C");
  assert.deepEqual(normalized.bandIds, []);
});

test("buildWaveformPeaks keeps mono peak behavior unchanged", () => {
  const peaks = buildWaveformPeaks(createAudioBuffer([
    [0, 0.5, -0.5, 0],
  ]), 2);

  assert.deepEqual(Array.from(peaks), [0.5, 0.5]);
});

test("buildWaveformPeaks includes non-silent right-channel data", () => {
  const peaks = buildWaveformPeaks(createAudioBuffer([
    [0, 0, 0, 0],
    [0, 0.75, 0, 0],
  ]), 2);

  assert.equal(peaks[0], 0.75);
  assert.equal(peaks[1], 0);
});

test("scrubber touchmove does not cancel window scrolling outside an active drag", () => {
  const harness = createScrubberHarness();
  const originalGetMediaEl = AudioEngine.getMediaEl;
  const mediaEl = { duration: 100, currentTime: 0 };

  try {
    AudioEngine.getMediaEl = () => mediaEl;
    Scrubber.init(harness.canvas);

    let prevented = false;
    harness.windowListeners.get("touchmove")({
      touches: [{ clientX: 70 }],
      preventDefault() { prevented = true; },
    });

    assert.equal(prevented, false);
    assert.equal(mediaEl.currentTime, 0);
  } finally {
    AudioEngine.getMediaEl = originalGetMediaEl;
    harness.restore();
  }
});

test("scrubber active touch drag still prevents default and seeks", () => {
  const harness = createScrubberHarness();
  const originalGetMediaEl = AudioEngine.getMediaEl;
  const mediaEl = { duration: 100, currentTime: 0 };

  try {
    AudioEngine.getMediaEl = () => mediaEl;
    Scrubber.init(harness.canvas);

    let startPrevented = false;
    harness.canvasListeners.get("touchstart")({
      touches: [{ clientX: 60 }],
      preventDefault() { startPrevented = true; },
    });

    let movePrevented = false;
    harness.windowListeners.get("touchmove")({
      touches: [{ clientX: 90 }],
      preventDefault() { movePrevented = true; },
    });
    harness.windowListeners.get("touchend")({});

    assert.equal(startPrevented, true);
    assert.equal(movePrevented, true);
    assert.equal(mediaEl.currentTime, 80);
  } finally {
    AudioEngine.getMediaEl = originalGetMediaEl;
    harness.restore();
  }
});

test("prepareWatchBuild creates clean build output directories", async () => {
  const targets = [paths.buildDir, paths.distDir];
  const renamed = [];

  for (const target of targets) {
    if (!existsSync(target)) continue;
    const backup = `${target}.bak-test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await rename(target, backup);
    renamed.push({ target, backup });
  }

  try {
    for (const target of targets) assert.equal(existsSync(target), false);

    await prepareWatchBuild();

    for (const target of targets) assert.equal(existsSync(target), true);
    assert.equal(existsSync(paths.buildDir), true);
    assert.equal(existsSync(paths.distDir), true);
  } finally {
    for (const target of targets) {
      if (existsSync(target)) await rm(target, { recursive: true, force: true });
    }
    for (const entry of renamed.reverse()) {
      await rename(entry.backup, entry.target);
    }
  }
});
