/**
 * DashboardUIHandler.js
 *
 * Page-serve functions for the Dashboard and WorkflowMap views.
 * No data reads, no access checks — just template setup.
 *
 * Depends on (global GAS scope):
 *   CONFIG          — Config.js
 *   getBaseUrl()    — Router.js
 */

function serveDashboard() {
  const template = HtmlService.createTemplateFromFile('Dashboard');
  template.baseUrl        = getBaseUrl();
  template.spreadsheetId  = CONFIG.SPREADSHEET_ID;
  template.environment    = typeof ENVIRONMENT !== 'undefined' ? ENVIRONMENT : 'PROD';

  return template.evaluate()
    .setTitle('Employee Onboarding Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function serveWorkflowMap() {
  const template = HtmlService.createTemplateFromFile('WorkflowMap');
  template.baseUrl = getBaseUrl();
  return template.evaluate()
    .setTitle('Process Map')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
