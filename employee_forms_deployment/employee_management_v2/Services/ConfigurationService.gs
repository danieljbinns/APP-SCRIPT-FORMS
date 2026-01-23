/**
 * ConfigurationService.gs
 * 
 * Manages loadable/saveable configuration for the application.
 * Uses ScriptProperties to store dynamic settings, falling back to Config.gs for defaults.
 */

var ConfigurationService = (function() {

  // --- Defaults (from Config.gs) ---
  var DEFAULTS = {
    // Permission Groups
    'GROUP_MASTER_ADMIN': 'admin-access@robinsonsolutions.com',
    'GROUP_ALL_FORMS': 'forms-access@robinsonsolutions.com',
    'GROUP_HR': 'hr-team@robinsonsolutions.com',
    'GROUP_IT': 'it-team@robinsonsolutions.com',
    
    // Routing Emails
    'EMAIL_HR': 'dbinns@robinsonsolutions.com',
    'EMAIL_IT': 'dbinns@robinsonsolutions.com',
    'EMAIL_SITEDOCS': 'dbinns@robinsonsolutions.com',
    'EMAIL_NOTIFICATIONS': 'dbinns@robinsonsolutions.com'
  };

  /**
   * Retrieves the current configuration, merging constraints.
   * Priority: ScriptProperties > Defaults
   */
  function getAllSettings() {
    try {
      var props = PropertiesService.getScriptProperties().getProperties();
      var settings = {};
      
      // Merge defaults if key is missing
      for (var key in DEFAULTS) {
        settings[key] = props[key] || DEFAULTS[key];
      }
      
      return settings;
    } catch (e) {
      console.error("Failed to load settings: " + e.message);
      return DEFAULTS; // Fallback
    }
  }

  /**
   * Gets a single setting value.
   */
  function getSetting(key) {
    try {
      var val = PropertiesService.getScriptProperties().getProperty(key);
      return val || DEFAULTS[key];
    } catch (e) {
      return DEFAULTS[key];
    }
  }

  /**
   * Saves updated settings.
   * Access Control: Only Master Admins should call this.
   */
  function saveSettings(newSettings) {
    try {
      PropertiesService.getScriptProperties().setProperties(newSettings);
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  return {
    getAllSettings: getAllSettings,
    getSetting: getSetting,
    saveSettings: saveSettings
  };

})();
