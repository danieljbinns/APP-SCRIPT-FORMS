# Workflow Tracker - Documentation

## Overview

The Workflow Tracker is a reusable system for managing and monitoring all workflow instances across the organization. It provides a centralized dashboard for tracking the status of form submissions, visualizing completion metrics, and taking actions on pending workflows.

**Key Features:**
- Real-time tracking of all workflow instances (requests)
- Comprehensive filtering by workflow type, status, site, requestor, employee name, and date range
- KPI dashboard showing completion rates, average time to complete, and pending counts
- Interactive charts visualizing status distribution, completion times, and trends
- Detailed table view with direct links to individual workflow forms
- Action buttons to view, edit, delay, or cancel workflows
- CSV export for reporting and analysis
- Responsive design (desktop, tablet, mobile)

---

## Files Included

### 1. WorkflowTracker.gs
**Type:** Google Apps Script Backend
**Purpose:** Server-side logic for data retrieval, filtering, KPI calculation, and workflow actions

**Functions:**
- `renderWorkflowTracker()` - Renders the tracker dashboard with server-side data injection
- `getTrackerData()` - Retrieves all workflow instances from spreadsheet
- `getWorkflowTypes()` - Returns list of all workflow types
- `getSiteNames()` - Extracts unique site names from data
- `getRequestorNames()` - Extracts unique requestor names
- `getAssociatedWorkflows()` - Determines which workflows apply to each request based on department/position/equipment
- `getWorkflowCompletionData()` - Gets completion status for a specific workflow (placeholder)
- `filterTrackerData()` - Filters data based on user-selected criteria
- `calculateKPIs()` - Computes dashboard metrics
- `processWorkflowAction()` - Handles cancel/delay/edit actions
- `exportTrackerDataToCSV()` - Exports filtered data to CSV format

### 2. WorkflowTrackerUI.html
**Type:** Google Apps Script HTML Template
**Purpose:** Full-functional UI for the tracker dashboard with real data

**Features:**
- Dynamic filter panel with 6 filter types
- 4 KPI cards with real-time calculations
- 4 interactive charts (Status distribution, Days to complete, By site, Trend over time)
- Sortable table with all workflow instances
- Modal dialogs for actions (cancel, delay, edit)
- Status message notifications
- CSV export functionality
- Fully responsive design

**How It's Used:**
1. Add this to your Google Apps Script project
2. Call `renderWorkflowTracker()` from a doGet() function
3. Deploy as web app
4. Access via the web app URL

### 3. WorkflowTrackerMockup.html
**Type:** Self-Contained HTML File
**Purpose:** Standalone mockup with sample data for UI/UX review and testing

**Features:**
- No server connection required - works standalone
- 9 sample workflow instances showing different statuses
- All interactive features enabled (filters, modals, actions)
- Fully styled and responsive
- Sample data includes various workflow types, sites, and statuses

**How to Use:**
1. Open directly in a web browser
2. No installation or deployment required
3. Interact with filters, buttons, and modals
4. Test the UI/UX before deployment
5. Shows what the dashboard will look like with real data

---

## Data Structure

### Workflow Tracker Data Object
Each workflow instance contains:
```javascript
{
  requestId: "WMAR-20251207-A3F9",      // Unique request identifier
  workflowType: "Credit Card",           // Type of workflow
  employeeName: "John Smith",            // Full name of new employee
  requestorName: "Dan Binns",            // Who submitted the request
  site: "Atlanta",                       // Work location
  department: "Accounting",              // Department
  position: "1001 - Project Manager",    // Job title
  status: "Pending",                     // Current status (Pending, In Progress, Completed, Cancelled, Delayed)
  dateOpened: "2025-12-01",              // When request was created
  dateCompleted: "2025-12-06",           // When workflow completed (or null)
  daysToComplete: 5,                     // Days between open and completion (or null)
  notes: "",                             // Additional notes
  assignedTo: "John Doe"                 // Who is handling this workflow
}
```

### Workflow Types
Automatically determined based on employee attributes:
- **HR Setup** - All employees
- **IT Setup** - If laptop/phone/equipment selected
- **Credit Card** - If in Accounting dept or manager position
- **Fleetio Assignment** - If in Fleet department
- **ADP Supervisor Access** - If manager/supervisor position
- **ADP Manager Access** - If director/head position
- **JONAS Access** - If Accounting/Finance dept
- **SiteDocs Training** - If in Operations/Safety/Fleet
- **30-60-90 Review** - Periodic reviews (scheduled separately)

---

## Filter Options

**Workflow Type Dropdown**
- All, Credit Card, HR Setup, IT Setup, Fleetio Assignment, ADP Supervisor Access, ADP Manager Access, JONAS Access, SiteDocs Training, 30-60-90 Review

**Status Filter**
- Pending: Awaiting action
- In Progress: Currently being processed
- Completed: Finished successfully
- Cancelled: Stopped (can be reactivated)
- Delayed: Paused until a future date

**Site Filter**
- All Sites, Atlanta, Charlotte, Nashville
- (Extracted from Initial Requests sheet)

**Requestor Filter**
- All Requestors
- (Extracted from Initial Requests sheet)

**Employee Name**
- Text search (contains match, case-insensitive)

**Date Range**
- Date From: Filter workflows opened after this date
- Date To: Filter workflows opened before this date

---

## KPI Calculations

### Total Workflows
Count of all workflows matching current filters

### Completion Rate
Percentage of completed workflows: `(Completed / Total) × 100`

### Pending Count
Count of workflows with status = "Pending" or "In Progress"

### Average Days to Complete
Mean days from opened to completed for completed workflows only

### Median Days to Complete
Median days for completed workflows

### Oldest Pending Request
Maximum days since open for pending workflows (to identify overdue items)

---

## Charts

### 1. Status Distribution (Pie/Doughnut Chart)
Shows count of workflows by status
- **Use Case:** Identify bottlenecks and completion progress

### 2. Days to Complete (Bar Chart)
Histogram of completion times in 5-day buckets
- **Use Case:** Understand workflow duration patterns

### 3. Requests by Site (Bar Chart)
Count of workflows per site
- **Use Case:** Compare workload distribution across locations

### 4. Requests Over Time (Line Chart)
Trend of workflow creation over time
- **Use Case:** Identify spikes and workflow volume patterns

---

## Actions Available

### View
Links to the actual workflow form for that request
- URL: `?form=[workflow_type]&id=[request_id]`
- Opens in new window/tab

### Edit
Reopens a workflow form for revision and resubmission
- Preserves original responses
- Allows corrections and updates
- Creates revision record
- Modal prompts for revision notes

### Delay
Pauses a workflow until a specified future date
- Set new deadline
- Provide reason for delay
- Email notification sent when deadline approaches
- Can be rescheduled multiple times

### Cancel
Terminates a workflow (can be reactivated if needed)
- Provide cancellation reason
- Records cancellation timestamp
- Stored for audit trail
- Can be marked "Active" again if needed

---

## Integration with REQUEST_FORMS

### How Workflows Are Associated
1. User submits InitialRequest.html form
2. Server determines applicable workflows based on:
   - Department selected
   - Position/Job Code selected
   - Equipment selections (Laptop, Monitor, Phone, etc.)
3. Each applicable workflow creates a separate tracker entry
4. Department receives email with link to their specific form
5. When department completes their form, status updates in tracker

### Data Flow
```
Initial Request Submission
    ↓
Request ID generated & saved to spreadsheet
    ↓
Associated workflows determined
    ↓
Tracker entries created (one per workflow)
    ↓
Email notifications sent to departments
    ↓
Departments complete forms
    ↓
Tracker status updates per completion
    ↓
Overall request status reflects all completions
```

---

## Setup Instructions

### 1. Deploy WorkflowTracker.gs
```
1. Add WorkflowTracker.gs to your Google Apps Script project
2. Add WorkflowTrackerUI.html to the same project
3. In Code.gs, add entry point:
   function doGetTracker(e) {
     return renderWorkflowTracker();
   }
4. Deploy as new web app:
   - Execute as: Your Account
   - Who has access: Your Organization
5. Copy the web app URL
```

### 2. Add Tracker Link to Initial Request Form
```html
<a href="[TRACKER_WEB_APP_URL]">View Workflow Tracker</a>
```

### 3. Configure in Config.gs
Verify all CONFIG values are correct:
- SPREADSHEET_ID (where tracker data comes from)
- SHEET_NAME (which sheet contains initial requests)
- DEPARTMENTS list
- JOB_CODES configuration
- EMAIL addresses

### 4. Test with Sample Data
1. Open WorkflowTrackerMockup.html in browser
2. Test filters, charts, actions
3. Verify UI matches your requirements
4. Deploy full tracker once approved

---

## Workflow States & Transitions

```
    ┌─────────────────────────────┐
    │   New Workflow (Pending)    │
    └──────────────┬──────────────┘
                   │
          ┌────────┼────────┐
          ↓        ↓        ↓
      [View]   [Edit]   [Delay/Cancel]
          │        │        │
    [View Details] │    [Cancelled/Delayed]
                   │
          ┌────────↓────────┐
          ↓                 ↓
    [In Progress]    [Open for Edit]
       (Being done)        (Revision)
          │                │
          └────────┬───────┘
                   │
                   ↓
          ┌────────────────┐
          │   [Completed]  │
          └────────────────┘
```

---

## KPI Dashboard Best Practices

### Daily Review
- Check "Pending" count
- Identify workflows > 5 days old
- Follow up on overdue items

### Weekly Analysis
- Review "Completion Rate" trend
- Check "Oldest Pending Request"
- Analyze "Days to Complete" average
- Identify which workflow types are slowest

### Performance Targets
- **Completion Rate:** Target 95%+ within SLA
- **Days to Complete:** Target 5-7 days average
- **Pending Age:** No pending > 10 days
- **Completion SLA:** All forms completed within 7 days

---

## Troubleshooting

### Charts Not Loading
- Verify Chart.js CDN is accessible
- Check browser console for errors
- Ensure data is being populated from server

### Filters Not Working
- Check that filter values match data exactly (case-sensitive)
- Verify datepickers are returning correct format
- Check browser console for JavaScript errors

### Modal Actions Not Saving
- Verify server-side functions are implemented (processWorkflowAction)
- Check Google Apps Script execution logs
- Ensure permissions are correct

### Data Not Updating
- Refresh page (F5)
- Check that spreadsheet IDs in Config.gs are correct
- Verify Initial Requests sheet exists and has data

### Slow Performance
- Limit data range (use date filters)
- Archive old workflows to separate sheet
- Optimize spreadsheet with filters/sorts

---

## Future Enhancements

### Phase 2 Improvements
- [ ] Real-time auto-refresh (every 5 minutes)
- [ ] Workflow completion notifications
- [ ] SLA deadline tracking and escalation
- [ ] Department-level performance metrics
- [ ] Employee onboarding progress percentage
- [ ] Integrated notes and comments system
- [ ] Audit log for all workflow changes
- [ ] Email alerts for overdue workflows

### Phase 3 Advanced Features
- [ ] Workflow templates library
- [ ] Custom workflow builder
- [ ] Integration with external systems (ADP, JONAS, Slack)
- [ ] Analytics dashboard with forecasting
- [ ] Mobile app for on-the-go tracking
- [ ] Batch actions (bulk delay, cancel, update)
- [ ] Workflow reassignment between users

---

## Support & Questions

### Common Questions

**Q: Can I add custom workflows?**
A: Yes. Add workflow type to `getWorkflowTypes()` and update `getAssociatedWorkflows()` to define which requests trigger it.

**Q: How do I change workflow statuses?**
A: Update `CONFIG.STATUS` in Config.gs and add new status options to filter dropdowns.

**Q: Can multiple people work on one workflow?**
A: Yes. The "Assigned To" field can be updated to show team members, and notes can track collaboration.

**Q: How long does data persist?**
A: Data stays in the Google Sheet indefinitely. Archive old workflows when sheet gets large.

**Q: Can I export historical data?**
A: Yes. Use "Export CSV" button to export current filtered view, or export entire sheet from Google Sheets.

---

## Document Information

**Version:** 1.0
**Created:** 2025-12-07
**Status:** Ready for Implementation
**Files Included:** 3
- WorkflowTracker.gs (backend logic)
- WorkflowTrackerUI.html (full functional tracker)
- WorkflowTrackerMockup.html (interactive mockup)

