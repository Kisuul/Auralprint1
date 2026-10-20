# Candidate policies and recommendation

Recommend **E, a narrow hybrid**, subject to the explicit decisions in
[release disposition](release-disposition.md). Keep the in-memory architecture
for a documented bounded-use product. Do not claim a browser/process memory cap.
Streaming is a separate Build 117 design unless the product requires reliable
unattended/long captures or a hard survival guarantee; those requirements instead
force outcome C and a separate architecture decision.

| Criterion | A: workload documentation only | B: delivered-byte Stop | C: duration + bytes | D: persistent/segmented output | E: proposed hybrid |
| --- | --- | --- | --- | --- | --- |
| Memory safety | No enforced retention bound; user compliance only | Bounds trigger observation, not delivery/native buffering/final tail | Bounds intended time when callbacks execute; no bitrate or scheduling guarantee | Can bound application queue only with explicit sink/backpressure admission; browser/OS/encoder still external | Enforce retained delivered-payload admission and chunk-reference count; soft Stop, explicit workload limits; no total-memory guarantee |
| Reliability | Existing native/error/hang paths remain | Must handle crossing, synchronous/reentrant Stop, refusal/missing stop | Adds timer authority, late/background callback decisions | Sink failure, disk full, write latency and segment finalization become lifecycle states | Correct demonstrated ordering before activation; truthful failed shutdown and cancel path; preserve manual Stop |
| Data preservation | RC-06 protects old export only while process survives | Retain final tail if allowed; cannot promise recovery after refusal | Same as B; abrupt time stops may surprise | Saved segments may survive page loss; incomplete container needs proof of decodability | Old result remains until a valid replacement commits; oversized admission failure discards failed new capture explicitly; no fictitious partial export |
| UX | Must disclose no automatic protection; risk of losing current capture | Automatic early completion with a durable reason and progress | Time expectation easier to explain; time and size can end at different moments | Destination chooser/permission, disk space, segmented files, recovery UX | Show exact received-payload progress, reason, prior download, finalizing state and explicit failed-capture outcome |
| Browser support | Existing MediaRecorder support | No new native APIs | Monotonic performance clock + existing interval; throttled background | File System Access writable destinations are not universal; secure-context/user-activation/permission differences; other sinks require alternate design | Existing APIs for narrow policy; physical/browser acceptance still needed |
| Complexity | Minimal, but weak automated outcome | Accounting + idempotent Stop + end/error contract | B plus elapsed checks and suspended lifecycle | Large ownership/storage/container redesign | Small runtime counters/admission + reason, focused UI and preserve-export cancellation; not a streaming subsystem |
| Performance | Existing array/Blob assembly cost | O(1) accounting; no media copying needed | O(1) checks; no RAF dependence | Avoid whole export retention only if data leaves bounded queue; slow writes cannot accumulate freely | O(1) counters and bounded array count; no new buffers/copies or per-frame scan |
| Configuration | Publish supported scenario and limitations | CONFIG owns immutable byte policy; transient counters/reasons outside presets | CONFIG time policy, monotonic clock | Destination is runtime session state, not preset/permission persistence | CONFIG factory policy only after calibration; no schema changes; UI observes canonical state |
| Compatibility | Offline portable unchanged | Existing formats/sources preserved | Same as B | Standalone/offline needs supported local sink; OPFS adds origin/quota/eviction and export-copy risks, not automatic durable user storage | Portable/hosted share code; File/Mic/Stream, EOF, retained exports unchanged |
| Build assignment | Defensible only after product accepts bounded workload and device evidence; insufficient today | Plausible narrow 115 prerequisite, alone incomplete | Supplemental signal, not replacement for payload policy | Legitimate 117 planning; essential earlier only for stronger product promises | Narrow 115 policy decision + safeguards; broader persistence/backpressure stays 117 |

A is not rejected because every realistic recording is unsafe. Short native
recordings work. It is insufficient **on present evidence** because no supported
duration/resolution/scene/device envelope is approved, no app admission boundary
exists, and failure can strand finalizing with transport locked. A future human
may explicitly accept that residual risk, but this investigation does not propose
that acceptance as the best release gate.

B's naive implementation (`sum += size; if sum >= limit then stop()`) first retains
an arbitrarily oversized chunk, then can retain an arbitrarily large final chunk.
Reducing the timeslice, requesting lower FPS or configuring bitrate may improve
observed behavior but does not create a maximum chunk/tail/memory guarantee.
Dropping arbitrary chunks and concatenating survivors does not establish a usable
partial WebM/MP4. Stop must be idempotent **before** invoking native code; never
check limits only after calling it or overwrite a synchronous terminal outcome.

C measures wall elapsed with `performance.now()` (already injected by this engine),
not RAF frames or interval tick counts. Check at data/public/timer boundaries.
Background suspension can postpone all checks; elapsed time and native encoder
output can diverge. A duration warning is useful; an automatic duration Stop is
an explicit product choice requiring evidence and a persistent reason. It does
not independently make high-bitrate/late-delivery recording safe.

D: persist each accepted chunk with bounded in-flight writes, error/permission/
quota cancellation, and a recoverable container/segment strategy. MediaRecorder
cannot be assumed to pause with zero native backlog. Each segment needs real
independent replay tests; timeslice Blobs are not necessarily standalone files.
A new MediaRecorder per segment can create gaps and change audio/video continuity.
A user-selected file requires user consent; reusing a directory/handle cannot be
assumed in portable file:// mode. OPFS/IndexedDB temporary spooling adds quota,
eviction, cleanup and final export costs and can still require a large download
Blob. A worker only moves work. Service/server upload changes offline/privacy
behavior. None is authorized or implemented here.

## Proposed minimum hybrid semantics (unimplemented)

Use two levels, because orderly Stop and exact application retention are different
contracts. CONFIG would own soft **S** (new-session delivered bytes), aggregate
hard admission **H** (previous successful payload **P** + new pending delivered
payload **D**), and reference-count ceiling **C**. Values remain **undecided**.

- Before Start, preserve P and reject admission if calibrated reserve/workload
  headroom is unavailable; never delete P to admit a new recording.
- Before appending a nonempty event, validate finite safe-integer size and checked
  sum. Admit only when `P + D + chunk.size <= H` and count remains `<= C`.
  This bounds retained logical encoded payload/references under application
  authority, not the event Blob the browser has already allocated.
- After admission, once `D >= S`, mark reason/stop-request authority once and
  request orderly native Stop. Include the crossing event only if it fits H/C.
- Accept all final data that fits H/C. If any event fails admission, do not append
  it. Fail the new capture explicitly; discard its pending chunks under a
  preserve-export abort contract and attempt shutdown. No silent truncation or
  claim that the remaining chunks form a valid recording.
- Assemble only after authoritative terminal Stop; P + D describes distinct
  encoded payload, not physical allocation. A candidate Blob/URL can overlap
  P/chunks. Allocate no copy merely for accounting.
- Elapsed notification and supported workload copy explain how much was received,
  when Stop was requested, that final output may exceed S, and that browser-native
  memory is not measured. A final result within H may still fail allocation.

Why include C? Many tiny chunks cost references/Blob metadata even with small
payload. The 10,000-event model demonstrates growth but measures no real object
cost. A count ceiling can bound app-owned collection cardinality; it needs its
own evidence/default decision, not an invented “bytes covers all memory” claim.

No numeric factory settings are recommended from a one-minute headless desktop
probe. Workload arithmetic in characterization is a calibration input only.
An implementation can be reviewed after values/workload expectations and the
failure contract are explicitly authorized; this document is not that authority.
