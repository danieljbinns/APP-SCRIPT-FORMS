/**
 * FORM_HR - Configuration File
 */

const CONFIG = {
  SHARED_DRIVE_ID: '0AOOOWlqzpUNVUk9PVA',
  SPREADSHEET_ID: '', // TODO: Fill after creating spreadsheet
  SHEET_NAME: 'HR Setup Tasks',
  WORKFLOW_TRACKING_SPREADSHEET_ID: '',
  WORKFLOW_TASKS_SHEET: 'Workflow_Tasks',
  FORM_NAME: 'HR Setup',
  TASK_TYPE: 'HR',
  DESCRIPTION: 'HR onboarding tasks: benefits, I-9, emergency contacts',
  GROUP_EMAIL: 'grp.forms.hr@team-group.com',
  FORM_FIELDS: [
    'Task_ID', 'Workflow_ID', 'Employee_Name', 'Hire_Date', 'Benefits_Enrollment_Complete', 'I9_Verification_Complete', 'Emergency_Contacts_Added', 'HR_Notes', 'Completed_By', 'Completion_Date'
  ],
  TASK_ID_PREFIX: 'TASK-HR',
  COMPANY_NAME: 'Team Group Companies',
  LOGO_URL: 'https://i.imgur.com/yQfP3TE.png',
  TASK_STATUS: {
    OPEN: 'Open',
    IN_PROGRESS: 'In Progress',
    COMPLETE: 'Complete',
    CANCELLED: 'Cancelled'
  }
};
