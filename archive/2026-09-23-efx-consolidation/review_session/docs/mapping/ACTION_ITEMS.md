# Action Items — the generic task model

## 1. Sheet `Action Items` (`SCHEMA.ACTION_ITEMS`, `SchemaConstants.js:197-212`; row written by `createActionItem`, `ActionItemService.js:86-103`)

| Idx | Header | Type | Set at create | Set at close (`closeActionItem` :186-199) |
|---|---|---|---|---|
| 0 | Workflow ID | string | caller | — |
| 1 | Task ID | `TK-` + 8 hex upper (`Utilities.getUuid().substring(0,8)`) | :85 | — |
| 2 | Category | string (dashboard grouping; drives blocking rules) | caller | — |
| 3 | Task Name | string (used as email button label / subject) | caller | — |
| 4 | Description | **JSON array string** of checklist items (see §4) | caller | — |
| 5 | Assigned To | email or `a@x,b@y` (ADP update) | caller | — |
| 6 | Status | `Open` → `Closed` | `'Open'` | `'Closed'` |
| 7 | Created Date | datetime | `new Date()` | — |
| 8 | Completed Date | datetime | `''` | `new Date()` |
| 9 | Notes | string | `''` | closure notes (also written by `saveActionItemDraft`) |
| 10 | Closed By | email / label | `''` | `closedBy` argument |
| 11 | Draft | JSON string (schema comment says boolean — it is JSON) | `''` | `draftJSON` if supplied |
| 12 | Form Type | machine key routing `ActionItemForm.html` / aliases | `formType || ''` | — |
| 13 | Form Data | JSON string | `''` | `formDataJSON` if supplied |

`getTask(taskId)` (`ActionItemService.js:410-424`) returns the row keyed by header **with spaces removed** (`WorkflowID, TaskID, Category, TaskName, Description, AssignedTo, Status, CreatedDate, CompletedDate, Notes, ClosedBy, Draft, FormType, FormData`) — this is the shape `ActionItemForm.html` templates against. `efxTaskList` (`EfxApi.js:52-77`) returns camelCase (`taskId, workflowId, category, name, description[], assignedTo, status, createdDate, completedDate, notes, closedBy, formType, draft`).

Create-time idempotency (`ActionItemService.js:64-83`): an existing **Open** row with the same `Workflow ID + Category + Form Type` is returned instead of a new one (categories without formType compare `'' === ''`). Failure → `notifyAdminActionItemFailure` email to `CONFIG.ADMIN_EMAILS` with subject `[ACTION REQUIRED] Action item creation failed — <wf>` (`EmailUtils.js:1123-1152`) and returns `null` (callers still build a `tid=null` link).

## 2. Every `createActionItem` call site

Format: `file:line` — category / name pattern / formType / assignee / condition. `E` = the assignee is emailed with a link `?form=action_item_view&tid=…` right after creation.

### New Hire + Equipment (`ITSetupHandler.js triggerSpecialists`, invoked once from `submitITSetup` insert path :323; single loop at :609-615, consolidated email per address :617-636)
| Line (spec push) | Category | Name | formType | Assignee | Condition |
|---|---|---|---|---|---|
| :486-492 | `Finance` | `Credit Card Setup — <Name>` | `creditcard` | `CONFIG.EMAILS.CREDIT_CARD` | any of `creditCardUSA/Canada/HomeDepot === 'Yes'` (Initial Requests cols 30/32/34); checklist one line per card with requested limit |
| :497-503 | `Business Cards` | `Business Cards — <Name>` | `businesscards` | `CONFIG.EMAILS.BUSINESS_CARDS` | `Equipment` contains `Business Cards` |
| :510-516 | `Fleet` | `Fleetio Access — <Name>` | `fleetio` | `CONFIG.EMAILS.FLEETIO` | `Systems` contains `Fleetio`; + item `Assign company vehicle` when `Equipment` contains `Vehicle` |
| :521-530 | `30/60/90 Review` | `30/60/90 Review Plan — <Name>` | `review_306090` | `CONFIG.EMAILS.REVIEW_306090_JR` | `plan306090 === 'Yes'` and not `EQUIP_REQ_` |
| :532-540 | `JR Title` | `JR Assignment — <Name>` | `jr_title` | `CONFIG.EMAILS.REVIEW_JR_TITLE` | same condition (see `JR.md`) |
| :565-571 | `Purchasing` | `Central Purchasing/Jonas Setup — <Name>` | `jonas` | `CONFIG.EMAILS.JONAS` | `Jonas Job #s` non-empty or `Purchasing Sites` non-empty; one item per site/job |
| :578-584 | `ID Setup` | `SiteDocs Account Setup — <Name>` | `wis_user` | `CONFIG.EMAILS.IDSETUP` | `EQUIP_REQ_` and `systems` contains exactly `sitedocs` (case-insensitive) — never true for the current checkbox value `SiteDocs Supervisor` |
| :593-599 | `WIS` | `WIS Assignment — <Name>` | `wis` | `context.managerEmail` (the manager) | managerEmail present and not `EQUIP_REQ_`; description differs when `bossTrainingOnly === 'Yes'` |

### New Hire — other
| Site | Category | Name | formType | Assignee | Condition |
|---|---|---|---|---|---|
| `EmailUtils.js:1089-1096` (`sendSafetyOnboardingEmail`) E | `Safety` | `Safety Onboarding — <Name>` | `safety_onboarding` | `CONFIG.EMAILS.SAFETY` | called from `IDSetup.js:327` (Hourly+No, deduped), `HRVerificationHandler.js:330` (others), `InitialRequestHandler.js:85` (flag) — see `SAFETY.md` |
| `HRVerificationHandler.js:287` E (subject `IT Confirmation Required — <Name>`) | `IT Confirmation` | `IT Confirmation Required - <Name>` | *(none)* | `CONFIG.EMAILS.IT_CONFIRMATION` | HR Verification standard path and `Systems` contains `BOSS`; workflow → `IT Confirmation Needed`. **Never closed by code** — `submitITConfirmation` does not close it; it stays Open but is non-blocking because `IT Confirmation` is not in `getRequiredSpecialistCats`. |

### Termination (`TerminationHandler.js submitTerminationApproval`, decision `Approved`, all E via `sendActionItemEmail` :547-566; no formType on any)
| Line | Category | Name | Assignee | Condition |
|---|---|---|---|---|
| :325 | `IT` | `IT Systems Deactivation - <Name>` | `CONFIG.EMAILS.IT` | any of `BOSS, Delivery, Incidents, Google Account, CAA` in `Systems to Deactivate`, or mobile phone in equipment, or has reports; Google adds forwarding/files/delegate/vacation items and a `__CAL__<duration>__<confirmWith>` marker (:302) |
| :339 | `HR` | `HR Systems Deactivation - <Name>` | `CONFIG.EMAILS.HR` | `ADP Supervisor Access` selected |
| :343 | `Payroll` | `ADP Deactivation - <Name>` | `CONFIG.EMAILS.PAYROLL` | same |
| :351 | `Fleet` | `Fleet Systems Deactivation - <Name>` | `CONFIG.EMAILS.FLEETIO` | `Fleetio` selected |
| :359 | `Purchasing` | `Central Purchasing/Jonas Deactivation - <Name>` | `CONFIG.EMAILS.JONAS` | `Central Purchasing/Jonas` selected |
| :366 | `Deactivation` | `Employee Deactivation - <Name>` (`Remove from SiteDocs`, `Remove DSS User`, `Remove from BOSS WIS Module`) | `CONFIG.EMAILS.IDSETUP` | **always** |
| :372 | `EOE` | `Complete EOE Process - <Name>` | `CONFIG.EMAILS.HR` | **always** |
| :424 | `Assets` | `Asset Collection Checklist - <Name>` | `termData.requesterEmail` (email also to manager) | `Equipment to Return` non-empty; items are the equipment values themselves |
Workflow → `Action Items Pending` (:444). Rejected → `Rejected`/`Rejected by HR`, no items.

### Status Change (`PositionChangeHandler.js submitPositionChangeApproval`, decision `Approved`, all E)
| Line | Category | Name | formType | Assignee | Condition |
|---|---|---|---|---|---|
| :531 | `Manager` | `Incoming Transfer Setup` (item 1 carries `__EFFDATE__yyyy-MM-dd`) | *(none)* | `receivingManagerEmail` (HR `confirmedNewManager` > request `receivingManagerEmail` > `mgrNewEmail`) | receiving manager resolvable; **non-blocking** (`MANAGER` category, `ActionItemService.js:584`) |
| :568 | `Business Cards` | `Business Cards Order` | `businesscards` | `CONFIG.EMAILS.BUSINESS_CARDS` | `Equipment` contains `Business Cards` |
| :589 | `Finance` | `Credit Card Order` | `creditcard` | `CONFIG.EMAILS.CREDIT_CARD` | `Equipment` contains `Credit Card` |
| :609 | `Fleet` | `Fleetio Access Update` | `fleetio` | `CONFIG.EMAILS.FLEETIO` | `Systems Added` contains `Fleetio` |
| :628 | `Assets` | `Vehicle Return` | `fleetio` | `CONFIG.EMAILS.FLEETIO` | `Equipment Return` contains `Vehicle` |
| :647 | `Fleet` | `Fleetio Access Removal` | `fleetio` | `CONFIG.EMAILS.FLEETIO` | `Removed Access` contains `Fleetio` |
| :668 | `Purchasing` | `Central Purchasing/Jonas Update` | `jonas` | `CONFIG.EMAILS.JONAS` | `Systems Added` contains `Central Purchasing/Jonas`, or purchasing sites / jonas job numbers present |
| :748 | `IT` | `IT Access & Equipment Setup` | `it_setup` | `CONFIG.EMAILS.IT` (email link is `?form=it_setup&wf=…`, not the action item) | any IT system/equipment/removal after excluding Jonas/Fleetio/SiteDocs/Business Cards/Credit Card/Vehicle. **Closed by `submitITSetup`** (`ITSetupHandler.js:344-359`) with `formDataJSON` → special case 1 |
| :770 | `Assets` | `Asset Collection — <Name>` | *(none)* | old manager (fallback requester) | `Equipment Return` non-empty |
| :788 | `ID Setup` | `SiteDocs Access Removal` | `safety_change` | `CONFIG.EMAILS.IDSETUP` | `Removed Access` contains `SiteDocs` |
| :812 | `ID Setup` | `BOSS WIS User Account Update` | `boss_wis_update` | `CONFIG.EMAILS.IDSETUP` | **always** — closing it triggers special case 3 → `launchWisAssignment` |
| :832 | `ID Setup` | `SiteDocs Account Setup` | *(none)* | `CONFIG.EMAILS.IDSETUP` | `Systems Added` contains `SiteDocs` |
| :858 | `Safety` | `Safety System Updates` | `safety_change` | `CONFIG.EMAILS.SAFETY` | **always** |
| :901 | `HR` | `ADP Update Required — <Name>` | `adp_update` | `CONFIG.EMAILS.HR + ',' + CONFIG.EMAILS.PAYROLL` | **always** |
| :1055 (`launchWisAssignment`) | `WIS` | `BOSS WIS Module Assignment — <Name>` | `wis_assignment` | receiving/new/current manager | fired from `closeActionItem` special case 3 when the `boss_wis_update` item closes; non-blocking |
Workflow → `Action Items Pending` (:920).

### Dead code (commented out, `EquipmentRequestHandler.js:176-381`, ER-1)
`:220/:308` IT `IT Setup`/`it_setup`; `:314` HR `HR Systems Access`/`hr_systems`; `:324` Payroll `ADP Access Setup`/`adp_setup`; `:334` Purchasing `jonas`; `:344` Finance `creditcard`; `:354` Business Cards `businesscards`; `:364` Fleet `Vehicle Setup`/`fleetio`. Not executed.

### formType inventory
`creditcard, businesscards, fleetio, review_306090, jr_title, jonas, wis_user, wis, safety_onboarding, safety_change, it_setup, boss_wis_update, wis_assignment, adp_update` + `''` (IT Confirmation, all TERM_ items, Manager, SiteDocs Account Setup, Assets). Only `it_setup` (CHANGE_), `wis_user` (EQUIP_) and `boss_wis_update` (CHANGE_) change server behaviour; the rest are labels for the UI/dashboard/aliases.

## 3. Blocking / completion rules (`checkWorkflowCompletion`, `ActionItemService.js:534-603`)

- Runs after every close; no-op unless `Workflows.Current Step ∈ {Specialist Forms Needed, Action Items Pending}` and status not `Complete`/`Cancelled`.
- Never blocking: `Category.toUpperCase() ∈ {WIS, MANAGER}` (:584).
- `NEW_EMP_` at `Specialist Forms Needed`: only categories from `getRequiredSpecialistCats` block — `Purchasing` (jonas job numbers), `Finance` (any CC `Yes`), `Fleet` (Fleetio), `Business Cards`, `30/60/90 Review` (`plan306090 === 'Yes'`), `Safety` (always) (:469-492). `JR Title`, `IT Confirmation`, `ID Setup` never block. Lookup failure → everything blocks (fail-safe).
- `TERM_`/`CHANGE_`/`EQUIP_REQ_`: every non-WIS/Manager Open item blocks.
- Completion: `updateWorkflow(wf,'Complete','All Action Items Closed')`, `syncWorkflowState`, `notifyWorkflowClosure` (HR + initiator + manager, `Workflow Completed: <Workflow Name> (<wf>)`, `showPasswords:true`).

## 4. `ActionItemForm.html` JSON shapes

### Description (col 4) → checklist
`getChecklistItems()` (`ActionItemForm.html:183-219`): unwraps up to 3 layers of JSON-stringification, accepts a JSON array or a delimited string (`|~|`, `\n`, or `,`), trims wrapping quotes/brackets, strips `__EFFDATE__yyyy-MM-dd` from item text (kept separately for the calendar callout, :468-486), drops `n/a`/`null`. Items starting `__CAL__` render as a "Schedule Account Deletion" calendar row (`__CAL__<duration>__<confirmWith>`, :232-259) and are excluded from the completion check (:402).

### Draft (col 11)
- UI shape (`taskDraft`, :166): `{ "items": { "<item text>": { "status": "Pending|Complete|Collected|Not Returned", "comments": "", "serial": "", "by": "<email>", "at": "<ISO>" }, "__CAL__": { "status":"Complete", "dateStr":"m/d/yyyy", "at": "<ISO>" } } }`. `Collected`/`Not Returned` are `Assets`-only statuses (:290-296); `serial` only for computer/laptop/tablet items (:277-282). Finalize requires every non-`__CAL__` item ≠ `Pending` and a comment on every `Not Returned` (:398-424).
- Legacy shape accepted on load: `{ "checkedItems": ["item", …] }` → converted to `items[name] = {status:'Collected'}` (:172-176).
- Automation shape (flat, no `items` wrapper): `{ "<item>": { "status", "by", "at", "comments" } }` — written by `jrCompleteViaSecret` (`ActionItemService.js:1152-1158`), `completeMyTask` (:1059-1067) and `efxTaskClose` (`EfxApi.js:110-117`). The UI's loader treats a flat object as **empty** (`parsed.items` undefined → default `{items:{}}`), so a task closed by automation shows all rows `Pending` when reopened read-only; `notifyTaskClosure`'s Assets summary reads `draft.items` (:632-633) and would list nothing for an automation-closed Assets task. `saveActionItemDraft(taskId, notes, draftJSON)` (:365-391) writes cols 9 and 11 without closing.

### Form Data (col 13)
- UI: only for `wis_user` on `EQUIP_REQ_` (`collectFormData` :488-499) → `{ "siteDocsUsername", "siteDocsPassword", "bossWisCreated": "Yes|No" }`; otherwise `null`.
- `submitITSetup` (CHANGE_ IT item): the full IT Setup `formData` + `bossDetails` (`ITSetupHandler.js:354`).
- n8n: whatever `p.formData` is (`efxTaskClose`), e.g. `{siteDocsConfirmed, dssConfirmed, source:'n8n'}` from `n8n_assignSafetyTraining`.

## 5. `closeActionItem` special cases (`ActionItemService.js:155-360`)

| # | Trigger | Effect | Lines |
|---|---|---|---|
| 1 | `CHANGE_` + `Category='IT'` + `Form Type='it_setup'` + `formDataJSON` | Parse IT Setup keys (`Email_Created, Email_Username, Email_Domain, Email_Temp_Password, Computer_*, Phone_*, BOSS_Access, Incidents_Access, CAA_Access, Delivery_App_Access, Net_Promoter_Score_Access, IT_Notes, bossDetails`) → **append** 23-col `IT Results` row (`SUBMITTED_BY = closedBy`), flush. Runs in addition to the row `submitITSetup` already appended → **two IT Results rows** per CHANGE_ IT setup. | :201-258 |
| 2 | `EQUIP_REQ_` + `Category='ID Setup'` + `formDataJSON` with `siteDocsUsername` or `bossWisCreated` | Write/update (by Workflow ID) an `ID Setup Results` row with `SITEDOCS_USERNAME/PASSWORD`, `BOSS_WIS_CREATED`, `SUBMITTED_BY`; flush. | :260-311 |
| 3 | `CHANGE_` + `Category='ID Setup'` + `Form Type='boss_wis_update'` | `launchWisAssignment(workflowId)` → creates `WIS`/`wis_assignment` task for the manager + email `BOSS WIS Assignment Required — <Name>`. Sequencing: manager WIS item only after ID Setup closes. | :313-341 |
| — | always | flush; `notifyTaskClosure` (emails only for `Assets`: `Assets Returned: IT Equipment|Credit Card|Vehicle and Keys`); `checkWorkflowCompletion` | :345-353 |

Guards: task not found → throws → `{success:false, message:'Task not found: …'}`; already `Closed` → `{success:false, message:'This task has already been submitted.'}` (:176-183), evaluated from the sheet snapshot read at the top of the call.

## 6. Closing any task from n8n — `n8n_closeTask` (`N8n.js:146-153`)

```
n8n_closeTask(actor, { taskId } | { workflowId, formType }, notes?, checklist?: { "<item>": { status?, comments? } }, formData?: {...}, dryRun?: true )
```
→ `efxTaskClose` (`EfxApi.js:84-129`), see `JR.md` §3c for the algorithm. Key points:
- Resolution by `workflowId+formType` picks the first **Open** row; use `taskId` when a formType can occur more than once per workflow (Status Change creates two `fleetio` items — access update and removal — and two `ID Setup`-category items). Tasks with `Form Type=''` (all TERM_ items, IT Confirmation, Manager, Assets, SiteDocs Account Setup) **can only be closed by `taskId`** — get it from `n8n_listTasks({workflowId, status:'Open'})`.
- The draft written is the flat automation shape; every item not listed in `checklist` defaults to `Complete`. `checklist` statuses are recorded but do not prevent the close.
- `formData` is stored as-is and feeds special cases 1 and 2 — to close a `CHANGE_` IT `it_setup` item correctly through n8n, send the IT Setup keys in `formData` (or, better, call `submitITSetup` via `efxRunAs`, which also writes `IT Results` and the completion email). To close an `EQUIP_REQ_` `wis_user` item, send `{siteDocsUsername, siteDocsPassword, bossWisCreated}`.
- Closing `boss_wis_update` fires special case 3 exactly as the UI does.
- `Closed By` = `actor.email || actor.display || actor.id || 'automation'`.
- Errors: `E_VALIDATION`, `E_NOT_FOUND`, `E_ALREADY_CLOSED` (idempotent — treat as success), `E_UPSTREAM`, `E_INTERNAL`.
- No `Raw Log` row is written by closes (neither UI nor n8n); the observable is the `Action Items` row + `Workflows` status. `n8n_listTasks` / `efxTaskList` filters: `workflowId, taskId, assignedTo (case-insensitive), formType, status`.

## 7. Read paths n8n can use
- `n8n_listTasks(actor, filter)` → `{tasks:[…], count}` (`EfxApi.js:52-77`).
- `n8n_getWorkflow(actor, workflowId)` → `getRequestDetails` (`RequestDetailsHandler.js:36+`): `requestData` (header-keyed `Initial Requests` row + merged HR title / IT assets) and `checklist[]` with `{name, status, by, time, target, tid?}` — specialist rows only for categories in `SPECIALIST_CATS` (`Safety, Finance, Business Cards, Fleet, 30/60/90 Review, JR Title, Purchasing, IT Confirmation, WIS` + legacy names, :150-156). Adds `employeeId` from the registry.
- `ActionItemService.getPendingTasks(wf)` / `getTask(tid)` (not exposed as aliases; reachable via `efxRunAs` only if added to `FormContracts.CALLABLE`).
