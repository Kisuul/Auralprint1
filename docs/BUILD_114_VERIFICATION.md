# Build 114 Verification Matrix

## Purpose

Use this checklist before calling Build 114 complete.

## Regression baseline — file mode

- [ ] App loads without console errors
- [ ] File mode is selectable
- [ ] Single-file load still works
- [ ] Multi-file load still works
- [ ] Queue still renders and updates correctly
- [ ] Prev/Next still work in file mode
- [ ] Repeat mode still works in file mode
- [ ] Shuffle still works in file mode
- [ ] Scrubber waveform still renders in file mode
- [ ] Scrubber seek still works in file mode
- [ ] File track status remains honest and readable
- [ ] Reset visuals still behaves correctly
- [ ] Recording still works in file mode

## Source selector

- [ ] Source selector is visible and understandable
- [ ] `File` selection returns the app to normal file behavior
- [ ] `Mic` selection initiates microphone flow
- [ ] `Stream` selection initiates stream/display flow when supported
- [ ] Unsupported source kinds are surfaced honestly

## Microphone mode

- [ ] Microphone permission prompt appears when expected
- [ ] Granted microphone permission activates analysis correctly
- [ ] Denied microphone permission leaves the app recoverable
- [ ] No fake queue state appears in mic mode
- [ ] No scrubber seeking is exposed in mic mode
- [ ] Status text clearly indicates mic mode state
- [ ] Switching from mic back to file works cleanly

## Stream mode

- [ ] Stream/display permission flow appears when expected
- [ ] Supported stream capture activates analysis correctly
- [ ] Unsupported environments are surfaced honestly
- [ ] Denied/cancelled stream capture leaves the app recoverable
- [ ] External stream end is handled cleanly
- [ ] No fake queue state appears in stream mode
- [ ] No fake track timeline appears in stream mode
- [ ] Switching from stream back to file works cleanly

## Source switching

- [ ] file → mic works
- [ ] mic → file works
- [ ] file → stream works
- [ ] stream → file works
- [ ] mic → stream works
- [ ] stream → mic works
- [ ] repeated switching does not accumulate duplicate listeners
- [ ] repeated switching does not leave zombie stream tracks
- [ ] repeated switching does not leave stale analyzer data visible

## Preset/schema safety

- [ ] Share/apply preset still works
- [ ] Existing presets still load
- [ ] No source runtime/session data appears in preset payloads
- [ ] No accidental schema bump was introduced without intent

## Recording-path sanity

- [ ] Recording panel still initializes correctly
- [ ] Recording against file mode still works
- [ ] Recording does not become a competing transport path
- [ ] Live-source activation does not break recording status logic
- [ ] Source switch during idle state does not confuse recording UI

## Console and cleanup

- [ ] No normal flow produces console errors
- [ ] Denied permission does not leave stale active-source UI
- [ ] Stopped or externally ended stream does not leave stale active-source UI
- [ ] Tearing down a source twice is harmless
- [ ] Leaving live mode returns the app to a clean file-ready state

## Optional stress pass

Run this manual stress loop five times:

1. enter file mode and load a track
2. switch to mic mode
3. deny permission once, then retry and grant
4. switch back to file mode
5. switch to stream mode
6. cancel once, then retry if supported
7. return to file mode
8. verify queue/scrubber still behave normally

Mark pass/fail notes below.

### Notes

- Pass:
- Fail:
- Follow-up issues:
