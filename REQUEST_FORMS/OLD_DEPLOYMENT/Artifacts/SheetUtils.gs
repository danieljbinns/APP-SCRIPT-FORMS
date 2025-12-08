/**
 * Sheet Utilities - Standalone Module
 */

function appendRow(spreadsheetId, sheetName, rowData) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error(`Sheet not found: ${sheetName}`);
    sheet.appendRow(rowData);
    return true;
  } catch (error) {
    Logger.log(`Error appending row: ${error.message}`);
    return false;
  }
}

function getSheetData(spreadsheetId, sheetName) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    if (data.length === 0) return [];
    const headers = data[0];
    return data.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => { obj[header] = row[index]; });
      return obj;
    });
  } catch (error) {
    Logger.log(`Error getting sheet data: ${error.message}`);
    return [];
  }
}

function findRowByValue(spreadsheetId, sheetName, columnName, value) {
  const data = getSheetData(spreadsheetId, sheetName);
  return data.find(row => row[columnName] === value) || null;
}

function updateRowByValue(spreadsheetId, sheetName, searchColumn, searchValue, updates) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return false;
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const searchColIndex = headers.indexOf(searchColumn);
    if (searchColIndex === -1) return false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][searchColIndex] === searchValue) {
        Object.keys(updates).forEach(column => {
          const colIndex = headers.indexOf(column);
          if (colIndex !== -1) {
            sheet.getRange(i + 1, colIndex + 1).setValue(updates[column]);
          }
        });
        return true;
      }
    }
    return false;
  } catch (error) {
    Logger.log(`Error updating row: ${error.message}`);
    return false;
  }
}

function createSheetIfNotExists(spreadsheetId, sheetName, headers) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      if (headers && headers.length > 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      }
    }
    return true;
  } catch (error) {
    Logger.log(`Error creating sheet: ${error.message}`);
    return false;
  }
}

function clearSheetData(spreadsheetId, sheetName) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return false;
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);
    return true;
  } catch (error) {
    Logger.log(`Error clearing sheet: ${error.message}`);
    return false;
  }
}

function generateUniqueId(prefix = 'ID') {
  const now = new Date();
  const datePart = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${datePart}-${randomPart}`;
}

function batchAppendRows(spreadsheetId, sheetName, rows) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return false;
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
    return true;
  } catch (error) {
    Logger.log(`Error batch appending: ${error.message}`);
    return false;
  }
}
