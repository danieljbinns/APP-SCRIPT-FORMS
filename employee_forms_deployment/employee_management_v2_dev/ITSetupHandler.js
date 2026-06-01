/**
 * IT Setup Form - Handler Functions
 *
 * Handles the IT Setup form submission for New Hire, Equipment Request, and
 * Status Change workflows. Writes results to IT_RESULTS and triggers downstream
 * notifications / specialist action items.
 *
 * ENTRY POINTS
 * ────────────
 *   serveITSetup(workflowId)     — serves ITSetup.html with pre-populated context
 *   getITContextData(workflowId) — reads all context data needed to pre-populate the form
 *   submitITSetup(formData)      — processes form submission (see below)
 *   triggerSpecialists(workflowId, itData) — creates specialist action items post-IT-setup
 *
 * WORKFLOW ROUTING IN submitITSetup()
 * ─────────────────────────────────────
 *   New Hire / Equipment Request (default path):
 *     Appends row to IT_RESULTS, advances workflow step to 'Specialist Forms Needed',
 *     calls triggerSpecialists() to create all specialist action items.
 *
 *   Status Change (CHANGE_ prefix, NEW submission only):
 *     Appends row to IT_RESULTS, then immediately closes the 'IT' action item
 *     (category='IT', formType='it_setup') via ActionItemService.closeActionItem().
 *     The close call passes formData as formDataJSON, which triggers the CHANGE_
 *     secondary write in closeActionItem() (re-writing to IT_RESULTS from formDataJSON
 *     to ensure getWorkflowContext() reads the right data). checkWorkflowCompletion()
 *     is then invoked by closeActionItem(), which may fire notifyWorkflowClosure().
 *
 *   UPDATE (any workflow type, existing row):
 *     Overwrites the existing IT_RESULTS row in-place. Does NOT re-trigger specialists,
 *     advance workflow step, or close any action item. Only updates the sheet data.
 */

function serveITSetup(workflowId) {
  if (!workflowId) {
    return HtmlService.createHtmlOutput('<h1>Error: No workflow ID provided</h1>');
  }
  
  const template = HtmlService.createTemplateFromFile('ITSetup');
  template.workflowId = workflowId;
  template.formId = '';
  template.requestData = getITContextData(workflowId);
  template.employeeName = template.requestData.employeeName;
  
  return template.evaluate()
    .setTitle('IT Setup')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getITContextData(workflowId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const mainSheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
    const idSetupSheet = ss.getSheetByName(CONFIG.SHEETS.ID_SETUP_RESULTS);

    const mainData = mainSheet.getDataRange().getValues();
    let context = { success: false, message: 'Workflow ID not found' };

    for (let i = SCHEMA.ROW.FIRST_DATA; i < mainData.length; i++) {
      const IR = SCHEMA.INITIAL_REQUESTS;
      if (mainData[i][IR.WORKFLOW_ID] === workflowId) {
        const googleEmailRaw = String(mainData[i][IR.GOOGLE_EMAIL] || '').replace(/^"|"$/g, '').trim();
        const googleDomain   = String(mainData[i][IR.GOOGLE_DOMAIN] || '').replace('@', '').trim();
        const equipmentRaw   = mainData[i][IR.EQUIPMENT] || '';
        const systemsRaw     = mainData[i][IR.SYSTEMS] || '';
        context = {
          success: true,
          workflowType: workflowId.startsWith('EQUIP_REQ_') ? 'Equipment Request' : 'New Hire',
          employeeName: mainData[i][IR.FIRST_NAME] + ' ' + mainData[i][IR.LAST_NAME],
          firstName: mainData[i][IR.FIRST_NAME],
          lastName: mainData[i][IR.LAST_NAME],
          hireDate: (function(d){ return d instanceof Date ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') : (d ? String(d).substring(0, 10) : ''); })(mainData[i][IR.HIRE_DATE]),
          newHireOrRehire: mainData[i][IR.NEW_HIRE_OR_REHIRE] || '',
          employeeType:    mainData[i][IR.EMPLOYEE_TYPE]      || '',
          employmentType:  mainData[i][IR.EMPLOYMENT_TYPE]    || '',
          jobTitle: mainData[i][IR.POSITION_TITLE],
          jrTitle: mainData[i][IR.JR_ASSIGNMENT],
          jrRequested: mainData[i][IR.JR_REQUIRED],
          siteName: mainData[i][IR.SITE_NAME],
          jobSiteNumber: mainData[i][IR.JOB_SITE_NUMBER],
          managerName: mainData[i][IR.MANAGER_NAME],
          managerEmail: mainData[i][IR.MANAGER_EMAIL],
          requesterEmail: mainData[i][IR.REQUESTER_EMAIL],
          systemAccess: mainData[i][IR.SYSTEM_ACCESS] || '',
          systems: systemsRaw ? systemsRaw.split(',').map(function(s){return s.trim();}).filter(Boolean) : [],
          equipmentRaw: equipmentRaw,
          googleEmail: googleEmailRaw,             // quotes stripped
          googleDomain: googleDomain ? '@' + googleDomain : '',
          emailRequested: googleEmailRaw + (googleDomain ? '@' + googleDomain : ''),
          requestedDomains: mainData[i][IR.GOOGLE_DOMAIN],
          // Computer / Phone
          computerReq: mainData[i][IR.COMPUTER_REQ],
          computerType: mainData[i][IR.COMPUTER_TYPE],
          computerPrevUser: mainData[i][IR.COMPUTER_PREV_USER],
          computerPrevType: mainData[i][IR.COMPUTER_PREV_TYPE],
          computerSerial: mainData[i][IR.COMPUTER_SERIAL],
          phoneReq: mainData[i][IR.PHONE_REQ],
          phonePrevUser: mainData[i][IR.PHONE_PREV_USER],
          phonePrevNumber: mainData[i][IR.PHONE_PREV_NUMBER],
          // BOSS
          bossJobSites: mainData[i][IR.BOSS_SITES],
          bossCostSheet: mainData[i][IR.BOSS_COST_SHEET],
          bossCostSheetJobs: mainData[i][IR.BOSS_JOBS],
          bossTripReports: mainData[i][IR.BOSS_TRIP],
          bossGrievances: mainData[i][IR.BOSS_GRIEVANCES],
          jonasJobNumbers: mainData[i][IR.JONAS_JOB_NUMBERS],
          plan306090: mainData[i][IR.PLAN_306090],
          bossTrainingOnly: mainData[i][IR.BOSS_TRAINING_ONLY] || 'No',
          // Misc
          creditCardUSA: mainData[i][IR.CC_USA],
          creditCardLimitUSA: mainData[i][IR.CC_LIMIT_USA],
          creditCardLimitCanada: mainData[i][IR.CC_CAN],
          creditCardLimitHomeDepot: mainData[i][IR.CC_LIMIT_HD],
          businessCards: equipmentRaw.includes('Business Cards') ? 'Yes' : 'No',
          vehicleRequested: equipmentRaw.includes('Vehicle') ? 'Yes' : 'No',
          fleetioAccess: systemsRaw.includes('Fleetio') ? 'Yes' : 'No',
          department: mainData[i][IR.DEPARTMENT] || '',
          purchasingSites: mainData[i][IR.PURCHASING_SITES] || ''
        };
        break;
      }
    }
    
    if (!context.success) return context;

    // Overlay IT Confirmation data if Dave has already reviewed this workflow
    const bossReview = (typeof getITConfirmationData === 'function') ? getITConfirmationData(workflowId) : null;
    if (bossReview) {
      if (bossReview.bossJobSites !== undefined) context.bossJobSites = bossReview.bossJobSites;
      if (bossReview.bossCostSheet) context.bossCostSheet = bossReview.bossCostSheet;
      if (bossReview.bossCostSheetJobs !== undefined) context.bossCostSheetJobs = bossReview.bossCostSheetJobs;
      if (bossReview.bossTripReports) context.bossTripReports = bossReview.bossTripReports;
      if (bossReview.bossGrievances) context.bossGrievances = bossReview.bossGrievances;
      if (bossReview.computerReq) context.computerReq = bossReview.computerReq;
      if (bossReview.computerType) context.computerType = bossReview.computerType;
      if (bossReview.phoneReq) context.phoneReq = bossReview.phoneReq;
    }

    if (idSetupSheet) {
      const ID = SCHEMA.ID_SETUP_RESULTS;
      const idData = idSetupSheet.getDataRange().getValues();
      for (let j = SCHEMA.ROW.FIRST_DATA; j < idData.length; j++) {
        if (idData[j][ID.WORKFLOW_ID] === workflowId) {
          context.internalEmployeeId = idData[j][ID.INTERNAL_EMP_ID];
          context.siteDocsWorkerId = idData[j][ID.SITEDOCS_WORKER_ID];
          context.siteDocsJobCode = idData[j][ID.SITEDOCS_JOB_CODE];
          context.siteDocsUsername = idData[j][ID.SITEDOCS_USERNAME];
          context.siteDocsPassword = idData[j][ID.SITEDOCS_PASSWORD];
          context.dssUsername = idData[j][ID.DSS_USERNAME];
          context.dssPassword = idData[j][ID.DSS_PASSWORD];
          if (idData[j][ID.SUBMISSION_TS]) context.idTimestamp  = idData[j][ID.SUBMISSION_TS] instanceof Date ? Utilities.formatDate(idData[j][ID.SUBMISSION_TS], Session.getScriptTimeZone(), 'MMM d, yyyy · h:mm a') : String(idData[j][ID.SUBMISSION_TS]);
          if (idData[j][ID.BOSS_WIS_CREATED]) context.idSubmittedBy = String(idData[j][ID.BOSS_WIS_CREATED]);
          break;
        }
      }
    }

    // HR Verification Results — ADP ID, verified names, timestamps
    const hrSheet = ss.getSheetByName(CONFIG.SHEETS.HR_VERIFICATION_RESULTS);
    if (hrSheet) {
      const HR = SCHEMA.HR_VERIFICATION_RESULTS;
      const hrData = hrSheet.getDataRange().getValues();
      for (let k = hrData.length - 1; k >= SCHEMA.ROW.FIRST_DATA; k--) {
        if (hrData[k][HR.WORKFLOW_ID] === workflowId && String(hrData[k][HR.FORM_ID]) !== 'DATE_CHANGE') {
          if (hrData[k][HR.ADP_ASSOCIATE_ID]) context.adpAssociateId   = String(hrData[k][HR.ADP_ASSOCIATE_ID]);
          if (hrData[k][HR.VERIFIED_MANAGER]) context.managerName       = String(hrData[k][HR.VERIFIED_MANAGER]);  // HR-verified manager
          if (hrData[k][HR.VERIFIED_MANAGER_EMAIL]) context.managerEmail      = String(hrData[k][HR.VERIFIED_MANAGER_EMAIL]);
          if (hrData[k][HR.SUBMISSION_TS]) context.hrTimestamp       = hrData[k][HR.SUBMISSION_TS] instanceof Date ? Utilities.formatDate(hrData[k][HR.SUBMISSION_TS], Session.getScriptTimeZone(), 'MMM d, yyyy · h:mm a') : String(hrData[k][HR.SUBMISSION_TS]);
          if (hrData[k][HR.SUBMITTED_BY]) context.hrSubmittedBy     = String(hrData[k][HR.SUBMITTED_BY]);
          // Use HR-verified job title if present
          const verifiedTitles = hrData[k][HR.VERIFIED_JR_TITLE] ? String(hrData[k][HR.VERIFIED_JR_TITLE]) : '';
          if (verifiedTitles.includes(' / ')) {
            const parts = verifiedTitles.split(' / ');
            context.jobTitle = parts[0].trim();
            context.jrTitle  = parts.slice(1).join(' / ').trim();
          }
          break;
        }
      }
    }

    return context;
    
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Processes the IT Setup form submission.
 *
 * Called by: google.script.run from ITSetup.html (client-side form submit button).
 * Also called directly from _sdCloseAllAI() in SuperDebug.js when testing via
 * the SD_EQUIP_ITSETUP / SD_NH_ITSETUP payloads.
 *
 * @param {Object} formData - PascalCase field names matching ITSetup.html form controls:
 *   workflowId / requestId, Email_Created, Email_Username, Email_Domain,
 *   Email_Temp_Password, Computer_Assigned, Computer_Serial, Computer_Model,
 *   Computer_Type, Phone_Assigned, Phone_Carrier, Phone_Model, Phone_Number,
 *   Phone_VM_Password, BOSS_Access, BOSS_Cmte_<site> (dynamic), BOSS_CostSheet_<job>
 *   (dynamic), BOSS_TripReports, BOSS_Grievances, Incidents_Access, CAA_Access,
 *   Delivery_App_Access, Net_Promoter_Score_Access, IT_Notes
 * @returns {{ success: boolean, message: string }}
 */
function submitITSetup(formData) {
  try {
    rawLog('submitITSetup', formData);
    const workflowId = formData.workflowId || formData.requestId;
    const formId = generateFormId('IT_SETUP');
    Logger.log('IT Setup submitted for: ' + workflowId);

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

    // Detect existing submission for update-vs-insert.
    // An existing row means IT is re-submitting (correction). In that case we
    // overwrite the row in-place and do NOT re-trigger specialists or close action items.
    let existingITRowIndex = -1;
    let existingITRowData = null;
    const itSheetCheck = ss.getSheetByName(CONFIG.SHEETS.IT_RESULTS);
    if (itSheetCheck) {
      const itCheckData = itSheetCheck.getDataRange().getValues();
      for (let ei = SCHEMA.ROW.FIRST_DATA; ei < itCheckData.length; ei++) {
        if (String(itCheckData[ei][SCHEMA.IT_RESULTS.WORKFLOW_ID]) === workflowId) {
          existingITRowIndex = ei + 1;
          existingITRowData = itCheckData[ei];
          break;
        }
      }
    }

    let itSheet = ss.getSheetByName(CONFIG.SHEETS.IT_RESULTS);
    
    if (!itSheet) {
      itSheet = ss.insertSheet(CONFIG.SHEETS.IT_RESULTS);
      itSheet.appendRow([
        'Workflow ID', 'Form ID', 'Submission Timestamp', 'Email Created', 'Assigned Email', 'Email Password',
        'Computer Assigned', 'Computer Serial', 'Computer Model', 'Computer Type',
        'Phone Assigned', 'Phone Carrier', 'Phone Model', 'Phone Number', 'Phone VM Password',
        'BOSS Access', 'Incidents Access', 'CAA Access', 'Delivery App Access', 'Net Promoter Access',
        'IT Notes', 'Submitted By', 'BOSS Details'
      ]);
      itSheet.getRange(1, 1, 1, 23).setFontWeight('bold').setBackground('#EB1C2D').setFontColor('#ffffff');
    }
    
    // Only build an email address when IT confirmed the account was actually created.
    // Empty string (falsy) means "not created" — prevents 'N/A' or partial addresses
    // from appearing in emails or being added as notification recipients.
    const assignedEmail = (formData.Email_Created === 'Yes' && formData.Email_Username)
      ? (String(formData.Email_Username).replace(/^"|"$/g, '') + (formData.Email_Domain || ''))
      : '';
    
    // Collect BOSS detail confirmations — dynamic checkboxes per site/job from the IT Setup form
    const bossDetails = { committees: [], costSheets: [], tripReports: '', grievances: '' };
    Object.keys(formData).forEach(function(key) {
      if (key.startsWith('BOSS_Cmte_') && formData[key] === 'Confirmed') {
        bossDetails.committees.push(key.replace('BOSS_Cmte_', '').replace(/_/g, ' '));
      }
      if (key.startsWith('BOSS_CostSheet_') && formData[key] === 'Confirmed') {
        bossDetails.costSheets.push(key.replace('BOSS_CostSheet_', '').replace(/_/g, ' '));
      }
    });
    if (formData.BOSS_TripReports === 'Confirmed') bossDetails.tripReports = 'Yes';
    if (formData.BOSS_Grievances  === 'Confirmed') bossDetails.grievances  = 'Yes';

    const rowData = [
      workflowId,
      formId,
      new Date(),
      formData.Email_Created,
      assignedEmail,
      formData.Email_Temp_Password || 'N/A',
      formData.Computer_Assigned,
      formData.Computer_Serial || 'N/A',
      formData.Computer_Model || 'N/A',
      formData.Computer_Type || 'N/A',
      formData.Phone_Assigned,
      formData.Phone_Carrier || 'N/A',
      formData.Phone_Model || 'N/A',
      formData.Phone_Number || 'N/A',
      formData.Phone_VM_Password || 'N/A',
      formData.BOSS_Access,
      formData.Incidents_Access,
      formData.CAA_Access,
      formData.Delivery_App_Access,
      formData.Net_Promoter_Score_Access,
      formData.IT_Notes || '',
      Session.getActiveUser().getEmail(),
      JSON.stringify(bossDetails)   // col 22 — BOSS committee/cost sheet/trip/grievances
    ];
    
    const actingUser = Session.getActiveUser().getEmail();

    if (existingITRowIndex !== -1 && itSheet) {
      // UPDATE path — overwrite existing row in-place.
      // Do NOT re-trigger specialists, advance the workflow step, or close any action items.
      // This handles IT re-submitting to correct an error without creating duplicate work.
      // logFormEdit() records the before/after diff for audit purposes.
      itSheet.getRange(existingITRowIndex, 1, 1, rowData.length).setValues([rowData]);
      logFormEdit(workflowId, 'IT Setup', actingUser, existingITRowData, rowData);
      Logger.log('[IT Setup] Updated existing row for ' + workflowId + ' by ' + actingUser + ' — specialists NOT re-triggered');
    } else {
      // INSERT path — first-time IT Setup submission.
      itSheet.appendRow(rowData);
      Logger.log('Appended row to IT Results: ' + JSON.stringify(rowData));

      if (!workflowId.startsWith('CHANGE_')) {
        // ── New Hire / Equipment Request path ──────────────────────────────────────
        // Advance workflow step and trigger all specialist action items.
        // triggerSpecialists() reads from getWorkflowContext() (which now includes the
        // IT_RESULTS row we just appended) to build specialist emails with full IT context.
        updateWorkflow(workflowId, 'In Progress', 'Specialist Forms Needed', '', actingUser);
        syncWorkflowState(workflowId);
        triggerSpecialists(workflowId, formData);
      } else {
        // ── Status Change (CHANGE_) path ───────────────────────────────────────────
        // For CHANGE_ workflows, all action items were created when HR approved
        // (in submitPositionChangeApproval). IT's job here is to submit the IT Setup
        // form which closes the IT action item (category='IT', formType='it_setup').
        //
        // We find the open IT action item for this workflow and close it via
        // ActionItemService.closeActionItem(), passing the full formData as formDataJSON.
        //
        // WHY pass formDataJSON here?
        //   closeActionItem() detects the CHANGE_ + IT + it_setup combination and writes
        //   a row to IT_RESULTS from formDataJSON (belt-and-suspenders: we already wrote
        //   the row above, but closeActionItem also writes it to handle the case where it
        //   is called directly without submitITSetup being in the call chain, e.g. from
        //   _sdCloseAllAI() in SuperDebug.js).
        //
        //   closeActionItem() then calls checkWorkflowCompletion(), which fires
        //   notifyWorkflowClosure() if this was the last blocking action item.
        //   notifyWorkflowClosure() reads IT context from the wfTasks snapshot (in-memory)
        //   so the data is guaranteed to be present even if the sheet isn't flushed yet.
        Logger.log('[IT Setup] Status Change IT Setup submitted for ' + workflowId + ' — closing IT action item');
        const aiSheet2 = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
        if (aiSheet2) {
          const aiData2 = aiSheet2.getDataRange().getValues();
          const AI2 = SCHEMA.ACTION_ITEMS;
          for (let i = SCHEMA.ROW.FIRST_DATA; i < aiData2.length; i++) {
            if (aiData2[i][AI2.WORKFLOW_ID] === workflowId &&
                aiData2[i][AI2.CATEGORY] === 'IT' &&
                aiData2[i][AI2.STATUS] === 'Open') {
              // Merge bossDetails into formData so notifyWorkflowClosure can render BOSS sub-rows
              const itFormData = JSON.stringify(Object.assign({}, formData, { bossDetails: bossDetails }));
              ActionItemService.closeActionItem(aiData2[i][AI2.TASK_ID], 'IT Setup submitted via form', actingUser, null, itFormData);
              break;
            }
          }
        }
        syncWorkflowState(workflowId);
      }
    }

    // Notify Requester + Manager
    try {
      // Use getWorkflowContext so ID Setup and HR Verification sections are fully populated.
      // getITContextData only reads Initial_Requests — it has no internalEmployeeId or adpAssociateId.
      const context = getWorkflowContext(workflowId);
      if (context && context.requesterEmail) {
        // Inject IT result data on top of the full context
        context.assignedEmail     = assignedEmail;
        context.emailTempPassword = formData.Email_Temp_Password || '';

        const requesterEmail = context.requesterEmail;
        const recipients = [requesterEmail];
        if (context.managerEmail && context.managerEmail !== requesterEmail) {
          recipients.push(context.managerEmail);
        }

        if (recipients.length > 0) {
          const itCompletedBody = 'IT setup has been completed for ' + context.employeeName + '. Account, equipment, and system access details are below. Specialist requests have been triggered in parallel.';
          sendFormEmail({
            to: recipients.join(','),
            subject: 'IT Setup Complete',
            body: itCompletedBody,
            formUrl: '',
            displayName: 'TEAM Group — Employee Onboarding',
            contextData: context,
            emailOpts: { showPasswords: true, calendarDate: context.hireDate }
          });
          Logger.log('Notified ' + recipients.join(', ') + ' of IT completion');
        }
      }
    } catch (e) {
      Logger.log('Error notifying requester: ' + e.toString());
    }
    
    return {
      success: true,
      message: 'IT Setup results saved successfully. Requester and Specialists have been notified. You may now close this window or return to the dashboard.'
    };
    
  } catch (error) {
    Logger.log('[ERROR] IT Setup error: ' + error.toString());
    return { success: false, message: error.message };
  }
}

/**
 * Creates specialist action items and sends consolidated email notifications after
 * IT Setup is complete for a New Hire or Equipment Request workflow.
 *
 * Called exclusively by submitITSetup() for new (non-update) submissions where
 * workflowId does NOT start with 'CHANGE_'. Status Change specialist action items are
 * created in submitPositionChangeApproval() (PositionChangeHandler.js) at HR approval time.
 *
 * SPECIALIST GUARDS (isEquipment checks)
 * ────────────────────────────────────────
 * Several specialists are guarded to avoid incorrect action items for Equipment Requests:
 *
 *   30/60/90 Review — guarded by !workflowId.startsWith('EQUIP_REQ_') (ER-3).
 *     Equipment requests do not trigger a 30/60/90 plan regardless of plan306090 value.
 *     For New Hire, plan306090 must equal exactly 'Yes' (not just truthy).
 *
 *   WIS User / SiteDocs Account Setup — guarded by workflowId.startsWith('EQUIP_REQ_').
 *     For Equipment: triggers a 'WIS User' action item assigned to CONFIG.EMAILS.IDSETUP.
 *     For New Hire: SiteDocs account is created during the ID Setup step — no separate AI.
 *
 *   WIS Assignment — guarded by !workflowId.startsWith('EQUIP_REQ_') (ER-2).
 *     WIS Assignment (BOSS module assignments by manager) is meaningless for Equipment
 *     requests because there is no new employment relationship.
 *
 * CONTEXT STRIP
 * ─────────────
 * A specContext copy is sent to all specialist emails with credentials removed.
 * Specialist teams (Credit Card, Fleetio, etc.) do not need passwords; those are
 * only revealed to the manager/requester in the IT Setup completion email.
 *
 * EMAIL CONSOLIDATION
 * ────────────────────
 * Multiple action items assigned to the same email address are batched into a single
 * email with all action item buttons listed. This reduces inbox noise for teams that
 * receive more than one task (e.g. Fleetio for both access and vehicle assignment).
 *
 * @param {string} workflowId - Workflow ID
 * @param {Object} itData     - The raw formData passed to submitITSetup() — used to
 *                              derive assignedEmail (belt-and-suspenders overlay)
 */
function triggerSpecialists(workflowId, itData) {
  // Build assignedEmail only when IT confirmed the account was created.
  // An empty string (falsy) prevents '[Pending]' or partial addresses from being
  // added to specialist email context or recipient lists.
  const assignedEmail = (itData.Email_Created === 'Yes' && itData.Email_Username)
    ? (String(itData.Email_Username).replace(/^"|"$/g, '') + (itData.Email_Domain || ''))
    : '';

  // Read the full workflow context AFTER IT_RESULTS is written (submitITSetup appended
  // the row before calling this function). This means all IT fields (computer, phone,
  // BOSS details, Incidents, CAA, Delivery App, NPS) are included in specialist emails
  // and the email template renders IT Setup as '✓ Complete'.
  const context = getWorkflowContext(workflowId) || {};
  // Belt-and-suspenders: overlay assignedEmail directly in case the IT_RESULTS row
  // hasn't been flushed yet and getWorkflowContext() returned an empty value.
  if (assignedEmail) context.assignedEmail = assignedEmail;

  // Create a credential-stripped copy of context for specialist emails.
  // Passwords (email temp, SiteDocs, DSS) are visible only to the manager/requester.
  const specContext = Object.assign({}, context);
  delete specContext.emailTempPassword;
  delete specContext.dssPassword;
  delete specContext.siteDocsPassword;
  delete specContext.siteDocsUsername;
  delete specContext.dssUsername;
  delete specContext.siteDocsWorkerId;
  delete specContext.siteDocsJobCode;

  // Build specialist list — each entry becomes one Action Item
  const specialists = [];

  // 1. Credit Card
  if (context.creditCardUSA === 'Yes' || context.creditCardCanada === 'Yes' || context.creditCardHomeDepot === 'Yes') {
    const ccItems = [];
    if (context.creditCardUSA === 'Yes')       ccItems.push('Apply for USA card — Requested limit: ' + (context.creditCardLimitUSA || 'Standard'));
    if (context.creditCardCanada === 'Yes')    ccItems.push('Apply for Canada card — Requested limit: ' + (context.creditCardLimitCanada || 'Standard'));
    if (context.creditCardHomeDepot === 'Yes') ccItems.push('Apply for Home Depot card — Requested limit: ' + (context.creditCardLimitHomeDepot || 'Standard'));
    specialists.push({
      email: CONFIG.EMAILS.CREDIT_CARD,
      category: 'Credit Card',
      name: 'Credit Card Setup — ' + context.employeeName,
      description: JSON.stringify(ccItems),
      formType: 'creditcard'
    });
  }

  // 2. Business Cards
  if (context.businessCards === 'Yes') {
    specialists.push({
      email: CONFIG.EMAILS.BUSINESS_CARDS,
      category: 'Business Cards',
      name: 'Business Cards — ' + context.employeeName,
      description: JSON.stringify(['Create and send digital business cards']),
      formType: 'businesscards'
    });
  }

  // 3. Fleetio
  if (context.fleetioAccess === 'Yes') {
    const fleetioItems = ['Assign Fleetio account for employee'];
    if (context.vehicleRequested === 'Yes') fleetioItems.push('Assign company vehicle');
    specialists.push({
      email: CONFIG.EMAILS.FLEETIO,
      category: 'Fleetio',
      name: 'Fleetio Access — ' + context.employeeName,
      description: JSON.stringify(fleetioItems),
      formType: 'fleetio'
    });
  }

  // 4. 30/60/90 Review — only when plan306090 === 'Yes' (not just any truthy value) AND not Equipment (ER-3)
  if (context.plan306090 === 'Yes' && !workflowId.startsWith('EQUIP_REQ_')) {
    specialists.push({
      email: CONFIG.EMAILS.REVIEW_306090_JR,
      category: '30/60/90 Review',
      name: '30/60/90 and JR Assignment — ' + context.employeeName,
      description: JSON.stringify([
        'Create 30/60/90 day review plan',
        'Verify and assign JR title',
        'Schedule review meetings with manager'
      ]),
      formType: 'review_306090'
    });
  }

  // 5. Central Purchasing/Jonas — single combined action item
  const hasJonas = context.jonasJobNumbers && context.jonasJobNumbers.toString().trim().length > 0;
  const hasPurchasingSites = context.purchasingSites && context.purchasingSites.toString().trim().length > 0;

  if (hasJonas || hasPurchasingSites) {
    const combinedItems = [];
    if (hasPurchasingSites) {
      const cpSites = context.purchasingSites.toString().split(',').map(s => s.trim()).filter(s => s);
      if (cpSites.length > 0) {
        cpSites.forEach(s => combinedItems.push('Central Purchasing: Set up access — ' + s));
      } else {
        combinedItems.push('Central Purchasing: Set up access for employee');
      }
    }
    if (hasJonas) {
      const jonasJobs = context.jonasJobNumbers.toString().split(',').map(s => s.trim()).filter(s => s);
      if (jonasJobs.length > 0) {
        jonasJobs.forEach(j => combinedItems.push('Jonas: Provision access — ' + j));
      } else {
        combinedItems.push('Jonas: Provision access for employee');
      }
    }
    specialists.push({
      email: CONFIG.EMAILS.JONAS,
      category: 'Jonas',
      name: 'Central Purchasing/Jonas Setup — ' + context.employeeName,
      description: JSON.stringify(combinedItems),
      formType: 'jonas'
    });
  }

  // 6. SiteDocs Account Setup — only for Equipment Requests (EQUIP_REQ_).
  // For New Hire, SiteDocs account is created during ID Setup (credentials shown in that section).
  const hasSiteDocs = Array.isArray(context.systems) && context.systems.some(function(s) { return String(s).trim().toLowerCase() === 'sitedocs'; });
  if (hasSiteDocs && workflowId.startsWith('EQUIP_REQ_')) {
    specialists.push({
      email: CONFIG.EMAILS.IDSETUP,
      category: 'WIS User',
      name: 'SiteDocs Account Setup — ' + context.employeeName,
      description: JSON.stringify(['Create SiteDocs user account', 'Assign to correct site and supervisor']),
      formType: 'wis_user'
    });
  }

  // WIS Assignment — required for new hires assigned to manager; not for Equipment Requests (ER-2)
  if (context.managerEmail && !workflowId.startsWith('EQUIP_REQ_')) {
    // WIS Assignment = assign WIS modules in BOSS. BOSS committee/cost sheet/trip/grievances are IT tasks.
    const wisDescription = context.bossTrainingOnly === 'Yes'
      ? JSON.stringify(['Assign BOSS training modules only (training user — do NOT assign committee, cost sheet, trip reports, or grievances)'])
      : JSON.stringify(['Assign Work Instructions & Safety (WIS) module(s) in BOSS for this employee']);
    specialists.push({
      email: context.managerEmail,
      category: 'WIS',
      name: 'WIS Assignment — ' + context.employeeName,
      description: wisDescription,
      formType: 'wis'
    });
  }

  if (specialists.length === 0) {
    Logger.log('[INFO] No specialist Action Items needed for: ' + workflowId);
    return;
  }

  // Create Action Items and group by assignee email for consolidated notifications
  const emailMap = {}; // email → [{name, tid}]
  specialists.forEach(spec => {
    const tid = ActionItemService.createActionItem(
      workflowId, spec.category, spec.name, spec.description, spec.email, spec.formType
    );
    if (!emailMap[spec.email]) emailMap[spec.email] = [];
    emailMap[spec.email].push({ name: spec.name, tid: tid });
  });

  // One email per team — lists all assigned items with direct Action Item buttons
  for (const email in emailMap) {
    const items = emailMap[email];
    let itemList = '<div style="margin:0;">';
    items.forEach(item => {
      const url = buildFormUrl('action_item_view', { tid: item.tid });
      itemList += '<div style="margin-bottom:12px;"><a href="' + url + '" style="display:inline-block; background:#EB1C2D; color:#ffffff; padding:10px 20px; text-decoration:none; border-radius:6px; font-weight:600; font-size:14px;">' + item.name + ' &rarr;</a></div>';
    });
    itemList += '</div>';

    sendFormEmail({
      to: email,
      subject: items.length === 1 ? items[0].name + ' Required' : 'Action Items Assigned — ' + context.employeeName + ' (' + items.length + ' tasks)',
      body: 'You have been assigned the following onboarding action item(s) for <b>' + context.employeeName + '</b>. ' +
            'Please complete each task using the link(s) below.<br><br>' + itemList,
      formUrl: '',
      displayName: 'TEAM Group - Employee Onboarding',
      contextData: specContext
    });
  }

  Logger.log('[SUCCESS] Specialist Action Items created (' + specialists.length + ') for: ' + workflowId);
}
