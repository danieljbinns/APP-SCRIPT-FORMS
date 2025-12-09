/**
 * =============================================================================
 * CONFIGURATION - Central Configuration File
 * =============================================================================
 * 
 * This file contains ALL configuration constants for the application.
 * Edit values here instead of searching through code files.
 * 
 * IMPORTANT: Sensitive values (passwords, API keys) should be stored in
 * Script Properties, not hardcoded here.
 * 
 * To update Script Properties:
 * 1. Go to Project Settings (gear icon) → Script Properties
 * 2. Add properties: SERVICE_ACCOUNT_KEY, SMTP_APP_PASSWORD
 */

const CONFIG = {
  
  // ==========================================================================
  // GOOGLE RESOURCES
  // ==========================================================================
  
  /**
   * The unique ID of the Google Form used for initial employee requests.
   * Find this in the Form URL: https://docs.google.com/forms/d/FORM_ID/edit
   */
  FORM_ID: '1GDKkFSYfch2uxRTFI3qPdDDbJaL6efH_WVmDe0sb7Og',
  
  /**
   * The unique ID of the master Google Spreadsheet where all request data is stored.
   * Find this in the Sheet URL: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
   */
  SPREADSHEET_ID: '16ADQg74EASREwyHE_NfxS9I7KrpZKy_33WT5kgdFRQ4',
  
  /**
   * Google Drive folder IDs for file organization
   * Run setup_drive_folders.gs to create these folders and get IDs
   */
  DRIVE_FOLDERS: {
    main: '1v5MNRkxSPRqOTxQZ3kM01ECzN2tJKD62',  // Main WMAR folder
    pdfs: '10KwHjssnJvypX3kIxCAOMZOfd9kn65pD',  // All PDFs
    pdf_initial_submissions: '1eLsDrUs8VAYFU4Q4QNeZp9G_3NPZCNV1',  // Initial request PDFs
    pdf_hr_setup: '1aC9NWdDiw60w4tnz0f3ZhAXQ_kTOKzu0',  // HR setup PDFs
    pdf_it_setup: '1BkYkpilfqS-IgDgW1eHRcSnu8WN-ppX0',  // IT setup PDFs
    pdf_final_approvals: '13V6Yvul9ByRzrW6c5OnQ6xdKEQLth15E',  // Final approval PDFs
    pdf_parallel_tasks: '1zpaARkLQ23320KgHlgV9mriQGVS6xVxM',  // Parallel task PDFs
    requests: '1wT-oU18ZPtfLDcsZA2hjT35d5_tf4YyT',  // Individual request folders
    reports: '1R9Ns3GtzrhOamISWd5t-3XTDTbc_uiI8',  // System reports
    templates: '1HTZQwrPfdHs99XHQRZyuR7NvCUNz6mgo',  // Document templates
    archives: '1aCsYZnkSKRPqDgx_ErKO-1CQDztliHOE'  // Archived requests
  },
  
  /**
   * The name of the specific sheet tab within the master spreadsheet that holds the data.
   */
  MASTER_SHEET_NAME: 'All Responses',
  
  /**
   * The unique ID of the Google Spreadsheet containing job codes and site information.
   */
  JOB_CODES_SHEET_ID: '1ZAMh-XmTT06HWzMNmZiDfh4JslJVrykkSP0CeNPjdKY',
  
  /**
   * Optional: Name of the data tab in the Job Codes sheet (if not using first sheet)
   */
  JOB_CODES_TAB_NAME: 'Sheet1',
  
  // ==========================================================================
  // BRANDING & APPEARANCE
  // ==========================================================================
  
  /**
   * URL of the company logo displayed on web pages and in PDF documents.
   * Using a real test logo
   */
  LOGO_URL: 'https://i.imgur.com/yQfP3TE.png',
  
  /**
   * Company name used in email subject lines and PDF headers
   */
  COMPANY_NAME: 'Team Group Companies',
  
  // ==========================================================================
  // EMAIL RECIPIENTS - Main Workflow
  // ==========================================================================
  
  /**
   * Email address to receive the initial request and HR setup task.
   */
  HR_SETUP_EMAIL: 'dbinns@team-group.com',
  
  /**
   * Email address to receive the final approval task for salaried employees.
   */
  HR_APPROVAL_EMAIL: 'dbinns@team-group.com',
  
  /**
   * Email address to receive the IT setup task.
   */
  IT_SETUP_EMAIL: 'dbinns@team-group.com',
  
  // ==========================================================================
  // EMAIL RECIPIENTS - Parallel Tasks
  // ==========================================================================
  // These are triggered based on user selections in the form
  
  FLEETIO_EMAIL: 'dbinns@team-group.com',
  CREDIT_CARD_EMAIL: 'dbinns@team-group.com',
  BUSINESS_CARD_EMAIL: 'dbinns@team-group.com',
  THIRTY_SIXTY_NINETY_EMAIL: 'dbinns@team-group.com',
  ADP_MANAGER_ACCESS_EMAIL: 'dbinns@team-group.com',
  ADP_SUPERVISOR_ACCESS_EMAIL: 'dbinns@team-group.com',
  JR_EMAIL: 'dbinns@team-group.com',
  JR_306090_EMAIL: 'dbinns@team-group.com',
  JONAS_EMAIL: 'dbinns@team-group.com',
  SITEDOCS_EMAIL: 'dbinns@team-group.com',
  
  // ==========================================================================
  // SERVICE ACCOUNT CONFIGURATION
  // ==========================================================================
  // For API access with specific permissions and scopes
  
  SERVICE_ACCOUNT: {
    /**
     * Enable/disable service account usage
     * Set to false to use default script owner permissions
     */
    enabled: false,
    
    /**
     * Service account JSON key is stored in Script Properties
     * Property name: SERVICE_ACCOUNT_KEY
     * 
     * To set up:
     * 1. Create service account in Google Cloud Console
     * 2. Enable required APIs (Sheets, Drive, Forms)
     * 3. Download JSON key
     * 4. Add to Script Properties: Key="SERVICE_ACCOUNT_KEY", Value="{entire JSON}"
     */
    propertyName: 'SERVICE_ACCOUNT_KEY',
    
    /**
     * API scopes required for service account
     */
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/forms.readonly'
    ],
    
    /**
     * Service account email (for reference/documentation)
     * Format: service-account-name@project-id.iam.gserviceaccount.com
     */
    email: '' // Fill this in after creating service account
  },
  
  // ==========================================================================
  // SMTP / EMAIL SENDER CONFIGURATION
  // ==========================================================================
  // Send emails as a specific account instead of the script owner
  
  SMTP: {
    /**
     * Enable/disable custom SMTP sender
     * Set to false to use default GmailApp (sends as script owner)
     */
    enabled: false,
    
    /**
     * Email address to send from
     */
    fromEmail: 'noreply@team-group.com',
    
    /**
     * Display name for the sender
     */
    fromName: 'Team Group HR System',
    
    /**
     * Reply-to email address (optional)
     */
    replyTo: 'hr@team-group.com',
    
    /**
     * App Password is stored in Script Properties
     * Property name: SMTP_APP_PASSWORD
     * 
     * To set up:
     * 1. Enable 2-Factor Authentication on the sender Gmail account
     * 2. Go to Google Account → Security → 2-Step Verification → App Passwords
     * 3. Generate a new app password
     * 4. Add to Script Properties: Key="SMTP_APP_PASSWORD", Value="generated password"
     */
    appPasswordProperty: 'SMTP_APP_PASSWORD'
  },
  
  // ==========================================================================
  // ENVIRONMENT SETTINGS
  // ==========================================================================
  
  /**
   * Environment mode: 'DEV' or 'PROD'
   * In DEV mode, you can override email recipients for testing
   */
  ENVIRONMENT: 'PROD',
  
  /**
   * If ENVIRONMENT is 'DEV', all emails will be sent to this address instead
   */
  DEV_EMAIL_OVERRIDE: 'dbinns@team-group.com',
  
  // ==========================================================================
  // FEATURE FLAGS
  // ==========================================================================
  // Enable/disable features without code changes
  
  FEATURES: {
    /**
     * Enable standalone form access (forms without parent request)
     */
    standaloneFormsEnabled: true,
    
    /**
     * Enable PDF generation for requests
     */
    pdfGenerationEnabled: true,
    
    /**
     * Enable automatic email notifications
     */
    emailNotificationsEnabled: true,
    
    /**
     * Enable post-processing triggers for batch email sending
     */
    batchEmailProcessingEnabled: true
  },
  
  // ==========================================================================
  // MISC SETTINGS
  // ==========================================================================
  
  /**
   * Name of the data tab used by post-processing functions
   */
  DATA_TAB: 'All Responses',
  
  /**
   * Timezone for date formatting (default: script's timezone)
   */
  TIMEZONE: Session.getScriptTimeZone(),
  
  /**
   * Max retries for sheet operations (for eventual consistency)
   */
  MAX_RETRIES: 3,
  
  /**
   * Delay between retries (milliseconds)
   */
  RETRY_DELAY_MS: 2000,
  
  // ==========================================================================
  // INTEGRATIONS - External Systems
  // ==========================================================================
  
  /**
   * External ticketing system integration
   * Used to sync tasks with help desk systems like Jira, ServiceNow, Zendesk
   */
  INTEGRATIONS: {
    ticketing: {
      /**
       * Enable/disable ticketing integration
       */
      enabled: false,
      
      /**
       * Ticketing system type: 'jira', 'servicenow', 'zendesk', 'freshdesk'
       */
      system: 'jira',
      
      /**
       * API endpoint URL
       */
      apiUrl: 'https://your-domain.atlassian.net',
      
      /**
       * API credentials stored in Script Properties
       * For Jira: Property name 'JIRA_API_TOKEN'
       * For ServiceNow: Property name 'SERVICENOW_API_KEY'
       */
      apiKeyProperty: 'JIRA_API_TOKEN',
      
      /**
       * Project/Board ID where tickets should be created
       */
      projectId: '',
      
      /**
       * Auto-sync task status with external tickets
       */
      syncEnabled: true,
      
      /**
       * Sync interval (minutes) - how often to check for status updates
       */
      syncIntervalMinutes: 30
    }
  }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get a configuration value safely
 * @param {string} path - Dot notation path to config value (e.g., 'SMTP.enabled')
 * @returns {*} The configuration value
 */
function getConfig(path) {
  if (!path) {
    throw new Error('getConfig() requires a path parameter');
  }
  const keys = path.split('.');
  let value = CONFIG;
  for (const key of keys) {
    value = value[key];
    if (value === undefined) {
      throw new Error(`Configuration key not found: ${path}`);
    }
  }
  return value;
}

/**
 * Get email recipient based on environment
 * If in DEV mode, returns the override email instead
 * @param {string} recipientKey - Key from CONFIG (e.g., 'HR_SETUP_EMAIL')
 * @returns {string} Email address
 */
function getEmailRecipient(recipientKey) {
  if (CONFIG.ENVIRONMENT === 'DEV' && CONFIG.DEV_EMAIL_OVERRIDE) {
    Logger.log(`DEV MODE: Redirecting ${recipientKey} to ${CONFIG.DEV_EMAIL_OVERRIDE}`);
    return CONFIG.DEV_EMAIL_OVERRIDE;
  }
  return CONFIG[recipientKey];
}

/**
 * Get service account credentials from Script Properties
 * @returns {Object|null} Service account credentials or null if not configured
 */
function getServiceAccountCredentials() {
  if (!CONFIG.SERVICE_ACCOUNT.enabled) {
    return null;
  }
  const key = PropertiesService.getScriptProperties().getProperty(CONFIG.SERVICE_ACCOUNT.propertyName);
  if (!key) {
    Logger.log('WARNING: Service account enabled but key not found in Script Properties');
    return null;
  }
  return JSON.parse(key);
}

/**
 * Get SMTP app password from Script Properties
 * @returns {string|null} App password or null if not configured
 */
function getSMTPPassword() {
  if (!CONFIG.SMTP.enabled) {
    return null;
  }
  const password = PropertiesService.getScriptProperties().getProperty(CONFIG.SMTP.appPasswordProperty);
  if (!password) {
    Logger.log('WARNING: SMTP enabled but app password not found in Script Properties');
    return null;
  }
  return password;
}
