/**
 * Setup script to create Google Drive folder structure
 * Run this once to create folders for organizing workflow files
 */

function setupDriveFolders() {
  // Create main folder
  const mainFolder = DriveApp.createFolder('WMAR - Workflow System');
  const mainFolderId = mainFolder.getId();
  
  Logger.log('Created main folder: ' + mainFolderId);
  Logger.log('URL: ' + mainFolder.getUrl());
  
  // Create subfolders
  const subfolders = {
    'PDFs': 'Stores all generated PDF documents',
    'Requests': 'Individual request folders (auto-created)',
    'Reports': 'System reports and analytics',
    'Templates': 'Email and document templates',
    'Archives': 'Completed/archived requests'
  };
  
  const folderIds = {
    main: mainFolderId,
    mainUrl: mainFolder.getUrl()
  };
  
  for (const [folderName, description] of Object.entries(subfolders)) {
    const subfolder = mainFolder.createFolder(folderName);
    subfolder.setDescription(description);
    folderIds[folderName.toLowerCase().replace(/\s+/g, '_')] = subfolder.getId();
    Logger.log(`Created subfolder: ${folderName} - ${subfolder.getId()}`);
  }
  
  // Move the spreadsheet into the main folder
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const ssFile = DriveApp.getFileById(CONFIG.SPREADSHEET_ID);
  ssFile.moveTo(mainFolder);
  Logger.log('Moved spreadsheet to main folder');
  
  // Create additional subfolders in PDFs folder for organization
  const pdfsFolder = DriveApp.getFolderById(folderIds.pdfs);
  const pdfSubfolders = [
    'Initial Submissions',
    'HR Setup',
    'IT Setup',
    'Final Approvals',
    'Parallel Tasks'
  ];
  
  pdfSubfolders.forEach(name => {
    const subfolder = pdfsFolder.createFolder(name);
    const key = name.toLowerCase().replace(/\s+/g, '_');
    folderIds[`pdf_${key}`] = subfolder.getId();
    Logger.log(`Created PDF subfolder: ${name} - ${subfolder.getId()}`);
  });
  
  Logger.log('Setup complete!');
  Logger.log('Copy these IDs to Config.gs:');
  Logger.log(JSON.stringify(folderIds, null, 2));
  
  return folderIds;
}
