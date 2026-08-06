// Read-only: confirms the container Chrome is logged in (no submit, no writes).
const { chromium } = require('playwright-core');
const CDP_URL = process.env.CDP_URL || 'http://localhost:9222';
const EXEC = 'https://script.google.com/a/macros/team-group.com/s/AKfycbzidGiaFety1RaDtHewuMaVKfQ98-sCscMTVS4kvNwfxE6ObOje9wiBT2sWzsSOVRq9JQ/exec';

async function connectCDP(httpUrl) {
  const base = httpUrl.replace(/\/$/, '');
  const info = await (await fetch(base + '/json/version')).json();
  const host = new URL(base).host;
  const ws = info.webSocketDebuggerUrl.replace(/^ws:\/\/[^/]+/, 'ws://' + host);
  return chromium.connectOverCDP(ws);
}

(async () => {
  const browser = await connectCDP(CDP_URL);
  const page = await browser.contexts()[0].newPage();
  await page.goto(EXEC + '?form=dashboard', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(3000);
  const finalUrl = page.url();
  const title = await page.title();
  const isLogin = /accounts\.google\.com|signin|ServiceLogin/i.test(finalUrl);
  // who are we, per the app frame
  let who = null;
  const frame = page.frames().find((f) => /userCodeAppPanel|googleusercontent/.test(f.url()));
  if (frame) { try { who = (await frame.evaluate(() => document.body.innerText)).slice(0, 200); } catch (e) {} }
  console.log(JSON.stringify({ loggedIn: !isLogin, finalUrl, title, frameTextPreview: who }, null, 2));
  await page.close();
  await browser.close();
})().catch((e) => { console.error('CHECK FAILED:', e.message); process.exit(1); });
