/**
 * get-execution-data/index.js
 *
 * Fetches Apps Script execution/process data for staging and dev projects
 * using script.processes.list — covers trigger-based executions (form submits,
 * time triggers, etc.) as well as manually-run functions.
 *
 * Usage:
 *   cd tools/get-execution-data
 *   npm install
 *   node index.js
 *
 * Auth: reads ~/.clasprc.json (same credentials clasp uses)
 *
 * Note: script.processes.list requires the script.processes scope.
 * If the clasp token doesn't have it, the script falls back gracefully
 * and reports which scopes were missing.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { google } = require('googleapis');

// ── Script IDs ──────────────────────────────────────────────────────────────
const PROJECTS = [
  { name: 'staging', scriptId: '1A_EPPkI6QW3o39pGuNd74EbLGtqewtByCSi_SBludhLIyn_ShM5YfW-w' },
  { name: 'dev',     scriptId: '1VI9tR0GCxwTmcuXiGBzTkDJVXXB94Hr3PpdnuDq-aBpDKKQGMKhA9U_L' },
];

// ── Auth (reuse clasp token) ─────────────────────────────────────────────────
function getOAuth2Client() {
  const candidates = [
    path.join(os.homedir(), '.clasprc.json'),
    path.join(process.cwd(), '.clasprc.json'),
    path.join(__dirname, '../../.clasprc.json'),
  ];
  const rcPath = candidates.find(p => fs.existsSync(p));
  if (!rcPath) throw new Error('.clasprc.json not found — run `npx clasp login` first');

  const rc = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
  const tok = (rc.tokens && rc.tokens.default) || rc.token || rc;
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

// ── Fetch processes for one script project ──────────────────────────────────
async function fetchProcesses(script, scriptId, projectName) {
  const results = [];
  let pageToken;
  let pageCount = 0;
  do {
    const res = await script.processes.list({
      'userProcessFilter.scriptId': scriptId,
      pageSize: 500,
      pageToken,
    });
    const procs = res.data.processes || [];
    for (const p of procs) {
      results.push({
        project:      projectName,
        functionName: p.functionName || '',
        processType:  p.processType  || '',  // EDITOR, API_EXECUTABLE, BATCH_TASK, TIME_DRIVEN, TRIGGER, WEBAPP, ADD_ON
        status:       p.processStatus || '', // RUNNING, PAUSED, COMPLETED, CANCELED, FAILED, TIMED_OUT, UNKNOWN, DELAYED
        startTime:    p.startTime    || '',
        duration:     p.duration     || '',  // e.g. "1.234s"
        userAccessLevel: p.userAccessLevel || '',
        projectName:  p.projectName  || '',
      });
    }
    pageToken = res.data.nextPageToken;
    pageCount++;
    console.log(`  page ${pageCount}: ${procs.length} records`);
  } while (pageToken && pageCount < 20); // safety cap

  return results;
}

// ── Summarise results ────────────────────────────────────────────────────────
function summarise(records, projectName) {
  const mine = records.filter(r => r.project === projectName);
  if (!mine.length) return null;

  const byFunction = {};
  const byType = {};
  const byStatus = {};
  const byDate = {};
  let totalDuration = 0;
  let durationCount = 0;

  for (const r of mine) {
    // by function
    byFunction[r.functionName] = (byFunction[r.functionName] || 0) + 1;
    // by process type
    byType[r.processType] = (byType[r.processType] || 0) + 1;
    // by status
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    // by date
    if (r.startTime) {
      const d = r.startTime.substring(0, 10);
      byDate[d] = (byDate[d] || 0) + 1;
    }
    // duration
    if (r.duration) {
      const secs = parseFloat(r.duration.replace('s', ''));
      if (!isNaN(secs)) { totalDuration += secs; durationCount++; }
    }
  }

  const sortedDates = Object.keys(byDate).sort();
  const avgDuration = durationCount ? (totalDuration / durationCount).toFixed(2) : 'N/A';

  return {
    project: projectName,
    total: mine.length,
    byFunction: Object.entries(byFunction).sort((a,b) => b[1]-a[1]).slice(0, 20),
    byType,
    byStatus,
    byDate,
    dateRange: sortedDates.length ? { first: sortedDates[0], last: sortedDates[sortedDates.length-1] } : null,
    avgDurationSec: avgDuration,
    activeDays: sortedDates.length,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const oauthClient = getOAuth2Client();
  const script = google.script({ version: 'v1', auth: oauthClient });

  const allRecords = [];

  for (const proj of PROJECTS) {
    console.log(`\nFetching processes for ${proj.name} (${proj.scriptId})…`);
    try {
      const records = await fetchProcesses(script, proj.scriptId, proj.name);
      console.log(`  → ${records.length} total execution records`);
      allRecords.push(...records);
    } catch (e) {
      if (e.message && e.message.includes('insufficient')) {
        console.error(`  SCOPE ERROR for ${proj.name}: clasp token lacks script.processes scope`);
        console.error('  → Re-run clasp login with the processes scope, or use a service account');
      } else {
        console.error(`  ERROR for ${proj.name}:`, e.message);
        if (e.errors) console.error('  Details:', JSON.stringify(e.errors, null, 2));
      }
    }
  }

  if (!allRecords.length) {
    console.log('\nNo records fetched — cannot write output.');
    return;
  }

  // Write raw data
  const outPath = path.join(__dirname, 'execution-data.json');
  fs.writeFileSync(outPath, JSON.stringify(allRecords, null, 2));
  console.log(`\nWrote ${allRecords.length} records → ${outPath}`);

  // Print summaries
  for (const proj of PROJECTS) {
    const s = summarise(allRecords, proj.name);
    if (!s) { console.log(`\n[${proj.name}] No data`); continue; }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`PROJECT: ${s.project.toUpperCase()}  —  ${s.total} executions`);
    console.log(`Date range: ${s.dateRange?.first} → ${s.dateRange?.last}  (${s.activeDays} active days)`);
    console.log(`Avg duration: ${s.avgDurationSec}s`);

    console.log('\nBy process type:');
    for (const [k,v] of Object.entries(s.byType)) console.log(`  ${k}: ${v}`);

    console.log('\nBy status:');
    for (const [k,v] of Object.entries(s.byStatus)) console.log(`  ${k}: ${v}`);

    console.log('\nTop functions:');
    for (const [fn, cnt] of s.byFunction.slice(0, 15)) console.log(`  ${cnt.toString().padStart(4)}  ${fn}`);

    console.log('\nBy date (non-zero):');
    const sortedDates = Object.keys(s.byDate).sort();
    for (const d of sortedDates) console.log(`  ${d}: ${s.byDate[d]}`);
  }

  // Also write summary JSON
  const summaries = PROJECTS.map(p => summarise(allRecords, p.name)).filter(Boolean);
  fs.writeFileSync(path.join(__dirname, 'execution-summary.json'), JSON.stringify(summaries, null, 2));
  console.log('\nSummary written → execution-summary.json');
}

main().catch(err => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
