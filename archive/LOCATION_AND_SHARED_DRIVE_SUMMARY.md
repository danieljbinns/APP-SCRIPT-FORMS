# REQUEST_FORMS - Location and Shared Drive Configuration Summary

**Date:** December 4, 2025
**Status:** ✅ Complete - All files moved and configured for Google Shared Drive

---

## Project Location

### Correct Local Path
```
P:\Projects\Company\REQUEST_FORMS_DOCS
```

All form projects and the main REQUEST_FORMS application are now stored in this directory.

---

## Directory Structure

```
REQUEST_FORMS_DOCS/
├── REQUEST_FORMS (Main Project)
│   ├── .clasp.json
│   ├── appsscript.json
│   ├── Config.gs ✓ Updated with SHARED_DRIVE_ID
│   ├── Code.gs
│   ├── Setup.gs ✓ Creates spreadsheets in Shared Drive
│   ├── InitialRequest.html
│   └── Styles.html
│
├── FORM_HR/
├── FORM_IT/
├── FORM_FLEETIO/
├── FORM_CREDITCARD/
├── FORM_REVIEW306090/
├── FORM_ADP_SUPERVISOR/
├── FORM_ADP_MANAGER/
├── FORM_JONAS/
├── FORM_SITEDOCS/
│   Each containing:
│   ├── .clasp.json
│   ├── appsscript.json
│   ├── Config.gs ✓ Has SHARED_DRIVE_ID
│   ├── Code.gs
│   ├── Setup.gs ✓ Creates spreadsheets in Shared Drive
│   ├── Form.html ✓ Beautiful UI
│   ├── Styles.html ✓ Beautiful UI
│   └── README.md
│
├── Documentation/
│   ├── ARCHITECTURE.md
│   ├── WORKFLOW_ARCHITECTURE.md
│   ├── DEPLOYMENT_GUIDE.md
│   ├── IMPLEMENTATION_SUMMARY.md
│   ├── FORMS_UI_SUMMARY.md
│   └── FORM_PREVIEW.html
│
└── Scripts/
    ├── create_form_projects.py
    ├── add_setup_to_forms.py
    └── copy_pretty_forms.py
```

---

## Google Shared Drive Configuration

### Shared Drive Details
- **Name:** Team Group Companies
- **ID:** `0AOOOWlqzpUNVUk9PVA`
- **Purpose:** Central storage for all REQUEST_FORMS spreadsheets

### Spreadsheets That Will Be Created in Shared Drive

When you run `Setup.runSetup()` in each project, these spreadsheets will be automatically created **in the Shared Drive**:

#### REQUEST_FORMS Main Project
1. **REQUEST_FORMS - Initial Requests**
   - Sheet: Initial Requests
   - Contains: All initial workflow requests
   - Headers: Request ID, Submission Timestamp, Requester Name, etc.

2. **REQUEST_FORMS - Workflow Tracking**
   - Sheet: Workflow_Tasks
   - Contains: Status of all tasks across workflows
   - Headers: Workflow_ID, Task_Type, Task_ID, Status, Form_URL, Created_Date, Completed_Date, Completed_By

#### Sub-Form Projects (9 spreadsheets)
Each form creates its own spreadsheet in the Shared Drive:

1. **HR Setup - Data**
   - Shared with: grp.forms.hr@team-group.com

2. **IT Setup - Data**
   - Shared with: grp.forms.it@team-group.com

3. **Fleetio - Vehicle Assignment - Data**
   - Shared with: grp.forms.fleetio@team-group.com

4. **Credit Card Request - Data**
   - Shared with: grp.forms.creditcard@team-group.com

5. **30-60-90 Day Review - Data**
   - Shared with: grp.forms.review306090@team-group.com

6. **ADP Supervisor Setup - Data**
   - Shared with: grp.forms.adp.supervisor@team-group.com

7. **ADP Manager Setup - Data**
   - Shared with: grp.forms.adp.manager@team-group.com

8. **JONAS Project Assignment - Data**
   - Shared with: grp.forms.jonas@team-group.com

9. **SiteDocs Safety Training - Data**
   - Shared with: grp.forms.sitedocs@team-group.com

---

## How Setup.gs Works for Shared Drive

### Main REQUEST_FORMS Setup.gs

```javascript
function createSpreadsheet() {
  // Create spreadsheet
  const ss = SpreadsheetApp.create('REQUEST_FORMS - Initial Requests');
  const spreadsheetId = ss.getId();

  // MOVE TO SHARED DRIVE IMMEDIATELY
  const file = DriveApp.getFileById(spreadsheetId);
  const sharedDrive = DriveApp.getFolderById(CONFIG.SHARED_DRIVE_ID);
  file.moveTo(sharedDrive);

  // Configure sheet...
  return spreadsheetId;
}
```

### Sub-Form Setup.gs (Same Pattern)

```javascript
function createSpreadsheet() {
  // Create spreadsheet
  const ss = SpreadsheetApp.create(CONFIG.FORM_NAME + ' - Data');
  const spreadsheetId = ss.getId();

  // MOVE TO SHARED DRIVE IMMEDIATELY
  const file = DriveApp.getFileById(spreadsheetId);
  const sharedDrive = DriveApp.getFolderById(CONFIG.SHARED_DRIVE_ID);
  file.moveTo(sharedDrive);

  // Share with Google Group
  DriveApp.getFileById(spreadsheetId).addEditor(CONFIG.GROUP_EMAIL);

  // Configure sheet...
  return spreadsheetId;
}
```

---

## Key Configuration Changes

### Config.gs Updates (All Projects)

**Added:**
```javascript
SHARED_DRIVE_ID: '0AOOOWlqzpUNVUk9PVA', // Team Group Companies Shared Drive
```

**REQUEST_FORMS Main Config.gs Also Has:**
```javascript
WORKFLOW_TRACKING_SPREADSHEET_ID: '', // Populated by Setup.gs
WORKFLOW_TASKS_SHEET: 'Workflow_Tasks',

WORKFLOW_ID_PREFIX: 'WF-REQ',

TASK_TYPES: {
  HR: 'HR',
  IT: 'IT',
  FLEETIO: 'FLEETIO',
  // ... etc
},

EMAILS: {
  HR: 'grp.forms.hr@team-group.com',
  IT: 'grp.forms.it@team-group.com',
  // ... etc
}
```

---

## Verification Steps

### How to Verify Shared Drive Storage

After running Setup.gs in any project:

1. Open the created spreadsheet URL (shown in logs)
2. Look at the breadcrumb path at the top
3. Should show: **Team Group Companies > [Spreadsheet Name]**
4. Or check the "Shared with me" section vs "Shared drives" section

### Test Config Function

Each Setup.gs includes a `testConfig()` function:

```javascript
function testConfig() {
  // Checks:
  // - Spreadsheet accessible
  // - Sheet exists
  // - Shared Drive accessible
  // - File is in Shared Drive
}
```

Run this after updating Config.gs with spreadsheet IDs.

---

## Migration Complete

### ✅ What Was Done

1. **Moved all files** from `P:\Projects\Company\WMAR_v2` to `P:\Projects\Company\REQUEST_FORMS_DOCS`
2. **Created 9 form projects** in the correct location
3. **Updated all Setup.gs files** to create spreadsheets in Shared Drive (not My Drive)
4. **Updated all Config.gs files** with SHARED_DRIVE_ID
5. **Added WorkflowUtils.gs** for workflow tracking (in WMAR_v2, needs to be copied)
6. **Applied beautiful UI** to all 9 form projects

### 📋 What's Ready

- All local files are in correct location
- All Setup.gs files will create spreadsheets in Shared Drive
- All Config.gs files have SHARED_DRIVE_ID configured
- All forms have beautiful gradient UI
- Workflow tracking architecture is ready

### 🚀 Next Steps (Manual)

1. **For each project** (REQUEST_FORMS + 9 sub-forms):
   ```bash
   cd "P:\Projects\Company\REQUEST_FORMS_DOCS\[PROJECT]"
   clasp create --title "[PROJECT_NAME]" --type webapp
   ```

2. **Run Setup.gs** in Apps Script editor for each project:
   - Opens browser to script.google.com
   - Run `Setup.runSetup()`
   - Copy spreadsheet IDs from logs

3. **Update Config.gs** with spreadsheet IDs

4. **Push code:**
   ```bash
   clasp push
   ```

5. **Deploy as web app:**
   ```bash
   clasp deploy
   ```

---

## Summary

**All spreadsheets will now be created in the Google Shared Drive** (`Team Group Companies`) instead of individual user's My Drive. This ensures:

- ✅ Centralized data storage
- ✅ Team-wide access
- ✅ Proper sharing with Google Groups
- ✅ No orphaned spreadsheets in personal drives
- ✅ Easy backup and management

**Location:** All code is now in `P:\Projects\Company\REQUEST_FORMS_DOCS` (not WMAR_v2)
