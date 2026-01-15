# Admin Dashboard & Workflow Management System

Complete guide for the admin dashboard, workflow management module, and reminder notification system.

## Table of Contents

1. [Overview](#overview)
2. [Admin Dashboard Features](#admin-dashboard-features)
3. [Workflow Management Module](#workflow-management-module)
4. [Reminder System](#reminder-system)
5. [Backend Integration](#backend-integration)
6. [Usage Examples](#usage-examples)

---

## Overview

The Admin Dashboard system provides comprehensive tools for managing workflows, tracking progress, and sending automated reminder notifications. The system is built with modularity in mind and can be adapted for any workflow or form type.

### Key Features

- **Real-time Dashboard**: View all workflows with live statistics
- **Advanced Filtering**: Filter by status, type, date range, and search
- **Sortable Columns**: Click column headers to sort data
- **Manual Reminders**: Send reminder emails to individual workflows
- **Bulk Reminders**: Send reminders to multiple workflows at once
- **Automatic Reminders**: Schedule automatic reminders based on configurable intervals
- **Theme Toggle**: Accessible light/dark mode support
- **Reusable Module**: Can be used across different projects and workflow types

---

## Admin Dashboard Features

### Accessing the Dashboard

Open `admin-dashboard.html` to access the admin interface.

### Dashboard Sections

#### 1. Statistics Cards

Quick overview of workflow statuses:
- **Total Workflows**: Count of all workflows in the system
- **Open**: Workflows with no completed tasks
- **In Progress**: Workflows with some completed tasks
- **Complete**: All tasks finished
- **Overdue**: Workflows past their target date

#### 2. Filters Section

**Available Filters:**
- **Search**: Search by name, workflow ID, email, or position
- **Status**: Filter by Open, In Progress, Complete, or Overdue
- **Form Type**: Filter by specific form types (HR, IT, Fleetio, etc.)
- **Date Range**: Filter workflows by creation date

**Filter Actions:**
- **Apply Filters**: Apply current filter selections
- **Clear**: Reset all filters
- **Send Overdue Reminders**: Send bulk reminders to all overdue workflows

#### 3. Workflows Table

**Columns:**
- **Workflow ID**: Unique identifier (clickable to sort)
- **Employee**: Employee name and email
- **Position**: Job title/role
- **Date**: Creation date and hire date
- **Status**: Current workflow status with color coding
- **Progress**: Tasks completed vs total (percentage)
- **Actions**: View and Remind buttons

**Sorting:**
- Click any column header to sort
- Click again to reverse sort order
- Sort indicator shows current column and direction

#### 4. Actions

**Per-Workflow Actions:**
- **View**: Navigate to workflow detail page
- **Remind**: Open reminder modal to send custom reminder

**Bulk Actions:**
- **Send Overdue Reminders**: Automatically sends reminders to all overdue workflows

### Reminder Modal

When clicking "Remind" on a workflow:

1. Modal displays workflow information
2. Optional custom message field
3. Click "Send Reminder" to send email
4. Tracks last reminder date and count

---

## Workflow Management Module

### Overview

The `workflow-manager.js` module provides a reusable JavaScript API for managing workflows and tasks.

### Initialization

```javascript
// Initialize with default config
WorkflowManager.init();

// Initialize with custom config
WorkflowManager.init({
  reminderIntervals: [24, 48, 168], // hours
  overdueThreshold: 0, // days
  storageKey: 'workflows',
  apiEndpoint: 'https://your-backend-api.com' // optional
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `reminderIntervals` | Array | `[24, 48, 168]` | Hours between reminder escalations |
| `overdueThreshold` | Number | `0` | Days before target date to mark overdue |
| `storageKey` | String | `'workflows'` | localStorage key for storing data |
| `apiEndpoint` | String | `null` | Backend API URL (optional) |

### Core Functions

#### Workflow Management

```javascript
// Get all workflows
const workflows = await WorkflowManager.getAllWorkflows();

// Get specific workflow
const workflow = await WorkflowManager.getWorkflow('WF-REQ-20251204-ABC1');

// Create new workflow
const newWorkflow = await WorkflowManager.createWorkflow({
  employee: 'John Smith',
  position: 'Manager',
  email: 'john.smith@company.com',
  hireDate: '2025-12-15',
  tasksTotal: 9,
  tasks: [...]
});

// Update workflow
await WorkflowManager.updateWorkflow('WF-REQ-20251204-ABC1', {
  status: 'In Progress',
  tasksComplete: 5
});

// Update task status
await WorkflowManager.updateTaskStatus('WF-REQ-20251204-ABC1', 'HR', 'Complete');
```

#### Filtering and Sorting

```javascript
// Filter workflows
const filtered = WorkflowManager.filterWorkflows(workflows, {
  search: 'john',
  status: 'In Progress',
  type: 'HR',
  dateFrom: '2025-12-01',
  dateTo: '2025-12-31',
  customFilter: (wf) => wf.position.includes('Manager')
});

// Sort workflows
const sorted = WorkflowManager.sortWorkflows(workflows, 'date', 'desc');
```

#### Reminder System

```javascript
// Check if workflow needs reminder
const needs = WorkflowManager.needsReminder(workflow);

// Send single reminder
await WorkflowManager.sendReminder('WF-REQ-20251204-ABC1', 'Custom message here');

// Send bulk reminders
const results = await WorkflowManager.sendBulkReminders(
  ['WF-REQ-20251204-ABC1', 'WF-REQ-20251204-ABC2'],
  'Please complete your tasks'
);

// Get workflows needing reminders
const workflowsToRemind = await WorkflowManager.getWorkflowsNeedingReminders();

// Automatic reminder check (run on interval)
const reminderResults = await WorkflowManager.checkAndSendReminders();
```

#### Statistics

```javascript
// Get workflow statistics
const stats = await WorkflowManager.getStatistics();
/*
Returns:
{
  total: 10,
  open: 3,
  inProgress: 4,
  complete: 2,
  overdue: 1,
  needingReminders: 2
}
*/
```

#### Utilities

```javascript
// Generate unique workflow ID
const workflowId = WorkflowManager.generateWorkflowId('WF-REQ');
// Returns: WF-REQ-20251204-A7F3

// Calculate workflow status
const status = WorkflowManager.calculateWorkflowStatus(workflow);
// Returns: 'Open' | 'In Progress' | 'Complete' | 'Overdue'
```

---

## Reminder System

### How Reminders Work

#### Automatic Reminders

1. **First Reminder**: Sent 7 days before target/hire date
2. **Escalation**: Follow configured intervals (24h, 48h, 7 days)
3. **Overdue**: Immediate reminders for overdue workflows
4. **Tracking**: Last reminder date and count tracked per workflow

#### Reminder Logic

A workflow needs a reminder if:
- Status is NOT "Complete"
- AND one of:
  - Target date has passed (overdue)
  - First reminder threshold reached (7 days before)
  - Time since last reminder exceeds next interval

#### Reminder Intervals

Default escalation schedule:
1. **First reminder**: 7 days before hire date
2. **Second reminder**: 24 hours after first
3. **Third reminder**: 48 hours after second
4. **Subsequent**: 7 days (168 hours) between each

Configure custom intervals:
```javascript
WorkflowManager.init({
  reminderIntervals: [12, 24, 48, 72, 168] // hours
});
```

### Manual Reminders

Send reminders through:
1. **Admin Dashboard**: Click "Remind" button on any workflow
2. **API Call**:
```javascript
await WorkflowManager.sendReminder(workflowId, customMessage);
```

### Bulk Reminders

Send to multiple workflows:
1. **Dashboard**: Click "Send Overdue Reminders" button
2. **API Call**:
```javascript
const workflowIds = ['WF-001', 'WF-002', 'WF-003'];
await WorkflowManager.sendBulkReminders(workflowIds, 'Urgent: Please complete');
```

### Email Template

Reminder emails include:
- Workflow details (ID, employee, position, hire date)
- Urgency indicator (days until/since hire date)
- List of incomplete tasks
- Custom message (if provided)
- Link to view workflow
- Professional HTML formatting

---

## Backend Integration

### Google Apps Script Backend

The `ReminderService.gs` file provides server-side reminder functionality.

#### Setup Steps

1. **Copy to Google Apps Script Project**:
   - Open your Apps Script project
   - Create new file: `ReminderService.gs`
   - Paste the code

2. **Configure Spreadsheet**:
   - Create sheet named "Workflows" with columns:
     - Workflow ID
     - Employee
     - Position
     - Email
     - Hire Date
     - Status
     - Tasks Total
     - Tasks Complete
     - Last Reminder
     - Reminder Count
     - Tasks (JSON)

3. **Set Up Automatic Reminders**:
   ```javascript
   // Run once to create daily trigger
   setupAutomaticReminderTrigger();
   ```

4. **Deploy as Web App** (for manual reminders):
   - Click "Deploy" > "New deployment"
   - Type: "Web app"
   - Execute as: "Me"
   - Who has access: "Anyone"
   - Copy deployment URL

5. **Configure Frontend**:
   ```javascript
   WorkflowManager.init({
     apiEndpoint: 'YOUR_DEPLOYMENT_URL'
   });
   ```

#### Backend Functions

```javascript
// Manual reminder
function sendManualReminder(workflowId, customMessage)

// Bulk reminders
function sendBulkReminders(workflowIds, customMessage)

// Automatic check (triggered daily)
function checkAndSendAutomaticReminders()

// Setup trigger
function setupAutomaticReminderTrigger()
```

#### Email Configuration

Customize in `REMINDER_CONFIG`:
```javascript
const REMINDER_CONFIG = {
  REMINDER_INTERVALS: [24, 48, 168],
  OVERDUE_THRESHOLD: 0,
  FROM_NAME: 'Your Company Name',
  REPLY_TO: 'noreply@yourcompany.com',
  WORKFLOW_SHEET_NAME: 'Workflows',
  REMINDER_LOG_SHEET_NAME: 'Reminder_Log'
};
```

### API Endpoints

When deployed as web app, supports:

**POST /doPost**
```json
{
  "action": "sendReminder",
  "workflowId": "WF-REQ-20251204-ABC1",
  "customMessage": "Please complete ASAP"
}
```

```json
{
  "action": "sendBulkReminders",
  "workflowIds": ["WF-001", "WF-002"],
  "customMessage": "Reminder text"
}
```

---

## Usage Examples

### Example 1: Basic Setup

```javascript
// Initialize the workflow manager
WorkflowManager.init();

// Create a new workflow
const workflow = await WorkflowManager.createWorkflow({
  employee: 'Jane Doe',
  position: 'Sales Manager',
  email: 'jane.doe@company.com',
  hireDate: '2025-12-20',
  tasksTotal: 5,
  tasks: [
    { id: 'HR', name: 'HR Setup', status: 'Open' },
    { id: 'IT', name: 'IT Setup', status: 'Open' },
    { id: 'OFFICE', name: 'Office Setup', status: 'Open' },
    { id: 'TRAINING', name: 'Training', status: 'Open' },
    { id: 'WELCOME', name: 'Welcome Meeting', status: 'Open' }
  ]
});

console.log('Created workflow:', workflow.workflowId);
```

### Example 2: Filter and Display

```javascript
// Get all workflows
const allWorkflows = await WorkflowManager.getAllWorkflows();

// Filter for overdue HR workflows
const filtered = WorkflowManager.filterWorkflows(allWorkflows, {
  status: 'Overdue',
  type: 'HR'
});

// Sort by hire date
const sorted = WorkflowManager.sortWorkflows(filtered, 'hireDate', 'asc');

// Display results
sorted.forEach(wf => {
  console.log(`${wf.employee} - ${wf.hireDate} - ${wf.status}`);
});
```

### Example 3: Automatic Reminder System

```javascript
// Check for workflows needing reminders
const needingReminders = await WorkflowManager.getWorkflowsNeedingReminders();

console.log(`Found ${needingReminders.length} workflows needing reminders`);

// Send automatic reminders
const results = await WorkflowManager.checkAndSendReminders();

results.forEach(result => {
  if (result.success) {
    console.log(`✓ Sent reminder for ${result.workflowId}`);
  } else {
    console.error(`✗ Failed for ${result.workflowId}: ${result.error}`);
  }
});
```

### Example 4: Custom Workflow Type

```javascript
// Initialize for a different workflow type
WorkflowManager.init({
  storageKey: 'equipment-requests',
  reminderIntervals: [48, 96, 168], // Different intervals
  overdueThreshold: -5 // Allow 5 days grace period
});

// Create equipment request workflow
const equipmentWorkflow = await WorkflowManager.createWorkflow({
  employee: 'Bob Johnson',
  position: 'Field Tech',
  email: 'bob.j@company.com',
  targetDate: '2025-12-10',
  tasksTotal: 3,
  tasks: [
    { id: 'LAPTOP', name: 'Laptop Procurement', status: 'Open' },
    { id: 'PHONE', name: 'Phone Setup', status: 'Open' },
    { id: 'VPN', name: 'VPN Access', status: 'Open' }
  ]
});
```

### Example 5: Integration with Dashboard

```html
<!-- In your HTML -->
<script src="shared/workflow-manager.js"></script>
<script>
  // Initialize
  WorkflowManager.init({
    apiEndpoint: 'https://script.google.com/your-deployment-id/exec'
  });

  // Load and display workflows
  async function loadDashboard() {
    const workflows = await WorkflowManager.getAllWorkflows();
    const stats = await WorkflowManager.getStatistics(workflows);

    // Update stats display
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-open').textContent = stats.open;
    document.getElementById('stat-complete').textContent = stats.complete;

    // Render table
    renderWorkflowTable(workflows);
  }

  // Send reminder
  async function sendWorkflowReminder(workflowId) {
    try {
      await WorkflowManager.sendReminder(workflowId, 'Please complete ASAP');
      alert('Reminder sent successfully!');
    } catch (error) {
      alert('Failed to send reminder: ' + error.message);
    }
  }

  loadDashboard();
</script>
```

---

## Accessibility Features

### Theme Toggle

All pages include light/dark mode toggle:
- **Keyboard Accessible**: Tab to toggle, Enter/Space to activate
- **Persistent**: Preference saved to localStorage
- **Screen Reader**: Proper ARIA labels
- **Reduced Motion**: Respects prefers-reduced-motion

### Dashboard Accessibility

- **Keyboard Navigation**: All controls accessible via keyboard
- **Focus Indicators**: Clear focus states on interactive elements
- **Color Contrast**: WCAG AA compliant color combinations
- **Screen Reader Support**: Proper semantic HTML and ARIA labels

---

## Best Practices

### 1. Regular Monitoring

- Check admin dashboard daily
- Review overdue workflows
- Send timely reminders

### 2. Customize Reminders

- Add context-specific messages
- Reference specific incomplete tasks
- Include escalation contact info

### 3. Interval Configuration

- Adjust based on workflow urgency
- Shorter intervals for critical workflows
- Longer intervals for routine processes

### 4. Data Backup

- Regularly export workflow data
- Keep reminder logs for auditing
- Back up configuration settings

### 5. Performance

- Filter data before rendering large lists
- Use pagination for 100+ workflows
- Cache statistics for faster loading

---

## Troubleshooting

### Reminders Not Sending

1. Check backend configuration
2. Verify email addresses are valid
3. Check Apps Script execution logs
4. Ensure triggers are set up correctly

### Filter Not Working

1. Clear browser cache
2. Check console for JavaScript errors
3. Verify data format in storage/backend

### Stats Not Updating

1. Refresh the page
2. Check workflow data integrity
3. Verify status calculation logic

---

## Future Enhancements

Potential additions:
- Export to CSV/Excel
- Advanced reporting and analytics
- Custom reminder templates
- Workflow templates
- Mobile app integration
- Webhook support for external systems

---

## Support

For questions or issues:
1. Check this documentation
2. Review code comments
3. Check browser console for errors
4. Contact your system administrator
