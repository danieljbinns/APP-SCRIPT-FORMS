/**
 * MigrateColumns.js
 *
 * Adds missing columns to existing sheets WITHOUT touching existing data.
 * Only appends columns that are absent from the current header row.
 * Does NOT reorder, delete, or overwrite anything.
 *
 * HOW TO USE:
 *   1. Run previewMissingColumns() first — check the execution log.
 *   2. If the preview looks correct, run addMissingColumns() to apply.
 */

// ---------------------------------------------------------------------------
// Expected schema per sheet — sourced from Setup.js
// ---------------------------------------------------------------------------
var EXPECTED_SCHEMA = {
  'Workflows': [
    'Workflow ID', 'Workflow Type', 'Workflow Name', 'Initiator Email',
    'Status', 'Created Date', 'Last Updated', 'Current Step', 'Employee Name'
  ],
  'Dashboard_View': [
    'Workflow ID', 'Employee Name', 'Global Status', 'Granular Step Details',
    'Requester Name', 'Requester Email', 'Initiator Email', 'Date Requested',
    'Last Updated', 'Manager Email', 'Requested Items JSON', 'Hire Date',
    'Site', 'Employment Type'
  ],
  'Initial Requests': [
    'Workflow ID', 'Form ID', 'Timestamp', 'Date Requested', 'Requester Name', 'Requester Email',
    'Hire Date', 'New Hire/Rehire', 'Employee Type', 'Employment Type',
    'First Name', 'Middle Name', 'Last Name', 'Preferred Name', 'Position Title',
    'Site Name', 'Job Site #', 'Manager Email', 'Manager Name',
    'System Access', 'Systems', 'Equipment', 'Google Email', 'Google Domain',
    'Computer Req', 'Computer Type', 'Prev User', 'Prev Type', 'Serial #',
    'Office 365', 'CC USA', 'Limit USA', 'CC CAN', 'Limit CAN', 'CC HD', 'Limit HD',
    'Phone Req', 'Prev User', 'Prev Number', 'BOSS Sites', 'BOSS Cost Sheet',
    'BOSS Jobs', 'BOSS Trip', 'BOSS Grievances', 'Jonas Job #s', 'JR Req', 'JR Assign',
    '30/60/90', 'Comments', 'ADP Sites', 'Department', 'Purchasing Sites', 'Status'
  ],
  'ID Setup Results': [
    'Workflow ID', 'Form ID', 'Submission Timestamp', 'Internal Employee ID',
    'SiteDocs Worker ID', 'SiteDocs Job Code', 'SiteDocs Username',
    'SiteDocs Password', 'DSS Username', 'DSS Password',
    'Setup Notes', 'BOSS WIS Created', 'Submitted By'
  ],
  'HR Verification Results': [
    'Workflow ID', 'Form ID', 'Submission Timestamp', 'ADP Associate ID',
    'Verified Name', 'Verified Manager', 'Verified Manager Email',
    'Verified JR Title', 'Notes', 'Submitted By'
  ],
  'IT Results': [
    'Workflow ID', 'Form ID', 'Submission Timestamp', 'Email Created', 'Assigned Email', 'Email Password',
    'Computer Assigned', 'Computer Make', 'Computer Model', 'Computer Type',
    'Phone Assigned', 'Phone Carrier', 'Phone Model', 'Phone Number', 'Phone VM Password',
    'BOSS Access', 'Incidents Access', 'CAA Access', 'Delivery App Access', 'Net Promoter Access',
    'IT Notes', 'Submitted By'
  ],
  // Specialist result sheets removed — specialist steps now use Action Items.
  'Terminations': [
    'Workflow ID', 'Form ID', 'Timestamp', 'Requester Name', 'Requester Email',
    'Employee Name', 'Employee ID', 'Employee Type', 'Work Email', 'Phone', 'Computer Serial',
    'Site', 'Term Date', 'Reason', 'Manager Name', 'Manager Email', 'HR Approved Status',
    'Has Reports', 'Reassign Reports To', 'Systems to Deactivate', 'Email Forwarding',
    'Drive Files Transfer', 'Inbox Delegate', 'Account Duration', 'Vacation Responder Auto Reply',
    'Equipment to Return', 'Comments', 'Last Day Worked'
  ],
  'Position Changes': [
    'Workflow ID', 'Form ID', 'Timestamp', 'Requester Name', 'Requester Email',
    'Employee Name', 'Employee ID', 'Effective Date', 'Current Site', 'Change Types',
    'Site Transfer (Old -> New)', 'Title Change (Old -> New)', 'Classification (Old -> New)',
    'Manager Change (Old -> New Email)', 'Reassign Old Reports', 'Gain New Reports',
    'Google Account', 'Systems Added', 'Equipment', 'Removed Access', 'Comments', 'Department'
  ],
  'Equipment_Requests': [
    'Timestamp', 'Workflow ID', 'Form ID', 'Requester Name', 'Requester Email',
    'Employee First Name', 'Employee Last Name', 'Site Name', 'Job Title', 'Manager Name', 'Manager Email',
    'Equipment Requested', 'Systems Requested', 'Comments'
  ],
  'Termination Approval Results': [
    'Workflow ID', 'Form ID', 'Timestamp', 'Decision', 'Notes', 'Follow-up Required', 'Submitted By'
  ],
  'Position Change Approval Results': [
    'Workflow ID', 'Form ID', 'Timestamp', 'Decision', 'Notes', 'Follow-up Required', 'Submitted By'
  ],
  // Asset Collection Results sheet removed — asset collection now uses Action Items.
  'Action Items': [
    'Workflow ID', 'Task ID', 'Category', 'Task Name', 'Description', 'Assigned To',
    'Status', 'Created Date', 'Completed Date', 'Notes', 'Closed By', 'Draft',
    'Form Type', 'Form Data'
  ]
};

// ---------------------------------------------------------------------------
// Preview — run this first, check the log, then run addMissingColumns()
// ---------------------------------------------------------------------------
function previewMissingColumns() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var report = _buildReport(ss);

  Logger.log('========== PREVIEW: Missing Columns ==========');
  var anyMissing = false;
  for (var sheetName in report) {
    var missing = report[sheetName].missing;
    var present = report[sheetName].present;
    if (missing.length > 0) {
      anyMissing = true;
      Logger.log('\n[' + sheetName + ']');
      Logger.log('  Existing cols (' + present + ' total): ' + report[sheetName].existing.join(', '));
      Logger.log('  WILL ADD (' + missing.length + '): ' + missing.join(', '));
    } else {
      Logger.log('\n[' + sheetName + '] — OK, no missing columns');
    }
  }
  if (!anyMissing) {
    Logger.log('\nAll sheets are up to date. Nothing to add.');
  } else {
    Logger.log('\nRun addMissingColumns() to apply these changes.');
  }
}

// ---------------------------------------------------------------------------
// Apply — appends missing columns to each sheet
// ---------------------------------------------------------------------------
function addMissingColumns() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var report = _buildReport(ss);

  Logger.log('========== APPLYING: Add Missing Columns ==========');
  var totalAdded = 0;

  for (var sheetName in report) {
    var missing = report[sheetName].missing;
    if (missing.length === 0) {
      Logger.log('[' + sheetName + '] — skipped, already up to date');
      continue;
    }

    var sheet = ss.getSheetByName(sheetName);
    var lastCol = sheet.getLastColumn();

    for (var i = 0; i < missing.length; i++) {
      var newCol = lastCol + 1 + i;
      var cell = sheet.getRange(1, newCol);
      cell.setValue(missing[i]);
      cell.setFontWeight('bold')
          .setBackground('#EB1C2D')
          .setFontColor('#ffffff');
    }

    Logger.log('[' + sheetName + '] — added ' + missing.length + ' column(s): ' + missing.join(', '));
    totalAdded += missing.length;
  }

  Logger.log('\nDone. ' + totalAdded + ' column(s) added across all sheets.');
}

// ---------------------------------------------------------------------------
// Internal: build a report of missing vs existing columns per sheet
// ---------------------------------------------------------------------------
function _buildReport(ss) {
  var report = {};

  for (var sheetName in EXPECTED_SCHEMA) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log('WARNING: Sheet not found — ' + sheetName + ' (run initializeSystem() to create it)');
      continue;
    }

    var lastCol = sheet.getLastColumn();
    var existingHeaders = lastCol > 0
      ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h).trim(); })
      : [];

    var expected = EXPECTED_SCHEMA[sheetName];
    var missing = expected.filter(function(h) {
      return existingHeaders.indexOf(h) === -1;
    });

    report[sheetName] = {
      existing: existingHeaders,
      present: existingHeaders.length,
      missing: missing
    };
  }

  return report;
}
