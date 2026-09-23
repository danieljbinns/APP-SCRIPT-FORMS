# Safety Onboarding — action item, triggers, legacy form, n8n alias

## 1. The action item (`sendSafetyOnboardingEmail`, `EmailUtils.js:1062-1112`)

```js
function sendSafetyOnboardingEmail(workflowId, requestData, setupData) {
  siteDocsJobCode = setupData.siteDocsJobCode || <ID Setup Results col 5 for wf>          // :1064-1072
  contextData = getWorkflowContext(workflowId) || {}; contextData.workflowType = 'New Hire'  // :1075-1076
  // fill employeeName/jobTitle(position)/siteName/hireDate from requestData when the sheet has none  :1078-1081
  tid = ActionItemService.createActionItem(workflowId, 'Safety', 'Safety Onboarding — ' + requestData.employeeName,
          JSON.stringify(['Assign SiteDocs locations for employee','Assign DSS learning paths']), CONFIG.EMAILS.SAFETY, 'safety_onboarding');  // :1084-1096
  sendFormEmail({ to: CONFIG.EMAILS.SAFETY, subject: 'Safety Onboarding Required — ' + requestData.employeeName,
          body: 'Please assign SiteDocs locations and DSS learning paths for this employee. Complete the action item using the button below.',
          formUrl: buildFormUrl('action_item_view', { tid }), displayName: 'TEAM Group - Employee Onboarding', contextData });     // :1098-1105
}
```

| Attribute | Value |
|---|---|
| Category | `Safety` |
| Task Name | `Safety Onboarding — <Employee Name>` |
| Description (checklist) | `["Assign SiteDocs locations for employee","Assign DSS learning paths"]` |
| Assigned To | `CONFIG.EMAILS.SAFETY` = Script Property `EMAIL_SAFETY` or `grp.forms.safety@team-group.com` (`Config.js:103`) |
| formType | `safety_onboarding` |
| Email subject (final) | `[New Hire | <Hourly|Salary>[ | EXPEDITE]] Safety Onboarding Required — <Name>: <Name> | <Site> | Start Date: yyyy-MM-dd | Manager: <email>` (the employee name appears twice because the raw subject already contains it and `buildEmailSubject` appends `: <employeeName>`, `EmailUtils.js:57`) |
| Button | `?form=action_item_view&tid=TK-…` |
| Blocking? | **Yes** — `getRequiredSpecialistCats` always adds `'Safety'` (`ActionItemService.js:486`), so an open Safety item blocks New Hire completion at step `Specialist Forms Needed`. |
| Errors | whole function is try/catch — failures only log (`:1109-1111`); `createActionItem` failure additionally emails admins via `notifyAdminActionItemFailure` (`ActionItemService.js:108`). |
| Idempotency | `createActionItem` returns the existing **Open** `Safety`/`safety_onboarding` task for the workflow instead of creating another (`ActionItemService.js:64-83`) — but the email is still re-sent. |

`requestData` fields used: `employeeName` (name + subject), `position` → `jobTitle`, `siteName`, `hireDate` — only as fallbacks when `getWorkflowContext` lacks them.

## 2. When it fires today (three call sites)

| # | Path | File:line | Condition | `requestData` passed | `setupData` |
|---|---|---|---|---|---|
| T1 | **ID Setup, hourly path** | `IDSetup.js:305-328` inside `triggerNextStepFromIDSetup` Branch A (`employmentType === 'Hourly' && systemAccess === 'No'`, :265) | only if **no `Action Items` row with `Category === 'Safety'` exists for the workflow** (scan :307-325, M-14 dedupe) | `getIDSetupRequestData(wf)` object (`employeeName, position, siteName, hireDate, …`) | the ID Setup `formData` (so `siteDocsJobCode` comes from the form) |
| T2 | **HR Verification, standard path** | `HRVerificationHandler.js:330-338` — the `else` branch of `if (employmentType === 'Hourly' && systemAccess === 'No')` (:262/:280), i.e. Salary, or Hourly with system access. Fires after the IT Setup / IT Confirmation email and the Payroll "HR Verified" email, regardless of BOSS routing. | **unconditional** (no dedupe scan here; relies on `createActionItem`'s Open-task guard) | `{ employeeName: verifiedName, position: formData.jobTitle, jrTitle, siteName: formData.siteName || context.siteName, hireDate: formData.hireDate || context.hireDate, employmentType, managerName }` | `null` → job code read from `ID Setup Results` |
| T3 | **EFX flagged — at New Hire submit** | `InitialRequestHandler.js:83-89` | `CONFIG.SAFETY_TRAINING_AT_SUBMIT` (Script Property `SAFETY_TRAINING_AT_SUBMIT === 'true'`, `Config.js:41-43`; setter `setSafetyTrainingAtSubmit(on)` `Setup.js:444`) — **default off** | `{ employeeName, position: positionTitle, siteName, hireDate }` from the submitted form | `{}` → job code lookup finds nothing yet → `''` |

Notes on T1/T2 interplay: a Hourly+No employee gets Safety at ID Setup (T1) and **not** at HR Verification (T2 is in the other branch). Everyone else gets it at HR Verification. Exactly one fires per workflow in legacy mode.

With T3 on:
- T1 is skipped by its own `Category === 'Safety'` scan (the submit-time item exists).
- T2 still calls `sendSafetyOnboardingEmail`; `createActionItem` returns the **existing Open task id** (idempotency guard) but the "Safety Onboarding Required" **email is sent a second time** (now with fuller context). If n8n has already closed the submit-time task (status `Closed`), the guard does not match and a **second Safety task is created** at HR Verification. Design consequence for George: with the flag on, expect a possible second `safety_onboarding` task per workflow; close by `workflowId+formType` (which targets the open one) or subscribe to `events` and close by `taskId`.
- Workflow step at T3 time is `ID Setup Needed`, so closing the item then does not trigger completion logic (`checkWorkflowCompletion` only acts at `Specialist Forms Needed`/`Action Items Pending`, `ActionItemService.js:561-565`).
- The T3 email goes out before ID Setup/HR, so the context block shows no ADP id / credentials; `siteDocsJobCode` is blank.

Not a Safety *onboarding* trigger but related: Termination approval sends an **FYI-only** email to `grp.forms.safety` (`FYI — Employee Offboarding: <Name>`, `TerminationHandler.js:390-401`) with no action item; Status Change approval creates `Safety`/`safety_change` "Safety System Updates" (`PositionChangeHandler.js:858-872`).

## 3. How it is closed

### 3a. Human — `ActionItemForm.html`
Generic checklist UI (no special `safety_onboarding` rendering): two rows with Pending/Complete buttons, comments, notes; "Mark Task Finalized" requires every item non-Pending (`ActionItemForm.html:398-410`) → `closeActionItemWithNotes(taskId, notes, JSON.stringify({items:{…}}), null)`. `notifyTaskClosure` sends nothing for `Safety` (only `Assets`), then `checkWorkflowCompletion` may complete the workflow and send `Workflow Completed: …` to HR + initiator + manager.

### 3b. NEW — `n8n_assignSafetyTraining(actor, workflowId, details)` (`N8n.js:173-190`)

```js
details = { siteDocsConfirmed:'Yes'|'No', dssConfirmed:'Yes'|'No', siteDocsNotes?, dssNotes?, notes?, dryRun? }
p = { workflowId, formType:'safety_onboarding',
      notes: details.notes || 'SiteDocs locations + DSS learning paths assigned via n8n',
      checklist: { 'Assign SiteDocs locations for employee': { status: siteDocsConfirmed==='No' ? 'Open' : 'Complete', comments: siteDocsNotes },
                   'Assign DSS learning paths':              { status: dssConfirmed==='No'      ? 'Open' : 'Complete', comments: dssNotes } },
      formData: { siteDocsConfirmed: siteDocsConfirmed||'Yes', dssConfirmed: dssConfirmed||'Yes', source:'n8n' } }
return efxTaskClose(actorJson, p, details.dryRun === true)
```

- Resolves the **open** `safety_onboarding` task for the workflow (whichever trigger created it); `E_ALREADY_CLOSED` if only closed ones exist; `E_NOT_FOUND` if none (e.g. legacy timing and HR Verification not yet done).
- **Caveat**: `efxTaskClose` always calls `closeActionItem` when not dry-run — a `'No'` confirmation only records `status:'Open'` in the draft item; the task is still **closed**. There is no partial-save path in the alias (use `saveActionItemDraft` via `efxRunAs` if a real partial is wanted).
- `formData` is stored in `Action Items.Form Data` (col 13). Nothing else reads `siteDocsConfirmed`/`dssConfirmed` (the legacy `Specialist Results` write is a different path, §5).
- `Closed By` = actor email/display/id. Side effects as in `JR.md` §4 (no task email; possible workflow completion + `Workflow Completed` emails).
- Response `{ ok, result:{ taskId, workflowId, success:true } }` or `{ ok:false, error:{code,message} }`; `dryRun:true` returns `{dryRun:true, taskId, workflowId, wouldClose:true, draft}`.

Generic alternative: `n8n_closeTask(actor, { taskId | workflowId+formType:'safety_onboarding', notes, checklist, formData })`.

## 4. Legacy specialist form — `SafetyOnboarding.html` (`?form=specialist&wf=…&dept=safety`)

Served by `serveSpecialist(workflowId, 'safety')` (`Specialist.js:6-56`, `deptMap['safety'] = 'SafetyOnboarding'`, :18). Route guard: `canAccessDashboard` only (`Router.js:66-70`). No email in the current code links to this page — everything points at `action_item_view`. It is reachable only by hand-built URL.

| Client `name=` (`SafetyOnboarding.html`) | Type | Required | Posted? |
|---|---|---|---|
| `workflowId` (hidden :31) | string | — | yes → `data.workflowId` (:84) |
| `formId` (hidden :32) | string | — | **not posted** |
| `department` (hidden :33, value `safety`) | string | — | yes → `data.department` |
| `siteDocsConfirmed` (:39 checkbox `true`) | bool | `required`; JS also blocks unless both checked (:78-81) | folded into `details` JSON |
| `dssConfirmed` (:47 checkbox `true`) | bool | `required` | folded into `details` |
| `notes` (:56 textarea) | string | — | yes → `data.notes` |

Payload (:83-88): `{ workflowId, department:'safety', details: JSON.stringify({siteDocsConfirmed:true, dssConfirmed:true}), notes }` → `submitSpecialistTask` (`SharedComponents.html:339-370`) → `google.script.run.submitSpecialistForm(data)`.

### `submitSpecialistForm` for `dept === 'safety'` (`Specialist.js:58-220`)
1. `rawLog('submitSpecialistForm', formData)` :60.
2. `formId = generateFormId('SPEC_SAFETY')` :63.
3. Sheet: `sheetMap.safety = CONFIG.SHEETS.SAFETY_ONBOARDING_RESULTS` — **that key no longer exists in `Config.SHEETS`** (`Config.js:74` comment "Safety Onboarding and Safety Termination removed"), so `sheetName` falls back to `'Specialist Results'` (:80). Sheet auto-created with headers `Workflow ID, Form ID, Submission Timestamp, Details, Notes, Submitted By` (:85-89).
4. Safety-specific row (:92-100): `[wf, formId, now, siteDocsConfirmed?'Yes':'No', dssConfirmed?'Yes':'No', notes, Actor.email()]` — **7 values under 6 headers** (`Details` column receives the SiteDocs flag, `Notes` receives the DSS flag, `Submitted By` receives the notes, and the actor lands in an unlabelled 7th column).
5. No requester email for `safety` (:144).
6. **Does not close the `Safety` action item and does not touch the workflow** — the task stays Open and blocking. Return `{success:true, message:'Specialist setup completed successfully'}`.

Conclusion: the legacy form is dead weight for automation; `FormContracts.specialist` stays `verified:false` with that note, and `n8n_assignSafetyTraining` is the supported path.

## 5. Where Safety data ends up (summary)

| Data | Location |
|---|---|
| Task + status + Closed By + notes | `Action Items` row (`Category=Safety`, `Form Type=safety_onboarding`) |
| Per-item status/comments/by/at | `Action Items.Draft` (col 11) — flat `{item:{…}}` from n8n, `{items:{item:{…}}}` from the UI |
| n8n confirmations | `Action Items.Form Data` (col 13) `{siteDocsConfirmed, dssConfirmed, source:'n8n'}` |
| Legacy form flags | `Specialist Results` (misaligned columns, §4) |
| Job code shown in the Safety email | `ID Setup Results.SiteDocs Job Code` (col 5) |
