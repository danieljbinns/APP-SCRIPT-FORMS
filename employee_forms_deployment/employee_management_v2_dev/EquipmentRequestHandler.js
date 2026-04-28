/**
 * System & Equipment Access Form - Backend Handler
 *
 * Flow:
 *   1. submitEquipmentRequest → status "BOSS Verification Needed"
 *        → confirmation email to requester
 *        → IT Confirmation form link to Dave Langohr
 *   2. submitITConfirmation (in BOSSReviewHandler.js) → calls launchEquipmentActionItems()
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
    // 1. Create Workflow Record
    const workflowId = createWorkflow('EQUIP_REQ', 'System & Equipment Request', formData.reqEmail || formData.requesterEmail);
    const formId = generateFormId('EQUIP');

    formData.workflowId = workflowId;
    formData.formId     = formId;
    formData.timestamp  = new Date();

    // 2. Validate core fields
    const requiredFields = ['firstName', 'lastName', 'siteName', 'managerEmail', 'position'];
    const validation = validateRequiredFields(formData, requiredFields);
    if (!validation.valid) return { success: false, message: validation.message };

    const employeeName = formData.firstName + ' ' + formData.lastName;

    // 3. Set status — awaiting IT Confirmation (BOSS review)
    updateWorkflow(workflowId, 'In Progress', 'IT Confirmation Needed', employeeName);

    // 4. Write row to Equipment_Requests sheet
    const rowData = formatEquipmentRequestData(formData);
    const sheetSuccess = addSheetRow(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.EQUIPMENT_REQUESTS, rowData);
    if (!sheetSuccess) throw new Error('Failed to write request to Equipment Requests database');

    // Build context directly from formData — avoids a spreadsheet re-read right after writing
    const systems   = Array.isArray(formData.systems)   ? formData.systems   : (formData.systems   ? [formData.systems]   : []);
    const equipment = Array.isArray(formData.equipment)  ? formData.equipment  : (formData.equipment  ? [formData.equipment]  : []);
    const context = {
      workflowType:   'Equipment Request',
      workflowId:     workflowId,
      employeeName:   employeeName,
      firstName:      formData.firstName   || '',
      lastName:       formData.lastName    || '',
      siteName:       formData.siteName    || '',
      jobTitle:       formData.positionTitle || formData.position || '',
      managerName:    formData.managerName  || formData.reportingManagerName  || '',
      managerEmail:   formData.managerEmail || formData.reportingManagerEmail || '',
      requesterName:  formData.reqName     || '',
      requesterEmail: formData.reqEmail    || formData.requesterEmail || '',
      systems:        systems,
      equipment:      equipment,
      equipmentRaw:   equipment.join(', '),
      comments:       formData.comments    || '',
      department:     formData.department  || '',
      requestDate:    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')
    };

    // 5. Confirmation email to requester
    const requesterEmail = formData.reqEmail || formData.requesterEmail || '';
    if (requesterEmail) {
      sendFormEmail({
        to: requesterEmail,
        subject: 'Request Submitted',
        body: 'Your System & Equipment Access request for <b>' + employeeName + '</b> has been received and is being reviewed by Dave Langohr.\n\nYou will receive updates as the request progresses.',
        displayName: 'TEAM Group — Employee Onboarding',
        contextData: context
      });
    }

    // 6. Send IT Confirmation form to Dave Langohr
    const itConfirmationUrl = buildFormUrl('it_confirmation', { wf: workflowId });
    sendFormEmail({
      to: 'davelangohr@team-group.com',
      subject: 'IT Confirmation Required',
      body: 'A System & Equipment Access request has been submitted for <b>' + employeeName + '</b> and requires your review and confirmation.\n\nPlease review the request details and confirm using the button below.',
      formUrl: itConfirmationUrl,
      displayName: 'TEAM Group — Employee Onboarding',
      contextData: context
    });

    syncWorkflowState(workflowId);
    Logger.log('[EquipReq] Submitted ' + workflowId + ' for ' + employeeName + '. IT Confirmation sent to Dave.');
    return { success: true, workflowId: workflowId, scriptUrl: getBaseUrl() };

  } catch (error) {
    Logger.log('[ERROR] submitEquipmentRequest: ' + error.toString());
    return { success: false, message: 'Server Error: ' + error.toString() };
  }
}

/**
 * Called by BOSSReviewHandler.submitBOSSReview after IT Confirmation is approved.
 * If Google Account is in the systems list, creates only the IT email task first.
 * Otherwise, launches all action items at once.
 * @param {string} workflowId
 */
function launchEquipmentActionItems(workflowId) {
  try {
    const context = getWorkflowContext(workflowId);
    if (!context) {
      Logger.log('[EquipReq] launchEquipmentActionItems: context not found for ' + workflowId);
      return;
    }

    const systems   = Array.isArray(context.systems)   ? context.systems   : [];
    const needsEmail = systems.some(function(s) {
      return s.toLowerCase().indexOf('google') !== -1 || s.toLowerCase().indexOf('email') !== -1;
    });

    if (needsEmail) {
      // Google Account must be provisioned first — create IT email task only
      const itEmailTaskId = ActionItemService.createActionItem(
        workflowId,
        'IT',
        'Google Account Setup',
        JSON.stringify(['Create Google account and assign email address']),
        CONFIG.EMAILS.IT,
        'it_email_setup'
      );

      updateWorkflow(workflowId, 'In Progress', 'Email Setup Needed');
      syncWorkflowState(workflowId);

      if (itEmailTaskId) {
        const taskUrl = buildFormUrl('action_item_view', { tid: itEmailTaskId });
        sendFormEmail({
          to: CONFIG.EMAILS.IT,
          subject: 'Google Account Setup Required',
          body: 'An equipment request has been approved for <b>' + (context.employeeName || '') + '</b>. Please create their Google account first — remaining access will be set up after email is assigned.',
          formUrl: taskUrl,
          displayName: 'TEAM Group — Employee Onboarding',
          contextData: context
        });
      }
      Logger.log('[EquipReq] Email Setup step created for ' + workflowId);
    } else {
      // No Google Account needed — launch all tasks immediately
      launchRemainingEquipmentTasks(workflowId);
    }
  } catch (e) {
    Logger.log('[ERROR] launchEquipmentActionItems: ' + e.message);
  }
}

/**
 * Creates all remaining action items for an equipment request (excluding Google Account
 * which was handled separately if Email Setup Needed step was used).
 * Sets workflow status to "Action Items Pending".
 * @param {string} workflowId
 */
function launchRemainingEquipmentTasks(workflowId) {
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

    // Skip Google Account — already handled in Email Setup Needed step (if it was done)
    const otherSystems = systems.filter(function(s) {
      return s.toLowerCase().indexOf('google') === -1 && s.toLowerCase().indexOf('email') === -1;
    });

    // Group tasks by team
    const itHardware    = [];
    const itSoftware    = [];
    const hrSystems     = [];
    let creditCard    = false;
    let businessCards = false;
    let vehicle       = false;
    let jonas         = false;
    let adp           = false;

    otherSystems.forEach(function(s) {
      const sl = s.toLowerCase();
      if (sl.indexOf('adp') !== -1 || sl.indexOf('payroll') !== -1) {
        adp = true;
      } else if (sl.indexOf('jonas') !== -1) {
        jonas = true;
      } else if (sl.indexOf('incident') !== -1 || sl.indexOf('net promoter') !== -1) {
        hrSystems.push(s);
      } else {
        itSoftware.push(s);
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
      } else {
        // Computer, Mobile Phone, Tablet → IT hardware
        itHardware.push(eq);
      }
    });

    // Create action items and notify teams
    if (itHardware.length > 0) {
      const tid = ActionItemService.createActionItem(
        workflowId, 'IT', 'Hardware Provisioning',
        JSON.stringify(itHardware.map(function(e) { return 'Provision: ' + e; })),
        CONFIG.EMAILS.IT, 'it_hardware'
      );
      _notifyEquipmentTask(workflowId, tid, 'IT', CONFIG.EMAILS.IT, context,
        'Please provision the following hardware for <b>' + employeeName + '</b>:<br><ul><li>' + itHardware.join('</li><li>') + '</li></ul>');
    }

    if (itSoftware.length > 0) {
      const tid = ActionItemService.createActionItem(
        workflowId, 'IT', 'Software Access Setup',
        JSON.stringify(itSoftware.map(function(s) { return 'Grant access: ' + s; })),
        CONFIG.EMAILS.IT, 'it_software'
      );
      _notifyEquipmentTask(workflowId, tid, 'IT Software', CONFIG.EMAILS.IDSETUP, context,
        'Please set up the following software access for <b>' + employeeName + '</b>:<br><ul><li>' + itSoftware.join('</li><li>') + '</li></ul>');
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
        workflowId, 'Finance', 'Jonas Purchasing Setup',
        JSON.stringify(['Set up Jonas Purchasing access for ' + employeeName]),
        CONFIG.EMAILS.JONAS, 'jonas'
      );
      _notifyEquipmentTask(workflowId, tid, 'Finance', CONFIG.EMAILS.JONAS, context,
        'Please set up Jonas Purchasing access for <b>' + employeeName + '</b>.');
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

/**
 * Helper to flatten formData into a row array for Equipment_Requests sheet
 */
function formatEquipmentRequestData(formData) {
  return [
    new Date(),
    formData.workflowId || '',
    formData.formId     || '',
    formData.reqName    || '',
    formData.reqEmail   || '',
    formData.firstName  || '',
    formData.lastName   || '',
    formData.siteName   || '',
    formData.position   || '',
    formData.managerName  || '',
    formData.managerEmail || '',
    Array.isArray(formData.equipment) ? formData.equipment.join(', ') : (formData.equipment || ''),
    Array.isArray(formData.systems)   ? formData.systems.join(', ')   : (formData.systems   || ''),
    formData.comments    || '',
    formData.department  || ''
  ];
}
