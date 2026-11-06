# Dev-Only Files — Do Not Deploy to Prod

Files in this list exist in `employee_management_v2_dev` but must be **excluded from any production push**.
Clasp pushes the entire folder, so these must be physically removed from the prod push folder before running `clasp push` against prod.

---

## Files to Exclude from Prod Push

| File | Reason |
|------|--------|
| `MigrationTools.js` | Contains `wipeDevSheets()`, `migrateFromProd()`, `migrateInitialRequests()`, `migrateActionItems()`, `buildDashboardView()`. Running any of these against prod would be destructive. Dev-only migration utility — run from the GAS editor manually. |
| `GeoCities.html` | Marked `DEV ONLY` at line 1. Dev analytics/easter-egg overlay included in all pages. Remove `<?!= include('GeoCities') ?>` from all pages OR exclude this file before prod push. |
| `GeoCitiesStats.js` | Backend stats aggregator for GeoCities. No prod purpose. |
| `TestRunner.js` | End-to-end workflow test harness. Sets `EMAIL_REDIRECT_ALL` to dbinns, chains all handler submissions, closes action items. Has `_assertDevOnly()` guard but exclude from prod anyway. |

---

## Notes

- `Setup.js` — run-once scaffolding. Safe to include in prod; needed for initial sheet setup on any new deployment.
- `manuallySyncAllWorkflows()` in `StateSync.js` — manual admin trigger. Safe to include; used to repair Dashboard_View after data fixes.
- `docs/` folder — never deployed by Apps Script (clasp ignores non-.js/.html files in subfolders). No action needed.

---

## Prod Push Checklist

Before running `clasp push` against prod:
1. Copy `employee_management_v2_dev` to a temp folder
2. Delete `MigrationTools.js`, `GeoCities.html`, `GeoCitiesStats.js`, `TestRunner.js` from the temp folder
3. Remove `<?!= include('GeoCities') ?>` from all HTML files in temp folder
4. Set `MAINTENANCE_MODE = false` in `Router.js`
5. Push from the temp folder using prod `.clasp.json`
