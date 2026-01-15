// --- CONFIGURATION ---
// --- CONFIGURATION ---
// Configuration has been moved to Config.gs
// All constants now reference CONFIG object for centralized management

// Backward compatibility aliases - these reference CONFIG values
const FORM_ID = CONFIG.FORM_ID;
const SPREADSHEET_ID = CONFIG.SPREADSHEET_ID;
const JOB_CODES_SHEET_ID = CONFIG.JOB_CODES_SHEET_ID;
const LOGO_URL = CONFIG.LOGO_URL;
const MASTER_SHEET_NAME = CONFIG.MASTER_SHEET_NAME;

// --- Email Configuration ---
// Email addresses for various stages of the workflow.
const HR_SETUP_EMAIL = CONFIG.HR_SETUP_EMAIL;
const HR_APPROVAL_EMAIL = CONFIG.HR_APPROVAL_EMAIL;
const IT_SETUP_EMAIL = CONFIG.IT_SETUP_EMAIL;

// Emails for parallel tasks that are triggered based on form responses.
const FLEETIO_EMAIL = CONFIG.FLEETIO_EMAIL;
const CREDIT_CARD_EMAIL = CONFIG.CREDIT_CARD_EMAIL;
const BUSINESS_CARD_EMAIL = CONFIG.BUSINESS_CARD_EMAIL;
const THIRTY_SIXTY_NINETY_EMAIL = CONFIG.THIRTY_SIXTY_NINETY_EMAIL;
const ADP_MANAGER_ACCESS_EMAIL = CONFIG.ADP_MANAGER_ACCESS_EMAIL;
const ADP_SUPERVISOR_ACCESS_EMAIL = CONFIG.ADP_SUPERVISOR_ACCESS_EMAIL;
const JR_EMAIL = CONFIG.JR_EMAIL;
const JR_306090_EMAIL = CONFIG.JR_306090_EMAIL;
const JONAS_EMAIL = CONFIG.JONAS_EMAIL;
const SITEDOCS_EMAIL = CONFIG.SITEDOCS_EMAIL; 


// --- MASTER ROUTER ---
/**
 * @description This is the main function that runs when a user accesses the web app's URL. It acts as a router, directing the user to the correct web page based on the URL parameters.
 * @howItWorks It inspects the `e.parameter` object from the URL.
 * - If there are no parameters, it shows the main employee request form (Index.html).
 * - If there's an 'id', it fetches the corresponding request data.
 * - Based on additional parameters like 'view' or 'action', it routes to specific pages like the HR form, IT form, approval/denial pages, or parallel task forms.
 * - If a request is in a state that doesn't match the URL parameters (e.g., trying to approve an already completed request), it shows a generic "Closed" page with the current status.
 * @output {HtmlService.HtmlOutput} An HTML page to be displayed in the user's browser.
 */
function doGet(e) {
  // Get the URL parameters (e.g., ?id=...&view=...).
  e = e || {};
  const p = e.parameter || {};

  // If no parameters are provided, show the main submission form.
  if (Object.keys(p).length === 0) {
    return showPage('Index.html', 'Employee Request Form');
  }

  // --- STANDALONE FORM ROUTING ---
  // Check if this is a standalone form request (e.g., ?type=creditcard)
  if (p.type && !p.id) {
    return showStandaloneForm(p.type);
  }

  // All subsequent routes require a request ID.
  const id = p.id;
  if (!id) { return HtmlService.createHtmlOutput('Missing Request ID.'); }

  // Fetch the data for the given request ID from the spreadsheet.
  const data = getRequestData(id);
  if (!data) { return HtmlService.createHtmlOutput('Invalid Request ID.'); }
  
  // Get the current workflow status of the request.
  const status = data['Workflow Status'];
  Logger.log(`Routing request ID ${id} with status: "${status}"`);

  // --- Router for all parallel tasks (Fleetio, Credit Card, etc.) ---
  const parallelTasks = getParallelTaskMap();
  // Find if the 'view' parameter in the URL matches a defined parallel task.
  const parallelTask = parallelTasks.find(task => task.viewName === p.view);
  if (parallelTask) {
    // Check if the task is already completed.
    const taskStatus = Array.isArray(parallelTask.statusColumn) ? data[parallelTask.statusColumn[0]] : data[parallelTask.statusColumn];
    if (taskStatus === 'Complete') {
      return showClosedPage(`This ${parallelTask.formTitle} form has already been completed.`);
    }
    // Prepare data to be passed to the HTML template.
    const templateData = {
      requestId: id,
      employeeName: `${data['First Name']} ${data['Last Name']}`,
      employeeId: data['Temporary ID'],
      formTitle: parallelTask.formTitle,
      statusColumn: parallelTask.statusColumn,
      additionalAccounts: data['Additional Credit/ Purchasing Accounts'] || ''
    };
    // Use a specific HTML file if defined, otherwise use the generic one.
    const formFile = parallelTask.formFile || 'ParallelTaskForm.html';
    return showPage(formFile, parallelTask.formTitle, templateData);
  }

  // --- Router for main sequential tasks (HR, IT) ---
  if (p.view) {
    if (p.view === 'hr' && status === 'Pending HR Setup') {
      return showPage('HR.html', 'Employee Setup Form', { requestId: id });
    }
    if (p.view === 'it' && status === 'Pending IT Setup') {
      return showPage('ITSetup.html', 'IT Setup Form', { requestId: id });
    }
    // If the view doesn't match the current status, show the closed page.
    return showClosedPage(status);
  }
  
  // --- Router for final approval actions ---
  if (p.action) {
    if (status === 'Pending Final HR Approval') {
      if (p.action === 'approve') {
         return showPage('Approval.html', 'Final Approval', { approvalId: id, submitFunction: 'processFinalApproval' });
      }
      if (p.action === 'deny') {
         return showPage('Denial.html', 'Final Denial', { approvalId: id, submitFunction: 'processFinalDenial' });
      }
      if (p.action === 'sendback') {
         return showPage('SendBack.html', 'Send Back Request', { requestId: id });
      }
    }
    // If the action is not valid for the current status, show the closed page.
    return showClosedPage(status);
  }
  
  // --- Router for editing a request that was sent back ---
  if (p.id && !p.view && !p.action) {
    if (status === 'Sent Back to Requester') {
      // Re-opens the main form, which will be pre-populated with existing data.
      return showPage('Index.html', 'Edit Employee Request');
    } else {
      // If the request is not in an editable state, show the closed page.
      return showClosedPage(status);
    }
  }

  // Fallback for any other combination of parameters.
  return showClosedPage(status);
}

// --- DATA PROVIDERS ---
// These functions are called from the client-side JavaScript (HTML files) to fetch data needed to populate the forms.

/**
 * @description Fetches all the necessary data for the initial requester form (Index.html).
 * @howItWorks It checks if an 'id' is provided to fetch existing data for an edit. It also fetches the structure of the Google Form (all the questions) and the list of job codes. It sanitizes the data to ensure dates are in a client-friendly format.
 * @output {object} An object containing `requestData` (or null if new), `formStructure`, and `jobCodeData`. Returns an `error` object on failure.
 */
function getRequesterInitialData(params) {
  try {
    const id = params.id;
    let data = null;
    if (id) {
      data = getRequestData(id);
    }
    const structure = getCoreFormStructure(); // Use Core Schema
    const jobCodes = getJobCodeData();
    const sanitizedData = sanitizeDataForClient(data);
    return { requestData: sanitizedData, formStructure: structure, jobCodeData: jobCodes };
  } catch (e) {
    Logger.log(e);
    return { error: e.message };
  }
}

/**
 * @description Fetches data for the HR Setup form and generates a suggested DSS username.
 * @howItWorks It retrieves the request data using the `requestId`. It then looks up the site abbreviation from the job codes data sheet. Using the employee's initials, hire date, and site abbreviation, it constructs a username (e.g., 'DB20250829KIT'). This generated username is added to the data object before being sent to the client.
 * @output {object} A sanitized data object for the request, including the new `generatedDssUsername` property. Returns null on failure.
 */
function getHrRequestData(requestId) {
  try {
    let data = getRequestData(requestId);
    if (data) {
      const jobCodes = getJobCodeData();
      const siteName = data['Site Name'];
      const siteInfo = jobCodes.find(row => row[0] === siteName);
      
      if (siteInfo) {
        const siteAbbreviation = siteInfo[1];
        const firstInitial = data['First Name'] ? data['First Name'].charAt(0) : 'X';
        const lastInitial = data['Last Name'] ? data['Last Name'].charAt(0) : 'X';
        
        let datePart;
        const hireDate = data['Hire Date'];
        if (hireDate && hireDate instanceof Date) {
            datePart = Utilities.formatDate(hireDate, Session.getScriptTimeZone(), 'yyyyMMdd');
        } else {
            datePart = Utilities.formatDate(new Date(null), Session.getScriptTimeZone(), 'yyyyMMdd');
        }
        data.generatedDssUsername = `${firstInitial}${lastInitial}${datePart}${siteAbbreviation}`.toUpperCase();
      }
    }
    return sanitizeDataForClient(data);
  } catch(e) {
    Logger.log(`Error in getHrRequestData: ${e.message}`);
    return null;
  }
}

/**
 * @description Fetches data for the IT Setup form.
 * @howItWorks It simply calls `getRequestData` with the provided `requestId` and sanitizes the result for client-side use.
 * @output {object} A sanitized data object for the request. Returns null on failure.
 */
function getItSetupData(requestId) {
  try {
    let data = getRequestData(requestId);
    return sanitizeDataForClient(data);
  } catch(e) {
    Logger.log(e);
    return null;
  }
}

// --- FORM SUBMISSION ROUTER ---
/**
 * @description A server-side router that receives all form submissions from the client.
 * @howItWorks It reads the `formType` property from the submitted `formData` object. Based on this value ('requester', 'hr', 'it', etc.), it calls the appropriate handler function to process the submission.
 * @output {object} A status object (e.g., `{status: 'success', message: '...'}`) which is sent back to the client to confirm the submission.
 */
function processSubmission(formData) {
  try {
    const formType = formData.formType;
    if (formType === 'requester') return handleRequesterSubmission(formData);
    if (formType === 'hr') return handleHrSetupSubmission(formData);
    if (formType === 'it') return handleItSubmission(formData);
    if (formType === 'parallel_task_submission') return handleParallelTaskSubmission(formData);
    throw new Error(`Unknown form type submitted: ${formType}`);
  } catch(e) {
    Logger.log(`Error in processSubmission: ${e.message}`);
    return { status: 'error', message: `Server error: ${e.message}`};
  }
}

// --- WORKFLOW STAGE HANDLERS ---

/**
 * @description Handles the submission of the initial employee request form, for both new and edited requests.
 * @howItWorks 
 * - It sets the `Submission Timestamp` and a `Post-Processing Status` to 'Pending Requester Emails'.
 * - If a `Request ID` exists in the form data, it treats it as an edit, updates the existing row in the spreadsheet, and sets the `Workflow Status` to 'Pending HR Setup'.
 * - If no `Request ID` exists, it's a new submission. It generates a unique `Request ID` (using timestamp) and a daily incrementing `Temporary ID`. It then appends this new request as a new row to the spreadsheet.
 * - Finally, it calls `createPostProcessingTrigger()` to schedule the email notifications.
 * @output {object} A success object with a confirmation message for the user.
 */
function handleRequesterSubmission(formData) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MASTER_SHEET_NAME);
  const employeeName = formData['First Name'] + ' ' + formData['Last Name'];
  let message;
  let requestId = formData['Request ID'];

  formData['Submission Timestamp'] = new Date();
  
  // Set the post-processing status before writing to the sheet. This flags the row for the queue processor.
  formData['Post-Processing Status'] = 'Pending Requester Emails';

  if (requestId) { // This is for an EDIT of a sent-back request.
    formData['Workflow Status'] = 'Pending HR Setup';
    updateSheetData(sheet, requestId, formData); // Update the existing row.
    message = `Your edited request for ${employeeName} has been resubmitted.`;
  } else { // This is for a NEW submission.
    // Generate a human-readable temporary ID based on date and a daily counter.
    const today = new Date();
    const dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyMMdd');
    const scriptProperties = PropertiesService.getScriptProperties();
    const propertyKey = 'daily_increment_' + dateStr;
    
    let currentIncrement = scriptProperties.getProperty(propertyKey);
    let nextIncrement = currentIncrement ? parseInt(currentIncrement) + 1 : 1;
    scriptProperties.setProperty(propertyKey, nextIncrement);
    
    const increment = nextIncrement.toString().padStart(3, '0');
    const temporaryId = `${dateStr}${increment}`;
    
    // Generate a unique system ID for the request.
    requestId = `REQ-${new Date().getTime()}`;
    formData['Request ID'] = requestId;
    formData['Temporary ID'] = temporaryId;
    formData['Workflow Status'] = 'Pending HR Setup';
    
    appendDataToSheet(sheet, formData); // Add as a new row.
    message = `Form submitted! It is now being processed.`;
  }
  
  SpreadsheetApp.flush(); // Ensure all changes are written to the spreadsheet.
  createPostProcessingTrigger(); // Schedule the email processing.
  
  return { status: 'success', message: message };
}

/**
 * @description Handles the submission of the HR Setup form.
 * @howItWorks It updates the `Workflow Status` to 'Pending IT Setup', adds an HR submission timestamp, and sets the `Post-Processing Status` to 'Pending HR Emails'. It then updates the corresponding row in the spreadsheet and creates a trigger to process the next batch of emails.
 * @output {object} A success object with a confirmation message.
 */
function handleHrSetupSubmission(formData) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MASTER_SHEET_NAME);
  const requestId = formData['Request ID'];

  formData['Workflow Status'] = 'Pending IT Setup'; 
  formData['HR - Date of Submission'] = new Date();
  formData['Post-Processing Status'] = 'Pending HR Emails';
  updateSheetData(sheet, requestId, formData);
  
  SpreadsheetApp.flush();
  createPostProcessingTrigger();

  return { status: 'success', message: 'Employee setup information has been saved and is being sent to relevant departments.' };
}

/**
 * @description Handles the submission of the IT Setup form.
 * @howItWorks It adds an IT completion timestamp, sets the `Post-Processing Status` to 'Pending IT Emails', updates the spreadsheet, and creates a trigger. The trigger will run `processQueue` which in turn calls `checkForCompletion`.
 * @output {object} A success object with a confirmation message.
 */
function handleItSubmission(formData) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MASTER_SHEET_NAME);
  const requestId = formData['Request ID'];

  formData['IT - Completion Timestamp'] = new Date();
  formData['Post-Processing Status'] = 'Pending IT Emails';
  updateSheetData(sheet, requestId, formData);
  SpreadsheetApp.flush();
  
  createPostProcessingTrigger();

  return { status: 'success', message: 'IT setup has been submitted.' };
}

/**
 * @description Handles submissions from any of the parallel task forms (e.g., Fleetio, Credit Card).
 * @howItWorks It's a generic handler. It identifies which status column to update from the `statusColumn` property in the `formData`. It sets that column to 'Complete' and adds a corresponding timestamp. It also copies any other submitted data (like asset numbers) into an `updateData` object. Finally, it writes all these updates to the spreadsheet and calls `checkForCompletion` to see if the whole request can now move forward.
 * @output {object} A simple success object. The user sees a generic 'completed' page.
 */
function handleParallelTaskSubmission(formData) {
  Logger.log('handleParallelTaskSubmission received: ' + JSON.stringify(formData));

  const requestId = formData.requestId;
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MASTER_SHEET_NAME);
  const updateData = {};

  // Generic logic for simple tasks.
  const statusColumn = formData.statusColumn;
  if (statusColumn) {
    Logger.log(`Found statusColumn: "${statusColumn}". Preparing to update status and timestamp.`);
    updateData[statusColumn] = formData.statusValue || 'Complete';
    const timestampColumn = statusColumn.replace('Status', 'Timestamp').trim();
    updateData[timestampColumn] = new Date();
  } else {
    Logger.log('WARNING: No "statusColumn" property was found in the submitted form data.');
  }

  // Specific logic for combined forms like JR/30-60-90.
  if (formData['JR - Status']) {
    updateData['JR - Status'] = formData['JR - Status'];
    updateData['JR - Timestamp'] = new Date();
  }
  if (formData['30-60-90 - Status']) {
     updateData['30-60-90 - Status'] = formData['30-60-90 - Status'];
     updateData['30-60-90 - Timestamp'] = new Date();
  }

  // Copy any other data from the form (e.g., asset numbers, card limits) into the update object.
  for (const key in formData) {
    if (!updateData.hasOwnProperty(key) && key !== 'requestId' && key !== 'formType' && key !== 'statusColumn' && key !== 'statusValue') {
      updateData[key] = formData[key];
    }
  }

  Logger.log('Data prepared for sheet update: ' + JSON.stringify(updateData));

  // Update the sheet if there's data to save.
  if (Object.keys(updateData).length > 0) {
    updateSheetData(sheet, requestId, updateData);
    SpreadsheetApp.flush();
    checkForCompletion(requestId); // Check if this completion triggers the next workflow step.
  } else {
    Logger.log('No data to update. Skipping sheet update.');
  }

  return { status: 'success' };
}

/**
 * @description Creates a time-based trigger to run the `processQueue` function in 60 seconds.
 * @howItWorks It first deletes any existing triggers for `processQueue` to prevent multiple triggers from running simultaneously. Then, it creates a new trigger that will execute the `processQueue` function once, approximately 60 seconds from now. This decouples the time-consuming email sending process from the user's form submission, providing a faster UI response.
 * @output {void}
 */
function createPostProcessingTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    // Clean up old or stuck triggers.
    if (trigger.getHandlerFunction() === 'processQueue' || trigger.getHandlerFunction() === 'doGet') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  // Create a new trigger to run the queue processor after a delay.
  ScriptApp.newTrigger('processQueue')
      .timeBased()
      .after(60 * 1000) // 1 minute
      .create();
}

/**
 * @description Scans the spreadsheet for rows that require background processing (like sending emails) and handles them.
 * @howItWorks This function is executed by a time-based trigger. It reads the entire sheet, finds rows with a 'Post-Processing Status' that is not 'Complete' or 'Error'. 
 * - For 'Pending Requester Emails', it generates a PDF of the initial submission and emails it to HR (with a setup link) and to the requester/manager (as a confirmation).
 * - For 'Pending HR Emails', it generates an updated PDF and emails IT with a setup link. It also emails all the departments responsible for parallel tasks (Fleetio, etc.) if their task was requested. Finally, it sends an update to the requester/manager.
 * - For 'Pending IT Emails', it simply calls `checkForCompletion` to see if the workflow can advance.
 * After successfully processing a row, it updates the 'Post-Processing Status' to 'Complete'. If it finds no rows to process, it deletes the trigger to stop itself from running again unnecessarily.
 * @output {void}
 */
function processQueue() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MASTER_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  let processed = false;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowObject = {};
    headers.forEach((header, index) => rowObject[header] = row[index]);

    const status = rowObject['Post-Processing Status'];
    const requestId = rowObject['Request ID'];

    if (status && status !== 'Complete' && !status.startsWith('Error')) {
      try {
        if (status === 'Pending Requester Emails') {
          // --- STAGE 1: After initial submission ---
          const employeeName = rowObject['First Name'] + ' ' + rowObject['Last Name'];
          const siteName = rowObject['Site Name'];
          const requesterEmail = rowObject['Requester Email'];
          const managerEmail = rowObject['Reporting Manager Email '];
          
          const initialPdf = generateRequesterPdf(rowObject);
          
          // Save PDF to Drive
          try {
            const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss');
            const pdfFileName = `Initial_Request_${employeeName}_${timestamp}.pdf`;
            PDFUtils.savePdfToDrive(initialPdf, pdfFileName, 'initial_submissions', requestId);
            Logger.log(`PDF saved for request ${requestId}`);
          } catch (pdfError) {
            Logger.log(`Error saving PDF: ${pdfError.message}`);
          }
          
          const setupUrl = ScriptApp.getService().getUrl() + `?view=hr&id=${requestId}`;
          const subject = `ACTION REQUIRED: New Hire Setup for ${employeeName} at ${siteName}`;
          const hrEmailBody = `A new employee request for ${employeeName} has been submitted. Please review the attached PDF.<br/><br/>Then complete the setup form using the link below:<br/><br/><a href="${setupUrl}" style="background-color: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Complete Employee Setup Form</a>`;
          
          // Send task email to HR.
          MailApp.sendEmail({ to: HR_SETUP_EMAIL, subject: subject, htmlBody: hrEmailBody, attachments: [initialPdf] });

          // Send confirmation email to Requester and Manager.
          const recipients = [requesterEmail];
          if (managerEmail && managerEmail.includes('@')) {
            recipients.push(managerEmail);
          }
          MailApp.sendEmail({ to: recipients.join(','), subject: `Confirmation: Your request for ${employeeName} at ${siteName}`, htmlBody: "Thank you for your submission. A copy of your request is attached.", attachments: [initialPdf] });

          updateSheetData(sheet, requestId, { 'Post-Processing Status': 'Complete' });
          processed = true;

        } else if (status === 'Pending HR Emails') {
            // --- STAGE 2: After HR completes their setup ---
            const fullRequestData = getRequestData(requestId);
            const employeeName = fullRequestData['First Name'] + ' ' + fullRequestData['Last Name'];
            const siteName = fullRequestData['Site Name'];
            const requesterEmail = fullRequestData['Requester Email'];
            const managerEmail = fullRequestData['Reporting Manager Email '];
            const pdfBlob = generateFinalPdf(fullRequestData);
            
            // Save PDF to Drive
            try {
              const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss');
              const pdfFileName = `HR_Setup_Complete_${employeeName}_${timestamp}.pdf`;
              PDFUtils.savePdfToDrive(pdfBlob, pdfFileName, 'hr_setup', requestId);
              Logger.log(`PDF saved for request ${requestId}`);
            } catch (pdfError) {
              Logger.log(`Error saving PDF: ${pdfError.message}`);
            }
            
            // Send task email to IT.
            if (IT_SETUP_EMAIL) {
                const itSetupUrl = ScriptApp.getService().getUrl() + `?view=it&id=${requestId}`;
                const subject = `IT SETUP REQUIRED: New Hire - ${employeeName} at ${siteName}`;
                const body = `The initial Employee Setup for ${employeeName} is complete. Please see the attached summary and use the link below to complete the IT setup process.<br/><br/><a href="${itSetupUrl}" style="background-color: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Complete IT Setup Form</a>`;
                MailApp.sendEmail({ to: IT_SETUP_EMAIL, subject: subject, htmlBody: body, attachments: [pdfBlob] });
            }

            // Send update notification to Requester and Manager.
            const recipients = [requesterEmail];
            if (managerEmail && managerEmail.includes('@')) recipients.push(managerEmail);
            if (recipients.length > 0 && recipients[0]) {
                const requesterSubject = `Update: Employee Setup Complete for ${employeeName} at ${siteName}`;
                const requesterBody = `Hello,<br><br>This is to confirm that the initial setup for ${employeeName} has been completed and the request has been sent to IT for processing.<br/><br>A copy of the request with the setup information is attached for your records.`;
                MailApp.sendEmail({ to: recipients.join(','), subject: requesterSubject, htmlBody: requesterBody, attachments: [pdfBlob] });
            }

            // Send task emails for all required parallel tasks.
            const parallelTasks = getParallelTaskMap();
            parallelTasks.forEach(task => {
                let isTaskRequired = false;
                // Check if the trigger is an array (like for JR/30-60-90).
                if (Array.isArray(task.triggerQuestion)) {
                    isTaskRequired = task.triggerQuestion.some(q => fullRequestData[q] === 'Yes');
                } else {
                    // Original logic for single-trigger tasks.
                    isTaskRequired = (fullRequestData[task.triggerQuestion] === 'Yes');
                }
                
                // If the task is required, send the email.
                if (isTaskRequired) {
                    const taskUrl = ScriptApp.getService().getUrl() + `?view=${task.viewName}&id=${requestId}`;
                    const subject = `ACTION REQUIRED: ${task.formTitle} for ${employeeName} at ${siteName}`;
                    const body = `Please complete the ${task.formTitle} for the new hire, ${employeeName}, using the link below. A summary of the new hire request is attached for your reference.<br/><br/><a href="${taskUrl}" style="background-color: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Complete ${task.formTitle}</a>`;
                    MailApp.sendEmail({ to: task.recipient, subject: subject, htmlBody: body, attachments: [pdfBlob] });
                }
            });

            updateSheetData(sheet, requestId, { 'Post-Processing Status': 'Complete' });
            processed = true;

        } else if (status === 'Pending IT Emails') {
            // --- STAGE 3: After IT completes their setup ---
            checkForCompletion(requestId); // This function will determine the next step.
            updateSheetData(sheet, requestId, { 'Post-Processing Status': 'Complete' });
            processed = true;
        }

      } catch(e) {
        // If an error occurs, log it and mark the row with the error message.
        Logger.log(`Error processing queue for Request ID ${requestId}: ${e.message}`);
        updateSheetData(sheet, requestId, { 'Post-Processing Status': `Error: ${e.message}` });
      }
    }
  }

  // If no rows were processed in this run, disable the trigger.
  if (!processed) {
      const triggers = ScriptApp.getProjectTriggers();
      triggers.forEach(trigger => {
          if (trigger.getHandlerFunction() === 'processQueue') {
              ScriptApp.deleteTrigger(trigger);
          }
      });
  }
}

/**
 * @description Checks if all required sequential and parallel tasks for a request are complete. If so, it advances the workflow.
 * @howItWorks It fetches the request data. First, it checks if the main IT setup is done. Then, it iterates through the `getParallelTaskMap()` configuration. For each task that was triggered ('Yes'), it checks if its corresponding status column is marked 'Complete'. 
 * If all required tasks are done:
 * - If the employee is 'Salary', it changes the status to 'Pending Final HR Approval' and sends a final review email to HR.
 * - If the employee is 'Hourly', it automatically marks the request as 'Completed', updates the sheet, and sends a final completion notification to stakeholders.
 * @output {void}
 */
function checkForCompletion(requestId) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MASTER_SHEET_NAME);
  const data = getRequestData(requestId);
  
  // Exit if data is not found or it's not in the correct workflow state.
  if (!data || data['Workflow Status'] !== 'Pending IT Setup') {
    return;
  }
  
  // Exit if IT has not yet completed their part.
  if (!data['IT - Completion Timestamp']) {
    return;
  }
  
  const parallelTasks = getParallelTaskMap();
  let allTasksComplete = true;

  // Check each parallel task to see if it's complete.
  parallelTasks.forEach(task => {
    // Handle tasks triggered by one of several questions (e.g., JR or 30-60-90).
    if (Array.isArray(task.triggerQuestion)) {
      const oneOfIsRequired = task.triggerQuestion.some(q => data[q] === 'Yes');
      if (oneOfIsRequired) {
        // Check if all status columns for this task group are 'Complete'.
        task.statusColumn.forEach(sc => {
          if (data[sc] !== 'Complete') allTasksComplete = false;
        });
      }
    } else { // Handle tasks triggered by a single question.
      if (data[task.triggerQuestion] === 'Yes') {
        if (data[task.statusColumn] !== 'Complete') {
          allTasksComplete = false;
        }
      }
    }
  });

  // If all required tasks are complete, move to the final stage.
  if (allTasksComplete) {
    const fullRequestData = getRequestData(requestId);
    const employeeName = fullRequestData['First Name'] + ' ' + fullRequestData['Last Name'];
    const siteName = fullRequestData['Site Name'];
    
    // Salaried employees require a manual final approval step.
    if (fullRequestData['Hourly or Salary'] === 'Salary') {
        updateSheetData(sheet, requestId, { 'Workflow Status': 'Pending Final HR Approval' });
        SpreadsheetApp.flush();
        const finalData = getRequestData(requestId);
        
        const finalPdf = generateFinalPdf(finalData);
        const finalApprovalUrl = ScriptApp.getService().getUrl() + `?action=approve&id=${requestId}`;
        const finalDenyUrl = ScriptApp.getService().getUrl() + `?action=deny&id=${requestId}`;
        
        const subject = `FINAL REVIEW: All Setup Tasks Complete for ${employeeName} at ${siteName}`;
        let body = `All required setup tasks for the new hire, ${employeeName}, are now complete. Please review the final attached PDF and provide the final sign-off.<br/><br/>`;
        body += `<a href="${finalApprovalUrl}" style="background-color: #28a745; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Final Approve</a>`;
        body += `&nbsp;&nbsp;<a href="${finalDenyUrl}" style="background-color: #dc3545; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Deny</a>`;

        MailApp.sendEmail({ 
          to: HR_APPROVAL_EMAIL, 
          subject: subject, 
          htmlBody: body,
          attachments: [finalPdf] 
        });
    } else { // Hourly employees are auto-approved at this stage.
        const updateData = { 
          'Workflow Status': 'Completed', 
          'Final Status': 'Completed', 
          'Final Approver Name': 'System - Auto-approved (Hourly)', 
          'Final Approval Timestamp': new Date()
        };
        updateSheetData(sheet, requestId, updateData);
        SpreadsheetApp.flush();
        
        // Send final completion notifications.
        const finalData = getRequestData(requestId);
        if (finalData) {
            const subject = `Request Completed: New Hire ${employeeName} at ${siteName}`;
            const body = `The new hire request for ${employeeName} has been fully processed and completed. The final record is attached.`;
            const finalPdf = generateFinalPdf(finalData);
            
            const requesterEmail = finalData['Requester Email'];
            const managerEmail = finalData['Reporting Manager Email '];
            const recipients = [];
            if (requesterEmail && requesterEmail.includes('@')) recipients.push(requesterEmail);
            if (managerEmail && managerEmail.includes('@')) recipients.push(managerEmail);

            if (recipients.length > 0) {
              MailApp.sendEmail({ to: recipients.join(','), subject: subject, htmlBody: body, attachments: [finalPdf] });
            }
            MailApp.sendEmail({ to: IT_SETUP_EMAIL, subject: subject, htmlBody: body, attachments: [finalPdf] });
        }
    }
  }
}

/**
 * @description Processes the final approval submission from the HR approval form.
 * @howItWorks It takes the approval data (ID, signature, comments), updates the spreadsheet to set the `Workflow Status` and `Final Status` to 'Completed', and records the approver's details. It then generates the final, complete PDF record and emails it to the stakeholders (requester, manager, IT) as a final notification.
 * @output {object} A success object for the client.
 */
function processFinalApproval(approvalData) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MASTER_SHEET_NAME);
  const id = approvalData.approvalId;
  const signature = approvalData.managerSignature;
  const comments = approvalData.additionalComments;
  
  const updateData = { 
    'Workflow Status': 'Completed', 
    'Final Status': 'Completed', 
    'Final Approver Name': signature, 
    'Final Approval Comments': comments,
    'Final Approval Timestamp': new Date()
  };
  updateSheetData(sheet, id, updateData);
  SpreadsheetApp.flush();

  // Send completion notifications.
  const finalData = getRequestData(id);
  if (finalData) {
    const employeeName = finalData['First Name'] + ' ' + finalData['Last Name'];
    const siteName = finalData['Site Name'];
    const subject = `Request Completed: New Hire ${employeeName} at ${siteName}`;
    const body = `The new hire request for ${employeeName} has been fully processed and approved. The final record, including approval details, is attached.`;
    const finalPdf = generateFinalPdf(finalData);
    
    const requesterEmail = finalData['Requester Email'];
    const managerEmail = finalData['Reporting Manager Email '];
    const recipients = [];
    if (requesterEmail && requesterEmail.includes('@')) recipients.push(requesterEmail);
    if (managerEmail && managerEmail.includes('@')) recipients.push(managerEmail);

    if (recipients.length > 0) {
      MailApp.sendEmail({ to: recipients.join(','), subject: subject, htmlBody: body, attachments: [finalPdf] });
    }
    
    MailApp.sendEmail({ to: IT_SETUP_EMAIL, subject: subject, htmlBody: body, attachments: [finalPdf] });
  }

  return { status: 'success' };
}

/**
 * @description Processes the final denial submission from the HR denial form.
 * @howItWorks Similar to `processFinalApproval`, but it sets the `Workflow Status` to 'Denied at Final Review' and the `Final Status` to 'Denied'. It records the denial reason and sends a notification email with the final PDF to stakeholders, informing them of the denial.
 * @output {object} A success object for the client.
 */
function processFinalDenial(denialData) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MASTER_SHEET_NAME);
  const id = denialData.approvalId;
  const signature = denialData.managerSignature;
  const reason = denialData.denialReason;
  
  const updateData = { 
    'Workflow Status': 'Denied at Final Review', 
    'Final Status': 'Denied', 
    'Final Approver Name': signature, 
    'Final Denial Reason': reason,
    'Final Approval Timestamp': new Date() 
  };
  updateSheetData(sheet, id, updateData);
  SpreadsheetApp.flush();

  // Send denial notifications.
  const finalData = getRequestData(id);
  if (finalData) {
    const employeeName = finalData['First Name'] + ' ' + finalData['Last Name'];
    const siteName = finalData['Site Name'];
    const subject = `Request Denied: New Hire ${employeeName} at ${siteName}`;
    const body = `The new hire request for ${employeeName} was denied during the final review. The final record, including denial details, is attached.`;
    const finalPdf = generateFinalPdf(finalData);

    const requesterEmail = finalData['Requester Email'];
    const managerEmail = finalData['Reporting Manager Email '];
    const recipients = [];
    if (requesterEmail && requesterEmail.includes('@')) recipients.push(requesterEmail);
    if (managerEmail && managerEmail.includes('@')) recipients.push(managerEmail);

    if (recipients.length > 0) {
      MailApp.sendEmail({ to: recipients.join(','), subject: subject, htmlBody: body, attachments: [finalPdf] });
    }

    MailApp.sendEmail({ to: IT_SETUP_EMAIL, subject: subject, htmlBody: body, attachments: [finalPdf] });
  }

  return { status: 'success' };
}

/**
 * @description Processes a "Send Back" action from HR, returning the request to the original requester for edits.
 * @howItWorks It updates the `Workflow Status` to 'Sent Back to Requester' and records the reason for the send-back in the 'Approval Notes' column. It then sends an email to the original requester and their manager containing a special link. This link will open the original form, pre-filled with their previous submission, allowing them to make corrections and resubmit.
 * @output {object} A success object for the client.
 */
function processSendBack(feedbackData) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MASTER_SHEET_NAME);
  const id = feedbackData.requestId;
  const reason = feedbackData.reason;
  const updateData = { 'Workflow Status': 'Sent Back to Requester', 'Final Status': 'Pending', 'Approval Notes': reason };
  updateSheetData(sheet, id, updateData);
  
  SpreadsheetApp.flush();
  Utilities.sleep(3000); // Wait for the spreadsheet update to propagate.

  const requestData = getRequestData(id);
  if (!requestData) {
      throw new Error("Failed to retrieve request data after update. Cannot send notification email.");
  }
  
  const requesterEmail = requestData['Requester Email'];
  const managerEmail = requestData['Reporting Manager Email '];
  const recipients = [];
  if (requesterEmail && requesterEmail.includes('@')) recipients.push(requesterEmail);
  if (managerEmail && managerEmail.includes('@')) recipients.push(managerEmail);

  if (recipients.length > 0) {
      const editUrl = ScriptApp.getService().getUrl() + `?id=${id}`;
      const subject = `ACTION REQUIRED: Your Employee Request for ${requestData['First Name']} ${requestData['Last Name']} needs revision`;
      let emailBody = `Your employee request for ${requestData['First Name']} ${requestData['Last Name']} has been sent back for edits.<br/><br/><strong>Reason:</strong><br/><em>${reason}</em><br/><br/>Please click the link below to open the form, make the necessary changes, and resubmit.<br/><br/><a href="${editUrl}" style="background-color: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Edit and Resubmit Request</a>`;
      MailApp.sendEmail({ to: recipients.join(','), subject: subject, htmlBody: emailBody });
  }

  return {status: 'success'};
}

// --- DATA & HELPER FUNCTIONS ---

/**
 * @description Provides a configuration map for all parallel departmental tasks.
 * @howItWorks This function returns an array of objects. Each object defines a parallel task with properties like:
 * - `triggerQuestion`: The exact question title from the form that triggers this task (if the answer is 'Yes'). Can be an array for multiple triggers.
 * - `viewName`: The value used in the URL's `view` parameter to open this task's form.
 * - `recipient`: The email address to send the task notification to.
 * - `formTitle`: The title displayed on the task's web form.
 * - `statusColumn`: The name of the column in the spreadsheet used to track this task's status. Can be an array.
 * - `formFile`: (Optional) The specific HTML file to use for this task's form.
 * @output {Array<object>} An array of configuration objects for parallel tasks.
 */
function getParallelTaskMap() {
  return [
    { triggerQuestion: 'Fleetio / Vehicle', viewName: 'fleetio', recipient: FLEETIO_EMAIL, formTitle: 'Fleetio Setup', statusColumn: 'Fleetio - Status', formFile: 'FleetioForm.html' },
    { triggerQuestion: 'Credit Card', viewName: 'creditcard', recipient: CREDIT_CARD_EMAIL, formTitle: 'Credit Card Request', statusColumn: 'Credit Card - Status', formFile: 'CreditCardForm.html' },
    { triggerQuestion: ['JR', '30-60-90'], viewName: 'jr306090', recipient: JR_306090_EMAIL, formTitle: 'JR / 30-60-90 Plan', statusColumn: ['JR - Status', '30-60-90 - Status'], formFile: 'JR306090Form.html' },
    { triggerQuestion: 'ADP Supervisor Access', viewName: 'adpsupervisor', recipient: ADP_SUPERVISOR_ACCESS_EMAIL, formTitle: 'ADP Supervisor Access', statusColumn: 'ADP Supervisor Access - Status' },
    { triggerQuestion: 'ADP Manager Access', viewName: 'adpaccess', recipient: ADP_MANAGER_ACCESS_EMAIL, formTitle: 'ADP Manager Access', statusColumn: 'ADP Manager Access - Status' },
    { triggerQuestion: 'JONAS', viewName: 'jonas', recipient: JONAS_EMAIL, formTitle: 'JONAS Setup', statusColumn: 'JONAS - Status' },
    { triggerQuestion: 'SiteDocs', viewName: 'sitedocs', recipient: SITEDOCS_EMAIL, formTitle: 'SiteDocs Setup', statusColumn: 'SiteDocs - Status'}
  ];
}

/**
 * @description Prepares a data object to be sent to the client-side JavaScript.
 * @howItWorks It iterates through the properties of a server-side data object. If a property is a JavaScript `Date` object, it converts it into a formatted string ('yyyy-MM-dd HH:mm:ss'). This is necessary because `Date` objects cannot be directly JSON-serialized and sent to the client. Other data types are passed through unchanged.
 * @output {object} A new object with all Date values converted to strings. Returns null if the input is null.
 */
function sanitizeDataForClient(dataObject) {
    if (!dataObject) return null;
    const sanitized = {};
    for (const key in dataObject) {
        if (dataObject[key] instanceof Date) {
            sanitized[key] = Utilities.formatDate(dataObject[key], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
        } else {
            sanitized[key] = dataObject[key];
        }
    }
    return sanitized;
}

/**
 * @description Fetches an image from a given URL and encodes it as a Base64 string.
 * @howItWorks It uses `UrlFetchApp` to retrieve the image file. It then gets the raw bytes of the image and uses `Utilities.base64Encode` to convert them into a Base64 string. This string can be embedded directly into an HTML `<img>` tag's `src` attribute, which is useful for including images in PDFs without relying on external links.
 * @output {string} A data URI string (e.g., 'data:image/jpeg;base64,...') or an empty string on failure.
 */
function getImageAsBase64(url) {
  try {
    const response = UrlFetchApp.fetch(url);
    const blob = response.getBlob();
    const contentType = blob.getContentType();
    const base64 = Utilities.base64Encode(blob.getBytes());
    return `data:${contentType};base64,${base64}`;
  } catch (e) {
    Logger.log(`Failed to fetch or encode image from URL: ${url}. Error: ${e.message}`);
    return '';
  }
}

/**
 * @description Retrieves data from the Job Codes spreadsheet.
 * @howItWorks It opens the spreadsheet specified by `JOB_CODES_SHEET_ID`, gets all the values, and removes the header row (`data.shift()`).
 * @output {Array<Array<string>>} A 2D array of the job code data, or an empty array on error.
 */
function getJobCodeData() {
  try {
    const sheet = SpreadsheetApp.openById(JOB_CODES_SHEET_ID).getSheets()[0];
    const data = sheet.getDataRange().getValues();
    data.shift(); // Remove header row
    return data;
  } catch (e) {
    Logger.log(`Error fetching Job Code Data: ${e.message}`);
    return [];
  }
}

/**
 * @description Reads the structure of the primary Google Form.
 * @howItWorks It uses the `FormApp` service to open the form by its ID. It then iterates through all the items (questions, page breaks, etc.) on the form and extracts key information for each one: its ID, title, type, help text, and choices (for multiple choice, dropdowns, etc.). This allows the web app to build a dynamic HTML form that mirrors the Google Form without hardcoding the questions.
 * @output {Array<object>} An array of objects, where each object represents an item on the Google Form.
 */
function getFormStructure() {
  const form = FormApp.openById(FORM_ID);
  return form.getItems().map(item => ({ id: item.getId(), title: item.getTitle(), type: item.getType().toString(), helpText: item.getHelpText(), choices: (item.getType() === FormApp.ItemType.MULTIPLE_CHOICE || item.getType() === FormApp.ItemType.LIST || item.getType() === FormApp.ItemType.CHECKBOX) ? getChoices(item) : [] }));
}

/**
 * @description Returns a filtered version of the form structure containing only the "Core" questions for the initial requester.
 * @howItWorks It calls `getFormStructure` and then filters out questions that belong to specific departments (HR, IT, Fleetio, Credit Card details, etc.) or are otherwise not needed for the initial request.
 * @output {Array<object>} A filtered array of form items.
 */
function getCoreFormStructure() {
  const fullStructure = getFormStructure();
  const excludedPrefixes = ['HR - ', 'IT - ', 'Fleetio - ', 'Credit Card - ', 'Amazon - ', 'Staples - ', 'HomeDepot - '];
  const excludedTitles = ['Additional Credit/ Purchasing Accounts', 'BOSS User Account', 'Cost Sheet', 'Leader Access', 'Trip Reports Access']; // Specific fields moved to tickets or not needed for requester

  const filtered = fullStructure.filter(item => {
    // Keep Page Breaks to maintain section structure, unless we want to flatten it. Keeping for now.
    if (item.type === 'PAGE_BREAK') return true;
    
    // Exclude based on prefixes
    if (excludedPrefixes.some(prefix => item.title.startsWith(prefix))) return false;
    
    // Exclude specific titles
    if (excludedTitles.includes(item.title)) return false;
    
    return true;
  });
  
  // Prepend gatekeeper question at the start
  const gatekeeperQuestion = {
    id: 'gatekeeper_question',
    title: 'Have all Recruiting Requirements been met?',
    type: 'MULTIPLE_CHOICE',
    choices: ['Yes', 'No']
  };
  
  return [gatekeeperQuestion, ...filtered];
}

/**
 * @description A helper function for `getFormStructure` to extract choices from list-based items.
 * @howItWorks It uses a switch statement based on the item type to call the correct method (`asMultipleChoiceItem`, `asListItem`, etc.) and then maps the choice objects to an array of their string values.
 * @output {Array<string>} An array of choice strings for the given form item.
 */
function getChoices(item) {
    switch(item.getType()) {
        case FormApp.ItemType.MULTIPLE_CHOICE:
            return item.asMultipleChoiceItem().getChoices().map(c => c.getValue());
        case FormApp.ItemType.LIST:
            return item.asListItem().getChoices().map(c => c.getValue());
        case FormApp.ItemType.CHECKBOX:
            return item.asCheckboxItem().getChoices().map(c => c.getValue());
        default:
            return [];
    }
}

/**
 * @description Retrieves all data for a single request from the master spreadsheet, identified by its unique Request ID.
 * @howItWorks It reads the entire data range of the master sheet. It finds the column index for 'Request ID'. Then, it searches row by row for a matching ID. To handle potential delays in data writing to the sheet (eventual consistency), it includes a retry mechanism. If it doesn't find the ID on the first try, it waits 2 seconds and tries again, up to 3 times. Once found, it converts the row array into a more useful key-value pair object using the header row.
 * @output {object} An object where keys are the spreadsheet column headers and values are the data for the found row. Returns null if the ID is not found after all attempts.
 */
function getRequestData(requestId) {
  if (!requestId) return null;

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MASTER_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 1) return null;

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0];
    const idColumnIndex = headers.indexOf('Request ID');

    if (idColumnIndex === -1) {
      Logger.log("Critical Error: 'Request ID' column not found in spreadsheet.");
      return null;
    }

    // Find the row where the Request ID matches.
    const foundRow = allData.slice(1).find(row => {
      const idFromSheet = row[idColumnIndex];
      return idFromSheet && idFromSheet.toString().trim() === requestId.toString().trim();
    });

    if (foundRow) {
      Logger.log(`Successfully found Request ID ${requestId} on attempt #${attempt}.`);
      // Convert the array row into an object.
      const requestObject = {};
      headers.forEach((header, index) => {
        requestObject[header] = foundRow[index];
      });
      return requestObject;
    }

    // If not found, wait and retry.
    if (attempt < maxAttempts) {
      Logger.log(`Attempt #${attempt} failed to find ID ${requestId}. Waiting 2 seconds...`);
      Utilities.sleep(2000);
    }
  }

  Logger.log(`Final Attempt: Could not find Request ID ${requestId} after ${maxAttempts} attempts.`);
  return null;
}

/**
 * @description Appends a new row of data to the spreadsheet.
 * @howItWorks It first gets the header row from the sheet. It then creates a new array (`newRow`) in the same order as the headers, pulling values from the input `data` object. If a header doesn't exist as a key in the `data` object, it inserts an empty string. Finally, it uses `sheet.appendRow()` to add the new data to the bottom of the sheet.
 * @output {void}
 */
function appendDataToSheet(sheet, data) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newRow = headers.map(header => data[header] || '');
  sheet.appendRow(newRow);
}

/**
 * @description Finds a specific row by its Request ID and updates its data.
 * @howItWorks It reads all data from the sheet and finds the row number corresponding to the given `id`. Once the row is found, it iterates through the keys in the `newData` object. For each key that matches a column header, it updates the value in that specific cell (`sheet.getRange(row, column).setValue(...)`). This is more efficient than rewriting the entire row.
 * @output {void}
 */
function updateSheetData(sheet, id, newData) {
  if (!sheet || sheet.getLastRow() < 1) return;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getDataRange().getValues();
  const idColumnIndex = headers.indexOf('Request ID');
  for (let i = 1; i < data.length; i++) {
    const idFromSheet = data[i][idColumnIndex];
    if (idFromSheet && idFromSheet.toString().trim() === id.toString().trim()) {
      const rowToUpdate = i + 1; // +1 because sheet rows are 1-indexed
      headers.forEach((colName, colIndex) => {
        if (newData.hasOwnProperty(colName)) {
          sheet.getRange(rowToUpdate, colIndex + 1).setValue(newData[colName]);
        }
      });
      break; // Stop searching once the row is found and updated
    }
  }
}

/**
 * @description Generates a PDF summary of the initial requester's submission.
 * @howItWorks It builds an HTML string containing a table. It iterates through the questions from the form structure and finds the corresponding answers in the `data` object, creating a table row for each question/answer pair. It embeds the company logo (as a Base64 string) and applies basic styling. Finally, it uses `Utilities.newBlob()` to convert the HTML string into a PDF file blob.
 * @output {Blob} A PDF file as a Google Apps Script Blob object, ready to be attached to an email.
 */
function generateRequesterPdf(data) {
  const employeeName = data['First Name'] + ' ' + data['Last Name'];
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss');
  const fileName = `Employee Request - ${employeeName} - ${timestamp}.pdf`;
  let tableRows = '';
  const structure = getFormStructure();
  structure.forEach(item => {
    const question = item.title;
    let value = data[question];
    if (value instanceof Date) {
        value = Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    }
    if (value && value !== '' && item.type !== 'PAGE_BREAK') {
      tableRows += `<tr><td class="question-cell">${question}</td><td class="answer-cell">${value}</td></tr>`;
    }
  });

  const submissionTimestamp = data['Submission Timestamp'] instanceof Date ? Utilities.formatDate(data['Submission Timestamp'], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss") : data['Submission Timestamp'];
  if (submissionTimestamp) {
      tableRows += `<tr class="timestamp-row" style="background-color:#f2f2f2; font-style: italic; color: #555;"><td colspan="2"><strong>Submitted on:</strong> ${submissionTimestamp}</td></tr>`;
  }
  
  // const logoBase64 = getImageAsBase64(LOGO_URL);
  let htmlBody = `<html><head><style>body { font-family: Arial, sans-serif; text-align: center; } h1, h2 { color: #EB1C2D; } table { width: 100%; border-collapse: collapse; margin-bottom: 20px; text-align: left; } td { border: 1px solid #ccc; padding: 8px; } .question-cell { font-weight: bold; width: 35%; }</style></head><body>
    
    <h1>New Employee Request: ${employeeName}</h1><h2>Employee Request Information</h2><table>${tableRows}</table></body></html>`;
  return Utilities.newBlob(htmlBody, 'text/html', fileName).getAs('application/pdf');
}

/**
 * @description Generates a comprehensive PDF summary of the entire request, including data from all stages (Requester, HR, IT, Parallel Tasks, Final Approval).
 * @howItWorks It builds a more complex HTML string with multiple sections and tables. It organizes the data by workflow stage (Request, HR Setup, IT Setup, etc.). It has specific logic to find and display details for certain parallel tasks (like Fleetio asset numbers or credit card details). It also includes a final approval/denial section if the request is complete. This complete HTML document is then converted into a PDF blob.
 * @output {Blob} A PDF file as a Google Apps Script Blob object.
 */
function generateFinalPdf(data) {
  const employeeName = data['First Name'] + ' ' + data['Last Name'];
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss');
  const fileName = `Employee Request Final - ${employeeName} - ${timestamp}.pdf`;
  let requesterRows = '', hrRows = '', itRows = '', finalApprovalRows = '', parallelTaskRows = '';
  
  const allQuestions = getFormStructure().map(item => item.title);
  
  // --- Requester Info Section ---
  const requesterQuestions = allQuestions.filter(q => data[q] && !q.startsWith('HR - ') && !q.startsWith('IT - '));
  requesterQuestions.forEach(q => {
      let value = data[q];
      if (value instanceof Date) { value = Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"); }
      requesterRows += `<tr><td class="question-cell">${q}</td><td class="answer-cell">${value}</td></tr>`;
  });
  
  // --- HR Info Section ---
  const hrFields = [
      'Temporary ID', 'HR - SiteDocs Worker ID', 'HR - DSS Username', 'HR - DSS Password',
      'HR - Employee assigned to WIS module?', 'HR - Additional Comments', 'HR - Team Member Name', 
      'HR - Date of Submission', 'HR - SiteDocs Training Username', 'HR - SiteDocs Training Password'
  ];
  hrFields.forEach(field => { 
      let value = data[field];
      if (value instanceof Date) { value = Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"); }
      if (value && value !== '') { hrRows += `<tr><td class="question-cell">${field.replace('HR - ', '')}</td><td class="answer-cell">${value}</td></tr>`; }
  });

  // --- IT Info Section ---
  const itFields = [
    'IT - BOSS User Account', 'IT - Cost Sheet', 'IT - Leader Access', 'IT - Trip Reports Access',
    'IT - Incidents', 'IT - CAA', 'IT - Transform', 'IT - Net Promoter Score', 'IT - Delivery App', 'IT - E-Business Card',
    'IT - Google Account Email', 'IT - Google Account Password', 'IT - Phone Number', 'IT - Phone Voicemail Password',
    'IT - Computer Model', 'IT - Computer Serial Number'
  ];
  itFields.forEach(field => {
    let value = data[field];
    if (value && value !== '') { itRows += `<tr><td class="question-cell">${field.replace('IT - ', '')}</td><td class="answer-cell">${value}</td></tr>`; }
  });
  
  // --- Parallel Tasks Section ---
  const parallelTaskMap = getParallelTaskMap();
  parallelTaskMap.forEach(task => {
    const statusColumns = Array.isArray(task.statusColumn) ? task.statusColumn : [task.statusColumn];
    statusColumns.forEach(sc => {
      const taskName = sc.replace(' - Status', '');
      const status = data[sc];
      if(status) {
          parallelTaskRows += `<tr><td class="question-cell">${taskName}</td><td class="answer-cell">${status}</td></tr>`;
          
          // Add specific sub-details for certain tasks.
          if (taskName === 'Fleetio') {
            const fleetioDetails = ['Fleetio - Asset Number', 'Fleetio - Vehicle Make', 'Fleetio - Vehicle Model', 'Fleetio - License Plate'];
            fleetioDetails.forEach(detail => {
              if(data[detail]) {
                parallelTaskRows += `<tr><td class="question-cell" style="padding-left: 30px;">${detail.replace('Fleetio - ', '')}</td><td class="answer-cell">${data[detail]}</td></tr>`;
              }
            });
          }

          if (taskName === 'Credit Card') {
            const cardDetails = ['Credit Card - Limit', 'Credit Card - Currency', 'Credit Card - Per', 'Credit Card - Spend Dynamics Username', 'Credit Card - Spend Dynamics Password', 'Amazon - Username / Number', 'Amazon - Password / PIN', 'Staples - Username / Number', 'Staples - Password / PIN', 'HomeDepot - Card Number', 'HomeDepot - PIN'];
            cardDetails.forEach(detail => {
              if(data[detail]) {
                parallelTaskRows += `<tr><td class="question-cell" style="padding-left: 30px;">${detail.replace('Credit Card - ', '').replace('Amazon - ', 'Amazon: ').replace('Staples - ', 'Staples: ').replace('HomeDepot - ', 'HomeDepot: ')}</td><td class="answer-cell">${data[detail]}</td></tr>`;
              }
            });
          }

          // Add completion timestamp for the task.
          const taskTimestamp = data[`${taskName} - Timestamp`];
          if (taskTimestamp) {
            const formattedTimestamp = (taskTimestamp instanceof Date) ? Utilities.formatDate(taskTimestamp, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss") : taskTimestamp;
            parallelTaskRows += `<tr class="timestamp-row" style="background-color:#f9f9f9;"><td colspan="2"><strong>Completed on:</strong> ${formattedTimestamp}</td></tr>`;
          }
      }
    });
  });

  // --- Final Approval Section ---
  if (data['Final Status'] === 'Completed' || data['Final Status'] === 'Denied') {
    const statusLabel = data['Final Status'] === 'Completed' ? 'Approval' : 'Denial';
    finalApprovalRows += `<tr><td class="question-cell">Approver Name</td><td class="answer-cell">${data['Final Approver Name'] || ''}</td></tr>`;
    if(data['Final Approval Comments']) {
      finalApprovalRows += `<tr><td class="question-cell">Comments</td><td class="answer-cell">${data['Final Approval Comments']}</td></tr>`;
    }
    if(data['Final Denial Reason']) {
       finalApprovalRows += `<tr><td class="question-cell">Denial Reason</td><td class="answer-cell">${data['Final Denial Reason']}</td></tr>`;
    }
    const finalTimestamp = data['Final Approval Timestamp'];
    if (finalTimestamp) {
        const formattedTimestamp = (finalTimestamp instanceof Date) ? Utilities.formatDate(finalTimestamp, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss") : finalTimestamp;
        finalApprovalRows += `<tr class="timestamp-row"><td colspan="2"><strong>${statusLabel} on:</strong> ${formattedTimestamp}</td></tr>`;
    }
  }

  // --- Assemble the final HTML body ---
  let htmlBody = `<html><head><style>body { font-family: Arial, sans-serif; text-align: center;} h1, h2 { color: #EB1C2E; } table { width: 100%; border-collapse: collapse; margin-bottom: 20px; text-align: left;} td { border: 1px solid #ccc; padding: 8px; } .question-cell { font-weight: bold; width: 35%; } .timestamp-row td { background-color: #f2f2f2; font-style: italic; color: #555; }</style></head><body>
    
    <h1>New Employee Request: ${employeeName}</h1>`;
    
  const submissionTimestamp = data['Submission Timestamp'] instanceof Date ? Utilities.formatDate(data['Submission Timestamp'], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss") : data['Submission Timestamp'];
  if (requesterRows) {
    if (submissionTimestamp) { requesterRows += `<tr class="timestamp-row"><td colspan="2"><strong>Submitted on:</strong> ${submissionTimestamp}</td></tr>`; }
    htmlBody += `<h2>Employee Request Information</h2><table>${requesterRows}</table>`;
  }
  
  const hrTimestamp = data['HR - Date of Submission'] instanceof Date ? Utilities.formatDate(data['HR - Date of Submission'], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss") : data['HR - Date of Submission'];
  if (hrRows) {
    if (hrTimestamp) { hrRows += `<tr class="timestamp-row"><td colspan="2"><strong>Completed on:</strong> ${hrTimestamp}</td></tr>`; }
    htmlBody += `<h2>Employee Setup Information</h2><table>${hrRows}</table>`;
  }
  
  const itTimestamp = data['IT - Completion Timestamp'] instanceof Date ? Utilities.formatDate(data['IT - Completion Timestamp'], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss") : data['IT - Completion Timestamp'];
  if (itRows) {
    if (itTimestamp) { itRows += `<tr class="timestamp-row"><td colspan="2"><strong>Completed on:</strong> ${itTimestamp}</td></tr>`; }
    htmlBody += `<h2>IT: System Setup Information</h2><table>${itRows}</table>`;
  }

  if (parallelTaskRows) {
    htmlBody += `<h2>Departmental Setup Tasks</h2><table>${parallelTaskRows}</table>`;
  }
  
  if (finalApprovalRows) {
    htmlBody += `<h2>Final Approval Status</h2><table>${finalApprovalRows}</table>`;
  }

  htmlBody += `</body></html>`;
  return Utilities.newBlob(htmlBody, 'text/html', fileName).getAs('application/pdf');
}

// --- STANDALONE FORM HANDLERS ---

/**
 * @description Renders a standalone form (e.g., Credit Card, Fleetio) that can be accessed without a parent request.
 * @howItWorks Takes a form type (e.g., 'creditcard', 'fleetio') and looks it up in the parallel task map. Renders the appropriate form HTML with isStandalone=true flag so the form knows to collect employee details.
 * @output {HtmlService.HtmlOutput} The standalone form HTML page.
 */
function showStandaloneForm(type) {
  const parallelTasks = getParallelTaskMap();
  const task = parallelTasks.find(t => t.viewName === type);
  
  if (!task) {
    return HtmlService.createHtmlOutput(`Invalid form type: ${type}`);
  }
  
  const templateData = {
    isStandalone: true,
    formTitle: task.formTitle,
    formType: type,
    statusColumn: task.statusColumn
  };
  
  const formFile = task.formFile || 'ParallelTaskForm.html';
  return showPage(formFile, task.formTitle, templateData);
}

/**
 * @description Handles submission from standalone forms (forms accessed without a parent request).
 * @howItWorks Creates a new row in the Master Sheet with:
 * - Its own unique Request ID (e.g., CC-REQ-123456)
 * - No Parent Request ID (standalone requests don't have a parent)
 * - Workflow Status set to "Standalone - [Form Type]"
 * - The specific task status column set to 'Complete' or user-provided value
 * @output {object} Success response with the new Request ID.
 */
function handleStandaloneSubmission(formData) {
  Logger.log('handleStandaloneSubmission received: ' + JSON.stringify(formData));
  
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MASTER_SHEET_NAME);
  const formType = formData.formType || 'unknown';
  const timestamp = new Date();
  
  // Generate a unique Request ID for this standalone request
  const requestId = `${formType.toUpperCase()}-REQ-${timestamp.getTime()}`;
  
  // Prepare the data object
  const newRequestData = {
    'Request ID': requestId,
    'Parent Request ID': '', // No parent for standalone requests
    'Workflow Status': `Standalone - ${formData.formTitle || formType}`,
    'Submission Timestamp': timestamp,
    'Requester Email': formData['Requester Email'] || '',
    'First Name': formData['First Name'] || '',
    'Last Name': formData['Last Name'] || '',
    'Department': formData['Department'] || '',
    'Reporting Manager': formData['Reporting Manager'] || ''
  };
  
  // Set the specific task status column
  const statusColumn = formData.statusColumn;
  if (statusColumn) {
    const statusValue = formData.statusValue || 'Complete';
    if (Array.isArray(statusColumn)) {
      // Handle multi-status columns (e.g., JR/30-60-90)
      statusColumn.forEach(col => {
        newRequestData[col] = formData[col] || statusValue;
        const timestampCol = col.replace('Status', 'Timestamp').trim();
        newRequestData[timestampCol] = timestamp;
      });
    } else {
      newRequestData[statusColumn] = statusValue;
      const timestampColumn = statusColumn.replace('Status', 'Timestamp').trim();
      newRequestData[timestampColumn] = timestamp;
    }
  }
  
  // Copy any other task-specific data (e.g., credit card limit, vehicle details)
  for (const key in formData) {
    if (!newRequestData.hasOwnProperty(key) && 
        key !== 'formType' && 
        key !== 'formTitle' && 
        key !== 'statusColumn' && 
        key !== 'statusValue' &&
        key !== 'isStandalone') {
      newRequestData[key] = formData[key];
    }
  }
  
  Logger.log('Creating standalone request with ID: ' + requestId);
  appendDataToSheet(sheet, newRequestData);
  SpreadsheetApp.flush();
  
  return { status: 'success', requestId: requestId };
}

// --- HELPER FUNCTIONS FOR doGet ROUTER ---

/**
 * @description Renders and returns an HTML page from a template file.
 * @howItWorks It uses `HtmlService.createTemplateFromFile()` to load an HTML file. It can inject server-side data (like `logoUrl` or `requestId`) into the template. The `template.evaluate()` method processes the template and returns an `HtmlOutput` object that can be sent to the user's browser. It also sets standard properties like the page title and X-Frame options.
 * @output {HtmlService.HtmlOutput} The final HTML page to be displayed.
 */
function showPage(filename, title, data) {
  const template = HtmlService.createTemplateFromFile(filename);
  // Make the logo URL available in all HTML templates.
  template.logoUrl = CONFIG.LOGO_URL;
  // Pass any additional data to the template.
  if (data) {
    for (const key in data) {
      template[key] = data[key];
    }
  }
  const output = template.evaluate().setTitle(title);
  // Set security options for embedding.
  output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
  // Add mobile-friendly viewport meta tag for the main form.
  if (filename === 'Index.html') {
    output.addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  }
  return output;
}

/**
 * @description Renders a generic "Closed" or "Invalid State" page.
 * @howItWorks It uses the `Closed.html` template, passing the current `status` of the request to be displayed to the user. This is a catch-all page for when a user tries to access a URL that is no longer valid for the request's current state.
 * @output {HtmlService.HtmlOutput} The "Closed" HTML page.
 */
function showClosedPage(status) {
  const template = HtmlService.createTemplateFromFile('Closed.html');
  template.logoUrl = CONFIG.LOGO_URL;
  template.status = status;
  return template.evaluate().setTitle('Request Closed');
}
