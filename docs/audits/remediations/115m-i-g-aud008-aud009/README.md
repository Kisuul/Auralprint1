# 115M.I.G / G.3 — AUD-008 and AUD-009

Starting accepted G.2: `bf43c45137b1851d568a4d6644f59047bacabc76`; G.1 `0b8ddc43c36c941c51b3dbce25a1d50e7fb8692d` remains intact. Draft [PR #48](https://github.com/cosmicdance-4-2-0/Auralprint1/pull/48) is based on accepted `230610bc`; current main's `c37e651` merge has an identical tree. Development version stays `v0.1.15m.i.g`, preset schema 10. Build 115N remains WITHHELD; independent integrated I.G acceptance is not performed here. AUD-008 was independently committed as `6506ff588c7250dafaba5a4618f948dadd418fb0` before AUD-009 implementation. The following commit contains AUD-009 and integrated evidence.

## AUD-008

Both `1e-307` and `Number.MIN_VALUE` reproduced ratio overflow and 253 zero-energy bands at count 256, ceiling 22,500 Hz and sample rate 48 kHz, under uniform −50 dB FFT input (range −100…0). Finite final edges concealed the collapse. Ordinary floor 20 did not collapse. An intentionally collapsed floor/ceiling remains a legitimate empty interior interval.

The correction interpolates endpoint logarithms, exponentiates interior positions and keeps endpoints exact. It never forms `ceiling / floor`. Floor band, open-ended top band, Nyquist ownership and other distributions are unchanged. Nondecreasing edges, not strict separation, are the contract: binary64/subnormal rounding can make adjacent boundaries equal for sufficiently narrow intervals. No minimum floor or invented epsilon coverage is introduced.

At count 256 the corrected mid-interior boundaries are approximately `4.743416490252404e-152` for floor `1e-307` and `3.3341381242276124e-160` for MIN_VALUE, instead of 22,500 Hz. Both have zero collapsed bands under the uniform fixture. Floor equal to ceiling still has 254 legitimately zero-energy interior bands. FFT resolution is unchanged; extremely low intervals can share the same FFT bin.

Permanent tests cover counts 3/4/32/256, subnormal and other tiny floors, ordinary 20, near/equal ceiling, schema-10 import/encode, actual L/R/C energies, default log spacing, unchanged other distributions and production-controller Nyquist limiting. Initial bank/count tests: 20 passed. Five isolated semantic negative controls detected unsafe ratio, wrong endpoint, reversed ordering, broken Nyquist cap and changed default spacing. Four native built-application geometry matrices passed before the separate AUD-008 commit.

## AUD-009

The accepted built application reproduced canonical speed 0.123456 versus native 0.12, readout 0.123, canonical trace count 15.5 versus native 20, and actual renderer output 16 segments. Bulk controls showed the same discrepancy. [numeric-contracts.md](numeric-contracts.md) records the field-by-field contract and policies before implementation.

Continuous native ranges now use `step="any"`; primary numeric readouts and accessible descriptions retain canonical precision. The derived angular-speed degree equivalent remains formatted for readability. Local Arrow-key handling preserves CONFIG increments and limits, without a document interceptor. Designed phase retains its existing precision/wrapping/keyboard policy. Native control serialization is binary64 formatted by Chromium (roughly 15 significant digits); exact canonical persistence is separately verified and never rewritten by a refresh.

Trace count uses `ceil(clamped value)` in the single existing `normalizeOrbDef` boundary shared by import, direct Orb edits, Bulk edits and serialization. Thus 15.5 becomes 16, matching the renderer's already-existing effective count. Every supported integer is preserved; pointer controls represent step 1, while Arrow keys retain CONFIG's ten-line increment. Fractional development schema-10 inputs remain accepted and save their equivalent rendered integer count. No codec/renderer change or schema bump is needed. Invalid/nonfinite fallback, size/lifetime coupling and phase normalization remain unchanged.

Editors update controls in place. Unrelated settings and band-count changes preserve values, roots, open details, focused controls, scroll position, invalid exact-band drafts and authored inactive indices. Explicit individual input changes only that Orb; explicit Bulk input changes only that field, with existing “mixed” behavior intact.

## Validation and limits

43 new permanent tests: seven geometry regressions, 17 numeric normalization/persistence/renderer tests, 17 generated-editor tests and two real UI commit-path integration tests. Final focused run: 326 passed. Final full suite: 792 passed, zero failed, one intentional skip (793 total). Locked install, portable/hosted build, distribution verification and diff whitespace checks passed; exact commands and changed-file inventory are in [validation.json](validation.json).

Native Chromium 151.0.7922.173: 27 G.3 cases passed (including the four geometry matrices), plus preserved G.1 38/38 and G.2 31/31. Existing RC-17 native driver passed its six scenarios at DPR 1/2, including designed-phase keyboard/endpoint behavior and real stereo WAV playback. G.1 includes delayed real File completion, normal button keyboard activation/global-shortcut suppression and add/duplicate/remove/reorder focus transitions. G.2 includes bank-count transitions, reactivation, L/R/C response and color policy. All page/console error checks passed.

Seven AUD-009 negative controls were detected: continuous canonical rounding, floor rather than ceiling count normalization, retained fractional counts, renderer/display disagreement, Bulk unrelated overwrite, coarse native step and native focus loss during refresh. The last two execute actual Chromium. No syntax errors or harness failures count as detections.

Final-head Linux/Windows CI is reported in the PR description/checks and final handoff after publication; this committed record makes no premature CI-success claim. Native runs are Linux headless Chromium with localhost-served portable HTML; no universal browser, screen-reader or audio-device acceptance claim. Canonical preset roundtrips remain exact for continuous values, with the documented equivalent integral trace normalization. Indices refer to current bank positions, not fixed frequency ranges. Build 118 taxonomy/frequency architecture remains deferred. G.1/G.2 records and protected modules are byte-identical to accepted G.2 except the expressly scoped numeric extension in orb-editor; [integrity evidence](evidence/integrity.json) verifies the untouched paths. Historical audit and shipped releases are untouched. Current-status documentation reconciliation remains for a later approved pass.

## Reproduction and disclosed instrumentation

Run from repository root:

```sh
node --test tests/band-bank.test.js tests/band-count-coverage.test.js tests/orb-numeric-contract.test.js tests/orb-editor.test.js tests/preset-schema-10.test.js tests/rc17-phase-editor.test.js tests/targeted-audit.test.js
node docs/audits/remediations/115m-i-g-aud008-aud009/diagnostics/geometry.mjs
node docs/audits/remediations/115m-i-g-aud008-aud009/diagnostics/native.cjs --output /tmp/g3-native.json
python docs/audits/remediations/115m-i-g-aud008-aud009/diagnostics/mutations.py
python docs/audits/remediations/115m-i-g-aud008-aud009/diagnostics/mutations-numeric.py
```

Native runner requires externally available Playwright and Chromium; no application dependency is added. `CHROMIUM_PATH` overrides `/usr/bin/chromium`. It serves built portable HTML and exposes existing module objects in an in-memory observed route. Production preset application uses schema-10 URL payloads and the actual Apply button. Synthetic FFT data runs through actual BandBank extraction. Trace segment counting temporarily substitutes a counting Canvas context and a sufficiently long synthetic retained-point sequence, calling actual public Renderer.drawOrb. Native control/focus APIs, actual handlers, explicit pointer and keyboard events and live runtime Orb values are observed. An uninstrumented portable route independently verifies native controls and share/reload. Source, renderer behavior and built artifact remain untouched by diagnostics. Node fixtures and native results are recorded separately. Baseline mode accepts `--baseline --html /path/to/accepted.html`; `--geometry-only` checks AUD-008 independently. Existing G.1/G.2 and RC-17 drivers retain their previously disclosed instrumentation, with new results written only here. Mutation scripts use disposable copies/in-memory artifact substitutions and never edit accepted production code.
