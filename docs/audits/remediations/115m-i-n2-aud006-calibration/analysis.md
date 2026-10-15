# Recorder calibration analysis

**N.2 CONDITIONAL — Partial evidence supports bounded defaults, but named calibration gaps remain.**

The evidence supports only provisional desktop interactive policy candidates. It does not establish broader product/device safety. Build 115N remains WITHHELD. All candidate values require human policy review; no production governor, automatic Stop, Cancel, Settings control or persistence was installed.

## Reproduced N.1 evidence

Same browser build (151.0.7922.173), diagnostic, 960×640/DPR 1/30-FPS request and default scene. The original N.1 native script and 23-case baseline model ran unchanged. Recorder source is byte-identical between N.1 and the accepted N.2 baseline. All 11 reference captures completed; downloaded last export replayed and ffprobe decoded VP9/Opus. Other A exports have MIME/event evidence, not individual bitstream/replay inspection.

| Reference scenario | Original bytes | Repeated bytes | Change |
| --- | ---: | ---: | ---: |
| video-only | 387,347 | 377,679 | -2.50% |
| file-audio | 809,855 | 806,412 | -0.43% |
| synthetic-mic | 628,295 | 572,359 | -8.90% |
| stream-codec-video/webm;codecs=vp9,opus | 580,924 | 608,712 | +4.78% |
| stream-codec-video/webm;codecs=vp8,opus | 1,003,708 | 993,461 | -1.02% |
| stream-codec-video/webm | 993,282 | 990,907 | -0.24% |
| stream-codec-video/mp4 | 697,106 | 693,980 | -0.45% |
| stream-longer-safe-60s | 14,470,681 | 14,507,040 | +0.25% |
| repeat-1 | 460,342 | 463,716 | +0.73% |
| repeat-2 | 462,756 | 453,949 | -1.90% |
| repeat-3 | 458,907 | 466,077 | +1.56% |

The 60-second repetition differs by +0.25%. The −8.90% Mic difference is localized: its first event fell from 153,588 to 101,723 bytes, accounting for 92.7% of the total difference; the following two events differ by roughly 0.4% and 1.3%. Exact cause is unresolved: initial visual/audio warmup and scheduling were not controlled or measured by N.1. This is not silently averaged away or attributed to an encoder regression. The video-only delivery count changes from four to three because Stop occurred at 3.012s, before the next timeslice event that arrived at 3.020s in the original run; final delivery is included in the export byte ledger. Event ledgers in n1-comparison.json preserve both schedules.

## Native workload observations

| Trial | Elapsed s | Encoded MB | Mbit/s | Nonempty events | Largest event B | Last event B | Post-Stop total B |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| B-baseline-video | 30.041 | 4.470 | 1.190 | 30 | 163,432 | 73,885 | 73,885 |
| B-standard-file | 45.062 | 7.802 | 1.385 | 45 | 209,114 | 29,296 | 29,296 |
| B-standard-stream-vp8 | 30.076 | 8.506 | 2.262 | 29 | 470,377 | 107,673 | 107,673 |
| B-high-mic | 30.066 | 10.749 | 2.860 | 30 | 512,532 | 38,711 | 38,711 |
| B-expert-stream | 30.176 | 5.717 | 1.516 | 29 | 296,115 | 296,115 | 296,115 |
| B-standard-stream-mp4 | 30.070 | 9.571 | 2.546 | 9 | 2,079,150 | 0 | 647,847 |
| B-high-video-vp8 (guard abort) | 23.770 | 3.552 | 1.195 | 23 | 368,115 | 11,015 | 66,776 |
| C-standard-5min | 300.058 | 97.087 | 2.588 | 294 | 436,759 | 375,267 | 375,267 |

MB means decimal 1,000,000 bytes. Full exact values/distributions, A and D rows, previous bytes, hashes and native timestamps are in measurements.json/CSV and raw evidence. A guard-aborted native result is preserved with application phase complete but is not a completed-duration/replayed calibration trial.

| Trial | Requested FPS | Render cadence /s | Video packets / capture s | Max event gap ms | Stop → terminal ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| B-baseline-video | 30 | 59.98 | 29.925768116906895 | 1035.3 | 1.1 |
| B-standard-file | 30 | 57.43 | 27.029426124006925 | 1070.4 | 25.7 |
| B-standard-stream-vp8 | 30 | 51.54 | 22.609389546482245 | 1124.7 | 1.1 |
| B-high-mic | 30 | 55.25 | 26.64138894432249 | 1084.6 | 26.3 |
| B-expert-stream | 60 | 25.65 | 13.752651113467657 | 1113.2 | 52.7 |
| B-standard-stream-mp4 | 30 | 59.43 | 28.899235118057867 | 3663.0 | 26.0 |
| B-high-video-vp8 | 30 | 41.65 | not inspected | 1257.0 | 22.4 |
| C-standard-5min | 30 | 59.02 | 28.637796692639423 | 1062.5 | 1.5 |

Render cadence counts actual calls to the production render method and includes its measured cost distribution; it is not capture FPS. Packet count is an encoded-rate proxy, not a decoded-frame or unique-canvas-frame guarantee. Expert stress rendered only 25.65/s and produced 13.75 video packets/s while requesting 60. Even ordinary standard trials yielded about 22.6–28.9 packets/s at requested 30. The tier targets are therefore not certified FPS guarantees. Heavy complexity lowered output rate here because fewer frames were produced; lower bitrate does not imply a cheaper or safer scene.

Resolution, scene, audio, FPS, duration/warmup and codec vary in this selection. There is no factorial causal estimate: do not attribute every difference to resolution alone. Standard VP8 Stream averaged 2.262 Mbit/s, standard generic MP4 2.546, five-minute VP9 Stream 2.588 and high VP9 Mic 2.860; the different durations and evolving trails are confounders. Long-run standard bytes/minute averaged 19.414 MB. The first short File run is not a stationary estimate of long Stream output.

## Codec and delivery behavior

Native generic WebM resolves to VP8+Opus; generic MP4 resolves to **VP9+Opus**, confirmed by ffprobe in the 30-second B trial. Explicit AVC/AAC was unavailable in this Chromium support probe. Video-only final MIME drops Opus and inspected files contain only video. Stage A construction MIME may still include audio before native final negotiation. Distinguish selected MIME, initial native MIME, event MIME, final native MIME and inspected stream codecs. No H.264/AAC claim follows from an .mp4 filename.

MP4 did not respect one-second delivery cadence: its largest event was 2,079,150 bytes and maximum inter-event gap 3,663ms. At Stop it delivered 647,847 bytes followed by an empty final event. The largest observed post-Stop delivery total across A–C was 693,980 bytes (A MP4, including its header event), not merely the last-event size. These observations motivate separate crossing-event and final-delivery headroom, never a native maximum.

## Descriptive statistics

Type-7 linearly interpolated sample quantiles, not prediction intervals or population percentiles. The pooled sample deliberately mixes unequal codecs/workloads/durations and excludes D auxiliaries, the guarded abort, and the additional short unmodified control. Each successful main trial contributes one bitrate value; this is not a duration-weighted average.

| Sample | n | Min Mbit/s | Median | Sample p95 | Max |
| --- | ---: | ---: | ---: | ---: | ---: |
| All | 18 | 1.003 | 1.830 | 2.670 | 2.860 |
| A | 11 | 1.003 | 1.826 | 2.630 | 2.637 |
| B | 6 | 1.190 | 1.889 | 2.782 | 2.860 |
| C | 1 | 2.588 | 2.588 | 2.588 | 2.588 |

| Native final MIME group | n | Min / median / p95 / max Mbit/s |
| --- | ---: | --- |
| video/mp4;codecs=vp9,opus | 2 | 1.835 / 2.190 / 2.511 / 2.546 |
| video/webm;codecs=vp8,opus | 3 | 2.262 / 2.622 / 2.635 / 2.637 |
| video/webm;codecs=vp9 | 2 | 1.003 / 1.097 / 1.181 / 1.190 |
| video/webm;codecs=vp9,opus | 11 | 1.286 / 1.803 / 2.724 / 2.860 |

| Stage distribution | n events | Event bytes min / median / p95 / max | Post-Stop bytes min / median / p95 / max |
| --- | ---: | --- | --- |
| A | 89 | 1,200.0 / 237,267.0 / 330,173.0 / 692,780.0 | 149,692.0 / 245,630.0 / 531,843.0 / 693,980.0 |
| B | 173 | 0.0 / 180,183.0 / 499,815.0 / 2,079,150.0 | 29,296.0 / 90,779.0 / 559,914.0 / 647,847.0 |
| C | 294 | 238,348.0 / 320,105.5 / 413,863.6 / 436,759.0 | 375,267.0 / 375,267.0 / 375,267.0 / 375,267.0 |

statistics.json also preserves event-gap, final-event and settlement distributions with sample counts; measurements.json preserves each workload distribution and raw event schedule. Zero-byte data events are retained in distributions but excluded from chunk-reference counts. A p95 from a single C trial equals that sample and has no population inference.

## Longer run, guards and previous-export overlap

The standard five-minute VP9+Opus trial completed 300.058s, 97,086,560 bytes and 294 nonempty chunks. Sampled summed process-tree RSS peaked at 1,168.2 MiB; cgroup memory.current peaked at 785.0 MiB. Shared pages can be counted repeatedly in summed RSS; cgroup scope includes unrelated workspace activity. Neither metric is recorder-attributable physical memory. They cannot establish a mapping from H to process survival. The earlier high-video VP8 guard crossed 1,536 MiB summed RSS with only 3.55 MB encoded output, illustrating why encoded bytes are not RAM. No OOM or native shutdown failure was observed.

Fifteen minutes was deliberately omitted: the five-minute 97.1 MB exceeded the predeclared 32 MiB continuation prerequisite. Three times that measured payload would exceed the diagnostic guard; no unsafe trial was launched to fill the cell. Baseline fifteen-minute native behavior remains unverified.

D-small: previous export 4,469,902 bytes remained fetchable while B recorded; successful B was 425,916 bytes. D-larger: P=97,086,560 bytes with D=933,407 bytes observed active, totaling **98,019,967 bytes**. After admitted final delivery, old+new distinct payload was **98,051,486 bytes** immediately before replacement. Both replacement ledgers revoke exactly the old URL after the new URL is canonical; no premature revocation. Subsequent failed acquisition preserves the new smaller export (964,926 bytes in the larger sequence), not the now-replaced 97 MB export. A native mid-record failure with a 97 MB prior export was not induced; that ownership requirement is modeled and remains future integration acceptance.

## Prospective policy replay and sensitivity

Candidate S=130,000,000, H=270,000,000, R=10,000,000 bytes, C=1,200, T=300s. All saved native ledgers fit aggregate/reference admission; only the five-minute primary ledger reaches candidate duration. None reaches candidate S. No native automatic capacity Stop was executed. policy-replay.json identifies each row and prospective trigger; unchanged event replay cannot predict a different early Stop’s final event or media validity.

The 22 pure specification cases cover requested hostile schedules and invalid accounting without allocating synthetic media. N.1 baseline models separately reproduce current synchronous-status overwrite and indefinitely finalizing weaknesses. Their passing assertions are evidence of those baseline behaviors, not proof that the proposal is implemented.

At boundary P=S, D=S−1, admitting the largest observed crossing event consumes 2,079,149 reserve bytes. Invented post-Stop totals at 1×/2×/4×/8× the observed 693,980-byte maximum fit the 10 MB reserve; 16× does not and must truthfully fail the new capture preserving P. A stationary-rate invented delayed tail of 15s fits, 30s and 60s do not. These are adversarial arithmetic inputs, not observed native events or a guaranteed tolerated suspension duration.

Sensitivity also varies soft threshold ×0.75/1/1.5, reserve ×1/2/3/4 of observed crossing+tail, C=300/600/1,200/2,400 and T=60/300/600/900s. The five-minute 294 chunks barely fit C=300; fourfold reference margin is a policy tolerance, not a measured object-memory budget. A 60s T would end the long trial earlier, but its changed native tail is unknown. Disabling T makes byte/count admission more important and does not establish a universal maximum duration. Full inputs/outcomes are in sensitivity.json.

## Limits and next measurements

Named gaps: one virtual Linux Chromium host, DPR 1, no physical low-memory desktop, Firefox/Safari/other Chromium device comparison, no real Mic/display permission or system-audio devices, no long MP4/VP8/high/expert trial, no fifteen-minute native trial, no background/suspend/throttling coverage, no recorded native capacity-triggered early Stop, no peak recorder-attributable RAM, no crash recovery, and no external-player/audio-fidelity certification. The unmodified positive control adds ordinary File/UI capture and decoded-container evidence but does not quantify instrumentation overhead.

Before general defaults, run the physical/browser matrix in workload-matrix.md with native final-delivery distributions, repeated longer runs, old exports near S and target-device memory observations. Decide whether the tested requested-30-FPS outcomes are acceptable. Candidate settings serve predictable bounded interactive outcomes; they cannot promise process survival or archival recording.
