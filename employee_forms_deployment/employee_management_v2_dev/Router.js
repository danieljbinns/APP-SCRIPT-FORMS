/**
 * Employee Management Forms V2 - Router
 * Single doGet() entry point that dispatches to specific forms
 */

function doGet(e) {
  try {
    // Maintenance mode — serve splash page for all requests when MAINTENANCE_MODE='true' in Script Properties.
    // MAINTENANCE_BYPASS_EMAILS Script Property (comma-separated) allows specific users through.
    if (CONFIG.MAINTENANCE_MODE) {
      var _userEmail = Session.getActiveUser().getEmail().toLowerCase();
      var _bypass = (PropertiesService.getScriptProperties().getProperty('MAINTENANCE_BYPASS_EMAILS') || '')
        .split(',').map(function(e) { return e.trim().toLowerCase(); }).filter(Boolean);
      if (_bypass.indexOf(_userEmail) === -1) {
        return HtmlService.createTemplateFromFile('MaintenancePage').evaluate()
          .setTitle('Down for Maintenance')
          .addMetaTag('viewport', 'width=device-width, initial-scale=1');
      }
    }

    const userEmail = Session.getActiveUser().getEmail();
    const form = e.parameter.form;
    const workflowId = e.parameter.wf || e.parameter.id || '';

    // DEFAULT LANDING LOGIC
    if (!e.parameter.form) {
      return serveLandingPage();
    }

    switch(form) {
      case 'initial_request':
        // Anyone in domain can start a request
        return serveInitialRequest();
        
      case 'equipment_request':
        // Anyone in domain can request hardware/software
        return serveEquipmentRequest();

      case 'dashboard':
        // Dashboard has internal filtering, but we can double check general access
        if (!AccessControlService.canAccessDashboard(userEmail)) return serveAccessDenied();
        return serveDashboard();
        
      case 'workflow_map':
        return serveWorkflowMap();

      case 'request_details':
        if (!AccessControlService.canAccessDashboard(userEmail)) return serveAccessDenied();
        return serveRequestDetails(workflowId);

      case 'id_setup':
        // ID Setup group + Admin only
        if (!AccessControlService.canViewForm(userEmail, CONFIG.EMAILS.IDSETUP)) return serveAccessDenied();
        return serveIDSetup(workflowId);

      case 'hr_verification':
        // HR group + Admin only
        if (!AccessControlService.canViewForm(userEmail, CONFIG.EMAILS.HR)) return serveAccessDenied();
        return serveHRVerification(workflowId);

      case 'it_setup':
        // IT group + Admin only
        if (!AccessControlService.canViewForm(userEmail, CONFIG.EMAILS.IT)) return serveAccessDenied();
        return serveITSetup(workflowId);

      case 'specialist':
        // Domain check — dept/tid-level auth enforced inside serveSpecialist / ActionItemService
        if (!AccessControlService.canAccessDashboard(userEmail)) return serveAccessDenied();
        const dept = e.parameter.dept || '';
        return serveSpecialist(workflowId, dept);

      case 'termination_request':
        return serveTerminationRequest();

      case 'position_site_change':
        return servePositionSiteChange();

      case 'termination_approval':
        // HR group + Payroll + Admin
        if (!AccessControlService.canViewForm(userEmail, CONFIG.EMAILS.HR) &&
            !AccessControlService.canViewForm(userEmail, CONFIG.EMAILS.PAYROLL)) return serveAccessDenied();
        return serveTerminationApproval(workflowId);

      case 'position_change_approval':
        // HR group + Payroll + Admin
        if (!AccessControlService.canViewForm(userEmail, CONFIG.EMAILS.HR) &&
            !AccessControlService.canViewForm(userEmail, CONFIG.EMAILS.PAYROLL)) return serveAccessDenied();
        return servePositionChangeApproval(workflowId);

      case 'it_confirmation':
        // Dave Langohr (BUSINESS_CARDS personal email) + IT group + Admin
        if (!AccessControlService.canViewForm(userEmail, CONFIG.EMAILS.BUSINESS_CARDS) &&
            !AccessControlService.canViewForm(userEmail, CONFIG.EMAILS.IT)) return serveAccessDenied();
        return serveITConfirmation(workflowId);

      case 'action_item_view':
        // Domain check — tid-level auth enforced inside ActionItemService.serveActionItem
        if (!AccessControlService.canAccessDashboard(userEmail)) return serveAccessDenied();
        return ActionItemService.serveActionItem(e.parameter.tid);

      // ── Reference guides ──────────────────────────────────────────────────
      case 'ref_deck':
        return serveRefPage('Employee-Portal-Training-Deck', 'Portal Overview — Employee Management');
      case 'ref_new_hire':
        return serveRefPage('new-hire-submitter', 'New Employee Request — Reference Guide');
      case 'ref_equipment':
        return serveRefPage('equipment-request-submitter', 'Equipment and Systems Request — Reference Guide');
      case 'ref_termination':
        return serveRefPage('termination-submitter', 'End of Employment — Reference Guide');
      case 'ref_status_change':
        return serveRefPage('status-change-submitter', 'Status & Position Change — Reference Guide');
      // ──────────────────────────────────────────────────────────────────────

      default:
        return HtmlService.createHtmlOutput('<h1>Form not found</h1><p>Form: ' + form + '</p>');
    }
  } catch (error) {
    Logger.log('Router error: ' + error.toString());
    return HtmlService.createHtmlOutput('<h1>Error</h1><p>' + error.message + '</p>');
  }
}

/**
 * Get the base URL for this web app (for form links)
 */
function getBaseUrl() {
  // Prefer configured DEPLOYMENT_URL Script Property so functions run from the editor
  // (e.g. ReplayService, triggers) always use the correct /exec URL rather than the
  // /dev test URL that ScriptApp.getService().getUrl() returns in editor context.
  var configured = CONFIG.DEPLOYMENT_URL;
  if (configured) return configured;
  try {
    return ScriptApp.getService().getUrl();
  } catch (e) {
    return '';
  }
}

/**
 * Helper function to build form URL with parameters
 */
function buildFormUrl(formName, params) {
  const baseUrl = getBaseUrl();
  const queryParams = ['form=' + formName];
  
  if (params) {
    Object.keys(params).forEach(key => {
      queryParams.push(key + '=' + encodeURIComponent(params[key]));
    });
  }
  
  return baseUrl + '?' + queryParams.join('&');
}

/**
 * Serve a static reference guide HTML file
 */
function serveRefPage(filename, title) {
  return HtmlService.createTemplateFromFile(filename)
    .evaluate()
    .setTitle(title)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function serveAccessDenied() {
  return HtmlService.createHtmlOutput(
    '<div style="text-align:center; padding:40px; font-family:sans-serif;">' +
    '<h1 style="color:#EB1C2D;">Access Denied</h1>' +
    '<p>You do not have permission to view this resource.</p>' +
    '<p style="color:#666; font-size:0.9rem;">User: ' + Session.getActiveUser().getEmail() + '</p>' +
    '</div>'
  ).setTitle('Access Denied');
}
