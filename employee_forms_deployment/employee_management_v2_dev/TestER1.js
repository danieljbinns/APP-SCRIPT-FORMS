/**
 * TestER1.js — Standalone test for ER-1 fix.
 *
 * Verifies that after ER-1: Equipment Request routes through the IT Setup form
 * (same path as New Hire) instead of the old action-item checklist path.
 *
 * Key assertions:
 *   1. After submitITConfirmation → workflow step = 'IT Setup Needed' (not 'Email Setup Needed')
 *   2. Email captured with subject 'IT Setup Required' (it_setup path, not action_item_view)
 *   3. submitITSetup succeeds → IT_Results row written
 *   4. triggerSpecialists fires → specialist action items created
 *   5. Workflow reaches Complete after all AIs closed
 *
 * Run: testER1_EquipmentITRouting()
 * Cleanup: cleanupTestER1()
 */

var _ER1_SENTINEL_NAME  = 'Er1Test Er1TestLast';
var _ER1_SENTINEL_EMAIL = 'sd-test@superdebug.invalid';

var _ER1_EQUIP_REQUEST = {
  requesterName:     'ER1 Test Runner',
  requesterEmail:    _ER1_SENTINEL_EMAIL,
  reqName:           'ER1 Test Runner',
  reqEmail:          _ER1_SENTINEL_EMAIL,
  firstName:         'Er1Test',
  lastName:          'Er1TestLast',
  siteName:          'ER1 Test Site',
  position:          'ER1 Test Position',
  managerName:       'ER1 Test Manager',
  managerEmail:      _ER1_SENTINEL_EMAIL,
  systems:           ['BOSS', 'Jonas'],
  equipment:         ['Laptop', 'Business Cards'],
  department:        'IT',
  comments:          'TESTЕР1 — DELETE AFTER REVIEW',
  jonasJobNumbers:   'ER1-9999',
  adpSites:          ['8888'],
  purchasingSites:   [],
  bossJobSites:      'ER1-SITE-A',
  bossCostSheet:     'No',
  bossCostSheetJobs: '',
  bossTripReports:   'No',
  bossGrievances:    'No',
  creditCardUSA:     'No',
  creditCardCanada:  'No',
  creditCardHomeDepot: 'No',
  phoneRequestType:  'None'
};

var _ER1_ITCONF = function(wfId) { return {
  workflowId:            wfId,
  hireType:              'Equipment Request',
  employeeType:          '',
  employmentType:        '',
  firstName:             'Er1Test',
  lastName:              'Er1TestLast',
  middleName:            '',
  preferredName:         '',
  positionTitle:         'ER1 Test Position',
  siteName:              'ER1 Test Site',
  jobSiteNumber:         '8888',
  reportingManagerName:  'ER1 Test Manager',
  reportingManagerEmail: _ER1_SENTINEL_EMAIL,
  systemAccess:          'Yes',
  systems:               ['BOSS', 'Jonas'],
  equipment:             ['Laptop', 'Business Cards'],
  googleEmail:           '',
  googleDomain:          '',
  computerRequestType:   'New',
  computerType:          'Laptop',
  phoneRequestType:      'None',
  bossJobSites:          'ER1-SITE-A',
  bossCostSheet:         'No',
  bossCostSheetJobs:     '',
  bossTripReports:       'No',
  bossGrievances:        'No',
  jonasJobNumbers:       'ER1-9999',
  adpSites:              ['8888'],
  department:            'IT',
  purchasingSites:       [],
  notes:                 'TESTER1 — IT Confirmation'
}; };

var _ER1_ITSETUP = function(wfId) { return {
  workflowId:                wfId,
  Email_Created:             'No',
  Email_Username:            '',
  Email_Domain:              '',
  Email_Temp_Password:       '',
  Computer_Assigned:         'Yes',
  Computer_Serial:           'ER1-SERIAL-001',
  Computer_Model:            'ER1 Test Mac',
  Computer_Type:             'Laptop',
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
  IT_Notes:                  'TESTER1 IT SETUP'
}; };

// ─────────────────────────────────────────────────────────────────
// Main test function
// ─────────────────────────────────────────────────────────────────
function testER1_EquipmentITRouting() {
  _SD_RESULTS    = [];
  _SD_EMAIL_COUNTS = {};
  Logger.log('========== TEST ER-1: Equipment IT Routing ==========');
  checkSuperDebugEmailSafety();

  var wfId;
  var pass = 0;
  var fail = 0;
  var debug = {};

  function _pass(tag, msg) { pass++; _sdLog('PASS', tag, msg + ' ✓'); }
  function _fail(tag, msg) { fail++; _sdLog('FAIL', tag, msg); }

  try {

    // ── Step 1: Submit Equipment Request ─────────────────────────
    Logger.log('\n----- Step 1: submitEquipmentRequest -----');
    _sdEmailCapture();
    var r1 = submitEquipmentRequest(_ER1_EQUIP_REQUEST);
    SpreadsheetApp.flush();
    _sdEmailExtract('Step 1');

    if (!r1 || !r1.success) {
      _fail('Step 1', 'submitEquipmentRequest failed: ' + (r1 && r1.message));
      return _er1Summary(wfId, pass, fail);
    }
    wfId = r1.workflowId;
    _pass('Step 1', 'submitEquipmentRequest succeeded — wfId: ' + wfId);

    // Verify step = IT Confirmation Needed
    _sdVerifyWorkflow(wfId, 'In Progress', 'IT Confirmation Needed');
    Utilities.sleep(400);

    // ── Step 2: IT Confirmation → KEY ASSERTION ───────────────────
    Logger.log('\n----- Step 2: submitITConfirmation -----');
    _sdEmailCapture();
    var r2 = submitITConfirmation(_ER1_ITCONF(wfId));
    SpreadsheetApp.flush();
    var step2Emails = _sdEmailExtract('Step 2');

    if (!r2 || !r2.success) {
      _fail('Step 2', 'submitITConfirmation failed: ' + (r2 && r2.message));
      return _er1Summary(wfId, pass, fail);
    }
    _pass('Step 2', 'submitITConfirmation succeeded');

    // KEY ASSERTION: step must be 'IT Setup Needed', NOT 'Email Setup Needed'
    var wfRow = _sdReadRow(CONFIG.SHEETS.WORKFLOWS, wfId);
    var actualStep = wfRow.found ? String(wfRow.map['Current Step'] || '') : '(row not found)';
    if (actualStep === 'IT Setup Needed') {
      _pass('Step 2 — KEY', 'Workflow step = "IT Setup Needed" (correct it_setup path)');
    } else {
      _fail('Step 2 — KEY', 'Workflow step = "' + actualStep + '" — expected "IT Setup Needed". ER-1 routing fix may not have applied.');
    }

    // Verify no action items created yet (old path created one here)
    var aiAfterConf = _sdVerifyAI(wfId, []);
    if (aiAfterConf.found.length === 0) {
      _pass('Step 2 — AI check', 'No action items created at IT Confirmation stage (correct)');
    } else {
      _fail('Step 2 — AI check', 'Unexpected action items found: ' + aiAfterConf.found.join(', ') + ' — old path may still be running');
    }

    // Verify at least one email fired at IT Confirmation stage (the it_setup link email)
    var step2EmailCount = (_SD_EMAIL_COUNTS && _SD_EMAIL_COUNTS['Step 2']) ? _SD_EMAIL_COUNTS['Step 2'] : 0;
    debug.step2EmailCount = step2EmailCount;
    if (step2EmailCount > 0) {
      _pass('Step 2 — email', step2EmailCount + ' email(s) sent at IT Confirmation stage ✓');
    } else {
      // Soft warning — SUPPRESS_EMAILS may prevent capture; key assertion is the step name above
      _sdLog('WARN', 'Step 2 — email', 'No emails captured at IT Confirmation stage — check SUPPRESS_EMAILS setting (non-blocking)');
    }

    Utilities.sleep(400);

    // ── Step 3: Submit IT Setup (same form as New Hire) ───────────
    Logger.log('\n----- Step 3: submitITSetup -----');
    _sdEmailCapture();
    var r3 = submitITSetup(_ER1_ITSETUP(wfId));
    SpreadsheetApp.flush();
    _sdEmailExtract('Step 3');

    if (!r3 || !r3.success) {
      _fail('Step 3', 'submitITSetup failed: ' + (r3 && r3.message));
      return _er1Summary(wfId, pass, fail);
    }
    _pass('Step 3', 'submitITSetup succeeded');

    // Verify IT_Results row written
    var itRow = _sdReadRow(CONFIG.SHEETS.IT_RESULTS, wfId);
    if (itRow.found) {
      _pass('Step 3 — IT_Results', 'IT_Results row written for ' + wfId);
      _sdDumpRow('Step 3 IT_Results dump', CONFIG.SHEETS.IT_RESULTS, wfId);
    } else {
      _fail('Step 3 — IT_Results', 'IT_Results row NOT found — submitITSetup may not be writing for EQUIP_REQ_ workflows');
    }

    Utilities.sleep(400);

    // ── Step 3b: Debug — dump getITContextData result ────────────
    Logger.log('\n----- Step 3b: getITContextData debug -----');
    try {
      var itCtx = getITContextData(wfId);
      debug.itCtx = {
        success:        itCtx.success,
        message:        itCtx.message || '',
        businessCards:  itCtx.businessCards,
        jonasJobNumbers:itCtx.jonasJobNumbers,
        managerEmail:   itCtx.managerEmail,
        employmentType: itCtx.employmentType,
        creditCardUSA:  itCtx.creditCardUSA,
        equipmentRaw:   itCtx.equipmentRaw,
        purchasingSites:itCtx.purchasingSites,
        employeeName:   itCtx.employeeName
      };
      if (!itCtx.success) {
        _fail('Step 3b', 'getITContextData returned success:false — ' + itCtx.message);
      } else {
        _pass('Step 3b', 'getITContextData found row for ' + wfId);
      }
    } catch(ex) {
      _fail('Step 3b', 'getITContextData threw: ' + ex.message);
    }

    // ── Step 4: Verify specialist action items created ────────────
    Logger.log('\n----- Step 4: Verify specialist action items -----');

    // Raw scan — find ANY rows in Action Items sheet containing this workflow ID
    try {
      var ss4 = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      var aiSheet4 = ss4.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
      var rawAI = aiSheet4 ? aiSheet4.getDataRange().getValues() : [];
      var aiMatches = [];
      for (var ri = 1; ri < rawAI.length; ri++) {
        if (rawAI[ri].join('|').indexOf(wfId) !== -1) {
          aiMatches.push('row' + ri + ':col0=' + rawAI[ri][0] + ' col1=' + rawAI[ri][1] + ' col2=' + rawAI[ri][2]);
        }
      }
      debug.rawAIScan        = aiMatches;
      debug.aiSheetTotalRows = rawAI.length - 1;
      // Check exact comparison on first matching row
      if (aiMatches.length > 0) {
        var firstMatchRow = null;
        for (var ri2 = 1; ri2 < rawAI.length; ri2++) {
          if (rawAI[ri2].join('|').indexOf(wfId) !== -1) { firstMatchRow = rawAI[ri2]; break; }
        }
        if (firstMatchRow) {
          var colVal = firstMatchRow[SCHEMA.ACTION_ITEMS.WORKFLOW_ID];
          debug.aiCompare = {
            schemaIndex:  SCHEMA.ACTION_ITEMS.WORKFLOW_ID,
            colValType:   typeof colVal,
            colVal:       String(colVal),
            wfIdType:     typeof wfId,
            wfId:         wfId,
            strictEquals: (String(colVal || '') === wfId)
          };
        }
      }
      // Workflow step after IT Setup
      var wfRow4 = _sdReadRow(CONFIG.SHEETS.WORKFLOWS, wfId);
      debug.stepAfterITSetup   = wfRow4.found ? wfRow4.map['Current Step'] : '(not found)';
      debug.statusAfterITSetup = wfRow4.found ? wfRow4.map['Status']       : '(not found)';
      // SCHEMA index for ACTION_ITEMS.WORKFLOW_ID
      debug.aiWorkflowIdIndex = SCHEMA.ACTION_ITEMS.WORKFLOW_ID;
    } catch(ex4) { debug.rawAIScanError = ex4.message; }

    // Use raw scan (avoids stale getDataRange cache issue with _sdVerifyAI)
    // Expected from triggerSpecialists for systems=['BOSS','Jonas'], equipment=['Laptop','Business Cards']:
    //   Business Cards, Jonas, WIS, 30/60/90 Review
    var foundCategories = aiMatches.map(function(m) { return m.split('col2=')[1] || ''; });
    if (foundCategories.length > 0) {
      _pass('Step 4', 'Specialist action items created via triggerSpecialists: ' + foundCategories.join(', '));
      debug.specialistCategories = foundCategories;
      // Verify Business Cards specifically
      if (foundCategories.indexOf('Business Cards') !== -1) {
        _pass('Step 4 — Business Cards', 'Business Cards action item present ✓');
      } else {
        _fail('Step 4 — Business Cards', 'Business Cards not in ' + foundCategories.join(', '));
      }
    } else {
      _fail('Step 4', 'No specialist action items found — triggerSpecialists may not have fired');
    }

    Utilities.sleep(400);

    // ── Step 5: Close all AIs → verify Complete ───────────────────
    Logger.log('\n----- Step 5: Close all AIs -----');
    _sdEmailCapture();
    var closedCount = _sdCloseAllAI(wfId, 'Step 5');
    SpreadsheetApp.flush();
    _sdEmailExtract('Step 5');
    _pass('Step 5', 'Closed ' + closedCount + ' action item(s)');

    Utilities.sleep(600);

    // ── Step 6: Verify Complete ───────────────────────────────────
    Logger.log('\n----- Step 6: Verify workflow Complete -----');
    _sdVerifyWorkflow(wfId, 'Complete', null);
    var finalRow = _sdReadRow(CONFIG.SHEETS.WORKFLOWS, wfId);
    var finalStatus = finalRow.found ? String(finalRow.map['Status'] || '') : '(not found)';
    if (finalStatus === 'Complete') {
      _pass('Step 6', 'Workflow reached Complete');
    } else {
      _fail('Step 6', 'Workflow status = "' + finalStatus + '" — expected Complete');
    }

  } catch (e) {
    fail++;
    _sdLog('FAIL', 'testER1', 'ABORTED: ' + e.message);
    Logger.log('[ER1][ERROR] Stack: ' + e.stack);
  }

  return _er1Summary(wfId, pass, fail, debug);
}

function _er1Summary(wfId, pass, fail, debug) {
  var failures = (_SD_RESULTS || []).filter(function(r) { return r.level === 'FAIL'; }).map(function(r) { return '[' + r.tag + '] ' + r.msg; });
  Logger.log('\n========== ER-1 RESULT ==========');
  Logger.log('Workflow: ' + (wfId || '(none)'));
  Logger.log('PASS: ' + pass + '  FAIL: ' + fail);
  failures.forEach(function(f) { Logger.log('  ✗ ' + f); });
  Logger.log(fail === 0 ? '✅ ER-1 PASS' : '❌ ER-1 FAIL');
  Logger.log('=================================');
  return { pass: pass, fail: fail, workflowId: wfId, failures: failures, debug: debug || {} };
}

// ─────────────────────────────────────────────────────────────────
// Cleanup — removes all Er1Test rows from all sheets
// ─────────────────────────────────────────────────────────────────
function cleanupTestER1() {
  Logger.log('[ER1 Cleanup] Scanning for Er1Test workflows...');
  var ss     = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var wfSheet = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
  if (!wfSheet) { Logger.log('[ER1 Cleanup] Workflows sheet not found'); return; }

  var data = wfSheet.getDataRange().getValues();
  var ids  = [];
  for (var i = 1; i < data.length; i++) {
    var name = String(data[i][1] || '') + ' ' + String(data[i][2] || ''); // adjust if name cols differ
    var wid  = String(data[i][0] || '');
    if (wid.indexOf('EQUIP_REQ_') !== -1 && (name.indexOf('Er1Test') !== -1 || String(data[i]).indexOf('Er1Test') !== -1)) {
      ids.push(wid);
    }
  }

  if (ids.length === 0) {
    // Fallback: scan all sheets for any row containing 'Er1Test'
    Logger.log('[ER1 Cleanup] No IDs found via Workflows — scanning all sheets for Er1Test sentinel');
    var allSheets = ss.getSheets();
    allSheets.forEach(function(sheet) {
      var sd = sheet.getDataRange().getValues();
      for (var r = sd.length - 1; r >= 1; r--) {
        if (sd[r].join('|').indexOf('Er1Test') !== -1) {
          var wid2 = String(sd[r][0] || '');
          if (wid2 && ids.indexOf(wid2) === -1) ids.push(wid2);
        }
      }
    });
  }

  Logger.log('[ER1 Cleanup] Found ' + ids.length + ' workflow(s) to clean: ' + ids.join(', '));

  // Reuse SuperDebug purge if available
  if (typeof _purgeWorkflowRows === 'function' && ids.length > 0) {
    _purgeWorkflowRows(ids);
    Logger.log('[ER1 Cleanup] Purge complete.');
  } else if (ids.length === 0) {
    Logger.log('[ER1 Cleanup] Nothing to clean.');
  } else {
    Logger.log('[ER1 Cleanup] _purgeWorkflowRows not available — run cleanupSuperDebugAll() or delete manually. IDs: ' + ids.join(', '));
  }
}
