# Implementation acceptance and review matrix

No production resource governor exists in N.2. “Model” below means a prospective
specification example; it is not production acceptance or a policy mutation kill.
N.3 is not authorized by this package. Build 115N remains WITHHELD.

| Area / trigger | Future required evidence | N.2 evidence / status |
| --- | --- | --- |
| Baseline integrity | Approved source SHA, schema/version, immutable historical/protected files | baseline manifest; final protected-path verification in validation.json. |
| Native bounded capture | Exact dimensions/DPR/scene, codec/container inspection, ledger=export, replay/download | Stages A–C raw results and measurements. Single Linux headless host only. |
| Encoded admission | P+D+E at H−1/H/H+1, count C−1/C/C+1; rejected object never stored | Pure model boundary cases; production test required. |
| Soft/duration | S−1/S/S+1, monotonic time without RAF, idempotent Stop, deterministic tie reason | Pure model; future injected clock/timer and public API regressions. |
| Final reserve | Admitted tail over S succeeds; rejected final event fails, preserves P; delayed data | Observed final events + invented sensitivity schedules; native automatic Stop unimplemented. |
| Safe arithmetic | NaN/Infinity/string/negative/fraction/unsafe counters, sums and unit conversion, count overflow | Model invalid/overflow cases; future production pre-append spies. |
| Reentrancy | Synchronous Start data/error/stop, synchronous Stop data/error/terminal, nested Stop | N.1 reproduction preserves current defects; N.2 synchronous-terminal model; future permanent mutation-sensitive regressions. |
| Stop throws/no callback | Truthful failed/unconfirmed status, preserved P; finalizing until explicit cancel | N.1 baseline models + N.2 proposal; no actual native refusal observed. |
| Cancel Current Capture | Token fence before cleanup; discard new only; app transport unlock; no Dispose call | Specification/model only; future API/UI and focus tests required. |
| Error/empty output | Errors before/after Stop cannot become success; no arbitrary partial file | Models and existing recorder/export regressions; actual native error breadth unverified. |
| Prior-export overlap | Small/larger A fetchable during B and failure; only old URL revoked after new commit | Stage D native ledger/fetch plus existing RC-06. Native failure injection is acquisition refusal. |
| Start after capacity | Fresh counters/token; sufficient reserve with P; refuse if P over H | Prospective model; future native automatic Stop/restart required. |
| Ownership/disposal | Owned render tracks only, AudioEngine tap release, upstream audio survives, terminal Dispose clears exports | Existing RC-19/source/export suites and native probes; future governor integration required. |
| Late callbacks | Old data/error/stop/timer cannot affect later counters/status/URL/stream/interval | Model fences + existing regressions; future focused policy mutation controls. |
| EOF/primary transport | Own deferred File/media/request context consumed once after settled success/error/abort | Existing native RC-05/regression suites; new abort path unimplemented. |
| Settings | Single owner, validated next-session snapshot, independent local settings persistence | Proposed settings contract only; no UI/storage/schema changes. |
| Unrestricted | S/H/C/T truly absent; no fallback numeric cap; telemetry/technical checks and lifecycle protections retained | Pure model + contract review; future production test using reported sizes, no huge allocations. |
| UI/accessibility | Exact units/limits/reasons/P, previous Download, cancel/finalizing/recovery, keyboard/focus/live regions | Contract only; physical/assistive acceptance outstanding. |
| Device/browser envelope | Physical desktop/mobile, actual permissions, thermal/background/suspension, external decode/audio | Unverified; workload-matrix coverage plan. |

## Future negative controls

During implementation, independently mutate: append-before-admission; unchecked
addition; `>= S` → `> S`; `<= H/C` → `<`; P omitted; reserve forgotten; count reset
on repeated Start; no token check; Stop latch set after native call; outer status
overwriting synchronous failure; dropped admitted final data; success after cleanup
failure; early revoke of P; Cancel calling Dispose; stale timer clearing new timer;
upstream track stopping; silent default-valued cap in Unrestricted; Scene preset
pollution; duration based on RAF. Tests must detect observable wrong outcomes,
not assert internal source text or restate implementation. Small physical Blobs and
reported-size fixtures suffice. Add native positive controls and real container
validation. None of these future governor mutations is claimed executed in N.2.

## Human decisions before implementation

1. Approve bounded interactive recording expectation and specific tested target
   devices/browser workloads; decide if provisional desktop settings may proceed
   before broader certification. No universal recording maximum is inferred.
2. Approve actual CONFIG S/H/C/R and optional T values or revised ranges, warning
   policy, tail overshoot, whole-event rejection and prior-export preservation.
3. Approve preserve-export Cancel/Abort API, recording-disabled/unconfirmed state,
   transport unlock and explicit recovery/tombstone ownership. No automatic deadline
   without separate clock/deadline/escalation review.
4. Approve Custom per-control disable semantics, derived/expert reserve and
   independent local application-settings persistence/versioning/reset scope.
5. Approve truthful Unrestricted warning and absence of numeric policy ceilings;
   explicitly accept browser/process/current-unsaved-capture risks. A hard total
   process-memory cap or archival crash recovery would require different architecture.
6. Commission remaining physical/browser/media acceptance; a successful calibration
   PR is not release approval. Do not merge, advance version, or proceed to N.3.
