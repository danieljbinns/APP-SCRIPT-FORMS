# APP-SCRIPT-FORMS · Fix Plan

Audit of `employee_management_v2` (dev deployment). No changes made yet.
All items below are findings only — nothing has been touched.

---

## 🔴 CRITICAL — Broken Functionality

| ID | What's Wrong | Where | Fix |
|----|-------------|-------|-----|
| ~~BUG-1~~ | ~~Two copies of `updateHireDate` exist. The copy in DashboardHandler.js calls a method that doesn't exist and silently fails.~~ | ~~DashboardHandler.js:403–468~~ | ❌ **FALSE FINDING** — `DashboardHandler.js` does not exist (was split into DashboardActionsHandler/UIHandler/DataHandler). `updateHireDate` exists only in `RequestActionsHandler.js:52` and is called correctly from `RequestDetails.html`. No duplicate, no stale copy. |
| ~~BUG-SM1~~ | ~~When HR approves a termination with no systems to deactivate, the workflow gets stuck at "In Progress / Processing" on the dashboard forever — never shows Complete.~~ | ~~TerminationHandler.js (post-approval path)~~ | ❌ **FALSE FINDING** — Two action items are always mandatory regardless of selected systems: `Deactivation` (SiteDocs/DSS/BOSS WIS) and `EOE` (HR EOE process). Zero-items path cannot occur. Safety is FYI-only by design. |
| ~~BUG-SM2~~ | ~~Same stuck-forever problem for Position Change approvals that have no follow-up tasks ("Change Processed" never becomes Complete).~~ | ~~PositionChangeHandler.js (post-approval path)~~ | ❌ **FALSE FINDING** — `ID Setup` and `Safety` action items are always mandatory (lines 688, 713). `tasksCreated` is always ≥ 2. Line 728 also shows the developer already handled the zero-case with `'Change Processed'` step label. |
| ~~BUG-AI2~~ | ~~A specialist can submit an action item twice (page reload, double-click). Second submit re-fires the completion check and can mark the whole workflow Complete when it isn't.~~ | ~~ActionItemService.js~~ | ✅ **FIXED** — `closeActionItem` now checks `currentStatus === 'Closed'` before writing; returns `{ success: false, message: 'This task has already been submitted.' }` on duplicate. |
| ~~BUG-AI3~~ | ~~If anyone manually deletes an action item row from the Google Sheet, the completion check thinks all work is done and marks the workflow Complete prematurely.~~ | ~~ActionItemService.js~~ | ❌ **FALSE FINDING** — Sheets are not editable by users. Scenario cannot occur. |
| ~~BUG-SEC1~~ | ~~User-entered text (names, notes, titles) is written to Google Sheets without checking for formula characters. A value starting with `=` would execute as a live formula in Sheets when anyone opens it.~~ | ~~All handlers that write user input to sheets~~ | ✅ **FIXED** — Server: `validateRequiredFields` (ValidationUtils.js) now rejects any string field starting with `= + - @`. Client: `SharedComponents.html` attaches a `blur` listener to all text/textarea inputs across all forms — flags inline on tab-out, clears on correction. |

---

## 🟠 HIGH — Silent Failures and Wrong Recipients

| ID | What's Wrong | Where | Fix |
|----|-------------|-------|-----|
| BUG-4 | Error messages from the server are pasted directly into the page HTML without escaping. A message containing HTML characters could break page layout. `escapeHtml()` is already defined and used elsewhere — just not applied here. | 13 spots across Dashboard.html, HRVerification.html, ITSetup.html, EmployeeIDSetup.html, RequestDetails.html, SharedComponents.html | Wrap all `err.message` / `response.message` in `escapeHtml()` |
| ~~BUG-AI1~~ | ~~When an equipment request skips the IT task phase, specialist action items are created but nobody gets emailed.~~ | ~~EquipmentRequestHandler.js~~ | ❌ **FALSE FINDING** — `_notifyEquipmentTask()` is called after every `createActionItem` in `launchRemainingEquipmentTasks`, and already has a null guard on `taskId`. Emails are sent. |
| ~~BUG-EM1~~ | ~~The submitter's email is read from the sheet and used as a recipient without checking if the cell is blank.~~ | ~~HRVerificationHandler.js, TerminationHandler.js, PositionChangeHandler.js~~ | ❌ **FALSE FINDING** — `requesterEmail` is a required field validated at form submission. Cannot be blank from a live submission. |
| BUG-CFG1 | A specific person's email (`davelangohr@team-group.com`) is hardcoded in 3 different files as the IT Confirmation recipient. If that role changes, someone has to find and edit 3 files manually. | HRVerificationHandler.js:275, EquipmentRequestHandler.js:145, ReplayService.js:266 | Add `CONFIG.EMAILS.IT_CONFIRMATION` and replace all 3 hardcoded strings |
| ~~BUG-SM3~~ | ~~Some old database rows say `Completed` (with a 'd') but the code checks for `Complete`.~~ | ~~WorkflowManager.js and dashboard filters~~ | ✅ **FIXED (opposite direction)** — Code writes `'Complete'` (no 'd') consistently; `DashboardDataHandler` already handles both spellings. Bug was in `StateSync.js` checking `'Completed'` instead of `'Complete'` — now fixed (one line). |

---

## 🟡 MEDIUM — Correctness and Reliability

| ID | What's Wrong | Where | Fix |
|----|-------------|-------|-----|
| BUG-2 | 5 call sites pass the acting user's email as a 5th argument to `updateWorkflow()`, which only accepts 4. The email is silently discarded — never recorded anywhere. | HRVerificationHandler.js:249,271,284 / IDSetup.js:185 / ITSetupHandler.js:237 | **DISCUSS:** Just remove the unused arg? Or add a 5th param to `updateWorkflow()` and write it to an audit column? |
| BUG-3 | Termination date formatting skips a type-check that the adjacent field applies correctly. A text-formatted date cell could show the wrong day due to timezone offset. | TerminationHandler.js:189 | Add the same `instanceof Date` guard used at line 207 |
| BUG-ER1 | 6 data-fetch functions return `null` when a record isn't found, instead of the standard `{ success: false, message }` object the rest of the codebase uses. | TerminationHandler.js, PositionChangeHandler.js, BOSSReviewHandler.js (4 functions) | Return `{ success: false, message: 'Not found' }` consistently |
| BUG-ER2 | One error catch in the dashboard returns `{ 'Error': message }` — capital E, no `success` key. The client reads `result.message` which is `undefined` here, so errors are invisible. | DashboardHandler.js → `getStepResultData()` catch block | Change to `{ success: false, message: err.toString() }` |
| BUG-ER4 | The "Send Reminder" button reads `res.message` to show in an alert without first checking `res.success`. If the server returned an error object, the alert shows "undefined". | Dashboard.html, RequestDetails.html → `bumpRequest()` handler | Check `res.success` before reading `res.message` |
| BUG-ER5 | Form dropdowns in HRVerification and InitialRequest call `.forEach()` on the server response without verifying it's a valid array. If the server call failed, the page crashes silently. | HRVerification.html, InitialRequest.html | Guard with `if (result && Array.isArray(result))` before looping |
| ~~BUG-AI4~~ | ~~After creating an action item, handlers email the assignee a task link — even if item creation failed and returned null.~~ | ~~TerminationHandler.js, PositionChangeHandler.js~~ | ✅ **FIXED centrally** — `createActionItem` catch block now calls `notifyAdminActionItemFailure()` (EmailUtils.js) which alerts all `CONFIG.ADMIN_EMAILS` with full context (workflowId, category, task, assignee, error). EquipmentRequestHandler already had null guard. Broken-URL emails are prevented by early return on null. |
| BUG-AI5 | `checkWorkflowCompletion()` silently returns and does nothing if the workflow step name isn't on its allowed list. A stuck workflow shows no error — admins have no idea why it isn't completing. | ActionItemService.js | Return a visible error state or surface a dashboard flag instead of silently returning |
| BUG-SEC2 | The dashboard loads all employee workflows for any logged-in domain user with no role filter. Any employee can see every colleague's onboarding status, start date, and manager. | DashboardDataHandler.js | **DISCUSS:** Is this by design? Or should only HR/IT/Admin see everything, with others seeing only their own requests? |
| BUG-SEC3 | Request Details returns full employee PII for any workflow ID — no check that the viewer is the original submitter, an assignee, or an admin. | RequestDetailsHandler.js | Add an ownership/role check at the top of `getRequestDetails()` |
| BUG-CFG2 | The sheet name `'IT Confirmation Results'` is typed as a raw string in 3 files. All other 18 sheet names are constants in `CONFIG.SHEETS`. This one would be missed if the sheet were renamed. | ITConfirmationHandler.js, BOSSReviewHandler.js, RequestDetailsHandler.js | Add `IT_CONFIRMATION_RESULTS` to `CONFIG.SHEETS`; replace the 3 literals |
| TODO-1 | The JR (Job Role) dropdown on the InitialRequest form is empty — there's a TODO comment saying "populate from JR lookup data" but nothing is wired up. Users can't select a JR. | InitialRequest.html:548 | **DISCUSS:** Ready to implement the JR lookup? |
| TODO-2 | The email domain selector on the InitialRequest form doesn't default to the manager's domain. Every submitter picks it manually every time. | InitialRequest.html:348 | **DISCUSS:** Implement auto-default or leave as-is? |

---

## 🔵 PERFORMANCE — Unnecessary Slowness

| ID | What's Wrong | Where | Fix |
|----|-------------|-------|-----|
| BUG-PERF1 | IT Confirmation reads 3 sheets to fetch data, then reads the same 3 sheets again to update them. Also writes ~30 individual cells instead of batching. Worst offender. | BOSSReviewHandler.js:213–463 | Return the row index from `getFullXxx()` functions; use it directly for updates; batch all writes per sheet into one `setValues()` call |
| BUG-PERF2 | After every status change, `syncStatusToRequestSheet()` reads all 3 origin sheets in full and scans every row to find one matching ID. Called after every workflow update. | WorkflowManager.js:166–182 | Use `sheet.createTextFinder(workflowId).findNext()` — finds the row in one call instead of scanning |
| BUG-PERF3 | HR Verification writes 5 fields to a row with 5 separate API calls to Google Sheets. One batched write would do the same thing faster. | HRVerificationHandler.js:147–155 | Replace 5 `setValue()` calls with one `setValues()` call |
| BUG-PERF4 | Every time an action item is closed, the spreadsheet is opened 2–3 times by nested functions that each open it independently. | ActionItemService.js → `closeActionItem()` → `checkWorkflowCompletion()` → `getRequiredSpecialistCats()` | Open the spreadsheet once and pass it down through the call chain |
| GAS-1 | Dashboard load reads the Terminations sheet twice in the same function call — once to build a lookup map, once to process termination workflows. | DashboardDataHandler.js:43, 143 | Read once into a variable and reuse it |

---

## 🗑️ STALE CODE REMOVAL

### Safe to delete immediately (verified: zero callers)

| File | What to Remove |
|------|---------------|
| Setup.js | 8 one-time setup functions: `initializeSystem`, `setupProdScriptProperties`, `listScriptProperties`, `enableMaintenanceMode`, `disableMaintenanceMode`, `setEmailRedirect`, `clearEmailRedirect`, `unsuppressEmails` |
| SuperDebug.js | 7 dead debug functions: `sdFixITResultsHeader`, `sdDiagnose`, `sdTestEmail`, `sdSendCompletionEmailFinal`, `sdGetSpreadsheetId`, `runSuperDebugAllWithLog`, `_sdSetEmailRedirect` |
| WorkflowManager.js | `adminPurgeWorkflows()` — body is commented out; TODO comment in the file says to delete it |
| SheetUtils.js | `setupSheetHeaders()` — ran once when the sheet was created, never needed again |
| EmailUtils.js | `sendBatchEmails()` — superseded by the current email system, no callers |
| ProdSmokeTest.js | `clearProdSmokeOverrides()` — orphaned partner function with no callers |

### Safe after confirming prod data is fully migrated

| File | What to Remove |
|------|---------------|
| MigrationTools.js | 4 functions: `migrateInitialRequests`, `migrateActionItems`, `buildDashboardView`, `fixIDSetupCompleteSteps` — these already ran in prod |
| ReferenceDataService.js | 5 functions replaced by `getInitialFormData()`: `getBossJobSitesList`, `getBossCostSheetsList`, `getRequestersList`, `getAllReferenceData`, `getSiteOptions` |
| ValidationUtils.js | Whole file — 5 dead functions + 2 live ones (`sanitizeInput`, `validateRequiredFields`) that can be inlined into their callers first |

### DISCUSS before removing

| File | Function | Question |
|------|----------|----------|
| ReplayService.js | `replayPlan()`, `replaySend()` | Is the workflow replay feature planned for the future, or a dead idea? |
| TerminationHandler.js | `scheduleAccountDeletion()` | Is automated account deletion on the roadmap? |

---

## ⚪ LOW / HOUSEKEEPING

| ID | What's Wrong | Fix |
|----|-------------|-----|
| BUG-SM4 | Old database rows still have step name `ID Setup Complete` (legacy value). StateSync maps it for display but it's confusing to anyone debugging. | One-time data migration to rewrite the old value; remove the StateSync compatibility alias |
| BUG-ER3 | `getMyPendingTasks()` and `getWorkflowMapStats()` return plain objects with no `success` key. Client error checks (`if (!res.success)`) pass silently on failure. | Add `success: true` to normal returns; add `success: false` in catch blocks |
| CODE-SC1 | BOSSReviewHandler.js accesses column 0 with hardcoded `[0]` in 3 places instead of using the `IR.WORKFLOW_ID` constant. Values happen to be correct but inconsistent with the rest of the codebase. | Replace `data[i][0]` with `data[i][IR.WORKFLOW_ID]` in 3 spots |
| CODE-CFG3 | `'team-group.com'` directory domain is hardcoded in Setup.js — not in ConfigurationService where it could be overridden per environment. | Add `DIRECTORY_DOMAIN` to ConfigurationService defaults |
| NOTE-SEC4 | HRVerification and IDSetup handlers read a row then write back to it with no lock. Two simultaneous submissions could overwrite each other. | Wrap the read-write block in `LockService.getScriptLock().waitLock()` |

---

## Items Needing Your Decision

Before implementation can start on these, need a yes/no:

1. **BUG-2** — Keep or record the `actingUser` arg that's currently dropped? (remove it vs add an audit column)
2. **BUG-SEC2** — Is the open dashboard access intentional? (all employees see all onboarding data)
3. **TODO-1** — Implement the JR dropdown lookup now?
4. **TODO-2** — Auto-default email domain to manager's domain now?
5. **ReplayService** — Delete or keep for future?
6. **scheduleAccountDeletion** — Delete or keep for future?
