# Build 115 Terminology Map

This document bridges current implementation labels to Build 115's canonical
architecture vocabulary. It is intentionally conservative. The goal is to make
the repo easier to think with without implying premature renames.

## How To Read This Map

- **Canonical Build 115 terms** are the architecture names that future docs and
  refactors should use.
- **Current implementation labels** are the names already present in the Build
  114 code and runtime UI.
- This map does not require one-to-one renames unless a later phase explicitly
  chooses to perform them.

## Terminology Bridge

| Current or legacy term | Build 115 canonical meaning | Notes |
|------------------------|-----------------------------|-------|
| `AudioEngine` / `audio-engine.js` | `AnalyzerCore` | Current module also participates in transport and source plumbing, but the canonical analysis-producing role is `AnalyzerCore`. |
| `band-bank.js` / band bank controller | `BandBank` | Already close to the canonical term. |
| Orb / orb runtime / orb render path | `"orbs"` `Visualizer` type | Today this is a special-case render object/path. Under Build 115 it becomes a first-class visualizer instantiated through a `SceneNode`. |
| Band overlay | `Visualizer` | Today it is a special-case overlay drawn by the renderer. Under Build 115 it is scene content, not UI instrumentation. |
| Band table / live band HUD | `Inspector` | These are instrumentation surfaces, not scene visualizers and not scene nodes. |
| `renderer.js` | Legacy render orchestration path | Build 115 canon separates `Compositor`, `Scene`, and `Visualizer` responsibilities instead of treating the renderer as the architecture name. |
| `audioPanel` plus queue controls | `Audio Source` within `WorkspaceShell` | This is a broad responsibility mapping, not a promise of a direct DOM rename in Phase 1. |
| `recordPanel` | `Recording` within `WorkspaceShell` | The current panel remains a valid implementation label until later shell phases. |
| `simPanel` | Mixed legacy container | Its current responsibilities split across `Analysis`, `Scene`, `Workspace / Presets`, and some visualizer settings. Do not treat it as a one-to-one future panel rename. |
| `bandsPanel` | Mixed legacy container | Its current responsibilities split across `Banking`, `Inspector` surfaces, and some visualizer-adjacent settings. Do not treat it as a one-to-one future panel rename. |
| Hidden-panel launchers | `WorkspaceShell` launcher system | The current launchers are legacy implementation labels on the path toward a unified shell launcher bar. |

## Naming Rules

- Use `Visualizer` consistently in Build 115 canon.
- Use `Inspector` only for UI instrumentation.
- Use `Scene` for scene configuration and `SceneNode` for per-visualizer
  placement data.
- Use `WorkspaceShell` for the shell concept, not for current DOM IDs.
- Preserve current code symbols and panel IDs until a later phase explicitly
  changes them.
