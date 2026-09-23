/**
 * RawLog.js — EFX fork (v2): Event ID/Kind, rawLogResult, Actor, optional signed webhook fan-out
 *
 * Same contract as today (rawLog(source, formData) is the first line of every submit handler) plus:
 *   • Event ID + Kind columns (appended — existing readers unaffected)
 *   • Actor.email() instead of Session (automation calls are attributable)
 *   • rawLogResult(source, workflowId, result) — post-mint event carrying the final ids
 *   • optional signed webhook fan-out to n8n when Script Property EFX_EVENT_WEBHOOK_URL is set
 *
 * Still append-only, still non-fatal, still pruned to RAW_LOG_MAX_ROWS.
 *
 * Helpers used here but shared with EfxApi/N8n — efxRedact_ (EFX_SECRET_KEY_RE) and efxSign_ — live in EfxUtil.js.
 */
var RAW_LOG_SHEET = 'Raw Log';
var RAW_LOG_MAX_ROWS = 5000;
var RAW_LOG_HEADERS = ['Timestamp', 'Source', 'Workflow ID', 'User', 'Raw JSON', 'Event ID', 'Kind'];

function rawLog(source, formData) { return rawLogEvent_('submit', source, (formData && (formData.workflowId || formData.wf)) || '', formData); }

function rawLogResult(source, workflowId, result) { return rawLogEvent_('result', source, workflowId || '', result); }

function rawLogEvent_(kind, source, workflowId, payload) {
  var eventId = 'EVT-' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMddHHmmss') + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(RAW_LOG_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(RAW_LOG_SHEET);
      sheet.getRange(1, 1, 1, RAW_LOG_HEADERS.length).setValues([RAW_LOG_HEADERS]);
      try { sheet.getRange(1, 1, 1, RAW_LOG_HEADERS.length).setFontWeight('bold'); sheet.setFrozenRows(1); } catch (e) {}
    } else if (sheet.getLastColumn() < RAW_LOG_HEADERS.length) {
      // upgrade in place: append the two new headers (existing 5 columns untouched)
      sheet.getRange(1, 6, 1, 2).setValues([['Event ID', 'Kind']]);
    }
    var user = '';
    try { user = (typeof Actor !== 'undefined') ? Actor.email() : Session.getActiveUser().getEmail(); } catch (e2) {}
    var json = '';
    try { json = JSON.stringify(payload); } catch (e3) { json = String(payload); }

    sheet.appendRow([new Date(), source, String(workflowId || ''), user, json, eventId, kind]);

    var total = sheet.getLastRow();
    if (total > RAW_LOG_MAX_ROWS + 1) sheet.deleteRows(2, total - RAW_LOG_MAX_ROWS - 1);

    rawLogFanOut_({ eventId: eventId, kind: kind, source: source, workflowId: String(workflowId || ''), actor: user, payload: payload });
  } catch (e) {
    Logger.log('[RawLog] Logging failed (non-fatal): ' + e.message);
  }
  return eventId;
}

/** Fire-and-forget signed POST to n8n. Never throws; never delays a submit by more than the fetch timeout. */
function rawLogFanOut_(event) {
  var url = '';
  try { url = PropertiesService.getScriptProperties().getProperty('EFX_EVENT_WEBHOOK_URL') || ''; } catch (e) {}
  if (!url) return;
  try {
    event = efxRedact_(event);
    var kid = PropertiesService.getScriptProperties().getProperty('EFX_EVENT_KID') || '';
    var secret = PropertiesService.getScriptProperties().getProperty('EFX_EVENT_SECRET') || '';
    var env = { v: 1, kid: kid, ts: Math.floor(Date.now() / 1000), nonce: Utilities.getUuid().replace(/-/g, ''), action: 'event', actor: { id: 'forms:rawlog' }, payload: event };
    if (secret) env.sig = efxSign_(secret, env);
    UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify(env), muteHttpExceptions: true, followRedirects: true });
  } catch (e) {
    Logger.log('[RawLog] fan-out failed (non-fatal): ' + e.message);
  }
}
