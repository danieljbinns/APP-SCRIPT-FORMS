/**
 * REQUEST_FORMS - Email Notification Functions
 */

/**
 * Sends email notifications after initial request submission
 * @param {string} requestId - The unique request ID
 * @param {object} requestData - The form data submitted
 * @param {string} webAppUrl - The base web app URL
 */
function sendNotifications(requestId, requestData, webAppUrl) {
  try {
    const employeeName = requestData['First Name'] + ' ' + requestData['Last Name'];
    const hireDate = requestData['Hire Date'];
    const siteName = requestData['Site Name'];
    const position = requestData['Position/Title'];

    // Build placeholder form links
    const formLinks = {
      hr: webAppUrl + '?form=hr&id=' + requestId,
      it: webAppUrl + '?form=it&id=' + requestId,
      fleetio: webAppUrl + '?form=fleetio&id=' + requestId,
      creditcard: webAppUrl + '?form=creditcard&id=' + requestId,
      review306090: webAppUrl + '?form=306090&id=' + requestId,
      adpSupervisor: webAppUrl + '?form=adp_supervisor&id=' + requestId,
      adpManager: webAppUrl + '?form=adp_manager&id=' + requestId,
      jonas: webAppUrl + '?form=jonas&id=' + requestId,
      sitedocs: webAppUrl + '?form=sitedocs&id=' + requestId
    };

    // Send to HR
    sendDepartmentEmail(
      CONFIG.EMAILS.HR,
      'HR Setup Required',
      employeeName,
      requestId,
      hireDate,
      siteName,
      position,
      formLinks.hr,
      'HR Setup tasks including benefits enrollment, I-9 verification, and emergency contacts.'
    );

    // Send to IT
    sendDepartmentEmail(
      CONFIG.EMAILS.IT,
      'IT Setup Required',
      employeeName,
      requestId,
      hireDate,
      siteName,
      position,
      formLinks.it,
      'IT Setup tasks including email creation, computer assignment, and network access.'
    );

    // Send confirmation to requester
    sendRequesterConfirmation(
      requestData['Requester Email'],
      requestData['Requester Name'],
      employeeName,
      requestId,
      hireDate
    );

    Logger.log('✓ Notifications sent for request: ' + requestId);
    return true;

  } catch (error) {
    Logger.log('❌ Error sending notifications: ' + error.message);
    return false;
  }
}

/**
 * Sends email to department with placeholder form link
 */
function sendDepartmentEmail(recipient, subject, employeeName, requestId, hireDate, siteName, position, formLink, taskDescription) {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #4285f4; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">${CONFIG.COMPANY_NAME}</h1>
        <h2 style="margin: 10px 0 0 0; font-weight: normal;">New Employee Request</h2>
      </div>

      <div style="padding: 30px; background: #f9f9f9;">
        <h3 style="color: #4285f4; margin-top: 0;">Action Required: ${subject}</h3>

        <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #333;">Employee Information</h4>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold; width: 40%;">Request ID:</td>
              <td style="padding: 8px;">${requestId}</td>
            </tr>
            <tr style="background: #f5f5f5;">
              <td style="padding: 8px; font-weight: bold;">Employee Name:</td>
              <td style="padding: 8px;">${employeeName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Hire Date:</td>
              <td style="padding: 8px;">${hireDate}</td>
            </tr>
            <tr style="background: #f5f5f5;">
              <td style="padding: 8px; font-weight: bold;">Site:</td>
              <td style="padding: 8px;">${siteName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Position:</td>
              <td style="padding: 8px;">${position}</td>
            </tr>
          </table>
        </div>

        <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold;">What you need to do:</p>
          <p style="margin: 5px 0 0 0;">${taskDescription}</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${formLink}"
             style="display: inline-block; padding: 15px 30px; background: #4285f4; color: white;
                    text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
            Complete ${subject}
          </a>
        </div>

        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          <strong>Note:</strong> This is a placeholder form for testing.
          Click "Complete" to mark this step as done.
        </p>
      </div>

      <div style="background: #333; color: #999; padding: 15px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">REQUEST_FORMS - Employee Onboarding System</p>
        <p style="margin: 5px 0 0 0;">${CONFIG.COMPANY_NAME}</p>
      </div>
    </div>
  `;

  const plainBody = `
New Employee Request - ${subject}

Request ID: ${requestId}
Employee: ${employeeName}
Hire Date: ${hireDate}
Site: ${siteName}
Position: ${position}

Action Required:
${taskDescription}

Complete the form here:
${formLink}

---
${CONFIG.COMPANY_NAME}
REQUEST_FORMS - Employee Onboarding System
  `;

  MailApp.sendEmail({
    to: recipient,
    subject: `[REQUEST_FORMS] ${subject} - ${employeeName}`,
    htmlBody: htmlBody,
    body: plainBody
  });
}

/**
 * Sends confirmation email to requester
 */
function sendRequesterConfirmation(recipient, requesterName, employeeName, requestId, hireDate) {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #4caf50; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">✓ Request Submitted</h1>
      </div>

      <div style="padding: 30px; background: #f9f9f9;">
        <p>Hi ${requesterName},</p>

        <p>Your new employee request has been successfully submitted and assigned to the appropriate departments.</p>

        <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #333;">Request Details</h4>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold; width: 40%;">Request ID:</td>
              <td style="padding: 8px; font-family: monospace; color: #4285f4;">${requestId}</td>
            </tr>
            <tr style="background: #f5f5f5;">
              <td style="padding: 8px; font-weight: bold;">Employee Name:</td>
              <td style="padding: 8px;">${employeeName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Hire Date:</td>
              <td style="padding: 8px;">${hireDate}</td>
            </tr>
          </table>
        </div>

        <div style="background: #e3f2fd; padding: 15px; border-left: 4px solid #2196f3; margin: 20px 0;">
          <p style="margin: 0;"><strong>What happens next:</strong></p>
          <ul style="margin: 10px 0 0 0; padding-left: 20px;">
            <li>HR will receive notification for benefits and onboarding tasks</li>
            <li>IT will receive notification for computer and email setup</li>
            <li>Other departments will be notified as needed</li>
          </ul>
        </div>

        <p style="color: #666; font-size: 14px;">
          Keep this Request ID for your records: <strong style="color: #4285f4;">${requestId}</strong>
        </p>
      </div>

      <div style="background: #333; color: #999; padding: 15px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">REQUEST_FORMS - Employee Onboarding System</p>
        <p style="margin: 5px 0 0 0;">${CONFIG.COMPANY_NAME}</p>
      </div>
    </div>
  `;

  const plainBody = `
Request Submitted Successfully

Hi ${requesterName},

Your new employee request has been successfully submitted.

Request ID: ${requestId}
Employee: ${employeeName}
Hire Date: ${hireDate}

The appropriate departments have been notified and will complete their setup tasks.

---
${CONFIG.COMPANY_NAME}
REQUEST_FORMS - Employee Onboarding System
  `;

  MailApp.sendEmail({
    to: recipient,
    subject: `[REQUEST_FORMS] Request Confirmed - ${requestId}`,
    htmlBody: htmlBody,
    body: plainBody
  });
}
