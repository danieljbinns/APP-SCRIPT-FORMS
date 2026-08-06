# PROD Deploy Runbook — JR Title feature + backlog

**Prod script:** `1AuIbJl1jRh1awi-MW-6y_NftHUGtfUNRexZk1gPzvenmIblSZo-lPz66`
**Prod folder:** `employee_management_v2/`  ·  **Dev folder:** `employee_management_v2_dev/`
**Runner:** `python D:/Credentials/google/binns-claude-desktop/gas_runner.py <fn> --env prod` (token has prod access; prod `executionApi.access=ANYONE`).

Goal: bring the dev code (backlog + JR split + doPost/completeMyTask) to prod, stand up the prod portal-automation endpoint, and repoint George's clone at prod. Reversible.

---

## 0. Pre-flight (do NOT skip)
- [ ] George's 6 pending prod accounts are done (he's setting up now).
- [ ] Confirm prod Script Properties are prod-correct (via runner or Apps Script UI):
  - `SPREADSHEET_ID` → the **prod** spreadsheet (`1kGjw8e-uIehaBemlsRZ4Yq1QrYOWkJvWzhKbgfl4Pxo`), NOT the dev default.
  - `EMAIL_REDIRECT_ALL` → **empty** (prod sends real mail). `SUPPRESS_EMAILS_OVERRIDE` → empty.
- [ ] **Rollback anchor:** record current prod web-app deployment id + version:
  `cd employee_management_v2 && clasp list-deployments`  → note the `@NN` of the live web-app deployment. If the push breaks prod, redeploy that deployment to the recorded version.

## 1. Merge dev → prod folder (env-safe)
`ConfigurationService.js` and `appsscript.json` are already identical dev/prod (prod overrides IDs via Script Properties, and already has `executionApi:ANYONE` + AdminDirectory + scopes). `.clasp.json` = prod's, never touch.

Copy the env-NEUTRAL files (from repo root):
```bash
cd "P:/Repos/github/danieljbinns/APP SCRIPT FORMS/employee_forms_deployment"
for f in ActionItemForm.html ChangeNotify.js Dashboard.html DashboardDataHandler.js EmailTemplates.js EmailUtils.js EquipmentRequestHandler.js HRVerification.html HRVerificationHandler.js ITConfirmationHandler.js ITSetup.html ITSetupHandler.js InitialRequest.html InitialRequestHandler.js PositionChangeHandler.js RequestActionsHandler.js RequestDetails.html RequestDetailsHandler.js RequestHeader.html Router.js SchemaConstants.js Services/AccessControlService.js Services/ActionItemService.js SharedComponents.html StateSync.js Styles.html TerminationHandler.js TerminationRequest.html WorkflowManager.js SuperDebug.js ProdSmokeTest.js Setup.js MigrationTools.js SubsidiaryDiscoverySurvey.html; do
  cp "employee_management_v2_dev/$f" "employee_management_v2/$f"; done
```
**Config.js — special:** copy dev's, then force PROD env + keep prod ADMIN_EMAILS if desired:
```bash
cp employee_management_v2_dev/Config.js employee_management_v2/Config.js
sed -i "s/const ENVIRONMENT = 'DEV';/const ENVIRONMENT = 'PROD';/" employee_management_v2/Config.js
grep -n "const ENVIRONMENT" employee_management_v2/Config.js   # verify = 'PROD'
```
Syntax check:
```bash
cd employee_management_v2 && for f in $(git -C .. diff --name-only | grep employee_management_v2/ | grep '\.js$'); do node --check "../$f" || echo "ERR $f"; done
```

## 2. Push to prod + version
```bash
cd "P:/Repos/github/danieljbinns/APP SCRIPT FORMS/employee_forms_deployment/employee_management_v2"
clasp push -f
clasp deploy -i <PROD_WEBAPP_DEPLOYMENT_ID> -d "JR Title feature + backlog merge"
```
(Use the web-app deployment id from step 0. This updates the portal users see.)

## 3. Prod sheet columns (additive — safe)
Append to the **prod** spreadsheet (`1kGjw8e...`):
- `ID Setup Results` → new last column header **`BOSS WIS Created`**
- `IT Results` → new last column header **`Submitted By`**
(Terminations already has `Computer Serial@10` on prod — no change. Do NOT insert mid-sheet.)

## 4. Prod portal-automation endpoint (the doPost)
- [ ] Set a **fresh** prod secret (256-bit):
  `python -c "import secrets;print(secrets.token_hex(32))"` → then `setPortalSecret('<that>')` on prod (via runner, params).
- [ ] Stand up an **ANYONE_ANONYMOUS** deployment on the prod script for doPost:
  temporarily set `employee_management_v2/appsscript.json` webapp.access → `ANYONE_ANONYMOUS`, `clasp push`, `clasp deploy -d "prod JR portal automation endpoint"`, record the new `/macros/s/<id>/exec` URL, then **revert** appsscript.json → `DOMAIN` and `clasp push` (re-lock the portal). Prefer splitting this into its own tiny script long-term.

## 5. Repoint George's clone → prod
n8n workflow `yFfGBQFG7COFDOjk`, node **"Mark Portal JR Complete"**: swap `url` → the prod anon URL (step 4) and the `secret` in the body → the prod secret. (Use POST-rebuild, not PUT — PUT silently won't replace nodes.)

## 6. Verify on prod
- [ ] `python gas_runner.py runProdSmokeTest --env prod` → expect 4/4 (writes to its own DEV test sheet + suppresses; safe).
- [ ] Curl prod anon URL with a **bad** secret → `{"success":false,"message":"Unauthorized"}` (endpoint live).
- [ ] Real check: a prod JR task (from George's real submission) → clone closes it → `closedBy: "JR Automation (n8n)"`, step tracker shows JR Title = Complete.

## 7. Rollback (if needed)
`cd employee_management_v2 && clasp deploy -i <PROD_WEBAPP_DEPLOYMENT_ID> -d "rollback"` pinned to the pre-deploy version recorded in step 0. Sheet columns added in step 3 are additive (harmless to leave).

---
**Validated pre-merge (dev):** 312/0 field-map, 159/0 super-test, 193/0 live SuperDebug (all 4 workflows), ProdSmokeTest 4/4, JR n8n loop end-to-end. Terminations schema hazard resolved. See [[jr-portal-automation-endpoint]], [[sheet-access-name-vs-index]] in memory.
