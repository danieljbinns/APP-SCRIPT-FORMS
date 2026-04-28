/**
 * BOSS Setup Review — Gatekeeper step between HR Verification and IT Setup.
 *
 * Boss Review Pattern (see SharedComponents.html for full documentation):
 *   - Serves InitialRequest.html (new hire / equipment) or PositionSiteChangeRequest.html
 *     in mode='boss_review' for davelangohr@team-group.com.
 *   - Server injects: mode, baseMode, workflowId, requestData (JSON), referenceData (JSON).
 *   - Client prefills all fields from INJECTED_REQUEST_DATA and routes submit here.
 *   - submitBOSSReview writes corrections back in-place and triggers the IT Setup email.
 */

function serveBOSSReview(workflowId) {
  if (!workflowId) return HtmlService.createHtmlOutput('<h1>Error: No workflow ID provided</h1>');

  const isChange    = workflowId.startsWith('CHANGE_');
  const isEquipment = workflowId.startsWith('EQUIP_REQ_');
  const baseMode    = isEquipment ? 'equipment' : 'new_hire';

  if (isChange) {
    const template = HtmlService.createTemplateFromFile('PositionSiteChangeRequest');
    template.mode          = 'boss_review';
    template.workflowId    = workflowId;
    template.requestData   = JSON.stringify(getFullPositionChangeData(workflowId));
    template.referenceData = JSON.stringify(getInitialFormData());
    return template.evaluate()
      .setTitle('BOSS Setup Review — Status Change')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  const template = HtmlService.createTemplateFromFile('InitialRequest');
  template.mode          = 'boss_review';
  template.baseMode      = baseMode;
  template.workflowId    = workflowId;
  template.requestData   = JSON.stringify(getFullNewHireData(workflowId));
  template.referenceData = JSON.stringify(getInitialFormData());
  template.bossContext   = getWorkflowContext(workflowId);   // full context for RequestHeader
  return template.evaluate()
    .setTitle('BOSS Setup Review')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getFullNewHireData(workflowId) {
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] !== workflowId) continue;
      const r = data[i];
      const fmtDate = function(d) {
        return d instanceof Date
          ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : (d ? String(d).substring(0, 10) : '');
      };
      const splitCSV = function(v) {
        return v ? String(v).split(', ').map(function(s) { return s.trim(); }).filter(Boolean) : [];
      };
      return {
        workflowId:               r[0],
        dateRequested:            fmtDate(r[3]),
        requesterName:            r[4]  || '',
        requesterEmail:           r[5]  || '',
        hireDate:                 fmtDate(r[6]),
        hireType:                 r[7]  || '',
        employeeType:             r[8]  || '',
        employmentType:           r[9]  || '',
        firstName:                r[10] || '',
        middleName:               r[11] || '',
        lastName:                 r[12] || '',
        preferredName:            r[13] || '',
        positionTitle:            r[14] || '',
        siteName:                 r[15] || '',
        jobSiteNumber:            r[16] || '',
        managerEmail:             r[17] || '',
        managerName:              r[18] || '',
        systemAccess:             r[19] || '',
        systems:                  splitCSV(r[20]),
        equipment:                splitCSV(r[21]),
        googleEmail:              r[22] || '',
        googleDomain:             r[23] || '',
        computerReq:              r[24] || '',
        computerType:             r[25] || '',
        computerPrevUser:         r[26] || '',
        computerPrevType:         r[27] || '',
        computerSerial:           r[28] || '',
        office365Required:        r[29] || '',
        creditCardUSA:            r[30] || '',
        creditCardLimitUSA:       r[31] || '',
        creditCardCanada:         r[32] || '',
        creditCardLimitCanada:    r[33] || '',
        creditCardHomeDepot:      r[34] || '',
        creditCardLimitHomeDepot: r[35] || '',
        phoneReq:                 r[36] || '',
        phonePrevUser:            r[37] || '',
        phonePrevNumber:          r[38] || '',
        bossJobSites:             r[39] || '',
        bossCostSheet:            r[40] || '',
        bossCostSheetJobs:        r[41] || '',
        bossTripReports:          r[42] || '',
        bossGrievances:           r[43] || '',
        jonasJobNumbers:          r[44] || '',
        jrRequired:               r[45] || '',
        jrAssignment:             r[46] || '',
        plan306090:               r[47] || '',
        comments:                 r[48] || '',
        adpSites:                 splitCSV(r[49]),
        department:               r[50] || '',
        purchasingSites:          splitCSV(r[51]),
        adpSalaryAccess:          r[52] || 'No'
      };
    }
    return null;
  } catch (e) {
    Logger.log('[BOSSReview] getFullNewHireData error: ' + e.message);
    return null;
  }
}

function getFullPositionChangeData(workflowId) {
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.POSITION_CHANGES);
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] !== workflowId) continue;
      const r = data[i];
      const fmtDate = function(d) {
        return d instanceof Date
          ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : (d ? String(d).substring(0, 10) : '');
      };
      const splitPair = function(s) {
        var parts = s ? String(s).split(' -> ') : [];
        return [
          (parts[0] === 'N/A' ? '' : (parts[0] || '')),
          (parts[1] === 'N/A' ? '' : (parts[1] || ''))
        ];
      };
      const splitCSV = function(v) {
        return v ? String(v).split(', ').filter(Boolean) : [];
      };
      const site  = splitPair(r[10]);
      const title = splitPair(r[11]);
      const cls   = splitPair(r[12]);
      return {
        workflowId:      r[0],
        reqName:         r[3]  || '',
        reqEmail:        r[4]  || '',
        employeeName:    r[5]  || '',
        effDate:         fmtDate(r[7]),
        siteName:        r[8]  || '',
        changeType:      splitCSV(r[9]),
        siteOld:         site[0],  siteNew:  site[1],
        titleOld:        title[0], titleNew: title[1],
        classOld:        cls[0],   classNew: cls[1],
        systems:         splitCSV(r[17]),
        equipment:       splitCSV(r[18]),
        removal:         splitCSV(r[19]),
        comments:        r[20] || '',
        department:      r[21] || '',
        purchasingSites: splitCSV(r[22])
      };
    }
    return null;
  } catch (e) {
    Logger.log('[BOSSReview] getFullPositionChangeData error: ' + e.message);
    return null;
  }
}

function submitBOSSReview(formData) {
  try {
    const workflowId = formData.workflowId;
    if (!workflowId) return { success: false, message: 'Missing workflow ID.' };

    const ss        = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const isChange  = workflowId.startsWith('CHANGE_');
    const csvOrStr  = function(v) { return Array.isArray(v) ? v.join(', ') : (v || ''); };

    if (!isChange) {
      // Write Dave's corrections back to Initial Requests sheet in-place
      const sheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
      const rows  = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] !== workflowId) continue;
        const rowNum  = i + 1;
        const updates = {
          7:  formData.hireType            || '',
          8:  formData.employeeType        || '',
          9:  formData.employmentType      || '',
          10: formData.firstName           || '',
          11: formData.middleName          || '',
          12: formData.lastName            || '',
          13: formData.preferredName       || '',
          14: formData.positionTitle       || '',
          15: formData.siteName            || '',
          16: formData.jobSiteNumber       || '',
          17: formData.reportingManagerEmail || formData.managerEmail || '',
          18: formData.reportingManagerName  || formData.managerName  || '',
          19: formData.systemAccess        || '',
          20: csvOrStr(formData.systems),
          21: csvOrStr(formData.equipment),
          22: formData.googleEmail         || '',
          23: formData.googleDomain        || '',
          24: formData.computerRequestType || '',
          25: formData.computerType        || '',
          36: formData.phoneRequestType    || '',
          39: csvOrStr(formData.bossJobSites),
          40: formData.bossCostSheet       || '',
          41: csvOrStr(formData.bossCostSheetJobs),
          42: formData.bossTripReports     || '',
          43: formData.bossGrievances      || '',
          44: csvOrStr(formData.jonasJobNumbers),
          49: csvOrStr(formData.adpSites),
          50: formData.department          || '',
          51: csvOrStr(formData.purchasingSites)
        };
        Object.entries(updates).forEach(function(pair) {
          sheet.getRange(rowNum, parseInt(pair[0]) + 1).setValue(pair[1]);
        });
        break;
      }
    }

    // Audit log in BOSS Review Results
    let auditSheet = ss.getSheetByName('BOSS Review Results');
    if (!auditSheet) {
      auditSheet = ss.insertSheet('BOSS Review Results');
      auditSheet.appendRow([
        'Workflow ID','Form ID','Timestamp',
        'Boss Job Sites','Boss Cost Sheet','Boss Cost Sheet Jobs',
        'Boss Trip Reports','Boss Grievances',
        'Computer Req','Computer Type','Phone Req','Notes','Submitted By'
      ]);
      auditSheet.getRange(1,1,1,13).setFontWeight('bold').setBackground('#EB1C2D').setFontColor('#ffffff');
    }
    auditSheet.appendRow([
      workflowId, generateFormId('BOSS_REV'), new Date(),
      csvOrStr(formData.bossJobSites),
      formData.bossCostSheet       || '',
      csvOrStr(formData.bossCostSheetJobs),
      formData.bossTripReports     || '',
      formData.bossGrievances      || '',
      formData.computerRequestType || '',
      formData.computerType        || '',
      formData.phoneRequestType    || '',
      formData.notes               || '',
      Session.getActiveUser().getEmail()
    ]);

    updateWorkflow(workflowId, 'In Progress', 'IT Setup Needed');
    syncWorkflowState(workflowId);

    const context = getWorkflowContext(workflowId);
    if (!context) return { success: false, message: 'Could not load workflow context.' };

    const itUrl = buildFormUrl('it_setup', { wf: workflowId });
    sendFormEmail({
      to: CONFIG.EMAILS.IT,
      subject: 'IT Setup Required — ' + (context.employeeName || workflowId),
      body: 'BOSS Setup has been reviewed and approved by Dave Langohr.\n\nPlease complete the IT setup form using the button below.',
      formUrl: itUrl,
      displayName: 'TEAM Group — Employee Onboarding',
      contextData: context
    });

    Logger.log('[BOSSReview] Review submitted. IT Setup triggered for: ' + workflowId);
    return { success: true, scriptUrl: ScriptApp.getService().getUrl() };

  } catch (e) {
    Logger.log('[ERROR] submitBOSSReview: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Read Dave's reviewed BOSS values for a workflow (if submitted).
 * Returns an object of overrides, or null if no review exists.
 */
function getBOSSReviewData(workflowId) {
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('BOSS Review Results');
    if (!sheet) return null;
    const data = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === workflowId) {
        return {
          bossJobSites:      data[i][3],
          bossCostSheet:     data[i][4],
          bossCostSheetJobs: data[i][5],
          bossTripReports:   data[i][6],
          bossGrievances:    data[i][7],
          computerReq:       data[i][8],
          computerType:      data[i][9],
          phoneReq:          data[i][10]
        };
      }
    }
    return null;
  } catch (e) {
    Logger.log('[BOSSReview] getBOSSReviewData error: ' + e.message);
    return null;
  }
}
