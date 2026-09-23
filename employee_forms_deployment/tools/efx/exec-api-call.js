#!/usr/bin/env node
'use strict';
/**
 * exec-api-call.js — call an n8n_* alias on the TEST script through the Apps Script Execution API,
 * exactly the way the n8n Router does (service account + domain-wide delegation). For tomorrow's T1/T2.
 *
 *   cd tools && npm i googleapis            (once)
 *   node exec-api-call.js --key D:\Credentials\google\gcp\efx-test-sa.json --subject efx-bot@team-group.com \
 *        --script <<EFX_SCRIPT_ID>> --fn n8n_ping
 *   node exec-api-call.js ... --fn n8n_closeTask --args '[{"id":"cli"},{"taskId":"TK-XXXX","dryRun":true}]'
 *
 * Never point --script at the prod script id (1AuIbJl1jR…). The script refuses that id.
 */
const { google } = require('googleapis');
const fs = require('fs');

const a = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => { if (v.startsWith('--')) acc.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return acc; }, []));
const need = k => { if (!a[k]) { console.error('missing --' + k); process.exit(2); } return a[k]; };
const key = need('key'), subject = need('subject'), scriptId = need('script'), fn = need('fn');
if (scriptId.startsWith('1AuIbJl1jRh1awi')) { console.error('REFUSED: that is the PROD script id'); process.exit(3); }
const args = a.args ? JSON.parse(a.args) : (fn === 'n8n_ping' || fn === 'n8n_info' || fn === 'n8n_contracts' ? [] : [{ id: 'cli:exec-api-call', email: subject, display: 'exec-api-call.js' }]);

(async () => {
  const creds = JSON.parse(fs.readFileSync(key, 'utf8'));
  const auth = new google.auth.JWT({
    email: creds.client_email, key: creds.private_key, subject,
    scopes: ['https://www.googleapis.com/auth/script.projects', 'https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive',
             'https://www.googleapis.com/auth/script.external_request', 'https://www.googleapis.com/auth/script.send_mail', 'https://www.googleapis.com/auth/userinfo.email',
             'https://www.googleapis.com/auth/admin.directory.user.readonly', 'https://www.googleapis.com/auth/admin.directory.group.member.readonly']
  });
  const script = google.script({ version: 'v1', auth });
  const t0 = Date.now();
  const res = await script.scripts.run({ scriptId, requestBody: { function: fn, parameters: args, devMode: a.dev === true } });
  const body = res.data;
  if (body.error) { console.error('SCRIPT ERROR:', JSON.stringify(body.error, null, 2)); process.exit(1); }
  const result = body.response && body.response.result;
  console.log(JSON.stringify(result, null, 2));
  console.log(`\n(${Date.now() - t0} ms)  ok=${result && result.ok}`);
  process.exit(result && result.ok === false ? 1 : 0);
})().catch(e => { console.error('TRANSPORT ERROR:', e.message); if (e.response && e.response.data) console.error(JSON.stringify(e.response.data, null, 2)); process.exit(1); });
