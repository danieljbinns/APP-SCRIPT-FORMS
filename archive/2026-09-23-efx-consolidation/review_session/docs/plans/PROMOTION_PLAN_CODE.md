# Code promotion plan — fork → `employee_management_v2_dev` → `employee_management_v2` (prod)

Companion to `migration/MIGRATION_PLAN.md` (sheets, properties, deployments per tier), `CUTOVER_PLAN_JR.md`
(George's node) and the live repo's existing runbook `employee_management_v2_dev/__tests__/PROD_DEPLOY_RUNBOOK.md`
(the deploy mechanics used for the 2026-08 JR release — reuse its env-safe file list discipline). This file covers only **the code**: which files move, what must differ per tier, the gates, and the
rollback. Nothing here runs today; the TEST tier is deployed straight from the fork (`clasp create` on this folder).

## 0. Principles
- The fork is prod + EFX. Promotion is a **copy of specific files**, never a folder overwrite (dev has its own history, the
  live repo has `__tests__/`, docs and tooling of its own).
- Per-tier differences are confined to **three places**: `Config.js` (`ENVIRONMENT`), `.clasp.json` (script id), Script
  Properties (`SPREADSHEET_ID`, `EMAIL_REDIRECT_ALL`, `DEPLOYMENT_URL`, folder ids). Nothing else may differ between tiers.
- Every promotion ends with the same five suites green **in the target folder** and `node tools/n8n-check.js` = `OK`.

## 1. File list (regenerate before each promotion — the refactor pass may add helper files)
```bash
cd "P:/Repos/github/danieljbinns/APP SCRIPT FORMS"
MSYS_NO_PATHCONV=1 diff -rq --strip-trailing-cr -x __tests__ -x docs -x .clasp.json -x "*.txt" -x node_modules \
  employee_forms_deployment/employee_management_v2 employee_forms_efx/employee_management_v2_efx
```
As of 2026-09-16 23:30 (after the safe-tier refactor):

| Kind | Files | Copy rule |
|---|---|---|
| **New EFX files** | `Actor.js`, `EmployeeIdRegistry.js`, `FormContracts.js`, `EfxApi.js`, `EfxUtil.js`, `N8n.js`, `N8nEnvelope.js`, `AGENTS.md` (project-level agent rules) | copy verbatim |
| **Edited prod files — EFX logic** | `InitialRequestHandler.js` (id at submit, dedupeKey, carried-id check), `IDSetup.js` (pre-assigned id, override), `WorkflowManager.js` (id collision guard, `dedupeKey`), `RawLog.js` (v2 events, redaction), `Services/ActionItemService.js` (`Actor.email()`, task events), `EmailUtils.js` (`preassignedEmployeeId`, safety dedupe), `SchemaConstants.js` (col 56, `EMPLOYEE_IDS`), `Services/ConfigurationService.js` (defaults), `Setup.js` (self-test, flags), `MigrationTools.js` (`migrateEfx*`) | copy verbatim, then `diff` against the target to confirm only EFX hunks moved |
| **Edited prod files — attribution only** (`Session.getActiveUser().getEmail()` → `Actor.email()` / `Actor.principal()`) | `BOSSReviewHandler.js`, `DashboardActionsHandler.js`, `HRVerificationHandler.js`, `ITConfirmationHandler.js`, `ITSetupHandler.js`, `PositionChangeHandler.js`, `RequestActionsHandler.js`, `Specialist.js`, `TerminationHandler.js` | copy verbatim (CRLF→LF normalisation makes whole-file diffs; use `--strip-trailing-cr` to see the real 1–3 line change per file) |
| **Per-tier file** | `Config.js` | copy, then set `ENVIRONMENT` = `'DEV'` / `'PROD'`; keep everything else identical to the fork |
| **Never copied** | `.clasp.json`, `__tests__/` (copy the suites separately into the target's `__tests__/` — they are Node-only), `docs/`, `*.txt` | — |
| **HTML** | none — no UI/layout change in this delivery (`diff` must show no `.html` differences; if it does, stop) | — |

## 2. Gates per tier
| Gate | dev | prod |
|---|---|---|
| Source proven | TEST tier T0–T11 green (`TEST_PLAN.md`), B1 mock-vs-real table ticked | dev soak ≥ 1 week with George's workflows against dev, emails redirected; JR parallel-run week clean (`CUTOVER_PLAN_JR.md` §2) |
| Local proof in the target folder | copy files → `node --check` every file → the five suites (`super`, `field-map`, `efx`, `migration`, `e2e`) green → `node tools/gen-contracts.js && node tools/n8n-check.js` = `OK` (lock committed in the live repo too) | same |
| Sheet first | `migrateEfxDryRun/Apply` + backfill on the dev sheet (`MIGRATION_PLAN.md` §3.2) | on prod (`§3.3` step 1) inside the window |
| Properties | `SPREADSHEET_ID` = dev sheet, `EMAIL_REDIRECT_ALL` = dbinns | `SPREADSHEET_ID` = prod, `EMAIL_REDIRECT_ALL` **empty** (verify twice), `SAFETY_TRAINING_AT_SUBMIT` as decided |
| Push + deploy | `clasp push -f` to dev script `1VI9tR0GCx…`; redeploy the existing dev deployments (`@102/@103` API-executable already exist) | `clasp push -f` to prod `1AuIbJl1jR…`; **portal deployment** `AKfycbyXp4q0…` gets a new version (`clasp deploy -i <PORTAL_ID> -d "EFX …"`); new **API Executable** deployment; **never touch @76** until retirement |
| GCP link | dev script → `efx-dev` (or `efx-test` temporarily) | prod script → `efx-prod` — re-prompts consent; do it inside the window |
| Verify | `efxSelfTest` (`env: 'DEV'`), T2–T8 from n8n with dev-tier credential | `efxSelfTest` (`env: 'PROD'`, `spreadsheetId = 1kGjw8e…`), `n8n_ping` via prod-tier credential, one real New Hire watched end to end (id appears in the response and the `Employee IDs` sheet; emails unchanged) |
| Rollback anchor | `clasp list-deployments` before push | same + export of George's `J7RU99n01pq9Xk3D` (cutover G6) |

## 3. Rollback (code)
- `clasp deploy -i <deployment id> -V <anchor version>` (or the editor: Manage deployments → edit → pick the previous version). Sheet changes are additive and stay; the new col-56 header and `Employee IDs` tab are harmless to the old code.
- If the alias layer misbehaves but the UI is fine: leave the deployment, disable the n8n Router workflow — Forms never calls n8n, so nothing else is affected.

## 4. What must be true in the live repo after promotion
- `employee_management_v2*/__tests__/` contains the five suites + `gas-runtime.js` + `efx-fixtures.js` and they pass from that folder.
- `docs/N8N_CONTRACTS.md` + `docs/contracts.lock.json` + `tools/n8n-check.js` + `tools/n8n-workflows-check.js` live in the live repo (copy `tools/` and the two docs); `AGENTS.md` rule "change a function → update contracts → n8n-check must pass" applies there from that day.
- `CREDENTIALS.md` corrected (ids are inverted today — `spec/corrected-docs/CREDENTIALS.v2.md`).
- The fork is then **archived** (tag `efx-promoted-<date>`), not kept as a second source of truth.

## 5. Owner / timing
Binns for every step; a super-admin only if `efx-dev`/`efx-prod` DWD rows are new. Dev promotion: the first working day after TEST T0–T11 pass. Prod promotion: after the dev soak and the JR parallel week, in a 60-minute morning window with George reachable (his BOSS chain hits prod Forms).
