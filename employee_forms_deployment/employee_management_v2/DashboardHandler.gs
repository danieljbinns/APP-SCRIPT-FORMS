/**
 * Dashboard Handler for V2
 * Visualizes the Workflows master sheet
 */

function serveDashboard() {
  const template = HtmlService.createTemplateFromFile('Dashboard');
  return template.evaluate()
    .setTitle('Employee Onboarding Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Get all workflows for the dashboard
 * Optimized to read from single 'Workflows' sheet
 */
function getDashboardData() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
    
    if (!sheet) {
      return { success: false, message: 'Workflows sheet not found' };
    }
    
    // Get all data including headers
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // Map to objects for easier consumption on client side
    const workflows = rows.map(row => {
      return {
        id: row[0],
        type: row[1],
        name: row[2],
        initiator: row[3],
        status: row[4],
        // Convert dates to ISO strings to avoid serialization issues
        created: row[5] instanceof Date ? row[5].toISOString() : String(row[5]),
        updated: row[6] instanceof Date ? row[6].toISOString() : String(row[6]),
        step: row[7],
        employee: row[8]
      };
    }).reverse(); // Show newest first
    
    const result = {
      success: true,
      workflows: workflows
    };
    
    Logger.log('Returning dashboard data: ' + workflows.length + ' records');
    return result;
    
  } catch (error) {
    Logger.log('Error fetching dashboard data: ' + error.toString());
    return { success: false, message: 'Server error: ' + error.message };
  }
}
