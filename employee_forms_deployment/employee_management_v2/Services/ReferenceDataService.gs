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
  return getDataLookupColumn('Sites');
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
 * @returns {Array<string>} Array of job numbers
 */
function getJobNumbersList() {
  return getDataLookupColumn('Job Numbers');
}

/**
 * Get list of Boss job sites - same as main sites list
 * @returns {Array<string>} Array of site names
 */
function getBossJobSitesList() {
  return getDataLookupColumn('Sites');
}

/**
 * Get list of Boss cost sheets - same as job numbers
 * @returns {Array<string>} Array of job numbers
 */
function getBossCostSheetsList() {
  return getDataLookupColumn('Job Numbers');
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
