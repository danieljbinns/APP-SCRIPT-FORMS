'use strict';
/**
 * config-test.js — ConfigurationService resolution order and execution-scoped overrides.
 *
 * WHY THIS EXISTS: getSetting() is the highest blast-radius function in the app — every setting in
 * every handler resolves through it, including SPREADSHEET_ID. Execution-scoped overrides were added
 * so a smoke/SuperDebug run could redirect its own sheet and email without touching global Script
 * Properties (which previously meant a concurrent real submission wrote to the dev sheet and mailed
 * the tester). This suite pins the resolution order so that cannot regress.
 *
 * Order, strongest first:
 *   1. runtime override (this execution only)
 *   2. TEST_SPREADSHEET_ID special case for SPREADSHEET_ID
 *   3. Script Property
 *   4. DEFAULTS
 *
 * Run:  node __tests__/config-test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.resolve(__dirname, '..');
const { makeRuntime } = require('./gas-runtime');
const FX = require('./efx-fixtures');

const rt = makeRuntime();
const ctx = vm.createContext({ ...rt.globals, console, Date, Set, Object, String, Array, JSON, Math, globalThis: undefined });
ctx.globalThis = ctx;
let code = '';
// LOAD_ORDER omits Services/ConfigurationService.js (the harness stubs it) — load the real one last
// so it replaces the stub. That file is what this suite tests.
for (const rel of FX.LOAD_ORDER.concat(['Services/ConfigurationService.js'])) {
  const f = path.join(SRC, rel);
  if (fs.existsSync(f)) code += `\n// == ${rel} ==\n` + fs.readFileSync(f, 'utf8');
}
vm.runInContext(code, ctx);

const ev = expr => vm.runInContext(expr, ctx);
const CS = {
  set:   (k, v) => ev(`ConfigurationService.setRuntimeOverride(${JSON.stringify(k)},${JSON.stringify(v)})`),
  clear: ()     => ev('ConfigurationService.clearRuntimeOverrides()'),
  get:   k      => ev(`ConfigurationService.getSetting(${JSON.stringify(k)})`),
  all:   ()     => ev('ConfigurationService.getAllSettings()'),
  list:  ()     => ev('JSON.stringify(ConfigurationService.getRuntimeOverrides())'),
};
const props = ctx.PropertiesService.getScriptProperties();

let passed = 0, failed = 0;
const failures = [];
function eq(label, got, want) {
  if (String(got) === String(want)) { passed++; console.log('    ✓  ' + label); }
  else { failed++; failures.push(`${label}  got=${got} want=${want}`); console.log('    ✗  ' + label + `   got=${got} want=${want}`); }
}
const section = t => console.log('\n  ▶ ' + t);

const DEV = '1KeWBbh8755mRXFSK2dCeSW75djpaPgtprbmqd7BAsMA';
const PROD_DEFAULT = String(CS.get('SPREADSHEET_ID'));

console.log('\n' + '='.repeat(78));
console.log('  CONFIGURATION SERVICE — resolution order & execution-scoped overrides');
console.log('='.repeat(78));

section('baseline: defaults are returned when nothing is set');
eq('clean start: no runtime overrides', CS.list(), '{}');
eq('SPREADSHEET_ID falls back to DEFAULTS', !!PROD_DEFAULT, true);
eq('unknown key resolves to undefined', CS.get('NO_SUCH_KEY_XYZ'), undefined);

section('script property beats DEFAULTS');
props.setProperty('EFX_EVENT_KID', 'from-property');
eq('property wins over default', CS.get('EFX_EVENT_KID'), 'from-property');

section('runtime override beats script property');
CS.set('EFX_EVENT_KID', 'from-runtime');
eq('runtime wins over property', CS.get('EFX_EVENT_KID'), 'from-runtime');
eq('property itself is untouched', props.getProperty('EFX_EVENT_KID'), 'from-property');
CS.clear();
eq('after clear, property is visible again', CS.get('EFX_EVENT_KID'), 'from-property');
props.deleteProperty('EFX_EVENT_KID');

section('SPREADSHEET_ID special case');
props.setProperty('TEST_SPREADSHEET_ID', 'GLOBAL_TEST_SHEET');
eq('TEST_SPREADSHEET_ID property redirects SPREADSHEET_ID', CS.get('SPREADSHEET_ID'), 'GLOBAL_TEST_SHEET');
CS.set('TEST_SPREADSHEET_ID', DEV);
eq('runtime TEST_SPREADSHEET_ID beats the property', CS.get('SPREADSHEET_ID'), DEV);
CS.clear();
props.deleteProperty('TEST_SPREADSHEET_ID');
eq('cleared on both levels: back to the real sheet', CS.get('SPREADSHEET_ID'), PROD_DEFAULT);

section('overrides write NOTHING global — the whole point');
CS.set('TEST_SPREADSHEET_ID', DEV);
CS.set('EMAIL_REDIRECT_ALL', 'tester@example.com');
CS.set('SUPPRESS_EMAILS_OVERRIDE', 'false');
eq('no global TEST_SPREADSHEET_ID', props.getProperty('TEST_SPREADSHEET_ID') || '(none)', '(none)');
eq('no global EMAIL_REDIRECT_ALL', props.getProperty('EMAIL_REDIRECT_ALL') || '(none)', '(none)');
eq('no global SUPPRESS_EMAILS_OVERRIDE', props.getProperty('SUPPRESS_EMAILS_OVERRIDE') || '(none)', '(none)');

section('CONFIG getters resolve through the overrides');
eq('CONFIG.SPREADSHEET_ID follows the override', ev('CONFIG.SPREADSHEET_ID'), DEV);
eq('CONFIG.SUPPRESS_EMAILS follows the override', ev('CONFIG.SUPPRESS_EMAILS'), false);

section('getAllSettings agrees with getSetting');
const all = CS.all();
eq('bulk read shows the overridden sheet', all['SPREADSHEET_ID'], DEV);
eq('bulk read shows the overridden redirect', all['EMAIL_REDIRECT_ALL'], 'tester@example.com');
eq('bulk and single agree on SPREADSHEET_ID', all['SPREADSHEET_ID'], CS.get('SPREADSHEET_ID'));

section('teardown restores everything');
CS.clear();
eq('overrides emptied', CS.list(), '{}');
eq('sheet restored', CS.get('SPREADSHEET_ID'), PROD_DEFAULT);
eq('redirect gone', CS.get('EMAIL_REDIRECT_ALL') || '(none)', '(none)');
eq('bulk read restored too', CS.all()['SPREADSHEET_ID'], PROD_DEFAULT);

section('override lifecycle edge cases');
CS.set('EFX_EVENT_KID', 'x');
CS.set('EFX_EVENT_KID', null);
eq('setting null removes that one override', CS.list(), '{}');
CS.set('EFX_EVENT_KID', '');
eq('empty string is a real value, not a removal', CS.get('EFX_EVENT_KID'), '');
CS.clear();

console.log('\n' + '─'.repeat(78));
console.log('  TOTAL: ' + passed + ' passed, ' + failed + ' failed');
if (failed) { console.log('\n  Failures:'); failures.forEach(f => console.log('   • ' + f)); }
console.log('─'.repeat(78) + '\n');
process.exit(failed === 0 ? 0 : 1);
