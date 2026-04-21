/**
 * Employee Management Forms - Email Utilities Library
 * Shared email sending and templating functions
 */

/**
 * Builds the canonical email subject for all system emails.
 * This is the single source of truth for subject format — modify here to change globally.
 *
 * Format:
 *   [WorkflowType | EmploymentType] Action: Employee Name | Site | DateLabel: YYYY-MM-DD | managerEmail
 * Reminder prefix:
 *   REMINDER [Requested: YYYY-MM-DD]: [WorkflowType | EmploymentType] Action: Employee Name | ...
 *
 * @param {string} action - The action verb phrase only, no employee name (e.g. 'HR Approval Required')
 * @param {Object} contextData - Workflow context: workflowType, employmentType, employeeName, siteName, hireDate, managerEmail
 * @param {Object} [opts] - Optional: { isReminder: true, requestDate: Date }
 * @returns {string}
 */
function buildEmailSubject(action, contextData, opts) {
  if (!contextData) return action;
  opts = opts || {};

  var workflowType   = contextData.workflowType || '';
  var employmentType = contextData.employmentType || contextData.empType || '';

  // EXPEDITE: Hourly employees that still require system access follow the full HR->IT path.
  // Flag this in the subject so HR/Payroll don't treat them as standard hourly (skip-IT) cases.
  var isExpedite = employmentType === 'Hourly' && contextData.systemAccess && contextData.systemAccess !== 'No';

  // Tag: Status Change uses change types in tag; others use employment type
  var tag;
  if (workflowType === 'Status Change') {
    var changeTypes = contextData.changeTypes || '';
    tag = '[Status Change' + (changeTypes ? ': ' + changeTypes : '') +
          (employmentType ? ' | ' + employmentType : '') +
          (isExpedite ? ' | EXPEDITE' : '') + ']';
  } else {
    tag = workflowType
      ? '[' + workflowType + (employmentType ? ' | ' + employmentType : '') + (isExpedite ? ' | EXPEDITE' : '') + ']'
      : (employmentType ? '[' + employmentType + (isExpedite ? ' | EXPEDITE' : '') + ']' : '');
  }

  // Date label based on workflow type
  var dateLabel = '';
  if (workflowType === 'New Hire')           dateLabel = 'Start Date';
  else if (workflowType === 'Termination')   dateLabel = 'Termination Date';
  else if (workflowType === 'Status Change') dateLabel = 'Effective Date';

  var dateStr = '';
  var dateValue = contextData.hireDate || '';
  if (dateValue) {
    try {
      var d = dateValue instanceof Date ? dateValue : new Date(String(dateValue).replace(/^(\d{4}-\d{2}-\d{2})$/, '$1T12:00:00'));
      if (!isNaN(d.getTime())) dateStr = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } catch (e) { dateStr = String(dateValue).substring(0, 10); }
  }

  var employeeName = contextData.employeeName || '';
  var site         = contextData.siteName || '';
  var manager      = contextData.managerEmail || '';

  var core = (tag ? tag + ' ' : '') + action + (employeeName ? ': ' + employeeName : '');
  var parts = [core];

  if (workflowType === 'Status Change') {
    // Site: prefer siteTransfer (old -> new), fall back to siteName
    var siteTransfer = contextData.siteTransfer || '';
    if (siteTransfer && siteTransfer.indexOf('N/A') === -1) parts.push(siteTransfer);
    else if (site) parts.push(site);
    // Classification / employment type change (old -> new)
    var classChange = contextData.classChange || '';
    if (classChange && classChange.indexOf('N/A') === -1) parts.push(classChange);
    else if (employmentType) parts.push(employmentType);
    // Date
    if (dateLabel && dateStr) parts.push(dateLabel + ': ' + dateStr);
    // Manager: show old -> new if both present and different
    var managerOld = contextData.managerOldEmail || '';
    var managerNew = contextData.managerNewEmail || manager;
    if (managerOld && managerNew && managerOld !== managerNew) parts.push(managerOld + ' -> ' + managerNew);
    else if (managerNew) parts.push(managerNew);
  } else if (workflowType === 'Termination') {
    if (site) parts.push(site);
    if (dateLabel && dateStr) parts.push(dateLabel + ': ' + dateStr);
    var reason = contextData.reason || '';
    if (reason) parts.push(reason);
    if (manager) parts.push(manager);
  } else {
    // New Hire and default
    if (site) parts.push(site);
    if (dateLabel && dateStr) parts.push(dateLabel + ': ' + dateStr);
    if (manager) parts.push(manager);
  }

  var subject = parts.join(' | ');

  if (opts.isReminder) {
    var reqStr = '';
    if (opts.requestDate) {
      try {
        var rd = opts.requestDate instanceof Date ? opts.requestDate : new Date(String(opts.requestDate));
        if (!isNaN(rd.getTime())) reqStr = Utilities.formatDate(rd, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } catch (e) { reqStr = String(opts.requestDate).substring(0, 10); }
    }
    subject = 'REMINDER [Requested: ' + reqStr + ']: ' + subject;
  }

  return subject;
}

/**
 * Helper function to build context data from workflow
 * Fetches initial request data to include in subsequent emails
 * @param {string} workflowId - Workflow ID
 * @returns {Object} Context data for emails
 */
function getWorkflowContext(workflowId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

    // Support for Termination Workflows
    if (workflowId && workflowId.startsWith('TERM')) {
      const termData = typeof getTerminationData === 'function' ? getTerminationData(workflowId) : null;
      if (termData) {
        return {
          workflowType: 'Termination',
          employeeName: termData.employeeName,
          siteName: termData.siteName,
          managerName: termData.managerName,
          managerEmail: termData.managerEmail,
          requesterEmail: termData.requesterEmail,
          hireDate: termData.termDate,
          equipmentRaw: termData.eqToReturn,
          systems: termData.systems ? termData.systems.split(',').map(s => s.trim()) : [],
          empPhone: termData.empPhone,
          reason: termData.reason
        };
      }
    }

    const sheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
    
    if (!sheet) {
      Logger.log('Initial Requests sheet not found');
      return null;
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find the row with matching workflow ID
    const workflowIdCol = headers.indexOf('Workflow ID');
    const row = data.find((r, i) => i > 0 && r[workflowIdCol] === workflowId);
    
    if (!row) {
      Logger.log('Workflow data not found for ID: ' + workflowId);
      return null;
    }
    
    // Build comprehensive context object with all request details
    const systemsRaw = row[headers.indexOf('Systems')] || '';
    const systemsList = systemsRaw ? systemsRaw.split(',').map(s => s.trim()) : [];
    
    // Default Context from Initial Request
    const context = {
      workflowType: (workflowId && workflowId.indexOf('CHANGE_') === 0) ? 'Status Change' : 'New Hire',
      employeeName: row[headers.indexOf('First Name')] + ' ' + row[headers.indexOf('Last Name')],
      jobTitle: row[headers.indexOf('Position Title')],
      jrTitle: row[headers.indexOf('JR Assign')], // Capture JR Title also
      siteName: row[headers.indexOf('Site Name')],
      hireDate: (function(d){ return d instanceof Date ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') : (d ? String(d).substring(0, 10) : ''); })(row[headers.indexOf('Hire Date')]),
      managerName: row[headers.indexOf('Manager Name')],
      managerEmail: row[headers.indexOf('Manager Email')],
      requesterEmail: row[5], // Hardcoded to Col F (Index 5) for reliability
      requestDate: Utilities.formatDate(new Date(row[headers.indexOf('Timestamp')]), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      employmentType: row[headers.indexOf('Employment Type')],
      department: row[headers.indexOf('Department')] || '',
      employeeType: row[headers.indexOf('Employee Type')],
      systemAccess: row[headers.indexOf('System Access')],
      systems: systemsList,
      workType: row[headers.indexOf('Work Type')] || '',
      equipmentRaw: row[headers.indexOf('Equipment')] || '',
      // Detailed Equipment Context (Using indices as fallback if headers change)
      computerType: row[headers.indexOf('Computer Type')] || row[25],
      computerRequestType: row[headers.indexOf('Computer Request Type')] || row[24],
      phoneRequestType: row[headers.indexOf('Mobile Phone Request Type')] || row[36],
      newHireOrRehire: row[headers.indexOf('New Hire/Rehire')],
      jobSiteNumber: row[headers.indexOf('Job Site #')]
    };
    
    // PHASE 4 FIX: Check HR Verification Results for verified titles and ADP ID
    // This ensures downstream forms/emails use the HR-approved data
    const hrSheet = ss.getSheetByName(CONFIG.SHEETS.HR_VERIFICATION_RESULTS);
    if (hrSheet) {
        const hrData = hrSheet.getDataRange().getValues();
        // Workflow ID is Col A (0), ADP ID is Col D (3), Verified Title is Col H (7)
        const hrRow = hrData.find(r => r[0] === workflowId);
        if (hrRow) {
             if (hrRow[3]) context.adpAssociateId = hrRow[3]; // ADP Associate ID
             const verifiedTitles = hrRow[7]; // "Job Title / JR Title"
             if (verifiedTitles && verifiedTitles.includes(' / ')) {
                 const parts = verifiedTitles.split(' / ');
                 context.jobTitle = parts[0].trim();
                 context.jrTitle = parts[1].trim();
             }
        }
    }

    // PHASE 5 FIX: Fetch ID Setup Credentials (DSS/SiteDocs) for emails
    const idSheet = ss.getSheetByName(CONFIG.SHEETS.ID_SETUP_RESULTS);
    if (idSheet) {
        const idData = idSheet.getDataRange().getValues();
        // Workflow ID is Col A, Headers: WFID, FormID, Time, EmpID, WorkerID, JobCode, SD User, SD Pass, DSS User, DSS Pass
        const idRow = idData.find(r => r[0] === workflowId);
        if (idRow) {
            context.internalEmployeeId = idRow[3];
            context.siteDocsWorkerId = idRow[4];
            context.siteDocsJobCode = idRow[5];
            context.siteDocsUsername = idRow[6];
            context.siteDocsPassword = idRow[7];
            context.dssUsername = idRow[8];
            context.dssPassword = idRow[9];
        }
    }

    // Fetch assigned email from IT Results (Col E = assignedEmail)
    const itSheet = ss.getSheetByName(CONFIG.SHEETS.IT_RESULTS);
    if (itSheet) {
        const itData = itSheet.getDataRange().getValues();
        const itRow = itData.find(r => r[0] === workflowId);
        if (itRow) context.assignedEmail = itRow[4];
    }
    
    return context;
    
  } catch (error) {
    Logger.log('Error getting workflow context: ' + error.toString());
    return null;
  }
}

/**
 * Send form notification email with HTML template
 * @param {Object} options - Email configuration
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.body - Plain text body
 * @param {string} [options.formUrl] - Optional form URL for button
 * @param {string} [options.displayName] - Optional sender display name
 */
function sendFormEmail(options) {
  const { to, subject, body, formUrl, displayName, contextData, subjectOpts } = options;

  if (!to || !subject || !body) {
    Logger.log('❌ Email missing required fields');
    return false;
  }

  try {
    // E1: Build standardized subject — canonical format defined in buildEmailSubject()
    var enrichedSubject = buildEmailSubject(subject, contextData, subjectOpts);

    const redirectEmail = ConfigurationService.getSetting('EMAIL_REDIRECT_ALL');
    const finalTo = redirectEmail ? redirectEmail : to;
    const finalSubject = redirectEmail ? '[TEST] ' + enrichedSubject : enrichedSubject;
    
    // If redirected, add a notice to the top of the body
    let finalBody = body;
    if (redirectEmail) {
      finalBody = `[DEVELOPMENT MODE - REDIRECTED FROM: ${to}]\n\n` + body;
    }

    const htmlBody = createEmailTemplate(finalSubject, finalBody, formUrl, contextData);
    
    const emailOptions = {
      to: finalTo,
      subject: finalSubject,
      body: finalBody,
      htmlBody: htmlBody,
      name: displayName || 'TEAM Group - Employee Management'
    };

    if (options.attachment) {
      emailOptions.attachments = [options.attachment];
    }
    
    MailApp.sendEmail(emailOptions);
    if (redirectEmail) {
      Logger.log('✓ [TEST MODE] Email redirected from ' + to + ' to: ' + redirectEmail);
    } else {
      Logger.log('✓ Email sent to: ' + to);
    }
    return true;
    
  } catch (error) {
    Logger.log('❌ Error sending email to ' + to + ': ' + error.toString());
    return false;
  }
}

function createEmailTemplate(subject, body, formUrl, contextData) {
  const contextHtml = contextData ? createContextBlock(contextData) : '';
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 20px; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 30px; text-align: center; border-bottom: 3px solid #EB1C2D;">
            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">${subject}</h1>
          </td>
        </tr>
        
        <!-- Context Panel (if provided) -->
        ${contextHtml}
        
        <!-- Body -->
        <tr>
          <td style="padding: 30px;">
            <div style="color: #333333; font-size: 16px; line-height: 1.6;">
              ${(body.includes('<table') || body.includes('<div')) ? body : body.replace(/\n/g, '<br>')}
            </div>
            
            ${formUrl ? `
            <div style="margin-top: 30px; text-align: center;">
              <a href="${formUrl}" style="background: linear-gradient(135deg, #EB1C2D 0%, #c41828 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(235, 28, 45, 0.3);">
                Open Form →
              </a>
            </div>
            ` : ''}
          </td>
        </tr>
        
        <!-- Footer -->
        <tr>
          <td style="background-color: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0; color: #666666; font-size: 12px;">
              TEAM Group - Employee Management System
            </p>
            <p style="margin: 8px 0 0 0; color: #999999; font-size: 11px;">
              This is an automated notification. Please do not reply to this email.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
  
  return htmlBody;
}

/**
 * Create context information block for emails
 * @param {Object} context - Request context data
 * @returns {string} HTML for context block
 */
function createContextBlock(context) {
  if (!context) return '';

  var workflowType = context.workflowType || '';

  // System access summary
  var systemAccessText = 'None';
  if (context.systems) {
    systemAccessText = Array.isArray(context.systems)
      ? (context.systems.length > 0 ? context.systems.join(', ') : 'None')
      : (String(context.systems) || 'None');
  }

  // Dynamic date label based on workflow type
  var dateLabel = 'Date';
  if (workflowType === 'New Hire')           dateLabel = 'Start Date';
  else if (workflowType === 'Termination')   dateLabel = 'Termination Date';
  else if (workflowType === 'Status Change') dateLabel = 'Effective Date';

  // Employment type with fallback for termination (termData uses empType field)
  var employmentType = context.employmentType || context.empType || '';

  // Format hireDate for display
  var hireDateDisplay = '';
  if (context.hireDate) {
    try {
      var hd = context.hireDate instanceof Date ? context.hireDate : new Date(String(context.hireDate));
      hireDateDisplay = !isNaN(hd.getTime())
        ? Utilities.formatDate(hd, Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : String(context.hireDate).substring(0, 10);
    } catch (e) { hireDateDisplay = String(context.hireDate).substring(0, 10); }
  }

  // Termination-specific rows (highlighted in red)
  var termRows = '';
  if (workflowType === 'Termination') {
    termRows =
      (context.lastDayWorked ? '<tr><td style="padding:4px 0;font-weight:600;width:160px;color:#c00;">Last Day Worked:</td><td style="padding:4px 0;">' + context.lastDayWorked + '</td></tr>' : '') +
      (context.hasReports ? '<tr><td style="padding:4px 0;font-weight:600;color:#c00;">Has Direct Reports:</td><td style="padding:4px 0;">' + context.hasReports + '</td></tr>' : '') +
      (context.reportsToNew && context.reportsToNew !== 'N/A' ? '<tr><td style="padding:4px 0;font-weight:600;color:#c00;">Reports Reassigned To:</td><td style="padding:4px 0;">' + context.reportsToNew + '</td></tr>' : '');
  }

  // Status Change-specific rows
  var changeRows = '';
  if (workflowType === 'Status Change') {
    // Normalize change field display: identical sides or N/A -> N/A shows "Unchanged"
    var nc = function(val) {
      if (val === undefined || val === null) return null;
      var v = String(val).trim();
      if (!v || v === 'N/A -> N/A' || v === 'N/A (N/A) -> N/A (N/A)') return 'Unchanged';
      var idx = v.indexOf(' -> ');
      if (idx !== -1 && v.substring(0, idx).trim() === v.substring(idx + 4).trim()) return 'Unchanged';
      return v;
    };
    var stVal = nc(context.siteTransfer);
    var tcVal = nc(context.titleChange);
    var ccVal = nc(context.classChange);
    changeRows =
      (context.changeTypes ? '<tr><td style="padding:4px 0;font-weight:600;width:160px;">Changes:</td><td style="padding:4px 0;">' + context.changeTypes + '</td></tr>' : '') +
      (stVal !== null ? '<tr><td style="padding:4px 0;font-weight:600;">Site Transfer:</td><td style="padding:4px 0;">' + stVal + '</td></tr>' : '') +
      (tcVal !== null ? '<tr><td style="padding:4px 0;font-weight:600;">Title Change:</td><td style="padding:4px 0;">' + tcVal + '</td></tr>' : '') +
      (ccVal !== null ? '<tr><td style="padding:4px 0;font-weight:600;">Classification:</td><td style="padding:4px 0;">' + ccVal + '</td></tr>' : '') +
      (context.managerChange ? '<tr><td style="padding:4px 0;font-weight:600;">Manager Change:</td><td style="padding:4px 0;">' + context.managerChange + '</td></tr>' : '');
  }

  // Checklist items section
  var checklistRows = '';
  if (context.checklistItems) {
    try {
      var items = Array.isArray(context.checklistItems) ? context.checklistItems : JSON.parse(String(context.checklistItems));
      if (items && items.length > 0) {
        var itemsHtml = items.map(function(item) { return '<li style="padding:2px 0;">' + item + '</li>'; }).join('');
        checklistRows = '<tr><td colspan="2" style="padding:12px 0 4px 0;">' +
          '<div style="font-weight:600;color:#EB1C2D;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Action Items</div>' +
          '<ul style="margin:0;padding-left:20px;color:#333;">' + itemsHtml + '</ul></td></tr>';
      }
    } catch (e) { /* ignore parse errors */ }
  }

  // Credentials section (shown when any credential field or a credentialNote is present)
  var credRows = '';
  if (context.dssUsername || context.siteDocsUsername || context.assignedEmail || context.internalEmployeeId || context.credentialNote) {
    credRows = '<tr><td colspan="2" style="padding:12px 0 4px 0;">' +
      '<div style="font-weight:600;color:#EB1C2D;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Credentials</div>' +
      '<table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#333;">' +
      (context.internalEmployeeId ? '<tr><td style="padding:3px 0;font-weight:600;width:160px;">Employee ID:</td><td style="padding:3px 0;">' + context.internalEmployeeId + '</td></tr>' : '') +
      (context.adpAssociateId ? '<tr><td style="padding:3px 0;font-weight:600;">ADP Associate ID:</td><td style="padding:3px 0;">' + context.adpAssociateId + '</td></tr>' : '') +
      (context.assignedEmail ? '<tr><td style="padding:3px 0;font-weight:600;">Assigned Email:</td><td style="padding:3px 0;">' + context.assignedEmail + '</td></tr>' : '') +
      (context.dssUsername ? '<tr><td style="padding:3px 0;font-weight:600;">DSS:</td><td style="padding:3px 0;">' + context.dssUsername + ' / Pwd: ' + (context.dssPassword || 'N/A') + '</td></tr>' : '') +
      (context.siteDocsUsername ? '<tr><td style="padding:3px 0;font-weight:600;">SiteDocs:</td><td style="padding:3px 0;">' + context.siteDocsUsername + ' / Pwd: ' + (context.siteDocsPassword || 'N/A') + '</td></tr>' : '') +
      (context.siteDocsWorkerId ? '<tr><td style="padding:3px 0;font-weight:600;">SiteDocs Worker ID:</td><td style="padding:3px 0;">' + context.siteDocsWorkerId + '</td></tr>' : '') +
      (context.credentialNote ? '<tr><td colspan="2" style="padding:4px 0;color:#666;font-style:italic;">' + context.credentialNote + '</td></tr>' : '') +
      '</table></td></tr>';
  }

  return `
    <tr>
      <td style="padding: 20px 30px; background-color: #f8f9fa; border-bottom: 1px solid #e0e0e0;">
        <h3 style="margin: 0 0 15px 0; color: #EB1C2D; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Request Details</h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #333;">
          ${context.employeeName ? `<tr><td style="padding:6px 0;font-weight:600;width:160px;">Employee:</td><td style="padding:6px 0;">${context.employeeName}</td></tr>` : ''}
          ${context.jobTitle ? `<tr><td style="padding:6px 0;font-weight:600;">Job Title:</td><td style="padding:6px 0;">${context.jobTitle}</td></tr>` : ''}
          ${context.jrTitle ? `<tr><td style="padding:6px 0;font-weight:600;">JR Title:</td><td style="padding:6px 0;">${context.jrTitle}</td></tr>` : ''}
          ${context.department ? `<tr><td style="padding:6px 0;font-weight:600;">Department:</td><td style="padding:6px 0;">${context.department}</td></tr>` : ''}
          ${context.siteName ? `<tr><td style="padding:6px 0;font-weight:600;">Site:</td><td style="padding:6px 0;">${context.siteName}</td></tr>` : ''}
          ${hireDateDisplay ? `<tr><td style="padding:6px 0;font-weight:600;">${dateLabel}:</td><td style="padding:6px 0;">${hireDateDisplay}</td></tr>` : ''}
          ${employmentType ? `<tr><td style="padding:6px 0;font-weight:600;">Employment Type:</td><td style="padding:6px 0;">${employmentType}</td></tr>` : ''}
          ${context.employeeType ? `<tr><td style="padding:6px 0;font-weight:600;">Employee Type:</td><td style="padding:6px 0;">${context.employeeType}</td></tr>` : ''}
          ${context.newHireOrRehire ? `<tr><td style="padding:6px 0;font-weight:600;">Status:</td><td style="padding:6px 0;">${context.newHireOrRehire}</td></tr>` : ''}
          ${context.reason ? `<tr><td style="padding:6px 0;font-weight:600;">Reason:</td><td style="padding:6px 0;">${context.reason}</td></tr>` : ''}
          ${context.managerName ? `<tr><td style="padding:6px 0;font-weight:600;">Manager:</td><td style="padding:6px 0;">${context.managerName}${context.managerEmail ? ' (' + context.managerEmail + ')' : ''}</td></tr>` : ''}
          ${context.systemAccess !== 'No' && context.systems ? `<tr><td style="padding:6px 0;font-weight:600;">System Access:</td><td style="padding:6px 0;">${systemAccessText}</td></tr>` : ''}
          ${context.equipmentRaw ? `<tr><td style="padding:6px 0;font-weight:600;">Equipment:</td><td style="padding:6px 0;">${context.equipmentRaw}${context.computerType ? '<br><span style="font-size:12px;color:#666">Computer: ' + context.computerType + (context.computerRequestType ? ' (' + context.computerRequestType + ')' : '') + '</span>' : ''}${context.phoneRequestType ? '<br><span style="font-size:12px;color:#666">Phone: ' + context.phoneRequestType + ' Request</span>' : ''}</td></tr>` : ''}
          ${context.jobSiteNumber ? `<tr><td style="padding:6px 0;font-weight:600;">Job Site #:</td><td style="padding:6px 0;">${context.jobSiteNumber}</td></tr>` : ''}
          ${context.requesterEmail ? `<tr><td style="padding:6px 0;font-weight:600;">Requested By:</td><td style="padding:6px 0;">${context.requesterEmail}</td></tr>` : ''}
          ${context.requestDate ? `<tr><td style="padding:6px 0;font-weight:600;">Request Date:</td><td style="padding:6px 0;">${context.requestDate}</td></tr>` : ''}
          ${termRows}
          ${changeRows}
          ${checklistRows}
          ${credRows}
        </table>
      </td>
    </tr>
  `;
}

/**
 * Send multiple emails (batch)
 * @param {Array<Object>} emailList - Array of email option objects
 * @returns {Object} Results summary
 */
function sendBatchEmails(emailList) {
  let sent = 0;
  let failed = 0;
  
  emailList.forEach(emailOptions => {
    const result = sendFormEmail(emailOptions);
    if (result) {
      sent++;
    } else {
      failed++;
    }
  });
  
  Logger.log(`Batch email results: ${sent} sent, ${failed} failed`);
  return { sent, failed };
}

/**
 * Send initial request emails (SITEDOCS team + requester confirmation)
 * Called directly from form submission after row is added
 * @param {Object} config - Email configuration
 * @param {string} config.requestId - Request ID
 * @param {string} config.employeeName - Employee full name
 * @param {string} config.hireDate - Hire date
 * @param {string} config.requesterEmail - Requester email
 * @param {string} config.employeeIdSetupUrl - URL to employee ID setup form
 * @param {string} config.siteDocsEmail - SITEDOCS team email address
 */
function sendInitialRequestEmails(config) {
  const { requestId, employeeName, hireDate, requesterEmail, employeeIdSetupUrl, siteDocsEmail,
          jobTitle, siteName, managerName, managerEmail, requestDate, employmentType, employeeType,
          newHireOrRehire, systemAccess, systems, equipment, department } = config;
  
  Logger.log('Sending initial request emails for: ' + requestId);
  
  // Build comprehensive context data for emails
  const contextData = {
    workflowType: 'New Hire',
    employeeName: employeeName,
    jobTitle: jobTitle,
    siteName: siteName,
    hireDate: hireDate,
    managerName: managerName,
    managerEmail: managerEmail,
    requesterEmail: requesterEmail,
    requestDate: requestDate || new Date().toLocaleDateString(),
    employmentType: employmentType,
    employeeType: employeeType,
    newHireOrRehire: newHireOrRehire,
    systemAccess: systemAccess,
    systems: Array.isArray(systems) ? systems : (systems ? systems.split(',').map(s => s.trim()) : []),
    equipmentRaw: Array.isArray(equipment) ? equipment.join(', ') : equipment,
    department: department || ''
  };
  
  try {
    // 1. Email to SITEDOCS team for Employee ID Setup
    sendFormEmail({
      to: siteDocsEmail,
      subject: 'ID Setup Required',
      body: 'A new employee onboarding request requires your attention.\n\nPlease complete the Employee ID Setup form using the button below. IT and other teams will be notified automatically after you complete the setup.',
      formUrl: employeeIdSetupUrl,
      displayName: 'TEAM Group - Employee Onboarding',
      contextData: contextData
    });
    
    Logger.log('✓ Email sent to SITEDOCS: ' + siteDocsEmail);
    
    // 2. Confirmation to requester
    sendFormEmail({
      to: requesterEmail,
      subject: 'Request Submitted',
      body: 'Your employee onboarding request has been received and is being processed.\n\nYou will receive updates as the request progresses through each stage.',
      displayName: 'TEAM Group - Employee Onboarding',
      contextData: contextData
    });
    
    Logger.log('✓ Confirmation email sent to requester: ' + requesterEmail);
    
    return { success: true };
    
  } catch (error) {
    Logger.log('❌ Error sending initial request emails: ' + error.toString());
    return { success: false, error: error.message };
  }
}
