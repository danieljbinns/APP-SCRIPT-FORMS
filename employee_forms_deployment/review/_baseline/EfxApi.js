/**
 * EfxBridgeApi.js — Employee Forms backend addition  (PROTOTYPE / NON-PRODUCTION)
 *
 * The ONLY surface the EFX Bridge calls (as a library, symbol `EF`). Top-level functions so they are
 * exposed by the library. Arguments crossing the library boundary are JSON strings or primitives.
 * No business logic here — everything delegates to existing Forms functions wrapped in Actor.run().
 */

function efxInfo() {
  var callerSession = 'unknown';
  try { callerSession = Session.getActiveUser().getEmail() ? 'authenticated' : 'anonymous'; } catch (e) {}
  return {
    env: (typeof ENVIRONMENT !== 'undefined') ? ENVIRONMENT : '?',
    spreadsheetId: CONFIG.SPREADSHEET_ID,          // resolved by THIS script's Script Properties (V1 check)
    libraryVersion: FormContracts.VERSION,
    callerSession: callerSession
  };
}

function efxContracts() { return FormContracts.list(); }
function efxContract(form) { return FormContracts.get(String(form)); }
function efxValidate(form, data) { return FormContracts.validate(String(form), data || {}); }

/** Runs an allow-listed top-level Forms function under an actor identity. */
function efxRunAs(actorJson, fnName, argsJson) {
  var actor = (typeof actorJson === 'string') ? JSON.parse(actorJson) : (actorJson || {});
  var args  = (typeof argsJson === 'string') ? JSON.parse(argsJson) : (argsJson || []);
  if (!FormContracts.isCallable(fnName)) throw new Error('efxRunAs: function not exposed: ' + fnName);
  var fn = globalThis[fnName];
  if (typeof fn !== 'function') throw new Error('efxRunAs: function not found: ' + fnName);
  var out = Actor.run(actor, function () { return fn.apply(null, args); });
  // Allow-listed reads such as getStepResultData(wf, 'id_setup') return credential columns verbatim — redact on the way
  // out (review pass 2 L8). Dates → ISO first, so a Date value is not flattened to {} by the redactor.
  return efxRedact_(efxJsonSafe(out));   // mandatory — fail closed if EfxUtil.js is missing (pass-3 F2)
}

/** One sheet row → { <header>: value } (blank headers skipped; Dates → ISO via efxJsonSafe). Shared by efxReadRecord and efxListWorkflows. */
function efxRowToRecord_(headers, row) {
  var rec = {};
  headers.forEach(function (h, j) { if (h) rec[h] = efxJsonSafe(row[j]); });
  return rec;
}

/** Header-keyed read-back of the row for a workflow in a result/request sheet. */
function efxReadRecord(sheetName, workflowId) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return null;
  var data = sh.getDataRange().getValues();
  var headers = data[0] || [];
  for (var i = data.length - 1; i >= 1; i--) {               // newest first
    if (String(data[i][0]) === String(workflowId)) {
      var rec = efxRowToRecord_(headers, data[i]);
      // Result sheets carry credentials (DSS Password, SiteDocs Password, Email Password, Phone VM Password) — never hand them to n8n (review pass 2 H1)
      return efxRedact_(rec);
    }
  }
  return null;
}

/** task.list — { workflowId?, taskId?, assignedTo?, formType?, status? } */
function efxTaskList(p) {
  p = p || {};
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
  var AI = SCHEMA.ACTION_ITEMS;
  var data = sh ? sh.getDataRange().getValues() : [];
  var out = [];
  for (var i = SCHEMA.ROW.FIRST_DATA; i < data.length; i++) {
    var r = data[i];
    if (p.taskId     && String(r[AI.TASK_ID])     !== String(p.taskId))     continue;
    if (p.workflowId && String(r[AI.WORKFLOW_ID]) !== String(p.workflowId)) continue;
    if (p.formType   && String(r[AI.FORM_TYPE])   !== String(p.formType))   continue;
    if (p.status     && String(r[AI.STATUS])      !== String(p.status))     continue;
    if (p.assignedTo && String(r[AI.ASSIGNED_TO]).toLowerCase() !== String(p.assignedTo).toLowerCase()) continue;
    var desc = []; try { desc = JSON.parse(String(r[AI.DESCRIPTION] || '[]')); } catch (e) { desc = [String(r[AI.DESCRIPTION] || '')]; }
    var draft = null; try { draft = r[AI.DRAFT] ? JSON.parse(String(r[AI.DRAFT])) : null; } catch (e) {}
    out.push({
      taskId: String(r[AI.TASK_ID]), workflowId: String(r[AI.WORKFLOW_ID]), category: r[AI.CATEGORY], name: r[AI.TASK_NAME],
      description: desc, assignedTo: r[AI.ASSIGNED_TO], status: r[AI.STATUS],
      createdDate: r[AI.CREATED_DATE] instanceof Date ? r[AI.CREATED_DATE].toISOString() : r[AI.CREATED_DATE],
      completedDate: r[AI.COMPLETED_DATE] instanceof Date ? r[AI.COMPLETED_DATE].toISOString() : (r[AI.COMPLETED_DATE] || null),
      notes: r[AI.NOTES], closedBy: r[AI.CLOSED_BY], formType: r[AI.FORM_TYPE], draft: draft
    });
  }
  return { tasks: out, count: out.length };
}

/**
 * Draft cell → { items: { <name>: {status, by, at, comments} } } — the ONLY shape ActionItemForm.html (taskDraft.items) and
 * notifyTaskClosure (draft.items) read. Accepts the raw cell (string) or an already-parsed object (efxTaskList.draft) and
 * returns a fresh object. Legacy shapes are lifted: { checkedItems:[…] } → Collected; a flat map (jrCompleteViaSecret —
 * mapping review defect #11) → items. Unparsable → empty. Shared by efxTaskClose and n8n_saveTaskDraft (review pass 2 §5).
 */
function efxParseDraft_(cell) {
  var draft = { items: {} };
  try {
    var prev = (cell && typeof cell === 'object') ? JSON.parse(JSON.stringify(cell)) : JSON.parse(String(cell || '{}'));
    if (prev && typeof prev === 'object') {
      if (prev.items && typeof prev.items === 'object') draft.items = prev.items;
      else if (Array.isArray(prev.checkedItems)) prev.checkedItems.forEach(function (n) { draft.items[n] = { status: 'Collected' }; });
      else draft.items = prev; // legacy flat map
    }
  } catch (e) { draft = { items: {} }; }
  return draft;
}

/** Status column of the Workflows row for a workflowId ('' when sheet/row missing) — same read as StateSync (SCHEMA.WORKFLOWS.STATUS). */
function efxWorkflowStatus_(ss, workflowId) {
  var sh = ss.getSheetByName(CONFIG.SHEETS.WORKFLOWS);
  if (!sh) return '';
  var WF = SCHEMA.WORKFLOWS, data = sh.getDataRange().getValues();
  for (var i = SCHEMA.ROW.FIRST_DATA; i < data.length; i++) {
    if (String(data[i][WF.WORKFLOW_ID]) === String(workflowId)) return String(data[i][WF.STATUS] || '');
  }
  return '';
}

/**
 * task.close — identical effect to a human clicking Complete in ActionItemForm.html.
 * p: { taskId } | { workflowId, formType }  + optional { notes, checklist:{item:{status,comments}}, formData }
 * Returns { taskId, workflowId, success, ... } or { code, message } on error.
 */
function efxTaskClose(actorJson, p, dryRun) {
  var actor = (typeof actorJson === 'string') ? JSON.parse(actorJson) : (actorJson || {});
  p = p || {};
  if (!p.taskId && !(p.workflowId && p.formType)) return { code: 'E_VALIDATION', message: 'taskId, or workflowId + formType, is required' };

  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEETS.ACTION_ITEMS);
  var AI = SCHEMA.ACTION_ITEMS;
  var data = sh ? sh.getDataRange().getValues() : [];
  var row = null, closedRow = null, otherRow = null;
  for (var i = SCHEMA.ROW.FIRST_DATA; i < data.length; i++) {
    var r = data[i];
    if (p.taskId) {
      if (String(r[AI.TASK_ID]) === String(p.taskId)) { row = r; break; }
    } else if (String(r[AI.WORKFLOW_ID]) === String(p.workflowId) && String(r[AI.FORM_TYPE]) === String(p.formType)) {
      var rs = String(r[AI.STATUS]);
      if (rs === 'Open') { row = r; break; }
      // Only a Closed row means "already done". Cancelled (or anything else) is E_TASK_NOT_OPEN, which n8n must NOT treat as success (review pass 2 L3)
      if (rs === 'Closed') closedRow = r; else otherRow = r;
    }
  }
  if (!row && closedRow) return { code: 'E_ALREADY_CLOSED', message: 'Task ' + closedRow[AI.TASK_ID] + ' for ' + p.workflowId + ' (' + p.formType + ') is already closed' };
  if (!row && otherRow) return { code: 'E_TASK_NOT_OPEN', message: 'Task ' + otherRow[AI.TASK_ID] + ' for ' + p.workflowId + ' (' + p.formType + ') is "' + otherRow[AI.STATUS] + '" — only Open tasks can be closed' };
  if (!row) return { code: 'E_NOT_FOUND', message: p.taskId ? ('Task not found: ' + p.taskId) : ('No open ' + p.formType + ' task for ' + p.workflowId) };
  // When both taskId and formType are given, the task must be of that type (jr closer must not close a WIS task — review F7)
  if (p.taskId && p.formType && String(row[AI.FORM_TYPE]) !== String(p.formType)) {
    return { code: 'E_VALIDATION', message: 'Task ' + row[AI.TASK_ID] + ' is formType "' + row[AI.FORM_TYPE] + '", not "' + p.formType + '"' };
  }
  var st = String(row[AI.STATUS]);
  if (st === 'Closed') return { code: 'E_ALREADY_CLOSED', message: 'Task ' + row[AI.TASK_ID] + ' is already closed' };
  if (st !== 'Open') return { code: 'E_TASK_NOT_OPEN', message: 'Task ' + row[AI.TASK_ID] + ' is "' + st + '" — only Open tasks can be closed' };
  // An Open task whose WORKFLOW is Cancelled must not be closable either (cancelRequest flips the tasks it finds, but a task
  // created afterwards, or a row edited by hand, can still read Open) — review pass 2 L3
  if (efxWorkflowStatus_(ss, row[AI.WORKFLOW_ID]) === 'Cancelled') {
    return { code: 'E_TASK_NOT_OPEN', message: 'Task ' + row[AI.TASK_ID] + ' is Open but workflow ' + row[AI.WORKFLOW_ID] + ' is Cancelled — only tasks of active workflows can be closed' };
  }

  var taskId = String(row[AI.TASK_ID]);
  var by = actor.email || actor.display || actor.id || 'automation';
  var items = []; try { items = JSON.parse(String(row[AI.DESCRIPTION] || '[]')); } catch (e) { items = []; }
  var draft = efxParseDraft_(row[AI.DRAFT]);   // { items:{…} } — the shape the UI reads (see efxParseDraft_)
  var now = new Date().toISOString();
  items.forEach(function (it) {
    if (typeof it === 'string' && it.indexOf('__') !== 0) {
      var c = p.checklist && p.checklist[it];
      draft.items[it] = { status: (c && c.status) || 'Complete', by: by, at: now, comments: (c && c.comments) || p.notes || '' };
    }
  });

  if (dryRun) return { dryRun: true, taskId: taskId, workflowId: String(row[AI.WORKFLOW_ID]), wouldClose: true, draft: draft };

  var res = Actor.run(actor, function () {
    return ActionItemService.closeActionItem(taskId, p.notes || '', by, JSON.stringify(draft), p.formData ? JSON.stringify(p.formData) : null);
  });
  if (res && res.success === false && /already/i.test(res.message || '')) return { code: 'E_ALREADY_CLOSED', message: res.message };
  if (!res || res.success === false) return { code: 'E_UPSTREAM', message: (res && res.message) || 'closeActionItem failed' };
  var out = { taskId: taskId, workflowId: String(row[AI.WORKFLOW_ID]) };
  Object.keys(res).forEach(function (k) { out[k] = res[k]; });
  return out;
}

function efxEmployeeIdGet(workflowId) { return EmployeeIdRegistry.info(workflowId); }

/**
 * workflow.list — reads the materialised Dashboard_View (StateSync) header-keyed.
 * filter: { type?: 'Onboarding'|'Equipment'|'Status Change'|'End of Employment' | prefix 'NEW_EMP_'…, status?, step? (substring),
 *           since?: ISO date (Last Updated >=), employeeName? (substring), limit?: 100, offset?: 0 }
 */
function efxListWorkflows(f) {
  f = f || {};
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEETS.DASHBOARD_VIEW);
  if (!sh || sh.getLastRow() < 2) return { workflows: [], count: 0, total: 0, source: CONFIG.SHEETS.DASHBOARD_VIEW };
  var data = sh.getDataRange().getValues(), H = data[0];
  var DV = SCHEMA.DASHBOARD_VIEW;
  var typeOf = function (id) {
    id = String(id || '');
    return id.indexOf('TERM_') === 0 ? 'End of Employment' : id.indexOf('CHANGE_') === 0 ? 'Status Change' : id.indexOf('EQUIP_REQ_') === 0 ? 'Equipment' : 'Onboarding';
  };
  var since = f.since ? new Date(f.since).getTime() : 0;
  var limit = Math.min(Number(f.limit) || 100, 500), offset = Number(f.offset) || 0;
  var out = [], total = 0;
  for (var i = 1; i < data.length; i++) {
    var r = data[i]; var id = String(r[DV.WORKFLOW_ID] || ''); if (!id) continue;
    var t = typeOf(id);
    if (f.type && !(t === f.type || id.indexOf(String(f.type)) === 0)) continue;
    if (f.status && String(r[DV.GLOBAL_STATUS]) !== String(f.status)) continue;
    if (f.step && String(r[DV.GRANULAR_STEP] || '').toLowerCase().indexOf(String(f.step).toLowerCase()) === -1) continue;
    if (f.employeeName && String(r[DV.EMPLOYEE_NAME] || '').toLowerCase().indexOf(String(f.employeeName).toLowerCase()) === -1) continue;
    if (since) { var lu = r[DV.LAST_UPDATED] instanceof Date ? r[DV.LAST_UPDATED].getTime() : new Date(r[DV.LAST_UPDATED]).getTime(); if (!(lu >= since)) continue; }
    total++;
    if (total <= offset || out.length >= limit) continue;
    var rec = { workflowId: id, type: t };
    var byHeader = efxRowToRecord_(H, r);
    Object.keys(byHeader).forEach(function (h) { rec[h] = byHeader[h]; });   // same precedence as before: a header named like a fixed key still wins (review L6, unchanged)
    out.push(rec);
  }
  return { workflows: out, count: out.length, total: total, offset: offset, limit: limit, source: CONFIG.SHEETS.DASHBOARD_VIEW };
}

function efxEmployeeIdAllocate(actorJson, workflowId, employeeName) {
  var actor = (typeof actorJson === 'string') ? JSON.parse(actorJson) : (actorJson || {});
  return Actor.run(actor, function () {
    var id = EmployeeIdRegistry.allocate(workflowId, { employeeName: employeeName || '', source: 'efx.employeeId.allocate' });
    return EmployeeIdRegistry.info(workflowId);
  });
}

/** events.since — { afterEventId?, afterTs?, kinds?[], sources?[], limit? } over the Raw Log (RawLog.v2 columns). */
function efxEventsSince(p) {
  p = p || {};
  var limit = Math.min(Number(p.limit) || 200, 1000);
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(RAW_LOG_SHEET);
  if (!sh || sh.getLastRow() < 2) return { events: [], nextAfterEventId: p.afterEventId || null, pruned: false };
  // Review pass 2 M6: a 1-minute poller must not read the whole Raw Log (thousands of rows incl. payload JSON) every tick.
  // With a cursor we read only the tail (p.tail rows, default 1500) and fall back to a full read if the cursor is not in it.
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  var tail = Math.max(Math.min(Number(p.tail) || 1500, 20000), limit + 1);
  var H = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  function readTail_() {
    if (!(p.afterEventId || p.afterTs) || lastRow - 1 <= tail) return sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
    return sh.getRange(lastRow - tail + 1, 1, tail, lastCol).getValues();
  }
  var body = readTail_();
  if (p.afterEventId && body.length < lastRow - 1) {
    var cE = H.indexOf('Event ID');
    var found = cE >= 0 && body.some(function (r) { return String(r[cE] || '') === String(p.afterEventId); });
    if (!found) body = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();   // cursor older than the tail → full read (then pruned logic decides)
  }
  var data = [H].concat(body);
  var col = function (name) { return H.indexOf(name); };
  var cTs = col('Timestamp'), cSrc = col('Source'), cWf = col('Workflow ID'), cUser = col('User'), cJson = col('Raw JSON'), cEid = col('Event ID'), cKind = col('Kind');
  var events = [];
  var passed = !p.afterEventId;
  var afterTs = p.afterTs ? new Date(p.afterTs).getTime() : 0;
  for (var i = 1; i < data.length && events.length < limit; i++) {
    var r = data[i];
    var eid = cEid >= 0 ? String(r[cEid] || '') : '';
    if (!passed) { if (eid === String(p.afterEventId)) passed = true; continue; }
    var ts = r[cTs] instanceof Date ? r[cTs] : new Date(r[cTs]);
    if (afterTs && ts.getTime() <= afterTs) continue;
    var kind = cKind >= 0 ? String(r[cKind] || 'submit') : 'submit';
    if (Array.isArray(p.kinds) && p.kinds.length) { if (p.kinds.indexOf(kind) === -1) continue; }
    else if (kind === 'alias') continue;   // audit rows (requestId trace) only when explicitly requested
    if (Array.isArray(p.sources) && p.sources.length && p.sources.indexOf(String(r[cSrc])) === -1) continue;
    var payload = null; try { payload = JSON.parse(String(r[cJson] || 'null')); } catch (e) { payload = String(r[cJson]); }
    payload = efxRedact_(payload);   // never leak passwords via the API (review F2)
    events.push({ eventId: eid || null, ts: ts.toISOString(), kind: kind, source: r[cSrc], workflowId: r[cWf], actor: r[cUser], payload: payload });
  }
  var pruned = !!p.afterEventId && !passed;   // cursor not found → rows were pruned; caller should resync by afterTs
  // Cursor: last event that HAS an id (legacy v1 rows have none → never hand back null, review F9); plus a time cursor.
  var lastWithId = null;
  for (var k = events.length - 1; k >= 0; k--) { if (events[k].eventId) { lastWithId = events[k].eventId; break; } }
  return {
    events: events,
    nextAfterEventId: lastWithId || (p.afterEventId || null),
    nextAfterTs: events.length ? events[events.length - 1].ts : (p.afterTs || null),
    pruned: pruned
  };
}
