/**
 * RequestActionsHandler.js
 *
 * Mutating actions on workflows: cancel, bump reminder, update hire date.
 * All three functions:
 *   - Validate auth via AccessControlService
 *   - Write to Audit Log via AuditLog.js
 *
 * bumpRequest also rate-limits via CacheService: 1 reminder per
 * workflowId+step per hour.
 *
 * Depends on (global GAS scope):
 *   CONFIG, SCHEMA                       — SchemaConstants.js / Config.js
 *   AccessControlService                 — Services/AccessControlService.js
 *   writeAuditLog                        — AuditLog.js
 *   getWorkflow(), updateWorkflow()      — WorkflowManager.js
 *   getWorkflowContext()                 — WorkflowManager.js
 *   syncWorkflowState()                  — StateSync.js
 *   sendFormEmail(), buildFormUrl()      — EmailUtils.js / Router.js
 */

// ─────────────────────────────────────────────────────────────────────────────
// cancelRequest
// ─────────────────────────────────────────────────────────────────────────────

function cancelRequest(workflowId) {
  try {
    var userEmail = Session.getActiveUser().getEmail();
    var wf = getWorkflow(workflowId);
    if (!wf) return { success: false, message: 'Workflow not found.' };

    if (!AccessControlService.canCancel(userEmail, wf)) {
      return { success: false, message: 'Permission denied. HR, IT, Admin, the requester, or the manager can cancel requests.' };
    }

    updateWorkflow(workflowId, 'Cancelled', 'Request Cancelled', '');
    syncWorkflowState(workflowId);

    writeAuditLog(userEmail, 'CANCEL', workflowId, '', 'success');
    return { success: true, message: 'Request cancelled successfully.' };
  } catch (e) {
    Logger.log('[cancelRequest] Error: ' + e.toString());
    writeAuditLog(Session.getActiveUser().getEmail(), 'CANCEL', workflowId, '', 'error: ' + e.message);
    return { success: false, message: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateHireDate
// ─────────────────────────────────────────────────────────────────────────────

function updateHireDate(workflowId, newDateStr) {
  try {
    var userEmail = Session.getActiveUser().getEmail();

    if (!AccessControlService.getUserRolePayload(userEmail).canEditDates) {
      return { success: false, message: 'Permission denied. Only HR, IT, or Admin can edit hire dates.' };
    }

    var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
    if (!sheet) return { success: false, message: 'Initial Requests sheet not found.' };

    var data       = sheet.getDataRange().getValues();
    var headers    = data[0];
    var wfIdCol    = headers.indexOf('Workflow ID');
    var hireDateCol= headers.indexOf('Hire Date');
    if (wfIdCol === -1 || hireDateCol === -1) return { success: false, message: 'Required columns not found.' };

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][wfIdCol]) !== workflowId) continue;

      var rawOld    = data[i][hireDateCol];
      var oldDateStr= rawOld instanceof Date
        ? Utilities.formatDate(rawOld, Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : String(rawOld || '').substring(0, 10);

      sheet.getRange(i + 1, hireDateCol + 1).setValue(new Date(newDateStr + 'T12:00:00'));
      SpreadsheetApp.flush();
      syncWorkflowState(workflowId);

      var detail = oldDateStr + ' → ' + newDateStr;
      writeAuditLog(userEmail, 'UPDATE_HIRE_DATE', workflowId, detail, 'success');
      return { success: true, message: 'Start date updated from ' + oldDateStr + ' to ' + newDateStr + '.' };
    }
    return { success: false, message: 'Workflow not found in Initial Requests.' };
  } catch (e) {
    Logger.log('[updateHireDate] Error: ' + e.toString());
    writeAuditLog(Session.getActiveUser().getEmail(), 'UPDATE_HIRE_DATE', workflowId, newDateStr, 'error: ' + e.message);
    return { success: false, message: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// bumpRequest
// Rate limit: 1 per workflowId+step per hour via CacheService.
// Auth: HR / IT / Admin any wf. Requester / Manager own wf only.
// ─────────────────────────────────────────────────────────────────────────────

function bumpRequest(workflowId, targetStep) {
  try {
    var userEmail = Session.getActiveUser().getEmail();
    Logger.log('[bumpRequest] ' + workflowId + ' / ' + targetStep + ' by ' + userEmail);

    var wf = getWorkflow(workflowId);
    if (!wf) return { success: false, message: 'Workflow not found.' };

    if (!AccessControlService.canBump(userEmail, wf)) {
      return { success: false, message: 'Permission denied. HR, IT, Admin, the requester, or the manager can send reminders.' };
    }

    // Rate limit: 1 reminder per step per hour
    var cacheKey = 'bump_' + workflowId + '_' + (targetStep || '');
    var cache    = CacheService.getScriptCache();
    if (cache.get(cacheKey)) {
      return { success: false, message: 'A reminder was already sent recently for this step. Please wait before sending again.' };
    }

    var result = _sendBumpEmail(workflowId, targetStep);

    if (result.success) {
      cache.put(cacheKey, '1', 3600);
      writeAuditLog(userEmail, 'BUMP', workflowId, targetStep, 'sent to: ' + (result.recipient || ''));
    } else {
      writeAuditLog(userEmail, 'BUMP', workflowId, targetStep, 'failed: ' + result.message);
    }

    return result;
  } catch (e) {
    Logger.log('[bumpRequest] Error: ' + e.toString());
    return { success: false, message: e.message };
  }
}

// ── Private: email dispatch (unchanged logic from original bumpRequest) ──────

function _sendBumpEmail(workflowId, targetStep) {
  var recipient = '';
  var formType  = '';

  switch (targetStep) {
    case 'id_setup':
      recipient = CONFIG.EMAILS.IDSETUP;
      formType  = 'ID Setup';
      break;
    case 'hr_verification':
      recipient = CONFIG.EMAILS.HR;
      formType  = 'HR Verification';
      break;
    case 'it_setup':
      recipient = CONFIG.EMAILS.IT;
      formType  = 'IT Setup';
      break;
    case 'it_confirmation':
      recipient = 'davelangohr@team-group.com';
      formType  = 'IT Confirmation';
      break;

    // Specialist + EOE + Status Change + Equipment action-item steps
    case 'creditcard': case 'businesscards': case 'fleetio': case 'jonas':
    case 'centralpurchasing': case 'sitedocs': case 'review_306090':
    case 'safety_onboarding': case 'safety_term':
    case 'asset_collection': case 'systems_deactivation': case 'systems_deactivation_hr':
    case 'systems_deactivation_fleet': case 'systems_deactivation_finance':
    case 'systems_deactivation_deact':
    case 'change_manager': case 'change_it': case 'change_purchasing':
    case 'change_idsetup': case 'change_safety': case 'change_businesscards':
    case 'change_creditcard': case 'change_fleetio': case 'change_jonas':
    case 'hr_systems': case 'adp_setup': case 'wis':
      return _sendActionItemBump(workflowId, targetStep);

    default:
      // Try action item lookup as fallback before giving up
      var fallback = _sendActionItemBump(workflowId, targetStep);
      if (fallback && fallback.success) return fallback;
      recipient = '';
      formType  = 'General';
  }

  if (!recipient || !recipient.includes('@')) {
    return { success: true, message: 'Bump recorded for ' + formType + ' (no email configured)' };
  }

  try {
    var specificUrl = getBaseUrl() + '?form=dashboard';
    if (formType === 'ID Setup')          specificUrl = buildFormUrl('id_setup',        { id: workflowId });
    else if (formType === 'HR Verification') specificUrl = buildFormUrl('hr_verification', { id: workflowId });
    else if (formType === 'IT Setup')     specificUrl = buildFormUrl('it_setup',         { id: workflowId });

    var ctx = getWorkflowContext(workflowId) || {};
    sendFormEmail({
      to: recipient,
      subject: formType + ' Required',
      body: 'ACTION REQUIRED: ' + formType + '\n\nA request for ' + formType + ' is pending your action.',
      formUrl: specificUrl,
      displayName: 'TEAM Group - Onboarding',
      contextData: ctx,
      subjectOpts: { isReminder: true, requestDate: new Date() }
    });
    return { success: true, message: 'Reminder sent to ' + recipient, recipient: recipient };
  } catch (e) {
    Logger.log('[_sendBumpEmail] send failed: ' + e.toString());
    return { success: false, message: 'Failed to send email: ' + e.message };
  }
}

function _sendActionItemBump(workflowId, targetStep) {
  // Category lookup maps
  var specialistCatMap = {
    'creditcard': 'Credit Card', 'businesscards': 'Business Cards',
    'fleetio': 'Fleetio', 'jonas': 'Jonas', 'centralpurchasing': 'Central Purchasing',
    'sitedocs': 'SiteDocs', 'review_306090': '30/60/90 Review',
    'safety_onboarding': 'Safety', 'safety_term': 'Safety',
    'hr_systems': 'HR', 'adp_setup': 'Payroll', 'wis': 'WIS Assignment'
  };
  var eoeCatMap = {
    'asset_collection': 'Assets', 'systems_deactivation': 'IT',
    'systems_deactivation_hr': 'HR', 'systems_deactivation_fleet': 'Fleet',
    'systems_deactivation_finance': 'Finance', 'systems_deactivation_deact': 'WIS User'
  };
  var changeCatMap = {
    'change_manager': 'Manager', 'change_it': 'IT', 'change_purchasing': 'Purchasing',
    'change_idsetup': 'ID Setup', 'change_safety': 'Safety',
    'change_businesscards': 'Business Cards', 'change_creditcard': 'Credit Card',
    'change_fleetio': 'Fleetio', 'change_jonas': 'Jonas'
  };

  var cat = specialistCatMap[targetStep] || eoeCatMap[targetStep] || changeCatMap[targetStep];
  if (!cat) return { success: false, message: 'Unknown action item step: ' + targetStep };

  try {
    var aiSh = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
    if (!aiSh) return { success: false, message: 'Action Items sheet not found' };

    var aiD = aiSh.getDataRange().getValues();
    var aH  = aiD[0];
    var wI  = aH.indexOf('Workflow ID'), catI = aH.indexOf('Category'),
        tiI = aH.indexOf('Task ID'),     asI  = aH.indexOf('Assigned To'),
        stI = aH.indexOf('Status'),      tnI  = aH.indexOf('Task Name'),
        ftI = aH.indexOf('Form Type');

    for (var i = 1; i < aiD.length; i++) {
      if (String(aiD[i][wI]) !== workflowId) continue;
      // Match by category; also accept form-type match for specialist steps
      var rowCat = String(aiD[i][catI] || '');
      var rowFt  = ftI >= 0 ? String(aiD[i][ftI] || '') : '';
      var isMatch = rowCat === cat || rowFt === targetStep;
      if (!isMatch) continue;
      if (String(aiD[i][stI]) === 'Closed') continue;

      var recipient = String(aiD[i][asI] || '');
      var formType  = String(aiD[i][tnI] || cat);
      var tid       = String(aiD[i][tiI] || '');

      if (tid && recipient && recipient.includes('@')) {
        var ctx = getWorkflowContext(workflowId) || {};
        sendFormEmail({
          to: recipient,
          subject: 'Reminder: ' + formType,
          body: 'ACTION REQUIRED: A reminder that the following action item is still pending your completion.',
          formUrl: buildFormUrl('action_item_view', { tid: tid }),
          displayName: 'TEAM Group - Employee Management',
          contextData: ctx,
          subjectOpts: { isReminder: true, requestDate: new Date() }
        });
        return { success: true, message: 'Reminder sent to ' + recipient, recipient: recipient };
      }
      break;
    }
  } catch (e) {
    Logger.log('[_sendActionItemBump] Error: ' + e.toString());
  }
  return { success: false, message: 'Action Item not found or already closed for: ' + targetStep };
}
