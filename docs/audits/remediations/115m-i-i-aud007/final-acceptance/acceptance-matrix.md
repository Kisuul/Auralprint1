# Acceptance evidence matrix

Initial independent deterministic suite: 11 cases, 8 pass and 3 fail, exposing D-01/D-02. New assertions cover synchronous File/Clear reentrancy, offer/preference reentrancy, cross-stage occupancy, obsolete rejection, synchronous reduction replacement, per-request manual grant, post-read revocation, stalled-decoder preference/manual storms and 432 independent integer-workload combinations. Final corrected results, mutation controls and native/protected checks will be recorded after execution.

## Human-reported cross-browser functional acceptance, supplied by the project owner

The owner reports live successful testing in Chrome, Opera, Microsoft Edge and Firefox, using direct local-file execution and locally hosted execution via Python HTTP server. This is human-reported evidence, not Codex automation. It is not an independently known browser-by-case-by-mode matrix.

| Input | Profile | Reported result |
| --- | --- | --- |
| 5-minute mono | Approx. 4m | Waveform generated |
| 6-minute stereo | Approx. 4m | Waveform withheld |
| 6-minute stereo | Approx. 8m | Waveform generated |
| 9-minute track | Approx. 15m | Waveform generated |
| 1:12:24 stereo | 4 / 8 / 15m | Waveform withheld |
| Applicable withheld cases | Applicable tested profiles | Seek remains functional |

Exact codec, bitrate, sample rate, source-file hash, refusal reason, browser versions and network-disabled operation were not supplied; none is inferred. Prior ERR_BLOCKED_BY_ADMINISTRATOR is an automation restriction, not application failure. Direct-file functional execution now has meaningful owner coverage. Demonstrably network-disabled offline execution remains a narrower separate gap for applicable Build 115N portability acceptance, not a sole AUD-007 blocker.
