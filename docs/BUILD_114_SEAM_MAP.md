# Build 114 Seam Map

## Purpose

This document tells coding agents exactly where Build 114 work belongs.

Rule of thumb:

- **Interfaces are canon**
- **ownership boundaries matter**
- **Build 114 is an input-source milestone, not a renderer rewrite**

## Canonical intent

Build 114 adds:

- microphone input
- display/tab/system stream input when available
- source switch UI
- safe source switching
- polite permission handling

It does **not** re-architect everything.

## Ownership map

## `src/js/audio/input-source-manager.js` (new)

Primary Build 114 module.

Owns:

- source capability detection
- source activation for mic/stream
- source teardown
- stream track stop handling
- source status/error normalization
- active source kind/state transitions
- handoff of upstream active source into the analysis path

Must not own:

- queue logic
- scrubber drawing
- preset encoding
- render policy
- panel layout policy

## `src/js/audio/audio-engine.js`

Owns:

- audio graph assembly
- analyser attachment
- file-backed audio path
- connection of current active upstream source into the analyser/render/recording path

Build 114 changes allowed here:

- stop assuming the active source is always file-backed
- accept a normalized active source from the source manager
- keep file workflow behavior intact

Build 114 changes not allowed here:

- UI text policy
- preset policy
- queue UI ownership
- unrelated analyzer rewrites

## `src/js/core/state.js`

Owns:

- runtime-only session state

Build 114 changes allowed here:

- add explicit source runtime state
- add source status / error / support fields
- track active source kind and transient session information

Build 114 warning:

- do not let runtime source state leak into durable preset state

## `src/js/ui/ui.js`

Owns:

- control wiring
- mode-specific enable/disable/hide behavior
- user-facing source switch actions
- human-readable status updates
- keeping file-mode transport affordances honest

Build 114 changes allowed here:

- add source selector wiring
- update status copy
- mode-specific transport gating
- hook teardown and activation actions to controls

Build 114 changes not allowed here:

- heavy business logic that belongs in source management
- long-lived audio graph ownership
- schema/preset logic

## `src/js/ui/dom-cache.js`

Owns:

- DOM lookup and stable element references

Build 114 changes allowed here:

- cache source selector and any related status elements

Keep this file mechanical and boring.

## `src/js/core/config.js`

Owns:

- canonical defaults
- static option lists
- UI constants
- supported source labels / source option metadata where appropriate

Build 114 changes allowed here:

- source option labels
- static UI constants
- default source mode if needed

Do not put runtime permission state here.

## `src/index.template.html`

Owns:

- baseline UI structure

Build 114 changes allowed here:

- add source selector markup
- add any honest source status element if needed

Build 114 warning:

- do not bloat the panel with speculative controls that are not part of 114

## `src/css/audio-panel.css`

Owns:

- audio panel layout and mode-specific presentation affordances

Build 114 changes allowed here:

- source switch layout
- hidden/disabled live-mode control presentation
- compact status treatment

## `src/js/recording/recorder-engine.js`

Owns:

- recording/capture plumbing and state inside the recording subsystem

Build 114 changes allowed here only if necessary:

- ensure recording continues to observe the active routed source path

Build 114 changes not allowed here:

- source selection ownership
- transport ownership
- UI mode logic that belongs in `ui.js`

## `src/js/presets/url-preset.js`

Owns:

- durable/shared preset serialization and migration

Build 114 allowed touch:

- verify runtime-only live source data is excluded

Build 114 warning:

- do not store permission/session state
- do not add a schema bump unless product requirements explicitly change

## `src/js/audio/queue.js`

Owns:

- file queue only

Build 114 warning:

- mic and stream are not queue items
- do not retrofit live sources into the queue model

## `src/js/audio/scrubber.js`

Owns:

- file waveform preview and seek interaction

Build 114 warning:

- scrubber remains file-mode behavior
- live modes may disable/hide interaction, but do not force fake waveform semantics

## `src/js/render/*`

Owns:

- visual simulation and draw behavior

Build 114 expectation:

- mostly untouched
- may consume reset hooks, but should not be rewritten for 114

## `tests/targeted-audit.test.js`

Owns:

- targeted regression and contract protection

Build 114 should add:

- source transition tests
- live-source exclusion from presets
- teardown/switching invariants
- file-mode regression coverage where practical

## Boundaries Codex must respect

### Queue boundary

Queue is file-only.

### Scrubber boundary

Scrubber is file-only.

### Source boundary

Only one active source at a time.

### Preset boundary

Live session and permission state are runtime-only.

### Recording boundary

Recording observes the active path; it does not become a new transport path.

### UI boundary

UI reflects source mode honestly; it must not fake track semantics for live sources.

## Anti-patterns to reject in review

Reject implementations that:

- stuff mic/stream special cases randomly across unrelated files
- treat live sources as fake queue tracks
- store source session state in presets
- duplicate source teardown logic in multiple places
- leave UI controls enabled when they do nothing in live modes
- wire permission handling directly into render modules
- rewrite file transport behavior without need
- introduce zombie stream tracks or duplicate event handlers

## Preferred Build 114 shape

1. add explicit runtime source state
2. add source manager
3. route active source through audio engine
4. wire honest UI
5. add targeted tests
6. verify file mode regression safety

## Review checklist

A Build 114 PR should answer yes to all of these:

- Is source kind explicit in runtime state?
- Is teardown centralized?
- Are Mic and Stream clearly not queue-backed track modes?
- Does file mode still preserve Build 113 behavior?
- Is live-source state excluded from presets?
- Does the UI handle denied/unsupported cases cleanly?
- Are unrelated modules left alone?
