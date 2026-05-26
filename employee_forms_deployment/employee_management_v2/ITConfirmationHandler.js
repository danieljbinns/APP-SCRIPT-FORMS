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
  template.requestData   = JSON.stringify(getFullNewHireData(workflowId)); // equipment now in Initial_Requests
  template.referenceData = JSON.stringify(getInitialFormData());
  template.itContext     = getWorkflowContext(workflowId);   // full context for RequestHeader
  return template.evaluate()
    .setTitle('IT Confirmation' + (isEquipment ? ' — Equipment Request' : ''))
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// getFullNewHireData() and getFullPositionChangeData() moved to Services/ReferenceDataService.js (2026-05-14)

function submitITConfirmation(formData) {
  try {
    rawLog('submitITConfirmation', formData);
    const workflowId = formData.workflowId;
    if (!workflowId) return { success: false, message: 'Missing workflow ID.' };

    const ss         = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const isChange   = workflowId.startsWith('CHANGE_');
    const isEquipment = workflowId.startsWith('EQUIP_REQ_');
    const csvOrStr   = function(v) { return Array.isArray(v) ? v.join(', ') : (v || ''); };

    // Capture original data BEFORE any writes — used for change detection below
    // Equipment now reads from Initial_Requests via getFullNewHireData (same as new hire)
    const origData = isChange ? getFullPositionChangeData(workflowId) : getFullNewHireData(workflowId);

    if (!isChange) {
      // Write corrections back to Initial_Requests sheet in-place (new hire AND equipment)
      // Equipment requests now share the Initial_Requests sheet — no separate write-back needed
      // Write corrections back to Initial Requests sheet in-place
      const sheet = ss.getSheetByName(CONFIG.SHEETS.INITIAL_REQUESTS);
      const rows  = sheet.getDataRange().getValues();
      const IR = SCHEMA.INITIAL_REQUESTS;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] !== workflowId) continue;
        const rowNum  = i + 1;
        [
          [IR.NEW_HIRE_OR_REHIRE,  formData.hireType            || ''],
          [IR.EMPLOYEE_TYPE,       formData.employeeType        || ''],
          [IR.EMPLOYMENT_TYPE,     formData.employmentType      || ''],
          [IR.FIRST_NAME,          formData.firstName           || ''],
          [IR.MIDDLE_NAME,         formData.middleName          || ''],
          [IR.LAST_NAME,           formData.lastName            || ''],
          [IR.PREFERRED_NAME,      formData.preferredName       || ''],
          [IR.POSITION_TITLE,      formData.positionTitle       || ''],
          [IR.SITE_NAME,           formData.siteName            || ''],
          [IR.JOB_SITE_NUMBER,     formData.jobSiteNumber       || ''],
          [IR.MANAGER_EMAIL,       formData.reportingManagerEmail || formData.managerEmail || ''],
          [IR.MANAGER_NAME,        formData.reportingManagerName  || formData.managerName  || ''],
          [IR.SYSTEM_ACCESS,       formData.systemAccess        || ''],
          [IR.SYSTEMS,             csvOrStr(formData.systems)],
          [IR.EQUIPMENT,           csvOrStr(formData.equipment)],
          [IR.GOOGLE_EMAIL,        formData.googleEmail         || (origData && origData.googleEmail)         || ''],
          [IR.GOOGLE_DOMAIN,       formData.googleDomain        || (origData && origData.googleDomain)        || ''],
          [IR.COMPUTER_REQ,        formData.computerRequestType || (origData && origData.computerRequestType) || ''],
          [IR.COMPUTER_TYPE,       formData.computerType        || (origData && origData.computerType)        || ''],
          [IR.PHONE_REQ,           formData.phoneRequestType    || (origData && origData.phoneRequestType)    || ''],
          [IR.BOSS_SITES,          csvOrStr(formData.bossJobSites)],
          [IR.BOSS_COST_SHEET,     formData.bossCostSheet       || ''],
          [IR.BOSS_JOBS,           csvOrStr(formData.bossCostSheetJobs)],
          [IR.BOSS_TRIP,           formData.bossTripReports      || ''],
          [IR.BOSS_GRIEVANCES,     formData.bossGrievances      || ''],
          [IR.JONAS_JOB_NUMBERS,   csvOrStr(formData.jonasJobNumbers)],
          [IR.ADP_SITES,           csvOrStr(formData.adpSites)],
          [IR.DEPARTMENT,          formData.department          || ''],
          [IR.PURCHASING_SITES,    csvOrStr(formData.purchasingSites)]
        ].forEach(function(pair) {
          sheet.getRange(rowNum, pair[0] + 1).setValue(pair[1]);
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
          const PCC = SCHEMA.POSITION_CHANGES;
          const siteOldVal  = String(pcRows[i][PCC.SITE_TRANSFER]  || '').split(' -> ')[0] || '';
          const titleOldVal = String(pcRows[i][PCC.TITLE_CHANGE]   || '').split(' -> ')[0] || '';
          const classOldVal = String(pcRows[i][PCC.CLASSIFICATION]  || '').split(' -> ')[0] || '';
          [
            [PCC.SITE_TRANSFER,   siteOldVal  + (formData.siteNew  ? ' -> ' + formData.siteNew  : '')],
            [PCC.TITLE_CHANGE,    titleOldVal + (formData.titleNew  ? ' -> ' + formData.titleNew : '')],
            [PCC.CLASSIFICATION,  classOldVal + (formData.classNew  ? ' -> ' + formData.classNew : '')],
            [PCC.SYSTEMS_ADDED,   csvOrStr(formData.sys)],
            [PCC.EQUIPMENT,       csvOrStr(formData.equip)],
            [PCC.REMOVED_ACCESS,  csvOrStr(formData.rem)],
            [PCC.COMMENTS,        formData.comments || pcRows[i][PCC.COMMENTS] || ''],
            [PCC.DEPARTMENT,      formData.department || pcRows[i][PCC.DEPARTMENT] || ''],
            [22,                  csvOrStr(formData.purchasingSites)]  // col 22 — extended field, not in base schema
          ].forEach(function(pair) {
            pcSheet.getRange(rowNum, pair[0] + 1).setValue(pair[1]);
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
            requesterEmail: origData.requesterEmail || '',
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
            requesterEmail: origData.reqEmail || origData.requesterEmail || '',
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
        const ITC = SCHEMA.IT_CONFIRMATION_RESULTS;
        return {
          bossJobSites:      data[i][ITC.BOSS_JOB_SITES],
          bossCostSheet:     data[i][ITC.BOSS_COST_SHEET],
          bossCostSheetJobs: data[i][ITC.BOSS_COST_SHEET_JOBS],
          bossTripReports:   data[i][ITC.BOSS_TRIP_REPORTS],
          bossGrievances:    data[i][ITC.BOSS_GRIEVANCES],
          computerReq:       data[i][ITC.COMPUTER_REQ],
          computerType:      data[i][ITC.COMPUTER_TYPE],
          phoneReq:          data[i][ITC.PHONE_REQ]
        };
      }
    }
    return null;
  } catch (e) {
    Logger.log('[ITConfirmation] getITConfirmationData error: ' + e.message);
    return null;
  }
}
