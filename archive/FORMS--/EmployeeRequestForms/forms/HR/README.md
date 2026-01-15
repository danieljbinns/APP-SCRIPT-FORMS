# FORM_HR

## Description
HR onboarding tasks: benefits, I-9, emergency contacts

## Setup
1. Create spreadsheet: `FORM_HR_DATA` in shared drive
2. Run: `clasp create --type webapp --title "FORM_HR"`
3. Update Config.gs with SPREADSHEET_ID
4. Run: `clasp push`
5. Deploy as web app

## Form Fields
- Task_ID
- Workflow_ID
- Employee_Name
- Hire_Date
- Benefits_Enrollment_Complete
- I9_Verification_Complete
- Emergency_Contacts_Added
- HR_Notes
- Completed_By
- Completion_Date
