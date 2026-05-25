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
    
    // 1b. Initialize Dashboard View Sheet (Flat, instantaneous UI read model)
    initSheet(ss, CONFIG.SHEETS.DASHBOARD_VIEW, [
      'Workflow ID', 'Employee Name', 'Global Status', 'Granular Step Details',
      'Requester Name', 'Requester Email', 'Initiator Email', 'Date Requested',
      'Last Updated', 'Manager Email', 'Requested Items JSON', 'Hire Date',
      'Site', 'Employment Type'
    ]);
    
    // 2. Initialize Initial Requests
    initSheet(ss, CONFIG.SHEETS.INITIAL_REQUESTS, [
      'Workflow ID', 'Form ID', 'Timestamp', 'Date Requested', 'Requester Name', 'Requester Email',
      'Hire Date', 'New Hire/Rehire', 'Employee Type', 'Employment Type',
      'First Name', 'Middle Name', 'Last Name', 'Preferred Name', 'Position Title',
      'Site Name', 'Job Site #', 'Manager Email', 'Manager Name',
      'System Access', 'Systems', 'Equipment', 'Google Email', 'Google Domain',
      'Computer Req', 'Computer Type', 'Prev User (Computer)', 'Prev Type', 'Serial #',
      'Office 365', 'CC USA', 'Limit USA', 'CC CAN', 'Limit CAN', 'CC HD', 'Limit HD',
      'Phone Req', 'Prev User (Phone)', 'Prev Number', 'BOSS Sites', 'BOSS Cost Sheet',
      'BOSS Jobs', 'BOSS Trip', 'BOSS Grievances', 'Jonas Job #s', 'JR Req', 'JR Assign',
      '30/60/90', 'Comments', 'ADP Sites', 'Department', 'Purchasing Sites', 'Status',
      'ADP Salary Access'
    ]);
    
    // 3. Initialize ID Setup Results
    initSheet(ss, CONFIG.SHEETS.ID_SETUP_RESULTS, [
      'Workflow ID', 'Form ID', 'Submission Timestamp', 'Internal Employee ID',
      'SiteDocs Worker ID', 'SiteDocs Job Code', 'SiteDocs Username',
      'SiteDocs Password', 'DSS Username', 'DSS Password',
      'Setup Notes', 'Submitted By', 'BOSS WIS Created'
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
      'Computer Assigned', 'Computer Serial', 'Computer Model', 'Computer Type',
      'Phone Assigned', 'Phone Carrier', 'Phone Model', 'Phone Number', 'Phone VM Password',
      'BOSS Access', 'Incidents Access', 'CAA Access', 'Delivery App Access', 'Net Promoter Access',
      'IT Notes', 'Submitted By'
    ]);
    
    // 6. Specialist sheets removed — specialist steps now use Action Items.
    
    // 7. Initialize Termination & Change Status Sheets
    initSheet(ss, CONFIG.SHEETS.TERMINATIONS, [
      'Workflow ID', 'Form ID', 'Timestamp', 'Requester Name', 'Requester Email', 
      'Employee Name', 'Employee ID', 'Employee Type', 'Work Email', 'Phone', 'Computer Serial', 
      'Site', 'Term Date', 'Reason', 'Manager Name', 'Manager Email', 'HR Approved Status', 'Has Reports', 'Reassign Reports To', 
      'Systems to Deactivate', 'Email Forwarding', 'Drive Files Transfer', 'Inbox Delegate', 'Account Duration', 'Vacation Responder Auto Reply',
      'Equipment to Return', 'Comments', 'Last Day Worked'
    ]);
    
    initSheet(ss, CONFIG.SHEETS.POSITION_CHANGES, [
      // cols 0-27 (original)
      'Workflow ID', 'Form ID', 'Timestamp', 'Requester Name', 'Requester Email',
      'Employee Name', 'Employee ID', 'Effective Date', 'Current Site', 'Change Types',
      'Site Transfer (Old -> New)', 'Title Change (Old -> New)', 'Classification (Old -> New)',
      'Manager Change (Old -> New)', 'Reassign Old Reports To', 'New Reports From',
      'Google Account', 'Systems Added', 'Equipment', 'Removed Access', 'Comments', 'Department',
      'Purchasing Sites', 'Receiving Manager Email', 'Current Title', 'Current Manager Email',
      'Current Manager Name', 'Current Class',
      // cols 28-59 (extended 2026-05-14)
      'Date Requested', 'First Name', 'Last Name',
      'BOSS Training Only', 'BOSS Sites', 'BOSS Cost Sheet', 'BOSS Cost Jobs',
      'BOSS Trip Reports', 'BOSS Grievances',
      'ADP Sites', 'ADP Salary Access',
      'JR Required', 'JR Assignment', '30/60/90 Plan',
      'Computer Req', 'Computer Type', 'Computer Prev User', 'Computer Prev Type', 'Computer Serial', 'Office 365',
      'CC USA', 'CC Limit USA', 'CC Canada', 'CC Limit Canada', 'CC Home Depot', 'CC Limit Home Depot',
      'Phone Req', 'Phone Prev User', 'Phone Prev Number',
      'Jonas Job Numbers', 'Equipment to Return', 'Status',
      // col 60 (added 2026-05-15)
      'Attachment URL'
    ]);

    // 7b. Initialize Equipment Requests
    initSheet(ss, CONFIG.SHEETS.EQUIPMENT_REQUESTS, [
      'Workflow ID', 'Form ID', 'Timestamp', 'Requester Name', 'Requester Email',
      'Employee First Name', 'Employee Last Name', 'Site Name', 'Job Title', 'Manager Name', 'Manager Email',
      'Equipment Requested', 'Systems Requested', 'Comments', 'Department'
    ]);

    // 8. Initialize Approval & Collection Results
    const termApprovalHeaders = ['Workflow ID', 'Form ID', 'Timestamp', 'Decision', 'Notes', 'Follow-up Required', 'Submitted By'];
    initSheet(ss, CONFIG.SHEETS.TERMINATION_APPROVALS, termApprovalHeaders);
    // Position change approvals carry confirmed title/manager from HR review step
    const pcApprovalHeaders = ['Workflow ID', 'Form ID', 'Timestamp', 'Decision', 'Notes', 'Confirmed Title', 'Confirmed New Manager', 'Submitted By'];
    initSheet(ss, CONFIG.SHEETS.POSITION_CHANGE_APPROVALS, pcApprovalHeaders);
    
    // Asset Collection Results sheet removed — asset collection now uses Action Items.

    // 9. Initialize Action Items
    initSheet(ss, CONFIG.SHEETS.ACTION_ITEMS, [
      'Workflow ID', 'Task ID', 'Category', 'Task Name', 'Description', 'Assigned To',
      'Status', 'Created Date', 'Completed Date', 'Notes', 'Closed By', 'Draft',
      'Form Type', 'Form Data'
    ]);

    // 10. Initialize Lookups
    createDataLookupSheet();
    
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

/**
 * ============================================================
 *  PROD ONLY — Run once from the GAS editor after first push.
 *  Sets all Script Properties for the production environment.
 *  Safe to re-run — existing values will be overwritten.
 * ============================================================
 */
function setupProdScriptProperties() {
  const props = PropertiesService.getScriptProperties();

  // Only set values that DIFFER from the ConfigurationService defaults.
  // Email addresses and group settings already have correct defaults in
  // ConfigurationService.js — no need to duplicate them here.
  props.setProperties({
    // ── The only things that are wrong in the hardcoded defaults ───
    'SPREADSHEET_ID':   '1kGjw8e-uIehaBemlsRZ4Yq1QrYOWkJvWzhKbgfl4Pxo',

    // ── Directory search domain ─────────────────────────────────────
    'DIRECTORY_DOMAIN': 'team-group.com',

    // ── Attachment folders (attachments/prod/*) ─────────────────────
    'TERM_ATTACHMENTS_FOLDER_ID':   '1f7_oFZgjTk1O6ckkorjPjFCIr-jL6n0D',  // attachments/Termination
    'CHANGE_ATTACHMENTS_FOLDER_ID': '1h6XfuSa0vCRBezcpTkPaNZ0TPKbiBH39', // attachments/Position Change

    // ── Paste the prod /exec URL after creating a new deployment ───
    // Deploy → Manage Deployments → New version → copy /exec URL
    'DEPLOYMENT_URL':   ''   // ← fill in after first deployment
  });

  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  Logger.log('[setupProdScriptProperties] Done.');
  Logger.log('  SPREADSHEET_ID = ' + id);
  Logger.log('  Spreadsheet name: ' + SpreadsheetApp.openById(id).getName());
}

/**
 * migratePositionChangesSchema()
 * Run ONCE manually from Apps Script editor on the dev spreadsheet.
 * Adds the 32 extended columns (28–59) to an existing Position Changes sheet
 * that already has data rows — does NOT wipe existing data.
 *
 * Safe to re-run: skips columns that already exist by header name.
 */
function migratePositionChangesSchema() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.POSITION_CHANGES);
  if (!sheet) {
    Logger.log('[migratePositionChangesSchema] Sheet not found: ' + CONFIG.SHEETS.POSITION_CHANGES);
    return;
  }

  const newHeaders = [
    'Date Requested',       // 28
    'First Name',           // 29
    'Last Name',            // 30
    'BOSS Training Only',   // 31
    'BOSS Sites',           // 32
    'BOSS Cost Sheet',      // 33
    'BOSS Cost Jobs',       // 34
    'BOSS Trip Reports',    // 35
    'BOSS Grievances',      // 36
    'ADP Sites',            // 37
    'ADP Salary Access',    // 38
    'JR Required',          // 39
    'JR Assignment',        // 40
    '30/60/90 Plan',        // 41
    'Computer Req',         // 42
    'Computer Type',        // 43
    'Computer Prev User',   // 44
    'Computer Prev Type',   // 45
    'Computer Serial',      // 46
    'Office 365',           // 47
    'CC USA',               // 48
    'CC Limit USA',         // 49
    'CC Canada',            // 50
    'CC Limit Canada',      // 51
    'CC Home Depot',        // 52
    'CC Limit Home Depot',  // 53
    'Phone Req',            // 54
    'Phone Prev User',      // 55
    'Phone Prev Number',    // 56
    'Jonas Job Numbers',    // 57
    'Equipment to Return',  // 58
    'Status'                // 59
  ];

  // Read existing header row
  const lastCol = sheet.getLastColumn();
  const existingHeaders = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String)
    : [];

  let added = 0;
  newHeaders.forEach(function(h) {
    if (existingHeaders.indexOf(h) === -1) {
      const nextCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextCol).setValue(h)
        .setFontWeight('bold')
        .setBackground('#EB1C2D')
        .setFontColor('#ffffff');
      added++;
      Logger.log('[migratePositionChangesSchema] Added column: ' + h + ' at col ' + nextCol);
    } else {
      Logger.log('[migratePositionChangesSchema] Already exists, skipped: ' + h);
    }
  });

  Logger.log('[migratePositionChangesSchema] Done. Added ' + added + ' new column(s).');
}

/**
 * migratePositionChangesAttachmentUrl()
 * Run ONCE manually from Apps Script editor.
 * Adds the Attachment URL column (col 60, index BI) to an existing Position Changes sheet.
 * Safe to re-run — skips if the column already exists.
 */
function migratePositionChangesAttachmentUrl() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.POSITION_CHANGES);
  if (!sheet) {
    Logger.log('[migratePositionChangesAttachmentUrl] Sheet not found: ' + CONFIG.SHEETS.POSITION_CHANGES);
    return;
  }
  const lastCol = sheet.getLastColumn();
  const existingHeaders = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  if (existingHeaders.indexOf('Attachment URL') !== -1) {
    Logger.log('[migratePositionChangesAttachmentUrl] Already exists, nothing to do.');
    return;
  }
  const nextCol = sheet.getLastColumn() + 1;
  sheet.getRange(1, nextCol).setValue('Attachment URL')
    .setFontWeight('bold')
    .setBackground('#EB1C2D')
    .setFontColor('#ffffff');
  Logger.log('[migratePositionChangesAttachmentUrl] Added Attachment URL at col ' + nextCol);
}

/**
 * Print all current Script Properties to the Logger.
 * Useful for verifying setupProdScriptProperties ran correctly.
 */
function listScriptProperties() {
  const props = PropertiesService.getScriptProperties().getProperties();
  Logger.log('=== Script Properties ===');
  Object.keys(props).sort().forEach(function(k) {
    Logger.log('  ' + k + ' = ' + props[k]);
  });
}

function enableMaintenanceMode()  { PropertiesService.getScriptProperties().setProperty('MAINTENANCE_MODE', 'true');  Logger.log('MAINTENANCE_MODE = true'); }
function disableMaintenanceMode() { PropertiesService.getScriptProperties().deleteProperty('MAINTENANCE_MODE'); Logger.log('MAINTENANCE_MODE cleared'); }
function setEmailRedirect(addr)   { var a = addr || 'dbinns@team-group.com'; PropertiesService.getScriptProperties().setProperty('EMAIL_REDIRECT_ALL', a); Logger.log('EMAIL_REDIRECT_ALL = ' + a); }
function clearEmailRedirect()     { PropertiesService.getScriptProperties().deleteProperty('EMAIL_REDIRECT_ALL'); Logger.log('EMAIL_REDIRECT_ALL cleared'); }
function setMaintenanceBypass(emails) { var v = emails || 'dbinns@robinsonsolutions.com'; PropertiesService.getScriptProperties().setProperty('MAINTENANCE_BYPASS_EMAILS', v); Logger.log('MAINTENANCE_BYPASS_EMAILS = ' + v); return { ok: true, value: v }; }
function clearMaintenanceBypass()     { PropertiesService.getScriptProperties().deleteProperty('MAINTENANCE_BYPASS_EMAILS'); Logger.log('MAINTENANCE_BYPASS_EMAILS cleared'); return { ok: true }; }
function suppressEmails()         { PropertiesService.getScriptProperties().setProperty('SUPPRESS_EMAILS_OVERRIDE', 'true');  Logger.log('SUPPRESS_EMAILS_OVERRIDE = true'); }
function unsuppressEmails()       { PropertiesService.getScriptProperties().deleteProperty('SUPPRESS_EMAILS_OVERRIDE'); Logger.log('SUPPRESS_EMAILS_OVERRIDE cleared'); }
function enableEasterEggs()       { PropertiesService.getScriptProperties().setProperty('EASTER_EGGS_ENABLED', 'true'); Logger.log('EASTER_EGGS_ENABLED = true'); }
function disableEasterEggs()      { PropertiesService.getScriptProperties().deleteProperty('EASTER_EGGS_ENABLED'); Logger.log('EASTER_EGGS_ENABLED cleared'); }
