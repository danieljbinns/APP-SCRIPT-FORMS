/**
 * ActionItemService.gs
 * 
 * Manages the lifecycle of granular tasks (Action Items) associated with workflows.
 */

var ActionItemService = (function() {

  /**
   * Creates a new Action Item (Ticket)
   * @param {string} workflowId
   * @param {string} category   - Display category (e.g. 'Credit Card', 'Safety')
   * @param {string} name       - Task name
   * @param {string} description - Checklist items as JSON array string
   * @param {string} assignedTo  - Email of responsible party
   * @param {string} [formType]  - Specialist form type key (e.g. 'creditcard', 'safety_onboarding')
   * @returns {string|null} taskId
   */
  function createActionItem(workflowId, category, name, description, assignedTo, formType) {
    try {
      const taskId = "TK-" + Utilities.getUuid().substring(0, 8).toUpperCase();
      const rowData = [
        workflowId,
        taskId,
        category,
        name,
        description,
        assignedTo,
        'Open',
        new Date(),
        '', // Completed Date
        '', // Notes
        '', // Closed By
        '', // Draft
        formType || '', // Form Type
        ''  // Form Data
      ];

      addSheetRow(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.ACTION_ITEMS, rowData);
      Logger.log(`[ActionItemService] Created Task ${taskId} (${formType || 'no-form'}) for Workflow ${workflowId}`);
      return taskId;
    } catch (e) {
      Logger.log(`[ERROR] Failed to create action item: ${e.message}`);
      return null;
    }
  }

  /**
   * Closes an Action Item
   * @param {string} taskId
   * @param {string} notes
   * @param {string} closedBy
   * @param {string} [draftJSON]    - Full checklist draft state JSON
   * @param {string} [formDataJSON] - Specialist-specific structured form data JSON
   */
  function closeActionItem(taskId, notes, closedBy, draftJSON, formDataJSON) {
    try {
      const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      const sheet = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      
      const taskIdCol = headers.indexOf('Task ID');
      const statusCol = headers.indexOf('Status');
      const compDateCol = headers.indexOf('Completed Date');
      const notesCol = headers.indexOf('Notes');
      const closedByCol = headers.indexOf('Closed By');
      const wfIdCol = headers.indexOf('Workflow ID');
      
      let rowIndex = -1;
      let workflowId = '';
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][taskIdCol] === taskId) {
          rowIndex = i + 1;
          workflowId = data[i][wfIdCol];
          break;
        }
      }
      
      if (rowIndex === -1) throw new Error('Task not found: ' + taskId);
      
      sheet.getRange(rowIndex, statusCol + 1).setValue('Closed');
      sheet.getRange(rowIndex, compDateCol + 1).setValue(new Date());
      sheet.getRange(rowIndex, notesCol + 1).setValue(notes);
      sheet.getRange(rowIndex, closedByCol + 1).setValue(closedBy);
      
      const draftCol = headers.indexOf('Draft');
      if (draftCol !== -1 && draftJSON) {
        sheet.getRange(rowIndex, draftCol + 1).setValue(draftJSON);
      }

      const formDataCol = headers.indexOf('Form Data');
      if (formDataCol !== -1 && formDataJSON) {
        sheet.getRange(rowIndex, formDataCol + 1).setValue(formDataJSON);
      }

      // Ensure data is written before notifyTaskClosure reads it
      SpreadsheetApp.flush();
      
      Logger.log(`[ActionItemService] Closed Task ${taskId}`);
      
      // Notify responsible parties that THIS item is closed
      notifyTaskClosure(taskId, notes, closedBy);
      
      // Check if all tasks for this workflow are closed
      checkWorkflowCompletion(workflowId);
      
      return { success: true };
    } catch (e) {
      Logger.log(`[ERROR] Failed to close action item: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  /**
   * Saves a draft state (partial checklist + notes)
   */
  function saveActionItemDraft(taskId, notes, draftJSON) {
    try {
      const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      const sheet = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      
      const taskIdCol = headers.indexOf('Task ID');
      const notesCol = headers.indexOf('Notes');
      let draftCol = headers.indexOf('Draft');
      
      // Auto-append Draft column if it doesn't exist (schema migration)
      if (draftCol === -1) {
        draftCol = headers.length;
        sheet.getRange(1, draftCol + 1).setValue('Draft');
      }
      
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][taskIdCol] === taskId) {
          rowIndex = i + 1;
          break;
        }
      }
      
      if (rowIndex === -1) throw new Error('Task not found: ' + taskId);
      
      if (notesCol !== -1 && notes !== undefined) sheet.getRange(rowIndex, notesCol + 1).setValue(notes);
      if (draftCol !== -1 && draftJSON !== undefined) sheet.getRange(rowIndex, draftCol + 1).setValue(draftJSON);
      
      Logger.log(`[ActionItemService] Saved draft for Task ${taskId}`);
      return { success: true };
    } catch (e) {
      Logger.log(`[ERROR] Failed to save draft: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  /**
   * Returns all pending (Open) tasks for a workflow
   */
  function getPendingTasks(workflowId) {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
    if (!sheet) return [];
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const wfIdCol = headers.indexOf('Workflow ID');
    const statusCol = headers.indexOf('Status');
    
    return data.filter((row, i) => i > 0 && row[wfIdCol] === workflowId && row[statusCol] === 'Open');
  }

  /**
   * Retrieves specific task detail
   */
  function getTask(taskId) {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
    if (!sheet) return null;
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const taskIdCol = headers.indexOf('Task ID');
    
    const rowData = data.find(r => r[taskIdCol] === taskId);
    if (!rowData) return null;
    
    const task = {};
    headers.forEach((h, i) => task[h.replace(/\s+/g, '')] = rowData[i]);
    return task;
  }

  /**
   * Checks if a workflow is complete (all tasks closed)
   */
  function checkWorkflowCompletion(workflowId) {
    const pending = getPendingTasks(workflowId);
    if (pending.length === 0) {
      Logger.log(`[ActionItemService] All tasks closed for Workflow ${workflowId}. Marking complete.`);
      updateWorkflow(workflowId, 'Complete', 'All Action Items Closed');
      syncWorkflowState(workflowId);

      // Notify HR and Requester of full closure
      notifyWorkflowClosure(workflowId);
    }
  }

  /**
   * Sends an immediate notification when a specific task is closed
   */
  function notifyTaskClosure(taskId, notes, closedBy) {
    try {
      const task = getTask(taskId);
      if (!task) return;

      const workflow = getWorkflow(task.WorkflowID);
      const context = getWorkflowContext(task.WorkflowID) || {};
      
      const subject = `Task Completed: ${task.TaskName} - ${workflow ? workflow['Employee Name'] : 'Action Item'}`;
      let body = `The following action item has been marked as <b>Closed</b>.
        <br><br><b>Task:</b> ${task.TaskName}
        <br><b>Completed By:</b> ${closedBy}
        <br><b>Closure Notes:</b> ${notes || 'None'}
        <br><br><b>Employee:</b> ${workflow ? workflow['Employee Name'] : 'N/A'}`;

      // 1. ASSET SPECIFIC NOTIFICATIONS
      if (task.Category === 'Assets') {
        try {
          const draft = task.Draft ? JSON.parse(task.Draft) : { items: {} };
          const items = draft.items || {};
          
          let itemSummary = '<br><br><b>Asset Status Details:</b><br><table width="100%" style="font-size:12px; border-collapse:collapse;">';
          itemSummary += '<tr><th align="left">Item</th><th align="left">Status</th><th align="left">Comments/Serial</th></tr>';

          const itReturns = [];
          const financeReturns = [];
          const fleetReturns = [];
          
          for (let itemName in items) {
            const status = items[itemName].status;
            const comments = items[itemName].comments || '';
            const serial = items[itemName].serial || '';
            
            itemSummary += `<tr><td style="border-bottom:1px solid #eee; padding:5px;">${itemName}</td>`;
            itemSummary += `<td style="border-bottom:1px solid #eee; padding:5px;">${status}</td>`;
            itemSummary += `<td style="border-bottom:1px solid #eee; padding:5px;">${serial ? 'S/N: '+serial : ''} ${comments}</td></tr>`;

            if (status === 'Collected') {
              if (['Computer/Laptop', 'Mobile Phone', 'Tablet'].includes(itemName)) itReturns.push(itemName);
              if (itemName === 'Credit Card') financeReturns.push(itemName);
              if (itemName === 'Vehicle and Keys') fleetReturns.push(itemName);
            }
          }
          itemSummary += '</table>';
          body += itemSummary;
          
          if (itReturns.length > 0) {
            let itBody = `The following IT assets have been collected from ${workflow['Employee Name']}:<br><ul>`;
            itReturns.forEach(item => {
              let line = item;
              if (item === 'Mobile Phone' && context.empPhone) {
                line += ` (Number: ${context.empPhone})`;
              }
              itBody += `<li>${line}</li>`;
            });
            itBody += `</ul>`;

            sendFormEmail({
              to: CONFIG.EMAILS.IT,
              subject: `Assets Returned: IT Equipment - ${workflow['Employee Name']}`,
              body: itBody,
              contextData: context
            });
          }
          
          if (financeReturns.length > 0) {
            sendFormEmail({
              to: CONFIG.EMAILS.CREDIT_CARD,
              subject: `Assets Returned: Credit Card - ${workflow['Employee Name']}`,
              body: `The credit card for ${workflow['Employee Name']} has been collected and is ready for processing.`,
              contextData: context
            });
          }
          
          if (fleetReturns.length > 0) {
            sendFormEmail({
              to: CONFIG.EMAILS.FLEETIO,
              subject: `Assets Returned: Vehicle and Keys - ${workflow['Employee Name']}`,
              body: `The vehicle and keys for ${workflow['Employee Name']} have been collected.`,
              contextData: context
            });
          }
        } catch (err) {
          Logger.log('Error parsing draft for asset notifications: ' + err.toString());
        }
      }

    } catch (e) {
      Logger.log('[ERROR] Failed to send task closure notification: ' + e.message);
    }
  }

  /**
   * Sends a summary email when all tasks are complete
   */
  function notifyWorkflowClosure(workflowId) {
    try {
      const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      const sheet = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const wfIdCol = headers.indexOf('Workflow ID');
      
      const wfTasks = data.filter(r => r[wfIdCol] === workflowId);
      if (wfTasks.length === 0) return;

      const workflow = getWorkflow(workflowId);
      if (!workflow) return;

      let logHtml = `<table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%; color: #333;">
        <tr style="background: #f4f4f4;"><th>Task</th><th>Status</th><th>Completed By</th><th>Notes</th></tr>`;
      
      wfTasks.forEach(task => {
        logHtml += `<tr>
          <td>${task[headers.indexOf('Task Name')]}</td>
          <td>${task[headers.indexOf('Status')]}</td>
          <td>${task[headers.indexOf('Closed By')]}</td>
          <td>${task[headers.indexOf('Notes')]}</td>
        </tr>`;
      });
      logHtml += `</table>`;

      const subject = `Workflow Completed: ${workflow['Workflow Name']} (${workflowId})`;
      const body = `All action items for <b>${workflow['Employee Name'] || workflow['Workflow Name']}</b> have been closed.
        <br><br><b>Closure Audit Log:</b><br>${logHtml}`;

      const context = getWorkflowContext(workflowId) || { employeeName: workflow['Employee Name'] };

      // Notify HR
      sendFormEmail({
        to: CONFIG.EMAILS.HR,
        subject: subject,
        body: body,
        contextData: context
      });

      // Notify Initiator & Manager
      const recipients = [];
      if (workflow['Initiator Email']) recipients.push(workflow['Initiator Email']);
      if (context.managerEmail && !recipients.includes(context.managerEmail)) recipients.push(context.managerEmail);

      if (recipients.length > 0) {
        sendFormEmail({
          to: recipients.join(','),
          subject: subject,
          body: body,
          contextData: context
        });
      }

    } catch(e) {
      Logger.log('[ERROR] Failed to send closure notification: ' + e.message);
    }
  }

  /**
   * Serves the Action Item (Ticket) View
   */
  function serveActionItem(taskId) {
    const template = HtmlService.createTemplateFromFile('ActionItemForm');
    const task = getTask(taskId);
    template.task = task;
    template.context = task ? getWorkflowContext(task.WorkflowID) : null;
    return template.evaluate()
      .setTitle('Action Item: ' + (task ? task.TaskName : 'Not Found'))
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return {
    createActionItem: createActionItem,
    closeActionItem: closeActionItem,
    saveActionItemDraft: saveActionItemDraft,
    getPendingTasks: getPendingTasks,
    getTask: getTask,
    checkWorkflowCompletion: checkWorkflowCompletion,
    serveActionItem: serveActionItem,
    notifyTaskClosure: notifyTaskClosure
  };

})();

/**
 * Global bridge for google.script.run
 */
function closeActionItemWithNotes(taskId, notes, draftJSON, formDataJSON) {
  return ActionItemService.closeActionItem(taskId, notes, Session.getActiveUser().getEmail(), draftJSON, formDataJSON);
}

function saveActionItemDraft(taskId, notes, draftJSON) {
  return ActionItemService.saveActionItemDraft(taskId, notes, draftJSON);
}
