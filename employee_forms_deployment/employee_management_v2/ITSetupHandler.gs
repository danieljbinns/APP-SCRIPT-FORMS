/**
 * IT Setup Form - Handler Functions  
 */

function serveITSetup(workflowId) {
  if (!workflowId) {
    return HtmlService.createHtmlOutput('<h1>Error: No workflow ID provided</h1>');
  }
  
  const template = HtmlService.createTemplateFromFile('ITSetup');
  template.workflowId = workflowId;
  template.formId = '';
  template.requestData = getITContextData(workflowId);
  template.employeeName = template.requestData.employeeName;
  
  return template.evaluate()
    .setTitle('IT Setup')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getITContextData(workflowId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const mainSheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
    const idSetupSheet = ss.getSheetByName(CONFIG.SHEETS.ID_SETUP_RESULTS);
    
    const mainData = mainSheet.getDataRange().getValues();
    let context = { success: false, message: 'Workflow ID not found' };
    
    for (let i = 1; i < mainData.length; i++) {
      if (mainData[i][0] === workflowId) {
        context = {
          success: true,
          employeeName: mainData[i][10] + ' ' + mainData[i][12],
          firstName: mainData[i][10],
          lastName: mainData[i][12],
          hireDate: mainData[i][6],
          position: mainData[i][14],
          siteName: mainData[i][15],
          managerName: mainData[i][18],
          employmentType: mainData[i][9],
          emailRequested: mainData[i][19]
        };
        break;
      }
    }
    
    if (!context.success) return context;
    
    if (idSetupSheet) {
      const idData = idSetupSheet.getDataRange().getValues();
      for (let j = 1; j < idData.length; j++) {
        if (idData[j][0] === workflowId) {
          context.internalEmployeeId = idData[j][3];
          context.siteDocsWorkerId = idData[j][4];
          context.dssUsername = idData[j][8];
          break;
        }
      }
    }
    
    return context;
    
  } catch (error) {
    return { success: false, message: error.message };
  }
}

function submitITSetup(formData) {
  try {
    const workflowId = formData.workflowId || formData.requestId;
    const formId = generateFormId('IT_SETUP');
    Logger.log('IT Setup submitted for: ' + workflowId);
    
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let itSheet = ss.getSheetByName(CONFIG.SHEETS.IT_RESULTS);
    
    if (!itSheet) {
      itSheet = ss.insertSheet(CONFIG.SHEETS.IT_RESULTS);
      itSheet.appendRow([
        'Workflow ID', 'Form ID', 'Submission Timestamp', 'Email Created', 'Assigned Email', 'Email Password',
        'Computer Assigned', 'Computer Make', 'Computer Model', 'Computer Type',
        'Phone Assigned', 'Phone Carrier', 'Phone Model', 'Phone Number', 'Phone VM Password',
        'BOSS Access', 'Incidents Access', 'CAA Access', 'Delivery App Access', 'Net Promoter Access',
        'IT Notes', 'Submitted By'
      ]);
      itSheet.getRange(1, 1, 1, 22).setFontWeight('bold').setBackground('#EB1C2D').setFontColor('#ffffff');
    }
    
    const assignedEmail = formData.Email_Username ? (formData.Email_Username + formData.Email_Domain) : 'N/A';
    
    itSheet.appendRow([
      workflowId, formId, new Date(), formData.Email_Created, assignedEmail, formData.Email_Temp_Password || 'N/A',
      formData.Computer_Assigned, formData.Computer_Make || 'N/A', formData.Computer_Model || 'N/A', formData.Computer_Type || 'N/A',
      formData.Phone_Assigned, formData.Phone_Carrier || 'N/A', formData.Phone_Model || 'N/A', formData.Phone_Number || 'N/A', formData.Phone_VM_Password || 'N/A',
      formData.BOSS_Access, formData.Incidents_Access, formData.CAA_Access, formData.Delivery_App_Access, formData.Net_Promoter_Score_Access,
      formData.IT_Notes || '', Session.getActiveUser().getEmail()
    ]);
    
    updateWorkflow(workflowId, 'In Progress', 'Specialist Forms Needed');
    
    triggerSpecialists(workflowId, formData);
    
    return {
      success: true,
      message: 'IT Setup results saved successfully'
    };
    
  } catch (error) {
    Logger.log('[ERROR] IT Setup error: ' + error.toString());
    return { success: false, message: error.message };
  }
}

function triggerSpecialists(workflowId, itData) {
  const specialists = [
    { email: CONFIG.EMAILS.CREDIT_CARD, name: 'Credit Card', param: 'creditcard' },
    { email: CONFIG.EMAILS.BUSINESS_CARDS, name: 'Business Cards', param: 'businesscards' },
    { email: CONFIG.EMAILS.FLEETIO, name: 'Fleetio', param: 'fleetio' },
    { email: CONFIG.EMAILS.REVIEW_306090_JR, name: '30/60/90 & JR', param: 'review' },
    { email: CONFIG.EMAILS.JONAS, name: 'JONAS', param: 'jonas' },
    { email: CONFIG.EMAILS.SITEDOCS, name: 'SiteDocs', param: 'sitedocs' }
  ];
  
  const assignedEmail = itData.Email_Username ? (itData.Email_Username + itData.Email_Domain) : '[Pending]';
  
  specialists.forEach(spec => {
    const specUrl = buildFormUrl('specialist', { wf: workflowId, dept: spec.param });
    sendFormEmail({
      to: spec.email,
      subject: 'Action Required: ' + spec.name + ' Setup',
      body: 'IT Setup has been completed.\\n\\nEmployee Email: ' + assignedEmail + '\\nWorkflow ID: ' + workflowId + '\\n\\nPlease complete the ' + spec.name + ' setup form.',
      formUrl: specUrl,
      displayName: 'Team Group Companies - Onboarding'
    });
  });
  
  Logger.log('[SUCCESS] Specialist emails sent for: ' + workflowId + ' (ADP removed - now in HR Verification)');
}
