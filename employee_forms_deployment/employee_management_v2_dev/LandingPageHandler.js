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

/**
 * Safe include — returns empty string if file is missing or errors.
 * Use instead of include() for optional components (e.g. EasterEgg).
 * Allows per-page commenting out without breaking anything if file absent.
 */
function safeInclude(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch(e) {
    return '';
  }
}

function includeWithData(filename, data) {
  var tmpl = HtmlService.createTemplateFromFile(filename);
  if (data) {
    for (var key in data) {
      if (data.hasOwnProperty(key)) tmpl[key] = data[key];
    }
  }
  return tmpl.evaluate().getContent();
}
