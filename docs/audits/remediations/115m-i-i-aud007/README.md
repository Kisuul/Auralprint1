# 115M.I.I / I.1 — AUD-007 resource policy for human review

**Design/evidence only. AUD-007 is not closed. Implementation is not authorized. Build 115N remains WITHHELD.** Development version remains `v0.1.15m.i.h`; preset schema remains 10. No production source, CONFIG limit, permanent test, source/recorder contract, canonical release or previously accepted audit file is changed.

Binding finding: October 9 audit [`docs/20261009-004238_project-audit.md`](../../../20261009-004238_project-audit.md), AUD-007, Medium / Conditional: whole-file waveform decoding and overlapping stale work. Other historical AUD-007 findings are unrelated. Production source, not historical comments or expected tests, defines the lifecycle here.

## Verified baseline and scope

Accepted main and starting branch SHA: `704bf13d3a3dfb76032343226bad7240191ef6c6`, merge of PR #49. GitHub connector independently verified PR #49 merged and remote `main` exactly this SHA. Local HEAD matched and starting working tree was clean. Read root agents.md before work. Created `codex/115m-i-i-aud007-policy` directly at the accepted commit. A failed CLI fetch left a stale local `origin/main` unchanged; it was not used as authority. GitHub connector is the remote verification/publishing path because the configured shell proxy refused the connection.

Accepted F/G/H.1 behavior is present in this baseline: upstream request/entry/media identity protects File activation; rejected source setup cleans only owned resources; all-channel/final-bucket peaks and drag ownership remain; G numerical/target/editor identity contracts and H presentation caching are present. Current focused tests, full suite and protected native rechecks verify behavior as summarized below. The final investigation head is identified by the draft PR; do not embed a self-referential future commit SHA in this package.

This phase is an AUD-007 investigation/design within Build 115. Principal future risk is optional job admission accidentally changing playback/source/recorder behavior. No preset impact is proposed. It does not begin AUD-006, Build 118 spectral work, BandBank/frequency targeting, Orbs or particles. No newly demonstrated data-corruption/source-lifecycle defect was established; failed harness attempts and environment restrictions are recorded separately in `evidence/attempts.json`.

## Findings and recommendation

- `UI.loadAndPlay` requests waveform only after a successful still-current File activation. With autoplay, it is after the media Play promise; paused activation can precede known duration. Queue entry identity stays in UI; Scrubber receives File and uses its own generation token.
- A stale full read continues but is discarded before native decoding. A stale native decode continues until settlement. Reset/Clear clears presentation, not resources already admitted. `_decodeInFlight` is a current-presentation flag, not a concurrency count.
- Controlled small fixtures measured **2 simultaneous encoded reads** and **3 unresolved decode calls** under A/B/C. B can reach ready while A never settles during observation. Latest-result correctness is protected, resource admission is not. A semantic negative control confirms stale peak commitment becomes visible if the post-decode guard is removed.
- Native Chromium measured a 705,644-byte four-second stereo WAV read and 1,411,200-byte returned Float32 PCM. Input byteLength became zero after native decode admission: detachment does not prove native memory freed. Six-channel 96kHz input returned **six channels at 44.1kHz**, 44,099 frames / 1,058,376 PCM bytes; context `(1,1,44100)` does not limit decoded duration/channels. Native scratch and resident memory were not measured.
- Retained completed peaks are only 2,048 bytes. Full encoded/native/decoded allocations, concurrent stale work, independent playback and retained recordings are the material costs. Modeled one-hour stereo output alone is 1,270,080,000 bytes; no such large buffer was allocated.
- Recommend **one whole read/decode/reduction pipeline**, reserved before full read/probe; **one replaceable newest intent**, no pre-read/FIFO; and separate encoded-byte and decoded-PCM-estimate admission. Native outstanding occupancy survives Reset and display timeout until actual settlement. Current peaks remain one-generation owned; seek/play/record work with fallback presentation.
- Unknown duration should defer on the already activated media then decline; unknown required channel metadata should decline by default. The current playback path lacks a defensible encoded-channel count. Useful strict waveform coverage may need an explicitly approved bounded WAV metadata provider. Broader compressed-codec coverage or channel assumptions require an explicit risk/format decision; no hidden stereo/32-channel guess.

**Required human selections:** encoded and PCM-estimate budgets, metadata credibility/format coverage and any bounded provider, unknown-metadata and display deadlines, reason visibility. Discussion profiles are conservative **16 MiB encoded / 64 MiB estimated PCM** and permissive **64 MiB / 256 MiB**. These are unapproved calibration candidates, not evidence-backed universal safety limits. CONFIG would own approved policy; no numeric limit is implemented. Native overhead, inaccurate metadata and independent playback/recording prevent a guaranteed total-memory cap.

## Package map

| File / directory | Contents |
| --- | --- |
| `resource-policy-proposal.md` | Complete memory inventory/model, representative scenarios, A/B/C/D comparison, admission design, product decision table, strict-metadata coverage tradeoff and deferrals |
| `ownership-and-concurrency.md` | Actual source/Queue/token ownership, readiness, invalidation, 11 deterministic reproductions, release eligibility and cancellation limits |
| `acceptance-plan.md` | Permanent test matrix with observable assertions/negative controls, native coverage, stages and implementation Definition of Done |
| `diagnostics/reproduce.mjs` | Deferred-promise production Scrubber reproduction and in-memory stale-success negative control |
| `diagnostics/native.cjs` | Native waveform/playback/fallback/recovery and portable/root/nested diagnostics on an isolated build |
| `diagnostics/recheck.cjs` | Read-only adapter for accepted F.6/G.4/H.1 diagnostics; H awaits normal source-error UI projection |
| `diagnostics/scope-check.py` | Asserts only new investigation paths differ from accepted main, version/schema unchanged |
| `evidence/concurrency.json`, `native.json` | Stage counters and actual native dimensions/behavior |
| `evidence/baseline-and-environment.json`, `distribution.json` | Baseline/PR verification, inspected source digests, tool/browser versions and isolated artifact hashes |
| `evidence/protected-rechecks.json` | All protected case outcomes with large observations represented by size/digest/keys and raw-result digests |
| `evidence/negative-control.json`, `attempts.json` | Semantic control and transparent failed-harness/environment attempts with resolutions |
| `evidence/*-tests.log`, `packaging.log`, `build.log`, `scope.json`, `validation.json` | Exact successful validation outputs, scope assertion, command/results inventory |

## Reproduce safely

Run from repository root. Playwright/native Chromium are environment tooling, not new project dependencies. Use `CHROMIUM_PATH` if necessary. Baseline build must be disposable; do not overwrite original shipped artifacts. The provisioned Linux esbuild path is selected by the existing environment activation script; the module symlink is only in the scratch copy.

```sh
mkdir -p work/baseline
# A fresh directory is required; archive omits uncommitted investigation files.
git archive 704bf13d3a3dfb76032343226bad7240191ef6c6 | tar -x -C work/baseline
ln -s /workspace/auralprint-environment/dependencies/node_modules work/baseline/node_modules
source /workspace/auralprint-environment/activate.sh
node work/baseline/scripts/build.mjs
python3 work/baseline/scripts/verify_distribution.py
node docs/audits/remediations/115m-i-i-aud007/diagnostics/reproduce.mjs work/concurrency.json
# Expected intentional assertion failure; original source is untouched.
node docs/audits/remediations/115m-i-i-aud007/diagnostics/reproduce.mjs --negative-control
AUD007_BUILD_ROOT="$PWD/work/baseline" node docs/audits/remediations/115m-i-i-aud007/diagnostics/native.cjs work/native.json
mkdir -p work/f-exports
AUD007_BUILD_ROOT="$PWD/work/baseline" node docs/audits/remediations/115m-i-i-aud007/diagnostics/recheck.cjs f --output "$PWD/work/f-native.json" --export-dir "$PWD/work/f-exports"
AUD007_BUILD_ROOT="$PWD/work/baseline" node docs/audits/remediations/115m-i-i-aud007/diagnostics/recheck.cjs g --output "$PWD/work/g-native.json"
AUD007_BUILD_ROOT="$PWD/work/baseline" node docs/audits/remediations/115m-i-i-aud007/diagnostics/recheck.cjs h "$PWD/work/h-native.json"
node --test --test-isolation=none tests/scrubber-waveform.test.js tests/scrubber-drag-ownership.test.js tests/queue-entry-ownership.test.js tests/file-activation-ownership.test.js
(cd work/baseline && node --test --test-concurrency=1)
# After staging/committing only this package:
python3 docs/audits/remediations/115m-i-i-aud007/diagnostics/scope-check.py
```

In this environment Node subprocess creation and localhost server binding require unsandboxed authorized diagnostic commands. The full suite inside the sandbox failed RC-20 on `spawnSync python EPERM`; direct Python and the full unsandboxed suite passed. No network bypass, dependency/lock change or resource-limit mutation was used. Initial native Clear needed Queue revealed; the first H recheck read DOM before its normal RAF projection; the first F recheck lacked its caller-created export directory. Final corrected diagnostic results are acceptance; initial-attempt summaries are retained transparently.

## Validation and practical limits

| Validation | Result |
| --- | --- |
| Controlled production Scrubber scenarios | 11/11; peak-ownership negative control fails intended assertion |
| Native waveform integration | 6/6; advancing playback, waveform ready, failure/fallback seek/recovery, Clear; portable/root/nested all pass |
| Existing focused permanent suites | 54 assertions passed using test-isolation=none; no permanent test edits |
| Full accepted baseline suite | 803 passed, 0 failed, 1 established skip (804 total) |
| Packaging Python checks | 23 passed; isolated build and distribution verifier pass |
| F.6 native source/recorder recheck | 21/21 |
| G.4 integrated native recheck | 13/13 |
| H.1 native recheck | 9/9, including held native recorder finalization + EOF + retained export after native error |
| Scope/whitespace | Only new package paths, no old audit/source/test/config/version/artifact changes; git diff --check passes |

Native evidence is headless Linux Chromium 151.0.7922.173 over localhost. Portable is served as a self-contained HTML; hosted root/nested assets are resolved normally. No unexpected page/console errors, failed assets or unhandled rejections in waveform cases; protected H's intentionally injected recorder error is explicitly expected. Mic uses fake Chromium hardware; Stream refusal is controlled. Physical devices, direct file:// launching, other browser engines, platform codec breadth and universal device memory safety are not established. Counter tests demonstrate outstanding operations, not actual parallel native CPU threads. Full suite/build were run on unchanged baseline production in a scratch tree; scope verification establishes identical production for this documentation branch.

No unsafe buffers/OOM experiment, recorder memory policy, new global resource owner, optional subsystem or implementation was introduced. Preserve F ownership and source-error cleanup, recorder tap/EOF/finalization, drag reset and H presentation semantics in any later change. Tests in `acceptance-plan.md` define implementation completion; policy review alone does not close AUD-007.

**115M.I.I / I.1 COMPLETE — AUD-007 RESOURCE POLICY READY FOR HUMAN REVIEW.**
