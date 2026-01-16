/**
 * Specialist Forms - Handler Functions
 */

function serveSpecialist(workflowId, dept) {
  if (!workflowId) {
    return HtmlService.createHtmlOutput('<h1>Error: No workflow ID provided</h1>');
  }
  
  const deptMap = {
    'creditcard': 'CreditCard',
    'businesscards': 'BusinessCards',
    'fleetio': 'Fleetio',
    'jonas': 'Jonas',
    'sitedocs': 'SiteDocs',
    'review': 'Review306090'
  };
  
  const htmlFile = deptMap[dept] || 'Placeholder';
  const template = HtmlService.createTemplateFromFile(htmlFile);
  template.workflowId = workflowId;
  template.formId = '';
  template.department = dept || 'general';
  
  return template.evaluate()
    .setTitle('Specialist Setup - ' + dept)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function submitSpecialistForm(formData) {
  try {
    const workflowId = formData.workflowId;
    const dept = formData.department;
    const formId = generateFormId('SPEC_' + dept.toUpperCase());
    
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    
    // Determine which sheet to use based on department
    const sheetMap = {
      'creditcard': CONFIG.SHEETS.CREDIT_CARD_RESULTS,
      'businesscards': CONFIG.SHEETS.BUSINESS_CARDS_RESULTS,
      'fleetio': CONFIG.SHEETS.FLEETIO_RESULTS,
      'jonas': CONFIG.SHEETS.JONAS_RESULTS,
      'sitedocs': CONFIG.SHEETS.SITEDOCS_RESULTS,
      'review': CONFIG.SHEETS.REVIEW_306090_RESULTS
    };
    
    const sheetName = sheetMap[dept] || 'Specialist Results';
    let resultsSheet = ss.getSheetByName(sheetName);
    
    if (!resultsSheet) {
      resultsSheet = ss.insertSheet(sheetName);
      resultsSheet.appendRow([
        'Workflow ID', 'Form ID', 'Submission Timestamp',
        'Details', 'Notes', 'Submitted By'
      ]);
      resultsSheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#EB1C2D').setFontColor('#ffffff');
    }
    
    resultsSheet.appendRow([
      workflowId, formId, new Date(),
      formData.details || JSON.stringify(formData), formData.notes || '', Session.getActiveUser().getEmail()
    ]);
    
    Logger.log('[SUCCESS] Specialist form submitted: ' + dept + ' for ' + workflowId);
    
    return {
      success: true,
      message: 'Specialist setup completed successfully'
    };
    
  } catch (error) {
    Logger.log('[ERROR] Specialist form error: ' + error.toString());
    return { success: false, message: error.message };
  }
}
