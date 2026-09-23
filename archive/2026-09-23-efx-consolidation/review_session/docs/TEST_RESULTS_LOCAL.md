# Local test results — EFX fork (2026-09-16 night, Node GAS mock runtime; last full run 23:00 (post-refactor))

All runs are against `employee_management_v2_efx/` on the local mock (`__tests__/gas-runtime.js`). No Apps Script, sheet or n8n was touched.

| Suite | Result | What it proves |
|---|---|---|
| `node __tests__/super-test.js` (the existing 12-scenario regression suite from dev) | **159 / 159** | No regression in New Hire, HR Verification, IT Setup, Termination, Equipment, idempotency, validation, JR split. Only change: Initial Requests rows are now 56 columns (Internal Employee ID appended). |
| `node __tests__/form-field-map-test.js` (HTML `name=` → payload → column → email context) | **312 / 312** | Every existing field mapping intact after the EFX edits. |
| `node __tests__/efx-test.js` (new) | **195 / 195** (1 scenario skipped on mock, see below) | Alias envelope for all 27 aliases, contract validation, principal-vs-actor authorization (session-spoof test), id allocation, JR/safety/generic task close, events + redaction, other forms. |
| `node __tests__/migration-test.js` (new) | **42 / 42** | `migrateEfxDryRun` writes nothing and plans exactly 3 changes; `migrateEfxApply` adds IR col 56 / `Employee IDs` / Raw Log cols 6-7; re-apply is a no-op; wrong sheet width → WARNING, never writes elsewhere; backfill from `ID Setup Results` is idempotent and skips blank/legacy ids. |
| `node __tests__/efx-e2e-test.js` (new) | **580 passed / 3 recorded prod defects / 0 real failures**, 122 emails captured, **0 sent** (run twice, stable) | Full chains per workflow type through the alias layer — see section below and `docs/review/E2E_TEST_REPORT.md`. Exit 0 unless a *new* failure appears; `--strict` also fails on the recorded defects. |

## efx-test scenarios
| Scenario | Assertions | Notes |
|---|---|---|
| Alias envelope — `n8n_ping/info/contracts` | 7 | 13 aliases; `new_hire` and `id_setup` marked verified |
| Create — `n8n_createInitialRequest` | 16 | Internal Employee ID minted at submit and continues from `ID Setup Results` max (30410 → 30411); row has 56 cols; `Employee IDs` registry row with actor attribution; Raw Log `submit` + `result` events with Event IDs; **emails identical to before** (`Request Submitted`, `ID Setup Required`; `internalEmployeeId` deliberately NOT in email context so templates render as today); allocate idempotent per workflow |
| Validation | 6 | missing required / unknown field → `E_VALIDATION` with `fields[]`; nothing written |
| ID Setup — pre-assigned id | 11 | `n8n_submitIdSetup` without `internalEmployeeId` uses the pre-assigned one; `Submitted By` = actor; step → `HR Verification Needed`; HR email sent; result event has no passwords; non-admin mismatch → `E_UPSTREAM` "pre-assigned…"; admin override honoured and logged |
| Human path unchanged | 7 | direct `submitInitialRequest` still works; response carries `internalEmployeeId`; `getWorkflowContext().preassignedEmployeeId` exposed, `internalEmployeeId` untouched; Raw Log user falls back to Session |
| JR — `n8n_closeJrTask` | 9 | dryRun does not close; close by `TK-`; `closedBy` = actor; draft marks checklist Complete; second close → `E_ALREADY_CLOSED`; unknown → `E_NOT_FOUND`; sibling task untouched |
| Safety — `n8n_assignSafetyTraining` | 4 | `E_NOT_FOUND` when no task; closes `safety_onboarding` with confirmations in `formData` |
| Events — `n8n_events` | 5 | submit+result events; cursor pagination; kind filter |
| Flag — `SAFETY_TRAINING_AT_SUBMIT` | skipped | The mock `ConfigurationService` ignores Script Properties. **Verify in the TEST deployment**: `setSafetyTrainingAtSubmit(true)` → create → `safety_onboarding` task exists → `n8n_assignSafetyTraining` closes it. |

## efx-e2e-test — what it proves (11 scenarios)
| # | Chain | Highlights |
|---|---|---|
| 1 | New hire → ID Setup → HR Verification → IT Setup → specialists → JR close → Complete | id minted at submit, carried through every sheet/email/event; `n8n_closeJrTask` unlocks the next step exactly like the UI |
| 2 | Rehire with carried id | `existingInternalEmployeeId` recorded as `rehire-carry`; high-water mark moves; next allocation = max+1 (was a 1-in-1000 flake → fixed, defect #18) |
| 3 | Safety at submit (flag) + `n8n_assignSafetyTraining` | single task even when HR Verification re-fires (defect #9 fix) |
| 4 | Validation & security | unknown/missing fields → `E_VALIDATION`; spoofed `actor` cannot pass role checks (principal-based); passwords never appear in events/webhook |
| 5 | Equipment request → IT Setup → close-out | tasks, emails, `Workflows` status |
| 6 | Position change → approvals → tasks | records defects #16/#17 (pre-existing) |
| 7 | Termination → HR approval (Approved & Rejected) → 8 tasks → Complete | alias layer does **not** mutate the caller's payload (retry-safe) |
| 8 | Events / cursor / redaction | `nextAfterEventId`, kinds filter, `pruned` |
| 9 | Cancel / bump / updateHireDate | permission → `E_FORBIDDEN`; already-sent → `E_RATE_LIMITED` |
| 10 | listWorkflows / getContext / saveTaskDraft | `{items:{}}` draft shape (defect #11 fix) |
| 11 | Finance credit-card checklist | records defect #15 (pre-existing) |

Every run writes a full log (every call, result, captured email header, event) to `docs/test-logs/efx-e2e-<stamp>.md`. **No email is ever sent** — the mock captures `MailApp/GmailApp`; the fork's `ENVIRONMENT='TEST'` would additionally redirect real sends to dbinns.

### Fork fixes proven by the suites (vs prod)
| Fix | Proven by |
|---|---|
| Internal Employee ID at submit (not page view); page view reads/pre-allocates the same id | efx-test "Create", e2e #1/#2 |
| Authorization uses the real session principal, `actor` is attribution only | efx-test spoof test, e2e #4 |
| Passwords redacted from events / webhook fan-out | efx-test, e2e #4/#8 |
| Safety task idempotent (#9), draft `{items}` shape (#11), formType/Cancelled enforcement on close | e2e #3, #10, efx-test JR |
| Alias layer copies the payload before calling handlers (retry-safe) | e2e #7 |
| Workflow id collision guard (#18) | e2e #2 (stable across repeated runs) |
| Pass-2 H1: `include:['record']` read-back is redacted | efx-test ID Setup (`DSS Password` → `[REDACTED]`) |
| Pass-2 H2: Initial Request dedupe keys on requester **+ employee + hire date** (two different hires from one n8n requester never merge; a double-submit still dedupes) | efx-test Create, e2e #4 |
| Pass-2 M1: role denial → `E_FORBIDDEN` naming the principal | e2e #4 |
| Pass-2 M2: `n8n_saveTaskDraft` merges into the existing draft, keeps notes when omitted | e2e #10 |
| Pass-2 M4: carried rehire id must be 4–6 digits, rejected before any write | efx-test Create |
| Pass-2 M3: contract lock hashes are real SHA-256 (match live) | `node tools/n8n-check.js` |

## Findings worth knowing (from the tests)
1. **30-second idempotency guard.** `createWorkflow()` returns the *same* workflowId for two requests of the same type from the same `requesterEmail` within 30 s (`WorkflowManager.js:91-104`). For n8n this means a burst of test creates from one requester collapses into one workflow — by design. Use distinct requester emails in tests; in production, batch creates should space out or vary requester.
2. **`FormContracts.hash_` fallback.** The mock has no `Utilities.DigestAlgorithm`; the contract hash falls back to FNV-1a locally (`fnv1a:`), SHA-256 on real Apps Script (`sha256:`). Only the generated docs/lock notice; behaviour is unaffected.
3. **Emails unchanged by design.** The pre-assigned id is exposed to automation (`response.internalEmployeeId`, `Employee IDs` sheet, Raw Log `result` event, `n8n_getEmployeeId`, `getWorkflowContext().preassignedEmployeeId`) but not to email templates, so `hasId` (EmailTemplates.js:114) still means "ID Setup completed".

## Tools
- `node tools/gen-contracts.js` → `docs/N8N_CONTRACTS.md` + `docs/contracts.lock.json`
- `node tools/n8n-check.js` → fails on breaking contract change without an `N8N_API_VERSION` bump (the "check for n8n on change")

4. **Pre-existing prod defects surfaced by E2E** (#15 Finance limit never reaches checklist, #16 status-change approval routes to the old manager, #17 Fleetio add+remove collapse into one task) are asserted as `defect(...)`, reported, and deliberately **not fixed** in this fork — see `docs/review/KNOWN_DEFECTS_PROD.md`.
