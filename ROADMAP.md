# Auralprint development roadmap

**Current public release.** Release 5 / Build 116 (`v0.1.16`), preset schema 16. See the [acceptance record](#build-116-simulation-world-camera-and-projection).

This document owns the plan, milestone acceptance and deferrals. [README](README.md) owns current capabilities, user instructions and [developer verification](README.md#developer-bootstrap); [AGENTS](AGENTS.md) owns engineering policy. The [Build 115](docs/development/build-115.md) and [Build 116](docs/development/build-116.md) worklogs own completed stages, corrective history and evidence. [Release comparisons](docs/development/build-115-release-delta.md) distinguish public Build 113 from internal Build 114.

<a id="build-115n-acceptance-gates"></a>

## Build 115 release acceptance and qualifications

All 15 delivery stages are complete. **The owner accepted Build 115 for Release 4 on October 20, 2026**, following extended 115N testing and live public RC feedback. Automated Linux/Windows CI and the shared distribution contract passed. Acceptance is a release decision, not universal browser/device certification. Schema 10 is frozen; new feature work does not reopen Build 115. See the [completed engineering history](docs/development/build-115.md) and [audit dispositions](docs/development/build-115.md#audit-disposition-index).

- Firefox shared-display **audio** is unavailable through its display-capture API; Stream requires an audio track and rejects video-only sessions. Chrome, Opera and Edge Stream operation was owner-reported. File and Mic have separate support requirements.
- The owner reported direct-local-file and Python-hosted functional coverage in Chrome, Opera, Edge and Firefox; exact codecs and a complete browser/mode/case matrix are not inferred. Managed Chromium automation used HTTP; its direct `file://` navigation was blocked.
- Browser/device combinations, real media, physical touch, native capture/permission dialogs, accessibility, recording/export fidelity and external-player/download/long-duration behavior have not all been independently certified. Network-disabled portable operation and maskable artwork remain unverified. Unsupported features and environmental limits are not passing tests.
- [README distribution guidance](README.md#developer-bootstrap) links the canonical portable artifact and shared hosted build. Hosted deployment requires the complete generated directory; no caching/installability claim is made.

## Protected semantics and limits

- Orb channel selects waveform, full-channel energy and selected-band energy. Empty targets use full-channel energy; nonempty targets average the selected channel's energies. Global spectrum/dominant remain real combined C. Inherited dominant color follows an Orb's target; explicit dominant remains global C.
- Designed phase is canonical radians in `[0, TAU)`, displayed in degrees. Editing preserves live history; Reset Visuals applies design and clears trails; track reset clears trails without changing phase. Pause stops Orb/free Ring motion/emission while analysis and TTL aging continue.
- Published schema 10 and accepted development schema 11 are immutable; schema 12 is the immutable authored-camera format; schema 13 adds frozen deltas and ordered ranges without changing canonical Scene configuration. Future persisted changes require versioning/migration under [AGENTS](AGENTS.md#21-schema-discipline). Legacy support and CONFIG → preferences → runtime.settings → state remain protected.
- Selected particle budgets are enforced without hidden default ceilings. Zero emission preserves history; zero retention clears/rejects it. Nonzero spacing filters new same-Orb placements, never deletes nearby history. Emission work has an immutable 1/30 s ceiling; ordinary motion integrates visible elapsed time up to the 0.5 s discontinuity threshold.
- The 4,096-Orb admission ceiling and expert particle maxima are operational bounds, not safe-device/FPS claims. Audio, source, recorder, Nyquist, and shared portable/hosted build ownership remain protected.
- Recorder correctness and prior-export preservation remain mandatory; encoded-data limits do not bound total browser memory.

Analysis remains independent of visualizers; consumers neither access Web Audio internals nor mutate producer-owned analysis. Stable Orb identities, surviving history, zero-Orb validity and one writable UI owner per setting remain binding [engineering contracts](AGENTS.md). A separate Scene/compositor architecture is not a prerequisite. Detailed implementation and superseded contracts live in the [Build 115](docs/development/build-115.md) and [Build 116](docs/development/build-116.md) worklogs.

<a id="known-deferrals-after-115mh"></a>

## Known deferrals

Build 116 separated the simulation world from the viewport to address trail smearing during resize and orientation changes. See the [Build 116 acceptance record](#build-116-simulation-world-camera-and-projection). Orb/Queue ergonomics, constrained-hardware rendering/analysis, heavy Canvas/UI work, large synchronous retirement and broader source/recorder resource hardening remain [Build 117](#build-117-ux-and-performance-hardening). Spectral partition and legacy-name ambiguities remain [Build 118](#build-118-richer-spectral-selection).

Build 115's accepted items (AUD-001/003/005, editor jump, Stream stereo, schema closure, visualizer ownership, RC-01–RC-22 and distribution metadata) are not open deferrals. Future improvements retain their existing owners; this plan creates no new functional assignment.

## Build 116: simulation world, camera and projection

**Accepted October 31, 2026.** The owner authorized Release 5 (`v0.1.16`, preset schema 16) from [RC #2](docs/development/build-116.md#116-rc-2--owner-promotion-and-qualifications). The [release notes](docs/Canon/changelog.md#v115--v116-release-5--build-116) describe the shipped changes. Particle Birth Color and Angular Trace were deferred.

- **Owner evaluation.** Functional testing was reported on Windows with Chrome, Edge, Firefox, and Opera, and on physical Android devices with Chrome. Camera touch gestures worked across multiple Android revisions. The owner and original requester accepted the appearance of Trace fade. The reports do not specify every device, browser version, or feature tested.
- **Automated evidence.** The [worklog](docs/development/build-116.md#116-canon--release-5--owner-acceptance-and-archived-artifact) records the archived HTML and checksum. See the [Queue and Trace candidate checks](docs/development/build-116.md#116-feature-candidate), [Camera touch checks](docs/development/build-116.md#camera-touch-completion), [world and projection checks](docs/development/build-116.md#116b-implementation-and-verification), and [preset and browser checks](docs/development/build-116.md#116e-compact-presets). The [post-RC #1 review](docs/development/build-116.md#post-rc-1-accessibility-correction) records the accessibility corrections included in RC #2.
- **Coverage limits.** Native Safari, screen-reader speech, fully offline use with the portable file, native permission dialogs, and long-duration recording and export fidelity remain unverified for Release 5. See the [device matrix](docs/development/build-116.md#116e-owner-device-matrix) for the original coverage criteria.

The owner accepted two unresolved development-tool risks for Release 5. Reruns of the same commits passed. The original causes remain unknown.

- **Ubuntu duplicate-save assertion** (AUD116-006 / R2-003). An interrupted-save model reproduced the assertion without corrupting output. See the [RC #1 disposition](docs/development/build-116.md#116-rc-1--owner-promotion-and-qualifications).
- **Windows watcher child termination.** A Python child survived the initial test run. See the [RC #2 disposition](docs/development/build-116.md#116-rc-2--owner-promotion-and-qualifications).

The original criteria and corrections remain in the [pre-RC review](docs/audits/20261029-auralprint-116-final-pre-rc-review.md) and [authored Camera contract](docs/development/build-116.md#116d-authored-scene-camera). The release authorization covered the Canon archive. Tagging, GitHub publication, and external deployment are separate actions.

## Build 117: UX and performance hardening

**Hosted packaging implemented November 1, 2026.** [PR #106](https://github.com/cosmicdance-4-2-0/Auralprint1/pull/106) added official-site metadata, manifest settings, and a preview image to the hosted build after the Canon archive was made. This checkout includes that work. External deployment is a separate action.

**Performance and UX work remains planned.** Targeted fixes may accompany their owning milestone.

Measure rendering and analysis on constrained hardware, reduce unnecessary hidden-panel updates, and address interaction problems found during Build 115/116 use. Preserve useful tooltips, reset behavior, and recoverable panel visibility.

Acceptance gates:

- Establish and record representative device, audio, viewport, FFT, and particle settings before comparing performance.
- Prevent unbounded work and new per-frame allocations; show an actionable explanation for any user-visible performance limit.
- Repeated source changes, queue operations, panel toggles, and recording cycles do not accumulate listeners or retain obsolete media resources.
- Keyboard and narrow-layout checks cover every panel, including empty, loading, error, and finalizing states.

### Outstanding UX and resource work

| Concern | Scope / qualification |
| --- | --- |
| Orb editor ergonomics / high-count navigation and long panels | Build 117 UX refinement |
| File / Queue UX refinement | Build 117, retaining accepted focus/cancellation corrections |
| Broader constrained-hardware performance / resource hardening | Build 117; RC-15 corrective work is closed, and broader tuning is deferred |
| Broader source/load lifecycle hardening (October 6 AUD-006) | Build 117; demonstrated RC-02–RC-05 concurrency/EOF defects are closed |
| Broader recorder memory / encoder optimization (October 6 AUD-009) | Build 117; October 9 AUD-006 bounded application policy is implemented and merged through N.3F (PRs #59/#60). Encoded payload does not bound total browser memory; N.2 high-resolution VP8 reached its diagnostic resource guard. |
| Injected File-tap cleanup refusal (AUD116-005) | Build 117 hardening, as retained in [PR #94](https://github.com/cosmicdance-4-2-0/Auralprint1/pull/94). Native failure reachability remains unestablished. |
| Remaining allocations / hidden UI refresh / channel-complete analysis cost (AUD-012) | Build 117; direct Trace suffix traversal and demonstrated quadratic editor/tooltip work have already been corrected |

## Build 118: richer spectral selection

**Status: planned; the basic chooser shipped in Build 115.**

Expand the spectral system with frequency-aware selection and inspection, visual confirmation, configurable practical band-table sizes, curated counts envisioned around 5/64/256/1024/2048, deterministic thematic naming from planetary/core through cosmic/quantum imagery, and sensible generated fallbacks. The current canonical 256-band implementation remains unchanged until that work. Add only controls that correspond to implemented analysis behavior. Weighted aggregation remains a separate design decision, not an implied capability.

Acceptance gates:

- Selection feedback explains the active distribution and effective frequency range.
- Named selections resolve deterministically to supported band IDs or receive an explicit new schema design if they need different persistence semantics.
- Selection remains legible for sparse and dense targets, and each orb's configuration remains independent.
- Existing presets retain their meaning; new persisted fields follow the full schema process.

### Outstanding spectral decisions

| Concern | Scope / qualification |
| --- | --- |
| Adjacent positive-width FFT-bin overlap (AUD-004) | Intentional current behavior; Build 118 spectral partition work, separate from corrected coordinate scaling |
| Duplicate legacy band-name migration ambiguity (AUD-013) | Build 118 |

## Build 119: preset workflow upgrades

**Status: planned.**

Add local preset JSON export/import with validation and readable errors, using the same canonical configuration pipeline as URL presets. Keep Copy Link. Consider PNG capture only after the configuration workflow is reliable.

Acceptance gates:

- Exported presets reimport with equivalent normalized settings.
- Malformed files and unsupported schema versions fail without partially applying settings.
- Queue, playback position, recordings, and live input permissions are excluded.
- Legacy migration works through the same path for both URL and file imports.
- File workflows work offline in the standalone HTML.

## Build 120: optional 3D and perspective

**Status: gated exploration, not committed implementation.**

Revisit after camera behavior and the 2D workflow are stable. Define the user benefit, expected performance, and configuration migration before implementation. Experiments require an explicit flag; 2D remains the default and stable fallback.

Acceptance gates:

- Optional 3D cannot change the meaning of existing 2D presets or degrade the default workflow.
- Simulation and projection remain separate.
- Performance is measured against the Build 117 baseline at documented settings.
- Any new persisted axis/projection fields have normalization, limits, versioning, and migration coverage.

## Completion and release evidence

For each delivered milestone, record the implementation scope, test/build result, browser/device checks, preset compatibility result, and remaining limitations. Mark completion only when its acceptance gates have evidence. Release tags, distribution deployment and archival checks must match the accepted canonical version.

Prioritize fixes that make an existing capability understandable or recoverable. Defer new abstractions and feature expansion that do not resolve a demonstrated workflow problem.
