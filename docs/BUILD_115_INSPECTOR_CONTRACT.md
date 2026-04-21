# Build 115 Inspector Contract

`Inspector`s are non-scene consumers of analysis data. They expose information
to the user without drawing on the main render canvas. Examples include the
band table, dominant-band readouts, warning banners, and runtime status feeds.

## Interface

Inspector modules must implement the following methods:

| Method | Purpose |
|--------|---------|
| `init(panel, ui)` | Called once when the inspector is created. Receives the DOM node or component where it should render and any UI helpers needed for wiring events. |
| `update(frame)` | Called whenever a new `BandFrame` is available. Updates text, charts, or other instrumentation. |
| `dispose()` | Called when the inspector is removed or hidden permanently. Cleans up listeners, timers, or DOM nodes. |

Inspectors may also implement:

| Method | Purpose |
|--------|---------|
| `getSettingsSchema()` | Returns a schema for adjustable inspector settings. |
| `getDefaultLayout()` | Returns a default size or position suggestion for the UI surface that hosts the inspector. |

## Contract Rules

1. **UI only** - Inspectors render into DOM or other UI surfaces, not into the
   scene render surface.
2. **Shared frame contracts** - Inspectors consume the same `BandFrame` data
   used by visualizers and must not mutate it.
3. **Lightweight updates** - Inspectors run on the UI thread and should update
   efficiently.
4. **Configurable through UI surfaces** - If an inspector exposes adjustable
   parameters, surface them through banking or workspace configuration UI rather
   than through scene composition APIs.
5. **Isolation** - Inspectors do not share mutable runtime state with each
   other.
6. **Not scene content** - The band table and live band HUD are `Inspector`s,
   not `SceneNode`s and not `Visualizer`s.

## Example Stub

```js
export default class DominantBandInspector {
  init(container) {
    this.el = document.createElement("div");
    this.el.className = "dominant-band-display";
    container.appendChild(this.el);
  }

  update(bandFrame) {
    const band = bandFrame.dominantBand;
    if (band) {
      this.el.textContent = `${band.name} (${Math.round(band.energy * 100)}%)`;
    } else {
      this.el.textContent = "No dominant band";
    }
  }

  dispose() {
    this.el.remove();
  }
}
```

By keeping inspectors lightweight and outside the scene model, Build 115 keeps
diagnostic UI separate from visual composition.
