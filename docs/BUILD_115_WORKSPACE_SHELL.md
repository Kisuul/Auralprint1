# Build 115 Workspace Shell

This document specifies the Build 115 `WorkspaceShell`: the panel and launcher
system that surrounds the render surface. In Phase 1, `WorkspaceShell` is a
canonical architecture term, not a forced rename of current Build 114 panel IDs
or DOM structure.

## Panel Taxonomy

Build 115 uses the following conceptual panel set:

| Panel | Responsibilities |
|-------|------------------|
| **Audio Source** | File loading, queue management, source selection, transport controls, mute, and volume. |
| **Analysis** | Controls for `AnalyzerCore`, such as FFT size, smoothing, RMS gain, and other analyzer-facing knobs. |
| **Banking** | Controls for band distribution, band count, floor and ceiling, dominant-band behavior, color policy, and related banking rules. The full live band table may be revealed here as an `Inspector`, not as a scene visualizer. |
| **Scene** | Compose the visual scene by enabling, ordering, and configuring active `Visualizer`s. |
| **Recording** | Start and stop capture sessions, choose recording options, and surface export state. |
| **Workspace / Presets** | Import, export, and share presets plus any workspace-wide settings that do not belong elsewhere. |
| **Status / Log** | Surface runtime events, warnings, permission results, migration notices, and other user-facing status output. |

## Bottom Launcher Bar

Build 115 introduces a unified launcher bar docked to the bottom edge of the
viewport.

- **Collapsed state** - The bar can collapse into a minimal strip to maximize
  render space.
- **Icons** - Each conceptual panel has one icon in the launcher bar. Active
  panels appear highlighted.
- **Badges and pulses** - Icons may show state indicators such as unread log
  activity or active recording.
- **Ordering** - The default order is Audio Source, Analysis, Banking, Scene,
  Recording, Workspace / Presets, and Status / Log.

## Panel Behavior

Panels overlay the render surface rather than shifting it.

- **Open and close** - Clicking an icon toggles one panel instance.
- **Multiple panels** - More than one panel may be open at the same time.
- **Default state** - Audio Source, Analysis, and Banking are visible by
  default. Scene, Recording, Workspace / Presets, and Status / Log begin
  collapsed.
- **Responsive layout** - On smaller screens, panels may stack or dock
  differently, but the launcher system remains accessible.

## Status / Log Console

The Status / Log panel is a runtime event surface for:

- Permission grants and failures.
- Source switching events.
- Recording lifecycle events and export results.
- Schema migration notices and warnings.
- Errors or warnings emitted by visualizers or inspectors.

This log is runtime-only and is never persisted to presets.

## Phase 1 Boundary

Build 115 Phase 1 ratifies the `WorkspaceShell` vocabulary only. Current
implementation labels such as `audioPanel`, `simPanel`, `bandsPanel`,
`queuePanel`, and `recordPanel` remain valid runtime labels until later phases
move responsibilities into the final shell layout.

## Current Runtime Reality

The current runtime still uses the legacy shell owned by `src/js/ui/ui.js` and
the current DOM/panel bindings in `src/js/ui/dom-cache.js`. Later Build 115
shell phases narrow those owners; this document only ratifies the target shell
taxonomy and launcher responsibilities.

## Future Expansion

Later Build 115 phases move current controls into this shell model and Build
116 adds meaningful camera behavior on top of the scene system. Phase 1 does
not implement those UI migrations; it only freezes the shell vocabulary and
responsibility boundaries.
