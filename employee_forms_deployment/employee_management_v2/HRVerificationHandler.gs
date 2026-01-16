/**
 * HR Verification Form - Handler Functions
 */

function serveHRVerification(workflowId) {
  if (!workflowId) {
    return HtmlService.createHtmlOutput('<h1>Error: No workflow ID provided</h1>');
  }
  
  const template = HtmlService.createTemplateFromFile('HRVerification');
  template.workflowId = workflowId;
  template.formId = '';
  template.requestData = getHRVerificationData(workflowId);
  
  return template.evaluate()
    .setTitle('HR Verification & ADP')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getHRVerificationData(workflowId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const mainSheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
    const idSheet = ss.getSheetByName(CONFIG.SHEETS.ID_SETUP_RESULTS);
    
    const mainData = mainSheet.getDataRange().getValues();
    let result = { success: false, message: 'Workflow ID not found' };
    
    for (let i = 1; i < mainData.length; i++) {
      if (mainData[i][0] === workflowId) {
        result = {
          success: true,
          workflowId: workflowId,
          firstName: mainData[i][10] || '',
          lastName: mainData[i][12] || '',
          position: mainData[i][14] || '',
          siteName: mainData[i][15] || '',
          hireDate: mainData[i][6] || '',
          managerName: mainData[i][18] || '',
          managerEmail: mainData[i][17] || '',
          employmentType: mainData[i][9] || '',
          internalEmployeeId: ''
        };
        break;
      }
    }
    
    if (!result.success) return result;
    
    if (idSheet) {
      const idData = idSheet.getDataRange().getValues();
      for (let j = 1; j < idData.length; j++) {
        if (idData[j][0] === workflowId) {
          result.internalEmployeeId = idData[j][3] || 'PENDING';
          break;
        }
      }
    }
    
    return JSON.parse(JSON.stringify(result));
    
  } catch (error) {
    Logger.log('Error fetching verification data: ' + error.toString());
    return { success: false, message: error.message };
  }
}

function submitHRVerification(formData) {
  try {
    const workflowId = formData.workflowId;
    const formId = generateFormId('HR_VERIF');
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    
    const mainSheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
    const mainData = mainSheet.getDataRange().getValues();
    const headers = mainData[0];
    
    const firstNameCol = headers.indexOf('First Name');
    const lastNameCol = headers.indexOf('Last Name');
    const managerNameCol = headers.indexOf('Reporting Manager Name');
    const managerEmailCol = headers.indexOf('Reporting Manager Email');
    const jrTitleCol = headers.indexOf('Position/JR Title');
    
    let employmentType = '';
    let systemAccess = '';
    let requesterEmail = '';
    
    for (let i = 1; i < mainData.length; i++) {
      if (mainData[i][0] === workflowId) {
        if (firstNameCol !== -1) mainSheet.getRange(i + 1, firstNameCol + 1).setValue(formData.firstName);
        if (lastNameCol !== -1) mainSheet.getRange(i + 1, lastNameCol + 1).setValue(formData.lastName);
        if (managerNameCol !== -1) mainSheet.getRange(i + 1, managerNameCol + 1).setValue(formData.managerName);
        if (managerEmailCol !== -1) mainSheet.getRange(i + 1, managerEmailCol + 1).setValue(formData.managerEmail);
        if (jrTitleCol !== -1) mainSheet.getRange(i + 1, jrTitleCol + 1).setValue(formData.jrTitle);
        
        employmentType = mainData[i][9] || '';
        systemAccess = mainData[i][19] || '';
        requesterEmail = mainData[i][5] || '';
        break;
      }
    }
    
    let resultsSheet = ss.getSheetByName(CONFIG.SHEETS.HR_VERIFICATION_RESULTS);
    if (!resultsSheet) {
      resultsSheet = ss.insertSheet(CONFIG.SHEETS.HR_VERIFICATION_RESULTS);
      resultsSheet.appendRow([
        'Workflow ID', 'Form ID', 'Submission Timestamp', 'ADP Associate ID',
        'Verified Name', 'Verified Manager', 'Verified Manager Email',
        'Verified JR Title', 'Notes', 'Submitted By'
      ]);
      resultsSheet.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#EB1C2D').setFontColor('#ffffff');
    }
    
    resultsSheet.appendRow([
      workflowId, formId, new Date(), formData.adpAssociateId,
      formData.firstName + ' ' + formData.lastName,
      formData.managerName, formData.managerEmail, formData.jrTitle,
      formData.notes || '', Session.getActiveUser().getEmail()
    ]);
    
    if (employmentType === 'Hourly' && systemAccess === 'No') {
      updateWorkflow(workflowId, 'Complete', 'HR Verification Complete');
      sendFormEmail({
        to: requesterEmail,
        subject: 'Employee Onboarding Complete - ' + formData.firstName + ' ' + formData.lastName,
        body: 'Employee onboarding has been completed.\\n\\nEmployee: ' + formData.firstName + ' ' + formData.lastName + '\\nADP ID: ' + formData.adpAssociateId + '\\nPosition: ' + formData.jrTitle + '\\nWorkflow ID: ' + workflowId + '\\n\\nAll required setup steps have been completed for this hourly employee.',
        displayName: 'Team Group Companies - Employee Onboarding'
      });
      Logger.log('[SUCCESS] Completion email sent to requester (Hourly/No System Access)');
    } else {
      updateWorkflow(workflowId, 'In Progress', 'IT Setup Needed');
      const itUrl = buildFormUrl('it_setup', { wf: workflowId });
      sendFormEmail({
        to: CONFIG.EMAILS.IT,
        subject: 'HR Verified: IT Setup Required - ' + formData.firstName + ' ' + formData.lastName,
        body: 'HR has verified the details and assigned an ADP ID.\\n\\nEmployee: ' + formData.firstName + ' ' + formData.lastName + '\\nADP ID: ' + formData.adpAssociateId + '\\nPosition: ' + formData.jrTitle + '\\nWorkflow ID: ' + workflowId + '\\n\\nPlease complete the IT setup form.',
        formUrl: itUrl,
        displayName: 'Team Group Companies - Employee Onboarding'
      });
      Logger.log('[SUCCESS] IT Setup email sent (Salary/System Access path)');
    }
    
    return {
      success: true,
      message: 'HR Verification and ADP ID setup completed successfully.'
    };
    
  } catch (error) {
    Logger.log('Error submitting HR verification: ' + error.toString());
    return { success: false, message: error.message };
  }
}
