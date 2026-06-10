/**
 * SchemaConstants.js
 * Single source of truth for all Google Sheet column indexes.
 *
 * All indexes are 0-based (for use with getValues() arrays).
 * For getRange(row, col) calls, add 1:  SCHEMA.WORKFLOWS.STATUS + 1
 *
 * Column order matches live sheet headers as of 2026-05-11.
 * When adding or reordering sheet columns, update here only.
 *
 * Type legend:
 *   string   — plain text
 *   number   — numeric value
 *   date     — yyyy-MM-dd
 *   datetime — yyyy-MM-dd HH:mm:ss
 *   boolean  — Yes / No string
 *   csv      — comma-separated string (multi-value field)
 *   json     — JSON-encoded string
 *
 * Future: these types are candidates for a runtime validation/formatting layer.
 */

const SCHEMA = {

  // ─────────────────────────────────────────────
  // ROW INDEX CONSTANTS
  // Used for getDataRange().getValues() array access patterns.
  //   data[SCHEMA.ROW.HEADER]         — the header row
  //   for (let i = SCHEMA.ROW.FIRST_DATA; ...)  — data row loops
  //   i > SCHEMA.ROW.HEADER           — filter to skip header
  // ─────────────────────────────────────────────
  ROW: {
    HEADER:     0,  // Header row index in a getValues() 2D array
    FIRST_DATA: 1   // First data row index; use in for-loop starts and i > checks
  },

  // ─────────────────────────────────────────────
  // WORKFLOWS  (9 columns)
  // ─────────────────────────────────────────────
  WORKFLOWS: {
    WORKFLOW_ID:     0,  // string   — Workflow ID
    WORKFLOW_TYPE:   1,  // string   — Workflow Type
    WORKFLOW_NAME:   2,  // string   — Workflow Name
    INITIATOR_EMAIL: 3,  // string   — Initiator Email
    STATUS:          4,  // string   — Status
    CREATED_DATE:    5,  // datetime — Created Date
    LAST_UPDATED:    6,  // datetime — Last Updated
    CURRENT_STEP:    7,  // string   — Current Step
    EMPLOYEE_NAME:   8   // string   — Employee Name
  },

  // ─────────────────────────────────────────────
  // INITIAL REQUESTS  (54 columns)
  // NOTE: STATUS (col 52) is written by WorkflowManager/ITConfirmationHandler after
  //       initial submission, not by the form itself.
  // ─────────────────────────────────────────────
  INITIAL_REQUESTS: {
    WORKFLOW_ID:           0,   // string   — Workflow ID
    FORM_ID:               1,   // string   — Form ID
    TIMESTAMP:             2,   // datetime — Timestamp
    DATE_REQUESTED:        3,   // date     — Date Requested
    REQUESTER_NAME:        4,   // string   — Requester Name
    REQUESTER_EMAIL:       5,   // string   — Requester Email
    HIRE_DATE:             6,   // date     — Hire Date
    NEW_HIRE_OR_REHIRE:    7,   // string   — New Hire/Rehire
    EMPLOYEE_TYPE:         8,   // string   — Employee Type
    EMPLOYMENT_TYPE:       9,   // string   — Employment Type
    FIRST_NAME:            10,  // string   — First Name
    MIDDLE_NAME:           11,  // string   — Middle Name
    LAST_NAME:             12,  // string   — Last Name
    PREFERRED_NAME:        13,  // string   — Preferred Name
    POSITION_TITLE:        14,  // string   — Position Title
    SITE_NAME:             15,  // string   — Site Name
    JOB_SITE_NUMBER:       16,  // string   — Job Site #
    MANAGER_EMAIL:         17,  // string   — Manager Email
    MANAGER_NAME:          18,  // string   — Manager Name
    SYSTEM_ACCESS:         19,  // string   — System Access
    SYSTEMS:               20,  // csv      — Systems
    EQUIPMENT:             21,  // csv      — Equipment
    GOOGLE_EMAIL:          22,  // string   — Google Email
    GOOGLE_DOMAIN:         23,  // string   — Google Domain
    COMPUTER_REQ:          24,  // string   — Computer Req
    COMPUTER_TYPE:         25,  // string   — Computer Type
    COMPUTER_PREV_USER:    26,  // string   — Prev User (computer)
    COMPUTER_PREV_TYPE:    27,  // string   — Prev Type
    COMPUTER_SERIAL:       28,  // string   — Serial #
    OFFICE_365:            29,  // boolean  — Office 365
    CC_USA:                30,  // boolean  — CC USA
    CC_LIMIT_USA:          31,  // string   — Limit USA
    CC_CAN:                32,  // boolean  — CC CAN
    CC_LIMIT_CAN:          33,  // string   — Limit CAN
    CC_HD:                 34,  // boolean  — CC HD
    CC_LIMIT_HD:           35,  // string   — Limit HD
    PHONE_REQ:             36,  // string   — Phone Req
    PHONE_PREV_USER:       37,  // string   — Prev User (phone)
    PHONE_PREV_NUMBER:     38,  // string   — Prev Number
    BOSS_SITES:            39,  // csv      — BOSS Sites
    BOSS_COST_SHEET:       40,  // boolean  — BOSS Cost Sheet
    BOSS_JOBS:             41,  // csv      — BOSS Jobs
    BOSS_TRIP:             42,  // boolean  — BOSS Trip
    BOSS_GRIEVANCES:       43,  // boolean  — BOSS Grievances
    JONAS_JOB_NUMBERS:     44,  // csv      — Jonas Job #s
    JR_REQUIRED:           45,  // boolean  — JR Req
    JR_ASSIGNMENT:         46,  // string   — JR Assign
    PLAN_306090:           47,  // boolean  — 30/60/90
    COMMENTS:              48,  // string   — Comments
    ADP_SITES:             49,  // csv      — ADP Sites
    DEPARTMENT:            50,  // string   — Department
    PURCHASING_SITES:      51,  // csv      — Purchasing Sites
    STATUS:                52,  // string   — Status
    ADP_SALARY_ACCESS:     53,  // boolean  — ADP Salary Access
    BOSS_TRAINING_ONLY:    54   // string   — BOSS Training User Only (Yes/No)
  },

  // ─────────────────────────────────────────────
  // ID SETUP RESULTS  (13 columns)
  // ─────────────────────────────────────────────
  ID_SETUP_RESULTS: {
    WORKFLOW_ID:         0,   // string   — Workflow ID
    FORM_ID:             1,   // string   — Form ID
    SUBMISSION_TS:       2,   // datetime — Submission Timestamp
    INTERNAL_EMP_ID:     3,   // number   — Internal Employee ID
    SITEDOCS_WORKER_ID:  4,   // string   — SiteDocs Worker ID
    SITEDOCS_JOB_CODE:   5,   // string   — SiteDocs Job Code
    SITEDOCS_USERNAME:   6,   // string   — SiteDocs Username
    SITEDOCS_PASSWORD:   7,   // string   — SiteDocs Password
    DSS_USERNAME:        8,   // string   — DSS Username
    DSS_PASSWORD:        9,   // string   — DSS Password
    SETUP_NOTES:         10,  // string   — Setup Notes
    SUBMITTED_BY:        11,  // string   — Submitted By
    BOSS_WIS_CREATED:    12   // boolean  — BOSS WIS Created
  },

  // ─────────────────────────────────────────────
  // HR VERIFICATION RESULTS  (10 columns)
  // ─────────────────────────────────────────────
  HR_VERIFICATION_RESULTS: {
    WORKFLOW_ID:             0,  // string   — Workflow ID
    FORM_ID:                 1,  // string   — Form ID
    SUBMISSION_TS:           2,  // datetime — Submission Timestamp
    ADP_ASSOCIATE_ID:        3,  // string   — ADP Associate ID
    VERIFIED_NAME:           4,  // string   — Verified Name
    VERIFIED_MANAGER:        5,  // string   — Verified Manager
    VERIFIED_MANAGER_EMAIL:  6,  // string   — Verified Manager Email
    VERIFIED_JR_TITLE:       7,  // string   — Verified JR Title
    NOTES:                   8,  // string   — Notes
    SUBMITTED_BY:            9   // string   — Submitted By
  },

  // ─────────────────────────────────────────────
  // IT RESULTS  (22 columns)
  // ─────────────────────────────────────────────
  IT_RESULTS: {
    WORKFLOW_ID:           0,   // string   — Workflow ID
    FORM_ID:               1,   // string   — Form ID
    SUBMISSION_TS:         2,   // datetime — Submission Timestamp
    EMAIL_CREATED:         3,   // boolean  — Email Created
    ASSIGNED_EMAIL:        4,   // string   — Assigned Email
    EMAIL_PASSWORD:        5,   // string   — Email Password
    COMPUTER_ASSIGNED:     6,   // boolean  — Computer Assigned
    COMPUTER_SERIAL:       7,   // string   — Computer Serial
    COMPUTER_MODEL:        8,   // string   — Computer Model
    COMPUTER_TYPE:         9,   // string   — Computer Type
    PHONE_ASSIGNED:        10,  // boolean  — Phone Assigned
    PHONE_CARRIER:         11,  // string   — Phone Carrier
    PHONE_MODEL:           12,  // string   — Phone Model
    PHONE_NUMBER:          13,  // string   — Phone Number
    PHONE_VM_PASSWORD:     14,  // string   — Phone VM Password
    BOSS_ACCESS:           15,  // boolean  — BOSS Access
    INCIDENTS_ACCESS:      16,  // boolean  — Incidents Access
    CAA_ACCESS:            17,  // boolean  — CAA Access
    DELIVERY_APP_ACCESS:   18,  // boolean  — Delivery App Access
    NET_PROMOTER_ACCESS:   19,  // boolean  — Net Promoter Access
    IT_NOTES:              20,  // string   — IT Notes
    SUBMITTED_BY:          21,  // string   — Submitted By
    BOSS_DETAILS:          22   // json     — BOSS committee/cost sheet/trip/grievances confirmations
  },

  // ─────────────────────────────────────────────
  // ACTION ITEMS  (14 columns)
  // ─────────────────────────────────────────────
  ACTION_ITEMS: {
    WORKFLOW_ID:     0,   // string   — Workflow ID
    TASK_ID:         1,   // string   — Task ID
    CATEGORY:        2,   // string   — Category
    TASK_NAME:       3,   // string   — Task Name
    DESCRIPTION:     4,   // string   — Description
    ASSIGNED_TO:     5,   // string   — Assigned To
    STATUS:          6,   // string   — Status
    CREATED_DATE:    7,   // datetime — Created Date
    COMPLETED_DATE:  8,   // datetime — Completed Date
    NOTES:           9,   // string   — Notes
    CLOSED_BY:       10,  // string   — Closed By
    DRAFT:           11,  // boolean  — Draft
    FORM_TYPE:       12,  // string   — Form Type
    FORM_DATA:       13   // json     — Form Data
  },

  // ─────────────────────────────────────────────
  // DASHBOARD_VIEW  (14 columns)
  // Materialized view — written by StateSync.js, read by DashboardHandler.js
  // ─────────────────────────────────────────────
  DASHBOARD_VIEW: {
    WORKFLOW_ID:           0,   // string   — Workflow ID
    EMPLOYEE_NAME:         1,   // string   — Employee Name
    GLOBAL_STATUS:         2,   // string   — Global Status
    GRANULAR_STEP:         3,   // string   — Granular Step Details
    REQUESTER_NAME:        4,   // string   — Requester Name
    REQUESTER_EMAIL:       5,   // string   — Requester Email
    INITIATOR_EMAIL:       6,   // string   — Initiator Email
    DATE_REQUESTED:        7,   // date     — Date Requested
    LAST_UPDATED:          8,   // datetime — Last Updated
    MANAGER_EMAIL:         9,   // string   — Manager Email
    REQUESTED_ITEMS_JSON:  10,  // json     — Requested Items JSON
    HIRE_DATE:             11,  // date     — Hire Date
    SITE:                  12,  // string   — Site
    EMPLOYMENT_TYPE:       13   // string   — Employment Type
  },

  // ─────────────────────────────────────────────
  // TERMINATIONS  (29 columns, 0–28)
  // ─────────────────────────────────────────────
  TERMINATIONS: {
    WORKFLOW_ID:            0,   // string   — Workflow ID
    FORM_ID:                1,   // string   — Form ID
    TIMESTAMP:              2,   // datetime — Timestamp
    REQUESTER_NAME:         3,   // string   — Requester Name
    REQUESTER_EMAIL:        4,   // string   — Requester Email
    EMPLOYEE_NAME:          5,   // string   — Employee Name
    EMPLOYEE_ID:            6,   // string   — Employee ID
    EMPLOYEE_TYPE:          7,   // string   — Employee Type
    WORK_EMAIL:             8,   // string   — Work Email
    PHONE:                  9,   // string   — Phone
    COMPUTER_SERIAL:        10,  // string   — Computer Serial
    SITE:                   11,  // string   — Site
    TERM_DATE:              12,  // date     — Term Date
    REASON:                 13,  // string   — Reason
    MANAGER_NAME:           14,  // string   — Manager Name
    MANAGER_EMAIL:          15,  // string   — Manager Email
    HR_APPROVED_STATUS:     16,  // string   — HR Approved Status
    HAS_REPORTS:            17,  // boolean  — Has Reports
    REASSIGN_REPORTS_TO:    18,  // string   — Reassign Reports To
    SYSTEMS_TO_DEACTIVATE:  19,  // csv      — Systems to Deactivate
    EMAIL_FORWARDING:       20,  // string   — Email Forwarding
    DRIVE_FILES_TRANSFER:   21,  // string   — Drive Files Transfer
    INBOX_DELEGATE:         22,  // string   — Inbox Delegate
    ACCOUNT_DURATION:       23,  // string   — Account Duration
    VACATION_RESPONDER:     24,  // string   — Vacation Responder Auto Reply
    EQUIPMENT_TO_RETURN:    25,  // csv      — Equipment to Return
    COMMENTS:               26,  // string   — Comments
    LAST_DAY_WORKED:        27,  // date     — Last Day Worked
    ATTACHMENT_URL:         28   // string   — Attachment URL (Drive link)
  },

  // ─────────────────────────────────────────────
  // EQUIPMENT_REQUESTS  (15 columns)
  // ─────────────────────────────────────────────
  EQUIPMENT_REQUESTS: {
    WORKFLOW_ID:          0,   // string   — Workflow ID
    FORM_ID:              1,   // string   — Form ID
    TIMESTAMP:            2,   // datetime — Timestamp
    REQUESTER_NAME:       3,   // string   — Requester Name
    REQUESTER_EMAIL:      4,   // string   — Requester Email
    EMPLOYEE_FIRST_NAME:  5,   // string   — Employee First Name
    EMPLOYEE_LAST_NAME:   6,   // string   — Employee Last Name
    SITE_NAME:            7,   // string   — Site Name
    JOB_TITLE:            8,   // string   — Job Title
    MANAGER_NAME:         9,   // string   — Manager Name
    MANAGER_EMAIL:        10,  // string   — Manager Email
    EQUIPMENT_REQUESTED:  11,  // csv      — Equipment Requested
    SYSTEMS_REQUESTED:    12,  // csv      — Systems Requested
    COMMENTS:             13,  // string   — Comments
    DEPARTMENT:           14   // string   — Department
  },

  // ─────────────────────────────────────────────
  // POSITION CHANGES  (60 columns)
  // ─────────────────────────────────────────────
  POSITION_CHANGES: {
    WORKFLOW_ID:              0,   // string   — Workflow ID
    FORM_ID:                  1,   // string   — Form ID
    TIMESTAMP:                2,   // datetime — Server submit timestamp
    REQUESTER_NAME:           3,   // string   — Requester Name
    REQUESTER_EMAIL:          4,   // string   — Requester Email
    EMPLOYEE_NAME:            5,   // string   — Employee Full Name
    EMPLOYEE_ID:              6,   // string   — Employee ID (legacy N/A)
    EFFECTIVE_DATE:           7,   // date     — Effective Date of Change
    CURRENT_SITE:             8,   // string   — Current/Primary Site
    CHANGE_TYPES:             9,   // csv      — Change Types checked
    SITE_TRANSFER:            10,  // string   — Site Transfer (Old -> New)
    TITLE_CHANGE:             11,  // string   — Title Change (Old -> New)
    CLASSIFICATION:           12,  // string   — Classification (Old -> New)
    MANAGER_CHANGE:           13,  // string   — Manager Change (Old -> New)
    REASSIGN_OLD_REPORTS:     14,  // string   — Reassign old reports to (email)
    GAIN_NEW_REPORTS:         15,  // string   — New reports previously reported to (email)
    GOOGLE_ACCOUNT:           16,  // string   — Existing -> New Google account
    SYSTEMS_ADDED:            17,  // csv      — New systems requested
    EQUIPMENT:                18,  // csv      — Equipment requested
    REMOVED_ACCESS:           19,  // csv      — Systems to remove access from
    COMMENTS:                 20,  // string   — Rationale / Comments
    DEPARTMENT:               21,  // string   — New Department
    PURCHASING_SITES:         22,  // csv      — Jonas Purchasing Site Numbers
    RECEIVING_MANAGER_EMAIL:  23,  // string   — Receiving/New Manager Email
    CURRENT_TITLE:            24,  // string   — Current Job Title (before change)
    CURRENT_MANAGER_EMAIL:    25,  // string   — Current Manager Email (before change)
    CURRENT_MANAGER_NAME:     26,  // string   — Current Manager Name (before change)
    CURRENT_CLASS:            27,  // string   — Current Classification (before change)
    // ── EXTENDED COLUMNS (added 2026-05-14) ─────────────────────────────────
    DATE_REQUESTED:           28,  // date     — Date entered by requester (separate from server TIMESTAMP)
    FIRST_NAME:               29,  // string   — Employee First Name
    LAST_NAME:                30,  // string   — Employee Last Name
    BOSS_TRAINING_ONLY:       31,  // string   — BOSS Training User Only (Yes/No)
    BOSS_SITES:               32,  // csv      — BOSS Committees assigned
    BOSS_COST_SHEET:          33,  // string   — BOSS Cost Sheet access (Yes/No)
    BOSS_COST_JOBS:           34,  // csv      — BOSS Cost Sheet job numbers
    BOSS_TRIP:                35,  // string   — BOSS Trip Reports access (Yes/No)
    BOSS_GRIEVANCES:          36,  // string   — BOSS Grievances access (Yes/No)
    ADP_SITES:                37,  // csv      — ADP Job Site Numbers
    ADP_SALARY_ACCESS:        38,  // string   — ADP Salary Data access (Yes/No)
    JR_REQUIRED:              39,  // string   — JR Required (Yes/No)
    JR_ASSIGNMENT:            40,  // string   — JR Title to assign
    PLAN_306090:              41,  // string   — 30/60/90 Plan Required (Yes/No)
    COMPUTER_REQ:             42,  // string   — Computer request type (New/Reassignment)
    COMPUTER_TYPE:            43,  // string   — Computer type (Chromebook/Windows/Mac)
    COMPUTER_PREV_USER:       44,  // string   — Previous computer user name
    COMPUTER_PREV_TYPE:       45,  // string   — Previous computer type
    COMPUTER_SERIAL:          46,  // string   — Serial number (if known)
    OFFICE_365:               47,  // string   — Office 365 required (Yes/No)
    CC_USA:                   48,  // string   — USA Credit Card (Yes/No)
    CC_LIMIT_USA:             49,  // string   — USA Credit Card monthly limit
    CC_CAN:                   50,  // string   — Canada Credit Card (Yes/No)
    CC_LIMIT_CAN:             51,  // string   — Canada Credit Card monthly limit
    CC_HD:                    52,  // string   — Home Depot Credit Card (Yes/No)
    CC_LIMIT_HD:              53,  // string   — Home Depot Credit Card monthly limit
    PHONE_REQ:                54,  // string   — Phone request type (New/Reassignment)
    PHONE_PREV_USER:          55,  // string   — Previous phone user name
    PHONE_PREV_NUMBER:        56,  // string   — Previous phone number
    JONAS_JOB_NUMBERS:        57,  // csv      — Jonas Job Numbers assigned
    EQUIPMENT_RETURN:         58,  // csv      — Equipment to be returned
    STATUS:                   59,  // string   — Workflow status (synced from Workflows sheet)
    ATTACHMENT_URL:           60   // string   — Supporting docs Drive link
  },

  // ─────────────────────────────────────────────
  // IT CONFIRMATION RESULTS  (13 columns)
  // Note: BOSS Review Results sheet is orphaned — identical headers, not referenced in code
  // ─────────────────────────────────────────────
  IT_CONFIRMATION_RESULTS: {
    WORKFLOW_ID:          0,   // string   — Workflow ID
    FORM_ID:              1,   // string   — Form ID
    TIMESTAMP:            2,   // datetime — Timestamp
    BOSS_JOB_SITES:       3,   // csv      — Boss Job Sites
    BOSS_COST_SHEET:      4,   // boolean  — Boss Cost Sheet
    BOSS_COST_SHEET_JOBS: 5,   // csv      — Boss Cost Sheet Jobs
    BOSS_TRIP_REPORTS:    6,   // boolean  — Boss Trip Reports
    BOSS_GRIEVANCES:      7,   // boolean  — Boss Grievances
    COMPUTER_REQ:         8,   // string   — Computer Req
    COMPUTER_TYPE:        9,   // string   — Computer Type
    PHONE_REQ:            10,  // string   — Phone Req
    NOTES:                11,  // string   — Notes
    SUBMITTED_BY:         12   // string   — Submitted By
  },

  // ─────────────────────────────────────────────
  // TERMINATION APPROVAL RESULTS  (7 columns)
  // ─────────────────────────────────────────────
  TERMINATION_APPROVAL_RESULTS: {
    WORKFLOW_ID:       0,  // string   — Workflow ID
    FORM_ID:           1,  // string   — Form ID
    TIMESTAMP:         2,  // datetime — Timestamp
    DECISION:          3,  // string   — Decision
    NOTES:             4,  // string   — Notes
    FOLLOWUP_REQUIRED: 5,  // boolean  — Follow-up Required
    SUBMITTED_BY:      6   // string   — Submitted By
  },

  // ─────────────────────────────────────────────
  // POSITION CHANGE APPROVAL RESULT  (8 columns)
  // Extended vs Termination Approval: cols 5-6 capture HR's confirmed
  // title and new manager email; col 7 = submitter.
  // ─────────────────────────────────────────────
  POSITION_CHANGE_APPROVAL: {
    WORKFLOW_ID:          0,  // string   — Workflow ID
    FORM_ID:              1,  // string   — Form ID
    TIMESTAMP:            2,  // datetime — Timestamp
    DECISION:             3,  // string   — Decision (Approved/Rejected)
    NOTES:                4,  // string   — Notes
    CONFIRMED_TITLE:      5,  // string   — Confirmed Title (from HR review)
    CONFIRMED_NEW_MGR:    6,  // string   — Confirmed New Manager email (from HR review)
    SUBMITTED_BY:         7   // string   — Submitted By (approver email)
  },

  // ─────────────────────────────────────────────
  // DATA_LOOKUP — numeric column indexes (0-based)
  // Sheet: Data_Lookup
  // Columns are positional (accessed by index, not header name).
  // When adding a new column here, also add its header string to DATA_LOOKUP_HEADERS below.
  // ─────────────────────────────────────────────
  DATA_LOOKUP: {
    SITES:            0,  // string — Column A — Site names
    JOB_NUMBERS:      3,  // string — Column D — Job site numbers (Initial Request field)
    BOSS_COST_SHEETS: 4,  // string — Column E — Boss cost sheet job numbers
    COMMITTEES:       5   // string — Column F — Boss job sites / committees
  },

  // ─────────────────────────────────────────────
  // DATA_LOOKUP_HEADERS — column header name strings
  // Sheet: Data_Lookup
  // Used wherever columns are located by header name (indexOf lookups and write-back).
  // When a new Data_Lookup column is needed, add its header string here first.
  // ─────────────────────────────────────────────
  DATA_LOOKUP_HEADERS: {
    SITES:        'Sites',
    JOB_CODES:    'Job Codes',
    JRS:          'JRs',
    JOB_NUMBERS:  'Job Numbers'
  }

};
