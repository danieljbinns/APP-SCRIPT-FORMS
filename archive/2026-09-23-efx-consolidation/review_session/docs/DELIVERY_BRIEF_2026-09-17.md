# Delivery brief — EFX (Employee Forms ↔ n8n) · TEST tier by 2026-09-17 16:00

One page for the handover. Everything referenced is in this fork (`employee_forms_efx/`). **Nothing has been deployed;
prod, dev, n8n, AWS and GCP are untouched; no email was sent.** The TEST deployment is done by Binns on the day, following
`docs/plans/SETUP_PLAN_TOMORROW.md` (timed, with expected outputs and rollback per step).

## What George gets
| Need (from the brief) | Delivered | Where |
|---|---|---|
| One reusable way for n8n to read / write / create / start any form | 27 `n8n_*` alias functions behind one router sub-workflow, one Google service-account credential, one Execution API door per tier | `employee_management_v2_efx/N8n.js`, `n8n/00_EFX_Router.json` |
| JR automation without cookies / secrets in bodies | `n8n_closeJrTask(actor, 'TK-…' \| 'NEW_EMP_…')` + drop-in node for *Mark Portal JR Complete* | `n8n/12_Forms_CloseJrTask.json`, `n8n/snippets/…replacement.json`, `docs/plans/CUTOVER_PLAN_JR.md` |
| Initial Request creatable from n8n (after his approval gate) | `n8n_createInitialRequest` → same handler as the UI; response carries `workflowId` + **`internalEmployeeId`** | `n8n/10_…`, `docs/mapping/INITIAL_REQUEST.md` |
| Internal Employee ID at submission, not page load | `EmployeeIdRegistry` mints at `submitInitialRequest`; ID Setup reads the pre-assigned id; admin override audited | `EmployeeIdRegistry.js`, `InitialRequestHandler.js`, `IDSetup.js`, `spec/05_EMPLOYEE_ID_TIMING_FIX.md` |
| Safety training after Initial Request | `n8n_assignSafetyTraining`; optional flag creates the task at submit (idempotent) | `n8n/13_…`, `docs/mapping/SAFETY.md` |
| Triggers without changing emails | Raw Log v2 events (`submit`, `result`, `task.created`, `task.closed`) + `n8n_events` cursor poller; emails unchanged | `RawLog.js`, `n8n/20_Forms_EventsPoller.json` |
| Every other form reachable | create/approve/submit aliases for Equipment, Termination, Position Change, HR Verification, IT Setup, cancel/bump/hire-date, drafts, list, context | `n8n/17–28`, `docs/N8N_CONTRACTS.md` |
| He never breaks on our changes | `FormContracts` + `docs/contracts.lock.json` + `node tools/n8n-check.js` gate; additions never break, breaking changes need a version bump and an alias | `AGENTS.md`, `docs/PROCESS_CHANGE_MANAGEMENT.md` |
| Plain-English docs | wiki (how it works, for George, FAQ, runbooks, cookbook), **end-user help pages** (which form, statuses, one page per form, troubleshooting, glossary), agent skills | `docs/wiki/`, `docs/help/`, `agent/dist/*.skill` |

## Proof (all local, Node mock of Apps Script — nothing sent, nothing deployed)
| Suite | Result |
|---|---|
| `super-test.js` (existing regression) | 159 / 159 |
| `form-field-map-test.js` (HTML → payload → column) | 312 / 312 |
| `efx-test.js` (aliases, auth, ids, events) | 195 / 195 |
| `migration-test.js` (sheet migration dry-run / apply / backfill) | 42 / 42 |
| `efx-e2e-test.js` (every workflow type end to end) | 580 passed · 0 real failures · 3 **pre-existing prod defects** recorded · 122 emails captured, 0 sent |
| `tools/n8n-check.js` (contract gate) · `tools/n8n-workflows-check.js` (n8n JSON lint, 211 nodes) | OK |

Logs: `docs/test-logs/`. Reports: `docs/TEST_RESULTS_LOCAL.md`, `docs/review/E2E_TEST_REPORT.md`,
`docs/review/CODE_REVIEW_EFX.md` (+ pass 2), `docs/review/KNOWN_DEFECTS_PROD.md` (24 prod defects found; 7 fixed here
because they sit on the EFX path, 17 left for the Forms backlog on purpose).

## The day (see the plan for commands and expected outputs)
1. Copy prod sheet → **EFX TEST**; GCP project `efx-test` + service account + domain-wide delegation; `efx-bot@team-group.com`.
2. `clasp create` from this folder → push → link GCP → Script Properties (`SPREADSHEET_ID`, `EMAIL_REDIRECT_ALL`) → web-app + API-executable deployments.
3. `migrateEfxDryRun()` → `migrateEfxApply()` → backfill. `efxSelfTest()`.
4. n8n staging: SA credential, import `00` then wrappers, run `90_EFX_E2E_Test` one node at a time (`docs/plans/TEST_PLAN.md`).
5. 16:00: n8n → Router → TEST Forms → TEST sheet, emails redirected to dbinns.

## What is deliberately NOT in this delivery
- No prod, dev or staging change; no UI/layout change; no email-to-trigger change; no AWS or GCP mutation.
- JR cutover on the live chain (parallel run first — `CUTOVER_PLAN_JR.md`); SiteDocs multi-company token (blocker for full ID-Setup automation); `efx-bot` group memberships (HR/IT/Admin) decided tomorrow.
- The 13 pre-existing prod defects that are not on the EFX path.

## Things only the real environment can prove (verify tomorrow, listed in `CODE_REVIEW_EFX_PASS2.md` and `TEST_RESULTS_LOCAL.md`)
`Session.getActiveUser()` under DWD impersonation; `LockService` contention; Script Properties flag `SAFETY_TRAINING_AT_SUBMIT`;
Execution API accepting script id vs deployment id; DWD scope propagation delay.
