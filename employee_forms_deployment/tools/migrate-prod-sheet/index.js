/**
 * migrate-prod-sheet/index.js
 *
 * One-time migration: transforms a prod Google Sheet from v2 format to v2_dev format.
 *
 * Usage:
 *   SHEET_ID=<spreadsheet-id> node index.js --dry-run    ← preview only, no writes
 *   SHEET_ID=<spreadsheet-id> node index.js --execute    ← apply all changes
 *
 * Always run --dry-run first against a copy of the spreadsheet before --execute on prod.
 */

'use strict';

const { google } = require('googleapis');
const { randomUUID } = require('crypto');
const {
  EXISTING_SHEET_SCHEMAS,
  NEW_SHEET_SCHEMAS,
  LEGACY_SPECIALIST_MAP,
  LEGACY_COL,
  ACTION_ITEMS_COL
} = require('./schema');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SHEET_ID = process.env.SHEET_ID;
const DRY_RUN = !process.argv.includes('--execute');

if (!SHEET_ID) {
  console.error('ERROR: SHEET_ID environment variable is required.');
  console.error('  Example: SHEET_ID=1BxiM... node index.js --dry-run');
  process.exit(1);
}

console.log('');
console.log('='.repeat(60));
console.log('  Prod Sheet Migration');
console.log('  Mode:     ' + (DRY_RUN ? 'DRY RUN (no writes)' : '*** EXECUTE — changes will be applied ***'));
console.log('  Sheet ID: ' + SHEET_ID);
console.log('='.repeat(60));
console.log('');

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: './service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return auth.getClient();
}

// ---------------------------------------------------------------------------
// Sheets helpers
// ---------------------------------------------------------------------------

async function getSheetMetadata(sheets) {
  const res = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  return res.data.sheets.map(s => s.properties);
}

async function getSheetValues(sheets, sheetName) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: sheetName
    });
    return res.data.values || [];
  } catch (e) {
    if (e.code === 400) return null; // sheet doesn't exist
    throw e;
  }
}

async function appendRow(sheets, sheetName, row) {
  if (DRY_RUN) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: sheetName + '!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] }
  });
}

async function updateRow(sheets, sheetName, rowIndex, row) {
  // rowIndex is 1-based (as in Sheets API)
  if (DRY_RUN) return;
  const colLetter = columnLetter(row.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: sheetName + '!A' + rowIndex + ':' + colLetter + rowIndex,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] }
  });
}

async function createSheet(sheets, title) {
  if (DRY_RUN) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title } } }]
    }
  });
}

function columnLetter(n) {
  // Convert 1-based column number to A, B, ... Z, AA, AB ...
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function generateTaskId() {
  return 'TK-MIG-' + randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase();
}

// ---------------------------------------------------------------------------
// Step 1: Add missing columns to existing sheets
// ---------------------------------------------------------------------------

async function addMissingColumns(sheets) {
  console.log('--- Step 1: Add missing columns to existing sheets ---');
  let totalAdded = 0;

  for (const [sheetName, expectedHeaders] of Object.entries(EXISTING_SHEET_SCHEMAS)) {
    const values = await getSheetValues(sheets, sheetName);
    if (!values || values.length === 0) {
      console.log('  [' + sheetName + '] WARNING: sheet not found or empty — skipping');
      continue;
    }

    const existingHeaders = (values[0] || []).map(h => String(h).trim());
    const missing = expectedHeaders.filter(h => !existingHeaders.includes(h));

    if (missing.length === 0) {
      console.log('  [' + sheetName + '] OK — no missing columns');
      continue;
    }

    console.log('  [' + sheetName + '] Adding ' + missing.length + ' column(s): ' + missing.join(', '));

    if (!DRY_RUN) {
      // Append missing headers to the existing header row
      const newHeaders = existingHeaders.concat(missing);
      await updateRow(sheets, sheetName, 1, newHeaders);
    }

    totalAdded += missing.length;
  }

  console.log('  Total columns to add: ' + totalAdded + (DRY_RUN ? ' (dry run)' : ' (applied)'));
  console.log('');
}

// ---------------------------------------------------------------------------
// Step 2: Create missing new sheets
// ---------------------------------------------------------------------------

async function createMissingSheets(sheets, existingSheetNames) {
  console.log('--- Step 2: Create missing new sheets ---');

  for (const [sheetName, headers] of Object.entries(NEW_SHEET_SCHEMAS)) {
    if (existingSheetNames.includes(sheetName)) {
      console.log('  [' + sheetName + '] Already exists — skipping');
      continue;
    }

    console.log('  [' + sheetName + '] ' + (DRY_RUN ? 'WOULD CREATE' : 'Creating') + ' (' + headers.length + ' columns)');

    if (!DRY_RUN) {
      await createSheet(sheets, sheetName);
      await updateRow(sheets, sheetName, 1, headers);
    }
  }

  console.log('');
}

// ---------------------------------------------------------------------------
// Step 3: Migrate legacy specialist sheets → Action Items
// ---------------------------------------------------------------------------

async function migrateSpecialistSheets(sheets, existingSheetNames) {
  console.log('--- Step 3: Migrate legacy specialist sheets → Action Items ---');

  // Load existing Action Items to build duplicate-check set
  const actionItemsValues = await getSheetValues(sheets, 'Action Items');
  // Key: "workflowId|formType"
  const existingKeys = new Set();
  if (actionItemsValues && actionItemsValues.length > 1) {
    for (let i = 1; i < actionItemsValues.length; i++) {
      const row = actionItemsValues[i];
      const wfId = (row[ACTION_ITEMS_COL.WORKFLOW_ID] || '').trim();
      const ft   = (row[ACTION_ITEMS_COL.FORM_TYPE]   || '').trim();
      if (wfId && ft) existingKeys.add(wfId + '|' + ft);
    }
  }

  let totalMigrated = 0;
  let totalSkipped = 0;
  const now = new Date().toISOString();

  for (const mapping of LEGACY_SPECIALIST_MAP) {
    const { sheetName, category, formType, taskName, assignedTo } = mapping;

    if (!existingSheetNames.includes(sheetName)) {
      console.log('  [' + sheetName + '] Not found in spreadsheet — skipping');
      continue;
    }

    const values = await getSheetValues(sheets, sheetName);
    if (!values || values.length <= 1) {
      console.log('  [' + sheetName + '] Empty (no data rows) — skipping');
      continue;
    }

    const dataRows = values.slice(1); // skip header
    let migrated = 0;
    let skipped = 0;

    for (const row of dataRows) {
      const workflowId = (row[LEGACY_COL.WORKFLOW_ID] || '').trim();
      if (!workflowId) { skipped++; continue; }

      const dupKey = workflowId + '|' + formType;
      if (existingKeys.has(dupKey)) { skipped++; continue; }

      const timestamp = row[LEGACY_COL.TIMESTAMP] || now;
      const formId    = row[LEGACY_COL.FORM_ID]    || '';
      const details   = row[LEGACY_COL.DETAILS]    || '';
      const notes     = row[LEGACY_COL.NOTES]      || '';
      const submittedBy = row[LEGACY_COL.SUBMITTED_BY] || '';

      const taskId = generateTaskId();
      const description = JSON.stringify([
        'Migrated from legacy ' + sheetName + ' — see Form Data for original record'
      ]);
      const formData = JSON.stringify({
        formId,
        details,
        notes,
        submittedBy,
        migratedAt: now,
        migratedFrom: sheetName
      });

      const actionItemRow = [
        workflowId,   // Workflow ID
        taskId,       // Task ID
        category,     // Category
        taskName,     // Task Name
        description,  // Description
        assignedTo,   // Assigned To
        'Closed',     // Status
        timestamp,    // Created Date
        timestamp,    // Completed Date
        notes,        // Notes
        submittedBy,  // Closed By
        '',           // Draft
        formType,     // Form Type
        formData      // Form Data
      ];

      await appendRow(sheets, 'Action Items', actionItemRow);
      existingKeys.add(dupKey); // prevent re-processing within same run
      migrated++;
    }

    console.log('  [' + sheetName + '] ' + (DRY_RUN ? 'WOULD MIGRATE' : 'Migrated') + ' ' + migrated + ' row(s)' + (skipped > 0 ? ', ' + skipped + ' skipped (duplicate/empty)' : ''));
    totalMigrated += migrated;
    totalSkipped += skipped;
  }

  console.log('  Total: ' + totalMigrated + ' row(s) migrated' + (totalSkipped > 0 ? ', ' + totalSkipped + ' skipped' : '') + (DRY_RUN ? ' (dry run)' : ' (applied)'));
  console.log('');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  const sheetMeta = await getSheetMetadata(sheets);
  const existingSheetNames = sheetMeta.map(s => s.title);

  console.log('Sheets currently in spreadsheet: ' + existingSheetNames.join(', '));
  console.log('');

  await addMissingColumns(sheets);
  await createMissingSheets(sheets, existingSheetNames);
  await migrateSpecialistSheets(sheets, existingSheetNames);

  console.log('='.repeat(60));
  if (DRY_RUN) {
    console.log('  DRY RUN complete — no changes were made.');
    console.log('  Review the output above, then run with --execute to apply.');
  } else {
    console.log('  Migration complete.');
    console.log('');
    console.log('  Next step: after deploying new prod code, open the Apps');
    console.log('  Script editor and run rebuildAllDashboard() once to');
    console.log('  populate the Dashboard_View tab for existing workflows.');
  }
  console.log('='.repeat(60));
  console.log('');
}

main().catch(err => {
  console.error('Fatal error:', err.message || err);
  process.exit(1);
});
