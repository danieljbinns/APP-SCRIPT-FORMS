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
 * Safe include — returns empty string if file is missing, errors, or easter eggs are disabled.
 * Gate: Script Property EASTER_EGGS_ENABLED must equal 'true' or nothing is loaded.
 * Use instead of include() for optional components (e.g. EasterEgg).
 */
function safeInclude(filename) {
  try {
    if (PropertiesService.getScriptProperties().getProperty('EASTER_EGGS_ENABLED') !== 'true') return '';
    return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
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
