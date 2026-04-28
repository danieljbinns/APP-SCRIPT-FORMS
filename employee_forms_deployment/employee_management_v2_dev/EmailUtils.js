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
    if (manager) parts.push('Manager: ' + manager);
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

    // Support for Position Change / Status Change Workflows
    if (workflowId && workflowId.startsWith('CHANGE_')) {
      const changeData = typeof getPositionChangeData === 'function' ? getPositionChangeData(workflowId) : null;
      if (changeData) {
        // Parse manager emails from stored managerChange string "Name (email) -> Name (email)"
        const mcStr = String(changeData.managerChange || '');
        const mcMatches = mcStr.match(/\(([^)@\s]+@[^)\s]+)\)/g) || [];
        const mgrOldEmail = changeData.currentManagerEmail || (mcMatches.length > 0 ? mcMatches[0].replace(/[()]/g, '') : '');
        const mgrNewEmail = changeData.mgrNewEmail || (mcMatches.length > 1 ? mcMatches[1].replace(/[()]/g, '') : mgrOldEmail);
        return {
          workflowType: 'Status Change',
          employeeName: changeData.employeeName || '',
          jobTitle: changeData.jobTitle || changeData.currentTitle || '',
          siteName: changeData.siteName || '',
          hireDate: changeData.effDate || '',
          requesterEmail: changeData.requesterEmail || '',
          managerName: changeData.currentManagerName || '',
          managerEmail: mgrNewEmail || mgrOldEmail || '',
          managerOldEmail: mgrOldEmail || '',
          managerNewEmail: mgrNewEmail || '',
          department: changeData.department || '',
          changeTypes: changeData.changes || '',
          siteTransfer: changeData.siteTransfer || '',
          titleChange: changeData.titleChange || '',
          classChange: changeData.classChange || '',
          managerChange: mcStr,
          systems: changeData.systems ? changeData.systems.split(', ').map(function(s) { return s.trim(); }).filter(Boolean) : [],
          equipmentRaw: changeData.equipment || '',
          purchasingSites: changeData.purchasingSites || '',
          employmentType: changeData.currentClass || '',
          currentTitle: changeData.currentTitle || '',
          currentManagerName: changeData.currentManagerName || '',
          currentManagerEmail: changeData.currentManagerEmail || '',
          creditCardUSA:            changeData.creditCardUSA || '',
          creditCardLimitUSA:       changeData.creditCardLimitUSA || '',
          creditCardCanada:         changeData.creditCardCanada || '',
          creditCardLimitCanada:    changeData.creditCardLimitCanada || '',
          creditCardHomeDepot:      changeData.creditCardHomeDepot || '',
          creditCardLimitHomeDepot: changeData.creditCardLimitHomeDepot || ''
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
    
    const firstName = row[headers.indexOf('First Name')] || '';
    const lastName  = row[headers.indexOf('Last Name')]  || '';

    // Default Context from Initial Request
    const context = {
      workflowId:    workflowId,
      workflowType:  (workflowId && workflowId.indexOf('CHANGE_') === 0) ? 'Status Change' : 'New Hire',
      firstName:     firstName,
      lastName:      lastName,
      middleName:    row[headers.indexOf('Middle Name')]    || '',
      preferredName: row[headers.indexOf('Preferred Name')] || '',
      employeeName:  firstName + ' ' + lastName,
      jobTitle:      row[headers.indexOf('Position Title')],
      jrTitle:       row[headers.indexOf('JR Assign')] || '',
      siteName:      row[headers.indexOf('Site Name')],
      hireDate:      (function(d){ return d instanceof Date ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') : (d ? String(d).substring(0, 10) : ''); })(row[headers.indexOf('Hire Date')]),
      managerName:   row[headers.indexOf('Manager Name')],
      managerEmail:  row[headers.indexOf('Manager Email')],
      requesterEmail: row[5], // Hardcoded to Col F (Index 5) for reliability
      requestDate:   Utilities.formatDate(new Date(row[headers.indexOf('Timestamp')]), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      employmentType: row[headers.indexOf('Employment Type')],
      department:    row[headers.indexOf('Department')] || '',
      employeeType:  row[headers.indexOf('Employee Type')],
      newHireOrRehire: row[headers.indexOf('New Hire/Rehire')],
      jobSiteNumber: row[headers.indexOf('Job Site #')],
      systemAccess:  row[headers.indexOf('System Access')],
      systems:       systemsList,
      workType:      row[headers.indexOf('Work Type')] || '',
      equipmentRaw:  row[headers.indexOf('Equipment')] || '',
      computerType:        row[headers.indexOf('Computer Type')]              || row[25],
      computerRequestType: row[headers.indexOf('Computer Request Type')]     || row[24],
      phoneRequestType:    row[headers.indexOf('Mobile Phone Request Type')] || row[36],
      googleEmail:   row[headers.indexOf('Google Email')]  || '',
      googleDomain:  row[headers.indexOf('Google Domain')] || '',
      adpSites:      row[headers.indexOf('ADP Sites')]     || '',
      purchasingSites: row[headers.indexOf('Purchasing Sites')] || ''
    };
    
    // PHASE 4 FIX: Check HR Verification Results for verified titles and ADP ID
    // This ensures downstream forms/emails use the HR-approved data
    const hrSheet = ss.getSheetByName(CONFIG.SHEETS.HR_VERIFICATION_RESULTS);
    if (hrSheet) {
        const hrData = hrSheet.getDataRange().getValues();
        // Workflow ID is Col A (0), ADP ID is Col D (3), Verified Title is Col H (7)
        const hrRow = hrData.find(r => r[0] === workflowId);
        if (hrRow) {
             if (hrRow[3]) context.adpAssociateId = hrRow[3];
             if (hrRow[4]) context.verifiedName   = String(hrRow[4]);
             // hrRow[5] = Verified Manager Name, hrRow[6] = Verified Manager Email
             if (hrRow[5]) context.verifiedManagerName  = String(hrRow[5]);
             if (hrRow[6]) context.verifiedManagerEmail = String(hrRow[6]);
             const verifiedTitles = hrRow[7];
             if (verifiedTitles && String(verifiedTitles).includes(' / ')) {
                 const parts = String(verifiedTitles).split(' / ');
                 context.jobTitle = parts[0].trim();
                 context.jrTitle  = parts.slice(1).join(' / ').trim();
             }
             if (hrRow[2]) context.hrTimestamp   = hrRow[2] instanceof Date ? Utilities.formatDate(hrRow[2], Session.getScriptTimeZone(), 'MMM d, yyyy · h:mm a') : String(hrRow[2]);
             if (hrRow[9]) context.hrSubmittedBy = String(hrRow[9]); // Col J — was incorrectly hrRow[12]
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
            context.siteDocsWorkerId   = idRow[4];
            context.siteDocsJobCode    = idRow[5];
            context.siteDocsUsername   = idRow[6];
            context.siteDocsPassword   = idRow[7];
            context.dssUsername        = idRow[8];
            context.dssPassword        = idRow[9];
            context.bossWisCreated     = idRow[11] || '';
            if (idRow[2])  context.idTimestamp   = idRow[2] instanceof Date ? Utilities.formatDate(idRow[2], Session.getScriptTimeZone(), 'MMM d, yyyy · h:mm a') : String(idRow[2]);
            if (idRow[12]) context.idSubmittedBy  = idRow[12];
        }
    }

    // Fetch all IT Results fields
    // Columns: 0=WF ID, 1=Form ID, 2=Timestamp, 3=Email Created, 4=Assigned Email,
    //          5=Email Temp Pwd, 6=Computer Assigned, 7=Computer Serial, 8=Computer Model,
    //          9=Computer Type, 10=Phone Assigned, 11=Phone Carrier, 12=Phone Model,
    //          13=Phone Number, 14=Phone VM Password, 15=BOSS Access, 16=Incidents,
    //          17=CAA, 18=Delivery App, 19=Net Promoter, 20=IT Notes, 21=Submitted By
    const itSheet = ss.getSheetByName(CONFIG.SHEETS.IT_RESULTS);
    if (itSheet) {
        const itData = itSheet.getDataRange().getValues();
        const itRow = itData.find(r => r[0] === workflowId);
        if (itRow) {
            context.assignedEmail      = itRow[4]  || '';
            context.emailTempPassword  = (itRow[5]  && itRow[5]  !== 'N/A') ? String(itRow[5])  : '';
            context.computerAssigned   = itRow[6]  || '';
            context.computerSerial     = (itRow[7]  && itRow[7]  !== 'N/A') ? String(itRow[7])  : '';
            context.computerModel      = (itRow[8]  && itRow[8]  !== 'N/A') ? String(itRow[8])  : '';
            if (itRow[9]  && itRow[9]  !== 'N/A') context.computerType = String(itRow[9]);  // overrides request-time value
            context.phoneAssigned      = itRow[10] || '';
            context.phoneCarrier       = (itRow[11] && itRow[11] !== 'N/A') ? String(itRow[11]) : '';
            context.phoneModel         = (itRow[12] && itRow[12] !== 'N/A') ? String(itRow[12]) : '';
            context.phoneNumber        = (itRow[13] && itRow[13] !== 'N/A') ? String(itRow[13]) : '';
            context.phoneVMPassword    = (itRow[14] && itRow[14] !== 'N/A') ? String(itRow[14]) : '';
            context.bossAccess         = itRow[15] || '';
            context.incidentsAccess    = itRow[16] || '';
            context.caaAccess          = itRow[17] || '';
            context.deliveryAppAccess  = itRow[18] || '';
            context.netPromoterAccess  = itRow[19] || '';
            context.itNotes            = itRow[20]  || '';
            if (itRow[2])  context.itTimestamp   = itRow[2] instanceof Date ? Utilities.formatDate(itRow[2], Session.getScriptTimeZone(), 'MMM d, yyyy · h:mm a') : String(itRow[2]);
            if (itRow[21]) context.itSubmittedBy = String(itRow[21]); // Col V — was incorrectly itRow[12]
        }
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
  const { to, subject, body, formUrl, displayName, contextData, subjectOpts, emailOpts } = options;

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

    // V2 template for New Hire; all other workflows use legacy template until their builders are complete
    const htmlBody = (contextData && contextData.workflowType === 'New Hire')
      ? createEmailTemplateV2(finalSubject, finalBody, formUrl, contextData, emailOpts || {})
      : createEmailTemplate(finalSubject, finalBody, formUrl, contextData);
    
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
      var hd = context.hireDate instanceof Date ? context.hireDate : new Date(String(context.hireDate).replace(/^(\d{4}-\d{2}-\d{2})$/, '$1T12:00:00'));
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
      (context.siteDocsWorkerId  ? '<tr><td style="padding:3px 0;font-weight:600;">SiteDocs Worker ID:</td><td style="padding:3px 0;">' + context.siteDocsWorkerId  + '</td></tr>' : '') +
      (context.siteDocsJobCode   ? '<tr><td style="padding:3px 0;font-weight:600;">SiteDocs Job Code:</td><td style="padding:3px 0;">'  + context.siteDocsJobCode   + '</td></tr>' : '') +
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
  // Split employeeName into first/last for V2 template — fallback splits on first space
  const _nameParts = (employeeName || '').trim().split(/\s+/);
  const contextData = {
    workflowType: 'New Hire',
    employeeName: employeeName,
    firstName:    _nameParts[0] || '',
    lastName:     _nameParts.slice(1).join(' ') || '',
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


// ================================================================
// ▼▼▼  V2 EMAIL TEMPLATE SYSTEM  ▼▼▼
// All originals above are preserved unchanged.
// Wire into sendFormEmail via opts.useNewTemplate when ready.
// ================================================================

// ================================================================
// EMAIL STYLE TOKENS
// Inline-only — Gmail strips <style> blocks. Edit here and the
// change propagates to every email through the helper functions.
// ================================================================
var ES = {

  // ── Layout ──────────────────────────────────────────────────
  cardMaxWidth:  '100%',
  bodyBg:        '#f0f0f0',
  cardBg:        '#ffffff',
  cardRadius:    '8px',
  sectionRadius: '6px',
  sectionGap:    '8px',
  padCard:       '20px 24px',
  padSection:    '9px 14px',
  padBody:       '10px 14px 12px',

  // ── Typography ───────────────────────────────────────────────
  fontStack:    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
  monoStack:    "'SF Mono','Fira Code',monospace",
  baseFontSize: '14px',
  labelSize:    '11px',
  labelColor:   '#888888',
  labelUpper:   'uppercase',
  valueColor:   '#111111',
  valueMuted:   '#999999',   // pending — step not yet started
  valueQueued:  '#cccccc',   // queued  — step not yet reachable
  monoColor:    '#059669',   // credentials / IDs — matches form --accent-green family
  subColor:     '#888888',   // actor / secondary text
  subSize:      '10px',

  // ── Brand ────────────────────────────────────────────────────
  // Matches form Styles.html: --brand-red #EB1C2D, dark card #1a1a1a
  red:          '#EB1C2D',
  redDark:      '#c41828',
  redShadow:    'rgba(235,28,45,0.3)',
  headerBg:     'linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 100%)',
  headerBorder: '#EB1C2D',

  // ── Status: Complete ─────────────────────────────────────────
  // Dark green header — mirrors form's done-step indicator
  // Badge text uses form's --accent-green-lt (#6ee7b7)
  cText:   '#6ee7b7',        // form --accent-green-lt
  cBg:     '#0a2218',        // deep dark green — matches form card aesthetic
  cBorder: '#064e3b',
  cBadge:  '#052e16',

  // ── Status: Active (needs action now) ────────────────────────
  // Dark amber header — mirrors form's pending-step indicator
  // Badge text uses form's --accent-amber (#fcd34d)
  aText:   '#fcd34d',        // form --accent-amber
  aBg:     '#1c1200',        // deep dark amber
  aBorder: '#78350f',
  aBadge:  '#3d1a00',

  // ── Status: Queued (not yet reachable) ───────────────────────
  // Dark grey — matches form's --card-bg / --border-color palette
  qText:   '#666666',
  qBg:     '#1a1a1a',        // form --card-bg
  qBorder: '#333333',        // form --border-color
  qBadge:  '#222222',

  // ── Status: N/A (not applicable for this employee) ───────────
  naText:   '#444444',
  naBg:     '#141414',
  naBorder: '#2a2a2a',       // form --border-subtle
  naBadge:  '#1a1a1a',

  // ── Buttons ──────────────────────────────────────────────────
  btnRed:       '#EB1C2D',
  btnRedDark:   '#c41828',
  btnRedShadow: 'rgba(235,28,45,0.3)',
  btnCal:       '#4285f4',
  btnCalDark:   '#2b6fd9',
  btnCalShadow: 'rgba(66,133,244,0.3)',

  // ── Misc ─────────────────────────────────────────────────────
  divider:    '#f0f0f0',
  footerBg:   '#f9fafb',
  footerText: '#999999',
  footerSub:  '#bbbbbb'
};


// ================================================================
// SHARED HTML HELPER FUNCTIONS
// Used by all workflow builders in EmailTemplates.js.
// ================================================================

/**
 * Status badge span.
 * @param {'complete'|'active'|'queued'|'na'} status
 * @param {string} text
 */
function esBadge(status, text) {
  var color, bg, border;
  switch (status) {
    case 'complete': color = ES.cText;  bg = ES.cBadge;  border = ES.cBorder;  break;
    case 'active':   color = ES.aText;  bg = ES.aBadge;  border = ES.aBorder;  break;
    case 'queued':   color = ES.qText;  bg = ES.qBadge;  border = ES.qBorder;  break;
    default:         color = ES.naText; bg = ES.naBadge; border = ES.naBorder; break;
  }
  return '<span style="display:inline-block;font-size:10px;font-weight:700;padding:3px 9px;border-radius:3px;'
       + 'text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;'
       + 'color:' + color + ';background:' + bg + ';border:1px solid ' + border + ';">'
       + text + '</span>';
}

/**
 * Styled value span. Caller wraps raw value with appropriate style.
 * @param {string} value
 * @param {'normal'|'pending'|'queued'|'masked'|'mono'} [style]
 */
function esVal(value, style) {
  var s;
  switch (style) {
    case 'pending': s = 'color:' + ES.valueMuted  + ';font-style:italic;font-weight:400;'; break;
    case 'queued':  s = 'color:' + ES.valueQueued + ';font-style:italic;font-weight:400;'; break;
    case 'masked':  s = 'color:#888;letter-spacing:3px;font-size:11px;font-weight:400;';   break;
    case 'mono':    s = 'color:' + ES.monoColor + ';font-family:' + ES.monoStack + ';font-size:12px;font-weight:500;'; break;
    default:        s = 'color:' + ES.valueColor + ';font-weight:600;'; break;
  }
  return '<span style="' + s + '">' + (value || '') + '</span>';
}

/**
 * Single label + value table row.
 * @param {string} label
 * @param {string} value  — pre-formatted HTML; use esVal() for styled values
 */
function esRow(label, value) {
  return '<tr>'
    + '<td style="padding:3px 0;color:' + ES.labelColor + ';font-size:' + ES.labelSize
    + ';text-transform:' + ES.labelUpper + ';letter-spacing:0.3px;width:150px;'
    + 'vertical-align:top;padding-right:12px;">' + label + '</td>'
    + '<td style="padding:3px 0;font-size:13px;line-height:1.5;">' + value + '</td>'
    + '</tr>';
}

/**
 * Thin horizontal rule between row groups within a section body.
 */
function esDivider() {
  return '<tr><td colspan="2" style="padding:5px 0;">'
    + '<hr style="border:none;border-top:1px solid ' + ES.divider + ';margin:0;"></td></tr>';
}

/**
 * Full section block: coloured header (title + actor sub-label + status badge) + body rows.
 * @param {string} title
 * @param {'complete'|'active'|'queued'|'na'} status
 * @param {string} badgeText
 * @param {string} [actorText]  — shown below title (e.g. "Completed by user · timestamp")
 * @param {string} [bodyHtml]   — table rows built with esRow() / esDivider()
 */
function esSection(title, status, badgeText, actorText, bodyHtml) {
  var border, headBg, headBorder, titleColor;
  switch (status) {
    case 'complete': border = ES.cBorder;  headBg = ES.cBg;  headBorder = ES.cBorder;  titleColor = ES.cText;  break;
    case 'active':   border = ES.aBorder;  headBg = ES.aBg;  headBorder = ES.aBorder;  titleColor = ES.aText;  break;
    case 'queued':   border = ES.qBorder;  headBg = ES.qBg;  headBorder = ES.qBorder;  titleColor = ES.qText;  break;
    default:         border = ES.naBorder; headBg = ES.naBg; headBorder = ES.naBorder; titleColor = ES.naText; break;
  }
  return '<div style="border:1px solid ' + border + ';border-radius:' + ES.sectionRadius
    + ';margin-bottom:' + ES.sectionGap + ';overflow:hidden;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background:' + headBg
    + ';border-bottom:1px solid ' + headBorder + ';">'
    + '<tr>'
    + '<td style="padding:' + ES.padSection + ';vertical-align:top;">'
    + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:' + titleColor + ';">' + title + '</div>'
    + (actorText ? '<div style="font-size:' + ES.subSize + ';color:' + ES.subColor + ';margin-top:3px;">' + actorText + '</div>' : '')
    + '</td>'
    + '<td style="padding:' + ES.padSection + ';text-align:right;vertical-align:top;white-space:nowrap;">'
    + esBadge(status, badgeText)
    + '</td></tr></table>'
    + (bodyHtml
       ? '<div style="padding:' + ES.padBody + ';background:#ffffff;">'
         + '<table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">'
         + bodyHtml + '</table></div>'
       : '')
    + '</div>';
}

/**
 * Primary red action button.
 * @param {string} url
 * @param {string} text
 */
function esBtn(url, text) {
  return '<a href="' + url + '" style="display:inline-block;padding:11px 26px;'
    + 'background:linear-gradient(135deg,' + ES.btnRed + ',' + ES.btnRedDark + ');'
    + 'color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;'
    + 'font-family:' + ES.fontStack + ';box-shadow:0 3px 10px ' + ES.btnRedShadow + ';">'
    + text + '</a>';
}

/**
 * Blue Google Calendar button.
 * @param {string} dateStr   — 'YYYY-MM-DD'
 * @param {string} empName
 * @param {string} siteName
 * @param {string} [adpId]
 */
function esCalBtn(dateStr, empName, siteName, adpId) {
  try {
    var d       = String(dateStr).replace(/-/g, '').substring(0, 8);
    var title   = encodeURIComponent((empName || 'Employee') + ' — Start Date');
    var details = encodeURIComponent('Site: ' + (siteName || '') + (adpId ? ' | ADP ID: ' + adpId : ''));
    var url     = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + title
                + '&dates=' + d + '/' + d + '&details=' + details;
    return '<a href="' + url + '" style="display:inline-block;padding:11px 20px;'
      + 'background:linear-gradient(135deg,' + ES.btnCal + ',' + ES.btnCalDark + ');'
      + 'color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:13px;'
      + 'font-family:' + ES.fontStack + ';box-shadow:0 3px 10px ' + ES.btnCalShadow + ';">'
      + '📅 Add Start Date to Calendar</a>';
  } catch (e) { return ''; }
}

/**
 * Button row — primary action button + optional calendar button.
 * @param {string} [formUrl]
 * @param {Object} [opts]   — { calendarDate, employeeName, siteName, adpId }
 */
function esBtnRow(formUrl, opts) {
  opts = opts || {};
  if (!formUrl && !opts.calendarDate) return '';
  return '<div style="margin:18px 0;">'
    + (formUrl ? esBtn(formUrl, 'Open Form →') : '')
    + (formUrl && opts.calendarDate ? '&nbsp;&nbsp;' : '')
    + (opts.calendarDate ? esCalBtn(opts.calendarDate, opts.employeeName, opts.siteName, opts.adpId) : '')
    + '</div>';
}


// ================================================================
// CONTEXT BLOCK ROUTER — V2
// Thin router — delegates to per-workflow builders in EmailTemplates.js.
// ================================================================

/**
 * @param {Object} context  — from getWorkflowContext()
 * @param {Object} [opts]   — { showPasswords, calendarDate, employeeName, siteName, adpId }
 */
function createContextBlockV2(context, opts) {
  if (!context) return '';
  var type = context.workflowType || 'New Hire';
  if (type === 'New Hire')      return buildNewHireContextBlock(context, opts);
  if (type === 'Termination')   return buildTerminationContextBlock(context, opts);
  if (type === 'Status Change') return buildStatusChangeContextBlock(context, opts);
  return buildNewHireContextBlock(context, opts); // safe fallback
}


// ================================================================
// EMAIL TEMPLATE SHELL — V2
// Drop-in replacement for createEmailTemplate(). Not wired into
// sendFormEmail yet — call directly or pass opts.useNewTemplate.
// ================================================================

/**
 * @param {string} subject
 * @param {string} body          — intro paragraph above the top button
 * @param {string} [formUrl]
 * @param {Object} [contextData] — from getWorkflowContext()
 * @param {Object} [opts]        — { showPasswords, calendarDate, employeeName, siteName, adpId }
 */
function createEmailTemplateV2(subject, body, formUrl, contextData, opts) {
  opts = opts || {};

  // Fill calendar helpers from context when not explicitly set in opts
  if (contextData) {
    if (!opts.employeeName) opts.employeeName = contextData.employeeName  || '';
    if (!opts.siteName)     opts.siteName     = contextData.siteName      || '';
    if (!opts.adpId)        opts.adpId        = contextData.adpAssociateId || '';
    if (!opts.calendarDate && contextData.hireDate) opts.calendarDate = String(contextData.hireDate).substring(0, 10);
  }

  var sectionsHtml   = contextData ? createContextBlockV2(contextData, opts) : '';
  var btnHtml        = esBtnRow(formUrl, opts);          // form + calendar (top)
  var btnHtmlRepeat  = formUrl ? esBtnRow(formUrl, {}) : ''; // form only   (bottom — no calendar duplicate)
  var bodyText       = body.indexOf('<') !== -1 ? body : body.replace(/\n/g, '<br>');

  // Header tag line: workflow type + employment type
  var tag     = contextData && contextData.workflowType ? contextData.workflowType.toUpperCase() : 'NOTIFICATION';
  var empType = contextData && contextData.employmentType ? ' · ' + contextData.employmentType : '';

  return '<!DOCTYPE html><html><head>'
    + '<meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1.0">'
    + '</head>'
    + '<body style="margin:0;padding:20px;background:' + ES.bodyBg + ';font-family:' + ES.fontStack + ';">'
    + '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:' + ES.cardMaxWidth
    + ';background:' + ES.cardBg + ';border-radius:' + ES.cardRadius
    + ';overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.12);">'

    // Header — logo + tag chip + subject
    + '<tr><td style="background:' + ES.headerBg + ';padding:24px 30px 20px;text-align:center;border-bottom:3px solid ' + ES.headerBorder + ';">'
    + '<img src="https://team-signature-logos.s3.us-east-1.amazonaws.com/Team+Logo+Black+Background.png"'
    + ' alt="TEAM Group" style="display:block;margin:0 auto 14px;height:44px;max-width:200px;object-fit:contain;">'
    + '<div style="display:inline-block;background:rgba(235,28,45,0.25);color:#ff8a8a;font-size:10px;font-weight:700;'
    + 'padding:2px 8px;border-radius:3px;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:10px;">'
    + tag + empType + '</div>'
    + '<h1 style="margin:0;color:#ffffff;font-size:16px;font-weight:600;line-height:1.4;">' + subject + '</h1>'
    + '</td></tr>'

    // Intro + top button (form + calendar)
    + '<tr><td style="padding:22px 30px 16px;">'
    + '<div style="color:#444444;font-size:' + ES.baseFontSize + ';line-height:1.6;margin-bottom:16px;">' + bodyText + '</div>'
    + btnHtml
    + '</td></tr>'

    // Sections
    + (sectionsHtml ? '<tr><td style="padding:0 20px 8px;">' + sectionsHtml + '</td></tr>' : '')

    // Bottom button repeat — form only, no calendar (only when there is a form URL)
    + (btnHtmlRepeat ? '<tr><td style="padding:0 30px 24px;">'
      + '<hr style="border:none;border-top:1px solid ' + ES.divider + ';margin:0 0 16px;">'
      + btnHtmlRepeat + '</td></tr>' : '')

    // Footer
    + '<tr><td style="background:' + ES.footerBg + ';padding:16px;text-align:center;border-top:1px solid #eeeeee;">'
    + '<p style="margin:0;color:' + ES.footerText + ';font-size:11px;">TEAM Group — Employee Management System</p>'
    + '<p style="margin:4px 0 0;color:' + ES.footerSub + ';font-size:10px;">Automated notification · Do not reply to this email</p>'
    + '</td></tr>'

    + '</table></td></tr></table></body></html>';
}
