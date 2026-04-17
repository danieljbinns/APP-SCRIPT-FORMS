# Staging Verification Guide

> Work through this document top to bottom after a `clasp push` to staging.
> Each section tells you what to open, what to do, and what a passing result looks like.
> Sections are ordered: deployment first, then critical bugs, then form smoke-tests, then access control.

---

## Before You Start

### 1. Push and confirm deployment

- [ ] Run `clasp push` in `employee_management_v2_staging/`
- [ ] Open the staging web app URL
- [ ] Confirm the Landing Page loads — your name/email appears in the top bar (not "Loading..." or "Not signed in")
- [ ] Confirm the Dashboard loads — table appears (may be empty)

---

## Part 1 — Phase 9: One Remaining Open Item

Phase 9 is complete except for **D1**, which is cosmetic. All critical, logic, performance, and security fixes are verified present in staging.

### D1 — "Date" column label doesn't differentiate by workflow type *(Low priority / cosmetic)*

**How to see it:** Look at the dashboard table. The "Date" column header is always "Date" regardless of whether you're viewing new hires, terminations, or position changes. The value also always pulls from `hireDate` — so for a termination, the column shows the start date instead of the term date.

**Impact:** Confusing when viewing a mixed list of workflow types. No data is wrong, just mislabelled.

**Fix when ready:** Make the date value and column header context-aware per workflow type (Start Date / Term Date / Effective Date). Currently all three branches in the date label conditional are identical.

---

## Part 2 — Phase 8: Core QA Checklist

Run these after Part 1 bugs are fixed. Work top to bottom. Each item has a pass/fail result.

### Access Control

| # | Test | How | Pass condition |
|---|------|-----|----------------|
| AC-1 | Admin — full access | Sign in as `davelangohr@team-group.com` | Dashboard loads, all rows visible, date edit enabled |
| AC-2 | Admin — alt account | Sign in as `dbinns@robinsonsolutions.com` | Same as AC-1 |
| AC-3 | Payroll | Sign in as `payroll@team-group.com` | All workflows visible, date edit **not** available |
| AC-4 | HR group member | Sign in as any HR group member | All workflows visible, date edit available |
| AC-5 | IT group member | Sign in as any IT group member | All workflows visible, date edit available |
| AC-6 | Non-primary domain manager | Sign in as a manager without group membership | Dashboard loads, only their own submitted requests visible |
| AC-7 | Unknown authenticated user | Sign in with a valid account with no group/role | Dashboard loads, zero rows shown — not an error |

---

### Dashboard Display

| # | Test | How | Pass condition |
|---|------|-----|----------------|
| DD-1 | New hire row | Submit a new hire, open Dashboard | Site column populated, Start Date column populated |
| DD-2 | Termination row | Submit a termination, open Dashboard | Site column populated, Term Date column populated |
| DD-3 | Position Change row | Submit a position change, open Dashboard | Type shows "Position Change", effective date shown |
| DD-4 | In-progress termination | Approve a termination (not yet actioned), open Dashboard | Status is not blank — shows intermediate state |
| DD-5 | Dashboard load speed | Sign in as full-access user with 20+ workflows | Noticeably faster than pre-Phase-8 |

---

### syncWorkflowState — Dashboard_View stays current

Run each action and immediately check that the Dashboard_View row updates without a manual sync.

- [ ] Submit new hire → row shows **"ID Setup Needed"**
- [ ] Complete ID Setup → row shows **"ID Setup Complete"**
- [ ] Complete HR Verification (hourly, no system access) → row shows **"Complete"**
- [ ] Complete HR Verification (salary, system access needed) → row shows **"IT Setup Needed"**
- [ ] Complete IT Setup → row shows **"Specialist Forms Needed"** with pending list in step column
- [ ] Submit termination → row shows **"HR Approval Needed"**
- [ ] Approve termination → row shows **"Action Items Pending"**
- [ ] Reject termination → row shows **"Rejected"**
- [ ] Submit position change → row shows **"HR Approval Needed"**
- [ ] Approve position change → row shows **"Action Items Pending"** or **"Change Processed"**
- [ ] Reject position change → row shows **"Rejected"**

---

### Form Data Integrity

- [ ] Submit new hire with **System Access = No** — `systems` and `equipment` columns blank in sheet
- [ ] Submit new hire with **Computer unchecked** — `computerType` column blank (not "Chromebook")
- [ ] Submit new hire with **Computer checked and type selected** — `computerType` correctly captured in sheet
- [ ] Submit new hire with **Credit Card unchecked** — all CC limit columns blank in sheet
- [ ] Submit new hire with **BOSS unchecked** — all BOSS detail columns blank in sheet

---

### Error Handling

- [ ] **InitialRequest submit error** — simulate a server error (temporarily break `submitInitialRequest`); confirm alert appears and submit button re-enables
- [ ] **TerminationApproval error** — simulate server error on `submitTerminationApproval`; confirm alert appears and button re-enables
- [ ] **ActionItemForm finalize error** — simulate server error on `finalCompleteRequest`; confirm alert appears and "Finalizing..." button re-enables (this was a Critical fix in Phase 10)

---

### Batch Sync

- [ ] Add 3 empty rows to the bottom of the Workflows sheet
- [ ] Run `manuallySyncAllWorkflows()` from the Apps Script editor
- [ ] Confirm: no errors thrown, no blank entries written to Dashboard_View

---

## Part 3 — Phase 10: HTML Audit Smoke Tests

These confirm that the 6 chunks of audit fixes are working as expected. You don't need to re-read the code — just verify the visible behaviour.

### Chunk 1: XSS Fixes

- [ ] **DirectoryAutocomplete** — Type 3+ characters in any manager email field on InitialRequest, TerminationRequest, or PositionSiteChangeRequest. Autocomplete dropdown appears. Result: name and email are shown as plain text (not rendered as HTML). Test with a search that would return a name containing `<` or `"` if you can.
- [ ] **Dashboard renderTable** — Confirm no visible JavaScript errors in browser console when dashboard loads with data. Rows with unusual characters in employee names or statuses render safely.
- [ ] **ActionItemForm** — Open any active action item form. Confirm the form loads with a populated `userEmail` (not blank). Complete a checklist item — audit trail entry shows your email as author.

---

### Chunk 2: Broken Form Submissions

- [ ] **TerminationRequest** — Submit a termination. Confirm the form submits successfully (no silent failure). Confirm the sheet receives all fields. Note: file attachment field now shows an informational message instead of functioning — this is expected.
- [ ] **HRVerification** — Submit HR verification for a new hire. Confirm the `formId` is captured in the sheet and the correct workflow step is triggered.
- [ ] **EmployeeIDSetup** — Complete an ID setup. Confirm `formId` appears in sheet data.
- [ ] **CentralPurchasing** — Submit a Central Purchasing confirmation. Confirm `formId` is captured.

---

### Chunk 3: Silent Success/Failure Handlers

Test each of these forms: **Jonas**, **CreditCard**, **Fleetio**, **BusinessCards**, **SiteDocs**, **CentralPurchasing**, **Review306090**.

For each:
- [ ] Submit the form normally — confirm success screen appears
- [ ] If you can simulate a server failure (temporarily break the handler function): confirm an error alert appears and the submit button re-enables. The success screen should **not** appear on failure.

---

### Chunk 4: Broken Data

- [ ] **TerminationApproval** — Open a pending termination approval. Look at the "Collect Assets" checkbox. If the employee has no phone and no laptop assigned, the checkbox should be **unchecked** by default. Previously it was always checked due to `|| true`.
- [ ] **ITSetup** — Submit an IT setup form for a new hire with multiple BOSS job sites selected. Confirm all selected sites appear in the sheet — not just the last one selected (multi-select data loss was the bug).

---

### Chunk 5: Dead/Stale Code

These are code-level removals — no visible UI impact — but a few have observable side effects:

- [ ] **InitialRequest** — Submit a new hire selecting a Computer type. Confirm `computerType` is captured correctly. The `else if` → `else` fix ensures the cleanup logic runs properly.
- [ ] **EquipmentSystemRequest** — Submit the form. Confirm the sheet does **not** receive `hireDate`, `newHireOrRehire`, `employeeType`, or `employmentType` columns (they should be absent, not null).
- [ ] **PositionSiteChangeRequest** — Load the form. Without selecting any Computer or Phone option, trigger any other field change. Confirm no JavaScript errors thrown in console (null dereference guard).

---

### Chunk 6: Visual/UX Polish

- [ ] **TerminationFormBuilder** — Open the form builder. Confirm the modal that appears when editing a field has a visible dark background (not transparent). Confirm delete buttons show a visible colour (red text, not invisible).
- [ ] **LandingPage** — Open the landing page while network is offline or after temporarily breaking `getCurrentUserEmail`. Confirm the user email area shows "Not signed in" rather than staying on "Loading...".
- [ ] **DataManager** — Open Data Manager. Click a delete button on any item. Confirm the button disables and shows "..." while the delete is in progress. Confirm it re-enables if the delete fails.
- [ ] **StatusChangeApproval** — Open a pending status change approval. Leave the "Site Transfer" checkbox unchecked and submit. Confirm `receivingManagerEmail` is not sent (check the request payload in the Apps Script logs — it should be blank string, not a stale email value).

---

## Part 4 — Phase 11: Planned Future Work (No Action Now)

These are tracked but not scheduled. No testing needed — just be aware:

- **Consolidate admin access mechanisms** — `MASTER_ADMIN_GROUP` (Google Group) and `ADMIN_EMAILS` (hardcoded list) currently coexist. Consolidate into one mechanism when time permits.
- **Audit `ALL_FORMS_GROUP`** — currently points to the IT group; should be its own group or removed in favour of explicit role checks.

---

## Sign-Off Checklist

Before promoting staging → production, confirm:

- [ ] All Part 1 (Phase 9) critical bugs are fixed and re-tested
- [ ] All Part 2 (Phase 8) checklist items pass
- [ ] All Part 3 (Phase 10) smoke tests pass
- [ ] No regressions observed in forms not covered above
- [ ] Apps Script execution log shows no unhandled exceptions during any test run
- [ ] `clasp push` has been run for **both** staging and prod folders before promotion
