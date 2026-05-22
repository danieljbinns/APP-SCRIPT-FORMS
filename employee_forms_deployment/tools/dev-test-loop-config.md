# Dev Test Loop — Autonomous Agent Config
# DEV ONLY — never touch prod

## Script IDs
- Dev script ID: `1VI9tR0GCxwTmcuXiGBzTkDJVXXB94Hr3PpdnuDq-aBpDKKQGMKhA9U_L`
- Dev /dev URL: `https://script.google.com/a/team-group.com/macros/s/AKfycbyKdavUuqgt2zRFxxbRgwSbqru_3HLxk5oEYUauBukRL2CZ28bwZtYUZhubs3d3NoMnUQ/dev`
- OAuth token: `D:\Credentials\google\binns-claude-desktop\gas-run-token.json`
- Dev folder: `P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_deployment\employee_management_v2_dev\`
- Result file: `D:\Credentials\google\binns-claude-desktop\gas_last_result.json`

## Token refresh (use on 401)
```
curl -s -X POST "https://oauth2.googleapis.com/token" \
  -d "client_id=<CLIENT_ID>&client_secret=<CLIENT_SECRET>&refresh_token=<REFRESH_TOKEN>&grant_type=refresh_token"
```
Update `access_token` in the token file after refresh.

## GAS API call pattern
```
curl -s -X POST "https://script.googleapis.com/v1/scripts/<scriptId>:run" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"function":"<fn>","devMode":true}' \
  --max-time 300
```

---

## Loop Steps (in order)

### Step 1 — Cleanup
`cleanupAllTestWorkflows()` — wait for done.

### Step 2 — SuperDebug suites (sequential, 300s timeout each)
1. `runSuperDebugNewHire()`
2. `runSuperDebugEOE()`
3. `runSuperDebugStatusChange_Title()`
4. `runSuperDebugStatusChange_Site()`
5. `runSuperDebugStatusChange_Full()`
6. `runSuperDebugEquipment()`

Collect all failures. If any fail > 0 → Fix Loop (see below).

### Step 3 — Browser Tests
Read `P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_deployment\tools\browser-test-spec.md`
Execute every test case (TC-01 through TC-10) using Chrome MCP tools.
Record pass/fail per TC.
Any TC fail → Fix Loop.

### Step 4 — Fix Loop (if failures from Step 2 or 3)
1. Read failing GAS files / browser console errors
2. Identify root cause
3. Fix code in dev folder
4. `clasp push --force` from dev folder
5. Wait 5 seconds
6. `cleanupAllTestWorkflows()`
7. Re-run failing suites / browser TCs
8. Repeat until 0 failures

### Step 5 — Email on completion
When all 6 SuperDebug suites pass AND all 10 browser TCs pass:
- Send email to dbinns@team-group.com
- Subject: `Dev Test Loop Complete ✅ — All Suites + Browser Tests Pass`
- Body: suite-by-suite results, browser TC results, any fixes applied
- Write final JSON to result file

---

## Fix loop rules
- DEV ONLY — never call prod functions or edit prod files
- After any code fix, always re-run cleanup before re-running suites
- If a fix attempt fails 3 times on the same issue, stop and email a BLOCKED notice instead of looping forever

---

## clasp push command
```
cd "P:/Repos/github/danieljbinns/APP SCRIPT FORMS/employee_forms_deployment/employee_management_v2_dev" && clasp push --force
```
