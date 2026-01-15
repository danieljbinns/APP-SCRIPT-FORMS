/**
 * Employee ID Setup Form - Main Handler
 * Uses employee_management_forms library
 */

function doGet(e) {
  const requestId = e.parameter.id || '';
  
  if (!requestId) {
    return HtmlService.createHtmlOutput('<h1>Error: No request ID provided</h1>');
  }
  
  const template = HtmlService.createTemplateFromFile('EmployeeIDSetup');
  template.requestId = requestId;
  
  // Get request data and generate IDs
  const requestData = getRequestData(requestId);
  template.requestData = requestData;
  template.generatedEmployeeId = generateEmployeeId();
  template.generatedDssUsername = generateDssUsername(requestData.firstName, requestData.lastName);
  
  return template.evaluate()
    .setTitle('Employee ID Setup')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Get initial request data by ID
 */
function getRequestData(requestId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === requestId) {
        return {
          success: true,
          employeeName: data[i][9] + ' ' + data[i][11], // First + Last
          firstName: data[i][9],
          lastName: data[i][11],
          hireDate: data[i][5],
          position: data[i][13],
          siteName: data[i][14],
          managerName: data[i][18], // Reporting Manager Name
          managerEmail: data[i][17], // Reporting Manager Email
          requesterEmail: data[i][4], // Requester Email
          systemsSelected: data[i][20], // Systems/Apps Selected
          siteDocsAccess: data[i][20] && data[i][20].includes('SiteDocs') // Check if SiteDocs was selected (Column 21 / index 20)
        };
      }
    }
    
    return { success: false, message: 'Request ID not found' };
    
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Generate employee ID (auto-increment or custom logic)
 */
function generateEmployeeId() {
  const timestamp = new Date().getTime();
  return 'EMP-' + timestamp.toString().slice(-6);
}

/**
 * Generate DSS username from name
 */
function generateDssUsername(firstName, lastName) {
  if (!firstName || !lastName) return '';
  return (firstName.charAt(0) + lastName).toLowerCase();
}

/**
 * Submit Employee ID setup form
 */
function submitEmployeeIDSetup(formData) {
  try {
    const requestId = formData.requestId;
    Logger.log('Employee ID Setup submitted for: ' + requestId);
    
    // Ensure results sheet exists
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let resultsSheet = ss.getSheetByName(CONFIG.RESULTS_SHEET_NAME);
    
    // Create sheet if it doesn't exist
    if (!resultsSheet) {
      resultsSheet = ss.insertSheet(CONFIG.RESULTS_SHEET_NAME);
      resultsSheet.appendRow([
        'Request ID',
        'Submission Timestamp',
        'Internal Employee ID',
        'SiteDocs Worker ID',
        'SiteDocs Job Code',
        'SiteDocs Username',
        'SiteDocs Password',
        'DSS Username',
        'DSS Password',
        'Setup Notes',
        'Submitted By'
      ]);
      // Format header
      resultsSheet.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground('#f3f3f3');
    }
    
    // Append the setup results
    resultsSheet.appendRow([
      requestId,
      new Date(),
      formData.internalEmployeeId,
      formData.siteDocsWorkerId,
      formData.siteDocsJobCode,
      formData.siteDocsUsername || 'N/A',
      formData.siteDocsPassword || 'N/A',
      formData.dssUsername,
      formData.dssPassword,
      formData.setupNotes || '',
      Session.getActiveUser().getEmail()
    ]);
    
    // Also update Workflow Status in the Initial Requests sheet if possible
    try {
      const mainSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
      const data = mainSheet.getDataRange().getValues();
      const headers = data[0];
      const statusCol = headers.indexOf('Workflow Status');
      
      if (statusCol !== -1) {
        for (let i = 1; i < data.length; i++) {
          if (data[i][0] === requestId) {
            mainSheet.getRange(i + 1, statusCol + 1).setValue('ID Setup Complete');
            break;
          }
        }
      }
    } catch (e) {
      Logger.log('⚠️ Could not update main sheet status: ' + e.message);
    }
    
    // Trigger conditional notifications
    triggerConditionalEmails(requestId, formData);
    
    return {
      success: true,
      message: 'Employee ID setup completed successfully and saved to ' + CONFIG.RESULTS_SHEET_NAME
    };
    
  } catch (error) {
    Logger.log('❌ Employee ID setup error: ' + error.toString());
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Trigger conditional email notifications
 * GATEKEEPER: This now only triggers IT. 
 * IT will trigger other departments after they finish.
 */
function triggerConditionalEmails(requestId, setupData) {
  // Get original request data
  const requestData = getRequestData(requestId);
  if (!requestData.success) return;
  
  const baseUrl = ScriptApp.getService().getUrl();
  
  // 1. IT Setup Email (This is the ONLY one triggered at this stage)
  const itFormUrl = CONFIG.IT_FORM_URL || (baseUrl + '?form=it');
  const itLink = itFormUrl + (itFormUrl.includes('?') ? '&' : '?') + 'id=' + requestId;
  
  Lib.sendFormEmail({
    to: CONFIG.EMAILS.IT,
    subject: 'New Employee IT Setup Required',
    body: `Employee ID setup has been completed.\n\nEmployee: ${requestData.employeeName}\nRequest ID: ${requestId}\n\nPlease complete the IT setup form:\n${itLink}`,
    formUrl: itLink,
    displayName: 'Team Group Companies - Employee Onboarding'
  });
  
  Logger.log('✓ IT Setup email sent (Downstream departments gatekept until IT completes).');
}
