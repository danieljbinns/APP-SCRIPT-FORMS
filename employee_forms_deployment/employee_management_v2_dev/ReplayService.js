/**
 * ReplayService.js
 *
 * Refires the submission-time notification emails for any workflow without
 * writing new records or changing workflow state.
 *
 * Reads existing sheet data and calls the same email helpers used by the
 * original form handlers — zero logic duplication.
 *
 * Supported workflow types (maps to Workflows sheet WORKFLOW_TYPE column):
 *   NEW_EMP   → Initial Request emails (ID Setup + Requester confirmation)
 *   TERM      → Termination emails (HR approval request + Payroll advance notice)
 *   CHANGE    → Position Change emails (HR + Payroll + current manager)
 *   EQUIP_REQ → Equipment Request emails (Requester confirmation + IT Confirmation)
 *
 * ── USAGE (GAS editor) ──────────────────────────────────────────────────────
 *
 *   // Preview what will be sent — no emails fired
 *   planWorkflowEmailReplay('NEW_EMP_20260508-094937_899');
 *   planWorkflowEmailReplay(['NEW_EMP_20260508-094937_899', 'TERM_20260512-080704_526']);
 *
 *   // Send the emails
 *   replayWorkflowEmails('NEW_EMP_20260508-094937_899');
 *   replayWorkflowEmails(['NEW_EMP_20260508-094937_899', 'TERM_20260512-080704_526']);
 *
 * ── TESTING WITHOUT SENDING REAL EMAIL ──────────────────────────────────────
 *
 *   Set Script Property  EMAIL_REDIRECT_ALL = your@email.com  before running.
 *   All outbound mail will go to that address instead of real recipients.
 *   Delete the property when done.
 *
 * ── NOTES ───────────────────────────────────────────────────────────────────
 *   - This refires SUBMISSION-TIME emails only (the ones sent when the form
 *     was first submitted), not approval/action-item emails from later steps.
 *   - No new sheet rows, workflow records, or action items are created.
 *   - Safe to run multiple times — just resends the same notifications.
 * ============================================================================
 */

// ── PASTE WORKFLOW IDs HERE ────────────────────────────────────────────────────
// Add or remove IDs as needed, then run replayPlan to preview, replaySend to send.

var REPLAY_IDS = [
  // 'NEW_EMP_20260508-094937_899',
  // 'TERM_20260512-080704_526',
];

// ──────────────────────────────────────────────────────────────────────────────

/** STEP 1 — Preview what will be sent. No emails fired. */
function replayPlan() {
  planWorkflowEmailReplay(REPLAY_IDS);
}

/** STEP 2 — Send the emails. Run replayPlan first to verify. */
function replaySend() {
  var results = replayWorkflowEmails(REPLAY_IDS);
  var sent   = results.filter(function(r) { return  r.success; }).length;
  var failed = results.filter(function(r) { return !r.success; }).length;
  Logger.log('[ReplayService] Done: ' + sent + ' sent, ' + failed + ' failed.');
}

/**
 * Refire submission-time emails for one or more workflow IDs.
 *
 * @param {string|string[]} input  Single workflow ID or array of IDs.
 * @returns {Array<{workflowId:string, success:boolean, message:string}>}
 */
function replayWorkflowEmails(input) {
  const ids = Array.isArray(input) ? input : [String(input)];
  const results = [];

  ids.forEach(function(raw) {
    const workflowId = String(raw || '').trim();
    if (!workflowId) {
      results.push({ workflowId: workflowId, success: false, message: 'Empty workflow ID — skipped' });
      return;
    }

    Logger.log('[ReplayService] Replaying: ' + workflowId);
    try {
      const wfRow = _replayGetWorkflowRow(workflowId);
      if (!wfRow) {
        results.push({ workflowId: workflowId, success: false, message: 'Workflow not found in Workflows sheet' });
        return;
      }

      const wfType = String(wfRow[SCHEMA.WORKFLOWS.WORKFLOW_TYPE] || '').trim();
      Logger.log('[ReplayService] Type: ' + wfType + ' — ' + workflowId);

      switch (wfType) {
        case 'NEW_EMP':
          _sendInitialRequestSubmitEmails(workflowId);
          break;
        case 'TERM':
          _sendTerminationSubmitEmails(workflowId);
          break;
        case 'CHANGE':
          _sendPositionChangeSubmitEmails(workflowId);
          break;
        case 'EQUIP_REQ':
          _sendEquipmentRequestSubmitEmails(workflowId);
          break;
        default:
          results.push({ workflowId: workflowId, success: false, message: 'Unsupported workflow type: ' + wfType });
          return;
      }

      Logger.log('[ReplayService] Done: ' + workflowId);
      results.push({ workflowId: workflowId, success: true, message: 'Emails replayed (type: ' + wfType + ')' });

    } catch (e) {
      Logger.log('[ReplayService] Error for ' + workflowId + ': ' + e.message);
      results.push({ workflowId: workflowId, success: false, message: e.message });
    }
  });

  Logger.log('[ReplayService] Summary: ' + JSON.stringify(results));
  return results;
}

// ── Plan function ──────────────────────────────────────────────────────────────

/**
 * Preview what replayWorkflowEmails would send — no emails are fired.
 * Prints a human-readable plan to the Logger and returns a structured array.
 *
 * If EMAIL_REDIRECT_ALL Script Property is set, the plan shows the redirect
 * address so you can confirm where mail would actually go.
 *
 * @param {string|string[]} input  Single workflow ID or array of IDs.
 * @returns {Array} Plan entries — one per workflow ID.
 */
function planWorkflowEmailReplay(input) {
  const ids      = Array.isArray(input) ? input : [String(input)];
  const redirect = ConfigurationService.getSetting('EMAIL_REDIRECT_ALL') || '';
  const plan     = [];

  ids.forEach(function(raw) {
    const workflowId = String(raw || '').trim();
    if (!workflowId) {
      plan.push({ workflowId: '', status: 'SKIP', reason: 'Empty ID', emails: [] });
      return;
    }

    try {
      const wfRow = _replayGetWorkflowRow(workflowId);
      if (!wfRow) {
        plan.push({ workflowId: workflowId, status: 'NOT_FOUND', reason: 'No row in Workflows sheet', emails: [] });
        return;
      }

      const wfType   = String(wfRow[SCHEMA.WORKFLOWS.WORKFLOW_TYPE] || '').trim();
      const empName  = String(wfRow[SCHEMA.WORKFLOWS.EMPLOYEE_NAME] || '(unknown)');
      const wfStatus = String(wfRow[SCHEMA.WORKFLOWS.STATUS]        || '');

      var emails;
      switch (wfType) {
        case 'NEW_EMP':   emails = _planNewEmpEmails(workflowId);   break;
        case 'TERM':      emails = _planTermEmails(workflowId);      break;
        case 'CHANGE':    emails = _planChangeEmails(workflowId);    break;
        case 'EQUIP_REQ': emails = _planEquipReqEmails(workflowId);  break;
        default:
          plan.push({ workflowId: workflowId, type: wfType, employee: empName, workflowStatus: wfStatus,
                      status: 'UNSUPPORTED', reason: 'Type not handled by ReplayService', emails: [] });
          return;
      }

      plan.push({
        workflowId:     workflowId,
        type:           wfType,
        employee:       empName,
        workflowStatus: wfStatus,
        status:         'READY',
        emails:         emails
      });

    } catch (e) {
      plan.push({ workflowId: workflowId, status: 'ERROR', reason: e.message, emails: [] });
    }
  });

  // ── Logger output ──────────────────────────────────────────────────────────
  Logger.log('══════════════════════════════════════════════════════');
  Logger.log('[ReplayService] PLAN  (' + ids.length + ' workflow' + (ids.length === 1 ? '' : 's') + ')');
  if (redirect) {
    Logger.log('[ReplayService] ⚠️  EMAIL_REDIRECT_ALL is set — all mail → ' + redirect);
  }
  Logger.log('══════════════════════════════════════════════════════');

  var readyCount = 0;
  plan.forEach(function(item) {
    Logger.log('');
    var header = '  [' + (item.type || '?') + ']  ' + item.workflowId;
    if (item.employee) header += '  —  ' + item.employee;
    if (item.workflowStatus) header += '  (' + item.workflowStatus + ')';
    Logger.log(header);

    if (item.status !== 'READY') {
      Logger.log('  ⚠  ' + item.status + (item.reason ? ': ' + item.reason : ''));
      return;
    }

    readyCount++;
    if (!item.emails || item.emails.length === 0) {
      Logger.log('  (no emails would be sent — data may be missing)');
      return;
    }
    item.emails.forEach(function(e) {
      var dest = redirect ? redirect + '  [redirected from: ' + e.to + ']' : e.to;
      Logger.log('    →  ' + e.subject + '  ▸  ' + dest);
    });
  });

  Logger.log('');
  Logger.log('══════════════════════════════════════════════════════');
  Logger.log('[ReplayService] ' + readyCount + ' / ' + ids.length + ' ready to send.');
  Logger.log('[ReplayService] To send: replayWorkflowEmails(ids)');
  Logger.log('══════════════════════════════════════════════════════');

  return plan;
}

// ── Plan sub-helpers (read data only, no emails) ───────────────────────────────

function _planNewEmpEmails(workflowId) {
  const data = getRowByRequestId(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.INITIAL_REQUESTS, workflowId);
  if (!data) return [{ to: '(no row in Initial Requests sheet)', subject: 'ID Setup Required' },
                     { to: '(no row in Initial Requests sheet)', subject: 'Request Submitted' }];
  const IR = SCHEMA.INITIAL_REQUESTS;
  return [
    { subject: 'ID Setup Required',  to: CONFIG.EMAILS.IDSETUP },
    { subject: 'Request Submitted',  to: String(data[IR.REQUESTER_EMAIL] || '(no requester email)') }
  ];
}

function _planTermEmails(workflowId) {
  const d = getTerminationData(workflowId);
  if (!d) return [{ to: '(no row in Terminations sheet)', subject: 'HR Approval Required' }];
  return [
    { subject: 'HR Approval Required',                    to: CONFIG.EMAILS.HR },
    { subject: 'Termination Submitted — Pending HR Approval', to: CONFIG.EMAILS.PAYROLL }
  ];
}

function _planChangeEmails(workflowId) {
  const d = getPositionChangeData(workflowId);
  if (!d) return [{ to: '(no row in Position Changes sheet)', subject: 'HR Approval Required' }];
  const emails = [
    { subject: 'HR Approval Required', to: CONFIG.EMAILS.HR },
    { subject: 'HR Approval Required', to: CONFIG.EMAILS.PAYROLL }
  ];
  if (d.currentManagerEmail && d.currentManagerEmail !== d.requesterEmail) {
    emails.push({ subject: 'Status Change Initiated', to: d.currentManagerEmail });
  }
  return emails;
}

function _planEquipReqEmails(workflowId) {
  const d = getEquipmentRequestData(workflowId);
  if (!d) return [{ to: '(no row in Equipment_Requests sheet)', subject: 'Request Submitted' }];
  const emails = [];
  if (d.requesterEmail) {
    emails.push({ subject: 'Request Submitted',       to: d.requesterEmail });
  }
  emails.push(  { subject: 'IT Confirmation Required', to: 'davelangohr@team-group.com' });
  return emails;
}

// ── Private helpers ─────────────────────────────────────────────────────────────

function _replayGetWorkflowRow(workflowId) {
  const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
  if (!sheet || sheet.getLastRow() <= 1) return null;
  const data = sheet.getDataRange().getValues();
  for (var i = SCHEMA.ROW.FIRST_DATA; i < data.length; i++) {
    if (String(data[i][SCHEMA.WORKFLOWS.WORKFLOW_ID] || '').trim() === workflowId) {
      return data[i];
    }
  }
  return null;
}
