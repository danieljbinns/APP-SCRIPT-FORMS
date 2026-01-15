/**
 * New Employee Request Form - Main Handler
 * Uses employee_management_forms library for shared functions
 * 
 * LIBRARY NOTE: After deploying the library, add it to this project:
 * 1. Resources > Libraries
 * 2. Add library using Script ID
 * 3. Select latest version
 * 4. Identifier: "Lib"
 */

/**
 * Serve the HTML form
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('InitialRequest')
    .setTitle('New Employee Request')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Handle form submission
 * @param {Object} formData - Form data from client
 * @returns {Object} Response object {success, requestId, message}
 */
function submitForm(formData) {
  try {
    // Generate unique request ID
    const requestId = Lib.generateRequestId('NEW_EMP');
    
    // Add request ID and timestamp
    formData.requestId = requestId;
    formData.timestamp = new Date();
    
    // Validate required fields
    const requiredFields = ['firstName', 'lastName', 'hireDate', 'requesterEmail'];
    const validation = Lib.validateRequiredFields(formData, requiredFields);
    
    if (!validation.valid) {
      return {
        success: false,
        message: validation.message
      };
    }
    
    // Validate hire date (3+ business days)
    const hireDateValidation = Lib.validateHireDate(formData.hireDate, formData.dateRequested, 3);
    
    if (!hireDateValidation.valid) {
      Logger.log('⚠️ Hire date warning: ' + hireDateValidation.message);
      // Don't block submission, just log warning
    }
    
    // Format data for spreadsheet
    const rowData = formatFormData(formData);
    
    // Add to spreadsheet using library
    const sheetSuccess = Lib.addSheetRow(
      CONFIG.SPREADSHEET_ID,
      CONFIG.SHEET_NAME,
      rowData
    );
    
    if (!sheetSuccess) {
      throw new Error('Failed to add row to spreadsheet');
    }
    
    Logger.log('✓ Form submitted: ' + requestId);
    
    // Send initial request emails (SITEDOCS + requester)
    const employeeName = formData.firstName + ' ' + formData.lastName;
    Lib.sendInitialRequestEmails({
      requestId: requestId,
      employeeName: employeeName,
      hireDate: formData.hireDate,
      requesterEmail: formData.requesterEmail,
      employeeIdSetupUrl: CONFIG.EMPLOYEE_ID_SETUP_URL || 'https://script.google.com/...',
      siteDocsEmail: CONFIG.EMAILS.SITEDOCS
    });
    
    Logger.log('✓ Emails sent');
    
    return {
      success: true,
      requestId: requestId,
      message: 'Request submitted successfully'
    };
    
  } catch (error) {
    Logger.log('❌ Form submission error: ' + error.toString());
    return {
      success: false,
      message: 'Error submitting form: ' + error.message
    };
  }
}

/**
 * Format form data into spreadsheet row (60 columns)
 * Must match CONFIG.FORM_FIELDS order
 */
function formatFormData(data) {
  return [
    // Request Info
    data.requestId,
    data.timestamp,
    data.dateRequested,
    data.requesterName,
    data.requesterEmail,
    
    // Employee Info
    data.hireDate,
    data.newHireOrRehire,
    data.employeeType,
    data.employmentType,
    data.firstName,
    data.middleName || '',
    data.lastName,
    data.preferredName || '',
    data.positionTitle,
    data.siteName,
    data.jobSiteNumber,
    data.reportingManagerEmail,
    data.reportingManagerName || '',
    
    // System Access
    data.systemAccess,
    Array.isArray(data.systems) ? data.systems.join(', ') : '',
    
    // Equipment
    Array.isArray(data.equipment) ? data.equipment.join(', ') : '',
    
    // Google Account Details
    data.googleEmail || '',
    data.googleDomain || '',
    
    // Computer Details
    data.computerRequestType || '',
    data.computerType || '',
    data.computerPreviousUser || '',
    data.computerPreviousType || '',
    data.computerSerialNumber || '',
    data.office365Required || '',
    
    // Credit Card Details
    data.creditCardUSA || '',
    data.creditCardLimitUSA || '',
    data.creditCardCanada || '',
    data.creditCardLimitCanada || '',
    data.creditCardHomeDepot || '',
    data.creditCardLimitHomeDepot || '',
    
    // Mobile Phone Details
    data.phoneRequestType || '',
    data.phonePreviousUser || '',
    data.phonePreviousNumber || '',
    
    // BOSS Details
    data.bossJobSites || '',
    data.bossCostSheet || '',
    data.bossCostSheetJobs || '',
    data.bossTripReports || '',
    data.bossGrievances || '',
    
    // Jonas Details
    data.jonasJobNumbers || '',
    
    // JR Assignment
    data.jrRequired || '',
    data.jrAssignment || '',
    
    // 30-60-90 Day Plan
    data.plan306090 || '',
    
    // Comments
    data.comments || '',
    
    // Workflow Status
    'Submitted'
  ];
}
