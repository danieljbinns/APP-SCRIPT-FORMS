/**
 * =============================================================================
 * TEST SCRIPT - Workflow Engine Testing
 * =============================================================================
 * 
 * Run these functions from the Apps Script editor to test the workflow engine.
 * Each function tests a different aspect of the system.
 */

/**
 * TEST 1: Start a New Hire Workflow
 * This will create workflow and task records in your sheets
 */
function test1_StartNewHireWorkflow() {
  const initialData = {
    'First Name': 'Test',
    'Last Name': 'Employee',
    'Requester Email': 'test@team-group.com',
    'Department': 'IT',
    'Reporting Manager': 'Manager Name',
    'Credit Card': 'Yes',
    'Fleetio / Vehicle': 'Yes',
    'JR': 'Yes',
    '30-60-90': 'Yes',
    'ADP Supervisor Access': 'No',
    'ADP Manager Access': 'No',
    'JONAS': 'No',
    'SiteDocs': 'No'
  };
  
  const workflowId = WorkflowEngine.startWorkflow(
    'NewHire',
    initialData,
    'hr@team-group.com'
  );
  
  Logger.log(`✅ Created workflow: ${workflowId}`);
  Logger.log('📊 Check your "Workflows" and "Tasks" sheets!');
  
  return workflowId;
}

/**
 * TEST 2: Check Workflow Status
 * Replace WORKFLOW_ID with the ID from test1
 */
function test2_CheckWorkflowStatus() {
  const workflowId = 'WF-NEWHIRE-XXXXXXXXX'; // REPLACE THIS
  
  const status = WorkflowEngine.getWorkflowStatus(workflowId);
  
  Logger.log('=== WORKFLOW STATUS ===');
  Logger.log(`Workflow: ${status.workflow['Workflow ID']}`);
  Logger.log(`Status: ${status.workflow['Status']}`);
  Logger.log(`Progress: ${status.progress.percentComplete}%`);
  Logger.log(`Tasks: ${status.progress.completed}/${status.progress.total} complete`);
  Logger.log('');
  Logger.log('=== TASKS ===');
  status.tasks.forEach(task => {
    Logger.log(`- ${task['Task Type']}: ${task['Status']}`);
  });
  
  return status;
}

/**
 * TEST 3: Complete a Task
 * Replace TASK_ID with a task ID from your Tasks sheet
 */
function test3_CompleteTask() {
  const taskId = 'TASK-HRSETUP-XXXXXXXXX'; // REPLACE THIS
  
  const completionData = {
    'Employee ID': 'EMP-12345',
    'Start Date': new Date()
  };
  
  WorkflowEngine.completeTask(taskId, completionData);
  
  Logger.log(`✅ Completed task: ${taskId}`);
  Logger.log('📊 Check if next tasks were created automatically!');
}

/**
 * TEST 4: List All Workflows
 */
function test4_ListAllWorkflows() {
  const sheet = SheetAccess.getWorkflowsSheet();
  const data = sheet.getDataRange().getValues();
  
  Logger.log('=== ALL WORKFLOWS ===');
  for (let i = 1; i < data.length; i++) {
    Logger.log(`${data[i][0]} | ${data[i][1]} | ${data[i][2]}`);
  }
}

/**
 * TEST 5: List All Tasks
 */
function test5_ListAllTasks() {
  const sheet = SheetAccess.getTasksSheet();
  const data = sheet.getDataRange().getValues();
  
  Logger.log('=== ALL TASKS ===');
  for (let i = 1; i < data.length; i++) {
    Logger.log(`${data[i][0]} | ${data[i][2]} | ${data[i][3]} | Assigned: ${data[i][4]}`);
  }
}

/**
 * TEST 6: Clean Up (Delete Test Data)
 * Use this to reset for fresh testing
 */
function test6_CleanUpTestData() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  
  // Delete Workflows sheet
  const workflowsSheet = ss.getSheetByName('Workflows');
  if (workflowsSheet) {
    ss.deleteSheet(workflowsSheet);
    Logger.log('✅ Deleted Workflows sheet');
  }
  
  // Delete Tasks sheet
  const tasksSheet = ss.getSheetByName('Tasks');
  if (tasksSheet) {
    ss.deleteSheet(tasksSheet);
    Logger.log('✅ Deleted Tasks sheet');
  }
  
  Logger.log('🔄 Sheets will be recreated on next workflow start');
}

/**
 * TEST 7: Simulate Full Workflow
 * Creates workflow and completes all tasks automatically
 */
function test7_SimulateFullWorkflow() {
  Logger.log('🚀 Starting full workflow simulation...');
  
  // Start workflow
  const workflowId = test1_StartNewHireWorkflow();
  Utilities.sleep(2000);
  
  // Get all tasks
  const tasks = SheetAccess.getTasksByWorkflowId(workflowId);
  
  // Complete tasks in order
  tasks.forEach((task, index) => {
    Logger.log(`\n📝 Completing task ${index + 1}/${tasks.length}: ${task['Task Type']}`);
    
    WorkflowEngine.completeTask(task['Task ID'], {
      completedBy: 'test-automation',
      completedAt: new Date()
    });
    
    Utilities.sleep(1000);
  });
  
  // Check final status
  Logger.log('\n=== FINAL STATUS ===');
  test2_CheckWorkflowStatus();
}

/**
 * HELPER: Test Email Sending
 */
function testEmailUtility() {
  EmailUtils.sendEmail(
    'test@team-group.com',
    'Test Email from Workflow Engine',
    EmailUtils.buildEmailTemplate(
      'Test Notification',
      '<p>This is a test email from the workflow engine.</p>',
      'https://google.com',
      'Click Here'
    )
  );
  
  Logger.log('✅ Email sent! (Check DEV_EMAIL_OVERRIDE if in DEV mode)');
}
