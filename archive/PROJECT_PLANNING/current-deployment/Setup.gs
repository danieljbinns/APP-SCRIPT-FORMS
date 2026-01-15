/**
 * REQUEST_FORMS - Setup Functions
 * Run these functions once to create Google resources IN SHARED DRIVE
 */

/**
 * Main setup function - Creates spreadsheet and folder in shared drive
 * Run this first, then update Config.gs with the generated IDs
 */
function runSetup() {
  Logger.log('Starting REQUEST_FORMS Setup...');

  const spreadsheetId = createSpreadsheetInSharedDrive();
  const folderId = createFolderInSharedDrive();

  Logger.log('='.repeat(60));
  Logger.log('SETUP COMPLETE!');
  Logger.log('='.repeat(60));
  Logger.log('');
  Logger.log('NEXT STEPS:');
  Logger.log('1. Update Config.gs with these values:');
  Logger.log('');
  Logger.log('   SPREADSHEET_ID: \'' + spreadsheetId + '\',');
  Logger.log('   MAIN_FOLDER_ID: \'' + folderId + '\',');
  Logger.log('');
  Logger.log('2. Run: clasp push');
  Logger.log('3. Deploy as web app');
  Logger.log('='.repeat(60));

  return {
    spreadsheetId: spreadsheetId,
    folderId: folderId
  };
}

/**
 * Creates spreadsheet directly in shared drive
 * @returns {string} Spreadsheet ID
 */
function createSpreadsheetInSharedDrive() {
  Logger.log('Creating spreadsheet in shared drive...');

  // Create new spreadsheet
  const ss = SpreadsheetApp.create('REQUEST_FORMS - Employee Requests');
  const spreadsheetId = ss.getId();
  
  // Move to shared drive
  const file = DriveApp.getFileById(spreadsheetId);
  const sharedDrive = DriveApp.getFolderById(CONFIG.SHARED_DRIVE_ID);
  file.moveTo(sharedDrive);

  // Get the sheet and rename it
  const sheet = ss.getSheets()[0];
  sheet.setName(CONFIG.SHEET_NAME);

  // Add headers from CONFIG
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

  Logger.log('✓ Spreadsheet created in shared drive: ' + ss.getUrl());
  Logger.log('✓ Spreadsheet ID: ' + spreadsheetId);

  return spreadsheetId;
}

/**
 * Creates folder directly in shared drive
 * @returns {string} Folder ID
 */
function createFolderInSharedDrive() {
  Logger.log('Creating folder in shared drive...');

  const sharedDrive = DriveApp.getFolderById(CONFIG.SHARED_DRIVE_ID);
  const folder = sharedDrive.createFolder('REQUEST_FORMS');
  const folderId = folder.getId();

  Logger.log('✓ Folder created in shared drive: ' + folder.getUrl());
  Logger.log('✓ Folder ID: ' + folderId);

  return folderId;
}

/**
 * LEGACY: Creates spreadsheet in personal drive (kept for reference)
 * @returns {string} Spreadsheet ID
 */
function createSpreadsheet() {
  Logger.log('Creating spreadsheet...');

  // Create new spreadsheet
  const ss = SpreadsheetApp.create('REQUEST_FORMS - Employee Requests');
  const spreadsheetId = ss.getId();

  // Get the default sheet and rename it
  const sheet = ss.getSheets()[0];
  sheet.setName(CONFIG.SHEET_NAME);

  // Add headers from CONFIG
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

  Logger.log('✓ Spreadsheet created: ' + ss.getUrl());
  Logger.log('✓ Spreadsheet ID: ' + spreadsheetId);

  return spreadsheetId;
}

/**
 * LEGACY: Creates folder in personal drive (kept for reference)
 * @returns {string} Folder ID
 */
function createMainFolder() {
  Logger.log('Creating Drive folder...');

  const folder = DriveApp.createFolder('REQUEST_FORMS - Workflow System');
  const folderId = folder.getId();

  Logger.log('✓ Folder created: ' + folder.getUrl());
  Logger.log('✓ Folder ID: ' + folderId);

  return folderId;
}

/**
 * Test that Config values are set correctly
 * Run this after updating Config.gs with IDs
 */
function testConfig() {
  Logger.log('Testing configuration...');

  // Check spreadsheet
  if (!CONFIG.SPREADSHEET_ID) {
    Logger.log('❌ SPREADSHEET_ID not set in Config.gs');
    return false;
  }

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    Logger.log('✓ Spreadsheet accessible: ' + ss.getName());
    Logger.log('✓ Sheet found: ' + sheet.getName());
  } catch (e) {
    Logger.log('❌ Cannot access spreadsheet: ' + e.message);
    return false;
  }

  // Check folder
  if (!CONFIG.MAIN_FOLDER_ID) {
    Logger.log('❌ MAIN_FOLDER_ID not set in Config.gs');
    return false;
  }

  try {
    const folder = DriveApp.getFolderById(CONFIG.MAIN_FOLDER_ID);
    Logger.log('✓ Folder accessible: ' + folder.getName());
  } catch (e) {
    Logger.log('❌ Cannot access folder: ' + e.message);
    return false;
  }

  Logger.log('');
  Logger.log('✓ All configuration tests passed!');
  return true;
}

/**
 * Adds headers to existing spreadsheet (for GAM-created sheets)
 * Run this after deploy.sh creates spreadsheet with GAM
 */
function setupSpreadsheetHeaders() {
  Logger.log('Adding headers to spreadsheet...');

  if (!CONFIG.SPREADSHEET_ID) {
    Logger.log('❌ SPREADSHEET_ID not set in Config.gs');
    return false;
  }

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

    // Get or create the sheet
    let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    }

    // Add headers from CONFIG
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

    Logger.log('✓ Headers added successfully');
    Logger.log('✓ Spreadsheet: ' + ss.getUrl());

    return true;

  } catch (e) {
    Logger.log('❌ Error: ' + e.message);
    return false;
  }
}
