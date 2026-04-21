import test from "node:test";
import assert from "node:assert/strict";

import {
  activateLauncher,
  createPanelShellState,
  setPanelTargetOpen,
  toggleGlobalPanelVisibility,
} from "../src/js/ui/panel-state.js";

test("panel shell defaults to runtime-only open targets with an expanded launcher bar", () => {
  const shell = createPanelShellState();

  assert.deepEqual(shell.openTargets, {
    audio: true,
    queue: false,
    sim: true,
    bands: true,
    record: false,
    status: false,
  });
  assert.equal(shell.activeLauncherId, "audioSource");
  assert.equal(shell.launcherCollapsed, false);
  assert.equal(shell.globalHideSnapshot, null);
});

test("launcher aliases share one real panel target without duplicating open state", () => {
  const shell = createPanelShellState();

  const analysis = activateLauncher(shell, "analysis");
  assert.deepEqual(analysis, {
    ok: true,
    targetId: "bands",
    opened: false,
    closed: false,
  });
  assert.equal(shell.activeLauncherId, "analysis");
  assert.equal(shell.openTargets.bands, true);

  const banking = activateLauncher(shell, "banking");
  assert.deepEqual(banking, {
    ok: true,
    targetId: "bands",
    opened: false,
    closed: false,
  });
  assert.equal(shell.activeLauncherId, "banking");
  assert.equal(shell.openTargets.bands, true);
});

test("closing the audio target also closes the subordinate queue target", () => {
  const shell = createPanelShellState();

  assert.equal(setPanelTargetOpen(shell, "queue", true), true);
  assert.equal(shell.openTargets.queue, true);

  assert.equal(setPanelTargetOpen(shell, "audio", false), true);
  assert.equal(shell.openTargets.audio, false);
  assert.equal(shell.openTargets.queue, false);
});

test("global hide snapshots and restores panel visibility without persisting it", () => {
  const shell = createPanelShellState({
    activeLauncherId: "status",
    openTargets: {
      audio: true,
      queue: true,
      sim: false,
      bands: true,
      record: false,
      status: true,
    },
  });

  const hidden = toggleGlobalPanelVisibility(shell);
  assert.deepEqual(hidden, { restored: false, hidden: true });
  assert.deepEqual(shell.openTargets, {
    audio: false,
    queue: false,
    sim: false,
    bands: false,
    record: false,
    status: false,
  });
  assert.deepEqual(shell.globalHideSnapshot, {
    audio: true,
    queue: true,
    sim: false,
    bands: true,
    record: false,
    status: true,
  });

  const restored = toggleGlobalPanelVisibility(shell);
  assert.deepEqual(restored, { restored: true, hidden: false });
  assert.deepEqual(shell.openTargets, {
    audio: true,
    queue: true,
    sim: false,
    bands: true,
    record: false,
    status: true,
  });
  assert.equal(shell.globalHideSnapshot, null);
});
