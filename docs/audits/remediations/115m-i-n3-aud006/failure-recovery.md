# Failure, cancellation and export ownership

Cancel Current Capture is an explicit application abort, distinct from Stop and
terminal Dispose. It invalidates the session before native shutdown, detaches
handlers, clears the interval and pending references, stops recorder render tracks
and releases the captured tap through its AudioEngine owner. It preserves the
previous successful Blob/URL/filename/size. It never stops merged/shared audio.

Native inactivity and all required cleanup must succeed to permit a new Start.
Otherwise a bounded ownership tombstone is retained, recorderEnabled is false,
and the application leaves recording/finalizing so primary transport can operate.
Init, Reset, support reads and late callbacks cannot reenable that backend. This
implementation deliberately uses page reload as its recovery boundary; even a
later native stop does not certify failed owner cleanup. Download the retained
export before reload. No native memory reclamation is claimed. There is no
finalization watchdog: missing terminal remains finalizing until explicit Cancel.

Every Stop request sets the durable reason, phase and latch before native stop.
Synchronous Start data, Stop, error and terminal events cannot be overwritten by
outer returns. Error wins before terminal; callbacks after terminal are stale.
Identical event objects are admitted once; distinct events with the same Blob
remain separate delivered events. Timers and all handlers carry session authority.

Success requires authoritative inactive terminal, candidate Blob and URL creation,
size agreement with admitted bytes, required cleanup, then metadata/Blob commit.
Only after commit is P's URL revoked once. Any precommit failure revokes the
candidate alone, restores prior metadata, discards new pending data and reports
failure. Cleanup failure forbids success and further sessions on this page.
Dispose retains destructive export-clearing semantics; unresolved ownership stays
truthfully blocked even after Dispose. It is never used as Cancel.

New hostile coverage includes transient-retention observation, duplicate callbacks,
metadata projection failure, missing terminal, stop throws/stays active, render/tap
cleanup errors, late callbacks/timers and Init after unconfirmed abort.
