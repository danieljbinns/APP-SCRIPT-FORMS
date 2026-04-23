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
    const headers = mainData[0];
    let context = { success: false, message: 'Workflow ID not found' };

    for (let i = 1; i < mainData.length; i++) {
      if (mainData[i][0] === workflowId) {
        context = {
          success: true,
          employeeName: mainData[i][10] + ' ' + mainData[i][12],
          firstName: mainData[i][10],
          lastName: mainData[i][12],
          hireDate: (function(d){ return d instanceof Date ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') : (d ? String(d).substring(0, 10) : ''); })(mainData[i][6]),
          jobTitle: mainData[i][14], // Job Title (Text)
          jrTitle: mainData[i][46],  // JR Title (Lookup)
          siteName: mainData[i][15],
          managerName: mainData[i][18],
          managerEmail: mainData[i][17], // Added for notifications
          requesterEmail: mainData[i][5], // Requester Email (Col 6, Index 5)
          employmentType: mainData[i][9],
          emailRequested: mainData[i][22] + (mainData[i][23] ? '@' + mainData[i][23].replace('@', '') : ''),
          // Additional Context for Pre-populating IT Form
          computerReq: mainData[i][24],      // Col 24 = Computer Req (New/Reassign/None)
          computerType: mainData[i][25],     // Col 25 = Computer Type
          computerPrevUser: mainData[i][26], // Col 26 = Computer Prev User (reassignment)
          computerPrevType: mainData[i][27], // Col 27 = Computer Prev Type
          computerSerial: mainData[i][28],   // Col 28 = Serial # (reassignment)
          phoneReq: mainData[i][36],         // Col 36 = Phone Req (Yes/No/type)
          phonePrevUser: mainData[i][37],    // Col 37 = Phone Prev User
          phonePrevNumber: mainData[i][38],  // Col 38 = Phone Prev Number
          requestedDomains: mainData[i][23], // Col 23 = Google Domain
          bossJobSites: mainData[i][39], // Col 39 = BOSS Job Sites
          bossCostSheet: mainData[i][40], // Col 40 = Cost Sheet Yes/No
          bossCostSheetJobs: mainData[i][41], // Col 41 = Cost Sheet Job #s
          bossTripReports: mainData[i][42], // Col 42 = Trip Reports Yes/No
          bossGrievances: mainData[i][43], // Col 43 = Grievances Yes/No
          jonasJobNumbers: mainData[i][44], // Col 44 = Jonas Job #s
          creditCardUSA: mainData[i][30], // Col 30 = CC USA Yes/No
          creditCardLimitUSA: mainData[i][31],
          creditCardLimitCanada: mainData[i][32],
          creditCardLimitHomeDepot: mainData[i][35],
          businessCards: mainData[i][21] && mainData[i][21].includes('Business Cards') ? 'Yes' : 'No',
          fleetioAccess: mainData[i][20] && mainData[i][20].includes('Fleetio') ? 'Yes' : 'No',
          jobSiteNumber: mainData[i][16], // Col 16 = Job Site #
          department: headers.indexOf('Department') !== -1 ? mainData[i][headers.indexOf('Department')] : '',
          purchasingSites: mainData[i][51] || '', // Col 51 = Purchasing Sites (joined)
          workflowType: 'New Hire'
        };
        break;
      }
    }
    
    if (!context.success) return context;
    
    if (idSetupSheet) {
      const idData = idSetupSheet.getDataRange().getValues();
      for (let j = 1; j < idData.length; j++) {
        if (idData[j][0] === workflowId) {
          context.internalEmployeeId = idData[j][3];
          context.siteDocsWorkerId = idData[j][4];
          context.siteDocsJobCode = idData[j][5];
          context.siteDocsUsername = idData[j][6];
          context.siteDocsPassword = idData[j][7];
          context.dssUsername = idData[j][8];
          context.dssPassword = idData[j][9];
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
      for (let ei = 1; ei < itCheckData.length; ei++) {
        if (String(itCheckData[ei][0]) === workflowId) {
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
    
    const assignedEmail = formData.Email_Username ? (formData.Email_Username + formData.Email_Domain) : 'N/A';
    
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
        context.assignedEmail = assignedEmail;

        const requesterEmail = context.requesterEmail;
        const recipients = [requesterEmail];
        if (context.managerEmail && context.managerEmail !== requesterEmail) {
          recipients.push(context.managerEmail);
        }

        if (recipients.length > 0) {
          const itCompletedBody = 'IT setup has been completed for ' + context.employeeName + '.\n\n' +
            '<strong>Assigned Email:</strong> ' + assignedEmail + '\n' +
            (formData.Computer_Assigned === 'Yes'
              ? '<strong>Computer:</strong> ' + (formData.Computer_Type || 'Assigned') + (formData.Computer_Serial ? ' (S/N: ' + formData.Computer_Serial + ')' : '') + '\n'
              : '') +
            (formData.Phone_Assigned === 'Yes'
              ? '<strong>Phone:</strong> ' + (formData.Phone_Number || 'Assigned') + '\n'
              : '') +
            '\nSpecialist requests (Credit Cards, Jonas, etc.) have been triggered in parallel.';
          sendFormEmail({
            to: recipients.join(','),
            subject: 'IT Setup Complete',
            body: itCompletedBody,
            formUrl: '',
            displayName: 'Onboarding System',
            contextData: context
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
  const assignedEmail = itData.Email_Username ? (itData.Email_Username + itData.Email_Domain) : '[Pending]';

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
    ccItems.push('Confirm card delivery / activation');
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
      description: JSON.stringify([
        'Create and send digital business card'
      ]),
      formType: 'businesscards'
    });
  }

  // 3. Fleetio
  if (context.fleetioAccess === 'Yes') {
    specialists.push({
      email: CONFIG.EMAILS.FLEETIO,
      category: 'Fleetio',
      name: 'Fleetio Access — ' + context.employeeName,
      description: JSON.stringify([
        'Assign Fleetio account for employee',
        'Assign vehicle (if applicable)'
      ]),
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

  // 5. Jonas + Central Purchasing — combined into one action item when both apply
  const hasJonas = context.jonasJobNumbers && context.jonasJobNumbers.toString().trim().length > 0;
  const hasCentralPurchasing = context.purchasingSites && context.purchasingSites.toString().trim().length > 0;

  if (hasJonas || hasCentralPurchasing) {
    const combinedItems = [];
    if (hasJonas) {
      const jonasJobs = context.jonasJobNumbers.toString().split(',').map(s => s.trim()).filter(s => s);
      if (jonasJobs.length > 0) {
        jonasJobs.forEach(j => combinedItems.push('Jonas: Provision access — ' + j));
      } else {
        combinedItems.push('Jonas: Provision access for employee');
      }
    }
    if (hasCentralPurchasing) {
      const cpSites = context.purchasingSites.toString().split(',').map(s => s.trim()).filter(s => s);
      if (cpSites.length > 0) {
        cpSites.forEach(s => combinedItems.push('Central Purchasing: Set up access — ' + s));
      } else {
        combinedItems.push('Central Purchasing: Set up access for employee');
      }
    }
    const combinedName = (hasJonas && hasCentralPurchasing)
      ? 'Jonas & Central Purchasing Setup — ' + context.employeeName
      : (hasJonas ? 'Jonas Setup — ' + context.employeeName : 'Central Purchasing Setup — ' + context.employeeName);
    specialists.push({
      email: CONFIG.EMAILS.JONAS,
      category: hasJonas && hasCentralPurchasing ? 'Jonas / Central Purchasing' : (hasJonas ? 'Jonas' : 'Central Purchasing'),
      name: combinedName,
      description: JSON.stringify(combinedItems),
      formType: hasJonas ? 'jonas' : 'centralpurchasing'
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
