# Build 114 Spec — Live Input Sources

Status: Phase 0 planning baseline  
Target build: `v0.1.14` / Build `114`

## 1. Purpose

Build 114 extends Auralprint from a file-playback analyzer into a multi-source analyzer that can operate on:

- file playback
- microphone input
- display/tab/system stream input when supported by the browser

This build must preserve the canonical Build 113 user experience for file playback while adding live-input capability as a first-class runtime mode.

## 2. Canon anchor

Build 113 established these stable truths which 114 must preserve:

- file playback remains the strongest and most polished path
- queue, scrubber, repeat, previous, next, and duration semantics are file-mode concerns
- recording is a read-only tap on the existing render/audio path, not a competing pipeline
- runtime-only state must not leak into URL presets unless explicitly designed
- source changes must not leave stale audio graphs, stale listeners, stale visual state, or zombie streams

## 3. Build goal

Introduce a unified input-source layer that allows the existing analyzer / render / recorder path to run against:

- file playback
- microphone capture
- display capture / tab capture / system stream capture

without forcing live sources to pretend to be tracks.

## 4. Scope

### In scope

- explicit source selector UI: `File / Mic / Stream`
- microphone input activation
- display/tab/system stream activation when available
- browser capability detection and honest unsupported-state messaging
- permission request flow and denial handling
- full teardown when changing sources
- clean analysis-state reset on source switching
- preservation of Build 113 file workflow
- runtime-only state for live-source session and permission details

### Out of scope

- audio device picker UI
- persistent preferred microphone/device selection
- simultaneous multi-source mixing
- storing active live-source state in URL presets
- fake queue items for mic/stream
- advanced stream routing or multi-input mixing
- source-specific saved presets

## 5. Product rules

### 5.1 Source is explicit runtime state

The app must always know which source kind is active:

- `none`
- `file`
- `mic`
- `stream`

This must be explicit runtime state, not inferred from the presence of a media element or stream object.

### 5.2 Only one active source at a time

Auralprint may analyze one active source at a time. Source switching must fully tear down the old source before activating the new one.

### 5.3 Live sources are not tracks

Mic and stream modes must not pretend to support file transport semantics.

In non-file modes, the UI must not imply:

- queue position
- track duration
- scrub seek capability
- repeat / shuffle semantics
- previous / next track semantics

### 5.4 Recording stays a passive observer

The recording system must continue reading from the canonical render/audio taps. Build 114 must not create a second playback path or let recording become a transport owner.

### 5.5 Live state remains runtime-only

The following must not be written into URL presets:

- active source kind
- browser permission results
- stream handles or track labels
- live-session error state
- active stream lifetime details

## 6. Architectural target

Build 114 introduces an input-source abstraction, owned by the audio layer, that presents a stable contract to the rest of the app.

### 6.1 New logical subsystem

Recommended new module:

- `src/js/audio/input-source-manager.js`

Recommended responsibilities:

- own source kind transitions
- activate/deactivate file/mic/stream sources
- expose source capabilities and source status
- centralize teardown of media streams / tracks / listeners / nodes
- provide source descriptors for the existing analyzer path

### 6.2 Existing systems that should consume, not own, source selection

- `audio-engine.js`
- `ui.js`
- `recorder-engine.js`
- `scrubber.js`

## 7. Required runtime model

Recommended runtime state additions under `state`:

```js
source: {
  kind: "none",          // none | file | mic | stream
  status: "idle",        // idle | requesting | active | stopping | error | unsupported
  label: "",
  errorCode: "",
  errorMessage: "",
  capability: {
    mic: null,
    stream: null,
  },
  permission: {
    mic: "unknown",
    stream: "unknown",
  }
}
```

Notes:

- This is runtime-only state.
- Do not mirror this into `preferences`.
- Do not serialize this in URL presets.

## 8. UX rules

### 8.1 Source selector

Add a visible source selector in the operator-facing audio surface.

Minimum options:

- File
- Mic
- Stream

### 8.2 File mode UI

File mode retains:

- load
- queue
- previous / next
- repeat
- shuffle
- scrubber decode / preview / seek
- track filename and time readout

### 8.3 Mic mode UI

Mic mode must:

- show honest status text
- disable or hide file-only controls
- avoid fake timeline language
- avoid queue semantics

Suggested status copy examples:

- `Waiting for microphone permission`
- `Microphone active`
- `Microphone permission denied`
- `No microphone available`

### 8.4 Stream mode UI

Stream mode follows the same honesty rule as mic mode.

Suggested states:

- `Waiting for stream selection`
- `Display stream active`
- `Display stream ended`
- `Display stream capture unavailable`

## 9. Source-switching contract

Every source transition must run the same conceptual sequence:

1. mark source as switching/requesting
2. stop and detach the previous source
3. stop old stream tracks where applicable
4. disconnect old nodes and listeners
5. clear source-specific UI state
6. reset transient analysis / visual state safely
7. attach the new source
8. update runtime source state
9. restore the analyzer/render loop through the canonical path

## 10. Permission/error policy

Build 114 must normalize browser/API failures into a small internal error vocabulary instead of scattering ad hoc error strings.

Recommended internal codes:

- `unsupported`
- `permission-denied`
- `permission-dismissed`
- `no-device`
- `stream-ended`
- `stream-without-audio`
- `activation-failed`
- `switch-aborted`

The UI may surface human-readable copy, but state and tests should prefer codes.

## 11. Build 114 milestones

### 114-A — Source model and switching seams

- add runtime source model
- add source-manager abstraction
- preserve file mode
- no visible feature required yet beyond no-regression scaffolding

### 114-B — Microphone activation

- wire microphone mode
- feed analyzer path cleanly
- handle permission denial and teardown

### 114-C — Display/tab/system stream activation

- wire display capture where supported
- handle external stop events
- handle missing audio gracefully

### 114-D — UX completion

- source selector polish
- honest control disabling/hiding
- polished operator-facing status copy

### 114-E — Hardening

- switching stress pass
- recorder interaction audit
- test coverage for source transitions
- regression check against file mode

## 12. Definition of done

Build 114 is done when all of the following are true:

- File mode still supports the full Build 113 workflow.
- Mic mode can be activated, analyzed, and torn down cleanly.
- Stream mode can be activated when supported and fails honestly when unsupported.
- Switching between sources leaves no stale analyser graph, listener duplication, or zombie stream tracks.
- Source switching resets analysis state safely.
- Queue/scrubber controls are not misrepresented in live modes.
- Recording still functions as a passive tap on the canonical render/audio path.
- URL presets remain free of live runtime state.
- No new console errors appear in normal flows.

## 13. Non-negotiable guardrails for agent work

Agents implementing Build 114 must not:

- rewrite queue semantics unless required by source-mode gating
- persist live-source state in presets
- represent live sources as queue entries
- create a second recorder-owned playback path
- hardcode browser-specific assumptions about display-capture audio availability
- spread permission handling across unrelated modules without a central state contract

## 14. Success condition

The success condition for Build 114 is not merely “mic works.”

The real success condition is:

> Auralprint can switch cleanly between file playback and live inputs while preserving the project’s existing truth model: honest UI, stable runtime ownership, passive recording, and strict separation between runtime session state and shareable preset state.
