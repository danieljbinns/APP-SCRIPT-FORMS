# New Hire Workflow — E2E Run Issues Log

**Run date:** 2026-06-18 (evening run)
**Workflow:** `NEW_EMP_20260618-170928_202` — TestFirst TestLast, Salary, Aurora
**Initial form ID:** `INIT_REQ_20260618-170929_228`
**Method:** real deployed dev web app via Playwright→CDP against authenticated containerized Chrome.
**Dev spreadsheet:** `1KeWBbh8755mRXFSK2dCeSW75djpaPgtprbmqd7BAsMA`

**Result: full chain ran end-to-end and reached `Complete`** (17:09:29 → 17:20:53).
Verified at each step: captured `google.script.run` payload + server `success:true`, plus end-state
Workflows status, Action Items closure, and Dashboard fields.

**Parked (not verified this run):** email content via GAM/GCP. The `role-general` GAM config has no
service-account JSON; `role-admin` has one but its scope/creds weren't confirmed. User to fix tomorrow.
So per-step *email* contents (subjects, redirect, credential-exposure rules) were NOT re-checked here.

## Chain (all steps `success:true`)
| # | Step | RPC | Result |
|---|------|-----|--------|
| 1 | Initial Request | `submitInitialRequest` | ✅ wf+form IDs returned |
| 2 | ID Setup | `submitEmployeeIDSetup` | ✅ internalEmployeeId `151769` generated |
| 3 | HR Verification | `submitHRVerification` | ✅ prefill carried, ADP ID set |
| 4 | IT Confirmation | `submitITConfirmation` | ✅ (gate already cleared in review mode) |
| 5 | IT Setup | `submitITSetup` | ✅ requester+specialists notified |
| 6 | 5 action items | `closeActionItemWithNotes` ×5 | ✅ all Closed → workflow Complete |

Final Workflows row: Status `Complete`, Current Step `All Action Items Closed`.

---

## Step 1 — Initial Request (`submitInitialRequest`)

**Submit:** ✅ `success: true`. workflow `NEW_EMP_20260618-170928_202`, form `INIT_REQ_20260618-170929_228`.
**Fill:** all fields found, no radio misses, no select fallbacks. `jobSiteNumber` auto-cascaded to `INDIRECT - Aurora`.

### Issues
1. **`adpSites` / `purchasingSites` submitted empty (`[""]`)** despite `ADP Supervisor Access` and
   `Central Purchasing/Jonas` checked in `systems`. Async dual-list widgets build/reset; selections
   never reach the payload. *(Repeat of prior run finding #8 — still present.)*
2. **`adpSalaryAccess` resolved to `"No"`** in payload despite being set `"Yes"`. *(Repeat of #8.)*
3. **`jonasJobNumbers` empty** — Central Purchasing/Jonas selected but no job numbers captured;
   downstream `jonas` specialist flag would be false.

> Caveat: issues 1–3 may be partly harness timing (the dual-lists build async after fill). They
> reproduce consistently across both runs, so worth a real-DOM look, but confirm with a human fill
> before treating as a pure app bug.

---

## Step 2 — ID Setup (`submitEmployeeIDSetup`)

**Submit:** ✅ `success: true`, "Employee ID setup completed successfully".
**Prefill / generated:** `internalEmployeeId: 151769` (server-generated), `dssUsername: testfirst.testlast`
(derived). All fields filled cleanly.

### Issues
4. **Orphan payload key `siteDocsBadgeCreated: "Yes"`** submitted but (per prior run finding #9) the
   ID Setup Results sheet has no matching column. Not re-diffed against the sheet this run — flag to confirm.

---

## Step 3 — HR Verification (`submitHRVerification`)

**Submit:** ✅ `success: true`, "HR Verification and ADP ID setup completed successfully."
**Prefill:** hireDate, firstName, lastName, managerName, managerEmail, jobTitle, siteName, department
all carried from prior steps. `adpAssociateId: ADP-E2E-001` and notes supplied.

### Issues
5. **`jrTitle` empty** in payload (no JR title at this stage — expected; JR is assigned later in the
   30/60/90 action item).
6. **Header/mapping mislabel (carried from prior run #10):** `jobTitle` was previously seen written
   into the column headed **"Verified JR Title"** in HR Verification Results. Not re-diffed this run —
   confirm the column mapping.

---

## Step 4 — IT Confirmation (`submitITConfirmation`)

**Submit:** ✅ `success: true`. Full Initial-Request form in review mode, all fields prefilled.

### Issues
7. **Harness gate-click warning (benign):** `button:has-text("requirements are met")` reported
   "element is not visible" — the form was already past the gate in review mode, submit fired fine.
   Cosmetic harness log only, not an app issue.
8. **`office365Required` came back `null`** in the IT Confirmation payload (was `"Yes"` in the Initial
   Request). The review form doesn't appear to re-serialize this field. Low impact but inconsistent.
9. **Carried `adpSites`/`purchasingSites`/`adpSalaryAccess` still empty/No** in the confirmation payload
   (same as Step 1 issues 1–2 — the confirmation echoes the bad initial values).
10. **IT Confirmation action item stays Open** after submitting the *form* (per prior run #11). Confirmed
    again: its Action Items row (`TK-C4D97973`) was still `Open` after the form, and only closed when
    completed through its own action-item view in Step 6.

---

## Step 5 — IT Setup (`submitITSetup`)

**Submit:** ✅ `success: true`, "IT Setup results saved successfully. Requester and Specialists have been notified."
**Checkboxes:** `Incidents_Access: Yes`; `CAA_Access`/`Delivery_App_Access`/`Net_Promoter_Score_Access`
correctly resolved to `No` (unchecked). `Computer_Type: Windows PC` accepted.

### Issues
- None observed at submit. (Per-recipient email credential-exposure rule NOT re-verified this run —
  parked with GAM.)

---

## Step 6 — Specialist Action Items (`closeActionItemWithNotes` ×5)

All five closed successfully; workflow advanced to `Complete`.

| Task ID | Category | Form Type | Result |
|---------|----------|-----------|--------|
| TK-C4D97973 | IT Confirmation | (review) | Closed |
| TK-819BDB9B | Safety | safety_onboarding | Closed |
| TK-F904F733 | Business Cards | businesscards | Closed |
| TK-48B7341C | 30/60/90 Review | review_306090 | Closed |
| TK-B38642E4 | WIS | wis | Closed |

### Issues
11. **"Closed By" identity = `dbinns@robinsonsolutions.com`** (the real logged-in account), while the
    workflow Initiator Email = `dbinns@team-group.com` (the send-as alias from the form). Same person,
    interchangeable accounts — documented so the mixed identities in sheets aren't mistaken for a bug.
    *(Relates to prior run finding #7.)*

---

## Open items to verify tomorrow (with working GAM/GCP)
- Per-step **email** contents: redirect to `dbinns@...`, `[TEST]` subject prefix, credential exposure
  (temp password present in requester/manager mail, absent in specialist mail).
- Sheet-column diffs deferred this run: ID Setup `siteDocsBadgeCreated` orphan (issue 4); HR Verification
  `jobTitle`→"Verified JR Title" mapping (issue 6).
- Decide whether `adpSites`/`purchasingSites`/`adpSalaryAccess` (issues 1–2) is an app bug vs. harness
  async-fill timing — retest with a manual human fill via VNC.
