// No-side-effects check: can Playwright attach to the authbox Chrome over CDP?
const { chromium } = require('playwright-core');
const CDP_URL = process.env.CDP_URL || 'http://localhost:9222';

async function connectCDP(httpUrl) {
  const base = httpUrl.replace(/\/$/, '');
  const res = await fetch(base + '/json/version');
  const info = await res.json();
  const host = new URL(base).host;
  const ws = info.webSocketDebuggerUrl.replace(/^ws:\/\/[^/]+/, 'ws://' + host);
  return chromium.connectOverCDP(ws);
}

(async () => {
  const browser = await connectCDP(CDP_URL);
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  await page.goto('about:blank');
  console.log('CONNECTED OK — contexts:', browser.contexts().length, '| version:', browser.version());
  await page.close();
  await browser.close();
})().catch((e) => { console.error('CONNECT FAILED:', e.message); process.exit(1); });
