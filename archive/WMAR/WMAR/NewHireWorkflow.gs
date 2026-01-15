/**
 * =============================================================================
 * NEW HIRE WORKFLOW - Concrete Workflow Implementation
 * =============================================================================
 * 
 * Defines the sequence and dependencies for the New Hire onboarding workflow.
 */

class NewHireWorkflow extends WorkflowBase {
  
  /**
   * Define tasks for New Hire workflow
   * @returns {Array} Array of task definitions
   */
  defineTasks() {
    return [
      // Sequential: HR Setup must complete first
      {
        type: 'HRSetup',
        dependencies: [],
        required: true,
        assignTo: CONFIG.HR_SETUP_EMAIL,
        metadata: {}
      },
      
      // Sequential: IT Setup depends on HR Setup
      {
        type: 'ITSetup',
        dependencies: ['HRSetup'],
        required: true,
        assignTo: CONFIG.IT_SETUP_EMAIL,
        metadata: {}
      },
      
      // Parallel: These can all run after HR Setup
      {
        type: 'CreditCard',
        dependencies: ['HRSetup'],
        required: false,
        condition: (data) => data['Credit Card'] === 'Yes',
        assignTo: CONFIG.CREDIT_CARD_EMAIL,
        metadata: {}
      },
      
      {
        type: 'Fleetio',
        dependencies: ['HRSetup'],
        required: false,
        condition: (data) => data['Fleetio / Vehicle'] === 'Yes',
        assignTo: CONFIG.FLEETIO_EMAIL,
        metadata: {}
      },
      
      {
        type: 'JR306090',
        dependencies: ['HRSetup'],
        required: false,
        condition: (data) => data['JR'] === 'Yes' || data['30-60-90'] === 'Yes',
        assignTo: CONFIG.JR_306090_EMAIL,
        metadata: {}
      },
      
      {
        type: 'ADPSupervisor',
        dependencies: ['HRSetup'],
        required: false,
        condition: (data) => data['ADP Supervisor Access'] === 'Yes',
        assignTo: CONFIG.ADP_SUPERVISOR_ACCESS_EMAIL,
        metadata: {}
      },
      
      {
        type: 'ADPManager',
        dependencies: ['HRSetup'],
        required: false,
        condition: (data) => data['ADP Manager Access'] === 'Yes',
        assignTo: CONFIG.ADP_MANAGER_ACCESS_EMAIL,
        metadata: {}
      },
      
      {
        type: 'JONAS',
        dependencies: ['HRSetup'],
        required: false,
        condition: (data) => data['JONAS'] === 'Yes',
        assignTo: CONFIG.JONAS_EMAIL,
        metadata: {}
      },
      
      {
        type: 'SiteDocs',
        dependencies: ['HRSetup'],
        required: false,
        condition: (data) => data['SiteDocs'] === 'Yes',
        assignTo: CONFIG.SITEDOCS_EMAIL,
        metadata: {}
      }
    ];
  }
  
  /**
   * Called when workflow completes
   */
  onComplete() {
    super.onComplete();
    
    // Generate final PDF
    // Send completion emails
    // Archive records
    
    Logger.log(`New Hire workflow ${this.workflowId} completed for ${this.workflowData['First Name']} ${this.workflowData['Last Name']}`);
  }
}
