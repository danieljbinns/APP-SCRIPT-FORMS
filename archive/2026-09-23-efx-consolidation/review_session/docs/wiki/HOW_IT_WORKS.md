# How EFX works

A human explainer. No code required to follow it; file names are given so you can go look.

---

## 1. The problem in one picture

Before EFX, the only ways for automation to touch Employee Forms were:

```
 n8n ──(Gmail trigger, regex on subject/body)──▶ "I think a JR task exists"
 n8n ──(Puppeteer + George's personal Google cookies)──▶ portal page  ✗ dead since 2026-07-16
 n8n ──(POST secret to doPost @76)──▶ exactly ONE action: completeJrTitle
 n8n ──(Google Sheets node)──▶ write cells in the prod spreadsheet  ✗ skips every side effect
```

Forms is a Google Apps Script web app. Its "API" is the set of server functions the HTML pages call with
`google.script.run.<function>(payload)` — `submitInitialRequest`, `submitEmployeeIDSetup`,
`closeActionItemWithNotes`, and so on. Those functions do everything: validate, write the row, advance the
workflow, create action items, send the templated emails. There was no way for a machine to call them.

EFX makes those same functions callable by n8n, safely, with an identity, and with a discoverable list of fields.

---

## 2. The shape

```
┌──────────────── n8n (staging, later prod) ─────────────────────────────────────┐
│ George's workflow                                                              │
│   └─▶ [Forms · Close JR Task]  (wrapper sub-workflow: alias + params pre-filled)│
│         └─▶ [Router]  (one shared sub-workflow / community node)               │
│               • Project ▾  ← EFX Registry sheet (planned)                      │
│               • Function ▾ ← n8n_contracts() of that project                   │
│               • validates params against the contract                          │
│               • credential: Google Service Account, impersonates efx-bot@      │
│               • POST https://script.googleapis.com/v1/scripts/{scriptId}:run   │
│                    { function:'n8n_closeJrTask', parameters:[actor, id, notes] }│
└───────────────────────────────────────┬────────────────────────────────────────┘
                                        ▼  Execution API (Google, OAuth)
┌──────────────── Employee Forms (Apps Script project, one per tier) ────────────┐
│ N8n.js        n8n_closeJrTask(actor, idOrWorkflow, notes)                       │
│   └─ EfxApi.js   efxTaskClose(actor, {workflowId, formType:'jr_title'})         │
│        └─ Actor.run(actor, () => ActionItemService.closeActionItem(...))        │
│                    ▲ the SAME function ActionItemForm.html calls                │
│ FormContracts.js  what each submit function accepts (validated before call)     │
│ RawLog.js         every submit + result becomes an event row (Event ID, Kind)   │
│ EmployeeIdRegistry.js  Internal Employee ID minted inside submitInitialRequest  │
│ Sheets: resolved by THIS script's own Script Properties (never a coded default) │
└────────────────────────────────────────────────────────────────────────────────┘
```

Three properties fall out of this shape:

1. **Same function, same effects.** A human clicking *Complete* and n8n calling `n8n_closeJrTask` run
   `ActionItemService.closeActionItem` with identical arguments (other than who did it). Emails, secondary sheet
   writes, WIS sequencing and workflow completion happen either way.
2. **No secrets in Forms.** Identity is Google's (service account + DWD). Forms does not hold an HMAC key for
   inbound calls. (The optional *outbound* event webhook does carry a signature — see §6.)
3. **Everything is an n8n execution.** Failures are visible, retryable and routed to the error workflow.

---

## 3. Request lifecycle — New Hire

```mermaid
sequenceDiagram
    participant R as Requester (human) or n8n
    participant F as Forms server functions
    participant S as Spreadsheet
    participant E as Email
    participant N as n8n (George)

    R->>F: submitInitialRequest(formData)
    F->>S: Workflows row (NEW_EMP_… minted)
    F->>S: Employee IDs row (Internal Employee ID minted)  ◀ EFX
    F->>S: Initial Requests row (+ col 56 Internal Employee ID)  ◀ EFX
    F->>S: Raw Log result event {workflowId, internalEmployeeId, …}  ◀ EFX
    F->>E: "Request Submitted" / "ID Setup Required"
    F-->>R: {success, workflowId, formId, internalEmployeeId}

    N->>F: n8n_events({afterEventId}) or webhook  ◀ EFX
    N->>N: create SiteDocs worker, DSS user, BOSS WIS…
    N->>F: n8n_submitIdSetup(actor, {workflowId, siteDocsWorkerId, siteDocsJobCode, dssUsername, dssPassword})
    F->>S: ID Setup Results (uses the pre-assigned id)
    F->>E: "HR Verification Required"
    Note over F: step = HR Verification Needed

    F->>E: … HR Verification → IT Confirmation → IT Setup (humans today)
    F->>S: submitITSetup creates Action Items (jr_title, review_306090, fleetio, …)
    F->>E: "JR Assignment — <name>" to grp.forms.jrtitle

    N->>F: n8n_closeJrTask(actor, "NEW_EMP_…", notes)  ◀ EFX (replaces doPost @76)
    F->>S: Action Items: Closed, Closed By = efx-bot
    F->>E: closure emails; workflow completes when all items closed
```

Plain English:

- **Submit** creates the workflow id *and now the Internal Employee ID*, writes the request row, logs a `result`
  event, and emails the ID Setup group. The response carries `internalEmployeeId`.
- **ID Setup** is a step form. A human opens `?form=id_setup&wf=…`, sees the pre-assigned id (read-only in
  effect), fills SiteDocs/DSS details, submits. n8n can do the same with `n8n_submitIdSetup`. Either way the
  workflow advances to *HR Verification Needed*.
- **HR Verification → IT Confirmation → IT Setup** are further steps, each with its own submit function and email.
  Contracts exist for them; only `new_hire` and `id_setup` are `verified:true` today.
- **IT Setup** fans out **action items** to specialist groups. `jr_title` goes to `grp.forms.jrtitle` (George).
  `review_306090` when `plan306090 === 'Yes'`; `safety_onboarding` at ID Setup (hourly) / after HR (salary), or at
  submit if `SAFETY_TRAINING_AT_SUBMIT` is on.
- **Closing an action item** is not a status flip. Depending on type it writes `IT Results` or
  `ID Setup Results`, triggers WIS sequencing, sends closure emails and completes the workflow when the last
  item closes. That is why EFX never touches `Action Items` directly.

The other three workflow types (`EQUIP_REQ_`, `TERM_`, `CHANGE_`) follow the same pattern with different
steps and action items; their contracts are in `FormContracts.js` marked `verified:false` until the mapping
docs (`docs/mapping/`) confirm them.

---

## 4. Human submit and n8n submit run the same function

```
Human                                        n8n
─────                                        ───
InitialRequest.html                          Router node
  google.script.run                            Execution API scripts.run
    .submitInitialRequest(formData)              function: 'n8n_createInitialRequest'
                                                 parameters: [actor, formData]
                                                       │
                                                       ▼
                                             N8n.js  n8nSubmit_()
                                               FormContracts.validate('new_hire', formData)
                                               Actor.run(actor, () => submitInitialRequest(formData))
                                                       │
        ┌──────────────────────────────────────────────┘
        ▼
submitInitialRequest(formData)      ← one implementation
  rawLog(...)  createWorkflow(...)  EmployeeIdRegistry.allocate(...)  addSheetRow(...)  emails
  Submitted By / Raw Log User = Actor.email()
     human → Session.getActiveUser().getEmail()
     n8n   → actor.email (efx-bot@team-group.com)
```

`Actor.js` is the only piece that differs. It is a request-scoped override: `Actor.run(actor, fn)` sets the
identity for the duration of `fn`, and `Actor.email()` returns it — or falls back to the Google session for
humans. Apps Script executions are single-threaded per invocation, so this is safe. Handlers were changed
mechanically from `Session.getActiveUser().getEmail()` to `Actor.email()`.

Two extra things the alias layer does that the HTML does not:

- **Contract validation first.** Unknown or missing fields are rejected with `E_VALIDATION` and a `fields[]`
  list *before* the handler runs, so a bad n8n payload cannot half-write anything.
- **Envelope.** Every alias returns `{ ok, apiVersion, requestId, result }` or
  `{ ok:false, apiVersion, requestId, error:{ code, message, fields?, upstream? } }`. The Router branches on `ok`.

---

## 5. Why not just write to the sheets?

Because the sheets are *storage*, not the *application*. Writing a row to `ID Setup Results` from n8n would:

- not advance the workflow step (`Workflows` and `Dashboard_View` stay at *ID Setup Needed*),
- not send "HR Verification Required",
- not create downstream action items,
- not appear in `Raw Log`, `Audit Log` or `Form Edit Log`,
- not be attributed to anyone,
- and silently break the next time a column moves (Forms reads New Hire data by header name, but Terminations
  and Status Change by index).

Reads are the same story: `Dashboard_View` is a derived cache; `Action Items.Description` is a JSON checklist;
`Raw Log` is pruned to 5000 rows so row numbers are not a stable cursor. EFX exposes reads that already know
these shapes (`n8n_getWorkflow`, `n8n_listTasks`, `n8n_events`).

If a field has **no legitimate update path in Forms**, EFX does not invent one. It is reported as
`E_NO_UPDATE_PATH` (planned in the Router) and becomes a Forms backlog item.

---

## 6. What the Internal Employee ID change means

| | Before | After (EFX) |
|---|---|---|
| When minted | When a human *opened* the ID Setup page (`generateEmployeeId()` = max+1, no lock, no write) | Inside `submitInitialRequest`, right after the workflow id, before the request row is written |
| Where stored | Only in `ID Setup Results` col D, after a human submitted | `Employee IDs` registry sheet + `Initial Requests` col 56 + `ID Setup Results` col D (unchanged for readers) |
| Concurrency | Two open pages could show the same number; submit silently swapped to a fresh max+1 | Append-then-verify allocator; idempotent per workflow id; lowest row with an id wins; losers retry (≤5) |
| Failure | Fallback `'30' + last 3 epoch digits` (collides) | Throws → `submitInitialRequest` returns `success:false` with a clear message. No invented ids |
| Editable? | Yes, the input was editable — a typo became permanent | Displayed value is the pre-assigned id. A different value is only honoured for admins (`Actor.canOverrideEmployeeId()`), and logged |
| Available to automation | Never before a human acted | In the submit response, in the Raw Log `result` event, via `n8n_getEmployeeId(workflowId)` |
| Rehire | New id always | New id unless `existingInternalEmployeeId` is supplied (recorded as `source: rehire-carry`) |
| Old workflows | — | No registry row → ID Setup page falls back to `generateEmployeeId()`; submit allocates via the registry from then on. `migrateEfxBackfill*` can seed the registry from `ID Setup Results` |

Downstream readers (`EmailUtils`, `ITSetupHandler`, `HRVerification.html`, `RequestHeader.html`) keep reading
`ID Setup Results` col D and are unaffected. `getWorkflowContext` additionally exposes
`preassignedEmployeeId` so automation and (later) email templates can show the id *before* ID Setup runs.

---

## 7. Events

`rawLog(source, formData)` was already the first line of every submit handler. EFX keeps that and adds:

```
Raw Log:  Timestamp | Source | Workflow ID | User | Raw JSON | Event ID | Kind
          Kind ∈ submit · result · task.created · task.closed · alias (requestId audit: every failed alias call + every successful mutating call; hidden from n8n_events unless kinds:['alias'])
                                                                 │          └ 'submit' | 'result'
                                                                 └ EVT-20260916T141501-3F9A1C2B (cursor)
```

- `submit` rows are what they always were: the raw client payload, *before* ids exist (for a new request,
  `Workflow ID` is blank).
- `result` rows are new, written by `rawLogResult(source, workflowId, result)` *after* the row lands, e.g.
  `submitInitialRequest → {formId, internalEmployeeId, employeeName, employmentType, siteName, hireDate, managerEmail, requesterEmail, systems, plan306090, jrAssignment}`
  and `submitEmployeeIDSetup → {formId, internalEmployeeId, siteDocsWorkerId, siteDocsJobCode, dssUsername, bossWisCreated}` (never passwords).
- `User` is `Actor.email()`, so n8n-originated events say `efx-bot@…`, not blank.

Two ways for n8n to consume them:

| Mode | How | Status |
|---|---|---|
| **Poll** | Router Trigger / Schedule node calls `n8n_events(actor, { afterEventId, kinds:['result'], sources:['submitInitialRequest'] })` every minute; stores `nextAfterEventId` in workflow static data. If `pruned:true` comes back, the cursor fell off the 5000-row window — re-sync by `afterTs`. | code present; wrapper *planned* |
| **Push** | If Script Property `EFX_EVENT_WEBHOOK_URL` is set (via `setEfxEventWebhook(url, kid, secret)`), `rawLog` POSTs a signed envelope `{v:1, kid, ts, nonce, action:'event', actor:{id:'forms:rawlog'}, payload:{eventId, kind, source, workflowId, actor, payload}, sig}` to n8n. Fire-and-forget, `muteHttpExceptions`, never throws, never blocks a human submit beyond the fetch timeout. | code present; receiver *planned* |

Recommendation from `12_ROUTER_AS_N8N_NODE.md`: start with polling — zero Forms configuration, nothing to secure.

---

## 8. Tiers, and what exists today

| Tier | Apps Script | Spreadsheet | n8n | EFX status |
|---|---|---|---|---|
| **prod** | `employee_management_v2` in `employee_forms_deployment` (scriptId `1AuIbJl1jR…`) | `1kGjw8e…` | staging n8n calls prod `doPost` @76 (JR only) | **untouched** |
| **dev** | `employee_management_v2_dev` (`1VI9tR0GCx…`) | `1o2Kul…` ("…- STAGING" title) | — | untouched by this fork |
| **staging** | `employee_management_v2_staging` | — | — | stale, ignore |
| **EFX TEST** | `employee_management_v2_efx` in **this fork**; `.clasp.json` scriptId is `REPLACE_ME…` | new TEST sheet (to create) | staging n8n | **pending**: create script, set Script Properties, `clasp push`, API-executable deploy |

Planned per tier (none exist yet): GCP project `efx-<tier>`, service account, DWD, `efx-bot@team-group.com`,
registry sheet `EFX Registry (<tier>)`, Router node package `n8n-nodes-efx-appscript`.
