/**
 * FORM_JONAS - Configuration File
 */

const CONFIG = {
  SHARED_DRIVE_ID: '0AOOOWlqzpUNVUk9PVA',
  SPREADSHEET_ID: '', // TODO: Fill after creating spreadsheet
  SHEET_NAME: 'JONAS ERP Access Tasks',
  WORKFLOW_TRACKING_SPREADSHEET_ID: '',
  WORKFLOW_TASKS_SHEET: 'Workflow_Tasks',
  FORM_NAME: 'JONAS ERP Access',
  TASK_TYPE: 'JONAS',
  DESCRIPTION: 'JONAS construction ERP system access',
  GROUP_EMAIL: 'grp.forms.jonas@team-group.com',
  FORM_FIELDS: [
    'Task_ID', 'Workflow_ID', 'Employee_Name', 'JONAS_User_ID', 'Access_Level', 'Modules_Enabled', 'Training_Completed', 'Accounting_Notes', 'Completed_By', 'Completion_Date'
  ],
  TASK_ID_PREFIX: 'TASK-JONAS',
  COMPANY_NAME: 'Team Group Companies',
  LOGO_URL: 'https://i.imgur.com/yQfP3TE.png',
  TASK_STATUS: {
    OPEN: 'Open',
    IN_PROGRESS: 'In Progress',
    COMPLETE: 'Complete',
    CANCELLED: 'Cancelled'
  }
};
