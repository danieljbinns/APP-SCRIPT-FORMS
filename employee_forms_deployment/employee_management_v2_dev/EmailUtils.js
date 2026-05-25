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

  // Tag: Status Change uses a compact tag (change types go in the body, not subject — subjects must stay under 250 chars)
  var tag;
  if (workflowType === 'Status Change') {
    tag = '[Status Change' +
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
    // Trim long site names to keep subject under 250 chars
    var siteTransfer = contextData.siteTransfer || '';
    var siteForSubject = (siteTransfer && siteTransfer.indexOf('N/A') === -1) ? siteTransfer : site;
    if (siteForSubject && siteForSubject.length > 60) siteForSubject = siteForSubject.substring(0, 57) + '…';
    if (siteForSubject) parts.push(siteForSubject);
    // Classification change (old -> new) — skip if unchanged or N/A
    var classChange = contextData.classChange || '';
    if (classChange && classChange.indexOf('N/A') === -1) {
      var idx = classChange.indexOf(' -> ');
      if (idx === -1 || classChange.substring(0, idx).trim() !== classChange.substring(idx + 4).trim()) {
        parts.push(classChange);
      }
    } else if (employmentType) {
      parts.push(employmentType);
    }
    // Date
    if (dateLabel && dateStr) parts.push(dateLabel + ': ' + dateStr);
    // Manager emails intentionally omitted from subject — body has full details
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

  // Hard safety cap — GAS MailApp throws "Argument too large: subject" above ~250 chars
  if (subject.length > 250) subject = subject.substring(0, 247) + '…';

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
        const g = termData.googleOffboarding || {};
        return {
          workflowType:    'Termination',
          employeeName:    termData.employeeName,
          employmentType:  termData.empType || '',
          siteName:        termData.siteName,
          managerName:     termData.managerName,
          managerEmail:    termData.managerEmail,
          requesterEmail:  termData.requesterEmail,
          hireDate:        termData.termDate,
          lastDayWorked:   termData.lastDayWorked  || '',
          equipmentRaw:    termData.eqToReturn,
          systems:         termData.systems ? termData.systems.split(',').map(function(s){ return s.trim(); }) : [],
          empPhone:        termData.empPhone,
          reason:          termData.reason,
          hasReports:      termData.hasReports  || '',
          reportsToNew:    termData.reportsToNew || '',
          googleOffboarding: g,
          googleForward:   g.forward  || '',
          googleFiles:     g.files    || '',
          googleDelegate:  g.delegate || '',
          googleDuration:  g.duration || '',
          googleVacation:  g.vacation || '',
          originalComments: termData.originalComments || ''
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

    // Equipment requests now stored in Initial_Requests — falls through to shared read below

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
      workflowType:  workflowId.startsWith('EQUIP_REQ_') ? 'Equipment Request'
                   : workflowId.startsWith('CHANGE_')   ? 'Status Change'
                   : 'New Hire',
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
      requesterEmail: row[headers.indexOf('Requester Email')] || row[SCHEMA.INITIAL_REQUESTS.REQUESTER_EMAIL] || '',
      requestDate:   Utilities.formatDate(new Date(row[headers.indexOf('Timestamp')]), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      employmentType: row[headers.indexOf('Employment Type')],
      department:    row[headers.indexOf('Department')] || '',
      employeeType:  row[headers.indexOf('Employee Type')],
      newHireOrRehire: row[headers.indexOf('New Hire/Rehire')] || row[SCHEMA.INITIAL_REQUESTS.NEW_HIRE_OR_REHIRE] || '',
      jobSiteNumber: row[headers.indexOf('Job Site #')],
      systemAccess:  row[headers.indexOf('System Access')],
      systems:       systemsList,
      workType:      row[headers.indexOf('Work Type')] || '',
      equipmentRaw:  row[headers.indexOf('Equipment')] || '',
      computerType:        row[headers.indexOf('Computer Type')]              || row[SCHEMA.INITIAL_REQUESTS.COMPUTER_TYPE],
      computerRequestType: row[headers.indexOf('Computer Request Type')]     || row[SCHEMA.INITIAL_REQUESTS.COMPUTER_REQ],
      phoneRequestType:    row[headers.indexOf('Mobile Phone Request Type')] || row[SCHEMA.INITIAL_REQUESTS.PHONE_REQ],
      googleEmail:   row[headers.indexOf('Google Email')]  || '',
      googleDomain:  row[headers.indexOf('Google Domain')] || '',
      adpSites:      String(row[headers.indexOf('ADP Sites')]        || ''),
      purchasingSites: String(row[headers.indexOf('Purchasing Sites')] || ''),
      // BOSS & Review Config fields
      bossJobSites:     row[headers.indexOf('BOSS Job Sites')]          || row[headers.indexOf('Boss Job Sites')] || '',
      bossCostSheet:    row[headers.indexOf('BOSS Cost Sheet Access')]  || row[headers.indexOf('Cost Sheet Access')] || '',
      bossCostSheetJobs: row[headers.indexOf('BOSS Cost Sheet Jobs')]   || row[headers.indexOf('Cost Sheet Jobs')] || '',
      bossTripReports:  row[headers.indexOf('BOSS Trip Reports')]       || row[headers.indexOf('Trip Reports')] || '',
      bossGrievances:   row[headers.indexOf('BOSS Grievances')]         || row[headers.indexOf('Grievances')] || '',
      vehicleRequested: row[headers.indexOf('Vehicle Requested')]       || row[headers.indexOf('Company Vehicle')] || '',
      fleetioAccess:    row[headers.indexOf('Fleetio Access')]          || ''
    };
    
    // PHASE 4 FIX: Check HR Verification Results for verified titles and ADP ID
    // This ensures downstream forms/emails use the HR-approved data
    const hrSheet = ss.getSheetByName(CONFIG.SHEETS.HR_VERIFICATION_RESULTS);
    if (hrSheet) {
        const hrData = hrSheet.getDataRange().getValues();
        // Workflow ID is Col A (0), ADP ID is Col D (3), Verified Title is Col H (7)
        const HR = SCHEMA.HR_VERIFICATION_RESULTS;
        const hrRow = hrData.find(r => r[0] === workflowId);
        if (hrRow) {
             if (hrRow[HR.ADP_ASSOCIATE_ID]) context.adpAssociateId = hrRow[HR.ADP_ASSOCIATE_ID];
             if (hrRow[HR.VERIFIED_NAME])    context.verifiedName   = String(hrRow[HR.VERIFIED_NAME]);
             if (hrRow[HR.VERIFIED_MANAGER])       context.verifiedManagerName  = String(hrRow[HR.VERIFIED_MANAGER]);
             if (hrRow[HR.VERIFIED_MANAGER_EMAIL]) context.verifiedManagerEmail = String(hrRow[HR.VERIFIED_MANAGER_EMAIL]);
             const verifiedTitles = hrRow[HR.VERIFIED_JR_TITLE];
             if (verifiedTitles && String(verifiedTitles).includes(' / ')) {
                 const parts = String(verifiedTitles).split(' / ');
                 context.jobTitle = parts[0].trim();
                 context.jrTitle  = parts.slice(1).join(' / ').trim();
             }
             if (hrRow[HR.SUBMISSION_TS]) context.hrTimestamp   = hrRow[HR.SUBMISSION_TS] instanceof Date ? Utilities.formatDate(hrRow[HR.SUBMISSION_TS], Session.getScriptTimeZone(), 'MMM d, yyyy · h:mm a') : String(hrRow[HR.SUBMISSION_TS]);
             if (hrRow[HR.SUBMITTED_BY])  context.hrSubmittedBy = String(hrRow[HR.SUBMITTED_BY]);
        }
    }

    // PHASE 5 FIX: Fetch ID Setup Credentials (DSS/SiteDocs) for emails
    const idSheet = ss.getSheetByName(CONFIG.SHEETS.ID_SETUP_RESULTS);
    if (idSheet) {
        const idData = idSheet.getDataRange().getValues();
        // Workflow ID is Col A, Headers: WFID, FormID, Time, EmpID, WorkerID, JobCode, SD User, SD Pass, DSS User, DSS Pass
        const ID = SCHEMA.ID_SETUP_RESULTS;
        const idRow = idData.find(r => r[0] === workflowId);
        if (idRow) {
            context.internalEmployeeId    = idRow[ID.INTERNAL_EMP_ID];
            context.siteDocsWorkerId      = idRow[ID.SITEDOCS_WORKER_ID];
            context.siteDocsJobCode       = idRow[ID.SITEDOCS_JOB_CODE];
            context.siteDocsUsername      = idRow[ID.SITEDOCS_USERNAME];
            context.siteDocsPassword      = idRow[ID.SITEDOCS_PASSWORD];
            context.dssUsername           = idRow[ID.DSS_USERNAME];
            context.dssPassword           = idRow[ID.DSS_PASSWORD];
            context.bossWisCreated        = idRow[ID.BOSS_WIS_CREATED]  || '';
            context.idSubmittedBy         = idRow[ID.SUBMITTED_BY]     || '';
            if (idRow[ID.SUBMISSION_TS]) context.idTimestamp = idRow[ID.SUBMISSION_TS] instanceof Date ? Utilities.formatDate(idRow[ID.SUBMISSION_TS], Session.getScriptTimeZone(), 'MMM d, yyyy · h:mm a') : String(idRow[ID.SUBMISSION_TS]);
        }
    }

    // Fetch all IT Results fields
    const IT = SCHEMA.IT_RESULTS;
    const itSheet = ss.getSheetByName(CONFIG.SHEETS.IT_RESULTS);
    if (itSheet) {
        const itData = itSheet.getDataRange().getValues();
        const itRow = itData.find(r => r[0] === workflowId);
        if (itRow) {
            context.assignedEmail      = itRow[IT.ASSIGNED_EMAIL]      || '';
            context.emailTempPassword  = (itRow[IT.EMAIL_PASSWORD]     && itRow[IT.EMAIL_PASSWORD]     !== 'N/A') ? String(itRow[IT.EMAIL_PASSWORD])     : '';
            context.computerAssigned   = itRow[IT.COMPUTER_ASSIGNED]   || '';
            context.computerSerial     = (itRow[IT.COMPUTER_SERIAL]    && itRow[IT.COMPUTER_SERIAL]    !== 'N/A') ? String(itRow[IT.COMPUTER_SERIAL])    : '';
            context.computerModel      = (itRow[IT.COMPUTER_MODEL]     && itRow[IT.COMPUTER_MODEL]     !== 'N/A') ? String(itRow[IT.COMPUTER_MODEL])     : '';
            if (itRow[IT.COMPUTER_TYPE] && itRow[IT.COMPUTER_TYPE] !== 'N/A') context.computerType = String(itRow[IT.COMPUTER_TYPE]);  // overrides request-time value
            context.phoneAssigned      = itRow[IT.PHONE_ASSIGNED]      || '';
            context.phoneCarrier       = (itRow[IT.PHONE_CARRIER]      && itRow[IT.PHONE_CARRIER]      !== 'N/A') ? String(itRow[IT.PHONE_CARRIER])      : '';
            context.phoneModel         = (itRow[IT.PHONE_MODEL]        && itRow[IT.PHONE_MODEL]        !== 'N/A') ? String(itRow[IT.PHONE_MODEL])        : '';
            context.phoneNumber        = (itRow[IT.PHONE_NUMBER]       && itRow[IT.PHONE_NUMBER]       !== 'N/A') ? String(itRow[IT.PHONE_NUMBER])       : '';
            context.phoneVMPassword    = (itRow[IT.PHONE_VM_PASSWORD]  && itRow[IT.PHONE_VM_PASSWORD]  !== 'N/A') ? String(itRow[IT.PHONE_VM_PASSWORD])  : '';
            context.bossAccess         = itRow[IT.BOSS_ACCESS]         || '';
            context.incidentsAccess    = itRow[IT.INCIDENTS_ACCESS]    || '';
            context.caaAccess          = itRow[IT.CAA_ACCESS]          || '';
            context.deliveryAppAccess  = itRow[IT.DELIVERY_APP_ACCESS] || '';
            context.netPromoterAccess  = itRow[IT.NET_PROMOTER_ACCESS] || '';
            context.itNotes            = itRow[IT.IT_NOTES]            || '';
            if (itRow[IT.SUBMISSION_TS]) context.itTimestamp   = itRow[IT.SUBMISSION_TS] instanceof Date ? Utilities.formatDate(itRow[IT.SUBMISSION_TS], Session.getScriptTimeZone(), 'MMM d, yyyy · h:mm a') : String(itRow[IT.SUBMISSION_TS]);
            if (itRow[IT.SUBMITTED_BY])  context.itSubmittedBy = String(itRow[IT.SUBMITTED_BY]);
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

  // DEV: suppress all emails when CONFIG.SUPPRESS_EMAILS is true
  if (CONFIG.SUPPRESS_EMAILS) {
    Logger.log('[EMAIL SUPPRESSED] To: ' + to + ' | Subject: ' + subject);
    return true;
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

    // Always use V2 template — createContextBlockV2 defaults to 'New Hire' if workflowType absent
    const htmlBody = createEmailTemplateV2(finalSubject, finalBody, formUrl, contextData || {}, emailOpts || {});
    
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


// createContextBlock (V1) deleted 2026-05-14 — sendFormEmail now always uses createEmailTemplateV2
// which calls createContextBlockV2 (delegates to per-workflow builders in EmailTemplates.js).


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
    // 1. Email to ID Setup team for Employee ID Setup
    sendFormEmail({
      to: siteDocsEmail,
      subject: 'ID Setup Required',
      body: 'A new employee onboarding request requires your attention.\n\nPlease complete the Employee ID Setup form using the button below. IT and other teams will be notified automatically after you complete the setup.',
      formUrl: employeeIdSetupUrl,
      displayName: 'TEAM Group - Employee Onboarding',
      contextData: contextData
    });
    
    Logger.log('✓ Email sent to ID Setup: ' + siteDocsEmail);
    
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
// V2 EMAIL TEMPLATE SYSTEM
// sendFormEmail() always calls createEmailTemplateV2() as of 2026-05-14.
// V1 (createEmailTemplate + createContextBlock) deleted.
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
 * @param {string} [label]   — event label, e.g. 'Start Date' (default) or 'Effective Date'
 */
function esCalBtn(dateStr, empName, siteName, adpId, label) {
  try {
    var dateLabel = label || 'Start Date';
    var d       = String(dateStr).replace(/-/g, '').substring(0, 8);
    var title   = encodeURIComponent((empName || 'Employee') + ' — ' + dateLabel);
    var details = encodeURIComponent('Site: ' + (siteName || '') + (adpId ? ' | ADP ID: ' + adpId : ''));
    var url     = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + title
                + '&dates=' + d + '/' + d + '&details=' + details;
    return '<a href="' + url + '" style="display:inline-block;padding:11px 20px;'
      + 'background:linear-gradient(135deg,' + ES.btnCal + ',' + ES.btnCalDark + ');'
      + 'color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:13px;'
      + 'font-family:' + ES.fontStack + ';box-shadow:0 3px 10px ' + ES.btnCalShadow + ';">'
      + '📅 Add ' + dateLabel + ' to Calendar</a>';
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
    + (opts.calendarDate ? esCalBtn(opts.calendarDate, opts.employeeName, opts.siteName, opts.adpId, opts.calendarLabel) : '')
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
  if (type === 'New Hire')           return buildNewHireContextBlock(context, opts);
  if (type === 'Termination')        return buildTerminationContextBlock(context, opts);
  if (type === 'Status Change')      return buildStatusChangeContextBlock(context, opts);
  if (type === 'Equipment Request')  return buildEquipmentContextBlock(context, opts);
  return buildNewHireContextBlock(context, opts); // safe fallback
}


// ================================================================
// EMAIL TEMPLATE — V2
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
    // Calendar button label — match workflow type so Termination says "Termination Date" not "Start Date"
    if (!opts.calendarLabel) {
      var _wt = contextData.workflowType || '';
      opts.calendarLabel = _wt === 'Termination'   ? 'Termination Date'
                         : _wt === 'Status Change' ? 'Effective Date'
                         : 'Start Date';
    }
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

// ── Safety onboarding email ───────────────────────────────────────────────────
// Moved from IDSetup.js (2026-05-14) — email-sending logic belongs in EmailUtils,
// not in a form handler. Called from: IDSetup.js (triggerNextStepFromIDSetup)
// and HRVerificationHandler.js (submitHRVerification).

/**
 * Create Safety Onboarding action item and send notification email to Safety group.
 * @param {string} workflowId
 * @param {Object} requestData  - Must include: employeeName, position, siteName, hireDate
 * @param {Object} [setupData]  - Optional; may include siteDocsJobCode
 */
function sendSafetyOnboardingEmail(workflowId, requestData, setupData) {
  try {
    const siteDocsJobCode = (setupData && setupData.siteDocsJobCode) || (function() {
      try {
        var sh = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.SHEETS.ID_SETUP_RESULTS);
        if (!sh) return '';
        var rows = sh.getDataRange().getValues();
        var row = rows.find(function(r) { return r[SCHEMA.ID_SETUP_RESULTS.WORKFLOW_ID] === workflowId; });
        return row ? String(row[SCHEMA.ID_SETUP_RESULTS.SITEDOCS_JOB_CODE] || '') : '';
      } catch(e) { return ''; }
    })();

    // Use full workflow context so all Request Details fields are populated in the email
    var contextData = (typeof getWorkflowContext === 'function' ? getWorkflowContext(workflowId) : null) || {};
    contextData.workflowType = 'New Hire';
    // Supplement with any extra fields from requestData that may not yet be in the sheet
    if (!contextData.employeeName && requestData.employeeName) contextData.employeeName = requestData.employeeName;
    if (!contextData.jobTitle    && requestData.position)      contextData.jobTitle     = requestData.position;
    if (!contextData.siteName    && requestData.siteName)      contextData.siteName     = requestData.siteName;
    if (!contextData.hireDate    && requestData.hireDate)      contextData.hireDate     = requestData.hireDate;
    if (siteDocsJobCode) contextData.siteDocsJobCode = siteDocsJobCode;

    const description = JSON.stringify([
      'Assign SiteDocs locations for employee',
      'Assign DSS learning paths'
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

/**
 * Sends an admin alert when ActionItemService.createActionItem fails.
 * Called centrally from the createActionItem catch block — do not call from handlers.
 *
 * @param {string} workflowId
 * @param {string} category   - e.g. 'IT', 'HR', 'Safety'
 * @param {string} taskName
 * @param {string} assignedTo - email that was supposed to receive the task
 * @param {string} errorMsg
 */
function notifyAdminActionItemFailure(workflowId, category, taskName, assignedTo, errorMsg) {
  try {
    const subject = '[ACTION REQUIRED] Action item creation failed — ' + workflowId;
    const body =
      'An action item could not be created. The assigned team was <b>NOT notified</b> and this task ' +
      'will <b>not appear</b> in the workflow checklist. Manual intervention is required.<br><br>' +
      '<b>Workflow ID:</b> ' + workflowId + '<br>' +
      '<b>Category:</b> ' + category + '<br>' +
      '<b>Task:</b> ' + taskName + '<br>' +
      '<b>Was to be assigned to:</b> ' + assignedTo + '<br>' +
      '<b>Error:</b> ' + errorMsg + '<br><br>' +
      'To resolve: open the GAS script editor, locate the workflow in the Action Items sheet, ' +
      'and manually trigger the relevant handler function or re-create the task.';

    const adminEmails = CONFIG.ADMIN_EMAILS;
    if (!adminEmails || !adminEmails.length) {
      Logger.log('[notifyAdminActionItemFailure] No ADMIN_EMAILS configured — alert not sent.');
      return;
    }

    MailApp.sendEmail({
      to: adminEmails.join(','),
      subject: subject,
      htmlBody: body
    });

    Logger.log('[notifyAdminActionItemFailure] Alert sent for ' + workflowId + ' / ' + category);
  } catch (e) {
    Logger.log('[ERROR] notifyAdminActionItemFailure failed: ' + e.message);
  }
}
