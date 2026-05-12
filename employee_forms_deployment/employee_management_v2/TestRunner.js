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
      Logger.log('[TestRunner]   Closing task ' + taskId + ' (' + row[AI.NAME] + ')');
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
 * Delete all data rows written by test runs.
 * Finds them by scanning the Workflows sheet for Employee Name = TEST_EMPLOYEE_NAME.
 * You must be an admin (ADMIN_EMAILS list in Config.js).
 */
function cleanupAllTestWorkflows() {
  _assertDevOnly();

  var ids = _getTestWorkflowIds();
  if (ids.length === 0) {
    Logger.log('[TestRunner] No test workflows found in sheet — nothing to delete.');
    return;
  }

  Logger.log('[TestRunner] Purging ' + ids.length + ' test workflow(s): ' + ids.join(', '));
  var result = adminPurgeWorkflows(ids);
  Logger.log('[TestRunner] adminPurgeWorkflows → ' + JSON.stringify(result));
  return result;
}

/**
 * Delete a specific test workflow by ID.
 * @param {string} workflowId
 */
function cleanupTestWorkflow(workflowId) {
  _assertDevOnly();

  if (!workflowId) {
    Logger.log('[TestRunner] cleanupTestWorkflow: no ID provided.');
    return;
  }

  Logger.log('[TestRunner] Purging workflow: ' + workflowId);
  var result = adminPurgeWorkflows([workflowId]);
  Logger.log('[TestRunner] adminPurgeWorkflows → ' + JSON.stringify(result));
  return result;
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
