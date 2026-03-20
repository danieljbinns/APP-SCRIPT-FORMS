/**
 * Termination Request - Backend Handler
 */

function serveTerminationRequest() {
  return HtmlService.createHtmlOutputFromFile('TerminationRequest')
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
      formData.comments || ''
    ];
    
    const sheetSuccess = addSheetRow(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.TERMINATIONS, rowData);
    if (!sheetSuccess) throw new Error('Failed to record termination in sheet');
    
    Logger.log(`[TerminationHandler] Recorded request for ${formData.empName}. Equipment: ${equipment}`);
    
    updateWorkflow(workflowId, 'In Progress', 'HR Approval Needed', formData.empName);
    
    // Notification ONLY to HR initially
    const approvalUrl = buildFormUrl('termination_approval', { wf: workflowId });
    
    // Enrich with workflow context if available (department, etc.)
    const wfContext = getWorkflowContext(workflowId) || {};
    const finalContext = {
      ...wfContext,
      employeeName: formData.empName,
      siteName: formData.siteName,
      managerName: formData.managerName,
      managerEmail: formData.managerEmail,
      requestDate: new Date().toLocaleDateString(),
      requesterEmail: formData.reqEmail,
      hireDate: formData.termDate, // Rendering Term Date on Start Date line
      employmentType: formData.empType,
      reason: formData.reason,
      equipmentRaw: equipment,
      systems: systems
    };

    const emailConfig = {
      to: CONFIG.EMAILS.HR,
      subject: `HR Approval Required: End of Employment - ${formData.empName}`,
      body: `A new end of employment request has been submitted for ${formData.empName} and requires your approval to proceed.`,
      formUrl: approvalUrl,
      contextData: finalContext
    };

    // If an attachment was uploaded, pass the blob along
    if (formData.attachment && formData.attachment.length && formData.attachment.length > 0) {
      emailConfig.attachment = formData.attachment;
    } else if (formData.attachment && formData.attachment.getBytes) {
      // In case the Blob object structure is direct
      emailConfig.attachment = formData.attachment;
    }

    sendFormEmail(emailConfig);
    
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
    originalComments: data[26]
  };
}

/**
 * Handle HR Approval Submission
 */
function submitTerminationApproval(formData) {
  try {
    const { workflowId, decision, notes, collectAssets, itDisable } = formData;
    const formId = generateFormId('TERM_APP');
    
    // Record approval
    addSheetRow(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.TERMINATION_APPROVALS, [
      workflowId, formId, new Date(), decision, notes, collectAssets ? 'YES' : 'NO', Session.getActiveUser().getEmail()
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
      if (g.forward && g.forward !== 'N/A') itItems.push(`Email Forwarding to ${g.forward}`);
      if (g.files && g.files !== 'N/A') itItems.push(`Drive Files Transfer to ${g.files}`);
      if (g.delegate && g.delegate !== 'N/A') itItems.push(`Delegated Inbox Access to ${g.delegate}`);
      if (g.vacation && g.vacation !== 'N/A') itItems.push(`Set Vacation Responder. Body: "${g.vacation}"`);
      
      const duration = (g.duration && g.duration !== 'N/A') ? g.duration : 'Default 1 Month then delete';
      itItems.push(`Account Duration: ${duration}`);
      
      if (itItems.length > 0) {
        const tid = ActionItemService.createActionItem(workflowId, 'IT', `IT Systems Deactivation - ${termData.employeeName}`, JSON.stringify(itItems), CONFIG.EMAILS.IT);
        sendActionItemEmail(CONFIG.EMAILS.IT, `IT Action Required: End of Employment - ${termData.employeeName}`, tid, termData);
        tasksCreated++;
      }

      // HR Group (ADP)
      const hrItems = selectedSystems.filter(s => s === 'ADP Supervisor Access');
      if (hrItems.length > 0) {
        const tid = ActionItemService.createActionItem(workflowId, 'HR', `HR Systems Deactivation - ${termData.employeeName}`, JSON.stringify(hrItems), CONFIG.EMAILS.HR);
        sendActionItemEmail(CONFIG.EMAILS.HR, `HR Action Required: End of Employment - ${termData.employeeName}`, tid, termData);
        tasksCreated++;
      }

      // Fleet Group (Fleetio)
      const fleetItems = selectedSystems.filter(s => s === 'Fleetio');
      if (fleetItems.length > 0) {
        const tid = ActionItemService.createActionItem(workflowId, 'Fleet', `Fleet Systems Deactivation - ${termData.employeeName}`, JSON.stringify(fleetItems), CONFIG.EMAILS.FLEETIO);
        sendActionItemEmail(CONFIG.EMAILS.FLEETIO, `Fleet Action Required: End of Employment - ${termData.employeeName}`, tid, termData);
        tasksCreated++;
      }

      // Jonas/Finance Group
      const financeItems = selectedSystems.filter(s => s === 'Jonas Purchasing');
      if (financeItems.length > 0) {
        const tid = ActionItemService.createActionItem(workflowId, 'Finance', `Jonas Purchasing Deactivation - ${termData.employeeName}`, JSON.stringify(financeItems), CONFIG.EMAILS.JONAS);
        sendActionItemEmail(CONFIG.EMAILS.JONAS, `Finance Action Required: End of Employment - ${termData.employeeName}`, tid, termData);
        tasksCreated++;
      }

      // Employee Deactivation Group (SiteDocs, DSS, BOSS WIS) - Always Mandatory
      const deactItems = ['SiteDocs', 'DSS User', 'BOSS WIS Module'];
      const tidDeact = ActionItemService.createActionItem(workflowId, 'Deactivation', `Employee Deactivation - ${termData.employeeName}`, JSON.stringify(deactItems), CONFIG.EMAILS.IDSETUP);
      sendActionItemEmail(CONFIG.EMAILS.IDSETUP, `Action Required: Employee Deactivation - ${termData.employeeName}`, tidDeact, termData);
      tasksCreated++;

      // 2. CONSOLIDATED ASSET CHECKLIST (Manager/Requester)
      if (collectAssets) {
        const rawAssets = termData.eqToReturn || '';
        let assets = rawAssets ? rawAssets.split(',').map(s => s.trim()).filter(s => s && s !== 'N/A') : [];
        if (assets.length === 0) assets = ['Building Access Card/Keys']; // Default if none selected

        if (assets.length > 0) {
          const tid = ActionItemService.createActionItem(workflowId, 'Assets', `Asset Collection Checklist - ${termData.employeeName}`, JSON.stringify(assets), termData.requesterEmail);
          
          const recipients = [termData.requesterEmail];
          if (termData.managerEmail && termData.managerEmail !== termData.requesterEmail) recipients.push(termData.managerEmail);

          sendFormEmail({
            to: recipients.join(','),
            subject: `Action Required: Asset Collection Checklist - ${termData.employeeName}`,
            body: `HR has approved the end of employment for ${termData.employeeName}. Please collect the following assets and record their status using the button below.`,
            formUrl: buildFormUrl('action_item_view', { tid: tid }),
            contextData: { ...termData, hireDate: termData.termDate, equipmentRaw: termData.eqToReturn }
          });
          tasksCreated++;
        }
      }
      
      updateWorkflow(workflowId, 'In Progress', tasksCreated > 0 ? 'Action Items Pending' : 'Processing');
      
      sendFormEmail({
        to: 'payroll@team-group.com',
        subject: `End of Employment Approved: ${termData.employeeName}`,
        body: `HR has approved the end of employment for ${termData.employeeName}.<br><br><b>Employee:</b> ${termData.employeeName}<br><b>Termination Date:</b> ${termData.termDate}<br><b>Manager:</b> ${termData.managerName}<br><b>Site:</b> ${termData.siteName}`,
        formUrl: ''
      });
      
      return { success: true, message: `End of employment approved. ${tasksCreated} checklists generated.` };
    } else {
      updateWorkflow(workflowId, 'Rejected', 'Rejected by HR');
      
      // Notify Requester & Manager of Rejection
      const termData = getTerminationData(workflowId);
      const recipients = [termData.requesterEmail];
      if (termData.managerEmail && termData.managerEmail !== termData.requesterEmail) recipients.push(termData.managerEmail);

      sendFormEmail({
          to: recipients.join(','),
          subject: `Rejected: End of Employment - ${termData.employeeName}`,
          body: `The end of employment request for ${termData.employeeName} has been rejected by HR.<br><br><b>Notes:</b> ${notes || 'No notes provided.'}`,
          contextData: { ...termData, hireDate: termData.termDate }
      });

      return { success: true, message: 'End of employment rejected. Notification sent to requester.' };
    }
  } catch (e) {
    Logger.log('Approval error: ' + e.toString());
    return { success: false, message: e.message };
  }
}

/**
 * Helper to send action item emails
 */
function sendActionItemEmail(to, subject, tid, termData) {
  sendFormEmail({
    to: to,
    subject: subject,
    body: `HR has approved the end of employment for ${termData.employeeName}. Please complete the following checklist using the button below.`,
    formUrl: buildFormUrl('action_item_view', { tid: tid }),
    contextData: {
        ...termData,
        hireDate: termData.termDate,
        equipmentRaw: termData.eqToReturn,
        systems: termData.systems
    }
  });
}

/**
 * Serve Asset Retrieval Form
 */
function serveAssetRetrieval(workflowId) {
  return HtmlService.createHtmlOutput('<h1>This form is deprecated</h1><p>Please use individual Action Item links from your email.</p>');
}
