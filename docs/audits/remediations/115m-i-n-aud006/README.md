# 115M.I.N.1 — recorder capacity investigation

Evidence-only investigation of October 9 **AUD-006**, on accepted main
`a85ed8d7cf0d670a30b5763e8576d955f7c2d285`, root `v0.1.15m.i.m`, schema 10.
Remote main was fetched and matched exactly; GitHub PR #56 reports merged with
that merge SHA. Branch: `codex/115m-i-n-aud006-recorder-capacity`.

Classification: nonproduction investigation/diagnostics. Risks are diagnostic
fixture mistakes and overinterpreting browser observations. No runtime, CONFIG,
preset, version, canonical release, historical audit, protected evidence/fixture,
waveform-governor or roadmap changes are authorized or included. Build 115N is
**WITHHELD**. This package supplies a recommendation, never human closure/shipment.

The [October 9 finding](../../../20261009-004238_project-audit.md#aud-006--recorder-has-no-retained-media-admission-limit)
(section AUD-006, lines 337–359 at baseline) remains applicable: every nonempty
delivered chunk is retained until session settlement; the previous export stays
available during replacement. The original finding was conditional, with no OOM
measurement. Its supporting [materials](../../20261009-004238_materials/README.md)
are immutable and describe their older `f5bbf2a` baseline.

**Namespaces:** October 9 AUD-006 is recorder retained-media capacity. October 6
AUD-009 describes related recorder retention; October 6 AUD-006 describes different
source/load concurrency. ROADMAP's Build 117 AUD-009 deferral uses the older
namespace. RC-06 protects the previous export; RC-19 makes terminal Dispose stop
native recording and respect track ownership. Neither adds capacity admission.

Read together: [ownership](ownership-model.md),
[characterization](resource-characterization.md), [options](policy-options.md),
[disposition](release-disposition.md), [future contract](implementation-contract.md),
and [machine-readable validation](validation.json). Evidence and reproduction
commands live in `evidence/` and the characterization document.
