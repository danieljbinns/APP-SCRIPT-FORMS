/**
 * REQUEST_FORMS - Configuration File
 * All configuration constants in one place
 */

const CONFIG = {

  // ==========================================================================
  // GOOGLE RESOURCES (UPDATE AFTER RUNNING SETUP)
  // ==========================================================================

  // Shared Drive: https://drive.google.com/drive/folders/0AOOOWlqzpUNVUk9PVA
  // Project will be deployed in: /REQUEST_FORMS/ folder within shared drive

  SHARED_DRIVE_ID: '0AOOOWlqzpUNVUk9PVA', // Team Group Companies Shared Drive

  SPREADSHEET_ID: '18dLtNYOymmjbm-dGrY9pm41SQAi1QQIVP1e1KFNAgAQ', // Will be populated by Setup.gs
  SHEET_NAME: 'Initial Requests',

  MAIN_FOLDER_ID: '15DRzYdFGTJba5O1eg5UbeWqPifLrZWVF', // Will be populated by Setup.gs (REQUEST_FORMS folder)

  // ==========================================================================
  // BRANDING
  // ==========================================================================

  COMPANY_NAME: 'Team Group Companies',
  LOGO_URL: 'https://i.imgur.com/yQfP3TE.png',

  // ==========================================================================
  // FORM FIELDS (Column Headers for Sheet)
  // ==========================================================================

  FORM_FIELDS: [
    'Request ID',
    'Submission Timestamp',
    'Requester Name',
    'Requester Email',
    'Requester Phone',
    'First Name',
    'Last Name',
    'Hire Date',
    'Site Name',
    'Department',
    'Position/Title',
    'Hourly or Salary',
    'Reporting Manager Email',
    'Laptop',
    'Monitor',
    'Keyboard',
    'Mouse',
    'Phone',
    'Workflow Status'
  ],

  // ==========================================================================
  // JOB CODES (Site Name -> Job Codes mapping)
  // ==========================================================================

  JOB_CODES: {
    'Atlanta': [
      { number: '1001', description: 'Project Manager' },
      { number: '1002', description: 'Field Supervisor' },
      { number: '1003', description: 'Equipment Operator' }
    ],
    'Charlotte': [
      { number: '2001', description: 'Safety Manager' },
      { number: '2002', description: 'Crew Lead' },
      { number: '2003', description: 'Laborer' }
    ],
    'Nashville': [
      { number: '3001', description: 'Estimator' },
      { number: '3002', description: 'Office Administrator' },
      { number: '3003', description: 'Account Manager' }
    ]
  },

  // ==========================================================================
  // DEPARTMENTS
  // ==========================================================================

  DEPARTMENTS: [
    'Operations',
    'Administration',
    'Safety',
    'Accounting',
    'HR',
    'IT',
    'Fleet'
  ],

  // ==========================================================================
  // EQUIPMENT OPTIONS
  // ==========================================================================

  EQUIPMENT: {
    LAPTOP: 'Laptop',
    MONITOR: 'Monitor',
    KEYBOARD: 'Keyboard',
    MOUSE: 'Mouse',
    PHONE: 'Phone'
  },

  // ==========================================================================
  // WORKFLOW STATUSES
  // ==========================================================================

  STATUS: {
    SUBMITTED: 'Submitted',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled'
  },

  // ==========================================================================
  // EMAIL SETTINGS
  // ==========================================================================

  EMAILS: {
    HR: 'dbinns@robinsonsolutions.com',
    IT: 'dbinns@robinsonsolutions.com',
    FLEETIO: 'dbinns@robinsonsolutions.com',
    CREDIT_CARD: 'dbinns@robinsonsolutions.com',
    REVIEW_306090: 'dbinns@robinsonsolutions.com',
    ADP_SUPERVISOR: 'dbinns@robinsonsolutions.com',
    ADP_MANAGER: 'dbinns@robinsonsolutions.com',
    JONAS: 'dbinns@robinsonsolutions.com',
    SITEDOCS: 'dbinns@robinsonsolutions.com',
    NOTIFICATIONS: 'dbinns@robinsonsolutions.com'
  },

  // ==========================================================================
  // TESTING / DEFAULT VALUES
  // ==========================================================================

  ENABLE_DEFAULT_VALUES: true, // Set to false to disable test values

  DEFAULT_VALUES: {
    'Requester Name': 'Dan Binns',
    'Requester Email': 'dbinns@robinsonsolutions.com',
    'Requester Phone': '555-0100',
    'First Name': 'John',
    'Last Name': 'Smith',
    'Hire Date': '2025-12-15',
    'Site Name': 'Atlanta',
    'Department': 'Operations',
    'Position/Title': '1001 - Project Manager',
    'Hourly or Salary': 'Salary',
    'Reporting Manager Email': 'dbinns@team-group.com',
    'Laptop': 'Yes',
    'Monitor': 'Yes',
    'Keyboard': 'Yes',
    'Mouse': 'Yes',
    'Phone': 'Yes'
  }

};
