/**
 * EmployeeIdRegistry.js — Employee Forms backend addition  (PROTOTYPE / NON-PRODUCTION)
 *
 * Allocates the Internal Employee ID at initial-request submission (spec/05_EMPLOYEE_ID_TIMING_FIX.md).
 * Sheet 'Employee IDs': Internal Employee ID | Workflow ID | Employee Name | Allocated At | Allocated By | Source | Note
 *
 * Correctness does not depend on LockService (library scoping may give the UI path and the bridge path
 * different locks): allocate() uses append-then-verify — the lowest row holding a given id wins; losers
 * delete their row and retry. Reads max() from BOTH this sheet and 'ID Setup Results' col D for continuity.
 * No timestamp fallback: on failure it throws.
 */
var EmployeeIdRegistry = (function () {
  var SHEET = 'Employee IDs';
  var HEADERS = ['Internal Employee ID', 'Workflow ID', 'Employee Name', 'Allocated At', 'Allocated By', 'Source', 'Note'];
  var FLOOR = 30000;
  var MAX_RETRY = 5;

  function ss_() { return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID); }

  function sheet_() {
    var ss = ss_();
    var sh = ss.getSheetByName(SHEET);
    if (!sh) {
      sh = ss.insertSheet(SHEET);
      sh.appendRow(HEADERS);
      try { sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold'); sh.setFrozenRows(1); } catch (e) {}
    }
    return sh;
  }

  function rows_(sh) {
    var lr = sh.getLastRow();
    if (lr < 2) return [];
    return sh.getRange(2, 1, lr - 1, HEADERS.length).getValues();
  }

  function get(workflowId) {
    if (!workflowId) return null;
    var rows = rows_(sheet_());
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][1]) === String(workflowId) && rows[i][0] !== '') return String(rows[i][0]);
    }
    return null;
  }

  function maxKnown_(sh) {
    var m = FLOOR - 1;
    rows_(sh).forEach(function (r) { var n = parseInt(r[0], 10); if (!isNaN(n) && n > m) m = n; });
    var idsh = ss_().getSheetByName(CONFIG.SHEETS.ID_SETUP_RESULTS);
    if (idsh && idsh.getLastRow() > 1) {
      idsh.getRange(2, SCHEMA.ID_SETUP_RESULTS.INTERNAL_EMP_ID + 1, idsh.getLastRow() - 1, 1).getValues()
        .forEach(function (r) { var n = parseInt(r[0], 10); if (!isNaN(n) && n > m) m = n; });
    }
    return m;
  }

  function record_(sh, id, workflowId, meta, source) {
    sh.appendRow([String(id), String(workflowId), meta.employeeName || '', new Date(), Actor.email() || 'system', source, meta.note || '']);
  }

  /** Deletes the (last) row that matches id+workflowId. */
  function deleteMine_(sh, id, workflowId) {
    var rows = rows_(sh);
    for (var i = rows.length - 1; i >= 0; i--) {
      if (String(rows[i][0]) === String(id) && String(rows[i][1]) === String(workflowId)) { sh.deleteRow(i + 2); return; }
    }
  }

  /**
   * @param {string} workflowId
   * @param {{employeeName?:string, source?:string, existingEmployeeId?:string, note?:string}} meta
   * @returns {string} the allocated (or pre-existing) id
   */
  function allocate(workflowId, meta) {
    if (!workflowId) throw new Error('EmployeeIdRegistry.allocate: workflowId required');
    meta = meta || {};
    var existing = get(workflowId);
    if (existing) return existing;

    var sh = sheet_();
    if (meta.existingEmployeeId) {                 // rehire carrying a prior id (policy: Q1)
      record_(sh, meta.existingEmployeeId, workflowId, meta, 'rehire-carry');
      return String(meta.existingEmployeeId);
    }

    var lock = LockService.getScriptLock();
    try { lock.waitLock(10000); } catch (e) { throw new Error('EmployeeIdRegistry: could not obtain the allocation lock (busy) - retry: ' + e.message); }   // review pass 2 M5: never allocate unlocked
    try {
      // Re-check inside the lock: a concurrent double-submit for the same workflow may have allocated meanwhile (review F5)
      var again = get(workflowId);
      if (again) return again;
      for (var attempt = 0; attempt < MAX_RETRY; attempt++) {
        var candidate = String(maxKnown_(sh) + 1);
        record_(sh, candidate, workflowId, meta, meta.source || 'allocate');
        // verify: lowest row with this id wins
        var rows = rows_(sh);
        for (var i = 0; i < rows.length; i++) {
          if (String(rows[i][0]) === candidate) {
            if (String(rows[i][1]) === String(workflowId)) return candidate;   // we won (or a duplicate of ours)
            break;                                                             // someone else won → lose
          }
        }
        deleteMine_(sh, candidate, workflowId);
      }
      throw new Error('EmployeeIdRegistry: could not allocate a unique id after ' + MAX_RETRY + ' attempts');
    } finally {
      if (lock) { try { lock.releaseLock(); } catch (e) {} }
    }
  }

  /** Read-only preview of what the next id would be (display only — never persist this). */
  function peek() { return String(maxKnown_(sheet_()) + 1); }

  /** Admin override: rewrite the registry id for a workflow so registry == ID Setup Results (audited in Note). */
  function setOverride(workflowId, newId, note) {
    var sh = sheet_(); var rows = rows_(sh);
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][1]) === String(workflowId)) {
        sh.getRange(i + 2, 1).setValue(String(newId));
        sh.getRange(i + 2, 7).setValue(((rows[i][6] ? rows[i][6] + ' | ' : '') + 'was ' + rows[i][0] + '; ' + (note || 'override')).slice(0, 500));
        return true;
      }
    }
    record_(sh, String(newId), workflowId, { note: note || 'override' }, 'admin-override');
    return true;
  }

  function info(workflowId) {
    var rows = rows_(sheet_());
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][1]) === String(workflowId)) {
        return { internalEmployeeId: String(rows[i][0]), workflowId: String(rows[i][1]), employeeName: rows[i][2],
                 allocatedAt: rows[i][3] instanceof Date ? rows[i][3].toISOString() : String(rows[i][3]),
                 allocatedBy: rows[i][4], source: rows[i][5] };
      }
    }
    return { internalEmployeeId: null, workflowId: String(workflowId) };
  }

  return { allocate: allocate, get: get, peek: peek, info: info, setOverride: setOverride, SHEET: SHEET, FLOOR: FLOOR };
})();
