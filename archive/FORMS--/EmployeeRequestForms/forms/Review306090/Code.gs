/**
 * Main Application Logic
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

    return { success: true, message: 'Task completed successfully!', taskId: taskId };
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

function getWorkflowData(workflowId) {
  // TODO: Implement cross-spreadsheet lookup to REQUEST_FORMS
  return { Employee_Name: 'John Smith', Hire_Date: '2025-12-15' };
}

function updateWorkflowTracking(workflowId, taskId, completedBy) {
  try {
    if (!CONFIG.WORKFLOW_TRACKING_SPREADSHEET_ID) return false;

    const ss = SpreadsheetApp.openById(CONFIG.WORKFLOW_TRACKING_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.WORKFLOW_TASKS_SHEET);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

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
