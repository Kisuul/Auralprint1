# Build 115 Architecture

This document defines the high-level architecture for Build 115 of Auralprint.
It ratifies the canonical vocabulary used across the refactor and clarifies how
analysis, banking, scene composition, rendering, and UI responsibilities fit
together.

## Overview

Auralprint remains analysis-first. `AnalyzerCore` produces a normalized
`AnalysisFrame` for each tick. `BandBank` enriches that into a `BandFrame`.
`Visualizer` and `Inspector` modules consume those frames through stable
contracts. A `Scene` organizes visualizer configuration, a `Compositor`
instantiates and renders the active `SceneNode`s, and the `WorkspaceShell`
hosts the control surfaces around that render path.

```
Source Input -> AnalyzerCore -> AnalysisFrame -> BandBank -> BandFrame
                                         |                    |
                                         |                    +-> Inspector(s)
                                         +--------------------+-> Visualizer(s)
                                                                  |
                                                           Scene + Compositor
                                                                  |
                                                            Render Surface
```

## Key Components

- **AnalyzerCore** - Owns the Web Audio analysis graph and produces a
  normalized `AnalysisFrame`. It is responsible for FFT, RMS, and related
  frame-level analysis output, not for banking, scene logic, or UI.
- **AnalysisFrame** - The immutable per-tick snapshot emitted by
  `AnalyzerCore`. It is the low-level analysis contract consumed by `BandBank`
  and, when needed, by advanced visualizers.
- **BandBank** - Converts an `AnalysisFrame` into a psychoacoustically grouped
  `BandFrame`. It owns distribution logic, dominant-band derivation, band
  metadata, and related banking rules.
- **BandFrame** - The immutable band-oriented snapshot consumed by
  `Visualizer`s and `Inspector`s. It carries band energies, dominant-band
  information, and a reference to the underlying `AnalysisFrame`.
- **Visualizer** - A scene-facing module that consumes `BandFrame` and, when
  needed, `AnalysisFrame`, then renders visual output inside the render
  surface. The band overlay and orbs belong to this category.
- **Inspector** - A UI-facing module that consumes the same frame contracts but
  renders instrumentation in the UI layer instead of the scene. The band table
  and live band HUD belong here.
- **Scene** - The top-level scene configuration model. Presets persist scene
  data such as node order, enabled state, bounds, and settings. The runtime
  constructs live visualizer instances from this configuration.
- **SceneNode** - A data record inside a `Scene` that places and configures one
  `Visualizer`. A `SceneNode` is not a live visualizer instance.
- **Compositor** - The render orchestration layer that reads a `Scene`,
  instantiates the active visualizers, applies ordering, and draws them into
  the final render surface.
- **ViewTransform** - The runtime-only camera/view abstraction passed through
  the compositor render path. It is the identity transform in Build 115 and
  becomes meaningful in Build 116.
- **WorkspaceShell** - The panel and launcher system around the render surface.
  It hosts Analysis, Banking, Scene, Audio Source, Recording,
  Workspace/Presets, and Status/Log surfaces. In Phase 1 this is conceptual
  canon, not a required rename of current Build 114 panel IDs.

## Layered Architecture

1. **Input Layer**
   File playback, microphone capture, and stream capture feed raw audio into
   the analysis path.

2. **Analysis Layer**
   `AnalyzerCore` turns source audio into `AnalysisFrame` snapshots.

3. **Spectral Model Layer**
   `BandBank` derives `BandFrame` data from `AnalysisFrame` plus banking
   settings.

4. **Presentation Layer**
   `Visualizer`s render scene content and `Inspector`s render user-facing
   instrumentation. Both consume the same frame contracts.

5. **Composition Layer**
   `Scene`, `SceneNode`, `Compositor`, and `ViewTransform` define how scene
   content is organized, ordered, and rendered.

6. **Workspace/UI Layer**
   `WorkspaceShell` hosts panels and launchers without owning low-level audio
   analysis or scene rendering logic.

## Terms And Invariants

- **Visualizer vs Inspector** - A `Visualizer` is scene content drawn within
  the render surface. An `Inspector` is UI instrumentation drawn within the
  workspace shell. The band overlay is a `Visualizer`; the band table and band
  HUD are `Inspector`s.
- **Frame contracts** - `Visualizer`s and `Inspector`s consume
  `AnalysisFrame` and `BandFrame`. They do not read directly from Web Audio
  nodes.
- **Scene persistence** - Presets persist scene configuration, including node
  order, enabled state, bounds, anchor, and settings. Runtime-only state
  includes instantiated visualizer objects, selected node/UI state, the live
  `ViewTransform`, panel visibility, permissions, queue state, and recording
  sessions.
- **WorkspaceShell boundary** - `WorkspaceShell` names the Build 115 shell
  concept. Current implementation labels such as `audioPanel`, `simPanel`,
  `bandsPanel`, and `recordPanel` remain legacy runtime labels until later
  phases intentionally change them.

Build 115 establishes this architecture vocabulary and contract surface.
Build 116 extends it with camera behavior built on the `ViewTransform`
abstraction without changing the core layering.
