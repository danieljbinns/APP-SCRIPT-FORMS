# REQUEST_FORMS - COMPREHENSIVE REVIEW PROCESS
## Step-by-Step Form Validation & Workflow Analysis

**Document Purpose:** This document outlines a systematic review process for validating each form's questions, answer criteria, dependencies, and workflow triggers. No assumptions are made about current correctness—all elements must be reviewed and confirmed.

**Project Status:** Confirmed by actual code review
**Date:** 2025-12-07
**Deadline:** Complete by 2025-12-08

---

## PART 1: REVIEW & VALIDATION PROCESS

### What We're Reviewing
For **each form**, we will examine:

1. **Form Questions**
   - Exact question text
   - Field type (text, email, date, select, checkbox, etc.)
   - Required vs. Optional status
   - Default values or placeholder text
   - Validation rules (if any)

2. **Answer Criteria**
   - What answers are acceptable?
   - What format must answers take?
   - Are there dependent questions (Q2 only appears if Q1=Yes)?
   - Are there answer ranges or constraints?
   - What triggers next questions?

3. **Workflow Triggers**
   - What happens after form submission?
   - What data is saved?
   - What notifications are sent?
   - Who receives the data?
   - What step comes next?
   - Are there conditional workflows (different paths based on answers)?

4. **Missing Elements**
   - Are there gaps in the form that should be filled?
   - Are there steps missing from the workflow?
   - Are there validation issues?
   - Are there accessibility issues?

### Review Output Format
For each form, we'll document:
```
FORM: [Exact File Name]
CURRENT STATE: [Placeholder / Partial / Complete]
QUESTIONS:
  1. [Question Text]
     - Field Type: [text/email/date/select/checkbox]
     - Required: [Yes/No]
     - Values/Options: [list or range]
     - Triggers: [What question/action comes next if this value is selected]

ANSWER CRITERIA:
  [Description of what constitutes valid answers]

WORKFLOW TRIGGER:
  - Submission Handler: [Function name that processes this]
  - Data Saved To: [Where does submitted data go]
  - Notifications Sent To: [Email addresses/departments]
  - Next Step: [What form/action happens next]

MISSING ELEMENTS:
  - [ ] Item 1
  - [ ] Item 2

STATUS: [READY / NEEDS REVISION / NEEDS DEVELOPMENT]
```

---

## PART 2: REVIEW ORDER & DEPENDENCY MAPPING

### Recommended Review Sequence
The forms are reviewed in **dependency order** - forms that depend on earlier forms come later.

**Stage 1: Foundation (Must complete before Stage 2)**
- Form 1: InitialRequest.html → Triggers Stage 2

**Stage 2: Department Forms (Parallel review, sequential revisions)**
- Form 2: HRForm.html
- Form 3: ITForm.html
- Form 4: FleetioForm.html
- Form 5: CreditCardForm.html
- Form 6: ADPSupervisorForm.html
- Form 7: ADPManagerForm.html
- Form 8: JonasForm.html
- Form 9: Review306090Form.html
- Form 10: SiteDocsForm.html

**Stage 3: Backend & Integration**
- Code.gs workflow processing
- Config.gs settings validation
- Spreadsheet schema confirmation
- Email notification templates

---

## PART 3: DETAILED FORM REVIEW CHECKLIST

### FORM 1: InitialRequest.html
**File Path:** `/home/user/REQUEST_FORMS/InitialRequest.html`
**Status:** CONFIRMED from code review
**Sections:** 5 (Gatekeeper, Requester, Employee, Equipment, Submit)

#### 1A. GATEKEEPER QUESTION SECTION
```
Question 1: "Have all Recruiting Requirements been met?"
  Type: Dropdown Select
  Required: YES (gates access to entire form)
  Options: [-- Please Select --, Yes, No]
  Triggers:
    - IF "Yes" → Reveal "main-form" div containing all other fields
    - IF "No" → Display error message "All Recruiting Requirements must be met..."
    - IF blank → Hide "main-form"
```

**Review Checklist:**
- [ ] Is the gatekeeper question clear? (Understand: "Recruiting Requirements" = what exactly?)
- [ ] Should "Recruiting Requirements" be defined in a help text or link?
- [ ] Is "Yes/No" the correct answer format, or should there be options?
- [ ] Is it acceptable to prevent ENTIRE form submission for No answer?
- [ ] What should happen if someone clicks "No"? (error message only, or form submission rejected?)
- [ ] Does recruiter need to explain why requirements aren't met?

**Current Implementation Issues to Validate:**
- Error message displays but form doesn't prevent submission (user can select No and nothing stops them)
- No explanation of what "Recruiting Requirements" means
- No link to recruiting checklist or documentation

**Missing Elements:**
- [ ] Help text explaining "Recruiting Requirements"
- [ ] Link to recruiting checklist or documentation
- [ ] Server-side validation (prevent No submissions from reaching spreadsheet)
- [ ] Feedback loop (way to resolve and resubmit if No)

---

#### 1B. REQUESTER INFORMATION SECTION
```
Question 2: "Your Name"
  Type: Text input
  Required: YES
  Min length: -
  Max length: -
  Triggers: Collected and stored in "Requester Name" column

Question 3: "Your Email"
  Type: Email input
  Required: YES
  Format: Valid email (@domain)
  Triggers: Collected; used in email notifications

Question 4: "Your Phone Number"
  Type: Tel input
  Required: NO
  Format: Phone number (flexible)
  Triggers: Collected and stored in "Requester Phone" column
```

**Review Checklist:**
- [ ] Is "Requester" the person submitting the form (usually HR/Hiring Manager)?
- [ ] Should there be validation that Requester Email is a company email?
- [ ] Should phone number have format validation (10 digits, area code, etc.)?
- [ ] Is it clear these are the form SUBMITTER's details, not the employee's?
- [ ] Should there be a confirmation that requester has authorization to request?

**Triggers/Workflow:**
- Requester Name, Email, Phone → Stored in spreadsheet columns 3, 4, 5
- Requester Email → Used in email notifications (sendNotifications function, line 159 Code.gs)
- Requester Email → Used to send confirmation to the person who submitted

**Missing Elements:**
- [ ] Server-side validation for email format
- [ ] Server-side validation for required fields (all client-side only currently)
- [ ] Verification that phone number is valid format
- [ ] Help text distinguishing "Requester" (form submitter) from "Employee" (new hire)

---

#### 1C. NEW EMPLOYEE INFORMATION SECTION
```
Question 5: "First Name"
  Type: Text input
  Required: YES
  Triggers: Stored in column 6

Question 6: "Last Name"
  Type: Text input
  Required: YES
  Triggers: Stored in column 7

Question 7: "Hire Date"
  Type: Date input
  Required: YES
  Format: YYYY-MM-DD
  Triggers: Stored in column 8
  Conditional:
    - IF past date → Should be rejected (not someone being hired in past)
    - IF future date > 90 days → May need approval

Question 8: "Site Name"
  Type: Dropdown Select
  Required: YES
  Options: [-- Select Site --] + values from CONFIG.JOB_CODES keys
    Current options: Atlanta, Charlotte, Nashville
  Triggers:
    - onChange → Updates Job Code dropdown (updateJobCodes() function)
    - Stored in column 9

Question 9: "Position/Job Code"
  Type: Dropdown Select
  Required: YES
  Options: Populated dynamically based on Site Name selection
  Disabled until: Site Name is selected
  Format: "1001 - Project Manager" (number - description)
  Triggers:
    - Depends on Question 8 (Site Name)
    - Stored in column 11
    - May trigger system access requirements (not yet implemented)

Question 10: "Department"
  Type: Dropdown Select
  Required: YES
  Options: [-- Select Department --] + 7 values from CONFIG.DEPARTMENTS
    Current: Operations, Administration, Safety, Accounting, HR, IT, Fleet
  Triggers: Stored in column 10

Question 11: "Employment Type"
  Type: Dropdown Select
  Required: YES
  Options: [-- Select Type --], Hourly, Salary
  Triggers:
    - Stored in column 12
    - May affect benefits/payroll workflow (not yet implemented)

Question 12: "Reporting Manager Email"
  Type: Email input
  Required: YES
  Format: Valid email
  Triggers:
    - Stored in column 13
    - CRITICAL: May be used for manager approval (not yet implemented)
    - May be notified of form submission
```

**Review Checklist:**
- [ ] Are first/last name fields required? Should middle initial be captured?
- [ ] Hire Date: Should there be validation to reject past dates?
- [ ] Hire Date: Should there be warning if > 30 days in future?
- [ ] Hire Date: Should system calculate start date from hire date + lead time?
- [ ] Site Name: Are these the only three sites? Complete list?
- [ ] Position/Job Code: Are the 9 total positions (3 per site) complete and accurate?
- [ ] Position/Job Code: Should there be a "Other/Custom" option for new positions?
- [ ] Department: Should this field be CONDITIONAL based on Site? (Not all depts at all sites)
- [ ] Department: Is this 7-department list complete? Missing any?
- [ ] Employment Type: Should there be conditional questions based on this?
  - IF Hourly → Capture hourly rate, overtime eligibility, schedule
  - IF Salary → Capture salary range, bonus structure, exemption status
- [ ] Manager Email: Should this be validated against a list of valid managers?
- [ ] Manager Email: Should there be a separate "Manager Name" field?
- [ ] Manager Email: Should manager approval be collected (checkbox/signature)?

**Triggers/Workflow:**
- All fields → Spreadsheet columns 6-13 (First Name through Manager Email)
- Position/Job Code + Department → May determine which systems/access needed (NOT YET IMPLEMENTED)

**Missing Elements:**
- [ ] Manager Name field (only has email)
- [ ] Manager Approval checkbox/confirmation
- [ ] Cost Center field (for budget tracking)
- [ ] Direct Manager Phone (backup contact)
- [ ] Secondary Manager/Backup Manager
- [ ] Background Check Status field
- [ ] Expected Start Date (vs Hire Date)
- [ ] Employment Classification (Full-time, Part-time, Temp, Contract) - different from Hourly/Salary
- [ ] Conditional questions based on Employment Type
- [ ] Conditional questions based on Department (different forms for IT vs Fleet)

---

#### 1D. EQUIPMENT & ACCESS REQUESTS SECTION
```
Instruction: "Select all items needed for the new employee:"

Question 13: "Laptop"
  Type: Checkbox
  Required: NO
  Value if checked: "Yes"
  Value if unchecked: "No"
  Triggers:
    - Stored in column 14
    - May trigger IT system setup (not yet linked)

Question 14: "Monitor"
  Type: Checkbox
  Required: NO
  Triggers: Stored in column 15

Question 15: "Keyboard"
  Type: Checkbox
  Required: NO
  Triggers: Stored in column 16

Question 16: "Mouse"
  Type: Checkbox
  Required: NO
  Triggers: Stored in column 17

Question 17: "Phone"
  Type: Checkbox
  Required: NO
  Triggers: Stored in column 18
```

**Review Checklist:**
- [ ] Are these all hardware items? Should software licenses be separate?
- [ ] Should checkboxes be YES/NO dropdown instead? (Clarity: "Yes, provide" vs "No, don't provide")
- [ ] Are these the ONLY equipment options needed, or should there be more?
  - Missing: Docking station, external hard drive, USB devices, headset, webcam, printer access
  - Missing: Software licenses (Office, Adobe, specialized tools)
  - Missing: Security (VPN, MFA hardware token, badge reader)
- [ ] Should equipment selection be CONDITIONAL based on position/department?
  - Example: Fleet drivers need different equipment than IT staff
- [ ] Should there be confirmation of specific model numbers? (Laptop model, monitor size, etc.)
- [ ] Should equipment be tracked with serial numbers/asset tags?
- [ ] Missing: System Access section
  - Which systems does the employee need? (Email, Slack, ADP, JONAS, SiteDocs, VPN, etc.)
  - Access level for each system? (Admin, User, Read-Only)
  - Is access temporary or permanent?
  - When should access be provisioned?
- [ ] Missing: Boss/Manager specific access needs
  - Does reporting manager need supervisor-level access?
  - Does manager need budget/payroll access?

**Triggers/Workflow:**
- Laptop, Monitor, Keyboard, Mouse, Phone → Spreadsheet columns 14-18
- Currently stored but NOT TRIGGERING any downstream workflow
- IT Form should automatically be triggered based on these selections

**Missing Sections (CRITICAL GAPS):**
- [ ] **Systems Access Section** - What systems does employee need?
  - Email account
  - Slack/Teams
  - ADP (Payroll/HR)
  - JONAS (ERP/Accounting)
  - SiteDocs (Safety)
  - VPN
  - WiFi
  - Domain login
  - Third-party tools (specific to department)
- [ ] **Boss/Manager Information** - Currently only has email
  - Manager Name (separate field)
  - Manager approval (yes/no)
  - Manager phone
  - Is this manager a supervisor in ADP?
  - Does manager need admin access?
- [ ] **System Access Needs Based on Role**
  - If Department = IT → Need IT system access form
  - If Department = Fleet → Need Fleetio system access form
  - If Department = Accounting → Need JONAS access
  - If Position = Manager/Supervisor → Need ADP supervisor/manager access
- [ ] **Compliance/Background Check Status**
  - Is background check complete?
  - Are references verified?
  - Is I-9 documentation ready?
  - Is signed offer letter/contract received?

---

#### 1E. FORM SUBMISSION & PROCESSING

**Submit Button Behavior:**
```javascript
handleSubmit(event)
  ├─ Disables submit button and shows spinner
  ├─ Collects all form data into formData object
  ├─ Calls server function: processInitialRequest(formData)
  │  ├─ Generates unique Request ID (WMAR-YYYYMMDD-XXXX)
  │  ├─ Gets current timestamp
  │  ├─ Opens spreadsheet (CONFIG.SPREADSHEET_ID)
  │  ├─ Appends row to "Initial Requests" sheet
  │  ├─ Calls sendNotifications() to notify departments
  │  └─ Returns {success: true, requestId: "WMAR-..."}
  └─ Shows success message with Request ID for 5 seconds
  └─ Resets form and hides main form
```

**Current Notification Recipients (from EmailUtils.gs):**
- HR: dbinns@robinsonsolutions.com
- IT: dbinns@robinsonsolutions.com
- All notifications currently go to SAME email address

**Current Form Routing (Code.gs, lines 65-75):**
After initial submission, the following forms are triggered and sent to department emails:
- form=hr → HRForm.html
- form=it → ITForm.html
- form=fleetio → FleetioForm.html
- form=creditcard → CreditCardForm.html
- form=306090 → Review306090Form.html
- form=adp_supervisor → ADPSupervisorForm.html
- form=adp_manager → ADPManagerForm.html
- form=jonas → JonasForm.html
- form=sitedocs → SiteDocsForm.html

**Review Checklist:**
- [ ] Should form submission be validated server-side before saving?
- [ ] Should duplicate submissions be prevented? (Same employee, same date)
- [ ] Should there be a confirmation step before spreadsheet write?
- [ ] Is the auto-hide (5 seconds) sufficient for user to see success message?
- [ ] Should Request ID be displayed more prominently?
- [ ] Should user be given option to send to email or print Request ID?
- [ ] Should there be error handling for network issues?
- [ ] Should there be retry logic if submission fails?
- [ ] Are all departments being notified automatically?
- [ ] Are department email addresses correct and complete?
- [ ] Should specific managers be notified based on department/site?

**Missing Workflow Elements:**
- [ ] No server-side validation of required fields
- [ ] No duplicate submission detection
- [ ] No conditional notification routing (only notify relevant departments based on selections)
- [ ] No tracking of which department forms have been completed
- [ ] No escalation if forms not completed within SLA
- [ ] No feedback to initial requester on form completion status

---

### FORM 2-10: DEPARTMENT-SPECIFIC FORMS
**Current Status:** ALL ARE PLACEHOLDERS (identical stub files)

#### Current Placeholder Structure
Files: HRForm.html, ITForm.html, FleetioForm.html, CreditCardForm.html, ADPSupervisorForm.html, ADPManagerForm.html, JonasForm.html, Review306090Form.html, SiteDocsForm.html

**Current Implementation (Confirmed):**
```html
1. Display company logo and header
2. Show form title (from Code.gs formTitles mapping)
3. Display read-only employee data in table:
   - Request ID
   - Employee Name (First + Last)
   - Hire Date
   - Site
   - Department
   - Position
   - Manager Email
4. Show "Mark as Complete" button (for testing only)
```

**Current Workflow Processing (Code.gs, line 185-204):**
```javascript
processPlaceholder(requestId, formType)
  ├─ Gets current timestamp
  ├─ Gets active user email
  ├─ Logs completion (LOGS ONLY - does NOT save to sheet)
  └─ Returns success message: "Test mode - not saved to sheet"
```

**CRITICAL ISSUES TO REVIEW & CORRECT:**
- [ ] Department form data is NOT being saved anywhere (processPlaceholder only logs)
- [ ] No actual form fields exist for departments to fill out
- [ ] No validation of form completion
- [ ] No tracking of who completed each form
- [ ] No tracking of completion timestamp
- [ ] No conditional routing (all departments get same placeholder regardless of role/department)
- [ ] No linking back to initial request tracking

---

## PART 4: SYSTEM WORKFLOW OVERVIEW

### Current Workflow (As Implemented)
```
1. User visits web app URL
   ↓
2. InitialRequest.html displayed
   ├─ User completes gatekeeper question
   ├─ User fills requester info (3 fields)
   ├─ User fills employee info (8 fields)
   ├─ User selects equipment (5 checkboxes)
   └─ User submits form
   ↓
3. Server processes submission
   ├─ Generates Request ID
   ├─ Saves 19 data fields to "Initial Requests" sheet
   └─ Sends email notifications to departments
   ↓
4. Email notifications sent
   ├─ Each department receives form link: ?form=TYPE&id=REQUEST_ID
   ├─ HR: ?form=hr&id=WMAR-YYYYMMDD-XXXX
   ├─ IT: ?form=it&id=WMAR-YYYYMMDD-XXXX
   └─ (And 7 more similar form links)
   ↓
5. Department opens form link
   ├─ Server retrieves request data by ID
   ├─ Displays placeholder form with employee info
   ├─ Shows "Mark as Complete" button
   └─ NO ACTUAL FORM FIELDS TO COMPLETE
   ↓
6. Department clicks "Mark as Complete"
   ├─ Logs completion (but DOESN'T SAVE to spreadsheet)
   └─ Shows "Test mode - not saved" message
   ↓
7. NO workflow progression (forms don't update status)
   (Workflow stops here - no tracking of completion)
```

### Missing Workflow Elements
**Critical gaps that MUST be addressed:**

1. **Conditional Form Routing**
   - Current: ALL departments get ALL notifications
   - Required: Only relevant departments based on:
     - Department selection
     - Position/Role (manager vs individual contributor)
     - Equipment selections
     - Site/Location

2. **Actual Form Fields for Departments**
   - Current: Placeholder "Mark as Complete" buttons
   - Required: Real forms with questions, validations, data capture

3. **Data Persistence for Department Forms**
   - Current: Form completion not saved
   - Required: Store department form responses in spreadsheet

4. **Status Tracking**
   - Current: Only "Submitted" status in "Workflow Status" column
   - Required: Track which departments have completed
   - Required: Track completion status/dates per department

5. **Completion Confirmation & Escalation**
   - Current: No notification back to requester
   - Required: Notify requester when all forms complete
   - Required: Escalate if forms not completed within SLA

6. **Server-Side Data Processing**
   - Current: processPlaceholder() only logs (line 190-191)
   - Required: Actual save to appropriate department data sheet
   - Required: Validation of required fields before save
   - Required: Timestamp and user tracking

---

## PART 5: INITIAL REQUEST FORM - COMPLETE VALIDATION CHECKLIST

### Pre-Submission Checklist (Gatekeeper Section)
- [ ] Question text is clear and unambiguous
- [ ] Question text defines "Recruiting Requirements" or links to definition
- [ ] Yes/No options are appropriate (or should there be "N/A" option?)
- [ ] Error message for "No" answer is clear
- [ ] Form submission is blocked if "No" is selected (server-side)
- [ ] Help text or documentation link is provided
- [ ] Gatekeeper section is visually distinct from main form

### Requester Information Section
- [ ] "Your Name" field has validation (required, length limits)
- [ ] "Your Email" field has validation (required, email format)
- [ ] "Your Email" is used correctly for confirmation email
- [ ] "Your Phone Number" field has format validation (or is validated server-side)
- [ ] Clear label explaining these are the FORM SUBMITTER's details (not employee)
- [ ] Option to use different contact for follow-up questions
- [ ] Confirmation that requester has authority to request

### New Employee Information Section
- [ ] "First Name" field required and validated
- [ ] "Last Name" field required and validated
- [ ] Middle name/initial option considered
- [ ] "Hire Date" field has date validation
- [ ] "Hire Date" rejects past dates (not hiring retroactively)
- [ ] "Hire Date" may warn if > 30 days future
- [ ] "Site Name" field has all locations listed
- [ ] "Position/Job Code" dynamically updates based on site
- [ ] "Position/Job Code" has "Other/Custom" option for new positions
- [ ] "Department" is relevant to all sites (or should be conditional)
- [ ] "Department" list is complete and up-to-date
- [ ] "Employment Type" (Hourly vs Salary) triggers appropriate follow-ups
- [ ] "Reporting Manager Email" is validated (format and possibly against staff list)
- [ ] **MISSING: Manager Name field**
- [ ] **MISSING: Manager Approval checkbox**
- [ ] **MISSING: Cost Center field**
- [ ] **MISSING: Systems Access section**

### Equipment & Access Section
- [ ] Checkboxes clearly indicate "select all that apply"
- [ ] Equipment list is complete (or marked as "basic" with department-specific elsewhere)
- [ ] **MISSING: System Access section** (critical gap)
  - [ ] Which systems does employee need?
  - [ ] What access level (admin, user, read-only)?
  - [ ] Temporary or permanent access?
- [ ] **MISSING: Conditional equipment selection** based on role
- [ ] **MISSING: Asset tagging/serial number fields**
- [ ] **MISSING: Software licenses section**

### Form Submission
- [ ] All required fields validated on client side
- [ ] All required fields validated on server side (MISSING)
- [ ] Server-side validation prevents spreadsheet save if validation fails
- [ ] Request ID format is appropriate and unique
- [ ] Timestamp is accurate
- [ ] Success message is clear and visible
- [ ] Auto-hide timeout (5 seconds) is appropriate
- [ ] Error messages are clear and actionable
- [ ] Retry mechanism exists for failed submissions
- [ ] Submitted data is saved to correct sheet
- [ ] Email notifications are sent to correct recipients
- [ ] Email notifications use correct form links

### General Accessibility & UX
- [ ] Form labels are clear and unambiguous
- [ ] Required fields are clearly marked with asterisk (*)
- [ ] Instructions are provided where needed
- [ ] Form sections are visually separated
- [ ] Form is responsive (mobile, tablet, desktop)
- [ ] Form has proper tab order and keyboard navigation
- [ ] Error messages appear near the problematic field
- [ ] Success messages are dismissible by user (not just auto-hide)
- [ ] Reset button clears form appropriately
- [ ] Form prevents accidental data loss (confirm before reset?)

---

## PART 6: DEPARTMENT FORMS - REVIEW REQUIREMENTS

### Each Department Form MUST Include:

**A. READ-ONLY SECTION**
- Employee Name, Hire Date, Site, Department, Position, Manager
- Request ID and Status
- Link back to employee details if needed

**B. ACTUAL DATA ENTRY SECTION**
- Department-specific questions and fields
- Validation rules for each field
- Required field marking
- Help text where needed
- Conditional fields that appear based on earlier answers

**C. FORM SUBMISSION**
- Submit button (not just "Mark Complete")
- Save to appropriate department data sheet (or linked sheet)
- Validation before save
- Clear success/error messages
- Timestamp of completion
- User identification (who completed)

**D. WORKFLOW HANDLING**
- Save completion status back to main request
- Trigger next steps (e.g., if HR complete, mark HR as done)
- Notify relevant parties of completion
- Allow for revisions if needed (edit existing submission)

---

### Form 2: HRForm.html
**Current Status:** PLACEHOLDER
**Trigger:** Department = HR OR Requester = HR person
**Should Capture:**
- [ ] Employment Classification (Full-time, Part-time, Contract, Temporary)
- [ ] Pay Class (Exempt, Non-exempt, Salaried, Hourly with rate)
- [ ] Tax Withholding (W4 elections, State residence)
- [ ] Benefits Selection (Health plan, Dental, Vision, 401k, FSA)
- [ ] Emergency Contact (Name, Phone, Relationship)
- [ ] Background Check Status (Passed/Pending/Failed/Waived)
- [ ] I-9 Documentation Status (Verified/Pending/Missing)
- [ ] Direct Deposit Authorization (Account routing/account)
- [ ] Confidentiality/NDA Agreement (Signed yes/no, date)
- [ ] Employee Handbook Acknowledgment (Read yes/no)
- [ ] Assigned Payroll ID (if applicable)
- [ ] HR Coordinator assignment

**Data Saved To:** [WHERE? Needs to be defined]
**Completion Triggers:** [WHAT HAPPENS NEXT?]
**Notifications:** [WHO NEEDS TO KNOW?]

**Questions to Answer Before Developing:**
- [ ] Should all these fields be required or some optional?
- [ ] Should field values be pre-populated based on department/position?
- [ ] Are there dependencies (e.g., "if Full-time then show benefits")?
- [ ] Who approves these selections (HR Manager review)?
- [ ] Can this form be edited after initial submission?
- [ ] Should there be a signature/approval line?

---

### Form 3: ITForm.html
**Current Status:** PLACEHOLDER
**Trigger:** Department = IT OR Equipment selections = Laptop, Monitor, etc.
**Should Capture:**
- [ ] Hardware Assignment (Laptop serial, Monitor model/serial, etc.)
- [ ] Keyboard, Mouse, Phone assignments
- [ ] Email Account (Username, Setup Status, Primary/Secondary)
- [ ] Software Licenses (Office 365, VPN client, Development tools)
- [ ] Network Access (Domain login, WiFi, VPN)
- [ ] System Account Creation (List by system)
- [ ] VPN/Remote Access (Needs approval? Assigned device list)
- [ ] Email Distribution Lists (Which ones should user be on?)
- [ ] Shared Drive Access (Which drives/folders)
- [ ] MFA Setup Status (Yes/No, Device assigned)
- [ ] Completed Checklist Items (Track what's been provisioned)
- [ ] IT Support Contact Assignment
- [ ] Setup Documentation Sent (Yes/No, Date)

**Conditional Logic Needed:**
- If Laptop = Yes, then show laptop-specific fields
- If Phone = Yes, then show phone fields
- If Department = IT, then show administrative access options
- If Position = Manager, then show Supervisor access options

**Data Saved To:** [WHERE? Needs to be defined]
**Completion Triggers:** [WHAT HAPPENS NEXT?]
**Notifications:** [WHO NEEDS TO KNOW?]

---

### Form 4: FleetioForm.html
**Current Status:** PLACEHOLDER
**Trigger:** Department = Fleet OR Equipment = Phone with vehicle context
**Should Capture:**
- [ ] Vehicle Assignment (Vehicle ID, Make/Model, License Plate)
- [ ] Driver's License Validation (License #, Expiration, Violations)
- [ ] Insurance Requirement (Required yes/no, Policy #)
- [ ] Vehicle Keys/Fobs (Serial numbers, assignment date)
- [ ] Fuel Card (Card #, PIN, Limits)
- [ ] Mileage Tracking (Initial odometer reading, frequency)
- [ ] Route Assignment (Territory, Primary routes)
- [ ] Maintenance Schedule (Understanding, acknowledgment)
- [ ] Safety Equipment (Checklist: hardhats, safety vests, etc.)
- [ ] Vehicle Inspection Checklist (Safety, equipment working)

**Conditional Logic:**
- If Department = Fleet, then show all fleet fields
- If Position includes "Driver", then show vehicle assignment
- Otherwise, skip fleet form

---

### Form 5: CreditCardForm.html
**Current Status:** PLACEHOLDER
**Trigger:** Department = Accounting OR specific position = needs corporate card
**Should Capture:**
- [ ] Card Type (Corporate Amex, Business Visa, other)
- [ ] Card Holder (Confirm employee name)
- [ ] Credit Limit ($amount, reviewed/approved)
- [ ] Billing Address (Company or employee home?)
- [ ] Expense Categories Allowed (List of approved categories)
- [ ] Receipt Requirement Threshold ($100? $50?)
- [ ] Reconciliation Frequency (Monthly, Quarterly)
- [ ] Cardholder Agreement (Signed yes/no)
- [ ] Lost/Theft Protocol (Employee acknowledges)
- [ ] Card Status (Active, Pending, Denied)
- [ ] Activation Date

---

### Form 6: ADPSupervisorForm.html
**Current Status:** PLACEHOLDER
**Trigger:** Position = Manager/Supervisor
**Should Capture:**
- [ ] ADP Supervisor Account (Created/Pending/Not Assigned)
- [ ] Supervisor Module Access (Timekeeping, Payroll, Reports - which?)
- [ ] Payroll View Rights (Can view all/own team only)
- [ ] Employee Records Access (Edit permissions, what fields)
- [ ] Timekeeping Override (Can override employee punch times)
- [ ] Approval Workflows (Can approve timesheets/requests)
- [ ] Report Access (Which standard reports)
- [ ] Team List (List of employees this supervisor manages)
- [ ] Training Status (Completed yes/no, date)
- [ ] First Login Instructions (Sent yes/no, date)
- [ ] Support Contact (ADP admin contact info)

---

### Form 7: ADPManagerForm.html
**Current Status:** PLACEHOLDER
**Trigger:** Position = Manager (higher level than Supervisor)
**Should Capture:**
- [ ] ADP Manager Account (Created/Pending/Not Assigned)
- [ ] Manager Dashboard Access (Analytics, KPIs, Department metrics)
- [ ] Budgeting Module (If applicable, access level)
- [ ] Workforce Planning Tools (Forecasting, headcount planning)
- [ ] Compensation Analysis (Can view salary bands/ranges)
- [ ] Team Performance Metrics (Access to evaluations/ratings)
- [ ] Manager Portal Training (Completed yes/no, date)
- [ ] Approvals Workflow (Can approve requests, what types)
- [ ] Support Contact Assignment
- [ ] System Access Credentials (Temporary/Permanent)

---

### Form 8: JonasForm.html
**Current Status:** PLACEHOLDER
**Trigger:** Department = Accounting OR Finance OR Position requires JONAS
**Should Capture:**
- [ ] JONAS User Account (Created/Pending/Not Assigned)
- [ ] Module Assignment (Accounting, Inventory, Purchasing, Reporting, other)
- [ ] Company Codes Accessible (List of allowed company codes)
- [ ] Department Codes (Budget centers user can access)
- [ ] Transaction Authority (Dollar limits if applicable)
- [ ] Report Builder Access (Yes/No)
- [ ] Standard Report Access (Which reports)
- [ ] Data Entry Permissions (Create, Edit, View, Delete by module)
- [ ] Approver Workflows (Purchase order approval, check approval, etc.)
- [ ] Security Training (Completed yes/no, date)
- [ ] First Login Support (Provided yes/no)
- [ ] Go-Live Confirmation (User ready yes/no)

---

### Form 9: Review306090Form.html
**Current Status:** PLACEHOLDER
**Trigger:** Used at 30-day, 60-day, and 90-day marks (separate submission)
**Note:** This form is DIFFERENT - it's a periodic review, not onboarding
**Should Capture:**
- [ ] Review Date (When is this review being completed)
- [ ] Review Type (30-day, 60-day, 90-day, other)
- [ ] Overall Performance Rating (1-5 scale with description)
- [ ] Job Responsibilities Understanding (Rate 1-5)
- [ ] Training Completion Percentage (0-100%)
- [ ] Team Integration (Rate 1-5)
- [ ] Key Achievements (Text field)
- [ ] Issues or Concerns (Text field, if any)
- [ ] Performance Gaps (List if any)
- [ ] Manager Recommendation (Continue, Continue with improvement plan, Probation, Terminate)
- [ ] Employee Comments/Response (Text field)
- [ ] Next Review Date (Auto-calculated or specified)
- [ ] Manager Signature/Approval
- [ ] Employee Acknowledgment

**Workflow Triggers:**
- If "Needs Improvement" → Trigger improvement plan form
- If "Probation" → Escalate to HR
- If "Terminate" → Escalate to HR + Legal review

---

### Form 10: SiteDocsForm.html
**Current Status:** PLACEHOLDER
**Trigger:** Site/Location has safety training requirements
**Should Capture:**
- [ ] Safety Training Completion (Yes/No, Date)
- [ ] Required Documents (List of required docs - OSHA, Site-specific)
- [ ] Document Received (Checkboxes for each required doc)
- [ ] Site Access Badge (Issued yes/no, Serial number)
- [ ] Badge Assignment Date
- [ ] Safety Equipment Issued (Checklist: Hard hat, Safety vest, Gloves, etc.)
- [ ] Induction Video (Watched yes/no, date)
- [ ] Site Supervisor Name (Who supervised induction)
- [ ] Supervisor Sign-Off (Name, signature date)
- [ ] Emergency Procedures (Acknowledged yes/no)
- [ ] Hazard Communication Training (Completed yes/no)
- [ ] First Aid/CPR Certification (If required yes/no, cert expiration)
- [ ] Site Safety Rules Acknowledgment (Read and understood yes/no)

---

## PART 7: BACKEND & DATA STORAGE REVIEW

### Code.gs - Functions to Review & Validate

**Function: renderInitialRequestForm() [Line 34-48]**
- [ ] Correct template file path
- [ ] All required server-side variables injected
- [ ] Logo URL valid
- [ ] Company name correct
- [ ] Page title set correctly
- [ ] XFrameOptionsMode allows embedding

**Function: processInitialRequest() [Line 120-177]**
- [ ] Request ID generation is unique and always succeeds
- [ ] Timestamp is captured in correct timezone (New_York per config)
- [ ] All 19 data fields properly mapped to form data
- [ ] Spreadsheet and sheet lookups use correct IDs
- [ ] Row append doesn't skip columns or include extra columns
- [ ] Timestamp is inserted as Date object (not string)
- [ ] Workflow Status is set to "Submitted" (correct)
- [ ] Email notifications always sent after save
- [ ] Error handling catches and logs exceptions
- [ ] Return values are JSON format with success/message/requestId
- [ ] Duplicate submissions are handled (or prevented)
- [ ] Required field validation on server-side (MISSING)

**Function: renderSubForm() [Line 56-104]**
- [ ] Request ID and form type parameters are extracted
- [ ] getRequestData() is called correctly
- [ ] Request not found error is handled
- [ ] Form file mapping is complete (9 forms + default)
- [ ] Form titles are correct and match email references
- [ ] Request data is properly passed to template
- [ ] Logo and company name are passed
- [ ] Page title includes employee name (good UX)
- [ ] XFrameOptionsMode allows embedding

**Function: processPlaceholder() [Line 185-205]**
- [ ] This function ONLY LOGS - data not saved
- [ ] This is a PLACEHOLDER implementation (confirmed)
- [ ] MUST BE REPLACED with real form processing
- [ ] User email extraction may fail if not logged in (error handling needed)
- [ ] Return message says "test mode" (intentional)

**Function: getRequestData() [Line 212-236]**
- [ ] Correct spreadsheet ID lookup
- [ ] Correct sheet name lookup
- [ ] Data range retrieval includes all columns
- [ ] Row iteration starts at 1 (skips header row - correct)
- [ ] Request ID lookup is case-sensitive (potential issue - validate)
- [ ] All FORM_FIELDS mapped correctly to data columns
- [ ] Null return if not found is correct
- [ ] Error handling catches and logs exceptions

**Function: generateRequestId() [Line 243-257]**
- [ ] Format is WMAR-YYYYMMDD-XXXX (correct based on existing data)
- [ ] Date components are zero-padded (correct)
- [ ] 4-character random suffix uses alphanumeric
- [ ] Suffix includes both letters and numbers (good entropy)
- [ ] No collision detection (potential issue - validate low probability)

**Function: getAllSites(), getJobCodesForSite() [Line 264-274]**
- [ ] Both functions correctly access CONFIG.JOB_CODES
- [ ] Used by InitialRequest.html for dynamic dropdown
- [ ] Return types are correct (Object keys array, array of objects)

**Missing Functions in Code.gs:**
- [ ] validateInitialRequestData() - Server-side validation
- [ ] processDepartmentForm() - Actual form processing
- [ ] saveDepartmentFormData() - Save to department sheets
- [ ] updateRequestStatus() - Track completion status
- [ ] sendDepartmentNotification() - Conditional notification
- [ ] getWorkflowStatus() - Track overall request progress

---

### Config.gs - Configuration to Review & Validate

**GOOGLE RESOURCES**
- [ ] SHARED_DRIVE_ID is correct (Team Group Companies)
- [ ] SPREADSHEET_ID is correct and accessible
- [ ] SHEET_NAME is correct ("Initial Requests")
- [ ] MAIN_FOLDER_ID is correct and accessible

**BRANDING**
- [ ] COMPANY_NAME is correct ("Team Group Companies")
- [ ] LOGO_URL is valid and accessible (imgur.com URL)

**FORM_FIELDS [19 columns]**
- [ ] Order matches spreadsheet column order exactly
- [ ] All column names are correct
- [ ] No extra or missing columns
- [ ] Request ID is first column
- [ ] Workflow Status is last column

**JOB_CODES**
- [ ] 3 sites (Atlanta, Charlotte, Nashville) are correct
- [ ] 9 positions total (3 per site) - are these complete?
- [ ] Job numbers and descriptions are accurate
- [ ] Any new sites/positions need to be added?

**DEPARTMENTS [7 departments]**
- [ ] All departments listed: Operations, Administration, Safety, Accounting, HR, IT, Fleet
- [ ] Is this list complete?
- [ ] Any departments missing?
- [ ] Any departments that should be renamed?

**EQUIPMENT [5 items]**
- [ ] Laptop, Monitor, Keyboard, Mouse, Phone
- [ ] Are these all the equipment options?
- [ ] Should software licenses be separate?
- [ ] Should specialized equipment (scanners, printers, etc.) be added?

**WORKFLOW_STATUS [4 statuses]**
- [ ] Submitted, In Progress, Completed, Cancelled
- [ ] Are these sufficient for tracking?
- [ ] Should there be status per department (HR: Completed, IT: In Progress)?

**EMAILS [9 department emails + 1 notification email]**
- [ ] All currently set to dbinns@robinsonsolutions.com
- [ ] THESE ARE PLACEHOLDER - NEED REAL EMAIL ADDRESSES
- [ ] HR email should be: [VERIFY]
- [ ] IT email should be: [VERIFY]
- [ ] Other department emails: [VERIFY]
- [ ] Who should receive general notifications? [VERIFY]

**ENABLE_DEFAULT_VALUES [Boolean flag]**
- [ ] Currently TRUE (forms prefilled for testing)
- [ ] Should be FALSE in production
- [ ] Need to confirm test values are accurate

**DEFAULT_VALUES [Test values]**
- [ ] Requester: Dan Binns / dbinns@robinsonsolutions.com
- [ ] Employee: John Smith
- [ ] Hire Date: 2025-12-15 (future date - test only)
- [ ] Site: Atlanta
- [ ] Department: Operations
- [ ] Position: 1001 - Project Manager
- [ ] Employment Type: Salary
- [ ] Manager Email: dbinns@team-group.com
- [ ] Equipment: All set to Yes
- [ ] Are these appropriate test values?

---

### Spreadsheet Schema Review

**Sheet: "Initial Requests" [19 columns]**

**Column Structure:**
```
A: Request ID (String format: WMAR-YYYYMMDD-XXXX)
B: Submission Timestamp (Date/Time format)
C: Requester Name (Text)
D: Requester Email (Email)
E: Requester Phone (Phone format)
F: First Name (Text)
G: Last Name (Text)
H: Hire Date (Date format)
I: Site Name (Text)
J: Department (Text)
K: Position/Title (Text)
L: Hourly or Salary (Text: Hourly or Salary)
M: Reporting Manager Email (Email)
N: Laptop (Text: Yes or No)
O: Monitor (Text: Yes or No)
P: Keyboard (Text: Yes or No)
Q: Mouse (Text: Yes or No)
R: Phone (Text: Yes or No)
S: Workflow Status (Text: Submitted, In Progress, Completed, Cancelled)
```

**Review Checklist:**
- [ ] Column headers match CONFIG.FORM_FIELDS exactly
- [ ] Data types are appropriate (dates as dates, emails as text, etc.)
- [ ] Request ID column is primary key (unique values)
- [ ] Submission Timestamp is DateTime format
- [ ] Workflow Status defaults to "Submitted"
- [ ] All equipment columns have Yes/No values (never blank)
- [ ] Formula to auto-fill Workflow Status should be implemented

**Missing Columns (Should be added):**
- [ ] Manager Name (currently only has email)
- [ ] Manager Approval Status
- [ ] Cost Center
- [ ] Systems Access Requirements (list)
- [ ] Status per Department (HR: Submitted, IT: In Progress, etc.)
- [ ] Overall Completion Percentage
- [ ] Date Each Department Completed (tracking columns)
- [ ] Assigned HR Coordinator
- [ ] Assigned IT Support
- [ ] Employee Start Date Confirmed
- [ ] Background Check Status

**New Sheets Needed (for department form data):**
- [ ] HRData sheet (for storing HR form submissions)
- [ ] ITData sheet (for storing IT form submissions)
- [ ] FleetData sheet (for storing Fleetio submissions)
- [ ] CreditCardData sheet
- [ ] ADPSupervisorData sheet
- [ ] ADPManagerData sheet
- [ ] JonasData sheet
- [ ] Review306090Data sheet
- [ ] SiteDocsData sheet

---

## PART 8: COMPLETE WORKFLOW CHECKLIST

### Pre-Submission (Before InitialRequest.html)
- [ ] User receives email or link to new employee request system
- [ ] User understands they're filling out NEW EMPLOYEE onboarding request
- [ ] User has collected all required information before starting
- [ ] User has supervisor/HR approval to submit (if required)

### InitialRequest.html Submission
- [ ] Form loads without errors
- [ ] Default values appear (if enabled)
- [ ] Gatekeeper question is answered "Yes"
- [ ] Requester info is filled (3 fields)
- [ ] Employee info is filled (8 fields)
- [ ] Equipment selection is made (5 checkboxes)
- [ ] Form is submitted successfully
- [ ] Success message shows Request ID
- [ ] Form clears after submission

### Post-Submission: Initial Processing (Code.gs)
- [ ] Server receives form data
- [ ] Request ID is generated uniquely
- [ ] Timestamp is recorded
- [ ] Data is saved to Initial Requests sheet (19 columns)
- [ ] Workflow Status is set to "Submitted"
- [ ] Email notifications are triggered
- [ ] Success response is sent to client

### Email Notifications
- [ ] HR receives email with request details
- [ ] IT receives email with request details
- [ ] (Other departments based on department selection)
- [ ] Email includes employee name, hire date, position
- [ ] Email includes unique form link for each department
- [ ] Email explains what action is needed
- [ ] Email includes deadline or SLA (if any)

### Department Forms: Viewing (HRForm.html, ITForm.html, etc.)
- [ ] Department staff click email link
- [ ] Server retrieves request data by ID
- [ ] Request found (no "not found" error)
- [ ] Form loads with:
  - [ ] Company logo and header
  - [ ] Form title (e.g., "HR Setup")
  - [ ] Read-only employee info (name, hire date, position, etc.)
  - [ ] Actual data-entry fields (CURRENTLY MISSING)
  - [ ] Submit button (CURRENTLY MISSING)
- [ ] Form displays without errors

### Department Forms: Completion (NEEDS DEVELOPMENT)
- [ ] Department staff fills out required fields
- [ ] Client-side validation prevents invalid entries
- [ ] Validation shows clear error messages
- [ ] Staff can submit form with confidence
- [ ] Server receives form submission
- [ ] Server validates all required fields (server-side validation)
- [ ] Server saves department form data to appropriate sheet
- [ ] Server updates request status for that department (e.g., "HR: Completed")
- [ ] Server sends confirmation email
- [ ] Server sends notification to next step in workflow (if applicable)
- [ ] Success message is displayed
- [ ] Form cannot be submitted twice with identical data (duplicate prevention)

### Post-Completion: Status Tracking (NEEDS DEVELOPMENT)
- [ ] Overall request status reflects completion progress
- [ ] Email is sent to requester with status update
- [ ] Email lists which departments are complete and which are pending
- [ ] Dashboard or report shows request status
- [ ] If SLA is approaching, escalation email is sent
- [ ] When ALL departments complete, final confirmation is sent
- [ ] Requester knows employee is ready to start

### Final Handoff: Employee Ready (NEEDS DEVELOPMENT)
- [ ] All department forms completed
- [ ] Overall status marked "Completed"
- [ ] Final notification sent to HR
- [ ] Employee records created in all systems
- [ ] IT has provisioned all accounts
- [ ] Benefits are enrolled
- [ ] First-day instructions sent to employee and manager
- [ ] Manager has all contact info and first-day checklist

---

## PART 9: IDENTIFIED GAPS & MISSING COMPONENTS

### Critical Missing Elements (Must Implement Before Deadline)

**1. Initial Request Form Enhancements**
- [ ] Add Manager Name field (currently only email)
- [ ] Add Manager Approval checkbox
- [ ] Add Cost Center field
- [ ] Add Systems Access section (multi-select)
- [ ] Add Server-side validation for all required fields
- [ ] Add Gatekeeper validation on server-side (reject "No" submissions)

**2. Department Forms Implementation**
- [ ] Replace all 9 placeholder forms with real forms
- [ ] Each form needs questions specific to that department
- [ ] Each form needs server-side processing function
- [ ] Each form needs data persistence to department sheet
- [ ] Each form needs validation rules and error messages

**3. Backend Form Processing**
- [ ] Create validateInitialRequestData() function
- [ ] Create processDepartmentForm() function (generic)
- [ ] Create saveDepartmentFormData() function
- [ ] Create updateRequestStatus() function
- [ ] Create sendDepartmentNotification() function

**4. Spreadsheet Enhancement**
- [ ] Create 9 new department data sheets
- [ ] Update Initial Requests sheet with additional tracking columns
- [ ] Add formulas to track completion status
- [ ] Add dashboard or summary view

**5. Status Tracking System**
- [ ] Implement per-department status tracking
- [ ] Implement overall completion percentage
- [ ] Implement SLA tracking and escalation
- [ ] Create status dashboard

**6. Email & Notification System**
- [ ] Replace placeholder email addresses with real ones
- [ ] Update notification logic for conditional routing
- [ ] Create department-specific notification templates
- [ ] Create status update notifications to requester
- [ ] Create escalation notifications for overdue forms

**7. Workflow Orchestration**
- [ ] Define sequence of forms (which forms must complete before others)
- [ ] Define conditional routing (only show relevant forms)
- [ ] Define escalation rules (what happens if form not completed in 3 days)
- [ ] Define final completion workflow

---

## PART 10: TESTING CHECKLIST

### Unit Testing (Each Form)
- [ ] InitialRequest.html loads without errors
- [ ] Gatekeeper controls form visibility
- [ ] Job codes update dynamically when site changes
- [ ] Form submits successfully
- [ ] Request ID is generated
- [ ] Data is saved to spreadsheet
- [ ] Email notifications are sent

### Integration Testing (Full Workflow)
- [ ] User fills InitialRequest → Data saved → Email sent
- [ ] Email link works → Department form loads → Data saved
- [ ] All 9 department forms can be completed
- [ ] Overall request status updates as departments complete

### User Acceptance Testing (UAT)
- [ ] HR completes InitialRequest form
- [ ] HR receives email with form links
- [ ] HR clicks IT link and completes IT form
- [ ] IT clicks link and completes IT form
- [ ] All departments complete their forms
- [ ] Employee records are created in each system
- [ ] Follow-up notifications are sent

### Data Quality Testing
- [ ] All required fields captured
- [ ] Data in correct format (dates, emails, etc.)
- [ ] No empty rows in spreadsheet
- [ ] Request IDs are unique
- [ ] Timestamps are accurate
- [ ] Email addresses valid

### Error Handling Testing
- [ ] Invalid email address rejected
- [ ] Missing required field rejected
- [ ] Duplicate submission handled
- [ ] Network timeout handled with retry
- [ ] Server error shows clear message
- [ ] Database error is logged and user notified

---

## SUMMARY

**Current State:**
- InitialRequest.html is functional but missing critical fields
- All department forms are placeholders with no actual form fields
- Department form processing is a stub that only logs (doesn't save)
- No status tracking or workflow progression
- No server-side validation

**Deadline:** Tomorrow (2025-12-08)

**Critical Path:**
1. Review & confirm all InitialRequest.html issues
2. Add missing fields to InitialRequest.html
3. Build actual forms for all 9 departments
4. Implement form processing and data persistence
5. Test full workflow end-to-end
6. Deploy and validate

**Estimated Effort:** 8-10 hours of focused development

---

## NEXT STEPS

1. **Confirm this review document** - Are all elements captured? Any additions?
2. **Adjust review process if needed** - Are we missing any validation steps?
3. **Begin Form 1 detailed review** - Review InitialRequest.html question by question
4. **Confirm or correct findings** - Don't assume, validate against actual business requirements
5. **Revise Form 1** - Add missing fields and validations
6. **Deploy Form 1** - Push updated files
7. **Test Form 1** - End-to-end testing
8. **Move to Forms 2-10** - In parallel where possible

---

*Document last updated: 2025-12-07*
*Status: READY FOR REVIEW PROCESS TO BEGIN*
