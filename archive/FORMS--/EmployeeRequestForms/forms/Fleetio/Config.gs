/**
 * FORM_FLEETIO - Configuration File
 */

const CONFIG = {
  SHARED_DRIVE_ID: '0AOOOWlqzpUNVUk9PVA',
  SPREADSHEET_ID: '', // TODO: Fill after creating spreadsheet
  SHEET_NAME: 'Fleetio - Vehicle Assignment Tasks',
  WORKFLOW_TRACKING_SPREADSHEET_ID: '',
  WORKFLOW_TASKS_SHEET: 'Workflow_Tasks',
  FORM_NAME: 'Fleetio - Vehicle Assignment',
  TASK_TYPE: 'FLEETIO',
  DESCRIPTION: 'Vehicle and fleet management tasks',
  GROUP_EMAIL: 'grp.forms.fleetio@team-group.com',
  FORM_FIELDS: [
    'Task_ID', 'Workflow_ID', 'Employee_Name', 'Vehicle_Assigned', 'Vehicle_ID', 'Fuel_Card_Issued', 'Fuel_Card_Number', 'Keys_Issued', 'Fleet_Notes', 'Completed_By', 'Completion_Date'
  ],
  TASK_ID_PREFIX: 'TASK-FLEETIO',
  COMPANY_NAME: 'Team Group Companies',
  LOGO_URL: 'https://i.imgur.com/yQfP3TE.png',
  TASK_STATUS: {
    OPEN: 'Open',
    IN_PROGRESS: 'In Progress',
    COMPLETE: 'Complete',
    CANCELLED: 'Cancelled'
  }
};
