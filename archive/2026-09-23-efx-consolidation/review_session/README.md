# Employee Forms — EFX fork (n8n integration)

**Status:** built locally 2026-09-16 night · **not deployed** · prod untouched · TEST deployment planned 2026-09-17 by 16:00.

This folder is a **fork of prod `employee_management_v2`** plus the EFX integration layer. It is its own git repo with **no remote** and a **blanked `scriptId`** so nothing here can reach prod by accident.

## What's here
| Path | What | Owner |
|---|---|---|
| `employee_management_v2_efx/` | Apps Script project = prod copy + EFX files (`N8n.js` + `N8nEnvelope.js`, `Actor.js`, `EmployeeIdRegistry.js`, `FormContracts.js`, `EfxApi.js`, `EfxUtil.js`, `RawLog.js` v2) + edits (`InitialRequestHandler.js`, `IDSetup.js`, `SchemaConstants.js`, `Config.js`, `Services/ConfigurationService.js`, `EmailUtils.js`, `Setup.js`, `MigrationTools.js`) | us |
| `employee_management_v2_efx/__tests__/` | Node GAS mock runtime + suites: `super-test.js` (159), `form-field-map-test.js` (312), `efx-test.js` (195), `migration-test.js` (42), `efx-e2e-test.js` (full chains, 580 assertions, 122 emails captured / 0 sent; 3 pre-existing prod defects recorded), shared fixtures in `efx-fixtures.js` — all green, see `docs/TEST_RESULTS_LOCAL.md` and `docs/test-logs/` | us |
| `docs/N8N_CONTRACTS.md`, `docs/contracts.lock.json` | **Generated** field/function reference for n8n (`node tools/gen-contracts.js`) | generated |
| `docs/mapping/` | Field → payload → column → validation → trigger maps per form (Initial Request, ID Setup, JR, Safety, Action Items, other forms draft) | agent-written, reviewed |
| `docs/plans/` | `SETUP_PLAN_TOMORROW.md`, `TEST_PLAN.md` (one test at a time), `CUTOVER_PLAN_JR.md` | agent-written, reviewed |
| `docs/wiki/` | Human explainers: how it works, for George, for developers, FAQ, runbooks | agent-written, reviewed |
| `n8n/` | Importable workflows: `00_EFX_Router` (Execution API caller), alias wrappers `10–28` (every alias), `20` events poller, `30` canary, `40`/`41` reference flows (onboarding via EFX, open-tasks digest — inactive), `90` end-to-end test (steps 10–12 behind `RUN_EXTENDED`) | agent-written, reviewed |
| `router/n8n-nodes-efx-appscript/` | Custom n8n node **scaffold** (TypeScript, untested) — follow-up to the sub-workflow router | agent-written |
| `migration/` | `migrate-efx-sheet.js` (Node, dry-run default) + `MIGRATION_PLAN.md`; GAS side is `migrateEfxDryRun/Apply` in `MigrationTools.js` | agent-written, reviewed |
| `tools/` | `gen-contracts.js`, `n8n-check.js` (the change gate), `n8n-workflows-check.js` (lint for `n8n/*.json` — structure, `fn`/arity vs `N8n.js`, payload keys/enums vs the contract lock, Code syntax, secret scan; `--json`), `exec-api-call.js` (T1 helper) | us |
| `agent/efx-projects`, `agent/efx-new-form-review`, `agent/efx-check-test-validate`, `agent/efx-logs` (+ `agent/dist/*.skill`) | Skills: answer "what can n8n call", add/expose a form or field safely, run/interpret all checks, find every log. Installable `.skill` packages in `agent/dist/`. | us |
| `AGENTS.md`, `CLAUDE.md`, `employee_management_v2_efx/AGENTS.md` | Agent rules (fork-wide and per-project) | agent-written, reviewed |
| `docs/TESTING_STRATEGY.md`, `docs/PROCESS_CHANGE_MANAGEMENT.md` | Test pyramid + coverage targets; the SOP/RACI for changing Forms without breaking n8n | us |
| `docs/review/` | `CODE_REVIEW_EFX.md` + `CODE_REVIEW_EFX_PASS2.md` (two independent reviews, all High/Medium fixes applied), `KNOWN_DEFECTS_PROD.md` (18 pre-existing prod defects, 6 fixed in fork), `FUNCTION_INVENTORY.md` (318 functions classified), `E2E_TEST_REPORT.md`, `DIFF_prod_vs_efx.patch` | reviewed |

## The 60-second version
- n8n calls **`n8n_*` alias functions** on the script via the **Apps Script Execution API** with a **Google service account** impersonating `efx-bot@team-group.com`. Aliases validate against `FormContracts`, run under an `Actor` identity and call the **same handlers the UI calls** → tasks close, next steps unlock, same emails.
- **Internal Employee ID is minted at `submitInitialRequest`** (was: at ID Setup page view). It is in the response, the `Employee IDs` sheet, the Raw Log `result` event and `n8n_getEmployeeId`. Emails/templates unchanged.
- **JR**: `n8n_closeJrTask(actor, 'TK-…'|'NEW_EMP_…')` replaces the `doPost completeJrTitle` endpoint.
- **Safety**: `n8n_assignSafetyTraining(actor, workflowId, {siteDocsConfirmed, dssConfirmed})`; optional flag `SAFETY_TRAINING_AT_SUBMIT` creates the task at submit.
- **Change rule** (`AGENTS.md`): touch a function/field → update `FormContracts` → `node tools/n8n-check.js` must pass (or bump `N8N_API_VERSION` + alias). Additions never break George.

## Tomorrow (see `docs/plans/SETUP_PLAN_TOMORROW.md`)
1. Copy prod sheet → "EFX TEST"; GCP `efx-test` + SA + DWD; `efx-bot@`; `clasp create` from this folder; link script to `efx-test`; Script Properties (test sheet, `EMAIL_REDIRECT_ALL`); API-executable deployment; `migrateEfxDryRun()` → `Apply()`.
2. n8n staging: SA credential; import `n8n/00…90`; replace placeholders; run `90_EFX_E2E_Test` one node at a time per `docs/plans/TEST_PLAN.md`.

## Safety defaults baked into the fork
- `Config.js` `ENVIRONMENT = 'TEST'` → `sendFormEmail` force-redirects every email to dbinns@team-group.com whenever `EMAIL_REDIRECT_ALL` is unset. Change to `'PROD'` **only** when promoting into the real prod folder.
- `.clasp.json` scriptId is a placeholder (`REPLACE_ME_…NEVER_PROD`); `tools/exec-api-call.js` and `migration/migrate-efx-sheet.js` refuse the prod ids.

## Never
- Point `.clasp.json` at prod (`1AuIbJl1jR…`). Run `migrateEfxApply` on prod without the runbook. Email real people from TEST (`EMAIL_REDIRECT_ALL` stays set). Commit secrets.
