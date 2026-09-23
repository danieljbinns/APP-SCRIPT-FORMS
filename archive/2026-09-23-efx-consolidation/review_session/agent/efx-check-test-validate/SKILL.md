---
name: efx-check-test-validate
description: >
  Run and interpret every check for the Employee Forms EFX fork (Apps Script + n8n integration): the
  five Node GAS-mock suites (super-test, form-field-map-test, efx-test, migration-test, efx-e2e-test), the
  contract compatibility gate (tools/n8n-check.js), the n8n workflow JSON lint (tools/n8n-workflows-check.js),
  contract doc generation, syntax checks, and the live TEST-deployment smoke calls via the Execution API. Use this whenever anything under employee_forms_efx/
  changes, before saying 'done', when a suite fails, when someone asks 'is it green', 'did we break
  n8n', 'run the tests', 'check the contracts', or wants to verify the TEST script — even if they
  don't name a specific test.
---

# EFX — check, test, validate

Repo: `P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_efx\` (fork; never the live `employee_forms_deployment`).
Rules: no `clasp push/deploy`, no prod ids, no real emails. Everything here runs locally except §4.

## 0. Where commands run, and what they touch
- §1 runs from `<fork>/employee_management_v2_efx/__tests__`; §2, §2b, §3 run from the **fork root**. Node ≥ 20 (v25 in use).
- **Side effects even in a "read-only" pass:** `efx-e2e-test.js` writes `docs/test-logs/efx-e2e-<stamp>.md`; `gen-contracts.js` rewrites
  `docs/N8N_CONTRACTS.md` (timestamp line changes every run). If you must leave the tree clean: `git checkout -- docs/N8N_CONTRACTS.md`
  and delete the new log, or skip `gen-contracts` and run only `n8n-check`.
- Baseline numbers live in `docs/TEST_RESULTS_LOCAL.md` and the two briefs (`docs/MORNING_BRIEF_*.md`, `docs/DELIVERY_BRIEF_*.md`); reconcile there.
- Shortcut from `<fork>/tools`: `npm test` (five suites) · `npm run gate` (suites + contracts + n8n-check + lint).

## 1. The five suites (must all be green before "done")
```bash
cd employee_management_v2_efx/__tests__
node super-test.js            # 12 dev regression scenarios — expect  TOTAL: 159 passed
node form-field-map-test.js   # HTML name= → payload → column → email context — expect  ALL PASSED — 312
node efx-test.js              # EFX aliases, ID-at-submit, validation, auth (principal vs actor), closes, events, error-code map — expect  TOTAL: 195 passed
node migration-test.js        # migrateEfx dry-run/apply/idempotency + Employee IDs backfill (what §6 of the setup plan runs) — expect  TOTAL: 42 passed
node efx-e2e-test.js          # full chains per workflow type; every email captured, none sent — expect  580 passed … ✅ green apart from 3 recorded defect(s)
node efx-e2e-test.js --strict # exit 1 is EXPECTED today (the 3 recorded prod defects #15–17 become fatal); use it only to prove the defects are still present
```
Exit code 1 = failure **except** `--strict` (see above). Read the `✗` lines; each carries `got` / `expected`. In the E2E suite a
`✗  DEFECT …` line is a *recorded prod defect* (expected); any other `✗` is real. The E2E log file's header says
`PASS (3 recorded prod defects …)` — a `FAIL` there means a real failure.
`efx-test.js` scenario `FLAG — SAFETY_TRAINING_AT_SUBMIT` always reports one pass as a documented **skip** (the mock ignores Script
Properties) — 190/190 never proves the flag; only the TEST deployment does (§4).
A different number than 159 · 312 · 195 · 42 · 580 means something changed — find out why before accepting it (a new test is fine; a lost one is not).

### Interpreting common failures
| Symptom | Likely cause | Fix |
|---|---|---|
| `E_VALIDATION … unknown field (not in contract)` | payload key not in `FormContracts` (`required`/`optional`) | either the key is wrong (use the HTML `name=` list in `docs/mapping/*.md`) or the contract is missing it → add to `optional`, bump `FormContracts.VERSION`, run `n8n-check --update` |
| `must be one of …` | enum drift (e.g. `employeeType` is `Direct Hire\|Agency`, not `Salary`) | fix payload |
| `E_UPSTREAM` with `Access denied` / `Permission denied` | handler role check uses the **session principal**, not `actor.email` | in tests swap `_ctx.Session` (see `efx-test.js` ID SETUP scenario); live: the impersonated `efx-bot` must be in the group / `ADMIN_EMAILS` |
| `E_ALREADY_CLOSED` | idempotent no-op | treat as success |
| `Cannot read properties of undefined (reading 'SHA_256')` | mock lacks `Utilities.DigestAlgorithm` | code must guard (see `FormContracts.hash_` fallback) |
| same `workflowId` for two creates | `createWorkflow` 30-s idempotency per (type, requesterEmail) | vary `requesterEmail` in tests |
| create returns an id that already exists / wrong `internalEmployeeId` after a burst | same-second id collision (`generateWorkflowId` = timestamp + 3 random digits) — guarded in the fork by regenerating; if you see it, the guard was removed | restore the uniqueness loop in `WorkflowManager.createWorkflow` |
| `E_VALIDATION unknown field` on a **retry** with the same object | handlers mutate their payload; `n8nSubmit_` copies it first — if you call a handler directly (UI path) that protection doesn't exist | go through the alias, or rebuild the payload |
| `IR columns = 55` | you forgot the new col 56 | expected 56 |

## 2. Contract gate (the "check for n8n on change")
```bash
node tools/gen-contracts.js        # regenerates docs/N8N_CONTRACTS.md (does NOT touch the lock)
node tools/n8n-check.js            # OK | notes (additive) | BREAK (exit 1) | BREAK but version bumped (exit 2)
node tools/n8n-check.js --update   # accept the new baseline AFTER bumping N8N_API_VERSION / FormContracts.VERSION and announcing
```
Breaking = alias removed, form removed, handler renamed, field removed, **new required field**. Additive = new alias / optional field / form.

## 2b. n8n workflow JSON lint (run after touching anything in `n8n/`)
```bash
node tools/n8n-workflows-check.js          # every n8n/*.json: parse, unique node names, connections resolve, Code-node JS compiles,
                                           # every `fn` exists in N8N_ALIASES with a plausible arity, payload keys/enums match contracts.lock.json,
                                           # secret scan (deployment ids, private keys, JWTs, non-placeholder passwords, stray recipients)
node tools/n8n-workflows-check.js --json   # machine-readable
```
Exit 1 on any error. Warnings are informational — read them. **Known/accepted warnings right now: none** (the `90_EFX_E2E_Test.json`
`systems:'SiteDocs'` warning was fixed 2026-09-16 23:30). `multi` (checkbox) values are lint-warned against the UI option list but NOT
contract-enforced at runtime — a wrong value silently creates no task.

## 3. Syntax + inventory
```bash
for f in employee_management_v2_efx/*.js employee_management_v2_efx/Services/*.js; do node --check "$f" || echo "SYNTAX FAIL $f"; done   # 48 files
```
`docs/review/FUNCTION_INVENTORY.md` is hand-maintained — when you add a helper, add a row (no generator exists).

## 4. Live TEST deployment smoke (only after tomorrow's setup; never prod)
Prerequisites: a TEST script id in `.clasp.json` (not `REPLACE_ME_…`), an API-executable deployment, and the SA key at
`D:\Credentials\google\efx\efx-router-test.json` (never read its contents into a report). If any is missing, **say "§4 skipped — no TEST
deployment yet"** in the report rather than silently omitting it.
```bash
cd tools && npm i googleapis
node exec-api-call.js --key <sa.json> --subject efx-bot@team-group.com --script <<EFX_SCRIPT_ID>> --fn n8n_ping
node exec-api-call.js ... --fn n8n_contracts
node exec-api-call.js ... --fn n8n_closeTask --args '[{"id":"cli"},{"taskId":"TK-XXXX","dryRun":true}]'
```
Expected: `ok: true`, `env: 'TEST'`, `spreadsheetId` = the TEST copy. The script refuses the prod script id.
Editor-side: `efxSelfTest()` (Setup.js) and `migrateEfxDryRun()` before `migrateEfxApply()`.

## 5. Report format
State: suites (pass/fail counts), `n8n-check` result, what changed in contracts, anything skipped and why (e.g. flags not honoured by the mock). Never claim the flag tests or emails were verified unless run against the TEST deployment.
