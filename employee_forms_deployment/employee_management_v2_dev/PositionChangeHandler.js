/**
 * Position / Site Change Request - Backend Handler
 */

function servePositionSiteChange() {
  const template = HtmlService.createTemplateFromFile('PositionSiteChangeRequest');
  template.referenceData = JSON.stringify(getInitialFormData());
  template.mode          = '';
  template.workflowId    = '';
  template.requestData   = 'null';
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
    
    // Validate manager fields were selected from directory (name auto-fills only on directory select)
    if (formData.currentManagerEmail && !formData.currentManagerName) {
      return { success: false, message: 'Current manager must be selected from the directory lookup — please search and select a name.' };
    }
    if (formData.mgrNewEmail && !formData.mgrNewName) {
      return { success: false, message: 'New manager must be selected from the directory lookup — please search and select a name.' };
    }
    if (formData.mgrOldEmail && !formData.mgrOldName) {
      return { success: false, message: 'Previous manager must be selected from the directory lookup — please search and select a name.' };
    }

    const sheetSuccess = addSheetRow(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.POSITION_CHANGES, rowData);
    if (!sheetSuccess) throw new Error('Failed to record position change in sheet');
    
    updateWorkflow(workflowId, 'In Progress', 'HR Approval Needed', formData.firstName + ' ' + formData.lastName);
    syncWorkflowState(workflowId);

    // Notify HR, Payroll, and current manager — extracted helper so ReplayService can refire missed emails
    _sendPositionChangeSubmitEmails(workflowId);

    return { success: true, workflowId: workflowId, message: 'Change request submitted and sent to HR for approval.' };
  } catch (error) {
    Logger.log('[ERROR] Position change submission error: ' + error.toString());
    return { success: false, message: 'Error: ' + error.message };
  }
}

/**
 * Send submission-time notification emails for a Position Change workflow.
 * Reads from the Position Changes sheet — safe to call after the row is written.
 * Also called by ReplayService to refire missed emails without writing new records.
 */
function _sendPositionChangeSubmitEmails(workflowId) {
  const pcData = getPositionChangeData(workflowId);
  if (!pcData) {
    Logger.log('[PositionChangeHandler] _sendPositionChangeSubmitEmails: no data for ' + workflowId);
    return;
  }
  const approvalUrl  = buildFormUrl('position_change_approval', { wf: workflowId });
  const wfContext    = getWorkflowContext(workflowId) || {};
  const finalContext = {
    ...wfContext,
    workflowType:    'Status Change',
    department:      pcData.department || '',
    employeeName:    pcData.employeeName,
    siteName:        pcData.siteName,
    jobTitle:        pcData.titleChange || '',
    hireDate:        pcData.effDate,
    requestDate:     new Date().toLocaleDateString(),
    requesterEmail:  pcData.requesterEmail,
    changeTypes:     pcData.changes,
    siteTransfer:    pcData.siteTransfer,
    titleChange:     pcData.titleChange,
    classChange:     pcData.classChange,
    managerChange:   pcData.managerChange,
    managerEmail:    pcData.mgrNewEmail || '',
    managerOldEmail: pcData.currentManagerEmail || '',
    managerNewEmail: pcData.mgrNewEmail || ''
  };
  const emailBody = 'A new status change request has been submitted for ' + pcData.employeeName + '. Please review and approve or reject using the button below.';
  sendFormEmail({ to: CONFIG.EMAILS.HR,      subject: 'HR Approval Required', body: emailBody, formUrl: approvalUrl, contextData: finalContext });
  sendFormEmail({ to: CONFIG.EMAILS.PAYROLL, subject: 'HR Approval Required', body: emailBody, formUrl: approvalUrl, contextData: finalContext });
  if (pcData.currentManagerEmail && pcData.currentManagerEmail !== pcData.requesterEmail) {
    sendFormEmail({
      to: pcData.currentManagerEmail,
      subject: 'Status Change Initiated',
      body: 'A status change request has been submitted for ' + pcData.employeeName + ', who currently reports to you. The change is pending HR review. You will be notified of the outcome.',
      contextData: finalContext
    });
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
  const PC = SCHEMA.POSITION_CHANGES;
  return {
    workflowId:            data[PC.WORKFLOW_ID],
    employeeName:          data[PC.EMPLOYEE_NAME],
    empID:                 data[PC.EMPLOYEE_ID],
    effDate:               data[PC.EFFECTIVE_DATE] ? (data[PC.EFFECTIVE_DATE] instanceof Date ? Utilities.formatDate(new Date(data[PC.EFFECTIVE_DATE]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : data[PC.EFFECTIVE_DATE]) : '',
    siteName:              data[PC.CURRENT_SITE],
    changes:               data[PC.CHANGE_TYPES],
    jobTitle:              (function() { var t = data[PC.TITLE_CHANGE] || ''; var idx = t.indexOf(' -> '); var v = idx !== -1 ? t.substring(idx + 4).trim() : t.trim(); return (v && v !== 'N/A') ? v : ''; })(),
    siteTransfer:          data[PC.SITE_TRANSFER],
    titleChange:           data[PC.TITLE_CHANGE],
    classChange:           data[PC.CLASSIFICATION],
    managerChange:         data[PC.MANAGER_CHANGE],
    systems:               data[PC.SYSTEMS_ADDED],
    equipment:             data[PC.EQUIPMENT],
    requesterEmail:        data[PC.REQUESTER_EMAIL],
    comments:              data[PC.COMMENTS],
    department:            data[PC.DEPARTMENT]             || '',
    purchasingSites:       data[PC.PURCHASING_SITES]        || '',
    receivingManagerEmail: data[PC.RECEIVING_MANAGER_EMAIL] || '',
    currentTitle:          data[PC.CURRENT_TITLE]           || '',
    currentManagerEmail:   data[PC.CURRENT_MANAGER_EMAIL]   || '',
    currentManagerName:    data[PC.CURRENT_MANAGER_NAME]    || '',
    currentClass:          data[PC.CURRENT_CLASS]           || '',
    mgrNewEmail: (function() {
      var m = (String(data[PC.MANAGER_CHANGE] || '')).match(/\(([^)@\s]+@[^)\s]+)\)/g) || [];
      return m.length > 1 ? m[1].replace(/[()]/g, '') : (m.length === 1 ? m[0].replace(/[()]/g, '') : '');
    })(),
    oldReportsTo:          data[PC.REASSIGN_OLD_REPORTS]   || '',
    newReportsFrom:        data[PC.GAIN_NEW_REPORTS]        || ''
  };
}

/**
 * Handle HR Approval for Position Change
 */
function submitPositionChangeApproval(formData) {
  try {
    const { workflowId, decision, notes, confirmedNewManager, confirmedTitle, confirmedJrTitle } = formData;
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

      // Determine which teams will receive action items — used by context block Section 6
      // (populated incrementally below and passed into all post-approval emails)
      const approvalActionTeams = [];

      // Build enriched context for all approval emails
      const changeContext = {
        workflowType: 'Status Change',
        department: changeData.department || '',
        employeeName: changeData.employeeName,
        jobTitle: effectiveTitle,
        siteName: changeData.siteName,
        hireDate: changeData.effDate,
        requestDate: changeData.effDate,   // used for section sub-label
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
        currentManagerName: changeData.currentManagerName || '',
        currentManagerEmail: mgrOldEmail,
        systems: changeData.systems,
        equipmentRaw: changeData.equipment,
        purchasingSites: changeData.purchasingSites || '',
        employmentType: changeData.currentClass || '',
        currentTitle: changeData.currentTitle || '',
        oldReportsTo: changeData.oldReportsTo || '',
        newReportsFrom: changeData.newReportsFrom || '',
        hrDecision: 'Approved',
        hrNotes: notes || '',
        confirmedTitle: effectiveTitle,
        confirmedJrTitle: (confirmedJrTitle && confirmedJrTitle.trim()) ? confirmedJrTitle.trim() : '',
        confirmedNewManager: receivingManagerEmail || '',
        actionTeams: approvalActionTeams   // filled below; same array reference
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
        approvalActionTeams.push('Receiving Manager (' + receivingManagerEmail + ')');
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
        approvalActionTeams.push('Business Cards');
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
        approvalActionTeams.push('Credit Card');
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
        approvalActionTeams.push('Fleetio');
        sendFormEmail({
          to: CONFIG.EMAILS.FLEETIO,
          subject: 'Fleetio Action Required',
          body: 'A status change has been approved for <strong>' + changeData.employeeName + '</strong>. Please update their Fleetio vehicle access.',
          formUrl: buildFormUrl('action_item_view', { tid: flTid }),
          contextData: changeContext
        });
      }

      // Central Purchasing/Jonas
      if (allSystems.includes('Central Purchasing/Jonas') || changeData.purchasingSites) {
        const cpjDesc = JSON.stringify([
          'Update Central Purchasing/Jonas access for ' + changeData.employeeName,
          changeData.purchasingSites ? 'Required purchasing sites: ' + changeData.purchasingSites : 'Confirm required purchasing sites with manager',
          changeData.jonasJobNumbers  ? 'Jonas job numbers: ' + changeData.jonasJobNumbers        : 'Update Jonas job number assignments',
          'Remove access for old sites/job numbers no longer required',
          'Confirm all purchasing sites and job numbers are configured and active'
        ]);
        const cpjTid = ActionItemService.createActionItem(workflowId, 'Jonas', 'Central Purchasing/Jonas Update', cpjDesc, CONFIG.EMAILS.JONAS, 'jonas');
        tasksCreated++;
        approvalActionTeams.push('Central Purchasing/Jonas');
        sendFormEmail({
          to: CONFIG.EMAILS.JONAS,
          subject: 'Central Purchasing/Jonas Action Required',
          body: 'A status change has been approved for <strong>' + changeData.employeeName + '</strong>. Please update their Central Purchasing/Jonas access.',
          formUrl: buildFormUrl('action_item_view', { tid: cpjTid }),
          contextData: changeContext
        });
      }

      // IT — remaining systems + equipment (excluding specialist-handled)
      const itSystems = allSystems.filter(function(s) {
        return s !== 'Central Purchasing/Jonas' && s !== 'Fleetio' && s !== 'SiteDocs';
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
        approvalActionTeams.push('IT');
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
      approvalActionTeams.push('ID Setup');
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
      approvalActionTeams.push('Safety');
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
      approvalActionTeams.push('Payroll');
      var payrollBody = 'HR has approved a status change for <strong>' + changeData.employeeName + '</strong>.';
      if (changeData.newReportsFrom && changeData.newReportsFrom !== 'N/A') {
        payrollBody += '<br><br><strong>Direct Report Reassignment:</strong> ' + changeData.employeeName + '\'s direct reports are being reassigned to <strong>' + changeData.newReportsFrom + '</strong>. Please update ADP reporting structure accordingly.';
      } else if (changeData.oldReportsTo && changeData.oldReportsTo !== 'N/A') {
        payrollBody += '<br><br><strong>Direct Reports:</strong> ' + changeData.employeeName + ' currently has direct reports (' + changeData.oldReportsTo + '). Please confirm reassignment with HR and update ADP reporting structure.';
      }
      if (notes) payrollBody += '<br><br><em>HR Notes: ' + notes + '</em>';
      sendFormEmail({
        to: CONFIG.EMAILS.PAYROLL,
        subject: 'Status Change Approved',
        body: payrollBody,
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

      // Notify requester + current manager of rejection
      const changeDataRej = getPositionChangeData(workflowId);
      const mgrMatchesRej = (changeDataRej.managerChange || '').match(/\(([^)@\s]+@[^)\s]+)\)/g) || [];
      const mgrOldEmailRej = changeDataRej.currentManagerEmail
        || (mgrMatchesRej.length > 0 ? mgrMatchesRej[0].replace(/[()]/g, '') : '');
      const rejRecipients = [changeDataRej.requesterEmail];
      if (mgrOldEmailRej && mgrOldEmailRej !== changeDataRej.requesterEmail) rejRecipients.push(mgrOldEmailRej);

      sendFormEmail({
        to: rejRecipients.join(','),
        subject: 'Status Change Rejected',
        body: 'The status change request for <strong>' + changeDataRej.employeeName + '</strong> has been rejected by HR.' +
              (notes ? '<br><br><em>HR Notes: ' + notes + '</em>' : ''),
        contextData: {
          workflowType: 'Status Change',
          employeeName: changeDataRej.employeeName,
          siteName: changeDataRej.siteName,
          hireDate: changeDataRej.effDate,
          requesterEmail: changeDataRej.requesterEmail,
          changeTypes: changeDataRej.changes,
          siteTransfer: changeDataRej.siteTransfer,
          titleChange: changeDataRej.titleChange,
          classChange: changeDataRej.classChange,
          managerChange: changeDataRej.managerChange,
          currentTitle: changeDataRej.currentTitle || '',
          currentManagerName: changeDataRej.currentManagerName || '',
          currentManagerEmail: mgrOldEmailRej,
          employmentType: changeDataRej.currentClass || '',
          systems: changeDataRej.systems,
          equipmentRaw: changeDataRej.equipment,
          hrDecision: 'Rejected',
          hrNotes: notes || ''
        }
      });

      return { success: true, message: 'Position change rejected. Requester notified.' };
    }
  } catch (e) {
    return { success: false, message: e.message };
  }
}
