/**
 * Setup script to create a new spreadsheet with all required sheets
 * Run this once to initialize the system with a fresh spreadsheet
 */

function setupNewSpreadsheet() {
  // Create new spreadsheet
  const ss = SpreadsheetApp.create('WMAR - Workflow Automation System');
  const spreadsheetId = ss.getId();
  
  Logger.log('Created new spreadsheet: ' + spreadsheetId);
  Logger.log('URL: ' + ss.getUrl());
  
  // Create main data sheet with headers first
  const mainSheet = ss.insertSheet('All Responses');
  
  // Now delete default "Sheet1"
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet) {
    ss.deleteSheet(defaultSheet);
  }
  const headers = [
    'Request ID',
    'Temporary ID',
    'Submission Timestamp',
    'Workflow Status',
    'Post-Processing Status',
    'Final Status',
    
    // Requester Information
    'Requester Name',
    'Requester Email',
    'Requester Phone Number',
    
    // Employee Information
    'First Name',
    'Last Name',
    'Hire Date',
    'Site Name',
    'Department',
    'Position/Title',
    'Hourly or Salary',
    'Reporting Manager Email ',
    
    // Equipment & Access Requests
    'Laptop',
    'Monitor',
    'Keyboard',
    'Mouse',
    'Phone',
    'Fleetio / Vehicle',
    'Credit Card',
    'JR',
    '30-60-90',
    'ADP Supervisor Access',
    'ADP Manager Access',
    'JONAS',
    'SiteDocs',
    
    // HR Setup Data
    'HR - Date of Submission',
    'HR - DSS Username',
    'HR - DSS Password',
    'HR - ADP Employee ID',
    'HR - Notes',
    
    // IT Setup Data
    'IT - Completion Timestamp',
    'IT - Computer Asset #',
    'IT - Monitor Asset #',
    'IT - Phone Asset #',
    'IT - Email Address',
    'IT - Network Username',
    'IT - Notes',
    
    // Parallel Task Statuses
    'Fleetio - Status',
    'Fleetio - Timestamp',
    'Fleetio - Vehicle Asset #',
    'Fleetio - Notes',
    
    'Credit Card - Status',
    'Credit Card - Timestamp',
    'Credit Card - Card Number',
    'Credit Card - Limit',
    'Credit Card - Notes',
    
    'JR - Status',
    'JR - Timestamp',
    'JR - Notes',
    
    '30-60-90 - Status',
    '30-60-90 - Timestamp',
    '30-60-90 - Notes',
    
    'ADP Supervisor Access - Status',
    'ADP Supervisor Access - Timestamp',
    'ADP Supervisor Access - Notes',
    
    'ADP Manager Access - Status',
    'ADP Manager Access - Timestamp',
    'ADP Manager Access - Notes',
    
    'JONAS - Status',
    'JONAS - Timestamp',
    'JONAS - Notes',
    
    'SiteDocs - Status',
    'SiteDocs - Timestamp',
    'SiteDocs - Notes',
    
    // Final Approval
    'Final Approver Name',
    'Final Approval Timestamp',
    'Final Approval Comments',
    'Final Denial Reason',
    'Approval Notes'
  ];
  
  mainSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  mainSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  mainSheet.setFrozenRows(1);
  
  // Create tracking sheets for each parallel task
  const taskSheets = [
    'Fleetio Tasks',
    'Credit Card Tasks',
    'JR Tasks',
    '30-60-90 Tasks',
    'ADP Supervisor Tasks',
    'ADP Manager Tasks',
    'JONAS Tasks',
    'SiteDocs Tasks'
  ];
  
  taskSheets.forEach(sheetName => {
    const taskSheet = ss.insertSheet(sheetName);
    const taskHeaders = [
      'Request ID',
      'Temporary ID',
      'Employee Name',
      'Site',
      'Status',
      'Assigned Date',
      'Completed Date',
      'Notes'
    ];
    taskSheet.getRange(1, 1, 1, taskHeaders.length).setValues([taskHeaders]);
    taskSheet.getRange(1, 1, 1, taskHeaders.length).setFontWeight('bold');
    taskSheet.setFrozenRows(1);
  });
  
  // Create HR Tasks sheet
  const hrSheet = ss.insertSheet('HR Tasks');
  const hrHeaders = [
    'Request ID',
    'Temporary ID',
    'Employee Name',
    'Site',
    'Status',
    'Assigned Date',
    'Completed Date',
    'DSS Username',
    'ADP Employee ID',
    'Notes'
  ];
  hrSheet.getRange(1, 1, 1, hrHeaders.length).setValues([hrHeaders]);
  hrSheet.getRange(1, 1, 1, hrHeaders.length).setFontWeight('bold');
  hrSheet.setFrozenRows(1);
  
  // Create IT Tasks sheet
  const itSheet = ss.insertSheet('IT Tasks');
  const itHeaders = [
    'Request ID',
    'Temporary ID',
    'Employee Name',
    'Site',
    'Status',
    'Assigned Date',
    'Completed Date',
    'Computer Asset',
    'Monitor Asset',
    'Phone Asset',
    'Email',
    'Network Username',
    'Notes'
  ];
  itSheet.getRange(1, 1, 1, itHeaders.length).setValues([itHeaders]);
  itSheet.getRange(1, 1, 1, itHeaders.length).setFontWeight('bold');
  itSheet.setFrozenRows(1);
  
  // Create Dashboard sheet
  const dashSheet = ss.insertSheet('Dashboard');
  dashSheet.getRange('A1').setValue('WMAR Workflow Dashboard');
  dashSheet.getRange('A1').setFontSize(16).setFontWeight('bold');
  
  Logger.log('Setup complete!');
  Logger.log('Spreadsheet ID: ' + spreadsheetId);
  Logger.log('Copy this ID to Config.gs SPREADSHEET_ID');
  
  return {
    spreadsheetId: spreadsheetId,
    url: ss.getUrl()
  };
}
