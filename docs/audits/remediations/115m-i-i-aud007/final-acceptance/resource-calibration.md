# Factory policy calibration

At 44,100 Hz / PCM16 stereo, encoded payload is seconds × 44,100 × 2 × 2; float32 output estimate is seconds × 44,100 × channels × 4. Small synthetic headers/size inputs exercise these numbers without allocating the represented PCM.

| Input | Encoded bytes, ordinary 44-byte WAV header | Estimated output PCM | Factory effect |
| --- | ---: | ---: | --- |
| 6-minute PCM16 stereo WAV | 63,504,044 | 127,008,000 | Encoded fits 67,108,864; above 4m workload, fits 8m |
| 9-minute PCM16 stereo WAV | 95,256,044 | 190,512,000 | Encoded refusal under every profile, including 15m and manual |
| 9-minute compressed stereo | Encoding-dependent | 190,512,000 | If encoded bytes fit: offer under 8m, automatic admission under 15m |
| 1:12:24 stereo | Encoding-dependent | 1,532,563,200 | Estimated PCM exceeds 536,870,912 under every profile/manual |

The profile is stereo-equivalent workload, not a guaranteed playable duration or unrestricted waveform duration. Automatic behavior affects only above-profile tracks. The interface states “not a track-duration cutoff,” explains resource admission and supplies encoded/PCM-specific refusal reasons; numeric ceilings are not ordinary UI overrides. The final report will distinguish technical coherence from optional further copy/calibration recommendations. No source default change is authorized merely for aesthetic convenience.
