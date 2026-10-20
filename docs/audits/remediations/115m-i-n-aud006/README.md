# 115M.I.N.1 — recorder capacity investigation

Evidence-only investigation of October 9 **AUD-006**, on accepted main
`a85ed8d7cf0d670a30b5763e8576d955f7c2d285`, root `v0.1.15m.i.m`, schema 10.
**AUD-006 — NARROW CORRECTIVE POLICY RECOMMENDED BEFORE 115N.**

Recommend a CONFIG-owned hybrid admission/Stop/failure policy after explicit
human decisions; no numeric factory limits are justified by this host alone.

Remote main was fetched and matched exactly; GitHub PR #56 reports merged with
that merge SHA. Branch: `codex/115m-i-n-aud006-recorder-capacity`.

Classification: nonproduction investigation/diagnostics. Risks are diagnostic
fixture mistakes and overinterpreting browser observations. No runtime, CONFIG,
preset, version, canonical release, historical audit, protected evidence/fixture,
waveform-governor or roadmap changes are included. Build 115N is
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

Validation: **23 modeled cases**, **11 native capacity recordings** including a
60-second capture, real download/native replay and retained-export/source checks;
unchanged native RC-06 and six RC-05 probes pass. **347 focused tests pass**;
full suite **973 total / 972 pass / 0 fail / 1 existing opt-in skip**. Locked install,
build, distribution verification and whitespace checks pass. Native memory and
device acceptance remain limited as documented; no future policy mutations ran.

Before corrective implementation: approve bounded-use product expectations and
target workloads/devices; calibrate/select S/H/C/headroom; approve tail/admission
failure semantics, preserve-export cancellation/native-failure recovery, duration
policy and truthful UI wording. See the [exact decisions](release-disposition.md#exact-decisions-required-before-implementation-begins).
