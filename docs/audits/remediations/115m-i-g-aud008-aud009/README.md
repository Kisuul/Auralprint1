# 115M.I.G / G.3 — AUD-008 and AUD-009

Starting accepted G.2: `bf43c45137b1851d568a4d6644f59047bacabc76`; G.1 `0b8ddc43c36c941c51b3dbce25a1d50e7fb8692d` remains intact. Draft PR #48 is open, based on accepted `230610bc`; current main's `c37e651` merge has an identical tree. Development version stays `v0.1.15m.i.g`, preset schema 10. Build 115N remains WITHHELD; independent integrated I.G acceptance is not performed here.

## AUD-008

Both `1e-307` and `Number.MIN_VALUE` reproduced ratio overflow and 253 zero-energy bands at count 256, ceiling 22,500 Hz and sample rate 48 kHz, under uniform −50 dB FFT input (range −100…0). Finite final edges concealed the collapse. Ordinary floor 20 did not collapse. An intentionally collapsed floor/ceiling remains a legitimate empty interior interval.

The correction interpolates endpoint logarithms, exponentiates interior positions and keeps endpoints exact. It never forms `ceiling / floor`. Floor band, open-ended top band, Nyquist ownership and other distributions are unchanged. Nondecreasing edges, not strict separation, are the contract: binary64/subnormal rounding can make adjacent boundaries equal for sufficiently narrow intervals. No minimum floor or invented epsilon coverage is introduced. Band indices still refer to current bank positions, not fixed frequency ranges; Build 118 owns extended taxonomy and frequency targeting.

Permanent tests in `band-bank.test.js` cover counts 3/4/32/256, subnormal and other tiny floors, ordinary 20, near/equal ceiling, schema-10 import/encode, actual L/R/C energies, default log spacing, unchanged other distributions and the production controller's Nyquist cap. Focused bank/count tests: 20 passed. Five isolated semantic negative controls were detected by assertions. Four native Chromium geometry matrices passed using the built portable application.

## AUD-009 baseline and policy

The accepted built application reproduced canonical speed 0.123456 versus native 0.12, canonical trace count 15.5 versus native 20, and actual renderer output 16 segments. Bulk controls showed the same discrepancy. The field-by-field contract and selected policies are recorded in [numeric-contracts.md](numeric-contracts.md), before implementation. AUD-009 implementation/verification follows in a distinct commit after AUD-008.

## Reproduction and instrumentation

Run from repository root:

```sh
node docs/audits/remediations/115m-i-g-aud008-aud009/diagnostics/geometry.mjs
node docs/audits/remediations/115m-i-g-aud008-aud009/diagnostics/native.cjs --geometry-only --output /tmp/g3-geometry.json
python docs/audits/remediations/115m-i-g-aud008-aud009/diagnostics/mutations.py
```

Native runner requires externally available Playwright and Chromium; no application dependency is added. It serves the built portable HTML and exposes existing module objects in an in-memory observed route. Production preset application still uses schema-10 URL payloads and the actual Apply button. Controlled synthetic FFT data runs through actual BandBank extraction. For counting trace segments, a temporary counting Canvas context and sufficiently long synthetic retained-point sequence call the actual public Renderer.drawOrb entry; source, renderer behavior and built file are untouched. This is disclosed instrumentation, not a claim of uninstrumented audio-device testing. Node fixtures and native results are separate evidence. Baseline mode accepts `--baseline --html /path/to/accepted.html`. Historical audit and accepted G.1/G.2 records remain immutable.
