# Factory policy calibration

At 44,100 Hz / PCM16 stereo, encoded payload is seconds × 44,100 × 2 × 2; float32 output estimate is seconds × 44,100 × channels × 4. Small synthetic headers/size inputs exercise these numbers without allocating the represented PCM.

| Input | Encoded bytes, ordinary 44-byte WAV header | Estimated output PCM | Factory effect |
| --- | ---: | ---: | --- |
| 6-minute PCM16 stereo WAV | 63,504,044 | 127,008,000 | Encoded fits 67,108,864; above 4m workload, fits 8m |
| 9-minute PCM16 stereo WAV | 95,256,044 | 190,512,000 | Encoded refusal under every profile, including 15m and manual |
| 9-minute compressed stereo | Encoding-dependent | 190,512,000 | If encoded bytes fit: offer under 8m, automatic admission under 15m |
| 1:12:24 stereo | Encoding-dependent | 1,532,563,200 | Estimated PCM exceeds 536,870,912 under every profile/manual |

The profile is stereo-equivalent workload, not a guaranteed playable duration or unrestricted waveform duration. Automatic behavior affects only above-profile tracks. The interface states “not a track-duration cutoff,” explains resource admission and supplies encoded/PCM-specific refusal reasons; numeric ceilings are not ordinary UI overrides. The final report will distinguish technical coherence from optional further copy/calibration recommendations. No source default change is authorized merely for aesthetic convenience.

Actual CONFIG defaults were checked against executable code: output 44,100 Hz, 512 peaks, estimated fallback two channels, 65,536-byte/128-chunk prefix, 4/8/15m workloads 84,672,000 / 169,344,000 / 317,520,000 bytes, default 8m / Ask, encoded ceiling 67,108,864 and estimated PCM ceiling 536,870,912 bytes. No source policy changed. Equality admits; one encoded byte or one output frame above refuses. Safe expert overrides are honored; unsafe/nonfinite arithmetic fails closed. Implausible source rates are not device-memory certificates; native API validation/failure remains optional, and no new undocumented numeric ceiling is added.

Six-channel compressed metadata remains the material accepted uncertainty. In the native Opus fixture, known duration plus the configured stereo fallback estimates 707,896 bytes while the actual six-channel output is 2,116,776 bytes. All channels contribute to peaks, confidence stays estimated, and there is no second decode. Returned dimensions are post-allocation diagnostics, not a universal pre-decode bound. Source-rate temporary PCM, codec scratch, native encoded copies, independent playback/recording and delayed GC remain outside the estimated-output ceiling.

Recommendation: retain the coherent factory ceilings and workload semantics. The qualitative interface disclosure plus exact encoded/PCM refusal reasons is truthful; the current README now gives the nine-minute WAV counterexample. A read-only CONFIG-derived encoded-limit explanation in a future UI refinement may help power users, but must not imply a duration guarantee or introduce an unrestricted override. Broader ceiling/device calibration requires a separate human policy decision.
