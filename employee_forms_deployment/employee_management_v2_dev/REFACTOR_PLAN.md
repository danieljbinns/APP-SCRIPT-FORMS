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

---

## Production Data Migration Plan

> Run this migration **once**, immediately before promoting dev to prod.
> Staging stays live until the cutover is confirmed complete.

### Pre-migration checklist

- [ ] All phases fully tested in dev (end-to-end new hire and termination flows)
- [ ] Staging is in a stable state with no in-flight forms awaiting specialist completion
- [ ] Migration window agreed with HR/IT (recommend early morning, < 5 min window)
- [ ] Backup prod spreadsheet: File → Make a copy (keeps all sheet data)

---

### Step 1 — Add `Form Type` + `Form Data` columns to prod Action Items

These two columns are appended without touching existing data.

1. Open the prod Apps Script editor
2. Run `previewMissingColumns()` — confirm it lists `Form Type` and `Form Data` under `Action Items`
3. Run `addMissingColumns()` — safe, append-only

---

### Step 2 — Backfill historical specialist results into Action Items

Existing specialist result sheet rows (pre-refactor) should be migrated so the dashboard
checklist still shows them as complete. Run the migration helper below once from the editor.

```js
/**
 * DATA_MIGRATION_backfillSpecialistResults()
 *
 * Reads every row from the old specialist result sheets and creates a
 * corresponding CLOSED Action Item in the Action Items sheet.
 * Safe to run multiple times — skips any workflow+category pair that
 * already has an Action Item.
 */
function DATA_MIGRATION_backfillSpecialistResults() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const aiSheet = ss.getSheetByName('Action Items');
  if (!aiSheet) throw new Error('Action Items sheet not found');

  const aiData = aiSheet.getDataRange().getValues();
  const aiHeaders = aiData[0];
  const aiWfCol  = aiHeaders.indexOf('Workflow ID');
  const aiCatCol = aiHeaders.indexOf('Category');

  // Build a set of (workflowId|category) already present
  const existing = new Set();
  for (let i = 1; i < aiData.length; i++) {
    existing.add(String(aiData[i][aiWfCol]) + '|' + String(aiData[i][aiCatCol]));
  }

  // Map of old sheet → new category + formType
  const sheetMappings = [
    { sheet: 'Credit Card Results',        category: 'Credit Card',     formType: 'creditcard' },
    { sheet: 'Business Cards Results',     category: 'Business Cards',  formType: 'businesscards' },
    { sheet: 'Fleetio Results',            category: 'Fleetio',         formType: 'fleetio' },
    { sheet: 'JONAS Results',              category: 'Jonas',           formType: 'jonas' },
    { sheet: 'Central Purchasing Results', category: 'Central Purchasing', formType: 'centralpurchasing' },
    { sheet: 'SiteDocs Results',           category: 'SiteDocs',        formType: 'sitedocs' },
    { sheet: '30-60-90 Review Results',    category: '30/60/90 Review', formType: 'review_306090' },
    { sheet: 'Safety Onboarding Results',  category: 'Safety',          formType: 'safety_onboarding' },
    { sheet: 'Safety Termination Results', category: 'Safety',          formType: 'safety_term' },
    { sheet: 'Asset Collection Results',   category: 'Assets',          formType: '' },
  ];

  let migrated = 0;

  sheetMappings.forEach(function(mapping) {
    const src = ss.getSheetByName(mapping.sheet);
    if (!src || src.getLastRow() <= 1) {
      Logger.log('Skipping (empty or missing): ' + mapping.sheet);
      return;
    }

    const rows = src.getDataRange().getValues();
    const hdrs = rows[0];
    const wfIdx = hdrs.indexOf('Workflow ID');
    const tsIdx = hdrs.indexOf('Submission Timestamp') !== -1
      ? hdrs.indexOf('Submission Timestamp')
      : hdrs.indexOf('Timestamp');
    const notesIdx = hdrs.indexOf('Notes');
    const submittedByIdx = hdrs.indexOf('Submitted By');

    for (let i = 1; i < rows.length; i++) {
      const wfId = String(rows[i][wfIdx] || '').trim();
      if (!wfId) continue;

      const key = wfId + '|' + mapping.category;
      if (existing.has(key)) {
        Logger.log('Already exists, skipping: ' + key);
        continue;
      }

      const submittedBy = submittedByIdx >= 0 ? String(rows[i][submittedByIdx] || 'migrated') : 'migrated';
      const notes = notesIdx >= 0 ? String(rows[i][notesIdx] || '') : '';
      const ts = tsIdx >= 0 && rows[i][tsIdx] instanceof Date ? rows[i][tsIdx] : new Date();
      const taskId = 'TK-MIGR-' + wfId.slice(-6) + '-' + mapping.category.replace(/\s+/g, '').toUpperCase().slice(0, 6);

      aiSheet.appendRow([
        wfId,
        taskId,
        mapping.category,
        mapping.category + ' (migrated)',
        'Migrated from ' + mapping.sheet,
        submittedBy,
        'Closed',      // Status
        ts,            // Created Date (use submission timestamp)
        ts,            // Completed Date
        notes,
        submittedBy,   // Closed By
        '',            // Draft
        mapping.formType, // Form Type
        JSON.stringify({ migrated: true, source: mapping.sheet }) // Form Data
      ]);

      existing.add(key); // Prevent duplicates within this run
      migrated++;
    }
  });

  Logger.log('Migration complete. ' + migrated + ' rows written to Action Items.');
}
```

---

### Step 3 — Deploy the refactored codebase to prod

1. In `employee_management_v2_dev/`, confirm `.clasp.json` points to the **dev** script ID
2. Update `.clasp.json` to point to the **prod** script ID (or use a separate clasp config)
3. Run `clasp push` from `employee_management_v2_dev/`
4. In the prod Apps Script editor, deploy a new version as Web App

---

### Step 4 — Verify prod deployment

- [ ] Open prod dashboard — all existing workflows visible
- [ ] Drill into a historical new hire — specialist checklist items show as Complete (from migration)
- [ ] Submit a test new hire through IT Setup — confirm specialist Action Items created (no emails to old specialist form URLs)
- [ ] Confirm safety onboarding Action Item sent to safety team
- [ ] Submit a test termination approval — confirm safety_term and asset Action Items created
- [ ] Run `previewMissingColumns()` — should report nothing to add

---

### Step 5 — Archive old specialist sheets (do not delete immediately)

Rename each specialist result sheet by prefixing `ARCHIVE_` so they're out of the way
but recoverable if a historical lookup is needed:

```
Credit Card Results         → ARCHIVE_Credit Card Results
Business Cards Results      → ARCHIVE_Business Cards Results
Fleetio Results             → ARCHIVE_Fleetio Results
JONAS Results               → ARCHIVE_JONAS Results
Central Purchasing Results  → ARCHIVE_Central Purchasing Results
SiteDocs Results            → ARCHIVE_SiteDocs Results
30-60-90 Review Results     → ARCHIVE_30-60-90 Review Results
Safety Onboarding Results   → ARCHIVE_Safety Onboarding Results
Safety Termination Results  → ARCHIVE_Safety Termination Results
Asset Collection Results    → ARCHIVE_Asset Collection Results
```

Delete archived sheets only after 30 days with no issues.

---

### Rollback procedure

If something goes wrong post-cutover:

1. In the prod Apps Script editor, redeploy the **previous version** of the web app
2. The old specialist result sheets are still present (just renamed) — rename them back
3. The Action Items sheet retains all migrated and new data — no data loss in either direction
4. Investigate the issue in dev before attempting a second cutover
