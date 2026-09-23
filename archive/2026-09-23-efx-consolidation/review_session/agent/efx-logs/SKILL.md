---
name: efx-logs
description: >
  Find and pull every log for the Employee Forms ↔ n8n (EFX) integration and answer "did it run / why did it
  fail / who closed this / what did n8n send / prove no email went out / the poller missed an event": the Forms
  Raw Log (submit, result, task and requestId-audit events via n8n_events), Action Items / Audit Log / Employee
  IDs attribution, Apps Script Executions and Cloud Logging, n8n executions via UI or public API, the local
  test logs under docs/test-logs, and George's BOSS Lambda CloudWatch logs. Use it before guessing at causes,
  whenever a requestId (REQ-…), an E_* code, a workflowId, a task id or "the logs" is mentioned.
---

# EFX — getting logs and proving what happened

Repo: `P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_efx\`. Read-only everywhere; never paste secrets.
If `.clasp.json` still says `REPLACE_ME…`, the TEST tier does not exist yet — say which command you *would* run and what you expect.

## 0. Anatomy of a failure (read once)
- Alias envelope (`N8nEnvelope.js`): `{ ok:false, apiVersion, requestId:'REQ-XXXXXXXX', error:{ code, message, fields?, upstream?, principal? } }`.
  `error.upstream` = the raw handler result (`{success:false, message}`) — only visible in the Router's `scripts.run` node output, **not** in the thrown string.
- Router (`00_EFX_Router`) throws `EFX <CODE>: <message> [fn=n8n_<alias>, requestId=REQ-…]`; `E_ALREADY_CLOSED` becomes `{ok:true, alreadyClosed:true}` unless `treatAlreadyClosedAsSuccess:false`. Router-side codes: `E_TRANSPORT` (HTTP), `E_SCRIPT` (script threw before the alias ran).
- Codes and meanings: `N8N_ERROR_CODES` in `N8n.js` (rendered in `docs/N8N_CONTRACTS.md`). `E_UPSTREAM`/`E_FORBIDDEN`/`E_VALIDATION` are *handled* — the Apps Script execution shows **Completed**; only `E_SCRIPT`/`E_INTERNAL` show Failed.

## 1. Forms Raw Log — the audit trail (sheet `Raw Log`; read it through the API)
Columns: `Timestamp | Source | Workflow ID | User | Raw JSON | Event ID | Kind`. `Event ID` = `EVT-<yyyyMMddHHmmss>-<8 hex>` (the cursor).

| `Kind` | Written when | Notes |
|---|---|---|
| `submit` | a handler is entered (before it runs) | exists even when the call then fails with `E_UPSTREAM` — no `result` row follows |
| `result` | a handler returned | payload carries `workflowId`, `internalEmployeeId` for creates |
| `task.created` / `task.closed` | `Services/ActionItemService.js` | taskId, workflowId, category, formType, assignedTo / closedBy |
| `alias` | `n8nGuard_` → `n8nAudit_` (N8nEnvelope.js): **every failed alias call and every successful mutating call** | `{requestId, alias, kind, ok, code?, message?, ms, principal}` — this is where a `REQ-…` id is persisted. Successful reads (ping/list/events/context) are not logged. Hidden from `n8n_events` unless `kinds:['alias']`. |

Read it: `n8n_events(actor, { afterEventId?, afterTs?, kinds?[], sources?[], limit? (≤1000), tail? })` → `{ events[], nextAfterEventId, nextAfterTs, pruned }`.
`events[].payload` is redacted (`efxRedact_` in `EfxUtil.js`, keys matching `EFX_SECRET_KEY_RE` → `[REDACTED]`); the sheet keeps the raw payload — that is why humans do not browse it.
`pruned:true` = the cursor is not in the log any more (poller fell behind or rows were pruned) → resync by `afterTs` (`docs/wiki/RUNBOOKS.md` §5). With a cursor only the last `tail` rows (default 1500) are read.
**Find a requestId:** `n8n_events(actor, {kinds:['alias'], afterTs:'<minute before>'})` and match `payload.requestId`; or filter the sheet's `Raw JSON` column for `REQ-3F9A1C2B`.

Other business-level trails: `Action Items` (`Closed By`, `Notes`, `Draft`) via `n8n_listTasks`; `Audit Log` (`CANCEL|BUMP|UPDATE_HIRE_DATE|HIDE`); `Employee IDs` (`Allocated By`, `Source`, `Note`) via `n8n_getEmployeeId`; `Form Edit Log` (HR/IT edits).
Attribution: `Submitted By` / `Closed By` / `Raw Log.User` = `actor.email` for automation, the human's email for UI submits; **authorization** was decided by the principal (`payload.principal` in `alias` rows, `principal` in `n8n_ping`).

## 2. Apps Script side
- Editor → **Executions**: filter by function (`n8n_closeJrTask` …). Handled errors show *Completed*; look at `Logger.log` lines: `[createWorkflow] Idempotency guard…`, `[RawLog] Logging failed (non-fatal)`, `[EMAIL SAFE-GUARD]`, `[EMAIL SUPPRESSED]`, `[migrateEfx] …`.
- Cloud Logging (script linked to `efx-test`/`efx-prod`): `resource.type="app_script_function"`. Useful filters are the prefixes above, e.g.
  `gcloud logging read 'resource.type="app_script_function" AND textPayload:"[EMAIL SAFE-GUARD]"' --project efx-test --limit 50` — there is **no** generic `[EFX]` or `E_` marker in Logger output; codes live in the envelope, not in the log.

## 3. n8n side (what was actually sent and received)
- UI: wrapper workflow → Executions → open the failed run → the Execute Workflow node shows the thrown `EFX <CODE>… [fn, requestId]`; open the linked **Router sub-execution** → `scripts.run (Execution API)` node output has the full envelope incl. `error.upstream`.
- Public API (key file `D:\Credentials\n8n\api-key-staging.txt`, header `X-N8N-API-KEY`; hosts `n8n-staging.team-group.com`, `n8n-prod.team-group.com`):
  ```bash
  curl -s -H "X-N8N-API-KEY: $KEY" "https://n8n-staging.team-group.com/api/v1/executions?workflowId=<id>&status=error&limit=20"
  curl -s -H "X-N8N-API-KEY: $KEY" "https://n8n-staging.team-group.com/api/v1/executions/<execId>?includeData=true"
  ```
- Idempotency: the Router caches replies per `idempotencyKey`; a repeated key returns the cached envelope (same requestId) — not a second Forms call.
- `30_EFX_Canary` (every 15 min): `n8n_ping` → asserts env/sheet/apiVersion → alert email to dbinns. Its executions are the cheapest "was the door open at 14:00?" answer.
- `20_Forms_EventsPoller`: cursor (`afterEventId`, `afterTs`, `seen[]`) lives in **workflow static data**, which persists only for *active* runs — a manual test run does not advance it. Each tick: `Load cursor` → `Router: n8n_events` → Switch by `source`/`kind` (Initial Request / ID Setup outputs fire on `kind:'result'` only). If the poller "missed" an event: is it active? what did that tick's `n8n_events` return (`pruned:true` → `[]` by design)? did Forms write the row at all (`n8n_events` by `afterTs`)? `limit:200` spill? then RUNBOOKS §5 resync.
- Container logs (infra only): CloudWatch `/ecs/n8n-staging`, `/ecs/n8n-prod` (huge — window ≤ 2 days).

## 4. Proving "no email was sent"
- **Local suites:** the mock `MailApp` (`__tests__/gas-runtime.js`) only pushes to an array; there is no GmailApp/UrlFetchApp in the runtime. `node efx-e2e-test.js` writes `docs/test-logs/efx-e2e-<YYYYMMDD-HHmm>.md` with header `**Result: PASS (3 recorded prod defects …)** — N passed / 0 real failures / 3 recorded defects · M emails captured (0 sent)` and scenario *EMAIL SAFETY* asserting every captured `to` = dbinns with `[TEST]` subjects. Three scenarios show ❌ `DEFECT` lines by design (recorded prod defects #15–17). Delete the log you created if you are in a read-only pass.
- **TEST tier (honest claim = "no mail reached a real recipient"):** `EmailUtils.js` forces redirect + `[TEST]` prefix when `ENVIRONMENT !== 'PROD'` (fork ships `'TEST'`) and logs `[EMAIL SAFE-GUARD]`; `EMAIL_REDIRECT_ALL` does the same explicitly; `SUPPRESS_EMAILS_OVERRIDE='true'` gives literally zero mail (`[EMAIL SUPPRESSED]`). Evidence: Executions/Cloud Logging on those prefixes, dbinns' inbox count, and `n8n_events({kinds:['result']})` to show the writes still happened. Sent-mail search on `efx-bot` via GAM is possible but **ask first** (mailbox access).

## 5. George's BOSS chain (AWS, read-only)
```bash
MSYS_NO_PATHCONV=1 aws logs describe-log-streams --log-group-name /aws/lambda/boss-jr-assign --order-by LastEventTime --descending --max-items 5 --region us-east-1
MSYS_NO_PATHCONV=1 aws logs get-log-events --log-group-name /aws/lambda/boss-jr-assign --log-stream-name "<stream>" --limit 50 --region us-east-1
```
`portal-complete-jr-item` has been dead since 2026-07-16; ignore it.

## 6. Answer format
Order of evidence for a failed call: (1) n8n execution → thrown `EFX <CODE>` + requestId; (2) Router sub-execution → envelope + `error.upstream`; (3) Forms Raw Log `alias` row for that requestId (principal, ms) and the `submit`/`result` rows for the workflow; (4) Apps Script Executions only for `E_SCRIPT`/`E_INTERNAL`. State what each place *will* show, then what it *did* show. Never quote a secret; never modify a sheet to "test".
