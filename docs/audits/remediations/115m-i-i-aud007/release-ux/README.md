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

## Observed validation on v0.1.15m.i.k

The required sequence ran in order: `npm ci`, `npm test`, `npm run build`,
`python scripts/verify_distribution.py`, `git diff --check`. All pass. Full suite:
**937 total / 936 passed / 0 failed / 1 existing opt-in AP_MILLION_STRESS skip**.
There are **46 new permanent tests**: 12 application preferences, 24 admission,
9 controls and 1 native-rejection/active-recorder Scrubber regression. Updated
legacy Scrubber fixtures now supply valid File size/bounded slice metadata and
actual DOM listener removal; their ownership/seek assertions remain intact.

| Check | Observed result |
| --- | --- |
| Focused waveform/application/controls/coordinator/policy/metadata/seek suites | 144/144 assertions |
| New hostile integration controls | 6/6: encoded admission bypass, PCM admission bypass, repeated probe work, wrong-source manual action, stale-duration activation, premature probe-slot release |
| Accepted hostile controls, unchanged assertions/mutations | I.2A 7/7; I.2B 7/7 |
| New native Chromium production integration | 17/17 runnable cases; one separate direct-file environmental block |
| I.2A protected native | 12/12 |
| I.2B native calibration and pure-policy compatibility | 8/8 |
| F.6 native source/recorder ownership | 21/21 |
| G integrated / focus / targets / numeric | 13/13 / 38/38 / 31/31 / 27/27 |
| H.1 native DOM idempotence/recorder/EOF | 9/9 |
| Protected scope | All 58 previous AUD-007 files byte-identical; independent owners unchanged |

Negative controls use isolated copies outside normal test discovery, require an
original positive pass and intended ERR_ASSERTION failure, and reject harness
crashes as success. I.2A's temporary fixture alone is adapted to copy CONFIG's
new extractor dependency; original accepted scripts, seven mutations and
assertions remain unchanged. The native read-only adapter changes version/path,
Scrubber observation symbol, H's existing RAF wait and hash provenance; I.2B's
old “unconnected policy” label now describes pure evaluation's lack of side
effects. Production admission remains active. No source test hooks ship.

Chromium **151.0.7922.173**, Linux headless, native media/OfflineAudioContext and
MediaRecorder. Portable HTML served alone, hosted root and hosted nested path all
play/seek/generate. At 390×844, touch/keyboard popover bounds, focus return and
1,000 unchanged Scrubber draws produce zero status/time/announcement mutations.
Screenshots are in evidence. Native/hosted inputs and all protected rechecks
agree on the portable SHA-256 below; the evidence collector asserts equality.

- Portable HTML: 448,237 bytes; SHA-256 `0b39d811ca8c7bb2a017f6d71743f7b02d5b86faf939f4c126f1cdfce6f2c375`.
- Hosted index: 447,068 bytes; SHA-256 `7aac7b497b43f3b0c0298f7787498e3196236610968185b758061849f9f49409`.
- Two-second six-channel PCM WAV: 1,058,444 encoded bytes, one 65,536-byte probe;
  native 88,200×6 frames/channels at 44.1kHz = 2,116,800 PCM bytes. First peak 0,
  final peak 0.89996337890625 from the sixth-channel terminal impulse.
- Actual six-channel Opus: 19,417 encoded bytes; estimate 707,896 bytes using
  configured stereo fallback; native output 2,116,776 bytes (88,199×6×4).
  Underestimate **1,408,880 bytes**. Confidence remains estimated in the UI.
- Synthetic nine-minute/one-hour metadata inputs are applied to small real MP3
  fixtures. The hour estimate refuses without a full read/native decode while
  actual native playback and seeking continue. Oversize encoded-input metadata
  refuses even the prefix probe. No hour-long PCM/large backing allocation.
- Held native prefix A→B→C performs probes A/C only, full extraction C only;
  maximum outstanding probes/reads/decodes each one. Native delivery holds are
  explicitly distinct from underlying completion or physical reclamation.
- A deliberate 16-byte invalid input to only the optional native decoder causes
  genuine decodeAudioData rejection while valid File playback/seek and active
  MediaRecorder continue. The observed native export is 31,255 bytes. Separate
  refusal capture and File changes also export successfully. Existing locks on
  live-source switching during recording remain protected.

Final-head Ubuntu and Windows CI is verified after publishing the final evidence
commit and linked in the draft PR/handoff; intermediate CI is not substituted.
No tracked distribution/dependency/lockfile change. Successful logs, native
observations, source digests, small fixture hashes and attempt corrections are
in [validation.json](validation.json) and [evidence](evidence/).

## Reproduction and evidence limits

Use the documented repository toolchain and standard install/build first. Native
Chromium, Playwright and ffmpeg are environment tools, not application dependencies.
Create the small codec fixtures, then run the new diagnostics and protected
read-only adapter. The scripts write review evidence under work/ by default:

```sh
mkdir -p work/f-exports
ffmpeg -hide_banner -loglevel error -f lavfi -i 'sine=frequency=440:duration=8:sample_rate=44100' -ac 2 -codec:a libmp3lame -y work/stereo.mp3
ffmpeg -hide_banner -loglevel error -f lavfi -i 'sine=frequency=440:duration=2:sample_rate=48000' -ac 2 -codec:a libopus -y work/stereo.ogg
ffmpeg -hide_banner -loglevel error -f lavfi -i 'sine=frequency=440:duration=2:sample_rate=48000' -ac 6 -codec:a libopus -y work/surround.ogg
node --test --test-isolation=none tests/application-preferences.test.js tests/waveform-admission.test.js tests/waveform-controls.test.js tests/waveform-coordinator.test.js tests/scrubber-coordinator.test.js tests/waveform-policy.test.js tests/waveform-metadata.test.js tests/scrubber-waveform.test.js tests/scrubber-drag-ownership.test.js
python docs/audits/remediations/115m-i-i-aud007/release-ux/negative-controls.py work/i2c-negative-controls.json
node docs/audits/remediations/115m-i-i-aud007/release-ux/native.cjs work/i2c-native.json
node docs/audits/remediations/115m-i-i-aud007/release-ux/recheck.cjs i2a work/i2a-native.json
node docs/audits/remediations/115m-i-i-aud007/release-ux/recheck.cjs i2b work/i2b-native.json
node docs/audits/remediations/115m-i-i-aud007/release-ux/recheck.cjs f --output "$PWD/work/f-native.json" --export-dir "$PWD/work/f-exports"
# Repeat modes g/g1/g2/g3 with --output; h takes the output as a positional argument.
python docs/audits/remediations/115m-i-i-aud007/release-ux/scope-check.py
python docs/audits/remediations/115m-i-i-aud007/release-ux/collect-evidence.py
```

Original portable `file://` navigation with networking offline is **blocked by
Chromium administrator policy: ERR_BLOCKED_BY_ADMINISTRATOR** before document
execution. This is not successful direct-file evidence; no policy bypass was
attempted. Portable-over-localhost and both hosted paths pass. This remains an
evidence limitation for independent review/I.2D and applicable Build 115N gates.

Mic uses Chromium fake hardware; controlled Stream refusal and native delivery
holds retain their explicit limitations. Codec evidence covers these MP3/Opus/WAV
fixtures, not universal codec/platform support. Physical devices, other browser
engines, device-memory calibration, native scratch/RSS and immediate native/GC
reclamation are not established. No user-facing or maintainer claim of bounded
whole-browser memory is made.

No I.2D final acceptance, merge, shipment or Build 115N promotion is performed.
Independent review must assess policy/metadata/manual identity, shared-slot
settlement, UI/persistence semantics, compressed estimates and the remaining
direct-file evidence limitation. AUD-007 stays open until that review and I.2D.
