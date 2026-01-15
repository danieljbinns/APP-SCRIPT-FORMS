/**
 * Setup & Deployment Functions
 */

function setupSpreadsheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SHARED_DRIVE_ID);
  const sheet = ss.insertSheet(CONFIG.SHEET_NAME);

  // Set headers
  sheet.getRange(1, 1, 1, CONFIG.FORM_FIELDS.length)
    .setValues([CONFIG.FORM_FIELDS])
    .setFontWeight('bold')
    .setBackground('#EB1C2D')
    .setFontColor('#FFFFFF');

  // Freeze header row
  sheet.setFrozenRows(1);

  // Auto-resize columns
  for (let i = 1; i <= CONFIG.FORM_FIELDS.length; i++) {
    sheet.autoResizeColumn(i);
  }

  Logger.log('Spreadsheet setup complete: ' + ss.getUrl());
  return ss.getId();
}

function getDeploymentUrl() {
  const url = ScriptApp.getService().getUrl();
  Logger.log('Deployment URL: ' + url);
  return url;
}

function testFormRender() {
  const testWorkflowId = 'TEST-WF-001';
  const html = renderForm(testWorkflowId);
  Logger.log('Test render successful');
  return html;
}
