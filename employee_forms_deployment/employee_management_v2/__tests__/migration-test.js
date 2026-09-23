// migration-test.js — proves MigrationTools.migrateEfx* against the Node GAS mock.
// Run: node migration-test.js    (no Apps Script, sheet or n8n is touched; nothing is emailed)
//
// What it proves for tomorrow's §6 "Sheet migration on TEST":
//   dry run changes nothing and reports the three planned changes
//   apply adds 'Internal Employee ID' at Initial Requests col 56, creates 'Employee IDs', adds Raw Log 'Event ID','Kind'
//   a second apply is a pure no-op (idempotent)
//   the WARNING fires when Initial Requests has the wrong width (BC1 missing) and nothing is written blindly
//   backfill copies ID Setup Results → Employee IDs once, skipping blanks / non-numeric ids / already-registered workflows
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { makeRuntime } = require('./gas-runtime');

const SRC = path.resolve(__dirname, '..');
const LOAD_ORDER = ['SchemaConstants.js', 'Config.js', 'EfxUtil.js', 'Actor.js', 'EmployeeIdRegistry.js', 'RawLog.js', 'SheetUtils.js', 'MigrationTools.js'];

let P = 0, F = [];
const pass = l => { P++; console.log('    ✓  ' + l); };
const fail = (l, got, exp) => { F.push(l); console.log('    ✗  ' + l + '\n         got:      ' + JSON.stringify(got) + '\n         expected: ' + JSON.stringify(exp)); };
const eq = (l, got, exp) => (String(got ?? '') === String(exp ?? '') ? pass(l) : fail(l, got, exp));
const truthy = (l, got) => (got ? pass(l) : fail(l, got, 'truthy'));
const includes = (l, arr, s) => ((arr || []).some(x => String(x).includes(s)) ? pass(l) : fail(l, arr, '(one entry contains) ' + s));

function boot() {
  const rt = makeRuntime();
  const ctx = vm.createContext({ ...rt.globals, console, Date, globalThis: undefined });
  ctx.globalThis = ctx;
  let code = '';
  for (const rel of LOAD_ORDER) code += `\n// == ${rel} ==\n` + fs.readFileSync(path.join(SRC, rel), 'utf8');
  vm.runInContext(code, ctx);
  return { rt, ctx };
}
const rows = (rt, name) => { const sh = rt.captures.getSheet(name); return sh ? sh.getDataRange().getValues() : null; };
const IR55 = Array.from({ length: 55 }, (_, i) => i === 54 ? 'BOSS Training User Only' : 'H' + (i + 1));

function scenario(title, fn) { console.log('\n▶ ' + title); try { fn(); } catch (e) { fail('scenario threw: ' + e.message, e.stack && e.stack.split('\n')[1], 'no throw'); } }

scenario('1. dry run on a prod-shaped copy reports three changes and writes nothing', () => {
  const { rt, ctx } = boot();
  rt.captures.seedSheet('Initial Requests', [IR55]);
  rt.captures.seedSheet('Raw Log', [['Timestamp', 'User', 'Function', 'Workflow ID', 'JSON']]);
  const before = rt.captures.getAllWrites().length;
  const r = ctx.migrateEfxDryRun();
  eq('mode dry_run', r.mode, 'dry_run');
  eq('three changes planned', r.changes.length, 3);
  includes('plans the IR header at col 56', r.changes, "add header 'Internal Employee ID' at Initial Requests col 56");
  includes('plans the Employee IDs sheet', r.changes, "create sheet 'Employee IDs'");
  includes('plans Raw Log cols 6-7', r.changes, "add headers 'Event ID','Kind' at Raw Log cols 6-7");
  truthy('no WARNING when BC1 is present', !r.changes.some(c => c.startsWith('WARNING')));
  eq('no sheet writes happened', rt.captures.getAllWrites().length, before);
  eq('Employee IDs still absent', rt.captures.getSheet('Employee IDs'), null);
  eq('Initial Requests still 55 wide', rows(rt, 'Initial Requests')[0].length, 55);
});

scenario('2. apply performs exactly the planned changes; second apply is a no-op', () => {
  const { rt, ctx } = boot();
  rt.captures.seedSheet('Initial Requests', [IR55]);
  rt.captures.seedSheet('Raw Log', [['Timestamp', 'User', 'Function', 'Workflow ID', 'JSON']]);
  const r = ctx.migrateEfxApply();
  eq('mode applied', r.mode, 'applied');
  eq('IR header 56 = Internal Employee ID', rows(rt, 'Initial Requests')[0][55], 'Internal Employee ID');
  eq('IR header 55 untouched', rows(rt, 'Initial Requests')[0][54], 'BOSS Training User Only');
  const reg = rows(rt, 'Employee IDs');
  truthy('Employee IDs sheet created', !!reg);
  eq('registry headers', JSON.stringify(reg[0]), JSON.stringify(['Internal Employee ID', 'Workflow ID', 'Employee Name', 'Allocated At', 'Allocated By', 'Source', 'Note']));
  eq('registry has header only', reg.length, 1);
  const rl = rows(rt, 'Raw Log')[0];
  eq('Raw Log col 6 = Event ID', rl[5], 'Event ID');
  eq('Raw Log col 7 = Kind', rl[6], 'Kind');
  eq('Raw Log cols 1-5 untouched', rl.slice(0, 5).join('|'), 'Timestamp|User|Function|Workflow ID|JSON');
  const w0 = rt.captures.getAllWrites().length;
  const r2 = ctx.migrateEfxApply();
  truthy('second apply reports only no-ops', r2.changes.every(c => /no-op/.test(c)));
  eq('second apply wrote nothing', rt.captures.getAllWrites().length, w0);
  eq('registry still header only', rows(rt, 'Employee IDs').length, 1);
});

scenario('3. wrong Initial Requests width → WARNING, header still only planned at col 56', () => {
  const { rt, ctx } = boot();
  rt.captures.seedSheet('Initial Requests', [IR55.slice(0, 54)]);            // BC1 missing (54 cols)
  const r = ctx.migrateEfxDryRun();
  includes('WARNING about column count', r.changes, 'WARNING: Initial Requests has 54 columns; schema expects header at col 56');
  includes('still plans col 56 (never a different column)', r.changes, 'at Initial Requests col 56');
  includes('Raw Log absent → no-op note', r.changes, 'Raw Log sheet absent');
  eq('no writes', rt.captures.getAllWrites().length, 0);
});

scenario('4. already-migrated sheet → all no-ops; header in the wrong place → WARNING and no data move', () => {
  const { rt, ctx } = boot();
  rt.captures.seedSheet('Initial Requests', [IR55.concat(['Internal Employee ID'])]);
  rt.captures.seedSheet('Employee IDs', [['Internal Employee ID', 'Workflow ID', 'Employee Name', 'Allocated At', 'Allocated By', 'Source', 'Note']]);
  rt.captures.seedSheet('Raw Log', [['Timestamp', 'User', 'Function', 'Workflow ID', 'JSON', 'Event ID', 'Kind']]);
  const r = ctx.migrateEfxApply();
  truthy('everything reported as no-op', r.changes.length === 3 && r.changes.every(c => /no-op/.test(c)));
  eq('no writes', rt.captures.getAllWrites().length, 0);

  const b = boot();
  b.rt.captures.seedSheet('Initial Requests', [IR55.slice(0, 50).concat(['Internal Employee ID']).concat(IR55.slice(50))]); // at index 50
  const r2 = b.ctx.migrateEfxApply();
  includes('WARNING when header exists at another index', r2.changes, "'Internal Employee ID' exists at index 50 but SCHEMA says 55");
  eq('no writes to Initial Requests', b.rt.captures.getWritesFor('Initial Requests').length, 0);
});

scenario('5. backfill from ID Setup Results is idempotent and skips junk', () => {
  const { rt, ctx } = boot();
  rt.captures.seedSheet('Initial Requests', [IR55]);
  const ID_HEADERS = ['Workflow ID', 'Form ID', 'Submission Timestamp', 'Internal Employee ID', 'SiteDocs Worker ID', 'SiteDocs Job Code', 'SiteDocs Username', 'SiteDocs Password', 'DSS Username', 'DSS Password', 'Setup Notes', 'Submitted By', 'BOSS WIS Created', 'SiteDocs Badge Created'];
  const ts = new Date('2026-09-01T12:00:00Z');
  rt.captures.seedSheet('ID Setup Results', [ID_HEADERS,
    ['NEW_EMP_A', 'F', ts, '30401', 'W', 'H', 'u', 'p', 'd', 'p', '', 'hr@team-group.com', 'No', 'No'],
    ['NEW_EMP_B', 'F', ts, 30402, 'W', 'H', 'u', 'p', 'd', 'p', '', '', 'No', 'No'],               // numeric id, blank submitter
    ['NEW_EMP_C', 'F', ts, '', 'W', 'H', 'u', 'p', 'd', 'p', '', 'x', 'No', 'No'],                  // blank id → skip
    ['', 'F', ts, '30404', 'W', 'H', 'u', 'p', 'd', 'p', '', 'x', 'No', 'No'],                      // blank workflow → skip
    ['NEW_EMP_E', 'F', ts, 'EMP-1234567890', 'W', 'H', 'u', 'p', 'd', 'p', '', 'x', 'No', 'No'],    // legacy timestamp id → skip
    ['NEW_EMP_A', 'F', ts, '30401', 'W', 'H', 'u', 'p', 'd', 'p', '', 'x', 'No', 'No']]);           // duplicate resubmit → skip
  let threw = null; try { ctx.migrateEfxBackfillDryRun(); } catch (e) { threw = e.message; }
  includes('backfill refuses before migrateEfxApply', [threw], "Run migrateEfxApply() first");
  ctx.migrateEfxApply();
  const dry = ctx.migrateEfxBackfillDryRun();
  eq('dry run would add 2', dry.added, 2);
  eq('dry run skips 4', dry.skipped, 4);
  eq('dry run wrote no registry rows', rows(rt, 'Employee IDs').length, 1);
  const ap = ctx.migrateEfxBackfillApply();
  eq('apply added 2', ap.added, 2);
  const reg = rows(rt, 'Employee IDs');
  eq('registry now 3 rows (header + 2)', reg.length, 3);
  eq('row A id/workflow/source', [reg[1][0], reg[1][1], reg[1][5]].join('|'), '30401|NEW_EMP_A|backfill:ID Setup Results');
  eq('row A allocatedBy = submitter', reg[1][4], 'hr@team-group.com');
  eq('row B numeric id stored as string', typeof reg[2][0] === 'string' ? reg[2][0] : 'not-a-string', '30402');
  eq('row B blank submitter → backfill', reg[2][4], 'backfill');
  const again = ctx.migrateEfxBackfillApply();
  eq('re-run adds 0', again.added, 0);
  eq('registry unchanged', rows(rt, 'Employee IDs').length, 3);
  // allocation reads max(registry, ID Setup Results): the orphan 30404 row (blank workflow) still counts, so next = 30405
  eq('EmployeeIdRegistry.peek = max(registry 30402, ID Setup Results 30404) + 1', ctx.EmployeeIdRegistry.peek(), '30405');
});

console.log(`\n  TOTAL: ${P} passed, ${F.length} failed`);
if (F.length) { console.log('  ❌ ' + F.join('\n  ❌ ')); process.exit(1); }
console.log('  ✅ migration suite green');
