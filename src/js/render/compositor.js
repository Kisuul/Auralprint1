const IDENTITY_VIEW_TRANSFORM = Object.freeze({ kind: "identity" });

function readSceneNodes(scene) {
  return Array.isArray(scene && scene.nodes) ? scene.nodes : [];
}

function readTargetSizeKey(target) {
  const widthPx = Number.isFinite(target && target.widthPx) ? target.widthPx : 0;
  const heightPx = Number.isFinite(target && target.heightPx) ? target.heightPx : 0;
  const dpr = Number.isFinite(target && target.dpr) ? target.dpr : 1;
  return `${widthPx}|${heightPx}|${dpr}`;
}

function sceneNodeToPixelBounds(node, target) {
  const bounds = (node && node.bounds && typeof node.bounds === "object") ? node.bounds : {};
  const anchor = (node && node.anchor && typeof node.anchor === "object") ? node.anchor : {};

  const widthPx = Number.isFinite(target && target.widthPx) ? target.widthPx : 0;
  const heightPx = Number.isFinite(target && target.heightPx) ? target.heightPx : 0;

  const width = (Number.isFinite(bounds.w) ? bounds.w : 0) * widthPx;
  const height = (Number.isFinite(bounds.h) ? bounds.h : 0) * heightPx;
  const anchorX = Number.isFinite(anchor.x) ? anchor.x : 0;
  const anchorY = Number.isFinite(anchor.y) ? anchor.y : 0;

  return {
    x: (Number.isFinite(bounds.x) ? bounds.x : 0) * widthPx - anchorX * width,
    y: (Number.isFinite(bounds.y) ? bounds.y : 0) * heightPx - anchorY * height,
    width,
    height,
  };
}

function boundsEqual(a, b) {
  return !!a
    && !!b
    && a.x === b.x
    && a.y === b.y
    && a.width === b.width
    && a.height === b.height;
}

function sortEntries(a, b) {
  if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex;
  return a.sceneIndex - b.sceneIndex;
}

function createCompositor({ factories = {} } = {}) {
  const liveEntries = new Map();
  let activeEntries = [];

  function disposeEntry(entry) {
    if (!entry || !entry.instance || typeof entry.instance.dispose !== "function") return;
    entry.instance.dispose();
  }

  function syncScene(scene, target) {
    const nodes = readSceneNodes(scene);
    const enabledNodeIds = new Set();
    const targetSizeKey = readTargetSizeKey(target);

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!node || typeof node.id !== "string" || !node.id || typeof node.type !== "string" || !node.type) continue;

      if (!node.enabled) {
        const disabledEntry = liveEntries.get(node.id);
        if (disabledEntry) {
          disposeEntry(disabledEntry);
          liveEntries.delete(node.id);
        }
        continue;
      }

      enabledNodeIds.add(node.id);

      let entry = liveEntries.get(node.id);
      if (entry && entry.type !== node.type) {
        disposeEntry(entry);
        liveEntries.delete(node.id);
        entry = null;
      }

      if (!entry) {
        const factory = factories[node.type];
        if (typeof factory !== "function") {
          throw new Error(`No compositor factory registered for scene node type "${node.type}".`);
        }

        const instance = factory(node);
        if (!instance || typeof instance !== "object") {
          throw new Error(`Compositor factory for "${node.type}" did not return an instance.`);
        }

        if (typeof instance.init === "function") {
          instance.init({
            canvas: target ? target.canvas : null,
            ctx: target ? target.ctx : null,
            widthPx: Number.isFinite(target && target.widthPx) ? target.widthPx : 0,
            heightPx: Number.isFinite(target && target.heightPx) ? target.heightPx : 0,
            dpr: Number.isFinite(target && target.dpr) ? target.dpr : 1,
            node,
          });
        }

        entry = {
          id: node.id,
          type: node.type,
          instance,
          sceneIndex: i,
          zIndex: Number.isFinite(node.zIndex) ? node.zIndex : 0,
          boundsPx: null,
          targetSizeKey: "",
        };
        liveEntries.set(node.id, entry);
      }

      entry.sceneIndex = i;
      entry.zIndex = Number.isFinite(node.zIndex) ? node.zIndex : 0;

      const nextBoundsPx = sceneNodeToPixelBounds(node, target);
      if (!boundsEqual(entry.boundsPx, nextBoundsPx) || entry.targetSizeKey !== targetSizeKey) {
        if (typeof entry.instance.resize === "function") entry.instance.resize(nextBoundsPx);
        entry.boundsPx = nextBoundsPx;
        entry.targetSizeKey = targetSizeKey;
      }
    }

    for (const [id, entry] of liveEntries) {
      if (enabledNodeIds.has(id)) continue;
      disposeEntry(entry);
      liveEntries.delete(id);
    }

    activeEntries = Array.from(liveEntries.values()).sort(sortEntries);
  }

  function update(frame, dtSec) {
    for (const entry of activeEntries) {
      if (typeof entry.instance.update === "function") entry.instance.update(frame, dtSec);
    }
  }

  function render(target) {
    for (const entry of activeEntries) {
      if (typeof entry.instance.render === "function") entry.instance.render(target, IDENTITY_VIEW_TRANSFORM);
    }
  }

  function dispose() {
    for (const entry of liveEntries.values()) disposeEntry(entry);
    liveEntries.clear();
    activeEntries = [];
  }

  return { syncScene, update, render, dispose };
}

export { IDENTITY_VIEW_TRANSFORM, createCompositor };
