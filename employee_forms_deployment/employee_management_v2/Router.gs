/**
 * Employee Management Forms V2 - Router
 * Single doGet() entry point that dispatches to specific forms
 */

function doGet(e) {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    const form = e.parameter.form;
    const workflowId = e.parameter.wf || '';

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
        
      case 'id_setup':
        // Allow domain users - typically accessed via email link
        if (!AccessControlService.canAccessDashboard(userEmail)) return serveAccessDenied();
        return serveIDSetup(workflowId);
        
      case 'hr_verification':
        // Allow domain users - typically accessed via email link
        if (!AccessControlService.canAccessDashboard(userEmail)) return serveAccessDenied();
        return serveHRVerification(workflowId);
        
      case 'it_setup':
        // Allow domain users - typically accessed via email link
        if (!AccessControlService.canAccessDashboard(userEmail)) return serveAccessDenied();
        return serveITSetup(workflowId);
        
      case 'specialist':
        // Specialists might need granular token access later, but for now check generic specialist?
        // Or simply rely on the fact they have the link? 
        // Let's enforce domain at minimum.
        if (!userEmail.endsWith('@' + CONFIG.DOMAIN)) return serveAccessDenied();
        const dept = e.parameter.dept || '';
        return serveSpecialist(workflowId, dept);
        
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
  return CONFIG.DEPLOYMENT_URL || ScriptApp.getService().getUrl();
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
