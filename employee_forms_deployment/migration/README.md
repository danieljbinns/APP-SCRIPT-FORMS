# EFX sheet migration (Node)

Node twin of `employee_management_v2_efx/MigrationTools.js` → `migrateEfx()` / `migrateEfxBackfillEmployeeIds()`.
Use it when you want to migrate a spreadsheet **without** opening the Apps Script editor (e.g. before the
TEST script exists, or for the prod window where the editor run would compete with live users).
Either path is fine — they are idempotent and produce identical headers/tabs. Run whichever, then the
other reports "no-op".

Plan: [`MIGRATION_PLAN.md`](MIGRATION_PLAN.md). Tomorrow's runbook: [`../docs/plans/SETUP_PLAN_TOMORROW.md`](../docs/plans/SETUP_PLAN_TOMORROW.md).

## What it changes (headers/tabs only — never a data cell)

| # | Tab | Change | Guard |
|---|---|---|---|
| 1 | `Initial Requests` | header **`Internal Employee ID`** at **col 56** (`BD1`) | col 55 (`BC1`) must be `BOSS Training User Only`; col 56 must be blank; else **abort** |
| 2 | `Employee IDs` | **new tab**, headers `Internal Employee ID · Workflow ID · Employee Name · Allocated At · Allocated By · Source · Note`, red band, frozen row | exists → no-op (header mismatch → warn, untouched) |
| 3 | `Raw Log` | headers **`Event ID`**, **`Kind`** at cols 6–7 (`F1:G1`) | only if the tab exists; cols 1–5 must be the known Raw Log headers; cols 6–7 blank; else **abort** |
| 4 | `Employee IDs` (`--backfill`) | one row per `ID Setup Results` workflow with a numeric id and no registry row yet: `[id, wf, '', ts, submittedBy, 'backfill:ID Setup Results', '']` | `ID Setup Results` col 4 header must be `Internal Employee ID` |

Prod id `1kGjw8e-uIehaBemlsRZ4Yq1QrYOWkJvWzhKbgfl4Pxo` is hard-refused unless `--i-know-this-is-prod`.

## Install

```powershell
cd "P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_efx\migration"
npm install
npm run check          # node --check both scripts
```

## Auth — pick one

| Option | Command fragment | Sheet must be shared with |
|---|---|---|
| Service-account key | `--key D:\Credentials\google\efx\efx-router-test.json` | the SA email (`efx-router@<project>.iam.gserviceaccount.com`) as **Editor** |
| SA key + DWD impersonation | `--key … --impersonate efx-bot@team-group.com` | `efx-bot@team-group.com` as **Editor** (this is what n8n will use — good end-to-end check of DWD) |
| Your own user via ADC | *(no flag)* — first: `gcloud auth application-default login --scopes=https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/cloud-platform` then `gcloud auth application-default set-quota-project <gcp-project-id>` | you (owner of the TEST copy) |

ADC gotcha: user ADC needs a **quota project with the Sheets API enabled** (`gcloud services enable sheets.googleapis.com --project <id>`), otherwise the API answers `403` even though you own the sheet. The error text from the tool says so.

Key files: keep under `D:\Credentials\google\efx\` (outside the repo). `migration/.gitignore` also excludes `service-account*.json` / `sa-*.json` in case one lands here.

## Run order

```powershell
# 1. dry run (reads only) — always first
node migrate-efx-sheet.js --sheet <TEST_COPY_ID> --key <sa.json> --impersonate efx-bot@team-group.com

# 2. apply
node migrate-efx-sheet.js --sheet <TEST_COPY_ID> --key <sa.json> --impersonate efx-bot@team-group.com --apply

# 3. (optional) seed the registry from ID Setup Results, dry-run then apply
node migrate-efx-sheet.js --sheet <TEST_COPY_ID> --key <sa.json> --impersonate efx-bot@team-group.com --backfill
node migrate-efx-sheet.js --sheet <TEST_COPY_ID> --key <sa.json> --impersonate efx-bot@team-group.com --backfill --apply
```

Exit codes: `0` ok · `1` usage/auth/dependency error · `2` schema abort (nothing further written) · `3` prod id without override.

## Reading the report

```
+ WOULD add header 'Internal Employee ID' at 'Initial Requests'!BD1 (col 56)
+ WOULD create tab 'Employee IDs' with 7 headers: …
= 'Raw Log' tab absent — RawLog.js creates it with all 7 headers on first write (no-op)
! title does not contain 'EFX TEST' — confirm this is the intended copy before --apply.
x Precondition failed: 'Initial Requests' col 55 header is '(blank)', expected 'BOSS Training User Only'
```

`x` lines stop the run. The usual cause on an older copy is that `BOSS Training User Only` (col 55) was
never written as a header — run `migrateAddMissingHeaders()` in the editor (or set `BC1` by hand) and re-run.

## Rollback

Everything is additive and header-level:

- `Initial Requests!BD1` → clear the cell (data rows never had col 56 populated before the EFX code ran).
- `Employee IDs` → delete the tab (only if the EFX code has **not** yet allocated ids into it — if it has, keep it; it is the allocator's source of truth).
- `Raw Log!F1:G1` → clear the two cells. Rows written by RawLog v2 carry values in F/G; clearing headers does not break v1 readers (they read cols 1–5 by position).

## `print-dwd-token.js`

Mints an access token **as** `efx-bot@team-group.com` (or any user) through the SA's domain-wide delegation,
for the `curl` tests in `docs/plans/TEST_PLAN.md` (T1). `gcloud auth print-access-token --impersonate-service-account`
cannot do this — it returns a token for the SA itself, which the Apps Script Execution API rejects.

```powershell
$TOKEN = node print-dwd-token.js --key D:\Credentials\google\efx\efx-router-test.json --subject efx-bot@team-group.com
```

`unauthorized_client` → DWD client id / scope list not authorised in the Admin console yet. `invalid_grant` → user missing/suspended or clock skew.
