# Monday deploy plan — review together, then deploy to prod

**Nothing has been pushed since the HRVerification correction. No emails sent. No deploy.**

Current state: **prod users are on `@80`** and have none of this. **HEAD has everything except one
correction**, which is sitting in the local working tree only — see §1, it's the first thing to do.

---

## 1. FIRST: HEAD is one change behind local

`HRVerificationHandler.js` is the **only** file where local differs from HEAD.

I originally guarded three writes against empty values — `siteName`, `jobTitle`, `jrTitle`. The new
render oracle then showed that was wrong for two of them: `HRVerification.html:106` submits a
**hidden `jrTitle=""`** when `jrRequired !== 'Yes'`. An empty value there means *"clear the JR
assignment"*, not *"not supplied"* — so guarding it silently disables intended clearing.

Local is now narrowed to `siteName` only, which is the actual reported bug. **HEAD still carries the
over-broad version.**

```
clasp push -f        # from employee_management_v2, via Desktop Commander
```

Then re-verify before anything else:

```
node __tests__/form-render-test.js
node tools/efx/n8n-check.js          # from employee_forms_deployment
```

---

## 2. What ships — 11 files, 4 of them nothing to do with this week's bug

| change | files | risk |
|---|---|---|
| **IT Setup section gating** | `ITSetup.html`, `ITSetupHandler.js` | medium — see §3 |
| **Equipment IT Setup step on tracker** | `RequestDetailsHandler.js` | medium — see §3 |
| **Dashboard `ReferenceError` fix** | `Dashboard.html` | none — a missing `let` |
| **Light/AODA contrast** | `Dashboard.html`, `RequestDetails.html`, `WorkflowMap.html` | none — additive, scoped to non-default themes |
| **Site Name wipe guard** | `HRVerificationHandler.js` | low |
| **`context.systems` guard** | `HRVerificationHandler.js` | low — behaviour change, see §3 |
| **Legacy category fix** (Oct 13) | `DashboardDataHandler.js` | low — **badge counts will change**, see §4 |
| **Test-admin guard** (Oct 13) | `TestRunner.js`, `SuperDebug.js`, `ProdSmokeTest.js` | none — additive |
| **Audit runners** (Oct 14) | `DashboardDataHandler.js` | none — read-only |

Totals: **+429 / −22**. Every one of the 22 deletions has a direct replacement; I reviewed each.

**`InitialRequest.html`, `ITConfirmationHandler.js` and `EquipmentRequestHandler.js` are UNCHANGED.**
The request form and the IT Confirmation form are untouched — confirmed against `@80`.

---

## 3. The three things I could not prove without a real submit

These are the review items for Monday. Everything else is either additive or data-verified.

1. **No one has submitted a gated IT Setup form.** The eight `|| fallback` values in
   `ITSetupHandler.js` exist because a hidden section no longer posts its fields; `undefined` in a
   `setValues()` row throws. Unit tests don't reach this path. **One submit on `/dev` settles it.**
2. **The dual-source IT Setup status.** The tracker now marks the step Complete if *either* an IT
   Results row exists *or* the IT action item is Closed. That matters: **19 of 20** equipment
   workflows are Closed with no IT Results row, so reading IT Results alone would have flipped them
   all back to Pending. Correct by inspection and by the data; never executed.
3. **`context.systems` now degrades instead of throwing.** Previously a null context threw, was
   caught, and returned failure *after* the writes had landed. Now it continues down the non-BOSS
   branch. Lines `:334`/`:337` already guard `context`, so emails are safe — but it fails
   *differently*, not *less*. Worth a conscious nod.

---

## 4. Expected visible change on deploy

**Dashboard badge counts will go up.** The legacy-category fix makes **6 currently-invisible tasks**
appear — 3 under Fleet, 3 under Purchasing, across 5 workflows. That is the fix working, not a
regression, but it will be noticed. Fleet 10→? and Purchasing 7→? recompute on first load.

---

## 5. Test links (all `/dev`, which always serves HEAD)

Base: `https://script.google.com/a/macros/team-group.com/s/AKfycbwIDtchHssOFkJJ4lwdFSZSjkDG_jaNg5oetT-BKaYd/dev`

| what | query |
|---|---|
| IT Setup — the reported case | `?form=it_setup&wf=EQUIP_REQ_20260831-144331_389` |
| IT Setup — control, full systems | `?form=it_setup&wf=EQUIP_REQ_20260824-145859_930` |
| Step tracker | `?form=request_details&wf=EQUIP_REQ_20260831-144331_389` |

**Paste these directly — do not navigate by clicking.** Every button in the portal is built from
`getBaseUrl()`, which returns the pinned `@80` `/exec` URL, so any click bounces you out of `/dev`
and onto the old code. That is how the "it still shows Google Account Setup" confusion happened.

---

## 6. Deploy steps (you, as `no-reply@team-group.com`)

1. Cut a new version from HEAD → `@81`
2. Repoint the **live web app** deployment `AKfycbyXp4q0…` to `@81`
3. **Do not touch** `AKfycbw7fhvI…` `@76` (JR automation, anonymous `doPost`) or `AKfycbwAb33…` `@75`
4. Load the dashboard, confirm the My Open Requests panel renders and badge counts moved
5. Open one equipment request's IT Setup form

Rollback: repoint the same deployment back to `@80`. Nothing in this batch writes a schema change or
migrates data, so rollback is clean.

---

## 7. Test status

All eight suites green, run immediately before writing this:

`super-test` 159 · `efx-test` 218 · `form-field-map-test` 315 · `dashboard-test` 27 ·
`config-test` 24 · `test-guard-test` 22 · `efx-e2e-test` 600 · **`form-render-test` 64 (new)**

Contract gate: `OK: contracts compatible with docs/contracts.lock.json`

### The new suite — `__tests__/form-render-test.js`

This is the thing that was missing when the audit failed to catch the bug. It renders each real
template against request-data fixtures and compares the output against an **oracle** — a function
that derives the expected sections from the request data alone and never reads the template, so a
form cannot rubber-stamp its own behaviour.

Covers `ITSetup`, `EmployeeIDSetup`, `HRVerification`, `Fleetio` — every form whose sections are
gated on request data and that has required fields.

**Proof it works:** pointed at the pre-fix source it **fails**; against current source it passes.

```
FORM_SRC=<pre-fix copy> node __tests__/form-render-test.js   # exits 1
node __tests__/form-render-test.js                           # exits 0
```

It also caught two things on its own: my over-broad `jrTitle` guard (§1), and that on `@80` a **new
hire needing only a Google account** is likewise forced through required Computer and Phone fields —
the defect was never equipment-specific.

### Checked and found clean
- **No test workflows in prod.** Zero rows matching the harness names (`SmkFirst`, `SdFirst`,
  `TestFirst`, …) across Workflows, Initial Requests, Terminations, Position Changes and Action
  Items. The smoke tests write to a separate dev spreadsheet.
- **EmployeeIDSetup is not a second instance of the bug.** Its SiteDocs and DSS fields are
  unconditionally required and that is correct — all **603** ID Setup Results rows have every one of
  them filled. Now asserted in the oracle so it stays that way.

---

## 8. Known, not fixed, not in this deploy

- **Quoted email username** — `getITContextData:62` strips only leading/trailing quotes
- **`RequestDetails` / `Dashboard` keyboard access** — tables and process maps are `onclick` on
  non-focusable elements; mouse-only
- **Dashboard AODA** never redefines `--success`/`--warning`/`--info` → ~1.9:1 in high-contrast mode
- **`Placeholder.html` does not exist** — `Specialist.js:23` falls back to it for any unmapped dept
- **Three incompatible `details` payload shapes** across the nine specialist forms
- **`input[type="url"]` styled nowhere** — `Review306090.html:37` renders white on the dark theme

Full inventory in `review/docs/00-INDEX.md`.
