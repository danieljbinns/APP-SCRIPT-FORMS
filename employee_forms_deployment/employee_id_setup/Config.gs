/**
 * Employee ID Setup - Configuration
 * Minimal config needed for form and conditional emails
 */

const CONFIG = {

  // ==========================================================================
  // GOOGLE RESOURCES (for looking up request data)
  // ==========================================================================

  SPREADSHEET_ID: '1We86y5tdoZ9bjbcSHozO47K_LcG0hmLNxbsgBoOHFEc',
  SHEET_NAME: 'Initial Requests',
  RESULTS_SHEET_NAME: 'ID Setup Results',

  // ==========================================================================
  // FORM URLS
  // ==========================================================================
  IT_FORM_URL: 'https://script.google.com/a/macros/team-group.com/s/AKfycbwM2MJoovzDkZ6bVEtToaSiOMfWnMHOeSWqc18__EfF_EFrW2buXWjOdQWmL7m_19lf/exec', 
  CREDIT_CARD_FORM_URL: '', 
  BUSINESS_CARDS_FORM_URL: '',
  FLEETIO_FORM_URL: '',
  REVIEW_FORM_URL: '',
  ADP_FORM_URL: '',
  JONAS_FORM_URL: '',
  SITEDOCS_FORM_URL: '',

  // ==========================================================================
  // EMAIL SETTINGS (for triggering conditional emails)
  // ==========================================================================

  EMAILS: {
    IT: 'dbinns@robinsonsolutions.com',
    FLEETIO: 'dbinns@robinsonsolutions.com',
    CREDIT_CARD: 'dbinns@robinsonsolutions.com',
    BUSINESS_CARDS: 'dbinns@robinsonsolutions.com',
    REVIEW_306090_JR: 'dbinns@robinsonsolutions.com',
    ADP: 'dbinns@robinsonsolutions.com',
    JONAS: 'dbinns@robinsonsolutions.com',
    SITEDOCS: 'dbinns@robinsonsolutions.com'
  }

};
