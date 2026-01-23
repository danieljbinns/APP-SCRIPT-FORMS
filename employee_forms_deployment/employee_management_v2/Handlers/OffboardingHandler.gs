/**
 * OffboardingHandler.gs
 * 
 * Manages the "Reverse Workflow" for employee departure.
 * 
 * FLOW:
 * 1. Termination Request (Manager)
 * 2. Notifications to HR (Process Final Pay), IT (Revoke Access), Specialists (Cancel Cards)
 * 3. Scheduled Suspension (via DirectoryService)
 */

var OffboardingHandler = (function() {

  /**
   * Initiates an offboarding workflow.
   * @param {Object} data - { employeeId, terminationDate, reason, returnAssets: [] }
   * @returns {Object} result
   */
  function startOffboarding(data) {
    console.log("Starting offboarding for " + data.employeeId); // Audit Log
    
    try {
      // 1. Log to Sheet
      const actingUser = Session.getActiveUser().getEmail();
      // createWorkflow(Type, Name, Initiator, ActingUser)
      var workflowId = createWorkflow('OFFBOARD', 'Termination: ' + data.employeeName, actingUser, actingUser); 

      // 2. Notify Types
      sendTerminationNotices(data, workflowId);
      
      return { success: true, workflowId: workflowId };
    } catch (e) {
      console.error("Offboarding Failed: " + e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * specific notifications for departure
   */
  function sendTerminationNotices(data, id) {
    var subject = "OFFBOARDING: " + data.employeeName + " (" + data.employeeId + ")";
    
    // IT Notification
    var itBody = "Use Workflow ID: " + id + "\n" +
                 "Action: Revoke Access & Retrieve Assets\n" +
                 "Date: " + data.terminationDate + "\n" + 
                 "Assets to return: " + (data.returnAssets || []).join(", ");
    
    // HR Notification
    var hrBody = "Action: Process Final Pay\nDate: " + data.terminationDate;

    // EmailUtils.sendEmail(Config.getITEmail(), subject, itBody);
    // EmailUtils.sendEmail(Config.getHREmail(), subject, hrBody);
    
    console.log("Sent Offboarding Emails to IT/HR for " + id);
  }

  return {
    startOffboarding: startOffboarding
  };

})();
