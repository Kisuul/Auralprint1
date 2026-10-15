# Proposed failure, ownership and recovery contract

Unimplemented specification. The N.1 reproduction intentionally continues to
assert current defects. The pure N.2 model evaluates prospective transitions and
must never be called passing production governor coverage.

## Session authority and terminal commit

A Start snapshots the validated policy and assigns a fresh authority token before
native callbacks can run. Set every phase/reason/Stop latch BEFORE invoking native
code; afterward write only if that same session still owns the transition.
Captured-token checks precede data accounting, timer work, URL/state changes and
cleanup. Reentrant or synchronous terminal callbacks cannot be overwritten by the
outer Start/Stop return. A terminal path settles once and invalidates authority
before native cleanup capable of reentry. Separate final telemetry from pending
chunks so cleanup cannot erase the truthful result.

| Trigger | Exact observable outcome |
| --- | --- |
| Manual Stop | recording → finalizing (`manual-stop`), request native Stop once, admit remaining data under frozen policy. Authoritative stop + nonempty assembled output + successful commit/required cleanup → complete; otherwise explicit failure. |
| Capacity Stop | After admitting crossing event, recording → finalizing (`capacity-stop`), request once. Keep reason when tail fits; complete is successful capacity completion. Never trigger from rejected data as if successful. |
| Duration Stop | Independent monotonic elapsed reaches T at a permitted public/data/timer boundary → finalizing (`duration-stop`). No RAF clock and no hard deadline guarantee under suspension. |
| Simultaneous byte/time crossing | Evaluate admission first, then threshold conditions together; capacity is primary reason and duration secondary in same check; exactly one Stop. Earlier independently requested Stop reason remains primary. |
| Final data over S, fitting H/C | Append/account once; final authoritative completion succeeds with final size and capacity/duration/manual reason. R does not cap the final event. |
| Any event exceeding H/C | Reject whole event before append; failed new capture (`admission-rejected`), discard all its pending chunks, preserve P/URL. Attempt shutdown/cleanup, fence callbacks and settle application abort. Incoming browser Blob already existed. |
| Native Stop throws | Fail `stop-threw`; fence before further cleanup; attempt all independently owned cleanup; discard D, preserve P. Native inactivity/handler cleanup must be confirmed or recorder stays disabled with shutdown unconfirmed. |
| Stop returns without terminal callback | Remain finalizing, retain D and P, no success. Expose explicit Cancel Current Capture. No automatic watchdog/deadline is installed or implied. |
| Missing all data / zero output | Authoritative stop but no nonempty output → explicit empty-output failure, P preserved. |
| Suspected missing final data | Callback count alone cannot prove a missing tail. If native terminal occurs with earlier data, container/replay validation can detect some failures, not arbitrary lost tail completeness. Require container-specific acceptance; do not claim guaranteed completeness or automatically export arbitrary truncated sequence. Missing terminal is handled as above. |
| Encoder error during capture | Fence; failed new capture (`encoder-error`); discard D, preserve P, attempt native/owned cleanup. Do not infer native inactivity from dropping reference. |
| Encoder error after Stop request | Same failure settlement; error wins over pending success/late stop. Primary request reason retained in diagnostics; final outcome failed. |
| User cancel while finalizing | Explicit preserve-export abort, invalidate token first, attempt owned shutdown, discard D, preserve P, settle application abort. No call to Dispose and no revoke/recreate trick. |
| Source EOF during recording | Preserve existing source/Queue semantics; EOF is not itself a resource-policy Stop. File next/repeat may continue through normal loadAndPlay; live source owner handles track end. Record source/end metadata truthfully. |
| Source EOF while finalizing | Existing deferred File/media/load-request/repeat context retained; settle success/error/application-abort unlock, then consume valid EOF once. Stale context cannot restart playback. |
| Repeated Start/Stop | Reject Start while acquiring/recording/finalizing without counter reset; Stop idempotent before native call; one interval and one owned cleanup. After successful capacity completion, fresh Start allowed if P leaves headroom. |
| P already over H / reserve unavailable | Refuse Start without native acquisition or deleting P. Custom/Unrestricted policy change applies at next session; current prior export still accessible. |
| Blob/URL/metadata commit failure | Fail new capture; revoke only a newly created uncommitted candidate URL, preserve original P/URL. Publish no successful replacement. |
| Recorder disposal | Existing terminal Dispose invalidates tokens before native stop, clears D AND P/URLs, releases owned resources, stays disabled; never relabel it as preserve-export Cancel. |

Successful replacement order is explicit: native terminal/inactivity confirmation;
assemble candidate Blob/URL; finish required owned cleanup; atomically commit the
new Blob/metadata while the token still owns settlement; then revoke the captured
old URL exactly once. Before that commit, failure discards/revokes the candidate
only and keeps the old Blob/metadata intact. A commit exception must restore the
old metadata without revoking its URL. Publication must not precede required
cleanup, or a later cleanup failure could destroy the preserved-export guarantee.

## Transport unlock and unconfirmed shutdown

Successful native settlement releases the recording/finalizing transport lock.
An explicit failed application-level abort also releases that lock independently
of whether native shutdown is confirmed. Use a distinct terminal capture phase and
`recorderEnabled=false`, not a forever-finalizing phase to express uncertainty.
Primary playback/Queue/source actions can proceed through their established owners.
The aborted native session has a separate opaque, token-fenced shutdown tombstone;
it cannot mutate current status, exports, timers, sources or a new capture. If
late inactivity/stop is observed, the cleanup owner may release that tombstone only.
Do not stop shared audio as an escalation. Keep at most the one unresolved backend
and reject new recording until it is explicitly resolved; do not accumulate new
native sessions while old work may remain active.

Recovery must explicitly attempt/check owned native stop and handler detachment,
release the captured audio tap through AudioEngine, stop only recorder-created
render tracks, and document observed native state/cleanup errors. A mere Init call
cannot certify shutdown or silently reenable an unresolved backend. Propose an
explicit recovery action only when those checks succeed; otherwise recording stays
disabled for the page lifetime and page reload is the honest remaining boundary.
Warn reload loses page-owned export URLs and current unsaved capture; let users
download P first. The tombstone is an ownership fence, not a memory-release claim.

Public Dispose retains its existing destructive terminal meaning. Cleanup cannot
borrow the merged stream as ownership: never stop upstream Mic/Stream tracks or
File playback as a fallback for an audio-owner error. Dispose must not become the
only way to unlock primary transport after a failed replacement.

## Automatic deadline remains undecided

No proposed factory timeout follows from short observed settlement latency.
If a later product decision wants automatic stuck-finalization recovery, review
clock origin (Stop request), visible versus suspended elapsed semantics, warning,
exact deadline, one-shot escalation, native confirmation criteria, previous-export
preservation, app abort/transport unlock, disabled recording, focus/accessibility
and late-callback disposal. This assignment neither implements nor approves it.

Unrestricted retains every lifecycle obligation here. A technical array/Blob/URL
allocation or safe-integer accounting failure is reported as such, not disguised
as a numeric application capacity policy. Do not add another hidden limit under
a different name. Checked arithmetic is mandatory; representation limits are
finite and must be explained honestly.
