# 115M.I.I / I.2B — configurable waveform policy foundation

Implemented pure admission decisions and metadata estimates. **Restrictive policy is not connected to production loading.** Automatic waveform availability, playback/seek, I.2A single-flight/latest intent and F/G/H/recorder contracts remain unchanged. Version `v0.1.15m.i.j`; schema **10 unchanged**. I.2C UI/persistence/activation and I.2D acceptance are not begun. AUD-007 remains open; Build 115N remains WITHHELD.

## Baseline and scope

Started clean at exact open PR #51 head `b237857a3ec21e4ba7a0cd13f8e0bcff3e58122d`, descending from accepted PR #50 `b2d84e9122991affea5c8525a07c5f755a52a3ce`. Both predecessors were independently verified open/unmerged; remote main was still `704bf13d3a3dfb76032343226bad7240191ef6c6`. New branch `codex/115m-i-i-aud007-admission-policy` targets the I.2A coordinator branch in [draft PR #52](https://github.com/cosmicdance-4-2-0/Auralprint1/pull/52). The suggested policy branch name already belongs to PR #50 and was not modified. Prior I.1/I.2A files and protected production modules are byte-identical (scope.json).

Read agents.md, ROADMAP.md, I.1 design and I.2A ownership contract. This is Build 115 AUD-007 policy implementation. Risks are incorrect arithmetic/confidence, source override handling, future admission-order mistakes and accidental preset/production activation. Scope is one CONFIG namespace, two independently testable modules, version metadata/checks, new tests/diagnostics/documents. No policy/extractor/coordinator UI wiring, general media/source/Queue/recorder/analysis/frame-loop modifications, third-party application dependency, cache or speculative factory.

## Source authority and implemented decisions

CONFIG.waveform is deeply frozen and outside CONFIG.defaults:

| Source value | Factory value / meaning |
| --- | --- |
| decodeSampleRateHz / peakBucketCount | 44,100 / 512, matching unchanged extraction |
| automaticProfiles | 4m/4 minutes, 8m/8, 15m/15 |
| defaultProfileId | 8m |
| defaultAboveProfileBehavior | ask |
| maxEncodedBytes | 67,108,864 (64 MiB) |
| maxEstimatedDecodedPcmBytes | 536,870,912 (512 MiB) |
| fallbackEstimatedChannels | 2, explicitly an assumption |
| metadataProbe.maxBytes / maxChunks | 65,536 / 128, one bounded prefix/chunk traversal |

These are provisional source defaults, not safe-device guarantees. Valid expert-edited ceilings are honored without a hidden factory cap; malformed/nonfinite/negative/fractional/unsafe values fail closed. Zero hard ceilings explicitly refuse work, not unlimited. Profile definitions/rates/default and fallback/probe edits also derive from the supplied policy; unsafe arithmetic and invalid enum/default/duplicate profiles refuse. I.2A concurrency is independent and unchanged. Output rate/bucket fields are estimate/contract configuration here; production extractor still uses its accepted 44.1kHz/512 behavior. I.2C must bind/validate actual extraction semantics to the same source authority before activating policy, never estimate at one rate and decode at another.

At 44.1kHz, stereo reference workload budgets are exactly **84,672,000 / 169,344,000 / 317,520,000 bytes** for 4/8/15m. Profiles are convenience choices based on estimated PCM, not absolute duration gates: nine-minute stereo offers under 8m but admits under 15m; nine-minute mono fits 8m; two-minute six-channel exceeds 4m. The hard encoded and estimated-PCM ceilings apply independently first, including manual requests. One-hour compressed stereo (57.6MB illustrative encoded) exceeds the PCM ceiling with 1,270,080,000 estimated output bytes, modeled only.

`waveform-policy.js` exports `validateWaveformPolicy`, `resolveWaveformProfile`, `evaluateWaveformPolicy`; [decision-contract.md](decision-contract.md) is the precise API/outcome/reason contract. Evaluation is pure: no File read/probe, decode, AudioBuffer, coordinator slot or state mutation. Checks are policy → File.size/encoded → metadata → PCM ceiling → convenience profile. Equal boundaries admit. Ask offers above-profile work; generate-if-permitted admits only after both hard ceilings; skip refuses automatic work while remaining manually eligible. Manual bypasses convenience only. These are policy inputs for the accepted future choices, not I.2C controls/preferences. Unknown selected profile resolves to source default; unsupported behavior/request kinds refuse.

`waveform-metadata.js` exports pure `interpretWaveformMetadata`/`inspectPcmWavHeader` and explicitly invoked asynchronous `probeWaveformMetadata`. Verified/estimated/unknown/invalid are distinct. Known duration plus unknown channels uses the configured fallback and records the assumption even when it matches actual output. Validated partial PCM channel information survives bounded-probe exhaustion rather than silently becoming stereo. Invalid supplied/contradictory supported metadata never falls back. Unknown pending duration defers; unavailable/invalid duration refuses. See [metadata-confidence.md](metadata-confidence.md) for exact supported PCM layouts, offsets/length checks, partial confidence and unsupported cases.

The probe guards encoded size before File.slice, reads at most the source prefix budget and traverses at most the source work budget. A prefix may cover an entire small File; this is bounded IO, not an invocation of the unbounded waveform File.arrayBuffer path. It performs no native decode and has no production caller. Future current-request/probe lifecycle/concurrency is I.2C's responsibility; no new owner or listeners are installed here.

**The waveform governor bounds admitted optional jobs, encoded input size and estimated decoded workload. It does not guarantee total browser memory consumption. Removing its admission checks would reintroduce AUD-007's unbounded optional-work exposure.**

This describes the combined governor once I.2C activates admission. I.2B standalone only has I.2A concurrency protection in its active loading path; new size/workload decisions are testable but unconnected. Estimated PCM is ceil(duration×configured output rate)×channels×Float32 bytes; unknown-channel assumptions, inaccurate metadata, source-rate native PCM, scratch/resampling and independent playback/recording mean it is not a decoded/native memory upper bound.

## Permanent validation and controls

65 new policy/metadata assertions pass. Cases include exact profiles/default/source edits, both inclusive byte boundaries, nine-minute profiles/mono, one-hour compressed estimate, six-channel/high-source-rate PCM, estimated fallback/partial metadata, pending/unavailable/malformed duration/size/channels, overflow, contradictory headers, manual/automatic/Skip behavior, source ceilings and overrides, no IO/state/slot consumption and no scene serialization (including injected application-policy fields stripped by the preset codec). Header tests cover classic/extensible PCM widths, RIFF/chunk/frame geometry, bits/GUID/mask, unsupported codecs/containers, prefix/work budgets, odd padding and refused/rejected probe IO. Fixtures allocate only small headers/prefixes; huge durations/sizes are numeric models.

Seven disposable mutations each pass their original positive control and fail an intended assertion: full read before encoded gate; omitted PCM check; manual hard-ceiling bypass; assumed channels mislabeled verified; absolute-duration convenience gate; ignored source ceilings; NaN admitted. No harness crash counts. Temporary copies are outside Node discovery and cleaned. The read-order mutation injects forbidden IO into the pure evaluator; it does not pretend production integration exists.

Standard sequence: npm ci succeeded directly; npm test **891 total, 890 passed, zero failed, one unchanged opt-in AP_MILLION_STRESS skip**; npm run build, python scripts/verify_distribution.py and git diff --check pass. Focused policy/metadata **65/65**; combined policy/I.2A/F/G/H/recorder/schema selection **573/573**. No cache fallback, dependency/lockfile or preset-schema change. Source/evidence digests and artifact hashes are recorded. Exact final-head Linux/Windows CI is checked after push and linked in the PR handoff, avoiding self-referential tracked commit metadata.

## Native calibration and compatibility

Headless Linux native **Chromium 151.0.7922.173**, localhost, with actual small media generated by existing FFmpeg tooling (no application dependency). Eight calibration/compatibility cases pass. Native metadata transitions from NaN/readyState 0 with defer to finite loadedmetadata. Bounded WAV headers verify stereo and six-channel 96kHz input; MP3/Ogg remain unparsed and explicitly estimated. Native output dimensions are recorded only after allocation.

| Fixture | Media duration | Estimated PCM | Native output PCM | Confidence / observation |
| --- | --- | --- | --- | --- |
| 1s stereo PCM WAV, 44.1kHz | 1s | 352,800 B | 352,800 B | Verified header, 2 channels |
| 1s six-channel PCM WAV, 96kHz source | 1s | 1,058,400 B | 1,058,376 B | Verified, 6 channels at 44.1kHz; one output frame less |
| 0.75s MP3/libmp3lame stereo | 0.75s | 264,600 B | 264,600 B | Estimated 2 channels remains estimated despite matching output |
| 0.75s Ogg Opus stereo | 0.7565s | 266,896 B | 264,600 B | Media/container duration differs from decoded duration |
| 0.75s Ogg Opus 5.1 silence | 0.7565s | 266,896 B | 793,800 B | Assumed 2 versus actual 6; substantial underestimate demonstrates limitation |

Exactly **stereo MP3 and stereo/six-channel Ogg Opus** were demonstrated. No AAC/FLAC/general compressed-codec/browser breadth claim. System ffprobe and SHA-256 fixture properties are in compressed-fixtures.json; native case records include size/rate/channel/duration/confidence/assumptions and both estimated/actual bytes. Native scratch/RSS/physical reclamation and total-process caps are unmeasured. Structural headers do not prove content/decoder memory behavior.

Portable, hosted root and hosted nested all retain automatic native playback plus 512 peaks. Direct policy evaluation refuses under a test-only tiny encoded ceiling yet creates no read/decode or coordinator state change; production loading still automatically reads/decodes that same valid File. This explicitly proves no premature restrictive activation. No unexpected page/console errors or unhandled rejections.

Protected new-artifact native rechecks: I.2A **12/12** including supersession/held delivery/live transitions/seek/recording; F.6 **21/21**; G integrated **13/13**; H.1 **9/9** including idempotent refresh/hidden reveal/EOF/finalization/retained export. Existing immutable I.2A adapters only select the current version. Mic/Stream and delayed-result fixtures retain their previously disclosed fake-device/control limitations; expected injected recorder diagnostics are distinguished from unexpected errors. No protected systems are modified to satisfy these checks.

Reproduce after standard install/build (native/subprocess tools require permitted execution; production artifacts are not edited by diagnostics):

```sh
node --test --test-isolation=none tests/waveform-policy.test.js tests/waveform-metadata.test.js
python docs/audits/remediations/115m-i-i-aud007/policy-implementation/negative-controls.py work/policy-negative.json
ffmpeg -hide_banner -loglevel error -f lavfi -i 'sine=frequency=440:sample_rate=48000:duration=0.75' -ac 2 -c:a libmp3lame -b:a 128k -y work/stereo.mp3
ffmpeg -hide_banner -loglevel error -f lavfi -i 'sine=frequency=880:sample_rate=48000:duration=0.75' -ac 2 -c:a libopus -b:a 96k -y work/stereo.ogg
ffmpeg -hide_banner -loglevel error -f lavfi -i 'anullsrc=r=48000:cl=5.1' -t 0.75 -c:a libopus -b:a 96k -y work/surround.ogg
node docs/audits/remediations/115m-i-i-aud007/policy-implementation/native.cjs work/policy-native.json
```

WAV fixtures are generated in the diagnostic. Playwright/Chromium/FFmpeg are environment tools. The diagnostic compiles a policy-only helper and inserts observation hooks in served memory; neither that helper nor policy callers appear in the production build. Native build SHA-256/source digests pin provenance; final-head content/CI checks ensure the committed code matches. Initial test-import/mutation-pattern setup mistakes and corrections are transparent in attempts.json; final checks have no failures.

## Independent review and I.2C requirements

Review pure decision ordering, strict numeric/overflow handling, explicit fallback/partial confidence, supported header credibility, source overrides versus convenience profiles, manual hard ceilings, preset isolation and unchanged I.2A ownership. Draft PR remains stacked/unmerged; predecessors stay unchanged. Source modifications can substantially increase risk; single-flight remains enforced independently.

I.2C must implement/reconcile approximate profile and Ask/automatic-if-permitted/Skip UI, explicit per-track Generate, application persistence outside scene presets, current File/media identity, metadata listeners/probe lifetimes, admission/revalidation before full read/native decode, true waiting/unavailable reasons, actual-output diagnostics and binding the output rate/count to CONFIG. No in-app unlimited-memory option. offer/defer/refuse must not reserve a native decode slot. I.2D will own final integrated acceptance and broader platform/media/device checks. No later phase, merge, AUD-007 closure or Build 115N release is authorized here.
