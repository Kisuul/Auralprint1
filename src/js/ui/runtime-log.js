function ensureRuntimeLogState(logState) {
  if (!logState || typeof logState !== "object") {
    return {
      entries: [],
      nextId: 1,
      hasUnread: false,
      maxEntries: 64,
    };
  }

  if (!Array.isArray(logState.entries)) logState.entries = [];
  if (!Number.isInteger(logState.nextId) || logState.nextId < 1) logState.nextId = 1;
  if (!Number.isInteger(logState.maxEntries) || logState.maxEntries < 1) logState.maxEntries = 64;
  logState.hasUnread = !!logState.hasUnread;
  return logState;
}

function appendRuntimeLogEntry(logState, entry, options = {}) {
  const runtimeLog = ensureRuntimeLogState(logState);
  const trimmedMessage = entry && typeof entry.message === "string"
    ? entry.message.trim()
    : "";
  if (!trimmedMessage) return null;

  const nextEntry = {
    id: runtimeLog.nextId,
    level: entry && entry.level === "error"
      ? "error"
      : (entry && entry.level === "warn" ? "warn" : "info"),
    category: entry && typeof entry.category === "string" && entry.category
      ? entry.category
      : "workspace",
    code: entry && typeof entry.code === "string" ? entry.code : "",
    message: trimmedMessage,
    timestampMs: Number.isFinite(entry && entry.timestampMs) ? entry.timestampMs : Date.now(),
  };

  runtimeLog.nextId += 1;
  runtimeLog.entries.unshift(nextEntry);
  if (runtimeLog.entries.length > runtimeLog.maxEntries) {
    runtimeLog.entries.length = runtimeLog.maxEntries;
  }

  if (options.markUnread !== false) runtimeLog.hasUnread = true;
  return nextEntry;
}

function clearRuntimeLog(logState) {
  const runtimeLog = ensureRuntimeLogState(logState);
  runtimeLog.entries = [];
  runtimeLog.hasUnread = false;
  return runtimeLog;
}

function markRuntimeLogRead(logState) {
  const runtimeLog = ensureRuntimeLogState(logState);
  runtimeLog.hasUnread = false;
  return runtimeLog;
}

function buildRuntimeLogUiSyncKey(logState) {
  const runtimeLog = ensureRuntimeLogState(logState);
  const newestEntry = runtimeLog.entries[0] || null;
  const newestId = newestEntry ? newestEntry.id : 0;
  return [
    newestId,
    runtimeLog.entries.length,
    runtimeLog.hasUnread ? 1 : 0,
  ].join(":");
}

export {
  appendRuntimeLogEntry,
  buildRuntimeLogUiSyncKey,
  clearRuntimeLog,
  ensureRuntimeLogState,
  markRuntimeLogRead,
};
