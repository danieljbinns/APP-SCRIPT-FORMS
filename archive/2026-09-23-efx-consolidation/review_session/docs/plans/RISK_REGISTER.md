# Risk register — EFX (Employee Forms ↔ n8n) · maintained by the agent as chief-of-staff · 2026-09-16 night

Scored L (likelihood 1–3) × I (impact 1–3). Owner is who decides, not who types. "Signal" is how you would notice.

| # | Risk | L | I | Signal | Mitigation in place | Residual action | Owner |
|---|---|---|---|---|---|---|---|
| R1 | Service-account impersonation wrong → every role check runs as the wrong principal | 2 | 3 | `n8n_ping.principal` ≠ `efx-bot@team-group.com` | `principal` exposed in ping; T12a first in the smoke; `E_FORBIDDEN` names the principal | stop the day at Gate 4 if wrong | Binns |
| R2 | Org policy blocks SA key creation | 2 | 2 | `FAILED_PRECONDITION` at `keys create` | abort line in `CHECK_AND_DEPLOY_PLAN.md` Gate 1; Forms-only day still delivers script + migration | Org Policy exception request drafted (COMMS §3 style) | Binns / Org admin |
| R3 | A test email reaches a real inbox | 1 | 3 | anyone but dbinns receives `[TEST]` mail | `ENVIRONMENT='TEST'` forced redirect **and** `EMAIL_REDIRECT_ALL`; mock captures in all suites | set the property before the first run; check inbox at T4 | Binns |
| R4 | Prod sheet or script touched by mistake | 1 | 3 | `efxSelfTest.spreadsheetId = 1kGjw8e…`; `clasp` output shows `1AuIbJl1jR…` | `.clasp.json` placeholder; Node tools refuse prod ids; Gate 2 id comparison | 16:00 read-only check of prod deployments | Binns |
| R5 | Same-second id collision / duplicate Internal Employee ID under bursts | 1 | 3 | duplicate id in `Employee IDs` | collision guard (#18), append-then-verify, lock-or-throw (M5) | T12j burst test; watch `E_INTERNAL` lock messages | Binns |
| R6 | Two different hires merge into one workflow (constant n8n requester) | was 3 → now 1 | 3 | two names, one `NEW_EMP_` | dedupeKey on requester+employee+hireDate (#19) | T12b/12c | — |
| R7 | Credentials leak through the API (record read-back, events, context) | 1 | 3 | `[REDACTED]` missing in any envelope | `efxRedact_` on events, context, record, `efxRunAs` | T12e; add new secret-like keys to `EFX_SECRET_KEY_RE` when forms change | Binns |
| R8 | George's live JR chain breaks during cutover | 2 | 3 | JR task not closed after BOSS success | parallel run (Router first, doPost second) for a week; disable-not-delete; rollback table | Day −1 message (COMMS §1), export G6 | Binns / George |
| R9 | Contract drift: Forms change breaks a wrapper silently | 2 | 2 | `n8n-check` BREAK; canary alert on `apiVersion` | lock + gate in `AGENTS.md`, `PROCESS_CHANGE_MANAGEMENT.md`; aliases never renamed | run `n8n-workflows-check` in the same gate | Devs |
| R10 | Mock ≠ Apps Script (Session under DWD, LockService, PropertiesService, AdminDirectory role) | 3 | 2 | any T-test diverges from the local suite | `CODE_REVIEW_EFX_PASS2.md` §3 table; T12 covers the top ones | tick the table in `TEST_PLAN.md` results | Binns |
| R11 | `efx-bot` lacks group membership → approvals/HR/IT aliases `E_FORBIDDEN` | 3 | 1 | T12f | designed behaviour; decision D2 | add per tier, log in `10_ACCESS_AND_ACCOUNTS.md` | Binns |
| R12 | Events poller misses or duplicates events as the Raw Log grows | 2 | 2 | gaps vs sheet during the 24 h soak (B3) | cursor by Event ID + ts, `pruned` flag, bounded tail with full-read fallback (M6) | soak on TEST; consider signed webhook (D1) | Binns |
| R13 | SiteDocs token is single-company → onboarding flow `40` can't create workers for other companies | 3 | 2 | SiteDocs create fails for non-Walcon sites | flow `40` inactive; Q17 open | resolve token scope before C6 | Binns |
| R14 | Pre-existing prod defects surface as "the automation is wrong" (#15 Finance limit, #16/#17 status change, #1/#8 IT Confirmation) | 3 | 1 | user complaints after George automates those forms | `KNOWN_DEFECTS_PROD.md`; help content explains symptoms; E2E records them as DEFECT | schedule the Forms backlog (D5) | Binns |
| R15 | Execution API 6-minute cap / quota on bursts | 1 | 2 | n8n timeouts, `E_UPSTREAM` 5xx | wrappers are single calls; poller 1-min; retry only reads | rate-limit George's loops (cookbook §3) | George |
| R16 | Fork and live repo diverge before promotion (two sources of truth) | 2 | 2 | prod hotfix not in the fork | `PROMOTION_PLAN_CODE.md`; fork archived after promotion | rebase the fork on any prod hotfix before dev promotion | Binns |
| R17 | Chatbot (later) lets a requester act on HR tasks through the shared bot principal | 2 | 3 | — (design stage) | spec mandates bot-side ownership checks + separate least-privilege `forms-help-bot@`; T3 gated | decide Q24–Q27 before build | Binns |
| R18 | Key material in the wrong place (repo, chat, n8n export) | 1 | 3 | secret scan hit (`n8n-workflows-check`), git diff | lint secret scan; `.gitignore`; SA key only under `D:\Credentials\google\efx\` | rotate if ever pasted anywhere else | Binns |

## Review cadence
Re-score after the TEST day (R1–R4, R10, R11 should drop), after the JR parallel week (R8), and before prod promotion (R16). Keep the table under 25 rows; retire rows whose residual action is done.
