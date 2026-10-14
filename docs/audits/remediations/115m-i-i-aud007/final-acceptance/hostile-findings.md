# Prioritized hostile findings

| ID / severity | Reproduction and affected code | Status / remaining risk |
| --- | --- | --- |
| D-01 / P2 Medium | During waveform-admission.loadFile(A), reset's synchronous empty notification calls loadFile(B) or Reset. The older continuation then installs A; B's listeners are no longer owned by current. Initial reads are A rather than B; three B listeners remain after reset. | Demonstrated on accepted main; correction pending. Public callbacks permit synchronous reentrancy, including DOM focus side effects, though this harness injects the transition explicitly. Existing resource occupancy remains single-flight. |
| D-02 / P2 Medium | prepare evaluates a nine-minute offer; its notification synchronously selects 15m. refresh ignores the edit while scheduled, and settlement retries only former defer. Final selected 15m has no full read. | Demonstrated on accepted main; correction pending. Availability/control consistency defect, not a hard-budget bypass. |
| D-03 / informational | Source CONFIG has separate 64 MiB encoded and 512 MiB estimated-PCM ceilings; a nine-minute PCM16 stereo WAV exceeds the former even under a 15m workload profile. | Coherent accepted policy; calibrate and assess disclosure without increasing ceilings. |
| D-04 / accepted uncertainty | Compressed channels use a two-channel estimate, which can understate six-channel native output. | Verify honest labeling, all-channel peaks and no second decode. No native/process memory cap is claimed. |

Original reproductions and baseline-hostile.json are preserved. Production corrections must be separate from this initial audit commit and must leave public interfaces, source policy and schema unchanged.
