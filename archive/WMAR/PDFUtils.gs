/**
 * =============================================================================
 * PDF UTILITIES - PDF Generation and Storage Functions
 * =============================================================================
 * 
 * This file contains utilities for generating and storing PDFs in Google Drive.
 */

class PDFUtils {
  
  /**
   * Save a PDF blob to Google Drive
   * @param {Blob} pdfBlob - The PDF file as a blob
   * @param {string} fileName - Name for the PDF file
   * @param {string} folderType - Type of folder (initial_submissions, hr_setup, it_setup, final_approvals, parallel_tasks)
   * @param {string} requestId - Request ID for organizing files
   * @returns {File} The created Drive file
   */
  static savePdfToDrive(pdfBlob, fileName, folderType, requestId = null) {
    try {
      // Get the appropriate folder ID from config
      const folderKey = `pdf_${folderType}`;
      const folderId = CONFIG.DRIVE_FOLDERS[folderKey];
      
      if (!folderId) {
        Logger.log(`Warning: No folder ID configured for ${folderKey}. PDF not saved to Drive.`);
        return null;
      }
      
      const folder = DriveApp.getFolderById(folderId);
      
      // Create or get request subfolder if requestId provided
      let targetFolder = folder;
      if (requestId) {
        const requestFolderName = `Request_${requestId}`;
        const existingFolders = folder.getFoldersByName(requestFolderName);
        
        if (existingFolders.hasNext()) {
          targetFolder = existingFolders.next();
        } else {
          targetFolder = folder.createFolder(requestFolderName);
        }
      }
      
      // Save the PDF
      const file = targetFolder.createFile(pdfBlob);
      file.setName(fileName);
      
      Logger.log(`PDF saved to Drive: ${fileName} in folder ${folderType}`);
      Logger.log(`File URL: ${file.getUrl()}`);
      
      return file;
      
    } catch (e) {
      Logger.log(`Error saving PDF to Drive: ${e.message}`);
      return null;
    }
  }
  
  /**
   * Get or create a request-specific folder
   * @param {string} requestId - Request ID
   * @returns {Folder} The request folder
   */
  static getRequestFolder(requestId) {
    const requestsFolderId = CONFIG.DRIVE_FOLDERS.requests;
    if (!requestsFolderId) {
      throw new Error('Requests folder ID not configured');
    }
    
    const requestsFolder = DriveApp.getFolderById(requestsFolderId);
    const folderName = `Request_${requestId}`;
    
    // Check if folder exists
    const existingFolders = requestsFolder.getFoldersByName(folderName);
    if (existingFolders.hasNext()) {
      return existingFolders.next();
    }
    
    // Create new folder
    const newFolder = requestsFolder.createFolder(folderName);
    Logger.log(`Created request folder: ${folderName}`);
    return newFolder;
  }
  
  /**
   * Archive a request by moving its folder to archives
   * @param {string} requestId - Request ID to archive
   */
  static archiveRequest(requestId) {
    try {
      const requestFolder = this.getRequestFolder(requestId);
      const archivesFolder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDERS.archives);
      
      requestFolder.moveTo(archivesFolder);
      Logger.log(`Archived request ${requestId}`);
      
    } catch (e) {
      Logger.log(`Error archiving request ${requestId}: ${e.message}`);
    }
  }
}
