# Check & deploy plan — EFX TEST tier (2026-09-17)

The short, gated version of `SETUP_PLAN_TOMORROW.md`. Every gate has a command (or click) and the exact output that
means "go". If a gate fails, the plan says what to do instead of debugging into the afternoon. Times are targets.
**Rules of the day:** prod sheet `1kGjw8e…` and prod script `1AuIbJl1jR…` are never edited, pushed to or migrated.
No wrapper is pointed at PROD. Every real email stays redirected to dbinns@team-group.com.

## Gate 0 — Local proof before anything leaves the laptop (08:30, 10 min)
Run from the fork root (`P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_efx`):

```bash
cd employee_management_v2_efx/__tests__ && node super-test.js && node form-field-map-test.js && node efx-test.js && node migration-test.js && node efx-e2e-test.js && cd ../.. && node tools/gen-contracts.js && node tools/n8n-check.js && node tools/n8n-workflows-check.js
```

| Check | Go when | No-go action |
|---|---|---|
| `super-test.js` | `TOTAL: 159 passed, 0 failed` | stop — a prod-behaviour regression; read the `✗` lines |
| `form-field-map-test.js` | `ALL PASSED — 312` | stop — a field mapping broke |
| `efx-test.js` | `TOTAL: 195 passed, 0 failed` | stop — alias layer broken |
| `migration-test.js` | `TOTAL: 42 passed, 0 failed` | stop — do not run `migrateEfxApply` today |
| `efx-e2e-test.js` | `580 passed … ✅ green apart from 3 recorded defect(s)` | a **new** `✗` (not `DEFECT`) = stop |
| `n8n-check.js` | `OK: contracts compatible` | `BREAK` = the lock and the code disagree; do not import wrappers |
| `n8n-workflows-check.js` | `OK: 25 workflow file(s) lint clean` | fix the JSON before importing |
| `git status --short` | only intended changes; `.clasp.json` still `REPLACE_ME_…NEVER_PROD` | — |

## Gate 1 — Accounts and doors (08:45–10:10) → `SETUP_PLAN_TOMORROW.md` §1–§4
| Check | Go when |
|---|---|
| TEST sheet copy | `TEST_SHEET_ID` recorded; tab list equals prod; sharing = you only; `Initial Requests!BC1 = BOSS Training User Only` |
| GCP project | `gcloud projects describe <id>` returns a project **number**; Apps Script API + Admin SDK enabled; OAuth brand `orgInternalOnly: true` |
| Service account | key file exists at `D:\Credentials\google\efx\efx-router-test.json`; `SA_CLIENT_ID` (21 digits) recorded |
| DWD | Admin console shows the client id with the manifest scopes + `script.projects` |
| efx-bot | `gam info user efx-bot@team-group.com` → OU `/Bot Accounts`; `gam print admins user efx-bot@…` → Groups Reader; sheet ACL writer |

**No-go:** key creation blocked by org policy → stop at Gate 1; the day becomes "Forms TEST script + migration + editor smoke" (Gates 2–3) and n8n waits for an Org Policy exception. Record it in the morning-brief decisions.

## Gate 2 — TEST Apps Script project (10:10–10:55) → §5
```powershell
cd "P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_efx\employee_management_v2_efx"
clasp create --type webapp --title "Employee Forms EFX TEST"    # after removing the placeholder .clasp.json
clasp status ; clasp push -f
```
| Check | Go when |
|---|---|
| `.clasp.json` | new `scriptId` ≠ `1AuIbJl1jR…` (prod) and ≠ `1VI9tR0GCx…` (dev) — **compare character by character** |
| `clasp push -f` | `Pushed ~85 files.` and no `__tests__/` or `docs/` in `clasp status` |
| GCP link | Project Settings shows the `efx-test` project number |
| Script Properties | `SPREADSHEET_ID = TEST_SHEET_ID`, `EMAIL_REDIRECT_ALL = dbinns@team-group.com` (`listScriptProperties` log) |
| `efxSelfTest()` | `ping.result.spreadsheetId === TEST_SHEET_ID`, `ping.result.env === 'TEST'`, `ping.result.principal === 'dbinns@team-group.com'` (editor run), `contracts: true`, `dryRunClose.error.code === 'E_NOT_FOUND'` |
| Deployments | Web app (`DOMAIN`) URL recorded → `DEPLOYMENT_URL` property; API Executable deployment id recorded |

**No-go:** `spreadsheetId` shows `1kGjw8e…` → you typed the prod id. Fix the property before running anything else.

## Gate 3 — Sheet migration (10:55–11:10) → §6
| Step | Go when |
|---|---|
| `migrateEfxDryRun()` | log shows exactly 3 `WOULD` lines (IR col 56, `Employee IDs`, Raw Log cols 6–7) and **no** `WARNING` |
| `migrateEfxApply()` | same 3 lines with `DID`; second run → all `no-op` |
| `migrateEfxBackfillDryRun()` → `Apply()` | `added N, skipped M`; re-run adds 0 |
| Sheet | `Initial Requests!BD1 = Internal Employee ID`; `Employee IDs` tab exists; `Raw Log!F1:G1 = Event ID | Kind` |

**No-go:** `WARNING: Initial Requests has N columns` → run `migrateAddMissingHeaders`, re-dry-run. Never apply with a WARNING in the log.

## Gate 4 — First calls through the door (11:10–11:40) → §7, `TEST_PLAN.md` T0–T1
```powershell
$TOKEN = node migration/print-dwd-token.js --key D:\Credentials\google\efx\efx-router-test.json --subject efx-bot@team-group.com
Invoke-RestMethod -Method Post -Uri "https://script.googleapis.com/v1/scripts/<TEST_SCRIPT_ID>:run" -Headers @{Authorization="Bearer $TOKEN"} -ContentType "application/json" -Body '{"function":"n8n_ping","parameters":[],"devMode":false}'
```
| Check | Go when |
|---|---|
| Token | ~200+ chars; no `unauthorized_client` (else DWD not propagated — wait 5 min) |
| `n8n_ping` | `done: true`, `result.ok: true`, `apiVersion: 2026.09.17-1`, `spreadsheetId == TEST_SHEET_ID`, `env: 'TEST'`, **`principal: 'efx-bot@team-group.com'`** |
| 404 | retry with the API-executable **deployment id** in the URL; whichever works is `<<EFX_SCRIPT_ID>>` |

**Abort line 12:30:** T1 not passing → still do Gate 5 (import is independent), write "GCP door closed" in the wrap-up, stop debugging.

## Gate 5 — n8n staging import (12:30–13:30) → §8
1. Credential **Google Service Account API** `EFX Google SA (test)` — impersonate `efx-bot@team-group.com`, HTTP-node scopes = manifest + `script.projects`.
2. Import `00_EFX_Router.json` → copy its id → run the placeholder replace **including `<<ROUTER_WORKFLOW_ID>>`** (§8 script) → import `10`–`28`, `20`, `30`, `90`; `40`/`41` optional and **inactive**.
| Check | Go when |
|---|---|
| Placeholders | `Select-String '<<'` over the import copies returns nothing (40/41 may keep SiteDocs/Litmos placeholders — inactive) |
| Router HTTP node | credential dropdown = `EFX Google SA (test)` |
| Every wrapper | Execute Workflow node resolves to `00_EFX_Router` |

## Gate 6 — Smoke from n8n (13:30–14:30) → `TEST_PLAN.md` T2–T4, then T5–T8 if time
| Test | Go when |
|---|---|
| T2 Router ping | `ok:true`, `spreadsheetId == TEST_SHEET_ID`, `principal: efx-bot@…` |
| T3 contracts | `forms[]` has 11 forms; `new_hire`, `id_setup`, `hr_verification` `verified:true` |
| T4 create | `workflowId NEW_EMP_…`, `internalEmployeeId ≥ 30000`; IR row col BD filled; `Employee IDs` row; Raw Log `result` row; **two redirected emails in dbinns' inbox with `[TEST]` prefix** |
| T7 JR close | `n8n_closeJrTask` on the E2E-created task → `Closed`, `Closed By = efx-bot@team-group.com`; second call → `E_ALREADY_CLOSED` |
| Canary | activate `30_EFX_Canary` → next run green |

**Stop conditions:** any email reaches a non-dbinns inbox (→ `EMAIL_REDIRECT_ALL` missing: set it, delete the workflow run, note it); any write to the prod sheet (impossible if Gate 2 held — check `Workflows` on prod is unchanged at 16:00 anyway).

## Gate 7 — Wrap (15:30–16:00) → §10
- Values sheet complete; key file only under `D:\Credentials\google\efx\`; `git status` shows only `.clasp.json`.
- `clasp list-deployments 1AuIbJl1jR…` (read-only) unchanged vs the morning.
- Fill `TEST_PLAN.md` results; write the status note; list what did not run → tomorrow.

## Rollback map
| Gate | Undo |
|---|---|
| 1 | trash the sheet copy; `gcloud projects delete`; delete the SA key; remove DWD row; suspend `efx-bot` |
| 2 | trash the TEST script file; restore `.clasp.json` from `.clasp.json.placeholder.bak` |
| 3 | `MIGRATION_PLAN.md` §2.4 (clear `BD1`, delete `Employee IDs`, clear `F1:G1`) — on the TEST copy only |
| 5–6 | delete imported workflows + credential; Forms knows nothing about n8n |
