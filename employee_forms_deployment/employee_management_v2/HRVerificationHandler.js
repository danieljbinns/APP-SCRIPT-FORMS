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
      // Look up jrRequired from the Initial Requests sheet
      const IR = SCHEMA.INITIAL_REQUESTS;
      var jrRequired = 'No';
      try {
        for (var ri = SCHEMA.ROW.FIRST_DATA; ri < mainData.length; ri++) {
          if (mainData[ri][IR.WORKFLOW_ID] === workflowId) {
            jrRequired = mainData[ri][IR.JR_REQUIRED] || 'No';
            break;
          }
        }
      } catch(e) { /* leave as No */ }

      result = {
        ...result,
        ...context,
        success: true,
        position: context.jobTitle,
        jrRequired: jrRequired
      };
    }
    
    if (!result.success) return result;

    // Check for existing submission — populate edit-mode data if found
    const hrResultsSheet = ss.getSheetByName(CONFIG.SHEETS.HR_VERIFICATION_RESULTS);
    if (hrResultsSheet) {
      const hrData = hrResultsSheet.getDataRange().getValues();
      const HR = SCHEMA.HR_VERIFICATION_RESULTS;
      for (let i = SCHEMA.ROW.FIRST_DATA; i < hrData.length; i++) {
        if (String(hrData[i][HR.WORKFLOW_ID]) === workflowId && String(hrData[i][HR.FORM_ID]) !== 'DATE_CHANGE') {
          const submittedAt = hrData[i][HR.SUBMISSION_TS] instanceof Date
            ? Utilities.formatDate(hrData[i][HR.SUBMISSION_TS], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
            : String(hrData[i][HR.SUBMISSION_TS] || '');
          const combined = String(hrData[i][HR.VERIFIED_JR_TITLE] || ''); // "Job Title / JR Title"
          result.isEdit = true;
          result.previousData = {
            adpAssociateId: String(hrData[i][HR.ADP_ASSOCIATE_ID] || ''),
            verifiedName:   String(hrData[i][HR.VERIFIED_NAME] || ''),
            managerName:    String(hrData[i][HR.VERIFIED_MANAGER] || ''),
            managerEmail:   String(hrData[i][HR.VERIFIED_MANAGER_EMAIL] || ''),
            jobTitle:  combined.includes(' / ') ? combined.split(' / ')[0].trim() : combined,
            jrTitle:   combined.includes(' / ') ? combined.split(' / ').slice(1).join(' / ').trim() : '',
            notes:      String(hrData[i][HR.NOTES] || ''),
            submittedBy: String(hrData[i][HR.SUBMITTED_BY] || ''),
            submittedAt: submittedAt
          };
          // Pre-populate ADP ID so the form field picks it up
          result.adpAssociateId = result.previousData.adpAssociateId;
          break;
        }
      }
    }

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
    const IR = SCHEMA.INITIAL_REQUESTS;
    const HR = SCHEMA.HR_VERIFICATION_RESULTS;

    // Detect existing submission for update-vs-insert logic
    let existingHRRowIndex = -1;
    let existingHRRowData = null;
    const existingResultsSheet = ss.getSheetByName(CONFIG.SHEETS.HR_VERIFICATION_RESULTS);
    if (existingResultsSheet) {
      const existingData = existingResultsSheet.getDataRange().getValues();
      for (let ei = SCHEMA.ROW.FIRST_DATA; ei < existingData.length; ei++) {
        if (String(existingData[ei][HR.WORKFLOW_ID]) === workflowId && String(existingData[ei][HR.FORM_ID]) !== 'DATE_CHANGE') {
          existingHRRowIndex = ei + 1; // 1-based sheet row
          existingHRRowData = existingData[ei];
          break;
        }
      }
    }

    let employmentType = '';
    let systemAccess = '';
    let requesterEmail = '';
    let adpSalaryAccess = false;
    let originalHireDate = '';
    let hrOriginal = null;

    for (let i = SCHEMA.ROW.FIRST_DATA; i < mainData.length; i++) {
      if (mainData[i][IR.WORKFLOW_ID] === workflowId) {
        // Capture original hire date before overwriting (for audit trail)
        const rawOrig = mainData[i][IR.HIRE_DATE];
        originalHireDate = rawOrig instanceof Date
          ? Utilities.formatDate(rawOrig, Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : String(rawOrig || '').substring(0, 10);

        // Capture all original values for change detection BEFORE any writes
        hrOriginal = {
          firstName:    String(mainData[i][IR.FIRST_NAME]    || ''),
          lastName:     String(mainData[i][IR.LAST_NAME]     || ''),
          hireDate:     originalHireDate,
          siteName:     String(mainData[i][IR.SITE_NAME]     || ''),
          department:   String(mainData[i][IR.DEPARTMENT]    || ''),
          managerName:  String(mainData[i][IR.MANAGER_NAME]  || ''),
          managerEmail: String(mainData[i][IR.MANAGER_EMAIL] || ''),
          jobTitle:     String(mainData[i][IR.POSITION_TITLE]|| ''),
          jrTitle:      String(mainData[i][IR.JR_ASSIGNMENT] || '')
        };

        mainSheet.getRange(i + 1, IR.FIRST_NAME     + 1).setValue(formData.firstName);
        mainSheet.getRange(i + 1, IR.LAST_NAME      + 1).setValue(formData.lastName);
        mainSheet.getRange(i + 1, IR.MANAGER_NAME   + 1).setValue(formData.managerName);
        mainSheet.getRange(i + 1, IR.MANAGER_EMAIL  + 1).setValue(formData.managerEmail);
        if (formData.hireDate) mainSheet.getRange(i + 1, IR.HIRE_DATE + 1).setValue(new Date(formData.hireDate + 'T12:00:00'));
        mainSheet.getRange(i + 1, IR.SITE_NAME      + 1).setValue(formData.siteName);
        mainSheet.getRange(i + 1, IR.POSITION_TITLE + 1).setValue(formData.jobTitle);
        mainSheet.getRange(i + 1, IR.JR_ASSIGNMENT  + 1).setValue(formData.jrTitle);
        if (formData.department !== undefined) mainSheet.getRange(i + 1, IR.DEPARTMENT + 1).setValue(formData.department);

        employmentType = mainData[i][IR.EMPLOYMENT_TYPE]  || '';
        systemAccess   = mainData[i][IR.SYSTEM_ACCESS]    || '';
        requesterEmail = mainData[i][IR.REQUESTER_EMAIL]  || '';
        adpSalaryAccess = mainData[i][IR.ADP_SALARY_ACCESS] === 'Yes';
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
    
    // Build notes — flag if hire date was changed during verification
    const actingUser = Session.getActiveUser().getEmail();

    let verificationNotes = formData.notes || '';
    if (formData.hireDate && originalHireDate && formData.hireDate !== originalHireDate) {
      const dateChangeFlag = '[START DATE CHANGED: ' + originalHireDate + ' → ' + formData.hireDate + ']';
      verificationNotes = dateChangeFlag + (verificationNotes ? ' | ' + verificationNotes : '');
      Logger.log('[HR Verification] ' + dateChangeFlag + ' for workflow ' + workflowId);
    }

    const hrResultRow = [
      workflowId, formId, new Date(), formData.adpAssociateId,
      formData.firstName + ' ' + formData.lastName,
      formData.managerName, formData.managerEmail,
      formData.jobTitle + ' / ' + formData.jrTitle,
      verificationNotes, actingUser
    ];

    if (existingHRRowIndex !== -1 && existingResultsSheet) {
      // UPDATE existing row in-place — do NOT re-fire workflow transitions or emails
      existingResultsSheet.getRange(existingHRRowIndex, 1, 1, hrResultRow.length).setValues([hrResultRow]);
      logFormEdit(workflowId, 'HR Verification', actingUser, existingHRRowData, hrResultRow);
      Logger.log('[HR Verification] Updated existing row for ' + workflowId + ' by ' + actingUser);
      SpreadsheetApp.flush();
      return {
        success: true,
        message: 'HR Verification updated successfully. No downstream emails re-sent.'
      };
    } else {
      resultsSheet.appendRow(hrResultRow);
    }
    
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

    // Change detection — notify downstream teams if any fields were modified vs. original request
    if (hrOriginal) {
      const hrSubmitted = {
        firstName:    formData.firstName    || '',
        lastName:     formData.lastName     || '',
        hireDate:     formData.hireDate     || '',
        siteName:     formData.siteName     || '',
        department:   formData.department   || '',
        managerName:  formData.managerName  || '',
        managerEmail: formData.managerEmail || '',
        jobTitle:     formData.jobTitle     || '',
        jrTitle:      formData.jrTitle      || ''
      };
      const hrChanges = diffFormFields(hrOriginal, hrSubmitted, CHANGE_FIELDS_HR_VERIFICATION);
      if (hrChanges.length > 0) {
        const safetyTriggers  = ['hireDate', 'jobTitle', 'siteName', 'jrTitle'];
        const idSetupTriggers = ['firstName', 'lastName', 'hireDate', 'jobTitle'];
        sendChangeNotifications(workflowId, 'HR Verification', hrChanges, context, {
          requesterEmail: requesterEmail,
          managerEmail:   formData.managerEmail || '',
          notifySafety:   hrChanges.some(function(c) { return safetyTriggers.indexOf(c.field)  !== -1; }),
          notifyIdSetup:  hrChanges.some(function(c) { return idSetupTriggers.indexOf(c.field) !== -1; })
        });
      }
    }

    const verifiedName = formData.firstName + ' ' + formData.lastName;

    if (employmentType === 'Hourly' && systemAccess === 'No') {
      updateWorkflow(workflowId, 'Complete', 'HR Verification Complete', verifiedName, actingUser);
      syncWorkflowState(workflowId);
      const recipients = [requesterEmail];
      if (formData.managerEmail && formData.managerEmail !== requesterEmail) {
        recipients.push(formData.managerEmail);
      }

      sendFormEmail({
        to: recipients.join(','),
        subject: 'Onboarding Complete',
        body: 'The onboarding process has been completed successfully. All required setup steps have been finished for this hourly employee.',
        displayName: 'TEAM Group - Employee Onboarding',
        formUrl: '',
        contextData: context,
        emailOpts: { showPasswords: true, calendarDate: context.hireDate }
      });
      Logger.log('[SUCCESS] Completion email sent to requester & manager (Hourly/No System Access)');
    } else {
      const systems = context.systems;
      const hasBOSSAccess = Array.isArray(systems) ? systems.includes('BOSS') : String(systems || '').includes('BOSS');

      if (hasBOSSAccess) {
        updateWorkflow(workflowId, 'In Progress', 'IT Confirmation Needed', verifiedName, actingUser);
        syncWorkflowState(workflowId);
        const itConfirmationUrl = buildFormUrl('it_confirmation', { wf: workflowId });
        sendFormEmail({
          to: 'davelangohr@team-group.com',
          subject: 'IT Confirmation Required — ' + verifiedName,
          body: 'HR has verified ' + verifiedName + '. Please review and confirm the access configuration before IT proceeds with provisioning.',
          formUrl: itConfirmationUrl,
          displayName: 'TEAM Group - Employee Onboarding',
          contextData: context
        });
        Logger.log('[SUCCESS] IT Confirmation email sent to Dave Langohr for: ' + verifiedName);
      } else {
        updateWorkflow(workflowId, 'In Progress', 'IT Setup Needed', verifiedName, actingUser);
        syncWorkflowState(workflowId);
        const itUrl = buildFormUrl('it_setup', { wf: workflowId });

        const itRecipients = CONFIG.EMAILS.IT;

        sendFormEmail({
          to: itRecipients,
          subject: 'IT Setup Required',
          body: 'HR has verified the employee details and assigned an ADP ID.\n\nPlease complete the IT setup form using the button below.',
          formUrl: itUrl,
          displayName: 'TEAM Group - Employee Onboarding',
          contextData: context
        });
        Logger.log('[SUCCESS] IT Setup email sent (Salary/System Access path)');
      }

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

      // Send Safety Onboarding Action Item (salary path fires here; hourly fires after ID Setup)
      sendSafetyOnboardingEmail(workflowId, {
        employeeName: verifiedName,
        position: formData.jobTitle,
        jrTitle: formData.jrTitle,
        siteName: formData.siteName || (context && context.siteName) || '',
        hireDate: formData.hireDate || (context && context.hireDate) || '',
        employmentType: employmentType,
        managerName: formData.managerName
      }, null);
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
