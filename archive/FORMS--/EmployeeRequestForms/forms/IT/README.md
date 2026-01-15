# FORM_IT

## Description
IT provisioning: email, computer, phone, software

## Setup
1. Create spreadsheet: `FORM_IT_DATA` in shared drive
2. Run: `clasp create --type webapp --title "FORM_IT"`
3. Update Config.gs with SPREADSHEET_ID
4. Run: `clasp push`
5. Deploy as web app

## Form Fields
- Task_ID
- Workflow_ID
- Employee_Name
- Email_Created
- Email_Address
- Computer_Assigned
- Computer_Serial
- Phone_Assigned
- Phone_Number
- Software_Installed
- Network_Access_Granted
- IT_Notes
- Completed_By
- Completion_Date
