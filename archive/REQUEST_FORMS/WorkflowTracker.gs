/**
 * WORKFLOW TRACKER - Google Apps Script Backend
 * Manages workflow instance tracking, filtering, and KPI calculations
 * Reusable for any multi-step workflow (Credit Card, HR Setup, IT Setup, etc.)
 */

/**
 * Renders the Workflow Tracker dashboard
 * @returns {HtmlOutput} Tracker interface
 */
function renderWorkflowTracker() {
  const template = HtmlService.createTemplateFromFile('WorkflowTrackerUI');

  // Inject server-side data
  template.workflowTypes = getWorkflowTypes();
  template.sites = getSiteNames();
  template.requestors = getRequestorNames();
  template.trackerData = getTrackerData();
  template.logoUrl = CONFIG.LOGO_URL;
  template.companyName = CONFIG.COMPANY_NAME;

  return template.evaluate()
    .setWidth(1400)
    .setHeight(900)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Gets all workflow types for dropdown
 * @returns {Array} Workflow type names
 */
function getWorkflowTypes() {
  return [
    'All',
    'Credit Card',
    'HR Setup',
    'IT Setup',
    'Fleetio Assignment',
    'ADP Supervisor Access',
    'ADP Manager Access',
    'JONAS Access',
    'SiteDocs Training',
    '30-60-90 Review'
  ];
}

/**
 * Gets all unique site names from Initial Requests sheet
 * @returns {Array} Site names
 */
function getSiteNames() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  const sites = new Set();
  // Column I contains Site Name (index 8)
  for (let i = 1; i < data.length; i++) {
    if (data[i][8]) sites.add(data[i][8]);
  }

  return Array.from(sites).sort();
}

/**
 * Gets all unique requestor names
 * @returns {Array} Requestor names
 */
function getRequestorNames() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  const requestors = new Set();
  // Column C contains Requester Name (index 2)
  for (let i = 1; i < data.length; i++) {
    if (data[i][2]) requestors.add(data[i][2]);
  }

  return Array.from(requestors).sort();
}

/**
 * Gets all tracker data (full dataset for client-side filtering)
 * @returns {Array} Array of tracker objects
 */
function getTrackerData() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    const trackerData = [];

    // Start from row 1 (skip header at row 0)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Calculate which workflow forms are associated with this request
      const workflows = getAssociatedWorkflows(row);

      // Create tracker entry for each associated workflow
      workflows.forEach(function(workflowType) {
        // Try to get completion data from department sheet (if exists)
        const completionData = getWorkflowCompletionData(row[0], workflowType); // row[0] is Request ID

        trackerData.push({
          requestId: row[0],
          workflowType: workflowType,
          employeeName: (row[5] || '') + ' ' + (row[6] || ''), // First Name + Last Name
          requestorName: row[2],
          site: row[8],
          department: row[9],
          position: row[10],
          status: completionData.status || 'Pending',
          dateOpened: row[1], // Submission Timestamp
          dateCompleted: completionData.dateCompleted || null,
          daysToComplete: completionData.daysToComplete || null,
          notes: completionData.notes || '',
          assignedTo: completionData.assignedTo || 'Unassigned'
        });
      });
    }

    return trackerData;

  } catch (error) {
    Logger.log('Error getting tracker data: ' + error.message);
    return [];
  }
}

/**
 * Determines which workflows are associated with a request
 * Based on department, position, and equipment selections
 * @param {Array} row - Row data from Initial Requests sheet
 * @returns {Array} Workflow type names that apply to this request
 */
function getAssociatedWorkflows(row) {
  const workflows = [];
  const department = row[9]; // Column J - Department
  const position = row[10]; // Column K - Position/Title
  const laptop = row[13]; // Column N - Laptop
  const phone = row[17]; // Column R - Phone

  // HR Setup - applicable to all
  workflows.push('HR Setup');

  // IT Setup - if laptop or any equipment selected
  if (laptop === 'Yes' || phone === 'Yes') {
    workflows.push('IT Setup');
  }

  // Credit Card - if Department is Accounting or position indicates need
  if (department === 'Accounting' || position.includes('Manager') || position.includes('Director')) {
    workflows.push('Credit Card');
  }

  // Fleetio Assignment - if Department is Fleet
  if (department === 'Fleet') {
    workflows.push('Fleetio Assignment');
  }

  // ADP Supervisor Access - if position indicates supervisor role
  if (position.includes('Manager') || position.includes('Supervisor')) {
    workflows.push('ADP Supervisor Access');
  }

  // ADP Manager Access - if higher-level manager
  if (position.includes('Director') || position.includes('Head')) {
    workflows.push('ADP Manager Access');
  }

  // JONAS Access - if Department is Accounting or Finance
  if (department === 'Accounting' || position.includes('Finance')) {
    workflows.push('JONAS Access');
  }

  // SiteDocs Training - all field/operations staff
  if (department === 'Operations' || department === 'Safety' || department === 'Fleet') {
    workflows.push('SiteDocs Training');
  }

  // 30-60-90 Review - all employees (triggered separately at review dates)
  // Omitting from initial request workflows

  return workflows;
}

/**
 * Gets completion status and data for a workflow
 * Placeholder - would look up in department-specific sheet if it exists
 * @param {string} requestId - Request ID
 * @param {string} workflowType - Type of workflow
 * @returns {Object} Completion data {status, dateCompleted, daysToComplete, notes, assignedTo}
 */
function getWorkflowCompletionData(requestId, workflowType) {
  // This is a placeholder that returns default "Pending" status
  // In production, this would:
  // 1. Look for a sheet named "WorkflowTracking" or similar
  // 2. Query for rows matching requestId + workflowType
  // 3. Return actual status from that sheet

  // For now, return pending status with future completion date example
  return {
    status: 'Pending',
    dateCompleted: null,
    daysToComplete: null,
    notes: '',
    assignedTo: 'Unassigned'
  };
}

/**
 * Filters tracker data based on criteria
 * @param {Object} filters - Filter object {workflowType, status, dateFrom, dateTo, site, requestor, employeeName}
 * @param {Array} trackerData - Full tracker data
 * @returns {Array} Filtered tracker data
 */
function filterTrackerData(filters, trackerData) {
  return trackerData.filter(function(item) {
    // Workflow Type filter
    if (filters.workflowType && filters.workflowType !== 'All' && item.workflowType !== filters.workflowType) {
      return false;
    }

    // Status filter
    if (filters.status && filters.status.length > 0 && filters.status.indexOf(item.status) === -1) {
      return false;
    }

    // Site filter
    if (filters.site && item.site !== filters.site) {
      return false;
    }

    // Requestor filter
    if (filters.requestor && item.requestorName !== filters.requestor) {
      return false;
    }

    // Employee Name filter (contains search)
    if (filters.employeeName && item.employeeName.toLowerCase().indexOf(filters.employeeName.toLowerCase()) === -1) {
      return false;
    }

    // Date range filter
    if (filters.dateFrom) {
      const itemDate = new Date(item.dateOpened);
      const filterDate = new Date(filters.dateFrom);
      if (itemDate < filterDate) return false;
    }

    if (filters.dateTo) {
      const itemDate = new Date(item.dateOpened);
      const filterDate = new Date(filters.dateTo);
      if (itemDate > filterDate) return false;
    }

    return true;
  });
}

/**
 * Calculates KPI metrics for filtered data
 * @param {Array} filteredData - Filtered tracker data
 * @returns {Object} KPI metrics {total, completed, pending, completionRate, avgDaysToComplete, etc.}
 */
function calculateKPIs(filteredData) {
  const completed = filteredData.filter(item => item.status === 'Completed');
  const pending = filteredData.filter(item => item.status === 'Pending' || item.status === 'In Progress');
  const cancelled = filteredData.filter(item => item.status === 'Cancelled');

  const daysToComplete = completed
    .map(item => item.daysToComplete)
    .filter(val => val !== null && val !== undefined);

  const avgDays = daysToComplete.length > 0
    ? (daysToComplete.reduce((a, b) => a + b, 0) / daysToComplete.length).toFixed(1)
    : 'N/A';

  const medianDays = daysToComplete.length > 0
    ? daysToComplete.sort((a, b) => a - b)[Math.floor(daysToComplete.length / 2)].toFixed(1)
    : 'N/A';

  const completionRate = filteredData.length > 0
    ? ((completed.length / filteredData.length) * 100).toFixed(1)
    : '0';

  const oldestPending = pending.length > 0
    ? Math.max(...pending.map(item => {
        const opened = new Date(item.dateOpened);
        const now = new Date();
        return Math.floor((now - opened) / (1000 * 60 * 60 * 24));
      }))
    : null;

  return {
    totalRequests: filteredData.length,
    completedCount: completed.length,
    pendingCount: pending.length,
    cancelledCount: cancelled.length,
    completionRate: parseFloat(completionRate),
    averageDaysToComplete: avgDays,
    medianDaysToComplete: medianDays,
    oldestPendingDays: oldestPending,
    statusDistribution: {
      completed: completed.length,
      pending: pending.length,
      cancelled: cancelled.length
    }
  };
}

/**
 * Processes workflow action (cancel, delay, edit)
 * @param {string} requestId - Request ID
 * @param {string} workflowType - Workflow type
 * @param {string} action - Action (cancel, delay, edit)
 * @param {Object} actionData - Additional data for action
 * @returns {Object} Response {success, message}
 */
function processWorkflowAction(requestId, workflowType, action, actionData) {
  try {
    // These would be implemented to actually modify workflow state
    const timestamp = new Date();

    switch(action) {
      case 'cancel':
        // Update workflow status to Cancelled
        Logger.log('Cancelling workflow: ' + workflowType + ' for request ' + requestId);
        return {
          success: true,
          message: 'Workflow cancelled successfully'
        };

      case 'delay':
        // Record delay and set new deadline
        Logger.log('Delaying workflow: ' + workflowType + ' for request ' + requestId + ' until ' + actionData.delayUntil);
        return {
          success: true,
          message: 'Workflow delayed until ' + actionData.delayUntil
        };

      case 'edit':
        // Reopen workflow for editing
        Logger.log('Reopening workflow for edit: ' + workflowType + ' for request ' + requestId);
        return {
          success: true,
          message: 'Workflow reopened for editing',
          editUrl: ScriptApp.getService().getUrl() + '?form=' + workflowType.toLowerCase().replace(' ', '_') + '&id=' + requestId
        };

      default:
        return {
          success: false,
          message: 'Unknown action: ' + action
        };
    }

  } catch (error) {
    Logger.log('Error processing workflow action: ' + error.message);
    return {
      success: false,
      message: 'Error: ' + error.message
    };
  }
}

/**
 * Exports tracker data to CSV
 * @param {Array} trackerData - Tracker data to export
 * @returns {string} CSV data
 */
function exportTrackerDataToCSV(trackerData) {
  let csv = 'Request ID,Workflow Type,Employee Name,Requestor,Site,Department,Position,Status,Date Opened,Date Completed,Days to Complete,Assigned To,Notes\n';

  trackerData.forEach(function(item) {
    csv += '"' + item.requestId + '",'
      + '"' + item.workflowType + '",'
      + '"' + item.employeeName + '",'
      + '"' + item.requestorName + '",'
      + '"' + item.site + '",'
      + '"' + item.department + '",'
      + '"' + item.position + '",'
      + '"' + item.status + '",'
      + '"' + new Date(item.dateOpened).toLocaleDateString() + '",'
      + '"' + (item.dateCompleted ? new Date(item.dateCompleted).toLocaleDateString() : '') + '",'
      + (item.daysToComplete || '') + ','
      + '"' + item.assignedTo + '",'
      + '"' + item.notes.replace(/"/g, '""') + '"' + '\n';
  });

  return csv;
}

/**
 * Main entry point for rendering tracker web app
 * @param {object} e - Event object
 * @returns {HtmlOutput} Rendered HTML
 */
function doGetTracker(e) {
  return renderWorkflowTracker();
}
