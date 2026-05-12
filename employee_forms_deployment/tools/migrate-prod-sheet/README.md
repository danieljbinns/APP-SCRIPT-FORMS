# Prod Sheet Migration

One-time Node.js script that upgrades the prod Google Sheet from the v2 format to the v2_dev format, without touching the live Apps Script deployment.

## What it does

1. **Adds missing columns** to existing sheets (Workflows, Initial Requests, ID Setup Results, HR Verification Results, IT Results)
2. **Creates 8 new tabs** with correct headers (Action Items, Dashboard_View, Terminations, Position Changes, Termination Approval Results, Position Change Approval Results, Equipment_Requests, Form Edit Log)
3. **Migrates legacy specialist data** into the unified Action Items sheet as closed historical records:
   - Credit Card Results
   - Business Cards Results
   - Fleetio Results
   - JONAS Results
   - SiteDocs Results
   - 30-60-90 Review Results

The script **never modifies or deletes** any existing row. It is safe to re-run (duplicate guard skips already-migrated records).

---

## Setup

### 1. Service Account

You need a Google service account with access to the spreadsheet.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → the GCP project linked to your prod Apps Script
2. IAM & Admin → Service Accounts → Create Service Account
3. Grant no roles (just click through)
4. Download a JSON key for that service account
5. Save the key file as `tools/migrate-prod-sheet/service-account.json` (it's gitignored)
6. Open the prod Google Sheet → Share → paste the service account email → Editor access

### 2. Install dependencies

```bash
cd tools/migrate-prod-sheet
npm install
```

---

## Run order

### Step 0: Make a copy of the prod spreadsheet

In Google Sheets: **File → Make a copy** — give it a name like "Prod Sheet — Migration Test Copy". Copy the spreadsheet ID from the URL.

### Step 1: Dry run against the copy

```bash
cd tools/migrate-prod-sheet
SHEET_ID=<copy-spreadsheet-id> node index.js --dry-run
```

Review the output. Confirm:
- Row counts to migrate per sheet look right
- New sheets to be created are listed
- Missing columns per existing sheet are listed

### Step 2: Execute against the copy

```bash
SHEET_ID=<copy-spreadsheet-id> node index.js --execute
```

Then open the copy in Sheets and verify:
- Action Items tab has rows equal to the sum of all 6 legacy sheet data rows
- All 8 new tabs exist with correct headers
- Old specialist tabs are untouched
- Spot-check 2-3 Action Items: Workflow ID matches source, Status = Closed, Form Data JSON has original details

### Step 3: Execute against real prod (when ready)

```bash
SHEET_ID=<real-prod-spreadsheet-id> node index.js --execute
```

### Step 4: After deploying new prod code

Once the new GAS code is live, open the Apps Script editor and run `rebuildAllDashboard()` once to populate the Dashboard_View tab for all existing workflows.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `SHEET_ID environment variable is required` | Set `SHEET_ID=...` before `node index.js` |
| `Error: Could not load the default credentials` | `service-account.json` is missing or invalid |
| `403 Forbidden` | Share the spreadsheet with the service account email (Editor) |
| `400 Bad Request` on getSheetValues | Sheet tab name doesn't exist — check spelling |
