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
