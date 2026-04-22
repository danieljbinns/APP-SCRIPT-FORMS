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
      formData.receivingManagerEmail || '',   // index 23
      formData.currentTitle || '',            // index 24
      formData.currentManagerEmail || '',     // index 25
      formData.currentManagerName || '',      // index 26
      formData.currentClass || ''             // index 27
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
      body: 'A new status change request has been submitted for ' + formData.firstName + ' ' + formData.lastName + '. Please review and approve or reject using the button below.',
      formUrl: approvalUrl,
      contextData: finalContext
    });

    // Notify payroll at same time as HR
    sendFormEmail({
      to: CONFIG.EMAILS.PAYROLL,
      subject: 'HR Approval Required',
      body: 'A new status change request has been submitted for ' + formData.firstName + ' ' + formData.lastName + '. Please review and approve or reject using the button below.',
      formUrl: approvalUrl,
      contextData: finalContext
    });

    // Notify current manager (if provided and different from requester)
    if (formData.currentManagerEmail && formData.currentManagerEmail !== formData.reqEmail) {
      sendFormEmail({
        to: formData.currentManagerEmail,
        subject: 'Status Change Initiated',
        body: 'A status change request has been submitted for ' + formData.firstName + ' ' + formData.lastName + ', who currently reports to you. The change is pending HR review. You will be notified of the outcome.',
        contextData: finalContext
      });
    }

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
    receivingManagerEmail: data[23] || '',
    currentTitle: data[24] || '',
    currentManagerEmail: data[25] || '',
    currentManagerName: data[26] || '',
    currentClass: data[27] || '',
    mgrNewEmail: (function() {
      var m = (String(data[13] || '')).match(/\(([^)@\s]+@[^)\s]+)\)/g) || [];
      return m.length > 1 ? m[1].replace(/[()]/g, '') : (m.length === 1 ? m[0].replace(/[()]/g, '') : '');
    })()
  };
}

/**
 * Handle HR Approval for Position Change
 */
function submitPositionChangeApproval(formData) {
  try {
    const { workflowId, decision, notes, confirmedNewManager, confirmedTitle } = formData;
    const formId = generateFormId('CHG_APP');

    addSheetRow(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.POSITION_CHANGE_APPROVALS, [
      workflowId, formId, new Date(), decision, notes,
      confirmedTitle || '', confirmedNewManager || '', Session.getActiveUser().getEmail()
    ]);

    if (decision === 'Approved') {
      const changeData = getPositionChangeData(workflowId);
      let tasksCreated = 0;

      // Derive transfer flag and effective receiving manager
      // HR's confirmed new manager takes precedence; fall back to request fields
      const isTransfer = changeData.changes && changeData.changes.includes('Site Transfer');
      const receivingManagerEmail = (confirmedNewManager && confirmedNewManager.trim())
        ? confirmedNewManager.trim()
        : (changeData.receivingManagerEmail || changeData.mgrNewEmail || '');

      // Current (old) manager email — from stored current manager or parsed managerChange
      const mgrMatches = (changeData.managerChange || '').match(/\(([^)@\s]+@[^)\s]+)\)/g) || [];
      const mgrOldEmail = changeData.currentManagerEmail || (mgrMatches.length > 0 ? mgrMatches[0].replace(/[()]/g, '') : '');
      const mgrNewEmail = receivingManagerEmail || (mgrMatches.length > 1 ? mgrMatches[1].replace(/[()]/g, '') : mgrOldEmail);

      // Effective job title: HR's confirmed title > request's new title > current title
      const effectiveTitle = (confirmedTitle && confirmedTitle.trim()) ? confirmedTitle.trim() : (changeData.jobTitle || changeData.currentTitle || '');

      // Helper: styled calendar button for email bodies
      var _calBtn = function(url, label, effDate) {
        if (!url) return '';
        return '<div style="margin-top:20px; text-align:center;">' +
          '<a href="' + url + '" target="_blank" style="display:inline-block; background:linear-gradient(135deg,#EB1C2D 0%,#c41828 100%); color:#fff; padding:12px 28px; text-decoration:none; border-radius:6px; font-weight:600; font-size:15px; box-shadow:0 4px 12px rgba(235,28,45,0.3);">' +
          '&#128197; ' + (label || 'Add to Calendar') + (effDate ? ' (' + effDate + ')' : '') + ' &rarr;</a></div>';
      };

      // Build enriched context for all approval emails
      const changeContext = {
        workflowType: 'Status Change',
        department: changeData.department || '',
        employeeName: changeData.employeeName,
        jobTitle: effectiveTitle,
        siteName: changeData.siteName,
        hireDate: changeData.effDate,
        requesterEmail: changeData.requesterEmail,
        changeTypes: changeData.changes,
        siteTransfer: changeData.siteTransfer,
        titleChange: changeData.titleChange,
        classChange: changeData.classChange,
        managerChange: changeData.managerChange,
        managerName: changeData.currentManagerName || '',
        managerEmail: mgrNewEmail,
        managerOldEmail: mgrOldEmail,
        managerNewEmail: mgrNewEmail,
        systems: changeData.systems,
        equipmentRaw: changeData.equipment,
        purchasingSites: changeData.purchasingSites || '',
        employmentType: changeData.currentClass || '',
        currentTitle: changeData.currentTitle || ''
      };

      // 1. Receiving manager action item (for transfers OR any manager assignment)
      if (receivingManagerEmail) {
        const effDateForCal = changeData.effDate ? changeData.effDate.replace(/-/g, '') : '';
        const calTitle = encodeURIComponent('Transfer Effective: ' + changeData.employeeName);
        const calDetails = encodeURIComponent('Effective date for transfer/change for ' + changeData.employeeName + '.');
        const calUrl = effDateForCal
          ? 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + calTitle + '&dates=' + effDateForCal + '%2F' + effDateForCal + '&details=' + calDetails
          : '';
        const transferDesc = JSON.stringify([
          'Review incoming transfer: ' + changeData.employeeName + (changeData.effDate ? ' — Eff Date: ' + changeData.effDate + '__EFFDATE__' + changeData.effDate : ''),
          'Prepare workspace, equipment, and system access for incoming employee',
          'Confirm reporting structure and onboarding plan with HR'
        ]);
        const tid = ActionItemService.createActionItem(workflowId, 'Manager', 'Incoming Transfer Setup', transferDesc, receivingManagerEmail);
        tasksCreated++;
        sendFormEmail({
          to: receivingManagerEmail,
          subject: 'Incoming Transfer Action Required',
          body: 'HR has approved a status change for <strong>' + changeData.employeeName + '</strong>. You have been assigned as the receiving manager. Please complete the action item below to prepare for their arrival.' +
                _calBtn(calUrl, 'Add Effective Date to Calendar', changeData.effDate),
          formUrl: buildFormUrl('action_item_view', { tid: tid }),
          contextData: changeContext
        });
      }

      // Notify current (old) manager if different from receiving manager
      if (mgrOldEmail && mgrOldEmail !== receivingManagerEmail && mgrOldEmail !== changeData.requesterEmail) {
        sendFormEmail({
          to: mgrOldEmail,
          subject: 'Status Change Approved',
          body: 'HR has approved a status change for <strong>' + changeData.employeeName + '</strong>, who currently reports to you. The change takes effect on <strong>' + changeData.effDate + '</strong>.' +
                (notes ? '<br><br><em>HR Notes: ' + notes + '</em>' : ''),
          contextData: changeContext
        });
      }

      // 2. Specialist action items — based on what was requested
      const allSystems = changeData.systems ? changeData.systems.split(', ') : [];
      const equipList  = changeData.equipment ? changeData.equipment.split(', ') : [];

      // Business Cards
      if (equipList.includes('Business Cards')) {
        const bcDesc = JSON.stringify([
          'Verify updated name, job title, email, and site with requester',
          'Place updated business card order for ' + changeData.employeeName,
          'Confirm order placed and provide delivery timeline to manager'
        ]);
        const bcTid = ActionItemService.createActionItem(workflowId, 'Business Cards', 'Business Cards Order', bcDesc, CONFIG.EMAILS.BUSINESS_CARDS, 'businesscards');
        tasksCreated++;
        sendFormEmail({
          to: CONFIG.EMAILS.BUSINESS_CARDS,
          subject: 'Business Cards Action Required',
          body: 'A status change has been approved for <strong>' + changeData.employeeName + '</strong>. Please process the digital business card order.',
          formUrl: buildFormUrl('action_item_view', { tid: bcTid }),
          contextData: changeContext
        });
      }

      // Credit Card
      if (equipList.includes('Credit Card')) {
        const ccDesc = JSON.stringify([
          'Verify card type(s) required for new role (USA / Canada / Home Depot)',
          'Submit credit card application for ' + changeData.employeeName,
          'Confirm application submitted and card delivery timeline'
        ]);
        const ccTid = ActionItemService.createActionItem(workflowId, 'Credit Card', 'Credit Card Order', ccDesc, CONFIG.EMAILS.CREDIT_CARD, 'creditcard');
        tasksCreated++;
        sendFormEmail({
          to: CONFIG.EMAILS.CREDIT_CARD,
          subject: 'Credit Card Action Required',
          body: 'A status change has been approved for <strong>' + changeData.employeeName + '</strong>. Please process the credit card application.',
          formUrl: buildFormUrl('action_item_view', { tid: ccTid }),
          contextData: changeContext
        });
      }

      // Fleetio
      if (allSystems.includes('Fleetio')) {
        const flDesc = JSON.stringify([
          'Update Fleetio account for ' + changeData.employeeName + ' to reflect new site/role',
          'Update vehicle assignment — assign vehicles appropriate for new location',
          'Remove access to vehicles no longer required',
          'Confirm employee has correct vehicle access and account is active'
        ]);
        const flTid = ActionItemService.createActionItem(workflowId, 'Fleetio', 'Fleetio Access Update', flDesc, CONFIG.EMAILS.FLEETIO, 'fleetio');
        tasksCreated++;
        sendFormEmail({
          to: CONFIG.EMAILS.FLEETIO,
          subject: 'Fleetio Action Required',
          body: 'A status change has been approved for <strong>' + changeData.employeeName + '</strong>. Please update their Fleetio vehicle access.',
          formUrl: buildFormUrl('action_item_view', { tid: flTid }),
          contextData: changeContext
        });
      }

      // Jonas Purchasing
      if (allSystems.includes('Jonas Purchasing')) {
        const jDesc = JSON.stringify([
          'Update Jonas Purchasing job number assignments for ' + changeData.employeeName,
          'Remove access for old job sites no longer required',
          'Confirm all required job numbers are active and accessible'
        ]);
        const jTid = ActionItemService.createActionItem(workflowId, 'Jonas', 'Jonas Purchasing Update', jDesc, CONFIG.EMAILS.JONAS, 'jonas');
        tasksCreated++;
        sendFormEmail({
          to: CONFIG.EMAILS.JONAS,
          subject: 'Jonas Purchasing Action Required',
          body: 'A status change has been approved for <strong>' + changeData.employeeName + '</strong>. Please update their Jonas Purchasing access.',
          formUrl: buildFormUrl('action_item_view', { tid: jTid }),
          contextData: changeContext
        });
      }

      // Central Purchasing
      if (allSystems.includes('Central Purchasing') || changeData.purchasingSites) {
        const cpDesc = JSON.stringify([
          'Update Central Purchasing site access for ' + changeData.employeeName,
          changeData.purchasingSites ? 'Required sites: ' + changeData.purchasingSites : 'Confirm required purchasing sites with manager',
          'Remove access for old sites no longer required',
          'Confirm all purchasing sites are configured and active'
        ]);
        const cpTid = ActionItemService.createActionItem(workflowId, 'Purchasing', 'Central Purchasing Update', cpDesc, CONFIG.EMAILS.JONAS, 'centralpurchasing');
        tasksCreated++;
        sendFormEmail({
          to: CONFIG.EMAILS.JONAS,
          subject: 'Central Purchasing Action Required',
          body: 'A status change has been approved for <strong>' + changeData.employeeName + '</strong>. Please update their Central Purchasing site access.',
          formUrl: buildFormUrl('action_item_view', { tid: cpTid }),
          contextData: changeContext
        });
      }

      // IT — remaining systems + equipment (excluding specialist-handled)
      const itSystems = allSystems.filter(function(s) {
        return s !== 'Central Purchasing' && s !== 'Jonas Purchasing' && s !== 'Fleetio' && s !== 'SiteDocs';
      });
      const itEquip = equipList.filter(function(e) {
        return e !== 'Business Cards' && e !== 'Credit Card' && e !== 'Vehicle';
      });
      if (itSystems.length > 0 || itEquip.length > 0) {
        const itDescItems = [];
        itSystems.forEach(function(s) { itDescItems.push('Provision access: ' + s); });
        itEquip.forEach(function(e)   { itDescItems.push('Provision equipment: ' + e); });
        const itTid = ActionItemService.createActionItem(workflowId, 'IT', 'IT Access & Equipment Setup', JSON.stringify(itDescItems), CONFIG.EMAILS.IT);
        tasksCreated++;
        sendFormEmail({
          to: CONFIG.EMAILS.IT,
          subject: 'IT Action Required',
          body: 'A status change has been approved for <strong>' + changeData.employeeName + '</strong>. Please set up the requested system access and/or equipment listed in the action item.',
          formUrl: buildFormUrl('action_item_view', { tid: itTid }),
          contextData: changeContext
        });
      }

      // 3. ID Setup — update BOSS WIS records only
      // Also handles new SiteDocs account if requested (SiteDocs in systems)
      var idDescItems = ['Update BOSS WIS records to reflect the new position/site for ' + changeData.employeeName + '.'];
      if (allSystems.includes('SiteDocs')) {
        idDescItems.push('Create new SiteDocs supervisor account as requested.');
      }
      const idTid = ActionItemService.createActionItem(
        workflowId, 'ID Setup', 'BOSS WIS Records Update',
        JSON.stringify(idDescItems), CONFIG.EMAILS.IDSETUP
      );
      tasksCreated++;
      sendFormEmail({
        to: CONFIG.EMAILS.IDSETUP,
        subject: 'BOSS WIS Update Required',
        body: 'A status change has been approved for <strong>' + changeData.employeeName + '</strong>. Please update BOSS WIS records to reflect the new position and/or site.' +
              (allSystems.includes('SiteDocs') ? ' A new SiteDocs supervisor account has also been requested.' : ''),
        formUrl: buildFormUrl('action_item_view', { tid: idTid }),
        displayName: 'TEAM Group - Employee Management',
        contextData: changeContext
      });

      // 4. Safety — update DSS site/learning path and SiteDocs site (not a new account)
      var safDescItems = [
        'Update DSS site assignment and learning path for ' + changeData.employeeName + ' to reflect the new position/site.',
        'Update SiteDocs site assignment for ' + changeData.employeeName + '.'
      ];
      // If a new SiteDocs account was requested, that's handled by ID Setup — safety only updates existing
      if (allSystems.includes('SiteDocs')) {
        safDescItems[1] = 'Note: New SiteDocs account creation is handled by ID Setup — verify assignment after account is created.';
      }
      const safTid = ActionItemService.createActionItem(
        workflowId, 'Safety', 'Safety System Updates',
        JSON.stringify(safDescItems), CONFIG.EMAILS.SAFETY, 'safety_change'
      );
      tasksCreated++;
      sendFormEmail({
        to: CONFIG.EMAILS.SAFETY,
        subject: 'Safety System Updates Required',
        body: 'A status change has been approved for <strong>' + changeData.employeeName + '</strong>. Please update their DSS site and learning path, and update their SiteDocs site assignment.',
        formUrl: buildFormUrl('action_item_view', { tid: safTid }),
        displayName: 'TEAM Group - Employee Management',
        contextData: changeContext
      });

      updateWorkflow(workflowId, 'In Progress', tasksCreated > 0 ? 'Action Items Pending' : 'Change Processed');
      syncWorkflowState(workflowId);

      // Notify payroll
      sendFormEmail({
        to: CONFIG.EMAILS.PAYROLL,
        subject: 'Status Change Approved',
        body: 'HR has approved a status change for <strong>' + changeData.employeeName + '</strong>.' +
              (notes ? '<br><br><em>HR Notes: ' + notes + '</em>' : ''),
        contextData: changeContext
      });

      // Notify requester
      const scRecipients = [changeData.requesterEmail];
      if (mgrNewEmail && mgrNewEmail !== changeData.requesterEmail) scRecipients.push(mgrNewEmail);
      sendFormEmail({
        to: scRecipients.join(','),
        subject: 'Status Change Approved',
        body: 'HR has approved the status change for <strong>' + changeData.employeeName + '</strong>. All relevant teams have been notified and action items have been assigned.' +
              (notes ? '<br><br><em>HR Notes: ' + notes + '</em>' : ''),
        contextData: changeContext
      });

      return { success: true, message: 'Status change approved. ' + tasksCreated + ' action items generated.' };
    } else {
      updateWorkflow(workflowId, 'Rejected', 'Rejected by HR');
      syncWorkflowState(workflowId);
      return { success: true, message: 'Position change rejected.' };
    }
  } catch (e) {
    return { success: false, message: e.message };
  }
}
