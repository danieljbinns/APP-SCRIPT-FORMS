# Code review — EFX fork, PASS 2 (post pass-1 fixes)

Reviewed 2026-09-16 (late evening), read-only, against fork HEAD `12b6c80` ("full E2E suite green, n8n wrappers 17-28
+ reference flows, retry-safe aliases, id-collision guard"). Pass 1 is `CODE_REVIEW_EFX.md`; its fixes landed in
`0ed9d7e`. Scope here: everything in `employee_management_v2_efx/` that pass 1 did not see or that changed after it
(`N8n.js`, `EfxApi.js`, `Actor.js`, `RawLog.js`, `EmployeeIdRegistry.js`, `FormContracts.js` r2, `WorkflowManager.js`
guard, `IDSetup.js`, `InitialRequestHandler.js`, `Setup.js`/`MigrationTools.js` EFX parts, the three Node suites and the
mock runtime). Nothing was modified except this file.

Suites run at this HEAD (Node 22, from `employee_management_v2_efx/__tests__`): `efx-test.js` **120/120**,
`super-test.js` **159/159**, `form-field-map-test.js` **312/312**, `efx-e2e-test.js` **568 passed / 3 recorded
defects** (all three pre-existing prod defects #15/#16/#17), `node tools/n8n-check.js` → `OK`.

---

## 1. Verdict for tomorrow's TEST deployment

**Deploy to TEST: yes.** Nothing found blocks pushing the fork to a new TEST script and running the T1/T2 plan. The
human UI path is still prod-equivalent (re-verified: every `Actor.email()` at an authorization site was replaced by
`Actor.principal()`, and `Actor.principal()` is exactly prod's `Session.getActiveUser().getEmail()`).

**Fix before the first n8n wrapper uses these features** (both are ≤10-line changes; ideally tonight so TEST validates
final code):

- **H1** — `include:'record'` on `n8n_submitIdSetup` / `n8n_submitItSetup` returns plaintext passwords. Pass-1 F2 closed
  the events/context/webhook paths but not this one.
- **H2** — two *different* employees created by the same requester within 30 s are silently merged into one workflow and
  one Internal Employee ID. Pre-existing prod behaviour, but the alias layer and the reference onboarding flow make it a
  realistic automation path, and both suites currently assert it as *expected*.

Everything else is Medium/Low and can be batched with the PROD-merge work. The pass-1 status table is in §6.

---

## 2. Findings

Severity is judged for the **real Apps Script + Execution API environment** (script runs as `efx-bot@team-group.com`
under domain-wide delegation, `devMode:false` against an API-executable deployment), not for the Node mock.

### High

| # | File:line | Finding | Why it matters live | Minimal fix | Suggested test |
|---|---|---|---|---|---|
| **H1** | `N8n.js:103-104` → `EfxApi.js:35-49` (`efxReadRecord`) | The `include:['record']` read-back is the raw header-keyed row of `c.targetSheet` with **no `efxRedact_`**. For `id_setup` that sheet is `ID Setup Results` whose headers include `SiteDocs Password`, `DSS Password` (`Setup.js:53`, `SCHEMA.ID_SETUP_RESULTS.SITEDOCS_PASSWORD/DSS_PASSWORD`); for `it_setup` it is `IT Results` with `Email Password`, `Phone VM Password` (`Setup.js:66-68`). | The value crosses the Execution API into n8n execution data (persisted, visible to every n8n editor, and to the *Error Notifications* workflow on failure). `efxRedact_`'s regex already matches these header names (`/password/i`), so the omission is purely the call site. | `extra.record = (typeof efxRedact_ === 'function') ? efxRedact_(efxReadRecord(c.targetSheet, res.workflowId)) : efxReadRecord(…)`. Consider the same wrap in `efxReadRecord` itself so no future caller forgets. | In `efx-test.js` ID SETUP scenario: `n8n_submitIdSetup(ACTOR, {…dssPassword:'SuperSecret!'}, ['record'])` → `eq(r.record['DSS Password'], '[REDACTED]')`; in OTHER FORMS: `n8n_submitItSetup(…, {include:['record']})` → `r.record['Email Password'] === '[REDACTED]'` and `JSON.stringify(r).indexOf('Tmp!Pass1') === -1`. |
| **H2** | `WorkflowManager.js:89-104` (30-s idempotency guard) + `InitialRequestHandler.js:34-43,63` | `createWorkflow(type, name, initiatorEmail)` returns the **existing** workflowId when the same `(type, initiatorEmail)` was created <30 s ago — regardless of employee. `submitInitialRequest` passes `formData.requesterEmail` as initiator, then `EmployeeIdRegistry.allocate(workflowId)` returns the *existing* id for that workflow, appends a second `Initial Requests` row under the same workflowId with the other employee's name, and `updateWorkflow(workflowId,…, employeeName)` overwrites `Employee Name` on the shared `Workflows` row. Result: two employees, one workflow, one Internal Employee ID, dashboard shows the second name, the first employee's ID Setup link now resolves to the second employee's data. The alias returns `ok:true` with the first workflowId. | Human double-click (same employee) is what the guard was for. Under n8n the requester is frequently constant (an HRIS import, `40_Ref_Onboarding_via_EFX.json` run in a loop, George's test harness) and 30 s is long. The Router's `idempotencyKey` cache does not help — different payloads have different keys. `efx-test.js:167-168` and `efx-e2e-test.js:1071-1074` **assert the merge as expected**; `FOR_GEORGE.md:142` describes it as a harmless window. | Behaviour-preserving for the human case: add an optional 4th argument `dedupeKey` to `createWorkflow`; in the guard, return the existing id **only if** `!dedupeKey || String(row[_WF.EMPLOYEE_NAME]) === '' || String(row[_WF.EMPLOYEE_NAME]) === dedupeKey`. `submitInitialRequest` passes `firstName + ' ' + lastName`. Other callers unchanged (undefined → old behaviour). Alternative if you prefer not to touch `createWorkflow`: in `n8nSubmit_` for `c.createsWorkflow`, snapshot the `Workflows` ids before the call and return `E_UPSTREAM`/new `E_DUPLICATE_WINDOW` if `res.workflowId` pre-existed — but by then the second Initial Requests row is already written, so the `createWorkflow` fix is the right one. | Replace the two "same workflowId" assertions with: same requester, **different** names within one run → distinct workflowIds, distinct ids, `Employee Name` of the first untouched; same requester **same** name twice → same workflowId (double-click preserved), still one registry row. Update `FOR_GEORGE.md:142` to say what the window actually keys on. |

### Medium

| # | File:line | Finding | Why it matters live | Minimal fix | Suggested test |
|---|---|---|---|---|---|
| **M1** | `Services/AccessControlService.js` `_inGroup` (catch filters `'Not Authorized'` out of the log) + `N8n.js:101` (`n8nSubmit_` maps every `success:false` to `E_UPSTREAM`) | Under the Execution API the script — including `AdminDirectory.Members.hasMember` — runs **as `efx-bot`**, not as the deploying owner (the web app is `executeAs: USER_DEPLOYING`, the Execution API is not). If `efx-bot` lacks the Groups Reader role, every group check throws `Not Authorized`, which `_inGroup` deliberately does **not** log, and returns `false`. Every role-gated alias (`n8n_submitHrVerification`, `n8n_submitItSetup`, both approvals) then returns `E_UPSTREAM 'Access denied.'` with no server-side trace, while `n8n_cancelWorkflow`/`bump`/`updateHireDate` return `E_FORBIDDEN` for the same condition. `SETUP_PLAN_TOMORROW.md §4` does grant `_GROUPS_READER_ROLE` and says memberships are "decided tomorrow" — good — but the code gives you no way to see which of the two failed. | First-day debugging of TEST will be "why is HR verification denied?" with an empty log. | (a) `n8nSubmit_`: `if (/access denied/i.test(res.message)) return n8nErr_('E_FORBIDDEN', …)` — consistent with the action aliases and with what `FOR_GEORGE.md` already teaches. (b) `efxInfo()`: add `principal: Actor.principal()` and `principalRoles: AccessControlService.getUserRolePayload(Actor.principal())` so `n8n_ping` answers the question in one call. (c) `_inGroup`: log the `Not Authorized` case once per execution at debug level when `Actor.isAutomation()`. | Mock `AdminDirectory.Members.hasMember` to throw `'Not Authorized'`, `Session` = `efx-bot` → `n8n_submitHrVerification` returns `E_FORBIDDEN`, and `Logger` contains a line naming the group. Live: `n8n_ping` must show `principalRoles.isHR === true` before running T2's HR step. |
| **M2** | `N8n.js:219-231` (`n8n_saveTaskDraft`) → `Services/ActionItemService.js:369-395` (`saveActionItemDraft`) | The alias builds a **fresh** `{items:{…}}` from only the items supplied and passes `notes || ''`. `saveActionItemDraft` does `setValue(draftJSON)` / `setValue(notes)` — whole-cell replacement. So an n8n partial save wipes every item the human had autosaved in `ActionItemForm.html`, and omitting `notes` blanks the Notes cell. `efxTaskClose` (`EfxApi.js:119-134`) already does the merge correctly; this alias does not reuse it. | The task form and n8n will realistically both touch the same JR/WIS/Fleet tasks (that is the point of the drafts alias). Silent data loss with no error. | Read the existing `Draft` cell (same parse-and-migrate block as `efxTaskClose:119-127`), merge `draft.items[k] = …` over it, and pass `notes === undefined ? undefined : String(notes)` (`saveActionItemDraft` already skips `undefined`). Extract the parse-and-migrate block into `efxParseDraft_(cell)` used by both. | Seed a task with `Draft = {items:{A:{status:'Complete'}}}`, `Notes = 'human note'`; call `n8n_saveTaskDraft(ACTOR, tid, undefined, {B:{status:'Pending'}})`; assert `items.A` retained, `items.B` added, Notes unchanged. |
| **M3** | `FormContracts.js:253-264` (`hash_` fallback) + `tools/gen-contracts.js:20-27` (ctx has no `Utilities.computeDigest`) → `docs/contracts.lock.json` hashes are `fnv1a:…` | Live `n8n_contracts()` returns `sha256:…` (V8 has `computeDigest`). Every form hash in the lock therefore **cannot** match the deployed script. `AGENTS.md` ("Verifying with n8n — live variant … compare each form's hash with the saved baseline, fail on drift") and the planned Router `E_CONTRACT_DRIFT` both assume they are comparable. `n8n-check` passes today only because it compares Node against Node. | The drift gate the whole contract-maintenance rule leans on is silently disabled for live comparison. | In `gen-contracts.js`, give the ctx a real `Utilities.computeDigest(alg, s, cs)` via `require('crypto').createHash('sha256').update(s,'utf8').digest()` mapped to **signed** bytes (`b > 127 ? b - 256 : b`, matching Apps Script), plus `DigestAlgorithm.SHA_256` and `Charset.UTF_8` constants; run `node tools/n8n-check.js --update` once (announce — hashes change, fields do not). Same shim in `gas-runtime.js` so `hash_` never hits the fallback in tests. | Assert every `forms[*].hash` in the lock starts with `sha256:`; known-answer: `hash_({r:['a'],o:[],t:{},v:'x'})` equals the value computed by Node crypto. After TEST is up: `n8n_contracts()` via `exec-api-call.js` and diff against the lock — must be byte-equal. |
| **M4** | `EmployeeIdRegistry.js:81-84` (`rehire-carry`) + `:46-55` (`maxKnown_`) | `existingEmployeeId` is recorded verbatim (no numeric/length check, no lock, no collision check) **and is included in `maxKnown_`**. A carried typo (`'304110'` for `'30411'`, or an ADP id pasted in the wrong box) permanently jumps the sequence for every later hire; a wrong-but-existing id silently gives two workflows one number. Pass-1 F17 rated the missing validation Low; the sequence jump makes it Medium. Only reachable via n8n (`existingInternalEmployeeId` is not posted by the UI) — i.e. exactly the path being opened tomorrow. | Irreversible: ids already emailed and typed into SiteDocs/DSS cannot be renumbered. | `if (!/^\d{5}$/.test(String(id))) throw new Error('existingInternalEmployeeId must be a 5-digit id')`; if `id` exists for another workflow in the registry or `ID Setup Results`, record it with `Note='WARNING: id also on <wf>'` (or throw — policy call). In `maxKnown_`, skip rows whose `Source === 'rehire-carry'` (a rehire's prior id is by definition ≤ the true max and, if it was minted here, is also present on its original row / in `ID Setup Results`). | Carry `'999999'` (expect throw) and `'30409'` (accepted, Note set); then `allocate()` → `30412`, not `1000000`. |
| **M5** | `EmployeeIdRegistry.js:87` (lock failure → `lock = null`, continue unlocked) + `:62-67` (`deleteMine_` deletes by re-read index) | Unchanged since pass 1 (F4). In the mock `waitLock` always succeeds; live it fails after 10 s under contention — which is precisely a burst of `n8n_createInitialRequest` overlapping a human submit — and the code then runs the append-then-verify **without** the lock and deletes rows by an index computed a moment earlier. | The failure is data corruption in the one sheet that must never be wrong, at the one moment it is most likely. A thrown error is recoverable (`success:false`, orphan `Workflows` row, retry reuses the workflowId via the 30-s guard). | `try { lock = LockService.getScriptLock(); lock.waitLock(10000); } catch (e) { throw new Error('EmployeeIdRegistry: lock timeout — retry'); }`. In `deleteMine_`, re-read the two cells at `i+2` immediately before `deleteRow` and only delete if they still match. | Mock `waitLock` to throw → `allocate` throws, `n8n_createInitialRequest` returns `E_UPSTREAM`, no `Employee IDs` row. Live: 5 concurrent `exec-api-call.js --fn n8n_createInitialRequest` with distinct requesters → 5 distinct consecutive ids, 5 registry rows, no `Note` entries. |
| **M6** | `EfxApi.js:206-242` (`efxEventsSince`, `:212 getDataRange().getValues()`) + `n8n/20_Forms_EventsPoller.json` (`minutesInterval: 1`) | Every poll reads the **entire** Raw Log — up to 5001 rows × 7 columns, and column 5 is the full form payload JSON (a New Hire submit is several KB) — then filters in memory. At steady state that is several MB per call, 1 440 calls/day, plus `JSON.parse` per row (the `payload` is parsed even for rows that the `kinds`/`sources` filters will drop — parse happens after those checks, fine, but before `limit` truncation of what is read). | Execution API calls are the same 6-min budget and the same Sheets read quota as human submits; a 5 000-row scan every minute is a self-inflicted background load on the TEST (and later PROD) sheet. `nextAfterTs` handling is otherwise correct (`<=` is right when the caller passes back the last event's own `ts`). | When a cursor is supplied, read a bounded tail first: `var last = sh.getLastRow(); var from = Math.max(2, last - 1500); getRange(from, 1, last - from + 1, 7)`; if `afterEventId` is not found in the tail, fall back to the full scan once (the `pruned` logic already covers "not found at all"). Also read `Raw JSON` only for rows that pass the kind/source/ts filters. | Seed 3 000 Raw Log rows; capture `getRange` calls in the mock; with `afterEventId` = row 2 990's id assert the read window is ≤ 1 501 rows and the result is rows 2 991-3 000. |
| **M7** | `docs/wiki/FOR_GEORGE.md:156-164` (§6 error table), `tools/gen-contracts.js` (hard-coded 6-code table), `FormContracts.js:16-18,146` | Code now emits `E_UNVERIFIED_FORM` (`N8n.js:91`), `E_RATE_LIMITED` (`:206`), `E_TASK_NOT_OPEN` (`EfxApi.js:111`) and uses `E_FORBIDDEN` (`N8n.js:198,206,214`) to mean "permission denied" — but §6 lists none of the three and defines `E_FORBIDDEN` as *"planned, Router: project/function not enabled in the registry"*, a different meaning. `N8N_CONTRACTS.md` (generated) shows only the original six. `FormContracts.js` header (`:16-18`) and the `id_setup` note (`:146`) still say authorization is `Actor.email()` in the group / `CONFIG.ADMIN_EMAILS` — false since pass 1. `AGENTS.md` §Naming: "Do not invent new codes without adding them to FOR_GEORGE §6". (The three codes *are* in `ALIASES_ADDED_2026-09-17.md`, which George is not pointed at.) | George builds retry/branch logic from §6. A wrapper that treats unknown codes as retryable will retry `E_UNVERIFIED_FORM`/`E_FORBIDDEN` forever. | Add the three rows to §6; re-define `E_FORBIDDEN` as "principal lacks the role (HR/IT/Admin/requester/manager)" and move the registry meaning to the Router codes; make `gen-contracts.js` build its error table from a small exported array in `N8n.js` (`N8N_ERROR_CODES`) so it cannot drift again; fix the two comments. | `n8n-check.js`: assert every `E_[A-Z_]+` literal in `N8n.js`/`EfxApi.js` appears in `N8N_ERROR_CODES` and in `FOR_GEORGE.md`. |

### Low

| # | File:line | Finding | Fix | Test |
|---|---|---|---|---|
| L1 | `N8n.js:72-74` (`n8nGuard_`) | Still swallows the stack (pass-1 F13). Under the Execution API, Cloud Logging (`exceptionLogging: STACKDRIVER`) is the *only* place to see it. | `Logger.log('[n8n] ' + ((err && err.stack) \|\| err));` before returning `E_INTERNAL`. | Throw inside a guarded fn; assert a `Logger` line contains the message. |
| L2 | `N8n.js:293-294` | Forced Safety close still writes checklist status `'Open'` (pass-1 F14). `ActionItemForm.html:264,294-299` vocabulary is `Pending \| Complete \| Collected \| Not Returned`; `'Open'` renders with no active button. | `'Pending'`. Optionally validate `checklist[*].status` in `efxTaskClose` against the four values. | `n8n_assignSafetyTraining(…, {dssConfirmed:'No', force:true})` → draft item status `'Pending'`. |
| L3 | `EfxApi.js:98-103,109-111` | By-`workflowId` lookup records any non-`Open` row as `closedRow` → a **Cancelled** task returns `E_ALREADY_CLOSED`, which §6 tells George to *treat as success*. By-`taskId` correctly returns `E_TASK_NOT_OPEN`. Inconsistent, and the cancelled-workflow case is the one where "treat as success" is wrong. | Track `closedRow` only when `Status === 'Closed'`; keep any other status in `otherRow` and return `E_TASK_NOT_OPEN` for it. | Seed `Cancelled` jr_title; `n8n_closeJrTask(ACTOR, wf)` → `E_TASK_NOT_OPEN`. |
| L4 | `N8n.js:255,298` (`p.dryRun === true`, `d.dryRun === true`) | A string `"true"` performs a **real** close. The shipped wrappers coerce with `bool()` (`16_`, `13_`), so only direct `scripts.run` callers are exposed — but `exec-api-call.js --args` is exactly such a caller and is what T1/T2 use. | Accept `v === true \|\| String(v).toLowerCase() === 'true'` via a tiny `n8nBool_`. | `n8n_closeTask(ACTOR, {taskId, dryRun:'true'})` leaves the task Open. |
| L5 | `RawLog.js:21` (eventId outside `try`, F12); `RawLog.js:86-91` (`stable()` turns a `Date` into `'{}'` while the POST body has an ISO string, F16); `EmployeeIdRegistry.js:20-29` (`sheet_()` creates the sheet from read paths, F11); `Setup.js:35-47` (canonical `Initial Requests` header list still stops at `'ADP Salary Access'`, F15) | All four pass-1 Lows are still open — verified line by line. | As in pass 1. | As in pass 1. |
| L6 | `EfxApi.js:177,183,191` (`efxListWorkflows`) | Invalid `since` → `NaN` → filter silently ignored (caller gets *everything*); `type` also matches as an id **prefix** (`'NEW'` works, undocumented); header-keyed `rec[h]` would overwrite `workflowId`/`type` if a `Dashboard_View` header were ever named so. | Return `E_VALIDATION` when `since` is unparsable; write the two fixed keys *after* the header loop. | `{since:'yesterday'}` → `E_VALIDATION`. |
| L7 | `N8n.js:181-185` (`n8n_submitForm` + `allowUnverified:true`) | Generic escape hatch reaches `it_confirmation` and `specialist` — the two `verified:false` forms `AGENTS.md` §2 says must not get an alias. Deliberate and documented in `ALIASES_ADDED…`, but note that `it_confirmation` lands on whichever of the two `submitITConfirmation` definitions loaded last (known defect #1/F20) and `specialist` writes misaligned rows (#10). | Keep, but have `n8nSubmit_` add `warning:'unverified form; see FormContracts.notes'` to the envelope via `extra`, and keep it out of `FOR_GEORGE.md` §2. | Envelope contains `warning` when `allowUnverified` was needed. |
| L8 | `EfxApi.js:25-32` (`efxRunAs`) + `FormContracts.js:240-243` (`CALLABLE` includes `getStepResultData`) | `getStepResultData(wf,'idsetup')` returns *all* ID Setup fields including both passwords, unredacted, through `efxRunAs`. Only reachable by calling `scripts.run` directly as `efx-bot` (the Router allows `^n8n_` only), so not an n8n exposure — but it is an Execution-API exposure. | Wrap `efxRunAs` results in `efxRedact_`, or remove `getStepResultData` from `CALLABLE` (no alias uses it). | `efxRunAs(actor,'getStepResultData',[wf,'idsetup'])` has no plaintext `DSS Password`. |
| L9 | `IDSetup.js:20-23` (`serveIDSetup` allocates on page view — the pass-1 F1 fix) | Correct fix, but it is a **write on a GET**: opening the ID Setup page for any pre-cutover workflow burns an id even if the request is later cancelled, and concurrent opens rely on `LockService` (see M5). Acceptable; belongs in the cut-over runbook and in the "what the ID Setup group will notice" note. | None (document). Optionally record `source:'serveIDSetup (pre-cutover)'` rows in the backfill report. | — |
| L10 | Tests | Weak/vacuous spots: `efx-test.js:277-282` FLAG scenario counts a *skip* as a pass; `:341` accepts `ok \| E_RATE_LIMITED \| E_UPSTREAM` (anything but a throw); `:331` "redacted" checks absence of the literal `"x"`; `:167-168` and `efx-e2e-test.js:1071-1074` assert the H2 merge as intended; no test covers H1; `n8n_getWorkflow`'s `employeeId` extra and `n8n_getEmployeeId` are never asserted; `hash_` fallback masks M3. | See §4 for the mock changes that unblock these. | — |

---

## 3. Behaviours that differ between the Node mock and real Apps Script — verify manually in TEST

The suites prove the *logic*; the following are places where `__tests__/gas-runtime.js` (or the e2e patches at
`efx-e2e-test.js:44-113`) behaves differently from the platform, so a green run says nothing about them.

| # | Mock behaviour | Real behaviour | What to verify in TEST (and how) |
|---|---|---|---|
| V1 | `Session.getActiveUser()` returns `dbinns@team-group.com` (an admin) unless a scenario swaps it. | Web app: the visitor (`executeAs: USER_DEPLOYING`, `access: DOMAIN`). Execution API: **`efx-bot@team-group.com`** (the DWD subject). `Actor.principal()` and every `isAdmin/isHR/isIT` gate use this. | `exec-api-call.js --fn n8n_ping` → `callerSession:'authenticated'`; after M1(b), `principal === 'efx-bot@…'` and `principalRoles.isHR/isIT` as decided in §4 of the setup plan. Then one denied call on purpose (`n8n_updateHireDate` before granting roles) → `E_FORBIDDEN`. |
| V2 | `AdminDirectory` is absent (efx-test: `ReferenceError` inside `try` → `false`) or stubbed to `isMember:false` (e2e). Group membership therefore **never** resolves; only exact group-address match or `CONFIG.ADMIN_EMAILS` grants roles. | `AdminDirectory.Members.hasMember` runs with the *executing* user's credentials → needs the Groups Reader role for `efx-bot` (`SETUP_PLAN_TOMORROW.md §4`) and the two `admin.directory.*` scopes in the SA's DWD list. `Not Authorized` is swallowed silently. | Run `n8n_submitHrVerification` for a real TEST workflow as `efx-bot` *after* the role/membership step; expect `ok:true`. If `Access denied.`: check `gam print admins user efx-bot@…` and the DWD scope list before touching code. |
| V3 | `LockService.waitLock()` always succeeds instantly. | Script-wide lock shared by web-app and Execution-API executions; `waitLock(10000)` can time out → **unlocked** allocation (M5). | 5 parallel `n8n_createInitialRequest` (distinct requesters — see H2) → 5 consecutive ids, 5 registry rows, `Note` empty. Repeat while a human submits a New Hire in the UI. |
| V4 | `PropertiesService.getScriptProperties()` returns a **fresh empty store on every call** (`gas-runtime.js:326-337`), and the real `Services/ConfigurationService.js` is not even loaded — a fixed `MAP` stands in (`:341-368`). So `SAFETY_TRAINING_AT_SUBMIT`, `EFX_EVENT_WEBHOOK_URL`, `EFX_EVENT_KID`, `EFX_EVENT_SECRET` are never read as set. | Properties persist; `CONFIG.SAFETY_TRAINING_AT_SUBMIT` getter reads them via `ConfigurationService.getSetting`. | `setSafetyTrainingAtSubmit(true)` → `n8n_createInitialRequest` → exactly one `safety_onboarding` task; then HR Verification (salary) → still one task, one "Safety Onboarding Required" email (dedupe). Set it back to `false`. |
| V5 | `UrlFetchApp` does not exist; `rawLogFanOut_` exits at `if (!url) return` (and would `ReferenceError` inside its `try` if a URL were set). HMAC (`efxSign_`) has **never executed** in Node (`computeDigest`/`computeHmacSha256Signature` absent). | Synchronous `UrlFetchApp.fetch` inside the human's `google.script.run` call (pass-1 F8), one per event (submit, result, each `task.created`). | Leave `EFX_EVENT_WEBHOOK_URL` **empty** for the first TEST day (poller only). When you do enable it: point at the n8n test receiver, submit one New Hire, verify the receiver's HMAC check passes against `spec/prototype/test/hmac-vector.js` semantics, and time the human submit before/after. |
| V6 | `Utilities.computeDigest` absent → `FormContracts.hash_` uses the `fnv1a` fallback (M3). | `sha256:` hashes. | `n8n_contracts()` live vs `docs/contracts.lock.json` — will differ until M3 is fixed; do not read that as drift. |
| V7 | Sheet cells keep JS types as written (`'30411'` stays a string; `'2026-10-01'` stays a string). | Sheets coerces: numeric strings → numbers, ISO/US dates → `Date` (then `getValues()` returns `Date` objects, `toISOString()` shifts by timezone). All EFX comparisons use `String()`, which is why the mock can't catch it — but `record` read-back and `n8n_listWorkflows` will return `"Hire Date":"2026-10-01T04:00:00.000Z"`-style values. | Compare one `include:['record']` result and one `n8n_listWorkflows` row against the sheet; document the ISO/timezone shape for George. Check the `Employee IDs` first column renders without a thousands separator (format the column as plain text/number `0`). |
| V8 | `Utilities.formatDate` ignores the timezone argument and lacks the single-letter `M` token (e2e patches it). | `generateWorkflowId` uses `America/New_York`; `rawLogEvent_` uses `UTC` for `EVT-…`. | Sanity-check one workflowId and one eventId timestamp against the sheet's `Timestamp` column. |
| V9 | `createTextFinder` exists only via the e2e prototype patch (`efx-e2e-test.js:60-94`); `efx-test.js` never runs `syncWorkflowState`'s TextFinder path or `n8n_getWorkflow`. | Real TextFinder matches the **displayed** cell text. | `n8n_getWorkflow(actor, wf)` and `n8n_listWorkflows` for a workflow created via alias — `Dashboard_View` row must exist and `status/step` must match `Workflows`. |
| V10 | Return values are plain JS objects. | Execution API rejects non-JSON-serialisable returns (`Date`, Apps Script objects) with a script error → Router `E_SCRIPT`. Pass 1 audited every alias; `efxJsonSafe` guards `n8n_getContext`/`n8n_listWorkflows` only. | Call every read alias once live (`n8n_getWorkflow` for each of the 4 workflow types, `n8n_listTasks`, `n8n_events`, `n8n_getEmployeeId`) and confirm `done:true` with a `result`. |
| V11 | `MailApp.sendEmail` captured; `DriveApp.getFolderById` returns a stub. | Mail sends **from `efx-bot`** (its own daily quota) — `ENVIRONMENT='TEST'` forces the redirect to `dbinns@` when `EMAIL_REDIRECT_ALL` is unset (`EmailUtils.js:557-564`), still set it explicitly. `DriveApp` needs `efx-bot` editor on the attachment folders (`SETUP_PLAN §4` lines 174-177) or `n8n_createTerminationRequest` with `attachmentBase64` throws. | First alias-created New Hire: all mails land in `dbinns@` only. One `n8n_createTerminationRequest` **with** a small attachment. |
| V12 | `SpreadsheetApp.openById` always succeeds. | Requires `efx-bot` **editor** on the TEST spreadsheet; otherwise every alias returns `E_INTERNAL` "You do not have permission". | Covered by `n8n_ping` (reads `CONFIG.SPREADSHEET_ID` only — it does **not** open the sheet). Use `n8n_listTasks(actor,{})` as the first real read. |
| V13 | `Logger.log` is captured in memory. | Goes to Cloud Logging of the **script's** GCP project (`efx-test`); n8n sees only the envelope. | Open Logs Explorer for the project once during T1 so the path is known before it is needed. |
| V14 | Human path: `efx-test.js` exercises `submitInitialRequest` as `dbinns` (admin). Pass-1 test #11 (non-admin ID Setup group member submits with the pre-filled id) is still not automated. | `Actor.canOverrideEmployeeId()` is `false` for non-admins; the page and submit now agree (F1 fixed) so a first-try submit must succeed. | Log in as a non-admin member of `grp.forms.idsetup` in TEST, open the ID Setup link from the alias-created email, submit without touching the id → success; edit the id → the "pre-assigned" message. |

---

## 4. Tests — what to change so the suites stop passing for the wrong reasons

1. **Mock runtime** (`gas-runtime.js`, test-only, no production impact): persistent `PropertiesService` store per
   runtime (not per call) and load the real `Services/ConfigurationService.js` so `CONFIG` flags read it (unblocks the
   FLAG scenario); `Utilities.computeDigest`/`computeHmacSha256Signature` via Node `crypto` returning signed bytes plus
   `DigestAlgorithm`/`Charset` (unblocks M3 and a real HMAC known-answer test); a capturing `UrlFetchApp.fetch`; a
   throwable `LockService` (`rt.captures.failNextLock()`); `AdminDirectory` stub with a configurable member map; move
   the e2e `createTextFinder` patch into the mock so `efx-test.js` also gets it.
2. **Add**: H1 record-redaction assertions; H2 distinct-employee assertions (and flip the two "same workflowId" ones);
   M2 draft-merge; M4 rehire-carry validation and `maxKnown_` exclusion; M5 lock-failure → `E_UPSTREAM`; L3 Cancelled
   by-workflow → `E_TASK_NOT_OPEN`; L4 string `dryRun`; `n8n_getEmployeeId` after create and after admin override;
   a check that every `E_*` literal in `N8n.js`/`EfxApi.js` is documented (M7).
3. **Tighten**: `efx-test.js:341` should assert `bump.ok` on first call and `E_RATE_LIMITED` on the immediate second;
   `:331` should assert the known password strings are absent *and* that `context.dssPassword === '[REDACTED]'`.
4. **Keep**: the `defect(...)` mechanism in the e2e suite is a good pattern — the three recorded defects are real prod
   bugs and correctly not fixed here.

---

## 5. Refactor / file-separation opportunities

### Safe now (no behaviour change, no UI change)

Apps Script concatenates files into one global scope; **function declarations are hoisted across files**, while
`var X = (function(){…})()` singletons (`Actor`, `EmployeeIdRegistry`, `FormContracts`) are evaluated in file order.
Every EFX use of those singletons is inside a function body, so file order does not matter today; keep it that way.

| Refactor | Why it is safe | Payoff |
|---|---|---|
| `n8nMapHandlerError_(res, fallbackCode)` in `N8n.js` used by `n8n_cancelWorkflow/bump/updateHireDate` **and** `n8nSubmit_` | Pure function over the existing regexes (`/[Pp]ermission/`, `/not found/i`, `/already sent/i`, + `/access denied/i`); same inputs → same codes. | Removes three copy-pasted ternaries; M1(a) becomes one line; a unit test can enumerate message→code. |
| `n8nParse_(v, fallback)` for the eleven `(typeof x === 'string') ? JSON.parse(x) : (x \|\| {})` sites in `N8n.js`/`EfxApi.js` | Identical semantics (keep the "string that fails to parse → `{id:String(actor)}`" special case in `n8nActor_`). | One place to harden against malformed JSON from n8n expressions (today a bad string throws → `E_INTERNAL`). |
| `efxParseDraft_(cell)` extracted from `efxTaskClose:119-127`, reused by `n8n_saveTaskDraft` | Same code, second caller. | Needed for M2 anyway. |
| Move `efxRedact_`/`EFX_SECRET_KEY_RE`, `efxJsonSafe`, `efxSign_` into `EfxUtil.js` | All pure, all called only at runtime from function bodies; `typeof efxRedact_ === 'function'` guards remain valid. | `RawLog.js` returns to "the Raw Log", `EfxApi.js` to "primitives"; the redaction helper stops looking like an afterthought of the log. Update the file map in both `AGENTS.md`. |
| Split `N8n.js` into `N8n.js` (public aliases + `N8N_ALIASES`) and `N8nEnvelope.js` (`n8nActor_/Ok_/Err_/Guard_/Options_/Submit_`) | Function declarations, order-independent. | Reviewers and George read only the alias file; envelope changes get their own diff. Marginal at 302 lines — do it only if the alias count keeps growing. |
| Export `N8N_ERROR_CODES` from `N8n.js` and generate the §6 / `N8N_CONTRACTS.md` tables from it | Additive constant. | Ends M7-style drift structurally. |
| Test fixtures: `__tests__/efx-fixtures.js` with `LOAD_ORDER`, the header arrays and `seedBase()` shared by `efx-test.js` and `efx-e2e-test.js` | Test-only. | The two suites currently duplicate ~70 lines of headers that must match `Setup.js`; one copy, one assertion that it equals `Setup.js`'s list (would have caught F15). |
| `efxReadRecord` and the header-keyed loop in `efxListWorkflows` → `efxRowToRecord_(headers, row)` | Same mapping, includes the `Date → ISO` rule once. | Single place to attach `efxRedact_` (H1) and `efxJsonSafe`. |

### Not worth it (or not safe) before PROD merge

| Idea | Why not |
|---|---|
| Splitting `EfxApi.js` by concern (tasks / events / list / registry) | 242 lines, `AGENTS.md` already says "rarely edit"; more files = more `.claspignore`/file-map upkeep for no reader benefit. |
| Converting the IIFE singletons to classes or ES modules | Apps Script V8 has no module system; `import/export` do not run. IIFE-with-`var` is the idiom and is what makes `typeof X !== 'undefined'` guards work. |
| Renaming `EfxApi.js` (header still says `EfxBridgeApi.js — PROTOTYPE / NON-PRODUCTION`) or `Actor.js`/`EmployeeIdRegistry.js` headers | Renaming files is harmless at runtime but breaks the file maps in two `AGENTS.md`, the wiki, the mapping docs and pass-1's line references. Fix the header comments (`EfxApi.js:2`, `Actor.js:2`, `EmployeeIdRegistry.js:2`, `FormContracts.js:2` all say PROTOTYPE / NON-PRODUCTION) instead. |
| Restructuring `createWorkflow` (guard loops into helpers) beyond the H2 parameter | It is prod-shared code; every extra line is a line to reconcile at PROD merge. Keep the diff to the one optional parameter. |
| Enforcing `FormContracts.types` (dates, YesNo, csv) in `validate()` | Behaviour change: payloads that work today would start failing; the handlers do not enforce them either. Do it as its own contract version with a deprecation window, not as a refactor. |
| Consolidating the duplicate `submitITConfirmation` or `Specialist.js`'s dead sheet map | Known prod defects (#1, #10, F20), explicitly out of scope in `AGENTS.md` §6; load-order-sensitive. |
| Making `rawLogFanOut_` asynchronous via a time-driven trigger draining unsent rows | Right long-term answer to F8, but it is new machinery (trigger, "sent" marker column, failure handling) — a feature, not a refactor; spec 12 already prefers the poller. |
| Reintroducing the "library" split (`EF` symbol) from the original `EfxBridgeApi.js` header | Superseded by spec 12 (Router calls the project directly); the library scoping caveats in `EmployeeIdRegistry.js:7-8` are now obsolete comments, not a design to restore. |

---

## 6. Pass-1 finding status at HEAD (verified by reading the code)

| Pass-1 | Status | Where |
|---|---|---|
| F1 pre-cutover page/submit mismatch | **fixed** | `IDSetup.js:20-23` allocates on page view (see L9) |
| F2 credentials leave the sheet | **partly fixed** — events, context, webhook redacted; `include:'record'` not | `RawLog.js:54-64,72`, `EfxApi.js:229`, `N8n.js:245`; gap = **H1** |
| F3 asserted identity used for authorization | **fixed** | `Actor.principal()` at all nine sites (`RequestActionsHandler.js:28,74,122`, `HRVerificationHandler.js:94`, `ITSetupHandler.js:207`, `PositionChangeHandler.js:376`, `TerminationHandler.js:235`, `IDSetup.js:184`, `DashboardActionsHandler.js:23`, `WorkflowManager.js:242`); tests swap `Session` to prove it |
| F4 lock timeout → unlocked; index delete | **open** → **M5** | `EmployeeIdRegistry.js:87,62-67` |
| F5 idempotency check before lock | **fixed** | `EmployeeIdRegistry.js:89-91` |
| F6 admin override not mirrored to registry | **fixed** | `EmployeeIdRegistry.setOverride`, `IDSetup.js:189` |
| F7 Cancelled closable / formType ignored | **fixed** (by-taskId); by-workflow variant is **L3** | `EfxApi.js:105-111`, `N8n.js:264-266` |
| F8 synchronous fan-out | **open by design** (URL empty for TEST) | `RawLog.js:67-81`; see V5 |
| F9 null cursor | **fixed**; `<=` on `afterTs` is correct given `nextAfterTs` | `EfxApi.js:233-239` |
| F10 backfill misses in-flight | **fixed via F1** | — |
| F11 sheet created in read path | **open** (L5) | `EmployeeIdRegistry.js:20-29` |
| F12 eventId outside try | **open** (L5) | `RawLog.js:21` |
| F13 guard drops stack | **open** → **L1** | `N8n.js:72-74` |
| F14 `'Open'` status | **open** → **L2** | `N8n.js:293-294` |
| F15 Setup header list | **open** (L5) | `Setup.js:35-47` |
| F16 `Date` in `stable()` | **open** (L5) | `RawLog.js:86-91` |
| F17 rehire-carry unvalidated | **open, upgraded** → **M4** | `EmployeeIdRegistry.js:81-84` |
| F18 Raw Log volume | **open**; compounded by **M6** | `RawLog.js:13` |
| F19/F20 | info, unchanged | — |

New since pass 1 and **good**: `n8nSubmit_` hands handlers a deep copy (`N8n.js:97-100`) so n8n retries with the same
item are not rejected as "unknown field"; `createWorkflow`'s id-collision loop (`WorkflowManager.js:106-117`) is correct
and format-preserving (residual TOCTOU between read and `appendRow` is unlocked, same as prod); `E_UNVERIFIED_FORM`
gate with explicit override; `n8n_closeJrTask` enforcing `formType` in both modes; `efxListWorkflows` paging is right
(`total <= offset || out.length >= limit`); `efxJsonSafe` on the two header-keyed readers; the E2E harness's
`defect()` discipline and the `MOCK_WORKAROUNDS` list are exactly the honesty this kind of suite needs.

Contract spot-check (enums vs HTML) — all match: `computerType`/`computerRequestType`/`phoneRequestType`/`googleDomain`
(`InitialRequest.html:349-352,406-416,497-498`), `employeeType`/`hireType→newHireOrRehire` (`:115-129`),
`reason`/`google_duration`/`empType` (`TerminationRequest.html:82-108,209-212`), `siteDocsJobCode`
(`EmployeeIDSetup.html:57-63`), `Email_Domain` incl. `''` (`ITSetup.html:74-78`), `currentClass`/`classOld`/`classNew`/
`changeType` (`PositionSiteChangeRequest.html:53-54,91-97,135-139`), approval payload keys
(`StatusChangeApproval.html:110-117`, `TerminationApproval.html:64-68`), HR payload keys (`HRVerification.html:201-215`).


## 7. Fixes applied (2026-09-16 night, after this review) — all suites green at the commit that follows this section
| Finding | Fix | Proven by |
|---|---|---|
| H1 | `efxReadRecord` returns `efxRedact_(rec)`; `include:['record']` also works for step forms (`data.workflowId`) | efx-test: `DSS Password → [REDACTED]`, username visible |
| H2 | `createWorkflow(type, name, initiator, dedupeKey)` — cache-keyed 30-s guard on (type, initiator, dedupeKey); `submitInitialRequest` passes `first last|hireDate`. Other handlers unchanged (row guard) | efx-test Create; e2e #4 (different hire → new workflow, same hire → deduped) |
| M1 | `n8nSubmit_`: `/access denied|permission denied|not authori[sz]ed|forbidden/i` → `E_FORBIDDEN` with `principal`; `n8n_ping` exposes `principal` | e2e #4 spoof-session test |
| M2 | `n8n_saveTaskDraft` merges into the existing `{items}` draft, keeps Notes when `notes` is omitted, `E_NOT_FOUND` for unknown task | e2e #10 |
| M3 | `gas-runtime.js` + `gen-contracts.js` implement `Utilities.computeDigest` (Node crypto) → lock regenerated with `sha256:` hashes | `n8n-check` OK; lock shows 11 × `sha256:` |
| M4 | `submitInitialRequest` rejects `existingInternalEmployeeId` not matching `^\d{4,6}$` **before** creating anything (carried rows still count toward the max — a legitimate high id should move the mark) | efx-test Create |
| M5 | `EmployeeIdRegistry.allocate` throws when the lock cannot be obtained (never allocates unlocked) | mock lock always succeeds — verify under load in TEST |
| M6 | `efxEventsSince` reads a bounded tail (`p.tail`, default 1500 rows) when a cursor is given; full read only if the cursor is not in the tail | e2e #8 unchanged; measure on TEST with a 5 000-row Raw Log |
| M7 | `FormContracts.js` header + `id_setup` notes describe principal-based authorization; FOR_GEORGE §6 lists the real codes; `N8N_CONTRACTS.md` regenerated | docs |
| Lows | ~~Not changed tonight~~ → **done later the same night, see §8** (L3 Cancelled → `E_TASK_NOT_OPEN`, L4 string `dryRun`, L8 `efxRunAs` redaction) | efx-test JR/SAFETY/OTHER FORMS scenarios; e2e #9 |

---

## 8. Refactor log (2026-09-16 night) — Lows + §5 "Safe now" refactors, all suites green after every step

Rules followed: no UI/HTML change, no contract change (`n8n-check` → `OK`, lock untouched, no alias renamed, `N8N_API_VERSION`
unchanged), no behaviour change except the three Lows. The gate (five suites + `gen-contracts && n8n-check` + `n8n-workflows-check`)
was run before and after **every** row below and was green each time.

| Step | What | Status | Notes / proof |
|---|---|---|---|
| L1 (= §2 L3) | `efxTaskClose`: by-`workflowId+formType` lookup records a **Closed** row as `closedRow` only; any other non-Open row → `E_TASK_NOT_OPEN` (was `E_ALREADY_CLOSED`, which George treats as success). An **Open** task whose **workflow** is `Cancelled` (`efxWorkflowStatus_`, same read as StateSync) → `E_TASK_NOT_OPEN`, checked before the dry-run return. | done | efx-test JR: Cancelled fleetio by wf → `E_TASK_NOT_OPEN`; Open jr_title on Cancelled workflow → `E_TASK_NOT_OPEN` by wf, by TK-, as dryRun; row stays Open |
| L2 (= §2 L4) | `n8nBool_(v)`: `true \| 'true' \| 'yes' \| '1'` → true, else false; used at every `dryRun`/`force`/`allowUnverified` site (`n8n_closeTask`, `n8n_assignSafetyTraining` ×3, `n8nOptions_`). | done | efx-test: `dryRun:'true'` leaves task Open, `dryRun:'false'` closes; `force:'false'` refused; `allowUnverified:'true'` passes; truth table |
| L3 (= §2 L8) | `efxRunAs` returns `efxRedact_(efxJsonSafe(out))` (JSON-safe first so a Date is not flattened to `{}` by the redactor). | done | e2e #9: `efxRunAs(actor,'getStepResultData',[wf,'id_setup'])` → both passwords `[REDACTED]`, username visible, no plaintext; `getWorkflow` dates ISO |
| R1 | `n8nMapHandlerError_(res, fallbackCode, { message, codes })` + `N8N_HANDLER_ERROR_RULES`; used by `n8nSubmit_`, `n8n_cancelWorkflow`, `n8n_bumpWorkflow`, `n8n_updateHireDate`. Forbidden regex is the union `/permission\|access denied\|not authori[sz]ed\|forbidden/i` (identical codes for every message the handlers emit — verified by grep); `not found`/`already sent` stay **opt-in** per alias (cancel / bump) so no code changes (e2e asserts `id_setup` on an unknown workflow is still `E_UPSTREAM`). Additive: `upstream` and (on E_FORBIDDEN) `principal` now on all four sites. | done | efx-test HELPERS: 15-row message→code table |
| R2 | `n8nParse_(v, fallback)` replaces the eleven `(typeof x === 'string') ? JSON.parse(x) : (x \|\| {})` sites in N8n.js. One deliberate convergence: an **empty-string** payload now yields the fallback (→ `E_VALIDATION`) at the five `data` sites where it previously threw a raw `SyntaxError` out of the alias; malformed JSON still throws (unchanged); `n8nActor_` keeps its special case; EfxApi.js's four sites left alone (layering). | done | efx-test HELPERS: string/object/undefined/null/""/malformed cases + alias-level checks |
| R3 | `efxParseDraft_(cell)` extracted from `efxTaskClose`; `n8n_saveTaskDraft` now merges into `efxParseDraft_(existing.draft)` — i.e. a legacy `{checkedItems}`/flat-map draft is **lifted** instead of dropped (same lift the close path already applied; the M2 "merge into the existing draft" intent). | done | efx-test HELPERS: 8 shape cases; OTHER FORMS: legacy `checkedItems` survives an n8n merge |
| R4 | `EfxUtil.js` (new): `EFX_SECRET_KEY_RE`, `efxRedact_`, `efxJsonSafe`, `efxSign_` moved verbatim out of RawLog.js/EfxApi.js; `typeof` guards unchanged; added to all five `LOAD_ORDER` arrays after `Config.js`; `.claspignore` unchanged. | done | all suites unchanged; RawLog.js = logging only (67 lines) |
| R5 | `N8nEnvelope.js` (new): `n8nActor_/n8nOk_/n8nErr_/n8nGuard_/n8nParse_/n8nBool_/n8nOptions_/N8N_HANDLER_ERROR_RULES/n8nMapHandlerError_/n8nSubmit_` moved verbatim (100 lines); N8n.js keeps only `n8n_*`, `N8N_ALIASES`, `N8N_API_VERSION`, `N8N_ERROR_CODES`. `gen-contracts.js` (vm-loads N8n.js) and `n8n-workflows-check.js` (regex `^function n8n_\w+` on N8n.js) still find everything — both run clean. | done | wf-lint: 27 aliases found, 0 problems |
| R6 | `N8N_ERROR_CODES[]` (`{code, meaning, n8n}`, 10 codes) in N8n.js; `gen-contracts.js` renders the "Error codes" table from it (throws if missing); `n8n/README.md` table rewritten with the **same rows** (generated from one array) + Router-side `E_TRANSPORT`/`E_SCRIPT`; efx-test fails on any undocumented `E_*` literal in N8n.js/N8nEnvelope.js/EfxApi.js (§4 item M7). Constant only — **not** added to the `n8n_contracts()` result (would be a behaviour change). | done | `docs/N8N_CONTRACTS.md` §Error codes now 10 rows (was 6) |
| R7 | `__tests__/efx-fixtures.js` (test-only): shared `LOAD_ORDER`, all header arrays, `seedBase(rt)` = union of the two suites' seeds (e2e's fuller Terminations/Position Changes headers; efx-test's Audit Log; e2e's Reference_Managers). Both suites' assertion counts unchanged, +4 fixture-vs-`SCHEMA` consistency checks. | done | efx 186 → 190; e2e 580 unchanged |
| R8 | `efxRowToRecord_(headers, row)` (Dates → ISO via `efxJsonSafe` once) used by `efxReadRecord` (then `efxRedact_`) and the header-keyed loop in `efxListWorkflows` (same key precedence as before — L6 deliberately not touched). | done | efx-test HELPERS: 6 mapping/redaction cases |
| §5 "Not worth it" table | — | not touched | as instructed |
| Not done (out of scope tonight) | §2 L1 (`n8nGuard_` stack logging), L2 (`'Open'` → `'Pending'` in forced Safety close), L5, L6 (`since` validation / key precedence), L7 (`warning` on `allowUnverified`), L9; §4 mock-runtime changes (persistent PropertiesService, HMAC known-answer, throwable LockService); `FOR_GEORGE.md` §6 still lists only six codes and calls `E_FORBIDDEN` "planned" — should be regenerated from `N8N_ERROR_CODES`; `BACKLOG_NEXT_WAVE.md` still lists the three Lows as open. | skipped | not requested; each is a behaviour change or a docs task for the owner |

**Suite numbers after the last step** (from `employee_management_v2_efx/__tests__`): `super-test.js` **159 / 0**, `form-field-map-test.js`
**312 / 0**, `efx-test.js` **190 / 0** (was 130), `migration-test.js` **42 / 0**, `efx-e2e-test.js` **580 passed / 3 recorded defects**
(was 574; defects #15/#16/#17 unchanged, 122 emails captured, 0 sent). `node tools/gen-contracts.js && node tools/n8n-check.js` →
`OK: contracts compatible with docs/contracts.lock.json` (lock unchanged). `node tools/n8n-workflows-check.js` → `OK: 25 workflow
file(s) lint clean (1 warning(s))` — the one warning (`90_EFX_E2E_Test.json` `systems: "SiteDocs"`) predates this work.

New files: `employee_management_v2_efx/EfxUtil.js`, `employee_management_v2_efx/N8nEnvelope.js`, `employee_management_v2_efx/__tests__/efx-fixtures.js`.
Renamed: none. Docs touched: both `AGENTS.md`, root `README.md`, `docs/wiki/FOR_DEVELOPERS.md`, `docs/review/FUNCTION_INVENTORY.md`,
`n8n/README.md` (error table), `docs/N8N_CONTRACTS.md` (regenerated), `docs/review/DIFF_prod_vs_efx.patch` (regenerated with
`diff -ruN --strip-trailing-cr`, so CRLF-only whole-file noise is gone), this file.

Observation (not changed): `efxRedact_` flattens a `Date` value to `{}` (it treats it as a plain object). Every existing caller
passes JSON-parsed or pre-serialised data, and `efxRunAs` now runs `efxJsonSafe` first, but `n8n_getContext` redacts **before**
`efxJsonSafe` — harmless today because `getWorkflowContext` formats its dates as strings; worth swapping the order if that changes.
