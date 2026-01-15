# FORM_SITEDOCS

## Description
Safety training and documentation management

## Setup
1. Create spreadsheet: `FORM_SITEDOCS_DATA` in shared drive
2. Run: `clasp create --type webapp --title "FORM_SITEDOCS"`
3. Update Config.gs with SPREADSHEET_ID
4. Run: `clasp push`
5. Deploy as web app

## Form Fields
- Task_ID
- Workflow_ID
- Employee_Name
- SiteDocs_User_ID
- Safety_Training_Complete
- Certifications_Uploaded
- Equipment_Training
- Safety_Notes
- Completed_By
- Completion_Date
