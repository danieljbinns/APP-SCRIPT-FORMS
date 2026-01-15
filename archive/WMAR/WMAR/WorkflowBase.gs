/**
 * =============================================================================
 * WORKFLOW BASE - Base Class for All Workflows
 * =============================================================================
 * 
 * This file contains the base class that all workflow implementations extend.
 * It provides common functionality for task management, dependencies, and
 * state tracking.
 */

/**
 * WorkflowBase - Abstract base class for all workflows
 */
class WorkflowBase {
  
  constructor(workflowId) {
    this.workflowId = workflowId;
    this.taskDefinitions = [];
    this.workflowData = {};
  }
  
  /**
   * Initialize the workflow with data
   * @param {Object} initialData - Initial workflow data
   */
  initialize(initialData) {
    this.workflowData = initialData;
    this.taskDefinitions = this.defineTasks();
    Logger.log(`Initialized workflow ${this.workflowId} with ${this.taskDefinitions.length} tasks`);
  }
  
  /**
   * Define tasks for this workflow
   * MUST be overridden by subclasses
   * @returns {Array} Array of task definitions
   */
  defineTasks() {
    throw new Error('Subclass must implement defineTasks()');
  }
  
  /**
   * Get next tasks that are ready to execute
   * @returns {Array} Array of task definitions ready to execute
   */
  getNextTasks() {
    const existingTasks = SheetAccess.getTasksByWorkflowId(this.workflowId);
    const existingTaskTypes = existingTasks.map(t => t['Task Type']);
    
    return this.taskDefinitions.filter(taskDef => {
      // Skip if already created
      if (existingTaskTypes.includes(taskDef.type)) {
        return false;
      }
      
      // Check if dependencies are met
      if (!this.areDependenciesMet(taskDef, existingTasks)) {
        return false;
      }
      
      // Check if condition is met (for conditional tasks)
      if (taskDef.condition && !taskDef.condition(this.workflowData)) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Check if all dependencies for a task are met
   * @param {Object} taskDef - Task definition
   * @param {Array} existingTasks - Existing task records
   * @returns {boolean} True if dependencies are met
   */
  areDependenciesMet(taskDef, existingTasks) {
    if (!taskDef.dependencies || taskDef.dependencies.length === 0) {
      return true;
    }
    
    return taskDef.dependencies.every(depType => {
      const depTask = existingTasks.find(t => t['Task Type'] === depType);
      return depTask && depTask['Status'] === 'Complete';
    });
  }
  
  /**
   * Check if workflow is complete
   * @returns {boolean} True if all required tasks are complete
   */
  isComplete() {
    const existingTasks = SheetAccess.getTasksByWorkflowId(this.workflowId);
    const requiredTaskTypes = this.taskDefinitions
      .filter(td => td.required)
      .map(td => td.type);
    
    return requiredTaskTypes.every(type => {
      const task = existingTasks.find(t => t['Task Type'] === type);
      return task && task['Status'] === 'Complete';
    });
  }
  
  /**
   * Called when a task completes
   * Can be overridden by subclasses for custom logic
   * @param {string} taskId - Completed task ID
   * @param {Object} completionData - Data from task completion
   */
  onTaskComplete(taskId, completionData) {
    // Merge completion data into workflow data
    Object.assign(this.workflowData, completionData);
    
    // Update workflow metadata in sheet
    SheetAccess.updateWorkflowMetadata(this.workflowId, this.workflowData);
    
    Logger.log(`Task ${taskId} completed in workflow ${this.workflowId}`);
  }
  
  /**
   * Called when a task fails
   * Can be overridden by subclasses for custom logic
   * @param {string} taskId - Failed task ID
   * @param {string} errorMessage - Error message
   */
  onTaskFailed(taskId, errorMessage) {
    Logger.log(`Task ${taskId} failed in workflow ${this.workflowId}: ${errorMessage}`);
    
    // Mark workflow as failed if it was a required task
    const task = SheetAccess.getTaskById(taskId);
    const taskDef = this.taskDefinitions.find(td => td.type === task['Task Type']);
    
    if (taskDef && taskDef.required) {
      SheetAccess.updateWorkflowStatus(this.workflowId, 'Failed');
    }
  }
  
  /**
   * Called when workflow completes
   * Can be overridden by subclasses for custom logic
   */
  onComplete() {
    Logger.log(`Workflow ${this.workflowId} completed`);
    // Send final notifications, generate reports, etc.
  }
  
  /**
   * Get workflow data
   * @returns {Object} Workflow data
   */
  getData() {
    return this.workflowData;
  }
  
  /**
   * Update workflow data
   * @param {Object} newData - New data to merge
   */
  updateData(newData) {
    Object.assign(this.workflowData, newData);
    SheetAccess.updateWorkflowMetadata(this.workflowId, this.workflowData);
  }
}
