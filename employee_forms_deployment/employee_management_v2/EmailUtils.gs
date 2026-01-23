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
    
    return {
      employeeName: row[headers.indexOf('First Name')] + ' ' + row[headers.indexOf('Last Name')],
      jobTitle: row[headers.indexOf('Position Title')],
      jrTitle: row[headers.indexOf('JR Assign')], // Capture JR Title also
      siteName: row[headers.indexOf('Site Name')],
      hireDate: row[headers.indexOf('Hire Date')],
      managerName: row[headers.indexOf('Reporting Manager Name')],
      managerEmail: row[headers.indexOf('Reporting Manager Email')],  
      requesterEmail: row[headers.indexOf('Requester Email')],
      requestDate: Utilities.formatDate(new Date(row[headers.indexOf('Timestamp')]), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      employmentType: row[headers.indexOf('Employment Type')],
      department: row[headers.indexOf('Department')] || '',
      employeeType: row[headers.indexOf('Employee Type')],
      systemAccess: row[headers.indexOf('System Access')],
      systems: systemsList,
      workType: row[headers.indexOf('Work Type')] || '',
      equipmentRaw: row[headers.indexOf('Equipment')] || '',
      newHireOrRehire: row[headers.indexOf('New Hire/Rehire')]
    };
    
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
    const htmlBody = createEmailTemplate(subject, body, formUrl, contextData);
    
    const emailOptions = {
      to: to,
      subject: subject,
      body: body,
      htmlBody: htmlBody,
      name: displayName || 'Team Group Companies - Employee Management'
    };
    
    MailApp.sendEmail(emailOptions);
    Logger.log('✓ Email sent to: ' + to);
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
              ${body.replace(/\n/g, '<br>')}
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
              Team Group Companies - Employee Management System
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
  
  // Build system access summary from systems array
  const systemAccessText = (context.systems && context.systems.length > 0) ? context.systems.join(', ') : 'None';
  
  return `
    <tr>
      <td style="padding: 20px 30px; background-color: #f8f9fa; border-bottom: 1px solid #e0e0e0;">
        <h3 style="margin: 0 0 15px 0; color: #EB1C2D; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Request Details</h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #333;">
          ${context.employeeName ? `<tr><td style="padding: 6px 0; font-weight: 600; width: 160px;">Employee:</td><td style="padding: 6px 0;">${context.employeeName}</td></tr>` : ''}
          ${context.jobTitle ? `<tr><td style="padding: 6px 0; font-weight: 600;">Job Title:</td><td style="padding: 6px 0;">${context.jobTitle}</td></tr>` : ''}
          ${context.department ? `<tr><td style="padding: 6px 0; font-weight: 600;">Department:</td><td style="padding: 6px 0;">${context.department}</td></tr>` : ''}
          ${context.siteName ? `<tr><td style="padding: 6px 0; font-weight: 600;">Site:</td><td style="padding: 6px 0;">${context.siteName}</td></tr>` : ''}
          ${context.hireDate ? `<tr><td style="padding: 6px 0; font-weight: 600;">Start Date:</td><td style="padding: 6px 0;">${context.hireDate}</td></tr>` : ''}
          ${context.employmentType ? `<tr><td style="padding: 6px 0; font-weight: 600;">Employment Type:</td><td style="padding: 6px 0;">${context.employmentType}</td></tr>` : ''}
          ${context.employeeType ? `<tr><td style="padding: 6px 0; font-weight: 600;">Employee Type:</td><td style="padding: 6px 0;">${context.employeeType}</td></tr>` : ''}
          ${context.newHireOrRehire ? `<tr><td style="padding: 6px 0; font-weight: 600;">Status:</td><td style="padding: 6px 0;">${context.newHireOrRehire}</td></tr>` : ''}
          ${context.managerName ? `<tr><td style="padding: 6px 0; font-weight: 600;">Manager:</td><td style="padding: 6px 0;">${context.managerName}${context.managerEmail ? ` (${context.managerEmail})` : ''}</td></tr>` : ''}
          ${context.systemAccess !== 'No' && context.systems ? `<tr><td style="padding: 6px 0; font-weight: 600;">System Access:</td><td style="padding: 6px 0;">${systemAccessText}</td></tr>` : ''}
          ${context.equipmentRaw ? `<tr><td style="padding: 6px 0; font-weight: 600;">Equipment:</td><td style="padding: 6px 0;">${context.equipmentRaw}</td></tr>` : ''}
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
      displayName: 'Team Group Companies - Employee Onboarding',
      contextData: contextData
    });
    
    Logger.log('✓ Email sent to SITEDOCS: ' + siteDocsEmail);
    
    // 2. Confirmation to requester
    sendFormEmail({
      to: requesterEmail,
      subject: 'Employee Request Submitted - ' + requestId,
      body: `Your employee onboarding request has been received and is being processed.\n\nYou will receive updates as the request progresses through each stage.`,
      displayName: 'Team Group Companies - Employee Onboarding',
      contextData: contextData
    });
    
    Logger.log('✓ Confirmation email sent to requester: ' + requesterEmail);
    
    return { success: true };
    
  } catch (error) {
    Logger.log('❌ Error sending initial request emails: ' + error.toString());
    return { success: false, error: error.message };
  }
}
