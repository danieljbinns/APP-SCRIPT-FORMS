# E2E Test Plan — Employee Forms v2 DEV
**Target deployment:** https://script.google.com/a/macros/team-group.com/s/AKfycbzidGiaFety1RaDtHewuMaVKfQ98-sCscMTVS4kvNwfxE6ObOje9wiBT2sWzsSOVRq9JQ/exec
**Script ID:** `1VI9tR0GCxwTmcuXiGBzTkDJVXXB94Hr3PpdnuDq-aBpDKKQGMKhA9U_L`
**Sheet:** The spreadsheet connected to this script (open via Apps Script editor → Resources → or find via CONFIG.SPREADSHEET_ID in Config.js)
**All test emails redirect to:** `dbinns@team-group.com` (EMAIL_REDIRECT_ALL is set in dev)

---

## What already exists (do not redo)

Unit tests in `__tests__/form-field-map-test.js` (311/311 passing) cover:
- Every HTML `name=` attribute → JS data key mapping
- Every JS data key → sheet column index mapping
- Every sheet column → email contextData key mapping

**What unit tests cannot cover:**
- Real GAS execution (clasp push required)
- Actual Google Sheets writes
- Real email delivery and body rendering
- Form pre-population from sheet data on load
- Conditional field show/hide behaviour in browser
- Authentication / access control in live environment

This E2E plan covers everything unit tests cannot.

---

## Setup before starting

1. Confirm latest code is pushed: `clasp push` from `employee_management_v2_dev/`
2. Open the spreadsheet (get URL from Apps Script editor or Config.js `SPREADSHEET_ID`)
3. Have the webapp URL open in a tab logged in as `dbinns@team-group.com`
4. Open Gmail for `dbinns@team-group.com` — all emails redirect here
5. Open Apps Script Execution Log (script editor → View → Logs) in a second tab for server errors

---

## How to fill and capture each form

For every form below:
1. Navigate to the form URL
2. Open browser DevTools → Console
3. Paste the fill script for that form (provided in each section below)
4. Observe the form fields populate
5. Open DevTools → Network tab, filter by `XHR` or `Fetch`
6. Click Submit
7. In Network tab, find the `google.script.run` call — capture the **request payload** (this is what was sent to the server)
8. Record what the server returned (success/failure, workflowId)

---

## WORKFLOW A — New Hire (full chain)

### Form A1: InitialRequest.html — New Hire mode

**URL:** `[webapp]/exec?form=initial_request` (or however the app routes — check Dashboard.html for the link)

**Console fill script:**
```javascript
// Paste in browser console on the InitialRequest.html page
(function fillNewHire() {
  const set = (name, value) => {
    const el = document.querySelector(`[name="${name}"]`);
    if (!el) { console.warn('NOT FOUND:', name); return; }
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('input',  { bubbles: true }));
  };
  const check = (name, value) => {
    document.querySelectorAll(`[name="${name}"]`).forEach(el => {
      el.checked = (el.value === value || value === true);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };

  set('requesterName',        'E2E Test Requester');
  set('requesterEmail',       'dbinns@team-group.com');
  set('dateRequested',        '2026-06-18');
  set('hireDate',             '2026-07-21');
  set('hireType',             'New Hire');
  set('employeeType',         'Direct Hire');
  set('employmentType',       'Salary');
  set('firstName',            'TestFirst');
  set('middleName',           '');
  set('lastName',             'TestLast');
  set('preferredName',        '');
  set('position',             'Test Analyst');
  set('siteName',             'Ottawa Main');   // must exist in Reference_Sites sheet
  set('managerName',          'Alice Manager'); // must exist in Reference_Managers sheet
  set('managerEmail',         'dbinns@team-group.com');
  set('systemAccess',         'Yes');
  set('department',           'Technology');
  set('googleEmailLocal',     'testfirsttestl');
  set('googleDomain',         'team-group.com');
  set('computerRequestType',  'New');
  set('computerType',         'Laptop');
  set('phoneRequestType',     'New');
  set('office365Required',    'Yes');
  set('adpSalaryAccess',      'Yes');
  set('bossTrainingOnly',     'No');
  set('plan306090',           'Yes');
  set('comments',             'E2E test submission');

  // Checkboxes — systems
  ['BOSS', 'Google Account', 'ADP Supervisor Access', 'Central Purchasing/Jonas'].forEach(v => {
    document.querySelectorAll('[name="systems[]"]').forEach(el => {
      if (el.value === v) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  });

  // Checkboxes — equipment
  ['Computer', 'Mobile Phone', 'Business Cards'].forEach(v => {
    document.querySelectorAll('[name="equipment[]"]').forEach(el => {
      if (el.value === v) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  });

  console.log('✓ New Hire form filled');
})();
```

**After submit — check these:**

| Check | Where | What to verify |
|-------|-------|----------------|
| Return value | Console / Network response | `{ success: true, workflowId: 'NEW_EMP_...' }` |
| Workflows sheet | Row added | workflowId, type='NEW_EMP', status='ID Setup Needed' |
| Initial Requests sheet | Row added | All 55 columns — compare to what was submitted field by field |
| Email received | Gmail | At least 1 email to `dbinns@team-group.com` — check subject, check body has employee name/site/hire date |
| Columns with no data | Initial Requests row | Note any column that is blank unexpectedly |

**Record the `workflowId`** — needed for all subsequent forms in this chain.

---

### Form A2: HRVerification.html

**URL:** Open from Dashboard or `[webapp]/exec?form=hr_verification&wf=[workflowId]`

**On page load — check:**
- Employee name pre-populated from Initial Requests sheet
- Hire date pre-populated
- Site, manager pre-populated

**Note any blank fields that should have data.**

**Console fill script:**
```javascript
(function fillHRV() {
  const set = (name, val) => {
    const el = document.querySelector(`[name="${name}"]`);
    if (!el) { console.warn('NOT FOUND:', name); return; }
    el.value = val;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  // workflowId should already be in the hidden field — verify it
  console.log('workflowId:', document.querySelector('[name="workflowId"]')?.value);

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
  console.log('✓ HRV form filled');
})();
```

**After submit — check these:**

| Check | Where | What to verify |
|-------|-------|----------------|
| HR Verification Results sheet | Row added | adpAssociateId, verified name, jobTitle |
| Initial Requests sheet | Row updated | IR[10]=firstName, IR[12]=lastName, IR[14]=jobTitle, IR[50]=department updated in place |
| Email received | Gmail | Check subject (should route to IT Setup or IT Confirmation depending on systems) |
| Email body | Gmail | Employee name, job title, ADP ID visible |

---

### Form A3: ITSetup.html

**URL:** Open from Dashboard or action item link in email

**On page load — check:**
- Employee name, hire date, systems visible
- BOSS section shows if BOSS was in systems
- Computer/phone request types pre-populated

**Note any blank fields that should have data from IR sheet.**

**Console fill script:**
```javascript
(function fillIT() {
  const set = (name, val) => {
    const el = document.querySelector(`[name="${name}"]`);
    if (!el) { console.warn('NOT FOUND:', name); return; }
    el.value = val;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  console.log('workflowId:', document.querySelector('[name="workflowId"]')?.value);

  set('Email_Created',       'Yes');
  set('Email_Username',      'testfirsttestl');
  set('Email_Domain',        '@team-group.com');
  set('Email_Temp_Password', 'TempPass@123');
  set('Computer_Assigned',   'Yes');
  set('Computer_Serial',     'SN-E2E-001');
  set('Computer_Model',      'MacBook Pro 14');
  set('Computer_Type',       'Laptop');
  set('Phone_Assigned',      'Yes');
  set('Phone_Carrier',       'Rogers');
  set('Phone_Model',         'iPhone 15');
  set('Phone_Number',        '613-555-0001');
  set('Phone_VM_Password',   '1234');
  set('BOSS_Access',         'Yes');
  set('Incidents_Access',    'Yes');
  set('CAA_Access',          'No');
  set('Delivery_App_Access', 'No');
  set('Net_Promoter_Score_Access', 'No');
  set('IT_Notes',            'E2E IT setup test');
  console.log('✓ IT form filled');
})();
```

**After submit — check these:**

| Check | Where | What to verify |
|-------|-------|----------------|
| IT Results sheet | Row added | assignedEmail=testfirsttestl@team-group.com, password, computer, phone |
| Email to requester | Gmail | IT Setup Complete — has assigned email, temp password visible |
| Specialist emails | Gmail | Credit card, Fleetio, etc. — passwords NOT visible in specialist emails |
| Workflow step | Workflows sheet | Status updated to 'Specialist Forms Needed' |

---

## WORKFLOW B — Equipment Request

### Form B1: InitialRequest.html — Equipment Request mode

Same URL as A1 but form is in equipment mode (different submit path triggers `submitEquipmentRequest`).

**Console fill script:**
```javascript
(function fillEquipReq() {
  const set = (name, val) => {
    const el = document.querySelector(`[name="${name}"]`);
    if (!el) { console.warn('NOT FOUND:', name); return; }
    el.value = val;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  // Switch to equipment mode first — find the toggle/radio
  const modeEl = document.querySelector('[name="requestMode"][value="equipment"]') ||
                 document.getElementById('equipmentModeBtn');
  if (modeEl) { modeEl.click(); console.log('Switched to equipment mode'); }

  set('requesterName',      'E2E Test Requester');
  set('requesterEmail',     'dbinns@team-group.com');
  set('firstName',          'EquipFirst');
  set('lastName',           'EquipLast');
  set('position',           'Field Supervisor');
  set('siteName',           'Ottawa Main');
  set('managerName',        'Alice Manager');
  set('managerEmail',       'dbinns@team-group.com');
  set('systemAccess',       'Yes');
  set('computerRequestType','New');
  set('computerType',       'Laptop');
  set('comments',           'E2E equipment request test');

  document.querySelectorAll('[name="systems[]"]').forEach(el => {
    if (el.value === 'BOSS') { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  document.querySelectorAll('[name="equipment[]"]').forEach(el => {
    if (el.value === 'Computer') { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  console.log('✓ Equipment request form filled');
})();
```

**After submit — check these:**

| Check | Where | What to verify |
|-------|-------|----------------|
| Return value | Console | `{ success: true, workflowId: 'EQUIP_REQ_...' }` |
| Initial Requests sheet | Row added | workflowId starts EQUIP_REQ_, IR[7] blank (no hire type), IR[15]=Ottawa Main |
| Email received | Gmail | Equipment Request email — check no hireDate/employeeType fields appear |

---

## WORKFLOW C — Termination

### Form C1: TerminationRequest.html

**URL:** `[webapp]/exec?form=termination_request`

**Console fill script:**
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

  ['Email', 'BOSS', 'Google Account'].forEach(v => {
    document.querySelectorAll('[name="systems[]"]').forEach(el => {
      if (el.value === v) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  });
  ['Laptop', 'Mobile Phone'].forEach(v => {
    document.querySelectorAll('[name="equip[]"]').forEach(el => {
      if (el.value === v) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  });
  console.log('✓ Termination form filled');
})();
```

**After submit — check these:**

| Check | Where | What to verify |
|-------|-------|----------------|
| Terminations sheet | Row added | 28 columns, all google fields present |
| Email to HR | Gmail | Subject 'HR Approval Required', termDate formatted as M/d/yyyy |
| Email to Payroll | Gmail | Advance notification email |
| workflowId | Console | Starts with `TERM_` |

---

## Cross-cutting checks (do for every form)

After each submission, run this in the console to capture what was actually sent:

```javascript
// Run BEFORE submitting — intercepts google.script.run calls
const _orig = google.script.run;
const _calls = [];
google.script.run = new Proxy(_orig, {
  get(target, prop) {
    return new Proxy(target[prop] || function(){}, {
      apply(fn, thisArg, args) {
        console.log('[CAPTURED google.script.run.' + prop + ']', JSON.stringify(args[0], null, 2));
        _calls.push({ fn: prop, args });
        return fn.apply(thisArg, args);
      }
    });
  }
});
console.log('✓ google.script.run interceptor installed');
```

Paste this **before** running the fill script. After submit, `_calls` in the console has the exact payload sent to the server.

---

## What to document for each form

For each form, record:

1. **Fields that didn't populate on load** (expected from sheet, came up blank)
2. **Fields not submitted** (visible in form, not in captured payload)
3. **Payload keys with no sheet column** (sent to server but written nowhere)
4. **Sheet columns that stayed blank** (no form field maps to them)
5. **Emails triggered** (list each: to, subject, did body match context)
6. **Email fields that were blank** (key in template but empty string in context)

---

## Current unit test coverage for reference

The unit tests (`node __tests__/form-field-map-test.js`) give exact expected column/key mappings. Use them as a reference when comparing captured payloads to sheet writes. If something doesn't match, the unit test shows what the code *should* do — the E2E run shows what it *actually* does in the live environment.

311/311 assertions passing as of 2026-06-18.
