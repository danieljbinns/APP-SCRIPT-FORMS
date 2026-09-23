'use strict';
// Replace the native Google Sheets nodes (which will not take the service-account credential)
// with httpRequest + a Code node that reproduces n8n's col_N row shape exactly.
const fs = require('fs');
const H = { 'X-N8N-API-KEY': fs.readFileSync('D:/Credentials/n8n/api-key-staging.txt', 'utf8').trim(), 'Content-Type': 'application/json' };
const API = 'https://n8n-staging.team-group.com/api/v1';
const SA = { googleApi: { id: 'DgSBjZ6s6HAXXfGe', name: 'EFX Google SA (test)' } };

// n8n's Sheets node keys rows col_1..col_N (1-based) when the sheet has no usable header row.
// Find Matching Template reads col_3 (JR Template Name) / col_7 (Alias);
// Lookup BOSS Job ID reads col_3, col_6 (ID # in BOSS), col_7/col_8.
const RESHAPE = [
  "// Reproduces the shape n8n's Google Sheets node returned (col_1..col_N, 1-based),",
  "// so the downstream Code nodes are untouched.",
  "const rows = $input.first().json.values || [];",
  "return rows.map(r => {",
  "  const o = {};",
  "  for (let i = 0; i < Math.max(r.length, 10); i++) o['col_' + (i + 1)] = r[i] === undefined ? '' : r[i];",
  "  return { json: o };",
  "});"
].join('\n');

(async () => {
  for (const id of ['gJH2dgXcVfGcrEH8', 'xPuvT5y4EvoLo3xO']) {
    const w = await (await fetch(API + '/workflows/' + id, { headers: H })).json();
    const n = w.nodes.find(x => x.type === 'n8n-nodes-base.googleSheets');
    if (!n) { console.log('no native Sheets node in ' + w.name); continue; }

    const docId = n.parameters.documentId.value;
    const tab = n.parameters.sheetName.value;
    const consumers = (w.connections[n.name] && w.connections[n.name].main[0] || []).map(x => x.node);
    const reshapeName = n.name + ' rows';

    // the node keeps its name, but becomes a plain Sheets REST read under the SA credential
    n.type = 'n8n-nodes-base.httpRequest';
    n.typeVersion = 4.2;
    n.parameters = {
      url: 'https://sheets.googleapis.com/v4/spreadsheets/' + docId + '/values/' + encodeURIComponent(tab) + '!A:J',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleApi',
      options: {}
    };
    n.credentials = SA;

    if (!w.nodes.some(x => x.name === reshapeName)) {
      w.nodes.push({ name: reshapeName, type: 'n8n-nodes-base.code', typeVersion: 2,
        position: [n.position[0] + 180, n.position[1] + 120], parameters: { jsCode: RESHAPE } });
    }
    w.connections[n.name] = { main: [[{ node: reshapeName, type: 'main', index: 0 }]] };
    w.connections[reshapeName] = { main: [consumers.map(c => ({ node: c, type: 'main', index: 0 }))] };

    const r = await fetch(API + '/workflows/' + id, { method: 'PUT', headers: H,
      body: JSON.stringify({ name: w.name, nodes: w.nodes, connections: w.connections, settings: w.settings || { executionOrder: 'v1' } }) });
    if (!r.ok) { console.error('FAIL ' + w.name + ': ' + JSON.stringify(await r.json()).slice(0, 300)); continue; }
    console.log('OK   ' + w.name);
    console.log('       ' + n.name + ' -> httpRequest (SA) -> ' + reshapeName + ' -> ' + consumers.join(', '));
  }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
