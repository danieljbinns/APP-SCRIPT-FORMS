/**
 * Specialist Placeholder Form - Main Handler
 */

function doGet(e) {
  const requestId = e.parameter.id || '';
  const dept = e.parameter.dept || 'Department';
  
  if (!requestId) {
    return HtmlService.createHtmlOutput('<h1>Error: No request ID provided</h1>');
  }
  
  const template = HtmlService.createTemplateFromFile('Placeholder');
  template.requestId = requestId;
  template.deptName = formatDeptName(dept);
  template.deptCode = dept;
  
  // Get employee data for context
  const requestData = getEmployeeContext(requestId);
  template.requestData = requestData;
  
  return template.evaluate()
    .setTitle(formatDeptName(dept) + ' Setup')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Format department internal name to readable name
 */
function formatDeptName(dept) {
  const map = {
    'creditcard': 'Credit Card',
    'fleetio': 'Fleetio',
    'businesscards': 'Business Cards',
    'review': '30/60/90 & JR Review',
    'adp': 'ADP',
    'jonas': 'JONAS',
    'sitedocs': 'SiteDocs'
  };
  return map[dept] || dept.charAt(0).toUpperCase() + dept.slice(1);
}

/**
 * Get employee context data from available sheets
 */
function getEmployeeContext(requestId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const mainSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    const itSheet = ss.getSheetByName(CONFIG.IT_RESULTS_SHEET);
    
    const mainData = mainSheet.getDataRange().getValues();
    let context = { success: false, message: 'Request ID not found' };
    
    // Find basic info
    for (let i = 1; i < mainData.length; i++) {
      if (mainData[i][0] === requestId) {
        context = {
          success: true,
          employeeName: mainData[i][9] + ' ' + mainData[i][11],
          position: mainData[i][13],
          siteName: mainData[i][14]
        };
        break;
      }
    }
    
    if (!context.success) return context;
    
    // Attempt to find IT assigned email
    if (itSheet) {
      const itData = itSheet.getDataRange().getValues();
      const headers = itData[0];
      const emailCol = headers.indexOf('Assigned Email');
      
      if (emailCol !== -1) {
        for (let j = 1; j < itData.length; j++) {
          if (itData[j][0] === requestId) {
            context.assignedEmail = itData[j][emailCol];
            break;
          }
        }
      }
    }
    
    return context;
    
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Submit Specialist Setup
 */
function submitSpecialistSetup(formData) {
  try {
    const requestId = formData.requestId;
    const dept = formData.deptCode;
    Logger.log('Specialist Setup submitted for: ' + requestId + ' (' + dept + ')');
    
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let resultsSheet = ss.getSheetByName(CONFIG.SPECIALIST_RESULTS_SHEET);
    
    // Create sheet if missing
    if (!resultsSheet) {
      resultsSheet = ss.insertSheet(CONFIG.SPECIALIST_RESULTS_SHEET);
      resultsSheet.appendRow([
        'Request ID',
        'Submission Timestamp',
        'Department',
        'Status',
        'Specialist Notes',
        'Submitted By'
      ]);
      resultsSheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#f3f3f3');
    }
    
    // Append results
    resultsSheet.appendRow([
      requestId,
      new Date(),
      formData.deptName,
      'Complete',
      formData.notes || '',
      Session.getActiveUser().getEmail()
    ]);
    
    return {
      success: true,
      message: formData.deptName + ' setup completed successfully!'
    };
    
  } catch (error) {
    Logger.log('❌ Specialist Setup error: ' + error.toString());
    return { success: false, message: error.message };
  }
}
