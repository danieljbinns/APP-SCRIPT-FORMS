# New Session Prompt — E2E Browser Test for Employee Forms v2

Copy everything below this line and paste it as your first message in the new session.

---

## Context and current status

This is a Google Apps Script web app (`employee_management_v2_dev/`) on the `staging` branch of `P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_deployment`.

**Unit test coverage is already complete and passing (311/311 assertions).** Those tests verify HTML field names → JS data keys → sheet column indices → email contextData keys in a Node.js mock environment. Do not redo that work.

**This session is real E2E browser testing — no mocks, no GAS API shortcuts, no assumptions.**

---

## Target deployment

- **Webapp URL:** `https://script.google.com/a/macros/team-group.com/s/AKfycbzidGiaFety1RaDtHewuMaVKfQ98-sCscMTVS4kvNwfxE6ObOje9wiBT2sWzsSOVRq9JQ/exec`
- **Dev Script ID:** `1VI9tR0GCxwTmcuXiGBzTkDJVXXB94Hr3PpdnuDq-aBpDKKQGMKhA9U_L`
- **Logged-in account:** `dbinns@team-group.com`
- **All emails redirect to:** `dbinns@team-group.com` (EMAIL_REDIRECT_ALL set in dev config)
- **Spreadsheet ID:** Read from `employee_management_v2_dev/Config.js` — look for `SPREADSHEET_ID`

---

## Exact methodology — do this for every form, in order, one workflow at a time

### Step 1 — Open browser and inspect

1. Open the webapp URL in the browser.
2. Open DevTools. Check:
   - Console for any JS errors or warnings on load
   - Network tab — note any failed requests
   - DOM — inspect the form structure: what fields exist, what `name=` attributes are present, what fields are hidden/conditional
3. Record: field list, any errors on load, any fields that appear broken or missing

### Step 2 — If this form pre-populates from a prior sheet row

For forms that load data from a previous workflow step (HRVerification, ITSetup, etc.):
1. Before filling anything, take a snapshot of all pre-populated field values
2. Download the relevant sheet row using the Google Sheets MCP tools (`mcp__google-sheets__get_sheet_data`)
3. Compare pre-populated values in the browser to the sheet row — note every blank field that should have data, every mismatch

### Step 3 — Install the payload interceptor

Paste this in the browser console **before** filling any fields:

```javascript
const _orig = google.script.run;
const _calls = [];
google.script.run = new Proxy(_orig, {
  get(target, prop) {
    return new Proxy(target[prop] || function(){}, {
      apply(fn, thisArg, args) {
        console.log('[CAPTURED google.script.run.' + prop + ']', JSON.stringify(args[0], null, 2));
        _calls.push({ fn: prop, args: JSON.parse(JSON.stringify(args)) });
        return fn.apply(thisArg, args);
      }
    });
  }
});
console.log('Interceptor installed. _calls will have the payload after submit.');
```

### Step 4 — Fill fields via console script

Paste the console fill script for this form (see per-form scripts below). Watch for:
- `NOT FOUND: fieldName` warnings — these mean a field name in the script doesn't match the DOM
- Fields that don't visually update — conditional logic may be blocking them
- Fix any NOT FOUND warnings by inspecting the actual `name=` attribute in the DOM and updating the script

### Step 5 — Submit and capture

1. Click the Submit button
2. From `_calls` in the console, copy the full payload that was sent to the server
3. Record the server response (success/failure, workflowId, any error messages)

### Step 6 — Download sheet row and compare

Using `mcp__google-sheets__get_sheet_data`:
1. Download the headers row of the relevant sheet
2. Download the row that was just written (last row, or find by workflowId)
3. Compare every key in the submitted payload to the corresponding sheet column
4. Record:
   - **Payload key → sheet column MATCH** (expected)
   - **Payload key with no sheet column** (data sent but not written anywhere)
   - **Sheet column blank** (no payload key maps to it — column has no source)
   - **Value mismatch** (payload value ≠ sheet value — transformation happened)

### Step 7 — Download and inspect sent emails

Using GAM (`gam user dbinns@team-group.com print messages ... after:today`) or Gmail MCP tools:
1. Retrieve all emails received at `dbinns@team-group.com` since the form was submitted
2. For each email received:
   - Record: subject, to (original recipient before redirect), timestamp
   - Download full email body
   - Compare every piece of data in the email body to the sheet row
   - Record any template placeholder that was left blank or unfilled
   - Record any data in email body that doesn't match the sheet row

### Step 8 — Open the Dashboard and check the workflow entry

1. Navigate to `[webapp]/exec` (the dashboard)
2. Find the workflow that was just created
3. Open the request details / stepper view
4. Check every field displayed against the sheet row — note any blank or incorrect values
5. Screenshot or record the stepper state (what steps are complete, what is pending)

### Step 9 — Repeat for the next form in the workflow chain

Open the next triggered form (via the action item link in the email OR via the Dashboard). Repeat Steps 1–8 for that form.

---

## Workflow order — do ONE full workflow at a time, all steps, then move to the next

### WORKFLOW A — New Hire (full chain)

Order: InitialRequest (New Hire) → HRVerification → ITSetup → [specialist forms if triggered]

**Form A1 — InitialRequest.html (New Hire)**

Console fill script:
```javascript
(function fillNewHire() {
  const set = (name, val) => {
    const el = document.querySelector(`[name="${name}"]`);
    if (!el) { console.warn('NOT FOUND:', name); return; }
    el.value = val;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('input',  { bubbles: true }));
  };

  set('requesterName',       'E2E Test Requester');
  set('requesterEmail',      'dbinns@team-group.com');
  set('dateRequested',       '2026-06-18');
  set('hireDate',            '2026-07-21');
  set('hireType',            'New Hire');
  set('employeeType',        'Direct Hire');
  set('employmentType',      'Salary');
  set('firstName',           'TestFirst');
  set('middleName',          '');
  set('lastName',            'TestLast');
  set('preferredName',       '');
  set('position',            'Test Analyst');
  set('siteName',            'Ottawa Main');
  set('managerName',         'Alice Manager');
  set('managerEmail',        'dbinns@team-group.com');
  set('systemAccess',        'Yes');
  set('department',          'Technology');
  set('googleEmailLocal',    'testfirsttestl');
  set('googleDomain',        'team-group.com');
  set('computerRequestType', 'New');
  set('computerType',        'Laptop');
  set('phoneRequestType',    'New');
  set('office365Required',   'Yes');
  set('adpSalaryAccess',     'Yes');
  set('bossTrainingOnly',    'No');
  set('plan306090',          'Yes');
  set('comments',            'E2E test submission');

  ['BOSS','Google Account','ADP Supervisor Access','Central Purchasing/Jonas'].forEach(v => {
    document.querySelectorAll('[name="systems[]"]').forEach(el => {
      if (el.value === v) { el.checked = true; el.dispatchEvent(new Event('change',{bubbles:true})); }
    });
  });
  ['Computer','Mobile Phone','Business Cards'].forEach(v => {
    document.querySelectorAll('[name="equipment[]"]').forEach(el => {
      if (el.value === v) { el.checked = true; el.dispatchEvent(new Event('change',{bubbles:true})); }
    });
  });
  console.log('New Hire form filled. Check for NOT FOUND warnings above.');
})();
```

Sheets to check after submit: **Initial Requests** (new row), **Workflows** (new row)

---

**Form A2 — HRVerification.html**

Open from: Dashboard action item OR email link. Verify workflowId is in the hidden field.

Console fill script:
```javascript
(function fillHRV() {
  const set = (name, val) => {
    const el = document.querySelector(`[name="${name}"]`);
    if (!el) { console.warn('NOT FOUND:', name); return; }
    el.value = val;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  console.log('workflowId in form:', document.querySelector('[name="workflowId"]')?.value);

  set('hireDate',       '2026-07-21');
  set('firstName',      'TestFirst');
  set('lastName',       'TestLast');
  set('managerName',    'Alice Manager');
  set('managerEmail',   'dbinns@team-group.com');
  set('jobTitle',       'Test Analyst');
  set('jrTitle',        '');
  set('siteName',       'Ottawa Main');
  set('department',     'Technology');
  set('adpAssociateId', 'ADP-E2E-001');
  set('notes',          'E2E HR verification test');
  console.log('HRV form filled.');
})();
```

Sheets to check after submit: **HR Verification Results** (new row), **Initial Requests** (row updated in-place — firstName, lastName, jobTitle, department columns)

---

**Form A3 — ITSetup.html**

Open from: Dashboard action item OR email link. Verify workflowId in hidden field.

Console fill script:
```javascript
(function fillIT() {
  const set = (name, val) => {
    const el = document.querySelector(`[name="${name}"]`);
    if (!el) { console.warn('NOT FOUND:', name); return; }
    el.value = val;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  console.log('workflowId in form:', document.querySelector('[name="workflowId"]')?.value);

  set('Email_Created',            'Yes');
  set('Email_Username',           'testfirsttestl');
  set('Email_Domain',             '@team-group.com');
  set('Email_Temp_Password',      'TempPass@123');
  set('Computer_Assigned',        'Yes');
  set('Computer_Serial',          'SN-E2E-001');
  set('Computer_Model',           'MacBook Pro 14');
  set('Computer_Type',            'Laptop');
  set('Phone_Assigned',           'Yes');
  set('Phone_Carrier',            'Rogers');
  set('Phone_Model',              'iPhone 15');
  set('Phone_Number',             '613-555-0001');
  set('Phone_VM_Password',        '1234');
  set('BOSS_Access',              'Yes');
  set('Incidents_Access',         'Yes');
  set('CAA_Access',               'No');
  set('Delivery_App_Access',      'No');
  set('Net_Promoter_Score_Access','No');
  set('IT_Notes',                 'E2E IT setup test');
  console.log('IT form filled.');
})();
```

Sheets to check after submit: **IT Results** (new row), **Workflows** (status updated)

Note: The notification email to requester/manager WILL contain the temp password. The specialist emails (credit card, Fleetio, etc.) will NOT contain the temp password — this is expected behaviour, verify it.

---

### WORKFLOW B — Equipment Request

**Form B1 — InitialRequest.html (Equipment Request mode)**

Navigate to the webapp. Switch the form to Equipment Request mode (there will be a toggle, tab, or button — inspect the DOM to find it, then click it before running the fill script).

Console fill script:
```javascript
(function fillEquipReq() {
  const set = (name, val) => {
    const el = document.querySelector(`[name="${name}"]`);
    if (!el) { console.warn('NOT FOUND:', name); return; }
    el.value = val;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  set('requesterName',       'E2E Test Requester');
  set('requesterEmail',      'dbinns@team-group.com');
  set('firstName',           'EquipFirst');
  set('lastName',            'EquipLast');
  set('position',            'Field Supervisor');
  set('siteName',            'Ottawa Main');
  set('managerName',         'Alice Manager');
  set('managerEmail',        'dbinns@team-group.com');
  set('systemAccess',        'Yes');
  set('computerRequestType', 'New');
  set('computerType',        'Laptop');
  set('comments',            'E2E equipment request test');

  document.querySelectorAll('[name="systems[]"]').forEach(el => {
    if (el.value === 'BOSS') { el.checked = true; el.dispatchEvent(new Event('change',{bubbles:true})); }
  });
  document.querySelectorAll('[name="equipment[]"]').forEach(el => {
    if (el.value === 'Computer') { el.checked = true; el.dispatchEvent(new Event('change',{bubbles:true})); }
  });
  console.log('Equipment request form filled.');
})();
```

Sheets to check after submit: **Initial Requests** (new row — workflowId starts EQUIP_REQ_), **Workflows** (new row)

Note: This workflow does NOT trigger HRVerification or ITSetup. Only the initial equipment request email fires.

---

### WORKFLOW C — Termination

**Form C1 — TerminationRequest.html**

Console fill script:
```javascript
(function fillTerm() {
  const set = (name, val) => {
    const el = document.querySelector(`[name="${name}"]`);
    if (!el) { console.warn('NOT FOUND:', name); return; }
    el.value = val;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  set('reqName',        'E2E Test Requester');
  set('reqEmail',       'dbinns@team-group.com');
  set('empName',        'John E2ETest');
  set('empWorkEmail',   'je2etest@team-group.com');
  set('empType',        'Salary');
  set('empPhone',       '613-555-9999');
  set('siteName',       'Ottawa Main');
  set('termDate',       '2026-08-01');
  set('lastDayWorked',  '2026-07-31');
  set('reason',         'Terminated');
  set('hr_approved',    'Pending');
  set('has_reports',    'Yes');
  set('reports_to_new', 'dbinns@team-group.com');
  set('managerName',    'Alice Manager');
  set('managerEmail',   'dbinns@team-group.com');
  set('google_forward', 'Yes');
  set('google_files',   'je2etest-archive');
  set('google_delegate','dbinns@team-group.com');
  set('google_duration','3 Months');
  set('google_vacation','Out of office — contact dbinns@team-group.com');
  set('comments',       'E2E termination test');

  ['Email','BOSS','Google Account'].forEach(v => {
    document.querySelectorAll('[name="systems[]"]').forEach(el => {
      if (el.value === v) { el.checked = true; el.dispatchEvent(new Event('change',{bubbles:true})); }
    });
  });
  ['Laptop','Mobile Phone'].forEach(v => {
    document.querySelectorAll('[name="equip[]"]').forEach(el => {
      if (el.value === v) { el.checked = true; el.dispatchEvent(new Event('change',{bubbles:true})); }
    });
  });
  console.log('Termination form filled.');
})();
```

Sheets to check after submit: **Terminations** (new row — 28 columns), **Workflows** (new row)

Note: termDate in the email body will be formatted as M/d/yyyy (e.g. `8/1/2026`) not ISO format — this is expected behaviour from `fmtDate_()` in TerminationHandler.js.

---

## What to record at every step

For each form:

| # | What | Where | Record |
|---|------|-------|--------|
| 1 | Console errors on load | Browser console | List each error |
| 2 | Pre-populated fields vs sheet row | Form DOM vs Sheets MCP | Every blank/mismatch |
| 3 | NOT FOUND warnings from fill script | Browser console | Each missing field name |
| 4 | Submitted payload | `_calls[0].args[0]` in console | Full JSON |
| 5 | Server response | Console / Network | workflowId, success/error |
| 6 | Sheet row vs payload | Sheets MCP download | Matches, missing columns, blanks |
| 7 | Emails received | GAM or Gmail MCP | Subject, body, data vs sheet |
| 8 | Dashboard stepper | Browser | Fields correct, step status correct |

---

## Important constraints

- **No GAS Execution API calls** — do not call the Apps Script API directly to invoke functions. All testing is through the real browser web app or MCP sheet/email tools only.
- **No assumptions** — if a field is blank, report it as blank. Do not assume it is correct.
- **One workflow at a time** — complete Workflow A fully (all 3 forms + all emails + dashboard check) before starting Workflow B.
- **Dev only** — never touch the prod deployment or the staging script ID (`1A_EPPkI6QW3o39pGuNd74EbLGtqewtByCSi_SBludhLIyn_ShM5YfW-w`).

---

## Files for reference

- `employee_management_v2_dev/Config.js` — SPREADSHEET_ID, EMAIL_REDIRECT_ALL
- `employee_management_v2_dev/InitialRequest.html` — Form A1/B1 HTML
- `employee_management_v2_dev/HRVerification.html` — Form A2 HTML
- `employee_management_v2_dev/ITSetup.html` — Form A3 HTML (read actual field names from this file if fill script has NOT FOUND errors)
- `employee_management_v2_dev/TerminationRequest.html` — Form C1 HTML
- `employee_management_v2_dev/__tests__/form-field-map-test.js` — unit test file with exact column indices for every sheet, for cross-reference
