/**
 * =============================================================================
 * EMAIL UTILITIES - Email Sending Functions
 * =============================================================================
 * 
 * This file contains email utility functions with support for custom SMTP.
 */

class EmailUtils {
  
  /**
   * Send an email with optional SMTP support
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} body - HTML email body
   * @param {Object} options - Additional options (cc, bcc, attachments)
   */
  static sendEmail(to, subject, body, options = {}) {
    // Use DEV override if in DEV mode
    if (CONFIG.ENVIRONMENT === 'DEV' && CONFIG.DEV_EMAIL_OVERRIDE) {
      Logger.log(`DEV MODE: Redirecting email to ${CONFIG.DEV_EMAIL_OVERRIDE}`);
      to = CONFIG.DEV_EMAIL_OVERRIDE;
    }
    
    // Check if email notifications are enabled
    if (!CONFIG.FEATURES.emailNotificationsEnabled) {
      Logger.log(`Email notifications disabled. Would have sent to: ${to}`);
      return;
    }
    
    // Use SMTP if enabled, otherwise use GmailApp
    if (CONFIG.SMTP.enabled) {
      this.sendViaSMTP(to, subject, body, options);
    } else {
      this.sendViaGmailApp(to, subject, body, options);
    }
    
    Logger.log(`Sent email to ${to}: ${subject}`);
  }
  
  /**
   * Send email via GmailApp (default)
   * @param {string} to - Recipient
   * @param {string} subject - Subject
   * @param {string} body - HTML body
   * @param {Object} options - Options
   */
  static sendViaGmailApp(to, subject, body, options = {}) {
    const emailOptions = {
      htmlBody: body,
      ...options
    };
    
    GmailApp.sendEmail(to, subject, '', emailOptions);
  }
  
  /**
   * Send email via custom SMTP
   * @param {string} to - Recipient
   * @param {string} subject - Subject
   * @param {string} body - HTML body
   * @param {Object} options - Options
   */
  static sendViaSMTP(to, subject, body, options = {}) {
    // For now, fall back to GmailApp
    // Full SMTP implementation would require OAuth2 or App Passwords
    // which is configured via PropertiesService
    
    const emailOptions = {
      htmlBody: body,
      from: CONFIG.SMTP.fromEmail,
      name: CONFIG.SMTP.fromName,
      replyTo: CONFIG.SMTP.replyTo,
      ...options
    };
    
    GmailApp.sendEmail(to, subject, '', emailOptions);
  }
  
  /**
   * Build a standard email template
   * @param {string} title - Email title
   * @param {string} content - Email content (HTML)
   * @param {string} actionUrl - Optional action button URL
   * @param {string} actionText - Optional action button text
   * @returns {string} HTML email
   */
  static buildEmailTemplate(title, content, actionUrl = null, actionText = 'Take Action') {
    let actionButton = '';
    if (actionUrl) {
      actionButton = `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${actionUrl}" style="background-color: #EB1C2D; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">${actionText}</a>
        </div>
      `;
    }
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <!--
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="${CONFIG.LOGO_URL}" alt="${CONFIG.COMPANY_NAME}" style="max-height: 60px;">
        </div>
        -->
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
          <h2 style="color: #EB1C2D; margin-top: 0;">${title}</h2>
          ${content}
        </div>
        
        ${actionButton}
        
        <hr style="border: 0; border-top: 1px solid #ddd; margin: 30px 0;">
        
        <p style="color: #666; font-size: 0.9em; text-align: center;">
          This is an automated message from ${CONFIG.COMPANY_NAME}.<br>
          Please do not reply to this email.
        </p>
      </body>
      </html>
    `;
  }
}
