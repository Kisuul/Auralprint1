# 115M.I.G / G.2 — AUD-003

Accepted G.1 head: `0b8ddc43c36c941c51b3dbce25a1d50e7fb8692d` on
`codex/115m-i-g-aud005`, draft PR #48. G.1 implementation is accepted;
integrated I.G acceptance remains pending. G.2 is a separate implementation commit.
Version remains `v0.1.15m.i.g`, preset schema remains 10, and Build 115N remains
**WITHHELD**. No G.3, release promotion, other AUD correction or Build 118 work is included.

## Reproduction and ownership

`agents.md` and the original immutable [AUD-003 finding](../../../20261009-004238_project-audit.md#aud-003--accepted-band-counts-do-not-constrain-orb-targets-or-picker-choices)
were read. The accepted branch/tree was clean; PR #48 was open/draft, its head
matched G.1, and accepted Build 115 main `230610bc33ab7e3a4842e53e5be48c9170222739`
is an ancestor. G.1 inventory code/evidence remain byte-identical.

Actual current-code baseline, not only historical audit evidence:

| Bank count | Authored targets | C energy at band 0 | Selected energy | Selected dominant | Picker |
|---|---|---|---|---|---|
| 3 | `[255]` | 0.5 | 0 | 255 (nonexistent) | 256 ordinary choices; 255 range `n/a` |
| 3 | `[0,255]` | 0.5 | 0.25 (diluted) | 0 | 256 ordinary choices; no inactive description |

Schema-10 sanitation retained those targets. Actual BandBank L/R/C arrays each
had length 3. The Node reproduction is in `evidence/baseline-runtime.json`;
Chromium reproduces the same values/picker problem in `evidence/baseline-native.json`.
The baseline native result is 4/4 successful assertions of the original defect,
not four corrected acceptance cases.

Ownership remains CONFIG → preferences → derived runtime settings → ephemeral state.
Preset normalization owns canonical integer target validation; BandBank owns computed
bands/arrays; AnalysisFrame exposes producer-owned references; VisualizerRuntime owns
analysis consumption/composition; OrbEditor owns commits by stable Orb ID; its picker
owns only derived presentation and drafts. No analysis arrays or authored target lists
are mutated by runtime filtering/rendering.

## Two domains and runtime correction

The canonical, persistable target domain is `0 ... CONFIG.bandNames.length - 1`
(currently 0–255). Integer-only sanitation, first-occurrence ordering, duplicate
elimination, legacy names, presets and duplication are unchanged. There is no new
persisted target field and no pruning when count shrinks.

For each selected L/R/C channel, active runtime indices must be integer/nonnegative
and below its actual energy-array length, the canonical limit, and the current
AnalysisFrame low/high bank-array boundaries when supplied. This uses real producer
arrays, not a second fixed active count. Reduced-channel/missing-array fixtures are
handled defensively. Only active indices enter the numerator, divisor and selected
dominant comparison. Finite energy values clamp to [0,1]; nonfinite/nonnumeric entries
contribute zero for an existing active band. No epsilon or artificial positive response
is introduced. First-active-target ties follow authored ordering. The loop is O(targets)
with no new per-frame filtering arrays, Sets or repeated canonical sanitation.

Corrected results at count 3:

| Selection | Targeted energy | Selected dominant | Meaning |
|---|---|---|---|
| `[]` | `null` override | `null` | selected channel's full-spectrum response |
| `[255]` / `[100,255]` | 0 | `null` | authored nonempty selection, wholly inactive |
| `[0,255]` | active band 0 only | 0 | inactive target excluded from divisor |
| `[0,2]` | average of active 0 and 2 | strongest active target | both active |

With band 0 energies L=0.9, R=0.1, C=0.5, `[0,255]` gives precisely those independent
selected values, not 0.45/0.05/0.25 or a combined-C substitution. Native checks also
verify actual Orb radius/waveform displacement through the real runtime lifecycle.

The ColorPolicy module is unchanged. Inherited target-aware dominant coloring uses
the active selected dominant. All-inactive/null-selected dominant retains its existing
global dominant fallback. Explicit dominant remains global combined-C. Existing Scene
fixed/angle policies, shared palette, Ring color and particle behavior are unchanged.

## Picker and exact editor

Ordinary choices, search results, numeric maxima and range validation use active count
from canonical runtime settings (also the picker's default when no getter is injected).
At count 3 they offer 0,1,2. Inactive indices have no ordinary active-frequency option.
Existing row nodes are cached/reused across count transitions; rows above a reduced
count are hidden/disabled even when the chooser is closed, and get an explicit inactive
status rather than a fabricated frequency. Increasing count reenables cached rows or
lazily creates new ones. Picker identity, open details, active surviving controls,
search drafts and range drafts are preserved. Existing editor reference guards remain.
No global registry, refresh-loop optimization or additional count limit is introduced.

Selection summaries/accessible text distinguish active and inactive targets, list
inactive indices, and explain reactivation by raising count. For example:
`1 active target · 1 inactive target (255). Raise the band count to reactivate.`

Checkbox changes preserve existing authored order/inactive targets and append a newly
selected active index. Range commits deliberately replace the active part with the
chosen ascending range and retain inactive indices in their existing order. Full
Spectrum explicitly clears the whole list. Search/count changes never commit targets.
Listeners attach once per generated row; reusing a row does not duplicate them.

The existing advanced exact-index field is the small explicit authoring/removal path:
it accepts canonical 0–255 even if some entries are inactive, reports current active
0–(count−1) separately, and clearly says editing this field replaces all targets.
It intentionally does not constrain authored input to active count or clamp it.
Valid inactive input is identified as inactive, not invalid. Truly invalid text (e.g.
`0, 256, nope`) remains visible/invalid until corrected. Unrelated settings/count
changes do not overwrite it. A deliberate picker selection clears that stale exact-field
error and shows the newly committed selection. Different Orb editors remain independent.

This avoids a new inactive-target management interface while preserving authoring
compatibility and providing an unambiguous way to remove an inactive index.

## Regression and native evidence

25 new permanent tests cover original/mixed/all-inactive/empty responses, dominant
eligibility/ties, actual array/bank boundaries, malformed runtime data, L/R/C and color,
canonical sanitation/legacy names/schema-10 roundtrip, duplication, ordered sparse and
invalid imports, count transitions/reactivation, picker choices/search/limits/default,
checkbox/range preservation, Full Spectrum, exact invalid drafts, editor independence,
and G.1 inventory focus during bank preset changes.

Node transition coverage includes 256→32→256, 256→3→256 and 3→32→3 with empty,
active, mixed, wholly inactive, duplicated, malformed and sparse ordered selections.
Actual BandBank rebuild/channel lengths are checked; valid authored targets and all
other Orb fields remain unchanged. Share/import/duplication preserve original indices.
RC-16 and RC-21 tests are byte-identical and pass. Two old expectations were corrected
without removing assertions: missing selected-channel arrays now yield zero targeted
response, and `[1,999]` averages active C band 1 alone (0.4, dominant 1), not 0.2.

`evidence/fixed-native.json`: **31/31** Chromium cases pass. They exercise production
schema-10 Apply, channel controls, picker checkboxes/ranges, exact entry, Full Spectrum,
share/reload, 256→32→3→256, editor node/focus/drafts, and all four G.1 inventory actions.
Count-3 `[255]`, `[0,255]`, `[0,2]`, count-32 `[5,100,255]`, count-256 reactivation and
empty selection have deterministic numeric energy/dominant/radius/color assertions.
There are no page or console errors. `evidence/g1-native.json`: the unchanged G.1
native runner additionally passes **38/38** on the new built application.

Instrumentation is disclosed:

- The observed route adds only a `window.__g2` reference to existing application objects
  and functions in browser-served memory; it does not write production source or replace
  analysis/runtime functions. The original built-HTML SHA-256 is recorded.
- Controlled channel energies fill actual BandBank arrays. Deterministic AnalysisFrame
  samples supply distinct L/R/C full energy/waveforms, and the existing VisualizerRuntime
  updates the real application Orb. Results are observed synchronously before another
  animation callback. This validates downstream analysis consumption, not native FFT
  extraction or arbitrary media frequency estimates.
- Channel/preset/picker/exact actions dispatch normal production controls. Count changes
  use normal schema-10 Apply because count remains a non-editable Analysis readout.
- The checkbox/range/Full Spectrum flow runs separately on completely unmodified portable
  HTML and inspects persistence through normal share export.
- Native focus checks use actual `document.activeElement`, connectivity and node equality.
  Headless Chromium on Linux/HTTP uses `--no-sandbox`. Node mocks are reported separately.

## Negative controls and validation

`diagnostics/negative.py` detects **8/8** isolated semantic mutations through relevant
`ERR_ASSERTION` failures: missing-entry divisor, inactive dominant, all-inactive/full
conflation, preset pruning, ordinary picker ignoring count, checkbox dropping inactive
indices, failed runtime reactivation, and L/R using combined-C energies. No syntax error,
TypeError, crash or harness failure counts as detection. Accepted source is never changed;
all copies are temporary. Results: `evidence/negative-controls.json`.

Final focused suites: **299/299 pass**. Complete `npm test`: **749 pass, 0 fail,
1 established skip (750 total)**. Locked dependency install, portable/hosted build,
`python scripts/verify_distribution.py`, and `git diff --check` pass. Local install uses
the previously approved provisioned locked-cache fallback (`--offline --cache
/workspace/auralprint-environment/npm-cache --no-audit --no-fund`) with no dependency,
package or lockfile changes. Node 24.19.0/npm 11.9.0/Python 3.12.14 are supported.
Artifact hashes are in `evidence/distribution.json`; native evidence matches final bytes.
Linux/Windows CI is verified on the exact final PR head after publication; its run link
and result are recorded in the PR description/final handoff, not claimed in advance.

Only the three expected production modules change. All 747 other previously tracked
files, including G.1 code/evidence, historical audits, CONFIG, preferences, codec,
BandBank, ColorPolicy, recorder/source modules and version/schema files remain byte-identical.
`validation.json` records commands, outcomes and the exact changed-file inventory.
An interim full-suite failure exposed the old `[1,999]` dilution expectation; the final
run above passes with its corrected numeric/dominant assertions.

After install/build, opt-in reproduction:

```sh
node docs/audits/remediations/115m-i-g-aud003/diagnostics/native.cjs --output fresh-native.json
python docs/audits/remediations/115m-i-g-aud003/diagnostics/negative.py
```

For baseline, build accepted G.1 in a separate checkout and use `native.cjs --baseline
--html /absolute/path/accepted-portable.html --output fresh-baseline.json`.
Playwright/Chromium are diagnostic environment tools, not application dependencies.

## Accepted limits and Build 118 boundary

**Indices refer to the current bank's positions, not permanently anchored frequency
ranges.** Changing count/distribution can change an active index's frequency interval;
this correction preserves index intent and never remaps approximate frequencies.
Build 118 owns the BandBank redesign, 2,048-band taxonomy and frequency-range persistence.
There is no speculative preparation for them and no fix for AUD-004/008/009 here.

Native coverage is automated Chromium on Linux over HTTP, not screen-reader,
physical assistive-device, universal browser/OS or performance certification. A picker
checkbox made inactive by shrinking the bank becomes unavailable; native focus stability
is verified for surviving range/editor and inventory actions, not a hidden disabled option.
Canonical model sanitation removes malformed imported targets; runtime defense is not a
second persistence sanitizer. Independent review and integrated I.G acceptance remain
separate from this targeted implementation. PR #48 remains draft/unmerged; G.3 is not begun.
