# 2026-10-13 — Browser audit, form load timings, two fixes

Autonomous session. Brief: *"check it all use browser make fixes check sheet etc. check each form
load for errors/speed issues going dashboard to new form is slow… dont deploy to live just head.
do tests to my email… filtered to a label… dont break n8n. do check fix cycles till perfect."*

## Blocked — needs your action

`clasp push` was refused by the session's auto-mode permission classifier (reason: *Production
Deploy*). **Everything below is committed to git but is NOT on Apps Script HEAD.** Nothing I did
this session changed the live app or the prod sheet.

Consequence: every server-side item in the brief is blocked behind that push —
the sheet audit, `auditCountsForRunner` verification, and the labelled test emails all need the
new code on HEAD first. The `EFX-Tests` Gmail label (`Label_15`) is created and waiting.

To unblock: run `clasp push -f` from `employee_management_v2/` yourself, then say the word and I'll
run the verification pass.

## Fix 1 — 6 open tasks were invisible on the dashboard

Action-item categories were renamed at some point: `Fleetio → Fleet`, `Jonas → Purchasing`,
`Credit Card → Finance`. Current code writes the new names, but rows written *before* the rename
still carry the old ones, and no badge matched them — 3 Fleetio + 3 Jonas tasks were open with no
badge and no filter that could reach them.

`_canonicalCategory_()` in `DashboardDataHandler.js` now normalises on read, applied to **both**
the badge counts and the client filter map so the two cannot disagree.

Not verified against the live sheet yet — that needs the push.

## Fix 2 — destructive test functions were callable by any signed-in user

The more serious find. Apps Script exposes **every global function** to the client, and the web app
shell ships their names to the browser — I read them out of the served HTML. Before this fix, any
user on an allowed domain could open the portal console and run:

- `google.script.run.cleanupSuperDebugWorkflow('NEW_EMP_…')` — deletes that workflow's rows from
  every sheet
- `google.script.run._smokeSetup()` — sets the **global** Script Properties `TEST_SPREADSHEET_ID`
  and `SUPPRESS_EMAILS_OVERRIDE`, silently redirecting all prod writes to the dev sheet and
  suppressing every outgoing email org-wide

Both execute with the **deploying user's** rights, because the web app runs as `USER_DEPLOYING`.

`_assertTestAdmin_()` (in `TestRunner.js`) now gates 29 functions across `SuperDebug.js`,
`TestRunner.js` and `ProdSmokeTest.js`.

The subtle part, pinned by a test: the guard reads `getActiveUser()` and **never**
`getEffectiveUser()`. Under `USER_DEPLOYING` the effective user is `no-reply@team-group.com`, which
*is* in `ADMIN_EMAILS` — an effective-user check would have passed for every caller and silently
defeated the guard. It fails closed when the active user can't be determined.

Still works: the Apps Script editor, installable triggers, and `gas_runner.py` over the Execution
API — all report the authorising user (you), who is in `ADMIN_EMAILS`.

**n8n impact: none.** No guarded name is referenced from `N8n.js`, `EfxApi.js`, `FormContracts.js`
or `Actor.js`, and `n8n-check.js` reports contracts unchanged against the lock.

## Form load — measured, not guessed

All 12 routes fetched from HEAD (`/dev`): **every one returned 200**, with no router error, no
"Form not found", no access-denied and no maintenance page.

Medians over 4 passes:

| Route | Median | Server work in `doGet` |
|---|---|---|
| `ref_new_hire` (static) | 2.04 s | none |
| landing (static) | 2.22 s | none |
| `termination_request` | 2.38 s | `getInitialFormData()` |
| `initial_request` | 2.65 s | `getInitialFormData()` |

**The slowness is mostly not our code.** A page that does *zero* sheet work still costs ~2.0 s —
that is Apps Script's own floor (`doGet` + HtmlService). Our one sheet read adds ~0.5 s. Full
navigation also pays ~1.2 s for the sandbox iframe boot on top, which is why dashboard → form feels
like 4–5 s.

Headroom available, your call:

- **Cache `getInitialFormData()`** (one `Data_Lookup` read, every form open) — saves ~0.5 s per
  form, ~20 % of `doGet`. I did **not** do this: it trades freshness on a sheet you hand-edit, and
  you were editing sites/domains this week. A 5–10 min TTL would mean a new job site code doesn't
  appear immediately. Worth it only if you want the explicit invalidation hook alongside it.
- The remaining ~2.0 s floor is Google's; no code change touches it.

## Verified live on HEAD

Fetched the served HTML for each form and checked the fields you asked for are really there:

- `initial_request` — Union label + 2 radios, DSS Language select ✓
- `equipment_request` — same ✓
- `position_site_change` — `unionOld`/`unionNew` pair ✓
- `termination_request` — neither, correct by design ✓

## Tests

All seven suites green: **159 / 218 / 315 / 27 / 24 / 22 / 600**.
New: `__tests__/test-guard-test.js` (22) — pins the `getActiveUser`-not-`getEffectiveUser`
behaviour and asserts each destructive function still carries its guard.

## Still open

1. `clasp push` — blocked, see above. Everything else waits on it.
2. Sheet audit and `auditCountsForRunner` reconciliation — needs the push.
3. Labelled test emails to you — needs the push. `EFX-Tests` label is ready.
4. 6 dead `Reference_*` keys in `CONFIG.SHEETS` (`REFERENCE_SITES`, `_JOB_CODES`, `_MANAGERS`,
   `_REQUESTERS`, `_JRS`, `_JOBS_JONAS`) — zero references anywhere; real reference data comes from
   `Data_Lookup`. Left alone (you don't like deletions); say the word and I'll mark them deprecated.
5. Two stale comments in `SuperDebug.js` (lines 34, ~1962) still say `_purgeWorkflowRows` comes from
   `TestRunner.js`; it's defined locally since the 2026-10-13 rename. Cosmetic.
6. Leftover `NEW_EMP_20260306-125445_921` (March SuperDebug row); two sheets with one blank trailing
   header.
7. Local commits are not pushed to the git remote.
