# CLAUDE.md — employee_forms_deployment (LIVE)

## How to answer Binns (applies to EVERY reply, not just summaries)

**Bullets. Short. No walls of text.** This has been asked for repeatedly and drifted every time.

- **Default shape:** 3–6 bullets under at most 2–3 short headings. One idea per bullet, one line each where possible.
- **Hard ceiling:** ~15 lines of prose per reply. Over that, you are doing it wrong — cut, don't reorganise.
- **Lead with the answer.** The conclusion is the first bullet. Evidence only if it changes the decision.
- **No tables** unless comparing 3+ things on 2+ axes. No nested bullets beyond one level.
- **Don't re-explain** what was covered earlier in the session. Assume he remembers.
- **Detail is opt-in.** End with one line offering it ("say the word and I'll go deeper") rather than pre-empting it.
- **A question gets an answer, not a briefing.** "Is X a risk?" → yes/no + why, in two bullets.
- **Jargon is welcome — define it on first use.** Use the precise term (oracle, closure, idempotent,
  blast radius), then one short clause saying what it means. Don't dumb terms down, and don't drop
  them in undefined.
- **Long-form belongs in a file**, not the chat — write `docs/runs/…`, then link it in one bullet.
- **One task at a time.** State the plan, wait for approval, run that one thing. Do not chain steps that look obviously next.
- **Manual steps:** what, why it can't be automated, how — one item at a time, with a clickable link.
- **Never imply something passed that you did not see.** Say "not verified" plainly.

## Where things are

| Thing | Path |
|---|---|
| Git repo root (branch `main`) | `P:\Repos\github\danieljbinns\APP SCRIPT FORMS` |
| Working dir / docs / tools (**this file**) | `…\APP SCRIPT FORMS\employee_forms_deployment` |
| Apps Script source (clasp root) | `…\employee_forms_deployment\employee_management_v2` |
| **ARCHIVED — ignore entirely** | `…\APP SCRIPT FORMS\employee_forms_efx` |

- `employee_forms_deployment` is a **subdirectory** of the repo, not its own repo.
- `employee_forms_efx` was archived 2026-09-23; its `CLAUDE.md` is stale and actively wrong
  (claims `scriptId: REPLACE_ME`, claims prod is untouched, says "never point at prod"). All false.
  Do not read, edit or trust anything in it.
- Sibling folders here (`employee_management_v2_dev`, `_staging`, `_prod_live_20260918`,
  `_webform_live_v75`) are **snapshots / review copies**, not the live tree. `_prod_live_20260918`
  has its own REVIEW-ONLY `CLAUDE.md` that applies inside that folder only.
- 7 stale git worktrees exist (incl. `remote_review`). None in use. Leave them.

## Prod — we work on prod directly

- Script ID: `1AuIbJl1jRh1awi-MW-6y_NftHUGtfUNRexZk1gPzvenmIblSZo-lPz66` (in `employee_management_v2/.clasp.json`)
- Spreadsheet: `1kGjw8e-uIehaBemlsRZ4Yq1QrYOWkJvWzhKbgfl4Pxo`
- Live web app: `AKfycbyXp4q0…` **@80**, runs as `USER_DEPLOYING` = `no-reply@team-group.com`
- HEAD `/dev`: `AKfycbwIDtch…` — whatever code is currently saved
- `AKfycbw7fhvI…` **@76** — JR automation, anonymous `doPost`. **DO NOT re-version or delete.**
- `AKfycbwAb33…` @75 — stray. Leave alone.
- `clasp push -f` updates **HEAD only**. @80 keeps serving its pinned version until explicitly redeployed.

## Hard constraints

- **Don't break n8n.** Contract gate must pass before anything ships.
- **Don't re-cut @76.** Re-versioning it breaks the JR automation `doPost`.
- **Prefer archiving over deleting** — sheets, rows, config keys, files.
- Destructive globals are guarded by `_assertTestAdmin_()` (`TestRunner.js`), which reads
  `getActiveUser()` and **never** `getEffectiveUser()`. Under `USER_DEPLOYING` the effective user is
  `no-reply@team-group.com`, which IS in `ADMIN_EMAILS` — using it would defeat the guard. Don't "fix" this.

## Tooling gotchas

- **The Bash tool's auto-mode classifier REFUSES `clasp push`** (flags it "Production Deploy").
  Use Desktop Commander instead: `mcp__Desktop_Commander__start_process`, shell `powershell.exe`.
  Same for `gas_runner.py`.
- `gas_runner.py` → `D:\Credentials\google\binns-claude-desktop\gas_runner.py`. Takes **no arguments**.
  Expects a return shaped `{pass, fail, warn, emailTotal, failures, gasLog}`.
  The client often times out while the script finishes server-side — **re-read state, don't assume failure.**
  It also mislabels nested/list returns as FAIL; read `gas_last_result.json` rather than its verdict.
- `clasp run` does **not** work here (needs a shared GCP project). The Execution API token is dead
  (`invalid_grant`); `clasp push` and GAM still work.
- Browser E2E against the web app is blocked — the sandbox iframe defeats Chrome screenshot/a11y.
  Use the Node harness for functional E2E.

## Tests — all seven must be green

Run from `employee_management_v2\`: `node __tests__/<name>.js`

| Suite | Assertions |
|---|---|
| `super-test` | 159 |
| `efx-test` | 218 |
| `form-field-map-test` | 315 |
| `dashboard-test` | 27 |
| `config-test` | 24 |
| `test-guard-test` | 22 |
| `efx-e2e-test` | 600 |

- `__tests__/gas-runtime.js` is a full in-memory Apps Script mock (Spreadsheet, Mail, Session, …)
  loaded into a Node `vm` with stubbed globals. It is the starting point for any local GAS runtime checking.
- `migration-test.js` also exists but is not part of the seven-suite gate.

## Contract gate

From `employee_forms_deployment\`:

```
node tools/efx/n8n-check.js
```

After any field change, regenerate first: `node tools/efx/gen-contracts.js --lock`

## Shape of the code

- 43 `.js` + 38 `.html` files at the clasp root, concatenated by Apps Script into **one global scope**.
  Duplicate `function`/`const` names across files collide silently — that's a real defect class, not a style nit.
- Sheet access is inconsistent by design/history: **New Hire reads by header name**; **Terminations and
  Status read by index**. Check which before touching a schema.

## Perf context (measured — don't re-litigate)

- Apps Script's own floor is **~2.0s per page**. A route doing zero sheet work still costs that.
- `getInitialFormData()` (one `Data_Lookup` read, every form open) adds ~0.5s; the sandbox iframe ~1.2s.
- Caching `Data_Lookup` was **deliberately not done** — it trades freshness on a sheet Binns hand-edits.
  His call. Don't do it unsolicited.

## Read first

- `docs/runs/2026-10-13-audit-and-perf.md` — browser audit, form load timings, the legacy-category and guard fixes
- `docs/runs/2026-10-14-static-audit.md` — static audit pass 1, plus an explicit list of what was NOT covered
- `PROJECT_STATE.md`, `HANDOFF.md`, `CREDENTIALS.md` (note: some IDs in `CREDENTIALS.md` are inverted — verify)
