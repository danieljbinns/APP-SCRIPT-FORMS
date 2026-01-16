/**
 * Initial Request Form - Handler Functions
 */

function serveInitialRequest() {
  return HtmlService.createHtmlOutputFromFile('InitialRequest')
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
    const requiredFields = ['firstName', 'lastName', 'hireDate', 'requesterEmail'];
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
    
    Logger.log('[SUCCESS] Form submitted: Workflow ID: ' + workflowId + ', Form ID: ' + formId);
    
    // Send initial emails
    const idSetupUrl = buildFormUrl('id_setup', { wf: workflowId });
    
    sendFormEmail({
      to: CONFIG.EMAILS.SITEDOCS,
      subject: 'New Employee ID Setup Required',
      body: 'A new employee request has been submitted.\\n\\nEmployee: ' + employeeName + '\\nHire Date: ' + formData.hireDate + '\\nWorkflow ID: ' + workflowId + '\\n\\nPlease complete the Employee ID Setup form:\\n' + idSetupUrl,
      formUrl: idSetupUrl,
      displayName: 'Team Group Companies - Employee Onboarding'
    });
    
    sendFormEmail({
      to: formData.requesterEmail,
      subject: 'Employee Request Submitted - ' + workflowId,
      body: 'Your employee request has been submitted successfully.\\n\\nEmployee: ' + employeeName + '\\nWorkflow ID: ' + workflowId + '\\n\\nTrack status here:\\n' + buildFormUrl('dashboard'),
      displayName: 'Team Group Companies - Employee Onboarding'
    });
    
    return {
      success: true,
      workflowId: workflowId,
      formId: formId,
      message: 'Request submitted successfully'
    };
    
  } catch (error) {
    Logger.log('[ERROR] Form submission error: ' + error.toString());
    return {
      success: false,
      message: 'Error submitting form: ' + error.message
    };
  }
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
    data.comments || ''
  ];
}
