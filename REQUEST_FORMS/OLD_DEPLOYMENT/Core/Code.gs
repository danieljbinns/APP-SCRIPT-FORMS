/**
 * WMAR v2 - Main Application Entry Point
 * 
 * Handles all web app requests and routes to appropriate forms.
 * Follows Google Apps Script best practices for HTML service.
 */

/**
 * Main entry point for all GET requests to the web app
 * @param {object} e - Event object with URL parameters
 * @returns {HtmlOutput} Rendered HTML page
 */
function doGet(e) {
  const params = e.parameter || {};
  
  // Route to appropriate form based on parameters
  if (!params.form) {
    // No form specified - show initial request form
    return renderInitialRequestForm();
  }
  
  // Route to sub-form with prefilled data
  const requestId = params.id;
  const formType = params.form;
  
  switch(formType) {
    case 'hr':
      return renderHRForm(requestId);
    case 'it':
      return renderITForm(requestId);
    case 'fleetio':
      return renderFleetioForm(requestId);
    case 'creditcard':
      return renderCreditCardForm(requestId);
    case '306090':
      return render306090Form(requestId);
    case 'adp_supervisor':
      return renderADPSupervisorForm(requestId);
    case 'adp_manager':
      return renderADPManagerForm(requestId);
    case 'jonas':
      return renderJONASForm(requestId);
    case 'sitedocs':
      return renderSiteDocsForm(requestId);
    default:
      return HtmlService.createHtmlOutput('<h1>Invalid form type</h1>');
  }
}

/**
 * Render the initial request form
 * @returns {HtmlOutput} Initial request form HTML
 */
function renderInitialRequestForm() {
  const template = HtmlService.createTemplateFromFile('Forms/InitialRequest');
  
  // Fetch data server-side for fast rendering
  template.jobCodes = getJobCodes();
  template.logoUrl = CONFIG.LOGO_URL;
  template.companyName = CONFIG.COMPANY_NAME;
  
  return template.evaluate()
    .setTitle('New Employee Request')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Render HR setup form with prefilled data
 * @param {string} requestId - Request ID to prefill
 * @returns {HtmlOutput} HR form HTML
 */
function renderHRForm(requestId) {
  const template = HtmlService.createTemplateFromFile('Forms/HR_Setup');
  
  // Get request data from Initial Requests sheet
  const requestData = getRequestData(requestId);
  
  if (!requestData) {
    return HtmlService.createHtmlOutput('<h1>Request not found</h1>');
  }
  
  // Pass data to template
  template.requestData = requestData;
  template.logoUrl = CONFIG.LOGO_URL;
  
  return template.evaluate()
    .setTitle('HR Setup - ' + requestData['First Name'] + ' ' + requestData['Last Name'])
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Render IT setup form with prefilled data
 * @param {string} requestId - Request ID to prefill
 * @returns {HtmlOutput} IT form HTML
 */
function renderITForm(requestId) {
  const template = HtmlService.createTemplateFromFile('Forms/IT_Setup');
  const requestData = getRequestData(requestId);
  
  if (!requestData) {
    return HtmlService.createHtmlOutput('<h1>Request not found</h1>');
  }
  
  template.requestData = requestData;
  template.logoUrl = CONFIG.LOGO_URL;
  
  return template.evaluate()
    .setTitle('IT Setup - ' + requestData['First Name'] + ' ' + requestData['Last Name'])
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// TODO: Implement other form renderers (Fleetio, CreditCard, etc.)
function renderFleetioForm(requestId) { return HtmlService.createHtmlOutput('<h1>Coming Soon: Fleetio Form</h1>'); }
function renderCreditCardForm(requestId) { return HtmlService.createHtmlOutput('<h1>Coming Soon: Credit Card Form</h1>'); }
function render306090Form(requestId) { return HtmlService.createHtmlOutput('<h1>Coming Soon: 30-60-90 Form</h1>'); }
function renderADPSupervisorForm(requestId) { return HtmlService.createHtmlOutput('<h1>Coming Soon: ADP Supervisor Form</h1>'); }
function renderADPManagerForm(requestId) { return HtmlService.createHtmlOutput('<h1>Coming Soon: ADP Manager Form</h1>'); }
function renderJONASForm(requestId) { return HtmlService.createHtmlOutput('<h1>Coming Soon: JONAS Form</h1>'); }
function renderSiteDocsForm(requestId) { return HtmlService.createHtmlOutput('<h1>Coming Soon: SiteDocs Form</h1>'); }

/**
 * Include external HTML files (for templating)
 * @param {string} filename - Name of file to include
 * @returns {string} File content
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Get request data from Initial Requests sheet
 * @param {string} requestId - Request ID
 * @returns {object|null} Request data or null if not found
 */
function getRequestData(requestId) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowData = {};
    headers.forEach((header, index) => {
      rowData[header] = row[index];
    });
    
    if (rowData['Request ID'] === requestId) {
      return rowData;
    }
  }
  
  return null;
}

/**
 * Get job codes data
 * @returns {Array} Job codes array
 */
function getJobCodes() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.JOB_CODES);
  
  if (!sheet) return [];
  
  return sheet.getDataRange().getValues().slice(1); // Skip header row
}


/**
 * Process initial request form submission
 * @param {object} data - Form data
 * @returns {object} Response object
 */
function processInitialRequest(data) {
  try {
    // Generate unique Request ID
    const requestId = SheetUtils.generateUniqueId('REQ');
    data['Request ID'] = requestId;
    data['Workflow Status'] = CONFIG.STATUSES.SUBMITTED;
    
    // Prepare row data in correct order
    const headers = CONFIG.FORM_FIELDS.INITIAL_REQUEST;
    const rowData = headers.map(header => data[header] || '');
    
    // Append to sheet
    const success = SheetUtils.appendRow(
      CONFIG.SPREADSHEET_ID,
      CONFIG.SHEETS.INITIAL_REQUESTS,
      rowData
    );
    
    if (!success) {
      throw new Error('Failed to save data to sheet');
    }
    
    // Send notification emails
    sendRequestNotifications(requestId, data);
    
    // Generate prefilled URLs for sub-forms
    const urls = generateSubFormUrls(requestId, data);
    
    Logger.log(`Request ${requestId} submitted successfully`);
    
    return {
      status: 'success',
      message: `Request submitted successfully! Request ID: ${requestId}`,
      requestId: requestId,
      subFormUrls: urls
    };
    
  } catch (error) {
    Logger.log(`Error processing request: ${error.message}`);
    return {
      status: 'error',
      message: error.message
    };
  }
}

/**
 * Send notification emails for new request
 * @param {string} requestId - Request ID
 * @param {object} data - Request data
 */
function sendRequestNotifications(requestId, data) {
  const employeeName = `${data['First Name']} ${data['Last Name']}`;
  const baseUrl = ScriptApp.getService().getUrl();
  
  const emailBody = EmailUtils.buildEmailTemplate({
    title: 'New Employee Request Submitted',
    body: `
      <p>A new employee request has been submitted:</p>
      <table>
        <tr><td class="label">Request ID:</td><td>${requestId}</td></tr>
        <tr><td class="label">Employee:</td><td>${employeeName}</td></tr>
        <tr><td class="label">Hire Date:</td><td>${data['Hire Date']}</td></tr>
        <tr><td class="label">Site:</td><td>${data['Site Name']}</td></tr>
        <tr><td class="label">Position:</td><td>${data['Position/Title']}</td></tr>
      </table>
      <p>
        <a href="${baseUrl}?form=hr&id=${requestId}" class="button">Complete HR Setup</a>
        <a href="${baseUrl}?form=it&id=${requestId}" class="button">Complete IT Setup</a>
      </p>
    `,
    logoUrl: CONFIG.LOGO_URL,
    companyName: CONFIG.COMPANY_NAME
  });
  
  // Send to HR
  EmailUtils.sendHtmlEmail({
    to: CONFIG.EMAILS.HR_SETUP,
    subject: `New Employee Request: ${employeeName}`,
    htmlBody: emailBody
  });
  
  // Send to IT
  EmailUtils.sendHtmlEmail({
    to: CONFIG.EMAILS.IT_SETUP,
    subject: `New Employee Setup Required: ${employeeName}`,
    htmlBody: emailBody
  });
}

/**
 * Generate prefilled URLs for sub-forms
 * @param {string} requestId - Request ID
 * @param {object} data - Request data
 * @returns {object} URLs object
 */
function generateSubFormUrls(requestId, data) {
  const baseUrl = ScriptApp.getService().getUrl();
  
  return {
    hr: `${baseUrl}?form=hr&id=${requestId}`,
    it: `${baseUrl}?form=it&id=${requestId}`,
    fleetio: `${baseUrl}?form=fleetio&id=${requestId}`,
    creditCard: `${baseUrl}?form=creditcard&id=${requestId}`
  };
}


// ============================================================================
// FORM PROCESSORS - Handle all sub-form submissions
// ============================================================================

/**
 * Process HR Setup form submission
 */
function processHRSetup(data) {
  try {
    const headers = CONFIG.FORM_FIELDS.HR_SETUP;
    const rowData = headers.map(h => data[h] || '');
    
    SheetUtils.appendRow(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.HR_SETUP, rowData);
    
    return { status: 'success', message: 'HR Setup completed successfully!' };
  } catch (error) {
    Logger.log(`Error in processHRSetup: ${error.message}`);
    return { status: 'error', message: error.message };
  }
}

/**
 * Process IT Setup form submission
 */
function processITSetup(data) {
  try {
    const headers = CONFIG.FORM_FIELDS.IT_SETUP;
    const rowData = headers.map(h => data[h] || '');
    
    SheetUtils.appendRow(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.IT_SETUP, rowData);
    
    return { status: 'success', message: 'IT Setup completed successfully!' };
  } catch (error) {
    Logger.log(`Error in processITSetup: ${error.message}`);
    return { status: 'error', message: error.message };
  }
}

/**
 * Process Fleetio form submission
 */
function processFleetio(data) {
  try {
    SheetUtils.appendRow(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.FLEETIO, Object.values(data));
    return { status: 'success', message: 'Vehicle assignment completed successfully!' };
  } catch (error) {
    Logger.log(`Error in processFleetio: ${error.message}`);
    return { status: 'error', message: error.message };
  }
}

/**
 * Process Credit Card form submission
 */
function processCreditCard(data) {
  try {
    SheetUtils.appendRow(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.CREDIT_CARD, Object.values(data));
    return { status: 'success', message: 'Credit card request completed successfully!' };
  } catch (error) {
    Logger.log(`Error in processCreditCard: ${error.message}`);
    return { status: 'error', message: error.message };
  }
}

/**
 * Process 30-60-90 form submission
 */
function process306090(data) {
  try {
    SheetUtils.appendRow(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.THIRTY_SIXTY_NINETY, Object.values(data));
    return { status: 'success', message: '30-60-90 plan updated successfully!' };
  } catch (error) {
    Logger.log(`Error in process306090: ${error.message}`);
    return { status: 'error', message: error.message };
  }
}

/**
 * Process ADP Supervisor form submission
 */
function processADPSupervisor(data) {
  try {
    SheetUtils.appendRow(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.ADP_SUPERVISOR, Object.values(data));
    return { status: 'success', message: 'ADP Supervisor access completed successfully!' };
  } catch (error) {
    Logger.log(`Error in processADPSupervisor: ${error.message}`);
    return { status: 'error', message: error.message };
  }
}

/**
 * Process ADP Manager form submission
 */
function processADPManager(data) {
  try {
    SheetUtils.appendRow(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.ADP_MANAGER, Object.values(data));
    return { status: 'success', message: 'ADP Manager access completed successfully!' };
  } catch (error) {
    Logger.log(`Error in processADPManager: ${error.message}`);
    return { status: 'error', message: error.message };
  }
}

/**
 * Process JONAS form submission
 */
function processJONAS(data) {
  try {
    SheetUtils.appendRow(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.JONAS, Object.values(data));
    return { status: 'success', message: 'JONAS access completed successfully!' };
  } catch (error) {
    Logger.log(`Error in processJONAS: ${error.message}`);
    return { status: 'error', message: error.message };
  }
}

/**
 * Process SiteDocs form submission
 */
function processSiteDocs(data) {
  try {
    SheetUtils.appendRow(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.SITEDOCS, Object.values(data));
    return { status: 'success', message: 'SiteDocs access completed successfully!' };
  } catch (error) {
    Logger.log(`Error in processSiteDocs: ${error.message}`);
    return { status: 'error', message: error.message };
  }
}
