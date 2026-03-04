/**
 * Reference Data Service
 * Provides lookup data from single Data_Lookup sheet (column-based)
 * and Google Directory API for managers
 */

/**
 * Helper: Read column from Data_Lookup sheet
 * @param {string} columnName - Name of the column header
 * @returns {Array<string>} Array of values (excluding empty rows)
 */
function getDataLookupColumn(columnName) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Data_Lookup');
    
    if (!sheet) {
      Logger.log('Data_Lookup sheet not found');
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const columnIndex = headers.indexOf(columnName);
    
    if (columnIndex === -1) {
      Logger.log('Column not found: ' + columnName);
      return [];
    }
    
    // Get all values from this column, skip header, filter empty
    return data.slice(1)
      .map(row => row[columnIndex])
      .filter(val => val && val.toString().trim() !== '');
      
  } catch (error) {
    Logger.log('Error reading Data_Lookup column ' + columnName + ': ' + error.toString());
    return [];
  }
}

/**
 * Get list of sites for dropdown
 * PHASE 4.1 UPDATE: Use Column A (Index 0) per user request
 * @returns {Array<string>} Array of site names
 */
function getSitesList() {
  // return getDataLookupColumn('Sites');
  return getDataLookupByIndex(0); // Column A
}

/**
 * Get list of job codes for dropdown
 * @returns {Array<string>} Array of job codes
 */
function getJobCodesList() {
  return getDataLookupColumn('Job Codes');
}

/**
 * Get list of JRs (Job Roles) for dropdown
 * @returns {Array<string>} Array of JR names (e.g., "Project Manager", "Site Supervisor")
 */
function getJRsList() {
  return getDataLookupColumn('JRs');
}

/**
 * Get list of job numbers for dropdown
 * Used for both Jonas and Boss systems
 * PHASE 4 UPDATE: Use Column E (Index 4) per user request
 * @returns {Array<string>} Array of job numbers
 */
/**
 * Get list of job numbers for basic Job Site Number field (Initial Request)
 * PHASE 4.1 UPDATE: Use Column D (Index 3) per user request "Job Site Number on initial... should be column D"
 * @returns {Array<string>} Array of job numbers
 */
function getJobNumbersList() {
  return getDataLookupByIndex(3); // Column D
}

/**
 * Get list of Committees (formerly Job Sites) for BOSS
 * PHASE 4.1 UPDATE: Use Column F (Index 5) per user request "Committee(s) data validation should be column F"
 * @returns {Array<string>} Array of committee names
 */
function getBossJobSitesList() {
  return getDataLookupByIndex(5); // Column F
}

/**
 * Get list of Boss cost sheets - specific validation rule
 * PHASE 4.1 UPDATE: Use Column E (Index 4) per user request "Cost Sheet... should look at column E"
 * @returns {Array<string>} Array of job numbers
 */
function getBossCostSheetsList() {
  return getDataLookupByIndex(4); // Column E
}


/**
 * Get list of managers from Google Directory API
 * @returns {Array<Object>} Array of {name, email} objects
 */
function getManagersList() {
  try {
    const allUsers = [];
    let pageToken = null;
    
    do {
      const options = {
        customer: 'my_customer',
        maxResults: 500,
        orderBy: 'email'
      };
      
      if (pageToken) {
        options.pageToken = pageToken;
      }
      
      const response = AdminDirectory.Users.list(options);
      
      if (response.users) {
        allUsers.push(...response.users);
      }
      
      pageToken = response.nextPageToken;
      
    } while (pageToken);
    
    // Filter to primary users (not suspended, from allowed domains)
    const managers = allUsers
      .filter(user => !user.suspended)
      .filter(user => {
        const email = user.primaryEmail;
        return CONFIG.ALLOWED_DOMAINS.some(domain => email.endsWith('@' + domain));
      })
      .map(user => ({
        name: user.name.fullName,
        email: user.primaryEmail,
        firstName: user.name.givenName,
        lastName: user.name.familyName
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    Logger.log('Fetched ' + managers.length + ' managers from Google Directory');
    return managers;
    
  } catch (error) {
    Logger.log('Error fetching managers from Directory: ' + error.toString());
    return [];
  }
}

/**
 * Get list of requesters (HR/Admin users)
 * Now uses same Directory API logic as managers to allow full search
 * @returns {Array<Object>} Array of {name, email} objects
 */
function getRequestersList() {
  // Use same logic as managers to allow searching full directory
  return getManagersList();
}

/**
 * Get all reference data for the manager UI
 */
function getAllReferenceData() {
  return {
    sites: getSitesList(),
    jrs: getJRsList(),
    jobCodes: getJobCodesList(),
    jobNumbers: getJobNumbersList()
  };
}

/**
 * Add a new item to a reference list
 * @param {string} type - 'site', 'job_code', 'jr', 'job_number'
 * @param {string} value - The value to add
 * @returns {boolean} Success
 */
function addReferenceItem(type, value) {
  if (!value || value.toString().trim() === '') return false;
  
  const colName = getColumnNameFromType(type);
  if (!colName) return false;
  
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Data_Lookup');
    if (!sheet) return false;
    
    // Find column index
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const colIndex = headers.indexOf(colName);
    if (colIndex === -1) return false;
    
    // Find first empty cell in this column
    // Read the whole column to find the first empty spot or append
    // Note: getValues() might return empty strings for empty cells within the data range
    const lastRow = sheet.getLastRow();
    const range = sheet.getRange(2, colIndex + 1, lastRow > 1 ? lastRow - 1 : 1, 1);
    const colValues = range.getValues().flat();
    
    // Check if duplicate
    if (colValues.includes(value)) return true; // Already exists
    
    // Find first empty slot
    let insertRow = -1;
    for (let i = 0; i < colValues.length; i++) {
      if (colValues[i] === '') {
        insertRow = i + 2; // +2 because 1-indexed and header is row 1
        break;
      }
    }
    
    if (insertRow === -1) {
      // Append to end of the sheet's data (or at least where this column ends)
      // Since we read up to lastRow, if we didn't find a gap, we append at lastRow + 1
      insertRow = lastRow + 1;
    }
    
    sheet.getRange(insertRow, colIndex + 1).setValue(value);
    return true;
    
  } catch (e) {
    Logger.log('Error adding reference item: ' + e.toString());
    return false;
  }
}

/**
 * Remove an item from a reference list
 * @param {string} type - 'site', 'job_code', 'jr', 'job_number'
 * @param {string} value - The value to remove
 * @returns {boolean} Success
 */
function removeReferenceItem(type, value) {
  if (!value) return false;
  
  const colName = getColumnNameFromType(type);
  if (!colName) return false;
  
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Data_Lookup');
    if (!sheet) return false;
    
    // Find column index
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const colIndex = headers.indexOf(colName);
    if (colIndex === -1) return false;
    
    // Find values
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return false;
    
    const colValues = sheet.getRange(2, colIndex + 1, lastRow - 1, 1).getValues().flat();
    const rowInList = colValues.indexOf(value);
    
    if (rowInList !== -1) {
      const rowToDelete = rowInList + 2;
      // Delete cell and shift up
      sheet.getRange(rowToDelete, colIndex + 1).deleteCells(SpreadsheetApp.Dimension.ROWS);
      return true;
    }
    
    return false; // Not found
    
  } catch (e) {
    Logger.log('Error removing reference item: ' + e.toString());
    return false;
  }
}

/**
 * Helper to map type to column header
 */
function getColumnNameFromType(type) {
  switch(type) {
    case 'site': return 'Sites';
    case 'job_code': return 'Job Codes';
    case 'jr': return 'JRs';
    case 'job_number': return 'Job Numbers';
    default: return null;
  }
}

/**
 * Helper: Read column by index from Data_Lookup sheet
 * @param {number} colIndex - 0-based column index (e.g. 4 for Column E)
 * @returns {Array<string>} Array of values
 */
function getDataLookupByIndex(colIndex) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Data_Lookup'); 
    
    if (!sheet) return [];
    
    // Get all data
    const data = sheet.getDataRange().getValues();
    
    // Skip header (row 0), map to column value, filter empty
    return data.slice(1)
      .map(row => row[colIndex])
      .filter(val => val && val.toString().trim() !== '');
      
  } catch (error) {
    Logger.log('Error reading Data_Lookup column index ' + colIndex + ': ' + error.toString());
    return [];
  }
}
