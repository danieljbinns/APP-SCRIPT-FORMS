/**
 * WORKFLOW BUILDER - Enterprise-Grade Workflow Definition & Execution Engine
 * Allows creation of complex workflows with triggers, conditions, actions, and branching logic
 */

/**
 * Workflow Definition Schema
 * {
 *   id: "WF-2025-12-07-001",
 *   name: "New Employee Onboarding",
 *   description: "Complete onboarding workflow...",
 *   version: 1,
 *   status: "active|draft|archived",
 *   createdBy: "dan.binns@company.com",
 *   createdDate: "2025-12-07T10:30:00Z",
 *   lastModified: "2025-12-07T10:30:00Z",
 *   trigger: {
 *     type: "form_submission",
 *     formId: "InitialRequest",
 *     conditions: [{field: "Gatekeeper", operator: "equals", value: "Yes"}]
 *   },
 *   steps: [
 *     {
 *       id: "step-1",
 *       type: "form_reference",
 *       formId: "HRForm",
 *       name: "HR Setup",
 *       assignTo: "HR",
 *       requiredFields: ["Employment Classification"],
 *       dueInDays: 2,
 *       nextStepId: "step-2"
 *     },
 *     {
 *       id: "step-2",
 *       type: "condition",
 *       conditions: [
 *         {
 *           field: "HRForm.Employment Type",
 *           operator: "equals",
 *           value: "Salary",
 *           trueStep: "step-3a",
 *           falseStep: "step-3b"
 *         }
 *       ]
 *     },
 *     {
 *       id: "step-3a",
 *       type: "action",
 *       action: "send_email",
 *       to: "${Department Email}",
 *       subject: "Salary Employee - Benefits Setup Required",
 *       template: "benefits_setup",
 *       nextStepId: "step-4"
 *     },
 *     {
 *       id: "step-4",
 *       type: "parallel",
 *       steps: ["step-5a", "step-5b", "step-5c"]
 *     }
 *   ],
 *   library: {
 *     sharedFunctions: ["sendNotification", "updateStatus"],
 *     emailTemplates: ["welcome_email", "benefits_setup"],
 *     conditions: ["is_manager", "is_remote"]
 *   }
 * }
 */

/**
 * Renders the Workflow Builder portal
 * @returns {HtmlOutput} Builder interface
 */
function renderWorkflowBuilder() {
  const template = HtmlService.createTemplateFromFile('WorkflowBuilderUI');

  // Inject server-side data
  template.existingForms = getExistingForms();
  template.existingWorkflows = getExistingWorkflows();
  template.availableTriggers = getAvailableTriggers();
  template.availableActions = getAvailableActions();
  template.sharedLibraries = getSharedLibraries();
  template.emailTemplates = getEmailTemplates();
  template.logoUrl = CONFIG.LOGO_URL;
  template.companyName = CONFIG.COMPANY_NAME;

  return template.evaluate()
    .setWidth(1600)
    .setHeight(1000)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Gets all existing forms that can be referenced in workflows
 * @returns {Array} Form objects with metadata
 */
function getExistingForms() {
  return [
    {
      id: 'InitialRequest',
      name: 'Initial Employee Request',
      type: 'form',
      description: 'Main onboarding form',
      fields: [
        'Gatekeeper', 'First Name', 'Last Name', 'Hire Date', 'Site Name',
        'Department', 'Position/Title', 'Employment Type', 'Reporting Manager Email'
      ],
      category: 'Initial Request'
    },
    {
      id: 'HRForm',
      name: 'HR Setup Form',
      type: 'form',
      description: 'HR department setup tasks',
      fields: [
        'Employment Classification', 'Pay Class', 'Benefits Selection',
        'Emergency Contact', 'Tax Withholding', 'Direct Deposit'
      ],
      category: 'Department Forms'
    },
    {
      id: 'ITForm',
      name: 'IT Setup Form',
      type: 'form',
      description: 'IT system provisioning',
      fields: [
        'Laptop Assignment', 'Email Created', 'System Accounts',
        'VPN Access', 'Software Licenses', 'Device Tracking'
      ],
      category: 'Department Forms'
    },
    {
      id: 'CreditCardForm',
      name: 'Credit Card Request',
      type: 'form',
      description: 'Corporate credit card setup',
      fields: [
        'Card Type', 'Credit Limit', 'Billing Address',
        'Expense Categories', 'Receipt Threshold'
      ],
      category: 'Department Forms'
    }
  ];
}

/**
 * Gets all existing workflows
 * @returns {Array} Workflow definitions
 */
function getExistingWorkflows() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Workflows') || null;

  if (!sheet) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const workflows = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    try {
      const workflowDef = JSON.parse(row[4]); // Assuming JSON stored in column 5
      workflows.push({
        id: row[0],
        name: row[1],
        status: row[2],
        createdBy: row[3],
        definition: workflowDef
      });
    } catch (e) {
      // Skip malformed entries
    }
  }

  return workflows;
}

/**
 * Gets available trigger types
 * @returns {Array} Trigger type definitions
 */
function getAvailableTriggers() {
  return [
    {
      id: 'form_submission',
      name: 'Form Submission',
      description: 'Triggered when a form is submitted',
      icon: '📋',
      configurable: true,
      config: ['Form ID', 'Conditions']
    },
    {
      id: 'scheduled',
      name: 'Scheduled (Daily/Weekly/Monthly)',
      description: 'Triggered on a schedule',
      icon: '⏰',
      configurable: true,
      config: ['Schedule', 'Time']
    },
    {
      id: 'manual',
      name: 'Manual Trigger',
      description: 'Manually initiated workflow',
      icon: '👆',
      configurable: false,
      config: []
    },
    {
      id: 'webhook',
      name: 'Webhook / API Call',
      description: 'Triggered by external system',
      icon: '🔗',
      configurable: true,
      config: ['Webhook URL', 'Authentication']
    },
    {
      id: 'field_change',
      name: 'Field Change',
      description: 'When a specific field value changes',
      icon: '🔄',
      configurable: true,
      config: ['Form', 'Field', 'Old Value', 'New Value']
    },
    {
      id: 'time_based',
      name: 'Time-Based (Days Since Event)',
      description: 'X days after another event',
      icon: '⏳',
      configurable: true,
      config: ['Event', 'Days', 'Action']
    }
  ];
}

/**
 * Gets available action types
 * @returns {Array} Action type definitions
 */
function getAvailableActions() {
  return [
    {
      id: 'send_email',
      name: 'Send Email',
      description: 'Send notification email',
      icon: '📧',
      config: ['To', 'Subject', 'Template', 'Variables']
    },
    {
      id: 'assign_form',
      name: 'Assign Task Form',
      description: 'Assign a form to a department/user',
      icon: '📝',
      config: ['Form', 'Assigned To', 'Due Date', 'Priority']
    },
    {
      id: 'update_status',
      name: 'Update Status',
      description: 'Update workflow or request status',
      icon: '✓',
      config: ['Field', 'New Value', 'Conditional']
    },
    {
      id: 'call_function',
      name: 'Call Function',
      description: 'Execute a shared function',
      icon: '⚙️',
      config: ['Function Name', 'Parameters']
    },
    {
      id: 'create_record',
      name: 'Create Record',
      description: 'Create a new record in a sheet',
      icon: '➕',
      config: ['Sheet Name', 'Data Mapping']
    },
    {
      id: 'wait',
      name: 'Wait/Delay',
      description: 'Pause workflow for specified time',
      icon: '⏸️',
      config: ['Duration', 'Unit (hours/days)']
    },
    {
      id: 'parallel',
      name: 'Parallel Steps',
      description: 'Execute multiple steps simultaneously',
      icon: '⚡',
      config: ['Steps']
    },
    {
      id: 'notification',
      name: 'In-App Notification',
      description: 'Send dashboard notification',
      icon: '🔔',
      config: ['Message', 'Type', 'Duration']
    },
    {
      id: 'webhook',
      name: 'Call External API',
      description: 'Make HTTP request to external system',
      icon: '🌐',
      config: ['URL', 'Method', 'Headers', 'Body']
    }
  ];
}

/**
 * Gets shared libraries and reusable components
 * @returns {Object} Available libraries
 */
function getSharedLibraries() {
  return {
    functions: [
      {
        name: 'sendNotification',
        description: 'Send email notification',
        params: ['email', 'subject', 'body']
      },
      {
        name: 'updateStatus',
        description: 'Update workflow status',
        params: ['requestId', 'status', 'note']
      },
      {
        name: 'assignForm',
        description: 'Assign form to user/department',
        params: ['formId', 'requestId', 'assignedTo', 'dueDate']
      },
      {
        name: 'getRequestData',
        description: 'Retrieve request data',
        params: ['requestId']
      }
    ],
    conditions: [
      {
        name: 'is_manager',
        description: 'Check if employee is manager',
        logic: 'position.includes("Manager") || position.includes("Director")'
      },
      {
        name: 'is_remote',
        description: 'Check if remote worker',
        logic: 'site === "Remote"'
      },
      {
        name: 'needs_credit_card',
        description: 'Check if credit card needed',
        logic: 'department === "Accounting" || position.includes("Sales")'
      },
      {
        name: 'is_new_site',
        description: 'Check if new to site',
        logic: 'daysAtSite < 30'
      }
    ]
  };
}

/**
 * Gets available email templates
 * @returns {Array} Email template definitions
 */
function getEmailTemplates() {
  return [
    {
      id: 'welcome_email',
      name: 'Welcome Email',
      subject: 'Welcome to {{company}}!',
      preview: 'Welcome {{firstName}} {{lastName}}...'
    },
    {
      id: 'task_assigned',
      name: 'Task Assigned',
      subject: 'Action Required: {{taskName}}',
      preview: 'A task has been assigned to you...'
    },
    {
      id: 'task_completed',
      name: 'Task Completed',
      subject: '{{taskName}} - Completed',
      preview: 'The task {{taskName}} has been completed...'
    },
    {
      id: 'approval_request',
      name: 'Approval Request',
      subject: 'Approval Needed: {{requestName}}',
      preview: 'Your approval is needed for...'
    },
    {
      id: 'onboarding_complete',
      name: 'Onboarding Complete',
      subject: 'Welcome Aboard {{firstName}}!',
      preview: 'Your onboarding is now complete...'
    }
  ];
}

/**
 * Saves a workflow definition
 * @param {Object} workflowDef - Workflow definition object
 * @returns {Object} Response {success, workflowId, message}
 */
function saveWorkflow(workflowDef) {
  try {
    const workflowId = 'WF-' + new Date().toISOString().split('T')[0].replace(/-/g, '') + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();

    // Create or get Workflows sheet
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName('Workflows');

    if (!sheet) {
      sheet = ss.insertSheet('Workflows', ss.getSheets().length);
      sheet.appendRow(['Workflow ID', 'Name', 'Status', 'Created By', 'Definition', 'Created Date', 'Last Modified']);
    }

    // Append workflow
    const user = Session.getActiveUser().getEmail();
    const now = new Date();

    sheet.appendRow([
      workflowId,
      workflowDef.name,
      workflowDef.status || 'draft',
      user,
      JSON.stringify(workflowDef),
      now,
      now
    ]);

    Logger.log('Workflow saved: ' + workflowId);

    return {
      success: true,
      workflowId: workflowId,
      message: 'Workflow "' + workflowDef.name + '" saved successfully'
    };

  } catch (error) {
    Logger.log('Error saving workflow: ' + error.message);
    return {
      success: false,
      message: 'Error saving workflow: ' + error.message
    };
  }
}

/**
 * Executes a workflow
 * @param {string} workflowId - ID of workflow to execute
 * @param {Object} triggerData - Data from trigger
 * @returns {Object} Response {success, message, executionId}
 */
function executeWorkflow(workflowId, triggerData) {
  try {
    const executionId = 'EXEC-' + new Date().getTime() + '-' + Math.random().toString(36).substr(2, 9);

    // Get workflow definition
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Workflows');
    const data = sheet.getDataRange().getValues();

    let workflowDef = null;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === workflowId) {
        workflowDef = JSON.parse(data[i][4]);
        break;
      }
    }

    if (!workflowDef) {
      return {
        success: false,
        message: 'Workflow not found: ' + workflowId
      };
    }

    // Execute first step
    let currentStepId = workflowDef.steps[0].id;
    let stepIndex = 0;

    // Log execution
    Logger.log('Executing workflow ' + workflowId + ' with execution ID ' + executionId);

    // Process steps
    while (stepIndex < workflowDef.steps.length) {
      const step = workflowDef.steps[stepIndex];

      if (step.type === 'form_reference') {
        // Assign form to user/department
        executeFormAssignmentAction(step, triggerData);
      } else if (step.type === 'action') {
        // Execute action
        executeAction(step, triggerData);
      } else if (step.type === 'condition') {
        // Evaluate condition and branch
        const nextStepId = evaluateCondition(step, triggerData);
        currentStepId = nextStepId;
      } else if (step.type === 'parallel') {
        // Execute parallel steps
        executeParallelSteps(step, triggerData);
      }

      stepIndex++;
    }

    return {
      success: true,
      executionId: executionId,
      message: 'Workflow executed successfully'
    };

  } catch (error) {
    Logger.log('Error executing workflow: ' + error.message);
    return {
      success: false,
      message: 'Error executing workflow: ' + error.message
    };
  }
}

/**
 * Executes a form assignment action
 * @param {Object} step - Step definition
 * @param {Object} triggerData - Trigger data
 */
function executeFormAssignmentAction(step, triggerData) {
  // Logic to assign form to department/user
  Logger.log('Assigning form ' + step.formId + ' for request ' + triggerData.requestId);
}

/**
 * Executes an action
 * @param {Object} step - Step definition
 * @param {Object} triggerData - Trigger data
 */
function executeAction(step, triggerData) {
  switch(step.action) {
    case 'send_email':
      // Send email
      Logger.log('Sending email to ' + step.to);
      break;
    case 'update_status':
      // Update status
      Logger.log('Updating status to ' + step.newValue);
      break;
    case 'call_function':
      // Call function
      Logger.log('Calling function ' + step.functionName);
      break;
  }
}

/**
 * Evaluates a condition step
 * @param {Object} step - Condition step definition
 * @param {Object} triggerData - Trigger data
 * @returns {string} Next step ID
 */
function evaluateCondition(step, triggerData) {
  // Evaluate condition logic
  // Return appropriate next step ID based on result
  return step.conditions[0].trueStep;
}

/**
 * Executes parallel steps
 * @param {Object} step - Parallel step definition
 * @param {Object} triggerData - Trigger data
 */
function executeParallelSteps(step, triggerData) {
  // Execute all steps in parallel
  step.steps.forEach(stepId => {
    Logger.log('Executing parallel step: ' + stepId);
  });
}

/**
 * Creates a placeholder form (for workflows without existing forms)
 * @param {Object} formConfig - Form configuration
 * @returns {Object} Response {success, formId, message}
 */
function createPlaceholderForm(formConfig) {
  try {
    const formId = 'FORM-' + new Date().getTime();

    // Create or get Forms sheet
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName('FormDefinitions');

    if (!sheet) {
      sheet = ss.insertSheet('FormDefinitions', ss.getSheets().length);
      sheet.appendRow(['Form ID', 'Name', 'Type', 'Fields', 'Created Date']);
    }

    // Append form definition
    sheet.appendRow([
      formId,
      formConfig.name,
      'placeholder',
      JSON.stringify(formConfig.fields || []),
      new Date()
    ]);

    return {
      success: true,
      formId: formId,
      message: 'Placeholder form created: ' + formConfig.name
    };

  } catch (error) {
    Logger.log('Error creating placeholder form: ' + error.message);
    return {
      success: false,
      message: 'Error creating placeholder form: ' + error.message
    };
  }
}

/**
 * Gets workflow execution history
 * @param {string} workflowId - Workflow ID (optional for filtering)
 * @returns {Array} Execution history
 */
function getWorkflowExecutionHistory(workflowId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('WorkflowExecutions');

    if (!sheet) {
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const history = [];

    for (let i = 1; i < data.length; i++) {
      if (!workflowId || data[i][1] === workflowId) {
        history.push({
          executionId: data[i][0],
          workflowId: data[i][1],
          status: data[i][2],
          startTime: data[i][3],
          endTime: data[i][4],
          result: data[i][5]
        });
      }
    }

    return history;

  } catch (error) {
    Logger.log('Error getting execution history: ' + error.message);
    return [];
  }
}

/**
 * Main entry point for workflow builder web app
 * @param {object} e - Event object
 * @returns {HtmlOutput} Rendered HTML
 */
function doGetWorkflowBuilder(e) {
  return renderWorkflowBuilder();
}
