# Build 115 — Phased Development Plan

This document outlines a staged approach to delivering Build 115. Each phase is intentionally small and focused so that agents can implement and validate work incrementally. Phases are grouped into blocks for convenience, but each phase should be handled as an independent unit with its own prompt pack.

## Summary of Phases

### Block A — Architecture and Vocabulary Freeze

| Phase | Name                                 | Description |
|------:|--------------------------------------|-------------|
| **1** | Architecture vocabulary freeze        | Create `BUILD_115_ARCHITECTURE.md` defining AnalyzerCore, BandBank, Visualizer, Inspector, SceneNode, Compositor, ViewTransform, WorkspaceShell, etc. Establish invariants and ensure terms are unambiguous. |
| **2** | Seam map definition                  | Write `BUILD_115_SEAM_MAP.md` mapping responsibilities of modules to files, clarifying ownership boundaries between analysis, banking, rendering, inspectors, UI, and configuration. |
| **3** | Workspace shell specification         | Document panel taxonomy and bottom launcher behaviour in `BUILD_115_WORKSPACE_SHELL.md`. Define panel names, responsibilities, and the new bottom launcher bar with collapse/expand behaviour. |
| **4** | Frame contracts                       | Define `AnalysisFrame` and `BandFrame` in `BUILD_115_FRAME_CONTRACTS.md`. These data structures unify how visualizers and inspectors consume analysis results. |
| **5** | Visualizer contract                   | Define the `Visualizer` interface in `BUILD_115_VISUALIZER_CONTRACT.md`. Specify required methods (`init`, `update`, `render`, `resize`, `dispose`) and optional methods (`getCapabilities`, `getSettingsSchema`, `getDefaultNode`). |
| **6** | Inspector contract                    | Define the `Inspector` interface in `BUILD_115_INSPECTOR_CONTRACT.md` for UI/HUD consumers. |
| **7** | Scene model                           | Define `Scene` and `SceneNode` in `BUILD_115_SCENE_MODEL.md`. Establish normalized layout, node fields, default scene, and the compositor’s role. |
| **8** | Schema plan                           | Define Schema 9 and migration logic in `BUILD_115_SCHEMA_PLAN.md`. Describe how old orb/overlay settings become scene nodes. |

### Block B — Workspace Shell Overhaul

| Phase | Name                                    | Description |
|------:|-----------------------------------------|-------------|
| **9** | Launcher bar shell                       | Implement the new bottom launcher bar with icons for each panel and collapse/expand behaviour. No changes to panel contents yet. |
| **10**| Panel visibility runtime                 | Refactor panel visibility state into the workspace shell. Support opening/closing panels from the launcher bar and maintaining collapsed launcher state. |
| **11**| Status/Log drawer                        | Add a dedicated Status/Log panel or drawer. Surface runtime messages such as permission events, source changes, recording lifecycle notifications, migrations and warnings. |
| **12**| Control relocation                       | Move existing controls into their new panels: Audio Source, Analysis, Banking, Recording, Workspace/Presets, Status/Log. Behaviour remains the same. |
| **13**| Banking cleanup                          | Refine the Banking panel: show the dominant band by default; hide the full live table unless requested; integrate color mode/source controls; treat the band HUD as an inspector. |

### Block C — Visual Engine Foundation

| Phase | Name                                    | Description |
|------:|-----------------------------------------|-------------|
| **14**| Compositor abstraction                   | Implement a compositor that reads `Scene` and `SceneNode` data to instantiate and manage visualizer instances, handle ordering (zIndex) and calls update/render cycles on each visualizer. |
| **15**| Visualizer registry                      | Introduce a registry/factory for visualizers. Map visualizer type names to constructors/implementations and expose metadata (settings schema, defaults). |

### Block D — First Visualizer Migration

| Phase | Name                                    | Description |
|------:|-----------------------------------------|-------------|
| **16**| Port band overlay visualizer              | Migrate the band overlay into the new visualizer framework. Use the `Visualizer` contract; remove special‑case rendering logic for the overlay. |
| **17**| Port orb visualizer                       | Migrate the orb system to the visualizer framework, maintaining existing behaviour first. Remove direct coupling between the orb renderer and the analyser/band system. |
| **18**| Scene panel v1                            | Implement the Scene panel, allowing users to enable/disable visualizers, change their ordering, and edit settings for the selected visualizer. |

### Block E — Orb Overhaul

| Phase | Name                                    | Description |
|------:|-----------------------------------------|-------------|
| **19**| Orb overhaul (per‑orb features)           | Add per‑orb spectral targeting, colour phase, and pre‑hook fields (`hueOffsetDeg`, `centerX`, `centerY`) to orb settings. Expose these in the Scene panel’s orb inspector. |
| **20**| Camera hooks                             | Introduce a `ViewTransform` abstraction and no‑op default camera. Expose placeholder UI hooks in the Scene panel. Full camera controls are deferred to Build 116. |

### Block F — Compatibility and Hardening

| Phase | Name                                    | Description |
|------:|-----------------------------------------|-------------|
| **21**| Schema migration implementation          | Add runtime migration code that converts presets from Schema 8 (and earlier) to Schema 9. Validate with a library of legacy presets. |
| **22**| Hardening and release gate                | Run targeted automated tests, manual browser tests, and hostile audits across all panels, visualizer behaviours and migration logic. Ensure the 115 build meets quality standards before promotion to canon. |

## Notes

* Phases can be grouped into milestones for development convenience (e.g. phases 9–13 collectively implement the workspace shell). However, they should still be implemented and tested sequentially to maintain incremental progress.
* Each phase should include clear acceptance criteria (e.g. tests in `tests/targeted-audit.test.js`), and only one major concern should be addressed at a time.
* The ordering of phases is intentional; the visual engine foundation should only begin after the workspace shell exists, and the orb overhaul should only proceed after the orb visualizer has been migrated.
* Camera control is purposefully constrained in 115; Build 116 will fully exploit the `ViewTransform` hooks introduced here.

This phased plan ensures that Build 115 can be developed, reviewed and shipped in a controlled manner, while delivering a coherent, world‑class visual suite.