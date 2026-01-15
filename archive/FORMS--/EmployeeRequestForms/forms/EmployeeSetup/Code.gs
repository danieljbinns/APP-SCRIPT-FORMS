/**
 * Main Application Logic
 *
 * TODO: Future API Integration
 * - Auto-create SiteDocs worker via API and retrieve Worker ID
 * - Auto-create DSS user via API and retrieve User ID
 * - These should be done after employee data is submitted
 * - Will replace manual entry of Worker ID and User ID fields
 */

function doGet(e) {
  const params = e.parameter || {};
  const workflowId = params.wfid;

  if (!workflowId) {
    return HtmlService.createHtmlOutput('<h1>Error</h1><p>Missing workflow ID</p>');
  }

  return renderForm(workflowId);
}

function renderForm(workflowId) {
  const template = HtmlService.createTemplateFromFile('Form');
  const workflowData = getWorkflowData(workflowId);

  if (!workflowData) {
    return HtmlService.createHtmlOutput('<h1>Error</h1><p>Workflow not found</p>');
  }

  template.workflowId = workflowId;
  template.workflowData = workflowData;
  template.config = CONFIG;
  template.generatedDssUsername = generateDssUsername(workflowData);
  template.generatedEmployeeId = generateEmployeeId();

  return template.evaluate()
    .setTitle(CONFIG.FORM_NAME + ' - ' + workflowData.Employee_Name)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function processFormSubmission(formData) {
  try {
    const taskId = generateTaskId();
    const timestamp = new Date();
    const submittedBy = Session.getActiveUser().getEmail();

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    const rowData = CONFIG.FORM_FIELDS.map(field => {
      if (field === 'Task_ID') return taskId;
      if (field === 'Workflow_ID') return formData.workflowId;
      if (field === 'Completed_By') return submittedBy;
      if (field === 'Completion_Date') return timestamp;
      return formData[field] || '';
    });

    sheet.appendRow(rowData);
    updateWorkflowTracking(formData.workflowId, taskId, submittedBy);

    return { success: true, message: 'Employee setup completed successfully!', taskId: taskId };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.message };
  }
}

function generateTaskId() {
  const date = new Date();
  const dateStr = date.getFullYear() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return CONFIG.TASK_ID_PREFIX + '-' + dateStr + '-' + suffix;
}

function generateEmployeeId() {
  // Generate 6-digit employee ID
  // TODO: Implement sequential ID lookup from existing employee database
  // For now, generate random 6-digit number starting with 15
  const randomDigits = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return '15' + randomDigits;
}

function generateDssUsername(workflowData) {
  // Generate DSS username based on employee info
  // Format: FirstInitialLastName-SiteCode-YYYYMMDD (e.g., JSmith-UC217-20251216)
  const firstName = workflowData.First_Name || '';
  const lastName = workflowData.Last_Name || '';
  const siteCode = workflowData.Site_Code || '';
  const date = new Date();
  const dateStr = date.getFullYear() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');

  const firstInitial = firstName.charAt(0).toUpperCase();
  const cleanLastName = lastName.replace(/[^a-zA-Z]/g, '');

  return firstInitial + cleanLastName + '-' + siteCode + '-' + dateStr;
}

function getWorkflowData(workflowId) {
  // TODO: Implement cross-spreadsheet lookup to REQUEST_FORMS
  // This should pull data from InitialRequest form submission
  return {
    Employee_Name: 'John Smith',
    First_Name: 'John',
    Middle_Name: '',
    Last_Name: 'Smith',
    Hire_Date: '2025-12-22',
    Position: 'Industrial Cleaner',
    Site_Name: 'HYUNDAI PAINT UC217',
    Site_Code: 'UC217', // Extracted from site selection in InitialRequest
    Manager_Name: 'Kanzy Lawson',
    Manager_Email: 'kanzy.lawson@team-group.com',
    Employment_Type: 'Hourly',
    SiteDocs_Access: 'Yes', // From InitialRequest checkbox
    Email_Requested: 'john.smith@team-group.com'
  };
}

function updateWorkflowTracking(workflowId, taskId, completedBy) {
  try {
    if (!CONFIG.WORKFLOW_TRACKING_SPREADSHEET_ID) return false;

    const ss = SpreadsheetApp.openById(CONFIG.WORKFLOW_TRACKING_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.WORKFLOW_TASKS_SHEET);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === workflowId && data[i][1] === CONFIG.TASK_TYPE) {
        sheet.getRange(i + 1, 3).setValue(taskId);
        sheet.getRange(i + 1, 4).setValue('Complete');
        sheet.getRange(i + 1, 7).setValue(new Date());
        sheet.getRange(i + 1, 8).setValue(completedBy);
        return true;
      }
    }
    return false;
  } catch (error) {
    Logger.log('Error updating tracking: ' + error.message);
    return false;
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
