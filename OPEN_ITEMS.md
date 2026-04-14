# Open Items

_Last updated: 2026-04-14 (session 2)_

**Status key:** `OPEN` → `REVIEW` → `COMPLETE`

---

## Regressions (Staging broke prod behavior)

**R1 — Specialist form context header** `REVIEW`
Restored the employee details panel (name, start date, title, manager, site, JR, systems) to all 5 staging specialist forms. Also added `getWorkflowContext` merge to `Specialist.js` so `jrTitle` populates.
> **Review:** Open a staging specialist form (e.g. BusinessCards) for a real workflow. Confirm the Request Details panel appears with correct employee data. Confirm JR field is not blank. Check all 5 forms: BusinessCards, CreditCard, Fleetio, Jonas, SiteDocs.

---

**R2 — `Review306090.html` — JR picker + doc link** `REVIEW`
Added JR title dropdown (loads from `getJRsList()`, pre-selects requested JR), document link field, and the DOMContentLoaded loader script. Added `--input-bg` CSS var, fixed spinner `mb` bug.
> **Review:** Open staging 30/60/90 form for a workflow that has a JR assigned. Confirm dropdown populates and pre-selects the requested JR. Confirm the document link field is present. Submit and verify `jrTitle` and `documentLink` are saved to the results sheet.

---

**R3 — `WorkflowMap.html` — back link** `REVIEW`
Code appears correct in staging — `serveWorkflowMap()` is already on `createTemplateFromFile`. No code change made, but this was flagged as a known bug so needs eyes on it in the live environment.
> **Review:** Navigate to WorkflowMap in staging. Confirm the Back to Dashboard link renders as a real URL (not the literal string `<?= getBaseUrl() ?>`). Click it and confirm it navigates to the dashboard correctly.

---

**R4 — `getRequestDetails()` — 30/60/90 scope bug** `REVIEW`
Replaced `reqRow && reqRow[47] === 'Yes'` with `r['30/60/90'] === 'Yes'` in `DashboardHandler.js`.
> **Review:** Open request details modal on the staging dashboard for an employee where 30/60/90 is NOT required. Confirm the 30/60/90 checklist item shows as N/A. Then check one where it IS required (30/60/90 = Yes) — confirm it shows as Pending/Complete, not N/A.

---

**R5 — Payroll email hardcoded** `REVIEW`
Added `PAYROLL` to `CONFIG.EMAILS` in `Config.js` (lazy-loaded via `ConfigurationService`, fallback `payroll@team-group.com`). Updated `TerminationHandler.js` to reference `CONFIG.EMAILS.PAYROLL`.
> **Review:** Process a test termination approval in staging. Confirm payroll notification still sends. Confirm the `ConfigurationService` key `EMAIL_PAYROLL` can override it if set in the settings sheet.

---

## Email Changes

**E1 — Add Hourly/Salary and Site to all email subjects** `REVIEW`
Modified `sendFormEmail` in `EmailUtils.js` to auto-prepend `[EmploymentType | Site]` to subject line when `contextData` contains those fields.
> **Review:** Trigger any form submission that passes contextData (e.g. initial request, HR verification). Confirm email subjects arrive with `[Hourly | Site Name]` prefix. Verify TEST mode subjects still show `[TEST]` correctly.

---

**E2 — ADP Supervisor email to payroll group** `REVIEW`
In `HRVerificationHandler.js` salary path: checks `context.systems` for `ADP Supervisor Access` and adds `CONFIG.EMAILS.PAYROLL` as a CC recipient on the IT Setup email.
> **Review:** Submit a test new hire with ADP Supervisor access checked. After HR verification, confirm both IT and Payroll receive the IT Setup email.

---

**E3 — Payroll email — expanded scope** `REVIEW`
- Salary hire: Payroll notified after HR verification in `HRVerificationHandler.js`
- Termination: Payroll notified when HR receives the request in `TerminationHandler.js submitTerminationRequest`
- Status change: Payroll notified after HR approval in `PositionChangeHandler.js submitPositionChangeApproval`
> **Review:** Test each of the three scenarios. Confirm payroll receives a notification at the correct stage in each workflow.

---

**E4 — Payroll termination email must include direct reports info** `REVIEW`
Added `reportsToNew` and `lastDayWorked` to the payroll approval email in `TerminationHandler.js submitTerminationApproval`. Added `lastDayWorked` to `getTerminationData` (index 27).
> **Review:** Approve a test termination. Confirm payroll email includes "Reports Reassigned To" and "Last Day Worked" fields.

---

**E5 — "Add to my calendar" in HR approval emails for hourly employees** `REVIEW`
Added Google Calendar link to hourly completion email in `HRVerificationHandler.js`. Formats hireDate as YYYYMMDD, encodes employee name and site in the calendar event.
> **Review:** Complete HR verification for an hourly employee. Confirm the completion email includes a blue "Add Start Date to Calendar" button that opens a pre-filled Google Calendar event.

---

**E6 — Expedite contact on new hire calendar warning — change from IT to HR** `REVIEW`
Changed `Please contact IT to expedite` → `Please contact HR to expedite` in `InitialRequest.html` hire date warning box.
> **Review:** Open the initial request form. Enter a hire date less than 3 business days out. Confirm the warning reads "Please contact HR to expedite."

---

## Initial Request Form

**I1 — Gatekeeper clarification — background check requirement** `REVIEW`
Added amber warning box to gatekeeper screen: US employees must not be submitted until background check is complete.
> **Review:** Open the initial request form. Confirm the background check warning appears on the gatekeeper screen before the confirm button.

---

**I2 — ADP Supervisor: capture required ADP sites** `REVIEW`
Added hidden ADP sites multi-select section beneath the ADP Supervisor checkbox. Populates from `refData.sites`. Auto-checks the assigned site when site dropdown changes. Stored as comma-separated in new `ADP Sites` sheet column.
> **Review:** Check ADP Supervisor checkbox — confirm ADP sites panel appears with full site list. Change the site dropdown — confirm it auto-checks the matching site. Submit a test request and verify `ADP Sites` column is populated in the sheet.

---

**I3 — Sitedocs label + warning** `REVIEW`
Changed label to "Sitedocs Supervisor Access". Added inline amber warning: "Do not add to hourly employees."
> **Review:** Open system access section on the initial request form. Confirm the label reads "Sitedocs Supervisor Access" with the hourly warning visible.

---

**I4 — Add comment above additional system access button** `REVIEW`
Added info bar above the Systems/Apps checkboxes: "All employees receive DSS+ and Sitedocs. Most hourly employees need no further access."
> **Review:** Open system access section. Confirm the note appears above the checkboxes.

---

**I6 — Central Purchasing Required** `REVIEW`
Added "Central Purchasing Required" checkbox to `InitialRequest.html` Systems/Apps section with site multi-select sub-panel (same pattern as ADP/I2). Added matching checkbox + panel to `PositionSiteChangeRequest.html`. Added `CONFIG.EMAILS.PURCHASING` to `Config.js`. `InitialRequestHandler.js` saves `purchasingSites` and sends notification to PURCHASING when checked. `Setup.js` updated with 'Purchasing Sites' column.
> **Review:** Check Central Purchasing on the initial request form — confirm site panel appears. Submit and verify `purchasingSites` saves to sheet and purchasing email is received. Repeat on the status change form.

---

**I5 — Add optional open text department field** `REVIEW`
Added optional Department text input to the Employee Information section, below Site Name / Job Site #. Stored in new `Department` sheet column.
> **Review:** Confirm Department field appears on the form as optional. Submit a test request with and without it populated — verify column saves correctly in the sheet.

---

## HR Verification

**H1 — Remove system access toggle from HR verification form** `COMPLETE`
No toggle exists in either staging or prod. The handler reads `systemAccess` directly from the Initial Requests sheet (column 19) — the HR form has no influence over it. Already correct.
> **Review:** Confirm HR verification form has no system access toggle. Verify the routing (hourly/no-access vs. salary/IT path) fires correctly after submission.

---

## Status Change Workflow

**S1 — Allow same site, different department** `REVIEW`
No existing validation was blocking same-site. Relabelled the section to "Site Transfer / Department Change" and added a note: "Same site is valid — use this section for department-only changes."

---

**S2 — Add optional open text department field (location change)** `REVIEW`
Added optional Department field inside the site transfer section. Stored in new `Department` column in Position Changes sheet. Handler updated to pass `formData.department`.

---

## Termination Workflow

**T1 — Add "last day worked" field to termination request** `REVIEW`
Added required date field "Last Day Worked" next to Effective Date of Termination in the Termination Details section. Stored in new `Last Day Worked` column in the Terminations sheet.
> **Review:** Open termination request form. Confirm "Last Day Worked" date field appears alongside the termination date. Submit a test and verify the value saves to the sheet.

---

## Dashboard & Access

**D1 — Confirm requestor can see their own requests on dashboard** `COMPLETE`
`AccessControlService.canAccessWorkflow` already filters by `requesterEmail` — requestors see their own workflows. No code change needed.

---

**D2 — Allow HR, IT, or Admin to change hire dates** `REVIEW`
Added `updateHireDate(workflowId, newDateStr)` to `DashboardHandler.js` with role check (`canAccessForm HR/IT` or `isAdmin`). Dashboard passes `canEditDates` flag from server. Modal footer shows "Edit Start Date" button for onboarding workflows when permitted. Prompts for YYYY-MM-DD date, calls server function, refreshes list.
> **Review:** Log in as HR or Admin. Open an onboarding workflow modal — confirm "Edit Start Date" button appears. Enter a new date and confirm it saves to the Initial Requests sheet and the dashboard updates. Confirm the button is absent for EOE workflows and for non-HR/IT users.

---

**D4 — Add start date to dashboard list** `REVIEW`
Added `hireDate` (col 12) to `StateSync.js` outputRow for both onboarding (Hire Date, index 6) and EOE (Term Date, index 12) workflows. Mapped in `DashboardHandler.js getDashboardData`. Added "Start Date" column to `Dashboard.html` table; updated all `colspan="6"` → `colspan="7"`.
> **Review:** Run `manuallySyncAllWorkflows()` in staging to rebuild Dashboard_View with the new column. Open dashboard — confirm "Start Date" column appears with correct dates for both onboarding and EOE rows.

---

**D3 — Revalidate dashboard entirely** `OPEN`
Full QA pass on dashboard data, rendering, and status logic.

---

## New Workflows / Features

**N1 — HR post-hire workflow (benefits, etc.)** `OPEN`
New workflow step or parallel task after HR confirmation for benefits enrollment and related HR onboarding tasks.
