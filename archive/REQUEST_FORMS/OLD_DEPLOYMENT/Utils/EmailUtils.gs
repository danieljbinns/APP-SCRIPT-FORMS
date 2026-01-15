/**
 * EmailUtils.gs - Standalone Email Utility
 * 
 * Copy/paste ready email functions for Google Apps Script.
 * No external dependencies - fully self-contained.
 * 
 * @version 1.0.0
 * @author Robinson Solutions
 */

/**
 * Send an HTML email with optional attachments
 * 
 * @param {object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.htmlBody - HTML email body
 * @param {string} [options.from] - Sender email (optional, defaults to script owner)
 * @param {string} [options.replyTo] - Reply-to address (optional)
 * @param {Array<Blob>} [options.attachments] - File attachments (optional)
 * @param {string} [options.cc] - CC recipients (optional)
 * @param {string} [options.bcc] - BCC recipients (optional)
 * @returns {boolean} True if sent successfully
 * 
 * @example
 * sendHtmlEmail({
 *   to: 'user@example.com',
 *   subject: 'Test Email',
 *   htmlBody: '<h1>Hello</h1><p>This is a test.</p>',
 *   replyTo: 'noreply@example.com'
 * });
 */
function sendHtmlEmail(options) {
  try {
    const mailOptions = {
      htmlBody: options.htmlBody,
      name: options.from || Session.getActiveUser().getEmail()
    };
    
    if (options.replyTo) mailOptions.replyTo = options.replyTo;
    if (options.attachments) mailOptions.attachments = options.attachments;
    if (options.cc) mailOptions.cc = options.cc;
    if (options.bcc) mailOptions.bcc = options.bcc;
    
    GmailApp.sendEmail(options.to, options.subject, '', mailOptions);
    Logger.log(`Email sent to ${options.to}: ${options.subject}`);
    return true;
  } catch (error) {
    Logger.log(`Error sending email: ${error.message}`);
    return false;
  }
}

/**
 * Send a plain text email
 * 
 * @param {object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.body - Plain text email body
 * @param {string} [options.replyTo] - Reply-to address (optional)
 * @returns {boolean} True if sent successfully
 * 
 * @example
 * sendPlainEmail({
 *   to: 'user@example.com',
 *   subject: 'Test Email',
 *   body: 'This is a plain text email.'
 * });
 */
function sendPlainEmail(options) {
  try {
    const mailOptions = {};
    
    if (options.replyTo) mailOptions.replyTo = options.replyTo;
    
    GmailApp.sendEmail(options.to, options.subject, options.body, mailOptions);
    Logger.log(`Plain email sent to ${options.to}: ${options.subject}`);
    return true;
  } catch (error) {
    Logger.log(`Error sending plain email: ${error.message}`);
    return false;
  }
}

/**
 * Build an HTML email template with common styling
 * 
 * @param {object} options - Template options
 * @param {string} options.title - Email title/header
 * @param {string} options.body - Main email content (HTML)
 * @param {string} [options.logoUrl] - Company logo URL (optional)
 * @param {string} [options.companyName] - Company name (optional)
 * @param {string} [options.footer] - Footer text (optional)
 * @returns {string} Complete HTML email string
 * 
 * @example
 * const html = buildEmailTemplate({
 *   title: 'New Request Submitted',
 *   body: '<p>A new employee request has been submitted.</p>',
 *   logoUrl: 'https://example.com/logo.png',
 *   companyName: 'Acme Corp'
 * });
 */
function buildEmailTemplate(options) {
  const logo = options.logoUrl 
    ? `<img src="${options.logoUrl}" alt="${options.companyName || 'Company'} Logo" style="max-height: 70px; margin-bottom: 20px;">` 
    : '';
  
  const footer = options.footer || `
    <p style="color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
      This is an automated message from ${options.companyName || 'the system'}. Please do not reply to this email.
    </p>
  `;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        h1 {
          color: #EB1C2D;
          border-bottom: 2px solid #EB1C2D;
          padding-bottom: 10px;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #EB1C2D;
          color: white !important;
          text-decoration: none;
          border-radius: 4px;
          margin: 10px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        td {
          padding: 8px;
          border: 1px solid #ddd;
        }
        .label {
          font-weight: bold;
          width: 40%;
          background-color: #f5f5f5;
        }
      </style>
    </head>
    <body>
      <div style="text-align: center;">
        ${logo}
      </div>
      <h1>${options.title}</h1>
      ${options.body}
      ${footer}
    </body>
    </html>
  `;
}

/**
 * Send email with rate limiting (prevents hitting Gmail quota)
 * 
 * @param {object} options - Email options (same as sendHtmlEmail)
 * @param {number} [delayMs=1000] - Delay in milliseconds between sends
 * @returns {boolean} True if sent successfully
 */
function sendEmailWithRateLimit(options, delayMs = 1000) {
  const result = sendHtmlEmail(options);
  Utilities.sleep(delayMs);
  return result;
}

/**
 * Send email to multiple recipients (batch send)
 * 
 * @param {Array<string>} recipients - Array of email addresses
 * @param {string} subject - Email subject
 * @param {string} htmlBody - HTML email body
 * @param {number} [delayMs=1000] - Delay between sends
 * @returns {object} Results object with success/failure counts
 * 
 * @example
 * sendBatchEmail(
 *   ['user1@example.com', 'user2@example.com'],
 *   'Important Update',
 *   '<p>This is a batch email.</p>'
 * );
 */
function sendBatchEmail(recipients, subject, htmlBody, delayMs = 1000) {
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };
  
  recipients.forEach((to, index) => {
    const sent = sendHtmlEmail({ to, subject, htmlBody });
    if (sent) {
      results.success++;
    } else {
      results.failed++;
      results.errors.push(to);
    }
    
    // Add delay between sends except for last email
    if (index < recipients.length - 1) {
      Utilities.sleep(delayMs);
    }
  });
  
  Logger.log(`Batch send complete: ${results.success} sent, ${results.failed} failed`);
  return results;
}
