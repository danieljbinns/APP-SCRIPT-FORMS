/**
 * FormContracts.js — Employee Forms backend addition  (PROTOTYPE / NON-PRODUCTION)
 *
 * Declarative registry of what each real submit function accepts. Derived from the client payloads the
 * HTML actually posts. This is what makes "every field on every form" reachable without per-form endpoints.
 *
 * `verified:true`  — keys traced HTML name= → client payload key → handler field access → sheet column on 2026-09-16
 *                    (see docs/mapping/*.md in the fork root for the per-form tables with file:line citations).
 * `verified:false` — one or more links of that chain could not be confirmed (it_confirmation: duplicate handler definition;
 *                    specialist: dead sheet map). Keys are still the real payload keys.
 *
 * Conventions that matter for callers:
 *   • `required` = keys the HANDLER rejects when missing (validateRequiredFields), or — for handlers with no server
 *     check — the HTML-required controls the UI always posts. `optional` = every other key the UI can post.
 *   • `dynamicPrefixes` (it_setup only) = key prefixes accepted in addition to the listed keys (BOSS_Cmte_<site>, …).
 *   • Access: submitHRVerification / submitITSetup / both approvals check the role of the SESSION PRINCIPAL
 *     (Actor.principal() = Session.getActiveUser() — under the Execution API that is the impersonated efx-bot), never the
 *     caller-asserted actor.email (attribution only). efx-bot must be in the matching grp.forms.* group or
 *     CONFIG.ADMIN_EMAILS, otherwise the handler returns { success:false, message:'Access denied.' } → alias E_FORBIDDEN.
 *   • validateRequiredFields (new_hire, equipment_request) also rejects ANY string value whose first char is = + - or @.
 */
var FormContracts = (function () {
  var VERSION = '2026.09.16-r2';

  var C = {
    new_hire: {
      form: 'new_hire', kind: 'workflow', prefix: 'NEW_EMP_', createsWorkflow: true, verified: true,
      fn: 'submitInitialRequest', targetSheet: 'Initial Requests',
      // InitialRequestHandler.js:22-27 (validateRequiredFields)
      required: ['firstName', 'lastName', 'hireDate', 'requesterEmail', 'reportingManagerName', 'reportingManagerEmail',
                 'positionTitle', 'siteName', 'jobSiteNumber', 'employmentType', 'employeeType', 'newHireOrRehire', 'systemAccess'],
      // InitialRequest.html:1155-1207 (client data object) + formatInitialRequestData (InitialRequestHandler.js:174-233)
      optional: ['requesterName', 'dateRequested', 'middleName', 'preferredName', 'systems', 'equipment', 'googleEmail', 'googleDomain',
                 'computerRequestType', 'computerType', 'computerPreviousUser', 'computerPreviousType', 'computerSerialNumber',
                 'office365Required', 'creditCardUSA', 'creditCardLimitUSA', 'creditCardCanada', 'creditCardLimitCanada',
                 'creditCardHomeDepot', 'creditCardLimitHomeDepot', 'phoneRequestType', 'phonePreviousUser', 'phonePreviousNumber',
                 'bossJobSites', 'bossCostSheet', 'bossCostSheetJobs', 'bossTripReports', 'bossGrievances', 'jonasJobNumbers',
                 'jrRequired', 'jrAssignment', 'plan306090', 'comments', 'adpSites', 'department', 'purchasingSites',
                 'adpSalaryAccess', 'bossTrainingOnly', 'existingInternalEmployeeId'],
      types: { systems: 'string[]', equipment: 'string[]', adpSites: 'string[]|csv', purchasingSites: 'string[]|csv',
               bossJobSites: 'csv', bossCostSheetJobs: 'csv', jonasJobNumbers: 'csv',
               hireDate: 'yyyy-MM-dd', dateRequested: 'yyyy-MM-dd', systemAccess: 'YesNo', plan306090: 'YesNo', jrRequired: 'YesNo',
               creditCardUSA: 'YesNo|empty', creditCardCanada: 'YesNo|empty', creditCardHomeDepot: 'YesNo|empty',
               adpSalaryAccess: 'YesNo', bossTrainingOnly: 'YesNo', office365Required: 'YesNo|empty' },
      enums: { siteName: 'reference.sites', jobSiteNumber: 'reference.jobNumbers', jrAssignment: 'reference.jrs',
               employmentType: ['Hourly', 'Salary'], newHireOrRehire: ['New Hire', 'Rehire'], employeeType: ['Direct Hire', 'Agency'],
               systemAccess: ['Yes', 'No'], computerRequestType: ['New', 'Reassignment', ''], computerType: ['Chromebook', 'Windows', 'Mac', ''],
               phoneRequestType: ['New', 'Reassignment', ''],
               googleDomain: ['team-group.com', 'robinsonsolutions.com', 'industrialappliedtech.com', 'stgroup.ca', ''] },
      // multi-value checkbox groups (InitialRequest.html:251-382, :394-519) — allowed values, not validated as scalars
      multi: { systems: ['ADP Supervisor Access', 'BOSS', 'CAA', 'Delivery', 'Fleetio', 'Google Account', 'Incidents', 'Central Purchasing/Jonas', 'Net Promoter Score', 'SiteDocs Supervisor'],
               equipment: ['Business Cards', 'Computer', 'Credit Card', 'Mobile Phone', 'SiteDocs Tablet', 'Vehicle'] },
      responseFields: ['success', 'workflowId', 'formId', 'internalEmployeeId', 'message', 'scriptUrl'],
      notes: 'The UI clears fields of hidden sections before submit (InitialRequest.html:1210-1266); callers must do the same. ' +
             'Renames done by the UI: hireType→newHireOrRehire, position→positionTitle, managerEmail→reportingManagerEmail, ' +
             'managerName→reportingManagerName, googleEmailLocal→googleEmail, costSheetJobNumbers→bossCostSheetJobs, bossGrievance→bossGrievances.'
    },
    equipment_request: {
      form: 'equipment_request', kind: 'workflow', prefix: 'EQUIP_REQ_', createsWorkflow: true, verified: true,
      fn: 'submitEquipmentRequest', targetSheet: 'Initial Requests',
      // EquipmentRequestHandler.js:49 (validateRequiredFields) — note createWorkflow runs BEFORE this check (:41)
      required: ['firstName', 'lastName', 'siteName', 'managerEmail', 'managerName', 'position'],
      // InitialRequest.html mode=equipment posts the full new_hire data object + aliases (:1331-1336); new-hire-only
      // controls are disabled so their keys arrive as null (:676-690). Handler normalises aliases (:60-65) and forces systemAccess='Yes'.
      optional: ['reqName', 'reqEmail', 'requesterName', 'requesterEmail', 'positionTitle', 'reportingManagerEmail', 'reportingManagerName',
                 'dateRequested', 'middleName', 'preferredName', 'systems', 'equipment', 'googleEmail', 'googleDomain',
                 'computerRequestType', 'computerType', 'computerPreviousUser', 'computerPreviousType', 'computerSerialNumber',
                 'office365Required', 'creditCardUSA', 'creditCardLimitUSA', 'creditCardCanada', 'creditCardLimitCanada',
                 'creditCardHomeDepot', 'creditCardLimitHomeDepot', 'phoneRequestType', 'phonePreviousUser', 'phonePreviousNumber',
                 'bossJobSites', 'bossCostSheet', 'bossCostSheetJobs', 'bossTripReports', 'bossGrievances', 'jonasJobNumbers',
                 'comments', 'adpSites', 'department', 'purchasingSites', 'adpSalaryAccess', 'bossTrainingOnly',
                 'hireDate', 'newHireOrRehire', 'employeeType', 'employmentType', 'jobSiteNumber', 'systemAccess',
                 'jrRequired', 'jrAssignment', 'plan306090'],
      types: { systems: 'string[]', equipment: 'string[]', adpSites: 'string[]|csv', purchasingSites: 'string[]|csv' },
      enums: { siteName: 'reference.sites' },
      responseFields: ['success', 'workflowId', 'scriptUrl'],
      notes: 'Writes to Initial Requests (Equipment_Requests sheet is never written). No internalEmployeeId, no rawLogResult. ' +
             'Next step is IT Confirmation (davelangohr) → IT Setup → triggerSpecialists with EQUIP_ guards.'
    },
    termination_request: {
      form: 'termination_request', kind: 'workflow', prefix: 'TERM_', createsWorkflow: true, verified: true,
      fn: 'submitTerminationRequest', targetSheet: 'Terminations',
      // No validateRequiredFields in TerminationHandler.js; only managerEmail-without-managerName is rejected (:66-68).
      // `required` here = HTML-required controls (TerminationRequest.html) so a payload mirrors what the UI always sends.
      required: ['reqName', 'reqEmail', 'empName', 'empType', 'siteName', 'termDate', 'lastDayWorked', 'reason', 'managerName', 'managerEmail', 'has_reports'],
      // Raw HTML name= keys; checkbox groups arrive comma-joined as ONE string (TerminationRequest.html:340-353).
      optional: ['empWorkEmail', 'empPhone', 'hr_approved', 'reports_to_new', 'systems', 'google_forward', 'google_files', 'google_delegate',
                 'google_duration', 'google_vacation', 'equip', 'comments', 'attachmentBase64', 'attachmentName', 'attachmentMimeType'],
      types: { systems: 'csv|string[]', equip: 'csv|string[]', termDate: 'yyyy-MM-dd', lastDayWorked: 'yyyy-MM-dd',
               has_reports: 'YesNo', hr_approved: 'YesNo', attachmentBase64: 'base64' },
      enums: { siteName: 'reference.sites', empType: ['Hourly', 'Salary'],
               reason: ['Deceased', 'End of contract', 'Resigned', 'Retired', 'Terminated'],
               google_duration: ['Default 1 Month then delete', 'Longer (Specify in notes)', 'Delete Immediately (No forwarding/access)'] },
      // multi-value fields (CSV or array) — allowed values, not validated as scalars
      multi: { systems: ['ADP Supervisor Access', 'BOSS', 'CAA', 'Delivery', 'Google Account', 'Incidents', 'Fleetio', 'Central Purchasing/Jonas'],
               equip: ['Computer/Laptop', 'Mobile Phone', 'Tablet', 'Credit Card', 'Vehicle and Keys', 'Building Access Card/Keys'] },
      responseFields: ['success', 'workflowId', 'message'],
      notes: 'hr_approved is only required by the UI when reason==="Terminated"; reports_to_new when has_reports==="Yes"; ' +
             'google_* when systems contains "Google Account". Column 10 (Computer Serial) is always "N/A" — the form no longer collects empSerial.'
    },
    position_change_request: {
      form: 'position_change_request', kind: 'workflow', prefix: 'CHANGE_', createsWorkflow: true, verified: true,
      fn: 'submitPositionChangeRequest', targetSheet: 'Position Changes',
      // No validateRequiredFields; manager name/email pairing checks only (PositionChangeHandler.js:27-35), after createWorkflow (:19).
      // `required` = HTML-required controls that are stored (PositionSiteChangeRequest.html:42,46,53,79,83).
      required: ['firstName', 'lastName', 'currentClass', 'effDate', 'siteName'],
      // Raw HTML name= keys (PositionSiteChangeRequest.html:601-620): text/select → string, every checkbox group → array,
      // checked radio → string, dual-lists (adpSites, purchasingSites, bossComm, bossCostJobs, jonasJobs) → CSV string.
      optional: ['reqName', 'reqEmail', 'reqDate', 'currentTitle', 'currentManagerEmail', 'currentManagerName',
                 'changeType', 'siteOld', 'siteNew', 'department', 'receivingManagerEmail', 'titleOld', 'titleNew', 'classOld', 'classNew',
                 'mgrOldEmail', 'mgrOldName', 'mgrNewEmail', 'mgrNewName', 'hadReports', 'oldReportsTo', 'gainingReports', 'newReportsFrom',
                 'hasGoogle', 'existingEmail', 'googleEmail', 'googleDomain', 'sys', 'adpSalaryAccess', 'adpSites',
                 'bossTrainingOnly', 'bossComm', 'bossCost', 'bossCostJobs', 'bossTrip', 'bossGriev',
                 'jrReq', 'jrTitle', 'plan306090', 'equip', 'computerRequestType', 'computerType', 'office365Required',
                 'computerPreviousUser', 'computerPreviousType', 'computerSerialNumber',
                 'creditCardUSA', 'creditCardLimitUSA', 'creditCardCanada', 'creditCardLimitCanada', 'creditCardHomeDepot', 'creditCardLimitHomeDepot',
                 'phoneRequestType', 'phonePreviousUser', 'phonePreviousNumber', 'purchasingSites', 'jonasJobs', 'equipRem', 'rem',
                 'comments', 'attachmentBase64', 'attachmentName', 'attachmentMimeType'],
      types: { changeType: 'string[]|csv', sys: 'string[]|csv', equip: 'string[]|csv', equipRem: 'string[]|csv', rem: 'string[]|csv',
               adpSites: 'csv', purchasingSites: 'csv', bossComm: 'csv', bossCostJobs: 'csv', jonasJobs: 'csv',
               effDate: 'yyyy-MM-dd', reqDate: 'yyyy-MM-dd',
               adpSalaryAccess: 'Yes|empty (send a STRING; the UI sends ["Yes"]/[] which is written raw)',
               creditCardUSA: 'Yes|empty (string)', creditCardCanada: 'Yes|empty (string)', creditCardHomeDepot: 'Yes|empty (string)' },
      enums: { siteName: 'reference.sites', currentClass: ['Hourly', 'Salary'], classOld: ['Hourly', 'Salary', ''], classNew: ['Hourly', 'Salary', ''],
               jrTitle: 'reference.jrs' },
      // multi-value fields (array or CSV) — allowed values, not validated as scalars
      multi: { changeType: ['Site Transfer', 'Position Change', 'Classification', 'Manager Change'],
               sys: ['ADP Supervisor Access', 'BOSS', 'CAA', 'Delivery', 'DSS', 'Fleetio', 'Google Account', 'Incidents', 'Central Purchasing/Jonas', 'Net Promoter Score', 'SiteDocs'],
               equip: ['Business Cards', 'Computer', 'Credit Card', 'Mobile Phone', 'SiteDocs Tablet', 'Vehicle'],
               equipRem: ['Computer', 'Mobile Phone', 'SiteDocs Tablet', 'Vehicle', 'Credit Card'],
               rem: ['ADP', 'BOSS', 'CAA', 'Delivery', 'Fleetio', 'Google Account', 'SiteDocs'] },
      responseFields: ['success', 'workflowId', 'message'],
      notes: 'hadReports/gainingReports/hasGoogle are UI gatekeepers and are NOT stored. reqEmail falls back to Actor.email(). ' +
             'Approval code tests changeType for "Reporting Manager Change" (PositionChangeHandler.js:426) which the UI never sends ("Manager Change").'
    },
    id_setup: {
      form: 'id_setup', kind: 'step', createsWorkflow: false, verified: true,
      fn: 'submitEmployeeIDSetup', targetSheet: 'ID Setup Results', idField: 'internalEmployeeId',
      // No validateRequiredFields in IDSetup.js; `required` = always-required HTML controls (EmployeeIDSetup.html:39,51,56,96,101 minus the id).
      required: ['workflowId', 'siteDocsWorkerId', 'siteDocsJobCode', 'dssUsername', 'dssPassword'],
      optional: ['internalEmployeeId', 'formId', 'siteDocsUsername', 'siteDocsPassword', 'setupNotes', 'bossWisCreated', 'siteDocsBadgeCreated'],
      types: { bossWisCreated: 'YesNo', siteDocsBadgeCreated: 'YesNo', internalEmployeeId: 'numeric string' },
      // Hard-coded <option>s in EmployeeIDSetup.html:57-63 (not a reference list)
      enums: { siteDocsJobCode: ['Hourly 1', 'Hourly 2', 'Salary 1', 'Salary 2', 'Supervisor', 'Manager'] },
      responseFields: ['success', 'message'],
      notes: 'internalEmployeeId is pre-assigned at submitInitialRequest (EmployeeIdRegistry); omit it or send the pre-assigned value. ' +
             'A different value is honoured ONLY when the session principal is an admin (Actor.canOverrideEmployeeId(); IDSetup.js) — there is no override flag; ' +
             'non-admins get {success:false,"Internal Employee ID is pre-assigned (…) and cannot be changed here."}. ' +
             'siteDocsUsername/Password are required by the UI only when the request’s Systems contains "SiteDocs". formId is ignored (regenerated). ' +
             'Every submit APPENDS a row (no update-in-place). Step → "HR Verification Needed"; Hourly+No system access also emails credentials and creates the Safety item.'
    },
    hr_verification: {
      form: 'hr_verification', kind: 'step', createsWorkflow: false, verified: true,
      fn: 'submitHRVerification', targetSheet: 'HR Verification Results',
      // Client payload HRVerification.html:201-215; handler reads exactly these (HRVerificationHandler.js:155-163,199-203).
      // No validateRequiredFields; `required` = HTML-required controls. ACCESS: actor must be isHR or isAdmin (:94-98).
      required: ['workflowId', 'firstName', 'lastName', 'managerName', 'managerEmail', 'jobTitle', 'adpAssociateId'],
      optional: ['formId', 'hireDate', 'jrTitle', 'siteName', 'department', 'notes'],
      types: { hireDate: 'yyyy-MM-dd' },
      enums: { siteName: 'reference.sites', jrTitle: 'reference.jrs' },
      responseFields: ['success', 'message'],
      notes: 'jrTitle is required by the UI only when the request’s JR Req === "Yes". Stored as "jobTitle / jrTitle" in col 7. ' +
             'Also overwrites Initial Requests cols 6,10,12,14,15,17,18,46,50. A second submit for the same workflow updates in place and sends NO emails. ' +
             'The hidden internalEmployeeId input is not posted by the UI.'
    },
    it_setup: {
      form: 'it_setup', kind: 'step', createsWorkflow: false, verified: true,
      fn: 'submitITSetup', targetSheet: 'IT Results',
      // Client payload ITSetup.html:370-385 (FormData, multi-values joined with ","); handler ITSetupHandler.js:214,256-296.
      // No validateRequiredFields; `required` = HTML-required radios. ACCESS: actor must be isIT or isAdmin (:207-211).
      required: ['workflowId', 'Email_Created', 'Computer_Assigned', 'Phone_Assigned', 'BOSS_Access'],
      optional: ['requestId', 'formId', 'Employee_Name', 'Email_Username', 'Email_Domain', 'Email_Temp_Password',
                 'Computer_Serial', 'Computer_Model', 'Computer_Type',
                 'Phone_Carrier', 'Phone_Model', 'Phone_Number', 'Phone_VM_Password',
                 'BOSS_TripReports', 'BOSS_Grievances', 'Incidents_Access', 'CAA_Access', 'Delivery_App_Access', 'Net_Promoter_Score_Access', 'IT_Notes'],
      // Dynamic per-committee / per-job confirmations (ITSetup.html:213,223), value "Confirmed"
      dynamicPrefixes: ['BOSS_Cmte_', 'BOSS_CostSheet_'],
      types: { Email_Created: 'YesNo', Computer_Assigned: 'YesNo', Phone_Assigned: 'YesNo', BOSS_Access: 'YesNo',
               Incidents_Access: 'YesNo', CAA_Access: 'YesNo', Delivery_App_Access: 'YesNo', Net_Promoter_Score_Access: 'YesNo',
               BOSS_TripReports: 'Confirmed|absent', BOSS_Grievances: 'Confirmed|absent' },
      enums: { Email_Domain: ['@team-group.com', '@robinsonsolutions.com', '@industrialappliedtech.com', ''] },
      responseFields: ['success', 'message'],
      notes: 'Email_Username/Domain/Temp_Password are required by the UI regardless of Email_Created (static required attr); Assigned Email is built only when Email_Created==="Yes". ' +
             'The UI defaults Incidents/CAA/Delivery/NPS to "No" when unchecked — send them explicitly. bossDetails is server-derived (not a payload key). ' +
             'First submit for NEW_EMP_/EQUIP_REQ_ → step "Specialist Forms Needed" + triggerSpecialists; for CHANGE_ it closes the IT it_setup action item. ' +
             'A second submit updates IT Results in place with no side effects.'
    },
    it_confirmation: {
      form: 'it_confirmation', kind: 'step', createsWorkflow: false, verified: false,
      fn: 'submitITConfirmation', targetSheet: 'IT Confirmation Results',
      required: ['workflowId'],
      // NEW_EMP_/EQUIP_REQ_: InitialRequest.html mode=it_confirmation posts the full new_hire data object + workflowId + notes (:1326-1328).
      // CHANGE_: PositionSiteChangeRequest.html posts its raw keys + workflowId + notes (:630-632). Handler reads the union below.
      optional: ['notes', 'hireType', 'employeeType', 'employmentType', 'firstName', 'middleName', 'lastName', 'preferredName',
                 'positionTitle', 'position', 'siteName', 'jobSiteNumber', 'reportingManagerEmail', 'reportingManagerName', 'managerEmail', 'managerName',
                 'systemAccess', 'systems', 'equipment', 'googleEmail', 'googleDomain', 'computerRequestType', 'computerType', 'phoneRequestType',
                 'bossJobSites', 'bossCostSheet', 'bossCostSheetJobs', 'bossTripReports', 'bossGrievances', 'jonasJobNumbers', 'adpSites',
                 'department', 'purchasingSites',
                 // posted by the UI but ignored by the handler:
                 'requesterName', 'requesterEmail', 'dateRequested', 'hireDate', 'newHireOrRehire', 'computerPreviousUser', 'computerPreviousType',
                 'computerSerialNumber', 'office365Required', 'creditCardUSA', 'creditCardLimitUSA', 'creditCardCanada', 'creditCardLimitCanada',
                 'creditCardHomeDepot', 'creditCardLimitHomeDepot', 'phonePreviousUser', 'phonePreviousNumber', 'jrRequired', 'jrAssignment',
                 'plan306090', 'comments', 'adpSalaryAccess', 'bossTrainingOnly',
                 // CHANGE_ keys:
                 'siteNew', 'titleNew', 'classNew', 'sys', 'equip', 'rem'],
      responseFields: ['success', 'scriptUrl'],
      notes: 'FIXED 2026-09-17 (EFX): the duplicate definition is gone — BOSSReviewHandler.js was an older, ' +
             'misnamed copy of this whole handler and every function it held was shadowed or identical, so it was deleted. ' +
             'Also fixed: the handler rewrites the FULL Initial Requests row, so a partial payload used to blank First Name, ' +
             'Last Name, Position Title, Site Name, Manager and ~18 more columns (verified live on TEST by submitting only ' +
             '{workflowId, notes}). It now backfills any key the caller omitted from the loaded original, which also cures the ' +
             'hireType/newHireOrRehire blanking and the dead computerRequestType/phoneRequestType fallbacks (the loader returns ' +
             'computerReq/phoneReq). Present-but-empty still clears, so deliberate blanking from the UI works. ' +
             'STILL TRUE: does not close the "IT Confirmation" action item. Step → "IT Setup Needed", emails IT. ' +
             'Kept verified:false until the fix is re-proven live; flipping it is then a one-line change.'
    },
    termination_approval: {
      form: 'termination_approval', kind: 'step', createsWorkflow: false, verified: true,
      fn: 'submitTerminationApproval', targetSheet: 'Termination Approval Results',
      // TerminationApproval.html:64-68; TerminationHandler.js:242. ACCESS: actor must be isHR or isAdmin (:235-239).
      required: ['workflowId', 'decision'], optional: ['notes'], enums: { decision: ['Approved', 'Rejected'] },
      responseFields: ['success', 'message'],
      notes: 'Follow-up Required (col 5) is the literal "YES" — not a payload key. Duplicate approvals return {success:true,"Approval already processed…"} without side effects.'
    },
    position_change_approval: {
      form: 'position_change_approval', kind: 'step', createsWorkflow: false, verified: true,
      fn: 'submitPositionChangeApproval', targetSheet: 'Position Change Approval Result',
      // StatusChangeApproval.html:110-117; PositionChangeHandler.js:383. ACCESS: actor must be isHR or isAdmin (:376-380).
      required: ['workflowId', 'decision'], optional: ['notes', 'confirmedTitle', 'confirmedNewManager', 'confirmedJrTitle'],
      enums: { decision: ['Approved', 'Rejected'], confirmedJrTitle: 'reference.jrs' },
      responseFields: ['success', 'message'],
      notes: 'confirmedJrTitle is used in email context only (not stored). Duplicate approvals return {success:true,"Approval already processed…"}.'
    },
    specialist: {
      form: 'specialist', kind: 'step', createsWorkflow: false, verified: false,
      fn: 'submitSpecialistForm', targetSheet: 'Specialist Results',
      // SafetyOnboarding.html:83-88 et al. post { workflowId, department, details (JSON string), notes }; Specialist.js:61-62,94,105,113,119.
      required: ['workflowId', 'department'], optional: ['formId', 'details', 'notes', 'jrTitle'],
      enums: { department: ['creditcard', 'businesscards', 'fleetio', 'jonas', 'sitedocs', 'review', 'safety', 'safetyterm', 'wis'] },
      notes: 'Specialist.js sheet map is dead (all → Specialist Results, safety rows misaligned) and it never closes the action item. Prefer n8n_closeTask / n8n_assignSafetyTraining.'
    }
  };

  /** Only these top-level Forms functions may be invoked through efxRunAs. */
  var CALLABLE = {};
  Object.keys(C).forEach(function (k) { CALLABLE[C[k].fn] = true; });
  ['getRequestDetails', 'getStepResultData', 'getTerminationDetails', 'getEquipmentRequestDetails', 'getWorkflow',
   'getDashboardData', 'getMyTaskCounts', 'getInitialFormData', 'getSitesList', 'getJRsList', 'searchDirectoryUsers',
   'cancelRequest', 'bumpRequest', 'updateHireDate', 'saveActionItemDraft', 'closeActionItemWithNotes'
  ].forEach(function (f) { CALLABLE[f] = true; });

  function list() {
    return Object.keys(C).map(function (k) {
      var c = C[k];
      return { form: c.form, kind: c.kind, prefix: c.prefix || null, createsWorkflow: !!c.createsWorkflow, fn: c.fn,
               action: c.createsWorkflow ? 'workflow.create' : 'form.submit', verified: !!c.verified, targetSheet: c.targetSheet };
    });
  }

  function hash_(obj) {
    var s = JSON.stringify(obj);
    try {
      var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
      return 'sha256:' + bytes.map(function (b) { b = (b + 256) % 256; return (b < 16 ? '0' : '') + b.toString(16); }).join('');
    } catch (e) {
      // Fallback (e.g. local mock runtime without DigestAlgorithm): stable FNV-1a-style hash
      var h = 0x811c9dc5;
      for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
      return 'fnv1a:' + ('00000000' + h.toString(16)).slice(-8);
    }
  }

  function get(form) {
    var c = C[form];
    if (!c) return null;
    var out = {};
    Object.keys(c).forEach(function (k) { out[k] = c[k]; });
    out.version = VERSION;
    out.hash = hash_({ r: c.required, o: c.optional, t: c.types || {}, v: VERSION });
    return out;
  }

  function validate(form, data) {
    var c = C[form];
    if (!c) return { ok: false, fields: [{ field: 'form', problem: 'unknown form ' + form }] };
    data = data || {};
    var problems = [];
    c.required.forEach(function (k) {
      var v = data[k];
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) problems.push({ field: k, problem: 'required' });
    });
    var known = {};
    c.required.concat(c.optional || []).forEach(function (k) { known[k] = true; });
    var prefixes = c.dynamicPrefixes || [];
    function isDynamic_(k) { return prefixes.some(function (p) { return k.indexOf(p) === 0; }); }
    Object.keys(data).forEach(function (k) { if (!known[k] && !isDynamic_(k)) problems.push({ field: k, problem: 'unknown field (not in contract)' }); });
    Object.keys(c.enums || {}).forEach(function (k) {
      var e = c.enums[k];
      if (Array.isArray(e) && data[k] !== undefined && data[k] !== '' && e.indexOf(data[k]) === -1) problems.push({ field: k, problem: 'must be one of ' + e.join('|') });
    });
    return { ok: problems.length === 0, fields: problems };
  }

  function isCallable(fnName) { return !!CALLABLE[fnName]; }

  return { VERSION: VERSION, list: list, get: get, validate: validate, isCallable: isCallable };
})();
