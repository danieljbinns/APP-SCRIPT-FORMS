/**
 * Email Utilities - Standalone Module
 */

function sendHtmlEmail(options) {
  try {
    const emailOptions = {
      to: options.to,
      subject: options.subject,
      htmlBody: options.htmlBody
    };
    if (options.cc) emailOptions.cc = options.cc;
    if (options.bcc) emailOptions.bcc = options.bcc;
    if (options.attachments) emailOptions.attachments = options.attachments;
    MailApp.sendEmail(emailOptions);
    return true;
  } catch (error) {
    Logger.log(`Error sending email: ${error.message}`);
    return false;
  }
}

function sendPlainEmail(options) {
  try {
    MailApp.sendEmail(options.to, options.subject, options.body);
    return true;
  } catch (error) {
    Logger.log(`Error sending email: ${error.message}`);
    return false;
  }
}

function buildEmailTemplate(options) {
  const logoHtml = options.logoUrl ? 
    `<img src="${options.logoUrl}" alt="${options.companyName || 'Company'} Logo" style="max-height:70px; margin-bottom:20px;">` : '';
  
  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">${logoHtml}</div>
        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h1 style="color: #EB1C2D; border-bottom: 3px solid #EB1C2D; padding-bottom: 10px;">${options.title}</h1>
          ${options.body}
        </div>
        <div style="text-align: center; margin-top: 30px; color: #666; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} ${options.companyName || 'Company'}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;
}

function sendEmailWithRateLimit(options, delayMs = 1000) {
  Utilities.sleep(delayMs);
  return sendHtmlEmail(options);
}

function sendBatchEmail(recipients, subject, htmlBody) {
  const results = { success: 0, failed: 0, errors: [] };
  recipients.forEach((email, index) => {
    try {
      if (index > 0) Utilities.sleep(1000);
      sendHtmlEmail({ to: email, subject: subject, htmlBody: htmlBody });
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push({ email: email, error: error.message });
    }
  });
  return results;
}
