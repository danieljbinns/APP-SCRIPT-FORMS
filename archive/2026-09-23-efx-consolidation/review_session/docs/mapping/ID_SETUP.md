# ID Setup — `EmployeeIDSetup.html` → `submitEmployeeIDSetup` → `ID Setup Results`

| Layer | File / symbol |
|---|---|
| Route | `?form=id_setup&wf=<workflowId>` → `Router.js:51-54` (guard `AccessControlService.canViewForm(user, CONFIG.EMAILS.IDSETUP)`) → `serveIDSetup(workflowId)` `IDSetup.js:5-35` |
| Client | `EmployeeIDSetup.html` (form :30-143, submit :150-199) |
| Server | `IDSetup.js` → `submitEmployeeIDSetup(formData)` :147-226, `triggerNextStepFromIDSetup` :251-345, `getIDSetupRequestData` :37-107 |
| Schema | `SCHEMA.ID_SETUP_RESULTS` `SchemaConstants.js:132-147` (14 columns) |
| Contract | `FormContracts.js` → `id_setup` (verified:true) |
| n8n alias | `N8n.js` → `n8n_submitIdSetup(actor, data, include)` :134-137 (`createsWorkflow:false`) |

---

## 1. Page load (what the form is pre-filled with)

`serveIDSetup` (`IDSetup.js:5-35`):

- `getIDSetupRequestData(workflowId)` :14 reads the `Initial Requests` row **by header name** (`IDSetup.js:46-59`: `'Workflow ID','Requester Email','Hire Date','New Hire/Rehire','Employee Type','Employment Type','First Name','Middle Name','Last Name','Preferred Name','Position Title','JR Assign','Site Name','Job Site #','Manager Email','Manager Name','System Access','Systems','Google Email','Google Domain','Department'`). Missing → "Data Not Found" page (:16-18).
- **EFX**: `template.generatedEmployeeId = EmployeeIdRegistry.get(workflowId) || generateEmployeeId()` :22 — shows the id allocated at submit; legacy `max+1` prediction only for pre-cut-over workflows. `generateEmployeeId` no longer has the timestamp fallback (throws, :135-139).
- `generatedDssUsername = first.last` lower-case (:24, `generateDssUsername` :142-145).
- `generatedSiteDocsDefault = <Google Email>@<Google Domain>` from the request when both present (:28-30).
- `requestData.siteDocsAccess = Systems.includes('SiteDocs')` (:92) drives the conditional SiteDocs login section.

## 2. Fields

| Client `name=` (`EmployeeIDSetup.html`) | Payload key (:161-174) | Col / header (`SchemaConstants.js`) | Type | HTML required | Server handling (`IDSetup.js`) | Conditional |
|---|---|---|---|---|---|---|
| `workflowId` (hidden :31) | `workflowId` | 0 / Workflow ID | string | — | :150; `getIDSetupRequestData` must succeed or throws `'Could not fetch request data…'` :154-155 | always |
| `formId` (hidden :32, always `''`) | `formId` | 1 / Form ID | string | — | **ignored**; server generates `generateFormId('ID_SETUP')` :151 | always |
| — | — | 2 / Submission Timestamp | datetime | — | `new Date()` :190 | |
| `internalEmployeeId` (:39, `value=<generatedEmployeeId>`) | `internalEmployeeId` | 3 / Internal Employee ID | numeric string | `required` | **EFX pre-assigned logic** :177-187, see §3 | always |
| `siteDocsWorkerId` (:51) | `siteDocsWorkerId` | 4 / SiteDocs Worker ID | string | `required` | written as-is :191 (no server check) | always |
| `siteDocsJobCode` (:56 select) | `siteDocsJobCode` | 5 / SiteDocs Job Code | enum **hard-coded in HTML**: `Hourly 1`, `Hourly 2`, `Salary 1`, `Salary 2`, `Supervisor`, `Manager` (:57-63) | `required` | written as-is :191 | always |
| `siteDocsUsername` (:78, default `generatedSiteDocsDefault`) | `siteDocsUsername` | 6 / SiteDocs Username | string | `required` **only when rendered** | `|| 'N/A'` :192 | rendered only if `requestData.siteDocsAccess` (:71-87) |
| `siteDocsPassword` (:82, `type=text`) | `siteDocsPassword` | 7 / SiteDocs Password | string | `required` when rendered | `|| 'N/A'` :192 | same |
| `dssUsername` (:96, default `first.last`) | `dssUsername` | 8 / DSS Username | string | `required` | written as-is :193 | always |
| `dssPassword` (:101, `type=text`) | `dssPassword` | 9 / DSS Password | string | `required` | written as-is :193 | always |
| `setupNotes` (:136 textarea) | `setupNotes` | 10 / Setup Notes | string | — | `|| ''` :194 | always |
| — | — | 11 / Submitted By | email | — | `Actor.email()` :194 (n8n actor email when called through the alias) | |
| `bossWisCreated` (:111 checkbox `Yes`) | `bossWisCreated` (`|| 'No'` :173) | 12 / BOSS WIS Created | `Yes|No` | — | `|| 'No'` :195 | always |
| `siteDocsBadgeCreated` (:123 checkbox `Yes`) | `siteDocsBadgeCreated` (`|| 'No'` :174) | 13 / SiteDocs Badge Created | `Yes|No` | — | `|| 'No'` :195 | always |

12 client keys; 14 sheet columns. **No `validateRequiredFields` call server-side** — the only server rejections are: request row not found (:155) and the employee-id override rule (:181-187). Paywords are stored **in clear** in cols 7 and 9 and later rendered in "Credentials Ready" / closure emails with `showPasswords:true`; `rawLogResult` deliberately omits them (:198-203).

Access: the route guard is `canViewForm(user, IDSETUP)` (`Router.js:53`), but **`submitEmployeeIDSetup` itself has no role check** (unlike HR/IT/approvals). Via `n8n_submitIdSetup` any actor can submit.

## 3. Pre-assigned Internal Employee ID (EFX behaviour, `IDSetup.js:173-187`)

```
preassigned = EmployeeIdRegistry.get(workflowId)              // 'Employee IDs' sheet, col B match
finalEmployeeId = preassigned || EmployeeIdRegistry.allocate(workflowId, {employeeName, source:'submitEmployeeIDSetup'})
if (formData.internalEmployeeId && formData.internalEmployeeId !== finalEmployeeId) {
  if (!Actor.canOverrideEmployeeId()) return { success:false, message:'Internal Employee ID is pre-assigned (<id>) and cannot be changed here.' }
  Logger.log('[EFX] Admin override … by ' + Actor.email()); finalEmployeeId = formData.internalEmployeeId
}
```

- `EmployeeIdRegistry.get` (`EmployeeIdRegistry.js:37-44`): first row whose Workflow ID matches → col A.
- For pre-cut-over workflows (no registry row) the id is allocated **now** with the same allocator (continuity with `ID Setup Results` col D via `maxKnown_`, :46-55).
- Override: only when `Actor.email()` is in `CONFIG.ADMIN_EMAILS` (`Actor.js:35-39`, `Config.js:24`). The override is **not** written back to `Employee IDs`; only `ID Setup Results` col D gets the overridden value (audit trail is the Logger line only). `FormContracts.id_setup` previously advertised an `overrideEmployeeId:true` flag — **the handler does not read it**; contract corrected to say "admin actor only".
- n8n: omit `internalEmployeeId` (or send the value returned by `n8n_getEmployeeId`). Sending anything else with a non-admin actor → `E_UPSTREAM` with the message above.
- Old behaviour removed: the silent re-derive of `max+1` when the submitted id already existed.

## 4. Submit sequence (`submitEmployeeIDSetup`, `IDSetup.js:147-226`)

1. `rawLog('submitEmployeeIDSetup', formData)` :149 — `Raw Log` `submit` row (**contains the plaintext passwords**, as before).
2. `formId = generateFormId('ID_SETUP')` :151.
3. `getIDSetupRequestData(workflowId)` :154 (throws if not found).
4. Ensure `ID Setup Results` sheet exists (creates with 14 headers :162-171).
5. Resolve `finalEmployeeId` (§3).
6. `appendRow` :189-196 — **always appends**; re-submitting the form for the same workflow creates a second row (no update-in-place, unlike HR Verification / IT Setup). Readers take the first match (`getWorkflowContext` `find`, `EmailUtils.js` AUGMENT 2; `getITContextData` first match; `EfxApi.efxReadRecord` takes the **last** match).
7. **`rawLogResult('submitEmployeeIDSetup', workflowId, {...})`** :199-203 — payload:
   ```json
   { "formId": "ID_SETUP_…", "internalEmployeeId": "30417",
     "siteDocsWorkerId": "…", "siteDocsJobCode": "Hourly 1",
     "dssUsername": "first.last", "bossWisCreated": "Yes|No" }
   ```
   (no passwords, no SiteDocs username, no badge flag).
8. `updateWorkflow(workflowId, 'In Progress', 'HR Verification Needed', '', actingUser)` :209 → `Workflows.Status/Current Step/Last Updated` (+ `Updated By` if that header exists, `WorkflowManager.js:426-429`); `Initial Requests.Status` synced. No intermediate "ID Setup Complete" step.
9. `syncWorkflowState(workflowId)` :210.
10. `triggerNextStepFromIDSetup(workflowId, formData, requestData)` :212 (§5).
11. Return `{ success:true, message:'Employee ID setup completed successfully' }` :214-217. No ids in the response (n8n gets them from `rawLogResult`/`n8n_getEmployeeId`). Failure → `{ success:false, message }` :221-224.

## 5. Emails / next step (`triggerNextStepFromIDSetup`, `IDSetup.js:251-345`)

Branch key: `requestData.employmentType` and `requestData.systemAccess` from the Initial Request (:256-257). `context = getWorkflowContext(workflowId)` (:262) now includes the ID Setup row (credentials) because of the flush-less append — GAS generally sees its own writes in the same execution.

### Branch A — `employmentType === 'Hourly' && systemAccess === 'No'` (:265-329)

| # | To | Raw subject | Final subject | Link | emailOpts |
|---|---|---|---|---|---|
| A1 | requester + manager (deduped, :274-276) | `Credentials Ready` | `[New Hire | Hourly] Credentials Ready: <Name> | <Site> | Start Date: … | Manager: …` | none | `showPasswords:true, calendarDate:hireDate` (DSS/SiteDocs creds in the body) |
| A2 | `CONFIG.EMAILS.HR + ',' + CONFIG.EMAILS.PAYROLL` | `HR Verification Required` | `[New Hire | Hourly] HR Verification Required: …` | `?form=hr_verification&wf=…` | body says "IT setup will be skipped" |
| A3 | **Safety onboarding** — `sendSafetyOnboardingEmail(workflowId, requestData, setupData)` :327, guarded by an `Action Items` scan for an existing row with `Category === 'Safety'` for this workflow (:307-326, M-14). With `SAFETY_TRAINING_AT_SUBMIT` on, the guard finds the submit-time item and skips. Creates action item `Safety`/`safety_onboarding` → `grp.forms.safety`, subject `Safety Onboarding Required — <Name>` (see `SAFETY.md`). | | | |

### Branch B — everything else (Salary, or Hourly with system access) (:330-344)

| # | To | Raw subject | Link |
|---|---|---|---|
| B1 | `CONFIG.EMAILS.HR + ',' + CONFIG.EMAILS.PAYROLL` | `HR Verification Required` (body: "IT setup will be triggered after HR verification") | `?form=hr_verification&wf=…` |

No credentials email and **no safety item** on this branch — Safety is created after HR Verification (`HRVerificationHandler.js:330-338`).

Both branches leave the workflow at `HR Verification Needed`. Nothing here closes or creates other action items.

## 6. Downstream readers of `ID Setup Results`

- `getWorkflowContext` AUGMENT 2 (`EmailUtils.js`): `internalEmployeeId, siteDocsWorkerId, siteDocsJobCode, siteDocsUsername, siteDocsPassword, dssUsername, dssPassword, bossWisCreated, idSubmittedBy, idTimestamp` → all later emails; `hasId` gate in `EmailTemplates.js:114`.
- `getITContextData` (`ITSetupHandler.js:140-157`) — same fields for the IT Setup page header (note `idSubmittedBy` is wrongly taken from `BOSS_WIS_CREATED`, :153).
- `getRequestDetails` checklist step "ID Setup" = Complete when a row exists (`RequestDetailsHandler.js:96-115`, `by` = last column of the row).
- `sendSafetyOnboardingEmail` reads `SITEDOCS_JOB_CODE` when `setupData` lacks it (`EmailUtils.js:1064-1072`).
- `EmployeeIdRegistry.maxKnown_` reads col D for id continuity (`EmployeeIdRegistry.js:46-55`).
- `closeActionItem` special case 2 (EQUIP_ `ID Setup` category) writes/updates this sheet with SiteDocs creds from the WIS User action item (`ActionItemService.js:274-311`).

## 7. n8n usage notes

- `n8n_submitIdSetup(actor, {workflowId, siteDocsWorkerId, siteDocsJobCode, dssUsername, dssPassword, siteDocsUsername?, siteDocsPassword?, setupNotes?, bossWisCreated?, siteDocsBadgeCreated?})`. Contract `required` = `workflowId, siteDocsWorkerId, siteDocsJobCode, dssUsername, dssPassword` (the always-required HTML fields). `siteDocsUsername/Password` should be sent when the request's `Systems` contains `SiteDocs` (the UI requires them then).
- The alias returns the handler's `{success,message}`; to read back ids use `include:['record']` (header-keyed last `ID Setup Results` row) or `n8n_getEmployeeId(workflowId)`.
- Duplicate submissions append duplicate rows — check `n8n_getWorkflow(...).result.checklist` ("ID Setup" status) or `efxReadRecord('ID Setup Results', wf)` first.
- Passwords you send are emailed to requester/manager in Branch A and to HR/requester/manager at workflow closure.
