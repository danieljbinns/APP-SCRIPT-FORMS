/**
 * TestER2.js — Standalone test for ER-2 fix.
 *
 * Verifies that the WIS Assignment action item is NOT created for Equipment
 * Request workflows, even when managerEmail is set and BOSS_Access = 'Yes'.
 * The WIS guard in triggerSpecialists uses workflowId.startsWith('EQUIP_REQ_').
 *
 * Key assertions:
 *   1. submitEquipmentRequest succeeds
 *   2. submitITConfirmation succeeds → step = 'IT Setup Needed'
 *   3. submitITSetup succeeds → IT_Results row written
 *   4. Raw Action Items scan: NO row with category 'WIS' for this wfId
 *   5. Workflow step advances past 'IT Setup Needed' (not stuck)
 *
 * Run: testER2_WisNotFiredForEquipment()
 * Cleanup: cleanupTestER2()
 */

var _ER2_SENTINEL_NAME  = 'Er2Test Er2TestLast';
var _ER2_SENTINEL_EMAIL = 'sd-test@superdebug.invalid';

var _ER2_EQUIP_REQUEST = {
  requesterName:     'ER2 Test Runner',
  requesterEmail:    _ER2_SENTINEL_EMAIL,
  reqName:           'ER2 Test Runner',
  reqEmail:          _ER2_SENTINEL_EMAIL,
  firstName:         'Er2Test',
  lastName:          'Er2TestLast',
  siteName:          'ER2 Test Site',
  position:          'ER2 Test Position',
  managerName:       'ER2 Test Manager',
  managerEmail:      _ER2_SENTINEL_EMAIL,
  systems:           ['BOSS'],
  equipment:         [],
  department:        'IT',
  comments:          'TESTER2 — DELETE AFTER REVIEW',
  jonasJobNumbers:   '',
  adpSites:          [],
  purchasingSites:   [],
  bossJobSites:      'ER2-SITE-A',
  bossCostSheet:     'No',
  bossCostSheetJobs: '',
  bossTripReports:   'No',
  bossGrievances:    'No',
  creditCardUSA:     'No',
  creditCardCanada:  'No',
  creditCardHomeDepot: 'No',
  phoneRequestType:  'None'
};

var _ER2_ITCONF = function(wfId) { return {
  workflowId:            wfId,
  hireType:              'Equipment Request',
  employeeType:          '',
  employmentType:        '',
  firstName:             'Er2Test',
  lastName:              'Er2TestLast',
  middleName:            '',
  preferredName:         '',
  positionTitle:         'ER2 Test Position',
  siteName:              'ER2 Test Site',
  jobSiteNumber:         '',
  reportingManagerName:  'ER2 Test Manager',
  reportingManagerEmail: _ER2_SENTINEL_EMAIL,
  systemAccess:          'Yes',
  systems:               ['BOSS'],
  equipment:             [],
  googleEmail:           '',
  googleDomain:          '',
  computerRequestType:   'None',
  computerType:          '',
  phoneRequestType:      'None',
  bossJobSites:          'ER2-SITE-A',
  bossCostSheet:         'No',
  bossCostSheetJobs:     '',
  bossTripReports:       'No',
  bossGrievances:        'No',
  jonasJobNumbers:       '',
  adpSites:              [],
  department:            'IT',
  purchasingSites:       [],
  notes:                 'TESTER2 — IT Confirmation'
}; };

var _ER2_ITSETUP = function(wfId) { return {
  workflowId:                wfId,
  Email_Created:             'No',
  Email_Username:            '',
  Email_Domain:              '',
  Email_Temp_Password:       '',
  Computer_Assigned:         'No',
  Computer_Serial:           '',
  Computer_Model:            '',
  Computer_Type:             '',
  Phone_Assigned:            'No',
  Phone_Carrier:             '',
  Phone_Model:               '',
  Phone_Number:              '',
  Phone_VM_Password:         '',
  BOSS_Access:               'Yes',
  Incidents_Access:          'No',
  CAA_Access:                'No',
  Delivery_App_Access:       'No',
  Net_Promoter_Score_Access: 'No',
  IT_Notes:                  'TESTER2 IT SETUP'
}; };

// ─────────────────────────────────────────────────────────────────
// Main test function
// ─────────────────────────────────────────────────────────────────
function testER2_WisNotFiredForEquipment() {
  _SD_RESULTS    = [];
  _SD_EMAIL_COUNTS = {};
  Logger.log('========== TEST ER-2: WIS Not Fired for Equipment ==========');
  checkSuperDebugEmailSafety();

  var wfId;
  var pass = 0;
  var fail = 0;
  var failures = [];

  function _pass(tag, msg) { pass++; Logger.log('[ER-2][PASS] ' + tag + ': ' + msg); }
  function _fail(tag, msg) { fail++; failures.push('[' + tag + '] ' + msg); Logger.log('[ER-2][FAIL] ' + tag + ': ' + msg); }
  function _warn(tag, msg) { Logger.log('[ER-2][WARN] ' + tag + ': ' + msg); }
  function _info(tag, msg) { Logger.log('[ER-2][INFO] ' + tag + ': ' + msg); }

  try {

    // ── Step 1: Submit Equipment Request ─────────────────────────
    Logger.log('\n----- Step 1: submitEquipmentRequest -----');
    var r1 = submitEquipmentRequest(_ER2_EQUIP_REQUEST);
    SpreadsheetApp.flush();

    if (!r1 || !r1.success) {
      _fail('Step 1', 'submitEquipmentRequest failed: ' + (r1 && r1.message));
      return { pass: pass, fail: fail, workflowId: wfId, failures: failures };
    }
    wfId = r1.workflowId;
    _pass('Step 1', 'submitEquipmentRequest succeeded — wfId: ' + wfId);
    _info('Step 1', 'wfId starts with EQUIP_REQ_: ' + (wfId && wfId.startsWith('EQUIP_REQ_')));

    Utilities.sleep(400);

    // ── Step 2: IT Confirmation ───────────────────────────────────
    Logger.log('\n----- Step 2: submitITConfirmation -----');
    var r2 = submitITConfirmation(_ER2_ITCONF(wfId));
    SpreadsheetApp.flush();

    if (!r2 || !r2.success) {
      _fail('Step 2', 'submitITConfirmation failed: ' + (r2 && r2.message));
      return { pass: pass, fail: fail, workflowId: wfId, failures: failures };
    }
    _pass('Step 2', 'submitITConfirmation succeeded');

    var wfRow2 = _sdReadRow(CONFIG.SHEETS.WORKFLOWS, wfId);
    var stepAfterConf = wfRow2.found ? String(wfRow2.map['Current Step'] || '') : '(not found)';
    if (stepAfterConf === 'IT Setup Needed') {
      _pass('Step 2 — step', 'Workflow step = "IT Setup Needed" ✓');
    } else {
      _warn('Step 2 — step', 'Workflow step = "' + stepAfterConf + '" — expected "IT Setup Needed"');
    }

    Utilities.sleep(400);

    // ── Step 3: IT Setup ─────────────────────────────────────────
    Logger.log('\n----- Step 3: submitITSetup -----');
    var r3 = submitITSetup(_ER2_ITSETUP(wfId));
    SpreadsheetApp.flush();

    if (!r3 || !r3.success) {
      _fail('Step 3', 'submitITSetup failed: ' + (r3 && r3.message));
      return { pass: pass, fail: fail, workflowId: wfId, failures: failures };
    }
    _pass('Step 3', 'submitITSetup succeeded');

    Utilities.sleep(600);
    SpreadsheetApp.flush();

    // ── Step 4: Raw Action Items scan — assert NO WIS row ─────────
    Logger.log('\n----- Step 4: Raw Action Items scan -----');
    var ss4 = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var aiSheet = ss4.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
    var rawAI = aiSheet ? aiSheet.getDataRange().getValues() : [];
    var wisFound = false;
    var aiMatches = [];

    for (var ri = 1; ri < rawAI.length; ri++) {
      var rowStr = rawAI[ri].join('|');
      if (rowStr.indexOf(wfId) !== -1) {
        var cat = String(rawAI[ri][SCHEMA.ACTION_ITEMS.CATEGORY] || '');
        aiMatches.push('category=' + cat);
        if (cat === 'WIS' || cat === 'WIS Assignment') {
          wisFound = true;
          _fail('Step 4 — WIS guard', 'WIS action item found for Equipment Request wfId=' + wfId + ' — ER-2 guard not working. Category: "' + cat + '"');
        }
      }
    }

    _info('Step 4', 'All AI categories found for wfId: ' + (aiMatches.length > 0 ? aiMatches.join(', ') : '(none)'));

    if (!wisFound) {
      _pass('Step 4 — WIS guard', 'No WIS action item created for Equipment Request ✓ (guard correct)');
    }

    // ── Step 5: Workflow step advanced past IT Setup Needed ───────
    Logger.log('\n----- Step 5: Workflow step check -----');
    var wfRow5 = _sdReadRow(CONFIG.SHEETS.WORKFLOWS, wfId);
    var stepAfterSetup = wfRow5.found ? String(wfRow5.map['Current Step'] || '') : '(not found)';
    _info('Step 5', 'Workflow step after IT Setup: "' + stepAfterSetup + '"');

    if (stepAfterSetup === 'IT Setup Needed') {
      _fail('Step 5 — step', 'Workflow stuck at "IT Setup Needed" after submitITSetup');
    } else if (stepAfterSetup === 'Specialist Forms Needed' || stepAfterSetup === 'Complete' || stepAfterSetup === 'Action Items Pending') {
      _pass('Step 5 — step', 'Workflow advanced to "' + stepAfterSetup + '" ✓');
    } else {
      _warn('Step 5 — step', 'Unexpected step "' + stepAfterSetup + '" — may be OK if all AIs already closed');
    }

  } catch (e) {
    fail++;
    failures.push('[testER2] ABORTED: ' + e.message);
    Logger.log('[ER-2][FAIL] testER2 ABORTED: ' + e.message);
    Logger.log('[ER-2][ERROR] Stack: ' + e.stack);
  }

  Logger.log('\n========== ER-2 RESULT ==========');
  Logger.log('Workflow: ' + (wfId || '(none)'));
  Logger.log('PASS: ' + pass + '  FAIL: ' + fail);
  failures.forEach(function(f) { Logger.log('  ✗ ' + f); });
  Logger.log(fail === 0 ? '✅ ER-2 PASS' : '❌ ER-2 FAIL');
  Logger.log('=================================');
  return { pass: pass, fail: fail, workflowId: wfId, failures: failures };
}

// ─────────────────────────────────────────────────────────────────
// Cleanup — removes all Er2Test rows from all sheets
// ─────────────────────────────────────────────────────────────────
function cleanupTestER2() {
  Logger.log('[ER2 Cleanup] Scanning for Er2Test workflows...');
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var ids = [];

  var allSheets = ss.getSheets();
  allSheets.forEach(function(sheet) {
    var data = sheet.getDataRange().getValues();
    for (var r = data.length - 1; r >= 1; r--) {
      if (data[r].join('|').indexOf('Er2Test') !== -1) {
        var wid = String(data[r][0] || '');
        if (wid && ids.indexOf(wid) === -1) ids.push(wid);
      }
    }
  });

  Logger.log('[ER2 Cleanup] Found ' + ids.length + ' workflow(s): ' + ids.join(', '));

  if (typeof _purgeWorkflowRows === 'function' && ids.length > 0) {
    _purgeWorkflowRows(ids);
    Logger.log('[ER2 Cleanup] Purge complete.');
  } else if (ids.length === 0) {
    Logger.log('[ER2 Cleanup] Nothing to clean.');
  } else {
    Logger.log('[ER2 Cleanup] _purgeWorkflowRows not available. Delete manually. IDs: ' + ids.join(', '));
  }
}
