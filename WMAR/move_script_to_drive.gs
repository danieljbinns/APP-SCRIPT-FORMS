/**
 * Move the Apps Script project file to the WMAR Drive folder
 * Run this function once to organize the Apps Script project
 */

function moveAppsScriptToDrive() {
  try {
    // Get the script file ID
    const scriptId = ScriptApp.getScriptId();
    Logger.log('Script ID: ' + scriptId);
    
    // Get the script file from Drive
    const scriptFile = DriveApp.getFileById(scriptId);
    Logger.log('Current script name: ' + scriptFile.getName());
    Logger.log('Current location: ' + scriptFile.getParents().next().getName());
    
    // Get the WMAR main folder
    const mainFolderId = CONFIG.DRIVE_FOLDERS.main;
    if (!mainFolderId) {
      throw new Error('Main folder ID not configured in CONFIG.DRIVE_FOLDERS.main');
    }
    
    const mainFolder = DriveApp.getFolderById(mainFolderId);
    
    // Move the script file to the main folder
    scriptFile.moveTo(mainFolder);
    
    // Optionally rename it if needed
    scriptFile.setName('WMAR - Workflow Engine');
    
    Logger.log('Apps Script project moved successfully!');
    Logger.log('New location: ' + mainFolder.getName());
    Logger.log('Script URL: ' + scriptFile.getUrl());
    
    return {
      success: true,
      scriptId: scriptId,
      folderUrl: mainFolder.getUrl(),
      scriptUrl: scriptFile.getUrl()
    };
    
  } catch (e) {
    Logger.log('Error moving Apps Script: ' + e.message);
    return {
      success: false,
      error: e.message
    };
  }
}
