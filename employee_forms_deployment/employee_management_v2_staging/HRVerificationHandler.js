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
    
    const context = getWorkflowContext(workflowId);
    if (context) {
      result = {
        ...result,
        ...context,
        success: true,
        firstName: context.employeeName ? context.employeeName.split(' ')[0] : '',
        lastName: context.employeeName ? context.employeeName.split(' ').slice(1).join(' ') : '',
        position: context.jobTitle,
        jrTitle: context.jrTitle,
        siteName: context.siteName,
        hireDate: context.hireDate ? (context.hireDate instanceof Date ? Utilities.formatDate(context.hireDate, Session.getScriptTimeZone(), 'yyyy-MM-dd') : context.hireDate) : '',
        managerName: context.managerName,
        managerEmail: context.managerEmail,
        requesterEmail: context.requesterEmail,
        employmentType: context.employmentType
      };
    }
    
    if (!result.success) return result;
    
    return result;
    
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
    const managerNameCol = headers.indexOf('Manager Name');
    const managerEmailCol = headers.indexOf('Manager Email');
    const hireDateCol = headers.indexOf('Hire Date');
    const siteNameCol = headers.indexOf('Site/Office Location');
    const jrTitleCol = headers.indexOf('Position Title'); // Col 14 - Fixed header name match
    const jrAssignCol = headers.indexOf('JR Assign'); // Col 46 (Now map to jrTitle)
    
    let employmentType = '';
    let systemAccess = '';
    let requesterEmail = '';
    let adpSalaryAccess = false;
    const adpSalaryAccessCol = headers.indexOf('ADP Salary Access');

    for (let i = 1; i < mainData.length; i++) {
      if (mainData[i][0] === workflowId) {
        if (firstNameCol !== -1) mainSheet.getRange(i + 1, firstNameCol + 1).setValue(formData.firstName);
        if (lastNameCol !== -1) mainSheet.getRange(i + 1, lastNameCol + 1).setValue(formData.lastName);
        if (managerNameCol !== -1) mainSheet.getRange(i + 1, managerNameCol + 1).setValue(formData.managerName);
        if (managerEmailCol !== -1) mainSheet.getRange(i + 1, managerEmailCol + 1).setValue(formData.managerEmail);
        if (hireDateCol !== -1 && formData.hireDate) mainSheet.getRange(i + 1, hireDateCol + 1).setValue(new Date(formData.hireDate));
        if (siteNameCol !== -1) mainSheet.getRange(i + 1, siteNameCol + 1).setValue(formData.siteName);
        if (jrTitleCol !== -1) mainSheet.getRange(i + 1, jrTitleCol + 1).setValue(formData.jobTitle);
        if (jrAssignCol !== -1) mainSheet.getRange(i + 1, jrAssignCol + 1).setValue(formData.jrTitle);

        employmentType = mainData[i][9] || '';
        systemAccess = mainData[i][19] || '';
        requesterEmail = mainData[i][5] || '';
        adpSalaryAccess = adpSalaryAccessCol !== -1 && mainData[i][adpSalaryAccessCol] === 'Yes';
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
    
    // Get context and OVERRIDE verified fields from this form submission
    // This ensures downstream emails have the fresh, verified data even if sheet read is stale
    const context = getWorkflowContext(workflowId);
    if (context) {
      context.jobTitle = formData.jobTitle;           // Override Job Title
      context.jrTitle = formData.jrTitle;             // Override JR Title
      context.adpAssociateId = formData.adpAssociateId; // Inject ADP ID for context block
    }
    
    const verifiedName = formData.firstName + ' ' + formData.lastName;

    if (employmentType === 'Hourly' && systemAccess === 'No') {
      updateWorkflow(workflowId, 'Complete', 'HR Verification Complete', verifiedName, actingUser);
      syncWorkflowState(workflowId);
      const recipients = [requesterEmail];
      if (formData.managerEmail && formData.managerEmail !== requesterEmail) {
        recipients.push(formData.managerEmail);
      }

      // E5: Build Google Calendar link for hourly employee start date
      let calendarLinkHtml = '';
      if (context && context.hireDate) {
        try {
          const startDate = context.hireDate instanceof Date ? context.hireDate : new Date(context.hireDate);
          const dateStr = Utilities.formatDate(startDate, Session.getScriptTimeZone(), 'yyyyMMdd');
          const calTitle = encodeURIComponent((formData.firstName + ' ' + formData.lastName) + ' - Start Date');
          const calDetails = encodeURIComponent('Site: ' + (context.siteName || '') + ' | ADP ID: ' + formData.adpAssociateId);
          const calUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + calTitle + '&dates=' + dateStr + '/' + dateStr + '&details=' + calDetails;
          calendarLinkHtml = '<br><br><a href="' + calUrl + '" style="display:inline-block; padding:10px 20px; background:#4285f4; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:600;">📅 Add Start Date to Calendar</a>';
        } catch (calErr) {
          Logger.log('Could not build calendar link: ' + calErr.message);
        }
      }

      sendFormEmail({
        to: recipients.join(','),
        subject: 'Onboarding Complete',
        body: 'The onboarding process has been completed successfully. All required setup steps have been finished for this hourly employee.\n\n' +
              'Verified ADP ID: ' + formData.adpAssociateId + '\n\n' +
              '<strong>CREDENTIALS:</strong>\n' +
              '• DSS: ' + (context.dssUsername || 'N/A') + ' (Pwd: ' + (context.dssPassword || 'N/A') + ')\n' +
              '• SiteDocs: ' + (context.siteDocsUsername || 'N/A') + ' (Pwd: ' + (context.siteDocsPassword || 'N/A') + ')\n\n' +
              'You can view the full request details using the button below.' +
              calendarLinkHtml,
        displayName: 'TEAM Group - Employee Onboarding',
        formUrl: '',
        contextData: context
      });
      Logger.log('[SUCCESS] Completion email sent to requester & manager (Hourly/No System Access)');
    } else {
      updateWorkflow(workflowId, 'In Progress', 'IT Setup Needed', verifiedName, actingUser);
      syncWorkflowState(workflowId);
      const itUrl = buildFormUrl('it_setup', { wf: workflowId });

      // E2: CC payroll if ADP Supervisor access is required
      const systemsList = Array.isArray(context && context.systems) ? context.systems : [];
      const hasAdpSupervisor = systemsList.some(s => String(s).toLowerCase().includes('adp supervisor'));
      const itRecipients = hasAdpSupervisor ? CONFIG.EMAILS.IT + ',' + CONFIG.EMAILS.PAYROLL : CONFIG.EMAILS.IT;

      sendFormEmail({
        to: itRecipients,
        subject: 'IT Setup Required',
        body: 'HR has verified the employee details and assigned an ADP ID.\n\nPlease complete the IT setup form using the button below.',
        formUrl: itUrl,
        displayName: 'TEAM Group - Employee Onboarding',
        contextData: context
      });
      Logger.log('[SUCCESS] IT Setup email sent (Salary/System Access path)' + (hasAdpSupervisor ? ' — CC: Payroll (ADP Supervisor required)' : ''));

      // Notify payroll for salary/expedite new hires after HR verification
      const salaryAccessCallout = adpSalaryAccess
        ? '\n\n⚠️ <strong style="color:#EB1C2D;">ADP SALARY ACCESS REQUIRED</strong> — This employee has been flagged as requiring access to salary data in ADP. Please ensure the appropriate salary data permissions are granted before or on their start date.'
        : '';
      sendFormEmail({
        to: CONFIG.EMAILS.PAYROLL,
        subject: 'HR Verified' + (adpSalaryAccess ? ' — Salary Access Required' : ''),
        body: 'HR has completed verification for ' + formData.firstName + ' ' + formData.lastName + '. ADP ID assigned: ' + formData.adpAssociateId + '. IT setup is now in progress.' + salaryAccessCallout,
        formUrl: '',
        contextData: context
      });
      Logger.log('[SUCCESS] Payroll notification sent for salary new hire.' + (adpSalaryAccess ? ' (Salary access flag included)' : ''));

      // Send Safety Onboarding form (salary path fires here; hourly fires after ID Setup)
      sendSafetyOnboardingEmail(workflowId, { employeeName: verifiedName, position: formData.jobTitle, jrTitle: formData.jrTitle, siteName: formData.siteName || '', hireDate: formData.hireDate || '', employmentType: employmentType, managerName: formData.managerName }, null);
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
