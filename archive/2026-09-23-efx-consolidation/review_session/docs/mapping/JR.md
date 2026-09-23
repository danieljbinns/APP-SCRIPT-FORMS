# JR Title action item — end to end

## 1. Where it is created

`ITSetupHandler.js` → `triggerSpecialists(workflowId, itData)` :449-639, called only from `submitITSetup` on a **first-time** (insert-path) IT Setup for a non-`CHANGE_` workflow (:316-323). `context = getWorkflowContext(workflowId)` (:461) supplies `plan306090` from `Initial Requests` col 47 (`EmailUtils.js`, `String(row[SCHEMA.INITIAL_REQUESTS.PLAN_306090])`).

```js
// ITSetupHandler.js:519-541
if (context.plan306090 === 'Yes' && !workflowId.startsWith('EQUIP_REQ_')) {
  specialists.push({ email: CONFIG.EMAILS.REVIEW_306090_JR, category: '30/60/90 Review', name: '30/60/90 Review Plan — ' + context.employeeName,
                     description: JSON.stringify(['Create 30/60/90 day review plan','Schedule review meetings with manager']), formType: 'review_306090' });
  specialists.push({ email: CONFIG.EMAILS.REVIEW_JR_TITLE, category: 'JR Title', name: 'JR Assignment — ' + context.employeeName,
                     description: JSON.stringify(['Verify and assign JR title']), formType: 'jr_title' });
}
```

| Attribute | Value | Source |
|---|---|---|
| Condition | `Initial Requests.30/60/90 === 'Yes'` (exact string) **and** workflowId not `EQUIP_REQ_` (so `NEW_EMP_` only in practice) | :520 |
| **Not** conditioned on | `jrRequired` / `jrAssignment` (cols 45/46) — a request with `jrRequired=No` but `plan306090=Yes` still gets a JR task | — |
| Category | `JR Title` | :534 |
| Task Name | `JR Assignment — <First Last>` (em dash) — comment :535: subject must contain "JR Assignment" for George's Gmail trigger | :535 |
| Description (checklist JSON) | `["Verify and assign JR title"]` | :536-538 |
| Assigned To | `CONFIG.EMAILS.REVIEW_JR_TITLE` = Script Property `EMAIL_REVIEW_JR_TITLE` or `grp.forms.jrtitle@team-group.com` (`Config.js:101`) | :533 |
| formType | `jr_title` | :539 |
| Task ID | `TK-XXXXXXXX` (`ActionItemService.js:85`) | |
| Idempotency at creation | `createActionItem` returns the existing **Open** task with same workflowId+category+formType (`ActionItemService.js:64-83`) | |
| Sheet row | `Action Items`: `[wf, TK-, 'JR Title', name, description, assignee, 'Open', created, '', '', '', '', 'jr_title', '']` (`ActionItemService.js:86-101`) | |
| Created together with | the `30/60/90 Review` task (`review_306090` → `grp.forms.review306090`), plus whatever else the request needs (Finance, Business Cards, Fleet, Purchasing, WIS) | :480-600 |
| Workflow step at creation | `Specialist Forms Needed` (`ITSetupHandler.js:321`) | |

### Notification email (`ITSetupHandler.js:617-636`)

One email per assignee address. For `grp.forms.jrtitle` it is normally the only item, so:

| To | Raw subject | Final subject (`buildEmailSubject`) | Body |
|---|---|---|---|
| `grp.forms.jrtitle@team-group.com` | `<name> Required` → `JR Assignment — <Name> Required` | `[New Hire | <Hourly|Salary>[ | EXPEDITE]] JR Assignment — <Name> Required: <Name> | <Site> | Start Date: yyyy-MM-dd | Manager: <email>` | "You have been assigned the following onboarding action item(s) for **<Name>**…" with a red button per item → `?form=action_item_view&tid=TK-…` (`buildFormUrl`, :622). `contextData = specContext` (credentials stripped :468-475). |

If several items go to the same address the subject becomes `Action Items Assigned — <Name> (N tasks)` (:629). George's n8n Gmail trigger regexes the `tid=TK-…` out of the button link (`jrCompleteViaSecret` comment, `ActionItemService.js:1131-1133`).

The JR title the new hire was requested with is `Initial Requests.JR Assign` (col 46, `jrAssignment`), possibly overwritten by HR at HR Verification (`HRVerificationHandler.js:162`) and stored as `"Job Title / JR Title"` in `HR Verification Results` col 7; `getWorkflowContext().jrTitle` returns the HR-verified value when present (`EmailUtils.js` AUGMENT 1).

## 2. Is it blocking?

`checkWorkflowCompletion` (`ActionItemService.js:534-603`): for `NEW_EMP_` at step `Specialist Forms Needed`, only categories in `getRequiredSpecialistCats` block (:469-492). That set contains `'30/60/90 Review'` when col 47 is `Yes` and **does not contain `'JR Title'`** → the JR task is **non-blocking**: the workflow can reach `Complete` with the JR task still Open. Closing it late still runs the normal close side-effects, but `checkWorkflowCompletion` early-returns if the workflow is already `Complete`/`Cancelled` (:537-541).

## 3. How it is closed today

### 3a. Human — `ActionItemForm.html`
`?form=action_item_view&tid=TK-…` → `ActionItemService.serveActionItem` (`ActionItemService.js:928-936`). "Mark Task Finalized" → `finalComplete()` → `google.script.run.closeActionItemWithNotes(taskId, notes, JSON.stringify(taskDraft), collectFormData())` (`ActionItemForm.html:398-465`) → `ActionItemService.closeActionItem(taskId, notes, Actor.email(), draftJSON, formDataJSON)` (`ActionItemService.js:972-974`).

### 3b. Automation (live prod @76) — `Router.js doPost` → `jrCompleteViaSecret`
```
POST <anon deployment>/exec   body: { "secret": "<PORTAL_SHARED_SECRET>", "action": "completeJrTitle", "workflowId": "TK-… | NEW_EMP_…", "itemName": "…", "comments": "…" }
```
`Router.js:137-160`: parses body (or `?secret=`), compares `secret !== expected` (plain string compare), only action `completeJrTitle`, requires `workflowId`, default comments `'JR title verified & assigned via n8n (<itemName>)'`, returns `ContentService` JSON `{success, message, taskId?}` (always HTTP 200; Apps Script 302-redirects the POST).

`jrCompleteViaSecret(idOrWorkflow, comments)` (`ActionItemService.js:1127-1167`): `CLOSED_BY='JR Automation (n8n)'`; if the id starts with `TK-` match `Task ID`, else match `Workflow ID`; **requires `Form Type === 'jr_title'` and `Status === 'Open'`** (:1142); builds a draft marking every non-`__` checklist item `Complete` with `by: CLOSED_BY`; calls `ActionItemService.closeActionItem(taskId, comments, CLOSED_BY, draftJSON, null)`; adds `taskId` to the result. Not found → `{success:false, message:'No open JR Title task found for task|workflow …'}` — which is also what an **already-closed** task returns (no distinction).

Other closers (Execution API, require a Google session): `completeMyTask(taskId, comments)` :1006-1074 (jr_title only; auth ladder direct/admin/`JR_TASK_CLOSERS`/group) and `completeJrTitleForWorkflow(workflowId, comments)` :1087-1113.

### 3c. NEW — `n8n_closeJrTask` (EFX fork)

`N8n.js:155-166`:
```js
function n8n_closeJrTask(actor, idOrWorkflow, notes) {
  p = idOrWorkflow startsWith 'TK-' ? { taskId } : { workflowId, formType:'jr_title' };
  p.notes = notes || 'JR title verified & assigned via n8n';
  r = efxTaskClose(JSON.stringify(n8nActor_(actor)), p, false);
  return r.code ? n8nErr_(r.code, r.message) : n8nOk_(r);
}
```
→ `efxTaskClose(actorJson, p, dryRun)` (`EfxApi.js:84-129`):
1. Validates `taskId` or `workflowId+formType` (`E_VALIDATION`).
2. Scans `Action Items`: by `taskId` → first row match; by `workflowId+formType` → first **Open** row, remembering any closed row.
3. `E_ALREADY_CLOSED` when only closed rows match (:103) or the matched task is `Closed` (:105); `E_NOT_FOUND` otherwise (:104).
4. `by = actor.email || actor.display || actor.id || 'automation'` (:108) — this becomes `Closed By`, unlike the fixed `'JR Automation (n8n)'` label of `doPost`.
5. Builds the draft: every string item not starting `__` → `{status:'Complete' (or p.checklist[item].status), by, at, comments: p.checklist[item].comments || p.notes}` (:110-117). Note the draft shape is a **flat object** `{ "<item>": {...} }` exactly like `jrCompleteViaSecret`/`completeMyTask`, not the UI's `{items:{…}}` (see `ACTION_ITEMS.md` §4).
6. `dryRun` → `{dryRun:true, taskId, workflowId, wouldClose:true, draft}` (:119). (`n8n_closeJrTask` always passes `false`; use `n8n_closeTask` with `dryRun:true` for a preview.)
7. `Actor.run(actor, () => ActionItemService.closeActionItem(taskId, notes, by, JSON.stringify(draft), formDataJSON|null))` (:121-123).
8. Maps `success:false` + `/already/i` → `E_ALREADY_CLOSED` (:124), other failures → `E_UPSTREAM`.
9. Success → `{ taskId, workflowId, success:true }` wrapped as `{ ok:true, apiVersion, requestId, result }`.

No secret is involved — auth is the Execution API caller identity plus the `actor` envelope; `n8n_closeJrTask` performs **no** assignee/allow-list check (same trust level as `doPost`).

| | `doPost completeJrTitle` (today) | `n8n_closeJrTask` (new) |
|---|---|---|
| Transport | HTTP POST, anon deployment, body secret | Execution API `scripts.run` (needs OAuth in the script's GCP project) |
| Input | `workflowId` (TK- or NEW_EMP_) | `idOrWorkflow` (same rule), `notes` |
| Closed By | `'JR Automation (n8n)'` | actor email/display/id |
| Raw Log | none | none for the close itself (closeActionItem does not rawLog); Actor attribution on any nested writes |
| Already closed | `success:false, 'No open JR Title task found…'` | `ok:false, error.code='E_ALREADY_CLOSED'` — treat as success |
| Not found | same message as above | `E_NOT_FOUND` |
| Wrong formType | not found | with `TK-`: closes **whatever task that id is** (no `jr_title` check); with workflowId: filtered to `jr_title` |

## 4. What `closeActionItem` does (`ActionItemService.js:155-360`)

1. Reads the whole `Action Items` sheet; finds the row by `Task ID` (throws `'Task not found: …'` if absent → `{success:false}`).
2. **Double-submit guard**: if `Status === 'Closed'` → `{success:false, message:'This task has already been submitted.'}` (:179-183) — this is what `efxTaskClose` maps to `E_ALREADY_CLOSED`.
3. Writes `Status='Closed'`, `Completed Date=now`, `Notes`, `Closed By` (:186-189); `Draft` if `draftJSON` given (:192-194); `Form Data` if `formDataJSON` given (:197-199).
4. Special case 1 (:201-258): `CHANGE_` + category `IT` + formType `it_setup` + formDataJSON → append a 23-col `IT Results` row from the IT Setup keys. **Not applicable to JR.**
5. Special case 2 (:260-311): `EQUIP_REQ_` + category `ID Setup` + formDataJSON with `siteDocsUsername`/`bossWisCreated` → write/update `ID Setup Results`. Not applicable.
6. Special case 3 (:313-341): `CHANGE_` + category `ID Setup` + formType `boss_wis_update` → `launchWisAssignment(workflowId)` (creates the manager's `WIS`/`wis_assignment` task). Not applicable.
7. `SpreadsheetApp.flush()` (:345).
8. **`notifyTaskClosure(taskId, notes, closedBy)`** (:350, defined :608-704): loads task + workflow + `getWorkflowContext`; builds `subject = 'Task Completed: <TaskName minus " — <Employee>">'` and a body with Task / Completed By / Closure Notes / Employee… **and then sends nothing for non-`Assets` categories** — the generic `sendFormEmail` is absent; only `Category === 'Assets'` triggers emails (`Assets Returned: IT Equipment|Credit Card|Vehicle and Keys` to IT/Credit Card/Fleetio, :629-699). So closing the JR task sends **no email** by itself.
9. **`checkWorkflowCompletion(workflowId)`** (:353, defined :534-603): skipped if workflow `Complete`/`Cancelled`; runs only at steps `Specialist Forms Needed` / `Action Items Pending`; for onboarding counts only Open items whose category is in `getRequiredSpecialistCats` (JR Title is not); `WIS`/`Manager` categories never block. When nothing blocks: `updateWorkflow(wf, 'Complete', 'All Action Items Closed')`, `syncWorkflowState`, `notifyWorkflowClosure(wf)` (:752-923) → `Workflow Completed: <Workflow Name> (<wf>)` emails to `CONFIG.EMAILS.HR` and to Initiator + Manager, with `showPasswords:true, allComplete:true` and an audit table of all tasks (incl. the JR row with its `Closed By`).
10. Returns `{ success:true }`.

Nothing in the JR close path writes the JR title anywhere — the title itself lives in `Initial Requests.JR Assign` / `HR Verification Results.Verified JR Title` (and is back-written by the 30/60/90 specialist form, `Specialist.js:117-139`). If George's automation wants to record the title it assigned, pass it in `n8n_closeTask({taskId, formData:{jrTitle:'…'}})` → stored in `Action Items.Form Data` (col 13) only.

## 5. Error codes (EFX)

| Code | When | n8n handling |
|---|---|---|
| `E_VALIDATION` | no id given (`N8n.js:157`), or neither taskId nor workflowId+formType (`EfxApi.js:87`) | bug in caller |
| `E_NOT_FOUND` | no row for `TK-…`; or no open **and** no closed `jr_title` row for the workflow | JR task was never created (`plan306090 !== 'Yes'`, or IT Setup not yet submitted) — check `n8n_listTasks({workflowId, formType:'jr_title'})` |
| `E_ALREADY_CLOSED` | matched row(s) already `Closed`, or `closeActionItem` returned "already been submitted" | **treat as success** (idempotent retry) |
| `E_UPSTREAM` | `closeActionItem` threw/returned other failure | retry later; inspect `error.message` |
| `E_INTERNAL` | uncaught exception in the alias | alert |

Idempotency: the first call closes; every subsequent call for the same task/workflow returns `E_ALREADY_CLOSED` (both the `efxTaskClose` pre-scan and the `closeActionItem` guard). There is no idempotency key — the natural key is the task. A concurrent double-call can pass the pre-scan twice; the second then hits the `closeActionItem` guard because the sheet re-read happens inside it (still `E_ALREADY_CLOSED`).

## 6. Related tasks George also sees

- `30/60/90 Review` / `review_306090` → `grp.forms.review306090` (dan.anger, george.anthony, jaynepalmer per spec `08` §1) — created in the same `if` (:521-530); **blocking**. Legacy `Review306090.html` specialist form (`?form=specialist&dept=review`) back-writes `jrTitle` to HR Verification Results (`Specialist.js:117-139`); the generic close does not.
- Subject filter for the Gmail trigger: the button label/name is `JR Assignment — <Name>`; the canonical subject string always contains `JR Assignment — <Name> Required` unless batched with another item for the same address (then `Action Items Assigned — <Name> (N tasks)`), which cannot happen for `grp.forms.jrtitle` unless `EMAIL_REVIEW_JR_TITLE` is pointed at an address that also receives another specialist item.
