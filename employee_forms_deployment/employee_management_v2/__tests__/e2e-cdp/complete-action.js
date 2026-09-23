// Completes a specialist action item (click-based): marks every sub-task Complete,
// satisfies any required fields, then clicks "Mark Task Finalized"
// (-> closeActionItemWithNotes). Usage: node complete-action.js <tid> [--dry]
const { chromium } = require('playwright-core');
const CDP_URL = process.env.CDP_URL || 'http://localhost:9222';
const EXEC = 'https://script.google.com/a/macros/team-group.com/s/AKfycbzidGiaFety1RaDtHewuMaVKfQ98-sCscMTVS4kvNwfxE6ObOje9wiBT2sWzsSOVRq9JQ/exec';

async function connectCDP(httpUrl) {
  const base = httpUrl.replace(/\/$/, '');
  const info = await (await fetch(base + '/json/version')).json();
  const host = new URL(base).host;
  return chromium.connectOverCDP(info.webSocketDebuggerUrl.replace(/^ws:\/\/[^/]+/, 'ws://' + host));
}

const INTERCEPTOR = (dry) => {
  if (window.__e2eInstalled) { window.__e2eDry = dry; return 'already'; }
  if (typeof google === 'undefined' || !google.script || !google.script.run) return 'no-gsr';
  window.__e2eCalls = []; window.__e2eResponse = undefined; window.__e2eDry = dry;
  const wrap = (obj) => new Proxy(obj, {
    get(t, p) {
      const v = t[p];
      if (typeof v !== 'function') return v;
      return function (...a) {
        if (String(p) === 'withSuccessHandler' && typeof a[0] === 'function') {
          const o = a[0]; a[0] = function (r) { try { window.__e2eResponse = JSON.parse(JSON.stringify(r)); } catch (e) { window.__e2eResponse = String(r); } return o.apply(this, arguments); };
        }
        if (/closeActionItem|completeActionItem|saveActionItem/i.test(String(p))) {
          try { window.__e2eCalls.push({ fn: String(p), args: JSON.parse(JSON.stringify(a.filter((x) => typeof x !== 'function'))) }); } catch (e) {}
          if (window.__e2eDry) return wrap(t);
        }
        const r = v.apply(t, a);
        return r && (r === t || typeof r.withSuccessHandler === 'function') ? wrap(r) : r;
      };
    },
  });
  google.script.run = wrap(google.script.run);
  window.__e2eInstalled = true; return 'installed';
};

(async () => {
  const tid = process.argv[2];
  const dry = process.argv.includes('--dry');
  if (!tid) { console.error('usage: node complete-action.js <tid> [--dry]'); process.exit(1); }
  const browser = await connectCDP(CDP_URL);
  const page = await browser.contexts()[0].newPage();
  const url = `${EXEC}?form=action_item_view&tid=${encodeURIComponent(tid)}`;
  console.error('[nav]', url);
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(4000);
  let frame = page.frames().find((f) => f.name() === 'userHtmlFrame') || page.frames().find((f) => /googleusercontent/.test(f.url()));
  for (let i = 0; i < 20 && !(frame && await frame.evaluate(() => !!(window.google && google.script && google.script.run)).catch(() => false)); i++) {
    await page.waitForTimeout(500); frame = page.frames().find((f) => f.name() === 'userHtmlFrame') || frame;
  }
  const interceptorStatus = await frame.evaluate(INTERCEPTOR, dry);
  console.error('[interceptor]', interceptorStatus, dry ? '(DRY)' : '(LIVE)');

  // mark every sub-task Complete/Collected + satisfy any required inputs
  const prep = await frame.evaluate(() => {
    const clicked = [];
    [...document.querySelectorAll('button')].forEach((b) => {
      const oc = b.getAttribute('onclick') || '';
      if (/onStatusChange\('(Complete|Collected)'/.test(oc)) { b.click(); clicked.push(b.textContent.trim()); }
    });
    const filled = [];
    document.querySelectorAll('input[required],select[required],textarea[required]').forEach((el) => {
      if (el.type === 'radio') { const r = document.querySelector(`[name="${el.name}"]`); if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); } return; }
      if (el.tagName === 'SELECT') { const o = [...el.options].find((x) => x.value); if (o) el.value = o.value; }
      else if (!el.value) el.value = 'E2E';
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); filled.push(el.name || el.id);
    });
    return { statusClicked: clicked, requiredFilled: filled };
  });
  console.error('[prep]', JSON.stringify(prep));
  await page.waitForTimeout(800);

  // finalize
  await frame.evaluate(() => {
    const b = document.getElementById('completeBtn') || [...document.querySelectorAll('button')].find((x) => /Finaliz/i.test(x.textContent));
    if (b) b.click();
  });

  let calls = [], response;
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(1000);
    calls = await frame.evaluate(() => window.__e2eCalls || []);
    response = await frame.evaluate(() => window.__e2eResponse);
    if (dry && calls.length) break;
    if (!dry && response && (response.success !== undefined || calls.length)) break;
  }
  console.log(JSON.stringify({ tid, mode: dry ? 'dry' : 'live', interceptorStatus, prep, capturedCalls: calls, serverResponse: response }, null, 2));
  await page.close(); await browser.close();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
