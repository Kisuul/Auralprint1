# 115M.I.G / G.1 — AUD-005

Accepted base: `230610bc33ab7e3a4842e53e5be48c9170222739` (main, merged PR #46).
Bug fix only. Development version advances from `v0.1.15m.i.f` to
`v0.1.15m.i.g`; preset schema remains 10. Build 115N remains **WITHHELD**.
Main later advanced to `c37e65116aa67ea837fa8468a71da4ad1ae5b5bd` during the pause; its tree
is byte-identical to the accepted base, and the working branch retains that base.
G.2/G.3 and other findings are excluded. This record does not close independent
acceptance or revise F.1–F.6 history, shipped releases, ROADMAP or current-status docs.
Required current-status documentation updates are deferred to an approved pass.

## Original defect and ownership trace

The immutable source audit is [AUD-005](../../../20261009-004238_project-audit.md#aud-005--inventory-rebuild-loses-focus-after-unrelated-preference-changes).
`agents.md` was read before implementation. CONFIG still owns defaults/limits;
preferences own persisted configuration, `resolveSettings()` owns derived runtime
settings, VisualizerRuntime owns participants, Visualizers owns inventory/actions,
and Workspace owns panel visibility/global focus transitions.

Production volume/mute handlers mutate `preferences.audio` and call `UI.applyPrefs()`.
It normalizes preferences, calls `resolveSettings()` (a deep-cloned new snapshot),
`VisualizerRuntime.syncSettings()` (particle policy only), and `syncOrbsFromSettings()`
(in-place surviving Orb properties). This path keeps the runtime collection array.
The animation refresh calls `UI.refreshAllUiText()` then `visualizersPanelUi.refresh()`.
Previously either reference change triggered a complete `replaceChildren()` render.
A new settings reference therefore detached focused actions even with unchanged
membership/order. Successful `loadAndPlay()` calls the same `applyPrefs(null)` after
asynchronous File activation and produces the same defect.

Add/Duplicate/Remove use canonical Orb-runtime callbacks, which resolve settings and
reconcile runtime composition. Runtime `reconcile()` publishes a new array even if
identities survive; `rebuild()` also changes adapters. `preferences.orbs[]` determines
composition order; persistent Orb IDs are never array positions. Channel/target
presentation can change with the same collection array and a new settings snapshot.
Ring `isVisible()` reads active settings; Orb participants currently report visible.
The inventory must use those lifecycle results rather than preference guesses.

Chromium 151.0.7922.173 reproduced the present baseline, not just the audit's older
snapshot: focused `BUTTON/edit/ORB0` became `BODY`; old action disconnected, row
replaced, stable ID unchanged, Edit still available. A native H key then reached
the global hide shortcut. Delayed real WAV completion produced the same loss.
Both reproductions had no page errors; see `evidence/baseline-native.json`.

## Reconciliation and focus behavior

Only `src/js/ui/visualizers-panel.js` changes functional production behavior.
A panel-local Map caches presentation nodes keyed by `JSON.stringify([type, id])`.
JSON tuple encoding is unambiguous for opaque IDs. Ring `spectral-ring` and an Orb
literally named `spectral-ring` have distinct rows, Edit nodes and dispatch paths.
This Map is presentation state, not another runtime collection or global registry.

An invalidated refresh projects the actual runtime participants, retains surviving
rows/actions, updates only changed name, visibility, summary and accessible labels,
creates new rows, removes deleted rows, and walks an insertion cursor to put retained
rows in composition order. Numbering follows current Orb order; IDs remain persistent.
Unrelated snapshots/equivalent arrays cause no row replacement. The existing two-reference
fast return remains O(1), without inventory projection or node walks on unchanged
animation frames. Invalidated refresh is O(n) in JavaScript Map lookup/traversal;
there is no pairwise search, generic framework, dependency or smaller Orb cap.

Ordinary presentation updates keep the exact focused action connected. A native
`insertBefore()` can blur a moved row even while retaining node identity, so the
render captures inventory focus and restores only that exact surviving node when
necessary. External focus is never captured/restored by reconciliation. Workspace's
hide/restore/launcher code and global interactive-target shortcut suppression are
unchanged. No new document-level keyboard handler exists.

Successful Add/Duplicate still explicitly focus the created Orb's Edit. Refused
operations still return before refreshing/focusing; admission uses CONFIG's 4,096
ceiling. Edit, Duplicate, Remove and Ring Edit retain canonical callbacks and one
list-level delegated listener. Reconciliation invokes no action callbacks.

Removing a focused Orb retains the same next-position/previous-position nearest
surviving Edit fallback, or Add when no Orb survives. Cancellation/failed removal
leave focus and collection intact. Removal applies its fallback only when the removed
row held focus: deleting another Orb preserves a surviving action or external focus.
Confirmation wording and policy are unchanged.

## Permanent tests and native evidence

`tests/visualizers-panel.test.js` covers unchanged-reference fast return, new snapshots
and equivalent arrays, all action identities, in-place summary/visibility, reorder and
ARIA numbering, Add/Duplicate, nearest/final/other/cancelled removal, opaque type-ID
collision, zero Orbs, refused admission, delegated listener counts, callback IDs and
external focus. Existing 4,096-Orb admission coverage remains active.

Eight new `tests/targeted-audit.test.js` integration tests execute actual production
volume/mute handlers, settings application and delayed File completion for each action.
Existing RC-22 removal tests retain fallback/ownership assertions and add survivor-node
identity. Harnesses now support insertion/sibling navigation; the bounded harness
models move-induced blur. Existing click helper/removal setups explicitly focus the
action before delegated dispatch, matching native user activation. Tests no longer
expect an unrelated removal to steal focus. Node mocks are not native accessibility
validation.

`evidence/fixed-native.json`: **38/38** native Chromium cases pass against built portable
HTML over localhost. The exact retained nodes remain focused/connected after volume,
mute, actual asynchronous File completion, Ring visibility, summary updates and reorder.
Native H/N/P/arrow behavior remains suppressed on inventory buttons (a second real
queued File makes an unintended Next action observable); native Enter/Space
activate Edit/Add/Duplicate/Remove. Nearest/final/cancelled Remove, other-Orb removal,
external focus and the literal `spectral-ring` collision pass.

Instrumentation is limited and disclosed:

- Volume/mute/visibility use DOM event dispatch through normal production controls so
  inventory focus can remain in place. A physical click on Volume would intentionally
  focus Volume first. Inventory activation keys are real Playwright keyboard events.
- File selection uses real synthesized stereo WAV File bytes, native HTMLMediaElement
  decoding/playback and native Web Audio. An AudioContext subclass calls native suspend
  on construction and holds the first resume until released; it forwards to native resume.
  This widens the pending window without changing application source or success behavior.
- Reorder/summary/collision use the normal share-export/schema-10 URL Apply control;
  `history.replaceState()` avoids an extra hashchange apply. Preset application retains
  inventory nodes; independent RC-22 runtime tests prove surviving Orb instance/history
  identity through runtime reconciliation. No production bundle internals are exposed.
- Focus observation uses actual `document.activeElement`, `isConnected` and node equality.
  Headless Chromium with `--no-sandbox` and autoplay enabled runs in the managed environment.

## Negative controls

`diagnostics/negative.py` runs six isolated source variants in temporary copies, without
editing accepted production code. All six fail relevant behavioral assertions with
`ERR_ASSERTION`: original `replaceChildren`, ID without type, summary-only row rebuild,
removed reorder focus restoration, omitted nearest-survivor fallback and accumulated
click handlers. No syntax error or harness crash counts as detection.

`diagnostics/native-negative.py` removes only the focus restoration statement from a
copy of built HTML. Chromium detects focus falling to BODY for reordered Edit, Duplicate
and Remove despite their exact nodes remaining connected. The three later summary cases
also fail because they inherit that lost focus; those are recorded as dependent failures,
not additional independent detections. Unaffected cases pass. Accepted artifacts remain
unchanged. Compact records are in `evidence/negative-controls.json` and
`evidence/native-reorder-control.json`.

## Validation and reproduction

Supported local toolchain: Node 24.19.0, npm 11.9.0, Python 3.12.14.
The normal network install could not reach the sandboxed proxy. Locked installation
succeeded using the provisioned npm cache with `--offline --cache
/workspace/auralprint-environment/npm-cache --no-audit --no-fund`; package/lock/dependencies
were not changed. Subprocess-enabled execution was required for esbuild and Chromium.
No toolchain substitution was needed; the obsolete environment activation script was
not needed for the successful sequence.

Focused suites: **219/219 pass**. Complete `npm test`: **724 pass, 0 fail, 1 established
skip (725 total)**, including existing AUD-001/AUD-002, Orb admission/identity and Workspace
focus protections. `npm run build`, `python scripts/verify_distribution.py` and
`git diff --check` pass. Portable/hosted artifact hashes are recorded in
`evidence/distribution.json`. Version declarations/exact tests are aligned; schema is 10.
All 586 pre-existing documentation/release files and excluded production modules remain
byte-identical (`evidence/integrity.json`). No generated output is tracked.

One interim full-test attempt hit a 8-GiB cgroup OOM while formatting a failed circular-DOM
assertion in an old removal test. The unchanged directory-creation test passed in isolation;
accurate action focus setup fixed the behavioral expectation, and the complete suite then
passed. Interim install/test failures are disclosed in `validation.json`; they are not
acceptance passes. Linux/Windows CI must be checked on the exact final draft PR head;
its verified result/run link is recorded in the PR description and final handoff.

After a normal install/build:

```sh
node --test tests/visualizers-panel.test.js tests/targeted-audit.test.js tests/rc22-orb-removal.test.js
node docs/audits/remediations/115m-i-g-aud005/diagnostics/native.cjs --output fresh-native.json
python docs/audits/remediations/115m-i-g-aud005/diagnostics/negative.py
python docs/audits/remediations/115m-i-g-aud005/diagnostics/native-negative.py
```

Playwright/Chromium are diagnostic environment tools, not application dependencies.
To repeat baseline reproduction, build accepted SHA in a separate checkout and pass its
portable HTML to `native.cjs --baseline --html /absolute/path/baseline.html --output
fresh-baseline.json`. Negative source controls require the accepted commit in local Git.

## Limits and independent acceptance

Native validation is automated headless Chromium on Linux over HTTP; it does not claim
screen-reader, physical assistive-device, universal browser/OS or 4,096-Orb smoothness
validation. Actual native visibility/composition is settings/collection-driven in the
current application. Mutating both participants and settings in place without publishing
either reference bypasses the established invalidation contract; no such production
mutation path was introduced. Arbitrary external deletion of inventory DOM is unsupported.

AUD-005 is ready for independent acceptance once exact-head Linux/Windows CI passes.
The PR remains draft, unmerged, and limited to G.1. No other AUD finding, entire I.G
revision, later phase or withheld release is marked complete.
