import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { rename, rm } from "node:fs/promises";

import { normalizeOrbDef } from "../src/js/core/preferences.js";
import { state } from "../src/js/core/state.js";
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

function createAudioEngineHarness() {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousURL = globalThis.URL;
  const previousAudioState = { ...state.audio };
  const revokedUrls = [];

  function createNode(extra = {}) {
    return {
      connect() {},
      disconnect() {},
      ...extra,
    };
  }

  const audioEl = {
    preload: "",
    src: "",
    paused: true,
    currentTime: 0,
    error: null,
    releaseCalls: {
      pause: 0,
      removeSrc: 0,
      load: 0,
    },
    listeners: new Map(),
    addEventListener(type, handler, options = {}) {
      const entries = this.listeners.get(type) || [];
      entries.push({ handler, once: !!options.once });
      this.listeners.set(type, entries);
    },
    dispatch(type) {
      const entries = [...(this.listeners.get(type) || [])];
      const kept = [];
      for (const entry of entries) {
        entry.handler();
        if (!entry.once) kept.push(entry);
      }
      this.listeners.set(type, kept);
    },
    pause() {
      this.releaseCalls.pause += 1;
      this.paused = true;
      this.dispatch("pause");
    },
    play() {
      this.paused = false;
      this.dispatch("play");
      return Promise.resolve();
    },
    removeAttribute(name) {
      if (name === "src") {
        this.releaseCalls.removeSrc += 1;
        this.src = "";
      }
    },
    load() {
      this.releaseCalls.load += 1;
    },
  };

  class FakeAudioContext {
    constructor() {
      this.sampleRate = 48000;
      this.state = "running";
      this.destination = createNode();
    }
    resume() {
      this.state = "running";
      return Promise.resolve();
    }
    createMediaElementSource(mediaElement) {
      return createNode({ mediaElement });
    }
    createMediaStreamSource(mediaStream) {
      return createNode({ mediaStream });
    }
    createGain() {
      return createNode({ gain: { value: 1 } });
    }
    createChannelSplitter() {
      return createNode();
    }
    createAnalyser() {
      return createNode({
        fftSize: 2048,
        smoothingTimeConstant: 0,
        frequencyBinCount: 1024,
        getFloatTimeDomainData(buffer) { buffer.fill(0); },
        getFloatFrequencyData(buffer) { buffer.fill(-100); },
      });
    }
    createMediaStreamDestination() {
      return createNode({
        stream: {
          getTracks() { return []; },
        },
      });
    }
  }

  globalThis.window = { AudioContext: FakeAudioContext };
  globalThis.document = {
    createElement(tag) {
      if (tag !== "audio") throw new Error(`Unexpected element request: ${tag}`);
      return audioEl;
    },
  };
  globalThis.URL = {
    createObjectURL() {
      return "blob:test-audio";
    },
    revokeObjectURL(url) {
      revokedUrls.push(url);
    },
  };

  return {
    audioEl,
    revokedUrls,
    restore() {
      try { AudioEngine.unload(); } catch {}
      state.audio.isLoaded = previousAudioState.isLoaded;
      state.audio.isPlaying = previousAudioState.isPlaying;
      state.audio.filename = previousAudioState.filename;
      state.audio.transportError = previousAudioState.transportError;
      globalThis.window = previousWindow;
      globalThis.document = previousDocument;
      globalThis.URL = previousURL;
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

test("AudioEngine.loadFile does not tear down the freshly created media element during attach", async () => {
  const harness = createAudioEngineHarness();

  try {
    const ok = await AudioEngine.loadFile({ name: "demo.wav" }, null, { autoPlay: false });

    assert.equal(ok, true);
    assert.equal(harness.audioEl.releaseCalls.pause, 0);
    assert.equal(harness.audioEl.releaseCalls.removeSrc, 0);
    assert.equal(harness.audioEl.releaseCalls.load, 0);
    assert.deepEqual(harness.revokedUrls, []);
    assert.equal(AudioEngine.getMediaEl(), harness.audioEl);
    assert.equal(state.audio.isLoaded, true);
    assert.equal(state.audio.filename, "demo.wav");
  } finally {
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
