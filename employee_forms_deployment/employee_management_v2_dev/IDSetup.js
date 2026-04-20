/**
 * Employee ID Setup Form - Handler Functions
 */

function serveIDSetup(workflowId) {
  if (!workflowId) {
    return HtmlService.createHtmlOutput('<h1>Error: No workflow ID provided</h1>');
  }
  
  const template = HtmlService.createTemplateFromFile('EmployeeIDSetup');
  template.workflowId = workflowId;
  template.formId = '';
  
  const requestData = getIDSetupRequestData(workflowId);
  
  if (!requestData || !requestData.success) {
    return HtmlService.createHtmlOutput('<h1>Data Not Found</h1><p>Could not find initial request data for Workflow ID: ' + workflowId + '</p><p>Please contact the administrator or try submitting a new request.</p><p>Debug info: ' + (requestData ? requestData.message : 'NULL') + '</p>');
  }

  template.requestData = requestData;
  template.generatedEmployeeId = generateEmployeeId();
  // FORCE DSS Username to be firstname.lastname per user request (ignore requested email for this field)
  const dssDefault = generateDssUsername(requestData.firstName, requestData.lastName);
  template.generatedDssUsername = dssDefault;

  // SiteDocs username defaults to requested email if available
  const requestedEmail = (requestData.requestedUsername && requestData.requestedDomain) ? 
    (requestData.requestedUsername + '@' + requestData.requestedDomain.replace('@', '')) : '';
  template.generatedSiteDocsDefault = requestedEmail;
  
  return template.evaluate()
    .setTitle('Employee ID Setup')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getIDSetupRequestData(workflowId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Use header-based lookup so column shifts don't silently corrupt reads
    var col = {};
    var colNames = [
      'Workflow ID', 'Requester Email', 'Hire Date', 'New Hire/Rehire',
      'Employee Type', 'Employment Type', 'First Name', 'Last Name',
      'Position Title', 'JR Assign', 'Site Name', 'Job Site #',
      'Manager Email', 'Manager Name', 'System Access', 'Systems',
      'Google Email', 'Google Domain', 'Department'
    ];
    colNames.forEach(function(name) {
      col[name] = headers.indexOf(name);
    });

    function get(row, name) {
      return col[name] !== -1 ? row[col[name]] : '';
    }

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === workflowId) {
        var row = data[i];
        var firstName = get(row, 'First Name');
        var lastName  = get(row, 'Last Name');
        var hireDateRaw = get(row, 'Hire Date');
        var systemsRaw  = get(row, 'Systems');
        return {
          success: true,
          employeeName: firstName + ' ' + lastName,
          firstName: firstName,
          lastName: lastName,
          hireDate: hireDateRaw instanceof Date ? Utilities.formatDate(hireDateRaw, 'UTC', 'yyyy-MM-dd') : (hireDateRaw ? String(hireDateRaw).substring(0, 10) : ''),
          position: get(row, 'Position Title'),
          jrTitle: get(row, 'JR Assign') || '',
          siteName: get(row, 'Site Name'),
          jobSiteNumber: get(row, 'Job Site #') || '',
          managerName: get(row, 'Manager Name'),
          managerEmail: get(row, 'Manager Email'),
          requesterEmail: get(row, 'Requester Email'),
          employmentType: get(row, 'Employment Type') || '',
          employeeType: get(row, 'Employee Type') || '',
          newHireOrRehire: get(row, 'New Hire/Rehire') || '',
          systemsSelected: systemsRaw,
          systemAccess: get(row, 'System Access'),
          siteDocsAccess: systemsRaw && systemsRaw.includes('SiteDocs'),
          requestedUsername: get(row, 'Google Email'),
          requestedDomain: get(row, 'Google Domain'),
          department: get(row, 'Department') || ''
        };
      }
    }

    return { success: false, message: 'Workflow ID not found' };

  } catch (error) {
    return { success: false, message: error.message };
  }
}

function generateEmployeeId() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.ID_SETUP_RESULTS);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      // No previous IDs, start at 30000
      return '30000';
    }
    
    // Get all employee IDs from column D (Internal Employee ID)
    const data = sheet.getRange(2, 4, sheet.getLastRow() - 1, 1).getValues();
    let maxId = 29999; // Start below 30000
    
    data.forEach(row => {
      const id = row[0];
      if (id && !isNaN(id)) {
        const numId = parseInt(id);
        if (numId > maxId) {
          maxId = numId;
        }
      }
    });
    
    return String(maxId + 1);
    
  } catch (error) {
    Logger.log('Error generating employee ID: ' + error.toString());
    // Fallback to timestamp-based if there's an error
    const timestamp = new Date().getTime();
    return  '30' + timestamp.toString().slice(-3);
  }
}

function generateDssUsername(firstName, lastName) {
  if (!firstName || !lastName) return '';
  return (firstName + '.' + lastName).toLowerCase();
}

function submitEmployeeIDSetup(formData) {
  try {
    const workflowId = formData.workflowId;
    const formId = generateFormId('ID_SETUP');
    
    // FETCH REQUEST DATA FIRST (Needed for names in email)
    const requestData = getIDSetupRequestData(workflowId);
    if (!requestData.success) throw new Error('Could not fetch request data for workflow: ' + workflowId);

    Logger.log('Employee ID Setup submitted for: ' + workflowId);
    
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let resultsSheet = ss.getSheetByName(CONFIG.SHEETS.ID_SETUP_RESULTS);
    
    if (!resultsSheet) {
      resultsSheet = ss.insertSheet(CONFIG.SHEETS.ID_SETUP_RESULTS);
      resultsSheet.appendRow([
        'Workflow ID', 'Form ID', 'Submission Timestamp', 'Internal Employee ID',
        'SiteDocs Worker ID', 'SiteDocs Job Code', 'SiteDocs Username',
        'SiteDocs Password', 'DSS Username', 'DSS Password',
        'Setup Notes', 'BOSS WIS Created', 'Submitted By'
      ]);
      resultsSheet.getRange(1, 1, 1, 13).setFontWeight('bold').setBackground('#EB1C2D').setFontColor('#ffffff');
    }
    
    resultsSheet.appendRow([
      workflowId, formId, new Date(), formData.internalEmployeeId,
      formData.siteDocsWorkerId, formData.siteDocsJobCode,
      formData.siteDocsUsername || 'N/A', formData.siteDocsPassword || 'N/A',
      formData.dssUsername, formData.dssPassword,
      formData.setupNotes || '', formData.bossWisCreated || 'No', Session.getActiveUser().getEmail()
    ]);
    
    const actingUser = Session.getActiveUser().getEmail();
    updateWorkflow(workflowId, 'In Progress', 'ID Setup Complete', '', actingUser);
    syncWorkflowState(workflowId);

    triggerNextStepFromIDSetup(workflowId, formData, requestData);
    
    return {
      success: true,
      message: 'Employee ID setup completed successfully'
    };
    
  } catch (error) {
    Logger.log('[ERROR] Employee ID setup error: ' + error.toString());
    return {
      success: false,
      message: error.message
    };
  }
}

function sendSafetyOnboardingEmail(workflowId, requestData, setupData) {
  try {
    const contextData = {
      workflowType: 'New Hire',
      employeeName: requestData.employeeName,
      jobTitle: requestData.position,
      jrTitle: requestData.jrTitle,
      siteName: requestData.siteName,
      hireDate: requestData.hireDate,
      employmentType: requestData.employmentType,
      managerName: requestData.managerName,
      dssUsername: setupData ? setupData.dssUsername : '',
      siteDocsUsername: setupData ? (setupData.siteDocsUsername || '') : ''
    };

    const description = JSON.stringify([
      'Assign SiteDocs locations for employee',
      'Site: ' + (requestData.siteName || 'N/A'),
      'DSS Username: ' + (setupData ? (setupData.dssUsername || 'N/A') : 'N/A'),
      'SiteDocs Username: ' + (setupData ? (setupData.siteDocsUsername || 'N/A') : 'N/A'),
      'Assign DSS learning paths',
      'Confirm SiteDocs and DSS setup complete'
    ]);

    const tid = ActionItemService.createActionItem(
      workflowId,
      'Safety',
      'Safety Onboarding — ' + requestData.employeeName,
      description,
      CONFIG.EMAILS.SAFETY,
      'safety_onboarding'
    );

    sendFormEmail({
      to: CONFIG.EMAILS.SAFETY,
      subject: 'Safety Onboarding Required — ' + requestData.employeeName,
      body: 'Please assign SiteDocs locations and DSS learning paths for this employee. Complete the action item using the button below.',
      formUrl: buildFormUrl('action_item_view', { tid: tid }),
      displayName: 'TEAM Group - Employee Onboarding',
      contextData: contextData
    });

    Logger.log('[SUCCESS] Safety Onboarding Action Item created (' + tid + ') for ' + workflowId);
  } catch (safeErr) {
    Logger.log('[ERROR] Failed to create Safety Onboarding Action Item: ' + safeErr.toString());
  }
}

function buildStartDateCalendarLink_(requestData) {
  try {
    var rawDate = requestData.hireDate;
    if (!rawDate) return '';
    var dateStr;
    if (rawDate instanceof Date) {
      dateStr = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), 'yyyyMMdd');
    } else {
      // Avoid new Date(string) UTC shift — extract YYYYMMDD directly from formatted string
      dateStr = String(rawDate).replace(/-/g, '').substring(0, 8);
    }
    var calTitle = encodeURIComponent((requestData.employeeName || 'New Employee') + ' - Start Date');
    var calDetails = encodeURIComponent('Site: ' + (requestData.siteName || '') + ' | Title: ' + (requestData.position || ''));
    var calUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + calTitle + '&dates=' + dateStr + '/' + dateStr + '&details=' + calDetails;
    return '<br><br><a href="' + calUrl + '" style="display:inline-block; padding:10px 20px; background:#4285f4; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:600;">Add Start Date to Calendar</a>';
  } catch(e) {
    Logger.log('Could not build start date calendar link: ' + e.message);
    return '';
  }
}

function triggerNextStepFromIDSetup(workflowId, setupData, requestData) {
  if (!requestData) requestData = getIDSetupRequestData(workflowId);
  if (!requestData.success) return;

  // Optimization: Use already fetched requestData instead of re-reading sheet
  const employmentType = requestData.employmentType || '';
  const systemAccess = requestData.systemAccess || '';

  Logger.log('Routing from ID Setup: Type=' + employmentType + ', SystemAccess=' + systemAccess);

  // Get workflow context for email
  const context = getWorkflowContext(workflowId);
  const calendarLinkHtml = buildStartDateCalendarLink_(requestData);
  
  if (employmentType === 'Hourly' && systemAccess === 'No') {
    // PHASE 2 UDPATE: User requested to notify requester/manager directly with credentials...
    // ...BUT ALSO continue to HR for ADP verification.
    
    // 1. Notify Requester & Manager with Credentials (DSS/SiteDocs)
    // Get Requester and Manager emails
    const requesterEmail = requestData.requesterEmail;
    const managerEmail = requestData.managerEmail;
    
    const recipients = [];
    if (requesterEmail) recipients.push(requesterEmail);
    if (managerEmail && managerEmail !== requesterEmail) recipients.push(managerEmail);
    
    if (recipients.length > 0) {
      sendFormEmail({
        to: recipients.join(','),
        subject: 'Credentials Ready',
        body: 'The onboarding process has progressed. Credentials have been generated for this hourly employee.\n\n' +
              '<strong>CREDENTIALS:</strong>\n' +
              '• DSS: ' + (setupData.dssUsername || 'N/A') + ' (Pwd: ' + (setupData.dssPassword || 'N/A') + ')\n' +
              '• SiteDocs: ' + (setupData.siteDocsUsername || 'N/A') + ' (Pwd: ' + (setupData.siteDocsPassword || 'N/A') + ')\n' +
              '• SiteDocs Worker ID: ' + (setupData.siteDocsWorkerId || 'N/A') + '\n\n' +
              'HR Verification is pending for ADP setup.',
        formUrl: '', // REMOVED BUTTON as per user request (view is inaccurate)
        displayName: 'TEAM Group - Employee Onboarding',
        contextData: context
      });
      Logger.log('[SUCCESS] Credentials email sent to requester & manager (Hourly/No System Access - Preliminary)');
    }

    // 2. CONTINUE TO HR VERIFICATION (Do not mark complete yet)
    const hrUrl = buildFormUrl('hr_verification', { wf: workflowId });
    const hrBody = 'Employee ID setup has been completed.\n\nPlease verify employee information and assign ADP Associate ID using the button below. IT setup will be skipped for this hourly/no-access employee.' + calendarLinkHtml;
    sendFormEmail({
      to: CONFIG.EMAILS.HR,
      subject: 'HR Verification Required',
      body: hrBody,
      formUrl: hrUrl,
      displayName: 'TEAM Group - Employee Onboarding',
      contextData: context
    });
    // Notify payroll at same time as HR — same email and form access
    sendFormEmail({
      to: CONFIG.EMAILS.PAYROLL,
      subject: 'HR Verification Required',
      body: hrBody,
      formUrl: hrUrl,
      displayName: 'TEAM Group - Employee Onboarding',
      contextData: context
    });
    Logger.log('[SUCCESS] HR Verification email sent to HR + Payroll (Hourly/No System Access - HR Step active)');

    // Send Safety Onboarding form to safety group (hourly path fires here; salary fires after HR Verification)
    sendSafetyOnboardingEmail(workflowId, requestData, setupData);

  } else {
    // Standard Path (Salary OR System Access)
    const hrUrl = buildFormUrl('hr_verification', { wf: workflowId });
    const hrBody = 'Employee ID setup has been completed.\n\nPlease verify employee information and assign ADP Associate ID using the button below. IT setup will be triggered after HR verification.' + calendarLinkHtml;
    sendFormEmail({
      to: CONFIG.EMAILS.HR,
      subject: 'HR Verification Required',
      body: hrBody,
      formUrl: hrUrl,
      displayName: 'TEAM Group - Employee Onboarding',
      contextData: context
    });
    // Notify payroll at same time as HR — same email and form access
    sendFormEmail({
      to: CONFIG.EMAILS.PAYROLL,
      subject: 'HR Verification Required',
      body: hrBody,
      formUrl: hrUrl,
      displayName: 'TEAM Group - Employee Onboarding',
      contextData: context
    });
    Logger.log('[SUCCESS] HR Verification email sent to HR + Payroll (Salary/System Access path - IT will follow)');
  }
}

