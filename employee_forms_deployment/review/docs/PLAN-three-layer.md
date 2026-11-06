# Plan — DATA / UI / GAS as three callable layers

Goal, restated: **three separable layers, each callable from anywhere, nothing defined twice.**
The forms are one client. n8n is another. The dashboard is a third. None of them owns the logic.

Nothing in this plan touches prod. The test build is a new project in a new place.

---

## The target

```
   DATA                 GAS FUNCTIONS                UI
   reference data  <->  handlers + validation  <->   static pages
   workflow rows        one contract                 one component library
                        no HTML, no templates        no business logic
                              ^
                              |
                   n8n, dashboard, future apps
```

**Rule for each layer:**

- **UI** knows layout and field *references*. No validation rules, no column numbers, no business
  logic. A form is: which fields, in what order, in what sections.
- **GAS** knows the rules. Every handler is an API endpoint, callable identically by a form, n8n, or
  anything else. Validation lives here, once — which is what makes the Site Name wipe impossible,
  because today `required` lives in HTML and so the n8n path never had it.
- **DATA** knows storage and indexing. A view asks for `sites`; it does not receive the workbook.

---

## Layer 1 — GAS as pure API

**What it becomes:** `doPost` with an action router, plus the handlers. No `doGet` serving HTML, no
templates, no `include()`, no `HtmlService`.

```
POST /exec   { action: "hrVerification.submit", auth: <token>, payload: {...} }
POST /exec   { action: "lookup.get", auth: <token>, payload: { index: "sites" } }
```

**Already proven here:** the `@76` deployment is exactly this shape — an anonymous `doPost` that n8n
drives, with 20 `n8n_*` aliases over the same handlers the forms use. The pattern works in
production today. This layer is mostly *deleting* `doGet`, not inventing something.

**What moves out:** 38 HTML files, `Styles.html`, `SharedComponents.html`, `RequestHeader.html`,
`SuccessScreen.html`, every `serve*` function, `Router.js`'s `doGet` switch.
**What is deleted:** the 256.3kb that nothing reaches (finding 004).
**What stays:** handlers, `SchemaConstants`, `Config`, `EmailUtils`, `EmailTemplates`,
`WorkflowManager`, `StateSync`, `ActionItemService`, `AccessControlService`, `ValidationUtils`.

**Per-form function index** — needed before anything moves, so each form knows what it owns.
Partially built already (finding 004 §1): `SUBMIT hr_verification` reaches 51 globals across 18
files; `VIEW hr_verification` reaches 9 across 8. The remaining forms need the same treatment.

**Dashboard:** same shape, its own handlers (`DashboardDataHandler`, `RequestDetailsHandler`,
`DashboardActionsHandler` — 50.1kb exclusively its own), its own UI. Separate app, identical rules.

---

## Layer 2 — UI as static pages

**What it becomes:** plain HTML/CSS/JS on CloudFront. One stylesheet, one component library, field
types defined once. Browser caches it all **once for the whole app** instead of re-downloading 33kb
of CSS on every form open.

Today HR Verification ships **289,109 bytes to deliver an 11,045-byte form** — 3.8%. Static hosting
plus the component library should put a form near 40kb, cached after the first visit.

**A form becomes:**

```html
<form data-action="hrVerification.submit">
  <section>
    <h2>Employee</h2>
    <div data-field="FIRST_NAME"></div>
    <div data-field="SITE_NAME"></div>
  </section>
</form>
```

Everything else — markup, label, validation, options source — comes from the field registry
(finding 003). The page is layout and references. That satisfies "all field types and CSS should be
ref not detailed here", and it is what makes a shared component set possible at all.

**This is the layer the three running inventory agents are producing input for:** the complete field
inventory, the minimum field-type taxonomy, and every place two forms express the same thing
differently.

---

## Layer 3 — DATA behind an index

**The problem today:** every lookup is a full-sheet read, and a form fetches whole lists.
`getHRVerificationData` alone does ~6 full-sheet reads for one workflow; one successful submit runs
~45–60 Sheets round trips, roughly 25 of them re-reads of sheets already in memory.

**The target:** `lookup.get({ index: "sites" })` returns only that list. One indexed accessor, one
cache, one place that knows where data lives.

**Constraint that shapes this:** `Data_Lookup` is hand-edited in the spreadsheet. The sheet must stay
the editing surface. So:

- **Phase 1 — keep Sheets, add the index.** One `DataService` with a per-execution memo and a
  `CacheService` layer. Removes the redundant re-reads with no migration. Cheap, safe, independently
  valuable.
- **Phase 2 — only if needed.** Reference data to a real store (DynamoDB is the cheap fit), with the
  sheet syncing into it on edit. Workflow rows almost certainly stay in Sheets — that is the system
  of record and people read it directly.

**Do not move the data store in the first pass.** Phase 1 gets most of the win and risks nothing.

---

## The hard part: authentication

This is the one thing that can sink Layer 2, and it has no cheap version.

Today every handler trusts `Session.getActiveUser()` — `AccessControlService.canViewForm()`,
`Actor.email()`, the admin checks, the per-group form gating. A static page on CloudFront **has no
Google session to pass**, and the `@76` pattern can't be copied because it authenticates with a
shared secret, which cannot be shipped to a browser.

**What it actually takes:**

1. Google Identity Services in the page → user signs in once → browser holds an ID token.
2. Token sent with every API call.
3. GAS verifies the token server-side and derives the email from it.
4. `Actor.email()` reads the verified identity instead of `Session.getActiveUser()`.

Step 4 is the real work: every call site that assumes an active Google session has to change. **One
auth for all forms** — your instinct is right, it is signed in once at the CloudFront layer, not per
form — but it is a genuine project, not configuration.

**This is why the test build matters.** Auth is the risk; everything else is mechanical.

---

## Feasibility

| layer | verdict | why |
|---|---|---|
| GAS as API | **proven** | `@76` already does it in prod |
| UI static | **straightforward** | plain web work, no GAS constraints |
| DATA index phase 1 | **straightforward** | one service, no migration |
| **Auth** | **the risk** | unproven here; gates everything |
| DATA phase 2 | defer | not needed to prove the shape |

---

## Test build — what it proves, and nothing more

**One form, end to end, in a new project. Prod untouched, no shared resources.**

HR Verification, because it is already audited line by line and its defects are known.

1. **New Apps Script project** — API only. `doPost` router, HR Verification handler, a copy of the
   schema, one `lookup.get`.
2. **New spreadsheet** — a copy, so nothing writes to real data.
3. **Static page** on S3/CloudFront — the form built from the field registry, one stylesheet, one
   component library.
4. **Google Identity Services** sign-in → ID token → verified in the GAS API.

**Three questions it answers, all of which are currently assumptions:**

- Does browser-OAuth → GAS token verification actually work end to end? *(the gating risk)*
- How fast is a static form vs the current ~2.0s floor? *(decides whether any of this is worth it)*
- Does the field registry express a real form without special cases? *(decides finding 003)*

**Blocked right now:** the AWS connector reports "connection invalidated — needs reconnecting from
connector settings". Nothing can be deployed to S3/CloudFront until that is reconnected. The Apps
Script side and the static build can both proceed locally in the meantime.

---

## Order

1. Finish the per-form inventories *(3 agents running)*
2. Field-type taxonomy → the field registry *(finding 003)*
3. Per-form function index *(extends finding 004)*
4. Data index phase 1 — kills ~25 redundant sheet reads per submit, independent of everything else
5. Test build, HR Verification, new project
6. Decide the rest on what step 5 measures

**Steps 1–4 are worth doing even if the test build says stop.** They are the define-once work, and
they stand on their own.

## Not in scope

Prod. Any existing deployment. The `@76` n8n endpoint. The live spreadsheet.
