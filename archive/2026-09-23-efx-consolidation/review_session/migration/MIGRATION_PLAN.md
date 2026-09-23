# EFX sheet + property migration plan — TEST → dev → prod

Scope: the storage changes the EFX fork (`employee_management_v2_efx/`) needs to run. Code deploys are covered
in `docs/plans/SETUP_PLAN_TOMORROW.md` (TEST) and the prod runbook pattern below. Nothing in this plan edits a
data cell, deletes a row, or moves a column.

Sources of truth: `SchemaConstants.js` (`INITIAL_REQUESTS.INTERNAL_EMP_ID = 55`, `EMPLOYEE_IDS`), `Config.js`
(`SHEETS.EMPLOYEE_IDS`, `SHEETS.RAW_LOG`), `RawLog.js` (`RAW_LOG_HEADERS`), `EmployeeIdRegistry.js` (`HEADERS`,
`FLOOR = 30000`), `MigrationTools.js` (`migrateEfx`, `migrateEfxBackfillEmployeeIds`), `Setup.js` (EFX setters),
spec `05_EMPLOYEE_ID_TIMING_FIX.md` §4–6 and `11_PLAN_JR_AND_INITIAL_REQUEST.md` §2.1 "Sheets" / "Script Properties".

---

## 1. What changes

### 1.1 Spreadsheet (per tier: TEST copy → dev `1o2Kul…` → prod `1kGjw8e…`)

| Tab | Change | Why | Self-heals? |
|---|---|---|---|
| `Initial Requests` | + header `Internal Employee ID` at **col 56** (index 55) | `submitInitialRequest` now allocates the id at submit and `formatInitialRequestData` appends it as the 56th element; header-name readers (`getWorkflowContext`, `getIDSetupRequestData`) need the header to find it | No — the value would land in an unlabelled column; header must exist |
| `Employee IDs` | **new tab**, 7 headers | allocator registry (`EmployeeIdRegistry.allocate`): idempotent per workflow, append-then-verify, `max(registry ∪ ID Setup Results col D ∪ 29999)+1` | Yes — `EmployeeIdRegistry.sheet_()` creates it on first allocate; migrating first just makes the first submit faster and lets you inspect the empty tab |
| `Raw Log` | + headers `Event ID`, `Kind` at cols 6–7 | RawLog v2 appends event id + kind per row; `efxEventsSince()` (→ `n8n_events`) locates columns by header name | Yes — `rawLogEvent_` upgrades in place when `getLastColumn() < 7` |
| `ID Setup Results` | **no change** — col 4 `Internal Employee ID` stays the downstream read path (`EmailUtils`, `ITSetupHandler`, `HRVerification.html`) | continuity with ~400 existing ids | n/a |
| `Employee IDs` (optional backfill) | one row per historical `ID Setup Results` workflow | makes `max()` cheap and the registry complete; purely optional (allocator already scans `ID Setup Results` for `max`) | n/a |

Not in this migration (spec 12 dropped them): `Initial Request Approvals` tab, approval-mode properties.

### 1.2 Script Properties (per script)

| Property | TEST (tomorrow) | dev | prod | Setter |
|---|---|---|---|---|
| `SPREADSHEET_ID` | TEST copy id | *(unset → default dev `1o2Kul…`)* | `1kGjw8e…` (already) | editor → Project Settings → Script properties |
| `EMAIL_REDIRECT_ALL` | `dbinns@team-group.com` **before anything else** | `dbinns@team-group.com` | **empty** | `setEmailRedirect()` / `clearEmailRedirect()` |
| `DEPLOYMENT_URL` | TEST web-app `/exec` URL | dev portal URL | prod portal URL (already) | property |
| `MAIN_FOLDER_ID`, `TERM_ATTACHMENTS_FOLDER_ID`, `CHANGE_ATTACHMENTS_FOLDER_ID` | leave defaults (dev folders) unless TEST needs its own | defaults | prod ids (already) | property |
| `SAFETY_TRAINING_AT_SUBMIT` | `false` (flip to `true` only for T8) | `false` | `false` until agreed with Safety | `setSafetyTrainingAtSubmit(bool)` |
| `EFX_EVENT_WEBHOOK_URL` / `EFX_EVENT_KID` / `EFX_EVENT_SECRET` | empty (poller model, spec 12 §2) | empty | empty | `setEfxEventWebhook(url,kid,secret)` / `clearEfxEventWebhook()` |
| `PORTAL_SHARED_SECRET` | not needed on TEST | keep | keep until JR cutover retires @76 | `setPortalSecret()` |

Caution — `Config.js` in the fork has `const ENVIRONMENT = 'TEST'` (changed 2026-09-16 night; forced redirect is ACTIVE). If you ever copy these files into the real prod folder, the value must go back to `'PROD'`. Original note kept for context: The `EmailUtils` safeguard that forces a
redirect on non-PROD therefore does **not** fire on the TEST script; `EMAIL_REDIRECT_ALL` is the only thing
between a TEST submission and real inboxes. Set it first, verify with `listScriptProperties()`.
(Recommendation for the fork owner, not done here: set `ENVIRONMENT = 'TEST'` in the fork's `Config.js`
so `efxInfo().env` reports `TEST` and the safeguard is active.)

### 1.3 Deployments (per script)

- New **API Executable** deployment (`executionApi.access` is `ANYONE` in the fork's manifest; the Execution API additionally requires the caller's OAuth client to be in the script's GCP project, so "anyone" is bounded by project membership).
- Web-app deployment unchanged for dev/prod (portal stays `DOMAIN`).

---

## 2. Procedure (same four phases on every tier)

### 2.1 Dry-run

Two equivalent tools — use the editor one when the script already points at the sheet, the Node one when it doesn't yet (or when you want a report to paste into the ticket).

| | Editor (GAS) | Node |
|---|---|---|
| Structural | `migrateEfxDryRun()` → Execution log lines `[migrateEfx] WOULD …` | `node migration/migrate-efx-sheet.js --sheet <id> …` |
| Backfill | `migrateEfxBackfillDryRun()` → `[migrateEfxBackfill] WOULD add N, skipped M` | `… --backfill` |

Expected dry-run on a fresh prod copy (as of 2026-09-16 — verify tomorrow, see "unverified"):

```
+ WOULD add header 'Internal Employee ID' at 'Initial Requests'!BD1 (col 56)
= 'Raw Log' … either "already has" (if prod already has the 5-col Raw Log) → "+ WOULD add headers 'Event ID','Kind' at F1:G1"
+ WOULD create tab 'Employee IDs' with 7 headers
```

Stop conditions (do not apply): `x Precondition failed … col 55` (run `migrateAddMissingHeaders()` first — prod
got that header in the 2026-08-06 release, but a stale copy might not have it), `x … col 56 already holds …`,
`x 'Raw Log' cols 1-5 are …`.

### 2.2 Apply

`migrateEfxApply()` **or** `node … --apply`. Then optionally `migrateEfxBackfillApply()` / `--backfill --apply`.
Both are idempotent; running both is fine (second reports no-ops).

### 2.3 Verify

1. Sheet: `Initial Requests!BC1 = BOSS Training User Only`, `BD1 = Internal Employee ID`; `Employee IDs` tab present, headers exact, frozen row 1; `Raw Log!F1:G1 = Event ID | Kind` (if the tab exists).
2. Editor: `efxSelfTest()` → `ping.result.spreadsheetId` equals the tier's sheet id; `contracts === true`; `dryRunClose.error.code === 'E_NOT_FOUND'` (task `TK-NONE` does not exist — that is the expected outcome, proves the close path resolves the Action Items sheet).
3. First real allocation (TEST/dev only): submit a New Hire (UI or `n8n_createInitialRequest`) → `Employee IDs` gets a row with `Source = submitInitialRequest`, `Initial Requests` row has the same number in col 56, `Raw Log` has a `result` row for `submitInitialRequest` whose JSON contains `internalEmployeeId`.
4. `prodHealthPing()` returns `ok: true` (no `"success":false` in the last 16 min of Raw Log).

### 2.4 Rollback

| Change | Undo | Data impact |
|---|---|---|
| `Initial Requests!BD1` header | clear the cell | none — rows written before the EFX code have no col 56; rows written after keep their (now unlabelled) value |
| `Employee IDs` tab | delete tab **only if** no allocations have happened (`getLastRow() == 1`); otherwise keep — old code ignores the tab | if deleted after allocations, the next allocate recreates it and `max()` still falls back to `ID Setup Results` col D → ids stay continuous |
| `Raw Log!F1:G1` | clear the two cells | RawLog v1 readers use cols 1–5 positionally — unaffected |
| Backfill rows | delete rows where `Source = backfill:ID Setup Results` | none (they duplicate `ID Setup Results`) |
| Properties | `clearEmailRedirect()` etc. — but on TEST **leave** the redirect on | — |
| Code | redeploy the previous version (`clasp deploy -i <webappDeploymentId>` pinned to the recorded `@NN`) — the old code never reads the new headers | — |

Rollback of code does not require rollback of the sheet: every change is additive and ignored by pre-EFX code.

---

## 3. Tier schedule

### 3.1 TEST — 2026-09-17 (tomorrow)

Target: the **copy** of prod (`Employee Managment Forms — EFX TEST`). The prod id is hard-refused by the Node
tool and must not be entered in the TEST script's `SPREADSHEET_ID`. Steps and timing in
`docs/plans/SETUP_PLAN_TOMORROW.md` §4 (sheet) and §7 (migration). Backfill **yes** on TEST — it exercises the
code path and makes `n8n_getEmployeeId` return data for historical workflows in T3/T6.

### 3.2 dev — after TEST passes T0–T11

Sheet `1o2KulGLhpClbvbkYG-VqsaOJNQfAcpVZgRtc-FKpuAw`, script `1VI9tR0GCxwTmcuXiGBzTkDJVXXB94Hr3PpdnuDq-aBpDKKQGMKhA9U_L`.
Dev already has API-executable deployments (@102/@103) but is not linked to an EFX GCP project — link to
`efx-dev` (or reuse `efx-test` until a dev project exists; a script can be linked to exactly one project, so
if the TEST script and the dev script share a project the same SA can call both — acceptable for non-prod).
Procedure identical to TEST; the dev sheet may already have a `Raw Log` with 5 columns (expect the F1:G1 add).
Merge fork → `employee_management_v2_dev/` in the main repo happens here (not part of this plan).

### 3.3 prod — after a dev soak (≥ 1 week of George's workflows against dev with redirected emails)

Follow the runbook pattern of `employee_management_v2_dev/__tests__/PROD_DEPLOY_RUNBOOK.md` (live repo) and the code file list in `docs/plans/PROMOTION_PLAN_CODE.md` and spec 11 §4 step 2/7:

0. **Pre-flight**: prod props correct (`SPREADSHEET_ID = 1kGjw8e…`, `EMAIL_REDIRECT_ALL` empty); record rollback anchor `clasp list-deployments` → current portal `@NN` (portal is `AKfycbyXp4q0…`, currently @75 — verify live, the label is misleading); confirm no open maintenance; announce a 30-min window to HR/IT/ID-Setup groups (sheet writes are instant, but a New Hire submitted mid-migration is fine — additive).
1. **Sheet migration first, code second** (order matters only for the header: if the code lands first, the first submit writes col 56 under a blank header — harmless, `migrateEfx` then just labels it; but do it in this order anyway):
   `node migration/migrate-efx-sheet.js --sheet 1kGjw8e-uIehaBemlsRZ4Yq1QrYOWkJvWzhKbgfl4Pxo --key <efx-prod sa> --impersonate efx-bot@team-group.com --i-know-this-is-prod` (dry) → same with `--apply` → `--backfill --apply` (optional; ~400 rows).
2. **Code**: merge fork → `employee_management_v2/` (env-safe file list per the runbook §1; `Config.js` `ENVIRONMENT='PROD'`), `node --check`, `clasp push -f`, `clasp deploy -i <PORTAL_DEPLOYMENT_ID> -d "EFX: id-at-submit + n8n alias layer"`.
3. **GCP link**: Project Settings → change GCP project → `efx-prod` project number (this re-prompts the deploying user for consent; do it inside the window). Then Deploy → New deployment → API Executable → record deploymentId → n8n prod credential/registry.
4. **Verify**: §2.3 above + `ProdSmokeTest` (`runProdSmokeTest`, writes to its own test sheet) + one real New Hire watched end-to-end (id appears in the "Request Submitted" email).
5. **Rollback**: `clasp deploy -i <PORTAL_DEPLOYMENT_ID> -d rollback` pinned to the anchor version. Sheet changes stay (additive). GCP link can stay.
6. **Retire** (per `CUTOVER_PLAN_JR.md`): @76 anon endpoint after the JR parallel week — not part of the migration window.

---

## 4. Unverified (check tomorrow before relying on it)

- Whether prod's `Raw Log` tab exists and has exactly 5 columns (the memory note says `prodHealthPing` reads `Raw Log`, so it very likely exists). The tool handles both cases.
- Whether the prod copy's `Initial Requests!BC1` reads `BOSS Training User Only` (set by `migrateAddMissingHeaders()` in the 2026-08-06 release — expected yes). Abort condition if not.
- Exact prod `Initial Requests` header text for cols 1–54 vs the old `tools/migrate-prod-sheet/schema.js` list (that list predates `ADP Salary Access`/`BOSS Training User Only`; the tool only checks cols 55/56).
- `Employee IDs` `FLOOR = 30000`: confirm the highest id in prod `ID Setup Results` col D is ≥ 30000 (spec 05 says ~400 ids exist); if the real ids are below 30000 the first allocated id will jump to 30000 — a business decision, not a bug, but flag it.
