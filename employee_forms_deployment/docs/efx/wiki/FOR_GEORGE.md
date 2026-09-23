# EFX for George — what n8n can do with Employee Forms

Plain-language guide. You do not need to read Apps Script. Everything you can call is listed here; everything
else in this repo is background.

> **Building something?** Go to [COOKBOOK_FOR_GEORGE.md](COOKBOOK_FOR_GEORGE.md) — step-by-step recipes (JR close,
> Initial Request from an approved email, SiteDocs + Litmos onboarding, safety training, 30/60/90, open-task digest,
> termination and position-change approvals, hire-date change / cancel / bump, reading context for your own emails),
> plus the testing rules and the full error-code table for the wrappers in `n8n/`.

> **Status (2026-09-23):** live in **production**. The functions below are deployed on the prod script. The portal runs the EFX code (deployment v78) and these wrappers are callable by id with no allow-list: Get Workflow `A7nqVbqn19kzaSfi`, List Tasks `5HoAXNxCWVF6wtYx`, Close Task `C4oJSaevEqMvSCZe`, Submit ID Setup `P3HiVnzoxaRYYTZN`, Close JR Task `zxaTLTTNK28LpnNg`. Current instructions: `docs/efx/handoff/HANDOFF.md` (human) and `AGENT.md` (agent). Other wrappers exist on TEST only until asked for.

---

## 1. The idea in three sentences

Employee Forms exposes a short list of **functions** (`n8n_…`). You call them through one shared **Router**
sub-workflow (later a node) that handles the Google login, picks the project, validates your fields, and gives
you back a tidy `{ ok, result }` or `{ ok:false, error:{ code, message } }`. Whatever you call does exactly what
a human clicking the same button would do — same sheets, same emails, same next step — so you never write to a
spreadsheet.

---

## 2. What you can call

`actor` is always the first argument (see §4). Objects can be passed as JSON strings or real objects.

| Alias | Purpose | Inputs (after `actor`) | Returns in `result` | Changes / emails |
|---|---|---|---|---|
| `n8n_ping()` | Health check. Use in a canary. | none | `{ env, spreadsheetId, libraryVersion, callerSession, apiVersion, deploymentUrl }` | none |
| `n8n_info()` | `ping` + list of aliases | none | ping fields + `aliases[]` | none |
| `n8n_contracts()` | Every form's fields: required, optional, types, enums, `verified`, `hash` | none | `{ apiVersion, contractsVersion, aliases[], forms[] }` | none |
| `n8n_getWorkflow(actor, workflowId)` | One request with its checklist | `workflowId` e.g. `NEW_EMP_20260916-141501_123` | `getRequestDetails` output: `requestData{…}`, `checklist[]`, status, step; plus `employeeId{ internalEmployeeId, allocatedAt, … }` | none |
| `n8n_getEmployeeId(actor, workflowId)` | The pre-assigned Internal Employee ID | `workflowId` | `{ internalEmployeeId \| null, workflowId, employeeName, allocatedAt, allocatedBy, source }` | none |
| `n8n_listTasks(actor, filter)` | Action items | `{ workflowId?, taskId?, formType?, status?:'Open'\|'Closed', assignedTo? }` | `{ tasks:[{ taskId, workflowId, category, name, description[], assignedTo, status, createdDate, completedDate, notes, closedBy, formType, draft }], count }` | none |
| `n8n_events(actor, params)` | Event feed from the Raw Log | `{ afterEventId?, afterTs?, kinds?:['submit','result'], sources?:['submitInitialRequest',…], limit? }` | `{ events:[{ eventId, ts, kind, source, workflowId, actor, payload }], nextAfterEventId, pruned }` | none |
| `n8n_createInitialRequest(actor, data, include?)` | **Start a New Hire** — the real `submitInitialRequest` | `data` = the New Hire form fields (contract `new_hire`); `include:['record']` to read the row back | `{ success, workflowId, formId, internalEmployeeId, message }` (+ `record`) | Writes `Workflows`, `Employee IDs`, `Initial Requests`; emails **"Request Submitted"** (requester/manager) and **"ID Setup Required"** (grp.forms.idsetup) |
| `n8n_submitIdSetup(actor, data, include?)` | **Complete the ID Setup step** — the real `submitEmployeeIDSetup` | `data` = contract `id_setup`: `workflowId, siteDocsWorkerId, siteDocsJobCode, dssUsername, dssPassword` (+ optional `siteDocsUsername, siteDocsPassword, setupNotes, bossWisCreated, siteDocsBadgeCreated`). **Omit `internalEmployeeId`** — the pre-assigned one is used | `{ success, message }` | Writes `ID Setup Results`; step → *HR Verification Needed*; emails **"HR Verification Required"** (grp.forms.hr), credentials email |
| `n8n_submitHrVerification(actor, data, include?)` | HR Verification step | contract `hr_verification` — verified (r2); wrapper `24_Forms_SubmitHrVerification` | `{ success, message }` | Writes `HR Verification Results`; emails IT Confirmation |
| `n8n_closeTask(actor, params)` | **Close any action item** exactly like the Complete button | `{ taskId }` **or** `{ workflowId, formType }` + optional `{ notes, checklist:{ '<item>':{ status, comments } }, formData:{…}, dryRun:true }` | `{ taskId, workflowId, success, … }` | Task → Closed, `Closed By` = your actor; closure emails; may write `IT Results`/`ID Setup Results` for some types; completes the workflow when it was the last open item |
| `n8n_closeJrTask(actor, idOrWorkflow, notes?)` | **JR** — drop-in for today's `doPost completeJrTitle` | `TK-…` task id **or** `NEW_EMP_…` workflow id; notes default `"JR title verified & assigned via n8n"` | `{ taskId, workflowId, success }` | Closes the `jr_title` task (all checklist items Complete); closure email |
| `n8n_assignSafetyTraining(actor, workflowId, details)` | Close the Safety Onboarding task with confirmations | `{ siteDocsConfirmed:'Yes'\|'No', dssConfirmed:'Yes'\|'No', notes?, siteDocsNotes?, dssNotes?, dryRun? }` | `{ taskId, workflowId, success }` | Closes `safety_onboarding`; items marked Complete unless `'No'`; `formData{siteDocsConfirmed, dssConfirmed, source:'n8n'}` |

The table above is the original 13. Since 2026-09-17 **every form has an alias** (27 in total): equipment / termination /
status-change creation, IT Setup, HR Verification, both approvals, cancel / bump / hire-date change, task drafts,
`n8n_listWorkflows`, `n8n_getContext`. Full table with the matching wrapper files: `n8n/README.md`; worked recipes:
`COOKBOOK_FOR_GEORGE.md`; what changed: `ALIASES_ADDED_2026-09-17.md`. Only `it_confirmation` and `specialist` remain
`verified:false` (reachable via the generic `n8n_submitForm` with `allowUnverified:true` — ask first, §8).

### Example — JR close (what replaces `doPost`)

Today:
```json
POST https://script.google.com/macros/s/AKfycbw7fhvI…/exec
{ "secret": "…", "action": "completeJrTitle", "workflowId": "NEW_EMP_20260916-141501_123", "comments": "Assigned in BOSS" }
```

With EFX (what the Router sends for you):
```json
{
  "function": "n8n_closeJrTask",
  "parameters": [
    { "id": "n8n:boss-jr-assign", "email": "efx-bot@team-group.com", "display": "BOSS JR assign (n8n)" },
    "NEW_EMP_20260916-141501_123",
    "Assigned in BOSS"
  ]
}
```
Response:
```json
{ "ok": true, "apiVersion": "2026.09.17-1", "requestId": "REQ-3F9A1C2B",
  "result": { "taskId": "TK-8247F3AB", "workflowId": "NEW_EMP_20260916-141501_123", "success": true } }
```
Already closed (safe, treat as success):
```json
{ "ok": false, "apiVersion": "2026.09.17-1", "requestId": "REQ-…",
  "error": { "code": "E_ALREADY_CLOSED", "message": "Task TK-8247F3AB for NEW_EMP_… (jr_title) is already closed" } }
```

### Example — ID Setup from your onboarding workflow

```json
{
  "function": "n8n_submitIdSetup",
  "parameters": [
    { "id": "n8n:employee-onboarding", "email": "efx-bot@team-group.com", "display": "Employee onboarding (n8n)" },
    { "workflowId": "NEW_EMP_20260916-141501_123",
      "siteDocsWorkerId": "184223", "siteDocsJobCode": "Hourly 1",
      "siteDocsUsername": "ada.lovelace@team-group.com",
      "dssUsername": "ada.lovelace", "dssPassword": "{{ $json.generatedPassword }}",
      "bossWisCreated": "Yes", "siteDocsBadgeCreated": "No",
      "setupNotes": "Accounts created by n8n" }
  ]
}
```
Missing field → `E_VALIDATION` with `fields:[{ field:'dssPassword', problem:'required' }]`, and **nothing is written**.

---

## 3. How to call: Router and wrappers

You never call Google directly from a feature workflow.

```
Your workflow ─▶ [Forms · Close JR Task]  (wrapper: alias + fields pre-filled, you map inputs)
                    └─▶ [Router]  (shared; does auth, project lookup, validation, error shaping)
```

- **Wrappers** are saved sub-workflows we ship in `n8n/` — one per alias (`10_Forms_CreateInitialRequest` … `28_Forms_SaveTaskDraft`;
  full table in `n8n/README.md`). Use *Execute Workflow* and map your fields. If a wrapper does not exist for an alias
  (`n8n_info`, `n8n_contracts`, `n8n_getEmployeeId`, the generic `n8n_createWorkflow`/`n8n_submitForm`), call the Router directly.
- **Router** (`00_EFX_Router`, a sub-workflow; the community node `n8n-nodes-efx-appscript` is a later option) takes `fn` (alias name),
  `args[]` (positional, without actor), optional `actor`, optional `idempotencyKey` (built — same key within the window returns the cached
  reply), optional `treatAlreadyClosedAsSuccess` (default true). One fixed script id per tier. It uses the *Google Service Account*
  credential `EFX Google SA (<tier>)` — you do not touch the credential.
- **Guard.** The Router only returns success when the body is JSON **and** `ok === true`. Anything else
  (HTML login page, Apps Script error, quota) fails the node loudly and goes to the error workflow. Do not add
  your own "retry until 200" loops around it.
- **Output.** Success → `result` (the handler's own object). Failure → the node errors with `error.code` and
  `error.message`; branch on `code` with an *IF* node if you want to treat some codes as success (§6).

---

## 4. Actor rules

Every call carries an actor. It is written to *Submitted By*, *Closed By* and the Raw Log so we can see what
automation did.

```json
{ "id": "n8n:<workflow-slug>", "email": "efx-bot@team-group.com", "display": "<Human label> (n8n)" }
```

- `id` — stable, one per workflow, `n8n:` prefix, kebab-case (`n8n:boss-jr-assign`, `n8n:employee-onboarding`).
- `email` — **always the bot account**, never a person's address. (Until `efx-bot@` exists, wrappers on TEST use
  a test bot address we give you.)
- `display` — what a human reads in an email or the dashboard.
- Never impersonate a person to pass a permission check. If a call fails with a permission message, ask us.

---

## 5. Idempotency — safe retries

| Situation | What Forms does | What you should do |
|---|---|---|
| You close a task twice | Second call → `E_ALREADY_CLOSED`, no writes, no emails | Treat as success |
| You submit the **same** New Hire twice within 30 s | `createWorkflow` returns the existing id (30 s window keyed on requester + employee + hire date; other request types key on requester only) | Still send an `idempotencyKey`; don't rely on the window |
| You submit ID Setup twice | Second row is appended; step already advanced — not harmful but untidy | Check `n8n_getWorkflow` step first, or gate on your own run state |
| Employee ID allocated twice | Returns the same id (idempotent per workflow) | Nothing |
| Router `idempotencyKey` | Cached response for the same key (built into `00_EFX_Router`) | Use `wfrun-{{ $execution.id }}-{{ $node.name }}` on every mutating call |

`dryRun:true` on `n8n_closeTask` / `n8n_assignSafetyTraining` returns what *would* close without writing. Use it
while building.

---

## 6. Error codes and what to do


Generated from `N8N_ERROR_CODES` in `N8n.js` (the same list renders `docs/N8N_CONTRACTS.md` and `n8n/README.md`). `error.requestId` is on every failure — quote it when you ask us: every failed call and every successful *mutating* call is written to the Forms Raw Log (`Kind = alias`) with that id, the alias name, the principal and the duration, so we can find your exact call.

| Code | Meaning | Retry? | What to do |
|---|---|---|---|
| `E_VALIDATION` | payload failed the FormContracts check (`error.fields[]` lists field + problem) or bad/missing arguments | No | fix the mapping; do not retry |
| `E_UNKNOWN_FORM` | form name not in FormContracts | No | fix the form name; do not retry |
| `E_UNVERIFIED_FORM` | form contract is `verified:false` (`it_confirmation`, `specialist`); pass `options.allowUnverified=true` to override | No | do not retry |
| `E_UPSTREAM` | the Forms handler returned `success:false`; its message is passed through and `error.upstream` carries the raw result | No | read the message (usually data/state); retry only if it says so |
| `E_FORBIDDEN` | the real session principal (efx-bot) lacks the role (HR/IT/Admin/requester/manager); `error.principal` names it | No | do not retry until the group membership changes |
| `E_NOT_FOUND` | workflow not found, or no open task of that formType for the workflow | No | check the ids; do not retry |
| `E_ALREADY_CLOSED` | the task is already Closed | No | treat as success (idempotent close) |
| `E_TASK_NOT_OPEN` | the task is Cancelled (or otherwise not Open), or its workflow is Cancelled | No | NOT a success — do not retry; the workflow was cancelled |
| `E_RATE_LIMITED` | a bump reminder was already sent recently for this step (one per step per hour) | Later | retry later |
| `E_INTERNAL` | unexpected exception inside the alias layer | Once | retry once after a minute; if it repeats, send us the requestId |
| Router `E_TRANSPORT` / `E_SCRIPT` | HTTP failure to the Execution API, or the script threw before the alias ran (wrong function name, no deployment, consent missing) | Once for `E_TRANSPORT` | Check the Router execution; `E_SCRIPT` with `Script function not found` = wrong `fn` |

## 7. Testing rules (non-negotiable)

1. **Never test against prod Forms.** Build against the **TEST** project (this fork) on **staging n8n**. The
   Router credential for TEST cannot reach prod.
2. **Emails are redirected.** The TEST script runs with `EMAIL_REDIRECT_ALL` set to dbinns, so every email the
   test sends goes to one inbox. If you ever see a real group address receive a test email, stop and tell us.
3. **Never use real people's data** in test payloads. Use obvious names (`Ada Lovelace`, `Test Hire`) and the
   TEST sheet's reference sites.
4. **Clone-and-redirect** before any workflow that emails: duplicate your workflow, point it at TEST, run it,
   then move it to prod n8n.
5. Use `dryRun:true` first for closes.
6. When a test creates a New Hire on TEST, we clean the TEST sheet — you never delete rows yourself.

---

## 8. How to ask for a new function

Open a short note (email/Slack to dbinns, or an issue in this repo) with:

- **Which step or task** you want to drive (screenshot of the email subject or the form URL is fine).
- **Trigger**: what tells you it is time (an event from `n8n_events`, an email, BOSS success…).
- **Fields you can supply** and where they come from.
- **What should happen after** (advance step? close task? just read?).

We then: (1) add or verify the `FormContracts` entry, (2) add an `n8n_*` alias, (3) run the test suites,
(4) publish a wrapper sub-workflow JSON in `n8n/`, (5) bump `N8N_API_VERSION` and tell you. Additions never
break your existing wrappers.

Candidates already ranked in the spec (`08_AUTOMATION_CANDIDATES_FOR_GEORGE.md`): ID Setup automation (Tier 1),
JR cutover (Tier 1), 30/60/90 review plan, termination IT deactivation, open-task reminders.

---

## 9. What "contract drift" means

A **contract** is the list of fields a form accepts, plus a `hash`. Your wrapper was built against a specific
version (`contractsVersion`, e.g. `2026.09.16-proto`).

- If we **add** an optional field, nothing changes for you (additive rule).
- If we **rename or remove** a field or a function, we keep the old name working for a deprecation window,
  bump `N8N_API_VERSION`, and tell you. Only after the window does the old name disappear.
- If a wrapper sends a field Forms no longer knows, you get `E_VALIDATION` `unknown field (not in contract)`; the
  The `30_EFX_Canary` workflow checks `n8n_info` every 15 min and alerts when the API version changes; the contract hash is in `n8n_contracts()`.

What to do: run `n8n_contracts()`, compare the form's `required`/`optional` with your mapping, fix, done. The
`30_EFX_Canary` workflow checks `n8n_info` every 15 minutes and alerts us first when the API version changes.

---

## 10. Quick reference — ids you will see

| Looks like | Is |
|---|---|
| `NEW_EMP_20260916-141501_123` | New Hire workflow id |
| `EQUIP_REQ_…` / `TERM_…` / `CHANGE_…` | Equipment / Termination / Status Change workflow ids |
| `TK-8247F3AB` | Action item (task) id |
| `INIT_REQ_…`, `ID_SETUP_…` | Form ids (per step submission) |
| `30412` | Internal Employee ID (numeric, ≥ 30000) |
| `EVT-20260916141501-3F9A1C2B` | Raw Log event id (your polling cursor) |
| `REQ-3F9A1C2B` | Request id in every EFX response — quote it when asking for help |


## Added 2026-09-17
Fourteen more aliases (all remaining forms, generic create/submit, cancel/bump/hire-date, drafts, list, context) — see `ALIASES_ADDED_2026-09-17.md` and the generated `../N8N_CONTRACTS.md`. Authorization now uses the real session identity; `actor.email` is attribution only.
