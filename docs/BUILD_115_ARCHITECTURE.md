# Build 115 Architecture

This document defines the high‑level architecture for the Visualizer framework and Orb overhaul planned for **Build 115** of Auralprint.  It names the major subsystems, clarifies their responsibilities and interfaces, and sets the vocabulary that will be used throughout the refactor.

## Overview

Auralprint has always been “an analyser cosplaying as a visualiser.” By the end of Build 115, that identity will be clearer: the analyser core produces a stream of normalised analysis frames, band banking enriches those frames with spectral structure, and multiple first‑class visual and inspection modules consume that state to produce renderable scenes or heads‑up displays.  A new scene/compositor layer stitches visual outputs into a unified render surface, while a workspace shell provides panels for configuration and control.

The diagram below summarises the layered architecture:

```
Source Input → AnalyzerCore → AnalysisFrame → BandBank → BandFrame
                    ↑                     |
                    |                     +→ Inspectors (HUD/Status)
                    +→ Visualizers (Orbs, Overlay, future visuals)
                                 ↓
                          Scene & Compositor
                                 ↓
                          Render Surface
```

## Key components

- **AnalyzerCore** – owns the Web Audio graph, performs FFT and RMS calculations, and generates a normalised `AnalysisFrame` for each animation frame.  It is agnostic about bands or visual output.

- **BandBank** – given an `AnalysisFrame` and a distribution mode (e.g. linear, ERB, Bark), it partitions the spectrum into named bands, aggregates energies and metadata, and produces a `BandFrame`.  It manages dominant‑band tracking, provides band names and lore, and enforces psychoacoustic spacing rules.

- **Visualizer** – a module that consumes `BandFrame` (and optionally `AnalysisFrame`) and renders a dynamic scene.  Each visualizer has its own local simulation state, update/render loop and render target.  Examples include the existing Orb field and the band overlay.

- **Inspector** – a non‑scene consumer of `BandFrame` that presents data as user‑facing instrumentation rather than as part of the render canvas.  The existing band table and HUD belong here.

- **SceneNode** – an instance of a visualizer placed in render space.  It holds placement information (bounds, anchor), z‑order and settings for that instance.

- **Compositor** – the engine that updates and draws all active SceneNodes into the final render surface.  It is responsible for layer ordering and composition.  Camera/view transforms will be layered on top in Build 116.

- **WorkspaceShell** – the collection of panels (Analysis, Banking, Scene, Audio Source, Recording, Workspace/Presets and Status/Log) plus the bottom launcher bar.  It mediates UI state and ensures panels can open, close and collapse without interfering with the render surface.

## Layered architecture

1. **Input Layer**  
   The input layer encompasses file playback, microphone capture and stream capture, delivered via a unified source manager introduced in Build 114.  It feeds raw audio data into the analyser.

2. **Analysis Layer**  
   The analyser core transforms input into spectral data.  Its output, `AnalysisFrame`, includes per‑channel energies, RMS levels and other frame‑level metadata.  It does not concern itself with visual representation.

3. **Spectral Model Layer**  
   The BandBank converts raw FFT bins into psychoacoustically meaningful bands.  It outputs a `BandFrame` containing band energies, dominant band, band ranges, names and any derived metrics required by consumers.

4. **Presentation Layer**  
   Two distinct consumers live here:  
   - **Visualizers** update their local simulation state using `BandFrame`/`AnalysisFrame` and render into dedicated canvases.  
   - **Inspectors** present diagnostic or status information to the user (e.g. the band table).

5. **Composition Layer**  
   The compositor combines all visualizer outputs into a single render surface.  It manages z‑order, invalidation and partial redraws.  A simple compositing model will suffice for Build 115; more complex blending can come later.

6. **Workspace/UI Layer**  
   Panels and the launcher bar form the user interface.  They are independent of visualisation logic and should not contain analyser or render code.  This separation allows the product to remain “analysis first” without conflating UI plumbing with core function.

## Terms and invariants

- **Visualizer vs Inspector** – a visualizer draws within the render surface; an inspector draws within the UI.  Both read from the same analysis state, but they are not the same class of object.
- **Frame Contracts** – visualizers and inspectors must not read directly from Web Audio nodes.  They depend on `AnalysisFrame` and `BandFrame` only.  This decouples presentation from low‑level audio details.
- **Runtime vs Persisted State** – scene composition, analyser and band settings may be persisted into presets.  Workspace/panel visibility, source permissions and recording sessions remain runtime‑only.

Build 115 will lay the foundation for this architecture; Build 116 will add camera and view transforms while keeping this layering intact.
