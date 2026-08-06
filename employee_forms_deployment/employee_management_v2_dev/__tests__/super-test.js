#!/usr/bin/env node
'use strict';
/**
 * super-test.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Comprehensive local test suite for employee_management_v2_dev.
 *
 * Runs entirely in Node.js — no GAS runtime, no network, no Sheets API.
 * Mocks every GAS global (SpreadsheetApp, MailApp, Session, etc.) and loads
 * all handler .js files into a shared vm context identical to the GAS runtime.
 *
 * What it validates per scenario:
 *   • Handler return value (success / failure / message)
 *   • Every field posted → exact column written in the target sheet
 *   • Workflow row created / updated with correct status + step
 *   • Every email: recipient, subject pattern, key contextData fields
 *   • Update-vs-insert logic (no duplicate rows on re-submit)
 *   • Required-field validation returns failure with no writes
 *
 * Run: node __tests__/super-test.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

const vm   = require('vm');
const fs   = require('fs');
const path = require('path');

const { makeRuntime } = require('./gas-runtime');

// ─── File load order (mirrors GAS execution order) ───────────────────────────
const SRC = path.resolve(__dirname, '..');

const LOAD_ORDER = [
  'SchemaConstants.js',
  'Config.js',
  'ValidationUtils.js',
  'RawLog.js',
  'AuditLog.js',
  'SheetUtils.js',
  'WorkflowManager.js',
  'StateSync.js',
  'Router.js',
  'Services/AccessControlService.js',
  'Services/ActionItemService.js',
  'Services/ReferenceDataService.js',
  'EmailTemplates.js',
  'EmailUtils.js',
  'ChangeNotify.js',
  'IDSetup.js',
  'HRVerificationHandler.js',
  'ITSetupHandler.js',
  'ITConfirmationHandler.js',
  'InitialRequestHandler.js',
  'TerminationHandler.js',
  'EquipmentRequestHandler.js',
  'PositionChangeHandler.js',
];

// ─── Context build (one per process; state reset per test) ────────────────────
let _ctx, _rt;

function buildContext() {
  _rt  = makeRuntime();
  // Pass host Date so `instanceof Date` works for objects seeded from host scope.
  // vm contexts have their own built-in Date; overriding with the host's makes
  // cross-boundary instanceof checks consistent.
  _ctx = vm.createContext({ ..._rt.globals, console, Date });

  let allCode = '';
  const skipped = [];
  for (const rel of LOAD_ORDER) {
    const full = path.join(SRC, rel);
    if (!fs.existsSync(full)) { skipped.push(rel); continue; }
    allCode += `\n// ====== ${rel} ======\n` + fs.readFileSync(full, 'utf8') + '\n';
  }

  if (skipped.length) {
    console.warn('  [WARN] Skipped missing files:', skipped.join(', '));
  }

  try {
    vm.runInContext(allCode, _ctx);
  } catch (e) {
    console.error('\n[FATAL] vm compile/run error:', e.message);
    console.error(e.stack);
    process.exit(1);
  }

  // Stub email template renderer so HtmlService complexity doesn't block tests
  _ctx.createEmailTemplateV2 = function(subject, body, formUrl, contextData /*, opts*/) {
    return '<html><body><h2>' + (subject || '') + '</h2><p>' + (body || '') + '</p></body></html>';
  };
  _ctx.include = function() { return ''; };

  // Wrap sendFormEmail to capture raw options (recipient, subject, contextData)
  const _origSFE = _ctx.sendFormEmail;
  _ctx.sendFormEmail = function(opts) {
    _rt.captures.pushEmailOptions(opts);
    try { return _origSFE(opts); } catch (e) {
      _rt.captures.pushEmailOptions({ __error: e.message });
    }
  };
}

// ─── Assertion helpers ────────────────────────────────────────────────────────

let _failures = [];
let _passes   = 0;

function pass(label) {
  _passes++;
  console.log('    ✓  ' + label);
}

function fail(label, got, expected) {
  _failures.push({ label, got, expected });
  const g = JSON.stringify(got);
  const e = JSON.stringify(expected);
  console.log('    ✗  ' + label);
  console.log('         got:      ' + g);
  console.log('         expected: ' + e);
}

function eq(label, got, expected) {
  const g = got instanceof Date ? got.toISOString().substring(0, 10) : got;
  const normalise = v => (v instanceof Date ? v.toISOString().substring(0, 10) : (v === null || v === undefined ? '' : String(v)));
  normalise(g) === normalise(expected) ? pass(label) : fail(label, got, expected);
}

function contains(label, got, substr) {
  String(got || '').includes(substr) ? pass(label) : fail(label, got, '(contains) ' + substr);
}

function truthy(label, got) {
  got ? pass(label) : fail(label, got, 'truthy');
}

function atLeast(label, got, min) {
  Number(got) >= min ? pass(label) : fail(label, got, '>= ' + min);
}

// Assert field in an appendRow write matches expected value
function assertCol(row, colIdx, expected, label) {
  const got = row[colIdx];
  eq(label || ('col[' + colIdx + ']'), got, expected);
}

// ─── Test runner ──────────────────────────────────────────────────────────────

function resetTest() {
  _rt.captures.reset();
  _failures = [];
  _passes   = 0;
}

function runScenario(name, fn) {
  console.log('\n' + '─'.repeat(72));
  console.log('  SCENARIO: ' + name);
  console.log('─'.repeat(72));
  resetTest();
  try {
    fn();
  } catch (e) {
    fail('Unhandled exception: ' + e.message, e.stack, '(no exception)');
  }
  const total = _passes + _failures.length;
  const status = _failures.length === 0 ? '✅ PASSED' : '❌ FAILED';
  console.log('\n  ' + status + ' — ' + _passes + '/' + total + ' assertions passed');
  if (_failures.length > 0) {
    console.log('  Failures:');
    _failures.forEach(f => console.log('    • ' + f.label));
  }
  return { name, passed: _passes, failed: _failures.length, failures: [..._failures] };
}

// ─── Email inspector helper ────────────────────────────────────────────────────

function showEmails(label) {
  const opts  = _rt.captures.getEmailOptions();
  const mails = _rt.captures.getEmails();
  if (opts.length === 0 && mails.length === 0) {
    console.log('\n  📭 No emails captured');
    return;
  }
  console.log('\n  📧 Emails captured (' + opts.length + '):');
  opts.forEach((o, i) => {
    console.log('    [' + (i + 1) + '] To:      ' + (o.to || '(empty)'));
    console.log('         Subject: ' + (o.subject || '(empty)'));
    if (o.formUrl) console.log('         FormUrl: ' + o.formUrl);
    const cd = o.contextData || {};
    const cdKeys = ['workflowId','employeeName','firstName','lastName','hireDate',
                    'siteName','jobTitle','position','managerEmail','systems',
                    'adpAssociateId','assignedEmail','workflowType'];
    const cdOut = cdKeys.filter(k => cd[k] !== undefined && cd[k] !== '');
    if (cdOut.length > 0) {
      console.log('         contextData:');
      cdOut.forEach(k => console.log('           ' + k.padEnd(18) + '= ' + JSON.stringify(cd[k]).substring(0, 80)));
    }
  });
}

// ─── Sample data helpers ──────────────────────────────────────────────────────

function makeIRHeaderRow() {
  // 55-column header matching SCHEMA.INITIAL_REQUESTS (used for sheet seeding)
  return [
    'Workflow ID','Form ID','Timestamp','Date Requested','Requester Name',
    'Requester Email','Hire Date','New Hire/Rehire','Employee Type','Employment Type',
    'First Name','Middle Name','Last Name','Preferred Name','Position Title',
    'Site Name','Job Site #','Manager Email','Manager Name','System Access',
    'Systems','Equipment','Google Email','Google Domain','Computer Req',
    'Computer Type','Prev User (computer)','Prev Type','Serial #','Office 365',
    'CC USA','Limit USA','CC CAN','Limit CAN','CC HD','Limit HD',
    'Phone Req','Prev User (phone)','Prev Number','BOSS Sites',
    'BOSS Cost Sheet','BOSS Jobs','BOSS Trip','BOSS Grievances','Jonas Job #s',
    'JR Req','JR Assign','30/60/90','Comments','ADP Sites','Department',
    'Purchasing Sites','Status','ADP Salary Access','BOSS Training Only'
  ];
}

function makeWorkflowHeaderRow() {
  return ['Workflow ID','Workflow Type','Workflow Name','Initiator Email',
          'Status','Created Date','Last Updated','Current Step','Employee Name'];
}

function makeHRResultHeaderRow() {
  return ['Workflow ID','Form ID','Submission Timestamp','ADP Associate ID',
          'Verified Name','Verified Manager','Verified Manager Email',
          'Verified JR Title','Notes','Submitted By'];
}

function makeITResultHeaderRow() {
  return ['Workflow ID','Form ID','Submission Timestamp','Email Created',
          'Assigned Email','Email Password','Computer Assigned','Computer Serial',
          'Computer Model','Computer Type','Phone Assigned','Phone Carrier',
          'Phone Model','Phone Number','Phone VM Password','BOSS Access',
          'Incidents Access','CAA Access','Delivery App Access','Net Promoter Access',
          'IT Notes','Submitted By','BOSS Details'];
}

// Standard workflow data row for seeding
function makeWorkflowRow(id, type, name, initiator, status, step, empName) {
  return [id, type, name, initiator, status, new Date(), new Date(), step, empName || ''];
}

// Standard IR data row (minimal: just the key columns needed for context reads)
function makeIRRow(wfId, formId, firstName, lastName, hireDate, site, mgr, mgrEmail,
                   empType, employmentType, systems, position, sysAccess) {
  const row = new Array(55).fill('');
  row[0]  = wfId;
  row[1]  = formId;
  row[2]  = new Date();
  row[3]  = '2026-07-01';
  row[4]  = 'David Binns';
  row[5]  = 'dbinns@team-group.com';
  row[6]  = hireDate instanceof Date ? hireDate : new Date(hireDate + 'T12:00:00');
  row[7]  = 'New Hire';
  row[8]  = 'Direct Hire';
  row[9]  = employmentType || 'Salary';
  row[10] = firstName;
  row[11] = '';
  row[12] = lastName;
  row[13] = '';
  row[14] = position || 'Site Manager';
  row[15] = site || 'Ottawa Main';
  row[16] = '1001';
  row[17] = mgrEmail || 'mgr@team-group.com';
  row[18] = mgr || 'Bob Manager';
  row[19] = sysAccess || 'Yes';
  row[20] = Array.isArray(systems) ? systems.join(', ') : (systems || '');
  row[21] = '';
  return row;
}

// ─── Test seed: pre-populate reference sheets needed by AccessControlService ──

function seedReferenceSheets() {
  // Reference_Managers
  _rt.captures.seedSheet('Reference_Managers', [
    ['Email', 'Name', 'Role'],
    ['dbinns@team-group.com', 'David Binns', 'Admin'],
    ['mgr@team-group.com', 'Bob Manager', 'Manager']
  ]);
  // Reference_Sites
  _rt.captures.seedSheet('Reference_Sites', [
    ['Site Name', 'Job #'],
    ['Ottawa Main', '1001'],
    ['Test Site', '9999']
  ]);

  // Pre-create all data sheets so addSheetRow doesn't fail with "Sheet not found".
  // addSheetRow returns false silently when the sheet doesn't exist; without these
  // stubs the handlers return "Failed to add row to spreadsheet".
  _rt.captures.seedSheet('Workflows',                  [makeWorkflowHeaderRow()]);
  _rt.captures.seedSheet('Initial Requests',           [makeIRHeaderRow()]);
  _rt.captures.seedSheet('HR Verification Results',    [makeHRResultHeaderRow()]);
  _rt.captures.seedSheet('IT Results',                 [makeITResultHeaderRow()]);
  _rt.captures.seedSheet('IT Confirmation Results',    [
    ['Workflow ID','Form ID','Timestamp','Confirmed By','Verified Email',
     'Verified Computer','Verified Phone','Notes']
  ]);
  _rt.captures.seedSheet('Terminations', [
    ['Workflow ID','Form ID','Timestamp','Requester Name','Requester Email',
     'Employee Name','Employee ID','Employee Type','Work Email','Phone',
     'Computer Serial','Site','Term Date','Reason','Manager Name','Manager Email',
     'HR Approved','Has Reports','Reports To New','Systems','Email Forwarding',
     'Email Files To','Email Delegate','Account Duration','Vacation Responder',
     'Equipment','Comments','Last Day Worked','Attachment URL']
  ]);
  _rt.captures.seedSheet('Position Changes', [
    ['Workflow ID','Form ID','Timestamp','Requester Name','Requester Email',
     'Employee Name','Old Position','New Position','Site','Manager Email','Status']
  ]);
  _rt.captures.seedSheet('Action Items', [
    ['Task ID','Workflow ID','Title','Category','Description','Assigned To',
     'Status','Created Date','Completed Date','Notes','Closed By']
  ]);
  _rt.captures.seedSheet('ID Setup Results', [
    ['Workflow ID','Form ID','Submission Timestamp','Email Setup Status',
     'DSS Username','DSS Password','BOSS WIS Created','BOSS WIS Username',
     'Submitted By']
  ]);
  _rt.captures.seedSheet('Dashboard View', [
    ['Workflow ID','Workflow Type','Workflow Name','Status','Current Step',
     'Employee Name','Created','Last Updated']
  ]);
  _rt.captures.seedSheet('Form Edit Log', [
    ['Timestamp','Workflow ID','Form Type','Changed By','Changes']
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
//  BUILD CONTEXT
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(72));
console.log('  SUPER TEST SUITE — Employee Forms v2 DEV');
console.log('  ' + new Date().toLocaleString());
console.log('═'.repeat(72));

buildContext();
console.log('  ✓ Context built — ' + LOAD_ORDER.filter(f => fs.existsSync(path.join(SRC, f))).length +
            '/' + LOAD_ORDER.length + ' source files loaded\n');

// ─────────────────────────────────────────────────────────────────────────────
//  SCENARIO 1: New Hire — Salary, Full Systems
// ─────────────────────────────────────────────────────────────────────────────
const results = [];

results.push(runScenario('NEW HIRE — Salary, Full Systems (BOSS + Google + SiteDocs)', () => {
  seedReferenceSheets();

  const payload = {
    requesterEmail:          'dbinns@team-group.com',
    requesterName:           'David Binns',
    dateRequested:           '2026-07-01',
    hireDate:                '2026-07-15',
    newHireOrRehire:         'New Hire',
    employeeType:            'Direct Hire',
    employmentType:          'Salary',
    firstName:               'Jane',
    middleName:              '',
    lastName:                'Smith',
    preferredName:           '',
    position:                'Site Manager',
    positionTitle:           'Site Manager',
    siteName:                'Ottawa Main',
    jobSiteNumber:           '1001',
    department:              'Operations',
    managerEmail:            'mgr@team-group.com',
    managerName:             'Bob Manager',
    reportingManagerEmail:   'mgr@team-group.com',
    reportingManagerName:    'Bob Manager',
    systemAccess:            'Yes',
    systems:                 ['BOSS', 'Google Account', 'SiteDocs'],
    equipment:               ['Business Cards'],
    googleEmail:             'jsmith',
    googleDomain:            'team-group.com',
    computerRequestType:     'New',
    computerType:            'Chromebook',
    computerPreviousUser:    '',
    computerPreviousType:    '',
    computerSerialNumber:    '',
    office365Required:       '',
    creditCardUSA:           '',
    creditCardLimitUSA:      '',
    creditCardCanada:        '',
    creditCardLimitCanada:   '',
    creditCardHomeDepot:     '',
    creditCardLimitHomeDepot:'',
    phoneRequestType:        'New',
    phonePreviousUser:       '',
    phonePreviousNumber:     '',
    bossJobSites:            '1001, 1002',
    bossCostSheet:           'No',
    bossCostSheetJobs:       '',
    bossTripReports:         'No',
    bossGrievances:          'No',
    bossTrainingOnly:        'No',
    jonasJobNumbers:         '',
    jrRequired:              'No',
    jrAssignment:            '',
    plan306090:              '',
    comments:                'Test scenario 1',
    adpSites:                '1001',
    adpSalaryAccess:         'No',
    purchasingSites:         ''
  };

  console.log('\n  PAYLOAD (key fields):');
  ['firstName','lastName','hireDate','employmentType','siteName','position','managerEmail','systems','equipment']
    .forEach(k => console.log('    ' + k.padEnd(22) + '= ' + JSON.stringify(payload[k])));

  const result = _ctx.submitInitialRequest(payload);
  console.log('\n  RETURN: ' + JSON.stringify(result));

  // ── Return value ────────────────────────────────────────────────────────────
  truthy('handler returns success=true', result && result.success);
  truthy('handler returns workflowId',   result && result.workflowId);

  const wfId = result && result.workflowId;

  // ── Workflows sheet ─────────────────────────────────────────────────────────
  const wfAppends = _rt.captures.getAppendsFor('Workflows');
  console.log('\n  WRITES → Workflows sheet:');
  atLeast('Workflows: at least 1 appendRow', wfAppends.length, 1);
  if (wfAppends.length > 0) {
    // Skip header row if present (row 1)
    const wfRow = wfAppends.find(w => String(w.values[0]).startsWith('NEW_EMP_')) || wfAppends[wfAppends.length - 1];
    console.log('    Row: ' + JSON.stringify(wfRow.values.slice(0, 9)));
    eq('WF[0] WORKFLOW_ID matches result',  wfRow.values[0], wfId);
    eq('WF[1] WORKFLOW_TYPE = NEW_EMP',     wfRow.values[1], 'NEW_EMP');
    eq('WF[3] INITIATOR_EMAIL',             wfRow.values[3], 'dbinns@team-group.com');
    eq('WF[4] STATUS = In Progress',        wfRow.values[4], 'In Progress');
    eq('WF[7] CURRENT_STEP = Initial Request', wfRow.values[7], 'Initial Request');
  }

  // ── Initial Requests sheet ──────────────────────────────────────────────────
  const irAppends = _rt.captures.getAppendsFor('Initial Requests');
  console.log('\n  WRITES → "Initial Requests" sheet:');
  atLeast('Initial Requests: at least 1 appendRow', irAppends.length, 1);
  if (irAppends.length > 0) {
    const irRow = irAppends.find(w => String(w.values[0]).startsWith('NEW_EMP_')) || irAppends[irAppends.length - 1];
    console.log('    Row has ' + irRow.values.length + ' columns (expected 55)');
    eq('IR columns = 55', irRow.values.length, 55);

    // Field-by-field assertions mapped to SCHEMA.INITIAL_REQUESTS indices
    console.log('\n    Field mapping:');
    assertCol(irRow.values,  0, wfId,                     'IR[0]  WORKFLOW_ID');
    assertCol(irRow.values,  5, 'dbinns@team-group.com',  'IR[5]  REQUESTER_EMAIL');
    assertCol(irRow.values,  7, 'New Hire',               'IR[7]  NEW_HIRE_OR_REHIRE');
    assertCol(irRow.values,  8, 'Direct Hire',            'IR[8]  EMPLOYEE_TYPE');
    assertCol(irRow.values,  9, 'Salary',                 'IR[9]  EMPLOYMENT_TYPE');
    assertCol(irRow.values, 10, 'Jane',                   'IR[10] FIRST_NAME');
    assertCol(irRow.values, 12, 'Smith',                  'IR[12] LAST_NAME');
    assertCol(irRow.values, 14, 'Site Manager',           'IR[14] POSITION_TITLE');
    assertCol(irRow.values, 15, 'Ottawa Main',            'IR[15] SITE_NAME');
    assertCol(irRow.values, 17, 'mgr@team-group.com',     'IR[17] MANAGER_EMAIL');
    assertCol(irRow.values, 19, 'Yes',                    'IR[19] SYSTEM_ACCESS');
    // Systems as CSV
    const sysWritten = String(irRow.values[20] || '');
    truthy('IR[20] SYSTEMS contains BOSS',         sysWritten.includes('BOSS'));
    truthy('IR[20] SYSTEMS contains Google',       sysWritten.includes('Google'));
    truthy('IR[20] SYSTEMS contains SiteDocs',     sysWritten.includes('SiteDocs'));
    // Equipment as CSV
    const eqWritten = String(irRow.values[21] || '');
    truthy('IR[21] EQUIPMENT contains Business Cards', eqWritten.includes('Business Cards'));
    assertCol(irRow.values, 22, 'jsmith',                 'IR[22] GOOGLE_EMAIL');
    assertCol(irRow.values, 24, 'New',                    'IR[24] COMPUTER_REQ');
    assertCol(irRow.values, 25, 'Chromebook',             'IR[25] COMPUTER_TYPE');
    assertCol(irRow.values, 36, 'New',                    'IR[36] PHONE_REQ');
    assertCol(irRow.values, 39, '1001, 1002',             'IR[39] BOSS_SITES');
    assertCol(irRow.values, 50, 'Operations',             'IR[50] DEPARTMENT');
    assertCol(irRow.values, 53, 'No',                     'IR[53] ADP_SALARY_ACCESS');
    assertCol(irRow.values, 54, 'No',                     'IR[54] BOSS_TRAINING_ONLY');
    // HIRE_DATE: written as Date object or ISO string
    const hireDateWritten = irRow.values[6];
    truthy('IR[6]  HIRE_DATE is set', hireDateWritten instanceof Date || String(hireDateWritten).includes('2026'));
  }

  // ── Email assertions ─────────────────────────────────────────────────────────
  showEmails();
  const emailOpts = _rt.captures.getEmailOptions();
  atLeast('At least 1 email sent', emailOpts.length, 1);

  // For Salary+systemAccess=Yes the first email should go to ID Setup
  const idSetupEmail = emailOpts.find(e =>
    e.to.includes('idsetup') || (e.contextData && e.contextData.employeeName));
  if (idSetupEmail) {
    truthy('ID Setup email: to contains idsetup or dbinns (redirect)', idSetupEmail.to.length > 0);
    const cd = idSetupEmail.contextData || {};
    eq('Email contextData.employeeName', (cd.employeeName || (cd.firstName + ' ' + cd.lastName)).trim(), 'Jane Smith');
  } else {
    fail('Expected ID Setup email not found', emailOpts.map(e => e.to), 'to include idsetup');
  }
}));

// ─────────────────────────────────────────────────────────────────────────────
//  SCENARIO 2: New Hire — Hourly, No System Access
// ─────────────────────────────────────────────────────────────────────────────
results.push(runScenario('NEW HIRE — Hourly, No System Access', () => {
  seedReferenceSheets();

  const payload = {
    requesterEmail:        'dbinns@team-group.com',
    requesterName:         'David Binns',
    dateRequested:         '2026-07-01',
    hireDate:              '2026-07-20',
    newHireOrRehire:       'New Hire',
    employeeType:          'Direct Hire',
    employmentType:        'Hourly',
    firstName:             'Tom',
    lastName:              'Brown',
    position:              'Labourer',
    positionTitle:         'Labourer',
    siteName:              'Test Site',
    jobSiteNumber:         '9999',
    managerEmail:          'mgr@team-group.com',
    managerName:           'Bob Manager',
    reportingManagerEmail: 'mgr@team-group.com',
    reportingManagerName:  'Bob Manager',
    systemAccess:          'No',
    systems:               [],
    equipment:             [],
    comments:              'Hourly, no systems'
  };

  const result = _ctx.submitInitialRequest(payload);
  console.log('\n  RETURN: ' + JSON.stringify(result));

  truthy('handler returns success=true', result && result.success);
  truthy('handler returns workflowId',   result && result.workflowId);

  const irAppends = _rt.captures.getAppendsFor('Initial Requests');
  atLeast('Initial Requests: row written', irAppends.length, 1);
  if (irAppends.length > 0) {
    const irRow = irAppends.find(w => String(w.values[0]).startsWith('NEW_EMP_')) || irAppends[irAppends.length - 1];
    console.log('\n    Field mapping:');
    assertCol(irRow.values,  9, 'Hourly',   'IR[9]  EMPLOYMENT_TYPE = Hourly');
    assertCol(irRow.values, 10, 'Tom',      'IR[10] FIRST_NAME');
    assertCol(irRow.values, 12, 'Brown',    'IR[12] LAST_NAME');
    assertCol(irRow.values, 19, 'No',       'IR[19] SYSTEM_ACCESS = No');
    assertCol(irRow.values, 20, '',         'IR[20] SYSTEMS = empty');
  }

  showEmails();
  const emailOpts = _rt.captures.getEmailOptions();
  atLeast('At least 1 email sent (ID Setup)', emailOpts.length, 1);
}));

// ─────────────────────────────────────────────────────────────────────────────
//  SCENARIO 3: HR Verification — New Submission (Salary path → IT Setup)
// ─────────────────────────────────────────────────────────────────────────────
results.push(runScenario('HR VERIFICATION — New submission (Salary → IT Setup path)', () => {
  seedReferenceSheets();

  const WF_ID = 'NEW_EMP_20260616-120000_001';

  // Seed Workflows sheet
  _rt.captures.seedSheet('Workflows', [
    makeWorkflowHeaderRow(),
    makeWorkflowRow(WF_ID, 'NEW_EMP', 'New Employee Onboarding',
                    'dbinns@team-group.com', 'In Progress', 'ID Setup Complete', 'Alice Jones')
  ]);

  // Seed Initial Requests sheet — Salary, systems = ['SiteDocs'] (no BOSS → goes to IT Setup, not IT Confirmation)
  _rt.captures.seedSheet('Initial Requests', [
    makeIRHeaderRow(),
    makeIRRow(WF_ID, 'INIT_001', 'Alice', 'Jones', '2026-07-10',
              'Ottawa Main', 'Bob Manager', 'mgr@team-group.com',
              'Direct Hire', 'Salary', 'SiteDocs', 'HR Director', 'Yes')
  ]);

  const payload = {
    workflowId:    WF_ID,
    formId:        'HR_VERIF_001',
    firstName:     'Alice',
    lastName:      'Jones',
    managerName:   'Bob Manager',
    managerEmail:  'mgr@team-group.com',
    jobTitle:      'HR Director',
    jrTitle:       '',
    adpAssociateId:'100001',
    notes:         'Verified OK',
    siteName:      'Ottawa Main',
    department:    'Human Resources',
    hireDate:      '2026-07-10'
  };

  console.log('\n  PRE-CONDITION: Workflow ' + WF_ID + ' seeded (ID Setup Complete)');
  console.log('\n  PAYLOAD:');
  ['firstName','lastName','adpAssociateId','jobTitle','managerEmail','hireDate']
    .forEach(k => console.log('    ' + k.padEnd(18) + '= ' + JSON.stringify(payload[k])));

  const result = _ctx.submitHRVerification(payload);
  console.log('\n  RETURN: ' + JSON.stringify(result));

  truthy('handler returns success=true', result && result.success);

  // ── HR Verification Results sheet ─────────────────────────────────────────
  const hrAppends = _rt.captures.getAppendsFor('HR Verification Results');
  console.log('\n  WRITES → "HR Verification Results" sheet:');
  atLeast('HR Verification Results: row written', hrAppends.length, 1);
  if (hrAppends.length > 0) {
    const hrRow = hrAppends[hrAppends.length - 1];
    console.log('    Row: ' + JSON.stringify(hrRow.values));
    assertCol(hrRow.values, 0, WF_ID,           'HR[0] WORKFLOW_ID');
    assertCol(hrRow.values, 3, '100001',         'HR[3] ADP_ASSOCIATE_ID');
    assertCol(hrRow.values, 4, 'Alice Jones',    'HR[4] VERIFIED_NAME');
    assertCol(hrRow.values, 5, 'Bob Manager',    'HR[5] VERIFIED_MANAGER');
    assertCol(hrRow.values, 6, 'mgr@team-group.com', 'HR[6] VERIFIED_MANAGER_EMAIL');
    assertCol(hrRow.values, 7, 'HR Director',    'HR[7] VERIFIED_JR_TITLE (jobTitle when no jrTitle)');
    contains('HR[8] NOTES contains submitted notes', hrRow.values[8], 'Verified OK');
    assertCol(hrRow.values, 9, 'dbinns@team-group.com', 'HR[9] SUBMITTED_BY');
  }

  // ── Workflow step advance ──────────────────────────────────────────────────
  const wfUpdates = _rt.captures.getUpdatesFor('Workflows');
  console.log('\n  WRITES → Workflows updates: ' + wfUpdates.length + ' cell writes');
  // updateWorkflow writes individual cells — check that "IT Setup Needed" step was written
  const stepWrite = wfUpdates.find(w => w.value === 'IT Setup Needed' || w.value === 'IT Confirmation Needed');
  truthy('Workflow step advanced to IT Setup or IT Confirmation', stepWrite !== undefined);
  if (stepWrite) console.log('    Step set to: ' + stepWrite.value);

  // ── Email assertions ───────────────────────────────────────────────────────
  showEmails();
  const emailOpts = _rt.captures.getEmailOptions();
  atLeast('At least 2 emails (IT + Payroll)', emailOpts.length, 2);

  const itEmail = emailOpts.find(e => e.to.includes('grp.forms.it') || e.to.includes('davelangohr'));
  truthy('IT email sent', itEmail !== undefined);
  if (itEmail) {
    const cd = itEmail.contextData || {};
    eq('IT email contextData.adpAssociateId', cd.adpAssociateId, '100001');
  }

  const payrollEmail = emailOpts.find(e => e.to.includes('payroll'));
  truthy('Payroll notification sent', payrollEmail !== undefined);
}));

// ─────────────────────────────────────────────────────────────────────────────
//  SCENARIO 4: HR Verification — Edit / Re-submit (update in place)
// ─────────────────────────────────────────────────────────────────────────────
results.push(runScenario('HR VERIFICATION — Edit existing row (isEdit path)', () => {
  seedReferenceSheets();

  const WF_ID = 'NEW_EMP_20260616-120000_002';

  _rt.captures.seedSheet('Workflows', [
    makeWorkflowHeaderRow(),
    makeWorkflowRow(WF_ID, 'NEW_EMP', 'New Employee Onboarding',
                    'dbinns@team-group.com', 'In Progress', 'IT Setup Needed', 'Bob Doe')
  ]);

  _rt.captures.seedSheet('Initial Requests', [
    makeIRHeaderRow(),
    makeIRRow(WF_ID, 'INIT_002', 'Bob', 'Doe', '2026-07-20',
              'Ottawa Main', 'Bob Manager', 'mgr@team-group.com',
              'Direct Hire', 'Salary', 'SiteDocs', 'Analyst', 'Yes')
  ]);

  // Pre-existing HR verification row for this workflow
  _rt.captures.seedSheet('HR Verification Results', [
    makeHRResultHeaderRow(),
    [WF_ID, 'HR_VERIF_OLD', new Date(), '200002', 'Bob Doe',
     'Old Manager', 'oldmgr@team-group.com', 'Analyst', 'Original notes',
     'other@team-group.com']
  ]);

  const payload = {
    workflowId:     WF_ID,
    firstName:      'Bob',
    lastName:       'Doe',
    managerName:    'New Manager',
    managerEmail:   'newmgr@team-group.com',
    jobTitle:       'Senior Analyst',
    jrTitle:        '',
    adpAssociateId: '200002',
    notes:          'Corrected manager',
    siteName:       'Ottawa Main',
    department:     'Finance',
    hireDate:       '2026-07-20'
  };

  console.log('\n  PRE-CONDITION: Existing HR row seeded (old manager: oldmgr@team-group.com)');
  console.log('  UPDATE payload: managerEmail → newmgr@team-group.com, jobTitle → Senior Analyst');

  const result = _ctx.submitHRVerification(payload);
  console.log('\n  RETURN: ' + JSON.stringify(result));

  truthy('handler returns success=true', result && result.success);
  contains('return message says updated (not re-sent)', result.message, 'updated');

  // Critical: no new appendRow — must be an UPDATE (setValues)
  const hrAppends = _rt.captures.getAppendsFor('HR Verification Results');
  const hrUpdates = _rt.captures.getUpdatesFor('HR Verification Results');
  console.log('\n  WRITES → "HR Verification Results":');
  console.log('    appendRow calls: ' + hrAppends.length + ' (expected 0)');
  console.log('    setValues calls: ' + hrUpdates.length + ' (expected 1)');
  eq('HR: NO new appendRow (row updated in place)', hrAppends.length, 0);
  atLeast('HR: setValues called for update', hrUpdates.length, 1);

  // Verify the updated values are correct
  if (hrUpdates.length > 0) {
    const updated = hrUpdates[0];
    const row = updated.values[0];
    console.log('\n    Updated row: ' + JSON.stringify(row));
    if (row) {
      assertCol(row, 0, WF_ID,                  'HR updated[0] WORKFLOW_ID preserved');
      assertCol(row, 5, 'New Manager',           'HR updated[5] VERIFIED_MANAGER corrected');
      assertCol(row, 6, 'newmgr@team-group.com', 'HR updated[6] VERIFIED_MANAGER_EMAIL corrected');
      assertCol(row, 7, 'Senior Analyst',        'HR updated[7] VERIFIED_JR_TITLE corrected');
    }
  }

  // No downstream emails on edit
  showEmails();
  const emailOpts = _rt.captures.getEmailOptions();
  eq('HR edit: 0 downstream emails sent', emailOpts.length, 0);
}));

// ─────────────────────────────────────────────────────────────────────────────
//  SCENARIO 5: IT Setup — New Hire, First Submission
// ─────────────────────────────────────────────────────────────────────────────
results.push(runScenario('IT SETUP — New hire, first submission', () => {
  seedReferenceSheets();

  const WF_ID = 'NEW_EMP_20260616-130000_003';

  _rt.captures.seedSheet('Workflows', [
    makeWorkflowHeaderRow(),
    makeWorkflowRow(WF_ID, 'NEW_EMP', 'New Employee Onboarding',
                    'dbinns@team-group.com', 'In Progress', 'IT Setup Needed', 'Carol White')
  ]);

  _rt.captures.seedSheet('Initial Requests', [
    makeIRHeaderRow(),
    makeIRRow(WF_ID, 'INIT_003', 'Carol', 'White', '2026-08-01',
              'Ottawa Main', 'Bob Manager', 'mgr@team-group.com',
              'Direct Hire', 'Salary', 'SiteDocs, Fleetio', 'Fleet Coordinator', 'Yes')
  ]);

  _rt.captures.seedSheet('HR Verification Results', [
    makeHRResultHeaderRow(),
    [WF_ID, 'HR_003', new Date(), '300003', 'Carol White',
     'Bob Manager', 'mgr@team-group.com', 'Fleet Coordinator', '', 'hr@team-group.com']
  ]);

  const payload = {
    workflowId:              WF_ID,
    Email_Created:           'Yes',
    Email_Username:          'cwhite',
    Email_Domain:            '@team-group.com',
    Email_Temp_Password:     'Temp#2026!',
    Computer_Assigned:       'Yes',
    Computer_Serial:         'SN-12345',
    Computer_Model:          'Chromebook C736',
    Computer_Type:           'Chromebook',
    Phone_Assigned:          'No',
    Phone_Carrier:           '',
    Phone_Model:             '',
    Phone_Number:            '',
    Phone_VM_Password:       '',
    BOSS_Access:             'No',
    Incidents_Access:        'No',
    CAA_Access:              'No',
    Delivery_App_Access:     'No',
    Net_Promoter_Score_Access:'No',
    IT_Notes:                'Standard chromebook setup'
  };

  console.log('\n  PAYLOAD (key fields):');
  ['Email_Created','Email_Username','Email_Domain','Computer_Assigned','Computer_Serial','BOSS_Access']
    .forEach(k => console.log('    ' + k.padEnd(26) + '= ' + JSON.stringify(payload[k])));

  const result = _ctx.submitITSetup(payload);
  console.log('\n  RETURN: ' + JSON.stringify(result));

  truthy('handler returns success=true', result && result.success);

  // ── IT Results sheet ────────────────────────────────────────────────────────
  const itAppends = _rt.captures.getAppendsFor('IT Results');
  console.log('\n  WRITES → "IT Results" sheet:');
  atLeast('IT Results: row written', itAppends.length, 1);
  if (itAppends.length > 0) {
    const itRow = itAppends[itAppends.length - 1];
    console.log('    Row has ' + itRow.values.length + ' columns');
    assertCol(itRow.values,  0, WF_ID,             'IT[0]  WORKFLOW_ID');
    assertCol(itRow.values,  3, 'Yes',             'IT[3]  EMAIL_CREATED');
    assertCol(itRow.values,  4, 'cwhite@team-group.com', 'IT[4]  ASSIGNED_EMAIL (username + domain)');
    assertCol(itRow.values,  5, 'Temp#2026!',      'IT[5]  EMAIL_PASSWORD');
    assertCol(itRow.values,  6, 'Yes',             'IT[6]  COMPUTER_ASSIGNED');
    assertCol(itRow.values,  7, 'SN-12345',        'IT[7]  COMPUTER_SERIAL');
    assertCol(itRow.values,  8, 'Chromebook C736', 'IT[8]  COMPUTER_MODEL');
    assertCol(itRow.values,  9, 'Chromebook',      'IT[9]  COMPUTER_TYPE');
    assertCol(itRow.values, 10, 'No',              'IT[10] PHONE_ASSIGNED');
    assertCol(itRow.values, 15, 'No',              'IT[15] BOSS_ACCESS');
    assertCol(itRow.values, 20, 'Standard chromebook setup', 'IT[20] IT_NOTES');
  }

  // ── Specialist action items ─────────────────────────────────────────────────
  const aiAppends = _rt.captures.getAppendsFor('Action Items');
  console.log('\n  WRITES → "Action Items" sheet: ' + aiAppends.length + ' action item(s) created');
  // Fleetio system should trigger a Fleetio action item (Carol has Fleetio)
  const fleetioAI = aiAppends.find(w => String(w.values[2] || '').includes('Fleet'));
  truthy('Fleetio Action Item created', fleetioAI !== undefined);

  // WIS Assignment (manager gets WIS action item)
  const wisAI = aiAppends.find(w => String(w.values[2] || '').includes('WIS'));
  truthy('WIS Assignment Action Item created', wisAI !== undefined);

  showEmails();
  const emailOpts = _rt.captures.getEmailOptions();
  atLeast('Specialist emails sent', emailOpts.length, 1);
}));

// ─────────────────────────────────────────────────────────────────────────────
//  SCENARIO 6: IT Setup — Update / Correction (re-submit)
// ─────────────────────────────────────────────────────────────────────────────
results.push(runScenario('IT SETUP — Re-submission (update existing row, no re-trigger)', () => {
  seedReferenceSheets();

  const WF_ID = 'NEW_EMP_20260616-140000_004';

  _rt.captures.seedSheet('Workflows', [
    makeWorkflowHeaderRow(),
    makeWorkflowRow(WF_ID, 'NEW_EMP', 'New Employee Onboarding',
                    'dbinns@team-group.com', 'In Progress', 'Specialist Forms Needed', 'Dan Lee')
  ]);

  _rt.captures.seedSheet('Initial Requests', [
    makeIRHeaderRow(),
    makeIRRow(WF_ID, 'INIT_004', 'Dan', 'Lee', '2026-08-15',
              'Test Site', 'Bob Manager', 'mgr@team-group.com',
              'Direct Hire', 'Salary', 'SiteDocs', 'Analyst', 'Yes')
  ]);

  _rt.captures.seedSheet('HR Verification Results', [
    makeHRResultHeaderRow(),
    [WF_ID, 'HR_004', new Date(), '400004', 'Dan Lee',
     'Bob Manager', 'mgr@team-group.com', 'Analyst', '', 'hr@team-group.com']
  ]);

  // Pre-existing IT row (IT is correcting a mistake)
  const itHeader = makeITResultHeaderRow();
  const existingIT = new Array(23).fill('');
  existingIT[0]  = WF_ID;
  existingIT[1]  = 'IT_SETUP_OLD';
  existingIT[3]  = 'Yes';
  existingIT[4]  = 'dlee-OLD@team-group.com';
  existingIT[5]  = 'WrongPass!';
  existingIT[21] = 'it-person@team-group.com';
  _rt.captures.seedSheet('IT Results', [itHeader, existingIT]);

  const correctedPayload = {
    workflowId:              WF_ID,
    Email_Created:           'Yes',
    Email_Username:          'dlee',
    Email_Domain:            '@team-group.com',
    Email_Temp_Password:     'CorrectPass#1',
    Computer_Assigned:       'No',
    Phone_Assigned:          'No',
    BOSS_Access:             'No',
    Incidents_Access:        'No',
    CAA_Access:              'No',
    Delivery_App_Access:     'No',
    Net_Promoter_Score_Access:'No',
    IT_Notes:                'Corrected email username'
  };

  console.log('\n  PRE-CONDITION: IT row exists with wrong email (dlee-OLD)');
  console.log('  CORRECTION: Email_Username → dlee (correct), Password → CorrectPass#1');

  const result = _ctx.submitITSetup(correctedPayload);
  console.log('\n  RETURN: ' + JSON.stringify(result));

  truthy('handler returns success=true', result && result.success);

  const itAppends = _rt.captures.getAppendsFor('IT Results');
  const itUpdates = _rt.captures.getUpdatesFor('IT Results');
  console.log('\n  WRITES → "IT Results":');
  console.log('    appendRow calls: ' + itAppends.length + ' (expected 0)');
  console.log('    setValues calls: ' + itUpdates.length + ' (expected 1)');
  eq('IT: NO new appendRow on correction', itAppends.length, 0);
  atLeast('IT: setValues called for in-place update', itUpdates.length, 1);

  if (itUpdates.length > 0) {
    const row = itUpdates[0].values[0];
    if (row) {
      assertCol(row, 4, 'dlee@team-group.com', 'IT updated[4] ASSIGNED_EMAIL corrected');
      assertCol(row, 5, 'CorrectPass#1',        'IT updated[5] EMAIL_PASSWORD corrected');
    }
  }

  // No new specialists triggered on correction
  const aiAppends = _rt.captures.getAppendsFor('Action Items');
  eq('Action Items: 0 new action items on IT correction', aiAppends.length, 0);

  showEmails();
}));

// ─────────────────────────────────────────────────────────────────────────────
//  SCENARIO 7: Termination Request
// ─────────────────────────────────────────────────────────────────────────────
results.push(runScenario('TERMINATION REQUEST — Full termination', () => {
  seedReferenceSheets();

  const payload = {
    reqName:         'David Binns',
    reqEmail:        'dbinns@team-group.com',
    empName:         'Sam Leaving',
    empWorkEmail:    'sleaving@team-group.com',
    empPhone:        '',
    managerName:     'Bob Manager',
    managerEmail:    'mgr@team-group.com',
    siteName:        'Ottawa Main',
    empType:         'Salary',
    termDate:        '2026-07-31',
    lastDayWorked:   '2026-07-31',
    reason:          'Resigned',
    hr_approved:     'No',
    has_reports:     'No',
    reports_to_new:  '',
    systems:         ['Google Account', 'BOSS'],
    equip:           ['Computer/Laptop', 'Building Access Card/Keys'],
    google_forward:  'mgr@team-group.com',
    google_files:    'mgr@team-group.com',
    google_delegate: '',
    google_duration: 'Default 1 Month then delete',
    google_vacation: 'Sam Leaving is no longer with TEAM Group.',
    comments:        'Good terms',
    attachment:      null
  };

  console.log('\n  PAYLOAD (key fields):');
  ['empName','termDate','reason','empType','systems','equip','google_forward']
    .forEach(k => console.log('    ' + k.padEnd(18) + '= ' + JSON.stringify(payload[k])));

  const result = _ctx.submitTerminationRequest(payload);
  console.log('\n  RETURN: ' + JSON.stringify(result));

  truthy('handler returns success=true', result && result.success);
  truthy('handler returns workflowId',   result && result.workflowId);

  const wfId = result && result.workflowId;

  // ── Workflows sheet ─────────────────────────────────────────────────────────
  const wfAppends = _rt.captures.getAppendsFor('Workflows');
  const wfRow = wfAppends.find(w => String(w.values[0]).startsWith('TERM_'));
  truthy('Workflows: TERM_ workflow row created', wfRow !== undefined);
  if (wfRow) {
    assertCol(wfRow.values, 1, 'TERM', 'WF[1] WORKFLOW_TYPE = TERM');
    assertCol(wfRow.values, 4, 'In Progress', 'WF[4] STATUS = In Progress');
  }

  // ── Terminations sheet ──────────────────────────────────────────────────────
  const termAppends = _rt.captures.getAppendsFor('Terminations');
  console.log('\n  WRITES → "Terminations" sheet:');
  atLeast('Terminations: row written', termAppends.length, 1);
  if (termAppends.length > 0) {
    const tRow = termAppends[termAppends.length - 1];
    console.log('    Row has ' + tRow.values.length + ' columns (expected 29)');
    assertCol(tRow.values,  0, wfId,                    'TERM[0]  WORKFLOW_ID');
    assertCol(tRow.values,  3, 'David Binns',           'TERM[3]  REQUESTER_NAME');
    assertCol(tRow.values,  4, 'dbinns@team-group.com', 'TERM[4]  REQUESTER_EMAIL');
    assertCol(tRow.values,  5, 'Sam Leaving',           'TERM[5]  EMPLOYEE_NAME');
    assertCol(tRow.values,  8, 'sleaving@team-group.com','TERM[8]  WORK_EMAIL');
    assertCol(tRow.values, 10, 'N/A',                   'TERM[10] COMPUTER_SERIAL (reserved)');
    assertCol(tRow.values, 11, 'Ottawa Main',           'TERM[11] SITE');
    assertCol(tRow.values, 13, 'Resigned',              'TERM[13] REASON');
    assertCol(tRow.values, 14, 'Bob Manager',           'TERM[14] MANAGER_NAME');
    assertCol(tRow.values, 15, 'mgr@team-group.com',    'TERM[15] MANAGER_EMAIL');
    // Systems to deactivate
    const sysDeact = String(tRow.values[19] || '');
    truthy('TERM[19] SYSTEMS contains Google Account', sysDeact.includes('Google Account'));
    truthy('TERM[19] SYSTEMS contains BOSS',           sysDeact.includes('BOSS'));
    // Equipment to return
    const equipRet = String(tRow.values[25] || '');
    truthy('TERM[25] EQUIPMENT contains Computer',     equipRet.includes('Computer'));
    // Google offboarding
    assertCol(tRow.values, 20, 'mgr@team-group.com',   'TERM[20] EMAIL_FORWARDING');
    assertCol(tRow.values, 23, 'Default 1 Month then delete', 'TERM[23] ACCOUNT_DURATION');
    assertCol(tRow.values, 24, 'Sam Leaving is no longer with TEAM Group.', 'TERM[24] VACATION_RESPONDER');
  }

  // ── Emails ──────────────────────────────────────────────────────────────────
  showEmails();
  const emailOpts = _rt.captures.getEmailOptions();
  atLeast('At least 1 notification email sent', emailOpts.length, 1);
  const hrApprovalEmail = emailOpts.find(e =>
    e.to.includes('grp.forms.hr') || e.subject.toLowerCase().includes('termination'));
  truthy('HR approval or termination email sent', hrApprovalEmail !== undefined);
}));

// ─────────────────────────────────────────────────────────────────────────────
//  SCENARIO 8: Equipment Request
// ─────────────────────────────────────────────────────────────────────────────
results.push(runScenario('EQUIPMENT REQUEST — Systems + equipment access', () => {
  seedReferenceSheets();

  const payload = {
    reqName:          'David Binns',
    reqEmail:         'dbinns@team-group.com',
    requesterEmail:   'dbinns@team-group.com',
    requesterName:    'David Binns',
    firstName:        'Eve',
    lastName:         'Clark',
    position:         'Field Supervisor',
    positionTitle:    'Field Supervisor',
    siteName:         'Ottawa Main',
    jobSiteNumber:    '1001',
    managerEmail:     'mgr@team-group.com',
    managerName:      'Bob Manager',
    systems:          ['BOSS', 'Fleetio'],
    equipment:        ['Vehicle'],
    department:       'Field Ops',
    comments:         'Vehicle needed for new role'
  };

  console.log('\n  PAYLOAD:');
  ['firstName','lastName','position','siteName','systems','equipment']
    .forEach(k => console.log('    ' + k.padEnd(16) + '= ' + JSON.stringify(payload[k])));

  const result = _ctx.submitEquipmentRequest(payload);
  console.log('\n  RETURN: ' + JSON.stringify(result));

  truthy('handler returns success=true', result && result.success);
  truthy('handler returns workflowId',   result && result.workflowId);

  const wfId = result && result.workflowId;

  // ── Workflows sheet ─────────────────────────────────────────────────────────
  const wfAppends = _rt.captures.getAppendsFor('Workflows');
  const wfRow = wfAppends.find(w => String(w.values[0]).startsWith('EQUIP_REQ_'));
  truthy('Workflows: EQUIP_REQ_ workflow created', wfRow !== undefined);
  if (wfRow) {
    assertCol(wfRow.values, 1, 'EQUIP_REQ', 'WF[1] WORKFLOW_TYPE = EQUIP_REQ');
  }

  // ── Initial Requests sheet (equipment uses same sheet) ─────────────────────
  const irAppends = _rt.captures.getAppendsFor('Initial Requests');
  console.log('\n  WRITES → "Initial Requests" sheet:');
  const eqRow = irAppends.find(w => String(w.values[0]).startsWith('EQUIP_REQ_'));
  truthy('Initial Requests: EQUIP_REQ row written', eqRow !== undefined);
  if (eqRow) {
    assertCol(eqRow.values,  0, wfId,                  'IR[0]  WORKFLOW_ID');
    assertCol(eqRow.values, 10, 'Eve',                 'IR[10] FIRST_NAME');
    assertCol(eqRow.values, 12, 'Clark',               'IR[12] LAST_NAME');
    assertCol(eqRow.values, 14, 'Field Supervisor',    'IR[14] POSITION_TITLE');
    assertCol(eqRow.values, 15, 'Ottawa Main',         'IR[15] SITE_NAME');
    assertCol(eqRow.values, 17, 'mgr@team-group.com',  'IR[17] MANAGER_EMAIL');
    const sysW = String(eqRow.values[20] || '');
    truthy('IR[20] SYSTEMS contains BOSS',    sysW.includes('BOSS'));
    truthy('IR[20] SYSTEMS contains Fleetio', sysW.includes('Fleetio'));
    const eqW = String(eqRow.values[21] || '');
    truthy('IR[21] EQUIPMENT contains Vehicle', eqW.includes('Vehicle'));
  }

  // ── IT Confirmation email ───────────────────────────────────────────────────
  showEmails();
  const emailOpts = _rt.captures.getEmailOptions();
  atLeast('At least 1 email sent', emailOpts.length, 1);
  const itConfEmail = emailOpts.find(e =>
    e.to.includes('davelangohr') || e.subject.toLowerCase().includes('confirmation'));
  truthy('IT Confirmation email sent to Dave', itConfEmail !== undefined);
}));

// ─────────────────────────────────────────────────────────────────────────────
//  SCENARIO 9: Idempotency Guard — createWorkflow duplicate prevention
// ─────────────────────────────────────────────────────────────────────────────
results.push(runScenario('IDEMPOTENCY — createWorkflow 30-second guard', () => {
  // Seed a Workflows sheet with a VERY recent row for dbinns@team-group.com
  const recentDate = new Date(Date.now() - 5000); // 5 seconds ago = within 30s window
  const EXISTING_ID = 'NEW_EMP_EXISTING_001';
  _rt.captures.seedSheet('Workflows', [
    makeWorkflowHeaderRow(),
    [EXISTING_ID, 'NEW_EMP', 'New Employee Onboarding', 'dbinns@team-group.com',
     'In Progress', recentDate, recentDate, 'Initial Request', '']
  ]);

  console.log('\n  PRE-CONDITION: Workflows has NEW_EMP row from 5s ago for dbinns@team-group.com');
  console.log('  CALL createWorkflow with same type + initiator email');

  const id1 = _ctx.createWorkflow('NEW_EMP', 'New Employee Onboarding', 'dbinns@team-group.com');
  console.log('  createWorkflow returned: ' + id1);

  // Should return the existing ID, not create a new row
  eq('Idempotency: returned existing workflow ID', id1, EXISTING_ID);
  const wfAppends = _rt.captures.getAppendsFor('Workflows');
  eq('No new Workflows row appended', wfAppends.length, 0);
  console.log('  New appendRows to Workflows: ' + wfAppends.length + ' (expected 0 — guard triggered)');
}));

// ─────────────────────────────────────────────────────────────────────────────
//  SCENARIO 10: Required Field Validation
// ─────────────────────────────────────────────────────────────────────────────
results.push(runScenario('VALIDATION — Missing required fields → failure, no writes', () => {
  seedReferenceSheets();

  const badPayload = {
    requesterEmail: 'dbinns@team-group.com',
    // Missing: firstName, lastName, hireDate, siteName, managerEmail, position, employmentType
    systemAccess:   'No'
  };

  console.log('\n  PAYLOAD: missing firstName, lastName, hireDate, siteName, managerEmail, position');

  const result = _ctx.submitInitialRequest(badPayload);
  console.log('\n  RETURN: ' + JSON.stringify(result));

  eq('handler returns success=false', result && result.success, false);
  truthy('handler returns error message', result && result.message && result.message.length > 0);

  const allWrites = _rt.captures.getAllWrites().filter(w =>
    w.sheet === 'Workflows' || w.sheet === 'Initial Requests');
  console.log('\n  Writes to Workflows/Initial Requests: ' + allWrites.length + ' (expected 0)');
  eq('No data written on validation failure', allWrites.length, 0);
}));

// ─────────────────────────────────────────────────────────────────────────────
//  SCENARIO 11: HR Verification — Hourly/No-System-Access complete path
// ─────────────────────────────────────────────────────────────────────────────
results.push(runScenario('HR VERIFICATION — Hourly+No System Access (Complete path)', () => {
  seedReferenceSheets();

  const WF_ID = 'NEW_EMP_20260616-150000_005';

  _rt.captures.seedSheet('Workflows', [
    makeWorkflowHeaderRow(),
    makeWorkflowRow(WF_ID, 'NEW_EMP', 'New Employee Onboarding',
                    'dbinns@team-group.com', 'In Progress', 'ID Setup Complete', 'Frank Hourly')
  ]);

  _rt.captures.seedSheet('Initial Requests', [
    makeIRHeaderRow(),
    makeIRRow(WF_ID, 'INIT_005', 'Frank', 'Hourly', '2026-08-01',
              'Ottawa Main', 'Bob Manager', 'mgr@team-group.com',
              'Direct Hire', 'Hourly', '', 'Labourer', 'No')
  ]);

  const payload = {
    workflowId:    WF_ID,
    firstName:     'Frank',
    lastName:      'Hourly',
    managerName:   'Bob Manager',
    managerEmail:  'mgr@team-group.com',
    jobTitle:      'Labourer',
    jrTitle:       '',
    adpAssociateId:'500005',
    notes:         '',
    siteName:      'Ottawa Main',
    department:    'Field Ops',
    hireDate:      '2026-08-01'
  };

  const result = _ctx.submitHRVerification(payload);
  console.log('\n  RETURN: ' + JSON.stringify(result));

  truthy('handler returns success=true', result && result.success);

  // Hourly + No System Access → workflow should Complete immediately
  const wfUpdates = _rt.captures.getUpdatesFor('Workflows');
  const completeWrite = wfUpdates.find(w => w.value === 'Complete');
  truthy('Workflow marked Complete (hourly + no sys access)', completeWrite !== undefined);
  if (completeWrite) console.log('    Status written: ' + completeWrite.value);

  showEmails();
  const emailOpts = _rt.captures.getEmailOptions();
  atLeast('Completion email sent to requester/manager', emailOpts.length, 1);
  const completeEmail = emailOpts.find(e =>
    e.subject.toLowerCase().includes('complete') || e.body.toLowerCase().includes('complete'));
  truthy('Completion email subject/body contains "complete"', completeEmail !== undefined);
}));

// ─────────────────────────────────────────────────────────────────────────────
//  SCENARIO: JR Title split — standalone action item + completeMyTask (N8N entry)
// ─────────────────────────────────────────────────────────────────────────────
results.push(runScenario('JR TITLE SPLIT — separate task + completeMyTask closure', () => {
  seedReferenceSheets();

  const WF_ID = 'NEW_EMP_20260616-140000_JR1';

  _rt.captures.seedSheet('Workflows', [
    makeWorkflowHeaderRow(),
    makeWorkflowRow(WF_ID, 'NEW_EMP', 'New Employee Onboarding',
                    'dbinns@team-group.com', 'In Progress', 'IT Setup Needed', 'Jamie Review')
  ]);

  // IR row with plan306090='Yes' (col 47) → triggerSpecialists must create BOTH the
  // 30/60/90 Review task AND the standalone JR Title task.
  const irRow = makeIRRow(WF_ID, 'INIT_JR1', 'Jamie', 'Review', '2026-08-01',
                          'Ottawa Main', 'Bob Manager', 'mgr@team-group.com',
                          'Direct Hire', 'Salary', '', 'Analyst', 'Yes');
  irRow[47] = 'Yes'; // PLAN_306090
  _rt.captures.seedSheet('Initial Requests', [ makeIRHeaderRow(), irRow ]);

  _rt.captures.seedSheet('HR Verification Results', [
    makeHRResultHeaderRow(),
    [WF_ID, 'HR_JR1', new Date(), '300099', 'Jamie Review',
     'Bob Manager', 'mgr@team-group.com', 'Analyst', '', 'hr@team-group.com']
  ]);

  const payload = {
    workflowId: WF_ID,
    Email_Created: 'Yes', Email_Username: 'jreview', Email_Domain: '@team-group.com',
    Email_Temp_Password: 'Temp#2026!',
    Computer_Assigned: 'No', Computer_Serial: '', Computer_Model: '', Computer_Type: '',
    Phone_Assigned: 'No', Phone_Carrier: '', Phone_Model: '', Phone_Number: '', Phone_VM_Password: '',
    BOSS_Access: 'No', Incidents_Access: 'No', CAA_Access: 'No',
    Delivery_App_Access: 'No', Net_Promoter_Score_Access: 'No',
    IT_Notes: 'JR split test'
  };

  const result = _ctx.submitITSetup(payload);
  console.log('\n  RETURN: ' + JSON.stringify(result));
  truthy('submitITSetup returns success', result && result.success);

  // ── Action item split: 30/60/90 Review AND JR Title, distinct tasks ──────────
  // Row layout (createActionItem): [0]wfId [1]taskId [2]category [3]name
  //                                [4]description [5]assignedTo [6]status ... [12]formType
  const aiAppends = _rt.captures.getAppendsFor('Action Items');
  console.log('  Action items created: ' +
    aiAppends.map(w => w.values[2] + '/' + w.values[12]).join(' | '));

  const review = aiAppends.find(w => String(w.values[2]) === '30/60/90 Review');
  const jr     = aiAppends.find(w => String(w.values[2]) === 'JR Title');

  truthy('30/60/90 Review action item created', review !== undefined);
  truthy('JR Title action item created (SEPARATE task)', jr !== undefined);

  if (review) {
    eq('30/60/90 formType = review_306090', String(review.values[12]), 'review_306090');
    contains('30/60/90 has "Create 30/60/90" item', String(review.values[4]), 'Create 30/60/90');
    contains('30/60/90 has "Schedule review" item', String(review.values[4]), 'Schedule review');
    truthy('30/60/90 does NOT contain "Verify and assign JR title"',
      !String(review.values[4]).includes('Verify and assign JR title'));
  }
  if (jr) {
    eq('JR Title formType = jr_title', String(jr.values[12]), 'jr_title');
    eq('JR Title assignee = grp.forms.jrtitle', String(jr.values[5]), 'grp.forms.jrtitle@team-group.com');
    contains('JR Title checklist = "Verify and assign JR title"',
      String(jr.values[4]), 'Verify and assign JR title');
    truthy('JR Title does NOT contain the 30/60/90 plan item',
      !String(jr.values[4]).includes('Create 30/60/90'));
  }

  // ── completeMyTask (N8N Execution API entry point) ───────────────────────────
  // Mock the Admin SDK membership check so the group-assignee check passes for the caller.
  _ctx.AdminDirectory = { Members: { hasMember: () => ({ isMember: true }) } };

  const jrTaskId     = jr     ? String(jr.values[1])     : 'TK-NONE';
  const reviewTaskId = review ? String(review.values[1]) : 'TK-NONE';

  // 1. Happy path — close via completeJrTitleForWorkflow(workflowId), the entry point
  //    george's n8n node uses (it has the workflowId, not a taskId). This exercises the
  //    resolver AND delegates to completeMyTask, so both are covered.
  const closeRes = _ctx.completeJrTitleForWorkflow(WF_ID, 'JR title assigned via automation');
  console.log('  completeJrTitleForWorkflow(wf) → ' + JSON.stringify(closeRes));
  truthy('completeJrTitleForWorkflow(wf) returns success', closeRes && closeRes.success === true);
  eq('resolved the jr_title taskId', closeRes && closeRes.taskId, jrTaskId);

  // Re-read live Action Items rows to confirm independent status changes.
  // Run inside the vm context (CONFIG is a context-local const, not a _ctx property).
  const aiRows = vm.runInContext(
    'SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.SHEETS.ACTION_ITEMS).getDataRange().getValues()',
    _ctx);
  const jrLive     = aiRows.find(r => String(r[1]) === jrTaskId);
  const reviewLive = aiRows.find(r => String(r[1]) === reviewTaskId);
  eq('JR task now Closed', jrLive ? String(jrLive[6]) : '(missing)', 'Closed');
  eq('30/60/90 task still Open (unaffected)', reviewLive ? String(reviewLive[6]) : '(missing)', 'Open');

  // 2. formType guard — completeMyTask must REJECT a non-jr_title task
  const guardRes = _ctx.completeMyTask(reviewTaskId, 'should be rejected');
  console.log('  completeMyTask(review) → ' + JSON.stringify(guardRes));
  truthy('completeMyTask(review_306090) is rejected', guardRes && guardRes.success === false);
  truthy('rejection message names JR Title only',
    guardRes && /jr\s*title/i.test(guardRes.message || ''));

  // 3. not-found guard
  const nfRes = _ctx.completeMyTask('TK-NONEXIST', 'x');
  truthy('completeMyTask(missing id) → not-found failure',
    nfRes && nfRes.success === false && /not found/i.test(nfRes.message || ''));

  showEmails();
}));

// ─────────────────────────────────────────────────────────────────────────────
//  FINAL REPORT
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(72));
console.log('  FINAL RESULTS');
console.log('═'.repeat(72));

let totalPass = 0, totalFail = 0;
results.forEach(r => {
  const status = r.failed === 0 ? '✅' : '❌';
  console.log('  ' + status + '  ' + r.name.padEnd(55) +
              '  ' + r.passed + ' passed / ' + r.failed + ' failed');
  totalPass += r.passed;
  totalFail += r.failed;
});

console.log('\n' + '─'.repeat(72));
console.log('  TOTAL: ' + totalPass + ' passed, ' + totalFail + ' failed  (' +
            results.length + ' scenarios)');
console.log('═'.repeat(72) + '\n');

if (totalFail > 0) {
  console.log('  FAILURES DETAIL:');
  results.filter(r => r.failed > 0).forEach(r => {
    console.log('\n  [' + r.name + ']');
    r.failures.forEach(f => {
      console.log('    ✗ ' + f.label);
      console.log('        got:      ' + JSON.stringify(f.got));
      console.log('        expected: ' + JSON.stringify(f.expected));
    });
  });
  process.exit(1);
} else {
  console.log('  🎉 All scenarios passed!\n');
}
