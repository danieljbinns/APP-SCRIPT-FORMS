/**
 * FORM_HR - Setup Functions
 * Run this to create the spreadsheet in shared drive
 */

function runSetup() {
  Logger.log('Starting FORM_HR Setup...');

  const spreadsheetId = createSpreadsheet();

  Logger.log('='.repeat(60));
  Logger.log('SETUP COMPLETE!');
  Logger.log('='.repeat(60));
  Logger.log('');
  Logger.log('NEXT STEPS:');
  Logger.log('1. Update Config.gs with:');
  Logger.log('');
  Logger.log('   SPREADSHEET_ID: \'' + spreadsheetId + '\',');
  Logger.log('');
  Logger.log('2. Run: clasp push');
  Logger.log('3. Deploy as web app');
  Logger.log('='.repeat(60));

  return { spreadsheetId: spreadsheetId };
}

function createSpreadsheet() {
  Logger.log('Creating spreadsheet in shared drive...');

  const ss = SpreadsheetApp.create(CONFIG.FORM_NAME + ' - Data');
  const spreadsheetId = ss.getId();

  // Move to shared drive
  const file = DriveApp.getFileById(spreadsheetId);
  const sharedDrive = DriveApp.getFolderById(CONFIG.SHARED_DRIVE_ID);
  file.moveTo(sharedDrive);

  // Setup sheet
  const sheet = ss.getSheets()[0];
  sheet.setName(CONFIG.SHEET_NAME);

  // Add headers
  sheet.getRange(1, 1, 1, CONFIG.FORM_FIELDS.length)
    .setValues([CONFIG.FORM_FIELDS])
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff');

  // Freeze header row
  sheet.setFrozenRows(1);

  // Auto-resize columns
  for (let i = 1; i <= CONFIG.FORM_FIELDS.length; i++) {
    sheet.autoResizeColumn(i);
  }

  // Share with group
  DriveApp.getFileById(spreadsheetId).addEditor(CONFIG.GROUP_EMAIL);

  Logger.log('✓ Spreadsheet created: ' + ss.getUrl());
  Logger.log('✓ Spreadsheet ID: ' + spreadsheetId);
  Logger.log('✓ Shared with: ' + CONFIG.GROUP_EMAIL);

  return spreadsheetId;
}
