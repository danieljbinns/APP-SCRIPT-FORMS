/**
 * Dashboard Handler for V2
 * Visualizes the Workflows master sheet with smart status tracking
 */

function serveDashboard() {
  const template = HtmlService.createTemplateFromFile('Dashboard');
  template.baseUrl = getBaseUrl(); // Pass server-side URL to client
  template.spreadsheetId = CONFIG.SPREADSHEET_ID; // Pass active Sheet ID
  template.environment = typeof ENVIRONMENT !== 'undefined' ? ENVIRONMENT : 'PROD';
  return template.evaluate()
    .setTitle('Employee Onboarding Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function serveWorkflowMap() {
  return HtmlService.createTemplateFromFile('WorkflowMap').evaluate()
    .setTitle('Onboarding Process Map')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function serveDataManager() {
  return HtmlService.createTemplateFromFile('DataManager')
    .evaluate()
    .setTitle('Data Manager - Employee Onboarding')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');

}

function serveRequestDetails(workflowId) {
  const template = HtmlService.createTemplateFromFile('RequestDetails');
  template.baseUrl = getBaseUrl();
  template.workflowId = workflowId || ''; 
  return template.evaluate()
    .setTitle('Request Details')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Get all workflows exactly as pre-calculated in the Dashboard_View sheet
 * Time to Interactive: < 0.2s
 */
function getDashboardData() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const viewSheet = ss.getSheetByName(CONFIG.SHEETS.DASHBOARD_VIEW);
    
    if (!viewSheet) {
      return { success: false, message: 'Dashboard_View sheet not found. Please run Setup.' };
    }
    
    const userEmail = Session.getActiveUser().getEmail();
    
    // Read the flat materialized view (Extremely Fast)
    const data = viewSheet.getDataRange().getValues();
    
    if (data.length <= 1) {
       return { success: true, workflows: [], currentUser: userEmail };
    }
    
    const viewRows = data.slice(1);
    
    const flows = viewRows.map(row => {
        // Map headers to expected JSON structure:
        // Force strings to avoid [Ljava.lang.Object; serialization failures over HtmlService boundary
        let items = {};
        try { if (row[10]) items = JSON.parse(String(row[10])); } catch(e) {}
        
        return {
           id: String(row[0] || ''),
           employee: String(row[1] || ''),
           status: String(row[2] || ''),
           step: String(row[3] || ''),
           requesterName: String(row[4] || ''),
           requesterEmail: String(row[5] || ''),
           initiator: String(row[6] || ''),
           dateRequested: row[7] instanceof Date ? row[7].toLocaleDateString() : String(row[7] || ''),
           lastUpdated: row[8] instanceof Date ? row[8].toLocaleString() : String(row[8] || ''),
           managerEmail: String(row[9] || ''),
           requestedItems: items,
           pendingItems: [] // Legacy compat
        };
    }).filter(wf => AccessControlService.canAccessWorkflow(userEmail, wf)).reverse();
    
    return JSON.stringify({
      success: true,
      workflows: flows,
      currentUser: userEmail
    });
    
  } catch (error) {
    Logger.log('Dashboard Error: ' + error.toString());
    return JSON.stringify({ success: false, message: error.message });
  }
}

// Helper to get Set of workflow IDs that have completed a specific form
/**
 * Actions: Bump & Cancel
 */

function bumpRequest(workflowId, targetStep) {
  try {
    const user = Session.getActiveUser().getEmail();
    Logger.log(`Bump requested for ${workflowId} (Target: ${targetStep}) by ${user}`);
    
    // Determine recipient based on targetStep
    let recipient = '';
    let subject = 'Reminder: Action Required for Employee Onboarding';
    let formType = '';
    
    // Logic to find correct recipient and form URL re-generation would happen here
    // In a real system, we'd look up the specific contact from Config
    // For MVP, we map targets to roles
    
    switch (targetStep) {
        case 'id_setup': recipient = CONFIG.EMAILS.IT || 'IT Team'; formType = 'ID Setup'; break;
        case 'hr_verification': recipient = CONFIG.EMAILS.HR || 'HR Team'; formType = 'HR Verification'; break;
        case 'it_setup': recipient = CONFIG.EMAILS.IT || 'IT Team'; formType = 'IT Setup'; break;
        case 'jonas': recipient = CONFIG.EMAILS.JONAS; formType = 'Jonas Setup'; break;
        case 'credit_card': recipient = CONFIG.EMAILS.CREDIT_CARD; formType = 'Credit Card Setup'; break;
        case 'fleetio': recipient = CONFIG.EMAILS.FLEETIO; formType = 'Fleetio Setup'; break;
        case 'business_cards': recipient = CONFIG.EMAILS.BUSINESS_CARDS; formType = 'Business Cards'; break;
        case 'sitedocs': recipient = CONFIG.EMAILS.IDSETUP; formType = 'SiteDocs Setup'; break;
        case 'review': recipient = CONFIG.EMAILS.REVIEW_306090_JR; formType = '30/60/90 Setup'; break;
        default: recipient = 'Assignee'; formType = 'General';
    }
    
    // Implement actual email sending
    if (recipient && recipient.includes('@')) {
       try {
         // Generate specific form URL
         let specificUrl = getBaseUrl() + '?form=dashboard'; // Default
         if (formType === 'ID Setup') specificUrl = buildFormUrl('id_setup', { id: workflowId });
         else if (formType === 'HR Verification') specificUrl = buildFormUrl('hr_verification', { id: workflowId });
         else if (formType === 'IT Setup') specificUrl = buildFormUrl('it_setup', { id: workflowId });
         else if (['Jonas Setup', 'Credit Card Setup', 'Fleetio Setup', 'Business Cards', 'SiteDocs Setup', '30/60/90 Setup'].includes(formType)) {
             // Extract param from switch above or re-map
             const map = {
                 'Jonas Setup': 'jonas', 'Credit Card Setup': 'creditcard', 'Fleetio Setup': 'fleetio',
                 'Business Cards': 'businesscards', 'SiteDocs Setup': 'sitedocs', '30/60/90 Setup': 'review'
             };
             if (map[formType]) specificUrl = buildFormUrl('specialist', { wf: workflowId, dept: map[formType] });
         }

         sendFormEmail({
           to: recipient,
           subject: subject + ': ' + (workflowId || ''),
           body: `ACTION REQUIRED: ${formType}\n\n` +
                 `A request for ${formType} regarding employee onboarding is pending your action.\n\n` +
                 `Request ID: ${workflowId}\n` + 
                 `\nPlease complete this task using the link below:\n\n` +
                 `Link: ${specificUrl}`,
           formUrl: specificUrl,
           displayName: 'TEAM Group - Onboarding'
         });
         return { success: true, message: `Reminder sent to ${recipient}` };
       } catch (emailErr) {
         Logger.log('Email send failed: ' + emailErr.toString());
         return { success: false, message: 'Failed to send email: ' + emailErr.message };
       }
    }
    
    // Fallback for non-email targets (e.g. "Assignee")
    return { success: true, message: `Bump recorded for ${formType} (No specific email configured)` };
    
  } catch (error) {
    return { success: false, message: error.message };
  }
}

function cancelRequest(workflowId) {
  try {
    const user = Session.getActiveUser().getEmail();
    Logger.log(`Cancel requested for ${workflowId} by ${user}`);
    
    // Update status to Cancelled
    updateWorkflow(workflowId, 'Cancelled', 'Request Cancelled', '');
    
    return { success: true, message: 'Request cancelled successfully' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Get Full Details for Modal
 * Returns a "Flight Check" status list of every required form
 */
function getRequestDetails(workflowId) {
  try {
     if (!workflowId) return { success: false, message: 'No workflow ID provided' };
     
     const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
     const context = { success: true, id: workflowId, checklist: [] };
     
     // 1. Initial Request Data (The Source of Truth for what is needed)
     const reqSheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
     if (!reqSheet) return { success: false, message: 'Initial Requests sheet missing' };
     
     const foundReq = reqSheet.getRange("A:A").createTextFinder(workflowId).matchEntireCell(true).findNext();
     if (!foundReq) return { success: false, message: 'Request ID not found in database' };
     
     const reqRowIndex = foundReq.getRow();
     const reqLastCol = reqSheet.getLastColumn();
     const reqHeaders = reqSheet.getRange(1, 1, 1, reqLastCol).getValues()[0];
     const reqRow = reqSheet.getRange(reqRowIndex, 1, 1, reqLastCol).getValues()[0];
     
     const r = {}; 
     // Safer mapping: Ensure no undefined values which break google.script.run serialization
     reqHeaders.forEach((h, i) => {
       if (h) {
         const val = reqRow[i];
         if (val instanceof Date) {
           r[h] = val.toString();
         } else if (val === undefined || val === null) {
           r[h] = '';
         } else {
           r[h] = String(val);
         }
       }
     });

     // MERGE HR VERIFIED DATA
     const hrSheet = ss.getSheetByName(CONFIG.SHEETS.HR_VERIFICATION_RESULTS);
     if (hrSheet) {
         const foundHr = hrSheet.getRange("A:A").createTextFinder(workflowId).matchEntireCell(true).findNext();
         if (foundHr) {
             const hrRow = hrSheet.getRange(foundHr.getRow(), 1, 1, hrSheet.getLastColumn()).getValues()[0];
             // Verified Title is Col H (7)
             const vTitle = hrRow[7];
             if (vTitle) {
                 // Check if it looks like "Title / JR" and parse, or just use whole string
                 if (vTitle.includes(' / ')) {
                     r['Position Title'] = vTitle.split(' / ')[0]; // Override
                 } else {
                     r['Position Title'] = vTitle;
                 }
                 r['HR Verified Title'] = vTitle; // Keep raw
             }
         }
     }

     // MERGE IT DATA (Computer/Phone)
     const itSheet = ss.getSheetByName(CONFIG.SHEETS.IT_RESULTS);
     if (itSheet) {
         const foundIt = itSheet.getRange("A:A").createTextFinder(workflowId).matchEntireCell(true).findNext();
         if (foundIt) {
             const itRow = itSheet.getRange(foundIt.getRow(), 1, 1, itSheet.getLastColumn()).getValues()[0];
             if (itRow[6] && itRow[6] !== 'N/A') r['Computer Assigned'] = itRow[6];
             if (itRow[10] && itRow[10] !== 'N/A') r['Phone Assigned'] = itRow[10];
             if (itRow[4] && itRow[4] !== 'N/A') r['Email Assigned'] = itRow[4];
         }
     }

     context.requestData = r; // Store raw data
     
     // 2. Build the "Flight Check" List
     // We check each stage directly against Result sheets
     
     const checklist = [];
     
     // Helper to check result sheet
     const checkSheet = (sheetName, target) => {
         // Should return default object if sheet doesn't exist to avoid crashes
         try {
           const sheet = ss.getSheetByName(sheetName);
           if (!sheet) return { status: 'Pending', target: target, details: 'Sheet missing' }; // Treat missing sheet as pending/not done
           
           const found = sheet.getRange("A:A").createTextFinder(workflowId).matchEntireCell(true).findNext();
           if (found) {
               const rowData = sheet.getRange(found.getRow(), 1, 1, sheet.getLastColumn()).getValues()[0];
               const submittedBy = rowData.length > 0 ? rowData[rowData.length - 1] : 'Unknown';
               const timestamp = rowData[2] instanceof Date ? rowData[2].toLocaleString() : String(rowData[2]);
               return { status: 'Complete', by: submittedBy, time: timestamp };
           }
           return { status: 'Pending', target: target };
         } catch (e) {
           return { status: 'Error', details: e.message };
         }
     };
     
     // -- Stage 1: Initial Request --
     checklist.push({
         name: "Initial Request",
         status: "Complete",
         by: r['Requester Email'] || 'Unknown',
         time: r['Submission Timestamp'] instanceof Date ? r['Submission Timestamp'].toLocaleString() : String(r['Submission Timestamp'])
     });
     
     // -- Stage 2: ID Setup --
     checklist.push({ name: "ID Setup", ...checkSheet(CONFIG.SHEETS.ID_SETUP_RESULTS, 'id_setup') });
     
     // -- Stage 3: HR Verification --
     checklist.push({ name: "HR Verification", target: "hr_verification", ...checkSheet(CONFIG.SHEETS.HR_VERIFICATION_RESULTS, 'hr_verification') });
     
     // -- Stage 4: IT Setup --
     // Check if IT Setup is REQUIRED based on request data first
     const sysAccessVal = r['System Access'] || '';
     const empType = r['Employment Type'] || '';
     const eqp = r['Equipment'] || '';
     const sysReq = r['Systems'] || '';
     
     const needsIT = sysAccessVal === 'Yes' && (
      (r['Google Email'] && r['Google Email'] !== '') ||
      (eqp.includes('Computer') || eqp.includes('Phone')) ||
      (sysReq.includes('BOSS') || sysReq.includes('Delivery App') || sysReq.includes('Net Promoter'))
     );
     
     // Hourly employees without system access skip IT
     const isHourlyNoAccess = (empType === 'Hourly' && sysAccessVal === 'No');
     
     // Get IT Sheet Data
     const itSheetData = checkSheet(CONFIG.SHEETS.IT_RESULTS, 'it_setup');
     
     // Override IT status if implicitly not needed & not yet completed
     if (itSheetData.status === 'Pending' && (isHourlyNoAccess || !needsIT)) {
         itSheetData.status = 'N/A';
     }
     
     checklist.push({ name: "IT Setup", target: "it_setup", ...itSheetData });
     
     // -- Stage 5: Specialists (Conditional) --
     
     // -- Stage 5: Specialists (Conditional) --
     
     // Jonas
     const jonasData = checkSheet(CONFIG.SHEETS.JONAS_RESULTS, 'jonas');
     if (!(r['Jonas Job Numbers'] && r['Jonas Job Numbers'].toString().length > 0) && jonasData.status === 'Pending') {
         jonasData.status = 'N/A';
     }
     checklist.push({ name: "Jonas Setup", target: "jonas", ...jonasData });
     
     // Credit Card (Check multiple versions of Yes)
     const ccUsa = r['Credit Card (USA)'];
     const ccCan = r['Credit Card (Canada)'];
     const ccHd = r['Credit Card (Home Depot)'];
     const ccData = checkSheet(CONFIG.SHEETS.CREDIT_CARD_RESULTS, 'credit_card');
     if (!((ccUsa === 'Yes') || (ccCan === 'Yes') || (ccHd === 'Yes')) && ccData.status === 'Pending') {
         ccData.status = 'N/A';
     }
     checklist.push({ name: "Credit Card", target: "creditcard", ...ccData });
     
     // Fleetio
     const sysAccess = r['Systems'] || '';
     const fleetioData = checkSheet(CONFIG.SHEETS.FLEETIO_RESULTS, 'fleetio');
     if (!sysAccess.includes('Fleetio') && fleetioData.status === 'Pending') {
         fleetioData.status = 'N/A';
     }
     checklist.push({ name: "Fleetio", target: "fleetio", ...fleetioData });
     
     // Business Cards
     const bcData = checkSheet(CONFIG.SHEETS.BUSINESS_CARDS_RESULTS, 'business_cards');
     if (!sysAccess.includes('Business Cards') && bcData.status === 'Pending') {
         bcData.status = 'N/A';
     }
     checklist.push({ name: "Business Cards", target: "businesscards", ...bcData });
     
     // SiteDocs
     const sdData = checkSheet(CONFIG.SHEETS.SITEDOCS_RESULTS, 'sitedocs');
     if (!(sysAccess.includes('SiteDocs') || eqp.includes('SiteDocs Tablet')) && sdData.status === 'Pending') {
         sdData.status = 'N/A';
     }
     checklist.push({ name: "SiteDocs", target: "sitedocs", ...sdData });
     
     // 30/60/90
     const reviewData = checkSheet(CONFIG.SHEETS.REVIEW_306090_RESULTS, 'review');
     if (!(reqRow && reqRow[47] === 'Yes') && reviewData.status === 'Pending') {
         reviewData.status = 'N/A';
     }
     checklist.push({ name: "30/60/90 Review", target: "review", ...reviewData });
     
     const userEmail = Session.getActiveUser().getEmail();
     context.isAdmin = (userEmail === 'dbinns@team-group.com' || userEmail === 'dbinns@robinsonsolutions.com');
     
     context.checklist = checklist;
     return context;
     
  } catch (e) {
    Logger.log('getRequestDetails Fatal Error: ' + e.toString());
    return { success: false, message: 'Server logical error: ' + e.message };
  }
}

/**
 * Fetch specific step data for the drill-down view
 */
function getStepResultData(workflowId, stepTarget) {
  try {
     const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
     let sheetName = '';
     
     switch(stepTarget) {
         case 'initial_request': sheetName = CONFIG.SHEETS.INITIAL_REQUESTS; break;
         case 'id_setup': sheetName = CONFIG.SHEETS.ID_SETUP_RESULTS; break;
         case 'hr_verification': sheetName = CONFIG.SHEETS.HR_VERIFICATION_RESULTS; break;
         case 'it_setup': sheetName = CONFIG.SHEETS.IT_RESULTS; break;
         case 'jonas': sheetName = CONFIG.SHEETS.JONAS_RESULTS; break;
         case 'credit_card': sheetName = CONFIG.SHEETS.CREDIT_CARD_RESULTS; break;
         case 'fleetio': sheetName = CONFIG.SHEETS.FLEETIO_RESULTS; break;
         case 'business_cards': sheetName = CONFIG.SHEETS.BUSINESS_CARDS_RESULTS; break;
         case 'sitedocs': sheetName = CONFIG.SHEETS.SITEDOCS_RESULTS; break;
         case 'review': sheetName = CONFIG.SHEETS.REVIEW_306090_RESULTS; break;
         default: return {};
     }
     
     const sheet = ss.getSheetByName(sheetName);
     if (!sheet) return {};
     
     const data = sheet.getDataRange().getValues();
     const headers = data[0];
     
     const found = sheet.getRange("A:A").createTextFinder(workflowId).matchEntireCell(true).findNext();
     if (!found) return {};
     
     const row = sheet.getRange(found.getRow(), 1, 1, sheet.getLastColumn()).getValues()[0];
     
     const result = {};
     headers.forEach((h, i) => {
        let val = row[i];
        if (val instanceof Date) val = val.toLocaleString();
        result[h] = String(val);
     });
     
     return result;
     
  } catch (e) {
    Logger.log('Error getting step data: ' + e.toString());
    return { 'Error': e.message };
  }
}
