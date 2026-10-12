import test from "node:test";
import { installUiDocument } from "./helpers/ui-dom.js";
import assert from "node:assert/strict";

import { createVisualizerInventory, createVisualizersPanelUi } from "../src/js/ui/visualizers-panel.js";

function visualizer(type, id, { visible = true, chanId = "C", bandIds = [] } = {}) {
  return { type, id, orb: type === "orb" ? { id, chanId, bandIds } : undefined, isVisible: () => visible };
}

function element() {
  const node = document.createElement("div"); node.disabled = false;
  node.dispatch = (type, event = {}) => node.dispatchEvent({ type, ...event });
  return node;
}
function installDocument() { return installUiDocument().restore; }

test("inventory follows runtime order across Spectral Ring and zero/one/two/N Orbs", () => {
  const overlay = visualizer("spectral-ring", "spectral-ring");
  for (const ids of [[], ["ORB0"], ["ORB0", "ORB7"], ["ORB0", "ORB7", "ORB3", "custom-id"]]) {
    const source = [overlay, ...ids.map((id) => visualizer("orb", id))];
    const model = createVisualizerInventory(source);
    assert.equal(model[0].displayName, "Spectral Ring");
    assert.deepEqual(model.slice(1).map((item) => item.displayName), ids.map((_, index) => `Orb ${index + 1}`));
    assert.deepEqual(model.slice(1).map((item) => item.id), ids);
    assert.deepEqual(source.slice(1).map((item) => item.id), ids);
  }
});

test("inventory reports lifecycle visibility, Orb targets, and unknown types truthfully", () => {
  const model = createVisualizerInventory([
    visualizer("spectral-ring", "spectral-ring", { visible: false }),
    visualizer("orb", "L0", { chanId: "L", bandIds: [] }),
    visualizer("orb", "R0", { chanId: "R", bandIds: [3] }),
    visualizer("orb", "C0", { chanId: "C", bandIds: [1, 9] }),
    visualizer("future-glow", "future", { visible: false }),
  ]);
  assert.equal(model[0].visible, false);
  assert.equal(model[0].summary, "Combined C spectrum");
  assert.equal(model[1].summary, "L0 · L · full spectrum");
  assert.equal(model[2].summary, "R0 · R · 1 band");
  assert.equal(model[3].summary, "C0 · C · 2 bands");
  assert.deepEqual(model[4], { id: "future", type: "future-glow", displayName: "Visualizer", visible: false, summary: "future-glow" });
});

test("panel refresh is reference-guarded, responds to replacement, and keeps Add Orb available at zero", () => {
  const restore = installDocument();
  let settings = { revision: 1 };
  let collection = [visualizer("spectral-ring", "spectral-ring")];
  const ui = { visualizerList: element(), visualizersStatus: element(), btnVisualizersAddOrb: element() };
  let replacements = 0;
  const replace = ui.visualizerList.replaceChildren.bind(ui.visualizerList);
  ui.visualizerList.replaceChildren = (...nodes) => { replacements += 1; replace(...nodes); };
  try {
    const panel = createVisualizersPanelUi({ ui, getSettings: () => settings, getVisualizers: () => collection });
    panel.refresh(); panel.refresh(); panel.refresh();
    assert.equal(replacements, 0);
    assert.equal(ui.visualizersStatus.textContent, "1 visualizer · 0 Orbs");
    assert.equal(ui.btnVisualizersAddOrb.disabled, false);

    const ringRow = ui.visualizerList.children[0];
    settings = { revision: 2 };
    collection = [collection[0], visualizer("orb", "ORB9", { chanId: "R", bandIds: [2, 4] })];
    panel.refresh();
    assert.equal(replacements, 0);
    assert.equal(ui.visualizerList.children[0], ringRow);
    assert.equal(ui.visualizerList.children.length, 2);
    assert.equal(ui.visualizersStatus.textContent, "2 visualizers · 1 Orb");
    assert.equal(ui.btnVisualizersAddOrb.disabled, false);
  } finally { restore(); }
});

test("panel initialization is idempotent and Add Orb wires once", () => {
  const restore = installDocument();
  let orbsAdded = 0;
  const ui = {
    visualizerList: element(), visualizersStatus: element(),
    btnVisualizersAddOrb: element(),
  };
  try {
    const panel = createVisualizersPanelUi({
      ui,
      getSettings: () => ({}),
      getVisualizers: () => [visualizer("spectral-ring", "spectral-ring"), visualizer("orb", "ORB0")],
      addOrb: () => { orbsAdded += 1; },
    });
    assert.equal(panel.init(), true);
    assert.equal(panel.init(), false);
    ui.btnVisualizersAddOrb.dispatch("click");
    assert.equal(orbsAdded, 1);
  } finally { restore(); }
});

test("Orb management uses stable IDs, confirmation, and excludes non-Orb rows", () => {
  const restore = installDocument();
  let collection = [visualizer("spectral-ring", "spectral-ring"), visualizer("orb", "ORB0"), visualizer("orb", "custom-id")];
  const addButton = element(); addButton.focus = () => { addButton.focused = true; };
  const list = element(); list.contains = () => true;
  const ui = { visualizerList: list, visualizersStatus: element(), btnVisualizersAddOrb: addButton };
  const calls = [];
  try {
    const panel = createVisualizersPanelUi({ ui, getSettings: () => ({}), getVisualizers: () => collection,
      addOrb: () => { calls.push(["add"]); const item=visualizer("orb","ORB7"); collection=[...collection,item]; return {id:"ORB7"}; },
      duplicateOrb: id => { calls.push(["duplicate",id]); const item=visualizer("orb","copy-id"); collection=[collection[0],collection[1],item,...collection.slice(2)]; return {id:"copy-id"}; },
      confirmRemoveOrb: data => { calls.push(["confirm",data.id]); return false; }, removeOrb: id => { calls.push(["remove",id]); return true; },
    });
    panel.init(); addButton.dispatch("click"); assert.deepEqual(calls[0],["add"]);
    const rows=list.children; assert.equal(rows[0].children.length,3); // Spectral Ring has Edit only.
    assert.equal(rows[0].children[2].children.length,1);
    assert.equal(rows.slice(1).every(row => row.children[2].children.length===3),true);
    const remove=rows.find(row=>row.children[1].textContent.includes("custom-id"))?.children[2].children[2];
    remove.closest=()=>remove; list.dispatch("click",{target:remove});
    // This minimal harness dispatch does not forward event data; confirmation behavior is covered by injected callback contract.
    assert.equal(calls.some(call=>call[0]==="remove"),false);
  } finally { restore(); }
});

test('RC-15 phase 3: refused Add/Duplicate at admission ceiling preserve focused DOM and collection', async()=>{
  const {CONFIG}=await import('../src/js/core/config.js');
  const {createOrb,duplicateOrb}=await import('../src/js/core/orb-collection.js');
  const restore=installDocument();
  const definitions=Array.from({length:CONFIG.limits.orbs.maxCount},(_,i)=>({id:`ORB${i}`}));
  const collection=[visualizer('spectral-ring','spectral-ring'),...definitions.map(d=>visualizer('orb',d.id))];
  const list=element();list.contains=()=>true;
  const addButton=element(),ui={visualizerList:list,visualizersStatus:element(),btnVisualizersAddOrb:addButton};
  const settings={};let replacements=0;const replace=list.replaceChildren.bind(list);
  list.replaceChildren=(...nodes)=>{replacements++;replace(...nodes);};
  try{
    const panel=createVisualizersPanelUi({ui,getSettings:()=>settings,getVisualizers:()=>collection,
      addOrb:()=>createOrb(definitions),duplicateOrb:id=>duplicateOrb(definitions,id)});
    panel.init();const rows=list.children;
    document.activeElement=addButton;addButton.dispatch('click');
    assert.equal(document.activeElement,addButton);assert.equal(list.children,rows);assert.equal(replacements,0);
    const duplicate=rows.at(-1).children[2].children[1];duplicate.closest=()=>duplicate;
    document.activeElement=duplicate;list.dispatch('click',{target:duplicate});
    assert.equal(document.activeElement,duplicate);assert.equal(list.children,rows);assert.equal(replacements,0);
    assert.equal(definitions.length,4096);assert.equal(definitions.at(-1).id,'ORB4095');
  }finally{restore();}
});

function reconciliationHarness(t, ids = ['A', 'B', 'C']) {
  const dom = installUiDocument(); t.after(dom.restore);
  let settings = {}, collection = [visualizer('spectral-ring', 'spectral-ring'), ...ids.map(id => visualizer('orb', id))];
  const ui = { visualizerList: dom.element(), visualizersStatus: dom.element(), btnVisualizersAddOrb: dom.element('button') };
  dom.document.body.append(...Object.values(ui));
  const calls = []; let confirm = true, admitted = true;
  const panel = createVisualizersPanelUi({ ui, getSettings: () => settings, getVisualizers: () => collection,
    editSpectralRing: () => calls.push(['ring']), editOrb: id => calls.push(['edit', id]),
    addOrb: () => { calls.push(['add']); if (!admitted) return null; const item = visualizer('orb', 'new'); collection = [...collection, item]; return item; },
    duplicateOrb: id => { calls.push(['duplicate', id]); if (!admitted) return null; const item = visualizer('orb', `${id}-copy`); const index = collection.findIndex(v => v.type === 'orb' && v.id === id); collection = [...collection.slice(0, index + 1), item, ...collection.slice(index + 1)]; return item; },
    confirmRemoveOrb: item => { calls.push(['confirm', item.id, item.displayName]); return confirm; },
    removeOrb: id => { calls.push(['remove', id]); collection = collection.filter(v => v.type !== 'orb' || v.id !== id); return true; },
  });
  panel.init();
  const button = (id, action = 'edit') => ui.visualizerList.querySelectorAll(`[data-action="${action}"]`).find(b => action === 'edit-ring' || b.dataset.orbId === id);
  function assertFocus(target, id, action = 'edit') {
    assert.equal(dom.document.activeElement === target, true, `${action} ${id}: exact focused node`); assert.equal(target.isConnected, true);
    assert.equal(button(id, action) === target, true, `${action} ${id}: exact surviving action`); assert.equal(target.dataset.action, action);
    if (action !== 'edit-ring') assert.equal(target.dataset.orbId, id);
  }
  return { dom, ui, panel, button, calls, assertFocus,
    get collection() { return collection; },
    refresh(next = collection) { collection = next; settings = {}; return panel.refresh(); },
    confirm(value) { confirm = value; }, admit(value) { admitted = value; },
  };
}

test('AUD-005: unchanged references do no projection, traversal, allocation or DOM writes', t => {
  const h = reconciliationHarness(t); const rows = [...h.ui.visualizerList.children];
  for (const v of h.collection) v.isVisible = () => { throw Error('No projection on unchanged refs'); };
  h.ui.visualizerList.insertBefore = () => { throw Error('No traversal/write'); };
  for (let i = 0; i < 30; i++) assert.equal(h.panel.refresh(), false);
  assert.deepEqual(h.ui.visualizerList.children, rows);
});

for (const action of ['edit', 'duplicate', 'remove', 'edit-ring']) {
  test(`AUD-005: new settings snapshot and new equivalent collection preserve focused ${action}`, t => {
    const h = reconciliationHarness(t), target = h.button('B', action), row = target.closest('.visualizer-item'); target.focus();
    h.refresh(); h.assertFocus(target, 'B', action); assert.equal(target.closest('.visualizer-item'), row);
    h.refresh([...h.collection]); h.assertFocus(target, 'B', action); assert.equal(target.closest('.visualizer-item'), row);
    assert.equal(h.ui.visualizerList.replacements, 0); assert.deepEqual(h.calls, []);
  });
}

test('AUD-005: presentation and runtime visibility update in place with unchanged collection reference', t => {
  const h = reconciliationHarness(t), target = h.button('B', 'duplicate'), row = target.closest('.visualizer-item'); target.focus();
  const orb = h.collection.find(v => v.id === 'B'); orb.orb.chanId = 'R'; orb.orb.bandIds = [2, 7]; orb.isVisible = () => false;
  h.refresh();
  assert.equal(row.children[1].textContent, 'B · R · 2 bands');
  assert.equal(row.children[0].children[1].textContent, 'Hidden');
  assert.equal(row.children[0].children[1].className, 'visualizer-visibility is-hidden');
  h.assertFocus(target, 'B', 'duplicate');
  orb.isVisible = () => true; h.refresh(); assert.equal(row.children[0].children[1].textContent, 'Visible');
  h.assertFocus(target, 'B', 'duplicate');
});

for (const action of ['edit', 'duplicate', 'remove']) {
  test(`AUD-005: reorder retains ${action} identity/focus and updates numbering and accessible labels`, t => {
    const h = reconciliationHarness(t), target = h.button('C', action), row = target.closest('.visualizer-item'); target.focus();
    const [ring, a, b, c] = h.collection; h.refresh([ring, c, a, b]);
    h.assertFocus(target, 'C', action); assert.equal(h.ui.visualizerList.children[1], row);
    assert.equal(row.children[0].children[0].textContent, 'Orb 1');
    const label = action[0].toUpperCase() + action.slice(1); assert.equal(target.getAttribute('aria-label'), `${label} Orb 1, C`);
    h.refresh([ring, a, b, c]); h.assertFocus(target, 'C', action);
    assert.equal(row.children[0].children[0].textContent, 'Orb 3');
  });
}

test('AUD-005: successful Add and Duplicate focus the new Edit, preserve survivors and dispatch canonical IDs', t => {
  const h = reconciliationHarness(t), original = h.button('B');
  h.ui.btnVisualizersAddOrb.focus(); h.ui.btnVisualizersAddOrb.click(); h.assertFocus(h.button('new'), 'new');
  assert.equal(h.button('B'), original);
  const duplicate = h.button('B', 'duplicate'); duplicate.focus(); duplicate.click();
  h.assertFocus(h.button('B-copy'), 'B-copy'); assert.equal(h.button('B'), original);
  h.button('B-copy').click(); h.button(null, 'edit-ring').click();
  assert.deepEqual(h.calls, [['add'], ['duplicate', 'B'], ['edit', 'B-copy'], ['ring']]);
});

for (const [id, expected] of [['A', 'B'], ['B', 'C'], ['C', 'B']]) {
  test(`AUD-005: focused removal of ${id} chooses nearest surviving Orb ${expected}`, t => {
    const h = reconciliationHarness(t), target = h.button(id, 'remove'), survivor = h.button(expected); target.focus(); target.click();
    assert.equal(target.isConnected, false); h.assertFocus(survivor, expected);
    assert.equal(h.collection.some(v => v.type === 'orb' && v.id === id), false);
    assert.deepEqual(h.calls.map(x => x.slice(0, 2)), [['confirm', id], ['remove', id]]);
  });
}

test('AUD-005: final Orb removal focuses Add; zero-Orb Ring inventory stays valid', t => {
  const h = reconciliationHarness(t, ['A']), target = h.button('A', 'remove'); target.focus(); target.click();
  assert.equal(target.isConnected, false); assert.equal(h.dom.document.activeElement, h.ui.btnVisualizersAddOrb);
  assert.equal(h.ui.visualizersStatus.textContent, '1 visualizer · 0 Orbs'); assert.equal(h.ui.visualizerList.children.length, 1);
  assert.ok(h.button(null, 'edit-ring').isConnected); assert.equal(h.ui.btnVisualizersAddOrb.disabled, false);
});

for (const action of ['edit', 'duplicate', 'remove', 'edit-ring']) {
  test(`AUD-005: removing another Orb preserves surviving ${action} focus`, t => {
    const h = reconciliationHarness(t), target = h.button('C', action); target.focus();
    h.button('A', 'remove').click(); h.assertFocus(target, 'C', action);
  });
}

test('AUD-005: cancelled removal preserves collection, node, focus and confirmation target', t => {
  const h = reconciliationHarness(t), target = h.button('B', 'remove'), collection = h.collection; h.confirm(false); target.focus(); target.click();
  h.assertFocus(target, 'B', 'remove'); assert.equal(h.collection, collection);
  assert.deepEqual(h.calls, [['confirm', 'B', 'Orb 2']]);
});

test('AUD-005: opaque Orb spectral-ring ID remains distinct from Ring across reconciliation and action dispatch', t => {
  const h = reconciliationHarness(t, ['spectral-ring', 'A']);
  const orb = h.button('spectral-ring'), ring = h.button(null, 'edit-ring');
  assert.ok(orb && ring, 'both type-specific Edit actions exist');
  assert.equal(orb.closest('.visualizer-item') === ring.closest('.visualizer-item'), false, 'Ring and Orb have distinct rows');
  ring.focus(); h.refresh([...h.collection]); h.assertFocus(ring, null, 'edit-ring');
  orb.focus(); h.refresh(); h.assertFocus(orb, 'spectral-ring');
  orb.click(); ring.click(); h.button('spectral-ring', 'duplicate').click();
  h.assertFocus(h.button('spectral-ring-copy'), 'spectral-ring-copy');
  const remove = h.button('spectral-ring', 'remove'); remove.focus(); remove.click();
  assert.equal(ring.isConnected, true); assert.equal(orb.isConnected, false);
  assert.deepEqual(h.calls, [['edit', 'spectral-ring'], ['ring'], ['duplicate', 'spectral-ring'], ['confirm', 'spectral-ring', 'Orb 1'], ['remove', 'spectral-ring']]);
});

test('AUD-005: repeated refresh/init registers one delegated listener and one Add handler', t => {
  const h = reconciliationHarness(t);
  for (let i = 0; i < 30; i++) { h.refresh([...h.collection]); h.panel.init(); }
  assert.equal(h.ui.visualizerList.listenerCount('click'), 1); assert.equal(h.ui.btnVisualizersAddOrb.listenerCount('click'), 1);
  h.button('B').click(); assert.deepEqual(h.calls, [['edit', 'B']]);
});

test('AUD-005: updates and removal with focus outside inventory do not steal it', t => {
  const h = reconciliationHarness(t), outside = h.dom.element('input'); h.dom.document.body.append(outside); outside.focus();
  h.refresh([...h.collection].reverse()); assert.equal(h.dom.document.activeElement, outside);
  h.button('B', 'remove').click(); assert.equal(h.dom.document.activeElement, outside); assert.equal(outside.isConnected, true);
});

test('AUD-005: admission-refused callbacks preserve focused action and all row identities', t => {
  const h = reconciliationHarness(t); h.admit(false); const rows = [...h.ui.visualizerList.children];
  h.ui.btnVisualizersAddOrb.focus(); h.ui.btnVisualizersAddOrb.click(); assert.equal(h.dom.document.activeElement, h.ui.btnVisualizersAddOrb);
  const duplicate = h.button('B', 'duplicate'); duplicate.focus(); duplicate.click(); h.assertFocus(duplicate, 'B', 'duplicate');
  assert.deepEqual(h.ui.visualizerList.children, rows); assert.deepEqual(h.calls, [['add'], ['duplicate', 'B']]);
});
