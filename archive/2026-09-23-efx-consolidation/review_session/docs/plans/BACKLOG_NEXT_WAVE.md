# Backlog — next wave (owner: Binns; drafted by the agent as PM/chief-of-staff, 2026-09-16 night)

Ordered. Each item says why it matters, what "done" is, who can do it, and whether it needs a Forms change (the thing
George must never depend on). Items marked **[agent tonight]** are being done in this autonomous session; the rest wait
for the TEST tier or your decision. Rules unchanged: no prod/live/email/UI changes without an explicit go.

## A. Before 16:00 today (blocking the TEST demo)
| # | Item | Done when | Owner | Forms change? |
|---|---|---|---|---|
| A1 | Gate 0 → Gate 7 of `CHECK_AND_DEPLOY_PLAN.md` | n8n → Router → TEST Forms → TEST sheet; T2–T4 green; emails redirected | Binns | no (deploy of the fork) |
| A2 | Decisions D1–D5 in `MORNING_BRIEF_2026-09-17.md` | written in the values sheet | Binns | — |
| A3 | George preview: send him `COOKBOOK_FOR_GEORGE.md` §1 + R1 (JR) once T7 passes | he can run `12_Forms_CloseJrTask` against TEST himself | Binns/George | no |

## B. This week (make TEST trustworthy, then dev)
| # | Item | Why | Done when | Forms change? |
|---|---|---|---|---|
| B1 | Live verification of the mock-vs-real table (`CODE_REVIEW_EFX_PASS2.md` §3): principal, AdminDirectory role, LockService, PropertiesService flag, Execution API id, DWD delay | the only claims we could not prove locally | each row ticked in `TEST_PLAN.md` results | no |
| B2 | Run `90_EFX_E2E_Test` fully incl. `RUN_EXTENDED` steps 10–12 | proves approvals + listWorkflows through the door | PASS summary saved to `docs/test-logs/` | no |
| B3 | Events poller soak: `20_Forms_EventsPoller` active on TEST for 24 h | M6 tail read + cursor semantics under real Raw Log growth | no missed/duplicated events vs the sheet | no |
| B4 | Promote fork → `employee_management_v2_dev/` (dev script `1VI9tR0GCx…`) with `ENVIRONMENT='DEV'`, run `migrateEfx*` on the dev sheet — file list and gates in `PROMOTION_PLAN_CODE.md` | George's parallel run needs dev (cutover gate G2) | dev suites + T2–T8 green on dev | yes (dev only) |
| B5 | Decide and apply `efx-bot` group memberships per tier (D2) | approvals/HR/IT aliases are `E_FORBIDDEN` without them | GAM change logged in `10_ACCESS_AND_ACCOUNTS.md` | no |
| B6 | **[done 2026-09-16 23:00]** Lows from pass 2: Cancelled-by-workflow → `E_TASK_NOT_OPEN` (not `E_ALREADY_CLOSED`), string `"false"` dryRun handled, `getStepResultData` via `efxRunAs` redacted | small correctness gaps George could hit | tests added, suites green | fork only |
| B7 | **[done 2026-09-16 23:00]** Safe-tier refactors from `CODE_REVIEW_EFX_PASS2.md` §5 only: `n8nMapHandlerError_`, `n8nParse_`, `efxParseDraft_`, `EfxUtil.js` (redaction/sign/jsonSafe), `N8n.js` ↔ `N8nEnvelope.js` split, `N8N_ERROR_CODES` → generated error table, shared test fixtures, `efxRowToRecord_`. The "not worth it" list (splitting `EfxApi.js` by concern, renames, class conversion, `createWorkflow` restructuring) is deliberately NOT done before the PROD merge | file separation for documentation ease (your ask) without behaviour change | suites green, `DIFF_prod_vs_efx.patch` regenerated, file maps updated | fork only |

## C. Next two weeks (George's first real automations)
| # | Item | Why | Done when | Forms change? |
|---|---|---|---|---|
| C1 | JR cutover Day 0 on staging (`CUTOVER_PLAN_JR.md` §1) — Router node in series before `Mark Portal JR Complete` | retires the cookie/secret path | parallel week started; first real JR closed by `efx-bot` | prod alias layer must exist first (B4 → prod promotion) |
| C2 | Initial Request from approved email (cookbook R2) built by George on TEST | his stated next automation | `NEW_EMP_` created from n8n with approval gate; id in response | no |
| C3 | Open-task digest (`41_Ref_OpenTasks_Digest`) to real assignees after a redirected week | quick win, zero Forms risk | recipients switched from dbinns override | no |
| C4 | 30/60/90 check-ins (cookbook R5) | Tier-1 candidate in `08_AUTOMATION_CANDIDATES` | schedule + `n8n_closeTask review_306090` | no |
| C4b | Post-submit **Preferred Name** update for HR (`n8n_updatePreferredName`) — worked example diff ready in `docs/review/`, needs a 3-way merge + decision that HR wants it | George/HR ask from the brief's spirit; proves the Procedure-B path | merged behind tests; wrapper `29_…` | fork/dev (additive) |
| C5 | Q23: Termination tasks get `formType`s | lets George close offboarding tasks by type | next Forms release; contracts version bump; `n8n-check --update` | **yes** (additive) |
| C6 | Onboarding via EFX (`40_Ref_Onboarding_via_EFX`) — blocked on SiteDocs multi-company token (Q17) | full ID-Setup automation | token scope resolved; flow active on TEST | no |

## D. Platform hardening (when the TEST tier is boring)
| # | Item | Why |
|---|---|---|
| D1 | Signed event webhook (`EFX_EVENT_WEBHOOK_URL`, `efxSign_`) as an alternative to polling | lower latency triggers; already coded, never exercised live |
| D2 | Custom n8n node `router/n8n-nodes-efx-appscript` (TypeScript scaffold) | one-node ergonomics for George; needs a build + install on the n8n image |
| D3 | Registry sheet of projects per tier + `n8n_info` federation (spec 12 §6) | second Apps Script project onboarding without touching the router |
| D4 | Forms help chatbot (`CHATBOT_FORMS_HELP_SPEC.md`): Phase 0 = **end-user help content** (`docs/help/` — none exists today; canned answers for prod defects #1/#8/#12/#13/#15/#17 are the cheapest deflection), then T0/T1 on Google Chat via n8n, separate least-privilege `forms-help-bot@` principal, per-user OAuth for T3 later | Google Chat identity → Actor; bot-side ownership checks; T3 gated by dryRun→confirm |
| D5 | Forms backlog: prod defects #1–#8, #10, #12–#17 (`KNOWN_DEFECTS_PROD.md`) | correctness George will otherwise inherit (e.g. #15 Finance limit, #16/#17 status change) |
| D6 | Retire `doPost completeJrTitle` + @76 + Lambda `portal-complete-jr-item` (`CUTOVER_PLAN_JR.md` §5) | secrets-in-body path gone |

## E. Documentation & process (continuous)
| # | Item |
|---|---|
| E1 | **[done]** FAQ + FOR_DEVELOPERS + FOR_GEORGE §6: dedupe semantics, `E_FORBIDDEN`, `principal` in ping, lint gate |
| E2 | After TEST: fill `TEST_PLAN.md` results; update `OVERNIGHT_STATUS.md`; memory note |
| E3 | Team-group-n8n-workflows repo: export George's `J7RU99n01pq9Xk3D` before Day 0 (cutover G6) |
| E4 | **[done 2026-09-16 23:30]** Skill evaluations run by fresh agents on all four skills (check-test-validate, projects, logs, new-form-review on a throwaway copy); critiques applied, skills rewritten/regenerated; the new-form-review run produced a worked example kept as `docs/review/EXAMPLE_ADD_ALIAS_updatePreferredName.diff` (not merged — speculative feature) |

## Sequencing (critical path)
A1 → B1 → B4 → (B5) → C1 Day 0 → parallel week → C1 Day 8/15 → D6. Everything in C2–C4 can run on TEST in parallel with the JR parallel week.
