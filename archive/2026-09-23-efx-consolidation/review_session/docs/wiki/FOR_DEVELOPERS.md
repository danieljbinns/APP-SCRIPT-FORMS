# EFX for developers — changing Forms without breaking n8n

For anyone (human or agent) who edits `employee_management_v2_efx/`. Companion to `../../AGENTS.md`
(rules, short) and `../../employee_management_v2_efx/AGENTS.md` (per-project rules).

---

## 1. The change rule

Every function n8n can call and every field it can send is declared in `FormContracts.js`. That file is the
contract. When you touch anything a contract describes, you update the contract in the same change.

```
Touched…                                   → You must…
──────────────────────────────────────────    ───────────────────────────────────────────────────────
a submit*/close*/get* function signature    → update the FormContracts entry (fn, required, optional)
a form field (HTML name=, handler key,      → update required/optional/types/enums; re-run
  sheet column, formatXxxData order)          form-field-map-test; update docs/mapping/<form>.md
a handler's return object                   → update responseFields; if a field is removed → BREAKING
an n8n_* alias name/params/return           → keep old alias as a deprecated shim; bump N8N_API_VERSION
ActionItem formType strings                 → check n8n_closeJrTask / n8n_assignSafetyTraining literals
a sheet name or SCHEMA index used by EfxApi → update EfxApi.js (efxTaskList/efxTaskClose use SCHEMA.ACTION_ITEMS)
```

**Breaking vs additive**

| Additive (no version bump needed, but bump `FormContracts.VERSION`) | Breaking (bump `N8N_API_VERSION`, deprecation window, tell George) |
|---|---|
| New optional field | Field becomes required |
| New alias | Field renamed/removed |
| New optional return field | Return field removed/renamed |
| New form contract | Alias renamed/removed without shim |
| New enum value | Enum value removed |

`N8N_API_VERSION` is `'YYYY.MM.DD-n'` (currently `2026.09.17-1`). `FormContracts.VERSION` is
`'YYYY.MM.DD-proto'` until first TEST deploy, then `'YYYY.MM.DD'`. Both are returned by `n8n_contracts()`.

**Then run:**

```bash
cd employee_management_v2_efx
node __tests__/super-test.js            # handlers, sheet writes, emails, workflow state (mock GAS)
node __tests__/efx-test.js              # aliases (27), validation, principal-vs-actor auth, id allocation, JR/safety/generic close, events, other forms, envelope helpers (error mapper, parse, bool, draft, redaction) — 190 assertions
node __tests__/migration-test.js        # migrateEfx dry-run/apply/idempotency + Employee IDs backfill (what §6 of the setup plan runs) — 42 assertions
node __tests__/efx-e2e-test.js          # full chains for every workflow type; 122 emails captured (never sent) → docs/test-logs/; --strict fails on recorded defects (580 + 3 recorded)
node __tests__/form-field-map-test.js   # HTML name= → handler key → sheet column for every form
```

and the n8n check: `node tools/n8n-check.js` (local, exists — fails on breaking contract change without an `N8N_API_VERSION` bump); live variant once the TEST script exists: push to TEST, call
`n8n_contracts()` through the Router, diff `hash` per form against the last published set, fail on drift.

---

## 2. Where things are

```
employee_management_v2_efx/
├── N8n.js                  alias layer — public surface only (n8n_*, N8N_ALIASES, N8N_API_VERSION, N8N_ERROR_CODES)
├── N8nEnvelope.js          private helpers behind the aliases (actor/envelope/guard/options/submit, bool, parse, error mapper)
├── EfxApi.js               primitives the aliases use (task list/close, events, record read, list, runAs) + efxRowToRecord_/efxParseDraft_/efxWorkflowStatus_
├── EfxUtil.js              pure shared helpers: EFX_SECRET_KEY_RE, efxRedact_, efxJsonSafe, efxSign_
├── FormContracts.js        contracts + CALLABLE allow-list + validate()
├── Actor.js                request-scoped identity
├── EmployeeIdRegistry.js   Internal Employee ID allocator ('Employee IDs' sheet)
├── RawLog.js               v2: Event ID/Kind, rawLogResult, signed fan-out (logging only; helpers in EfxUtil.js)
├── InitialRequestHandler.js   EFX edits: allocate id, rawLogResult, SAFETY_TRAINING_AT_SUBMIT, response.internalEmployeeId
├── IDSetup.js                 EFX edits: show pre-assigned id, use it on submit, admin-only override, rawLogResult
├── Config.js                  EFX flags (SAFETY_TRAINING_AT_SUBMIT, EFX_EVENT_WEBHOOK_URL), SHEETS.EMPLOYEE_IDS/RAW_LOG
├── Services/ConfigurationService.js   DEFAULTS for the EFX keys (all off/empty)
├── SchemaConstants.js         INITIAL_REQUESTS.INTERNAL_EMP_ID: 55; EMPLOYEE_IDS schema
├── EmailUtils.js              getWorkflowContext → context.preassignedEmployeeId
├── Setup.js                   setters: setSafetyTrainingAtSubmit, setEfxEventWebhook, clearEfxEventWebhook, efxSelfTest
├── MigrationTools.js          bottom: migrateEfxDryRun/Apply, migrateEfxBackfillDryRun/Apply
├── Services/ActionItemService.js, HRVerificationHandler.js, ITSetupHandler.js …  Session → Actor.email()
├── .clasp.json                scriptId = REPLACE_ME_… (TEST). NEVER prod 1AuIbJl1jR…
└── __tests__/                 gas-runtime.js (mock), efx-fixtures.js (shared LOAD_ORDER/headers/seedBase), super-test.js, form-field-map-test.js, efx-test.js, efx-e2e-test.js, migration-test.js
```

---

## 3. File-by-file

### `N8n.js` — the alias layer

- `N8N_API_VERSION` — string, bump on breaking change.
- `N8N_ALIASES[]` — `{ name, kind:'read'|'create'|'update'|'close', desc, form? }`; returned by `n8n_info()` and
  `n8n_contracts()`. Add a row whenever you add an alias.
- `N8N_ERROR_CODES[]` — `{ code, meaning, n8n }` for every `error.code` the layer returns. **Source of truth** for the
  "Error codes" table in `docs/N8N_CONTRACTS.md` (rendered by `tools/gen-contracts.js`) and for `n8n/README.md`;
  `efx-test.js` fails if an `E_*` literal in `N8n.js`/`N8nEnvelope.js`/`EfxApi.js` is missing from it.
- Helpers (private, `_` suffix) live in **`N8nEnvelope.js`**: `n8nActor_(actor)` normalises string/object → `{id,email,display}`;
  `n8nOk_(result, extra)` / `n8nErr_(code, message, extra)` build the envelope with a `REQ-XXXXXXXX` id;
  `n8nGuard_(fn)` turns thrown errors into `E_INTERNAL`; `n8nParse_(v, fallback)` accepts a JSON string, an object or
  nothing; `n8nBool_(v)` accepts `true | 'true' | 'yes' | '1'` (n8n sends string booleans) — used for every
  `dryRun`/`force`/`allowUnverified`; `n8nMapHandlerError_(res, fallbackCode, { message, codes })` maps a handler's
  `success:false` message → `E_FORBIDDEN` (`/permission|access denied|not authori[sz]ed|forbidden/i`, adds `principal`)
  always, `E_NOT_FOUND` (`/not found/i`) and `E_RATE_LIMITED` (`/already sent/i`) only where the alias opts in
  (cancel → not-found, bump → rate-limited), else the fallback (`E_UPSTREAM`) — every alias keeps the codes it had;
  `n8nSubmit_(actor, form, data, expectCreate, options)` is the generic create/update path: `FormContracts.get` →
  `E_UNKNOWN_FORM`; `createsWorkflow` mismatch → `E_VALIDATION`; `FormContracts.validate` → `E_VALIDATION` + `fields`;
  handler missing → `E_INTERNAL`; `Actor.run(a, () => fn(data))`; `success:false` → `n8nMapHandlerError_`;
  `include:['record']` → `efxReadRecord(targetSheet, workflowId)`.
- Public aliases: see FOR_GEORGE §2 for the table. Signature convention: `n8n_<verb><Noun>(actor, ...)`. Reads
  accept `actor` for attribution symmetry even when unused.
- Envelope: `{ ok:true, apiVersion, requestId, result, [record], [recordWarning], [employeeId] }` or
  `{ ok:false, apiVersion, requestId, error:{ code, message, [fields], [upstream] } }`.

### `EfxApi.js` — primitives

| Function | Does | Notes |
|---|---|---|
| `efxInfo()` | `{ env, spreadsheetId, libraryVersion, callerSession }` | `spreadsheetId` is `CONFIG.SPREADSHEET_ID` as resolved by *this* script's properties — the canary asserts it |
| `efxContracts()` / `efxContract(form)` / `efxValidate(form, data)` | thin wrappers over `FormContracts` | |
| `efxRunAs(actorJson, fnName, argsJson)` | runs an allow-listed top-level function under an actor; result → `efxRedact_(efxJsonSafe(out))` | throws if `!FormContracts.isCallable(fnName)`; used by the generic Router "Call Function" op; `getStepResultData(wf,'id_setup')` comes back with passwords `[REDACTED]` (review pass 2 L8) |
| `efxRowToRecord_(headers, row)` | one sheet row → `{ <header>: value }` (blank headers skipped, Dates → ISO via `efxJsonSafe`) | the single mapping behind `efxReadRecord` and `efxListWorkflows` |
| `efxReadRecord(sheetName, workflowId)` | header-keyed newest row where col A == workflowId | `efxRowToRecord_` + `efxRedact_` (credential columns → `[REDACTED]`) |
| `efxParseDraft_(cell)` | Draft cell (string or parsed object) → `{ items:{…} }`; lifts legacy `{checkedItems:[…]}` (→ Collected) and flat maps | shared by `efxTaskClose` and `n8n_saveTaskDraft` (which merges into it) |
| `efxWorkflowStatus_(ss, workflowId)` | `Status` of the Workflows row (`SCHEMA.WORKFLOWS.STATUS`), `''` if missing | used by `efxTaskClose` to refuse tasks of Cancelled workflows |
| `efxTaskList(p)` | filter `Action Items` by `taskId/workflowId/formType/status/assignedTo` | parses `description` JSON and `draft` |
| `efxTaskClose(actorJson, p, dryRun)` | resolve task (`taskId` or `workflowId+formType` → single Open), build draft with every non-`__` item `Complete` unless `checklist` overrides, then `Actor.run(actor, () => ActionItemService.closeActionItem(taskId, notes, by, draftJSON, formDataJSON))` | returns `{code,message}` for `E_VALIDATION`, `E_NOT_FOUND`, `E_ALREADY_CLOSED` (only a **Closed** row), `E_TASK_NOT_OPEN` (task Cancelled/not Open — also by `workflowId+formType` — or its **workflow** is Cancelled, checked before the dry-run return), `E_UPSTREAM`; `by = actor.email || display || id || 'automation'` |
| `efxEmployeeIdGet(workflowId)` / `efxEmployeeIdAllocate(actorJson, workflowId, employeeName)` | registry read / idempotent allocate | allocate records `source:'efx.employeeId.allocate'` |
| `efxEventsSince(p)` | scan Raw Log by header names; cursor by `afterEventId` (exclusive) or `afterTs`; filter `kinds[]`, `sources[]`; `limit` ≤ 1000 | `pruned:true` when the cursor id is not found (fell off the 5000-row window) |

### `FormContracts.js`

- `C` — the map. Keys: `form, kind:'workflow'|'step', prefix, createsWorkflow, verified, fn, targetSheet,
  idField?, required[], optional[], types{}, enums{}, notes?, responseFields?`.
- `CALLABLE` — every `C[*].fn` plus an explicit read/action list (`getRequestDetails`, `getWorkflow`,
  `getDashboardData`, `cancelRequest`, `bumpRequest`, `updateHireDate`, `saveActionItemDraft`,
  `closeActionItemWithNotes`, …). `efxRunAs` refuses anything else.
- `list()` → summary rows; `get(form)` → full entry + `version` + `hash` (sha256 over `{required, optional, types, version}`);
  `validate(form, data)` → `{ ok, fields:[{field, problem}] }` — required present & non-empty, no unknown keys,
  array enums honoured (string enums like `'reference.sites'` are informational only); `isCallable(fn)`.
- `verified:true` today: `new_hire`, `id_setup`. Everything else must be reconciled against the HTML
  (`docs/mapping/`) before an alias is added.

### `Actor.js`

`run(actor, fn)` (saves/restores a module-level override), `email()` (override.email → Session → `''`),
`label()`, `isAutomation()`, `current()`, `canOverrideEmployeeId()` (email ∈ `CONFIG.ADMIN_EMAILS`).
Nesting is safe (`prev` restored in `finally`).

### `EmployeeIdRegistry.js`

Sheet `Employee IDs` (`SHEET`), `FLOOR = 30000`, `MAX_RETRY = 5`. `get(wf)`, `allocate(wf, meta)`, `peek()`
(display only), `info(wf)`. `allocate`: existing → return; `meta.existingEmployeeId` → record as `rehire-carry`;
else best-effort `LockService` + loop: `maxKnown_` (registry col A ∪ `ID Setup Results` col D ∪ FLOOR-1) + 1 →
append → re-read → lowest row with that id wins → else `deleteMine_` and retry. Throws after `MAX_RETRY`.

### `RawLog.js` v2 (+ `EfxUtil.js`)

`RAW_LOG_HEADERS` = 7 columns; `rawLog(source, formData)` (kind `submit`), `rawLogResult(source, wf, result)`
(kind `result`), `rawLogEvent_` writes + prunes + `rawLogFanOut_` (only if `EFX_EVENT_WEBHOOK_URL` set; signs
with `efxSign_(secret, env)` — stable-stringify payload → sha256 → canonical `v\nkid\nts\nnonce\naction\nhash` →
HMAC-SHA256 hex). Existing 5-column sheets are upgraded in place (headers 6–7 appended).

`EfxUtil.js` holds the pure helpers the log, the primitives and the aliases share — `EFX_SECRET_KEY_RE`
(`/password|passwd|pwd|secret|token|apikey|api_key|vm_?pin|Email_Temp_Password/i`), `efxRedact_(v)` (deep copy, matching
keys → `'[REDACTED]'`, empty values kept), `efxJsonSafe(v)` (Dates → ISO, depth 8) and `efxSign_(secret, env)`. All are
plain function declarations called only at runtime, so file order is irrelevant; callers keep the `typeof efxRedact_ === 'function'` guard.

### Edits in existing files

| File | Lines (approx.) | Edit |
|---|---|---|
| `InitialRequestHandler.js` | 37–48, 72–89, 119, 231 | allocate id after `formId`; `formData.internalEmployeeId`; `rawLogResult(...)`; flagged `sendSafetyOnboardingEmail` at submit; `internalEmployeeId` in response; `formatInitialRequestData` appends col 55 |
| `IDSetup.js` | 21–22, 136, 173–201 | pre-assigned id on page; no timestamp fallback (throws); use registry id on submit; admin-only override; `rawLogResult` |
| `Config.js` | 39–45, 77–78 | `SAFETY_TRAINING_AT_SUBMIT`, `EFX_EVENT_WEBHOOK_URL` getters; `SHEETS.EMPLOYEE_IDS`, `SHEETS.RAW_LOG` |
| `Services/ConfigurationService.js` | 26–29 | DEFAULTS `SAFETY_TRAINING_AT_SUBMIT:'false'`, `EFX_EVENT_WEBHOOK_URL:''`, `EFX_EVENT_KID:''` (secret has **no** default) |
| `SchemaConstants.js` | 113, 117–125 | `INITIAL_REQUESTS.INTERNAL_EMP_ID: 55`; `EMPLOYEE_IDS` block |
| `EmailUtils.js` | 457–466 | `context.preassignedEmployeeId` (separate from `internalEmployeeId` so `hasId` still means "ID Setup done") |
| `Setup.js` | 443–456 | setters + `efxSelfTest()` (ping + contracts + dryRun close; no writes) |
| `MigrationTools.js` | bottom | `migrateEfx(dryRun)` (+ `DryRun`/`Apply`), `migrateEfxBackfillEmployeeIds(dryRun)` (+ `DryRun`/`Apply`) |
| 13 submit handlers, `ActionItemService.closeActionItemWithNotes`, `RawLog` | — | `Session.getActiveUser().getEmail()` → `Actor.email()` |

---

## 4. How to add an alias

1. **Contract first.** If the form has no entry or is `verified:false`, reconcile `required/optional` against the
   HTML `name=` attributes and the handler (see `docs/mapping/<form>.md`); set `verified:true`; bump
   `FormContracts.VERSION`.
2. **Write the alias** in `N8n.js`, in the right section (read / create-update / close):
   ```js
   /** Termination request — real submitTerminationRequest. data = contract termination_request. */
   function n8n_createTerminationRequest(actor, data, options) {
     return n8nSubmit_(actor, 'termination_request', n8nParse_(data, {}), true, options);   // options: ['record'] | { include, allowUnverified }
   }
   ```
   For a task close with fixed semantics, follow `n8n_assignSafetyTraining`: build `p` with
   `workflowId, formType, notes, checklist, formData` and call `efxTaskClose(JSON.stringify(n8nActor_(actor)), p, dryRun)`.
3. **Register it** in `N8N_ALIASES` with `kind` and one-line `desc` (and `form` for submit aliases).
4. **Test**: add a scenario to `__tests__/efx-test.js` (envelope shape, validation failure with no writes,
   happy path writes + emails via `gas-runtime` captures). Run all three suites.
5. **Docs**: add the row to FOR_GEORGE §2; add the wrapper JSON to `n8n/` (or ask the n8n author to).
6. **Version**: additive → `FormContracts.VERSION` only. Breaking → also `N8N_API_VERSION`, keep old alias as a
   one-line shim that calls the new one and adds `deprecated:true` to the envelope `extra`.

Rules: no business logic in `N8n.js`; every alias goes through `Actor.run`; every mutating alias validates
against a contract or `efxTaskClose`; never call `SpreadsheetApp` from an alias.

---

## 5. Exposing another Apps Script project (the "registered project" pattern)

Any Apps Script project can join EFX. Per project, once:

| Step | What | Where |
|---|---|---|
| 1. Helper drop-in | Copy `Actor.js`, `FormContracts.js` (edit `C`), `EfxApi.js`, `N8n.js` (edit aliases), optionally `RawLog.js`, `EmployeeIdRegistry.js` if it mints ids | the project |
| 2. `AGENTS.md` | Copy `employee_management_v2_efx/AGENTS.md`, adjust names | the project root |
| 3. GCP link | Project Settings → *Change project* → the tier's `efx-<tier>` GCP project (Execution API requires caller and script in the same GCP project) | Apps Script editor |
| 4. API-executable deployment | `clasp deploy -d "efx-api v1"` with manifest `executionApi.access` set appropriately; record the deploymentId | the project |
| 5. Registry row *(planned)* | `EFX Registry (<tier>)` sheet: `project · scriptId · apiDeploymentId · gcpProject · enabled=TRUE · contractVersion · owner · registeredAt · notes` | tier Drive |
| 6. Smoke | Router → `n8n_ping` (assert `spreadsheetId`), `n8n_contracts` | staging n8n |
| 7. Tests | the project's own Node harness + `n8n-check` | repo |

The Router's *Project* dropdown reads the registry; *Function* dropdown reads `n8n_contracts().aliases`. No
Router code changes per project.

---

## 6. Tiers

| Tier | Script | Sheet | GCP *(planned)* | n8n | Rules |
|---|---|---|---|---|---|
| **TEST (this fork)** | new; create with `clasp create --type webapp --title "Employee Forms EFX TEST"`; put id in `.clasp.json` | new TEST copy (or a fresh sheet — code self-creates `Employee IDs`/`Raw Log`; run `migrateEfxDryRun` then `Apply` for `Initial Requests` col 56) | `efx-dev` | staging | `EMAIL_REDIRECT_ALL=dbinns@team-group.com`; `SPREADSHEET_ID` Script Property set to the TEST sheet; `TEST_SPREADSHEET_ID` unset |
| dev | `employee_management_v2_dev` (`1VI9tR0GCx…`) | `1o2Kul…` | `efx-dev` | staging | promote from TEST via runbook |
| prod | `employee_management_v2` (`1AuIbJl1jR…`) in `employee_forms_deployment` | `1kGjw8e…` | `efx-prod` | prod (`n8n-prod.team-group.com`) | **never from this fork**; existing `PROD_DEPLOY_RUNBOOK.md` + `migration/` |

`ConfigurationService` resolves **Script Property → coded default**, and the coded defaults are **dev** values.
Any tier without the right Script Properties silently uses the dev sheet and dev deployment URL. Always set
`SPREADSHEET_ID` and `DEPLOYMENT_URL` on a new script before the first push.

---

## 7. Secrets policy

- **No secret in the repo, ever.** `.clasprc.json`, `**/.env*` are gitignored. Script Properties are set from the
  editor via `Setup.js` setters (`setEfxEventWebhook(url, kid, secret)`, `setPortalSecret`).
- **Inbound auth is Google's.** Service-account key lives in the n8n credential (encrypted with
  `N8N_ENCRYPTION_KEY`); its *name/location* goes in Secrets Manager per the `team-n8n-infra` convention. Forms
  holds no inbound secret.
- **Outbound event signing** (`EFX_EVENT_SECRET`) is optional; if set, mirror the value in Secrets Manager
  `efx/<tier>/forms-event-secret` and rotate per RUNBOOKS.
- **Passwords in payloads** (`dssPassword`, `siteDocsPassword`) are written to the results sheet as today and
  emailed by the existing templates; `rawLogResult` deliberately never logs them. Do not add them to events.
- `PORTAL_SHARED_SECRET` (doPost @76) is legacy; superseded by EFX and retired with @76.

---

## 8. Never do

| Never | Because |
|---|---|
| Point `employee_management_v2_efx/.clasp.json` at prod `1AuIbJl1jR…` (or dev `1VI9tR0GCx…`) | `clasp push` from the fork would overwrite the live app |
| `clasp deploy` from this fork to any existing deployment id | @75 is the human portal, @76 is George's live JR endpoint |
| Write to a sheet from `N8n.js` or an n8n workflow | skips workflow state, emails, audit; see HOW_IT_WORKS §5 |
| Send email to a real group/person from TEST | keep `EMAIL_REDIRECT_ALL` set; verify with `n8n_ping().env` + spreadsheetId before any run |
| Put a coded prod id in `ConfigurationService.DEFAULTS` | defaults are dev on purpose; prod comes from Script Properties |
| Change `EmployeeIdRegistry` to a Script Property counter or drop the `ID Setup Results` max() read | breaks continuity with ~400 existing ids |
| Remove or rename an `n8n_*` alias without a shim + version bump | breaks George's wrappers silently |
| Trust a coded default for `SPREADSHEET_ID` in any tool that calls Forms | it is the dev sheet |
| Run `migrateEfxApply`/`migrateEfxBackfillApply` before `…DryRun` and reading the log | migrations are idempotent but header placement warnings must be read |
| Commit `.clasprc.json`, SA keys, `EFX_EVENT_SECRET`, n8n API keys | secrets policy |
