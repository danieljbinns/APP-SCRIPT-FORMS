# Cookbook for George — building automations with the EFX kit

Practical recipes for the n8n side. You do not need to read Apps Script or open a spreadsheet. Every recipe names the
exact wrapper file in `n8n/` and the exact `n8n_*` function it calls, and uses only field names and values that exist in
`docs/N8N_CONTRACTS.md`.

Read first (once): [FOR_GEORGE.md](FOR_GEORGE.md) (what you can call), [`n8n/README.md`](../../n8n/README.md) (import
order, placeholders). Background if you want it: [HOW_IT_WORKS.md](HOW_IT_WORKS.md), [FAQ.md](FAQ.md). On-call fixes:
[RUNBOOKS.md](RUNBOOKS.md).

> **Status (2026-09-23):** live in **production**. Recipes still show the TEST names; on prod use the `(PROD)` wrappers listed here. The portal runs the EFX code (deployment v78) and these wrappers are callable by id with no allow-list: Get Workflow `A7nqVbqn19kzaSfi`, List Tasks `5HoAXNxCWVF6wtYx`, Close Task `C4oJSaevEqMvSCZe`, Submit ID Setup `P3HiVnzoxaRYYTZN`, Close JR Task `zxaTLTTNK28LpnNg`. Current instructions: `docs/efx/handoff/HANDOFF.md` (human) and `AGENT.md` (agent). Other wrappers exist on TEST only until asked for.

---

## 1. Mental model — one page

### The shape of every automation

```
your trigger  ─▶  a wrapper sub-workflow (n8n/1x_*.json)  ─▶  00_EFX_Router  ─▶  Forms does the rest
(Gmail, schedule,    you map 3 kinds of input:                 (Google login,      (writes the sheets, advances
 events poller,      actor · data/params · options)             validation,         the step, creates tasks,
 webhook, manual)                                               error shaping)      sends the templated emails)
```

**What you never have to touch:** Google Sheets nodes on the Forms spreadsheet, email templates, the Execution API URL,
the service-account credential, secrets, Apps Script code. If a recipe seems to need one of those, stop and ask (§5).

### The three kinds of input every wrapper takes

| Kind | What it is | Where it comes from |
|---|---|---|
| **actor** | Who is acting, for attribution: `{ "id": "n8n:<workflow-slug>", "email": "efx-bot@team-group.com", "display": "<label> (n8n)" }` | Always the bot address. Expression that works in every wrapper call: `{{ { id: 'n8n:' + $workflow.name, email: 'efx-bot@team-group.com', display: $workflow.name + ' (n8n)' } }}` |
| **data / params** | The wrapper's typed inputs (e.g. `firstName`, `workflowId`, `decision`). The wrapper turns them into the alias arguments. | Your trigger's output, mapped field by field |
| **options** | Behaviour switches: `idempotencyKey` (retry replays the first result for 10 min), `treatAlreadyClosedAsSuccess` (closers, default `true`), `includeRecord` (create/submit wrappers), `allowUnverified` (only for unverified forms — see §3), `dryRun` (where supported — see §3) | Set once per node |

**Authorization is not attribution.** Role checks inside Forms (HR / IT / Admin / requester / manager) run against the
*real* login, which is the impersonated `efx-bot@team-group.com`. Your `actor.email` is written to *Submitted By* /
*Closed By* / the Raw Log and grants nothing. If a wrapper says "HR/Admin principal", efx-bot must be in that
`grp.forms.*` group on that tier, otherwise you get `E_FORBIDDEN` or `E_UPSTREAM: Access denied.` (§4).

### What comes back

- **Success:** the alias result **flattened** onto the item, plus `ok:true`, `fn`, `requestId`, `apiVersion`, `tookMs`
  (and `record` / `employeeId` when the alias adds them). Quote `requestId` when asking for help.
- **Failure:** the node **throws** with a message that starts `EFX <CODE>: …` (e.g. `EFX E_NOT_FOUND: …`). Attach an
  *error output* or the error workflow (`Error Notifications - Global Handler`) to the calling node. Do not build
  "retry until 200" loops around the Router.
- **Exception:** re-closing a closed task comes back as `{ ok:true, alreadyClosed:true }` unless you set
  `treatAlreadyClosedAsSuccess:false`.

### The stability rule

Additions never break you. New optional fields and new aliases can appear at any time; renames or removals get a
deprecation window and a version bump. If something looks different, call the Router directly with `fn: "n8n_info"`
(`args: []`) — the result carries `apiVersion` (today `2026.09.17-1`) and the alias list; `fn: "n8n_contracts"` gives
every form's `required` / `optional` / enums / `hash`. Compare with your mapping, fix, done.

### Triggers you can use

| Trigger | Use it for | Notes |
|---|---|---|
| **Gmail** (your current JR pattern) | Anything with a fixed Forms subject: `ID Setup Required`, `JR Assignment — <Name> Required`, `HR Approval Required`, `Termination Approved`, `Safety Onboarding Required — <Name>`, `IT Setup Required`, `Status Change Approved` | The Gmail credential's owner must be a member/delegate of the `grp.forms.*` inbox. Fragile to template edits. |
| **`20_Forms_EventsPoller.json`** (schedule, every minute) | Anything keyed off a Forms submit. Routes by `source` (`submitInitialRequest`, `submitEmployeeIDSetup`, `submitHRVerification`, `submitITSetup`, …) and `kind` (`submit` = the payload as posted; `result` = post-write, carries `workflowId`, `internalEmployeeId`) | The "Initial Request" and "ID Setup" outputs fire on `kind:'result'`. Replace the NoOp placeholders with your flow. Cursor persists only while the workflow is **active**. |
| **Schedule** | Digests, reminders, check-ins | Read-only aliases (`n8n_listTasks`, `n8n_listWorkflows`) are always safe to re-run |
| **Webhook / manual** | Your BOSS chain (`boss-assign`), approval links, tests | Same as today |

### Ids you will see

`NEW_EMP_…` / `EQUIP_REQ_…` / `TERM_…` / `CHANGE_…` = workflow ids · `TK-XXXXXXXX` = action item (task) id ·
`30412`-style numbers = Internal Employee ID · `EVT-…` = event id (polling cursor) · `REQ-…` = request id in every
response. Full table in [FOR_GEORGE.md §10](FOR_GEORGE.md#10-quick-reference--ids-you-will-see).

---

## 2. Recipes

Each recipe: goal · trigger · wrappers in order · the inputs the wrapper needs (minimal, valid) · what Forms does ·
how to check · common errors. Values such as `Aurora`, `INDIRECT - Aurora`, `Site Supervisor` are the TEST sheet's
reference values used by `n8n/90_EFX_E2E_Test.json`; on another tier use that tier's site / job / JR lists
(`n8n_contracts` marks them `reference.sites`, `reference.jobNumbers`, `reference.jrs`).

### Recipe index

| # | Recipe | Wrapper file(s) → alias |
|---|---|---|
| R1 | [JR close — replace the `doPost` node](#r1-jr-close--replace-the-dopost-node) | `12_Forms_CloseJrTask.json` → `n8n_closeJrTask` |
| R2 | [New Hire (Initial Request) from an approved email](#r2-new-hire-initial-request-from-an-approved-email) | `10_Forms_CreateInitialRequest.json` → `n8n_createInitialRequest` |
| R3 | [Onboarding: SiteDocs + Litmos accounts → ID Setup](#r3-onboarding-sitedocs--litmos-accounts--id-setup-reference-flow-40) | `20` poller → `11_Forms_SubmitIdSetup.json` → `n8n_submitIdSetup` (reference `40_Ref_Onboarding_via_EFX.json`) |
| R4 | [Safety training assignment after Initial Request](#r4-safety-training-assignment-after-initial-request) | `15_Forms_ListTasks.json` → `13_Forms_AssignSafetyTraining.json` → `n8n_assignSafetyTraining` |
| R5 | [30/60/90 follow-up](#r5-306090-follow-up) | `15` → `16_Forms_CloseTask.json` → `n8n_closeTask`; `25_Forms_ListWorkflows.json` + `26_Forms_GetContext.json` |
| R6 | [Reminders / open-task digest](#r6-reminders--open-task-digest-reference-flow-41) | `41_Ref_OpenTasks_Digest.json` (uses `15`); `27_Forms_WorkflowActions.json` → `n8n_bumpWorkflow` |
| R7 | [Termination request + HR approval](#r7-termination-request--hr-approval) | `18_Forms_CreateTerminationRequest.json` → `19_Forms_SubmitTerminationApproval.json` |
| R8 | [Hire-date change / cancel / bump](#r8-hire-date-change--cancel--bump) | `27_Forms_WorkflowActions.json` → `n8n_updateHireDate` / `n8n_cancelWorkflow` / `n8n_bumpWorkflow` |
| R9 | [Position change + approval](#r9-position-change--approval) | `21_Forms_CreatePositionChangeRequest.json` → `22_Forms_SubmitPositionChangeApproval.json` |
| R10 | [Reading context for an email you compose yourself](#r10-reading-context-for-an-email-you-compose-yourself) | `26_Forms_GetContext.json` → `n8n_getContext`; `14_Forms_GetWorkflow.json`; `15_Forms_ListTasks.json` |

---

### R1. JR close — replace the `doPost` node

**Goal.** Close the `jr_title` action item from your BOSS chain through the Router instead of posting a secret to the
`doPost` web app (@76).

**Trigger.** Unchanged: your `boss-assign` webhook in `BOSS JR Assignment (COPY - PROD portal)` (`J7RU99n01pq9Xk3D`).
Only the last hop changes.

**Wrapper.** `n8n/12_Forms_CloseJrTask.json` → `n8n_closeJrTask(actor, idOrWorkflow, notes)`.
A paste-ready node is in `n8n/snippets/George_MarkPortalJrComplete_replacement.json` (step list in
[`n8n/README.md` → "George: replacing Mark Portal JR Complete"](../../n8n/README.md)).

**Inputs.**
```json
{
  "idOrWorkflow": "{{ $('Find Row by Employee').first().json.portalTicketId }}",
  "notes": "JR title assigned in BOSS via n8n — job {{ $('Assign JR in BOSS').first().json.jobId }}, user {{ $('Assign JR in BOSS').first().json.userId }}",
  "actor": { "id": "n8n:boss-jr-assignment", "email": "efx-bot@team-group.com", "display": "BOSS JR Assignment (n8n)" },
  "idempotencyKey": "jr-close-{{ $('Find Row by Employee').first().json.portalTicketId }}-{{ $execution.id }}",
  "treatAlreadyClosedAsSuccess": true
}
```
`idOrWorkflow` is a `TK-…` task id (tracker column K) **or** a `NEW_EMP_…` workflow id — with a workflow id the alias
finds the single open `jr_title` task itself. Wire the node on the **BOSS-success** path
(`Apply Duty Changes → Forms · Close JR Task (EFX) → Confirm to George`), error output → `Email George — Error`.

**What Forms does.** Same as a human pressing *Complete*: `Action Items` row → `Closed`, checklist item
"Verify and assign JR title" → Complete, `Closed By` = `efx-bot@team-group.com` (was `JR Automation (n8n)` with
`doPost`). Closing the JR task sends **no email by itself**. JR is non-blocking, so this alone does not complete the
workflow; if it happens to be the last blocking item, Forms sends `Workflow Completed: …` to HR, requester and manager.

**Check.** `15_Forms_ListTasks.json` with `taskId` = the TK- id → `status: "Closed"`, `closedBy` = efx-bot. Or
`14_Forms_GetWorkflow.json` → the `JR Title` checklist row is `Complete`.

**Errors.**

| You see | Meaning |
|---|---|
| `EFX E_NOT_FOUND` | The `jr_title` task does not exist yet — it is created at **IT Setup** (and only when the request had `plan306090 = Yes`). Check with `15` (`formType: "jr_title"`). |
| `ok:true, alreadyClosed:true` | Already closed (human, earlier run, or `doPost` during the overlap week). Treat as success. |
| `EFX E_TASK_NOT_OPEN` | The workflow was **cancelled**; its tasks are Cancelled, not closable. |
| `EFX E_VALIDATION` | `idOrWorkflow` empty. |

**Cutover rule.** Run the Router node *and* the old `doPost` node in series for a week, then disable `doPost`, then
delete it — gates and dates in [`CUTOVER_PLAN_JR.md`](../plans/CUTOVER_PLAN_JR.md). Do not import prod-tier copies of
`00`/`12` until gate G4 there is green.

---

### R2. New Hire (Initial Request) from an approved email

**Goal.** A manager emails a hire request; a human approves it in n8n; n8n submits the Initial Request so Forms
mints the workflow id and the Internal Employee ID and emails the ID Setup team.

**Trigger.** Gmail trigger on the request mailbox → parse the fields → **approval gate first**: send the approver a
link, wait for the click, then continue. Use the same pattern as your `JR Approval — Manager Response Handler`
(`KFzI1VJBU01axjTb`: token in the link, webhook receives the response). Nothing is written to Forms until the approval
comes back.

**Wrapper.** `n8n/10_Forms_CreateInitialRequest.json` → `n8n_createInitialRequest(actor, data, include)`.

**Inputs (minimal valid `new_hire`).**
```json
{
  "firstName": "Ada",
  "lastName": "Lovelace",
  "hireDate": "2026-10-05",
  "requesterEmail": "<the person who asked for the hire>",
  "reportingManagerName": "<manager name>",
  "reportingManagerEmail": "<manager email>",
  "positionTitle": "Site Supervisor",
  "siteName": "Aurora",
  "jobSiteNumber": "INDIRECT - Aurora",
  "employmentType": "Hourly",
  "employeeType": "Direct Hire",
  "newHireOrRehire": "New Hire",
  "systemAccess": "No",
  "actor": { "id": "n8n:hire-request-intake", "email": "efx-bot@team-group.com", "display": "Hire request intake (n8n)" },
  "idempotencyKey": "hire-{{ $execution.id }}"
}
```
Enums: `employmentType` `Hourly|Salary` · `employeeType` `Direct Hire|Agency` · `newHireOrRehire` `New Hire|Rehire` ·
`systemAccess` `Yes|No`. Optional inputs exposed on the wrapper: `requesterName dateRequested systems[] equipment[]
plan306090 jrRequired jrAssignment comments`; anything else from the contract's optional list goes in `extra` as an
object. Two gotchas from the contract notes: **(1)** if `systemAccess` is `No`, send no `systems` / `equipment`
(the UI clears them); **(2)** no string may start with `=`, `+`, `-` or `@` (formula guard) — a comment beginning
with a dash fails the whole submit. `plan306090: "Yes"` is what later creates the `review_306090` and `jr_title`
tasks at IT Setup.

**What Forms does.** Writes `Workflows`, `Employee IDs` (Internal Employee ID minted now), `Initial Requests`, a
Raw Log `result` event (source `submitInitialRequest`). Step → *ID Setup Needed*. Emails **`ID Setup Required`** to
`grp.forms.idsetup` and **`Request Submitted`** to `requesterEmail`. No action items yet (unless the Forms setting
`SAFETY_TRAINING_AT_SUBMIT` is on — then a `safety_onboarding` task is created too). Returns `workflowId`, `formId`,
`internalEmployeeId`, `message`.

**Check.** The response has a 5-digit `internalEmployeeId`. `14_Forms_GetWorkflow.json` shows checklist "Initial
Request" Complete, "ID Setup" Pending. `20_Forms_EventsPoller` shows a `result` event for the new `workflowId`.

**Errors.**

| You see | Meaning |
|---|---|
| `EFX E_VALIDATION … missing required field(s)` | One of the 13 required keys is empty. |
| `EFX E_VALIDATION … unknown field(s) (not in contract)` | A key that is not in `new_hire` (typo, or wrong form). Run `n8n_contracts`. |
| `EFX E_VALIDATION … must be one of` | Enum value wrong (`Hourly` not `hourly`). |
| `EFX E_UPSTREAM: Missing required fields…` / formula-guard message | Forms' own validator rejected it — message names the field. Nothing was written. |
| Two workflows for one hire | You ran twice more than 30 s apart. Always send `idempotencyKey`; gate on your approval token. |

---

### R3. Onboarding: SiteDocs + Litmos accounts → ID Setup (reference flow `40`)

**Goal.** For every new hourly hire: create the SiteDocs worker and the Litmos (DSS) user, then complete the ID Setup
step in Forms with the resulting ids — the blocker in your draft ("the employee number isn't in the email") is gone
because `internalEmployeeId` is in the event.

**Trigger.** `20_Forms_EventsPoller.json` → output **"On Initial Request Submitted"** (`source: submitInitialRequest`,
`kind: result`). The item carries `workflowId`, `internalEmployeeId`, and `payload.employmentType`, `employeeName`,
`siteName`, `positionTitle`, `hireDate`, `managerEmail`, `requesterEmail`, `systems`. Filter `Hourly` with
`{{ $json.payload.employmentType === 'Hourly' }}`.

**Wrappers in order.** Your SiteDocs and Litmos HTTP nodes (kept exactly as in `mw4aXq7lq5W1EQBy`) →
`n8n/11_Forms_SubmitIdSetup.json` → `n8n_submitIdSetup(actor, data, include)`. The complete worked example is
`n8n/40_Ref_Onboarding_via_EFX.json` (inactive, staging only): `Every minute → Load cursor → Router: n8n_events →
Normalise event → Hourly? → Map title codes → SiteDocs: Create Worker → Litmos: Find Manager → Resolve Manager ID →
Build DSS user + password → Litmos: Create User → Forms · Submit ID Setup → Done`.

**Inputs (`id_setup`).**
```json
{
  "workflowId": "{{ $json.workflowId }}",
  "siteDocsWorkerId": "{{ $('SiteDocs: Create Worker').item.json.id }}",
  "siteDocsJobCode": "Hourly 1",
  "dssUsername": "{{ $json.dssUsername }}",
  "dssPassword": "{{ $json.dssPassword }}",
  "setupNotes": "Accounts created by n8n",
  "actor": { "id": "n8n:onboarding-hourly", "email": "efx-bot@team-group.com", "display": "Onboarding hourly (n8n)" },
  "idempotencyKey": "idsetup-{{ $json.workflowId }}"
}
```
`siteDocsJobCode` must be one of Forms' own codes `Hourly 1 | Hourly 2 | Salary 1 | Salary 2 | Supervisor | Manager` —
**not** your SiteDocs title codes (`HRLY-U`, `Site-Sup – Union`). The `Map title codes` node in `40` derives both.
**Never send `internalEmployeeId`** — Forms uses the one minted at submit; a different value is refused. Optional:
`siteDocsUsername`, `siteDocsPassword` (the UI requires them only when the request's Systems contains `SiteDocs`),
`bossWisCreated` `Yes|No`, `siteDocsBadgeCreated` `Yes|No`. Generate `dssPassword` per run; it lands in Forms exactly
as the UI stores it and in your execution data — consider *Settings → Save execution data* on the calling workflow.

**What Forms does.** Appends `ID Setup Results` (every submit **appends**; do not submit twice). Step → *HR
Verification Needed*. Emails: if the hire is `Hourly` **and** `systemAccess = No` → **`Credentials Ready`** to
requester + manager (contains the DSS/SiteDocs credentials) and **`HR Verification Required`** to HR + Payroll, and the
`safety_onboarding` task is created for `grp.forms.safety`; otherwise **`HR Verification Required`** only. A Raw Log
`result` event (source `submitEmployeeIDSetup`) follows. No Gmail node needed on your side.

**Check.** `14_Forms_GetWorkflow.json` → checklist "ID Setup" Complete, current step *HR Verification Needed*;
`employeeId.internalEmployeeId` matches the event. Or watch the poller's "On ID Setup Submitted" output.

**Errors.**

| You see | Meaning |
|---|---|
| `EFX E_VALIDATION: siteDocsJobCode must be one of …` | You passed a SiteDocs title code. Map it first. |
| `EFX E_UPSTREAM: Internal Employee ID is pre-assigned (…) and cannot be changed here.` | You sent `internalEmployeeId`. Remove it. |
| `EFX E_UPSTREAM: Could not fetch request data…` | Wrong `workflowId` (or it is not a `NEW_EMP_` id). |
| Step already *HR Verification Needed* before you ran | Someone submitted ID Setup by hand. Check `14` first; a second submit appends a duplicate row. |
| Nothing arrives at the poller | Workflow not **active** (cursor does not persist on manual runs), or `<<ROUTER_WORKFLOW_ID>>` not replaced. |

---

### R4. Safety training assignment after Initial Request

**Goal.** Assign SiteDocs locations and DSS learning paths for the new hire, then close the Safety Onboarding task with
the confirmations — instead of `grp.forms.safety` doing it by hand.

**When does the task exist?** This is the one timing trap. The `safety_onboarding` task is created:
- at **Initial Request submit** only if the Forms setting `SAFETY_TRAINING_AT_SUBMIT` is on (default **off** — ask us
  before relying on it);
- otherwise at **ID Setup** for `Hourly` + `systemAccess = No` hires, or **after HR Verification** for everyone else.

So "after Initial Request" in practice means: react to the Initial Request event, do the SiteDocs/DSS work, then
**wait until the task exists** before closing it.

**Trigger.** `20_Forms_EventsPoller.json` "On Initial Request Submitted" for the employee data (as in R3), then either
the poller's "On ID Setup Submitted" / "On HR Verification Submitted" outputs, or a Gmail trigger on
`Safety Onboarding Required — <Name>` (credential must be able to read `grp.forms.safety`), to know the task exists.

**Wrappers in order.**
1. `n8n/15_Forms_ListTasks.json` → `n8n_listTasks(actor, filter)` with
   `{ "workflowId": "{{ $json.workflowId }}", "formType": "safety_onboarding", "status": "Open" }` → `count` is 0
   (not yet) or 1 (go).
2. Your SiteDocs / Litmos assignment nodes.
3. `n8n/13_Forms_AssignSafetyTraining.json` → `n8n_assignSafetyTraining(actor, workflowId, details)`.

**Inputs.**
```json
{
  "workflowId": "{{ $json.workflowId }}",
  "siteDocsConfirmed": "Yes",
  "dssConfirmed": "Yes",
  "notes": "SiteDocs locations + DSS learning paths assigned via n8n",
  "dryRun": true,
  "actor": { "id": "n8n:safety-training", "email": "efx-bot@team-group.com", "display": "Safety training (n8n)" },
  "treatAlreadyClosedAsSuccess": true
}
```
Run with `dryRun: true` first — it resolves the task and returns `wouldClose: true` and the `draft` without writing.
Then set `dryRun` to `false`. Both confirmations must be `Yes`; a `No` is refused with `E_VALIDATION` unless you call
the Router directly with `force: true` inside `details` (recorded in the notes) — don't, unless we agreed.

**What Forms does.** Closes the task: checklist items "Assign SiteDocs locations for employee" and "Assign DSS
learning paths" → Complete, `Closed By` = efx-bot, `formData { siteDocsConfirmed, dssConfirmed, source:'n8n' }`
stored on the task. No email for the close itself. **Safety is a blocking task**, so if it was the last one open at
step *Specialist Forms Needed*, the workflow completes and Forms emails `Workflow Completed: …` to HR, requester and
manager.

**Check.** `15` with the same filter → `count: 0` Open; or with `status: "Closed"` → the task with `closedBy`.

**Errors.**

| You see | Meaning |
|---|---|
| `EFX E_NOT_FOUND` | Task not created yet (see timing above). Wait for the next step event / retry later — this is expected, not a fault. |
| `EFX E_VALIDATION: Both siteDocsConfirmed and dssConfirmed must be "Yes"…` | You sent a `No`. |
| `ok:true, alreadyClosed:true` | Safety team beat you to it. Success. |
| Two `safety_onboarding` tasks on one workflow | Only possible with `SAFETY_TRAINING_AT_SUBMIT` on and the first task already closed before HR Verification. Close by `workflowId + formType` (targets the open one). |

---

### R5. 30/60/90 follow-up

Two different things carry this name. Both are read/close through the same wrappers.

#### R5a. Prepare and close the `review_306090` action item

**Goal.** When the "30/60/90 Review Plan" task is created, copy the review-plan template, share it with the manager,
put the 30/60/90-day meetings in the calendar, and close the task with the document link.

**Trigger.** `20_Forms_EventsPoller.json` output **"On IT Setup Submitted"** (`source: submitITSetup`) — the
`review_306090` and `jr_title` tasks are created at IT Setup when the request had `plan306090 = Yes`. Alternatively the
Gmail subject `30/60/90 Review Plan — <Name> Required` on `grp.forms.review306090`.

**Wrappers in order.**
1. `n8n/15_Forms_ListTasks.json` → `{ "workflowId": "…", "formType": "review_306090", "status": "Open" }` → take
   `tasks[0].taskId`.
2. `n8n/26_Forms_GetContext.json` → `n8n_getContext(actor, workflowId)` for `employeeName`, `hireDate`, `managerEmail`,
   `managerName`, `jobTitle`, `jrTitle` (R10).
3. Your Google Docs / Drive / Calendar nodes.
4. `n8n/16_Forms_CloseTask.json` → `n8n_closeTask(actor, params)`.

**Inputs for step 4.**
```json
{
  "taskId": "{{ $('Forms · List Tasks').first().json.tasks[0].taskId }}",
  "notes": "30/60/90 plan created and meetings scheduled via n8n",
  "formData": { "documentLink": "{{ $('Copy template').first().json.webViewLink }}", "jrTitle": "{{ $('Forms · Get Context').first().json.jrTitle }}" },
  "dryRun": true,
  "actor": { "id": "n8n:review-306090", "email": "efx-bot@team-group.com", "display": "30/60/90 review (n8n)" },
  "idempotencyKey": "review-{{ $json.workflowId }}"
}
```
Omit `checklist` → every item ("Create 30/60/90 day review plan", "Schedule review meetings with manager") is marked
Complete. `formData` is stored on the task (`Action Items` → Form Data) and nowhere else — closing this way does **not**
write the JR title back to HR Verification Results the way the legacy specialist page did. If that matters, tell us (§5).

**What Forms does.** Task → Closed, `Closed By` = efx-bot. `30/60/90 Review` **is blocking** — if it was the last
blocking item the workflow completes and `Workflow Completed: …` goes to HR, requester and manager.

**Check.** `15` with `status: "Closed"`; `14_Forms_GetWorkflow.json` checklist row `30/60/90 Review` Complete.

**Errors.** `E_NOT_FOUND` → task not created (IT Setup not yet submitted, or `plan306090` was not `Yes`);
`alreadyClosed:true` → a reviewer closed it; `E_TASK_NOT_OPEN` → workflow cancelled.

#### R5b. Milestone check-in emails (your `Employee Onboarding Milestone Check-In Automation`, without the tracker sheet)

**Trigger.** Schedule, daily 09:00.

**Wrappers.** `n8n/25_Forms_ListWorkflows.json` → `n8n_listWorkflows(actor, filter)` with
`{ "type": "Onboarding", "since": "{{ $now.minus({days: 120}).toISODate() }}", "limit": 500 }` → *Split Out* on
`workflows` → per item `n8n/26_Forms_GetContext.json` → `n8n_getContext(actor, workflowId)` → compute days since
`hireDate` → IF 30/60/90 → your Gmail node to the employee and `managerEmail`.

**Notes.** `type` accepts `Onboarding | End of Employment | Status Change | Equipment` or an id prefix (`NEW_EMP_`).
`n8n_listWorkflows` returns every `Dashboard_View` column keyed by its header; use `n8n_getContext` for the fields you
rely on (`hireDate`, `managerEmail`, `employeeName`) rather than guessing header names. This is read-only — safe to run
as often as you like. Keep your Gmail node on a `recipientOverride` (as in `41`) until HR approves recipients.

---

### R6. Reminders / open-task digest (reference flow `41`)

**Goal.** Every weekday morning, one email per assignee listing their open Forms action items, in your CCF-reminder
style; optionally nudge a stuck workflow.

**Trigger.** Schedule — weekdays 08:00 (as shipped in `n8n/41_Ref_OpenTasks_Digest.json`).

**Wrappers.** `41` calls `n8n/15_Forms_ListTasks.json` → `n8n_listTasks(actor, { "status": "Open" })` → `Group by
Assigned To` → `Build Email Content` → `Send Reminder Email`. Add `formType` (e.g. `jr_title`) to digest one kind
only. *Workflow Configuration* holds `recipientOverride` (ships as `dbinns@team-group.com`; subject prefixed
`[TEST → <assignee>]`), `ccList`, `minTasks`, `portalUrl` (`<<PORTAL_EXEC_URL>>` for deep links).

**Inputs.** None beyond the configuration node. Each task item has `taskId, workflowId, category, name,
description[], assignedTo, status, createdDate, completedDate, notes, closedBy, formType, draft` — `41` computes
`ageDays` from `createdDate`.

**Optional nudge.** For a workflow whose *step* (not a task) is stuck, `n8n/27_Forms_WorkflowActions.json` with
`{ "action": "bump", "workflowId": "…" }` → `n8n_bumpWorkflow(actor, workflowId, targetStep?)` re-sends Forms' own
reminder email for the current step. Forms rate-limits it: `EFX E_RATE_LIMITED` means "already sent recently" —
retry another day, it is not an outage.

**What Forms does.** Nothing for the digest (read-only). For `bump`: sends the step's reminder email, writes the
`Audit Log`.

**Check.** The digest email arrives at `recipientOverride`. For `bump`: `ok:true`.

**Errors.** `E_RATE_LIMITED` (bump too soon), `E_FORBIDDEN` (efx-bot lacks the role for bump), `E_NOT_FOUND`
(unknown workflow id). An empty filter on `15` returns *every* action item — always pass `status`.

---

### R7. Termination request + HR approval

**Goal.** Create an End-of-Employment request from a structured source (form, email, sheet), route it to HR for a
decision in n8n, and record the decision in Forms so the offboarding tasks are created.

**Trigger.** Whatever produces the request data (Gmail, webhook, your form). The HR **approval gate stays in n8n**
(token link → webhook, like `KFzI1VJBU01axjTb`) — Forms is only told the final decision.

**Wrappers in order.**
1. `n8n/18_Forms_CreateTerminationRequest.json` → `n8n_createTerminationRequest(actor, data, options)`.
2. (human approval in n8n)
3. `n8n/19_Forms_SubmitTerminationApproval.json` → `n8n_submitTerminationApproval(actor, {workflowId, decision, notes}, options)`.

**Inputs for step 1 (minimal valid `termination_request`).**
```json
{
  "reqName": "<requester name>",
  "reqEmail": "<requester email>",
  "empName": "Ada Lovelace",
  "empType": "Hourly",
  "siteName": "Aurora",
  "termDate": "2026-10-31",
  "lastDayWorked": "2026-10-31",
  "reason": "Resigned",
  "managerName": "<manager name>",
  "managerEmail": "<manager email>",
  "has_reports": "No",
  "actor": { "id": "n8n:termination-intake", "email": "efx-bot@team-group.com", "display": "Termination intake (n8n)" },
  "idempotencyKey": "term-{{ $execution.id }}"
}
```
Enums: `empType` `Hourly|Salary` · `reason` `Deceased | End of contract | Resigned | Retired | Terminated` ·
`has_reports` `Yes|No` · `google_duration` `Default 1 Month then delete | Longer (Specify in notes) | Delete Immediately (No forwarding/access)`.
Conditionals the wrapper enforces: `hr_approved` when `reason = Terminated`; `reports_to_new` when `has_reports = Yes`;
the `google_*` fields when `systems` contains `Google Account`. `systems[]` and `equip[]` are sent to Forms
comma-joined (UI shape); values: `systems` ⊂ `ADP Supervisor Access, BOSS, CAA, Delivery, Google Account, Incidents,
Fleetio, Central Purchasing/Jonas`; `equip` ⊂ `Computer/Laptop, Mobile Phone, Tablet, Credit Card, Vehicle and Keys,
Building Access Card/Keys`.

**Inputs for step 3.**
```json
{
  "workflowId": "{{ $('Forms · Create Termination Request').first().json.workflowId }}",
  "decision": "Approved",
  "notes": "Approved by {{ $json.approverEmail }} via n8n on {{ $now.toISODate() }}",
  "actor": { "id": "n8n:termination-approval", "email": "efx-bot@team-group.com", "display": "Termination approval (n8n)" }
}
```
`decision` `Approved|Rejected`. **efx-bot must be in `grp.forms.hr` (or `CONFIG.ADMIN_EMAILS`) on that tier** — ask
us before wiring this (§5).

**What Forms does.** Step 1: `Terminations` row, `TERM_…` workflow, step → *HR Approval Needed*; emails
**`HR Approval Required`** to HR and **`Termination Submitted — Pending HR Approval`** to Payroll. Step 3, Approved:
`Termination Approval Results` row, step → *Action Items Pending*, action items created and emailed — always
`Employee Deactivation - <Name>` (SiteDocs / DSS / BOSS WIS removal → `grp.forms.idsetup`) and `Complete EOE Process -
<Name>` (HR); conditional `IT Systems Deactivation`, `HR Systems Deactivation`, `ADP Deactivation`, `Fleet Systems
Deactivation`, `Central Purchasing/Jonas Deactivation`, `Asset Collection Checklist`; emails `… Action Required`,
`Employee Deactivation Required`, `EOE Process Required`, `FYI — Employee Offboarding` (Safety), `Termination Approved`
(requester, manager, Payroll). Rejected: status *Rejected by HR*, `Termination Rejected` to requester + manager.
Duplicate approval = `ok:true` with "Approval already processed…" and no side effects.

**Closing the offboarding tasks later.** Termination action items have **no `formType`**, so they can only be closed by
`taskId`: `15_Forms_ListTasks.json` `{ "workflowId": "TERM_…", "status": "Open" }` → pick by `category` (`IT`, `HR`,
`Payroll`, `Fleet`, `Purchasing`, `Deactivation`, `EOE`, `Assets`) → `16_Forms_CloseTask.json` `{ "taskId": "TK-…" }`.
Anything that suspends or deletes a Google account needs an explicit human approval gate in your flow first.

**Check.** `14_Forms_GetWorkflow.json` works for `TERM_` ids → status, step, checklist. `15` lists the created tasks.

**Errors.**

| You see | Meaning |
|---|---|
| `EFX E_VALIDATION … hr_approved` / `reports_to_new` / `google_*` | A conditional field is missing for the values you sent. |
| `EFX E_UPSTREAM: Access denied.` or `EFX E_FORBIDDEN` (step 3) | efx-bot is not HR/Admin on this tier. Group change needed (§5). |
| `EFX E_NOT_FOUND` (step 3) | Wrong `workflowId`. |
| `ok:true, message: "Approval already processed…"` | Someone approved first. Fine. |

---

### R8. Hire-date change / cancel / bump

**Goal.** Keep Forms in step with the outside world: a start date moved, a hire fell through, or a step needs a nudge.

**Trigger.** Gmail (manager writes in), your own form/webhook, or manual — with a human confirmation for `cancel`.

**Wrapper.** `n8n/27_Forms_WorkflowActions.json` — one node, `action` picks the alias:

| `action` | Alias | Extra input | Who may (real login = efx-bot) |
|---|---|---|---|
| `updateHireDate` | `n8n_updateHireDate(actor, workflowId, 'yyyy-MM-dd')` | `newDate` | HR / IT / Admin |
| `cancel` | `n8n_cancelWorkflow(actor, workflowId)` | — | HR / IT / Admin / requester / manager |
| `bump` | `n8n_bumpWorkflow(actor, workflowId, targetStep?)` | `targetStep` (optional) | rate-limited by Forms |

**Inputs.**
```json
{ "action": "updateHireDate", "workflowId": "NEW_EMP_20260916-141501_123", "newDate": "2026-10-12",
  "actor": { "id": "n8n:workflow-actions", "email": "efx-bot@team-group.com", "display": "Workflow actions (n8n)" } }
```
```json
{ "action": "cancel", "workflowId": "NEW_EMP_20260916-141501_123",
  "actor": { "id": "n8n:workflow-actions", "email": "efx-bot@team-group.com", "display": "Workflow actions (n8n)" } }
```
```json
{ "action": "bump", "workflowId": "NEW_EMP_20260916-141501_123",
  "actor": { "id": "n8n:workflow-actions", "email": "efx-bot@team-group.com", "display": "Workflow actions (n8n)" } }
```

**What Forms does.** `updateHireDate`: changes the hire date, writes the `Audit Log`. `cancel`: workflow → Cancelled,
its open tasks → **Cancelled** (a later close returns `E_TASK_NOT_OPEN`), audited. `bump`: re-sends the current step's
reminder email (or `targetStep`'s).

**Check.** `14_Forms_GetWorkflow.json` → status / hire date; for cancel, `15` shows no Open tasks for the workflow.

**Errors.** `E_FORBIDDEN` (efx-bot lacks the role — the requester/manager rule is about the *login*, not your
`actor`), `E_RATE_LIMITED` (bump, retry later), `E_VALIDATION: newDate (yyyy-MM-dd) is required`,
`E_VALIDATION: action must be cancel | bump | updateHireDate`, `E_NOT_FOUND`.

---

### R9. Position change + approval

**Goal.** Submit a Status / Position / Site change request and, after HR decides in n8n, record the approval so Forms
creates the change action items.

**Trigger.** Your intake (Gmail / form / webhook) → HR approval gate in n8n → decision.

**Wrappers in order.**
1. `n8n/21_Forms_CreatePositionChangeRequest.json` → `n8n_createPositionChangeRequest(actor, data, options)`.
2. (human approval in n8n)
3. `n8n/22_Forms_SubmitPositionChangeApproval.json` → `n8n_submitPositionChangeApproval(actor, {workflowId, decision, notes, confirmedTitle, confirmedNewManager, confirmedJrTitle}, options)`.

**Inputs for step 1 (minimal valid `position_change_request` + a title change).**
```json
{
  "firstName": "Ada",
  "lastName": "Lovelace",
  "currentClass": "Hourly",
  "effDate": "2026-11-01",
  "siteName": "Aurora",
  "changeType": ["Position Change"],
  "titleOld": "Site Supervisor",
  "titleNew": "Site Manager",
  "reqName": "<requester name>",
  "reqEmail": "<requester email>",
  "actor": { "id": "n8n:position-change-intake", "email": "efx-bot@team-group.com", "display": "Position change intake (n8n)" },
  "idempotencyKey": "change-{{ $execution.id }}"
}
```
Enums: `currentClass` / `classOld` / `classNew` `Hourly|Salary`; `changeType` ⊂ `Site Transfer, Position Change,
Classification, Manager Change`; `jrTitle` from `reference.jrs`. Keys are the raw HTML names (`siteOld/siteNew`,
`mgrOldEmail/mgrNewEmail`, `sys[]`, `equip[]`, `rem[]`, `equipRem[]`). Send `adpSalaryAccess` and `creditCardUSA /
creditCardCanada / creditCardHomeDepot` as plain strings `"Yes"` or `""` (the UI sends arrays; Forms stores them
fragile). If `reqEmail` is blank Forms records the login (efx-bot) as requester — send the real one.

**Inputs for step 3.**
```json
{
  "workflowId": "{{ $('Forms · Create Position Change Request').first().json.workflowId }}",
  "decision": "Approved",
  "confirmedTitle": "Site Manager",
  "confirmedNewManager": "<new manager email, if the manager changes>",
  "notes": "Approved via n8n",
  "actor": { "id": "n8n:position-change-approval", "email": "efx-bot@team-group.com", "display": "Position change approval (n8n)" }
}
```
`decision` `Approved|Rejected`; `confirmedJrTitle` is used in the email only (not stored). **efx-bot must be HR/Admin on
that tier.** Known Forms quirk: the approval looks for a change type called `Reporting Manager Change`, which the form
never sends (`Manager Change`) — for a manager change always pass `confirmedNewManager` so the receiving manager is
resolved.

**What Forms does.** Step 1: `Position Changes` row, `CHANGE_…` workflow, step → *HR Approval Needed*; emails the HR
approval link, a Payroll notice and the current manager. Step 3, Approved: `Position Change Approval Result` row,
step → *Action Items Pending*; tasks always created: `BOSS WIS User Account Update` (`boss_wis_update` →
`grp.forms.idsetup`; closing it makes Forms create the manager's `BOSS WIS Module Assignment` task), `Safety System
Updates` (`safety_change` → Safety), `ADP Update Required — <Name>` (`adp_update` → HR + Payroll); conditional:
`Incoming Transfer Setup` (receiving manager), `Business Cards Order`, `Credit Card Order`, `Fleetio Access Update /
Removal`, `Vehicle Return`, `Central Purchasing/Jonas Update`, `IT Access & Equipment Setup` (`it_setup` — closed by
IT via the IT Setup form, not by you), `Asset Collection — <Name>`, `SiteDocs Access Removal` (`safety_change`),
`SiteDocs Account Setup`. Email **`Status Change Approved`** to requester + new manager. Rejected → *Rejected by HR*,
`Status Change Rejected`. Duplicate approval = success, no side effects.

**Check.** `14_Forms_GetWorkflow.json` with the `CHANGE_` id; `15_Forms_ListTasks.json` `{ "workflowId": "CHANGE_…",
"status": "Open" }`. Status Change can create **two** `fleetio` items and several `ID Setup`-category items — close
those by `taskId`, not by `formType`.

**Errors.** `E_VALIDATION` (`currentClass` enum, missing required, unknown key), `E_UPSTREAM: Access denied.` /
`E_FORBIDDEN` (approval without HR role), `E_NOT_FOUND`, `E_UPSTREAM` with a manager name/email pairing message
(Forms requires both name and email when either manager email is given).

---

### R10. Reading context for an email you compose yourself

**Goal.** Send your own Gmail (BOSS confirmation, manager heads-up, CCF-style notice) with the right names, dates and
ids — without a Sheets node on the Forms spreadsheet.

**Trigger.** Any.

**Wrappers.** Pick the read that matches what you need:

| Need | Wrapper → alias | Inputs | Gives you |
|---|---|---|---|
| The fields the Forms emails themselves use | `n8n/26_Forms_GetContext.json` → `n8n_getContext(actor, workflowId)` | `workflowId` | Merged request + step results + tasks, JSON-safe, **credentials redacted**: e.g. `employeeName`, `hireDate`, `managerName`, `managerEmail`, `siteName`, `jobSiteNumber`, `jobTitle`, `jrTitle` (HR-verified when present), `systems`, `equipment`, `preassignedEmployeeId`, `internalEmployeeId` (after ID Setup) |
| Status, step, checklist, Internal Employee ID | `n8n/14_Forms_GetWorkflow.json` → `n8n_getWorkflow(actor, workflowId)` | `workflowId` (`NEW_EMP_` / `TERM_` / `CHANGE_` / `EQUIP_REQ_`) | `status`, `checklist[] { name, status (Pending|Complete|N/A), by, time, tid? }`, request snapshot, `employeeId { internalEmployeeId, allocatedAt, allocatedBy, source }` |
| Only the Internal Employee ID | call `00_EFX_Router.json` directly: `fn: "n8n_getEmployeeId"`, `args: ["NEW_EMP_…"]` | — | `{ internalEmployeeId, workflowId, employeeName, allocatedAt, allocatedBy, source }` |
| A person's or group's open tasks | `n8n/15_Forms_ListTasks.json` → `n8n_listTasks(actor, filter)` | `assignedTo`, `status`, `formType`, `workflowId`, `taskId` | `tasks[]`, `count` |
| Many workflows at once | `n8n/25_Forms_ListWorkflows.json` → `n8n_listWorkflows(actor, filter)` | `type status step since employeeName limit offset` | `workflows[]`, `count`, `total` |

**Inputs (Get Context).**
```json
{ "workflowId": "{{ $json.workflowId }}",
  "actor": { "id": "n8n:my-notice", "email": "efx-bot@team-group.com", "display": "My notice (n8n)" } }
```

**What Forms does.** Nothing — reads never write, never email. Safe to retry.

**Two rules for your own email node.** (1) Forms' `EMAIL_REDIRECT_ALL` on TEST redirects *Forms'* emails, **not**
yours — keep a `recipientOverride` (as in `41`) until recipients are approved. (2) Passwords are redacted in
`n8n_getContext` / `n8n_events` on purpose; do not try to obtain them another way.

**Errors.** `E_NOT_FOUND` (unknown id), `E_VALIDATION: workflowId is required`.

---

## 3. Testing safely

| Rule | How |
|---|---|
| **Know which tier you are on before every mutating run** | Call `00_EFX_Router.json` with `fn: "n8n_ping"`, `args: []`. The result has `env`, `spreadsheetId`, `apiVersion`, `libraryVersion`, `deploymentUrl`. Assert them in an IF node before any create/submit/close (the canary does exactly this). The fork's `Config.js` reports `env: "TEST"`; the prod sheet id starts `1kGjw8e…` — if you ever see it from a non-prod Router, **stop** and tell us. |
| **`dryRun` where it exists** | `16_Forms_CloseTask.json` (`n8n_closeTask`) and `13_Forms_AssignSafetyTraining.json` (`n8n_assignSafetyTraining`) accept `dryRun: true` → they resolve the task and return `wouldClose: true` + the `draft`, writing nothing. **`n8n_closeJrTask` has no `dryRun`** — to preview a JR close use `16` with `{ "workflowId": "NEW_EMP_…", "formType": "jr_title", "dryRun": true }` (this is what `90_EFX_E2E_Test` step 7b does), then run `12` for real. Creates and step submits have no dry run: they run for real, on TEST. |
| **`allowUnverified` means "I accept a contract we have not checked"** | Only two forms are `verified:false`: `it_confirmation` and `specialist`. Calling them returns `E_UNVERIFIED_FORM` unless you pass `allowUnverified: true`. Do not — both have known Forms bugs (`n8n/README.md`, `docs/N8N_CONTRACTS.md`); use `n8n_closeTask` / `n8n_assignSafetyTraining` instead, or ask (§5). |
| **Canary** | `n8n/30_EFX_Canary.json`: every 15 min `n8n_ping` → asserts `env === <<EXPECTED_ENV>>` and `spreadsheetId === <<EXPECTED_SHEET_ID>>` → Gmail alert to dbinns on failure. Imported **inactive**; activate after replacing placeholders. One per tier. If the canary is red, assume every wrapper on that tier is broken. |
| **End-to-end check** | `n8n/90_EFX_E2E_Test.json` (manual) runs ping → contracts → create Initial Request → ID Setup → list tasks → dry-run closes → events against the **TEST** script with PASS/FAIL per step. Run it after any import or credential change. It leaves a `NEW_EMP_` "EFX Test Hire…" on the TEST sheet — we clean those; you never delete rows. |
| **Emails on TEST** | The TEST script has `EMAIL_REDIRECT_ALL = dbinns@team-group.com`, so every Forms email lands in one inbox with a `[TEST]` marker. Your own Gmail nodes are **not** covered — use a `recipientOverride`. If a real group ever receives a test email, stop and tell us. |
| **Data on TEST** | Fake names only (`Ada Lovelace`, `EFX Test Hire…`), the TEST sheet's reference sites. Never a real person's details. |
| **Retries** | Always send `idempotencyKey` on mutating calls (`wfrun-{{ $execution.id }}-{{ $node.name }}` or a per-workflow key). Read-only aliases are always safe to retry; mutating ones only when the error table says so. |
| **Passwords in execution data** | `11` (`dssPassword`) and `23` (`Email_Temp_Password`) carry passwords through n8n. Set *Settings → Save execution data* accordingly on the calling workflow. |
| **Static data** | The poller/canary cursors and the Router's idempotency cache live in workflow static data, which persists **only for active-workflow executions**. A manual run of `20` always reads the last 24 h and does not move the cursor. |
| **Never point a wrapper at PROD until the cutover plan says so** | Prod copies of `00_EFX_Router` / `12_Forms_CloseJrTask` (credential `EFX Google SA (PROD)`, prod script id) are created **only** as step 1 of [`CUTOVER_PLAN_JR.md`](../plans/CUTOVER_PLAN_JR.md), after gates G1–G6 (TEST green, dev green, prod Forms has the alias layer, prod GCP door + 24 h green canary, you available, rollback export taken). Until then every Router on staging n8n targets TEST. Build on TEST, then move — never edit a workflow in place to switch tiers. |

---

## 4. Troubleshooting — every error code

The Router throws `EFX <CODE>: <message> [fn=…, requestId=…]`. Branch on the code with a regex `^EFX (E_[A-Z_]+):` in
your error workflow. Codes as listed in [`n8n/README.md`](../../n8n/README.md):

| Code | Plain-English cause | Fix | Retry? |
|---|---|---|---|
| `E_TRANSPORT` | The call never reached a working Forms function: HTTP/auth problem, non-JSON body (login page), Execution API `done:false`, or `<<EFX_SCRIPT_ID>>` still a placeholder. | Check the `EFX Google SA (<<TIER>>)` credential (impersonates `efx-bot@team-group.com`), that the script is linked to the SA's GCP project, that an API-executable deployment exists, that the script id was replaced. Usually ours to fix — send the `requestId`/message. | After the fix |
| `E_SCRIPT` | The Apps Script function itself threw (message + stack in the error). | Forms bug or a deployment that lags the code. Tell us. | No |
| `E_VALIDATION` | Your payload failed the contract: missing required field, unknown key, enum value wrong, bad arguments (`fields[]` in the message says which). Nothing was written. | Fix the mapping; compare with `n8n_contracts`. | No |
| `E_UNVERIFIED_FORM` | You called a form whose contract is `verified:false` (`it_confirmation`, `specialist`). | Use the supported alias instead, or ask us. `allowUnverified: true` overrides — don't without agreement. | No |
| `E_UNKNOWN_FORM` | The form name does not exist in the contracts (generic `n8n_createWorkflow` / `n8n_submitForm` with a typo). | Fix the name: `new_hire | equipment_request | termination_request | position_change_request` for creates; `id_setup | hr_verification | it_setup | termination_approval | position_change_approval` for submits. | No |
| `E_FORBIDDEN` | The real login (efx-bot) lacks the role the handler requires (HR / IT / Admin / requester / manager). Your `actor` cannot fix this. | Ask us to add efx-bot to the right `grp.forms.*` group on that tier (§5). | After the group change |
| `E_NOT_FOUND` | No such workflow, or no **open** task of that `formType` for that workflow. | Check the id. For `jr_title` / `review_306090`: created at IT Setup only. For `safety_onboarding`: see R4 timing. | No (wait for the creating step) |
| `E_ALREADY_CLOSED` | Task already Closed. **Passes through as `{ ok:true, alreadyClosed:true }`** unless `treatAlreadyClosedAsSuccess: false`. | Nothing — treat as success. If it happens on the first attempt, check `closedBy` in `15`. | n/a |
| `E_TASK_NOT_OPEN` | The task is **Cancelled** (its workflow was cancelled), not merely closed. | Nothing to do on Forms; stop your chain for that workflow. | No |
| `E_RATE_LIMITED` | `bump` reminder was sent too recently. | Retry later (next day). Not an outage. | **Yes, later** |
| `E_UPSTREAM` | Forms' own handler returned `success:false`; its human-readable message is passed through (e.g. `Access denied.`, `Internal Employee ID is pre-assigned (…) and cannot be changed here.`, `Missing required fields: …`). | Read the message — it is written for a person. Data/state problem, or a role problem (then see `E_FORBIDDEN`). | Depends on the message |
| `E_INTERNAL` | Unexpected exception inside the alias layer (bug, quota, sheet/tab missing). | Send us the `requestId`. | Once, after a minute; then stop |

Not codes, but you will see them:

| Symptom | Meaning |
|---|---|
| `ok:true` but no email arrived | On TEST all Forms email goes to dbinns (`EMAIL_REDIRECT_ALL`). Closing a task sends no email by itself (only `Assets` closures and workflow completion do). |
| Item has `idempotentReplay: true` | Same `idempotencyKey` within 10 min — the Router replayed the cached result. |
| `pruned: true` from `n8n_events` | Your cursor aged out of the Raw Log window; `20` resets to the last 24 h automatically. RUNBOOKS §5. |
| `WARN` on approvals in `90_EFX_E2E_Test` | efx-bot is not HR/Admin on that tier — expected until the group membership exists. |

---

## 5. When to ask us (a Forms change is needed)

Open a short note to dbinns@team-group.com (or an issue in this repo) with: the step/task, the trigger, the fields you
can supply, and what should happen after. Include the alias name and a `requestId` if you have one. Anything below
needs a change on the Forms side — you cannot work around it from n8n, and please do not try via a Sheets node.

| You want to… | Why it is a Forms change |
|---|---|
| Send a **field that is not in the contract** (`E_VALIDATION unknown field`), or a form field you can see in the UI is missing from `n8n_contracts` | Contracts are strict on purpose; we add the field to `FormContracts.js`, run the tests, bump the contracts version. |
| Use a **new enum value** (a site, job number, JR title, reason, job code that is not in the list) | Reference lists live in the Forms sheet / `SchemaConstants`; the `siteDocsJobCode` list is hard-coded in the ID Setup page. |
| Drive a **new form or step** that has no wrapper (e.g. IT Confirmation, the legacy specialist pages), or automate a **task type with no `formType`** in a way that needs more than a plain close | We add or verify the contract, add an `n8n_*` alias, publish a wrapper JSON in `n8n/`, bump `N8N_API_VERSION`. |
| Call an approval, HR Verification, IT Setup, cancel, or hire-date alias and get **`E_FORBIDDEN` / `Access denied.`** | efx-bot needs membership in the matching `grp.forms.*` group (or `CONFIG.ADMIN_EMAILS`) on that tier — a Workspace/admin change, done by us. |
| Have the Safety task exist **at submit** (R4) | That is the Forms setting `SAFETY_TRAINING_AT_SUBMIT` (off by default). |
| Write the **JR title** back to HR Verification Results from an automated 30/60/90 close (R5a) | Only the legacy specialist page does that today; the generic close stores `formData` on the task only. |
| React to **task events** (`task.created`, `task.closed`) from the poller | Confirm with us that your tier's Forms build emits them before wiring the "Task events" output (see §6). |
| Read something that none of `n8n_getWorkflow` / `n8n_getContext` / `n8n_listTasks` / `n8n_listWorkflows` / `n8n_events` returns | Reads are cheap to add — ask rather than opening the sheet. |
| Change the **Internal Employee ID**, un-close a task, un-cancel a workflow, or delete a test row | No automation path exists (by design); admin action on our side. |
| Point anything at **prod** | Cutover plan gates, prod-tier credential and canary — ours to run with you (R1 cutover rule). |

---

## 6. Things the sources still disagree on (read before relying on them)

Flagged while writing this; we will resolve them and update the kit. Until then:

1. **`env` value on TEST.** The fork's `Config.js` sets `ENVIRONMENT = 'TEST'`, while `n8n/README.md` and the canary
   sticky say `<<EXPECTED_ENV>>` is `DEV | STAGING | PROD` (and `90_EFX_E2E_Test` says "e.g. DEV"). Use whatever
   `n8n_ping` actually returns on the tier you test against as the canary's expected value.
2. **Task events.** `20_Forms_EventsPoller.json` and `n8n/README.md` say `task.created` / `task.closed` are "not
   emitted by Forms yet"; `ALIASES_ADDED_2026-09-17.md` lists them as new, and the fork's `ActionItemService.js` does
   emit them. Verify on your tier with `n8n_events` before building on the "Task events" output.
3. **`dryRun` for JR.** Some notes mention dry-running `n8n_closeJrTask`; the alias has no `dryRun`. Use `n8n_closeTask`
   with `formType: "jr_title"` for the preview (§3).
4. **HR Verification contract.** `FOR_GEORGE.md §2` and the alias description say `verified:false`; the generated
   `docs/N8N_CONTRACTS.md` (r2) marks `hr_verification` **verified**. Trust `n8n_contracts` on the live tier.
5. **Termination action items and `formType`.** The candidates list (`spec/08`) suggests closing termination items by
   `formType`; the action-item map shows they have **no** `formType` — close them by `taskId` (R7).
6. **Error-code lists.** Resolved 2026-09-16 23:00: every table (`docs/N8N_CONTRACTS.md`, `n8n/README.md`, `FOR_GEORGE.md` §6, §4 above) is
   generated from `N8N_ERROR_CODES` in `N8n.js` (10 alias codes) plus the two Router-side codes `E_TRANSPORT` / `E_SCRIPT`.
