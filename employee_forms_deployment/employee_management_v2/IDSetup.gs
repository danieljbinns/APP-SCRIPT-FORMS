/**
 * Employee ID Setup Form - Handler Functions
 */

function serveIDSetup(workflowId) {
  if (!workflowId) {
    return HtmlService.createHtmlOutput('<h1>Error: No workflow ID provided</h1>');
  }
  
  const template = HtmlService.createTemplateFromFile('EmployeeIDSetup');
  template.workflowId = workflowId;
  template.formId = '';
  
  const requestData = getIDSetupRequestData(workflowId);
  
  if (!requestData || !requestData.success) {
    return HtmlService.createHtmlOutput('<h1>Data Not Found</h1><p>Could not find initial request data for Workflow ID: ' + workflowId + '</p><p>Please contact the administrator or try submitting a new request.</p><p>Debug info: ' + (requestData ? requestData.message : 'NULL') + '</p>');
  }

  template.requestData = requestData;
  template.generatedEmployeeId = generateEmployeeId();
  template.generatedDssUsername = generateDssUsername(requestData.firstName, requestData.lastName);
  
  return template.evaluate()
    .setTitle('Employee ID Setup')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getIDSetupRequestData(workflowId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === workflowId) {
        return {
          success: true,
          employeeName: data[i][10] + ' ' + data[i][12],
          firstName: data[i][10],
          lastName: data[i][12],
          hireDate: data[i][6] ? Utilities.formatDate(new Date(data[i][6]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
          position: data[i][14],
          jrTitle: data[i][46] || '',
          siteName: data[i][15],
          jobSiteNumber: data[i][16] || '',
          managerName: data[i][18],
          managerEmail: data[i][17],
          requesterEmail: data[i][5],
          employmentType: data[i][9] || '',
          employeeType: data[i][8] || '',
          newHireOrRehire: data[i][7] || '',
          systemsSelected: data[i][20],
          siteDocsAccess: data[i][20] && data[i][20].includes('SiteDocs')
        };
      }
    }
    
    return { success: false, message: 'Workflow ID not found' };
    
  } catch (error) {
    return { success: false, message: error.message };
  }
}

function generateEmployeeId() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.ID_SETUP_RESULTS);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      // No previous IDs, start at 30000
      return '30000';
    }
    
    // Get all employee IDs from column D (Internal Employee ID)
    const data = sheet.getRange(2, 4, sheet.getLastRow() - 1, 1).getValues();
    let maxId = 29999; // Start below 30000
    
    data.forEach(row => {
      const id = row[0];
      if (id && !isNaN(id)) {
        const numId = parseInt(id);
        if (numId > maxId) {
          maxId = numId;
        }
      }
    });
    
    return String(maxId + 1);
    
  } catch (error) {
    Logger.log('Error generating employee ID: ' + error.toString());
    // Fallback to timestamp-based if there's an error
    const timestamp = new Date().getTime();
    return  '30' + timestamp.toString().slice(-3);
  }
}

function generateDssUsername(firstName, lastName) {
  if (!firstName || !lastName) return '';
  return (firstName.charAt(0) + lastName).toLowerCase();
}

function submitEmployeeIDSetup(formData) {
  try {
    const workflowId = formData.workflowId;
    const formId = generateFormId('ID_SETUP');
    
    Logger.log('Employee ID Setup submitted for: ' + workflowId);
    
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let resultsSheet = ss.getSheetByName(CONFIG.SHEETS.ID_SETUP_RESULTS);
    
    if (!resultsSheet) {
      resultsSheet = ss.insertSheet(CONFIG.SHEETS.ID_SETUP_RESULTS);
      resultsSheet.appendRow([
        'Workflow ID', 'Form ID', 'Submission Timestamp', 'Internal Employee ID',
        'SiteDocs Worker ID', 'SiteDocs Job Code', 'SiteDocs Username',
        'SiteDocs Password', 'DSS Username', 'DSS Password',
        'Setup Notes', 'Submitted By'
      ]);
      resultsSheet.getRange(1, 1, 1, 12).setFontWeight('bold').setBackground('#EB1C2D').setFontColor('#ffffff');
    }
    
    resultsSheet.appendRow([
      workflowId, formId, new Date(), formData.internalEmployeeId,
      formData.siteDocsWorkerId, formData.siteDocsJobCode,
      formData.siteDocsUsername || 'N/A', formData.siteDocsPassword || 'N/A',
      formData.dssUsername, formData.dssPassword,
      formData.setupNotes || '', Session.getActiveUser().getEmail()
    ]);
    
    const actingUser = Session.getActiveUser().getEmail();
    updateWorkflow(workflowId, 'In Progress', 'ID Setup Complete', '', actingUser);
    
    triggerNextStepFromIDSetup(workflowId, formData);
    
    return {
      success: true,
      message: 'Employee ID setup completed successfully'
    };
    
  } catch (error) {
    Logger.log('[ERROR] Employee ID setup error: ' + error.toString());
    return {
      success: false,
      message: error.message
    };
  }
}

function triggerNextStepFromIDSetup(workflowId, setupData) {
  const requestData = getIDSetupRequestData(workflowId);
  if (!requestData.success) return;
  
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const mainSheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
  const mainData = mainSheet.getDataRange().getValues();
  
  let employmentType = '';
  let systemAccess = '';
  
  for (let i = 1; i < mainData.length; i++) {
    if (mainData[i][0] === workflowId) {
      employmentType = mainData[i][9] || '';
      systemAccess = mainData[i][19] || '';
      break;
    }
  }
  
  Logger.log('Routing from ID Setup: Type=' + employmentType + ', SystemAccess=' + systemAccess);
  
  // Get workflow context for email
  const context = getWorkflowContext(workflowId);
  
  if (employmentType === 'Hourly' && systemAccess === 'No') {
    const hrUrl = buildFormUrl('hr_verification', { wf: workflowId });
    sendFormEmail({
      to: CONFIG.EMAILS.HR,
      subject: 'HR Verification Required (Final Step)',
      body: 'Employee ID setup has been completed for an hourly employee with no system access.\n\nPlease verify employee information and assign ADP Associate ID using the button below. This is the final step - no IT setup is required.',
      formUrl: hrUrl,
      displayName: 'Team Group Companies - Employee Onboarding',
      contextData: context
    });
    Logger.log('[SUCCESS] HR Verification email sent (Hourly/No System Access - Final Step)');
    
  } else {
    const hrUrl = buildFormUrl('hr_verification', { wf: workflowId });
    sendFormEmail({
      to: CONFIG.EMAILS.HR,
      subject: 'HR Verification Required',
      body: 'Employee ID setup has been completed.\n\nPlease verify employee information and assign ADP Associate ID using the button below. IT setup will be triggered after HR verification.',
      formUrl: hrUrl,
      displayName: 'Team Group Companies - Employee Onboarding',
      contextData: context
    });
    Logger.log('[SUCCESS] HR Verification email sent (Salary/System Access path - IT will follow)');
  }
}
