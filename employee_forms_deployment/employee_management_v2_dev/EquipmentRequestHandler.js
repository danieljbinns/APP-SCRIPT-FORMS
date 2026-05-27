/**
 * System & Equipment Access Form - Backend Handler
 *
 * Flow:
 *   1. submitEquipmentRequest → status "IT Confirmation Needed"
 *        → writes to Initial_Requests sheet (same as new hire, different workflowId prefix)
 *        → confirmation email to requester
 *        → IT Confirmation form link to Dave Langohr
 *   2. submitITConfirmation (in ITConfirmationHandler.js) → calls launchEquipmentActionItems()
 *   3. launchEquipmentActionItems:
 *        a. Google Account in systems → create IT email task only, status "Email Setup Needed"
 *        b. Otherwise → launchRemainingEquipmentTasks() immediately
 *   4. ActionItemService.checkWorkflowCompletion detects "Email Setup Needed" all closed
 *        → calls launchRemainingEquipmentTasks()
 *   5. launchRemainingEquipmentTasks → creates all remaining tasks, status "Action Items Pending"
 *   6. All tasks closed → notifyWorkflowClosure (existing shared handler)
 */

function serveEquipmentRequest() {
  const template = HtmlService.createTemplateFromFile('InitialRequest');
  template.referenceData = JSON.stringify(getInitialFormData());
  template.mode          = 'equipment';
  template.baseMode      = 'equipment';
  template.workflowId    = '';
  template.requestData   = 'null';
  return template.evaluate()
    .setTitle('System & Equipment Request')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function submitEquipmentRequest(formData) {
  try {
    rawLog('submitEquipmentRequest', formData);
    // 1. Create Workflow Record
    const workflowId = createWorkflow('EQUIP_REQ', 'System & Equipment Request', formData.reqEmail || formData.requesterEmail);
    const formId = generateFormId('EQUIP');

    formData.workflowId = workflowId;
    formData.formId     = formId;
    formData.timestamp  = new Date();

    // 2. Validate core fields
    const requiredFields = ['firstName', 'lastName', 'siteName', 'managerEmail', 'managerName', 'position'];
    const validation = validateRequiredFields(formData, requiredFields);
    if (!validation.valid) return { success: false, message: validation.message };

    const employeeName = formData.firstName + ' ' + formData.lastName;

    // 3. Set status — awaiting IT Confirmation
    updateWorkflow(workflowId, 'In Progress', 'IT Confirmation Needed', employeeName);

    // 4. Normalize field aliases from equipment form to standard InitialRequest format
    //    (client submits both aliased names AND standard names; prefer standard, fall back to alias)
    formData.requesterName         = formData.requesterName         || formData.reqName   || '';
    formData.requesterEmail        = formData.requesterEmail        || formData.reqEmail  || '';
    formData.positionTitle         = formData.positionTitle         || formData.position  || '';
    formData.reportingManagerEmail = formData.reportingManagerEmail || formData.managerEmail || '';
    formData.reportingManagerName  = formData.reportingManagerName  || formData.managerName  || '';
    formData.systemAccess          = 'Yes'; // equipment requests always involve system/equipment access

    // 5. Write row to Initial_Requests sheet (same sheet as new hire — shares all columns)
    const rowData = formatInitialRequestData(formData);
    const sheetSuccess = addSheetRow(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.INITIAL_REQUESTS, rowData);
    if (!sheetSuccess) throw new Error('Failed to write request to Initial Requests database');

    // 5 & 6. Send confirmation and IT notification — extracted helper so ReplayService can refire missed emails
    _sendEquipmentRequestSubmitEmails(workflowId);

    syncWorkflowState(workflowId);
    Logger.log('[EquipReq] Submitted ' + workflowId + ' for ' + employeeName + '. IT Confirmation sent to Dave.');
    return { success: true, workflowId: workflowId, scriptUrl: getBaseUrl() };

  } catch (error) {
    Logger.log('[ERROR] submitEquipmentRequest: ' + error.toString());
    return { success: false, message: 'Server Error: ' + error.toString() };
  }
}

/**
 * Read an Equipment Request row from Initial_Requests by workflow ID.
 * Delegates to getFullNewHireData (same sheet/schema) and maps to the standard shape
 * used by _sendEquipmentRequestSubmitEmails and launchEquipmentActionItems.
 */
function getEquipmentRequestData(workflowId) {
  const d = getFullNewHireData(workflowId);
  if (!d) return null;
  return {
    workflowId:     d.workflowId,
    requesterName:  d.requesterName,
    requesterEmail: d.requesterEmail,
    employeeName:   (d.firstName + ' ' + d.lastName).trim(),
    firstName:      d.firstName,
    lastName:       d.lastName,
    siteName:       d.siteName,
    jobTitle:       d.positionTitle,
    managerName:    d.managerName,
    managerEmail:   d.managerEmail,
    systems:        Array.isArray(d.systems)   ? d.systems   : [],
    equipment:      Array.isArray(d.equipment) ? d.equipment : [],
    comments:       d.comments,
    department:     d.department
  };
}

/**
 * Send submission-time notification emails for an Equipment Request workflow.
 * Reads from the Equipment_Requests sheet — safe to call after the row is written.
 * Also called by ReplayService to refire missed emails without writing new records.
 */
function _sendEquipmentRequestSubmitEmails(workflowId) {
  const erData = getEquipmentRequestData(workflowId);
  if (!erData) {
    Logger.log('[EquipReq] _sendEquipmentRequestSubmitEmails: no data for ' + workflowId);
    return;
  }
  const context = {
    workflowType:   'Equipment Request',
    workflowId:     workflowId,
    employeeName:   erData.employeeName,
    firstName:      erData.firstName,
    lastName:       erData.lastName,
    siteName:       erData.siteName,
    jobTitle:       erData.jobTitle,
    managerName:    erData.managerName,
    managerEmail:   erData.managerEmail,
    requesterName:  erData.requesterName,
    requesterEmail: erData.requesterEmail,
    systems:        erData.systems,
    equipment:      erData.equipment,
    equipmentRaw:   erData.equipment.join(', '),
    comments:       erData.comments,
    department:     erData.department,
    requestDate:    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')
  };
  if (erData.requesterEmail) {
    sendFormEmail({
      to: erData.requesterEmail,
      subject: 'Request Submitted',
      body: 'Your System & Equipment Access request for <b>' + erData.employeeName + '</b> has been received and is being reviewed by Dave Langohr.\n\nYou will receive updates as the request progresses.',
      displayName: 'TEAM Group — Employee Onboarding',
      contextData: context
    });
  }
  const itConfirmationUrl = buildFormUrl('it_confirmation', { wf: workflowId });
  sendFormEmail({
    to: 'davelangohr@team-group.com',
    subject: 'IT Confirmation Required',
    body: 'A System & Equipment Access request has been submitted for <b>' + erData.employeeName + '</b> and requires your review and confirmation.\n\nPlease review the request details and confirm using the button below.',
    formUrl: itConfirmationUrl,
    displayName: 'TEAM Group — Employee Onboarding',
    contextData: context
  });
}

/**
 * Called by ITConfirmationHandler.submitITConfirmation after IT Confirmation is approved.
 * Phase 1: all IT tasks (Google Account, hardware, software) launch together.
 * Phase 2: non-IT tasks (HR, Finance, Credit Card, Business Cards, Vehicle) launch once
 *   IT closes all their tasks — triggered by ActionItemService.checkWorkflowCompletion.
 * @param {string} workflowId
 */
function launchEquipmentActionItems(workflowId) {
  try {
    const context = getWorkflowContext(workflowId);
    if (!context) {
      Logger.log('[EquipReq] launchEquipmentActionItems: context not found for ' + workflowId);
      return;
    }

    const employeeName = context.employeeName || workflowId;
    const systems  = Array.isArray(context.systems)  ? context.systems  : [];
    const equipment = Array.isArray(context.equipment) ? context.equipment
      : (context.equipmentRaw ? context.equipmentRaw.split(',').map(function(s){ return s.trim(); }).filter(Boolean) : []);

    // Build one combined IT task description (like new hire IT Setup)
    const itDesc = [];

    const needsGoogle = systems.some(function(s) {
      return s.toLowerCase().indexOf('google') !== -1 || s.toLowerCase().indexOf('email') !== -1;
    });
    if (needsGoogle) itDesc.push('Create Google account and assign email address');

    const itHardware = equipment.filter(function(eq) {
      const eql = eq.toLowerCase();
      return eql.indexOf('credit card') === -1 && eql.indexOf('business card') === -1 && eql.indexOf('vehicle') === -1;
    });
    itHardware.forEach(function(e) { itDesc.push('Provision: ' + e); });

    const itSoftware = systems.filter(function(s) {
      const sl = s.toLowerCase();
      return sl.indexOf('google') === -1 && sl.indexOf('email') === -1 &&
             sl.indexOf('adp') === -1 && sl.indexOf('payroll') === -1 &&
             sl.indexOf('jonas') === -1 &&
             sl.indexOf('incident') === -1 && sl.indexOf('net promoter') === -1;
    });
    itSoftware.forEach(function(s) { itDesc.push('Grant access: ' + s); });

    if (itDesc.length === 0) {
      // No IT work — launch all tasks (IT + non-IT) directly
      launchRemainingEquipmentTasks(workflowId, false);
      return;
    }

    // Create one IT Setup action item and send one consolidated email
    const tid = ActionItemService.createActionItem(workflowId, 'IT', 'IT Setup', JSON.stringify(itDesc), CONFIG.EMAILS.IT, 'it_setup');
    const taskLink = tid ? '<li><a href="' + buildFormUrl('action_item_view', { tid: tid }) + '">IT Setup</a></li>' : '';

    updateWorkflow(workflowId, 'In Progress', 'Email Setup Needed');
    syncWorkflowState(workflowId);

    sendFormEmail({
      to: CONFIG.EMAILS.IT,
      subject: 'IT Setup Required — ' + employeeName,
      body: 'An equipment request has been approved for <b>' + employeeName + '</b>. Please complete IT setup — remaining team notifications will send once IT tasks are closed.<br><ul>' + taskLink + '</ul>',
      formUrl: '',
      displayName: 'TEAM Group — Employee Onboarding',
      contextData: context
    });

    Logger.log('[EquipReq] ' + itTaskLinks.length + ' IT task(s) created for ' + workflowId);
  } catch (e) {
    Logger.log('[ERROR] launchEquipmentActionItems: ' + e.message);
  }
}

/**
 * Creates non-IT (and optionally IT) action items for an equipment request.
 * - Called by launchEquipmentActionItems directly when no Google Account needed (skipIT=false) → creates everything.
 * - Called by ActionItemService.checkWorkflowCompletion after IT closes phase-1 tasks (skipIT=true) → non-IT only.
 * Sets workflow status to "Action Items Pending".
 * @param {string} workflowId
 * @param {boolean} [skipIT=false] pass true when IT tasks were already created in phase 1
 */
function launchRemainingEquipmentTasks(workflowId, skipIT) {
  try {
    const context = getWorkflowContext(workflowId);
    if (!context) {
      Logger.log('[EquipReq] launchRemainingEquipmentTasks: context not found for ' + workflowId);
      return;
    }

    const employeeName = context.employeeName || workflowId;
    const systems   = Array.isArray(context.systems)   ? context.systems   : [];
    const equipment = Array.isArray(context.equipment)  ? context.equipment
      : (context.equipmentRaw ? context.equipmentRaw.split(',').map(function(s){ return s.trim(); }).filter(Boolean) : []);

    const itHardware  = [];
    const itSoftware  = [];
    const hrSystems   = [];
    let creditCard    = false;
    let businessCards = false;
    let vehicle       = false;
    let jonas         = false;
    let adp           = false;

    systems.forEach(function(s) {
      const sl = s.toLowerCase();
      if (sl.indexOf('google') !== -1 || sl.indexOf('email') !== -1) {
        return; // always skip — Google Account handled in phase 1 or not requested
      } else if (sl.indexOf('adp') !== -1 || sl.indexOf('payroll') !== -1) {
        adp = true;
      } else if (sl.indexOf('jonas') !== -1) {
        jonas = true;
      } else if (!skipIT) {
        itSoftware.push(s); // IT software only when not already done in phase 1
      }
    });

    equipment.forEach(function(eq) {
      const eql = eq.toLowerCase();
      if (eql.indexOf('credit card') !== -1) {
        creditCard = true;
      } else if (eql.indexOf('business card') !== -1) {
        businessCards = true;
      } else if (eql.indexOf('vehicle') !== -1) {
        vehicle = true;
      } else if (!skipIT) {
        itHardware.push(eq); // IT hardware only when not already done in phase 1
      }
    });

    // Create action items and notify teams
    // IT hardware + software are always handled in phase 1 (launchEquipmentActionItems).
    // launchRemainingEquipmentTasks only runs when skipIT=true (non-IT tasks after IT closes)
    // or when skipIT=false and there was no IT work (itHardware/itSoftware irrelevant).
    if (!skipIT && (itHardware.length > 0 || itSoftware.length > 0)) {
      const itDesc2 = itHardware.map(function(e) { return 'Provision: ' + e; }).concat(itSoftware.map(function(s) { return 'Grant access: ' + s; }));
      const tid2 = ActionItemService.createActionItem(workflowId, 'IT', 'IT Setup', JSON.stringify(itDesc2), CONFIG.EMAILS.IT, 'it_setup');
      _notifyEquipmentTask(workflowId, tid2, 'IT', CONFIG.EMAILS.IT, context,
        'Please complete IT setup for <b>' + employeeName + '</b>:<br><ul><li>' + itDesc2.join('</li><li>') + '</li></ul>');
    }

    if (hrSystems.length > 0) {
      const tid = ActionItemService.createActionItem(
        workflowId, 'HR', 'HR Systems Access',
        JSON.stringify(hrSystems.map(function(s) { return 'Grant access: ' + s; })),
        CONFIG.EMAILS.HR, 'hr_systems'
      );
      _notifyEquipmentTask(workflowId, tid, 'HR', CONFIG.EMAILS.HR, context,
        'Please set up the following HR system access for <b>' + employeeName + '</b>:<br><ul><li>' + hrSystems.join('</li><li>') + '</li></ul>');
    }

    if (adp) {
      const tid = ActionItemService.createActionItem(
        workflowId, 'Payroll', 'ADP Access Setup',
        JSON.stringify(['Set up ADP access for ' + employeeName]),
        CONFIG.EMAILS.PAYROLL, 'adp_setup'
      );
      _notifyEquipmentTask(workflowId, tid, 'Payroll', CONFIG.EMAILS.PAYROLL, context,
        'Please set up ADP access for <b>' + employeeName + '</b>.');
    }

    if (jonas) {
      const tid = ActionItemService.createActionItem(
        workflowId, 'Finance', 'Central Purchasing/Jonas Setup',
        JSON.stringify(['Set up Central Purchasing/Jonas access for ' + employeeName]),
        CONFIG.EMAILS.JONAS, 'jonas'
      );
      _notifyEquipmentTask(workflowId, tid, 'Finance', CONFIG.EMAILS.JONAS, context,
        'Please set up Central Purchasing/Jonas access for <b>' + employeeName + '</b>.');
    }

    if (creditCard) {
      const tid = ActionItemService.createActionItem(
        workflowId, 'Credit Card', 'Credit Card Setup',
        JSON.stringify(['Set up company credit card for ' + employeeName]),
        CONFIG.EMAILS.CREDIT_CARD, 'creditcard'
      );
      _notifyEquipmentTask(workflowId, tid, 'Credit Card', CONFIG.EMAILS.CREDIT_CARD, context,
        'Please set up a company credit card for <b>' + employeeName + '</b>.');
    }

    if (businessCards) {
      const tid = ActionItemService.createActionItem(
        workflowId, 'Business Cards', 'Business Cards Order',
        JSON.stringify(['Create and send digital business cards for ' + employeeName]),
        CONFIG.EMAILS.BUSINESS_CARDS, 'businesscards'
      );
      _notifyEquipmentTask(workflowId, tid, 'Business Cards', CONFIG.EMAILS.BUSINESS_CARDS, context,
        'Please create and send digital business cards for <b>' + employeeName + '</b>.');
    }

    if (vehicle) {
      const tid = ActionItemService.createActionItem(
        workflowId, 'Fleet', 'Vehicle Setup',
        JSON.stringify(['Assign company vehicle for ' + employeeName + ' in Fleetio']),
        CONFIG.EMAILS.FLEETIO, 'fleetio'
      );
      _notifyEquipmentTask(workflowId, tid, 'Fleet', CONFIG.EMAILS.FLEETIO, context,
        'Please assign a company vehicle for <b>' + employeeName + '</b> in Fleetio.');
    }

    updateWorkflow(workflowId, 'In Progress', 'Action Items Pending');
    syncWorkflowState(workflowId);
    Logger.log('[EquipReq] All remaining tasks launched for ' + workflowId);

  } catch (e) {
    Logger.log('[ERROR] launchRemainingEquipmentTasks: ' + e.message);
  }
}

/**
 * Sends a task notification email to the assigned team with a link to the action item form.
 * @param {string} workflowId
 * @param {string|null} taskId
 * @param {string} teamLabel   — human-readable team name for logging
 * @param {string} assignedTo  — email address of assigned team
 * @param {Object} context     — workflow context
 * @param {string} bodyHtml    — task-specific HTML body describing what to do
 */
function _notifyEquipmentTask(workflowId, taskId, teamLabel, assignedTo, context, bodyHtml) {
  try {
    if (!taskId) {
      Logger.log('[EquipReq] _notifyEquipmentTask: taskId null for ' + teamLabel);
      return;
    }
    const taskUrl = buildFormUrl('action_item_view', { tid: taskId });
    sendFormEmail({
      to: assignedTo,
      subject: teamLabel + ' Action Required',
      body: bodyHtml + '\n\nUse the button below to open your action item.',
      formUrl: taskUrl,
      displayName: 'TEAM Group — Employee Onboarding',
      contextData: context
    });
    Logger.log('[EquipReq] Notified ' + assignedTo + ' for task ' + taskId + ' (' + teamLabel + ')');
  } catch (e) {
    Logger.log('[ERROR] _notifyEquipmentTask: ' + e.message);
  }
}

