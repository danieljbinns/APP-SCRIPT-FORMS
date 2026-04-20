/**
 * Landing Page Handler
 */

function serveLandingPage() {
  const template = HtmlService.createTemplateFromFile('LandingPage');
  return template.evaluate()
    .setTitle('Employee Management Portal')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getCurrentUserEmail() {
  return Session.getActiveUser().getEmail();
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
