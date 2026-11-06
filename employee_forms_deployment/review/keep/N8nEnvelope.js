/**
 * N8nEnvelope.js — private helpers behind the n8n_* aliases  (fork: employee_management_v2_efx)
 *
 * Nothing here is called by n8n directly. N8n.js (the public alias file) calls these; they are plain function
 * declarations (hoisted across Apps Script files) plus one `var` rule table read only at call time, so file order is
 * irrelevant. Moved verbatim from N8n.js (review pass 2 §5).
 *
 *   n8nActor_(actor)                       string|object → { id, email, display }
 *   n8nOk_(result, extra) / n8nErr_(code, message, extra)   envelope builders (REQ-XXXXXXXX ids)
 *   n8nGuard_(fn)                          thrown error → E_INTERNAL envelope; one requestId per call; audits mutating calls and
 *                                          every failure to the Raw Log as kind 'alias' (so a REQ-… id can be looked up)
 *   n8nParse_(v, fallback)                 JSON string | object | nothing
 *   n8nBool_(v)                            true | 'true' | 'yes' | '1' → true
 *   n8nOptions_(options)                   ['record'] | { include, allowUnverified }
 *   n8nMapHandlerError_(res, fallbackCode, opts)   handler { success:false, message } → E_FORBIDDEN / E_NOT_FOUND / E_RATE_LIMITED / fallback
 *   n8nSubmit_(actor, form, data, expectCreate, options)   the generic validate → Actor.run(handler) → envelope path
 *   n8nSwitch_() / n8nBlocked_(names) / n8nSwitchList_()   EFX kill switch (EFX_ALIASES_OFF / EFX_ALIASES_ON Script
 *                                          Properties) — refuses disabled aliases and forms with E_DISABLED
 */

function n8nActor_(actor) {
  var a = actor;
  if (typeof a === 'string') { try { a = JSON.parse(a); } catch (e) { a = { id: String(actor) }; } }
  a = (a && typeof a === 'object') ? a : {};
  return { id: String(a.id || 'n8n'), email: String(a.email || '').toLowerCase(), display: String(a.display || a.id || 'n8n automation') };
}
var N8N_REQ_ID_ = null;   // set by n8nGuard_ for the duration of one alias call so ok/err envelopes and the audit row share it
function n8nRequestId_() { return N8N_REQ_ID_ || ('REQ-' + Utilities.getUuid().slice(0, 8).toUpperCase()); }
function n8nOk_(result, extra) {
  var r = { ok: true, apiVersion: N8N_API_VERSION, requestId: n8nRequestId_(), result: result };
  if (extra) Object.keys(extra).forEach(function (k) { r[k] = extra[k]; });
  return r;
}
function n8nErr_(code, message, extra) {
  var e = { code: code, message: message };
  if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
  return { ok: false, apiVersion: N8N_API_VERSION, requestId: n8nRequestId_(), error: e };
}
/** Alias name from the call stack (V8: "at n8n_ping (N8n:..)") — used only for the audit row. */
function n8nCallerName_() {
  // frames may be labelled "at n8n_x", "at Object.n8n_x" or "at globalThis.n8n_x" depending on how the alias was invoked
  try { var m = /at (?:[\w$.<>]+\.)?(n8n_[A-Za-z0-9]+)/.exec(new Error().stack || ''); return m ? m[1] : 'n8n_?'; } catch (e) { return 'n8n_?'; }
}
/**
 * EFX kill switch — which aliases / forms n8n may call.  ADMIN CONTROL, Apps Script side.
 * -------------------------------------------------------------------------------------
 * Two Script Properties, both CSV, both optional. Entries are matched case-insensitively and may
 * name EITHER an alias (`n8n_createTerminationRequest`, or bare `createTerminationRequest`) OR a
 * FormContracts form (`termination_request`). **Naming the form is the safer choice**: it also
 * blocks the generic `n8n_createWorkflow` / `n8n_submitForm` routes into that form, which naming
 * only the convenience alias would not.
 *
 *   EFX_ALIASES_OFF   deny-list. Anything named here is refused with E_DISABLED.
 *   EFX_ALIASES_ON    allow-list. If non-empty it is AUTHORITATIVE: anything NOT named is refused.
 *                     Leave unset for normal operation — clearing it by accident would disable
 *                     every alias at once.
 *
 * Deliberately FAILS OPEN: if the properties cannot be read, calls are allowed. This is an
 * operational gate, not an authentication boundary (role checks against the real session principal
 * are what enforce permission), and breaking all automation on a PropertiesService hiccup would be
 * worse than the switch briefly not applying. `n8n_info().result.killSwitch.readable` reports it.
 */
var N8N_SWITCH_ = null;   // per-execution cache; an admin edit takes effect on the next execution
function n8nSwitchReset_() { N8N_SWITCH_ = null; }
/** Normalise a switch entry, or a name being tested: trimmed, lowercased, `n8n_` prefix stripped. */
function n8nSwitchKey_(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/^n8n_/, ''); }
function n8nSwitch_() {
  if (N8N_SWITCH_) return N8N_SWITCH_;
  var off = {}, on = {}, onCount = 0, readable = true;
  try {
    var p = PropertiesService.getScriptProperties();
    String(p.getProperty('EFX_ALIASES_OFF') || '').split(',').forEach(function (s) { s = n8nSwitchKey_(s); if (s) off[s] = true; });
    String(p.getProperty('EFX_ALIASES_ON')  || '').split(',').forEach(function (s) { s = n8nSwitchKey_(s); if (s && !on[s]) { on[s] = true; onCount++; } });
  } catch (e) { readable = false; }
  N8N_SWITCH_ = { off: off, on: on, onCount: onCount, readable: readable };
  return N8N_SWITCH_;
}
/** Admin visibility — what the switch is currently doing (surfaced by n8n_info). */
function n8nSwitchList_() {
  var sw = n8nSwitch_();
  return { off: Object.keys(sw.off), onlyOn: sw.onCount ? Object.keys(sw.on) : [], readable: sw.readable };
}
/**
 * @param {string[]} names  every candidate key for ONE call (alias frames and/or the form name).
 * @return {string|null}    the entry responsible for blocking, or null if the call may proceed.
 */
function n8nBlocked_(names) {
  var sw = n8nSwitch_();
  if (!sw.readable) return null;                                  // fail open (documented above)
  var keys = [], i, k;
  for (i = 0; i < names.length; i++) { k = n8nSwitchKey_(names[i]); if (k && keys.indexOf(k) < 0) keys.push(k); }
  if (!keys.length) return null;
  for (i = 0; i < keys.length; i++) if (sw.off[keys[i]]) return keys[i];   // deny-list wins
  if (sw.onCount) {                                                        // allow-list is authoritative when set
    for (i = 0; i < keys.length; i++) if (sw.on[keys[i]]) return null;
    return keys[0];
  }
  return null;
}
/** The E_DISABLED envelope, shared by the alias gate and the form gate so the wording stays identical. */
function n8nDisabledErr_(what, entry) {
  return n8nErr_('E_DISABLED', what + ' is disabled for automation by the EFX kill switch (matched "' + entry +
                 '"). An administrator re-enables it in the Apps Script Script Properties (EFX_ALIASES_OFF / EFX_ALIASES_ON).',
                 { disabled: entry });
}
/**
 * Every n8n_* frame on the stack, innermost first. The gate must see the delegating wrappers too
 * (n8n_submitItSetup -> n8n_submitForm), so switching off EITHER name blocks the call.
 */
function n8nCallerNames_() {
  try {
    var out = [], re = /at (?:[\w$.<>]+\.)?(n8n_[A-Za-z0-9_]+)/g, m, st = new Error().stack || '';
    while ((m = re.exec(st))) if (out.indexOf(m[1]) < 0) out.push(m[1]);
    return out;
  } catch (e) { return []; }
}
function n8nGuard_(fn) {
  var t0 = Date.now(), names = n8nCallerNames_(), name = names[0] || 'n8n_?', outer = N8N_REQ_ID_;
  N8N_REQ_ID_ = 'REQ-' + Utilities.getUuid().slice(0, 8).toUpperCase();
  var env, blocked = n8nBlocked_(names);
  try {
    env = blocked ? n8nDisabledErr_('Alias "' + name + '"', blocked) : fn();
  } catch (err) { env = n8nErr_('E_INTERNAL', String((err && err.message) || err)); }
  finally { var rid = N8N_REQ_ID_; N8N_REQ_ID_ = outer; }
  n8nAudit_(name, rid, env, Date.now() - t0);
  return env;
}
/**
 * Persist the requestId so "REQ-… failed" can be traced (pass-3 skill eval found it was never stored).
 * Logged: every failure, and every successful call to a non-read alias. Successful reads (ping, list, events, context)
 * are not logged — the poller would otherwise write a row a minute. Never throws; never blocks the response.
 */
function n8nAudit_(name, rid, env, ms) {
  try {
    var kind = 'read';
    if (typeof N8N_ALIASES !== 'undefined') for (var i = 0; i < N8N_ALIASES.length; i++) if (N8N_ALIASES[i].name === name) { kind = N8N_ALIASES[i].kind || 'read'; break; }
    var ok = !!(env && env.ok);
    if (ok && kind === 'read') return;
    var wf = (env && env.result && env.result.workflowId) || (env && env.error && env.error.upstream && env.error.upstream.workflowId) || '';
    var payload = { requestId: rid, alias: name, kind: kind, ok: ok, ms: ms, principal: (typeof Actor !== 'undefined') ? Actor.principal() : '' };
    if (!ok && env && env.error) { payload.code = env.error.code; payload.message = String(env.error.message || '').slice(0, 300); }
    if (typeof rawLogEvent_ === 'function') rawLogEvent_('alias', name, wf, payload);
  } catch (e) { /* audit must never break the alias response */ }
}
/**
 * JSON string → object, object → itself, nothing/'' → fallback; n8n expressions hand us either form (review pass 2 §5).
 * Malformed JSON still throws (→ E_INTERNAL inside n8nGuard_, a script error outside it) — deliberately unchanged.
 * n8nActor_ keeps its own try/catch (a non-JSON string is a bare actor id).
 */
function n8nParse_(v, fallback) {
  if (typeof v === 'string') return v === '' ? fallback : JSON.parse(v);
  return v || fallback;
}
/** n8n expressions deliver booleans as strings as often as not: true | 'true' | 'yes' | '1' → true; anything else → false (review pass 2 L4). */
function n8nBool_(v) {
  if (v === true) return true;
  if (typeof v !== 'string') return false;
  var s = v.trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === '1';
}
/** options: array → include list (legacy) | object { include:[], allowUnverified:false } */
function n8nOptions_(options) {
  if (Array.isArray(options)) return { include: options, allowUnverified: false };
  if (typeof options === 'string') { try { options = JSON.parse(options); } catch (e) { options = {}; } }
  options = options || {};
  return { include: Array.isArray(options.include) ? options.include : [], allowUnverified: n8nBool_(options.allowUnverified) };
}
/**
 * Maps a handler's { success:false, message } to the envelope error (review pass 2 §5 / M1). Rules, in order:
 *   E_FORBIDDEN    /permission|access denied|not authori[sz]ed|forbidden/i  — every site; adds `principal` (the real session)
 *   E_NOT_FOUND    /not found/i                                            — only when listed in opts.codes
 *   E_RATE_LIMITED /already sent/i                                         — only when listed in opts.codes
 * Anything else → fallbackCode. `upstream` carries the raw handler result. Each alias opts into exactly the codes it
 * produced before this helper existed (cancel: E_NOT_FOUND; bump: E_RATE_LIMITED; updateHireDate and the submits: none —
 * a "not found" from a submit handler stays E_UPSTREAM), so no message changes code.
 */
var N8N_HANDLER_ERROR_RULES = [
  { code: 'E_FORBIDDEN',    re: /permission denied|access denied|not authori[sz]ed|forbidden/i, always: true },   // Forms' own denial phrasing only; Google's "You do not have permission to call …" stays E_UPSTREAM (pass-3 F1)
  { code: 'E_NOT_FOUND',    re: /not found/i },
  { code: 'E_RATE_LIMITED', re: /already sent/i }
];
function n8nMapHandlerError_(res, fallbackCode, opts) {
  opts = opts || {};
  var msg = (res && res.message) || opts.message || 'handler failed';
  var codes = opts.codes || [];
  var code = fallbackCode || 'E_UPSTREAM';
  for (var i = 0; i < N8N_HANDLER_ERROR_RULES.length; i++) {
    var rule = N8N_HANDLER_ERROR_RULES[i];
    if ((rule.always || codes.indexOf(rule.code) >= 0) && rule.re.test(msg)) { code = rule.code; break; }
  }
  var extra = { upstream: res || null };
  if (code === 'E_FORBIDDEN') extra.principal = Actor.principal();
  return n8nErr_(code, msg, extra);
}
/** Validate against a FormContracts form, then run its handler under the actor. */
function n8nSubmit_(actor, form, data, expectCreate, options) {
  return n8nGuard_(function () {
    var a = n8nActor_(actor);
    var opt = n8nOptions_(options), include = opt.include;
    var c = FormContracts.get(form);
    if (!c) return n8nErr_('E_UNKNOWN_FORM', 'Unknown form: ' + form);
    // Form-level gate: also catches the generic routes (n8n_createWorkflow / n8n_submitForm) into a disabled form.
    var formBlock = n8nBlocked_([form]);
    if (formBlock) return n8nDisabledErr_('Form "' + form + '"', formBlock);
    if (expectCreate !== !!c.createsWorkflow) return n8nErr_('E_VALIDATION', 'Wrong alias for form ' + form);
    if (c.verified === false && !opt.allowUnverified) {
      return n8nErr_('E_UNVERIFIED_FORM', 'Form "' + form + '" is not verified for automation (' + (c.notes || 'see FormContracts') + '). Pass options.allowUnverified=true to override.');
    }
    var v = FormContracts.validate(form, data || {});
    if (!v.ok) return n8nErr_('E_VALIDATION', 'Payload failed contract for ' + form, { fields: v.fields });
    var fn = globalThis[c.fn];
    if (typeof fn !== 'function') return n8nErr_('E_INTERNAL', 'Handler missing: ' + c.fn);
    // Handlers mutate the payload they receive (workflowId, formId, timestamp, internalEmployeeId). Hand them a copy
    // so a caller that retries with the same object is not rejected as "unknown field" on the second attempt.
    var payload = JSON.parse(JSON.stringify(data || {}));
    var res = Actor.run(a, function () { return fn(payload); });
    // Role checks run against the real session principal (efx-bot), not actor.email — surface them as E_FORBIDDEN (review pass 2 M1)
    if (!res || res.success === false) return n8nMapHandlerError_(res, 'E_UPSTREAM', { message: c.fn + ' failed' });
    var extra = {};
    var recWf = res.workflowId || (data && data.workflowId);   // step handlers (ID Setup, HR, IT, approvals) return no workflowId
    if (include && include.indexOf('record') >= 0 && recWf && c.targetSheet) {
      try { extra.record = efxReadRecord(c.targetSheet, recWf); } catch (e) { extra.recordWarning = e.message; }
    }
    return n8nOk_(res, extra);
  });
}
