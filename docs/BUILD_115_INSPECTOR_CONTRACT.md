# Build 115 Inspector Contract

Inspectors are non‑scene consumers of analysis data.  They expose information to the user without drawing on the main render canvas.  Examples include the band table, numerical readouts, warning banners or debugging consoles.  This contract formalises how inspectors receive data and update their UI.

## Interface

Inspector modules must implement the following methods:

| Method                | Purpose                                                                                           |
|----------------------|----------------------------------------------------------------------------------------------------|
| `init(panel, ui)`    | Called once when the inspector is created.  Receives the DOM node or component where it should render its UI and a helper object for registering event handlers.  Should build or bind its UI elements here. |
| `update(frame)`      | Called whenever a new `BandFrame` is available.  Use this to update text, charts or other elements.  Do not perform heavy computations here. |
| `dispose()`          | Called when the inspector is removed or hidden permanently.  Should clean up event listeners, timers or DOM nodes. |

Inspectors may also implement:

| Method                     | Purpose                                                                                             |
|---------------------------|------------------------------------------------------------------------------------------------------|
| `getSettingsSchema()`     | Returns a schema describing adjustable parameters (e.g. columns to display).  Used by the Banking or Scene panels to present configuration options. |
| `getDefaultLayout()`      | Returns a default size or position suggestion for where this inspector should live within a panel. |

## Contract rules

1. **UI only** – Inspectors render into DOM/UI elements, not onto the render canvas.  They do not draw with WebGL or CanvasRenderingContext2D.
2. **Frame consumption** – Inspectors receive the same `BandFrame` used by visualisers.  They must not modify it or request additional audio data.
3. **Lightweight updates** – Since inspectors run on the UI thread, they must update efficiently.  Use `requestAnimationFrame` or other batching as appropriate, but avoid expensive operations per frame.
4. **Configurability** – When an inspector exposes adjustable parameters, they should be surfaced via `getSettingsSchema()` so that workspace presets capture user preferences.
5. **Isolation** – Inspectors must not affect each other’s state.  They are independent modules registered with the workspace shell.

## Example stub

```js
export default class DominantBandInspector {
  init(container) {
    this.el = document.createElement('div');
    this.el.className = 'dominant-band-display';
    container.appendChild(this.el);
  }

  update(bandFrame) {
    const band = bandFrame.dominantBand;
    if (band) {
      this.el.textContent = `${band.name} (${Math.round(band.energy * 100)}%)`;
    } else {
      this.el.textContent = 'No dominant band';
    }
  }

  dispose() {
    this.el.remove();
  }
}
```

By keeping inspectors simple and decoupled from rendering, Build 115 ensures that diagnostic information and status displays remain lightweight and do not interfere with the performance of the main visual scene.
