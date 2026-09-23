'use strict';
// Restore George's REAL Gmail trigger + parser in DEMO JR 1, pointed at Binns' own
// Gmail credential instead of George's. Drops the fixture + test webhook: the TEST Forms
// tier already emails a genuine "JR Assignment" message, so seeding a hire IS the trigger.
const fs = require('fs');
const H = { 'X-N8N-API-KEY': fs.readFileSync('D:/Credentials/n8n/api-key-staging.txt', 'utf8').trim(), 'Content-Type': 'application/json' };
const API = 'https://n8n-staging.team-group.com/api/v1';
const JR1 = 'gJH2dgXcVfGcrEH8';
const MY_GMAIL = { gmailOAuth2: { id: 'hCxnU4lnRGvMs9Ne', name: 'Gmail account 2' } };
const GEORGE_CRED = 'kEsS7YhHvZLAf23H';

(async () => {
  const src = JSON.parse(fs.readFileSync('wf-4InJ9cdAr5YxVgoT.json', 'utf8'));
  // n8n keys nodes by id and SILENTLY refuses to change a node's type in place (PUT returns 200,
  // type unchanged). Give each restored node a fresh id; the NAME must stay so $('...') refs resolve.
  const rid = () => 'efxrestore_' + Math.random().toString(36).slice(2, 10);
  const orig = n => { const o = JSON.parse(JSON.stringify(src.nodes.find(x => x.name === n))); o.id = rid(); return o; };

  const w = await (await fetch(API + '/workflows/' + JR1, { headers: H })).json();
  const at = n => w.nodes.findIndex(x => x.name === n);

  // 1. trigger: gmailTrigger on MY mailbox, same filter George uses
  const t = orig('Watch for JR Email');
  t.credentials = MY_GMAIL;
  w.nodes[at('Watch for JR Email')] = t;

  // 2. fetch body: original httpRequest, my credential
  const f = orig('Fetch Full Email Body');
  f.credentials = MY_GMAIL;
  f.parameters.nodeCredentialType = 'gmailOAuth2';
  w.nodes[at('Fetch Full Email Body')] = f;

  // 3. parser: George's real one, verbatim
  const p = orig('Parse Email Data');
  w.nodes[at('Parse Email Data')] = p;

  // 4. drop the EFX test webhook + its connection (the real email is the trigger now)
  const drop = 'Run via webhook (EFX TEST)';
  w.nodes = w.nodes.filter(n => n.name !== drop);
  delete w.connections[drop];

  // 5. original wiring: trigger -> fetch -> parse -> index
  w.connections['Watch for JR Email'] = { main: [[{ node: 'Fetch Full Email Body', type: 'main', index: 0 }]] };
  w.connections['Fetch Full Email Body'] = { main: [[{ node: 'Parse Email Data', type: 'main', index: 0 }]] };
  w.connections['Parse Email Data'] = { main: [[{ node: 'Read JR Index', type: 'main', index: 0 }]] };

  // sticky note refresh
  const note = w.nodes.find(n => n.name === 'EFX TEST note');
  if (note) note.parameters.content = [
    '## DEMO · JR 1 (EFX TEST)', '',
    "Copy of George's **JR Assignment Automation**, now with his **real Gmail trigger and parser**.", '',
    '* Watches **your** mailbox (`Gmail account 2`), filter `subject:"JR Assignment" is:unread` — identical to his.',
    '* The TEST Forms tier already sends a genuine "JR Assignment" email, so **seeding a hire fires this**.',
    "* Tracker / Index / Template are **(EFX TEST) copies**, never George's live files.",
    '* Every outbound email goes to dbinns@team-group.com.',
    '* Approval link points at the `-efxtest` webhook path.'
  ].join('\n');

  const guard = JSON.stringify(w.nodes);
  if (guard.includes(GEORGE_CRED)) throw new Error("George's Gmail credential survived the rewrite - aborting");

  const r = await fetch(API + '/workflows/' + JR1, { method: 'PUT', headers: H,
    body: JSON.stringify({ name: w.name, nodes: w.nodes, connections: w.connections, settings: w.settings || { executionOrder: 'v1' } }) });
  if (!r.ok) { console.error('FAILED: ' + JSON.stringify(await r.json()).slice(0, 400)); process.exit(1); }

  const after = await (await fetch(API + '/workflows/' + JR1, { headers: H })).json();
  console.log('JR 1 restored to the real email path:');
  for (const n of after.nodes.filter(x => /Watch for JR Email|Fetch Full Email Body|Parse Email Data/.test(x.name))) {
    console.log('  ' + n.name.padEnd(24) + n.type.replace('n8n-nodes-base.', '').padEnd(16) + JSON.stringify(n.credentials || {}));
  }
  console.log('  trigger filter: ' + JSON.stringify(after.nodes.find(n => n.name === 'Watch for JR Email').parameters.filters));
  console.log('  test webhook removed: ' + !after.nodes.some(n => n.name === 'Run via webhook (EFX TEST)'));
  console.log("  George's credential present anywhere: " + JSON.stringify(after.nodes).includes(GEORGE_CRED));
  console.log('  active: ' + after.active);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
