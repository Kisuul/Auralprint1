function readVisibility(visualizer) {
  return typeof visualizer?.isVisible === "function" ? !!visualizer.isVisible() : true;
}

function describeOrbTarget(orb) {
  const bandIds = Array.isArray(orb?.bandIds) ? orb.bandIds : [];
  if (!bandIds.length) return "full spectrum";
  return bandIds.length === 1 ? "1 band" : `${bandIds.length} bands`;
}

function createVisualizerInventory(visualizers = []) {
  let orbPosition = 0;
  return Array.from(visualizers, (visualizer) => {
    const type = typeof visualizer?.type === "string" ? visualizer.type : "unknown";
    const id = typeof visualizer?.id === "string" ? visualizer.id : "";
    const visible = readVisibility(visualizer);
    if (type === "spectral-ring") {
      return {
        id,
        type,
        displayName: "Spectral Ring",
        visible,
        summary: "Combined C spectrum",
      };
    }
    if (type === "orb") {
      orbPosition += 1;
      const orb = visualizer.orb || {};
      const channel = ["L", "R", "C"].includes(orb.chanId) ? orb.chanId : "C";
      return {
        id,
        type,
        displayName: `Orb ${orbPosition}`,
        visible,
        summary: `${id || "Unidentified"} · ${channel} · ${describeOrbTarget(orb)}`,
      };
    }
    return {
      id,
      type,
      displayName: "Visualizer",
      visible,
      summary: type !== "unknown" ? type : (id || "Unknown type"),
    };
  });
}

function createVisualizersPanelUi({
  ui,
  getVisualizers = () => [],
  getSettings = () => null,
  editSpectralRing = () => {},
  addOrb = () => null,
  editOrb = () => {},
  duplicateOrb = () => null,
  removeOrb = () => false,
  confirmRemoveOrb = () => false,
} = {}) {
  let initializedOn = null;
  let lastSettingsRef = null;
  let lastVisualizerCollectionRef = null;

  // Presentation cache only; VisualizerRuntime remains the collection owner.
  let rows = new Map();
  const inventoryKey = (item) => JSON.stringify([item.type, item.id]);

  function createRow(item) {
    const row = document.createElement("div");
    row.className = "visualizer-item";
    row.setAttribute("role", "listitem");
    const heading = document.createElement("div");
    heading.className = "visualizer-item-heading";
    const name = document.createElement("strong");
    const visibility = document.createElement("span");
    heading.append(name, visibility);
    const summary = document.createElement("div");
    summary.className = "visualizer-item-summary";
    row.append(heading, summary);
    const buttons = [];
    if (item.type === "orb" || item.type === "spectral-ring") {
      const actions = document.createElement("div");
      actions.className = "visualizer-item-actions";
      const actionDefs = item.type === "spectral-ring" ? [["edit-ring", "Edit"]] : [["edit", "Edit"], ["duplicate", "Duplicate"], ["remove", "Remove"]];
      for (const [action, label] of actionDefs) {
        const button = document.createElement("button");
        button.type = "button"; button.dataset.action = action;
        if (item.type === "orb") button.dataset.orbId = item.id;
        button.textContent = label;
        if (action === "remove") button.className = "is-destructive";
        actions.appendChild(button);
        buttons.push(button);
      }
      row.appendChild(actions);
    }
    return { row, name, visibility, summary, buttons, item: null };
  }

  function updateRow(entry, item) {
    const previous = entry.item;
    if (previous?.displayName !== item.displayName) {
      entry.name.textContent = item.displayName;
      for (const button of entry.buttons) button.setAttribute("aria-label", `${button.textContent} ${item.displayName}, ${item.id}`);
    }
    if (previous?.visible !== item.visible) {
      entry.visibility.className = `visualizer-visibility ${item.visible ? "is-visible" : "is-hidden"}`;
      entry.visibility.textContent = item.visible ? "Visible" : "Hidden";
    }
    if (previous?.summary !== item.summary) entry.summary.textContent = item.summary;
    entry.item = item;
  }

  function render(items) {
    const list = ui?.visualizerList;
    if (!list) return;
    const focused = list.contains(document.activeElement) ? document.activeElement : null;
    const next = new Map();
    for (const item of items) {
      const key = inventoryKey(item);
      const entry = rows.get(key) || createRow(item);
      updateRow(entry, item);
      next.set(key, entry);
    }
    for (const [key, entry] of rows) if (!next.has(key)) entry.row.remove();
    let cursor = list.firstElementChild;
    for (const entry of next.values()) {
      if (entry.row !== cursor) list.insertBefore(entry.row, cursor);
      cursor = entry.row.nextElementSibling;
    }
    rows = next;
    // Native insertBefore can blur a moved row. Restore only the exact surviving
    // inventory control captured before reconciliation, never external focus.
    if (focused && list.contains(focused) && document.activeElement !== focused) focused.focus();
  }

  function focusEdit(id) {
    const buttons = ui?.visualizerList?.querySelectorAll?.('[data-action="edit"]') || [];
    const target = Array.from(buttons).find((button) => button.dataset.orbId === id);
    target?.focus(); return !!target;
  }

  function forceRefresh() { lastSettingsRef = null; lastVisualizerCollectionRef = null; refresh(); }

  function onListClick(event) {
    const button = event.target?.closest?.("button[data-action]");
    if (!button || !ui.visualizerList.contains(button)) return;
    if (button.dataset.action === "edit-ring") { editSpectralRing(); return; }
    const id = button.dataset.orbId;
    if (button.dataset.action === "edit") { editOrb(id); return; }
    if (button.dataset.action === "duplicate") { const created = duplicateOrb(id); if (created?.id) { forceRefresh(); focusEdit(created.id); } return; }
    if (button.dataset.action === "remove") {
      const items = createVisualizerInventory(getVisualizers() || []); const index = items.filter((item) => item.type === "orb").findIndex((item) => item.id === id);
      const item = items.find((entry) => entry.type === "orb" && entry.id === id); if (!item || !confirmRemoveOrb({ id, displayName: item.displayName })) return;
      const restoreRemovedFocus = button.closest(".visualizer-item")?.contains(document.activeElement);
      if (!removeOrb(id)) return; forceRefresh();
      if (!restoreRemovedFocus) return;
      const survivors = createVisualizerInventory(getVisualizers() || []).filter((entry) => entry.type === "orb");
      const focus = survivors[index] || survivors[index - 1]; if (focus) focusEdit(focus.id); else ui.btnVisualizersAddOrb?.focus();
    }
  }

  function onAdd() { const created = addOrb(); if (!created?.id) return; forceRefresh(); focusEdit(created.id); }

  function refresh() {
    const settingsRef = getSettings();
    const visualizers = getVisualizers() || [];
    if (settingsRef === lastSettingsRef && visualizers === lastVisualizerCollectionRef) return false;
    lastSettingsRef = settingsRef;
    lastVisualizerCollectionRef = visualizers;

    const items = createVisualizerInventory(visualizers);
    const orbCount = items.filter((item) => item.type === "orb").length;
    const visualizerLabel = items.length === 1 ? "visualizer" : "visualizers";
    const orbLabel = orbCount === 1 ? "Orb" : "Orbs";
    const status = `${items.length} ${visualizerLabel} · ${orbCount} ${orbLabel}`;
    if (ui?.visualizersStatus && ui.visualizersStatus.textContent !== status) ui.visualizersStatus.textContent = status;
    render(items);
    return true;
  }

  function init() {
    if (initializedOn === ui?.visualizerList) return false;
    initializedOn = ui?.visualizerList || null;
    ui?.visualizerList?.addEventListener("click", onListClick);
    ui?.btnVisualizersAddOrb?.addEventListener("click", onAdd);
    refresh();
    return true;
  }

  return { init, refresh, focusEdit };
}

export { createVisualizerInventory, createVisualizersPanelUi, describeOrbTarget };
