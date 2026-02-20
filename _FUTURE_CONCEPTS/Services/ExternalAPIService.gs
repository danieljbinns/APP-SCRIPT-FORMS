/**
 * ExternalAPIService.gs
 * 
 * Handles interactions with external 3rd party APIs (SiteDocs, DSS, etc).
 * 
 * REQUIREMENTS:
 * 1. API Keys/Tokens should be stored in Script Properties.
 * 2. Endpoints must be defined here.
 */

var ExternalAPIService = (function() {

  // Configuration - TO BE MOVED TO SCRIPT PROPERTIES
  var CONFIG = {
    SITEDOCS_API_URL: 'https://api.sitedocs.com/v1/', // Example URL
    SITEDOCS_TOKEN: 'YOUR_SITEDOCS_TOKEN',
    DSS_API_URL: 'https://api.dss.com/v1/', // Example URL
    DSS_TOKEN: 'YOUR_DSS_TOKEN'
  };

  /**
   * Creates a user account in SiteDocs.
   * @param {Object} userData - user details (name, email, etc.)
   * @returns {Object} Response from API
   */
  function createSiteDocsAccount(userData) {
    if (!userData || !userData.email) {
      throw new Error("Invalid user data for SiteDocs account creation.");
    }

    var payload = {
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      // Add other required fields
    };

    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + CONFIG.SITEDOCS_TOKEN
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    try {
      // Stubbing the call for now to prevent accidental execution during dev
      // var response = UrlFetchApp.fetch(CONFIG.SITEDOCS_API_URL + 'users', options);
      
      console.log("STUB: Creating SiteDocs account for " + userData.email);
      // return JSON.parse(response.getContentText());
      
      return { success: true, id: "STUB_SD_" + new Date().getTime(), message: "Account creation simulated" };

    } catch (e) {
      console.error("SiteDocs API Error: " + e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Creates a user account in DSS.
   * @param {Object} userData 
   * @returns {Object}
   */
  function createDSSAccount(userData) {
    if (!userData || !userData.email) {
      throw new Error("Invalid user data for DSS account creation.");
    }

    // DSS might require different payload structure
    var payload = {
      username: userData.email.split('@')[0],
      email: userData.email,
      fullName: userData.fullName
    };

    try {
      console.log("STUB: Creating DSS account for " + userData.email);
      // var response = UrlFetchApp.fetch(CONFIG.DSS_API_URL + 'users', ...);
      
      return { success: true, id: "STUB_DSS_" + new Date().getTime(), message: "Account creation simulated" };
    } catch (e) {
      console.error("DSS API Error: " + e.message);
      return { success: false, error: e.message };
    }
  }

  return {
    createSiteDocsAccount: createSiteDocsAccount,
    createDSSAccount: createDSSAccount
  };

})();
