const REAL_PANEL_TARGETS = Object.freeze([
  "audio",
  "queue",
  "sim",
  "bands",
  "record",
  "status",
]);

const LAUNCHER_TARGETS = Object.freeze({
  audioSource: "audio",
  analysis: "bands",
  banking: "bands",
  scene: "sim",
  recording: "record",
  workspace: "sim",
  status: "status",
});

const TARGET_DEFAULT_LAUNCHERS = Object.freeze({
  audio: "audioSource",
  sim: "scene",
  bands: "analysis",
  record: "recording",
  status: "status",
});

const DEFAULT_PANEL_OPEN_TARGETS = Object.freeze({
  audio: true,
  queue: false,
  sim: true,
  bands: true,
  record: false,
  status: false,
});

const DEFAULT_ACTIVE_LAUNCHER_ID = "audioSource";
const LAUNCHER_IDS = Object.freeze(Object.keys(LAUNCHER_TARGETS));

function cloneOpenTargets(openTargets) {
  const next = {};
  for (const targetId of REAL_PANEL_TARGETS) {
    next[targetId] = !!(openTargets && openTargets[targetId]);
  }
  if (!next.audio) next.queue = false;
  return next;
}

function createPanelShellState(overrides = {}) {
  const openTargets = cloneOpenTargets({
    ...DEFAULT_PANEL_OPEN_TARGETS,
    ...(overrides && overrides.openTargets ? overrides.openTargets : {}),
  });

  return {
    openTargets,
    activeLauncherId: isLauncherId(overrides && overrides.activeLauncherId)
      ? overrides.activeLauncherId
      : DEFAULT_ACTIVE_LAUNCHER_ID,
    launcherCollapsed: !!(overrides && overrides.launcherCollapsed),
    globalHideSnapshot: overrides && overrides.globalHideSnapshot
      ? cloneOpenTargets(overrides.globalHideSnapshot)
      : null,
  };
}

function ensurePanelShellState(panelShell) {
  if (!panelShell || typeof panelShell !== "object") return createPanelShellState();

  panelShell.openTargets = cloneOpenTargets({
    ...DEFAULT_PANEL_OPEN_TARGETS,
    ...(panelShell.openTargets || {}),
  });
  panelShell.activeLauncherId = isLauncherId(panelShell.activeLauncherId)
    ? panelShell.activeLauncherId
    : DEFAULT_ACTIVE_LAUNCHER_ID;
  panelShell.launcherCollapsed = !!panelShell.launcherCollapsed;
  panelShell.globalHideSnapshot = panelShell.globalHideSnapshot
    ? cloneOpenTargets(panelShell.globalHideSnapshot)
    : null;
  return panelShell;
}

function isLauncherId(launcherId) {
  return LAUNCHER_IDS.includes(launcherId);
}

function isPanelTarget(targetId) {
  return REAL_PANEL_TARGETS.includes(targetId);
}

function readLauncherTarget(launcherId) {
  return isLauncherId(launcherId) ? LAUNCHER_TARGETS[launcherId] : null;
}

function readDefaultLauncherForTarget(targetId) {
  return Object.prototype.hasOwnProperty.call(TARGET_DEFAULT_LAUNCHERS, targetId)
    ? TARGET_DEFAULT_LAUNCHERS[targetId]
    : null;
}

function ensureLauncherForTarget(panelShell, targetId) {
  const shell = ensurePanelShellState(panelShell);
  const currentTarget = readLauncherTarget(shell.activeLauncherId);
  if (currentTarget === targetId) return shell.activeLauncherId;
  const fallback = readDefaultLauncherForTarget(targetId);
  if (fallback) shell.activeLauncherId = fallback;
  return shell.activeLauncherId;
}

function isTargetOpen(panelShell, targetId) {
  const shell = ensurePanelShellState(panelShell);
  if (!isPanelTarget(targetId)) return false;
  return !!shell.openTargets[targetId];
}

function setPanelTargetOpen(panelShell, targetId, open) {
  const shell = ensurePanelShellState(panelShell);
  if (!isPanelTarget(targetId)) return false;

  const nextOpen = !!open;
  if (targetId === "queue" && !shell.openTargets.audio && nextOpen) return false;

  if (shell.openTargets[targetId] === nextOpen) return false;
  shell.openTargets[targetId] = nextOpen;

  if (targetId === "audio" && !nextOpen) shell.openTargets.queue = false;
  return true;
}

function setPanelTargets(panelShell, nextOpenTargets) {
  const shell = ensurePanelShellState(panelShell);
  shell.openTargets = cloneOpenTargets(nextOpenTargets);
  return shell.openTargets;
}

function setLauncherCollapsed(panelShell, collapsed) {
  const shell = ensurePanelShellState(panelShell);
  const nextCollapsed = !!collapsed;
  if (shell.launcherCollapsed === nextCollapsed) return false;
  shell.launcherCollapsed = nextCollapsed;
  return true;
}

function toggleLauncherCollapsed(panelShell) {
  const shell = ensurePanelShellState(panelShell);
  shell.launcherCollapsed = !shell.launcherCollapsed;
  return shell.launcherCollapsed;
}

function activateLauncher(panelShell, launcherId) {
  const shell = ensurePanelShellState(panelShell);
  if (!isLauncherId(launcherId)) return { ok: false, targetId: null, opened: false, closed: false };

  const targetId = readLauncherTarget(launcherId);
  const wasOpen = isTargetOpen(shell, targetId);
  const sameLauncher = shell.activeLauncherId === launcherId;
  shell.activeLauncherId = launcherId;

  if (!wasOpen) {
    setPanelTargetOpen(shell, targetId, true);
    return { ok: true, targetId, opened: true, closed: false };
  }

  if (!sameLauncher) {
    return { ok: true, targetId, opened: false, closed: false };
  }

  setPanelTargetOpen(shell, targetId, false);
  return { ok: true, targetId, opened: false, closed: true };
}

function readAnyPanelOpen(panelShell) {
  const shell = ensurePanelShellState(panelShell);
  return REAL_PANEL_TARGETS.some((targetId) => shell.openTargets[targetId]);
}

function toggleGlobalPanelVisibility(panelShell) {
  const shell = ensurePanelShellState(panelShell);
  const anyOpen = readAnyPanelOpen(shell);

  if (anyOpen) {
    shell.globalHideSnapshot = cloneOpenTargets(shell.openTargets);
    setPanelTargets(shell, {
      audio: false,
      queue: false,
      sim: false,
      bands: false,
      record: false,
      status: false,
    });
    return { restored: false, hidden: true };
  }

  const restoreTargets = shell.globalHideSnapshot || DEFAULT_PANEL_OPEN_TARGETS;
  setPanelTargets(shell, restoreTargets);
  shell.globalHideSnapshot = null;
  return { restored: true, hidden: false };
}

function getPanelShellStateSnapshot(panelShell) {
  const shell = ensurePanelShellState(panelShell);
  return {
    openTargets: cloneOpenTargets(shell.openTargets),
    activeLauncherId: shell.activeLauncherId,
    launcherCollapsed: shell.launcherCollapsed,
    globalHideSnapshot: shell.globalHideSnapshot
      ? cloneOpenTargets(shell.globalHideSnapshot)
      : null,
  };
}

export {
  DEFAULT_ACTIVE_LAUNCHER_ID,
  DEFAULT_PANEL_OPEN_TARGETS,
  LAUNCHER_IDS,
  LAUNCHER_TARGETS,
  REAL_PANEL_TARGETS,
  TARGET_DEFAULT_LAUNCHERS,
  activateLauncher,
  cloneOpenTargets,
  createPanelShellState,
  ensureLauncherForTarget,
  ensurePanelShellState,
  getPanelShellStateSnapshot,
  isPanelTarget,
  isTargetOpen,
  readAnyPanelOpen,
  readDefaultLauncherForTarget,
  readLauncherTarget,
  setLauncherCollapsed,
  setPanelTargetOpen,
  setPanelTargets,
  toggleGlobalPanelVisibility,
  toggleLauncherCollapsed,
};
