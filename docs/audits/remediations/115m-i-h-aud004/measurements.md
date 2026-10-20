# Native refresh measurements

Chromium 151.0.7922.173; Linux x64; 1440×1000 viewport. One primed batch of 2,000 refreshes per scenario. Baseline and fixed final runs are sequential with the same harness and native scenarios. All times are synchronous UI JavaScript, excluding whole-frame rendering/FPS. Timing noise and JIT explain variation among equal-cost fixed inventories.

| Scenario | Calls | Baseline JS ms | Fixed JS ms | Baseline records | Fixed records |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2-Orb idle, all panels visible | 2000 | 394.90 | 56.20 | 242,008 | 0 |
| 2-Orb idle, Visualizers hidden | 2000 | 357.40 | 43.20 | 242,008 | 0 |
| 16-Orb idle | 2000 | 808.30 | 25.30 | 886,016 | 0 |
| 64-Orb idle | 2000 | 2163.00 | 22.20 | 3,094,044 | 0 |
| 64-Orb idle, Visualizers hidden | 2000 | 2229.90 | 55.20 | 3,094,044 | 0 |
| Active playback | 2000 | 261.20 | 20.30 | 238,004 | 0 |
| Active recording | 2000 | 240.90 | 21.20 | 256,004 | 0 |
| Recorder finalization | 2000 | 260.70 | 32.70 | 262,004 | 0 |
| Preset apply / panel reopen | 2000 | 201.00 | 16.30 | 236,004 | 0 |

Each category below is baseline → fixed. Text counts characterData or childList changes containing text nodes; insertion/removal counts element nodes. Categories are observations, not a count of every JavaScript assignment.

| Scenario | Text | Title | ARIA | Class | Other attributes | Elements inserted / removed | Structural detachment |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2-Orb idle, all panels visible | 10,000 → 0 | 178,000 → 0 | 34,000 → 0 | 0 → 0 | 20,000 → 0 | 4/4 → 0/0 | 0 → 0 |
| 2-Orb idle, Visualizers hidden | 10,000 → 0 | 178,000 → 0 | 34,000 → 0 | 0 → 0 | 20,000 → 0 | 4/4 → 0/0 | 0 → 0 |
| 16-Orb idle | 10,000 → 0 | 822,000 → 0 | 34,000 → 0 | 0 → 0 | 20,000 → 0 | 8/8 → 0/0 | 0 → 0 |
| 64-Orb idle | 10,000 → 0 | 3,030,000 → 0 | 34,000 → 0 | 0 → 0 | 20,000 → 0 | 22/22 → 0/0 | 0 → 0 |
| 64-Orb idle, Visualizers hidden | 10,000 → 0 | 3,030,000 → 0 | 34,000 → 0 | 0 → 0 | 20,000 → 0 | 22/22 → 0/0 | 0 → 0 |
| Active playback | 10,000 → 0 | 178,000 → 0 | 36,000 → 0 | 2,000 → 0 | 12,000 → 0 | 2/2 → 0/0 | 0 → 0 |
| Active recording | 10,000 → 0 | 178,000 → 0 | 36,000 → 0 | 2,000 → 0 | 30,000 → 0 | 2/2 → 0/0 | 0 → 0 |
| Recorder finalization | 10,000 → 0 | 178,000 → 0 | 36,000 → 0 | 2,000 → 0 | 36,000 → 0 | 2/2 → 0/0 | 0 → 0 |
| Preset apply / panel reopen | 10,000 → 0 | 178,000 → 0 | 36,000 → 0 | 2,000 → 0 | 10,000 → 0 | 2/2 → 0/0 | 0 → 0 |

Function/property observations supplement MutationObserver. V/C/D = native value/checked/disabled setter calls. Feature entries count coordinator calls, including guards; these counts do not imply full reconciliation. Tooltip visits count actual control-level feedback projection.

| Scenario | V/C/D setters | Tooltip visits | Recorder projections | Editor / inventory / Ring helper entries |
| --- | ---: | ---: | ---: | ---: |
| 2-Orb idle, all panels visible | 6000/4000/42000 → 0/0/0 | 178,000 → 0 | 2000 → 0 | 2000/2000/2000 → 2000/2000/2000 |
| 2-Orb idle, Visualizers hidden | 6000/4000/42000 → 0/0/0 | 178,000 → 0 | 2000 → 0 | 2000/2000/2000 → 0/0/0 |
| 16-Orb idle | 6000/4000/42000 → 0/0/0 | 822,000 → 0 | 2000 → 0 | 2000/2000/2000 → 2000/2000/2000 |
| 64-Orb idle | 6000/4000/42000 → 0/0/0 | 3,030,000 → 0 | 2000 → 0 | 2000/2000/2000 → 2000/2000/2000 |
| 64-Orb idle, Visualizers hidden | 6000/4000/42000 → 0/0/0 | 3,030,000 → 0 | 2000 → 0 | 2000/2000/2000 → 0/0/0 |
| Active playback | 6000/4000/42000 → 0/0/0 | 178,000 → 0 | 2000 → 0 | 2000/2000/2000 → 2000/2000/2000 |
| Active recording | 6000/4000/42000 → 0/0/0 | 178,000 → 0 | 2000 → 0 | 2000/2000/2000 → 2000/2000/2000 |
| Recorder finalization | 6000/4000/42000 → 0/0/0 | 178,000 → 0 | 2000 → 0 | 2000/2000/2000 → 2000/2000/2000 |
| Preset apply / panel reopen | 6000/4000/42000 → 0/0/0 | 178,000 → 0 | 2000 → 0 | 2000/2000/2000 → 2000/2000/2000 |

All scenarios preserve the visible focus target (inventory action or Workspace launcher), connected editor/inventory identity, preferences, and runtime-settings reference. Hidden Visualizers performs no normal feature-helper or tooltip traversal after the correction. Visible feature guards remain: helper entry is bounded and does not imply control traversal.

Relevant changed state:
- **2-Orb idle, all panels visible:** none; recorder phase `idle`.
- **2-Orb idle, Visualizers hidden:** none; recorder phase `idle`.
- **16-Orb idle:** none; recorder phase `idle`.
- **64-Orb idle:** none; recorder phase `idle`.
- **64-Orb idle, Visualizers hidden:** none; recorder phase `idle`.
- **Active playback:** native stereo WAV loaded and playing; AnalysisFrame held stable in synchronous isolation; recorder phase `idle`.
- **Active recording:** native MediaRecorder recording; elapsed timer primed; no asynchronous callback runs inside synchronous batch; recorder phase `recording`.
- **Recorder finalization:** native stop; phase held by synchronous batch: finalizing; recorder phase `finalizing`.
- **Preset apply / panel reopen:** canonical preferences applied while hidden, then panel reopened; recorder phase `complete`.

Playback/recording are native sessions primed before measurement. Asynchronous callbacks cannot interleave within a synchronous batch, so timer/phase change propagation is tested independently in native acceptance. Finalization is measured in the same synchronous turn as native stop, with phase finalizing throughout. Reopen/preset changes are settled before the unchanged batch; acceptance independently asserts prompt propagation.

No unexpected browser errors or unhandled rejections occurred. Original baseline.json, baseline-initial.json and baseline-capture-isolation.json remain preserved. Compare baseline-final.json with fixed.json for the final identical-harness matrix.
