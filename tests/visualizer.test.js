import test from "node:test";
import assert from "node:assert/strict";

import { createVisualizerRegistry, registerBuiltInVisualizers } from "../src/js/render/visualizer.js";

function createValidVisualizerInstance(extra = {}) {
  return {
    init() {},
    update() {},
    render() {},
    resize() {},
    dispose() {},
    ...extra,
  };
}

test("registerBuiltInVisualizers registers the current built-in visualizer types and exposes cloned metadata", () => {
  const registry = createVisualizerRegistry();
  registerBuiltInVisualizers(registry, {
    legacyRenderFactory: () => createValidVisualizerInstance(),
  });

  assert.equal(registry.has("legacyRender"), true);
  assert.equal(registry.has("orbs"), true);
  assert.equal(registry.has("bandOverlay"), true);
  assert.equal(registry.get("missing"), null);

  const legacyInstance = registry.create("legacyRender");
  assert.equal(typeof legacyInstance.render, "function");

  const orbsCapabilities = registry.getCapabilities("orbs");
  const orbsSchema = registry.getSettingsSchema("orbs");
  const orbsDefaultNode = registry.getDefaultNode("orbs");
  const bandOverlayCapabilities = registry.getCapabilities("bandOverlay");
  const bandOverlaySchema = registry.getSettingsSchema("bandOverlay");
  const bandOverlayDefaultNode = registry.getDefaultNode("bandOverlay");

  assert.deepEqual(orbsCapabilities, { runtimeImplemented: false, transitional: true });
  assert.equal(orbsSchema.kind, "array");
  assert.equal(orbsSchema.item.kind, "object");
  assert.equal(orbsSchema.item.fields.bandIds.item.max, 255);
  assert.equal(orbsDefaultNode.id, "orbs-1");
  assert.deepEqual(orbsDefaultNode.bounds, { x: 0.5, y: 0.5, w: 1, h: 1 });
  assert.deepEqual(bandOverlayCapabilities, { runtimeImplemented: false, transitional: true });
  assert.equal(bandOverlaySchema.kind, "object");
  assert.deepEqual(
    bandOverlaySchema.fields.lineWidthPx,
    { type: "number", default: 1, min: 1, max: 6, step: 1 }
  );
  assert.equal(typeof bandOverlaySchema.fields.phaseMode, "object");
  assert.equal(bandOverlayDefaultNode.id, "overlay-1");
  assert.equal(registry.get("bandOverlay").type, "bandOverlay");

  orbsCapabilities.transitional = false;
  orbsSchema.item.fields.chanId.default = "L";
  orbsDefaultNode.settings[0].id = "mutated";
  bandOverlayCapabilities.transitional = false;
  bandOverlaySchema.fields.lineWidthPx.min = -1;
  bandOverlayDefaultNode.settings.lineWidthPx = 99;

  assert.deepEqual(registry.getCapabilities("orbs"), { runtimeImplemented: false, transitional: true });
  assert.equal(registry.getSettingsSchema("orbs").item.fields.chanId.default, "C");
  assert.equal(registry.getDefaultNode("orbs").settings[0].id, "ORB0");
  assert.deepEqual(registry.getCapabilities("bandOverlay"), { runtimeImplemented: false, transitional: true });
  assert.equal(registry.getSettingsSchema("bandOverlay").fields.lineWidthPx.min, 1);
  assert.equal(registry.getDefaultNode("bandOverlay").settings.lineWidthPx, 1);
});

test("register throws when the same visualizer type is registered twice", () => {
  const registry = createVisualizerRegistry();
  registry.register("layer", () => createValidVisualizerInstance());

  assert.throws(
    () => registry.register("layer", () => createValidVisualizerInstance()),
    /Visualizer type "layer" is already registered\./
  );
});

test("create instantiates both class-based and factory-based visualizers", () => {
  const registry = createVisualizerRegistry();

  class ClassVisualizer {
    constructor(options) {
      this.options = options;
    }

    init() {}
    update() {}
    render() {}
    resize() {}
    dispose() {}
  }

  registry.register("classy", ClassVisualizer);
  registry.register("factory", (options) => createValidVisualizerInstance({ options }));

  const classInstance = registry.create("classy", { node: { id: "class-node" } });
  const factoryInstance = registry.create("factory", { node: { id: "factory-node" } });

  assert.ok(classInstance instanceof ClassVisualizer);
  assert.equal(classInstance.options.node.id, "class-node");
  assert.equal(factoryInstance.options.node.id, "factory-node");
});

test("create reports unknown and metadata-only visualizer types explicitly", () => {
  const registry = createVisualizerRegistry();
  registry.register("metadataOnly", null, {
    capabilities: { runtimeImplemented: false, transitional: true },
  });

  assert.throws(
    () => registry.create("missing"),
    /Unknown visualizer type "missing"\./
  );
  assert.throws(
    () => registry.create("metadataOnly"),
    /registered without a runtime implementation/
  );
});

test("create validates returned instances and required lifecycle methods", () => {
  const registry = createVisualizerRegistry();
  registry.register("primitive", () => 123);
  registry.register("partial", () => ({
    init() {},
    update() {},
    render() {},
    resize() {},
  }));

  assert.throws(
    () => registry.create("primitive"),
    /did not return an object instance/
  );
  assert.throws(
    () => registry.create("partial"),
    /missing required lifecycle methods: dispose/
  );
});
