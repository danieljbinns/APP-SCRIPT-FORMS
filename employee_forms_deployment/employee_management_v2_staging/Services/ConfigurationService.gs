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
    'GROUP_MASTER_ADMIN': 'grp.forms.it@team-group.com',
    'GROUP_ALL_FORMS': 'grp.forms.it@team-group.com',
    'GROUP_HR': 'grp.forms.hr@team-group.com',
    'GROUP_IT': 'grp.forms.it@team-group.com',
    
    // Routing Emails
    'EMAIL_HR': 'grp.forms.hr@team-group.com',
    'EMAIL_IT': 'grp.forms.it@team-group.com',
    'EMAIL_IDSETUP': 'grp.forms.idsetup@team-group.com',
    'EMAIL_SAFETY': 'grp.forms.safety@team-group.com',
    'EMAIL_NOTIFICATIONS': 'grp.forms.it@team-group.com',
    'EMAIL_REDIRECT_ALL': '', // Set this to an email in Script Properties to redirect ALL outbound mail
    
    // Resource IDs (Override in Script Properties for Staging/Test)
    'SPREADSHEET_ID': '1kGjw8e-uIehaBemlsRZ4Yq1QrYOWkJvWzhKbgfl4Pxo',
    'MAIN_FOLDER_ID': '1vBZVuzXmSatnLGiqhU7QoS0zBK2NGDQE',
    'SHARED_DRIVE_ID': '0AOOOWlqzpUNVUk9PVA',
    'DEPLOYMENT_URL': 'https://script.google.com/a/macros/robinsonsolutions.com/s/AKfycbzBuUzj2DOW9ZcRPsfSoE9zVO-eMVWGj8dCaEW1i-X2rcdMBcWWBrHLoX5dn0Zf05Sm3w/exec'
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
