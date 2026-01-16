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
    
    // 1. Initialize Workflows Sheet
    initSheet(ss, CONFIG.SHEETS.WORKFLOWS, [
      'Workflow ID', 'Workflow Type', 'Workflow Name', 'Initiator Email', 
      'Status', 'Created Date', 'Last Updated', 'Current Step', 'Employee Name'
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
