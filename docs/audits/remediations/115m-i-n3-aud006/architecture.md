# Architecture and changed interfaces

Classification: authorized Build 115 feature/corrective implementation for October
9 AUD-006. Risk surface: CONFIG, independent application settings, recorder native
lifecycle/ownership, canonical recording runtime and Record UI. Schema 10,
waveforms, simulation, analysis, renderer scheduling and source-graph owners are
unchanged. No dependency or new full-screen Settings system is introduced.

| Owner | Interface and responsibility |
| --- | --- |
| `CONFIG.recordingResources` | Frozen factory S/H/R/C/T/W, profile IDs, safe integer input domain, reserve divisor, storage key/version |
| `recording-policy.js` | `validateSelection`, `resolveRecordingPolicy`, `prepareRecordingPolicy` pure functions; `createRecordingPolicySettings` owns local state/storage; singleton `recordingPolicySettings` supplies production next-Start policy |
| RecorderEngine | `start/stop/cancel/reset/dispose`, support/options and transport interfaces; additive `createRecorderEngine` creates isolated test engines, production keeps singleton |
| RecorderEngine init | Existing taps/clock/config/stateRef, plus explicit `getPolicy` injection for isolated diagnostics; production uses application-policy singleton |
| `state.recording` | Session policy, delivered/admitted/rejected byte/event totals, retained chunks, P, primary/secondary Stop reason, outcome, final size, warnings, nativeShutdown and recorderEnabled |
| `recording-resources.js` | One focused controller per DOM root; configuration, inline validation, persistence copy and progress; pure `recordingResourcePresentation` projects telemetry |
| `ui.js` | Existing coordinator/locks/deferred EOF/workspace; dispatches Cancel and projects durable automatic reasons; guards recorder action listeners from duplicate registration |

CONFIG → independent application selection → frozen session policy → recorder
runtime → canonical recording diagnostics → UI. DOM input drafts become policy
only through validated Apply. Scene CONFIG → preferences → runtime.settings remains
unchanged. The assignment explicitly authorizes this independent persistence domain;
recording policy is not a new schema-10 preference or migration.

Sessions acquire authority before native Start. Native Stop latch, phase and reason
are published before calling stop. Terminal settlement invalidates authority before
required cleanup. Pending storage is cleared separately from final diagnostics.
The native event identity WeakSet is weak, session-local and does not retain chunks
or impose a new capacity ceiling. Invalid safe-integer accounting is a technical
failure in all profiles. R/H are inactive in Unrestricted.

Required cleanup failure is latched across acquisition as well as terminal cleanup;
a later empty cleanup cannot turn an earlier owner failure into success. At most
one unresolved ownership tombstone is retained, fenced and page-lifetime blocked.
No upstream fallback, automatic watchdog, encoder optimization or disk-streaming
architecture is added.
