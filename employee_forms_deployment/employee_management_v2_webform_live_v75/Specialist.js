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
        // Smarter merge: only override with truthy values from wfContext
        // so itContext values (which have fallback index lookups) are never
        // clobbered by undefined/empty properties from wfContext.
        Object.keys(wfContext).forEach(function(k) {
          const v = wfContext[k];
          if (v !== undefined && v !== null && v !== '') {
            requestData[k] = v;
          }
        });
      }
    }
  } else {
    requestData = { employeeName: 'Loading...' };
  }
  template.requestData = requestData;
  
  return template.evaluate()
    .setTitle('Specialist Setup - ' + dept)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function submitSpecialistForm(formData) {
  try {
    rawLog('submitSpecialistForm', formData);
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
          const HR = SCHEMA.HR_VERIFICATION_RESULTS;
          for (let i = SCHEMA.ROW.FIRST_DATA; i < hrData.length; i++) {
            if (hrData[i][HR.WORKFLOW_ID] === workflowId) {
              // VERIFIED_JR_TITLE stores "Job Title / JR Title" — preserve job title, update JR
              const existing = String(hrData[i][HR.VERIFIED_JR_TITLE] || '');
              const jobTitle = existing.includes(' / ') ? existing.split(' / ')[0].trim() : existing;
              hrSheet.getRange(i + 1, SCHEMA.HR_VERIFICATION_RESULTS.VERIFIED_JR_TITLE + 1).setValue(jobTitle + ' / ' + formData.jrTitle);
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
          if (dept === 'creditcard')       { friendlyDept = 'Credit Card'; }
          if (dept === 'businesscards')    { friendlyDept = 'Business Cards'; }
          if (dept === 'sitedocs')         { friendlyDept = 'SiteDocs / DSS'; }
          if (dept === 'safetyterm')       { friendlyDept = 'Safety Offboarding'; }

          var specContext = (typeof getWorkflowContext === 'function') ? (getWorkflowContext(workflowId) || {}) : {};
          // Ensure V2 email template is used (shows all ID/HR/IT credential sections)
          if (!specContext.workflowType) specContext.workflowType = 'New Hire';

          // Build email body — Fleetio shows conditional Fleetio/Vehicle lines
          var emailBody;
          if (dept === 'fleetio') {
            var fDetails = {};
            try { fDetails = JSON.parse(formData.details || '{}'); } catch(fe) {}
            var lines = [];
            if (fDetails.fleetioCreated !== false) lines.push('Fleetio account has been created for <b>' + employeeName + '</b>.');
            if (fDetails.vehicleAssigned)           lines.push('Company vehicle has been assigned.');
            emailBody = (lines.length > 0 ? lines.join('<br>') : 'Fleetio setup completed for <b>' + employeeName + '</b>.')
              + (formData.notes ? '<br><br><b>Notes:</b> ' + formData.notes : '');
          } else {
            emailBody = friendlyDept + ' setup has been completed for ' + employeeName + '.\n\nNotes: ' + (formData.notes || 'None') + '\n\n';
          }

          const portalUrl = (typeof getBaseUrl === 'function') ? getBaseUrl() : '';

          sendFormEmail({
            to: recipients.join(','),
            subject: friendlyDept + ' Setup Complete',
            body: emailBody,
            formUrl: portalUrl || '',
            displayName: 'TEAM Group — Employee Onboarding',
            contextData: specContext,
            emailOpts: { showPasswords: false }
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
