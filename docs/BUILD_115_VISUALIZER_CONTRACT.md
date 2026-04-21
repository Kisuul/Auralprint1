# Build 115 Visualizer Contract

`Visualizer`s are pluggable scene modules that turn analysis data into graphics.
This contract standardizes how a visualizer is initialized, updated, rendered,
resized, and disposed without coupling it to analyzer internals.

## Interface

Every visualizer module must export a class or factory function that implements
the following methods:

| Method | Purpose |
|--------|---------|
| `init(context)` | Called once when the visualizer is created. Receives a context object containing a canvas or offscreen target, graphics context, dimensions, and any shared render resources. |
| `update(frame, dt)` | Called on each animation tick before rendering. Receives the current `BandFrame` and, when needed through `frame.analysis`, the underlying `AnalysisFrame`, plus the time delta in seconds. |
| `render(target, viewTransform)` | Called on each animation tick to draw the visualizer's output. Receives the render target and the current `ViewTransform`. It must draw only within its allocated bounds. |
| `resize(bounds)` | Called whenever the render surface or the visualizer's bounds change. Receives pixel bounds `{ x, y, width, height }`. |
| `dispose()` | Called when the visualizer instance is removed from the scene. Releases timers, GPU resources, listeners, or other runtime-only state. |

### Optional Methods

Visualizers may also implement:

| Method | Purpose |
|--------|---------|
| `getCapabilities()` | Returns metadata about special requirements or supported features. |
| `getSettingsSchema()` | Returns a JSON-serializable schema for persisted visualizer settings. |
| `getDefaultNode()` | Returns a default `SceneNode` configuration for this visualizer type. |

## Contract Rules

1. **No direct audio access** - Visualizers do not read from Web Audio nodes or
   `AnalyzerCore` directly. They consume frame contracts only.
2. **Frame immutability** - Incoming `AnalysisFrame` and `BandFrame` data is
   read-only and must not be cached as mutable shared state.
3. **Local simulation state** - Each visualizer instance owns its own transient
   simulation state. It must not leak state across instances.
4. **Respect bounds** - Visualizers draw only inside the bounds assigned by the
   compositor.
5. **Performance discipline** - Heavy work belongs in `update()`. `render()`
   should stay as light as practical.
6. **Settings vs runtime state** - Persisted knobs belong in
   `getSettingsSchema()`. Transient state such as particle positions does not.
7. **Scene content only** - A visualizer is scene content. UI instrumentation
   such as the band table or band HUD is handled by `Inspector`s instead.

## Example Stub

```js
export default class ExampleVisualizer {
  init({ ctx, width, height }) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  update(frame, dt) {
    // Update simulation from frame.bands or frame.analysis.
  }

  render(target, viewTransform) {
    const { ctx } = this;
    ctx.save();
    // Draw only within this visualizer's assigned bounds.
    ctx.restore();
  }

  resize({ width, height }) {
    this.width = width;
    this.height = height;
  }

  dispose() {
    // Release runtime-only resources here.
  }

  getSettingsSchema() {
    return {
      particleCount: { type: "number", default: 200, min: 0, max: 1000 },
      colorShift: { type: "number", default: 0, min: 0, max: 360 },
    };
  }
}
```

Implementations can vary in complexity, but the contract must remain stable so
the compositor and scene model can treat every visualizer consistently.
