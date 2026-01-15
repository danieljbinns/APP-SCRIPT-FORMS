/**
 * FORM_SITEDOCS - Configuration File
 */

const CONFIG = {
  SHARED_DRIVE_ID: '0AOOOWlqzpUNVUk9PVA',
  SPREADSHEET_ID: '', // TODO: Fill after creating spreadsheet
  SHEET_NAME: 'SiteDocs - Safety Training Tasks',
  WORKFLOW_TRACKING_SPREADSHEET_ID: '',
  WORKFLOW_TASKS_SHEET: 'Workflow_Tasks',
  FORM_NAME: 'SiteDocs - Safety Training',
  TASK_TYPE: 'SITEDOCS',
  DESCRIPTION: 'Safety training and documentation management',
  GROUP_EMAIL: 'grp.forms.sitedocs@team-group.com',
  FORM_FIELDS: [
    'Task_ID', 'Workflow_ID', 'Employee_Name', 'SiteDocs_User_ID', 'Safety_Training_Complete', 'Certifications_Uploaded', 'Equipment_Training', 'Safety_Notes', 'Completed_By', 'Completion_Date'
  ],
  TASK_ID_PREFIX: 'TASK-SITEDOCS',
  COMPANY_NAME: 'Team Group Companies',
  LOGO_URL: 'https://i.imgur.com/yQfP3TE.png',
  TASK_STATUS: {
    OPEN: 'Open',
    IN_PROGRESS: 'In Progress',
    COMPLETE: 'Complete',
    CANCELLED: 'Cancelled'
  }
};
