/**
 * BOSS Setup Review — Gatekeeper step between HR Verification and IT Setup.
 * Sent to davelangohr@team-group.com for any employee receiving BOSS access.
 * Dave reviews/edits committees, cost sheets, trip reports, grievances, and equipment
 * before IT proceeds with provisioning.
 */

function serveBOSSReview(workflowId) {
  if (!workflowId) {
    return HtmlService.createHtmlOutput('<h1>Error: No workflow ID provided</h1>');
  }

  const template = HtmlService.createTemplateFromFile('BOSSReview');
  template.workflowId = workflowId;

  let requestData = {};
  if (typeof getITContextData === 'function') {
    requestData = getITContextData(workflowId);
    if (typeof getWorkflowContext === 'function') {
      const wfContext = getWorkflowContext(workflowId);
      if (wfContext) requestData = Object.assign({}, requestData, wfContext);
    }
  }
  template.requestData = requestData;

  return template.evaluate()
    .setTitle('BOSS Setup Review')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function submitBOSSReview(formData) {
  try {
    const workflowId = formData.workflowId;
    const formId = generateFormId('BOSS_REV');
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

    // Store Dave's reviewed/updated values
    let sheet = ss.getSheetByName('BOSS Review Results');
    if (!sheet) {
      sheet = ss.insertSheet('BOSS Review Results');
      sheet.appendRow([
        'Workflow ID', 'Form ID', 'Timestamp',
        'Boss Job Sites', 'Boss Cost Sheet', 'Boss Cost Sheet Jobs',
        'Boss Trip Reports', 'Boss Grievances',
        'Computer Req', 'Computer Type', 'Phone Req', 'Notes', 'Submitted By'
      ]);
      sheet.getRange(1, 1, 1, 13).setFontWeight('bold').setBackground('#EB1C2D').setFontColor('#ffffff');
    }

    sheet.appendRow([
      workflowId, formId, new Date(),
      formData.bossJobSites || '',
      formData.bossCostSheet || '',
      formData.bossCostSheetJobs || '',
      formData.bossTripReports || '',
      formData.bossGrievances || '',
      formData.computerReq || '',
      formData.computerType || '',
      formData.phoneReq || '',
      formData.notes || '',
      Session.getActiveUser().getEmail()
    ]);

    updateWorkflow(workflowId, 'In Progress', 'IT Setup Needed');
    syncWorkflowState(workflowId);

    // Trigger IT setup email
    const context = getWorkflowContext(workflowId);
    if (!context) return { success: false, message: 'Could not load workflow context.' };

    const itUrl = buildFormUrl('it_setup', { wf: workflowId });
    sendFormEmail({
      to: CONFIG.EMAILS.IT,
      subject: 'IT Setup Required',
      body: 'HR has verified the employee details and BOSS setup has been reviewed by Dave Langohr.\n\nPlease complete the IT setup form using the button below.',
      formUrl: itUrl,
      displayName: 'TEAM Group - Employee Onboarding',
      contextData: context
    });

    Logger.log('[BOSSReview] Review submitted. IT Setup triggered for: ' + workflowId);
    return { success: true };

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
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('BOSS Review Results');
    if (!sheet) return null;
    const data = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === workflowId) {
        return {
          bossJobSites:     data[i][3],
          bossCostSheet:    data[i][4],
          bossCostSheetJobs: data[i][5],
          bossTripReports:  data[i][6],
          bossGrievances:   data[i][7],
          computerReq:      data[i][8],
          computerType:     data[i][9],
          phoneReq:         data[i][10]
        };
      }
    }
    return null;
  } catch (e) {
    Logger.log('[BOSSReview] getBOSSReviewData error: ' + e.message);
    return null;
  }
}
