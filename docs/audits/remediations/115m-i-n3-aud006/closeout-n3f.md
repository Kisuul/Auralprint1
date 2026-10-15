# N.3F closeout addendum

Narrow follow-up to the accepted recorder-capacity implementation. Version remains
`v0.1.15m.i.n`; preset schema remains 10. Build 115N remains **WITHHELD**.

The fetched branch and PR #59 review head were
`7866967160291782c6a0265f9d936c68b364f892`. PR #59 had already been merged;
accepted main was `bfb06e78b7673d23ebc756283a54854a6c43fa5c`. The same development
branch was fast-forwarded to that accepted merge before changes. The owner
approved a new draft follow-up, [PR #60](https://github.com/cosmicdance-4-2-0/Auralprint1/pull/60).
Its final body/checks record the exact ending head and final-head CI. Production
implementation commit: `b94fde8e8175f5cb89eb43bbdab81c525de93571`.

Only three production files change:

- `src/index.template.html`: labelled decimal-MB, minute and integer-chunk controls,
  independent On/Off states, exact-value readouts and precise-entry explanation.
- `src/js/recording/recording-policy.js`: named `DECIMAL_BYTES_PER_MB` (1,000,000)
  and `MILLISECONDS_PER_MINUTE` (60,000), frozen input-unit metadata,
  `parseResourceInput`, `formatResourceInput`, `selectionFromResourceInputs` and
  application-settings `setFromInputs`.
- `src/js/ui/recording-resources.js`: text-to-policy boundary, lossless display,
  human-readable factory summaries and explicit independent-limit explanation.

Ordinary inputs are decimal MB and minutes. Decimal strings convert through exact
integer/rational arithmetic, then must resolve to positive whole canonical bytes,
milliseconds or chunk counts within CONFIG's safe-integer domain. Invalid syntax,
sub-unit results, overflow and policy-relationship errors are shown inline;
values are not rounded or clamped. Scientific notation and digit grouping are
not accepted in entry fields.

Every safe canonical byte value has a finite exact decimal-MB display. Milliseconds
whose minute representation repeats display as a reduced fraction of a minute:
`300001/60000` minutes preserves 300,001 ms; `1/60000` preserves 1 ms. The duration
field accepts these fractions explicitly, including at the maximum safe integer.
Other values use ordinary decimal minutes, such as `120` for two hours. Applied
canonical values are also visible below the inputs. Applying a one-field edit,
profile switching or reloading cannot round untouched settings.

Stored values remain canonical integer bytes/milliseconds under the unchanged
`auralprint.recording-resources` format 1. No migration, preset/URL field or
additional persistence domain is introduced. Duration Off leaves size/chunk
controls active; Unrestricted retains the existing truthful risk statement and
null S/H/R/C/T. Factory values, admission, native lifecycle, owned-resource cleanup,
export replacement and finalization ordering are unchanged.

Ten targeted policy/UI regressions were added to the two existing test modules:
decimal and fractional precision, safe-integer boundaries, invalid/overflow input,
relationships, one-field edits, arbitrary canonical reloads, each independent Off
state, in-page persistence failure and frozen active policy. The focused recorder
policy/governor/Settings/export/ownership/transport set passes **298 tests**.
The full suite has **1,041 total / 1,040 pass / 0 fail / 1 existing opt-in skip**.
Locked install, build, both distribution contracts and whitespace checks pass.

New native UI evidence exercises actual minute-based automatic Stop and a frozen
current session after editing its next-session duration. The resulting 465,223-byte
WebM (VP9 + Opus) downloads, replays and decodes. Native hard admission fails the
new capture while preserving the prior export hash; keyboard Download and Cancel
remain usable during delayed finalization and panel hide/reveal. Native Stop is
observed once per tested session. Narrow layout, precise reloads, overflow feedback
and session-only Unrestricted pass. Real-HTTP portable, hosted and relocated-hosted
settings controls pass. Fresh RC-03/04/05/06/19 and Cancel-at-EOF probes pass.

All **1,089 baseline files** outside the five intended source/test changes remain
byte-identical, including protected fixtures, RecorderEngine, CONFIG, version,
README.md, ROADMAP.md, agents.md, historical development notes, original audits
and all earlier remediation evidence. No general documentation cleanup is included.
See [closeout validation](closeout-evidence/validation.json), protected blob check,
native UI, distribution UI and fresh regression JSON reports in that directory.
Optional native tools remain externally provisioned; no dependency was added.

Native observations are Linux Chromium only, using generated media and deliberate
terminal-handler delay. They do not establish physical-device, other-browser,
perceptual fidelity, exact native-duration or process-memory guarantees. Those
existing broader acceptance limits are not expanded or closed in this pass.
No unresolved corrective unit/persistence or demonstrated recorder regression was
identified. Documentation reconciliation remains explicitly deferred.

**AUD-006 CLOSEOUT READY — Implementation complete; independent final review required.**

Do not merge, close the audit finding or authorize shipment automatically.
**Build 115N remains WITHHELD.**
