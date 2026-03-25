/**
 * Termination Request - Backend Handler
 */

function serveTerminationRequest() {
  return HtmlService.createHtmlOutputFromFile('TerminationRequest')
    .setTitle('Termination Request')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function submitTerminationRequest(formData) {
  try {
    const workflowId = createWorkflow('TERM', 'Termination Request', formData.reqEmail || Session.getActiveUser().getEmail());
    const formId = generateFormId('TERM_REQ');
    
    formData.workflowId = workflowId;
    formData.formId = formId;
    formData.timestamp = new Date();
    
    // Add to spreadsheet
    // Flatten arrays
    const systems = Array.isArray(formData.systems) ? formData.systems.join(', ') : '';
    const equipment = Array.isArray(formData.equip) ? formData.equip.join(', ') : '';

    const rowData = [
      formData.workflowId,
      formData.formId,
      formData.timestamp,
      formData.reqName,
      formData.reqEmail,
      formData.empName,
      formData.empID,
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
      subject: `HR Approval Required: Termination - ${formData.empName}`,
      body: `A new termination request has been submitted for ${formData.empName} and requires your approval to proceed.`,
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
  return template.evaluate().setTitle('HR Termination Approval').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getTerminationData(workflowId) {
  const data = getRowByRequestId(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.TERMINATIONS, workflowId);
  if (!data) return null;
  return {
    workflowId: data[0],
    employeeName: data[5],
    empID: data[6],
    siteName: data[11],
    termDate: data[12] ? Utilities.formatDate(new Date(data[12]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
    reason: data[13],
    requesterEmail: data[4],
    managerName: data[14], // Added index
    managerEmail: data[15], // Added index
    systems: data[19], // Shifted due to new columns
    eqToReturn: data[25], // Shifted due to new columns
    googleOffboarding: {
      forward: data[20],
      files: data[21],
      delegate: data[22],
      duration: data[23],
      vacation: data[24]
    }
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
      
      // 1. Consolidated IT Checklist
      if (itDisable) {
        const rawSystems = termData.systems || '';
        const systems = rawSystems ? rawSystems.split(',').map(s => s.trim()).filter(s => s && s !== 'N/A') : [];
        const googleTasks = [];
        if (termData.googleOffboarding.forward && termData.googleOffboarding.forward !== 'N/A') googleTasks.push(`Email Forwarding to ${termData.googleOffboarding.forward}`);
        if (termData.googleOffboarding.files && termData.googleOffboarding.files !== 'N/A') googleTasks.push(`Drive Files Transfer to ${termData.googleOffboarding.files}`);
        
        const allITItems = [...systems, ...googleTasks];
        if (allITItems.length > 0) {
          const tid = ActionItemService.createActionItem(
             workflowId, 'IT', `IT Offboarding Checklist - ${termData.employeeName}`, allITItems.join(', '), CONFIG.EMAILS.IT
          );
          
          sendFormEmail({
            to: CONFIG.EMAILS.IT,
            subject: `IT Action Required: Offboarding Checklist - ${termData.employeeName}`,
            body: `HR has approved the termination of ${termData.employeeName}. Please complete the following checklist:<br><br><a href="${buildFormUrl('action_item_view', { tid: tid })}">Open IT Checklist</a>`,
            contextData: {
                ...termData,
                hireDate: termData.termDate, // Render on "Start Date" line in email
                equipmentRaw: termData.eqToReturn
            }
          });
          tasksCreated++;
        }
      }
      
      // 2. Consolidated Asset Checklist
      if (collectAssets) {
        const rawAssets = termData.eqToReturn || '';
        let assets = rawAssets ? rawAssets.split(',').map(s => s.trim()).filter(s => s && s !== 'N/A') : [];
        
        // Fix: If HR requested collection but no specific items were listed, provide a default list
        if (assets.length === 0) {
           assets = ['Keys', 'Access Badge', 'Company Equipment/Devices'];
        }

        if (assets.length > 0) {
          const tid = ActionItemService.createActionItem(
             workflowId, 'Assets', `Asset Collection Checklist - ${termData.employeeName}`, assets.join(', '), termData.requesterEmail
          );
          
          // Notify both Requester and manager
          const recipients = [termData.requesterEmail];
          if (termData.managerEmail && termData.managerEmail !== termData.requesterEmail) {
            recipients.push(termData.managerEmail);
          }

          sendFormEmail({
            to: recipients.join(','),
            subject: `Action Required: Asset Collection Checklist - ${termData.employeeName}`,
            body: `HR has approved the termination of ${termData.employeeName}. Please collect these assets and check them off in the form:<br><br><a href="${buildFormUrl('action_item_view', { tid: tid })}">Open Asset Checklist</a>`,
            contextData: {
                ...termData,
                hireDate: termData.termDate, // Render on "Start Date" line in email
                equipmentRaw: termData.eqToReturn,
                systems: termData.systems
            }
          });
          tasksCreated++;
        }
      }
      
      updateWorkflow(workflowId, 'In Progress', tasksCreated > 0 ? 'Action Items Pending' : 'Processing');
      return { success: true, message: `Termination approved. ${tasksCreated} checklists generated.` };
    } else {
      updateWorkflow(workflowId, 'Rejected', 'Rejected by HR');
      return { success: true, message: 'Termination rejected.' };
    }
  } catch (e) {
    Logger.log('Approval error: ' + e.toString());
    return { success: false, message: e.message };
  }
}

/**
 * Serve Asset Retrieval Form
 */
function serveAssetRetrieval(workflowId) {
  return HtmlService.createHtmlOutput('<h1>This form is deprecated</h1><p>Please use individual Action Item links from your email.</p>');
}
