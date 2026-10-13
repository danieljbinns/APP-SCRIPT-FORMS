'use strict';
/**
 * test-guard-test.js — _assertTestAdmin_ gates the destructive test entry points.
 *
 * WHY THIS EXISTS: Apps Script exposes every global function to the client, and the web app shell
 * ships their names to the browser. Before this guard, any signed-in user on an allowed domain could
 * open the portal's console and run google.script.run.cleanupSuperDebugWorkflow('NEW_EMP_…') to
 * delete a workflow's rows from every sheet, or _smokeSetup() to globally redirect prod writes to
 * the dev sheet and suppress all email — executing with the DEPLOYING user's rights, because the
 * web app runs as USER_DEPLOYING.
 *
 * The subtle part this pins: the guard must read getActiveUser() and NEVER getEffectiveUser().
 * Under USER_DEPLOYING the effective user is no-reply@team-group.com, which IS in ADMIN_EMAILS — an
 * effective-user check would pass for every caller and silently defeat the guard.
 *
 * Run:  node __tests__/test-guard-test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = path.resolve(__dirname, '..');

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name); } };

const ADMINS = ['dbinns@team-group.com', 'no-reply@team-group.com'];
function ctxFor(activeEmail, effectiveEmail) {
  const logs = [];
  const ctx = vm.createContext({
    console, String, Object, Error, JSON,
    CONFIG: { ADMIN_EMAILS: ADMINS },
    Logger: { log: m => logs.push(String(m)) },
    Session: {
      getActiveUser:    () => ({ getEmail: () => activeEmail }),
      getEffectiveUser: () => ({ getEmail: () => effectiveEmail })
    }
  });
  const src = fs.readFileSync(path.join(SRC, 'TestRunner.js'), 'utf8');
  const m = src.match(/function _assertTestAdmin_[\s\S]*?\n}\n/);
  if (!m) throw new Error('could not extract _assertTestAdmin_ from TestRunner.js');
  vm.runInContext(m[0], ctx);
  ctx.__logs = logs;
  return ctx;
}
const throws = (active, effective) => {
  try { vm.runInContext("_assertTestAdmin_('fn')", ctxFor(active, effective)); return false; }
  catch (e) { return /Access denied/.test(e.message); }
};

console.log('\n_assertTestAdmin_ — admin gate on destructive test entry points\n');

ok('admin caller is allowed',                     !throws('dbinns@team-group.com', 'no-reply@team-group.com'));
ok('admin match is case-insensitive',             !throws('DBinns@Team-Group.com', 'no-reply@team-group.com'));
ok('ordinary domain user is blocked',              throws('someone@team-group.com', 'no-reply@team-group.com'));
ok('other allowed-domain user is blocked',         throws('tech@ajvac.ca', 'no-reply@team-group.com'));
ok('empty active user fails CLOSED',               throws('', 'no-reply@team-group.com'));
ok('null active user fails CLOSED',                throws(null, 'no-reply@team-group.com'));
// The one that matters: effective user is an admin (no-reply) but the ACTIVE user is not.
ok('admin EFFECTIVE user does not grant access',   throws('someone@team-group.com', 'dbinns@team-group.com'));
ok('blocked call is logged',                       (() => {
  const c = ctxFor('someone@team-group.com', 'no-reply@team-group.com');
  try { vm.runInContext("_assertTestAdmin_('cleanupSuperDebugAll')", c); } catch (e) {}
  return c.__logs.some(l => /\[GUARD\] Blocked cleanupSuperDebugAll/.test(l));
})());
ok('error names the function and the caller',      (() => {
  try { vm.runInContext("_assertTestAdmin_('cleanupSuperDebugAll')", ctxFor('mallory@team-group.com', 'x')); return false; }
  catch (e) { return /cleanupSuperDebugAll/.test(e.message) && /mallory@team-group\.com/.test(e.message); }
})());

// Every destructive / prod-writing global must actually carry the guard.
const MUST_GUARD = {
  'SuperDebug.js': ['_purgeWorkflowRows', 'cleanupSuperDebugAll', 'cleanupSuperDebugWorkflow',
                    'runSuperDebugAll', 'runSuperDebugNewHire', 'runSuperDebugUnionOpenableForRunner'],
  'TestRunner.js': ['_trPurgeWorkflowRows'],
  'ProdSmokeTest.js': ['_smokeSetup', '_smokePurgeByNames', 'cleanupProdSmokeTest',
                       'runProdSmokeTest', 'runProdSmokeNewHire', 'clearSmokeEmailRedirect']
};
console.log('');
for (const [file, fns] of Object.entries(MUST_GUARD)) {
  const src = fs.readFileSync(path.join(SRC, file), 'utf8');
  for (const fn of fns) {
    // Plain string scan, not a regex — the declaration is always "function <name>(" and the guard
    // must be the first statement, so look at the 200 chars that follow the declaration.
    const i = src.indexOf('function ' + fn + '(');
    const win = i < 0 ? '' : src.slice(i, i + 200);
    ok(file + ' :: ' + fn + ' is guarded',
       i >= 0 && win.includes("_assertTestAdmin_('" + fn + "')"));
  }
}

console.log('\n  TOTAL: ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
