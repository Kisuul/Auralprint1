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
    audioSource: true,
    queue: false,
    analysis: false,
    banking: true,
    scene: true,
    recording: false,
    workspace: false,
    status: false,
  });
  assert.equal(shell.activeLauncherId, "audioSource");
  assert.equal(shell.launcherCollapsed, false);
  assert.equal(shell.globalHideSnapshot, null);
});

test("launchers map 1:1 onto real panel targets", () => {
  const shell = createPanelShellState();

  const analysis = activateLauncher(shell, "analysis");
  assert.deepEqual(analysis, {
    ok: true,
    targetId: "analysis",
    opened: true,
    closed: false,
  });
  assert.equal(shell.activeLauncherId, "analysis");
  assert.equal(shell.openTargets.analysis, true);

  const banking = activateLauncher(shell, "banking");
  assert.deepEqual(banking, {
    ok: true,
    targetId: "banking",
    opened: false,
    closed: false,
  });
  assert.equal(shell.activeLauncherId, "banking");
  assert.equal(shell.openTargets.banking, true);
});

test("closing the audio target also closes the subordinate queue target", () => {
  const shell = createPanelShellState();

  assert.equal(setPanelTargetOpen(shell, "queue", true), true);
  assert.equal(shell.openTargets.queue, true);

  assert.equal(setPanelTargetOpen(shell, "audioSource", false), true);
  assert.equal(shell.openTargets.audioSource, false);
  assert.equal(shell.openTargets.queue, false);
});

test("global hide snapshots and restores panel visibility without persisting it", () => {
  const shell = createPanelShellState({
    activeLauncherId: "status",
    openTargets: {
      audioSource: true,
      queue: true,
      analysis: true,
      banking: true,
      scene: false,
      recording: false,
      workspace: true,
      status: true,
    },
  });

  const hidden = toggleGlobalPanelVisibility(shell);
  assert.deepEqual(hidden, { restored: false, hidden: true });
  assert.deepEqual(shell.openTargets, {
    audioSource: false,
    queue: false,
    analysis: false,
    banking: false,
    scene: false,
    recording: false,
    workspace: false,
    status: false,
  });
  assert.deepEqual(shell.globalHideSnapshot, {
    audioSource: true,
    queue: true,
    analysis: true,
    banking: true,
    scene: false,
    recording: false,
    workspace: true,
    status: true,
  });

  const restored = toggleGlobalPanelVisibility(shell);
  assert.deepEqual(restored, { restored: true, hidden: false });
  assert.deepEqual(shell.openTargets, {
    audioSource: true,
    queue: true,
    analysis: true,
    banking: true,
    scene: false,
    recording: false,
    workspace: true,
    status: true,
  });
  assert.equal(shell.globalHideSnapshot, null);
});
