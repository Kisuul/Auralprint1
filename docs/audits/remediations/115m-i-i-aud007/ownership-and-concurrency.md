# Ownership and concurrency — accepted production baseline

Binding identity: October 9 report `docs/20261009-004238_project-audit.md`, section AUD-007, Medium / Conditional. Baseline `704bf13d3a3dfb76032343226bad7240191ef6c6`. Historical AUD numbers are not interchangeable.

## Actual call chain and readiness

1. Queue creates an opaque entry `{file, name}` on every `add`, including repeat additions of the same File object. Cursor moves return a File; `currentEntry()` returns the stable entry identity.
2. `UI.wireControls`' local `loadAndPlay` validates `Queue.currentEntry().file === file`, creates `activeFileRequest {requestId, entry, autoPlay, pending}`, and notifies RecorderEngine of track-change-start. `resetTrackVisualState()` immediately resets Scrubber, visualizers and band presentation.
3. `InputSourceManager.activateFile(file, {requestId, autoPlay})` checks the UI request guard before and after teardown, before engine allocation and after activation. AudioEngine repeats the guard and separately owns installed media identity and AbortController listeners.
4. AudioEngine creates an independent `<audio>` and object URL, attaches its graph, and normally awaits `media.play()`. It commits loaded/playing state unless a hard failure occurs. Manager commits the File session. UI then verifies request **and Queue entry** ownership again.
5. Only successful, still-current activation calls `Scrubber.loadFile(file)`, without awaiting its result. UI subsequently applies preferences, notifies RecorderEngine of completion and refreshes Queue.
6. Scrubber stops dragging, increments its own token, clears old peaks, sets decoding, starts the **entire** `File.arrayBuffer()` read, then checks the token. Current work creates `OfflineAudioContext(1, 1, 44100)` and calls `decodeAudioData(arrayBuffer)`. After decode settlement it checks the token again, computes 512 all-channel absolute peaks, then marks ready. Current rejection marks unavailable. Finally clears the current presentation's `_decodeInFlight` flag and draws.

With default autoplay, waveform read starts after the Play promise and successful File activation, not alongside initial activation. Native evidence records active source, loaded/playing true, media readyState and duration at read initiation. With `autoPlay: false`, engine attachment can complete without awaiting media data/metadata readiness; recoverable Play refusal can also leave an activated paused File. Consequently waveform processing is after **activation**, not universally after known finite duration or audible playback. Any eventual preflight must handle delayed metadata without delaying activation.

Production source references (baseline line numbers): Queue 15–20, 90–95; UI 1240–1248, 1283–1306, 1330–1468, 1615–1634, 1798–1810; InputSourceManager 270–275, 439–505; AudioEngine 307–441; Scrubber 15–46, 72–121, 228–290. `state.js` owns audio/source/recording presentation state; waveform job/peaks remain local to Scrubber. CONFIG is frozen; no waveform admission policy exists there.

## Identity and invalidation

| Identity / signal | What it owns | What it cannot prove |
| --- | --- | --- |
| UI request ID + Queue entry object | Current transport intent, including same-File duplicate entries, remove/reorder/EOF ownership | Cancellation of a waveform decoder |
| AudioEngine installed media + listener AbortController | Media graph, URL release and current media callbacks | Cancellation of OfflineAudioContext decoding |
| InputSourceManager activation/session identities | Live tracks, native source errors and session teardown | Ownership of waveform buffers |
| Scrubber monotonically increasing decode token | Current waveform commitment; repeated same-File loads are separate generations | Resource admission or physical cancellation |
| `_decodeInFlight` boolean | Current waveform presentation bookkeeping (not used to gate loads) | Number of unresolved reads/decodes |

Only **File** reaches Scrubber. Neither Queue entry nor UI request ID is passed. Scrubber does not compare File objects: its generation orders calls. `reset()` increments the token; every `loadFile()` increments it again. A successful normal UI track replacement commonly performs both increments. Reset happens at the start of new activation, before a replacement waveform request. Failed replacement therefore leaves no old waveform. Clear, last-item removal and File→Mic/Stream clear transport/visual state through the existing coordinator. They invalidate Scrubber even while source permission/activation is pending.

Removing a non-active Queue entry and shuffling preserve the current entry and do not independently reset its waveform. Direct calls to AudioEngine or InputSourceManager do not automatically reset Scrubber; the production UI owns this coordination. The proposed scheduler must preserve this boundary and must not infer source teardown from preference application.

## Reproduction and resource ownership at each boundary

`diagnostics/reproduce.mjs` runs the production Scrubber source with controlled read/decode promises, 16-byte encoded fixtures and 13-frame/two-channel PCM. Rendering observations distinguish different peak amplitudes without exporting private Scrubber state. Counters are updated at actual mocked operation invocation and settlement.

| Scenario | Measured initiation / overlap | Result and logical ownership |
| --- | --- | --- |
| A read; B replaces before A read resolves | 2 reads, max 2 unresolved reads; 0 decodes until current B read resolves | A read continues; its completion skips context/decode. B alone can commit. |
| A decoding; B replaces A | 2 decodes, max 2 unresolved calls | B completes first; A's later success cannot overwrite B. |
| A/B/C enter decode successively | 3 reads, 3 decodes, max 3 unresolved decodes | No admission gate. C wins even when A/B settle later. Generalization to N requests is source-derived, not an N-sized memory experiment. |
| Clear/reset while A decoding | 1 decode remains unresolved after Reset | Peaks cleared; current presentation empty; A completion still discarded. Reset during **read** instead prevents decoder allocation after read completion. |
| Current read rejects | 0 decodes | Unavailable; B later reaches ready. |
| Current decode rejects | 1 failed decode, later B decode admitted | Unavailable; later File recovers. |
| Obsolete read/decode rejects after B ready | A rejection cannot change B's presentation | Catch/finally ownership is guarded as well as successful commitment. |
| A decode never settles during observation, then Reset/B | B decodes and reaches ready while A remains unresolved | Current correctness recovers by accepting overlapping work. Cleanup resolves A only **after** the measurement; no claim of a proven forever-hung native decoder. |
| Current waveform failure with seek | Media fixture stays loaded/playing; mouse seek sets 15 of 20 seconds | Unit media is mocked. Native integration separately proves real playback/seek during optional decode rejection. |

The negative control removes only the post-decode stale-success guard in a disposable in-memory module. The baseline passes; the mutation fails `stale decode must not overwrite newest waveform` with different actual peak heights. It proves the observation sees stale commitment rather than merely counting calls. No source file or permanent test is modified.

Native integration uses actual small generated WAVs and the accepted portable/hosted build. Its ordinary operations are native. One case deliberately rejects **only** waveform decoding, proving a valid native File continues playing/seeking and a later File recovers. This is rejection evidence, not proof of a resource policy that does not yet exist. Native hostile concurrency is represented by controlled promises; no large allocations or OOM test occurs.

## Release eligibility is not memory reclamation

Before read completion, the platform read and suspended async continuation remain outstanding. Reset does not cancel `File.arrayBuffer()`, clear that continuation's locals, or settle its promise. At stale read completion no context is created; the returned ArrayBuffer is no longer needed once the continuation returns. Eligibility for garbage collection has no observable reclamation deadline.

During decoding the platform owns the decoding operation. Chromium's native admission detached the input ArrayBuffer (byteLength became 0); **detachment transfers/removes JavaScript access, not proof the encoded data was freed**. Pending promise/context internals can retain the job. Async locals may remain reachable until settlement, and engines may optimize dead references; this investigation does not assert an exact live closure/root set or retained-RSS quantity. A pending operation is not kept in an application queue, but a Reset has no mechanism to force its platform resources to release.

On current success, `audioBuffer` and channel views are used synchronously for peak reduction. Only the 512-element Float32 peak array is stored. When reduction and the async function complete, encoded/decoded locals and channel views become eligible for release if nothing else retains them. Stale success returns before peak reduction. Current/stale rejection unwinds the continuation. Native scratch storage and GC/reclamation timing are implementation dependent. A rejected fixture's counter reaching zero measures logical settlement, not native memory release.

The previous completed peaks are immediately cleared on both load and reset. There is no waveform cache or old-AudioBuffer cache in production. A completed peak array is 2,048 bytes; intermediate decoded PCM can be orders of magnitude larger. Previously completed peaks should remain single-generation owned in the correction; do not display another File's waveform while waiting.

## Native cancellation limitations

The inspected Web Audio API accepts complete encoded data, optional callbacks and a promise; it exposes no per-call AbortSignal/cancel method. Blob.arrayBuffer likewise accepts no cancellation argument. Ignoring a promise, incrementing a token, a timeout/race, dropping a reference, moving reduction to a worker or closing an unrelated playback context does not cancel this native decode. OfflineAudioContext suspend relates to offline rendering, not an abort handle for decodeAudioData. The `1, 1` offline rendering dimensions do not restrict decoded duration or channels.

The [Web Audio specification](https://www.w3.org/TR/webaudio/#dom-baseaudiocontext-decodeaudiodata) describes input detachment, separate decoding work and possible parallel decoding threads; decode output is resampled to the context sample rate. [MDN decodeAudioData](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData) documents complete-file input. [Blob.arrayBuffer](https://developer.mozilla.org/en-US/docs/Web/API/Blob/arrayBuffer) documents a no-argument promise API. Checked October 13, 2026. The current W3C document is a working draft; these API signatures also match the inspected production use and observed native behavior. No browser-thread count is measured here.

## Effect on seeking, loading, playback and recording

Scrubber draws a fallback line, played fraction and playhead independently of peaks. Time/status follows active media duration and currentTime. Seeking checks a finite positive active media duration, not `_waveform` or `_decodeInFlight`. Mouse/touch ownership is stopped by init/load/reset; touchend/touchcancel terminate it too. The correction must retain these semantics.

Waveform decode failures are swallowed locally; they do not write source/transport errors, unload AudioEngine, stop media, revoke playback URLs or finalize recording. Recording still receives track-change/unload events from UI and uses AudioEngine's independent recorder tap. EOF remains the single `_onTrackEnded` coordinator, including finalization locks. Waveform settlement must never call those paths. Schema 10 stores neither waveform jobs nor budgets. H.1's cached presentation still evaluates source/recorder settlement each refresh; new status reasons must not become another unconditional DOM-write path.
