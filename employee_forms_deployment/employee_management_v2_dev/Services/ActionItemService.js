/**
 * ActionItemService.gs
 *
 * Manages the full lifecycle of Action Items (granular tasks) attached to workflows.
 *
 * ACTION ITEM LIFECYCLE
 * ─────────────────────
 *   createActionItem()  ← called by triggerSpecialists() (ITSetupHandler.js),
 *                          submitPositionChangeApproval() (PositionChangeHandler.js),
 *                          submitTerminationApproval() (TerminationHandler.js),
 *                          sendSafetyOnboardingEmail() (EmailUtils.js)
 *   closeActionItem()   ← called via closeActionItemWithNotes() (global bridge below),
 *                          which is invoked by google.script.run from ActionItemForm.html,
 *                          and directly from submitITSetup() (ITSetupHandler.js) for
 *                          the CHANGE_ IT action item.
 *   checkWorkflowCompletion() ← called at the end of every closeActionItem() and by
 *                               the admin re-check trigger (suppressNotify=true path).
 *   notifyWorkflowClosure()   ← called by checkWorkflowCompletion() when all blocking
 *                               tasks are closed.
 *
 * SHEET WRITES
 * ────────────
 *   ACTION_ITEMS sheet   — one row per task (status, notes, draft, formData)
 *   IT_RESULTS sheet     — written by closeActionItem() when a CHANGE_ IT action item closes
 *   ID_SETUP_RESULTS     — written by closeActionItem() when a EQUIP_REQ_ WIS User item closes
 *
 * KEY DESIGN DECISIONS
 * ────────────────────
 *   - SpreadsheetApp.flush() is called before notifyTaskClosure() / notifyWorkflowClosure()
 *     so that subsequent getWorkflowContext() calls read the freshly-written data.
 *   - WIS category tasks are non-blocking — they never prevent workflow completion.
 *   - For onboarding ('Specialist Forms Needed'), only categories that were actually
 *     requested in the Initial Request are blocking. Unrequested specialists don't stall
 *     the workflow even if their action items are still open.
 */

var ActionItemService = (function() {

  /**
   * Creates a new Action Item (Ticket) and records it in the ACTION_ITEMS sheet.
   *
   * Called by:
   *   - triggerSpecialists()           in ITSetupHandler.js       (New Hire + Equipment)
   *   - submitPositionChangeApproval() in PositionChangeHandler.js (Status Change)
   *   - submitTerminationApproval()    in TerminationHandler.js    (Termination)
   *   - sendSafetyOnboardingEmail()    in EmailUtils.js            (Safety step)
   *
   * On failure, notifyAdminActionItemFailure() is called so admins know to manually
   * create the missed task — the workflow will not auto-complete without it.
   *
   * @param {string} workflowId   - e.g. 'NEW_EMP_XXXX', 'CHANGE_XXXX', 'EQUIP_REQ_XXXX'
   * @param {string} category     - Display grouping shown in dashboard (e.g. 'IT', 'Safety', 'WIS User')
   * @param {string} name         - Human-readable task name shown in the action item form
   * @param {string} description  - JSON array string of checklist items shown in ActionItemForm.html
   * @param {string} assignedTo   - Email address of the responsible party who receives the notification
   * @param {string} [formType]   - Routes the ActionItemForm to the correct specialist view.
   *                                Known values: 'it_setup', 'creditcard', 'businesscards',
   *                                'fleetio', 'jonas', 'review_306090', 'safety_onboarding',
   *                                'safety_change', 'wis', 'wis_user'
   * @returns {string|null} taskId — generated 'TK-XXXXXXXX' identifier, or null on failure
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
   * Closes an Action Item, optionally writing secondary sheet records, then triggers
   * completion checking and task-closure notification emails.
   *
   * Called by:
   *   - closeActionItemWithNotes() (global bridge below) — invoked from ActionItemForm.html
   *     via google.script.run when any specialist submits their form.
   *   - submitITSetup() in ITSetupHandler.js — directly closes the IT action item for
   *     CHANGE_ workflows after writing IT_RESULTS.
   *   - _sdCloseAllAI() in SuperDebug.js — auto-closes all open items during test runs.
   *
   * SECONDARY SHEET WRITES (two special cases handled here)
   * ─────────────────────────────────────────────────────────
   * 1. CHANGE_ + category='IT' + formType='it_setup':
   *    Parses formDataJSON and appends a row to IT_RESULTS so that
   *    getWorkflowContext() can read the IT Setup results in the same execution
   *    (used by notifyWorkflowClosure to populate the IT Setup section of the email).
   *    SpreadsheetApp.flush() is called immediately after so getWorkflowContext
   *    reads fresh data when notifyWorkflowClosure fires next.
   *
   * 2. EQUIP_REQ_ + category='WIS User':
   *    Parses formDataJSON for SiteDocs credentials and writes (or updates if already
   *    present) a row in ID_SETUP_RESULTS. This mirrors what the ID Setup form writes
   *    for New Hire workflows. SpreadsheetApp.flush() is called so notifyWorkflowClosure
   *    can pull the credentials from ID_SETUP_RESULTS via getWorkflowContext(), or from
   *    the wfTasks snapshot taken in notifyWorkflowClosure() itself.
   *
   * DOUBLE-SUBMIT GUARD
   * ───────────────────
   * The current status is re-read from the sheet before any write. If already 'Closed',
   * the function returns early with success:false. This prevents a browser page-reload
   * from duplicating the close action or sending duplicate emails.
   *
   * @param {string} taskId         - e.g. 'TK-A1B2C3D4'
   * @param {string} notes          - Closure notes entered by the specialist
   * @param {string} closedBy       - Email of the submitting user (Session.getActiveUser())
   * @param {string} [draftJSON]    - Full checklist draft state (stringified JSON array)
   * @param {string} [formDataJSON] - Specialist form data (stringified JSON object).
   *                                  Required for IT action items (CHANGE_) and WIS User
   *                                  action items (EQUIP_REQ_) to trigger secondary writes.
   * @returns {{ success: boolean, message?: string }}
   */
  function closeActionItem(taskId, notes, closedBy, draftJSON, formDataJSON) {
    try {
      const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      const sheet = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
      const AI = SCHEMA.ACTION_ITEMS;
      const data = sheet.getDataRange().getValues();

      let rowIndex = -1;
      let workflowId = '';

      // Scan the ACTION_ITEMS sheet for this taskId (column AI.TASK_ID)
      for (let i = SCHEMA.ROW.FIRST_DATA; i < data.length; i++) {
        if (data[i][AI.TASK_ID] === taskId) {
          rowIndex = i + 1; // sheet rows are 1-based; data array is 0-based
          workflowId = data[i][AI.WORKFLOW_ID];
          break;
        }
      }

      if (rowIndex === -1) throw new Error('Task not found: ' + taskId);

      // Guard against double-submit / page reload closing an already-closed task.
      // Re-reading from the cached `data` array (not re-fetching) is intentional —
      // the array was read at the top of this call and reflects the state at that point.
      const currentStatus = data[rowIndex - 1][AI.STATUS];
      if (currentStatus === 'Closed') {
        Logger.log(`[ActionItemService] Task ${taskId} already closed — ignoring duplicate submission`);
        return { success: false, message: 'This task has already been submitted.' };
      }

      // Write core closure fields to the ACTION_ITEMS sheet row
      sheet.getRange(rowIndex, AI.STATUS + 1).setValue('Closed');
      sheet.getRange(rowIndex, AI.COMPLETED_DATE + 1).setValue(new Date());
      sheet.getRange(rowIndex, AI.NOTES + 1).setValue(notes);
      sheet.getRange(rowIndex, AI.CLOSED_BY + 1).setValue(closedBy);

      // Persist draft checklist state (set by ActionItemForm.html's autosave)
      if (draftJSON) {
        sheet.getRange(rowIndex, AI.DRAFT + 1).setValue(draftJSON);
      }

      // Persist specialist form data (IT Setup, WIS User credentials, etc.)
      if (formDataJSON) {
        sheet.getRange(rowIndex, AI.FORM_DATA + 1).setValue(formDataJSON);
      }

      // ── SPECIAL CASE 1: Status Change IT Setup ────────────────────────────────
      // When a CHANGE_ workflow's IT action item (category='IT', formType='it_setup') is
      // closed, its formDataJSON must also be written to IT_RESULTS so that
      // getWorkflowContext() returns a fully-populated context for notifyWorkflowClosure().
      //
      // WHY here and not in submitITSetup()?
      // For CHANGE_ workflows, IT submits via the standard ITSetup.html form, which calls
      // submitITSetup() → which directly calls closeActionItem() passing formData as
      // formDataJSON. The IT_RESULTS write is duplicated here so that _sdCloseAllAI()
      // (SuperDebug) and any other caller that closes the action item directly also
      // correctly populates IT_RESULTS without requiring submitITSetup() to be in the call chain.
      const taskCategory2 = data[rowIndex - 1][AI.CATEGORY] || '';
      const taskFormType2 = data[rowIndex - 1][AI.FORM_TYPE] || '';
      if (taskCategory2 === 'IT' && taskFormType2 === 'it_setup' && workflowId.startsWith('CHANGE_') && formDataJSON) {
        try {
          const itd = JSON.parse(formDataJSON);
          const itSheet2 = ss.getSheetByName(CONFIG.SHEETS.IT_RESULTS);
          if (itSheet2) {
            const IT2 = SCHEMA.IT_RESULTS;
            // Only build assignedEmail when IT confirmed the account was actually created.
            // An empty string is falsy and will not appear in emails or recipient lists.
            const ae2 = (itd.Email_Created === 'Yes' && itd.Email_Username)
              ? (String(itd.Email_Username).replace(/^"|"$/g, '') + (itd.Email_Domain || '')) : '';
            // bossDetails is a structured sub-object injected by submitITSetup() / _sdCloseAllAI()
            const bd2 = itd.bossDetails || { committees: [], costSheets: [], tripReports: '', grievances: '' };
            // Build a 23-element array matching SCHEMA.IT_RESULTS column indices (0-based)
            const itRow2 = new Array(23).fill('');
            itRow2[IT2.WORKFLOW_ID]          = workflowId;
            itRow2[IT2.SUBMISSION_TS]        = new Date();
            itRow2[IT2.EMAIL_CREATED]        = itd.Email_Created || 'No';
            itRow2[IT2.ASSIGNED_EMAIL]       = ae2;
            itRow2[IT2.EMAIL_PASSWORD]       = itd.Email_Temp_Password || '';
            itRow2[IT2.COMPUTER_ASSIGNED]    = itd.Computer_Assigned || 'No';
            itRow2[IT2.COMPUTER_SERIAL]      = itd.Computer_Serial || '';
            itRow2[IT2.COMPUTER_MODEL]       = itd.Computer_Model || '';
            itRow2[IT2.COMPUTER_TYPE]        = itd.Computer_Type || '';
            itRow2[IT2.PHONE_ASSIGNED]       = itd.Phone_Assigned || 'No';
            itRow2[IT2.PHONE_CARRIER]        = itd.Phone_Carrier || '';
            itRow2[IT2.PHONE_MODEL]          = itd.Phone_Model || '';
            itRow2[IT2.PHONE_NUMBER]         = itd.Phone_Number || '';
            itRow2[IT2.PHONE_VM_PASSWORD]    = itd.Phone_VM_Password || '';
            itRow2[IT2.BOSS_ACCESS]          = itd.BOSS_Access || 'No';
            itRow2[IT2.INCIDENTS_ACCESS]     = itd.Incidents_Access || 'No';
            itRow2[IT2.CAA_ACCESS]           = itd.CAA_Access || 'No';
            itRow2[IT2.DELIVERY_APP_ACCESS]  = itd.Delivery_App_Access || 'No';
            itRow2[IT2.NET_PROMOTER_ACCESS]  = itd.Net_Promoter_Score_Access || 'No';
            itRow2[IT2.IT_NOTES]             = itd.IT_Notes || '';
            itRow2[IT2.SUBMITTED_BY]         = closedBy;
            itRow2[IT2.BOSS_DETAILS]         = JSON.stringify(bd2);
            itSheet2.appendRow(itRow2);
            // Flush immediately: notifyWorkflowClosure() is called after the outer flush
            // and its call to getWorkflowContext() reads IT_RESULTS. Without this flush,
            // the freshly-appended row would not be visible in the same script execution.
            SpreadsheetApp.flush();
            Logger.log('[ActionItemService] CHANGE_ IT Setup written to IT_RESULTS for ' + workflowId);
          }
        } catch(e) { Logger.log('[ActionItemService] CHANGE_ IT write: ' + e.message); }
      }

      // ── SPECIAL CASE 2: Equipment Request WIS User credentials ───────────────
      // When the ID Setup team closes the 'WIS User' action item for an EQUIP_REQ_
      // workflow, the SiteDocs credentials they entered (siteDocsUsername, siteDocsPassword,
      // bossWisCreated) must be persisted to ID_SETUP_RESULTS.
      //
      // WHY ID_SETUP_RESULTS and not just formData on the action item?
      // getWorkflowContext() reads ID_SETUP_RESULTS to populate context.siteDocsUsername
      // and related fields (used in the IT Setup section of email templates for Equipment
      // Request emails). notifyWorkflowClosure() also reads the creds directly from the
      // wfTasks snapshot (faster, avoids re-reading a potentially-cached sheet).
      //
      // UPDATE vs INSERT: if a row for this workflowId already exists in ID_SETUP_RESULTS
      // (e.g. from a re-submission), it is updated in-place rather than appended,
      // preventing duplicate rows from appearing in the dashboard/emails.
      const taskCategory = data[rowIndex - 1][AI.CATEGORY] || '';
      if (taskCategory === 'WIS User' && workflowId.startsWith('EQUIP_REQ_') && formDataJSON) {
        try {
          const creds = JSON.parse(formDataJSON);
          // Only write if meaningful data was provided — avoids creating empty rows
          if (creds.siteDocsUsername || creds.bossWisCreated) {
            const idSheet = ss.getSheetByName(CONFIG.SHEETS.ID_SETUP_RESULTS);
            if (idSheet) {
              const ID = SCHEMA.ID_SETUP_RESULTS;
              const idData = idSheet.getDataRange().getValues();
              let idRowIndex = -1;
              for (let j = SCHEMA.ROW.FIRST_DATA; j < idData.length; j++) {
                if (String(idData[j][ID.WORKFLOW_ID]) === workflowId) { idRowIndex = j + 1; break; }
              }
              // Allocate array large enough to cover all used schema indices
              const idRow = new Array(Math.max(ID.SUBMITTED_BY, ID.SUBMISSION_TS) + 2).fill('');
              idRow[ID.WORKFLOW_ID]       = workflowId;
              idRow[ID.SUBMISSION_TS]     = new Date();
              idRow[ID.SITEDOCS_USERNAME] = creds.siteDocsUsername || '';
              idRow[ID.SITEDOCS_PASSWORD] = creds.siteDocsPassword || '';
              idRow[ID.BOSS_WIS_CREATED]  = creds.bossWisCreated   || '';
              idRow[ID.SUBMITTED_BY]      = closedBy;
              if (idRowIndex !== -1) {
                // Overwrite existing row in-place (prevents duplicates on re-submission)
                idSheet.getRange(idRowIndex, 1, 1, idRow.length).setValues([idRow]);
                Logger.log('[ActionItemService] WIS User: updated existing ID_SETUP_RESULTS row ' + idRowIndex + ' for ' + workflowId);
              } else {
                idSheet.appendRow(idRow);
                Logger.log('[ActionItemService] WIS User: appended new ID_SETUP_RESULTS row for ' + workflowId);
              }
              // Flush so that getWorkflowContext() (called from notifyWorkflowClosure below)
              // reads the freshly-written credentials from ID_SETUP_RESULTS.
              SpreadsheetApp.flush();
              Logger.log('[ActionItemService] WIS User: creds written — siteDocsUsername=' + (creds.siteDocsUsername || '(empty)') + ' bossWis=' + (creds.bossWisCreated || '(empty)'));
            }
          }
        } catch (e) { Logger.log('[ActionItemService] WIS User cred write ERROR: ' + e.message + ' stack: ' + e.stack); }
      }

      // Ensure all writes above are committed before notifyTaskClosure / checkWorkflowCompletion
      // read the sheet. GAS batches Spreadsheet API calls; flush() forces immediate commit.
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
   * Builds a Set of specialist category names that are required (blocking) for a given
   * New Hire (NEW_EMP_) workflow. Used by checkWorkflowCompletion() to decide which
   * open action items actually prevent workflow completion.
   *
   * WHY THIS IS NEEDED
   * ──────────────────
   * triggerSpecialists() creates action items for every specialist requested at submit time.
   * If, say, a Credit Card action item was created but the employee doesn't actually need it
   * (e.g. the original form was corrected), we don't want that open item to permanently block
   * workflow completion. This function re-reads the original request to derive the authoritative
   * list of required categories.
   *
   * CATEGORIES ALWAYS ADDED
   * ───────────────────────
   *   'Safety' — always required for onboarding (Safety Onboarding action item always created).
   *
   * CATEGORIES CONDITIONALLY ADDED (mirrors triggerSpecialists() logic in ITSetupHandler.js)
   * ──────────────────────────────────────────────────────────────────────────────────────────
   *   'Jonas'          — JONAS_JOB_NUMBERS not empty
   *   'Credit Card'    — CC_USA or CC_CAN or CC_HD === 'Yes'
   *   'Fleetio'        — SYSTEMS contains 'Fleetio'
   *   'Business Cards' — EQUIPMENT contains 'Business Cards'
   *   '30/60/90 Review'— PLAN_306090 === 'Yes'
   *
   * CATEGORIES NEVER ADDED HERE
   * ────────────────────────────
   *   'WIS User' — SiteDocs WIS User action items are only created for EQUIP_REQ_ workflows,
   *                not New Hire. For New Hire, SiteDocs is handled in ID Setup.
   *   'WIS'      — WIS Assignment tasks are explicitly excluded from blocking in
   *                checkWorkflowCompletion() (category uppercased check for 'WIS').
   *
   * FAIL-OPEN BEHAVIOUR
   * ───────────────────
   * Returns null if the Initial Requests row cannot be found or any error occurs.
   * Callers must treat null as "no filter" — i.e. ALL open items are blocking.
   *
   * Called exclusively by checkWorkflowCompletion() for onboarding workflows.
   *
   * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss - Already-opened spreadsheet instance
   * @param {string} workflowId - NEW_EMP_ workflow ID
   * @returns {Set<string>|null} Set of blocking category names, or null on lookup failure
   */
  function getRequiredSpecialistCats(ss, workflowId) {
    try {
      const reqSheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
      if (!reqSheet) return null;
      // Use TextFinder for O(n) column-A scan — faster than getDataRange() on large sheets
      const found = reqSheet.getRange('A:A').createTextFinder(workflowId).matchEntireCell(true).findNext();
      if (!found) return null;
      const row = reqSheet.getRange(found.getRow(), 1, 1, reqSheet.getLastColumn()).getValues()[0];
      const IR = SCHEMA.INITIAL_REQUESTS;
      const cats = new Set();
      if (row[IR.JONAS_JOB_NUMBERS] && String(row[IR.JONAS_JOB_NUMBERS]).length > 0) cats.add('Jonas');
      if (row[IR.CC_USA] === 'Yes' || row[IR.CC_CAN] === 'Yes' || row[IR.CC_HD] === 'Yes')  cats.add('Credit Card');
      if (row[IR.SYSTEMS] && String(row[IR.SYSTEMS]).includes('Fleetio'))                     cats.add('Fleetio');
      if (row[IR.EQUIPMENT] && String(row[IR.EQUIPMENT]).includes('Business Cards'))           cats.add('Business Cards');
      // SiteDocs WIS User action item only created for EQUIP_REQ_ (not New Hire — ID Setup handles it there).
      // This function is only called for NEW_EMP_ workflows, so WIS User is never required here.
      if (row[IR.PLAN_306090] === 'Yes') cats.add('30/60/90 Review');
      cats.add('Safety'); // always required for onboarding — Safety Onboarding AI always created
      return cats;
    } catch (e) {
      Logger.log('[ActionItemService] getRequiredSpecialistCats error: ' + e.message);
      return null; // fail-open: no filter → treat all open items as blocking
    }
  }

  /**
   * Checks whether all blocking Action Items for a workflow are closed and, if so,
   * marks the workflow Complete and fires the closure notification email.
   *
   * Called automatically at the end of every closeActionItem() call. Can also be
   * called manually from an admin trigger (pass suppressNotify=true to skip emails).
   *
   * STEP-BASED GUARDS
   * ─────────────────
   * Only runs the completion check when 'Current Step' is one of:
   *   'Specialist Forms Needed' — onboarding: IT is done, specialists are in progress
   *   'Action Items Pending'    — termination, status change, or equipment: tasks in progress
   *
   * If the step is anything else (e.g. 'HR Approval Needed', 'IT Setup Needed',
   * 'Complete', 'Rejected'), the check is skipped entirely.
   *
   * BLOCKING TASK FILTER
   * ─────────────────────
   * 1. WIS category (category.toUpperCase() === 'WIS') — always non-blocking.
   *    WIS Assignment tasks are background/post-hire and should never stall completion.
   *
   * 2. Onboarding 'Specialist Forms Needed' — only categories required by the original
   *    request (read via getRequiredSpecialistCats()) are blocking. An unrequested
   *    specialist action item that was created by mistake does not prevent completion.
   *    If getRequiredSpecialistCats() returns null (lookup failure), all open items
   *    are treated as blocking (fail-safe).
   *
   * 3. All other steps — every non-WIS open item is blocking.
   *
   * ON COMPLETION
   * ─────────────
   * When nonWisPending.length === 0:
   *   1. updateWorkflow() marks the Workflows sheet row as 'Complete'
   *   2. syncWorkflowState() updates Dashboard_View
   *   3. notifyWorkflowClosure() sends the summary email to HR + Initiator + Manager
   *      (skipped when suppressNotify=true — used by admin re-check triggers)
   *
   * @param {string}  workflowId
   * @param {boolean} [suppressNotify] - Pass true to skip the closure notification email
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
   * Sends a "Workflow Completed" summary email to HR, the Initiator, and the Manager.
   * Called exclusively by checkWorkflowCompletion() after all blocking tasks close.
   *
   * CONTEXT ENRICHMENT (three workflow-type-specific blocks below)
   * ──────────────────────────────────────────────────────────────
   * getWorkflowContext() builds a base context from INITIAL_REQUESTS (or the
   * TERM_/CHANGE_ specific sheets). This function then enriches that context with
   * data that only exists at closure time:
   *
   * 1. TERM_ workflows — hrDecision forced to 'Approved' (workflow cannot reach
   *    Complete without being approved). No further enrichment needed; TERMINATION_APPROVALS
   *    data is already embedded by getWorkflowContext() for TERM_ workflows.
   *
   * 2. CHANGE_ workflows — HR approval data:
   *    getWorkflowContext() returns early for CHANGE_ workflows (see the early-return
   *    bug note in EmailUtils.js), so it never reaches the POSITION_CHANGE_APPROVALS read
   *    in that function. This block compensates by reading POSITION_CHANGE_APPROVALS
   *    directly from the same Spreadsheet instance (already flushed in
   *    submitPositionChangeApproval()), extracting: hrDecision, hrNotes,
   *    confirmedTitle, confirmedNewManager, hrSubmittedBy, hrTimestamp.
   *
   *    CHANGE_ IT Setup data:
   *    For CHANGE_ workflows, getWorkflowContext() reads IT_RESULTS (written by the
   *    closeActionItem() CHANGE_ branch above, already flushed). However, since GAS
   *    may cache the sheet in the same execution, this block also reads the IT formData
   *    directly from the wfTasks snapshot (in-memory, no round-trip) as a belt-and-suspenders
   *    measure and overlays all IT fields onto context.
   *
   * 3. EQUIP_REQ_ workflows — SiteDocs credentials:
   *    getWorkflowContext() reads ID_SETUP_RESULTS for Equipment workflows, which was
   *    written and flushed by the closeActionItem() WIS User branch above. However, sheet
   *    caching in the same GAS execution can cause stale reads. This block reads credentials
   *    directly from the wfTasks in-memory snapshot (guaranteed fresh — same array that was
   *    populated at the top of this function) as the primary source.
   *
   * EMAIL OPTIONS
   * ─────────────
   * Both HR and requester/manager emails are sent with:
   *   showPasswords: true  — reveals Google temp password and credential passwords
   *   allComplete: true    — tells buildNewHireContextBlock / buildStatusChangeContextBlock
   *                          / buildTerminationContextBlock to flip all sections to
   *                          '✓ Complete' status rather than 'In Progress'
   *
   * @param {string} workflowId
   */
  function notifyWorkflowClosure(workflowId) {
    try {
      const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      const sheet = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
      const AI = SCHEMA.ACTION_ITEMS;
      const data = sheet.getDataRange().getValues();

      // Collect all action item rows for this workflow — used for the audit log table
      // and to extract formData from specialist items (IT, WIS User) without re-reading sheets
      const wfTasks = data.filter((r, i) => i > SCHEMA.ROW.HEADER && r[AI.WORKFLOW_ID] === workflowId);
      if (wfTasks.length === 0) return;

      const workflow = getWorkflow(workflowId);
      if (!workflow) return;

      // Build an HTML audit table of all tasks for the body of the closure email
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

      // Base context: built from INITIAL_REQUESTS (New Hire / Equipment) or the
      // workflow-specific sheet (TERM_ / CHANGE_) via getWorkflowContext()
      const context = getWorkflowContext(workflowId) || { employeeName: workflow['Employee Name'] };

      // ── ENRICH 1: Termination — force hrDecision = 'Approved' ─────────────────
      // Termination workflows cannot reach 'Complete' without HR approval, so this
      // is always a safe assumption. The flag flips HR Approval section to '✓ Approved'
      // and unlocks Sections 3-6 in buildTerminationContextBlock().
      if (workflowId.startsWith('TERM_'))    context.hrDecision = 'Approved';

      // ── ENRICH 2: Status Change — HR approval details ──────────────────────────
      // getWorkflowContext() for CHANGE_ returns early (see EmailUtils.js) and never
      // reaches its POSITION_CHANGE_APPROVALS read block, so we must read it here.
      // The same SpreadsheetApp instance (ss) is used — the approval row was already
      // flushed by submitPositionChangeApproval() before action items were created.
      if (workflowId.startsWith('CHANGE_') && !context.hrDecision) context.hrDecision = 'Approved';
      if (workflowId.startsWith('CHANGE_') && !context.hrNotes) {
        try {
          const pcaSheet = ss.getSheetByName(CONFIG.SHEETS.POSITION_CHANGE_APPROVALS);
          Logger.log('[notifyWorkflowClosure] CHANGE_ pcaSheet found=' + !!pcaSheet + ' sheetName=' + CONFIG.SHEETS.POSITION_CHANGE_APPROVALS);
          if (pcaSheet) {
            const pcaData = pcaSheet.getDataRange().getValues();
            Logger.log('[notifyWorkflowClosure] CHANGE_ pcaData rows=' + pcaData.length + ' workflowId=' + workflowId);
            // POSITION_CHANGE_APPROVALS columns: [0] WorkflowId, [2] Timestamp, [3] Decision,
            //   [4] Notes, [5] ConfirmedTitle, [6] ConfirmedNewManager, [7] SubmittedBy
            const pcaRow = pcaData.find(function(r) { return r[0] === workflowId; });
            Logger.log('[notifyWorkflowClosure] CHANGE_ pcaRow found=' + !!pcaRow + (pcaRow ? ' notes=' + pcaRow[4] : ''));
            if (pcaRow) {
              if (pcaRow[3] && !context.hrDecision) context.hrDecision    = String(pcaRow[3]);
              if (pcaRow[4]) context.hrNotes         = String(pcaRow[4]);
              if (pcaRow[5]) context.confirmedTitle  = String(pcaRow[5]);
              if (pcaRow[6]) context.confirmedNewManager = String(pcaRow[6]);
              if (pcaRow[7]) context.hrSubmittedBy   = String(pcaRow[7]);
              if (pcaRow[2]) context.hrTimestamp     = pcaRow[2] instanceof Date
                ? Utilities.formatDate(pcaRow[2], Session.getScriptTimeZone(), 'MMM d, yyyy · h:mm a')
                : String(pcaRow[2]);
            }
          }
        } catch(e) { Logger.log('[notifyWorkflowClosure] CHANGE_ approval read: ' + e.message); }
      }

      // ── ENRICH 2b: Status Change — IT Setup results ────────────────────────────
      // For CHANGE_ workflows, the IT action item's formData contains all the IT Setup
      // fields. Although closeActionItem() already wrote these to IT_RESULTS (and
      // getWorkflowContext() reads IT_RESULTS), GAS may cache the sheet object and return
      // stale values in the same execution. Reading from wfTasks directly is guaranteed
      // to be fresh (in-memory, populated from the ACTION_ITEMS data read at the top).
      if (workflowId.startsWith('CHANGE_')) {
        const itTask = wfTasks.find(function(r) { return r[AI.CATEGORY] === 'IT' && r[AI.FORM_TYPE] === 'it_setup' && r[AI.FORM_DATA]; });
        if (itTask) {
          try {
            const itd = JSON.parse(itTask[AI.FORM_DATA]);
            // Build assignedEmail only when the account was actually created
            const ae = (itd.Email_Created === 'Yes' && itd.Email_Username)
              ? (String(itd.Email_Username).replace(/^"|"$/g, '') + (itd.Email_Domain || '')) : '';
            if (ae)                   context.assignedEmail     = ae;
            if (itd.Email_Temp_Password) context.emailTempPassword = itd.Email_Temp_Password;
            // Use current time as itTimestamp since IT_RESULTS was just written in this execution
            context.itTimestamp   = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d, yyyy · h:mm a');
            context.itSubmittedBy = itTask[AI.CLOSED_BY] || '';
            context.computerAssigned = itd.Computer_Assigned || '';
            context.computerModel    = itd.Computer_Model    || '';
            context.computerType     = itd.Computer_Type     || '';
            context.computerSerial   = itd.Computer_Serial   || '';
            context.phoneAssigned    = itd.Phone_Assigned    || '';
            context.phoneCarrier     = itd.Phone_Carrier     || '';
            context.phoneModel       = itd.Phone_Model       || '';
            context.phoneNumber      = itd.Phone_Number      || '';
            context.phoneVMPassword  = itd.Phone_VM_Password || '';
            context.bossAccess       = itd.BOSS_Access       || '';
            context.incidentsAccess  = itd.Incidents_Access  || '';
            context.caaAccess        = itd.CAA_Access        || '';
            context.deliveryAppAccess= itd.Delivery_App_Access || '';
            context.netPromoterAccess= itd.Net_Promoter_Score_Access || '';
            context.itNotes          = itd.IT_Notes          || '';
            if (itd.bossDetails) context.bossDetails = itd.bossDetails;
          } catch(e) { Logger.log('[notifyWorkflowClosure] CHANGE_ IT parse: ' + e.message); }
        }
      }

      // ── ENRICH 3: Equipment — SiteDocs credentials from WIS User action item ──
      // For EQUIP_REQ_ workflows, the WIS User action item's formData contains the
      // SiteDocs credentials. closeActionItem() already flushed these to ID_SETUP_RESULTS,
      // but reading from wfTasks (in-memory snapshot) avoids any sheet caching risk.
      // These fields populate the SiteDocs Login / SiteDocs Pwd rows in the IT Setup
      // section of buildNewHireContextBlock() when isEquipment=true.
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

      // showPasswords: true — reveals Google temp password and credential passwords to recipients
      // allComplete: true  — signals email template builders to render all sections as '✓ Complete'
      //                      (used by buildNewHireContextBlock, buildTerminationContextBlock,
      //                       buildStatusChangeContextBlock in EmailTemplates.js)
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

// ================================================================
// GLOBAL BRIDGES
// These top-level functions are required by google.script.run, which can only
// call named top-level functions — it cannot invoke module methods directly.
// ActionItemForm.html calls both of these via google.script.run.withSuccessHandler().
// ================================================================

/**
 * Google Script Run bridge — closes an Action Item from the ActionItemForm.html client.
 *
 * The closedBy email is resolved server-side from the authenticated session, so the
 * client cannot supply or spoof the closer identity.
 *
 * @param {string} taskId         - Task ID (e.g. 'TK-A1B2C3D4')
 * @param {string} notes          - Closure notes from the specialist
 * @param {string|null} draftJSON - Final checklist draft state (JSON string)
 * @param {string|null} formDataJSON - Specialist form data (JSON string) — required for
 *                                    IT (CHANGE_) and WIS User (EQUIP_REQ_) to trigger
 *                                    secondary sheet writes in closeActionItem()
 * @returns {{ success: boolean, message?: string }}
 */
function closeActionItemWithNotes(taskId, notes, draftJSON, formDataJSON) {
  return ActionItemService.closeActionItem(taskId, notes, Session.getActiveUser().getEmail(), draftJSON, formDataJSON);
}

/**
 * Google Script Run bridge — saves a draft (partial checklist + notes) without closing.
 * Called on autosave timer and on explicit "Save Draft" button clicks in ActionItemForm.html.
 *
 * @param {string} taskId    - Task ID
 * @param {string} notes     - Current notes text (may be empty)
 * @param {string} draftJSON - JSON string of partial checklist state
 * @returns {{ success: boolean, message?: string }}
 */
function saveActionItemDraft(taskId, notes, draftJSON) {
  return ActionItemService.saveActionItemDraft(taskId, notes, draftJSON);
}
