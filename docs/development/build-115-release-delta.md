# Build 115 release comparison — Release 4

**Release 4 / Build 115 (`v0.1.15`, schema 10)** was accepted by the owner on October 20, 2026 after 115N RC testing. This development comparison is not the canonical changelog. Public predecessor: Build 113 / Release 3; Build 114 was shipped internally. The [canonical changelog](../Canon/changelog.md) records chronological `v114 → v115` changes; together with its `v113 → v114` entry these describe the public Release 3 → Release 4 span.

Current development also provides resource-admitted optional waveforms: a single-flight pipeline, bounded metadata inspection, source-owned encoded/estimated-PCM ceilings, independent local 4/8/15m application choices and manual Generate. Playback and seeking remain primary. The [I.2D report](../audits/remediations/115m-i-i-aud007/final-acceptance/README.md) records corrections, owner-reported cross-browser/direct-file acceptance and residual estimate/offline uncertainty; it does not approve 115N or publish release notes.

## Baselines and method

| Perspective | Behavioral baseline | Status |
| --- | --- | --- |
| A · Public release | [Build 113 executable artifact](../Canon/0.1.13/auralprint_0.1.13.html), `v0.1.13`, schema 8 | Release 3, canonical public shipped baseline |
| B · Engineering milestone | [Build 114 executable artifact](../Canon/0.1.14/auralprint_0.1.14.html), `v0.1.14`, schema 8 | Internally shipped milestone; not a public Release 4 |

The Build 113 and 114 HTML artifacts were inspected as executable source, including CONFIG, Orb/TrailSystem, channel selection/sample, codec, UI, transport and recorder functions. Current references are the implemented modules linked below. [Build 110](../Canon/0.1.10/index.html), [111](../Canon/0.1.11/index.html) and [112](../Canon/0.1.12/auralprint_0.1.12.html) establish older schema/analysis/queue context; they are not substituted for either comparison baseline. The [canonical changelog](../Canon/changelog.md) supplies editorial context, not behavioral proof, and remains unchanged.

This is a source/artifact comparison supported by existing current-build regression and remediation evidence. Retired bundles were not rerun across devices or subjected to a new browser audit. Where the same defective control flow exists in a baseline, that is stated explicitly; historical incidence, full media fidelity and hardware performance are not inferred. Internal prototype corrections are not automatically shipped-product “Fixes.” The [development record](build-115.md) owns that chronology.

## A · Public Build 113 → Build 115

### New systems and capabilities

- **Live microphone and shared-stream analysis** alongside files, with permission/support/error/reconnect state and source-aware recording. Build 113 has file playback; current [InputSourceManager](../../src/js/audio/input-source-manager.js) owns Mic/Stream activation, and [AudioEngine](../../src/js/audio/audio-engine.js) exposes the active audio tap. This net public delta includes work already present in internal Build 114; it is not newly invented in Build 115.
- **First-class visualizer lifecycle and inventory:** [AnalysisFrame](../../src/js/audio/analysis-frame.js) separates producer data from consumers; [VisualizerRuntime](../../src/js/render/visualizer-runtime.js) dispatches the singleton Spectral Ring and each Orb. [Visualizers UI](../../src/js/ui/visualizers-panel.js) manages the collection in one workspace, including valid zero-Orb scenes.
- **Independent Orb design and editing:** [Orb](../../src/js/render/orb.js) reads its own motion, response, particles and trace rather than historical global behavior. [OrbEditor](../../src/js/ui/orb-editor.js) exposes source/targets, centers, designed phase, hue/color overrides and nested settings, with mixed-aware Bulk Edit. Add/Duplicate/Remove preserve surviving stable identities/history; duplication starts new runtime history.
- **Configurable particle resource governance:** [governor](../../src/js/render/particle-governor.js), [trail](../../src/js/render/trail-system.js) and [Settings UI](../../src/js/ui/scene-panel.js) enforce selected scene-wide emission/retention budgets, fair allocation, oldest-first retirement and diagnostics. Placement distance prevents redundant same-Orb placements; it does not delete history.
- **Recording resource settings:** Balanced uses a five-minute automatic Stop target and encoded-data limits; Custom allows independently disabled limits, and Unrestricted opts out of application size/chunk/duration ceilings. Failed replacements preserve the previous export. The limits do not bound browser memory.
- **Two distribution editions:** [build](../../scripts/build.mjs) and [packaging contract](../../scripts/distribution.py) produce a versioned self-contained portable HTML and a complete relocatable hosted package from shared bundles. Hosted metadata stays inside its deployment prefix; portable favicon is embedded.

### Meaningfully altered existing systems

- **Channel-targeted energy now follows the Orb's channel.** Build 113 `getBandForOrb()` reads `state.bands.energies01` (combined C) for selected targets, even for an L/R Orb. Current `selectOrbAnalysis()` uses that Orb's channel band-energy array; empty targets still use channel full-spectrum energy. L/R/C band definitions remain shared. Targeted scenes can respond differently after migration, deliberately.
- **Analysis and appearance have distinct workspaces.** The historical Sim/Bands controls become dedicated Analysis, Visualizers and Settings ownership. [Analysis UI](../../src/js/ui/analysis-panel.js) owns FFT/gain/smoothing/definition/diagnostics; Scene owns shared palette/background/default policy; Orbs retain local overrides. Ring consumes combined C and shared colors, and retains `bands.overlay` persistence.
- **Particle history changes meaningfully.** Both historical artifacts' `TrailSystem.emitAt()` remove nearby existing particles through `overlapRadiusPx`. Current placement filters creation against the same Orb's retained tail; TTL and oldest-budget retirement own removal. Obsolete overlap settings are discarded, not translated into placement distance. A migrated scene can look different.
- **Motion, emission and age have separate clocks.** Historical animation uses one capped delta for motion. Current [frame loop](../../src/js/main.js)/[timing](../../src/js/core/timing.js) integrates ordinary visible motion through 0.5 s, bounds emission at 1/30 s and ages particles in real time; larger/hidden/invalid gaps discard debt. Visual pause includes free Ring motion; analysis continues.

### Compatibility and workflow changes

The [schema-10 codec](../../src/js/presets/preset-codec.js) accepts schemas 2–9, including both development-era schema-9 layouts; global visual behavior migrates into independent Orb copies. It encodes configuration only and strips runtime/session additions. Invalid targets are discarded; designed phase wraps into `[0, TAU)` with fractional precision preserved. URL sharing remains; local preset-file workflows are deferred.

The Analysis workspace displays band count but does not offer an editor. Imported supported count is 3–256, default 256. Configured and Nyquist-effective limits remain distinct. Load/drop uses the actual decoder/error path rather than trusting MIME metadata. Queue visibility/focus and preference feedback follow their owners. Recording still negotiates native formats; browser/device support is not universal.

### Verified corrections relative to the comparison baseline

These defects are present in inspected Build 113 control flow and absent from Build 115. This source comparison does not establish that every defect occurred in a public user's session.

| Observable correction | Baseline proof → current implementation / evidence |
| --- | --- |
| FFT-aligned boundaries no longer include a lower bin solely through the wrong scale | Baseline `computeEnergiesFromCAnalyser()` uses `(bins - 1)` for Hz conversion. Current [BandBank](../../src/js/audio/band-bank.js) uses bin geometry `bins` with final clamping; [coordinate evidence](../audits/remediations/115m-h-i-rc08/README.md) preserves intentional adjacent overlap. |
| Play superseded by Clear/replacement exits quietly | Baseline `playPause()` dereferences mutable `mediaEl` after awaits. Current AudioEngine captures/revalidates its owner; [transport evidence](../audits/remediations/115m-h-f-rc04/README.md). |
| Supported Ogg/unknown-MIME candidates reach decode; cancelled touches stop seeking/interception | Baseline picker/drop filters `audio/` and Scrubber wires touchend without touchcancel. Current [UI](../../src/js/ui/ui.js)/[Scrubber](../../src/js/audio/scrubber.js) use decoder-led admission and terminal cancellation; [media evidence](../audits/remediations/115m-h-m-rc12/README.md), [touch evidence](../audits/remediations/115m-h-o-rc14/README.md). |
| Previous completed export survives unsuccessful replacement recording | Baseline recorder calls `clearRetainedExportState()` before acquisition/start and aliases previous export metadata. Current [RecorderEngine](../../src/js/recording/recorder-engine.js) retains it and revokes by captured URL after successful replacement; [regressions](../../tests/recording-export.test.js), [native protection](../audits/remediations/115m-h-g-rc05/rc06-browser-protection.json). |

### Deliberately absent or deferred

Camera/projection, 3D, richer frequency/band-table tooling, local preset-file import/export, broader constrained-hardware/long-panel optimization, hosted offline caching and service-worker installation remain absent. Real devices/permissions, exported fidelity, physical accessibility/touch and demonstrably network-disabled direct-file operation are not universally certified by [Release 4 acceptance](../../ROADMAP.md#build-115-release-acceptance-and-qualifications). Recording and the five band distributions already exist in Build 113 and are not new Build 115 public capabilities.

## B · Internal Build 114 → Build 115

### New systems and capabilities

The net additions are the analysis-consumer/lifecycle seam, runtime-backed Visualizers inventory, stable-ID collection operations with complete independent Orb editing/Bulk Edit, dedicated Analysis and shared Scene ownership, selected particle budgets/placement controls, portable/hosted distribution contracts, and configurable recording resource policy described above. Build 114 already contains Mic/Stream and source-aware recording; do not list them as new for this engineering comparison. Its source is already modularized inside the canonical single HTML; modularization itself is not a new Build 115 system.

### Meaningfully altered existing systems

- Build 114 also uses combined-C selected-target energy and global Orb behavior. Current L/R/C spectral targeting, per-Orb settings, local color/center controls and scene-owned shared palette are the net changes.
- Historical overlap deletion gives way to pre-placement filtering and shared resource retirement. Selected budgets can preserve or limit history intentionally; maximum accepted settings do not imply safe frame rates.
- Current visible motion is independent of emission-work time. Designed phase edits, reset and free Ring pause are explicitly owned. Ring is promoted from an overlay drawing feature into a runtime singleton with its own editor; its existing C data and persistence path remain.
- Settings/preset consolidation and one Visualizers editing workspace replace transitional panel ownership. Current UI recovery includes raising focused panels and restoring visible Queue/Orb action focus.

### Compatibility and workflow changes

Build 114's embedded schema version is 8; current schema 10 moves global behavior into Orbs and supports both historical schema-9 forms. Existing File/Mic/Stream, queue, scrubber, recording and URL sharing remain integrated through the same owning subsystems. Source activation revalidates ownership across asynchronous resume, and cancelled work releases only its own tracks. Recorder terminal disposal explicitly stops native encoding while retaining upstream ownership; ordinary Stop still produces an export.

The portable/hosted packaging split changes metadata/resources, not the application implementation. Full hosted directory deployment and correct MIME serving replace unsupported root-relative resource assumptions. Direct-file acceptance, maskable artwork and installability are not implied by the manifest.

### Verified corrections relative to the comparison baseline

The four Build 113 defect paths above also exist in Build 114: `(bins - 1)` FFT mapping, mutable Play owner, MIME-only ingestion/missing touchcancel, and premature retained-export clearing. Their current correction/evidence applies to this comparison as well.

Two additional source-specific cases are present in the Build 114 artifact:

| Observable correction | Baseline proof → current implementation / evidence |
| --- | --- |
| Cancelled live attachment cannot tear down a newer source graph | Baseline `attachMediaStreamSource()` resumes then replaces the graph without an ownership guard. Current AudioEngine/manager revalidate activation before replacement and fence stale errors; [live ownership evidence](../audits/remediations/115m-h-e-rc03/browser.json). Physical permissions remain a separate gate. |
| Natural EOF during recording finalization is replayed once rather than lost | Baseline `_onTrackEnded` returns on the finalizing File lock; current UI retains owned EOF and consumes it after unlock through the ordinary policy; [EOF evidence](../audits/remediations/115m-h-g-rc05/README.md). |

These are verified baseline-path corrections, not a claim of a new defect introduced after either shipped artifact. Unsafe allocation, premature new-code identity fallback, mixed new Bulk selects, and collision naming in the new inventory are internal Build 115 corrections; they belong in [development history](build-115.md), not automatic public Fixes entries.

### Deliberately absent or deferred

The same Camera/3D, richer band, file-preset, hardware/UX and caching deferrals apply. Resolving bounded resource correctness does not complete Build 117 optimization, bound long-duration recording memory, or certify expert/max-count visual usability.

## Final release disposition

- Release 4 is Build 115 (`v0.1.15`), preset schema 10. Public predecessor is Release 3 / Build 113; Build 114 is an internal comparison milestone.
- Owner accepted the 115N RC after public use and tester feedback. This is an acceptance decision, not certification of every platform, device or exported format.
- Firefox does not provide shared-display audio; Stream requires an audio track. Other input workflows remain independent.
- The [canonical changelog](../Canon/changelog.md) carries the requested incremental `v114 → v115` delta. Compatibility notes remain relevant for channel-targeted energy, discarded overlap behavior and per-Orb settings. Build 116/117 own postponed camera and UX/optimization work.
