# Build 115N documentation reconciliation — working audit

**Status:** Initial documentation-only checkpoint; broader editorial and source-comment audit not yet complete. **Build 115N remains WITHHELD.**

**Verified starting main:** `1bd8ef65b3589f0d1ef321edaf07e177d94ced01` (merged PR #60). Development revision `v0.1.15m.i.n`; preset schema 10. Public canonical Release 3 / Build 113 remains unchanged; Build 114 is internally shipped. This document is a current working audit, not a historical remediation rewrite or shipment authorization.

## Method and authority

Compare statements about **current** project behavior against accepted `main`, current CONFIG/version/build code, merged PRs, and evidence. Preserve the meanings and explicit constraints of [agents.md](../../agents.md) and [ROADMAP.md](../../ROADMAP.md); distinguish code-level corrective acceptance from 115N physical browser/media/artistic/release acceptance. Historical audit/remediation documents are dated snapshots: language such as "awaiting review" can be accurate **inside the original report** and must not be rewritten to make it look contemporaneous.

Current documentation responsibilities:

| Document | Primary responsibility |
| --- | --- |
| Root `README.md` | Project identity, startup/build instructions, high-level shipped/development status |
| Root `ROADMAP.md` | Current features, authority, scope, staged plan, release gates and deferrals |
| Root `agents.md` | Binding architecture, interface, state/preset and agent change contract |
| `docs/development/build-115.md` | Development chronology and accepted corrective disposition |
| `docs/development/build-115-release-delta.md` | Prospective editorial comparison from **public 113** and **internal 114**, not a published changelog |
| `docs/Canon/changelog.md` | Historical shipped differences; **not** a home for unreleased 115 changes |
| Dated audits and `docs/audits/remediations/` | Preserve original investigation, methodology, measured evidence and historical status |

### Repository inventory and link audit

GitHub recursive-tree inventory at the initial document checkpoint: **1,230 tree entries**, **927 tracked files under `docs/`**, including **91 Markdown files**; most files under `docs/` are test/evidence assets, not editorial prose. An initial scan of the five active reference documents (README, ROADMAP, agents, Build 115 history, release-delta draft) found **143 relative Markdown links at the accepted baseline**. Their **file targets all exist**. The first working-tree link pass after edits counted **144** relative links with **zero missing file targets**. All **15** fragment references identified in that pass target observed headings or explicit anchors; this is a targeted existence check, not an exhaustive external URL or rendered-Markdown/link-parser certification.

This pass has **not** performed an exhaustive semantic audit of all dated Markdown, source comments, all links/assets, or historical assertions. Do not imply otherwise.

## Phase A: verified current-status corrections

All corrections are restricted to four living editorial files; there are no changes to application code, CONFIG, presets, build tools, tests, canon artifacts, original audits, earlier remediation reports or their evidence.

| File | Before (accepted main) | Corrected current statement | Evidence |
| --- | --- | --- | --- |
| `README.md`, build instructions | Example portable filename ends in `0.1.15m.i.l` | Derived filename now ends `0.1.15m.i.n` | Root `version` and versioned build output contract |
| `README.md`, watcher and Build 115 table | Watcher PR "awaiting review" | PR #56 merged; stage/release acceptance remains separate | PR #56 merge `a85ed8d7` |
| `ROADMAP.md`, current recorder paragraph | N.3 "pending independent review", not merged | Investigations #57/#58 and implementation #59/#60 all merged; release still withheld | PR #59 merge `bfb06e78`; PR #60 merge `1bd8ef65` |
| `ROADMAP.md`, stage-13 history | Watcher marked open, incorrectly associated with revision N | AUD-011 watcher revision **M**, merged via #56; N.3F recorder merge through #60 | PR #56 and #60 merged; root `version` |
| `ROADMAP.md`, deferral ledger | Ambiguous "AUD-006" for earlier source/load issue | Explicit **October 6 AUD-006** to distinguish **October 9 AUD-006** recorder | Both dated audits; existing Build 117 deferral |
| `docs/development/build-115.md`, current header | Reports development revision M | Current revision N; a short accepted PR #56–#60 update added, without rewriting prior chronology | `version` and merged PRs |
| `docs/development/build-115-release-delta.md`, draft header | Revision M; watcher awaiting review | Current revision N and merged #56/#57/#58/#59/#60 | Version + PR merge state |

Historical in-file statements remain historical: notably the watcher remediation report's original draft/open status and N.3F report's original draft-PR state. Those reports are **not defects simply because their creation-time status later changed**.

## Findings queued for the dedicated editorial audit

These are **review targets**, not permission to change contracts:

1. **Authority and overgrowth:** Root README and ROADMAP contain overlapping project chronology; review for repetition and maintain concise current truth without discarding milestone intent, user guidance or gate conditions.
2. **Agent contract organization:** `agents.md` places headings `5.5` and `5.6` after heading `12`. Consider a strictly content-preserving relocation, checking internal/external anchors, rather than rewriting architecture policy.
3. **Application-settings exceptions:** `agents.md` states preferences are the only writable long-lived state yet allows independent Recording Resources; README also describes independent waveform controls. Review **actual** persistence ownership before reconciling exception language. Do not imply an undocumented architecture change.
4. **Current audit disposition:** The Build 115 history index mainly covers October 6 RC findings and October 9 AUD-007; the watcher/recorder corrections live in later sections and reports. Consider a concise current-status pointer/index (clearly distinguishing separate audits with colliding IDs) without reproducing entire remediation narratives.
5. **Release-delta editorial currency:** The draft predates N.3 and may omit recording-resource policy as a prospective user-visible Build 115 change. Reconcile against actual source and **both** baseline artifacts without publishing notes or conflating internal Build 114 with public Build 113.
6. **Source comments and stale terminology:** Inventory `src/js`, `scripts/`, tests and shipped-facing template copy for comments describing superseded module lifecycle, version, platform or UX ownership. Report exact locations and compare against executable behavior **before** changes.
7. **Proof language:** Replace unsupported universal safety, performance, device, codec, precision or browser claims in *living docs* with conditions matching executed native evidence. Do not erase honest uncertainty.
8. **Link/render validation:** Complete fragment, relative-asset, generated portable/hosted instructions and rendering checks. External URLs and dated historical reports need separate treatment.
9. **Documentation volume:** Audit for duplicated tests/evidence/result tables, generated verbosity and repeated release disclaimers. Prefer a stable owner plus links, not giant repeated narratives. Historical reports are exempt from editorial pruning.

## Boundaries for the next pass

- Documentation and verified stale comments only; no production logic, setting/preset schema, CI/build behavior or version changes.
- Treat `agents.md` as binding policy; any semantic change requires explicit owner approval and separate interface impact analysis.
- Preserve shipped `docs/Canon/` artifacts and changelog, original dated audits, earlier remediation evidence and exact historical observations.
- No blanket search/replace of "open", "draft", "awaiting", version strings or historical SHAs.
- Keep changes reviewable in small commits with an evidence ledger and before/after assertions. A documentation-only CI pass is still required.
- Separate **corrective engineering closure** for October 9 AUD-006 from broader Build 117 optimization and pending 115N release gates.
- Do not infer formal release/canonization from owner field tests, merged PRs or documentation corrections.

## Checkpoint

**Phase A:** Four living docs corrected, initial file-target link validation successful, audit backlog established. This branch is a review checkpoint, **not** a completed repo-wide documentation audit. Full semantic/comment/editorial reconciliation and 115N acceptance remain separate tasks.
