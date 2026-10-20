# Release disposition — investigation recommendation

**AUD-006 — NARROW CORRECTIVE POLICY RECOMMENDED BEFORE 115N.**

Outcome **B**, recommend option **E**. **Build 115N remains WITHHELD.** This is
neither human closure nor shipment approval. No corrective implementation is
included or authorized by this report.

The existing in-memory design can plausibly serve explicitly bounded interactive
captures. Native short and one-minute recordings work, prior export preservation
and source ownership work, and no OOM was induced. Conversely, source and modeled
evidence establish unlimited delivered retention, old/new overlap, no capacity
admission, unbounded final-tail exposure, and dependence on terminal callback for
transport unlock. There is no approved workload/device envelope supporting a
no-governor acceptance proposal today. The absence of an observed OOM proves no
safe limit; infinite theoretical duration does not prove all short captures unsafe.

A small policy can provide a meaningful application outcome without a streaming
redesign: admit a bounded amount of delivered logical payload/references, request
orderly Stop before the admitted reserve is exhausted, retain the old export,
report early completion or explicit failed new capture, and allow a preserve-
export cancel/failure settlement. It must fix synchronous public-operation status
overwrite before automated Stop and truthfully handle native refusal/cleanup.
Do not ship an implementation that adds only `if (bytes > arbitraryLimit) stop()`.

This recommendation requires accepting that browser encoder backlog, delivery of
an oversized single/final event, Blob construction and suspended-page behavior
can still defeat process survival. If product requires a hard process-memory
cap, reliable unattended long sessions, or guaranteed current-capture recovery
on browser failure, **B is insufficient**: choose outcome C with a separately
reviewed persistent/segmented architecture. No JavaScript delivered-byte policy
can meet that stronger requirement, and even a sink needs native backlog limits.

## Smallest safe corrective scope, after explicit authorization

1. CONFIG-owned S/H/C policy, calibrated to supported workloads/devices; exact
   checked counters and pre-append admission. No preset/schema changes.
2. Idempotent native Stop request and captured-session authority at every public/
   callback boundary. Do not overwrite a synchronous terminal disposition;
   distinguish current pending counters from final diagnostics.
3. Retain final tail if admitted, complete export before revoking previous output;
   otherwise explicitly fail current capture, preserve old output and release
   recorder-owned resources. No silent truncation/partial-playability promise.
4. Define preserve-export abort/cancel and failed-shutdown state independently of
   terminal Dispose. Missing callback must not require deleting the old result
   or permanently holding primary transport behind recording. No automatic
   watchdog default without a documented decision.
5. Canonical status/reason/progress and truthful workload/limit copy; repeatable
   recorder/source/EOF/mutation/native acceptance. Broader streaming, new sink
   permissions, audio ownership refactors and waveform changes remain excluded.

## Exact decisions required before implementation begins

- Approve bounded interactive capture as the Build 115 product expectation, or
  require long/unattended persistence and commission separate architecture.
- Select supported browser/device tiers, dimensions/DPR/FPS/scene complexity,
  codecs/audio modes and recording durations. Authorize safe target-device
  calibration and choose **S (soft delivered Stop), H (aggregate old+new admission),
  C (chunk references), and required headroom** based on it. The one-minute desktop
  data does not determine these values. An implementation assignment must name
  the approved numbers and units or authorize a bounded calibration phase first.
- Approve whole-event admission failure as an explicit failed new capture, with
  previous output preserved, and no generic salvage guarantee; approve tail
  overshoot of S inside H as successful capacity completion.
- Approve the preserve-export Cancel Current Capture operation, how it is exposed,
  failed native-shutdown/reinitialization authority and primary transport unlock.
  Decide whether any automatic elapsed Stop/deadline is wanted; otherwise use
  monotonic duration notification only. Do not infer deadline approval here.
- Approve counters/reason/UI wording and absence of total-memory guarantees;
  explicitly accept residual native/process risk for the selected workload.

## Roadmap compatibility and remaining gate

The October 6 AUD-009 retained-memory/backpressure Build 117 deferral and 115N
real-recording/resource-retention acceptance are compatible **only conditionally**:
115N must decide what workload is supported and whether its residual risks are
acceptable. A deferral is not exemption from truthful 115 behavior. A narrow
recorder admission/failure policy can precede 115N while the larger persistence/
backpressure design remains Build 117. This package does not edit ROADMAP or
reassign work, and does not close October 9 AUD-006.

No platform/device certification follows from headless Linux Chromium. Firefox,
Safari, mobile/constrained hardware, real Mic/display permissions, background/
suspension, network-disabled portable operation, long-duration stress and external-
player audio fidelity remain unverified here. Existing owner browser reports
for earlier work are not new capacity acceptance. Human review of this proposal,
subsequent explicit implementation authorization and independent acceptance are
still required. Do not merge or advance to implementation automatically.
