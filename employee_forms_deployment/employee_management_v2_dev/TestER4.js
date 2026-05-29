/**
 * TestER4.js — Standalone test for ER-4
 *
 * Verifies: When SiteDocs is in the systems list, a 'WIS User' action item
 *           is created and assigned to CONFIG.EMAILS.IDSETUP (not IT).
 *
 * Flow: Equipment Request with systems=['BOSS','SiteDocs']
 *       → IT Confirmation → IT Setup → triggerSpecialists
 *       → Action Items scan: WIS User row exists, assignedTo = IDSETUP email
 *
 * Run: testER4_SiteDocsToIDSetup()
 * Cleanup: cleanupTestER4()
 */

var _ER4_SENTINEL_NAME  = 'Er4Test Er4TestLast';
var _ER4_SENTINEL_EMAIL = 'sd-test@superdebug.invalid';

var _ER4_EQUIP_REQUEST = {
  requesterName:     'ER4 Test Runner',
  requesterEmail:    _ER4_SENTINEL_EMAIL,
  reqName:           'ER4 Test Runner',
  reqEmail:          _ER4_SENTINEL_EMAIL,
  firstName:         'Er4Test',
  lastName:          'Er4TestLast',
  siteName:          'ER4 Test Site',
  position:          'ER4 Test Position',
  managerName:       'ER4 Test Manager',
  managerEmail:      _ER4_SENTINEL_EMAIL,
  systems:           ['BOSS', 'SiteDocs'],   // SiteDocs must trigger WIS User AI
  equipment:         [],
  department:        'IT',
  comments:          'TESTER4 — DELETE AFTER REVIEW',
  jonasJobNumbers:   '',
  adpSites:          [],
  purchasingSites:   [],
  bossJobSites:      'ER4-SITE-A',
  bossCostSheet:     'No',
  bossCostSheetJobs: '',
  bossTripReports:   'No',
  bossGrievances:    'No',
  creditCardUSA:     'No',
  creditCardCanada:  'No',
  creditCardHomeDepot: 'No',
  phoneRequestType:  'None',
  plan306090:        ''
};

var _ER4_ITCONF = function(wfId) { return {
  workflowId:            wfId,
  hireType:              'Equipment Request',
  employeeType:          '',
  employmentType:        '',
  firstName:             'Er4Test',
  lastName:              'Er4TestLast',
  middleName:            '',
  preferredName:         '',
  positionTitle:         'ER4 Test Position',
  siteName:              'ER4 Test Site',
  jobSiteNumber:         '',
  reportingManagerName:  'ER4 Test Manager',
  reportingManagerEmail: _ER4_SENTINEL_EMAIL,
  systemAccess:          'Yes',
  systems:               ['BOSS', 'SiteDocs'],
  equipment:             [],
  googleEmail:           '',
  googleDomain:          '',
  computerRequestType:   'None',
  computerType:          '',
  phoneRequestType:      'None',
  bossJobSites:          'ER4-SITE-A',
  bossCostSheet:         'No',
  bossCostSheetJobs:     '',
  bossTripReports:       'No',
  bossGrievances:        'No',
  jonasJobNumbers:       '',
  adpSites:              [],
  department:            'IT',
  purchasingSites:       [],
  notes:                 'TESTER4 — IT Confirmation'
}; };

var _ER4_ITSETUP = function(wfId) { return {
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
  IT_Notes:                  'TESTER4 IT SETUP'
}; };

// ─────────────────────────────────────────────────────────────────────────────
// Main test function
// ─────────────────────────────────────────────────────────────────────────────
function testER4_SiteDocsToIDSetup() {
  _SD_RESULTS    = [];
  _SD_EMAIL_COUNTS = {};
  Logger.log('========== TEST ER-4: SiteDocs → WIS User (ID Setup) ==========');
  checkSuperDebugEmailSafety();

  var pass = 0, fail = 0;
  var failures = [];
  var wfId = null;

  function _pass(tag, msg) { pass++; Logger.log('[ER-4][PASS] ' + tag + ': ' + msg); }
  function _fail(tag, msg) { fail++; failures.push('[' + tag + '] ' + msg); Logger.log('[ER-4][FAIL] ' + tag + ': ' + msg); }
  function _info(tag, msg) { Logger.log('[ER-4][INFO] ' + tag + ': ' + msg); }

  try {
    // ── Step 1: Submit Equipment Request with SiteDocs ───────────────────────
    Logger.log('\n----- Step 1: submitEquipmentRequest (systems includes SiteDocs) -----');
    var r1 = submitEquipmentRequest(_ER4_EQUIP_REQUEST);
    SpreadsheetApp.flush();

    if (!r1 || !r1.success) {
      _fail('Step 1', 'submitEquipmentRequest failed: ' + (r1 && r1.message));
      return { pass: pass, fail: fail, workflowId: null, failures: failures };
    }
    wfId = r1.workflowId;
    _pass('Step 1', 'Equipment Request submitted → ' + wfId);

    // Verify systems written to Initial_Requests col 20
    var ss     = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var irSheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
    var irData  = irSheet.getDataRange().getValues();
    var systemsInSheet = '';
    for (var i = 1; i < irData.length; i++) {
      if (String(irData[i][0]).trim() === wfId) {
        systemsInSheet = String(irData[i][SCHEMA.INITIAL_REQUESTS.SYSTEMS] || '');
        break;
      }
    }
    _info('Step 1 Sheet', 'systems in Initial_Requests col20: "' + systemsInSheet + '"');
    if (systemsInSheet.toLowerCase().indexOf('sitedocs') !== -1) {
      _pass('Step 1 Sheet', 'SiteDocs present in systems column ✓');
    } else {
      _fail('Step 1 Sheet', 'SiteDocs NOT found in systems column — got: "' + systemsInSheet + '"');
    }

    Utilities.sleep(400);

    // ── Step 2: IT Confirmation ──────────────────────────────────────────────
    Logger.log('\n----- Step 2: submitITConfirmation -----');
    var r2 = submitITConfirmation(_ER4_ITCONF(wfId));
    SpreadsheetApp.flush();

    if (!r2 || !r2.success) {
      _fail('Step 2', 'submitITConfirmation failed: ' + (r2 && r2.message));
      return { pass: pass, fail: fail, workflowId: wfId, failures: failures };
    }
    _pass('Step 2', 'IT Confirmation submitted ✓');

    var wfRow2 = _sdReadRow(CONFIG.SHEETS.WORKFLOWS, wfId);
    var step2  = wfRow2.found ? String(wfRow2.map['Current Step'] || '') : '(not found)';
    if (step2 === 'IT Setup Needed') {
      _pass('Step 2 Step', 'Step = IT Setup Needed ✓');
    } else {
      _fail('Step 2 Step', 'Expected "IT Setup Needed", got "' + step2 + '"');
    }

    Utilities.sleep(400);

    // ── Step 3: IT Setup ─────────────────────────────────────────────────────
    Logger.log('\n----- Step 3: submitITSetup -----');
    var r3 = submitITSetup(_ER4_ITSETUP(wfId));
    SpreadsheetApp.flush();

    if (!r3 || !r3.success) {
      _fail('Step 3', 'submitITSetup failed: ' + (r3 && r3.message));
      return { pass: pass, fail: fail, workflowId: wfId, failures: failures };
    }
    _pass('Step 3', 'IT Setup submitted ✓');

    Utilities.sleep(800);
    SpreadsheetApp.flush();

    // ── Step 4: Raw AI scan — assert WIS User exists and is assigned to IDSETUP
    Logger.log('\n----- Step 4: Action Items scan — WIS User check -----');
    var aiSheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
    var rawAI   = aiSheet ? aiSheet.getDataRange().getValues() : [];

    var wisUserFound    = false;
    var wisUserAssignee = '';
    var allCategories   = [];

    for (var ri = 1; ri < rawAI.length; ri++) {
      if (String(rawAI[ri][0]).trim() === wfId) {
        var cat      = String(rawAI[ri][SCHEMA.ACTION_ITEMS.CATEGORY]   || '');
        var assignee = String(rawAI[ri][SCHEMA.ACTION_ITEMS.ASSIGNED_TO] || '');
        allCategories.push(cat);
        _info('Step 4 AI Row', 'category=' + cat + ' assignedTo=' + assignee);

        if (cat === 'WIS User') {
          wisUserFound    = true;
          wisUserAssignee = assignee;
        }
      }
    }

    _info('Step 4', 'All categories: [' + allCategories.join(', ') + ']');

    // Assert WIS User exists
    if (wisUserFound) {
      _pass('Step 4 — WIS User exists', 'WIS User action item created ✓ (assignedTo=' + wisUserAssignee + ')');
    } else {
      _fail('Step 4 — WIS User exists', 'WIS User action item NOT found — SiteDocs routing not working');
    }

    // Assert assignee is IDSETUP team
    if (wisUserFound) {
      var expectedIdSetup = CONFIG.EMAILS && CONFIG.EMAILS.IDSETUP ? CONFIG.EMAILS.IDSETUP : '(CONFIG.EMAILS.IDSETUP)';
      _info('Step 4 Assignee', 'Expected CONFIG.EMAILS.IDSETUP=' + expectedIdSetup + '  Actual=' + wisUserAssignee);
      if (wisUserAssignee === expectedIdSetup) {
        _pass('Step 4 — WIS User assignee', 'WIS User assigned to ID Setup team (' + wisUserAssignee + ') ✓');
      } else {
        _fail('Step 4 — WIS User assignee', 'WIS User assigned to "' + wisUserAssignee + '" — expected "' + expectedIdSetup + '"');
      }
    }

    // Assert NO IT action item for SiteDocs (confirm it wasn't routed to IT)
    var itForSiteDocs = allCategories.filter(function(c) { return c === 'IT'; });
    if (itForSiteDocs.length === 0) {
      _pass('Step 4 — not routed to IT', 'No IT action item created for SiteDocs ✓');
    } else {
      // IT items may exist for other reasons (e.g. Incidents), so just log
      _info('Step 4 IT note', 'IT action items found: ' + itForSiteDocs.length + ' (may be for other systems)');
    }

  } catch (e) {
    fail++;
    failures.push('[testER4] ABORTED: ' + e.message);
    Logger.log('[ER-4][FAIL] testER4 ABORTED: ' + e.message);
    Logger.log('[ER-4][ERROR] Stack: ' + e.stack);
  }

  Logger.log('\n========== ER-4 RESULT ==========');
  Logger.log('Workflow: ' + (wfId || '(none)'));
  Logger.log('PASS: ' + pass + '  FAIL: ' + fail);
  failures.forEach(function(f) { Logger.log('  ✗ ' + f); });
  Logger.log(fail === 0 ? '✅ ER-4 PASS' : '❌ ER-4 FAIL');
  Logger.log('=================================');
  return { pass: pass, fail: fail, workflowId: wfId, failures: failures };
}

function cleanupTestER4() {
  Logger.log('[ER4 Cleanup] Scanning for Er4Test workflows...');
  var ss  = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var ids = [];
  ss.getSheets().forEach(function(sheet) {
    var data = sheet.getDataRange().getValues();
    for (var r = data.length - 1; r >= 1; r--) {
      if (data[r].join('|').indexOf('Er4Test') !== -1) {
        var wid = String(data[r][0] || '');
        if (wid && ids.indexOf(wid) === -1) ids.push(wid);
      }
    }
  });
  Logger.log('[ER4 Cleanup] Found ' + ids.length + ' workflow(s): ' + ids.join(', '));
  if (typeof _purgeWorkflowRows === 'function' && ids.length > 0) {
    _purgeWorkflowRows(ids);
    Logger.log('[ER4 Cleanup] Purge complete.');
  } else {
    Logger.log('[ER4 Cleanup] Nothing to clean or _purgeWorkflowRows unavailable.');
  }
}
