# I.2C waveform admission and release UX

Starting accepted remote main: `56f8f8e805d0a10ba7df7f155d153c7d25e00f9d`.
The baseline gate verified accepted PR #50/#51/#52 heads as ancestors, all five
required production modules, and `v0.1.15m.i.j`. The local cached remote was stale;
fetch through the configured proxy with authorized network execution synchronized
it before creating `codex/115m-i-i-aud007-release-ux` directly from current main.

This is the authorized Build 115 AUD-007 integration feature. Impact surfaces are
CONFIG, optional audio work and Audio/Scrubber controls; primary regression risks
are stale identity, false resource release and repeated DOM/listener work. Scene
schema 10, playback/source/recorder ownership and previous evidence are protected.
AUD-007 remains open, I.2D is separate, and Build 115N remains WITHHELD.

## Independent application preferences

`src/js/core/application-preferences.js` owns the small synchronous localStorage
contract. Key `auralprint.waveform-preferences`, JSON version **1**:
`{version:1, selectedProfileId:"8m", aboveProfileBehavior:"ask"}`.
Only the two selected IDs persist. Resource ceilings and track/job/buffer data
never enter storage. CONFIG.waveform owns choices/defaults; application runtime
settings contain the validated effective selection. Unknown versions revert to
both current defaults; invalid/obsolete fields individually revert to their
CONFIG defaults. Malformed JSON, denied reads/writes and quota failures leave
usable in-session selections. No IndexedDB, scene field, URL codec or migration
change. Scene Reset Preferences cannot reach this independent store. Version 1
is not preset schema 1; future incompatible local shapes require a new version.

> Removing or bypassing the waveform governor without equivalent resource
> admission and concurrency guarantees reintroduces AUD-007.

## Admission and metadata ownership

Scrubber owns one `createWaveformAdmission` bridge and its one I.2A coordinator.
UI.loadAndPlay still owns activation, Queue entry and request identity; it passes
an `isCurrent` predicate plus exact media reference to Scrubber.loadFile's optional
second argument. Current File/media/source/request/Queue identity is checked at
probe settlement, before extraction, after full read and before manual admission.
The bridge never calls transport, seek, recording or source APIs.

Narrow coordinator extension: optional constructor `prepare(file,{isCurrent})`
runs inside its existing occupied slot before extraction. `request(file,options)`
accepts an external `isCurrent` predicate and `canDecode` admission revalidation.
Existing one-argument callers retain I.2A behavior. Prepare's actual settlement,
including rejection, is required before release; Reset does not release it. This
serializes prefix work with full reads/native decode and uses the same one latest
pending intent. No second queue, probe scheduler, timeout/race or frame-loop work.
Offer/defer/refuse release the probe slot immediately upon actual settlement and
do not reserve a decoder while waiting for user input or duration. The extractor
now reads the unchanged 44.1kHz/512 output settings from CONFIG and checks optional
`canDecode` after full-read settlement before creating a native context.

The bridge first evaluates cheap size/policy gates before even File.slice. Once
scheduled, it probes at most one CONFIG-bounded prefix per current request
(factory 65,536 bytes / 128 chunks), then evaluates the accepted I.2B policy with
current duration and the immutable scalar header result. That result is reused
for settings refresh/manual generation. One current media owns exactly three
listeners (loadedmetadata, durationchange, error); replacement/Reset removes all
three. A stale unabortable prefix still occupies the coordinator slot until it
settles, but cannot activate old work. Repeated same-File selections are distinct
generations. The current request alone retains its File and small metadata; no
history/cache or encoded/PCM/peak persistence.

Missing duration waits for current-media events, without a timer/retry loop or
held native slot. Invalid/infinite duration and contradictory supported WAV
metadata refuse. Unsupported containers and rejected probes can use known media
duration plus the explicit CONFIG estimated channel fallback; no stronger evidence
is invented. An error with missing duration becomes unavailable. A decoder/read
failure is terminal for that intent; later File requests can recover after actual
settlement. Native decoding has no per-call cancellation. Indefinitely unsettled
work can indefinitely delay optional waveforms; playback stays independent.

## Release controls and manual generation

Audio's existing Scrubber row gains a compact Waveforms options button and a
contextual Generate button. A small non-modal auto popover holds the application
settings, current status and full Generate waveform action; no new Audio row or
Scene/preset control. CONFIG profiles supply IDs and approximate-minute labels;
CONFIG supplies exactly Ask / Generate automatically if permitted / Skip labels.
Stock default is 8m / Ask. Profiles measure stereo-equivalent PCM workload;
9-minute mono may fit 8m, while multichannel work can exceed a shorter profile.
Skip is the accepted above-profile behavior, not a hard resource override.

Native popover provides mouse/touch dismissal, Escape and keyboard navigation;
a small non-modal fallback handles browsers without popover support. Labels,
focus transfer when an action disappears, a separate polite live announcement
(outside the closed popover), current status and launcher tooltip make state
observable. Repeated unchanged refreshes compare text/properties before writes.
Controls dispose old listeners on reinitialization. Scrubber interaction listener
replacement is idempotent; seeking, time display and peak styling are preserved.

Generate revalidates current UI request/Queue/source/media identity and fresh
metadata/hard ceilings, sets manual intent only after an admit decision, and
requests the same coordinator. Repeated clicks during queued/probing/decoding work
do nothing. The action disappears immediately during work or track change. A busy
slot states that the previous operation must actually settle. Hard refusals show
a concise reason and no Generate action. Manual skips only the automatic workload
profile, never maxEncodedBytes or maxEstimatedDecodedPcmBytes. No ordinary UI
control disables these limits.

CONFIG source customization is intentional expert control: rebuild after changing
profiles/defaults, decode output rate, metadata probe bounds, fallback channels,
or either hard ceiling. Valid source ceilings take precedence without a hidden
factory cap. Application storage selects choices only. Default ceilings are
67,108,864 encoded bytes and 536,870,912 estimated PCM bytes. These bound admission,
not total browser memory. Native scratch, source-rate resampling, playback,
recordings, metadata inaccuracies and delayed GC remain outside that estimate.
Compressed media can hide multichannel content behind a stereo estimate; six-
channel Opus coverage cannot be called verified. Unsupported/ambiguous headers
use the documented estimate only with known valid duration. Contradictory
supported WAV metadata cannot silently shrink to stereo.
