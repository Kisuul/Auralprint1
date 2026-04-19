# Build 114 Seam Map — Ownership, Boundaries, and Edit Rules

Status: Phase 0 planning baseline  
Target build: `v0.1.14` / Build `114`

This document maps the current refactored source tree to Build 114 work. It is written for humans and coding agents.

## 1. Canon rule

Interfaces are canon; modules are mutable.

For Build 114, the interface truths are more important than any one implementation choice:

- file mode remains canonical and regression-intolerant
- live source state is runtime-only
- recording remains a passive observer
- queue/scrubber remain file-mode concerns

## 2. Current module families

## 2.1 Boot/orchestration

### `src/js/main.js`
Owns:

- application boot order
- main animation loop
- subsystem initialization order
- canonical recorder tap handoff wiring

May change in 114 to:

- initialize the new source subsystem
- sequence support probes if needed

Must not become:

- a place for browser permission logic
- a large source-state switchboard

## 2.2 Core

### `src/js/core/config.js`
Owns:

- canonical defaults
- limits
- UI constants
- recording config
- band defaults

114 additions may include:

- source selector defaults
- copy/config for source-mode labels
- optional capability policy defaults

Must not own:

- active live session state
- granted permissions
- stream handles

### `src/js/core/state.js`
Owns:

- runtime-only transient state
- canvas/runtime bookkeeping
- audio loaded/playing summary
- recording runtime state
- UI visibility state

114 additions should land here for:

- active source kind
- source request/active/error status
- capability and permission summary

Must not be mirrored into presets.

### `src/js/core/preferences.js`
Owns:

- user-facing configurable preferences
- resolved settings derived from preferences + config

114 must **not** treat source kind or permission state as user preferences unless explicitly designed in a future build.

### `src/js/core/constants.js`, `utils.js`, `spaces.js`
Own:

- constants
- general helpers
- canvas sizing/space helpers

Safe targets for small shared helpers, not for source lifecycle ownership.

## 2.3 Presets

### `src/js/presets/url-preset.js`
Owns:

- URL preset encode/decode
- schema migrations
- sanitization from canonical defaults

114 rule:

- do not write live source session state here
- do not serialize permission results
- do not serialize stream labels/handles

This file should only change if we need to add a **deliberate** persisted source preference in a future build. Build 114 does not require that.

## 2.4 Audio domain

### `src/js/audio/audio-engine.js`
Currently owns:

- AudioContext creation
- media element lifecycle
- playback graph
- splitter/center sum analyser graph
- recorder tap destination
- sample loop support
- file load/play/pause/stop/unload transport ownership

114 direction:

- continue owning canonical audio graph construction
- stop owning all source activation policy directly
- consume source descriptors from a dedicated source manager

Must not become:

- a UI policy module
- a blob of ad hoc permission logic
- a mixed transport + browser-capture policy layer with no seams

### `src/js/audio/queue.js`
Owns:

- file queue semantics only

114 rule:

- no mic/stream concepts here
- no fake live-source queue entries

### `src/js/audio/scrubber.js`
Owns:

- file-backed waveform preview
- file-backed seek interactions

114 rule:

- only active/interactive in file mode
- do not force mic/stream into waveform/timeline semantics

### `src/js/audio/band-bank.js` and `band-bank-controller.js`
Own:

- frequency band definition and metadata
- band rebuilds
- analyzer-side band energy derivation

114 rule:

- source-agnostic as much as possible
- avoid leaking source-switch policy in here

### Recommended new module: `src/js/audio/input-source-manager.js`
Should own:

- source kind transitions
- mic activation
- stream activation
- source teardown
- source capability detection
- source status normalization
- handoff into canonical audio graph entry points

This should be the primary new seam for Build 114.

## 2.5 Rendering

### `src/js/render/*`
Own:

- orb state
- render policy
- trail policy
- color policy
- render-time motion behavior

114 rule:

- rendering should remain mostly source-agnostic
- source changes may request visual reset hooks, but must not push live-source policy into render modules

## 2.6 Recording

### `src/js/recording/recorder-engine.js`
Owns:

- recording lifecycle
- MIME selection
- capture start/stop/finalize
- reading canonical render/audio taps

114 rule:

- keep recorder as passive observer
- do not allow recorder code to take over source routing
- only adapt to new tap availability if the canonical audio path changes shape

## 2.7 UI

### `src/js/ui/ui.js`
Currently owns:

- DOM wiring
- panel visibility
- operator-facing text/status
- queue panel rendering
- transport event handling
- config control application
- recording panel orchestration

114 direction:

- add source selector wiring
- gate transport controls by source mode
- surface capability/permission/status honestly

Must not become:

- the owner of source lifecycle logic
- the owner of stream teardown
- the place where browser APIs are called directly unless trivial and delegated immediately

### `src/js/ui/dom-cache.js`
Owns:

- DOM references only

114 changes:

- add source selector/status element references only

## 2.8 Template/CSS

### `src/index.template.html`
Owns:

- canonical DOM structure
- panel/control placement

114 changes likely include:

- source selector control(s)
- source status lane elements if needed

### `src/css/audio-panel.css`
Likely primary CSS target for 114 source selector changes.

Must not absorb unrelated side-panel or recording ownership.

## 3. Edit policy for Build 114

## 3.1 Expected primary edit set

Agents may edit these files for 114:

- `src/js/core/config.js`
- `src/js/core/state.js`
- `src/js/audio/audio-engine.js`
- `src/js/audio/scrubber.js`
- `src/js/ui/ui.js`
- `src/js/ui/dom-cache.js`
- `src/index.template.html`
- `src/css/audio-panel.css`
- `tests/targeted-audit.test.js`
- `src/js/audio/input-source-manager.js` (new)

## 3.2 Secondary edit set

These may be touched only if required by a clean seam or explicit test need:

- `src/js/main.js`
- `src/js/recording/recorder-engine.js`
- `src/js/core/constants.js`
- `src/js/core/utils.js`

## 3.3 Avoid editing unless a concrete need is proven

- `src/js/audio/queue.js`
- `src/js/audio/band-bank.js`
- `src/js/audio/band-bank-controller.js`
- `src/js/render/*`
- `src/js/presets/url-preset.js`

These are high-regression surfaces relative to the value of Build 114.

## 4. Runtime vs persisted ownership

### Runtime-only

Build 114 source state belongs in runtime-only ownership:

- source kind
- source status
- permission results
- live session errors
- stream active/inactive state
- stream labels or track names

### Persisted

Current persisted settings remain things like:

- visuals
- trace
- particles
- motion
- audio analysis settings
- band distribution / overlay choices
- future deliberate persisted source preferences only if explicitly designed later

## 5. UI truth table

### File mode

Allowed:

- queue
- scrubber
- duration
- prev/next
- repeat
- shuffle
- filename

### Mic mode

Allowed:

- source status
- analysis-driven visuals
- recording if supported by canonical taps

Not allowed to imply:

- queue membership
- file duration
- scrub seek behavior

### Stream mode

Allowed:

- source status
- analysis-driven visuals
- recording if canonical taps support it cleanly

Not allowed to imply:

- queue membership
- file transport semantics
- fake scrub/timeline truth

## 6. Safe integration strategy

The safest 114 strategy is:

1. add a source manager
2. move source-kind transitions there
3. keep `AudioEngine` as the canonical graph owner
4. make `UI` consume source state instead of inventing it
5. keep presets untouched except for explicit non-persistence assertions in tests

## 7. Anti-patterns

Agents must avoid these patterns:

- browser permission code duplicated across `ui.js` and `audio-engine.js`
- mic/stream logic added as special-case branches scattered across unrelated modules
- transport controls left active in live modes without honest behavior
- stream objects stored in preferences or preset payloads
- recorder-engine reaching into private source internals
- main.js becoming a giant source-mode switchboard

## 8. Minimal clean seam proposal

Recommended new public contract from `input-source-manager.js`:

- `getActiveSourceKind()`
- `getSourceStatus()`
- `activateFileSource(...)`
- `activateMicSource()`
- `activateStreamSource()`
- `teardownActiveSource()`
- `hasFileTransport()`
- `isSeekable()`
- `getDisplayLabel()`

The final naming may differ, but the separation should not.

## 9. Success condition for this seam map

This seam map succeeds if Build 114 lands with:

- one clear owner for source activation
- one clear owner for the canonical audio graph
- one clear owner for preset persistence
- one clear owner for operator-facing source UI
- no ambiguity about where runtime-only live state belongs
