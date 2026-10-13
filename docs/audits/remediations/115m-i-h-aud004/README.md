# 115M.I.H / H.1 — October 9 AUD-004

Focused presentation remediation; Build 115N remains **WITHHELD**. Schema 10 is unchanged. This is the October 9 UI mutation finding, not the October 6 FFT-overlap finding.

Starting main: `a2a92e0ed73acd57cc0ee782934a206024084328`, merged PR #48, development `v0.1.15m.i.g`. Remote main verified through both fetch and GitHub API; clean starting working tree. Accepted F/G implementations and evidence are ancestors. Branch: `codex/115m-i-h-aud004`.

The binding report is `docs/20261009-004238_project-audit.md`, AUD-004 and sections 5.8, 7, 11 and 14. This is a bug fix in UI presentation. No CONFIG/preset/audio lifecycle/scheduling changes are authorized. Primary risk: suppressing asynchronous source or recorder settlement while optimizing unchanged UI.

## Independent reproduction

`diagnostics/measure.cjs` serves the actual generated portable HTML with observation hooks added in memory. Native Linux Chromium runs 2,000 synchronous production UI refreshes per scenario. MutationObserver counts text, title, ARIA, class, other attributes and element insertion/removal. Native setter wrappers independently count value/checked/disabled assignments; isolated function counters count tooltip visits and recorder projections. RAF is held by the harness only; one frame initializes canvas geometry. Native frames are driven during recording warmup so MediaRecorder receives real video. Native audio and recorder timers are retained. Playback warms through the load-toast deadline before the unchanged batch; focus uses an inventory action when visible and its accessible Workspace launcher when hidden. The final harness-check attempt is preserved in `evidence/measurement-harness-check.json`. Synchronous batches hold telemetry constant; their times are UI JavaScript time, not rendering time or FPS.

`evidence/baseline.json` preserves the first complete accepted-main results byte-for-byte. `baseline-final.json` repeats the accepted-main measurement with finalization measured inside the same synchronous stop/refresh turn and panel-entry counters; compare it with `fixed.json`. `baseline-initial.json` preserves an initial attempt that timed out waiting for recorder start before canvas initialization. `baseline-capture-isolation.json` preserves an attempt with no recording chunks because canvas drawing was held throughout capture. Those harness failures are not acceptance results. The corrected harness measures actual recording with a short frame-driving warmup.

Reproduce after building the accepted revision:

```sh
NODE_PATH=/opt/codex/runtimes/cua/lib/node_modules node docs/audits/remediations/115m-i-h-aud004/diagnostics/measure.cjs result.json
```

Use a separate checkout at the starting SHA for baseline, copying only the diagnostic. `CHROMIUM_PATH` selects native Chromium; Playwright is supplied by the environment, not added as a dependency. `MEASUREMENT_VERSION` can select an already-built portable revision. Identical viewport, iteration count and scenario setup are used for fixed measurements.

## Root cause and correction

The normal frame still samples AudioEngine, updates AnalysisFrame and VisualizerRuntime, renders, refreshes UI, and draws Scrubber at its original cadence. `main.js` is unchanged. The defect was within presentation: unconditional text/native-control setters, unchanged selector/launcher attributes, all-control tooltip title traversal, a second unconditional recorder projection, unchanged Analysis metadata and periodic badge replacement.

| Values | Authoritative owner | Presentation / invalidation |
| --- | --- | --- |
| Settings and editor values | preferences → resolveSettings → runtime.settings | Existing feature guards reconcile canonical values. Settings replacement invalidates tooltip evaluation; generated-title comparison decides whether meaning actually changed. |
| File/Mic/Stream state, errors, transport and queue | InputSourceManager, AudioEngine and Queue | Read current source/transport state every refresh; compare DOM values before writes. Status changes need no preference replacement. |
| Recorder phases, support, selections, elapsed time, retained export | RecorderEngine → state.recording | Existing sync key expanded to include displayed time and presentation fields. Gate performs EOF coordination before deciding whether to project. |
| Mono/stereo and band metadata/energies | Producer-owned AnalysisFrame and BandBank | Audio diagnostics stay live. Analysis metadata compares text; existing HUD interval retained. Unchanged row styles/badge text are not rewritten. |
| Audio toast expiration | Existing UI toast deadline | Deadline still evaluated each refresh; return to current source status on expiration. Existing deterministic expiration test retained. |
| Panel visibility, stacking, launcher state and focus | Workspace | Attribute/class comparisons; reveal callback refreshes current presentation before focus restoration. Analysis reveal forces immediate HUD presentation through its existing owner. |
| Focus/hover/input feedback | Existing control event handlers | Immediate control tooltip refresh; queued input feedback runs after canonical handlers/readouts. |
| Orb inventory / editor control membership | VisualizerRuntime and OrbEditor | Existing type-plus-ID reconciliation preserved. Control-change callback reindexes tooltip associations and releases removed controls' three tooltip feedback handlers. |

### Recorder refresh ownership

`maybeRefreshRecordingUi()` settles pending track end on every normal refresh, including unchanged text. It then compares the canonical recording UI key and calls `projectRecordingUi()` only on change. `refreshRecordingUi()` remains the explicit-action/public contract: settle pending EOF, then project. Projection itself does not consume EOF. The terminal state machine and RecorderEngine are unchanged. Pending events are cleared by the existing coordinator before transitions, protecting nested refreshes. There is no new polling interval.

The key retains RecorderEngine's existing `lastUpdatedAtMs` contract, plus support/phase/message/export/MIME fields and displayed timer text. Asynchronous commits cannot be hidden behind a settings reference. Native held-finalization/EOF evidence demonstrates the lock persisting while finalizing, exactly one successor activation on completion, usable download, transport unlock, and retention of the prior successful export after a native recorder error callback.

### Tooltip invalidation

The existing per-control spec, indexed label discovery, static help, formatted readouts, input feedback, focus/hover feedback and listener identity remain. Panel groups are a local presentation index, not an authoritative settings/source/recorder store. Their dirty flags are set by settings/definition replacement, actual audio-control/readout differences, recorder projection, structural control discovery, and Workspace reveal. Dirty visible groups are evaluated once; only changed generated titles are assigned. Unrelated settings can cause an evaluation but do not rewrite unaffected titles.

Registered configuration tooltips read their controls and formatted value readouts, not live analysis-bar energy. Record values follow recorder projection; source/transport button titles are evaluated separately each frame. Dynamic band summaries follow canonical settings and BandBank definition replacement. This avoids assuming unchanged settings means telemetry is unchanged. No arbitrary frame count or time-based tooltip polling is introduced.

Feedback handlers are stored on the existing specs so removed controls release input/change, focus and mouseenter listeners. Surviving specs keep the same handlers. The active spec Map/group index is rebuilt from current controls, so removed nodes cannot accumulate in the traversal. Original OrbEditor input/keyboard listeners remain owned by their editor and become collectible with its detached controller; the tooltip subsystem retains no removed control. Native evidence explicitly records the three released tooltip handlers.

### Hidden panels

Normal hidden Visualizers refresh skips OrbEditor, inventory and Ring editor calls. Canonical settings/runtime simulation still update normally; explicit setting/collection actions retain their existing reconciliation path. Tooltips retain dirty flags until reveal. Workspace refreshes presentation synchronously on reveal, then restores the established focus destination. It retains only a reference to the producer-owned latest AnalysisFrame for truthful reveal diagnostics.

Hidden Analysis keeps bounded controls/metadata current while deferring table construction, range traversal and HUD work. Reveal refreshes HUD immediately even within the existing interval. Scene's existing settings guard and value-compared particle diagnostics remain. Hidden recording and source/transport settlement are never suppressed.

## Validation and limits

- Permanent tests: eleven new behavioral regressions across the existing targeted-audit and Analysis suites. Focused validation: **341 passed**. Full suite: **803 passed, 0 failed, 1 established skip (804 total)**. F activation/queue and G identity/targets/numeric contracts remain intact.
- Sequential commands and output summaries: `evidence/full-validation.json`. `npm ci` failed because the default home npm cache was unavailable. The established `npm ci --offline --cache /workspace/auralprint-environment/npm-cache --ignore-scripts` fallback succeeded, using the provisioned esbuild binary via the existing activation script. `npm test`, `npm run build`, `python scripts/verify_distribution.py`, and `git diff --check` all passed. No dependency or lockfile change.
- H native acceptance: **9/9**, including real File transport, pending activation cancellation, toast expiration, fake-device Mic, rejected Stream, focus/readouts/accessibility, tooltip lifecycle, hidden reveal and native capture/finalization/EOF/download/error. No unexpected page/console errors or unhandled rejections. The deliberately injected native recorder error emits the expected RecorderEngine console diagnostic; it is preserved explicitly in evidence.
- Protected native rechecks on the H artifact: F.6 **21/21**, G.1 **38/38**, G.2 **31/31**, G.3 **27/27**, G integrated **13/13**. These re-use immutable prior diagnostics, selecting the H HTML; F.6 uses a read-only in-memory path adapter. Historical `auditedCommit`/`auditedSha` labels in those result formats describe the original diagnostic provenance, not this H checkout. Actual H artifact hashes and `environment.json` identify the rechecked application.
- Eight disposable negative controls each pass their original positive control and fail the intended observable assertion after mutation. They cover tooltip title assignment, duplicate recorder projection, selector ARIA, stale source errors, stale finalization, stale reveal, lost inventory focus, and duplicate tooltip registration. Harness crashes do not count. Original source/test digests remain unchanged.
- Implementation `2dda1235d3272557b39cbdd961b076197cd8cc05` passes Linux and Windows CI [run 38338966106](https://github.com/cosmicdance-4-2-0/Auralprint1/actions/runs/38338966106), including locked install, full tests, build, distribution/version and whitespace checks. The final evidence-only head is checked after push; its exact SHA/run are recorded in the PR handoff, avoiding a self-referential commit hash in tracked evidence.
- Version `v0.1.15m.i.h` is synchronized in `version`, constants banner and established version/packaging assertions. Preset schema remains **10**. No prior audit evidence, canonical shipped artifacts, AudioEngine/InputSourceManager/RecorderEngine internals, analysis contract/geometry, simulation, frame clocks or Scrubber cadence changed. No new finding is begun.

See `measurements.md`, `validation.json` and `evidence/` for categories, timings, commands, exact changed-file inventory and native results. The original October 9 and G.4 mutation counts are historical context, not interchangeable benchmarks.

Remaining costs: bounded source/transport/key/metadata comparisons each frame; the existing visible Analysis HUD table scan at its established interval; Scene particle-stat reads; structural/settings reconciliation when actual inputs change; and recorder projection on canonical timestamp changes even when some displayed fields remain equal. Changed settings still use existing feature synchronization and can assign unchanged non-tooltip editor values once per application. Valid maximal inventories and physical hardware/screen readers/direct-file launch remain broader release acceptance. The environment is headless Linux Chromium over localhost; Mic uses Chromium's fake device, Stream refusal is controlled, and fault injections are disclosed. Native portable/hosted output is tested; this phase makes no FPS, general device-performance or Build 115N release claim.

**AUD-004 is ready for independent review. Build 115N remains WITHHELD.**
