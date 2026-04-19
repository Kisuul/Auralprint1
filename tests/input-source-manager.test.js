import test from "node:test";
import assert from "node:assert/strict";

import { createSourceState, state } from "../src/js/core/state.js";
import { UrlPreset } from "../src/js/presets/url-preset.js";
import { createInputSourceManager } from "../src/js/audio/input-source-manager.js";

function createAudioState() {
  return {
    isLoaded: false,
    isPlaying: false,
    filename: "",
    transportError: "",
  };
}

function createManagerHarness(overrides = {}) {
  const stateRef = {
    source: createSourceState(),
    audio: createAudioState(),
  };
  const calls = {
    loadFile: [],
    unload: 0,
  };

  const audioEngine = {
    async loadFile(file, requestId, opts) {
      calls.loadFile.push({ file, requestId, opts });
      if (typeof overrides.onLoadFile === "function") {
        return overrides.onLoadFile({ file, requestId, opts, stateRef, calls });
      }
      return true;
    },
    unload() {
      calls.unload += 1;
      if (typeof overrides.onUnload === "function") overrides.onUnload({ stateRef, calls });
    },
    getMediaEl() {
      return overrides.mediaEl || null;
    },
  };

  Object.defineProperty(audioEngine, "_isLoadRequestCurrent", {
    get() {
      return typeof overrides.isLoadRequestCurrent === "function"
        ? overrides.isLoadRequestCurrent
        : null;
    },
  });

  const manager = createInputSourceManager({
    stateRef,
    audioEngine,
    mediaDevices: Object.prototype.hasOwnProperty.call(overrides, "mediaDevices")
      ? overrides.mediaDevices
      : null,
  });

  return { manager, stateRef, calls };
}

function decodePresetHash(hash) {
  const token = hash.startsWith("#p=") ? hash.slice(3) : hash;
  const padLength = (4 - (token.length % 4)) % 4;
  const b64 = token.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLength);
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
}

test("state.source exists and starts in the idle none state", () => {
  assert.ok(state.source);
  assert.equal(state.source.kind, "none");
  assert.equal(state.source.status, "idle");
  assert.equal(state.source.sessionActive, false);
  assert.deepEqual(createSourceState().streamMeta, { hasAudio: false, hasVideo: false });
});

test("input source manager init marks unsupported capabilities when media APIs are absent", () => {
  const { manager, stateRef } = createManagerHarness({ mediaDevices: null });

  manager.init();

  assert.equal(stateRef.source.support.mic, false);
  assert.equal(stateRef.source.support.stream, false);
  assert.equal(stateRef.source.permission.mic, "unsupported");
  assert.equal(stateRef.source.permission.stream, "unsupported");
});

test("activateFile transitions through requesting to active and forwards load arguments", async () => {
  let seenDuringLoad = null;
  const { manager, stateRef, calls } = createManagerHarness({
    mediaDevices: {},
    mediaEl: { tagName: "AUDIO" },
    onLoadFile({ stateRef: loadState }) {
      seenDuringLoad = {
        kind: loadState.source.kind,
        status: loadState.source.status,
        label: loadState.source.label,
        sessionActive: loadState.source.sessionActive,
      };
      loadState.audio.isLoaded = true;
      loadState.audio.filename = "demo.wav";
      loadState.audio.transportError = "";
      return true;
    },
  });

  const file = { name: "demo.wav" };
  const result = await manager.activateFile(file, { requestId: 7, autoPlay: false });

  assert.deepEqual(seenDuringLoad, {
    kind: "file",
    status: "requesting",
    label: "demo.wav",
    sessionActive: false,
  });
  assert.equal(calls.loadFile.length, 1);
  assert.equal(calls.loadFile[0].file, file);
  assert.equal(calls.loadFile[0].requestId, 7);
  assert.deepEqual(calls.loadFile[0].opts, { autoPlay: false });
  assert.deepEqual(result, { ok: true, kind: "file", status: "active", label: "demo.wav" });
  assert.equal(stateRef.source.kind, "file");
  assert.equal(stateRef.source.status, "active");
  assert.equal(stateRef.source.sessionActive, true);
  assert.equal(stateRef.source.label, "demo.wav");
});

test("activateFile failure leaves attempted kind in error without a live session", async () => {
  const { manager, stateRef } = createManagerHarness({
    onLoadFile({ stateRef: loadState }) {
      loadState.audio.transportError = "Playback failed: simulated failure.";
      return false;
    },
  });

  const result = await manager.activateFile({ name: "broken.wav" }, { requestId: 3 });

  assert.equal(result.ok, false);
  assert.equal(result.kind, "file");
  assert.equal(result.status, "error");
  assert.equal(stateRef.source.kind, "file");
  assert.equal(stateRef.source.status, "error");
  assert.equal(stateRef.source.sessionActive, false);
  assert.equal(stateRef.source.errorCode, "file-activation-failed");
  assert.equal(stateRef.source.errorMessage, "Playback failed: simulated failure.");
});

test("teardownActiveSource is idempotent and unloads the active session only once", async () => {
  const { manager, stateRef, calls } = createManagerHarness({
    mediaEl: { tagName: "AUDIO" },
    onLoadFile({ stateRef: loadState }) {
      loadState.audio.isLoaded = true;
      return true;
    },
  });

  await manager.activateFile({ name: "loop.wav" }, { requestId: 5 });

  const first = await manager.teardownActiveSource({ reason: "test-reset" });
  const second = await manager.teardownActiveSource({ reason: "test-reset-again" });

  assert.equal(first, true);
  assert.equal(second, false);
  assert.equal(calls.unload, 1);
  assert.equal(stateRef.source.kind, "none");
  assert.equal(stateRef.source.status, "idle");
  assert.equal(stateRef.source.sessionActive, false);
});

test("activateMic tears down an active file source before reporting the Build 114-A stub state", async () => {
  const { manager, stateRef, calls } = createManagerHarness({
    mediaDevices: {
      getUserMedia() {},
      getDisplayMedia() {},
    },
    mediaEl: { tagName: "AUDIO" },
    onLoadFile({ stateRef: loadState }) {
      loadState.audio.isLoaded = true;
      loadState.audio.isPlaying = true;
      loadState.audio.filename = "song.wav";
      return true;
    },
  });

  await manager.activateFile({ name: "song.wav" }, { requestId: 11 });
  const result = await manager.activateMic();

  assert.equal(calls.unload, 1);
  assert.equal(result.ok, false);
  assert.equal(result.kind, "mic");
  assert.equal(result.status, "error");
  assert.equal(stateRef.source.kind, "mic");
  assert.equal(stateRef.source.status, "error");
  assert.equal(stateRef.source.sessionActive, false);
  assert.equal(stateRef.source.errorCode, "mic-not-yet-implemented");
});

test("activateStream tears down an active file source before reporting the Build 114-A stub state", async () => {
  const { manager, stateRef, calls } = createManagerHarness({
    mediaDevices: {
      getUserMedia() {},
      getDisplayMedia() {},
    },
    mediaEl: { tagName: "AUDIO" },
    onLoadFile({ stateRef: loadState }) {
      loadState.audio.isLoaded = true;
      loadState.audio.isPlaying = true;
      loadState.audio.filename = "song.wav";
      return true;
    },
  });

  await manager.activateFile({ name: "song.wav" }, { requestId: 12 });
  const result = await manager.activateStream();

  assert.equal(calls.unload, 1);
  assert.equal(result.ok, false);
  assert.equal(result.kind, "stream");
  assert.equal(result.status, "error");
  assert.equal(stateRef.source.kind, "stream");
  assert.equal(stateRef.source.status, "error");
  assert.equal(stateRef.source.sessionActive, false);
  assert.equal(stateRef.source.errorCode, "stream-not-yet-implemented");
});

test("teardownActiveSource stops stream-backed sessions even when the kind is mic", async () => {
  const stopCounts = { audio: 0, video: 0 };
  const fakeAudioTrack = {
    addEventListener() {},
    removeEventListener() {},
    stop() { stopCounts.audio += 1; },
  };
  const fakeVideoTrack = {
    addEventListener() {},
    removeEventListener() {},
    stop() { stopCounts.video += 1; },
  };
  const fakeMediaStream = {
    getTracks() { return [fakeAudioTrack, fakeVideoTrack]; },
    getAudioTracks() { return [fakeAudioTrack]; },
    getVideoTracks() { return [fakeVideoTrack]; },
  };
  const { manager, stateRef, calls } = createManagerHarness();

  manager.registerFutureStreamSession("mic", fakeMediaStream, { label: "Built-in microphone" });
  const result = await manager.teardownActiveSource({ reason: "mic-session-ended" });

  assert.equal(result, true);
  assert.equal(stopCounts.audio, 1);
  assert.equal(stopCounts.video, 1);
  assert.equal(calls.unload, 1);
  assert.equal(stateRef.source.kind, "none");
  assert.equal(stateRef.source.status, "idle");
});

test("unsupported live-source activation reports unsupported state without mutating file transport fields", async () => {
  const { manager, stateRef } = createManagerHarness({ mediaDevices: null });
  stateRef.audio.isLoaded = true;
  stateRef.audio.isPlaying = true;
  stateRef.audio.filename = "existing.wav";
  stateRef.audio.transportError = "";

  const micResult = await manager.activateMic();
  const streamResult = await manager.activateStream();

  assert.equal(micResult.status, "unsupported");
  assert.equal(streamResult.status, "unsupported");
  assert.equal(stateRef.audio.isLoaded, true);
  assert.equal(stateRef.audio.isPlaying, true);
  assert.equal(stateRef.audio.filename, "existing.wav");
  assert.equal(stateRef.audio.transportError, "");
});

test("URL preset serialization excludes runtime source state", () => {
  const previousLocation = globalThis.location;
  const previousHistory = globalThis.history;
  const previousBtoa = globalThis.btoa;
  const previousAtob = globalThis.atob;
  const previousSource = JSON.parse(JSON.stringify(state.source));

  if (typeof globalThis.btoa !== "function") {
    globalThis.btoa = (value) => Buffer.from(value, "binary").toString("base64");
  }
  if (typeof globalThis.atob !== "function") {
    globalThis.atob = (value) => Buffer.from(value, "base64").toString("binary");
  }

  const locationStub = {
    pathname: "/",
    search: "",
    hash: "",
  };

  globalThis.location = locationStub;
  globalThis.history = {
    replaceState(_state, _title, url) {
      locationStub.hash = url.includes("#") ? url.slice(url.indexOf("#")) : "";
    },
  };

  state.source.kind = "stream";
  state.source.status = "error";
  state.source.label = "Shared tab audio";
  state.source.permission.stream = "denied";
  state.source.errorCode = "stream-denied";
  state.source.errorMessage = "User denied stream capture.";
  state.source.sessionActive = true;
  state.source.streamMeta.hasAudio = true;
  state.source.streamMeta.hasVideo = true;

  try {
    UrlPreset.writeHashFromPrefs();
    const payload = decodePresetHash(locationStub.hash);
    assert.ok(payload && payload.prefs);
    assert.equal(Object.prototype.hasOwnProperty.call(payload.prefs, "source"), false);
  } finally {
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
    globalThis.location = previousLocation;
    globalThis.history = previousHistory;
    globalThis.btoa = previousBtoa;
    globalThis.atob = previousAtob;
  }
});
