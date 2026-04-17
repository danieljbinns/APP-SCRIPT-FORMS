/**
 * Form Builder Serving Functions
 */

function serveTerminationBuilder() {
  return HtmlService.createHtmlOutputFromFile('TerminationFormBuilder')
    .setTitle('Termination Form Builder')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function servePositionChangeBuilder() {
  return HtmlService.createHtmlOutputFromFile('PositionSiteChangeFormBuilder')
    .setTitle('Position / Site Change Form Builder')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function serveTerminationRequest() {
  const template = HtmlService.createTemplateFromFile('TerminationRequest');
  template.referenceData = JSON.stringify(getInitialFormData());
  return template.evaluate()
    .setTitle('Termination / End of Employment')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function servePositionSiteChange() {
  const template = HtmlService.createTemplateFromFile('PositionSiteChangeRequest');
  template.referenceData = JSON.stringify(getInitialFormData());
  return template.evaluate()
    .setTitle('Position / Site Change Request')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

