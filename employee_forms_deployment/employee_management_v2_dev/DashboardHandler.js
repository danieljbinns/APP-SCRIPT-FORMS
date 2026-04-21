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
  const template = HtmlService.createTemplateFromFile('WorkflowMap');
  template.baseUrl = getBaseUrl();
  return template.evaluate()
    .setTitle('Process Map')
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
      return JSON.stringify({ success: false, message: 'Dashboard_View sheet not found. Please run Setup.' });
    }

    const userEmail = Session.getActiveUser().getEmail();

    // Resolve role ONCE — replaces per-row AdminDirectory + PropertiesService API calls
    const accessFlags = AccessControlService.getUserAccessFlags(userEmail);
    const isFullAccess = accessFlags.isFullAccess;
    const canEditDates = accessFlags.canEditDates;
    const userEmailLower = userEmail.toLowerCase();

    // Pre-load empType from Terminations sheet so existing TERM_ rows in Dashboard_View
    // (synced before the empType fix) can be supplemented without a full re-sync.
    const termEmpTypeMap = {};
    const termSheetForType = ss.getSheetByName(CONFIG.SHEETS.TERMINATIONS);
    if (termSheetForType) {
      const tData = termSheetForType.getDataRange().getValues();
      for (let i = 1; i < tData.length; i++) {
        const wfId = String(tData[i][0] || '');
        if (wfId) termEmpTypeMap[wfId] = String(tData[i][7] || ''); // col 7 = Employee Type
      }
    }

    // Read the flat materialized view — single bulk read
    const data = viewSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return JSON.stringify({ success: true, workflows: [], currentUser: userEmail, canEditDates: canEditDates });
    }

    const tz = Session.getScriptTimeZone();
    const fmtDate = (v) => {
      if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy/MM/dd');
      const s = String(v || '');
      if (!s) return '';
      if (/^\d{4}\/\d{2}\/\d{2}/.test(s)) return s;  // already yyyy/MM/dd
      try { const d = new Date(s.replace(/-/g, '/')); if (!isNaN(d.getTime())) return Utilities.formatDate(d, tz, 'yyyy/MM/dd'); } catch(e) {}
      return s;
    };
    const fmtDateTime = (v) => {
      if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy/MM/dd HH:mm');
      const s = String(v || '');
      if (!s) return '';
      if (/^\d{4}\/\d{2}\/\d{2}/.test(s)) return s;  // already yyyy/MM/dd ...
      try { const d = new Date(s.replace(/-/g, '/')); if (!isNaN(d.getTime())) return Utilities.formatDate(d, tz, 'yyyy/MM/dd HH:mm'); } catch(e) {}
      return s;
    };

    const flows = data.slice(1).map(row => {
      let items = {};
      try { if (row[10]) items = JSON.parse(String(row[10])); } catch (e) {}
      const workflowId = String(row[0] || '');
      return {
        id: workflowId,
        employee: String(row[1] || ''),
        status: String(row[2] || ''),
        step: String(row[3] || ''),
        requesterName: String(row[4] || ''),
        requesterEmail: String(row[5] || ''),
        initiator: String(row[5] || row[6] || '-'),
        dateRequested: fmtDate(row[7]),
        lastUpdated: fmtDateTime(row[8]),
        managerEmail: String(row[9] || ''),
        requestedItems: items,
        pendingItems: [],
        hireDate: fmtDate(row[11]),
        site: String(row[12] || ''),
        empType: String(row[13] || '') || (workflowId.startsWith('TERM_') ? (termEmpTypeMap[workflowId] || '') : ''),
        type: workflowId.startsWith('TERM_') ? 'End of Employment' : (workflowId.startsWith('CHANGE_') ? 'Status Change' : 'Onboarding')
      };
    }).filter(wf => {
      if (wf.status === 'Cancelled') return false;
      if (isFullAccess) return true;
      return wf.requesterEmail.toLowerCase() === userEmailLower ||
             wf.managerEmail.toLowerCase() === userEmailLower;
    });

    // Termination fallback — catches pre-existing terminations not yet in Dashboard_View.
    // New terminations land in Dashboard_View via syncWorkflowState in TerminationHandler.
    const flowIds = new Set(flows.map(f => f.id));
    const workflowsSheet = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
    let wfMap = {};
    if (workflowsSheet) {
      const wData = workflowsSheet.getDataRange().getValues();
      const headers = wData[0];
      const idIdx = headers.indexOf('Workflow ID');
      const statusIdx = headers.indexOf('Status');
      const stepIdx = headers.indexOf('Current Step');
      if (idIdx !== -1) {
        for (let i = 1; i < wData.length; i++) {
          wfMap[String(wData[i][idIdx] || '')] = {
            status: statusIdx !== -1 ? String(wData[i][statusIdx] || '') : '',
            step:   stepIdx   !== -1 ? String(wData[i][stepIdx]   || '') : ''
          };
        }
      }
    }

    const termSheet = ss.getSheetByName(CONFIG.SHEETS.TERMINATIONS);
    if (termSheet) {
      const termData = termSheet.getDataRange().getValues();
      if (termData.length > 1) {
        termData.slice(1).forEach(row => {
          const wfId = String(row[0] || '');
          if (!wfId || flowIds.has(wfId)) return;

          // Apply access filter to fallback rows
          const reqEmail = String(row[4] || '').toLowerCase();
          const mgrEmail = String(row[15] || '').toLowerCase();
          if (!isFullAccess && reqEmail !== userEmailLower && mgrEmail !== userEmailLower) return;

          let statusStr = row[16] ? 'Approved' : 'Pending Approval';
          let stepStr   = row[16] ? 'Action Items Pending' : 'HR Approval Needed';

          if (wfMap[wfId]) {
            if      (wfMap[wfId].status === 'Complete')   { statusStr = 'Complete';   stepStr = wfMap[wfId].step || 'All Actions Completed'; }
            else if (wfMap[wfId].status === 'Rejected')   { statusStr = 'Rejected';   stepStr = wfMap[wfId].step || 'Rejected'; }
            else if (wfMap[wfId].status === 'Cancelled')  { return; }
            else if (wfMap[wfId].status === 'In Progress') { stepStr  = wfMap[wfId].step || stepStr; } // B3 fix
          }

          flows.push({
            id: wfId,
            employee:      String(row[5]  || ''),
            status:        statusStr,
            step:          stepStr,
            requesterName: String(row[3]  || ''),
            requesterEmail:String(row[4]  || ''),
            initiator:     String(row[4]  || '-'),
            dateRequested: fmtDate(row[2]),
            lastUpdated:   fmtDateTime(row[2]),
            managerEmail:  String(row[15] || ''),
            hireDate:      fmtDate(row[12]),
            site:          String(row[11] || ''),
            empType:       String(row[7]  || ''), // Employee Type
            requestedItems: {},
            pendingItems: [],
            type: 'End of Employment'
          });
        });
      }
    }

    flows.reverse();

    return JSON.stringify({ success: true, workflows: flows, currentUser: userEmail, canEditDates: canEditDates });

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
      case 'id_setup': recipient = CONFIG.EMAILS.IDSETUP; formType = 'ID Setup'; break;
      case 'hr_verification': recipient = CONFIG.EMAILS.HR || 'HR Team'; formType = 'HR Verification'; break;
      case 'it_setup': recipient = CONFIG.EMAILS.IT || 'IT Team'; formType = 'IT Setup'; break;
      // Specialist steps — look up the Action Item to find assignee and task URL
      case 'creditcard': case 'businesscards': case 'fleetio': case 'jonas':
      case 'centralpurchasing': case 'sitedocs': case 'review_306090':
      case 'safety_onboarding': case 'safety_term': {
        try {
          const aiSh_ = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
          if (aiSh_) {
            const aiD_ = aiSh_.getDataRange().getValues();
            const aH_  = aiD_[0];
            const wI_ = aH_.indexOf('Workflow ID'), ftI_ = aH_.indexOf('Form Type'),
                  tiI_ = aH_.indexOf('Task ID'), asI_ = aH_.indexOf('Assigned To'),
                  stI_ = aH_.indexOf('Status'), tnI_ = aH_.indexOf('Task Name');
            for (let i = 1; i < aiD_.length; i++) {
              if (String(aiD_[i][wI_]) !== workflowId) continue;
              if (ftI_ >= 0 && String(aiD_[i][ftI_]) !== targetStep) continue;
              if (String(aiD_[i][stI_]) === 'Closed') continue;
              recipient = String(aiD_[i][asI_] || '');
              formType  = String(aiD_[i][tnI_] || targetStep);
              const tid_ = String(aiD_[i][tiI_] || '');
              if (tid_ && recipient && recipient.includes('@')) {
                const bumpCtx_ = getWorkflowContext(workflowId) || {};
                sendFormEmail({
                  to: recipient,
                  subject: 'Reminder: ' + formType,
                  body: 'ACTION REQUIRED: A reminder that the following action item is still pending your completion.',
                  formUrl: buildFormUrl('action_item_view', { tid: tid_ }),
                  displayName: 'TEAM Group - Onboarding',
                  contextData: bumpCtx_,
                  subjectOpts: { isReminder: true, requestDate: new Date() }
                });
                return { success: true, message: 'Reminder sent to ' + recipient };
              }
              break;
            }
          }
        } catch (aiErr) { Logger.log('Bump Action Item lookup error: ' + aiErr.toString()); }
        return { success: false, message: 'Action Item not found or already closed for: ' + targetStep };
      }
      // Status Change Action Item targets — look up by category
      case 'change_manager':
      case 'change_it':
      case 'change_purchasing':
      case 'change_idsetup':
      case 'change_safety':
      case 'change_businesscards':
      case 'change_creditcard':
      case 'change_fleetio':
      case 'change_jonas': {
        const changeBumpCatMap = {
          'change_manager':      'Manager',
          'change_it':           'IT',
          'change_purchasing':   'Purchasing',
          'change_idsetup':      'ID Setup',
          'change_safety':       'Safety',
          'change_businesscards':'Business Cards',
          'change_creditcard':   'Credit Card',
          'change_fleetio':      'Fleetio',
          'change_jonas':        'Jonas'
        };
        const chgTargetCat = changeBumpCatMap[targetStep];
        try {
          const aiSh_ = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
          if (aiSh_) {
            const aiD_ = aiSh_.getDataRange().getValues();
            const aH_  = aiD_[0];
            const wI_  = aH_.indexOf('Workflow ID'), catI_ = aH_.indexOf('Category'),
                  tiI_ = aH_.indexOf('Task ID'),     asI_  = aH_.indexOf('Assigned To'),
                  stI_ = aH_.indexOf('Status'),      tnI_  = aH_.indexOf('Task Name');
            for (let i = 1; i < aiD_.length; i++) {
              if (String(aiD_[i][wI_])   !== workflowId) continue;
              if (String(aiD_[i][catI_]) !== chgTargetCat) continue;
              if (String(aiD_[i][stI_])  === 'Closed')   continue;
              recipient = String(aiD_[i][asI_] || '');
              formType  = String(aiD_[i][tnI_] || chgTargetCat);
              const tid_ = String(aiD_[i][tiI_] || '');
              if (tid_ && recipient && recipient.includes('@')) {
                const bumpCtx_ = getWorkflowContext(workflowId) || {};
                sendFormEmail({
                  to: recipient,
                  subject: 'Reminder: ' + formType,
                  body: 'ACTION REQUIRED: A reminder that the following action item is still pending your completion.',
                  formUrl: buildFormUrl('action_item_view', { tid: tid_ }),
                  displayName: 'TEAM Group - Employee Management',
                  contextData: bumpCtx_,
                  subjectOpts: { isReminder: true, requestDate: new Date() }
                });
                return { success: true, message: 'Reminder sent to ' + recipient };
              }
              break;
            }
          }
        } catch (aiErr) { Logger.log('Bump CHANGE Action Item error: ' + aiErr.toString()); }
        return { success: false, message: 'Action item not found or already closed for: ' + targetStep };
      }

      // EOE Action Item targets — look up by category rather than form type
      case 'asset_collection':
      case 'systems_deactivation':
      case 'systems_deactivation_hr':
      case 'systems_deactivation_fleet':
      case 'systems_deactivation_finance':
      case 'systems_deactivation_deact': {
        const eoeTargetCatMap = {
          'asset_collection':          'Assets',
          'systems_deactivation':      'IT',
          'systems_deactivation_hr':   'HR',
          'systems_deactivation_fleet':'Fleet',
          'systems_deactivation_finance':'Finance',
          'systems_deactivation_deact':'Deactivation'
        };
        const targetCat = eoeTargetCatMap[targetStep];
        try {
          const aiSh_ = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
          if (aiSh_) {
            const aiD_ = aiSh_.getDataRange().getValues();
            const aH_  = aiD_[0];
            const wI_  = aH_.indexOf('Workflow ID'), catI_ = aH_.indexOf('Category'),
                  tiI_ = aH_.indexOf('Task ID'),     asI_  = aH_.indexOf('Assigned To'),
                  stI_ = aH_.indexOf('Status'),      tnI_  = aH_.indexOf('Task Name');
            for (let i = 1; i < aiD_.length; i++) {
              if (String(aiD_[i][wI_])   !== workflowId) continue;
              if (String(aiD_[i][catI_]) !== targetCat)  continue;
              if (String(aiD_[i][stI_])  === 'Closed')   continue;
              recipient = String(aiD_[i][asI_] || '');
              formType  = String(aiD_[i][tnI_] || targetCat);
              const tid_ = String(aiD_[i][tiI_] || '');
              if (tid_ && recipient && recipient.includes('@')) {
                const bumpCtx_ = getWorkflowContext(workflowId) || {};
                sendFormEmail({
                  to: recipient,
                  subject: 'Reminder: ' + formType,
                  body: 'ACTION REQUIRED: A reminder that the following action item is still pending your completion.',
                  formUrl: buildFormUrl('action_item_view', { tid: tid_ }),
                  displayName: 'TEAM Group - Employee Management',
                  contextData: bumpCtx_,
                  subjectOpts: { isReminder: true, requestDate: new Date() }
                });
                return { success: true, message: 'Reminder sent to ' + recipient };
              }
              break;
            }
          }
        } catch (aiErr) { Logger.log('Bump EOE Action Item error: ' + aiErr.toString()); }
        return { success: false, message: 'Action item not found or already closed for: ' + targetStep };
      }

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
        // Specialist bumps are handled above via the Action Item case blocks — they return early

        var bumpContext = getWorkflowContext(workflowId) || {};
        sendFormEmail({
          to: recipient,
          subject: formType + ' Required',
          body: 'ACTION REQUIRED: ' + formType + '\n\n' +
            'A request for ' + formType + ' is pending your action. Please complete this task using the link below.',
          formUrl: specificUrl,
          displayName: 'TEAM Group - Onboarding',
          contextData: bumpContext,
          subjectOpts: { isReminder: true, requestDate: new Date() }
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

/**
 * D2: Update the hire date for a workflow (HR, IT, and Admin only)
 */
function updateHireDate(workflowId, newDateStr) {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    if (!AccessControlService.canAccessForm(userEmail, 'HR') &&
        !AccessControlService.canAccessForm(userEmail, 'IT') &&
        !AccessControlService.isAdmin(userEmail)) {
      return { success: false, message: 'Permission denied. Only HR, IT, or Admin can edit hire dates.' };
    }

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
    if (!sheet) return { success: false, message: 'Initial Requests sheet not found.' };

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const wfIdCol = headers.indexOf('Workflow ID');
    const hireDateCol = headers.indexOf('Hire Date');

    if (wfIdCol === -1 || hireDateCol === -1) return { success: false, message: 'Required columns not found.' };

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][wfIdCol]) === workflowId) {
        // Capture old date for audit trail
        const rawOld = data[i][hireDateCol];
        const oldDateStr = rawOld instanceof Date
          ? Utilities.formatDate(rawOld, Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : String(rawOld || '').substring(0, 10);

        sheet.getRange(i + 1, hireDateCol + 1).setValue(new Date(newDateStr + 'T12:00:00'));
        SpreadsheetApp.flush();
        syncWorkflowState(workflowId);

        // Write audit row to HR Verification Results so the change is visible in records
        try {
          const auditSheet = ss.getSheetByName(CONFIG.SHEETS.HR_VERIFICATION_RESULTS);
          if (auditSheet) {
            auditSheet.appendRow([
              workflowId,
              'DATE_CHANGE',
              new Date(),
              '', // ADP ID
              '', // Verified Name
              '', // Manager
              '', // Manager Email
              '', // JR Title
              '[START DATE CHANGED: ' + oldDateStr + ' → ' + newDateStr + '] by ' + userEmail,
              userEmail
            ]);
          }
        } catch (auditErr) {
          Logger.log('[D2] Could not write audit row: ' + auditErr.message);
        }

        Logger.log('[D2] Hire date updated for ' + workflowId + ' from ' + oldDateStr + ' to ' + newDateStr + ' by ' + userEmail);
        return { success: true, message: 'Start date updated from ' + oldDateStr + ' to ' + newDateStr + '.' };
      }
    }
    return { success: false, message: 'Workflow not found in Initial Requests.' };
  } catch (e) {
    Logger.log('[D2] updateHireDate error: ' + e.toString());
    return { success: false, message: e.message };
  }
}

function cancelRequest(workflowId) {
  try {
    const user = Session.getActiveUser().getEmail();
    Logger.log(`Cancel requested for ${workflowId} by ${user}`);

    if (!AccessControlService.isAdmin(user)) {
      return { success: false, message: 'Permission denied. Only admins can cancel requests.' };
    }

    updateWorkflow(workflowId, 'Cancelled', 'Request Cancelled', '');
    syncWorkflowState(workflowId);

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

    // Termination workflows have a dedicated function with the correct checklist logic
    if (workflowId.startsWith('TERM_')) {
      return getTerminationDetails(workflowId);
    }

    // Status change workflows have a dedicated function
    if (workflowId.startsWith('CHANGE_')) {
      return getChangeDetails(workflowId);
    }

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const context = { success: true, id: workflowId, checklist: [] };

    // 1. Initial Request Data (The Source of Truth for what is needed)
    const reqSheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
    if (!reqSheet) return { success: false, message: 'Initial Requests sheet missing' };

    const isTerm = false;
    const isChange = workflowId.startsWith('CHANGE_');
    const lookupSheetName = isTerm ? CONFIG.SHEETS.TERMINATIONS : (isChange ? CONFIG.SHEETS.POSITION_CHANGES : CONFIG.SHEETS.INITIAL_REQUESTS);
    const lookupSheet = ss.getSheetByName(lookupSheetName);
    
    const foundReq = lookupSheet ? lookupSheet.getRange("A:A").createTextFinder(workflowId).matchEntireCell(true).findNext() : null;
    if (!foundReq) return { success: false, message: 'Request ID not found in database' };

    const reqRowIndex = foundReq.getRow();
    const reqLastCol = lookupSheet.getLastColumn(); // Use lookupSheet here
    const reqHeaders = lookupSheet.getRange(1, 1, 1, reqLastCol).getValues()[0]; // Use lookupSheet here
    const reqRow = lookupSheet.getRange(reqRowIndex, 1, 1, reqLastCol).getValues()[0]; // Use lookupSheet here

    const r = {};
    const _tz = Session.getScriptTimeZone();
    // Safer mapping: Ensure no undefined values which break google.script.run serialization
    reqHeaders.forEach((h, i) => {
      if (h) {
        const val = reqRow[i];
        if (val instanceof Date) {
          // Date-only fields: format without time to avoid UTC shift on client
          r[h] = Utilities.formatDate(val, _tz, 'M/d/yyyy');
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
      const foundHr = hrSheet.getRange("A:A").createTextFinder(workflowId).findNext();
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

        const found = sheet.getRange("A:A").createTextFinder(workflowId).findNext();
        if (found) {
          const rowData = sheet.getRange(found.getRow(), 1, 1, sheet.getLastColumn()).getValues()[0];
          const submittedBy = rowData.length > 0 ? rowData[rowData.length - 1] : 'Unknown';
          const timestamp = rowData[2] instanceof Date ? rowData[2].toLocaleString() : String(rowData[2]);
          return { status: 'Complete', by: submittedBy, time: timestamp, target: target };
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
      time: r['Submission Timestamp'] ? (r['Submission Timestamp'] instanceof Date ? r['Submission Timestamp'].toLocaleString() : String(r['Submission Timestamp'])) : ''
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

    // -- Stage 5: Specialist Action Items (single sheet read replaces 7 per-sheet checks) --
    // Declared outside the aiSheet block so the SiteDocs fallback below can always read it
    let hasSiteDocsAI = false;
    const aiSheet = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
    if (aiSheet) {
      const aiData = aiSheet.getDataRange().getValues();
      if (aiData.length > 1) {
        const aiHdrs = aiData[0];
        const aiWfCol     = aiHdrs.indexOf('Workflow ID');
        const aiCatCol    = aiHdrs.indexOf('Category');
        const aiTidCol    = aiHdrs.indexOf('Task ID');
        const aiStatCol   = aiHdrs.indexOf('Status');
        const aiAssignCol = aiHdrs.indexOf('Assigned To');
        const aiClosedCol = aiHdrs.indexOf('Closed By');
        const aiCompCol   = aiHdrs.indexOf('Completed Date');
        const aiCreatedCol= aiHdrs.indexOf('Created Date');
        const aiFtCol     = aiHdrs.indexOf('Form Type');

        // Categories that belong to specialist onboarding (exclude termination categories)
        const SPECIALIST_CATS = new Set([
          'Credit Card', 'Business Cards', 'Fleetio', 'Jonas',
          'Central Purchasing', 'SiteDocs', '30/60/90 Review', 'Safety'
        ]);

        for (let i = 1; i < aiData.length; i++) {
          if (String(aiData[i][aiWfCol]) !== workflowId) continue;
          const cat = String(aiData[i][aiCatCol] || '');
          if (!SPECIALIST_CATS.has(cat)) continue;

          const isClosed  = aiData[i][aiStatCol] === 'Closed';
          const tid       = String(aiData[i][aiTidCol] || '');
          const formType  = aiFtCol >= 0 ? String(aiData[i][aiFtCol] || '') : '';
          const byActor   = isClosed
            ? String(aiData[i][aiClosedCol] || aiData[i][aiAssignCol] || '-')
            : String(aiData[i][aiAssignCol] || '-');

          let timeStr = '';
          if (isClosed && aiCompCol >= 0 && aiData[i][aiCompCol]) {
            const cd = aiData[i][aiCompCol];
            timeStr = cd instanceof Date ? cd.toLocaleString() : String(cd);
          } else if (aiCreatedCol >= 0 && aiData[i][aiCreatedCol]) {
            const cr = aiData[i][aiCreatedCol];
            timeStr = cr instanceof Date ? cr.toLocaleString() : String(cr);
          }

          // Normalize formType to match flowchart node IDs in RequestDetails.html
          const NODE_MAP = {
            'creditcard':       'credit_card',
            'businesscards':    'business_cards',
            'review_306090':    'review',
            'centralpurchasing':'central_purchasing',
            'safety_onboarding':'safety',
            'safety_term':      'safety_term'
          };
          const rawTarget = formType || cat.toLowerCase().replace(/[\s\/]+/g, '');
          const target = NODE_MAP[rawTarget] || rawTarget;

          if (cat === 'SiteDocs') hasSiteDocsAI = true;

          checklist.push({
            name: cat,
            status: isClosed ? 'Complete' : 'Pending',
            target: target,
            tid: tid,
            by: byActor,
            time: timeStr
          });
        }
      }
    }

    // SiteDocs is set up during ID Setup, not as a specialist action item.
    // If no SiteDocs action item exists, synthesize a checklist entry from ID Setup Results.
    if (!hasSiteDocsAI) {
      const idSh = ss.getSheetByName(CONFIG.SHEETS.ID_SETUP_RESULTS);
      if (idSh) {
        const idFound = idSh.getRange('A:A').createTextFinder(workflowId).matchEntireCell(true).findNext();
        if (idFound) {
          const idRow = idSh.getRange(idFound.getRow(), 1, 1, idSh.getLastColumn()).getValues()[0];
          const idHdrs = idSh.getRange(1, 1, 1, idSh.getLastColumn()).getValues()[0];
          const tsCol = idHdrs.indexOf('Submission Timestamp');
          const byCol = idHdrs.indexOf('Submitted By');
          checklist.push({
            name: 'SiteDocs',
            status: 'Complete',
            target: 'sitedocs',
            tid: '',
            by: byCol >= 0 ? String(idRow[byCol] || '') : '',
            time: tsCol >= 0 && idRow[tsCol] instanceof Date ? idRow[tsCol].toLocaleString() : ''
          });
        }
      }
    }

    const userEmail = Session.getActiveUser().getEmail();
    context.isAdmin = AccessControlService.isAdmin(userEmail);

    context.checklist = checklist;
    context.type = isChange ? 'Status Change' : 'Onboarding';
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

    switch (stepTarget) {
      case 'initial_request': {
        const irSh = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
        if (!irSh) return {};
        const irFound = irSh.getRange('A:A').createTextFinder(workflowId).matchEntireCell(true).findNext();
        if (!irFound) return {};
        const irH = irSh.getRange(1, 1, 1, irSh.getLastColumn()).getValues()[0];
        const irRow = irSh.getRange(irFound.getRow(), 1, 1, irSh.getLastColumn()).getValues()[0];
        const irMap = {};
        const irTz = Session.getScriptTimeZone();
        irH.forEach((h, i) => {
          if (!h) return;
          const v = irRow[i];
          irMap[h] = v instanceof Date ? Utilities.formatDate(v, irTz, 'M/d/yyyy') : String(v || '');
        });
        const fv = (k) => irMap[k] || '';
        // Curated ordered display — omit internal IDs, passwords, raw system lists
        const SKIP_IR = new Set(['Workflow ID','Form ID','Submission Timestamp','Systems','Equipment',
          'Google Email','Google Domain','JR Req','JR Assign','ADP Salary Access',
          'Requested Username','Requested Domain','BOSS Job Sites','BOSS Cost Sheet','BOSS Cost Sheet Jobs',
          'BOSS Trip Reports','BOSS Grievances','Jonas Job Numbers','Credit Card USA','Credit Card Limit USA',
          'Credit Card Limit Canada','Credit Card Limit Home Depot','Purchasing Sites','Status']);
        const ORDER = [
          'Status','Employment Type','Employee Type','New Hire/Rehire',
          'First Name','Last Name','Position Title','Department',
          'Site/Office Location','Site Name','Job Site #',
          'Manager Name','Manager Email',
          'Requester Name','Requester Email',
          'System Access','Hire Date','Date Requested'
        ];
        const out = {};
        // Show ordered fields first
        ORDER.forEach(k => {
          const v = fv(k);
          if (v) out[k] = k === 'Submission Timestamp' ? v : v;
        });
        // Append any remaining non-skipped fields
        irH.forEach(h => {
          if (!h || SKIP_IR.has(h) || ORDER.includes(h) || h in out) return;
          const v = fv(h);
          if (v) out[h] = v;
        });
        out['Submitted at'] = fv('Submission Timestamp') || fv('Timestamp') || '-';
        return out;
      }
      case 'change_request': {
        const pcSh = ss.getSheetByName(CONFIG.SHEETS.POSITION_CHANGES);
        if (!pcSh) return {};
        const pcFound = pcSh.getRange('A:A').createTextFinder(workflowId).matchEntireCell(true).findNext();
        if (!pcFound) return {};
        const pcH = pcSh.getRange(1, 1, 1, pcSh.getLastColumn()).getValues()[0];
        const pcRow = pcSh.getRange(pcFound.getRow(), 1, 1, pcSh.getLastColumn()).getValues()[0];
        const pcTz = Session.getScriptTimeZone();
        const out = {};
        pcH.forEach(function(h, i) {
          if (!h || h === 'Workflow ID' || h === 'Form ID') return;
          const v = pcRow[i];
          out[h] = v instanceof Date ? Utilities.formatDate(v, pcTz, 'M/d/yyyy') : String(v || '');
        });
        return out;
      }
      case 'position_change_approval': {
        const pcaSh = ss.getSheetByName(CONFIG.SHEETS.POSITION_CHANGE_APPROVALS);
        if (!pcaSh) return {};
        const pcaFound = pcaSh.getRange('A:A').createTextFinder(workflowId).matchEntireCell(true).findNext();
        if (!pcaFound) return {};
        const pcaRow = pcaSh.getRange(pcaFound.getRow(), 1, 1, pcaSh.getLastColumn()).getValues()[0];
        const fd2 = function(v) { return v instanceof Date ? v.toLocaleString() : String(v || ''); };
        return {
          'Decision':     fd2(pcaRow[3]),
          'Notes':        fd2(pcaRow[4]),
          'Next Steps':   fd2(pcaRow[5]),
          'Submitted By': fd2(pcaRow[6]),
          'Timestamp':    fd2(pcaRow[2])
        };
      }
      case 'change_manager':
      case 'change_it':
      case 'change_purchasing':
      case 'change_idsetup':
      case 'change_safety':
      case 'change_businesscards':
      case 'change_creditcard':
      case 'change_fleetio':
      case 'change_jonas': {
        const changeCatMap = {
          'change_manager':      'Manager',
          'change_it':           'IT',
          'change_purchasing':   'Purchasing',
          'change_idsetup':      'ID Setup',
          'change_safety':       'Safety',
          'change_businesscards':'Business Cards',
          'change_creditcard':   'Credit Card',
          'change_fleetio':      'Fleetio',
          'change_jonas':        'Jonas'
        };
        const catLabel = changeCatMap[stepTarget];
        const aiSh2 = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
        if (!aiSh2) return {};
        const aiData2 = aiSh2.getDataRange().getValues();
        const aiHdrs2 = aiData2[0];
        const wfColIdx2  = aiHdrs2.indexOf('Workflow ID');
        const catColIdx2 = aiHdrs2.indexOf('Category');
        const taskColIdx2= aiHdrs2.indexOf('Task Name');
        const descColIdx2= aiHdrs2.indexOf('Description');
        const statColIdx2= aiHdrs2.indexOf('Status');
        const assignColIdx2 = aiHdrs2.indexOf('Assigned To');
        const closedByColIdx2 = aiHdrs2.indexOf('Closed By');
        const completedDateColIdx2 = aiHdrs2.indexOf('Completed Date');
        const notesColIdx2 = aiHdrs2.indexOf('Notes');
        const result2 = {};
        let taskNum2 = 1;
        for (let i = 1; i < aiData2.length; i++) {
          if (String(aiData2[i][wfColIdx2]) !== workflowId) continue;
          if (String(aiData2[i][catColIdx2]) !== catLabel) continue;
          const prefix = 'Task ' + taskNum2;
          result2[prefix + ' Name'] = String(aiData2[i][taskColIdx2] || '-');
          result2[prefix + ' Status'] = String(aiData2[i][statColIdx2] || '-');
          result2[prefix + ' Assigned To'] = String(aiData2[i][assignColIdx2] || '-');
          if (closedByColIdx2 >= 0 && aiData2[i][closedByColIdx2]) result2[prefix + ' Closed By'] = String(aiData2[i][closedByColIdx2]);
          if (completedDateColIdx2 >= 0 && aiData2[i][completedDateColIdx2]) {
            const cd2 = aiData2[i][completedDateColIdx2];
            result2[prefix + ' Completed'] = cd2 instanceof Date ? cd2.toLocaleString() : String(cd2);
          }
          if (notesColIdx2 >= 0) result2[prefix + ' Notes'] = String(aiData2[i][notesColIdx2] || '-');
          if (descColIdx2 >= 0) result2[prefix + ' Description'] = String(aiData2[i][descColIdx2] || '-');
          taskNum2++;
        }
        if (taskNum2 === 1) result2['Status'] = 'No tasks found for category: ' + catLabel;
        return result2;
      }
      case 'termination_request': {
        const tSh = ss.getSheetByName(CONFIG.SHEETS.TERMINATIONS);
        if (!tSh) return {};
        const tFound = tSh.getRange("A:A").createTextFinder(workflowId.trim()).matchEntireCell(false).findNext();
        if (!tFound) return {};
        const tr = tSh.getRange(tFound.getRow(), 1, 1, tSh.getLastColumn()).getValues()[0];
        const fd = (v) => v instanceof Date ? v.toLocaleString() : String(v || '');
        // Helper: only add if value is not empty / N/A
        const out = {};
        const add = (label, val) => { const s = fd(val); if (s && s !== 'N/A') out[label] = s; };

        add('Employee Name',    tr[5]);
        add('Employee Type',    tr[7]);
        add('Site',             tr[11]);
        add('Term Date',        tr[12]);
        add('Reason',           tr[13]);
        add('Manager Name',     tr[14]);
        add('Manager Email',    tr[15]);
        add('Requester Name',   tr[3]);
        add('Requester Email',  tr[4]);
        add('Timestamp',        tr[2]);
        add('HR Pre-Approved',  tr[16]);
        add('Has Reports',      tr[17]);
        if (fd(tr[17]) === 'Yes') add('Reports Reassigned To', tr[18]);
        add('Systems to Deactivate', tr[19]);
        add('Equipment to Return',   tr[25]);

        // Only include Google Account fields when Google Account was selected
        const systems = fd(tr[19]);
        if (systems.includes('Google Account')) {
          add('Work Email',       tr[8]);
          add('Email Forwarding', tr[20]);
          add('Drive Files Transfer', tr[21]);
          add('Inbox Delegate',   tr[22]);
          add('Account Duration', tr[23]);
          add('Vacation Message', tr[24]);
        }

        // Phone only if provided
        add('Phone',            tr[9]);
        add('Computer Serial',  tr[10]);
        add('Comments',         tr[26]);
        if (tr[28]) add('Documentation', fd(tr[28]));

        return out;
      }
      case 'termination_approval': {
        const appSh = ss.getSheetByName(CONFIG.SHEETS.TERMINATION_APPROVALS);
        if (!appSh) return {};
        const appFound = appSh.getRange("A:A").createTextFinder(workflowId).matchEntireCell(true).findNext();
        if (!appFound) return {};
        const ar = appSh.getRange(appFound.getRow(), 1, 1, appSh.getLastColumn()).getValues()[0];

        // Also fetch base request context for the modal
        const tSh = ss.getSheetByName(CONFIG.SHEETS.TERMINATIONS);
        let context = {};
        if (tSh) {
          const tFound = tSh.getRange("A:A").createTextFinder(workflowId).matchEntireCell(true).findNext();
          if (tFound) {
            const tr = tSh.getRange(tFound.getRow(), 1, 1, tSh.getLastColumn()).getValues()[0];
            context = {
              'Employee Name': tr[5] || '-',
              'Site': tr[11] || '-',
              'Term Date': tr[12] instanceof Date ? tr[12].toLocaleDateString() : String(tr[12] || '-'),
              'Reason': tr[13] || '-'
            };
          }
        }

        return {
          'Decision': ar[3],
          'Submitted By': ar[6] || 'HR',
          'Timestamp': ar[2] instanceof Date ? ar[2].toLocaleString() : ar[2],
          'Notes': ar[4],
          'Follow-up Required': ar[5],
          ...context,
          'Workflow ID': ar[0]
        };
      }
      case 'asset_collection':
      case 'systems_deactivation':
      case 'systems_deactivation_hr':
      case 'systems_deactivation_fleet':
      case 'systems_deactivation_finance':
      case 'systems_deactivation_deact': {
        // Map targets back to actual sheet Category values  
        const catLabelMap = {
          'asset_collection': 'Assets',
          'systems_deactivation': 'IT',
          'systems_deactivation_hr': 'HR',
          'systems_deactivation_fleet': 'Fleet',
          'systems_deactivation_finance': 'Finance',
          'systems_deactivation_deact': 'Deactivation'
        };
        const catLabel = catLabelMap[stepTarget];
        const aiss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
        const aiSh = aiss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
        if (!aiSh) return {};
        const aiData = aiSh.getDataRange().getValues();
        const aiHdrs = aiData[0];
        const wfColIdx = aiHdrs.indexOf('Workflow ID');
        const catColIdx = aiHdrs.indexOf('Category');
        const taskColIdx = aiHdrs.indexOf('Task Name');
        const descColIdx = aiHdrs.indexOf('Description');
        const statColIdx = aiHdrs.indexOf('Status');
        const assignColIdx = aiHdrs.indexOf('Assigned To');
        const closedByColIdx = aiHdrs.indexOf('Closed By');
        const completedDateColIdx = aiHdrs.indexOf('Completed Date');
        const notesColIdx = aiHdrs.indexOf('Notes');
 
             const result = {};
             let taskNum = 1;
             for (let i = 1; i < aiData.length; i++) {
                 if (String(aiData[i][wfColIdx]) === workflowId && String(aiData[i][catColIdx]) === catLabel) {
                     const prefix = 'Task ' + taskNum;
                     result[prefix + ' Name'] = String(aiData[i][taskColIdx] || '-');
                     result[prefix + ' Status'] = String(aiData[i][statColIdx] || '-');
                     result[prefix + ' Assigned To'] = String(aiData[i][assignColIdx] || '-');
                     if (closedByColIdx >= 0 && aiData[i][closedByColIdx]) result[prefix + ' Closed By'] = String(aiData[i][closedByColIdx]);
                     if (completedDateColIdx >= 0 && aiData[i][completedDateColIdx]) {
                         const cd = aiData[i][completedDateColIdx];
                         result[prefix + ' Completed'] = cd instanceof Date ? cd.toLocaleString() : String(cd);
                     }
                     if (notesColIdx >= 0) result[prefix + ' Notes'] = String(aiData[i][notesColIdx] || '-');
                     if (descColIdx >= 0) result[prefix + ' Tasks'] = String(aiData[i][descColIdx] || '-');
                     taskNum++;
                 }
             }
        if (taskNum === 1) result['Status'] = 'No tasks found for category: ' + catLabel;
        return result;
      }
      case 'id_setup': sheetName = CONFIG.SHEETS.ID_SETUP_RESULTS; break;
      case 'hr_verification': sheetName = CONFIG.SHEETS.HR_VERIFICATION_RESULTS; break;
      case 'it_setup': sheetName = CONFIG.SHEETS.IT_RESULTS; break;
      // Specialist steps now stored as Action Items — look up by formType/category
      case 'creditcard':
      case 'businesscards':
      case 'fleetio':
      case 'jonas':
      case 'centralpurchasing':
      case 'sitedocs':
      case 'review_306090':
      case 'safety_onboarding':
      case 'safety_term': {
        const ftMap = {
          'creditcard': 'Credit Card', 'businesscards': 'Business Cards',
          'fleetio': 'Fleetio', 'jonas': 'Jonas', 'centralpurchasing': 'Central Purchasing',
          'sitedocs': 'SiteDocs', 'review_306090': '30/60/90 Review',
          'safety_onboarding': 'Safety', 'safety_term': 'Safety'
        };
        const targetCat = ftMap[stepTarget] || stepTarget;
        const aiSh = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
        if (!aiSh) return {};
        const aiD = aiSh.getDataRange().getValues();
        const aH = aiD[0];
        const wIdx = aH.indexOf('Workflow ID');
        const cIdx = aH.indexOf('Category');
        const ftIdx = aH.indexOf('Form Type');
        const result = {};
        let taskNum = 1;
        const SKIP_COLS = new Set(['Workflow ID','Task ID','Form ID','Description','Draft','Form Data','Form Type']);
        for (let i = 1; i < aiD.length; i++) {
          if (String(aiD[i][wIdx]) !== workflowId) continue;
          if (String(aiD[i][cIdx]) !== targetCat) continue;
          if (ftIdx >= 0 && aiD[i][ftIdx] && aiD[i][ftIdx] !== stepTarget) continue;
          const prefix = taskNum > 1 ? 'Task ' + taskNum + ' — ' : '';
          aH.forEach((h, j) => {
            if (!h || SKIP_COLS.has(h)) return;
            const v = aiD[i][j];
            result[prefix + h] = v instanceof Date ? v.toLocaleString() : String(v || '');
          });
          taskNum++;
        }
        if (taskNum === 1) {
          // SiteDocs is completed during ID Setup — fall back to ID Setup Results
          if (stepTarget === 'sitedocs') {
            const idSh = ss.getSheetByName(CONFIG.SHEETS.ID_SETUP_RESULTS);
            if (idSh) {
              const idData2 = idSh.getDataRange().getValues();
              const idHdrs2 = idData2[0];
              const idWfCol2 = idHdrs2.indexOf('Workflow ID');
              const SHOW_COLS = new Set([
                'SiteDocs Worker ID', 'SiteDocs Job Code', 'SiteDocs Username',
                'DSS Username', 'Submission Timestamp', 'Submitted By'
              ]);
              for (let i = 1; i < idData2.length; i++) {
                if (String(idData2[i][idWfCol2]) !== workflowId) continue;
                idHdrs2.forEach((h, j) => {
                  if (!h || !SHOW_COLS.has(h)) return;
                  const v = idData2[i][j];
                  result[h] = v instanceof Date ? v.toLocaleString() : String(v || '');
                });
                result['Note'] = 'SiteDocs set up during ID Setup step';
                break;
              }
            }
          } else {
            result['Status'] = 'No action item found for: ' + targetCat;
          }
        }
        return result;
      }
      default: return {};
    }

    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return {};

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const found = sheet.getRange("A:A").createTextFinder(workflowId).findNext();
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

/**
 * Get Details for End of Employment Workflow Modal
 */
function getTerminationDetails(workflowId) {
  try {
    if (!workflowId) return { success: false, message: 'No workflow ID provided' };

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const context = { success: true, id: workflowId, checklist: [] };

    // 1. Initial Request Data
    const reqSheet = ss.getSheetByName(CONFIG.SHEETS.TERMINATIONS);
    if (!reqSheet) return { success: false, message: 'Terminations sheet missing' };

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
        let val = reqRow[i];
        let strVal = '';
        if (val instanceof Date) {
          strVal = val.toString();
        } else if (val === undefined || val === null) {
          strVal = '';
        } else {
          strVal = String(val);
        }

        // Specific UI mappings to fit the modal layout originally built for onboarding
        if (h === 'Employee Name') r['First Name'] = strVal;
        if (h === 'Site') r['Site'] = strVal;
        if (h === 'Term Date') r['Start Date'] = strVal;
        if (h === 'Manager Email') r['Job Title'] = 'Manager Email: ' + strVal;
        if (h === 'Requester Email') r['Requester Email'] = strVal;

        r[h] = strVal;
      }
    });

    context.requestData = r;

    const checklist = [];

    checklist.push({
      name: "Initial Request",
      status: "Complete",
      by: r['Requester Email'] || 'Unknown',
      time: r['Timestamp'] || ''
    });

    // 2. Approval Step
    const approvalSheet = ss.getSheetByName(CONFIG.SHEETS.TERMINATION_APPROVALS);
    if (approvalSheet) {
      const foundAppr = approvalSheet.getRange("A:A").createTextFinder(workflowId).findNext();
      if (foundAppr) {
        const apprRow = approvalSheet.getRange(foundAppr.getRow(), 1, 1, approvalSheet.getLastColumn()).getValues()[0];
        checklist.push({
          name: "Approval",
          status: "Complete",
          target: "termination_approval",
          by: apprRow[apprRow.length - 1] || 'HR Approval',
          time: apprRow[2] instanceof Date ? apprRow[2].toLocaleString() : String(apprRow[2] || '')
        });
      } else {
        checklist.push({ name: "Approval", status: "Pending", target: "termination_approval" });
      }
    }

    // Fetch Action Items (Assets/Systems)
    const aiSheet = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
    if (aiSheet) {
      const aiData = aiSheet.getDataRange().getValues();
      if (aiData.length > 1) {
        const aiHeaders = aiData[0];
        const wfIdx = aiHeaders.indexOf('Workflow ID');
        const catIdx = aiHeaders.indexOf('Category');
        const tidIdx = aiHeaders.indexOf('Task ID');
        const statusIdx = aiHeaders.indexOf('Status');
        const assignIdx = aiHeaders.indexOf('Assigned To');
        const closedByIdx = aiHeaders.indexOf('Closed By');
        const completedDateIdx = aiHeaders.indexOf('Completed Date');
        const dateIdx = aiHeaders.indexOf('Created Date');

        let categories = {};

        // Group by category to show one line per category
        for (let i = 1; i < aiData.length; i++) {
          if (aiData[i][wfIdx] === workflowId) {
            let cat = aiData[i][catIdx] || 'Task';
            const isClosed = aiData[i][statusIdx] === 'Closed' || aiData[i][statusIdx] === 'Complete';
            if (!categories[cat]) {
              categories[cat] = { total: 0, complete: 0, by: aiData[i][assignIdx], time: aiData[i][dateIdx], tid: aiData[i][tidIdx] || '' };
            }
            categories[cat].total++;
            if (isClosed) {
              categories[cat].complete++;
              // Record who actually closed it for the actor display
              const closedBy = closedByIdx >= 0 ? aiData[i][closedByIdx] : '';
              if (closedBy) categories[cat].closedBy = closedBy;
              const completedDate = completedDateIdx >= 0 ? aiData[i][completedDateIdx] : null;
              if (completedDate) categories[cat].completedTime = completedDate;
            }
          }
        }

        const catTargetMap = {
          'Assets': 'asset_collection',
          'IT': 'systems_deactivation',
          'HR': 'systems_deactivation_hr',
          'Fleet': 'systems_deactivation_fleet',
          'Finance': 'systems_deactivation_finance',
          'Deactivation': 'systems_deactivation_deact',
          'Safety': 'safety_term'
        };

        for (let cat in categories) {
          let c = categories[cat];
          let status = c.complete === c.total ? 'Complete' : 'Pending';
          const byActor = (status === 'Complete' && c.closedBy) ? c.closedBy : (c.by || '-');
          const timeStamp = (status === 'Complete' && c.completedTime)
            ? (c.completedTime instanceof Date ? c.completedTime.toLocaleString() : String(c.completedTime))
            : (c.time instanceof Date ? c.time.toLocaleString() : String(c.time || ''));
          checklist.push({
            name: cat,
            status: status,
            target: catTargetMap[cat] || cat.toLowerCase().replace(/\s+/g, '_'),
            tid: c.tid || '',
            by: byActor,
            time: timeStamp
          });
        }
      }
    }

    const userEmail = Session.getActiveUser().getEmail();
    context.isAdmin = AccessControlService.isAdmin(userEmail);

    context.checklist = checklist;
    context.type = 'End of Employment';
    return context;

  } catch (e) {
    Logger.log('getTerminationDetails Fatal Error: ' + e.toString());
    return { success: false, message: 'Server error: ' + e.message };
  }
}

/**
 * Get Details for Status Change Workflow Modal
 */
function getChangeDetails(workflowId) {
  try {
    if (!workflowId) return { success: false, message: 'No workflow ID provided' };

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const context = { success: true, id: workflowId, checklist: [], type: 'Status Change' };

    const reqSheet = ss.getSheetByName(CONFIG.SHEETS.POSITION_CHANGES);
    if (!reqSheet) return { success: false, message: 'Position Changes sheet missing' };

    const foundReq = reqSheet.getRange('A:A').createTextFinder(workflowId).matchEntireCell(true).findNext();
    if (!foundReq) return { success: false, message: 'Request ID not found in database' };

    const reqRowIndex = foundReq.getRow();
    const reqLastCol = reqSheet.getLastColumn();
    const reqHeaders = reqSheet.getRange(1, 1, 1, reqLastCol).getValues()[0];
    const reqRow = reqSheet.getRange(reqRowIndex, 1, 1, reqLastCol).getValues()[0];

    const r = {};
    const _tz = Session.getScriptTimeZone();
    reqHeaders.forEach(function(h, i) {
      if (h) {
        const val = reqRow[i];
        if (val instanceof Date) {
          r[h] = Utilities.formatDate(val, _tz, 'M/d/yyyy');
        } else if (val === undefined || val === null) {
          r[h] = '';
        } else {
          r[h] = String(val);
        }
      }
    });
    // Normalized aliases by index for reliable client-side snapshot access
    const _fmt = function(v) { return v instanceof Date ? Utilities.formatDate(v, _tz, 'M/d/yyyy') : String(v || ''); };
    r['Employee Name']   = r['Employee Name']   || _fmt(reqRow[5]);
    r['Requester Name']  = r['Requester Name']  || _fmt(reqRow[3]);
    r['Requester Email'] = r['Requester Email'] || _fmt(reqRow[4]);
    r['Effective Date']  = r['Effective Date']  || _fmt(reqRow[7]);
    r['Site Name']       = r['Site Name']       || _fmt(reqRow[8]);
    r['Change Type']     = r['Change Type']     || _fmt(reqRow[9]);
    r['Department']      = r['Department']      || _fmt(reqRow[21]);
    context.requestData = r;

    const wf = getWorkflow(workflowId);
    context.status = wf ? String(wf['Status'] || '') : '';
    context.step = wf ? String(wf['Current Step'] || '') : '';

    const checklist = [];

    checklist.push({
      name: 'Initial Request',
      status: 'Complete',
      target: 'change_request',
      by: r['Requester Email'] || 'Unknown',
      time: r['Timestamp'] || ''
    });

    const approvalSheet = ss.getSheetByName(CONFIG.SHEETS.POSITION_CHANGE_APPROVALS);
    if (approvalSheet) {
      const foundAppr = approvalSheet.getRange('A:A').createTextFinder(workflowId).matchEntireCell(true).findNext();
      if (foundAppr) {
        const apprRow = approvalSheet.getRange(foundAppr.getRow(), 1, 1, approvalSheet.getLastColumn()).getValues()[0];
        checklist.push({
          name: 'HR Approval',
          status: 'Complete',
          target: 'position_change_approval',
          by: apprRow[6] || 'HR',
          time: apprRow[2] instanceof Date ? apprRow[2].toLocaleString() : String(apprRow[2] || '')
        });
      } else {
        checklist.push({ name: 'HR Approval', status: 'Pending', target: 'position_change_approval' });
      }
    }

    const aiSheet = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
    if (aiSheet) {
      const aiData = aiSheet.getDataRange().getValues();
      if (aiData.length > 1) {
        const aiHeaders = aiData[0];
        const wfIdx          = aiHeaders.indexOf('Workflow ID');
        const catIdx         = aiHeaders.indexOf('Category');
        const tidIdx         = aiHeaders.indexOf('Task ID');
        const statusIdx      = aiHeaders.indexOf('Status');
        const assignIdx      = aiHeaders.indexOf('Assigned To');
        const closedByIdx    = aiHeaders.indexOf('Closed By');
        const completedDateIdx = aiHeaders.indexOf('Completed Date');
        const dateIdx        = aiHeaders.indexOf('Created Date');

        const categories = {};
        for (let i = 1; i < aiData.length; i++) {
          if (String(aiData[i][wfIdx]) !== workflowId) continue;
          const cat = aiData[i][catIdx] || 'Task';
          const isClosed = aiData[i][statusIdx] === 'Closed' || aiData[i][statusIdx] === 'Complete';
          if (!categories[cat]) {
            categories[cat] = { total: 0, complete: 0, by: aiData[i][assignIdx], time: aiData[i][dateIdx], tid: aiData[i][tidIdx] || '' };
          }
          categories[cat].total++;
          if (isClosed) {
            categories[cat].complete++;
            const closedBy = closedByIdx >= 0 ? aiData[i][closedByIdx] : '';
            if (closedBy) categories[cat].closedBy = closedBy;
            const completedDate = completedDateIdx >= 0 ? aiData[i][completedDateIdx] : null;
            if (completedDate) categories[cat].completedTime = completedDate;
          }
        }

        const catTargetMap = {
          'Manager':        'change_manager',
          'IT':             'change_it',
          'Purchasing':     'change_purchasing',
          'ID Setup':       'change_idsetup',
          'Safety':         'change_safety',
          'Business Cards': 'change_businesscards',
          'Credit Card':    'change_creditcard',
          'Fleetio':        'change_fleetio',
          'Jonas':          'change_jonas'
        };

        for (const cat in categories) {
          const c = categories[cat];
          const status = c.complete === c.total ? 'Complete' : 'Pending';
          const byActor = (status === 'Complete' && c.closedBy) ? c.closedBy : (c.by || '-');
          const timeStamp = (status === 'Complete' && c.completedTime)
            ? (c.completedTime instanceof Date ? c.completedTime.toLocaleString() : String(c.completedTime))
            : (c.time instanceof Date ? c.time.toLocaleString() : String(c.time || ''));
          checklist.push({
            name: cat,
            status: status,
            target: catTargetMap[cat] || cat.toLowerCase().replace(/\s+/g, '_'),
            tid: c.tid || '',
            by: byActor,
            time: timeStamp
          });
        }
      }
    }

    const userEmail = Session.getActiveUser().getEmail();
    context.isAdmin = AccessControlService.isAdmin(userEmail);
    context.checklist = checklist;
    return context;

  } catch (e) {
    Logger.log('getChangeDetails Fatal Error: ' + e.toString());
    return { success: false, message: 'Server error: ' + e.message };
  }
}

/**
 * Returns pending action items assigned to the current user.
 * Used by the Dashboard "My Tasks" panel so assignees can find their
 * open tasks without searching old email.
 */
function getMyPendingTasks() {
  try {
    const userEmail = Session.getActiveUser().getEmail().toLowerCase();
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const aiSheet = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
    if (!aiSheet) return { tasks: [] };

    const data = aiSheet.getDataRange().getValues();
    const headers = data[0];
    const wfIdx     = headers.indexOf('Workflow ID');
    const taskIdIdx = headers.indexOf('Task ID');
    const catIdx    = headers.indexOf('Category');
    const nameIdx   = headers.indexOf('Task Name');
    const assignIdx = headers.indexOf('Assigned To');
    const statusIdx = headers.indexOf('Status');
    const createdIdx= headers.indexOf('Created Date');
    const tz = Session.getScriptTimeZone();

    const tasks = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (String(row[statusIdx] || '') === 'Closed') continue;
      const assignedTo = String(row[assignIdx] || '').toLowerCase();
      // Assigned To may be comma-separated (e.g. HR + Payroll)
      const isAssigned = assignedTo.split(',').map(e => e.trim()).includes(userEmail);
      if (!isAssigned) continue;

      const wfId = String(row[wfIdx] || '');
      const wf   = getWorkflow(wfId);
      const createdVal = row[createdIdx];
      const createdStr = createdVal instanceof Date
        ? Utilities.formatDate(createdVal, tz, 'yyyy/MM/dd')
        : String(createdVal || '');

      tasks.push({
        tid:          String(row[taskIdIdx] || ''),
        workflowId:   wfId,
        category:     String(row[catIdx]  || ''),
        taskName:     String(row[nameIdx] || ''),
        employeeName: wf ? (wf['Employee Name'] || '') : '',
        status:       String(row[statusIdx] || ''),
        created:      createdStr
      });
    }
    return { tasks: tasks };
  } catch(e) {
    Logger.log('[getMyPendingTasks] Error: ' + e.message);
    return { tasks: [] };
  }
}

/**
 * Returns active workflow counts per step for the process map live-status badges.
 */
function getWorkflowMapStats() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const wfSheet = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
    if (!wfSheet) return { onboarding: {}, eoe: {} };

    const data    = wfSheet.getDataRange().getValues();
    const headers = data[0];
    const wfIdIdx  = headers.indexOf('Workflow ID');
    const statusIdx= headers.indexOf('Status');
    const stepIdx  = headers.indexOf('Current Step');

    const onbCounts = {};
    const eoeCounts = {};

    for (let i = 1; i < data.length; i++) {
      const wfId   = String(data[i][wfIdIdx]   || '');
      const status = String(data[i][statusIdx]  || '');
      const step   = String(data[i][stepIdx]    || '');
      if (!wfId) continue;
      if (status === 'Cancelled' || status === 'Complete' || status === 'Completed') continue;

      if (wfId.startsWith('TERM_')) {
        eoeCounts[step] = (eoeCounts[step] || 0) + 1;
      } else if (!wfId.startsWith('CHANGE_') && !wfId.startsWith('EQUIP_')) {
        onbCounts[step] = (onbCounts[step] || 0) + 1;
      }
    }
    return { onboarding: onbCounts, eoe: eoeCounts };
  } catch(e) {
    Logger.log('[getWorkflowMapStats] Error: ' + e.message);
    return { onboarding: {}, eoe: {} };
  }
}

