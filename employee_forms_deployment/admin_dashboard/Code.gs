/**
 * Employee Request Dashboard - Main Handler
 */

function doGet(e) {
  const page = e.parameter.view || 'dashboard';
  const requestId = e.parameter.id;
  const scriptUrl = ScriptApp.getService().getUrl();
  
  if (page === 'details' && requestId) {
    const template = HtmlService.createTemplateFromFile('Details');
    template.requestId = requestId;
    template.scriptUrl = scriptUrl;
    return template.evaluate()
      .setTitle('Employee Details - ' + requestId)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  
  const template = HtmlService.createTemplateFromFile('Dashboard');
  template.scriptUrl = scriptUrl;
  return template.evaluate()
    .setTitle('Employee Request Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Fetch and aggregate all onboarding data
 */
function getDashboardData() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    
    // Get all sheets
    const initialSheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL);
    const idSheet = ss.getSheetByName(CONFIG.SHEETS.ID_SETUP);
    const itSheet = ss.getSheetByName(CONFIG.SHEETS.IT_SETUP);
    const specSheet = ss.getSheetByName(CONFIG.SHEETS.SPECIALISTS);
    
    // Convert all to objects for easy lookup
    const initialData = getSheetDataAsObjects(initialSheet);
    const idResults = getSheetDataAsObjects(idSheet);
    const itResults = getSheetDataAsObjects(itSheet);
    const specResults = getSheetDataAsObjects(specSheet);
    
    Logger.log('Initial data rows: ' + initialData.length);
    Logger.log('ID results rows: ' + idResults.length);
    Logger.log('IT results rows: ' + itResults.length);
    Logger.log('Spec results rows: ' + specResults.length);
    
    Logger.log('Aggregating ' + initialData.length + ' requests...');
    
    // Map them together
    const dashboard = initialData
      .filter(req => req && req['Request ID']) // Ignore empty rows
      .map(req => {
        const requestId = req['Request ID'];
        
        const idRecord = idResults.find(r => r && r['Request ID'] === requestId);
        const itRecord = itResults.find(r => r && r['Request ID'] === requestId);
        
        // Ensure specResults is an array before filtering
        const specRecords = Array.isArray(specResults) ? 
          specResults.filter(r => r && r['Request ID'] === requestId) : [];
        
        return {
          id: requestId,
          timestamp: req['Submission Timestamp'],
          employee: (req['First Name'] || '') + ' ' + (req['Last Name'] || ''),
          position: req['Position/JR Title'] || 'N/A',
          site: req['Site Name'] || 'N/A',
          submissionTime: req['Submission Timestamp'],
          status: {
            hr: idRecord ? 'Complete' : 'Pending',
            it: itRecord ? 'Complete' : 'Pending',
            specialists: formatSpecialistStatus(specRecords)
          },
          completion: {
            time: getLatestTimestamp(idRecord, itRecord, specRecords),
            handler: getLatestHandler(idRecord, itRecord, specRecords)
          },
          details: {
            email: itRecord ? itRecord['Assigned Email'] : 'N/A',
            employeeId: idRecord ? idRecord['Internal Employee ID'] : 'N/A'
          }
        };
      });
    
    // Sort by latest first
    dashboard.sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp) : new Date(0);
      const dateB = b.timestamp ? new Date(b.timestamp) : new Date(0);
      return dateB - dateA;
    });
    
    const stats = {
      total: dashboard.length,
      open: dashboard.filter(r => r.status.hr === 'Pending').length,
      progress: dashboard.filter(r => r.status.hr === 'Complete' && r.status.it === 'Pending').length,
      complete: dashboard.filter(r => r.status.it === 'Complete').length,
      overdue: 0 // Logic for overdue could be added here based on hire date
    };
    
    Logger.log('Dashboard aggregation complete. Returning ' + dashboard.length + ' records.');
    
    // SAFETY: Clean the object to ensure it's serializable (removes any non-POJO properties)
    const cleanResult = JSON.parse(JSON.stringify({ 
      success: true, 
      data: dashboard.slice(0, 1000), // Limit to top 1000 records for performance
      stats: stats 
    }));
    
    return cleanResult;
    
  } catch (error) {
    Logger.log('❌ Dashboard error: ' + error.stack);
    return { success: false, message: error.toString() };
  }
}

/**
 * Helper: Convert sheet to array of objects using headers
 */
function getSheetDataAsObjects(sheet) {
  try {
    if (!sheet) return [];
    const vals = sheet.getDataRange().getValues();
    if (vals.length < 2) return [];
    
    const headers = vals[0].map(h => h ? h.toString().trim() : '');
    return vals.slice(1)
      .filter(row => row && row.some(cell => cell !== "")) // Skip empty rows
      .map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          if (h) {
            let val = row[i];
            // Handle Dates explicitly to avoid serialization issues
            if (val instanceof Date) {
              val = val.toISOString();
            }
            obj[h] = val;
          }
        });
        return obj;
      });
  } catch (e) {
    Logger.log('⚠️ Warning: Error reading sheet ' + (sheet ? sheet.getName() : 'unknown') + ': ' + e.message);
    return [];
  }
}

/**
 * Format status for specialists
 */
function formatSpecialistStatus(records) {
  if (!records || !Array.isArray(records) || records.length === 0) return 'Pending';
  
  // Get unique departments tagged as complete
  const completedDepts = [...new Set(
    records
      .filter(r => r && r['Department'])
      .map(r => r['Department'])
  )];
  
  return completedDepts.length === 0 ? 'Pending' : completedDepts.join(', ');
}

/**
 * Helper: Get the latest timestamp from any completed stage
 */
function getLatestTimestamp(id, it, specs) {
  const times = [];
  if (id && id['Submission Timestamp']) times.push(new Date(id['Submission Timestamp']));
  if (it && it['Submission Timestamp']) times.push(new Date(it['Submission Timestamp']));
  if (specs && specs.length > 0) {
    specs.forEach(s => {
      if (s['Submission Timestamp']) times.push(new Date(s['Submission Timestamp']));
    });
  }
  
  if (times.length === 0) return null;
  return new Date(Math.max.apply(null, times)).toISOString();
}

/**
 * Helper: Find the last person who handled the request
 */
function getLatestHandler(id, it, specs) {
  let latestTime = 0;
  let handler = 'N/A';
  
  const check = (rec) => {
    if (rec && rec['Submission Timestamp']) {
      const t = new Date(rec['Submission Timestamp']).getTime();
      if (t > latestTime) {
        latestTime = t;
        handler = rec['Submitted By'] || 'N/A';
      }
    }
  };
  
  check(id);
  check(it);
  if (specs) specs.forEach(check);
  
  return handler;
}

/**
 * Fetch detailed data for a specific employee request
 */
function getDetailedEmployeeData(requestId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    
    const initialSheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL);
    const idSheet = ss.getSheetByName(CONFIG.SHEETS.ID_SETUP);
    const itSheet = ss.getSheetByName(CONFIG.SHEETS.IT_SETUP);
    const specSheet = ss.getSheetByName(CONFIG.SHEETS.SPECIALISTS);
    
    const initialRows = getSheetDataAsObjects(initialSheet);
    const idRows = getSheetDataAsObjects(idSheet);
    const itRows = getSheetDataAsObjects(itSheet);
    const specRows = getSheetDataAsObjects(specSheet);
    
    const initialData = initialRows.find(r => r['Request ID'] === requestId);
    if (!initialData) return { success: false, message: 'Request ID not found' };
    
    const idData = idRows.find(r => r['Request ID'] === requestId) || {};
    const itData = itRows.find(r => r['Request ID'] === requestId) || {};
    const specs = specRows.filter(r => r['Request ID'] === requestId);
    
    return JSON.parse(JSON.stringify({
      success: true,
      initial: initialData,
      idSetup: idData,
      itSetup: itData,
      specialists: specs
    }));
    
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}
