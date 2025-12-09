/**
 * Setup Scripts for WMAR v2
 * 
 * Run these functions once during initial deployment to set up
 * required Google resources.
 */

/**
 * Create all required sheets in the spreadsheet
 * Run this ONCE during initial setup
 * 
 * Note: Spreadsheet should already exist (ID in Config.gs)
 * This function adds the required sheets if they don't exist
 */
function setupSpreadsheetSheets() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  
  // Get all sheet names from CONFIG
  const requiredSheets = Object.values(CONFIG.SHEETS);
  
  Logger.log('Setting up sheets in spreadsheet: ' + ss.getName());
  
  requiredSheets.forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      Logger.log('✓ Created sheet: ' + sheetName);
    } else {
      Logger.log('- Sheet already exists: ' + sheetName);
    }
  });
  
  Logger.log('\nSetup complete!');
  Logger.log('Spreadsheet URL: ' + ss.getUrl());
}

/**
 * Create Google Drive folder structure
 * Run this ONCE during initial setup
 * 
 * After running, copy the folder IDs to Config.gs
 */
function setupDriveFolders() {
  // Create main folder
  const mainFolder = DriveApp.createFolder('WMAR - Workflow System');
  Logger.log('Created main folder: ' + mainFolder.getName());
  Logger.log('MAIN ID: ' + mainFolder.getId());
  
  // Create subfolders
  const subfolders = {
    PDFS: mainFolder.createFolder('PDFs'),
    REQUESTS: mainFolder.createFolder('Requests'),
    REPORTS: mainFolder.createFolder('Reports'),
    TEMPLATES: mainFolder.createFolder('Templates'),
    ARCHIVES: mainFolder.createFolder('Archives')
  };
  
  Logger.log('\nSubfolders created:');
  Object.entries(subfolders).forEach(([key, folder]) => {
    Logger.log(key + ' ID: ' + folder.getId());
  });
  
  Logger.log('\n📋 Copy these IDs to Config.gs FOLDERS section:');
  Logger.log('MAIN: \'' + mainFolder.getId() + '\',');
  Logger.log('PDFS: \'' + subfolders.PDFS.getId() + '\',');
  Logger.log('REQUESTS: \'' + subfolders.REQUESTS.getId() + '\',');
  Logger.log('REPORTS: \'' + subfolders.REPORTS.getId() + '\',');
  Logger.log('TEMPLATES: \'' + subfolders.TEMPLATES.getId() + '\',');
  Logger.log('ARCHIVES: \'' + subfolders.ARCHIVES.getId() + '\'');
  
  Logger.log('\nMain folder URL: ' + mainFolder.getUrl());
}

/**
 * Initialize Job Codes sheet with headers
 * Run this after setupSpreadsheetSheets()
 */
function setupJobCodesSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.JOB_CODES);
  
  if (!sheet) {
    Logger.log('ERROR: Job Codes sheet not found. Run setupSpreadsheetSheets() first.');
    return;
  }
  
  // Add headers
  const headers = ['Site Name', 'Job Description', 'Job Number'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  
  // Add sample data
  const sampleData = [
    ['Toronto Office', 'Software Engineer', 'TOR-001'],
    ['Vancouver Branch', 'Project Manager', 'VAN-002'],
    ['Montreal Site', 'Business Analyst', 'MTL-003']
  ];
  
  sheet.getRange(2, 1, sampleData.length, headers.length).setValues(sampleData);
  
  Logger.log('✓ Job Codes sheet initialized with headers and sample data');
  Logger.log('Replace sample data with your actual job codes');
}

/**
 * Run all setup functions in sequence
 * This is the main setup function to run for initial deployment
 */
function runCompleteSetup() {
  Logger.log('🚀 Starting WMAR v2 Complete Setup...\n');
  
  Logger.log('Step 1: Setting up spreadsheet sheets...');
  setupSpreadsheetSheets();
  
  Logger.log('\nStep 2: Setting up Drive folders...');
  setupDriveFolders();
  
  Logger.log('\nStep 3: Initializing Job Codes sheet...');
  setupJobCodesSheet();
  
  Logger.log('\n✅ Complete setup finished!');
  Logger.log('\n📋 TODO:');
  Logger.log('1. Copy folder IDs to Config.gs');
  Logger.log('2. Update Config.gs with actual job codes');
  Logger.log('3. Update email addresses in Config.gs');
  Logger.log('4. Update logo URL in Config.gs');
  Logger.log('5. Run: clasp push');
  Logger.log('6. Test the web app!');
}
