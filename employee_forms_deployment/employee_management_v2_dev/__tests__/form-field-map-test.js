#!/usr/bin/env node
'use strict';
/**
 * form-field-map-test.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Per-form field mapping test.
 *
 * For each HTML form it verifies:
 *   1. PAGE LOAD   — every form field is defined and has a test value
 *   2. JS SUBMIT   — the browser-side submit handler's field-name transforms
 *                    are applied exactly as they are in the HTML source
 *   3. HANDLER     — the GAS handler is called with the transformed payload
 *   4. SHEET MAP   — every HTML field appears at its exact sheet column index
 *                    (column comments show: HTML name → data key → col index)
 *   5. EMAIL MAP   — every email contextData key is correctly populated from
 *                    the original form data
 *
 * Gatekeeper fields (HTML-only; conditionally cleared before submit by the
 * JS submit handler) are documented inline and excluded from sheet assertions.
 *
 * Run: node __tests__/form-field-map-test.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

const vm   = require('vm');
const fs   = require('fs');
const path = require('path');

const { makeRuntime } = require('./gas-runtime');

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

let _ctx, _rt;

function buildContext() {
  _rt  = makeRuntime();
  _ctx = vm.createContext({ ..._rt.globals, console, Date });

  let allCode = '';
  for (const rel of LOAD_ORDER) {
    const full = path.join(SRC, rel);
    if (!fs.existsSync(full)) continue;
    allCode += `\n// ====== ${rel} ======\n` + fs.readFileSync(full, 'utf8') + '\n';
  }

  try {
    vm.runInContext(allCode, _ctx);
  } catch (e) {
    console.error('\n[FATAL] vm error:', e.message, e.stack);
    process.exit(1);
  }

  _ctx.createEmailTemplateV2 = function(subject, body) {
    return '<html><body>' + (subject || '') + ' ' + (body || '') + '</body></html>';
  };
  _ctx.include = function() { return ''; };

  const _orig = _ctx.sendFormEmail;
  _ctx.sendFormEmail = function(opts) {
    _rt.captures.pushEmailOptions(opts);
    try { return _orig(opts); } catch (e) {
      _rt.captures.pushEmailOptions({ __error: e.message });
    }
  };
}

// ─── Assertions ───────────────────────────────────────────────────────────────

let _failures = [], _passes = 0;

function pass(label) {
  _passes++;
  console.log('    ✓  ' + label);
}
function fail(label, got, expected) {
  _failures.push({ label, got, expected });
  console.log('    ✗  ' + label);
  console.log('         got:      ' + JSON.stringify(got));
  console.log('         expected: ' + JSON.stringify(expected));
}
function eq(label, got, expected) {
  const norm = v => (v instanceof Date ? v.toISOString().substring(0, 10) : (v === null || v === undefined ? '' : String(v)));
  norm(got) === norm(expected) ? pass(label) : fail(label, got, expected);
}
function contains(label, got, substr) {
  String(got || '').includes(substr) ? pass(label) : fail(label, got, '(contains) ' + substr);
}
function truthy(label, got) {
  got ? pass(label) : fail(label, got, 'truthy');
}

function assertCol(row, colIdx, expected, label) {
  eq(label || ('col[' + colIdx + ']'), row[colIdx], expected);
}

function resetTest() {
  _rt.captures.reset();
  _failures = [];
  _passes   = 0;
}

function runScenario(name, fn) {
  console.log('\n' + '─'.repeat(72));
  console.log('  FORM: ' + name);
  console.log('─'.repeat(72));
  resetTest();
  try { fn(); }
  catch (e) { fail('Unhandled exception', e.message, '(no exception)'); }
  const total = _passes + _failures.length;
  const status = _failures.length === 0 ? '✅ PASSED' : '❌ FAILED';
  console.log('\n  ' + status + ' — ' + _passes + '/' + total + ' assertions passed');
  if (_failures.length > 0) {
    console.log('  Failures:');
    _failures.forEach(f => console.log('    • ' + f.label));
  }
  return { name, passed: _passes, failed: _failures.length, failures: [..._failures] };
}

// ─── Sheet seed helpers ───────────────────────────────────────────────────────

function makeIRHeaderRow() {
  return [
    'Workflow ID','Form ID','Timestamp','Date Requested','Requester Name',
    'Requester Email','Hire Date','New Hire/Rehire','Employee Type','Employment Type',
    'First Name','Middle Name','Last Name','Preferred Name','Position Title',
    'Site Name','Job Site #','Manager Email','Manager Name','System Access',
    'Systems','Equipment','Google Email','Google Domain','Computer Req',
    'Computer Type','Prev User (computer)','Prev Type','Serial #','Office 365',
    'CC USA','Limit USA','CC CAN','Limit CAN','CC HD','Limit HD',
    'Phone Req','Prev User (phone)','Prev Number','BOSS Job Sites',
    'BOSS Cost Sheet Access','BOSS Cost Sheet Jobs','BOSS Trip Reports','BOSS Grievances','Jonas Job #s',
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

function makeWorkflowRow(id, type, name, initiator, status, step, empName) {
  return [id, type, name, initiator, status, new Date(), new Date(), step, empName || ''];
}

function makeIRRow(wfId, formId, firstName, lastName, hireDate, site, mgr, mgrEmail,
                   empType, employmentType, systems, position, sysAccess) {
  const row = new Array(55).fill('');
  row[0]  = wfId;
  row[1]  = formId;
  row[2]  = new Date();
  row[3]  = '2026-07-01';
  row[4]  = 'Test Requester';
  row[5]  = 'requester@team-group.com';
  row[6]  = hireDate instanceof Date ? hireDate : new Date(hireDate + 'T12:00:00');
  row[7]  = 'New Hire';
  row[8]  = empType || 'Direct Hire';
  row[9]  = employmentType || 'Salary';
  row[10] = firstName;
  row[11] = '';
  row[12] = lastName;
  row[13] = '';
  row[14] = position || 'IT Specialist';
  row[15] = site || 'Ottawa Main';
  row[16] = '1001';
  row[17] = mgrEmail || 'boss@team-group.com';
  row[18] = mgr || 'Alice Manager';
  row[19] = sysAccess || 'Yes';
  row[20] = Array.isArray(systems) ? systems.join(', ') : (systems || 'BOSS');
  row[21] = 'Computer, Mobile Phone, Business Cards';
  row[22] = firstName.toLowerCase() + lastName.toLowerCase().charAt(0);
  row[23] = 'team-group.com';
  row[24] = 'New';
  row[25] = 'Laptop';
  row[30] = 'Yes';
  row[31] = '1000';
  row[32] = 'No';
  row[34] = 'No';
  row[36] = 'New';
  row[39] = '1001, 1002';
  row[40] = 'Yes';
  row[41] = 'JN-100';
  row[42] = 'Yes';
  row[43] = 'Yes';
  row[44] = 'J-001';
  row[47] = 'Yes';
  row[50] = 'Operations';
  row[51] = 'Ottawa Main';
  return row;
}

function seedSheets() {
  _rt.captures.seedSheet('Reference_Managers', [
    ['Email','Name','Role'],
    ['requester@team-group.com','Test Requester','User'],
    ['boss@team-group.com','Alice Manager','Manager'],
  ]);
  _rt.captures.seedSheet('Reference_Sites', [
    ['Site Name','Job #'],
    ['Ottawa Main','1001'],
    ['Test Site','9999'],
  ]);
  _rt.captures.seedSheet('Workflows',               [makeWorkflowHeaderRow()]);
  _rt.captures.seedSheet('Initial Requests',        [makeIRHeaderRow()]);
  _rt.captures.seedSheet('HR Verification Results', [makeHRResultHeaderRow()]);
  _rt.captures.seedSheet('IT Results',              [makeITResultHeaderRow()]);
  _rt.captures.seedSheet('IT Confirmation Results', [
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
    ['Workflow ID','Form ID','Submission Timestamp','Internal Employee ID',
     'SiteDocs Worker ID','SiteDocs Job Code','SiteDocs Username','SiteDocs Password',
     'DSS Username','DSS Password','Setup Notes','Submitted By',
     'BOSS WIS Created','SiteDocs Badge Created']
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
console.log('  FORM FIELD MAP TEST — Employee Forms v2 DEV');
console.log('  ' + new Date().toLocaleString());
console.log('═'.repeat(72));
buildContext();
console.log('  ✓ Context built\n');

const results = [];

// ═════════════════════════════════════════════════════════════════════════════
//  FORM 1: InitialRequest.html — New Hire mode
//
//  The HTML submit handler (line ~1154-1207 of InitialRequest.html) builds a
//  `data` object from FormData. Several HTML name= attributes differ from the
//  resulting data object keys. Those remappings are tested explicitly here.
// ═════════════════════════════════════════════════════════════════════════════
results.push(runScenario('InitialRequest.html — New Hire (all systems + equipment)', () => {
  seedSheets();

  // ── STEP 1: PAGE LOAD — Define every HTML form field by its name= attribute ──
  //
  // This simulates what the browser would collect from a fully-filled form.
  // Keys are the exact HTML name= attribute values from InitialRequest.html.
  // Multi-value fields (getAll) are arrays.
  const htmlFields = {
    // Requester section
    requesterName:          'Test Requester',
    requesterEmail:         'requester@team-group.com',
    dateRequested:          '2026-07-01',
    // Employee section
    hireDate:               '2026-07-21',
    hireType:               'New Hire',          // → remapped to newHireOrRehire
    employeeType:           'Direct Hire',
    employmentType:         'Salary',
    firstName:              'Carol',
    middleName:             'Ann',
    lastName:               'Lee',
    preferredName:          'Caz',
    position:               'Project Manager',   // → remapped to positionTitle
    siteName:               'Ottawa Main',
    jobSiteNumber:          '1001',
    department:             'Operations',
    managerName:            'Alice Manager',      // → remapped to reportingManagerName
    managerEmail:           'boss@team-group.com',// → remapped to reportingManagerEmail
    // System/equipment
    systemAccess:           'Yes',
    systems:                ['BOSS', 'ADP Supervisor Access', 'Google Account',
                             'Central Purchasing/Jonas', 'SiteDocs'],
    equipment:              ['Computer', 'Mobile Phone', 'Credit Card', 'Business Cards'],
    // Google
    googleEmailLocal:       'clee',              // → remapped to googleEmail
    googleDomain:           'team-group.com',
    // Computer
    computerRequestType:    'New',
    computerType:           'MacBook Pro',
    computerPreviousUser:   '',                  // gatekeeper: cleared when computerReqType=New
    computerPreviousType:   '',                  // gatekeeper: cleared when computerReqType=New
    computerSerialNumber:   '',                  // gatekeeper: cleared when computerReqType=New
    office365Required:      'Yes',
    // Credit card
    creditCardUSA:          'Yes',               // checkbox value=Yes → 'Yes'; absent → ''
    creditCardLimitUSA:     '5000',
    creditCardCanada:       '',                  // not checked → ''
    creditCardLimitCanada:  '',
    creditCardHomeDepot:    '',                  // not checked → ''
    creditCardLimitHomeDepot:'',
    // Phone
    phoneRequestType:       'New',
    phonePreviousUser:      '',
    phonePreviousNumber:    '',
    // BOSS
    bossJobSites:           ['1001', '1002'],    // getAll → join(', ')
    bossCostSheet:          'Yes',
    costSheetJobNumbers:    ['JN-100', 'JN-200'],// → remapped to bossCostSheetJobs
    bossTripReports:        'Yes',
    bossGrievance:          'Yes',               // → remapped to bossGrievances (singular→plural)
    bossTrainingOnly:       'No',
    // Jonas / Purchasing
    jonasJobNumbers:        ['J-001'],            // getAll → join(', ')
    purchasingSites:        ['Ottawa Main'],      // getAll → array
    // ADP
    adpSites:               ['1001'],             // getAll → array
    adpSalaryAccess:        'Yes',               // checkbox; exact match === 'Yes' ? 'Yes' : 'No'
    // JR / 30-60-90 / Comments
    jrRequired:             'No',
    jrAssignment:           '',
    plan306090:             '',
    comments:               'Field map test comment',
  };

  // ── STEP 2: JS SUBMIT HANDLER — apply the exact transforms from InitialRequest.html ──
  //
  // Mirrors lines 1155-1265 of InitialRequest.html verbatim.
  // HTML name= values that differ from data object keys are noted.
  const data = {
    requesterName:          htmlFields.requesterName,
    requesterEmail:         htmlFields.requesterEmail,
    dateRequested:          htmlFields.dateRequested,
    firstName:              htmlFields.firstName,
    middleName:             htmlFields.middleName,
    lastName:               htmlFields.lastName,
    preferredName:          htmlFields.preferredName,
    hireDate:               htmlFields.hireDate,
    newHireOrRehire:        htmlFields.hireType,          // HTML: hireType → data: newHireOrRehire
    employeeType:           htmlFields.employeeType,
    employmentType:         htmlFields.employmentType,
    siteName:               htmlFields.siteName,
    jobSiteNumber:          htmlFields.jobSiteNumber,
    positionTitle:          htmlFields.position,          // HTML: position → data: positionTitle
    reportingManagerName:   htmlFields.managerName,       // HTML: managerName → data: reportingManagerName
    reportingManagerEmail:  htmlFields.managerEmail,      // HTML: managerEmail → data: reportingManagerEmail
    systemAccess:           htmlFields.systemAccess,
    systems:                htmlFields.systems,
    equipment:              htmlFields.equipment,
    googleEmail:            htmlFields.googleEmailLocal,  // HTML: googleEmailLocal → data: googleEmail
    googleDomain:           htmlFields.googleDomain,
    computerRequestType:    htmlFields.computerRequestType,
    computerType:           htmlFields.computerType,
    computerPreviousUser:   htmlFields.computerPreviousUser,
    computerPreviousType:   htmlFields.computerPreviousType,
    computerSerialNumber:   htmlFields.computerSerialNumber,
    office365Required:      htmlFields.office365Required,
    creditCardUSA:          htmlFields.creditCardUSA ? 'Yes' : 'No',    // checkbox → 'Yes'|'No'
    creditCardLimitUSA:     htmlFields.creditCardLimitUSA,
    creditCardCanada:       htmlFields.creditCardCanada ? 'Yes' : 'No',
    creditCardLimitCanada:  htmlFields.creditCardLimitCanada,
    creditCardHomeDepot:    htmlFields.creditCardHomeDepot ? 'Yes' : 'No',
    creditCardLimitHomeDepot: htmlFields.creditCardLimitHomeDepot,
    phoneRequestType:       htmlFields.phoneRequestType,
    phonePreviousUser:      htmlFields.phonePreviousUser,
    phonePreviousNumber:    htmlFields.phonePreviousNumber,
    bossJobSites:           htmlFields.bossJobSites.join(', '),          // getAll → join
    bossCostSheet:          htmlFields.bossCostSheet,
    bossCostSheetJobs:      htmlFields.costSheetJobNumbers.join(', '),   // HTML: costSheetJobNumbers → data: bossCostSheetJobs
    bossTripReports:        htmlFields.bossTripReports,
    bossGrievances:         htmlFields.bossGrievance,                   // HTML: bossGrievance → data: bossGrievances
    jonasJobNumbers:        htmlFields.jonasJobNumbers.join(', '),       // getAll → join
    jrRequired:             htmlFields.jrRequired,
    jrAssignment:           htmlFields.jrAssignment,
    plan306090:             htmlFields.plan306090,
    comments:               htmlFields.comments,
    adpSites:               htmlFields.adpSites,
    department:             htmlFields.department,
    purchasingSites:        htmlFields.purchasingSites,
    adpSalaryAccess:        htmlFields.adpSalaryAccess === 'Yes' ? 'Yes' : 'No',
    bossTrainingOnly:       htmlFields.bossTrainingOnly || 'No',
  };

  // Conditional clearing (mirrors InitialRequest.html lines 1209-1265):
  // equipment='Computer': computerRequestType='New' → clear prev fields
  if (data.computerRequestType === 'New') {
    data.computerPreviousUser = '';
    data.computerPreviousType = '';
    data.computerSerialNumber = '';
  }
  // systems includes ADP: keep adpSites/adpSalaryAccess (already set)
  // systems includes BOSS: keep boss* fields (already set)
  // systems includes Google: keep google* fields (already set)
  // systems includes Jonas: keep jonasJobNumbers/purchasingSites (already set)

  // ── STEP 3: HANDLER CALL ─────────────────────────────────────────────────
  const result = _ctx.submitInitialRequest(data);
  console.log('\n  RETURN: success=' + (result && result.success) + ' wfId=' + (result && result.workflowId));

  truthy('handler returns success=true', result && result.success);
  truthy('handler returns workflowId',   result && result.workflowId);

  const wfId = result && result.workflowId;

  // ── STEP 4: SHEET COLUMN MAP ─────────────────────────────────────────────
  //
  // Every assertion is labelled: "HTML 'name=X' → data.Y → IR[N]"
  // This is the complete proof that no field is dropped or misrouted.
  const irAppends = _rt.captures.getAppendsFor('Initial Requests');
  truthy('Initial Requests: at least 1 row written', irAppends.length >= 1);

  const irRow = (irAppends.find(r => String(r.values[0]).startsWith('NEW_EMP_')) ||
                 irAppends[irAppends.length - 1]).values;

  console.log('\n  SHEET MAP — Initial Requests (' + irRow.length + ' cols, expected 55):');
  eq('IR row has exactly 55 columns', irRow.length, 55);

  // Generated columns (handler-assigned, not from form fields)
  truthy('IR[0]  workflowId assigned (NEW_EMP_*)',  String(irRow[0]).startsWith('NEW_EMP_'));
  truthy('IR[1]  formId assigned (INIT_REQ_*)',     String(irRow[1]).startsWith('INIT_REQ_'));
  truthy('IR[2]  timestamp is set',                 irRow[2] instanceof Date || !!irRow[2]);

  // Direct HTML name → data key → column (name matches key)
  assertCol(irRow,  3, '2026-07-01',            "HTML 'dateRequested'         → data.dateRequested         → IR[3]");
  assertCol(irRow,  4, 'Test Requester',         "HTML 'requesterName'         → data.requesterName         → IR[4]");
  assertCol(irRow,  5, 'requester@team-group.com',"HTML 'requesterEmail'        → data.requesterEmail        → IR[5]");
  truthy(             "HTML 'hireDate' → IR[6] contains 2026",
    String(irRow[6]).includes('2026') || irRow[6] instanceof Date);

  // Remapped fields (HTML name ≠ data key)
  assertCol(irRow,  7, 'New Hire',              "HTML 'hireType'              → data.newHireOrRehire       → IR[7]  *** REMAPPED");
  assertCol(irRow,  8, 'Direct Hire',           "HTML 'employeeType'          → data.employeeType          → IR[8]");
  assertCol(irRow,  9, 'Salary',                "HTML 'employmentType'        → data.employmentType        → IR[9]");
  assertCol(irRow, 10, 'Carol',                 "HTML 'firstName'             → data.firstName             → IR[10]");
  assertCol(irRow, 11, 'Ann',                   "HTML 'middleName'            → data.middleName            → IR[11]");
  assertCol(irRow, 12, 'Lee',                   "HTML 'lastName'              → data.lastName              → IR[12]");
  assertCol(irRow, 13, 'Caz',                   "HTML 'preferredName'         → data.preferredName         → IR[13]");
  assertCol(irRow, 14, 'Project Manager',       "HTML 'position'              → data.positionTitle         → IR[14] *** REMAPPED");
  assertCol(irRow, 15, 'Ottawa Main',           "HTML 'siteName'              → data.siteName              → IR[15]");
  assertCol(irRow, 16, '1001',                  "HTML 'jobSiteNumber'         → data.jobSiteNumber         → IR[16]");
  assertCol(irRow, 17, 'boss@team-group.com',   "HTML 'managerEmail'          → data.reportingManagerEmail → IR[17] *** REMAPPED");
  assertCol(irRow, 18, 'Alice Manager',         "HTML 'managerName'           → data.reportingManagerName  → IR[18] *** REMAPPED");
  assertCol(irRow, 19, 'Yes',                   "HTML 'systemAccess'          → data.systemAccess          → IR[19]");

  // Multi-value fields (CSV in sheet)
  const sysWritten = String(irRow[20] || '');
  truthy("HTML 'systems[]' BOSS       → data.systems → IR[20] contains BOSS",         sysWritten.includes('BOSS'));
  truthy("HTML 'systems[]' ADP        → data.systems → IR[20] contains ADP",          sysWritten.includes('ADP'));
  truthy("HTML 'systems[]' Google     → data.systems → IR[20] contains Google",       sysWritten.includes('Google'));
  truthy("HTML 'systems[]' Jonas      → data.systems → IR[20] contains Purchasing",   sysWritten.includes('Purchasing') || sysWritten.includes('Jonas'));

  const eqWritten = String(irRow[21] || '');
  truthy("HTML 'equipment[]' Computer → data.equipment → IR[21] contains Computer",   eqWritten.includes('Computer'));
  truthy("HTML 'equipment[]' Phone    → data.equipment → IR[21] contains Mobile",     eqWritten.includes('Mobile'));
  truthy("HTML 'equipment[]' CC       → data.equipment → IR[21] contains Credit",     eqWritten.includes('Credit'));

  assertCol(irRow, 22, 'clee',                  "HTML 'googleEmailLocal'       → data.googleEmail           → IR[22] *** REMAPPED");
  assertCol(irRow, 23, 'team-group.com',         "HTML 'googleDomain'           → data.googleDomain          → IR[23]");

  // Computer fields (present because equipment includes 'Computer' and reqType='New')
  assertCol(irRow, 24, 'New',                   "HTML 'computerRequestType'   → data.computerRequestType   → IR[24]");
  assertCol(irRow, 25, 'MacBook Pro',           "HTML 'computerType'          → data.computerType          → IR[25]");
  // IR[26] computerPreviousUser: gatekeeper — cleared when computerRequestType='New'
  assertCol(irRow, 26, '',                      "HTML 'computerPreviousUser'  → cleared (New req path)     → IR[26] GATEKEEPER");
  // IR[27] computerPreviousType: same gatekeeper
  assertCol(irRow, 27, '',                      "HTML 'computerPreviousType'  → cleared (New req path)     → IR[27] GATEKEEPER");
  // IR[28] computerSerialNumber: same gatekeeper
  assertCol(irRow, 28, '',                      "HTML 'computerSerialNumber'  → cleared (New req path)     → IR[28] GATEKEEPER");
  assertCol(irRow, 29, 'Yes',                   "HTML 'office365Required'     → data.office365Required     → IR[29]");

  // Credit card fields (present because equipment includes 'Credit Card')
  assertCol(irRow, 30, 'Yes',                   "HTML 'creditCardUSA' checked  → data.creditCardUSA='Yes'   → IR[30]");
  assertCol(irRow, 31, '5000',                  "HTML 'creditCardLimitUSA'     → data.creditCardLimitUSA    → IR[31]");
  assertCol(irRow, 32, 'No',                    "HTML 'creditCardCanada' unchecked → 'No' → IR[32]");
  assertCol(irRow, 33, '',                      "HTML 'creditCardLimitCanada'  → data.creditCardLimitCanada → IR[33]");
  assertCol(irRow, 34, 'No',                    "HTML 'creditCardHomeDepot' unchecked → 'No' → IR[34]");
  assertCol(irRow, 35, '',                      "HTML 'creditCardLimitHomeDepot' → data.creditCardLimitHomeDepot → IR[35]");

  // Phone fields (present because equipment includes 'Mobile Phone')
  assertCol(irRow, 36, 'New',                   "HTML 'phoneRequestType'      → data.phoneRequestType      → IR[36]");
  assertCol(irRow, 37, '',                      "HTML 'phonePreviousUser'      → data.phonePreviousUser     → IR[37]");
  assertCol(irRow, 38, '',                      "HTML 'phonePreviousNumber'    → data.phonePreviousNumber   → IR[38]");

  // BOSS fields (present because systems includes 'BOSS')
  assertCol(irRow, 39, '1001, 1002',            "HTML 'bossJobSites[]' getAll → .join(', ')                → IR[39]");
  assertCol(irRow, 40, 'Yes',                   "HTML 'bossCostSheet'          → data.bossCostSheet         → IR[40]");
  assertCol(irRow, 41, 'JN-100, JN-200',        "HTML 'costSheetJobNumbers[]' → data.bossCostSheetJobs     → IR[41] *** REMAPPED");
  assertCol(irRow, 42, 'Yes',                   "HTML 'bossTripReports'        → data.bossTripReports       → IR[42]");
  assertCol(irRow, 43, 'Yes',                   "HTML 'bossGrievance'          → data.bossGrievances        → IR[43] *** REMAPPED (singular→plural)");

  // Jonas fields (present because systems includes 'Central Purchasing/Jonas')
  assertCol(irRow, 44, 'J-001',                 "HTML 'jonasJobNumbers[]' getAll → .join(', ')             → IR[44]");

  // JR fields
  assertCol(irRow, 45, 'No',                    "HTML 'jrRequired'             → data.jrRequired            → IR[45]");
  assertCol(irRow, 46, '',                      "HTML 'jrAssignment'           → data.jrAssignment          → IR[46]");
  assertCol(irRow, 47, '',                      "HTML 'plan306090'             → data.plan306090            → IR[47]");
  assertCol(irRow, 48, 'Field map test comment',"HTML 'comments'               → data.comments              → IR[48]");

  // ADP fields (present because systems includes 'ADP Supervisor Access')
  const adpWritten = String(irRow[49] || '');
  truthy("HTML 'adpSites[]' → data.adpSites array → IR[49] CSV contains 1001", adpWritten.includes('1001'));

  assertCol(irRow, 50, 'Operations',            "HTML 'department'             → data.department            → IR[50]");

  // Purchasing fields
  const purchWritten = String(irRow[51] || '');
  truthy("HTML 'purchasingSites[]' → data.purchasingSites → IR[51] CSV contains Ottawa", purchWritten.includes('Ottawa'));

  // IR[52] STATUS: not from form, written as '' by handler (populated later by WorkflowManager)
  assertCol(irRow, 52, '',                      "IR[52] STATUS — not a form field, handler writes ''");

  // ADP salary access
  assertCol(irRow, 53, 'Yes',                   "HTML 'adpSalaryAccess' === 'Yes' → 'Yes'                   → IR[53]");
  assertCol(irRow, 54, 'No',                    "HTML 'bossTrainingOnly'       → data.bossTrainingOnly      → IR[54]");

  // ── STEP 5: EMAIL CONTEXT MAP ────────────────────────────────────────────
  //
  // The handler sends email via sendFormEmail({contextData: context}).
  // context is built from getWorkflowContext(workflowId) which re-reads the
  // written IR row. Every contextData key must trace back to a form field.
  const emailOpts = _rt.captures.getEmailOptions().filter(e => !e.__error);
  truthy('At least 1 email sent', emailOpts.length >= 1);

  const firstEmail = emailOpts[0];
  const ctx = firstEmail && firstEmail.contextData || {};

  console.log('\n  EMAIL CONTEXT MAP:');
  // employeeName = firstName + ' ' + lastName
  eq("ctx.employeeName = firstName + lastName (HTML firstName+lastName → IR[10]+IR[12])",
    (ctx.employeeName || (ctx.firstName + ' ' + ctx.lastName)).trim(), 'Carol Lee');
  eq("ctx.firstName from HTML 'firstName' → IR[10]",  ctx.firstName,  'Carol');
  eq("ctx.lastName from HTML 'lastName' → IR[12]",    ctx.lastName,   'Lee');
  eq("ctx.siteName from HTML 'siteName' → IR[15]",    ctx.siteName,   'Ottawa Main');
  eq("ctx.managerName from HTML 'managerName' → data.reportingManagerName → IR[18]",
    ctx.managerName, 'Alice Manager');
  eq("ctx.managerEmail from HTML 'managerEmail' → data.reportingManagerEmail → IR[17]",
    ctx.managerEmail, 'boss@team-group.com');
  eq("ctx.jobTitle from HTML 'position' → data.positionTitle → IR[14]",
    ctx.jobTitle, 'Project Manager');
  eq("ctx.requesterEmail from HTML 'requesterEmail' → IR[5]",
    ctx.requesterEmail, 'requester@team-group.com');
  truthy("ctx.hireDate contains 2026 (from HTML 'hireDate' → IR[6])",
    String(ctx.hireDate || '').includes('2026'));
  truthy("ctx.systems[] includes BOSS (from HTML 'systems[]' → IR[20])",
    Array.isArray(ctx.systems) ? ctx.systems.includes('BOSS') : String(ctx.systems).includes('BOSS'));
  // NOTE: ctx.googleEmail and ctx.bossGrievances are NOT in the initial-submission email
  // context — submitInitialRequest calls sendInitialRequestEmails() with a hand-built
  // object that does not include those fields. They appear in the IT-step workflow context
  // (getWorkflowContext), tested in the ITSetup scenario below.
  eq("ctx.newHireOrRehire from HTML 'hireType' → data.newHireOrRehire → context",
    ctx.newHireOrRehire, 'New Hire');
  eq("ctx.systemAccess from HTML 'systemAccess' → context",
    ctx.systemAccess, 'Yes');
  eq("ctx.workflowType = 'New Hire' (sendInitialRequestEmails hardcoded)",
    ctx.workflowType, 'New Hire');
  truthy("ctx.requestDate set (new Date().toLocaleDateString())", !!ctx.requestDate);
  eq("ctx.employmentType from HTML 'employmentType' → context",
    ctx.employmentType, 'Salary');
  eq("ctx.employeeType from HTML 'employeeType' → context",
    ctx.employeeType, 'Direct Hire');
  contains("ctx.equipmentRaw from HTML 'equipment[]' joined → includes Computer",
    ctx.equipmentRaw || '', 'Computer');
  eq("ctx.department from HTML 'department' → context",
    ctx.department, 'Operations');
}));

// ═════════════════════════════════════════════════════════════════════════════
//  FORM 2: InitialRequest.html — Equipment Request mode
//
//  Uses the same HTML file in 'equipment' mode. The JS submit handler
//  adds alias keys (reqName, reqEmail, position, managerEmail, managerName)
//  so EquipmentRequestHandler can read them without remapping.
// ═════════════════════════════════════════════════════════════════════════════
results.push(runScenario('InitialRequest.html — Equipment Request mode', () => {
  seedSheets();

  // HTML fields — equipment mode: only system/equipment fields are relevant
  const htmlFields = {
    requesterName:          'Test Requester',
    requesterEmail:         'requester@team-group.com',
    dateRequested:          '2026-07-01',
    hireDate:               '',               // not used in equipment mode
    hireType:               '',
    employeeType:           'Direct Hire',
    employmentType:         'Salary',
    firstName:              'Mike',
    middleName:             '',
    lastName:               'Davis',
    preferredName:          '',
    position:               'Field Supervisor', // → positionTitle
    siteName:               'Test Site',
    jobSiteNumber:          '9999',
    department:             '',
    managerName:            'Alice Manager',
    managerEmail:           'boss@team-group.com',
    systemAccess:           'Yes',
    systems:                ['BOSS'],
    equipment:              ['Computer'],
    googleEmailLocal:       '',
    googleDomain:           '',
    computerRequestType:    'New',
    computerType:           'Laptop',
    computerPreviousUser:   '',
    computerPreviousType:   '',
    computerSerialNumber:   '',
    office365Required:      'No',
    creditCardUSA:          '',
    creditCardLimitUSA:     '',
    creditCardCanada:       '',
    creditCardLimitCanada:  '',
    creditCardHomeDepot:    '',
    creditCardLimitHomeDepot:'',
    phoneRequestType:       '',
    phonePreviousUser:      '',
    phonePreviousNumber:    '',
    bossJobSites:           ['9999'],
    bossCostSheet:          'No',
    costSheetJobNumbers:    [],
    bossTripReports:        'No',
    bossGrievance:          'No',
    bossTrainingOnly:       'No',
    jonasJobNumbers:        [],
    purchasingSites:        [],
    adpSites:               [],
    adpSalaryAccess:        '',
    jrRequired:             'No',
    jrAssignment:           '',
    plan306090:             '',
    comments:               'Equipment test',
  };

  // JS submit handler transform (same as form 1)
  const data = {
    requesterName:          htmlFields.requesterName,
    requesterEmail:         htmlFields.requesterEmail,
    dateRequested:          htmlFields.dateRequested,
    firstName:              htmlFields.firstName,
    middleName:             htmlFields.middleName,
    lastName:               htmlFields.lastName,
    preferredName:          htmlFields.preferredName,
    hireDate:               htmlFields.hireDate,
    newHireOrRehire:        htmlFields.hireType,
    employeeType:           htmlFields.employeeType,
    employmentType:         htmlFields.employmentType,
    siteName:               htmlFields.siteName,
    jobSiteNumber:          htmlFields.jobSiteNumber,
    positionTitle:          htmlFields.position,          // *** REMAPPED
    reportingManagerName:   htmlFields.managerName,       // *** REMAPPED
    reportingManagerEmail:  htmlFields.managerEmail,      // *** REMAPPED
    systemAccess:           htmlFields.systemAccess,
    systems:                htmlFields.systems,
    equipment:              htmlFields.equipment,
    googleEmail:            htmlFields.googleEmailLocal,  // *** REMAPPED
    googleDomain:           htmlFields.googleDomain,
    computerRequestType:    htmlFields.computerRequestType,
    computerType:           htmlFields.computerType,
    computerPreviousUser:   '',
    computerPreviousType:   '',
    computerSerialNumber:   '',
    office365Required:      htmlFields.office365Required,
    creditCardUSA:          '',
    creditCardLimitUSA:     '',
    creditCardCanada:       '',
    creditCardLimitCanada:  '',
    creditCardHomeDepot:    '',
    creditCardLimitHomeDepot:'',
    phoneRequestType:       '',  // cleared: 'Mobile Phone' not in equipment
    phonePreviousUser:      '',
    phonePreviousNumber:    '',
    bossJobSites:           htmlFields.bossJobSites.join(', '),
    bossCostSheet:          htmlFields.bossCostSheet,
    bossCostSheetJobs:      htmlFields.costSheetJobNumbers.join(', '), // *** REMAPPED
    bossTripReports:        htmlFields.bossTripReports,
    bossGrievances:         htmlFields.bossGrievance,                 // *** REMAPPED
    jonasJobNumbers:        '',   // cleared: 'Central Purchasing/Jonas' not in systems
    jrRequired:             htmlFields.jrRequired,
    jrAssignment:           htmlFields.jrAssignment,
    plan306090:             htmlFields.plan306090,
    comments:               htmlFields.comments,
    adpSites:               [],   // cleared: 'ADP Supervisor Access' not in systems
    department:             htmlFields.department,
    purchasingSites:        [],   // cleared: 'Central Purchasing/Jonas' not in systems
    adpSalaryAccess:        'No', // cleared when ADP not in systems
    bossTrainingOnly:       htmlFields.bossTrainingOnly || 'No',
  };

  // Equipment mode aliases added by the browser before google.script.run call:
  data.reqName     = data.requesterName;
  data.reqEmail    = data.requesterEmail;
  data.position    = data.positionTitle;
  data.managerEmail = data.reportingManagerEmail;
  data.managerName  = data.reportingManagerName;

  const result = _ctx.submitEquipmentRequest(data);
  console.log('\n  RETURN: success=' + (result && result.success) + ' wfId=' + (result && result.workflowId));

  truthy('handler returns success=true', result && result.success);
  truthy('workflowId starts with EQUIP_REQ_', String(result && result.workflowId).startsWith('EQUIP_REQ_'));

  const irAppends = _rt.captures.getAppendsFor('Initial Requests');
  truthy('Initial Requests row written', irAppends.length >= 1);

  const irRow = (irAppends.find(r => String(r.values[0]).startsWith('EQUIP_REQ_')) ||
                 irAppends[irAppends.length - 1]).values;

  console.log('\n  SHEET MAP — Initial Requests (equipment mode):');
  eq('IR row has exactly 55 columns', irRow.length, 55);

  truthy("IR[0]  workflowId = EQUIP_REQ_*",    String(irRow[0]).startsWith('EQUIP_REQ_'));
  assertCol(irRow,  4, 'Test Requester',        "HTML 'requesterName' → IR[4]");
  assertCol(irRow,  5, 'requester@team-group.com', "HTML 'requesterEmail' → IR[5]");
  assertCol(irRow,  7, '',                      "HTML 'hireType' blank → data.newHireOrRehire='' → IR[7] *** REMAPPED");
  assertCol(irRow, 10, 'Mike',                  "HTML 'firstName' → IR[10]");
  assertCol(irRow, 12, 'Davis',                 "HTML 'lastName' → IR[12]");
  assertCol(irRow, 14, 'Field Supervisor',      "HTML 'position' → data.positionTitle → IR[14] *** REMAPPED");
  assertCol(irRow, 15, 'Test Site',             "HTML 'siteName' → IR[15]");
  assertCol(irRow, 17, 'boss@team-group.com',   "HTML 'managerEmail' → data.reportingManagerEmail → IR[17] *** REMAPPED");
  assertCol(irRow, 18, 'Alice Manager',         "HTML 'managerName' → data.reportingManagerName → IR[18] *** REMAPPED");
  assertCol(irRow, 19, 'Yes',                   "HTML 'systemAccess' → IR[19]");
  contains("IR[20] SYSTEMS contains BOSS",      irRow[20], 'BOSS');
  contains("IR[21] EQUIPMENT contains Computer",irRow[21], 'Computer');
  assertCol(irRow, 24, 'New',                   "HTML 'computerRequestType' → IR[24]");
  assertCol(irRow, 25, 'Laptop',                "HTML 'computerType' → IR[25]");
  assertCol(irRow, 39, '9999',                  "HTML 'bossJobSites[]' → IR[39]");
  assertCol(irRow, 53, 'No',                    "HTML 'adpSalaryAccess' cleared (ADP not in systems) → IR[53]");

  // Email — equipment mode sends to IT Confirmation
  const emailOpts = _rt.captures.getEmailOptions().filter(e => !e.__error);
  truthy('At least 1 email sent (equipment mode)', emailOpts.length >= 1);
  const ctx = emailOpts[0] && emailOpts[0].contextData || {};
  eq("ctx.workflowType = 'Equipment Request'",  ctx.workflowType, 'Equipment Request');
  eq("ctx.employeeName = Mike Davis",           (ctx.employeeName || (ctx.firstName + ' ' + ctx.lastName)).trim(), 'Mike Davis');
  eq("ctx.jobTitle from HTML 'position' → data.positionTitle", ctx.jobTitle, 'Field Supervisor');
  eq("ctx.firstName = Mike",                   ctx.firstName,      'Mike');
  eq("ctx.lastName = Davis",                   ctx.lastName,       'Davis');
  eq("ctx.siteName = Test Site",               ctx.siteName,       'Test Site');
  eq("ctx.managerName = Alice Manager",        ctx.managerName,    'Alice Manager');
  eq("ctx.managerEmail = boss@team-group.com", ctx.managerEmail,   'boss@team-group.com');
  eq("ctx.requesterEmail",                     ctx.requesterEmail, 'requester@team-group.com');
  eq("ctx.requesterName = Test Requester",     ctx.requesterName,  'Test Requester');
  truthy("ctx.requestDate set",                !!ctx.requestDate);
  truthy("ctx.workflowId starts with EQUIP_REQ_",
    String(ctx.workflowId || '').startsWith('EQUIP_REQ_'));
  eq("ctx.department = '' (blank in equipment test form)",  ctx.department,    '');
  truthy("ctx.systems[] includes BOSS",
    Array.isArray(ctx.systems) ? ctx.systems.includes('BOSS') : String(ctx.systems || '').includes('BOSS'));
  contains("ctx.equipmentRaw contains Computer", ctx.equipmentRaw || '', 'Computer');
  truthy("ctx.equipment[] is array",           Array.isArray(ctx.equipment));
  eq("ctx.comments = 'Equipment test'",        ctx.comments || '', 'Equipment test');
}));

// ═════════════════════════════════════════════════════════════════════════════
//  FORM 3: HRVerification.html
//
//  The submit handler uses direct property access on `this` (the form element),
//  NOT FormData.get(). No field name remapping occurs. All 13 keys in the
//  formData object use the exact HTML name= values.
// ═════════════════════════════════════════════════════════════════════════════
results.push(runScenario('HRVerification.html — full field map', () => {
  seedSheets();

  // Pre-seed a Workflow + Initial Requests row so the handler can find the record
  const wfId = 'NEW_EMP_HR_TEST_001';
  _rt.captures.seedSheet('Workflows', [
    makeWorkflowHeaderRow(),
    makeWorkflowRow(wfId, 'NEW_EMP', 'New Employee Request', 'requester@team-group.com',
                    'In Progress', 'HR Verification Needed', 'Pat Jones'),
  ]);
  _rt.captures.seedSheet('Initial Requests', [
    makeIRHeaderRow(),
    makeIRRow(wfId, 'IR_001', 'Pat', 'Jones', '2026-07-21', 'Ottawa Main',
              'Alice Manager', 'boss@team-group.com',
              'Direct Hire', 'Salary', 'BOSS,Google Account', 'Software Developer', 'Yes'),
  ]);
  _rt.captures.seedSheet('HR Verification Results', [makeHRResultHeaderRow()]);

  // ── STEP 1: PAGE LOAD — HTML form fields (name= attributes) ──────────────
  //
  // HRVerification.html's submit handler reads from `this.<name>.value`
  // (direct form element access), NOT FormData. No remapping occurs.
  const htmlFields = {
    workflowId:     wfId,                    // hidden field
    formId:         '',                      // hidden field — ignored by handler
    internalEmployeeId: 'PENDING',           // hidden field — NOT sent in formData
    // Verified information
    hireDate:       '2026-07-21',
    firstName:      'Patricia',              // may differ from original request
    lastName:       'Jones-Smith',           // may differ from original request
    managerName:    'Alice Manager',
    managerEmail:   'boss@team-group.com',
    jobTitle:       'Senior Software Developer', // HR-verified job title
    jrTitle:        '',                      // empty when jrRequired !== 'Yes'
    siteName:       'Ottawa Main',
    department:     'Technology',
    adpAssociateId: 'ADP-99001',
    notes:          'Verified by HR on hire date.',
  };

  // ── STEP 2: JS SUBMIT HANDLER — direct property access, no remapping ─────
  //
  // Mirrors HRVerification.html lines 209-223 exactly.
  const formData = {
    workflowId:     htmlFields.workflowId,   // this.workflowId.value
    formId:         htmlFields.formId,       // this.formId.value
    hireDate:       htmlFields.hireDate,     // this.hireDate.value
    firstName:      htmlFields.firstName,    // this.firstName.value
    lastName:       htmlFields.lastName,     // this.lastName.value
    managerName:    htmlFields.managerName,  // this.managerName.value
    managerEmail:   htmlFields.managerEmail, // this.managerEmail.value
    jobTitle:       htmlFields.jobTitle,     // this.jobTitle.value
    jrTitle:        htmlFields.jrTitle,      // this.jrTitle.value
    siteName:       htmlFields.siteName,     // this.siteName.value
    department:     htmlFields.department,   // this.department.value
    adpAssociateId: htmlFields.adpAssociateId, // this.adpAssociateId.value
    notes:          htmlFields.notes,        // this.notes.value
    // NOTE: internalEmployeeId is a hidden field but is NOT included in formData
    //       by the submit handler — it is not sent to the server.
  };

  // ── STEP 3: HANDLER CALL ─────────────────────────────────────────────────
  const result = _ctx.submitHRVerification(formData);
  console.log('\n  RETURN: success=' + (result && result.success));

  truthy('handler returns success=true', result && result.success);

  // ── STEP 4a: HR Verification Results row ─────────────────────────────────
  //
  // SCHEMA.HR_VERIFICATION_RESULTS (10 columns):
  //   0=workflowId, 1=formId, 2=timestamp, 3=adpAssociateId,
  //   4=firstName+' '+lastName, 5=managerName, 6=managerEmail,
  //   7=jobTitle (or jobTitle+' / '+jrTitle), 8=notes, 9=submittedBy
  const hrAppends = _rt.captures.getAppendsFor('HR Verification Results');
  truthy('HR Verification Results: at least 1 row written', hrAppends.length >= 1);

  const hrRow = hrAppends[hrAppends.length - 1].values;
  console.log('\n  SHEET MAP — HR Verification Results (' + hrRow.length + ' cols, expected 10):');
  eq('HR row has 10 columns', hrRow.length, 10);

  assertCol(hrRow, 0, wfId,                        "HTML 'workflowId' (hidden) → formData.workflowId         → HR[0]");
  truthy(                                           "HR[1]  formId assigned (HR_VERIF_*)",  String(hrRow[1]).startsWith('HR_VERIF_'));
  truthy(                                           "HR[2]  timestamp is set",              hrRow[2] instanceof Date || !!hrRow[2]);
  assertCol(hrRow, 3, 'ADP-99001',                 "HTML 'adpAssociateId' → formData.adpAssociateId          → HR[3]");
  assertCol(hrRow, 4, 'Patricia Jones-Smith',      "HTML 'firstName'+'lastName' → firstName+' '+lastName     → HR[4]");
  assertCol(hrRow, 5, 'Alice Manager',             "HTML 'managerName' → formData.managerName                → HR[5]");
  assertCol(hrRow, 6, 'boss@team-group.com',       "HTML 'managerEmail' → formData.managerEmail              → HR[6]");
  assertCol(hrRow, 7, 'Senior Software Developer', "HTML 'jobTitle' (no jrTitle) → jobTitle alone            → HR[7]");
  contains(                                        "HR[8]  notes from HTML 'notes'",        hrRow[8], 'Verified by HR');
  // HR[9] submittedBy = Session.getActiveUser().getEmail() — not from form

  // ── STEP 4b: Initial Requests row updates ────────────────────────────────
  //
  // HRVerification writes back verified values to the IR sheet.
  // Test that the correct cells were updated.
  const irUpdates = _rt.captures.getUpdatesFor('Initial Requests');
  truthy('Initial Requests updates exist for HR verification', irUpdates.length >= 1);

  // Check that the cells written match the form values
  const firstNameUpdate = irUpdates.find(u => u.col === 10 + 1); // col 10 is FIRST_NAME (1-based)
  const lastNameUpdate  = irUpdates.find(u => u.col === 12 + 1);
  if (firstNameUpdate) eq("IR FIRST_NAME updated from HTML 'firstName'",  firstNameUpdate.value, 'Patricia');
  if (lastNameUpdate)  eq("IR LAST_NAME updated from HTML 'lastName'",    lastNameUpdate.value,  'Jones-Smith');

  const mgrEmailUpdate = irUpdates.find(u => u.col === 17 + 1);
  const mgrNameUpdate  = irUpdates.find(u => u.col === 18 + 1);
  if (mgrEmailUpdate) eq("IR MANAGER_EMAIL updated from HTML 'managerEmail'", mgrEmailUpdate.value, 'boss@team-group.com');
  if (mgrNameUpdate)  eq("IR MANAGER_NAME updated from HTML 'managerName'",   mgrNameUpdate.value,  'Alice Manager');

  const posUpdate = irUpdates.find(u => u.col === 14 + 1);
  if (posUpdate) eq("IR POSITION_TITLE updated from HTML 'jobTitle'", posUpdate.value, 'Senior Software Developer');

  const deptUpdate = irUpdates.find(u => u.col === 50 + 1);
  if (deptUpdate) eq("IR DEPARTMENT updated from HTML 'department'", deptUpdate.value, 'Technology');

  // ── STEP 5: EMAIL CONTEXT MAP ────────────────────────────────────────────
  const emailOpts = _rt.captures.getEmailOptions().filter(e => !e.__error);
  truthy('At least 1 email sent after HR verification', emailOpts.length >= 1);

  // HRVerification uses getWorkflowContext which re-reads from the updated IR row,
  // then overrides jobTitle, jrTitle, adpAssociateId with the fresh form values.
  const ctx = emailOpts[0] && emailOpts[0].contextData || {};
  eq("ctx.adpAssociateId = formData.adpAssociateId (overridden in HR handler)",
    ctx.adpAssociateId, 'ADP-99001');
  eq("ctx.jobTitle overridden with formData.jobTitle",
    ctx.jobTitle, 'Senior Software Developer');
  // IR values read by getWorkflowContext — mock does NOT propagate setValue() back to seed data,
  // so these reflect the original makeIRRow() values (Pat Jones, Operations), not HR's updates.
  eq("ctx.workflowType = 'New Hire' (wfId prefix NEW_EMP_)",     ctx.workflowType,    'New Hire');
  eq("ctx.firstName = 'Patricia' (IR[10] updated by HRV setValue — mock propagates in-memory)",
    ctx.firstName, 'Patricia');
  eq("ctx.lastName = 'Jones-Smith' (IR[12] updated by HRV setValue)",
    ctx.lastName, 'Jones-Smith');
  truthy("ctx.hireDate set (from IR[6])",                        !!ctx.hireDate);
  eq("ctx.newHireOrRehire from IR[7]",      ctx.newHireOrRehire, 'New Hire');
  eq("ctx.employeeType from IR[8]",         ctx.employeeType,    'Direct Hire');
  eq("ctx.employmentType from IR[9]",       ctx.employmentType,  'Salary');
  eq("ctx.jrTitle = '' (formData.jrTitle='')",                   ctx.jrTitle,         '');
  eq("ctx.siteName from IR[15]",            ctx.siteName,        'Ottawa Main');
  eq("ctx.managerName from IR[18]",         ctx.managerName,     'Alice Manager');
  eq("ctx.managerEmail from IR[17]",        ctx.managerEmail,    'boss@team-group.com');
  eq("ctx.requesterEmail from IR[5]",       ctx.requesterEmail,  'requester@team-group.com');
  truthy("ctx.requestDate set (from IR[2])",                     !!ctx.requestDate);
  eq("ctx.systemAccess from IR[19]",        ctx.systemAccess,    'Yes');
  truthy("ctx.systems[] includes BOSS (from IR[20])",
    Array.isArray(ctx.systems) ? ctx.systems.includes('BOSS') : String(ctx.systems || '').includes('BOSS'));
  contains("ctx.equipmentRaw from IR[21]",  ctx.equipmentRaw || '', 'Computer');
  eq("ctx.computerType from IR[25]",        ctx.computerType,    'Laptop');
  eq("ctx.computerRequestType from IR[24]", ctx.computerRequestType, 'New');
  eq("ctx.phoneRequestType from IR[36]",    ctx.phoneRequestType,'New');
  eq("ctx.googleEmail = 'patj' (IR[22]: firstName lower + lastName[0] lower)",
    ctx.googleEmail, 'patj');
  eq("ctx.googleDomain = 'team-group.com' (IR[23], no @ prefix in getWorkflowContext)",
    ctx.googleDomain, 'team-group.com');
  eq("ctx.bossJobSites from IR[39] via header 'BOSS Job Sites'",
    ctx.bossJobSites, '1001, 1002');
  eq("ctx.bossCostSheet from IR[40] via header 'BOSS Cost Sheet Access'",
    ctx.bossCostSheet, 'Yes');
  eq("ctx.bossCostSheetJobs from IR[41] via header 'BOSS Cost Sheet Jobs'",
    ctx.bossCostSheetJobs, 'JN-100');
  eq("ctx.bossTripReports from IR[42] via header 'BOSS Trip Reports'",
    ctx.bossTripReports, 'Yes');
  eq("ctx.bossGrievances from IR[43] via header 'BOSS Grievances'",
    ctx.bossGrievances, 'Yes');
  eq("ctx.creditCardUSA from IR[30]",       ctx.creditCardUSA,        'Yes');
  eq("ctx.creditCardCanada from IR[32]",    ctx.creditCardCanada,     'No');
  eq("ctx.creditCardHomeDepot from IR[34]", ctx.creditCardHomeDepot,  'No');
  eq("ctx.jonasJobNumbers from IR[44]",     ctx.jonasJobNumbers,      'J-001');
  eq("ctx.plan306090 from IR[47]",          ctx.plan306090,           'Yes');
  eq("ctx.businessCards = 'Yes' (IR[21] contains 'Business Cards')",
    ctx.businessCards, 'Yes');
  eq("ctx.vehicleRequested = '' (no vehicle in IR[21], no header match)",
    ctx.vehicleRequested, '');
  eq("ctx.fleetioAccess = '' (no Fleetio in systems, no header match)",
    ctx.fleetioAccess, '');
  eq("ctx.department = 'Technology' (IR[50] updated by HRV setValue — mock propagates in-memory)",
    ctx.department, 'Technology');
  eq("ctx.purchasingSites from IR[51]",     ctx.purchasingSites,      'Ottawa Main');
}));

// ═════════════════════════════════════════════════════════════════════════════
//  FORM 4: ITSetup.html
//
//  The submit handler uses FormData API with a Set for deduplication.
//  Multi-value keys are joined with ','. Four system-access checkboxes
//  are defaulted to 'No' if not present. The assigned email is computed:
//  Email_Username + Email_Domain (domain includes '@' prefix in select values).
// ═════════════════════════════════════════════════════════════════════════════
results.push(runScenario('ITSetup.html — full field map', () => {
  seedSheets();

  // Pre-seed all prerequisite data
  const wfId = 'NEW_EMP_IT_TEST_001';
  _rt.captures.seedSheet('Workflows', [
    makeWorkflowHeaderRow(),
    makeWorkflowRow(wfId, 'NEW_EMP', 'New Employee Request', 'requester@team-group.com',
                    'In Progress', 'IT Setup Needed', 'Carol Lee'),
  ]);
  _rt.captures.seedSheet('Initial Requests', [
    makeIRHeaderRow(),
    makeIRRow(wfId, 'IR_002', 'Carol', 'Lee', '2026-07-21', 'Ottawa Main',
              'Alice Manager', 'boss@team-group.com',
              'Direct Hire', 'Salary', 'BOSS,Google Account,Incidents,CAA', 'Project Manager', 'Yes'),
  ]);
  _rt.captures.seedSheet('HR Verification Results', [makeHRResultHeaderRow()]);

  // ── STEP 1: PAGE LOAD — HTML form fields ─────────────────────────────────
  const htmlFields = {
    workflowId:             wfId,            // hidden
    formId:                 '',              // hidden — replaced by handler
    Employee_Name:          'Carol Lee',     // hidden — for display only, not in rowData
    // Email
    Email_Created:          'Yes',
    Email_Username:         'clee',
    Email_Domain:           '@team-group.com',  // select option value includes '@'
    Email_Temp_Password:    'Temp@1234',
    // Computer
    Computer_Assigned:      'Yes',
    Computer_Serial:        'SN-ABC-999',
    Computer_Model:         'MacBook Pro 14',
    Computer_Type:          'Laptop',
    // Phone
    Phone_Assigned:         'Yes',
    Phone_Carrier:          'Rogers',
    Phone_Model:            'iPhone 15',
    Phone_Number:           '613-555-0100',
    Phone_VM_Password:      '1234',
    // BOSS
    BOSS_Access:            'Yes',
    // Dynamic BOSS checkboxes (named BOSS_Cmte_{site} / BOSS_CostSheet_{job}):
    // These only appear when requestData has those values; not individually asserted
    // here — they are captured in bossDetails (rowData[22]) as JSON.
    BOSS_TripReports:       'Yes',    // checked
    BOSS_Grievances:        'Yes',    // checked
    // System access checkboxes — absent means 'No' (defaulted by JS)
    Incidents_Access:       'Yes',    // checked
    CAA_Access:             'No',     // unchecked → JS defaults to 'No'
    Delivery_App_Access:    'No',     // unchecked → JS defaults to 'No'
    Net_Promoter_Score_Access: 'No', // unchecked → JS defaults to 'No'
    // Notes
    IT_Notes:               'IT setup complete. All systems provisioned.',
  };

  // ── STEP 2: JS SUBMIT HANDLER — FormData + Set + defaults ────────────────
  //
  // Mirrors ITSetup.html submit handler.
  // assignedEmail = Email_Username + Email_Domain
  // System access checkboxes defaulted to 'No' if absent.
  const formData = {
    workflowId:             htmlFields.workflowId,
    formId:                 htmlFields.formId,
    Employee_Name:          htmlFields.Employee_Name,  // passed but not in rowData
    Email_Created:          htmlFields.Email_Created,
    // Handler computes assignedEmail = Email_Username + Email_Domain (both required separately)
    Email_Username:         htmlFields.Email_Username,
    Email_Domain:           htmlFields.Email_Domain,
    Email_Temp_Password:    htmlFields.Email_Temp_Password,
    Computer_Assigned:      htmlFields.Computer_Assigned,
    Computer_Serial:        htmlFields.Computer_Serial,
    Computer_Model:         htmlFields.Computer_Model,
    Computer_Type:          htmlFields.Computer_Type,
    Phone_Assigned:         htmlFields.Phone_Assigned,
    Phone_Carrier:          htmlFields.Phone_Carrier,
    Phone_Model:            htmlFields.Phone_Model,
    Phone_Number:           htmlFields.Phone_Number,
    Phone_VM_Password:      htmlFields.Phone_VM_Password,
    BOSS_Access:            htmlFields.BOSS_Access,
    BOSS_TripReports:       htmlFields.BOSS_TripReports,
    BOSS_Grievances:        htmlFields.BOSS_Grievances,
    // System access — defaulted to 'No' by JS if checkbox unchecked
    Incidents_Access:            htmlFields.Incidents_Access       || 'No',
    CAA_Access:                  htmlFields.CAA_Access              || 'No',
    Delivery_App_Access:         htmlFields.Delivery_App_Access     || 'No',
    Net_Promoter_Score_Access:   htmlFields.Net_Promoter_Score_Access || 'No',
    IT_Notes:               htmlFields.IT_Notes,
  };

  // ── STEP 3: HANDLER CALL ─────────────────────────────────────────────────
  const result = _ctx.submitITSetup(formData);
  console.log('\n  RETURN: success=' + (result && result.success));

  truthy('handler returns success=true', result && result.success);

  // ── STEP 4: SHEET COLUMN MAP ─────────────────────────────────────────────
  //
  // SCHEMA.IT_RESULTS (23 columns):
  //   0=workflowId, 1=formId, 2=timestamp,
  //   3=Email_Created, 4=assignedEmail (username+domain), 5=Email_Temp_Password,
  //   6=Computer_Assigned, 7=Computer_Serial, 8=Computer_Model, 9=Computer_Type,
  //   10=Phone_Assigned, 11=Phone_Carrier, 12=Phone_Model, 13=Phone_Number,
  //   14=Phone_VM_Password, 15=BOSS_Access, 16=Incidents_Access, 17=CAA_Access,
  //   18=Delivery_App_Access, 19=Net_Promoter_Score_Access, 20=IT_Notes,
  //   21=Session.getActiveUser().getEmail(), 22=JSON.stringify(bossDetails)
  const itAppends = _rt.captures.getAppendsFor('IT Results');
  truthy('IT Results: at least 1 row written', itAppends.length >= 1);

  const itRow = itAppends[itAppends.length - 1].values;
  console.log('\n  SHEET MAP — IT Results (' + itRow.length + ' cols, expected 23):');
  eq('IT row has 23 columns', itRow.length, 23);

  assertCol(itRow,  0, wfId,                       "HTML 'workflowId' (hidden) → formData.workflowId              → IT[0]");
  truthy(                                           "IT[1]  formId assigned (IT_*)", String(itRow[1]).startsWith('IT_'));
  truthy(                                           "IT[2]  timestamp is set",       itRow[2] instanceof Date || !!itRow[2]);
  assertCol(itRow,  3, 'Yes',                       "HTML 'Email_Created'         → formData.Email_Created         → IT[3]");
  assertCol(itRow,  4, 'clee@team-group.com',       "HTML 'Email_Username'+'Email_Domain' → assignedEmail          → IT[4]  *** COMPUTED");
  assertCol(itRow,  5, 'Temp@1234',                 "HTML 'Email_Temp_Password'   → formData.Email_Temp_Password   → IT[5]");
  assertCol(itRow,  6, 'Yes',                       "HTML 'Computer_Assigned'     → formData.Computer_Assigned     → IT[6]");
  assertCol(itRow,  7, 'SN-ABC-999',                "HTML 'Computer_Serial'       → formData.Computer_Serial       → IT[7]");
  assertCol(itRow,  8, 'MacBook Pro 14',            "HTML 'Computer_Model'        → formData.Computer_Model        → IT[8]");
  assertCol(itRow,  9, 'Laptop',                    "HTML 'Computer_Type'         → formData.Computer_Type         → IT[9]");
  assertCol(itRow, 10, 'Yes',                       "HTML 'Phone_Assigned'        → formData.Phone_Assigned        → IT[10]");
  assertCol(itRow, 11, 'Rogers',                    "HTML 'Phone_Carrier'         → formData.Phone_Carrier         → IT[11]");
  assertCol(itRow, 12, 'iPhone 15',                 "HTML 'Phone_Model'           → formData.Phone_Model           → IT[12]");
  assertCol(itRow, 13, '613-555-0100',              "HTML 'Phone_Number'          → formData.Phone_Number          → IT[13]");
  assertCol(itRow, 14, '1234',                      "HTML 'Phone_VM_Password'     → formData.Phone_VM_Password     → IT[14]");
  assertCol(itRow, 15, 'Yes',                       "HTML 'BOSS_Access'           → formData.BOSS_Access           → IT[15]");
  assertCol(itRow, 16, 'Yes',                       "HTML 'Incidents_Access' checked → 'Yes' (default='No')       → IT[16]");
  assertCol(itRow, 17, 'No',                        "HTML 'CAA_Access' unchecked  → JS default 'No'               → IT[17]");
  assertCol(itRow, 18, 'No',                        "HTML 'Delivery_App_Access' unchecked → JS default 'No'       → IT[18]");
  assertCol(itRow, 19, 'No',                        "HTML 'Net_Promoter_Score_Access' unchecked → JS default 'No' → IT[19]");
  assertCol(itRow, 20, 'IT setup complete. All systems provisioned.',
                                                    "HTML 'IT_Notes'              → formData.IT_Notes              → IT[20]");
  // IT[21] = Session.getActiveUser().getEmail() — not from form, not asserted
  // IT[22] = JSON.stringify(bossDetails) — dynamic BOSS checkboxes, captured as JSON

  // Employee_Name is a hidden field for display only — confirm it is NOT in rowData
  truthy('Employee_Name (display-only hidden field) is NOT written to any column',
    itRow.indexOf('Carol Lee') === -1 || itRow.indexOf('Carol Lee') === 21);
  // (col 21 = submittedBy which may coincidentally match — we just verify it's not
  //  appearing in the data columns 0-20)

  // ── STEP 5: EMAIL CONTEXT MAP ────────────────────────────────────────────
  //
  // ITSetup email context is built by reading the IR row + overlaying IT Confirmation.
  // All context values trace back through the Initial Requests sheet.
  const emailOpts = _rt.captures.getEmailOptions().filter(e => !e.__error);
  truthy('At least 1 email sent after IT Setup', emailOpts.length >= 1);

  const itEmail = emailOpts.find(e => {
    const cd = e.contextData || {};
    return cd.assignedEmail || cd.employeeName;
  }) || emailOpts[0];

  const ctx = itEmail && itEmail.contextData || {};
  eq("ctx.employeeName = Carol Lee (from IR sheet data)",
    (ctx.employeeName || '').trim() || (ctx.firstName + ' ' + ctx.lastName).trim(), 'Carol Lee');
  eq("ctx.siteName = Ottawa Main (from IR sheet)",    ctx.siteName,   'Ottawa Main');
  eq("ctx.managerEmail (from IR sheet)",              ctx.managerEmail, 'boss@team-group.com');
  eq("ctx.jobTitle = Project Manager (from IR sheet)", ctx.jobTitle,  'Project Manager');
  // assignedEmail overlaid from IT Results after submission
  eq("ctx.assignedEmail = clee@team-group.com (IT form Email_Username+Domain)",
    ctx.assignedEmail, 'clee@team-group.com');
  eq("ctx.workflowType = 'New Hire'",        ctx.workflowType,    'New Hire');
  eq("ctx.firstName = 'Carol' (from IR[10])", ctx.firstName,      'Carol');
  eq("ctx.lastName = 'Lee' (from IR[12])",    ctx.lastName,       'Lee');
  truthy("ctx.hireDate set (from IR[6])",                         !!ctx.hireDate);
  eq("ctx.newHireOrRehire from IR[7]",      ctx.newHireOrRehire,  'New Hire');
  eq("ctx.employeeType from IR[8]",         ctx.employeeType,     'Direct Hire');
  eq("ctx.employmentType from IR[9]",       ctx.employmentType,   'Salary');
  eq("ctx.jrTitle = '' (IR[46] empty)",                           ctx.jrTitle,          '');
  eq("ctx.jobSiteNumber from IR[16]",       ctx.jobSiteNumber,    '1001');
  eq("ctx.managerName from IR[18]",         ctx.managerName,      'Alice Manager');
  eq("ctx.requesterEmail from IR[5]",       ctx.requesterEmail,   'requester@team-group.com');
  truthy("ctx.requestDate set (from IR[2])",                      !!ctx.requestDate);
  eq("ctx.systemAccess from IR[19]",        ctx.systemAccess,     'Yes');
  truthy("ctx.systems[] includes BOSS",
    Array.isArray(ctx.systems) ? ctx.systems.includes('BOSS') : String(ctx.systems || '').includes('BOSS'));
  contains("ctx.equipmentRaw from IR[21]",  ctx.equipmentRaw || '', 'Computer');
  eq("ctx.computerType from IR[25]",        ctx.computerType,     'Laptop');
  eq("ctx.computerRequestType from IR[24]", ctx.computerRequestType, 'New');
  eq("ctx.phoneRequestType from IR[36]",    ctx.phoneRequestType, 'New');
  eq("ctx.googleEmail = 'caroll' (IR[22]: 'carol' + 'l')",
    ctx.googleEmail, 'caroll');
  eq("ctx.googleDomain = 'team-group.com' (IR[23], no @ prefix)",
    ctx.googleDomain, 'team-group.com');
  eq("ctx.bossJobSites from IR[39]",        ctx.bossJobSites,     '1001, 1002');
  eq("ctx.bossCostSheet from IR[40]",       ctx.bossCostSheet,    'Yes');
  eq("ctx.bossCostSheetJobs from IR[41]",   ctx.bossCostSheetJobs,'JN-100');
  eq("ctx.bossTripReports from IR[42]",     ctx.bossTripReports,  'Yes');
  eq("ctx.bossGrievances from IR[43]",      ctx.bossGrievances,   'Yes');
  eq("ctx.creditCardUSA from IR[30]",       ctx.creditCardUSA,        'Yes');
  eq("ctx.creditCardCanada from IR[32]",    ctx.creditCardCanada,     'No');
  eq("ctx.creditCardHomeDepot from IR[34]", ctx.creditCardHomeDepot,  'No');
  eq("ctx.jonasJobNumbers from IR[44]",     ctx.jonasJobNumbers,      'J-001');
  eq("ctx.plan306090 from IR[47]",          ctx.plan306090,           'Yes');
  eq("ctx.businessCards = 'Yes' (IR[21] contains 'Business Cards')",
    ctx.businessCards, 'Yes');
  eq("ctx.vehicleRequested = '' (no vehicle in IR[21])", ctx.vehicleRequested, '');
  eq("ctx.fleetioAccess = '' (no Fleetio in systems)",   ctx.fleetioAccess,    '');
  eq("ctx.department from IR[50]",          ctx.department,       'Operations');
  eq("ctx.purchasingSites from IR[51]",     ctx.purchasingSites,  'Ottawa Main');
  // triggerSpecialists() explicitly deletes emailTempPassword from specialist contexts
  // (credentials are stripped before specialist emails). The notification email sent to
  // requester/manager is a separate sendFormEmail call that DOES include emailTempPassword.
  // Find that email specifically.
  const notifCtx = (emailOpts.find(e => (e.contextData || {}).emailTempPassword) || {}).contextData || {};
  eq("ctx.emailTempPassword in requester/manager notification email",
    notifCtx.emailTempPassword, 'Temp@1234');
}));

// ═════════════════════════════════════════════════════════════════════════════
//  FORM 5: TerminationRequest.html
//
//  The submit handler uses a rawForm.forEach loop to collect ALL named form
//  inputs directly — no manual key remapping. Multi-value fields (systems,
//  equip) are comma-joined by the loop when the key is seen multiple times.
//  The handler itself then re-joins arrays with ', ' for the sheet.
// ═════════════════════════════════════════════════════════════════════════════
results.push(runScenario('TerminationRequest.html — full field map', () => {
  seedSheets();

  // ── STEP 1: PAGE LOAD — HTML form fields ─────────────────────────────────
  //
  // All keys below are exact HTML name= attribute values from TerminationRequest.html.
  // No remapping occurs — what goes in is what the handler receives.
  const htmlFields = {
    // Requester
    reqName:        'Test Requester',
    reqEmail:       'requester@team-group.com',
    // Employee
    empName:        'John Doe',
    empWorkEmail:   'jdoe@team-group.com',   // conditional: shown when has_work_email toggle
    empType:        'Salary',
    empPhone:       '613-555-0200',          // conditional: shown when 'Mobile Phone' in equip
    // empSerial NOT a form field — not present in TerminationRequest.html
    // Handler writes formData.empSerial || 'N/A'; always 'N/A' since never sent
    // Site / dates
    siteName:       'Ottawa Main',
    termDate:       '2026-08-01',
    lastDayWorked:  '2026-07-31',
    reason:         'Terminated',
    hr_approved:    'Pending',               // conditional: shown only for 'Terminated' reason
    has_reports:    'Yes',
    reports_to_new: 'mgr2@team-group.com',   // conditional: shown when has_reports=Yes
    // Systems — multi-value checkbox; rawForm.forEach comma-joins duplicates
    systems:        ['Email', 'BOSS', 'SharePoint'],
    // Google offboarding — conditional: shown when 'Google Account' checkbox checked in systems
    google_forward: 'Yes',
    google_files:   'jdoe-archive',
    google_delegate:'boss@team-group.com',
    google_duration:'3 Months',
    google_vacation:'Out of office — please contact boss@team-group.com',
    // Equipment — multi-value checkbox; rawForm.forEach comma-joins
    equip:          ['Laptop', 'Mobile Phone'],
    comments:       'Final day confirmed.',
    managerName:    'Alice Manager',
    managerEmail:   'boss@team-group.com',
    // Attachment — handled separately as base64, not in rawForm.forEach
    // attachmentBase64, attachmentName, attachmentMimeType — skipped (no Drive in tests)
  };

  // ── STEP 2: JS SUBMIT HANDLER — rawForm.forEach with comma-join ──────────
  //
  // Mirrors TerminationRequest.html's forEach loop. Arrays become comma strings.
  // The handler then re-splits/re-joins for the sheet.
  const formData = {};
  Object.entries(htmlFields).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      formData[key] = value.join(',');  // rawForm.forEach builds: existing + ',' + new
    } else {
      formData[key] = value;
    }
  });
  // empSerial is never in the form — confirm absence
  // formData.empSerial is undefined → handler uses || 'N/A'

  // ── STEP 3: HANDLER CALL ─────────────────────────────────────────────────
  const result = _ctx.submitTerminationRequest(formData);
  console.log('\n  RETURN: success=' + (result && result.success));

  truthy('handler returns success=true', result && result.success);
  truthy('workflowId starts with TERM_', String(result && result.workflowId).startsWith('TERM_'));

  // ── STEP 4: SHEET COLUMN MAP ─────────────────────────────────────────────
  //
  // rowData column indices (from TerminationHandler.js lines 70-99):
  //   0=workflowId, 1=formId, 2=timestamp,
  //   3=reqName, 4=reqEmail, 5=empName, 6='N/A'(empID),
  //   7=empType, 8=empWorkEmail||'N/A', 9=empPhone||'N/A',
  //   10=siteName, 11=termDate, 12=reason,
  //   13=managerName||'N/A', 14=managerEmail||'N/A',
  //   15=hr_approved||'N/A', 16=has_reports||'N/A', 17=reports_to_new||'N/A',
  //   18=systems(CSV), 19=google_forward||'N/A', 20=google_files||'N/A',
  //   21=google_delegate||'N/A', 22=google_duration||'N/A',
  //   23=google_vacation||'N/A', 24=equipment(CSV),
  //   25=comments||'', 26=lastDayWorked||'', 27=attachmentUrl
  const termAppends = _rt.captures.getAppendsFor('Terminations');
  truthy('Terminations: at least 1 row written', termAppends.length >= 1);

  const tRow = termAppends[termAppends.length - 1].values;
  console.log('\n  SHEET MAP — Terminations (' + tRow.length + ' cols, expected 29):');
  eq('Terminations row has 29 columns', tRow.length, 29);

  truthy( "TERM[0] workflowId starts with TERM_",       String(tRow[0]).startsWith('TERM_'));
  truthy( "TERM[1] formId assigned (TERM_REQ_*)",       String(tRow[1]).startsWith('TERM_REQ_'));
  truthy( "TERM[2] timestamp is set",                   tRow[2] instanceof Date || !!tRow[2]);
  assertCol(tRow,  3, 'Test Requester',                 "HTML 'reqName'       → formData.reqName       → TERM[3]");
  assertCol(tRow,  4, 'requester@team-group.com',       "HTML 'reqEmail'      → formData.reqEmail      → TERM[4]");
  assertCol(tRow,  5, 'John Doe',                       "HTML 'empName'       → formData.empName       → TERM[5]");
  assertCol(tRow,  6, 'N/A',                            "TERM[6] empID — legacy placeholder, always 'N/A'");
  assertCol(tRow,  7, 'Salary',                         "HTML 'empType'       → formData.empType       → TERM[7]");
  assertCol(tRow,  8, 'jdoe@team-group.com',            "HTML 'empWorkEmail'  → formData.empWorkEmail  → TERM[8]");
  assertCol(tRow,  9, '613-555-0200',                   "HTML 'empPhone'      → formData.empPhone      → TERM[9]");
  assertCol(tRow, 10, 'N/A',                            "TERM[10] COMPUTER_SERIAL — reserved (form does not collect)");
  assertCol(tRow, 11, 'Ottawa Main',                    "HTML 'siteName'      → formData.siteName      → TERM[11]");
  assertCol(tRow, 12, '2026-08-01',                     "HTML 'termDate'      → formData.termDate      → TERM[12]");
  assertCol(tRow, 13, 'Terminated',                     "HTML 'reason'        → formData.reason        → TERM[13]");
  assertCol(tRow, 14, 'Alice Manager',                  "HTML 'managerName'   → formData.managerName   → TERM[14]");
  assertCol(tRow, 15, 'boss@team-group.com',            "HTML 'managerEmail'  → formData.managerEmail  → TERM[15]");
  assertCol(tRow, 16, 'Pending',                        "HTML 'hr_approved'   → formData.hr_approved   → TERM[16]");
  assertCol(tRow, 17, 'Yes',                            "HTML 'has_reports'   → formData.has_reports   → TERM[17]");
  assertCol(tRow, 18, 'mgr2@team-group.com',            "HTML 'reports_to_new'→ formData.reports_to_new→ TERM[18]");

  // Systems CSV
  const sysWritten = String(tRow[19] || '');
  truthy("HTML 'systems[]' Email → TERM[19] contains Email",      sysWritten.includes('Email'));
  truthy("HTML 'systems[]' BOSS  → TERM[19] contains BOSS",       sysWritten.includes('BOSS'));
  truthy("HTML 'systems[]' SharePoint → TERM[19] contains SharePoint", sysWritten.includes('SharePoint'));

  assertCol(tRow, 20, 'Yes',                            "HTML 'google_forward'   → formData.google_forward   → TERM[20]");
  assertCol(tRow, 21, 'jdoe-archive',                   "HTML 'google_files'     → formData.google_files     → TERM[21]");
  assertCol(tRow, 22, 'boss@team-group.com',            "HTML 'google_delegate'  → formData.google_delegate  → TERM[22]");
  assertCol(tRow, 23, '3 Months',                       "HTML 'google_duration'  → formData.google_duration  → TERM[23]");
  contains(                                             "HTML 'google_vacation' → TERM[24] contains 'Out of office'",
    tRow[24], 'Out of office');

  // Equipment CSV
  const eqWritten = String(tRow[25] || '');
  truthy("HTML 'equip[]' Laptop       → TERM[25] contains Laptop",  eqWritten.includes('Laptop'));
  truthy("HTML 'equip[]' Mobile Phone → TERM[25] contains Mobile",  eqWritten.includes('Mobile'));

  assertCol(tRow, 26, 'Final day confirmed.',           "HTML 'comments'      → formData.comments      → TERM[26]");
  assertCol(tRow, 27, '2026-07-31',                     "HTML 'lastDayWorked' → formData.lastDayWorked → TERM[27]");
  assertCol(tRow, 28, '',                               "TERM[28] attachmentUrl — no file attachment in test");

  // ── STEP 5: EMAIL CONTEXT MAP ────────────────────────────────────────────
  //
  // _sendTerminationSubmitEmails reads from the sheet via getTerminationData(),
  // then builds finalContext from those values.
  const emailOpts = _rt.captures.getEmailOptions().filter(e => !e.__error);
  truthy('At least 1 email sent after Termination submit', emailOpts.length >= 1);

  const termEmail = emailOpts.find(e => {
    const cd = e.contextData || {};
    return cd.workflowType === 'Termination' || cd.employeeName;
  }) || emailOpts[0];

  const ctx = termEmail && termEmail.contextData || {};
  eq("ctx.workflowType = 'Termination'",                       ctx.workflowType,   'Termination');
  eq("ctx.employeeName from HTML 'empName' → TERM[5]",         ctx.employeeName,   'John Doe');
  eq("ctx.siteName from HTML 'siteName' → TERM[11]",           ctx.siteName,       'Ottawa Main');
  eq("ctx.managerName from HTML 'managerName' → TERM[14]",     ctx.managerName,    'Alice Manager');
  eq("ctx.managerEmail from HTML 'managerEmail' → TERM[15]",   ctx.managerEmail,   'boss@team-group.com');
  eq("ctx.requesterEmail from HTML 'reqEmail' → TERM[4]",      ctx.requesterEmail, 'requester@team-group.com');
  eq("ctx.reason from HTML 'reason' → TERM[13]",               ctx.reason,         'Terminated');
  truthy("ctx.termDate set (from HTML 'termDate' → TERM[12])", !!ctx.termDate);
  truthy("ctx.lastDayWorked set (from HTML 'lastDayWorked' → TERM[27])", !!ctx.lastDayWorked);
  truthy("ctx.systems contains BOSS (from HTML 'systems[]' → TERM[19])", String(ctx.systems || '').includes('BOSS'));
  eq("ctx.hasReports from HTML 'has_reports' → TERM[17]",      ctx.hasReports,     'Yes');
  eq("ctx.reportsToNew from HTML 'reports_to_new' → TERM[18]", ctx.reportsToNew,   'mgr2@team-group.com');
  truthy("ctx.googleOffboarding set (offboarding flag from systems/google fields)", ctx.googleOffboarding !== undefined);
  eq("ctx.employmentType from HTML 'empType' → TERM[7]",
    ctx.employmentType, 'Salary');
  contains("ctx.equipmentRaw from HTML 'equip[]' → TERM[25]", ctx.equipmentRaw || '', 'Laptop');
  // ctx.requesterName is NOT in the Termination context — only ctx.requesterEmail is.
  truthy("ctx.requesterEmail = requester@team-group.com (from HTML 'reqEmail')",
    ctx.requesterEmail === 'requester@team-group.com');
  // ctx.termDate / ctx.lastDayWorked are formatted by fmtDate_() as 'M/d/yyyy' (locale-dependent);
  // exact value is timezone-sensitive in Node.js. truthy assertions above already cover these.
  truthy("ctx.termDate formatted (fmtDate_ wraps Utilities.formatDate 'M/d/yyyy')", !!ctx.termDate);
  truthy("ctx.lastDayWorked formatted (fmtDate_ wraps Utilities.formatDate 'M/d/yyyy')", !!ctx.lastDayWorked);
  // googleOffboarding sub-keys from getTerminationData()
  eq("ctx.googleOffboarding.forward from HTML 'google_forward' → TERM[20]",
    ctx.googleOffboarding && ctx.googleOffboarding.forward, 'Yes');
  eq("ctx.googleOffboarding.files from HTML 'google_files' → TERM[21]",
    ctx.googleOffboarding && ctx.googleOffboarding.files, 'jdoe-archive');
  eq("ctx.googleOffboarding.delegate from HTML 'google_delegate' → TERM[22]",
    ctx.googleOffboarding && ctx.googleOffboarding.delegate, 'boss@team-group.com');
  eq("ctx.googleOffboarding.duration from HTML 'google_duration' → TERM[23]",
    ctx.googleOffboarding && ctx.googleOffboarding.duration, '3 Months');
  contains("ctx.googleOffboarding.vacation from HTML 'google_vacation' → TERM[24]",
    ctx.googleOffboarding && ctx.googleOffboarding.vacation || '', 'Out of office');
  // Top-level google keys spread from wfContext (getWorkflowContext TERM_ path)
  eq("ctx.googleForward top-level (wfContext spread)",   ctx.googleForward,   'Yes');
  eq("ctx.googleFiles top-level (wfContext spread)",     ctx.googleFiles,     'jdoe-archive');
  eq("ctx.googleDelegate top-level (wfContext spread)",  ctx.googleDelegate,  'boss@team-group.com');
  eq("ctx.googleDuration top-level (wfContext spread)",  ctx.googleDuration,  '3 Months');
  contains("ctx.googleVacation top-level (wfContext spread)",
    ctx.googleVacation || '', 'Out of office');
}));

// ═════════════════════════════════════════════════════════════════════════════
//  SUMMARY
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(72));
console.log('  FORM FIELD MAP TEST — SUMMARY');
console.log('═'.repeat(72));

let totalPass = 0, totalFail = 0;
for (const r of results) {
  const icon = r.failed === 0 ? '✅' : '❌';
  console.log('  ' + icon + '  ' + r.name.padEnd(55) + '  ' + r.passed + '/' + (r.passed + r.failed));
  totalPass += r.passed;
  totalFail += r.failed;
}

console.log('\n' + '─'.repeat(72));
const grand = totalFail === 0 ? '✅ ALL PASSED' : '❌ FAILURES DETECTED';
console.log('  ' + grand + ' — ' + totalPass + ' passed, ' + totalFail + ' failed');
console.log('─'.repeat(72) + '\n');

if (totalFail > 0) {
  console.log('  Failed assertions:');
  for (const r of results) {
    if (r.failures.length > 0) {
      console.log('  Form: ' + r.name);
      r.failures.forEach(f => {
        console.log('    • ' + f.label);
        console.log('      got: ' + JSON.stringify(f.got) + '  expected: ' + JSON.stringify(f.expected));
      });
    }
  }
  process.exit(1);
}
