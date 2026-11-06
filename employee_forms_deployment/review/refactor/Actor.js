/**
 * Actor.js — Employee Forms backend addition  (PROTOTYPE / NON-PRODUCTION)
 *
 * Request-scoped identity. When a human uses the web app, Actor.email() === Session.getActiveUser().getEmail().
 * When the EFX Bridge calls a library function, it wraps the call in Actor.run(actor, fn) so every
 * "Submitted By" / closedBy / Raw Log user gets an attributable automation identity instead of ''.
 *
 * Apps Script executions are single-threaded per invocation, so a module-level variable is safe.
 * Migration: replace `Session.getActiveUser().getEmail()` with `Actor.email()` in the submit handlers,
 * RawLog.js and closeActionItemWithNotes first; the rest can follow mechanically.
 */
var Actor = (function () {
  var override_ = null; // { id, email, display } for the current execution only

  function run(actor, fn) {
    var prev = override_;
    override_ = (actor && typeof actor === 'object') ? actor : null;
    try { return fn(); } finally { override_ = prev; }
  }

  function email() {
    if (override_ && override_.email) return String(override_.email);
    try { return Session.getActiveUser().getEmail() || ''; } catch (e) { return ''; }
  }

  /** Human-readable attribution when no email exists (e.g. 'New-hire intake (n8n)'). */
  function label() {
    if (override_) return String(override_.display || override_.email || override_.id || 'automation');
    return email();
  }

  function isAutomation() { return !!override_; }
  function current() { return override_; }

  /**
   * AUTHORIZATION identity — the real Google session (web app visitor, or the impersonated bot under the
   * Execution API). Never the caller-asserted actor, which can be spoofed by any n8n author.
   * Use principal() for role checks (isHR/isIT/isAdmin, canCancel/canBump/canEditDates); email() for attribution.
   */
  function principal() {
    try { return Session.getActiveUser().getEmail() || ''; } catch (e) { return ''; }
  }

  /** Only app admins (by REAL session identity) may override a pre-assigned Internal Employee ID. */
  function canOverrideEmployeeId() {
    var e = principal().toLowerCase();
    if (!e) return false;
    return (CONFIG.ADMIN_EMAILS || []).some(function (a) { return String(a).toLowerCase() === e; });
  }

  return { run: run, email: email, principal: principal, label: label, isAutomation: isAutomation, current: current, canOverrideEmployeeId: canOverrideEmployeeId };
})();
