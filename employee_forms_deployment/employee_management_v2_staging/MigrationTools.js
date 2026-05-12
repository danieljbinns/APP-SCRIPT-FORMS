/**
 * MigrationTools.js
 * One-off migration helpers. Run manually from the Apps Script editor.
 * DEV ONLY — do not push to staging or prod.
 *
 * Functions:
 *   wipeDevSheets()   — clears all data rows on every sheet, preserves headers + data validation
 *   migrateFromProd() — copies prod data into dev (run after wipeDevSheets)
 */

// ── Sheet names to wipe (all dev sheets) ────────────────────────────────────
var SHEETS_TO_WIPE = [
  'Workflows',
  'Initial Requests',
  'ID Setup Results',
  'HR Verification Results',
  'IT Results',
  'Action Items',
  'Dashboard_View',
  'Terminations',
  'Position Changes',
  'Equipment_Requests',
  'IT Confirmation Results',
  'Termination Approval Results',
  'Position Change Approval Result'
  // Data_Lookup intentionally excluded — reference data, not migrated
];

/**
 * Wipes all data rows (row 2 onwards) from every sheet listed above.
 * Preserves: row 1 headers, data validation rules, cell formatting.
 * Safe to run multiple times.
 */
function wipeDevSheets() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var results = [];

  SHEETS_TO_WIPE.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      results.push('  [SKIP] ' + name + ' — sheet not found');
      return;
    }
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      results.push('  [EMPTY] ' + name + ' — nothing to clear');
      return;
    }
    // clearContent() clears values only — leaves data validation and formatting intact
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
    results.push('  [OK] ' + name + ' — cleared ' + (lastRow - 1) + ' rows');
  });

  Logger.log('=== wipeDevSheets complete ===');
  results.forEach(function(r) { Logger.log(r); });
}

// ── Prod spreadsheet ID ──────────────────────────────────────────────────────
var PROD_SPREADSHEET_ID = '1kGjw8e-uIehaBemlsRZ4Yq1QrYOWkJvWzhKbgfl4Pxo';

/**
 * Copies the 4 directly-mapped sheets from prod into dev.
 * Run AFTER wipeDevSheets() so dev data rows are already clear.
 *
 * Sheets copied (prod → dev, column-for-column):
 *   Workflows               — 9 cols, direct copy
 *   HR Verification Results — 10 cols, direct copy
 *   IT Results              — 22 cols, direct copy
 *   ID Setup Results        — 12 prod cols → dev cols 1-12; dev col 13 (BOSS WIS Created) left blank
 *
 * Does NOT touch: Initial Requests, Action Items, Dashboard_View, or any
 * new-workflow sheets (Terminations, Position Changes, etc.).
 */
function migrateFromProd() {
  var prod = SpreadsheetApp.openById(PROD_SPREADSHEET_ID);
  var dev  = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var results = [];

  // ── 1. Workflows ────────────────────────────────────────────────────────────
  results.push(_copySheet(prod, dev, 'Workflows'));

  // ── 2. HR Verification Results ──────────────────────────────────────────────
  results.push(_copySheet(prod, dev, 'HR Verification Results'));

  // ── 3. IT Results ───────────────────────────────────────────────────────────
  results.push(_copySheet(prod, dev, 'IT Results'));

  // ── 4. ID Setup Results — dev has extra col 13 (BOSS WIS Created) ───────────
  results.push(_copySheetWithExtraCols(prod, dev, 'ID Setup Results', 1));

  Logger.log('=== migrateFromProd complete ===');
  results.forEach(function(r) { Logger.log(r); });
}

/**
 * Copies all data rows from a prod sheet into the matching dev sheet.
 * Skips the prod header row (dev header already exists).
 * @param {Spreadsheet} prod
 * @param {Spreadsheet} dev
 * @param {string} sheetName
 * @returns {string} log line
 */
function _copySheet(prod, dev, sheetName) {
  var src = prod.getSheetByName(sheetName);
  var dst = dev.getSheetByName(sheetName);

  if (!src) return '  [SKIP] ' + sheetName + ' — not found in prod';
  if (!dst) return '  [SKIP] ' + sheetName + ' — not found in dev';

  var srcLastRow = src.getLastRow();
  if (srcLastRow <= 1) return '  [EMPTY] ' + sheetName + ' — no data rows in prod';

  var dataRows = src.getRange(2, 1, srcLastRow - 1, src.getLastColumn()).getDisplayValues();
  dst.getRange(2, 1, dataRows.length, dataRows[0].length).setValues(dataRows);

  return '  [OK] ' + sheetName + ' — copied ' + dataRows.length + ' rows';
}

/**
 * Copies prod sheet data into dev, padding each row with empty strings
 * for any extra columns dev has beyond prod (e.g. BOSS WIS Created).
 * @param {Spreadsheet} prod
 * @param {Spreadsheet} dev
 * @param {string} sheetName
 * @param {number} extraCols  number of blank columns to append to each row
 * @returns {string} log line
 */
function _copySheetWithExtraCols(prod, dev, sheetName, extraCols) {
  var src = prod.getSheetByName(sheetName);
  var dst = dev.getSheetByName(sheetName);

  if (!src) return '  [SKIP] ' + sheetName + ' — not found in prod';
  if (!dst) return '  [SKIP] ' + sheetName + ' — not found in dev';

  var srcLastRow = src.getLastRow();
  if (srcLastRow <= 1) return '  [EMPTY] ' + sheetName + ' — no data rows in prod';

  var dataRows = src.getRange(2, 1, srcLastRow - 1, src.getLastColumn()).getDisplayValues();

  // Pad each row with empty strings for the extra dev-only columns
  var padding = [];
  for (var i = 0; i < extraCols; i++) padding.push('');
  dataRows = dataRows.map(function(row) { return row.concat(padding); });

  var totalCols = dataRows[0].length;
  dst.getRange(2, 1, dataRows.length, totalCols).setValues(dataRows);

  return '  [OK] ' + sheetName + ' — copied ' + dataRows.length + ' rows (' + extraCols + ' blank col(s) appended)';
}

/**
 * Migrates Initial Requests from prod into dev with column remapping.
 *
 * Prod has 50 cols. Dev has 54 cols. Mapping:
 *   Prod cols 1-49  → Dev cols 1-49   (direct)
 *   Dev  cols 50-52 → blank           (ADP Sites, Department, Purchasing Sites — new in dev)
 *   Prod col  50    → Dev col 53      (Status)
 *   Dev  col  54    → blank           (ADP Salary Access — new in dev)
 *
 * Run AFTER wipeDevSheets().
 */
function migrateInitialRequests() {
  var prod = SpreadsheetApp.openById(PROD_SPREADSHEET_ID);
  var dev  = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  var src = prod.getSheetByName('Initial Requests');
  var dst = dev.getSheetByName('Initial Requests');

  if (!src) { Logger.log('[SKIP] Initial Requests — not found in prod'); return; }
  if (!dst) { Logger.log('[SKIP] Initial Requests — not found in dev');  return; }

  var srcLastRow = src.getLastRow();
  if (srcLastRow <= 1) { Logger.log('[EMPTY] Initial Requests — no data rows in prod'); return; }

  var prodRows = src.getRange(2, 1, srcLastRow - 1, 50).getDisplayValues();

  var devRows = prodRows.map(function(row) {
    return [].concat(
      row.slice(0, 49),  // dev cols 1-49  = prod cols 1-49
      ['', '', ''],      // dev cols 50-52 = blank (ADP Sites, Department, Purchasing Sites)
      [row[49]],         // dev col 53     = prod col 50 (Status)
      ['']               // dev col 54     = blank (ADP Salary Access)
    );
  });

  // Dev has 54 cols
  dst.getRange(2, 1, devRows.length, 54).setValues(devRows);

  Logger.log('=== migrateInitialRequests complete ===');
  Logger.log('  [OK] Initial Requests — copied ' + devRows.length + ' rows (cols remapped)');
}

// ── Legacy specialist sheet → Action Items mapping ───────────────────────────
var LEGACY_SHEET_MAP = [
  { sheet: 'Business Cards Results',  cat: 'Business Cards',    formType: 'businesscards', taskName: 'Business Cards Order',            assignedTo: 'davelangohr@team-group.com' },
  { sheet: 'SiteDocs Results',        cat: 'SiteDocs',          formType: 'sitedocs',      taskName: 'SiteDocs / DSS ID Setup',         assignedTo: 'grp.forms.idsetup@team-group.com' },
  { sheet: '30-60-90 Review Results', cat: '30-60-90 Review',   formType: '30_60_90',      taskName: '30-60-90 Review',                 assignedTo: 'grp.forms.review306090@team-group.com' },
  { sheet: 'Credit Card Results',     cat: 'Credit Card',       formType: 'creditcard',    taskName: 'Credit Card Setup',               assignedTo: 'grp.forms.jonas@team-group.com' },
  { sheet: 'Fleetio Results',         cat: 'Fleetio',           formType: 'fleetio',       taskName: 'Fleetio Setup',                   assignedTo: 'grp.forms.fleetio@team-group.com' },
  { sheet: 'JONAS Results',           cat: 'Jonas',             formType: 'jonas',         taskName: 'Jonas / Central Purchasing Setup', assignedTo: 'grp.forms.jonas@team-group.com' }
];

/**
 * Migrates all 6 legacy specialist sheets from prod into dev Action Items.
 * Each prod row becomes one Action Item row with Status = Closed.
 *
 * Source columns (all 6 sheets are identical):
 *   0: Workflow ID
 *   1: Form ID
 *   2: Submission Timestamp  — string, used for Created Date + Completed Date
 *   3: Details               — JSON blob, stored in Form Data
 *   4: Notes
 *   5: Submitted By          — stored as Closed By
 *
 * Run AFTER wipeDevSheets().
 */
function migrateActionItems() {
  var prod = SpreadsheetApp.openById(PROD_SPREADSHEET_ID);
  var dev  = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var dst  = dev.getSheetByName('Action Items');

  if (!dst) { Logger.log('[SKIP] Action Items sheet not found in dev'); return; }

  var allRows = [];

  LEGACY_SHEET_MAP.forEach(function(m) {
    var src = prod.getSheetByName(m.sheet);
    if (!src) { Logger.log('  [SKIP] ' + m.sheet + ' — not found in prod'); return; }

    var lastRow = src.getLastRow();
    if (lastRow <= 1) { Logger.log('  [EMPTY] ' + m.sheet + ' — no data rows'); return; }

    var rows = src.getRange(2, 1, lastRow - 1, 6).getDisplayValues();

    rows.forEach(function(row) {
      var wfId      = row[0];
      if (!wfId) return;

      var formId    = row[1];
      var timestamp = row[2];  // already a string e.g. "2026-03-30 12:13:53"
      var details   = row[3];
      var notes     = row[4];
      var subBy     = row[5];

      var taskId    = 'TK-' + Utilities.getUuid().replace(/-/g, '').substring(0, 8).toUpperCase();

      var formData  = JSON.stringify({
        formId:        formId,
        details:       details,
        notes:         notes,
        submittedBy:   subBy,
        migratedFrom:  m.sheet
      });

      allRows.push([
        wfId,                                                    // Workflow ID
        taskId,                                                  // Task ID
        m.cat,                                                   // Category
        m.taskName,                                              // Task Name
        JSON.stringify(['Migrated from legacy ' + m.sheet]),     // Description
        m.assignedTo,                                            // Assigned To
        'Closed',                                                // Status
        timestamp,                                               // Created Date
        timestamp,                                               // Completed Date
        notes,                                                   // Notes
        subBy,                                                   // Closed By
        '',                                                      // Draft
        m.formType,                                              // Form Type
        formData                                                 // Form Data
      ]);
    });

    Logger.log('  [OK] ' + m.sheet + ' — ' + (lastRow - 1) + ' rows staged');
  });

  if (allRows.length === 0) {
    Logger.log('=== migrateActionItems complete — no rows to write ===');
    return;
  }

  dst.getRange(2, 1, allRows.length, 14).setValues(allRows);
  Logger.log('=== migrateActionItems complete — ' + allRows.length + ' total Action Items written ===');
}

/**
 * Builds Dashboard_View from the already-migrated dev Workflows + Initial Requests.
 * Run LAST — after migrateFromProd, migrateInitialRequests, and migrateActionItems.
 *
 * Dev Workflows columns (0-based):
 *   0: Workflow ID  1: Workflow Type  2: Workflow Name  3: Initiator Email
 *   4: Status       5: Created Date   6: Last Updated   7: Current Step  8: Employee Name
 *
 * Dev Initial Requests columns (0-based, key ones):
 *   0: Workflow ID   3: Date Requested   4: Requester Name   5: Requester Email
 *   6: Hire Date     9: Employment Type  15: Site Name       17: Manager Email
 *   20: Systems      21: Equipment       30: CC USA          32: CC CAN
 *   34: CC HD        44: Jonas Job #s    47: 30/60/90
 *
 * Dashboard_View columns (0-based):
 *   0: Workflow ID      1: Employee Name       2: Global Status     3: Granular Step Details
 *   4: Requester Name   5: Requester Email     6: Initiator Email   7: Date Requested
 *   8: Last Updated     9: Manager Email       10: Requested Items JSON
 *   11: Hire Date       12: Site               13: Employment Type
 */
function buildDashboardView() {
  var dev = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  var wfSheet  = dev.getSheetByName('Workflows');
  var irSheet  = dev.getSheetByName('Initial Requests');
  var dvSheet  = dev.getSheetByName('Dashboard_View');

  if (!wfSheet)  { Logger.log('[SKIP] Workflows sheet not found');        return; }
  if (!irSheet)  { Logger.log('[SKIP] Initial Requests sheet not found'); return; }
  if (!dvSheet)  { Logger.log('[SKIP] Dashboard_View sheet not found');   return; }

  // ── Build Initial Requests index keyed by Workflow ID ─────────────────────
  var irIndex = {};
  var irLastRow = irSheet.getLastRow();
  if (irLastRow > 1) {
    var irData = irSheet.getRange(2, 1, irLastRow - 1, 50).getDisplayValues();
    irData.forEach(function(row) {
      var wid = row[0];
      if (wid) irIndex[wid] = row;
    });
  }

  // ── Read Workflows and build one DV row per workflow ──────────────────────
  var wfLastRow = wfSheet.getLastRow();
  if (wfLastRow <= 1) { Logger.log('[EMPTY] No workflows to build dashboard from'); return; }

  var wfData  = wfSheet.getRange(2, 1, wfLastRow - 1, 9).getDisplayValues();
  var dvRows  = [];

  wfData.forEach(function(wf) {
    var wid       = wf[0];
    if (!wid) return;

    var status    = wf[4];
    var lastUpd   = wf[6];
    var step      = wf[7];
    var empName   = wf[8];
    var initEmail = wf[3];

    var reqName  = '', reqEmail = '', mgrEmail = '';
    var dateReq  = '', hireDate = '', site = '', empType = '';
    var itemsJson = '{}';

    var ir = irIndex[wid];
    if (ir) {
      reqName  = ir[4];
      reqEmail = ir[5];
      hireDate = ir[6];
      empType  = ir[9];
      site     = ir[15];
      mgrEmail = ir[17];
      dateReq  = ir[3];

      var jonas       = ir[44].trim().length > 0;
      var creditCard  = ir[30] === 'Yes' || ir[32] === 'Yes' || ir[34] === 'Yes';
      var fleetio     = ir[20].indexOf('Fleetio') !== -1;
      var bizCards    = ir[21].indexOf('Business Cards') !== -1;
      var siteDocs    = ir[20].indexOf('SiteDocs') !== -1 || ir[21].indexOf('SiteDocs Tablet') !== -1;
      var review      = ir[47] === 'Yes';

      itemsJson = JSON.stringify({
        jonas:         jonas,
        creditCard:    creditCard,
        fleetio:       fleetio,
        businessCards: bizCards,
        siteDocs:      siteDocs,
        review:        review,
        safety:        true
      });
    }

    dvRows.push([
      wid,        // Workflow ID
      empName,    // Employee Name
      status,     // Global Status
      step,       // Granular Step Details
      reqName,    // Requester Name
      reqEmail,   // Requester Email
      initEmail,  // Initiator Email
      dateReq,    // Date Requested
      lastUpd,    // Last Updated
      mgrEmail,   // Manager Email
      itemsJson,  // Requested Items JSON
      hireDate,   // Hire Date
      site,       // Site
      empType     // Employment Type
    ]);
  });

  if (dvRows.length === 0) { Logger.log('[EMPTY] No rows built for Dashboard_View'); return; }

  // Clear existing DV data rows first
  var dvLastRow = dvSheet.getLastRow();
  if (dvLastRow > 1) dvSheet.getRange(2, 1, dvLastRow - 1, 14).clearContent();

  dvSheet.getRange(2, 1, dvRows.length, 14).setValues(dvRows);
  Logger.log('=== buildDashboardView complete — ' + dvRows.length + ' rows written ===');
}
