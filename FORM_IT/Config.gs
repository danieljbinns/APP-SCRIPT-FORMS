/**
 * FORM_IT - Configuration File
 */

const CONFIG = {
  SHARED_DRIVE_ID: '0AOOOWlqzpUNVUk9PVA',
  SPREADSHEET_ID: '', // TODO: Fill after creating spreadsheet
  SHEET_NAME: 'IT Setup Tasks',
  WORKFLOW_TRACKING_SPREADSHEET_ID: '',
  WORKFLOW_TASKS_SHEET: 'Workflow_Tasks',
  FORM_NAME: 'IT Setup',
  TASK_TYPE: 'IT',
  DESCRIPTION: 'IT provisioning: email, computer, phone, software',
  GROUP_EMAIL: 'grp.forms.it@team-group.com',
  FORM_FIELDS: [
    'Task_ID', 'Workflow_ID', 'Employee_Name', 'Email_Created', 'Email_Address', 'Computer_Assigned', 'Computer_Serial', 'Phone_Assigned', 'Phone_Number', 'Software_Installed', 'Network_Access_Granted', 'IT_Notes', 'Completed_By', 'Completion_Date'
  ],
  TASK_ID_PREFIX: 'TASK-IT',
  COMPANY_NAME: 'Team Group Companies',
  LOGO_URL: 'https://i.imgur.com/yQfP3TE.png',
  TASK_STATUS: {
    OPEN: 'Open',
    IN_PROGRESS: 'In Progress',
    COMPLETE: 'Complete',
    CANCELLED: 'Cancelled'
  }
};
