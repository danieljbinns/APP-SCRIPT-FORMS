'use strict';
/**
 * efx-fixtures.js — shared, test-only fixtures for efx-test.js and efx-e2e-test.js (review pass 2 §5 R7).
 *
 *   LOAD_ORDER   the Apps Script files both suites concatenate into one vm context (mirrors GAS's single global scope;
 *                `var X = (function(){…})()` singletons evaluate in this order, function declarations are hoisted)
 *   *_HEADERS    header rows for every sheet the handlers touch — ONE copy that must match Setup.js / SchemaConstants.js
 *   seedBase(rt) seeds those sheets (headers only, plus the one legacy ID Setup row the id allocator continues from)
 *
 * Add a new .js file to LOAD_ORDER before the first file that uses it at load time. super-test.js, form-field-map-test.js
 * and migration-test.js keep their own (shorter) lists on purpose.
 */

const LOAD_ORDER = [
  'SchemaConstants.js','Config.js','EfxUtil.js','Actor.js','EmployeeIdRegistry.js','FormContracts.js','ValidationUtils.js','RawLog.js',
  'AuditLog.js','SheetUtils.js','WorkflowManager.js','StateSync.js','Router.js','Services/AccessControlService.js',
  'Services/ActionItemService.js','Services/ReferenceDataService.js','EmailTemplates.js','EmailUtils.js','ChangeNotify.js',
  'IDSetup.js','HRVerificationHandler.js','ITSetupHandler.js','ITConfirmationHandler.js','InitialRequestHandler.js',
  'TerminationHandler.js','EquipmentRequestHandler.js','PositionChangeHandler.js','RequestDetailsHandler.js',
  'RequestActionsHandler.js','DirectoryService.js','EfxApi.js','N8nEnvelope.js','N8n.js'
];

// ── sheet headers (Setup.js is the canonical creator; SchemaConstants.js the index map) ──
const IR_HEADERS = ['Workflow ID','Form ID','Timestamp','Date Requested','Requester Name','Requester Email','Hire Date','New Hire/Rehire','Employee Type','Employment Type','First Name','Middle Name','Last Name','Preferred Name','Position Title','Site Name','Job Site #','Manager Email','Manager Name','System Access','Systems','Equipment','Google Email','Google Domain','Computer Req','Computer Type','Prev User (computer)','Prev Type','Serial #','Office 365','CC USA','Limit USA','CC CAN','Limit CAN','CC HD','Limit HD','Phone Req','Prev User (phone)','Prev Number','BOSS Sites','BOSS Cost Sheet','BOSS Jobs','BOSS Trip','BOSS Grievances','Jonas Job #s','JR Req','JR Assign','30/60/90','Comments','ADP Sites','Department','Purchasing Sites','Status','ADP Salary Access','BOSS Training Only','Internal Employee ID'];
const WF_HEADERS = ['Workflow ID','Workflow Type','Workflow Name','Initiator Email','Status','Created Date','Last Updated','Current Step','Employee Name'];
const ID_HEADERS = ['Workflow ID','Form ID','Submission Timestamp','Internal Employee ID','SiteDocs Worker ID','SiteDocs Job Code','SiteDocs Username','SiteDocs Password','DSS Username','DSS Password','Setup Notes','Submitted By','BOSS WIS Created','SiteDocs Badge Created'];
const AI_HEADERS = ['Workflow ID','Task ID','Category','Task Name','Description','Assigned To','Status','Created Date','Completed Date','Notes','Closed By','Draft','Form Type','Form Data'];
const DASH_HEADERS = ['Workflow ID','Employee Name','Global Status','Granular Step Details','Requester Name','Requester Email','Initiator Email','Date Requested','Last Updated','Manager Email','Requested Items JSON','Hire Date','Site','Employment Type'];
const HR_HEADERS = ['Workflow ID','Form ID','Submission Timestamp','ADP Associate ID','Verified Name','Verified Manager','Verified Manager Email','Verified JR Title','Notes','Submitted By'];
const IT_HEADERS = ['Workflow ID','Form ID','Submission Timestamp','Email Created','Assigned Email','Email Password','Computer Assigned','Computer Serial','Computer Model','Computer Type','Phone Assigned','Phone Carrier','Phone Model','Phone Number','Phone VM Password','BOSS Access','Incidents Access','CAA Access','Delivery App Access','Net Promoter Access','IT Notes','Submitted By','BOSS Details'];
const ITC_HEADERS = ['Workflow ID','Form ID','Timestamp','Boss Job Sites','Boss Cost Sheet','Boss Cost Sheet Jobs','Boss Trip Reports','Boss Grievances','Computer Req','Computer Type','Phone Req','Notes','Submitted By'];
const TERM_HEADERS = ['Workflow ID','Form ID','Timestamp','Requester Name','Requester Email','Employee Name','Employee ID','Employee Type','Work Email','Phone','Computer Serial','Site','Term Date','Reason','Manager Name','Manager Email','HR Approved','Has Reports','Reports To New','Systems','Email Forwarding','Email Files To','Email Delegate','Account Duration','Vacation Responder','Equipment','Comments','Last Day Worked','Attachment URL'];
const TERM_APP_HEADERS = ['Workflow ID','Form ID','Timestamp','Decision','Notes','Follow-up Required','Submitted By'];
const PC_HEADERS = ['Workflow ID','Form ID','Timestamp','Requester Name','Requester Email','Employee Name','Employee ID','Effective Date','Current Site','Change Types','Site Transfer','Title Change','Classification','Manager Change','Reassign Old Reports','Gain New Reports','Google Account','Systems Added','Equipment','Removed Access','Comments','Department','Purchasing Sites','Receiving Manager Email','Current Title','Current Manager Email','Current Manager Name','Current Class','Date Requested','First Name','Last Name','BOSS Training Only','BOSS Sites','BOSS Cost Sheet','BOSS Cost Jobs','BOSS Trip','BOSS Grievances','ADP Sites','ADP Salary Access','JR Required','JR Assignment','30/60/90','Computer Req','Computer Type','Computer Prev User','Computer Prev Type','Computer Serial','Office 365','CC USA','CC Limit USA','CC CAN','CC Limit CAN','CC HD','CC Limit HD','Phone Req','Phone Prev User','Phone Prev Number','Jonas Job Numbers','Equipment Return','Status','Attachment URL'];
const PCA_HEADERS = ['Workflow ID','Form ID','Timestamp','Decision','Notes','Confirmed Title','Confirmed New Manager','Submitted By'];
const FORM_EDIT_LOG_HEADERS = ['Timestamp','Workflow ID','Form Type','Changed By','Changes'];
const AUDIT_LOG_HEADERS = ['Timestamp','User Email','Action','Workflow ID','Detail','Result'];

/**
 * Seeds every sheet the handlers write to (headers only) plus:
 *   • ID Setup Results row NEW_EMP_OLD1 / 30410 — the allocator continues from the max existing id (→ 30411 first)
 *   • Reference_Sites (Aurora, Ottawa Main) and Reference_Managers (dbinns Admin, mgr@ Manager) lookups
 * Union of what efx-test.js and efx-e2e-test.js used to seed separately; both suites' assertion counts are unchanged.
 */
function seedBase(rt) {
  const s = rt.captures.seedSheet.bind(rt.captures);
  s('Workflows', [WF_HEADERS]);
  s('Initial Requests', [IR_HEADERS]);
  s('ID Setup Results', [ID_HEADERS, ['NEW_EMP_OLD1', 'F1', new Date(), '30410', 'W1', 'Hourly 1', 'u', 'p', 'd', 'p', '', 'someone@team-group.com', 'No', 'No']]);
  s('Action Items', [AI_HEADERS]);
  s('Dashboard_View', [DASH_HEADERS]);
  s('HR Verification Results', [HR_HEADERS]);
  s('IT Results', [IT_HEADERS]);
  s('IT Confirmation Results', [ITC_HEADERS]);
  s('Terminations', [TERM_HEADERS]);
  s('Termination Approval Results', [TERM_APP_HEADERS]);
  s('Position Changes', [PC_HEADERS]);
  s('Position Change Approval Result', [PCA_HEADERS]);
  s('Form Edit Log', [FORM_EDIT_LOG_HEADERS]);
  s('Audit Log', [AUDIT_LOG_HEADERS]);
  s('Reference_Managers', [['Email','Name','Role'], ['dbinns@team-group.com','David Binns','Admin'], ['mgr@team-group.com','Mgr One','Manager']]);
  s('Reference_Sites', [['Site Name','Job #'], ['Aurora','INDIRECT - Aurora'], ['Ottawa Main','1001']]);
}

module.exports = {
  LOAD_ORDER, seedBase,
  IR_HEADERS, WF_HEADERS, ID_HEADERS, AI_HEADERS, DASH_HEADERS, HR_HEADERS, IT_HEADERS, ITC_HEADERS,
  TERM_HEADERS, TERM_APP_HEADERS, PC_HEADERS, PCA_HEADERS, FORM_EDIT_LOG_HEADERS, AUDIT_LOG_HEADERS
};
