# Resource characterization and reproduction

## What is known

| Quantity | Measurement / exact scope |
| --- | --- |
| Delivered bytes D | Sum of native event Blob `.size` for accepted nonempty events; exact logical encoded payload bytes. Current engine does not maintain this sum; diagnostic observer does. |
| Chunk count n | Engine increments once per nonempty delivery; zero-size ignored. Count preserved as final metadata, pending array later cleared. Synchronous Start projection can temporarily overwrite canonical count; private collection still has data. |
| Completed bytes P | Completed Blob `.size`, projected as lastExportByteSize; exact payload length, not physical RAM. |
| Elapsed | Injected monotonic `performance.now()` difference, rounded state milliseconds. Start samples before native.start; Stop freezes time before native.stop, so elapsed excludes final callback latency, not exact media duration. |
| FPS | Configured request 24/30/60, default 30. Track settings may report frame rate; neither guarantees delivered encoded FPS under load. |
| MIME | Configured selection/request and native reported MIME; generic MIME may not identify encoder codec precisely. Explicit configured AVC/Opus combinations depend on support probing. |
| Completed exports | One application-owned successful export steady-state; prior result and candidate overlap transiently during successful replacement. URL and Blob are references to output, not two proven physical copies. |

Unknown/unbounded by this implementation: native encoder backlog before events,
variable bitrate, mux/intermediate buffers, final tail size, frame buffers/GPU
costs, Blob sharing/copying/spill-to-disk behavior, JS versus native allocation,
GC/reclamation timing, total recorder-attributable process memory, and browser
encoder behavior while backgrounded/suspended. No JavaScript API here reports
available recording capacity. A cleared reference does not establish native GC.

## Retention model

Let P be the previous successful export, D=sum(s_i) current delivered pending
bytes, n the count, N undelivered native bytes, and Q the newly assembled output
Blob's logical size. Before assembly, retained encoded payload is **P+D**; n
references/Blob wrappers also grow. At assembly Q=D, so the sum of reachable Blob
sizes may be **P+D+Q=P+2D**, plus the URL's reference to Q. This is **not an exact
physical allocation sum**: chunk/candidate/URL may share storage. A plausible
copying implementation can transiently need old P, new D and new D again; sharing
can avoid the extra payload copy. The application has no portable guarantee of
either. Prior exports that became unreachable may also remain allocated until
native/GC reclamation; downloads/replay held by consumers extend other lifetimes.

A useful risk expression is `payload(P,D,sharing) + objectOverhead(n) + N +
encoder/mux/frame/graph costs + unreclaimed allocations`. None of the latter
terms has a proven finite bound from this code. Both P and D are currently
unbounded across arbitrarily long sessions; retaining one export is a cardinality
bound, not a byte bound. Finalization may be the peak rather than recording.
Failure normally clears current pending references but preserves P; no terminal
callback preserves both indefinitely. Stopping tracks/dropping a recorder cannot
be counted as instantaneous memory release.

## Current behavior under adverse schedules

| Case | Established outcome and evidence class |
| --- | --- |
| Ordinary recording | Append every nonempty event; Stop->final data->stop->Blob/URL->commit/revoke old; 23-case model and native observations. |
| Delayed data | No admission/backlog check; elapsed continues, D may stay zero. Model advances ten minutes with no data; final output accepted. Native MP4 delivered its principal payload at about three seconds despite 1s timeslice. |
| Large event | Model reports 1 GiB using one physical byte; accepted with no automatic Stop. This is accounting/reachability evidence, not native memory. |
| Final tail overshoot | Hypothetical 100-byte budget, 99 pending + 500 final = 599 exported; no budget currently exists. All tail data retained. |
| Encoder error | Token invalidated, handlers detached, render/tap released, pending discarded; P remains. Error-before-stop and error-during-finalizing lose new capture and fence late events. Release itself does not request native Stop; fake remaining active proves no shutdown guarantee. Browser fatal-error shutdown is external. |
| Stop throws | Error, clear current chunks, retain P, drop recorder reference; fake may remain active. Not a reproduced real Chromium refusal. |
| Stop event missing | Modeled finalizing remains reachable after one hour clock advance, no timer, Start/reset blocked; UI transport/EOF wait. No real browser hang observed. |
| Synchronous events | Public Start/Stop can overwrite settled error/complete projection or reset displayed count; modeled application defect, not standard native task ordering. Reentrant Stop guard itself calls native once. |
| Cleanup owner throws | Complete can still be published while release logged false; upstream preserved. Model-only failure injection. |
| Transport/source | Transport message seam continues recording; source workflow switches locked in active/finalizing UI. Native attempted source switch stays File; after Stop switches Mic->Stream->File workflow with source-owner teardown. Direct forced source replacement bypassing UI is not certified. |
| Dispose pending work | Terminal token fencing before native stop; current and prior exports intentionally cleared, late data/stop powerless, correct owned-track cleanup. Model and unchanged RC-19 tests; not an appropriate preserve-export recovery API. |

## Controlled modeled evidence

[evidence/modeled.mjs](evidence/modeled.mjs) creates a scratch copy with only an
inspection export/import-path adaptation, leaving production source untouched.
Each event wraps **one physical byte** with a modeled reported size; modeled
final Blob stores a size sum, never a huge buffer. Thus 1-GiB/high-output models
are not allocation/stress evidence. Tests assert current behavior, including
known weaknesses. [Result](evidence/modeled.json): **23 cases passed**.

Cases include low/high/bursty output, 10,000 tiny chunks, one huge reported chunk,
zero-size ignoring, delayed delivery, final overshoot, 25 replacement cycles,
old-export overlap, failed replacement, error/stop/late callbacks, transport
messages, missing stop, throwing stop, reentrant and synchronous callbacks,
disposal while finalizing and owner cleanup failure. Existing RC-06/RC-19 suites
add real small Blob/fetch and production audio/source-owner regressions. No future
policy mutation was installed or run.

## Native methodology

Externally provisioned Playwright and Chromium; no project dependency. Build's
self-contained HTML is served by Playwright localhost route fulfillment with one
in-memory symbol-exposure line. Real application bootstrap, canvas/visualizers,
audio graph, InputSourceManager and UI operations execute unchanged. A native
MediaRecorder subclass observes events/stop requests, without controlling their
scheduling/output. Synthetic mediaDevices return real oscillator-driven stereo
MediaStreams; Stream also contains a separate fixture video track, while the
recording uses canonical canvas video. This substitutes permission/acquisition,
not production graph/ownership. Canvas 960x640, DPR 1, default scene/FFT and 30 FPS;
not a high-complexity or low-memory target-device envelope.

An initial run completed all 11 recordings, real download/replay and one-live-
export checks, then timed out on a **harness assertion** expecting source.kind
`file` after switching to empty File workflow. Production `switchToFileMode`
tears down to idle/none until a file is activated. Initial output is preserved in
[evidence/native-initial.json](evidence/native-initial.json). The final harness
waits for inactive source and owned source tracks ended, matching actual contract.
No production fix was made. Final results and derived workload table are below.

Memory snapshots use CDP `Performance.getMetrics` JSHeapUsedSize/JSHeapTotalSize
for the entire page at before/active/after checkpoints. This does not attribute recording allocations; Blob backing may be outside the
reported JS heap, and native/GPU/encoder/process allocations are not covered. It
is not peak RSS. No
forced GC, forced OOM, native memory limit, background suspension or device-safety
claim. Reference/URL ownership checks are not reclamation measurements.

## Final native observations

Chromium **151.0.7922.173**, headless Linux, native canvas **960×640**, **30 FPS** requested, **DPR 1**. Final codec-aware run: **11/11 recordings complete**, one failed-acquisition preservation check, no page errors. Repeated successful native runs do not establish a safe-device duration.

| Case | Actual native MIME/codec | Elapsed s | Nonempty chunks | Encoded bytes | Largest event bytes | Max event gap ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| video-only | video/webm;codecs=vp9 | 3.037 | 4 | 387,347 | 159,512 | 1017.8 |
| file-audio | video/webm;codecs=vp9,opus | 5.026 | 5 | 809,855 | 175,921 | 1029.5 |
| synthetic-mic | video/webm;codecs=vp9,opus | 3.024 | 3 | 628,295 | 240,105 | 1023.2 |
| stream-codec-video/webm;codecs=vp9,opus | video/webm;codecs=vp9,opus | 3.023 | 3 | 580,924 | 230,892 | 1019.8 |
| stream-codec-video/webm;codecs=vp8,opus | video/webm;codecs=vp8,opus | 3.020 | 3 | 1,003,708 | 391,108 | 1019.3 |
| stream-codec-video/webm | video/webm;codecs=vp8,opus | 3.027 | 3 | 993,282 | 392,327 | 1024.2 |
| stream-codec-video/mp4 | video/mp4;codecs=vp9,opus | 3.028 | 2 | 697,106 | 695,906 | 3033.8 |
| stream-longer-safe-60s | video/webm;codecs=vp9,opus | 60.021 | 59 | 14,470,681 | 314,551 | 1039.1 |
| repeat-1 | video/webm;codecs=vp9,opus | 2.033 | 3 | 460,342 | 240,720 | 1020.0 |
| repeat-2 | video/webm;codecs=vp9,opus | 2.030 | 3 | 462,756 | 247,351 | 1019.9 |
| repeat-3 | video/webm;codecs=vp9,opus | 2.022 | 3 | 458,907 | 248,431 | 1023.6 |

The longer sample produced **14,470,681 bytes in 60.021s**, about **1.929 Mbit/s** average. Across these cases observed averages ranged **1.02–2.659 Mbit/s**. This range is not an encoder maximum.

Generic WebM resolved to VP8+Opus; generic MP4 resolved to **VP9+Opus**, not H.264. The explicitly configured AVC+AAC MIME candidate was excluded by support probing on this Chromium. This is supported-format negotiation, not an application codec defect. MP4 emitted its main payload only at Stop after roughly three seconds: requested timeslice does not cap native delivery intervals. Native Stop→terminal times for these samples are in native-summary.json; no refusal or missing terminal event occurred.

Whole-page JSHeapUsedSize checkpoint values ranged **6,203,288–12,887,324 bytes**. No recorder-attributable physical-memory measurement was available; these are neither Blob retention totals nor native/process peaks.

Application export ownership: 11 created, 10 replaced/revoked, **one current URL**. Previous bytes remained fetchable during replacements and failed acquisition. Mic/Stream audio tracks survived recorder Stop; source-owner workflow transitions ended their tracks. Attempted switch during capture remained locked. Download saved **458,907 bytes** to scratch storage; native replay advanced to **0.444s**, dimensions 960×640. This is same-browser decode/replay, not external-player audio-fidelity acceptance.

Final raw [native.json](evidence/native.json), compact [native-summary.json](evidence/native-summary.json), and initial harness failure remain independently inspectable. Final codec-aware capture repeated the corrected workflow to record event MIME/native final MIME. Media files were not committed.

## Workload estimates, not supported limits

Encoded growth under an assumed average bitrate r is `r*T/8` bytes. At **1–20
Mbit/s**, arithmetic ranges are 7.5–150 MB/minute; five minutes 37.5–750 MB;
fifteen minutes 112.5–2250 MB. These are decimal MB, not allocations performed.
Bitrate and scene complexity may exceed these illustrative assumptions. If an
old export is comparable in duration/bitrate, P+D doubles the encoded payload
range; a copying assembly could add another D. Neither encoder defaults nor a
short recording establish that any upper assumed bitrate is enforced.

Measured native bytes/duration are empirical averages only. Extrapolating a
one-minute sample to an hour assumes stationary bitrate, scene, codec, scheduler
and browser storage. It does not certify that duration. No factory byte/time/
chunk-count limit or universal supported maximum follows from this host.

## Exact reproduction

From repository root, Node 24 and Python 3.12 with available browser tooling:

```sh
mkdir -p work/aud006-replay
npm ci --cache /workspace/auralprint-environment/npm-cache
npm run build
node docs/audits/remediations/115m-i-n-aud006/evidence/modeled.mjs work/aud006-replay/modeled.json
AUD006_CHROMIUM_PATH=/usr/bin/chromium node docs/audits/remediations/115m-i-n-aud006/evidence/native.cjs work/aud006-replay/native.json work/aud006-replay/downloads
RC06_CHROMIUM_PATH=/usr/bin/chromium RC06_REPORT=work/aud006-replay/rc06.json node scripts/validate-recording-export.cjs
RC05_CHROMIUM_PATH=/usr/bin/chromium RC05_REPORT=work/aud006-replay/rc05.json node scripts/validate-finalizing-eof.cjs
npm test
npm run build
python scripts/verify_distribution.py
git diff --check
```

Cache/browser paths are this environment's selectors, not project requirements.
Use ordinary `npm ci` or an appropriate cache elsewhere, and
`AUD006_PLAYWRIGHT_MODULE`/`RC06_PLAYWRIGHT_MODULE`/`RC05_PLAYWRIGHT_MODULE` for
external Playwright locations. Use fresh scratch reports, never overwrite saved
historical evidence. Native diagnostic takes about 100s and commits no media;
actual downloaded media stays in work/. Browser sandbox is disabled only for this
container launch. Route fulfillment is not real server/network-disabled file://
acceptance. Default Chromium automation is the only browser run here.
