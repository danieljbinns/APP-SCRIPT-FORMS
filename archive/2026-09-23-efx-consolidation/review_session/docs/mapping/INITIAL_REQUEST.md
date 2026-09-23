# New Hire form — `InitialRequest.html` → `submitInitialRequest` → `Initial Requests`

Source of truth (fork `employee_management_v2_efx`, read 2026-09-16):

| Layer | File / symbol |
|---|---|
| Client | `InitialRequest.html` (form body :60-596, submit handler :1147-1339) |
| Server | `InitialRequestHandler.js` → `submitInitialRequest(formData)` :17-129, `formatInitialRequestData(data)` :174-233 |
| Schema | `SchemaConstants.js` → `SCHEMA.INITIAL_REQUESTS` :57-114 (56 columns, 0-based) |
| Contract | `FormContracts.js` → `new_hire` (verified:true) |
| n8n alias | `N8n.js` → `n8n_createInitialRequest(actor, data, include)` :129-132 |

The same HTML file is served in three modes (`InitialRequestHandler.js:8-9`, `EquipmentRequestHandler.js:22-23`, `ITConfirmationHandler.js:31-32`): `new_hire`, `equipment` and `it_confirmation`. This document covers `new_hire`; `equipment` is in §7; `it_confirmation` is in `OTHER_FORMS_DRAFT.md`.

---

## 1. Field-by-field map (56 sheet columns)

Legend: **Client name** = `name=` attribute in `InitialRequest.html`; **Payload key** = key in the `data` object built at `InitialRequest.html:1155-1207`; **Col** = `SCHEMA.INITIAL_REQUESTS` index (0-based) / header string from the comment in `SchemaConstants.js`; **CSV** = client-side validation; **SSV** = server-side validation (`validateRequiredFields`, `ValidationUtils.js:210-236`); **Vis.** = conditional visibility; **Consumers** = who reads the column later.

Server-side required list (`InitialRequestHandler.js:22-27`): `firstName, lastName, hireDate, requesterEmail, reportingManagerName, reportingManagerEmail, positionTitle, siteName, jobSiteNumber, employmentType, employeeType, newHireOrRehire, systemAccess`. `validateRequiredFields` also rejects **any** string field in the payload whose first character is `=`, `+`, `-` or `@` (formula-injection guard, `ValidationUtils.js:221-227`) — this applies to every key, not only the required ones (a comment starting with "-" fails the whole submit).

### 1.1 Server-generated columns

| Col | Header | Payload key | Set by | Notes |
|---|---|---|---|---|
| 0 | Workflow ID | `workflowId` | `createWorkflow('NEW_EMP', …)` `WorkflowManager.js:349-405`, assigned `InitialRequestHandler.js:46` | `NEW_EMP_yyyyMMdd-HHmmss_NNN` (America/New_York). 30-second idempotency guard on same type+initiator (`WorkflowManager.js:371-384`). |
| 1 | Form ID | `formId` | `generateFormId('INIT_REQ')` :35 | `INIT_REQ_yyyyMMdd-HHmmss_NNN` |
| 2 | Timestamp | `timestamp` | `new Date()` :49 | datetime |
| 52 | Status | — | `''` at insert (:228); later written by `updateWorkflow → syncStatusToRequestSheet` (`WorkflowManager.js:451-485`) | mirrors Workflows.Status |
| 55 | Internal Employee ID | `internalEmployeeId` | `EmployeeIdRegistry.allocate(workflowId, …)` :39-43, assigned :48 | **EFX new.** Numeric ≥ 30000. Also written to sheet `Employee IDs` (`EmployeeIdRegistry.js:19-20`). `existingInternalEmployeeId` (payload, optional, not in HTML) short-circuits allocation as a rehire carry (`EmployeeIdRegistry.js:81-84`). |

### 1.2 Requester section (`InitialRequest.html:66-91`)

| Client `name=` | Payload key | Col / Header | Type | Req? | CSV | SSV | Vis. | Consumers |
|---|---|---|---|---|---|---|---|---|
| `dateRequested` (:73) | `dateRequested` | 3 / Date Requested | date `yyyy-MM-dd` | HTML `required readonly` | set to today at :893 (`valueAsDate`) | none (not in required list) | always | `Dashboard_View.DATE_REQUESTED` via `StateSync`; `getFullNewHireData` (`ReferenceDataService.js:265`) |
| `requesterEmail` (:80) | `requesterEmail` | 5 / Requester Email | email | HTML `required readonly`; **server required** | auto-filled from `getCurrentUserDetails()` :657-666 | required | always | `createWorkflow` initiator (:34); `Workflows.INITIATOR_EMAIL`; `sendInitialRequestEmails` "Request Submitted" recipient (`EmailUtils.js:687-694`); `getWorkflowContext` (`EmailUtils.js`, header 'Requester Email'); IDSetup credentials email (`IDSetup.js:271`); IT Setup completion email (`ITSetupHandler.js:374`); HR completion (`HRVerificationHandler.js:167,265`) |
| `requesterName` (:86) | `requesterName` | 4 / Requester Name | string | HTML `required readonly` | auto-filled :661 | none | always | `Dashboard_View.REQUESTER_NAME`; `getFullNewHireData` |

### 1.3 Employee information (`InitialRequest.html:96-233`)

| Client `name=` | Payload key | Col / Header | Type | Req? | CSV | SSV | Vis. | Consumers |
|---|---|---|---|---|---|---|---|---|
| `hireDate` (:101) | `hireDate` | 6 / Hire Date | date `yyyy-MM-dd` | required | HTML5 date; `checkHireDate()` :969-1002 shows a **warning only** when < 3 business days (no block) | required (presence only; `validateHireDate` in `ValidationUtils.js:136` is **not** called) | always (`.new-hire-only`) | every email subject (`buildEmailSubject` "Start Date:", `EmailUtils.js:44-52`); `getIDSetupRequestData` (`IDSetup.js:66,77`); HR Verification pre-fill + overwrite (`HRVerificationHandler.js:137-140,159`); calendar link (`IDSetup.js:230-249`); `Dashboard_View.HIRE_DATE` |
| `hireType` (:111 `New Hire`, :115 `Rehire`) | **`newHireOrRehire`** (renamed :1163) | 7 / New Hire/Rehire | enum `New Hire|Rehire` | required (radio) | HTML5 | required | always | `getIDSetupRequestData` (header 'New Hire/Rehire'); `getWorkflowContext`; email context block; **IT Confirmation write-back reads `formData.hireType` (`ITConfirmationHandler.js:70`) — see §8 bug** |
| `employeeType` (:125 `Direct Hire`, :129 `Agency`) | `employeeType` | 8 / Employee Type | enum | required | HTML5 | required | always | `getWorkflowContext`, email context, `rawLogResult` payload |
| `employmentType` (:139 `Hourly`, :144 `Salary`) | `employmentType` | 9 / Employment Type | enum `Hourly|Salary` | required | HTML5; choosing `Salary` auto-checks `systemAccess=Yes` and opens the System Access section (`handleEmploymentTypeChange` :953-966) | required | always | **routing key**: `IDSetup.js:256,265` (Hourly+No ⇒ credentials email + skip IT), `HRVerificationHandler.js:165,262`, `buildEmailSubject` tag `[New Hire | Hourly]` + `EXPEDITE` flag when Hourly with system access (`EmailUtils.js:29`); `getRequestDetails` marks IT Setup N/A for Hourly+No (`RequestDetailsHandler.js:126-131`) |
| `firstName` (:154) | `firstName` | 10 / First Name | string | required | HTML5 | required | always | `employeeName` everywhere (:66); `EmployeeIdRegistry` Employee Name; auto-builds `googleEmailLocal` (:896-915); HR Verification overwrites col 10 (`HRVerificationHandler.js:155`) |
| `middleName` (:159) | `middleName` | 11 / Middle Name | string | optional | — | formula-char guard only | always | `getIDSetupRequestData`, `getWorkflowContext`, `getFullNewHireData` |
| `lastName` (:164) | `lastName` | 12 / Last Name | string | required | HTML5 | required | always | as firstName |
| `preferredName` (:169) | `preferredName` | 13 / Preferred Name | string | optional | — | guard only | always | `getIDSetupRequestData`, `getWorkflowContext` |
| `position` (:176) | **`positionTitle`** (renamed :1167) | 14 / Position Title | string | required | HTML5 | required | always | `jobTitle` in every email; `getIDSetupRequestData` 'Position Title'; HR Verification overwrites (`HRVerificationHandler.js:161`) and stores `"Job Title / JR Title"` in HR results; `rawLogResult`; Safety task |
| `siteName` (:182) | `siteName` | 15 / Site Name | string (from `refData.sites`, `populateSelect` :826) | required | HTML5 select | required | always | email subjects; `Dashboard_View.SITE`; Safety context; HR overwrite (`HRVerificationHandler.js:160`) |
| `jobSiteNumber` (:189) | `jobSiteNumber` | 16 / Job Site # | string (from `refData.jobNumbers`, :848) | required | HTML5 select; `autoFillJobNumber` :1129 (from `data-job-number` attr — the select options are populated without that attribute, so this is effectively a no-op) | required | always (**disabled in equipment mode** :686-690) | `getIDSetupRequestData` 'Job Site #'; `getITContextData`; `getWorkflowContext.jobSiteNumber` |
| `department` (:198) | `department` | 50 / Department | string | optional | — | guard only | always | `getIDSetupRequestData` 'Department'; HR change detection (`HRVerificationHandler.js:148,163`); `Dashboard_View` |
| `managerEmail` (:207) | **`reportingManagerEmail`** (renamed :1170) | 17 / Manager Email | email | required | HTML5 `pattern=".*@(team-group\.com|robinsonsolutions\.com|industrialappliedtech\.com|stgroup\.ca)"`; `DirectoryAutocomplete.setup` :668-671 | required (presence; **no email-format check server-side**) | always | manager recipient of Credentials Ready / IT Setup Complete / Onboarding Complete; WIS Assignment action item assignee (`ITSetupHandler.js:588-600`); email subject `Manager: …`; `Dashboard_View.MANAGER_EMAIL`; HR overwrite (`HRVerificationHandler.js:158`) |
| `managerName` (:214) | **`reportingManagerName`** (renamed :1169) | 18 / Manager Name | string | required, `readonly` (auto-fills on directory pick) | HTML5 | required | always | `getWorkflowContext.managerName`; emails; HR overwrite (:157) |
| `systemAccess` (:222 `Yes`, :227 `No`) | `systemAccess` | 19 / System Access | enum `Yes|No` | required | HTML5; `toggleSystemAccess` :941-951 shows `#systemAccessSection` | required | always | **routing key** with `employmentType` (`IDSetup.js:257,265`, `HRVerificationHandler.js:166,262`); `EXPEDITE` subject tag; if `!== 'Yes'` the client **clears `systems` and `equipment` to `[]`** before submit (:1212-1215) |

### 1.4 System Access → Systems/Apps (`InitialRequest.html:236-384`; visible only when `systemAccess=Yes`)

| Client `name=` | Payload key | Col / Header | Type | Req? | CSV | SSV | Vis. | Consumers |
|---|---|---|---|---|---|---|---|---|
| `systems` (checkbox group; values `ADP Supervisor Access` :251, `BOSS` :271, `CAA` :319, `Delivery` :323, `Fleetio` :327, `Google Account` :331, `Incidents` :358, `Central Purchasing/Jonas` :362, `Net Promoter Score` :378, `SiteDocs Supervisor` :382) | `systems` (array, `getAll` :1172) | 20 / Systems | csv (`join(', ')` :196) | optional | none; cleared to `[]` when `systemAccess!=='Yes'` | guard only | section | `getIDSetupRequestData.siteDocsAccess` (`IDSetup.js:92`, `includes('SiteDocs')` → shows SiteDocs username/password fields on ID Setup form); HR Verification BOSS routing (`HRVerificationHandler.js:281-284` → IT Confirmation step); `triggerSpecialists` Fleetio (`ITSetupHandler.js:117,507`), SiteDocs WIS user for EQUIP_ only (:576-585); `getRequiredSpecialistCats` Fleet (`ActionItemService.js:481`); `Dashboard_View.REQUESTED_ITEMS_JSON` |
| `adpSalaryAccess` (:258, checkbox value `Yes`) | `adpSalaryAccess` (`=== 'Yes' ? 'Yes':'No'` :1203) | 53 / ADP Salary Access | `Yes|No` | optional (default `No`) | forced `No` unless `systems` includes `ADP Supervisor Access` (:1246-1249) | guard only | `#adpSitesSection` shown when ADP checked (`toggleSections` :1007-1008) | HR Verification payroll email "HR Verified — Salary Access Required" (`HRVerificationHandler.js:168,317-323`) |
| (dual-list hidden input) `adpSites` — built by `buildDualList('adpSitesCheckboxes', refData.jobs, 'adpSites')` :829-831; `SharedComponents.html:372-384` creates `<input type=hidden name=adpSites value="a, b">` | `adpSites` (`getAll` → array of **one CSV string** :1199) | 49 / ADP Sites | csv | label marked `*` (:264) but **no enforcement** (hidden input) | cleared to `[]` unless ADP checked (:1247) | guard only | `#adpSitesSection` | `getWorkflowContext.adpSites`; IT Confirmation write-back (`ITConfirmationHandler.js:96`) |
| `bossTrainingOnly` (:279 `Yes`, :280 `No`) | `bossTrainingOnly` (`|| 'No'` :1204) | 54 / BOSS Training User Only | `Yes|No` | optional | `toggleBossTrainingOnly` :1098-1102 hides `#bossFullAccessFields` when `Yes`; **not cleared when BOSS unchecked** (only the 5 BOSS detail fields are, :1250-1257) | guard only | `#bossDetailsSection` (BOSS checked) | `getITContextData.bossTrainingOnly` (`ITSetupHandler.js:108`); WIS Assignment description (`ITSetupHandler.js:590-592`) |
| (dual-list) `bossJobSites` — `buildDualList('bossCommitteesCheckboxes', refData.committees, 'bossJobSites')` :858-860 | `bossJobSites` (`getAll().join(', ')` :1186) | 39 / BOSS Sites | csv | optional | cleared unless BOSS checked (:1252) | guard only | BOSS section + `#bossFullAccessFields` | `getITContextData.bossJobSites` → IT Setup form BOSS committee checkboxes (`ITSetup.html:213` `BOSS_Cmte_<key>`); IT Confirmation overlay (`ITSetupHandler.js:130`); **`getWorkflowContext` looks up header `'BOSS Job Sites'`/`'Boss Job Sites'` (`EmailUtils.js`), not `'BOSS Sites'` — see §8** |
| `bossCostSheet` (:292 `Yes`, :293 `No`) | `bossCostSheet` | 40 / BOSS Cost Sheet | `Yes|No` | optional | `toggleCostSheetJobs` :1105-1115 | guard only | BOSS full-access | `getITContextData`; IT Confirmation write-back (:91) |
| (dual-list) `costSheetJobNumbers` — `buildDualList('costSheetJobCheckboxes', refData.jobs, 'costSheetJobNumbers')` :853-855 | **`bossCostSheetJobs`** (renamed, `getAll().join(', ')` :1188) | 41 / BOSS Jobs | csv | optional | cleared unless BOSS (:1254) | guard only | `#costSheetJobs` shown when `bossCostSheet=Yes` | IT Setup form `BOSS_CostSheet_<key>` checkboxes (`ITSetup.html:223`); IT Confirmation |
| `bossTripReports` (:305/:306) | `bossTripReports` | 42 / BOSS Trip | `Yes|No` | optional | cleared unless BOSS | guard | BOSS full-access | IT Setup form `BOSS_TripReports` (`ITSetup.html:233`) |
| `bossGrievance` (:312/:313) | **`bossGrievances`** (renamed :1190) | 43 / BOSS Grievances | `Yes|No` | optional | cleared unless BOSS | guard | BOSS full-access | IT Setup form `BOSS_Grievances` (`ITSetup.html:243`) |
| `googleEmailLocal` (:339) | **`googleEmail`** (renamed :1176) | 22 / Google Email | string (local part only) | optional | auto `first.last` from names (:900-915); cleared unless `Google Account` checked (:1262-1265) | guard | `#googleAccountDetailsSection` (`toggleSections` :1020-1027) | `getIDSetupRequestData.requestedUsername` → SiteDocs username default (`IDSetup.js:28-30`); `getITContextData.googleEmail/emailRequested` → IT Setup `Email_Username` prefill (`ITSetup.html:310-320`) |
| `googleDomain` (:345; options `team-group.com`, `robinsonsolutions.com`, `industrialappliedtech.com`, `stgroup.ca`) | `googleDomain` | 23 / Google Domain | string (no `@`) | optional | auto-set to manager's domain (:1023-1026, :918-928) | guard | Google section | `getITContextData.googleDomain` → IT Setup `Email_Domain` prefill (`ITSetup.html:329-335`, adds `@`) |
| (dual-list) `purchasingSites` — `buildDualList('purchasingSitesCheckboxes', refData.jobs, 'purchasingSites')` :834-836 | `purchasingSites` (`getAll` :1201, array of one CSV) | 51 / Purchasing Sites | csv | label `*` (:367) but **not enforced** | cleared unless `Central Purchasing/Jonas` (:1259-1261) | guard | `#jonasDetailsSection` | `triggerSpecialists` Purchasing task (`ITSetupHandler.js:545-572`); `getWorkflowContext.purchasingSites` |
| (dual-list) `jonasJobNumbers` — `buildDualList('jonasJobNumbersCheckboxes', refData.jobs, 'jonasJobNumbers')` :863-865 (also `populateSelect('jonasJobNumbers', …)` :849 — targets a non-existent element, no-op) | `jonasJobNumbers` (`getAll().join(', ')` :1191) | 44 / Jonas Job #s | csv | optional | cleared unless Jonas (:1259) | guard | Jonas section | `triggerSpecialists` Purchasing task (:544); `getRequiredSpecialistCats` → `'Purchasing'` blocking category (`ActionItemService.js:479`) |

### 1.5 Equipment (`InitialRequest.html:392-523`; visible only when `systemAccess=Yes`)

| Client `name=` | Payload key | Col / Header | Type | Req? | CSV | SSV | Vis. | Consumers |
|---|---|---|---|---|---|---|---|---|
| `equipment` (checkbox group; `Business Cards` :394, `Computer` :398, `Credit Card` :455, `Mobile Phone` :489, `SiteDocs Tablet` :515, `Vehicle` :519) | `equipment` (array :1173) | 21 / Equipment | csv | optional | cleared when `systemAccess!=='Yes'` | guard | section | `getITContextData.businessCards/vehicleRequested` (`ITSetupHandler.js:115-116`) → Business Cards + Fleetio "Assign company vehicle" tasks; `getRequiredSpecialistCats` Business Cards (`ActionItemService.js:482`); `getWorkflowContext.equipmentRaw` |
| `computerRequestType` (:406 `New`, :407 `Reassignment`) | `computerRequestType` | 24 / Computer Req | enum | label `*` (:404) but **not `required`** | `toggleComputerReassignFields` :1050-1066; cleared unless `Computer` (:1216-1222) | guard | `#computerDetailsSection` | `getITContextData.computerReq`; IT Confirmation overlay/write-back (`ITConfirmationHandler.js:87,154`) |
| `computerType` (:414 `Chromebook`, :415 `Windows`, :416 `Mac`) | `computerType` | 25 / Computer Type | enum | optional | `toggleOffice365Question` :1080-1096; cleared unless `computerRequestType==='New'` (:1223-1226) | guard | `#computerNewFields` | IT Setup `Computer_Type` prefill (`ITSetup.html:338-344`); `getWorkflowContext.computerType` (later overridden by IT Results) |
| `office365Required` (:426/:427) | `office365Required` | 29 / Office 365 | `Yes|No` | optional | shown only for Windows/Mac (:1091-1095, unchecks when hidden); cleared with computerType | guard | `#office365Question` | `getFullNewHireData.office365Required` only (no email/handler consumer found) |
| `computerPreviousUser` (:436) | `computerPreviousUser` | 26 / Prev User (computer) | string | optional | cleared unless Reassignment (:1228-1231) | guard | `#computerReassignFields` | `getITContextData.computerPrevUser` → IT Setup callout (`ITSetup.html:92-96`) |
| `computerPreviousType` (:440 select `Chromebook|Windows|Mac`) | `computerPreviousType` | 27 / Prev Type | enum | optional | as above | guard | reassign | `getITContextData.computerPrevType` |
| `computerSerialNumber` (:449) | `computerSerialNumber` | 28 / Serial # | string | optional | as above | guard | reassign | IT Setup `Computer_Serial` prefill (`ITSetup.html:347-348`) |
| `creditCardUSA` (:464 checkbox `Yes`) | `creditCardUSA` (`? 'Yes' : 'No'` :1179) | 30 / CC USA | `Yes|No|''` | optional | set to `''` (not `No`) unless `Credit Card` checked (:1238-1245) | guard | `#creditCardDetailsSection` | `triggerSpecialists` Finance task (`ITSetupHandler.js:481-493`); `getRequiredSpecialistCats` (`ActionItemService.js:480`); IT Confirmation prefill |
| `creditCardLimitUSA` (:467) | `creditCardLimitUSA` | 31 / Limit USA | free text ("$1,000") | optional | cleared with card section | guard (**a limit typed as "-500" or "+500" fails the whole submit**) | card section | Finance task description "Requested limit: …" (:483) |
| `creditCardCanada` (:472) | `creditCardCanada` | 32 / CC CAN | `Yes|No|''` | optional | as USA | guard | card section | as USA (:484) |
| `creditCardLimitCanada` (:475) | `creditCardLimitCanada` | 33 / Limit CAN | text | optional | | guard | | |
| `creditCardHomeDepot` (:480) | `creditCardHomeDepot` | 34 / CC HD | `Yes|No|''` | optional | | guard | | (:485) |
| `creditCardLimitHomeDepot` (:483) | `creditCardLimitHomeDepot` | 35 / Limit HD | text | optional | | guard | | |
| `phoneRequestType` (:497 `New`, :498 `Reassignment`) | `phoneRequestType` | 36 / Phone Req | enum | label `*` but **not `required`** | `togglePhoneReassignFields` :1068-1078; cleared unless `Mobile Phone` (:1233-1237) | guard | `#mobilePhoneDetailsSection` | `getITContextData.phoneReq`; IT Confirmation overlay (:137) |
| `phonePreviousUser` (:505) | `phonePreviousUser` | 37 / Prev User (phone) | string | optional | cleared unless phone | guard | `#phoneReassignFields` (Reassignment) | `getITContextData.phonePrevUser` |
| `phonePreviousNumber` (:509, `type=tel`) | `phonePreviousNumber` | 38 / Prev Number | string | optional | none (`isValidPhone` in `ValidationUtils.js:191` is **not** called) | guard | reassign | `getITContextData.phonePrevNumber` |

### 1.6 JR / 30-60-90 / comments (`InitialRequest.html:525-580`; inside System Access section, `.new-hire-only`)

| Client `name=` | Payload key | Col / Header | Type | Req? | CSV | SSV | Vis. | Consumers |
|---|---|---|---|---|---|---|---|---|
| `jrRequired` (:532 `Yes`, :536 `No`) | `jrRequired` | 45 / JR Req | `Yes|No` | optional | `toggleJRPicker` :1117-1127 | guard | System Access section | `getHRVerificationData.jrRequired` (`HRVerificationHandler.js:33-41`) → shows the JR Title select on HR Verification (`HRVerification.html:98-107`); `getITContextData.jrRequested` |
| `jrAssignment` (:545 select, options from `refData.jrs` :841-851) | `jrAssignment` | 46 / JR Assign | string | optional | | guard | `#jrPicker` when `jrRequired=Yes` | `getIDSetupRequestData.jrTitle` ('JR Assign'); `getWorkflowContext.jrTitle` (overridden by HR results `"Job / JR"`); HR Verification pre-select (`HRVerification.html:101` `data-original-value`) and **overwrite** of col 46 (`HRVerificationHandler.js:162`); `rawLogResult.jrAssignment` |
| `plan306090` (:562 `Yes`, :566 `No`) | `plan306090` | 47 / 30/60/90 | `Yes|No` | optional | | guard | section | **`triggerSpecialists` :520 — `=== 'Yes'` creates BOTH the `review_306090` task and the `jr_title` task (see `JR.md`)**; `getRequiredSpecialistCats` (`ActionItemService.js:485`); `rawLogResult.plan306090` |
| `comments` (:578 textarea) | `comments` | 48 / Comments | string | optional | | guard (leading `-`/`=`/`+`/`@` rejected) | always | `getFullNewHireData.comments`; `Dashboard_View`; IT Confirmation prefill (`sv('comments', …)` :737) |

Field count: **50 client-posted keys** (46 named controls incl. 5 dual-list hidden inputs + `systems`/`equipment` groups, after the 6 renames) + 5 server-set keys (`workflowId`, `formId`, `timestamp`, `internalEmployeeId`, `existingInternalEmployeeId` optional input) = 56 sheet columns; `Status` (52) is the only column with no payload key.

### 1.7 Renames the client performs (HTML name → payload key)

`InitialRequest.html:1163-1191`: `hireType→newHireOrRehire`, `position→positionTitle`, `managerEmail→reportingManagerEmail`, `managerName→reportingManagerName`, `googleEmailLocal→googleEmail`, `costSheetJobNumbers→bossCostSheetJobs`, `bossGrievance→bossGrievances`. Three checkbox flags are normalised to `'Yes'/'No'` strings (`creditCardUSA/Canada/HomeDepot`, `adpSalaryAccess`) and `bossTrainingOnly` defaults to `'No'`.

---

## 2. What happens on submit, step by step

`submitInitialRequest(formData)` — `InitialRequestHandler.js:17-129`. Runs as the calling user (web UI) or under `Actor.run(actor, …)` when called via `n8n_createInitialRequest` (`N8n.js:68`).

1. **`rawLog('submitInitialRequest', formData)`** :19 → `Raw Log` row `kind='submit'`, `Workflow ID` blank (no id yet), `User = Actor.email()` (`RawLog.js:15,33`). Never throws.
2. **Validate** :22-31 — `validateRequiredFields` on the 13 keys; on failure returns `{success:false, message:'Missing required fields: …'}` **before any write** (C-8/H-4 fix).
3. **`createWorkflow('NEW_EMP','New Employee Onboarding', requesterEmail)`** :34 → appends to `Workflows` with `Status='In Progress'`, `Current Step='Initial Request'` (`WorkflowManager.js:386-396`). Idempotency: same type + initiator within 30 s returns the existing id (:371-384).
4. **`generateFormId('INIT_REQ')`** :35.
5. **EFX — `EmployeeIdRegistry.allocate(workflowId, {employeeName, source:'submitInitialRequest', existingEmployeeId})`** :39-43 → `Employee IDs` row; id = `max(Employee IDs col A, ID Setup Results col D) + 1`, floor 30000, append-then-verify, `LockService` best-effort, throws after 5 retries (`EmployeeIdRegistry.js:74-106`). Any throw here is caught by the outer `try` (:124) → `{success:false}` **after the Workflows row was written** (orphan workflow; same pre-existing pattern as a sheet write failure).
6. Stamp `workflowId`, `formId`, `internalEmployeeId`, `timestamp` onto `formData` :46-49.
7. **`formatInitialRequestData`** :52 → 56-element array; **`addSheetRow(…, 'Initial Requests', rowData)`** :55-63; throws `'Failed to add row to spreadsheet'` on failure.
8. **`updateWorkflow(workflowId, 'In Progress', 'ID Setup Needed', employeeName)`** :67 → `Workflows.Status/Current Step/Employee Name/Last Updated`; `syncStatusToRequestSheet` writes `Initial Requests.Status` (col 52) (`WorkflowManager.js:433,451-485`).
9. **`syncWorkflowState(workflowId)`** :68 → `Dashboard_View` row (`StateSync.js:78`).
10. **EFX — `rawLogResult('submitInitialRequest', workflowId, {...})`** :73-79 → `Raw Log` row `kind='result'` (payload in §4) + optional signed webhook fan-out (`RawLog.js:52,60-73`).
11. **EFX (flagged) — `if (CONFIG.SAFETY_TRAINING_AT_SUBMIT)`** :83-89 → `sendSafetyOnboardingEmail(workflowId, {employeeName, position, siteName, hireDate}, {})` creates the `Safety` / `safety_onboarding` action item and emails `grp.forms.safety` **at submit**. Flag default off (`Config.js:41-43`, setter `Setup.js:444`). Failure is caught and logged (non-fatal). See `SAFETY.md` §3.
12. **`sendInitialRequestEmails({...})`** :94-113 (`EmailUtils.js:642-701`), `contextData.workflowType='New Hire'`:

| # | To | Raw subject | Final subject (via `buildEmailSubject`, `EmailUtils.js:20-135`) | Button / link | Body gist |
|---|---|---|---|---|---|
| 1 | `CONFIG.EMAILS.IDSETUP` (`grp.forms.idsetup@team-group.com` default, `Config.js:96`) | `ID Setup Required` | `[New Hire | <Hourly|Salary>[ | EXPEDITE]] ID Setup Required: <First Last> | <Site> | Start Date: yyyy-MM-dd | Manager: <managerEmail>` | `?form=id_setup&wf=<workflowId>` (`buildFormUrl`, :92) | "A new employee onboarding request requires your attention…" |
| 2 | `requesterEmail` | `Request Submitted` | `[New Hire | …] Request Submitted: <Name> | <Site> | Start Date: … | Manager: …` | none | "Your employee onboarding request has been received…" |

`EXPEDITE` appears when `employmentType==='Hourly'` and `systemAccess!=='No'` (`EmailUtils.js:29`). In non-PROD, or when Script Property `EMAIL_REDIRECT_ALL` is set, everything is redirected and prefixed `[TEST]` (`EmailUtils.js:557-571`). `SUPPRESS_EMAILS_OVERRIDE='true'` suppresses entirely (:547-550).

13. **Return** :115-122.

Action items created at submit: **none** unless `SAFETY_TRAINING_AT_SUBMIT` is on (then exactly one: category `Safety`, formType `safety_onboarding`, assignee `grp.forms.safety`, name `Safety Onboarding — <Name>`, checklist `['Assign SiteDocs locations for employee','Assign DSS learning paths']`, `EmailUtils.js:1084-1097`). All other New Hire action items are created later by `triggerSpecialists` after IT Setup (`ITSetupHandler.js:449-639`) and by HR Verification (`IT Confirmation` item, `HRVerificationHandler.js:287`).

Workflow/step after submit: `Workflows` = `In Progress` / `ID Setup Needed`; `Initial Requests.Status` = `In Progress`.

---

## 3. Response shape

```json
{
  "success": true,
  "workflowId": "NEW_EMP_20260916-141500_123",
  "formId": "INIT_REQ_20260916-141500_456",
  "internalEmployeeId": "30417",
  "message": "Request submitted successfully",
  "scriptUrl": "https://script.google.com/.../exec"
}
```
(`InitialRequestHandler.js:115-122`). Failure: `{ success:false, message:'Missing required fields: …' | 'Error submitting form: <err>' }` (:29-31, :124-128). `internalEmployeeId` is the EFX addition; the client success screen ignores it (`InitialRequest.html:1271-1316`).

Through `n8n_createInitialRequest` the same object is wrapped: `{ ok:true, apiVersion, requestId:'REQ-XXXXXXXX', result:<above>, record?:<header-keyed Initial Requests row when include=['record']> }` (`N8n.js:58-75`). Contract validation happens first (`FormContracts.validate`, unknown keys are rejected — `FormContracts.js:339-341`), then `Actor.run`. Errors: `E_UNKNOWN_FORM`, `E_VALIDATION` (`fields:[{field,problem}]`), `E_UPSTREAM` (handler returned `success:false`, `upstream` carries it), `E_INTERNAL`.

---

## 4. Raw Log `result` event (`rawLogResult`, `InitialRequestHandler.js:73-79`)

Row in sheet `Raw Log` (`RawLog.js:13`, headers `Timestamp | Source | Workflow ID | User | Raw JSON | Event ID | Kind`):

| Column | Value |
|---|---|
| Timestamp | `new Date()` |
| Source | `submitInitialRequest` |
| Workflow ID | the new `NEW_EMP_…` id |
| User | `Actor.email()` (n8n actor email, or the human) |
| Raw JSON | payload below |
| Event ID | `EVT-yyyyMMddHHmmss-XXXXXXXX` (UTC) |
| Kind | `result` |

```json
{
  "formId": "INIT_REQ_…",
  "internalEmployeeId": "30417",
  "employeeName": "First Last",
  "employmentType": "Hourly|Salary",
  "employeeType": "Direct Hire|Agency",
  "siteName": "…",
  "positionTitle": "…",
  "hireDate": "yyyy-MM-dd",
  "managerEmail": "…",
  "requesterEmail": "…",
  "systems": ["BOSS", "Google Account"],
  "plan306090": "Yes|No|",
  "jrAssignment": "…|"
}
```

Same event is POSTed (fire-and-forget) to Script Property `EFX_EVENT_WEBHOOK_URL` as `{v:1, kid, ts, nonce, action:'event', actor:{id:'forms:rawlog'}, payload:{eventId, kind, source, workflowId, actor, payload}, sig}` with HMAC-SHA256 over `v\nkid\nts\nnonce\naction\nsha256(payload)` (`RawLog.js:60-88`). Readable back via `n8n_events` / `efxEventsSince({afterEventId|afterTs, kinds:['result'], sources:['submitInitialRequest']})` (`EfxApi.js:141-169`). The preceding `submit` event for the same request has an **empty Workflow ID** (logged before the id exists) — correlate on `result`.

---

## 5. Pre-assigned Internal Employee ID — what changed

| | Before (prod) | EFX fork |
|---|---|---|
| Minted | at ID Setup **page load** (`generateEmployeeId`, `IDSetup.js:109-140`), `max+1` over `ID Setup Results` col D, no reservation | at **submit** (`EmployeeIdRegistry.allocate`, `InitialRequestHandler.js:39`) |
| Persisted | only when ID Setup form submitted | immediately: `Employee IDs` sheet + `Initial Requests` col 55 |
| Visible to automation | never before ID Setup | `submitInitialRequest` response, `rawLogResult`, `n8n_getEmployeeId`, `getWorkflowContext().preassignedEmployeeId` (`EmailUtils.js` AUGMENT 2b) |
| Collision fallback | `'30' + epoch tail` (colliding) | none — throws (`IDSetup.js:135-139`, `EmployeeIdRegistry.js:94`) |
| Rehire carry | none | `existingInternalEmployeeId` payload key → `source='rehire-carry'` |

`ID Setup Results` col D (`INTERNAL_EMP_ID`) is still written at ID Setup time with the pre-assigned value (see `ID_SETUP.md`); `hasId` in email templates still keys off that column (`EmailTemplates.js:114`), so emails are unchanged until ID Setup runs.

---

## 6. Client-side behaviours n8n must replicate (or not)

- **Hidden-section clearing** (`InitialRequest.html:1210-1266`) is client-only. The server stores whatever it receives. n8n should send `''`/`[]` for sections that do not apply, exactly as the client does, otherwise the sheet and downstream tasks (e.g. Finance task from a stray `creditCardUSA:'Yes'`) will be wrong.
- Dual-lists post **one CSV string inside an array** (`adpSites`, `purchasingSites`) or a **joined CSV string** (`bossJobSites`, `bossCostSheetJobs`, `jonasJobNumbers`). `formatInitialRequestData` accepts arrays or strings for `adpSites`/`purchasingSites` (:225,227) and strings for the other three.
- Reference lists come from `getInitialFormData()` (`Services/ReferenceDataService.js`): `sites`, `jobNumbers`, `jobs`, `committees`, `jrs` — mapped in `FormContracts.new_hire.enums` as `reference.*`.
- `checkHireDate` warning and `managerEmail` domain `pattern` are client-only; server accepts any string.
- `requesterEmail`/`requesterName` are read-only in the UI and come from the session; from n8n they are free text and become `Workflows.Initiator Email` — use the actor's or the real requester's address deliberately.

---

## 7. `equipment` mode of the same HTML → `submitEquipmentRequest` (`EquipmentRequestHandler.js:31-87`)

Served by `serveEquipmentRequest()` with `mode=baseMode='equipment'` (:19-29); `?form=equipment_request` (`Router.js:35-37`).

- UI differences: `.new-hire-only` blocks are hidden (`InitialRequest.html:556-560`) and their inputs **disabled + un-required** (:676-690): `hireDate`, `hireType`, `employeeType`, `employmentType`, `jobSiteNumber`, `systemAccess`, `jrRequired`/`jrAssignment`, `plan306090`. Disabled inputs are omitted from `FormData`, so those payload keys are `null`. `#systemAccessSection` is forced visible (:558). The `systemAccess!=='Yes'` clearing is skipped (:1212).
- Payload: the **full New Hire `data` object** plus aliases added at :1331-1336: `reqName=requesterName`, `reqEmail=requesterEmail`, `position=positionTitle`, `managerEmail=reportingManagerEmail`, `managerName=reportingManagerName`.
- Handler: `rawLog` :33 → `LockService` :36 → **`createWorkflow('EQUIP_REQ', 'System & Equipment Request', reqEmail||requesterEmail)` :41 happens BEFORE validation** → `validateRequiredFields(formData, ['firstName','lastName','siteName','managerEmail','managerName','position'])` :49-51 (a failure leaves an orphan `Workflows` row with step `Initial Request`) → `updateWorkflow(…, 'In Progress', 'IT Confirmation Needed', employeeName)` :56 → normalises aliases back to the standard keys and forces `systemAccess='Yes'` :60-65 → `formatInitialRequestData` → **`Initial Requests`** (not `Equipment_Requests`, which is declared in `SchemaConstants.js:273-289` but never written) :68-70. No `EmployeeIdRegistry` call, so col 55 is `''`. No `rawLogResult`.
- Emails (`_sendEquipmentRequestSubmitEmails` :120-163, reads the row back via `getFullNewHireData`): `Request Submitted` → requester; `IT Confirmation Required` → `CONFIG.EMAILS.IT_CONFIRMATION` (`davelangohr@team-group.com` default, `Config.js:105`) with link `?form=it_confirmation&wf=…`. `workflowType='Equipment Request'`.
- Response: `{ success:true, workflowId, scriptUrl }` — no `formId`, no `internalEmployeeId` (:81).
- Downstream: IT Confirmation (`ITConfirmationHandler.js:44-266`) → `IT Setup Needed` → `submitITSetup` → `triggerSpecialists` with EQUIP_ guards (no 30/60/90, no JR, no WIS Assignment; adds `ID Setup`/`wis_user` SiteDocs task when `systems` contains `SiteDocs` — note the checkbox value is `SiteDocs Supervisor`, and the check at `ITSetupHandler.js:576` is `=== 'sitedocs'` exact-match lower-case, so it **never fires** from this form; see §8).

Contract: `FormContracts.equipment_request` (now `verified:true`, required = the six handler keys; the New Hire keys are optional).

---

## 8. Things that look like bugs (found while tracing)

1. **`ITConfirmationHandler.js:70` reads `formData.hireType`, but the client posts `newHireOrRehire`** (`InitialRequest.html:1163`). On IT Confirmation the `New Hire/Rehire` column (7) is overwritten with `''`. Same in `BOSSReviewHandler.js` duplicate.
2. **`getWorkflowContext` BOSS header lookups** (`EmailUtils.js`, `bossJobSites: row[headers.indexOf('BOSS Job Sites')] || row[headers.indexOf('Boss Job Sites')]`, likewise `'BOSS Cost Sheet Access'`, `'BOSS Cost Sheet Jobs'`, `'BOSS Trip Reports'`) do not match the headers documented in `SchemaConstants.js:97-101` (`BOSS Sites`, `BOSS Cost Sheet`, `BOSS Jobs`, `BOSS Trip`). If the live headers equal the schema comments, these context fields are always `''` in emails (IT Setup form is unaffected — it uses `getITContextData` by index).
3. **`triggerSpecialists` SiteDocs check** (`ITSetupHandler.js:576`) compares `toLowerCase() === 'sitedocs'`; the checkbox value is `SiteDocs Supervisor` (`InitialRequest.html:382`), so the EQUIP_ `wis_user` task is never created from this form (only from `PositionSiteChangeRequest.html:298` value `SiteDocs`, which is a CHANGE_ workflow and therefore excluded too).
4. **Equipment mode creates the workflow before validating** (`EquipmentRequestHandler.js:41` vs :49) — orphan `Workflows` rows on validation failure. New Hire has the fix (validate first).
5. Formula-injection guard rejects **any** field starting with `-`/`+`/`=`/`@` (`ValidationUtils.js:221-227`) — a comment beginning with a dash or a limit like "-" fails the submit with a message that names the field; n8n should sanitise.
6. `adpSites` / `purchasingSites` labels show `*` (`InitialRequest.html:264,367`) but the dual-list hidden inputs are never `required` — nothing enforces them.
7. `populateSelect('jonasJobNumbers', …)` (`InitialRequest.html:849`) targets an element id that does not exist (the dual-list container is `jonasJobNumbersCheckboxes`) — dead code, harmless.
8. `autoFillJobNumber` (`:1129-1145`) expects `data-job-number` on site options, which `populateSelect` never sets — the Job Site Number is never auto-filled.
9. `Equipment_Requests` sheet (`SchemaConstants.EQUIPMENT_REQUESTS`) is declared but never written; `_sendEquipmentRequestSubmitEmails` docstring (:117) still says it reads from it.
