# I.2D — independent hostile AUD-007 acceptance review

**Final recommendation: PASS — AUD-007 closure recommended for human review.** Two demonstrated callback-order defects are corrected and all runnable final gates pass. This is a recommendation, not closure approval, merge, shipment or Build 115N acceptance.

Accepted starting remote main: `45cbf558afa8b437e39af6e006b22d0db9d703c0`, merged PR #54. All accepted PR #50–#54 heads are ancestors; eight required modules, development v0.1.15m.i.k and schema 10 are verified before branching. Branch: `codex/115m-i-i-aud007-final-acceptance`. Target unshipped review revision: v0.1.15m.i.l. Build 115N remains WITHHELD. This package does not approve closure, merge or shipment.

This is a Build 115 AUD-007 audit with narrowly authorized bug fixes, test hardening and current-state documentation reconciliation. Independent timing tests do not reuse I.2C's test harness or accept its assertions as proof. Protected source/Queue/recorder/preset/renderer owners and historical evidence must remain unchanged. The principal correction risks are optional request identity, callback ordering and listener lifetime; policy defaults and schema are not being changed.

Initial baseline observations: the new tests pass eight cases and fail three intended assertions, demonstrating two previously uncovered synchronous reentrancy defects. Newer File/Clear intent during Reset notification loses to an older File load, orphaning the newer media's listeners; a profile edit during offer notification is not reconciled after the job settles. The existing coordinator still prevents overlapping expensive operations. These are callback-order reproductions, not claims that ordinary mouse interaction always triggers them. See hostile-findings.md and immutable initial evidence before any correction.


## Audited code and final evidence

The exact accepted baseline is `45cbf558afa8b437e39af6e006b22d0db9d703c0` (PR #54). Runtime correction commit: `d3bc9b7c89721d132391a01a639b6abd37bc2afe`. The final executable-source/version/evidence commit is `ef734fb4b14d025fee814419a769403ca5973634`; subsequent reconciliation changes only documentation. Final review head and its exact-head Ubuntu/Windows CI are reported in [draft PR #55](https://github.com/cosmicdance-4-2-0/Auralprint1/pull/55) after final push. [validation.json](validation.json) pins actual final source digests; the report does not substitute comments or intermediate CI for those bytes.

Required sequential commands pass: npm ci; npm test; npm run build; python scripts/verify_distribution.py; git diff --check. Full suite **948 total / 947 passed / 0 failed / 1 established opt-in stress skip**. Combined focused **283/283**. New independent permanent suite **11/11**, with **432** independent integer-workload combinations. Negative controls **33/33**: thirteen independent plus all twenty accepted controls. Native final artifact groups **182/182**: six independent plus 176 protected, with one separately labeled baseline-defect control. No large PCM/OOM test was used.

Portable l HTML is **448,610 bytes**, SHA-256 `84f9ebff3c1692cb24a516292d41bee0bedfb3ac1fee3d812418d752271f50c8`; hosted index is **447,441 bytes**, SHA-256 `826f52e798b0dcee2fe4e31c53c648109c576689e333d25bffcf2ad634aff95d`. All ten native groups match the portable digest. Cross-platform CI artifacts are recorded from actual CI logs in the final PR; a checkout-line-ending difference must not be silently called a native hash match.

[Ownership verification](ownership-verification.md) reconstructs the real call path and lifetimes. [Hostile findings](hostile-findings.md) gives severity, reproductions, affected functions, fixes and remaining risk. [Acceptance matrix](acceptance-matrix.md) separates automated/native/control/human evidence. [Resource calibration](resource-calibration.md) records exact factory arithmetic and disclosure. Historical evidence and canonical shipped artifacts remain untouched.

## Explicit answers to the final review questions

| # | Question / finding | Verified answer |
| --- | --- | --- |
| 1 | Exact code audited | Accepted main 45cbf558; final executable source ef734fb, correction d3bc9b7; final review head/CI in PR #55; full source digests in validation.json. |
| 2 | Actual invariants | One unsettled preparation/read/decode/reduction pipeline, one latest pending descriptor, current request-only presentation and three current metadata listeners. Internal revision/refresh flags preserve these under reentrancy. |
| 3 | Hidden alternative reads/decodes | None found in production source search: one bounded File.slice adapter, one full File.arrayBuffer extraction site and one decodeAudioData site. Playback remains a separate media-element path. |
| 4 | Rapid replacement concurrency | No concurrent optional pipelines observed in hostile prefix/read/decode rejection, stalled-native storms or synchronous reduction replacement. Combined outstanding stage maximum is one; obsolete B never starts in blocked A→B→C cases. |
| 5 | Stale metadata / wrong File manual | Guarded by UI request/Queue entry/source/media identity and bridge intent/generation. D-01 older-continuation ordering is corrected; stale events cannot revive work. Native same-File entries require separate grants and manual work targets current C after reentrant focus navigation. |
| 6 | Reset/timeout false release | No timeout/race path exists. Reset never clears unsettled coordinator occupancy. A never-settled native promise can indefinitely postpone optional waveforms while playback/seek continue. |
| 7 | Hard-budget enforcement points | Encoded gate before prefix/full reads; header/current metadata evaluation before full read; canDecode policy/identity after full-read settlement before native context/decode. Exact boundaries and one byte/frame above are observed. |
| 8 | Manual hard-limit bypass | No. Manual requests use the same policy and bypass only the automatic workload profile; hard encoded/PCM ceilings remain binding. Mutants that bypass them fail intended tests. |
| 9 | Metadata confidence | Unknown compressed channels remain explicitly estimated at CONFIG fallback two. Verified means supported header geometry, not decoder/memory certification. Actual multichannel output is not truncated and triggers no second decode. |
| 10 | Optional failure and primary capabilities | Optional failures do not call unload/source teardown/recorder stop/finalization. Native playback, fallback seek and active recording/export pass during hard refusal and genuine optional decode rejection. |
| 11 | Preference independence | Only two IDs plus JSON version 1 use a local key; scene schema 10/URL codecs/Scene Reset remain independent and unchanged. |
| 12 | Bounded lifetimes | D-01 fixes orphaned listener ownership. Current intent, one active/one pending descriptor, one current peak array and scalar diagnostics only; no historical PCM/AudioBuffer/File cache. Native/Queue/platform references can outlive application logical release. |
| 13 | Test sensitivity | Existing 144 accepted focused assertions passed on the buggy baseline; three new assertions exposed two missed invariants. Corrected originals pass; thirteen independent and twenty accepted mutations fail intended semantic assertions without counting crashes. |
| 14 | Independently observed paths | Linux Chromium 151.0.7922.173 native WAV/MP3/six-channel PCM/Opus; complete production File/Queue/UI workflow, synthetic policy durations, explicit native-result holds, failure/refusal/seek/recording, portable HTTP and hosted root/nested. New real DOM observer proves D-02 before/after. |
| 15 | Human cross-browser evidence | Owner-reported Chrome/Opera/Edge/Firefox local-file and Python-hosted functional scenarios are recorded verbatim in the matrix. Codec/bitrate/rate/hash, exact build/browser versions and full browser×case×mode coverage are not inferred. |
| 16 | Native memory unknowns | Codec scratch/source-rate PCM/native encoded backing, GC/reclamation timing and whole-process RSS are unmeasured. One admitted operation and bounded encoded/estimated workload are not a whole-browser memory cap. |
| 17 | Factory encoded ceiling | Technically coherent and qualitatively disclosed separately from workload. Six-minute PCM16 stereo WAV fits; nine-minute WAV exceeds encoded ceiling even at 15m/manual. Numeric examples added to current docs; optional read-only UI numeric explanation is nonblocking future UX advice. |
| 18 | Protected F/G/H | Re-executed F 21; G integrated/focus/targets/numeric 13/38/31/27; H 9 on matching l artifact. Source/Queue/URL/recorder/EOF, L/R/C analysis, numeric/editor identity, peaks and stable DOM contracts remain protected. |
| 19 | Documentation/version/artifacts | Current README, ROADMAP, development history/release-delta, root version/banner/assertions and portable/hosted identifiers align at v0.1.15m.i.l / schema 10. Historical checkpoints and all 82 earlier AUD-007 files remain byte-identical. |
| 20 | Definition of Done / disposition | The technical evidence supports AUD-007 closure recommendation after D-01/D-02 correction. Human review and merge still establish accepted closure. Owner direct-file coverage supplements managed automation; the remaining networking-disabled portability gap alone is not an AUD-007 blocker under this assignment. |

## Reproduction and scope

After standard install/build, create the small codec fixtures using the I.2C README's documented ffmpeg commands into work/. Native tools are environment-provisioned, not new dependencies. Run:

```sh
node --test --test-isolation=none tests/waveform-hostile-acceptance.test.js
python docs/audits/remediations/115m-i-i-aud007/final-acceptance/negative-controls.py work/i2d-negative.json
python docs/audits/remediations/115m-i-i-aud007/release-ux/negative-controls.py work/i2c-negative-controls.json
node docs/audits/remediations/115m-i-i-aud007/final-acceptance/calibrate.mjs work/calibration.json
node docs/audits/remediations/115m-i-i-aud007/final-acceptance/native.cjs work/i2d-native.json
node docs/audits/remediations/115m-i-i-aud007/release-ux/native.cjs work/i2c-native.json
# Recheck i2a/i2b/f/g/g1/g2/g3/h through final-acceptance/recheck.cjs;
# F needs an existing work/f-exports directory, h uses a positional output.
python docs/audits/remediations/115m-i-i-aud007/final-acceptance/scope-check.py
python docs/audits/remediations/115m-i-i-aud007/final-acceptance/collect-evidence.py
```

The optional baseline native control uses the original k artifact only if present and verifies its known digest. It is a defect reproduction, not a final acceptance pass. The preserved initial baseline JSON contains exact failing test output with its raw digest. Live handlers, synchronous callbacks and native wrappers are distinguished from user/hardware certification. No unexpected page errors or unhandled rejections occurred; protected H's intentionally injected recorder console error remains explicitly expected.

Only waveform-admission's internal transition ordering changes at runtime; public interfaces, CONFIG policy, application storage contract, preset schema, independent source/recorder/analysis owners and canonical releases remain unchanged. Current documentation is reconciled without rewriting historical audit conclusions. Final-head CI results are published after the final commit, avoiding self-referential future SHA claims.

No merge or release action was taken. AUD-007 closure is **recommended**, not approved. Build 115N remains **WITHHELD** and retains its wider device/media/artistic/accessibility/performance and networking-disabled portability gates.

> Removing or bypassing the waveform governor without equivalent resource admission and concurrency guarantees reintroduces AUD-007.

**115M.I.I / I.2D PASS — AUD-007 CLOSURE RECOMMENDED FOR HUMAN REVIEW.**
