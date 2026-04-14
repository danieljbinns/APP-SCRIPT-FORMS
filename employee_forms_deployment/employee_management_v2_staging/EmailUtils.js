/**
 * Employee Management Forms - Email Utilities Library
 * Shared email sending and templating functions
 */

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
      employeeName: row[headers.indexOf('First Name')] + ' ' + row[headers.indexOf('Last Name')],
      jobTitle: row[headers.indexOf('Position Title')],
      jrTitle: row[headers.indexOf('JR Assign')], // Capture JR Title also
      siteName: row[headers.indexOf('Site Name')],
      hireDate: row[headers.indexOf('Hire Date')],
      managerName: row[headers.indexOf('Reporting Manager Name')],
      managerEmail: row[headers.indexOf('Reporting Manager Email')],  
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
    
    // PHASE 4 FIX: Check HR Verification Results for "Verified" Titles
    // This ensures downstream forms/emails use the HR-approved data
    const hrSheet = ss.getSheetByName(CONFIG.SHEETS.HR_VERIFICATION_RESULTS);
    if (hrSheet) {
        const hrData = hrSheet.getDataRange().getValues();
        // Workflow ID is Col A (0), Verified Title is Col H (7) - based on HRVerificationHandler
        const hrRow = hrData.find(r => r[0] === workflowId);
        if (hrRow) {
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
  const { to, subject, body, formUrl, displayName, contextData } = options;
  
  if (!to || !subject || !body) {
    Logger.log('❌ Email missing required fields');
    return false;
  }
  
  try {
    // E1: Auto-prepend [EmploymentType | Site] to subject when contextData provides those fields
    let enrichedSubject = subject;
    if (contextData && (contextData.employmentType || contextData.siteName)) {
      const parts = [];
      if (contextData.employmentType) parts.push(contextData.employmentType);
      if (contextData.siteName) parts.push(contextData.siteName);
      if (parts.length > 0) enrichedSubject = '[' + parts.join(' | ') + '] ' + subject;
    }

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
  
  // Build system access summary from systems array or string
  let systemAccessText = 'None';
  if (context.systems) {
    if (Array.isArray(context.systems)) {
      systemAccessText = context.systems.length > 0 ? context.systems.join(', ') : 'None';
    } else if (typeof context.systems === 'string') {
      systemAccessText = context.systems || 'None';
    }
  }
  
  return `
    <tr>
      <td style="padding: 20px 30px; background-color: #f8f9fa; border-bottom: 1px solid #e0e0e0;">
        <h3 style="margin: 0 0 15px 0; color: #EB1C2D; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Request Details</h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #333;">
          ${context.requesterEmail ? `<tr><td style="padding: 6px 0; font-weight: 600; width: 160px;">Submitted By:</td><td style="padding: 6px 0;">${context.requesterEmail}</td></tr>` : ''}
          ${context.employeeName ? `<tr><td style="padding: 6px 0; font-weight: 600;">Employee:</td><td style="padding: 6px 0;">${context.employeeName}</td></tr>` : ''}
          ${context.jobTitle ? `<tr><td style="padding: 6px 0; font-weight: 600;">Job Title:</td><td style="padding: 6px 0;">${context.jobTitle}</td></tr>` : ''}
          ${context.jrTitle ? `<tr><td style="padding: 6px 0; font-weight: 600;">JR Title:</td><td style="padding: 6px 0;">${context.jrTitle}</td></tr>` : ''}
          ${context.department ? `<tr><td style="padding: 6px 0; font-weight: 600;">Department:</td><td style="padding: 6px 0;">${context.department}</td></tr>` : ''}
          ${context.siteName ? `<tr><td style="padding: 6px 0; font-weight: 600;">Site:</td><td style="padding: 6px 0;">${context.siteName}</td></tr>` : ''}
          ${context.hireDate ? `<tr><td style="padding: 6px 0; font-weight: 600;">Effective Date:</td><td style="padding: 6px 0;">${context.hireDate}</td></tr>` : ''}
          ${context.employmentType ? `<tr><td style="padding: 6px 0; font-weight: 600;">Employment Type:</td><td style="padding: 6px 0;">${context.employmentType}</td></tr>` : ''}
          ${context.employeeType ? `<tr><td style="padding: 6px 0; font-weight: 600;">Employee Type:</td><td style="padding: 6px 0;">${context.employeeType}</td></tr>` : ''}
          ${context.newHireOrRehire ? `<tr><td style="padding: 6px 0; font-weight: 600;">Status:</td><td style="padding: 6px 0;">${context.newHireOrRehire}</td></tr>` : ''}
          ${context.reason ? `<tr><td style="padding: 6px 0; font-weight: 600;">Reason:</td><td style="padding: 6px 0;">${context.reason}</td></tr>` : ''}
          ${context.managerName ? `<tr><td style="padding: 6px 0; font-weight: 600;">Manager:</td><td style="padding: 6px 0;">${context.managerName}${context.managerEmail ? ` (${context.managerEmail})` : ''}</td></tr>` : ''}
          ${context.systemAccess !== 'No' && context.systems ? `<tr><td style="padding: 6px 0; font-weight: 600;">System Access:</td><td style="padding: 6px 0;">${systemAccessText}</td></tr>` : ''}
          ${context.equipmentRaw ? `<tr><td style="padding: 6px 0; font-weight: 600;">Equipment:</td><td style="padding: 6px 0;">
            ${context.equipmentRaw}
            ${context.computerType ? `<br><span style="font-size:12px; color:#666">Computer: ${context.computerType} (${context.computerRequestType})</span>` : ''}
            ${context.phoneRequestType ? `<br><span style="font-size:12px; color:#666">Phone: ${context.phoneRequestType} Request</span>` : ''}
          </td></tr>` : ''}
          ${context.assignedEmail ? `<tr><td style="padding: 6px 0; font-weight: 600;">Assigned Email:</td><td style="padding: 6px 0;">${context.assignedEmail}</td></tr>` : ''}
          ${context.jobSiteNumber ? `<tr><td style="padding: 6px 0; font-weight: 600;">Job Site #:</td><td style="padding: 6px 0;">${context.jobSiteNumber}</td></tr>` : ''}
          ${context.requesterEmail ? `<tr><td style="padding: 6px 0; font-weight: 600;">Requested By:</td><td style="padding: 6px 0;">${context.requesterEmail}</td></tr>` : ''}
          ${context.requestDate ? `<tr><td style="padding: 6px 0; font-weight: 6 00;">Request Date:</td><td style="padding: 6px 0;">${context.requestDate}</td></tr>` : ''}
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
          newHireOrRehire, systemAccess, systems, equipment } = config;
  
  Logger.log('Sending initial request emails for: ' + requestId);
  
  // Build comprehensive context data for emails
  const contextData = {
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
    equipmentRaw: Array.isArray(equipment) ? equipment.join(', ') : equipment
  };
  
  try {
    // 1. Email to SITEDOCS team for Employee ID Setup
    sendFormEmail({
      to: siteDocsEmail,
      subject: 'New Employee ID Setup Required',
      body: `A new employee onboarding request requires your attention.\n\nPlease complete the Employee ID Setup form using the button below. IT and other teams will be notified automatically after you complete the setup.`,
      formUrl: employeeIdSetupUrl,
      displayName: 'TEAM Group - Employee Onboarding',
      contextData: contextData
    });
    
    Logger.log('✓ Email sent to SITEDOCS: ' + siteDocsEmail);
    
    // 2. Confirmation to requester
    sendFormEmail({
      to: requesterEmail,
      subject: 'Employee Request Submitted - ' + requestId,
      body: `Your employee onboarding request has been received and is being processed.\n\nYou will receive updates as the request progresses through each stage.`,
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
