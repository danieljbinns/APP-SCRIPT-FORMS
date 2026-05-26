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

  // ── Private: universal dual-check ──────────────────────────────────
  // Covers group addresses, personal emails, and group-self match.
  function _inGroup(userEmail, configEmail) {
    if (!userEmail || !configEmail) return false;
    if (userEmail.toLowerCase() === configEmail.toLowerCase()) return true;
    try {
      if (AdminDirectory.Members.hasMember(configEmail, userEmail).isMember) return true;
      // If not found, resolve primary email (handles alias logins across domains)
      try {
        var primaryEmail = AdminDirectory.Users.get(userEmail).primaryEmail;
        if (primaryEmail && primaryEmail.toLowerCase() !== userEmail.toLowerCase()) {
          return AdminDirectory.Members.hasMember(configEmail, primaryEmail).isMember;
        }
      } catch (e2) {}
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
      REVIEW_306090_JR: emails.REVIEW_306090_JR
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

    return {
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
  function canCancel(userEmail, workflow) {
    if (!userEmail) return false;
    var p = getUserRolePayload(userEmail);
    if (p.canCancelAll) return true;
    if (!workflow) return false;
    var e = userEmail.toLowerCase();
    return e === (workflow.requesterEmail || '').toLowerCase() ||
           e === (workflow.managerEmail   || '').toLowerCase();
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
    return e === (workflow.requesterEmail || '').toLowerCase() ||
           e === (workflow.managerEmail   || '').toLowerCase();
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
    return e === (workflow.requesterEmail || '').toLowerCase() ||
           e === (workflow.managerEmail   || '').toLowerCase();
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
    getUserAccessFlags: getUserAccessFlags,
    canCancel:          canCancel,
    canBump:            canBump,
    canViewStepData:    canViewStepData,
    canViewForm:        canViewForm,
    canHide:            canHide,
    canAccessDashboard: canAccessDashboard
  };

})();
