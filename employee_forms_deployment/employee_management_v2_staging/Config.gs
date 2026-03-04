/**
 * Employee Management Forms V2 - Unified Configuration
 * Single source of truth for ALL form URLs and settings
 */

const CONFIG = {

  // ==========================================================================
  // GOOGLE RESOURCES
  // ==========================================================================
  
  get SPREADSHEET_ID() { return ConfigurationService.getSetting('SPREADSHEET_ID'); },
  get SHARED_DRIVE_ID() { return ConfigurationService.getSetting('SHARED_DRIVE_ID'); },
  get MAIN_FOLDER_ID() { return ConfigurationService.getSetting('MAIN_FOLDER_ID'); },
  get DEPLOYMENT_URL() { return ConfigurationService.getSetting('DEPLOYMENT_URL'); },
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
  
  COMPANY_NAME: 'TEAM Group',
  LOGO_URL: 'https://team-signature-logos.s3.us-east-1.amazonaws.com/Team+Logo+Black+Background.png',
  
  // ==========================================================================
  // EMAIL SETTINGS
  // ==========================================================================
  
  EMAILS: {
    HR: 'grp.forms.hr@team-group.com',
    IT: 'grp.forms.it@team-group.com',
    IDSETUP: 'grp.forms.idsetup@team-group.com',
    FLEETIO: 'grp.forms.fleetio@team-group.com',
    CREDIT_CARD: 'grp.forms.creditcard@team-group.com',
    BUSINESS_CARDS: 'davelangohr@team-group.com',
    REVIEW_306090_JR: 'grp.forms.review306090@team-group.com',
    JONAS: 'grp.forms.jonas@team-group.com',
    SAFETY: 'grp.forms.safety@team-group.com'
  }
  
};
