/**
 * RawLog.js — Append-only safety net for all form submissions.
 * Writes raw JSON to "Raw Log" sheet BEFORE any field mapping or sheet writes.
 * If the main handler crashes or maps data incorrectly, this row survives for recovery.
 *
 * Usage: rawLog('submitInitialRequest', formData)
 */

var RAW_LOG_SHEET = 'Raw Log';
var RAW_LOG_MAX_ROWS = 5000; // prune oldest rows when exceeded

function rawLog(source, formData) {
  try {
    var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(RAW_LOG_SHEET);

    if (!sheet) {
      sheet = ss.insertSheet(RAW_LOG_SHEET);
      var hdr = sheet.getRange(1, 1, 1, 5);
      hdr.setValues([['Timestamp', 'Source', 'Workflow ID', 'User', 'Raw JSON']]);
      hdr.setFontWeight('bold').setBackground('#1a1a1a').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(1, 160);
      sheet.setColumnWidth(2, 200);
      sheet.setColumnWidth(3, 180);
      sheet.setColumnWidth(4, 200);
      sheet.setColumnWidth(5, 600);
    }

    var wfId = formData && (formData.workflowId || formData.wf || '') || '';
    var user = '';
    try { user = Session.getActiveUser().getEmail(); } catch (e2) {}

    var json = '';
    try { json = JSON.stringify(formData); } catch (e3) { json = String(formData); }

    sheet.appendRow([new Date(), source, wfId, user, json]);

    // Prune oldest rows if over limit (keep header + newest RAW_LOG_MAX_ROWS)
    var total = sheet.getLastRow();
    if (total > RAW_LOG_MAX_ROWS + 1) {
      sheet.deleteRows(2, total - RAW_LOG_MAX_ROWS - 1);
    }
  } catch (e) {
    Logger.log('[RawLog] Logging failed (non-fatal): ' + e.message);
  }
}
