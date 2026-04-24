import { CONFIG } from "../core/config.js";
import {
  normalizeOrbDef,
  preferences,
  resolveSettings,
  sanitizeOrbBandIds,
} from "../core/preferences.js";
import { state } from "../core/state.js";
import { clamp, deepClone } from "../core/utils.js";
import { createVisualizerRegistry, registerBuiltInVisualizers } from "./visualizer.js";

const SCENE_TYPE_ORDER = Object.freeze(["orbs", "bandOverlay"]);
const SCENE_TYPE_LABELS = Object.freeze({
  orbs: "Orbs",
  bandOverlay: "Band Overlay",
});

const sceneRegistry = createVisualizerRegistry();
registerBuiltInVisualizers(sceneRegistry);

function ensureSceneState() {
  if (!state.scene || typeof state.scene !== "object") {
    state.scene = {
      nodes: [],
      selectedNodeId: "",
    };
  }

  if (!Array.isArray(state.scene.nodes)) state.scene.nodes = [];
  if (typeof state.scene.selectedNodeId !== "string") state.scene.selectedNodeId = "";
  return state.scene;
}

function readDefaultOrbFallback(index = 0) {
  const defaults = Array.isArray(CONFIG.defaults.orbs) ? CONFIG.defaults.orbs : [];
  const fallback = defaults[index % Math.max(1, defaults.length)] || null;
  return fallback || {
    id: "ORB0",
    chanId: "C",
    bandIds: [],
    chirality: -1,
    startAngleRad: 0,
  };
}

function sanitizeSceneNumber(value, schema) {
  const fallback = Number.isFinite(schema && schema.default) ? schema.default : 0;
  const numeric = Number.isFinite(value) ? value : fallback;
  const min = Number.isFinite(schema && schema.min) ? schema.min : -Infinity;
  const max = Number.isFinite(schema && schema.max) ? schema.max : Infinity;
  return clamp(numeric, min, max);
}

function sanitizeSettingValue(value, schema) {
  if (!schema || typeof schema !== "object") return deepClone(value);

  if (schema.type === "boolean") {
    return typeof value === "boolean" ? value : !!schema.default;
  }

  if (schema.type === "string") {
    if (Array.isArray(schema.enum) && schema.enum.length) {
      return schema.enum.includes(value) ? value : schema.default;
    }
    return typeof value === "string" ? value : (typeof schema.default === "string" ? schema.default : "");
  }

  if (schema.type === "number") {
    return sanitizeSceneNumber(value, schema);
  }

  if (schema.type === "array") {
    return Array.isArray(value) ? deepClone(value) : deepClone(schema.default);
  }

  return deepClone(value);
}

function sanitizeOverlaySettings(rawSettings) {
  const defaultNode = sceneRegistry.getDefaultNode("bandOverlay") || { settings: {} };
  const schema = sceneRegistry.getSettingsSchema("bandOverlay") || { fields: {} };
  const source = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
  const next = deepClone(defaultNode.settings || {});

  for (const [fieldName, fieldSchema] of Object.entries(schema.fields || {})) {
    const hasOwn = Object.prototype.hasOwnProperty.call(source, fieldName);
    const sourceValue = hasOwn ? source[fieldName] : next[fieldName];
    next[fieldName] = sanitizeSettingValue(sourceValue, fieldSchema);
  }

  return next;
}

function sanitizeOrbSettings(rawSettings) {
  const input = Array.isArray(rawSettings) ? rawSettings : deepClone(CONFIG.defaults.orbs);
  return input.map((orb, index) => normalizeOrbDef(orb, readDefaultOrbFallback(index)));
}

function sanitizeSettingsForType(type, rawSettings) {
  switch (type) {
    case "orbs":
      return sanitizeOrbSettings(rawSettings);
    case "bandOverlay":
      return sanitizeOverlaySettings(rawSettings);
    default:
      return deepClone(rawSettings);
  }
}

function reindexSceneNodes(nodes) {
  return nodes.map((node, index) => ({
    ...node,
    zIndex: index,
  }));
}

function buildSceneNodeFromPreferences(type) {
  const defaultNode = sceneRegistry.getDefaultNode(type);
  if (!defaultNode) return null;

  const node = deepClone(defaultNode);
  if (type === "orbs") {
    node.settings = sanitizeOrbSettings(preferences.orbs);
    node.enabled = true;
  } else if (type === "bandOverlay") {
    node.settings = sanitizeOverlaySettings(preferences.bands.overlay);
    node.enabled = !!node.settings.enabled;
  }

  return node;
}

function buildSceneNodesFromPreferences({ preserveRuntimeState = false } = {}) {
  const sceneState = ensureSceneState();
  const existingNodes = Array.isArray(sceneState.nodes) ? sceneState.nodes : [];
  const existingById = new Map(existingNodes.map((node) => [node.id, node]));
  const freshNodes = SCENE_TYPE_ORDER
    .map((type) => buildSceneNodeFromPreferences(type))
    .filter(Boolean);

  if (!preserveRuntimeState) return reindexSceneNodes(freshNodes);

  const freshById = new Map(freshNodes.map((node) => [node.id, node]));
  const orderedIds = [];

  for (const node of existingNodes) {
    if (!node || typeof node.id !== "string" || !freshById.has(node.id)) continue;
    orderedIds.push(node.id);
  }

  for (const node of freshNodes) {
    if (!orderedIds.includes(node.id)) orderedIds.push(node.id);
  }

  return reindexSceneNodes(orderedIds.map((id) => {
    const freshNode = freshById.get(id);
    const existingNode = existingById.get(id) || null;
    return {
      ...freshNode,
      enabled: existingNode ? !!existingNode.enabled : !!freshNode.enabled,
    };
  }));
}

function setSceneNodes(nodes, { preserveSelection = false } = {}) {
  const sceneState = ensureSceneState();
  const previousSelection = preserveSelection ? sceneState.selectedNodeId : "";
  sceneState.nodes = reindexSceneNodes((Array.isArray(nodes) ? nodes : []).map((node) => deepClone(node)));
  sceneState.selectedNodeId = sceneState.nodes.some((node) => node.id === previousSelection)
    ? previousSelection
    : (sceneState.nodes[0] ? sceneState.nodes[0].id : "");
  return readSceneSnapshot();
}

function readSceneRuntime() {
  const sceneState = ensureSceneState();
  if (!sceneState.nodes.length) setSceneNodes(buildSceneNodesFromPreferences(), { preserveSelection: false });
  return sceneState;
}

function readSceneSnapshot() {
  const sceneState = readSceneRuntime();
  return deepClone({
    nodes: sceneState.nodes,
    selectedNodeId: sceneState.selectedNodeId,
  });
}

function readSceneNodeDisplayName(type) {
  return Object.prototype.hasOwnProperty.call(SCENE_TYPE_LABELS, type) ? SCENE_TYPE_LABELS[type] : type;
}

function readSceneSettingsSchema(type) {
  return sceneRegistry.getSettingsSchema(type);
}

function readSelectedSceneNode() {
  const sceneState = readSceneRuntime();
  const node = sceneState.nodes.find((candidate) => candidate.id === sceneState.selectedNodeId) || null;
  return node ? deepClone(node) : null;
}

function findMutableSceneNode(nodeId) {
  const sceneState = readSceneRuntime();
  return sceneState.nodes.find((node) => node && node.id === nodeId) || null;
}

function selectSceneNode(nodeId) {
  const sceneState = readSceneRuntime();
  if (sceneState.nodes.some((node) => node.id === nodeId)) sceneState.selectedNodeId = nodeId;
  return readSceneSnapshot();
}

function persistSceneNodeSettings(node) {
  if (!node || typeof node !== "object") return null;

  if (node.type === "orbs") {
    node.settings = sanitizeOrbSettings(node.settings);
    preferences.orbs = deepClone(node.settings);
  } else if (node.type === "bandOverlay") {
    node.settings = sanitizeOverlaySettings(node.settings);
    preferences.bands.overlay = deepClone(node.settings);
  }

  resolveSettings();
  return node;
}

function replaceSceneNodeSettings(nodeId, nextSettings, { persist = false } = {}) {
  const node = findMutableSceneNode(nodeId);
  if (!node) return null;

  node.settings = sanitizeSettingsForType(node.type, nextSettings);
  if (persist) persistSceneNodeSettings(node);
  return deepClone(node);
}

function updateSceneNodeSettings(nodeId, updater, options = {}) {
  const node = findMutableSceneNode(nodeId);
  if (!node) return null;

  const currentSettings = deepClone(node.settings);
  const nextSettings = typeof updater === "function" ? updater(currentSettings) : updater;
  return replaceSceneNodeSettings(nodeId, nextSettings, options);
}

function moveSceneNode(nodeId, delta) {
  const sceneState = readSceneRuntime();
  const currentIndex = sceneState.nodes.findIndex((node) => node.id === nodeId);
  if (currentIndex < 0) return readSceneSnapshot();

  const nextIndex = clamp(currentIndex + delta, 0, sceneState.nodes.length - 1);
  if (nextIndex === currentIndex) return readSceneSnapshot();

  const [node] = sceneState.nodes.splice(currentIndex, 1);
  sceneState.nodes.splice(nextIndex, 0, node);
  sceneState.nodes = reindexSceneNodes(sceneState.nodes);
  return readSceneSnapshot();
}

function toggleSceneNodeEnabled(nodeId, nextEnabled = null) {
  const node = findMutableSceneNode(nodeId);
  if (!node) return readSceneSnapshot();

  const enabled = typeof nextEnabled === "boolean" ? nextEnabled : !node.enabled;
  node.enabled = enabled;

  return readSceneSnapshot();
}

function buildNextOrbId(orbs) {
  let maxIndex = -1;
  for (const orb of orbs) {
    const match = typeof (orb && orb.id) === "string" ? orb.id.match(/(\d+)$/) : null;
    if (!match) continue;
    const nextIndex = Number.parseInt(match[1], 10);
    if (Number.isInteger(nextIndex) && nextIndex > maxIndex) maxIndex = nextIndex;
  }
  return `ORB${maxIndex + 1}`;
}

function createNewOrbSetting(orbs) {
  const fallback = readDefaultOrbFallback(Array.isArray(orbs) ? orbs.length : 0);
  return normalizeOrbDef({
    id: buildNextOrbId(Array.isArray(orbs) ? orbs : []),
  }, fallback);
}

function addSceneOrb(nodeId) {
  return updateSceneNodeSettings(nodeId, (currentSettings) => {
    const next = sanitizeOrbSettings(currentSettings);
    next.push(createNewOrbSetting(next));
    return next;
  }, { persist: true });
}

function removeSceneOrb(nodeId, orbIndex) {
  return updateSceneNodeSettings(nodeId, (currentSettings) => {
    const next = sanitizeOrbSettings(currentSettings);
    if (next.length <= 1) return next;
    if (!Number.isInteger(orbIndex) || orbIndex < 0 || orbIndex >= next.length) return next;
    next.splice(orbIndex, 1);
    return next;
  }, { persist: true });
}

function updateSceneOrb(nodeId, orbIndex, patch = {}) {
  return updateSceneNodeSettings(nodeId, (currentSettings) => {
    const next = sanitizeOrbSettings(currentSettings);
    if (!Number.isInteger(orbIndex) || orbIndex < 0 || orbIndex >= next.length) return next;

    const currentOrb = next[orbIndex];
    const rawPatch = patch && typeof patch === "object" ? patch : {};
    const nextOrb = normalizeOrbDef({
      ...currentOrb,
      ...rawPatch,
    }, currentOrb || readDefaultOrbFallback(orbIndex));

    if (Object.prototype.hasOwnProperty.call(rawPatch, "bandIds")) {
      nextOrb.bandIds = sanitizeOrbBandIds(rawPatch.bandIds, null);
    }

    next[orbIndex] = nextOrb;
    return next;
  }, { persist: true });
}

function resetSceneRuntimeFromPreferences() {
  return setSceneNodes(buildSceneNodesFromPreferences(), { preserveSelection: false });
}

function syncSceneRuntimeFromPreferences() {
  return setSceneNodes(buildSceneNodesFromPreferences({ preserveRuntimeState: true }), { preserveSelection: true });
}

export {
  addSceneOrb,
  moveSceneNode,
  readSceneNodeDisplayName,
  readSceneRuntime,
  readSceneSettingsSchema,
  readSceneSnapshot,
  readSelectedSceneNode,
  removeSceneOrb,
  replaceSceneNodeSettings,
  resetSceneRuntimeFromPreferences,
  selectSceneNode,
  syncSceneRuntimeFromPreferences,
  toggleSceneNodeEnabled,
  updateSceneNodeSettings,
  updateSceneOrb,
};
