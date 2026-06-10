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

// ── Workflow data readers ─────────────────────────────────────────────────────
// These were moved from ITConfirmationHandler.js (2026-05-14) — cross-handler
// data-fetch utilities belong here, not in a form handler.

/**
 * Read all new-hire fields from Initial_Requests sheet for a given workflowId.
 * Called by: ITConfirmationHandler, EquipmentRequestHandler, ReplayService, StateSync.
 * @param {string} workflowId
 * @returns {Object|null}
 */
function getFullNewHireData(workflowId) {
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] !== workflowId) continue;
      const r = data[i];
      const fmtDate = function(d) {
        return d instanceof Date
          ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : (d ? String(d).substring(0, 10) : '');
      };
      const splitCSV = function(v) {
        return v ? String(v).split(', ').map(function(s) { return s.trim(); }).filter(Boolean) : [];
      };
      const IR = SCHEMA.INITIAL_REQUESTS;
      return {
        workflowId:               r[IR.WORKFLOW_ID],
        dateRequested:            fmtDate(r[IR.DATE_REQUESTED]),
        requesterName:            r[IR.REQUESTER_NAME]            || '',
        requesterEmail:           r[IR.REQUESTER_EMAIL]           || '',
        hireDate:                 fmtDate(r[IR.HIRE_DATE]),
        hireType:                 r[IR.NEW_HIRE_OR_REHIRE]        || '',
        employeeType:             r[IR.EMPLOYEE_TYPE]             || '',
        employmentType:           r[IR.EMPLOYMENT_TYPE]           || '',
        firstName:                r[IR.FIRST_NAME]                || '',
        middleName:               r[IR.MIDDLE_NAME]               || '',
        lastName:                 r[IR.LAST_NAME]                 || '',
        preferredName:            r[IR.PREFERRED_NAME]            || '',
        positionTitle:            r[IR.POSITION_TITLE]            || '',
        siteName:                 r[IR.SITE_NAME]                 || '',
        jobSiteNumber:            r[IR.JOB_SITE_NUMBER]           || '',
        managerEmail:             r[IR.MANAGER_EMAIL]             || '',
        managerName:              r[IR.MANAGER_NAME]              || '',
        systemAccess:             r[IR.SYSTEM_ACCESS]             || '',
        systems:                  splitCSV(r[IR.SYSTEMS]),
        equipment:                splitCSV(r[IR.EQUIPMENT]),
        googleEmail:              r[IR.GOOGLE_EMAIL]              || '',
        googleDomain:             r[IR.GOOGLE_DOMAIN]             || '',
        computerReq:              r[IR.COMPUTER_REQ]              || '',
        computerType:             r[IR.COMPUTER_TYPE]             || '',
        computerPrevUser:         r[IR.COMPUTER_PREV_USER]        || '',
        computerPrevType:         r[IR.COMPUTER_PREV_TYPE]        || '',
        computerSerial:           r[IR.COMPUTER_SERIAL]           || '',
        office365Required:        r[IR.OFFICE_365]                || '',
        creditCardUSA:            r[IR.CC_USA]                    || '',
        creditCardLimitUSA:       r[IR.CC_LIMIT_USA]              || '',
        creditCardCanada:         r[IR.CC_CAN]                    || '',
        creditCardLimitCanada:    r[IR.CC_LIMIT_CAN]              || '',
        creditCardHomeDepot:      r[IR.CC_HD]                     || '',
        creditCardLimitHomeDepot: r[IR.CC_LIMIT_HD]               || '',
        phoneReq:                 r[IR.PHONE_REQ]                 || '',
        phonePrevUser:            r[IR.PHONE_PREV_USER]           || '',
        phonePrevNumber:          r[IR.PHONE_PREV_NUMBER]         || '',
        bossJobSites:             r[IR.BOSS_SITES]                || '',
        bossCostSheet:            r[IR.BOSS_COST_SHEET]           || '',
        bossCostSheetJobs:        r[IR.BOSS_JOBS]                  || '',
        bossTripReports:          r[IR.BOSS_TRIP]                  || '',
        bossGrievances:           r[IR.BOSS_GRIEVANCES]           || '',
        jonasJobNumbers:          r[IR.JONAS_JOB_NUMBERS]         || '',
        jrRequired:               r[IR.JR_REQUIRED]               || '',
        jrAssignment:             r[IR.JR_ASSIGNMENT]             || '',
        plan306090:               r[IR.PLAN_306090]               || '',
        comments:                 r[IR.COMMENTS]                  || '',
        adpSites:                 splitCSV(r[IR.ADP_SITES]),
        department:               r[IR.DEPARTMENT]                || '',
        purchasingSites:          splitCSV(r[IR.PURCHASING_SITES]),
        adpSalaryAccess:          r[IR.ADP_SALARY_ACCESS]         || 'No'
      };
    }
    return null;
  } catch (e) {
    Logger.log('[ReferenceDataService] getFullNewHireData error: ' + e.message);
    return null;
  }
}

/**
 * Read all position-change fields from Position_Changes sheet for a given workflowId.
 * Called by: ITConfirmationHandler, ReplayService.
 * @param {string} workflowId
 * @returns {Object|null}
 */
function getFullPositionChangeData(workflowId) {
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.POSITION_CHANGES);
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] !== workflowId) continue;
      const r = data[i];
      const fmtDate = function(d) {
        return d instanceof Date
          ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : (d ? String(d).substring(0, 10) : '');
      };
      const splitPair = function(s) {
        var parts = s ? String(s).split(' -> ') : [];
        return [
          (parts[0] === 'N/A' ? '' : (parts[0] || '')),
          (parts[1] === 'N/A' ? '' : (parts[1] || ''))
        ];
      };
      const splitCSV = function(v) {
        return v ? String(v).split(', ').filter(Boolean) : [];
      };
      const PC = SCHEMA.POSITION_CHANGES;
      const site  = splitPair(r[PC.SITE_TRANSFER]);
      const title = splitPair(r[PC.TITLE_CHANGE]);
      const cls   = splitPair(r[PC.CLASSIFICATION]);
      return {
        workflowId:      r[PC.WORKFLOW_ID],
        reqName:         r[PC.REQUESTER_NAME]   || '',
        reqEmail:        r[PC.REQUESTER_EMAIL]  || '',
        employeeName:    r[PC.EMPLOYEE_NAME]    || '',
        effDate:         fmtDate(r[PC.EFFECTIVE_DATE]),
        siteName:        r[PC.CURRENT_SITE]     || '',
        changeType:      splitCSV(r[PC.CHANGE_TYPES]),
        siteOld:         site[0],  siteNew:  site[1],
        titleOld:        title[0], titleNew: title[1],
        classOld:        cls[0],   classNew: cls[1],
        systems:         splitCSV(r[PC.SYSTEMS_ADDED]),
        equipment:       splitCSV(r[PC.EQUIPMENT]),
        removal:         splitCSV(r[PC.REMOVED_ACCESS]),
        comments:        r[PC.COMMENTS]         || '',
        department:      r[PC.DEPARTMENT]       || '',
        purchasingSites: splitCSV(r[PC.PURCHASING_SITES])
      };
    }
    return null;
  } catch (e) {
    Logger.log('[ReferenceDataService] getFullPositionChangeData error: ' + e.message);
    return null;
  }
}
