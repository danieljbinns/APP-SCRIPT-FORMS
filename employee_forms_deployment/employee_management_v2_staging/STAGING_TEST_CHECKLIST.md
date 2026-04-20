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

## Notes / Issues Found

_Record any bugs or unexpected behavior here during testing._
