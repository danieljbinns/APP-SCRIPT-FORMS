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
          jrTitle: mainData[i][46] || '', // Col 46 is JR Assign
          siteName: mainData[i][15] || '',
          hireDate: mainData[i][6] ? Utilities.formatDate(new Date(mainData[i][6]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
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
          result.siteDocsUsername = idData[j][6];
          result.siteDocsPassword = idData[j][7];
          result.dssUsername = idData[j][8];
          result.dssPassword = idData[j][9];
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
    const siteNameCol = headers.indexOf('Site/Office Location');
    const jrTitleCol = headers.indexOf('Position Title'); // Col 14 - Fixed header name match
    const jrAssignCol = headers.indexOf('JR Assign'); // Col 46 (Now map to jrTitle)
    
    let employmentType = '';
    let systemAccess = '';
    let requesterEmail = '';
    
    for (let i = 1; i < mainData.length; i++) {
      if (mainData[i][0] === workflowId) {
        if (firstNameCol !== -1) mainSheet.getRange(i + 1, firstNameCol + 1).setValue(formData.firstName);
        if (lastNameCol !== -1) mainSheet.getRange(i + 1, lastNameCol + 1).setValue(formData.lastName);
        if (managerNameCol !== -1) mainSheet.getRange(i + 1, managerNameCol + 1).setValue(formData.managerName);
        if (managerEmailCol !== -1) mainSheet.getRange(i + 1, managerEmailCol + 1).setValue(formData.managerEmail);
        if (siteNameCol !== -1) mainSheet.getRange(i + 1, siteNameCol + 1).setValue(formData.siteName);
        if (jrTitleCol !== -1) mainSheet.getRange(i + 1, jrTitleCol + 1).setValue(formData.jobTitle);
        if (jrAssignCol !== -1) mainSheet.getRange(i + 1, jrAssignCol + 1).setValue(formData.jrTitle);
        
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
      formData.managerName, formData.managerEmail, 
      formData.jobTitle + ' / ' + formData.jrTitle, // Store combined in verification results logs
      formData.notes || '', Session.getActiveUser().getEmail()
    ]);
    
    const actingUser = Session.getActiveUser().getEmail();
    
    // CRITICAL: Ensure sheet updates are committed before reading context/sending email
    SpreadsheetApp.flush();
    
    // Get context and OVERRIDE job title with the verified one from this form submission
    // This ensures downstream emails have the fresh, verified data even if sheet read is stale
    const context = getWorkflowContext(workflowId);
    if (context) {
      context.jobTitle = formData.jobTitle; // Override Job Title
      context.jrTitle = formData.jrTitle;   // Override JR Title
    }
    
    // Parse IT Requirements from system access string
    // IT is needed if: System Access is "Yes" AND they requested an Email, Computer, Phone, BOSS, or specific apps
    const needsIT = systemAccess === 'Yes' && (
      (context.googleEmail && context.googleEmail !== '') ||
      (context.equipment && (context.equipment.includes('Computer') || context.equipment.includes('Phone'))) ||
      (context.systems && (context.systems.includes('BOSS') || context.systems.includes('Delivery App') || context.systems.includes('Net Promoter')))
    );
    
    // Check if they need Specialists (Jonas, CC, Fleetio, Business Cards, or just the standard SiteDocs/306090)
    // For Salary/System Access employees, they always go to Specialists even if IT is skipped
    const needsSpecialists = (employmentType !== 'Hourly' || systemAccess === 'Yes');
    
    if (employmentType === 'Hourly' && systemAccess === 'No') {
      updateWorkflow(workflowId, 'Complete', 'HR Verification Complete', '', actingUser);
      const recipients = [requesterEmail];
      if (formData.managerEmail && formData.managerEmail !== requesterEmail) {
        recipients.push(formData.managerEmail);
      }
      
      sendFormEmail({
        to: recipients.join(','),
        subject: 'Onboarding Complete - ' + (formData.firstName + ' ' + formData.lastName) + ' (ADP: ' + formData.adpAssociateId + ')',
        // Include credentials in the completion email
        body: 'The onboarding process has been completed successfully. All required setup steps have been finished for this hourly employee.\n\n' +
              'Verified ADP ID: ' + formData.adpAssociateId + '\n\n' +
              '<strong>CREDENTIALS:</strong>\n' +
              '• DSS: ' + (context.dssUsername || 'N/A') + ' (Pwd: ' + (context.dssPassword || 'N/A') + ')\n' +
              '• SiteDocs: ' + (context.siteDocsUsername || 'N/A') + ' (Pwd: ' + (context.siteDocsPassword || 'N/A') + ')\n\n' +
              'You can view the full request details using the dashboard.',
        displayName: 'TEAM Group - Employee Onboarding',
        // Update URL to request details - REMOVED BUTTON as per user request
        formUrl: '', 
        contextData: context
      });
      Logger.log('[SUCCESS] Completion email sent to requester & manager (Hourly/No System Access)');
    } else if (!needsIT) {
      // Bypass IT Setup entirely and go straight to Specialists
      updateWorkflow(workflowId, 'In Progress', 'Specialist Forms Needed', '', actingUser);
      Logger.log(`[INFO] Skipping IT Setup for ${workflowId} (No IT items requested). Triggering Specialists directly.`);
      
      // We need to write a dummy row to IT Results so the dashboard flight-check sees IT as "N/A" rather than "Pending"
      const itSheet = ss.getSheetByName(CONFIG.SHEETS.IT_RESULTS);
      if (itSheet) {
          itSheet.appendRow([
              workflowId, 'SKIPPED', new Date(), 'N/A', 'N/A', 'N/A', 
              'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A',
              'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'Auto-skipped (No IT required)', 'System'
          ]);
      }
      
      // Call the triggerSpecialists function (must be available in the scope, defined in ITSetupHandler.gs)
      // Pass a dummy itData object with N/A values so the specialist emails don't break
      const dummyItData = {
          Email_Username: '',
          Email_Domain: '',
          Email_Temp_Password: 'N/A',
          Computer_Assigned: 'N/A',
          Computer_Serial: 'N/A',
          Computer_Type: 'N/A',
          Phone_Assigned: 'N/A',
          Phone_Number: 'N/A',
          Phone_VM_Password: 'N/A'
      };
      
      triggerSpecialists(workflowId, dummyItData);
      
      // Also notify the requester that the core setup is done (since IT normally does this)
      const recipients = [requesterEmail];
      if (context.managerEmail && context.managerEmail !== requesterEmail) {
         recipients.push(context.managerEmail);
      }
      if (recipients.length > 0) {
         sendFormEmail({
             to: recipients.join(','),
             subject: 'Core Setup Complete: ' + context.employeeName,
             body: `Good news! Core Setup has been completed for ${context.employeeName}. No IT hardware or email was requested.\n\n` +
                   `<strong>CREDENTIALS:</strong>\n` +
                   `• DSS: ${context.dssUsername || 'N/A'} (Pwd: ${context.dssPassword || 'N/A'})\n` +
                   `• SiteDocs: ${context.siteDocsUsername || 'N/A'} (Pwd: ${context.siteDocsPassword || 'N/A'})\n` + 
                   `• SiteDocs Worker ID: ${context.siteDocsWorkerId || 'N/A'}\n\n` +
                   `Specialist requests (30/60/90, Jonas, etc.) have been triggered.`,
             formUrl: '',
             displayName: 'Onboarding System'
         });
      }
      
    } else {
      updateWorkflow(workflowId, 'In Progress', 'IT Setup Needed', '', actingUser);
      const itUrl = buildFormUrl('it_setup', { wf: workflowId });
      sendFormEmail({
        to: CONFIG.EMAILS.IT,
        subject: 'HR Verified: IT Setup Required',
        body: 'HR has verified the employee details and assigned an ADP ID.\n\nPlease complete the IT setup form using the link below.',
        formUrl: itUrl,
        displayName: 'TEAM Group - Employee Onboarding',
        contextData: context
      });
      Logger.log('[SUCCESS] IT Setup email sent (Salary/System Access path)');
    }
    
    // Asynchronously update the Dashboard View
    try {
      syncWorkflowState(workflowId);
    } catch(syncErr) {
      Logger.log('Warning: Failed to sync view for ' + workflowId);
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
