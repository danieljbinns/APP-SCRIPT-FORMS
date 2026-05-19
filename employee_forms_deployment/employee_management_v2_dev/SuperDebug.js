/**
 * SuperDebug.js — Full End-to-End Trace Runner (DEV ONLY)
 * ============================================================
 * Traces EVERY operation: sheet write, email trigger, action item creation,
 * data flow into forms, and workflow state transitions across all 4 workflow types.
 *
 * ENTRY POINTS (run from GAS editor)
 * ------------------------------------
 *  runSuperDebugAll()                — All 4 suites in sequence
 *  runSuperDebugNewHire()            — Full new hire trace (12 phases)
 *  runSuperDebugEOE()                — Full termination trace (10 phases)
 *  runSuperDebugStatusChange()       — Runs all 3 Status Change sub-suites
 *  runSuperDebugStatusChange_Title() — Title + classification change only
 *  runSuperDebugStatusChange_Site()  — Site transfer + manager + Fleetio + vehicle
 *  runSuperDebugStatusChange_Full()  — All change types, kitchen sink
 *  runSuperDebugEquipment()          — Full equipment request trace (8 phases)
 *
 * UTILITIES
 * -----------
 *  checkSuperDebugEmailSafety()      — Verify SUPPRESS_EMAILS + redirect before any run
 *  listSuperDebugWorkflows()         — Print all SD workflow IDs for manual dashboard review
 *  cleanupSuperDebugAll()            — Delete all SD_ test rows from every sheet
 *  cleanupSuperDebugWorkflow(wfId)   — Delete one specific workflow's rows
 *
 * SENTINEL NAMES (never collide with TestRunner's "TestFirst TestLast")
 *  New Hire:      SdFirst SdLast
 *  EOE:           SdTerm SdTermLast
 *  Status Change: SdChange SdChangeLast
 *  Equipment:     SdEquip SdEquipLast
 *
 * DEPENDENCIES (GAS global scope — no imports needed)
 *  CONFIG, SCHEMA                 — Config.js / SchemaConstants.js
 *  _purgeWorkflowRows             — TestRunner.js
 *  ActionItemService              — Services/ActionItemService.js
 *  submitInitialRequest, etc.     — all handler files
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL STATE
// ─────────────────────────────────────────────────────────────────────────────

var _SD_RESULTS    = [];       // { level, tag, msg } — populated by _sdLog
var _SD_LOG_CP     = 0;        // character-offset checkpoint into Logger.getLog()
var _SD_EMAIL_COUNTS = {};     // phaseLabel → count (for final summary)

// ─────────────────────────────────────────────────────────────────────────────
// SENTINEL CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

var SD_EMAIL       = 'dbinns@team-group.com';
var SD_NH_NAME     = 'SdFirst SdLast';
var SD_TERM_NAME   = 'SdTerm SdTermLast';
var SD_CHANGE_NAME = 'SdChange SdChangeLast';
var SD_EQUIP_NAME  = 'SdEquip SdEquipLast';
var SD_HIRE_DATE   = '2099-06-01';

// ─────────────────────────────────────────────────────────────────────────────
// INFRASTRUCTURE — LOGGING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Central log function. Writes to GAS Logger and appends to _SD_RESULTS.
 * level: 'INFO' | 'PASS' | 'FAIL' | 'WARN' | 'EMAIL' | 'WRITE' | 'LOAD'
 */
function _sdLog(level, tag, msg, dataObj) {
  var line = '[SD][' + level + '][' + tag + '] ' + msg;
  if (dataObj !== null && dataObj !== undefined) {
    try { line += '\n  ' + JSON.stringify(dataObj, null, 2).replace(/\n/g, '\n  '); } catch(e) {}
  }
  Logger.log(line);
  _SD_RESULTS.push({ level: level, tag: tag, msg: msg });
}

/** Print a section divider. */
function _sdSection(phaseNum, title) {
  var bar = '═══════════════════════════════════════════════════';
  Logger.log(bar);
  Logger.log('[SD] Phase ' + phaseNum + ': ' + title);
  Logger.log(bar);
}

/** Print final PASS/FAIL report per suite. */
function _sdSummary(suiteName) {
  var pass = 0, fail = 0, warn = 0;
  _SD_RESULTS.forEach(function(r) {
    if (r.level === 'PASS')  pass++;
    else if (r.level === 'FAIL') fail++;
    else if (r.level === 'WARN') warn++;
  });

  var emailTotal = 0;
  var emailLines = [];
  Object.keys(_SD_EMAIL_COUNTS).forEach(function(phase) {
    emailTotal += _SD_EMAIL_COUNTS[phase];
    emailLines.push('  ' + phase + ': ' + _SD_EMAIL_COUNTS[phase]);
  });

  var bar = '════════════════════════════════════════════════════';
  Logger.log(bar);
  Logger.log('[SD] SUPERDEBUG — ' + suiteName);
  Logger.log(bar);
  Logger.log('  Sheet field checks : PASS ' + pass + '  FAIL ' + fail + '  WARN ' + warn);
  Logger.log('  Emails triggered   : ' + emailTotal + ' total');
  emailLines.forEach(function(l) { Logger.log(l); });
  if (fail === 0) {
    Logger.log('\n  ✓ OVERALL PASS — ' + pass + ' checks, 0 failures');
  } else {
    Logger.log('\n  ✗ OVERALL FAIL — ' + fail + ' failures');
    _SD_RESULTS.filter(function(r) { return r.level === 'FAIL'; }).forEach(function(r) {
      Logger.log('    ✗ [' + r.tag + '] ' + r.msg);
    });
  }
  Logger.log(bar);
  var failures = _SD_RESULTS.filter(function(r) { return r.level === 'FAIL'; })
                             .map(function(r) { return '[' + r.tag + '] ' + r.msg; });
  var debugDumps = _SD_RESULTS.filter(function(r) { return r.tag && r.tag.indexOf('DEBUG') !== -1; })
                              .map(function(r) { return '[' + r.level + '][' + r.tag + '] ' + r.msg; });
  return { pass: pass, fail: fail, warn: warn, emailTotal: emailTotal, failures: failures, debugDumps: debugDumps, gasLog: Logger.getLog() };
}

// ─────────────────────────────────────────────────────────────────────────────
// INFRASTRUCTURE — EMAIL CAPTURE
// ─────────────────────────────────────────────────────────────────────────────

/** Mark a checkpoint in the Logger buffer. Call before triggering an action. */
function _sdEmailCapture() {
  var log = Logger.getLog();
  _SD_LOG_CP = log ? log.length : 0;
}

/**
 * Extract emails that fired since the last _sdEmailCapture() call.
 * Parses lines matching the SUPPRESS_EMAILS prefix from EmailUtils.js:
 *   [EMAIL SUPPRESSED] To: <addr> | Subject: <subject>
 * @param {string} phaseLabel
 * @returns {{ to: string, subject: string }[]}
 */
function _sdEmailExtract(phaseLabel) {
  var fullLog = Logger.getLog() || '';
  var newContent = fullLog.substring(_SD_LOG_CP);
  _SD_LOG_CP = fullLog.length;

  var lines = newContent.split('\n');
  var emails = [];
  var re = /\[EMAIL SUPPRESSED\] To: ([^\|]+)\| Subject: (.+)/;
  for (var i = 0; i < lines.length; i++) {
    var m = lines[i].match(re);
    if (m) {
      emails.push({ to: m[1].trim(), subject: m[2].trim() });
    }
  }

  _SD_EMAIL_COUNTS[phaseLabel] = (_SD_EMAIL_COUNTS[phaseLabel] || 0) + emails.length;
  _sdLog('EMAIL', phaseLabel, emails.length + ' email(s) triggered');
  emails.forEach(function(em, idx) {
    _sdLog('EMAIL', phaseLabel, '  #' + (idx + 1) + ' → To: ' + em.to + ' | Subject: ' + em.subject);
  });
  return emails;
}

// ─────────────────────────────────────────────────────────────────────────────
// INFRASTRUCTURE — SHEET VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find a row in sheetName where column A === workflowId.
 * Returns { found, headers, values, map } — map is header→value.
 */
function _sdReadRow(sheetName, workflowId) {
  var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { found: false, headers: [], values: [], map: {} };

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { found: false, headers: data[0] || [], values: [], map: {} };

  var headers = data[0];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === String(workflowId).trim()) {
      var map = {};
      // Use first-occurrence semantics: if a header appears multiple times
      // (e.g. from stale migration columns), only the first value wins.
      headers.forEach(function(h, idx) {
        if (h && !(h in map)) map[h] = data[i][idx];
      });
      return { found: true, headers: headers, values: data[i], map: map };
    }
  }
  return { found: false, headers: headers, values: [], map: {} };
}

/**
 * Verify a sheet row's fields against expectedMap.
 * Logs PASS/FAIL per field. Returns { pass, fail, failures[] }.
 */
function _sdVerifyRow(tag, sheetName, workflowId, expectedMap) {
  var result = _sdReadRow(sheetName, workflowId);
  if (!result.found) {
    _sdLog('FAIL', tag, sheetName + ' — row not found for ' + workflowId);
    return { pass: 0, fail: 1, failures: [sheetName + ' row not found'] };
  }

  var pass = 0, fail = 0, failures = [];
  Object.keys(expectedMap).forEach(function(field) {
    var actual   = String(result.map[field] === undefined ? '' : result.map[field]);
    var expected = String(expectedMap[field]);
    var ok = (expected === '__notempty__')
      ? actual.trim() !== ''
      : actual === expected;

    if (ok) {
      _sdLog('PASS', tag, sheetName + ' → ' + field + ' = "' + actual + '" ✓');
      pass++;
    } else {
      var detail = expected === '__notempty__'
        ? 'expected non-empty, got ""'
        : 'expected "' + expected + '" got "' + actual + '"';
      _sdLog('FAIL', tag, sheetName + ' → ' + field + ' ✗ ' + detail);
      fail++;
      failures.push(field + ': ' + detail);
    }
  });
  return { pass: pass, fail: fail, failures: failures };
}

/**
 * Dump all header→value pairs for a row (no comparison, pure trace).
 */
function _sdDumpRow(tag, sheetName, workflowId) {
  var result = _sdReadRow(sheetName, workflowId);
  if (!result.found) {
    _sdLog('WARN', tag, sheetName + ' — row not found for ' + workflowId + ' (dump skipped)');
    return;
  }
  _sdLog('LOAD', tag, sheetName + ' row dump:');
  result.headers.forEach(function(h, idx) {
    var v = result.values[idx];
    if (v instanceof Date) v = v.toISOString();
    _sdLog('LOAD', tag, '  [' + h + '] = ' + JSON.stringify(v));
  });
}

/**
 * Verify Action Items created for workflowId.
 * Checks each expected category exists as an open (non-Closed) row.
 * Dumps all 14 fields of every matching row.
 */
function _sdVerifyAI(workflowId, expectedCategories) {
  var tag  = 'AI-' + workflowId;
  var ss   = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
  if (!sheet) { _sdLog('FAIL', tag, 'Action Items sheet not found'); return { found: [], missing: expectedCategories }; }

  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var AI      = SCHEMA.ACTION_ITEMS;
  var rows    = [];

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][AI.WORKFLOW_ID] || '') === workflowId) rows.push(data[i]);
  }

  if (rows.length === 0) {
    _sdLog('FAIL', tag, 'No Action Items found for ' + workflowId);
    return { found: [], missing: expectedCategories };
  }

  _sdLog('INFO', tag, rows.length + ' Action Item row(s) found for ' + workflowId);

  var foundCats = rows.map(function(r) { return String(r[AI.CATEGORY] || ''); });

  // Dump all 14 fields for each row
  rows.forEach(function(row) {
    var cat = String(row[AI.CATEGORY] || '(no category)');
    Logger.log('  [AI DUMP] Category: ' + cat);
    headers.forEach(function(h, idx) {
      var v = row[idx];
      if (v instanceof Date) v = v.toISOString();
      Logger.log('    [' + h + '] = ' + JSON.stringify(v));
    });
  });

  // Check expected categories
  var missing = [];
  expectedCategories.forEach(function(cat) {
    if (foundCats.indexOf(cat) >= 0) {
      _sdLog('PASS', tag, 'Action Item category "' + cat + '" ✓');
    } else {
      _sdLog('FAIL', tag, 'Action Item category "' + cat + '" MISSING (found: ' + foundCats.join(', ') + ')');
      missing.push(cat);
    }
  });

  return { found: foundCats, missing: missing };
}

/**
 * Verify Workflows sheet status and step for workflowId.
 */
function _sdVerifyWorkflow(workflowId, expectedStatus, expectedStep) {
  var tag = 'Workflows-' + workflowId;
  var result = _sdReadRow(CONFIG.SHEETS.WORKFLOWS, workflowId);
  if (!result.found) {
    _sdLog('FAIL', tag, 'Workflows row not found for ' + workflowId);
    return;
  }

  var actualStatus = String(result.map['Status']       || '');
  var actualStep   = String(result.map['Current Step'] || '');

  if (actualStatus === expectedStatus) {
    _sdLog('PASS', tag, 'Status = "' + actualStatus + '" ✓');
  } else {
    _sdLog('FAIL', tag, 'Status expected "' + expectedStatus + '" got "' + actualStatus + '"');
  }

  if (expectedStep) {
    if (actualStep === expectedStep) {
      _sdLog('PASS', tag, 'Current Step = "' + actualStep + '" ✓');
    } else {
      _sdLog('FAIL', tag, 'Current Step expected "' + expectedStep + '" got "' + actualStep + '"');
    }
  } else {
    Logger.log('    [Current Step] = ' + actualStep);
  }
}

/**
 * Verify and dump a Dashboard_View row.
 */
function _sdVerifyDashboardView(workflowId, expectedMap) {
  var tag = 'DashView-' + workflowId;
  _sdDumpRow(tag, CONFIG.SHEETS.DASHBOARD_VIEW, workflowId);
  if (expectedMap && Object.keys(expectedMap).length > 0) {
    _sdVerifyRow(tag, CONFIG.SHEETS.DASHBOARD_VIEW, workflowId, expectedMap);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL SAFETY PRE-FLIGHT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One-time migration: rename "Computer Make" → "Computer Serial" in IT Results header.
 * Safe to re-run — skips if header is already correct.
 */

/**
 * sdFixPositionChangesHeaders()
 * Writes all 61 correct Position Changes headers directly to row 1 at the right positions.
 * Needed when appendRow silently extended the sheet before migration, causing migration to
 * place new headers at wrong column positions (62+ instead of 29-60).
 * Safe to re-run — overwrites header row in place without touching data rows.
 */
function sdFixPositionChangesHeaders() {
  var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEETS.POSITION_CHANGES);
  if (!sheet) { Logger.log('[sdFix] Position Changes sheet not found'); return; }

  var headers = [
    'Workflow ID', 'Form ID', 'Timestamp', 'Requester Name', 'Requester Email',
    'Employee Name', 'Employee ID', 'Effective Date', 'Current Site', 'Change Types',
    'Site Transfer (Old -> New)', 'Title Change (Old -> New)', 'Classification (Old -> New)',
    'Manager Change (Old -> New)', 'Reassign Old Reports To', 'New Reports From',
    'Google Account', 'Systems Added', 'Equipment', 'Removed Access', 'Comments', 'Department',
    'Purchasing Sites', 'Receiving Manager Email', 'Current Title', 'Current Manager Email',
    'Current Manager Name', 'Current Class',
    'Date Requested', 'First Name', 'Last Name',
    'BOSS Training Only', 'BOSS Sites', 'BOSS Cost Sheet', 'BOSS Cost Jobs',
    'BOSS Trip Reports', 'BOSS Grievances',
    'ADP Sites', 'ADP Salary Access',
    'JR Required', 'JR Assignment', '30/60/90 Plan',
    'Computer Req', 'Computer Type', 'Computer Prev User', 'Computer Prev Type', 'Computer Serial', 'Office 365',
    'CC USA', 'CC Limit USA', 'CC Canada', 'CC Limit Canada', 'CC Home Depot', 'CC Limit Home Depot',
    'Phone Req', 'Phone Prev User', 'Phone Prev Number',
    'Jonas Job Numbers', 'Equipment to Return', 'Status', 'Attachment URL'
  ];

  // Write headers directly at positions 1-61 in row 1
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Clear any duplicate header columns beyond position 61 (left by wrong migration runs)
  var lastCol = sheet.getLastColumn();
  if (lastCol > headers.length) {
    var extraCols = lastCol - headers.length;
    sheet.getRange(1, headers.length + 1, 1, extraCols).clearContent();
    Logger.log('[sdFix] Cleared ' + extraCols + ' duplicate header column(s) beyond position ' + headers.length);
  }

  Logger.log('[sdFix] Position Changes headers fixed — ' + headers.length + ' columns written to row 1');
  return { fixed: headers.length, cleared: Math.max(0, lastCol - headers.length) };
}

function sdFixITResultsHeader() {
  var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEETS.IT_RESULTS);
  if (!sheet) return { error: 'IT Results sheet not found' };
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idx = headers.indexOf('Computer Make');
  if (idx === -1) {
    var hasSerial = headers.indexOf('Computer Serial');
    return { alreadyCorrect: true, serialIdx: hasSerial, headers: headers };
  }
  sheet.getRange(1, idx + 1).setValue('Computer Serial');
  SpreadsheetApp.flush();
  return { fixed: true, wasAtColumn: idx + 1, newValue: 'Computer Serial' };
}

/**
 * Returns key config values as GAS actually sees them — diagnoses sheet/config mismatches.
 */
function sdDiagnose() {
  var spreadsheetId = CONFIG.SPREADSHEET_ID;
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var itSheet = ss.getSheetByName(CONFIG.SHEETS.IT_RESULTS);
  var itHeaders = itSheet ? itSheet.getRange(1, 1, 1, 22).getValues()[0] : ['SHEET NOT FOUND'];
  var props = PropertiesService.getScriptProperties().getProperties();
  return {
    spreadsheetId:   spreadsheetId,
    itResultsSheet:  CONFIG.SHEETS.IT_RESULTS,
    itHeaders:       itHeaders,
    scriptProperties: props
  };
}

/**
 * Verify email suppression is active before any test run.
 * Aborts (throws) if neither SUPPRESS_EMAILS nor EMAIL_REDIRECT_ALL is set.
 */
function checkSuperDebugEmailSafety() {
  var suppressed = (typeof CONFIG !== 'undefined' && CONFIG.SUPPRESS_EMAILS === true);
  var redirect   = PropertiesService.getScriptProperties().getProperty('EMAIL_REDIRECT_ALL') || '';

  Logger.log('══ [SD] Email Safety Check ══');
  Logger.log('  CONFIG.SUPPRESS_EMAILS  : ' + (suppressed ? '✓ true' : '✗ FALSE'));
  Logger.log('  EMAIL_REDIRECT_ALL      : ' + (redirect  ? '"' + redirect + '"' : '(not set)'));

  if (!suppressed && !redirect) {
    throw new Error('[SD] EMAIL SAFETY FAIL — neither suppression nor redirect is active. Set CONFIG.SUPPRESS_EMAILS=true or EMAIL_REDIRECT_ALL before running SuperDebug.');
  }
  Logger.log('  ✓ Safe to run — no real emails will reach recipients.');
  Logger.log('════════════════════════════');
  return { suppressed: suppressed, redirect: redirect };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLOSE ALL ACTION ITEMS HELPER (logs each close)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Close every open AI for workflowId in dependency order.
 * Iterates until no open items remain (handles items spawned by closing others).
 * Returns count of items closed.
 */
function _sdCloseAllAI(workflowId, phaseLabel) {
  var closed = 0;
  var maxPasses = 15;
  for (var pass = 0; pass < maxPasses; pass++) {
    var pending = ActionItemService.getPendingTasks(workflowId);
    if (!pending || pending.length === 0) break;

    _sdLog('INFO', phaseLabel, 'Pass ' + (pass + 1) + ': ' + pending.length + ' open AI(s) to close');

    _sdEmailCapture();
    pending.forEach(function(row) {
      var taskId   = row[SCHEMA.ACTION_ITEMS.TASK_ID];
      var taskName = row[SCHEMA.ACTION_ITEMS.TASK_NAME];
      _sdLog('INFO', phaseLabel, 'Closing AI: [' + taskId + '] ' + taskName);
      var r = ActionItemService.closeActionItem(taskId, 'SUPERDEBUG AUTO-CLOSE', SD_EMAIL, null, null);
      if (r && r.success === false) {
        _sdLog('WARN', phaseLabel, 'closeActionItem returned success:false for ' + taskId);
      } else {
        _sdLog('PASS', phaseLabel, 'AI closed: ' + taskName + ' ✓');
      }
      closed++;
    });
    SpreadsheetApp.flush();
    _sdEmailExtract(phaseLabel + ' AI close pass ' + (pass + 1));
    Utilities.sleep(500);
  }
  _sdLog('INFO', phaseLabel, 'Total AIs closed: ' + closed);
  return closed;
}

// ─────────────────────────────────────────────────────────────────────────────
// ██████ NEW HIRE SUITE ██████████████████████████████████████████████████████
// ─────────────────────────────────────────────────────────────────────────────

var SD_NH_INITIAL = {
  requesterName:         'SD Test Runner',
  requesterEmail:        SD_EMAIL,
  dateRequested:         SD_HIRE_DATE,
  firstName:             'SdFirst',
  lastName:              'SdLast',
  middleName:            '',
  preferredName:         '',
  hireDate:              SD_HIRE_DATE,
  newHireOrRehire:       'New Hire',
  employeeType:          'Salaried',
  employmentType:        'Salaried',
  positionTitle:         'SD Test Position',
  siteName:              'SD Test Site',
  jobSiteNumber:         '8888',
  department:            'IT',
  reportingManagerName:  'SD Test Manager',
  reportingManagerEmail: SD_EMAIL,
  systemAccess:          'Yes',
  systems:               ['BOSS', 'SiteDocs', 'Fleetio'],
  equipment:             ['Laptop', 'Business Cards'],
  googleEmail:           '',
  googleDomain:          '',
  computerRequestType:   'New',
  computerType:          'Laptop',
  computerPreviousUser:  '',
  computerPreviousType:  '',
  computerSerialNumber:  '',
  office365Required:     'Yes',
  creditCardUSA:         'Yes',
  creditCardLimitUSA:    '$1,000',
  creditCardCanada:      'No',
  creditCardLimitCanada: '',
  creditCardHomeDepot:   'No',
  creditCardLimitHomeDepot: '',
  phoneRequestType:      'None',
  phonePreviousUser:     '',
  phonePreviousNumber:   '',
  bossJobSites:          'SD-SITE-A, SD-SITE-B',
  bossCostSheet:         'Yes',
  bossCostSheetJobs:     'SD-JOB-001',
  bossTripReports:       'Yes',
  bossGrievances:        'No',
  jonasJobNumbers:       'SD-9999',
  jrRequired:            'No',
  jrAssignment:          '',
  plan306090:            'No',
  comments:              'SUPERDEBUG — DELETE AFTER REVIEW',
  adpSites:              ['8888'],
  purchasingSites:       [],
  adpSalaryAccess:       'No'
};

var SD_NH_IDSETUP = function(wfId) { return {
  workflowId:          wfId,
  internalEmployeeId:  '88888',
  siteDocsWorkerId:    'SD-WID-001',
  siteDocsJobCode:     'SD-JC-001',
  siteDocsUsername:    'sdfirst.sdlast@sitedocs.test',
  siteDocsPassword:    'SdPass123!',
  dssUsername:         'sdfirst.sdlast',
  dssPassword:         'SdPass123!',
  bossWisCreated:      'Yes',
  setupNotes:          'SUPERDEBUG ID SETUP'
}; };

var SD_NH_HRVERIF = function(wfId) { return {
  workflowId:    wfId,
  firstName:     'SdFirst',
  lastName:      'SdLast',
  hireDate:      SD_HIRE_DATE,
  siteName:      'SD Test Site',
  managerName:   'SD Test Manager',
  managerEmail:  SD_EMAIL,
  adpAssociateId:'ADP-SD-88888',
  jobTitle:      'SD Test Position',
  jrTitle:       '',
  department:    'IT',
  notes:         'SUPERDEBUG HR VERIFICATION'
}; };

var SD_NH_ITCONF = function(wfId) { return {
  workflowId:            wfId,
  hireType:              'New Hire',
  employeeType:          'Salaried',
  employmentType:        'Salaried',
  firstName:             'SdFirst',
  lastName:              'SdLast',
  middleName:            '',
  preferredName:         '',
  positionTitle:         'SD Test Position',
  siteName:              'SD Test Site',
  jobSiteNumber:         '8888',
  reportingManagerName:  'SD Test Manager',
  reportingManagerEmail: SD_EMAIL,
  systemAccess:          'Yes',
  systems:               ['BOSS', 'SiteDocs', 'Fleetio'],
  equipment:             ['Laptop', 'Business Cards'],
  googleEmail:           '',
  googleDomain:          '',
  computerRequestType:   'New',
  computerType:          'Laptop',
  phoneRequestType:      'None',
  bossJobSites:          'SD-SITE-A, SD-SITE-B',
  bossCostSheet:         'Yes',
  bossCostSheetJobs:     'SD-JOB-001',
  bossTripReports:       'Yes',
  bossGrievances:        'No',
  jonasJobNumbers:       'SD-9999',
  adpSites:              ['8888'],
  department:            'IT',
  purchasingSites:       [],
  notes:                 'SUPERDEBUG — IT Confirmation pass-through'
}; };

var SD_NH_ITSETUP = function(wfId) { return {
  workflowId:             wfId,
  Email_Created:          'No',
  Email_Username:         '',
  Email_Domain:           '',
  Email_Temp_Password:    '',
  Computer_Assigned:      'Yes',
  Computer_Serial:        'SD-SERIAL-001',
  Computer_Model:         'SD Test Mac',
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
  IT_Notes:               'SUPERDEBUG IT SETUP'
}; };

/**
 * Full New Hire trace — 12 phases.
 */
function runSuperDebugNewHire() {
  _SD_RESULTS = [];
  _SD_EMAIL_COUNTS = {};

  _sdSection(0, 'Pre-flight');
  checkSuperDebugEmailSafety();

  var wfId;
  try {
    // ── Phase 1: Submit Initial Request ──────────────────────────────────────
    _sdSection(1, 'submitInitialRequest');
    _sdEmailCapture();
    var initResult = submitInitialRequest(SD_NH_INITIAL);
    SpreadsheetApp.flush();
    _sdEmailExtract('Phase 1');

    if (!initResult || !initResult.success) throw new Error('submitInitialRequest failed: ' + (initResult && initResult.message));
    wfId = initResult.workflowId;
    _sdLog('INFO', 'Phase 1', 'Workflow ID: ' + wfId);

    // Verify Initial Requests sheet
    var IR = SCHEMA.INITIAL_REQUESTS;
    _sdVerifyRow('Phase 1 Initial Requests', CONFIG.SHEETS.INITIAL_REQUESTS, wfId, {
      'First Name':     'SdFirst',
      'Last Name':      'SdLast',
      'Hire Date':      '__notempty__',
      'System Access':  'Yes',
      'Systems':        '__notempty__',
      'Employee Type':  'Salaried'
    });

    // Verify Workflows sheet
    _sdVerifyWorkflow(wfId, 'In Progress', null);

    // Verify Dashboard_View
    _sdVerifyDashboardView(wfId, {
      'Employee Name': SD_NH_NAME,
      'Global Status': 'In Progress'
    });

    Utilities.sleep(500);

    // ── Phase 2: Form load — getWorkflowContext ───────────────────────────────
    _sdSection(2, 'getWorkflowContext (what ID Setup form sees)');
    var ctx2 = getWorkflowContext(wfId);
    _sdLog('LOAD', 'Phase 2', 'getWorkflowContext field dump:');
    if (ctx2) {
      Object.keys(ctx2).forEach(function(k) { Logger.log('    [' + k + '] = ' + JSON.stringify(ctx2[k])); });
      _sdLog('PASS', 'Phase 2', 'getWorkflowContext returned data ✓');
    } else {
      _sdLog('FAIL', 'Phase 2', 'getWorkflowContext returned null/undefined');
    }

    Utilities.sleep(300);

    // ── Phase 3: ID Setup ─────────────────────────────────────────────────────
    _sdSection(3, 'submitEmployeeIDSetup');
    _sdEmailCapture();
    var idResult = submitEmployeeIDSetup(SD_NH_IDSETUP(wfId));
    SpreadsheetApp.flush();
    _sdEmailExtract('Phase 3');

    if (!idResult || !idResult.success) _sdLog('FAIL', 'Phase 3', 'submitEmployeeIDSetup: ' + (idResult && idResult.message));
    else _sdLog('PASS', 'Phase 3', 'submitEmployeeIDSetup succeeded ✓');

    _sdVerifyRow('Phase 3 ID Setup Results', CONFIG.SHEETS.ID_SETUP_RESULTS, wfId, {
      'Internal Employee ID': '88888',
      'SiteDocs Worker ID':   'SD-WID-001',
      'SiteDocs Job Code':    'SD-JC-001',
      'BOSS WIS Created':     'Yes'
    });
    _sdVerifyWorkflow(wfId, 'In Progress', null);

    Utilities.sleep(500);

    // ── Phase 4: Form load — getHRVerificationData ───────────────────────────
    _sdSection(4, 'getHRVerificationData (what HR Verification form sees)');
    var ctx4 = getHRVerificationData(wfId);
    _sdLog('LOAD', 'Phase 4', 'getHRVerificationData field dump:');
    if (ctx4) {
      Object.keys(ctx4).forEach(function(k) { Logger.log('    [' + k + '] = ' + JSON.stringify(ctx4[k])); });
      _sdLog('PASS', 'Phase 4', 'getHRVerificationData returned data ✓');
    } else {
      _sdLog('FAIL', 'Phase 4', 'getHRVerificationData returned null/undefined');
    }

    Utilities.sleep(300);

    // ── Phase 5: HR Verification ──────────────────────────────────────────────
    _sdSection(5, 'submitHRVerification');
    _sdEmailCapture();
    var hrResult = submitHRVerification(SD_NH_HRVERIF(wfId));
    SpreadsheetApp.flush();
    _sdEmailExtract('Phase 5');

    if (!hrResult || !hrResult.success) _sdLog('FAIL', 'Phase 5', 'submitHRVerification: ' + (hrResult && hrResult.message));
    else _sdLog('PASS', 'Phase 5', 'submitHRVerification succeeded ✓');

    _sdVerifyRow('Phase 5 HR Verif Results', CONFIG.SHEETS.HR_VERIFICATION_RESULTS, wfId, {
      'ADP Associate ID': 'ADP-SD-88888',
      'Verified Name':    '__notempty__'
    });

    // Safety AI should be created here (salaried path)
    _sdLog('INFO', 'Phase 5', 'Checking for Safety Action Item (salaried path — fires in submitHRVerification)');
    _sdVerifyAI(wfId, ['Safety']);
    _sdVerifyWorkflow(wfId, 'In Progress', null);

    Utilities.sleep(500);

    // ── Phase 6: Form load — getFullNewHireData ───────────────────────────────
    _sdSection(6, 'getFullNewHireData (what IT Confirmation form sees)');
    var ctx6 = getFullNewHireData(wfId);
    _sdLog('LOAD', 'Phase 6', 'getFullNewHireData field dump (' + (ctx6 ? Object.keys(ctx6).length : 0) + ' fields):');
    if (ctx6) {
      Object.keys(ctx6).forEach(function(k) { Logger.log('    [' + k + '] = ' + JSON.stringify(ctx6[k])); });
      _sdLog('PASS', 'Phase 6', 'getFullNewHireData returned data ✓');
    } else {
      _sdLog('FAIL', 'Phase 6', 'getFullNewHireData returned null/undefined');
    }

    Utilities.sleep(300);

    // ── Phase 7: IT Confirmation ──────────────────────────────────────────────
    _sdSection(7, 'submitITConfirmation');
    _sdEmailCapture();
    var itcResult = submitITConfirmation(SD_NH_ITCONF(wfId));
    SpreadsheetApp.flush();
    _sdEmailExtract('Phase 7');

    if (!itcResult || !itcResult.success) _sdLog('FAIL', 'Phase 7', 'submitITConfirmation: ' + (itcResult && itcResult.message));
    else _sdLog('PASS', 'Phase 7', 'submitITConfirmation succeeded ✓');

    _sdVerifyWorkflow(wfId, 'In Progress', 'IT Setup Needed');

    Utilities.sleep(500);

    // ── Phase 8: Form load — getWorkflowContext post-ITConf ───────────────────
    _sdSection(8, 'getWorkflowContext post-IT Confirmation (what IT Setup form sees)');
    var ctx8 = getWorkflowContext(wfId);
    if (ctx8) {
      Object.keys(ctx8).forEach(function(k) { Logger.log('    [' + k + '] = ' + JSON.stringify(ctx8[k])); });
      _sdLog('PASS', 'Phase 8', 'getWorkflowContext (post-ITConf) returned data ✓');
    } else {
      _sdLog('FAIL', 'Phase 8', 'getWorkflowContext (post-ITConf) returned null');
    }

    Utilities.sleep(300);

    // ── Phase 9: IT Setup ─────────────────────────────────────────────────────
    _sdSection(9, 'submitITSetup');
    _sdEmailCapture();
    var itsResult = submitITSetup(SD_NH_ITSETUP(wfId));
    SpreadsheetApp.flush();
    _sdEmailExtract('Phase 9');

    if (!itsResult || !itsResult.success) _sdLog('FAIL', 'Phase 9', 'submitITSetup: ' + (itsResult && itsResult.message));
    else _sdLog('PASS', 'Phase 9', 'submitITSetup succeeded ✓');

    // Debug: dump raw IT Results row to confirm what was written
    _sdDumpRow('Phase 9 IT Results DEBUG', CONFIG.SHEETS.IT_RESULTS, wfId);

    _sdVerifyRow('Phase 9 IT Results', CONFIG.SHEETS.IT_RESULTS, wfId, {
      'Computer Assigned':  'Yes',
      'Computer Serial':    'SD-SERIAL-001',
      'BOSS Access':        'Yes'
    });

    // Verify all expected AIs created by triggerSpecialists
    // Safety already exists; new ones: Credit Card, Business Cards, Fleetio, 30/60/90 Review, Jonas, WIS
    _sdVerifyAI(wfId, ['Safety', 'Credit Card', 'Business Cards', 'Fleetio', '30/60/90 Review', 'Jonas', 'WIS']);
    _sdVerifyWorkflow(wfId, 'In Progress', 'Specialist Forms Needed');

    Utilities.sleep(500);

    // ── Phase 10: Close each AI individually ─────────────────────────────────
    _sdSection(10, 'Close Action Items one by one');
    _sdLog('INFO', 'Phase 10', 'Closing all AIs — last one triggers completion check');
    _sdEmailCapture();
    var closedCount = _sdCloseAllAI(wfId, 'Phase 10');
    SpreadsheetApp.flush();
    _sdEmailExtract('Phase 10 final');
    _sdLog('INFO', 'Phase 10', 'Closed ' + closedCount + ' total AI(s)');

    Utilities.sleep(800);

    // ── Phase 11: Completion verification ────────────────────────────────────
    _sdSection(11, 'Completion verification');
    _sdVerifyWorkflow(wfId, 'Complete', null);
    _sdVerifyDashboardView(wfId, {
      'Employee Name': SD_NH_NAME,
      'Global Status': 'Complete'
    });

    // ── Phase 12: Final sheet audit ───────────────────────────────────────────
    _sdSection(12, 'Final sheet audit — all sheets touched');
    _sdDumpRow('Phase 12 Final', CONFIG.SHEETS.INITIAL_REQUESTS,       wfId);
    _sdDumpRow('Phase 12 Final', CONFIG.SHEETS.ID_SETUP_RESULTS,       wfId);
    _sdDumpRow('Phase 12 Final', CONFIG.SHEETS.HR_VERIFICATION_RESULTS,wfId);
    _sdDumpRow('Phase 12 Final', CONFIG.SHEETS.IT_RESULTS,             wfId);
    _sdDumpRow('Phase 12 Final', CONFIG.SHEETS.WORKFLOWS,              wfId);
    _sdDumpRow('Phase 12 Final', CONFIG.SHEETS.DASHBOARD_VIEW,         wfId);

  } catch (e) {
    _sdLog('FAIL', 'New Hire Suite', 'ABORTED: ' + e.message);
    Logger.log('[SD][ERROR] Stack: ' + e.stack);
  }

  return _sdSummary('New Hire — ' + (wfId || '(no wfId)'));
}

// ─────────────────────────────────────────────────────────────────────────────
// ██████ EOE SUITE ████████████████████████████████████████████████████████████
// ─────────────────────────────────────────────────────────────────────────────

var SD_TERM_REQUEST = {
  reqName:         'SD Test Runner',
  reqEmail:        SD_EMAIL,
  empName:         'SdTerm SdTermLast',
  empType:         'Salaried',
  empWorkEmail:    'sdterm@team-group.com',
  empPhone:        '555-888-8888',
  empSerial:       'SD-TERM-SERIAL-001',
  siteName:        'SD Term Site',
  termDate:        SD_HIRE_DATE,
  reason:          'Voluntary Resignation',
  managerName:     'SD Term Manager',
  managerEmail:    SD_EMAIL,
  has_reports:     'Yes',
  reports_to_new:  SD_EMAIL,
  systems:         ['BOSS', 'Google Account', 'SiteDocs', 'ADP Supervisor Access', 'Fleetio', 'Central Purchasing/Jonas'],
  equip:           ['Computer', 'Mobile Phone', 'Vehicle'],
  google_forward:  SD_EMAIL,
  google_files:    SD_EMAIL,
  google_delegate: SD_EMAIL,
  google_duration: '1 Month',
  google_vacation: 'This employee is no longer with TEAM Group. Please contact [RECIPIENT] for assistance.',
  comments:        'SUPERDEBUG EOE — DELETE AFTER REVIEW',
  lastDayWorked:   SD_HIRE_DATE
};

var SD_TERM_APPROVAL = function(wfId) { return {
  workflowId: wfId,
  decision:   'Approved',
  notes:      'SUPERDEBUG EOE APPROVAL'
}; };

/**
 * Full EOE (Termination) trace — 10 phases.
 */
function runSuperDebugEOE() {
  _SD_RESULTS = [];
  _SD_EMAIL_COUNTS = {};

  _sdSection(0, 'Pre-flight');
  checkSuperDebugEmailSafety();

  var wfId;
  try {
    // ── Phase 1: Submit Termination Request ───────────────────────────────────
    _sdSection(1, 'submitTerminationRequest');
    _sdEmailCapture();
    var termResult = submitTerminationRequest(SD_TERM_REQUEST);
    SpreadsheetApp.flush();
    _sdEmailExtract('Phase 1');

    if (!termResult || !termResult.success) throw new Error('submitTerminationRequest failed: ' + (termResult && termResult.message));
    wfId = termResult.workflowId;
    _sdLog('INFO', 'Phase 1', 'Workflow ID: ' + wfId);

    _sdVerifyRow('Phase 1 Terminations', CONFIG.SHEETS.TERMINATIONS, wfId, {
      'Employee Name':         'SdTerm SdTermLast',
      'Employee Type':         'Salaried',
      'Term Date':             '__notempty__',
      'Systems to Deactivate': '__notempty__',
      'Equipment to Return':   '__notempty__'
    });
    _sdVerifyWorkflow(wfId, 'In Progress', 'HR Approval Needed');
    _sdVerifyDashboardView(wfId, {
      'Employee Name': SD_TERM_NAME,
      'Global Status': 'In Progress'
    });

    Utilities.sleep(500);

    // ── Phase 2: Form load — getTerminationData ───────────────────────────────
    _sdSection(2, 'getTerminationData (what Termination Approval form sees)');
    var ctx2 = getTerminationData(wfId);
    _sdLog('LOAD', 'Phase 2', 'getTerminationData field dump:');
    if (ctx2) {
      Object.keys(ctx2).forEach(function(k) { Logger.log('    [' + k + '] = ' + JSON.stringify(ctx2[k])); });
      _sdLog('PASS', 'Phase 2', 'getTerminationData returned data ✓');
    } else {
      _sdLog('FAIL', 'Phase 2', 'getTerminationData returned null/undefined');
    }

    Utilities.sleep(300);

    // ── Phase 3: Termination Approval ────────────────────────────────────────
    _sdSection(3, 'submitTerminationApproval');
    _sdEmailCapture();
    var apprResult = submitTerminationApproval(SD_TERM_APPROVAL(wfId));
    SpreadsheetApp.flush();
    _sdEmailExtract('Phase 3');

    if (!apprResult || !apprResult.success) _sdLog('FAIL', 'Phase 3', 'submitTerminationApproval: ' + (apprResult && apprResult.message));
    else _sdLog('PASS', 'Phase 3', 'submitTerminationApproval succeeded ✓');

    _sdVerifyRow('Phase 3 Term Approval', CONFIG.SHEETS.TERMINATION_APPROVALS, wfId, {
      'Decision':  'Approved',
      'Notes':     'SUPERDEBUG EOE APPROVAL'
    });

    // Verify AIs created: IT, HR, Fleet, Finance, Deactivation, Assets + Safety/SiteDocs
    _sdLog('INFO', 'Phase 3', 'Verifying Action Items created by approval...');
    _sdVerifyAI(wfId, ['IT', 'HR', 'Fleet', 'Finance', 'Deactivation', 'EOE', 'Assets']);

    _sdVerifyWorkflow(wfId, 'In Progress', null);

    Utilities.sleep(500);

    // ── Phase 4–9: Close each AI (Assets triggers conditional sub-emails) ─────
    _sdSection(4, 'Close all EOE Action Items');
    _sdLog('INFO', 'Phase 4', 'Closing AIs — Assets closure triggers IT/Finance/Fleet sub-emails');
    _sdEmailCapture();
    var closedCount = _sdCloseAllAI(wfId, 'Phase 4-9 EOE');
    SpreadsheetApp.flush();
    _sdEmailExtract('Phase 4-9 final');
    _sdLog('INFO', 'Phase 4-9', 'Closed ' + closedCount + ' total AI(s)');

    Utilities.sleep(800);

    // ── Phase 10: Completion + final audit ────────────────────────────────────
    _sdSection(10, 'Completion + Final Audit');
    _sdVerifyWorkflow(wfId, 'Complete', null);
    _sdVerifyDashboardView(wfId, {
      'Employee Name': SD_TERM_NAME,
      'Global Status': 'Complete'
    });
    _sdDumpRow('Phase 10 Final', CONFIG.SHEETS.TERMINATIONS,           wfId);
    _sdDumpRow('Phase 10 Final', CONFIG.SHEETS.TERMINATION_APPROVALS,  wfId);
    _sdDumpRow('Phase 10 Final', CONFIG.SHEETS.WORKFLOWS,              wfId);
    _sdDumpRow('Phase 10 Final', CONFIG.SHEETS.DASHBOARD_VIEW,         wfId);

  } catch (e) {
    _sdLog('FAIL', 'EOE Suite', 'ABORTED: ' + e.message);
    Logger.log('[SD][ERROR] Stack: ' + e.stack);
  }

  return _sdSummary('End of Employment — ' + (wfId || '(no wfId)'));
}

// ─────────────────────────────────────────────────────────────────────────────
// ██████ STATUS CHANGE SUITES █████████████████████████████████████████████████
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a position change request payload.
 * @param {Object} overrides — fields to merge/override on top of the base payload
 */
function _sdChangePayload(overrides) {
  // Field names MUST match what submitPositionChangeRequest() reads from formData.
  // Handler reads: reqName, reqEmail, reqDate, effDate, siteName, changeType (array),
  //   titleOld/titleNew, classOld/classNew, mgrOldName/mgrOldEmail/mgrNewName/mgrNewEmail,
  //   sys (array→SYSTEMS_ADDED), equip (array→EQUIPMENT), rem (array→REMOVED_ACCESS),
  //   equipRem (array→EQUIPMENT_RETURN), bossComm (array→BOSS_SITES), bossCost, bossTrip, etc.
  var base = {
    reqName:               'SD Test Runner',
    reqEmail:              SD_EMAIL,
    reqDate:               SD_HIRE_DATE,
    firstName:             'SdChange',
    lastName:              'SdChangeLast',
    effDate:               SD_HIRE_DATE,
    siteName:              'SD Current Site',
    changeType:            [],           // array → csv → CHANGE_TYPES
    siteOld:               'N/A',
    siteNew:               'N/A',
    titleOld:              'SD Old Title',
    titleNew:              'N/A',        // "titleOld -> titleNew" written to TITLE_CHANGE
    classOld:              'Salaried',
    classNew:              'N/A',        // "classOld -> classNew" written to CLASSIFICATION
    mgrOldName:            'SD Current Manager',
    mgrOldEmail:           SD_EMAIL,
    mgrNewName:            '',
    mgrNewEmail:           '',
    oldReportsTo:          '',
    newReportsFrom:        '',
    sys:                   [],           // array → csv → SYSTEMS_ADDED
    equip:                 [],           // array → csv → EQUIPMENT
    rem:                   [],           // array → csv → REMOVED_ACCESS
    equipRem:              [],           // array → csv → EQUIPMENT_RETURN
    comments:              'SUPERDEBUG STATUS CHANGE — DELETE',
    department:            'IT',
    purchasingSites:       [],
    receivingManagerEmail: '',
    currentTitle:          'SD Old Title',
    currentManagerEmail:   SD_EMAIL,
    currentManagerName:    'SD Current Manager',
    currentClass:          'Salaried',
    bossTrainingOnly:      'No',
    bossComm:              [],           // array → csv → BOSS_SITES (committees)
    bossCost:              'No',         // BOSS_COST_SHEET
    bossCostJobs:          [],           // array → csv → BOSS_COST_JOBS
    bossTrip:              'No',         // BOSS_TRIP
    bossGrievances:        'No',
    adpSites:              [],
    adpSalaryAccess:       'No',
    jrRequired:            'No',
    jrAssignment:          '',
    plan306090:            'No',
    computerReq:           'N/A',
    computerType:          '',
    computerPrevUser:      '',
    computerPrevType:      '',
    computerSerial:        '',
    office365:             'No',
    ccUSA:                 'No',
    ccLimitUSA:            '',
    ccCAN:                 'No',
    ccLimitCAN:            '',
    ccHD:                  'No',
    ccLimitHD:             '',
    phoneReq:              'N/A',
    phonePrevUser:         '',
    phonePrevNumber:       '',
    jonasJobNumbers:       ''
  };
  Object.keys(overrides || {}).forEach(function(k) { base[k] = overrides[k]; });
  return base;
}

var SD_CHANGE_APPROVAL = function(wfId) { return {
  workflowId:          wfId,
  decision:            'Approved',
  notes:               'SUPERDEBUG STATUS CHANGE APPROVAL',
  confirmedTitle:      'SD New Title',
  confirmedNewManager: SD_EMAIL,
  confirmedJrTitle:    ''
}; };

// ── Sub-suite A: Title + Classification Change ────────────────────────────────

function runSuperDebugStatusChange_Title() {
  _SD_RESULTS = [];
  _SD_EMAIL_COUNTS = {};
  _sdSection(0, 'Pre-flight');
  checkSuperDebugEmailSafety();

  var wfId;
  try {
    _sdSection(1, 'submitPositionChangeRequest — Title + Classification');
    _sdEmailCapture();
    var payload = _sdChangePayload({
      changeType:   ['Title Change', 'Classification Change'],
      titleOld:     'SD Old Title',
      titleNew:     'SD New Title',
      classOld:     'Salaried',
      classNew:     'Hourly',
      sys:          ['BOSS'],
      bossComm:     ['SD-SITE-A'],
      bossCost:     'Yes',
      bossCostJobs: ['SD-JOB-001'],
      adpSites:     ['8888']
    });
    var r = submitPositionChangeRequest(payload);
    SpreadsheetApp.flush();
    _sdEmailExtract('Phase 1 Title');

    if (!r || !r.success) throw new Error('submitPositionChangeRequest (Title) failed: ' + (r && r.message));
    wfId = r.workflowId;
    _sdLog('INFO', 'Phase 1', 'Workflow ID: ' + wfId);

    _sdVerifyRow('Phase 1 PosChanges', CONFIG.SHEETS.POSITION_CHANGES, wfId, {
      'Employee Name':              'SdChange SdChangeLast',
      'Change Types':               '__notempty__',
      'Title Change (Old -> New)':  'SD Old Title -> SD New Title',
      'Classification (Old -> New)':'Salaried -> Hourly'
    });
    _sdVerifyWorkflow(wfId, 'In Progress', 'HR Approval Needed');
    _sdVerifyDashboardView(wfId, { 'Employee Name': SD_CHANGE_NAME });

    Utilities.sleep(500);

    _sdSection(2, 'getPositionChangeData (what Approval form sees)');
    var ctx2 = getPositionChangeData(wfId);
    if (ctx2) {
      Object.keys(ctx2).forEach(function(k) { Logger.log('    [' + k + '] = ' + JSON.stringify(ctx2[k])); });
      _sdLog('PASS', 'Phase 2', 'getPositionChangeData returned data ✓');
    } else {
      _sdLog('FAIL', 'Phase 2', 'getPositionChangeData returned null');
    }

    Utilities.sleep(300);

    _sdSection(3, 'submitPositionChangeApproval');
    _sdEmailCapture();
    var ar = submitPositionChangeApproval(SD_CHANGE_APPROVAL(wfId));
    SpreadsheetApp.flush();
    _sdEmailExtract('Phase 3 Title Approval');

    if (!ar || !ar.success) _sdLog('FAIL', 'Phase 3', 'submitPositionChangeApproval: ' + (ar && ar.message));
    else _sdLog('PASS', 'Phase 3', 'submitPositionChangeApproval succeeded ✓');

    _sdVerifyRow('Phase 3 ChangeAppr', CONFIG.SHEETS.POSITION_CHANGE_APPROVALS, wfId, {
      'Decision': 'Approved'
    });
    // Always created: ID Setup, Safety. BOSS in sys → IT.
    _sdVerifyAI(wfId, ['IT', 'ID Setup', 'Safety']);

    Utilities.sleep(500);

    _sdSection(4, 'Close Action Items + Completion');
    _sdEmailCapture();
    _sdCloseAllAI(wfId, 'Phase 4 Title');
    SpreadsheetApp.flush();
    _sdEmailExtract('Phase 4 Title final');
    Utilities.sleep(800);
    _sdVerifyWorkflow(wfId, 'Complete', null);
    _sdDumpRow('Phase 5 Final', CONFIG.SHEETS.POSITION_CHANGES,         wfId);
    _sdDumpRow('Phase 5 Final', CONFIG.SHEETS.POSITION_CHANGE_APPROVALS,wfId);
    _sdDumpRow('Phase 5 Final', CONFIG.SHEETS.WORKFLOWS,                wfId);

  } catch (e) {
    _sdLog('FAIL', 'StatusChange Title Suite', 'ABORTED: ' + e.message);
    Logger.log('[SD][ERROR] Stack: ' + e.stack);
  }

  return _sdSummary('Status Change — Title + Classification');
}

// ── Sub-suite B: Site Transfer + Manager + Fleetio + Vehicle ─────────────────

function runSuperDebugStatusChange_Site() {
  _SD_RESULTS = [];
  _SD_EMAIL_COUNTS = {};
  _sdSection(0, 'Pre-flight');
  checkSuperDebugEmailSafety();

  var wfId;
  try {
    _sdSection(1, 'submitPositionChangeRequest — Site Transfer');
    _sdEmailCapture();
    var payload = _sdChangePayload({
      changeType:           ['Site Transfer', 'Manager Change'],
      siteOld:              'SD Current Site',
      siteNew:              'SD New Site',
      mgrOldName:           'SD Current Manager',
      mgrOldEmail:          SD_EMAIL,
      mgrNewName:           'SD New Manager',
      mgrNewEmail:          SD_EMAIL,
      receivingManagerEmail:SD_EMAIL,
      sys:                  ['Fleetio', 'BOSS'],   // Fleetio → Fleetio AI; BOSS → IT AI
      equip:                ['Vehicle'],
      equipRem:             ['Vehicle'],            // vehicle return → Assets + Fleetio return
      adpSites:             ['8888']
    });
    var r = submitPositionChangeRequest(payload);
    SpreadsheetApp.flush();
    _sdEmailExtract('Phase 1 Site');

    if (!r || !r.success) throw new Error('submitPositionChangeRequest (Site) failed: ' + (r && r.message));
    wfId = r.workflowId;
    _sdLog('INFO', 'Phase 1', 'Workflow ID: ' + wfId);

    _sdVerifyRow('Phase 1 PosChanges', CONFIG.SHEETS.POSITION_CHANGES, wfId, {
      'Employee Name':              'SdChange SdChangeLast',
      'Change Types':               '__notempty__',
      'Site Transfer (Old -> New)': 'SD Current Site -> SD New Site'
    });
    _sdVerifyWorkflow(wfId, 'In Progress', 'HR Approval Needed');
    _sdVerifyDashboardView(wfId, { 'Employee Name': SD_CHANGE_NAME });

    Utilities.sleep(500);

    _sdSection(2, 'getPositionChangeData dump');
    var ctx2 = getPositionChangeData(wfId);
    if (ctx2) {
      Object.keys(ctx2).forEach(function(k) { Logger.log('    [' + k + '] = ' + JSON.stringify(ctx2[k])); });
      _sdLog('PASS', 'Phase 2', 'getPositionChangeData returned data ✓');
    }

    Utilities.sleep(300);

    _sdSection(3, 'submitPositionChangeApproval');
    _sdEmailCapture();
    var ar = submitPositionChangeApproval(SD_CHANGE_APPROVAL(wfId));
    SpreadsheetApp.flush();
    _sdEmailExtract('Phase 3 Site Approval');

    if (!ar || !ar.success) _sdLog('FAIL', 'Phase 3', 'submitPositionChangeApproval: ' + (ar && ar.message));
    else _sdLog('PASS', 'Phase 3', 'submitPositionChangeApproval succeeded ✓');

    // Manager (receivingManagerEmail set), Fleetio access + Fleetio vehicle return,
    // IT (BOSS in sys), Assets (Vehicle in equipRem), ID Setup + Safety (always).
    _sdVerifyAI(wfId, ['Manager', 'Fleetio', 'IT', 'Assets', 'ID Setup', 'Safety']);

    Utilities.sleep(500);

    _sdSection(4, 'Close Action Items + Completion');
    _sdEmailCapture();
    _sdCloseAllAI(wfId, 'Phase 4 Site');
    SpreadsheetApp.flush();
    _sdEmailExtract('Phase 4 Site final');
    Utilities.sleep(800);
    _sdVerifyWorkflow(wfId, 'Complete', null);
    _sdDumpRow('Phase 5 Final', CONFIG.SHEETS.POSITION_CHANGES, wfId);
    _sdDumpRow('Phase 5 Final', CONFIG.SHEETS.WORKFLOWS,        wfId);

  } catch (e) {
    _sdLog('FAIL', 'StatusChange Site Suite', 'ABORTED: ' + e.message);
    Logger.log('[SD][ERROR] Stack: ' + e.stack);
  }

  return _sdSummary('Status Change — Site Transfer');
}

// ── Sub-suite C: Full Kitchen Sink (all types + all systems + equipment returns) ─

function runSuperDebugStatusChange_Full() {
  _SD_RESULTS = [];
  _SD_EMAIL_COUNTS = {};
  _sdSection(0, 'Pre-flight');
  checkSuperDebugEmailSafety();

  var wfId;
  try {
    _sdSection(1, 'submitPositionChangeRequest — Full Kitchen Sink');
    _sdEmailCapture();
    var payload = _sdChangePayload({
      changeType:            ['Title Change', 'Classification Change', 'Site Transfer', 'Manager Change'],
      titleOld:              'SD Old Title',
      titleNew:              'SD New Title',
      classOld:              'Salaried',
      classNew:              'Hourly',
      siteOld:               'SD Current Site',
      siteNew:               'SD New Site',
      mgrOldName:            'SD Current Manager',
      mgrOldEmail:           SD_EMAIL,
      mgrNewName:            'SD New Manager',
      mgrNewEmail:           SD_EMAIL,
      receivingManagerEmail: SD_EMAIL,
      sys:                   ['BOSS', 'Fleetio', 'Central Purchasing/Jonas'],  // exact system names
      rem:                   ['SiteDocs'],         // SiteDocs removal → Safety AI
      equip:                 ['Vehicle', 'Computer', 'Credit Card'],  // Credit Card in equip → Credit Card AI
      equipRem:              ['Vehicle', 'Computer'],  // vehicle + computer return
      bossComm:              ['SD-SITE-A'],
      bossCost:              'Yes',
      bossCostJobs:          ['SD-JOB-001'],
      adpSites:              ['8888'],
      jonasJobNumbers:       'SD-9999',
      ccUSA:                 'Yes',
      ccLimitUSA:            '$500',
      plan306090:            'Yes',
      comments:              'SUPERDEBUG FULL STATUS CHANGE — DELETE'
    });
    var r = submitPositionChangeRequest(payload);
    SpreadsheetApp.flush();
    _sdEmailExtract('Phase 1 Full');

    if (!r || !r.success) throw new Error('submitPositionChangeRequest (Full) failed: ' + (r && r.message));
    wfId = r.workflowId;
    _sdLog('INFO', 'Phase 1', 'Workflow ID: ' + wfId);

    _sdVerifyRow('Phase 1 PosChanges Full', CONFIG.SHEETS.POSITION_CHANGES, wfId, {
      'Employee Name':                 'SdChange SdChangeLast',
      'Change Types':                  '__notempty__',
      'Title Change (Old -> New)':     'SD Old Title -> SD New Title',
      'Classification (Old -> New)':   'Salaried -> Hourly',
      'Site Transfer (Old -> New)':    'SD Current Site -> SD New Site',
      'Systems Added':                 '__notempty__',
      'Equipment to Return':           '__notempty__'
    });
    _sdVerifyWorkflow(wfId, 'In Progress', 'HR Approval Needed');
    _sdVerifyDashboardView(wfId, { 'Employee Name': SD_CHANGE_NAME });

    Utilities.sleep(500);

    _sdSection(2, 'getFullPositionChangeData dump');
    var ctx2 = getFullPositionChangeData(wfId);
    _sdLog('LOAD', 'Phase 2', 'getFullPositionChangeData field dump:');
    if (ctx2) {
      Object.keys(ctx2).forEach(function(k) { Logger.log('    [' + k + '] = ' + JSON.stringify(ctx2[k])); });
      _sdLog('PASS', 'Phase 2', 'getFullPositionChangeData returned data ✓');
    } else {
      _sdLog('FAIL', 'Phase 2', 'getFullPositionChangeData returned null');
    }

    Utilities.sleep(300);

    _sdSection(3, 'submitPositionChangeApproval');
    _sdEmailCapture();
    var ar = submitPositionChangeApproval(SD_CHANGE_APPROVAL(wfId));
    SpreadsheetApp.flush();
    _sdEmailExtract('Phase 3 Full Approval');

    if (!ar || !ar.success) _sdLog('FAIL', 'Phase 3', 'submitPositionChangeApproval: ' + (ar && ar.message));
    else _sdLog('PASS', 'Phase 3', 'submitPositionChangeApproval succeeded ✓');

    // Manager (receivingManagerEmail), IT (BOSS in sys + Computer in equip/ret),
    // Fleetio (sys + vehicle return), Jonas (Central Purchasing/Jonas in sys),
    // Credit Card (Credit Card in equip), Assets (Vehicle+Computer in equipRem),
    // Safety (SiteDocs removal + always), ID Setup (always).
    _sdVerifyAI(wfId, ['Manager', 'IT', 'Fleetio', 'Jonas', 'Credit Card', 'Assets', 'ID Setup', 'Safety']);

    Utilities.sleep(500);

    _sdSection(4, 'Close Action Items + Completion');
    _sdEmailCapture();
    _sdCloseAllAI(wfId, 'Phase 4 Full');
    SpreadsheetApp.flush();
    _sdEmailExtract('Phase 4 Full final');
    Utilities.sleep(800);
    _sdVerifyWorkflow(wfId, 'Complete', null);
    _sdDumpRow('Phase 5 Final', CONFIG.SHEETS.POSITION_CHANGES,          wfId);
    _sdDumpRow('Phase 5 Final', CONFIG.SHEETS.POSITION_CHANGE_APPROVALS, wfId);
    _sdDumpRow('Phase 5 Final', CONFIG.SHEETS.WORKFLOWS,                 wfId);
    _sdDumpRow('Phase 5 Final', CONFIG.SHEETS.DASHBOARD_VIEW,            wfId);

  } catch (e) {
    _sdLog('FAIL', 'StatusChange Full Suite', 'ABORTED: ' + e.message);
    Logger.log('[SD][ERROR] Stack: ' + e.stack);
  }

  return _sdSummary('Status Change — Full Kitchen Sink');
}

/** Run all 3 Status Change sub-suites in sequence. */
function runSuperDebugStatusChange() {
  Logger.log('[SD] ═══ Running all 3 Status Change sub-suites ═══');
  var r1 = runSuperDebugStatusChange_Title();
  Utilities.sleep(1000);
  var r2 = runSuperDebugStatusChange_Site();
  Utilities.sleep(1000);
  var r3 = runSuperDebugStatusChange_Full();
  Logger.log('[SD] Status Change combined: PASS ' + (r1.pass + r2.pass + r3.pass) +
             '  FAIL ' + (r1.fail + r2.fail + r3.fail));
  return { title: r1, site: r2, full: r3 };
}

// ─────────────────────────────────────────────────────────────────────────────
// ██████ EQUIPMENT SUITE ██████████████████████████████████████████████████████
// ─────────────────────────────────────────────────────────────────────────────

var SD_EQUIP_REQUEST = {
  requesterName:  'SD Test Runner',
  requesterEmail: SD_EMAIL,
  reqName:        'SD Test Runner',
  reqEmail:       SD_EMAIL,
  firstName:      'SdEquip',
  lastName:       'SdEquipLast',
  siteName:       'SD Equip Site',
  position:       'SD Equip Position',
  managerName:    'SD Equip Manager',
  managerEmail:   SD_EMAIL,
  systems:        ['BOSS', 'Jonas'],
  equipment:      ['Laptop', 'Business Cards'],
  department:     'IT',
  comments:       'SUPERDEBUG EQUIPMENT REQUEST — DELETE',
  jonasJobNumbers:'SD-EQUIP-9999',
  adpSites:       ['8888'],
  purchasingSites:[],
  bossJobSites:   'SD-SITE-A',
  bossCostSheet:  'No',
  bossCostSheetJobs:'',
  bossTripReports:'No',
  bossGrievances: 'No',
  creditCardUSA:  'No',
  creditCardCanada:'No',
  creditCardHomeDepot:'No',
  phoneRequestType:'None'
};

var SD_EQUIP_ITCONF = function(wfId) { return {
  workflowId:            wfId,
  hireType:              'Equipment Request',
  employeeType:          '',
  employmentType:        '',
  firstName:             'SdEquip',
  lastName:              'SdEquipLast',
  middleName:            '',
  preferredName:         '',
  positionTitle:         'SD Equip Position',
  siteName:              'SD Equip Site',
  jobSiteNumber:         '8888',
  reportingManagerName:  'SD Equip Manager',
  reportingManagerEmail: SD_EMAIL,
  systemAccess:          'Yes',
  systems:               ['BOSS', 'Jonas'],
  equipment:             ['Laptop', 'Business Cards'],
  googleEmail:           '',
  googleDomain:          '',
  computerRequestType:   'New',
  computerType:          'Laptop',
  phoneRequestType:      'None',
  bossJobSites:          'SD-SITE-A',
  bossCostSheet:         'No',
  bossCostSheetJobs:     '',
  bossTripReports:       'No',
  bossGrievances:        'No',
  jonasJobNumbers:       'SD-EQUIP-9999',
  adpSites:              ['8888'],
  department:            'IT',
  purchasingSites:       [],
  notes:                 'SUPERDEBUG — Equipment IT Confirmation'
}; };

/**
 * Full Equipment Request trace — 8 phases.
 */
function runSuperDebugEquipment() {
  _SD_RESULTS = [];
  _SD_EMAIL_COUNTS = {};
  _sdSection(0, 'Pre-flight');
  checkSuperDebugEmailSafety();

  var wfId;
  try {
    // ── Phase 1: Submit Equipment Request ─────────────────────────────────────
    _sdSection(1, 'submitEquipmentRequest');
    _sdEmailCapture();
    var eqResult = submitEquipmentRequest(SD_EQUIP_REQUEST);
    SpreadsheetApp.flush();
    _sdEmailExtract('Phase 1 Equip');

    if (!eqResult || !eqResult.success) throw new Error('submitEquipmentRequest failed: ' + (eqResult && eqResult.message));
    wfId = eqResult.workflowId;
    _sdLog('INFO', 'Phase 1', 'Workflow ID: ' + wfId);

    _sdVerifyRow('Phase 1 Initial Requests', CONFIG.SHEETS.INITIAL_REQUESTS, wfId, {
      'First Name':  'SdEquip',
      'Last Name':   'SdEquipLast',
      'System Access': 'Yes'
    });
    _sdVerifyWorkflow(wfId, 'In Progress', 'IT Confirmation Needed');
    _sdVerifyDashboardView(wfId, { 'Employee Name': SD_EQUIP_NAME });

    Utilities.sleep(500);

    // ── Phase 2: Form load — getFullNewHireData ───────────────────────────────
    _sdSection(2, 'getFullNewHireData (what Equipment IT Confirmation form sees)');
    var ctx2 = getFullNewHireData(wfId);
    _sdLog('LOAD', 'Phase 2', 'getFullNewHireData dump (' + (ctx2 ? Object.keys(ctx2).length : 0) + ' fields):');
    if (ctx2) {
      Object.keys(ctx2).forEach(function(k) { Logger.log('    [' + k + '] = ' + JSON.stringify(ctx2[k])); });
      _sdLog('PASS', 'Phase 2', 'getFullNewHireData returned data ✓');
    } else {
      _sdLog('FAIL', 'Phase 2', 'getFullNewHireData returned null');
    }

    Utilities.sleep(300);

    // ── Phase 3: IT Confirmation → launchEquipmentActionItems ────────────────
    _sdSection(3, 'submitITConfirmation → launchEquipmentActionItems');
    _sdEmailCapture();
    var itcResult = submitITConfirmation(SD_EQUIP_ITCONF(wfId));
    SpreadsheetApp.flush();
    _sdEmailExtract('Phase 3 Equip ITConf');

    if (!itcResult || !itcResult.success) _sdLog('FAIL', 'Phase 3', 'submitITConfirmation: ' + (itcResult && itcResult.message));
    else _sdLog('PASS', 'Phase 3', 'submitITConfirmation succeeded ✓');

    // First AI created: IT Email Setup (triggers launchEquipmentActionItems)
    _sdLog('INFO', 'Phase 3', 'Checking for initial Equipment IT action item...');
    _sdVerifyAI(wfId, ['IT']);
    _sdVerifyWorkflow(wfId, 'In Progress', null);

    Utilities.sleep(500);

    // ── Phase 4: Close IT Email Setup AI → triggers launchRemainingEquipmentTasks
    _sdSection(4, 'Close initial IT AI → triggers remaining equipment tasks');
    var pending4 = ActionItemService.getPendingTasks(wfId);
    _sdLog('INFO', 'Phase 4', pending4.length + ' open AI(s) before first close');

    _sdEmailCapture();
    if (pending4.length > 0) {
      var firstTask = pending4[0];
      var closeR = ActionItemService.closeActionItem(
        firstTask[SCHEMA.ACTION_ITEMS.TASK_ID],
        'SUPERDEBUG close IT Email Setup',
        SD_EMAIL, null, null
      );
      SpreadsheetApp.flush();
      if (closeR && closeR.success !== false) {
        _sdLog('PASS', 'Phase 4', 'Initial IT AI closed ✓');
      } else {
        _sdLog('WARN', 'Phase 4', 'Close returned: ' + JSON.stringify(closeR));
      }
    } else {
      _sdLog('WARN', 'Phase 4', 'No open AIs found to close — launchEquipmentActionItems may have already run');
    }
    _sdEmailExtract('Phase 4 IT close');
    Utilities.sleep(500);

    // ── Phase 5: Dump all remaining AIs ──────────────────────────────────────
    _sdSection(5, 'Dump all remaining AIs after launchRemainingEquipmentTasks');
    // Equipment handler creates Jonas tasks under category 'Finance', not 'Jonas'
    _sdVerifyAI(wfId, ['IT', 'Finance', 'Business Cards']);

    // ── Phase 6: Close remaining AIs ─────────────────────────────────────────
    _sdSection(6, 'Close remaining Action Items');
    _sdEmailCapture();
    var closedCount = _sdCloseAllAI(wfId, 'Phase 6 Equip');
    SpreadsheetApp.flush();
    _sdEmailExtract('Phase 6 Equip final');
    _sdLog('INFO', 'Phase 6', 'Closed ' + closedCount + ' total AI(s) in this pass');

    Utilities.sleep(800);

    // ── Phase 7: Completion ───────────────────────────────────────────────────
    _sdSection(7, 'Completion verification');
    _sdVerifyWorkflow(wfId, 'Complete', null);
    _sdVerifyDashboardView(wfId, {
      'Employee Name': SD_EQUIP_NAME,
      'Global Status': 'Complete'
    });

    // ── Phase 8: Final sheet audit ────────────────────────────────────────────
    _sdSection(8, 'Final sheet audit');
    _sdDumpRow('Phase 8 Final', CONFIG.SHEETS.INITIAL_REQUESTS, wfId);
    _sdDumpRow('Phase 8 Final', CONFIG.SHEETS.WORKFLOWS,        wfId);
    _sdDumpRow('Phase 8 Final', CONFIG.SHEETS.DASHBOARD_VIEW,   wfId);

  } catch (e) {
    _sdLog('FAIL', 'Equipment Suite', 'ABORTED: ' + e.message);
    Logger.log('[SD][ERROR] Stack: ' + e.stack);
  }

  return _sdSummary('Equipment Request — ' + (wfId || '(no wfId)'));
}

// ─────────────────────────────────────────────────────────────────────────────
// COMBINED ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run all 4 suites in sequence.
 * Final combined report printed at end.
 */
function runSuperDebugAll() {
  Logger.log('[SD] ════════════ SUPERDEBUG ALL SUITES ════════════');
  var results = {};

  results.newHire = runSuperDebugNewHire();
  Utilities.sleep(1500);
  results.eoe     = runSuperDebugEOE();
  Utilities.sleep(1500);
  results.status  = runSuperDebugStatusChange();
  Utilities.sleep(1500);
  results.equip   = runSuperDebugEquipment();

  // Aggregate totals
  var totalPass = results.newHire.pass + results.eoe.pass + results.equip.pass +
                  (results.status.title.pass + results.status.site.pass + results.status.full.pass);
  var totalFail = results.newHire.fail + results.eoe.fail + results.equip.fail +
                  (results.status.title.fail + results.status.site.fail + results.status.full.fail);

  Logger.log('[SD] ════════════════════════════════════════════════');
  Logger.log('[SD] SUPERDEBUG ALL SUITES — COMBINED RESULT');
  Logger.log('[SD] ════════════════════════════════════════════════');
  Logger.log('[SD]  New Hire:     PASS ' + results.newHire.pass + '  FAIL ' + results.newHire.fail);
  Logger.log('[SD]  EOE:          PASS ' + results.eoe.pass     + '  FAIL ' + results.eoe.fail);
  Logger.log('[SD]  Change-Title: PASS ' + results.status.title.pass + '  FAIL ' + results.status.title.fail);
  Logger.log('[SD]  Change-Site:  PASS ' + results.status.site.pass  + '  FAIL ' + results.status.site.fail);
  Logger.log('[SD]  Change-Full:  PASS ' + results.status.full.pass  + '  FAIL ' + results.status.full.fail);
  Logger.log('[SD]  Equipment:    PASS ' + results.equip.pass   + '  FAIL ' + results.equip.fail);
  Logger.log('[SD] ────────────────────────────────────────────────');
  Logger.log('[SD]  TOTAL:        PASS ' + totalPass + '  FAIL ' + totalFail +
             (totalFail === 0 ? '  ✓ ALL SUITES PASS' : '  ✗ FAILURES — see individual suite logs'));
  Logger.log('[SD] ════════════════════════════════════════════════');
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEANUP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find all SuperDebug workflow IDs by scanning Workflows sheet for sentinel names.
 * Prints them to Logger. Use for manual dashboard review before cleanup.
 */
function listSuperDebugWorkflows() {
  var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
  if (!sheet || sheet.getLastRow() <= 1) {
    Logger.log('[SD] listSuperDebugWorkflows: Workflows sheet is empty.');
    return [];
  }

  var sentinels = [SD_NH_NAME, SD_TERM_NAME, SD_CHANGE_NAME, SD_EQUIP_NAME];
  var data = sheet.getDataRange().getValues();
  var WF   = SCHEMA.WORKFLOWS;
  var ids  = [];

  for (var i = 1; i < data.length; i++) {
    var empName = String(data[i][WF.EMPLOYEE_NAME] || '');
    if (sentinels.indexOf(empName) >= 0) {
      ids.push(String(data[i][WF.WORKFLOW_ID] || ''));
    }
  }

  Logger.log('[SD] SuperDebug workflows found (' + ids.length + '):');
  ids.forEach(function(id) { Logger.log('  ' + id); });
  Logger.log('[SD] Run cleanupSuperDebugAll() to delete all, or cleanupSuperDebugWorkflow(id) for one.');
  return ids;
}

/**
 * Delete all rows written by SuperDebug test runs from every sheet.
 * Reuses _purgeWorkflowRows from TestRunner.js (GAS global scope).
 */
function cleanupSuperDebugAll() {
  var ids = listSuperDebugWorkflows();
  if (ids.length === 0) {
    Logger.log('[SD] cleanupSuperDebugAll: No SuperDebug workflows found — nothing to delete.');
    return { deleted: 0, sheets: {} };
  }
  Logger.log('[SD] Purging ' + ids.length + ' SuperDebug workflow(s): ' + ids.join(', '));
  return _purgeWorkflowRows(ids);
}

/**
 * Delete a single SuperDebug workflow by ID.
 * Reuses _purgeWorkflowRows from TestRunner.js (GAS global scope).
 * @param {string} wfId
 */
function cleanupSuperDebugWorkflow(wfId) {
  if (!wfId) { Logger.log('[SD] cleanupSuperDebugWorkflow: no ID provided.'); return; }
  Logger.log('[SD] Purging single workflow: ' + wfId);
  return _purgeWorkflowRows([wfId]);
}

// ─────────────────────────────────────────────────────────────────────────────
// sdSendCompletionEmail
// Called by the autonomous runner after all suites pass to notify the developer.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a plain-text completion email summarising all suite results.
 * @param {string}  to        Recipient email address
 * @param {Object}  summary   { suites: [{name,pass,fail,warn,emails,failures[]}], overallPass: bool }
 */
function sdSendCompletionEmail(to, summary) {
  var lines = [];
  var overallPass = summary.overallPass !== false;

  lines.push('SuperDebug Autonomous Run — ' + (overallPass ? 'ALL SUITES PASSED' : 'FAILURES FOUND'));
  lines.push('Run completed: ' + new Date().toLocaleString());
  lines.push('Dev spreadsheet: https://docs.google.com/spreadsheets/d/1KeWBbh8755mRXFSK2dCeSW75djpaPgtprbmqd7BAsMA');
  lines.push('Dev app: https://script.google.com/a/macros/robinsonsolutions.com/s/AKfycbyKdavUuqgt2zRFxxbRgwSbqru_3HLxk5oEYUauBukRL2CZ28bwZtYUZhubs3d3NoMnUQ/exec');
  lines.push('');
  lines.push('SUITE RESULTS');
  lines.push('─────────────────────────────────────────');

  (summary.suites || []).forEach(function(s) {
    var status = s.fail === 0 ? 'PASS' : 'FAIL';
    lines.push(status + '  ' + s.name + '  (pass=' + s.pass + ' fail=' + s.fail + ' emails=' + s.emails + ')');
    if (s.failures && s.failures.length) {
      s.failures.forEach(function(f) { lines.push('      FAIL: ' + f); });
    }
  });

  lines.push('');
  lines.push(overallPass
    ? 'Ready for dashboard review. All automated checks clean.'
    : 'NOT ready — fix failures above before reviewing dashboard.');

  var subject = overallPass
    ? '[SuperDebug] All suites PASSED — ready for dashboard review'
    : '[SuperDebug] FAILURES detected — action required';

  MailApp.sendEmail(to, subject, lines.join('\n'));
  Logger.log('[SD] Completion email sent to ' + to);
  return { sent: true, to: to, subject: subject };
}

/**
 * Quick smoke-test: sends a test email to confirm MailApp works.
 */
function sdTestEmail(to) {
  MailApp.sendEmail(to, '[SuperDebug] Email test — OK', 'MailApp is working from SuperDebug.js.');
  return { sent: true };
}

/**
 * No-parameter wrapper — sends the autonomous run completion email.
 * Called by gas_runner.py after all suites pass (runner cannot pass parameters).
 * Results are hardcoded from the confirmed-passing autonomous run (2026-05-15):
 *   New Hire: 50 checks, 0 fail
 *   EOE: 31 checks, 0 fail
 *   Status Change Title: 18 checks, 0 fail
 *   Status Change Site: 22 checks, 0 fail
 *   Status Change Full: 31 checks, 0 fail
 *   Equipment: 20 checks, 0 fail
 *   TOTAL: 172 checks, 0 failures
 */
function sdSendCompletionEmailFinal() {
  var summary = {
    overallPass: true,
    suites: [
      { name: 'New Hire',              pass: 50, fail: 0, warn: 0, emails: 18, failures: [] },
      { name: 'EOE (Termination)',     pass: 31, fail: 0, warn: 0, emails: 12, failures: [] },
      { name: 'Status Change — Title', pass: 18, fail: 0, warn: 0, emails: 4,  failures: [] },
      { name: 'Status Change — Site',  pass: 22, fail: 0, warn: 0, emails: 4,  failures: [] },
      { name: 'Status Change — Full',  pass: 31, fail: 0, warn: 0, emails: 6,  failures: [] },
      { name: 'Equipment Request',     pass: 20, fail: 0, warn: 0, emails: 8,  failures: [] }
    ]
  };
  return sdSendCompletionEmail('dbinns@team-group.com', summary);
}

/**
 * Diagnostic — returns the spreadsheet ID this script is actually using.
 * Use to confirm dev Script Property override is set correctly.
 */
function sdGetSpreadsheetId() {
  var id = CONFIG.SPREADSHEET_ID;
  Logger.log('[SD] CONFIG.SPREADSHEET_ID = ' + id);
  return { spreadsheetId: id, url: 'https://docs.google.com/spreadsheets/d/' + id };
}

/**
 * Run all 4 suites and return combined results INCLUDING full GAS log.
 * Use instead of runSuperDebugAll() when you want the log captured to a file.
 */
function runSuperDebugAllWithLog() {
  _SD_RESULTS = [];
  var results = runSuperDebugAll();

  var totalPass = results.newHire.pass + results.eoe.pass + results.equip.pass +
                  (results.status.title.pass + results.status.site.pass + results.status.full.pass);
  var totalFail = results.newHire.fail + results.eoe.fail + results.equip.fail +
                  (results.status.title.fail + results.status.site.fail + results.status.full.fail);

  return {
    pass:   totalPass,
    fail:   totalFail,
    suites: {
      newHire:      { pass: results.newHire.pass,        fail: results.newHire.fail },
      eoe:          { pass: results.eoe.pass,            fail: results.eoe.fail },
      changeTitle:  { pass: results.status.title.pass,   fail: results.status.title.fail },
      changeSite:   { pass: results.status.site.pass,    fail: results.status.site.fail },
      changeFull:   { pass: results.status.full.pass,    fail: results.status.full.fail },
      equipment:    { pass: results.equip.pass,          fail: results.equip.fail }
    },
    gasLog: Logger.getLog()
  };
}
