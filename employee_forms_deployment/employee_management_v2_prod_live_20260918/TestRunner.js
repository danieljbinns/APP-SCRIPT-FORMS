/**
 * ============================================================
 *  TestRunner.js  —  DEV ONLY
 * ============================================================
 *  Chains every new-hire workflow handler in sequence and
 *  forces ALL outbound email to dbinns@team-group.com via
 *  the EMAIL_REDIRECT_ALL Script Property.
 *
 *  HOW TO USE
 *  ----------
 *  1. Open GAS editor in employee_management_v2_dev project.
 *  2. Select function → runFullTestWorkflow → Run.
 *  3. Watch Logger output — each step prints its result.
 *  4. To clean up: select cleanupAllTestWorkflows → Run.
 *
 *  EMAIL_REDIRECT_ALL is SET before the run and CLEARED after,
 *  so no real production emails go out. If the script crashes
 *  mid-run the property may stay set — run restoreEmailRedirect()
 *  to clear it. No other Script Properties are used by TestRunner.
 *
 *  ENTRY POINTS (run from GAS editor)
 *  ------------------------------------
 *  runFullTestWorkflow()       — end-to-end new hire test
 *  cleanupAllTestWorkflows()   — delete all rows written by test runs
 *  restoreEmailRedirect()      — emergency: clear redirect property
 * ============================================================
 */

// ── Quick email test ──────────────────────────────────────────────────────────

/**
 * Sends a single test email to TEST_EMAIL via sendFormEmail.
 * Run this first to confirm email plumbing works before running full workflows.
 */
function testEmailSend() {
  sendFormEmail({
    to: TEST_EMAIL,
    subject: 'Email Test — ' + new Date().toLocaleTimeString(),
    body: 'Email sending is working. If you got this, the plumbing is fine.',
    contextData: { workflowType: 'Test', employeeName: 'Test Employee' }
  });
  Logger.log('[TestRunner] Test email sent to ' + TEST_EMAIL);
}

// ── Guard ─────────────────────────────────────────────────────────────────────

/** Warns if running outside DEV but allows execution. */
function _assertDevOnly() {
  if (typeof ENVIRONMENT === 'undefined' || ENVIRONMENT !== 'DEV') {
    Logger.log('[TestRunner] WARNING: Running in ' + (typeof ENVIRONMENT !== 'undefined' ? ENVIRONMENT : 'unknown') + ' — test data will be written to this spreadsheet. Run cleanupAllTestWorkflows() when done.');
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

var TEST_EMAIL = 'dbinns@team-group.com';

/** Employee name written by every test run — used to find test rows in the sheet. */
var TEST_EMPLOYEE_NAME = 'TestFirst TestLast';

// ── Test Data ─────────────────────────────────────────────────────────────────

/**
 * Realistic test data for a new hire.
 * All email addresses point to TEST_EMAIL via the redirect, so these values
 * only appear in email bodies / logs — no real mail reaches them.
 */
var TEST_INITIAL_REQUEST = {
  // Requester
  requesterName:        'Test Runner',
  requesterEmail:       TEST_EMAIL,
  dateRequested:        new Date().toISOString().substring(0, 10),

  // Employee
  firstName:            'TestFirst',
  lastName:             'TestLast',
  middleName:           '',
  preferredName:        '',
  hireDate:             '2099-01-15',         // far-future date — easy to spot
  newHireOrRehire:      'New Hire',
  employeeType:         'Salaried',
  employmentType:       'Full-Time',

  // Position
  positionTitle:        'Test Position',
  siteName:             'Test Site — DO NOT USE',
  jobSiteNumber:        '9999',
  department:           'IT',
  reportingManagerName: 'Test Manager',
  reportingManagerEmail: TEST_EMAIL,

  // Access & systems
  systemAccess:         'Yes',
  systems:              ['BOSS', 'SiteDocs'],
  equipment:            ['Laptop', 'Business Cards'],

  // Google account — no email requested (Email_Created will be 'No' in IT Setup)
  googleEmail:          '',
  googleDomain:         '',

  // Computer
  computerRequestType:  'New',
  computerType:         'Laptop',
  computerPreviousUser: '',
  computerPreviousType: '',
  computerSerialNumber: '',
  office365Required:    'Yes',

  // Credit card — none (avoids CreditCard action item)
  creditCardUSA:        'No',
  creditCardLimitUSA:   '',
  creditCardCanada:     'No',
  creditCardLimitCanada:'',
  creditCardHomeDepot:  'No',
  creditCardLimitHomeDepot: '',

  // Phone
  phoneRequestType:     'None',
  phonePreviousUser:    '',
  phonePreviousNumber:  '',

  // BOSS access
  bossJobSites:         '',
  bossCostSheet:        'No',
  bossCostSheetJobs:    '',
  bossTripReports:      'No',
  bossGrievances:       'No',

  // Jonas — none (avoids Jonas action item)
  jonasJobNumbers:      '',

  // JR / 30-60-90 — none (keeps specialist list minimal)
  jrRequired:           'No',
  jrAssignment:         '',
  plan306090:           'No',

  // Misc
  comments:             'AUTOMATED TEST — DELETE AFTER REVIEW',
  adpSites:             [],
  purchasingSites:      [],
  adpSalaryAccess:      'No'
};

var TEST_ID_SETUP = function(workflowId) {
  return {
    workflowId:        workflowId,
    internalEmployeeId: '99999',
    siteDocsWorkerId:  'TEST-WID-001',
    siteDocsJobCode:   'TEST-JC-001',
    siteDocsUsername:  'testfirst.testlast@sitedocs.test',
    siteDocsPassword:  'TestPass123!',
    dssUsername:       'testfirst.testlast',
    dssPassword:       'TestPass123!',
    bossWisCreated:    'No',
    setupNotes:        'AUTOMATED TEST'
  };
};

var TEST_HR_VERIFICATION = function(workflowId) {
  return {
    workflowId:      workflowId,
    firstName:       'TestFirst',
    lastName:        'TestLast',
    hireDate:        '2099-01-15',
    siteName:        'Test Site — DO NOT USE',
    managerName:     'Test Manager',
    managerEmail:    TEST_EMAIL,
    adpAssociateId:  'ADP-TEST-99999',
    jobTitle:        'Test Position',
    jrTitle:         '',
    department:      'IT',
    notes:           'AUTOMATED TEST'
  };
};

/**
 * IT Confirmation — Dave's review step.
 * Passes back the same data so nothing gets changed by "confirmation".
 */
var TEST_IT_CONFIRMATION = function(workflowId) {
  return {
    workflowId:            workflowId,
    hireType:              'New Hire',
    employeeType:          'Salaried',
    employmentType:        'Full-Time',
    firstName:             'TestFirst',
    lastName:              'TestLast',
    middleName:            '',
    preferredName:         '',
    positionTitle:         'Test Position',
    siteName:              'Test Site — DO NOT USE',
    jobSiteNumber:         '9999',
    reportingManagerName:  'Test Manager',
    reportingManagerEmail: TEST_EMAIL,
    systemAccess:          'Yes',
    systems:               ['BOSS', 'SiteDocs'],
    equipment:             ['Laptop', 'Business Cards'],
    googleEmail:           '',
    googleDomain:          '',
    computerRequestType:   'New',
    computerType:          'Laptop',
    phoneRequestType:      'None',
    bossJobSites:          '',
    bossCostSheet:         'No',
    bossCostSheetJobs:     '',
    bossTripReports:       'No',
    bossGrievances:        'No',
    jonasJobNumbers:       '',
    adpSites:              [],
    department:            'IT',
    purchasingSites:       [],
    notes:                 'AUTOMATED TEST — IT confirmation pass-through'
  };
};

var TEST_IT_SETUP = function(workflowId) {
  return {
    workflowId:             workflowId,
    Email_Created:          'No',    // no Google account — keeps assignedEmail ''
    Email_Username:         '',
    Email_Domain:           '',
    Email_Temp_Password:    '',
    Computer_Assigned:      'Yes',
    Computer_Serial:        'TEST-SERIAL-001',
    Computer_Model:         'Test MacBook',
    Computer_Type:          'Laptop',
    Phone_Assigned:         'No',
    Phone_Carrier:          '',
    Phone_Model:            '',
    Phone_Number:           '',
    Phone_VM_Password:      '',
    BOSS_Access:            'Yes',
    Incidents_Access:       'No',
    CAA_Access:             'No',
    Delivery_App_Access:    'No',
    Net_Promoter_Score_Access: 'No',
    IT_Notes:               'AUTOMATED TEST'
  };
};

// ── Email redirect helpers ────────────────────────────────────────────────────

/**
 * Redirect all outbound email to TEST_EMAIL for the duration of the test.
 * Saves the previous value so restoreEmailRedirect() can put it back.
 */
function setTestEmailRedirect() {
  const props = PropertiesService.getScriptProperties();
  const prev  = props.getProperty('EMAIL_REDIRECT_ALL') || '';
  props.setProperty('_PREV_EMAIL_REDIRECT_ALL', prev);
  props.setProperty('EMAIL_REDIRECT_ALL', TEST_EMAIL);
  Logger.log('[TestRunner] EMAIL_REDIRECT_ALL → ' + TEST_EMAIL);
}

/**
 * Restore EMAIL_REDIRECT_ALL to whatever it was before the test.
 * Safe to call even if setTestEmailRedirect was never called.
 */
function restoreEmailRedirect() {
  const props = PropertiesService.getScriptProperties();
  const prev  = props.getProperty('_PREV_EMAIL_REDIRECT_ALL') || '';
  props.setProperty('EMAIL_REDIRECT_ALL', prev);
  props.deleteProperty('_PREV_EMAIL_REDIRECT_ALL');
  Logger.log('[TestRunner] EMAIL_REDIRECT_ALL restored → "' + prev + '"');
}

// ── Workflow ID tracker (sheet-based, no Script Properties) ──────────────────

/**
 * Scans the Workflows sheet for rows whose Employee Name matches TEST_EMPLOYEE_NAME.
 * Returns an array of workflow ID strings.
 */
function _getTestWorkflowIds() {
  const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const WF   = SCHEMA.WORKFLOWS;
  const data = sheet.getDataRange().getValues();
  const ids  = [];
  for (var i = SCHEMA.ROW.FIRST_DATA; i < data.length; i++) {
    if (String(data[i][WF.EMPLOYEE_NAME] || '') === TEST_EMPLOYEE_NAME) {
      ids.push(String(data[i][WF.WORKFLOW_ID] || '').trim());
    }
  }
  return ids.filter(Boolean);
}

// ── Step runners ─────────────────────────────────────────────────────────────

function _step(label, fn) {
  Logger.log('──────────────────────────────────────────');
  Logger.log('[TestRunner] STEP: ' + label);
  try {
    const result = fn();
    Logger.log('[TestRunner] RESULT: ' + JSON.stringify(result));
    if (result && result.success === false) {
      throw new Error('Step returned success:false — ' + (result.message || '(no message)'));
    }
    return result;
  } catch (e) {
    Logger.log('[TestRunner] FAILED: ' + e.message);
    throw e;
  }
}

// ── Action Item closer ────────────────────────────────────────────────────────

/**
 * Close every open Action Item for workflowId.
 * Iterates until no open items remain (handles items created by closing others).
 */
function _closeAllActionItems(workflowId) {
  Logger.log('[TestRunner] Closing all action items for ' + workflowId);
  var closed = 0;
  var maxPasses = 10; // safety cap against infinite loops

  for (var pass = 0; pass < maxPasses; pass++) {
    var pending = ActionItemService.getPendingTasks(workflowId);
    if (pending.length === 0) break;

    Logger.log('[TestRunner] Pass ' + (pass + 1) + ': ' + pending.length + ' open item(s)');
    var AI = SCHEMA.ACTION_ITEMS;

    pending.forEach(function(row) {
      var taskId = row[AI.TASK_ID];
      Logger.log('[TestRunner]   Closing task ' + taskId + ' (' + row[AI.TASK_NAME] + ')');
      var result = ActionItemService.closeActionItem(
        taskId,
        'AUTOMATED TEST CLOSE',
        TEST_EMAIL,
        null,
        null
      );
      Logger.log('[TestRunner]   closeActionItem → ' + JSON.stringify(result));
      closed++;
    });
  }

  Logger.log('[TestRunner] Closed ' + closed + ' action item(s) total.');
  return closed;
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Run a complete end-to-end new hire workflow.
 * All emails are redirected to TEST_EMAIL.
 * The workflow ID is stored in Script Properties for later cleanup.
 *
 * Steps:
 *   1. Initial Request
 *   2. Employee ID Setup
 *   3. HR Verification
 *   4. IT Confirmation (Dave's review)
 *   5. IT Setup
 *   6. Close all Action Items (triggers workflow completion)
 */
function runFullTestWorkflow() {
  _assertDevOnly();

  Logger.log('══════════════════════════════════════════');
  Logger.log('[TestRunner] START — ' + new Date().toISOString());
  Logger.log('══════════════════════════════════════════');

  setTestEmailRedirect();

  var workflowId;

  try {
    // ── Step 1: Initial Request ──────────────────────────────────────────────
    var initResult = _step('1. submitInitialRequest', function() {
      return submitInitialRequest(TEST_INITIAL_REQUEST);
    });
    workflowId = initResult.workflowId;
    Logger.log('[TestRunner] Workflow ID: ' + workflowId);

    // ── Step 2: Employee ID Setup ────────────────────────────────────────────
    _step('2. submitEmployeeIDSetup', function() {
      return submitEmployeeIDSetup(TEST_ID_SETUP(workflowId));
    });

    // ── Step 3: HR Verification ──────────────────────────────────────────────
    _step('3. submitHRVerification', function() {
      return submitHRVerification(TEST_HR_VERIFICATION(workflowId));
    });

    // ── Step 4: IT Confirmation (Dave's review) ──────────────────────────────
    _step('4. submitITConfirmation', function() {
      return submitITConfirmation(TEST_IT_CONFIRMATION(workflowId));
    });

    // ── Step 5: IT Setup ─────────────────────────────────────────────────────
    _step('5. submitITSetup', function() {
      return submitITSetup(TEST_IT_SETUP(workflowId));
    });

    // ── Step 6: Close all Action Items ───────────────────────────────────────
    Logger.log('──────────────────────────────────────────');
    Logger.log('[TestRunner] STEP: 6. Close all Action Items');
    _closeAllActionItems(workflowId);

    Logger.log('══════════════════════════════════════════');
    Logger.log('[TestRunner] DONE. Workflow ID: ' + workflowId);
    Logger.log('[TestRunner] Run cleanupAllTestWorkflows() to delete test data.');
    Logger.log('══════════════════════════════════════════');

  } catch (e) {
    Logger.log('[TestRunner] ABORTED at step — ' + e.message);
    Logger.log('[TestRunner] Partial workflow ID (if any): ' + (workflowId || 'none'));
    Logger.log('[TestRunner] Run cleanupAllTestWorkflows() to remove partial data.');
  } finally {
    restoreEmailRedirect();
  }

  return workflowId || null;
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

/**
 * Hard-delete all rows written by test runs from every sheet.
 * Scans all sheets for rows where column A matches a test workflow ID.
 * Logs deleted row counts per sheet for confirmation.
 */
function cleanupAllTestWorkflows() {
  _assertDevOnly();

  var ids = _getTestWorkflowIds();
  if (ids.length === 0) {
    Logger.log('[TestRunner] No test workflows found — nothing to delete.');
    return { deleted: 0, sheets: {} };
  }

  Logger.log('[TestRunner] Found ' + ids.length + ' test workflow(s): ' + ids.join(', '));
  return _purgeWorkflowRows(ids);
}

/**
 * Hard-delete a specific test workflow by ID.
 * @param {string} workflowId
 */
function cleanupTestWorkflow(workflowId) {
  _assertDevOnly();
  if (!workflowId) { Logger.log('[TestRunner] cleanupTestWorkflow: no ID provided.'); return; }
  Logger.log('[TestRunner] Purging workflow: ' + workflowId);
  return _purgeWorkflowRows([workflowId]);
}

/**
 * Scan every sheet and delete rows where column A is in workflowIds.
 * Iterates bottom-up per sheet so row indices stay valid while deleting.
 * @param {string[]} workflowIds
 * @returns {{ totalDeleted: number, sheets: Object }}
 */
function _purgeWorkflowRows(workflowIds) {
  var ss       = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheets   = ss.getSheets();
  var idSet    = {};
  workflowIds.forEach(function(id) { idSet[id] = true; });

  var totalDeleted = 0;
  var report       = {};

  sheets.forEach(function(sheet) {
    var name    = sheet.getName();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return; // header only or empty

    var colA    = sheet.getRange(1, 1, lastRow, 1).getValues();
    var toDelete = [];

    for (var r = lastRow - 1; r >= 1; r--) { // skip header row 0
      var cellVal = String(colA[r][0] || '').trim();
      if (idSet[cellVal]) toDelete.push(r + 1); // 1-based
    }

    if (toDelete.length === 0) return;

    // Delete from bottom up (already collected bottom-up, but sort descending to be safe)
    toDelete.sort(function(a, b) { return b - a; });
    toDelete.forEach(function(rowNum) { sheet.deleteRow(rowNum); });

    report[name] = toDelete.length;
    totalDeleted += toDelete.length;
    Logger.log('[TestRunner] Deleted ' + toDelete.length + ' row(s) from "' + name + '"');
  });

  Logger.log('[TestRunner] Cleanup complete — ' + totalDeleted + ' total row(s) deleted across ' + Object.keys(report).length + ' sheet(s).');
  Logger.log('[TestRunner] Summary: ' + JSON.stringify(report));
  return { totalDeleted: totalDeleted, sheets: report };
}

/**
 * Print all test workflow IDs found in the sheet to the Logger.
 * Finds them by Employee Name = TEST_EMPLOYEE_NAME ("TestFirst TestLast").
 */
function listTestWorkflows() {
  _assertDevOnly();
  var ids = _getTestWorkflowIds();
  Logger.log('[TestRunner] Test workflows in sheet (' + ids.length + '):');
  ids.forEach(function(id) { Logger.log('  ' + id); });
  return ids;
}

// ── Sheet / email check helpers ───────────────────────────────────────────────

/** Log a PASS line. */
function _chkPass(label, val) {
  Logger.log('[CHECK ✓] ' + label + (val !== undefined ? ' = "' + val + '"' : ''));
}

/** Log a FAIL line and throw so the test aborts. */
function _chkFail(label, detail) {
  var msg = '[CHECK ✗] ' + label + (detail ? ' — ' + detail : '');
  Logger.log(msg);
  throw new Error(msg);
}

/** Assert a value is non-empty. */
function _chkNotEmpty(label, val) {
  if (val === null || val === undefined || String(val).trim() === '') {
    _chkFail(label, 'expected non-empty, got "' + val + '"');
  }
  _chkPass(label, val);
}

/** Assert a value equals expected. */
function _chkEquals(label, actual, expected) {
  if (String(actual) !== String(expected)) {
    _chkFail(label, 'expected "' + expected + '" got "' + actual + '"');
  }
  _chkPass(label, actual);
}

/** Assert a string value contains a substring. */
function _chkContains(label, actual, substr) {
  if (String(actual).indexOf(substr) === -1) {
    _chkFail(label, 'expected to contain "' + substr + '", got "' + actual + '"');
  }
  _chkPass(label, actual);
}

/**
 * Confirm emails are suppressed for dev.
 * Run this any time you want to verify the dev email state.
 */
function checkDevEmailSuppression() {
  Logger.log('══ Email Suppression Check ══');
  var suppressed = (typeof CONFIG !== 'undefined' && CONFIG.SUPPRESS_EMAILS === true);
  Logger.log('  CONFIG.SUPPRESS_EMAILS  : ' + (suppressed ? '✓ true (emails log only)' : '✗ FALSE — emails will send!'));

  var redirect = PropertiesService.getScriptProperties().getProperty('EMAIL_REDIRECT_ALL') || '';
  Logger.log('  EMAIL_REDIRECT_ALL prop : ' + (redirect ? '"' + redirect + '" (all mail → this address)' : '(not set)'));

  if (!suppressed && !redirect) {
    Logger.log('  ⚠ WARNING: Neither suppression nor redirect is active — real emails will fire!');
  } else {
    Logger.log('  ✓ Safe to run tests — no real emails will reach recipients.');
  }
  Logger.log('════════════════════════════');
  return { suppressed: suppressed, redirect: redirect };
}

/**
 * Read the Position Changes sheet row for workflowId and assert key fields.
 * @param {string} workflowId
 * @param {boolean} expectAttachmentUrl  - true if a Drive URL should be in col BI
 */
function _checkPositionChangeSheet(workflowId, expectAttachmentUrl) {
  Logger.log('[TestRunner] — Sheet check: Position Changes —');
  var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEETS.POSITION_CHANGES);
  if (!sheet) _chkFail('Position Changes sheet', 'sheet not found');

  var data = sheet.getDataRange().getValues();
  var PC   = SCHEMA.POSITION_CHANGES;
  var row  = null;
  for (var i = SCHEMA.ROW.FIRST_DATA; i < data.length; i++) {
    if (String(data[i][PC.WORKFLOW_ID]) === workflowId) { row = data[i]; break; }
  }
  if (!row) _chkFail('Position Changes row', 'workflowId ' + workflowId + ' not found in sheet');

  _chkEquals  ('WORKFLOW_ID',      row[PC.WORKFLOW_ID],     workflowId);
  _chkNotEmpty ('REQUESTER_NAME',   row[PC.REQUESTER_NAME]);
  _chkNotEmpty ('EMPLOYEE_NAME',    row[PC.EMPLOYEE_NAME]);
  _chkNotEmpty ('EFFECTIVE_DATE',   row[PC.EFFECTIVE_DATE]);
  _chkNotEmpty ('CHANGE_TYPES',     row[PC.CHANGE_TYPES]);
  _chkNotEmpty ('BOSS_SITES',       row[PC.BOSS_SITES]);
  _chkNotEmpty ('BOSS_COST_SHEET',  row[PC.BOSS_COST_SHEET]);
  _chkNotEmpty ('BOSS_COST_JOBS',   row[PC.BOSS_COST_JOBS]);
  _chkNotEmpty ('ADP_SITES',        row[PC.ADP_SITES]);
  _chkNotEmpty ('CC_USA',           row[PC.CC_USA]);
  _chkNotEmpty ('EQUIPMENT_RETURN', row[PC.EQUIPMENT_RETURN]);
  _chkNotEmpty ('JONAS_JOB_NUMBERS',row[PC.JONAS_JOB_NUMBERS]);
  _chkEquals  ('STATUS',            row[PC.STATUS],          'In Progress');

  if (expectAttachmentUrl) {
    _chkContains('ATTACHMENT_URL', row[PC.ATTACHMENT_URL], 'https://');
  } else {
    _chkPass('ATTACHMENT_URL (no file — empty expected)', row[PC.ATTACHMENT_URL]);
  }
}

/**
 * Read the Terminations sheet row for workflowId and assert key fields.
 * @param {string} workflowId
 * @param {boolean} expectAttachmentUrl
 */
function _checkTerminationSheet(workflowId, expectAttachmentUrl) {
  Logger.log('[TestRunner] — Sheet check: Terminations —');
  var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEETS.TERMINATIONS);
  if (!sheet) _chkFail('Terminations sheet', 'sheet not found');

  var data = sheet.getDataRange().getValues();
  var TR   = SCHEMA.TERMINATIONS;
  var row  = null;
  for (var i = SCHEMA.ROW.FIRST_DATA; i < data.length; i++) {
    if (String(data[i][TR.WORKFLOW_ID]) === workflowId) { row = data[i]; break; }
  }
  if (!row) _chkFail('Terminations row', 'workflowId ' + workflowId + ' not found in sheet');

  _chkEquals  ('WORKFLOW_ID',    row[TR.WORKFLOW_ID],  workflowId);
  _chkNotEmpty ('EMPLOYEE_NAME', row[TR.EMPLOYEE_NAME]);
  _chkNotEmpty ('TERM_DATE',     row[TR.TERM_DATE]);
  _chkNotEmpty ('REASON',        row[TR.REASON]);
  _chkNotEmpty ('SITE',          row[TR.SITE]);

  if (expectAttachmentUrl) {
    _chkContains('ATTACHMENT_URL', row[TR.ATTACHMENT_URL], 'https://');
  } else {
    _chkPass('ATTACHMENT_URL (no file — empty expected)', row[TR.ATTACHMENT_URL]);
  }
}

/**
 * Assert that at least one action item exists for each category in expectedCategories.
 * @param {string} workflowId
 * @param {string[]} expectedCategories
 */
function _checkActionItemsExist(workflowId, expectedCategories) {
  Logger.log('[TestRunner] — Action Items check —');
  var tasks = ActionItemService.getPendingTasks(workflowId);
  Logger.log('[TestRunner]   Total open tasks: ' + tasks.length);
  var AI = SCHEMA.ACTION_ITEMS;

  var found = {};
  tasks.forEach(function(row) {
    var cat = String(row[AI.CATEGORY] || '');
    found[cat] = (found[cat] || 0) + 1;
    Logger.log('[TestRunner]   [' + cat + '] ' + row[AI.TASK_NAME]);
  });

  expectedCategories.forEach(function(cat) {
    if (found[cat]) {
      _chkPass('Action Item category "' + cat + '"', found[cat] + ' task(s)');
    } else {
      _chkFail('Action Item category "' + cat + '"', 'not found among created tasks');
    }
  });
}

// ── Position Change Test ──────────────────────────────────────────────────────

var TEST_POSITION_CHANGE = {
  // Requester
  reqName:  'Test Runner',
  reqEmail: TEST_EMAIL,
  reqDate:  new Date().toISOString().substring(0, 10),

  // Employee
  firstName:  'TestFirst',
  lastName:   'TestLast',
  siteName:   'Test Site — DO NOT USE',
  effDate:    '2099-06-01',

  // Change types
  changeType: ['Site Transfer', 'Title Change', 'Classification Change'],

  // Site transfer
  siteOld: 'Old Site', siteNew: 'New Site',

  // Title
  titleOld: 'Junior Tester', titleNew: 'Senior Tester',

  // Classification
  classOld: 'Hourly', classNew: 'Salary',
  currentClass: 'Hourly',

  // Manager
  currentTitle:        'Junior Tester',
  currentManagerName:  'Old Manager',
  currentManagerEmail: TEST_EMAIL,
  mgrOldName:          'Old Manager',
  mgrOldEmail:         TEST_EMAIL,
  mgrNewName:          'New Manager',
  mgrNewEmail:         TEST_EMAIL,
  receivingManagerEmail: TEST_EMAIL,
  oldReportsTo:        '',
  newReportsFrom:      '',

  // Google
  existingEmail: 'testfirst.testlast@team-group.com',
  googleEmail:   '', googleDomain:  '',

  // Systems & equipment
  sys:      ['BOSS', 'ADP Supervisor Access'],
  equip:    ['Computer', 'Business Cards', 'Credit Card'],
  rem:      ['SiteDocs', 'Fleetio'],
  equipRem: ['Vehicle', 'Credit Card'],

  // BOSS details
  bossTrainingOnly: 'No',
  bossComm:    ['North Region', 'Safety'],
  bossCost:    'Yes',
  bossCostJobs: ['J-1001', 'J-1002'],
  bossTrip:    'Yes',
  bossGriev:   'Yes',

  // ADP details
  adpSites:        ['9999'],
  adpSalaryAccess: 'Yes',

  // JR / 30-60-90
  jrReq:     'Yes',
  jrTitle:   'Test JR Title',
  plan306090: 'Yes',

  // Computer
  computerRequestType:  'Reassignment',
  computerType:         'Laptop',
  computerPreviousUser: 'Previous User',
  computerPreviousType: 'Windows',
  computerSerialNumber: 'TEST-SER-001',
  office365Required:    'Yes',

  // Credit card
  creditCardUSA:          'Yes', creditCardLimitUSA:        '2000',
  creditCardCanada:        'Yes', creditCardLimitCanada:      '1000',
  creditCardHomeDepot:     'No',  creditCardLimitHomeDepot:   '',

  // Phone
  phoneRequestType:  'None',
  phonePreviousUser: '', phonePreviousNumber: '',

  // Jonas & purchasing
  jonasJobs:      ['12345'],
  purchasingSites: ['9001'],

  // Misc
  comments:   'AUTOMATED TEST — DELETE AFTER REVIEW',
  department: 'Operations'
};

var TEST_PC_APPROVAL = function(workflowId) {
  return {
    workflowId:           workflowId,
    decision:             'Approved',
    notes:                'AUTOMATED TEST APPROVAL',
    confirmedTitle:       'Senior Tester',
    confirmedNewManager:  TEST_EMAIL,
    confirmedJrTitle:     'Test JR Title'
  };
};

/**
 * End-to-end position change test with sheet checks and attachment simulation.
 *
 * Steps:
 *   1. Email suppression check
 *   2. Submit position change (with simulated attachment)
 *   3. Sheet check — all 61 cols populated, attachment URL present
 *   4. HR approval
 *   5. Action items check — expected categories present
 *   6. syncWorkflowState
 */
function runPositionChangeTest() {
  _assertDevOnly();

  Logger.log('══════════════════════════════════════════');
  Logger.log('[TestRunner] POSITION CHANGE TEST — ' + new Date().toISOString());
  Logger.log('══════════════════════════════════════════');

  var workflowId;

  try {
    // Step 1: Confirm emails are suppressed
    checkDevEmailSuppression();

    // Step 2: Submit with a simulated attachment
    var formDataWithAttachment = {};
    for (var k in TEST_POSITION_CHANGE) formDataWithAttachment[k] = TEST_POSITION_CHANGE[k];
    formDataWithAttachment.attachmentBase64  = Utilities.base64Encode('AUTOMATED TEST ATTACHMENT — position change');
    formDataWithAttachment.attachmentName    = 'test-attachment.txt';
    formDataWithAttachment.attachmentMimeType = 'text/plain';

    var initResult = _step('1. submitPositionChangeRequest (with attachment)', function() {
      return submitPositionChangeRequest(formDataWithAttachment);
    });
    workflowId = initResult.workflowId;
    Logger.log('[TestRunner] Workflow ID: ' + workflowId);

    // Step 3: Sheet checks
    _checkPositionChangeSheet(workflowId, true /* expectAttachmentUrl */);

    // Step 4: HR approval
    _step('2. submitPositionChangeApproval', function() {
      return submitPositionChangeApproval(TEST_PC_APPROVAL(workflowId));
    });

    // Step 5: Action items check
    _checkActionItemsExist(workflowId, [
      'Manager', 'IT', 'Business Cards', 'Credit Card', 'Fleetio', 'Jonas', 'Safety', 'ID Setup'
    ]);

    // Step 6: State sync
    syncWorkflowState(workflowId);
    Logger.log('[TestRunner] syncWorkflowState called — check Dashboard_View sheet');

    Logger.log('══════════════════════════════════════════');
    Logger.log('[TestRunner] POSITION CHANGE TEST PASSED ✓  Workflow ID: ' + workflowId);
    Logger.log('[TestRunner] Run cleanupAllTestWorkflows() to remove test data.');
    Logger.log('══════════════════════════════════════════');

  } catch (e) {
    Logger.log('[TestRunner] POSITION CHANGE TEST FAILED ✗ — ' + e.message);
    Logger.log('[TestRunner] Partial workflow ID (if any): ' + (workflowId || 'none'));
    throw e;
  }

  return workflowId || null;
}

// ── Termination Test ──────────────────────────────────────────────────────────

var TEST_TERMINATION = {
  reqName:             'Test Runner',
  reqEmail:            TEST_EMAIL,
  empName:             TEST_EMPLOYEE_NAME,
  empType:             'Salaried',
  empWorkEmail:        'testfirst.testlast@team-group.com',
  empPhone:            '555-0100',
  empSerial:           'TEST-SER-001',
  siteName:            'Test Site — DO NOT USE',
  termDate:            '2099-06-01',
  reason:              'Voluntary Resignation',
  managerName:         'Test Manager',
  managerEmail:        TEST_EMAIL,
  has_reports:         'No',
  reports_to_new:      '',
  systems:             ['BOSS', 'SiteDocs', 'ADP'],
  equip:               ['Laptop', 'Phone'],
  google_forward:      TEST_EMAIL,
  google_files:        TEST_EMAIL,
  google_delegate:     '',
  google_duration:     '1 Month',
  google_vacation:     'Yes',
  equipReturn:         ['Laptop', 'Phone', 'Key Fob'],
  comments:            'AUTOMATED TEST — DELETE AFTER REVIEW',
  lastDayWorked:       '2099-05-30'
};

var TEST_TERM_APPROVAL = function(workflowId) {
  return {
    workflowId:       workflowId,
    decision:         'Approved',
    notes:            'AUTOMATED TEST APPROVAL',
    followUpRequired: 'No'
  };
};

/**
 * End-to-end termination test with sheet checks and attachment simulation.
 *
 * Steps:
 *   1. Email suppression check
 *   2. Submit termination (with simulated attachment)
 *   3. Sheet check — attachment URL present
 *   4. HR approval
 *   5. Action items check
 *   6. syncWorkflowState
 */
function runTerminationTest() {
  _assertDevOnly();

  Logger.log('══════════════════════════════════════════');
  Logger.log('[TestRunner] TERMINATION TEST — ' + new Date().toISOString());
  Logger.log('══════════════════════════════════════════');

  var workflowId;

  try {
    // Step 1: Confirm emails are suppressed
    checkDevEmailSuppression();

    // Step 2: Submit with a simulated attachment
    var formDataWithAttachment = {};
    for (var k in TEST_TERMINATION) formDataWithAttachment[k] = TEST_TERMINATION[k];
    formDataWithAttachment.attachmentBase64   = Utilities.base64Encode('AUTOMATED TEST ATTACHMENT — termination');
    formDataWithAttachment.attachmentName     = 'test-resignation-letter.txt';
    formDataWithAttachment.attachmentMimeType = 'text/plain';

    var initResult = _step('1. submitTerminationRequest (with attachment)', function() {
      return submitTerminationRequest(formDataWithAttachment);
    });
    workflowId = initResult.workflowId;
    Logger.log('[TestRunner] Workflow ID: ' + workflowId);

    // Step 3: Sheet checks
    _checkTerminationSheet(workflowId, true /* expectAttachmentUrl */);

    // Step 4: HR approval
    _step('2. submitTerminationApproval', function() {
      return submitTerminationApproval(TEST_TERM_APPROVAL(workflowId));
    });

    // Step 5: Action items check
    // Termination creates: IT deactivation, Deactivation (ID Setup), EOE (HR), Assets
    // Safety receives an FYI email only — no action item category
    _checkActionItemsExist(workflowId, [
      'IT', 'Deactivation', 'EOE', 'Assets'
    ]);

    // Step 6: State sync
    syncWorkflowState(workflowId);
    Logger.log('[TestRunner] syncWorkflowState called — check Dashboard_View sheet');

    Logger.log('══════════════════════════════════════════');
    Logger.log('[TestRunner] TERMINATION TEST PASSED ✓  Workflow ID: ' + workflowId);
    Logger.log('[TestRunner] Run cleanupAllTestWorkflows() to remove test data.');
    Logger.log('══════════════════════════════════════════');

  } catch (e) {
    Logger.log('[TestRunner] TERMINATION TEST FAILED ✗ — ' + e.message);
    Logger.log('[TestRunner] Partial workflow ID (if any): ' + (workflowId || 'none'));
    throw e; // re-throw so runAllTests() correctly marks this as FAILED
  }

  return workflowId || null;
}

// ── Run All Tests ─────────────────────────────────────────────────────────────

/**
 * Run all three test suites in sequence.
 * Any individual failure is logged but does NOT stop the remaining tests.
 *
 * Entry points:
 *   runAllTests()          — new hire + position change + termination
 *   runFullTestWorkflow()  — new hire only
 *   runPositionChangeTest()— position change only
 *   runTerminationTest()   — termination only
 */
function runAllTests() {
  _assertDevOnly();
  var results = {};

  Logger.log('██████████████████████████████████████████');
  Logger.log('[TestRunner] RUN ALL TESTS — ' + new Date().toISOString());
  Logger.log('██████████████████████████████████████████');

  try { runFullTestWorkflow();   results.newHire       = 'PASSED'; }
  catch(e) { results.newHire       = 'FAILED: ' + e.message; }

  try { runPositionChangeTest(); results.positionChange = 'PASSED'; }
  catch(e) { results.positionChange = 'FAILED: ' + e.message; }

  try { runTerminationTest();    results.termination    = 'PASSED'; }
  catch(e) { results.termination    = 'FAILED: ' + e.message; }

  Logger.log('██████████████████████████████████████████');
  Logger.log('[TestRunner] RESULTS:');
  Logger.log('  New Hire       : ' + results.newHire);
  Logger.log('  Position Change: ' + results.positionChange);
  Logger.log('  Termination    : ' + results.termination);
  Logger.log('██████████████████████████████████████████');
  Logger.log('[TestRunner] Run cleanupAllTestWorkflows() to remove all test data.');

  return results;
}
