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
 * @returns {Array<string>} Array of site names
 */
function getSitesList() {
  return getDataLookupByIndex(SCHEMA.DATA_LOOKUP.SITES);
}

/**
 * Get list of job codes for dropdown
 * @returns {Array<string>} Array of job codes
 */
function getJobCodesList() {
  return getDataLookupColumn(SCHEMA.DATA_LOOKUP_HEADERS.JOB_CODES);
}

/**
 * Get list of JRs (Job Roles) for dropdown
 * @returns {Array<string>} Array of JR names (e.g., "Project Manager", "Site Supervisor")
 */
function getJRsList() {
  return getDataLookupColumn(SCHEMA.DATA_LOOKUP_HEADERS.JRS);
}

/**
 * Get list of job numbers for basic Job Site Number field (Initial Request)
 * @returns {Array<string>} Array of job numbers
 */
function getJobNumbersList() {
  return getDataLookupByIndex(SCHEMA.DATA_LOOKUP.JOB_NUMBERS);
}

/**
 * Get list of Committees (formerly Job Sites) for BOSS
 * @returns {Array<string>} Array of committee names
 */
function getBossJobSitesList() {
  return getDataLookupByIndex(SCHEMA.DATA_LOOKUP.COMMITTEES);
}

/**
 * Get list of Boss cost sheets
 * @returns {Array<string>} Array of job numbers
 */
function getBossCostSheetsList() {
  return getDataLookupByIndex(SCHEMA.DATA_LOOKUP.BOSS_COST_SHEETS);
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
 * Unified data fetch for Termination and Position Change forms.
 * Reads Data_Lookup sheet ONCE and extracts all columns in a single pass.
 */
function getInitialFormData() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Data_Lookup');
    if (!sheet) return { sites: [], committees: [], jobs: [], jrs: [], jobNumbers: [] };

    const data = sheet.getDataRange().getValues();
    const headers = data[SCHEMA.ROW.HEADER];
    const rows = data.slice(SCHEMA.ROW.FIRST_DATA);
    const DL = SCHEMA.DATA_LOOKUP;
    const DLH = SCHEMA.DATA_LOOKUP_HEADERS;
    const jrsIdx = headers.indexOf(DLH.JRS);

    const extract = (colIdx) => rows
      .map(r => r[colIdx])
      .filter(v => v !== undefined && v !== null && String(v).trim() !== '');

    return {
      sites:       extract(DL.SITES),
      jobNumbers:  extract(DL.JOB_NUMBERS),
      jobs:        extract(DL.BOSS_COST_SHEETS),
      committees:  extract(DL.COMMITTEES),
      jrs:         jrsIdx >= 0 ? extract(jrsIdx) : []
    };
  } catch (e) {
    Logger.log('Error in getInitialFormData: ' + e.toString());
    return { sites: [], committees: [], jobs: [], jrs: [], jobNumbers: [] };
  }
}

/**
 * Legacy/Simple site fetch for Termination form
 */
function getSiteOptions() {
  return getSitesList();
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
