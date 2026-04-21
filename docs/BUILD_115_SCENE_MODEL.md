# Build 115 — Scene Model

## Purpose

Build 115 introduces a **scene model** that decouples Auralprint's visual output from the analyser and band‑banking layers. Prior versions treated the orb renderer and overlay as special‑case visuals wired directly into the main render surface. The scene model formalizes the notion that the rendering layer can be composed of multiple **visualizers** placed in a **scene**, with consistent layout semantics and a clear separation from UI/HUD elements.

The scene model creates a foundation for:

* Compositing multiple visualizers (e.g. orbs, band overlay, future effects) onto a single render surface.
* Positioning, ordering, and optionally resizing visualizers without altering analyser logic.
* Clean migration of legacy presets to new scene structures.
* Preparing for Build 116’s camera work by introducing a view transform abstraction.

This document defines the key data structures and responsibilities of the scene model.

## Scene and Scene Nodes

### Scene

A **scene** represents the collection of active visualizer instances currently rendered in the application. It provides a central point for composition, layout and eventual camera/view control. The scene is runtime‑only; persisted presets store the configuration necessary to recreate a scene (i.e. visualizer types and settings), but the actual node instances are created on load.

Key properties:

| Property         | Description                                                               |
|------------------|---------------------------------------------------------------------------|
| `nodes`          | Ordered list of `SceneNode` objects describing visualizer instances.       |
| `view`           | Placeholder for camera/view transform (identity transform in 115).         |
| `backgroundColor`| Optional global background color; defaults to transparent.                 |

### SceneNode

A **SceneNode** encapsulates a single visualizer instance, its position and its settings. Scene nodes are **data structures**, not visualizers themselves. They are consumed by the compositor to create and manage actual visualizer objects.

Fields in a `SceneNode`:

| Field          | Type                | Description                                                                                          |
|---------------|---------------------|------------------------------------------------------------------------------------------------------|
| `id`          | string              | Unique identifier for the node within the scene.                                                     |
| `type`        | string              | The registered visualizer type (e.g. `"orbs"`, `"bandOverlay"`).                                    |
| `enabled`     | boolean             | Whether this node is currently active; disabled nodes are ignored by the compositor.                 |
| `zIndex`      | number              | Render order; lower zIndex renders behind higher zIndex.                                             |
| `bounds`      | {`x`, `y`, `w`, `h`} | Normalized position and size within the render surface. Coordinates are in `[0,1]` relative space. |
| `anchor`      | {`x`, `y`}           | Anchor point for layout; specifies the pivot within the node’s bounds, in normalized `[0,1]` range. |
| `settings`    | any                 | Visualizer‑specific settings payload used to construct the visualizer.                               |

#### Bounds and Layout

* **Normalized coordinate system:** The scene uses a normalized coordinate system for `bounds` and `anchor` so that layouts scale with the render surface size. `(0,0)` is the top‑left corner, `(1,1)` the bottom‑right. For example, `bounds: { x: 0.0, y: 0.0, w: 1.0, h: 1.0 }` means the visualizer occupies the entire render surface.
* **Anchor:** Defines the pivot point relative to the node’s bounding box. For example, an anchor of `{ x: 0.5, y: 0.5 }` anchors the visualizer at its centre; `{ x: 0, y: 0 }` anchors at top‑left. This will be especially important when camera controls (panning, zooming) arrive in Build 116.

#### Node Settings

The `settings` payload contains visualizer‑specific configuration (e.g. orb motion parameters). Each visualizer type should define a settings schema and default values; these settings are persisted in presets. `SceneNode` itself does not inspect these settings.

### Scene Default

On first launch or when no scene information is found in a preset, the application should construct a default scene. For 115 the default should be:

* One `SceneNode` of type `"orbs"` occupying the full render surface (`bounds` = full size, anchor centre) with default orb settings.
* One `SceneNode` of type `"bandOverlay"` occupying the full render surface (`bounds` = full size, anchor centre) with default overlay settings.

These defaults match the current “orb + overlay” experience. Users can modify the scene by enabling/disabling nodes and adjusting their placement in the Scene panel.

## Compositor

The **compositor** is responsible for instantiating visualizers, invoking their `update` and `render` methods, and composing their outputs into a single render surface. It reads `SceneNode` objects from the scene and maintains the corresponding visualizer instances.

Key responsibilities:

* **Instantiation:** For each active node, obtain a visualizer implementation from the registry and call its `init` method with the node’s settings and render context.
* **Order:** Respect the `zIndex` ordering when composing layers. A lower `zIndex` is rendered first; higher values render on top.
* **Sizing and placement:** Calculate pixel bounds for each node based on the render surface size and the node’s normalized `bounds`. Pass these bounds to the visualizer via `resize(bounds)`.
* **Updates:** For each frame, call `update(frame, dt)` on each visualizer, passing the current `AnalysisFrame`/`BandFrame` and delta time. Visualizers should update internal simulation state accordingly.
* **Rendering:** For each frame, call `render(target, viewTransform)` on each visualizer. The compositor passes its drawing target (e.g. a canvas or offscreen buffer) and current view transform (identity transform in 115) to the visualizer. The visualizer renders its layer into its assigned region.
* **Disposal:** When a node is removed or disabled, call `dispose()` on its visualizer.

In Build 115 the compositor will render all visualizer layers into a single canvas for simplicity. Future builds may separate layers into distinct canvases for improved performance or compositing flexibility.

## Inspectors and HUD

Inspectors (e.g. the band table) consume the same `AnalysisFrame`/`BandFrame` but render to the UI layer rather than into the scene. They should not be treated as scene nodes. The scene model intentionally keeps inspectors separate so they can be toggled and positioned in the Workspace shell without affecting render composition.

## Interaction with Camera (Build 116)

Build 115’s scene model introduces a placeholder `view` property in the scene. In 115 this is always an identity transform, meaning the scene renders directly to the surface. In Build 116, the camera will be introduced with controls for zoom, pan and optional perspective; the `view` property will then hold the camera transform used by the compositor when rendering each visualizer.

## Guidelines and Invariants

* **Scene is runtime‑only.** It is not stored in presets directly; presets store enough data to reconstruct a scene (visualizer types and settings), but the runtime scene instance exists only in memory.
* **Do not treat inspectors as nodes.** The band table and similar inspector outputs must live in the UI layer, not within the render composition.
* **Normalized layout.** Always use normalized bounds and anchors in `[0,1]` to ensure responsive scaling. The compositor converts these to pixel coordinates.
* **Independent visualizer logic.** Each visualizer should maintain its own simulation state; the scene model simply positions the visualizer. Visualizers must honour the `bounds` passed by the compositor.
* **Ordering matters.** Changing a node’s `zIndex` changes rendering order. The compositor does not sort nodes automatically every frame; it sorts when the scene changes or when requested by the scene panel.

Build 115 sets up the scaffolding for a long‑term visual composition system. Subsequent builds will extend this with user‑controlled manipulation, animation of nodes, and camera controls.