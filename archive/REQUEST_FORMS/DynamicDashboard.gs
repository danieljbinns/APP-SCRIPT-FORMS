/**
 * DYNAMIC DASHBOARD GENERATOR
 * Automatically creates per-form dashboards based on workflow definition
 * Real-time updates via polling and data change detection
 */

/**
 * Generates a unique dashboard ID for a form within a workflow
 * @param {string} workflowId - Workflow ID
 * @param {string} formId - Form ID
 * @returns {string} Unique dashboard ID
 */
function generateDashboardId(workflowId, formId) {
  return 'DASH-' + workflowId.replace(/[^a-zA-Z0-9]/g, '') + '-' +
         formId.replace(/[^a-zA-Z0-9]/g, '') + '-' +
         new Date().getTime();
}

/**
 * Generates master tracker reference number for workflow
 * Format: WFLOW-YYYYMMDD-XXXXX
 * @returns {string} Unique workflow reference number
 */
function generateWorkflowReference() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // Generate random suffix (5 alphanumeric)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return 'WFLOW-' + year + month + day + '-' + suffix;
}

/**
 * Creates a dashboard definition for a form in a workflow
 * @param {Object} workflowDef - Workflow definition
 * @param {Object} formDef - Form definition
 * @param {Object} requestData - Request data from trigger
 * @returns {Object} Dashboard definition
 */
function createDashboardForForm(workflowDef, formDef, requestData) {
  const dashboardId = generateDashboardId(workflowDef.id, formDef.id);
  const workflowRef = generateWorkflowReference();

  return {
    dashboardId: dashboardId,
    workflowReference: workflowRef,
    workflowId: workflowDef.id,
    workflowName: workflowDef.name,
    formId: formDef.id,
    formName: formDef.name,

    // Metadata
    createdDate: new Date().toISOString(),
    createdBy: Session.getActiveUser().getEmail(),
    requestId: requestData.requestId,
    employeeName: requestData['First Name'] + ' ' + requestData['Last Name'],
    department: requestData['Department'],
    position: requestData['Position/Title'],
    site: requestData['Site Name'],

    // Dashboard configuration
    config: {
      refreshRate: WORKFLOW_CONFIG.dashboard.refreshRates.realtime,
      autoRefresh: true,
      layout: 'grid', // 'grid', 'list', 'kanban'
      widgets: [
        {
          id: 'header',
          type: 'header',
          title: formDef.name + ' - ' + workflowDef.name,
          subtitle: 'Employee: ' + requestData['First Name'] + ' ' + requestData['Last Name']
        },
        {
          id: 'status-cards',
          type: 'status-cards',
          metrics: [
            { label: 'Status', value: 'Pending', color: 'warning' },
            { label: 'Assigned To', value: requestData['Department'], color: 'info' },
            { label: 'Due', value: 'In 2 days', color: 'normal' },
            { label: 'Reference', value: workflowRef, color: 'normal' }
          ]
        },
        {
          id: 'workflow-timeline',
          type: 'timeline',
          title: 'Workflow Progress',
          steps: getWorkflowSteps(workflowDef)
        },
        {
          id: 'form-fields',
          type: 'form-fields-display',
          title: 'Form Fields to Complete',
          fields: formDef.fields || []
        },
        {
          id: 'actions',
          type: 'action-buttons',
          actions: [
            { label: 'View Form', action: 'view_form', color: 'primary' },
            { label: 'Edit', action: 'edit', color: 'secondary' },
            { label: 'Delay', action: 'delay', color: 'warning' },
            { label: 'Cancel', action: 'cancel', color: 'danger' }
          ]
        },
        {
          id: 'comments',
          type: 'comments-section',
          title: 'Comments & Notes'
        }
      ]
    },

    // Data refresh configuration
    dataSource: {
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      sheetName: 'Dashboard_' + dashboardId,
      refreshInterval: 5000,
      cacheData: true
    },

    // Permissions
    permissions: {
      viewers: ['${AssignedTo}', '${Manager}', 'admin@company.com'],
      editors: ['${AssignedTo}', 'admin@company.com'],
      admins: ['admin@company.com']
    }
  };
}

/**
 * Gets workflow steps formatted for timeline
 * @param {Object} workflowDef - Workflow definition
 * @returns {Array} Timeline steps
 */
function getWorkflowSteps(workflowDef) {
  return workflowDef.steps.map((step, index) => ({
    order: index + 1,
    name: step.name || step.type,
    status: step.status || 'pending',
    dueDate: step.dueDate || null,
    completedDate: step.completedDate || null,
    assignedTo: step.assignTo || 'Pending'
  }));
}

/**
 * Renders dashboard HTML for real-time display
 * @param {Object} dashboardDef - Dashboard definition
 * @returns {string} HTML content
 */
function renderDashboardHTML(dashboardDef) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${dashboardDef.formName} - ${dashboardDef.workflowName}</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700">
  <style>
    ${generateDashboardCSS()}
  </style>
</head>
<body>
  <div class="dashboard-container">
    <div class="dashboard-header">
      <div class="header-left">
        <h1>${dashboardDef.formName}</h1>
        <p class="subtitle">${dashboardDef.workflowName}</p>
        <div class="reference-number">
          <strong>Ref:</strong> ${dashboardDef.workflowReference}
        </div>
      </div>
      <div class="header-right">
        <div class="employee-info">
          <div class="info-item">
            <label>Employee</label>
            <span>${dashboardDef.employeeName}</span>
          </div>
          <div class="info-item">
            <label>Position</label>
            <span>${dashboardDef.position}</span>
          </div>
          <div class="info-item">
            <label>Department</label>
            <span>${dashboardDef.department}</span>
          </div>
          <div class="info-item">
            <label>Site</label>
            <span>${dashboardDef.site}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="dashboard-content">
      <div class="status-cards">
        <div class="status-card status-pending">
          <div class="card-label">Status</div>
          <div class="card-value">Pending</div>
        </div>
        <div class="status-card status-assigned">
          <div class="card-label">Assigned To</div>
          <div class="card-value" id="assignedTo">Loading...</div>
        </div>
        <div class="status-card status-due">
          <div class="card-label">Due In</div>
          <div class="card-value" id="dueIn">2 days</div>
        </div>
        <div class="status-card status-progress">
          <div class="card-label">Progress</div>
          <div class="card-value">0%</div>
        </div>
      </div>

      <div class="dashboard-body">
        <div class="left-panel">
          <div class="panel-section">
            <h3>Workflow Timeline</h3>
            <div class="timeline" id="timeline">
              <!-- Auto-generated from workflow steps -->
            </div>
          </div>

          <div class="panel-section">
            <h3>Form Fields</h3>
            <div class="form-fields" id="formFields">
              <!-- Auto-generated from form definition -->
            </div>
          </div>
        </div>

        <div class="right-panel">
          <div class="panel-section">
            <h3>Actions</h3>
            <div class="actions">
              <button class="btn btn-primary" onclick="viewForm()">👁 View Form</button>
              <button class="btn btn-secondary" onclick="editForm()">✏ Edit</button>
              <button class="btn btn-warning" onclick="delayTask()">⏸ Delay</button>
              <button class="btn btn-danger" onclick="cancelTask()">✕ Cancel</button>
            </div>
          </div>

          <div class="panel-section">
            <h3>Notes & Comments</h3>
            <div class="comments-section" id="comments">
              <div class="comment-input">
                <textarea id="commentText" placeholder="Add a comment..."></textarea>
                <button class="btn btn-small" onclick="addComment()">Post Comment</button>
              </div>
              <div class="comments-list" id="commentsList">
                <!-- Auto-populated from data -->
              </div>
            </div>
          </div>

          <div class="panel-section">
            <h3>Assignment</h3>
            <div class="assignment-section">
              <div class="current-assignment">
                <strong>Current:</strong> <span id="currentAssigned">HR Manager</span>
              </div>
              <div class="reassign-form">
                <input type="email" id="reassignEmail" placeholder="Reassign to email...">
                <button class="btn btn-small" onclick="reassign()">Reassign</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="status-message" id="statusMessage"></div>

  <script>
    const dashboardData = ${JSON.stringify(dashboardDef)};

    // Auto-refresh dashboard
    setInterval(refreshDashboard, ${dashboardDef.config.refreshRate});

    function refreshDashboard() {
      google.script.run
        .withSuccessHandler(function(data) {
          updateDashboard(data);
        })
        .getDashboardData(dashboardData.dashboardId);
    }

    function updateDashboard(data) {
      // Update all widgets with fresh data
      document.getElementById('assignedTo').textContent = data.assignedTo;
      document.getElementById('dueIn').textContent = data.dueIn;
      // ... more updates
    }

    function viewForm() {
      window.location.href = dashboardData.formLink;
    }

    function editForm() {
      showModal('Edit Form', 'Reopen form for editing?');
    }

    function delayTask() {
      showModal('Delay Task', 'Select new deadline...');
    }

    function cancelTask() {
      if (confirm('Cancel this task?')) {
        google.script.run.cancelTask(dashboardData.dashboardId);
      }
    }

    function reassign() {
      const email = document.getElementById('reassignEmail').value;
      google.script.run.reassignTask(dashboardData.dashboardId, email);
    }

    function addComment() {
      const text = document.getElementById('commentText').value;
      if (text.trim()) {
        google.script.run.addComment(dashboardData.dashboardId, text);
        document.getElementById('commentText').value = '';
        refreshDashboard();
      }
    }

    function showMessage(message, type) {
      const el = document.getElementById('statusMessage');
      el.textContent = message;
      el.className = 'status-message show status-' + type;
      setTimeout(() => el.classList.remove('show'), 3000);
    }

    // Initialize on load
    window.addEventListener('load', refreshDashboard);
  </script>
</body>
</html>
  `;

  return html;
}

/**
 * Generates CSS for dashboard
 * @returns {string} CSS code
 */
function generateDashboardCSS() {
  return `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Roboto', sans-serif;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  color: #333;
  padding: 20px;
}

.dashboard-container {
  max-width: 1400px;
  margin: 0 auto;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.dashboard-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 30px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.header-left h1 {
  font-size: 28px;
  margin-bottom: 5px;
}

.header-left .subtitle {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 10px;
}

.reference-number {
  background: rgba(255, 255, 255, 0.2);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-family: monospace;
  display: inline-block;
}

.header-right {
  display: flex;
  gap: 30px;
}

.employee-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.info-item {
  display: flex;
  flex-direction: column;
}

.info-item label {
  font-size: 12px;
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.info-item span {
  font-size: 14px;
  font-weight: 500;
}

.dashboard-content {
  padding: 30px;
}

.status-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 30px;
}

.status-card {
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.status-card.status-pending {
  background: #fff3cd;
  border-left-color: #ffc107;
}

.status-card.status-assigned {
  background: #d1ecf1;
  border-left-color: #17a2b8;
}

.status-card.status-due {
  background: #e2e3e5;
  border-left-color: #6c757d;
}

.status-card.status-progress {
  background: #d4edda;
  border-left-color: #28a745;
}

.card-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  opacity: 0.7;
}

.card-value {
  font-size: 18px;
  font-weight: 700;
}

.dashboard-body {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 30px;
}

.panel-section {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.panel-section h3 {
  font-size: 16px;
  margin-bottom: 15px;
  color: #333;
  border-bottom: 2px solid #667eea;
  padding-bottom: 10px;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.timeline-item {
  display: flex;
  gap: 15px;
  align-items: flex-start;
}

.timeline-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #667eea;
  margin-top: 2px;
  flex-shrink: 0;
}

.timeline-content {
  flex: 1;
}

.timeline-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.timeline-status {
  font-size: 12px;
  color: #666;
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field-item {
  padding: 10px;
  background: white;
  border-left: 3px solid #667eea;
  border-radius: 4px;
  font-size: 14px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover {
  background: #5568d3;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: #e9ecef;
  color: #333;
}

.btn-secondary:hover {
  background: #dee2e6;
}

.btn-warning {
  background: #ffc107;
  color: #333;
}

.btn-warning:hover {
  background: #e0a800;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
}

.comments-section {
  background: white;
  border-radius: 6px;
}

.comment-input {
  padding: 15px;
  border-bottom: 1px solid #eee;
}

.comment-input textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
  font-size: 13px;
  resize: vertical;
  min-height: 60px;
  margin-bottom: 10px;
}

.comments-list {
  max-height: 400px;
  overflow-y: auto;
}

.comment {
  padding: 15px;
  border-bottom: 1px solid #eee;
  font-size: 13px;
}

.comment-author {
  font-weight: 600;
  margin-bottom: 4px;
}

.comment-date {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}

.assignment-section {
  background: white;
  padding: 15px;
  border-radius: 6px;
}

.current-assignment {
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.reassign-form {
  display: flex;
  gap: 10px;
}

.reassign-form input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
}

.status-message {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 15px 20px;
  border-radius: 6px;
  background: #333;
  color: white;
  display: none;
  z-index: 1000;
}

.status-message.show {
  display: block;
}

.status-message.status-success {
  background: #28a745;
}

.status-message.status-error {
  background: #dc3545;
}

.status-message.status-warning {
  background: #ffc107;
  color: #333;
}

@media (max-width: 1024px) {
  .dashboard-body {
    grid-template-columns: 1fr;
  }

  .header-right {
    flex-direction: column;
  }

  .employee-info {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .dashboard-header {
    flex-direction: column;
  }

  .status-cards {
    grid-template-columns: 1fr;
  }
}
  `;
}

/**
 * Gets dashboard data for real-time updates
 * @param {string} dashboardId - Dashboard ID
 * @returns {Object} Current dashboard data
 */
function getDashboardData(dashboardId) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName('Dashboard_' + dashboardId);

  if (!sheet) {
    return {
      assignedTo: 'Unassigned',
      dueIn: 'No due date',
      status: 'Pending',
      progress: 0
    };
  }

  const data = sheet.getDataRange().getValues();
  return {
    assignedTo: data[0][0] || 'Unassigned',
    dueIn: data[0][1] || 'No due date',
    status: data[0][2] || 'Pending',
    progress: data[0][3] || 0
  };
}

/**
 * Adds comment to dashboard
 * @param {string} dashboardId - Dashboard ID
 * @param {string} text - Comment text
 */
function addComment(dashboardId, text) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName('Comments_' + dashboardId);

  if (!sheet) {
    sheet = ss.insertSheet('Comments_' + dashboardId);
    sheet.appendRow(['Timestamp', 'Author', 'Comment']);
  }

  sheet.appendRow([
    new Date().toISOString(),
    Session.getActiveUser().getEmail(),
    text
  ]);
}

/**
 * Reassigns task to new person
 * @param {string} dashboardId - Dashboard ID
 * @param {string} email - Email to assign to
 */
function reassignTask(dashboardId, email) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Dashboard_' + dashboardId);

  if (sheet) {
    sheet.getRange('A1').setValue(email);
    // Send notification
    GmailApp.sendEmail(email, 'Task Reassigned', 'A task has been reassigned to you.');
  }
}

/**
 * Cancels a task
 * @param {string} dashboardId - Dashboard ID
 */
function cancelTask(dashboardId) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Dashboard_' + dashboardId);

  if (sheet) {
    sheet.getRange('C1').setValue('Cancelled');
  }
}
