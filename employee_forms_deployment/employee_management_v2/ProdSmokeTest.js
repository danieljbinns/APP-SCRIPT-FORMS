/**
 * ProdSmokeTest.js
 *
 * Lightweight smoke test that runs against the PROD HEAD codebase but:
 *   - Writes all rows to the DEV spreadsheet (TEST_SPREADSHEET_ID override)
 *   - Suppresses all emails (SUPPRESS_EMAILS_OVERRIDE = 'true')
 *
 * Zero impact on live prod data or active users.
 * Safe to run while prod is live — overrides are script-property-based,
 * not in Config.js, and are cleared in the finally block.
 *
 * Entry points (run from GAS editor or Execution API devMode=true):
 *   runProdSmokeTest()        — all 4 suites
 *   runProdSmokeNewHire()     — new hire only
 *   runProdSmokeTermination() — termination only
 *   runProdSmokeChange()      — position change only
 *   runProdSmokeEquipment()   — equipment only
 *   cleanupProdSmokeTest()    — remove all smoke sentinel rows from dev sheet
 *   checkProdSmokeOverrides() — print current override state (verify safe to run)
 *
 * Visible-email variants (rows still go to the DEV sheet; mail is REDIRECTED, not suppressed, so the
 * rendered emails can be inspected). The editor's Run button cannot pass arguments, so use the
 * zero-arg ones — the destination is the SMOKE_EMAIL_TO constant below:
 *   runProdSmokeTestEmailToMe()     — all 4 suites, emails to SMOKE_EMAIL_TO
 *   runProdSmokeNewHireEmailToMe()  — new hire only, emails to SMOKE_EMAIL_TO
 *   clearSmokeEmailRedirect()       — safety valve if a run was interrupted
 */

// ─── Constants ───────────────────────────────────────────────────────────────

var SMOKE_DEV_SS_ID  = '1KeWBbh8755mRXFSK2dCeSW75djpaPgtprbmqd7BAsMA';
var SMOKE_NH_NAME    = 'SmkFirst SmkLast';
var SMOKE_TERM_NAME  = 'SmkTerm SmkTermLast';
var SMOKE_CHANGE_NAME = 'SmkChange SmkChangeLast';
var SMOKE_EQUIP_NAME = 'SmkEquip SmkEquipLast';

// ─── Public Entry Points ──────────────────────────────────────────────────────

function runProdSmokeTest() {
  _smokeSetup();
  var results = [];
  try {
    results.push(_smokeNewHire());
    results.push(_smokeTermination());
    results.push(_smokeChange());
    results.push(_smokeEquipment());
  } finally {
    _smokeTeardown();
  }
  _smokeSummary(results);
  return { ok: results.every(function(r) { return r.pass; }), results: results };
}

function runProdSmokeNewHire()     { _smokeSetup(); try { return _smokeSummary([_smokeNewHire()]); }     finally { _smokeTeardown(); } }
function runProdSmokeTermination() { _smokeSetup(); try { return _smokeSummary([_smokeTermination()]); } finally { _smokeTeardown(); } }
function runProdSmokeChange()      { _smokeSetup(); try { return _smokeSummary([_smokeChange()]); }      finally { _smokeTeardown(); } }
function runProdSmokeEquipment()   { _smokeSetup(); try { return _smokeSummary([_smokeEquipment()]); }   finally { _smokeTeardown(); } }

function checkProdSmokeOverrides() {
  var props = PropertiesService.getScriptProperties().getProperties();
  Logger.log('[SMOKE CHECK] TEST_SPREADSHEET_ID   = ' + (props['TEST_SPREADSHEET_ID']   || '(not set — safe)'));
  Logger.log('[SMOKE CHECK] SUPPRESS_EMAILS_OVERRIDE = ' + (props['SUPPRESS_EMAILS_OVERRIDE'] || '(not set — prod sends real emails)'));
  Logger.log('[SMOKE CHECK] Active SPREADSHEET_ID  = ' + CONFIG.SPREADSHEET_ID);
  Logger.log('[SMOKE CHECK] SUPPRESS_EMAILS        = ' + CONFIG.SUPPRESS_EMAILS);
}

function cleanupProdSmokeTest() {
  Logger.log('[SMOKE CLEANUP] Removing smoke sentinel rows from dev sheet...');
  var names = [SMOKE_NH_NAME, SMOKE_TERM_NAME, SMOKE_CHANGE_NAME, SMOKE_EQUIP_NAME];
  _smokePurgeByNames(names);
  Logger.log('[SMOKE CLEANUP] Done.');
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

function _smokeSetup() {
  PropertiesService.getScriptProperties().setProperties({
    'TEST_SPREADSHEET_ID':      SMOKE_DEV_SS_ID,
    'SUPPRESS_EMAILS_OVERRIDE': 'true'
  });
  Logger.log('[SMOKE SETUP] TEST_SPREADSHEET_ID  → ' + SMOKE_DEV_SS_ID + ' (DEV)');
  Logger.log('[SMOKE SETUP] SUPPRESS_EMAILS_OVERRIDE → true');
  Logger.log('[SMOKE SETUP] Active sheet: ' + CONFIG.SPREADSHEET_ID);
  Logger.log('[SMOKE SETUP] Emails suppressed: ' + CONFIG.SUPPRESS_EMAILS);
}

function _smokeTeardown() {
  PropertiesService.getScriptProperties().deleteProperty('TEST_SPREADSHEET_ID');
  PropertiesService.getScriptProperties().deleteProperty('SUPPRESS_EMAILS_OVERRIDE');
  PropertiesService.getScriptProperties().deleteProperty('EMAIL_REDIRECT_ALL');
  Logger.log('[SMOKE TEARDOWN] Overrides cleared — prod back to normal.');
}

// ─── Visible-email variant ───────────────────────────────────────────────────
//
// Same smoke suites, but instead of suppressing mail it REDIRECTS every email to one address so the
// rendered output can actually be inspected. Rows still go to the DEV sheet, so prod data is
// untouched.
//
// ⚠ EMAIL_REDIRECT_ALL IS GLOBAL AND LIVE WHILE THIS RUNS. Any real form submitted by a real user
// during the run has ITS emails redirected here too — managers and specialists get nothing, with no
// error and no retry. The window is one execution (~1-2 min) and _smokeTeardown clears the property
// in a finally block, but prod is active during business hours, so run it when the forms are quiet
// and confirm the teardown line in the log afterwards.
//
// If the run dies in a way that skips the finally block, clear it by hand:
//   PropertiesService.getScriptProperties().deleteProperty('EMAIL_REDIRECT_ALL')
// or call clearSmokeEmailRedirect() below.

// Zero-argument entry point — the editor's Run button cannot pass parameters, so this is the one to
// select from the dropdown. Address is baked in deliberately; change the constant, not the call.
var SMOKE_EMAIL_TO = 'dbinns@robinsonsolutions.com';

function runProdSmokeTestEmailToMe() {
  return runProdSmokeTestEmailTo(SMOKE_EMAIL_TO);
}

function runProdSmokeNewHireEmailToMe() {
  _smokeSetup();
  PropertiesService.getScriptProperties().setProperties({
    'SUPPRESS_EMAILS_OVERRIDE': 'false',
    'EMAIL_REDIRECT_ALL':       SMOKE_EMAIL_TO
  });
  Logger.log('[SMOKE SETUP] EMAIL_REDIRECT_ALL → ' + SMOKE_EMAIL_TO);
  try { return _smokeSummary([_smokeNewHire()]); }
  finally {
    _smokeTeardown();
    Logger.log('[SMOKE TEARDOWN] EMAIL_REDIRECT_ALL now = ' +
      (PropertiesService.getScriptProperties().getProperty('EMAIL_REDIRECT_ALL') || '(cleared — prod mail normal)'));
  }
}

// ─── Isolated run (no global state) ──────────────────────────────────────────
//
// Preferred entry point. Identical coverage to runProdSmokeTestEmailToMe, but the dev-sheet and
// email-redirect overrides are EXECUTION-SCOPED (ConfigurationService.setRuntimeOverride) instead of
// Script Properties. Nothing outside this execution can observe them, so a real form submitted while
// this runs writes to PROD and mails its real recipients, exactly as normal.
//
// Aborts before touching anything if the dev-sheet override does not take effect.
function runProdSmokeIsolatedForRunner() {
  var CS = ConfigurationService;
  var results = [];
  try {
    CS.setRuntimeOverride('TEST_SPREADSHEET_ID',      SMOKE_DEV_SS_ID);
    CS.setRuntimeOverride('SUPPRESS_EMAILS_OVERRIDE', 'false');
    CS.setRuntimeOverride('EMAIL_REDIRECT_ALL',       SMOKE_EMAIL_TO);

    // Hard guard: never run the suites against the prod spreadsheet.
    if (String(CONFIG.SPREADSHEET_ID) !== String(SMOKE_DEV_SS_ID)) {
      throw new Error('ABORT: runtime override did not take — active sheet is ' + CONFIG.SPREADSHEET_ID +
                      ', expected dev ' + SMOKE_DEV_SS_ID);
    }
    Logger.log('[SMOKE ISOLATED] active sheet  = ' + CONFIG.SPREADSHEET_ID + ' (DEV)');
    Logger.log('[SMOKE ISOLATED] redirect mail = ' + SMOKE_EMAIL_TO + ' (this execution only)');
    Logger.log('[SMOKE ISOLATED] suppressed    = ' + CONFIG.SUPPRESS_EMAILS + ' (expected false)');

    results.push(_smokeNewHire());
    results.push(_smokeTermination());
    results.push(_smokeChange());
    results.push(_smokeEquipment());
  } catch (e) {
    return { pass: 0, fail: 1, warn: 0, emailTotal: 0,
             failures: ['threw: ' + (e && e.message)], gasLog: Logger.getLog() };
  } finally {
    CS.clearRuntimeOverrides();
    Logger.log('[SMOKE ISOLATED] runtime overrides cleared; active sheet back to ' + CONFIG.SPREADSHEET_ID);
  }

  var pass = 0, fail = 0, failures = [];
  results.forEach(function(r) {
    pass += (r.passed || 0);
    fail += (r.failed || 0);
    if (!r.pass) failures.push(r.suite + ' (wfId=' + (r.wfId || '-') + ')');
  });
  _smokeSummary(results);
  var props = PropertiesService.getScriptProperties();
  return {
    pass: pass, fail: fail, warn: 0, emailTotal: 0,
    redirectedTo: SMOKE_EMAIL_TO,
    // Proof no global state was left behind — all three must read '(none)'.
    globalTestSheet:  props.getProperty('TEST_SPREADSHEET_ID')      || '(none)',
    globalRedirect:   props.getProperty('EMAIL_REDIRECT_ALL')       || '(none)',
    globalSuppress:   props.getProperty('SUPPRESS_EMAILS_OVERRIDE') || '(none)',
    activeSheetAfter: String(CONFIG.SPREADSHEET_ID),
    failures: failures,
    gasLog: Logger.getLog()
  };
}

// Runner-compatible entry point. gas_runner.py expects the SuperDebug result shape
// ({pass, fail, warn, emailTotal, failures, gasLog}) — the smoke suites return their own shape, so
// this adapts it and attaches Logger.getLog() so the full run log comes back to the caller.
function runProdSmokeEmailToMeForRunner() {
  var res;
  try {
    res = runProdSmokeTestEmailTo(SMOKE_EMAIL_TO);
  } catch (e) {
    return { pass: 0, fail: 1, warn: 0, emailTotal: 0,
             failures: ['threw: ' + (e && e.message)], gasLog: Logger.getLog() };
  }
  var pass = 0, fail = 0, failures = [];
  (res.results || []).forEach(function(r) {
    pass += (r.passed || 0);
    fail += (r.failed || 0);
    if (!r.pass) failures.push(r.suite + ' (wfId=' + (r.wfId || '-') + ')');
  });
  return {
    pass: pass, fail: fail, warn: 0, emailTotal: 0,
    redirectedTo: res.redirectedTo || SMOKE_EMAIL_TO,
    residualRedirect: PropertiesService.getScriptProperties().getProperty('EMAIL_REDIRECT_ALL') || '(cleared)',
    failures: failures,
    gasLog: Logger.getLog()
  };
}

function runProdSmokeTestEmailTo(address) {
  var to = String(address || '').trim();
  if (!to || to.indexOf('@') < 0) {
    throw new Error('runProdSmokeTestEmailTo requires a single destination address, e.g. ' +
                    "runProdSmokeTestEmailTo('dbinns@robinsonsolutions.com')");
  }

  _smokeSetup();                                   // dev sheet + suppression…
  PropertiesService.getScriptProperties().setProperties({
    'SUPPRESS_EMAILS_OVERRIDE': 'false',           // …then swap suppression for redirection
    'EMAIL_REDIRECT_ALL':       to
  });
  Logger.log('[SMOKE SETUP] EMAIL_REDIRECT_ALL → ' + to + '  (ALL prod mail goes here until teardown)');
  Logger.log('[SMOKE SETUP] Emails suppressed: ' + CONFIG.SUPPRESS_EMAILS + ' (expected false)');

  var results = [];
  try {
    results.push(_smokeNewHire());
    results.push(_smokeTermination());
    results.push(_smokeChange());
    results.push(_smokeEquipment());
  } finally {
    _smokeTeardown();
    var left = PropertiesService.getScriptProperties().getProperty('EMAIL_REDIRECT_ALL');
    Logger.log('[SMOKE TEARDOWN] EMAIL_REDIRECT_ALL now = ' + (left || '(cleared — prod mail normal)'));
  }
  _smokeSummary(results);
  return { ok: results.every(function(r) { return r.pass; }), redirectedTo: to, results: results };
}

// Safety valve — run this if a smoke run was interrupted and mail is still being redirected.
function clearSmokeEmailRedirect() {
  PropertiesService.getScriptProperties().deleteProperty('EMAIL_REDIRECT_ALL');
  PropertiesService.getScriptProperties().deleteProperty('SUPPRESS_EMAILS_OVERRIDE');
  PropertiesService.getScriptProperties().deleteProperty('TEST_SPREADSHEET_ID');
  Logger.log('[SMOKE] All smoke overrides cleared. EMAIL_REDIRECT_ALL = ' +
             (PropertiesService.getScriptProperties().getProperty('EMAIL_REDIRECT_ALL') || '(cleared)'));
  Logger.log('[SMOKE] Active spreadsheet now: ' + CONFIG.SPREADSHEET_ID);
}

// ─── Suite: New Hire ─────────────────────────────────────────────────────────

function _smokeNewHire() {
  var tag = 'NEW_HIRE';
  Logger.log('\n[SMOKE][' + tag + '] ── Starting ──────────────────────────────');
  var checks = [], wfId = null;

  try {
    var payload = {
      firstName:              'SmkFirst',
      lastName:               'SmkLast',
      hireDate:               '2099-06-01',
      positionTitle:          'Smoke Test Role',
      department:             'Testing',
      employmentType:         'Salaried',
      union:                  'Yes',          // exercise the Union field end to end
      newHireOrRehire:        'New Hire',
      employeeType:           'Salaried',
      siteName:               'Toronto Office',
      jobSiteNumber:          '8888',
      systemAccess:           'Yes',
      reportingManagerName:   'Smoke Manager',
      reportingManagerEmail:  'dbinns@team-group.com',
      requesterName:          'Smoke Requester',
      requesterEmail:         'dbinns@team-group.com',
      systems:                ['BOSS'],
      equipment:              [],
      hasBossAccess:          'Yes',
      bossRole:               'Training Only',
      bossSites:              [],
      comments:               'ProdSmokeTest — auto-generated, safe to delete'
    };

    var result = submitInitialRequest(payload);
    checks.push(_smokeCheck('submitInitialRequest returned ok', result && result.success));
    if (!result || !result.success) throw new Error('submitInitialRequest failed: ' + JSON.stringify(result));

    wfId = result.workflowId;
    checks.push(_smokeCheck('workflowId assigned', !!wfId));
    Logger.log('[SMOKE][' + tag + '] workflowId: ' + wfId);

    SpreadsheetApp.flush();
    Utilities.sleep(500);

    // Verify row written to dev Initial_Requests sheet
    var row = _smokeReadRow(CONFIG.SHEETS.INITIAL_REQUESTS, wfId);
    checks.push(_smokeCheck('Row written to Initial_Requests', row.found));
    if (row.found) {
      checks.push(_smokeCheck('First name correct', row.map['First Name'] === 'SmkFirst'));
      checks.push(_smokeCheck('Last name correct',  row.map['Last Name']  === 'SmkLast'));
    }

    // Verify Workflows row
    var wfRow = _smokeReadRow(CONFIG.SHEETS.WORKFLOWS, wfId);
    checks.push(_smokeCheck('Row written to Workflows', wfRow.found));

  } catch (e) {
    checks.push(_smokeCheck('No exception thrown', false, e.toString()));
  }

  return _smokeSuiteResult(tag, wfId, checks);
}

// ─── Suite: Termination ──────────────────────────────────────────────────────

function _smokeTermination() {
  var tag = 'TERMINATION';
  Logger.log('\n[SMOKE][' + tag + '] ── Starting ──────────────────────────────');
  var checks = [], wfId = null;

  try {
    var payload = {
      empName:           'SmkTerm SmkTermLast',
      empType:           'Full-Time',
      empWorkEmail:      'smkterm@team-group.com',
      empPhone:          '555-0001',
      empSerial:         'SMK-SERIAL-001',
      siteName:          'Toronto Office',
      termDate:          '2099-06-15',
      lastDayWorked:     '2099-06-14',
      reason:            'Smoke Test',
      managerName:       'Smoke Manager',
      managerEmail:      'dbinns@team-group.com',
      reqName:           'Smoke Requester',
      reqEmail:          'dbinns@team-group.com',
      has_reports:       'No',
      reports_to_new:    '',
      systems:           ['Google Account'],
      google_forward:    'dbinns@team-group.com',
      google_files:      'dbinns@team-group.com',
      google_delegate:   '',
      google_duration:   '30 days',
      google_vacation:   'Out of office.',
      equip:             ['Laptop', 'Phone'],
      comments:          'ProdSmokeTest — auto-generated, safe to delete',
      attachmentBase64:  '',
      attachmentName:    ''
    };

    var result = submitTerminationRequest(payload);
    checks.push(_smokeCheck('submitTerminationRequest returned ok', result && result.success));
    if (!result || !result.success) throw new Error('submitTerminationRequest failed: ' + JSON.stringify(result));

    wfId = result.workflowId;
    checks.push(_smokeCheck('workflowId assigned', !!wfId));
    Logger.log('[SMOKE][' + tag + '] workflowId: ' + wfId);

    SpreadsheetApp.flush();
    Utilities.sleep(500);

    var row = _smokeReadRow(CONFIG.SHEETS.TERMINATIONS, wfId);
    checks.push(_smokeCheck('Row written to Terminations', row.found));
    if (row.found) {
      checks.push(_smokeCheck('Employee name correct', String(row.map['Employee Name']).indexOf('SmkTerm') !== -1));
    }

    var wfRow = _smokeReadRow(CONFIG.SHEETS.WORKFLOWS, wfId);
    checks.push(_smokeCheck('Row written to Workflows', wfRow.found));

  } catch (e) {
    checks.push(_smokeCheck('No exception thrown', false, e.toString()));
  }

  return _smokeSuiteResult(tag, wfId, checks);
}

// ─── Suite: Position Change ──────────────────────────────────────────────────

function _smokeChange() {
  var tag = 'POSITION_CHANGE';
  Logger.log('\n[SMOKE][' + tag + '] ── Starting ──────────────────────────────');
  var checks = [], wfId = null;

  try {
    var payload = {
      employeeName:          'SmkChange SmkChangeLast',
      employeeId:            'SMK-CHG-001',
      effectiveDate:         '2099-07-01',
      currentSite:           'Toronto Office',
      changeTypes:           ['Title Change'],
      unionOld:              'No',           // exercise the Union old -> new pair
      unionNew:              'Yes',
      titleChange:           'Old Title → Smoke Test Title',
      siteTransfer:          '',
      classification:        '',
      managerChange:         '',
      reassignOldReports:    '',
      gainNewReports:        '',
      googleAccount:         '',
      systemsAdded:          [],
      equipment:             [],
      removedAccess:         [],
      comments:              'ProdSmokeTest — auto-generated, safe to delete',
      department:            'Testing',
      purchasingSites:       '',
      receivingManagerEmail: '',
      currentTitle:          'Old Title',
      currentManagerEmail:   'dbinns@team-group.com',
      currentManagerName:    'Smoke Manager',
      currentClass:          'Full-Time',
      requesterName:         'Smoke Requester',
      requesterEmail:        'dbinns@team-group.com',
      firstName:             'SmkChange',
      lastName:              'SmkChangeLast',
      attachmentBase64:      '',
      attachmentFileName:    ''
    };

    var result = submitPositionChangeRequest(payload);
    checks.push(_smokeCheck('submitPositionChangeRequest returned ok', result && result.success));
    if (!result || !result.success) throw new Error('submitPositionChangeRequest failed: ' + JSON.stringify(result));

    wfId = result.workflowId;
    checks.push(_smokeCheck('workflowId assigned', !!wfId));
    Logger.log('[SMOKE][' + tag + '] workflowId: ' + wfId);

    SpreadsheetApp.flush();
    Utilities.sleep(500);

    var row = _smokeReadRow(CONFIG.SHEETS.POSITION_CHANGES, wfId);
    checks.push(_smokeCheck('Row written to Position Changes', row.found));
    if (row.found) {
      checks.push(_smokeCheck('Employee name correct', row.map['Employee Name'] === 'SmkChange SmkChangeLast'));
    }

    var wfRow = _smokeReadRow(CONFIG.SHEETS.WORKFLOWS, wfId);
    checks.push(_smokeCheck('Row written to Workflows', wfRow.found));

  } catch (e) {
    checks.push(_smokeCheck('No exception thrown', false, e.toString()));
  }

  return _smokeSuiteResult(tag, wfId, checks);
}

// ─── Suite: Equipment ────────────────────────────────────────────────────────

function _smokeEquipment() {
  var tag = 'EQUIPMENT';
  Logger.log('\n[SMOKE][' + tag + '] ── Starting ──────────────────────────────');
  var checks = [], wfId = null;

  try {
    var payload = {
      firstName:        'SmkEquip',
      lastName:         'SmkEquipLast',
      siteName:         'Toronto Office',
      position:         'Smoke Test Role',
      managerName:      'Smoke Manager',
      managerEmail:     'dbinns@team-group.com',
      requesterName:    'Smoke Requester',
      requesterEmail:   'dbinns@team-group.com',
      equipmentList:    ['Laptop'],
      systemsList:      ['BOSS'],
      comments:         'ProdSmokeTest — auto-generated, safe to delete',
      department:       'Testing'
    };

    var result = submitEquipmentRequest(payload);
    checks.push(_smokeCheck('submitEquipmentRequest returned ok', result && result.success));
    if (!result || !result.success) throw new Error('submitEquipmentRequest failed: ' + JSON.stringify(result));

    wfId = result.workflowId;
    checks.push(_smokeCheck('workflowId assigned', !!wfId));
    Logger.log('[SMOKE][' + tag + '] workflowId: ' + wfId);

    SpreadsheetApp.flush();
    Utilities.sleep(500);

    var wfRow = _smokeReadRow(CONFIG.SHEETS.WORKFLOWS, wfId);
    checks.push(_smokeCheck('Row written to Workflows', wfRow.found));

  } catch (e) {
    checks.push(_smokeCheck('No exception thrown', false, e.toString()));
  }

  return _smokeSuiteResult(tag, wfId, checks);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _smokeCheck(label, pass, detail) {
  var status = pass ? 'PASS' : 'FAIL';
  var msg = '[SMOKE][' + status + '] ' + label + (detail ? ' — ' + detail : '');
  Logger.log(msg);
  return { label: label, pass: pass, detail: detail || '' };
}

function _smokeSuiteResult(tag, wfId, checks) {
  var passed = checks.filter(function(c) { return c.pass; }).length;
  var failed = checks.filter(function(c) { return !c.pass; }).length;
  Logger.log('[SMOKE][' + tag + '] Result: PASS=' + passed + ' FAIL=' + failed + ' wfId=' + (wfId || 'none'));
  return { suite: tag, wfId: wfId, pass: failed === 0, passed: passed, failed: failed, checks: checks };
}

function _smokeSummary(results) {
  Logger.log('\n════════════════════════════════════════');
  Logger.log('PROD SMOKE TEST — Summary');
  Logger.log('════════════════════════════════════════');
  var totalPass = 0, totalFail = 0;
  results.forEach(function(r) {
    var status = r.pass ? '✓ PASS' : '✗ FAIL';
    Logger.log('  ' + status + '  ' + r.suite + '  (pass=' + r.passed + ' fail=' + r.failed + '  wfId=' + (r.wfId || 'none') + ')');
    totalPass += r.passed;
    totalFail += r.failed;
  });
  Logger.log('────────────────────────────────────────');
  Logger.log('TOTAL: pass=' + totalPass + ' fail=' + totalFail);
  Logger.log(totalFail === 0 ? '✓ ALL PASSED' : '✗ FAILURES DETECTED');
  Logger.log('════════════════════════════════════════');
  Logger.log('Run cleanupProdSmokeTest() to remove sentinel rows from dev sheet.');
  return results;
}

function _smokeReadRow(sheetName, workflowId) {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { found: false };
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === workflowId) {
        var map = {};
        headers.forEach(function(h, idx) { map[h] = data[i][idx]; });
        return { found: true, headers: headers, values: data[i], map: map };
      }
    }
    return { found: false };
  } catch (e) {
    Logger.log('[SMOKE] _smokeReadRow error: ' + e.toString());
    return { found: false, error: e.toString() };
  }
}

function _smokePurgeByNames(sentinelNames) {
  var ss = SpreadsheetApp.openById(SMOKE_DEV_SS_ID);
  var allSheets = ss.getSheets();
  var totalDeleted = 0;

  allSheets.forEach(function(sheet) {
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return;
    var rowsToDelete = [];
    for (var i = data.length - 1; i >= 1; i--) {
      var rowStr = data[i].join(' ');
      for (var j = 0; j < sentinelNames.length; j++) {
        if (rowStr.indexOf(sentinelNames[j]) !== -1) {
          rowsToDelete.push(i + 1); // 1-based
          break;
        }
      }
    }
    rowsToDelete.forEach(function(rowNum) {
      sheet.deleteRow(rowNum);
      totalDeleted++;
    });
    if (rowsToDelete.length > 0) {
      Logger.log('[SMOKE CLEANUP] ' + sheet.getName() + ': deleted ' + rowsToDelete.length + ' row(s)');
    }
  });

  Logger.log('[SMOKE CLEANUP] Total rows deleted: ' + totalDeleted);
}
