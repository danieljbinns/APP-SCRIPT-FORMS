/**
 * SheetUtils.gs - Standalone Google Sheets Utility
 * 
 * Copy/paste ready sheet functions for Google Apps Script.
 * No external dependencies - fully self-contained.
 * 
 * @version 1.0.0
 * @author Robinson Solutions
 */

/**
 * Append a row to a sheet
 * 
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {string} sheetName - Sheet name
 * @param {Array} rowData - Array of values to append
 * @returns {boolean} True if successful
 * 
 * @example
 * appendRow('abc123', 'Sheet1', ['John', 'Doe', 'john@example.com']);
 */
function appendRow(spreadsheetId, sheetName, rowData) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      Logger.log(`Sheet not found: ${sheetName}`);
      return false;
    }
    
    sheet.appendRow(rowData);
    Logger.log(`Row appended to ${sheetName}`);
    return true;
  } catch (error) {
    Logger.log(`Error appending row: ${error.message}`);
    return false;
  }
}

/**
 * Get all data from a sheet as array of objects
 * 
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {string} sheetName - Sheet name
 * @returns {Array<object>} Array of row objects with headers as keys
 * 
 * @example
 * const data = getSheetData('abc123', 'Sheet1');
 * // Returns: [{name: 'John', email: 'john@example.com'}, ...]
 */
function getSheetData(spreadsheetId, sheetName) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      Logger.log(`Sheet not found: ${sheetName}`);
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length === 0) return [];
    
    const headers = data[0];
    const rows = data.slice(1);
    
    return rows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });
  } catch (error) {
    Logger.log(`Error getting sheet data: ${error.message}`);
    return [];
  }
}

/**
 * Find a row by column value
 * 
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {string} sheetName - Sheet name
 * @param {string} columnName - Column header to search
 * @param {*} value - Value to find
 * @returns {object|null} Row object or null if not found
 * 
 * @example
 * const row = findRowByValue('abc123', 'Sheet1', 'Email', 'john@example.com');
 */
function findRowByValue(spreadsheetId, sheetName, columnName, value) {
  const data = getSheetData(spreadsheetId, sheetName);
  return data.find(row => row[columnName] === value) || null;
}

/**
 * Update a row by column value
 * 
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {string} sheetName - Sheet name
 * @param {string} searchColumn - Column to search
 * @param {*} searchValue - Value to find
 * @param {object} updates - Object with column: value pairs to update
 * @returns {boolean} True if updated
 * 
 * @example
 * updateRowByValue('abc123', 'Sheet1', 'Email', 'john@example.com', {
 *   Status: 'Completed',
 *   Notes: 'Updated via script'
 * });
 */
function updateRowByValue(spreadsheetId, sheetName, searchColumn, searchValue, updates) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      Logger.log(`Sheet not found: ${sheetName}`);
      return false;
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const searchColIndex = headers.indexOf(searchColumn);
    
    if (searchColIndex === -1) {
      Logger.log(`Column not found: ${searchColumn}`);
      return false;
    }
    
    // Find the row
    for (let i = 1; i < data.length; i++) {
      if (data[i][searchColIndex] === searchValue) {
        // Update each specified column
        Object.keys(updates).forEach(colName => {
          const colIndex = headers.indexOf(colName);
          if (colIndex !== -1) {
            sheet.getRange(i + 1, colIndex + 1).setValue(updates[colName]);
          }
        });
        
        Logger.log(`Updated row ${i + 1} in ${sheetName}`);
        return true;
      }
    }
    
    Logger.log(`Row not found with ${searchColumn} = ${searchValue}`);
    return false;
  } catch (error) {
    Logger.log(`Error updating row: ${error.message}`);
    return false;
  }
}

/**
 * Create a new sheet if it doesn't exist
 * 
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {string} sheetName - Sheet name to create
 * @param {Array<string>} [headers] - Optional header row
 * @returns {boolean} True if created or already exists
 * 
 * @example
 * createSheetIfNotExists('abc123', 'New Sheet', ['Name', 'Email', 'Status']);
 */
function createSheetIfNotExists(spreadsheetId, sheetName, headers = []) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      Logger.log(`Created new sheet: ${sheetName}`);
      
      if (headers.length > 0) {
        sheet.appendRow(headers);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
        Logger.log(`Added headers to ${sheetName}`);
      }
    }
    
    return true;
  } catch (error) {
    Logger.log(`Error creating sheet: ${error.message}`);
    return false;
  }
}

/**
 * Clear all data from a sheet (keeps headers)
 * 
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {string} sheetName - Sheet name
 * @returns {boolean} True if cleared
 * 
 * @example
 * clearSheetData('abc123', 'Sheet1');
 */
function clearSheetData(spreadsheetId, sheetName) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      Logger.log(`Sheet not found: ${sheetName}`);
      return false;
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
      Logger.log(`Cleared data from ${sheetName}`);
    }
    
    return true;
  } catch (error) {
    Logger.log(`Error clearing sheet: ${error.message}`);
    return false;
  }
}

/**
 * Generate unique ID for new rows
 * 
 * @param {string} [prefix='REQ'] - Prefix for ID
 * @returns {string} Unique ID
 * 
 * @example
 * const id = generateUniqueId('EMP'); // Returns: EMP-20250126-ABC123
 */
function generateUniqueId(prefix = 'REQ') {
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Batch append multiple rows (faster than multiple appendRow calls)
 * 
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {string} sheetName - Sheet name
 * @param {Array<Array>} rows - Array of row arrays
 * @returns {boolean} True if successful
 * 
 * @example
 * batchAppendRows('abc123', 'Sheet1', [
 *   ['John', 'Doe', 'john@example.com'],
 *   ['Jane', 'Smith', 'jane@example.com']
 * ]);
 */
function batchAppendRows(spreadsheetId, sheetName, rows) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      Logger.log(`Sheet not found: ${sheetName}`);
      return false;
    }
    
    const startRow = sheet.getLastRow() + 1;
    const numRows = rows.length;
    const numCols = rows[0].length;
    
    sheet.getRange(startRow, 1, numRows, numCols).setValues(rows);
    Logger.log(`Appended ${numRows} rows to ${sheetName}`);
    return true;
  } catch (error) {
    Logger.log(`Error batch appending rows: ${error.message}`);
    return false;
  }
}
