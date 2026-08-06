# E2E Findings — Workflow A (New Hire), real browser

**Run date:** 2026-06-18
**Workflow:** `NEW_EMP_20260618-153644_860` (TestFirst TestLast, Salary, Aurora)
**Method:** real deployed dev web app driven via Playwright→CDP against an authenticated
containerized Chrome (`chrome-authbox`). No mocks, no Apps Script Execution API.
**Dev spreadsheet:** `1KeWBbh8755mRXFSK2dCeSW75djpaPgtprbmqd7BAsMA`

## Actual workflow chain (verified)
Initial Request → **ID Setup** → HR Verification → **IT Confirmation** → IT Setup →
5 parallel specialist action items (WIS, Safety, Business Cards, 30/60/90, IT Confirmation)
→ **Complete**.

Every step verified: captured `google.script.run` payload → results sheet row → Workflows
status transition → Dashboard_View → redirected emails.

| Step | RPC | Results sheet | Workflow step after |
|------|-----|---------------|---------------------|
| Initial Request | `submitInitialRequest` | Initial Requests r325 | ID Setup Needed |
| ID Setup | `submitEmployeeIDSetup` | ID Setup Results r312 | HR Verification Needed |
| HR Verification | `submitHRVerification` | HR Verification Results r297 | IT Confirmation Needed |
| IT Confirmation | `submitITConfirmation` | (review) | IT Setup Needed |
| IT Setup | `submitITSetup` | IT Results r49 | Specialist Forms Needed |
| 5 action items | `closeActionItemWithNotes` ×5 | Action Items r351–355 Closed | Complete |

## Discrepancies vs NEW_SESSION_PROMPT.md (test plan is inaccurate)
1. **Checkbox names**: `systems[]`/`equipment[]` are wrong — real DOM names are `systems` / `equipment` (no brackets). The prompt's scripts would silently select nothing.
2. **`siteName: "Ottawa Main"` does not exist** — valid options: Aurora, Blue Bird Corporation, Decostar Industries, Eastern Janitorial, GM CAMI Assembly, …
3. **`computerType: "Laptop"` invalid** — New Hire radios are `Chromebook`/`Windows`/`Mac`; IT Setup `Computer_Type` select is `Chromebook`/`Windows PC`/`Mac`.
4. **Missing required fields** the prompt never fills → native validation silently blocks submit: `jobSiteNumber` (always required, cascades off siteName); `adpSites` & `purchasingSites` become required when ADP Supervisor / Central Purchasing-Jonas are checked.
5. **IT Setup access fields are checkboxes**, not Yes/No values: `Incidents_Access`, `CAA_Access`, `Delivery_App_Access`, `Net_Promoter_Score_Access`. Prompt's `'Yes'`/`'No'` values never toggle them.
6. **Workflow order is wrong in the plan**: plan says Initial → HRVerification → ITSetup. Reality inserts **ID Setup** first and **IT Confirmation** before IT Setup.

## Data-fidelity / behavior findings
7. **Requester identity**: `requesterEmail` prefills from the real Google identity `dbinns@robinsonsolutions.com` (not `@team-group.com`). "Submitted By" columns across results sheets record `dbinns@robinsonsolutions.com`.
8. **ADP/Purchasing dual-lists build asynchronously and reset**: with ADP Supervisor + Central Purchasing/Jonas checked, `adpSites`/`purchasingSites` still submitted as `[""]` (empty) and `adpSalaryAccess` resolved to `No` despite being set `Yes`. The `jonas` specialist flag was `false` despite the system being selected (no Jonas job numbers entered).
9. **Orphan payload key**: ID Setup submits `siteDocsBadgeCreated: "Yes"` but ID Setup Results has no column for it (last column "BOSS WIS Created").
10. **HR Verification mapping**: `jobTitle` ("Test Analyst") is written into the column headed **"Verified JR Title"** — likely a header/mapping mislabel.
11. **IT Confirmation action item lifecycle**: submitting the it_confirmation *form* advances the main workflow but leaves its Action Items row **Open**; it only closes when completed through its own action-item view.

## Confirmed-correct behaviors (positives)
- Every results-sheet row matches its submitted payload field-for-field; Workflows + Dashboard_View consistent at each step.
- **Email redirect is active and safe**: all outbound mail rewritten to `dbinns@team-group.com`, subjects `[TEST]`-prefixed, bodies tagged `[DEVELOPMENT MODE - REDIRECTED FROM: <original>]`. No real recipients were emailed.
- **Credential exposure rule holds**: the requester/manager "IT Setup Complete" email contains the temp password (`TempPass@123`), DSS pwd, VM PIN. Specialist emails (e.g. Business Cards → Dave Langohr) **omit** the temp password and DSS/SiteDocs credentials. ✓
- **Pre-population flows correctly** across steps (HR Verification and IT Confirmation prefill name/site/hireDate/manager/jobTitle/internalEmployeeId from prior steps).
- Workflow completion fired a "Workflow Completed" email to requester and manager.

## Not run this session (out of scope of "until new hire is done")
- Workflow B (Equipment Request) and Workflow C (Termination) — harness configs for both are in `run-form.js` (`equipment`, `termination`) and ready to run.
