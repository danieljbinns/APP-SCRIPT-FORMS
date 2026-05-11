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
    const wfId = data[i][0];
    if (wfId && String(wfId).trim() !== '') {
      syncWorkflowState(wfId);
    }
  }
  
  Logger.log('Batch sync complete.');
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
                          : isEquip  ? CONFIG.SHEETS.EQUIPMENT_REQUESTS
                          :            CONFIG.SHEETS.INITIAL_REQUESTS;
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
        // Equipment_Requests: WorkflowID[0] | FormID[1] | Timestamp[2] | ReqName[3] | ReqEmail[4]
        //   | FirstName[5] | LastName[6] | Site[7] | Position[8] | ManagerName[9] | ManagerEmail[10]
        //   | Equipment[11] | Systems[12] | Comments[13] | Department[14]
        const EQ = SCHEMA.EQUIPMENT_REQUESTS;
        reqInfo = {
          requesterName:  row[EQ.REQUESTER_NAME]        || 'Unknown',
          requesterEmail: row[EQ.REQUESTER_EMAIL]        || '',
          managerEmail:   row[EQ.MANAGER_EMAIL]          || '',
          dateRequested:  fmtDate(row[EQ.TIMESTAMP]),    // Timestamp as request date
          hireDate:       '',                            // No start date for equipment requests
          site:           String(row[EQ.SITE_NAME]      || ''),
          empType:        '',
          items:          { isEquip: true }
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
            jonas:         (row[IR.JONAS_JOB_NUMBERS] && row[IR.JONAS_JOB_NUMBERS].toString().length > 0),
            creditCard:    (row[IR.CC_USA] === 'Yes' || row[IR.CC_CAN] === 'Yes' || row[IR.CC_HD] === 'Yes'),
            fleetio:       (row[IR.SYSTEMS] && row[IR.SYSTEMS].includes('Fleetio')),
            businessCards: (row[IR.EQUIPMENT] && row[IR.EQUIPMENT].includes('Business Cards')),
            siteDocs:      ((row[IR.SYSTEMS] && row[IR.SYSTEMS].includes('SiteDocs')) || (row[IR.EQUIPMENT] && row[IR.EQUIPMENT].includes('SiteDocs Tablet'))),
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
          for (let i = 1; i < aiData.length; i++) {
            if (String(aiData[i][wfCol]) !== workflowId) continue;
            const cat = String(aiData[i][catCol] || '');
            if (!SPECIALIST_CATS.has(cat)) continue;
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
