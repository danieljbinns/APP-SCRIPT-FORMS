/**
 * Reusable Workflow Management Module
 *
 * This module provides functionality for:
 * - Managing workflows and tasks
 * - Tracking status and progress
 * - Sending reminder notifications
 * - Filtering and sorting workflows
 *
 * Can be used for any workflow type or form system
 *
 * Error Handling Integration:
 * - Integrates with ToastManager for user feedback
 * - Integrates with LoadingOverlay for async operations
 * - Integrates with ErrorHandler for centralized error handling
 * - All integrations are optional (uses feature detection)
 * - Falls back to console logging if modules not available
 *
 * Required modules (optional):
 * - toast-notifications.js (ToastManager)
 * - loading-overlay.js (LoadingOverlay)
 * - error-handler.js (ErrorHandler, WorkflowNotFoundError, ReminderFailedError)
 * - workflow-validator.js (WorkflowValidator)
 * - validation-engine.js (ValidationEngine)
 * - validation-rules.js (ValidationRules)
 */

const WorkflowManager = (function() {
  'use strict';

  // Configuration
  let config = {
    reminderIntervals: [24, 48, 168], // hours: 24h, 48h, 7 days
    overdueThreshold: 0, // days before hire date
    storageKey: 'workflows',
    apiEndpoint: null // Set to API URL for backend integration
  };

  /**
   * Initialize the workflow manager with custom configuration
   */
  function init(customConfig = {}) {
    config = { ...config, ...customConfig };
  }

  /**
   * Get all workflows from storage/backend
   */
  async function getAllWorkflows() {
    if (config.apiEndpoint) {
      // Fetch from backend API
      try {
        const response = await fetch(`${config.apiEndpoint}/workflows`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        if (typeof ErrorHandler !== 'undefined') {
          ErrorHandler.handle(error, 'Failed to load workflows');
        } else {
          console.error('Error fetching workflows:', error);
        }
        return [];
      }
    } else {
      // Get from localStorage
      try {
        const stored = localStorage.getItem(config.storageKey);
        return stored ? JSON.parse(stored) : [];
      } catch (error) {
        if (typeof ErrorHandler !== 'undefined') {
          ErrorHandler.handle(error, 'Failed to load workflows from storage');
        } else {
          console.error('Error loading workflows:', error);
        }
        return [];
      }
    }
  }

  /**
   * Get a single workflow by ID
   */
  async function getWorkflow(workflowId) {
    try {
      const workflows = await getAllWorkflows();
      const workflow = workflows.find(wf => wf.workflowId === workflowId);

      if (!workflow && typeof WorkflowNotFoundError !== 'undefined') {
        throw new WorkflowNotFoundError(`Workflow ${workflowId} not found`);
      }

      return workflow;
    } catch (error) {
      if (typeof ErrorHandler !== 'undefined') {
        ErrorHandler.handle(error, 'Failed to find workflow');
      } else {
        console.error('Error getting workflow:', error);
      }
      throw error;
    }
  }

  /**
   * Create a new workflow
   */
  async function createWorkflow(workflowData) {
    try {
      // Validate workflow data first
      if (typeof WorkflowValidator !== 'undefined') {
        const validation = WorkflowValidator.validateAndSanitizeWorkflow(workflowData);

        if (!validation.isValid) {
          const errorMessage = WorkflowValidator.getFirstError(validation);

          if (typeof ValidationError !== 'undefined') {
            throw new ValidationError(errorMessage);
          } else {
            throw new Error(errorMessage);
          }
        }

        // Use sanitized data
        workflowData = validation.data;
      }

      const workflow = {
        workflowId: generateWorkflowId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'Open',
        tasksComplete: 0,
        lastReminder: null,
        reminderCount: 0,
        ...workflowData
      };

      if (config.apiEndpoint) {
        // Save to backend
        const response = await fetch(`${config.apiEndpoint}/workflows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workflow)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (typeof ToastManager !== 'undefined') {
          ToastManager.success('Workflow created successfully!');
        }

        return result;
      } else {
        // Save to localStorage
        const workflows = await getAllWorkflows();
        workflows.push(workflow);
        localStorage.setItem(config.storageKey, JSON.stringify(workflows));

        if (typeof ToastManager !== 'undefined') {
          ToastManager.success('Workflow created successfully!');
        }

        return workflow;
      }
    } catch (error) {
      if (typeof ErrorHandler !== 'undefined') {
        ErrorHandler.handle(error, 'Failed to create workflow');
      } else {
        console.error('Error creating workflow:', error);
      }
      throw error;
    }
  }

  /**
   * Update an existing workflow
   */
  async function updateWorkflow(workflowId, updates) {
    try {
      if (config.apiEndpoint) {
        // Update via backend
        const response = await fetch(`${config.apiEndpoint}/workflows/${workflowId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...updates, updatedAt: new Date().toISOString() })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } else {
        // Update in localStorage
        const workflows = await getAllWorkflows();
        const index = workflows.findIndex(wf => wf.workflowId === workflowId);

        if (index === -1) {
          if (typeof WorkflowNotFoundError !== 'undefined') {
            throw new WorkflowNotFoundError(`Workflow ${workflowId} not found`);
          } else {
            throw new Error(`Workflow ${workflowId} not found`);
          }
        }

        workflows[index] = {
          ...workflows[index],
          ...updates,
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem(config.storageKey, JSON.stringify(workflows));
        return workflows[index];
      }
    } catch (error) {
      if (typeof ErrorHandler !== 'undefined') {
        ErrorHandler.handle(error, 'Failed to update workflow');
      } else {
        console.error('Error updating workflow:', error);
      }
      throw error;
    }
  }

  /**
   * Update task status within a workflow
   */
  async function updateTaskStatus(workflowId, taskId, status) {
    try {
      const workflow = await getWorkflow(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      const task = workflow.tasks.find(t => t.id === taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found in workflow`);
      }

      task.status = status;
      task.updatedAt = new Date().toISOString();

      // Recalculate tasksComplete
      const tasksComplete = workflow.tasks.filter(t => t.status === 'Complete').length;

      const result = await updateWorkflow(workflowId, {
        tasks: workflow.tasks,
        tasksComplete,
        status: calculateWorkflowStatus(workflow)
      });

      if (typeof ToastManager !== 'undefined') {
        ToastManager.success('Task status updated');
      }

      return result;
    } catch (error) {
      if (typeof ErrorHandler !== 'undefined') {
        ErrorHandler.handle(error, 'Failed to update task status');
      } else {
        console.error('Error updating task status:', error);
      }
      throw error;
    }
  }

  /**
   * Calculate workflow status based on tasks and dates
   */
  function calculateWorkflowStatus(workflow) {
    const today = new Date();
    const targetDate = new Date(workflow.hireDate || workflow.targetDate);
    const daysDiff = Math.floor((targetDate - today) / (1000 * 60 * 60 * 24));

    if (workflow.tasksComplete === workflow.tasksTotal) {
      return 'Complete';
    } else if (daysDiff < config.overdueThreshold) {
      return 'Overdue';
    } else if (workflow.tasksComplete > 0) {
      return 'In Progress';
    } else {
      return 'Open';
    }
  }

  /**
   * Filter workflows based on criteria
   */
  function filterWorkflows(workflows, filters) {
    return workflows.filter(wf => {
      // Search filter
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const searchableText = [
          wf.employee || wf.name,
          wf.workflowId,
          wf.email,
          wf.position || wf.role
        ].join(' ').toLowerCase();

        if (!searchableText.includes(search)) {
          return false;
        }
      }

      // Status filter
      if (filters.status && wf.status !== filters.status) {
        return false;
      }

      // Type filter
      if (filters.type) {
        if (wf.type && wf.type !== filters.type) {
          return false;
        }
        if (wf.tasks && !wf.tasks.some(t => t.id.includes(filters.type))) {
          return false;
        }
      }

      // Date range filter
      if (filters.dateFrom && wf.createdAt < filters.dateFrom) {
        return false;
      }
      if (filters.dateTo && wf.createdAt > filters.dateTo) {
        return false;
      }

      // Custom filter function
      if (filters.customFilter && !filters.customFilter(wf)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Sort workflows by column
   */
  function sortWorkflows(workflows, column, direction = 'asc') {
    return workflows.sort((a, b) => {
      let aVal = a[column];
      let bVal = b[column];

      // Handle nested properties
      if (column === 'employee') {
        aVal = a.employee || a.name;
        bVal = b.employee || b.name;
      }

      // Handle progress calculation
      if (column === 'progress') {
        aVal = (a.tasksComplete / a.tasksTotal) || 0;
        bVal = (b.tasksComplete / b.tasksTotal) || 0;
      }

      if (direction === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  }

  /**
   * Check if workflow needs reminder
   */
  function needsReminder(workflow) {
    if (workflow.status === 'Complete') {
      return false;
    }

    const now = new Date();
    const targetDate = new Date(workflow.hireDate || workflow.targetDate);
    const daysTillTarget = Math.floor((targetDate - now) / (1000 * 60 * 60 * 24));

    // Check if overdue
    if (daysTillTarget < config.overdueThreshold) {
      return true;
    }

    // Check last reminder time
    if (!workflow.lastReminder) {
      return daysTillTarget <= 7; // Send first reminder 7 days before
    }

    const lastReminder = new Date(workflow.lastReminder);
    const hoursSinceReminder = (now - lastReminder) / (1000 * 60 * 60);

    // Check reminder intervals
    const intervalIndex = workflow.reminderCount || 0;
    const nextInterval = config.reminderIntervals[Math.min(intervalIndex, config.reminderIntervals.length - 1)];

    return hoursSinceReminder >= nextInterval;
  }

  /**
   * Send reminder for a workflow
   */
  async function sendReminder(workflowId, customMessage = '') {
    try {
      // Show loading state
      if (typeof LoadingOverlay !== 'undefined') {
        LoadingOverlay.show('Sending reminder...');
      }

      const workflow = await getWorkflow(workflowId);
      if (!workflow) {
        if (typeof WorkflowNotFoundError !== 'undefined') {
          throw new WorkflowNotFoundError('Workflow not found');
        } else {
          throw new Error('Workflow not found');
        }
      }

      // Validate email before sending
      if (typeof WorkflowValidator !== 'undefined') {
        const emailValidation = WorkflowValidator.validateReminderEmail(workflow.email);
        if (!emailValidation.isValid) {
          throw new Error('Invalid email address for recipient');
        }

        // Validate custom message if provided
        if (customMessage) {
          const messageValidation = WorkflowValidator.validateReminderMessage(customMessage);
          if (!messageValidation.isValid) {
            throw new Error('Custom message is too long (max 500 characters)');
          }
        }
      }

      const reminderData = {
        workflowId: workflow.workflowId,
        recipient: workflow.email,
        recipientName: workflow.employee || workflow.name,
        customMessage,
        workflow
      };

      let result;

      if (config.apiEndpoint) {
        // Send via backend API
        const response = await fetch(`${config.apiEndpoint}/reminders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reminderData)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (typeof ReminderFailedError !== 'undefined') {
            throw new ReminderFailedError(errorData.message || 'Failed to send reminder');
          } else {
            throw new Error(errorData.message || 'Failed to send reminder');
          }
        }

        result = await response.json();
      } else {
        // Simulate email sending
        console.log('Sending reminder email:', reminderData);

        result = {
          success: true,
          message: `Reminder sent to ${reminderData.recipient}`
        };
      }

      // Update workflow
      await updateWorkflow(workflowId, {
        lastReminder: new Date().toISOString(),
        reminderCount: (workflow.reminderCount || 0) + 1
      });

      // Hide loading and show success
      if (typeof LoadingOverlay !== 'undefined') {
        LoadingOverlay.hide();
      }

      if (typeof ToastManager !== 'undefined') {
        ToastManager.success(`Reminder sent to ${reminderData.recipientName || reminderData.recipient}`);
      }

      return result;
    } catch (error) {
      // Hide loading
      if (typeof LoadingOverlay !== 'undefined') {
        LoadingOverlay.hide();
      }

      // Handle error
      if (typeof ErrorHandler !== 'undefined') {
        ErrorHandler.handle(error, 'Failed to send reminder');
      } else {
        console.error('Error sending reminder:', error);
      }

      throw error;
    }
  }

  /**
   * Send bulk reminders to multiple workflows
   */
  async function sendBulkReminders(workflowIds, customMessage = '') {
    try {
      // Show loading state
      if (typeof LoadingOverlay !== 'undefined') {
        LoadingOverlay.show(`Sending ${workflowIds.length} reminder${workflowIds.length > 1 ? 's' : ''}...`);
      }

      const results = [];
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < workflowIds.length; i++) {
        const workflowId = workflowIds[i];

        try {
          // Update loading message with progress
          if (typeof LoadingOverlay !== 'undefined') {
            LoadingOverlay.updateMessage(`Sending reminder ${i + 1} of ${workflowIds.length}...`);
          }

          // Don't show individual loading overlays during bulk operation
          const LoadingOverlayBackup = typeof LoadingOverlay !== 'undefined' ? LoadingOverlay : null;
          if (LoadingOverlayBackup) {
            // Temporarily disable individual loading overlays
            window.LoadingOverlay = { show: () => {}, hide: () => {}, updateMessage: () => {} };
          }

          const result = await sendReminder(workflowId, customMessage);

          // Restore LoadingOverlay
          if (LoadingOverlayBackup) {
            window.LoadingOverlay = LoadingOverlayBackup;
          }

          results.push({ workflowId, success: true, ...result });
          successCount++;
        } catch (error) {
          // Restore LoadingOverlay
          if (typeof LoadingOverlay !== 'undefined') {
            const LoadingOverlayBackup = LoadingOverlay;
            window.LoadingOverlay = LoadingOverlayBackup;
          }

          results.push({ workflowId, success: false, error: error.message });
          failureCount++;
        }
      }

      // Hide loading
      if (typeof LoadingOverlay !== 'undefined') {
        LoadingOverlay.hide();
      }

      // Show summary toast
      if (typeof ToastManager !== 'undefined') {
        if (failureCount === 0) {
          ToastManager.success(`Successfully sent ${successCount} reminder${successCount > 1 ? 's' : ''}!`);
        } else if (successCount === 0) {
          ToastManager.error(`Failed to send all ${failureCount} reminders`);
        } else {
          ToastManager.warning(`Sent ${successCount} reminders, ${failureCount} failed`);
        }
      }

      return results;
    } catch (error) {
      // Hide loading
      if (typeof LoadingOverlay !== 'undefined') {
        LoadingOverlay.hide();
      }

      // Handle error
      if (typeof ErrorHandler !== 'undefined') {
        ErrorHandler.handle(error, 'Failed to send bulk reminders');
      } else {
        console.error('Error sending bulk reminders:', error);
      }

      throw error;
    }
  }

  /**
   * Get workflows that need automatic reminders
   */
  async function getWorkflowsNeedingReminders() {
    const workflows = await getAllWorkflows();
    return workflows.filter(wf => needsReminder(wf));
  }

  /**
   * Automatic reminder checker (can be run on interval)
   */
  async function checkAndSendReminders() {
    try {
      const workflowsToRemind = await getWorkflowsNeedingReminders();

      if (workflowsToRemind.length > 0) {
        console.log(`Found ${workflowsToRemind.length} workflows needing reminders`);
        const workflowIds = workflowsToRemind.map(wf => wf.workflowId);
        return await sendBulkReminders(workflowIds);
      }

      return [];
    } catch (error) {
      if (typeof ErrorHandler !== 'undefined') {
        ErrorHandler.handle(error, 'Failed to check and send reminders');
      } else {
        console.error('Error checking and sending reminders:', error);
      }
      throw error;
    }
  }

  /**
   * Generate unique workflow ID
   */
  function generateWorkflowId(prefix = 'WF-REQ') {
    const now = new Date();
    const dateStr = now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    const randomStr = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `${prefix}-${dateStr}-${randomStr}`;
  }

  /**
   * Calculate workflow statistics
   */
  async function getStatistics(workflows = null) {
    if (!workflows) {
      workflows = await getAllWorkflows();
    }

    // Update statuses
    workflows.forEach(wf => {
      wf.status = calculateWorkflowStatus(wf);
    });

    const stats = {
      total: workflows.length,
      open: workflows.filter(wf => wf.status === 'Open').length,
      inProgress: workflows.filter(wf => wf.status === 'In Progress').length,
      complete: workflows.filter(wf => wf.status === 'Complete').length,
      overdue: workflows.filter(wf => wf.status === 'Overdue').length,
      needingReminders: workflows.filter(wf => needsReminder(wf)).length
    };

    return stats;
  }

  // Public API
  return {
    init,
    getAllWorkflows,
    getWorkflow,
    createWorkflow,
    updateWorkflow,
    updateTaskStatus,
    filterWorkflows,
    sortWorkflows,
    sendReminder,
    sendBulkReminders,
    getWorkflowsNeedingReminders,
    checkAndSendReminders,
    getStatistics,
    generateWorkflowId,
    calculateWorkflowStatus,
    needsReminder
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WorkflowManager;
}
