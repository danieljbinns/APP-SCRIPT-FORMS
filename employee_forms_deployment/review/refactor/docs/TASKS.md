# Standards Compliance Task List
**Generated:** 2026-04-22  
**Reference:** `Standards.html` — open in browser, no server needed  
**Mockups:** `AllScreens.html` — shows every form as it should look  

---

## Global Changes — Every File

These apply to **all 18 HTML files** before touching anything file-specific.

| # | Change | Standard § | Notes |
|---|--------|-----------|-------|
| G1 | Replace CSS token names — `--brand-red` → `--red`, `--bg-color` → `--bg`, `--card-bg` → `--card`, `--text-main` → `--text`, `--text-muted` → `--muted`, `--input-bg` → `--ibg`, `--input-border` → `--ibdr`, `--border-color` → `--bdr`, `--success-green` / `--success` → `--ok`, `--brand-red-hover` → remove | §01 | Safe find+replace per file |
| G2 | Replace layout wrappers — remove `.container` / `#form-container` / `.card`. Replace with `.sim` → `.cw` → `.logo-wrap` + `.pctx` + `.cf` | §03 | See DOM order diagram in §03 |
| G3 | Logo wrapper class `.logo-container` → `.logo-wrap`. Logo `img` height → `60px` (remove `max-height`, set fixed `height:60px`) | §03 | |
| G4 | Add `.pctx` context banner between `.logo-wrap` and `.cf` on every form — content varies per form type (see §04 table) | §04 | |
| G5 | Section headings — replace `.section-title` divs and bare `<h2>` elements with `<h2 class="s">`. Remove red color, uppercase, letter-spacing from headings | §06 | |
| G6 | Input fields — rename `.form-field` → `.ff`, `.form-group` → `.ff`, `.form-row` → `.fr`, `.form-row-2` / `.form-row-3` → `.fr` / `.fr2`. Input/select/textarea elements → add class `.fi`. Labels → add class `.fl` | §08 | |
| G7 | Confirmation screen — replace all inline card-replacement success divs with the `.conf-screen` pattern: `✅` icon div + green `<h2>` + `<p>` message + `.btn.btn-p.cb` "Return to Dashboard" + `.cx` "You may close this window." | §18 | |
| G8 | Action buttons — wrap primary button in `.act1` div. Primary → `class="btn btn-p btn-full"`. For request forms with Save Draft → use `.acts` 2-col grid with `.btn.btn-s` + `.btn.btn-p` | §15 | |

---

## Per-File Task List

### REQUEST FORMS

---

#### `InitialRequest.html` — New Employee Request
*Reference: AllScreens.html → "New Employee Request"*

- [ ] **G1–G8** Apply all global changes
- [ ] **Checkbox tiles** — rename `.checkbox-label` → `.ct`, `.checkbox-group` → `.cbt`. Add/toggle `.on` class on checked state (JS already handles it — just rename) | §10
- [ ] **Sub-sections** — rename `.logic-section` + inline styles → `.sub-sec`. Inner item grids → `.cbg`. Apply to: BOSS, Jonas, ADP, Central Purchasing, Credit Card sub-sections | §11
- [ ] **Context banner content** — "Submitting this request will create onboarding action items for IT, Safety, HR, and any selected equipment or system departments." | §04
- [ ] **Action buttons** — change to `.acts` grid: "Save Draft" (.btn-s) + "Submit Request" (.btn-p) | §15
- [ ] **Remove** gatekeeper `<ul>` pre-form list — not a standard component; replace with a `.pctx` note if needed
- [ ] **Do not add** `.fhdr` — request forms start directly with `<h2 class="s">` | §20

---

#### `PositionSiteChangeRequest.html` — Position / Site Change Request
*Reference: AllScreens.html → "Position / Site Change Request"*

- [ ] **G1–G8** Apply all global changes
- [ ] **Checkbox tiles** — rename `.checkbox-label` → `.ct`, `.checkbox-group` → `.cbt` | §10
- [ ] **Sub-sections** — `.logic-section` → `.sub-sec`, inner grids → `.cbg` | §11
- [ ] **Context banner content** — "Current employee: [Name] · [Site] · [Title] · [email]" (blue `.pctx`) | §04
- [ ] **Section headings** — remove red color + uppercase + letter-spacing. `h2.s` is white/600 weight with bottom border only | §06
- [ ] **Action buttons** — `.acts` with "Save Draft" + "Submit to HR" | §15
- [ ] **Do not add** `.fhdr` — request form | §20

---

#### `TerminationRequest.html` — End of Employment Request
*Reference: AllScreens.html → "End of Employment Request"*

- [ ] **G1–G8** Apply all global changes
- [ ] **Checkbox tiles** — rename to `.ct` / `.cbt`. Add `.on` class toggle on checked state (verify JS handles it for equipment/systems tiles) | §10
- [ ] **Context banner** — use yellow variant: `class="pctx pctx-w"` with ⚠️ "Termination requests require HR approval before offboarding action items are created." | §04
- [ ] **Section headings** — remove red/uppercase from `h2` | §06
- [ ] **Action buttons** — `.acts` with "Save Draft" + "Submit to HR" | §15
- [ ] **Do not add** `.fhdr` — request form | §20

---

### APPROVAL FORMS

---

#### `StatusChangeApproval.html` — Status Change Approval
*Reference: AllScreens.html → "Status Change Approval"*

- [ ] **G1–G8** Apply all global changes
- [ ] **Add logo** — not present at all. Add `.logo-wrap` with TEAM Group logo img `height:60px` | §03
- [ ] **Form header** — add `.fhdr` block: `.bdg.b-pend` "Pending Approval" + `<h1>Status Change Approval — [Employee Name]</h1>` + `<p>HR review required</p>` | §05
- [ ] **Info grid** — rename `.info-grid` / `.info-row` → `.ti` / `.ir`. Items stack vertically (`.l` label on top, `.v` value below). Add `.ir.chg` on changed-value fields (new site, new title, new manager) | §07
- [ ] **HR confirmation fields** — keep editable inputs for manager email, job title, JR title. Wrap in `.fr` grid rows | §08
- [ ] **Add checklist** — insert `<h2 class="s">Checklist</h2>` + `.cht` table before HR Decision buttons. Steps: confirm new manager notified, verify access changes in scope, confirm effective date, confirm credit card authorization if applicable | §12, §21
- [ ] **HR Decision buttons** — replace `.status-btn-group` / `.status-btn` with `.dtog` / `.dt` full-width 2-col grid. Approve → `.dt.on-approve` "✓ Approve Change". Reject → `.dt` "✕ Reject" | §14
- [ ] **Context banner** — "Submitted by [name] on [date] · Workflow: [ID]" | §04
- [ ] **Action button label** — "Submit Decision" ✅ already correct | §15

---

#### `TerminationApproval.html` — Termination Approval
*Reference: AllScreens.html → "Termination Approval"*

- [ ] **G1–G8** Apply all global changes
- [ ] **Logo height** — fix to `60px` (currently `40px`) | §03
- [ ] **Form header** — replace plain `<h1>` + `<p class="subtitle">` with `.fhdr` block: `.bdg.b-pend` + `<h1>Termination Approval — [Employee Name]</h1>` + subtitle | §05
- [ ] **Info grid** — rename `.info-grid` / `.info-row` → `.ti` / `.ir` with vertical stacking | §07
- [ ] **Add checklist** — insert before HR Decision buttons. Steps: payroll notified, benefits processing initiated, access revocation date confirmed with IT, ROE initiated, exit interview scheduled | §12, §21
- [ ] **HR Decision buttons** — replace `.status-btn-group` with `.dtog` / `.dt` full-width grid. Approve → "✓ Approve Termination". Reject → "✕ Reject" | §14
- [ ] **Action button label** — "Process Approval" → "Submit Decision" | §15
- [ ] **Context banner** — "Submitted by [name] on [date] · Workflow: [ID]" | §04

---

#### `HRVerification.html` — HR Verification & ADP Setup
*Reference: AllScreens.html → "HR Verification & ADP Setup"*

- [ ] **G1–G8** Apply all global changes
- [ ] **Logo height** — fix to `60px` (currently `48px`) | §03
- [ ] **Form header** — add `.fhdr` block: `.bdg.b-open` "Open" + `<h1>HR Verification & ADP — [Employee Name]</h1>` + `<p>Assigned to: hr@team-group.com</p>` | §05
- [ ] **Info grid** — convert custom flex summary divs → `.ti` / `.ir` grid | §07
- [ ] **Input fields** — rename `.form-group` / `.grid` → `.ff` / `.fr`. `.read-only-box` for confirmed email → stay as `.fi` styled input | §08
- [ ] **Add checklist** — add `<h2 class="s">Checklist</h2>` + `.cht` table. Steps: employee created in ADP with correct start/classification, Google Workspace account created, employee in Google Directory, ADP number recorded | §12, §21
- [ ] **Action button label** — "Submit Verification" / "Update Verification" → "Confirm & Complete" | §15
- [ ] **Context banner** — "Workflow: [ID] · IT Setup is gated behind this step — complete before start date." | §04

---

### SPECIALIST FORMS — ONBOARDING

> All specialist forms use the same structure: `.fhdr` → Employee Details (`.ti`) → Checklist (`.cht`) → `.act1` "Mark Task Finalized"  
> See Standards §22 for full section order.

---

#### `ITSetup.html` — IT Setup
*Reference: AllScreens.html → "IT Setup"*

- [ ] **G1–G8** Apply all global changes
- [ ] **Remove** `.header` div with red bottom border — replace with standard `.logo-wrap` + `.pctx` + `.cf` layout | §03
- [ ] **Remove** `.context-card` / `.context-section` inside the card — replace with `.fhdr` + `.ti` info grid | §05, §07
- [ ] **Add form header** — `.fhdr`: `.bdg.b-open` "Open" + `<h1>IT Setup — [Employee Name]</h1>` + `<p>Assigned to: it@team-group.com</p>` | §05
- [ ] **Info grid** — convert `.context-grid` → `.ti` / `.ir`. Fields: Employee, Start Date, Job Title, JR Title, Email Assigned, Equipment | §07
- [ ] **CRITICAL — Replace Yes/No radio steps with checklist table** — current radio groups for "Google Account Created", "Computer Assigned", "Phone Assigned", "BOSS Access" etc. must be replaced with a `.cht` table. Each step gets Step name + hint, Status (Pending/Complete buttons), Notes column | §12
- [ ] **Action button label** — "Complete IT Setup" → "Mark Task Finalized" | §15
- [ ] **Context banner** — "Workflow: [ID] · Complete before employee start date." | §04

---

#### `SafetyOnboarding.html` — Safety Onboarding
*Reference: AllScreens.html → "Safety Onboarding"*

- [ ] **G1–G8** Apply all global changes
- [ ] **Logo height** — fix to `60px` (currently `40px`) | §03
- [ ] **Form header** — add `.fhdr`: `.bdg.b-open` + `<h1>Safety Onboarding — [Employee Name]</h1>` + assignee | §05
- [ ] **Info grid** — rename `.ticket-info` / `.info-row` → `.ti` / `.ir` | §07
- [ ] **Replace checklist** — remove `.confirm-item` checkbox card tiles for "SiteDocs Locations Assigned" and "DSS Learning Paths Assigned". Replace with `.cht` table rows: Add to SiteDocs, Assign site locations, Assign DSS learning path, Schedule safety orientation, Confirm SiteDocs login, Confirm DSS enrollment | §12
- [ ] **Action button label** — "Confirm & Complete" ✅ already correct | §15
- [ ] **Context banner** — "Workflow: [ID]" | §04

---

#### `Jonas.html` — Jonas Access Setup
*Reference: AllScreens.html → "Jonas Access Setup"*

- [ ] **G1–G8** Apply all global changes
- [ ] **Logo height** — fix to `60px` | §03
- [ ] **Form header** — add `.fhdr`: `.bdg.b-open` + `<h1>Jonas Access — [Employee Name]</h1>` + assignee | §05
- [ ] **Info grid** — rename `.ticket-info` / `.info-row` → `.ti` / `.ir`. Surface cost sheet job numbers from request data | §07
- [ ] **Add checklist table** — replace bare notes textarea with `.cht` steps: Create Jonas account, Assign each cost sheet job (one row per job from request data), Verify all cost sheets accessible, Notify manager | §12
- [ ] **Action button label** — "Confirm Complete" → "Mark Task Finalized" | §15
- [ ] **Remove auto-redirect** on success — show `.conf-screen` instead | §18
- [ ] **Context banner** — "Workflow: [ID]" | §04

---

#### `Fleetio.html` — Fleetio Setup
*Reference: AllScreens.html → "Fleetio Setup"*

- [ ] **G1–G8** Apply all global changes
- [ ] **Logo height** — fix to `60px` | §03
- [ ] **Form header** — add `.fhdr`: `.bdg.b-open` + `<h1>Fleetio Setup — [Employee Name]</h1>` + assignee | §05
- [ ] **Info grid** — rename `.ticket-info` / `.info-row` → `.ti` / `.ir` | §07
- [ ] **Add checklist table** — replace notes textarea with `.cht` steps: Create Fleetio driver account, Assign to site fleet group, Configure driver profile and verify license, Confirm account active and vehicles visible, Notify manager | §12
- [ ] **Action button label** — "Confirm Complete" → "Mark Task Finalized" | §15
- [ ] **Remove auto-redirect** — show `.conf-screen` instead | §18
- [ ] **Context banner** — "Workflow: [ID]" | §04

---

#### `BusinessCards.html` — Business Cards Order
*Reference: AllScreens.html → "Business Cards Order"*

- [ ] **G1–G8** Apply all global changes
- [ ] **Logo height** — fix to `60px` | §03
- [ ] **Form header** — add `.fhdr`: `.bdg.b-open` + `<h1>Business Cards — [Employee Name]</h1>` + assignee | §05
- [ ] **Info grid** — rename `.ticket-info` / `.info-row` → `.ti` / `.ir`. Fields: Employee, Job Title, Email, Phone, Site | §07
- [ ] **Add checklist table** — replace notes textarea with `.cht` steps: Confirm card details with employee/manager, Submit order to print vendor, Confirm order received and in production, Record estimated delivery date and notify manager | §12
- [ ] **Action button label** — "Confirm Complete" → "Mark Task Finalized" | §15
- [ ] **Remove auto-redirect** — show `.conf-screen` instead | §18
- [ ] **Context banner** — "Workflow: [ID]" | §04

---

#### `CreditCard.html` — Credit Card Application
*Reference: AllScreens.html → "Credit Card Application"*

- [ ] **G1–G8** Apply all global changes
- [ ] **Logo height** — fix to `60px` | §03
- [ ] **Form header** — add `.fhdr`: `.bdg.b-open` + `<h1>Credit Card — [Employee Name]</h1>` + assignee | §05
- [ ] **Info grid** — rename → `.ti` / `.ir`. Surface card type and credit limit from request data (these come from the position change credit card chain built in PositionChangeHandler.js) | §07
- [ ] **Add checklist table** — replace notes textarea with `.cht` steps: Confirm manager authorization for card and limit, Submit application to bank, Record application reference number, Set up online banking portal access, Confirm application in process and estimated delivery date, Notify employee and manager | §12
- [ ] **Action button label** — "Confirm Complete" → "Mark Task Finalized" | §15
- [ ] **Remove auto-redirect** — show `.conf-screen` instead | §18
- [ ] **Context banner** — "Workflow: [ID]" | §04

---

#### `CentralPurchasing.html` — Central Purchasing Access
*Reference: AllScreens.html → "Central Purchasing Access"*

- [ ] **G1–G8** Apply all global changes
- [ ] **Logo height** — fix to `60px` | §03
- [ ] **Form header** — add `.fhdr`: `.bdg.b-open` + `<h1>Central Purchasing — [Employee Name]</h1>` + assignee | §05
- [ ] **Info grid** — rename → `.ti` / `.ir`. Keep surfacing `purchasingSites` and `bossCostSheetJobs` (already done — good) | §07
- [ ] **Add checklist table** — replace text input + textarea with `.cht` steps: Create Central Purchasing account, then one row per purchasing site to assign (loop from request data), Verify account active and POs can be created, Notify manager | §12
- [ ] **Action button label** — "Confirm Complete" → "Mark Task Finalized" | §15
- [ ] **Remove auto-redirect** — show `.conf-screen` instead | §18
- [ ] **Context banner** — "Workflow: [ID]" | §04

---

#### `EmployeeIDSetup.html` — Employee ID & Building Access
*Reference: AllScreens.html → "Employee ID & Building Access"*

- [ ] **G1–G8** Apply all global changes
- [ ] **Logo height** — fix to `60px` (currently `max-height: 70px`) | §03
- [ ] **Form header** — add `.fhdr`: `.bdg.b-open` + `<h1>Employee ID Setup — [Employee Name]</h1>` + assignee | §05
- [ ] **Info grid** — rename `.info-box` / `.info-grid` / `.info-item` → `.ti` / `.ir`. `.label` / `.value` → `.l` / `.v` | §07
- [ ] **Input fields** — rename `.form-field` / `.form-row` → `.ff` / `.fr` | §08
- [ ] **Add checklist table** — current form has individual fields for IDs/passwords but no step tracker. Add `.cht` table: Coordinate photo, Order ID card from vendor, Program building access, Configure after-hours access if requested, Confirm access card activated and tested | §12
- [ ] **Action button label** — "Complete Employee ID Setup" → "Mark Task Finalized" | §15
- [ ] **Context banner** — "Workflow: [ID]" | §04

---

#### `SiteDocs.html` — SiteDocs Setup
*Reference: AllScreens.html → "SiteDocs Setup"*

- [ ] **G1–G8** Apply all global changes
- [ ] **Logo height** — fix to `60px` | §03
- [ ] **Form header** — add `.fhdr`: `.bdg.b-open` + `<h1>SiteDocs Setup — [Employee Name]</h1>` + assignee | §05
- [ ] **Info grid** — rename `.ticket-info` / `.info-row` → `.ti` / `.ir` | §07
- [ ] **Add checklist table** — replace notes textarea with `.cht` steps: Add employee to SiteDocs platform, Assign to required job site locations, Assign inspection templates for JR title, Confirm employee can log in, Confirm templates correct | §12
- [ ] **Action button label** — "Confirm Complete" → "Mark Task Finalized" | §15
- [ ] **Remove auto-redirect** — show `.conf-screen` instead | §18
- [ ] **Context banner** — "Workflow: [ID]" | §04

---

#### `Review306090.html` — 30/60/90 Day Review Setup
*Reference: AllScreens.html → "30/60/90 Day Review Setup"*

- [ ] **G1–G8** Apply all global changes
- [ ] **Logo height** — fix to `60px` | §03
- [ ] **Form header** — add `.fhdr`: `.bdg.b-open` + `<h1>30/60/90 Day Review Setup — [Employee Name]</h1>` + assignee | §05
- [ ] **Info grid** — rename `.ticket-info` / `.info-row` → `.ti` / `.ir`. Fields: Employee, Start Date, Job Title, Manager | §07
- [ ] **Input fields** — JR title select + document link input → rename to `.fi` / `.fl` / `.ff` | §08
- [ ] **Add checklist table** — add `<h2 class="s">Checklist</h2>` + `.cht` steps: 30-day check-in calendar invite sent, 60-day invite sent, 90-day invite sent, Review document shared with manager | §12
- [ ] **Action button label** — "Confirm Complete" → "Confirm & Complete" (minor fix) | §15
- [ ] **Remove auto-redirect** — show `.conf-screen` instead | §18
- [ ] **Context banner** — "Workflow: [ID] · Complete before or on start date." | §04

---

### SPECIALIST FORMS — OFFBOARDING

---

#### `AssetRetrieval.html` — Asset Retrieval
*Reference: AllScreens.html → "Asset Retrieval"*

- [ ] **G1–G8** Apply all global changes
- [ ] **CRITICAL — Fix max-width** — currently `max-width: 600px` which is far too narrow. The standard is `.cw` at `width:95%; max-width:1400px` | §03
- [ ] **Logo height** — fix to `60px` | §03
- [ ] **Form header** — add `.fhdr`: `.bdg.b-open` + `<h1>Asset Retrieval — [Employee Name]</h1>` + assignee | §05
- [ ] **Info grid** — rename `.info-grid` / `.info-row` → `.ti` / `.ir` | §07
- [ ] **CRITICAL — Replace checkbox items with 3-state checklist table** — current `.checkbox-item` cards must be replaced with the `.cht` table using **3-state buttons**: Pending / Collected / Not Returned (`.sbg` with `.sb.p`, `.sb`, `.sb`). One row per asset. Notes column on every row for serial numbers, condition notes, etc. | §12, §13
- [ ] **Action button label** — "Confirm Collection Receipt" → "Submit Collection Report" | §15
- [ ] **Context banner** — "Workflow: [ID] · Record collection status for each asset on or before last day." | §04

---

#### `SafetyTermination.html` — Safety Offboarding
*Reference: AllScreens.html → "Safety Offboarding"*

- [ ] **G1–G8** Apply all global changes
- [ ] **Logo height** — fix to `60px` | §03
- [ ] **Form header** — add `.fhdr`: `.bdg.b-open` + `<h1>Safety Offboarding — [Employee Name]</h1>` + assignee | §05
- [ ] **Info grid** — rename `.ticket-info` / `.info-row` → `.ti` / `.ir` | §07
- [ ] **Replace checklist** — remove `.confirm-item` checkbox card tiles for "SiteDocs Account Removed" and "BOSS WIS Module Deactivated". Replace with `.cht` table: Remove from all SiteDocs locations, Deactivate BOSS WIS access, Note outstanding safety incidents/certifications, Complete safety offboarding record, Confirm safety equipment returned | §12
- [ ] **Action button label** — "Confirm & Complete" ✅ already correct | §15
- [ ] **Remove auto-redirect** — show `.conf-screen` instead | §18
- [ ] **Context banner** — "Workflow: [ID] · Complete on or before last day." | §04

---

## Priority Order

Suggested order for implementation — most impactful / most used first:

| Priority | File | Key Reasons |
|----------|------|-------------|
| 🔴 1 | `ITSetup.html` | Most-used form; Yes/No radios replacing a full checklist is a significant UX gap |
| 🔴 2 | `AssetRetrieval.html` | 600px width is broken; checkbox items lose all per-item tracking; 3-state buttons critical |
| 🔴 3 | `StatusChangeApproval.html` | Missing logo entirely; HR Decision buttons are too small; no checklist |
| 🟡 4 | `InitialRequest.html` | Entry point for all new hires; CSS token mismatch affects everything downstream |
| 🟡 5 | `TerminationApproval.html` | Approval path; wrong decision buttons; missing checklist |
| 🟡 6 | `HRVerification.html` | Gating step; missing checklist unlocks IT Setup |
| 🟡 7 | `PositionSiteChangeRequest.html` | Active workflow; red h2 headers are visually inconsistent |
| 🟢 8 | `SafetyOnboarding.html` | Checkbox tiles → checklist table |
| 🟢 9 | `SafetyTermination.html` | Same as SafetyOnboarding |
| 🟢 10 | `TerminationRequest.html` | Request form — layout + tokens |
| 🟢 11–18 | Remaining specialist forms | Jonas, Fleetio, BusinessCards, CreditCard, CentralPurchasing, EmployeeIDSetup, SiteDocs, Review306090 — all same pattern, can batch |

---

## Quick Reference

| Standard § | Rule |
|-----------|------|
| §01 | Token names: `--red`, `--bg`, `--card`, `--text`, `--muted`, `--ibg`, `--ibdr`, `--bdr`, `--ok`, `--warn`, `--danger`, `--info` |
| §03 | Layout: `.sim` > `.cw` > `.logo-wrap` + `.pctx` + `.cf` |
| §04 | Context banner: `.pctx` (blue) or `.pctx.pctx-w` (yellow/warning) |
| §05 | Form header: `.fhdr` > `.bdg` + `<h1>[Form] — [Employee]</h1>` + `<p>assignee</p>` |
| §06 | Section headings: `<h2 class="s">` — white, 600 weight, bottom border, no uppercase |
| §07 | Info grid: `.ti` > `.ir` > `.l` (label) + `.v` (value). `.ir.s2` = span 2. `.ir.chg` = changed value (blue) |
| §08 | Inputs: `.ff` wrapper > `.fl` label > `.fi` input. Rows: `.fr` (auto) or `.fr2` (2-col) |
| §12 | Checklist: always `.cht` table, always 3 columns (Step / Status / Notes). NO plain lists or checkbox tiles for steps. |
| §13 | Status buttons: `.sbg` > `.sb` — `.sb.p` = Pending (amber), `.sb.c` = Complete (green), `.sb.n` = Not Returned (red) |
| §14 | HR Decision: `.dtog` 2-col grid > `.dt` — full width, `padding:16px 24px`, `font-size:15px`, bold |
| §15 | Buttons: `.acts` 2-col (request forms) or `.act1` full-width (approval/specialist). Labels per table in §15 |
| §18 | Confirmation: `.conf-screen` > `✅ .ci` + green `<h2>` + `<p>` + `.btn.btn-p.cb` "Return to Dashboard" + `.cx` close hint |
