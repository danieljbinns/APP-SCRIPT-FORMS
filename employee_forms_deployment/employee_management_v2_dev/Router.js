/**
 * Employee Management Forms V2 - Router
 * Single doGet() entry point that dispatches to specific forms
 */

function doGet(e) {
  try {
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
        // Domain users only — typically accessed via email link sent to assignee
        if (!AccessControlService.canAccessDashboard(userEmail)) return serveAccessDenied();
        return serveIDSetup(workflowId);

      case 'hr_verification':
        // Domain users only — typically accessed via email link sent to HR group
        if (!AccessControlService.canAccessDashboard(userEmail)) return serveAccessDenied();
        return serveHRVerification(workflowId);

      case 'it_setup':
        // Domain users only — typically accessed via email link sent to IT group
        if (!AccessControlService.canAccessDashboard(userEmail)) return serveAccessDenied();
        return serveITSetup(workflowId);

      case 'specialist':
        // Domain users only — typically accessed via email link sent to specialist group
        if (!AccessControlService.canAccessDashboard(userEmail)) return serveAccessDenied();
        const dept = e.parameter.dept || '';
        return serveSpecialist(workflowId, dept);

      case 'termination_request':
        return serveTerminationRequest();

      case 'position_site_change':
        return servePositionSiteChange();

      case 'termination_approval':
        if (!AccessControlService.canAccessDashboard(userEmail)) return serveAccessDenied();
        return serveTerminationApproval(workflowId);

      case 'position_change_approval':
        if (!AccessControlService.canAccessDashboard(userEmail)) return serveAccessDenied();
        return servePositionChangeApproval(workflowId);

      case 'it_confirmation':
        if (!AccessControlService.canAccessDashboard(userEmail)) return serveAccessDenied();
        return serveITConfirmation(workflowId);

      case 'action_item_view':
        // canViewForm: assigned person/group + Admin
        // tid-level auth is enforced inside ActionItemService.serveActionItem
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
  // Prefer dynamic URL to avoid hardcoding issues, fall back to config if needed (e.g. simple triggers)
  try {
    return ScriptApp.getService().getUrl();
  } catch (e) {
    return CONFIG.DEPLOYMENT_URL;
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
