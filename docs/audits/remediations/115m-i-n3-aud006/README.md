# 115M.I.N.3 — AUD-006 recorder governor

Production implementation authorized by the N.3 assignment. Baseline main
`302173917ed9b337a9d1df9a3f93d083248fe51f` is the fetched merge of PR #58,
whose second parent is required calibration head
`3e6a01bc5453307d0b4d64db844d9dc0ce0518cf`. GitHub reports merged at
2026-10-14 23:18:28 PDT (2026-10-15T06:18:28Z). Before edits, clean checkout,
root `v0.1.15m.i.m`, schema 10 and all 1,004 N.2 baseline hashes were verified.

Branch: `codex/115m-i-n3-aud006-recorder-governor`. Target development revision
`v0.1.15m.i.n`; preset schema 10 unchanged. Build 115N remains **WITHHELD**.

N.3A installs CONFIG policy ownership, strict pure validation/session resolution
and independent versioned local settings. Null means Off, never zero. Custom
reserve is min(factory reserve, floor(H/10)), at least one byte; H must leave
positive payload after reserve. There is no expert override. H Off makes R inactive.
Policy settings apply at next Start; snapshots are frozen. Five policy/storage
regressions pass at this milestone. Implementation and acceptance continue.

N.3B adds checked whole-event admission, frozen Start headroom, duration and
capacity Stop, durable reasons, separate live/terminal telemetry and callback
fences. The foundation for preserve-export abort and commit ordering is included
because admission failure must already settle safely. Existing RC-06/RC-19 tests
and 35 new governor scenarios pass. Test instances are isolated through the new
factory; production retains its singleton. A legacy source-test native double now
implements actual stop/inactivity instead of leaving an unresolved fake backend.


Final review evidence: **1,031 tests / 1,030 pass / 0 fail / 1 existing opt-in skip**;
all 11 behavioral negative controls detected by assertions. Locked install, build,
portable/hosted verification, whitespace and **865 protected historical/fixture/
branding files** pass. Source, transport, EOF, cancellation and retained-export
native regressions pass. Final runtime native evidence includes actual WebM/MP4
downloads, replay, decoded synthetic stereo signals, matching event/download byte
ledgers and packet timestamps. Generic MP4 is VP9+Opus on this Chromium host.

Final factory trial: 68,975,914 bytes, 300,011 ms observed application elapsed, 299.986000s packet span, automatic duration-stop, no diagnostic guard triggered. This is not a universal safety or duration guarantee.

Start independent review at [architecture](architecture.md), [policy contract](policy-contract.md),
[failure/recovery](failure-recovery.md), [settings/storage](settings-storage.md),
[acceptance matrix](acceptance-matrix.md), [validation](validation.json) and
[evidence/reproduction](evidence/README.md). Native memory, physical/browser/device,
real permission and external-player/perceptual acceptance gaps remain named in
the matrix. N.2's high-resolution VP8 resource guard is preserved; broader
optimization remains Build 117.

Draft [PR #59](https://github.com/cosmicdance-4-2-0/Auralprint1/pull/59) owns the
full final head and post-push exact-head Ubuntu/Windows checks. The archived
implementation-head CI passed both platforms. The final handoff commit adds
review evidence/documentation and a Cancel-at-EOF regression; runtime artifact
hashes remain those in native-final.json. No automatic merge.

**N.3 PASS — AUD-006 corrective implementation ready for independent hostile review.**
AUD-006 is not closed by this recommendation. **Build 115N remains WITHHELD.**
