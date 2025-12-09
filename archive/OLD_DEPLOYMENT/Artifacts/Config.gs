/**
 * WMAR v2 - Configuration
 * Central configuration for all system settings
 */

const CONFIG = {
  
  // Spreadsheet Configuration
  SPREADSHEET_ID: '1COeArzN5J9My1y8EpWuk8xNw6NUckzgypiaii1XPRm0',
  
  // Sheet Names
  SHEETS: {
    INITIAL_REQUESTS: 'Initial Requests',
    HR_SETUP: 'HR Setup',
    IT_SETUP: 'IT Setup',
    FLEETIO: 'Fleetio',
    CREDIT_CARD: 'Credit Card',
    THIRTY_SIXTY_NINETY: '30-60-90',
    ADP_SUPERVISOR: 'ADP Supervisor',
    ADP_MANAGER: 'ADP Manager',
    JONAS: 'JONAS',
    SITEDOCS: 'SiteDocs',
    MASTER: 'Master Dashboard',
    JOB_CODES: 'Job Codes'
  },
  
  // Google Drive Folders
  FOLDERS: {
    MAIN: '1cIKoAkrKV-kqDveNkc_XeYL8_9O_wJDq',
    PDFS: '1vUw3xwlUZhCCzwJuuD22UAWGavuYxN9Y',
    REQUESTS: '1xA7aj7QdY5aK81fskXy7rKhxo9yHvPD3',
    REPORTS: '1p_E5VQK1xr8VlqxaomTqnYhT2czTyrVa',
    TEMPLATES: '1KqFLJLMsFEzqWeHwmfGchjJkRA4kLecw',
    ARCHIVES: '1KfQOuvlQcnnBpdsa_qegZvzsvsxp8veo'
  },
  
  // Branding
  COMPANY_NAME: 'Team Group Companies',
  LOGO_URL: 'https://i.imgur.com/yQfP3TE.png',
  
  // Email Addresses
  EMAILS: {
    HR_SETUP: 'hr@robinsonsolutions.com',
    IT_SETUP: 'it@robinsonsolutions.com',
    FLEETIO: 'fleet@robinsonsolutions.com',
    CREDIT_CARD: 'accounting@robinsonsolutions.com',
    THIRTY_SIXTY_NINETY: 'hr@robinsonsolutions.com',
    ADP_SUPERVISOR: 'payroll@robinsonsolutions.com',
    ADP_MANAGER: 'payroll@robinsonsolutions.com',
    JONAS: 'accounting@robinsonsolutions.com',
    SITEDOCS: 'safety@robinsonsolutions.com',
    NOTIFICATIONS: 'notifications@robinsonsolutions.com'
  },
  
  // Form Field Definitions
  FORM_FIELDS: {
    INITIAL_REQUEST: [
      'Request ID', 'Submission Timestamp', 'Requester Name', 'Requester Email',
      'First Name', 'Last Name', 'Hire Date', 'Site Name', 'Job Number',
      'Department', 'Position/Title', 'Hourly or Salary', 'Reporting Manager Email',
      'Laptop', 'Monitor', 'Keyboard', 'Mouse', 'Phone', 'Fleetio', 'Credit Card',
      'Workflow Status'
    ],
    HR_SETUP: [
      'Request ID', 'Employee Name', 'Hire Date', 'Benefits Enrollment Complete',
      'I-9 Verification Complete', 'Emergency Contacts Added', 'HR Notes',
      'Completed By', 'Completion Date'
    ],
    IT_SETUP: [
      'Request ID', 'Employee Name', 'Email Created', 'Email Address',
      'Computer Assigned', 'Computer Serial', 'Phone Assigned', 'Phone Number',
      'Software Installed', 'Network Access Granted', 'IT Notes',
      'Completed By', 'Completion Date'
    ]
  },
  
  // Workflow Statuses
  STATUSES: {
    SUBMITTED: 'Submitted',
    HR_IN_PROGRESS: 'HR In Progress',
    IT_IN_PROGRESS: 'IT In Progress',
    PENDING_APPROVAL: 'Pending Approval',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled'
  },
  
  // Helper Functions
  get: function(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this);
  }
};
