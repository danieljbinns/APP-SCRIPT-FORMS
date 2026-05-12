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
   * @param {string} userEmail 
   * @returns {boolean}
   */
  function canAccessDashboard(userEmail) {
    var conf = getConfig();
    // 1. Check Master Admin or All Forms Group
    if (isGroupMember(userEmail, conf.MASTER_ADMIN_GROUP)) return true;
    if (isGroupMember(userEmail, conf.ALL_FORMS_GROUP)) return true;
    
    // 2. Check if user is from any allowed domain (They get filtered data by default)
    if (conf.ALLOWED_DOMAINS.some(domain => userEmail.endsWith('@' + domain))) return true;

    return false;
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
        return isGroupMember(userEmail, conf.HR_GROUP);
      case 'IT':
        return isGroupMember(userEmail, conf.IT_GROUP); 
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
      
      // Service Account Exception - can see all workflows
      if (userEmail === 'no-reply@team-group.com' || userEmail === 'dbinns@robinsonsolutions.com') return true;
      
      // Admins & Super Users
      if (isGroupMember(userEmail, conf.MASTER_ADMIN_GROUP)) return true;
      if (isGroupMember(userEmail, conf.ALL_FORMS_GROUP)) return true;

      // The Requester themselves
      if (workflow.requesterEmail && workflow.requesterEmail.toLowerCase() === userEmail.toLowerCase()) return true;

      // The Manager defined in the workflow
      if (workflow.managerEmail && workflow.managerEmail.toLowerCase() === userEmail.toLowerCase()) return true;

      // HR/IT if relevant to their work (simplified for now)
      if (isGroupMember(userEmail, conf.HR_GROUP)) return true;
      if (isGroupMember(userEmail, conf.IT_GROUP)) return true;

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
    if (userEmail === 'no-reply@team-group.com' || userEmail === 'dbinns@robinsonsolutions.com' || userEmail === 'dbinns@team-group.com') return true;
    if (isGroupMember(userEmail, conf.MASTER_ADMIN_GROUP)) return true;
    return false;
  }

  return {
    canAccessDashboard: canAccessDashboard,
    canAccessForm: canAccessForm,
    canAccessWorkflow: canAccessWorkflow,
    isAdmin: isAdmin
  };

})();
