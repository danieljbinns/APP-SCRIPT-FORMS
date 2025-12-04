/**
 * =============================================================================
 * SHEET ACCESS - Database Layer for Workflows and Tasks
 * =============================================================================
 * 
 * This file contains all sheet operations for the workflow engine.
 * It provides a clean abstraction over Google Sheets as a database.
 */

/**
 * SheetAccess - Database operations for workflows and tasks
 */
class SheetAccess {
  
  // ==========================================================================
  // WORKFLOW OPERATIONS
  // ==========================================================================
  
  /**
   * Get workflows sheet
   * @returns {Sheet} Workflows sheet
   */
  static getWorkflowsSheet() {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName('Workflows');
    
    if (!sheet) {
      // Create sheet if it doesn't exist
      sheet = ss.insertSheet('Workflows');
      sheet.appendRow([
        'Workflow ID',
        'Workflow Type',
        'Status',
        'Initiated By',
        'Initiated At',
        'Completed At',
        'Metadata'
      ]);
    }
    
    return sheet;
  }
  
  /**
   * Append workflow record
   * @param {Object} record - Workflow record
   */
  static appendToWorkflowsSheet(record) {
    const sheet = this.getWorkflowsSheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = headers.map(header => record[header] || '');
    sheet.appendRow(row);
  }
  
  /**
   * Get workflow by ID
   * @param {string} workflowId - Workflow ID
   * @returns {Object|null} Workflow record
   */
  static getWorkflowById(workflowId) {
    const sheet = this.getWorkflowsSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === workflowId) {
        const record = {};
        headers.forEach((header, index) => {
          record[header] = data[i][index];
        });
        return record;
      }
    }
    
    return null;
  }
  
  /**
   * Update workflow status
   * @param {string} workflowId - Workflow ID
   * @param {string} status - New status
   */
  static updateWorkflowStatus(workflowId, status) {
    const sheet = this.getWorkflowsSheet();
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === workflowId) {
        sheet.getRange(i + 1, 3).setValue(status);
        if (status === 'Complete') {
          sheet.getRange(i + 1, 6).setValue(new Date()); // Completed At
        }
        break;
      }
    }
  }
  
  /**
   * Update workflow metadata
   * @param {string} workflowId - Workflow ID
   * @param {Object} metadata - Metadata object
   */
  static updateWorkflowMetadata(workflowId, metadata) {
    const sheet = this.getWorkflowsSheet();
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === workflowId) {
        sheet.getRange(i + 1, 7).setValue(JSON.stringify(metadata));
        break;
      }
    }
  }
  
  // ==========================================================================
  // TASK OPERATIONS
  // ==========================================================================
  
  /**
   * Get tasks sheet
   * @returns {Sheet} Tasks sheet
   */
  static getTasksSheet() {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName('Tasks');
    
    if (!sheet) {
      // Create sheet if it doesn't exist
      sheet = ss.insertSheet('Tasks');
      sheet.appendRow([
        'Task ID',
        'Workflow ID',
        'Task Type',
        'Status',
        'Assigned To',
        'Started At',
        'Completed At',
        'Data',
        'Metadata',
        'External Ticket ID',      // For future ticketing integration
        'External System',         // e.g., 'jira', 'servicenow', 'zendesk'
        'Last Synced At'          // Track last sync with external system
      ]);
    }
    
    return sheet;
  }
  
  /**
   * Append task record
   * @param {Object} record - Task record
   */
  static appendToTasksSheet(record) {
    const sheet = this.getTasksSheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = headers.map(header => record[header] || '');
    sheet.appendRow(row);
  }
  
  /**
   * Get task by ID
   * @param {string} taskId - Task ID
   * @returns {Object|null} Task record
   */
  static getTaskById(taskId) {
    const sheet = this.getTasksSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === taskId) {
        const record = {};
        headers.forEach((header, index) => {
          record[header] = data[i][index];
        });
        return record;
      }
    }
    
    return null;
  }
  
  /**
   * Get tasks by workflow ID
   * @param {string} workflowId - Workflow ID
   * @returns {Array} Array of task records
   */
  static getTasksByWorkflowId(workflowId) {
    const sheet = this.getTasksSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const tasks = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === workflowId) {
        const record = {};
        headers.forEach((header, index) => {
          record[header] = data[i][index];
        });
        tasks.push(record);
      }
    }
    
    return tasks;
  }
  
  /**
   * Update task status
   * @param {string} taskId - Task ID
   * @param {string} status - New status
   * @param {Object} data - Optional completion data
   */
  static updateTaskStatus(taskId, status, data) {
    const sheet = this.getTasksSheet();
    const sheetData = sheet.getDataRange().getValues();
    
    for (let i = 1; i < sheetData.length; i++) {
      if (sheetData[i][0] === taskId) {
        sheet.getRange(i + 1, 4).setValue(status);
        if (status === 'Complete') {
          sheet.getRange(i + 1, 7).setValue(new Date()); // Completed At
        }
        if (data) {
          sheet.getRange(i + 1, 8).setValue(JSON.stringify(data)); // Data
        }
        break;
      }
    }
  }
  
  /**
   * Update task field
   * @param {string} taskId - Task ID
   * @param {string} fieldName - Field name
   * @param {*} value - New value
   */
  static updateTaskField(taskId, fieldName, value) {
    const sheet = this.getTasksSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const colIndex = headers.indexOf(fieldName);
    
    if (colIndex === -1) {
      throw new Error(`Field not found: ${fieldName}`);
    }
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === taskId) {
        sheet.getRange(i + 1, colIndex + 1).setValue(value);
        break;
      }
    }
  }
  
  // ==========================================================================
  // LEGACY COMPATIBILITY (for existing Master Sheet)
  // ==========================================================================
  
  /**
   * Get master sheet (for backward compatibility)
   * @returns {Sheet} Master sheet
   */
  static getMasterSheet() {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    return ss.getSheetByName(CONFIG.MASTER_SHEET_NAME);
  }
  
  /**
   * Append to master sheet
   * @param {Object} data - Data object
   */
  static appendToMasterSheet(data) {
    const sheet = this.getMasterSheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = headers.map(header => data[header] || '');
    sheet.appendRow(row);
  }
  
  /**
   * Update master sheet data
   * @param {string} requestId - Request ID
   * @param {Object} updateData - Data to update
   */
  static updateMasterSheetData(requestId, updateData) {
    const sheet = this.getMasterSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const requestIdIndex = headers.indexOf('Request ID');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][requestIdIndex] === requestId) {
        for (const key in updateData) {
          const colIndex = headers.indexOf(key);
          if (colIndex !== -1) {
            sheet.getRange(i + 1, colIndex + 1).setValue(updateData[key]);
          }
        }
        break;
      }
    }
  }
}
