import test from "node:test";
import assert from "node:assert/strict";

import { createRuntimeLogState } from "../src/js/core/state.js";
import {
  appendRuntimeLogEntry,
  buildRuntimeLogUiSyncKey,
  clearRuntimeLog,
  markRuntimeLogRead,
} from "../src/js/ui/runtime-log.js";

test("runtime log appends newest-first entries and marks them unread by default", () => {
  const runtimeLog = createRuntimeLogState();

  appendRuntimeLogEntry(runtimeLog, {
    level: "info",
    category: "workspace",
    code: "preset-applied",
    message: "Applied preset from URL hash.",
    timestampMs: 100,
  });
  appendRuntimeLogEntry(runtimeLog, {
    level: "warn",
    category: "source",
    code: "stream-ended",
    message: "Shared stream ended.",
    timestampMs: 200,
  });

  assert.equal(runtimeLog.hasUnread, true);
  assert.deepEqual(
    runtimeLog.entries.map((entry) => entry.code),
    ["stream-ended", "preset-applied"]
  );
  assert.equal(runtimeLog.entries[0].id, 2);
});

test("runtime log caps history length at 64 entries", () => {
  const runtimeLog = createRuntimeLogState();

  for (let i = 0; i < 70; i += 1) {
    appendRuntimeLogEntry(runtimeLog, {
      level: "info",
      category: "recording",
      code: `entry-${i}`,
      message: `Entry ${i}`,
      timestampMs: i,
    });
  }

  assert.equal(runtimeLog.entries.length, 64);
  assert.equal(runtimeLog.entries[0].code, "entry-69");
  assert.equal(runtimeLog.entries.at(-1).code, "entry-6");
});

test("runtime log can append without marking unread and can later mark read explicitly", () => {
  const runtimeLog = createRuntimeLogState();

  appendRuntimeLogEntry(runtimeLog, {
    level: "info",
    category: "source",
    code: "mic-live",
    message: "Microphone is live.",
    timestampMs: 1,
  }, {
    markUnread: false,
  });

  assert.equal(runtimeLog.hasUnread, false);

  appendRuntimeLogEntry(runtimeLog, {
    level: "warn",
    category: "recording",
    code: "audio-unloaded",
    message: "Recording continues while no audio is loaded.",
    timestampMs: 2,
  });
  assert.equal(runtimeLog.hasUnread, true);

  markRuntimeLogRead(runtimeLog);
  assert.equal(runtimeLog.hasUnread, false);
});

test("runtime log clear resets entries and sync key state", () => {
  const runtimeLog = createRuntimeLogState();

  appendRuntimeLogEntry(runtimeLog, {
    level: "error",
    category: "workspace",
    code: "invalid-hash",
    message: "No valid preset in URL hash.",
    timestampMs: 10,
  });
  const beforeClearKey = buildRuntimeLogUiSyncKey(runtimeLog);
  clearRuntimeLog(runtimeLog);
  const afterClearKey = buildRuntimeLogUiSyncKey(runtimeLog);

  assert.notEqual(beforeClearKey, afterClearKey);
  assert.deepEqual(runtimeLog.entries, []);
  assert.equal(runtimeLog.hasUnread, false);
});
