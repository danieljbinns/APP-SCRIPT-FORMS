# FORM_ADP_SUPERVISOR

## Description
ADP supervisor-level permissions setup

## Setup
1. Create spreadsheet: `FORM_ADP_SUPERVISOR_DATA` in shared drive
2. Run: `clasp create --type webapp --title "FORM_ADP_SUPERVISOR"`
3. Update Config.gs with SPREADSHEET_ID
4. Run: `clasp push`
5. Deploy as web app

## Form Fields
- Task_ID
- Workflow_ID
- Employee_Name
- ADP_User_ID
- Supervisor_Role_Assigned
- Access_Level
- Training_Completed
- Payroll_Notes
- Completed_By
- Completion_Date
