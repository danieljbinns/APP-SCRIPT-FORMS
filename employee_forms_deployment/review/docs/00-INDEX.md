# Employee Forms — full code audit (review folder)

**Started 2026-10-14. Nothing here is deployed. Nothing here has a `.clasp.json` — these trees cannot be pushed by accident.**

## Layout

| folder | what it is |
|---|---|
| `_baseline/` | Exact copy of prod HEAD as of 2026-10-14. **Never edited.** Reference for every diff. |
| `keep/` | Copy 1 — *keep everything, fix what's broken*. No files removed. |
| `refactor/` | Copy 2 — *restructured for load/parse cost*. Files may be removed. |
| `archive/` | Anything removed from `refactor/`, preserved verbatim. |
| `docs/findings/` | One document per finding: what, why, evidence, what changed. |
| `tools/` | Analysis scripts used to produce the numbers. |

Baseline integrity verified by content hash against the live source: `cd0a2626…` on all four trees at creation.

## Method

Static analysis and **simulation** of the two Apps Script cost paths. Nothing is executed — the
functions are already proven by prod execution history; this audit is about code and load cost.

1. **Server parse path.** Apps Script concatenates every server `.js` into one global scope and
   re-parses it on *every* request. Total bytes parsed is therefore a per-request tax paid by
   every page load, whether or not the code is reached.
2. **Client payload path.** Each route's delivered HTML is its template plus everything pulled in
   by `include()` / `safeInclude()`, expanded recursively.

## Baseline numbers (prod HEAD)

- **986.9kb** of server JS parsed per request, across 47 files
- **55** top-level initialisers re-executed per request
- **435** distinct globals, **0** duplicate names
- Heaviest route payload: **325.2kb** (`initial_request` / `equipment_request` / `it_confirmation`)
- Lightest real route: **109.9kb** (`dashboard`)

## Findings

| # | finding | status |
|---|---|---|
| [001](findings/001-easter-egg-archive.md) | Easter-egg subsystem is 57% of every form page's payload | **applied to `refactor/`** |
| ~~[002](findings/002-forms-dashboard-split.md)~~ | ~~forms/dashboard split not worth it~~ | **superseded by 004 — wrong** |
| [003](findings/003-define-once-architecture.md) | Define-once architecture: options, effects, honest costs | open |
| [004](findings/004-split-and-deploy-surface.md) | 256.3kb reached by nothing; split saves ~190kb/side after that | open |
| [005](findings/005-what-the-browser-actually-gets.md) | Browser gets 289kb to deliver an 11kb form; three hosting tiers | open |
| [006](findings/006-specialist-forms-divergence.md) | Nine specialist forms, one template, twenty divergences | open |
| [007](findings/007-field-taxonomy-and-main-form-drift.md) | **The 17 field types**, plus main-form drift | open |
| [008](findings/008-dashboard-pages.md) | Dashboard `ReferenceError`, invisible text in light/AODA, cheap split | open |
| [PLAN](PLAN-three-layer.md) | DATA / UI / GAS as three callable layers | open |

## Live defects found, in severity order

Not refactor items — these are wrong today.

| what | where |
|---|---|
| Site Name silently wiped on submit | `HRVerification.html:56` + `HRVerificationHandler.js:160` |
| Row lock taken *after* the read it protects — writes can land on the wrong employee | `HRVerificationHandler.js:106` vs `:111` |
| `context.systems` dereferenced unguarded *after* 9 writes have landed | `HRVerificationHandler.js:281` |
| `_countsLoaded` never declared → `ReferenceError` kills the My Open Requests panel | `Dashboard.html:575, 586` |
| `h2 { color:#fff }` on a white card — white on white in light **and** AODA | `RequestDetails.html:84` |
| Status badges ≈1.4–1.5:1 — invisible in both non-dark themes | `RequestDetails.html:331` |
| Active tab invisible in light/AODA — the only cue for which tab is selected | `WorkflowMap.html:93-94` |
| All 12 table headers unreadable in light mode | `Dashboard.html:168` |
| `Placeholder.html` does not exist; any unmapped dept throws | `Specialist.js:23` |
| Three incompatible `details` payload shapes across nine forms | `CreditCard/Jonas/SiteDocs:46` |
| `input[type="url"]` styled nowhere — renders white on the dark theme | `Review306090.html:37` |
| Formula guard misfires on the dashboard search box | `SharedComponents.html:550-599` |
| Dashboard table and process map are keyboard-inaccessible | `Dashboard.html:881`, `RequestDetails.html:375-449` |

## Corrections made to my own analysis

Recorded so the numbers aren't re-derived wrongly later.

- **Top-level Google service calls: none.** An early scan flagged `ActionItemService`,
  `AccessControlService`, `Actor` and `_SD_LOG_CP`. All four are IIFEs — the service calls sit
  inside methods and do not run at parse time. Discarded.
- **`safeInclude()` must be followed, not just `include()`.** Missing it understated every form
  payload by ~185kb and produced a bogus 19-file "unreachable HTML" list.
- **`Router.js:198` calls `createTemplateFromFile(filename)` with a variable**, so literal-only
  scanning misses the five `ref_*` routes.
- **A name appearing in a body is not a call.** Comments and string literals must be stripped
  before building a call graph. Not doing so inflated "shared" 2.6x and produced finding 002's
  wrong conclusion. See 004.
- **`Styles.html` is included by 19 of 38 pages, not all of them.** Seven pages carry their own
  `:root` palette; there are eight palettes in total, which is why light mode and Dashboard AODA
  both fail contrast.
- **"Globals never referenced elsewhere" does not mean dead.** Editor-run tools, triggers, n8n
  aliases and `google.script.run` targets all look unreferenced to a static scan.
