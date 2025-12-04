/**
 * FORM_ADP_SUPERVISOR - Configuration File
 */

const CONFIG = {
  SHARED_DRIVE_ID: '0AOOOWlqzpUNVUk9PVA',
  SPREADSHEET_ID: '', // TODO: Fill after creating spreadsheet
  SHEET_NAME: 'ADP Supervisor Access Tasks',
  WORKFLOW_TRACKING_SPREADSHEET_ID: '',
  WORKFLOW_TASKS_SHEET: 'Workflow_Tasks',
  FORM_NAME: 'ADP Supervisor Access',
  TASK_TYPE: 'ADP_SUPERVISOR',
  DESCRIPTION: 'ADP supervisor-level permissions setup',
  GROUP_EMAIL: 'grp.forms.adp-supervisor@team-group.com',
  FORM_FIELDS: [
    'Task_ID', 'Workflow_ID', 'Employee_Name', 'ADP_User_ID', 'Supervisor_Role_Assigned', 'Access_Level', 'Training_Completed', 'Payroll_Notes', 'Completed_By', 'Completion_Date'
  ],
  TASK_ID_PREFIX: 'TASK-ADP_SUPERVISOR',
  COMPANY_NAME: 'Team Group Companies',
  LOGO_URL: 'https://i.imgur.com/yQfP3TE.png',
  TASK_STATUS: {
    OPEN: 'Open',
    IN_PROGRESS: 'In Progress',
    COMPLETE: 'Complete',
    CANCELLED: 'Cancelled'
  }
};
