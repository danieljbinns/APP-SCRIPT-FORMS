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
  // NOTE: STATUS (col 52) is written by WorkflowManager/BOSSReviewHandler after
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
    ADP_SALARY_ACCESS:     53   // boolean  — ADP Salary Access
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
    COMPUTER_MAKE:         7,   // string   — Computer Make
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
    SUBMITTED_BY:          21   // string   — Submitted By
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
  // TERMINATIONS  (28 columns)
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
    LAST_DAY_WORKED:        27   // date     — Last Day Worked
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
  // POSITION CHANGES  (22 columns)
  // ─────────────────────────────────────────────
  POSITION_CHANGES: {
    WORKFLOW_ID:           0,   // string   — Workflow ID
    FORM_ID:               1,   // string   — Form ID
    TIMESTAMP:             2,   // datetime — Timestamp
    REQUESTER_NAME:        3,   // string   — Requester Name
    REQUESTER_EMAIL:       4,   // string   — Requester Email
    EMPLOYEE_NAME:         5,   // string   — Employee Name
    EMPLOYEE_ID:           6,   // string   — Employee ID
    EFFECTIVE_DATE:        7,   // date     — Effective Date
    CURRENT_SITE:          8,   // string   — Current Site
    CHANGE_TYPES:          9,   // csv      — Change Types
    SITE_TRANSFER:         10,  // string   — Site Transfer (Old -> New)
    TITLE_CHANGE:          11,  // string   — Title Change (Old -> New)
    CLASSIFICATION:        12,  // string   — Classification (Old -> New)
    MANAGER_CHANGE:        13,  // string   — Manager Change (Old -> New Email)
    REASSIGN_OLD_REPORTS:  14,  // boolean  — Reassign Old Reports
    GAIN_NEW_REPORTS:      15,  // boolean  — Gain New Reports
    GOOGLE_ACCOUNT:        16,  // string   — Google Account
    SYSTEMS_ADDED:         17,  // csv      — Systems Added
    EQUIPMENT:             18,  // csv      — Equipment
    REMOVED_ACCESS:        19,  // csv      — Removed Access
    COMMENTS:              20,  // string   — Comments
    DEPARTMENT:            21   // string   — Department
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
  // POSITION CHANGE APPROVAL RESULT  (7 columns)
  // Identical structure to TERMINATION_APPROVAL_RESULTS
  // ─────────────────────────────────────────────
  POSITION_CHANGE_APPROVAL: {
    WORKFLOW_ID:       0,  // string   — Workflow ID
    FORM_ID:           1,  // string   — Form ID
    TIMESTAMP:         2,  // datetime — Timestamp
    DECISION:          3,  // Decision
    NOTES:             4,  // string   — Notes
    FOLLOWUP_REQUIRED: 5,  // boolean  — Follow-up Required
    SUBMITTED_BY:      6   // string   — Submitted By
  }

};
