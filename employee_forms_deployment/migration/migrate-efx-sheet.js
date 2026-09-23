#!/usr/bin/env node
/**
 * migrate-efx-sheet.js — Node twin of employee_management_v2_efx/MigrationTools.js::migrateEfx()
 *
 * Applies the EFX (n8n integration) sheet changes to an Employee Forms spreadsheet WITHOUT going
 * through the Apps Script editor. Header/tab-level only — no existing data cell is ever read-modified
 * or deleted. Idempotent: re-running reports "no-op" for anything already present.
 *
 *   1. 'Initial Requests'  — add header 'Internal Employee ID' at column 56 (index 55)
 *                             PRECONDITION: column 55 header must be exactly 'BOSS Training User Only'
 *                             (otherwise the schema is out of step with SchemaConstants and we ABORT).
 *   2. 'Employee IDs'      — create the registry tab with its 7 headers (bold, red band, frozen row)
 *   3. 'Raw Log'           — if the tab exists, add headers 'Event ID','Kind' at columns 6-7
 *                             (if the tab is absent, RawLog.js creates it with all 7 headers on first write)
 *   4. --backfill          — optional: seed 'Employee IDs' from 'ID Setup Results' (one row per workflow
 *                             that has a numeric Internal Employee ID and no registry row yet)
 *
 * USAGE
 *   node migrate-efx-sheet.js --sheet <spreadsheetId> [--key <sa.json>] [--impersonate <user@team-group.com>]
 *                             [--backfill] [--apply] [--i-know-this-is-prod]
 *
 *   Default mode is DRY-RUN (reads only, prints a diff-style report). Add --apply to write.
 *
 * AUTH (first match wins)
 *   --key <path>                 service-account JSON key; the SA email must be an editor on the sheet
 *   --key <path> --impersonate   same key, but mints a domain-wide-delegation token AS that user
 *                                (needs DWD authorised for the SA client id with the spreadsheets scope);
 *                                the sheet must be shared with the impersonated user, not the SA
 *   (neither)                    Application Default Credentials:
 *                                  gcloud auth application-default login \
 *                                    --scopes=https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/cloud-platform
 *                                  gcloud auth application-default set-quota-project <gcp-project-id>
 *
 * SAFETY
 *   • Refuses to run against the PROD spreadsheet id unless --i-know-this-is-prod is also given.
 *   • Aborts (exit 2) on any schema surprise instead of guessing.
 *   • Warns if the spreadsheet title does not contain 'EFX TEST' (the test copy naming convention).
 *
 * REPORT LEGEND
 *   +  would add / added        =  already present (no-op)
 *   !  warning                  x  abort condition
 */

'use strict';

const fs = require('fs');
const path = require('path');

// googleapis is loaded lazily so the CLI guards (--help, prod refusal, arg errors) work before `npm install`.
let google = null;
function loadGoogle() {
  if (google) return google;
  try { google = require('googleapis').google; }
  catch (e) { die("Missing dependency 'googleapis' — run `npm install` in the migration/ folder first.", 1); }
  return google;
}

// ---------------------------------------------------------------------------
// Constants — mirror SchemaConstants.js / Config.js / RawLog.js / EmployeeIdRegistry.js in the fork
// ---------------------------------------------------------------------------

const PROD_SHEET_ID = '1kGjw8e-uIehaBemlsRZ4Yq1QrYOWkJvWzhKbgfl4Pxo'; // live prod — never by accident

const SHEETS = {
  INITIAL_REQUESTS: 'Initial Requests',
  EMPLOYEE_IDS: 'Employee IDs',
  RAW_LOG: 'Raw Log',
  ID_SETUP_RESULTS: 'ID Setup Results'
};

// SchemaConstants.INITIAL_REQUESTS (0-based)
const IR = { BOSS_TRAINING_ONLY: 54, INTERNAL_EMP_ID: 55 };
const IR_HEADER_BOSS_TRAINING = 'BOSS Training User Only';
const IR_HEADER_INTERNAL_ID = 'Internal Employee ID';

// EmployeeIdRegistry.HEADERS
const EMPLOYEE_IDS_HEADERS = ['Internal Employee ID', 'Workflow ID', 'Employee Name', 'Allocated At', 'Allocated By', 'Source', 'Note'];

// RawLog.js RAW_LOG_HEADERS — first five exist today; six and seven are the EFX additions
const RAW_LOG_HEADERS = ['Timestamp', 'Source', 'Workflow ID', 'User', 'Raw JSON', 'Event ID', 'Kind'];
const RAW_LOG_NEW_COL_START = 6; // 1-based

// SchemaConstants.ID_SETUP_RESULTS (0-based)
const IDS = { WORKFLOW_ID: 0, SUBMISSION_TS: 2, INTERNAL_EMP_ID: 3, SUBMITTED_BY: 11 };

// Header band styling used by the GAS migration (setFontWeight bold, #EB1C2D background, white text)
const HEADER_STYLE = {
  backgroundColor: { red: 0xEB / 255, green: 0x1C / 255, blue: 0x2D / 255 },
  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
};

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { apply: false, backfill: false, iKnowProd: false, sheet: null, key: null, impersonate: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => { const v = argv[i + 1]; if (v === undefined || v.startsWith('--')) die(`Missing value for ${a}`, 1); i++; return v; };
    switch (a) {
      case '--sheet': out.sheet = next(); break;
      case '--key': out.key = next(); break;
      case '--impersonate': out.impersonate = next(); break;
      case '--apply': out.apply = true; break;
      case '--backfill': out.backfill = true; break;
      case '--i-know-this-is-prod': out.iKnowProd = true; break;
      case '--dry-run': out.apply = false; break;
      case '-h': case '--help': out.help = true; break;
      default: die(`Unknown argument: ${a}`, 1);
    }
  }
  return out;
}

function usage() {
  const text = fs.readFileSync(__filename, 'utf8');
  const m = text.match(/\/\*\*([\s\S]*?)\*\//);
  console.log(m ? m[1].replace(/^ \* ?/gm, '') : 'see file header');
}

function die(msg, code) {
  console.error('\nx ' + msg);
  process.exit(code === undefined ? 2 : code);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function getAuthClient(opts) {
  const google = loadGoogle();
  if (opts.key) {
    const keyPath = path.resolve(opts.key);
    if (!fs.existsSync(keyPath)) die(`Key file not found: ${keyPath}`, 1);
    const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    if (!key.client_email || !key.private_key) die('Key file is not a service-account JSON (client_email/private_key missing)', 1);
    const jwt = new google.auth.JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: SCOPES,
      subject: opts.impersonate || undefined   // DWD: act as this Workspace user
    });
    await jwt.authorize();
    return { client: jwt, who: opts.impersonate ? `${key.client_email} impersonating ${opts.impersonate}` : key.client_email };
  }
  if (opts.impersonate) die('--impersonate requires --key <service-account.json>', 1);
  const auth = new google.auth.GoogleAuth({ scopes: SCOPES });
  const client = await auth.getClient();
  return { client, who: 'Application Default Credentials' };
}

// ---------------------------------------------------------------------------
// Sheets helpers
// ---------------------------------------------------------------------------

function columnLetter(n) { // 1-based → A, B, ..., Z, AA, AB ...
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function quoteRange(title, a1) { return `'${title.replace(/'/g, "''")}'!${a1}`; }

async function getMeta(sheets, id) {
  const res = await sheets.spreadsheets.get({ spreadsheetId: id, fields: 'properties.title,sheets.properties(sheetId,title,gridProperties)' });
  return res.data;
}

async function getHeaderRow(sheets, id, title) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: quoteRange(title, '1:1'), majorDimension: 'ROWS' });
  return ((res.data.values && res.data.values[0]) || []).map(v => String(v === null || v === undefined ? '' : v).trim());
}

async function getAllValues(sheets, id, title) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: quoteRange(title, 'A:N'), majorDimension: 'ROWS' });
  return res.data.values || [];
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

class Report {
  constructor(apply) { this.apply = apply; this.lines = []; this.adds = 0; this.warns = 0; this.aborts = 0; }
  add(s)  { this.adds++;  this.lines.push(`+ ${this.apply ? 'DID  ' : 'WOULD'} ${s}`); console.log(this.lines[this.lines.length - 1]); }
  noop(s) { this.lines.push(`= ${s}`); console.log(this.lines[this.lines.length - 1]); }
  warn(s) { this.warns++; this.lines.push(`! ${s}`); console.log(this.lines[this.lines.length - 1]); }
  abort(s){ this.aborts++; this.lines.push(`x ${s}`); console.log(this.lines[this.lines.length - 1]); }
}

// ---------------------------------------------------------------------------
// Step 1 — Initial Requests header
// ---------------------------------------------------------------------------

async function stepInitialRequests(ctx) {
  const { sheets, id, report, apply, meta } = ctx;
  const title = SHEETS.INITIAL_REQUESTS;
  console.log(`\n--- 1. '${title}' — header '${IR_HEADER_INTERNAL_ID}' at col ${IR.INTERNAL_EMP_ID + 1} ---`);
  if (!meta.titles.includes(title)) { report.abort(`'${title}' tab not found — wrong spreadsheet?`); return; }

  const headers = await getHeaderRow(sheets, id, title);
  const existingIdx = headers.indexOf(IR_HEADER_INTERNAL_ID);
  const target = IR.INTERNAL_EMP_ID; // 0-based 55 → col 56

  if (existingIdx === target) { report.noop(`'${IR_HEADER_INTERNAL_ID}' already at col ${target + 1} (no-op)`); return; }
  if (existingIdx !== -1) {
    report.abort(`'${IR_HEADER_INTERNAL_ID}' exists at col ${existingIdx + 1} but SchemaConstants.INITIAL_REQUESTS.INTERNAL_EMP_ID=${target} (col ${target + 1}). Fix SchemaConstants; do NOT move data.`);
    return;
  }

  // Precondition: col 55 must be 'BOSS Training User Only'
  const col55 = headers[IR.BOSS_TRAINING_ONLY] || '';
  if (col55 !== IR_HEADER_BOSS_TRAINING) {
    report.abort(`Precondition failed: '${title}' col ${IR.BOSS_TRAINING_ONLY + 1} header is '${col55 || '(blank)'}', expected '${IR_HEADER_BOSS_TRAINING}'. ` +
      `Header row has ${headers.length} non-blank-trimmed cells. Run migrateAddMissingHeaders() in the editor first, or check the sheet.`);
    return;
  }
  // Target cell must be blank (or beyond the current header row)
  const col56 = headers[target] || '';
  if (col56) { report.abort(`'${title}' col ${target + 1} already holds '${col56}' — refusing to overwrite.`); return; }
  if (headers.length > target + 1) {
    const extra = headers.slice(target + 1).filter(Boolean);
    if (extra.length) report.warn(`'${title}' has headers beyond col ${target + 1}: ${extra.join(', ')} — not part of the schema; check before relying on positional reads.`);
  }

  report.add(`add header '${IR_HEADER_INTERNAL_ID}' at '${title}'!${columnLetter(target + 1)}1 (col ${target + 1})`);
  if (apply) {
    await widenGridIfNeeded(sheets, id, title, target + 1);
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: quoteRange(title, `${columnLetter(target + 1)}1`),
      valueInputOption: 'RAW',
      requestBody: { values: [[IR_HEADER_INTERNAL_ID]] }
    });
  }
}

/**
 * Ensure the tab's grid is at least `needCols` wide.
 *
 * Apps Script's sheet.getRange(1, n).setValue() silently extends the sheet when n is
 * beyond the current width. The Sheets REST API does NOT: values.update past the grid
 * fails with 400 "Range (...) exceeds grid limits". A stock Employee Forms
 * 'Initial Requests' tab is exactly 55 columns wide and the EFX header goes at 56, so
 * this fires on every un-migrated sheet, prod included.
 *
 * Adds columns only. Never removes, never touches data.
 */
async function widenGridIfNeeded(sheets, id, title, needCols) {
  const res = await sheets.spreadsheets.get({
    spreadsheetId: id,
    fields: 'sheets.properties(sheetId,title,gridProperties)'
  });
  const sh = (res.data.sheets || []).find(s => s.properties && s.properties.title === title);
  if (!sh) throw new Error(`widenGridIfNeeded: tab '${title}' not found`);
  const have = (sh.properties.gridProperties && sh.properties.gridProperties.columnCount) || 0;
  if (have >= needCols) return false;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: {
      requests: [{
        appendDimension: { sheetId: sh.properties.sheetId, dimension: 'COLUMNS', length: needCols - have }
      }]
    }
  });
  console.log(`  (widened '${title}' grid ${have} -> ${needCols} columns)`);
  return true;
}

// ---------------------------------------------------------------------------
// Step 2 — Employee IDs registry tab
// ---------------------------------------------------------------------------

async function stepEmployeeIds(ctx) {
  const { sheets, id, report, apply, meta } = ctx;
  const title = SHEETS.EMPLOYEE_IDS;
  console.log(`\n--- 2. '${title}' registry tab ---`);

  if (meta.titles.includes(title)) {
    const headers = await getHeaderRow(sheets, id, title);
    const same = EMPLOYEE_IDS_HEADERS.every((h, i) => headers[i] === h);
    if (same) report.noop(`'${title}' already present with expected headers (no-op)`);
    else report.warn(`'${title}' exists but headers differ: [${headers.join(' | ')}] vs expected [${EMPLOYEE_IDS_HEADERS.join(' | ')}] — not touching it.`);
    return;
  }

  report.add(`create tab '${title}' with ${EMPLOYEE_IDS_HEADERS.length} headers: ${EMPLOYEE_IDS_HEADERS.join(', ')}`);
  report.add(`style '${title}' header row (bold, #EB1C2D band, white text) and freeze row 1`);
  if (!apply) return;

  const add = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: { requests: [{ addSheet: { properties: { title, gridProperties: { rowCount: 1000, columnCount: EMPLOYEE_IDS_HEADERS.length, frozenRowCount: 1 } } } }] }
  });
  const sheetId = add.data.replies[0].addSheet.properties.sheetId;
  await sheets.spreadsheets.values.update({
    spreadsheetId: id, range: quoteRange(title, 'A1'), valueInputOption: 'RAW', requestBody: { values: [EMPLOYEE_IDS_HEADERS] }
  });
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: { requests: [{
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: EMPLOYEE_IDS_HEADERS.length },
        cell: { userEnteredFormat: HEADER_STYLE },
        fields: 'userEnteredFormat(backgroundColor,textFormat)'
      }
    }] }
  });
  meta.titles.push(title); // so --backfill in the same run sees it
}

// ---------------------------------------------------------------------------
// Step 3 — Raw Log headers
// ---------------------------------------------------------------------------

async function stepRawLog(ctx) {
  const { sheets, id, report, apply, meta } = ctx;
  const title = SHEETS.RAW_LOG;
  console.log(`\n--- 3. '${title}' — headers 'Event ID','Kind' at cols ${RAW_LOG_NEW_COL_START}-${RAW_LOG_NEW_COL_START + 1} ---`);

  if (!meta.titles.includes(title)) { report.noop(`'${title}' tab absent — RawLog.js creates it with all 7 headers on first write (no-op)`); return; }

  const headers = await getHeaderRow(sheets, id, title);
  if (headers.indexOf('Event ID') !== -1) {
    if (headers[5] === 'Event ID' && headers[6] === 'Kind') report.noop(`'${title}' already has 'Event ID','Kind' at cols 6-7 (no-op)`);
    else report.warn(`'${title}' has 'Event ID' at col ${headers.indexOf('Event ID') + 1} (expected 6) — efxEventsSince() reads by header name so this works, but it differs from RawLog.js.`);
    return;
  }
  // Sanity: the first five must be the known Raw Log headers
  const first5 = RAW_LOG_HEADERS.slice(0, 5);
  const okFirst5 = first5.every((h, i) => headers[i] === h);
  if (!okFirst5) { report.abort(`'${title}' cols 1-5 are [${headers.slice(0, 5).join(' | ')}], expected [${first5.join(' | ')}] — not a Raw Log we recognise.`); return; }
  const occupied = [headers[5], headers[6]].filter(Boolean);
  if (occupied.length) { report.abort(`'${title}' cols 6-7 already hold [${occupied.join(' | ')}] — refusing to overwrite.`); return; }

  report.add(`add headers 'Event ID','Kind' at '${title}'!F1:G1`);
  if (apply) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: id, range: quoteRange(title, 'F1:G1'), valueInputOption: 'RAW', requestBody: { values: [['Event ID', 'Kind']] }
    });
  }
}

// ---------------------------------------------------------------------------
// Step 4 — optional backfill from ID Setup Results
// ---------------------------------------------------------------------------

async function stepBackfill(ctx) {
  const { sheets, id, report, apply, meta } = ctx;
  console.log(`\n--- 4. --backfill '${SHEETS.EMPLOYEE_IDS}' from '${SHEETS.ID_SETUP_RESULTS}' ---`);

  if (!meta.titles.includes(SHEETS.EMPLOYEE_IDS)) {
    report.warn(`'${SHEETS.EMPLOYEE_IDS}' does not exist yet — run with --apply first (or in the same --apply run). Backfill skipped.`);
    return;
  }
  if (!meta.titles.includes(SHEETS.ID_SETUP_RESULTS)) { report.warn(`'${SHEETS.ID_SETUP_RESULTS}' tab not found — nothing to backfill.`); return; }

  const reg = await getAllValues(sheets, id, SHEETS.EMPLOYEE_IDS);
  const have = new Set(reg.slice(1).map(r => String(r[1] || '').trim()).filter(Boolean));

  const src = await getAllValues(sheets, id, SHEETS.ID_SETUP_RESULTS);
  const srcHeaders = (src[0] || []).map(v => String(v || '').trim());
  if (srcHeaders[IDS.INTERNAL_EMP_ID] !== 'Internal Employee ID') {
    report.abort(`'${SHEETS.ID_SETUP_RESULTS}' col ${IDS.INTERNAL_EMP_ID + 1} header is '${srcHeaders[IDS.INTERNAL_EMP_ID] || '(blank)'}', expected 'Internal Employee ID' — schema mismatch, backfill refused.`);
    return;
  }

  const rows = [];
  let skippedDup = 0, skippedBad = 0, maxId = 0;
  for (const r of src.slice(1)) {
    const wf = String(r[IDS.WORKFLOW_ID] || '').trim();
    const rawId = String(r[IDS.INTERNAL_EMP_ID] === undefined ? '' : r[IDS.INTERNAL_EMP_ID]).replace(/,/g, '').trim();
    const n = parseInt(rawId, 10);
    if (!wf || rawId === '' || isNaN(n)) { skippedBad++; continue; }
    if (have.has(wf)) { skippedDup++; continue; }
    if (n > maxId) maxId = n;
    rows.push([String(n), wf, '', String(r[IDS.SUBMISSION_TS] || ''), String(r[IDS.SUBMITTED_BY] || 'backfill'), 'backfill:ID Setup Results', '']);
    have.add(wf);
  }

  if (!rows.length) { report.noop(`nothing to backfill (${skippedDup} already registered, ${skippedBad} rows without a numeric id)`); return; }
  report.add(`append ${rows.length} row(s) to '${SHEETS.EMPLOYEE_IDS}' (max id seen ${maxId}; ${skippedDup} dup, ${skippedBad} skipped)`);
  rows.slice(0, 5).forEach(r => console.log(`    ${r[0]}  ${r[1]}  ${r[3]}  ${r[4]}`));
  if (rows.length > 5) console.log(`    … ${rows.length - 5} more`);

  if (apply) {
    // append in chunks of 500 to stay well under request limits
    for (let i = 0; i < rows.length; i += 500) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: id, range: quoteRange(SHEETS.EMPLOYEE_IDS, 'A1'), valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS', requestBody: { values: rows.slice(i, i + 500) }
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Verify (post-apply read-back)
// ---------------------------------------------------------------------------

async function verify(ctx) {
  const { sheets, id } = ctx;
  console.log('\n--- verify (read-back) ---');
  const meta = await getMeta(sheets, id);
  const titles = meta.sheets.map(s => s.properties.title);
  const ir = await getHeaderRow(sheets, id, SHEETS.INITIAL_REQUESTS);
  console.log(`  Initial Requests col 55 = '${ir[IR.BOSS_TRAINING_ONLY] || ''}'  col 56 = '${ir[IR.INTERNAL_EMP_ID] || ''}'`);
  if (titles.includes(SHEETS.EMPLOYEE_IDS)) {
    const eh = await getHeaderRow(sheets, id, SHEETS.EMPLOYEE_IDS);
    const rows = await getAllValues(sheets, id, SHEETS.EMPLOYEE_IDS);
    console.log(`  Employee IDs headers = [${eh.join(' | ')}]  data rows = ${Math.max(rows.length - 1, 0)}`);
  } else console.log('  Employee IDs tab: absent');
  if (titles.includes(SHEETS.RAW_LOG)) {
    const rh = await getHeaderRow(sheets, id, SHEETS.RAW_LOG);
    console.log(`  Raw Log headers = [${rh.join(' | ')}]`);
  } else console.log('  Raw Log tab: absent (created on first write)');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { usage(); return; }
  if (!opts.sheet) die('--sheet <spreadsheetId> is required (use --help)', 1);

  if (opts.sheet === PROD_SHEET_ID && !opts.iKnowProd) {
    die(`Refusing: ${opts.sheet} is the LIVE PROD spreadsheet. Re-run with --i-know-this-is-prod only during the scheduled prod migration.`, 3);
  }

  console.log('='.repeat(72));
  console.log('  EFX sheet migration (Node twin of MigrationTools.migrateEfx)');
  console.log(`  Mode:   ${opts.apply ? '*** APPLY — headers/tabs will be written ***' : 'DRY RUN (reads only)'}`);
  console.log(`  Sheet:  ${opts.sheet}${opts.sheet === PROD_SHEET_ID ? '   <<< PROD (override given) >>>' : ''}`);
  console.log(`  Extras: ${opts.backfill ? '--backfill' : '(no backfill)'}`);
  console.log('='.repeat(72));

  const { client, who } = await getAuthClient(opts);
  console.log(`  Auth:   ${who}`);
  const sheets = loadGoogle().sheets({ version: 'v4', auth: client });

  let metaRaw;
  try { metaRaw = await getMeta(sheets, opts.sheet); }
  catch (e) {
    const code = e.code || (e.response && e.response.status);
    const err = (e.response && e.response.data && e.response.data.error) || {};
    const reasons = []
      .concat((err.errors || []).map(x => x.reason))
      .concat((err.details || []).map(x => x.reason))
      .filter(Boolean).join(',');
    if (code === 403 && /SCOPE_INSUFFICIENT|insufficientPermissions/.test(reasons) && !opts.key) {
      die('403 ACCESS_TOKEN_SCOPE_INSUFFICIENT — your Application Default Credentials lack the Sheets scope. Re-auth:\n' +
          '    gcloud auth application-default login --scopes=https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/cloud-platform\n' +
          '    gcloud auth application-default set-quota-project <gcp-project-with-sheets-api-enabled>\n' +
          '  or pass --key <service-account.json> [--impersonate efx-bot@team-group.com].', 1);
    }
    if (code === 403 && /SERVICE_DISABLED|accessNotConfigured/.test(reasons)) {
      die(`403 Sheets API not enabled in the quota project — gcloud services enable sheets.googleapis.com --project <id>  (${err.message || ''})`, 1);
    }
    if (code === 403) die(`403 from Sheets API (${reasons || err.message || 'no reason given'}) — share the spreadsheet (Editor) with the identity shown under Auth.`, 1);
    if (code === 404) die('404 — spreadsheet id not found (or not visible to this identity).', 1);
    throw e;
  }
  const meta = { title: metaRaw.properties.title, titles: metaRaw.sheets.map(s => s.properties.title) };
  console.log(`  Title:  "${meta.title}"`);
  console.log(`  Tabs:   ${meta.titles.length} — ${meta.titles.join(', ')}`);

  const report = new Report(opts.apply);
  if (!/EFX TEST/i.test(meta.title) && opts.sheet !== PROD_SHEET_ID) {
    report.warn(`title does not contain 'EFX TEST' — confirm this is the intended copy before --apply.`);
  }

  const ctx = { sheets, id: opts.sheet, apply: opts.apply, report, meta };

  // Steps 1 and 3 carry the abort conditions (schema surprises). Each step only writes its own cells,
  // so an abort in step 3 after a step-1 write leaves a consistent, re-runnable state (idempotent).
  await stepInitialRequests(ctx);
  await stepRawLog(ctx);

  if (report.aborts) {
    console.log('\n' + '='.repeat(72));
    console.log(`  ABORTED — ${report.aborts} blocking condition(s). ${opts.apply ? 'Any header already written above stays (harmless, additive); fix the condition and re-run.' : 'Nothing was written.'}`);
    console.log('='.repeat(72));
    process.exit(2);
  }

  await stepEmployeeIds(ctx);            // never aborts; creates the tab (or reports no-op)
  if (opts.backfill) await stepBackfill(ctx);

  if (opts.apply) await verify(ctx);

  console.log('\n' + '='.repeat(72));
  if (opts.apply) {
    console.log(`  APPLIED — ${report.adds} change(s), ${report.warns} warning(s).`);
    console.log('  Next: in the Apps Script editor run efxSelfTest() and check n8n_ping().result.spreadsheetId matches this sheet.');
  } else {
    console.log(`  DRY RUN complete — ${report.adds} change(s) would be made, ${report.warns} warning(s). Nothing written.`);
    console.log('  Re-run with --apply to write.');
  }
  console.log('  Rollback: delete the added header cell(s) / the Employee IDs tab. No data cells were touched.');
  console.log('='.repeat(72));
  if (report.warns) process.exitCode = 0; // warnings are informational
}

main().catch(err => {
  const msg = (err && err.response && err.response.data && JSON.stringify(err.response.data)) || err.message || String(err);
  console.error('\nFatal:', msg);
  process.exit(1);
});
