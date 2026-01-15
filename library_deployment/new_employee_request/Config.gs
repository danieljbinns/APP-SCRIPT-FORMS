/**
 * New Employee Request Form - Configuration
 * Minimal config for web app form only
 */

const CONFIG = {

  // ==========================================================================
  // GOOGLE RESOURCES
  // ==========================================================================

  SHARED_DRIVE_ID: '0AOOOWlqzpUNVUk9PVA',
  SPREADSHEET_ID: '1We86y5tdoZ9bjbcSHozO47K_LcG0hmLNxbsgBoOHFEc',
  SHEET_NAME: 'Initial Requests',
  MAIN_FOLDER_ID: '1DVEDXld-4wIwvlBpDMiEOuZgRDyo8XEH',

  // ==========================================================================
  // BRANDING
  // ==========================================================================

  COMPANY_NAME: 'Team Group Companies',
  LOGO_URL: 'https://team-signature-logos.s3.us-east-1.amazonaws.com/Team+Logo+Black+Background.png',

  // ==========================================================================
  // FORM URLS
  // ==========================================================================
  
  EMPLOYEE_ID_SETUP_URL: 'https://script.google.com/a/macros/team-group.com/s/AKfycbwgZa8TBkpVLOmvtSty-eo_iQCILJz842uhYdq8qRajiB7JXt9pHumFRIF9wJ9J3n63/exec', // Updated with live deployment URL

  // ==========================================================================
  // FORM FIELDS (Column Headers for Sheet)
  // ==========================================================================

  FORM_FIELDS: [
    // Request Info
    'Request ID',
    'Submission Timestamp',
    'Date Requested',
    'Requester Name',
    'Requester Email',
    
    // Employee Info
    'Hire Date',
    'New Hire or Rehire',
    'Employee Type',
    'Hourly or Salary',
    'First Name',
    'Middle Name',
    'Last Name',
    'Preferred Name',
    'Position/JR Title',
    'Site Name',
    'Job Site Number',
    'Reporting Manager Email',
    'Reporting Manager Name',
    
    // System Access
    'System Access Needed',
    'Systems/Apps Selected',
    
    // Equipment
    'Equipment Requested',
    
    // Google Account Details
    'Google Email Address',
    'Google Domain',
    
    // Computer Details
    'Computer Request Type',
    'Computer Type',
    'Computer Previous User',
    'Computer Previous Type',
    'Computer Serial Number',
    'Office 365 License Required',
    
    // Credit Card Details
    'Credit Card USA',
    'Credit Card USA Limit',
    'Credit Card Canada',
    'Credit Card Canada Limit',
    'Credit Card Home Depot',
    'Credit Card Home Depot Limit',
    
    // Mobile Phone Details
    'Phone Request Type',
    'Phone Previous User',
    'Phone Previous Number',
    
    // BOSS Details
    'BOSS Job Sites',
    'BOSS Cost Sheet',
    'BOSS Cost Sheet Job Numbers',
    'BOSS Trip Reports',
    'BOSS Grievances',
    
    // Jonas Details
    'Jonas Job Numbers',
    
    // JR Assignment
    'JR Required',
    'JR Assignment',
    
    // 30-60-90 Day Plan
    '30-60-90 Day Plan Required',
    
    // Comments
    'Additional Comments',
    
    // Setup Results (Form 2)
    'Internal Employee ID',
    'SiteDocs Worker ID',
    'SiteDocs Job Code',
    'SiteDocs Username',
    'SiteDocs Password',
    'DSS Username',
    'DSS Password',
    'Setup Notes',
    
    // Workflow Status
    'Workflow Status'
  ],

  // ==========================================================================
  // EMAIL SETTINGS (Used by HR form to trigger conditional emails)
  // ==========================================================================

  EMAILS: {
    HR: 'dbinns@robinsonsolutions.com',
    IT: 'dbinns@robinsonsolutions.com',
    FLEETIO: 'dbinns@robinsonsolutions.com',
    CREDIT_CARD: 'dbinns@robinsonsolutions.com',
    BUSINESS_CARDS: 'dbinns@robinsonsolutions.com',
    REVIEW_306090_JR: 'dbinns@robinsonsolutions.com',
    ADP: 'dbinns@robinsonsolutions.com',
    JONAS: 'dbinns@robinsonsolutions.com',
    SITEDOCS: 'dbinns@robinsonsolutions.com',
    NOTIFICATIONS: 'dbinns@robinsonsolutions.com'
  }

};
