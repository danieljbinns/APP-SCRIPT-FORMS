/**
 * DashboardActionsHandler.js
 *
 * Admin-only bulk actions triggered from the Dashboard.
 * All actions require Admin role and write to the Audit Log.
 *
 * adminDeleteWorkflows() — soft-delete: sets Status = 'Inactive', removes
 *   from Dashboard_View cache. Moved here from WorkflowManager.js.
 *
 * Depends on (global GAS scope):
 *   CONFIG, SCHEMA              — SchemaConstants.js / Config.js
 *   AccessControlService        — Services/AccessControlService.js
 *   writeAuditLog               — AuditLog.js
 */

// ─────────────────────────────────────────────────────────────────────────────
// adminDeleteWorkflows
// Soft-delete: sets Status = 'Inactive' in Workflows, removes from Dashboard_View.
// Recoverable: set Status back to 'In Progress' and run manuallySyncAllWorkflows().
// ─────────────────────────────────────────────────────────────────────────────

function adminDeleteWorkflows(workflowIds) {
  const userEmail = Session.getActiveUser().getEmail();
  try {
    if (!AccessControlService.isAdmin(userEmail)) {
      return { success: false, message: 'Permission denied. Admin access required.' };
    }

    if (!Array.isArray(workflowIds) || workflowIds.length === 0) {
      return { success: false, message: 'No workflow IDs provided.' };
    }

    const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const idSet = new Set(workflowIds.map(id => String(id).trim()).filter(Boolean));
    const errors = [];
    let deactivated = 0;

    // ── 1. Set status = 'Inactive' in the Workflows master sheet ──────────────
    const wfSheet = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
    if (wfSheet && wfSheet.getLastRow() > 1) {
      try {
        const WF   = SCHEMA.WORKFLOWS;
        const data = wfSheet.getDataRange().getValues();
        for (let i = SCHEMA.ROW.FIRST_DATA; i < data.length; i++) {
          const id = String(data[i][WF.WORKFLOW_ID] || '').trim();
          if (idSet.has(id) && String(data[i][WF.STATUS] || '') !== 'Inactive') {
            wfSheet.getRange(i + 1, WF.STATUS       + 1).setValue('Inactive');
            wfSheet.getRange(i + 1, WF.LAST_UPDATED + 1).setValue(new Date());
            deactivated++;
            Logger.log('[adminDeleteWorkflows] Marked Inactive in Workflows: ' + id);
          }
        }
      } catch (e) {
        Logger.log('[adminDeleteWorkflows] Error marking Workflows: ' + e.message);
        errors.push('Workflows: ' + e.message);
      }
    }

    // Flush writes to Workflows before touching Dashboard_View
    SpreadsheetApp.flush();

    // ── 2. Remove rows from Dashboard_View cache ───────────────────────────────
    const dvSheet = ss.getSheetByName(CONFIG.SHEETS.DASHBOARD_VIEW);
    if (dvSheet && dvSheet.getLastRow() > 1) {
      try {
        const colA    = dvSheet.getRange('A2:A' + dvSheet.getLastRow()).getValues();
        const toDelete = [];
        for (let i = 0; i < colA.length; i++) {
          if (idSet.has(String(colA[i][0] || '').trim())) {
            toDelete.push(i + 2);
          }
        }
        for (let j = toDelete.length - 1; j >= 0; j--) {
          dvSheet.deleteRow(toDelete[j]);
        }
        if (toDelete.length > 0) {
          Logger.log('[adminDeleteWorkflows] Dashboard_View: removed ' + toDelete.length + ' cached row(s)');
        }
      } catch (e) {
        Logger.log('[adminDeleteWorkflows] Error on Dashboard_View: ' + e.message);
        errors.push('Dashboard_View: ' + e.message);
      }
    }

    writeAuditLog(userEmail, 'HIDE', workflowIds.join(', '), 'Marked Inactive (' + deactivated + ')', errors.length ? 'errors: ' + errors.join('; ') : 'success');
    Logger.log('[adminDeleteWorkflows] Done. Deactivated: ' + deactivated + ' | Errors: ' + errors.length);
    return { success: true, deactivated: deactivated, errors: errors };

  } catch (e) {
    Logger.log('[adminDeleteWorkflows] Fatal: ' + e.message);
    writeAuditLog(userEmail, 'HIDE', (workflowIds || []).join(', '), '', 'error: ' + e.message);
    return { success: false, message: e.message };
  }
}
