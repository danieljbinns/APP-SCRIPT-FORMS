# Staging Test Checklist — Session 2 Changes

## 1. Initial Request Form — New Hire Mode

### ADP Sub-Section
- [ ] Check "ADP" under Systems — sub-section expands inline (no page jump)
- [ ] Sub-section shows **job site numbers** (not site names) as multi-select checkboxes
- [ ] **ADP Salary Access** checkbox appears inside sub-section
- [ ] Submit with salary access checked → verify `ADP Salary Access = Yes` written to Initial Requests sheet

### Central Purchasing Sub-Section
- [ ] Check "Central Purchasing" → sub-section expands showing **job site numbers** (not site names)
- [ ] Selected job numbers saved to Purchasing Sites column in sheet

### Equipment Detail Sub-Sections (inline)
- [ ] Check **Computer** → computer detail fields appear inline below checkbox (not in a separate section)
- [ ] Check **Credit Card** → credit card fields appear inline (USD/Canada/Home Depot with limits)
- [ ] Check **Mobile Phone** → phone fields appear inline
- [ ] Uncheck each → sub-section collapses

### JR / 30-60-90 Sections
- [ ] JR section visible in new-hire mode
- [ ] 30/60/90 section visible in new-hire mode

### Form Submission
- [ ] Submit → workflow created, email sent to ID Setup
- [ ] `formatInitialRequestData` last column = `ADP Salary Access` value

---

## 2. Equipment Request Form (Standalone)

- [ ] Navigate to equipment request URL (mode=equipment)
- [ ] Hire date field is **hidden** (new-hire-only)
- [ ] System Access yes/no question is **hidden** (new-hire-only)
- [ ] "Systems & Apps" section header + description is **hidden** (systems-only)
- [ ] Equipment checkboxes with inline sub-sections are **visible**
- [ ] Computer / Credit Card / Phone inline reveals work same as new-hire mode
- [ ] JR and 30/60/90 divs are **hidden**
- [ ] Submit → routes to `submitEquipmentRequest` (not `submitInitialRequest`)
- [ ] Workflow created with `EQUIP_REQ` prefix
- [ ] Action items created (IT hardware, ID Setup software, etc.)

---

## 3. Employee ID Setup Form — BOSS WIS

- [ ] BOSS WIS section is visible at bottom of EmployeeIDSetup form
- [ ] Checkbox "BOSS WIS account has been created" present
- [ ] Submit → `bossWisCreated` column written to ID Setup Results sheet (`Yes` or `No`)

---

## 4. Safety Onboarding Email + Form

### Hourly Path (no system access)
- [ ] Submit ID Setup → safety onboarding email sent to Safety team
- [ ] Email contains link to Safety Onboarding specialist form

### Salary Path
- [ ] Submit HR Verification → safety onboarding email sent to Safety team

### Safety Onboarding Form
- [ ] Open safety specialist form URL (`?page=specialist&wf=...&dept=safety`)
- [ ] Form shows SiteDocs confirmation checkbox and DSS learning path checkbox
- [ ] Submit → row written to Safety Onboarding Results sheet (columns: WF ID, Form ID, Timestamp, SiteDocs Confirmed, DSS Confirmed, Notes, Submitted By)
- [ ] Workflow action item marked complete after submission

---

## 5. HR Verification — ADP Salary Access Flag

- [ ] Submit HR Verification for employee with ADP Salary Access = Yes on initial request
- [ ] Payroll email includes red ⚠️ callout about salary access
- [ ] Payroll email for normal employee does **not** include salary callout

---

## 6. Dashboard — Type Column & Multi-Select Filters

### Type Column
- [ ] **Type** is the first column in the dashboard table
- [ ] **Employee** is second column
- [ ] **Emp Type** is a separate third column (not merged with name)
- [ ] Type badges appear in the Type cell (not inline in the Employee cell)
- [ ] Column count is 11 (no broken colspan on loading/empty states)

### Multi-Select Filter Buttons
- [ ] "All", "Onboarding", "End of Employment", "Position Change", "Equipment" type buttons present
- [ ] "All", "In Progress", "Complete", "On Hold" status buttons present
- [ ] Clicking a type button toggles it active (colored highlight)
- [ ] Multiple type buttons can be active simultaneously (OR logic)
- [ ] "All" button deselects other buttons and shows everything
- [ ] Status multi-select works the same way
- [ ] Combined type + status filters work (AND across groups)

---

## 7. State Sync — Safety Block

- [ ] NEW_EMP workflow with pending Safety Onboarding does **not** show as Complete
- [ ] After safety form submitted, workflow can advance to Complete
- [ ] Safety item does not block non-complete transitions (In Progress, etc.)

---

---

## 8. Termination Form — Date Formatting

- [ ] Submit termination request → Request Date in emails displays as `M/d/yyyy` (e.g. `4/20/2026`), not ISO
- [ ] Last Day Worked in emails displays as `M/d/yyyy`, not ISO
- [ ] Both dates consistent across: pre-approval payroll email, HR approval email, post-approval payroll email, IT email, safety email

---

## 9. Termination Form — Pre-Approval Payroll Email

- [ ] Pre-approval email sent to Payroll on submission (before HR approves)
- [ ] Email does **not** include a form link / action button
- [ ] Email body contains caveat: "HR approval is still pending" and "second email will follow"

---

## 10. Termination Form — Direct Reports in IT Email

- [ ] Submit term for employee with Direct Reports = Yes → IT action item form includes:
  - [ ] "Reassign Google direct reports to: [name]"
  - [ ] "Reassign BOSS direct reports to: [name]"
- [ ] Direct reports items do **not** appear in manager or HR action items
- [ ] Submit term for employee with Direct Reports = No → no reassign items in IT form

---

## 11. Termination Form — ADP Supervisor CC to Payroll

- [ ] HR action item email (HR Systems Deactivation) CC's Payroll
- [ ] HR action item form shows the standard HR checklist items

---

## 12. Termination Form — Safety Offboarding Form

- [ ] HR approves termination → Safety receives email with link to Safety Offboarding specialist form
- [ ] Open form URL (`?page=specialist&wf=...&dept=safetyterm`) → shows SiteDocs removal + BOSS WIS deactivation checkboxes
- [ ] Both checkboxes must be checked before submit is allowed
- [ ] Submit → row written to Safety Termination Results sheet
- [ ] Workflow action item marked complete after submission

---

## 13. Success Screens — Auto-Navigate (All Forms)

- [ ] **ActionItemForm** (term action items): finalize → shows "Task Finalized" → auto-navigates to dashboard after 2s
- [ ] **TerminationApproval**: approve/reject → shows "Action Completed" → auto-navigates to dashboard after 2s
- [ ] **SafetyTermination**: submit → shows success screen → auto-navigates to dashboard after 2s
- [ ] **SafetyOnboarding**: submit → auto-navigates to dashboard after 2s
- [ ] **Jonas**: submit → auto-navigates to dashboard after 2s
- [ ] **CentralPurchasing**: submit → auto-navigates to dashboard after 2s
- [ ] **Review306090**: submit → auto-navigates to dashboard after 2s
- [ ] **CreditCard** / **BusinessCards** / **Fleetio** / **SiteDocs**: submit → auto-navigates after 2s
- [ ] No "Close Window" button appears on any success screen

---

## 14. Specialist Form Layout Consistency

- [ ] All specialist forms (new hire + term) display at max-width 900px
- [ ] All show logo, `.ticket-info` context panel, notes textarea, single submit button
- [ ] Context panel uses `.label` / `.value` two-column grid
- [ ] Review306090 retains JR title dropdown + document link field
- [ ] CentralPurchasing retains sites-configured text input + purchasing sites context row
- [ ] SafetyOnboarding retains confirm-item checkboxes (SiteDocs + DSS)
- [ ] SafetyTermination retains confirm-item checkboxes (SiteDocs removal + BOSS WIS)

---

## 15. Status Change Form — New Department Label

- [ ] Check "Site Transfer" → site_sec expands → New Department field has no "(Optional)" text
- [ ] Help text reads: "For same-site transfers, New Department is the primary change — please specify"
- [ ] Field is not required (no asterisk, form submits without it filled)

---

## 16. Status Change Form — Systems Sync with New Hire

- [ ] NEW System Access list includes: ADP Supervisor Access, BOSS, CAA, Delivery, DSS, Fleetio, Google Account, Incidents, Jonas Purchasing, Net Promoter Score, SiteDocs, Central Purchasing
- [ ] ADP Supervisor Access → inline sub-section expands with job site number checkboxes + salary data checkbox
- [ ] SiteDocs label shows "⚠️ Do not add to hourly employees" warning
- [ ] Central Purchasing → inline job site numbers (same as new hire form)
- [ ] BOSS, Jonas, Google Account sub-sections still work correctly

---

## 17. Status Change Form — Equipment Inline Reveals

- [ ] Check Computer → inline sub-section expands (New Request / Reassignment toggle)
- [ ] New Request → shows Computer Type (Chromebook/Windows/Mac) + IT Director approval note
- [ ] Windows or Mac → Office 365 question appears
- [ ] Reassignment → shows Previous User, Previous Type, Serial Number fields
- [ ] Uncheck Computer → sub-section collapses
- [ ] Check Credit Card → inline sub-section expands with USA / Canada / Home Depot checkboxes + limit fields (not radio buttons)
- [ ] Check Mobile Phone → inline sub-section expands with New Request / Reassignment toggle
- [ ] Reassignment → shows Previous User + Previous Number fields

---

## Notes / Issues Found

_Record any bugs or unexpected behavior here during testing._
