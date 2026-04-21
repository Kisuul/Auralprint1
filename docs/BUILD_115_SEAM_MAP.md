# Build 115 Seam Map

This document maps responsibilities to code modules for the Build 115 visual
architecture. The goal is to keep analyzer logic, banking, scene composition,
rendering, inspectors, and UI shell behavior on clear seams so future changes
stay local.

## Purpose

The legacy code path still contains mixed responsibilities. Build 115 does not
rewrite all of that in Phase 1, but it does define where the seams belong so
later phases can migrate behavior without vocabulary drift.

## High-Level Boundaries

- **Audio input and analysis (`src/js/audio/`)**
  - `audio-engine.js` is the current home of `AnalyzerCore` responsibilities.
    It owns analyzer-node wiring and frame-level analysis output.
  - `band-bank.js` and `band-bank-controller.js` are the current home of
    `BandBank` responsibilities.

- **Frame definitions (`src/js/core/`)**
  - A future `frame.js` can hold the canonical `AnalysisFrame` and `BandFrame`
    data contracts so consumers no longer reach into analyzer internals.

- **Rendering engine (`src/js/render/`)**
  - `renderer.js` is the legacy top-level render path. Under Build 115 it
    narrows into canvas ownership and render-loop orchestration while delegating
    scene composition to `Compositor` and per-effect behavior to `Visualizer`s.
  - `compositor.js` (new) owns scene-driven render ordering, bounds management,
    and `ViewTransform` handoff.
  - `visualizer.js` (new) defines the `Visualizer` contract and registry.
  - `scene.js` (new) defines the persisted `Scene` and `SceneNode` data model.
  - `orb.js` and the band overlay path remain legacy implementation details
    until they are migrated into first-class visualizer modules.

- **Inspector/HUD layer (`src/js/ui/inspectors/`)**
  - Inspector modules live in the UI layer and consume frame contracts without
    participating in scene composition.

- **Workspace shell (`src/js/ui/`)**
  - `ui.js` remains the top-level UI orchestrator.
  - `panel-state.js` (new) is the runtime-only home for `WorkspaceShell`
    visibility and launcher state.
  - Current Build 114 panel IDs remain implementation labels until later phases
    intentionally replace them.

- **Configuration and presets (`src/js/core/` and `src/js/presets/`)**
  - `config.js` remains the canonical home for defaults and limits.
  - `url-preset.js` owns preset serialization, schema versioning, and migration
    behavior for scene data.

## Module Responsibilities

- **AnalyzerCore** - Start or attach sources, manage analyzer graph state, and
  produce `AnalysisFrame` output.
- **BandBank** - Convert analyzer output into `BandFrame` data and dominant-band
  metadata.
- **Visualizer** - Encapsulate one scene-facing visual effect. It consumes frame
  contracts and renders within compositor-assigned bounds.
- **Inspector** - Encapsulate UI-facing instrumentation such as the band table
  or live band HUD.
- **Scene** - Persist scene configuration, primarily through an ordered list of
  `SceneNode`s and other scene-level settings.
- **SceneNode** - Hold one visualizer placement and settings payload.
- **Compositor** - Instantiate active visualizers from the scene, apply ordering
  and bounds, pass through `ViewTransform`, and render into the main surface.
- **ViewTransform** - Represent runtime-only camera/view state for the
  compositor render path.
- **WorkspaceShell** - Host panel surfaces, launchers, and status/log UI around
  the render surface.

## Non-Goals For Build 115 Phase 1

- Implementing the compositor or visualizer registry.
- Renaming current source files or runtime panel IDs just to match future terms.
- Introducing full camera behavior before Build 116.

The seam map exists so later Build 115 phases can move code toward these seams
without redefining the architecture each time.
