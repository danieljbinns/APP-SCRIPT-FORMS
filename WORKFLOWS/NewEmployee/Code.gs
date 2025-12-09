/**
 * REQUEST_FORMS - Main Application Logic
 * All functions use constants from Config.gs only
 */

/**
 * Main entry point for web app GET requests
 * @param {object} e - Event object with URL parameters
 * @returns {HtmlOutput} Rendered HTML page
 */
function doGet(e) {
  const params = e.parameter || {};

  // Route to appropriate form
  if (!params.form) {
    return renderInitialRequestForm();
  }

  // Route to placeholder sub-form
  const requestId = params.id;
  const formType = params.form;

  if (requestId && formType) {
    return renderSubForm(requestId, formType);
  }

  return HtmlService.createHtmlOutput('<h1>Invalid request</h1>');
}

/**
 * Renders the initial request form with server-side data
 * @returns {HtmlOutput} HTML page
 */
function renderInitialRequestForm() {
  const template = HtmlService.createTemplateFromFile('InitialRequest');

  // Inject server-side data
  template.jobCodes = CONFIG.JOB_CODES;
  template.departments = CONFIG.DEPARTMENTS;
  template.logoUrl = CONFIG.LOGO_URL;
  template.companyName = CONFIG.COMPANY_NAME;
  template.enableDefaultValues = CONFIG.ENABLE_DEFAULT_VALUES;
  template.defaultValues = CONFIG.DEFAULT_VALUES;

  return template.evaluate()
    .setTitle('New Employee Request - ' + CONFIG.COMPANY_NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Renders placeholder sub-form with prefilled data
 * @param {string} requestId - Request ID to lookup
 * @param {string} formType - Type of form (hr, it, fleetio, etc.)
 * @returns {HtmlOutput} HTML page
 */
function renderSubForm(requestId, formType) {
  // Get request data from Initial Requests sheet
  const requestData = getRequestData(requestId);

  if (!requestData) {
    return HtmlService.createHtmlOutput('<h1>Request not found</h1><p>Request ID: ' + requestId + ' does not exist.</p>');
  }

  // Form file mapping
  const formFiles = {
    'hr': 'HRForm',
    'it': 'ITForm',
    'fleetio': 'FleetioForm',
    'creditcard': 'CreditCardForm',
    '306090': 'Review306090Form',
    'adp_supervisor': 'ADPSupervisorForm',
    'adp_manager': 'ADPManagerForm',
    'jonas': 'JonasForm',
    'sitedocs': 'SiteDocsForm'
  };

  // Form title mapping
  const formTitles = {
    'hr': 'HR Setup',
    'it': 'IT Setup',
    'fleetio': 'Fleetio - Vehicle Assignment',
    'creditcard': 'Credit Card Request',
    '306090': '30-60-90 Day Review',
    'adp_supervisor': 'ADP Supervisor Access',
    'adp_manager': 'ADP Manager Access',
    'jonas': 'JONAS ERP Access',
    'sitedocs': 'SiteDocs Safety Training'
  };

  // Get the template file
  const templateFile = formFiles[formType] || 'PlaceholderForm';
  const template = HtmlService.createTemplateFromFile(templateFile);

  // Pass data to template
  template.requestData = requestData;
  template.formType = formType;
  template.formTitle = formTitles[formType] || 'Department Form';
  template.logoUrl = CONFIG.LOGO_URL;
  template.companyName = CONFIG.COMPANY_NAME;

  return template.evaluate()
    .setTitle(formTitles[formType] + ' - ' + requestData['First Name'] + ' ' + requestData['Last Name'])
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Include helper for HTML files
 * @param {string} filename - Name of file to include
 * @returns {string} File content
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Processes initial request form submission
 * @param {object} formData - Form data from client
 * @returns {object} Response object with status and message
 */
function processInitialRequest(formData) {
  try {
    // Generate unique request ID
    const requestId = generateRequestId();

    // Get current timestamp
    const timestamp = new Date();

    // Open spreadsheet and sheet
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    // Build row data matching CONFIG.FORM_FIELDS order
    const rowData = [
      requestId,                                    // Request ID
      timestamp,                                    // Submission Timestamp
      formData['Requester Name'] || '',            // Requester Name
      formData['Requester Email'] || '',           // Requester Email
      formData['Requester Phone'] || '',           // Requester Phone
      formData['First Name'] || '',                // First Name
      formData['Last Name'] || '',                 // Last Name
      formData['Hire Date'] || '',                 // Hire Date
      formData['Site Name'] || '',                 // Site Name
      formData['Department'] || '',                // Department
      formData['Position/Title'] || '',            // Position/Title
      formData['Hourly or Salary'] || '',          // Hourly or Salary
      formData['Reporting Manager Email'] || '',   // Reporting Manager Email
      formData['Laptop'] || '',                    // Laptop
      formData['Monitor'] || '',                   // Monitor
      formData['Keyboard'] || '',                  // Keyboard
      formData['Mouse'] || '',                     // Mouse
      formData['Phone'] || '',                     // Phone
      CONFIG.STATUS.SUBMITTED                       // Workflow Status
    ];

    // Append to sheet
    sheet.appendRow(rowData);
    // Send email notifications
    const webAppUrl = ScriptApp.getService().getUrl();
    sendNotifications(requestId, formData, webAppUrl);

    // Log success
    Logger.log('Request submitted successfully. ID: ' + requestId);

    return {
      success: true,
      message: 'Request submitted successfully! Notifications sent to HR and IT.',
      requestId: requestId
    };

  } catch (error) {
    Logger.log('Error processing request: ' + error.message);
    return {
      success: false,
      message: 'Error submitting request: ' + error.message
    };
  }
}

/**
 * Processes placeholder form completion
 * @param {string} requestId - Request ID
 * @param {string} formType - Type of form (hr, it, etc.)
 * @returns {object} Response object
 */
function processPlaceholder(requestId, formType) {
  try {
    const timestamp = new Date();
    const completedBy = Session.getActiveUser().getEmail();

    // Log completion (placeholder - not saving to sheet yet)
    Logger.log('Placeholder completed: ' + formType + ' for request ' + requestId + ' by ' + completedBy);

    return {
      success: true,
      message: 'Placeholder form completed successfully! (Test mode - not saved to sheet)'
    };

  } catch (error) {
    Logger.log('Error processing placeholder: ' + error.message);
    return {
      success: false,
      message: 'Error: ' + error.message
    };
  }
}

/**
 * Gets request data by Request ID
 * @param {string} requestId - Request ID to lookup
 * @returns {object|null} Request data object or null if not found
 */
function getRequestData(requestId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    // Find row with matching Request ID
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === requestId) {
        // Build object from row data
        const requestData = {};
        for (let j = 0; j < CONFIG.FORM_FIELDS.length; j++) {
          requestData[CONFIG.FORM_FIELDS[j]] = data[i][j];
        }
        return requestData;
      }
    }

    return null;

  } catch (error) {
    Logger.log('Error getting request data: ' + error.message);
    return null;
  }
}

/**
 * Generates a unique request ID
 * Format: WMAR-YYYYMMDD-XXXX (e.g., WMAR-20250127-A3F9)
 * @returns {string} Unique request ID
 */
function generateRequestId() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // Generate random 4-character alphanumeric suffix
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return 'WMAR-' + year + month + day + '-' + suffix;
}

/**
 * Gets job codes for a specific site
 * @param {string} siteName - Name of the site
 * @returns {Array} Array of job code objects
 */
function getJobCodesForSite(siteName) {
  return CONFIG.JOB_CODES[siteName] || [];
}

/**
 * Gets all site names
 * @returns {Array} Array of site names
 */
function getAllSites() {
  return Object.keys(CONFIG.JOB_CODES);
}
