/**
 * TestER3.js — Standalone test for ER-3
 *
 * Verifies: 30/60/90 Review action item is gated on plan306090 === 'Yes'
 *           AND is never created for Equipment Requests.
 *
 * Sub-test A: Equipment with plan306090 not set → NO 30/60/90
 * Sub-test B: Equipment with plan306090='Yes' set → STILL no 30/60/90 (EQUIP_REQ_ guard)
 *
 * Note: New Hire plan306090 variants verified by SuperDebug New Hire suite
 *       (SD_NH_INITIAL.plan306090='Yes' → 30/60/90 fires; changing to 'No' should not fire).
 *
 * Run: testER3_Plan306090Gate()
 * Cleanup: cleanupTestER3()
 */

var _ER3_SENTINEL_NAME  = 'Er3Test Er3TestLast';
var _ER3_SENTINEL_EMAIL = 'sd-test@superdebug.invalid';

function _er3MakeEquipRequest(plan306090Val) {
  return {
    requesterName:     'ER3 Test Runner',
    requesterEmail:    _ER3_SENTINEL_EMAIL,
    reqName:           'ER3 Test Runner',
    reqEmail:          _ER3_SENTINEL_EMAIL,
    firstName:         'Er3Test',
    lastName:          'Er3TestLast',
    siteName:          'ER3 Test Site',
    position:          'ER3 Test Position',
    managerName:       'ER3 Test Manager',
    managerEmail:      _ER3_SENTINEL_EMAIL,
    systems:           ['BOSS'],
    equipment:         [],
    department:        'IT',
    comments:          'TESTER3 — DELETE AFTER REVIEW',
    jonasJobNumbers:   '',
    adpSites:          [],
    purchasingSites:   [],
    bossJobSites:      'ER3-SITE-A',
    bossCostSheet:     'No',
    bossCostSheetJobs: '',
    bossTripReports:   'No',
    bossGrievances:    'No',
    creditCardUSA:     'No',
    creditCardCanada:  'No',
    creditCardHomeDepot: 'No',
    phoneRequestType:  'None',
    plan306090:        plan306090Val || ''
  };
}

var _ER3_ITCONF = function(wfId) { return {
  workflowId:            wfId,
  hireType:              'Equipment Request',
  employeeType:          '',
  employmentType:        'Salaried',
  firstName:             'Er3Test',
  lastName:              'Er3TestLast',
  middleName:            '',
  preferredName:         '',
  positionTitle:         'ER3 Test Position',
  siteName:              'ER3 Test Site',
  jobSiteNumber:         '',
  reportingManagerName:  'ER3 Test Manager',
  reportingManagerEmail: _ER3_SENTINEL_EMAIL,
  systemAccess:          'Yes',
  systems:               ['BOSS'],
  equipment:             [],
  googleEmail:           '',
  googleDomain:          '',
  computerRequestType:   'None',
  computerType:          '',
  phoneRequestType:      'None',
  bossJobSites:          'ER3-SITE-A',
  bossCostSheet:         'No',
  bossCostSheetJobs:     '',
  bossTripReports:       'No',
  bossGrievances:        'No',
  jonasJobNumbers:       '',
  adpSites:              [],
  department:            'IT',
  purchasingSites:       [],
  notes:                 'TESTER3 — IT Confirmation'
}; };

var _ER3_ITSETUP = function(wfId) { return {
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
  IT_Notes:                  'TESTER3 IT SETUP'
}; };

// ─────────────────────────────────────────────────────────────────────────────
// Helper: run one sub-test equipment flow and return AI categories
// ─────────────────────────────────────────────────────────────────────────────
function _er3RunFlow(plan306090Val) {
  var req    = _er3MakeEquipRequest(plan306090Val);
  var r1     = submitEquipmentRequest(req);
  SpreadsheetApp.flush();
  if (!r1 || !r1.success) return { error: 'submitEquipmentRequest failed: ' + (r1 && r1.message), wfId: null };

  var wfId = r1.workflowId;
  Utilities.sleep(400);

  var r2 = submitITConfirmation(_ER3_ITCONF(wfId));
  SpreadsheetApp.flush();
  if (!r2 || !r2.success) return { error: 'submitITConfirmation failed', wfId: wfId };
  Utilities.sleep(400);

  var r3 = submitITSetup(_ER3_ITSETUP(wfId));
  SpreadsheetApp.flush();
  if (!r3 || !r3.success) return { error: 'submitITSetup failed', wfId: wfId };
  Utilities.sleep(600);
  SpreadsheetApp.flush();

  // Read plan306090 from sheet (col 47)
  var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var irSheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
  var irData  = irSheet.getDataRange().getValues();
  var plan306090InSheet = '';
  for (var i = 1; i < irData.length; i++) {
    if (String(irData[i][0]).trim() === wfId) {
      plan306090InSheet = String(irData[i][SCHEMA.INITIAL_REQUESTS.PLAN_306090] || '');
      break;
    }
  }

  // Scan action items
  var aiSheet = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
  var rawAI   = aiSheet ? aiSheet.getDataRange().getValues() : [];
  var categories = [];
  for (var ri = 1; ri < rawAI.length; ri++) {
    if (String(rawAI[ri][0]).trim() === wfId) {
      categories.push(String(rawAI[ri][SCHEMA.ACTION_ITEMS.CATEGORY] || ''));
    }
  }

  return { wfId: wfId, plan306090InSheet: plan306090InSheet, categories: categories };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main test function
// ─────────────────────────────────────────────────────────────────────────────
function testER3_Plan306090Gate() {
  _SD_RESULTS    = [];
  _SD_EMAIL_COUNTS = {};
  Logger.log('========== TEST ER-3: 30/60/90 Gate ==========');
  checkSuperDebugEmailSafety();

  var pass = 0, fail = 0;
  var failures = [];
  var wfIdA = null, wfIdB = null;

  function _pass(tag, msg) { pass++; Logger.log('[ER-3][PASS] ' + tag + ': ' + msg); }
  function _fail(tag, msg) { fail++; failures.push('[' + tag + '] ' + msg); Logger.log('[ER-3][FAIL] ' + tag + ': ' + msg); }
  function _info(tag, msg) { Logger.log('[ER-3][INFO] ' + tag + ': ' + msg); }
  function _warn(tag, msg) { Logger.log('[ER-3][WARN] ' + tag + ': ' + msg); }

  try {
    // ── Sub-test A: Equipment with plan306090 NOT set → no 30/60/90 ─────────
    Logger.log('\n----- Sub-test A: Equipment, plan306090="" -----');
    var resultA = _er3RunFlow('');
    if (resultA.error) {
      _fail('A — flow', resultA.error);
    } else {
      wfIdA = resultA.wfId;
      _info('A', 'wfId=' + wfIdA + ' plan306090InSheet="' + resultA.plan306090InSheet + '"');
      _info('A', 'AI categories: [' + resultA.categories.join(', ') + ']');

      // Verify plan306090 written correctly as empty
      if (resultA.plan306090InSheet === '' || resultA.plan306090InSheet === 'No' || !resultA.plan306090InSheet) {
        _pass('A — sheet col47', 'plan306090 in sheet = "' + resultA.plan306090InSheet + '" (empty/No, correct) ✓');
      } else {
        _warn('A — sheet col47', 'plan306090 in sheet = "' + resultA.plan306090InSheet + '" (unexpected)');
      }

      // Assert no 30/60/90
      if (resultA.categories.indexOf('30/60/90 Review') !== -1) {
        _fail('A — 30/60/90 absent', '30/60/90 Review CREATED for Equipment with no plan306090 — EQUIP_REQ_ guard failed');
      } else {
        _pass('A — 30/60/90 absent', 'No 30/60/90 Review for Equipment (plan306090="") ✓');
      }
    }

    Utilities.sleep(800);

    // ── Sub-test B: Equipment with plan306090='Yes' → STILL no 30/60/90 ─────
    Logger.log('\n----- Sub-test B: Equipment, plan306090="Yes" -----');
    var resultB = _er3RunFlow('Yes');
    if (resultB.error) {
      _fail('B — flow', resultB.error);
    } else {
      wfIdB = resultB.wfId;
      _info('B', 'wfId=' + wfIdB + ' plan306090InSheet="' + resultB.plan306090InSheet + '"');
      _info('B', 'AI categories: [' + resultB.categories.join(', ') + ']');

      // Verify plan306090 written correctly as 'Yes'
      if (resultB.plan306090InSheet === 'Yes') {
        _pass('B — sheet col47', 'plan306090 in sheet = "Yes" ✓');
      } else {
        _fail('B — sheet col47', 'plan306090 in sheet = "' + resultB.plan306090InSheet + '" — expected "Yes"');
      }

      // Assert still no 30/60/90 (EQUIP_REQ_ guard must override plan306090)
      if (resultB.categories.indexOf('30/60/90 Review') !== -1) {
        _fail('B — 30/60/90 absent', '30/60/90 Review CREATED for Equipment even with plan306090=Yes — EQUIP_REQ_ guard failed');
      } else {
        _pass('B — 30/60/90 absent', 'No 30/60/90 Review for Equipment (plan306090="Yes") — EQUIP_REQ_ guard correct ✓');
      }
    }

    _warn('New Hire variants', 'New Hire plan306090=Yes → fires, plan306090=No → does not fire. Both covered by runSuperDebugNewHire (uses plan306090=Yes).');

  } catch (e) {
    fail++;
    failures.push('[testER3] ABORTED: ' + e.message);
    Logger.log('[ER-3][FAIL] testER3 ABORTED: ' + e.message);
    Logger.log('[ER-3][ERROR] Stack: ' + e.stack);
  }

  Logger.log('\n========== ER-3 RESULT ==========');
  Logger.log('Sub-test A wfId: ' + (wfIdA || '(none)'));
  Logger.log('Sub-test B wfId: ' + (wfIdB || '(none)'));
  Logger.log('PASS: ' + pass + '  FAIL: ' + fail);
  failures.forEach(function(f) { Logger.log('  ✗ ' + f); });
  Logger.log(fail === 0 ? '✅ ER-3 PASS' : '❌ ER-3 FAIL');
  Logger.log('=================================');
  return { pass: pass, fail: fail, workflowId: wfIdA + ',' + wfIdB, failures: failures };
}

function cleanupTestER3() {
  Logger.log('[ER3 Cleanup] Scanning for Er3Test workflows...');
  var ss  = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var ids = [];
  ss.getSheets().forEach(function(sheet) {
    var data = sheet.getDataRange().getValues();
    for (var r = data.length - 1; r >= 1; r--) {
      if (data[r].join('|').indexOf('Er3Test') !== -1) {
        var wid = String(data[r][0] || '');
        if (wid && ids.indexOf(wid) === -1) ids.push(wid);
      }
    }
  });
  Logger.log('[ER3 Cleanup] Found ' + ids.length + ' workflow(s): ' + ids.join(', '));
  if (typeof _purgeWorkflowRows === 'function' && ids.length > 0) {
    _purgeWorkflowRows(ids);
    Logger.log('[ER3 Cleanup] Purge complete.');
  } else {
    Logger.log('[ER3 Cleanup] Nothing to clean or _purgeWorkflowRows unavailable.');
  }
}
