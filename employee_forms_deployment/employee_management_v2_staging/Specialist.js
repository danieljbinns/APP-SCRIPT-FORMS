/**
 * Specialist Forms - Handler Functions
 */

function serveSpecialist(workflowId, dept) {
  if (!workflowId) {
    return HtmlService.createHtmlOutput('<h1>Error: No workflow ID provided</h1>');
  }
  
  const deptMap = {
    'creditcard': 'CreditCard',
    'businesscards': 'BusinessCards',
    'fleetio': 'Fleetio',
    'jonas': 'Jonas',
    'centralpurchasing': 'CentralPurchasing',
    'sitedocs': 'SiteDocs',
    'review': 'Review306090'
  };
  
  const htmlFile = deptMap[dept] || 'Placeholder';
  const template = HtmlService.createTemplateFromFile(htmlFile);
  template.workflowId = workflowId;
  template.formId = '';
  template.department = dept || 'general';
  
  // Reuse IT Context Logic to get full request details for specialist forms
  // This allows specialist forms to show employee details header properly
  let requestData = {};
  if (typeof getITContextData === 'function') {
    requestData = getITContextData(workflowId);
    if (typeof getWorkflowContext === 'function') {
      const wfContext = getWorkflowContext(workflowId);
      if (wfContext) {
        requestData = Object.assign({}, requestData, wfContext);
      }
    }
  } else {
    // Fallback if IT function not available in this scope (should act as library)
    requestData = { employeeName: 'Loading...' }; 
  }
  template.requestData = requestData;
  
  return template.evaluate()
    .setTitle('Specialist Setup - ' + dept)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function submitSpecialistForm(formData) {
  try {
    const workflowId = formData.workflowId;
    const dept = formData.department;
    const formId = generateFormId('SPEC_' + dept.toUpperCase());
    
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    
    // Determine which sheet to use based on department
    const sheetMap = {
      'creditcard': CONFIG.SHEETS.CREDIT_CARD_RESULTS,
      'businesscards': CONFIG.SHEETS.BUSINESS_CARDS_RESULTS,
      'fleetio': CONFIG.SHEETS.FLEETIO_RESULTS,
      'jonas': CONFIG.SHEETS.JONAS_RESULTS,
      'centralpurchasing': CONFIG.SHEETS.CENTRAL_PURCHASING_RESULTS,
      'sitedocs': CONFIG.SHEETS.SITEDOCS_RESULTS,
      'review': CONFIG.SHEETS.REVIEW_306090_RESULTS
    };
    
    const sheetName = sheetMap[dept] || 'Specialist Results';
    let resultsSheet = ss.getSheetByName(sheetName);
    
    if (!resultsSheet) {
      resultsSheet = ss.insertSheet(sheetName);
      resultsSheet.appendRow([
        'Workflow ID', 'Form ID', 'Submission Timestamp',
        'Details', 'Notes', 'Submitted By'
      ]);
      resultsSheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#EB1C2D').setFontColor('#ffffff');
    }
    
    resultsSheet.appendRow([
      workflowId, formId, new Date(),
      formData.details || JSON.stringify(formData), formData.notes || '', Session.getActiveUser().getEmail()
    ]);

    // 30/60/90: write confirmed JR title back to HR verification results so
    // getWorkflowContext picks up the authoritative value for all downstream emails/dashboard
    if (dept === 'review' && formData.jrTitle) {
      try {
        const hrSheet = ss.getSheetByName(CONFIG.SHEETS.HR_VERIFICATION_RESULTS);
        if (hrSheet) {
          const hrData = hrSheet.getDataRange().getValues();
          for (let i = 1; i < hrData.length; i++) {
            if (hrData[i][0] === workflowId) {
              // Col H (index 7) stores "Job Title / JR Title" — preserve job title, update JR
              const existing = String(hrData[i][7] || '');
              const jobTitle = existing.includes(' / ') ? existing.split(' / ')[0].trim() : existing;
              hrSheet.getRange(i + 1, 8).setValue(jobTitle + ' / ' + formData.jrTitle);
              Logger.log('[30/60/90] Confirmed JR title written back: ' + formData.jrTitle);
              break;
            }
          }
        }
      } catch (jrErr) {
        Logger.log('[30/60/90] Error writing back JR title: ' + jrErr.toString());
      }
    }

    Logger.log('[SUCCESS] Specialist form submitted: ' + dept + ' for ' + workflowId);
    
    // Notify Requester
    try {
        // We need to fetch requester email. 
        // Reuse getITContextData logic if available since we don't have it passed in formData
        let requesterEmail = null;
        let employeeName = 'Employee';
        
        if (typeof getITContextData === 'function') {
           const ctx = getITContextData(workflowId);
           if (ctx.success) {
             requesterEmail = ctx.requesterEmail; // Fixed: Use true Requester Email, not new user email
             employeeName = ctx.employeeName;
           }
        }
        
        const recipients = [];
        if (requesterEmail) recipients.push(requesterEmail);
        
        // Try to get manager email from IT Context if possible
        let managerEmail = null;
        if (typeof getITContextData === 'function') {
           const ctx = getITContextData(workflowId);
           if (ctx.success && ctx.managerEmail) {
              managerEmail = ctx.managerEmail;
           }
        }
        if (managerEmail && managerEmail !== requesterEmail) recipients.push(managerEmail);

        if (recipients.length > 0) {
             let friendlyDept = dept.charAt(0).toUpperCase() + dept.slice(1);
             if (dept === 'creditcard') { friendlyDept = 'Credit Card'; } // Fix space

             var specContext = (typeof getWorkflowContext === 'function') ? (getWorkflowContext(workflowId) || {}) : {};

             sendFormEmail({
               to: recipients.join(','),
               subject: friendlyDept + ' Setup Complete',
               body: friendlyDept + ' setup has been completed for ' + employeeName + '.\n\nNotes: ' + (formData.notes || 'None') + '\n\n',
               formUrl: '',
               displayName: 'Onboarding System',
               contextData: specContext
             });
        }
    } catch (e) {
      Logger.log('Error notifying requester for specialist: ' + e.toString());
    }
    
    return {
      success: true,
      message: 'Specialist setup completed successfully'
    };
    
  } catch (error) {
    Logger.log('[ERROR] Specialist form error: ' + error.toString());
    return { success: false, message: error.message };
  }
}
