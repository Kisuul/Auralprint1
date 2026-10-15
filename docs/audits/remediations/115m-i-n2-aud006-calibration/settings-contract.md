# Proposed Settings and Record panel contract

Specification only; no approved UI, fields, persistence or production governor.
Build 115N remains WITHHELD. Schema 10 and root version stay unchanged.

## Ownership and profiles

Settings → Recording Resources owns configuration. Record owns current-session
telemetry, operation status, export availability and recovery. Preserve Workspace's
independent hide/restore/launchers, stacking and focus ownership; do not create a
second configuration owner in Record. Portable and hosted builds share semantics.

| Profile | Proposed behavior |
| --- | --- |
| Balanced | Uses explicitly approved CONFIG factory S/H/C/R/T. Shows a short bounded-interactive-use explanation and effective limits. Capacity crossing requests orderly Stop; admitted tail may exceed soft threshold. Factory candidates in this package are not approval. |
| Custom | CONFIG-owned validated field definitions/ranges, values in a separate application-policy preference domain. Expert users may change limits or explicitly disable optional S, H, C or T where approved. Snapshot on next Start, never retroactively change active admission. Show pending changes while recording/finalizing. |
| Unrestricted | Explicitly disable application S/H/C and automatic T; no hidden fallback numeric budget. Keep representable nonblocking measurements, technical invalid/overflow checks, session/callback authority, error settlement, previous-export ownership and terminal cleanup. Browser/OS/storage/JavaScript limits remain. |

Balanced's default display is profile, an understandable summary, and optional
Details. Custom reveals soft new-recording size, aggregate old+new encoded size,
chunk-reference count, duration enabled/value, and warning behavior. Use MiB with
exact byte conversions in Details, seconds/minutes for duration, integer chunks.
Clearly distinguish Off from zero; zero is invalid for enabled positive limits.
Do not describe any of these as available RAM or a physical memory cap.

## Validation and reserve

Validate strict safe integer values, types and unit conversions before persistence
or Start; reject invalid edits with associated inline accessible error and preserve
the prior valid policy. Validate enabled S/H/R relationships with checked arithmetic:
`0 < R < H`, `0 < S <= H-R` when both S and H enabled, `C >= 1`, `T > 0` when enabled.
With H disabled, R is inactive and must not become an alternative aggregate ceiling.
With S disabled and H enabled, only admission protects retained logical payload;
warn that capture may fail at H instead of completing early. With C disabled,
state that reference growth is unrestricted by application policy. Partial disabling
is an explicit Custom capability subject to human authorization, never ambiguous 0.

Recommend derive R from the approved factory calibration/headroom policy and expose
its current bytes in Details. An expert “Final-delivery headroom” override is more
understandable than a fourth prominent size slider. If approved for Custom, show
its relationship to the aggregate budget and make it editable as bytes with the
same validation; do not imply a guaranteed final-event maximum. Changing R alone
cannot bound final native output. R is inactive in Unrestricted.

At Start compute `S_effective = min(S, H-P-R)` when S/H enabled. If `H-P <= R`,
refuse the new session, preserve the previous download, and explain available
headroom. If P already exceeds H, same outcome; never evict P to make admission
fit. Positive but tiny effective thresholds can start/stop immediately: propose a
warning, or a separately approved minimum useful-session rule, not a hidden one.
Show effective threshold when it differs from the selected soft setting.

## Persistence proposal requiring implementation review

Persist only the resource-profile choice and validated Custom controls in a dedicated
local application-settings record, separate from Scene preferences, URL hashes,
preset encode/decode and migration. CONFIG owns definitions/defaults; a future
application-settings resolver derives active recorder policy separately from
Scene `runtime.settings`. Do not insert recorder fields into schema-10 preferences.
Choose a namespaced local-storage key, independent storage version/migration,
unknown-field policy, startup fallback and reset scope in the implementation review.
Storage unavailable/corrupt: use explicit approved factory fallback and disclose that
changes cannot be saved; do not silently reload Unrestricted as Balanced or write
into Scene presets. During an active session, show saved-next-session choice and
the frozen active policy distinctly. Local storage never persists recordings,
object URLs, permission grants, pending bytes or session authority.

## Warning proposal

Balanced/Custom: one nonblocking warning at 80% of effective soft threshold,
80% of H including P, 80% of C and 80% of enabled T; update readable progress,
avoid repeated live-region announcements. 80% is a UI lead-time proposal, not an
empirical risk percentile. At unusually fast growth, warning may coincide with
Stop or failure. Background timer throttling can postpone notices and duration
Stop. Warn for dimensions, DPR, requested FPS, codecs, scenes, devices or durations
outside the tested envelope; do not imply being inside guarantees survival.

Unrestricted activation copy: “Automatic recording size, chunk and duration limits
are off. Browser, device and storage limits still apply. A crash can lose the
current unsaved recording. Your previous completed export stays available until
a replacement succeeds.” Use a clear explicit choice and persistent compact badge;
no mandatory blocking warning on every Start unless human review chooses it.
Warning preference can suppress optional notices, never hide terminal errors,
active policy, automatic-stop reason or shutdown-unconfirmed state.

## Record panel observables

| Situation | Required projection |
| --- | --- |
| Recording | Monotonic elapsed time; delivered encoded bytes; admitted bytes if different; P; effective S, H, C and T or Off; progress with units; previous Download enabled. |
| Threshold crossing | Durable `capacity-stop` or `duration-stop`; “Stopping at configured limit”; request once; preserve reason during native finalization. |
| Finalizing | Clear pending state, frozen Stop-request elapsed plus separate finalization wait; previous Download and Cancel Current Capture accessible. |
| Successful capacity completion | “Completed at recording size limit”; final output size may exceed S; new Download available; previous URL revoked only after replacement commit. |
| Failed new capture | Specific failure and “Previous export preserved”; current failed chunks discarded; never offer arbitrary truncated data as a valid file. |
| Shutdown unconfirmed | “Current capture aborted; native shutdown unconfirmed. Recording disabled pending recovery.” Primary transport usable after application abort; previous Download works. |
| Preserve-export cancellation | Explicit “Cancel Current Capture” distinct from Stop/Dispose; warn current unsaved capture is discarded; previous export stays. |

Counters are canonical runtime diagnostics, not inferred from DOM/timer ticks.
Keep received/admitted/rejected totals and final reason separate from cleared
pending storage. Aggregate uses distinct logical P+D; assembly may temporarily
hold P/chunks/candidate with implementation-dependent physical storage sharing.

Use labelled controls, visible keyboard focus, inline error association, and a
polite status live region with rate-limited updates. Operation changes retain
focus on the owning action or an established Record focus destination. Error and
cancel actions must remain reachable in a narrow/hidden-restored panel. No
per-frame rebuilding, duplicate listeners or focus stealing on telemetry updates.
