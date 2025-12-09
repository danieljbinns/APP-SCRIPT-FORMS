/**
 * =============================================================================
 * TICKETING API - Integration with External Help Desk Systems
 * =============================================================================
 * 
 * This file contains the integration layer for external ticketing systems
 * like Jira, ServiceNow, Zendesk, Freshdesk, etc.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Enable integration in Config.gs: INTEGRATIONS.ticketing.enabled = true
 * 2. Set system type: INTEGRATIONS.ticketing.system = 'jira'
 * 3. Add API credentials to Script Properties (e.g., JIRA_API_TOKEN)
 * 4. Configure project/board ID
 */

class TicketingAPI {
  
  /**
   * Create a ticket in the external system
   * @param {Object} ticketData - Ticket data
   * @returns {string} External ticket ID
   */
  static createTicket(ticketData) {
    const system = CONFIG.INTEGRATIONS.ticketing.system;
    
    switch(system) {
      case 'jira':
        return this.createJiraTicket(ticketData);
      case 'servicenow':
        return this.createServiceNowTicket(ticketData);
      case 'zendesk':
        return this.createZendeskTicket(ticketData);
      default:
        throw new Error(`Unsupported ticketing system: ${system}`);
    }
  }
  
  /**
   * Get ticket status from external system
   * @param {string} ticketId - External ticket ID
   * @returns {string} Status
   */
  static getTicketStatus(ticketId) {
    const system = CONFIG.INTEGRATIONS.ticketing.system;
    
    switch(system) {
      case 'jira':
        return this.getJiraTicketStatus(ticketId);
      case 'servicenow':
        return this.getServiceNowTicketStatus(ticketId);
      case 'zendesk':
        return this.getZendeskTicketStatus(ticketId);
      default:
        throw new Error(`Unsupported ticketing system: ${system}`);
    }
  }
  
  /**
   * Update ticket in external system
   * @param {string} ticketId - External ticket ID
   * @param {Object} updates - Updates to apply
   */
  static updateTicket(ticketId, updates) {
    const system = CONFIG.INTEGRATIONS.ticketing.system;
    
    switch(system) {
      case 'jira':
        return this.updateJiraTicket(ticketId, updates);
      case 'servicenow':
        return this.updateServiceNowTicket(ticketId, updates);
      case 'zendesk':
        return this.updateZendeskTicket(ticketId, updates);
      default:
        throw new Error(`Unsupported ticketing system: ${system}`);
    }
  }
  
  // ==========================================================================
  // JIRA INTEGRATION
  // ==========================================================================
  
  static createJiraTicket(ticketData) {
    const apiUrl = CONFIG.INTEGRATIONS.ticketing.apiUrl;
    const projectId = CONFIG.INTEGRATIONS.ticketing.projectId;
    const apiToken = PropertiesService.getScriptProperties().getProperty(
      CONFIG.INTEGRATIONS.ticketing.apiKeyProperty
    );
    
    const payload = {
      fields: {
        project: { key: projectId },
        summary: ticketData.summary,
        description: ticketData.description,
        issuetype: { name: 'Task' },
        priority: { name: ticketData.priority },
        assignee: { emailAddress: ticketData.assignee },
        labels: ticketData.labels
      }
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode('email:' + apiToken)
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(`${apiUrl}/rest/api/3/issue`, options);
    const result = JSON.parse(response.getContentText());
    
    return result.key; // Returns: PROJ-123
  }
  
  static getJiraTicketStatus(ticketId) {
    const apiUrl = CONFIG.INTEGRATIONS.ticketing.apiUrl;
    const apiToken = PropertiesService.getScriptProperties().getProperty(
      CONFIG.INTEGRATIONS.ticketing.apiKeyProperty
    );
    
    const options = {
      method: 'get',
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode('email:' + apiToken)
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(`${apiUrl}/rest/api/3/issue/${ticketId}`, options);
    const result = JSON.parse(response.getContentText());
    
    return result.fields.status.name;
  }
  
  static updateJiraTicket(ticketId, updates) {
    const apiUrl = CONFIG.INTEGRATIONS.ticketing.apiUrl;
    const apiToken = PropertiesService.getScriptProperties().getProperty(
      CONFIG.INTEGRATIONS.ticketing.apiKeyProperty
    );
    
    const payload = {
      fields: updates
    };
    
    const options = {
      method: 'put',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode('email:' + apiToken)
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    UrlFetchApp.fetch(`${apiUrl}/rest/api/3/issue/${ticketId}`, options);
  }
  
  // ==========================================================================
  // SERVICENOW INTEGRATION (Stub - implement when needed)
  // ==========================================================================
  
  static createServiceNowTicket(ticketData) {
    throw new Error('ServiceNow integration not yet implemented');
  }
  
  static getServiceNowTicketStatus(ticketId) {
    throw new Error('ServiceNow integration not yet implemented');
  }
  
  static updateServiceNowTicket(ticketId, updates) {
    throw new Error('ServiceNow integration not yet implemented');
  }
  
  // ==========================================================================
  // ZENDESK INTEGRATION (Stub - implement when needed)
  // ==========================================================================
  
  static createZendeskTicket(ticketData) {
    throw new Error('Zendesk integration not yet implemented');
  }
  
  static getZendeskTicketStatus(ticketId) {
    throw new Error('Zendesk integration not yet implemented');
  }
  
  static updateZendeskTicket(ticketId, updates) {
    throw new Error('Zendesk integration not yet implemented');
  }
}

/**
 * SCHEDULED SYNC FUNCTION
 * Set up a time-based trigger to run this every 30 minutes
 * to keep tasks in sync with external tickets
 */
function syncAllTasksWithTickets() {
  if (!CONFIG.INTEGRATIONS.ticketing.enabled || !CONFIG.INTEGRATIONS.ticketing.syncEnabled) {
    return;
  }
  
  const tasks = SheetAccess.getTasksSheet().getDataRange().getValues();
  const headers = tasks[0];
  
  for (let i = 1; i < tasks.length; i++) {
    const taskId = tasks[i][0];
    const status = tasks[i][3];
    const externalTicketId = tasks[i][9]; // External Ticket ID column
    
    // Only sync tasks that are in progress
    if (status === 'In Progress' && externalTicketId) {
      try {
        const task = TaskFactory.load(taskId);
        task.syncWithExternalTicket();
      } catch (error) {
        Logger.log(`Error syncing task ${taskId}: ${error.message}`);
      }
    }
  }
  
  Logger.log('Completed scheduled sync with external tickets');
}
