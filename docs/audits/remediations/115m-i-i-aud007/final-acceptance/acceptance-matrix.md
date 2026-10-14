# Acceptance evidence matrix

Initial independent deterministic suite: 11 cases, 8 pass and 3 fail, exposing D-01/D-02. New assertions cover synchronous File/Clear reentrancy, offer/preference reentrancy, cross-stage occupancy, obsolete rejection, synchronous reduction replacement, per-request manual grant, post-read revocation, stalled-decoder preference/manual storms and 432 independent integer-workload combinations. Final corrected results, mutation controls and native/protected checks will be recorded after execution.

## Human-reported cross-browser functional acceptance, supplied by the project owner

The owner reports live successful testing in Chrome, Opera, Microsoft Edge and Firefox, using direct local-file execution and locally hosted execution via Python HTTP server. This is human-reported evidence, not Codex automation. It is not an independently known browser-by-case-by-mode matrix.

| Input | Profile | Reported result |
| --- | --- | --- |
| 5-minute mono | Approx. 4m | Waveform generated |
| 6-minute stereo | Approx. 4m | Waveform withheld |
| 6-minute stereo | Approx. 8m | Waveform generated |
| 9-minute track | Approx. 15m | Waveform generated |
| 1:12:24 stereo | 4 / 8 / 15m | Waveform withheld |
| Applicable withheld cases | Applicable tested profiles | Seek remains functional |

Exact codec, bitrate, sample rate, source-file hash, refusal reason, browser versions and network-disabled operation were not supplied; none is inferred. Prior ERR_BLOCKED_BY_ADMINISTRATOR is an automation restriction, not application failure. Direct-file functional execution now has meaningful owner coverage. Demonstrably network-disabled offline execution remains a narrower separate gap for applicable Build 115N portability acceptance, not a sole AUD-007 blocker.

## Final observed automated evidence

| Surface | Observed outcome / limit |
| --- | --- |
| Required ordered install/test/build/distribution/whitespace | Pass; 948 tests / 947 pass / 0 fail / 1 established opt-in AP_MILLION_STRESS skip |
| New independent permanent tests | 11/11 after correction; initial 8 pass / 3 failures preserved, exposing two defects |
| Combined focused source/Queue/recorder/preset/waveform | 283/283 |
| Independent numeric oracle | 432 integer workload combinations; no represented PCM allocation |
| Independent hostile mutations | 13/13 originals pass and mutants fail intended assertions; no harness crash counted |
| Accepted controls | I.2A 7/7; I.2B 7/7; I.2C 6/6; all historical scripts/assertions preserved |
| Independent final native UI | 6/6; one separately labeled old-artifact defect control |
| Accepted native I.2C / I.2A / I.2B | 17/17 / 12/12 / 8/8 |
| Protected F / G integrated / G focus / G targets / G numeric / H | 21/21 / 13/13 / 38/38 / 31/31 / 27/27 / 9/9 |
| Probe/read/native stage concurrency | One combined outstanding resource stage under independent A→B→C prefix/read/decode rejection schedules; synchronous reduction retains its slot |
| Native stable presentation / initialization | 2,000 unchanged draws produce zero time/status/announcement mutations at 800px and 390px; 30 reinitializations retain the same observed control/canvas listener counts |
| Native identity/manual | Same File object in two Queue entries requires separate manual grants; focus-triggered source replacement reads/decodes only current C |
| Resource calibration | 21 profile/input cases, four exact/above budget boundaries, 30 invalid/expert source inputs, 44 truncated headers; largest synthetic allocation 65,536 bytes |
| Historical scope | All 82 accepted AUD-007 files byte-identical; protected source owners, schema, CONFIG and canonical releases unchanged |

The accepted native matrix was re-executed on the l artifact, not inferred from k results. Real stereo WAV/MP3, verified six-channel PCM WAV, six-channel Opus, Ask/manual, automatic-if-permitted, Skip/manual, encoded/PCM refusal, metadata/decode replacement, source changes, genuine optional native rejection, recorder continuity, portable HTTP, hosted root and nested are covered. MP3 fixture is 128,983 bytes; returned native stereo PCM is 352,800 frames at 44.1kHz. Workload metadata substitutions and native-delivery holds are labeled in evidence and do not constitute real long-file decoding or outstanding native-thread measurements.

All ten final native groups agree on portable SHA-256 `84f9ebff3c1692cb24a516292d41bee0bedfb3ac1fee3d812418d752271f50c8` (448,610 bytes). Hosted index SHA-256 is `826f52e798b0dcee2fe4e31c53c648109c576689e333d25bffcf2ad634aff95d` (447,441 bytes). Evidence collection asserts every group hash matches the actual final artifact. Exact final-head Ubuntu/Windows CI is recorded in the draft PR after final push; an intermediate successful run is not substituted.

Automated browser evidence is Linux Chromium 151.0.7922.173. Other engines were not automated here; the owner's independent Chrome/Opera/Edge/Firefox results remain attributed as supplied. Exact browser versions, source/build hashes and physical device details were not provided for that human evidence. Synthetic touch/keyboard/focus tests are not screen-reader or physical-touch certification. Managed file:// navigation remains administrator-blocked, while owner direct-file functional acceptance supplies meaningful coverage. Network-disabled execution remains a distinct unknown; it alone does not prevent AUD-007 closure under this assignment.
