/**
 * AuditLog.js
 *
 * Appends a row to the Audit Log sheet for tracked actions.
 * Called by RequestActionsHandler (cancel / bump / updateHireDate)
 * and DashboardActionsHandler (adminDeleteWorkflows).
 *
 * Sheet: CONFIG.SHEETS.AUDIT_LOG  ('Audit Log')
 * Columns: Timestamp | User Email | Action | Workflow ID | Detail | Result
 *
 * Actions: 'CANCEL' | 'BUMP' | 'UPDATE_HIRE_DATE' | 'HIDE'
 */

function writeAuditLog(userEmail, action, workflowId, detail, result) {
  try {
    var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(CONFIG.SHEETS.AUDIT_LOG);

    // Auto-create sheet with headers if it doesn't exist yet
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEETS.AUDIT_LOG);
      var hdr = sheet.getRange(1, 1, 1, 6);
      hdr.setValues([['Timestamp', 'User Email', 'Action', 'Workflow ID', 'Detail', 'Result']]);
      hdr.setFontWeight('bold')
         .setBackground('#EB1C2D')
         .setFontColor('#ffffff');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(1, 160);
      sheet.setColumnWidth(2, 220);
      sheet.setColumnWidth(3, 140);
      sheet.setColumnWidth(4, 200);
      sheet.setColumnWidth(5, 300);
      sheet.setColumnWidth(6, 120);
    }

    sheet.appendRow([
      new Date(),
      userEmail  || '',
      action     || '',
      workflowId || '',
      detail     || '',
      result     || ''
    ]);
  } catch (e) {
    // Never let audit failures break the calling action
    Logger.log('[writeAuditLog] Error: ' + e.message);
  }
}
