# 115M.I.N.2 — Recorder capacity calibration

**N.2 CONDITIONAL — Partial evidence supports bounded defaults, but named calibration gaps remain.**

The evidence supports only **provisional desktop interactive policy candidates**,
not broader product/device safety. **Build 115N remains WITHHELD.** A successful
calibration PR is not release approval; do not merge or proceed to N.3 automatically.

Accepted source: `889b0b4267c473db6bfa7b1afda6cfeed77565ee`, fetched remote main,
merged N.1 PR #57. Branch `codex/115m-i-n2-aud006-calibration`.
Development version **v0.1.15m.i.m**, preset schema **10**, both unchanged.

Classification: authorized experimental diagnostics, analysis and contracts only.
No production behavior, CONFIG, RecorderEngine, UI, preset, version, canonical
artifact, roadmap or historical evidence changes. All originally tracked files
are verified against the baseline hash manifest. The risk is experimental load,
instrumentation bias and overgeneralizing this single virtual Chromium host.

## Result

- Reproduced N.1: 23 baseline model cases and all 11 native reference recordings;
  60-second payload +0.25%; short Mic −8.90% localized mostly to its first event,
  with exact cause unresolved and both ledgers retained.
- Six bounded Stage B workloads completed/replayed. A seventh high-resolution VP8
  trial stopped at the predeclared process-RSS diagnostic guard around 24s. Native
  Stop settled; no OOM. It is an aborted calibration cell, not a passed duration trial.
- Fresh-browser five-minute desktop-standard VP9+Opus trial completed/replayed:
  **97,086,560 bytes / 300.058s / 294 nonempty events**. Fifteen minutes omitted by
  predeclared continuation criteria; no unsafe trial launched to fill a cell.
- Small and 97 MB prior exports remained available during replacement. Measured
  old+new logical overlap reached **98,051,486 bytes** before successful replacement.
  URL revocation follows commit; subsequent failed acquisition preserves the latest
  export. No native mid-capture failure with the large prior export was induced.
- 22 prospective pure policy models plus workload ledger replay and byte/chunk/
  duration/headroom sensitivity. These are **not production governor tests**.
- Candidate Balanced review values: **S=130 MB, H=270 MB, R=10 MB, C=1,200,
  optional T=5 minutes**, decimal MB. Derived from observed workload relationships
  and explicit margin choices; never selected simply as convenient powers of two.
  Not approved defaults or physical-memory guarantees; near-H survival untested.
- Expert 60-FPS request rendered only about 26/s and encoded about 14 video packets/s.
  Generic MP4 actually contained **VP9+Opus**; AVC/AAC was unavailable here.

Named gaps: physical low-memory desktop/browser coverage, DPR>1, real Mic/display
permissions/devices, long MP4/VP8/high/expert capture, fifteen-minute runs,
background/suspension, native capacity-triggered Stop, physical memory attribution,
and external-player/audio-fidelity acceptance. See the [coverage plan](workload-matrix.md).

## Review package

| Document / data | Purpose |
| --- | --- |
| [Methodology](methodology.md) | Instrumentation effects, exact semantics, guards, omissions and diagnosed harness limitations. |
| [Workload matrix](workload-matrix.md) | Executed/selected scope and deliberate omissions; target-browser/device work. |
| [CSV](measurements.csv) / [JSON](measurements.json) | 21 normalized native ledgers: 18 completed primary trials, one guarded primary trial, two D replacements. Application outcome and diagnostic success remain distinct. |
| [Analysis](analysis.md) | N.1 comparison, per-workload rates, distributions, render/encoded-rate distinction, overlap and sensitivity. |
| [Candidates](candidate-defaults.md) | S/H/C/R/T derivations, ranges, units, assumptions and unresolved risks. |
| [Settings contract](settings-contract.md) | Balanced/Custom/Unrestricted; Settings/Record ownership; separate future local persistence, no schema change. |
| [Failure contract](failure-contract.md) | Whole-event admission, prior export, cancellation, native uncertainty, transport unlock and terminal ownership. |
| [Acceptance matrix](acceptance-matrix.md) | Implementation criteria, future negative controls and outstanding human policy decisions. |
| [Validation](validation.json) | Exact commands/results, integrity verification, evidence references and limitations. |

Raw evidence is appended in this directory only. Native captures remain under
ignored `work/` or were deleted after hashing; no captured media is committed.
Historical N.1 and protected F/G/H/I evidence remain byte-identical.

## Exact reproduction

Run sequentially on a provisioned Linux environment with Node 24, Python 3,
Playwright, Chromium and ffprobe. Playwright/Chromium/ffprobe are external diagnostic
tooling, not project dependencies. This host used `/usr/bin/chromium`; use
`AUD006_PLAYWRIGHT_MODULE` and `AUD006_CHROMIUM_PATH` to select alternatives.
Baseline/native browser variability means exact byte counts are not deterministic.
Use fresh paths; native/model tools refuse to overwrite report files.

```sh
npm ci
npm run build
mkdir -p work/n2-replay/raw work/n2-replay/downloads
node docs/audits/remediations/115m-i-n-aud006/evidence/modeled.mjs work/n2-replay/raw/n1-modeled-reproduction.json
AUD006_CHROMIUM_PATH=/usr/bin/chromium node docs/audits/remediations/115m-i-n-aud006/evidence/native.cjs work/n2-replay/raw/n1-native-reproduction.json work/n2-replay/downloads
node docs/audits/remediations/115m-i-n2-aud006-calibration/evidence/native-initial.cjs work/n2-replay/raw/native-stage-b-initial.json work/n2-replay/media-b
```

Inspect the Stage B report’s `guard`, `aborted`, `passed` and host samples. A guard
abort is not a pass even if the process exits 0. Stop/review the experiment if a
guard fires. Our follow-up used a fresh browser after reviewing the lower-resource
standard trials; it kept all guards unchanged. Do not blindly continue to longer
runs on an unreviewed unsafe environment. The C tool enforces the fifteen-minute
prerequisite itself.

```sh
N2_SCENARIO_IDS=C-standard-5min,C-baseline-15min node docs/audits/remediations/115m-i-n2-aud006-calibration/evidence/native.cjs work/n2-replay/raw/native-stage-c.json work/n2-replay/media-c
node docs/audits/remediations/115m-i-n2-aud006-calibration/evidence/policy-model.mjs work/n2-replay/raw/policy-model.json
python docs/audits/remediations/115m-i-n2-aud006-calibration/evidence/analyze.py work/n2-replay/raw work/n2-replay/analysis
python docs/audits/remediations/115m-i-n2-aud006-calibration/evidence/validate.py work/n2-replay/regressions
```

The analysis command consumes saved ledgers and creates CSV/JSON, statistics,
comparison, candidates, policy replay and sensitivity in a fresh output directory.
Without arguments it reproduces those files from the committed evidence. Model
inputs are integer byte counts; no media/large synthetic Blob is allocated.
`validate.py` runs locked install, focused tests, npm test, build, distribution,
unmodified artifact control, native RC-06/05/19/03/04 and whitespace sequentially.
Full logs remain in work/; committed checks.json contains exact commands, results,
summary excerpts and full-log hashes. Final integrity and reproducibility checks
are in validation.json. Distribution building produces only ignored outputs;
canonical shipped artifacts are never rewritten.
