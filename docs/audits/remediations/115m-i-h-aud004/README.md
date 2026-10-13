# 115M.I.H / H.1 — October 9 AUD-004

Focused presentation remediation; Build 115N remains **WITHHELD**. Schema 10 is unchanged. This is the October 9 UI mutation finding, not the October 6 FFT-overlap finding.

Starting main: `a2a92e0ed73acd57cc0ee782934a206024084328`, merged PR #48, development `v0.1.15m.i.g`. Remote main verified through both fetch and GitHub API; clean starting working tree. Accepted F/G implementations and evidence are ancestors. Branch: `codex/115m-i-h-aud004`.

The binding report is `docs/20261009-004238_project-audit.md`, AUD-004 and sections 5.8, 7, 11 and 14. This is a bug fix in UI presentation. No CONFIG/preset/audio lifecycle/scheduling changes are authorized. Primary risk: suppressing asynchronous source or recorder settlement while optimizing unchanged UI.

## Independent reproduction

`diagnostics/measure.cjs` serves the actual generated portable HTML with observation hooks added in memory. Native Linux Chromium runs 2,000 synchronous production UI refreshes per scenario. MutationObserver counts text, title, ARIA, class, other attributes and element insertion/removal. Native setter wrappers independently count value/checked/disabled assignments; isolated function counters count tooltip visits and recorder projections. RAF is held by the harness only; one frame initializes canvas geometry. Native frames are driven during recording warmup so MediaRecorder receives real video. Native audio and recorder timers are retained. Synchronous batches hold telemetry constant; their times are UI JavaScript time, not rendering time or FPS.

`evidence/baseline.json` preserves accepted-main results. `baseline-initial.json` preserves an initial attempt that timed out waiting for recorder start before canvas initialization. `baseline-capture-isolation.json` preserves an attempt with no recording chunks because canvas drawing was held throughout capture. Those harness failures are not acceptance results. The corrected harness measures actual recording with a short frame-driving warmup.

Reproduce after building the accepted revision:

```sh
NODE_PATH=/opt/codex/runtimes/cua/lib/node_modules node docs/audits/remediations/115m-i-h-aud004/diagnostics/measure.cjs result.json
```

Use a separate checkout at the starting SHA for baseline, copying only the diagnostic. `CHROMIUM_PATH` selects native Chromium; Playwright is supplied by the environment, not added as a dependency. `MEASUREMENT_VERSION` can select an already-built portable revision. Identical viewport, iteration count and scenario setup are used for fixed measurements.

Implementation, ownership, validation and acceptance evidence will be completed in subsequent focused commits. Build 115N remains withheld throughout.
