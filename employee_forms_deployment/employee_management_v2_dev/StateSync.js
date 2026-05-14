/**
 * State Synchronization Service (Materialized View)
 * This script runs autonomously in the background to calculate the exact status of a workflow
 * across all sheets and writes the final string to the 'Dashboard_View' sheet.
 * This guarantees that the Dashboard UI can load in < 0.2s by simply reading one flat sheet.
 */

function manuallySyncAllWorkflows() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const wfSheet = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
  if (!wfSheet) return;

  const data = wfSheet.getDataRange().getValues();
  if (data.length <= 1) return;

  Logger.log(`Beginning batch sync of ${data.length - 1} workflows into Dashboard_View...`);

  for (let i = 1; i < data.length; i++) {
    const wfId    = data[i][0];
    const wfStatus = String(data[i][SCHEMA.WORKFLOWS.STATUS] || '');
    if (wfId && String(wfId).trim() !== '' && wfStatus !== 'Inactive') {
      syncWorkflowState(wfId);
    }
  }

  Logger.log('Batch sync complete.');

  // Re-check any workflows that were stuck at Specialist Forms Needed before
  // the required-specialist filter was deployed. Calling checkWorkflowCompletion
  // here is safe — it only fires updateWorkflow/notifyWorkflowClosure when ALL
  // required categories are truly closed, and it skips non-Specialist steps.
  recheckStuckSpecialistCompletions();
}

/**
 * Re-runs checkWorkflowCompletion for every onboarding workflow that is
 * still sitting at 'Specialist Forms Needed' with status 'In Progress'.
 *
 * Use case: deployed the required-specialist filter AFTER some action items
 * were already closed, so the completion check never re-fired with the fix.
 * Running manuallySyncAllWorkflows() (or this function directly) will
 * retroactively complete any workflow whose required specialists are all closed.
 */
function recheckStuckSpecialistCompletions() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const wfSheet = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
  if (!wfSheet) return;

  const WF = SCHEMA.WORKFLOWS;
  const data = wfSheet.getDataRange().getValues();
  let rechecked = 0;

  for (let i = SCHEMA.ROW.FIRST_DATA; i < data.length; i++) {
    const wfId     = String(data[i][WF.WORKFLOW_ID]   || '').trim();
    const status   = String(data[i][WF.STATUS]        || '');
    const step     = String(data[i][WF.CURRENT_STEP]  || '');

    // Only onboarding workflows stuck at Specialist Forms Needed
    if (!wfId)                                   continue;
    if (status   !== 'In Progress')              continue;
    if (step     !== 'Specialist Forms Needed')  continue;
    if (wfId.startsWith('TERM_'))                continue;
    if (wfId.startsWith('CHANGE_'))              continue;
    if (wfId.startsWith('EQUIP_REQ_'))           continue;

    Logger.log(`[recheckStuck] Re-checking completion for ${wfId}...`);
    ActionItemService.checkWorkflowCompletion(wfId, true); // suppressNotify=true: no closure emails on retroactive recheck
    rechecked++;
  }

  Logger.log(`[recheckStuck] Done. Re-checked ${rechecked} workflow(s).`);
}

/**
 * Syncs a single workflow ID to the Dashboard_View sheet.
 * Called automatically at the end of every form submission handler.
 */
function syncWorkflowState(workflowId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const viewSheet = ss.getSheetByName(CONFIG.SHEETS.DASHBOARD_VIEW);
    if (!viewSheet) {
      Logger.log('Cannot sync: Dashboard_View sheet does not exist.');
      return;
    }
    
    // 1. Gather all base data from Workflows and Initial Requests
    const wfSheet = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
    const reqSheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
    
    const foundWf = wfSheet.getRange("A:A").createTextFinder(workflowId).matchEntireCell(true).findNext();
    if (!foundWf) return; // Workflow doesn't exist
    const wfRow = wfSheet.getRange(foundWf.getRow(), 1, 1, 9).getValues()[0];
    
    let reqInfo = { 
      requesterName: 'Unknown', requesterEmail: '', managerEmail: '', 
      dateRequested: '', items: {} 
    };
    
    const isTerm   = workflowId.startsWith('TERM_');
    const isChange = workflowId.startsWith('CHANGE_');
    const isEquip  = workflowId.startsWith('EQUIP_REQ_');
    const lookupSheetName = isTerm   ? CONFIG.SHEETS.TERMINATIONS
                          : isChange ? CONFIG.SHEETS.POSITION_CHANGES
                          :            CONFIG.SHEETS.INITIAL_REQUESTS; // equipment + new hire both use Initial_Requests
    const lookupSheet = ss.getSheetByName(lookupSheetName);

    const tz = Session.getScriptTimeZone();
    const fmtDate = (v) => v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : String(v || '').replace(/\//g, '-').substring(0, 10);
    const fmtDateTime = (v) => v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd HH:mm:ss') : (function(s){ if(!s) return ''; s = s.replace(/\//g,'-'); try{ var d=new Date(s); if(!isNaN(d.getTime())) return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'); }catch(e){} return s; })(String(v||''));

    const searchCol = 'A:A'; // Workflow ID is always in column A across all sheets
    const foundReq = lookupSheet ? lookupSheet.getRange(searchCol).createTextFinder(workflowId).matchEntireCell(true).findNext() : null;
    if (foundReq) {
      const lastCol = lookupSheet.getLastColumn();
      const reqHeaders = lookupSheet.getRange(1, 1, 1, lastCol).getValues()[0];
      const empTypeIdx = reqHeaders.indexOf('Employment Type');
      const row = lookupSheet.getRange(foundReq.getRow(), 1, 1, lastCol).getValues()[0];
      if (isTerm) {
        const TR = SCHEMA.TERMINATIONS;
        reqInfo = {
          requesterName:  row[TR.REQUESTER_NAME]  || 'Unknown',
          requesterEmail: row[TR.REQUESTER_EMAIL]  || '',
          managerEmail:   row[TR.MANAGER_EMAIL]    || '',
          dateRequested:  fmtDate(row[TR.TIMESTAMP]),
          hireDate:       fmtDate(row[TR.TERM_DATE]), // Term Date → shown in Effective Date column
          site:           String(row[TR.SITE]      || ''),
          empType:        String(row[TR.EMPLOYEE_TYPE] || ''),
          items: { isTerm: true }
        };
      } else if (isChange) {
        const PC = SCHEMA.POSITION_CHANGES;
        const classChange = String(row[PC.CLASSIFICATION] || '');
        const classOld = classChange.includes(' -> ') ? classChange.split(' -> ')[0].trim() : '';
        const currentClass = String(row[PC.CURRENT_CLASS] || '');
        const empTypeFromClass = (classOld && classOld !== 'N/A') ? classOld : (currentClass || '');
        reqInfo = {
          requesterName:  row[PC.REQUESTER_NAME]   || 'Unknown',
          requesterEmail: row[PC.REQUESTER_EMAIL]   || '',
          managerEmail:   String(row[PC.CURRENT_MANAGER_EMAIL] || ''),
          dateRequested:  fmtDate(row[PC.TIMESTAMP]),
          hireDate:       fmtDate(row[PC.EFFECTIVE_DATE]), // Effective Date → shown in Effective Date column
          site:           String(row[PC.CURRENT_SITE] || ''),
          empType:        empTypeFromClass,
          items: {}
        };
      } else if (isEquip) {
        // Equipment requests now stored in Initial_Requests — use IR schema
        const IR = SCHEMA.INITIAL_REQUESTS;
        reqInfo = {
          requesterName:  row[IR.REQUESTER_NAME]   || 'Unknown',
          requesterEmail: row[IR.REQUESTER_EMAIL]   || '',
          managerEmail:   row[IR.MANAGER_EMAIL]     || '',
          dateRequested:  fmtDate(row[IR.DATE_REQUESTED]),
          hireDate:       '',                        // No start date for equipment requests
          site:           String(row[IR.SITE_NAME] || ''),
          empType:        '',
          items:          { isEquip: true }          // Different action item routing vs new hire
        };
      } else {
        const IR = SCHEMA.INITIAL_REQUESTS;
        reqInfo = {
          requesterName:  row[IR.REQUESTER_NAME]   || 'Unknown',
          requesterEmail: row[IR.REQUESTER_EMAIL]   || '',
          managerEmail:   row[IR.MANAGER_EMAIL]     || '',
          dateRequested:  fmtDate(row[IR.DATE_REQUESTED]),
          hireDate:       fmtDate(row[IR.HIRE_DATE]), // Hire Date → shown in Start Date column
          site:           String(row[IR.SITE_NAME]  || ''),
          empType:        empTypeIdx >= 0 ? String(row[empTypeIdx] || '') : '',
          items: {
            // !! coerces to boolean — the && short-circuit returns the left operand
            // (falsy non-boolean) when the field is empty, which breaks the type-guard
            // in the filter below. Always a proper true/false here.
            jonas:         !!(row[IR.JONAS_JOB_NUMBERS] && String(row[IR.JONAS_JOB_NUMBERS]).trim().length > 0),
            creditCard:    (row[IR.CC_USA] === 'Yes' || row[IR.CC_CAN] === 'Yes' || row[IR.CC_HD] === 'Yes'),
            fleetio:       !!(row[IR.SYSTEMS] && String(row[IR.SYSTEMS]).includes('Fleetio')),
            businessCards: !!(row[IR.EQUIPMENT] && String(row[IR.EQUIPMENT]).includes('Business Cards')),
            siteDocs:      !!((row[IR.SYSTEMS] && String(row[IR.SYSTEMS]).includes('SiteDocs')) || (row[IR.EQUIPMENT] && String(row[IR.EQUIPMENT]).includes('SiteDocs Tablet'))),
            review:        (row[IR.PLAN_306090] === 'Yes'),
            safety:        true
          }
        };
      }
    }
    
    // 2. Determine Pre-Calculated Status String
    const baseStatus  = wfRow[SCHEMA.WORKFLOWS.STATUS];        // 'Pending', 'In Progress', 'Completed', 'Cancelled'
    const currentStep = wfRow[SCHEMA.WORKFLOWS.CURRENT_STEP];
    let granularStatus = currentStep;
    
    if (baseStatus !== 'Cancelled' && baseStatus !== 'Completed') {
      if (currentStep === 'Specialist Forms Needed') {
        // Check Action Items sheet for open specialist tasks
        const aiSheet = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
        const pending = [];
        if (aiSheet) {
          const aiData = aiSheet.getDataRange().getValues();
          const aiHdrs = aiData[0];
          const wfCol = aiHdrs.indexOf('Workflow ID');
          const catCol = aiHdrs.indexOf('Category');
          const stCol  = aiHdrs.indexOf('Status');
          const SPECIALIST_CATS = new Set(['Credit Card','Business Cards','Fleetio','Jonas','SiteDocs','30/60/90 Review','Safety']);
          // Map category → reqInfo.items key so we can skip unrequired specialists
          const CAT_ITEMS_KEY = {
            'Jonas': 'jonas', 'Credit Card': 'creditCard', 'Fleetio': 'fleetio',
            'Business Cards': 'businessCards', 'SiteDocs': 'siteDocs',
            '30/60/90 Review': 'review', 'Safety': 'safety'
          };
          for (let i = 1; i < aiData.length; i++) {
            if (String(aiData[i][wfCol]) !== workflowId) continue;
            const cat = String(aiData[i][catCol] || '');
            if (!SPECIALIST_CATS.has(cat)) continue;
            // For onboarding workflows, skip categories the request didn't require
            if (!isTerm && !isChange && !isEquip) {
              const key = CAT_ITEMS_KEY[cat];
              if (key && typeof reqInfo.items[key] === 'boolean' && !reqInfo.items[key]) continue;
            }
            if (String(aiData[i][stCol]) !== 'Closed') pending.push(cat);
          }
        }
        if (pending.length > 0) {
          granularStatus = 'Pending: ' + pending.join(', ');
        } else {
          granularStatus = 'All Specialists Complete';
        }
      } else if (currentStep === 'IT Setup Needed') {
        const sheet = ss.getSheetByName(CONFIG.SHEETS.IT_RESULTS);
        const done = sheet && sheet.getRange("A:A").createTextFinder(workflowId).matchEntireCell(true).findNext() !== null;
        if (!done) granularStatus = 'Pending: IT Setup';
      } else if (currentStep === 'ID Setup Needed') {
        granularStatus = 'Pending: ID Setup';
      }
    }
    
    // 3. Prepare the flat row for the View sheet
    // Headers: Workflow ID | Employee Name | Global Status | Granular Step Details | Requester Name | Requester Email | Initiator Email | Date Requested | Last Updated | Manager Email | Requested Items JSON | Start/Term Date | Site
    const lastUpdated = fmtDateTime(wfRow[SCHEMA.WORKFLOWS.LAST_UPDATED]);
    const initEmail   = wfRow[SCHEMA.WORKFLOWS.INITIATOR_EMAIL];
    const empName     = wfRow[SCHEMA.WORKFLOWS.EMPLOYEE_NAME];

    const outputRow = [
      workflowId,
      empName,
      baseStatus,
      granularStatus,
      reqInfo.requesterName,
      reqInfo.requesterEmail,
      initEmail,
      reqInfo.dateRequested,
      lastUpdated,
      reqInfo.managerEmail,
      JSON.stringify(reqInfo.items),
      reqInfo.hireDate || '',  // DASHBOARD_VIEW.HIRE_DATE (col 11): Start/Effective Date
      reqInfo.site || '',      // DASHBOARD_VIEW.SITE (col 12): Site
      reqInfo.empType || ''    // DASHBOARD_VIEW.EMPLOYMENT_TYPE (col 13): Employment Type
    ];

    // 4. Overwrite or Append to Dashboard_View
    const foundView = viewSheet.getRange("A:A").createTextFinder(workflowId).matchEntireCell(true).findNext();
    if (foundView) {
      viewSheet.getRange(foundView.getRow(), 1, 1, 14).setValues([outputRow]);
    } else {
      viewSheet.appendRow(outputRow);
    }
    
    Logger.log(`Successfully synced state for ${workflowId} to view sheet.`);
    
  } catch (error) {
    Logger.log(`Error syncing state for ${workflowId}: ${error.message}`);
  }
}
