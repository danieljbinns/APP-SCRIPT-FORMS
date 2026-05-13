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

      case 'dashboard':
        // Dashboard has internal filtering, but we can double check general access
        if (!AccessControlService.canAccessDashboard(userEmail)) return serveAccessDenied();
        return serveDashboard();
        
      case 'workflow_map':
        return serveWorkflowMap();

      case 'request_details':
        if (!AccessControlService.canAccessDashboard(userEmail)) return serveAccessDenied();
        return serveRequestDetails(workflowId);

      case 'data_manager':
        // Admin access check (reusing dashboard access for now)
        if (!AccessControlService.canAccessDashboard(userEmail)) return serveAccessDenied();
        return serveDataManager();

        
      case 'id_setup':
        // Allow domain users - typically accessed via email link
        // Access check removed as requested
        return serveIDSetup(workflowId);
        
      case 'hr_verification':
        // Allow domain users - typically accessed via email link
        // Access check removed as requested
        return serveHRVerification(workflowId);
        
      case 'it_setup':
        // Allow domain users - typically accessed via email link
        // Access check removed as requested
        return serveITSetup(workflowId);
        
      case 'specialist':
        // Specialist queue
        // Access check removed as requested
        const dept = e.parameter.dept || '';
        return serveSpecialist(workflowId, dept);
        
      case 'termination_builder':
        return serveTerminationBuilder();
        
      case 'position_change_builder':
        return servePositionChangeBuilder();

      case 'termination_request':
        return serveTerminationRequest();

      case 'position_site_change':
        return servePositionSiteChange();
        
      case 'termination_approval':
        return serveTerminationApproval(workflowId);
        
      case 'position_change_approval':
        return servePositionChangeApproval(workflowId);
        
      case 'asset_retrieval':
        return serveAssetRetrieval(workflowId);

      case 'action_item_view':
        return ActionItemService.serveActionItem(e.parameter.tid);
        
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

function serveAccessDenied() {
  return HtmlService.createHtmlOutput(
    '<div style="text-align:center; padding:40px; font-family:sans-serif;">' +
    '<h1 style="color:#EB1C2D;">Access Denied</h1>' +
    '<p>You do not have permission to view this resource.</p>' +
    '<p style="color:#666; font-size:0.9rem;">User: ' + Session.getActiveUser().getEmail() + '</p>' +
    '</div>'
  ).setTitle('Access Denied');
}
