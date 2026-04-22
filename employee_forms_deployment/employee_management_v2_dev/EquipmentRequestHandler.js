/**
 * System & Equipment Access Form - Backend Handler
 */

function serveEquipmentRequest() {
  const template = HtmlService.createTemplateFromFile('InitialRequest');
  template.referenceData = JSON.stringify(getInitialFormData());
  template.mode = 'equipment';
  return template.evaluate()
    .setTitle('System & Equipment Request')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function submitEquipmentRequest(formData) {
  try {
    // 1. Create Workflow Record
    const workflowId = createWorkflow('EQUIP_REQ', 'System & Equipment Request', formData.reqEmail || formData.requesterEmail);
    const formId = generateFormId('EQUIP');
    
    formData.workflowId = workflowId;
    formData.formId = formId;
    formData.timestamp = new Date();
    
    // 2. Validate core fields
    const requiredFields = ['firstName', 'lastName', 'siteName', 'managerEmail', 'position'];
    const validation = validateRequiredFields(formData, requiredFields);
    
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }
    
    const employeeName = formData.firstName + ' ' + formData.lastName;
    
    // 3. Update Workflow Name
    updateWorkflow(workflowId, 'In Progress', 'Specialist Setup Needed', employeeName);
    
    // 4. Transform data to array format for Google Sheet
    // Expected Headers (Need to match the sheet exactly):
    // Timestamp | Workflow ID | Form ID | Requester Name | Requester Email | 
    // Employee First Name | Employee Last Name | Site Name | Job Title | Manager Name | Manager Email |
    // Equipment Requested | Systems Requested | [Conditional Fields...]
    
    // We will build the row data here.
    const rowData = formatEquipmentRequestData(formData);
    
    // 5. Append array to Google Sheet
    const sheetSuccess = addSheetRow(
      CONFIG.SPREADSHEET_ID,
      CONFIG.SHEETS.EQUIPMENT_REQUESTS,
      rowData
    );
    
    if (!sheetSuccess) throw new Error('Failed to write request to Equipment Requests database');
    
    // 6. Action Item Routing
    let systems = [];
    if (formData.systems) {
      systems = Array.isArray(formData.systems) ? formData.systems : [formData.systems];
    }
    
    let equipment = [];
    if (formData.equipment) {
      equipment = Array.isArray(formData.equipment) ? formData.equipment : [formData.equipment];
    }
    
    // Group tasks
    let itTasks = [];
    let idsetupTasks = [];
    let hrTasks = [];
    let creditCardTask = null;
    let businessCardTask = null;
    let vehicleTask = null;
    let jonasTask = null;

    systems.forEach(sys => {
      if (sys === 'Jonas Purchasing') jonasTask = true;
      else if (sys === 'ADP Supervisor Access' || sys === 'Incidents' || sys === 'Net Promoter Score') hrTasks.push(sys);
      else if (sys === 'Google Account' || sys === 'BOSS' || sys === 'SiteDocs' || sys === 'Delivery' || sys === 'CAA' || sys === 'Fleetio') idsetupTasks.push(sys);
      else idsetupTasks.push(sys); // fallback
    });
    
    equipment.forEach(eq => {
      if (eq === 'Credit Card') creditCardTask = true;
      else if (eq === 'Vehicle') vehicleTask = true;
      else if (eq === 'Business Cards') businessCardTask = true;
      else itTasks.push(eq); // Computer, Mobile Phone, SiteDocs Tablet
    });
    
    // Fire off individual tasks
    if (itTasks.length > 0) {
      ActionItemService.createActionItem(workflowId, 'IT', `Provide Hardware Equipment`, `Provision hardware for ${employeeName}:\n\n- ` + itTasks.join('\n- '), CONFIG.EMAILS.IT);
    }
    if (idsetupTasks.length > 0) {
      ActionItemService.createActionItem(workflowId, 'IT', `Setup Software Systems`, `Provision software access for ${employeeName}:\n\n- ` + idsetupTasks.join('\n- '), CONFIG.EMAILS.IDSETUP);
    }
    if (hrTasks.length > 0) {
      ActionItemService.createActionItem(workflowId, 'HR', `Setup HR Systems`, `Provision HR access for ${employeeName}:\n\n- ` + hrTasks.join('\n- '), CONFIG.EMAILS.HR);
    }
    if (jonasTask) {
      ActionItemService.createActionItem(workflowId, 'Finance', `Jonas Purchasing Setup`, `Provision Jonas access for ${employeeName}`, CONFIG.EMAILS.JONAS);
    }
    if (creditCardTask) {
      ActionItemService.createActionItem(workflowId, 'Finance', `Credit Card Setup`, `Provision Credit Card for ${employeeName}`, CONFIG.EMAILS.CREDIT_CARD);
    }
    if (vehicleTask) {
      ActionItemService.createActionItem(workflowId, 'Fleet', `Vehicle Setup`, `Provision Vehicle for ${employeeName}`, CONFIG.EMAILS.FLEETIO);
    }
    if (businessCardTask) {
      ActionItemService.createActionItem(workflowId, 'Assets', `Business Cards Setup`, `Order Business Cards for ${employeeName}`, CONFIG.EMAILS.BUSINESS_CARDS);
    }
    
    return {
      success: true,
      workflowId: workflowId,
      scriptUrl: getBaseUrl()
    };
    
  } catch (error) {
    Logger.log('Error submitting Equipment Request: ' + error.toString());
    return {
      success: false,
      message: 'Server Error: ' + error.toString()
    };
  }
}

/**
 * Helper to flatten formData into a row array
 */
function formatEquipmentRequestData(formData) {
  return [
    new Date(),
    formData.workflowId || '',
    formData.formId || '',
    formData.reqName || '',
    formData.reqEmail || '',
    formData.firstName || '',
    formData.lastName || '',
    formData.siteName || '',
    formData.position || '',
    formData.managerName || '',
    formData.managerEmail || '',
    Array.isArray(formData.equipment) ? formData.equipment.join(', ') : (formData.equipment || ''),
    Array.isArray(formData.systems) ? formData.systems.join(', ') : (formData.systems || ''),
    formData.comments || ''
  ];
}
