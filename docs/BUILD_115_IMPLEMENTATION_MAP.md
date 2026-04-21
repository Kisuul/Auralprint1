# Build 115 Implementation Map

This document bridges the ratified Build 115 architecture docs to later code
phases. It does not introduce code. It tells future implementers which current
files still own legacy behavior, which new modules are expected later, and what
order later phases should likely touch those files.

## Purpose

Build 115 is still docs-first. The runtime has not yet migrated onto the scene,
compositor, visualizer, or workspace-shell architecture. This map exists so
later phases can move from the current codebase to the target architecture in a
deliberate order without redefining ownership each time.

## Current Legacy Owners

These files still own the current runtime behavior and therefore carry the most
migration pressure:

- `src/js/audio/audio-engine.js`
  - Still owns the current `AnalyzerCore` path and will need to participate
    when `frame.js` introduces explicit `AnalysisFrame` handoff.
- `src/js/audio/band-bank.js`
  - Still owns the current `BandBank` derivation path and will need to
    participate when `frame.js` and later scene consumers adopt explicit
    `BandFrame` handoff.
- `src/js/audio/band-bank-controller.js`
  - Still coordinates banking behavior around the current `BandBank` path and
    remains part of the frame-contract migration surface.
- `src/js/render/renderer.js`
  - Still directly draws the band overlay plus orb trails and particles.
  - Later phases narrow it toward canvas ownership and top-level render-loop
    orchestration.
- `src/js/render/orb.js`
  - Still defines the orb as a special-case render/simulation object rather
    than as a first-class `Visualizer`.
- `src/js/render/orb-runtime.js`
  - Still wires orb instances to runtime settings and band selection logic.
- `src/js/ui/ui.js`
  - Still owns the current shell, panel visibility behavior, launcher behavior,
    and much of the current cross-system coordination.
- `src/js/ui/dom-cache.js`
  - Still binds the current panel IDs and launcher elements used by the legacy
    shell.
- `src/js/presets/url-preset.js`
  - Still owns current preset serialization and the main migration pressure for
    Schema 9 rollout.
- `src/js/core/constants.js`
  - Still declares the active runtime preset schema version, currently 8.
- `src/js/core/preferences.js`
  - Still defines the current persisted preference shape and orb normalization
    helpers.
- `src/js/core/config.js`
  - Still defines canonical defaults and limits that later schema rollout work
    will need to extend carefully.

## Future Modules Expected Later

These files or module families are expected to appear in later Build 115 work.
They do not belong to this docs-only phase:

- `src/js/core/frame.js`
  - Canonical home for `AnalysisFrame` and `BandFrame`.
- `src/js/render/scene.js`
  - Canonical home for `Scene` and `SceneNode`.
- `src/js/render/visualizer.js`
  - `Visualizer` contract plus registry/factory behavior.
- `src/js/render/compositor.js`
  - Scene-driven render orchestration and `ViewTransform` handoff.
- `src/js/ui/panel-state.js`
  - Runtime-only `WorkspaceShell` visibility and launcher state.
- `src/js/ui/inspectors/`
  - Inspector modules for band tables, dominant-band readouts, status surfaces,
    and related UI instrumentation.

## Likely Touch Order By Later Blocks

### Block B - Workspace shell work

- Narrow `ui.js` and `dom-cache.js` around the new shell responsibilities.
- Introduce `panel-state.js`.
- Introduce `src/js/ui/inspectors/` when Banking cleanup and related shell work
  starts treating the band table and HUD as inspector-backed UI surfaces,
  likely late in Block B.
- Keep existing control behavior stable while moving ownership toward
  `WorkspaceShell`.

### Block C - Visual engine foundation

- Introduce `frame.js`, `scene.js`, `visualizer.js`, and `compositor.js`.
- Thread `frame.js` adoption through the existing analyzer and banking owners in
  `audio-engine.js`, `band-bank.js`, and `band-bank-controller.js`.
- Narrow `renderer.js` so it stops owning special-case scene content directly.
- Preserve the current visual output while moving ownership to the new seams.

### Block D - First visualizer migration

- Migrate the band overlay out of `renderer.js` into a first-class `Visualizer`.
- Migrate the orb path out of `orb.js` and `orb-runtime.js` into the
  visualizer framework while maintaining current behavior first.

### Block F - Compatibility and schema rollout

- Update `url-preset.js`, `constants.js`, `preferences.js`, and `config.js` for
  Schema 9 adoption and migration support.
- Keep runtime-only exclusions explicit while moving persisted visual state into
  `scene`.

## Highest Migration Pressure

The files with the highest migration pressure are:

- `src/js/render/renderer.js`
- `src/js/ui/ui.js`
- `src/js/presets/url-preset.js`
- `src/js/render/orb.js`
- `src/js/render/orb-runtime.js`

These files currently combine responsibilities that the Build 115 architecture
splits across `WorkspaceShell`, `Scene`, `Compositor`, `Visualizer`, and
Schema 9 migration code.

## Phase Boundaries

- **Phase A docs work** ratifies seams, contracts, terminology, scene/schema
  shape, and implementation readiness only.
- **Block B** is where shell file changes begin.
- **Block C** is where new render-engine modules begin.
- **Block D** is where band overlay and orb migrations begin.
- **Block F** is where Schema 9 runtime adoption begins.

None of the future file additions listed above belong to this docs-only phase.
