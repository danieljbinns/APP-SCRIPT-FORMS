# Web app review target — post-deploy code  (snapshot 2026-09-18)

**Read-only. Do not edit, do not push. No `.clasp.json` here on purpose. Findings only.**

## What this is

A `clasp pull` of **HEAD** of the PROD Apps Script project
(`1AuIbJl1jRh1awi-MW-6y_NftHUGtfUNRexZk1gPzvenmIblSZo-lPz66`), 2026-09-18. 86 files.

This is the code that **will serve the web forms** once the live `/exec` deployment is updated to a
new version (planned next working day). Review against this, not against the currently-served
version — findings about code that is about to be replaced are wasted effort.

Already reflected here, so **do not report these as problems**:

- `BOSSReviewHandler.js` is **deleted**. Its duplicate `submitITConfirmation` is gone.
- `ENVIRONMENT = 'PROD'` in `Config.js`.
- 7 EFX files added (`N8n.js`, `N8nEnvelope.js`, `EfxApi.js`, `EfxUtil.js`, `FormContracts.js`,
  `Actor.js`, `EmployeeIdRegistry.js`) and ~470 changed lines across 17 existing files.

## Scope of the review

**Pre-existing web-app code quality.** This is not a review of the 2026-09-18 EFX work. Known areas
of interest, from the person requesting it:

- **Stray text outside tags/brackets** in the HTML templates.
- **Duplicate declarations across server files.** Apps Script concatenates and evaluates *every*
  server file in one global scope in load order, so a `function`/`const` defined twice silently
  collides — last one wins, no error, no module isolation. `BOSSReviewHandler.js` was one instance
  and is already fixed; look for others.
- **Duplicate / conflicting CSS**, particularly across `Styles.html`, `component-styles.html` and
  per-form `<style>` blocks, which get included together.
- **Include-order effects** — `HtmlService` templating pulls partials in, so the same partial can be
  emitted more than once in a rendered page.

41 `.js` and 38 `.html` files. There are **no `.gs` files**; everything server-side is `.js`.

## Context worth having

Two versions are serving traffic right now. Humans are on the pre-EFX version until the deployment
is updated; only the n8n automation path (`scripts.run`) runs this code today. A snapshot of the
currently-served version is in `employee_management_v2_webform_live_v75/` if a before/after
comparison is ever useful — otherwise ignore it.

The EFX merge was deployed to Apps Script but **never committed to git**, so
`employee_management_v2/` in the repo does not match this folder. Reconciling that is a separate
task and is not part of this review.

Line endings here are CRLF; the `employee_forms_efx` fork is LF. Normalise before any diff.
