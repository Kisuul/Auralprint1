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
