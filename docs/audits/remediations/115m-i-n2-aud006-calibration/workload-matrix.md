# Workload selection and coverage

Calibration targets describe bounded interactive capture, not supported-device
promises. All runs: Linux x86_64 headless Chromium 151.0.7922.173, DPR 1, canonical
canvas at the stated physical pixel dimensions. No background suspension or OOM.

| Stage / ID | Canvas / FPS request | Scene | Mode / requested MIME | Selection reason |
| --- | --- | --- | --- | --- |
| A: original 11 scenarios | 960×640 / 30 | Default 2 Orbs | Video-only, File, synthetic Mic/Stream; all probed supported MIME candidates; 2–60s | Exact N.1 diagnostic and environment reproduction. |
| B-baseline-video | 960×640 / 30 | Default 2 Orbs | Video-only / VP9 WebM | Sustained baseline; separates no-audio final MIME from selected MIME. |
| B-standard-file | 1280×720 / 30 | 16 Orbs | Looped File stereo / VP9+Opus WebM; 45s | Desktop standard, real File graph, sustained audio fixture. |
| B-standard-stream-vp8 | 1280×720 / 30 | 16 Orbs | Synthetic Stream / VP8+Opus WebM; 30s | Different encoder family and payload behavior. |
| B-high-mic | 1920×1080 / 30 | 16 Orbs | Synthetic Mic / VP9+Opus WebM; 30s | Desktop high dimensions and live graph. |
| B-expert-stream | 1920×1080 / 60 | Heavy 32 Orbs | Synthetic Stream / VP9+Opus WebM; 30s | Rendering stress; measure cadence and encoded frame count instead of trusting 60 FPS. |
| B-standard-stream-mp4 | 1280×720 / 30 | 16 Orbs | Synthetic Stream / generic MP4; 30s | Container/final-event delivery differences; inspect actual codec. |
| B-high-video-vp8 | 1920×1080 / 30 | 16 Orbs | Video-only / VP8 WebM; 30s | High-resolution VP8/no-audio comparison. |
| C-standard-5min | 1280×720 / 30 | 16 Orbs | Synthetic Stream / VP9+Opus WebM | Longer ordinary workload, guarded; not archival guarantee. |
| C-baseline-15min | 960×640 / 30 | Default | Synthetic Stream / VP9+Opus WebM | Conditional on 5-minute prerequisites in methodology; omit if unjustified. |
| D-small / D-larger | Inherit B-baseline and C-standard | Inherit A | Retain completed A, capture B for 3s, successful replacement; then controlled failed acquisition | Fetch previous URL during B; old+new payload; exact commit/revoke ownership. |
| E | Reported integer sizes only | No render | Pure prospective policy specification | Required failure schedules, checked arithmetic and no hidden Unrestricted budgets. |

16-Orb scene: clone normalized default first Orb with unique IDs, evenly spaced
initial phases, angular speeds 0.4/0.55/0.7/0.85 rad/s repeating, default particle
and trace settings. Heavy scene: 32 such Orbs, 1,000 particles/s/Orb, 30s TTL,
placement filtering disabled, 100 trace lines. Existing scene-wide particle budgets
remain unchanged (512 emissions/update, 16,384 retained); no hidden particle bypass.
All actual normalized Orb definitions and effective budgets are in native evidence.
Scene setup uses normal schema-10 URL application, not modifications to CONFIG.
The File fixture loops an eight-second stereo 440/880Hz WAV via the existing media
object; no large decoded File is created. Native permission capture is substituted.

## Deliberate omissions

No full Cartesian product. No duplicated short generic WebM in B: A already probes
its VP8+Opus fallback. Explicit AVC/AAC is only tested for availability, never
assumed from MP4. No long MP4/high/expert trial before ordinary five-minute evidence.
No high-DPR scaling, random/noise torture scenes, extreme Orb counts, million-particle
workload, artificial huge Blobs or forced memory exhaustion. Longer runs cannot
establish unknown-browser safety. Native Stop refusal, missing callback and final
admission failure are modeled rather than induced as actual browser failures.

## Coverage required for broader factory support

Provisional desktop expectation requires physical Chrome/Edge/Firefox on Windows
and Linux plus Chrome/Safari on macOS, representative low-memory desktop/laptop
classes, hardware acceleration on/off as supported, and DPR 1/2. Record exact CPU,
GPU, RAM, OS, browser build, encoder stream metadata and battery/power state. Test
30-FPS baseline/standard, representative high workload only if performant, prior
exports near candidate S, native downloads and external players with audio-channel
fidelity. Include user-granted/denied/ended Mic/display/tab/system audio and File EOF,
repeated cycles, cancellation/recovery, foreground/background/minimize/lock and
suspend/resume. Run safely bounded five-minute trials with guards on each target.

Mobile/tablet claims additionally need actual iOS Safari and Android Chrome on
memory-constrained devices, thermal/battery behavior, high DPR, app switching,
permission/end behavior, storage/download and replay. Browser API support probing
alone is insufficient. Networking-disabled portable file:// acceptance and hosted
root/subdirectory behavior remain independent distribution gates. Owner-reported
historical functional browser checks are not new capacity measurements.

Execution outcomes and named gaps are recorded in analysis and validation; a
planned row never counts as executed merely because it appears in this table.
