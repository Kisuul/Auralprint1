# Resource policy proposal — review required, no implementation

Playback is primary. A File can be valid to play while being too expensive or insufficiently characterized to draw a waveform. Recommend combining **bounded full-file admission, a single serialized optional job, and preflight before full encoded reads**. Preserve the existing full-channel 512-bucket reduction. The proposed policy is runtime configuration owned by CONFIG, not a preset, hidden constant or new global governor.

## Memory accounting

Let E be File.size; T decoded duration; R context output sample rate; C decoded channels; L decoded frames. Exact JavaScript-visible output PCM is `L × C × 4`. Its duration estimate is `T × R × C × 4`; round frames up for a conservative planning estimate. Source-rate PCM or codec scratch can coexist with resampled output. Source sample rate matters to native temporary storage even though this Scrubber requests 44,100 Hz output.

| Component | Ownership / accounting | Limits of evidence |
| --- | --- | --- |
| Encoded File backing | Queue owns File references; media/object-URL platform may reference underlying Blob backing. Size E is known without reading. | Disk-backed Files need not occupy E bytes of resident JS memory. Blob backing and OS/browser buffers are not measured. Same File referenced by two entries is not automatically two copies. |
| Full encoded ArrayBuffer | One `arrayBuffer()` returns E bytes per admitted read. Concurrent completed reads can add their separate buffers. | Chromium detaches on decode admission; native encoded ownership remains. Never sum detached JS storage as a second demonstrated E-byte copy. |
| Native decoder allocations / encoded backing | Codec setup, demuxing, scratch, working input, resampling and native PCM. | No public upper bound or reclamation deadline from this API; coefficient/multipliers unknown. |
| Returned decoded PCM | Planar Float32 AudioBuffer channels, D = L×C×4 | Complete output allocated before a post-decode budget check. Duration/channel estimates may be wrong; allocation can fail first. |
| Channel views | `getChannelData()` views used across every channel during reduction | Code does not copy each channel with slice/from. Views retain backing; browser may perform native-to-JS representation work. Do not assume C extra full copies; do not assert zero browser overhead. |
| New/current peaks | 512 Float32 values = 2,048 bytes | This small retained array does not bound intermediate memory. |
| Previous peaks | At most one previous 2,048-byte array until load/reset drops it | No old waveform cache. GC timing can overlap allocations beyond logical ownership. |
| Stale in-flight jobs | Independent E/native/D per outstanding call, even with only one current generation | Actual source has no count cap; controlled evidence reached 3 unresolved decodes. |
| Streaming playback | AudioEngine media, demux/decode buffers, graph/analyser/tap | Separate native owner, not freed/refused by optional waveform policy. No universal streaming-memory bound claimed. |
| Recorder | pending encoded chunks, export Blob/object URL, prior export retained until successful replacement | Independent retained media; construction may share backing or copy. AUD-006 remains separate, unchanged. Budgets here cannot guarantee recording safety. |

At time t, a useful accounting inventory is:

`M(t) = FileBackingResident(t) + Playback(t) + Recorder(t) + Peaks(t) + Σjobs [EncodedJS(t) + NativeEncoded(t) + ReturnedPCM(t) + NativeSourcePCM(t) + NativeScratch(t) + AdditionalViewStorage(t)]`.

This is an inventory model, not an instrumented resident-memory measurement. For known T/R/C, output D has an explicit arithmetic bound for that information. For q concurrent equivalent output allocations, qD is the modeled output sum. Native thread execution, peak timing, garbage collection and platform buffer sharing determine whether all terms coexist.

A proposed one-job gate can guarantee **one unsettled admitted read/decode pipeline**, and one pending descriptor without an encoded buffer. If E≤Emax, at most Emax of full **read-result** bytes are admitted per active job before native handoff. If metadata is reliable and consistent, D_est≤Dmax bounds the accepted **estimate**. An illustrative conditional bound is `(1+k_encoded)Emax + (1+k_pcm)Dmax + H + 2,048`, where H includes native fixed overhead and the k values represent native copies/temporary PCM. Neither k nor H is bounded by available evidence; incorrect metadata also invalidates Dmax as a physical bound. Consequently **no finite guaranteed total browser-memory upper bound** is established. Streaming, recorder, File backing, and unreclaimed completed allocations remain outside that expression. Resource admission is still valuable without making an OOM guarantee.

## Representative arithmetic scenarios (not allocations)

| Scenario | Representative encoded input | Float32 output estimate at current 44.1kHz | Interpretation |
| --- | --- | --- | --- |
| Native short stereo WAV, 4 s | Measured 705,644 B, 16-bit/44.1kHz/stereo | Measured 176,400×2×4 = 1,411,200 B | Encoded read measured before detachment; output dimensions measured. Total RSS/scratch unmeasured. |
| Compressed stereo music, 4 min | Illustrative 256 kbps ≈7,680,000 B, ignoring headers | 84,672,000 B ≈80.75 MiB | Rough 11× encoded-to-output expansion, before native overhead. Codec/bitrate are examples, not extracted evidence. |
| Compressed stereo recording, 1 h | Illustrative 128 kbps ≈57,600,000 B | 1,270,080,000 B ≈1.18 GiB | Modest compressed input does not bound PCM; no large file is generated. |
| Six-channel 96kHz WAV, 1 s | Measured 1,152,044 B | Measured 44,099×6×4 = 1,058,376 B | Native resampling produced one frame fewer than T×R; constructor channel count 1 did not downmix output. Original-rate Float32 PCM would be 2,304,000 B, modeled only. |
| Eight-channel 96kHz recording, 10 min | Illustrative PCM16 ≈921,600,044 B | 846,720,000 B ≈807.50 MiB | Original-rate Float32 PCM estimate 1,843,200,000 B; temporary storage unknown. Both channel count and rates matter. |
| Stereo 192kHz recording, 10 min | Illustrative PCM16 ≈460,800,044 B | 211,680,000 B ≈201.87 MiB | Source-rate Float32 model 921,600,000 B; 44.1kHz output alone hides possible resampling/native cost. |
| Missing/unknown duration or channels | File.size may still be exact | Cannot compute a reliable D bound | Browser duration may arrive later; playback sample rate is not file channel metadata. |
| Malformed/unsupported input | Size available, MIME/name untrusted | Unknown; may reject before or after native work | Failure is optional-waveform unavailable. Streaming may independently succeed or fail. |
| Rapid switching | Measured 3 small mock decodes pending | Model sums up to three per-job D allocations if native timing overlaps | Three initiation slots observed, not three native threads or measured giant allocations. |

Duration-only admission leaves encoded reads unbounded. Encoded-size-only admission leaves decompressed duration/channel output unbounded. High source rates can cost more than returned output. File name/MIME, media playback sample rate and channel analysis labels do not validate input duration/channel count. Metadata can be absent, delayed, inaccurate or malicious. Post-decode dimensions are useful observability and a check against underestimated output, but cannot retroactively prevent allocation.

## Candidate comparison

| Candidate | Benefit | Unresolved tradeoff | Recommendation |
| --- | --- | --- | --- |
| A. Full-file decode with admission | Reuses faithful waveform, all-channel peaks, current rendering and seek contracts; refuses optional expensive work | Requires encoded and decoded-estimate criteria and explicit unknown-metadata policy; native overhead remains | Retain architecture for admitted files. Combine with B/C. |
| B. One native decode at a time | Prevents avoidable multiply-admitted stale decodes | Obsolete operation cannot be preempted; permanently unsettled job blocks later waveform work | Reserve one **whole pipeline** slot before any read, hold until underlying settlement; one latest-intent descriptor. |
| C. Limited encoded-read admission | File.size preflight prevents avoidable full large reads; serialize reads as well as decode | File.size does not bound PCM. Extra metadata probes must themselves be bounded and serialized | Reject oversize before arrayBuffer/context. Defer metadata without blocking playback; decline unknowns as specified below. |
| D. Playback-derived incremental peaks | Fixed-size bounded buckets can reflect samples actually observed during ordinary playback | AnalysisFrame waveform is an instantaneous/downmixed analyser window; not a complete faithful file scan. Seeks skip segments; future waveform unavailable; recording/looping samples do not recreate every sample | Defer. Requires explicit contract change to agents.md §3.3 and specific implementation approval. |

B with **immediate refusal** when busy is simpler but loses even short newest-file waveforms until an explicit later retry. B with an unbounded FIFO is rejected: it retains File intents and eventually decodes obsolete sources. A single latest-intent slot provides recovery after stale settlement without pre-reading or retaining a list. Do not admit B's encoded read behind A's ongoing decode: that would weaken the intended whole-pipeline bound. Serializing decode alone addresses only part of the finding.

A dedicated worker can move peak-reduction CPU work but adds message/buffer ownership without making full-file decode incremental. WebCodecs would require codec/container demuxing and a bounded PCM pipeline, browser support policy, decoding error semantics and portable packaging validation. File.slice plus decodeAudioData on arbitrary fragments cannot produce a general full waveform. None is authorized here. Offline downsampling lowers returned PCM but does not guarantee lower decoder scratch, and can alter full-channel peak fidelity; retain current semantics.

## Recommended admission and metadata policy

Use the existing Scrubber closure as the optional-work owner. Proposed CONFIG boundary: a frozen `CONFIG.waveform` (name subject to review), containing `maxEncodedBytes`, `maxEstimatedDecodedPcmBytes`, `decodeSampleRateHz` (current 44,100 behavior), unknown-metadata behavior, one active pipeline and one pending intent, plus an approved display-abandonment deadline if desired. These are runtime policy, never schema-10 fields. No CONFIG/source edit occurs in this phase.

A cheap File.size gate runs first; refuse oversize without a read/context. Do not use a duration limit in place of the PCM-estimate budget. Require finite positive duration and an explicit defensible channel count/upper bound to estimate D. Use the intended waveform context sample rate, not AudioEngine's playback rate. Defer duration readiness on the already activated media element, remove metadata/error listeners on invalidation, and revalidate generation/media identity before admission.

**Recommended default: decline waveform when required metadata stays unknown.** Existing playback exposes duration but does not expose encoded channel count; no honest C bound can be fabricated from mono-ish/stereo analysis, filename or arbitrary assumption. Thus a strict policy using only the present metadata path declines many otherwise valid compressed files and potentially WAVs. This is a material product tradeoff requiring review, not an invisible restriction.

For useful strict full-file coverage, separately approve a narrowly bounded metadata provider, initially for supported PCM WAV layouts, if desired. It would inspect a bounded header prefix/chunk traversal using File.slice, verify declared channels/sample format/frames against container length, and reject inconsistent/unsupported layouts rather than reading until it finds a convenient answer. Probe byte ceiling/work-count ceiling must also be CONFIG-owned and count within the single job gate; ambiguous RIFF/RF64/extensible/chunk layouts decline unless explicitly supported. Do not implement a broad container parser in this phase. The precise supported metadata layouts/probe size need approval before implementation. Verified metadata still does not cap browser-native overhead or prove arbitrary malformed input safe.

A more permissive alternative admits unknown-channel media using an **explicit approved reservation/assumption** and known duration. It gives a decoded-estimate policy, not an actual-output upper bound; later output can exceed the assumption after allocation. Recommend against making that the default. Human approval must name accepted channel/duration uncertainty and browser/device coverage. Neither a 2-channel guess nor a silent universal 32-channel reservation is supported by the current evidence. No claim that all ordinary playable codecs will retain waveform support under the strict recommendation.

## Decisions for human review

The native fixtures demonstrate behavior, not safe limits on weak hardware. Exact budgets and elapsed-time thresholds cannot be justified from these small tests. **Human selection is required before implementation.** Profiles below are discussion/calibration candidates only, with binary MiB and raw bytes; they are not approved defaults or universal safe file sizes.

| Decision | Recommendation / rationale | Approval needed |
| --- | --- | --- |
| Maximum admitted encoded bytes | CONFIG `maxEncodedBytes`; independent pre-read gate. Discussion conservative 16 MiB (16,777,216 B), permissive 64 MiB (67,108,864 B). Limit bounds avoidable full read, not total memory. | Select budget/profile after target-device calibration; no evidence supports either as universally safe. |
| Maximum estimated decoded PCM | CONFIG `maxEstimatedDecodedPcmBytes`; discussion conservative 64 MiB (67,108,864 B), permissive 256 MiB (268,435,456 B). Use duration × context rate × supported channels × 4; actual decoded dimensions checked afterward for diagnostics. | Select budget and required metadata credibility; post-decode rejection cannot prevent original allocation. |
| Unknown-duration media | Defer while current media metadata can arrive; decline unresolved/invalid/nonfinite duration. Keep playback usable. | Approve unknown-metadata deadline and whether immediate decline is preferable. |
| Unknown channels / supported formats | Decline unless defensible count/upper bound supplied. Optional narrow bounded WAV provider requires its own reviewed layout/probe contract. | Select strict coverage or explicitly accept estimated-risk assumptions; approve provider scope before coding it. |
| Concurrent native decodes | One unsettled operation; serialize full read→decode→reduction pipeline, reserved before read | Approve architecture. Limit=1 is a concurrency recommendation grounded in overlap evidence, not a memory-size guess. |
| Superseded decode | Fence result, remove current-intent references where safe; keep active slot until underlying settlement. One replaceable latest intent, no pre-read/FIFO. | Approve delayed newest-waveform behavior. |
| Unsettled native decode | Never release resource slot on display timeout. Degrade current/pending presentation to unavailable after approved deadline; discard expired pending intent, no automatic retry loop. Future intent may wait as single slot; only native settlement allows admission. Reload is an explicit last resort and must never happen automatically. | Select CONFIG display deadline or accept indefinite truthful decoding/waiting. No arbitrary timeout value proposed. |
| Above-budget file | Fallback timeline/playhead, `waveform unavailable` with reason “resource policy”; playback, seek and recording remain available | Approve reason copy/accessibility; no transport-error/toast flood. |
| Decode failure | Unavailable plus bounded waveform-specific diagnostic reason. No source error/unload. Later eligible File recovers after settlement. | Approve visibility; do not leak file contents or repetitive console errors. |
| Last waveform retention | Clear on new intent/reset; keep only current completed 512 peaks; no cache | Preserve accepted ownership. |
| Budget observability | Scalar initiation/active/pending/refusal/stale/settlement counters, policy snapshot, estimated/actual bytes, durations/reasons; bounded current/last record | Approve diagnostic surface. No unbounded per-file history, File/buffer retention or polling subsystem. |

The conservative PCM candidate holds roughly 190 s of two-channel 44.1kHz output; permissive roughly 761 s, before native overhead. At eight channels those durations are one quarter as long. An ordinary four-minute 256 kbps stereo file fits the illustrative conservative encoded limit but exceeds its illustrative PCM estimate; this is intentional evidence of why both limits matter, not endorsement of those numbers. An above-policy File remains valid to play.

## Proposed job state machine (design, not new code)

- One active descriptor represents reading, optional bounded metadata probing, native decode or synchronous peak reduction. One pending descriptor contains only newest File intent and generation/needed metadata; no ArrayBuffer, AudioBuffer, copied File or list. Current metadata listeners are ephemeral and cleaned on replacement.
- `loadFile` and `reset` still synchronously stop drag/clear peaks and advance generation. Accepted UI File activation stays upstream. No new Queue owner; Scrubber generation is sufficient for waveform freshness if all normal resets are preserved. Media identity fences delayed metadata; it never becomes transport authority.
- Admission checks size and metadata before a full read. Reserve the whole slot **before** invoking a probe/read. Revalidate after read and immediately before context/decode; obsolete read result is dropped without decoding. Synchronous reduction occurs only for current/non-abandoned jobs and retains all channels/final-bucket coverage.
- A replacement stores at most newest pending intent; obsolete pending reference is dropped immediately. Reset/Clear/live-source switch clears pending but does not set active resource occupancy to idle. Active obsolete native work remains measured as outstanding; its completion cannot present peaks/errors.
- Success/rejection finally releases active ownership after the underlying operation settles, drops local references, then revalidates only the newest unexpired pending intent and policy. Rejected operation cannot poison the gate. There is no FIFO, busy retry interval, duplicate decode or scheduler recreation on reset.
- An optional approved display deadline can mark intent abandoned and clear pending File/metadata listeners. It cannot settle/cancel native work or permit a second job. Late completion releases occupancy but cannot revive expired presentation. Newest unexpired replacement may start after settlement; the failed/expired same request is not retried automatically. Manual retry, if later approved, replaces latest intent and never bypasses occupancy.
- With permanently unsettled platform work, safe bounded behavior necessarily sacrifices subsequent waveform availability in this Scrubber session. Preserve media playback/seek/recording. A promise race that admits another decoder after timeout is explicitly unacceptable.

Presentation should distinguish empty, waiting for metadata/decoder, decoding, ready, and unavailable reason. A busy pending intent is not actively decoding. These can remain internal detail states mapped into the existing fallback lane with concise text; no new global state owner is required. Waiting/deadline changes must update text by value to preserve H.1. Current boolean `_decodeInFlight` must not be reused as a resource lock because Reset clears it before native work settles.

## Deferrals and risks

Implementation, actual CONFIG budgets, metadata parser/probe implementation, schema/version/artifact changes, arbitrary codec streaming, worker/WebCodecs/incremental overview, waveform cache, manual retry UI, RecorderEngine/AUD-006 policy and Build 118 spectral changes are deferred. Build 115N remains WITHHELD; canonical releases and previous audit records are immutable.

The primary compatibility risks are reduced waveform coverage under strict metadata policy; delayed newest waveform behind unabortable work; incorrect resource-slot release after reset/rejection; stale metadata listeners retaining media; timeout masking a still-running decoder; generation identity regressions with duplicate Files; and H.1 presentation writes. F source ownership/cancellation, recorder tap/EOF/finalization and mouse/touch reset contracts must remain upstream and independent. Portable operation needs no service/network/worker dependency; hosted relative-root/nested layouts and schema 10 stay unchanged. Acceptance requirements are in `acceptance-plan.md`.
