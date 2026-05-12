/**
 * Workflow Management Functions
 * Creates and manages workflow instances across forms
 */

/**
 * Log a form edit to the Form Edit Log sheet.
 * Called whenever an already-submitted form is updated rather than inserted.
 * @param {string} workflowId
 * @param {string} formType  - Human-readable form name, e.g. 'HR Verification'
 * @param {string} changedBy - Email of editing user
 * @param {Array}  oldRow    - Previous sheet row values
 * @param {Array}  newRow    - New sheet row values (same length)
 */
function logFormEdit(workflowId, formType, changedBy, oldRow, newRow) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let logSheet = ss.getSheetByName(CONFIG.SHEETS.FORM_EDIT_LOG);
    if (!logSheet) {
      logSheet = ss.insertSheet(CONFIG.SHEETS.FORM_EDIT_LOG);
      logSheet.appendRow(['Timestamp', 'Workflow ID', 'Form Type', 'Changed By', 'Changes']);
      logSheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#EB1C2D').setFontColor('#ffffff');
    }

    // Build a readable change summary: only list columns whose value actually changed
    const changes = [];
    const len = Math.max(oldRow.length, newRow.length);
    for (let i = 0; i < len; i++) {
      const oldVal = String(oldRow[i] instanceof Date ? Utilities.formatDate(oldRow[i], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : (oldRow[i] || ''));
      const newVal = String(newRow[i] instanceof Date ? Utilities.formatDate(newRow[i], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : (newRow[i] || ''));
      if (oldVal !== newVal && i > 1) { // skip WF ID (0) and Form ID (1)
        changes.push('col' + (i + 1) + ': [' + oldVal + '] → [' + newVal + ']');
      }
    }

    logSheet.appendRow([
      new Date(),
      workflowId,
      formType,
      changedBy,
      changes.length > 0 ? changes.join(' | ') : '(no field changes detected)'
    ]);
  } catch (e) {
    Logger.log('[logFormEdit] Error: ' + e.message);
  }
}

/**
 * Generate unique workflow ID
 */
function generateWorkflowId(workflowType) {
  const timestamp = Utilities.formatDate(new Date(), 'America/New_York', 'yyyyMMdd-HHmmss');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return workflowType + '_' + timestamp + '_' + random;
}

/**
 * Generate unique form ID
 */
function generateFormId(formType) {
  const timestamp = Utilities.formatDate(new Date(), 'America/New_York', 'yyyyMMdd-HHmmss');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return formType + '_' + timestamp + '_' + random;
}

/**
 * Create new workflow record in master Workflows sheet
 */
function createWorkflow(workflowType, workflowName, initiatorEmail) {
  try {
    const workflowId = generateWorkflowId(workflowType);
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let workflowsSheet = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
    
    if (!workflowsSheet) {
      workflowsSheet = ss.insertSheet(CONFIG.SHEETS.WORKFLOWS);
      workflowsSheet.appendRow([
        'Workflow ID',
        'Workflow Type',
        'Workflow Name',
        'Initiator Email',
        'Status',
        'Created Date',
        'Last Updated',
        'Current Step',
        'Employee Name'
      ]);
      workflowsSheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#EB1C2D').setFontColor('#ffffff');
    }
    
    workflowsSheet.appendRow([
      workflowId,
      workflowType,
      workflowName,
      initiatorEmail,
      'In Progress',
      new Date(),
      new Date(),
      'Initial Request',
      ''
    ]);
    
    Logger.log('[SUCCESS] Created workflow: ' + workflowId);
    return workflowId;
    
  } catch (error) {
    Logger.log('[ERROR] Failed to create workflow: ' + error.toString());
    throw error;
  }
}

/**
 * Update workflow status and current step
 */
function updateWorkflow(workflowId, status, currentStep, employeeName) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const workflowsSheet = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
    
    if (!workflowsSheet) return false;
    
    const WF = SCHEMA.WORKFLOWS;
    const data = workflowsSheet.getDataRange().getValues();

    for (let i = SCHEMA.ROW.FIRST_DATA; i < data.length; i++) {
      if (data[i][WF.WORKFLOW_ID] === workflowId) {
        workflowsSheet.getRange(i + 1, WF.STATUS + 1).setValue(status);
        workflowsSheet.getRange(i + 1, WF.LAST_UPDATED + 1).setValue(new Date());
        if (currentStep) workflowsSheet.getRange(i + 1, WF.CURRENT_STEP + 1).setValue(currentStep);
        if (employeeName) workflowsSheet.getRange(i + 1, WF.EMPLOYEE_NAME + 1).setValue(employeeName);
        
        Logger.log('[SUCCESS] Updated workflow: ' + workflowId + ' -> ' + status);
    // Sync to Initial Requests sheet as well (if found)
    syncStatusToRequestSheet(ss, workflowId, status);
    
    return true;
      }
    }
    
    Logger.log('[WARNING] Workflow not found: ' + workflowId);
    return false;
    
  } catch (error) {
    Logger.log('[ERROR] Failed to update workflow: ' + error.toString());
    return false;
  }
}

/**
 * Helper to sync status back to origin request sheets (Initial, Terminations, Position Changes)
 */
function syncStatusToRequestSheet(ss, workflowId, status) {
  try {
    const originSheets = [
      CONFIG.SHEETS.INITIAL_REQUESTS,
      CONFIG.SHEETS.TERMINATIONS,
      CONFIG.SHEETS.POSITION_CHANGES
    ];

    const STATUS_COL_BY_SHEET = {
      [CONFIG.SHEETS.INITIAL_REQUESTS]: SCHEMA.INITIAL_REQUESTS.STATUS,
      [CONFIG.SHEETS.TERMINATIONS]:     SCHEMA.TERMINATIONS.HR_APPROVED_STATUS
      // POSITION_CHANGES has no status column in schema — skip
    };

    for (const sheetName of originSheets) {
      if (!sheetName) continue;
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) continue;

      const statusColIndex = STATUS_COL_BY_SHEET[sheetName];
      if (statusColIndex === undefined) continue;

      const data = sheet.getDataRange().getValues();
      for (let i = SCHEMA.ROW.FIRST_DATA; i < data.length; i++) {
        if (data[i][SCHEMA.WORKFLOWS.WORKFLOW_ID] === workflowId) {
          sheet.getRange(i + 1, statusColIndex + 1).setValue(status);
          Logger.log(`Synced status to ${sheetName} sheet`);
          return; // Found and updated, done
        }
      }
    }
  } catch (e) {
    Logger.log('Error syncing status to requests: ' + e.toString());
  }
}

/**
 * Admin: soft-delete (hide) one or more workflows.
 *
 * Sets status = 'Inactive' in the Workflows sheet so the row is never touched
 * and can be recovered at any time by setting the status back.
 * Removes the corresponding row(s) from Dashboard_View (a derived cache —
 * the row would be excluded on the next full sync anyway).
 * Does NOT touch any other data sheet. Does NOT send emails.
 *
 * To restore: set Status = 'In Progress' (or any non-Inactive value) in the
 * Workflows sheet, then run manuallySyncAllWorkflows() to rebuild Dashboard_View.
 *
 * For a true, permanent hard-delete use adminPurgeWorkflows() — see below.
 *
 * @param {string[]} workflowIds
 * @returns {{ success: boolean, deactivated: number, errors: string[] }}
 */
function adminDeleteWorkflows(workflowIds) {
  try {
    const userEmail = Session.getActiveUser().getEmail();
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
    // Dashboard_View is a pre-calculated flat table — removing cached rows is safe.
    // They are excluded on the next syncWorkflowState / manuallySyncAllWorkflows run.
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

    Logger.log('[adminDeleteWorkflows] Done. Deactivated: ' + deactivated + ' | Errors: ' + errors.length);
    return { success: true, deactivated: deactivated, errors: errors };

  } catch (e) {
    Logger.log('[adminDeleteWorkflows] Fatal: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Admin: PERMANENT hard-delete of one or more workflows from ALL data sheets.
 *
 * ⚠️  IRREVERSIBLE. Use only when you need to fully erase a workflow (e.g. a test
 *     run or a duplicate created in error). Prefer adminDeleteWorkflows() (soft-delete)
 *     for routine hiding.
 *
 * Deletes rows from every sheet keyed by Workflow ID in column A.
 * Does NOT send emails.
 *
 * @param {string[]} workflowIds
 * @returns {{ success: boolean, deleted: number, errors: string[] }}
 */
function adminPurgeWorkflows(workflowIds) {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    if (!AccessControlService.isAdmin(userEmail)) {
      return { success: false, message: 'Permission denied. Admin access required.' };
    }

    if (!Array.isArray(workflowIds) || workflowIds.length === 0) {
      return { success: false, message: 'No workflow IDs provided.' };
    }

    const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const idSet = new Set(workflowIds.map(id => String(id).trim()).filter(Boolean));
    const errors = [];

    const ALL_SHEETS = [
      CONFIG.SHEETS.WORKFLOWS,
      CONFIG.SHEETS.DASHBOARD_VIEW,
      CONFIG.SHEETS.INITIAL_REQUESTS,
      CONFIG.SHEETS.TERMINATIONS,
      CONFIG.SHEETS.POSITION_CHANGES,
      CONFIG.SHEETS.EQUIPMENT_REQUESTS,
      CONFIG.SHEETS.ID_SETUP_RESULTS,
      CONFIG.SHEETS.HR_VERIFICATION_RESULTS,
      CONFIG.SHEETS.IT_RESULTS,
      CONFIG.SHEETS.IT_CONFIRMATION_RESULTS,
      CONFIG.SHEETS.TERMINATION_APPROVALS,
      CONFIG.SHEETS.POSITION_CHANGE_APPROVALS,
      CONFIG.SHEETS.ACTION_ITEMS
    ];

    for (const sheetName of ALL_SHEETS) {
      if (!sheetName) continue;
      try {
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet || sheet.getLastRow() <= 1) continue;

        const colA     = sheet.getRange('A2:A' + sheet.getLastRow()).getValues();
        const toDelete = [];
        for (let i = 0; i < colA.length; i++) {
          if (idSet.has(String(colA[i][0] || '').trim())) {
            toDelete.push(i + 2);
          }
        }
        for (let j = toDelete.length - 1; j >= 0; j--) {
          sheet.deleteRow(toDelete[j]);
        }
        if (toDelete.length > 0) {
          Logger.log('[adminPurgeWorkflows] ' + sheetName + ': deleted ' + toDelete.length + ' row(s)');
        }
      } catch (e) {
        Logger.log('[adminPurgeWorkflows] Error on ' + sheetName + ': ' + e.message);
        errors.push(sheetName + ': ' + e.message);
      }
    }

    Logger.log('[adminPurgeWorkflows] Done. IDs: ' + workflowIds.join(', ') + ' | Errors: ' + errors.length);
    return { success: true, deleted: workflowIds.length, errors: errors };

  } catch (e) {
    Logger.log('[adminPurgeWorkflows] Fatal: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Get workflow details by ID
 */
function getWorkflow(workflowId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const workflowsSheet = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
    
    if (!workflowsSheet) return null;
    
    const data = workflowsSheet.getDataRange().getValues();
    const headers = data[SCHEMA.ROW.HEADER];

    for (let i = SCHEMA.ROW.FIRST_DATA; i < data.length; i++) {
      if (data[i][SCHEMA.WORKFLOWS.WORKFLOW_ID] === workflowId) {
        const workflow = {};
        headers.forEach((header, index) => {
          workflow[header] = data[i][index];
        });
        return workflow;
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log('[ERROR] Failed to get workflow: ' + error.toString());
    return null;
  }
}
