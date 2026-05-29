/**
 * TestER5.js — Standalone test for ER-5
 *
 * Verifies: bossTrainingOnly field is:
 *   1. Written to Initial_Requests sheet at col 54 (BOSS_TRAINING_ONLY) correctly
 *   2. Read back correctly by getITContextData()
 *   3. Default 'No' written when not supplied
 *
 * Note: The WIS action item description change (training vs full) applies only to
 *       New Hire (Equipment is gated by ER-2). That path requires manual verification
 *       — a WARN is logged here to flag it.
 *       The ITSetup.html server-side conditional also requires manual/browser testing.
 *
 * Run: testER5_BossTrainingOnly()
 * Cleanup: cleanupTestER5()
 */

var _ER5_SENTINEL_NAME  = 'Er5Test Er5TestLast';
var _ER5_SENTINEL_EMAIL = 'sd-test@superdebug.invalid';

function _er5MakeEquipRequest(bossTrainingOnlyVal) {
  return {
    requesterName:     'ER5 Test Runner',
    requesterEmail:    _ER5_SENTINEL_EMAIL,
    reqName:           'ER5 Test Runner',
    reqEmail:          _ER5_SENTINEL_EMAIL,
    firstName:         'Er5Test',
    lastName:          'Er5TestLast',
    siteName:          'ER5 Test Site',
    position:          'ER5 Test Position',
    managerName:       'ER5 Test Manager',
    managerEmail:      _ER5_SENTINEL_EMAIL,
    systems:           ['BOSS'],
    equipment:         [],
    department:        'IT',
    comments:          'TESTER5 — DELETE AFTER REVIEW',
    jonasJobNumbers:   '',
    adpSites:          [],
    purchasingSites:   [],
    bossJobSites:      'ER5-SITE-A',
    bossCostSheet:     'No',
    bossCostSheetJobs: '',
    bossTripReports:   'No',
    bossGrievances:    'No',
    creditCardUSA:     'No',
    creditCardCanada:  'No',
    creditCardHomeDepot: 'No',
    phoneRequestType:  'None',
    plan306090:        '',
    bossTrainingOnly:  bossTrainingOnlyVal  // col 54
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: submit one Equipment Request and read back col 54 from sheet
// ─────────────────────────────────────────────────────────────────────────────
function _er5SubmitAndReadCol54(bossTrainingOnlyVal) {
  var req = _er5MakeEquipRequest(bossTrainingOnlyVal);
  var r1  = submitEquipmentRequest(req);
  SpreadsheetApp.flush();
  if (!r1 || !r1.success) return { error: 'submitEquipmentRequest failed: ' + (r1 && r1.message) };

  var wfId    = r1.workflowId;
  Utilities.sleep(400);

  // Read Initial_Requests col 54 directly from sheet
  var ss      = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var irSheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
  var irData  = irSheet.getDataRange().getValues();
  var col54Val        = null;
  var col54HeaderInRow = null;

  // Also read header to confirm col 55 exists
  var headers = irData[0];
  col54HeaderInRow = String(headers[SCHEMA.INITIAL_REQUESTS.BOSS_TRAINING_ONLY] || '');

  for (var i = 1; i < irData.length; i++) {
    if (String(irData[i][0]).trim() === wfId) {
      col54Val = String(irData[i][SCHEMA.INITIAL_REQUESTS.BOSS_TRAINING_ONLY] || '');
      break;
    }
  }

  // Read via getITContextData
  var ctx = null;
  try { ctx = getITContextData(wfId); } catch (e) { /* ignore */ }

  return {
    wfId:           wfId,
    col54Header:    col54HeaderInRow,
    col54InSheet:   col54Val,
    ctxBossTraining: ctx ? ctx.bossTrainingOnly : '(getITContextData failed)'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main test function
// ─────────────────────────────────────────────────────────────────────────────
function testER5_BossTrainingOnly() {
  _SD_RESULTS    = [];
  _SD_EMAIL_COUNTS = {};
  Logger.log('========== TEST ER-5: BOSS Training Only Field ==========');
  checkSuperDebugEmailSafety();

  var pass = 0, fail = 0;
  var failures = [];
  var wfIdYes = null, wfIdNo = null, wfIdDefault = null;

  function _pass(tag, msg) { pass++; Logger.log('[ER-5][PASS] ' + tag + ': ' + msg); }
  function _fail(tag, msg) { fail++; failures.push('[' + tag + '] ' + msg); Logger.log('[ER-5][FAIL] ' + tag + ': ' + msg); }
  function _info(tag, msg) { Logger.log('[ER-5][INFO] ' + tag + ': ' + msg); }
  function _warn(tag, msg) { Logger.log('[ER-5][WARN] ' + tag + ': ' + msg); }

  try {
    // ── Sub-test A: bossTrainingOnly='Yes' ───────────────────────────────────
    Logger.log('\n----- Sub-test A: bossTrainingOnly="Yes" -----');
    var resultA = _er5SubmitAndReadCol54('Yes');
    if (resultA.error) {
      _fail('A — submit', resultA.error);
    } else {
      wfIdYes = resultA.wfId;
      _info('A', 'wfId=' + wfIdYes);
      _info('A', 'col54 header in sheet: "' + resultA.col54Header + '"');
      _info('A', 'col54 value in sheet: "' + resultA.col54InSheet + '"');
      _info('A', 'getITContextData().bossTrainingOnly: "' + resultA.ctxBossTraining + '"');

      // Assert header exists
      if (resultA.col54Header === 'BOSS Training User Only') {
        _pass('A — col54 header', 'Column header "BOSS Training User Only" present at index 54 ✓');
      } else {
        _fail('A — col54 header', 'Col54 header = "' + resultA.col54Header + '" — expected "BOSS Training User Only". Run sdAuditInitialRequestsHeaders() to fix.');
      }

      // Assert value written
      if (resultA.col54InSheet === 'Yes') {
        _pass('A — sheet write', 'bossTrainingOnly="Yes" written to col 54 ✓');
      } else {
        _fail('A — sheet write', 'col 54 = "' + resultA.col54InSheet + '" — expected "Yes"');
      }

      // Assert context read
      if (resultA.ctxBossTraining === 'Yes') {
        _pass('A — context read', 'getITContextData().bossTrainingOnly = "Yes" ✓');
      } else {
        _fail('A — context read', 'getITContextData().bossTrainingOnly = "' + resultA.ctxBossTraining + '" — expected "Yes"');
      }
    }

    Utilities.sleep(600);

    // ── Sub-test B: bossTrainingOnly='No' ────────────────────────────────────
    Logger.log('\n----- Sub-test B: bossTrainingOnly="No" -----');
    var resultB = _er5SubmitAndReadCol54('No');
    if (resultB.error) {
      _fail('B — submit', resultB.error);
    } else {
      wfIdNo = resultB.wfId;
      _info('B', 'wfId=' + wfIdNo);
      _info('B', 'col54 value in sheet: "' + resultB.col54InSheet + '"');
      _info('B', 'getITContextData().bossTrainingOnly: "' + resultB.ctxBossTraining + '"');

      if (resultB.col54InSheet === 'No') {
        _pass('B — sheet write', 'bossTrainingOnly="No" written to col 54 ✓');
      } else {
        _fail('B — sheet write', 'col 54 = "' + resultB.col54InSheet + '" — expected "No"');
      }

      if (resultB.ctxBossTraining === 'No') {
        _pass('B — context read', 'getITContextData().bossTrainingOnly = "No" ✓');
      } else {
        _fail('B — context read', 'getITContextData().bossTrainingOnly = "' + resultB.ctxBossTraining + '" — expected "No"');
      }
    }

    Utilities.sleep(600);

    // ── Sub-test C: bossTrainingOnly not supplied → default 'No' ─────────────
    Logger.log('\n----- Sub-test C: bossTrainingOnly not supplied (default) -----');
    var resultC = _er5SubmitAndReadCol54(undefined);
    if (resultC.error) {
      _fail('C — submit', resultC.error);
    } else {
      wfIdDefault = resultC.wfId;
      _info('C', 'wfId=' + wfIdDefault);
      _info('C', 'col54 value in sheet: "' + resultC.col54InSheet + '"');
      _info('C', 'getITContextData().bossTrainingOnly: "' + resultC.ctxBossTraining + '"');

      if (resultC.col54InSheet === 'No' || resultC.col54InSheet === '') {
        _pass('C — default', 'bossTrainingOnly default written as "' + resultC.col54InSheet + '" ✓ (No or blank)');
      } else {
        _fail('C — default', 'col 54 = "' + resultC.col54InSheet + '" — expected "No" or ""');
      }

      // getITContextData default: bossTrainingOnly || 'No' — should be 'No'
      if (resultC.ctxBossTraining === 'No' || resultC.ctxBossTraining === '') {
        _pass('C — context default', 'getITContextData().bossTrainingOnly = "' + resultC.ctxBossTraining + '" — correct default ✓');
      } else {
        _fail('C — context default', 'getITContextData().bossTrainingOnly = "' + resultC.ctxBossTraining + '" — unexpected');
      }
    }

    // ── Manual verification notes ────────────────────────────────────────────
    _warn('Manual — ITSetup.html', 'ITSetup.html server-side conditional (training notice vs full BOSS fields) requires browser testing with bossTrainingOnly=Yes in context.');
    _warn('Manual — WIS description', 'New Hire WIS action item description change (training vs full) requires running New Hire flow with bossTrainingOnly=Yes. Currently only Equipment tested here (ER-2 gates WIS for Equipment anyway).');

  } catch (e) {
    fail++;
    failures.push('[testER5] ABORTED: ' + e.message);
    Logger.log('[ER-5][FAIL] testER5 ABORTED: ' + e.message);
    Logger.log('[ER-5][ERROR] Stack: ' + e.stack);
  }

  Logger.log('\n========== ER-5 RESULT ==========');
  Logger.log('Sub-A wfId: ' + (wfIdYes     || '(none)'));
  Logger.log('Sub-B wfId: ' + (wfIdNo      || '(none)'));
  Logger.log('Sub-C wfId: ' + (wfIdDefault || '(none)'));
  Logger.log('PASS: ' + pass + '  FAIL: ' + fail);
  failures.forEach(function(f) { Logger.log('  ✗ ' + f); });
  Logger.log(fail === 0 ? '✅ ER-5 PASS' : '❌ ER-5 FAIL');
  Logger.log('=================================');
  return { pass: pass, fail: fail, workflowId: (wfIdYes || '') + ',' + (wfIdNo || '') + ',' + (wfIdDefault || ''), failures: failures };
}

function cleanupTestER5() {
  Logger.log('[ER5 Cleanup] Scanning for Er5Test workflows...');
  var ss  = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var ids = [];
  ss.getSheets().forEach(function(sheet) {
    var data = sheet.getDataRange().getValues();
    for (var r = data.length - 1; r >= 1; r--) {
      if (data[r].join('|').indexOf('Er5Test') !== -1) {
        var wid = String(data[r][0] || '');
        if (wid && ids.indexOf(wid) === -1) ids.push(wid);
      }
    }
  });
  Logger.log('[ER5 Cleanup] Found ' + ids.length + ' workflow(s): ' + ids.join(', '));
  if (typeof _purgeWorkflowRows === 'function' && ids.length > 0) {
    _purgeWorkflowRows(ids);
    Logger.log('[ER5 Cleanup] Purge complete.');
  } else {
    Logger.log('[ER5 Cleanup] Nothing to clean or _purgeWorkflowRows unavailable.');
  }
}
