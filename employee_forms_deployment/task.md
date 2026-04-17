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

## Phase 9: Dashboard Deep Dive Fixes [COMPLETE]

> All fixes verified present in `employee_management_v2_staging/` as of 2026-04-17. D1 is cosmetic and still open.

### Group A: Critical Bugs

- [x] **A1 — Onboarding modal stepper never renders** — Fixed: `context.type = isChange ? 'Position Change' : 'Onboarding'` set in `DashboardHandler.js` line ~511.
- [x] **A2 — Position Change modal always fails with "Request ID not found"** — Fixed: `CHANGE_` routing branch added in `DashboardHandler.js`, routes to `CONFIG.SHEETS.POSITION_CHANGES`.
- [x] **A3 — Cancelling a request doesn't update the dashboard row immediately** — Fixed: `syncWorkflowState(workflowId)` called in `cancelRequest()` before return.

### Group B: Logic Bugs

- [x] **B1 — Business Cards and 30/60/90 Review don't feed into the Specialists stepper dot** — Fixed: `key.includes("Business") || key.includes("30") || key.includes("Central")` added to specialist key matching in `Dashboard.html`.
- [x] **B2 — Viewing termination step data opens the Google Sheet twice** — Fixed: `termination_request` case in `getStepResultData()` now reuses outer `ss` variable via `ss.getSheetByName(...)`.
- [x] **B3 — Checklist timestamps can display the literal text "undefined"** — Fixed: timestamp assignment in `DashboardHandler.js` now guards with truthiness check before converting to string.

### Group C: Performance

- [x] **C1 — Date sort re-parses every date string on every comparison** — Fixed: `dateMs` pre-parse map built before sort comparator in `Dashboard.html`.
- [x] **C2 — Search input triggers full re-render on every keystroke** — Fixed: 150ms debounce (`clearTimeout` + `setTimeout`) wraps `applyFiltersAndSort` call in `Dashboard.html`.

### Group D: Polish / UX

- [x] **D1 — "Date" column renders identically for all three workflow types** — Fixed: `#dateColHeader` th updated dynamically in `applyFiltersAndSort()` — shows "Start Date" (ONBOARDING), "Term Date" (EOE), "Effective Date" (CHANGE), or "Date" (ALL).
- [x] **D2 — Type filter has no "Position Change" option** — Fixed: "Position Change" option present in `#typeFilter` dropdown.
- [x] **D3 — Loading and error messages don't span the full table width** — Fixed: placeholder rows use `colspan="8"`.
- [x] **D4 — Empty `window.onload` block with a commented-out line** — Fixed: block no longer present in `Dashboard.html`.
- [x] **D5 — Cancel request has no server-side authorisation check** — Fixed: `cancelRequest()` checks `AccessControlService.isAdmin(user)` and returns permission denied for non-admins.

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
