# Refactor Plan: New Hire Specialists → Action Items

## Goal
Replace the 9 specialist result sheets + HTML forms + Specialist.js routing with the
existing Action Items system already used by Status Change workflows. Termination
specialist steps (asset collection, safety offboarding) fold in too.

**Result:** ~11 sheets deleted, ~10 HTML files deleted, dashboard loading simplified,
every future specialist step = zero new files or sheets.

---

## Dev Environment Setup (do once before starting)

1. Open the dev Apps Script project in the browser IDE
   - scriptId: `1VI9tR0GCxwTmcuXiGBzTkDJVXXB94Hr3PpdnuDq-aBpDKKQGMKhA9U_L`
2. Delete ALL existing files in the editor (they are old .gs files — the new codebase uses .js)
3. In the dev spreadsheet Script Properties, set:
   - `SPREADSHEET_ID` = `1KeWBbh8755mRXFSK2dCeSW75djpaPgtprbmqd7BAsMA`
   - `DEPLOYMENT_URL` = the dev web app URL (get after first deploy)
4. From `employee_management_v2_dev/` run `clasp push` — should succeed cleanly
5. Deploy as web app, grab the URL, set `DEPLOYMENT_URL` in Script Properties
6. Run `initializeSystem()` from the editor to create all sheets
7. Populate Data_Lookup sheet (copy from staging or re-run setup)

---

## Phase 1 — Extend Action Items for Specialist Tasks

**Goal:** Make Action Items support form-based completion (not just acknowledge/close),
so specialists can fill out structured data before marking complete.

### 1a. Add `formType` and `formData` fields to Action Items schema
- `MigrateColumns.js`: add `Form Type`, `Form Data` to `Action Items` expected schema
- `Setup.js`: add same two columns to `initSheet` call for `Action Items`
- `ActionItemService.js`: add optional `formType` param to `createActionItem()`

### 1b. Update Action Item completion view to render specialist forms inline
- `ActionItemView.html` (or equivalent): if `formType` is set, render the appropriate
  form fields instead of a generic notes box
- Form types to support: `creditcard`, `businesscards`, `fleetio`, `jonas`,
  `centralpurchasing`, `sitedocs`, `safety_onboarding`, `safety_term`, `review_306090`
- On submit: write structured data to `Form Data` column (JSON), mark item complete

---

## Phase 2 — New Hire: Replace Specialist Emails with Action Items

**Goal:** After IT Setup completes, create Action Items instead of sending specialist
email links.

### Files to change: `ITSetupHandler.js`

Current flow (lines ~280–330): sends individual emails for each specialist with a
`?form=specialist&dept=X` link.

New flow: for each specialist needed, call `ActionItemService.createActionItem()` with:
- `workflowId`
- `category` = specialist name (e.g. 'Credit Card')
- `assignee` = appropriate team email (same as current email recipients)
- `formType` = specialist key (e.g. 'creditcard')

Remove the individual specialist email sends. Send one consolidated email to each
team (or one summary email) listing their assigned Action Items with links.

---

## Phase 3 — Safety Onboarding: Replace Specialist Form with Action Item

Currently fires from `IDSetup.js` (hourly) and `HRVerificationHandler.js` (salary)
via `sendSafetyOnboardingEmail()`.

Replace `sendSafetyOnboardingEmail()` with an `ActionItemService.createActionItem()`
call with `formType: 'safety_onboarding'`. Remove the function entirely.

---

## Phase 4 — Termination: Fold in Remaining Specialist Steps

Safety Termination and Asset Collection currently use separate sheets/forms.

- Replace `SafetyTermination.html` flow with an Action Item (`formType: 'safety_term'`)
- Replace Asset Collection with an Action Item (`formType: 'asset_collection'`)
- `Asset Collection Results` sheet → deleted
- `Termination Approval Results` can stay (approvals are a different pattern)

---

## Phase 5 — Dashboard: Simplify Checklist Loading

**File: `DashboardHandler.js`**

Current: `getWorkflowChecklist()` calls `checkSheet()` once per specialist sheet (8+ reads).

New: one read of `Action Items` sheet, filter by `workflowId`, map each item's
`status` to done/pending. Replace the entire per-sheet loop.

---

## Phase 6 — Cleanup

Delete once all phases tested and confirmed working:

**Sheets (via `initializeSystem()` schema update):**
- Credit Card Results
- Business Cards Results
- Fleetio Results
- JONAS Results
- SiteDocs Results
- 30-60-90 Review Results
- Central Purchasing Results
- Safety Onboarding Results
- Safety Termination Results
- Asset Collection Results

**Files:**
- `Specialist.js` — entirely removed
- `CreditCard.html`
- `BusinessCards.html`
- `Fleetio.html`
- `Jonas.html`
- `SiteDocs.html`
- `CentralPurchasing.html`
- `SafetyOnboarding.html`
- `SafetyTermination.html`
- `Review306090.html`

**Config.js / MigrateColumns.js:** remove all deleted sheet references

---

## What Does NOT Change

- `InitialRequest.html` — untouched
- `HRVerification.html` / `HRVerificationHandler.js` — untouched
- `EmployeeIDSetup.html` / `IDSetup.js` — minor (remove safety email call)
- `ITSetup.html` — untouched
- `TerminationRequest.html` / `TerminationHandler.js` — minor (remove asset collection form send)
- `PositionSiteChangeRequest.html` — untouched
- All approval forms — untouched
- Email notification logic in `EmailUtils.js` — untouched
- Dashboard UI — untouched (only the data-loading backend changes)

---

## Risk / Rollback

- Dev only until fully validated
- Staging remains live and untouched throughout
- Each phase is independently testable before moving to the next
- If dev is abandoned, staging promotes to prod as normal
