// Field-discovery: loads a form (clearing any gate), inventories every named field
// with type/required/options so we can fill it accurately.
// Usage: node discover.js "?form=id_setup&wf=NEW_EMP_..."
const { chromium } = require('playwright-core');
const CDP_URL = process.env.CDP_URL || 'http://localhost:9222';
const EXEC = 'https://script.google.com/a/macros/team-group.com/s/AKfycbzidGiaFety1RaDtHewuMaVKfQ98-sCscMTVS4kvNwfxE6ObOje9wiBT2sWzsSOVRq9JQ/exec';
const route = process.argv[2] || '?form=id_setup';

async function connectCDP(httpUrl) {
  const base = httpUrl.replace(/\/$/, '');
  const info = await (await fetch(base + '/json/version')).json();
  const host = new URL(base).host;
  return chromium.connectOverCDP(info.webSocketDebuggerUrl.replace(/^ws:\/\/[^/]+/, 'ws://' + host));
}

(async () => {
  const browser = await connectCDP(CDP_URL);
  const page = await browser.contexts()[0].newPage();
  await page.goto(EXEC + route, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(5000);
  let frame = page.frames().find((f) => f.name() === 'userHtmlFrame')
    || page.frames().find((f) => /googleusercontent/.test(f.url()));
  // clear any gate / continue button
  try { await frame.click('button:has-text("requirements are met"), button:has-text("Continue")', { timeout: 4000 }); await page.waitForTimeout(2500); } catch (e) {}
  frame = page.frames().find((f) => f.name() === 'userHtmlFrame') || frame;

  const dump = await frame.evaluate(() => {
    const title = document.querySelector('h1,h2')?.innerText || '';
    const bodyErr = /Error|not found|Access Denied/i.test(document.body.innerText.slice(0, 200)) ? document.body.innerText.slice(0, 200) : null;
    const seen = {};
    const fields = [];
    document.querySelectorAll('[name]').forEach((el) => {
      const n = el.getAttribute('name');
      if (seen[n]) { if (el.type === 'radio') seen[n].radioValues.push(el.value); return; }
      const f = { name: n, tag: el.tagName, type: el.type, required: el.required || false, visible: el.offsetParent !== null };
      if (el.tagName === 'SELECT') f.options = [...el.options].map((o) => o.value).filter(Boolean).slice(0, 12);
      if (el.type === 'radio') f.radioValues = [el.value];
      if (el.value && el.type !== 'radio') f.currentValue = el.value;
      seen[n] = f; fields.push(f);
    });
    const buttons = [...document.querySelectorAll('button')].map((b) => b.innerText.trim()).filter(Boolean);
    return { title, bodyErr, workflowId: document.querySelector('[name="workflowId"]')?.value || null, fields, buttons };
  });
  console.log(JSON.stringify(dump, null, 2));
  await page.close();
  await browser.close();
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
