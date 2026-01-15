# Export Functionality

## Priority: 🔴 HIGH (P1)

## Overview
Add ability to export workflow data to CSV and Excel formats for reporting, analysis, and backup purposes.

## Business Reason
- Management needs reports for executives
- HR needs data for analysis and audits
- Compliance requires data backups
- External systems need data imports
- Quick wins = high user satisfaction

## Technical Reason
- Data portability
- Integration with external tools
- Offline data access
- Backup and recovery
- Analytics in Excel/Sheets

## Components (Modular)

### 1. Export Engine
**File:** `shared/export-engine.js`
**Dependencies:** None (standalone)
**Size:** ~250 lines

```javascript
const ExportEngine = (function() {
  // Export to CSV
  // Export to JSON
  // Export to Excel (XLSX) - optional with library
  // Customizable columns
  // Data transformation/formatting
})();
```

### 2. Excel Export Module (Optional)
**File:** `shared/excel-export.js`
**Dependencies:** `SheetJS` library (CDN)
**Size:** ~150 lines

```javascript
const ExcelExport = (function() {
  // Advanced Excel features
  // Multiple sheets
  // Styling and formatting
  // Charts and formulas
})();
```

### 3. Export UI Component
**File:** `shared/export-button.js`
**Dependencies:** `export-engine.js`
**Size:** ~100 lines

```javascript
const ExportButton = (function() {
  // Reusable export button with dropdown
  // Format selection (CSV, JSON, XLSX)
  // Column selection modal
})();
```

## Export Formats

### 1. CSV Export (Simple, Universal)
```csv
"Workflow ID","Employee","Position","Email","Hire Date","Status","Progress"
"WF-REQ-20251204-ABC1","John Smith","Manager","john@company.com","2025-12-15","In Progress","3/9"
```

**Pros:**
- Universal compatibility
- Small file size
- Easy to parse
- Works in Excel, Google Sheets, databases

**Cons:**
- No formatting
- Single sheet only
- No formulas

### 2. Excel Export (Advanced)
```javascript
// Multiple sheets, formatting, formulas
Workbook:
  - Sheet 1: "Workflows" (all workflow data)
  - Sheet 2: "Tasks" (detailed task breakdown)
  - Sheet 3: "Statistics" (summary with charts)
```

**Pros:**
- Rich formatting
- Multiple sheets
- Formulas and calculations
- Charts (optional)

**Cons:**
- Requires library (SheetJS ~600KB)
- More complex
- Larger file size

### 3. JSON Export (Developer-Friendly)
```json
[
  {
    "workflowId": "WF-REQ-20251204-ABC1",
    "employee": "John Smith",
    "tasks": [...]
  }
]
```

**Pros:**
- Complete data structure
- Easy to re-import
- API-friendly

**Cons:**
- Not human-readable
- Requires technical knowledge

## Export Features

### Column Selection
```javascript
const exportColumns = {
  workflowId: { label: 'Workflow ID', selected: true },
  employee: { label: 'Employee', selected: true },
  position: { label: 'Position', selected: true },
  email: { label: 'Email', selected: true },
  hireDate: { label: 'Hire Date', selected: true },
  status: { label: 'Status', selected: true },
  tasksComplete: { label: 'Tasks Complete', selected: true },
  tasksTotal: { label: 'Total Tasks', selected: true },
  lastReminder: { label: 'Last Reminder', selected: false },
  reminderCount: { label: 'Reminder Count', selected: false }
};
```

### Data Filtering
- Export current filtered view
- Export all data
- Export selected rows only (with checkboxes)

### Data Transformation
```javascript
function transformForExport(workflow) {
  return {
    ...workflow,
    progress: `${workflow.tasksComplete}/${workflow.tasksTotal}`,
    hireDate: formatDate(workflow.hireDate),
    lastReminder: workflow.lastReminder || 'Never'
  };
}
```

## UI Design

### Export Button (Dropdown)
```html
<div class="export-dropdown">
  <button class="btn btn-secondary dropdown-toggle">
    📥 Export
  </button>
  <div class="dropdown-menu">
    <a onclick="exportCSV()">Export as CSV</a>
    <a onclick="exportExcel()">Export as Excel</a>
    <a onclick="exportJSON()">Export as JSON</a>
    <hr>
    <a onclick="showColumnSelector()">Choose Columns...</a>
  </div>
</div>
```

### Column Selector Modal
```html
<div class="modal" id="column-selector-modal">
  <div class="modal-content">
    <h2>Select Columns to Export</h2>
    <div class="column-list">
      <label><input type="checkbox" checked> Workflow ID</label>
      <label><input type="checkbox" checked> Employee</label>
      <!-- ... more columns ... -->
    </div>
    <div class="modal-actions">
      <button onclick="selectAllColumns()">Select All</button>
      <button onclick="exportWithSelectedColumns()">Export</button>
    </div>
  </div>
</div>
```

## Implementation Steps

### Phase 1: CSV Export (Core) - 4 hours
1. Create `export-engine.js` with CSV functionality (2 hours)
2. Add export button to admin dashboard (1 hour)
3. Test CSV export with various data (1 hour)

### Phase 2: Column Selection - 3 hours
1. Create column selector UI (1.5 hours)
2. Integrate with export engine (1 hour)
3. Test column selection (0.5 hours)

### Phase 3: Excel Export (Optional) - 4 hours
1. Add SheetJS library (0.5 hours)
2. Create `excel-export.js` (2 hours)
3. Add Excel option to dropdown (0.5 hours)
4. Test Excel export (1 hour)

### Phase 4: Advanced Features - 3 hours
1. Add JSON export (1 hour)
2. Add "Export Selected" for checked rows (1 hour)
3. Add export history/logging (1 hour)

**Total Effort (CSV only):** ~7 hours
**Total Effort (All formats):** ~14 hours

## CSV Implementation (Simple)

```javascript
function exportToCSV(data, filename = 'workflows-export.csv') {
  // Define columns
  const headers = ['Workflow ID', 'Employee', 'Position', 'Email', 'Hire Date', 'Status', 'Progress'];

  // Transform data to rows
  const rows = data.map(wf => [
    wf.workflowId,
    wf.employee,
    wf.position,
    wf.email,
    formatDate(wf.hireDate),
    wf.status,
    `${wf.tasksComplete}/${wf.tasksTotal}`
  ]);

  // Build CSV string
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  // Download file
  downloadFile(csv, filename, 'text/csv');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
```

## Excel Implementation (Advanced)

```javascript
// Requires SheetJS library
function exportToExcel(data, filename = 'workflows-export.xlsx') {
  // Create workbook
  const wb = XLSX.utils.book_new();

  // Sheet 1: Workflows
  const wsData = data.map(wf => ({
    'Workflow ID': wf.workflowId,
    'Employee': wf.employee,
    'Position': wf.position,
    'Email': wf.email,
    'Hire Date': wf.hireDate,
    'Status': wf.status,
    'Tasks Complete': wf.tasksComplete,
    'Total Tasks': wf.tasksTotal,
    'Progress %': Math.round((wf.tasksComplete / wf.tasksTotal) * 100)
  }));

  const ws = XLSX.utils.json_to_sheet(wsData);

  // Add column widths
  ws['!cols'] = [
    { wch: 25 }, // Workflow ID
    { wch: 20 }, // Employee
    { wch: 25 }, // Position
    { wch: 30 }, // Email
    { wch: 12 }, // Hire Date
    { wch: 12 }, // Status
    { wch: 8 },  // Tasks Complete
    { wch: 8 },  // Total Tasks
    { wch: 10 }  // Progress %
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Workflows');

  // Sheet 2: Statistics
  const stats = calculateStatistics(data);
  const statsSheet = XLSX.utils.json_to_sheet([stats]);
  XLSX.utils.book_append_sheet(wb, statsSheet, 'Statistics');

  // Write file
  XLSX.writeFile(wb, filename);
}
```

## Integration Points

### Admin Dashboard
```html
<!-- Add export button to action bar -->
<div class="filter-actions">
  <button class="btn btn-primary" onclick="applyFilters()">Apply Filters</button>
  <button class="btn btn-secondary" onclick="clearFilters()">Clear</button>
  <button class="btn btn-secondary" onclick="exportCSV()">📥 Export CSV</button>
</div>
```

### Workflow Manager
```javascript
// Add export helper to workflow manager
WorkflowManager.exportToCSV = function(workflows) {
  ExportEngine.toCSV(workflows, 'workflows-export.csv');
};

WorkflowManager.exportToExcel = function(workflows) {
  ExcelExport.create(workflows, 'workflows-export.xlsx');
};
```

## Testing Requirements
- CSV exports correctly formatted
- Excel opens without errors
- All data fields exported
- Special characters handled (quotes, commas)
- Large datasets (100+ workflows) work
- Column selection works
- File downloads successfully
- Works across browsers (Chrome, Firefox, Safari, Edge)

## Success Metrics
- Users can export data successfully
- CSV opens in Excel/Google Sheets
- Excel file has correct formatting
- No data loss during export
- Fast export (< 2 seconds for 100 rows)

## Files to Create
- `shared/export-engine.js`
- `shared/excel-export.js` (if using Excel)
- `shared/export-button.js`

## Files to Modify
- `admin-dashboard.html` (add export button)
- `shared/workflow-manager.js` (add export helpers)

## External Dependencies
- **SheetJS (optional)**: For Excel export
  - CDN: `https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js`
  - Size: ~600KB
  - License: Apache 2.0

## Risk Assessment
**Low Risk** - Read-only operation, no data modification. Easy to test and verify.

## Browser Compatibility
- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- IE11: ⚠️ May need polyfill for Blob

## Performance Considerations
- 100 workflows: < 1 second
- 1,000 workflows: < 3 seconds
- 10,000 workflows: Consider chunking or server-side export

## Future Enhancements
- Scheduled exports (daily/weekly)
- Email export results
- Export to Google Sheets directly
- Export templates (saved column configurations)
- PDF export (for reports)
