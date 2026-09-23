'use strict';
// Move the EFX workflows into the "Employee Forms" FOLDER inside Binns' personal project.
// The public API refuses a transfer whose destination project is unchanged, so each workflow
// hops out to "My project" and straight back with destinationParentFolderId set. Same project
// at rest, so credential access is unaffected.
const fs = require('fs');
const H = { 'X-N8N-API-KEY': fs.readFileSync('D:/Credentials/n8n/api-key-staging.txt', 'utf8').trim(), 'Content-Type': 'application/json' };
const API = 'https://n8n-staging.team-group.com/api/v1';
const HOME = '0wpVg3Nd6BJATZle';
const BOUNCE = '8Gem7K8QNtIPD23K';
const FOLDER = 'MtrtgGF9uWCFigwu';
const KEEP_OUT = ['HKsmpIUrnj6z8Pof'];   // the Looker test workflow - not EFX, leave it alone

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const all = (await (await fetch(API + '/workflows?limit=250', { headers: H })).json()).data;
  const mine = all.filter(w => (w.shared || []).some(x => (x.projectId || x.id) === HOME))
                  .filter(w => !KEEP_OUT.includes(w.id));
  console.log('to move: ' + mine.length + '   (active: ' + mine.filter(w => w.active).length + ')\n');

  const wasActive = {};
  const stranded = [];
  let moved = 0;

  for (const w of mine) {
    wasActive[w.id] = w.active;
    // active workflows cannot always be transferred; deactivate first, restore after
    if (w.active) await fetch(API + '/workflows/' + w.id + '/deactivate', { method: 'POST', headers: H });

    const out = await fetch(API + '/workflows/' + w.id + '/transfer', { method: 'PUT', headers: H,
      body: JSON.stringify({ destinationProjectId: BOUNCE }) });
    if (!out.ok) { console.log('  SKIP (hop1 failed)  ' + w.name + '  ' + JSON.stringify(await out.json()).slice(0, 120));
                   if (wasActive[w.id]) await fetch(API + '/workflows/' + w.id + '/activate', { method: 'POST', headers: H });
                   continue; }

    const back = await fetch(API + '/workflows/' + w.id + '/transfer', { method: 'PUT', headers: H,
      body: JSON.stringify({ destinationProjectId: HOME, destinationParentFolderId: FOLDER }) });
    if (!back.ok) {
      stranded.push(w);
      console.log('  *** STRANDED in My project: ' + w.name + '  ' + JSON.stringify(await back.json()).slice(0, 160));
      continue;
    }
    moved++;
    process.stdout.write('.');
    await sleep(60);
  }
  console.log('\n\nmoved into the folder: ' + moved);

  // rescue anything left behind
  for (const w of stranded) {
    const r = await fetch(API + '/workflows/' + w.id + '/transfer', { method: 'PUT', headers: H,
      body: JSON.stringify({ destinationProjectId: HOME }) });
    console.log((r.ok ? '  rescued to personal (no folder): ' : '  STILL STRANDED: ') + w.name);
  }

  // restore active states
  console.log('\nrestoring active states...');
  for (const id of Object.keys(wasActive)) {
    if (!wasActive[id]) continue;
    const r = await fetch(API + '/workflows/' + id + '/activate', { method: 'POST', headers: H });
    const j = await r.json();
    console.log('  ' + (j.active === true ? 'ACTIVE  ' : 'FAILED  ') + (j.name || id));
  }

  // final audit
  const after = (await (await fetch(API + '/workflows?limit=250', { headers: H })).json()).data;
  const home = after.filter(w => (w.shared || []).some(x => (x.projectId || x.id) === HOME));
  const elsewhere = after.filter(w => mine.some(m => m.id === w.id) && !(w.shared || []).some(x => (x.projectId || x.id) === HOME));
  console.log('\nin your personal project: ' + home.length);
  console.log('active: ' + home.filter(w => w.active).map(w => w.name).join(' | '));
  console.log('NOT back home: ' + (elsewhere.length ? elsewhere.map(w => w.name).join(', ') : 'none'));
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
