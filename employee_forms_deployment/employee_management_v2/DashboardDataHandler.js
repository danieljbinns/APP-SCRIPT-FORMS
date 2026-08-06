/**
 * DashboardDataHandler.js
 *
 * Read-only data functions for the Dashboard.
 * No auth gating — all authenticated domain users get unfiltered workflow data
 * (speed > per-row security per design decision).
 *
 * Functions:
 *   getDashboardData()       — flat workflow list + rolePayload for the caller
 *   getMyTaskCounts()        — open task counts per category (dual-source)
 *   getWorkflowMapStats()    — active workflow counts per step for WorkflowMap
 *
 * Depends on (global GAS scope):
 *   CONFIG, SCHEMA                       — SchemaConstants.js / Config.js
 *   AccessControlService                 — Services/AccessControlService.js
 */

// ─────────────────────────────────────────────────────────────────────────────
// getDashboardData
// Returns ALL non-Cancelled/Inactive workflows + caller's rolePayload.
// Single bulk read from Dashboard_View (materialized cache).
// ─────────────────────────────────────────────────────────────────────────────

function getDashboardData() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const viewSheet = ss.getSheetByName(CONFIG.SHEETS.DASHBOARD_VIEW);

    if (!viewSheet) {
      return JSON.stringify({ success: false, message: 'Dashboard_View sheet not found. Please run Setup.' });
    }

    const userEmail = Session.getActiveUser().getEmail();

    // Resolve role ONCE — client caches in sessionStorage
    const rolePayload = AccessControlService.getUserRolePayload(userEmail);
    const canEditDates = rolePayload.canEditDates;

    // Pre-load empType from Terminations sheet so existing TERM_ rows in Dashboard_View
    // (synced before the empType fix) can be supplemented without a full re-sync.
    const termEmpTypeMap = {};
    const termSheetForType = ss.getSheetByName(CONFIG.SHEETS.TERMINATIONS);
    let tData = [];
    if (termSheetForType) {
      tData = termSheetForType.getDataRange().getValues();
      const TR = SCHEMA.TERMINATIONS;
      for (let i = SCHEMA.ROW.FIRST_DATA; i < tData.length; i++) {
        const wfId = String(tData[i][TR.WORKFLOW_ID] || '');
        if (wfId) termEmpTypeMap[wfId] = String(tData[i][TR.EMPLOYEE_TYPE] || '');
      }
    }

    // Read the flat materialized view — single bulk read
    const data = viewSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return JSON.stringify({ success: true, workflows: [], currentUser: userEmail, canEditDates: canEditDates, rolePayload: rolePayload });
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

    // Build open-category map from Action Items sheet — used to power filterByCategory on the client.
    // One bulk read here avoids any per-workflow server round-trips.
    const openCategoriesMap = {};
    const aiSheetForMap = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
    if (aiSheetForMap && aiSheetForMap.getLastRow() > 1) {
      const aiMapData    = aiSheetForMap.getDataRange().getValues();
      const aiMapHeaders = aiMapData[0];
      const aiWfIdx      = aiMapHeaders.indexOf('Workflow ID');
      const aiCatIdx     = aiMapHeaders.indexOf('Category');
      const aiStatIdx    = aiMapHeaders.indexOf('Status');
      for (let i = 1; i < aiMapData.length; i++) {
        // Skip anything that is not Open — Closed, Cancelled, N/A all excluded.
        // Matches getMyTaskCounts() logic: only Open items count as "open categories".
        if (String(aiMapData[i][aiStatIdx] || '') !== 'Open') continue;
        const wfId = String(aiMapData[i][aiWfIdx] || '');
        const cat  = String(aiMapData[i][aiCatIdx] || '');
        if (!wfId || !cat) continue;
        if (!openCategoriesMap[wfId]) openCategoriesMap[wfId] = [];
        if (!openCategoriesMap[wfId].includes(cat)) openCategoriesMap[wfId].push(cat);
      }
    }

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
        type: workflowId.startsWith('TERM_') ? 'End of Employment' : (workflowId.startsWith('CHANGE_') ? 'Status Change' : (workflowId.startsWith('EQUIP_REQ_') ? 'Equipment' : 'Onboarding')),
        openCategories: openCategoriesMap[workflowId] || []
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

    const termSheet = termSheetForType; // reuse — already read above for termEmpTypeMap
    if (termSheet) {
      const termData = tData; // reuse data already fetched
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
            else if (wfMap[wfId].status === 'In Progress') { stepStr  = wfMap[wfId].step || stepStr; }
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
            type:           'End of Employment',
            openCategories: openCategoriesMap[wfId] || []
          });
        });
      }
    }

    flows.reverse();

    return JSON.stringify({
      success:     true,
      workflows:   flows,
      currentUser: userEmail,
      canEditDates: canEditDates,
      isAdmin:     rolePayload.isAdmin,
      rolePayload: rolePayload
    });

  } catch (error) {
    Logger.log('getDashboardData Error: ' + error.toString());
    return JSON.stringify({ success: false, message: error.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getMyTaskCounts
// Replaces getMyPendingTasks(). Dual-source:
//   • Action Items sheet   → specialist / EOE / change action item categories
//   • Workflows sheet      → IT Setup / HR Verification / ID Setup (step-based)
//
// Returns counts for ALL categories regardless of caller's role.
// Role gating is client-side only (rolePayload in sessionStorage).
// ─────────────────────────────────────────────────────────────────────────────

function getMyTaskCounts() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

    // Workflow type derived from the ID prefix (same rule as getDashboardData / StateSync).
    // Type labels match the client TYPE_MAP values so the dashboard can sum buckets per filter.
    const TYPES = ['Onboarding', 'End of Employment', 'Status Change', 'Equipment'];
    function typeOf(wfId) {
      wfId = String(wfId || '');
      if (wfId.startsWith('TERM_'))      return 'End of Employment';
      if (wfId.startsWith('CHANGE_'))    return 'Status Change';
      if (wfId.startsWith('EQUIP_REQ_')) return 'Equipment';
      return 'Onboarding';
    }
    function blankCounts() {
      return {
        'Safety':           0,
        'Fleet':            0,   // renamed from Fleetio
        'Business Cards':   0,
        'Purchasing':       0,   // renamed from Jonas
        'Finance':          0,   // renamed from Credit Card
        '30/60/90 Review':  0,
        'JR Title':         0,
        'Assets':           0,
        'IT':               0,   // IT button (action items)
        'IT Confirmation':  0,   // IT CONF button
        'HR':               0,   // ADP/HR button (part 1 — HR Systems Deactivation)
        'Payroll':          0,   // ADP/HR button (part 2 — ADP Deactivation)
        'EOE':              0,
        'Manager':          0,
        'WIS':              0,   // WIS button (WIS Assignment + BOSS WIS Records Update)
        'ID Setup':         0,   // ID SETUP button — action items + step (additive, same key)
        'Deactivation':     0,   // DEACTIVATION button (EOE Employee Deactivation)
        'HR Verification':  0,   // ADP/HR button — step-based part
      };
    }

    // Grand total (back-compat `counts`) + per-type buckets (`countsByType`).
    const total  = blankCounts();
    const byType = {};
    TYPES.forEach(function(t) { byType[t] = blankCounts(); });

    function add(wfId, cat, n) {
      if (total.hasOwnProperty(cat)) total[cat] += n;
      const b = byType[typeOf(wfId)];
      if (b.hasOwnProperty(cat)) b[cat] += n;
    }

    // ── Source 1: Action Items sheet (Open only) ──────────────────────────────
    const aiSheet = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
    if (aiSheet && aiSheet.getLastRow() > 1) {
      const aiData    = aiSheet.getDataRange().getValues();
      const aiHeaders = aiData[0];
      const wfIdx     = aiHeaders.indexOf('Workflow ID');
      const catIdx    = aiHeaders.indexOf('Category');
      const statusIdx = aiHeaders.indexOf('Status');
      for (let i = 1; i < aiData.length; i++) {
        if (String(aiData[i][statusIdx] || '') !== 'Open') continue;
        add(aiData[i][wfIdx], String(aiData[i][catIdx] || ''), 1);
      }
    }

    // ── Source 2: Workflows sheet — step-based counts ─────────────────────────
    const wfSheet = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
    if (wfSheet && wfSheet.getLastRow() > 1) {
      const wfData    = wfSheet.getDataRange().getValues();
      const wfHeaders = wfData[0];
      const wfIdIdx   = wfHeaders.indexOf('Workflow ID');
      const statusIdx = wfHeaders.indexOf('Status');
      const stepIdx   = wfHeaders.indexOf('Current Step');
      for (let i = 1; i < wfData.length; i++) {
        const status = String(wfData[i][statusIdx] || '');
        if (status === 'Cancelled' || status === 'Complete' || status === 'Completed' || status === 'Inactive') continue;
        const step = String(wfData[i][stepIdx] || '').toLowerCase();
        const wfId = wfData[i][wfIdIdx];
        // Exact step name matching — 'ID Setup Complete' must NOT count as ID Setup pending.
        // Legacy 'ID Setup Complete' (pre-fix workflows) maps to HR Verification.
        if      (step === 'it setup needed')                                         add(wfId, 'IT', 1);
        else if (step === 'hr verification needed' || step === 'id setup complete')  add(wfId, 'HR Verification', 1);
        else if (step === 'id setup needed')                                         add(wfId, 'ID Setup', 1);
      }
    }

    return { success: true, counts: total, countsByType: byType };

  } catch (e) {
    Logger.log('[getMyTaskCounts] Error: ' + e.message);
    return { success: false, counts: {}, countsByType: {} };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getWorkflowMapStats
// Returns active workflow counts per step for the process map live-status badges.
// ─────────────────────────────────────────────────────────────────────────────

function getWorkflowMapStats() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const wfSheet = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
    if (!wfSheet) return { success: false, onboarding: {}, eoe: {} };

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
    return { success: true, onboarding: onbCounts, eoe: eoeCounts };
  } catch(e) {
    Logger.log('[getWorkflowMapStats] Error: ' + e.message);
    return { success: false, onboarding: {}, eoe: {} };
  }
}
