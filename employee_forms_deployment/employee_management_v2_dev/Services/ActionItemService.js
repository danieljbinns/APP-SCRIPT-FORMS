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
      notifyAdminActionItemFailure(workflowId, category, name, assignedTo, e.message);
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
      const AI = SCHEMA.ACTION_ITEMS;
      const data = sheet.getDataRange().getValues();

      let rowIndex = -1;
      let workflowId = '';

      for (let i = SCHEMA.ROW.FIRST_DATA; i < data.length; i++) {
        if (data[i][AI.TASK_ID] === taskId) {
          rowIndex = i + 1;
          workflowId = data[i][AI.WORKFLOW_ID];
          break;
        }
      }

      if (rowIndex === -1) throw new Error('Task not found: ' + taskId);

      // Guard against double-submit / page reload closing an already-closed task
      const currentStatus = data[rowIndex - 1][AI.STATUS];
      if (currentStatus === 'Closed') {
        Logger.log(`[ActionItemService] Task ${taskId} already closed — ignoring duplicate submission`);
        return { success: false, message: 'This task has already been submitted.' };
      }

      sheet.getRange(rowIndex, AI.STATUS + 1).setValue('Closed');
      sheet.getRange(rowIndex, AI.COMPLETED_DATE + 1).setValue(new Date());
      sheet.getRange(rowIndex, AI.NOTES + 1).setValue(notes);
      sheet.getRange(rowIndex, AI.CLOSED_BY + 1).setValue(closedBy);

      if (draftJSON) {
        sheet.getRange(rowIndex, AI.DRAFT + 1).setValue(draftJSON);
      }

      if (formDataJSON) {
        sheet.getRange(rowIndex, AI.FORM_DATA + 1).setValue(formDataJSON);
      }

      // WIS User + Equipment: write SiteDocs credentials to ID_SETUP_RESULTS
      // so getWorkflowContext() reads them and shows in IT Setup section of emails
      const taskCategory = data[rowIndex - 1][AI.CATEGORY] || '';
      if (taskCategory === 'WIS User' && workflowId.startsWith('EQUIP_REQ_') && formDataJSON) {
        try {
          const creds = JSON.parse(formDataJSON);
          if (creds.siteDocsUsername || creds.bossWisCreated) {
            const idSheet = ss.getSheetByName(CONFIG.SHEETS.ID_SETUP_RESULTS);
            if (idSheet) {
              const ID = SCHEMA.ID_SETUP_RESULTS;
              const idData = idSheet.getDataRange().getValues();
              let idRowIndex = -1;
              for (let j = SCHEMA.ROW.FIRST_DATA; j < idData.length; j++) {
                if (String(idData[j][ID.WORKFLOW_ID]) === workflowId) { idRowIndex = j + 1; break; }
              }
              const idRow = new Array(Math.max(ID.SUBMITTED_BY, ID.SUBMISSION_TS) + 2).fill('');
              idRow[ID.WORKFLOW_ID]       = workflowId;
              idRow[ID.SUBMISSION_TS]     = new Date();
              idRow[ID.SITEDOCS_USERNAME] = creds.siteDocsUsername || '';
              idRow[ID.SITEDOCS_PASSWORD] = creds.siteDocsPassword || '';
              idRow[ID.BOSS_WIS_CREATED]  = creds.bossWisCreated   || '';
              idRow[ID.SUBMITTED_BY]      = closedBy;
              if (idRowIndex !== -1) {
                idSheet.getRange(idRowIndex, 1, 1, idRow.length).setValues([idRow]);
                Logger.log('[ActionItemService] WIS User: updated existing ID_SETUP_RESULTS row ' + idRowIndex + ' for ' + workflowId);
              } else {
                idSheet.appendRow(idRow);
                Logger.log('[ActionItemService] WIS User: appended new ID_SETUP_RESULTS row for ' + workflowId);
              }
              SpreadsheetApp.flush(); // flush again so getWorkflowContext reads fresh data
              Logger.log('[ActionItemService] WIS User: creds written — siteDocsUsername=' + (creds.siteDocsUsername || '(empty)') + ' bossWis=' + (creds.bossWisCreated || '(empty)'));
            }
          }
        } catch (e) { Logger.log('[ActionItemService] WIS User cred write ERROR: ' + e.message + ' stack: ' + e.stack); }
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
      const AI = SCHEMA.ACTION_ITEMS;
      const data = sheet.getDataRange().getValues();

      let rowIndex = -1;
      for (let i = SCHEMA.ROW.FIRST_DATA; i < data.length; i++) {
        if (data[i][AI.TASK_ID] === taskId) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex === -1) throw new Error('Task not found: ' + taskId);

      if (notes !== undefined) sheet.getRange(rowIndex, AI.NOTES + 1).setValue(notes);
      if (draftJSON !== undefined) sheet.getRange(rowIndex, AI.DRAFT + 1).setValue(draftJSON);
      
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
    
    const AI = SCHEMA.ACTION_ITEMS;
    const data = sheet.getDataRange().getValues();

    return data.filter((row, i) => i > SCHEMA.ROW.HEADER && row[AI.WORKFLOW_ID] === workflowId && row[AI.STATUS] === 'Open');
  }

  /**
   * Retrieves specific task detail
   */
  function getTask(taskId) {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
    if (!sheet) return null;
    
    const data = sheet.getDataRange().getValues();
    const headers = data[SCHEMA.ROW.HEADER];

    const rowData = data.find(r => r[SCHEMA.ACTION_ITEMS.TASK_ID] === taskId);
    if (!rowData) return null;

    const task = {};
    headers.forEach((h, i) => task[h.replace(/\s+/g, '')] = rowData[i]);
    return task;
  }

  /**
   * Returns the Set of required specialist category names for an onboarding workflow.
   * Reads the Initial Requests row and mirrors the reqInfo.items flags from StateSync.
   * Returns null if the row can't be found (callers should treat null as "no filter").
   */
  function getRequiredSpecialistCats(ss, workflowId) {
    try {
      const reqSheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
      if (!reqSheet) return null;
      const found = reqSheet.getRange('A:A').createTextFinder(workflowId).matchEntireCell(true).findNext();
      if (!found) return null;
      const row = reqSheet.getRange(found.getRow(), 1, 1, reqSheet.getLastColumn()).getValues()[0];
      const IR = SCHEMA.INITIAL_REQUESTS;
      const cats = new Set();
      if (row[IR.JONAS_JOB_NUMBERS] && String(row[IR.JONAS_JOB_NUMBERS]).length > 0) cats.add('Jonas');
      if (row[IR.CC_USA] === 'Yes' || row[IR.CC_CAN] === 'Yes' || row[IR.CC_HD] === 'Yes')  cats.add('Credit Card');
      if (row[IR.SYSTEMS] && String(row[IR.SYSTEMS]).includes('Fleetio'))                     cats.add('Fleetio');
      if (row[IR.EQUIPMENT] && String(row[IR.EQUIPMENT]).includes('Business Cards'))           cats.add('Business Cards');
      // SiteDocs WIS User action item only created for EQUIP_REQ_ (not New Hire — ID Setup handles it there)
      // This function is only called for NEW_EMP_ workflows, so WIS User is never required here
      if (row[IR.PLAN_306090] === 'Yes') cats.add('30/60/90 Review');
      cats.add('Safety'); // always required for onboarding
      return cats;
    } catch (e) {
      Logger.log('[ActionItemService] getRequiredSpecialistCats error: ' + e.message);
      return null; // fail-open: no filter applied
    }
  }

  /**
   * Checks if a workflow is complete (all non-background tasks closed).
   *
   * Step-based guards:
   *   - 'Specialist Forms Needed'  → onboarding (IT done, specialists outstanding)
   *   - 'Action Items Pending'     → term / position-change / equipment (tasks outstanding)
   *   - 'Email Setup Needed'       → equipment request waiting on Google Account setup only
   *
   * WIS tasks (Category === 'WIS') are background/post-hire — they never block completion.
   * For onboarding 'Specialist Forms Needed', only categories required by the original request
   * are treated as blocking — unrequested specialists never prevent completion.
   */
  function checkWorkflowCompletion(workflowId, suppressNotify) {
    const workflow = getWorkflow(workflowId);
    const currentStep = workflow ? String(workflow['Current Step'] || '') : '';

    // ER-1 FIX: Equipment now routes through submitITSetup → triggerSpecialists.
    // 'Email Setup Needed' step and launchRemainingEquipmentTasks no longer used.
    // Commented out for easy revert.
    /* ER-1 COMMENTED OUT
    if (currentStep === 'Email Setup Needed') {
      // Equipment request: only IT email task(s) pending — when closed, launch remaining tasks
      const pending = getPendingTasks(workflowId);
      if (pending.length === 0) {
        Logger.log(`[ActionItemService] Email Setup closed for ${workflowId}. Launching remaining equipment tasks.`);
        if (typeof launchRemainingEquipmentTasks === 'function') {
          launchRemainingEquipmentTasks(workflowId, true); // skipIT=true — IT tasks already created in phase 1
        }
      }
      return;
    }
    ER-1 COMMENTED OUT END */

    const ALLOWED_STEPS = ['Specialist Forms Needed', 'Action Items Pending'];
    if (!ALLOWED_STEPS.includes(currentStep)) {
      Logger.log(`[ActionItemService] Skipping auto-complete for ${workflowId} — step is '${currentStep}', not in allowed completion steps.`);
      return;
    }

    const AI = SCHEMA.ACTION_ITEMS;
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
    const data = sheet.getDataRange().getValues();

    // For onboarding specialist step, only required categories block completion
    const isOnboarding = currentStep === 'Specialist Forms Needed' &&
                         !workflowId.startsWith('TERM_') &&
                         !workflowId.startsWith('CHANGE_') &&
                         !workflowId.startsWith('EQUIP_REQ_');
    const requiredCats = isOnboarding ? getRequiredSpecialistCats(ss, workflowId) : null;

    const nonWisPending = data.filter(function(row, i) {
      if (i <= SCHEMA.ROW.HEADER)                                   return false;
      if (row[AI.WORKFLOW_ID] !== workflowId)                       return false;
      if (row[AI.STATUS]      !== 'Open')                           return false;
      if (String(row[AI.CATEGORY] || '').toUpperCase() === 'WIS')  return false;
      // For onboarding: unrequired specialist categories are non-blocking
      if (requiredCats !== null) {
        const cat = String(row[AI.CATEGORY] || '');
        if (!requiredCats.has(cat)) return false;
      }
      return true;
    });

    if (nonWisPending.length === 0) {
      Logger.log(`[ActionItemService] All blocking tasks closed for Workflow ${workflowId}. Marking complete.`);
      updateWorkflow(workflowId, 'Complete', 'All Action Items Closed');
      syncWorkflowState(workflowId);

      // Notify HR and Requester of full closure (skip when called from admin recheck)
      if (!suppressNotify) {
        notifyWorkflowClosure(workflowId);
      }
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
      
      // Strip any "- Employee Name" suffix from the task name — buildEmailSubject appends
      // employeeName from contextData, so including it here causes duplication.
      const empName = workflow ? workflow['Employee Name'] : '';
      const baseTaskName = empName && task.TaskName
        ? task.TaskName.replace(new RegExp('\\s*[-\u2014]\\s*' + empName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$'), '').trim()
        : (task.TaskName || task.Category || 'Action Item');
      const subject = `Task Completed: ${baseTaskName}`;
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
              subject: 'Assets Returned: IT Equipment',
              body: itBody,
              contextData: context
            });
          }

          if (financeReturns.length > 0) {
            sendFormEmail({
              to: CONFIG.EMAILS.CREDIT_CARD,
              subject: 'Assets Returned: Credit Card',
              body: `The credit card for ${workflow['Employee Name']} has been collected and is ready for processing.`,
              contextData: context
            });
          }

          if (fleetReturns.length > 0) {
            sendFormEmail({
              to: CONFIG.EMAILS.FLEETIO,
              subject: 'Assets Returned: Vehicle and Keys',
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
      const AI = SCHEMA.ACTION_ITEMS;
      const data = sheet.getDataRange().getValues();

      const wfTasks = data.filter((r, i) => i > SCHEMA.ROW.HEADER && r[AI.WORKFLOW_ID] === workflowId);
      if (wfTasks.length === 0) return;

      const workflow = getWorkflow(workflowId);
      if (!workflow) return;

      let logHtml = `<table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%; color: #333;">
        <tr style="background: #f4f4f4;"><th>Task</th><th>Status</th><th>Completed By</th><th>Notes</th></tr>`;

      wfTasks.forEach(task => {
        logHtml += `<tr>
          <td>${task[AI.TASK_NAME]}</td>
          <td>${task[AI.STATUS]}</td>
          <td>${task[AI.CLOSED_BY]}</td>
          <td>${task[AI.NOTES]}</td>
        </tr>`;
      });
      logHtml += `</table>`;

      const subject = `Workflow Completed: ${workflow['Workflow Name']} (${workflowId})`;
      const body = `All action items for <b>${workflow['Employee Name'] || workflow['Workflow Name']}</b> have been closed.
        <br><br><b>Closure Audit Log:</b><br>${logHtml}`;

      const context = getWorkflowContext(workflowId) || { employeeName: workflow['Employee Name'] };
      if (workflowId.startsWith('TERM_')) context.hrDecision = 'Approved';

      // Equipment: extract SiteDocs credentials from WIS User action item formData (already flushed
      // and present in wfTasks) rather than re-reading ID_SETUP_RESULTS which may be cached
      if (workflowId.startsWith('EQUIP_REQ_')) {
        Logger.log('[notifyWorkflowClosure] wfTasks count=' + wfTasks.length);
        wfTasks.forEach(function(r) {
          Logger.log('[notifyWorkflowClosure] task category=' + r[AI.CATEGORY] + ' formData=' + String(r[AI.FORM_DATA] || '').substring(0, 60));
        });
        const wisTask = wfTasks.find(function(r) { return r[AI.CATEGORY] === 'WIS User' && r[AI.FORM_DATA]; });
        Logger.log('[notifyWorkflowClosure] wisTask found=' + !!wisTask);
        if (wisTask) {
          try {
            const creds = JSON.parse(wisTask[AI.FORM_DATA]);
            Logger.log('[notifyWorkflowClosure] creds.siteDocsUsername=' + creds.siteDocsUsername);
            if (creds.siteDocsUsername) context.siteDocsUsername = creds.siteDocsUsername;
            if (creds.siteDocsPassword) context.siteDocsPassword = creds.siteDocsPassword;
            if (creds.bossWisCreated)   context.bossWisCreated   = creds.bossWisCreated;
            Logger.log('[notifyWorkflowClosure] context.siteDocsUsername set to: ' + context.siteDocsUsername);
          } catch(e) { Logger.log('[notifyWorkflowClosure] WIS User cred parse: ' + e.message); }
        }
      }

      // showPasswords: true + allComplete: true — tells the template all specialists are done
      const closureEmailOpts = { showPasswords: true, allComplete: true };

      // Notify HR
      sendFormEmail({
        to: CONFIG.EMAILS.HR,
        subject: subject,
        body: body,
        contextData: context,
        emailOpts: closureEmailOpts
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
          contextData: context,
          emailOpts: closureEmailOpts
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
