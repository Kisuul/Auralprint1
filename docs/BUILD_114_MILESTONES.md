# Build 114 Milestones

## Purpose

This file breaks Build 114 into small, agent-safe chunks.

Each milestone should be implemented and reviewed separately when practical.

## Milestone 114-A — Source model and switching contract

### Goal

Introduce explicit source runtime state and a unified source-management layer without changing user-visible behavior more than necessary.

### Deliverables

- add explicit runtime source state
- add `src/js/audio/input-source-manager.js`
- centralize activation/teardown contract
- make `audio-engine.js` capable of consuming a normalized active source path

### Acceptance criteria

- source kind/status exist explicitly in runtime state
- teardown is centralized and reusable
- file mode still works exactly as before
- no live-source state enters presets
- tests cover source transition contract at a targeted level

### Non-goals

- full polished UI
- complete mic/stream UX
- speculative device selection

## Milestone 114-B — Microphone source

### Goal

Add microphone capture as the first live-source mode.

### Deliverables

- activate microphone input through the source manager
- route microphone audio into the existing analysis path
- expose file/mic mode switching
- handle denied/unsupported cases politely

### Acceptance criteria

- mic activation works when supported and permitted
- denied permission returns the app to a recoverable state
- file mode can be re-activated cleanly after mic mode
- queue/scrubber semantics remain file-only

### Non-goals

- advanced device picker
- persistent device preference
- multi-input routing

## Milestone 114-C — Stream source

### Goal

Add display/tab/system stream capture when browser support exists.

### Deliverables

- activate display/media stream through the source manager
- detect and surface unsupported environments
- handle externally ended stream events
- expose file/stream mode switching

### Acceptance criteria

- stream activation works when supported and granted
- unsupported or denied cases remain recoverable
- external stream termination resets source state safely
- file mode can be restored cleanly after stream mode

### Non-goals

- guarantee audio availability on every browser
- fake stream duration/track semantics

## Milestone 114-D — UI completion and honesty pass

### Goal

Make source-mode behavior clear and honest in the UI.

### Deliverables

- visible source selector
- mode-specific status copy
- disable/hide queue-only or scrubber-only affordances in live modes where appropriate
- ensure no fake track semantics in mic/stream modes

### Acceptance criteria

- source selector is obvious enough to count as the feature
- file mode still feels like Build 113
- mic/stream mode does not expose misleading transport affordances
- status text is readable and useful

## Milestone 114-E — Regression hardening

### Goal

Ship-ready polish and protection.

### Deliverables

- targeted regression tests
- source-switch stress pass
- recording-path sanity check against live sources
- manual verification pass using the checklist in `docs/BUILD_114_VERIFICATION.md`

### Acceptance criteria

- repeated source switching does not accumulate stale listeners/tracks
- file mode, queue, scrubber, and recording remain functional
- normal flows produce no console errors

## Suggested issue breakdown

If you want to create GitHub issues, use one issue per milestone:

1. **114-A: Explicit source model + source manager**
2. **114-B: Microphone input mode**
3. **114-C: Stream/display capture mode**
4. **114-D: Source-mode UI polish**
5. **114-E: Regression hardening + verification**

## PR guidance

Preferred PR strategy:

- small, focused PRs
- one milestone per PR where possible
- tests in the same PR as the behavior they protect
- no unrelated cleanup bundled into milestone work

## Agent guidance

Every milestone prompt should include:

- goal
- allowed files to edit
- files to avoid unless necessary
- invariants to preserve
- non-goals
- acceptance criteria
- verification steps
