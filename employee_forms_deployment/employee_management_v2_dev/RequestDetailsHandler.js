/**
 * RequestDetailsHandler.js
 *
 * Serves the RequestDetails page and supplies read-only data for the
 * workflow drill-down view (header snapshot, checklist, step data modals).
 *
 * ACTIONS (cancel / bump / updateHireDate) live in RequestActionsHandler.js.
 *
 * Depends on (global GAS scope):
 *   CONFIG, SCHEMA                          — SchemaConstants.js / Config.js
 *   AccessControlService                    — Services/AccessControlService.js
 *   getBaseUrl()                            — Router.js
 *   getWorkflow(), getWorkflowContext()     — WorkflowManager.js
 */

// ─────────────────────────────────────────────────────────────────────────────
// SERVE
// ─────────────────────────────────────────────────────────────────────────────

function serveRequestDetails(workflowId) {
  const template = HtmlService.createTemplateFromFile('RequestDetails');
  template.baseUrl    = getBaseUrl();
  template.workflowId = workflowId || '';
  return template.evaluate()
    .setTitle('Request Details')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// bumpRequest, updateHireDate, cancelRequest → RequestActionsHandler.js

// ─────────────────────────────────────────────────────────────────────────────
// FLIGHT CHECK (checklist + snapshot for the RequestDetails page)
// ─────────────────────────────────────────────────────────────────────────────

function getRequestDetails(workflowId) {
  try {
    if (!workflowId) return { success: false, message: 'No workflow ID provided' };
    if (workflowId.startsWith('TERM_'))      return getTerminationDetails(workflowId);
    if (workflowId.startsWith('CHANGE_'))    return getChangeDetails(workflowId);
    if (workflowId.startsWith('EQUIP_REQ_')) return getEquipmentRequestDetails(workflowId);

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const context = { success: true, id: workflowId, checklist: [] };

    const reqSheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
    if (!reqSheet) return { success: false, message: 'Initial Requests sheet missing' };

    const foundReq = reqSheet.getRange('A:A').createTextFinder(workflowId).matchEntireCell(true).findNext();
    if (!foundReq) return { success: false, message: 'Request ID not found in database' };

    const reqRowIndex = foundReq.getRow();
    const reqLastCol  = reqSheet.getLastColumn();
    const reqHeaders  = reqSheet.getRange(1, 1, 1, reqLastCol).getValues()[0];
    const reqRow      = reqSheet.getRange(reqRowIndex, 1, 1, reqLastCol).getValues()[0];

    const _tz = Session.getScriptTimeZone();
    const r = {};
    reqHeaders.forEach(function(h, i) {
      if (!h) return;
      const val = reqRow[i];
      r[h] = val instanceof Date
        ? Utilities.formatDate(val, _tz, 'M/d/yyyy')
        : (val === undefined || val === null ? '' : String(val));
    });

    // Merge HR verified title
    const hrSheet = ss.getSheetByName(CONFIG.SHEETS.HR_VERIFICATION_RESULTS);
    if (hrSheet) {
      const foundHr = hrSheet.getRange('A:A').createTextFinder(workflowId).findNext();
      if (foundHr) {
        const hrRow  = hrSheet.getRange(foundHr.getRow(), 1, 1, hrSheet.getLastColumn()).getValues()[0];
        const vTitle = hrRow[SCHEMA.HR_VERIFICATION_RESULTS.VERIFIED_JR_TITLE];
        if (vTitle) {
          r['Position Title']   = vTitle.includes(' / ') ? vTitle.split(' / ')[0] : vTitle;
          r['HR Verified Title'] = vTitle;
        }
      }
    }

    // Merge IT assigned assets
    const itSheet = ss.getSheetByName(CONFIG.SHEETS.IT_RESULTS);
    if (itSheet) {
      const foundIt = itSheet.getRange('A:A').createTextFinder(workflowId).matchEntireCell(true).findNext();
      if (foundIt) {
        const itRow = itSheet.getRange(foundIt.getRow(), 1, 1, itSheet.getLastColumn()).getValues()[0];
        const ITS = SCHEMA.IT_RESULTS;
        if (itRow[ITS.COMPUTER_ASSIGNED] && itRow[ITS.COMPUTER_ASSIGNED] !== 'N/A') r['Computer Assigned'] = itRow[ITS.COMPUTER_ASSIGNED];
        if (itRow[ITS.PHONE_ASSIGNED]    && itRow[ITS.PHONE_ASSIGNED]    !== 'N/A') r['Phone Assigned']    = itRow[ITS.PHONE_ASSIGNED];
        if (itRow[ITS.ASSIGNED_EMAIL]    && itRow[ITS.ASSIGNED_EMAIL]    !== 'N/A') r['Email Assigned']    = itRow[ITS.ASSIGNED_EMAIL];
      }
    }

    context.requestData = r;

    // Helper: check result sheet for completion
    const checkSheet = function(sheetName, target) {
      try {
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) return { status: 'Pending', target: target };
        const found = sheet.getRange('A:A').createTextFinder(workflowId).findNext();
        if (found) {
          const rowData     = sheet.getRange(found.getRow(), 1, 1, sheet.getLastColumn()).getValues()[0];
          const submittedBy = rowData.length > 0 ? rowData[rowData.length - 1] : 'Unknown';
          const timestamp   = rowData[2] instanceof Date ? rowData[2].toLocaleString() : String(rowData[2]);
          return { status: 'Complete', by: submittedBy, time: timestamp, target: target };
        }
        return { status: 'Pending', target: target };
      } catch (e) {
        return { status: 'Error', details: e.message };
      }
    };

    const checklist = [];

    checklist.push({
      name: 'Initial Request', status: 'Complete',
      by:   r['Requester Email'] || 'Unknown',
      time: r['Submission Timestamp'] || ''
    });

    checklist.push({ name: 'ID Setup',        ...checkSheet(CONFIG.SHEETS.ID_SETUP_RESULTS,      'id_setup') });
    checklist.push({ name: 'HR Verification', target: 'hr_verification', ...checkSheet(CONFIG.SHEETS.HR_VERIFICATION_RESULTS, 'hr_verification') });

    // IT Setup — N/A for hourly employees with no system access
    const sysAccessVal  = r['System Access']   || '';
    const empType       = r['Employment Type'] || '';
    const itSheetData   = checkSheet(CONFIG.SHEETS.IT_RESULTS, 'it_setup');
    const isHourlyNoAccess = (empType === 'Hourly' && sysAccessVal === 'No');
    if (itSheetData.status === 'Pending' && isHourlyNoAccess) itSheetData.status = 'N/A';
    checklist.push({ name: 'IT Setup', target: 'it_setup', ...itSheetData });

    // Specialist Action Items
    let hasSiteDocsAI = false;
    const aiSheet = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
    if (aiSheet) {
      const aiData = aiSheet.getDataRange().getValues();
      if (aiData.length > 1) {
        const aiHdrs      = aiData[0];
        const aiWfCol     = aiHdrs.indexOf('Workflow ID');
        const aiCatCol    = aiHdrs.indexOf('Category');
        const aiTidCol    = aiHdrs.indexOf('Task ID');
        const aiStatCol   = aiHdrs.indexOf('Status');
        const aiAssignCol = aiHdrs.indexOf('Assigned To');
        const aiClosedCol = aiHdrs.indexOf('Closed By');
        const aiCompCol   = aiHdrs.indexOf('Completed Date');
        const aiCreatedCol= aiHdrs.indexOf('Created Date');
        const aiFtCol     = aiHdrs.indexOf('Form Type');

        const SPECIALIST_CATS = new Set(['Credit Card','Business Cards','Fleetio','Jonas','SiteDocs','30/60/90 Review','Safety']);
        const NODE_MAP = {
          'creditcard':'credit_card','businesscards':'business_cards',
          'review_306090':'review','centralpurchasing':'central_purchasing',
          'safety_onboarding':'safety','safety_term':'safety_term'
        };

        for (let i = 1; i < aiData.length; i++) {
          if (String(aiData[i][aiWfCol]) !== workflowId) continue;
          const cat = String(aiData[i][aiCatCol] || '');
          if (!SPECIALIST_CATS.has(cat)) continue;

          const isClosed = aiData[i][aiStatCol] === 'Closed';
          const tid      = String(aiData[i][aiTidCol] || '');
          const formType = aiFtCol >= 0 ? String(aiData[i][aiFtCol] || '') : '';
          const byActor  = isClosed
            ? String(aiData[i][aiClosedCol] || aiData[i][aiAssignCol] || '-')
            : String(aiData[i][aiAssignCol] || '-');

          let timeStr = '';
          if (isClosed && aiCompCol >= 0 && aiData[i][aiCompCol]) {
            const cd = aiData[i][aiCompCol];
            timeStr = cd instanceof Date ? cd.toLocaleString() : String(cd);
          } else if (aiCreatedCol >= 0 && aiData[i][aiCreatedCol]) {
            const cr = aiData[i][aiCreatedCol];
            timeStr = cr instanceof Date ? cr.toLocaleString() : String(cr);
          }

          const rawTarget = formType || cat.toLowerCase().replace(/[\s\/]+/g, '');
          const target    = NODE_MAP[rawTarget] || rawTarget;
          if (cat === 'SiteDocs') hasSiteDocsAI = true;

          checklist.push({
            name: cat, status: isClosed ? 'Complete' : 'Pending',
            target: target, tid: tid, by: byActor, time: timeStr
          });
        }
      }
    }

    // SiteDocs fallback — synthesised from ID Setup if no dedicated action item
    if (!hasSiteDocsAI) {
      const idSh = ss.getSheetByName(CONFIG.SHEETS.ID_SETUP_RESULTS);
      if (idSh) {
        const idFound = idSh.getRange('A:A').createTextFinder(workflowId).matchEntireCell(true).findNext();
        if (idFound) {
          const idRow  = idSh.getRange(idFound.getRow(), 1, 1, idSh.getLastColumn()).getValues()[0];
          const idHdrs = idSh.getRange(1, 1, 1, idSh.getLastColumn()).getValues()[0];
          const tsCol  = idHdrs.indexOf('Submission Timestamp');
          const byCol  = idHdrs.indexOf('Submitted By');
          checklist.push({
            name: 'SiteDocs', status: 'Complete', target: 'sitedocs', tid: '',
            by:   byCol  >= 0 ? String(idRow[byCol]  || '') : '',
            time: tsCol  >= 0 && idRow[tsCol] instanceof Date ? idRow[tsCol].toLocaleString() : ''
          });
        }
      }
    }

    const _currentUser = Session.getActiveUser().getEmail();
    context.isAdmin      = AccessControlService.isAdmin(_currentUser);
    context.rolePayload  = AccessControlService.getUserRolePayload(_currentUser);
    context.currentUser  = _currentUser;
    context.checklist    = checklist;
    context.type         = 'Onboarding';
    return context;

  } catch (e) {
    Logger.log('getRequestDetails Fatal Error: ' + e.toString());
    return { success: false, message: 'Server error: ' + e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP DATA (modal drill-down — returns ALL fields, no skip lists)
// ─────────────────────────────────────────────────────────────────────────────

function getStepResultData(workflowId, stepTarget) {
  try {
    // initial_request is always open (step index 0).
    // All other steps require the user to be in a named group or own the workflow.
    if (stepTarget !== 'initial_request') {
      const _user = Session.getActiveUser().getEmail();
      const _wf   = getWorkflow(workflowId);
      if (!AccessControlService.canViewStepData(_user, _wf, 1)) {
        return { '_Access Denied': 'You do not have permission to view this step data.' };
      }
    }

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const _tz  = Session.getScriptTimeZone();
    const fmtV = function(v) { return v instanceof Date ? Utilities.formatDate(v, _tz, 'M/d/yyyy') : String(v === null || v === undefined ? '' : v); };

    // Generic sheet reader — returns every column header + value, no filtering
    const readAllFromSheet = function(sheetName) {
      const sh = ss.getSheetByName(sheetName);
      if (!sh) return {};
      const found = sh.getRange('A:A').createTextFinder(workflowId).findNext();
      if (!found) return {};
      const hdrs = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      const row  = sh.getRange(found.getRow(), 1, 1, sh.getLastColumn()).getValues()[0];
      const out  = {};
      hdrs.forEach(function(h, i) { if (h) out[h] = fmtV(row[i]); });
      return out;
    };

    // Action Items reader — grouped by task number, returns all non-internal columns
    const readActionItems = function(categoryLabel) {
      const sh = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
      if (!sh) return {};
      const data = sh.getDataRange().getValues();
      const hdrs = data[0];
      const wfI  = hdrs.indexOf('Workflow ID');
      const catI = hdrs.indexOf('Category');
      const INTERNAL = new Set(['Workflow ID','Task ID','Form ID','Draft','Form Data']);
      const result = {};
      let n = 1;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][wfI]) !== workflowId) continue;
        const rowCat = String(data[i][catI] || '');
        const match  = rowCat === categoryLabel || rowCat.split(' / ').map(function(s){ return s.trim(); }).includes(categoryLabel);
        if (!match) continue;
        const prefix = n > 1 ? 'Task ' + n + ' — ' : '';
        hdrs.forEach(function(h, j) {
          if (!h || INTERNAL.has(h)) return;
          result[prefix + h] = fmtV(data[i][j]);
        });
        n++;
      }
      if (n === 1) result['Status'] = 'No tasks found for: ' + categoryLabel;
      return result;
    };

    switch (stepTarget) {

      // ── Onboarding ──────────────────────────────────────────────────────────
      case 'initial_request':   return readAllFromSheet(CONFIG.SHEETS.INITIAL_REQUESTS);
      case 'id_setup':          return readAllFromSheet(CONFIG.SHEETS.ID_SETUP_RESULTS);
      case 'hr_verification':   return readAllFromSheet(CONFIG.SHEETS.HR_VERIFICATION_RESULTS);
      case 'it_setup':          return readAllFromSheet(CONFIG.SHEETS.IT_RESULTS);

      case 'creditcard':
      case 'credit_card':       return readActionItems('Credit Card');
      case 'businesscards':
      case 'business_cards':    return readActionItems('Business Cards');
      case 'fleetio':           return readActionItems('Fleetio');
      case 'jonas':             return readActionItems('Jonas');
      case 'centralpurchasing':
      case 'central_purchasing':return readActionItems('Central Purchasing');
      case 'review_306090':
      case 'review':            return readActionItems('30/60/90 Review');
      case 'safety_onboarding':
      case 'safety':            return readActionItems('Safety');
      case 'safety_term':       return readActionItems('Safety');

      case 'sitedocs': {
        // First try as an action item; fall back to ID Setup Results
        const aiResult = readActionItems('SiteDocs');
        if (Object.keys(aiResult).length > 0 && !aiResult['Status']) return aiResult;
        const idData = readAllFromSheet(CONFIG.SHEETS.ID_SETUP_RESULTS);
        if (Object.keys(idData).length > 0) {
          idData['_Note'] = 'SiteDocs provisioned during ID Setup';
          return idData;
        }
        return aiResult;
      }

      // ── Termination ─────────────────────────────────────────────────────────
      case 'termination_request':  return readAllFromSheet(CONFIG.SHEETS.TERMINATIONS);
      case 'termination_approval': {
        const appr = readAllFromSheet(CONFIG.SHEETS.TERMINATION_APPROVALS);
        // Context fields first so modal shows employee/site/date before the decision
        const base = readAllFromSheet(CONFIG.SHEETS.TERMINATIONS);
        return Object.assign(
          {
            '_Employee Name': base['Employee Name'] || '',
            '_Site':          base['Site']          || '',
            '_Term Date':     base['Term Date']     || '',
            '_Reason':        base['Reason']        || ''
          },
          appr
        );
      }
      case 'asset_collection':           return readActionItems('Assets');
      case 'systems_deactivation':       return readActionItems('IT');
      case 'systems_deactivation_hr':    return readActionItems('HR');
      case 'systems_deactivation_fleet': return readActionItems('Fleet');
      case 'systems_deactivation_finance': return readActionItems('Finance');
      case 'systems_deactivation_deact': return readActionItems('Deactivation');

      // ── Status Change ───────────────────────────────────────────────────────
      case 'change_request':          return readAllFromSheet(CONFIG.SHEETS.POSITION_CHANGES);
      case 'position_change_approval': {
        const appr = readAllFromSheet(CONFIG.SHEETS.POSITION_CHANGE_APPROVALS);
        // Context fields first so modal shows employee/date/change type before the decision
        const base = readAllFromSheet(CONFIG.SHEETS.POSITION_CHANGES);
        return Object.assign(
          {
            '_Employee Name':  base['Employee Name']  || '',
            '_Effective Date': base['Effective Date'] || '',
            '_Change Types':   base['Change Types']   || ''
          },
          appr
        );
      }
      case 'change_manager':      return readActionItems('Manager');
      case 'change_it':           return readActionItems('IT');
      case 'change_purchasing':   return readActionItems('Purchasing');
      case 'change_idsetup':      return readActionItems('ID Setup');
      case 'change_safety':       return readActionItems('Safety');
      case 'change_businesscards':return readActionItems('Business Cards');
      case 'change_creditcard':   return readActionItems('Credit Card');
      case 'change_fleetio':      return readActionItems('Fleetio');
      case 'change_jonas':        return readActionItems('Jonas');

      // ── Equipment Request ───────────────────────────────────────────────────
      case 'equipment_request':   return readAllFromSheet(CONFIG.SHEETS.EQUIPMENT_REQUESTS);

      default: return {};
    }
  } catch (e) {
    Logger.log('getStepResultData Error: ' + e.toString());
    return { 'Error': e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECKLIST BUILDERS — one per workflow type
// ─────────────────────────────────────────────────────────────────────────────

function getTerminationDetails(workflowId) {
  try {
    if (!workflowId) return { success: false, message: 'No workflow ID provided' };

    const ss      = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const context = { success: true, id: workflowId, checklist: [] };

    const reqSheet = ss.getSheetByName(CONFIG.SHEETS.TERMINATIONS);
    if (!reqSheet) return { success: false, message: 'Terminations sheet missing' };

    const foundReq = reqSheet.getRange('A:A').createTextFinder(workflowId).matchEntireCell(true).findNext();
    if (!foundReq) return { success: false, message: 'Request ID not found in database' };

    const reqLastCol = reqSheet.getLastColumn();
    const reqHeaders = reqSheet.getRange(1, 1, 1, reqLastCol).getValues()[0];
    const reqRow     = reqSheet.getRange(foundReq.getRow(), 1, 1, reqLastCol).getValues()[0];

    const r = {};
    const _sv = function(v) { return v instanceof Date ? v.toString() : String(v === null || v === undefined ? '' : v); };
    reqHeaders.forEach(function(h, i) {
      if (!h) return;
      r[h] = _sv(reqRow[i]);
    });
    // Aliases for snapshot grid
    if (!r['Employee Type'] && SCHEMA.TERMINATIONS.EMPLOYEE_TYPE !== undefined) r['Employee Type'] = _sv(reqRow[SCHEMA.TERMINATIONS.EMPLOYEE_TYPE]);
    if (!r['Term Date'])     r['Term Date']  = _sv(reqRow[SCHEMA.TERMINATIONS.TERM_DATE]);
    if (!r['Site'])          r['Site']       = _sv(reqRow[SCHEMA.TERMINATIONS.SITE]);
    if (!r['Reason'])        r['Reason']     = _sv(reqRow[SCHEMA.TERMINATIONS.REASON]);
    r['First Name'] = r['Employee Name'] || '';
    context.requestData = r;

    const checklist = [];
    checklist.push({ name: 'Initial Request', status: 'Complete', by: r['Requester Email'] || 'Unknown', time: r['Timestamp'] || '' });

    const apprSheet = ss.getSheetByName(CONFIG.SHEETS.TERMINATION_APPROVALS);
    if (apprSheet) {
      const foundAppr = apprSheet.getRange('A:A').createTextFinder(workflowId).findNext();
      if (foundAppr) {
        const apprRow = apprSheet.getRange(foundAppr.getRow(), 1, 1, apprSheet.getLastColumn()).getValues()[0];
        const TAR = SCHEMA.TERMINATION_APPROVAL_RESULTS;
        checklist.push({
          name: 'Approval', status: 'Complete', target: 'termination_approval',
          by:   apprRow[TAR.SUBMITTED_BY] || 'HR',
          time: apprRow[TAR.TIMESTAMP] instanceof Date ? apprRow[TAR.TIMESTAMP].toLocaleString() : String(apprRow[TAR.TIMESTAMP] || '')
        });
      } else {
        checklist.push({ name: 'Approval', status: 'Pending', target: 'termination_approval' });
      }
    }

    const aiSheet = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
    if (aiSheet) {
      const aiData = aiSheet.getDataRange().getValues();
      const aiH    = aiData[0];
      const wfI    = aiH.indexOf('Workflow ID'), catI = aiH.indexOf('Category'),
            tidI   = aiH.indexOf('Task ID'),     stI  = aiH.indexOf('Status'),
            asI    = aiH.indexOf('Assigned To'), cbI  = aiH.indexOf('Closed By'),
            cdI    = aiH.indexOf('Completed Date'), crI = aiH.indexOf('Created Date');

      const cats = {};
      for (let i = 1; i < aiData.length; i++) {
        if (String(aiData[i][wfI]) !== workflowId) continue;
        const cat      = aiData[i][catI] || 'Task';
        const isClosed = aiData[i][stI] === 'Closed' || aiData[i][stI] === 'Complete';
        if (!cats[cat]) cats[cat] = { total: 0, complete: 0, by: aiData[i][asI], time: aiData[i][crI], tid: aiData[i][tidI] || '' };
        cats[cat].total++;
        if (isClosed) {
          cats[cat].complete++;
          const cb = cbI >= 0 ? aiData[i][cbI] : '';
          if (cb) cats[cat].closedBy = cb;
          const cd = cdI >= 0 ? aiData[i][cdI] : null;
          if (cd) cats[cat].completedTime = cd;
        }
      }

      const catTargetMap = {
        'Assets':'asset_collection','IT':'systems_deactivation','HR':'systems_deactivation_hr',
        'Fleet':'systems_deactivation_fleet','Finance':'systems_deactivation_finance',
        'Deactivation':'systems_deactivation_deact','Safety':'safety_term'
      };
      for (const cat in cats) {
        const c = cats[cat];
        const status   = c.complete === c.total ? 'Complete' : 'Pending';
        const byActor  = (status === 'Complete' && c.closedBy) ? c.closedBy : (c.by || '-');
        const timeStamp = (status === 'Complete' && c.completedTime)
          ? (c.completedTime instanceof Date ? c.completedTime.toLocaleString() : String(c.completedTime))
          : (c.time instanceof Date ? c.time.toLocaleString() : String(c.time || ''));
        checklist.push({
          name: cat, status: status, tid: c.tid || '', by: byActor, time: timeStamp,
          target: catTargetMap[cat] || cat.toLowerCase().replace(/\s+/g, '_')
        });
      }
    }

    const termWf = getWorkflow(workflowId);
    const _cu2 = Session.getActiveUser().getEmail();
    context.isAdmin     = AccessControlService.isAdmin(_cu2);
    context.rolePayload = AccessControlService.getUserRolePayload(_cu2);
    context.currentUser = _cu2;
    context.status      = termWf ? String(termWf['Status'] || '') : '';
    context.checklist   = checklist;
    context.type        = 'End of Employment';
    return context;
  } catch (e) {
    Logger.log('getTerminationDetails Error: ' + e.toString());
    return { success: false, message: 'Server error: ' + e.message };
  }
}

function getEquipmentRequestDetails(workflowId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

    const wfSheet = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
    const foundWf = wfSheet ? wfSheet.getRange('A:A').createTextFinder(workflowId).matchEntireCell(true).findNext() : null;
    if (!foundWf) return { success: false, message: 'Workflow not found' };
    const wfRow = wfSheet.getRange(foundWf.getRow(), 1, 1, 9).getValues()[0];

    const eqSheet = ss.getSheetByName(CONFIG.SHEETS.EQUIPMENT_REQUESTS);
    const foundReq = eqSheet ? eqSheet.getRange('A:A').createTextFinder(workflowId).matchEntireCell(true).findNext() : null;
    if (!foundReq) return { success: false, message: 'Request ID not found in database' };
    const row = eqSheet.getRange(foundReq.getRow(), 1, 1, eqSheet.getLastColumn()).getValues()[0];

    const _tz  = Session.getScriptTimeZone();
    const fmtD = function(v) { return v instanceof Date ? Utilities.formatDate(v, _tz, 'M/d/yyyy') : String(v || ''); };

    const EQD = SCHEMA.EQUIPMENT_REQUESTS;
    const WFS = SCHEMA.WORKFLOWS;
    const requestData = {
      'First Name':      String(row[EQD.EMPLOYEE_FIRST_NAME] || ''),
      'Last Name':       String(row[EQD.EMPLOYEE_LAST_NAME]  || ''),
      'Position Title':  String(row[EQD.JOB_TITLE]           || ''),
      'Site Name':       String(row[EQD.SITE_NAME]           || ''),
      'Manager Name':    String(row[EQD.MANAGER_NAME]        || ''),
      'Manager Email':   String(row[EQD.MANAGER_EMAIL]       || ''),
      'Equipment':       String(row[EQD.EQUIPMENT_REQUESTED] || ''),
      'Systems':         String(row[EQD.SYSTEMS_REQUESTED]   || ''),
      'Comments':        String(row[EQD.COMMENTS]            || ''),
      'Department':      String(row[EQD.DEPARTMENT]          || ''),
      'Requester Name':  String(row[EQD.REQUESTER_NAME]      || ''),
      'Requester Email': String(row[EQD.REQUESTER_EMAIL]     || ''),
      'Date Requested':  fmtD(row[EQD.TIMESTAMP])
    };

    const _cu3 = Session.getActiveUser().getEmail();
    const context = {
      success: true, id: workflowId, type: 'Equipment', requestData: requestData,
      status:      String(wfRow[WFS.STATUS]       || ''),
      currentStep: String(wfRow[WFS.CURRENT_STEP] || ''),
      checklist:   [],
      isAdmin:     AccessControlService.isAdmin(_cu3),
      rolePayload: AccessControlService.getUserRolePayload(_cu3),
      currentUser: _cu3
    };

    context.checklist.push({
      name: 'Initial Request', status: 'Complete', target: 'equipment_request',
      by:   requestData['Requester Email'] || 'Unknown',
      time: requestData['Date Requested']  || ''
    });

    const aiSheet = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
    if (aiSheet) {
      const aiData = aiSheet.getDataRange().getValues();
      const h      = aiData[0];
      const wfCol  = h.indexOf('Workflow ID'), catCol  = h.indexOf('Category'),
            nmCol  = h.indexOf('Task Name'),   stCol   = h.indexOf('Status'),
            byCol  = h.indexOf('Closed By'),   tmCol   = h.indexOf('Completed Date'),
            tidCol = h.indexOf('Task ID'),     ftCol   = h.indexOf('Form Type');

      // Category → stepTarget mapping (must match getStepResultData switch cases)
      const EQUIP_CAT_TARGET = {
        'Credit Card':       'creditcard',
        'Business Cards':    'businesscards',
        'Fleetio':           'fleetio',
        'Jonas':             'jonas',
        'Safety':            'safety_onboarding',
        'IT':                'it_setup',
        'ID Setup':          'id_setup',
        'Central Purchasing':'centralpurchasing',
        '30/60/90 Review':   'review_306090'
      };

      for (let i = 1; i < aiData.length; i++) {
        if (String(aiData[i][wfCol]) !== workflowId) continue;
        const st     = String(aiData[i][stCol] || 'Open');
        const tDate  = aiData[i][tmCol];
        const catVal = String(aiData[i][catCol] || '');
        const ftVal  = ftCol >= 0 ? String(aiData[i][ftCol] || '') : '';
        // Derive target: prefer Form Type (matches action item form routes), then category map, then slugify
        const target = ftVal || EQUIP_CAT_TARGET[catVal] || catVal.toLowerCase().replace(/[\s\/]+/g, '');
        context.checklist.push({
          name:   String(aiData[i][nmCol] || catVal || ''),
          status: st === 'Closed' ? 'Complete' : st,
          target: target,
          by:     String(aiData[i][byCol] || ''),
          time:   tDate instanceof Date ? Utilities.formatDate(tDate, _tz, 'M/d/yyyy h:mm a') : String(tDate || ''),
          tid:    String(aiData[i][tidCol] || '')
        });
      }
    }

    return context;
  } catch (e) {
    Logger.log('getEquipmentRequestDetails Error: ' + e.toString());
    return { success: false, message: 'Server error: ' + e.message };
  }
}

function getChangeDetails(workflowId) {
  try {
    if (!workflowId) return { success: false, message: 'No workflow ID provided' };

    const ss      = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const context = { success: true, id: workflowId, checklist: [], type: 'Status Change' };

    const reqSheet = ss.getSheetByName(CONFIG.SHEETS.POSITION_CHANGES);
    if (!reqSheet) return { success: false, message: 'Position Changes sheet missing' };

    const foundReq = reqSheet.getRange('A:A').createTextFinder(workflowId).matchEntireCell(true).findNext();
    if (!foundReq) return { success: false, message: 'Request ID not found in database' };

    const reqLastCol = reqSheet.getLastColumn();
    const reqHeaders = reqSheet.getRange(1, 1, 1, reqLastCol).getValues()[0];
    const reqRow     = reqSheet.getRange(foundReq.getRow(), 1, 1, reqLastCol).getValues()[0];

    const _tz = Session.getScriptTimeZone();
    const r = {};
    reqHeaders.forEach(function(h, i) {
      if (!h) return;
      const val = reqRow[i];
      r[h] = val instanceof Date ? Utilities.formatDate(val, _tz, 'M/d/yyyy') : (val === undefined || val === null ? '' : String(val));
    });
    const _fmt = function(v) { return v instanceof Date ? Utilities.formatDate(v, _tz, 'M/d/yyyy') : String(v || ''); };
    const PCN  = SCHEMA.POSITION_CHANGES;
    r['Employee Name']          = r['Employee Name']          || _fmt(reqRow[PCN.EMPLOYEE_NAME]);
    r['Requester Name']         = r['Requester Name']         || _fmt(reqRow[PCN.REQUESTER_NAME]);
    r['Requester Email']        = r['Requester Email']        || _fmt(reqRow[PCN.REQUESTER_EMAIL]);
    r['Effective Date']         = r['Effective Date']         || _fmt(reqRow[PCN.EFFECTIVE_DATE]);
    r['Site Name']              = r['Site Name']              || _fmt(reqRow[PCN.CURRENT_SITE]);
    r['Change Type']            = r['Change Type']            || _fmt(reqRow[PCN.CHANGE_TYPES]);
    r['Department']             = r['Department']             || _fmt(reqRow[PCN.DEPARTMENT]);
    r['Current Title']          = r['Current Title']          || _fmt(reqRow[24]);
    r['Current Manager Email']  = r['Current Manager Email']  || _fmt(reqRow[25]);
    r['Current Manager Name']   = r['Current Manager Name']   || _fmt(reqRow[26]);
    r['Current Classification'] = r['Current Classification'] || _fmt(reqRow[27]);
    context.requestData = r;

    const wf = getWorkflow(workflowId);
    context.status = wf ? String(wf['Status'] || '') : '';
    context.step   = wf ? String(wf['Current Step'] || '') : '';

    const checklist = [];
    checklist.push({ name: 'Initial Request', status: 'Complete', target: 'change_request', by: r['Requester Email'] || 'Unknown', time: r['Timestamp'] || '' });

    const apprSheet = ss.getSheetByName(CONFIG.SHEETS.POSITION_CHANGE_APPROVALS);
    if (apprSheet) {
      const foundAppr = apprSheet.getRange('A:A').createTextFinder(workflowId).matchEntireCell(true).findNext();
      if (foundAppr) {
        const apprRow = apprSheet.getRange(foundAppr.getRow(), 1, 1, apprSheet.getLastColumn()).getValues()[0];
        const PCAP = SCHEMA.POSITION_CHANGE_APPROVAL;
        checklist.push({
          name: 'HR Approval', status: 'Complete', target: 'position_change_approval',
          by:   apprRow[PCAP.SUBMITTED_BY] || 'HR',
          time: apprRow[PCAP.TIMESTAMP] instanceof Date ? apprRow[PCAP.TIMESTAMP].toLocaleString() : String(apprRow[PCAP.TIMESTAMP] || '')
        });
      } else {
        checklist.push({ name: 'HR Approval', status: 'Pending', target: 'position_change_approval' });
      }
    }

    const aiSheet = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
    if (aiSheet) {
      const aiData = aiSheet.getDataRange().getValues();
      const aiH    = aiData[0];
      const wfI    = aiH.indexOf('Workflow ID'), catI = aiH.indexOf('Category'),
            tidI   = aiH.indexOf('Task ID'),     stI  = aiH.indexOf('Status'),
            asI    = aiH.indexOf('Assigned To'), cbI  = aiH.indexOf('Closed By'),
            cdI    = aiH.indexOf('Completed Date'), crI = aiH.indexOf('Created Date');

      const cats = {};
      for (let i = 1; i < aiData.length; i++) {
        if (String(aiData[i][wfI]) !== workflowId) continue;
        const cat = aiData[i][catI] || 'Task';
        const isClosed = aiData[i][stI] === 'Closed' || aiData[i][stI] === 'Complete';
        if (!cats[cat]) cats[cat] = { total: 0, complete: 0, by: aiData[i][asI], time: aiData[i][crI], tid: aiData[i][tidI] || '' };
        cats[cat].total++;
        if (isClosed) {
          cats[cat].complete++;
          const cb = cbI >= 0 ? aiData[i][cbI] : '';
          if (cb) cats[cat].closedBy = cb;
          const cd = cdI >= 0 ? aiData[i][cdI] : null;
          if (cd) cats[cat].completedTime = cd;
        }
      }

      const catTargetMap = {
        'Manager':'change_manager','IT':'change_it','Purchasing':'change_purchasing',
        'ID Setup':'change_idsetup','Safety':'change_safety','Business Cards':'change_businesscards',
        'Credit Card':'change_creditcard','Fleetio':'change_fleetio','Jonas':'change_jonas'
      };
      for (const cat in cats) {
        const c       = cats[cat];
        const status  = c.complete === c.total ? 'Complete' : 'Pending';
        const byActor = (status === 'Complete' && c.closedBy) ? c.closedBy : (c.by || '-');
        const ts      = (status === 'Complete' && c.completedTime)
          ? (c.completedTime instanceof Date ? c.completedTime.toLocaleString() : String(c.completedTime))
          : (c.time instanceof Date ? c.time.toLocaleString() : String(c.time || ''));
        checklist.push({
          name: cat, status: status, tid: c.tid || '', by: byActor, time: ts,
          target: catTargetMap[cat] || cat.toLowerCase().replace(/\s+/g, '_')
        });
      }
    }

    const _cu4 = Session.getActiveUser().getEmail();
    context.isAdmin     = AccessControlService.isAdmin(_cu4);
    context.rolePayload = AccessControlService.getUserRolePayload(_cu4);
    context.currentUser = _cu4;
    context.checklist   = checklist;
    return context;
  } catch (e) {
    Logger.log('getChangeDetails Error: ' + e.toString());
    return { success: false, message: 'Server error: ' + e.message };
  }
}
