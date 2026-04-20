/**
 * System Initialization Script
 * Run this MANUALLY from the Apps Script editor to:
 * 1. Authorize all scopes
 * 2. Create all necessary sheets
 * 3. Set header rows and formatting
 */

function initializeSystem() {
  try {
    Logger.log('Opening spreadsheet: ' + CONFIG.SPREADSHEET_ID);
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    
    if (!ss) {
      throw new Error('Failed to open spreadsheet. Check ID and permissions.');
    }
    
    Logger.log('Spreadsheet opened successfully: ' + ss.getName());
    
    // 1. Initialize Workflows Sheet (Audit Log)
    initSheet(ss, CONFIG.SHEETS.WORKFLOWS, [
      'Workflow ID', 'Workflow Type', 'Workflow Name', 'Initiator Email', 
      'Status', 'Created Date', 'Last Updated', 'Current Step', 'Employee Name'
    ]);
    
    // 1b. Initialize Dashboard View Sheet (Flat, instantaneous UI read model)
    initSheet(ss, CONFIG.SHEETS.DASHBOARD_VIEW, [
      'Workflow ID', 'Employee Name', 'Global Status', 'Granular Step Details',
      'Requester Name', 'Requester Email', 'Initiator Email', 'Date Requested', 
      'Last Updated', 'Manager Email', 'Requested Items JSON'
    ]);
    
    // 2. Initialize Initial Requests
    initSheet(ss, CONFIG.SHEETS.INITIAL_REQUESTS, [
      'Workflow ID', 'Form ID', 'Timestamp', 'Date Requested', 'Requester Name', 'Requester Email',
      'Hire Date', 'New Hire/Rehire', 'Employee Type', 'Employment Type',
      'First Name', 'Middle Name', 'Last Name', 'Preferred Name', 'Position Title',
      'Site Name', 'Job Site #', 'Manager Email', 'Manager Name',
      'System Access', 'Systems', 'Equipment', 'Google Email', 'Google Domain',
      'Computer Req', 'Computer Type', 'Prev User', 'Prev Type', 'Serial #',
      'Office 365', 'CC USA', 'Limit USA', 'CC CAN', 'Limit CAN', 'CC HD', 'Limit HD',
      'Phone Req', 'Prev User', 'Prev Number', 'BOSS Sites', 'BOSS Cost Sheet',
      'BOSS Jobs', 'BOSS Trip', 'BOSS Grievances', 'Jonas Job #s', 'JR Req', 'JR Assign',
      '30/60/90', 'Comments', 'Status'
    ]);
    
    // 3. Initialize ID Setup Results
    initSheet(ss, CONFIG.SHEETS.ID_SETUP_RESULTS, [
      'Workflow ID', 'Form ID', 'Submission Timestamp', 'Internal Employee ID',
      'SiteDocs Worker ID', 'SiteDocs Job Code', 'SiteDocs Username',
      'SiteDocs Password', 'DSS Username', 'DSS Password',
      'Setup Notes', 'Submitted By'
    ]);
    
    // 4. Initialize HR Verification Results
    initSheet(ss, CONFIG.SHEETS.HR_VERIFICATION_RESULTS, [
      'Workflow ID', 'Form ID', 'Submission Timestamp', 'ADP Associate ID',
      'Verified Name', 'Verified Manager', 'Verified Manager Email',
      'Verified JR Title', 'Notes', 'Submitted By'
    ]);
    
    // 5. Initialize IT Results
    initSheet(ss, CONFIG.SHEETS.IT_RESULTS, [
      'Workflow ID', 'Form ID', 'Submission Timestamp', 'Email Created', 'Assigned Email', 'Email Password',
      'Computer Assigned', 'Computer Make', 'Computer Model', 'Computer Type',
      'Phone Assigned', 'Phone Carrier', 'Phone Model', 'Phone Number', 'Phone VM Password',
      'BOSS Access', 'Incidents Access', 'CAA Access', 'Delivery App Access', 'Net Promoter Access',
      'IT Notes', 'Submitted By'
    ]);
    
    // 6. Initialize Specialist Sheets
    const specialistHeaders = ['Workflow ID', 'Form ID', 'Submission Timestamp', 'Details', 'Notes', 'Submitted By'];
    
    initSheet(ss, CONFIG.SHEETS.CREDIT_CARD_RESULTS, specialistHeaders);
    initSheet(ss, CONFIG.SHEETS.BUSINESS_CARDS_RESULTS, specialistHeaders);
    initSheet(ss, CONFIG.SHEETS.FLEETIO_RESULTS, specialistHeaders);
    initSheet(ss, CONFIG.SHEETS.JONAS_RESULTS, specialistHeaders);
    initSheet(ss, CONFIG.SHEETS.SITEDOCS_RESULTS, specialistHeaders);
    initSheet(ss, CONFIG.SHEETS.REVIEW_306090_RESULTS, specialistHeaders);
    
    Logger.log('System initialization complete! All sheets ready.');
    
  } catch (error) {
    Logger.log('Error in initializeSystem: ' + error.toString());
  }
}

/**
 * Run this function ONCE in the Staging Apps Script Editor to set the environment variables.
 * Do not run this on Prod.
 */
function setStagingEnvironmentProperties() {
  PropertiesService.getScriptProperties().setProperties({
    'SPREADSHEET_ID': '1o2KulGLhpClbvbkYG-VqsaOJNQfAcpVZgRtc-FKpuAw',
    'MAIN_FOLDER_ID': '1urQub0R77Dps927UIydfdNHuBLEr6j7N',
    'EMAIL_REDIRECT_ALL': 'dbinns@robinsonsolutions.com',
    'DEPLOYMENT_URL': 'https://script.google.com/a/macros/robinsonsolutions.com/s/AKfycbyZ_V8PvQl0HPLx5nzMGuy6Sky1i5SQQ016bNpKhxINDEEgQ0WBcgGF9TjdBTP7pezb/exec'
  });
  Logger.log('Staging environment properties set successfully.');
}

/**
 * Run this function ONCE in the DEV Apps Script Editor to set the environment variables.
 */
function setDevEnvironmentProperties() {
  PropertiesService.getScriptProperties().setProperties({
    'SPREADSHEET_ID': '1KeWBbh8755mRXFSK2dCeSW75djpaPgtprbmqd7BAsMA', // User provided DEV sheet
    'MAIN_FOLDER_ID': '1e9rVCCI14kZ_lwEaA_NFsswnk-kfP-Bj', // Dev Folder ID
    'EMAIL_REDIRECT_ALL': Session.getActiveUser().getEmail() || 'dbinns@team-group.com',
    'DEPLOYMENT_URL': '' // Leave blank initially until explicitly deployed as web app
  });
  Logger.log('DEV environment properties set successfully via IDE.');
}

/**
 * Helper to create sheet if missing and set headers
 */
function initSheet(ss, sheetName, headers) {
  if (!ss) {
    Logger.log('Error: success object undefined in initSheet for ' + sheetName);
    return;
  }
  
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    Logger.log('Created sheet: ' + sheetName);
  } else {
    Logger.log('Sheet exists: ' + sheetName);
  }
  
  // Always update headers to ensure they match current code
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#EB1C2D').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
}

/**
 * Create Data_Lookup sheet with simplified 4-column structure
 * Run this once manually from Apps Script editor
 */
function createDataLookupSheet() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    
    // Check if sheet already exists
    let sheet = ss.getSheetByName('Data_Lookup');
    if (sheet) {
      Logger.log('Data_Lookup sheet already exists - skipping creation');
      return;
    }
    
    // Create new sheet
    sheet = ss.insertSheet('Data_Lookup');
    Logger.log('Created Data_Lookup sheet');
    
    // Set up headers (4 columns: Sites, Job Codes, JRs, Job Numbers)
    const headers = ['Sites', 'Job Codes', 'JRs', 'Job Numbers'];
    sheet.getRange(1, 1, 1, 4).setValues([headers]);
    
    // Style headers
    sheet.getRange(1, 1, 1, 4)
      .setBackground('#EB1C2D')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    
    // Pre-populate Job Codes (from existing EmployeeIDSetup dropdown)
    const jobCodes = [
      ['Hourly 1'],
      ['Hourly 2'],
      ['Salary 1'],
      ['Salary 2'],
      ['Supervisor'],
      ['Manager']
    ];
    sheet.getRange(2, 2, jobCodes.length, 1).setValues(jobCodes);
    
    // Add example data for other columns (user will replace with real data)
    const exampleSites = [
      ['Toronto Office'],
      ['Calgary Site'],
      ['Vancouver Warehouse']
    ];
    
    const exampleJRs = [
      ['Project Manager'],
      ['Site Supervisor'],
      ['Field Coordinator']
    ];
    
    const exampleJobNumbers = [
      ['12345'],
      ['67890'],
      ['11111']
    ];
    
    sheet.getRange(2, 1, exampleSites.length, 1).setValues(exampleSites);
    sheet.getRange(2, 3, exampleJRs.length, 1).setValues(exampleJRs);
    sheet.getRange(2, 4, exampleJobNumbers.length, 1).setValues(exampleJobNumbers);
    
    // Auto-resize columns
    sheet.autoResizeColumns(1, 4);
    
    // Freeze header row
    sheet.setFrozenRows(1);
    
    Logger.log('✅ Data_Lookup sheet created successfully!');
    Logger.log('   - Job Codes pre-populated from existing dropdown');
    Logger.log('   - Example data added - replace with your actual data');
    Logger.log('   - Simplified to 4 columns: Sites, Job Codes, JRs, Job Numbers');
    
  } catch (error) {
    Logger.log('❌ Error creating Data_Lookup sheet: ' + error.toString());
  }
}
