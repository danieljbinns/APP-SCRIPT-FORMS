/**
 * Setup Functions for WMAR v2
 */

function setupSpreadsheetSheets() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const requiredSheets = Object.values(CONFIG.SHEETS);
  requiredSheets.forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      Logger.log('✓ Created sheet: ' + sheetName);
    }
  });
  Logger.log('Spreadsheet URL: ' + ss.getUrl());
}

function setupDriveFolders() {
  const mainFolder = DriveApp.createFolder('WMAR - Workflow System');
  const pdfs = mainFolder.createFolder('PDFs');
  const requests = mainFolder.createFolder('Requests');
  const reports = mainFolder.createFolder('Reports');
  const templates = mainFolder.createFolder('Templates');
  const archives = mainFolder.createFolder('Archives');
  
  Logger.log('MAIN: \'' + mainFolder.getId() + '\',');
  Logger.log('PDFS: \'' + pdfs.getId() + '\',');
  Logger.log('REQUESTS: \'' + requests.getId() + '\',');
  Logger.log('REPORTS: \'' + reports.getId() + '\',');
  Logger.log('TEMPLATES: \'' + templates.getId() + '\',');
  Logger.log('ARCHIVES: \'' + archives.getId() + '\'');
}

function setupJobCodesSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.JOB_CODES);
  const headers = ['Site Name', 'Job Description', 'Job Number'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  const sampleData = [
    ['Toronto Office', 'Software Engineer', 'TOR-001'],
    ['Vancouver Branch', 'Project Manager', 'VAN-002']
  ];
  sheet.getRange(2, 1, sampleData.length, headers.length).setValues(sampleData);
  Logger.log('✓ Job Codes initialized');
}

function runCompleteSetup() {
  Logger.log('🚀 Starting WMAR v2 Setup...');
  setupSpreadsheetSheets();
  setupDriveFolders();
  setupJobCodesSheet();
  Logger.log('✅ Setup complete!');
}
