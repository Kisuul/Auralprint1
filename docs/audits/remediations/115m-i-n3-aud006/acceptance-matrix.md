# Acceptance and independent-review disposition

**N.3 PASS — AUD-006 corrective implementation ready for independent hostile review.**

This recommends review, not AUD-006 closure, merge, release or universal device
certification. Build 115N remains **WITHHELD**. Production implementation is
`67f1435` plus the final documentation/evidence handoff; later handoff changes do
not change runtime behavior. The PR records the full final head and exact-head CI.

| Requirement | Permanent / native evidence | Disposition |
| --- | --- | --- |
| Accepted baseline | Fetched main 3021739; GitHub PR #58 merged; required 3e6a01b parent; initial version m/schema 10/clean checkout and 1,004 N.2 hashes | Verified before branching |
| Factory, Custom Off, Unrestricted | `recording-policy.test.js`: exact defaults, safe integers/relationships, P reserve, frozen snapshots, null optional controls, no Unrestricted fallback | Pass |
| Independent storage / reset | Module and UI tests, native valid round trip/corrupt version/denied save; actual preset payload unchanged | Pass; truthful session-only fallback |
| S/H/C boundaries | Governor tests: −1/exact/+1, prior P, oversized first/final, final tail over S, C final rejection, no transient rejected retention | Pass |
| Technical accounting | Invalid sizes/counters, count and byte overflow; Unrestricted beyond factory duration/count/payload in controlled reported-size events | Pass; representation errors explicit, no large allocation |
| Reentrant lifecycle | Synchronous Start data/terminal/error, Stop terminal/error, repeated Stop, duplicate/stale callbacks and timers, earlier reason / byte-time tie | Pass |
| Cancel / unresolved shutdown | Active/finalizing Cancel, stop throw/still-active, owner/render/handler failures, Init powerless, bounded tombstone, destructive Dispose distinct | Pass; unresolved recovery is page reload |
| Replacement | Existing RC-06 failures plus new cleanup/projection failures; candidate-only revocation, previous fetch and valid replacement ordering | Pass |
| Source / transport / EOF | Full regressions; RC-03 six, RC-04 ten, RC-05 eight, RC-19 three native cases; new native cancellation at deferred File EOF | Pass; upstream owners preserved |
| Settings / presentation | Three focused UI tests, existing UI projection tests, actual browser profiles/drafts/next-session freeze/automatic reason/progress | Pass |
| Focus / hide / narrow | Native finalizing prior Download, keyboard Cancel after hide/reveal, focus return, 390 px layout; idle-write/listener checks | Pass within harness; physical/AT acceptance unverified |
| Native exports | Actual downloaded WebM VP9+Opus and available generic MP4 VP9+Opus; ffprobe, packet timestamps, Chromium replay, ffmpeg decode and synthetic stereo tone checks | Pass on provisioned Linux Chromium |
| Five-minute factory | Guarded 960×640/DPR 1/default-scene synthetic Stream trials; final `native-final.json` matches final runtime artifact | Pass; bounded host observation only |
| Short native capacity Stop | Explicit isolated getPolicy injection; native events/Stop/export, no fabricated media data or large allocation | Pass |
| Failed native replacement | Actual hard chunk-admission failure, prior URL still fetchable/playback live | Pass |
| Full commands / distribution | Locked install, full npm test, build, portable/hosted verification, whitespace and protected-file checks | Pass; exact counts/hashes in validation.json |
| Linux / Windows | Exact-head CI checks on PR #59; implementation-head evidence archived, final handoff checks linked in PR | Pass required before final handoff |

## Negative controls and investigation corrections

Eleven independent source mutations cover S/H/C equality, omission of P, transient
rejected-event retention, ignored duration, stale-data fence, ignored cleanup,
Cancel calling Dispose, hidden Unrestricted duration and omitted Start reserve.
All are detected by actual assertion failures; syntax/import/harness failures do
not count. `mutations-initial.json` preserves the initially surviving stale-data
mutation: state-only observation missed private pending pollution. A direct pending
retention assertion closed that test gap; final mutations.json records detection.
No old characterization tests are relabelled as governor coverage.

The first native diagnostic clicked a disabled Download before the next UI
projection. The harness now uses Playwright's enabled-control click; actual
unmodified-artifact controls pass. No application failure was claimed from that
harness timeout. The original acquisition path could mask a failed early owner
release behind later empty cleanup; a permanent regression demonstrated the gap
and the cleanup latch corrects it. Public format calls now preserve terminal
messages and cannot edit active session format.

## Named remaining release gaps and risks

- Physical low-memory/mobile hardware, Firefox/Safari and other browser/device
  variants; real Mic/display/system-audio permission dialogs; DPR>1 and heavy/high
  resolution scenes. The final factory trial is a lightweight desktop host case,
  not a supported-device envelope or five-minute safety certification.
- Background/throttled/suspended tabs can delay automatic Stop. No exact native
  five-minute guarantee, hard process-memory cap or unsaved crash recovery exists.
- External players, perceptual audio fidelity, real hardware/channel layouts and
  physical touch/assistive-technology behavior remain separate human acceptance.
  Synthetic decoded channel tones establish limited signal correctness only.
- Near-H native memory survival and arbitrary delayed final chunks are not proven.
  R is intended reserve, never a promise of successful final admission. Whole-event
  failure preserves P but loses the new unsaved capture. No partial salvage.
- Native refusal tests are controlled models, not forced browser OOM or observed
  device failure. Tombstone retention is bounded ownership, not proof of native
  release; page reload loses page-owned URLs, so download P first.
- N.2's high-resolution VP8 trial reached its predeclared diagnostic RSS guard with
  small encoded output. Encoded size does not bound renderer/encoder/GPU/process
  memory. Overlapping diagnostic processes and summed RSS are not causal memory
  measurements. Output-size variation is not encoder optimization evidence.

Broader memory, encoder and resource optimization remain Build 117. Build 116
Camera, disk streaming, background persistence, multipart export, new waveforms,
Scene redesign and schema 11 are outside this pass. Demonstrated recording
correctness failures within approved 115 workloads must still be investigated;
Build 117 is not a blanket exemption.
