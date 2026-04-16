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
          hireDate: mainData[i][6],
          jobTitle: mainData[i][14], // Job Title (Text)
          jrTitle: mainData[i][46],  // JR Title (Lookup)
          siteName: mainData[i][15],
          managerName: mainData[i][18],
          managerEmail: mainData[i][17], // Added for notifications
          requesterEmail: mainData[i][5], // Requester Email (Col 6, Index 5)
          employmentType: mainData[i][9],
          emailRequested: mainData[i][22] + (mainData[i][23] ? '@' + mainData[i][23].replace('@', '') : ''),
          // Additional Context for Pre-populating IT Form
          computerType: mainData[i][25], // Col 25 = Computer Type
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
    
    itSheet.appendRow(rowData);
    Logger.log('Appended row to IT Results: ' + JSON.stringify(rowData));
    
    const actingUser = Session.getActiveUser().getEmail();
    updateWorkflow(workflowId, 'In Progress', 'Specialist Forms Needed', '', actingUser);
    syncWorkflowState(workflowId);

    triggerSpecialists(workflowId, formData);

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
          sendFormEmail({
            to: recipients.join(','),
            subject: 'IT Setup Complete',
            body: 'IT setup has been completed for ' + context.employeeName + '. Credentials and equipment details are listed below. ' +
                  'Specialist requests (Credit Cards, Jonas, etc.) have been triggered in parallel.',
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

  // Get full context and inject IT result fields
  const context = getITContextData(workflowId);
  context.assignedEmail = assignedEmail;
  context.computerAssigned = itData.Computer_Assigned;
  context.computerType = itData.Computer_Type;
  context.phoneAssigned = itData.Phone_Assigned;
  context.phoneNumber = itData.Phone_Number;

  // Specialist context: full employee/site/manager/systems info, credentials stripped
  // (specialists don't need DSS/SiteDocs passwords — assigned email and ID are sufficient)
  const specContext = Object.assign({}, context);
  delete specContext.dssPassword;
  delete specContext.siteDocsPassword;
  delete specContext.siteDocsUsername;
  delete specContext.dssUsername;
  delete specContext.siteDocsWorkerId;
  delete specContext.siteDocsJobCode;

  // Shared employee summary prepended to every specialist body
  const empLine =
    '<b>Employee:</b> ' + context.employeeName +
    (context.department ? ' | <b>Dept:</b> ' + context.department : '') +
    '<br>' +
    '<b>Site:</b> ' + (context.siteName || 'N/A') +
    (context.jobSiteNumber ? ' (Job #' + context.jobSiteNumber + ')' : '') +
    ' | <b>Start Date:</b> ' + (context.hireDate || 'N/A') +
    '<br>' +
    '<b>Manager:</b> ' + (context.managerName || 'N/A') +
    (context.managerEmail ? ' (' + context.managerEmail + ')' : '') +
    '<br>' +
    '<b>Assigned Email:</b> ' + assignedEmail +
    '<br><br>';

  const specialists = [];

  // 1. Credit Card
  if (context.creditCardUSA === 'Yes' || context.creditCardCanada === 'Yes' || context.creditCardHomeDepot === 'Yes') {
    let ccLines = '';
    if (context.creditCardUSA === 'Yes')       ccLines += '• USA Card — Limit: ' + (context.creditCardLimitUSA || 'Standard') + '<br>';
    if (context.creditCardCanada === 'Yes')    ccLines += '• Canada Card — Limit: ' + (context.creditCardLimitCanada || 'Standard') + '<br>';
    if (context.creditCardHomeDepot === 'Yes') ccLines += '• Home Depot Card — Limit: ' + (context.creditCardLimitHomeDepot || 'Standard') + '<br>';

    specialists.push({
      email: CONFIG.EMAILS.CREDIT_CARD,
      subject: 'Credit Card Setup Required',
      body: empLine +
            '<b>Action:</b> Set up the following credit card(s) for this employee and complete the form below.<br><br>' +
            ccLines,
      param: 'creditcard'
    });
  }

  // 2. Business Cards
  if (context.businessCards === 'Yes') {
    specialists.push({
      email: CONFIG.EMAILS.BUSINESS_CARDS,
      subject: 'Business Cards Required',
      body: empLine +
            '<b>Action:</b> Order business cards for this employee and complete the form below.<br><br>' +
            '<b>Print Name/Title:</b> ' + (context.jrTitle || context.jobTitle || 'N/A') + '<br>' +
            '<b>Email on Card:</b> ' + assignedEmail + '<br>' +
            '<b>Phone on Card:</b> ' + (context.phoneNumber || 'N/A') + '<br>',
      param: 'businesscards'
    });
  }

  // 3. Fleetio
  if (context.fleetioAccess === 'Yes') {
    specialists.push({
      email: CONFIG.EMAILS.FLEETIO,
      subject: 'Fleetio Access Required',
      body: empLine +
            '<b>Action:</b> Create a Fleetio account for this employee and complete the form below.<br><br>' +
            '<b>Login Email:</b> ' + assignedEmail + '<br>' +
            '<b>Site:</b> ' + (context.siteName || 'N/A') + '<br>',
      param: 'fleetio'
    });
  }

  // 4. 30/60/90 Review — salary/non-hourly employees only
  if (context.employmentType !== 'Hourly') {
    specialists.push({
      email: CONFIG.EMAILS.REVIEW_306090_JR,
      subject: '30/60/90 Review Required',
      body: empLine +
            '<b>Action:</b> Set up the 30/60/90 day review plan and confirm JR assignment for this employee.<br><br>' +
            '<b>Job Title:</b> ' + (context.jobTitle || 'N/A') + '<br>' +
            '<b>JR Title:</b> ' + (context.jrTitle || 'N/A') + '<br>',
      param: 'review'
    });
  }

  // 5. Jonas — only if job numbers were provided
  if (context.jonasJobNumbers && context.jonasJobNumbers.toString().trim().length > 0) {
    const safeJobNumbers = context.jonasJobNumbers.toString().split(',').map(s => s.trim()).filter(s => s).join('<br>• ');
    specialists.push({
      email: CONFIG.EMAILS.JONAS,
      subject: 'Jonas Access Required',
      body: empLine +
            '<b>Action:</b> Provision Jonas access for this employee using the job numbers below and complete the form.<br><br>' +
            '<b>Login Email:</b> ' + assignedEmail + '<br>' +
            '<b>Job Numbers:</b><br>• ' + safeJobNumbers + '<br>',
      param: 'jonas'
    });
  }

  // 6. Central Purchasing — uses same Jonas team email, only if sites were selected
  if (context.purchasingSites && context.purchasingSites.toString().trim().length > 0) {
    const safeSites = context.purchasingSites.toString().split(',').map(s => s.trim()).filter(s => s).join('<br>• ');
    specialists.push({
      email: CONFIG.EMAILS.JONAS,
      subject: 'Central Purchasing Access Required',
      body: empLine +
            '<b>Action:</b> Set up Central Purchasing access for this employee at the listed sites and complete the form below.<br><br>' +
            '<b>Login Email:</b> ' + assignedEmail + '<br>' +
            '<b>Purchasing Sites:</b><br>• ' + safeSites + '<br>',
      param: 'centralpurchasing'
    });
  }

  // Send all
  specialists.forEach(spec => {
    const specUrl = buildFormUrl('specialist', { wf: workflowId, dept: spec.param });
    sendFormEmail({
      to: spec.email,
      subject: spec.subject,
      body: spec.body,
      formUrl: specUrl,
      displayName: 'TEAM Group - Employee Onboarding',
      contextData: specContext
    });
  });

  Logger.log('[SUCCESS] Specialist emails sent (' + specialists.length + ') for: ' + workflowId);
}
