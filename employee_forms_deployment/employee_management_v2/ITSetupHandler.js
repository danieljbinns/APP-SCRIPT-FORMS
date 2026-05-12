/**
 * IT Setup Form - Handler Functions  
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
          workflowType: 'New Hire',
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

function submitITSetup(formData) {
  try {
    const workflowId = formData.workflowId || formData.requestId;
    const formId = generateFormId('IT_SETUP');
    Logger.log('IT Setup submitted for: ' + workflowId);

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

    // Detect existing submission for update-vs-insert
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
        'IT Notes', 'Submitted By'
      ]);
      itSheet.getRange(1, 1, 1, 22).setFontWeight('bold').setBackground('#EB1C2D').setFontColor('#ffffff');
    }
    
    // Only build an email address when IT confirmed the account was actually created.
    // Empty string (falsy) means "not created" — prevents 'N/A' or partial addresses
    // from appearing in emails or being added as notification recipients.
    const assignedEmail = (formData.Email_Created === 'Yes' && formData.Email_Username)
      ? (String(formData.Email_Username).replace(/^"|"$/g, '') + (formData.Email_Domain || ''))
      : '';
    
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
      Session.getActiveUser().getEmail()
    ];
    
    const actingUser = Session.getActiveUser().getEmail();

    if (existingITRowIndex !== -1 && itSheet) {
      // UPDATE existing row in-place — do NOT re-trigger specialists
      itSheet.getRange(existingITRowIndex, 1, 1, rowData.length).setValues([rowData]);
      logFormEdit(workflowId, 'IT Setup', actingUser, existingITRowData, rowData);
      Logger.log('[IT Setup] Updated existing row for ' + workflowId + ' by ' + actingUser + ' — specialists NOT re-triggered');
    } else {
      itSheet.appendRow(rowData);
      Logger.log('Appended row to IT Results: ' + JSON.stringify(rowData));
      updateWorkflow(workflowId, 'In Progress', 'Specialist Forms Needed', '', actingUser);
      syncWorkflowState(workflowId);
      triggerSpecialists(workflowId, formData);
    }

    // Notify Requester + Manager
    try {
      const context = getITContextData(workflowId);
      if (context.success) {
        // Inject IT result data so the context block shows assigned email and credentials
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

function triggerSpecialists(workflowId, itData) {
  // Same guard as submitITSetup: only set when actually created, empty otherwise.
  // '[Pending]' was truthy and got pushed into specialist recipient lists as a literal address.
  const assignedEmail = (itData.Email_Created === 'Yes' && itData.Email_Username)
    ? (String(itData.Email_Username).replace(/^"|"$/g, '') + (itData.Email_Domain || ''))
    : '';

  const context = getITContextData(workflowId);
  context.assignedEmail = assignedEmail;
  context.computerAssigned = itData.Computer_Assigned;
  context.computerType = itData.Computer_Type;
  context.phoneAssigned = itData.Phone_Assigned;
  context.phoneNumber = itData.Phone_Number;

  const specContext = Object.assign({}, context);
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

  // 4. 30/60/90 Review — salary/non-hourly employees only
  if (context.employmentType !== 'Hourly') {
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

  // WIS Assignment — always required for new hires; assigned to manager
  if (context.managerEmail) {
    specialists.push({
      email: context.managerEmail,
      category: 'WIS',
      name: 'WIS Assignment — ' + context.employeeName,
      description: JSON.stringify(['Assign Work Instructions & Safety (WIS) module(s) in BOSS for this employee']),
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
