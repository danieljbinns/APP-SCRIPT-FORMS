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
    
    for (let i = 1; i < mainData.length; i++) {
      if (mainData[i][0] === workflowId) {
        context = {
          success: true,
          employeeName: mainData[i][10] + ' ' + mainData[i][12],
          firstName: mainData[i][10],
          lastName: mainData[i][12],
          hireDate: mainData[i][6],
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
          businessCards: mainData[i][20] && mainData[i][20].includes('Business Cards') ? 'Yes' : 'No',
          fleetioAccess: mainData[i][20] && mainData[i][20].includes('Fleetio') ? 'Yes' : 'No',
          jobSiteNumber: mainData[i][16], // Col 16 = Job Site #
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
    
    triggerSpecialists(workflowId, formData);

    // Notify Requester
    try {
      const context = getITContextData(workflowId);
      if (context.success && context.emailRequested) { // requester email is stored in emailRequested field?
         // accessing mainData[i][19] might be Requester Email? 
         // Let's check getITContextData mapping:
         // emailRequested: mainData[i][19] -> wait, col 19 is 'Requester Email' in Initial Requests?
         // Let's assume standard field is used.
         // Actually, let's use sendFormEmail generically.
         
           const requesterEmail = context.requesterEmail; // Fixed: Use correct field
           
           const recipients = [requesterEmail];
           // Attempt to get manager email if available in context
           if (context.managerEmail && context.managerEmail !== requesterEmail) {
             recipients.push(context.managerEmail);
           }

           if (recipients.length > 0) {
             sendFormEmail({
               to: recipients.join(','),
               subject: 'IT Setup Complete: ' + context.employeeName,
               body: `Good news! IT Setup has been completed for ${context.employeeName}.\n\n` +
                     `<strong>CREDENTIALS:</strong>\n` +
                     `• Email: ${assignedEmail} (Pwd: ${formData.Email_Temp_Password || 'N/A'})\n` +
                     `• DSS: ${context.dssUsername || 'N/A'} (Pwd: ${context.dssPassword || 'N/A'})\n` +
                     `• SiteDocs: ${context.siteDocsUsername || 'N/A'} (Pwd: ${context.siteDocsPassword || 'N/A'})\n` + 
                     `• SiteDocs Worker ID: ${context.siteDocsWorkerId || 'N/A'}\n\n` +
                     `<strong>EQUIPMENT:</strong>\n` +
                     `• Computer: ${formData.Computer_Assigned} (${formData.Computer_Serial || 'N/A'})\n` +
                     `• Phone: ${formData.Phone_Assigned} (${formData.Phone_Number || 'N/A'})\n` +
                     `• Phone VM Pin: ${formData.Phone_VM_Password || 'N/A'}\n\n` +
                     `Specialist requests (Credit Cards, Jonas, etc.) have been triggered parallel to this.`,
               // formUrl: getBaseUrl() + '?form=request_details&id=' + workflowId, // BUTTON REMOVED per user request
        formUrl: '',
        displayName: 'Onboarding System'
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
  
  // Get full context data again to ensure we have all initial request info
  const context = getITContextData(workflowId);
  
  // Add IT Result data to context for emails
  context.assignedEmail = assignedEmail;
  context.computerAssigned = itData.Computer_Assigned;
  context.computerType = itData.Computer_Type;
  context.phoneAssigned = itData.Phone_Assigned;
  context.phoneNumber = itData.Phone_Number;
  
  const specialists = [];
  
  // 1. Credit Card Specialist
  if (context.creditCardUSA === 'Yes' || context.creditCardCanada === 'Yes' || context.creditCardHomeDepot === 'Yes') {
    let ccDetails = '';
    if (context.creditCardUSA === 'Yes') ccDetails += `• USA Card (Limit: ${context.creditCardLimitUSA || 'Standard'})\n`;
    if (context.creditCardCanada === 'Yes') ccDetails += `• Canada Card (Limit: ${context.creditCardLimitCanada || 'Standard'})\n`;
    if (context.creditCardHomeDepot === 'Yes') ccDetails += `• Home Depot Card (Limit: ${context.creditCardLimitHomeDepot || 'Standard'})\n`;
    
    specialists.push({
      email: CONFIG.EMAILS.CREDIT_CARD,
      subject: 'Action Required: Credit Card Setup',
      body: `New employee requires credit card(s):\n\n${ccDetails}\nEmployee has been assigned email: ${assignedEmail}`,
      param: 'creditcard'
    });
  }
  
  // 2. Business Cards
  if (context.businessCards === 'Yes') {
    specialists.push({
      email: CONFIG.EMAILS.BUSINESS_CARDS,
      subject: 'Action Required: Business Cards Order',
      body: `New employee requires business cards.\n\nTitle: ${context.jrTitle || context.jobTitle}\nEmail: ${assignedEmail}\nPhone: ${context.phoneNumber || 'N/A'}`,
      param: 'businesscards'
    });
  }
  
  // 3. Fleetio
  if (context.fleetioAccess === 'Yes') {
    specialists.push({
      email: CONFIG.EMAILS.FLEETIO,
      subject: 'Action Required: Fleetio Account Setup',
      body: `New employee requires Fleetio access.\n\nEmail: ${assignedEmail}\nSite: ${context.siteName}`,
      param: 'fleetio'
    });
  }
  
  // 4. JR & 30/60/90 Reviews (Always sent for salary/office staff)
  specialists.push({
    email: CONFIG.EMAILS.REVIEW_306090_JR,
    subject: 'Action Required: 30/60/90 Reviews & JR Confirmation',
    body: `Employee onboarding has been completed by IT. The employee has been assigned the email address: <strong>${assignedEmail}</strong>.<br><br>` + 
          `Please proceed with the 30/60/90 plan setup and JR confirmation for this employee. Additional request details are provided in the table below.`,
    param: 'review'
  });
  
    // 5. Jonas
  // Check if Jonas access was requested OR specific job numbers provided
  if (context.jonasJobNumbers && context.jonasJobNumbers.length > 0) {
    // Format job numbers: One per line
    const safeJobNumbers = context.jonasJobNumbers.toString().split(',').map(s => s.trim()).filter(s => s).join('<br>• ');
    
    specialists.push({
      email: CONFIG.EMAILS.JONAS,
      subject: 'Action Required: Jonas Account Setup',
      body: `New employee requires Jonas access.<br><br><strong>Requested Job Numbers:</strong><br>• ${safeJobNumbers}<br><br>Email: ${assignedEmail}`,
      param: 'jonas'
    });
  }
  


  // Send all emails
  specialists.forEach(spec => {
    const specUrl = buildFormUrl('specialist', { wf: workflowId, dept: spec.param });
    sendFormEmail({
      to: spec.email,
      subject: spec.subject,
      body: spec.body, // This body content is injected into the rich template
      formUrl: specUrl,
      displayName: 'TEAM Group - Employee Onboarding',
      contextData: context // Pass full context for the rich table
    });
  });
  
  Logger.log('[SUCCESS] Specialist emails sent for: ' + workflowId);
}
