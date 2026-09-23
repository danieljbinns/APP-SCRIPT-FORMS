# n8n workflows for Employee Forms (EFX) — import kit

Exported-style n8n 2.28.x JSON (typeVersions match the team's live exports: httpRequest 4.2, code 2, if 2, set 3.4,
gmail 2.1, executeWorkflow 1.1, executeWorkflowTrigger 1.1, scheduleTrigger 1.2, switch 3.2). No secrets inside —
only `<<PLACEHOLDERS>>` and credential *names*.

Transport is the **Apps Script Execution API** (`POST https://script.googleapis.com/v1/scripts/<<EFX_SCRIPT_ID>>:run`)
authenticated with an n8n **Google Service Account** credential that impersonates `efx-bot@team-group.com`.
The Apps Script side is `employee_management_v2_efx/N8n.js` (27 aliases, API `2026.09.17-1`) + `FormContracts.js`
(field contracts, `2026.09.16-r2`).

> **Authorization ≠ attribution.** Role checks inside Forms (HR / IT / Admin / requester / manager) run against the
> *real* Execution API session — the impersonated `efx-bot@team-group.com`. `actor.email` / `actor.id` are written to
> *Submitted By*, *closedBy* and the Raw Log for attribution only and grant nothing. For approvals, HR Verification and
> IT Setup, efx-bot must be in the matching `grp.forms.*` group (or `CONFIG.ADMIN_EMAILS`) on that tier.

## Files

| File | Kind | Purpose |
|---|---|---|
| `00_EFX_Router.json` | sub-workflow | **The router.** Inputs `fn, args[], actor?, idempotencyKey?, treatAlreadyClosedAsSuccess?` → `scripts.run` → unwrap + guard. Everything else calls this. |
| `10_Forms_CreateInitialRequest.json` | sub-workflow | `n8n_createInitialRequest(actor, data, include)` — typed `new_hire` inputs |
| `11_Forms_SubmitIdSetup.json` | sub-workflow | `n8n_submitIdSetup(actor, data, include)` — typed `id_setup` inputs |
| `12_Forms_CloseJrTask.json` | sub-workflow | `n8n_closeJrTask(actor, idOrWorkflow, notes)` — **replaces `doPost completeJrTitle`** |
| `13_Forms_AssignSafetyTraining.json` | sub-workflow | `n8n_assignSafetyTraining(actor, workflowId, details)` |
| `14_Forms_GetWorkflow.json` | sub-workflow | `n8n_getWorkflow(actor, workflowId)` (+ `employeeId` registry info) |
| `15_Forms_ListTasks.json` | sub-workflow | `n8n_listTasks(actor, filter)` |
| `16_Forms_CloseTask.json` | sub-workflow | `n8n_closeTask(actor, params)` — generic closer |
| `17_Forms_CreateEquipmentRequest.json` | sub-workflow | `n8n_createEquipmentRequest(actor, data, options)` → `EQUIP_REQ_` |
| `18_Forms_CreateTerminationRequest.json` | sub-workflow | `n8n_createTerminationRequest(actor, data, options)` → `TERM_` |
| `19_Forms_SubmitTerminationApproval.json` | sub-workflow | `n8n_submitTerminationApproval(actor, {workflowId, decision, notes}, options)` |
| `20_Forms_EventsPoller.json` | scheduled (1 min) | `n8n_events` cursor poller → Switch by source → NoOp placeholders for George |
| `21_Forms_CreatePositionChangeRequest.json` | sub-workflow | `n8n_createPositionChangeRequest(actor, data, options)` → `CHANGE_` |
| `22_Forms_SubmitPositionChangeApproval.json` | sub-workflow | `n8n_submitPositionChangeApproval(actor, {workflowId, decision, notes, confirmedTitle, confirmedNewManager, confirmedJrTitle}, options)` |
| `23_Forms_SubmitItSetup.json` | sub-workflow | `n8n_submitItSetup(actor, data, options)` — Snake_Case keys; creates the specialist tasks incl. **jr_title** |
| `24_Forms_SubmitHrVerification.json` | sub-workflow | `n8n_submitHrVerification(actor, data, include)` — contract verified in r2 |
| `25_Forms_ListWorkflows.json` | sub-workflow | `n8n_listWorkflows(actor, {type, status, step, since, employeeName, limit, offset})` |
| `26_Forms_GetContext.json` | sub-workflow | `n8n_getContext(actor, workflowId)` — email-template context, credentials redacted |
| `27_Forms_WorkflowActions.json` | sub-workflow | `action` = `cancel` \| `bump` \| `updateHireDate` → `n8n_cancelWorkflow` / `n8n_bumpWorkflow` / `n8n_updateHireDate` |
| `28_Forms_SaveTaskDraft.json` | sub-workflow | `n8n_saveTaskDraft(actor, taskId, notes, checklist)` |
| `30_EFX_Canary.json` | scheduled (15 min), **inactive** | `n8n_ping` → assert `env` + `spreadsheetId` → Gmail alert to dbinns |
| `40_Ref_Onboarding_via_EFX.json` | reference flow, **inactive** | George's hourly onboarding rebuilt on the `result` event → SiteDocs → Litmos → `11_Forms_SubmitIdSetup` |
| `41_Ref_OpenTasks_Digest.json` | reference flow, **inactive** | Weekdays 08:00 → `15_Forms_ListTasks` Open → one CCF-style digest per assignee (recipients overridden to dbinns) |
| `90_EFX_E2E_Test.json` | manual | End-to-end chain against the **TEST** script, PASS/FAIL summary; optional steps 10–12 behind `RUN_EXTENDED` |
| `snippets/George_MarkPortalJrComplete_replacement.json` | paste-able node | Drop-in for "Mark Portal JR Complete" in `J7RU99n01pq9Xk3D` |

## Workflow lint

`node tools/n8n-workflows-check.js` (or `npm run lint:n8n` from `tools/`) lints every file here **locally** — no n8n API, no
credentials — and exits 1 on any error. Run it after editing a JSON file and before importing. `--json` prints the same result
machine-readably; `--no-snippets` skips `snippets/`; `--dir <folder>` lints a scratch copy.

| Check | Error | Warning |
|---|---|---|
| Structure | invalid JSON; duplicate/missing node name, `type`, `typeVersion`, `position`; connection to a non-existent node; orphan non-sticky node; no trigger; `$('Node')` reference to a node that is not in the workflow | `typeVersion` differs from the pins above; duplicate node `id`; non-empty `pinData` |
| Execute Workflow | target is not the Router, a file in this folder or a `<<PLACEHOLDER>>`; an input passed to a resolvable sub-workflow (`00`, `11`, `12`, `15`) that its trigger does not declare; Router call without `fn`/`args` | `waitForSubWorkflow` off; stale `schema` ids |
| `fn` ↔ `N8n.js` | `fn` (Code literal or node parameter) not in `N8N_ALIASES`; more args built than the alias takes after `actor`; alias without function or function without alias | `n8n_*` token that is not an alias (typo in a sticky); Code output key (`treatAlreadyClosedAsSuccess`, …) not forwarded by the Router node |
| Contracts (`docs/contracts.lock.json` + `FormContracts.js` enums) | wrapper builds a key the form does not accept; `DYN` prefix not a `dynamicPrefix`; enum literal (`ENUMS`, `JOB_CODES`, `['Approved','Rejected']`, E2E payloads) outside the contract enum | contract-required key that no input or literal provides; wrapper `REQUIRED` stricter/looser than the contract; trigger input that is not a contract key; `inp.x` read without a declared input; declared input never used; multi-select value off the UI list |
| Code | `jsCode` does not compile (async function body, n8n semantics) | Code node without `return` |
| Secrets | `AKfycb…` deployment id, `BEGIN PRIVATE KEY`, JWT, literal `"password": "…"` (only `<<PLACEHOLDER>>`) | `@team-group.com` address other than `dbinns@` / `efx-bot@` (recipient fields and elsewhere, with node); literal password-like assignment |

Placeholders (`<<…>>`) are always accepted. The lint reads the contract **lock**, so run `tools/n8n-check.js` first when
`FormContracts.js` changed (the lint warns if lock and source differ).

## Import order

1. **Create credentials** (you select them on import; names are for readability):
   - **Google Service Account** (type `googleApi`) named **`EFX Google SA (<<TIER>>)`** — one per tier (`DEV`, `STAGING`, `PROD`).
     SA email + private key from GCP project `efx-<tier>`; **Impersonate a user = `efx-bot@team-group.com`**;
     tick **"Set up for use in HTTP Request node"** and paste the scopes:
     `https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/script.external_request https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/admin.directory.user.readonly`
     (= `script.projects` for the Execution API **plus every scope in the script's `appsscript.json`**; the same list must be authorised for the SA client id under Workspace Admin → Security → API controls → Domain-wide delegation).
   - **Gmail OAuth2** — the existing team credential `Gmail account` (id `ESH5aDZWt0qo7oKD` on staging) is referenced by `30`, `40`, `41`; re-select on prod.
   - For `40` only: **HTTP Header Auth** credentials `SiteDocs API (<<TIER>>)` and `DSS (Litmos) API (<<TIER>>)` — George's existing "Site doc's POC" / "DSS (Litmos) API" on staging can be selected instead.
2. **GCP / Apps Script prerequisites** (once per tier; not done by these files):
   - Apps Script project `<<EFX_SCRIPT_ID>>`: *Project Settings → Google Cloud Platform project → Change project* → the **same GCP project as the SA**. Enable the *Apps Script API* in that GCP project.
   - *Deploy → New deployment → type API Executable*. Re-deploy after each push so n8n sees new code (`devMode:false` runs the deployment, not HEAD).
   - `efx-bot@team-group.com`: edit access to the tier's spreadsheet; membership in `grp.forms.hr` / `grp.forms.it` (or `CONFIG.ADMIN_EMAILS`) for the approval / HR / IT aliases.
3. **Import `00_EFX_Router.json`.** Open the HTTP Request node, select the SA credential, replace `<<EFX_SCRIPT_ID>>` in the URL. Save. **Copy the workflow id** from the URL.
4. **Replace placeholders in the other files**, then import them. PowerShell, from this folder:
   ```powershell
   $router = 'AbCdEf123456'            # id of the imported 00_EFX_Router
   Get-ChildItem *.json, snippets\*.json | ForEach-Object {
     (Get-Content $_ -Raw) -replace '<<ROUTER_WORKFLOW_ID>>', $router | Set-Content $_ -Encoding utf8
   }
   ```
   or leave the placeholder and pick the Router from the *Workflow* dropdown on each `EFX · Router` node after import.
5. Import wrappers `10`–`19`, `21`–`28`, then `20`, `30`, `90`. Point *Settings → Error workflow* of `20`/`30`/`40`/`41` at **Error Notifications - Global Handler** (`xS6gvP5ChF7XmUa5` on staging) or replace `<<ERROR_WORKFLOW_ID>>`.
6. Reference flows `40`/`41` last (they need the ids of imported `11` and `15`: `<<SUBMIT_ID_SETUP_WORKFLOW_ID>>`, `<<LIST_TASKS_WORKFLOW_ID>>`). Keep them **inactive** on staging until George reviews.
7. Run **`90_EFX_E2E_Test`** against a Router whose URL targets the **TEST** script (see below). Only then wire George's workflows.

## Placeholders

| Placeholder | Where | Value |
|---|---|---|
| `<<EFX_SCRIPT_ID>>` | `00` HTTP Request URL | Apps Script **script id** (Project Settings → IDs), not a deployment id |
| `<<TIER>>` | credential names | `DEV` / `STAGING` / `PROD` |
| `<<GOOGLE_SA_CREDENTIAL_ID>>`, `<<SITEDOCS_CREDENTIAL_ID>>`, `<<LITMOS_CREDENTIAL_ID>>` | credential refs | ignored on import — just select the credential |
| `<<ROUTER_WORKFLOW_ID>>` | every Execute Workflow → Router node | id of imported `00` |
| `<<CLOSE_JR_TASK_WORKFLOW_ID>>` | `snippets/…` | id of imported `12` |
| `<<SUBMIT_ID_SETUP_WORKFLOW_ID>>` | `40` | id of imported `11` |
| `<<LIST_TASKS_WORKFLOW_ID>>` | `41` | id of imported `15` |
| `<<ERROR_WORKFLOW_ID>>` | `20`, `40`, `41` settings | global error handler id |
| `<<EXPECTED_ENV>>` | `30`, `90` | `TEST` \| `DEV` \| `STAGING` \| `PROD` — must equal `ENVIRONMENT` in the script's `Config.js` (the fork ships `'TEST'`; `n8n_ping` returns it as `env`) |
| `<<EXPECTED_SHEET_ID>>` | `30` | the spreadsheet id this tier must write to (prod `1kGjw8e…`, dev/staging `1o2Kul…` — see `corrected-docs/CREDENTIALS.v2.md`) |
| `<<EXISTING_JR_TASK_ID>>` | `90` Test config | optional: an **Open** `jr_title` `TK-…` id on the TEST sheet to exercise 7b/7c |
| `<<PORTAL_EXEC_URL>>` | `41` Workflow Configuration | the tier's portal `/exec` URL for deep links (optional) |
| `<<LITMOS_TEAM_ID>>` | `40` sticky | optional — only if George re-adds his *Assign Team* step |

## How the Router works (`00_EFX_Router.json`)

```
Execute Workflow Trigger (fn, args, actor, idempotencyKey, treatAlreadyClosedAsSuccess)
  → Set defaults (Code)   actor default {id:'n8n:'+$workflow.name, email:'efx-bot@team-group.com', display:…}; parameters = [actor, ...args]
  → Cache hit? (IF)       idempotencyKey replay within 10 min (workflow static data; production executions only)
  → scripts.run (HTTP 4.2, predefinedCredentialType googleApi, fullResponse, neverError, text, timeout 120 s)
  → Unwrap & guard (Code) body.done / body.error / body.response.result → envelope → flattened output or throw
```
Errors are thrown with a stable prefix so error workflows can branch on `/^EFX (E_[A-Z_]+):/`. The first two codes are
raised by the Router itself; the rest are the Apps Script codes — their rows are the same text as `N8N_ERROR_CODES` in
`employee_management_v2_efx/N8n.js` (the source of truth, also rendered into `docs/N8N_CONTRACTS.md` by `tools/gen-contracts.js`).

| Code | Meaning | n8n handling (retry?) |
|---|---|---|
| `E_TRANSPORT` | HTTP/auth/deployment problem, non-JSON body, `done:false` (Router-side) | retry after fixing credential / deployment |
| `E_SCRIPT` | the Apps Script function threw (message + stack in the error) (Router-side) | do not retry |
| `E_VALIDATION` | payload failed the FormContracts check (`error.fields[]` lists field + problem) or bad/missing arguments | fix the mapping; do not retry |
| `E_UNKNOWN_FORM` | form name not in FormContracts | fix the form name; do not retry |
| `E_UNVERIFIED_FORM` | form contract is `verified:false` (`it_confirmation`, `specialist`); pass `options.allowUnverified=true` to override | do not retry |
| `E_UPSTREAM` | the Forms handler returned `success:false`; its message is passed through and `error.upstream` carries the raw result | read the message (usually data/state); retry only if it says so |
| `E_FORBIDDEN` | the real session principal (efx-bot) lacks the role (HR/IT/Admin/requester/manager); `error.principal` names it | do not retry until the group membership changes |
| `E_NOT_FOUND` | workflow not found, or no open task of that formType for the workflow | check the ids; do not retry |
| `E_ALREADY_CLOSED` | the task is already Closed | treat as success (idempotent close) |
| `E_TASK_NOT_OPEN` | the task is Cancelled (or otherwise not Open), or its workflow is Cancelled | NOT a success — do not retry; the workflow was cancelled |
| `E_RATE_LIMITED` | a bump reminder was already sent recently for this step (one per step per hour) | retry later |
| `E_INTERNAL` | unexpected exception inside the alias layer | retry once after a minute; if it repeats, send us the requestId |

Note: the wrappers pass `E_ALREADY_CLOSED` through as `{ok:true, alreadyClosed:true}` unless `treatAlreadyClosedAsSuccess:false`; `E_TASK_NOT_OPEN` is never treated as success.

Success output = alias `result` **flattened** + `ok:true, fn, requestId, apiVersion, tookMs` (+ `record`, `employeeId` when the alias adds them).

## Alias wrapper ↔ `N8n.js` map

| Wrapper | Alias | Wrapper inputs → alias args |
|---|---|---|
| `10 Forms · Create Initial Request` | `n8n_createInitialRequest(actor, data, include)` | required `firstName lastName hireDate requesterEmail reportingManagerName reportingManagerEmail positionTitle siteName jobSiteNumber employmentType(Hourly\|Salary) employeeType(Direct Hire\|Agency) newHireOrRehire systemAccess`; optional `requesterName dateRequested systems[] equipment[] plan306090 jrRequired jrAssignment comments`; other contract keys via `extra{}`; `includeRecord`. Returns `workflowId, formId, internalEmployeeId, message`. |
| `11 Forms · Submit ID Setup` | `n8n_submitIdSetup(actor, data, include)` | required `workflowId siteDocsWorkerId siteDocsJobCode(Hourly 1\|Hourly 2\|Salary 1\|Salary 2\|Supervisor\|Manager) dssUsername dssPassword`; optional `siteDocsUsername siteDocsPassword setupNotes bossWisCreated siteDocsBadgeCreated`. **Never pass `internalEmployeeId`.** |
| `12 Forms · Close JR Task` | `n8n_closeJrTask(actor, idOrWorkflow, notes)` | `idOrWorkflow` (TK-… or NEW_EMP_…), `notes` |
| `13 Forms · Assign Safety Training` | `n8n_assignSafetyTraining(actor, workflowId, details)` | `workflowId`, `siteDocsConfirmed`, `dssConfirmed`, `notes`, `siteDocsNotes`, `dssNotes`, `dryRun` (a "No" now needs `force:true` via the Router directly) |
| `14 Forms · Get Workflow` | `n8n_getWorkflow(actor, workflowId)` | `workflowId` |
| `15 Forms · List Tasks` | `n8n_listTasks(actor, filter)` | `workflowId formType status assignedTo taskId` → `filter{}` |
| `16 Forms · Close Task` | `n8n_closeTask(actor, params)` | `taskId` \| `workflowId`+`formType`, `notes`, `checklist{}`, `formData{}`, `dryRun` |
| `17 Forms · Create Equipment Request` | `n8n_createEquipmentRequest(actor, data, options)` | required `firstName lastName siteName managerEmail managerName position`; optional `reqName reqEmail systems[] equipment[] department comments` + `extra{}`; `includeRecord`, `allowUnverified` → `options` |
| `18 Forms · Create Termination Request` | `n8n_createTerminationRequest(actor, data, options)` | required `reqName reqEmail empName empType siteName termDate lastDayWorked reason managerName managerEmail has_reports`; conditional `hr_approved` (reason=Terminated), `reports_to_new` (has_reports=Yes); optional `empWorkEmail systems[] equip[] google_* comments` + `extra{}`. Arrays are sent comma-joined (UI shape). |
| `19 Forms · Submit Termination Approval` | `n8n_submitTerminationApproval(actor, data, options)` | `workflowId`, `decision(Approved\|Rejected)`, `notes` — **HR/Admin principal** |
| `21 Forms · Create Position Change Request` | `n8n_createPositionChangeRequest(actor, data, options)` | required `firstName lastName currentClass effDate siteName`; optional raw HTML keys (`changeType[] siteOld/siteNew titleOld/titleNew classOld/classNew mgrOld*/mgrNew* jrReq jrTitle sys[] equip[] rem[] equipRem[] …`) + `extra{}` |
| `22 Forms · Submit Position Change Approval` | `n8n_submitPositionChangeApproval(actor, data, options)` | `workflowId`, `decision`, `notes`, `confirmedTitle`, `confirmedNewManager`, `confirmedJrTitle` — **HR/Admin principal** |
| `23 Forms · Submit IT Setup` | `n8n_submitItSetup(actor, data, options)` | required `workflowId Email_Created Computer_Assigned Phone_Assigned BOSS_Access` (Yes\|No); optional `Email_* Computer_* Phone_* Incidents_Access CAA_Access Delivery_App_Access Net_Promoter_Score_Access IT_Notes`; dynamic `BOSS_Cmte_<site>` / `BOSS_CostSheet_<job>` via `extra{}` — **IT/Admin principal**; first submit creates the `jr_title` task |
| `24 Forms · Submit HR Verification` | `n8n_submitHrVerification(actor, data, include)` | required `workflowId firstName lastName managerName managerEmail jobTitle adpAssociateId`; optional `hireDate jrTitle siteName department notes` — **HR/Admin principal** |
| `25 Forms · List Workflows` | `n8n_listWorkflows(actor, filter)` | `type status step since employeeName limit offset` → `{ workflows[], count, total }` |
| `26 Forms · Get Context` | `n8n_getContext(actor, workflowId)` | `workflowId` |
| `27 Forms · Workflow Actions` | `n8n_cancelWorkflow(actor, workflowId)` / `n8n_bumpWorkflow(actor, workflowId, targetStep)` / `n8n_updateHireDate(actor, workflowId, newDate)` | `action` (`cancel`\|`bump`\|`updateHireDate`), `workflowId`, `targetStep`, `newDate` |
| `28 Forms · Save Task Draft` | `n8n_saveTaskDraft(actor, taskId, notes, checklist)` | `taskId`, `notes`, `checklist{}` |
| (call `00` directly with `fn`) | `n8n_ping`, `n8n_info`, `n8n_contracts`, `n8n_getEmployeeId(actor, workflowId)`, `n8n_events(actor, params)`, generic `n8n_createWorkflow(actor, form, data, options)` / `n8n_submitForm(actor, form, data, options)` | `args` = the positional args after `actor` |

Every wrapper also accepts `actor` (object) and `idempotencyKey`; closers accept `treatAlreadyClosedAsSuccess`; create/submit
wrappers accept `includeRecord` (and `allowUnverified` where the alias takes `options`). Pass the actor from the *calling*
workflow for correct attribution: `{{ { id: 'n8n:' + $workflow.name, email: 'efx-bot@team-group.com', display: $workflow.name + ' (n8n)' } }}`.

## George: replacing "Mark Portal JR Complete" in `J7RU99n01pq9Xk3D` (BOSS JR Assignment — PROD portal)

Today the node POSTs `{secret, action:'completeJrTitle', workflowId: portalTicketId, itemName}` to the `doPost` web app (@76,
anonymous, secret in body). Replace it with an Execute Workflow call into `12_Forms_CloseJrTask`:

1. Import `12_Forms_CloseJrTask.json` (after `00`). Note its id.
2. Open `BOSS JR Assignment (COPY - PROD portal)`. Select the node **Mark Portal JR Complete** and delete it.
3. Paste `snippets/George_MarkPortalJrComplete_replacement.json` onto the canvas (Ctrl+V) — it lands at the old node's position
   (1952, 304) with a sticky. In the node, pick **Forms · Close JR Task** in the *Workflow* field (or replace `<<CLOSE_JR_TASK_WORKFLOW_ID>>` before pasting).
   The inputs are pre-filled:
   - `idOrWorkflow` = `{{ $('Find Row by Employee').first().json.portalTicketId }}` (tracker column K, `TK-…`)
   - `notes` = BOSS job/user ids from `Assign JR in BOSS`
   - `actor` = `{ id:'n8n:boss-jr-assignment', email:'efx-bot@team-group.com', display:'BOSS JR Assignment (n8n)' }`
   - `idempotencyKey` = `jr-close-<portalTicketId>-<executionId>`; `treatAlreadyClosedAsSuccess` = true (a re-click of the approval button is a no-op instead of an error)
4. Wire it **on the BOSS-success path**, exactly where the old node sat: `Apply Duty Changes → Forms · Close JR Task (EFX) → Confirm to George`.
   The node has *On Error → Continue (using error output)*: connect its **error output** to `Email George — Error` so a Forms-side failure
   (`EFX E_NOT_FOUND: No open jr_title task for …`, `E_TASK_NOT_OPEN` for a cancelled workflow, transport errors) still emails George and returns the error page.
5. Optional: add `{{ $('Forms · Close JR Task (EFX)').first().json.taskId }}` to the "Confirm to George" email.
6. If the tracker row has no `TK-` id (older rows), pass the `NEW_EMP_…` workflow id instead — the alias resolves the single open `jr_title` task itself.
7. After a week of overlap, retire the `doPost` deployment @76 (and the dead `portal-complete-jr-item` Lambda + its cookie secret).

## Reference flows for George (`40`, `41`) — inactive, staging only

**`40_Ref_Onboarding_via_EFX` — hourly onboarding, event-driven.** Rebuild of `mw4aXq7lq5W1EQBy` on the `result` event:
`Every minute → Load cursor → Router: n8n_events (kinds ['result'], sources ['submitInitialRequest']) → Normalise event → Hourly? →
Map title codes → SiteDocs: Create Worker → Litmos: Find Manager → Resolve Manager ID → Build DSS user + password → Litmos: Create User →
Forms · Submit ID Setup → Done`. Salary hires end in a NoOp stub. Every external node's error output → one Gmail to **dbinns**.
- The blocker in George's draft ("employee number isn't in the email") is gone: `internalEmployeeId` is in the event payload, minted at submit.
- SiteDocs node = George's exact shape; `EmployeeNumber` is now the real id. His Location/QR steps can be inserted after it unchanged.
- `Map title codes` keeps his 2026-09-11 SiteDocs scheme (HRLY-U / Site-Sup – Union …) **and** derives the Forms `siteDocsJobCode` (`Hourly 1` / `Supervisor`) that ID Setup requires — the two code sets are different.
- DSS username = his confirmed scheme (initials + hireDate + site abbrev); **password is generated per run** and only sent to Litmos and Forms.
- `Forms · Submit ID Setup` sends the r2 required keys and **no `internalEmployeeId`**; Forms advances to HR Verification and sends its own emails.
- Swap the first three nodes for the *Apps Script Router Trigger* community node when it exists (`router/n8n-nodes-efx-appscript`).

**`41_Ref_OpenTasks_Digest` — weekday 08:00 open-task digest.** `Weekdays at 08:00 → Workflow Configuration → Forms · List Tasks (status Open) →
Group by Assigned To → Build Email Content (CCF reminder style, one per item) → Send Reminder Email`.
- `recipientOverride` = `dbinns@team-group.com` until approved (subject prefixed `[TEST → <assignee>]`); blank it to send to real assignees. `ccList`, `minTasks`, `portalUrl` (deep links) in *Workflow Configuration*.

## Events poller (`20`) notes
- Cursor = workflow static data (`afterEventId`, `afterTs`, `seen[]`); persisted **only for active-workflow executions**. A manual run always reads the last 24 h and does not move the cursor.
- `pruned:true` (cursor row aged out of the Raw Log) → cursor reset to `afterTs = now - 1 day`; the seen-set suppresses re-delivery of the overlap.
- Kinds: `submit` (form payload as posted) and `result` (post-write, has `workflowId/formId/internalEmployeeId/employeeName/employmentType/siteName/positionTitle/hireDate/managerEmail`) — emitted for `submitInitialRequest` and `submitEmployeeIDSetup`. The Initial Request / ID Setup outputs fire on `result`.
- Task events (`task.created` / `task.closed`) **are emitted** by `Services/ActionItemService.js` (`rawLogEvent_`) with taskId, workflowId, category, formType, assignedTo/closedBy; the Switch output is wired so a `task.created {formType:'jr_title'}` trigger can replace the Gmail regex later (cutover plan §5.6).

## E2E test (`90`) notes
- Targets whatever script the selected Router points at — **use a Router bound to the TEST script**.
- The TEST script's Script Properties must have **`EMAIL_REDIRECT_ALL`** set; the run sends real Initial Request and HR Verification emails.
- Core steps 1–9 create one `NEW_EMP_` workflow "EFX Test Hire<stamp>" (site Aurora, hireDate today+14, `employeeType:'Direct Hire'` per the r2 enum) and an ID Setup row; cancel it from the TEST dashboard afterwards (the Summary lists every id created).
- Step 7 expects **0** `jr_title` tasks: the JR task is only created at **IT Setup** (`ITSetupHandler.js`), which the test does not submit. Steps 7b/7c run only when `<<EXISTING_JR_TASK_ID>>` is given (dryRun via `n8n_closeTask` first, then real `n8n_closeJrTask`).
- Step 8 accepts either `EFX E_NOT_FOUND` (default, `SAFETY_TRAINING_AT_SUBMIT=false`) or a `dryRun:true` result (`SAFETY_TRAINING_AT_SUBMIT=true`).
- Step 6b (second ID Setup must be rejected) is **optional** — reported as WARN, never fails the run.
- **Optional steps 10–12** run only when `RUN_EXTENDED = true` in the *Test config* Code node (default `false` → reported SKIPPED, core run unchanged): 10 `n8n_createTerminationRequest` → 10b `n8n_submitTerminationApproval` Approved → 11 `n8n_createPositionChangeRequest` → 11b `n8n_submitPositionChangeApproval` Approved → 12 `n8n_listWorkflows` since start contains our ids. The two approvals report **WARN** (not FAIL) when efx-bot is not HR/Admin on the TEST tier. They create TERM_/CHANGE_ workflows plus offboarding/change action items — cancel those too.

## Canary (`30`) notes
Through the Execution API the script runs as the impersonated user, so `callerSession` is `authenticated` (never `anonymous`) —
the canary asserts `env` and `spreadsheetId` instead. Imported **inactive**; activate after replacing placeholders.
