# Build 114 Specification — Live Input Sources

## Status

Planned target: **Build 114 / v0.1.14**

This document is the implementation contract for Build 114. It turns the roadmap theme "Live Input Sources" into concrete engineering rules, UX rules, and acceptance criteria.

## Roadmap anchor

Build 114 adds analysis sources other than file playback:

- microphone input
- tab/system/display stream input when available
- source switch UI: `File / Mic / Stream`

Definition of done from the roadmap:

- permission failures handled politely
- source switching resets analysis state safely

## Build objective

Add a unified runtime source layer so Auralprint's existing analysis, render, and recording paths can operate against:

- file playback
- microphone capture
- display/tab/system stream capture

without degrading the Build 113 file workflow or corrupting preset/schema behavior.

## Product statement

Build 114 does **not** replace the file player. It adds live sources to the analyzer.

The correct mental model is:

> Auralprint is an analyzer with multiple input sources.  
> File playback remains the richest transport mode.  
> Live sources are first-class inputs, but they are not fake tracks.

## Non-negotiable invariants

### Preserve Build 113 truths

1. **File mode remains fully functional.**
   - Loading, queue, next/prev, shuffle, repeat, scrubber, and existing playback behavior must continue to work.

2. **Recording remains a read-only tap.**
   - Recording must continue to observe the active analysis/render path.
   - Build 114 must not create a competing playback or export path.

3. **Runtime-only state stays runtime-only.**
   - Live input permissions, live source session state, stream labels, and transient failure states are not stored in presets.

4. **Preset/schema integrity is preserved.**
   - No schema bump is required for runtime-only live input state.
   - Existing preset round-trip behavior must remain intact.

5. **Only one active source exists at a time.**
   - The app may support multiple source kinds, but it never analyzes more than one active source at once in Build 114.

6. **Source switching must be clean.**
   - Switching source fully tears down the old source before activating the new one.
   - No zombie tracks, duplicate listeners, dangling nodes, or stale UI.

### New Build 114 truths

1. **Source kind is explicit runtime state.**
2. **Transport semantics are mode-dependent.**
3. **Mic and Stream are not queue entries.**
4. **Unsupported capabilities are surfaced honestly.**
5. **Permission failure is a normal user path, not an exceptional crash path.**

## Scope

### In scope

- Explicit runtime source model
- Source switch UI with `File`, `Mic`, and `Stream`
- Microphone activation via browser media permissions
- Display/tab/system stream activation when browser support exists
- Safe source teardown and source switching
- UI status copy for permission, unsupported, active, and stopped states
- Clean analyzer reset / visual reset behavior on source changes
- Regression protection for file mode

### Out of scope

- Persistent preferred microphone/device selection
- Multi-source mixing
- Simultaneous file + mic + stream analysis
- Storing live source state in presets
- Full device picker UI
- Advanced routing matrix
- Timeline semantics for live sources
- Automatic fallback from one denied source type to another
- New visual features unrelated to source input

## Source model

Build 114 introduces an explicit source model in runtime state.

### Source kind

Allowed values:

- `none`
- `file`
- `mic`
- `stream`

### Source status

Allowed values:

- `idle`
- `requesting`
- `active`
- `stopping`
- `error`
- `unsupported`

### Recommended runtime shape

```js
runtime.source = {
  kind: "none",              // none | file | mic | stream
  status: "idle",            // idle | requesting | active | stopping | error | unsupported
  label: "",                 // short UI-facing label
  permission: {
    mic: "unknown",          // unknown | granted | denied | prompt | unsupported
    stream: "unknown"        // unknown | granted | denied | prompt | unsupported
  },
  support: {
    mic: true,
    stream: true
  },
  errorCode: "",
  errorMessage: "",
  sessionActive: false,
  streamMeta: {
    hasAudio: false,
    hasVideo: false
  }
};
```

This shape is illustrative, not mandatory. Equivalent structure is acceptable if ownership is clear.

## Architecture requirements

### New subsystem

Create a source-management layer responsible for activation, teardown, and capability detection.

Suggested file:

- `src/js/audio/input-source-manager.js`

### Responsibilities of the source manager

The source manager owns:

- source capability detection
- source activation requests
- source teardown
- stream-track stop handling
- source-kind/status updates
- normalized status/error reporting
- handing a valid upstream source into the existing analysis path

### Responsibilities it must not own

The source manager must **not** own:

- queue semantics
- scrubber rendering
- preset serialization
- renderer policy
- orb behavior
- recording UI policy
- long-term persistence

### Audio-engine relationship

The audio engine must stop assuming that the active analyzer input is always file-backed media playback.

It should instead consume a normalized "active upstream source" provided by the source manager.

### File mode remains special

File mode is still the only mode that naturally owns:

- queue
- scrubber
- duration
- next/prev
- shuffle
- repeat
- filename/track identity

Mic and Stream must not pretend to have those semantics.

## UI requirements

## Source switch

Build 114 must expose an explicit source switch in the UI:

- `File`
- `Mic`
- `Stream`

The switch must be visible enough to count as the feature, not buried as a hidden advanced toggle.

## Mode-specific UX rules

### File mode

File mode keeps:

- Load
- queue panel
- next/prev
- repeat
- shuffle
- scrubber seeking
- duration/time readout
- current track identity

### Mic mode

Mic mode must:

- disable or hide queue-specific controls
- disable or hide scrubber seeking
- not show fake duration
- surface honest state copy such as:
  - `Microphone input active`
  - `Waiting for microphone permission`
  - `Microphone unavailable`
  - `Microphone permission denied`

### Stream mode

Stream mode must:

- disable or hide queue-specific controls
- disable or hide scrubber seeking
- not pretend the shared stream is a track
- surface honest state copy such as:
  - `Display/audio stream active`
  - `Waiting for stream permission`
  - `Stream capture unsupported`
  - `Shared stream ended`

## Permission UX requirements

Permission and support outcomes must map to readable status copy.

The app must gracefully handle:

- browser does not support microphone capture
- browser does not support display stream capture
- user denies permission
- user cancels selection flow
- stream is granted without usable audio
- active stream ends externally
- microphone/stream teardown occurs during source switch

No raw exception dump should become the primary user-facing status text.

## Switching contract

When switching from any source to any other source, the app must follow this sequence:

1. mark current source as stopping
2. detach listeners from previous source
3. disconnect audio nodes associated with the previous source
4. stop previous stream tracks when the previous source is stream-backed
5. clear source-specific transient UI state
6. reset analysis/visual transient state as required
7. activate new source
8. set new runtime source state
9. refresh mode-specific UI affordances

This behavior must be reused both for user-initiated switches and externally terminated stream events.

## State reset requirements

Build 114 must reset transient analyzer/render state safely on source change.

At minimum, source switching must leave the app in a visually honest state:

- no stale trails implying old audio is still active
- no stale queue track highlighted while live source is active
- no bogus scrubber interaction when not in file mode
- no persistent "active recording" implication if no active source remains

Build 114 does **not** require resetting user preferences. It resets transient analysis/session state, not canonical user settings.

## Preset and schema rules

### Must remain runtime-only

The following must **not** be written into URL presets or preset JSON:

- `source.kind`
- `source.status`
- microphone permission state
- stream permission state
- active stream labels
- device/session identity
- active live session flags
- transient error state

### Schema

No schema bump is required unless a later change intentionally stores source-related preferences in a durable way. Build 114 should avoid that.

## Testing requirements

### Unit / targeted tests

Add targeted tests for:

- source state transitions
- source-manager teardown idempotence
- file → mic switch
- mic → file switch
- file → stream switch
- stream external end handling
- unsupported capability reporting
- preset serialization excluding live-source runtime state

### Regression expectations

Build 114 must not regress:

- file load/play/stop
- queue navigation
- scrubber interaction in file mode
- recording against file mode
- record panel status behavior
- existing preset round-trip behavior

## Acceptance criteria

Build 114 is complete when all of the following are true:

1. User can select `File`, `Mic`, or `Stream` as the active source mode.
2. Mic activation works when browser support and permission are available.
3. Stream activation works when browser support and permission are available.
4. Unsupported/denied cases return the UI to a recoverable state.
5. Switching sources does not leak listeners, tracks, or stale analyzer state.
6. File mode still behaves like Build 113.
7. Queue/scrubber controls are not misleading in live-source modes.
8. Live-source runtime state does not enter presets.
9. Recording still observes the active source path without becoming a second transport system.
10. No normal user flow produces console errors.

## Explicit non-goals for Codex

Codex should **not** use Build 114 as an excuse to:

- redesign queue architecture
- rewrite the renderer
- rewrite band distribution logic
- store live-source session data in presets
- turn Mic/Stream into pseudo-files
- add device-picker UX unless specifically asked
- add multiple simultaneous active sources
- change unrelated defaults

## Suggested file touch set

Primary expected files:

- `src/js/audio/audio-engine.js`
- `src/js/audio/input-source-manager.js` (new)
- `src/js/core/state.js`
- `src/js/ui/ui.js`
- `src/js/ui/dom-cache.js`
- `src/js/core/config.js`
- `src/index.template.html`
- `src/css/audio-panel.css`
- `tests/targeted-audit.test.js`

Possible secondary touch:

- `src/js/recording/recorder-engine.js`

Files that should stay mostly untouched unless clearly necessary:

- `src/js/audio/band-bank.js`
- `src/js/audio/band-bank-controller.js`
- `src/js/render/*`
- `src/js/presets/url-preset.js` (except to verify exclusion rules)

## Release note draft

Build 114 expands Auralprint beyond file playback by adding microphone and stream-based live input sources. The analyzer/render path remains unified, file mode remains the richest transport workflow, and live-source session state remains runtime-only.
