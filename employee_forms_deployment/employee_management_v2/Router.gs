/**
 * Employee Management Forms V2 - Router
 * Single doGet() entry point that dispatches to specific forms
 */

function doGet(e) {
  const form = e.parameter.form || 'initial_request';
  const workflowId = e.parameter.wf || '';
  
  try {
    switch(form) {
      case 'initial_request':
        return serveInitialRequest();

      case 'dashboard':
        return serveDashboard();
        
      case 'id_setup':
        return serveIDSetup(workflowId);
        
      case 'hr_verification':
        return serveHRVerification(workflowId);
        
      case 'it_setup':
        return serveITSetup(workflowId);
        
      case 'specialist':
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
