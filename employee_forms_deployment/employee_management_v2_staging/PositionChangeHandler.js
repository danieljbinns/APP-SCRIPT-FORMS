/**
 * Position / Site Change Request - Backend Handler
 */

function servePositionSiteChange() {
  const template = HtmlService.createTemplateFromFile('PositionSiteChangeRequest');
  template.referenceData = JSON.stringify(getInitialFormData());
  return template.evaluate()
    .setTitle('Position / Site Change Request')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function submitPositionChangeRequest(formData) {
  try {
    const workflowId = createWorkflow('CHANGE', 'Position/Site Change Request', formData.reqEmail || Session.getActiveUser().getEmail());
    const formId = generateFormId('POS_CHANGE');
    
    formData.workflowId = workflowId;
    formData.formId = formId;
    formData.timestamp = new Date();
    
    // Flatten arrays for sheet
    const changes = Array.isArray(formData.changeType) ? formData.changeType.join(', ') : '';
    const systems = Array.isArray(formData.sys) ? formData.sys.join(', ') : '';
    const equipment = Array.isArray(formData.equip) ? formData.equip.join(', ') : '';
    const removal = Array.isArray(formData.rem) ? formData.rem.join(', ') : '';
    
    const rowData = [
      formData.workflowId,
      formData.formId,
      formData.timestamp,
      formData.reqName,
      formData.reqEmail,
      formData.firstName + ' ' + formData.lastName,
      'N/A', // Previously empID
      formData.effDate,
      formData.siteName,
      changes,
      (formData.siteOld || 'N/A') + ' -> ' + (formData.siteNew || 'N/A'),
      (formData.titleOld || 'N/A') + ' -> ' + (formData.titleNew || 'N/A'),
      (formData.classOld || 'N/A') + ' -> ' + (formData.classNew || 'N/A'),
      (formData.mgrOldName || 'N/A') + ' (' + (formData.mgrOldEmail || 'N/A') + ') -> ' + (formData.mgrNewName || 'N/A') + ' (' + (formData.mgrNewEmail || 'N/A') + ')',
      formData.oldReportsTo || 'N/A',
      formData.newReportsFrom || 'N/A',
      (formData.existingEmail || 'N/A') + ' -> ' + (formData.googleEmail ? formData.googleEmail + '@' + formData.googleDomain : 'N/A'),
      systems,
      equipment,
      removal,
      formData.comments || ''
    ];
    
    const sheetSuccess = addSheetRow(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.POSITION_CHANGES, rowData);
    if (!sheetSuccess) throw new Error('Failed to record position change in sheet');
    
    updateWorkflow(workflowId, 'In Progress', 'HR Approval Needed', formData.firstName + ' ' + formData.lastName);
    
    // Notification ONLY to HR
    const approvalUrl = buildFormUrl('position_change_approval', { wf: workflowId });
    
    // Enrich context for email
    const wfContext = getWorkflowContext(workflowId) || {};
    const finalContext = {
      ...wfContext,
      employeeName: formData.firstName + ' ' + formData.lastName,
      siteName: formData.siteName,
      jobTitle: `${formData.titleOld || 'N/A'} -> ${formData.titleNew || 'N/A'}`,
      hireDate: formData.effDate, // Event date
      requestDate: new Date().toLocaleDateString(),
      requesterEmail: formData.reqEmail,
      department: changes // Using change type summary in department slot for quick glance
    };

    sendFormEmail({
      to: CONFIG.EMAILS.HR,
      subject: `HR Approval Required: Status Change - ${formData.firstName} ${formData.lastName}`,
      body: `A new position/site change request has been submitted for ${formData.firstName} ${formData.lastName}. HR approval is required to proceed.`,
      formUrl: approvalUrl,
      contextData: finalContext
    });
    
    return { success: true, workflowId: workflowId, message: 'Change request submitted and sent to HR for approval.' };
  } catch (error) {
    Logger.log('[ERROR] Position change submission error: ' + error.toString());
    return { success: false, message: 'Error: ' + error.message };
  }
}

/**
 * Serve Position Change Approval Form
 */
function servePositionChangeApproval(workflowId) {
  const template = HtmlService.createTemplateFromFile('StatusChangeApproval');
  template.workflowId = workflowId;
  template.requestData = getPositionChangeData(workflowId);
  return template.evaluate().setTitle('HR Status Change Approval').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getPositionChangeData(workflowId) {
  const data = getRowByRequestId(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.POSITION_CHANGES, workflowId);
  if (!data) return null;
  return {
    workflowId: data[0],
    employeeName: data[5],
    empID: data[6],
    effDate: data[7] ? (data[7] instanceof Date ? Utilities.formatDate(new Date(data[7]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : data[7]) : '',
    siteName: data[8],
    changes: data[9],
    siteTransfer: data[10],
    titleChange: data[11],
    classChange: data[12],
    managerChange: data[13],
    systems: data[17],
    equipment: data[18],
    requesterEmail: data[4],
    comments: data[20]
  };
}

/**
 * Handle HR Approval for Position Change
 */
function submitPositionChangeApproval(formData) {
  try {
    const { workflowId, decision, notes, isTransfer, receivingManagerEmail, nextSteps } = formData;
    const formId = generateFormId('CHG_APP');
    
    addSheetRow(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.POSITION_CHANGE_APPROVALS, [
      workflowId, formId, new Date(), decision, notes, nextSteps || 'N/A', Session.getActiveUser().getEmail()
    ]);
    
    if (decision === 'Approved') {
      const changeData = getPositionChangeData(workflowId);
      let tasksCreated = 0;
      
      // 1. If Transfer, create Action Item for Receiving Manager
      if (isTransfer && receivingManagerEmail) {
        const description = `Prepare for transfer of ${changeData.employeeName} to your group. Eff Date: ${changeData.effDate}`;
        const tid = ActionItemService.createActionItem(
          workflowId, 
          'Manager', 
          'Incoming Transfer Setup', 
          description, 
          receivingManagerEmail
        );
        tasksCreated++;
        
        // Notify Receiving Manager
        sendFormEmail({
          to: receivingManagerEmail,
          subject: `Action Required: Incoming Transfer - ${changeData.employeeName}`,
          body: `HR has approved a status change for ${changeData.employeeName}. You have been assigned an action item to prepare for their arrival:<br><br><a href="${buildFormUrl('action_item_view', { tid: tid })}">Incoming Transfer Setup Task</a>`,
          contextData: changeData
        });
      }
      
      // 2. If IT action needed (systems or equipment)
      if (nextSteps && nextSteps.includes('IT')) {
        // Create granular IT tasks based on request
        const itTasks = [];
        const systems = changeData.systems ? changeData.systems.split(', ') : [];
        systems.forEach(sys => {
          const tid = ActionItemService.createActionItem(workflowId, 'IT', `Setup ${sys}`, `Provision access for ${changeData.employeeName}`, CONFIG.EMAILS.IT);
          itTasks.push({ name: `Setup ${sys}`, url: buildFormUrl('action_item_view', { tid: tid }) });
          tasksCreated++;
        });

        const assets = changeData.equipment ? changeData.equipment.split(', ') : [];
        assets.forEach(asset => {
          const tid = ActionItemService.createActionItem(workflowId, 'IT', `Provision ${asset}`, `Setup and deliver ${asset} for ${changeData.employeeName}`, CONFIG.EMAILS.IT);
          itTasks.push({ name: `Provision ${asset}`, url: buildFormUrl('action_item_view', { tid: tid }) });
          tasksCreated++;
        });
        
        // Notify IT
        if (itTasks.length > 0) {
          const taskLinks = itTasks.map(t => `<a href="${t.url}">${t.name}</a>`).join('<br>');
          sendFormEmail({
            to: CONFIG.EMAILS.IT,
            subject: `IT Action Required: Status Change Tasks - ${changeData.employeeName}`,
            body: `HR has approved a status change for ${changeData.employeeName}. Below are the individual action items that require closure:<br><br>${taskLinks}`,
            contextData: changeData
          });
        }
      }
      
      updateWorkflow(workflowId, 'In Progress', tasksCreated > 0 ? 'Action Items Pending' : 'Change Processed');
      
      return { success: true, message: `Position change approved. ${tasksCreated} action items generated.` };
    } else {
      updateWorkflow(workflowId, 'Rejected', 'Rejected by HR');
      return { success: true, message: 'Position change rejected.' };
    }
  } catch (e) {
    return { success: false, message: e.message };
  }
}
