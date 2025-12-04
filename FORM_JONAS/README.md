# FORM_JONAS

## Description
JONAS construction ERP system access

## Setup
1. Create spreadsheet: `FORM_JONAS_DATA` in shared drive
2. Run: `clasp create --type webapp --title "FORM_JONAS"`
3. Update Config.gs with SPREADSHEET_ID
4. Run: `clasp push`
5. Deploy as web app

## Form Fields
- Task_ID
- Workflow_ID
- Employee_Name
- JONAS_User_ID
- Access_Level
- Modules_Enabled
- Training_Completed
- Accounting_Notes
- Completed_By
- Completion_Date
