/**
 * Employee Management Forms - Email Utilities Library
 * Shared email sending and templating functions
 */

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
  const { to, subject, body, formUrl, displayName } = options;
  
  if (!to || !subject || !body) {
    Logger.log('❌ Email missing required fields');
    return false;
  }
  
  try {
    const htmlBody = createEmailTemplate(subject, body, formUrl);
    
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

/**
 * Create HTML email template
 * @param {string} subject - Email subject
 * @param {string} body - Plain text body (newlines converted to <br>)
 * @param {string} [formUrl] - Optional form URL for button
 * @returns {string} HTML email body
 */
function createEmailTemplate(subject, body, formUrl) {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <h2 style="color: #EB1C2D;">${subject}</h2>
      <p>${body.replace(/\n/g, '<br>')}</p>
      ${formUrl ? `<p><a href="${formUrl}" style="background-color: #EB1C2D; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Open Form</a></p>` : ''}
      <hr style="margin-top: 30px; border: none; border-top: 1px solid #ccc;">
      <p style="color: #666; font-size: 12px;">Team Group Companies - Employee Management System</p>
    </div>
  `;
  
  return htmlBody;
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
  const { requestId, employeeName, hireDate, requesterEmail, employeeIdSetupUrl, siteDocsEmail } = config;
  
  Logger.log('Sending initial request emails for: ' + requestId);
  
  try {
    // 1. Email to SITEDOCS team for Employee ID Setup
    sendFormEmail({
      to: siteDocsEmail,
      subject: 'New Employee ID Setup Required',
      body: `A new employee request has been submitted.\n\nEmployee: ${employeeName}\nHire Date: ${hireDate}\nRequest ID: ${requestId}\n\nPlease complete the Employee ID Setup form:\n${employeeIdSetupUrl}?id=${requestId}\n\nNote: IT and other teams will be notified after you complete the setup.`,
      formUrl: employeeIdSetupUrl + '?id=' + requestId,
      displayName: 'Team Group Companies - Employee Onboarding'
    });
    
    Logger.log('✓ Email sent to SITEDOCS: ' + siteDocsEmail);
    
    // 2. Confirmation to requester
    sendFormEmail({
      to: requesterEmail,
      subject: 'Employee Request Submitted - ' + requestId,
      body: `Your employee request has been submitted successfully.\n\nEmployee: ${employeeName}\nHire Date: ${hireDate}\nRequest ID: ${requestId}\n\nThe SiteDocs team has been notified and will complete the Employee ID setup. Other teams (IT, etc.) will be notified after the setup is complete.`,
      displayName: 'Team Group Companies - Employee Onboarding'
    });
    
    Logger.log('✓ Confirmation email sent to requester: ' + requesterEmail);
    
    return { success: true };
    
  } catch (error) {
    Logger.log('❌ Error sending initial request emails: ' + error.toString());
    return { success: false, error: error.message };
  }
}
