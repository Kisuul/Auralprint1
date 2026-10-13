# Orb numeric contracts (examined before AUD-009 implementation)

All limits and deliberate Arrow-key increments below come from CONFIG. Its step is UI intent, not a persistence lattice. Canonical finite values clamp to limits; invalid/nonfinite values use the corresponding fallback. No string coercion. Native ranges previously snapped to CONFIG step, except designed phase. Merely opening/refreshing an editor did not rewrite canonical values, but its thumb could disagree and several readouts rounded them.

| Field | Canonical domain / semantics | CONFIG min–max; increment | Actual consumption | Bulk counterpart |
|---|---|---|---|---|
| Angular speed | Continuous rad/s | .01–3; .01 | Orb angle integrates speed × motion delta | Angular speed |
| Center X/Y | Continuous fraction | −.95–.95; .01 | Added to simulated position × minimum canvas dimension | None |
| Min/max radius | Continuous fraction | .01–.4 / .3–1; .01 | Energy interpolation; renderer orders min/max | Min/max radius |
| Waveform displacement | Continuous fraction | .01–1; .01 | Multiplies radius and channel waveform | Waveform displacement |
| Emission rate | Continuous particles/s | 10–1000; 10 | Fractional emission accumulator; emitted particles integral | Emit rate |
| Min/max particle size | Continuous CSS px | .5–6 / 1–12; .1 | Renderer interpolates size; min capped at max | Minimum/maximum size |
| Size decay time | Continuous seconds | .1–120; .1 | Particle size interpolation duration | Size decay time |
| Particle lifetime | Continuous seconds | .1–600; .1 | Expiry/fade time; canonical lifetime ≥ decay time | Lifetime |
| Placement distance | Continuous CSS px | 0–10; .1 | Squared-distance filtering, scaled by DPR; zero disables | Placement distance |
| Trace line count | Integral count (correction); previously finite fraction | 10–1000; 10 | Renderer explicitly uses `Math.ceil(numLines) + 1` retained points | Line count |
| Trace alpha | Continuous opacity | 0–1; .01 | Canvas stroke opacity | None |
| Trace width | Continuous CSS px | 1–6; 1 | Canvas stroke width × DPR | None |
| Hue offset | Continuous degrees | 0–360; 1 | Color-policy hue offset | None |
| Designed phase | Continuous radians in [0, TAU) | 0–TAU; 1 degree in radians | Initial/reset phase; modulo normalization | None |

Schema-10 preset sanitation and direct Orb changes share `normalizeOrbDef`; encoding also uses that boundary. Existing size/lifetime coupling, phase wrapping and canonical band IDs remain unchanged. Ordinary integer and continuous slider-originated values remain valid.

## Selected correction policy

Continuous controls use native `step="any"`, faithful canonical readouts, and explicit Arrow-key changes by CONFIG.step with CONFIG bounds. Home/End and pointer positioning remain native. Modified shortcuts are not intercepted. Designed phase retains its existing separate precision and keyboard handling.

Trace count normalizes once with `ceil(clamped canonical value)` in `normalizeOrbDef`. This preserves the existing renderer's effective segment count (15.5 → 16), every supported integer, and schema-10 field shape. It does not round to multiples of ten. Both individual and Bulk ranges use step 1 to represent all canonical integers, with Arrow-key increment 10 from CONFIG. Fractional schema-10 inputs remain accepted and serialize their equivalent integral rendered count. This is an explicitly authorized pre-release correction; no shipped schema or release changes.

Bulk continuous controls follow the same representation/increment policy. Mixed values keep the existing “mixed” state and are only changed by an explicit field input. Unrelated refreshes do not commit any numeric field. Reconciliation retains roots, controls, details and focus.
