# EFX Runbooks

Step lists for recurring operations. Each one states its blast radius first. Steps marked *planned* refer to
components (registry sheet, Router node, `efx-bot@`, `efx-<tier>` GCP projects) that are designed but not built;
until then, the "pre-registry" alternative is given.

Conventions: `<tier>` ∈ `dev | staging | prod`; TEST = this fork's script on staging n8n. Never run a prod
runbook from the fork checkout.

---

## 1. Rotate the service-account key

**Blast radius:** every EFX call on that tier fails while the credential is wrong. Read-only aliases retry
safely; mutating aliases do not double-write (Forms guards) but will error.

1. Announce a 15-minute window to George (staging: optional).
2. GCP Console → project `efx-<tier>` → IAM → Service Accounts → the EFX SA → *Keys* → **Add key (JSON)**.
   Do not delete the old key yet.
3. n8n (<tier>) → Credentials → `EFX Router (<tier>)` (type *Google Service Account*) → replace *Private Key*
   (and *Service Account Email* if it changed); keep *Impersonate a user* = `efx-bot@team-group.com`; save.
4. Run the canary wrapper (`Forms · Canary`, *planned*) or manually execute the Router with
   `function: n8n_ping`. Assert `ok:true`, `result.env` and `result.spreadsheetId` match the tier.
5. Run one read (`n8n_listTasks {status:'Open', formType:'jr_title'}`) and one `dryRun:true` close.
6. GCP → delete the **old** key.
7. Update the *name/location* record in Secrets Manager (`efx/<tier>/gcp-sa-key`, value never stored in git);
   note the rotation date in `migration/` or the ops log.
8. Save the downloaded JSON nowhere persistent; delete the local file.

Rollback: re-add the previous key is impossible once deleted — that is why step 6 comes after step 5.

---

## 2. Add a project to the registry

**Blast radius:** none until a wrapper calls it.

Pre-requisites in the Apps Script project (see FOR_DEVELOPERS §5): helper files present, `AGENTS.md` present,
`n8n_ping`/`n8n_contracts` return sensibly in the editor (`efxSelfTest()`).

1. **Link GCP:** Apps Script editor → Project Settings → *Google Cloud Platform (GCP) Project* → *Change
   project* → enter the project number of `efx-<tier>`. (Requires the deployer to have `resourcemanager`
   permission on that project.)
2. **Enable APIs** on `efx-<tier>` (once per project): Apps Script API, Admin SDK, Sheets, Drive, Cloud Logging.
3. **Grant the bot:** `efx-bot@team-group.com` editor on the project's spreadsheet(s) and attachment folders.
4. **API-executable deployment:** in the project folder,
   `clasp deploy -d "efx-api v1"` (manifest `executionApi.access` is `ANYONE` in Forms — access is still gated
   by OAuth + sheet permissions). Copy the deploymentId.
5. **Set Script Properties** on the new script before first use: `SPREADSHEET_ID`, `DEPLOYMENT_URL`, tier folder
   ids; on TEST/dev also `EMAIL_REDIRECT_ALL`. Confirm with `listScriptProperties()` in the editor.
6. **Registry row** *(planned)*: open `EFX Registry (<tier>)`; append
   `project | scriptId | apiDeploymentId | gcpProject | enabled=TRUE | contractVersion (from n8n_contracts) | owner | registeredAt | notes`.
   Pre-registry: add the scriptId as a named option in the Router sub-workflow's *Project* parameter.
7. **Smoke from n8n:** Router → `n8n_ping` (check `spreadsheetId`), `n8n_contracts` (save the `hash` per form as
   the baseline for `n8n-check`).
8. Publish wrappers for the aliases George needs (`n8n/`), and add the project to `docs/wiki/README.md` map.

---

## 3. Disable a project

**Blast radius:** every wrapper pointing at that project fails with `E_FORBIDDEN` (registry) or a credential
error (pre-registry). Humans are unaffected.

Fast path *(planned)*:
1. `EFX Registry (<tier>)` → set `enabled = FALSE` on the row. Router refuses on next call.
2. Tell George which wrappers will error; they route to the error workflow.

Pre-registry:
1. n8n → deactivate the wrapper sub-workflows for that project (they are the only callers).
2. If the concern is the script itself: Apps Script editor → Deploy → Manage deployments → **archive** the
   `efx-api vN` deployment. **Do not touch** web-app deployments (@75 portal, @76 JR).
3. Emergency (credential compromise): GCP → disable/delete the SA key (Runbook 1, step 6 only) — this stops
   *every* project on the tier.

Re-enable = reverse the same step. Nothing in Forms needs to change.

---

## 4. Recover from a wrong tier

Scenario A — **a wrapper ran against prod when it should have hit TEST/dev** (or vice-versa).

**Blast radius:** real rows, real emails, real action items may have been created.

1. Stop the workflow (deactivate) immediately.
2. Identify what happened: in n8n, list executions of the wrapper; collect `requestId`s and `result.workflowId`s.
   In Forms, `n8n_listTasks`/`n8n_getWorkflow` by id, and the `Raw Log` rows with `User = efx-bot@…` in the window.
3. Classify:
   - **Reads only** → nothing to undo; fix the credential/registry pointer; document.
   - **Task closes** → cannot be "un-closed" by EFX (no path in Forms). Reopen via the dashboard admin path if
     one exists for that type, otherwise note in the task and inform the assignee group. The closure emails have
     already gone.
   - **New workflows created** (`n8n_createInitialRequest`) → use the dashboard admin action
     `adminDeleteWorkflows` (admin only; writes `Audit Log`) or `cancelRequest` with a reason. Inform the emailed
     groups (`ID Setup Required` went to `grp.forms.idsetup`). The allocated Internal Employee ID stays consumed
     — do not reuse it; the registry row remains as audit.
   - **Step submissions** (`n8n_submitIdSetup`) → the step advanced and "HR Verification Required" was sent.
     There is no automated revert; coordinate with HR/ID Setup by email, reference the workflow id.
4. Root-cause the pointer: which credential / registry row / hard-coded scriptId was wrong. Fix it, then add an
   assertion to the wrapper: `n8n_ping().result.spreadsheetId === <expected for tier>` before any mutating call
   (the canary already does this; wrappers should too).
5. Write the incident up in `docs/plans/` or the ops log with the `requestId`s.

Scenario B — **the TEST/dev script is pointed at the prod sheet** (Script Property `SPREADSHEET_ID` wrong).

1. `n8n_ping` shows `env:'PROD'`-like `spreadsheetId` `1kGjw8e…` from a non-prod script → stop everything.
2. Editor → `setSpreadsheetId(<tier sheet>)` (or `PropertiesService` directly); confirm with `listScriptProperties()`.
3. Audit writes as in Scenario A step 2–3. `Submitted By`/`Closed By` will say the actor email, which makes them
   findable.

---

## 5. Re-sync the events cursor

**Blast radius:** none in Forms. Risk is on the n8n side: replaying events → duplicate downstream actions.

When: `n8n_events` returns `pruned:true`; or the trigger workflow lost its static data; or after restoring n8n.

1. Find the last event you processed: the trigger workflow's static data `afterEventId`, or the last successful
   execution's output (`events[last].eventId`, `ts`).
2. Call `n8n_events(actor, { afterTs: '<last ts ISO>', kinds:['result'], sources:[…], limit: 500 })`.
   `afterTs` is exclusive; events with the same second may repeat — your downstream must be idempotent
   (`n8n_closeTask` is; SiteDocs/Litmos creation should check-before-create).
3. If the gap is older than the Raw Log window (~5000 rows), reconcile from state instead:
   `n8n_listTasks({status:'Open', formType})` for tasks; `n8n_getWorkflow` per open `NEW_EMP_` for ids.
4. Save `nextAfterEventId` from the response into static data; switch back to `afterEventId` polling.
5. If this recurs, raise `RAW_LOG_MAX_ROWS` in `RawLog.js` (Forms change, test suites, version bump) or shorten
   the poll interval.

---

## 6. Contract-drift incident

Symptoms: wrappers fail with `E_VALIDATION unknown field…`, `E_CONTRACT_DRIFT` (Router, *planned*), or the
`n8n-check` diff fails after a push.

**Blast radius:** affected wrappers error (no partial writes — validation happens before the handler).

1. **Freeze**: no further pushes to that tier's script until resolved.
2. **Diff**: run `n8n_contracts()` on the tier and compare each form's `required`/`optional`/`hash` with the
   baseline saved in `tests/` (or the last known wrapper mapping). Note `contractsVersion` and `apiVersion`.
3. **Decide who is wrong:**
   - Forms changed a field without updating the contract → fix `FormContracts.js` (and `docs/mapping/`), run
     `form-field-map-test.js` + `efx-test.js`, bump `FormContracts.VERSION`, push. This is a bug against the
     change rule (FOR_DEVELOPERS §1).
   - Forms deliberately renamed/removed → the change was breaking: restore the old name as a deprecated shim
     (alias or contract `optional` alias key handled in the alias), bump `N8N_API_VERSION`, announce, set a
     removal date.
   - Wrapper is stale → George refreshes the field mapping from `n8n_contracts()`.
4. **Verify**: run the wrapper with `dryRun:true` where available, then one real call on TEST.
5. **Baseline**: store the new `hash` set as the `n8n-check` baseline; update `docs/wiki/FOR_GEORGE.md` §2 if
   inputs changed.
6. **Post-mortem line** in `docs/plans/` (what changed, why the rule was missed, which test now catches it).

---

## 7. First TEST deployment of this fork (one-time; the current blocker)

**Blast radius:** none — new script, new sheet, redirected email.

1. `cd employee_management_v2_efx && clasp create --type webapp --title "Employee Forms EFX TEST"`; confirm the new
   scriptId is **not** `1AuIbJl1jR…`/`1VI9tR0GCx…`; it lands in `.clasp.json`.
2. Create/copy a TEST spreadsheet (copy of the dev sheet is fine). In the editor set Script Properties:
   `SPREADSHEET_ID`, `DEPLOYMENT_URL` (after first web-app deploy), `EMAIL_REDIRECT_ALL=dbinns@team-group.com`,
   folder ids. Leave `TEST_SPREADSHEET_ID` unset.
3. `clasp push`. In the editor run `migrateEfxDryRun()` → read log → `migrateEfxApply()`; optionally
   `migrateEfxBackfillDryRun()` → `…Apply()`.
4. Run `efxSelfTest()` — expect `ping.ok`, `contracts:true`, `dryRunClose.error.code === 'E_NOT_FOUND'`.
5. Link GCP (Runbook 2 step 1–3) once `efx-dev` exists; `clasp deploy -d "efx-api v1"`.
6. From staging n8n: `n8n_ping` via Router; then `n8n_createInitialRequest` with a fake hire → expect
   `internalEmployeeId`; `n8n_submitIdSetup`; drive to IT Setup in the UI; `n8n_closeJrTask` → `ok:true`; repeat →
   `E_ALREADY_CLOSED`.
7. Record deploymentId, scriptId, sheet id in `migration/` (not in the wiki), update `CLAUDE.md` status line.
