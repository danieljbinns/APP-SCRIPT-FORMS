/**
 * FORM_EMPLOYEE_SETUP - Configuration File
 * This is Form 2 - Always runs first after InitialRequest
 */

const CONFIG = {
  SHARED_DRIVE_ID: '0AOOOWlqzpUNVUk9PVA',
  SPREADSHEET_ID: '', // TODO: Fill after creating spreadsheet
  SHEET_NAME: 'Employee Setup Tasks',
  WORKFLOW_TRACKING_SPREADSHEET_ID: '',
  WORKFLOW_TASKS_SHEET: 'Workflow_Tasks',
  FORM_NAME: 'Employee Setup',
  TASK_TYPE: 'EMPLOYEE_SETUP',
  DESCRIPTION: 'Initial employee setup: ID generation, SiteDocs, DSS credentials',
  GROUP_EMAIL: 'grp.forms.employeesetup@team-group.com',
  FORM_FIELDS: [
    'Task_ID',
    'Workflow_ID',
    'Employee_Name',
    'Internal_Employee_ID',
    'SiteDocs_Worker_ID',
    'SiteDocs_Training_Username',
    'SiteDocs_Training_Password',
    'SiteDocs_Job_Code',
    'DSS_Username',
    'DSS_Password',
    'WIS_Module_Assigned',
    'Setup_Notes',
    'Completed_By',
    'Completion_Date'
  ],
  TASK_ID_PREFIX: 'TASK-EMPSETUP',
  COMPANY_NAME: 'Team Group Companies',
  LOGO_URL: 'https://i.imgur.com/yQfP3TE.png',
  TASK_STATUS: {
    OPEN: 'Open',
    IN_PROGRESS: 'In Progress',
    COMPLETE: 'Complete',
    CANCELLED: 'Cancelled'
  }
};
