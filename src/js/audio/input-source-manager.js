import { createSourceState, state } from "../core/state.js";
import { AudioEngine } from "./audio-engine.js";

/* =============================================================================
   Input Source Manager
   Owns runtime source state, capability detection, activation/teardown, and
   normalized handoff into AudioEngine.
   ========================================================================== */
function createInputSourceManager(deps = {}) {
  const stateRef = deps.stateRef || state;
  const audioEngine = deps.audioEngine || AudioEngine;
  const getMediaDevices = typeof deps.getMediaDevices === "function"
    ? deps.getMediaDevices
    : () => (Object.prototype.hasOwnProperty.call(deps, "mediaDevices")
      ? deps.mediaDevices
      : (typeof navigator !== "undefined" ? navigator.mediaDevices : null));

  let activeSession = null;

  function ensureSourceState() {
    if (!stateRef.source || typeof stateRef.source !== "object") stateRef.source = createSourceState();
    return stateRef.source;
  }

  function resetStreamMeta(sourceState) {
    sourceState.streamMeta.hasAudio = false;
    sourceState.streamMeta.hasVideo = false;
  }

  function clearError(sourceState) {
    sourceState.errorCode = "";
    sourceState.errorMessage = "";
  }

  function detectSupport() {
    const mediaDevices = getMediaDevices();
    return {
      mic: !!(mediaDevices && typeof mediaDevices.getUserMedia === "function"),
      stream: !!(mediaDevices && typeof mediaDevices.getDisplayMedia === "function"),
    };
  }

  function syncSupportState() {
    const sourceState = ensureSourceState();
    const support = detectSupport();
    sourceState.support.mic = support.mic;
    sourceState.support.stream = support.stream;
    sourceState.permission.mic = support.mic
      ? (sourceState.permission.mic === "unsupported" ? "unknown" : sourceState.permission.mic)
      : "unsupported";
    sourceState.permission.stream = support.stream
      ? (sourceState.permission.stream === "unsupported" ? "unknown" : sourceState.permission.stream)
      : "unsupported";
    return support;
  }

  function readAttemptMessage(kind, support) {
    if (!support[kind]) {
      return {
        status: "unsupported",
        code: `${kind}-unsupported`,
        message: kind === "mic"
          ? "Microphone capture is unavailable in this browser."
          : "Stream capture is unavailable in this browser.",
      };
    }
    return {
      status: "error",
      code: `${kind}-not-yet-implemented`,
      message: kind === "mic"
        ? "Microphone activation is not available in Build 114-A."
        : "Stream activation is not available in Build 114-A.",
    };
  }

  function isLoadRequestCurrent(requestId) {
    const guard = audioEngine && typeof audioEngine._isLoadRequestCurrent === "function"
      ? audioEngine._isLoadRequestCurrent
      : null;
    if (requestId == null || !guard) return true;
    return !!guard(requestId);
  }

  function clearActiveSessionListeners(session) {
    if (!session || !Array.isArray(session.cleanupFns)) return;
    for (const cleanup of session.cleanupFns) {
      try { cleanup(); } catch {}
    }
    session.cleanupFns = [];
  }

  function stopSessionStreamTracks(session) {
    const mediaStream = session && session.mediaStream;
    if (!mediaStream || typeof mediaStream.getTracks !== "function") return;
    for (const track of mediaStream.getTracks()) {
      try { track.stop(); } catch {}
    }
  }

  function resetToIdle() {
    const sourceState = ensureSourceState();
    sourceState.kind = "none";
    sourceState.status = "idle";
    sourceState.label = "";
    sourceState.sessionActive = false;
    clearError(sourceState);
    resetStreamMeta(sourceState);
    return sourceState;
  }

  function commitFailure(kind, { status, code, message, label = "" }) {
    const sourceState = ensureSourceState();
    sourceState.kind = kind;
    sourceState.status = status;
    sourceState.label = label;
    sourceState.sessionActive = false;
    sourceState.errorCode = code;
    sourceState.errorMessage = message;
    resetStreamMeta(sourceState);
    return {
      ok: false,
      kind,
      status,
      errorCode: code,
      errorMessage: message,
    };
  }

  function createStreamEndedCleanup(mediaStream) {
    if (!mediaStream || typeof mediaStream.getTracks !== "function") return [];
    const cleanupFns = [];
    const tracks = mediaStream.getTracks();
    for (const track of tracks) {
      if (!track || typeof track.addEventListener !== "function") continue;
      const onEnded = () => {
        handleExternalStreamEnded();
      };
      track.addEventListener("ended", onEnded);
      cleanupFns.push(() => {
        try { track.removeEventListener("ended", onEnded); } catch {}
      });
    }
    return cleanupFns;
  }

  function commitActiveSession(session) {
    activeSession = session;
    const sourceState = ensureSourceState();
    sourceState.kind = session.kind;
    sourceState.status = "active";
    sourceState.label = session.label || "";
    sourceState.sessionActive = true;
    clearError(sourceState);
    sourceState.streamMeta.hasAudio = !!session.hasAudio;
    sourceState.streamMeta.hasVideo = !!session.hasVideo;
    return {
      ok: true,
      kind: sourceState.kind,
      status: sourceState.status,
      label: sourceState.label,
    };
  }

  async function teardownActiveSource({ reason = "" } = {}) {
    const sourceState = ensureSourceState();
    if (!activeSession && !sourceState.sessionActive && sourceState.kind === "none" && sourceState.status === "idle") {
      return false;
    }

    if (sourceState.sessionActive) sourceState.status = "stopping";

    const session = activeSession;
    activeSession = null;

    clearActiveSessionListeners(session);
    stopSessionStreamTracks(session);

    if (audioEngine && typeof audioEngine.unload === "function" && (session || sourceState.sessionActive || sourceState.kind !== "none" || reason)) {
      audioEngine.unload();
    }

    resetToIdle();
    return true;
  }

  async function activateFile(file, options = {}) {
    if (!file) {
      return commitFailure("file", {
        status: "error",
        code: "file-missing",
        message: "No file was provided for activation.",
      });
    }

    if (activeSession || ensureSourceState().sessionActive) {
      await teardownActiveSource({ reason: "switch-to-file" });
    }

    const sourceState = ensureSourceState();
    sourceState.kind = "file";
    sourceState.status = "requesting";
    sourceState.label = file.name || "";
    sourceState.sessionActive = false;
    clearError(sourceState);
    resetStreamMeta(sourceState);

    const requestId = Object.prototype.hasOwnProperty.call(options, "requestId") ? options.requestId : null;
    const autoPlay = options && options.autoPlay === false ? false : true;
    const ok = await audioEngine.loadFile(file, requestId, { autoPlay });

    if (!isLoadRequestCurrent(requestId)) return false;

    if (!ok) {
      const fallbackMessage = stateRef.audio && stateRef.audio.transportError
        ? stateRef.audio.transportError
        : "Playback failed.";
      return commitFailure("file", {
        status: "error",
        code: "file-activation-failed",
        message: fallbackMessage,
        label: file.name || "",
      });
    }

    return commitActiveSession({
      kind: "file",
      label: file.name || "",
      mediaEl: typeof audioEngine.getMediaEl === "function" ? audioEngine.getMediaEl() : null,
      cleanupFns: [],
      hasAudio: true,
      hasVideo: false,
    });
  }

  async function activateMic() {
    if (activeSession || ensureSourceState().sessionActive) {
      await teardownActiveSource({ reason: "switch-to-mic" });
    }
    const support = syncSupportState();
    const result = readAttemptMessage("mic", support);
    return commitFailure("mic", result);
  }

  async function activateStream() {
    if (activeSession || ensureSourceState().sessionActive) {
      await teardownActiveSource({ reason: "switch-to-stream" });
    }
    const support = syncSupportState();
    const result = readAttemptMessage("stream", support);
    return commitFailure("stream", result);
  }

  async function handleExternalStreamEnded() {
    if (!activeSession || activeSession.kind !== "stream") return false;
    await teardownActiveSource({ reason: "external-stream-ended" });
    return true;
  }

  function init() {
    const support = syncSupportState();
    return {
      kind: ensureSourceState().kind,
      support,
    };
  }

  function registerFutureStreamSession(kind, mediaStream, options = {}) {
    const cleanupFns = createStreamEndedCleanup(mediaStream);
    return commitActiveSession({
      kind,
      label: options.label || "",
      mediaStream,
      cleanupFns,
      hasAudio: !!(mediaStream && typeof mediaStream.getAudioTracks === "function" && mediaStream.getAudioTracks().length),
      hasVideo: !!(mediaStream && typeof mediaStream.getVideoTracks === "function" && mediaStream.getVideoTracks().length),
    });
  }

  return {
    init,
    activateFile,
    activateMic,
    activateStream,
    teardownActiveSource,
    handleExternalStreamEnded,
    registerFutureStreamSession,
  };
}

const InputSourceManager = createInputSourceManager();

export { createInputSourceManager, InputSourceManager };
