/**
 * =============================================================================
 * CONCRETE TASK IMPLEMENTATIONS
 * =============================================================================
 * 
 * This file contains concrete implementations of tasks used in workflows.
 */

// ===========================================================================
// CREDIT CARD TASK
// ===========================================================================

class CreditCardTask extends TaskBase {
  
  execute() {
    this.start();
  }
  
  getAssigneeEmail() {
    return CONFIG.CREDIT_CARD_EMAIL;
  }
  
  getFormHtml() {
    return 'CreditCardForm.html';
  }
  
  getTitle() {
    return 'Credit Card Request';
  }
}

// ===========================================================================
// FLEETIO TASK
// ===========================================================================

class FleetioTask extends TaskBase {
  
  execute() {
    this.start();
  }
  
  getAssigneeEmail() {
    return CONFIG.FLEETIO_EMAIL;
  }
  
  getFormHtml() {
    return 'FleetioForm.html';
  }
  
  getTitle() {
    return 'Fleetio / Vehicle Setup';
  }
}

// ===========================================================================
// IT SETUP TASK
// ===========================================================================

class ITSetupTask extends TaskBase {
  
  execute() {
    this.start();
  }
  
  getAssigneeEmail() {
    return CONFIG.IT_SETUP_EMAIL;
  }
  
  getFormHtml() {
    return 'ITSetup.html';
  }
  
  getTitle() {
    return 'IT Setup';
  }
}

// ===========================================================================
// HR SETUP TASK
// ===========================================================================

class HRSetupTask extends TaskBase {
  
  execute() {
    this.start();
  }
  
  getAssigneeEmail() {
    return CONFIG.HR_SETUP_EMAIL;
  }
  
  getFormHtml() {
    return 'HR.html';
  }
  
  getTitle() {
    return 'HR Setup';
  }
}

// ===========================================================================
// JR/30-60-90 TASK
// ===========================================================================

class JR306090Task extends TaskBase {
  
  execute() {
    this.start();
  }
  
  getAssigneeEmail() {
    return CONFIG.JR_306090_EMAIL;
  }
  
  getFormHtml() {
    return 'JR306090Form.html';
  }
  
  getTitle() {
    return 'JR / 30-60-90 Plan';
  }
}

// ===========================================================================
// ADP SUPERVISOR ACCESS TASK
// ===========================================================================

class ADPSupervisorTask extends TaskBase {
  
  execute() {
    this.start();
  }
  
  getAssigneeEmail() {
    return CONFIG.ADP_SUPERVISOR_ACCESS_EMAIL;
  }
  
  getFormHtml() {
    return 'ParallelTaskForm.html';
  }
  
  getTitle() {
    return 'ADP Supervisor Access';
  }
}

// ===========================================================================
// ADP MANAGER ACCESS TASK
// ===========================================================================

class ADPManagerTask extends TaskBase {
  
  execute() {
    this.start();
  }
  
  getAssigneeEmail() {
    return CONFIG.ADP_MANAGER_ACCESS_EMAIL;
  }
  
  getFormHtml() {
    return 'ParallelTaskForm.html';
  }
  
  getTitle() {
    return 'ADP Manager Access';
  }
}

// ===========================================================================
// JONAS TASK
// ===========================================================================

class JONASTask extends TaskBase {
  
  execute() {
    this.start();
  }
  
  getAssigneeEmail() {
    return CONFIG.JONAS_EMAIL;
  }
  
  getFormHtml() {
    return 'ParallelTaskForm.html';
  }
  
  getTitle() {
    return 'JONAS Setup';
  }
}

// ===========================================================================
// SITEDOCS TASK
// ===========================================================================

class SiteDocsTask extends TaskBase {
  
  execute() {
    this.start();
  }
  
  getAssigneeEmail() {
    return CONFIG.SITEDOCS_EMAIL;
  }
  
  getFormHtml() {
    return 'ParallelTaskForm.html';
  }
  
  getTitle() {
    return 'SiteDocs Setup';
  }
}
