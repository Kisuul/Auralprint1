# 115M.I.M — AUD-011 watcher correctness

Corrective PR: [#56](https://github.com/cosmicdance-4-2-0/Auralprint1/pull/56), draft, targeting main. **AUD-011 remains open pending independent human review and merge. Build 115N remains WITHHELD.** This correction neither changes browser runtime behavior nor accepts Build 115N/116 or AUD-006/013/014.

## Accepted baseline and scope

Fetched remote main was exactly `a2f484b845df69e717ebd3998cabb7db640eb6c6`, the merge of PR #55. Root version was `v0.1.15m.i.l`; preset schema was 10; the working tree was clean. There were no baseline discrepancies. Work uses `codex/115m-i-m-aud011-watch-correctness`, never main. [Baseline gate](evidence/baseline-gate.json) records the checks.

The original [October 9 AUD-011](../../../20261009-004238_project-audit.md#aud-011--watch-does-not-track-templateversion-inputs) and [supporting materials](../../20261009-004238_materials/README.md) remain immutable. Existing I.D/RC-20 packaging implementation and tests remain authoritative. Version advances to **v0.1.15m.i.m**, schema **10** unchanged. Runtime source differs only in the existing constants-file version comment. No CONFIG, preferences, presets, analysis, audio, source, recorder, Orb, Ring or visualizer behavior changes.

## Original behavior and root cause

[Reproduction script](evidence/reproduce.mjs) uses disposable copies and restores the accepted builder, watcher, version and constants comment from Git. It never diagnoses by changing the actual checkout's version. [Results](evidence/baseline-reproduction.json) include actual paths, bytes, hashes, timestamps and assembly events.

For each of two independent live watcher sessions, initial assembly completed successfully. Following the isolated template or version save, the probe repeatedly checked both HTML hashes and success counts for a bounded three-second observation window. Neither changed. The same process then received a JS-only positive control and successfully assembled that marker into both editions. This establishes an operational watcher and actual unchanged outputs, rather than inferring a missed event from a sleep alone.

| Observation | Accepted watcher | Corrected watcher |
| --- | --- | --- |
| Template-only save | No new assembly; both outputs unchanged. A later JS rebuild used the changed template. | Both editions update without another source save/restart. |
| Version-only save | No new filename; old title/version remained even after the positive JS rebuild. | New portable filename and both titles derive from the current canonical version. |
| Branding-only save | Not observed. | SVG and manifest saves reassemble; hosted assets and embedded portable favicon verify. |
| Change during Python assembly | Queue referred to mutable bundle files; no generation fence. | Snapshot is checked before publication; obsolete attempt is discarded and current work retained. |
| Invalid input | Version cached at import. | Clear error, no false success, prior outputs retained; corrected saves recover. |

Both accepted initial artifacts match PR #55's recorded Linux hashes: portable `84f9ebff3c1692cb24a516292d41bee0bedfb3ac1fee3d812418d752271f50c8`, hosted `826f52e798b0dcee2fe4e31c53c648109c576689e333d25bffcf2ad634aff95d`.

Root causes were separate: esbuild's dependency graph excluded assembler inputs; import-time `versionMetadata` and `paths.distHtml` remained stale; queued assembly captured metafiles but consumed mutable on-disk bundles. Two successful bundle callbacks could schedule assembly while the other bundle was rebuilding.

## Implementation and interfaces

Production changes are confined to `scripts/build.mjs` and `scripts/watch.mjs`.

- `readVersionMetadata(rootDir = projectRoot)` is exported and selects/validates root `version` for each candidate transaction. The existing safe-version validation is retained.
- Existing `versionMetadata` properties and `paths.distHtml` remain accessible through fresh getters. Importing the builder no longer fails merely because a version is temporarily invalid; a running watcher can recover from that initial condition.
- `assembleSingleFile()` remains a valid no-argument API. Optional snapshot paths, a selected metadata object and an AbortSignal let watch use the **same Python assembler and RC-20 validation** in a private stage. Its resolved metadata is additive; `npm run build`, `bundleOnce()`, `buildOnce()` and other existing exports retain their calling conventions.
- Watch retains the two esbuild contexts, now with `write:false`. Its load plugin records exact JS/CSS/JSON dependency bytes consumed by esbuild. Each completed bundle result owns its immutable output bytes and source map.
- The existing watcher exports remain available. `main()` additionally resolves an object with `close()`. An optional Node-parent IPC `{type:"shutdown"}` request provides graceful lifecycle delivery on Windows.

Watch-owned Python also receives a parent-lifetime pipe. A small standard-library launcher waits for pipe EOF with a blocking OS read in a daemon thread and exits if its Node parent disappears. It preserves script arguments/import lookup and invokes the unchanged assembler; the ordinary no-argument build keeps its existing launch path. No dependency, Python packaging implementation, supplied artwork, deployment routing, browser feature or general asset pipeline is added.

## Watch-input and ordering contract

JS/CSS source dependencies remain owned by esbuild's existing watcher infrastructure. Three fixed native directory watchers observe root `version`, `src/index.template.html`, and flat files in `src/assets/branding/`. Watching parent directories survives file replacement; events with absent filenames request a rescan. The seven packaging files are the six supplied icons and `site.webmanifest`. The unused nested `assets/`/OG subtree is outside this contract.

A named **50 ms one-shot save debounce** coalesces multiple notifications from one save. There is no new periodic polling loop. Identical input fingerprints skip assembly, including duplicate template saves. Input fingerprints identify the actual source snapshot (including paths); distribution hashes are recorded separately.

One serialized drain owns assembly. It waits for valid JS and CSS results with neither context building; reads a fresh valid version and snapshots template/branding; verifies source bytes still match the bundles; then stages the complete input set. Python writes only that stage. Before publication, the coordinator checks source/assembler bytes, directory membership, bundle-result identities and active builds again. A stale attempt logs `superseded`, queues current work and produces no success event. Events received during active work keep the dirty flag; they cannot vanish behind the active promise.

The selected version determines the staged and final portable filename, both HTML titles, and success reporting. Each successful pair uses exactly the same JS/CSS buffers. Template → version → JS → CSS and A → B → C sequences converge to the latest valid inputs. Errors in the latest inputs leave the last valid result, not a falsely successful new build.

## Failure, retention and lifecycle

Empty/unsafe/missing/unreadable version, invalid template markers, JS errors, fatal CSS syntax warnings, missing branding and failed Python attempts are observable errors. None are reported as successful. Inputs can be restored by regular writes or atomic file replacement without restarting. A startup-invalid version also recovers. Read failures identify the version path and OS error code rather than assuming a missing file. A test-only Python wrapper deliberately writes a partial staged artifact before exit 23; live outputs and published bundles survive.

Before publication all outputs are prepared. Per-file replacement avoids truncated live files. Prior bytes support rollback if a publication operation fails. A normal invalid-input, superseded or assembler-failure attempt never writes live distributions. Older **versioned portable HTML is retained**; generating B/C never deletes A. Same-version HTML, hosted output, published bundles and the metafile update on success. Explicit developer cleanup is required to prune older versions.

SIGINT/SIGTERM stop scheduling, close the three filesystem watchers, cancel/join active Python, dispose both esbuild contexts, and stop/join the owned esbuild service. Node 24's `child_process` diagnostics provide the actual esbuild handle without patching spawn or a dependency. Repeated shutdown requests share one promise. Test instrumentation confirms every observed Python/esbuild PID has exited and stages/publication temporary files are gone.

Native Windows `child.kill('SIGTERM')` is forced termination and does not deliver a POSIX handler. The parent-lifetime pipe prevents watch-owned Python from surviving that parent loss, while esbuild already exits when its service pipe closes. The integration suite exercises pipe EOF on both platforms and actual forced parent termination on Windows, checking that both Python and esbuild PIDs disappear. Windows CI also exercises graceful IPC and checks complete cleanup. Linux exercises SIGTERM during active Python and SIGINT after startup recovery. Actual Windows terminal Ctrl+C is handled by the same SIGINT path but is not separately console-injected by CI. SIGKILL, task-manager force kill, machine loss, directory replacement and broken filesystem observation are not recovery guarantees. Observation errors stop the watcher with an error status; restart after repairing the environment. The parent-lifetime check blocks on pipe EOF; it has no polling timer or periodic watchdog.

## Validation and hostile testing

[Permanent integration suite](../../../../tests/watch-integration.test.js) exercises the actual Node watcher, esbuild, Python assembler and unchanged distribution verifier in fresh temporary projects. It uses completion/error markers, sampled outputs and bounded deadlines; every modified project is discarded. No protected source file in the checkout is changed to diagnose watch behavior.

**25 focused Node test results pass** (22 integration subcases, their containing test, startup recovery and a parent-lifetime test): startup; imported JS/CSS edits; template/version-only edits; rapid mixed edits; three invalid versions/restoration; missing and unreadable version; atomic JS/CSS error recovery; invalid-template recovery/replacement; SVG/manifest changes; branding removal/replacement; partial assembler failure/recovery; saves during a blocked real assembler; duplicate events with no new assembler; repeated atomic template/version saves; active-child shutdown; initially invalid-version recovery; parent-lifetime EOF cancellation/recovery; and native Windows forced-parent SIGTERM cleanup.

[First hostile run](https://github.com/cosmicdance-4-2-0/Auralprint1/blob/bda0ea9d0a27d32c2b6a1ac558bedfc63525db06/docs/audits/remediations/115m-i-m-aud011/evidence/first-hostile-run.log) exposed a real service-reaping gap: esbuild's stop API kills an unreferenced child but resolves without waiting for `close`. That was corrected before proceeding; [corrected hostile results](https://github.com/cosmicdance-4-2-0/Auralprint1/blob/bda0ea9d0a27d32c2b6a1ac558bedfc63525db06/docs/audits/remediations/115m-i-m-aud011/evidence/hostile-corrected.log) pass with PID checks. The same first run also had a CSS assertion comparing unformatted source with esbuild-formatted CSS. That was a **harness error**, not a product defect or a meaningful negative control. An earlier wrapper-import harness error is likewise excluded. New console log files normalize trailing whitespace only; JSON events retain received text.

Required sequential local validation was executed: `npm ci` → `npm test` → `npm run build` → `python scripts/verify_distribution.py` → `git diff --check`. Result: **973 total / 972 passed / 0 failed / 1 established opt-in stress skip**. A separate focused invocation passes **25/25**, followed by another standard build and distribution verification. Nine distributable hashes agree between the standard builds. RC-20's 23 Python packaging tests remain unchanged and pass within `npm test`.

Evidence: [locked install](https://github.com/cosmicdance-4-2-0/Auralprint1/blob/bda0ea9d0a27d32c2b6a1ac558bedfc63525db06/docs/audits/remediations/115m-i-m-aud011/evidence/npm-ci.log), [full suite](https://github.com/cosmicdance-4-2-0/Auralprint1/blob/bda0ea9d0a27d32c2b6a1ac558bedfc63525db06/docs/audits/remediations/115m-i-m-aud011/evidence/npm-test.log), [focused suite](https://github.com/cosmicdance-4-2-0/Auralprint1/blob/bda0ea9d0a27d32c2b6a1ac558bedfc63525db06/docs/audits/remediations/115m-i-m-aud011/evidence/watcher-integration.log), [actual watcher events and final temporary-artifact hashes](evidence/watcher-integration.json), [build](https://github.com/cosmicdance-4-2-0/Auralprint1/blob/bda0ea9d0a27d32c2b6a1ac558bedfc63525db06/docs/audits/remediations/115m-i-m-aud011/evidence/build.log), [distribution inventory](evidence/distribution.json), [integrity](evidence/integrity.json), [validation summary](validation.json). The integrity check compares **315 protected evidence/fixture files** byte-for-byte with the accepted baseline and finds no changes. Historical audit and all earlier remediation files remain unchanged. No generated output is tracked.

Linux local toolchain: Node 24.19.0, Python 3.12.14, esbuild 0.25.12. The existing CI matrix uses Node 24/Python 3.12 on Ubuntu and native Windows. Checkout now explicitly selects the PR head SHA and the artifact step asserts the actual Git HEAD equals it. Final-head job links and SHA are recorded in [draft PR #56](https://github.com/cosmicdance-4-2-0/Auralprint1/pull/56) after the last evidence commit; earlier runs are not substitutes for that final check. No unavailable native observation is counted as a pass.

Final Linux portable is `dist/auralprint_0.1.15m.i.m.html`, **448,610 bytes**, SHA-256 `7ca224e26b120acecbb219485e009db93dc020340223c4d87a896999854de678`. Hosted `dist/hosted/index.html` is **447,441 bytes**, SHA-256 `1c3c69bec5cade5324a2f6c61c1e6dd4cc235768b80c54c102cd09af27baa9e6`. The unchanged verifier validates version/title, identical JS/CSS, embedded canonical SVG, six hosted images, complete package and package-relative metadata/manifest URLs at root/subdirectory bases. It adds no external application assets or routing assumptions.

## Remaining limits and review recommendation

Supported observation requires the project/source/branding directories to remain available; replacing an individual input is supported, replacing/remounting its watched parent directory requires restart. Build scripts, tool configuration/dependency installation and unused nested branding artwork require restart/rebuild. One watcher owns a checkout's output; simultaneous independent watch/build processes are outside this contract. Native watch delivery on unusual/network filesystems depends on the OS; explicit observation errors terminate truthfully.

A successful generation is coherent; the several output paths are **not one crash-atomic filesystem transaction**. A reader opening separate files during the brief publication sequence can observe different generations, and OS failure/denied rollback cannot be made transactional by this developer tool. Each HTML is individually complete and each completed success is checked against one intended input snapshot. Later edits cause a later transaction. These limits neither reintroduce cached versions nor permit competing Python assemblers in one watcher.

The accepted AUD-011 Definition of Done requires actual template/version watch completion, correct current metadata/paths and no mixed-version state. The permanent tests and distribution checks establish that contract, with final Ubuntu/Windows exact-head success required at handoff. Recommendation: **AUD-011 closure for human review**, not closure approval. No merge, release, canonical artifact update or 115N acceptance is authorized by this report.

## Acceptance answers

| # | Question | Result |
| --- | --- | --- |
| 1 | Template-only updates both distributions? | Yes; actual watcher and both-edition assertions. |
| 2 | Version-only updates filename and both editions? | Yes; new portable path and both titles verify. |
| 3 | Root version read fresh? | Yes; per-candidate immutable metadata selection. |
| 4 | Invalid versions refused? | Yes; empty/unsafe values log errors without success. |
| 5 | Simultaneous edits create mixed-version artifacts? | No in completed successful generations; one selected version and snapshot. |
| 6 | Overlapping rebuilds conflict in Python? | No; serialized drain, trace confirms at most one assembler. |
| 7 | Earlier successful artifacts preserved on failure? | Yes; staged invalid/partial attempts do not publish. Older versions are retained. |
| 8 | Corrected inputs recover? | Yes, including initial invalid version and source/assembler/branding failures. |
| 9 | Replacement and duplicate events handled? | Yes; directory observation, content deduplication and repeated atomic-save tests. |
| 10 | Termination releases watchers/subprocesses? | Yes for supported graceful signals/IPC; owned Python and esbuild exit, stages are removed. Forced OS kills are outside that guarantee. |
| 11 | Standard fresh-build API compatible? | Yes; unchanged invocation and RC-20 verification pass. |
| 12 | Linux and Windows checks pass? | Local Linux passes. Exact implementation-head Ubuntu and Windows CI both pass; final evidence-head links are in PR #56. |
| 13 | Branding-only monitoring included? | Yes; flat supplied icons/manifest. Unused nested artwork remains excluded. |
| 14 | Accepted AUD-011 Definition of Done met? | Yes; local and exact implementation-head CI meet it. The final evidence head is checked before handoff; independent human review remains required. |

## Exact implementation-head CI

Both jobs passed at `69306353c6e64635b57969a69cabd172eab94b32`: [run 38611034832](https://github.com/cosmicdance-4-2-0/Auralprint1/actions/runs/38611034832), [Ubuntu](https://github.com/cosmicdance-4-2-0/Auralprint1/actions/runs/38611034832/job/116014110702), [Windows](https://github.com/cosmicdance-4-2-0/Auralprint1/actions/runs/38611034832/job/116014110195). Each reports **973 total / 972 passed / 0 failed / 1 established skip**, verifies actual checkout HEAD, builds both editions and passes unchanged distribution contracts. Windows explicitly reports that Python and esbuild exited after native forced parent SIGTERM. [Structured CI evidence](evidence/ci-implementation.json) and [Ubuntu](https://github.com/cosmicdance-4-2-0/Auralprint1/blob/bda0ea9d0a27d32c2b6a1ac558bedfc63525db06/docs/audits/remediations/115m-i-m-aud011/evidence/ci-ubuntu-excerpts.log)/[Windows](https://github.com/cosmicdance-4-2-0/Auralprint1/blob/bda0ea9d0a27d32c2b6a1ac558bedfc63525db06/docs/audits/remediations/115m-i-m-aud011/evidence/ci-windows-excerpts.log) excerpts preserve those observations. This final documentation/evidence commit gets another exact-head matrix; its SHA and job links are recorded in PR #56 before stopping for review.

Ubuntu's nine distributable hashes equal the local inventory. Windows portable is **448,658 bytes**, SHA-256 `8973856c23755ce6f92ddf5f1005ad6937b468535db011b1aef5006449f33971`; hosted index is identical to Linux. The portable difference is exactly reproduced by substituting the Windows CRLF checkout of the single embedded SVG payload, with the Windows source/hosted SVG hash independently matched. This preserves the existing I.D contract and introduces no artwork or line-ending normalization. Both [CI hash inventories](evidence/ci-windows-distribution.json) are recorded alongside the [Ubuntu inventory](evidence/ci-ubuntu-distribution.json).

**115M.I.M PASS — AUD-011 CLOSURE RECOMMENDED FOR HUMAN REVIEW.** This is a recommendation; AUD-011 remains open until independent review and merge. **Build 115N remains WITHHELD.**
