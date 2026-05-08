/**
 * ChangeNotify.js
 * Shared utilities for detecting form field changes and notifying relevant parties
 * when HR Verification or IT Confirmation modifies original request data.
 */

/**
 * Compare original and submitted field values.
 * fieldMap: [{ key, label, isArray? }]
 * Returns [{ field, label, was, now }] for every field that changed.
 */
function diffFormFields(original, submitted, fieldMap) {
  var changes = [];
  (fieldMap || []).forEach(function(f) {
    var was = original  ? original[f.key]  : undefined;
    var now = submitted ? submitted[f.key] : undefined;
    if (f.isArray || Array.isArray(was) || Array.isArray(now)) {
      was = Array.isArray(was) ? was.slice().sort().join(', ') : String(was || '').split(', ').filter(Boolean).sort().join(', ');
      now = Array.isArray(now) ? now.slice().sort().join(', ') : String(now || '').split(', ').filter(Boolean).sort().join(', ');
    } else {
      was = String(was == null ? '' : was).trim();
      now = String(now == null ? '' : now).trim();
    }
    // Only flag as a change if the original had a value — blank → filled is additive, not a correction
    if (was !== '' && was !== now) {
      changes.push({ field: f.key, label: f.label, was: was, now: now });
    }
  });
  return changes;
}

/**
 * Build an inline HTML diff table for inclusion in email body.
 */
function buildChangesHtml(step, changes) {
  if (!changes || changes.length === 0) return '';
  var rows = changes.map(function(c) {
    return '<tr>'
      + '<td style="padding:6px 12px;border-bottom:1px solid #333;color:#ccc;font-size:13px;white-space:nowrap;">' + c.label + '</td>'
      + '<td style="padding:6px 12px;border-bottom:1px solid #333;color:#f87171;font-size:13px;">' + (c.was || '<em style="color:#666;">blank</em>') + '</td>'
      + '<td style="padding:6px 12px;border-bottom:1px solid #333;color:#4ade80;font-size:13px;">' + (c.now || '<em style="color:#666;">blank</em>') + '</td>'
      + '</tr>';
  }).join('');
  return '<div style="margin-top:20px;padding:16px;background:#1a1a1a;border-radius:6px;border:1px solid #333;">'
    + '<p style="margin:0 0 10px 0;font-size:13px;font-weight:600;color:#e2e2e2;">Changes Made During ' + step + '</p>'
    + '<table style="width:100%;border-collapse:collapse;">'
    + '<thead><tr>'
    + '<th style="padding:6px 12px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;background:#222;border-bottom:1px solid #444;">Field</th>'
    + '<th style="padding:6px 12px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;background:#222;border-bottom:1px solid #444;">Original</th>'
    + '<th style="padding:6px 12px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;background:#222;border-bottom:1px solid #444;">Updated To</th>'
    + '</tr></thead>'
    + '<tbody>' + rows + '</tbody>'
    + '</table></div>';
}

/**
 * Dispatch change notification emails to relevant parties.
 *
 * @param {string} workflowId
 * @param {string} step            'HR Verification' | 'IT Confirmation'
 * @param {Array}  changes         output of diffFormFields()
 * @param {Object} context         workflow context for email template
 * @param {Object} opts
 *   opts.requesterEmail  — always notified if present
 *   opts.managerEmail    — always notified if different from requester
 *   opts.notifySafety    — boolean: safety team (SiteDocs/DSS impact)
 *   opts.notifyIdSetup   — boolean: ID setup team (credentials/name impact)
 */
function sendChangeNotifications(workflowId, step, changes, context, opts) {
  if (!changes || changes.length === 0) return;
  opts = opts || {};

  var changesHtml  = buildChangesHtml(step, changes);
  var employeeName = (context && context.employeeName) || workflowId;
  var subject      = 'Information Updated';
  var intro        = 'Details for <strong>' + employeeName + '</strong> were updated during <strong>'
                     + step + '</strong>. Please review the changes below.';

  // Requester + Manager (always)
  var primaryRecipients = [];
  if (opts.requesterEmail) primaryRecipients.push(opts.requesterEmail);
  if (opts.managerEmail && opts.managerEmail !== opts.requesterEmail) primaryRecipients.push(opts.managerEmail);

  if (primaryRecipients.length > 0) {
    sendFormEmail({
      to: primaryRecipients.join(','),
      subject: subject,
      body: intro + changesHtml,
      formUrl: '',
      displayName: 'TEAM Group - Employee Onboarding',
      contextData: context || {}
    });
    Logger.log('[ChangeNotify] Change notification → requester/manager for ' + workflowId);
  }

  // Safety team (SiteDocs locations / DSS learning paths impacted)
  if (opts.notifySafety && CONFIG.EMAILS.SAFETY) {
    sendFormEmail({
      to: CONFIG.EMAILS.SAFETY,
      subject: subject,
      body: 'Employee details were updated during ' + step
            + '. Please review — changes may affect SiteDocs location assignments or DSS learning paths.'
            + changesHtml,
      formUrl: '',
      displayName: 'TEAM Group - Employee Onboarding',
      contextData: context || {}
    });
    Logger.log('[ChangeNotify] Change notification → Safety for ' + workflowId);
  }

  // ID Setup team (credentials / name-based IDs impacted)
  if (opts.notifyIdSetup && CONFIG.EMAILS.IDSETUP) {
    sendFormEmail({
      to: CONFIG.EMAILS.IDSETUP,
      subject: subject,
      body: 'Employee details were updated during ' + step
            + '. Please review — changes may affect credentials or ID assignments already set up for this employee.'
            + changesHtml,
      formUrl: '',
      displayName: 'TEAM Group - Employee Onboarding',
      contextData: context || {}
    });
    Logger.log('[ChangeNotify] Change notification → ID Setup for ' + workflowId);
  }
}

// ── Field maps ──────────────────────────────────────────────────────────────

var CHANGE_FIELDS_HR_VERIFICATION = [
  { key: 'firstName',    label: 'First Name' },
  { key: 'lastName',     label: 'Last Name' },
  { key: 'hireDate',     label: 'Hire Date' },
  { key: 'siteName',     label: 'Site' },
  { key: 'department',   label: 'Department' },
  { key: 'managerName',  label: 'Manager Name' },
  { key: 'managerEmail', label: 'Manager Email' },
  { key: 'jobTitle',     label: 'Job Title' },
  { key: 'jrTitle',      label: 'JR Title' }
];

var CHANGE_FIELDS_IT_NEW_HIRE = [
  { key: 'firstName',       label: 'First Name' },
  { key: 'lastName',        label: 'Last Name' },
  { key: 'hireDate',        label: 'Hire Date' },
  { key: 'siteName',        label: 'Site' },
  { key: 'positionTitle',   label: 'Position Title' },
  { key: 'managerName',     label: 'Manager Name' },
  { key: 'managerEmail',    label: 'Manager Email' },
  { key: 'department',      label: 'Department' },
  { key: 'systems',         label: 'Systems',           isArray: true },
  { key: 'equipment',       label: 'Equipment',         isArray: true },
  { key: 'googleEmail',     label: 'Google Email' },
  { key: 'googleDomain',    label: 'Google Domain' },
  { key: 'jonasJobNumbers', label: 'Jonas Job #s',      isArray: true },
  { key: 'purchasingSites', label: 'Purchasing Sites',  isArray: true }
];

var CHANGE_FIELDS_IT_EQUIPMENT = [
  { key: 'firstName',     label: 'First Name' },
  { key: 'lastName',      label: 'Last Name' },
  { key: 'siteName',      label: 'Site' },
  { key: 'positionTitle', label: 'Position Title' },
  { key: 'managerName',   label: 'Manager Name' },
  { key: 'managerEmail',  label: 'Manager Email' },
  { key: 'systems',       label: 'Systems',    isArray: true },
  { key: 'equipment',     label: 'Equipment',  isArray: true }
];

var CHANGE_FIELDS_IT_STATUS_CHANGE = [
  { key: 'siteNew',         label: 'New Site' },
  { key: 'titleNew',        label: 'New Title' },
  { key: 'classNew',        label: 'New Classification' },
  { key: 'department',      label: 'Department' },
  { key: 'systems',         label: 'Systems to Add',    isArray: true },
  { key: 'equipment',       label: 'Equipment',         isArray: true },
  { key: 'removal',         label: 'Systems to Remove', isArray: true },
  { key: 'purchasingSites', label: 'Purchasing Sites',  isArray: true }
];
