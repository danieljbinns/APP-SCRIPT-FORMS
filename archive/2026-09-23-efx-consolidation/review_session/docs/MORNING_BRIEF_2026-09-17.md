# Morning brief — Thursday 2026-09-17 (read in 5 minutes, then open `docs/plans/CHECK_AND_DEPLOY_PLAN.md`)

## Where things stand
- **Built, reviewed twice, all green, nothing deployed.** The EFX fork (`employee_forms_efx/`) holds everything for today's
  TEST tier: 27 `n8n_*` aliases, Internal Employee ID at submit, events, contract gate, 24 n8n workflow files, migration,
  plans, wiki + cookbook, 4 skills. Prod, dev, staging, n8n, AWS and GCP were not touched; no email was sent. Fork commits end at `8ab3a29`+.
- **Overnight changes you have not seen yet** (all tested):
  1. Alias layer copies payloads before calling handlers (retry-safe for n8n).
  2. Same-second workflow-id collision guard (prod defect #18).
  3. **Initial Request dedupe now keys on requester + employee + hire date** (pass-2 High H2, prod defect #19). Before this, two
     different hires from one n8n requester within 30 s would have merged into one workflow and one employee id.
  4. `include:['record']` read-backs are redacted (passwords never leave Forms) — pass-2 High H1.
  5. Role denials come back as `E_FORBIDDEN` naming the principal; `n8n_ping` now returns `principal` (expect `efx-bot@team-group.com` through the door, your own email from the editor).
  6. `n8n_saveTaskDraft` merges instead of overwriting a human's autosave; carried rehire ids must be 4–6 digits; the registry refuses to allocate without the lock.
  7. Safe-tier refactor landed (test-gated, no behaviour change): `EfxUtil.js` (redaction/sign/jsonSafe), `N8nEnvelope.js` (alias plumbing), shared test fixtures, `N8N_ERROR_CODES` as the single source for every error-code table; plus the three review Lows (Cancelled workflow → `E_TASK_NOT_OPEN`, string `dryRun`/`force` handled, `efxRunAs` redacted).
  8. **Every `requestId` is now traceable**: failed calls and successful mutating calls write a Raw Log row (`Kind = alias`) with the REQ id, alias, principal and duration (a skill evaluation found the ids were never stored). Hidden from the default `n8n_events` feed.
  9. Contract lock hashes are real SHA-256 (they will match the live script); a lint gate for the n8n JSON exists (`node tools/n8n-workflows-check.js`).
  10. New docs: `DELIVERY_BRIEF_2026-09-17.md`, `plans/CHECK_AND_DEPLOY_PLAN.md`, `wiki/COOKBOOK_FOR_GEORGE.md` (10 recipes), `review/CODE_REVIEW_EFX_PASS2.md`, `plans/BACKLOG_NEXT_WAVE.md`, `plans/CHATBOT_FORMS_HELP_SPEC.md` (your chatbot idea, planned only), `plans/RISK_REGISTER.md`, `plans/PROMOTION_PLAN_CODE.md`, `plans/COMMS_DRAFTS.md`, `plans/DEMO_SCRIPT_GEORGE.md`, and **`docs/help/`** — 13 plain-English pages for the people who fill the forms (Phase 0 of the chatbot; also surfaced prod defects #20–#24).

## Numbers (local Node mock; every email captured, none sent)
| Suite | Result |
|---|---|
| super-test (prod regression) | 159 / 159 |
| form-field-map | 312 / 312 |
| efx-test (aliases, auth, ids) | 195 / 195 |
| migration-test | 42 / 42 |
| efx-e2e (every workflow type) | 580 passed, 0 real failures, 3 recorded prod defects, 122 emails captured |
| n8n-check (contracts) · n8n-workflows-check (JSON lint, 211 nodes) | OK · OK (0 warnings) |

## Decisions needed from you today (say them out loud before Gate 1)
| # | Decision | Default if you say nothing |
|---|---|---|
| D1 | GCP project id `efx-test` vs fallback `efx-test-teamgroup` (global uniqueness) | try `efx-test`, fall back |
| D2 | `efx-bot` group memberships today: HR (`grp.forms.hr`), IT (`grp.forms.it`), JR (`grp.forms.jrtitle`)? Without them the approval / HR / IT aliases return `E_FORBIDDEN` (by design) | **none today**; add only what T5–T8 need, remove after |
| D3 | `SAFETY_TRAINING_AT_SUBMIT` on TEST: on or off for the smoke? | off for T4, on for the dedicated flag test |
| D4 | Import `40`/`41` reference flows today (inactive) or leave for George | import inactive so he can read them |
| D5 | Q23 — give Termination tasks a `formType` in the next Forms release (lets George close them by type) | defer; taskId-based closing works |

## Watch-outs (things the mock cannot prove — verify live, in this order)
1. `n8n_ping.principal` through the Execution API must be `efx-bot@team-group.com`. If it is empty or yours, DWD/impersonation is wrong and every role check is meaningless — stop and fix before T4.
2. `EMAIL_REDIRECT_ALL` set **before** any function runs (the fork's `ENVIRONMENT='TEST'` also redirects, belt and braces).
3. `migrateEfxDryRun` must show **no WARNING** before you apply.
4. First `n8n_createInitialRequest` from n8n: check the `Employee IDs` row, IR col BD, and both `[TEST]` emails in your inbox.
5. `LockService` contention and `AdminDirectory` as `efx-bot` (Groups Reader role) — first real signals appear at T5/T8.

## Timeline (targets)
08:30 Gate 0 local proof · 08:45 sheet copy · 09:00 GCP + SA · 09:30 DWD (super-admin) · 09:45 efx-bot (GAM) ·
10:10 TEST script + push + properties + deployments · 10:55 migration · 11:10 first calls (T0/T1) · 12:30 n8n import ·
13:30 smoke T2–T4 (+T5–T8) · 15:30 wrap · **16:00 deployed TEST tier**.
Abort lines: key creation blocked (Gate 1) → Forms-only day; T1 not passing by 12:30 → import anyway, record "door closed".

## If you have 10 spare minutes
- Read `wiki/COOKBOOK_FOR_GEORGE.md` §1 — it is what you will show George.
- Skim `review/CODE_REVIEW_EFX_PASS2.md` §3 (mock-vs-real table) — it is the checklist behind the watch-outs above.
- Skim `plans/BACKLOG_NEXT_WAVE.md` — what I propose to do next and in which order; strike anything you disagree with.
