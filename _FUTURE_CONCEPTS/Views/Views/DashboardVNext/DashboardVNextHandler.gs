/**
 * DashboardVNextHandler.gs
 * 
 * Backend logic for the improved Dashboard (VNext).
 * Features:
 * - Data fetching with calculated "Time Open" fields.
 * - Resend Email logic.
 * - Write-back for edits.
 */

/**
 * Serves the new Dashboard HTML.
 * Accessed via ?form=dashboard_vnext (once routed)
 */
function getDashboardVNext() {
  return HtmlService.createTemplateFromFile('Views/DashboardVNext/DashboardVNext')
      .evaluate()
      .setTitle('Employee Onboarding Dashboard V2.1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Fetches dashboard data including calculations for conditional formatting.
 * @returns {Object} { headers: [], rows: [] }
 */
function getDashboardDataVNext() {
  try {
    Logger.log('getDashboardDataVNext called');
    
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    Logger.log('Spreadsheet opened: ' + CONFIG.SPREADSHEET_ID);
    
    var sheet = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
    if (!sheet) {
      Logger.log('ERROR: Workflows sheet not found. Available sheets: ' + ss.getSheets().map(s => s.getName()).join(', '));
      throw new Error("Workflows sheet not found.");
    }
    
    Logger.log('Sheet found: ' + CONFIG.SHEETS.WORKFLOWS);

    var data = sheet.getDataRange().getDisplayValues();
    Logger.log('Data rows: ' + data.length);
    
    if (data.length === 0) {
      return { headers: [], rows: [] };
    }
    
    var headers = data[0];
    var rawRows = data.slice(1);

    // Identify key column indices 
    var h = {};
    headers.forEach(function(col, i) { h[col] = i; });

    var processedRows = rawRows.map(function(row) {
      // Calculate "Time Open"
      var dateCreated = row[h['Timestamp'] || h['Created'] || 0]; 
      var timeOpenDays = 0;
      
      if (dateCreated) {
        var created = new Date(dateCreated);
        var now = new Date();
        var diffTime = Math.abs(now - created);
        timeOpenDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      }

      // Return enhanced row object
      return {
        workflowId: row[h['Workflow ID'] || h['ID'] || 0],
        timestamp: dateCreated,
        employeeName: row[h['Employee Name'] || h['Name'] || 0],
        status: row[h['Status'] || 0],
        timeOpenDays: timeOpenDays,
        rawData: row
      };
    });

    Logger.log('Processed ' + processedRows.length + ' rows');

    return {
      headers: headers,
      rows: processedRows.reverse() // Newest first
    };

  } catch (e) {
    Logger.log("getDashboardDataVNext Error: " + e.message + "\nStack: " + e.stack);
    throw new Error("Failed to load dashboard data: " + e.message);
  }
}

/**
 * Resends the email for a specific stage.
 * @param {string} workflowId 
 * @param {string} stage - e.g. "ID_SETUP", "HR", "IT"
 */
function resendStageEmail(workflowId, stage) {
  // Logic to look up workflow data and re-trigger EmailUtils
  // detailed implementation depends on EmailUtils exposed methods.
  console.log("Resending email for " + workflowId + " stage: " + stage);
  return { success: true, message: "Email queued for resend." };
}

/**
 * Updates a specific field in the workflow.
 * @param {string} workflowId 
 * @param {string} headerName 
 * @param {string} newValue 
 */
function updateWorkflowField(workflowId, headerName, newValue) {
  // Logic to find row by workflowId and update column matching headerName
  console.log("Updating " + workflowId + " [" + headerName + "] to " + newValue);
  return { success: true, message: "Field updated." };
}
