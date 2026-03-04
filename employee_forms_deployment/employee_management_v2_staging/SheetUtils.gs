/**
 * Employee Management Forms - Sheet Utilities Library
 * Shared spreadsheet operation functions
 */

/**
 * Generate unique request ID
 * @param {string} prefix - Request type prefix (e.g., 'NEW_EMP', 'CHANGE', 'FLEETIO')
 * @returns {string} Unique request ID
 */
function generateRequestId(prefix) {
  const timestamp = Utilities.formatDate(new Date(), 'America/New_York', 'yyyyMMdd-HHmmss');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Add row to spreadsheet
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {string} sheetName - Sheet name
 * @param {Array} values - Row values
 * @returns {boolean} Success status
 */
function addSheetRow(spreadsheetId, sheetName, values) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      Logger.log('❌ Sheet not found: ' + sheetName);
      return false;
    }
    
    sheet.appendRow(values);
    Logger.log('✓ Row added to: ' + sheetName);
    return true;
    
  } catch (error) {
    Logger.log('❌ Error adding row: ' + error.toString());
    return false;
  }
}

/**
 * Setup sheet headers
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {string} sheetName - Sheet name
 * @param {Array<string>} headers - Column headers
 * @param {string} [headerColor] - Header background color (default: #EB1C2D)
 * @returns {boolean} Success status
 */
function setupSheetHeaders(spreadsheetId, sheetName, headers, headerColor) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    let sheet = ss.getSheetByName(sheetName);
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      Logger.log('✓ Created new sheet: ' + sheetName);
    }
    
    // Add headers
    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground(headerColor || '#EB1C2D')
      .setFontColor('#ffffff');
    
    // Freeze header row
    sheet.setFrozenRows(1);
    
    // Auto-resize columns
    for (let i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }
    
    Logger.log('✓ Headers setup complete: ' + headers.length + ' columns');
    return true;
    
  } catch (error) {
    Logger.log('❌ Error setting up headers: ' + error.toString());
    return false;
  }
}

/**
 * Get row data by request ID
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {string} sheetName - Sheet name
 * @param {string} requestId - Request ID to find
 * @param {number} [requestIdColumn] - Column number for Request ID (default: 1)
 * @returns {Array|null} Row data or null if not found
 */
function getRowByRequestId(spreadsheetId, sheetName, requestId, requestIdColumn) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    const idCol = requestIdColumn || 1;
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) { // Skip header row
      if (data[i][idCol - 1] === requestId) {
        return data[i];
      }
    }
    
    Logger.log('Request ID not found: ' + requestId);
    return null;
    
  } catch (error) {
    Logger.log('❌ Error getting row: ' + error.toString());
    return null;
  }
}

/**
 * Update workflow status
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {string} sheetName - Sheet name
 * @param {string} requestId - Request ID
 * @param {string} status - New status
 * @param {number} [statusColumn] - Status column number (default: last column)
 * @returns {boolean} Success status
 */
function updateWorkflowStatus(spreadsheetId, sheetName, requestId, status, statusColumn) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === requestId) { // Request ID in column 1
        const col = statusColumn || sheet.getLastColumn();
        sheet.getRange(i + 1, col).setValue(status);
        Logger.log('✓ Status updated: ' + requestId + ' → ' + status);
        return true;
      }
    }
    
    Logger.log('Request ID not found for status update: ' + requestId);
    return false;
    
  } catch (error) {
    Logger.log('❌ Error updating status: ' + error.toString());
    return false;
  }
}
