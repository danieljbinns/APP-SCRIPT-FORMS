#!/usr/bin/env node
/**
 * add-missing-headers.js — Node twin of MigrationTools.js::migrateAddMissingHeaders()
 *
 * Sets two headers that older Employee Forms spreadsheets are missing. Both are
 * PRECONDITIONS of the EFX migration: migrate-efx-sheet.js aborts if 'Initial Requests'
 * column 55 is not exactly 'BOSS Training User Only'.
 *
 *   'Initial Requests' col 55 (BC)  <- 'BOSS Training User Only'   SCHEMA.INITIAL_REQUESTS.BOSS_TRAINING_ONLY = 54 (0-based)
 *   'IT Results'       col 23 (W)   <- 'BOSS Details'              SCHEMA.IT_RESULTS.BOSS_DETAILS          = 22 (0-based)
 *
 * Mirrors ensureHeader() exactly:
 *   - column beyond the sheet width  -> write it (extends the sheet)
 *   - cell empty                     -> write it
 *   - cell already the expected text -> no-op
 *   - cell holds ANYTHING ELSE       -> WARN and DO NOT overwrite
 *
 * Only ever touches row 1. Never reads or writes a data cell.
 *
 * USAGE
 *   node add-missing-headers.js --sheet <id> [--key <sa.json>] [--impersonate <user>] [--apply]
 *
 *   Default is DRY-RUN. Add --apply to write.
 *
 * AUTH (same precedence as migrate-efx-sheet.js)
 *   --key <path>                 service-account JSON; the SA must be an editor on the sheet
 *   --key <path> --impersonate   mints a DWD token AS that user; the sheet must be shared with them
 *   (neither)                    Application Default Credentials
 *
 * SAFETY
 *   Refuses the PROD spreadsheet id unless --i-know-this-is-prod is also given.
 */

'use strict';

const fs = require('fs');

let google;
try { google = require('googleapis').google; }
catch (e) { console.error('Missing dependency. Run: npm install'); process.exit(1); }

const PROD_ID = '1kGjw8e-uIehaBemlsRZ4Yq1QrYOWkJvWzhKbgfl4Pxo';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// sheet, 1-based column, expected header
const HEADERS = [
  { sheet: 'Initial Requests', col: 55, text: 'BOSS Training User Only' },
  { sheet: 'IT Results',       col: 23, text: 'BOSS Details' }
];

function die(msg, code) { console.error('\n  x  ' + msg + '\n'); process.exit(code === undefined ? 1 : code); }

function colName(n) {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function parseArgs(argv) {
  const o = { apply: false, prodOk: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) die('Missing value for ' + a);
      i++; return v;
    };
    if (a === '--sheet') o.sheet = next();
    else if (a === '--key') o.key = next();
    else if (a === '--impersonate') o.impersonate = next();
    else if (a === '--apply') o.apply = true;
    else if (a === '--i-know-this-is-prod') o.prodOk = true;
    else if (a === '--help' || a === '-h') { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]); process.exit(0); }
    else die('Unknown argument: ' + a);
  }
  if (!o.sheet) die('--sheet <spreadsheetId> is required');
  if (o.sheet === PROD_ID && !o.prodOk) die('That is the PROD spreadsheet. Re-run with --i-know-this-is-prod if you really mean it.', 2);
  if (o.impersonate && !o.key) die('--impersonate requires --key');
  return o;
}

async function makeAuth(o) {
  if (o.key) {
    const creds = JSON.parse(fs.readFileSync(o.key, 'utf8'));
    const jwt = new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: SCOPES,
      subject: o.impersonate || undefined
    });
    await jwt.authorize();
    return jwt;
  }
  return new google.auth.GoogleAuth({ scopes: SCOPES }).getClient();
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const auth = await makeAuth(o);
  const api = google.sheets({ version: 'v4', auth });

  const meta = await api.spreadsheets.get({ spreadsheetId: o.sheet, fields: 'properties.title,sheets.properties.title' });
  const title = meta.data.properties.title;
  const tabs = meta.data.sheets.map(s => s.properties.title);

  console.log('\n  spreadsheet : ' + title);
  console.log('  id          : ' + o.sheet);
  console.log('  mode        : ' + (o.apply ? 'APPLY' : 'DRY-RUN (no writes)'));
  if (o.impersonate) console.log('  acting as   : ' + o.impersonate);
  if (!/EFX TEST/i.test(title) && o.sheet !== PROD_ID) console.log('  !  title does not contain "EFX TEST"');
  console.log('');

  let changed = 0, warned = 0;

  for (const h of HEADERS) {
    const label = h.sheet + '!' + colName(h.col) + '1';
    if (tabs.indexOf(h.sheet) === -1) { console.log('  =  SKIP   ' + label + ' — tab not found'); continue; }

    const range = "'" + h.sheet + "'!" + colName(h.col) + '1';
    const res = await api.spreadsheets.values.get({ spreadsheetId: o.sheet, range });
    const cur = (res.data.values && res.data.values[0] && res.data.values[0][0]) || '';

    if (cur === h.text) { console.log('  =  OK     ' + label + ' already "' + h.text + '"'); continue; }

    if (cur !== '') {
      console.log('  !  WARN   ' + label + ' holds "' + cur + '" — NOT overwriting');
      warned++; continue;
    }

    if (o.apply) {
      await api.spreadsheets.values.update({
        spreadsheetId: o.sheet, range, valueInputOption: 'RAW',
        requestBody: { values: [[h.text]] }
      });
      console.log('  +  SET    ' + label + ' = "' + h.text + '"');
    } else {
      console.log('  +  WOULD  ' + label + ' = "' + h.text + '"');
    }
    changed++;
  }

  console.log('');
  if (warned) {
    console.log('  ' + warned + ' warning(s) — a header cell holds unexpected text. Investigate before migrating.');
    process.exit(3);
  }
  if (!changed) console.log('  Nothing to do — both headers already correct.');
  else if (!o.apply) console.log('  Dry run only. Re-run with --apply to write ' + changed + ' header(s).');
  else console.log('  Done — ' + changed + ' header(s) written. Re-run to confirm no-op.');
  console.log('');
}

main().catch(e => die(e && e.message ? e.message : String(e)));
