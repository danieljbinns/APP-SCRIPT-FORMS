/**
 * IT Confirmation Handler — Gatekeeper step between HR Verification and IT Setup.
 *
 * IT Confirmation Pattern (see SharedComponents.html for full documentation):
 *   - Serves InitialRequest.html (new hire / equipment) or PositionSiteChangeRequest.html
 *     in mode='it_confirmation' for davelangohr@team-group.com.
 *   - Server injects: mode, baseMode, workflowId, requestData (JSON), referenceData (JSON).
 *   - Client prefills all fields from INJECTED_REQUEST_DATA and routes submit here.
 *   - submitITConfirmation writes corrections back in-place and triggers the IT Setup email.
 */

function serveITConfirmation(workflowId) {
  if (!workflowId) return HtmlService.createHtmlOutput('<h1>Error: No workflow ID provided</h1>');

  const isChange    = workflowId.startsWith('CHANGE_');
  const isEquipment = workflowId.startsWith('EQUIP_REQ_');
  const baseMode    = isEquipment ? 'equipment' : 'new_hire';

  if (isChange) {
    const template = HtmlService.createTemplateFromFile('PositionSiteChangeRequest');
    template.mode          = 'it_confirmation';
    template.workflowId    = workflowId;
    template.requestData   = JSON.stringify(getFullPositionChangeData(workflowId));
    template.referenceData = JSON.stringify(getInitialFormData());
    return template.evaluate()
      .setTitle('IT Confirmation — Status Change')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  const template = HtmlService.createTemplateFromFile('InitialRequest');
  template.mode          = 'it_confirmation';
  template.baseMode      = baseMode;
  template.workflowId    = workflowId;
  template.requestData   = JSON.stringify(
    isEquipment ? getFullEquipmentRequestData(workflowId) : getFullNewHireData(workflowId)
  );
  template.referenceData = JSON.stringify(getInitialFormData());
  template.itContext     = getWorkflowContext(workflowId);   // full context for RequestHeader
  return template.evaluate()
    .setTitle('IT Confirmation' + (isEquipment ? ' — Equipment Request' : ''))
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
        adpSalaryAccess:          r[53] || 'No'
      };
    }
    return null;
  } catch (e) {
    Logger.log('[ITConfirmation] getFullNewHireData error: ' + e.message);
    return null;
  }
}

function getFullEquipmentRequestData(workflowId) {
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.EQUIPMENT_REQUESTS);
    const data  = sheet.getDataRange().getValues();
    const splitCSV = function(v) {
      return v ? String(v).split(', ').map(function(s) { return s.trim(); }).filter(Boolean) : [];
    };
    // Scan all rows — col[1] holds Workflow ID; scanning from 0 is robust whether or not
    // a header row exists (header value 'Workflow ID' will never match an EQUIP_REQ_* id).
    for (let i = 0; i < data.length; i++) {
      if (data[i][1] !== workflowId) continue;
      const r = data[i];
      return {
        workflowId:    r[1],
        reqName:       r[3]  || '',
        reqEmail:      r[4]  || '',
        firstName:     r[5]  || '',
        lastName:      r[6]  || '',
        siteName:      r[7]  || '',
        positionTitle: r[8]  || '',
        managerName:   r[9]  || '',
        managerEmail:  r[10] || '',
        equipment:     splitCSV(r[11]),
        systems:       splitCSV(r[12]),
        comments:      r[13] || '',
        department:    r[14] || ''
      };
    }
    return null;
  } catch (e) {
    Logger.log('[ITConfirmation] getFullEquipmentRequestData error: ' + e.message);
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
    Logger.log('[ITConfirmation] getFullPositionChangeData error: ' + e.message);
    return null;
  }
}

function submitITConfirmation(formData) {
  try {
    const workflowId = formData.workflowId;
    if (!workflowId) return { success: false, message: 'Missing workflow ID.' };

    const ss         = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const isChange   = workflowId.startsWith('CHANGE_');
    const isEquipment = workflowId.startsWith('EQUIP_REQ_');
    const csvOrStr   = function(v) { return Array.isArray(v) ? v.join(', ') : (v || ''); };

    // Capture original data BEFORE any writes — used for change detection below
    const origData = isEquipment
      ? getFullEquipmentRequestData(workflowId)
      : (isChange ? getFullPositionChangeData(workflowId) : getFullNewHireData(workflowId));

    if (isEquipment) {
      // Write corrections back to Equipment_Requests sheet in-place
      const eqSheet = ss.getSheetByName(CONFIG.SHEETS.EQUIPMENT_REQUESTS);
      const eqRows  = eqSheet.getDataRange().getValues();
      for (let i = 0; i < eqRows.length; i++) {
        if (eqRows[i][1] !== workflowId) continue;
        const rowNum = i + 1;
        const updates = {
          5:  formData.firstName                              || '',
          6:  formData.lastName                               || '',
          7:  formData.siteName                               || '',
          8:  formData.positionTitle || formData.position     || '',
          9:  formData.reportingManagerName  || formData.managerName  || '',
          10: formData.reportingManagerEmail || formData.managerEmail || '',
          11: csvOrStr(formData.equipment),
          12: csvOrStr(formData.systems),
          13: formData.comments || formData.notes || '',
          14: formData.department || ''
        };
        Object.entries(updates).forEach(function(pair) {
          eqSheet.getRange(rowNum, parseInt(pair[0]) + 1).setValue(pair[1]);
        });
        break;
      }
    } else if (!isChange) {
      // Write corrections back to Initial Requests sheet in-place
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
    } else if (isChange) {
      // Write IT corrections back to Position Changes sheet (preserves old-side of change pairs)
      const pcSheet = ss.getSheetByName(CONFIG.SHEETS.POSITION_CHANGES);
      if (pcSheet) {
        const pcRows = pcSheet.getDataRange().getValues();
        for (let i = 1; i < pcRows.length; i++) {
          if (pcRows[i][0] !== workflowId) continue;
          const rowNum = i + 1;
          // Preserve the "old" side of site/title/class change pairs
          const siteOldVal  = String(pcRows[i][10] || '').split(' -> ')[0] || '';
          const titleOldVal = String(pcRows[i][11] || '').split(' -> ')[0] || '';
          const classOldVal = String(pcRows[i][12] || '').split(' -> ')[0] || '';
          const pcUpdates = {
            10: siteOldVal  + (formData.siteNew  ? ' -> ' + formData.siteNew  : ''),
            11: titleOldVal + (formData.titleNew  ? ' -> ' + formData.titleNew : ''),
            12: classOldVal + (formData.classNew  ? ' -> ' + formData.classNew : ''),
            17: csvOrStr(formData.sys),
            18: csvOrStr(formData.equip),
            19: csvOrStr(formData.rem),
            20: formData.comments || pcRows[i][20] || '',
            21: formData.department || pcRows[i][21] || '',
            22: csvOrStr(formData.purchasingSites)
          };
          Object.entries(pcUpdates).forEach(function(pair) {
            pcSheet.getRange(rowNum, parseInt(pair[0]) + 1).setValue(pair[1]);
          });
          break;
        }
      }
    }

    // Audit log in IT Confirmation Results
    let auditSheet = ss.getSheetByName('IT Confirmation Results');
    if (!auditSheet) {
      auditSheet = ss.insertSheet('IT Confirmation Results');
      auditSheet.appendRow([
        'Workflow ID','Form ID','Timestamp',
        'Boss Job Sites','Boss Cost Sheet','Boss Cost Sheet Jobs',
        'Boss Trip Reports','Boss Grievances',
        'Computer Req','Computer Type','Phone Req','Notes','Submitted By'
      ]);
      auditSheet.getRange(1,1,1,13).setFontWeight('bold').setBackground('#EB1C2D').setFontColor('#ffffff');
    }
    auditSheet.appendRow([
      workflowId, generateFormId('IT_CONF'), new Date(),
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

    const context = getWorkflowContext(workflowId);
    if (!context) return { success: false, message: 'Could not load workflow context.' };

    // ── Change detection ────────────────────────────────────────────────────
    if (origData) {
      if (isEquipment) {
        // Equipment: compare key identity + access fields
        const eqSubmitted = {
          firstName:     formData.firstName                                    || '',
          lastName:      formData.lastName                                     || '',
          siteName:      formData.siteName                                     || '',
          positionTitle: formData.positionTitle || formData.position           || '',
          managerName:   formData.reportingManagerName  || formData.managerName  || '',
          managerEmail:  formData.reportingManagerEmail || formData.managerEmail || '',
          systems:       Array.isArray(formData.systems)   ? formData.systems   : [],
          equipment:     Array.isArray(formData.equipment) ? formData.equipment : []
        };
        const eqChanges = diffFormFields(origData, eqSubmitted, CHANGE_FIELDS_IT_EQUIPMENT);
        if (eqChanges.length > 0) {
          sendChangeNotifications(workflowId, 'IT Confirmation', eqChanges, context, {
            requesterEmail: origData.reqEmail    || '',
            managerEmail:   eqSubmitted.managerEmail || (context && context.managerEmail) || '',
            notifySafety:   false,
            notifyIdSetup:  false
          });
        }

      } else if (isChange) {
        // Status change: compare new-side values and access lists
        // PositionSiteChangeRequest.html uses sys/equip/rem as checkbox names
        const chSubmitted = {
          siteNew:         formData.siteNew         || '',
          titleNew:        formData.titleNew         || '',
          classNew:        formData.classNew         || '',
          department:      formData.department       || '',
          systems:         Array.isArray(formData.sys)              ? formData.sys              : [],
          equipment:       Array.isArray(formData.equip)            ? formData.equip            : [],
          removal:         Array.isArray(formData.rem)              ? formData.rem              : [],
          purchasingSites: Array.isArray(formData.purchasingSites)  ? formData.purchasingSites  : []
        };
        const chChanges = diffFormFields(origData, chSubmitted, CHANGE_FIELDS_IT_STATUS_CHANGE);
        if (chChanges.length > 0) {
          const safetyTriggers = ['siteNew', 'titleNew'];
          sendChangeNotifications(workflowId, 'IT Confirmation', chChanges, context, {
            requesterEmail: origData.reqEmail    || '',
            managerEmail:   (context && context.managerEmail) || '',
            notifySafety:   chChanges.some(function(c) { return safetyTriggers.indexOf(c.field) !== -1; }),
            notifyIdSetup:  false
          });
        }

      } else {
        // New hire: compare full form
        const nhSubmitted = {
          firstName:       formData.firstName                                    || '',
          lastName:        formData.lastName                                     || '',
          hireDate:        origData.hireDate                                     || '', // hire date not editable in IT confirmation form — skip
          siteName:        formData.siteName                                     || '',
          positionTitle:   formData.positionTitle    || formData.position        || '',
          managerName:     formData.reportingManagerName  || formData.managerName  || '',
          managerEmail:    formData.reportingManagerEmail || formData.managerEmail || '',
          department:      formData.department                                   || '',
          systems:         Array.isArray(formData.systems)         ? formData.systems         : [],
          equipment:       Array.isArray(formData.equipment)       ? formData.equipment       : [],
          googleEmail:     formData.googleEmail                                  || '',
          googleDomain:    formData.googleDomain                                 || '',
          jonasJobNumbers: Array.isArray(formData.jonasJobNumbers) ? formData.jonasJobNumbers : (formData.jonasJobNumbers ? String(formData.jonasJobNumbers).split(', ').filter(Boolean) : []),
          purchasingSites: Array.isArray(formData.purchasingSites) ? formData.purchasingSites : []
        };
        const nhChanges = diffFormFields(origData, nhSubmitted, CHANGE_FIELDS_IT_NEW_HIRE);
        if (nhChanges.length > 0) {
          const safetyTriggers  = ['siteName', 'positionTitle'];
          const idSetupTriggers = ['firstName', 'lastName', 'positionTitle'];
          sendChangeNotifications(workflowId, 'IT Confirmation', nhChanges, context, {
            requesterEmail: origData.requesterEmail || '',
            managerEmail:   nhSubmitted.managerEmail || (context && context.managerEmail) || '',
            notifySafety:   nhChanges.some(function(c) { return safetyTriggers.indexOf(c.field)  !== -1; }),
            notifyIdSetup:  nhChanges.some(function(c) { return idSetupTriggers.indexOf(c.field) !== -1; })
          });
        }
      }
    }
    // ── End change detection ────────────────────────────────────────────────

    if (isEquipment) {
      // Equipment Request: launch action items (no IT Setup step)
      launchEquipmentActionItems(workflowId);
      Logger.log('[ITConfirmation] IT Confirmation submitted. Equipment action items launched for: ' + workflowId);
    } else {
      // New Hire: trigger IT Setup
      updateWorkflow(workflowId, 'In Progress', 'IT Setup Needed');
      syncWorkflowState(workflowId);

      const itUrl = buildFormUrl('it_setup', { wf: workflowId });
      sendFormEmail({
        to: CONFIG.EMAILS.IT,
        subject: 'IT Setup Required — ' + (context.employeeName || workflowId),
        body: 'IT Confirmation has been completed by Dave Langohr.\n\nPlease complete the IT setup form using the button below.',
        formUrl: itUrl,
        displayName: 'TEAM Group — Employee Onboarding',
        contextData: context
      });
      Logger.log('[ITConfirmation] IT Confirmation submitted. IT Setup triggered for: ' + workflowId);
    }

    return { success: true, scriptUrl: ScriptApp.getService().getUrl() };

  } catch (e) {
    Logger.log('[ERROR] submitITConfirmation: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Read IT Confirmation values for a workflow (if submitted).
 * Returns an object of overrides, or null if no review exists.
 */
function getITConfirmationData(workflowId) {
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('IT Confirmation Results');
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
    Logger.log('[ITConfirmation] getITConfirmationData error: ' + e.message);
    return null;
  }
}
