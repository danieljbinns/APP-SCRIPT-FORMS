# Web form — what users actually see  (version 75, snapshot 2026-09-18)

**Read-only. Do not edit, do not push. No `.clasp.json` here on purpose.**

## What this is

Version **75** of the PROD Apps Script project — the code behind the `/exec` deployment humans
load (the one whose id ends `…A9RMg`). This is the real, currently-served web form.

41 `.js` files, 38 `.html` files, 80 total. No `.gs` files: everything is `.js` server-side.

Versions 75 and 76 are **byte-identical in code**; they differ only in deployment metadata. So this
is equally the code behind the other pinned deployment.

## Why this folder and not `employee_management_v2_prod_live_20260918/`

That other snapshot is **HEAD**, which includes the EFX layer deployed 2026-09-18. HEAD is served
only to the n8n automation path (`scripts.run`). **Humans do not see HEAD.** For a review of what
users experience today, this folder is the correct target.

## What this review is for

Pre-existing code quality in the web form — **not** anything from the 2026-09-18 EFX work. Known
areas of interest:

- **Stray text outside tags/brackets** in the HTML templates.
- **Duplicate declarations across server files.** Apps Script concatenates and evaluates *every*
  server file in one global scope, in load order, so a `function`/`const` defined in two files
  silently collides — last one wins. There is no module isolation.
- **Duplicate / conflicting CSS rules**, particularly between `Styles.html`,
  `component-styles.html` and per-form `<style>` blocks, which are included together.
- Include order effects generally: `HtmlService` templating pulls partials in, so the same partial
  can land more than once in a rendered page.

## Notes for whoever reviews

- Line endings are **CRLF** here. The `employee_forms_efx` fork is LF — normalise before any diff.
- `BOSSReviewHandler.js` is present in this version and contains a duplicate `submitITConfirmation`.
  That duplicate is a genuine example of the collision problem above. It was deleted on HEAD, but it
  is still live for web users until a new version is cut.
- Findings only. No changes, no pushes — this folder cannot deploy.
