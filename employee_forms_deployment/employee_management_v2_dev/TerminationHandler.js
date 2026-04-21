/**
 * Termination Request - Backend Handler
 */

function fmtDate_(iso) {
  if (!iso) return 'N/A';
  var d = new Date(String(iso).replace(/T.*/, '') + 'T00:00:00');
  return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
}

/**
 * Parse a duration string like "1 Month", "3 Months", "Default 1 Month then delete" → integer months.
 * Falls back to 1.
 */
function parseDurationMonths_(durationStr) {
  if (!durationStr || durationStr === 'N/A') return 1;
  const match = String(durationStr).match(/(\d+)/);
  return match ? Math.max(1, parseInt(match[1], 10)) : 1;
}

function serveTerminationRequest() {
  const template = HtmlService.createTemplateFromFile('TerminationRequest');
  template.referenceData = JSON.stringify(getInitialFormData());
  return template.evaluate()
    .setTitle('End of Employment Request')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function submitTerminationRequest(formData) {
  try {
    const workflowId = createWorkflow('TERM', 'End of Employment Request', formData.reqEmail || Session.getActiveUser().getEmail());
    const formId = generateFormId('TERM_REQ');
    
    formData.workflowId = workflowId;
    formData.formId = formId;
    formData.timestamp = new Date();
    
    // Add to spreadsheet
    // Flatten arrays
    const systems = Array.isArray(formData.systems) ? formData.systems.join(', ') : (formData.systems || '');
    const equipment = Array.isArray(formData.equip) ? formData.equip.join(', ') : (formData.equip || '');

    // Upload attachment to Drive if provided
    let attachmentUrl = '';
    let attachmentBlob = null;
    if (formData.attachmentBase64 && formData.attachmentName) {
      try {
        const bytes = Utilities.base64Decode(formData.attachmentBase64);
        attachmentBlob = Utilities.newBlob(bytes, formData.attachmentMimeType || 'application/octet-stream', formData.attachmentName);
        const safeName = 'TERM_' + String(formData.empName || workflowId).replace(/\s/g, '_') + '_' + formData.attachmentName;
        attachmentBlob.setName(safeName);
        const mainFolder = DriveApp.getFolderById(CONFIG.MAIN_FOLDER_ID);
        const driveFile = mainFolder.createFile(attachmentBlob);
        attachmentUrl = driveFile.getUrl();
        Logger.log('[TerminationHandler] Attachment saved to Drive: ' + attachmentUrl);
      } catch (attErr) {
        Logger.log('[TerminationHandler] Attachment upload failed: ' + attErr.message);
      }
    }

    const rowData = [
      formData.workflowId,
      formData.formId,
      formData.timestamp,
      formData.reqName,
      formData.reqEmail,
      formData.empName,
      'N/A', // Previously empID
      formData.empType || '',
      formData.empWorkEmail || 'N/A',
      formData.empPhone || 'N/A',
      formData.empSerial || 'N/A',
      formData.siteName,
      formData.termDate,
      formData.reason,
      formData.managerName || 'N/A',
      formData.managerEmail || 'N/A',
      formData.hr_approved || 'N/A',
      formData.has_reports || 'N/A',
      formData.reports_to_new || 'N/A',
      systems,
      formData.google_forward || 'N/A',
      formData.google_files || 'N/A',
      formData.google_delegate || 'N/A',
      formData.google_duration || 'N/A',
      formData.google_vacation || 'N/A',
      equipment,
      formData.comments || '',
      formData.lastDayWorked || '',
      attachmentUrl
    ];

    const sheetSuccess = addSheetRow(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.TERMINATIONS, rowData);
    if (!sheetSuccess) throw new Error('Failed to record termination in sheet');
    
    Logger.log(`[TerminationHandler] Recorded request for ${formData.empName}. Equipment: ${equipment}`);
    
    updateWorkflow(workflowId, 'In Progress', 'HR Approval Needed', formData.empName);
    syncWorkflowState(workflowId);

    // Notification ONLY to HR initially
    const approvalUrl = buildFormUrl('termination_approval', { wf: workflowId });
    
    // Enrich with workflow context if available (department, etc.)
    const wfContext = getWorkflowContext(workflowId) || {};
    const finalContext = {
      ...wfContext,
      workflowType: 'Termination',
      employeeName: formData.empName,
      siteName: formData.siteName,
      managerName: formData.managerName,
      managerEmail: formData.managerEmail,
      requestDate: new Date().toLocaleDateString(),
      requesterEmail: formData.reqEmail,
      hireDate: fmtDate_(formData.termDate),
      employmentType: formData.empType,
      lastDayWorked: fmtDate_(formData.lastDayWorked),
      reason: formData.reason,
      equipmentRaw: equipment,
      systems: systems
    };

    const hrEmailBody = `A new end of employment request has been submitted for ${formData.empName} and requires your approval to proceed.` +
      (attachmentUrl ? `<br><br><b>Supporting Documentation:</b> <a href="${attachmentUrl}">View attached file</a>` : '');

    sendFormEmail({
      to: CONFIG.EMAILS.HR,
      subject: 'HR Approval Required',
      body: hrEmailBody,
      formUrl: approvalUrl,
      contextData: finalContext
    });

    // Notify payroll — advance notice only, no form link until HR approves
    sendFormEmail({
      to: CONFIG.EMAILS.PAYROLL,
      subject: 'Termination Submitted — Pending HR Approval',
      body: `A new end of employment request has been submitted for ${formData.empName}. <strong>Note: This is an advance notification only — HR approval is still pending.</strong> You will receive a separate email once HR has approved or rejected this request.`,
      formUrl: '',
      contextData: finalContext
    });

    return { success: true, workflowId: workflowId, message: 'Termination request submitted and sent to HR for approval.' };
  } catch (error) {
    Logger.log('[ERROR] Termination submission error: ' + error.toString());
    return { success: false, message: 'Error: ' + error.message };
  }
}

/**
 * Serve Termination Approval Form
 */
function serveTerminationApproval(workflowId) {
  const template = HtmlService.createTemplateFromFile('TerminationApproval');
  template.workflowId = workflowId;
  template.requestData = getTerminationData(workflowId);
  return template.evaluate().setTitle('HR End of Employment Approval').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getTerminationData(workflowId) {
  const data = getRowByRequestId(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.TERMINATIONS, workflowId);
  if (!data) return null;
  return {
    workflowId: data[0],
    employeeName: data[5],
    empID: data[6],
    empType: data[7],
    siteName: data[11],
    termDate: data[12] ? Utilities.formatDate(new Date(data[12]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
    reason: data[13],
    requesterEmail: data[4],
    managerName: data[14], // Added index
    managerEmail: data[15], // Added index
    hasReports: data[17],
    reportsToNew: data[18],
    empPhone: data[9], // Captured from EOE request
    systems: data[19], // Shifted due to new columns
    eqToReturn: data[25], // Shifted due to new columns
    googleOffboarding: {
      forward: data[20],
      files: data[21],
      delegate: data[22],
      duration: data[23],
      vacation: data[24]
    },
    originalComments: data[26],
    lastDayWorked: data[27] ? (data[27] instanceof Date ? Utilities.formatDate(new Date(data[27]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : data[27]) : '',
    attachmentUrl: data[28] || ''
  };
}

/**
 * Handle HR Approval Submission
 */
function submitTerminationApproval(formData) {
  try {
    const { workflowId, decision, notes } = formData;
    const formId = generateFormId('TERM_APP');
    
    // Record approval
    addSheetRow(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.TERMINATION_APPROVALS, [
      workflowId, formId, new Date(), decision, notes, 'YES', Session.getActiveUser().getEmail()
    ]);
    
    if (decision === 'Approved') {
      const termData = getTerminationData(workflowId);
      let tasksCreated = 0;
      
      // 1. SPLIT SYSTEM DEACTIVATIONS
      const rawSystems = termData.systems || '';
      const selectedSystems = rawSystems ? rawSystems.split(',').map(s => s.trim()).filter(s => s && s !== 'N/A') : [];

      // IT Group (BOSS, Delivery, Incidents, Google, CAA)
      const itItems = selectedSystems.filter(s => ['BOSS', 'Delivery', 'Incidents', 'Google Account', 'CAA'].includes(s)).map(s => 'Deactivate ' + s);
      
      const g = termData.googleOffboarding;
      const hasGoogleAccount = selectedSystems.includes('Google Account');

      // Google Account offboarding sub-tasks — ONLY when Google Account is in selected systems
      if (hasGoogleAccount) {
        if (g.forward && g.forward !== 'N/A') itItems.push('Email Forwarding to ' + g.forward);
        if (g.files && g.files !== 'N/A') itItems.push('Drive Files Transfer to ' + g.files);
        if (g.delegate && g.delegate !== 'N/A') itItems.push('Delegated Inbox Access to ' + g.delegate);
        if (g.vacation && g.vacation !== 'N/A') {
          let vacationMsg = g.vacation;
          // Replace [RECIPIENT] placeholder if the form didn't substitute it (e.g. autocomplete bypass)
          if (vacationMsg.includes('[RECIPIENT]')) {
            const recipient = (g.forward && g.forward !== 'N/A') ? g.forward
                            : (g.delegate && g.delegate !== 'N/A') ? g.delegate
                            : (termData.managerEmail && termData.managerEmail !== 'N/A') ? termData.managerEmail
                            : 'HR';
            vacationMsg = vacationMsg.replace('[RECIPIENT]', recipient);
          }
          itItems.push('Set Vacation Responder — Message: ' + vacationMsg);
        }
        // Embed calendar marker so IT action item form shows "Add to Calendar" for account deletion date
        const rawDuration = (g.duration && g.duration !== 'N/A') ? g.duration : '1 Month';
        const confirmWith = (g.forward && g.forward !== 'N/A') ? g.forward : '';
        itItems.push('__CAL__' + rawDuration + '__' + confirmWith);
      }

      // Mobile phone suspension — conditional on equipment list, not Google Account
      const eqList = (termData.eqToReturn || '').split(',').map(function(s) { return s.trim(); });
      if (eqList.some(function(e) { return e.toLowerCase().includes('mobile phone'); })) {
        const phoneInfo = (termData.empPhone && termData.empPhone !== 'N/A') ? ' — ' + termData.empPhone : '';
        itItems.push('Suspend/Cancel Mobile Phone' + phoneInfo);
      }

      // Direct reports reassignment — conditional on Google Account (Google org chart)
      if (hasGoogleAccount && termData.hasReports === 'Yes') {
        const newMgr = (termData.reportsToNew && termData.reportsToNew !== 'N/A') ? termData.reportsToNew : 'new manager (see HR)';
        itItems.push('Reassign Google direct reports to: ' + newMgr);
        itItems.push('Reassign BOSS direct reports to: ' + newMgr);
      } else if (!hasGoogleAccount && termData.hasReports === 'Yes') {
        // No Google account but has reports — BOSS reassignment only
        const newMgr = (termData.reportsToNew && termData.reportsToNew !== 'N/A') ? termData.reportsToNew : 'new manager (see HR)';
        itItems.push('Reassign BOSS direct reports to: ' + newMgr);
      }

      if (itItems.length > 0) {
        const tid = ActionItemService.createActionItem(workflowId, 'IT', 'IT Systems Deactivation - ' + termData.employeeName, JSON.stringify(itItems), CONFIG.EMAILS.IT);
        sendActionItemEmail(CONFIG.EMAILS.IT, 'IT Action Required', tid, termData, itItems);
        tasksCreated++;
      }

      // HR Group (ADP) — CC Payroll since different locations handle this differently
      const hrItems = selectedSystems.filter(s => s === 'ADP Supervisor Access');
      if (hrItems.length > 0) {
        const hrAndPayroll = CONFIG.EMAILS.HR + ',' + CONFIG.EMAILS.PAYROLL;
        const tid = ActionItemService.createActionItem(workflowId, 'HR', `HR Systems Deactivation - ${termData.employeeName}`, JSON.stringify(hrItems), hrAndPayroll);
        sendActionItemEmail(hrAndPayroll, 'HR Action Required', tid, termData, hrItems);
        tasksCreated++;
      }

      // Fleet Group (Fleetio)
      const fleetItems = selectedSystems.filter(s => s === 'Fleetio');
      if (fleetItems.length > 0) {
        const tid = ActionItemService.createActionItem(workflowId, 'Fleet', `Fleet Systems Deactivation - ${termData.employeeName}`, JSON.stringify(fleetItems), CONFIG.EMAILS.FLEETIO);
        sendActionItemEmail(CONFIG.EMAILS.FLEETIO, 'Fleet Action Required', tid, termData, fleetItems);
        tasksCreated++;
      }

      // Jonas/Finance Group (Jonas Purchasing + Central Purchasing — same team, same email)
      const financeItems = selectedSystems.filter(s => s === 'Jonas Purchasing' || s === 'Central Purchasing');
      if (financeItems.length > 0) {
        const tid = ActionItemService.createActionItem(workflowId, 'Finance', `Jonas/Purchasing Deactivation - ${termData.employeeName}`, JSON.stringify(financeItems), CONFIG.EMAILS.JONAS);
        sendActionItemEmail(CONFIG.EMAILS.JONAS, 'Finance Action Required', tid, termData, financeItems);
        tasksCreated++;
      }

      // Employee Deactivation Group (SiteDocs, DSS, BOSS WIS) - Always Mandatory
      const deactItems = ['SiteDocs', 'DSS User', 'BOSS WIS Module'];
      const tidDeact = ActionItemService.createActionItem(workflowId, 'Deactivation', `Employee Deactivation - ${termData.employeeName}`, JSON.stringify(deactItems), CONFIG.EMAILS.IDSETUP);
      sendActionItemEmail(CONFIG.EMAILS.IDSETUP, 'Employee Deactivation Required', tidDeact, termData, deactItems);
      tasksCreated++;

      // Safety Offboarding — FYI notification only. No action item needed;
      // deactivation (SiteDocs, DSS, BOSS WIS) is handled by the ID Setup team above.
      const safetyTermCtx = {
        ...termData,
        workflowType: 'Termination',
        employmentType: termData.empType,
        hireDate: fmtDate_(termData.termDate),
        equipmentRaw: termData.eqToReturn,
        lastDayWorked: fmtDate_(termData.lastDayWorked),
        hasReports: termData.hasReports,
        reportsToNew: termData.reportsToNew
      };
      sendFormEmail({
        to: CONFIG.EMAILS.SAFETY,
        subject: 'FYI — Employee Offboarding: ' + termData.employeeName,
        body: 'HR has approved the end of employment for <b>' + termData.employeeName + '</b>.' +
          '<br><b>Site:</b> ' + (termData.siteName || 'N/A') +
          '<br><b>Term Date:</b> ' + fmtDate_(termData.termDate) +
          '<br><b>Last Day Worked:</b> ' + fmtDate_(termData.lastDayWorked) +
          '<br><br>This is an advance notification only — no action is required from Safety. Employee deactivation (SiteDocs, DSS, BOSS WIS) will be handled by the ID Setup team.',
        formUrl: '',
        displayName: 'TEAM Group - Employee Management',
        contextData: safetyTermCtx
      });
      // No tasksCreated++ — this is informational only

      // 2. CONSOLIDATED ASSET CHECKLIST (Manager/Requester) — always created on approval
      const termRecipients = [termData.requesterEmail];
      if (termData.managerEmail && termData.managerEmail !== termData.requesterEmail) termRecipients.push(termData.managerEmail);
      const termApprovalContext = { ...termData, workflowType: 'Termination', employmentType: termData.empType, hireDate: termData.termDate, equipmentRaw: termData.eqToReturn };

      const rawAssets = termData.eqToReturn || '';
      const assets = rawAssets ? rawAssets.split(',').map(s => s.trim()).filter(s => s && s !== 'N/A') : [];

      if (assets.length > 0) {
        const tid = ActionItemService.createActionItem(workflowId, 'Assets', `Asset Collection Checklist - ${termData.employeeName}`, JSON.stringify(assets), termData.requesterEmail);
        sendFormEmail({
          to: termRecipients.join(','),
          subject: 'Asset Collection Required',
          body: `HR has approved the end of employment for ${termData.employeeName}. Please collect the following assets and record their status using the button below.`,
          formUrl: buildFormUrl('action_item_view', { tid: tid }),
          contextData: termApprovalContext
        });
        tasksCreated++;
      } else {
        // No equipment listed — notify requester/manager that termination was approved
        sendFormEmail({
          to: termRecipients.join(','),
          subject: 'Termination Approved',
          body: `HR has approved the end of employment for ${termData.employeeName}. All offboarding steps have been initiated.${notes ? '<br><br><b>HR Notes:</b> ' + notes : ''}`,
          formUrl: '',
          contextData: termApprovalContext
        });
      }
      
      updateWorkflow(workflowId, 'In Progress', tasksCreated > 0 ? 'Action Items Pending' : 'Processing');
      syncWorkflowState(workflowId);

      // E4: Payroll approval notification with direct reports and last day worked info
      sendFormEmail({
        to: CONFIG.EMAILS.PAYROLL,
        subject: 'Termination Approved',
        body: `HR has approved the end of employment for ${termData.employeeName}.<br><br>` +
              `<b>Employee:</b> ${termData.employeeName}<br>` +
              `<b>Termination Date:</b> ${fmtDate_(termData.termDate)}<br>` +
              `<b>Last Day Worked:</b> ${fmtDate_(termData.lastDayWorked)}<br>` +
              `<b>Manager:</b> ${termData.managerName}<br>` +
              `<b>Site:</b> ${termData.siteName}<br>` +
              `<b>Employee Type:</b> ${termData.empType || 'N/A'}<br>` +
              `<b>Has Direct Reports:</b> ${termData.hasReports || 'N/A'}<br>` +
              `<b>Reports Reassigned To:</b> ${termData.reportsToNew || 'N/A'}<br>` +
              `<b>Reason:</b> ${termData.reason || 'N/A'}<br>` +
              `<b>HR Notes:</b> ${notes || 'None'}<br>`,
        formUrl: '',
        contextData: {
          workflowType: 'Termination',
          employeeName: termData.employeeName,
          siteName: termData.siteName,
          employmentType: termData.empType,
          hireDate: termData.termDate,
          managerName: termData.managerName,
          managerEmail: termData.managerEmail,
          reason: termData.reason,
          lastDayWorked: termData.lastDayWorked,
          hasReports: termData.hasReports,
          reportsToNew: termData.reportsToNew,
          requesterEmail: termData.requesterEmail
        }
      });
      
      return { success: true, message: `End of employment approved. ${tasksCreated} checklists generated.` };
    } else {
      updateWorkflow(workflowId, 'Rejected', 'Rejected by HR');
      syncWorkflowState(workflowId);

      // Notify Requester & Manager of Rejection
      const termData = getTerminationData(workflowId);
      const recipients = [termData.requesterEmail];
      if (termData.managerEmail && termData.managerEmail !== termData.requesterEmail) recipients.push(termData.managerEmail);

      sendFormEmail({
          to: recipients.join(','),
          subject: 'Termination Rejected',
          body: `The end of employment request for ${termData.employeeName} has been rejected by HR.<br><br><b>Notes:</b> ${notes || 'No notes provided.'}`,
          contextData: { ...termData, workflowType: 'Termination', employmentType: termData.empType, hireDate: termData.termDate }
      });

      return { success: true, message: 'End of employment rejected. Notification sent to requester.' };
    }
  } catch (e) {
    Logger.log('Approval error: ' + e.toString());
    return { success: false, message: e.message };
  }
}

/**
 * Called from ActionItemForm when IT clicks "Add to Calendar" for account deletion.
 * Creates an all-day Google Calendar event on the deletion date and invites IT.
 * @param {string} taskId
 * @param {string} duration  - e.g. "1 Month", "3 Months"
 * @param {string} confirmWith - email to confirm with before deleting (may be empty)
 * @returns {{ success: boolean, dateStr: string, message: string }}
 */
function scheduleAccountDeletion(taskId, duration, confirmWith) {
  try {
    const task = ActionItemService.getTask(taskId);
    if (!task) return { success: false, message: 'Task not found' };

    const empName = task.TaskName ? task.TaskName.replace(/^IT Systems Deactivation - /, '') : 'Employee';
    const months = parseDurationMonths_(duration);
    const deletionDate = new Date();
    deletionDate.setMonth(deletionDate.getMonth() + months);

    const evtDesc = [
      'Delete Google account for: ' + empName,
      confirmWith ? 'Confirm deletion with: ' + confirmWith : '',
      'Duration setting: ' + duration,
      'Workflow: ' + task.WorkflowID
    ].filter(Boolean).join('\n');

    const cal = CalendarApp.getDefaultCalendar();
    cal.createAllDayEvent(
      'Delete Google Account — ' + empName,
      deletionDate,
      { description: evtDesc, guests: CONFIG.EMAILS.IT, sendInvites: true }
    );

    const dateStr = fmtDate_(deletionDate);
    Logger.log('[scheduleAccountDeletion] Calendar event created for ' + empName + ' on ' + dateStr);
    return { success: true, dateStr: dateStr, message: 'Calendar event added for ' + dateStr };
  } catch (e) {
    Logger.log('[scheduleAccountDeletion] Error: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Helper to send action item emails
 */
function sendActionItemEmail(to, subject, tid, termData, items) {
  sendFormEmail({
    to: to,
    subject: subject,
    body: 'HR has approved the end of employment for ' + termData.employeeName + '. Please complete the following checklist using the button below.',
    formUrl: buildFormUrl('action_item_view', { tid: tid }),
    contextData: {
        ...termData,
        workflowType: 'Termination',
        employmentType: termData.empType,
        hireDate: fmtDate_(termData.termDate),
        equipmentRaw: termData.eqToReturn,
        systems: termData.systems,
        lastDayWorked: fmtDate_(termData.lastDayWorked),
        hasReports: termData.hasReports,
        reportsToNew: termData.reportsToNew,
        checklistItems: items || null
    }
  });
}

/**
 * Serve Asset Retrieval Form
 */
function serveAssetRetrieval(workflowId) {
  return HtmlService.createHtmlOutput('<h1>This form is deprecated</h1><p>Please use individual Action Item links from your email.</p>');
}
