/**
 * E2E browser harness — drives the REAL deployed web app via Playwright connected
 * to the user's already-authenticated Chrome over CDP.
 *
 * WHY CDP: the GAS web app renders inside a cross-origin googleusercontent iframe.
 * The Claude-in-Chrome extension cannot inject JS into that frame (cross-origin) and
 * its a11y tree can't see it, so the prompt's interceptor + name-based fill scripts
 * are unrunnable there. Playwright's frame.evaluate() runs JS *inside* the frame
 * regardless of origin, so the prompt's exact methodology works unchanged.
 *
 * PREREQUISITES (one-time, ~1 min):
 *   1. Fully quit Chrome (every window).
 *   2. Relaunch with the remote-debugging port, e.g. (PowerShell):
 *        & "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
 *      (Use your normal profile so the Google session is present.)
 *   3. From this folder:  npm i -D playwright-core   (no browser download needed)
 *
 * USAGE:
 *   node run-form.js newhire
 *   node run-form.js equipment
 *   node run-form.js termination
 *   node run-form.js hrv  <workflowId>
 *   node run-form.js it   <workflowId>
 *
 * OUTPUT: prints { workflowId(if any), captured RPC payload, server response,
 *         console errors, NOT-FOUND fields } as JSON for sheet/email/dashboard diffing.
 */

const { chromium } = require('playwright-core');

const CDP_URL = process.env.CDP_URL || 'http://localhost:9222';

// Resolve Chrome's browser websocket endpoint and rewrite the host so it works
// through Docker port-mapping / socat (Chrome reports its *internal* address in
// webSocketDebuggerUrl, which the host can't reach directly). Works unchanged for
// a Chrome running directly on the host too.
async function connectCDP(httpUrl) {
  const base = httpUrl.replace(/\/$/, '');
  const res = await fetch(base + '/json/version');
  const info = await res.json();
  const host = new URL(base).host;
  const ws = info.webSocketDebuggerUrl.replace(/^ws:\/\/[^/]+/, 'ws://' + host);
  return chromium.connectOverCDP(ws);
}
const EXEC = 'https://script.google.com/a/macros/team-group.com/s/AKfycbzidGiaFety1RaDtHewuMaVKfQ98-sCscMTVS4kvNwfxE6ObOje9wiBT2sWzsSOVRq9JQ/exec';

// ── per-form route + fill data (verbatim from NEW_SESSION_PROMPT.md) ─────────────
const FORMS = {
  newhire: {
    route: '?form=initial_request',
    gate: true, // background-check confirmation gate must be cleared first
    values: {
      requesterName: 'E2E Test Requester', requesterEmail: 'dbinns@team-group.com',
      dateRequested: '2026-06-18', hireDate: '2026-07-21', hireType: 'New Hire',
      employeeType: 'Direct Hire', employmentType: 'Salary', firstName: 'TestFirst',
      middleName: '', lastName: 'TestLast', preferredName: '', position: 'Test Analyst',
      siteName: 'Aurora', managerName: 'Alice Manager', managerEmail: 'dbinns@team-group.com',
      systemAccess: 'Yes', department: 'Technology', googleEmailLocal: 'testfirsttestl',
      googleDomain: 'team-group.com', computerRequestType: 'New', computerType: 'Windows',
      phoneRequestType: 'New', office365Required: 'Yes', adpSalaryAccess: 'Yes',
      bossTrainingOnly: 'No', plan306090: 'Yes', comments: 'E2E test submission',
    },
    checkboxes: {
      // NOTE: real DOM names are "systems"/"equipment" (no []); the prompt's scripts were wrong.
      systems: ['BOSS', 'Google Account', 'ADP Supervisor Access', 'Central Purchasing/Jonas'],
      equipment: ['Computer', 'Mobile Phone', 'Business Cards'],
    },
  },
  equipment: {
    route: '?form=equipment_request',
    gate: false,
    values: {
      requesterName: 'E2E Test Requester', requesterEmail: 'dbinns@team-group.com',
      firstName: 'EquipFirst', lastName: 'EquipLast', position: 'Field Supervisor',
      siteName: 'Ottawa Main', managerName: 'Alice Manager', managerEmail: 'dbinns@team-group.com',
      systemAccess: 'Yes', computerRequestType: 'New', computerType: 'Laptop',
      comments: 'E2E equipment request test',
    },
    checkboxes: { systems: ['BOSS'], equipment: ['Computer'] },
  },
  termination: {
    route: '?form=termination_request',
    gate: false,
    values: {
      reqName: 'E2E Test Requester', reqEmail: 'dbinns@team-group.com', empName: 'John E2ETest',
      empWorkEmail: 'je2etest@team-group.com', empType: 'Salary', empPhone: '613-555-9999',
      siteName: 'Ottawa Main', termDate: '2026-08-01', lastDayWorked: '2026-07-31',
      reason: 'Terminated', hr_approved: 'Pending', has_reports: 'Yes',
      reports_to_new: 'dbinns@team-group.com', managerName: 'Alice Manager',
      managerEmail: 'dbinns@team-group.com', google_forward: 'Yes', google_files: 'je2etest-archive',
      google_delegate: 'dbinns@team-group.com', google_duration: '3 Months',
      google_vacation: 'Out of office — contact dbinns@team-group.com', comments: 'E2E termination test',
    },
    checkboxes: {
      'systems[]': ['Email', 'BOSS', 'Google Account'], 'equip[]': ['Laptop', 'Mobile Phone'],
    },
  },
  idsetup: {
    route: (wf) => `?form=id_setup&wf=${encodeURIComponent(wf)}`,
    gate: false, needsWf: true, submitText: 'Complete Employee ID Setup',
    values: {
      siteDocsWorkerId: 'SDW-E2E-001', siteDocsJobCode: 'Salary 1',
      dssPassword: 'DssPass@123', setupNotes: 'E2E ID setup test',
    },
    checkboxes: { bossWisCreated: ['Yes'], siteDocsBadgeCreated: ['Yes'] },
  },
  itconfirm: {
    // IT Confirmation = full InitialRequest form in review mode, all fields prefilled.
    // Rely on prefill; only add notes. Radios/selects validated via prefill + satisfy step.
    route: (wf) => `?form=it_confirmation&wf=${encodeURIComponent(wf)}`,
    gate: true, needsWf: true,
    values: { notes: 'E2E IT confirmation test' },
    checkboxes: {},
  },
  hrv: {
    // Nearly all fields pre-populate from the initial request; preserve them and
    // only supply the empty required field (adpAssociateId) + notes.
    route: (wf) => `?form=hr_verification&wf=${encodeURIComponent(wf)}`,
    gate: false, needsWf: true, submitText: 'Submit Verification',
    values: {
      adpAssociateId: 'ADP-E2E-001', notes: 'E2E HR verification test',
    },
    checkboxes: {},
  },
  it: {
    route: (wf) => `?form=it_setup&wf=${encodeURIComponent(wf)}`,
    gate: false, needsWf: true, submitText: 'Complete IT Setup',
    values: {
      Email_Created: 'Yes', Email_Username: 'testfirsttestl', Email_Domain: '@team-group.com',
      Email_Temp_Password: 'TempPass@123', Computer_Assigned: 'Yes', Computer_Serial: 'SN-E2E-001',
      Computer_Model: 'MacBook Pro 14', Computer_Type: 'Windows PC', Phone_Assigned: 'Yes',
      Phone_Carrier: 'Rogers', Phone_Model: 'iPhone 15', Phone_Number: '613-555-0001',
      Phone_VM_Password: '1234', BOSS_Access: 'Yes', IT_Notes: 'E2E IT setup test',
    },
    // these are checkboxes (not Yes/No fields); check Incidents, leave the rest unchecked (=No)
    checkboxes: { Incidents_Access: ['Yes'] },
  },
};

// runs INSIDE the iframe — wraps google.script.run, following the
// .withSuccessHandler().withFailureHandler().handler(payload) chain so the terminal
// data-bearing call is captured. In dry mode the real RPC is suppressed (no write).
const INTERCEPTOR = (dry) => {
  if (window.__e2eInstalled) { window.__e2eDry = dry; return 'already'; }
  if (typeof google === 'undefined' || !google.script || !google.script.run) return 'no-gsr';
  window.__e2eCalls = [];
  window.__e2eResponse = undefined;
  window.__e2eDry = dry;
  const wrap = (obj) => new Proxy(obj, {
    get(target, prop) {
      const val = target[prop];
      if (typeof val !== 'function') return val;
      return function (...args) {
        // capture the server response by wrapping the success handler
        if (String(prop) === 'withSuccessHandler' && typeof args[0] === 'function') {
          const orig = args[0];
          args[0] = function (resp) {
            try { window.__e2eResponse = JSON.parse(JSON.stringify(resp)); } catch (e) { window.__e2eResponse = String(resp); }
            return orig.apply(this, arguments);
          };
        }
        // a call carrying a data object is the terminal submit handler
        const dataArg = args.find((a) => a && typeof a === 'object' && !(a instanceof Function));
        if (dataArg) {
          try { window.__e2eCalls.push({ fn: String(prop), arg: JSON.parse(JSON.stringify(dataArg)) }); } catch (e) {}
          if (window.__e2eDry) return wrap(target); // suppress real RPC, keep chain alive
        }
        const res = val.apply(target, args);
        return res && (res === target || typeof res.withSuccessHandler === 'function') ? wrap(res) : res;
      };
    },
  });
  google.script.run = wrap(google.script.run);
  window.__e2eInstalled = true;
  return 'installed';
};

// runs INSIDE the iframe — fills fields by name (radios/selects/checkboxes/text-aware),
// returns a report of what couldn't be set faithfully.
const FILLER = ({ values, checkboxes }) => {
  const report = { notFound: [], radioMissed: [], selectFallback: [] };
  const fire = (el) => {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const set = (name, val) => {
    const els = [...document.querySelectorAll(`[name="${name}"]`)];
    if (!els.length) { report.notFound.push(name); return; }
    const radios = els.filter((e) => e.type === 'radio');
    if (radios.length) {
      const m = radios.find((r) => r.value === val);
      if (m) { m.checked = true; fire(m); } else { report.radioMissed.push(`${name}=${val}`); }
      return;
    }
    const el = els[0];
    if (el.tagName === 'SELECT') {
      const opt = [...el.options].find((o) => o.value === val || o.text.trim() === val);
      if (opt) { el.value = opt.value; }
      else {
        const real = [...el.options].find((o) => o.value && o.value !== '');
        if (real) { el.value = real.value; report.selectFallback.push(`${name}: wanted "${val}" -> used "${real.value}"`); }
        else { report.notFound.push(`${name}(no-options)`); }
      }
      fire(el);
      return;
    }
    el.value = val; fire(el);
  };
  Object.entries(values).forEach(([k, v]) => set(k, v));
  Object.entries(checkboxes || {}).forEach(([group, vals]) => {
    vals.forEach((v) => {
      const matched = [...document.querySelectorAll(`[name="${group}"]`)].some((el) => {
        if (el.value === v) { el.checked = true; fire(el); return true; }
        return false;
      });
      if (!matched) report.notFound.push(`${group}=${v}`);
    });
  });
  return report;
};

// runs INSIDE the iframe — finds VISIBLE required fields that are still invalid
// (this is what blocks the native submit), so we know exactly what to satisfy.
const INVALID_REQUIRED = () => {
  const visible = (el) => el.type === 'hidden' || el.offsetParent !== null || el.getClientRects().length > 0;
  const out = [];
  document.querySelectorAll('input[required],select[required],textarea[required]').forEach((el) => {
    if (visible(el) && !el.checkValidity()) {
      out.push({ name: el.name || el.id, tag: el.tagName, type: el.type, value: el.value, checked: el.checked });
    }
  });
  return out;
};

// runs INSIDE the iframe — for any still-invalid visible required SELECT (e.g. the
// cascading jobSiteNumber), pick its first real option so native submit can proceed.
const SATISFY_REQUIRED = () => {
  const visible = (el) => el.type === 'hidden' || el.offsetParent !== null || el.getClientRects().length > 0;
  const filled = [];
  document.querySelectorAll('select[required]').forEach((s) => {
    if (visible(s) && !s.checkValidity()) {
      const real = [...s.options].find((o) => o.value && o.value !== '');
      if (real) { s.value = real.value; s.dispatchEvent(new Event('change', { bubbles: true })); filled.push(`${s.name}=${real.value}`); }
    }
  });
  return filled;
};

(async () => {
  const formKey = process.argv[2];
  const dry = process.argv.includes('--dry');
  const wf = process.argv.slice(3).find((a) => !a.startsWith('--'));
  const cfg = FORMS[formKey];
  if (!cfg) { console.error('Unknown form:', formKey, '\nValid:', Object.keys(FORMS).join(', ')); process.exit(1); }
  if (cfg.needsWf && !wf) { console.error(`Form "${formKey}" requires a workflowId: node run-form.js ${formKey} <wf>`); process.exit(1); }
  const route = typeof cfg.route === 'function' ? cfg.route(wf) : cfg.route;
  const url = EXEC + route;

  const browser = await connectCDP(CDP_URL);
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  console.error(`[nav] ${url}`);
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Find the frame that actually hosts the form. GAS nests an empty userCodeAppPanel
  // frame; the real form (with google.script.run) is the inner one named "userHtmlFrame".
  async function findFormFrame() {
    for (let i = 0; i < 40; i++) {
      const cand = page.frames();
      for (const f of cand) {
        if (f.name() === 'userHtmlFrame') {
          try { if (await f.evaluate(() => !!(window.google && google.script && google.script.run))) return f; } catch (e) {}
        }
      }
      for (const f of cand) {
        try {
          if (await f.evaluate(() => !!(window.google && google.script && google.script.run) && document.querySelectorAll('input,select,textarea').length > 3)) return f;
        } catch (e) {}
      }
      await page.waitForTimeout(500);
    }
    throw new Error('form frame (with google.script.run) not found');
  }
  let frame = await findFormFrame();

  // clear gate if present, then wait for the real form to render
  if (cfg.gate) {
    try {
      await frame.click('button:has-text("requirements are met")', { timeout: 8000 });
      await frame.waitForSelector('[name="firstName"], [name="requesterName"]', { timeout: 10000 });
    } catch (e) { console.error('[gate] not cleared:', e.message); }
    frame = await findFormFrame();
  }

  const interceptorStatus = await frame.evaluate(INTERCEPTOR, dry);
  console.error('[interceptor]', interceptorStatus, dry ? '(DRY — RPC suppressed)' : '(LIVE — will submit)');

  const fillReport = await frame.evaluate(FILLER, { values: cfg.values, checkboxes: cfg.checkboxes });
  console.error('[fill]', JSON.stringify(fillReport));

  // let async-built widgets (cascading job-site list, dual-lists) settle, then
  // satisfy any leftover required selects (e.g. jobSiteNumber cascading off siteName)
  await page.waitForTimeout(2500);
  const autoFilledRequired = await frame.evaluate(SATISFY_REQUIRED);
  await page.waitForTimeout(800);
  const invalidRequired = await frame.evaluate(INVALID_REQUIRED);
  console.error('[auto-filled]', JSON.stringify(autoFilledRequired), '[still-invalid]', JSON.stringify(invalidRequired));

  const wfInForm = await frame.evaluate(() => document.querySelector('[name="workflowId"]')?.value || null);

  // submit
  await page.waitForTimeout(300);
  const submitSel = (cfg.submitText ? `button:has-text("${cfg.submitText}"), ` : '') + 'button[type="submit"], input[type="submit"], button:has-text("Submit")';
  await frame.click(submitSel, { timeout: 10000 }).catch((e) => console.error('[submit click]', e.message));

  // wait for the RPC to fire + capture (sheet writes + emails can take >10s)
  let calls = [];
  let response;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    calls = await frame.evaluate(() => window.__e2eCalls || []);
    response = await frame.evaluate(() => window.__e2eResponse);
    if (dry && calls.length) break;
    if (!dry && response && (response.success !== undefined || response.workflowId || response.requestId)) break;
  }

  console.log(JSON.stringify({
    form: formKey, mode: dry ? 'dry' : 'live', url, workflowIdInForm: wfInForm,
    interceptorStatus, fillReport, autoFilledRequired, invalidRequired, capturedCalls: calls, serverResponse: response, consoleErrors,
  }, null, 2));

  await page.close();
  await browser.close();
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
