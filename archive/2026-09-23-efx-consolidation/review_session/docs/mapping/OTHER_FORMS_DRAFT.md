# Other forms — field maps (DRAFT)

> **DRAFT / NOT VALIDATED FOR AUTOMATION.** Traced HTML → client payload → handler → sheet on 2026-09-16 at the level needed to make `FormContracts.js` accurate. No end-to-end run was performed. Line numbers are from the fork `employee_management_v2_efx`. Column indexes are `SchemaConstants.js` 0-based indexes.

Two naming worlds: the New Hire / HR / ID Setup forms build an explicit camelCase `data` object; the Termination and Status Change **request** forms post their raw HTML `name=` values (short names) and the handlers map them to columns. IT Setup posts `Snake_Case` names.

---

## 1. Termination request — `TerminationRequest.html` → `submitTerminationRequest` → `Terminations`

Route `?form=termination_request` (`Router.js:72-73`, no guard). Handler `TerminationHandler.js:32-118`. Contract `termination_request` (**verified:true** after this trace).

Client payload builder (`TerminationRequest.html:340-353`): `new FormData(form)`; each entry is copied by **HTML name**; repeated names (checkbox groups) are **comma-joined into one string** (`formData[key] = formData[key] ? formData[key] + ',' + value : value`); file input becomes `attachmentBase64`, `attachmentName`, `attachmentMimeType` (read via FileReader, :380+). Server-side there is **no `validateRequiredFields`**; the only checks are `managerEmail && !managerName` → reject (:66-68) and the workflow is created **before** any check (:35).

| Client `name=` | Payload key | Col / header | Type | HTML required | Handler (`TerminationHandler.js`) | Notes |
|---|---|---|---|---|---|---|
| — | `workflowId` | 0 Workflow ID | `TERM_…` | | `createWorkflow('TERM','End of Employment Request', reqEmail || Actor.email())` :35 | |
| — | `formId` | 1 Form ID | `TERM_REQ_…` | | :36 | |
| — | `timestamp` | 2 Timestamp | | | :40 | |
| `reqName` (:31) | `reqName` | 3 Requester Name | string | required readonly | :74 | auto-filled from session (:429) |
| `reqEmail` (:27) | `reqEmail` | 4 Requester Email | email | required readonly | :75; initiator :35 | |
| `empName` (:39) | `empName` | 5 Employee Name | string | required | :76; `Workflows.Employee Name` :107 | |
| — | — | 6 Employee ID | `'N/A'` literal | | :77 | legacy |
| `empType` (:82 `Hourly`, :84 `Salary`) | `empType` | 7 Employee Type | enum | required | :78 | used as `employmentType` in subjects |
| `empWorkEmail` (:54) | `empWorkEmail` | 8 Work Email | email, `pattern` company domains | `*` label, required toggled by `toggleSec` when Google Account checked | `|| 'N/A'` :79 | |
| `empPhone` (:238) | `empPhone` | 9 Phone | string | — | `|| 'N/A'` :80 | shown when equip `Mobile Phone` checked (`toggleEquipPhone` :323-332) |
| *(none)* | `empSerial` | 10 Computer Serial | | | `|| 'N/A'` :81 | **not collected by the form** — column kept for prod parity; always `N/A` |
| `siteName` (:75 select) | `siteName` | 11 Site | string (`refData.sites`) | required | :82 | |
| `termDate` (:94) | `termDate` | 12 Term Date | `yyyy-MM-dd` | required | :83 | subject "Termination Date:" |
| `reason` (:102 select: `Deceased, End of contract, Resigned, Retired, Terminated`) | `reason` | 13 Reason | enum | required | :84 | `Terminated` reveals `hr_approved` (`handleReasonChange` :309-321) |
| `managerName` (:69) | `managerName` | 14 Manager Name | string | required readonly | `|| 'N/A'` :85; must be present when managerEmail is (:66) | |
| `managerEmail` (:62) | `managerEmail` | 15 Manager Email | email, `pattern` 3 domains | required | `|| 'N/A'` :86 | |
| `hr_approved` (:116 `Yes`, :118 `No`) | `hr_approved` | 16 HR Approved Status | `Yes|No` | required only when reason `Terminated` | `|| 'N/A'` :87 | **col 16 is later overwritten by `syncStatusToRequestSheet`** with the workflow status (`WorkflowManager.js:461`) |
| `has_reports` (:126/:129) | `has_reports` | 17 Has Reports | `Yes|No` | required | `|| 'N/A'` :88 | drives IT/HR reassignment items at approval (:313-321, :334-338) |
| `reports_to_new` (:134) | `reports_to_new` | 18 Reassign Reports To | email/text | required when `has_reports=Yes` (toggleSec) | `|| 'N/A'` :89 | |
| `systems` (checkboxes :144-176: `ADP Supervisor Access, BOSS, CAA, Delivery, Google Account, Incidents, Fleetio, Central Purchasing/Jonas`) | `systems` (**CSV string**, comma-joined; handler also accepts array :44) | 19 Systems to Deactivate | csv | — | :90 | approval splits on `,` (:271) |
| `google_forward` (:186) | `google_forward` | 20 Email Forwarding | email | in `google_logic` section (required toggled) | `|| 'N/A'` :91 | shown when `Google Account` checked |
| `google_files` (:194) | `google_files` | 21 Drive Files Transfer | email | same | :92 | |
| `google_delegate` (:203) | `google_delegate` | 22 Inbox Delegate | email | same | :93 | |
| `google_duration` (:209 select: `Default 1 Month then delete`, `Longer (Specify in notes)`, `Delete Immediately (No forwarding/access)`) | `google_duration` | 23 Account Duration | enum | same | :94 | parsed to months for the `__CAL__` marker (:18-22, :300-302) |
| `google_vacation` (:219 textarea, default text with `[RECIPIENT]`) | `google_vacation` | 24 Vacation Responder Auto Reply | string | same | :95 | `[RECIPIENT]` substituted at approval (:337-343) |
| `equip` (checkboxes :229-253: `Computer/Laptop, Mobile Phone, Tablet, Credit Card, Vehicle and Keys, Building Access Card/Keys`) | `equip` (CSV string) | 25 Equipment to Return | csv | — | :96 | becomes the `Assets` checklist at approval (:420-424) |
| `comments` (:270) | `comments` | 26 Comments | string | — | `|| ''` :97 | |
| `lastDayWorked` (:98) | `lastDayWorked` | 27 Last Day Worked | date | required | `|| ''` :98 | |
| `attachment` (:262 file) | `attachmentBase64`, `attachmentName`, `attachmentMimeType` | 28 Attachment URL | Drive URL | — | uploaded to `CONFIG.TERM_FOLDER_ID` as `TERM_<empName>_<file>` :50-63 (failure logged, not fatal) | |

Row = 29 values (`SCHEMA.TERMINATIONS` 0-28). After the write: `updateWorkflow(wf,'In Progress','HR Approval Needed', empName)` :107, `syncWorkflowState`, emails via `_sendTerminationSubmitEmails` :125-169 — `HR Approval Required` → `CONFIG.EMAILS.HR` with `?form=termination_approval&wf=…`; `Termination Submitted — Pending HR Approval` → `CONFIG.EMAILS.PAYROLL`. Subject tag `[Termination | <empType>] … | <Site> | Termination Date: … | <reason> | <managerEmail>`. Response `{success, workflowId, message}` :113.

Gatekeeper-only names that are **not stored**: none (all posted names map to columns). Client-only toggles: `google_logic`, `hr_approval_sec`, `equip_phone_sec` (`toggleSec`, `handleReasonChange`, `toggleEquipPhone`).

Draft contract: `required = [reqName, reqEmail, empName, empType, siteName, termDate, lastDayWorked, reason, managerName, managerEmail, has_reports]` (HTML-required set; server enforces only manager pairing), `optional = [empWorkEmail, empPhone, hr_approved, reports_to_new, systems, google_forward, google_files, google_delegate, google_duration, google_vacation, equip, comments, attachmentBase64, attachmentName, attachmentMimeType]`.

---

## 2. Termination approval — `TerminationApproval.html` → `submitTerminationApproval` → `Termination Approval Results`

Route `?form=termination_approval&wf=…` (`Router.js:78-82`, guard HR or Payroll group). Handler `TerminationHandler.js:234-501`; **server access check** `isHR || isAdmin` via `AccessControlService.getUserRolePayload(Actor.email())` (:235-239) — an n8n actor email must be an HR-group member or in `CONFIG.ADMIN_EMAILS` (Payroll can open the page but cannot submit). Contract `termination_approval` (**verified:true**).

| Client `name=` | Payload key (`TerminationApproval.html:64-68`) | Col / header (`SCHEMA.TERMINATION_APPROVAL_RESULTS`) | Handler |
|---|---|---|---|
| `workflowId` (hidden :26) | `workflowId` | 0 | destructured :242 |
| `decision` (hidden :30, default `Approved`, set by buttons `setDecision`) | `decision` | 3 Decision (`Approved|Rejected`) | :242, branch :265/:469 |
| `notes` (:39) | `notes` | 4 Notes | :242 |
| — | — | 1 Form ID `TERM_APP_…`, 2 Timestamp, 5 Follow-up Required = literal `'YES'`, 6 Submitted By = `Actor.email()` | :258-260 |

Duplicate guard: any existing row for the workflow → `{success:true, message:'Approval already processed for this workflow.'}` inside a `LockService` block (:249-256). Approved → action items (see `ACTION_ITEMS.md` §2), workflow `Action Items Pending`, emails `IT/HR/Payroll/Fleet/Purchasing Action Required`, `Employee Deactivation Required`, `EOE Process Required`, `FYI — Employee Offboarding` (Safety), `Asset Collection Required` or `Termination Approved` (requester+manager), `Termination Approved` (Payroll). Rejected → `Rejected`/`Rejected by HR`, `Termination Rejected` to requester+manager. Response `{success:true, message:'End of employment approved. N checklists generated.'}`.

Contract fix: `followupRequired` removed (never read; column is a literal).

---

## 3. Position / Status Change request — `PositionSiteChangeRequest.html` → `submitPositionChangeRequest` → `Position Changes`

Route `?form=position_site_change` (`Router.js:75-76`). Handler `PositionChangeHandler.js:16-157`. Contract `position_change_request` (**verified:true** for keys; see caveats).

Client payload builder (:601-620): text/select/textarea inputs → `formData[name] = value`; **every checkbox group → array** (even single checkboxes: `adpSalaryAccess`, `creditCardUSA/Canada/HomeDepot` become `['Yes']` or `[]`); checked radios → string. File → `attachmentBase64/Name/MimeType`, `attachment` key deleted (:679-700). Dual-lists (`SharedComponents.buildDualList`) are hidden text inputs → CSV strings: `adpSites`, `purchasingSites`, `bossComm`, `bossCostJobs`, `jonasJobs` (:726-746). Server: no `validateRequiredFields`; checks manager name/email pairing for `currentManagerEmail`, `mgrNewEmail`, `mgrOldEmail` (:27-35) **after** `createWorkflow` (:19).

| Client `name=` | Payload key | Col / header (`SCHEMA.POSITION_CHANGES`) | HTML required | Handler line | Notes |
|---|---|---|---|---|---|
| `reqName` (:30) | `reqName` | 3 Requester Name | readonly | :76 | |
| `reqEmail` (:26) | `reqEmail` | 4 Requester Email | readonly | :77; initiator `reqEmail || Actor.email()` :19 | |
| `reqDate` (:34, default today) | `reqDate` | 28 Date Requested | — | :104 | |
| `firstName` (:42) / `lastName` (:46) | same | 29 / 30; joined into 5 Employee Name | required | :78, :105-106 | |
| `currentClass` (:53/:54 `Hourly|Salary`) | `currentClass` | 27 Current Class | required | :102 | `employmentType` in emails |
| `currentTitle` (:59) | `currentTitle` | 24 Current Title | — | :99 | |
| `currentManagerEmail` (:66) / `currentManagerName` (:73 readonly) | same | 25 / 26 | — | :100-101; pairing check :27 | |
| `effDate` (:79) | `effDate` | 7 Effective Date | required | :80 | subject "Effective Date:" |
| `siteName` (:83 select) | `siteName` | 8 Current Site | required | :81 | |
| `changeType` (checkboxes :91-97: `Site Transfer`, `Position Change`, `Classification`, `Manager Change`) | `changeType` (array) | 9 Change Types (csv) | — | `csv()` :59 | approval checks `includes('Site Transfer')` / `'Reporting Manager Change'` (:417,:426 — the second value **never matches** the checkbox value `Manager Change`) |
| `siteOld` / `siteNew` (:106/:107 selects) | same | 10 Site Transfer `old -> new` | — | :83 | shown for Site Transfer |
| `department` (:111) | `department` | 21 Department | — | :96 | |
| `receivingManagerEmail` (:116) | `receivingManagerEmail` | 23 Receiving Manager Email | — | :98 | |
| `titleOld` / `titleNew` (:125/:126) | same | 11 Title Change `old -> new` | — | :84 | |
| `classOld` / `classNew` (:135/:139 radios) | same | 12 Classification `old -> new` | — | :85 | |
| `mgrOldEmail` / `mgrOldName` / `mgrNewEmail` / `mgrNewName` (:149-160) | same | 13 Manager Change `Name (email) -> Name (email)` | — | :86-87; pairing :30-35 | `getPositionChangeData` regex-parses emails back out (:223-226) |
| `hadReports` (:168/:169) | `hadReports` | **not stored** | required | — | gatekeeper for `oldReportsTo` |
| `oldReportsTo` (:173) | `oldReportsTo` | 14 Reassign Old Reports | when hadReports Yes | :88 | |
| `gainingReports` (:182/:183) | `gainingReports` | **not stored** | required | — | gatekeeper |
| `newReportsFrom` (:187) | `newReportsFrom` | 15 Gain New Reports | when gainingReports Yes | :89 | |
| `hasGoogle` (:197/:198) | `hasGoogle` | **not stored** | required | — | gatekeeper |
| `existingEmail` (:202) | `existingEmail` | 16 Google Account `existing -> new@domain` | — | :90-91 | |
| `sys` (checkboxes :216-298: `ADP Supervisor Access, BOSS, CAA, Delivery, DSS, Fleetio, Google Account, Incidents, Central Purchasing/Jonas, Net Promoter Score, SiteDocs`) | `sys` (array) | 17 Systems Added (csv) | — | :60 | note value `SiteDocs` (not `SiteDocs Supervisor`) |
| `adpSalaryAccess` (:221 checkbox `Yes`) | `adpSalaryAccess` (**array** `['Yes']`/`[]`) | 38 ADP Salary Access | — | `|| ''` :114 — array written to the cell | ⚠ see caveat A |
| `adpSites` (dual-list hidden) | `adpSites` (CSV string) | 37 ADP Sites | — | `csv()` :65 | |
| `bossTrainingOnly` (:240/:241) | `bossTrainingOnly` | 31 BOSS Training User Only | — | :107 | |
| `bossComm` (dual-list) | `bossComm` (CSV) | 32 BOSS Sites | — | :66 | |
| `bossCost` (:253/:254) | `bossCost` | 33 BOSS Cost Sheet | — | :109 | |
| `bossCostJobs` (dual-list) | `bossCostJobs` (CSV) | 34 BOSS Cost Jobs | — | :67 | |
| `bossTrip` (:266/:267) | `bossTrip` | 35 BOSS Trip | — | :111 | |
| `bossGriev` (:273/:274) | `bossGriev` | 36 BOSS Grievances | — | :112 | |
| `googleEmail` (:305) / `googleDomain` (:306) | same | folded into 16 | — | :91 | |
| `jrReq` (:319) | `jrReq` | 39 JR Required | — | :115 | |
| `plan306090` (:323) | `plan306090` | 41 30/60/90 | — | :117 | **no consumer** — CHANGE_ approval never creates 30/60/90 or JR items |
| `jrTitle` (:328 select) | `jrTitle` | 40 JR Assignment | — | :116 | |
| `equip` (checkboxes :339-465: `Business Cards, Computer, Credit Card, Mobile Phone, SiteDocs Tablet, Vehicle`) | `equip` (array) | 18 Equipment (csv) | — | :61 | |
| `computerRequestType` (:351/:352) | same | 42 | — | :118 | |
| `computerType` (:359-361) | same | 43 | — | :119 | |
| `office365Required` (:371/:372) | same | 47 Office 365 | — | :123 | |
| `computerPreviousUser` (:381) / `computerPreviousType` (:385) / `computerSerialNumber` (:394) | same | 44 / 45 / 46 | — | :120-122 | |
| `creditCardUSA` (:411 checkbox) / `creditCardLimitUSA` (:414) | `creditCardUSA` (**array**) / string | 48 / 49 | — | :124-125 | ⚠ caveat A |
| `creditCardCanada` (:419) / `creditCardLimitCanada` (:422) | array / string | 50 / 51 | — | :126-127 | ⚠ |
| `creditCardHomeDepot` (:427) / `creditCardLimitHomeDepot` (:430) | array / string | 52 / 53 | — | :128-129 | ⚠ |
| `phoneRequestType` (:446/:447) / `phonePreviousUser` (:454) / `phonePreviousNumber` (:458) | same | 54 / 55 / 56 | — | :130-132 | |
| `purchasingSites` (dual-list) | CSV | 22 Purchasing Sites | — | :64 | |
| `jonasJobs` (dual-list) | CSV | 57 Jonas Job Numbers | — | :68, :133 | |
| `equipRem` (checkboxes :472-476: `Computer, Mobile Phone, SiteDocs Tablet, Vehicle, Credit Card`) | `equipRem` (array) | 58 Equipment Return (csv) | — | :63 | |
| `rem` (checkboxes :484-490: `ADP, BOSS, CAA, Delivery, Fleetio, Google Account, SiteDocs`) | `rem` (array) | 19 Removed Access (csv) | — | :62 | |
| `comments` (:495) | `comments` | 20 Comments | — | :95 | |
| `attachment` (:496) | `attachmentBase64/Name/MimeType` | 60 Attachment URL | — | :39-52 (`CONFIG.CHANGE_FOLDER_ID`) | |
| — | — | 0 Workflow ID `CHANGE_…`, 1 Form ID `POS_CHANGE_…`, 2 Timestamp, 6 Employee ID `'N/A'`, 59 Status `'In Progress'` | | :19-24, :79, :135 | |

61 columns (0-60). After write: `updateWorkflow(wf,'In Progress','HR Approval Needed', First Last)` :142; `_sendPositionChangeSubmitEmails` :160+ (HR approval link `?form=position_change_approval&wf=…`, Payroll notice, current manager). Response `{success, workflowId, message}` :150.

**Caveat A (possible bug):** because the client turns every checkbox into an array, `adpSalaryAccess`, `creditCardUSA`, `creditCardCanada`, `creditCardHomeDepot` arrive as `['Yes']` / `[]`; the handler writes them with `|| ''` (an empty array is truthy) so the cell receives an Array. Sheets coerces via `toString()` → `"Yes"` or `""`, which happens to match the `=== 'Yes'` checks at approval (:583-585), but it is fragile and the `[]` case stores `""` rather than `No`. n8n should send plain `'Yes'`/`''` strings. **Caveat B:** approval tests `changes.includes('Reporting Manager Change')` (:426) while the checkbox value is `Manager Change` → the new-manager routing branch is unreachable; `mgrNewEmail` falls back to the old manager unless `confirmedNewManager`/`receivingManagerEmail` is set.

Draft contract: `required = [firstName, lastName, currentClass, effDate, siteName]` (HTML-required and stored), optional = every other key above incl. the three gatekeepers (`hadReports, gainingReports, hasGoogle`) so a UI-shaped payload validates.

---

## 4. Position change approval — `StatusChangeApproval.html` → `submitPositionChangeApproval` → `Position Change Approval Result`

Route `?form=position_change_approval&wf=…` (`Router.js:84-88`, HR or Payroll). Handler `PositionChangeHandler.js:375-1009`; server check `isHR || isAdmin` (:376-380). Contract `position_change_approval` (**verified:true**).

| Client `name=` (`StatusChangeApproval.html`) | Payload key (:110-117) | Col (`SCHEMA.POSITION_CHANGE_APPROVAL`) | Handler |
|---|---|---|---|
| `workflowId` (hidden :22) | `workflowId` | 0 | :383 |
| `confirmedNewManager` (:28 email) | `confirmedNewManager` | 6 Confirmed New Manager | :400; drives receiving manager (:418-420) |
| `confirmedTitle` (:36) | `confirmedTitle` | 5 Confirmed Title | :400; `effectiveTitle` (:433) |
| `confirmedJrTitle` (:47 select from `getJRsList`) | `confirmedJrTitle` | **not stored** | context only (:543) |
| `decision` (hidden :55, `Approved|Rejected`) | `decision` | 3 | :383 |
| `notes` (:64) | `notes` | 4 | |
| — | — | 1 Form ID `CHG_APP_…`, 2 Timestamp, 7 Submitted By `Actor.email()` | :398-401 |

Duplicate guard as Termination (:390-396). Approved → items in `ACTION_ITEMS.md` §2 (Status Change), workflow `Action Items Pending` (:920), `Status Change Approved` to requester + new manager. Rejected → `Rejected`/`Rejected by HR`, `Status Change Rejected`. Contract fix: `confirmedJrTitle` added.

---

## 5. HR Verification — `HRVerification.html` → `submitHRVerification` → `HR Verification Results`

Route `?form=hr_verification&wf=…` (`Router.js:56-59`, HR group). Handler `HRVerificationHandler.js:93-350`; **server check `isHR || isAdmin`** (:94-98). Contract `hr_verification` (**verified:true** — keys corrected; the old contract listed sheet-column names).

Client payload (:201-215) is an explicit object: `workflowId, formId, hireDate, firstName, lastName, managerName, managerEmail, jobTitle, jrTitle, siteName, department, adpAssociateId, notes`. The hidden `internalEmployeeId` input (:34, value `PENDING` when unset) is **not posted**.

| Client `name=` | Payload key | HTML required | Handler → where written |
|---|---|---|---|
| `workflowId` (:32) | `workflowId` | — | :101 |
| `formId` (:33) | `formId` | — | ignored; `generateFormId('HR_VERIF')` :102 |
| `siteName` (:56 select `getSitesList`) | `siteName` | — | → `Initial Requests` col 15 :160 |
| `hireDate` (:62) | `hireDate` | — | → `Initial Requests` col 6 (`new Date(hireDate+'T12:00:00')`) :159; change flagged in notes `[START DATE CHANGED: a → b]` :192-196 |
| `department` (:67) | `department` | — | → col 50 :163 |
| `firstName` (:77) / `lastName` (:81) | same | required | → cols 10/12 :155-156; `Verified Name` = `first + ' ' + last` (col 4) :200 |
| `managerName` (:87) / `managerEmail` (:91) | same | required | → cols 18/17 :157-158; HR results cols 5/6 |
| `jobTitle` (:96) | `jobTitle` | required | → col 14 :161; HR results col 7 as `"jobTitle / jrTitle"` or `jobTitle` :202 |
| `jrTitle` (:101 select when `jrRequired==='Yes'`, else hidden `''` :106) | `jrTitle` | required when rendered | → col 46 :162; folded into col 7 |
| `adpAssociateId` (:115) | `adpAssociateId` | required | HR results col 3 :199 |
| `notes` (:119) | `notes` | — | col 8 :203 (prefixed with date-change flag) |
| — | | | col 0 wf, 1 Form ID, 2 Timestamp, 9 Submitted By `Actor.email()` |

Update vs insert: an existing non-`DATE_CHANGE` row for the workflow is **overwritten in place** with `logFormEdit`, and **no** downstream emails/transitions fire (:206-216). First submission: append → flush → `getWorkflowContext` overridden with the submitted title/JR/ADP (:227-232) → change detection `sendChangeNotifications` vs the original request (`ChangeNotify.js`) → routing:
- `Hourly && systemAccess==='No'`: workflow `Complete`/`HR Verification Complete`; email `Onboarding Complete` to requester+manager with passwords (:262-279).
- else if `Systems` contains `BOSS`: `IT Confirmation Needed`, action item `IT Confirmation`, email `IT Confirmation Required — <Name>` → `CONFIG.EMAILS.IT_CONFIRMATION` (:284-297).
- else: `IT Setup Needed`, email `IT Setup Required` → `CONFIG.EMAILS.IT` (:298-314).
- both non-hourly paths: Payroll `HR Verified[ — Salary Access Required]` (:317-327) and **Safety onboarding item** (:330-338).
Response `{success:true, message:'HR Verification and ADP ID setup completed successfully.'}`.

Draft contract: `required = [workflowId, firstName, lastName, managerName, managerEmail, jobTitle, adpAssociateId]`, `optional = [formId, hireDate, jrTitle, siteName, department, notes]`. Sending `department: undefined` skips the column write (:163); sending `''` blanks it.

---

## 6. IT Setup — `ITSetup.html` → `submitITSetup` → `IT Results`

Route `?form=it_setup&wf=…` (`Router.js:61-64`, IT group). Handler `ITSetupHandler.js:206-407`; **server check `isIT || isAdmin`** (:207-211). Contract `it_setup` (**verified:true** — keys corrected).

Client payload (:370-385): `FormData` → object; repeated keys joined with `,`; `Incidents_Access, CAA_Access, Delivery_App_Access, Net_Promoter_Score_Access` default to `'No'` when unchecked (:381-384). Dynamic keys `BOSS_Cmte_<key>` / `BOSS_CostSheet_<key>` (:213/:223, value `Confirmed`) are generated per requested committee/job.

| Client `name=` | Col / header (`SCHEMA.IT_RESULTS`) | HTML required | Handler |
|---|---|---|---|
| `workflowId` (hidden :31) | 0 | — | `formData.workflowId || formData.requestId` :214 |
| `formId` (:32), `Employee_Name` (:33) | — | — | ignored (formId regenerated `IT_SETUP_…`) |
| `Email_Created` (:56/:60 `Yes|No`) | 3 Email Created | required | :277 |
| `Email_Username` (:69) + `Email_Domain` (:74 select `@team-group.com|@robinsonsolutions.com|@industrialappliedtech.com`) | 4 Assigned Email = `username + domain` **only when `Email_Created==='Yes'`**, else `''` | required (always, even when `Email_Created=No` — `required` attribute is static) | :256-258 |
| `Email_Temp_Password` (:85) | 5 Email Password | required | `|| 'N/A'` :279 |
| `Computer_Assigned` (:106/:110) | 6 | required | :280 |
| `Computer_Serial` (:119) / `Computer_Model` (:123) / `Computer_Type` (:127 select) | 7 / 8 / 9 | — | `|| 'N/A'` :281-283 |
| `Phone_Assigned` (:153/:157) | 10 | required | :284 |
| `Phone_Carrier` (:166) / `Phone_Model` (:170) / `Phone_Number` (:174) / `Phone_VM_Password` (:180) | 11-14 | — | `|| 'N/A'` :285-288 |
| `BOSS_Access` (:192/:196) | 15 | required | :289 |
| `BOSS_Cmte_<key>*`, `BOSS_CostSheet_<key>*` (`Confirmed`), `BOSS_TripReports` (:233), `BOSS_Grievances` (:243) | 22 BOSS Details JSON `{committees[], costSheets[], tripReports:'Yes'|'', grievances:'Yes'|''}` | — | :261-271, :296 |
| `Incidents_Access` (:255), `CAA_Access` (:262), `Delivery_App_Access` (:269), `Net_Promoter_Score_Access` (:276) (`Yes`, default `No`) | 16 / 17 / 18 / 19 | — | :290-293 |
| `IT_Notes` (:289) | 20 | — | `|| ''` :294 |
| — | 1 Form ID, 2 Timestamp, 21 Submitted By `Actor.email()` | | |

Insert vs update: existing `IT Results` row for the workflow → overwritten in place + `logFormEdit`, **no** specialists/step change (:301-309). Insert, non-`CHANGE_`: `updateWorkflow(wf,'In Progress','Specialist Forms Needed')` → `triggerSpecialists` (`ACTION_ITEMS.md` §2). Insert, `CHANGE_`: finds the Open `Category='IT'` item and `closeActionItem(tid,'IT Setup submitted via form', actor, null, formData+bossDetails)` (:344-359) → special case 1 appends a **second** `IT Results` row. Always: `IT Setup Complete` email to requester + manager with `showPasswords:true` (:364-396). Response `{success:true, message:'IT Setup results saved successfully…'}`.

Contract fixes: `Email_Password` → `Email_Temp_Password`; `Net_Promoter_Access` → `Net_Promoter_Score_Access`; `bossDetails` removed from the payload keys (server-derived); `requestId` alias, `formId`, `Employee_Name`, `BOSS_TripReports`, `BOSS_Grievances` added; `dynamicPrefixes: ['BOSS_Cmte_','BOSS_CostSheet_']` added and honoured by `FormContracts.validate`.

---

## 7. IT Confirmation — `InitialRequest.html` / `PositionSiteChangeRequest.html` (mode `it_confirmation`) → `submitITConfirmation` → `IT Confirmation Results`

Route `?form=it_confirmation&wf=…` (`Router.js:90-94`, BUSINESS_CARDS person or IT group) → `serveITConfirmation` (`ITConfirmationHandler.js:12-40`): CHANGE_ → `PositionSiteChangeRequest.html` prefilled from `getFullPositionChangeData`; else `InitialRequest.html` (`baseMode` `equipment` for EQUIP_) prefilled from `getFullNewHireData` via `prefillITConfirmation` (`InitialRequest.html:693-822`). Contract `it_confirmation` stays **verified:false**: the function is defined twice (`ITConfirmationHandler.js:44` and `BOSSReviewHandler.js:181`); in GAS the last-loaded definition wins and load order is not guaranteed by filename. The two bodies differ only in the equipment `origData` source and the `googleEmail/googleDomain/computerReq/computerType/phoneReq` fallbacks (`ITConfirmationHandler.js:85-89` keeps the original when the field is blank; the `BOSSReviewHandler` copy blanks it).

Payload (New Hire / Equipment): the full New Hire `data` object (all keys in `INITIAL_REQUEST.md` §1) plus `workflowId` and `notes` (`InitialRequest.html:1326-1328`). Payload (CHANGE_): the raw Status Change names plus `workflowId`, `notes` (`PositionSiteChangeRequest.html:630-632`).

Handler writes (NH/EQ, `ITConfirmationHandler.js:66-103`) back into `Initial Requests` cols 7-23, 24-25, 36, 39-44, 49-51 from `hireType` (**bug — client key is `newHireOrRehire`**, so col 7 is blanked), `employeeType, employmentType, firstName, middleName, lastName, preferredName, positionTitle, siteName, jobSiteNumber, reportingManagerEmail||managerEmail, reportingManagerName||managerName, systemAccess, systems, equipment, googleEmail, googleDomain, computerRequestType, computerType, phoneRequestType, bossJobSites, bossCostSheet, bossCostSheetJobs, bossTripReports, bossGrievances, jonasJobNumbers, adpSites, department, purchasingSites`. Not written back: `hireDate`, `office365Required`, computer previous-user fields, credit card fields, phone previous fields, `jrRequired/jrAssignment/plan306090`, `comments`, `adpSalaryAccess`, `bossTrainingOnly`. CHANGE_ write-back (:104-133): `siteNew, titleNew, classNew` (new side only), `sys, equip, rem, comments, department, purchasingSites`.

Audit row (`IT Confirmation Results`, 13 cols, `SCHEMA.IT_CONFIRMATION_RESULTS`): `wf, IT_CONF_…, now, bossJobSites, bossCostSheet, bossCostSheetJobs, bossTripReports, bossGrievances, computerRequestType, computerType, phoneRequestType, notes, Actor.email()` (:147-159). Then change detection (`diffFormFields` + `sendChangeNotifications`), `updateWorkflow(wf,'In Progress','IT Setup Needed')` (:246), email `IT Setup Required — <Name>` → `CONFIG.EMAILS.IT` with `?form=it_setup&wf=…`. Does **not** close the `IT Confirmation` action item. Response `{success:true, scriptUrl}`. Server access check: none (route guard only).

Contract: `required=[workflowId]`, optional = all New Hire keys + `hireType`, `notes`, `managerEmail`, `managerName`, `position` + CHANGE_ keys (`siteNew, titleNew, classNew, sys, equip, rem`).

---

## 8. Equipment request

Covered in `INITIAL_REQUEST.md` §7. Contract `equipment_request` now **verified:true**: `required = [firstName, lastName, siteName, managerEmail, managerName, position]` (`EquipmentRequestHandler.js:49`), optional = `reqName, reqEmail, requesterName, requesterEmail, positionTitle, reportingManagerEmail, reportingManagerName, dateRequested` + every New Hire optional key + the disabled New Hire-only keys (`hireDate, newHireOrRehire, employeeType, employmentType, jobSiteNumber, systemAccess, jrRequired, jrAssignment, plan306090`, posted as `null` by the UI).

---

## 9. Specialist legacy forms (`?form=specialist&dept=…`)

`Specialist.js:6-56` maps `dept` → `CreditCard | BusinessCards | Fleetio | Jonas | SiteDocs | Review306090 | SafetyOnboarding | SafetyTermination | WIS` HTML files; all post `{ workflowId, department, details: JSON string, notes }` (+ `jrTitle` for review) to `submitSpecialistForm` (:58-220), which writes to `Specialist Results` for every dept (sheet map dead, :69-80), back-writes `jrTitle` for `review` (:117-139) and emails `<Dept> Setup Complete` to requester/manager except for safety/safetyterm. It never closes action items. Contract `specialist`: keys fixed to `workflowId, department` (+ `formId, details, notes, jrTitle`), `verified:false` retained with the dead-map note; prefer `n8n_closeTask`.
