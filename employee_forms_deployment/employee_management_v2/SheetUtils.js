/**
 * Employee Management Forms - Sheet Utilities Library
 * Shared spreadsheet operation functions
 */

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
    
    for (let i = SCHEMA.ROW.FIRST_DATA; i < data.length; i++) {
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

