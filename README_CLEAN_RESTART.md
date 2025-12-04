# REQUEST_FORMS - Clean Restart

## Overview
Fresh, minimal implementation of the Initial Request Form only. Clean separation of concerns with all configuration in one file.

## File Structure (5 Files Total)

```
REQUEST_FORMS/
├── Config.gs              - All configuration constants
├── Setup.gs               - Spreadsheet & folder creation functions
├── Code.gs                - All application logic/functions
├── Styles.html            - All CSS styling
├── InitialRequest.html    - Form HTML structure
└── appsscript.json        - Apps Script configuration
```

## Setup Instructions

### Step 1: Run Setup Function

1. Open Apps Script Editor
2. Run the `runSetup()` function from Setup.gs
3. Check the execution log for generated IDs
4. Copy the IDs displayed in the log

### Step 2: Update Config.gs

Update these two values in Config.gs with the IDs from Step 1:

```javascript
SPREADSHEET_ID: 'paste-spreadsheet-id-here',
MAIN_FOLDER_ID: 'paste-folder-id-here',
```

### Step 3: Deploy

```bash
clasp push
clasp deploy --description "Clean restart - Initial form only"
```

### Step 4: Configure Web App

1. In Apps Script Editor → Deploy → Manage deployments
2. Click "New deployment"
3. Type: Web app
4. Execute as: User accessing the web app
5. Who has access: Anyone at robinsonsolutions.com
6. Click "Deploy"
7. Copy the web app URL

### Step 5: Test Configuration

Run the `testConfig()` function in Setup.gs to verify everything is connected properly.

## Features

✅ **Clean Separation of Concerns**
- Config.gs: All constants
- Code.gs: All functions (references Config.gs only)
- Styles.html: All CSS
- InitialRequest.html: HTML structure only

✅ **Initial Request Form**
- Gatekeeper question (must answer "Yes" to proceed)
- Requester information
- New employee details
- Site/job code synced dropdowns
- Department selection
- Equipment checkboxes

✅ **Unique Request ID**
- Format: WMAR-YYYYMMDD-XXXX
- Example: WMAR-20250127-A3F9

✅ **Google Sheet Integration**
- Auto-creates spreadsheet with proper headers
- Saves all form data
- Includes timestamp and request ID

✅ **Server-Side Rendering**
- Fast page loads
- Data injected via scriptlets
- No client-side API calls for initial load

## Form Fields

The form captures the following data (19 fields total):

1. Request ID (auto-generated)
2. Submission Timestamp (auto-generated)
3. Requester Name
4. Requester Email
5. Requester Phone
6. First Name
7. Last Name
8. Hire Date
9. Site Name
10. Department
11. Position/Title (job code)
12. Hourly or Salary
13. Reporting Manager Email
14. Laptop (checkbox)
15. Monitor (checkbox)
16. Keyboard (checkbox)
17. Mouse (checkbox)
18. Phone (checkbox)
19. Workflow Status (auto-set to "Submitted")

## Configuration Options

All configurable values are in Config.gs:

- **SPREADSHEET_ID**: Target Google Sheet
- **SHEET_NAME**: Name of the sheet tab
- **MAIN_FOLDER_ID**: Drive folder for documents
- **COMPANY_NAME**: Company branding
- **LOGO_URL**: Logo image URL
- **FORM_FIELDS**: Column headers (must match form data)
- **JOB_CODES**: Site → Job mappings
- **DEPARTMENTS**: Available departments
- **EQUIPMENT**: Equipment options
- **STATUS**: Workflow statuses
- **EMAILS**: Email addresses for notifications

## Next Steps (Future Enhancements)

- Add email notifications after form submission
- Create sub-forms for HR, IT, etc.
- Add Master Dashboard sheet
- Implement PDF generation
- Add workflow status tracking

## Support

For questions or issues, contact: dbinns@robinsonsolutions.com

---

**Version:** 2.0.0-clean
**Date:** 2025-01-27
**Status:** Minimal viable implementation - Initial form only
