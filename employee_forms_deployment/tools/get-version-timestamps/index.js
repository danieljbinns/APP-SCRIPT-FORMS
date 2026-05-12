/**
 * get-version-timestamps/index.js
 *
 * Fetches version creation timestamps for all three Apps Script projects
 * and writes the results to version-history.json.
 *
 * Usage:
 *   cd tools/get-version-timestamps
 *   npm install
 *   node index.js
 *
 * Auth: reads ~/.clasprc.json (same credentials clasp uses — no extra setup needed)
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { google } = require('googleapis');

// ── Script IDs ──────────────────────────────────────────────────────────────
const PROJECTS = [
  { name: 'prod',    scriptId: '1AuIbJl1jRh1awi-MW-6y_NftHUGtfUNRexZk1gPzvenmIblSZo-lPz66' },
  { name: 'staging', scriptId: '1A_EPPkI6QW3o39pGuNd74EbLGtqewtByCSi_SBludhLIyn_ShM5YfW-w' },
  { name: 'dev',     scriptId: '1VI9tR0GCxwTmcuXiGBzTkDJVXXB94Hr3PpdnuDq-aBpDKKQGMKhA9U_L' },
];

// ── Auth (reuse clasp token) ─────────────────────────────────────────────────
function getOAuth2Client() {
  // Check multiple candidate locations
  const candidates = [
    path.join(os.homedir(), '.clasprc.json'),
    path.join(process.cwd(), '.clasprc.json'),
    path.join(__dirname, '../../.clasprc.json'),
  ];
  const rcPath = candidates.find(p => fs.existsSync(p));
  if (!rcPath) {
    throw new Error('.clasprc.json not found — run `npx clasp login` first');
  }

  const rc = JSON.parse(fs.readFileSync(rcPath, 'utf8'));

  // Clasp stores tokens under multiple possible structures:
  //   v3+: { tokens: { default: { access_token, refresh_token, client_id, client_secret, ... } } }
  //   v2:  { token: { access_token, ... }, oauth2ClientSettings: { clientId, clientSecret } }
  //   v1:  flat { access_token, refresh_token, client_id, client_secret, ... }
  const tok = (rc.tokens && rc.tokens.default)
            || rc.token
            || rc;
  const oaConf = rc.oauth2ClientSettings || {};

  const clientId     = tok.client_id     || oaConf.clientId     || '1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com';
  const clientSecret = tok.client_secret || oaConf.clientSecret || 'v6V3fKV_zWU7iw0WpA-b';
  const redirectUri  = tok.redirect_uri  || oaConf.redirectUri  || 'http://localhost';

  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  client.setCredentials({
    access_token:  tok.access_token,
    refresh_token: tok.refresh_token,
    token_type:    tok.token_type || 'Bearer',
    expiry_date:   tok.expiry_date,
  });
  return client;
}

// ── Fetch all versions for one project ──────────────────────────────────────
async function fetchVersions(script, auth, projectName) {
  const results = [];
  let pageToken;
  do {
    const res = await script.projects.versions.list({
      scriptId: auth.scriptId,
      pageSize: 50,
      pageToken,
    });
    const versions = (res.data.versions || []);
    for (const v of versions) {
      results.push({
        project:     projectName,
        versionNumber: v.versionNumber,
        description: v.description || '',
        createTime:  v.createTime,           // ISO-8601 string
      });
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const oauthClient = getOAuth2Client();
  const script = google.script({ version: 'v1', auth: oauthClient });

  const allVersions = [];
  for (const proj of PROJECTS) {
    console.log(`Fetching versions for ${proj.name} (${proj.scriptId})…`);
    try {
      const versions = await fetchVersions(script, proj, proj.name);
      console.log(`  → ${versions.length} versions`);
      allVersions.push(...versions);
    } catch (e) {
      console.error(`  ERROR for ${proj.name}:`, e.message);
    }
  }

  // Sort by createTime
  allVersions.sort((a, b) => new Date(a.createTime) - new Date(b.createTime));

  const outPath = path.join(__dirname, 'version-history.json');
  fs.writeFileSync(outPath, JSON.stringify(allVersions, null, 2));
  console.log(`\nWrote ${allVersions.length} version records → ${outPath}`);

  // Quick summary
  const byProject = {};
  for (const v of allVersions) {
    byProject[v.project] = (byProject[v.project] || 0) + 1;
  }
  console.log('Summary:', byProject);
}

main().catch(err => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
