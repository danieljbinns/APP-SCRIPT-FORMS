/**
 * Workflow Management Functions
 * Creates and manages workflow instances across forms
 */

/**
 * Generate unique workflow ID
 */
function generateWorkflowId(workflowType) {
  const timestamp = Utilities.formatDate(new Date(), 'America/New_York', 'yyyyMMdd-HHmmss');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return workflowType + '_' + timestamp + '_' + random;
}

/**
 * Generate unique form ID
 */
function generateFormId(formType) {
  const timestamp = Utilities.formatDate(new Date(), 'America/New_York', 'yyyyMMdd-HHmmss');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return formType + '_' + timestamp + '_' + random;
}

/**
 * Create new workflow record in master Workflows sheet
 */
function createWorkflow(workflowType, workflowName, initiatorEmail) {
  try {
    const workflowId = generateWorkflowId(workflowType);
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let workflowsSheet = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
    
    if (!workflowsSheet) {
      workflowsSheet = ss.insertSheet(CONFIG.SHEETS.WORKFLOWS);
      workflowsSheet.appendRow([
        'Workflow ID',
        'Workflow Type',
        'Workflow Name',
        'Initiator Email',
        'Status',
        'Created Date',
        'Last Updated',
        'Current Step',
        'Employee Name'
      ]);
      workflowsSheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#EB1C2D').setFontColor('#ffffff');
    }
    
    workflowsSheet.appendRow([
      workflowId,
      workflowType,
      workflowName,
      initiatorEmail,
      'In Progress',
      new Date(),
      new Date(),
      'Initial Request',
      ''
    ]);
    
    Logger.log('[SUCCESS] Created workflow: ' + workflowId);
    return workflowId;
    
  } catch (error) {
    Logger.log('[ERROR] Failed to create workflow: ' + error.toString());
    throw error;
  }
}

/**
 * Update workflow status and current step
 */
function updateWorkflow(workflowId, status, currentStep, employeeName) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const workflowsSheet = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
    
    if (!workflowsSheet) return false;
    
    const data = workflowsSheet.getDataRange().getValues();
    const headers = data[0];
    
    const statusCol = headers.indexOf('Status');
    const lastUpdatedCol = headers.indexOf('Last Updated');
    const currentStepCol = headers.indexOf('Current Step');
    const employeeNameCol = headers.indexOf('Employee Name');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === workflowId) {
        if (statusCol !== -1) workflowsSheet.getRange(i + 1, statusCol + 1).setValue(status);
        if (lastUpdatedCol !== -1) workflowsSheet.getRange(i + 1, lastUpdatedCol + 1).setValue(new Date());
        if (currentStepCol !== -1 && currentStep) workflowsSheet.getRange(i + 1, currentStepCol + 1).setValue(currentStep);
        if (employeeNameCol !== -1 && employeeName) workflowsSheet.getRange(i + 1, employeeNameCol + 1).setValue(employeeName);
        
        Logger.log('[SUCCESS] Updated workflow: ' + workflowId + ' -> ' + status);
    // Sync to Initial Requests sheet as well (if found)
    syncStatusToRequestSheet(ss, workflowId, status);
    
    return true;
      }
    }
    
    Logger.log('[WARNING] Workflow not found: ' + workflowId);
    return false;
    
  } catch (error) {
    Logger.log('[ERROR] Failed to update workflow: ' + error.toString());
    return false;
  }
}

/**
 * Helper to sync status back to Initial Requests sheet
 */
function syncStatusToRequestSheet(ss, workflowId, status) {
  try {
    const sheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
    if (!sheet) return;
    
    // Check headers for 'Status' column
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    let statusColIndex = headers.indexOf('Status');
    
    // If not found, try 'Current Status'
    if (statusColIndex === -1) statusColIndex = headers.indexOf('Current Status');
    
    // If still not found, we generally shouldn't just append randomly, 
    // but the user expects it. Let's assume if it's missing we can't update it safely without risking overwriting data.
    // However, if we want to be helpful, we could log it.
    if (statusColIndex === -1) {
       Logger.log('No Status column found in Initial Requests sheet');
       return;
    }
    
    // Find row
    const data = sheet.getDataRange().getValues();
    // Assuming ID is Col A (0)
    for (let i = 1; i < data.length; i++) {
        if (data[i][0] === workflowId) {
            sheet.getRange(i + 1, statusColIndex + 1).setValue(status);
            Logger.log('Synced status to Initial Requests sheet');
            break;
        }
    }
  } catch (e) {
    Logger.log('Error syncing status to requests: ' + e.toString());
  }
}

/**
 * Get workflow details by ID
 */
function getWorkflow(workflowId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const workflowsSheet = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
    
    if (!workflowsSheet) return null;
    
    const data = workflowsSheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === workflowId) {
        const workflow = {};
        headers.forEach((header, index) => {
          workflow[header] = data[i][index];
        });
        return workflow;
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log('[ERROR] Failed to get workflow: ' + error.toString());
    return null;
  }
}
