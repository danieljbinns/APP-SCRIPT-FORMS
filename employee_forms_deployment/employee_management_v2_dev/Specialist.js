/**
 * Specialist Forms - Handler Functions
 */

/**
 * Business Cards: upload order confirmation file to Drive and email to manager + employee.
 * Called from ActionItemForm.html before closing the action item.
 * @param {string} taskId
 * @param {string} fileName
 * @param {string} mimeType
 * @param {string} base64Data - base64-encoded file content (no data-URL prefix)
 * @returns {{ success: boolean, driveUrl: string }}
 */
function uploadBusinessCardsFile(taskId, fileName, mimeType, base64Data) {
  try {
    const task = ActionItemService.getTask(taskId);
    if (!task) return { success: false, message: 'Task not found' };

    const workflowId = task.WorkflowID;
    const context = getWorkflowContext(workflowId) || {};
    const actingUser = Session.getActiveUser().getEmail();

    // Decode and create Drive file
    let driveUrl = '';
    let fileBlob = null;
    try {
      const bytes = Utilities.base64Decode(base64Data);
      fileBlob = Utilities.newBlob(bytes, mimeType || 'application/octet-stream', fileName);
      const safeName = 'BizCards_' + String(context.employeeName || workflowId).replace(/\s/g, '_') + '_' + fileName;
      fileBlob.setName(safeName);

      const mainFolder = DriveApp.getFolderById(CONFIG.MAIN_FOLDER_ID);
      const file = mainFolder.createFile(fileBlob);
      // Reset blob name after Drive creation (blob is consumed)
      driveUrl = file.getUrl();
      Logger.log('[BizCards] File saved to Drive: ' + driveUrl);
    } catch (dErr) {
      Logger.log('[BizCards] Drive upload failed: ' + dErr.message);
    }

    // Build recipient list: assigned email + manager + requester
    const recipients = [];
    if (context.assignedEmail)  recipients.push(context.assignedEmail);
    if (context.managerEmail && !recipients.includes(context.managerEmail))   recipients.push(context.managerEmail);
    if (context.requesterEmail && !recipients.includes(context.requesterEmail)) recipients.push(context.requesterEmail);

    if (recipients.length > 0) {
      const subject = 'Business Cards Ordered — ' + (context.employeeName || 'New Employee');
      const htmlBody = 'Business cards have been ordered for <b>' + (context.employeeName || 'your new team member') + '</b>.' +
        (driveUrl ? ' <a href="' + driveUrl + '">View order confirmation</a>.' : '') +
        '<br><br>Please check with your manager if you have questions about delivery.';

      const mailOptions = { htmlBody: htmlBody, name: 'TEAM Group - Employee Onboarding' };
      if (fileBlob) mailOptions.attachments = [fileBlob];

      GmailApp.sendEmail(recipients.join(','), subject, 'See HTML version.', mailOptions);
      Logger.log('[BizCards] Email sent to: ' + recipients.join(', '));
    }

    return { success: true, driveUrl: driveUrl };
  } catch (e) {
    Logger.log('[ERROR] uploadBusinessCardsFile: ' + e.message);
    return { success: false, message: e.message };
  }
}

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
    'review': 'Review306090',
    'safety': 'SafetyOnboarding',
    'safetyterm': 'SafetyTermination',
    'wis': 'WIS'
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
      'review': CONFIG.SHEETS.REVIEW_306090_RESULTS,
      'safety': CONFIG.SHEETS.SAFETY_ONBOARDING_RESULTS,
      'safetyterm': CONFIG.SHEETS.SAFETY_TERMINATION_RESULTS,
      'wis': 'WIS Results'
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
    
    if (dept === 'safety') {
      let details = {};
      try { details = JSON.parse(formData.details || '{}'); } catch(e) {}
      resultsSheet.appendRow([
        workflowId, formId, new Date(),
        details.siteDocsConfirmed ? 'Yes' : 'No',
        details.dssConfirmed ? 'Yes' : 'No',
        formData.notes || '', Session.getActiveUser().getEmail()
      ]);
    } else if (dept === 'safetyterm') {
      let details = {};
      try { details = JSON.parse(formData.details || '{}'); } catch(e) {}
      resultsSheet.appendRow([
        workflowId, formId, new Date(),
        details.siteDocsRemoved ? 'Yes' : 'No',
        details.bossDeactivated ? 'Yes' : 'No',
        formData.notes || '', Session.getActiveUser().getEmail()
      ]);
    } else {
      resultsSheet.appendRow([
        workflowId, formId, new Date(),
        formData.details || JSON.stringify(formData), formData.notes || '', Session.getActiveUser().getEmail()
      ]);
    }

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
    
    // Notify Requester — skipped for safety/safetyterm (rolled into workflow complete email)
    if (dept !== 'safety' && dept !== 'safetyterm') {
      try {
        let requesterEmail = null;
        let employeeName = 'Employee';

        if (typeof getITContextData === 'function') {
          const ctx = getITContextData(workflowId);
          if (ctx.success) {
            requesterEmail = ctx.requesterEmail;
            employeeName = ctx.employeeName;
          }
        }

        const recipients = [];
        if (requesterEmail) recipients.push(requesterEmail);

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
          if (dept === 'creditcard') { friendlyDept = 'Credit Card'; }

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
