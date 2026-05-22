# Browser Test Spec — Dev Only
# Run against: https://script.google.com/a/team-group.com/macros/s/AKfycbyKdavUuqgt2zRFxxbRgwSbqru_3HLxk5oEYUauBukRL2CZ28bwZtYUZhubs3d3NoMnUQ/dev

## How to run
Executed by the autonomous test loop agent using Chrome MCP tools.
Read this file at the start of the browser review phase and follow each test case.
After each test, record PASS/FAIL with a short note.
At the end, emit a structured JSON summary.

---

## Setup

1. Navigate to the /dev URL above
2. Open DevTools console — switch context to `userHtmlFrame` if the page is served in an iframe
3. Clear console before each page load
4. All tests run as the authenticated Google user (dbinns@robinsonsolutions.com or similar)

---

## TC-01: Dashboard loads clean

**URL:** /dev (default route → dashboard)

Checks:
- [ ] Page renders without blank screen or spinner stuck
- [ ] Workflow rows visible in table (at least 1 row)
- [ ] "My Pending Tasks" panel visible
- [ ] Console: zero errors (warnings OK)
- [ ] No "undefined" text visible anywhere on page
- [ ] Theme switcher accessible (gear/settings icon or similar)

---

## TC-02: Requester auto-fill — Initial Request form

**URL:** /dev?page=initial_request (or navigate via "New Hire" button on dashboard/landing)

Checks:
- [ ] Page loads, form visible
- [ ] `Requester Email` field auto-populates with logged-in user's email (NOT empty)
- [ ] `Requester Name` field auto-populates with logged-in user's **full name** (NOT "Unknown User", NOT just email prefix like "dbinns")
- [ ] Console: no errors during load
- [ ] Console: no "Could not fetch user name" errors (this would mean Admin SDK still failing)

---

## TC-03: Directory autocomplete — manager field — Initial Request

**On the Initial Request form (from TC-02):**

Checks:
- [ ] Manager Email field is present
- [ ] Type "rus" into manager email field
- [ ] Wait up to 3 seconds
- [ ] Dropdown appears with at least 1 result
- [ ] Each result shows a name + email (not just email)
- [ ] Click a result → manager email field populates with email, manager name field populates with full name
- [ ] Field locks to readonly after selection (can't type in it freely)
- [ ] "✕ Clear selection" link appears
- [ ] Click "✕ Clear selection" → fields reset, field unlocks
- [ ] Console: no errors throughout

Failure modes to watch for:
- Dropdown never appears → `searchDirectoryUsers` returning [] (Admin SDK or People API failure)
- Dropdown appears but names are blank → API returning users without name fields
- Dropdown appears, results show, but name field doesn't populate → onSelect handler bug

---

## TC-04: Directory autocomplete — Termination Request form

**URL:** /dev?page=termination (or navigate via dashboard)

Checks:
- [ ] Requester name auto-fills with full name (not "Unknown User")
- [ ] Employee name field (the person being terminated) — if it has directory lookup, test same as TC-03
- [ ] Manager field directory search works (type 3 chars, dropdown appears)
- [ ] Console: no errors

---

## TC-05: Directory autocomplete — Position Change Request form

**URL:** /dev?page=position_change

Checks:
- [ ] Requester name auto-fills with full name
- [ ] Current Manager field: directory search works
- [ ] New Manager field: directory search works (separate autocomplete instance)
- [ ] Selecting from one dropdown doesn't affect the other
- [ ] Console: no errors

---

## TC-06: Equipment Request form

**URL:** /dev?page=equipment_request

Checks:
- [ ] Requester name auto-fills with full name
- [ ] Manager field directory search works
- [ ] Console: no errors

---

## TC-07: Dashboard modal — equipment request IT Confirmation view data

**On dashboard:**

Checks:
- [ ] Find any EQUIP_REQ_ workflow row, click it
- [ ] Modal opens showing request details
- [ ] IT Confirmation step is listed in the checklist
- [ ] Click "View Data" on IT Confirmation step
- [ ] Popout shows: System Access, Systems, Equipment, Submitted By
- [ ] Equipment field is NOT empty
- [ ] "Submitted By" is NOT the only field shown (original bug regression check)
- [ ] Console: no errors

---

## TC-08: Request Details page — full render check

**Navigate to Request Details for any active new hire workflow:**

Checks:
- [ ] Page loads with header section (employee name, dates)
- [ ] Flow diagram renders with step nodes
- [ ] Checklist/steps list renders
- [ ] All step nodes have correct status indicators (complete/pending/active)
- [ ] "View Data" buttons present on completed steps
- [ ] Click "View Data" on Initial Request step → popout shows data (not empty)
- [ ] Console: no errors
- [ ] No "undefined" or "[object Object]" visible in rendered content

---

## TC-09: Console clean sweep — all pages

After running TC-01 through TC-08, review the console for:
- [ ] Any `Uncaught TypeError` 
- [ ] Any `ReferenceError` (undefined variables)
- [ ] Any failed `google.script.run` calls (shown as `withFailureHandler` fires)
- [ ] Any 404s for included resources
- [ ] Any CSP violations

---

## TC-10: Theme / Easter egg smoke test

**On dashboard:**
- [ ] Enter Konami code: ↑↑↓↓←→←→BA
- [ ] Theme panel opens
- [ ] Select any theme (e.g. LOTR)
- [ ] Theme applies visually
- [ ] No JS errors in console
- [ ] Press Escape or click outside → panel closes
- [ ] Theme resets or stays applied cleanly (no broken layout)

---

## Output Format

After completing all tests, emit:

```json
{
  "browserTests": {
    "TC-01": { "pass": true/false, "notes": "..." },
    "TC-02": { "pass": true/false, "notes": "..." },
    "TC-03": { "pass": true/false, "notes": "..." },
    "TC-04": { "pass": true/false, "notes": "..." },
    "TC-05": { "pass": true/false, "notes": "..." },
    "TC-06": { "pass": true/false, "notes": "..." },
    "TC-07": { "pass": true/false, "notes": "..." },
    "TC-08": { "pass": true/false, "notes": "..." },
    "TC-09": { "pass": true/false, "notes": "..." },
    "TC-10": { "pass": true/false, "notes": "..." },
    "totalPass": N,
    "totalFail": N,
    "consoleErrors": ["list any errors found"]
  }
}
```

Any TC with `pass: false` is a blocker — fix before emailing completion.
