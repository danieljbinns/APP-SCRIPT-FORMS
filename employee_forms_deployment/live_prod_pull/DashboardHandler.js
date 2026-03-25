/**
 * Dashboard Handler for V2
 * Visualizes the Workflows master sheet with smart status tracking
 */

function serveDashboard() {
  const template = HtmlService.createTemplateFromFile('Dashboard');
  template.baseUrl = getBaseUrl(); // Pass server-side URL to client
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
 * Get all workflows with enhanced context and status
 */
function getDashboardData() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const workflowSheet = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
    const requestSheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
    
    if (!workflowSheet || !requestSheet) {
      return { success: false, message: 'Required sheets not found' };
    }
    
    // Get Workflow Data
    const wfData = workflowSheet.getDataRange().getValues();
    const wfHeaders = wfData[0];
    const wfRows = wfData.slice(1);
    
    // Get Request Data (for specific details not in workflow sheet)
    const reqData = requestSheet.getDataRange().getValues();
    // Cache request data by Workflow ID for fast lookup
    const reqMap = {};
    reqData.slice(1).forEach(row => {
      reqMap[row[0]] = {
        requesterName: row[4],
        requesterEmail: row[5],
        managerEmail: row[17],
        dateRequested: row[3] instanceof Date ? row[3].toLocaleDateString() : String(row[3]),
        // Store requested items for status calculation
        requestedItems: {
          jonas: (row[44] && row[44].toString().length > 0), // Jonas requested
          creditCard: (row[30] === 'Yes' || row[32] === 'Yes' || row[34] === 'Yes'),
          fleetio: (row[20] && row[20].includes('Fleetio')),
          businessCards: (row[20] && row[20].includes('Business Cards')),
          siteDocs: true // Always required
        }
      };
    });
    
    // Get Status Data from Result Sheets to determine pending items
    // This allows us to say "Pending: Jonas" instead of just "Specialist Forms Needed"
    const finishedForms = {
      it: getFinishedForms(ss, CONFIG.SHEETS.IT_RESULTS),
      jonas: getFinishedForms(ss, CONFIG.SHEETS.JONAS_RESULTS),
      creditCard: getFinishedForms(ss, CONFIG.SHEETS.CREDIT_CARD_RESULTS),
      fleetio: getFinishedForms(ss, CONFIG.SHEETS.FLEETIO_RESULTS),
      businessCards: getFinishedForms(ss, CONFIG.SHEETS.BUSINESS_CARDS_RESULTS),
      siteDocs: getFinishedForms(ss, CONFIG.SHEETS.SITEDOCS_RESULTS),
      review: getFinishedForms(ss, CONFIG.SHEETS.REVIEW_306090_RESULTS)
    };
    
    const userEmail = Session.getActiveUser().getEmail();
    
    const flows = wfRows.map(row => {
        const id = row[0];
        const step = row[7];
        const reqInfo = reqMap[id] || {};
        
        let displayStatus = step;
        let pendingItems = [];
        
        // Calculate granular status if in Specialist step
        if (step === 'Specialist Forms Needed') {
           const items = reqInfo.requestedItems || {};
           
           if (items.jonas && !finishedForms.jonas.has(id)) pendingItems.push('Jonas');
           if (items.creditCard && !finishedForms.creditCard.has(id)) pendingItems.push('Credit Card');
           if (items.fleetio && !finishedForms.fleetio.has(id)) pendingItems.push('Fleetio');
           if (items.businessCards && !finishedForms.businessCards.has(id)) pendingItems.push('Business Cards');
           if (!finishedForms.siteDocs.has(id)) pendingItems.push('SiteDocs');
           if (!finishedForms.review.has(id)) pendingItems.push('30/60/90');
           
           if (pendingItems.length > 0) {
             displayStatus = 'Pending: ' + pendingItems.join(', ');
           } else {
             displayStatus = 'All Specialists Complete'; // Should auto-advance theoretically
           }
        } else if (step === 'IT Setup Needed' && !finishedForms.it.has(id)) {
             displayStatus = 'Pending: IT Setup'; 
        } else if (step === 'ID Setup Needed') {
             displayStatus = 'Pending: ID Setup';
        }

        return {
           id: id,
           employee: row[8],
           status: row[4],
           step: displayStatus,
           initiator: row[3], // Email
           requesterName: reqInfo.requesterName || 'Unknown',
           requesterEmail: reqInfo.requesterEmail || '',
           managerEmail: reqInfo.managerEmail || '',
           dateRequested: reqInfo.dateRequested || '',
           lastUpdated: row[6] instanceof Date ? row[6].toLocaleString() : String(row[6]),
           pendingItems: pendingItems // For UI actions
        };
    }).filter(wf => AccessControlService.canAccessWorkflow(userEmail, wf)).reverse();
    
    return {
      success: true,
      workflows: flows,
      currentUser: userEmail
    };
    
  } catch (error) {
    Logger.log('Dashboard Error: ' + error.toString());
    return { success: false, message: error.message };
  }
}

// Helper to get Set of workflow IDs that have completed a specific form
function getFinishedForms(ss, sheetName) {
  const set = new Set();
  const sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    // Skip header, ID is usuall Col A (index 0)
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) set.add(data[i][0]);
    }
  }
  return set;
}


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
     
     const reqData = reqSheet.getDataRange().getValues();
     if (reqData.length < 2) return { success: false, message: 'No requests found' };

     const reqHeaders = reqData[0];
     // First column is usually ID
     const reqRow = reqData.find(r => r[0] === workflowId);
     
     if (!reqRow) return { success: false, message: 'Request ID not found in database' };
     
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
         const hrData = hrSheet.getDataRange().getValues();
         const hrRow = hrData.find(row => row[0] === workflowId);
         if (hrRow) {
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
         const itData = itSheet.getDataRange().getValues();
         // Col A is ID. 
         // Col G (6) = Computer Assigned
         // Col K (10) = Phone Assigned
         // Col E (4) = Assigned Email
         const itRow = itData.find(row => row[0] === workflowId);
         if (itRow) {
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
           
           const rows = sheet.getDataRange().getValues();
           // Assume standard format: ID is Col A (0), Timestamp Col C (2), Submitted By is Last Col
           const match = rows.find(row => row[0] === workflowId);
           
           if (match) {
               const submittedBy = rows[0].length > 0 ? match[match.length - 1] : 'Unknown';
               const timestamp = match[2] instanceof Date ? match[2].toLocaleString() : String(match[2]);
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
     checklist.push({ name: "HR Verification", ...checkSheet(CONFIG.SHEETS.HR_VERIFICATION_RESULTS, 'hr_verification') });
     
     // -- Stage 4: IT Setup --
     checklist.push({ name: "IT Setup", ...checkSheet(CONFIG.SHEETS.IT_RESULTS, 'it_setup') });
     
     // -- Stage 5: Specialists (Conditional) --
     
     // Jonas
     if (r['Jonas Job Numbers'] && r['Jonas Job Numbers'].toString().length > 0) {
        checklist.push({ name: "Jonas Setup", ...checkSheet(CONFIG.SHEETS.JONAS_RESULTS, 'jonas') });
     }
     
     // Credit Card (Check multiple versions of Yes)
     const ccUsa = r['Credit Card (USA)'];
     const ccCan = r['Credit Card (Canada)'];
     const ccHd = r['Credit Card (Home Depot)'];
     if ((ccUsa === 'Yes') || (ccCan === 'Yes') || (ccHd === 'Yes')) {
         checklist.push({ name: "Credit Card", ...checkSheet(CONFIG.SHEETS.CREDIT_CARD_RESULTS, 'credit_card') });
     }
     
     // Fleetio
     const sysAccess = r['Systems'] || '';
     if (sysAccess.includes('Fleetio')) {
         checklist.push({ name: "Fleetio", ...checkSheet(CONFIG.SHEETS.FLEETIO_RESULTS, 'fleetio') });
     }
     
     // Business Cards
     if (sysAccess.includes('Business Cards')) {
         checklist.push({ name: "Business Cards", ...checkSheet(CONFIG.SHEETS.BUSINESS_CARDS_RESULTS, 'business_cards') });
     }
     
     // SiteDocs (Always)
     checklist.push({ name: "SiteDocs", ...checkSheet(CONFIG.SHEETS.SITEDOCS_RESULTS, 'sitedocs') });
     
     // 30/60/90 (Always)
     checklist.push({ name: "30/60/90 Review", ...checkSheet(CONFIG.SHEETS.REVIEW_306090_RESULTS, 'review') });
     
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
     const row = data.find(r => r[0] === workflowId); // Assume ID is Col 0
     
     if (!row) return {};
     
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
