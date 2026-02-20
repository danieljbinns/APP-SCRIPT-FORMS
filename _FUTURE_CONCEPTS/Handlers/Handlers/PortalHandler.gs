/**
 * PortalHandler.gs
 * 
 * Manages the "One-Off Request Portal" for existing employees.
 * Allows requesting single items (e.g. Credit Card, Phone) without full onboarding.
 */

var PortalHandler = (function() {

  /**
   * Processes a single item request.
   * @param {Object} request - { employeeId, itemType, justification }
   */
  function processOneOffRequest(request) {
    if (!request.employeeId || !request.itemType) {
      throw new Error("Missing required fields");
    }

    console.log("Portal Request: " + request.itemType + " for " + request.employeeId);

    // Logic: Create a "Mini Workflow"
    var miniWfId = "REQ_" + request.itemType.toUpperCase().substring(0,3) + "_" + new Date().getTime();

    // Route directly to the specialist
    switch (request.itemType) {
      case 'CREDIT_CARD':
        // Trigger Credit Card Workflow Logic only
        // Specialist.assignTask('CREDIT_CARD', miniWfId, request);
        break;
      case 'PHONE':
        // Specialist.assignTask('IT_ASSET', miniWfId, request);
        break;
      default:
        console.warn("Unknown item type requested: " + request.itemType);
    }
    
    return { success: true, trackingId: miniWfId, message: "Request forwarded to " + request.itemType + " team." };
  }

  return {
    processOneOffRequest: processOneOffRequest
  };

})();
