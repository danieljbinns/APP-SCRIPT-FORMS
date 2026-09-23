# EFX TEST tier — test plan (one test at a time)

Target under test: TEST Apps Script (`TEST_SCRIPT_ID`, API-executable deployment `TEST_API_DEPLOYMENT_ID`) bound to the TEST
spreadsheet copy (`TEST_SHEET_ID`), called from n8n staging through `00_EFX_Router` with credential `EFX Google SA (test)`
(SA `efx-router@<project>` impersonating `efx-bot@team-group.com`). Values come from the Values sheet in
`SETUP_PLAN_TOMORROW.md`.

Global preconditions (re-check before every mutating test — T4 onward):
- `listScriptProperties()` on TEST shows `EMAIL_REDIRECT_ALL = dbinns@team-group.com` and `SPREADSHEET_ID = TEST_SHEET_ID`.
- Prod ids nowhere in TEST properties or n8n nodes.

Where to look:
- **Sheet**: the TEST copy — tabs `Initial Requests`, `Employee IDs`, `ID Setup Results`, `Action Items`, `Raw Log`, `Workflows`.
- **Email**: dbinns@team-group.com inbox; every redirected message carries the original recipient in the body/subject marker inserted by `EmailUtils` (search `"REDIRECT"` or the workflow id).
- **n8n**: Executions list of the workflow you ran (`ok`, `error.code`, `requestId` are in the Router output item). Errors also go to the Router's error workflow if configured.
- **GAS**: editor → Executions (each Execution-API call appears as type "API Executable", user `efx-bot@team-group.com`); Cloud Logging in `<GCP_PROJECT_ID>` for `console`/`Logger` output (`exceptionLogging: STACKDRIVER`).

Response envelope (every alias, `N8n.js`): success `{ ok:true, apiVersion:'2026.09.17-1', requestId:'REQ-…', result:{…} }`;
failure `{ ok:false, apiVersion, requestId, error:{ code, message, fields? } }` with codes `E_VALIDATION`, `E_UNKNOWN_FORM`,
`E_NOT_FOUND`, `E_ALREADY_CLOSED`, `E_UPSTREAM`, `E_INTERNAL`. The Execution API wraps that as
`{ done:true, response:{ result:<envelope> } }`; a thrown script error comes back as `{ done:true, error:{ code:3, details:[{ errorMessage, errorType:'ScriptError' }] } }`.

---

## T0 — Editor self-test `efxSelfTest()`

| | |
|---|---|
| Preconditions | §5–§6 of setup done: properties set, migration applied. |
| Action | Apps Script editor (TEST) → select `efxSelfTest` → Run → open Execution log. |
| Expected | JSON with `ping.ok:true`, `ping.result.spreadsheetId == TEST_SHEET_ID`, `ping.result.libraryVersion == '2026.09.16-r2'` (FormContracts.VERSION), `ping.result.apiVersion == '2026.09.17-1'`, `contracts:true`, `dryRunClose.ok:false`, `dryRunClose.error.code == 'E_NOT_FOUND'` (task `TK-NONE` does not exist — that *is* the pass condition; it proves `efxTaskClose` reached the Action Items sheet). Execution status "Completed". |
| Verify | Log only. No sheet writes, no emails. |
| If it fails | `spreadsheetId` is the dev default `1o2Kul…` → `SPREADSHEET_ID` property missing. `ReferenceError: FormContracts is not defined` → push incomplete (`clasp status`, `clasp push -f`). `E_INTERNAL` mentioning `Action Items` → wrong sheet / tab renamed in the copy. |

## T1 — Execution API ping with a raw OAuth token (no n8n)

| | |
|---|---|
| Preconditions | T0 passed. §2 SA key, §3 DWD authorised, §4 efx-bot exists, §5 GCP link + API-executable deployment. |
| Action (negative control first) | `gcloud auth print-access-token --impersonate-service-account=efx-router@<project>.iam.gserviceaccount.com --scopes=https://www.googleapis.com/auth/script.projects` → this is a token **for the SA itself** (no DWD subject). Call `:run` with it (same body as below). |
| Expected (negative) | `403 PERMISSION_DENIED` / `The caller does not have permission` — the Execution API does not run scripts for service-account identities. Documented so nobody spends an hour on it tomorrow. *(If it unexpectedly succeeds, note it — it means the deployment's access is wider than intended.)* |
| Action (positive) | Mint a DWD token as efx-bot, then call `scripts.run` — commands in the block directly below this table. |
| Expected (positive) | HTTP 200, `done:true`, `response.result.ok:true`, `response.result.result.spreadsheetId == TEST_SHEET_ID`, `callerSession:'authenticated'`, `deploymentUrl == TEST_WEBAPP_URL`. GAS Executions page shows a row: type API Executable, user `efx-bot@team-group.com`. |
| Verify | GAS Executions (user must be efx-bot, not dbinns). No sheet writes. |
| If it fails | `unauthorized_client` at token mint → DWD row missing / client id wrong / scope list differs from §3. `invalid_grant` → efx-bot missing or suspended. `404 Requested entity was not found` → use `<TEST_API_DEPLOYMENT_ID>` instead of the script id in the URL (record which works — that is `<<EFX_SCRIPT_ID>>`). `403 caller does not have permission` → script not linked to the SA's GCP project (Project Settings) or no API-executable deployment or efx-bot cannot see the script file (share as Viewer). `401 invalid authentication credentials` → token missing a scope the script needs; the token must carry all 10 manifest scopes (default list in `print-dwd-token.js`). `ScriptError … Authorization is required` → efx-bot has not consented and DWD scope list lacks one of the manifest scopes. |

T1 positive-path commands (PowerShell; `<TEST_SCRIPT_ID>` → fall back to `<TEST_API_DEPLOYMENT_ID>` on 404):

```powershell
cd "P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_efx\migration"
$TOKEN = node print-dwd-token.js --key D:\Credentials\google\efx\efx-router-test.json --subject efx-bot@team-group.com
$body  = '{"function":"n8n_ping","parameters":[],"devMode":false}'
Invoke-RestMethod -Method Post -Uri "https://script.googleapis.com/v1/scripts/<TEST_SCRIPT_ID>:run" `
  -Headers @{Authorization="Bearer $TOKEN"} -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 8
```

curl equivalent:

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"function":"n8n_ping","parameters":[],"devMode":false}' \
  "https://script.googleapis.com/v1/scripts/<TEST_SCRIPT_ID>:run"
```

## T2 — n8n Router ping

| | |
|---|---|
| Preconditions | T1 positive passed. §8 credential + `00_EFX_Router` imported with placeholders replaced. |
| Action | Open `00_EFX_Router` → pin/enter test input `{ "function":"n8n_ping", "parameters":[] }` (or run the wrapper that pings, if one exists) → **Test workflow**. |
| Expected | Final node output: `ok:true`, `result.spreadsheetId == TEST_SHEET_ID`, `result.apiVersion == '2026.09.17-1'`; the Router's guard passes (no Stop-and-Error). Execution shows green. |
| Verify | n8n execution detail; GAS Executions row with user efx-bot. |
| If it fails | HTTP node `401/403` → credential: wrong private key paste (must include header/footer lines), Impersonate toggle off, or scopes not set in the credential ("Set up for use in HTTP Request node"). `404` → `<<EFX_SCRIPT_ID>>` replaced with the wrong value (see T1). Guard node fails on `ok` → Router expects `response.result` unwrapping; check the node that extracts `$json.response.result`. |

## T3 — Contracts

| | |
|---|---|
| Preconditions | T2 passed. |
| Action | Router with `{ "function":"n8n_contracts", "parameters":[] }` (or the `_contracts` wrapper). |
| Expected | `ok:true`; `result.contractsVersion == '2026.09.16-proto'`; `result.aliases` has 13 entries (`n8n_ping` … `n8n_events`); `result.forms[]` includes `new_hire` (`verified:true`, `required` has 13 fields incl. `firstName`,`hireDate`,`systemAccess`), `id_setup` (`verified:true`, `required: workflowId, siteDocsWorkerId, siteDocsJobCode, dssUsername, dssPassword`), and `hr_verification` with `verified:false`. |
| Verify | n8n output only. Save the JSON — it is George's field reference until `docs/N8N_CONTRACTS.md` is generated. |
| If it fails | `E_INTERNAL` → `FormContracts.list()` threw; run `n8n_contracts()` in the editor to see the stack. |

## T4 — Create an initial request (New Hire) via n8n

| | |
|---|---|
| Preconditions | T3 passed. `EMAIL_REDIRECT_ALL` confirmed. `Employee IDs` tab exists (migration). Note the current max in `Employee IDs!A` and `ID Setup Results!D` (call it `MAX0`). |
| Action | Wrapper `10_…` (create initial request) or Router with `{ "function":"n8n_createInitialRequest", "parameters":[ {"id":"n8n:t4","email":"efx-bot@team-group.com","display":"EFX T4"}, <payload>, ["record"] ] }`. Payload = the `new_hire` contract's required set with obviously synthetic values: `firstName:"Efx"`, `lastName:"TestFour"`, `hireDate:"2026-10-01"`, `requesterEmail:"dbinns@team-group.com"`, `requesterName:"EFX Test"`, `reportingManagerName:"EFX Manager"`, `reportingManagerEmail:"dbinns@team-group.com"`, `positionTitle:"EFX Test Position"`, `siteName:<a real value from Reference_Sites>`, `jobSiteNumber:<its job #>`, `employmentType:"Hourly"`, `employeeType:"Hourly"`, `newHireOrRehire:"New Hire"`, `systemAccess:"Yes"`, `systems:["BOSS"]`, `jrRequired:"Yes"`, `plan306090:"Yes"` (the last two so T7 has a JR task later). |
| Expected | `ok:true`; `result.success:true`; `result.workflowId` matches `NEW_EMP_YYYYMMDD-HHMMSS_NNN`; `result.formId` present; `result.internalEmployeeId == MAX0 + 1` (≥ 30000 by `FLOOR`); `record` (header-keyed `Initial Requests` row) has `"Internal Employee ID": <same id>`. |
| Verify (sheet) | `Initial Requests`: new last row, col **BD** = id. `Employee IDs`: new row `[id, workflowId, "Efx TestFour", <timestamp>, efx-bot@team-group.com, submitInitialRequest, ""]`. `Workflows`: row with `Current Step = ID Setup Needed`. `Raw Log`: two new rows for this workflow — `Kind=submit` (`Source=submitInitialRequest`, raw payload) and `Kind=result` (JSON containing `internalEmployeeId`), both with `Event ID` `EVT-…` and `User = efx-bot@team-group.com`. |
| Verify (email) | dbinns inbox receives the redirected "Request Submitted" (to requester) and "ID Setup Required" (to `grp.forms.idsetup`) emails; neither reached the real group (check the group's inbox is unchanged if you can — ID Setup members would notice). The ID Setup link points at `TEST_WEBAPP_URL?form=id_setup&wf=…`. |
| If it fails | `E_VALIDATION` with `fields` → payload missing/typed wrong (contract from T3 is authoritative). `E_UPSTREAM` with `upstream.message` about Employee ID → `EmployeeIdRegistry.allocate` threw (registry tab missing or `Employee IDs!A` contains non-numeric junk). Emails arrive at real recipients → **stop everything**, `setEmailRedirect()` was not set; apologise to the group. `Actor` shows `dbinns` not `efx-bot` in `Allocated By` → the call did not go through DWD (T1 positive path). |

## T5 — ID Setup via n8n (pre-assigned id used; HR Verification email redirected)

| | |
|---|---|
| Preconditions | T4 workflow `WF4` exists at step `ID Setup Needed`; its id `ID4` in `Employee IDs`. |
| Action | Wrapper `11_…` (submit ID setup) or Router `n8n_submitIdSetup` with `{ "workflowId":"<WF4>", "siteDocsWorkerId":"SD-T5", "siteDocsJobCode":<a value from Reference_JobCodes>, "dssUsername":"efx.t5", "dssPassword":"x", "setupNotes":"T5 via n8n", "bossWisCreated":"No" }` — **omit** `internalEmployeeId`. |
| Expected | `ok:true`; `result.success:true`; `result.internalEmployeeId == ID4` (not recomputed). |
| Verify (sheet) | `ID Setup Results`: new row, col D = `ID4`, `Submitted By = efx-bot@team-group.com`. `Employee IDs`: **no new row** for WF4 (idempotent). `Workflows`: `Current Step = HR Verification Needed` (or the equivalent label). `Raw Log`: `submit` + `result` rows for `submitEmployeeIDSetup`. |
| Verify (email) | Redirected "HR Verification Required" email in dbinns inbox showing Internal Employee ID `ID4`. |
| Negative variant | Same call with `"internalEmployeeId":"99999"` and no `overrideEmployeeId` → `ok:false`, `E_UPSTREAM`, message `Internal Employee ID is pre-assigned (<ID4>) and cannot be changed here.`; no row written. |
| If it fails | `E_VALIDATION` on `siteDocsJobCode` → must be a `Reference_JobCodes` value. `success:false` "workflow not found" → wrong `WF4`. id differs from `ID4` → `IDSetup.js` still recomputing — code regression, stop. |

## T6 — Human UI path still works (portal, prefilled id)

| | |
|---|---|
| Preconditions | `TEST_WEBAPP_URL` deployed (§5). You are in-domain. A second New Hire is needed (do it in the UI). |
| Action | Open `TEST_WEBAPP_URL` → New Hire form → submit a synthetic hire (`Efx TestSix`, same style as T4). Note the workflow id from the success screen. Then open `TEST_WEBAPP_URL?form=id_setup&wf=<WF6>` (or click the link in the redirected "ID Setup Required" email). |
| Expected | Success screen shows the new request. ID Setup page's **Internal Employee ID** input is prefilled with the id that `Employee IDs` already holds for `WF6` (= T4's id + 1, or +1 from whatever was allocated in between) — and reloading the page shows the **same** number (the old behaviour recomputed `max+1` per load). Submit ID Setup with the prefilled value → success; `ID Setup Results!D` = that id. |
| Verify | `Employee IDs` row for WF6 has `Allocated By = dbinns@team-group.com`, `Source = submitInitialRequest` (human path also allocates at submit). Redirected emails as in T4/T5. Dashboard (`TEST_WEBAPP_URL`) lists WF6 with the right step badge. |
| If it fails | Page shows a different id than the registry → `IDSetup.js:22` fallback path taken (`EmployeeIdRegistry.get` returned null) — registry row missing (check T4 path wrote one for UI submits too). Portal 401/login loop → deployment access set to "Only myself" — redeploy as Anyone within domain. Browser E2E automation is not attempted (memory: GAS sandbox iframe defeats it) — this test is manual. |

## T7 — JR: create a `jr_title` task, close it via `12_Forms_CloseJrTask`, second run → `alreadyClosed`

| | |
|---|---|
| Preconditions | `EMAIL_REDIRECT_ALL` set (SuperDebug's `checkSuperDebugEmailSafety()` throws otherwise). `jrRequired:"Yes"` on the workflow. |
| Action A (fast) | Editor → `sdRunJrTitleE2E(false, true)` → `byWorkflow=false, createOnly=true`: drives New Hire → ID Setup → HR Verification → IT Confirmation → IT Setup on a synthetic `SdFirst SdLast`, and **leaves the `jr_title` task Open**. Log/return has `workflowId` (`WF7`), `jrTaskId` (`TK-…`), `reviewTaskId`. |
| Action A (alt, UI) | Take WF4 through HR Verification → IT Confirmation → IT Setup in the portal (each step's link arrives in the redirected emails); after IT Setup, `Action Items` gains a `jr_title` row assigned to `grp.forms.jrtitle@team-group.com`, name `JR Assignment — Efx TestFour`. |
| Action B | Wrapper `12_Forms_CloseJrTask` with `idOrWorkflow = <TK-… from A>` (also test the `NEW_EMP_…` form on a second workflow), `notes = "T7 via n8n"`. |
| Expected B | `ok:true`; `result.taskId == TK-…`, `result.workflowId == WF7`, `result.success:true`. |
| Verify B | `Action Items`: that row `Status = Closed`, `Closed By = efx-bot@team-group.com` (Actor email — not the old literal `JR Automation (n8n)`), `Completed Date` set, `Draft` JSON has the checklist item `Complete` with `by: efx-bot@…`. The `review_306090` row for the same workflow is **still Open**. Redirected "task completed" email if the handler sends one. `Raw Log` has the `result` row if `closeActionItem` logs one. |
| Action C | Run B again with the same id. |
| Expected C | `ok:false`, `error.code == 'E_ALREADY_CLOSED'`, message `Task TK-… is already closed` (or `… for WF7 (jr_title) is already closed` for the workflow-id form). No sheet change. The wrapper should treat this as a soft success (spec 12 §3) — check how `12_…` branches it. |
| If it fails | `E_NOT_FOUND` on B → no open `jr_title` task: `jrRequired` was `No`, or IT Setup not yet submitted. `E_UPSTREAM` → `ActionItemService.closeActionItem` refused; read `upstream.message`. Cleanup after: `cleanupSuperDebugWorkflow('<WF7>')` (optional on TEST). |

## T8 — Safety: `setSafetyTrainingAtSubmit(true)`, create request, `13_Forms_AssignSafetyTraining` closes it

| | |
|---|---|
| Preconditions | T4 passed. Editor → run `setSafetyTrainingAtSubmit(true)` → returns `{SAFETY_TRAINING_AT_SUBMIT:true}`; `listScriptProperties` confirms. |
| Action A | T4 again (new synthetic `Efx TestEight`) → `WF8`. |
| Expected A | In addition to T4's expectations: `Action Items` has a `safety_onboarding` row for `WF8` **immediately** (created at submit), assigned to the Safety group; redirected "Safety Onboarding" email in dbinns inbox. `Workflows` step still `ID Setup Needed` (safety runs in parallel). |
| Action B | Wrapper `13_Forms_AssignSafetyTraining` with `workflowId = WF8`, details `{ "siteDocsConfirmed":"Yes", "dssConfirmed":"Yes", "notes":"T8 via n8n" }`. |
| Expected B | `ok:true`; `result.taskId`, `result.success:true`. `Action Items` row → `Closed`, `Closed By = efx-bot@…`, `Form Data` JSON `{ siteDocsConfirmed:"Yes", dssConfirmed:"Yes", source:"n8n" }`, `Draft` shows both checklist items `Complete`. |
| Action C | Repeat B → `E_ALREADY_CLOSED`. Then `dryRun:true` variant on a fresh WF → `result.dryRun:true, wouldClose:true`, no change. |
| Teardown | `setSafetyTrainingAtSubmit(false)` → verify property. (Default off; turning it on for real is a Safety-team decision.) |
| If it fails | No `safety_onboarding` row at submit → property not read (`CONFIG.SAFETY_TRAINING_AT_SUBMIT` is `getSetting(...) === 'true'` — the setter writes `'true'`; check `listScriptProperties`). `E_NOT_FOUND` on B with flag off → expected (task is created at ID Setup for hourly / after HR for salary); this alias closes "whichever exists". |

## T9 — Events poller sees the events

| | |
|---|---|
| Preconditions | T4–T8 produced `Raw Log` rows with `Event ID`/`Kind`. |
| Action | Router `n8n_events` with `{ "afterTs":"<ISO time just before T4>", "kinds":["result"], "limit":50 }`; then activate `20_Forms_EventsPoller` and let it run one interval (or Test workflow). |
| Expected | `result.events[]` in chronological order, each `{ eventId:'EVT-…', ts, kind:'result', source:'submitInitialRequest'|'submitEmployeeIDSetup'|…, workflowId, actor:'efx-bot@…'|'dbinns@…', payload:{…internalEmployeeId…} }`; `result.nextAfterEventId` = last event id; `pruned:false`. Poller execution stores the cursor (workflow static data) and emits one item per event; a second run with the stored cursor returns `events:[]` (nothing new) and `pruned:false`. Use a bogus `afterEventId:"EVT-NOPE"` → `events` from the start and `pruned:true` (cursor not found). |
| Verify | n8n execution items vs `Raw Log` rows (count match). |
| If it fails | `Event ID` column blank on rows → migration not applied before those writes (rows before F1:G1 existed have blanks; filter by `afterTs`). Poller re-emits everything each run → cursor not persisted (static data only saves on **activated** runs, not on Test workflow). |

## T10 — Canary

| | |
|---|---|
| Preconditions | T2 passed; `30_EFX_Canary` imported with `<<EXPECTED_TEST_SHEET_ID>>` replaced. |
| Action | Activate `30_EFX_Canary`; wait one schedule tick (or Test workflow). |
| Expected | Green execution: `n8n_ping` `ok:true` **and** `spreadsheetId == EXPECTED_TEST_SHEET_ID` **and** `apiVersion == '2026.09.17-1'`. Negative: temporarily edit the canary's expected sheet id to `x` → next run fails → error workflow/alert fires (email to dbinns if wired) → revert. |
| Verify | Executions list every N minutes; alert received on the forced failure. |
| If it fails | Fails on `apiVersion` → the fork bumped `N8N_API_VERSION`; update the canary's constant (that is what it is for). Fails on sheet id → someone changed `SPREADSHEET_ID` on TEST (or the canary is pointed at the wrong tier). |

## T11 — Negative tests

| # | Action | Expected | Verify |
|---|---|---|---|
| 11a bad field | `n8n_createInitialRequest` with `hireDate:"01/10/2026"` and `firstName` missing | `ok:false`, `error.code:'E_VALIDATION'`, `error.fields` lists `hireDate` (type `yyyy-MM-dd`) and `firstName` (required); **no** row in `Initial Requests`/`Employee IDs`/`Raw Log` (validation precedes the handler) | sheet unchanged; n8n item shows the fields array |
| 11b unknown workflow | `n8n_getWorkflow` with `"NEW_EMP_00000000-000000_000"` | `ok:false`, `E_NOT_FOUND` | — |
| 11c unknown task | `n8n_closeJrTask` with `"TK-DEADBEEF"` | `ok:false`, `E_NOT_FOUND`, `Task not found: TK-DEADBEEF` | `Action Items` unchanged |
| 11d unknown form | `efxRunAs`/Router with `function:"n8n_submitFooBar"` | Execution API `error.code:3`, `ScriptError`, message like `Script function not found: n8n_submitFooBar` — surfaces as the Router's transport/guard failure, not an envelope | Router error branch taken |
| 11e wrong alias for form | `n8n_submitIdSetup` with a `new_hire` payload | `E_VALIDATION` `Payload failed contract for id_setup` | — |
| 11f revoked SA | In the SA key: `gcloud iam service-accounts keys disable <keyId> --iam-account=<SA_EMAIL>` (reversible with `enable`) → run T2 | HTTP node fails with `400 invalid_grant` / `401` at token exchange — a **transport** error before any envelope; Router error workflow fires; GAS Executions shows **no** row | re-enable the key; T2 green again |
| 11g DWD scope removed | Admin console → edit the DWD row → remove `spreadsheets` → wait 5 min → T2 | token mint `unauthorized_client` **or** run succeeds but script throws `You do not have permission to call SpreadsheetApp.openById` (ScriptError) — either way `ok` is never `true` | restore the scope; re-test |
| 11h prod-id guard (Node tool) | `node migrate-efx-sheet.js --sheet 1kGjw8e-uIehaBemlsRZ4Yq1QrYOWkJvWzhKbgfl4Pxo` | exits `3` with `Refusing: … LIVE PROD spreadsheet` before any API call (verified 2026-09-16) | — |

---

## T12 — Behaviours added by the overnight review passes (run after T4; 15 min)

| # | Action | Expected | Verify |
|---|---|---|---|
| 12a principal | `n8n_ping` via the Router | `result.principal === 'efx-bot@team-group.com'` (from the editor it is your own email) | if empty or yours → impersonation broken; stop before T5 |
| 12b dedupe, different hire | two `n8n_createInitialRequest` within 30 s, same `requesterEmail`, different `firstName/lastName` | two different `workflowId`s and two different `internalEmployeeId`s | `Workflows` has two rows; `Employee IDs` two rows |
| 12c dedupe, same hire | repeat the first payload of 12b within 30 s | same `workflowId`, same `internalEmployeeId` as the first call (double-submit guard) | one extra `Initial Requests` row, no new `Employee IDs` row |
| 12d carried id typo | `n8n_createInitialRequest` with `newHireOrRehire:'Rehire'`, `existingInternalEmployeeId:'EMP-1234567890'` | `ok:false`, `E_UPSTREAM`, message `must be a 4-6 digit number` | no `Workflows` row created |
| 12e record redaction | `n8n_submitIdSetup(actor, {...}, ['record'])` (wrapper `11` with `includeRecord` on) | `record['DSS Password'] === '[REDACTED]'`, `record['DSS Username']` visible | — |
| 12f forbidden | with `efx-bot` **not** in `grp.forms.hr`: `n8n_submitHrVerification` | `ok:false`, `E_FORBIDDEN`, `error.principal === 'efx-bot@team-group.com'` (not `E_UPSTREAM`) | then decide D2 (add the group) and re-run → `ok:true` |
| 12g draft merge | `n8n_saveTaskDraft(actor, TK, 'note A', {item1:{status:'Complete'}})` then `n8n_saveTaskDraft(actor, TK, undefined, {item2:{status:'Pending'}})` | Draft cell has **both** items; Notes still `note A`; task still Open | `Action Items` row |
| 12h dryRun as string | `n8n_closeTask(actor, {taskId: TK, dryRun: "true"})` | `dryRun:true`, task still Open (string handled) | then `dryRun:"false"` → real close (only after the safe-tier refactor lands; else boolean only) |
| 12i events tail | `n8n_events({afterEventId: <old id>, limit: 50})` on a Raw Log > 1500 rows | correct events, `pruned:false`; timing < 5 s | Apps Script execution log duration |
| 12j lock | 5 parallel `n8n_createInitialRequest` (n8n Split In Batches, batch size 5) | 5 distinct ids, no gaps/duplicates; or `E_INTERNAL` "could not obtain the allocation lock" on some (retry) — never a duplicate id | `Employee IDs` sheet |

---

## Results table (copy into the ticket)

| Test | Date/time | Run by | Result (PASS / FAIL / SKIP) | Evidence (workflowId / taskId / requestId / execution id) | Notes / follow-up |
|---|---|---|---|---|---|
| T0 efxSelfTest | | | | | |
| T1 neg (SA token) | | | | | |
| T1 pos (DWD token) | | | | `<<EFX_SCRIPT_ID>>` = scriptId / deploymentId ? |
| T2 Router ping | | | | | |
| T3 contracts | | | | | |
| T4 create initial request | | | | WF4 = , ID4 = | |
| T5 ID Setup via n8n | | | | | |
| T5 neg (override refused) | | | | | |
| T6 UI path | | | | WF6 = | |
| T7 JR close | | | | WF7 = , TK = | |
| T7 second run alreadyClosed | | | | | |
| T8 Safety at submit + close | | | | WF8 = | flag reset to false? |
| T9 events poller | | | | | |
| T10 canary (+forced fail) | | | | | |
| T11a–h negatives | | | | | |
| T12a–j overnight behaviours (principal, dedupe, redaction, forbidden, draft merge) | | | | | |

Cleanup on TEST (optional — it is a copy): `cleanupSuperDebugWorkflow('<wf>')` per synthetic workflow, or leave them and trash the copy when the dev tier takes over.
