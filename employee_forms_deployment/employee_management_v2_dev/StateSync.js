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
    
    const isTerm = workflowId.startsWith('TERM_');
    const isChange = workflowId.startsWith('CHANGE_');
    const lookupSheetName = isTerm ? CONFIG.SHEETS.TERMINATIONS : (isChange ? CONFIG.SHEETS.POSITION_CHANGES : CONFIG.SHEETS.INITIAL_REQUESTS);
    const lookupSheet = ss.getSheetByName(lookupSheetName);

    const tz = Session.getScriptTimeZone();
    const fmtDate = (v) => v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy/MM/dd') : String(v || '').replace(/-/g, '/');
    const fmtDateTime = (v) => v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy/MM/dd HH:mm') : String(v || '').replace(/-/g, '/');

    const foundReq = lookupSheet ? lookupSheet.getRange("A:A").createTextFinder(workflowId).matchEntireCell(true).findNext() : null;
    if (foundReq) {
      const lastCol = lookupSheet.getLastColumn();
      const reqHeaders = lookupSheet.getRange(1, 1, 1, lastCol).getValues()[0];
      const empTypeIdx = reqHeaders.indexOf('Employment Type');
      const row = lookupSheet.getRange(foundReq.getRow(), 1, 1, lastCol).getValues()[0];
      if (isTerm) {
        // Headers: Workflow ID | Form ID | Timestamp | Req Name | Req Email | Emp Name | ... | Site[11] | Term Date[12] | Manager Name[14] | Manager Email[15]
        reqInfo = {
          requesterName: row[3] || 'Unknown',
          requesterEmail: row[4] || '',
          managerEmail: row[15] || '',
          dateRequested: fmtDate(row[2]),
          hireDate: fmtDate(row[12]), // Term Date → shown in Effective Date column
          site: String(row[11] || ''),
          empType: String(row[7] || ''), // Employee Type
          items: { isTerm: true }
        };
      } else if (isChange) {
        // Headers: Workflow ID | Form ID | Timestamp | Req Name | Req Email | Emp Name | Emp ID | Effective Date[7] | Current Site[8] | ...
        reqInfo = {
          requesterName: row[3] || 'Unknown',
          requesterEmail: row[4] || '',
          managerEmail: '',
          dateRequested: fmtDate(row[2]),
          hireDate: fmtDate(row[7]), // Effective Date → shown in Effective Date column
          site: String(row[8] || ''),
          empType: '',
          items: {}
        };
      } else {
        reqInfo = {
          requesterName: row[4] || 'Unknown',
          requesterEmail: row[5] || '',
          managerEmail: row[17] || '',
          dateRequested: fmtDate(row[3]),
          hireDate: fmtDate(row[6]), // Hire Date → shown in Start Date column
          site: String(row[15] || ''), // Site Name
          empType: empTypeIdx >= 0 ? String(row[empTypeIdx] || '') : '',
          items: {
            jonas: (row[44] && row[44].toString().length > 0),
            creditCard: (row[30] === 'Yes' || row[32] === 'Yes' || row[34] === 'Yes'),
            fleetio: (row[20] && row[20].includes('Fleetio')),
            businessCards: (row[21] && row[21].includes('Business Cards')),
            siteDocs: ((row[20] && row[20].includes('SiteDocs')) || (row[21] && row[21].includes('SiteDocs Tablet'))),
            review: (row[47] === 'Yes'),
            safety: true
          }
        };
      }
    }
    
    // 2. Determine Pre-Calculated Status String
    const baseStatus = wfRow[4]; // 'Pending', 'In Progress', 'Completed', 'Cancelled'
    const currentStep = wfRow[7]; 
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
          const SPECIALIST_CATS = new Set(['Credit Card','Business Cards','Fleetio','Jonas','Central Purchasing','SiteDocs','30/60/90 Review','Safety']);
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
    const lastUpdated = fmtDateTime(wfRow[6]);
    const initEmail = wfRow[3];
    const empName = wfRow[8];

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
      reqInfo.hireDate || '',  // col 11: Start/Effective Date
      reqInfo.site || '',      // col 12: Site
      reqInfo.empType || ''    // col 13: Employment Type
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
