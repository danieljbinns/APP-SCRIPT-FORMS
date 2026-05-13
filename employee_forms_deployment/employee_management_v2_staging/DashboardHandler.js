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
      const TR = SCHEMA.TERMINATIONS;
      for (let i = SCHEMA.ROW.FIRST_DATA; i < tData.length; i++) {
        const wfId = String(tData[i][TR.WORKFLOW_ID] || '');
        if (wfId) termEmpTypeMap[wfId] = String(tData[i][TR.EMPLOYEE_TYPE] || '');
      }
    }

    // Read the flat materialized view — single bulk read
    const data = viewSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return JSON.stringify({ success: true, workflows: [], currentUser: userEmail, canEditDates: canEditDates });
    }

    const tz = Session.getScriptTimeZone();
    const fmtDate = (v) => {
      if (v instanceof Date) return Utilities.formatDate(v, tz, 'M/d/yyyy');
      const s = String(v || '');
      if (!s) return '';
      try { const d = new Date(s.replace(/\//g, '-').substring(0, 10) + 'T00:00:00'); if (!isNaN(d.getTime())) return Utilities.formatDate(d, tz, 'M/d/yyyy'); } catch(e) {}
      return s;
    };
    const fmtDateTime = (v) => {
      if (v instanceof Date) return Utilities.formatDate(v, tz, 'M/d/yyyy h:mm a');
      const s = String(v || '');
      if (!s) return '';
      try { const d = new Date(s.replace(/\//g, '-')); if (!isNaN(d.getTime())) return Utilities.formatDate(d, tz, 'M/d/yyyy h:mm a'); } catch(e) {}
      return s;
    };

    const DV = SCHEMA.DASHBOARD_VIEW;
    const flows = data.slice(1).map(row => {
      let items = {};
      try { if (row[DV.REQUESTED_ITEMS_JSON]) items = JSON.parse(String(row[DV.REQUESTED_ITEMS_JSON])); } catch (e) {}
      const workflowId = String(row[DV.WORKFLOW_ID] || '');
      return {
        id: workflowId,
        employee:       String(row[DV.EMPLOYEE_NAME]    || ''),
        status:         String(row[DV.GLOBAL_STATUS]    || ''),
        step:           String(row[DV.GRANULAR_STEP]    || ''),
        requesterName:  String(row[DV.REQUESTER_NAME]   || ''),
        requesterEmail: String(row[DV.REQUESTER_EMAIL]  || ''),
        initiator:      String(row[DV.REQUESTER_EMAIL]  || row[DV.INITIATOR_EMAIL] || '-'),
        dateRequested:  fmtDate(row[DV.DATE_REQUESTED]),
        lastUpdated:    fmtDateTime(row[DV.LAST_UPDATED]),
        managerEmail:   String(row[DV.MANAGER_EMAIL]    || ''),
        requestedItems: items,
        pendingItems:   [],
        hireDate:       fmtDate(row[DV.HIRE_DATE]),
        site:           String(row[DV.SITE]             || ''),
        empType:        String(row[DV.EMPLOYMENT_TYPE]  || '') || (workflowId.startsWith('TERM_') ? (termEmpTypeMap[workflowId] || '') : ''),
        type: workflowId.startsWith('TERM_') ? 'End of Employment' : (workflowId.startsWith('CHANGE_') ? 'Status Change' : (workflowId.startsWith('EQUIP_REQ_') ? 'Equipment' : 'Onboarding'))
      };
    }).filter(wf => {
      return wf.status !== 'Cancelled' && wf.status !== 'Inactive';
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
          const wfId = String(row[SCHEMA.TERMINATIONS.WORKFLOW_ID] || '');
          if (!wfId || flowIds.has(wfId)) return;

          const TR = SCHEMA.TERMINATIONS;

          let statusStr = row[TR.HR_APPROVED_STATUS] ? 'Approved' : 'Pending Approval';
          let stepStr   = row[TR.HR_APPROVED_STATUS] ? 'Action Items Pending' : 'HR Approval Needed';

          if (wfMap[wfId]) {
            if      (wfMap[wfId].status === 'Complete')   { statusStr = 'Complete';   stepStr = wfMap[wfId].step || 'All Actions Completed'; }
            else if (wfMap[wfId].status === 'Rejected')   { statusStr = 'Rejected';   stepStr = wfMap[wfId].step || 'Rejected'; }
            else if (wfMap[wfId].status === 'Cancelled' || wfMap[wfId].status === 'Inactive') { return; }
            else if (wfMap[wfId].status === 'In Progress') { stepStr  = wfMap[wfId].step || stepStr; } // B3 fix
          }

          flows.push({
            id:             wfId,
            employee:       String(row[TR.EMPLOYEE_NAME]    || ''),
            status:         statusStr,
            step:           stepStr,
            requesterName:  String(row[TR.REQUESTER_NAME]   || ''),
            requesterEmail: String(row[TR.REQUESTER_EMAIL]  || ''),
            initiator:      String(row[TR.REQUESTER_EMAIL]  || '-'),
            dateRequested:  fmtDate(row[TR.TIMESTAMP]),
            lastUpdated:    fmtDateTime(row[TR.TIMESTAMP]),
            managerEmail:   String(row[TR.MANAGER_EMAIL]    || ''),
            hireDate:       fmtDate(row[TR.TERM_DATE]),
            site:           String(row[TR.SITE]             || ''),
            empType:        String(row[TR.EMPLOYEE_TYPE]    || ''),
            requestedItems: {},
            pendingItems:   [],
            type: 'End of Employment'
          });
        });
      }
    }

    flows.reverse();

    const isAdmin = AccessControlService.isAdmin(userEmail);
    return JSON.stringify({ success: true, workflows: flows, currentUser: userEmail, canEditDates: canEditDates, isAdmin: isAdmin });

  } catch (error) {
    Logger.log('Dashboard Error: ' + error.toString());
    return JSON.stringify({ success: false, message: error.message });
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
        ? Utilities.formatDate(createdVal, tz, 'M/d/yyyy')
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
