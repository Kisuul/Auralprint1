# Build 115 Visualizer Contract

Visualisers are pluggable modules that turn analysis data into graphics.  The contract defined in this document standardises how visualisers are initialised, updated and rendered.  By following this contract, new visual effects can be added without touching the core rendering loop or analyser code.

## Interface

Every visualiser module must export a class or factory function that implements the following methods:

| Method                     | Purpose                                                                                                                |
|---------------------------|-------------------------------------------------------------------------------------------------------------------------|
| `init(context)`           | Called once when the visualiser is created.  Receives a context object containing a canvas or offscreen target, GL/2D context, dimensions and any global render resources.  It should set up any WebGL programs or 2D primitives it needs. |
| `update(frame, dt)`       | Called on every animation tick before rendering.  Receives the current `BandFrame` (and optionally the underlying `AnalysisFrame`) and the time delta since the last update in seconds.  Should update the visualiser’s local simulation state (e.g. particle positions) based on the data. |
| `render(target, view)`    | Called on every animation tick to draw the visualiser’s output.  Receives the rendering target (a canvas context or framebuffer) and a view transform object (placeholder for camera controls).  Must draw only within its allocated bounds. |
| `resize(bounds)`          | Called whenever the render surface or the visualiser’s bounds change.  Receives new bounds (x, y, width, height) in pixels.  Must resize internal buffers or viewports accordingly. |
| `dispose()`               | Called when the visualiser instance is removed from the scene.  Should release any WebGL resources, timers or event listeners. |

### Optional methods

Visualisers may implement the following optional methods:

| Method                       | Purpose                                                                                               |
|-----------------------------|--------------------------------------------------------------------------------------------------------|
| `getCapabilities()`         | Returns a list or object describing any special capabilities (e.g. requires phase data, supports stereoscopy).  Used by the Scene panel to enable/disable incompatible options. |
| `getSettingsSchema()`       | Returns a JSON‑serialisable schema describing the adjustable parameters for this visualiser (e.g. particle count, trail length).  The Scene panel uses this to generate UI controls. |
| `getDefaultNode()`          | Returns a default `SceneNode` configuration for this visualiser.  Used when creating a new instance in the scene. |

## Contract rules

1. **No direct audio access** – Visualisers must not access Web Audio nodes or the analyser directly.  All required data is passed via the `BandFrame`/`AnalysisFrame` arguments.
2. **Immutability of frames** – Visualisers must treat the incoming frames as read‑only and should not cache them beyond the current tick.
3. **Local simulation state** – Each visualiser instance manages its own simulation state (particles, rotations, colours).  It must not store state globally that would bleed across multiple instances.
4. **Respect bounds** – Visualisers draw only within the bounds provided by `resize()` and `render()`.  They do not clear or overwrite areas outside their rectangle.
5. **Performance** – Heavy computations should occur in `update()`, keeping `render()` as lightweight as possible.  Avoid allocating large objects in the hot path.
6. **Settings and presets** – Adjustable parameters must be exposed via `getSettingsSchema()` so they can be persisted in presets.  Runtime‑only state (e.g. current particle positions) should not be persisted.

## Example stub

```js
// Example visualiser skeleton
export default class ExampleVisualizer {
  init({ ctx, width, height }) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    // set up resources here
  }

  update(frame, dt) {
    // update simulation based on frame.bands
  }

  render(target, view) {
    const { ctx } = this;
    ctx.save();
    // draw within this.width x this.height
    ctx.restore();
  }

  resize({ width, height }) {
    this.width = width;
    this.height = height;
  }

  dispose() {
    // free resources
  }

  getSettingsSchema() {
    return {
      particleCount: { type: 'number', default: 200, min: 0, max: 1000 },
      colourShift: { type: 'number', default: 0, min: 0, max: 360 },
    };
  }
}
```

Implementations can vary in complexity (2D canvas, WebGL, shaders), but the contract must be honoured.  This structure allows Auralprint to support multiple visual effects in the future without rewriting the engine.
