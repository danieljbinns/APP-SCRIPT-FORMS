/**
 * N8n.js — EFX alias layer for n8n  (fork: employee_management_v2_efx)
 *
 * WHAT THIS IS
 *   The stable, documented set of functions n8n calls through the Apps Script Execution API
 *   (via the Router sub-workflow / node). Every alias validates against FormContracts, runs under an
 *   Actor identity, and calls the SAME handler the web UI calls — so tasks close, next steps unlock and
 *   the same emails send. Nothing here writes to a sheet directly.
 *
 * CONTRACT FOR CALLERS (n8n)
 *   n8n_<name>(actor, ...args)  → { ok, apiVersion, requestId, result } | { ok:false, error:{code,message,fields?} }
 *   actor: JSON string or object { id:'n8n:<workflow-slug>', email:'efx-bot@team-group.com', display:'…' }
 *   All args are JSON-serialisable. Dates as 'yyyy-MM-dd'.
 *
 * CONTRACT FOR MAINTAINERS (us) — see AGENTS.md
 *   Additions are free. Renames/removals keep an alias for a deprecation window and bump N8N_API_VERSION.
 *   Every alias maps to a FormContracts entry or an allow-listed read function. No business logic here.
 *   This file holds ONLY the public surface (n8n_* functions, N8N_ALIASES, N8N_API_VERSION); the private envelope
 *   helpers (n8nActor_/n8nOk_/n8nErr_/n8nGuard_/n8nOptions_/n8nSubmit_/n8nBool_/n8nParse_/n8nMapHandlerError_) are in
 *   N8nEnvelope.js. tools/gen-contracts.js and tools/n8n-workflows-check.js parse THIS file for N8N_ALIASES and `function n8n_*`.
 */
var N8N_API_VERSION = '2026.09.17-1';   // 2026.09.17-1: + all remaining forms, generic create/submit, cancel/bump/hireDate, drafts, list/context

var N8N_ALIASES = [
  // ── generic (contract-driven) ──
  { name: 'n8n_createWorkflow',        kind: 'create', desc: 'Generic: create any workflow-creating form by name (new_hire | equipment_request | termination_request | position_change_request)' },
  { name: 'n8n_submitForm',            kind: 'update', desc: 'Generic: submit any step form by name (id_setup | hr_verification | it_setup | termination_approval | position_change_approval)' },
  // ── named wrappers for the remaining forms ──
  { name: 'n8n_createEquipmentRequest',      kind: 'create', desc: 'Equipment/systems request (EQUIP_REQ_)', form: 'equipment_request' },
  { name: 'n8n_createTerminationRequest',    kind: 'create', desc: 'End of employment request (TERM_) — goes to HR approval', form: 'termination_request' },
  { name: 'n8n_submitTerminationApproval',   kind: 'update', desc: 'HR/Payroll decision on a TERM_ workflow (Approved | Rejected) — creates offboarding action items', form: 'termination_approval' },
  { name: 'n8n_createPositionChangeRequest', kind: 'create', desc: 'Status / position / site change request (CHANGE_) — goes to HR approval', form: 'position_change_request' },
  { name: 'n8n_submitPositionChangeApproval',kind: 'update', desc: 'HR decision on a CHANGE_ workflow — creates change action items', form: 'position_change_approval' },
  { name: 'n8n_submitItSetup',               kind: 'update', desc: 'IT Setup step — creates specialist action items (JR, 30/60/90, WIS, …)', form: 'it_setup' },
  // ── workflow actions ──
  { name: 'n8n_cancelWorkflow',        kind: 'update', desc: 'Cancel a workflow (audited; cancels its open tasks) — principal must be HR/IT/Admin/requester/manager' },
  { name: 'n8n_bumpWorkflow',          kind: 'update', desc: 'Send the reminder for the current step (rate-limited by the app)' },
  { name: 'n8n_updateHireDate',        kind: 'update', desc: 'Change the hire date (HR/IT/Admin principal)' },
  { name: 'n8n_saveTaskDraft',         kind: 'update', desc: 'Save partial checklist/notes on an action item without closing it' },
  // ── reads ──
  { name: 'n8n_listWorkflows',         kind: 'read',   desc: 'List workflows from Dashboard_View with filters (type/status/step/since/limit)' },
  { name: 'n8n_getContext',            kind: 'read',   desc: 'Full workflow context as used by emails (getWorkflowContext), credentials redacted' },
  { name: 'n8n_ping',                  kind: 'read',   desc: 'Health: env, effective spreadsheet, versions' },
  { name: 'n8n_info',                  kind: 'read',   desc: 'Same as ping plus alias list' },
  { name: 'n8n_contracts',             kind: 'read',   desc: 'Field/function contracts for every form' },
  { name: 'n8n_createInitialRequest',  kind: 'create', desc: 'New Hire — real submitInitialRequest; returns workflowId + internalEmployeeId', form: 'new_hire' },
  { name: 'n8n_submitIdSetup',         kind: 'update', desc: 'ID Setup step — real submitEmployeeIDSetup (uses pre-assigned id)', form: 'id_setup' },
  { name: 'n8n_submitHrVerification',  kind: 'update', desc: 'HR Verification step (contract verified in r2 against HRVerification.html)', form: 'hr_verification' },
  { name: 'n8n_getWorkflow',           kind: 'read',   desc: 'Request details + checklist (getRequestDetails)' },
  { name: 'n8n_getEmployeeId',         kind: 'read',   desc: 'Pre-assigned Internal Employee ID for a workflow' },
  { name: 'n8n_listTasks',             kind: 'read',   desc: 'Action items by workflow/formType/status/assignee' },
  { name: 'n8n_closeTask',             kind: 'close',  desc: 'Close any action item exactly like the Complete button' },
  { name: 'n8n_closeJrTask',           kind: 'close',  desc: 'JR: close jr_title task by TK- id or workflowId (replaces doPost completeJrTitle)' },
  { name: 'n8n_assignSafetyTraining',  kind: 'close',  desc: 'Safety: close safety_onboarding task with SiteDocs/DSS confirmation' },
  { name: 'n8n_events',                kind: 'read',   desc: 'Event feed (Raw Log) since cursor' }
];

/**
 * Error codes the alias layer returns as error.code — SOURCE OF TRUTH for the "Error codes" table in docs/N8N_CONTRACTS.md
 * (rendered by tools/gen-contracts.js) and for n8n/README.md. Changing a code's MEANING is breaking (AGENTS.md §3);
 * adding a row is additive. Do not invent codes elsewhere without adding them here.
 */
var N8N_ERROR_CODES = [
  { code: 'E_VALIDATION',       meaning: 'payload failed the FormContracts check (`error.fields[]` lists field + problem) or bad/missing arguments', n8n: 'fix the mapping; do not retry' },
  { code: 'E_UNKNOWN_FORM',     meaning: 'form name not in FormContracts', n8n: 'fix the form name; do not retry' },
  { code: 'E_UNVERIFIED_FORM',  meaning: 'form contract is `verified:false` (`it_confirmation`, `specialist`); pass `options.allowUnverified=true` to override', n8n: 'do not retry' },
  { code: 'E_UPSTREAM',         meaning: 'the Forms handler returned `success:false`; its message is passed through and `error.upstream` carries the raw result', n8n: 'read the message (usually data/state); retry only if it says so' },
  { code: 'E_FORBIDDEN',        meaning: 'the real session principal (efx-bot) lacks the role (HR/IT/Admin/requester/manager); `error.principal` names it', n8n: 'do not retry until the group membership changes' },
  { code: 'E_NOT_FOUND',        meaning: 'workflow not found, or no open task of that formType for the workflow', n8n: 'check the ids; do not retry' },
  { code: 'E_ALREADY_CLOSED',   meaning: 'the task is already Closed', n8n: 'treat as success (idempotent close)' },
  { code: 'E_TASK_NOT_OPEN',    meaning: 'the task is Cancelled (or otherwise not Open), or its workflow is Cancelled', n8n: 'NOT a success — do not retry; the workflow was cancelled' },
  { code: 'E_RATE_LIMITED',     meaning: 'a bump reminder was already sent recently for this step (one per step per hour)', n8n: 'retry later' },
  { code: 'E_DISABLED',         meaning: 'the alias or form is switched off for automation by an administrator (EFX_ALIASES_OFF / EFX_ALIASES_ON Script Properties); `error.disabled` names the entry that matched', n8n: 'do not retry — ask an administrator to re-enable it' },
  { code: 'E_INTERNAL',         meaning: 'unexpected exception inside the alias layer', n8n: 'retry once after a minute; if it repeats, send us the requestId' }
];

// ── read ────────────────────────────────────────────────────────────────────────
function n8n_ping() {
  return n8nGuard_(function () {
    var info = efxInfo();
    info.apiVersion = N8N_API_VERSION;
    info.deploymentUrl = CONFIG.DEPLOYMENT_URL || '';
    info.principal = Actor.principal();   // who Forms authorises as (the impersonated efx-bot under the Execution API)
    return n8nOk_(info);
  });
}
function n8n_info() {
  return n8nGuard_(function () {
    var info = efxInfo(); info.apiVersion = N8N_API_VERSION; info.aliases = N8N_ALIASES;
    info.killSwitch = n8nSwitchList_();   // admin visibility: what is currently switched off
    return n8nOk_(info);
  });
}
function n8n_contracts() {
  return n8nGuard_(function () {
    var forms = FormContracts.list().map(function (f) { return FormContracts.get(f.form); });
    return n8nOk_({ apiVersion: N8N_API_VERSION, contractsVersion: FormContracts.VERSION, aliases: N8N_ALIASES, forms: forms });
  });
}
function n8n_getWorkflow(actor, workflowId) {
  return n8nGuard_(function () {
    if (!workflowId) return n8nErr_('E_VALIDATION', 'workflowId is required');
    var r = Actor.run(n8nActor_(actor), function () { return getRequestDetails(String(workflowId)); });
    if (!r || r.success === false) return n8nErr_('E_NOT_FOUND', (r && r.message) || 'Workflow not found');
    var pre = null; try { pre = EmployeeIdRegistry.info(String(workflowId)); } catch (e) {}
    return n8nOk_(r, { employeeId: pre });
  });
}
function n8n_getEmployeeId(actor, workflowId) {
  return n8nGuard_(function () {
    if (!workflowId) return n8nErr_('E_VALIDATION', 'workflowId is required');
    return n8nOk_(EmployeeIdRegistry.info(String(workflowId)));
  });
}
function n8n_listTasks(actor, filter) {
  return n8nGuard_(function () {
    return n8nOk_(efxTaskList(n8nParse_(filter, {})));
  });
}
function n8n_events(actor, params) {
  return n8nGuard_(function () {
    return n8nOk_(efxEventsSince(n8nParse_(params, {})));
  });
}

// ── create / update ─────────────────────────────────────────────────────────────
/** New Hire. data = exactly what InitialRequest.html posts (see FormContracts.new_hire). include: ['record'] optional. */
function n8n_createInitialRequest(actor, data, include) {
  return n8nSubmit_(actor, 'new_hire', n8nParse_(data, {}), true, include || []);
}
/** ID Setup. internalEmployeeId may be omitted — the pre-assigned id is used. */
function n8n_submitIdSetup(actor, data, include) {
  return n8nSubmit_(actor, 'id_setup', n8nParse_(data, {}), false, include || []);
}
/** HR Verification — contract verified in FormContracts r2 (2026-09-16); check n8n_contracts().forms[].verified if the version changes. */
function n8n_submitHrVerification(actor, data, include) {
  return n8nSubmit_(actor, 'hr_verification', n8nParse_(data, {}), false, include || []);
}

// ── generic + remaining forms (all contract-driven; unverified forms refused unless allowUnverified) ──
function n8n_createWorkflow(actor, form, data, options) {
  return n8nSubmit_(actor, String(form || ''), n8nParse_(data, {}), true, options);
}
function n8n_submitForm(actor, form, data, options) {
  var d = n8nParse_(data, {});
  if (d && d.workflowId === undefined && options && options.workflowId) d.workflowId = options.workflowId;
  return n8nSubmit_(actor, String(form || ''), d, false, options);
}
function n8n_createEquipmentRequest(actor, data, options)       { return n8n_createWorkflow(actor, 'equipment_request', data, options); }
function n8n_createTerminationRequest(actor, data, options)     { return n8n_createWorkflow(actor, 'termination_request', data, options); }
function n8n_createPositionChangeRequest(actor, data, options)  { return n8n_createWorkflow(actor, 'position_change_request', data, options); }
function n8n_submitTerminationApproval(actor, data, options)    { return n8n_submitForm(actor, 'termination_approval', data, options); }
function n8n_submitPositionChangeApproval(actor, data, options) { return n8n_submitForm(actor, 'position_change_approval', data, options); }
function n8n_submitItSetup(actor, data, options)                { return n8n_submitForm(actor, 'it_setup', data, options); }

// ── workflow actions (authorization = real session principal inside the handlers) ──
function n8n_cancelWorkflow(actor, workflowId) {
  return n8nGuard_(function () {
    if (!workflowId) return n8nErr_('E_VALIDATION', 'workflowId is required');
    var r = Actor.run(n8nActor_(actor), function () { return cancelRequest(String(workflowId)); });
    if (!r || r.success === false) return n8nMapHandlerError_(r, 'E_UPSTREAM', { message: 'cancelRequest failed', codes: ['E_NOT_FOUND'] });
    return n8nOk_(r);
  });
}
function n8n_bumpWorkflow(actor, workflowId, targetStep) {
  return n8nGuard_(function () {
    if (!workflowId) return n8nErr_('E_VALIDATION', 'workflowId is required');
    var r = Actor.run(n8nActor_(actor), function () { return bumpRequest(String(workflowId), targetStep || ''); });
    if (!r || r.success === false) return n8nMapHandlerError_(r, 'E_UPSTREAM', { message: 'bumpRequest failed', codes: ['E_RATE_LIMITED'] });
    return n8nOk_(r);
  });
}
function n8n_updateHireDate(actor, workflowId, newDate) {
  return n8nGuard_(function () {
    if (!workflowId || !newDate) return n8nErr_('E_VALIDATION', 'workflowId and newDate (yyyy-MM-dd) are required');
    var r = Actor.run(n8nActor_(actor), function () { return updateHireDate(String(workflowId), String(newDate)); });
    if (!r || r.success === false) return n8nMapHandlerError_(r, 'E_UPSTREAM', { message: 'updateHireDate failed' });
    return n8nOk_(r);
  });
}
/** checklist: { "<item>": { status:'Pending'|'Complete'|'Collected'|…, comments? } } — saved in the UI's {items:{…}} shape */
function n8n_saveTaskDraft(actor, taskId, notes, checklist) {
  return n8nGuard_(function () {
    if (!taskId) return n8nErr_('E_VALIDATION', 'taskId is required');
    var a = n8nActor_(actor);
    var items = n8nParse_(checklist, {});
    var now = new Date().toISOString(), by = a.email || a.display || a.id;
    // Merge into the existing draft (a human's autosave) instead of replacing it — review pass 2 M2
    var existing = (efxTaskList({ taskId: String(taskId) }).tasks || [])[0];
    if (!existing) return n8nErr_('E_NOT_FOUND', 'Task not found: ' + taskId);
    var draft = efxParseDraft_(existing.draft);   // same lift as efxTaskClose (legacy shapes included) — refactor R3
    Object.keys(items).forEach(function (k) { var v = items[k] || {}; draft.items[k] = { status: v.status || 'Pending', by: by, at: now, comments: v.comments || '' }; });
    var mergedNotes = (notes === undefined || notes === null) ? (existing.notes || '') : String(notes);
    var r = Actor.run(a, function () { return saveActionItemDraft(String(taskId), mergedNotes, JSON.stringify(draft)); });
    if (!r || r.success === false) return n8nErr_('E_UPSTREAM', (r && r.message) || 'saveActionItemDraft failed');
    return n8nOk_(r);
  });
}

// ── reads ──
function n8n_listWorkflows(actor, filter) {
  return n8nGuard_(function () {
    return n8nOk_(efxListWorkflows(n8nParse_(filter, {})));
  });
}
function n8n_getContext(actor, workflowId) {
  return n8nGuard_(function () {
    if (!workflowId) return n8nErr_('E_VALIDATION', 'workflowId is required');
    var ctx = Actor.run(n8nActor_(actor), function () { return getWorkflowContext(String(workflowId)); });
    if (!ctx) return n8nErr_('E_NOT_FOUND', 'No context for ' + workflowId);
    var safe = efxRedact_(ctx);
    return n8nOk_(efxJsonSafe(safe));
  });
}

// ── close ───────────────────────────────────────────────────────────────────────
/** Generic: { taskId } | { workflowId, formType } + { notes, checklist, formData, dryRun } */
function n8n_closeTask(actor, params) {
  return n8nGuard_(function () {
    var p = n8nParse_(params, {});
    var r = efxTaskClose(JSON.stringify(n8nActor_(actor)), p, n8nBool_(p.dryRun));
    if (r && r.code) return n8nErr_(r.code, r.message);
    return n8nOk_(r);
  });
}
/** JR — drop-in for doPost completeJrTitle: accepts TK- task id or NEW_EMP_ workflowId. */
function n8n_closeJrTask(actor, idOrWorkflow, notes) {
  return n8nGuard_(function () {
    if (!idOrWorkflow) return n8nErr_('E_VALIDATION', 'A task id (TK-…) or workflowId is required');
    var p = String(idOrWorkflow).indexOf('TK-') === 0
      ? { taskId: String(idOrWorkflow), formType: 'jr_title' }     // formType enforced even by TK- id (review F7)
      : { workflowId: String(idOrWorkflow), formType: 'jr_title' };
    p.notes = notes || 'JR title verified & assigned via n8n';
    var r = efxTaskClose(JSON.stringify(n8nActor_(actor)), p, false);
    if (r && r.code) return n8nErr_(r.code, r.message);
    return n8nOk_(r);
  });
}
/**
 * Safety — closes the 'safety_onboarding' action item for a workflow with confirmations.
 * details: { siteDocsConfirmed: 'Yes'|'No', dssConfirmed: 'Yes'|'No', notes }
 * If SAFETY_TRAINING_AT_SUBMIT is on, the task already exists from submit; otherwise it is created at ID Setup (hourly)
 * or after HR Verification (salary) — this alias closes whichever exists, or returns E_NOT_FOUND.
 */
function n8n_assignSafetyTraining(actor, workflowId, details) {
  return n8nGuard_(function () {
    if (!workflowId) return n8nErr_('E_VALIDATION', 'workflowId is required');
    var d = n8nParse_(details, {});
    // Closing means "training assigned". Refuse to close with a 'No' unless the caller explicitly forces it (audited in notes).
    if ((d.siteDocsConfirmed === 'No' || d.dssConfirmed === 'No') && !n8nBool_(d.force)) {
      return n8nErr_('E_VALIDATION', 'Both siteDocsConfirmed and dssConfirmed must be "Yes" to close the Safety task; pass force:true to close anyway (recorded in notes).',
        { fields: [{ field: d.siteDocsConfirmed === 'No' ? 'siteDocsConfirmed' : 'dssConfirmed', problem: 'is "No"' }] });
    }
    if (n8nBool_(d.force)) d.notes = (d.notes ? d.notes + ' — ' : '') + 'FORCED close with unconfirmed items via n8n';
    var p = {
      workflowId: String(workflowId), formType: 'safety_onboarding',
      notes: d.notes || 'SiteDocs locations + DSS learning paths assigned via n8n',
      checklist: {
        'Assign SiteDocs locations for employee': { status: (d.siteDocsConfirmed === 'No') ? 'Open' : 'Complete', comments: d.siteDocsNotes || '' },
        'Assign DSS learning paths':              { status: (d.dssConfirmed === 'No') ? 'Open' : 'Complete',      comments: d.dssNotes || '' }
      },
      formData: { siteDocsConfirmed: d.siteDocsConfirmed || 'Yes', dssConfirmed: d.dssConfirmed || 'Yes', source: 'n8n' }
    };
    var r = efxTaskClose(JSON.stringify(n8nActor_(actor)), p, n8nBool_(d.dryRun));
    if (r && r.code) return n8nErr_(r.code, r.message);
    return n8nOk_(r);
  });
}
