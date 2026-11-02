# Build 117 — Step 0: Build 116 source baseline

**Checkpoint:** 2026-11-02. **Target repository:** [Kisuul/Auralprint1](https://github.com/Kisuul/Auralprint1).  
**New development branch:** `v117_dev`, branched directly from `main` at `75e26348848f874329ca1ac95bb13576371ed2da`.  
**Baseline identity:** Release 5 / Build 116, root `version = v0.1.16`, preset writer schema 16.  
**Scope:** Source orientation only. No behavior, configuration, schema, build procedure, performance policy, module ABI, or release decision is changed by this document.

This is an independent review of the source present on **Kisuul/main** at the commit above. No development branch, patch, proposed interface, or implementation from a different repository is incorporated. Existing historical cross-repository links inside 116 documentation are not development authority for our branch.

## 1. What Build 116 actually does

A self-contained browser application accepts File, Mic, or audio-bearing display Stream; supplies File playback with Queue and seeking/waveforms; performs live FFT/spectral and waveform analysis on genuine L, R and combined C channels; draws multiple individually configured Orbs plus one optional Spectral Ring on Canvas2D; emits/ages/retains particles and Trace; supports live Camera navigation, recording, and Scene sharing through versioned URL presets. It produces a standalone portable HTML and a first-party hosted directory.

Factory Scene: two Orbs (R and L), 256 bands using ERB distribution, Ring disabled, world 1000 × 1000 units. The factory is not a performance guarantee: CONFIG permits up to 4,096 Orbs and substantially higher particle resource settings.

Build 116's distinguishing changes include world/Camera separation, an authored Scene view distinct from live Camera, source-switch Queue-clearing opt-in, numeric Trace fade (0–20), schema-16 compact URL sharing and corrected keyboard-accessible Queue/scrubber behavior. See `README.md`, `ROADMAP.md`, `docs/development/build-116.md` and frozen `docs/Canon/0.1.16/`.

## 2. Architecture observed in executable source

| Ownership | Main entry points and observed behavior |
| --- | --- |
| Boot/frame scheduling | `src/js/main.js` awaits URL preset admission before subsystem initialization. Each rAF resizes the canvas, computes separate deltas, updates Camera, samples audio, refreshes a reused AnalysisFrame, updates/renders VisualizerRuntime, refreshes UI and draws scrubber. |
| Configuration | `core/config.js` deep-freezes defaults/limits. `core/preferences.js` owns mutable Scene `preferences`, derived `runtime.settings`, normalization and `resolveSettings()`; `core/state.js` owns ephemeral state. Authoritative flow: CONFIG → preferences → runtime.settings → state. |
| Audio production | `audio/audio-engine.js` owns Web Audio graph and L/R/C analysers, sample buffers, RMS/mono-like detection and recorder tap. `band-bank.js` computes frequency ranges and channel energies; `band-bank-controller.js` resolves configured frequency ceiling against actual Nyquist. `analysis-frame.js` provides reused, borrowed read-only-by-contract consumer views. |
| Input/transport | `audio/input-source-manager.js` owns File/Mic/Stream activation, cancellation epochs, live-track lifecycle and support/permission states. `audio/queue.js` owns in-memory ordered File entries, cursor, entry identity and mutation revision. `ui/ui.js` owns the canonical `loadAndPlay()` and EOF/Queue coordination. |
| Waveform/scrubber | `audio/scrubber.js`, waveform admission/coordinator/extractor/policy/metadata modules implement optional, separately admitted asynchronous waveform preparation and file seeking; these do not own live analysis. |
| Visualizer lifecycle | `render/visualizer-runtime.js` currently adapts one Spectral Ring plus ordered Orbs through `id/type/isVisible/update/render/reset/dispose`. `orb-runtime.js` reconciles stable Orb IDs. `orb.js` owns per-Orb simulation and TrailSystem. Existing renderer APIs remain specifically `drawOrb` and `drawSpectralRing`; there is not yet a generic dynamically discovered visualizer/module protocol. |
| Particles | `render/trail-system.js` owns emission and aging, `particle-list.js` history ordering and suffix traversal, `particle-governor.js` shared admission/fair scheduling/global oldest-first retention. `render/renderer.js` reads particles; it does not own retirement. |
| Drawing | `render/renderer.js` owns canonical Canvas2D drawing, Trace, particles, Ring and the read-only recording canvas tap. `render/color-policy.js` resolves shared colors. `core/spaces.js` and `camera-projection.js` project independent world coordinates to the viewport. |
| User interaction | `ui/ui.js` remains a large central coordinator (2,116 lines in the frozen source), with extracted analysis, Orb, Spectral Ring, Camera, Scene, workspace, visualizer inventory, waveform and recording-control modules. `ui/workspace.js` owns launcher/panel visibility/focus. |
| Recording | `recording/recorder-engine.js` owns recorder sessions, support, resource admission, stop/cancel/disposal/finalization and previous-export retention; `recording-policy.js` owns application-only resource policy. Canvas, audio-tap and live source tracks remain owned by their respective producers. |
| Presets | `presets/preset-codec.js` owns schema validation/sanitation/migration and compact schema-16 serialization; `url-preset.js` handles transport and asynchronous imported-hash transactions. Persisted Scene configuration is separate from playback/Queue, permissions, recording and the live Camera. |
| Distribution | `scripts/build.mjs` builds JS/CSS through esbuild; Python assembler produces both portable and hosted editions from a common template. `scripts/watch.mjs` stages/coherently publishes changed output. `verify_distribution.py` verifies packaging; `src/assets/branding/hosted-site.json` owns the hosted origin/metadata. |

### Important scheduling and ownership details

1. Frame delta is split into bounded emission work (`dtSec`), visible motion (`motionDtSec`) and monotonic age (`nowSec`). Hiding/pausing stops motion/emission but does not stop analysis or particle aging.
2. Orb simulation updates happen before shared governor `finishFrame()`; Ring phase-lock then reads **current-frame** first-Orb phase. **Draw order is different**: the Ring is rendered first, followed by Orbs in `preferences.orbs[]` order.
3. `AnalysisFrame` identity is reused. It is neither a new object per sample nor a freshness signal. Producers own its referenced typed arrays; consumers cannot mutate them or reach around to Web Audio.
4. Zero Orbs is valid. Orb ID/reconciliation retains survivors' simulation/history across edits and reorder. Ring is singleton under `bands.overlay`.
5. World dimensions are reference geometry, not clipping/eviction. Simulation/history coordinates are invariant under viewport resize, DPR and Camera pose. Marks use CSS-screen-sized presentation. Only explicitly saving live Camera to `preferences.sceneCamera` puts it into shared presets.
6. Particle admission, fairness and spacing are runtime-wide obligations, not private decisions of each prospective visualizer. Zero emission, zero retention, TTL expiration, fractional emission progress and world-unit same-Orb spacing have precise accepted semantics.
7. Source switching is asynchronous and fenced. Queue entry identity/revision and activation epochs prevent a stale operation from replacing the winning source or deleting newer Queue work. Recorder cleanup must respect source/render/audio ownership and preserve a previous successful export on cancellation/failure.

## 3. Compatibility and immutable baselines

- `docs/Canon/0.1.16/auralprint_0.1.16.html` is the accepted 116 portable artifact. Frozen SHA-256 per checked-in `SHA256SUMS`: `a7ccb6d0cffdc6641f7cc08fbce71b7087196b962267efae663819b2701d89db`.
- The root `version` remains `v0.1.16` until a separately authorized v117 version transition. A development branch is not a release.
- Preset writer schema is **16**; supported older schemas **2–13** retain meaning, and **14/15** are reserved/rejected. Schema 12 authored Camera, schema 13 compact baseline and schema 16 Queue/Trace rules are represented by protected tests/fixtures. A new persisted architecture must have an explicit schema/migration decision, not a silent reinterpretation.
- First-party hosted root: `https://auralprint.idiw.net/`; portable HTML is location-independent. Both are built from the same source, with distinct packaging/metadata contracts.
- `AGENTS.md` governs engineering contracts; `ROADMAP.md` owns official scope/acceptance, and executable source/runtime evidence determines implementation truth. Do not rewrite historic Canon/evidence/fixtures.

## 4. Structural observations — hypotheses, not benchmark conclusions

These are **source-proven work patterns**, not statements that the operations dominate realistic frame time:

- `main.js` invokes `UI.refreshAllUiText()` and scrubber drawing every animation callback. Several UI feature modules have internal caching/visibility checks, but the coordination and refresh paths still need realistic workload profiling.
- `ui.js` rebuilds all Queue rows with `queueList.innerHTML = ""` on `refreshQueuePanel()`; it carefully restores focus and retains ownership fences. Optimizing it must not discard those semantics.
- `orb-editor.js` builds and retains a full editor controller for every Orb in `runtime.settings.orbs`. Its settings/reference invalidation avoids some needless work, but high-count construction and bulk operations merit measurement.
- `renderer.js` draws Ring points/segments and each particle using Canvas2D operations; Ring recomputes an array of `n` point objects per rendered frame. Camera projection and CSS color conversion occur in drawing paths. These are potential profiling targets; no savings or safe caching strategy has yet been demonstrated here.
- Existing VisualizerRuntime supplies a useful lifecycle seam but assumes concrete Orb/Ring types and rendering methods. A truly generic visualizer design needs separate review of instance identity, admission, scheduling dependencies, drawing, resource ownership, error isolation, settings, preset migration and UI editing.
- `ui.js` and `recorder-engine.js` are large stateful coordination boundaries. Their size alone does not prove defects. Extraction must preserve behavior and avoid introducing two writable owners.

The current source already contains substantial modularity and protective regression work. Do not describe 116 as a monolith that can be replaced safely in one pass.

## 5. UX as it stands

The source HTML exposes Audio/Queue, Visualizers with list + per-Orb editors + Bulk Edit, Analysis, Camera, Scene Settings and Record panels, with launcher recovery and keyboard/focus behavior. File/Mic/Stream support varies by browser; unsupported actions are currently presented through support state/disabled control behavior. The current configuration surface is powerful but unusually dense. A future design should preserve an intelligible path for earlier-version users **while** supporting zero/high Orb counts, keyboard/touch/focus, mixed Bulk values, and unsupported/permission/error/finalizing states. No new layout or Simple/Advanced mode is selected in this checkpoint.

## 6. Verification, evidence and gaps

- Verified remotely: baseline branch SHA, main `version`, schema constant, archived Canon checksum, source files/paths, README commands, and `.github/workflows/ci.yml`. GitHub reports a **successful push CI run** on this exact baseline commit: [41404129391](https://github.com/Kisuul/Auralprint1/actions/runs/41404129391) (historical run; not executed during this review).
- **Not run in this Step 0 review:** `npm ci`, `npm test`, `npm run build`, `python scripts/verify_distribution.py`, Chromium browser suites, device/browser audio/permission checks, performance benchmarks, pixel-fidelity comparisons, recordings or soaks. The current review environment cannot clone the GitHub repository directly, so no fresh local execution result is claimed.
- Historical qualifications remain relevant: native Safari/iOS, fully offline/direct-file combinations, physical permission/capture paths and long recording/export/device cases were not universally certified. Unresolved watcher duplicate-save and child-shutdown assertions are separate development-tool investigations; neither is assumed fixed.
- No benchmark on the new branch establishes v117 targets or performance wins. Before optimizing, pin workload, edition, viewport/DPR, hardware/browser, audio source, Orb/particle/Trace load, callback duration, delivered frame interval, memory and visual fidelity.

## 7. Step 0 outcome and decision boundary

The first v117 task is **understanding and preserving 116**, not choosing a replacement ABI or altering the interface. This checkpoint records current executable boundaries and protected user behavior. Next engineering work should derive a dependency/ownership map and reproducible baseline, then propose **small reviewable** architecture experiments with measured evidence. Generic rendering, dataflow, plugin discovery, async analysis, UI composition, and configuration/preset redesign are open choices—not approved implementation mandates.

**No 117 runtime changes, version bump, preset/schema change, release, deployment, merge, or external-team development work is authorized or performed here.** The owner remains the final arbiter of design and release acceptance.
