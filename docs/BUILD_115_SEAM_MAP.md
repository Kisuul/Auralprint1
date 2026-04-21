# Build 115 Seam Map

This document maps responsibilities to code modules for the **Build 115** visualisation overhaul.  A seam map clarifies which parts of the codebase own which concepts so that future changes remain localised and maintainable.  The goal is to avoid entangling analyser logic with rendering or UI plumbing and to ensure that each subsystem can evolve independently.

## Purpose

In the monolithic era it was easy to inadvertently cross boundaries: UI handlers invoked analysis code, visual effects lived in the same file as audio state, and migrations touched unrelated panels.  With the refactor to a modular source tree (introduced in 0.1.14) and the upcoming visualiser framework, every significant feature should have an obvious home.  This seam map documents those homes.

## High‑level boundaries

- **Audio input and analysis (`src/js/audio/`)**
  - `audio-engine.js` owns the Web Audio graph and analyser nodes.  It exposes a clean API for starting/stopping sources and retrieving `AnalysisFrame` objects.  It should not know about bands, colours or panels.
  - `band-bank.js` and `band-bank-controller.js` own the spectral model.  They convert FFT bins into bands according to distribution settings and expose `BandFrame` objects.  They are pure functions with no UI or rendering code.

- **Frame definitions (`src/js/core/`)**
  - New `frame.js` (to be added) defines the `AnalysisFrame` and `BandFrame` data structures.  These simple POJOs hold normalised analysis results and band metadata.  No modules should read from Web Audio nodes directly once these structures exist.

- **Rendering engine (`src/js/render/`)**
  - `renderer.js` becomes thin: it delegates drawing to the compositor and visualisers rather than housing a giant orb simulation.  It owns the top‑level canvas and orchestrates the render loop.
  - `compositor.js` (new) manages a list of `SceneNode` instances, orders their render targets and composites them into the final surface.
  - `visualizer.js` (new) exports the `Visualizer` base/contract and a registry for available visualisers.  Each visualiser lives in its own module (`orb.js`, `overlay.js`, etc.) and implements the contract.
  - `scene.js` (new) defines the `SceneNode` model and manages creation, ordering and removal of nodes.  It does not know about UI; it purely manages state for the compositor.

- **Inspector/HUD layer (`src/js/ui/inspectors/`)**
  - New modules under this folder implement the `Inspector` contract.  The band table and any future diagnostic HUDs live here.  They render within the UI, not the canvas.

- **Workspace shell (`src/js/ui/`)**
  - `ui.js` remains the top‑level orchestrator of panels and user interactions.  It now owns panel visibility state, the bottom launcher bar and global keyboard shortcuts.  It should not directly touch analyser or rendering code; it dispatches actions to appropriate subsystems.
  - `panel-state.js` (new) centralises which panels are open, which are collapsed and the current active panel.  It is runtime‑only state and must not leak into presets.

- **Configuration and presets (`src/js/core/` and `src/js/presets/`)**
  - `config.js` holds canonical defaults.  It will gain defaults for the new scene model and visualiser instances.
  - `url-preset.js` handles serialisation and deserialisation of presets.  It will be extended to handle the new schema version introduced in Build 115.  Runtime‑only state (panel positions, source permissions) must remain excluded.

## Module responsibilities

- **AnalyzerCore** (audio-engine) – start/stop input sources, connect nodes, compute `AnalysisFrame`.
- **BandBank** – map FFT bins to psychoacoustically meaningful bands, compute `BandFrame` and dominant band, expose band metadata.
- **Visualizer** – encapsulate simulation state and rendering of one visual effect (e.g. Orbs or Overlay).  Visualisers must not fetch audio data directly; they consume frames passed by the compositor.
- **SceneNode** – hold the state necessary to place a visualiser in the scene: type, bounds, z‑index, enabled flag and visualiser settings.
- **Compositor** – update and render all active SceneNodes into the main canvas, in order.  Handle resizing and invalidation.
- **Inspector** – draw diagnostic or status UI based on the same frame data.  It belongs in the UI layer, not the render engine.
- **WorkspaceShell** – host panels, the bottom launcher bar and a status/log console.  Manage which panels are open and keep them out of the render surface.

## Non‑goals for Build 115

- Full camera controls (pan/zoom/rotate) – deferred to Build 116, though a `ViewTransform` placeholder will be introduced.
- Complex composition modes (e.g. blending modes) – base compositing will suffice.
- Real‑time editing of `SceneNode` bounds via drag handles – may be introduced later.  Build 115 only defines the model.

By adhering to this seam map, developers and AI coding agents can work on Build 115 features with confidence that changes stay within their domain and do not inadvertently break unrelated functionality.
