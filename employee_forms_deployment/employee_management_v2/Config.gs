/**
 * Employee Management Forms V2 - Unified Configuration
 * Single source of truth for ALL form URLs and settings
 */

const CONFIG = {

  // ==========================================================================
  // GOOGLE RESOURCES
  // ==========================================================================
  
  SPREADSHEET_ID: '1kGjw8e-uIehaBemlsRZ4Yq1QrYOWkJvWzhKbgfl4Pxo',
  SHARED_DRIVE_ID: '0AOOOWlqzpUNVUk9PVA',
  MAIN_FOLDER_ID: '1vBZVuzXmSatnLGiqhU7QoS0zBK2NGDQE',
  DEPLOYMENT_URL: 'https://script.google.com/a/macros/robinsonsolutions.com/s/AKfycbwG4af-acrXjjDfEZBahHn2X1lMEhkLGC1PSubgPoqUdXNQlcaoH23tzUzd0Fp8MNFD/exec', // V1 Production - Deployed 2026-01-20
  ALLOWED_DOMAINS: ['team-group.com', 'robinsonsolutions.com', 'industrialappliedtech.com'],
  
  // ==========================================================================
  // SHEET NAMES
  // ==========================================================================
  
  SHEETS: {
    WORKFLOWS: 'Workflows',
    INITIAL_REQUESTS: 'Initial Requests',
    ID_SETUP_RESULTS: 'ID Setup Results',
    HR_VERIFICATION_RESULTS: 'HR Verification Results',
    IT_RESULTS: 'IT Results',
    CREDIT_CARD_RESULTS: 'Credit Card Results',
    BUSINESS_CARDS_RESULTS: 'Business Cards Results',
    FLEETIO_RESULTS: 'Fleetio Results',
    JONAS_RESULTS: 'JONAS Results',
    SITEDOCS_RESULTS: 'SiteDocs Results',
    REVIEW_306090_RESULTS: '30-60-90 Review Results',
    // Reference Data for Lookups
    REFERENCE_SITES: 'Reference_Sites',
    REFERENCE_JOB_CODES: 'Reference_JobCodes',
    REFERENCE_MANAGERS: 'Reference_Managers',
    REFERENCE_REQUESTERS: 'Reference_Requesters',
    REFERENCE_JRS: 'Reference_JRs',
    REFERENCE_JOBS_JONAS: 'Reference_JobsJonas'
  },
  
  // ==========================================================================
  // BRANDING
  // ==========================================================================
  
  COMPANY_NAME: 'Team Group Companies',
  LOGO_URL: 'https://team-signature-logos.s3.us-east-1.amazonaws.com/Team+Logo+Black+Background.png',
  
  // ==========================================================================
  // EMAIL SETTINGS
  // ==========================================================================
  
  EMAILS: {
    HR: 'dbinns@robinsonsolutions.com',
    IT: 'dbinns@robinsonsolutions.com',
    SITEDOCS: 'dbinns@robinsonsolutions.com',
    FLEETIO: 'dbinns@robinsonsolutions.com',
    CREDIT_CARD: 'dbinns@robinsonsolutions.com',
    BUSINESS_CARDS: 'dbinns@robinsonsolutions.com',
    REVIEW_306090_JR: 'dbinns@robinsonsolutions.com',
    ADP: 'dbinns@robinsonsolutions.com',
    JONAS: 'dbinns@robinsonsolutions.com',
    NOTIFICATIONS: 'dbinns@robinsonsolutions.com'
  }
  
};
