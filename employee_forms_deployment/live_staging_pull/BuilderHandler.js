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
  return HtmlService.createHtmlOutputFromFile('TerminationRequest')
    .setTitle('Termination / End of Employment')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function servePositionSiteChange() {
  return HtmlService.createHtmlOutputFromFile('PositionSiteChangeRequest')
    .setTitle('Position / Site Change Request')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

