/**
 * =============================================================================
 * TASK BASE - Base Class for All Tasks
 * =============================================================================
 * 
 * This file contains the base class that all task implementations extend.
 * It provides common functionality for task execution, completion, and
 * notification.
 */

/**
 * TaskBase - Abstract base class for all tasks
 */
class TaskBase {
  
  constructor(taskId, workflowId) {
    this.taskId = taskId;
    this.workflowId = workflowId;
    this.taskData = {};
  }
  
  /**
   * Execute the task
   * MUST be overridden by subclasses
   */
  execute() {
    throw new Error('Subclass must implement execute()');
  }
  
  /**
   * Get the email address to assign this task to
   * MUST be overridden by subclasses
   * @returns {string} Email address
   */
  getAssigneeEmail() {
    throw new Error('Subclass must implement getAssigneeEmail()');
  }
  
  /**
   * Get the HTML form file for this task
   * MUST be overridden by subclasses
   * @returns {string} HTML filename
   */
  getFormHtml() {
    throw new Error('Subclass must implement getFormHtml()');
  }
  
  /**
   * Get the display title for this task
   * Can be overridden by subclasses
   * @returns {string} Task title
   */
  getTitle() {
    return this.taskId;
  }
  
  /**
   * Get the task link (URL to access this task)
   * @returns {string} Task URL
   */
  getTaskLink() {
    const baseUrl = ScriptApp.getService().getUrl();
    return `${baseUrl}?task=${this.taskId}`;
  }
  
  /**
   * Update task status
   * @param {string} status - New status
   */
  updateStatus(status) {
    SheetAccess.updateTaskField(this.taskId, 'Status', status);
  }
  
  /**
   * Start task execution
   * Common logic for all tasks
   */
  start() {
    this.updateStatus('In Progress');
    
    const assignee = this.getAssigneeEmail();
    SheetAccess.updateTaskField(this.taskId, 'Assigned To', assignee);
    
    this.notifyAssignee();
    
    Logger.log(`Started task ${this.taskId}, assigned to ${assignee}`);
  }
  
  /**
   * Complete the task
   * @param {Object} completionData - Data from task completion
   */
  complete(completionData) {
    this.taskData = completionData;
    this.updateStatus('Complete');
    
    SheetAccess.updateTaskField(this.taskId, 'Completed At', new Date());
    SheetAccess.updateTaskField(this.taskId, 'Data', JSON.stringify(completionData));
    
    // Save task-specific data if needed
    this.saveTaskData(completionData);
    
    Logger.log(`Completed task ${this.taskId}`);
  }
  
  /**
   * Fail the task
   * @param {string} errorMessage - Error message
   */
  fail(errorMessage) {
    this.updateStatus('Failed');
    SheetAccess.updateTaskField(this.taskId, 'Data', JSON.stringify({ error: errorMessage }));
    
    Logger.log(`Failed task ${this.taskId}: ${errorMessage}`);
  }
  
  /**
   * Send notification to assignee
   */
  notifyAssignee() {
    const assignee = this.getAssigneeEmail();
    const link = this.getTaskLink();
    const title = this.getTitle();
    const workflowData = this.getWorkflowData();
    
    const subject = `Action Required: ${title}`;
    const body = this.buildEmailBody(workflowData, link);
    
    EmailUtils.sendEmail(assignee, subject, body);
    
    Logger.log(`Sent notification to ${assignee} for task ${this.taskId}`);
  }
  
  /**
   * Build email body for task notification
   * Can be overridden by subclasses for custom email content
   * @param {Object} workflowData - Workflow data
   * @param {string} link - Task link
   * @returns {string} HTML email body
   */
  buildEmailBody(workflowData, link) {
    return `
      <h2>${this.getTitle()}</h2>
      <p>You have been assigned a task that requires your attention.</p>
      <p><a href="${link}" style="background-color: #EB1C2D; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Open Task</a></p>
      <hr>
      <p style="color: #666; font-size: 0.9em;">This is an automated message from the Team Group HR System.</p>
    `;
  }
  
  /**
   * Get workflow data
   * @returns {Object} Workflow data
   */
  getWorkflowData() {
    const workflow = SheetAccess.getWorkflowById(this.workflowId);
    return JSON.parse(workflow['Metadata'] || '{}');
  }
  
  /**
   * Save task-specific data to dedicated sheet (if needed)
   * Can be overridden by subclasses
   * @param {Object} data - Task completion data
   */
  saveTaskData(data) {
    // Default: no additional storage
    // Subclasses can override to save to task-specific sheets
  }
  
  /**
   * Load task-specific data from dedicated sheet (if needed)
   * Can be overridden by subclasses
   * @returns {Object} Task data
   */
  loadTaskData() {
    const task = SheetAccess.getTaskById(this.taskId);
    return JSON.parse(task['Data'] || '{}');
  }
  
  /**
   * Validate task completion data
   * Can be overridden by subclasses
   * @param {Object} data - Completion data
   * @returns {boolean} True if valid
   */
  validateCompletionData(data) {
    // Default: always valid
    // Subclasses can override for custom validation
    return true;
  }
  
  // ==========================================================================
  // EXTERNAL TICKETING INTEGRATION
  // ==========================================================================
  
  /**
   * Create ticket in external system (Jira, ServiceNow, etc.)
   * Called automatically when task starts if integration is enabled
   * @returns {string|null} External ticket ID or null
   */
  createExternalTicket() {
    if (!CONFIG.INTEGRATIONS.ticketing.enabled) {
      return null;
    }
    
    try {
      const ticketData = {
        summary: this.getTitle(),
        description: this.buildTicketDescription(),
        assignee: this.getAssigneeEmail(),
        priority: this.getPriority(),
        labels: this.getTicketLabels(),
        customFields: {
          taskId: this.taskId,
          workflowId: this.workflowId
        }
      };
      
      const ticketId = TicketingAPI.createTicket(ticketData);
      
      if (ticketId) {
        SheetAccess.updateTaskField(this.taskId, 'External Ticket ID', ticketId);
        SheetAccess.updateTaskField(this.taskId, 'External System', CONFIG.INTEGRATIONS.ticketing.system);
        SheetAccess.updateTaskField(this.taskId, 'Last Synced At', new Date());
        
        Logger.log(`Created external ticket ${ticketId} for task ${this.taskId}`);
      }
      
      return ticketId;
    } catch (error) {
      Logger.log(`Error creating external ticket: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Sync task status with external ticket
   */
  syncWithExternalTicket() {
    if (!CONFIG.INTEGRATIONS.ticketing.enabled || !CONFIG.INTEGRATIONS.ticketing.syncEnabled) {
      return;
    }
    
    const task = SheetAccess.getTaskById(this.taskId);
    const externalTicketId = task['External Ticket ID'];
    
    if (!externalTicketId) {
      return;
    }
    
    try {
      const externalStatus = TicketingAPI.getTicketStatus(externalTicketId);
      
      // Map external status to our status
      const mappedStatus = this.mapExternalStatus(externalStatus);
      
      if (mappedStatus && mappedStatus !== task['Status']) {
        this.updateStatus(mappedStatus);
        SheetAccess.updateTaskField(this.taskId, 'Last Synced At', new Date());
        Logger.log(`Synced task ${this.taskId} status from external ticket: ${mappedStatus}`);
      }
    } catch (error) {
      Logger.log(`Error syncing with external ticket: ${error.message}`);
    }
  }
  
  /**
   * Build ticket description for external system
   * Can be overridden by subclasses
   * @returns {string} Ticket description
   */
  buildTicketDescription() {
    const workflowData = this.getWorkflowData();
    return `
Task: ${this.getTitle()}
Task ID: ${this.taskId}
Workflow ID: ${this.workflowId}

Employee: ${workflowData['First Name']} ${workflowData['Last Name']}
Email: ${workflowData['Requester Email']}

Please complete this task and update the status in the system.
    `.trim();
  }
  
  /**
   * Get priority for external ticket
   * Can be overridden by subclasses
   * @returns {string} Priority level
   */
  getPriority() {
    // Default: Medium
    // Subclasses can override for task-specific priority
    return 'Medium';
  }
  
  /**
   * Get labels/tags for external ticket
   * Can be overridden by subclasses
   * @returns {Array} Array of labels
   */
  getTicketLabels() {
    return [
      'workflow-engine',
      this.workflowId.split('-')[1].toLowerCase(), // e.g., 'newhire'
      this.taskId.split('-')[1].toLowerCase()      // e.g., 'creditcard'
    ];
  }
  
  /**
   * Map external ticket status to internal status
   * Can be overridden based on external system
   * @param {string} externalStatus - Status from external system
   * @returns {string|null} Internal status or null if no mapping
   */
  mapExternalStatus(externalStatus) {
    const statusMap = {
      // Jira mappings
      'To Do': 'Pending',
      'In Progress': 'In Progress',
      'Done': 'Complete',
      'Closed': 'Complete',
      // ServiceNow mappings
      'New': 'Pending',
      'Work In Progress': 'In Progress',
      'Resolved': 'Complete',
      'Closed Complete': 'Complete'
    };
    
    return statusMap[externalStatus] || null;
  }
}
