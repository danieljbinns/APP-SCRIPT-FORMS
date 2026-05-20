/**
 * Initial Request Form - Handler Functions
 */

function serveInitialRequest() {
  const template = HtmlService.createTemplateFromFile('InitialRequest');
  template.referenceData = JSON.stringify(getInitialFormData());
  template.mode          = 'new_hire';
  template.baseMode      = 'new_hire';
  template.workflowId    = '';
  template.requestData   = 'null';
  return template.evaluate()
    .setTitle('New Employee Request')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function submitInitialRequest(formData) {
  try {
    // Create workflow first
    const workflowId = createWorkflow('NEW_EMP', 'New Employee Onboarding', formData.requesterEmail);
    const formId = generateFormId('INIT_REQ');
    
    // Add IDs to form data
    formData.workflowId = workflowId;
    formData.formId = formId;
    formData.timestamp = new Date();
    
    // Validate required fields
    const requiredFields = ['firstName', 'lastName', 'hireDate', 'requesterEmail', 'reportingManagerName', 'reportingManagerEmail'];
    const validation = validateRequiredFields(formData, requiredFields);
    
    if (!validation.valid) {
      return {
        success: false,
        message: validation.message
      };
    }
    
    // Format data for spreadsheet
    const rowData = formatInitialRequestData(formData);
    
    // Add to spreadsheet
    const sheetSuccess = addSheetRow(
      CONFIG.SPREADSHEET_ID,
      CONFIG.SHEETS.INITIAL_REQUESTS,
      rowData
    );
    
    if (!sheetSuccess) {
      throw new Error('Failed to add row to spreadsheet');
    }
    
    // Update workflow with employee name
    const employeeName = formData.firstName + ' ' + formData.lastName;
    updateWorkflow(workflowId, 'In Progress', 'ID Setup Needed', employeeName);
    syncWorkflowState(workflowId);

    Logger.log('[SUCCESS] Form submitted: Workflow ID: ' + workflowId + ', Form ID: ' + formId);
    
    // Send initial emails with full context
    const idSetupUrl = buildFormUrl('id_setup', { wf: workflowId });
    
    sendInitialRequestEmails({
      requestId: workflowId,
      employeeName: employeeName,
      jobTitle: formData.positionTitle,
      siteName: formData.siteName,
      hireDate: formData.hireDate,
      managerName: formData.reportingManagerName,
      managerEmail: formData.reportingManagerEmail,
      requesterEmail: formData.requesterEmail,
      requestDate: new Date().toLocaleDateString(),
      employmentType: formData.employmentType,
      employeeType: formData.employeeType,
      newHireOrRehire: formData.newHireOrRehire,
      systemAccess: formData.systemAccess,
      systems: formData.systems,
      equipment: formData.equipment,
      department: formData.department || '',
      employeeIdSetupUrl: idSetupUrl,
      siteDocsEmail: CONFIG.EMAILS.IDSETUP
    });
    
    return {
      success: true,
      workflowId: workflowId,
      formId: formId,
      message: 'Request submitted successfully',
      scriptUrl: ScriptApp.getService().getUrl()
    };
    
  } catch (error) {
    Logger.log('[ERROR] Form submission error: ' + error.toString());
    return {
      success: false,
      message: 'Error submitting form: ' + error.message
    };
  }
}

/**
 * Read-back variant used by ReplayService to refire submission-time emails.
 * Reads the Initial Requests sheet row and calls sendInitialRequestEmails —
 * no new records are written, and no workflow state is changed.
 */
function _sendInitialRequestSubmitEmails(workflowId) {
  const data = getRowByRequestId(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS.INITIAL_REQUESTS, workflowId);
  if (!data) {
    Logger.log('[InitialRequestHandler] _sendInitialRequestSubmitEmails: no data for ' + workflowId);
    return;
  }
  const IR           = SCHEMA.INITIAL_REQUESTS;
  const employeeName = (String(data[IR.FIRST_NAME] || '') + ' ' + String(data[IR.LAST_NAME] || '')).trim();
  const hireDateRaw  = data[IR.HIRE_DATE];
  const hireDate     = hireDateRaw instanceof Date
    ? Utilities.formatDate(hireDateRaw, Session.getScriptTimeZone(), 'yyyy-MM-dd')
    : String(hireDateRaw || '');
  const systemsStr   = String(data[IR.SYSTEMS]   || '');
  const equipmentStr = String(data[IR.EQUIPMENT]  || '');
  sendInitialRequestEmails({
    requestId:          workflowId,
    employeeName:       employeeName,
    jobTitle:           String(data[IR.POSITION_TITLE]     || ''),
    siteName:           String(data[IR.SITE_NAME]          || ''),
    hireDate:           hireDate,
    managerName:        String(data[IR.MANAGER_NAME]       || ''),
    managerEmail:       String(data[IR.MANAGER_EMAIL]      || ''),
    requesterEmail:     String(data[IR.REQUESTER_EMAIL]    || ''),
    requestDate:        new Date().toLocaleDateString(),
    employmentType:     String(data[IR.EMPLOYMENT_TYPE]    || ''),
    employeeType:       String(data[IR.EMPLOYEE_TYPE]      || ''),
    newHireOrRehire:    String(data[IR.NEW_HIRE_OR_REHIRE] || ''),
    systemAccess:       String(data[IR.SYSTEM_ACCESS]      || ''),
    systems:            systemsStr   ? systemsStr.split(',').map(function(s) { return s.trim(); }).filter(Boolean)   : [],
    equipment:          equipmentStr ? equipmentStr.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [],
    department:         String(data[IR.DEPARTMENT]         || ''),
    employeeIdSetupUrl: buildFormUrl('id_setup', { wf: workflowId }),
    siteDocsEmail:      CONFIG.EMAILS.IDSETUP
  });
}

function formatInitialRequestData(data) {
  return [
    data.workflowId,
    data.formId,
    data.timestamp,
    data.dateRequested,
    data.requesterName,
    data.requesterEmail,
    data.hireDate,
    data.newHireOrRehire,
    data.employeeType,
    data.employmentType,
    data.firstName,
    data.middleName || '',
    data.lastName,
    data.preferredName || '',
    data.positionTitle,
    data.siteName,
    data.jobSiteNumber,
    data.reportingManagerEmail,
    data.reportingManagerName || '',
    data.systemAccess,
    Array.isArray(data.systems) ? data.systems.join(', ') : '',
    Array.isArray(data.equipment) ? data.equipment.join(', ') : '',
    data.googleEmail || '',
    data.googleDomain || '',
    data.computerRequestType || '',
    data.computerType || '',
    data.computerPreviousUser || '',
    data.computerPreviousType || '',
    data.computerSerialNumber || '',
    data.office365Required || '',
    data.creditCardUSA || '',
    data.creditCardLimitUSA || '',
    data.creditCardCanada || '',
    data.creditCardLimitCanada || '',
    data.creditCardHomeDepot || '',
    data.creditCardLimitHomeDepot || '',
    data.phoneRequestType || '',
    data.phonePreviousUser || '',
    data.phonePreviousNumber || '',
    data.bossJobSites || '',
    data.bossCostSheet || '',
    data.bossCostSheetJobs || '',
    data.bossTripReports || '',
    data.bossGrievances || '',
    data.jonasJobNumbers || '',
    data.jrRequired || '',
    data.jrAssignment || '',
    data.plan306090 || '',
    data.comments || '',
    Array.isArray(data.adpSites) ? data.adpSites.join(', ') : (data.adpSites || ''),
    data.department || '',
    Array.isArray(data.purchasingSites) ? data.purchasingSites.join(', ') : (data.purchasingSites || ''),
    '',                        // col 52 — Status (written later by ITConfirmationHandler)
    data.adpSalaryAccess || 'No'  // col 53 — ADP Salary Access
  ];
}

/**
 * Get current user's details for auto-populating requester fields
 * @returns {Object} {email, name}
 */

