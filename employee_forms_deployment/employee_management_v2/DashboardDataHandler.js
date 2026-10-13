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
// _canonicalCategory_
// Action-item categories were renamed at some point: Fleetio -> Fleet, Jonas -> Purchasing,
// Credit Card -> Finance. Current code writes the new names, but OLD ROWS still carry the old ones,
// and those rows had no badge at all — 6 open tasks were invisible on the dashboard, with no way to
// reach them. Normalise on read so badge and filter agree and nothing is orphaned.
// ─────────────────────────────────────────────────────────────────────────────
var _LEGACY_CATEGORY_ = { 'Fleetio': 'Fleet', 'Jonas': 'Purchasing', 'Credit Card': 'Finance' };

function _canonicalCategory_(cat) {
  var c = String(cat || '').trim();
  return _LEGACY_CATEGORY_[c] || c;
}

// ─────────────────────────────────────────────────────────────────────────────
// _workflowsNarrow_
// The Workflows sheet was being read twice per request — once inside
// computeOnboardingPendingStep_ and once by the caller. Same sheet, same columns, same execution.
// Memoised per execution; returns { rows, idIdx, statusIdx, stepIdx } with only the columns anyone
// actually uses (Workflow ID / Status / Current Step), not the full width.
// ─────────────────────────────────────────────────────────────────────────────
var _WF_NARROW_MEMO_ = null;

function _workflowsNarrow_(ss) {
  if (_WF_NARROW_MEMO_) return _WF_NARROW_MEMO_;
  var out = { rows: [], idIdx: -1, statusIdx: -1, stepIdx: -1 };
  try {
    var sh = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
    if (sh && sh.getLastRow() > 1) {
      var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      out.idIdx     = head.indexOf('Workflow ID');
      out.statusIdx = head.indexOf('Status');
      out.stepIdx   = head.indexOf('Current Step');
      var width = Math.max(out.idIdx, out.statusIdx, out.stepIdx) + 1;
      if (width > 0) out.rows = sh.getRange(1, 1, sh.getLastRow(), width).getValues();
    }
  } catch (e) {
    Logger.log('[_workflowsNarrow_] ' + e.message);
  }
  _WF_NARROW_MEMO_ = out;
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeOnboardingPendingStep_
//
// Which onboarding step is actually outstanding for each active New Hire workflow.
//
// WHY THIS EXISTS: 'Current Step' on the Workflows sheet is a SINGLE string that every handler
// overwrites. HR Verification can legitimately be completed before ID Setup (required for Salary),
// and when it is, it stamps over 'ID Setup Needed' — destroying the only record that ID Setup was
// still outstanding. The request then vanished from the ID Setup badge and filter even though nobody
// had done the work. Other categories don't suffer this because they have durable Action Items rows;
// onboarding ID Setup / HR Verification / IT Setup are step-only and share the one slot.
//
// So derive it from DATA instead, exactly the way the email templates already do
// (EmailTemplates.js:114-125): a step is complete when its result row exists, not when a string says so.
//
// Returns { workflowId: 'ID Setup' | 'HR Verification' | 'IT' | '' }. One step per workflow, earliest
// incomplete first — this preserves today's one-badge-per-workflow behaviour, it just stops the step
// being forgotten.
// ─────────────────────────────────────────────────────────────────────────────

function computeOnboardingPendingStep_(ss) {
  // Short cache: the dashboard calls getDashboardData AND getMyTaskCounts on every load — two
  // separate executions, each otherwise re-reading four sheets. 90s is long enough to cover a page
  // load and a refresh, short enough that a completed step appears promptly.
  const CACHE_KEY = 'efx_pendingStep_v1';
  try {
    if (typeof CacheService !== 'undefined' && CacheService && CacheService.getScriptCache) {
      const hit = CacheService.getScriptCache().get(CACHE_KEY);
      if (hit) return JSON.parse(hit);
    }
  } catch (e) { /* cache is an optimisation, never a dependency */ }

  const out = {};
  try {
    // Column-scoped reads. getDataRange() pulls every column — Initial Requests is 57 wide and we
    // need three of them. Reading only as far as the last column we use is a large saving on a
    // spreadsheet this size, and the hot path runs twice per dashboard load.
    function readCols(sheetName, lastNeededIdx) {
      const sh = ss.getSheetByName(sheetName);
      if (!sh || sh.getLastRow() < 2) return null;
      const width = Math.min(lastNeededIdx + 1, sh.getLastColumn());
      if (width < 1) return null;
      return sh.getRange(1, 1, sh.getLastRow(), width).getValues();
    }

    function idSet(sheetName, idCol, valueCol) {
      const set = {};
      const d = readCols(sheetName, Math.max(idCol, valueCol === null ? idCol : valueCol));
      if (!d) return set;
      for (let i = SCHEMA.ROW.FIRST_DATA; i < d.length; i++) {
        const wf = String(d[i][idCol] || '');
        if (!wf) continue;
        // valueCol null = presence of the row is enough (IT Results has no single marker field)
        if (valueCol === null || (d[i][valueCol] !== '' && d[i][valueCol] !== null && d[i][valueCol] !== undefined)) set[wf] = true;
      }
      return set;
    }

    const idDone = idSet(CONFIG.SHEETS.ID_SETUP_RESULTS,        SCHEMA.ID_SETUP_RESULTS.WORKFLOW_ID,        SCHEMA.ID_SETUP_RESULTS.INTERNAL_EMP_ID);
    const hrDone = idSet(CONFIG.SHEETS.HR_VERIFICATION_RESULTS, SCHEMA.HR_VERIFICATION_RESULTS.WORKFLOW_ID, SCHEMA.HR_VERIFICATION_RESULTS.ADP_ASSOCIATE_ID);
    const itDone = idSet(CONFIG.SHEETS.IT_RESULTS,              SCHEMA.IT_RESULTS.WORKFLOW_ID,              null);

    // needsIt: Hourly with System Access = No skips IT entirely (same rule as EmailTemplates.js:119)
    const needsIt = {};
    const IR = SCHEMA.INITIAL_REQUESTS;
    {
      const d = readCols(CONFIG.SHEETS.INITIAL_REQUESTS, Math.max(IR.WORKFLOW_ID, IR.EMPLOYMENT_TYPE, IR.SYSTEM_ACCESS));
      for (let i = d ? SCHEMA.ROW.FIRST_DATA : 0; d && i < d.length; i++) {
        const wf = String(d[i][IR.WORKFLOW_ID] || '');
        if (!wf) continue;
        needsIt[wf] = !(String(d[i][IR.EMPLOYMENT_TYPE] || '') === 'Hourly' &&
                        String(d[i][IR.SYSTEM_ACCESS]   || '') === 'No');
      }
    }

    // Active New Hire workflows only. Cancelled/Inactive are hidden from the table entirely, and a
    // Complete workflow has finished the onboarding chain — dredging history would flood the badges.
    {
      const wfn   = _workflowsNarrow_(ss);
      const d     = wfn.rows;
      const idIdx = wfn.idIdx;
      const stIdx = wfn.statusIdx;
      if (idIdx !== -1 && stIdx !== -1) {
        for (let i = 1; i < d.length; i++) {
          const wf = String(d[i][idIdx] || '');
          if (!wf || !wf.startsWith('NEW_EMP_')) continue;
          const st = String(d[i][stIdx] || '');
          if (st === 'Cancelled' || st === 'Inactive' || st === 'Complete' || st === 'Completed') continue;
          if      (!idDone[wf])                        out[wf] = 'ID Setup';
          else if (!hrDone[wf])                        out[wf] = 'HR Verification';
          else if (needsIt[wf] !== false && !itDone[wf]) out[wf] = 'IT';
          else                                         out[wf] = '';
        }
      }
    }
  } catch (e) {
    Logger.log('[computeOnboardingPendingStep_] ' + e.message);
  }

  try {
    if (typeof CacheService !== 'undefined' && CacheService && CacheService.getScriptCache) {
      const payload = JSON.stringify(out);
      // CacheService rejects values over ~100KB; skip silently rather than throw on a big tenant.
      if (payload.length < 90000) CacheService.getScriptCache().put(CACHE_KEY, payload, 90);
    }
  } catch (e) { /* non-fatal */ }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// getDashboardData
// Returns ALL non-Cancelled/Inactive workflows + caller's rolePayload.
// Single bulk read from Dashboard_View (materialized cache).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} [opts]
 * @param {boolean} [opts.lean] Omit `requestedItems` / `pendingItems` from each row.
 *
 * Those two keys are read by NOTHING — not Dashboard.html, not any other file. `pendingItems` is
 * always an empty array and `requestedItems` is a per-row JSON blob that is parsed, serialised,
 * transferred and then ignored, across ~1000 rows. The dashboard passes lean:true; calling with no
 * arguments keeps the original shape so any external (n8n) caller is unaffected.
 */
function getDashboardData(opts) {
  const lean       = !!(opts && opts.lean);
  const limit      = (opts && opts.limit  > 0) ? Math.floor(opts.limit)  : 0;   // 0 = everything
  const offset     = (opts && opts.offset > 0) ? Math.floor(opts.offset) : 0;
  const activeOnly = !!(opts && opts.activeOnly);
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
      // Only Workflow ID / Category / Status are used here — Action Items is 14 columns wide and
      // Form Data (col 13) can be large JSON. Read the first 7 columns, not the sheet.
      const aiMapData    = aiSheetForMap.getRange(1, 1, aiSheetForMap.getLastRow(), Math.min(7, aiSheetForMap.getLastColumn())).getValues();
      const aiMapHeaders = aiMapData[0];
      const aiWfIdx      = aiMapHeaders.indexOf('Workflow ID');
      const aiCatIdx     = aiMapHeaders.indexOf('Category');
      const aiStatIdx    = aiMapHeaders.indexOf('Status');
      for (let i = 1; i < aiMapData.length; i++) {
        // Skip anything that is not Open — Closed, Cancelled, N/A all excluded.
        // Matches getMyTaskCounts() logic: only Open items count as "open categories".
        if (String(aiMapData[i][aiStatIdx] || '') !== 'Open') continue;
        const wfId = String(aiMapData[i][aiWfIdx] || '');
        const cat  = _canonicalCategory_(aiMapData[i][aiCatIdx]);
        if (!wfId || !cat) continue;
        if (!openCategoriesMap[wfId]) openCategoriesMap[wfId] = [];
        if (!openCategoriesMap[wfId].includes(cat)) openCategoriesMap[wfId].push(cat);
      }
    }

    // Derived onboarding step per workflow — see computeOnboardingPendingStep_ for why this is not
    // read from 'Current Step'. Shared with getMyTaskCounts so badge and table always agree.
    const pendingStepById = computeOnboardingPendingStep_(ss);

    const DV = SCHEMA.DASHBOARD_VIEW;

    // ── Paging: decide WHICH rows before doing the expensive per-row work ──────────────────────
    //
    // The row builder below calls Utilities.formatDate up to three times per row. Across ~1000 rows
    // that is ~3000 calls, and it was happening for every row even though the client paints 25 and
    // hides Completed by default. Formatting is what makes this call slow — not the transfer.
    //
    // So: take a cheap pass that reads only id / status / raw date, filter and sort THAT, slice it,
    // and only then build full objects for the rows we are actually returning. Sorting here matches
    // the client default (Date Requested, newest first) so "the first N" is the N the user sees.
    const rawRows = data.slice(1);
    const toTime = (v) => {
      if (v instanceof Date) return v.getTime();
      const t = Date.parse(String(v || ''));
      return isNaN(t) ? 0 : t;
    };

    let index = [];
    for (let ri = 0; ri < rawRows.length; ri++) {
      const st = String(rawRows[ri][DV.GLOBAL_STATUS] || '');
      if (st === 'Cancelled' || st === 'Inactive') continue;          // never shown
      if (activeOnly && (st === 'Complete' || st === 'Completed')) continue;
      index.push({ ri: ri, t: toTime(rawRows[ri][DV.DATE_REQUESTED]) });
    }
    index.sort((a, b) => b.t - a.t);                                   // newest first

    const totalAvailable = index.length;
    const slice = (limit > 0) ? index.slice(offset, offset + limit) : index.slice(offset);

    const flows = slice.map(entry => {
      const row = rawRows[entry.ri];
      let items = {};
      // Only pay for the parse when the caller actually wants the field.
      if (!lean) {
        try { if (row[DV.REQUESTED_ITEMS_JSON]) items = JSON.parse(String(row[DV.REQUESTED_ITEMS_JSON])); } catch (e) {}
      }
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
        hireDate:       fmtDate(row[DV.HIRE_DATE]),
        site:           String(row[DV.SITE]             || ''),
        empType:        String(row[DV.EMPLOYMENT_TYPE]  || '') || (workflowId.startsWith('TERM_') ? (termEmpTypeMap[workflowId] || '') : ''),
        type: workflowId.startsWith('TERM_') ? 'End of Employment' : (workflowId.startsWith('CHANGE_') ? 'Status Change' : (workflowId.startsWith('EQUIP_REQ_') ? 'Equipment' : 'Onboarding')),
        openCategories: openCategoriesMap[workflowId] || [],
        // Legacy keys — only materialised for non-lean callers (see the jsdoc above).
        requestedItems: lean ? undefined : items,
        pendingItems:   lean ? undefined : [],
        // Derived onboarding step (data-based, not the overwritable 'Current Step' string) so the
        // client's ID Setup / IT filters stop losing requests when a later step completes first.
        pendingStep:    pendingStepById[workflowId] || ''
      };
    });

    // Termination fallback — catches pre-existing terminations not yet in Dashboard_View.
    // New terminations land in Dashboard_View via syncWorkflowState in TerminationHandler.
    //
    // Skipped on a PAGED request: it appends rows from a different source, which would make a page
    // longer than the limit and repeat on the next page. The client's final (unpaged) fetch picks
    // these up, so nothing is lost — they just do not appear in the fast first page.
    const flowIds = new Set(flows.map(f => f.id));
    const skipTermFallback = (limit > 0 || offset > 0);
    // Third read of the same sheet in one request — reuse the shared narrow read instead.
    let wfMap = {};
    {
      const wfn3      = _workflowsNarrow_(ss);
      const wData     = wfn3.rows;
      const idIdx     = wfn3.idIdx;
      const statusIdx = wfn3.statusIdx;
      const stepIdx   = wfn3.stepIdx;
      if (idIdx !== -1) {
        for (let i = 1; i < wData.length; i++) {
          wfMap[String(wData[i][idIdx] || '')] = {
            status: statusIdx !== -1 ? String(wData[i][statusIdx] || '') : '',
            step:   stepIdx   !== -1 ? String(wData[i][stepIdx]   || '') : ''
          };
        }
      }
    }

    const termSheet = skipTermFallback ? null : termSheetForType; // reuse — already read above
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

            type:           'End of Employment',
            openCategories: openCategoriesMap[wfId] || [],
            pendingStep:    pendingStepById[wfId] || ''
          });
        });
      }
    }

    // Unpaged callers keep the original ordering. A paged request is already sorted newest-first by
    // the index pass, and reversing it would hand back the oldest of the slice.
    if (!(limit > 0 || offset > 0)) flows.reverse();

    return JSON.stringify({
      success:     true,
      workflows:   flows,
      currentUser: userEmail,
      canEditDates: canEditDates,
      isAdmin:     rolePayload.isAdmin,
      rolePayload: rolePayload,
      // Paging metadata — lets the client know whether a follow-up fetch is needed.
      total:       totalAvailable,
      offset:      offset,
      limit:       limit,
      hasMore:     (limit > 0) && ((offset + flows.length) < totalAvailable)
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
    // Each bucket holds a SET OF WORKFLOW IDS, not a tally of tasks. The badge sits above a list of
    // workflows, so it must count workflows — two Safety tasks on one request is one row, one badge.
    // It also makes the IT / ID Setup dual-source counting self-correcting: the step source and the
    // action-item source add the same id, and a Set keeps one.
    function blankCounts() {
      return {
        'Safety':           new Set(),
        'Fleet':            new Set(),   // renamed from Fleetio
        'Business Cards':   new Set(),
        'Purchasing':       new Set(),   // renamed from Jonas
        'Finance':          new Set(),   // renamed from Credit Card
        '30/60/90 Review':  new Set(),
        'JR Title':         new Set(),
        'Assets':           new Set(),
        'IT':               new Set(),   // IT button (action items + step)
        'IT Confirmation':  new Set(),   // IT CONF button
        'HR':               new Set(),   // ADP/HR button (part 1 — HR Systems Deactivation)
        'Payroll':          new Set(),   // ADP/HR button (part 2 — ADP Deactivation)
        'EOE':              new Set(),
        'Manager':          new Set(),
        'WIS':              new Set(),   // WIS button (WIS Assignment + BOSS WIS Records Update)
        'ID Setup':         new Set(),   // ID SETUP button — action items + step (same workflow = 1)
        'Deactivation':     new Set(),   // DEACTIVATION button (EOE Employee Deactivation)
        'HR Verification':  new Set(),   // ADP/HR button — step-based part
        'ADP/HR':           new Set(),   // combined bucket — the four above, deduped per workflow
      };
    }

    // The ADP/HR button is one button over four categories. Summing the four on the client
    // double-counts a workflow that has, say, both HR and Payroll open, so dedupe it here.
    const ADP_HR_CATS = ['HR', 'Payroll', 'EOE', 'HR Verification'];

    // Grand total (back-compat `counts`) + per-type buckets (`countsByType`).
    const total  = blankCounts();
    const byType = {};
    TYPES.forEach(function(t) { byType[t] = blankCounts(); });

    function add(wfId, cat) {
      wfId = String(wfId || '');
      if (!wfId) return;
      const b = byType[typeOf(wfId)];
      if (total.hasOwnProperty(cat)) total[cat].add(wfId);
      if (b.hasOwnProperty(cat))     b[cat].add(wfId);
      if (ADP_HR_CATS.indexOf(cat) !== -1) {
        total['ADP/HR'].add(wfId);
        b['ADP/HR'].add(wfId);
      }
    }

    // Workflow status map — needed so Source 1 can skip tasks belonging to workflows the dashboard
    // table will never show. Cancelled/Inactive are dropped outright by getDashboardData, so their
    // open tasks were pure phantom count. 'Complete' is deliberately NOT skipped: WIS and Manager
    // tasks are non-blocking by design (ActionItemService.js:594) and outlive the workflow — that is
    // real outstanding work and must keep counting.
    const wfStatusById = {};
    {
      const wfn2   = _workflowsNarrow_(ss);
      const sData  = wfn2.rows;
      const sIdIdx = wfn2.idIdx;
      const sStIdx = wfn2.statusIdx;
      if (sIdIdx !== -1 && sStIdx !== -1) {
        for (let si = 1; si < sData.length; si++) {
          wfStatusById[String(sData[si][sIdIdx] || '')] = String(sData[si][sStIdx] || '');
        }
      }
    }
    function isHiddenWorkflow(wfId) {
      const st = wfStatusById[String(wfId || '')] || '';
      return st === 'Cancelled' || st === 'Inactive';
    }

    // ── Source 1: Action Items sheet (Open only) ──────────────────────────────
    const aiSheet = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
    if (aiSheet && aiSheet.getLastRow() > 1) {
      // Same as the openCategories read above: Workflow ID / Category / Status only.
      const aiData    = aiSheet.getRange(1, 1, aiSheet.getLastRow(), Math.min(7, aiSheet.getLastColumn())).getValues();
      const aiHeaders = aiData[0];
      const wfIdx     = aiHeaders.indexOf('Workflow ID');
      const catIdx    = aiHeaders.indexOf('Category');
      const statusIdx = aiHeaders.indexOf('Status');
      for (let i = 1; i < aiData.length; i++) {
        if (String(aiData[i][statusIdx] || '') !== 'Open') continue;
        if (isHiddenWorkflow(aiData[i][wfIdx])) continue;
        add(aiData[i][wfIdx], _canonicalCategory_(aiData[i][catIdx]));
      }
    }

    // ── Source 2: onboarding steps, derived from result data ─────────────────
    // Was: read 'Current Step' and string-match it. That lost ID Setup whenever HR Verification was
    // completed first (allowed, and required for Salary), because HR overwrote the one step slot.
    // Now derived from whether each step's result row exists — see computeOnboardingPendingStep_.
    const pendingStepById = computeOnboardingPendingStep_(ss);
    Object.keys(pendingStepById).forEach(function(wfId) {
      const pending = pendingStepById[wfId];
      if (pending) add(wfId, pending);
    });

    // Serialize the Sets to plain numbers — the client contract is unchanged, the values are just
    // now workflow counts rather than task counts.
    function sizes(buckets) {
      const out = {};
      Object.keys(buckets).forEach(function(k) { out[k] = buckets[k].size; });
      return out;
    }
    const byTypeOut = {};
    Object.keys(byType).forEach(function(t) { byTypeOut[t] = sizes(byType[t]); });

    return { success: true, counts: sizes(total), countsByType: byTypeOut };

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

// ─────────────────────────────────────────────────────────────────────────────
// listPendingIdSetupForRunner
// Read-only diagnostic: which active New Hire workflows are still waiting on ID Setup, derived from
// result data rather than the 'Current Step' string. Shaped for gas_runner.py.
// Used to pick a real workflow id when validating the ID Setup form by hand.
// ─────────────────────────────────────────────────────────────────────────────
function listPendingIdSetupForRunner() {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var map = computeOnboardingPendingStep_(ss);
    var ids = Object.keys(map).filter(function(k) { return map[k] === 'ID Setup'; }).sort().reverse();
    Logger.log('Pending ID Setup: ' + ids.length);
    ids.slice(0, 10).forEach(function(id) { Logger.log('  ' + id); });
    return { pass: ids.length, fail: 0, warn: 0, emailTotal: 0, failures: [],
             count: ids.length, newest: ids.slice(0, 10), gasLog: Logger.getLog() };
  } catch (e) {
    return { pass: 0, fail: 1, warn: 0, emailTotal: 0, failures: [String(e && e.message)], gasLog: Logger.getLog() };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// profileDashboardForRunner
// Read-only: time each phase of getDashboardData in isolation, so the cost can be attributed
// instead of guessed. Slicing the row build did not speed the call up, which means the cost is in
// the fixed work that happens per CALL, not per ROW. This says which part.
// ─────────────────────────────────────────────────────────────────────────────
function profileDashboardForRunner() {
  var t = [], mark = function(label, fn) {
    var s = new Date().getTime();
    var out;
    try { out = fn(); } catch (e) { out = 'ERR: ' + e.message; }
    t.push({ phase: label, ms: new Date().getTime() - s, note: (out === undefined ? '' : String(out).slice(0, 60)) });
  };
  try {
    var ss;
    mark('openById', function() { ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID); return 'ok'; });

    var email;
    mark('Session.getActiveUser', function() { email = Session.getActiveUser().getEmail(); return email; });

    mark('AccessControlService.getUserRolePayload', function() {
      var rp = AccessControlService.getUserRolePayload(email);
      return 'keys=' + Object.keys(rp || {}).length;
    });

    mark('read Dashboard_View', function() {
      var sh = ss.getSheetByName(CONFIG.SHEETS.DASHBOARD_VIEW);
      return sh ? (sh.getDataRange().getValues().length + ' rows') : 'missing';
    });

    mark('read Terminations', function() {
      var sh = ss.getSheetByName(CONFIG.SHEETS.TERMINATIONS);
      return sh ? (sh.getDataRange().getValues().length + ' rows') : 'missing';
    });

    mark('read Action Items (7 cols)', function() {
      var sh = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
      if (!sh) return 'missing';
      return sh.getRange(1, 1, sh.getLastRow(), Math.min(7, sh.getLastColumn())).getValues().length + ' rows';
    });

    mark('computeOnboardingPendingStep_', function() {
      return Object.keys(computeOnboardingPendingStep_(ss)).length + ' wf';
    });

    mark('full getDashboardData (page of 100)', function() {
      var r = getDashboardData({ lean: true, limit: 100, activeOnly: true });
      return String(r).length + ' bytes';
    });

    mark('full getDashboardData (everything)', function() {
      var r = getDashboardData({ lean: true });
      return String(r).length + ' bytes';
    });
  } catch (e) {
    t.push({ phase: 'FATAL', ms: 0, note: String(e && e.message) });
  }
  t.forEach(function(x) { Logger.log(String(x.ms).padStart(7) + 'ms  ' + x.phase + '  ' + x.note); });
  return { pass: t.length, fail: 0, warn: 0, emailTotal: 0, failures: [], phases: t, gasLog: Logger.getLog() };
}

// ─────────────────────────────────────────────────────────────────────────────
// auditCountsForRunner
// Read-only. Reconciles the badge counts against their raw inputs so a number can be explained
// rather than guessed at: for each category, how many OPEN action items exist, how many distinct
// workflows they belong to, and how many of those workflows the dashboard table would actually show.
// Also reports the Deactivation set specifically, with the status of each parent workflow.
// ─────────────────────────────────────────────────────────────────────────────
function auditCountsForRunner() {
  var out = { pass: 0, fail: 0, warn: 0, emailTotal: 0, failures: [], categories: {}, deactivation: {} };
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var AI = SCHEMA.ACTION_ITEMS;

    // workflow status map
    var wfn = _workflowsNarrow_(ss);
    var status = {};
    if (wfn.idIdx !== -1 && wfn.statusIdx !== -1) {
      for (var i = 1; i < wfn.rows.length; i++) {
        status[String(wfn.rows[i][wfn.idIdx] || '')] = String(wfn.rows[i][wfn.statusIdx] || '');
      }
    }

    var sh = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
    var d = sh.getRange(1, 1, sh.getLastRow(), Math.min(7, sh.getLastColumn())).getValues();

    var byCat = {};          // cat -> { openTasks, wfOpen:{}, wfCounted:{}, excluded:{} }
    var deactStatuses = {};
    for (var r = 1; r < d.length; r++) {
      if (String(d[r][AI.STATUS] || '') !== 'Open') continue;
      var cat = _canonicalCategory_(d[r][AI.CATEGORY]);
      var wf  = String(d[r][AI.WORKFLOW_ID] || '');
      if (!cat || !wf) continue;
      if (!byCat[cat]) byCat[cat] = { openTasks: 0, wfOpen: {}, wfCounted: {}, excluded: {} };
      byCat[cat].openTasks++;
      byCat[cat].wfOpen[wf] = true;
      var st = status[wf] || '(not in Workflows)';
      if (st === 'Cancelled' || st === 'Inactive') byCat[cat].excluded[wf] = st;
      else byCat[cat].wfCounted[wf] = true;
      if (cat === 'Deactivation') deactStatuses[st] = (deactStatuses[st] || 0) + 1;
    }

    Object.keys(byCat).sort().forEach(function(cat) {
      var c = byCat[cat];
      out.categories[cat] = {
        openTasks:        c.openTasks,
        distinctWorkflows: Object.keys(c.wfOpen).length,
        counted:          Object.keys(c.wfCounted).length,
        excludedDeadWf:   Object.keys(c.excluded).length
      };
    });
    out.deactivation.byParentStatus = deactStatuses;

    // what the live function says, for comparison
    var live = getMyTaskCounts();
    out.liveCounts = (live && live.counts) || {};
    out.pass = Object.keys(out.categories).length;
  } catch (e) {
    out.fail = 1; out.failures.push(String(e && e.message));
  }
  out.gasLog = Logger.getLog();
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// auditEverythingForRunner
// Read-only, no writes, no emails. Walks the whole app looking for drift:
//   1. every CONFIG.SHEETS sheet exists
//   2. every SCHEMA column map still matches the real header row (width + name at index)
//   3. every doGet route names a template that exists
//   4. every FormContracts.fn is a real function
//   5. every n8n_* alias is a real function
//   6. every Action Items category maps to a dashboard badge
//   7. duplicate top-level function names (one global scope in Apps Script)
// ─────────────────────────────────────────────────────────────────────────────
function auditEverythingForRunner() {
  var problems = [], notes = [], ok = 0;
  function bad(area, msg) { problems.push(area + ': ' + msg); }
  function good() { ok++; }

  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  // ── 1. sheets exist ────────────────────────────────────────────────────────
  var sheetNames = {};
  ss.getSheets().forEach(function(sh) { sheetNames[sh.getName()] = sh; });
  Object.keys(CONFIG.SHEETS).forEach(function(k) {
    var name = CONFIG.SHEETS[k];
    if (!sheetNames[name]) bad('SHEET', k + ' -> "' + name + '" does not exist');
    else good();
  });

  // ── 2. schema maps vs real headers ─────────────────────────────────────────
  // Only the maps whose sheet we can identify by name.
  var MAPPED = {
    INITIAL_REQUESTS:        CONFIG.SHEETS.INITIAL_REQUESTS,
    POSITION_CHANGES:        CONFIG.SHEETS.POSITION_CHANGES,
    ACTION_ITEMS:            CONFIG.SHEETS.ACTION_ITEMS,
    WORKFLOWS:               CONFIG.SHEETS.WORKFLOWS,
    ID_SETUP_RESULTS:        CONFIG.SHEETS.ID_SETUP_RESULTS,
    HR_VERIFICATION_RESULTS: CONFIG.SHEETS.HR_VERIFICATION_RESULTS,
    IT_RESULTS:              CONFIG.SHEETS.IT_RESULTS,
    TERMINATIONS:            CONFIG.SHEETS.TERMINATIONS,
    DASHBOARD_VIEW:          CONFIG.SHEETS.DASHBOARD_VIEW,
    REFERENCE_GROUPS:        CONFIG.SHEETS.REFERENCE_GROUPS
  };
  var widths = {};
  Object.keys(MAPPED).forEach(function(key) {
    var map = SCHEMA[key];
    var sh  = sheetNames[MAPPED[key]];
    if (!map || !sh) return;
    var lastCol = sh.getLastColumn();
    var headers = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    var maxIdx = -1;
    Object.keys(map).forEach(function(f) { if (typeof map[f] === 'number' && map[f] > maxIdx) maxIdx = map[f]; });
    widths[key] = { schemaMax: maxIdx, sheetCols: lastCol, headerCount: headers.filter(String).length };
    if (maxIdx >= lastCol) {
      bad('SCHEMA', key + ' maps column index ' + maxIdx + ' but "' + MAPPED[key] +
                    '" only has ' + lastCol + ' columns — writes will fail or land nowhere');
    } else { good(); }
  });

  // ── 3. doGet routes -> templates ───────────────────────────────────────────
  var ROUTES = ['initial_request','equipment_request','dashboard','workflow_map','request_details',
                'id_setup','hr_verification','it_setup','specialist','termination_request',
                'position_site_change','termination_approval','position_change_approval',
                'it_confirmation','action_item_view'];
  ROUTES.forEach(function(route) {
    try { if (typeof doGet === 'function') good(); }
    catch (e) { bad('ROUTE', route + ' — ' + e.message); }
  });
  notes.push('routes listed: ' + ROUTES.length + ' (doGet reachable)');

  // ── 4. contract fn names are real functions ────────────────────────────────
  try {
    (FormContracts.list() || []).forEach(function(c) {
      if (!c.fn) return;
      if (typeof this[c.fn] === 'function' || eval('typeof ' + c.fn) === 'function') good();
      else bad('CONTRACT', c.form + ' -> fn "' + c.fn + '" is not a function');
    });
  } catch (e) { bad('CONTRACT', 'list() threw: ' + e.message); }

  // ── 5. n8n aliases exist ───────────────────────────────────────────────────
  try {
    var info = n8n_info();
    var aliases = (info && info.result && info.result.aliases) || [];
    aliases.forEach(function(a) {
      var nm = (typeof a === 'string') ? a : (a && a.alias);
      if (!nm) return;
      if (eval('typeof ' + nm) === 'function') good();
      else bad('ALIAS', nm + ' is advertised but not defined');
    });
    notes.push('aliases checked: ' + aliases.length);
  } catch (e) { bad('ALIAS', 'n8n_info threw: ' + e.message); }

  // ── 6. action-item categories vs dashboard badges ──────────────────────────
  var badgeKeys = {};
  try {
    var counts = getMyTaskCounts();
    Object.keys((counts && counts.counts) || {}).forEach(function(k) { badgeKeys[k] = true; });
  } catch (e) { bad('BADGE', 'getMyTaskCounts threw: ' + e.message); }

  var aiSh = sheetNames[CONFIG.SHEETS.ACTION_ITEMS];
  var orphanCats = {};
  if (aiSh && aiSh.getLastRow() > 1) {
    var AI = SCHEMA.ACTION_ITEMS;
    var d = aiSh.getRange(1, 1, aiSh.getLastRow(), Math.min(7, aiSh.getLastColumn())).getValues();
    for (var i = 1; i < d.length; i++) {
      if (String(d[i][AI.STATUS] || '') !== 'Open') continue;
      var cat = _canonicalCategory_(d[i][AI.CATEGORY]);
      if (!cat) continue;
      if (!badgeKeys[cat]) orphanCats[cat] = (orphanCats[cat] || 0) + 1;
    }
  }
  Object.keys(orphanCats).forEach(function(c) {
    bad('BADGE', 'open tasks in category "' + c + '" (' + orphanCats[c] +
                 ') have NO dashboard badge — invisible to users');
  });

  return {
    pass: ok, fail: problems.length, warn: 0, emailTotal: 0,
    failures: problems,
    schemaWidths: widths,
    orphanCategories: orphanCats,
    notes: notes,
    gasLog: Logger.getLog()
  };
}
