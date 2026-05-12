/**
 * AccessControlService.gs
 * 
 * Handles permission checks for accessing Dashboards and Forms.
 * 
 * REQUIRES: 
 * - Admin Directory SDK (for group membership checks)
 * - Session.getActiveUser().getEmail()
 */

var AccessControlService = (function() {

  // Configuration - TO BE MOVED TO SCRIPT PROPERTIES
  // Dynamic Configuration via ConfigurationService
  function getConfig() {
    return {
      MASTER_ADMIN_GROUP: ConfigurationService.getSetting('GROUP_MASTER_ADMIN'),
      ALL_FORMS_GROUP: ConfigurationService.getSetting('GROUP_ALL_FORMS'),
      HR_GROUP: ConfigurationService.getSetting('GROUP_HR'),
      IT_GROUP: ConfigurationService.getSetting('GROUP_IT'),
      PAYROLL_GROUP: ConfigurationService.getSetting('EMAIL_PAYROLL') || 'payroll@team-group.com',
      ALLOWED_DOMAINS: CONFIG.ALLOWED_DOMAINS
    };
  }

  /**
   * Checks if the current user is a member of the specified group.
   * Uses AdminDirectory SDK member.hasMember which is efficient.
   * @param {string} userEmail 
   * @param {string} groupEmail 
   * @returns {boolean}
   */
  function isGroupMember(userEmail, groupEmail) {
    if (!userEmail || !groupEmail) return false;
    
    // Support for individual specialist emails (non-groups)
    if (userEmail.toLowerCase() === groupEmail.toLowerCase()) return true;
    
    try {
      var hasMember = AdminDirectory.Members.hasMember(groupEmail, userEmail);
      return hasMember.isMember;
    } catch (e) {
      // Graceful degradation: if group doesn't exist or API fails, just log and return false
      // This allows domain-based access to work even without configured groups
      Logger.log("AccessControl: Group check skipped for " + userEmail + " in " + groupEmail + ". Reason: " + e.message);
      return false;
    }
  }

  /**
   * Determines if the user can view the Unified Dashboard.
   * Any authenticated user is allowed in — data is filtered by canAccessWorkflow.
   * Group checks grant full unfiltered access; all others see only their own workflows.
   * @param {string} userEmail
   * @returns {boolean}
   */
  function canAccessDashboard(userEmail) {
    if (!userEmail) return false;
    var conf = getConfig();

    // Admins and broad-access groups
    if (isAdmin(userEmail)) return true;
    if (isGroupMember(userEmail, conf.MASTER_ADMIN_GROUP)) return true;
    if (isGroupMember(userEmail, conf.ALL_FORMS_GROUP)) return true;

    // Department groups — full visibility, filtered by canAccessWorkflow
    if (isGroupMember(userEmail, conf.HR_GROUP)) return true;
    if (isGroupMember(userEmail, conf.IT_GROUP)) return true;
    if (isGroupMember(userEmail, conf.PAYROLL_GROUP)) return true;

    // Specialist groups
    if (isGroupMember(userEmail, ConfigurationService.getSetting('EMAIL_IDSETUP'))) return true;
    if (isGroupMember(userEmail, ConfigurationService.getSetting('EMAIL_SAFETY'))) return true;
    if (isGroupMember(userEmail, CONFIG.EMAILS.FLEETIO)) return true;
    if (isGroupMember(userEmail, CONFIG.EMAILS.CREDIT_CARD)) return true;
    if (isGroupMember(userEmail, CONFIG.EMAILS.BUSINESS_CARDS)) return true;
    if (isGroupMember(userEmail, CONFIG.EMAILS.REVIEW_306090_JR)) return true;
    if (isGroupMember(userEmail, CONFIG.EMAILS.JONAS)) return true;

    // Any authenticated user may enter — canAccessWorkflow filters their data.
    // Managers and requestors from any domain will see only their own requests.
    return true;
  }

  /**
   * Determines if user can access a specific form type.
   * @param {string} userEmail 
   * @param {string} formType ('HR', 'IT', 'SPECIALIST')
   * @returns {boolean}
   */
  function canAccessForm(userEmail, formType) { 
    var conf = getConfig();
    // Always allow Master Admin or All Forms Group
    if (isGroupMember(userEmail, conf.MASTER_ADMIN_GROUP)) return true;
    if (isGroupMember(userEmail, conf.ALL_FORMS_GROUP)) return true;

    switch (formType) {
      case 'HR':
        return isGroupMember(userEmail, conf.HR_GROUP) || isGroupMember(userEmail, conf.PAYROLL_GROUP);
      case 'IT':
        return isGroupMember(userEmail, conf.IT_GROUP) || isGroupMember(userEmail, conf.PAYROLL_GROUP);
      case 'SPECIALIST':
        // Logic: Check if user was the recipient of the email?
        // This is harder to validate purely by group. 
        // Strategy: We might pass a secure token in the URL for one-time access,
        // or check if they are in ANY specialist group.
        return conf.ALLOWED_DOMAINS.some(domain => userEmail.endsWith('@' + domain));
      default:
        return true; // Public forms interact differently
    }
  }

  /**
   * Specific check for Workflow Detail Access (The "My Request" View)
   */
  function canAccessWorkflow(userEmail, workflow) {
      if (!workflow) return false;
      var conf = getConfig();
      
      // Admin Exception - can see all workflows
      if (isAdmin(userEmail)) return true;
      
      // Admins & Super Users
      if (isGroupMember(userEmail, conf.MASTER_ADMIN_GROUP)) return true;
      if (isGroupMember(userEmail, conf.ALL_FORMS_GROUP)) return true;

      // The Requester themselves
      if (workflow.requesterEmail && workflow.requesterEmail.toLowerCase() === userEmail.toLowerCase()) return true;

      // The Manager defined in the workflow
      if (workflow.managerEmail && workflow.managerEmail.toLowerCase() === userEmail.toLowerCase()) return true;

      // HR/IT/Payroll have full workflow visibility
      if (isGroupMember(userEmail, conf.HR_GROUP)) return true;
      if (isGroupMember(userEmail, conf.IT_GROUP)) return true;
      if (isGroupMember(userEmail, conf.PAYROLL_GROUP)) return true;

      // Make sure anyone in a group that receives forms can see the whole board
      if (isGroupMember(userEmail, ConfigurationService.getSetting('EMAIL_IDSETUP'))) return true;
      if (isGroupMember(userEmail, ConfigurationService.getSetting('EMAIL_SAFETY'))) return true;
      
      // Since some emails are just strings in Config.gs and not settings, we check those too
      if (isGroupMember(userEmail, CONFIG.EMAILS.FLEETIO)) return true;
      if (isGroupMember(userEmail, CONFIG.EMAILS.CREDIT_CARD)) return true;
      if (isGroupMember(userEmail, CONFIG.EMAILS.BUSINESS_CARDS)) return true;
      if (isGroupMember(userEmail, CONFIG.EMAILS.REVIEW_306090_JR)) return true;
      if (isGroupMember(userEmail, CONFIG.EMAILS.JONAS)) return true;

      return false;
  }

  /**
   * General Admin check
   */
  function isAdmin(userEmail) {
    if (!userEmail) return false;
    var conf = getConfig();
    if (CONFIG.ADMIN_EMAILS.indexOf(userEmail) !== -1) return true;
    if (isGroupMember(userEmail, conf.MASTER_ADMIN_GROUP)) return true;
    return false;
  }

  /**
   * Resolves all access flags for a user in a single pass.
   * Call this ONCE per request instead of canAccessWorkflow per row.
   * Returns { isFullAccess, canEditDates }
   * @param {string} userEmail
   * @returns {{isFullAccess: boolean, canEditDates: boolean}}
   */
  function getUserAccessFlags(userEmail) {
    if (!userEmail) return { isFullAccess: false, canEditDates: false };
    var conf = getConfig();

    // ADMIN_EMAILS check is pure JS — no API call
    if (CONFIG.ADMIN_EMAILS.indexOf(userEmail) !== -1) return { isFullAccess: true, canEditDates: true };

    // Group checks — short-circuit as early as possible
    if (isGroupMember(userEmail, conf.MASTER_ADMIN_GROUP)) return { isFullAccess: true, canEditDates: true };
    if (isGroupMember(userEmail, conf.ALL_FORMS_GROUP))    return { isFullAccess: true, canEditDates: true };
    if (isGroupMember(userEmail, conf.HR_GROUP))           return { isFullAccess: true, canEditDates: true };
    if (isGroupMember(userEmail, conf.IT_GROUP))           return { isFullAccess: true, canEditDates: true };
    if (isGroupMember(userEmail, conf.PAYROLL_GROUP))      return { isFullAccess: true, canEditDates: false };

    // Specialist groups — full visibility, no date editing
    if (isGroupMember(userEmail, ConfigurationService.getSetting('EMAIL_IDSETUP')))  return { isFullAccess: true, canEditDates: false };
    if (isGroupMember(userEmail, ConfigurationService.getSetting('EMAIL_SAFETY')))   return { isFullAccess: true, canEditDates: false };
    if (isGroupMember(userEmail, CONFIG.EMAILS.FLEETIO))          return { isFullAccess: true, canEditDates: false };
    if (isGroupMember(userEmail, CONFIG.EMAILS.CREDIT_CARD))      return { isFullAccess: true, canEditDates: false };
    if (isGroupMember(userEmail, CONFIG.EMAILS.BUSINESS_CARDS))   return { isFullAccess: true, canEditDates: false };
    if (isGroupMember(userEmail, CONFIG.EMAILS.REVIEW_306090_JR)) return { isFullAccess: true, canEditDates: false };
    if (isGroupMember(userEmail, CONFIG.EMAILS.JONAS))            return { isFullAccess: true, canEditDates: false };

    // Manager/requester — sees only their own workflows, no date editing
    return { isFullAccess: false, canEditDates: false };
  }

  return {
    canAccessDashboard: canAccessDashboard,
    canAccessForm: canAccessForm,
    canAccessWorkflow: canAccessWorkflow,
    isAdmin: isAdmin,
    getUserAccessFlags: getUserAccessFlags
  };

})();
