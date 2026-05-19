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
    formData.formId     = formId;
    formData.timestamp  = new Date();

    // Validate manager fields were selected from directory
    if (formData.currentManagerEmail && !formData.currentManagerName) {
      return { success: false, message: 'Current manager must be selected from the directory lookup — please search and select a name.' };
    }
    if (formData.mgrNewEmail && !formData.mgrNewName) {
      return { success: false, message: 'New manager must be selected from the directory lookup — please search and select a name.' };
    }
    if (formData.mgrOldEmail && !formData.mgrOldName) {
      return { success: false, message: 'Previous manager must be selected from the directory lookup — please search and select a name.' };
    }

    // ── Upload attachment to Drive if provided ──────────────────────────────
    let attachmentUrl = '';
    if (formData.attachmentBase64 && formData.attachmentName) {
      try {
        const bytes = Utilities.base64Decode(formData.attachmentBase64);
        const blob = Utilities.newBlob(bytes, formData.attachmentMimeType || 'application/octet-stream', formData.attachmentName);
        const safeName = 'CHANGE_' + String((formData.firstName || '') + '_' + (formData.lastName || '') || workflowId).replace(/\s/g, '_') + '_' + formData.attachmentName;
        blob.setName(safeName);
        const folder = DriveApp.getFolderById(CONFIG.CHANGE_FOLDER_ID);
        attachmentUrl = folder.createFile(blob).getUrl();
        Logger.log('[PositionChangeHandler] Attachment saved: ' + attachmentUrl);
      } catch (attErr) {
        Logger.log('[PositionChangeHandler] Attachment upload failed: ' + attErr.message);
      }
    }

    // ── Flatten array fields ────────────────────────────────────────────────
    const csv = function(v) {
      if (Array.isArray(v)) return v.filter(Boolean).join(', ');
      return v ? String(v) : '';
    };

    const changes        = csv(formData.changeType);
    const systems        = csv(formData.sys);
    const equipment      = csv(formData.equip);
    const removal        = csv(formData.rem);
    const equipReturn    = csv(formData.equipRem);
    const purchasingSites= csv(formData.purchasingSites);
    const adpSites       = csv(formData.adpSites);
    const bossComm       = csv(formData.bossComm);
    const bossCostJobs   = csv(formData.bossCostJobs);
    const jonasJobs      = csv(formData.jonasJobs);

    // ── Build 60-column rowData ─────────────────────────────────────────────
    const rowData = [
      // 0-27: original columns
      workflowId,                                                                               // 0  WORKFLOW_ID
      formId,                                                                                   // 1  FORM_ID
      formData.timestamp,                                                                       // 2  TIMESTAMP (server submit time)
      formData.reqName   || '',                                                                 // 3  REQUESTER_NAME
      formData.reqEmail  || '',                                                                 // 4  REQUESTER_EMAIL
      (formData.firstName || '') + ' ' + (formData.lastName || ''),                            // 5  EMPLOYEE_NAME
      'N/A',                                                                                    // 6  EMPLOYEE_ID (legacy)
      formData.effDate   || '',                                                                 // 7  EFFECTIVE_DATE
      formData.siteName  || '',                                                                 // 8  CURRENT_SITE
      changes,                                                                                  // 9  CHANGE_TYPES
      (formData.siteOld  || 'N/A') + ' -> ' + (formData.siteNew  || 'N/A'),                   // 10 SITE_TRANSFER
      (formData.titleOld || 'N/A') + ' -> ' + (formData.titleNew || 'N/A'),                   // 11 TITLE_CHANGE
      (formData.classOld || 'N/A') + ' -> ' + (formData.classNew || 'N/A'),                   // 12 CLASSIFICATION
      (formData.mgrOldName  || 'N/A') + ' (' + (formData.mgrOldEmail  || 'N/A') + ') -> ' +
      (formData.mgrNewName  || 'N/A') + ' (' + (formData.mgrNewEmail  || 'N/A') + ')',         // 13 MANAGER_CHANGE
      formData.oldReportsTo   || '',                                                            // 14 REASSIGN_OLD_REPORTS
      formData.newReportsFrom || '',                                                            // 15 GAIN_NEW_REPORTS
      (formData.existingEmail || 'N/A') + ' -> ' +
        (formData.googleEmail ? formData.googleEmail + '@' + (formData.googleDomain || '') : 'N/A'), // 16 GOOGLE_ACCOUNT
      systems,                                                                                  // 17 SYSTEMS_ADDED
      equipment,                                                                                // 18 EQUIPMENT
      removal,                                                                                  // 19 REMOVED_ACCESS
      formData.comments  || '',                                                                 // 20 COMMENTS
      formData.department || '',                                                                // 21 DEPARTMENT
      purchasingSites,                                                                          // 22 PURCHASING_SITES
      formData.receivingManagerEmail || '',                                                     // 23 RECEIVING_MANAGER_EMAIL
      formData.currentTitle          || '',                                                     // 24 CURRENT_TITLE
      formData.currentManagerEmail   || '',                                                     // 25 CURRENT_MANAGER_EMAIL
      formData.currentManagerName    || '',                                                     // 26 CURRENT_MANAGER_NAME
      formData.currentClass          || '',                                                     // 27 CURRENT_CLASS
      // 28-59: extended columns (2026-05-14)
      formData.reqDate               || '',                                                     // 28 DATE_REQUESTED
      formData.firstName             || '',                                                     // 29 FIRST_NAME
      formData.lastName              || '',                                                     // 30 LAST_NAME
      formData.bossTrainingOnly      || '',                                                     // 31 BOSS_TRAINING_ONLY
      bossComm,                                                                                 // 32 BOSS_SITES (committees)
      formData.bossCost              || '',                                                     // 33 BOSS_COST_SHEET
      bossCostJobs,                                                                             // 34 BOSS_COST_JOBS
      formData.bossTrip              || '',                                                     // 35 BOSS_TRIP
      formData.bossGriev             || '',                                                     // 36 BOSS_GRIEVANCES
      adpSites,                                                                                 // 37 ADP_SITES
      formData.adpSalaryAccess       || '',                                                     // 38 ADP_SALARY_ACCESS
      formData.jrReq                 || '',                                                     // 39 JR_REQUIRED
      formData.jrTitle               || '',                                                     // 40 JR_ASSIGNMENT
      formData.plan306090            || '',                                                     // 41 PLAN_306090
      formData.computerRequestType   || '',                                                     // 42 COMPUTER_REQ
      formData.computerType          || '',                                                     // 43 COMPUTER_TYPE
      formData.computerPreviousUser  || '',                                                     // 44 COMPUTER_PREV_USER
      formData.computerPreviousType  || '',                                                     // 45 COMPUTER_PREV_TYPE
      formData.computerSerialNumber  || '',                                                     // 46 COMPUTER_SERIAL
      formData.office365Required     || '',                                                     // 47 OFFICE_365
      formData.creditCardUSA         || '',                                                     // 48 CC_USA
      formData.creditCardLimitUSA    || '',                                                     // 49 CC_LIMIT_USA
      formData.creditCardCanada      || '',                                                     // 50 CC_CAN
      formData.creditCardLimitCanada || '',                                                     // 51 CC_LIMIT_CAN
      formData.creditCardHomeDepot   || '',                                                     // 52 CC_HD
      formData.creditCardLimitHomeDepot || '',                                                  // 53 CC_LIMIT_HD
      formData.phoneRequestType      || '',                                                     // 54 PHONE_REQ
      formData.phonePreviousUser     || '',                                                     // 55 PHONE_PREV_USER
      formData.phonePreviousNumber   || '',                                                     // 56 PHONE_PREV_NUMBER
      jonasJobs,                                                                                // 57 JONAS_JOB_NUMBERS
      equipReturn,                                                                              // 58 EQUIPMENT_RETURN
      'In Progress',                                                                            // 59 STATUS
      attachmentUrl                                                                             // 60 ATTACHMENT_URL
    ];

    const sheetSuccess = addSheetRow(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.POSITION_CHANGES, rowData);
    if (!sheetSuccess) throw new Error('Failed to record position change in sheet');

    updateWorkflow(workflowId, 'In Progress', 'HR Approval Needed', formData.firstName + ' ' + formData.lastName);
    syncWorkflowState(workflowId);

    // Notify HR, Payroll, and current manager — extracted so ReplayService can refire missed emails
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

  // Helper: parse date values safely
  const fmtDate = function(v) {
    if (!v) return '';
    if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    return String(v).substring(0, 10);
  };

  // Helper: parse new manager email from combined MANAGER_CHANGE string
  const parseNewMgrEmail = function() {
    var m = (String(data[PC.MANAGER_CHANGE] || '')).match(/\(([^)@\s]+@[^)\s]+)\)/g) || [];
    return m.length > 1 ? m[1].replace(/[()]/g, '') : (m.length === 1 ? m[0].replace(/[()]/g, '') : '');
  };

  // Helper: parse new title from TITLE_CHANGE "old -> new"
  const parseNewTitle = function() {
    var t = String(data[PC.TITLE_CHANGE] || '');
    var idx = t.indexOf(' -> ');
    var v = idx !== -1 ? t.substring(idx + 4).trim() : t.trim();
    return (v && v !== 'N/A') ? v : '';
  };

  // Helper: parse new class from CLASSIFICATION "old -> new"
  const parseNewClass = function() {
    var c = String(data[PC.CLASSIFICATION] || '');
    var idx = c.indexOf(' -> ');
    return idx !== -1 ? c.substring(idx + 4).trim() : '';
  };

  return {
    // Core
    workflowId:            String(data[PC.WORKFLOW_ID]          || ''),
    employeeName:          String(data[PC.EMPLOYEE_NAME]         || ''),
    firstName:             String(data[PC.FIRST_NAME]            || ''),
    lastName:              String(data[PC.LAST_NAME]             || ''),
    empID:                 String(data[PC.EMPLOYEE_ID]           || ''),
    effDate:               fmtDate(data[PC.EFFECTIVE_DATE]),
    dateRequested:         fmtDate(data[PC.DATE_REQUESTED]),
    siteName:              String(data[PC.CURRENT_SITE]          || ''),
    requesterEmail:        String(data[PC.REQUESTER_EMAIL]       || ''),
    requesterName:         String(data[PC.REQUESTER_NAME]        || ''),
    comments:              String(data[PC.COMMENTS]              || ''),
    department:            String(data[PC.DEPARTMENT]            || ''),
    // Change tracking (delta)
    changes:               String(data[PC.CHANGE_TYPES]          || ''),
    siteTransfer:          String(data[PC.SITE_TRANSFER]         || ''),
    titleChange:           String(data[PC.TITLE_CHANGE]          || ''),
    classChange:           String(data[PC.CLASSIFICATION]        || ''),
    managerChange:         String(data[PC.MANAGER_CHANGE]        || ''),
    // Derived values from delta strings
    jobTitle:              parseNewTitle(),
    newClass:              parseNewClass(),
    mgrNewEmail:           parseNewMgrEmail(),
    // Reporting management
    oldReportsTo:          String(data[PC.REASSIGN_OLD_REPORTS]  || ''),
    newReportsFrom:        String(data[PC.GAIN_NEW_REPORTS]      || ''),
    // Google account
    googleAccount:         String(data[PC.GOOGLE_ACCOUNT]        || ''),
    // Systems and equipment
    systems:               String(data[PC.SYSTEMS_ADDED]         || ''),
    equipment:             String(data[PC.EQUIPMENT]             || ''),
    removalAccess:         String(data[PC.REMOVED_ACCESS]        || ''),
    equipmentReturn:       String(data[PC.EQUIPMENT_RETURN]      || ''),
    // Receiving / new manager
    receivingManagerEmail: String(data[PC.RECEIVING_MANAGER_EMAIL] || ''),
    purchasingSites:       String(data[PC.PURCHASING_SITES]      || ''),
    // Current state (before change)
    currentTitle:          String(data[PC.CURRENT_TITLE]         || ''),
    currentManagerEmail:   String(data[PC.CURRENT_MANAGER_EMAIL] || ''),
    currentManagerName:    String(data[PC.CURRENT_MANAGER_NAME]  || ''),
    currentClass:          String(data[PC.CURRENT_CLASS]         || ''),
    // BOSS details
    bossTrainingOnly:      String(data[PC.BOSS_TRAINING_ONLY]    || ''),
    bossSites:             String(data[PC.BOSS_SITES]            || ''),
    bossCostSheet:         String(data[PC.BOSS_COST_SHEET]       || ''),
    bossCostJobs:          String(data[PC.BOSS_COST_JOBS]        || ''),
    bossTrip:              String(data[PC.BOSS_TRIP]             || ''),
    bossGrievances:        String(data[PC.BOSS_GRIEVANCES]       || ''),
    // ADP details
    adpSites:              String(data[PC.ADP_SITES]             || ''),
    adpSalaryAccess:       String(data[PC.ADP_SALARY_ACCESS]     || ''),
    // JR / training
    jrRequired:            String(data[PC.JR_REQUIRED]           || ''),
    jrTitle:               String(data[PC.JR_ASSIGNMENT]         || ''),
    plan306090:            String(data[PC.PLAN_306090]           || ''),
    // Computer
    computerReq:           String(data[PC.COMPUTER_REQ]          || ''),
    computerType:          String(data[PC.COMPUTER_TYPE]         || ''),
    computerPrevUser:      String(data[PC.COMPUTER_PREV_USER]    || ''),
    computerPrevType:      String(data[PC.COMPUTER_PREV_TYPE]    || ''),
    computerSerial:        String(data[PC.COMPUTER_SERIAL]       || ''),
    office365:             String(data[PC.OFFICE_365]            || ''),
    // Credit cards
    ccUSA:                 String(data[PC.CC_USA]                || ''),
    ccLimitUSA:            String(data[PC.CC_LIMIT_USA]          || ''),
    ccCAN:                 String(data[PC.CC_CAN]                || ''),
    ccLimitCAN:            String(data[PC.CC_LIMIT_CAN]          || ''),
    ccHD:                  String(data[PC.CC_HD]                 || ''),
    ccLimitHD:             String(data[PC.CC_LIMIT_HD]           || ''),
    // Phone
    phoneReq:              String(data[PC.PHONE_REQ]             || ''),
    phonePrevUser:         String(data[PC.PHONE_PREV_USER]       || ''),
    phonePrevNumber:       String(data[PC.PHONE_PREV_NUMBER]     || ''),
    // Jonas job numbers
    jonasJobNumbers:       String(data[PC.JONAS_JOB_NUMBERS]     || '')
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
      const remList    = changeData.removalAccess ? changeData.removalAccess.split(', ') : [];
      const retList    = changeData.equipmentReturn ? changeData.equipmentReturn.split(', ') : [];

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

      // Credit Card — new card requested
      if (equipList.includes('Credit Card')) {
        const ccItems = [];
        if (changeData.ccUSA  === 'Yes') ccItems.push('USA Credit Card — Monthly limit: '    + (changeData.ccLimitUSA  || 'not specified'));
        if (changeData.ccCAN  === 'Yes') ccItems.push('Canada Credit Card — Monthly limit: ' + (changeData.ccLimitCAN  || 'not specified'));
        if (changeData.ccHD   === 'Yes') ccItems.push('Home Depot Credit Card — Monthly limit: ' + (changeData.ccLimitHD || 'not specified'));
        if (!ccItems.length) ccItems.push('Verify card type(s) required for new role (USA / Canada / Home Depot) with requester');
        ccItems.push('Submit credit card application for ' + changeData.employeeName);
        ccItems.push('Confirm application submitted and card delivery timeline');
        const ccTid = ActionItemService.createActionItem(workflowId, 'Credit Card', 'Credit Card Order', JSON.stringify(ccItems), CONFIG.EMAILS.CREDIT_CARD, 'creditcard');
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

      // Fleetio — new access
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

      // Fleetio — vehicle return
      if (retList.includes('Vehicle')) {
        const flRetDesc = JSON.stringify([
          'Collect vehicle from ' + changeData.employeeName + ' — effective ' + changeData.effDate,
          'Update vehicle record in Fleetio — unassign from employee',
          'Confirm vehicle condition and log any issues'
        ]);
        const flRetTid = ActionItemService.createActionItem(workflowId, 'Fleetio', 'Vehicle Return', flRetDesc, CONFIG.EMAILS.FLEETIO, 'fleetio');
        tasksCreated++;
        approvalActionTeams.push('Fleetio (Vehicle Return)');
        sendFormEmail({
          to: CONFIG.EMAILS.FLEETIO,
          subject: 'Vehicle Return Required',
          body: 'A status change has been approved for <strong>' + changeData.employeeName + '</strong>. Please collect their vehicle and update Fleetio.',
          formUrl: buildFormUrl('action_item_view', { tid: flRetTid }),
          contextData: changeContext
        });
      }

      // Fleetio — access removal
      if (remList.includes('Fleetio')) {
        const flRemDesc = JSON.stringify([
          'Remove Fleetio access for ' + changeData.employeeName,
          'Unassign all vehicles from employee account',
          'Confirm access has been removed'
        ]);
        const flRemTid = ActionItemService.createActionItem(workflowId, 'Fleetio', 'Fleetio Access Removal', flRemDesc, CONFIG.EMAILS.FLEETIO, 'fleetio');
        tasksCreated++;
        approvalActionTeams.push('Fleetio (Removal)');
        sendFormEmail({
          to: CONFIG.EMAILS.FLEETIO,
          subject: 'Fleetio Access Removal Required',
          body: 'A status change has been approved for <strong>' + changeData.employeeName + '</strong>. Please remove their Fleetio access.',
          formUrl: buildFormUrl('action_item_view', { tid: flRemTid }),
          contextData: changeContext
        });
      }

      // Central Purchasing/Jonas
      if (allSystems.includes('Central Purchasing/Jonas') || changeData.purchasingSites || changeData.jonasJobNumbers) {
        const cpjDesc = JSON.stringify([
          'Update Central Purchasing/Jonas access for ' + changeData.employeeName,
          changeData.purchasingSites  ? 'Required purchasing sites: ' + changeData.purchasingSites   : 'Confirm required purchasing sites with manager',
          changeData.jonasJobNumbers  ? 'Jonas job numbers: '         + changeData.jonasJobNumbers   : 'Update Jonas job number assignments',
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

      // IT — new access provisioning (excludes specialist-handled systems)
      const itSystems = allSystems.filter(function(s) {
        return s !== 'Central Purchasing/Jonas' && s !== 'Fleetio' && s !== 'SiteDocs';
      });
      const itEquip = equipList.filter(function(e) {
        return e !== 'Business Cards' && e !== 'Credit Card' && e !== 'Vehicle';
      });
      // IT access removal (excludes Fleetio and SiteDocs which are specialist-routed)
      const itRemoval = remList.filter(function(s) {
        return s !== 'Fleetio' && s !== 'SiteDocs';
      });
      if (itSystems.length > 0 || itEquip.length > 0 || itRemoval.length > 0) {
        const itDescItems = [];
        // System access provisioning
        if (itSystems.includes('ADP Supervisor Access')) {
          itDescItems.push('Provision ADP Supervisor Access' +
            (changeData.adpSites ? ' — Job sites: ' + changeData.adpSites : '') +
            (changeData.adpSalaryAccess === 'Yes' ? ' — SALARY DATA ACCESS REQUIRED' : ''));
        }
        if (itSystems.includes('BOSS')) {
          if (changeData.bossTrainingOnly === 'Yes') {
            itDescItems.push('Provision BOSS — TRAINING USER ONLY (no committees, cost sheet, trip reports, or grievances)');
          } else {
            itDescItems.push('Provision BOSS access' +
              (changeData.bossSites      ? ' — Committees: '    + changeData.bossSites    : '') +
              (changeData.bossCostSheet === 'Yes' ? ' — Cost Sheet: YES' + (changeData.bossCostJobs ? ' Jobs: ' + changeData.bossCostJobs : '') : '') +
              (changeData.bossTrip      === 'Yes' ? ' — Trip Reports: YES' : '') +
              (changeData.bossGrievances === 'Yes' ? ' — Grievances: YES' : ''));
          }
        }
        itSystems.filter(function(s) { return s !== 'ADP Supervisor Access' && s !== 'BOSS'; })
          .forEach(function(s) { itDescItems.push('Provision access: ' + s); });
        // Equipment provisioning
        itEquip.forEach(function(e) {
          if (e === 'Computer') {
            var cLine = 'Provision computer';
            if (changeData.computerReq === 'New') {
              cLine += ' (New' + (changeData.computerType ? ' — ' + changeData.computerType : '') +
                (changeData.office365 === 'Yes' ? ' — Office 365 required' : '') + ')';
            } else if (changeData.computerReq === 'Reassignment') {
              cLine += ' (Reassignment from ' + (changeData.computerPrevUser || 'previous user') +
                (changeData.computerPrevType ? ' — ' + changeData.computerPrevType : '') +
                (changeData.computerSerial   ? ' — Serial: ' + changeData.computerSerial : '') + ')';
            }
            itDescItems.push(cLine);
          } else if (e === 'Mobile Phone') {
            var pLine = 'Provision mobile phone';
            if (changeData.phoneReq === 'Reassignment') {
              pLine += ' (Reassignment from ' + (changeData.phonePrevUser || 'previous user') +
                (changeData.phonePrevNumber ? ' — ' + changeData.phonePrevNumber : '') + ')';
            }
            itDescItems.push(pLine);
          } else {
            itDescItems.push('Provision equipment: ' + e);
          }
        });
        // Access removal
        itRemoval.forEach(function(s) { itDescItems.push('REMOVE access: ' + s); });
        // Computer return (handled by IT not manager)
        if (retList.includes('Computer')) itDescItems.push('COLLECT computer from employee — update asset records');
        if (retList.includes('Mobile Phone')) itDescItems.push('COLLECT mobile phone from employee — update asset records');
        if (retList.includes('SiteDocs Tablet')) itDescItems.push('COLLECT SiteDocs tablet from employee — update asset records');

        if (itDescItems.length > 0) {
          const itTid = ActionItemService.createActionItem(workflowId, 'IT', 'IT Access & Equipment Setup', JSON.stringify(itDescItems), CONFIG.EMAILS.IT);
          tasksCreated++;
          approvalActionTeams.push('IT');
          sendFormEmail({
            to: CONFIG.EMAILS.IT,
            subject: 'IT Action Required',
            body: 'A status change has been approved for <strong>' + changeData.employeeName + '</strong>. Please complete the IT tasks listed in the action item.',
            formUrl: buildFormUrl('action_item_view', { tid: itTid }),
            contextData: changeContext
          });
        }
      }

      // Asset collection — equipment to return (manager/requester)
      // Handles: Credit Card return (finance via requester), SiteDocs Tablet (if not IT)
      const managerReturnItems = retList.filter(function(e) {
        return e !== 'Computer' && e !== 'Mobile Phone' && e !== 'SiteDocs Tablet' && e !== 'Vehicle';
      });
      // Always create asset checklist if any items to return
      if (retList.length > 0) {
        const assetItems = retList.map(function(e) { return 'Collect: ' + e + ' from ' + changeData.employeeName; });
        assetItems.push('Confirm all items received and in acceptable condition');
        assetItems.push('Note any damaged or missing items');
        const assetRecipients = [changeData.requesterEmail];
        if (receivingManagerEmail && receivingManagerEmail !== changeData.requesterEmail) assetRecipients.push(receivingManagerEmail);
        const assetTid = ActionItemService.createActionItem(workflowId, 'Assets', 'Asset Collection — ' + changeData.employeeName, JSON.stringify(assetItems), assetRecipients[0]);
        tasksCreated++;
        approvalActionTeams.push('Asset Collection');
        sendFormEmail({
          to: assetRecipients.join(','),
          subject: 'Asset Collection Required',
          body: 'HR has approved a status change for <strong>' + changeData.employeeName + '</strong>. The following equipment must be collected: <strong>' + retList.join(', ') + '</strong>.',
          formUrl: buildFormUrl('action_item_view', { tid: assetTid }),
          contextData: changeContext
        });
      }

      // SiteDocs removal — route to Safety not IT
      if (remList.includes('SiteDocs')) {
        const sdRemDesc = JSON.stringify([
          'Remove SiteDocs supervisor access for ' + changeData.employeeName,
          'Confirm access has been removed and account is deactivated'
        ]);
        const sdRemTid = ActionItemService.createActionItem(workflowId, 'Safety', 'SiteDocs Access Removal', sdRemDesc, CONFIG.EMAILS.SAFETY, 'safety_change');
        tasksCreated++;
        approvalActionTeams.push('Safety (SiteDocs Removal)');
        sendFormEmail({
          to: CONFIG.EMAILS.SAFETY,
          subject: 'SiteDocs Access Removal Required',
          body: 'A status change has been approved for <strong>' + changeData.employeeName + '</strong>. Please remove their SiteDocs supervisor access.',
          formUrl: buildFormUrl('action_item_view', { tid: sdRemTid }),
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
