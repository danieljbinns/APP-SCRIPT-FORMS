/**
 * =============================================================================
 * WORKFLOW ENGINE - Core Orchestration
 * =============================================================================
 * 
 * This file contains the core workflow engine that orchestrates the execution
 * of workflows and tasks. It manages workflow lifecycle, task dependencies,
 * and state transitions.
 */

/**
 * WorkflowEngine - Main orchestration class
 */
class WorkflowEngine {
  
  /**
   * Start a new workflow instance
   * @param {string} workflowType - Type of workflow (e.g., 'NewHire')
   * @param {Object} initialData - Initial data for the workflow
   * @param {string} initiatedBy - Email of person starting the workflow
   * @returns {string} Workflow ID
   */
  static startWorkflow(workflowType, initialData, initiatedBy) {
    const workflowId = `WF-${workflowType.toUpperCase()}-${Date.now()}`;
    
    // Create workflow record in Workflows sheet
    const workflowRecord = {
      'Workflow ID': workflowId,
      'Workflow Type': workflowType,
      'Status': 'Pending',
      'Initiated By': initiatedBy,
      'Initiated At': new Date(),
      'Metadata': JSON.stringify(initialData)
    };
    
    SheetAccess.appendToWorkflowsSheet(workflowRecord);
    
    // Load the workflow class and initialize
    const workflow = WorkflowFactory.create(workflowType, workflowId);
    workflow.initialize(initialData);
    
    // Start executing tasks
    this.executeNextTasks(workflowId);
    
    Logger.log(`Started workflow ${workflowId} of type ${workflowType}`);
    return workflowId;
  }
  
  /**
   * Execute all pending tasks that have their dependencies met
   * @param {string} workflowId - Workflow ID
   */
  static executeNextTasks(workflowId) {
    const workflow = WorkflowFactory.load(workflowId);
    const nextTasks = workflow.getNextTasks();
    
    if (nextTasks.length === 0) {
      // No more tasks to execute, check if workflow is complete
      if (workflow.isComplete()) {
        this.completeWorkflow(workflowId);
      }
      return;
    }
    
    // Execute all pending tasks that are ready
    nextTasks.forEach(taskDef => {
      this.createAndExecuteTask(workflowId, taskDef);
    });
  }
  
  /**
   * Create and execute a task
   * @param {string} workflowId - Parent workflow ID
   * @param {Object} taskDef - Task definition from workflow
   */
  static createAndExecuteTask(workflowId, taskDef) {
    const taskId = `TASK-${taskDef.type.toUpperCase()}-${Date.now()}`;
    
    // Create task record in Tasks sheet
    const taskRecord = {
      'Task ID': taskId,
      'Workflow ID': workflowId,
      'Task Type': taskDef.type,
      'Status': 'Pending',
      'Assigned To': taskDef.assignTo || '',
      'Started At': new Date(),
      'Metadata': JSON.stringify(taskDef.metadata || {})
    };
    
    SheetAccess.appendToTasksSheet(taskRecord);
    
    // Load the task class and execute
    const task = TaskFactory.create(taskDef.type, taskId, workflowId);
    task.execute();
    
    Logger.log(`Created and executed task ${taskId} of type ${taskDef.type}`);
  }
  
  /**
   * Complete a task and advance workflow
   * @param {string} taskId - Task ID
   * @param {Object} completionData - Data from task completion
   */
  static completeTask(taskId, completionData) {
    // Update task status
    SheetAccess.updateTaskStatus(taskId, 'Complete', completionData);
    
    // Get workflow ID and advance
    const task = SheetAccess.getTaskById(taskId);
    const workflowId = task['Workflow ID'];
    
    // Notify workflow of completion
    const workflow = WorkflowFactory.load(workflowId);
    workflow.onTaskComplete(taskId, completionData);
    
    // Execute next tasks
    this.executeNextTasks(workflowId);
    
    Logger.log(`Completed task ${taskId}, advanced workflow ${workflowId}`);
  }
  
  /**
   * Mark a task as failed
   * @param {string} taskId - Task ID
   * @param {string} errorMessage - Error message
   */
  static failTask(taskId, errorMessage) {
    SheetAccess.updateTaskStatus(taskId, 'Failed', { error: errorMessage });
    
    const task = SheetAccess.getTaskById(taskId);
    const workflowId = task['Workflow ID'];
    
    // Notify workflow of failure
    const workflow = WorkflowFactory.load(workflowId);
    workflow.onTaskFailed(taskId, errorMessage);
    
    Logger.log(`Failed task ${taskId}: ${errorMessage}`);
  }
  
  /**
   * Mark workflow as complete
   * @param {string} workflowId - Workflow ID
   */
  static completeWorkflow(workflowId) {
    SheetAccess.updateWorkflowStatus(workflowId, 'Complete');
    
    const workflow = WorkflowFactory.load(workflowId);
    workflow.onComplete();
    
    Logger.log(`Completed workflow ${workflowId}`);
  }
  
  /**
   * Get workflow status
   * @param {string} workflowId - Workflow ID
   * @returns {Object} Workflow status and task summary
   */
  static getWorkflowStatus(workflowId) {
    const workflow = SheetAccess.getWorkflowById(workflowId);
    const tasks = SheetAccess.getTasksByWorkflowId(workflowId);
    
    return {
      workflow: workflow,
      tasks: tasks,
      progress: this.calculateProgress(tasks)
    };
  }
  
  /**
   * Calculate workflow progress
   * @param {Array} tasks - Array of task records
   * @returns {Object} Progress summary
   */
  static calculateProgress(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(t => t['Status'] === 'Complete').length;
    const inProgress = tasks.filter(t => t['Status'] === 'In Progress').length;
    const failed = tasks.filter(t => t['Status'] === 'Failed').length;
    
    return {
      total: total,
      completed: completed,
      inProgress: inProgress,
      failed: failed,
      percentComplete: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }
}

/**
 * WorkflowFactory - Creates and loads workflow instances
 */
class WorkflowFactory {
  
  /**
   * Create a new workflow instance
   * @param {string} type - Workflow type
   * @param {string} workflowId - Workflow ID
   * @returns {WorkflowBase} Workflow instance
   */
  static create(type, workflowId) {
    switch(type) {
      case 'NewHire':
        return new NewHireWorkflow(workflowId);
      // Add more workflow types here
      default:
        throw new Error(`Unknown workflow type: ${type}`);
    }
  }
  
  /**
   * Load an existing workflow instance
   * @param {string} workflowId - Workflow ID
   * @returns {WorkflowBase} Workflow instance
   */
  static load(workflowId) {
    const record = SheetAccess.getWorkflowById(workflowId);
    if (!record) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    return this.create(record['Workflow Type'], workflowId);
  }
}

/**
 * TaskFactory - Creates and loads task instances
 */
class TaskFactory {
  
  /**
   * Create a new task instance
   * @param {string} type - Task type
   * @param {string} taskId - Task ID
   * @param {string} workflowId - Parent workflow ID
   * @returns {TaskBase} Task instance
   */
  static create(type, taskId, workflowId) {
    switch(type) {
      case 'HRSetup':
        return new HRSetupTask(taskId, workflowId);
      case 'ITSetup':
        return new ITSetupTask(taskId, workflowId);
      case 'CreditCard':
        return new CreditCardTask(taskId, workflowId);
      case 'Fleetio':
        return new FleetioTask(taskId, workflowId);
      // Add more task types here
      default:
        throw new Error(`Unknown task type: ${type}`);
    }
  }
  
  /**
   * Load an existing task instance
   * @param {string} taskId - Task ID
   * @returns {TaskBase} Task instance
   */
  static load(taskId) {
    const record = SheetAccess.getTaskById(taskId);
    if (!record) {
      throw new Error(`Task not found: ${taskId}`);
    }
    return this.create(record['Task Type'], taskId, record['Workflow ID']);
  }
}
