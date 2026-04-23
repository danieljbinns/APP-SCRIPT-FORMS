/**
 * schema.js
 * Sheet header definitions — sourced from employee_management_v2_dev/MigrateColumns.js EXPECTED_SCHEMA.
 * Used by the migration script to know what columns belong in each sheet.
 */

// Existing sheets that need missing columns appended (non-destructive)
const EXISTING_SHEET_SCHEMAS = {
  'Workflows': [
    'Workflow ID', 'Workflow Type', 'Workflow Name', 'Initiator Email',
    'Status', 'Created Date', 'Last Updated', 'Current Step', 'Employee Name'
  ],
  'Initial Requests': [
    'Workflow ID', 'Form ID', 'Timestamp', 'Date Requested', 'Requester Name', 'Requester Email',
    'Hire Date', 'New Hire/Rehire', 'Employee Type', 'Employment Type',
    'First Name', 'Middle Name', 'Last Name', 'Preferred Name', 'Position Title',
    'Site Name', 'Job Site #', 'Manager Email', 'Manager Name',
    'System Access', 'Systems', 'Equipment', 'Google Email', 'Google Domain',
    'Computer Req', 'Computer Type', 'Prev User', 'Prev Type', 'Serial #',
    'Office 365', 'CC USA', 'Limit USA', 'CC CAN', 'Limit CAN', 'CC HD', 'Limit HD',
    'Phone Req', 'Prev User', 'Prev Number', 'BOSS Sites', 'BOSS Cost Sheet',
    'BOSS Jobs', 'BOSS Trip', 'BOSS Grievances', 'Jonas Job #s', 'JR Req', 'JR Assign',
    '30/60/90', 'Comments', 'ADP Sites', 'Department', 'Purchasing Sites', 'Status'
  ],
  'ID Setup Results': [
    'Workflow ID', 'Form ID', 'Submission Timestamp', 'Internal Employee ID',
    'SiteDocs Worker ID', 'SiteDocs Job Code', 'SiteDocs Username',
    'SiteDocs Password', 'DSS Username', 'DSS Password',
    'Setup Notes', 'BOSS WIS Created', 'Submitted By'
  ],
  'HR Verification Results': [
    'Workflow ID', 'Form ID', 'Submission Timestamp', 'ADP Associate ID',
    'Verified Name', 'Verified Manager', 'Verified Manager Email',
    'Verified JR Title', 'Notes', 'Submitted By'
  ],
  'IT Results': [
    'Workflow ID', 'Form ID', 'Submission Timestamp', 'Email Created', 'Assigned Email', 'Email Password',
    'Computer Assigned', 'Computer Make', 'Computer Model', 'Computer Type',
    'Phone Assigned', 'Phone Carrier', 'Phone Model', 'Phone Number', 'Phone VM Password',
    'BOSS Access', 'Incidents Access', 'CAA Access', 'Delivery App Access', 'Net Promoter Access',
    'IT Notes', 'Submitted By'
  ]
};

// New sheets to create with headers (these don't exist in prod yet)
const NEW_SHEET_SCHEMAS = {
  'Dashboard_View': [
    'Workflow ID', 'Employee Name', 'Global Status', 'Granular Step Details',
    'Requester Name', 'Requester Email', 'Initiator Email', 'Date Requested',
    'Last Updated', 'Manager Email', 'Requested Items JSON', 'Hire Date',
    'Site', 'Employment Type'
  ],
  'Action Items': [
    'Workflow ID', 'Task ID', 'Category', 'Task Name', 'Description', 'Assigned To',
    'Status', 'Created Date', 'Completed Date', 'Notes', 'Closed By', 'Draft',
    'Form Type', 'Form Data'
  ],
  'Terminations': [
    'Workflow ID', 'Form ID', 'Timestamp', 'Requester Name', 'Requester Email',
    'Employee Name', 'Employee ID', 'Employee Type', 'Work Email', 'Phone', 'Computer Serial',
    'Site', 'Term Date', 'Reason', 'Manager Name', 'Manager Email', 'HR Approved Status',
    'Has Reports', 'Reassign Reports To', 'Systems to Deactivate', 'Email Forwarding',
    'Drive Files Transfer', 'Inbox Delegate', 'Account Duration', 'Vacation Responder Auto Reply',
    'Equipment to Return', 'Comments', 'Last Day Worked'
  ],
  'Position Changes': [
    'Workflow ID', 'Form ID', 'Timestamp', 'Requester Name', 'Requester Email',
    'Employee Name', 'Employee ID', 'Effective Date', 'Current Site', 'Change Types',
    'Site Transfer (Old -> New)', 'Title Change (Old -> New)', 'Classification (Old -> New)',
    'Manager Change (Old -> New Email)', 'Reassign Old Reports', 'Gain New Reports',
    'Google Account', 'Systems Added', 'Equipment', 'Removed Access', 'Comments', 'Department'
  ],
  'Termination Approval Results': [
    'Workflow ID', 'Form ID', 'Timestamp', 'Decision', 'Notes', 'Follow-up Required', 'Submitted By'
  ],
  'Position Change Approval Results': [
    'Workflow ID', 'Form ID', 'Timestamp', 'Decision', 'Notes', 'Follow-up Required', 'Submitted By'
  ],
  'Equipment_Requests': [
    'Timestamp', 'Workflow ID', 'Form ID', 'Requester Name', 'Requester Email',
    'Employee First Name', 'Employee Last Name', 'Site Name', 'Job Title', 'Manager Name', 'Manager Email',
    'Equipment Requested', 'Systems Requested', 'Comments'
  ],
  'Form Edit Log': [
    'Workflow ID', 'Task ID', 'Field', 'Old Value', 'New Value', 'Changed By', 'Changed At'
  ]
};

// Legacy specialist sheets to migrate into Action Items
const LEGACY_SPECIALIST_MAP = [
  {
    sheetName:  'Credit Card Results',
    category:   'Credit Card',
    formType:   'creditcard',
    taskName:   'Credit Card Setup',
    assignedTo: 'grp.forms.creditcard@team-group.com'
  },
  {
    sheetName:  'Business Cards Results',
    category:   'Business Cards',
    formType:   'businesscards',
    taskName:   'Business Cards Order',
    assignedTo: 'davelangohr@team-group.com'
  },
  {
    sheetName:  'Fleetio Results',
    category:   'Fleetio',
    formType:   'fleetio',
    taskName:   'Fleetio Setup',
    assignedTo: 'grp.forms.fleetio@team-group.com'
  },
  {
    sheetName:  'JONAS Results',
    category:   'JONAS',
    formType:   'jonas',
    taskName:   'Jonas Purchasing Setup',
    assignedTo: 'grp.forms.jonas@team-group.com'
  },
  {
    sheetName:  'SiteDocs Results',
    category:   'SiteDocs',
    formType:   'sitedocs',
    taskName:   'SiteDocs / DSS ID Setup',
    assignedTo: 'grp.forms.idsetup@team-group.com'
  },
  {
    sheetName:  '30-60-90 Review Results',
    category:   '30-60-90 Review',
    formType:   '30_60_90',
    taskName:   '30-60-90 Review',
    assignedTo: 'grp.forms.review306090@team-group.com'
  }
];

// Legacy specialist sheet column layout (all 6 share this schema)
// [0] Workflow ID  [1] Form ID  [2] Submission Timestamp  [3] Details  [4] Notes  [5] Submitted By
const LEGACY_COL = { WORKFLOW_ID: 0, FORM_ID: 1, TIMESTAMP: 2, DETAILS: 3, NOTES: 4, SUBMITTED_BY: 5 };

// Action Items sheet column indices (for duplicate checking)
const ACTION_ITEMS_COL = {
  WORKFLOW_ID: 0, TASK_ID: 1, CATEGORY: 2, TASK_NAME: 3, DESCRIPTION: 4,
  ASSIGNED_TO: 5, STATUS: 6, CREATED_DATE: 7, COMPLETED_DATE: 8, NOTES: 9,
  CLOSED_BY: 10, DRAFT: 11, FORM_TYPE: 12, FORM_DATA: 13
};

module.exports = {
  EXISTING_SHEET_SCHEMAS,
  NEW_SHEET_SCHEMAS,
  LEGACY_SPECIALIST_MAP,
  LEGACY_COL,
  ACTION_ITEMS_COL
};
