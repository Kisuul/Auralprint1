import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { rename, rm } from "node:fs/promises";

import { normalizeOrbDef } from "../src/js/core/preferences.js";
import { state } from "../src/js/core/state.js";
import { AudioEngine } from "../src/js/audio/audio-engine.js";
import { InputSourceManager } from "../src/js/audio/input-source-manager.js";
import { Scrubber, buildWaveformPeaks } from "../src/js/audio/scrubber.js";
import { RecorderEngine } from "../src/js/recording/recorder-engine.js";
import { UI, readSourceUiModel, shouldShowActiveQueueItem } from "../src/js/ui/ui.js";
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
    scrubberTime,
    windowListeners,
    restore() {
      globalThis.window = previousWindow;
      globalThis.document = previousDocument;
    },
  };
}

function snapshotSourceAndAudioState() {
  return {
    source: JSON.parse(JSON.stringify(state.source)),
    audio: { ...state.audio },
  };
}

function applySourceAndAudioState(snapshot) {
  state.source.kind = snapshot.source.kind;
  state.source.status = snapshot.source.status;
  state.source.label = snapshot.source.label;
  state.source.permission.mic = snapshot.source.permission.mic;
  state.source.permission.stream = snapshot.source.permission.stream;
  state.source.support.mic = snapshot.source.support.mic;
  state.source.support.stream = snapshot.source.support.stream;
  state.source.errorCode = snapshot.source.errorCode;
  state.source.errorMessage = snapshot.source.errorMessage;
  state.source.sessionActive = snapshot.source.sessionActive;
  state.source.streamMeta.hasAudio = snapshot.source.streamMeta.hasAudio;
  state.source.streamMeta.hasVideo = snapshot.source.streamMeta.hasVideo;
  state.audio.isLoaded = snapshot.audio.isLoaded;
  state.audio.isPlaying = snapshot.audio.isPlaying;
  state.audio.filename = snapshot.audio.filename;
  state.audio.transportError = snapshot.audio.transportError;
}

function renderScrubberTimeText({ sourceState = {}, audioState = {}, mediaEl = null } = {}) {
  const harness = createScrubberHarness();
  const previousGetMediaEl = AudioEngine.getMediaEl;
  const snapshot = snapshotSourceAndAudioState();

  try {
    const nextSource = {
      ...snapshot.source,
      ...sourceState,
      permission: {
        ...snapshot.source.permission,
        ...(sourceState.permission || {}),
      },
      support: {
        ...snapshot.source.support,
        ...(sourceState.support || {}),
      },
      streamMeta: {
        ...snapshot.source.streamMeta,
        ...(sourceState.streamMeta || {}),
      },
    };
    const nextAudio = {
      ...snapshot.audio,
      ...audioState,
    };

    applySourceAndAudioState({
      source: nextSource,
      audio: nextAudio,
    });

    AudioEngine.getMediaEl = () => mediaEl;
    Scrubber.init(harness.canvas);
    Scrubber.reset();

    return harness.scrubberTime.textContent;
  } finally {
    AudioEngine.getMediaEl = previousGetMediaEl;
    applySourceAndAudioState(snapshot);
    harness.restore();
  }
}

function createAudioEngineHarness() {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousURL = globalThis.URL;
  const previousAudioState = { ...state.audio };
  const revokedUrls = [];
  const connectionLog = [];
  let destinationNode = null;

  function createNode(extra = {}) {
    const node = {
      connections: [],
      connect(target) {
        this.connections.push(target);
        connectionLog.push({ from: this, to: target });
      },
      disconnect() {
        this.connections = [];
      },
      ...extra,
    };
    return node;
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
      this.destination = createNode({ kind: "destination" });
      destinationNode = this.destination;
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
    connectionLog,
    get destinationNode() {
      return destinationNode;
    },
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

function createRecorderHarness() {
  const previousWindow = globalThis.window;
  const previousMediaStream = globalThis.MediaStream;
  const previousMediaRecorder = globalThis.MediaRecorder;
  const previousSource = JSON.parse(JSON.stringify(state.source));
  const previousAudio = { ...state.audio };
  const previousRecording = JSON.parse(JSON.stringify(state.recording));
  const previousUi = { ...state.ui };
  const mediaRecorders = [];

  const videoTrack = { kind: "video", stop() {} };
  const audioTrack = { kind: "audio", stop() {} };

  class FakeMediaStream {
    constructor() {
      this._tracks = [];
    }
    addTrack(track) {
      this._tracks.push(track);
    }
    getTracks() {
      return this._tracks.slice();
    }
    getVideoTracks() {
      return this._tracks.filter((track) => track.kind === "video");
    }
    getAudioTracks() {
      return this._tracks.filter((track) => track.kind === "audio");
    }
  }

  class FakeMediaRecorder {
    static isTypeSupported() {
      return true;
    }
    constructor(stream, options) {
      this.stream = stream;
      this.options = options;
      this.state = "inactive";
      this.ondataavailable = null;
      this.onstop = null;
      this.onerror = null;
      mediaRecorders.push(this);
    }
    start() {
      this.state = "recording";
    }
  }

  globalThis.MediaStream = FakeMediaStream;
  globalThis.MediaRecorder = FakeMediaRecorder;
  globalThis.window = {
    ...(previousWindow || {}),
    MediaRecorder: FakeMediaRecorder,
  };

  const renderStream = new FakeMediaStream();
  renderStream.addTrack(videoTrack);
  const audioStream = new FakeMediaStream();
  audioStream.addTrack(audioTrack);
  const renderCanvas = {
    captureStream() {
      return renderStream;
    },
  };
  const audioTap = {
    supportsStreamDestination: true,
    ensureStream() {
      return audioStream;
    },
    releaseStream() {},
  };

  state.audio.isLoaded = false;
  state.audio.isPlaying = false;
  state.audio.filename = "";
  state.audio.transportError = "";
  state.source.kind = "mic";
  state.source.status = "active";
  state.source.label = "Desk Mic";
  state.source.sessionActive = true;
  state.source.permission.mic = "granted";
  state.source.streamMeta.hasAudio = true;
  state.source.streamMeta.hasVideo = false;

  RecorderEngine.init({
    stateRef: state.recording,
    getRenderTap: () => ({ canvas: renderCanvas }),
    getAudioTap: () => audioTap,
    nowMs: () => 0,
  });

  return {
    mediaRecorders,
    renderStream,
    audioStream,
    videoTrack,
    audioTrack,
    restore() {
      try { RecorderEngine.dispose(); } catch {}
      state.source.kind = previousSource.kind;
      state.source.status = previousSource.status;
      state.source.label = previousSource.label;
      state.source.permission.mic = previousSource.permission.mic;
      state.source.permission.stream = previousSource.permission.stream;
      state.source.support.mic = previousSource.support.mic;
      state.source.support.stream = previousSource.support.stream;
      state.source.errorCode = previousSource.errorCode;
      state.source.errorMessage = previousSource.errorMessage;
      state.source.sessionActive = previousSource.sessionActive;
      state.source.streamMeta.hasAudio = previousSource.streamMeta.hasAudio;
      state.source.streamMeta.hasVideo = previousSource.streamMeta.hasVideo;
      state.audio.isLoaded = previousAudio.isLoaded;
      state.audio.isPlaying = previousAudio.isPlaying;
      state.audio.filename = previousAudio.filename;
      state.audio.transportError = previousAudio.transportError;
      Object.assign(state.recording, previousRecording);
      Object.assign(state.ui, previousUi);
      globalThis.window = previousWindow;
      globalThis.MediaStream = previousMediaStream;
      globalThis.MediaRecorder = previousMediaRecorder;
    },
  };
}

function createStubUiElement(tagName = "div") {
  const listeners = new Map();
  const attributes = new Map();
  const classes = new Set();

  return {
    tagName: String(tagName).toUpperCase(),
    style: { display: "block" },
    dataset: {},
    children: [],
    options: [],
    hidden: false,
    disabled: false,
    checked: false,
    title: "",
    value: "",
    textContent: "",
    innerHTML: "",
    tabIndex: 0,
    addEventListener(type, handler) {
      const entries = listeners.get(type) || [];
      entries.push(handler);
      listeners.set(type, entries);
    },
    removeEventListener(type, handler) {
      const entries = listeners.get(type) || [];
      listeners.set(type, entries.filter((entry) => entry !== handler));
    },
    dispatch(type, event = {}) {
      const entries = listeners.get(type) || [];
      for (const handler of entries) {
        handler({
          preventDefault() {},
          stopPropagation() {},
          target: this,
          currentTarget: this,
          ...event,
        });
      }
    },
    click() {
      if (this.disabled) return;
      this.dispatch("click");
    },
    appendChild(child) {
      this.children.push(child);
      if (child && child.tagName === "OPTION") this.options.push(child);
      return child;
    },
    remove() {},
    focus() {},
    contains() {
      return false;
    },
    closest() {
      return null;
    },
    querySelector() {
      return null;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    classList: {
      add(...names) {
        for (const name of names) classes.add(name);
      },
      remove(...names) {
        for (const name of names) classes.delete(name);
      },
      toggle(name, force) {
        if (force === true) {
          classes.add(name);
          return true;
        }
        if (force === false) {
          classes.delete(name);
          return false;
        }
        if (classes.has(name)) {
          classes.delete(name);
          return false;
        }
        classes.add(name);
        return true;
      },
      contains(name) {
        return classes.has(name);
      },
    },
  };
}

function createUiWireHarness() {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousUi = { ...state.ui };
  const previousCanvas = state.canvas;
  const elements = new Map();

  function getElement(id) {
    if (!elements.has(id)) elements.set(id, createStubUiElement(id === "fileInput" ? "input" : "div"));
    return elements.get(id);
  }

  globalThis.window = {
    ...(previousWindow || {}),
    addEventListener() {},
  };
  globalThis.document = {
    activeElement: null,
    getElementById(id) {
      return getElement(id);
    },
    createElement(tag) {
      return createStubUiElement(tag);
    },
    querySelectorAll() {
      return [];
    },
  };
  state.canvas = createStubUiElement("canvas");

  return {
    getElement,
    restore() {
      Object.assign(state.ui, previousUi);
      state.canvas = previousCanvas;
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

test("Scrubber.draw keeps the Build 113 idle file copy when no source is active", () => {
  const text = renderScrubberTimeText({
    sourceState: {
      kind: "none",
      status: "idle",
      label: "",
      errorCode: "",
      errorMessage: "",
      sessionActive: false,
      streamMeta: { hasAudio: false, hasVideo: false },
    },
    audioState: {
      isLoaded: false,
      isPlaying: false,
      filename: "",
      transportError: "",
    },
  });

  assert.equal(text, "--:-- / --:-- • no track loaded");
});

test("Scrubber.draw uses honest microphone copy instead of fake track text", () => {
  assert.equal(renderScrubberTimeText({
    sourceState: {
      kind: "mic",
      status: "requesting",
      label: "Desk Mic",
      errorCode: "",
      errorMessage: "",
      sessionActive: false,
      streamMeta: { hasAudio: false, hasVideo: false },
    },
    audioState: {
      isLoaded: false,
      isPlaying: false,
      filename: "",
      transportError: "",
    },
  }), "Waiting for microphone permission.");

  assert.equal(renderScrubberTimeText({
    sourceState: {
      kind: "mic",
      status: "active",
      label: "Desk Mic",
      errorCode: "",
      errorMessage: "",
      sessionActive: true,
      streamMeta: { hasAudio: true, hasVideo: false },
    },
    audioState: {
      isLoaded: false,
      isPlaying: false,
      filename: "",
      transportError: "",
    },
  }), "Microphone input active • live input");

  assert.equal(renderScrubberTimeText({
    sourceState: {
      kind: "mic",
      status: "error",
      label: "Desk Mic",
      errorCode: "mic-denied",
      errorMessage: "Microphone permission denied.",
      sessionActive: false,
      streamMeta: { hasAudio: false, hasVideo: false },
    },
    audioState: {
      isLoaded: false,
      isPlaying: false,
      filename: "",
      transportError: "",
    },
  }), "Microphone permission denied.");

  assert.equal(renderScrubberTimeText({
    sourceState: {
      kind: "mic",
      status: "unsupported",
      label: "",
      errorCode: "mic-unsupported",
      errorMessage: "",
      sessionActive: false,
      streamMeta: { hasAudio: false, hasVideo: false },
    },
    audioState: {
      isLoaded: false,
      isPlaying: false,
      filename: "",
      transportError: "",
    },
  }), "Microphone input is unavailable.");
});

test("Scrubber.draw uses honest stream copy instead of fake track text", () => {
  assert.equal(renderScrubberTimeText({
    sourceState: {
      kind: "stream",
      status: "requesting",
      label: "Browser Tab",
      errorCode: "",
      errorMessage: "",
      sessionActive: false,
      streamMeta: { hasAudio: false, hasVideo: true },
    },
    audioState: {
      isLoaded: false,
      isPlaying: false,
      filename: "",
      transportError: "",
    },
  }), "Waiting for stream share permission.");

  assert.equal(renderScrubberTimeText({
    sourceState: {
      kind: "stream",
      status: "active",
      label: "Browser Tab",
      errorCode: "",
      errorMessage: "",
      sessionActive: true,
      streamMeta: { hasAudio: true, hasVideo: true },
    },
    audioState: {
      isLoaded: false,
      isPlaying: false,
      filename: "",
      transportError: "",
    },
  }), "Stream input active • live input");

  assert.equal(renderScrubberTimeText({
    sourceState: {
      kind: "stream",
      status: "error",
      label: "Browser Tab",
      errorCode: "stream-ended",
      errorMessage: "Shared stream ended. Select Stream to share again.",
      sessionActive: false,
      streamMeta: { hasAudio: false, hasVideo: false },
    },
    audioState: {
      isLoaded: false,
      isPlaying: false,
      filename: "",
      transportError: "",
    },
  }), "Shared stream ended. Select Stream to share again.");

  assert.equal(renderScrubberTimeText({
    sourceState: {
      kind: "stream",
      status: "unsupported",
      label: "",
      errorCode: "stream-unsupported",
      errorMessage: "",
      sessionActive: false,
      streamMeta: { hasAudio: false, hasVideo: false },
    },
    audioState: {
      isLoaded: false,
      isPlaying: false,
      filename: "",
      transportError: "",
    },
  }), "Stream input is unavailable.");
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

test("AudioEngine.getRecorderTap reuses active live-stream audio without local playback or lifecycle ownership", async () => {
  const harness = createAudioEngineHarness();
  const liveAudioTrack = {
    kind: "audio",
    stopCount: 0,
    stop() {
      this.stopCount += 1;
    },
  };
  const liveStream = {
    getTracks() {
      return [liveAudioTrack];
    },
    getAudioTracks() {
      return [liveAudioTrack];
    },
    getVideoTracks() {
      return [];
    },
  };

  try {
    await AudioEngine.attachMediaStreamSource(liveStream, {
      kind: "stream",
      label: "Browser Tab",
      monitorOutput: false,
    });

    const tap = AudioEngine.getRecorderTap();
    assert.equal(tap.ensureStream(), liveStream);
    assert.equal(
      harness.connectionLog.some((entry) => entry.to === harness.destinationNode),
      false
    );

    tap.releaseStream();
    assert.equal(liveAudioTrack.stopCount, 0);
  } finally {
    harness.restore();
  }
});

test("readSourceUiModel keeps microphone mode honest about file-only affordances", () => {
  const model = readSourceUiModel({
    sourceState: {
      kind: "mic",
      status: "active",
      label: "Podcast Mic",
      errorMessage: "",
    },
    audioState: {
      isLoaded: false,
      isPlaying: false,
      filename: "should-not-show.wav",
      transportError: "",
    },
    queueLength: 3,
    currentIndex: 1,
    bandText: "mono-ish (L≈R)",
    recordingStatusText: "Recording available.",
  });

  assert.deepEqual(model.pressedSources, {
    file: false,
    mic: true,
    stream: false,
  });
  assert.equal(model.disableFileControls, true);
  assert.equal(model.audioPanelSourceMode, "mic");
  assert.match(model.audioStatusText, /Microphone input active - Podcast Mic/);
  assert.doesNotMatch(model.audioStatusText, /should-not-show\.wav/);
  assert.equal(shouldShowActiveQueueItem({ kind: "mic" }, { isLoaded: false }, { active: true }), false);
});

test("readSourceUiModel keeps stream mode honest about live-source affordances", () => {
  const model = readSourceUiModel({
    sourceState: {
      kind: "stream",
      status: "active",
      label: "Browser Tab",
      errorMessage: "",
    },
    audioState: {
      isLoaded: false,
      isPlaying: false,
      filename: "should-not-show.wav",
      transportError: "",
    },
    queueLength: 4,
    currentIndex: 2,
    bandText: "stereo (L!=R)",
    recordingStatusText: "Recording available.",
  });

  assert.deepEqual(model.pressedSources, {
    file: false,
    mic: false,
    stream: true,
  });
  assert.equal(model.disableFileControls, true);
  assert.equal(model.audioPanelSourceMode, "stream");
  assert.match(model.audioStatusText, /Stream input active - Browser Tab - Bands: stereo \(L!=R\)/);
  assert.doesNotMatch(model.audioStatusText, /should-not-show\.wav/);
  assert.equal(shouldShowActiveQueueItem({ kind: "stream" }, { isLoaded: false }, { active: true }), false);
});

test("readSourceUiModel treats File as the idle workflow side without implying an active file source", () => {
  const model = readSourceUiModel({
    sourceState: {
      kind: "none",
      status: "idle",
      label: "",
      errorMessage: "",
    },
    audioState: {
      isLoaded: false,
      isPlaying: false,
      filename: "queued-track.wav",
      transportError: "",
    },
    queueLength: 2,
    currentIndex: 0,
  });

  assert.deepEqual(model.pressedSources, {
    file: true,
    mic: false,
    stream: false,
  });
  assert.equal(model.disableFileControls, false);
  assert.equal(model.audioPanelSourceMode, "file");
  assert.equal(model.showActiveQueueItem, false);
  assert.equal(model.audioStatusText, "No audio loaded.");
  assert.equal(shouldShowActiveQueueItem({ kind: "none" }, { isLoaded: false }, { active: true }), false);
});

test("UI blocks live-source switching during active recording without touching the active source session", async () => {
  const harness = createUiWireHarness();
  const previous = {
    source: JSON.parse(JSON.stringify(state.source)),
    audio: { ...state.audio },
    recording: JSON.parse(JSON.stringify(state.recording)),
    ui: { ...state.ui },
  };
  const originalActivateMic = InputSourceManager.activateMic;
  const originalActivateStream = InputSourceManager.activateStream;
  const originalTeardownActiveSource = InputSourceManager.teardownActiveSource;
  let activateMicCalls = 0;
  let activateStreamCalls = 0;
  let teardownCalls = 0;

  InputSourceManager.activateMic = async () => {
    activateMicCalls += 1;
    return { ok: true };
  };
  InputSourceManager.activateStream = async () => {
    activateStreamCalls += 1;
    return { ok: true };
  };
  InputSourceManager.teardownActiveSource = async () => {
    teardownCalls += 1;
    return { ok: true };
  };

  try {
    state.audio.isLoaded = false;
    state.audio.isPlaying = false;
    state.audio.filename = "";
    state.audio.transportError = "";
    state.source.kind = "stream";
    state.source.status = "active";
    state.source.label = "Browser Tab";
    state.source.sessionActive = true;
    state.source.support.stream = true;
    state.source.support.mic = true;
    state.source.permission.stream = "granted";
    state.source.streamMeta.hasAudio = true;
    state.source.streamMeta.hasVideo = true;
    state.recording.hooksEnabled = true;
    state.recording.phase = "recording";
    state.recording.isSupported = true;
    state.recording.includePlaybackAudio = true;
    state.recording.lastUpdatedAtMs = 7;

    UI.wireControls();
    UI.refreshRecordingUi();

    const model = readSourceUiModel({
      sourceState: state.source,
      audioState: state.audio,
      recordingState: state.recording,
    });

    assert.equal(model.sourceSwitchLocked, true);
    assert.equal(state.ui.btnSourceFile.disabled, true);
    assert.equal(state.ui.btnSourceMic.disabled, true);
    assert.equal(state.ui.btnSourceStream.disabled, true);
    assert.match(state.ui.btnSourceMic.title, /Source changes are unavailable/);

    assert.equal(await UI.dispatchSourceSwitchAction("mic"), false);
    assert.equal(await UI.dispatchSourceSwitchAction("stream"), false);
    assert.equal(await UI.dispatchSourceSwitchAction("file"), false);

    assert.equal(activateMicCalls, 0);
    assert.equal(activateStreamCalls, 0);
    assert.equal(teardownCalls, 0);
    assert.equal(state.source.kind, "stream");
    assert.equal(state.source.status, "active");
    assert.equal(state.source.sessionActive, true);
  } finally {
    InputSourceManager.activateMic = originalActivateMic;
    InputSourceManager.activateStream = originalActivateStream;
    InputSourceManager.teardownActiveSource = originalTeardownActiveSource;
    applySourceAndAudioState(previous);
    Object.assign(state.recording, previous.recording);
    harness.restore();
  }
});

test("RecorderEngine.start allows an active microphone source without file transport state", () => {
  const harness = createRecorderHarness();

  try {
    const status = RecorderEngine.start();

    assert.equal(status.ok, true);
    assert.equal(status.phase, "recording");
    assert.notEqual(status.code, "no-active-source");
  } finally {
    harness.restore();
  }
});

test("RecorderEngine.start merges live stream audio even when no file transport is loaded", () => {
  const harness = createRecorderHarness();

  state.audio.isLoaded = false;
  state.audio.isPlaying = false;
  state.audio.filename = "";
  state.source.kind = "stream";
  state.source.status = "active";
  state.source.label = "Browser Tab";
  state.source.sessionActive = true;
  state.source.permission.stream = "granted";
  state.source.streamMeta.hasAudio = true;
  state.source.streamMeta.hasVideo = true;

  try {
    const status = RecorderEngine.start();

    assert.equal(status.ok, true);
    assert.equal(status.phase, "recording");
    assert.equal(status.code, "recorder-input-audio-video");
    assert.equal(harness.mediaRecorders.length, 1);
    assert.equal(harness.mediaRecorders[0].stream.getVideoTracks().length, 1);
    assert.equal(harness.mediaRecorders[0].stream.getAudioTracks().length, 1);
  } finally {
    harness.restore();
  }
});

test("RecorderEngine.start keeps active stream capture video-only when recording audio is disabled", () => {
  const harness = createRecorderHarness();

  state.audio.isLoaded = false;
  state.audio.isPlaying = false;
  state.audio.filename = "";
  state.source.kind = "stream";
  state.source.status = "active";
  state.source.label = "Browser Tab";
  state.source.sessionActive = true;
  state.source.permission.stream = "granted";
  state.source.streamMeta.hasAudio = true;
  state.source.streamMeta.hasVideo = true;
  state.recording.includePlaybackAudio = false;

  try {
    const status = RecorderEngine.start();

    assert.equal(status.ok, true);
    assert.equal(status.phase, "recording");
    assert.equal(status.code, "recorder-input-video-only");
    assert.equal(harness.mediaRecorders.length, 1);
    assert.equal(harness.mediaRecorders[0].stream.getVideoTracks().length, 1);
    assert.equal(harness.mediaRecorders[0].stream.getAudioTracks().length, 0);
  } finally {
    harness.restore();
  }
});

test("UI.getRecordingUiModel allows active stream sessions to start recording without a loaded file", () => {
  const previous = {
    source: JSON.parse(JSON.stringify(state.source)),
    audio: { ...state.audio },
    recording: JSON.parse(JSON.stringify(state.recording)),
    ui: { ...state.ui },
  };

  try {
    state.audio.isLoaded = false;
    state.audio.isPlaying = false;
    state.audio.filename = "";
    state.audio.transportError = "";
    state.source.kind = "stream";
    state.source.status = "active";
    state.source.label = "Browser Tab";
    state.source.sessionActive = true;
    state.source.streamMeta.hasAudio = true;
    state.source.streamMeta.hasVideo = true;
    state.recording.hooksEnabled = true;
    state.recording.phase = "idle";
    state.recording.isSupported = true;
    state.recording.includePlaybackAudio = true;
    state.recording.lastUpdatedAtMs = 42;

    UI.refreshRecordingUi();
    const model = UI.getRecordingUiModel();

    assert.equal(model.canStart, true);
    assert.equal(model.primaryStatusText, "Ready to record");
    assert.notEqual(model.primaryStatusText, "Load audio to start recording");
  } finally {
    applySourceAndAudioState(previous);
    Object.assign(state.recording, previous.recording);
    Object.assign(state.ui, previous.ui);
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
