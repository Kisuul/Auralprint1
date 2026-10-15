# Methodology and measurement semantics

Accepted source: `889b0b4267c473db6bfa7b1afda6cfeed77565ee` = fetched remote main.
N.1 source baseline was `a85ed8d7cf0d670a30b5763e8576d955f7c2d285`;
N.1 merged PR #57 adds evidence, not recorder behavior. Historical files stay intact.

## Reproduction before extension

Run the original `../115m-i-n-aud006/evidence/modeled.mjs` and `native.cjs`
unmodified, writing fresh results here and downloads under `work/n2/`.
The original native diagnostic exposes module symbols in an in-memory built HTML
copy and subclasses native MediaRecorder with event/Stop observers. It also wraps
URL creation/revocation and substitutes oscillator MediaStreams for Mic/display
acquisition. Its actual source manager, audio graph, canonical canvas, UI Start/Stop
and native encoder execute. It does not certify permissions or physical devices.
The File fixture is eight seconds: subsequent recording may see EOF/silence;
the infinite oscillator Stream fixture used for its 60-second run is different.
The original replay tests only the last short export. New trials replay each output
and inspect container streams with ffprobe; extension render wrappers are disclosed.
No production edits or monkeypatched recorder scheduling are permitted.

## Accounting

P = prior successful export bytes; D = admitted delivered active encoded bytes;
E = incoming event bytes; S = soft new-session Stop threshold; H = aggregate
admitted payload limit; C = retained nonempty chunk references; R = intended final
reserve; T = optional elapsed duration threshold. Units are bytes, count, and ms.
Require checked nonnegative safe integers for every finite value and sum, including
zero events (ignored only after validating counters). Whole-event admission is
`P + D + E <= H` and `count + 1 <= C`; rejected events never append. This cannot
prevent the browser from allocating the incoming Blob. Preserve P on rejection.
After an admitted crossing `D >= S_effective`, request Stop exactly once.
`S_effective = min(S, H - P - R)` using checked subtraction. If available space is
<= R, reject Start preserving P. Very small positive space may warrant an explicit
minimum useful-session admission decision; do not invent an undocumented ceiling.
R is headroom, never a bound on native final delivery or crossing-event size.
P+D measures distinct logical encoded payload; candidate Blob/URL/chunk sharing,
physical copies, native backlog, frame buffers and GC are separate unknowns.

Elapsed uses monotonic performance.now independently of RAF. Capture elapsed ends
at Stop request; stop-to-terminal is the authoritative stop event minus request.
Event gaps include start-to-first and consecutive data events; final event is the
last delivered data event including zero. Nonempty count excludes zero events.
Delivered total must equal successful export bytes. Final event can be delivered
before or after Stop request; retain timestamp relation rather than assuming tail.
Bitrate = export bytes * 8 / capture elapsed, descriptive sample statistic only.
Requested FPS/track settings are requests/metadata; measured render cadence and
ffprobe packet/frame observations are reported separately.

## Experimental resource guards (not proposed product limits)

Extension trials predeclare maximum 96 MiB delivered per session, 192 MiB old+new,
2,000 nonempty events, 1.5 GiB summed descendant RSS, 6 GiB cgroup memory.current,
and minimum 512 MiB host MemAvailable; wall duration bounded per scenario. Check
native data events and host metrics once per second. On guard crossing request
ordinary Stop, preserve reports and stop subsequent trials. A delivered event may
already exceed a guard before it is observed. Host RSS sums double-count shared
pages; cgroup memory includes other workspace work. Neither is recorder attribution
or a process peak guarantee. A diagnostic-only 15s terminal wait aborts the browser
and marks trial unsuccessful; it is never a product watchdog proposal. No OOM,
forced GC, huge synthetic Blobs or high-resource experiment merely for coverage.

Fifteen-minute trial requires the preceding five-minute result to be complete,
replayed, <=32 MiB encoded, <=1.2 GiB summed RSS and no abort/page errors. Otherwise
record an omission and retain the five-minute evidence. Do not extrapolate bitrate
as a maximum. All captured files remain in work/ and are represented by hashes.

## Execution dispositions and isolation follow-up

Stage A ran the original diagnostic byte-for-byte on Chromium 151.0.7922.173.
Stage B used `native-initial.cjs` (saved exact executed source), six completed
workloads and one early guard abort. High-video VP8 crossed 1.5 GiB summed RSS
at 23.770s; native Stop settled, report `passed=false`, no replay/media extraction
was attempted for that guarded sample. Exit code alone is not the result: the
initial harness returned 0 on a guard abort; inspect `aborted`/`passed` in JSON.
Its planned C rows were halted and not executed in that browser. All raw evidence
is preserved in `native-stage-b-initial.json`.

After reviewing the guard, Stage C was separately authorized by the existing
assignment and run in a fresh browser using `N2_SCENARIO_IDS` to select only the
standard five-minute and conditional baseline fifteen-minute scenarios. Resource
limits were unchanged; no attempt to defeat the guard. Short standard trials had
stayed below it. The five-minute trial completed, but 97,086,560 bytes exceeded
the prerequisite 32 MiB for fifteen minutes. Fifteen minutes was omitted, never
marked passed. The five-minute peak sampled summed RSS was 1,168.2 MiB, below
its 1.2 GiB prerequisite, but payload alone disqualified continuation. A rough
threefold byte projection would exceed the diagnostic's 96 MiB per-session guard;
that arithmetic is a justification for omission, not a maximum-bitrate prediction.

`native.cjs` adds only scenario selection, executed-source hash and clearer omitted
rows after guard to the initial diagnostic. It is the exact Stage C executed source.
Both variants use the same capture/observation path. Their render wrapper times
existing VisualizerRuntime.render calls and counts cadence; it does not replace
rendering or inject frames. Saved gap/cost distributions describe instrumented
rendering. ffprobe packet counts are reported as a rate proxy, not claimed decoded
frame counts. The N.1 downloaded last export also receives ffprobe decoded-frame
inspection; other Stage A exports have event/final MIME evidence only.

An additional positive control serves the built artifact byte-for-byte, with no
symbol exposure, MediaRecorder/URL/render wrappers or synthetic mediaDevices. It
uses File input, UI Start/Stop/Download and ffprobe decoding. This checks the ordinary
unmodified recording path; it does not establish that instrumentation has zero
performance cost or quantify a performance correction factor.

Full host samples, native event ledgers, scene settings, render timings, MIME fields,
container stream metadata and hashes are retained. Raw files are UTC observations;
user-facing work date is October 14, 2026 in America/Los_Angeles. Resource-safety
and browser/device gaps remain explicit. No video/audio payload is committed.

During normalization, one guard-path instrumentation limitation was identified:
the helper reads its field named `overlap.P` after a host guard may already have
completed Stop. In the guarded high-VP8 row that field is the just-completed export,
not a prior export. Every primary B/C workload starts in a fresh page with no prior
export; normalized primary P is therefore correctly 0, established by fixture
construction. The raw value is preserved and is not added a second time to D.
This correction does not alter event bytes, the guard outcome or candidate values.
D's separate active replacement snapshots are taken before manual Stop and retain
their actual measured previous-export values.
