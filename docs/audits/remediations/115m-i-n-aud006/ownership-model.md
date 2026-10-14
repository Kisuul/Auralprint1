# Resource lifecycle and ownership at accepted main

Primary source: `src/js/recording/recorder-engine.js` (line references are baseline).
`runtime` (17–49), `start` (1108), `stop` (1261),
`finalizeStoppedRecorder` (1019), `handleRecorderError` (1081),
`dispose` (terminal public method). Function names take precedence over approximate line labels.

```text
Start: support + active File/Mic/Stream source admission
  -> reset session bookkeeping, preserve old completed export
  -> canvas.captureStream(FPS): recorder-owned video tracks
  -> optional AudioEngine tap: dedicated File branch OR borrowed live audio
  -> merged MediaStream (shared track references; no ownership transfer)
  -> new MediaRecorder({mimeType}); handlers capture sessionToken
  -> native.start(1000); native encoder buffering (unobservable)
  -> dataavailable(nonempty Blob): append reference; increment chunkCount
  -> Stop: freeze elapsed at request time, stop timer, mark finalizing
  -> native.stop(): normally inactive immediately, asynchronous final data + stop
  -> accept final chunks with same authority -> assemble Blob -> create URL
  -> release session/timer/handlers/render/tap
  -> commit new export metadata -> retain new Blob -> revoke previous URL
  -> clear pending chunks, keep latest export

Error/start failure/failed finalization -> release session -> discard pending
  -> preserve previous export; error status; no partial export salvage
Dispose -> invalidate authority BEFORE native.stop -> release owned resources
  -> discard chunks AND completed export; disabled terminal status
```

| Resource | Owner / reachability | Release / caveat |
| --- | --- | --- |
| Native MediaRecorder | RecorderEngine runtime; native browser also owns work | `releaseMediaRecorderInstance` drops application reference and nulls each handler. Ordinary Stop requests shutdown; release itself does not stop. Clearing JS references proves no native reclamation. |
| Encoded data not delivered | Browser encoder/muxer | Unknown amount/lifetime; timeslice is a request, not an upper bound. |
| Delivered chunks / pending array | Runtime retains all nonempty event Blobs | Cleared on success, error, start/stop failure, inactive-stop or disposal. No byte counter/limit, no chunk count limit. Zero-size events ignored. |
| Completed Blob | `runtime.completedBlob` | One retained successful result. Preserved by start/reset/failure; replaced only on success; cleared by Dispose. |
| Object URL | Browser registry; string projected to `state.recording` | Revoke prior URL only after new metadata commit; failed candidate URL revoked; Dispose revokes current URL. Download does not clear export. |
| Previous successful export | Same retained completed slot + URL during replacement | Coexists with all pending new data; transient new Blob/URL also coexist during assembly/commit. No accumulated history of application-owned successful exports. External downloads/consumer-held references have independent lifetimes. |
| Canvas capture | RecorderEngine, `runtime.renderStream` | Only recorder-created video/render tracks are stopped by `releaseRenderStream`; canvas/render loop continues. Track stop exceptions are swallowed, so cleanup is an attempt, not proof of native release. |
| File audio tap | AudioEngine via captured tap descriptor | `ensureStream()` creates destination from outputGain; `releaseStream()` disconnects branch/stops dedicated tracks. Playback/analysis graph remains owned by AudioEngine. |
| Mic/Stream audio | InputSourceManager owns upstream tracks; AudioEngine borrows | Recorder tap returns live stream. Its release preserves upstream tracks; recorder never stops merged/shared audio. Owner release exceptions do not transfer ownership. |
| Merged MediaStream | RecorderEngine wrapper only | Dropped in `releaseMergedStream`; tracks share original references; never iterate merged tracks to stop all. |
| Interval | RecorderEngine, 200 ms cadence | One interval per Start; token fenced; cleared at Stop/release/reset/disposal. Timing uses injected `nowMs`, default `performance.now()`, independent of RAF. |
| Callbacks/session identity | Token captured by data/stop/error/timer | Release increments token; Dispose increments before native Stop and again during release. Queued old functions cannot mutate a newer session. Handler nulling alone is not authority fencing. |

`state.recording` stores metadata, never media chunks. CONFIG owns recorder defaults;
recording options/counters are ephemeral, not preferences/presets. UI coordinator
`getRecordingUiModel`, `formatRecordingPrimaryStatus`, `downloadLastRecording`
reads state; prior Download remains enabled during capture/failure/finalizing.

Source semantics: `onTransportMutation` changes messages, not recorder input or
source ownership. File queue changes/unload/EOF can continue canvas capture;
File tap belongs to the graph and transition paths. Source selectors are locked
while recording/finalizing (`isSourceSwitchLocked`), with broader transport locks
while finalizing. EOF uses the existing deferred single-consumption path when
finalizing; ordinary recording EOF can advance. Never use a capacity trigger to
stop playback, seek, analysis, visualizers or an upstream live track.

Failure retention deserves separate treatment: missing native stop event leaves
phase finalizing, pending chunks, recorder, render/tap/merged references and previous
export reachable indefinitely; timer is already cleared. Start/reset blocked and
UI transport locked. Stop throw/error paths discard pending chunks and drop native
reference without establishing native inactivity. Dispose establishes truthful
failed disabled disposition if shutdown/cleanup fails, but intentionally removes
all exports: it is not a nondestructive recovery button. Ordinary finalization
currently ignores `releaseActiveSession()`'s cleanup boolean; a throwing tap release
can be logged while status is complete. That is an injected application contract
weakness, not an observed browser failure.
