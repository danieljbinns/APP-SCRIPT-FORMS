/**
 * Create a new Google Form and link it to the new spreadsheet
 * Run this once to create a fresh form
 */

function createNewForm() {
  try {
    // Create new form
    const form = FormApp.create('WMAR - New Employee Request Form');
    const formId = form.getId();
    
    Logger.log('Created new form: ' + formId);
    Logger.log('Form URL: https://docs.google.com/forms/d/' + formId + '/edit');
    
    // Set form settings
    form.setTitle('New Employee Request Form');
    form.setDescription('Please fill out this form to request setup for a new employee.');
    form.setCollectEmail(true);
    form.setLimitOneResponsePerUser(false);
    form.setShowLinkToRespondAgain(true);
    
    // Link form to spreadsheet
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    form.setDestination(FormApp.DestinationType.SPREADSHEET, CONFIG.SPREADSHEET_ID);
    
    Logger.log('Form linked to spreadsheet: ' + CONFIG.SPREADSHEET_ID);
    
    // Get the form file and move to WMAR folder
    const formFile = DriveApp.getFileById(formId);
    const mainFolder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDERS.main);
    formFile.moveTo(mainFolder);
    
    Logger.log('Form moved to WMAR folder');
    
    // Add basic form structure
    addFormQuestions(form);
    
    Logger.log('Setup complete!');
    Logger.log('Copy this Form ID to Config.gs: ' + formId);
    
    return {
      formId: formId,
      editUrl: 'https://docs.google.com/forms/d/' + formId + '/edit',
      responseUrl: 'https://docs.google.com/forms/d/' + formId + '/viewform'
    };
    
  } catch (e) {
    Logger.log('Error creating form: ' + e.message);
    throw e;
  }
}

/**
 * Add questions to the form
 */
function addFormQuestions(form) {
  // Section 1: Requester Information
  form.addSectionHeaderItem()
    .setTitle('Requester Information')
    .setHelpText('Information about the person submitting this request');
  
  form.addTextItem()
    .setTitle('Requester Name')
    .setRequired(true);
  
  form.addTextItem()
    .setTitle('Requester Email')
    .setRequired(true);
  
  form.addTextItem()
    .setTitle('Requester Phone Number')
    .setRequired(false);
  
  // Section 2: New Employee Information
  form.addPageBreakItem()
    .setTitle('New Employee Information');
  
  form.addTextItem()
    .setTitle('First Name')
    .setRequired(true);
  
  form.addTextItem()
    .setTitle('Last Name')
    .setRequired(true);
  
  form.addDateItem()
    .setTitle('Hire Date')
    .setRequired(true);
  
  form.addTextItem()
    .setTitle('Site Name')
    .setRequired(true);
  
  form.addTextItem()
    .setTitle('Department')
    .setRequired(true);
  
  form.addTextItem()
    .setTitle('Position/Title')
    .setRequired(true);
  
  form.addMultipleChoiceItem()
    .setTitle('Hourly or Salary')
    .setChoiceValues(['Hourly', 'Salary'])
    .setRequired(true);
  
  form.addTextItem()
    .setTitle('Reporting Manager Email ')
    .setRequired(true);
  
  // Section 3: Equipment & Access Requests
  form.addPageBreakItem()
    .setTitle('Equipment & Access Requests');
  
  const yesNo = ['Yes', 'No'];
  
  form.addMultipleChoiceItem()
    .setTitle('Laptop')
    .setChoiceValues(yesNo)
    .setRequired(true);
  
  form.addMultipleChoiceItem()
    .setTitle('Monitor')
    .setChoiceValues(yesNo)
    .setRequired(true);
  
  form.addMultipleChoiceItem()
    .setTitle('Keyboard')
    .setChoiceValues(yesNo)
    .setRequired(true);
  
  form.addMultipleChoiceItem()
    .setTitle('Mouse')
    .setChoiceValues(yesNo)
    .setRequired(true);
  
  form.addMultipleChoiceItem()
    .setTitle('Phone')
    .setChoiceValues(yesNo)
    .setRequired(true);
  
  form.addMultipleChoiceItem()
    .setTitle('Fleetio / Vehicle')
    .setChoiceValues(yesNo)
    .setRequired(true);
  
  form.addMultipleChoiceItem()
    .setTitle('Credit Card')
    .setChoiceValues(yesNo)
    .setRequired(true);
  
  form.addMultipleChoiceItem()
    .setTitle('JR')
    .setChoiceValues(yesNo)
    .setRequired(true);
  
  form.addMultipleChoiceItem()
    .setTitle('30-60-90')
    .setChoiceValues(yesNo)
    .setRequired(true);
  
  form.addMultipleChoiceItem()
    .setTitle('ADP Supervisor Access')
    .setChoiceValues(yesNo)
    .setRequired(true);
  
  form.addMultipleChoiceItem()
    .setTitle('ADP Manager Access')
    .setChoiceValues(yesNo)
    .setRequired(true);
  
  form.addMultipleChoiceItem()
    .setTitle('JONAS')
    .setChoiceValues(yesNo)
    .setRequired(true);
  
  form.addMultipleChoiceItem()
    .setTitle('SiteDocs')
    .setChoiceValues(yesNo)
    .setRequired(true);
  
  Logger.log('Form questions added successfully');
}
