# Code Review Report — Employee Management V2 Staging
**Date:** 2026-04-20
**Scope:** Full staging folder — 29 HTML files, 25 JS backend files
**Reviewers:** 4 parallel automated agents (Backend JS, HTML Structure, Inline JS, CSS + Docs)
**Status:** Read-only analysis. No files were modified.

---

## Quick Reference

| Severity | Count | Action |
|----------|-------|--------|
| CRITICAL | 8 | Fix immediately |
| HIGH | 18 | Fix this sprint |
| MEDIUM | 40+ | Scheduled cleanup |
| LOW | 15+ | Backlog |

---

## Table of Contents
1. [Critical Issues](#critical-issues)
2. [High Priority Issues](#high-priority-issues)
3. [Medium Priority Issues](#medium-priority-issues)
4. [Low Priority Issues](#low-priority-issues)
5. [CSS — Cross-Cutting Issues](#css-cross-cutting-issues)
6. [Documentation — Cross-Cutting Issues](#documentation-cross-cutting-issues)
7. [File-by-File Quick Reference](#file-by-file-quick-reference)
8. [Recommended Action Plan](#recommended-action-plan)

---

## CRITICAL ISSUES

These represent bugs, data integrity risks, or security vulnerabilities that should be resolved before the next production deploy.

---

### C1. Template Literals (Backticks) in GAS Files
**Files:** InitialRequest.html, ActionItemForm.html, Dashboard.html, RequestDetails.html, SafetyOnboarding.html, Review306090.html (and possibly others)
**Category:** GAS ASCII-Only Rule Violation

GAS V8 iframes silently fail or throw syntax errors when backticks appear in HTML `<script>` blocks. Template literals were confirmed in multiple files (dynamic HTML construction, JSON stringify operations, URL building).

**Fix:** Replace all backticks with string concatenation or `Array.join('')` patterns. Run a project-wide search:
```
Pattern: `
```
Every match inside a `<script>` block is a violation.

---

### C2. ID Generation Race Condition
**Files:** SheetUtils.js (`generateRequestId()`), WorkflowManager.js (`generateWorkflowId()`), IDSetup.js (`generateEmployeeId()`)
**Category:** Data Integrity

All three ID generators use timestamp + small random suffix. Two simultaneous requests within the same millisecond can produce identical IDs, breaking workflow tracking. The `generateEmployeeId()` function additionally does read-then-write without a lock, so concurrent calls can produce duplicate employee IDs.

**Fix:** Replace with `Utilities.getUuid()` for workflow/request IDs, and wrap `generateEmployeeId()` in `LockService.getScriptLock()`:
```javascript
const lock = LockService.getScriptLock();
lock.waitLock(30000);
try {
  // read max, increment, write
} finally {
  lock.releaseLock();
}
```

---

### C3. HTML Injection in Email Templates
**File:** EmailUtils.js (`createEmailTemplate()`, `createContextBlock()`)
**Category:** Security

Employee names, manager names, site names, and other user-provided strings are concatenated directly into HTML email bodies without sanitization. A name like `<img src=x onerror="alert('xss')">` would execute in the recipient's email client.

**Fix:** Pass all context values through `sanitizeInput()` from ValidationUtils.js before building the HTML string.

---

### C4. HTML Injection in Success Handlers
**Files:** TerminationApproval.html (line ~311) and other forms using `innerHTML` to render server response messages
**Category:** Security

`document.querySelector('.card').innerHTML = res.message` — if the backend returns any user-provided content (e.g., notes from a form), it executes as HTML.

**Fix:** Use `textContent` instead of `innerHTML` for server-provided strings, or sanitize with a whitelist before injection.

---

### C5. Duplicate Safety Onboarding Email
**Files:** HRVerificationHandler.js (`submitHRVerification()` / `triggerNextStep()`), IDSetup.js (`triggerNextStepFromIDSetup()`)
**Category:** Logic Bug

On the salary + system-access path, `sendSafetyOnboardingEmail()` may be invoked from both the HR Verification handler and the ID Setup handler, sending the Safety team duplicate emails for the same employee.

**Fix:** Audit both call stacks end-to-end and designate exactly one owner for the safety onboarding trigger. Add a guard (e.g., check if safety action item already exists before creating/emailing).

---

### C6. google.script.run Calls Lack Timeout Handling
**Files:** All HTML forms (~28 files)
**Category:** UX / Reliability

No form wraps its `google.script.run` calls with any timeout. If the server hangs or is rate-limited, the loading overlay spins indefinitely and the form becomes unresponsive with no way to recover.

**Fix:** Implement a client-side timeout wrapper:
```javascript
function withTimeout(runCall, ms, onTimeout) {
  var timer = setTimeout(function() {
    onTimeout();
  }, ms);
  return runCall.withSuccessHandler(function(res) {
    clearTimeout(timer);
    // original success handler
  }).withFailureHandler(function(err) {
    clearTimeout(timer);
    // original failure handler
  });
}
```
Apply with a 20–30 second limit on all submit calls.

---

### C7. ITSetup FormData Deduplication Silently Drops Checkboxes
**File:** ITSetup.html (lines ~838–856)
**Category:** Data Loss Bug

A custom deduplication loop on the serialized FormData picks only the first value for any duplicate key. If a field name appears as both a checkbox and a text input, only the first (likely the empty text input) is kept and the checkbox value is discarded.

**Fix:** Remove the custom deduplication and instead use `FormData.getAll()` consistently for multi-value fields, similar to the pattern in EquipmentSystemRequest.html.

---

### C8. SYNC REQUIRED Comments — No Programmatic Enforcement
**Files:** InitialRequest.html (lines ~387–392, ~482–486), PositionSiteChangeRequest.html (lines ~420–437), EquipmentSystemRequest.html
**Category:** Data Integrity / Maintenance

Seven system types and several equipment sub-forms must be kept identical across 3 HTML files. This is tracked only by HTML comments with no automated verification. Any developer editing one file without knowing to update the others will silently create divergence.

**Fix (near-term):** Add a test function that compares the system/equipment checkbox IDs between the three forms and alerts if they diverge. Run it from Setup.js.

**Fix (long-term):** Extract system and equipment definitions to a shared JSON configuration (reference data in DataManager) and generate form sections dynamically — eliminating the duplication entirely.

---

## HIGH PRIORITY ISSUES

---

### H1. Linear Search Bottleneck — O(n) Lookups on Every Request
**Files:** SheetUtils.js (`updateWorkflowStatus()`, `getRowByRequestId()`), WorkflowManager.js (`updateWorkflow()`), DashboardHandler.js, ActionItemService.js (`checkWorkflowCompletion()`)
**Category:** Performance

Every ID-based operation iterates through the entire sheet row by row. At current scale this is acceptable; at 5,000–10,000+ rows it will cause timeouts and slow dashboard loads.

**Fix:** Use GAS `TextFinder` for all ID lookups:
```javascript
var finder = sheet.createTextFinder(workflowId).matchEntireCell(true);
var cell = finder.findNext();
if (cell) { var row = cell.getRow(); }
```
This is substantially faster than a JavaScript loop on the full dataset.

---

### H2. Hardcoded Column Indices Break on Sheet Restructure
**Files:** HRVerificationHandler.js, ITSetupHandler.js (`getITContextData()`), PositionChangeHandler.js, InitialRequestHandler.js (`formatInitialRequestData()`)
**Category:** Fragility / Data Integrity

Multiple functions access sheet rows by hardcoded numeric index (e.g., `initialRequestRow[22]`). If columns are added, removed, or reordered, wrong data is silently pulled for the remainder of the workflow.

**Fix:** Use header-based lookup (as IDSetup.js already does correctly) in all handler files:
```javascript
var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
var colIndex = headers.indexOf('Google Email');
if (colIndex === -1) throw new Error('Column not found: Google Email');
return row[colIndex];
```

---

### H3. workflowId / dept Parameters Not Validated at Router Entry
**File:** Router.js
**Category:** Defensive Programming / UX

`workflowId` and `dept` from URL parameters are passed directly to form handlers without validation. An empty or malformed `workflowId` propagates silently through the system; an unknown `dept` value in Specialist.js causes `HtmlService.createTemplateFromFile()` to crash on a nonexistent file.

**Fix:**
```javascript
if (!workflowId || workflowId.trim() === '') {
  return HtmlService.createHtmlOutput('<h2>Error: No workflow ID provided.</h2>');
}
// In Specialist.js:
if (!deptMap[dept]) {
  return HtmlService.createHtmlOutput('<h2>Error: Unknown department "' + dept + '".</h2>');
}
```

---

### H4. Conditional Required Fields Not Validated on Submit
**Files:** PositionSiteChangeRequest.html (newManagerEmail), TerminationRequest.html (reportsToNew textarea), StatusChangeApproval.html (receiving manager email)
**Category:** Data Integrity

Fields that become required when a parent condition is met (e.g., "Reassign Direct Reports = Yes") are not validated on submit. The form allows submission with blank dependent fields.

**Fix:** Add explicit checks in the submit handler before firing `google.script.run`:
```javascript
if (form.reassignReports.value === 'Yes' && !form.newManagerEmail.value.trim()) {
  showError('New Manager Email is required when reassigning reports.');
  return;
}
```

---

### H5. Submit Button Not Disabled During Async Reference Data Load
**Files:** Review306090.html, HRVerification.html, ITSetup.html (anywhere with async dropdown population)
**Category:** Data Integrity / Race Condition

Forms with JR title dropdowns or other async-populated selects allow submission before the data finishes loading. On a slow connection, the user could submit with "Loading titles..." as the selected value.

**Fix:** Disable the submit button on page load and re-enable it only in the `withSuccessHandler` of the data-loading call:
```javascript
document.getElementById('submitBtn').disabled = true;
google.script.run
  .withSuccessHandler(function(titles) {
    // populate dropdown
    document.getElementById('submitBtn').disabled = false;
  })
  .withFailureHandler(function() {
    showError('Failed to load form data. Please refresh.');
  })
  .getJrTitles();
```

---

### H6. bump() Function — No Confirmation, Allows Email Spam
**File:** RequestDetails.html (line ~500)
**Category:** UX / Side Effects

The reminder email function is called directly from an `onclick` handler with no confirmation prompt and no debounce. Rapid clicking sends multiple duplicate emails to the same recipient.

**Fix:** Show a confirmation dialog and disable the button after the first click until the server responds.

---

### H7. HRVerification.html — onclick String with Unescaped Server Value
**File:** HRVerification.html (line ~388)
**Category:** Security

An `onclick` attribute is built with server-side template injection: `onclick="window.open('<?= getBaseUrl() ?>?form=dashboard', '_top')"`. If `getBaseUrl()` returns a string containing a single quote, it breaks the attribute and could allow attribute injection.

**Fix:** Set the href via JavaScript after page load instead of injecting it into an attribute string.

---

### H8. Missing withFailureHandler on Several google.script.run Calls
**Files:** LandingPage.html (`getUserEmail()`), TerminationRequest.html (several calls), ITSetup.html
**Category:** Silent Failure

Calls without `withFailureHandler` silently fail if the server throws — the loading overlay may stay up or the form will appear to hang with no user feedback.

**Fix:** Every `google.script.run` call must have both handlers. Add a project-wide search for `.withSuccessHandler(` not followed on the next chained call by `.withFailureHandler(`.

---

### H9. Dashboard Loads Full Sheet on Every Open — No Pagination
**File:** DashboardHandler.js (`getDashboardData()`)
**Category:** Performance / Scalability

The entire Dashboard_View sheet is pulled on every dashboard open. As workflow volume grows, this becomes slow and risks hitting GAS execution time limits.

**Fix:** Implement server-side pagination with a `pageSize` and `pageToken` parameter. Or at minimum, limit rows to the last N months on initial load.

---

### H10. DirectoryService — No Error Handling on Admin Directory API Calls
**File:** DirectoryService.js (`searchDirectoryUsers()`, `getCurrentUserDetails()`)
**Category:** Reliability

If the Admin Directory API is rate-limited or unavailable, calls throw unhandled exceptions that bubble up to the user as a generic GAS error. `getCurrentUserDetails()` requires admin privilege; non-admin callers throw an authorization error.

**Fix:** Wrap both functions in try/catch with graceful fallback (return empty array / email address as display name).

---

### H11. sendSafetyOnboarding / sendBatchEmails — No Per-Email Error Result
**File:** EmailUtils.js (`sendBatchEmails()`)
**Category:** Reliability

If one email in a batch fails (quota, invalid address), the rest still send but the caller has no way to know which failed. The batch is not atomic.

**Fix:** Return a results array: `[{ email, success, error }]` so callers can log failures and potentially retry.

---

### H12. Gatekeeper Confirmation Failure Shows Blank Form
**Files:** InitialRequest.html, EquipmentSystemRequest.html, TerminationRequest.html
**Category:** UX

If `confirmGatekeeper()` fails or the server call errors, the form remains hidden (`display: none`) and the user sees a blank page with no explanation.

**Fix:** Add a `withFailureHandler` to the gatekeeper call that shows an error message and a retry button.

---

### H13. TerminationRequest.html — HR Approval Section Can Be Submitted Twice
**File:** TerminationRequest.html (line ~350)
**Category:** Logic Bug

The HR approval section renders conditionally after initial submit. If state is unexpectedly re-evaluated, a second submission could fire against the same workflow.

**Fix:** Disable / hide the initial submit button once the first submission succeeds, and track submission state on the client.

---

### H14. EquipmentSystemRequest.html — INJECTED_REF_DATA Silent Failure
**File:** EquipmentSystemRequest.html (lines ~800–850)
**Category:** Data Integrity

If the backend fails to inject reference data into the template, all site/JR/job-code selects remain empty. The form still allows submission, sending empty values downstream with no indication to the user.

**Fix:** After DOMContentLoaded, check whether the expected selects have any `<option>` children. If empty, show an error and block submission.

---

### H15. CentralPurchasing.html — sitesConfigured Editable, No Validation
**File:** CentralPurchasing.html (line ~69)
**Category:** Data Integrity

The pre-filled sites text input can be manually edited by the specialist before submission, potentially overwriting what was actually requested with arbitrary text.

**Fix:** Make the field read-only, or add server-side validation that the submitted value matches the original request.

---

### H16. SafetyTermination.html — Checkbox State Not Captured in Payload
**File:** SafetyTermination.html (lines ~122–126)
**Category:** Logic Bug

Form submission payload hardcodes `{ siteDocsRemoved: true, bossDeactivated: true }` regardless of checkbox state. The checkboxes are used only for client-side UI gating, not for capturing actual data. If a specialist submits with one unchecked (impossible due to validation, but still), the server records `true` regardless.

**Fix:** Read the actual checkbox values in the submit handler: `siteDocsRemoved: document.getElementById('siteDocsRemoved').checked`.

---

### H17. bumpRequest() Sends Reminder Without Verifying Step Is Still Pending
**File:** DashboardHandler.js (`bumpRequest()`)
**Category:** Logic Bug

Function sends a "please complete this step" reminder email without first checking whether the step has already been completed. If the step was finished between the dashboard load and the button click, the email is sent incorrectly.

**Fix:** Query the relevant result sheet for the workflowId before sending. Return `{ success: false, message: 'Step already completed.' }` if a record is found.

---

### H18. validateRequiredFields() Does Not Trim Whitespace
**File:** ValidationUtils.js
**Category:** Validation Gap

A field containing only spaces passes required-field validation. This can propagate as employee names like `"   "` to sheets and emails.

**Fix:**
```javascript
if (!field || !String(field).trim()) { missing.push(fieldName); }
```

---

## MEDIUM PRIORITY ISSUES

The following are grouped by theme. All are genuine issues but not blocking.

---

### M1. Non-Strict Boolean Checks in Conditional Workflow Logic
**Files:** HRVerificationHandler.js, PositionChangeHandler.js, and other handlers receiving formData
**Details:** Conditions like `if (hourlyEmployee && !systemAccess)` treat any truthy string (e.g., `"false"`, `"No"`) as true. If form values are strings, wrong workflow paths can be taken.
**Fix:** Use strict equality: `if (hourlyEmployee === true && systemAccess !== true)`.

---

### M2. Sheet Append / Write Operations Do Not Verify Success
**Files:** SheetUtils.js (`addSheetRow()`), ActionItemService.js (`createActionItem()`), multiple handlers
**Details:** `sheet.appendRow(values)` returns the Sheet object (not a success flag), but GAS can silently fail if the sheet is protected or quota is hit. No current logging or error surfacing.
**Fix:** Wrap all sheet writes in try/catch and log failures: `Logger.log('[ERROR] Sheet write failed: ' + e)`.

---

### M3. Missing Null Checks After Sheet Lookups
**Files:** Specialist.js, TerminationHandler.js, ActionItemService.js, multiple handlers
**Details:** `ss.getSheetByName(NAME)` returns `null` if the sheet doesn't exist. Several call sites access the returned value without checking for null, causing crashes.
**Fix:** Add `if (!sheet) throw new Error('Sheet not found: ' + NAME)` after every `getSheetByName()` call.

---

### M4. getWorkflowContext() Called Multiple Times Per Request
**File:** EmailUtils.js, several handlers
**Details:** The same workflow context data is fetched from sheets independently by both the handler and EmailUtils, doubling the sheet API calls per form submission.
**Fix:** Fetch context once in the handler and pass it as a parameter to email utility functions.

---

### M5. Conditional Section Styling — Cascading Validation Not Implemented
**Files:** EmployeeIDSetup.html, TerminationRequest.html, PositionSiteChangeRequest.html
**Details:** When a parent checkbox is unchecked after a child field has been filled, the child value is still submitted. Forms don't reset child fields when the parent condition is deselected.
**Fix:** Add `change` event listeners to parent checkboxes that clear child field values when unchecked.

---

### M6. Chained Ternary Operators and Non-Strict Comparisons in Templates
**Files:** InitialRequest.html (~line 1100), Dashboard.html (~line 550)
**Details:** Complex chained ternaries are harder to maintain and can produce unexpected results when values are undefined vs. null vs. empty string.
**Fix:** Replace with explicit `if/else` blocks for clarity.

---

### M7. fmtDate_() Naming Convention
**File:** TerminationHandler.js
**Details:** The underscore suffix is non-standard and inconsistent with all other functions in the project.
**Fix:** Rename to `formatDate()`.

---

### M8. MigrateColumns.js — EXPECTED_SCHEMA Undefined
**File:** MigrateColumns.js (`previewMissingColumns()`)
**Details:** The function references `EXPECTED_SCHEMA` which does not appear to be defined anywhere in the codebase. This function is dead code or an incomplete implementation.
**Fix:** Either complete the implementation (define the schema) or remove the function.

---

### M9. generateDssUsername() Does Not Handle Special Characters
**File:** IDSetup.js
**Details:** Accented characters (José) and apostrophes (O'Connor) are passed through unchanged. DSS may reject these usernames.
**Fix:** Normalize input: strip accents, replace non-alphanumeric characters with underscores, truncate to max length.

---

### M10. Specialist.js — JR Title Write-Back Hardcoded for 'review' dept Only
**File:** Specialist.js (lines ~110–129)
**Details:** The write-back logic for JR title is an ad-hoc special case rather than a generalized pattern. Any future specialist needing similar write-back behavior requires another special case.
**Fix:** Generalize into a `postSubmitWritebacks` config map keyed by `dept`.

---

### M11. Race Condition — DirectoryAutocomplete Results May Return Out of Order
**File:** DirectoryAutocomplete.html (lines ~80–120)
**Details:** 400ms debounce queues requests but doesn't cancel previous in-flight ones. If an earlier slow response arrives after a newer one, the dropdown reverts to stale results.
**Fix:** Track a request sequence counter; only apply results if the response belongs to the latest request.

---

### M12. DemoWalkthrough.html — Feedback Not Persisted
**File:** DemoWalkthrough.html (line ~353)
**Details:** `saveFeedback()` shows a visual confirmation to the user but does not submit feedback to the server. The button is misleading.
**Fix:** Either wire up a `google.script.run.saveFeedback(data)` call or relabel the button as "Copy to Clipboard" / remove it.

---

### M13. DataManager.html — Delete Operations Are Permanent With No Audit Trail
**File:** DataManager.html (lines ~200–250)
**Details:** Reference data deletions use `window.confirm()` for confirmation but are immediately permanent with no undo and no logging of who deleted what.
**Fix:** Add server-side audit logging for all deletes: `Logger.log('[AUDIT] ' + userEmail + ' deleted record: ' + id)`.

---

### M14. CSV Injection Risk
**Files:** Any form that writes user input to sheets or exports to CSV
**Details:** Values beginning with `=`, `+`, `-`, or `@` are interpreted as formulas by spreadsheet applications when exported.
**Fix:** Prefix cell values with a single quote on write, or use `'` + value pattern in `formatXRequestData()` functions.

---

### M15. isValidEmail() Too Permissive
**File:** ValidationUtils.js
**Details:** Pattern accepts `a@b.c` (single-character TLD). Acceptable as a basic gate but should be documented as "format check only, not deliverability check."
**Fix:** Add a comment documenting the intentional scope of the validation.

---

### M16. validateHireDate() Named Misleadingly
**File:** ValidationUtils.js
**Details:** The function checks calendar days, not business days, but the name and behavior imply business-day awareness.
**Fix:** Rename to `validateHireDateCalendarDays()` or fix the logic to use business days.

---

### M17. sanitizeInput() Misses Event Handler Injection Vectors
**File:** ValidationUtils.js
**Details:** Current implementation strips `<script>`, `<iframe>` tags, but does not neutralize event handlers (`onerror`, `onload`, etc.) in attribute values. Sufficient for data fields but risky if output is ever rendered as HTML.
**Fix:** For any data that ends up in HTML context, encode with full HTML entity escaping (`<` → `&lt;` etc.) rather than tag-stripping.

---

## LOW PRIORITY ISSUES

- **DirectoryAutocomplete.html:** Multiple `console.log/warn` calls with emoji (violates ASCII rule and clutters production logs). Remove or gate behind a `DEBUG` flag.
- **TerminationHandler.js:** `directReports` field is `JSON.parse()`'d without try/catch. Malformed JSON crashes the handler. Wrap in try/catch.
- **PositionChangeHandler.js:** Manager email extraction regex fails silently if format is unexpected. Add validation and a meaningful error return.
- **Router.js comment:** "Access check removed as requested" (repeated 3 times) gives no context — when, by whom, why. Update or remove.
- **WorkflowMap.html:** Back link uses server-side template injection. If `getBaseUrl()` fails, the link renders as literal template syntax. Add a fallback.
- **DemoWalkthrough.html `prefillTestData()` left in production** (EquipmentSystemRequest.html): Test data fill function accessible from the browser. Remove from production build.
- **Global test mode in EmailUtils.js:** `EMAIL_REDIRECT_ALL` modifies all emails in the same request globally. If partial failure occurs mid-batch, some emails are redirected and others aren't. Pass as a parameter instead.
- **Spec forms — `alert()` vs overlay vs toast:** Different forms show errors in different ways (alert(), error div, loading overlay). Standardize to a single pattern.
- **No `type="button"` on toggle buttons in TerminationApproval.html:** Buttons without `type` default to `type="submit"`, which can trigger form submission. Always specify `type="button"` on non-submit buttons.
- **WorkflowManager.js `generateWorkflowId()`:** The 3-digit random suffix range (0–999) is not documented. Add a comment explaining the format.
- **ConfigurationService.js:** Clean and well-structured — no issues. Noted as a reference pattern for other files.
- **Config.js:** Clean and well-structured — no issues.
- **Setup.js:** Clean — no issues.

---

## CSS — CROSS-CUTTING ISSUES

### CSS1. CSS Variables Duplicated Across All 27 HTML Files (Critical Maintenance)
Every file defines its own `:root { --bg-color: ...; --card-bg: ...; ... }` block. Minor variations exist across files (e.g., `--text-muted` is `#a0a0a0` in most files but `#b0b0b0` in EmployeeIDSetup.html; `--success` is `#00c853` in most but `#0f9d58` in a few).

**Fix:** Create a shared `_theme.html` include with all variables and import it via `<?!= include('_theme') ?>`. Remove per-file `:root` blocks. This eliminates ~350 lines of duplication and provides a single source of truth for brand colors.

---

### CSS2. Pervasive Inline Style Attributes
~50+ `style=""` attributes scattered throughout ActionItemForm.html, HRVerification.html, InitialRequest.html, and others. These override stylesheet rules, making theme changes require editing both CSS and HTML.

**Fix:** Extract to semantic CSS classes (`.info-row-spanned`, `.centered-container`, etc.). Remove all inline `style=""` attributes.

---

### CSS3. No Mobile / Responsive Media Queries on Most Forms
Only ITSetup.html and HRVerification.html have `@media (max-width: 768px)` rules. All other forms use two-column grid layouts that overflow on phones and tablets.

**Fix:** Add to the shared theme include:
```css
@media (max-width: 768px) {
  .grid, .form-row { grid-template-columns: 1fr; }
  input, select, textarea { font-size: 16px; } /* prevents zoom on iOS */
  .card { padding: 16px; }
}
```

---

### CSS4. Inconsistent Color Values
Red hover states use `#d11928`, `#d32f2f`, and `#c41522` across files. Gray borders use `#333`, `#444`, `#555` inconsistently. Hard-coded hex values in Dashboard.html for type-filter active states (`#7b2ff7`, `#0097a7`).

**Fix:** Define a complete color palette in the shared theme with semantic tokens:
```css
--red-hover: #c41522;
--purple: #7b2ff7;
--teal: #0097a7;
```

---

### CSS5. Dead / Redundant CSS Rules
- `.badge.pending` and `.badge.in-progress` share identical background colors — one is redundant.
- Several classes defined in stylesheets are overridden by inline `style=""` attributes on the same elements.
- `textarea#notes` uses an ID selector in the stylesheet (over-specific; breaks if the ID changes).

---

### CSS6. Z-Index Has No Defined Scale
Overlays use `z-index: 1000` but there is no shared scale. Future additions (modals, tooltips, drawers) will require guessing or conflicting values.

**Fix:** Define `--z-dropdown: 100; --z-sticky: 500; --z-modal: 1000; --z-overlay: 2000;` in shared theme.

---

### CSS7. Spacing and Border-Radius Inconsistency
Padding values (`8px`, `12px`, `16px`, `20px`, `24px`), gap values, and border-radius values (`4px`, `6px`, `8px`, `12px`) vary without a consistent scale.

**Fix (long-term):** Define a spacing scale: `--space-xs: 4px` through `--space-2xl: 24px`.

---

## DOCUMENTATION — CROSS-CUTTING ISSUES

### D1. 14 JS Files Have No File-Level Header
**Files without file-level headers:** BuilderHandler.js, DashboardHandler.js, DirectoryService.js, EquipmentRequestHandler.js, HRVerificationHandler.js, IDSetup.js, ITSetupHandler.js, InitialRequestHandler.js, LandingPageHandler.js, PositionChangeHandler.js, Setup.js, SheetUtils.js, Specialist.js, StateSync.js, TerminationHandler.js

**Fix:** Add a brief JSDoc block at the top of each:
```javascript
/**
 * Module: TerminationHandler
 * Purpose: Handle termination form submissions, approvals, and downstream notifications
 * Exports (via google.script.run): submitTerminationRequest, approveTermination, rejectTermination
 * Dependencies: CONFIG, EmailUtils, WorkflowManager, ActionItemService
 */
```

---

### D2. ~30+ Public Functions Lack JSDoc
Functions callable via `google.script.run` from the client are effectively a public API. Key examples lacking docs:
- `serveTerminationBuilder()`, `servePositionChangeBuilder()` — BuilderHandler.js
- `getDashboardData()`, `bumpRequest()`, `updateHireDate()`, `getRequestDetails()` — DashboardHandler.js
- `submitEquipmentRequest()`, `formatEquipmentRequestData()` — EquipmentRequestHandler.js
- `createEmailTemplate()`, `getWorkflowContext()` — EmailUtils.js
- `generateDssUsername()`, `getIDSetupRequestData()` — IDSetup.js
- `include()` — LandingPageHandler.js (its purpose as a GAS HtmlTemplate include helper is completely undocumented)

**Fix:** At minimum, add `@param`, `@returns`, `@throws`, and `@sideEffects` tags to all `submit*`, `get*`, and `serve*` functions.

---

### D3. Complex Logic Blocks Without "WHY" Comments
Key examples:
- **ActionItemForm.html:** Recursive JSON parsing loop (up to 3 levels) with no comment explaining why task descriptions get double-stringified in the first place.
- **WorkflowManager.js `syncStatusToRequestSheet()`:** Loops through all 3 origin sheets (Initial, Terminations, Position Changes) without explaining why, or what happens if a workflowId appears in multiple sheets.
- **IDSetup.js:** `var nc = function(val)` — the purpose and name of this helper are completely undocumented.

---

### D4. Magic Numbers Without Context
- `Math.floor(Math.random() * 1000)` in `generateWorkflowId()` — why 1000?
- `attempts < 3` in ActionItemForm.html JSON parsing loop — why 3?
- `slice(0, 27)` in `getTerminationData()` — why 27 columns?
- `padStart(3, '0')` — document the ID format.

---

### D5. Outdated / Placeholder Comments
- Router.js: "Access check removed as requested" (3 occurrences) — no context, no date, no owner.
- The `Status` vs `Current Status` column name fallback in WorkflowManager.js — not explained (legacy sheet compatibility?).

---

### D6. TODO Comments Without Issue Tracking
Three `<!-- TODO BACKEND: -->` comments found in InitialRequest.html and EquipmentSystemRequest.html with no reference to a ticket or timeline. Untracked TODOs tend to remain forever.

**Fix:** Convert to GitHub issues and replace comment with `<!-- TODO: See GH#XX -->`.

---

## FILE-BY-FILE QUICK REFERENCE

| File | Severity | Key Issues |
|------|----------|------------|
| Config.js | None | Clean — reference pattern |
| ConfigurationService.js | None | Clean — reference pattern |
| Setup.js | None | Clean |
| WorkflowManager.js | HIGH | ID collision, linear search, O(n) sheet updates |
| Router.js | HIGH | No param validation, stale URL fallback, outdated comments |
| StateSync.js | MEDIUM | No verify on append, minor perf |
| EmailUtils.js | CRITICAL/HIGH | HTML injection, duplicate safety email, batch no recovery |
| InitialRequestHandler.js | HIGH/MEDIUM | SYNC REQUIRED, hardcoded indices, sparse validation |
| EquipmentRequestHandler.js | MEDIUM | Dedup logic, no ActionItemService guard |
| HRVerificationHandler.js | CRITICAL/HIGH | Duplicate safety email, string booleans, null merge |
| ITSetupHandler.js | HIGH | Hardcoded col indices, no formula injection guard |
| TerminationHandler.js | HIGH/MEDIUM | JSON.parse no try/catch, hardcoded slice, fmtDate_ naming |
| PositionChangeHandler.js | HIGH/MEDIUM | Hardcoded indices, regex no fallback, null email |
| BuilderHandler.js | LOW | No file header, no JSDoc |
| DashboardHandler.js | HIGH | No pagination, bump() no step check, access logging |
| IDSetup.js | CRITICAL/HIGH | Race condition on emp ID, duplicate safety email |
| Specialist.js | MEDIUM | dept not validated, JR write-back hardcoded |
| LandingPageHandler.js | LOW | include() undocumented |
| SheetUtils.js | CRITICAL/HIGH | ID race condition, linear search |
| ValidationUtils.js | MEDIUM | Whitespace not trimmed, sanitize incomplete, naming |
| DirectoryService.js | HIGH | No error handling on API calls |
| MigrateColumns.js | MEDIUM | EXPECTED_SCHEMA undefined — dead code |
| ActionItemService.js | MEDIUM | Sheet null check missing, JSON.parse no guard |
| InitialRequest.html | CRITICAL/HIGH | Template literals, SYNC REQUIRED, gatekeeper no fallback |
| PositionSiteChangeRequest.html | CRITICAL/HIGH | SYNC REQUIRED, conditional validation gaps |
| TerminationRequest.html | CRITICAL | Double submission risk |
| TerminationApproval.html | HIGH | onClick string injection, no type="button" |
| EmployeeIDSetup.html | MEDIUM | Cascading validation missing |
| HRVerification.html | HIGH | onClick string injection, async submit race |
| ITSetup.html | CRITICAL/HIGH | FormData dedup drops checkboxes, hidden ctx fields unvalidated |
| ActionItemForm.html | HIGH | Template literals, dynamic table no error handling |
| Dashboard.html | CRITICAL | Template literals, no pagination |
| RequestDetails.html | HIGH | bump() no confirm, template literals |
| StatusChangeApproval.html | MEDIUM | Conditional email not validated |
| LandingPage.html | HIGH | Missing withFailureHandler |
| DataManager.html | MEDIUM | Delete no audit, tab index unsafe |
| AssetRetrieval.html | MEDIUM | Serial number not verified |
| SafetyOnboarding.html | CRITICAL | Template literals |
| SafetyTermination.html | HIGH | Payload hardcodes true regardless of checkbox |
| Review306090.html | HIGH | JR list async race, submit not disabled during load |
| Jonas.html | LOW | Clean — reference specialist pattern |
| CreditCard.html | LOW | Clean |
| BusinessCards.html | LOW | Clean |
| Fleetio.html | LOW | Clean |
| SiteDocs.html | MEDIUM | Array/string type handling |
| CentralPurchasing.html | HIGH | sitesConfigured editable, no validation |
| DirectoryAutocomplete.html | MEDIUM | Race on out-of-order results, console.log with emoji |
| EquipmentSystemRequest.html | CRITICAL/HIGH | INJECTED_REF_DATA silent failure, prefillTestData() in prod |
| WorkflowMap.html | LOW | Template injection no fallback |
| DemoWalkthrough.html | MEDIUM | Feedback not persisted, hardcoded questions |
| TerminationFormBuilder.html | MEDIUM | JSON export no schema validation |
| PositionSiteChangeFormBuilder.html | MEDIUM | Same as above |

---

## RECOMMENDED ACTION PLAN

### Sprint 1 — Critical Fixes (Address Immediately)
1. **Search and replace all backticks** in `<script>` blocks across all HTML files (C1)
2. **Swap `generateWorkflowId()` and `generateRequestId()` to `Utilities.getUuid()`** (C2)
3. **Wrap `generateEmployeeId()` in `LockService`** (C2)
4. **Sanitize all context values in `createEmailTemplate()`** (C3)
5. **Replace `innerHTML` with `textContent` in all success handlers** (C4)
6. **Audit and consolidate safety onboarding email trigger to single call site** (C5)
7. **Fix ITSetup.html FormData deduplication** to use `getAll()` (C7)
8. **Add timeout wrapper to all `google.script.run` submit calls** (C6)

### Sprint 2 — High Priority (This Sprint)
9. Replace all linear sheet searches with TextFinder (H1)
10. Convert hardcoded column indices to header-based lookups (H2)
11. Add workflowId / dept validation in Router.js (H3)
12. Implement cascading conditional field validation (H4)
13. Disable submit during async reference data loads (H5)
14. Add confirmation + debounce to bump() (H6)
15. Fix HRVerification.html onClick string injection (H7)
16. Add withFailureHandler to all calls missing it (H8)
17. Implement dashboard pagination (H9)
18. Add error handling to DirectoryService API calls (H10)

### Sprint 3 — Medium Priority (Cleanup Sprint)
19. Extract CSS variables to shared `_theme.html` include (CSS1)
20. Remove all inline `style=""` attributes (CSS2)
21. Add mobile media queries via shared include (CSS3)
22. Add file-level JSDoc headers to 14 JS files (D1)
23. Add JSDoc to ~30+ public functions (D2)
24. Document complex logic blocks with "WHY" comments (D3)
25. Fix whitespace trimming in `validateRequiredFields()` (H18)
26. Fix `sanitizeInput()` to use full HTML entity encoding (M17)
27. Add null checks after all `getSheetByName()` calls (M3)
28. Wrap sheet writes in try/catch (M2)
29. Convert TODO comments to tracked issues (D6)
30. Remove `prefillTestData()` from EquipmentSystemRequest.html (Low)

### Backlog / Long-Term
31. Extract system/equipment definitions to DataManager reference data, generate form sections dynamically (eliminates SYNC REQUIRED)
32. Centralize specialist form submit/redirect logic into a shared include
33. Implement server-side pagination for Dashboard_View
34. Implement CSV injection protection on all sheet writes
35. Design token system for spacing and shadow values
36. Add mobile breakpoints to all forms
37. Complete or remove MigrateColumns.js `previewMissingColumns()`

---

*Report generated from 4 parallel review agents. No files were modified during this review.*
