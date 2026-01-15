# FORM_CREDITCARD

## Description
Corporate credit card provisioning

## Setup
1. Create spreadsheet: `FORM_CREDITCARD_DATA` in shared drive
2. Run: `clasp create --type webapp --title "FORM_CREDITCARD"`
3. Update Config.gs with SPREADSHEET_ID
4. Run: `clasp push`
5. Deploy as web app

## Form Fields
- Task_ID
- Workflow_ID
- Employee_Name
- Card_Type
- Credit_Limit
- Card_Number_Last4
- Card_Issued_Date
- Accounting_Notes
- Completed_By
- Completion_Date
