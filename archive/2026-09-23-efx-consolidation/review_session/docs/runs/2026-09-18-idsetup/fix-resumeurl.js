'use strict';
// n8n builds $execution.resumeUrl from the instance's configured base URL, which is unset on this
// deployment, so it comes out as http://localhost:5678 — unclickable from anywhere but the server.
// Real fix is the WEBHOOK_URL env var on the n8n service; this rewrites it at the point of use so
// the demo is usable now.
const fs = require('fs');
const H = { 'X-N8N-API-KEY': fs.readFileSync('D:/Credentials/n8n/api-key-staging.txt', 'utf8').trim(), 'Content-Type': 'application/json' };
const API = 'https://n8n-staging.team-group.com/api/v1';
const WF = 'qd3vlXvkAY8H2PC3';

const OLD = '{{ $execution.resumeUrl }}';
const NEW = "{{ $execution.resumeUrl.replace('http://localhost:5678', 'https://n8n-staging.team-group.com') }}";

(async () => {
  const w = await (await fetch(API + '/workflows/' + WF, { headers: H })).json();
  let hits = 0;
  for (const node of w.nodes) {
    const p = node.parameters || {};
    for (const key of Object.keys(p)) {
      if (typeof p[key] === 'string' && p[key].includes(OLD)) {
        p[key] = p[key].split(OLD).join(NEW);
        hits++;
        console.log('patched ' + node.name + '.' + key);
      }
    }
  }
  if (!hits) { console.log('nothing to patch (already done?)'); }

  const r = await fetch(API + '/workflows/' + WF, { method: 'PUT', headers: H,
    body: JSON.stringify({ name: w.name, nodes: w.nodes, connections: w.connections, settings: w.settings || { executionOrder: 'v1' } }) });
  console.log('PUT HTTP ' + r.status);
  if (!r.ok) { console.error(JSON.stringify(await r.json()).slice(0, 300)); process.exit(1); }

  const a = await (await fetch(API + '/workflows/' + WF, { headers: H })).json();
  const m = a.nodes.find(n => n.name === 'Email manager to review').parameters.message;
  const i = m.indexOf('href=');
  console.log('href now: ' + m.slice(i, i + 190));
  console.log('\nrewrite present: ' + m.includes('n8n-staging.team-group.com'));
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
