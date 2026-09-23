const { chromium } = require('playwright-core');
const CDP_URL = process.env.CDP_URL || 'http://localhost:9222';
const EXEC = 'https://script.google.com/a/macros/team-group.com/s/AKfycbzidGiaFety1RaDtHewuMaVKfQ98-sCscMTVS4kvNwfxE6ObOje9wiBT2sWzsSOVRq9JQ/exec';
const route = process.argv[2] || '?form=initial_request';

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
  await page.waitForTimeout(6000); // let GAS bootstrap

  const out = [];
  for (const f of page.frames()) {
    let info = { url: f.url().slice(0, 90), name: f.name() };
    try {
      info = Object.assign(info, await f.evaluate(() => ({
        hasGsr: typeof (window.google && google.script && google.script.run) !== 'undefined',
        inputs: document.querySelectorAll('input,select,textarea').length,
        buttons: [...document.querySelectorAll('button')].map((b) => b.innerText.trim()).filter(Boolean).slice(0, 8),
        firstNames: [...document.querySelectorAll('[name]')].map((e) => e.getAttribute('name')).slice(0, 12),
        bodyPreview: (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').slice(0, 120),
      })));
    } catch (e) { info.evalError = e.message.slice(0, 80); }
    out.push(info);
  }
  console.log(JSON.stringify(out, null, 2));
  await page.close();
  await browser.close();
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
