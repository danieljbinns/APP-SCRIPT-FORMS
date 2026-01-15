/**
 * WORKFLOW CONFIGURATION MANAGEMENT SYSTEM
 * Centralized configuration for all variables, actions, parameters, integrations
 * Supports multi-environment, dynamic substitution, action execution
 */

/**
 * Master Configuration Object - EVERYTHING configurable here
 */
const WORKFLOW_CONFIG = {

  // ========== ENVIRONMENT & DEPLOYMENT ==========
  environment: 'production', // 'development', 'staging', 'production'

  appName: 'REQUEST_FORMS Workflow Platform',
  appVersion: '1.0.0',
  buildDate: '2025-12-07',

  project: {
    name: 'REQUEST_FORMS',
    id: '1tDvetPic3GavG6jdNKXLP1hOCpUArtputFcfDfEWmPgNsFteWcvXqM6_',
    sharedDriveId: '0AOOOWlqzpUNVUk9PVA',
    mainFolderId: '15DRzYdFGTJba5O1eg5UbeWqPifLrZWVF',
    spreadsheetId: '18dLtNYOymmjbm-dGrY9pm41SQAi1QQIVP1e1KFNAgAQ'
  },

  // ========== EMAIL CONFIGURATION ==========
  email: {
    // Email templates with all parameters
    templates: {
      task_assigned: {
        subject: '{{action}}: {{taskName}} - {{employeeName}}',
        body: `
Dear {{assignedToName}},

You have been assigned the following task:

Task: {{taskName}}
Employee: {{employeeName}} (ID: {{employeeId}})
Position: {{position}}
Department: {{department}}
Start Date: {{hireDate}}
Due Date: {{dueDate}}
Priority: {{priority}}

Request ID: {{requestId}}
Workflow: {{workflowName}}
Status: {{status}}

To complete this task: {{formLink}}

---
This is an automated message from the Workflow System.
Do not reply to this email.
        `,
        variables: [
          'action', 'taskName', 'employeeName', 'assignedToName', 'employeeId',
          'position', 'department', 'hireDate', 'dueDate', 'priority',
          'requestId', 'workflowName', 'status', 'formLink'
        ]
      },
      task_completed: {
        subject: '✓ {{taskName}} - Completed',
        body: `
{{taskName}} has been completed successfully.

Employee: {{employeeName}}
Completed By: {{completedByName}}
Completion Date: {{completionDate}}
Duration: {{durationDays}} days

Next Step: {{nextStep}}

---
Workflow System
        `,
        variables: [
          'taskName', 'employeeName', 'completedByName', 'completionDate',
          'durationDays', 'nextStep'
        ]
      },
      task_overdue: {
        subject: '⚠ OVERDUE: {{taskName}}',
        body: `
The following task is overdue:

Task: {{taskName}}
Employee: {{employeeName}}
Original Due Date: {{originalDueDate}}
Days Overdue: {{daysOverdue}}
Assigned To: {{assignedToName}}

Action Required: {{formLink}}

Manager: {{managerEmail}}

---
Escalating to: {{escalateToEmail}}
        `,
        variables: [
          'taskName', 'employeeName', 'originalDueDate', 'daysOverdue',
          'assignedToName', 'formLink', 'managerEmail', 'escalateToEmail'
        ]
      },
      workflow_complete: {
        subject: '✅ Onboarding Complete - {{employeeName}}',
        body: `
Congratulations! The onboarding workflow for {{employeeName}} is now complete.

Employee: {{employeeName}}
Position: {{position}}
Start Date: {{hireDate}}
Total Duration: {{totalDays}} days

All tasks completed:
{{completedTasksList}}

Next Steps:
- Employee can access all systems
- Manager has been notified
- HR has final documentation

---
Welcome to Team Group Companies!
        `,
        variables: [
          'employeeName', 'position', 'hireDate', 'totalDays', 'completedTasksList'
        ]
      },
      approval_request: {
        subject: '🔔 Approval Required: {{approvalType}}',
        body: `
An approval is required for the following:

Type: {{approvalType}}
Submitted By: {{submitterName}}
Employee: {{employeeName}}
Submission Date: {{submissionDate}}

Details:
{{approvalDetails}}

Review & Approve: {{approvalLink}}

---
Approval required by: {{approvalDeadline}}
        `,
        variables: [
          'approvalType', 'submitterName', 'employeeName', 'submissionDate',
          'approvalDetails', 'approvalLink', 'approvalDeadline'
        ]
      },
      welcome_email: {
        subject: 'Welcome to Team Group Companies, {{firstName}}!',
        body: `
Dear {{firstName}} {{lastName}},

Welcome to Team Group Companies! We are excited to have you join our team.

Your Details:
- Position: {{position}}
- Department: {{department}}
- Start Date: {{startDate}}
- Manager: {{managerName}}
- Site: {{site}}

Quick Links:
- Employee Portal: {{portalLink}}
- IT Support: {{itSupportEmail}}
- HR Contact: {{hrContactEmail}}

Your first day orientation is scheduled for {{orientationDate}}.

Looking forward to working with you!

Best regards,
Human Resources
        `,
        variables: [
          'firstName', 'lastName', 'position', 'department', 'startDate',
          'managerName', 'site', 'portalLink', 'itSupportEmail', 'hrContactEmail',
          'orientationDate'
        ]
      }
    },

    // Email recipient configuration
    recipients: {
      hr: 'hr@company.com',
      it: 'it@company.com',
      finance: 'finance@company.com',
      operations: 'ops@company.com',
      fleetio: 'fleet@company.com',
      admin: 'admin@company.com',
      ceo: 'ceo@company.com'
    },

    // SMTP Settings (if using external SMTP)
    smtp: {
      enabled: false,
      host: 'smtp.gmail.com',
      port: 587,
      secure: true,
      auth: {
        user: '${SMTP_USER}',
        pass: '${SMTP_PASSWORD}'
      }
    },

    // Email rate limiting
    rateLimiting: {
      maxPerMinute: 10,
      maxPerHour: 100,
      maxPerDay: 1000
    }
  },

  // ========== WORKFLOW VARIABLES & SUBSTITUTION ==========
  variables: {
    // System variables (always available)
    system: {
      today: '{{today}}', // Current date
      now: '{{now}}',     // Current timestamp
      userId: '{{userId}}', // Current user
      userEmail: '{{userEmail}}',
      randomId: '{{randomId}}'
    },

    // Form field references - automatically resolved from form data
    formFields: {
      // From InitialRequest.html
      'Initial Request': [
        'Request ID', 'Submission Timestamp', 'Requester Name', 'Requester Email',
        'Requester Phone', 'First Name', 'Last Name', 'Hire Date', 'Site Name',
        'Department', 'Position/Title', 'Hourly or Salary', 'Reporting Manager Email',
        'Laptop', 'Monitor', 'Keyboard', 'Mouse', 'Phone', 'Workflow Status'
      ],
      // From HRForm.html
      'HR Setup': [
        'Employment Classification', 'Pay Class', 'Benefits Selection',
        'Emergency Contact', 'Tax Withholding', 'Direct Deposit', 'I-9 Status'
      ],
      // From ITForm.html
      'IT Setup': [
        'Laptop Assignment', 'Email Created', 'System Accounts', 'VPN Access',
        'Software Licenses', 'Device Tracking'
      ]
    },

    // Custom computed variables (functions)
    computed: {
      daysUntilStartDate: 'dateRange(today, hireDate)',
      isManager: 'position.includes("Manager") || position.includes("Director")',
      needsSpecialAccess: 'department === "IT" || position.includes("Admin")',
      employeeFullName: 'firstName + " " + lastName',
      companyEmail: 'firstName.toLowerCase() + "." + lastName.toLowerCase() + "@company.com"'
    },

    // Function templates
    functionLibrary: {
      dateAdd: 'function dateAdd(date, days, unit="days") { /* Add days to date */ }',
      dateRange: 'function dateRange(start, end) { /* Calculate days between */ }',
      formatCurrency: 'function formatCurrency(amount) { /* Format as currency */ }',
      formatDate: 'function formatDate(date, format="MM/DD/YYYY") { /* Format date */ }',
      uppercase: 'function uppercase(text) { return text.toUpperCase(); }',
      lowercase: 'function lowercase(text) { return text.toLowerCase(); }',
      titleCase: 'function titleCase(text) { /* Convert to title case */ }'
    }
  },

  // ========== ACTIONS CONFIGURATION ==========
  actions: {
    send_email: {
      description: 'Send email to recipients',
      parameters: {
        to: { type: 'string|array', required: true, description: 'Email recipient(s)' },
        cc: { type: 'array', required: false, description: 'CC recipients' },
        bcc: { type: 'array', required: false, description: 'BCC recipients' },
        subject: { type: 'string', required: true, description: 'Email subject' },
        template: { type: 'string', required: false, description: 'Email template name' },
        body: { type: 'string', required: false, description: 'Custom email body' },
        variables: { type: 'object', required: false, description: 'Template variables' },
        attachments: { type: 'array', required: false, description: 'File URLs to attach' },
        priority: { type: 'enum[high,normal,low]', required: false, default: 'normal' }
      },
      rateLimit: { perMinute: 10, perHour: 100, perDay: 1000 },
      timeout: 30000 // 30 seconds
    },

    assign_form: {
      description: 'Assign form to user/department',
      parameters: {
        formId: { type: 'string', required: true },
        assignTo: { type: 'string|email', required: true },
        dueInDays: { type: 'number', required: true },
        priority: { type: 'enum[high,normal,low]', required: false, default: 'normal' },
        prefillData: { type: 'object', required: false },
        notifyOnAssignment: { type: 'boolean', required: false, default: true },
        allowReassign: { type: 'boolean', required: false, default: true },
        allowEdit: { type: 'boolean', required: false, default: true }
      },
      timeout: 15000
    },

    update_status: {
      description: 'Update workflow or field status',
      parameters: {
        sheetName: { type: 'string', required: true },
        columnLetter: { type: 'string', required: true },
        value: { type: 'string', required: true },
        condition: { type: 'string', required: false },
        updateAllMatching: { type: 'boolean', required: false, default: false }
      },
      timeout: 10000
    },

    call_function: {
      description: 'Execute Google Apps Script function',
      parameters: {
        functionName: { type: 'string', required: true },
        parameters: { type: 'object', required: false },
        async: { type: 'boolean', required: false, default: false }
      },
      timeout: 60000
    },

    create_record: {
      description: 'Create new record in sheet',
      parameters: {
        sheetName: { type: 'string', required: true },
        data: { type: 'object', required: true },
        appendToEnd: { type: 'boolean', required: false, default: true }
      },
      timeout: 10000
    },

    send_notification: {
      description: 'Send in-app notification',
      parameters: {
        message: { type: 'string', required: true },
        type: { type: 'enum[info,success,warning,error]', required: false, default: 'info' },
        duration: { type: 'number', required: false, default: 5000 },
        actionUrl: { type: 'string', required: false }
      },
      timeout: 5000
    },

    create_folder: {
      description: 'Create folder in Google Drive',
      parameters: {
        folderName: { type: 'string', required: true },
        parentFolderId: { type: 'string', required: false },
        shareWith: { type: 'array', required: false }
      },
      timeout: 15000
    },

    create_spreadsheet: {
      description: 'Create new Google Sheet',
      parameters: {
        spreadsheetName: { type: 'string', required: true },
        folderId: { type: 'string', required: false },
        headers: { type: 'array', required: false },
        shareWith: { type: 'array', required: false }
      },
      timeout: 15000
    },

    webhook_call: {
      description: 'Call external API/webhook',
      parameters: {
        url: { type: 'string', required: true },
        method: { type: 'enum[GET,POST,PUT,DELETE]', required: false, default: 'POST' },
        headers: { type: 'object', required: false },
        body: { type: 'object', required: false },
        auth: { type: 'object', required: false }
      },
      timeout: 30000,
      retries: 3
    }
  },

  // ========== WORKFLOW STATES ==========
  workflowStates: {
    DRAFT: 'Draft - Not yet active',
    ACTIVE: 'Active - Currently running',
    PAUSED: 'Paused - Temporarily stopped',
    COMPLETED: 'Completed - Finished successfully',
    FAILED: 'Failed - Encountered error',
    CANCELLED: 'Cancelled - Manually stopped',
    ARCHIVED: 'Archived - No longer used'
  },

  taskStates: {
    PENDING: 'Pending - Waiting to start',
    ASSIGNED: 'Assigned - Given to person',
    IN_PROGRESS: 'In Progress - Being worked on',
    COMPLETED: 'Completed - Finished',
    FAILED: 'Failed - Could not complete',
    CANCELLED: 'Cancelled - Stopped',
    OVERDUE: 'Overdue - Past due date',
    BLOCKED: 'Blocked - Waiting for other task'
  },

  // ========== DASHBOARD CONFIGURATION ==========
  dashboard: {
    // Refresh rates (milliseconds)
    refreshRates: {
      realtime: 5000,    // 5 seconds
      frequent: 15000,   // 15 seconds
      normal: 30000,     // 30 seconds
      slow: 60000        // 1 minute
    },

    // Widget configuration
    widgets: {
      kpiCards: {
        enabled: true,
        metrics: ['totalWorkflows', 'completionRate', 'avgDaysToComplete', 'pendingCount']
      },
      charts: {
        enabled: true,
        types: ['statusDistribution', 'daysTrendline', 'siteComparison', 'departmentLoad']
      },
      table: {
        enabled: true,
        pageSize: 25,
        sortable: true,
        filterable: true
      },
      timeline: {
        enabled: true,
        granularity: 'day' // 'hour', 'day', 'week'
      }
    },

    // Color scheme
    colors: {
      primary: '#1a73e8',
      success: '#34a853',
      warning: '#fbbc04',
      error: '#ea4335',
      info: '#4285f4',
      neutral: '#5f6368'
    },

    // Status badge colors
    statusColors: {
      'Completed': '#34a853',
      'In Progress': '#4285f4',
      'Pending': '#fbbc04',
      'Overdue': '#ea4335',
      'Cancelled': '#9aa0a6',
      'Failed': '#d33427'
    }
  },

  // ========== NOTIFICATIONS CONFIGURATION ==========
  notifications: {
    channels: {
      email: {
        enabled: true,
        providers: ['gmail', 'smtp']
      },
      inapp: {
        enabled: true
      },
      slack: {
        enabled: false,
        webhookUrl: '${SLACK_WEBHOOK_URL}'
      },
      teams: {
        enabled: false,
        webhookUrl: '${TEAMS_WEBHOOK_URL}'
      }
    },

    events: {
      task_assigned: {
        channels: ['email', 'inapp'],
        template: 'task_assigned',
        sendTo: 'assignedUser'
      },
      task_overdue: {
        channels: ['email', 'inapp'],
        template: 'task_overdue',
        sendTo: ['assignedUser', 'manager', 'admin'],
        escalate: true
      },
      workflow_complete: {
        channels: ['email', 'inapp'],
        template: 'workflow_complete',
        sendTo: ['requester', 'hr', 'manager']
      },
      approval_required: {
        channels: ['email', 'inapp'],
        template: 'approval_request',
        sendTo: 'approvers'
      }
    }
  },

  // ========== PERMISSIONS & ROLES ==========
  permissions: {
    roles: {
      admin: {
        description: 'Full access to all workflows',
        permissions: ['create', 'edit', 'delete', 'publish', 'manage_users', 'view_logs']
      },
      workflow_designer: {
        description: 'Create and edit workflows',
        permissions: ['create', 'edit', 'delete', 'view_logs']
      },
      workflow_manager: {
        description: 'Manage workflow executions',
        permissions: ['view', 'assign', 'reassign', 'cancel', 'view_logs']
      },
      viewer: {
        description: 'View-only access',
        permissions: ['view', 'view_logs']
      }
    },

    // Field-level access control
    fieldAccess: {
      public: ['First Name', 'Last Name', 'Position', 'Department'],
      confidential: ['Salary', 'Background Check', 'Personal Email'],
      adminOnly: ['Workflow Status', 'System Notes']
    }
  },

  // ========== INTEGRATIONS ==========
  integrations: {
    slack: {
      enabled: false,
      clientId: '${SLACK_CLIENT_ID}',
      clientSecret: '${SLACK_CLIENT_SECRET}',
      webhookUrl: '${SLACK_WEBHOOK_URL}'
    },
    teams: {
      enabled: false,
      webhookUrl: '${TEAMS_WEBHOOK_URL}'
    },
    zapier: {
      enabled: false,
      webhookUrl: '${ZAPIER_WEBHOOK_URL}'
    },
    airtable: {
      enabled: false,
      apiKey: '${AIRTABLE_API_KEY}',
      baseId: '${AIRTABLE_BASE_ID}'
    }
  },

  // ========== MONITORING & LOGGING ==========
  logging: {
    level: 'info', // 'debug', 'info', 'warn', 'error'
    retentionDays: 90,
    logExecution: true,
    logErrors: true,
    logDataChanges: true,
    trackPerformance: true
  },

  // ========== DEPLOYMENT ==========
  deployment: {
    clasp: {
      projectId: '1tDvetPic3GavG6jdNKXLP1hOCpUArtputFcfDfEWmPgNsFteWcvXqM6_',
      rootDir: 'src'
    },
    gam: {
      enabled: false,
      configFile: '${GAM_CONFIG_FILE}'
    },
    environments: {
      development: {
        spreadsheetId: '${DEV_SPREADSHEET_ID}',
        sharedDriveId: '${DEV_SHARED_DRIVE_ID}'
      },
      staging: {
        spreadsheetId: '${STAGING_SPREADSHEET_ID}',
        sharedDriveId: '${STAGING_SHARED_DRIVE_ID}'
      },
      production: {
        spreadsheetId: '18dLtNYOymmjbm-dGrY9pm41SQAi1QQIVP1e1KFNAgAQ',
        sharedDriveId: '0AOOOWlqzpUNVUk9PVA'
      }
    }
  }
};

/**
 * Gets configuration for current environment
 * @returns {Object} Configuration object
 */
function getWorkflowConfig() {
  return WORKFLOW_CONFIG;
}

/**
 * Gets email template with variables
 * @param {string} templateName - Template name
 * @returns {Object} Template with subject, body, variables
 */
function getEmailTemplate(templateName) {
  return WORKFLOW_CONFIG.email.templates[templateName] || null;
}

/**
 * Renders email from template with variable substitution
 * @param {string} templateName - Template name
 * @param {Object} data - Data to substitute
 * @returns {Object} {subject, body}
 */
function renderEmailTemplate(templateName, data) {
  const template = getEmailTemplate(templateName);
  if (!template) {
    return { subject: '', body: '' };
  }

  let subject = template.subject;
  let body = template.body;

  // Replace variables
  Object.keys(data).forEach(key => {
    const regex = new RegExp('{{' + key + '}}', 'g');
    subject = subject.replace(regex, data[key] || '');
    body = body.replace(regex, data[key] || '');
  });

  return { subject, body };
}

/**
 * Gets all available actions
 * @returns {Object} Actions configuration
 */
function getActionsConfig() {
  return WORKFLOW_CONFIG.actions;
}

/**
 * Gets action configuration
 * @param {string} actionName - Name of action
 * @returns {Object} Action configuration
 */
function getActionConfig(actionName) {
  return WORKFLOW_CONFIG.actions[actionName] || null;
}

/**
 * Validates action parameters
 * @param {string} actionName - Action name
 * @param {Object} parameters - Parameters to validate
 * @returns {Object} {valid: boolean, errors: []}
 */
function validateActionParameters(actionName, parameters) {
  const actionConfig = getActionConfig(actionName);
  const errors = [];

  if (!actionConfig) {
    return { valid: false, errors: ['Action not found: ' + actionName] };
  }

  // Check required parameters
  Object.keys(actionConfig.parameters).forEach(paramName => {
    const paramConfig = actionConfig.parameters[paramName];
    if (paramConfig.required && !parameters[paramName]) {
      errors.push('Required parameter missing: ' + paramName);
    }
  });

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Gets role permissions
 * @param {string} roleName - Role name
 * @returns {Array} List of permissions
 */
function getRolePermissions(roleName) {
  const role = WORKFLOW_CONFIG.permissions.roles[roleName];
  return role ? role.permissions : [];
}

/**
 * Checks if user has permission
 * @param {string} roleName - Role name
 * @param {string} permission - Permission to check
 * @returns {boolean} Whether user has permission
 */
function hasPermission(roleName, permission) {
  const permissions = getRolePermissions(roleName);
  return permissions.includes(permission);
}
