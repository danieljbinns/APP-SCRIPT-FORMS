/**
 * Initial Request Form - Handler Functions
 */

function serveInitialRequest() {
  const template = HtmlService.createTemplateFromFile('InitialRequest');
  template.referenceData = JSON.stringify(getInitialFormData());
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
    
    // I6: Notify Central Purchasing if that access was requested
    const systemsList = Array.isArray(formData.systems) ? formData.systems : [];
    if (systemsList.includes('Central Purchasing')) {
      const purchasingSitesList = Array.isArray(formData.purchasingSites) ? formData.purchasingSites.join(', ') : 'N/A';
      sendFormEmail({
        to: CONFIG.EMAILS.PURCHASING,
        subject: 'Central Purchasing Access Required',
        body: 'A new employee onboarding request includes Central Purchasing access for ' + employeeName + '.<br><br>' +
              '<b>Employee:</b> ' + employeeName + '<br>' +
              '<b>Site:</b> ' + formData.siteName + '<br>' +
              '<b>Start Date:</b> ' + formData.hireDate + '<br>' +
              '<b>Purchasing Sites:</b> ' + purchasingSitesList + '<br>' +
              '<b>Manager:</b> ' + (formData.reportingManagerName || 'N/A') + '<br>',
        formUrl: '',
        contextData: {
          workflowType: 'New Hire',
          employeeName: employeeName,
          siteName: formData.siteName,
          hireDate: formData.hireDate,
          employmentType: formData.employmentType,
          employeeType: formData.employeeType,
          department: formData.department || '',
          managerName: formData.reportingManagerName,
          managerEmail: formData.reportingManagerEmail,
          requesterEmail: formData.requesterEmail
        }
      });
    }

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
    Array.isArray(data.purchasingSites) ? data.purchasingSites.join(', ') : (data.purchasingSites || '')
  ];
}

/**
 * Get current user's details for auto-populating requester fields
 * @returns {Object} {email, name}
 */

