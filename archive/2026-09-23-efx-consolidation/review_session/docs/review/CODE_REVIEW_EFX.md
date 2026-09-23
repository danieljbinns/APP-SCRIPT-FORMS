# Code review — EFX fork (`employee_management_v2_efx`) vs prod

Reviewed 2026-09-16 (evening). Read-only review; nothing in the fork or prod was modified.

**Files were being edited by another agent while this review ran** (`FormContracts.js`, `N8n.js`, `EfxApi.js`,
`EmailUtils.js`, `Services/ActionItemService.js` changed between 21:09 and 21:35). Everything below refers to the
versions with these md5s — re-check any finding against a later edit:

```
Actor.js c7131157…  EmployeeIdRegistry.js 0e4d3182…  RawLog.js 16d173c8…  N8n.js 1612f06e…  EfxApi.js aab27982…
FormContracts.js bdcc8a02…  IDSetup.js 0c0e125e…  InitialRequestHandler.js 1df3536d…  EmailUtils.js cee33151…
Services/ActionItemService.js 546626cd…  MigrationTools.js 89766aff…  Setup.js 30382a38…  Config.js 518831d1…
SchemaConstants.js d523ec34…  Services/ConfigurationService.js b7d3e055…
```

The three Node suites were run and are green at these versions: `efx-test.js` 70/70, `super-test.js` 159/159,
`form-field-map-test.js` 312/312.

Note on the diff: `DIFF_prod_vs_efx.patch` shows whole-file hunks for `WorkflowManager.js`,
`Services/ActionItemService.js`, `BOSSReviewHandler.js`, `HRVerificationHandler.js`, `ITSetupHandler.js`,
`ITConfirmationHandler.js`, `PositionChangeHandler.js`, `TerminationHandler.js`, `EquipmentRequestHandler.js`,
`Specialist.js` because the fork normalised CRLF→LF (BOM kept). With `diff --strip-trailing-cr` the real changes in
those files are only the `Session.getActiveUser().getEmail()` → `Actor.email()` swaps plus two `rawLogEvent_` calls
in `ActionItemService`. `EquipmentRequestHandler.js` has **no** real change.

---

## 1. Verdict

**Ship to TEST: yes, with fixes.** Fix F1, F2 and F3 first (F1 and F2 are small; F3 needs a design decision).
F3 must be closed before anything reaches PROD. Everything else is Medium/Low and can be batched.

With every EFX flag off and no `EFX_EVENT_WEBHOOK_URL`, the human UI behaves as prod except for the four
intended differences (extra `Initial Requests` column, `Employee IDs` sheet, Raw Log columns/rows, non-admins
cannot change a pre-assigned id) **plus one unintended one (F1)** and two benign ones (§5).

---

## 2. Findings

| # | Sev | File:line | Issue | Fix |
|---|---|---|---|---|
| F1 | **High** | `IDSetup.js:22` vs `IDSetup.js:177-183` | **In-flight (pre-cutover) workflows cannot complete ID Setup on the first try.** Page view falls back to `generateEmployeeId()` = `max(ID Setup Results col D)+1`; submit falls back to `EmployeeIdRegistry.allocate()` = `max(registry ∪ ID Setup Results)+1`. As soon as one post-cutover request has been submitted, the registry max is ahead of ID Setup Results, so the page shows X, submit allocates Y≠X, and the ID Setup group (non-admins) gets `"Internal Employee ID is pre-assigned (Y) and cannot be changed here."` for an id they were never shown. The allocation is committed on the failed attempt, so a second submit with Y succeeds — recoverable but confusing, and it hits every NEW_EMP_ workflow that is between Initial Request and ID Setup on cut-over day. `efx-test.js` never seeds a registry ahead of ID Setup Results, so it cannot catch this. | Make page view and submit agree for registry-less workflows. Simplest: `IDSetup.js:22` → `EmployeeIdRegistry.get(workflowId) \|\| EmployeeIdRegistry.allocate(workflowId, {employeeName: requestData.employeeName, source:'serveIDSetup-precutover'})` (idempotent, one-time per legacy workflow, and the page then shows the committed id). If a write on page view is unacceptable, use `EmployeeIdRegistry.peek()` and, in submit, accept the submitted id when no registry row exists and the id is unused. Add the test in §7. |
| F2 | **High** | `RawLog.js:16,38,43` + `EfxApi.js:175-176` (`efxEventsSince`) + `RawLog.js:51-64` (`rawLogFanOut_`) | **Plaintext credentials leave the sheet.** `rawLog('submitEmployeeIDSetup', formData)` (`IDSetup.js:149`) and `rawLog('submitITSetup', formData)` (`ITSetupHandler.js:213`) log the whole payload — `dssPassword`, `siteDocsPassword`, `Email_Temp_Password`, `Phone_VM_Password`. Prod already stored these in the Raw Log sheet; the fork now (a) returns them to any Execution-API caller through `n8n_events` (`payload` is the parsed Raw JSON, no redaction) and (b) POSTs them to `EFX_EVENT_WEBHOOK_URL` when set. `rawLogResult` payloads (`InitialRequestHandler.js:73-79`, `IDSetup.js:199-203`) are clean — verified — but the `submit`-kind rows are not. | Add `efxRedact_(obj)` in `RawLog.js` that deep-copies and replaces values whose key matches `/pass(word)?|pwd|secret|token/i` with `'[redacted]'`; apply it in `rawLogFanOut_` (before `env.payload`) and in `efxEventsSince` (before pushing `payload`). Consider applying it at write time for `kind==='submit'` too — the recovery use case never needed the passwords (they are in the results sheets). Add a test that asserts `n8n_events` payload for `submitEmployeeIDSetup` has no `dssPassword`. |
| F3 | **High** | `Actor.js:21-24`, `Actor.js:36-40`; consumers `RequestActionsHandler.js:28,74,122`, `HRVerificationHandler.js:94`, `ITSetupHandler.js:207`, `PositionChangeHandler.js:376`, `TerminationHandler.js:235`, `IDSetup.js:182`, `DashboardActionsHandler.js:23` | **A caller-asserted identity is used for authorization.** `Actor.email()` returns whatever `actor.email` the n8n workflow sent (the Router's "Set defaults" node lets any n8n author pass `actor: {email:'dbinns@team-group.com'}`). Nine sites use it for permission checks (`isHR/isIT/isAdmin`, `canCancel`, `canBump`, `canEditDates`, `canOverrideEmployeeId`). Result: any n8n workflow (or anyone who can call `scripts.run` as `efx-bot`) can pass HR/IT/Admin gates and the admin id-override by typing an admin's email. `FormContracts.js:16-18` documents this as the intended mechanism ("An n8n actor.email must be in the matching grp.forms.* group or CONFIG.ADMIN_EMAILS"), which confirms it is by design rather than accidental — but it is still identity assertion without verification. The real principal (`Session.getActiveUser()` = the impersonated `efx-bot`) is available and non-spoofable. | Separate attribution from authorization: add `Actor.principal()` = `Session.getActiveUser().getEmail()` (never overridden) and use it in every authorization check listed in §3; keep `Actor.email()` for `Submitted By`/`closedBy`/audit columns. Grant `efx-bot@team-group.com` its automation permissions explicitly (add it to `GROUP_HR`/`GROUP_IT` via Script Properties or an `EFX_AUTOMATION_PRINCIPALS` allow-list checked in `AccessControlService`). Minimum for TEST if the design is kept: in `Actor.run`, refuse an `actor.email` that is in `CONFIG.ADMIN_EMAILS` unless `Session.getActiveUser()` is itself an admin, and log the pair `(principal, actor)` in the audit log. |
| F4 | Medium | `EmployeeIdRegistry.js:62-67` (`deleteMine_`), `:87` | `deleteMine_` deletes by row **index** computed from a prior read. If two losers run concurrently (possible whenever the lock is not held), the second one's index is stale after the first `deleteRow` and it deletes the wrong row — potentially the winner's. And on `waitLock` timeout the code sets `lock = null` and **proceeds unlocked** (`:87`), which is exactly the case where this matters. `maxKnown_`'s `parseInt(r[0],10)` handles non-numeric/blank cells correctly (NaN skipped) — fine. | (1) On lock failure `throw new Error('EmployeeIdRegistry: lock timeout')` — a failed submit is better than a corrupted registry. (2) Make `deleteMine_` verify the cell contents immediately before deleting: `var v = sh.getRange(i+2,1,1,2).getValues()[0]; if (String(v[0])===String(id) && String(v[1])===String(workflowId)) sh.deleteRow(i+2);`. (3) Alternatively never delete — overwrite the losing row's id cell with `'VOID'`; `maxKnown_` already ignores non-numeric. |
| F5 | Medium | `EmployeeIdRegistry.js:77-78` vs `:86-99` | The idempotency check (`get(workflowId)`) runs **before** the lock. Two allocations for the same `workflowId` (realistic: double-submit — `createWorkflow`'s 30-s guard returns the same workflowId to both) both see "no existing", both win the verify (different candidates), and the registry ends with two rows for one workflow. `get()` returns the first (lowest), `submitInitialRequest` on the second call writes and returns the other id, and one number is burned. | Re-check `get(workflowId)` after `waitLock`, and in the verify loop treat "a lower row has this workflowId" as "existing wins → `deleteMine_`, return existing". |
| F6 | Medium | `IDSetup.js:181-187` | Admin override writes the new id to `ID Setup Results` only. The registry keeps the old id, so `EmployeeIdRegistry.get/info`, `n8n_getEmployeeId`, `context.preassignedEmployeeId` and the ID Setup page (on a re-open) all disagree with `ID Setup Results` col D for that workflow. Also nothing prevents the override value colliding with another workflow's registry id. | On override, update the registry row in place (`Internal Employee ID` cell) and append `Note = 'admin override by <email>, was <old>'`; reject the override if the id exists for another workflow in either sheet. |
| F7 | Medium | `EfxApi.js:96-97,105` (`efxTaskClose` by `taskId`) | By-task lookup accepts any status that is not `'Closed'`. A `'Cancelled'` task (set by `cancelRequest`, `RequestActionsHandler.js:52`) is therefore closable: `closeActionItem` also only guards `'Closed'` (`ActionItemService.js:182`), so the cancelled task becomes Closed and `notifyTaskClosure` emails fire for a cancelled workflow. `jrCompleteViaSecret` required `Status === 'Open'` for both lookup modes — the fork is looser than what it replaces. Same file: when `p.taskId` **and** `p.formType` are both given the formType is ignored, so `n8n_closeJrTask(actor,'TK-…')` (`N8n.js:158-159`) can close a non-JR task under the JR label; `jrCompleteViaSecret` enforced `formType==='jr_title'`. | In the by-task branch return `{code:'E_NOT_OPEN', message:…}` unless `Status==='Open'` (keep `E_ALREADY_CLOSED` for `'Closed'`). If `p.formType` is supplied with `p.taskId`, verify it matches and return `E_VALIDATION` otherwise; have `n8n_closeJrTask` pass `formType:'jr_title'` in both modes. |
| F8 | Medium | `RawLog.js:60` + `ActionItemService.js` (new `rawLogEvent_('task.created'…)` / `('task.closed'…)`) | The webhook fan-out is a **synchronous** `UrlFetchApp.fetch` with no configurable timeout, executed inside the human's `google.script.run` call. A New Hire submit now performs 2 fetches (`submit`, `result`); IT Setup's `triggerSpecialists` adds one per action item created. A slow or hung n8n webhook adds up to the platform fetch limit **per event** to the human's wait. Only bites when `EFX_EVENT_WEBHOOK_URL` is set — it is empty by default and spec 12 recommends polling. | Leave the URL empty for TEST (document it), or fan out only `result`/`task.*` kinds, or move fan-out to a time-driven trigger that drains unsent Raw Log rows. |
| F9 | Medium | `EfxApi.js:176,179` (`efxEventsSince`) | `nextAfterEventId` is `events[last].eventId`, which is `null` for legacy 5-column Raw Log rows (no `Event ID`). If the last row of a page is legacy, the poller (`n8n/20_Forms_EventsPoller.json`) stores `null`, the next call has no cursor, `passed` is `true` from row 1 and the whole log replays. Also `afterTs` uses `<=` so events sharing a millisecond with the cursor are skipped. | Return the last **non-null** eventId (or skip rows with no `Event ID` when `afterEventId` is used), and return `nextAfterTs` alongside so the poller can always fall back. |
| F10 | Medium | `IDSetup.js:22` / prod cut-over | `migrateEfxBackfillEmployeeIds` only backfills workflows that already have an `ID Setup Results` row — i.e. ones past ID Setup. It does not pre-allocate for in-flight NEW_EMP_ workflows, so F1 applies to all of them. | Either F1's fix, or extend the backfill: for every `Workflows` row with type `NEW_EMP` and `Current Step === 'ID Setup Needed'` with no registry row, `allocate()` (dry-run first). |
| F11 | Low | `EmployeeIdRegistry.js:20-29` + `EmailUtils.js` (AUGMENT 2b) | `sheet_()` **creates** the `Employee IDs` sheet inside read paths (`get/info/peek`). `getWorkflowContext` now calls `EmployeeIdRegistry.get()` for every email context (including TERM_/CHANGE_), so the first email after deploy creates the sheet even if `migrateEfx` was never run. Harmless, but a write in a read path and a surprise for the migration runbook. | In `get/info/peek`, return null/empty when the sheet is missing; only `allocate` creates it. |
| F12 | Low | `RawLog.js:21` | `eventId` is built **outside** the `try`; `Utilities.formatDate`/`getUuid` are reliable, but the file's contract is "never throws, first line of every submit". | Move line 21 inside the `try` (compute eventId first thing). |
| F13 | Low | `N8n.js:54-56` (`n8nGuard_`) | Exceptions are converted to `E_INTERNAL` without `Logger.log`, so the stack is lost (Cloud Logging is the only place to debug TEST). | `Logger.log('[n8n] ' + (err && err.stack \|\| err))` before returning. |
| F14 | Low | `N8n.js:187-188` | Forced Safety close writes checklist `status:'Open'`. `ActionItemForm.html` vocabulary is `Pending \| Complete \| Collected \| Not Returned` (`:264,294-298`); `'Open'` renders with no active button. `closeActionItem` does not validate draft statuses, so nothing breaks, it just displays oddly. `efxTaskClose` also accepts any `checklist[*].status` string. | Use `'Pending'`; optionally validate `status` against the vocabulary in `efxTaskClose`. |
| F15 | Low | `Setup.js:35-47` | The canonical `Initial Requests` header list stops at `'ADP Salary Access'` (54 headers); `'BOSS Training User Only'` (col 55, pre-existing gap) and `'Internal Employee ID'` (col 56, new) are missing. `initSheet` only writes headers on an empty sheet, so a fresh TEST sheet created by `runSetup` would have 54 headers under 56-element rows until `ensureHeader`/`migrateEfx` run. | Append the two headers to the list. |
| F16 | Low | `RawLog.js:69-73` (`efxSign_.stable`) | Canonical stringify matches `hmac-vector.js` exactly (undefined→`null`, sorted keys, arrays, `hex` handles signed bytes) **except** `Date` values: `stable(date)` → `'{}'`, while `JSON.stringify(env)` in the POST body → ISO string, so n8n's verifier hashes different bytes. No current payload carries a Date (client payloads are JSON; result payloads are strings), so this is latent. | In `stable`, `if (v instanceof Date) return JSON.stringify(v.toISOString())`. |
| F17 | Low | `EmployeeIdRegistry.js:81-84` (`rehire-carry`) | `existingEmployeeId` is recorded verbatim, no numeric check, no lock, no collision check against another workflow. Only reachable from n8n (`InitialRequest.html` never posts `existingInternalEmployeeId`). | `if (!/^\d{5,}$/.test(id)) throw`; warn (Note column) if the id already belongs to a different workflow. |
| F18 | Low | `Services/ActionItemService.js` (new `rawLogEvent_` calls) | Every action item create/close now adds a Raw Log row. With `RAW_LOG_MAX_ROWS = 5000` the recovery `submit` rows are pruned sooner (an onboarding creates ~6-10 task events). | Raise `RAW_LOG_MAX_ROWS` or route `task.*` kinds to a separate `Event Log` sheet. |
| F19 | Info | `WorkflowManager.js:230` | The swapped `Actor.email()` is inside the commented-out body of `adminPurgeWorkflows` — dead code, no effect. | None. |
| F20 | Info | `FormContracts.js:206`, `it_confirmation` | `submitITConfirmation` is defined twice (`BOSSReviewHandler.js:181`, `ITConfirmationHandler.js:44`); in Apps Script the later-loaded file wins (file order in the project, not alphabetical by guarantee). Pre-existing; the contract is correctly `verified:false` and no alias exposes it. | Track in the Forms backlog (already in `KNOWN_DEFECTS_PROD.md`). |

---

## 3. `Actor.email()` swap — attribution vs authorization

Every site where prod's `Session.getActiveUser().getEmail()` became `Actor.email()` (28 code sites in the diff), plus
the two new files. "Authorization" = the value decides whether the call proceeds; "Attribution" = the value is
stored/logged only. Reachability: `n8n_*` aliases only reach the `submit*` handlers, `getRequestDetails` and
`closeActionItem`; `efxRunAs` additionally reaches the `CALLABLE` list (`FormContracts.js:238-243`), which includes
`cancelRequest`, `bumpRequest`, `updateHireDate`, `closeActionItemWithNotes`. The Router restricts `fn` to `^n8n_`
(`00_EFX_Router.json` "Set defaults"), so `efxRunAs` is only reachable by calling `scripts.run` directly.

| File:line | Function | Use | Class | Reachable with an Actor override via |
|---|---|---|---|---|
| `RequestActionsHandler.js:28` | `cancelRequest` | `AccessControlService.canCancel(userEmail, wf)` | **Authorization** (+ audit) | `efxRunAs` |
| `RequestActionsHandler.js:63` | `cancelRequest` (catch) | `writeAuditLog` | Attribution | `efxRunAs` |
| `RequestActionsHandler.js:74` | `updateHireDate` | `getUserRolePayload(userEmail).canEditDates` | **Authorization** | `efxRunAs` |
| `RequestActionsHandler.js:109` | `updateHireDate` (catch) | `writeAuditLog` | Attribution | `efxRunAs` |
| `RequestActionsHandler.js:122` | `bumpRequest` | `AccessControlService.canBump(userEmail, wf)` | **Authorization** | `efxRunAs` |
| `DashboardActionsHandler.js:23` | `adminDeleteWorkflows` | `AccessControlService.isAdmin(userEmail)` | **Authorization** | not in CALLABLE / no alias → currently inert for automation; would become live if ever exposed |
| `WorkflowManager.js:230` | `adminPurgeWorkflows` | inside `/* disabled */` block | Dead code | — |
| `HRVerificationHandler.js:94` | `submitHRVerification` | `callerRole.isHR \|\| isAdmin` | **Authorization** | `n8n_submitHrVerification`, `efxRunAs` |
| `HRVerificationHandler.js:189` | `submitHRVerification` | `actingUser` → `updateWorkflow(... 'Updated By')` | Attribution | same |
| `ITSetupHandler.js:207` | `submitITSetup` | `callerRole.isIT \|\| isAdmin` | **Authorization** | `efxRunAs` |
| `ITSetupHandler.js:295` | `submitITSetup` | `IT Results[Submitted By]` | Attribution | `efxRunAs` |
| `ITSetupHandler.js:299` | `submitITSetup` | `actingUser` → Updated By | Attribution | `efxRunAs` |
| `BOSSReviewHandler.js:295` | `submitITConfirmation` (dup) | `IT Confirmation Results[Submitted By]` | Attribution | `efxRunAs` |
| `ITConfirmationHandler.js:158` | `submitITConfirmation` | `IT Confirmation Results[Submitted By]` | Attribution | `efxRunAs` |
| `PositionChangeHandler.js:19` | `submitPositionChangeRequest` | `createWorkflow(..., reqEmail \|\| Actor.email())` → `Workflows[Initiator Email]` | Attribution, **but** Initiator Email is later an input to `canCancel/canBump` ownership | `efxRunAs` |
| `PositionChangeHandler.js:376` | `submitPositionChangeApproval` | `callerRole.isHR \|\| isAdmin` | **Authorization** | `efxRunAs` |
| `PositionChangeHandler.js:403` | `submitPositionChangeApproval` | approvals `Submitted By` | Attribution | `efxRunAs` |
| `TerminationHandler.js:35` | `submitTerminationRequest` | initiator fallback (same caveat as PCH:19) | Attribution | `efxRunAs` |
| `TerminationHandler.js:235` | `submitTerminationApproval` | `callerRole.isHR \|\| isAdmin` | **Authorization** | `efxRunAs` |
| `TerminationHandler.js:259` | `submitTerminationApproval` | approvals `Submitted By` | Attribution | `efxRunAs` |
| `IDSetup.js:182` (`Actor.canOverrideEmployeeId`, `Actor.js:36-40`) | `submitEmployeeIDSetup` | admin id override gate | **Authorization** | `n8n_submitIdSetup`, `efxRunAs` — **`efx-test.js:164` demonstrates the escalation** (`ADMIN = {email:'dbinns@team-group.com'}` asserted by the test actor is accepted) |
| `IDSetup.js:185` | `submitEmployeeIDSetup` | Logger | Attribution | same |
| `IDSetup.js:194` | `submitEmployeeIDSetup` | `ID Setup Results[Submitted By]` | Attribution | same |
| `IDSetup.js:205` | `submitEmployeeIDSetup` | `actingUser` → Updated By | Attribution | same |
| `Specialist.js:99,108,113` | `submitSpecialistForm` | results `Submitted By` | Attribution | `efxRunAs` |
| `Services/ActionItemService.js:977` | `closeActionItemWithNotes` | `closedBy` | Attribution (the JSDoc above it, "client cannot supply or spoof the closer identity", is now false for `efxRunAs` callers — update it) | `efxRunAs`; `efxTaskClose` passes `by` explicitly |
| `RawLog.js:34` | `rawLogEvent_` | `Raw Log[User]` | Attribution | all |
| `EmployeeIdRegistry.js:58` | `record_` | `Employee IDs[Allocated By]` | Attribution | all |

Not swapped (still `Session`) and therefore non-spoofable — correct as is: `completeMyTask` (`ActionItemService.js:1008`),
`getStepResultData` (`RequestDetailsHandler.js:~250`), `getRequestDetails` `isAdmin/rolePayload` (`:213-215`),
`AccessControlService` internals, `efxInfo().callerSession`.

Nine authorization sites (bold) are the substance of F3.

---

## 4. Execution API surface

Checked that every `n8n_*` return is JSON-serialisable (no `Date`, no Apps Script objects):

| Function | Result | Notes |
|---|---|---|
| `n8n_ping` / `n8n_info` | OK | strings + `N8N_ALIASES` array of plain objects |
| `n8n_contracts` | OK | `FormContracts.get()` copies plain fields; `hash` string |
| `n8n_createInitialRequest` | OK | handler response is strings; `record` via `efxReadRecord` converts `Date` → ISO (`EfxApi.js:44`) |
| `n8n_submitIdSetup` / `n8n_submitHrVerification` | OK | `{success,message}`; `record` as above |
| `n8n_getWorkflow` | OK | `getRequestDetails` formats every Date (`RequestDetailsHandler.js:62-63,105,178,181,209`; TERM_/CHANGE_/EQUIP_ branches at `:462,490,539-540,590,674,723,759,768,803,857`). `employeeId` from `EmployeeIdRegistry.info` converts `allocatedAt` (`EmployeeIdRegistry.js:116`). `rolePayload`/`isAdmin` are plain. |
| `n8n_getEmployeeId` | OK | as above |
| `n8n_listTasks` | OK | `createdDate`/`completedDate` → ISO (`EfxApi.js:71-72`); `draft` parsed JSON |
| `n8n_closeTask` / `n8n_closeJrTask` / `n8n_assignSafetyTraining` | OK | `{taskId, workflowId, success, message?}`; dry-run `draft` is plain |
| `n8n_events` | OK | `ts` → ISO (`EfxApi.js:170,176`); `payload` is parsed JSON; `workflowId` may come back as a Number if Sheets coerced a numeric cell — harmless |

Arguments: every alias tolerates JSON string **or** object for `data/filter/params/details/actor` (`N8n.js:40,116,122,130,135,140,148,176`);
the Router sends `parameters: [actor(object), ...args]` — compatible. `include` may arrive as a string
(`'record'.indexOf('record')` works) — fine.

Runtime features: `globalThis` (`EfxApi.js:29`, `N8n.js:66`) is available in V8; `Utilities.getUuid()`,
`Utilities.computeDigest`, `Utilities.computeHmacSha256Signature(value:string, key:string, charset)` all exist with the
signatures used. `Array.prototype.find`, `startsWith`, template literals were already in prod. No ES2020+ syntax
(`?.`, `??`) in the GAS sources — the mock runtime would also have caught that.

HMAC: `efxSign_` (`RawLog.js:67-78`) reproduces `spec/prototype/test/hmac-vector.js` (`stableStringify`, `canonical`
joined with `\n`, `sha256hex(stable(payload))`, HMAC over UTF-8) exactly, including the signed-byte fix in `hex`.
Only divergence is the `Date` case (F16). `EFX_EVENT_SECRET` is read at `RawLog.js:57` and written at `Setup.js:447`;
nothing logs it (`setEfxEventWebhook` returns `secretLen` only; `efxSelfTest` logs `n8n_ping` output which has no
secret). `EFX_EVENT_SECRET` is deliberately **not** in `ConfigurationService.DEFAULTS` (so `getAllSettings()` never
returns it) — good.

---

## 5. Behaviour preservation (all EFX flags off, no webhook URL)

Verified unchanged: every submit handler's sheet writes and emails (the swaps are value-identical for a human
session because `override_` is null → `Actor.email()` returns `Session.getActiveUser().getEmail()`, `Actor.js:22-23`);
`rawLog()` still appends and prunes, just with 7 columns; `EquipmentRequestHandler` untouched (its 56th element is
`''` because equipment never sets `internalEmployeeId`); `getWorkflowContext` adds only `preassignedEmployeeId`, and
`efx-test.js:120,177` prove `context.internalEmployeeId` stays undefined so `hasId` (`EmailTemplates.js:114`) and the
ID Setup / initial emails are unchanged; `HRVerification.html:34` still reads `requestData.internalEmployeeId ||
'PENDING'` from ID Setup Results.

Intended differences confirmed: (a) `Initial Requests` col 56; (b) `Employee IDs` sheet; (c) Raw Log `Event ID`/`Kind`
+ `result`/`task.created`/`task.closed` rows; (d) `IDSetup.js:181-184` refuses a changed id for non-admins.

Unintended / to be aware of:

1. **F1** — pre-cutover ID Setup page/submit mismatch (High, above).
2. `generateEmployeeId()` now throws instead of returning `'30'+epoch` (`IDSetup.js:135-139`). Intended per spec 05,
   but note `serveIDSetup` (`:22`) calls it un-guarded for pre-cutover workflows, so a Sheets error now renders the
   Apps Script error page instead of a form with a bogus id. Acceptable; mention in the runbook.
3. `submitInitialRequest` has a new failure mode: `EmployeeIdRegistry.allocate` throwing (lock timeout, 5 failed
   retries, sheet error) after `createWorkflow` has written the `Workflows` row → `success:false` with an orphan
   Workflows row. `createWorkflow`'s 30-s idempotency guard makes an immediate retry reuse the same workflowId, which
   mitigates it. Same class as prod's `addSheetRow` failure path.
4. `SAFETY_TRAINING_AT_SUBMIT` on: `sendSafetyOnboardingEmail(workflowId, {employeeName, position, siteName,
   hireDate}, {})` (`InitialRequestHandler.js:85-87`) — the function reads exactly those four keys plus
   `setupData.siteDocsJobCode`, which is empty → falls back to the ID Setup Results lookup → no row yet → `''` →
   fine. `getWorkflowContext` is called after the Initial Requests row is written — fine. The salary path's second
   call (`HRVerificationHandler.js:330`) and the hourly path's call (`IDSetup.js:327`, which already had the M-14
   guard) are now both blocked by the new dedupe at the top of `sendSafetyOnboardingEmail` (`EmailUtils.js`, matches
   `formType==='safety_onboarding' || Category==='Safety'`, open or closed). Correct. The dedupe also silently
   swallows its own read errors and continues — acceptable.
5. `getRequestDetails` / `getStepResultData` build header-keyed maps, so `requestData['Internal Employee ID']` now
   appears in `RequestDetails.html` data as soon as the request is submitted (visible earlier than the ID Setup step
   in the drill-down). Benign; call it out to the ID Setup group so nobody thinks ID Setup already ran.
6. `Employee IDs` sheet gets created by the first email context build after deploy (F11), not by `migrateEfx`.
7. Line endings: the fork is LF where prod is CRLF (BOM retained). No runtime effect; `clasp push` is fine. Use
   `diff --strip-trailing-cr` for future prod↔fork comparisons.

---

## 6. Sheet / schema

- `formatInitialRequestData` returns 56 elements. Consumers: `addSheetRow` → `appendRow` (no width assumption);
  `submitITConfirmation` (both definitions) and `submitHRVerification` write **per cell** with `setValue`
  (`ITConfirmationHandler.js:66-103`, `BOSSReviewHandler.js:200-240`, `HRVerificationHandler.js` cols 6,10,12,14,15,
  17,18,46,50) — col 56 is never overwritten or truncated. `updateHireDate`, `syncStatusToRequestSheet` are single-cell.
  No `getRange(...,55)` / `.length === 55` / `new Array(55)` anywhere; the `54` literals in `MigrationTools.js:182-187,
  522-557` are legacy one-off migrations (not run) and `RequestDetailsHandler.js:575,613` are stale comments.
- `SCHEMA.INITIAL_REQUESTS.INTERNAL_EMP_ID = 55` and `SCHEMA.EMPLOYEE_IDS` match `EmployeeIdRegistry.HEADERS` order.
- `migrateEfx` (`MigrationTools.js:905-947`): idempotent, dry-run default, header-position check warns when
  `getLastColumn()+1 !== 56` and when the header exists at another index — correct and conservative (never moves
  data). Raw Log header upgrade writes cols 6-7 only when `'Event ID'` is absent; `RawLog.js:29-31` does the same
  on first write, so either order works. Backfill (`:951-970`) skips blank/non-numeric ids and duplicate workflows —
  correct; see F10 for what it does not cover.
- `Setup.js:35-47` header list is stale (F15).

---

## 7. Tests — gaps and proposed assertions

What the suites do **not** cover (the mock `LockService` is a no-op and `PropertiesService` is fresh per call, so
concurrency and flag behaviour are not exercised):

1. **Pre-cutover ID Setup (F1).** Seed `ID Setup Results` max 30410, `n8n_createInitialRequest` once (registry
   30411), then for a legacy workflow `NEW_EMP_OLD2` with no registry row: assert `serveIDSetup`'s
   `generatedEmployeeId` equals what `submitEmployeeIDSetup({internalEmployeeId: <that value>})` accepts on the
   **first** call. Today this fails (page 30411, submit 30412).
2. **Allocator contention.** Wrap `SheetMock.appendRow` for `Employee IDs` to inject a competing row
   `[candidate, 'NEW_EMP_OTHER', …]` before the caller's row on the first attempt; assert the caller retries, ends
   with a distinct id, and the competitor's row is untouched (F4). Run 20 allocations and assert 20 distinct ids and
   `maxKnown_` continuity.
3. **Double allocation for one workflow (F5).** Call `allocate(wf)` twice with `get()` stubbed to return null the
   second time; assert one registry row.
4. **Credential redaction (F2).** After `n8n_submitIdSetup`, assert every `n8n_events` payload and every
   `rawLogFanOut_` envelope (capture `UrlFetchApp.fetch` in the mock) contains no `dssPassword`/`siteDocsPassword`;
   after `submitITSetup`, none contain `Email_Temp_Password`/`Phone_VM_Password`.
5. **Authorization vs asserted actor (F3).** `efxRunAs({email:'dbinns@team-group.com'}, 'updateHireDate', …)` with
   `Session` = `efx-bot` must be denied; `n8n_submitIdSetup(ADMIN, {internalEmployeeId:'99999'…})` should be denied
   unless the principal is an admin (this inverts the current `efx-test.js:164-166` expectation — decide the policy
   first).
6. **Cancelled task (F7).** Seed a task with `Status:'Cancelled'`; `n8n_closeTask({taskId})` must return an error,
   and `n8n_closeJrTask(actor, 'TK-<wis task>')` must return `E_VALIDATION`/`E_NOT_FOUND`, not close it.
7. **Events cursor (F9).** Seed a 5-column legacy row after a 7-column row; call `n8n_events` with `limit:1` twice
   and assert `nextAfterEventId` is never `null`; assert `pruned:true` when `afterEventId` is unknown.
8. **HMAC known-answer.** Load `RawLog.js` with a `Utilities` shim (`computeDigest`/`computeHmacSha256Signature`
   via Node `crypto`, returning signed bytes) and assert `efxSign_('test-secret-do-not-use', env)` equals the `sig`
   printed by `node spec/prototype/test/hmac-vector.js`.
9. **Admin override registry sync (F6).** After an admin override, `EmployeeIdRegistry.get(wf)` must equal
   `ID Setup Results` col D for that workflow.
10. **Flag path.** Make the mock `ConfigurationService.getSetting` consult `PropertiesService` so the skipped
    `FLAG — SAFETY_TRAINING_AT_SUBMIT` scenario runs; add: submit (flag on) → `submitHRVerification` (salary) → exactly
    one `safety_onboarding` task and one "Safety Onboarding Required" email.
11. **Human ID Setup post-cutover.** `submitInitialRequest` then `submitEmployeeIDSetup` with the page's pre-filled
    id and `Session` = a non-admin → success (only the n8n path is tested today).
12. **`migrateEfx`.** Run `migrateEfx(true)`/`(false)` on a 55-header mock sheet and on a 56-header sheet; assert the
    header lands at col 56 and the second run is a no-op.

---

## 8. What looks good

- **Actor.run** (`Actor.js:15-19`) restores the previous override in `finally`, supports nesting, and a module-level
  variable is safe in Apps Script's single-threaded execution model. `email()` falls back to `Session` and swallows
  the no-session error. `canOverrideEmployeeId` is null-safe on `CONFIG.ADMIN_EMAILS`.
- **Append-then-verify** allocation is the right primitive for a Sheets-backed counter; `maxKnown_` reads both sheets
  for continuity and correctly ignores non-numeric cells; `FLOOR` handling and `String(id)` normalisation are
  consistent across `get/allocate/info`. Idempotency per workflowId works in the sequential case (`efx-test.js:121`).
- **`rawLogResult` payloads** at both call sites are credential-free by construction, and the ID Setup one records
  only `dssUsername`/`bossWisCreated` presence.
- **`efxTaskClose`** now writes the `{items:{…}}` draft shape the UI reads, migrates the legacy flat and
  `checkedItems` shapes, skips `__`-prefixed items (`__CAL__`), merges into the existing draft, and reuses
  `ActionItemService.closeActionItem` so completion checks and emails fire identically. `E_ALREADY_CLOSED` is
  distinguished from `E_NOT_FOUND` for by-workflow lookups, and dry-run returns the would-be draft without writing.
- **`FormContracts.validate`** rejects unknown keys and empty required values; `new_hire` and `id_setup` match the
  client payload keys in `InitialRequest.html:1155-1206` and `EmployeeIDSetup.html:161-174` exactly (checked key by
  key), `it_setup` handles the dynamic `BOSS_Cmte_*`/`BOSS_CostSheet_*` keys, and `hash_` has a working fallback for
  the mock runtime. `CALLABLE` is a closed allow-list.
- **Alias layer** is thin and uniform: JSON-or-object tolerance, stable envelope, `requestId`, `E_UPSTREAM` carrying
  the handler's own message, `n8n_assignSafetyTraining` refusing to close with a `No` unless `force:true` and
  recording the force in notes.
- **`efxReadRecord`** scans newest-first so re-submitted step sheets return the latest row; all sheet `Date`s are
  ISO-formatted before crossing the Execution API.
- **`migrateEfx`** is dry-run-first, header-position-checked and never moves data; the Raw Log in-place header upgrade
  is safe for existing 5-column sheets.
- **Safety dedupe** in `sendSafetyOnboardingEmail` closes the duplicate-task hole for the flag-on path without
  changing flag-off behaviour.
- **Flags and secrets**: all defaults preserve legacy behaviour; secrets live only in Script Properties, set via
  `Setup.js` setters that echo lengths, not values.
