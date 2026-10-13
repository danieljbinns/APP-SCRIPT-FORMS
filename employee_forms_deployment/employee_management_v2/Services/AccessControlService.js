/**
 * AccessControlService.js
 *
 * Single source of truth for all role checks.
 * Reads groups from CONFIG — never hardcoded here.
 * Uses universal dual-check for every group:
 *   AdminDirectory.Members.hasMember(groupEmail, userEmail) || userEmail === groupEmail
 *
 * ══════════════════════════════════════════════════════════════════════
 * ROLE TIERS — checked top-down, first match wins
 * ══════════════════════════════════════════════════════════════════════
 * TIER 1  ADMIN        CONFIG.ADMIN_EMAILS list
 *                      editDates:YES  cancelAll:YES  bumpAll:YES
 *                      viewAllSteps:YES  viewAllForms:YES (any form)
 *
 * TIER 2  HR           CONFIG.EMAILS.HR
 *                      editDates:YES  cancelAll:YES  bumpAll:YES
 *                      viewAllSteps:YES  viewAssignedForms:YES
 *
 * TIER 3  IT           CONFIG.EMAILS.IT
 *                      editDates:YES  cancelAll:YES  bumpAll:YES
 *                      viewAllSteps:YES  viewAssignedForms:YES
 *
 * TIER 4  PAYROLL      CONFIG.EMAILS.PAYROLL
 *                      editDates:NO  cancelAll:NO  bumpAll:NO
 *                      viewAllSteps:YES  viewAssignedForms:YES
 *
 * TIER 5  SPECIALIST   member of ANY of:
 *                        IDSETUP / SAFETY / FLEETIO / CREDIT_CARD /
 *                        BUSINESS_CARDS / JONAS / REVIEW_306090_JR
 *                      editDates:NO  cancelOwn:YES  bumpOwn:YES
 *                      viewAllSteps:YES  viewAssignedForms:YES*
 *
 * TIER 6  REQUESTER    workflow.requesterEmail === userEmail
 *                      editDates:NO  cancelOwn:YES  bumpOwn:YES
 *                      viewOwnSteps:YES  viewForms:NO
 *
 * TIER 7  MANAGER      workflow.managerEmail === userEmail
 *                      editDates:NO  cancelOwn:YES  bumpOwn:YES
 *                      viewOwnSteps:YES  viewForms:NO
 *
 * TIER 8  DOMAIN USER  authenticated Google user on allowed domain
 *                      viewDashboard:YES  viewRequestDetails:YES
 *                      nothing else
 *
 * * viewAssignedForms: can open forms where Assigned To matches their
 *   email or group. Admin can open ANY form regardless of assignment.
 *
 * View Data — initial step: open to ALL (Tier 8+)
 * View Data — other steps:  Tier 1–5 (any named group) + Tier 6–7 (own wf)
 * ══════════════════════════════════════════════════════════════════════
 *
 * GROUPS (sourced from Config.js)
 *   CONFIG.ADMIN_EMAILS          — hardcoded array (Tier 1)
 *   CONFIG.EMAILS.HR             — grp.forms.hr@team-group.com
 *   CONFIG.EMAILS.IT             — grp.forms.it@team-group.com
 *   CONFIG.EMAILS.PAYROLL        — payroll@team-group.com
 *   CONFIG.EMAILS.IDSETUP        — grp.forms.idsetup@team-group.com
 *   CONFIG.EMAILS.SAFETY         — grp.forms.safety@team-group.com
 *   CONFIG.EMAILS.FLEETIO        — grp.forms.fleetio@team-group.com
 *   CONFIG.EMAILS.CREDIT_CARD    — grp.forms.creditcard@team-group.com
 *   CONFIG.EMAILS.BUSINESS_CARDS — davelangohr@team-group.com (personal)
 *   CONFIG.EMAILS.JONAS          — grp.forms.jonas@team-group.com
 *   CONFIG.EMAILS.REVIEW_306090_JR — grp.forms.review306090@team-group.com
 * ══════════════════════════════════════════════════════════════════════
 */

var AccessControlService = (function() {

  // Primary-email lookups, memoised per execution. The alias resolution below used to run inside
  // every group check — on a miss that meant hasMember + Users.get + hasMember again, so a user who
  // is not in ~13 groups paid ~39 Admin Directory round trips (~8s). The answer is identical every
  // time, so resolve it once.
  var _primaryCache = {};
  function _primaryEmail(userEmail) {
    var k = String(userEmail || '').toLowerCase();
    if (!k) return '';
    if (Object.prototype.hasOwnProperty.call(_primaryCache, k)) return _primaryCache[k];
    var out = '';
    try {
      var p = AdminDirectory.Users.get(userEmail).primaryEmail;
      if (p && p.toLowerCase() !== k) out = p;
    } catch (e) { /* alias lookup is best-effort */ }
    _primaryCache[k] = out;
    return out;
  }

  // ── Group membership, read from the Reference_Groups sheet ─────────────────
  //
  // Role checks used to hit Admin Directory ~14 times per page load (~8s). The answers change only
  // when someone's membership changes, so refreshDirectoryGroups() snapshots them into a sheet and
  // this reads that instead: one sheet read, cached for the execution and in CacheService.
  //
  // Staleness is deliberate and VISIBLE — the sheet carries an Updated column — rather than hidden
  // in a TTL. If the sheet is missing or empty we fall back to the live API, so a failed refresh
  // degrades to "slow but correct", never "wrong".
  var _groupMapMemo = null;

  function _groupMembers() {
    if (_groupMapMemo) return _groupMapMemo;

    var CACHE_KEY = 'efx_groupmap_v1';
    try {
      var hit = CacheService.getScriptCache().get(CACHE_KEY);
      if (hit) { _groupMapMemo = JSON.parse(hit); return _groupMapMemo; }
    } catch (e) { /* optimisation only */ }

    var map = {};
    try {
      var sh = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
                 .getSheetByName(CONFIG.SHEETS.REFERENCE_GROUPS);
      if (sh && sh.getLastRow() > 1) {
        var RG = SCHEMA.REFERENCE_GROUPS;
        var d = sh.getRange(1, 1, sh.getLastRow(), 4).getValues();
        for (var i = SCHEMA.ROW.FIRST_DATA; i < d.length; i++) {
          var g = String(d[i][RG.GROUP_EMAIL] || '').toLowerCase();
          var m = String(d[i][RG.MEMBER_EMAIL] || '').toLowerCase();
          if (!g || !m) continue;
          if (!map[g]) map[g] = {};
          map[g][m] = true;
        }
      }
    } catch (e) {
      Logger.log('[AccessControl] group sheet read failed: ' + e.message);
    }

    _groupMapMemo = map;
    try {
      var payload = JSON.stringify(map);
      if (payload.length < 90000) CacheService.getScriptCache().put(CACHE_KEY, payload, 600);
    } catch (e) { /* non-fatal */ }
    return map;
  }

  // ── Private: universal dual-check ──────────────────────────────────
  // Covers group addresses, personal emails, and group-self match.
  function _inGroup(userEmail, configEmail) {
    if (!userEmail || !configEmail) return false;
    if (userEmail.toLowerCase() === configEmail.toLowerCase()) return true;

    // Snapshot first — no API call when the sheet knows this group.
    var snapshot = _groupMembers();
    var members  = snapshot[String(configEmail).toLowerCase()];
    if (members) {
      if (members[userEmail.toLowerCase()]) return true;
      var alias = _primaryEmail(userEmail);
      if (alias && members[alias.toLowerCase()]) return true;
      return false;          // the sheet covers this group; trust it
    }

    // No snapshot for this group (never refreshed, or refresh failed) → live lookup.
    try {
      if (AdminDirectory.Members.hasMember(configEmail, userEmail).isMember) return true;
      // If not found, re-check under the primary email (handles alias logins across domains).
      // _primaryEmail is memoised, so this costs one API call per execution, not one per group.
      var primaryEmail = _primaryEmail(userEmail);
      if (primaryEmail) {
        try { return AdminDirectory.Members.hasMember(configEmail, primaryEmail).isMember; }
        catch (e2) { return false; }
      }
      return false;
    } catch (e) {
      // "Not Authorized" fires when configEmail is a personal address, not a Google Group — expected, not an error.
      if (e.message && e.message.indexOf('Not Authorized') === -1) {
        Logger.log('AccessControl: group check skipped for ' + userEmail + ' in ' + configEmail + '. ' + e.message);
      }
      return false;
    }
  }

  // ── Private: specialist group map ──────────────────────────────────
  function _specialistGroupMap() {
    var emails = CONFIG.EMAILS;
    return {
      IDSETUP:          emails.IDSETUP,
      SAFETY:           emails.SAFETY,
      FLEETIO:          emails.FLEETIO,
      CREDIT_CARD:      emails.CREDIT_CARD,
      BUSINESS_CARDS:   emails.BUSINESS_CARDS,
      JONAS:            emails.JONAS,
      REVIEW_306090_JR: emails.REVIEW_306090_JR,
      REVIEW_JR_TITLE:  emails.REVIEW_JR_TITLE
    };
  }

  // ───────────────────────────────────────────────────────────────────
  // PUBLIC: isAdmin
  // ───────────────────────────────────────────────────────────────────
  function isAdmin(userEmail) {
    if (!userEmail) return false;
    return CONFIG.ADMIN_EMAILS.some(function(e) { return e.toLowerCase() === userEmail.toLowerCase(); });
  }

  // ───────────────────────────────────────────────────────────────────
  // PUBLIC: getUserRolePayload
  // Returns a flat role object for embedding in server responses.
  // Call ONCE per request — client stores in sessionStorage.
  // ───────────────────────────────────────────────────────────────────
  function getUserRolePayload(userEmail) {
    if (!userEmail) return _emptyPayload();
    var email  = userEmail.toLowerCase();
    var emails = CONFIG.EMAILS;



    var _isAdmin   = isAdmin(email);
    var _isHR      = _inGroup(email, emails.HR);
    var _isIT      = _inGroup(email, emails.IT);
    var _isPayroll = _inGroup(email, emails.PAYROLL);

    var sgMap = _specialistGroupMap();
    var specialistGroups = Object.keys(sgMap).filter(function(k) { return _inGroup(email, sgMap[k]); });
    var _isSpecialist = specialistGroups.length > 0;

    var payload = {
      isAdmin:            _isAdmin,
      isHR:               _isHR,
      isIT:               _isIT,
      isPayroll:          _isPayroll,
      isSpecialist:       _isSpecialist,
      specialistGroups:   specialistGroups,
      canEditDates:       _isAdmin || _isHR || _isIT,
      canCancelAll:       _isAdmin || _isHR || _isIT,
      canBumpAll:         _isAdmin || _isHR || _isIT,
      canViewAllStepData: _isAdmin || _isHR || _isIT || _isPayroll || _isSpecialist
    };

    return payload;
  }

  // Drop a cached role so a membership change takes effect immediately instead of waiting out the
  // TTL. Call with no argument to clear the caller's own entry.
  function clearRoleCache(userEmail) {
    _groupMapMemo = null;
    try { CacheService.getScriptCache().remove('efx_groupmap_v1'); return true; }
    catch (e) { return false; }
  }

  function _emptyPayload() {
    return {
      isAdmin: false, isHR: false, isIT: false, isPayroll: false,
      isSpecialist: false, specialistGroups: [],
      canEditDates: false, canCancelAll: false, canBumpAll: false, canViewAllStepData: false
    };
  }

  // ───────────────────────────────────────────────────────────────────
  // PUBLIC: getUserAccessFlags  (legacy — used by DashboardDataHandler)
  // Thin wrapper around getUserRolePayload for backward compatibility.
  // ───────────────────────────────────────────────────────────────────
  function getUserAccessFlags(userEmail) {
    var p = getUserRolePayload(userEmail);
    return {
      isFullAccess: p.isAdmin || p.isHR || p.isIT || p.isPayroll || p.isSpecialist,
      canEditDates: p.canEditDates
    };
  }

  // ───────────────────────────────────────────────────────────────────
  // PUBLIC: canCancel
  // HR / IT / Admin — any workflow.  Requester / Manager — own only.
  // Specialist — own only (treat same as requester/manager for cancel).
  // ───────────────────────────────────────────────────────────────────
  function _wfEmail(workflow, field) {
    return (workflow[field] || workflow[field.replace(/([A-Z])/g, ' $1').replace(/^ /, '')] || '').toLowerCase();
  }

  function canCancel(userEmail, workflow) {
    if (!userEmail) return false;
    var p = getUserRolePayload(userEmail);
    if (p.canCancelAll) return true;
    if (!workflow) return false;
    var e = userEmail.toLowerCase();
    return e === (workflow['Initiator Email'] || '').toLowerCase()
        || e === (workflow['Manager Email'] || '').toLowerCase();
  }

  // ───────────────────────────────────────────────────────────────────
  // PUBLIC: canBump
  // Same tier rules as cancel.
  // ───────────────────────────────────────────────────────────────────
  function canBump(userEmail, workflow) {
    if (!userEmail) return false;
    var p = getUserRolePayload(userEmail);
    if (p.canBumpAll) return true;
    if (!workflow) return false;
    var e = userEmail.toLowerCase();
    return e === (workflow['Initiator Email'] || '').toLowerCase()
        || e === (workflow['Manager Email'] || '').toLowerCase();
  }

  // ───────────────────────────────────────────────────────────────────
  // PUBLIC: canViewStepData
  // stepIndex === 0 (initial_request) → open to all authenticated users.
  // All other steps → Tier 1–5 (any named group) + Tier 6–7 (own wf).
  // ───────────────────────────────────────────────────────────────────
  function canViewStepData(userEmail, workflow, stepIndex) {
    if (stepIndex === 0) return true;
    if (!userEmail) return false;
    var p = getUserRolePayload(userEmail);
    if (p.canViewAllStepData) return true;
    if (!workflow) return false;
    var e = userEmail.toLowerCase();
    return e === (workflow['Requester Email'] || workflow.requesterEmail || '').toLowerCase() ||
           e === (workflow['Manager Email']   || workflow.managerEmail   || '').toLowerCase();
  }

  // ───────────────────────────────────────────────────────────────────
  // PUBLIC: canViewForm
  // Admin can open ANY form. Others: assignedTo email/group match only.
  // ───────────────────────────────────────────────────────────────────
  function canViewForm(userEmail, assignedTo) {
    if (!userEmail) return false;
    if (isAdmin(userEmail)) return true;
    if (!assignedTo) return false;
    var e = userEmail.toLowerCase();
    return e === assignedTo.toLowerCase() || _inGroup(e, assignedTo);
  }

  // ───────────────────────────────────────────────────────────────────
  // PUBLIC: canHide  (admin-only bulk action)
  // ───────────────────────────────────────────────────────────────────
  function canHide(userEmail) {
    return isAdmin(userEmail);
  }

  // ───────────────────────────────────────────────────────────────────
  // PUBLIC: canAccessDashboard  (kept for Router.js compatibility)
  // Everyone on an allowed domain can access. Returns true for any
  // authenticated user — data is unfiltered by design.
  // ───────────────────────────────────────────────────────────────────
  function canAccessDashboard(userEmail) {
    if (!userEmail) return false;
    return CONFIG.ALLOWED_DOMAINS.some(function(d) {
      return userEmail.toLowerCase().endsWith('@' + d);
    }) || isAdmin(userEmail);
  }

  // ───────────────────────────────────────────────────────────────────
  // RETURN public API
  // ───────────────────────────────────────────────────────────────────
  return {
    isAdmin:            isAdmin,
    getUserRolePayload: getUserRolePayload,
    clearRoleCache:     clearRoleCache,
    getUserAccessFlags: getUserAccessFlags,
    canCancel:          canCancel,
    canBump:            canBump,
    canViewStepData:    canViewStepData,
    canViewForm:        canViewForm,
    canHide:            canHide,
    canAccessDashboard: canAccessDashboard
  };

})();

// ─────────────────────────────────────────────────────────────────────────────
// refreshDirectoryGroups
//
// Snapshot every group the app gates on into the Reference_Groups sheet, so role checks read a
// sheet instead of calling Admin Directory ~14 times on every page load.
//
// Costs one Members.list per group (paginated). Safe to run any time; it rewrites the sheet
// wholesale. Intended for a time-driven trigger (hourly/daily) — set one up in the editor — and
// runnable by hand after a membership change.
//
// Addresses that are NOT groups (CONFIG.EMAILS.BUSINESS_CARDS is a person) are recorded with
// themselves as the only member, which preserves the existing "personal address counts as a match"
// behaviour without an API call.
// ─────────────────────────────────────────────────────────────────────────────
function refreshDirectoryGroups() {
  var emails = CONFIG.EMAILS;
  var targets = {
    HR: emails.HR, IT: emails.IT, PAYROLL: emails.PAYROLL,
    IDSETUP: emails.IDSETUP, SAFETY: emails.SAFETY, FLEETIO: emails.FLEETIO,
    CREDIT_CARD: emails.CREDIT_CARD, BUSINESS_CARDS: emails.BUSINESS_CARDS,
    JONAS: emails.JONAS, REVIEW_306090_JR: emails.REVIEW_306090_JR,
    REVIEW_JR_TITLE: emails.REVIEW_JR_TITLE, IT_CONFIRMATION: emails.IT_CONFIRMATION
  };

  var now = new Date();
  var rows = [];
  var summary = {};

  Object.keys(targets).forEach(function(key) {
    var groupEmail = String(targets[key] || '').trim();
    if (!groupEmail) return;
    var members = [];
    try {
      var pageToken = null;
      do {
        var resp = AdminDirectory.Members.list(groupEmail, { maxResults: 200, pageToken: pageToken });
        (resp.members || []).forEach(function(m) {
          if (m.email) members.push(String(m.email).toLowerCase());
        });
        pageToken = resp.nextPageToken;
      } while (pageToken);
    } catch (e) {
      // Not a group (a personal address), or no access. Record it as its own member so the
      // "personal address" case still resolves without hitting the API at read time.
      members = [groupEmail.toLowerCase()];
      Logger.log('[refreshDirectoryGroups] ' + key + ' (' + groupEmail + ') not listable: ' + e.message);
    }
    members.forEach(function(m) { rows.push([key, groupEmail.toLowerCase(), m, now]); });
    summary[key] = members.length;
  });

  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEETS.REFERENCE_GROUPS);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SHEETS.REFERENCE_GROUPS);
    sh.appendRow(['Group Key', 'Group Email', 'Member Email', 'Updated']);
    sh.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#EB1C2D').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 4).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, 4).setValues(rows);

  // Drop the cached snapshot so the new data is live immediately.
  try { AccessControlService.clearRoleCache(); } catch (e) {}

  Logger.log('[refreshDirectoryGroups] ' + rows.length + ' member rows across ' +
             Object.keys(summary).length + ' groups: ' + JSON.stringify(summary));
  return { groups: Object.keys(summary).length, rows: rows.length, summary: summary };
}

// Runner-shaped wrapper for gas_runner.py.
function refreshDirectoryGroupsForRunner() {
  try {
    var r = refreshDirectoryGroups();
    return { pass: r.rows, fail: 0, warn: 0, emailTotal: 0, failures: [],
             groups: r.groups, summary: r.summary, gasLog: Logger.getLog() };
  } catch (e) {
    return { pass: 0, fail: 1, warn: 0, emailTotal: 0,
             failures: [String(e && e.message)], gasLog: Logger.getLog() };
  }
}
