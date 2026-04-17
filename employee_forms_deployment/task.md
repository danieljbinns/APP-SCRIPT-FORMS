# Employee Request Forms - Project Master Task List

Current Deployment Folder: `employee_forms_deployment/`

## Phase 1: Infrastructure & Environment [COMPLETE]

- [x] Create standardized deployment folder structure
- [x] Consolidate legacy code into `employee_forms_deployment/`
- [x] Initialize Git tracking and remote synchronization
- [x] Document project architecture

## Phase 2: Priority Workflow Forms [COMPLETE]

- [x] **Initial Request Form**: Entry point for all new hires.
- [x] **Employee Setup (HR)**: Automated ID generation and payroll setup.
- [x] **IT Setup**: Equipment assignment and Google account creation.

## Phase 3: Workflow Logic & Gating [COMPLETE]

- [x] Implement Sequential Gating (HR -> IT -> Specialists).
- [x] Configure conditional email triggers based on form results.
- [x] Create Specialist Placeholder logic for 7 secondary departments.

## Phase 4: Employee Request Dashboard [COMPLETE]

- [x] Build premium, dark-mode Admin Dashboard.
- [x] Implement real-time stats (Total, Pending, Complete).
- [x] Add advanced filtering and search.
- [x] **Employee Details View**: High-impact deep-dive for every request.

## Phase 5: Data Visibility & Tracking [COMPLETE]

- [x] **"By Who" Tracking**: Capture staff member email on every submission.
- [x] **Submission Timestamps**: Track start-to-finish durations.
- [x] **Full Data Dump**: Dynamic rendering of every submitted field in the Details view.

## Phase 6: Compatibility & Stability [COMPLETE]

- [x] Refactor HTML templates for maximum Google Apps Script compatibility (ASCII only, string concatenation).
- [x] Fix internal vs public URL navigation issues.
- [x] Implement JSON safety round-trips for robust data serialization.

## Phase 7: Specialist Form Customization [IN PROGRESS]

- [x] Create Specialist Forms Roadmap & Checklist
- [x] **HR Verification & ADP Step**: Created form and conditional routing logic
- [ ] Deploy HR Verification form and test both paths
- [ ] Develop standalone ADP Setup Form (note: ADP ID now captured in HR Verification)
- [ ] Develop standalone Fleetio Form
- [ ] Develop remaining custom specialist forms

## Phase 8: Staging QA Review [COMPLETE — pending testing]

### Group A: Access Control [COMPLETE]
- [x] Centralize admin list into `CONFIG.ADMIN_EMAILS` — dbinns@team-group.com, dbinns@robinsonsolutions.com, no-reply@team-group.com, davelangohr@team-group.com
- [x] `AccessControlService.isAdmin()` uses `CONFIG.ADMIN_EMAILS`
- [x] `canAccessWorkflow()` hardcoded email bypass replaced with `isAdmin()`
- [x] `DashboardHandler.js` inline isAdmin replaced with `AccessControlService.isAdmin()`
- [x] Add Payroll to `AccessControlService` — full workflow visibility + HR/IT form access
- [x] `canAccessDashboard()` — domain gating removed; all authenticated users enter, filtered by `canAccessWorkflow()`
- [x] `getUserAccessFlags()` — resolves all role/group checks in one API pass, returns `{isFullAccess, canEditDates}`

### Group B: Dashboard [COMPLETE]
- [x] `getDashboardData()` rewritten — `getUserAccessFlags()` called once per request (eliminates N×AdminDirectory API calls per page load)
- [x] JS filter replaces per-row `canAccessWorkflow()` calls
- [x] Site column added to dashboard
- [x] Date column added (generic label, works for new hire / term / position change)
- [x] `CHANGE_` prefix detection for Position Change workflow type
- [x] Termination status state machine — added `'In Progress'` branch
- [x] `StateSync.js` — `site` added to both onboarding and termination paths, outputRow extended to 13 cols

### Group C: syncWorkflowState Coverage [COMPLETE]
- [x] `InitialRequestHandler.js` — after `updateWorkflow` at submission
- [x] `IDSetup.js` — after `updateWorkflow` at ID Setup Complete
- [x] `HRVerificationHandler.js` — after both `updateWorkflow` calls (Complete + IT Setup Needed)
- [x] `ITSetupHandler.js` — after `updateWorkflow` at Specialist Forms Needed
- [x] `TerminationHandler.js` — after `updateWorkflow` at submission, approval, and rejection
- [x] `PositionChangeHandler.js` — after `updateWorkflow` at submission, approval, and rejection

### Group D: Data Integrity [COMPLETE]
- [x] `InitialRequest.html` — removed `checked` default from Chromebook radio; ghosted `computerType:'Chromebook'` into every submission
- [x] `InitialRequest.html` — submit handler cleanup block: zeroes out hidden section fields before server call (computer, phone, credit card, BOSS, Jonas, Google Account)
- [x] `IDSetup.js` — `getIDSetupRequestData()` converted from hardcoded column indices to header-based lookup

### Group E: Error Handling [COMPLETE]
- [x] All `google.script.run` calls across 11 HTML files now have `.withFailureHandler()`
- [x] Submit/action failures: re-enable button + alert
- [x] Data loading failures: `console.error` (non-blocking)

### Group F: Cleanup [COMPLETE]
- [x] `StateSync.js` — empty-row guard in `manuallySyncAllWorkflows()`
- [x] `appsscript.json` — removed `gmail.send` (redundant) and `directory.readonly` (redundant)

---

## Phase 8: Testing Checklist [PENDING]

### Access Control
- [ ] `davelangohr@team-group.com` — dashboard loads, admin controls visible, can edit dates
- [ ] `dbinns@robinsonsolutions.com` — full admin access confirmed
- [ ] `payroll@team-group.com` — dashboard loads, all workflows visible, cannot edit dates
- [ ] HR group member — dashboard loads, all workflows visible, can edit dates
- [ ] IT group member — dashboard loads, all workflows visible, can edit dates
- [ ] Manager (non-primary domain) — dashboard loads, only own requests visible
- [ ] Requestor — dashboard loads, only own requests visible
- [ ] Unknown authenticated user — dashboard loads, zero rows (not an error)

### Dashboard Display
- [ ] New hire workflow — Site and Start Date columns populated correctly
- [ ] Termination workflow — Site and Term Date columns populated correctly
- [ ] Position Change workflow — type shows "Position Change", effective date shown
- [ ] In-progress termination (post-HR-approval) — status shows correctly (not blank)
- [ ] Dashboard load time — noticeably faster than before for full-access users

### syncWorkflowState (Dashboard_View stays current)
- [ ] Submit new hire → Dashboard_View immediately shows "ID Setup Needed"
- [ ] Complete ID Setup → Dashboard_View immediately shows "ID Setup Complete"
- [ ] Complete HR Verification (hourly/no access) → Dashboard_View shows "Complete"
- [ ] Complete HR Verification (salary) → Dashboard_View shows "IT Setup Needed"
- [ ] Complete IT Setup → Dashboard_View shows "Specialist Forms Needed" with pending list
- [ ] Submit termination → Dashboard_View shows "HR Approval Needed"
- [ ] Approve termination → Dashboard_View shows "Action Items Pending"
- [ ] Reject termination → Dashboard_View shows "Rejected"
- [ ] Submit position change → Dashboard_View shows "HR Approval Needed"
- [ ] Approve position change → Dashboard_View shows "Action Items Pending" or "Change Processed"
- [ ] Reject position change → Dashboard_View shows "Rejected"

### Form Data Integrity
- [ ] Submit new hire with systemAccess=No — `systems` and `equipment` columns blank in sheet
- [ ] Submit new hire with Computer unchecked — `computerType` column blank (not "Chromebook")
- [ ] Submit new hire with Computer checked, type selected — `computerType` correctly captured
- [ ] Submit new hire with Credit Card unchecked — all CC limit columns blank
- [ ] Submit new hire with BOSS unchecked — all BOSS detail columns blank

### Error Handling
- [ ] Simulate server error on InitialRequest submit — alert shown, submit button re-enables
- [ ] Simulate server error on TerminationApproval — alert shown, button re-enables
- [ ] Simulate server error on ActionItemForm finalize — alert shown, button re-enables

### Batch Sync
- [ ] Run `manuallySyncAllWorkflows()` with empty rows at bottom of Workflows sheet — no errors, no blank entries in Dashboard_View

---

## Phase 9: Dashboard Deep Dive Fixes [FUTURE]

> All fixes target `employee_management_v2_staging/` at `P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_deployment\employee_management_v2_staging`. Deploy to staging and re-run the Phase 8 testing checklist before promoting to prod.

### Group A: Critical Bugs — will visibly fail during Phase 8 testing

- [ ] **A1 — Onboarding modal stepper never renders** (`DashboardHandler.js` line ~506 + `Dashboard.html` lines 638–715)
  - **What it is:** When you click on a new hire row in the dashboard, a popup opens with a checklist and a visual progress bar at the top showing the steps (Initial Request → ID Setup → HR Verification → IT Setup → Specialists). That progress bar is completely missing for every new hire. You just see the checklist table underneath with no stepper above it. Termination popups work fine because their code is different.
  - **Why it happens:** The popup renders the stepper only if the server says `type = 'Onboarding'`. The server function `getRequestDetails()` — which handles new hire lookups — never sets that field at all. It returns data, request info, and a checklist, but forgets to say what type of workflow it is. The termination equivalent (`getTerminationDetails()`) correctly sets `context.type = 'End of Employment'` at the very end. The new hire version just... doesn't. The popup sits there waiting for a signal that never comes, so both `isOnboarding` and `isEOE` are false, and the stepper block is skipped entirely.
  - **The fix:** Add one line — `context.type = 'Onboarding';` — just before the `return context;` at the bottom of `getRequestDetails()` in `DashboardHandler.js`. That's it.
  - **Risk:** None. Purely additive — adds a field that wasn't there before, consumed only by the modal rendering logic. Nothing else reads or depends on the absence of this field.

- [ ] **A2 — Position Change modal always fails with "Request ID not found"** (`DashboardHandler.js` lines 319–321)
  - **What it is:** Clicking on any Position Change row in the dashboard pops up an error saying "Request ID not found in database" instead of showing details. The modal is completely broken for this workflow type. New hire and termination modals work; position changes do not.
  - **Why it happens:** There are three workflow types, each stored in a different sheet tab: new hires in `Initial Requests`, terminations in `Terminations`, position changes in `Position Changes`. When you click a row, the code checks if the ID starts with `TERM_` — if yes, go to the Terminations sheet; if no, go to Initial Requests. That covers two of the three cases. Position Change IDs start with `CHANGE_`, which is not `TERM_`, so the code falls into the "else" branch and searches `Initial Requests` for a `CHANGE_` ID that will never be there.
  - **The fix:** Add a check for `CHANGE_` before the existing `TERM_` check, routing position changes to `CONFIG.SHEETS.POSITION_CHANGES`. Then verify that the column indices used to extract `requesterName`, `requesterEmail`, `managerEmail`, `hireDate`, and `site` from that row match the actual column layout of the Position Changes sheet — they may differ from the Initial Requests mapping currently used.
  - **Risk:** Low-medium. The routing fix is one line, but the field mapping (which columns hold which values) needs to be confirmed against the real Position Changes sheet header row before it's safe. Wrong column indices would show fields in the wrong places without throwing an error.

- [ ] **A3 — Cancelling a request doesn't update the dashboard row immediately** (`DashboardHandler.js` lines 289–300)
  - **What it is:** When you cancel a request via the modal and confirm the dialog, the modal closes, the dashboard refreshes — but the cancelled row still shows its old status (e.g. "In Progress" or "ID Setup Needed"). It looks like the cancel button did nothing. The row only updates to "Cancelled" the next time someone runs the manual batch sync.
  - **Why it happens:** The dashboard table is driven by a flat snapshot sheet called `Dashboard_View`. Every handler that changes a workflow's status ends with a call to `syncWorkflowState(workflowId)`, which recalculates the current status and writes the updated row into `Dashboard_View`. The cancel handler (`cancelRequest()`) updates the master `Workflows` sheet correctly but never calls `syncWorkflowState`. So the `Dashboard_View` row is still showing the pre-cancel state when `loadData()` reads it back.
  - **The fix:** Add `syncWorkflowState(workflowId);` on the line before `return { success: true, ... }` inside `cancelRequest()`. This is the identical pattern used in `InitialRequestHandler.js`, `TerminationHandler.js`, `PositionChangeHandler.js`, and every other handler — cancel was the only one that missed it.
  - **Risk:** None. Exact same pattern as 10+ other call sites already in the codebase.

---

### Group B: Logic Bugs — functionally wrong, may or may not surface depending on test data

- [ ] **B1 — Business Cards and 30/60/90 Review don't feed into the Specialists stepper dot** (`Dashboard.html` lines 651–656)
  - **What it is:** Inside the new hire modal, the stepper has a "Specialists" dot that should turn green only when all required specialist forms are complete, and yellow if any are still pending. If a new hire needs Business Cards or a 30/60/90 Review, those two forms are silently ignored by the dot — it won't change colour based on them no matter what their status is. Jonas, Credit Card, Fleetio, and SiteDocs do work correctly.
  - **Why it happens:** There's a name-mapping step that takes each checklist item's name and collapses it into a generic "Specialists" bucket before computing the dot's colour. The mapping uses string matching — `key.includes("Jonas")`, `key.includes("Credit")`, `key.includes("Fleet")`, `key.includes("SiteDocs")` — but "Business Cards" and "30/60/90 Review" and "Central Purchasing" are not in that list. They don't match anything, so they're left out of the Specialists bucket entirely and their status never affects the dot.
  - **The fix:** Extend the condition to also include `key.includes("Business") || key.includes("30") || key.includes("Central")`. Note: this fix only matters once A1 is also fixed, since the stepper doesn't render at all without A1.
  - **Risk:** None — only changes the colour logic of a single stepper dot in the modal. No data is read or written differently.

- [ ] **B2 — Viewing termination step data opens the Google Sheet twice** (`DashboardHandler.js` lines 522–527)
  - **What it is:** When you click "View Data" on the Initial Request row inside a termination workflow's flight check, the server fetches that data correctly — but it quietly wastes one Apps Script API call (and a small amount of execution time) by opening the spreadsheet twice when it only needs to open it once.
  - **Why it happens:** `getStepResultData()` opens the spreadsheet at the very top of the function: `const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)`. That `ss` variable is available throughout. But the `termination_request` case inside the switch block was written separately and opens it again: `const tss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)`. Both calls use the identical spreadsheet ID. The second one (`tss`) is completely redundant — only its sheet calls are used.
  - **The fix:** Replace all `tss.getSheetByName(...)` calls inside that case with `ss.getSheetByName(...)`, then delete the `const tss = SpreadsheetApp.openById(...)` line. The behaviour is identical.
  - **Risk:** None. The only change is removing one unnecessary `.openById()` call. The sheet reference returned is functionally the same object.

- [ ] **B3 — Checklist timestamps can display the literal text "undefined"** (`DashboardHandler.js` line 408 + `Dashboard.html` line 770 + `RequestDetails.html` line 685)
  - **What it is:** In the flight check table (both in the modal and on the full details page), the Timestamp column occasionally shows the word "undefined" instead of a dash or blank when no timestamp was recorded. It looks like a code error leaked into the UI.
  - **Why it happens:** The server builds the "Initial Request" checklist entry and populates the `time` field by doing `String(r['Submission Timestamp'])`. In JavaScript, `String(undefined)` doesn't produce an empty string — it literally produces the five-character string `"undefined"`. When the Submission Timestamp column is missing or blank for a row, that's exactly what gets sent. Both HTML files currently detect and hide this with `item.time === 'undefined' ? '-' : item.time`, which is a workaround at the display layer rather than a fix at the source.
  - **The fix:** In `DashboardHandler.js` where the Initial Request checklist item is built, change the time assignment to: `r['Submission Timestamp'] ? (r['Submission Timestamp'] instanceof Date ? r['Submission Timestamp'].toLocaleString() : String(r['Submission Timestamp'])) : ''`. This produces an empty string instead of `"undefined"` when the value is missing. The client-side guards in both HTML files can stay as a safety net.
  - **Risk:** None — cosmetic data fix. The client-side fallback guards remain unchanged and will catch any other edge cases.

---

### Group C: Performance — no functional impact, but noticeable at scale

- [ ] **C1 — Date sort re-parses every date string on every single comparison** (`Dashboard.html` lines 574–586)
  - **What it is:** Every time you change the sort order or type in the search box, the dashboard re-sorts its list of workflows by date. Under the hood, the sort algorithm compares pairs of rows hundreds of times. Each comparison parses both dates from scratch — so for a list of 200 workflows, a single sort action creates and discards over 3,000 temporary `Date` objects that were already computed moments earlier.
  - **Why it happens:** The sort comparator function is `(a, b) => { return new Date(b.dateRequested) - new Date(a.dateRequested); }`. JavaScript calls this function for every pair the sort algorithm evaluates. `new Date(string)` is not cached anywhere — each call re-parses the string from scratch. For small lists this is imperceptible; for 500+ workflows it adds up to noticeable jank on every filter or search interaction.
  - **The fix:** Before calling `.sort()`, do one pass to build a lookup map: `const dateMs = {}; filteredWorkflows.forEach(wf => { dateMs[wf.id] = new Date(wf.dateRequested).getTime(); });`. Then the comparator becomes `dateMs[b.id] - dateMs[a.id]` — a simple number subtraction with zero parsing. Each date is parsed exactly once regardless of how many comparisons the sort makes.
  - **Risk:** None — the sort output is identical. Validate by checking that Newest First and Oldest First orders match the current behaviour before and after the change.

- [ ] **C2 — Search input triggers a full re-render on every keystroke** (`Dashboard.html` lines 527–530)
  - **What it is:** Typing "Smith" in the search box triggers five separate filter + sort + DOM-write cycles — one for each letter — instead of one when you finish typing. On a large dataset, every intermediate state ("S", "Sm", "Smi", "Smit") causes the browser to throw away and rebuild the entire table. Most of that work is immediately discarded by the next keystroke.
  - **Why it happens:** The `input` event listener calls `applyFiltersAndSort()` directly and synchronously. There is no delay. Every character that lands in the input box immediately fires the full pipeline.
  - **The fix:** Wrap the call in a 150ms debounce — a short timer that resets every time a new key is pressed, only firing `applyFiltersAndSort()` once the user stops typing. `clearTimeout(searchDebounce); searchDebounce = setTimeout(applyFiltersAndSort, 150)`. 150ms is short enough to feel instant to users but long enough to skip all the mid-word intermediate renders.
  - **Risk:** None. Purely additive timing change. The final filter result is identical — it just runs once instead of once-per-character.

---

### Group D: Polish / UX — cosmetic, low effort, do in a batch

- [ ] **D1 — "Date" column renders identically for all three workflow types** (`Dashboard.html` lines 469–471)
  - **What it is:** The main dashboard table has a column called "Date" that's supposed to contextualise — Start Date for new hires, Term Date for terminations, Effective Date for position changes. In practice the column always shows the same field (`hireDate`) regardless of type and the header never changes. If you're looking at a mixed list of new hires and terminations, you can't tell whether a given date means "starting" or "leaving."
  - **Why it happens:** The code uses a three-way conditional to produce `dateLabel`, but all three branches evaluate to exactly the same expression: `(wf.hireDate || '-')`. The conditional was written with intent but never actually diverged. The column header `<th>Date</th>` is also static and never updates.
  - **The fix:** Simplify `const dateLabel = wf.hireDate || '-'` to remove the dead conditional. Then, if distinct labelling is wanted, make the column header update dynamically when a type filter is active (e.g. "Start Date" when showing only new hires, "Term Date" when showing only EOE).
  - **Risk:** None — current visible behaviour doesn't change. The dead code is replaced with functionally identical code that's just shorter and honest.

- [ ] **D2 — Type filter has no "Position Change" option** (`Dashboard.html` lines 296–307)
  - **What it is:** The "All Types" dropdown lets you narrow the dashboard to "New Hires" or "End of Employment" only. There is no way to show only Position Change requests. If you have a mix of all three types and only want to act on position changes, you have to manually scroll through everything.
  - **Why it happens:** The dropdown was built with two workflow types in mind and never updated when Position Change was added. The filter logic in `applyFiltersAndSort()` also has no `CHANGE` branch.
  - **The fix:** Add `<option value="CHANGE">Position Change</option>` to the `#typeFilter` select, and add `if (currentTypeFilter === 'CHANGE' && wf.type !== 'Position Change') return false;` inside the filter function. **Depends on A2 being fixed first** — there's no point filtering to a type whose detail modal is broken.
  - **Risk:** None on its own. Dependency on A2.

- [ ] **D3 — Loading and error messages don't span the full table width** (`Dashboard.html` lines 408, 454, 523)
  - **What it is:** When the dashboard is loading data or shows an error, the message text appears in a cell that only spans 7 of the 8 table columns. There's an invisible gap at the right edge of the table during loading states.
  - **Why it happens:** The table was expanded from 7 to 8 columns at some point (the "Site" column was added as part of Group B in Phase 8) but the three `<td colspan="7">` placeholder rows were never updated to match.
  - **The fix:** Change `colspan="7"` to `colspan="8"` in all three locations — the initial "Loading requests..." row (line 335), the "Refreshing data..." row injected by `loadData()`, and the no-results "No requests found." row.
  - **Risk:** None — one-character change, three places, purely cosmetic.

- [ ] **D4 — Empty `window.onload` block with a commented-out line** (`Dashboard.html` lines 385–388)
  - **What it is:** There is a `window.onload = function() { ... }` block in the script that contains only a commented-out reference to a header button that was removed from the HTML at some earlier point. The function runs on page load, does nothing, and returns. The actual page load logic is handled separately by the `DOMContentLoaded` listener two lines below it.
  - **Why it happens:** The button was removed from the HTML but the `window.onload` wiring wasn't cleaned up at the same time.
  - **The fix:** Delete the entire `window.onload = function() { /* commented line */ };` block (4 lines). The `DOMContentLoaded` listener that calls `loadData()` is the real entry point and is unaffected.
  - **Risk:** None — the block is provably inert. Running it or not running it produces the same page behaviour.

- [ ] **D5 — Cancel request has no server-side authorisation check** (`DashboardHandler.js` lines 289–300)
  - **What it is:** The bump (remind) and edit-date actions both verify the user has the right role before doing anything. The cancel action does not — any user who can see a workflow row can cancel the entire request for that employee, regardless of whether they're the requester, a manager, or an admin. A manager accidentally clicking "Cancel Entire Request" on someone else's onboarding would succeed.
  - **Why it happens:** `cancelRequest()` was implemented without the access check that the other action handlers have. `bumpRequest()` and `updateHireDate()` both call `AccessControlService.isAdmin()` at the top before proceeding.
  - **The fix:** Add a permission check at the top of `cancelRequest()`. The exact rule needs to be decided first: options are admin-only, admin + original requester, or admin + requester + manager. Once decided, implement using `AccessControlService.isAdmin(user)` and/or a lookup of the workflow's `requesterEmail` from the Workflows sheet.
  - **Risk:** Low but requires a decision. Implementing the wrong rule could lock out users who legitimately need to cancel (e.g. the original requester cancelling their own submission). Confirm the intended cancel permission policy before coding.

---

## Phase 10: HTML Audit Fixes [COMPLETE]

> 58 findings (13 Critical, 28 Bugs, 8 Warnings, 9 Nitpicks) across 25 files. Full detail in `html_audit.md` at project root. Fix in priority order — `DirectoryAutocomplete.html` first (XSS propagates into every form that embeds it), then the files with multiple Criticals below.

### DirectoryAutocomplete.html — HIGHEST PRIORITY (XSS embedded in every form)
- [ ] **[Critical]** XSS — `user.name` and `user.email` injected into `innerHTML`; use `createElement` + `textContent` instead
- [ ] **[Bug]** 100ms debounce fires a GAS directory call per keystroke — increase to 400–500ms
- [ ] **[Bug]** `document.addEventListener('click')` accumulates one listener per `setup()` call — use a single shared delegated listener

### TerminationRequest.html
- [ ] **[Critical]** DOM element passed to `google.script.run` — GAS cannot serialize DOM elements; submit always silently fails; build plain object from `new FormData(this)` instead
- [ ] **[Critical]** File attachment silently discarded — `HtmlService` cannot receive `File` objects; remove the input or implement base64 upload, or add a visible note
- [ ] **[Bug]** `DirectoryAutocomplete.setup()` called twice per field — creates duplicate dropdown overlays; remove the duplicate block
- [ ] **[Bug]** Submit button restored to wrong label text on failure — store `btn.textContent` before disabling, restore from stored value

### TerminationApproval.html
- [ ] **[Critical]** `|| true` makes "Collect Assets" checkbox always checked regardless of actual assets — remove `|| true`
- [ ] **[Bug]** Hidden Follow-up Actions section always submits hardcoded `true` for `collectAssets` and `itDisable` — resolve Critical above and decide whether the section should be visible

### ITSetup.html
- [ ] **[Critical]** Multi-select data loss — `FormData.forEach()` overwrites repeated keys, keeping only last value; use `FormData.getAll()` for known multi-select fields
- [ ] **[Critical]** `<?!= ?>` for BOSS job sites is unescaped server-side XSS — switch to `<?= ?>` or escape values in GAS before passing to template
- [ ] **[Bug]** `employeeName` injected into JS string literal via `<?= ?>` — use `JSON.stringify()` instead

### ActionItemForm.html
- [ ] **[Critical]** `userEmail` never populated — no `google.script.run` call to fetch it; all audit trail entries save with a blank author; add call to `getCurrentUserEmail()` on load
- [ ] **[Critical]** No retry when `finalComplete` returns `{success: false}` — button stays disabled showing "Finalizing..."; add `else` branch to re-enable and show `res.message`
- [ ] **[Critical]** XSS in `initChecklist()` — `item` (checklist item name) and `saved.by` (user email) injected into `innerHTML`; apply `escapeHtml()` to both

### Dashboard.html
- [ ] **[Critical]** XSS in `renderTable()` — `wf.employee`, `wf.status`, `wf.step`, `wf.type`, `wf.id` all injected into `innerHTML` unescaped; `wf.id` and `wf.type` also interpolated into `onclick` strings; add `escapeHtml()` and apply to every server value
- [ ] **[Bug]** Dead function `openAdminForm()` — defined but never called; remove it
- [ ] **[Bug]** `item.time === 'undefined'` string check is fragile — change to `!item.time || item.time === 'undefined'`
- [ ] **[Nitpick]** Stray backtick at end of file — delete
- [ ] **[Nitpick]** `<?= getBaseUrl() ?>` evaluated at render time — URL is stale if deployment changes between page load and click; document this

### InitialRequest.html
- [ ] **[Critical]** XSS via `innerHTML` for ADP/Purchasing site checkboxes — use `createElement` and set `value` / `textContent` as properties, not `innerHTML`
- [ ] **[Critical]** Server values injected into JS string literals via `<?= ?>` — `<?=` escapes HTML but not `"`, `\`, or newlines; wrap all in `JSON.stringify()`
- [ ] **[Bug]** `populateSelect('position', refData.jrs)` targets `<input type="text">` not `<select>` — change to `<select>` or datalist, or remove the call
- [ ] **[Bug]** Dead `prefillTestData()` with hardcoded test email ships in served HTML — delete entire function
- [ ] **[Bug]** Third `else if` in hidden section cleanup is always true — change to plain `else`
- [ ] **[Warning]** Two `DOMContentLoaded` listeners (one on `window`, one on `document`) — consolidate into one

### EquipmentSystemRequest.html
- [ ] **[Critical]** XSS via `innerHTML` for ADP/Purchasing site checkboxes — same fix as `InitialRequest.html`
- [ ] **[Bug]** Four payload fields always `null` — `hireDate`, `newHireOrRehire`, `employeeType`, `employmentType` copied from `InitialRequest.html` but fields don't exist here; remove these lines
- [ ] **[Bug]** Three dead functions — `handleEmploymentTypeChange()`, `checkHireDate()`, `toggleJRPicker()` reference fields that don't exist; delete all three
- [ ] **[Bug]** `populateSelect('position', refData.jrs)` targets text input — same fix as `InitialRequest.html`
- [ ] **[Bug]** No hidden section cleanup before submission — add cleanup logic matching `InitialRequest.html` pattern
- [ ] **[Nitpick]** Duplicate "step 5" comment — renumber correctly

### PositionSiteChangeRequest.html
- [ ] **[Critical]** Null dereference in `toggleComp()` and `togglePhone()` — `querySelector(...).value` throws if no radio selected; guard the result before accessing `.value`
- [ ] **[Bug]** Stale hidden section data submitted when sections are unchecked — add cleanup logic before submission
- [ ] **[Bug]** `DirectoryAutocomplete.setup()` called twice per field — same fix as `TerminationRequest.html`

### RequestDetails.html
- [ ] **[Bug]** `withSuccessHandler(alert)` in `bump()` — shows `[object Object]`; wrap to extract `res.message`
- [ ] **[Bug]** `viewDataTarget` race condition — consumed before `getLocation` callback resolves; call `loadDetails()` from inside the callback
- [ ] **[Bug]** XSS in `renderStepData()` — `key` and `val` are raw server data written into `innerHTML`; apply `escapeHtml()` to both
- [ ] **[Warning]** `innerHTML +=` in loop for EOE flow diagram — O(n²) DOM rebuild per iteration; `item.name` also in `onclick` string; use `createElement` + `addEventListener`

### HRVerification.html
- [ ] **[Bug]** `alert('System error: ' + err)` shows `[object Error]` — use `err.message`
- [ ] **[Bug]** `formId` missing from submission payload — hidden input exists but is not read; add `formId: form.formId.value`
- [ ] **[Warning]** Fragile hire date timezone stripping with hardcoded abbreviations (`GMT+0100`, `GMT+0200`) — non-EU timezones not stripped; use `dateObj.toLocaleDateString()` or format server-side

### Jonas.html / CreditCard.html / Fleetio.html / BusinessCards.html / SiteDocs.html (shared)
- [ ] **[Bug]** Success handler never checks `result.success` — always shows success screen even on server failure; accept `result` arg, check `result.success`, re-enable button and alert `result.message` on false
- [ ] **[Bug]** Invalid CSS `mb: 15px` in `.spinner` — change to `margin-bottom: 15px`

### CentralPurchasing.html
- [ ] **[Bug]** Success handler never checks `result.success` — same fix as specialist forms above
- [ ] **[Bug]** `formId` missing from submission payload — add `formId: form.formId.value`

### Review306090.html
- [ ] **[Bug]** Success handler never checks `result.success` — same fix as specialist forms
- [ ] **[Bug]** Invalid CSS `mb: 15px` in `.spinner` — same fix as specialist forms

### EmployeeIDSetup.html
- [ ] **[Bug]** `formId` missing from submission payload — add `formId: form.formId.value`

### LandingPage.html
- [ ] **[Warning]** `getCurrentUserEmail` failure handler only calls `console.error` — `#userEmail` stays on "Loading..." permanently; set fallback text in failure handler

### DataManager.html
- [ ] **[Bug]** `event` used as implicit global in `switchTab()` and `addItem()` — deprecated in strict mode; pass `event` explicitly from `onclick` and update function signatures
- [ ] **[Nitpick]** `deleteItem` has no loading/disabled state — button stays clickable during async delete, allowing duplicate calls; disable while in flight

### TerminationFormBuilder.html
- [ ] **[Warning]** Undefined CSS variables `var(--surface)` and `var(--danger)` — modal background is transparent, delete button text invisible; define both in `:root`
- [ ] **[Warning]** Commented-out dead field `f_comp_serial` in `defaultFields` — remove it
- [ ] **[Nitpick]** `exportForm()` omits `logic` and `options` — lost on export; include in serialised dataset

### DemoWalkthrough.html
- [ ] **[Warning]** `saveFeedback()` makes no `google.script.run` call — all submitted feedback is permanently discarded; add server call or visible note
- [ ] **[Warning]** `iframe src` points to non-existent files (`preview_DashboardVNext.html` etc.) — every iframe shows blank/404; update to real URLs or create referenced files
- [ ] **[Nitpick]** Missing `<base target="_top">` — may cause navigation issues in GAS iframe context

### StatusChangeApproval.html
- [ ] **[Nitpick]** `receivingManagerEmail` submitted even when transfer section is unchecked — conditionally exclude from payload

---

## Phase 11: Access Control Cleanup [PLANNED - FUTURE]

- [ ] Consolidate `MASTER_ADMIN_GROUP` (Google Group) and `ADMIN_EMAILS` (hardcoded list) into a single admin access mechanism
- [ ] Audit `ALL_FORMS_GROUP` — currently points to `grp.forms.it@team-group.com` (IT group); should be its own group or removed in favour of explicit HR/IT/Payroll checks
