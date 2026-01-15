/**
 * IT Setup Form - Main Handler
 * Handles creation of IT accounts and equipment assignment
 */

function doGet(e) {
  const requestId = e.parameter.id || '';
  
  if (!requestId) {
    return HtmlService.createHtmlOutput('<h1>Error: No request ID provided</h1>');
  }
  
  const template = HtmlService.createTemplateFromFile('ITSetup');
  template.requestId = requestId;
  
  // Get request data for context
  const requestData = getITContextData(requestId);
  template.requestData = requestData;
  template.employeeName = requestData.employeeName;
  
  return template.evaluate()
    .setTitle('IT Setup')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Get context data for IT setup
 */
function getITContextData(requestId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const mainSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    const idSetupSheet = ss.getSheetByName(CONFIG.ID_SETUP_RESULTS_SHEET);
    
    const mainData = mainSheet.getDataRange().getValues();
    const headers = mainData[0];
    
    let context = { success: false, message: 'Request ID not found' };
    
    // Find row in main sheet
    for (let i = 1; i < mainData.length; i++) {
      if (mainData[i][0] === requestId) {
        context = {
          success: true,
          employeeName: mainData[i][9] + ' ' + mainData[i][11], // First + Last
          firstName: mainData[i][9],
          lastName: mainData[i][11],
          hireDate: mainData[i][5],
          position: mainData[i][13],
          siteName: mainData[i][14],
          managerName: mainData[i][18],
          employmentType: mainData[i][45], // Hourly or Salary
          emailRequested: mainData[i][22] // System Access Needed?
        };
        break;
      }
    }
    
    if (!context.success) return context;
    
    // Find row in ID Setup sheet for more details
    if (idSetupSheet) {
      const idData = idSetupSheet.getDataRange().getValues();
      for (let j = 1; j < idData.length; j++) {
        if (idData[j][0] === requestId) {
          context.internalEmployeeId = idData[j][2];
          context.siteDocsWorkerId = idData[j][3];
          context.siteDocsJobCode = idData[j][4];
          context.dssUsername = idData[j][7];
          break;
        }
      }
    }
    
    return context;
    
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Submit IT Setup form
 */
function submitITSetup(formData) {
  try {
    const requestId = formData.workflowId || formData.requestId;
    Logger.log('IT Setup submitted for: ' + requestId);
    
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let itSheet = ss.getSheetByName(CONFIG.IT_RESULTS_SHEET);
    
    // Create sheet if missing with comprehensive headers
    if (!itSheet) {
      itSheet = ss.insertSheet(CONFIG.IT_RESULTS_SHEET);
      itSheet.appendRow([
        'Request ID',
        'Submission Timestamp',
        'Email Created',
        'Assigned Email',
        'Email Password',
        'Computer Assigned',
        'Computer Make',
        'Computer Model',
        'Computer Type',
        'Phone Assigned',
        'Phone Carrier',
        'Phone Model',
        'Phone Number',
        'Phone VM Password',
        'BOSS Access',
        'Incidents Access',
        'CAA Access',
        'Delivery App Access',
        'Net Promoter Access',
        'IT Notes',
        'Submitted By'
      ]);
      itSheet.getRange(1, 1, 1, 21).setFontWeight('bold').setBackground('#f3f3f3');
    }
    
    // Prepare data row
    const assignedEmail = formData.Email_Username ? (formData.Email_Username + formData.Email_Domain) : 'N/A';
    
    const rowData = [
      requestId,
      new Date(),
      formData.Email_Created,
      assignedEmail,
      formData.Email_Temp_Password || 'N/A',
      formData.Computer_Assigned,
      formData.Computer_Make || 'N/A',
      formData.Computer_Model || 'N/A',
      formData.Computer_Type || 'N/A',
      formData.Phone_Assigned,
      formData.Phone_Carrier || 'N/A',
      formData.Phone_Model || 'N/A',
      formData.Phone_Number || 'N/A',
      formData.Phone_VM_Password || 'N/A',
      formData.BOSS_Access,
      formData.Incidents_Access,
      formData.CAA_Access,
      formData.Delivery_App_Access,
      formData.Net_Promoter_Score_Access,
      formData.IT_Notes || '',
      Session.getActiveUser().getEmail()
    ];
    
    itSheet.appendRow(rowData);
    
    // Update Workflow Status in main sheet
    const mainSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    const data = mainSheet.getDataRange().getValues();
    const headers = data[0];
    const statusCol = headers.indexOf('Workflow Status');
    
    if (statusCol !== -1) {
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === requestId) {
          mainSheet.getRange(i + 1, statusCol + 1).setValue('IT Setup Complete');
          break;
        }
      }
    }
    
    // Trigger conditional notifications to other departments NOW
    triggerConditionalEmails(requestId, formData);
    
    return {
      success: true,
      message: 'IT Setup results saved successfully and department notifications sent!'
    };
    
  } catch (error) {
    Logger.log('❌ IT Setup error: ' + error.toString());
    return { success: false, message: error.message };
  }
}

/**
 * Trigger conditional email notifications to downstream departments
 * This is called AFTER IT setup is complete.
 */
function triggerConditionalEmails(requestId, itData) {
  // Get original request data
  const requestData = getITContextData(requestId);
  if (!requestData.success) return;
  
  const baseUrl = ScriptApp.getService().getUrl();
  const employeeName = requestData.employeeName;
  const assignedEmail = itData.Email_Username ? (itData.Email_Username + itData.Email_Domain) : '[Pending]';
  
  // Define downstream forms
  const conditionalForms = [
    { email: CONFIG.EMAILS.CREDIT_CARD, name: 'Credit Card', url: CONFIG.CREDIT_CARD_FORM_URL, param: 'creditcard' },
    { email: CONFIG.EMAILS.BUSINESS_CARDS, name: 'Business Cards', url: CONFIG.BUSINESS_CARDS_FORM_URL, param: 'businesscards' },
    { email: CONFIG.EMAILS.FLEETIO, name: 'Fleetio', url: CONFIG.FLEETIO_FORM_URL, param: 'fleetio' },
    { email: CONFIG.EMAILS.REVIEW_306090_JR, name: '30/60/90 & JR', url: CONFIG.REVIEW_FORM_URL, param: 'review' },
    { email: CONFIG.EMAILS.ADP, name: 'ADP', url: CONFIG.ADP_FORM_URL, param: 'adp' },
    { email: CONFIG.EMAILS.JONAS, name: 'JONAS', url: CONFIG.JONAS_FORM_URL, param: 'jonas' },
    { email: CONFIG.EMAILS.SITEDOCS, name: 'SiteDocs', url: CONFIG.SITEDOCS_FORM_URL, param: 'sitedocs' }
  ];
  
  conditionalForms.forEach(form => {
    // Use override URL if available, otherwise use generic placeholder with dept param
    const formBase = form.url || CONFIG.SPECIALIST_PLACEHOLDER_URL || (baseUrl + '?form=' + form.param);
    
    let formLink = formBase + (formBase.includes('?') ? '&' : '?') + 'id=' + requestId;
    
    // Add dept parameter if using the placeholder
    if (formBase === CONFIG.SPECIALIST_PLACEHOLDER_URL || !form.url) {
      formLink += '&dept=' + form.param;
    }
    
    Lib.sendFormEmail({
      to: form.email,
      subject: `Action Required: ${form.name} Setup for ${employeeName}`,
      body: `IT Setup has been completed. Please proceed with the ${form.name} setup.\n\n` +
            `Employee: ${employeeName}\n` +
            `Assigned Email: ${assignedEmail}\n` +
            `Request ID: ${requestId}\n\n` +
            `Complete the form here:\n${formLink}`,
      formUrl: formLink,
      displayName: 'Team Group Companies - Onboarding'
    });
  });
  
  Logger.log('✓ Conditional specialist emails triggered for: ' + requestId);
}
