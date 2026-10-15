# Recording Resources settings and storage

`recording-policy.js` owns application policy selection and persistence separately
from Scene `preferences`/`runtime.settings`, waveform application settings, presets,
schema 10 and URL fragments. CONFIG owns all factory policy and legal domains.
The focused `recording-resources.js` controller is the only writable UI owner;
its collapsible subsection lives in the existing Record Settings area. Existing
Include Audio, Preferred Format and FPS controls retain their positions/meaning.

Local-storage key: `auralprint.recording-resources`. Format version: 1.

```json
{"version":1,"profile":"custom","custom":{"softBytes":130000000,"aggregateBytes":270000000,"maxChunks":1200,"durationMs":300000,"warningFraction":0.8}}
```

Profiles: balanced/custom/unrestricted. Custom S/H/C/T fields accept positive safe
integers in bytes/references/milliseconds or null for Off. Warning is 0.8 or null.
Custom R is derived, never persisted: min(10,000,000, floor(H/10)), at least 1 byte;
H must exceed R and enabled S must fit H-R. R is inactive when H is Off. Unknown
record fields are stripped; missing/invalid required fields or unknown version
reject the entire stored selection. Startup uses factory defaults with a visible
invalid/unavailable message and does not overwrite the record. There is no silent
migration across unknown versions; future changes need an explicit reader/migration.

Valid writes apply immediately to the next Start, even when saving fails. A failed
save is visibly session-only, including Unrestricted; it is never replaced while
claiming success. Refresh/reload can only restore successfully persisted settings.
No Blob, URL, session token, source/device permission or recording metadata is saved.
No dependency was added. Reset Recording Resources writes factory selection and
Custom defaults through the same honest persistence path. Scene Reset All Settings
retains its established Scene ownership and does not reset this record.

Custom inputs are drafts until Apply Custom Limits. Invalid Apply leaves the last
valid selection effective, preserves the draft/focus and associates inline feedback
with input aria-invalid/aria-describedby. Profiles and factory Reset apply directly.
During capture the UI distinguishes next Start selection from the frozen active
policy. Progress does not rewrite draft controls. Listener ownership is idempotent
per root element. Telemetry uses existing recorder refresh and guarded text writes;
warning categories latch once per session and the elapsed clock is not a live region.
Cancel remains visible in the sticky action area while finalizing and after panel
hide/reveal; settled cancellation moves focus to the retained Download or Start.
