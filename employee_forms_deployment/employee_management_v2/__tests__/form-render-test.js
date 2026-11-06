'use strict';
/**
 * form-render-test.js — "does this form show what the request actually asked for?"
 *
 * WHY THIS EXISTS
 * The 2026-10-14 static audit read every form line by line and still missed the equipment IT Setup
 * defect. It recorded that ITSetup.html's Google section had no conditional and that Email_Created
 * was `required` — both true — but never asked whether that was *correct for a given request*.
 * It described the code; it had no oracle.
 *
 * An ORACLE is the thing that states the right answer independently of the code under test. Here
 * that is `expect()` on each FORM below: it derives the expected sections from the REQUEST DATA
 * ALONE and never reads the template. So a template cannot rubber-stamp its own behaviour — if the
 * expectation were written by looking at current output, it would pass on the buggy version too.
 *
 * Proof it works: `FORM_SRC=<pre-fix source> node __tests__/form-render-test.js` fails on the
 * 2026-10-16 defect; against current source it passes.
 *
 * Run: node __tests__/form-render-test.js
 */

const fs   = require('fs');
const path = require('path');
// FORM_SRC lets the suite run against a different copy of the templates — used to prove this
// test actually catches the 2026-10-16 defect by pointing it at the pre-fix @80 source.
const SRC  = process.env.FORM_SRC || path.join(__dirname, '..');

// ─── Minimal Apps Script HtmlService template compiler ────────────────────────
//   <? code ?>  runs    <?= v ?>  appends HTML-escaped    <?!= v ?>  appends raw
function renderTemplate(file, scope) {
  const src = fs.readFileSync(path.join(SRC, file), 'utf8');
  let body = 'var __o = "";\n';
  let i = 0;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  while (i < src.length) {
    const open = src.indexOf('<?', i);
    if (open === -1) { body += '__o += ' + JSON.stringify(src.slice(i)) + ';\n'; break; }
    body += '__o += ' + JSON.stringify(src.slice(i, open)) + ';\n';
    const close = src.indexOf('?>', open);
    if (close === -1) throw new Error(file + ': unclosed scriptlet at ' + open);
    const code = src.slice(open + 2, close);
    if (code[0] === '=')                body += '__o += __esc(' + code.slice(1) + ');\n';
    else if (code.slice(0, 2) === '!=') body += '__o += (' + code.slice(2) + ');\n';
    else                                body += code + '\n';
    i = close + 2;
  }
  body += 'return __o;';
  const names = Object.keys(scope);
  return new Function(...names, '__esc', body)(...names.map(n => scope[n]), esc);
}

// Partials are rendered by the real app but are irrelevant to section gating.
const STUBS = {
  include: () => '', safeInclude: () => '', includeWithData: () => '',
  getBaseUrl: () => 'https://example.test/exec',
  Utilities: { formatDate: d => String(d) },
};

const sectionsIn = html => (html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/g) || [])
  .map(h => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim());
const requiredIn = html => (html.match(/<(?:input|select|textarea)\b[^>]*\brequired\b[^>]*>/g) || [])
  .map(t => (t.match(/name="([^"]+)"/) || [, '(unnamed)'])[1]);
const namesIn = html => (html.match(/\bname="([^"]+)"/g) || []).map(s => s.slice(6, -1));

// ─── FORMS ────────────────────────────────────────────────────────────────────
// `expect(d)` is the oracle: sections that MUST render, derived from request data only.
// `gated`    maps a required field -> the section that justifies it. A required field whose
//            section was not requested makes the form unsubmittable; that is the defect class.
// `always`   fields that are required on every render by design — asserted so that intent is
//            recorded and an accidental gating change fails loudly.
const FORMS = [
  {
    file: 'ITSetup.html',
    scope: d => ({ requestData: d, workflowId: 'TEST_WF', formId: '', employeeName: 'Test Employee' }),
    expect(d) {
      const has = n => (d.systems || []).indexOf(n) !== -1;
      const out = [];
      if (has('Google Account') || d.googleEmail)      out.push('Google Account Setup');
      if (d.computerReq && d.computerReq !== 'None')   out.push('Computer Assignment');
      if (d.phoneReq    && d.phoneReq    !== 'No')     out.push('Phone Assignment');
      if (has('BOSS'))                                 out.push('BOSS Access');
      if (has('Incidents') || has('CAA') || has('Delivery') || has('Net Promoter Score'))
                                                       out.push('Additional System Access');
      out.push('IT Setup Notes');
      return out;
    },
    gated: {
      Email_Created: 'Google Account Setup', Email_Username: 'Google Account Setup',
      Email_Domain: 'Google Account Setup',  Email_Temp_Password: 'Google Account Setup',
      Computer_Assigned: 'Computer Assignment', Phone_Assigned: 'Phone Assignment',
      BOSS_Access: 'BOSS Access',
    },
    cases: [
      ['equipment: computer + phone, no systems  [EQUIP_REQ_20260831-144331_389]',
        { systems: [], googleEmail: '', computerReq: 'Reassignment', phoneReq: 'Reassignment',
          bossJobSites: '', bossCostSheetJobs: '', bossTripReports: '', bossGrievances: '', bossTrainingOnly: 'No' }],
      ['equipment: phone only                     [EQUIP_REQ_20261001-072619_778]',
        { systems: [], googleEmail: '', computerReq: '', phoneReq: 'New',
          bossJobSites: '', bossCostSheetJobs: '', bossTripReports: '', bossGrievances: '', bossTrainingOnly: 'No' }],
      ['equipment: full systems set               [EQUIP_REQ_20260824-145859_930]',
        { systems: ['BOSS','CAA','Delivery','Fleetio','Google Account','Incidents','Central Purchasing/Jonas','SiteDocs Supervisor'],
          googleEmail: '', computerReq: '', phoneReq: '', bossJobSites: 'Site A, Site B',
          bossCostSheetJobs: '', bossTripReports: 'Yes', bossGrievances: '', bossTrainingOnly: 'No' }],
      ['new hire: google only                     (typical NEW_EMP_)',
        { systems: ['Google Account'], googleEmail: 'first.last', computerReq: '', phoneReq: '',
          bossJobSites: '', bossCostSheetJobs: '', bossTripReports: '', bossGrievances: '', bossTrainingOnly: 'No' }],
      ['nothing requested at all                  (degenerate)',
        { systems: [], googleEmail: '', computerReq: 'None', phoneReq: 'No',
          bossJobSites: '', bossCostSheetJobs: '', bossTripReports: '', bossGrievances: '', bossTrainingOnly: 'No' }],
    ],
  },
  {
    // ID Setup is a universal new-hire step. Verified against prod 2026-10-16: all 603 ID Setup
    // Results rows have SiteDocs Worker ID, Job Code, DSS Username and DSS Password filled — 100%.
    // So those four being unconditionally `required` is CORRECT, not the ITSetup defect repeating.
    // Only "SiteDocs Admin / Login Access" is gated, on systems containing SiteDocs.
    file: 'EmployeeIDSetup.html',
    scope: d => ({ requestData: d, workflowId: 'TEST_WF', formId: '',
                   generatedEmployeeId: 'EMP123', generatedSiteDocsDefault: 'first.last',
                   generatedDssUsername: 'first.last' }),
    expect(d) {
      const out = ['Internal Employee ID', 'SiteDocs Setup'];
      if (d.siteDocsAccess) out.push('SiteDocs Admin / Login Access');
      out.push('DSS Training Access', 'BOSS WIS Account', 'SiteDocs Badge Link', 'Setup Notes');
      return out;
    },
    gated:  { siteDocsUsername: 'SiteDocs Admin / Login Access', siteDocsPassword: 'SiteDocs Admin / Login Access' },
    always: ['internalEmployeeId', 'siteDocsWorkerId', 'siteDocsJobCode', 'dssUsername', 'dssPassword'],
    cases: [
      ['SiteDocs requested',     { siteDocsAccess: true  }],
      ['SiteDocs not requested', { siteDocsAccess: false }],
    ],
  },
  {
    file: 'HRVerification.html',
    scope: d => ({ requestData: d, workflowId: 'TEST_WF', formId: '' }),
    expect() {
      // Actual h2 headings, verified against the template: :52, :73, :112.
      return ['Request Context', 'Verified Information', 'ADP Assignment'];
    },
    gated: { jrTitle: '__jrRequired' },   // special-cased below
    cases: [
      ['JR required',     { jrRequired: 'Yes', isEdit: false, previousData: null }],
      ['JR not required', { jrRequired: 'No',  isEdit: false, previousData: null }],
    ],
    extra(d, html, fail) {
      // jrTitle is ALWAYS submitted — as a <select> when a JR is required (:101), otherwise as a
      // hidden input with value="" (:106). The empty hidden field is deliberate: it means "clear
      // the JR assignment", which is why submitHRVerification must NOT guard jrTitle on truthiness.
      const want   = d.jrRequired === 'Yes';
      const hasSel = /<select[^>]*name="jrTitle"/.test(html);
      const hasHid = /<input[^>]*type="hidden"[^>]*name="jrTitle"/.test(html);
      if (hasSel !== want)  fail(`jrTitle <select> present=${hasSel} but jrRequired=${d.jrRequired}`);
      if (hasHid === want)  fail(`jrTitle hidden present=${hasHid} but jrRequired=${d.jrRequired} (expected the opposite)`);
      if (!hasSel && !hasHid) fail('jrTitle not submitted at all — submitHRVerification reads this.jrTitle.value');
    },
  },
  {
    file: 'Fleetio.html',
    scope: d => ({ requestData: d, workflowId: 'TEST_WF', formId: '' }),
    expect: () => [],                      // specialist forms use h1, not h2
    gated: {},
    cases: [
      ['vehicle requested',     { vehicleRequested: 'Yes' }],
      ['vehicle not requested', { vehicleRequested: 'No'  }],
    ],
    extra(d, html, fail) {
      const hasVeh = namesIn(html).indexOf('vehicleAssigned') !== -1;
      const want   = d.vehicleRequested === 'Yes';
      if (hasVeh !== want) fail(`vehicleAssigned present=${hasVeh} but vehicleRequested=${d.vehicleRequested}`);
      // fleetioCreated is unconditional and required — the whole point of the Fleetio task
      if (namesIn(html).indexOf('fleetioCreated') === -1) fail('fleetioCreated missing');
    },
  },
];

// ─── Run ──────────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const failures = [];

for (const F of FORMS) {
  console.log(`\n=== ${F.file} ===\n`);
  for (const [label, data] of F.cases) {
    const bad = msg => { fail++; failures.push(`${F.file} — ${label}\n      ${msg}`); console.log(`      ✗ ${msg}`); };
    let html;
    try {
      html = renderTemplate(F.file, Object.assign({}, STUBS, F.scope(data)));
    } catch (e) {
      console.log(`  ✗ ${label}`); bad(`template threw: ${e.message}`); continue;
    }

    let ok = true;
    const want = F.expect(data), got = sectionsIn(html);
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      ok = false;
      console.log(`  ✗ ${label}`);
      console.log(`      want: ${want.join(' | ') || '(none)'}`);
      console.log(`      got : ${got.join(' | ')  || '(none)'}`);
      bad(`sections mismatch`);
    } else { pass++; }

    const req = requiredIn(html);
    for (const [field, section] of Object.entries(F.gated || {})) {
      if (section === '__jrRequired') continue;
      if (req.indexOf(field) !== -1 && want.indexOf(section) === -1) {
        ok = false; bad(`"${field}" is required but "${section}" was not requested — form cannot be submitted`);
      } else pass++;
    }
    for (const field of (F.always || [])) {
      if (req.indexOf(field) === -1) { ok = false; bad(`"${field}" should always be required but is not rendered/required`); }
      else pass++;
    }
    if (F.extra) { const before = fail; F.extra(data, html, bad); if (fail === before) pass++; else ok = false; }

    if (ok) console.log(`  ✓ ${label}`);
  }
}

console.log(`\nTOTAL: ${pass} passed, ${fail} failed`);
if (failures.length) {
  console.log('\nFAILURES:');
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
console.log('🎉 Every form renders exactly what its request asked for.\n');
