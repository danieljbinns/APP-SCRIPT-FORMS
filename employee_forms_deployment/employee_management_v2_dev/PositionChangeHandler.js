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
    const purchasingSites = Array.isArray(formData.purchasingSites) ? formData.purchasingSites.join(', ') : (formData.purchasingSites || '');

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
      formData.comments || '',
      formData.department || '',
      purchasingSites,                        // index 22
      formData.receivingManagerEmail || ''    // index 23
    ];
    
    const sheetSuccess = addSheetRow(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.POSITION_CHANGES, rowData);
    if (!sheetSuccess) throw new Error('Failed to record position change in sheet');
    
    updateWorkflow(workflowId, 'In Progress', 'HR Approval Needed', formData.firstName + ' ' + formData.lastName);
    syncWorkflowState(workflowId);

    // Notification ONLY to HR
    const approvalUrl = buildFormUrl('position_change_approval', { wf: workflowId });
    
    // Enrich context for email
    const wfContext = getWorkflowContext(workflowId) || {};
    const finalContext = {
      ...wfContext,
      workflowType: 'Status Change',
      department: formData.department || '',
      employeeName: formData.firstName + ' ' + formData.lastName,
      siteName: formData.siteNew || formData.siteName,
      jobTitle: (formData.titleOld || 'N/A') + ' -> ' + (formData.titleNew || 'N/A'),
      hireDate: formData.effDate,
      requestDate: new Date().toLocaleDateString(),
      requesterEmail: formData.reqEmail,
      changeTypes: changes,
      siteTransfer: (formData.siteOld && formData.siteNew) ? formData.siteOld + ' -> ' + formData.siteNew : '',
      titleChange: (formData.titleOld || formData.titleNew) ? (formData.titleOld || 'N/A') + ' -> ' + (formData.titleNew || 'N/A') : '',
      classChange: (formData.classOld || formData.classNew) ? (formData.classOld || 'N/A') + ' -> ' + (formData.classNew || 'N/A') : '',
      managerChange: (formData.mgrOldName || 'N/A') + ' (' + (formData.mgrOldEmail || 'N/A') + ') -> ' + (formData.mgrNewName || 'N/A') + ' (' + (formData.mgrNewEmail || 'N/A') + ')',
      managerEmail: formData.mgrNewEmail || '',
      managerOldEmail: formData.mgrOldEmail || '',
      managerNewEmail: formData.mgrNewEmail || ''
    };

    sendFormEmail({
      to: CONFIG.EMAILS.HR,
      subject: 'HR Approval Required',
      body: `A new position/site change request has been submitted for ${formData.firstName} ${formData.lastName}. HR approval is required to proceed.`,
      formUrl: approvalUrl,
      contextData: finalContext
    });

    // Notify payroll at same time as HR — same email and form access (payroll handles approval for some locations)
    sendFormEmail({
      to: CONFIG.EMAILS.PAYROLL,
      subject: 'HR Approval Required',
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
    jobTitle: (function() { var t = data[11] || ''; var idx = t.indexOf(' -> '); var v = idx !== -1 ? t.substring(idx + 4).trim() : t.trim(); return (v && v !== 'N/A') ? v : ''; })(),
    siteTransfer: data[10],
    titleChange: data[11],
    classChange: data[12],
    managerChange: data[13],
    systems: data[17],
    equipment: data[18],
    requesterEmail: data[4],
    comments: data[20],
    department: data[21] || '',
    purchasingSites: data[22] || '',
    receivingManagerEmail: data[23] || ''
  };
}

/**
 * Handle HR Approval for Position Change
 */
function submitPositionChangeApproval(formData) {
  try {
    const { workflowId, decision, notes } = formData;
    const formId = generateFormId('CHG_APP');

    addSheetRow(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.POSITION_CHANGE_APPROVALS, [
      workflowId, formId, new Date(), decision, notes, 'N/A', Session.getActiveUser().getEmail()
    ]);
    
    if (decision === 'Approved') {
      const changeData = getPositionChangeData(workflowId);
      let tasksCreated = 0;

      // Derive transfer and receiving manager from the original request (not HR form)
      const isTransfer = changeData.changes && changeData.changes.includes('Site Transfer');
      const receivingManagerEmail = changeData.receivingManagerEmail || '';

      // Build enriched context for all approval emails — parse manager emails from stored string
      const mgrMatches = (changeData.managerChange || '').match(/\(([^)@\s]+@[^)]+)\)/g) || [];
      const mgrOldEmail = mgrMatches.length > 0 ? mgrMatches[0].replace(/[()]/g, '') : '';
      const mgrNewEmail = mgrMatches.length > 1 ? mgrMatches[1].replace(/[()]/g, '') : mgrOldEmail;
      const changeContext = {
        workflowType: 'Status Change',
        department: changeData.department || '',
        employeeName: changeData.employeeName,
        jobTitle: changeData.jobTitle || '',
        siteName: changeData.siteName,
        hireDate: changeData.effDate,
        requesterEmail: changeData.requesterEmail,
        changeTypes: changeData.changes,
        siteTransfer: changeData.siteTransfer,
        titleChange: changeData.titleChange,
        classChange: changeData.classChange,
        managerChange: changeData.managerChange,
        managerEmail: mgrNewEmail,
        managerOldEmail: mgrOldEmail,
        managerNewEmail: mgrNewEmail,
        systems: changeData.systems,
        equipmentRaw: changeData.equipment,
        purchasingSites: changeData.purchasingSites || '',
        credentialNote: 'Credentials on file — verify with IDSETUP if role or site requires updates.'
      };

      // 1. If Transfer, create Action Item for Receiving Manager
      if (isTransfer && receivingManagerEmail) {
        const effDateForCal = changeData.effDate ? changeData.effDate.replace(/-/g, '') : '';
        const calTitle = encodeURIComponent('Transfer Effective: ' + changeData.employeeName);
        const calDetails = encodeURIComponent('Effective date for transfer of ' + changeData.employeeName + ' to your group.');
        const calUrl = effDateForCal
          ? 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + calTitle + '&dates=' + effDateForCal + '%2F' + effDateForCal + '&details=' + calDetails
          : '';
        const transferDesc = 'Prepare for transfer of ' + changeData.employeeName + ' to your group. Eff Date: ' + changeData.effDate +
          (changeData.effDate ? '__EFFDATE__' + changeData.effDate : '');
        const tid = ActionItemService.createActionItem(
          workflowId,
          'Manager',
          'Incoming Transfer Setup',
          transferDesc,
          receivingManagerEmail
        );
        tasksCreated++;

        const taskLink = buildFormUrl('action_item_view', { tid: tid });
        const calLink = calUrl ? '<br><br><a href="' + calUrl + '" target="_blank">+ Add Effective Date to Calendar (' + changeData.effDate + ')</a>' : '';
        sendFormEmail({
          to: receivingManagerEmail,
          subject: 'Incoming Transfer Action Required',
          body: 'HR has approved a status change for ' + changeData.employeeName + '. You have been assigned an action item to prepare for their arrival:<br><br>' +
                '<a href="' + taskLink + '">Incoming Transfer Setup Task</a>' + calLink,
          contextData: changeContext
        });
      }

      // 2. Specialist action items — created automatically based on what was requested
      const allSystems = changeData.systems ? changeData.systems.split(', ') : [];
      const equipList = changeData.equipment ? changeData.equipment.split(', ') : [];

      // Business Cards → dedicated person
      if (equipList.includes('Business Cards')) {
        const bcDesc = JSON.stringify(['Order digital business cards for ' + changeData.employeeName]);
        const bcTid = ActionItemService.createActionItem(workflowId, 'Business Cards', 'Business Cards Order', bcDesc, CONFIG.EMAILS.BUSINESS_CARDS, 'businesscards');
        tasksCreated++;
        sendFormEmail({
          to: CONFIG.EMAILS.BUSINESS_CARDS,
          subject: 'Business Cards Action Required',
          body: 'A status change has been approved for ' + changeData.employeeName + '. Please process the business card order using the action item below.<br><br><a href="' + buildFormUrl('action_item_view', { tid: bcTid }) + '">Open Action Item</a>',
          contextData: changeContext
        });
      }

      // Credit Card → finance/admin
      if (equipList.includes('Credit Card')) {
        const ccDesc = JSON.stringify(['Process credit card application for ' + changeData.employeeName]);
        const ccTid = ActionItemService.createActionItem(workflowId, 'Credit Card', 'Credit Card Order', ccDesc, CONFIG.EMAILS.CREDIT_CARD, 'creditcard');
        tasksCreated++;
        sendFormEmail({
          to: CONFIG.EMAILS.CREDIT_CARD,
          subject: 'Credit Card Action Required',
          body: 'A status change has been approved for ' + changeData.employeeName + '. Please process the credit card application using the action item below.<br><br><a href="' + buildFormUrl('action_item_view', { tid: ccTid }) + '">Open Action Item</a>',
          contextData: changeContext
        });
      }

      // Fleetio → fleet team
      if (allSystems.includes('Fleetio')) {
        const flDesc = JSON.stringify(['Update Fleetio vehicle access for ' + changeData.employeeName]);
        const flTid = ActionItemService.createActionItem(workflowId, 'Fleetio', 'Fleetio Access Update', flDesc, CONFIG.EMAILS.FLEETIO, 'fleetio');
        tasksCreated++;
        sendFormEmail({
          to: CONFIG.EMAILS.FLEETIO,
          subject: 'Fleetio Action Required',
          body: 'A status change has been approved for ' + changeData.employeeName + '. Please update their Fleetio access using the action item below.<br><br><a href="' + buildFormUrl('action_item_view', { tid: flTid }) + '">Open Action Item</a>',
          contextData: changeContext
        });
      }

      // Jonas Purchasing → Jonas team
      if (allSystems.includes('Jonas Purchasing')) {
        const jDesc = JSON.stringify(['Update Jonas Purchasing access for ' + changeData.employeeName]);
        const jTid = ActionItemService.createActionItem(workflowId, 'Jonas', 'Jonas Purchasing Update', jDesc, CONFIG.EMAILS.JONAS, 'jonas');
        tasksCreated++;
        sendFormEmail({
          to: CONFIG.EMAILS.JONAS,
          subject: 'Jonas Purchasing Action Required',
          body: 'A status change has been approved for ' + changeData.employeeName + '. Please update their Jonas Purchasing access using the action item below.<br><br><a href="' + buildFormUrl('action_item_view', { tid: jTid }) + '">Open Action Item</a>',
          contextData: changeContext
        });
      }

      // Central Purchasing → Jonas team
      if (allSystems.includes('Central Purchasing') || changeData.purchasingSites) {
        const cpDesc = 'Update Central Purchasing access for ' + changeData.employeeName +
          (changeData.purchasingSites ? ' — Sites: ' + changeData.purchasingSites : '');
        const cpTid = ActionItemService.createActionItem(workflowId, 'Purchasing', 'Central Purchasing Update', cpDesc, CONFIG.EMAILS.JONAS, 'centralpurchasing');
        tasksCreated++;
        sendFormEmail({
          to: CONFIG.EMAILS.JONAS,
          subject: 'Central Purchasing Action Required',
          body: 'A status change has been approved for ' + changeData.employeeName + '. Please update their Central Purchasing access using the action item below.<br><br><a href="' + buildFormUrl('action_item_view', { tid: cpTid }) + '">Open Action Item</a>',
          contextData: changeContext
        });
      }

      // IT — all remaining systems + equipment (excluding specialist-handled items)
      const itSystems = allSystems.filter(function(s) {
        return s !== 'Central Purchasing' && s !== 'Jonas Purchasing' && s !== 'Fleetio';
      });
      const itEquip = equipList.filter(function(e) {
        return e !== 'Business Cards' && e !== 'Credit Card' && e !== 'Vehicle';
      });

      if (itSystems.length > 0 || itEquip.length > 0) {
        const itDescItems = [];
        itSystems.forEach(function(s) { itDescItems.push('Provision access: ' + s); });
        itEquip.forEach(function(e) { itDescItems.push('Provision equipment: ' + e); });
        const itTid = ActionItemService.createActionItem(workflowId, 'IT', 'IT Access & Equipment Setup', JSON.stringify(itDescItems), CONFIG.EMAILS.IT);
        tasksCreated++;
        sendFormEmail({
          to: CONFIG.EMAILS.IT,
          subject: 'IT Action Required',
          body: 'A status change has been approved for ' + changeData.employeeName + '. Please set up system access and/or equipment using the action item below.<br><br><a href="' + buildFormUrl('action_item_view', { tid: itTid }) + '">Open Action Item</a>',
          contextData: changeContext
        });
      }

      // 3. ID Setup — tracked action item for system records update
      const idTid = ActionItemService.createActionItem(
        workflowId,
        'ID Setup',
        'System Records Update',
        'Update BOSS, DSS, and SiteDocs records to reflect the new site and/or position for ' + changeData.employeeName + '.',
        CONFIG.EMAILS.IDSETUP
      );
      tasksCreated++;
      sendFormEmail({
        to: CONFIG.EMAILS.IDSETUP,
        subject: 'System Records Update Required',
        body: 'A status change has been approved for ' + changeData.employeeName + '. Please update BOSS, DSS, and SiteDocs records to reflect the new site and/or position.<br><br>' +
              '<a href="' + buildFormUrl('action_item_view', { tid: idTid }) + '">Open Action Item</a>',
        displayName: 'TEAM Group - Employee Management',
        contextData: changeContext
      });

      // 4. Safety — tracked action item for safety verification
      const safTid = ActionItemService.createActionItem(
        workflowId,
        'Safety',
        'Safety Verification',
        'Verify SiteDocs locations, assigned safety courses, and BOSS records reflect the updated position/site for ' + changeData.employeeName + '.',
        CONFIG.EMAILS.SAFETY
      );
      tasksCreated++;
      sendFormEmail({
        to: CONFIG.EMAILS.SAFETY,
        subject: 'Safety Verification Required',
        body: 'A status change has been approved for ' + changeData.employeeName + '. Please verify SiteDocs locations, assigned safety courses, and BOSS records reflect the updated position/site.<br><br>' +
              '<a href="' + buildFormUrl('action_item_view', { tid: safTid }) + '">Open Action Item</a>',
        displayName: 'TEAM Group - Employee Management',
        contextData: changeContext
      });

      updateWorkflow(workflowId, 'In Progress', tasksCreated > 0 ? 'Action Items Pending' : 'Change Processed');
      syncWorkflowState(workflowId);

      // Notify payroll
      sendFormEmail({
        to: CONFIG.EMAILS.PAYROLL,
        subject: 'Status Change Approved',
        body: `HR has approved a status change for ${changeData.employeeName}.<br><br>` +
              `<b>Employee:</b> ${changeData.employeeName}<br>` +
              `<b>Effective Date:</b> ${changeData.effDate}<br>` +
              `<b>Changes:</b> ${changeData.changes || 'N/A'}<br>` +
              `<b>Site:</b> ${changeData.siteName}<br>` +
              `<b>HR Notes:</b> ${notes || 'None'}<br>`,
        formUrl: '',
        contextData: changeContext
      });

      // Notify requester (and new manager if different) that the change has been approved
      const scRecipients = [changeData.requesterEmail];
      if (mgrNewEmail && mgrNewEmail !== changeData.requesterEmail) scRecipients.push(mgrNewEmail);
      sendFormEmail({
        to: scRecipients.join(','),
        subject: 'Status Change Approved',
        body: `HR has approved the status change for ${changeData.employeeName}. All relevant teams have been notified and any required action items have been assigned.${notes ? '<br><br><b>HR Notes:</b> ' + notes : ''}`,
        formUrl: '',
        contextData: changeContext
      });

      return { success: true, message: `Position change approved. ${tasksCreated} action items generated.` };
    } else {
      updateWorkflow(workflowId, 'Rejected', 'Rejected by HR');
      syncWorkflowState(workflowId);
      return { success: true, message: 'Position change rejected.' };
    }
  } catch (e) {
    return { success: false, message: e.message };
  }
}
