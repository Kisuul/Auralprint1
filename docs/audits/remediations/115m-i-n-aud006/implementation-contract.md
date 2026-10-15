# Future implementation contract and hostile acceptance plan

Proposal only. No implementation, CONFIG defaults, UI copy or policy mutations
were installed in this phase. Existing characterization assertions describe
current behavior, including weaknesses; they are not passing policy regressions.

| Required decision | Proposed dependable outcome |
| --- | --- |
| 1. Budget reached | Soft S reached and successful native completion is successful automatic Stop, with durable reason `capacity-stop`; native/finalization/admission failures remain explicit errors. |
| 2. Over-budget final data | Over soft S but inside aggregate H/count C: retain and finalize. Beyond H/C: never append; explicitly fail/abort current capture, preserving P. Already browser-delivered data may transiently exist outside application retention. |
| 3. Partial export | No generic salvage claim. Whole successfully finalized output is usable only after format validation. Do not label arbitrarily truncated chunks a playable partial recording. Separate future recovery design required. |
| 4. Previous export | Remains downloadable throughout replacement, capacity/error/cancel paths; candidate commit precedes revocation. Only explicit terminal Dispose clears it under existing contract. |
| 5. Status/reason | Canonical runtime state owns counters/reason; UI distinguishes stopping at policy, finalizing, completed early, rejected admission, capture lost, native shutdown unconfirmed and preserved previous export. Error cannot be overwritten by generic success. |
| 6. Restart | Allowed after successful budget Stop; reject if P leaves inadequate approved headroom. After unconfirmed native failure, recorder remains disabled until an explicitly defined recovery/reinitialization boundary; no concurrent second backend assumed safe. |
| 7. Stop throws | Fence session, attempt recorder-owned cleanup, discard failed new chunks, preserve P, report failed/native-unconfirmed; retain a bounded shutdown handle/tombstone if required for terminal cleanup. Do not imply dropping reference stopped native work. |
| 8. Stop never settles | Remain truthfully finalizing with P available; offer explicit Cancel Current Capture that invalidates callbacks, discards new chunks, preserves P, attempts owned cleanup and disables recorder if shutdown remains unconfirmed. Unlock primary transport only through that settled application abort. No arbitrary automatic watchdog. If autonomous deadline recovery is required, approve exact clock/state/escalation separately. |
| 9. Budget scope | Aggregate H includes P plus delivered pending payload; S refers only to new delivered payload. Candidate Blob/URL sharing/copies and browser backlog remain outside a physical-memory guarantee. Existing P above H must block new admission, never be silently deleted. |
| 10. Counter reset | Initialize exactly once for a fresh admitted session; keep final diagnostic totals/reason separately from pending storage. Reset across success/error/abort/dispose; callbacks must check captured token before accounting. |
| 11. Track ownership | Stop only recorder render tracks; release captured tap via AudioEngine; never stop merged/upstream audio on cleanup error. InputSourceManager owns live source shutdown. |
| 12. Late callbacks | Token-fenced data/error/stop/timers; terminal transitions invalidate before native operations that could reenter. Old callback cannot append, revoke, change status, clear new timer or abort new session. |
| 13. Primary behavior | Policy itself touches recorder only. Ordinary finalizing retains existing temporary transport lock/EOF deferral; terminal success/error/cancel unlocks and consumes valid deferred EOF once. No playback Stop, source teardown, seek interference, waveform admission changes or visual reset. |
| 14. Truthful limit | “Received encoded payload” and supported workload; never “RAM limit”, “safe available memory”, or guaranteed browser survival. Explicitly disclose final tail/encoder/suspension uncertainty. |

The preserve-export Cancel/Abort is a new recorder operation, distinct from public
Stop and terminal Dispose. It requires explicit approval and canonical interface
review. It cannot call Dispose and restore a revoked URL afterward. Missing-stop
recovery is a design requirement, not a claim that browsers normally fail to stop.
If a native backend refuses shutdown, application cleanup cannot guarantee process
recovery; primary behavior must not be held hostage by recorder UI state.

## Permanent, mutation-sensitive acceptance plan

Install future tests only with the approved policy. Use small physical Blobs,
controlled events, injected monotonic time, retained callbacks and independent
ownership counters. Expected assertions derive from approved S/H/C, not copied
implementation internals. Include native positive controls and payload replay.

| Mutation / adverse schedule | Required observable assertion |
| --- | --- |
| Remove increment, double increment, count size twice during finalization | Independent event ledger equals received/admitted/rejected totals; nonempty count once; zero chunks do not count. |
| Change `>= S` to `> S`; change `<= H` admission to `< H` or `> H` | S-1/S/S+1 trigger edges; P+D+size H-1/H/H+1; exactly C versus C+1. |
| Number overflow/nonfinite/string/negative/fractional event size | Deterministic failed accounting before append; no wrap, Infinity, NaN, unsafe integer or UI success; use reported sizes, no huge allocation. |
| Append before admission; check only on next tick | Retention spy observes rejected event never stored; immediate event boundary decision, even with timers suspended. |
| Reentrant data->Stop->data->Stop | Native stop called once; final data accounted once; terminal status survives outer return. |
| Missing final handler / drop tail at soft threshold | Valid final event included inside H/C and exported payload ledger matches; zero-size tail permitted; oversized tail explicit failure preserves P. |
| Remove token check or reuse token | Retained old data/stop/error/timer during new session cannot alter new counters, tracks, URL, phase or interval. |
| Revoke P on Start/budget/error/cancel | Fetch exact old bytes through failure; verify zero premature revocations; replacement commit before exactly one revoke. |
| Stop merged/shared tracks; fallback on tap exception | Upstream audio/video remain live, stop count zero from recorder; only render and dedicated File tap end through owners; File playback/analysis survive. |
| Leave pending chunks on terminal error/abort/dispose | Inspect retention in temporary instrumented copy; pending refs zero on all terminal paths; success retains only latest completed slot. |
| Publish success after synchronous error/complete | Start/Stop return and canonical state agree with settled lifecycle; no stranded finalizing; failures remain visible on refresh/reset/support reads. |
| Start interval twice / stale tick clears new interval | At most one owned timer, exact creation/clear ledger, old tick powerless, repeated UI initialization has no duplicate action listeners. |
| Dispose reactivates callbacks | Disabled terminal status, no new URL/timer/export/stream; explicit Init has distinct token; Dispose still clears exports by existing contract. |
| Stop throws while active/inactive; handler/owner cleanup throws | Error names failure/observed shutdown, P survives future abort, remaining independent cleanup attempted; no upstream fallback; recorder not silently restartable with unconfirmed backend. |
| Stop callback omitted | Pending until explicit cancel; previous download works; cancel releases app retention/unlocks primary transport, late native events powerless; no undocumented timeout. |
| Duration from RAF/tick count / hidden-tab event | Advance monotonic clock without RAF/timer ticks; next permitted check follows elapsed policy; no catch-up loop or misleading deadline guarantee. |
| New session fails at acquisition/constructor/start/Blob/URL/commit | P unchanged/fetchable; candidate URL revoked on failure; accepted RC-06 behavior remains. |
| EOF in active/finalizing/terminal policy paths | Same File/Queue/request/media context, exactly-once valid next/repeat transition; no stale EOF resurrection or identity drift. |
| Numeric policy stored in preset/version/schema drift | CONFIG/default ownership; preset schema 10 fixtures byte-identical; version unchanged unless separately authorized; portable/hosted same runtime and no new runtime dependency. |

Acceptance workload matrix: supported physical desktop/mobile low-memory tiers,
Firefox/Safari/Chromium variants, each supported MIME, selected dimensions/DPR/FPS,
File audio, synthetic then real Mic/Stream permissions/ended events; repeated cycles,
prior export + near-threshold replacement; delayed/background/suspended native
capture within safe test budgets. Save durations/events/bytes/actual codec and
memory metric definitions. Download and replay with external players, audio channel
fidelity and filesystem behavior. Never force OOM as a regression test.

**Negative controls:** the above policy mutations are a plan, not executed tests.
No “mutations killed” claim is made. The current modeled probe deliberately invokes
adverse schedules and asserts observed baseline weaknesses; historical RC-19
mutation evidence remains historical and is not relabeled as this policy's results.
