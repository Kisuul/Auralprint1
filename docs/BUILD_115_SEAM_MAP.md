# Build 115 Seam Map

This document maps responsibilities to code modules for the Build 115 visual
architecture. The goal is to keep analyzer logic, banking, scene composition,
rendering, inspectors, presets, and UI shell behavior on clear seams so future
changes stay local.

## Purpose

The current runtime still contains mixed responsibilities. Build 115 does not
rewrite all of that in Phase 2, but it does define where the seams belong so
later phases can migrate behavior without vocabulary drift.

## Canonical Frame And Ownership Flow

Build 115 uses this ownership flow:

`AnalyzerCore -> AnalysisFrame -> BandBank -> BandFrame -> Visualizer/Inspector`

- `Visualizer`s consume `BandFrame` and may read the underlying
  `AnalysisFrame` through `BandFrame.analysis`.
- `Inspector`s consume `BandFrame` in the UI layer.
- `Scene`, `SceneNode`, `Compositor`, and `ViewTransform` sit on top of those
  contracts to organize and render scene content.

## Current Legacy Owners

These modules remain the current runtime owners until later phases intentionally
narrow them:

- **Audio and banking**
  - `src/js/audio/audio-engine.js` is the current home of `AnalyzerCore`
    responsibilities.
  - `src/js/audio/band-bank.js` and
    `src/js/audio/band-bank-controller.js` are the current home of `BandBank`
    responsibilities.

- **Rendering**
  - `src/js/render/renderer.js` is the legacy top-level render path and still
    directly draws the band overlay plus orb trails/particles today.
  - `src/js/render/orb.js` and `src/js/render/orb-runtime.js` still own the orb
    simulation/render path as special-case code, not as first-class visualizer
    modules.
  - `src/js/render/color-policy.js`, `src/js/render/trail-system.js`, and
    related helpers remain supporting legacy render modules.

- **UI shell**
  - `src/js/ui/ui.js` remains the top-level UI orchestrator for the current
    shell.
  - `src/js/ui/dom-cache.js` still binds the current panel IDs and launcher
    elements used by the legacy shell.

- **Presets and configuration**
  - `src/js/presets/url-preset.js` owns current preset serialization and the
    eventual migration pressure for Schema 9 rollout.
  - `src/js/core/constants.js` still declares `PRESET_SCHEMA_VERSION = 8`.
  - `src/js/core/preferences.js` and `src/js/core/config.js` still define the
    current persisted preference shape and defaults.

## Future Canonical Owners

These modules are expected to appear later. They do not belong to this docs-only
phase:

- `src/js/core/frame.js` - canonical home for `AnalysisFrame` and `BandFrame`
  data contracts.
- `src/js/render/visualizer.js` - `Visualizer` contract and registry.
- `src/js/render/scene.js` - `Scene` and `SceneNode` data model.
- `src/js/render/compositor.js` - scene-driven render orchestration and
  `ViewTransform` handoff.
- `src/js/ui/panel-state.js` - runtime-only `WorkspaceShell` visibility and
  launcher state.
- `src/js/ui/inspectors/` - `Inspector` modules for band tables, readouts, and
  related UI instrumentation.

## Responsibility Rules

- **AnalyzerCore** owns source attachment and analyzer graph state, not scene or
  UI composition.
- **BandBank** owns band derivation and dominant-band metadata, not rendering.
- **Visualizer** owns one scene-facing effect and renders within compositor
  bounds.
- **Inspector** owns one UI-facing instrumentation surface and does not
  participate in scene composition.
- **Scene** persists scene configuration, primarily through `scene.nodes`.
- **SceneNode** holds per-visualizer placement and settings data only.
- **Compositor** instantiates active visualizers from the scene, applies
  ordering and bounds, passes through `ViewTransform`, and renders into the
  main surface.
- **WorkspaceShell** owns panel and launcher runtime state without owning low-
  level audio or render internals.

## Phase Boundary

Phase 2 ratifies seams and contracts only. It does not create `frame.js`,
`scene.js`, `visualizer.js`, `compositor.js`, `panel-state.js`, or any
inspector modules, and it does not narrow `renderer.js`, `orb.js`,
`orb-runtime.js`, `ui.js`, or `url-preset.js` yet.
