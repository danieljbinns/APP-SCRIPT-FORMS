/**
 * Employee Management Forms V2 - Unified Configuration
 * Single source of truth for ALL form URLs and settings
 */

const ENVIRONMENT = 'STAGING';

const CONFIG = {

  // ==========================================================================
  // GOOGLE RESOURCES
  // ==========================================================================
  
  get SPREADSHEET_ID() { return ConfigurationService.getSetting('SPREADSHEET_ID'); },
  get SHARED_DRIVE_ID() { return ConfigurationService.getSetting('SHARED_DRIVE_ID'); },
  get MAIN_FOLDER_ID() { return ConfigurationService.getSetting('MAIN_FOLDER_ID'); },
  get DEPLOYMENT_URL() { return ConfigurationService.getSetting('DEPLOYMENT_URL'); },
  ALLOWED_DOMAINS: ['team-group.com', 'robinsonsolutions.com', 'industrialappliedtech.com'],
  ADMIN_EMAILS: ['dbinns@team-group.com', 'dbinns@robinsonsolutions.com', 'no-reply@team-group.com', 'davelangohr@team-group.com'],
  
  // ==========================================================================
  // SHEET NAMES
  // ==========================================================================
  
  SHEETS: {
    WORKFLOWS: 'Workflows',
    DASHBOARD_VIEW: 'Dashboard_View', // Flat, pre-calculated table for instant UI rendering
    INITIAL_REQUESTS: 'Initial Requests',
    EQUIPMENT_REQUESTS: 'Equipment_Requests',
    ID_SETUP_RESULTS: 'ID Setup Results',
    HR_VERIFICATION_RESULTS: 'HR Verification Results',
    IT_RESULTS: 'IT Results',
    CREDIT_CARD_RESULTS: 'Credit Card Results',
    BUSINESS_CARDS_RESULTS: 'Business Cards Results',
    FLEETIO_RESULTS: 'Fleetio Results',
    JONAS_RESULTS: 'JONAS Results',
    CENTRAL_PURCHASING_RESULTS: 'Central Purchasing Results',
    SITEDOCS_RESULTS: 'SiteDocs Results',
    REVIEW_306090_RESULTS: '30-60-90 Review Results',
    TERMINATION_APPROVALS: 'Termination Approval Results',
    ASSET_COLLECTION_RESULTS: 'Asset Collection Results',
    POSITION_CHANGE_APPROVALS: 'Position Change Approval Results',
    TERMINATIONS: 'Terminations',
    POSITION_CHANGES: 'Position Changes',
    // Reference Data for Lookups
    REFERENCE_SITES: 'Reference_Sites',
    REFERENCE_JOB_CODES: 'Reference_JobCodes',
    REFERENCE_MANAGERS: 'Reference_Managers',
    REFERENCE_REQUESTERS: 'Reference_Requesters',
    REFERENCE_JRS: 'Reference_JRs',
    REFERENCE_JOBS_JONAS: 'Reference_JobsJonas',
    ACTION_ITEMS: 'Action Items'
  },
  
  // ==========================================================================
  // BRANDING
  // ==========================================================================
  
  COMPANY_NAME: 'TEAM Group',
  LOGO_URL: 'https://team-signature-logos.s3.us-east-1.amazonaws.com/Team+Logo+Black+Background.png',
  
  // ==========================================================================
  // EMAIL SETTINGS
  // ==========================================================================
  
  get EMAILS() {
    return {
      HR: ConfigurationService.getSetting('EMAIL_HR') || 'grp.forms.hr@team-group.com',
      IT: ConfigurationService.getSetting('EMAIL_IT') || 'grp.forms.it@team-group.com',
      IDSETUP: ConfigurationService.getSetting('EMAIL_IDSETUP') || 'grp.forms.idsetup@team-group.com',
      FLEETIO: ConfigurationService.getSetting('EMAIL_FLEETIO') || 'grp.forms.fleetio@team-group.com',
      CREDIT_CARD: ConfigurationService.getSetting('EMAIL_CREDIT_CARD') || 'grp.forms.creditcard@team-group.com',
      BUSINESS_CARDS: ConfigurationService.getSetting('EMAIL_BUSINESS_CARDS') || 'davelangohr@team-group.com',
      REVIEW_306090_JR: ConfigurationService.getSetting('EMAIL_REVIEW306090') || 'grp.forms.review306090@team-group.com',
      JONAS: ConfigurationService.getSetting('EMAIL_JONAS') || 'grp.forms.jonas@team-group.com',
      SAFETY: ConfigurationService.getSetting('EMAIL_SAFETY') || 'grp.forms.safety@team-group.com',
      PAYROLL: ConfigurationService.getSetting('EMAIL_PAYROLL') || 'payroll@team-group.com',
      PURCHASING: ConfigurationService.getSetting('EMAIL_PURCHASING') || 'purchasing@team-group.com'
    };
  }
  
};
