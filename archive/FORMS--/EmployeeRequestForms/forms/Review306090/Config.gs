/**
 * FORM_REVIEW306090 - Configuration File
 */

const CONFIG = {
  SHARED_DRIVE_ID: '0AOOOWlqzpUNVUk9PVA',
  SPREADSHEET_ID: '', // TODO: Fill after creating spreadsheet
  SHEET_NAME: '30-60-90 Day Review Tasks',
  WORKFLOW_TRACKING_SPREADSHEET_ID: '',
  WORKFLOW_TASKS_SHEET: 'Workflow_Tasks',
  FORM_NAME: '30-60-90 Day Review',
  TASK_TYPE: 'REVIEW_306090',
  DESCRIPTION: 'Performance review tracking at 30, 60, 90 days',
  GROUP_EMAIL: 'grp.forms.review306090@team-group.com',
  FORM_FIELDS: [
    'Task_ID', 'Workflow_ID', 'Employee_Name', 'Review_Period', 'Review_Date', 'Performance_Rating', 'Strengths', 'Areas_For_Improvement', 'Goals_Next_Period', 'Reviewer_Name', 'Completed_By', 'Completion_Date'
  ],
  TASK_ID_PREFIX: 'TASK-REVIEW_306090',
  COMPANY_NAME: 'Team Group Companies',
  LOGO_URL: 'https://i.imgur.com/yQfP3TE.png',
  TASK_STATUS: {
    OPEN: 'Open',
    IN_PROGRESS: 'In Progress',
    COMPLETE: 'Complete',
    CANCELLED: 'Cancelled'
  }
};
