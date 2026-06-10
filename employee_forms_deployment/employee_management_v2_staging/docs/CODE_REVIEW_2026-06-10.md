# Code Review — employee_management_v2_dev
**Date:** 2026-06-10
**Scope:** Entire dev folder — all backend JS (incl. Services/), all HTML, all test files (SuperDebug, TestRunner, TestER1–5, ProdSmokeTest), docs strays at repo root
**Method:** 6 parallel review agents (workflow handlers / email layer / services & infra / dashboard & UI / tests / HTML & frontend), all claims re-verified against source with file:line refs
**Status:** Read-only analysis. No files were modified. Nothing deployed.

---

## Quick Reference

| Severity | Count | Highlights |
|----------|-------|-----------|
| CRITICAL | 4 | Stale duplicate handler file, prod smoke test diverts live traffic, owner Cancel/Bump broken server-side, premature workflow completion |
| HIGH | ~18 | Password exposure in emails, races (no LockService anywhere), XSS, tests that can never pass |
| MEDIUM | ~35 | Flush gaps, duplicate-row writes, count/filter drift, schema mismatches |
| LOW | ~45 | Dead code inventory, stale comments, cosmetic bugs |

### Impact on PROJECT_STATE.md claims

| Claim | Verdict |
|-------|---------|
| "Cancel/Bump button visibility fixed (requester/manager can see)" | **UI only — server-side denies them 100% of the time (C3)** |
| `hasIt` gate fix (listed as future work) | **Already fixed** at EmailTemplates.js:117 and :936 — remove from future-work list |
| ProdSmokeTest "19/19 pass, safe on live prod" | **Unsafe claim — see C2**; several assertions also vacuous (payload keys don't match handlers) |
| "All 4 SuperDebug suites 191 pass / 0 fail" | Plausible, but several assertions are structurally incapable of failing (see Tests section) |
| Category renames complete | Backend yes; **tests, EmailTemplates display list, WorkflowMap.html, Fleetio.html, Specialist.js email subject still carry old names** |

---

## CRITICAL

### C1. `BOSSReviewHandler.js` is a stale full duplicate of the IT Confirmation handler — delete it
`BOSSReviewHandler.js` redefines `serveITConfirmation` (:12), `submitITConfirmation` (:181), `getITConfirmationData` (:393) — also defined in `ITConfirmationHandler.js` (:12/:44/:272) — and `getFullNewHireData` (:44), `getFullEquipmentRequestData` (:122), `getFullPositionChangeData` (:128) — also in `Services/ReferenceDataService.js` (:246/:330). In GAS global scope, whichever file loads last silently wins. If the stale copy wins, `submitITConfirmation` calls `launchEquipmentActionItems` (BOSSReviewHandler.js:362) which is commented out in EquipmentRequestHandler.js:166–230 → ReferenceError on every equipment request, and the ER-1 routing fix + googleEmail/computer preservation fallbacks (ITConfirmationHandler.js:85–89) are reverted. ITConfirmationHandler.js:42 itself notes these functions "moved to Services/ReferenceDataService.js (2026-05-14)".
**Fix: delete `BOSSReviewHandler.js`.**

### C2. `ProdSmokeTest.js:69–84` — smoke run silently diverts live prod traffic to dev
`_smokeSetup()` writes script-global properties `TEST_SPREADSHEET_ID` and `SUPPRESS_EMAILS_OVERRIDE`, which `ConfigurationService.getSetting()` (ConfigurationService.js:67–70) and `CONFIG.SUPPRESS_EMAILS` (Config.js:28–32) read live for **every execution**. While a smoke run is in flight on prod, any real user submission is written to the DEV spreadsheet and its emails suppressed. The header's "Zero impact on live prod data or active users" (lines 8–10) is false. `_smokeTeardown` (:80–84) also unconditionally deletes `SUPPRESS_EMAILS_OVERRIDE`, clobbering any operator-set value.
**Fix:** run only in a maintenance window, or thread overrides via parameter/user-properties; save & restore prior property values (TestRunner.js:247–265 already shows the pattern).

### C3. Requester/manager Cancel & Bump can never succeed server-side
`RequestActionsHandler.js:32,108` → `AccessControlService.canCancel/canBump` (:184–185, :198–199) read `workflow['Requester Email']` / `workflow['Manager Email']`, but `getWorkflow()` (WorkflowManager.js:278) returns only the 9 Workflows-sheet columns (Setup.js:21–24: …, **Initiator Email**, …). Those keys are always `undefined` → Tier 6/7 owners always denied, even though Dashboard.html:1042–1043 and RequestDetails.html:580–581 enable the buttons for them.
**Fix:** compare against `workflow['Initiator Email']` and/or resolve requester/manager from Dashboard_View or the source request sheet.

### C4. Purchasing-sites-only requests auto-complete while the Purchasing task is still open
`ActionItemService.getRequiredSpecialistCats()` (:458) adds `'Purchasing'` only when `IR.JONAS_JOB_NUMBERS` is non-empty, but `triggerSpecialists()` (ITSetupHandler.js:524–553) creates the Purchasing action item when `hasJonas || hasPurchasingSites`. A New Hire with purchasing sites but no Jonas job numbers → Purchasing item treated as non-blocking → `checkWorkflowCompletion()` completes the workflow and sends closure emails with the task still open. Same gap in StateSync.js:250–258 (`CAT_ITEMS_KEY['Purchasing'] = 'jonas'`) so the dashboard simultaneously shows "All Specialists Complete".
**Fix:** add `PURCHASING_SITES` to `getRequiredSpecialistCats()` and a `purchasing` flag in StateSync — and consolidate the three copies of "which specialist categories exist" into one source of truth.

---

## HIGH

### Security / data exposure
- **H1. EmailTemplates.js:226–229** — `siteDocsPassword` and `dssPassword` rendered in **plain text, no `showPw` gating** in New Hire ID Setup email section; every recipient (HR, IT, Safety) sees the credentials. The same SiteDocs password is correctly masked at :351 and the Google temp password at :309. Apply the same mask pattern.
- **H2. Dashboard.html:698–700 (XSS)** — `renderMyRequests` builds `onclick="filterToEmployee('NAME')"` escaping only single quotes; a stored name containing `"` breaks out of the attribute. Use data-attributes + `escapeHtml`.
- **H3. Dashboard.html:1290–1293, RequestDetails.html:846–851 (XSS)** — checklist rows built via `innerHTML` from unescaped `item.name`/`item.by`/`item.time` (sheet-sourced, partly user input). Also `item.target`/`item.tid` interpolated into inline `onclick` (Dashboard.html:1268–1284, RequestDetails.html:826–842).
- **H4. ActionItemForm.html:274, 304 (stored XSS)** — draft JSON injected unescaped into `innerHTML` (`saved.serial`, `saved.comments`); `escapeHtml` is defined ~100 lines above and used everywhere else.
- **H5. ActionItemService.js:845–858** — leftover debug logging writes the first 60 chars of credential formData (SiteDocs username material) to execution logs.

### Correctness
- **H6. EmailTemplates.js:954–968** — Status Change §4b: Incidents/CAA/Delivery App/NPS rows nested **inside** `if (context.bossAccess === 'Yes')`, silently dropped when BOSS not granted (New Hire builder renders them independently, :344–347).
- **H7. PositionChangeHandler.js:223–226** — `parseNewMgrEmail` returns the **old** manager's email as the new manager when only the old side parses (format `Old (a@x) -> New (N/A)`); flows into approval recipients (:909) and `launchWisAssignment` fallback (:997). Split on `' -> '` first.
- **H8. ITSetupHandler.js:110–113** — credit-card context mis-mapped: `creditCardLimitCanada` gets the Yes/No flag (`IR.CC_CAN`); `creditCardCanada`/`creditCardHomeDepot` keys missing. Feeds ITSetup.html prefill and Specialist.js.
- **H9. ITSetupHandler.js:152** — `idSubmittedBy` read from `ID.BOSS_WIS_CREATED` (boolean col 12) instead of `ID.SUBMITTED_BY` (col 11).
- **H10. PositionSiteChangeRequest.html:776** — prefill uses `sv()` on **radio** inputs (`classOld`/`classNew`), rewriting the first radio's value attribute instead of checking it; in IT-confirmation mode clicking "Hourly" can submit `classNew='Salary'` which ITConfirmationHandler.js:120 writes back to the sheet. Also (:760–785) prefill omits required `firstName`/`lastName` and the `currentClass`/`hadReports`/`gainingReports`/`hasGoogle` radios entirely.
- **H11. RequestDetailsHandler.js:215–225** — onboarding `getRequestDetails` never sets `context.status` (TERM/CHANGE/EQUIP builders do) → terminal guards in both UIs always pass, and since `cancelRequest` has no server-side status check (M-block below), Cancel can overwrite `Complete` with `Cancelled`.

### Races (LockService is used **nowhere** in the codebase)
- **H12. PositionChangeHandler.js:375–963, TerminationHandler.js:216–463** — approval endpoints have no lock and no duplicate-submission guard; a double-click re-creates 8–10 action items and re-sends all emails.
- **H13. IDSetup.js:108–140** — `generateEmployeeId()` computes max+1 at form-serve time; two concurrent forms get the same ID, both submissions append without re-validation. Error fallback `'30'+timestamp.slice(-3)` can collide with the real range.
- **H14. ActionItemService.js:158–161** — double-submit guard re-checks status from the stale `data` array (comment says intentional); two concurrent closes both pass → duplicate closure emails and duplicate secondary writes.

### Test-suite integrity & email safety
- **H15. TestRunner.js:813–815** — `runPositionChangeTest` asserts old categories (`Credit Card`/`Fleetio`/`Jonas`) vs current (`Finance`/`Fleet`/`Purchasing` — PositionChangeHandler.js:571/591/650): **can never pass**. Same for **TestER4.js:206** asserting `'WIS User'` vs current `'ID Setup'`.
- **H16. TestRunner.js:408–414** — `runFullTestWorkflow` swallows aborts (no rethrow), so `runAllTests` reports `newHire: 'PASSED'` even when the workflow aborted at step 1: **can never fail**.
- **H17. TestRunner.js:789/894 + Config.js:31** — position-change/termination tests only **warn** when email suppression is off, and `SUPPRESS_EMAILS` defaults to false → test runs can email real group inboxes.
- **H18. SuperDebug.js:2007–2052 + EmailUtils.js:1138–1142** — `sdSendCompletionEmail*`/`sdTestEmail` and `notifyAdminActionItemFailure` call `MailApp.sendEmail` directly, bypassing suppress/redirect; `sdSendCompletionEmailFinal` emails a **hardcoded "ALL PASSED 185/0"** summary from a 2026-06-01 run regardless of actual results.

---

## MEDIUM

### Read-after-write / duplicate-row integrity
- ITSetupHandler.js:303→313/358 — `appendRow` to IT_RESULTS then `getWorkflowContext()` reads with no `SpreadsheetApp.flush()` → emails can carry stale IT fields. Same in ITConfirmationHandler.js:161 after ~29 `setValue()` corrections.
- ITSetupHandler.js:303 + ActionItemService.js:193–237 — every first CHANGE_ IT submission writes **two** IT_RESULTS rows (handler append + closeActionItem "Special Case 1" append); corrections only update the first → stale duplicate row.
- ActionItemService.js:268–278 — WIS-cred in-place update overwrites all 13 columns with a mostly-empty array, wiping FORM_ID/INTERNAL_EMP_ID/SITEDOCS_*/DSS/SETUP_NOTES.
- submitITSetup/submitHRVerification (ITSetupHandler.js:217–229+303; HRVerificationHandler.js:106–118+206) — detect-then-append without lock → duplicate rows + double `triggerSpecialists()`.
- createWorkflow-before-validation (PositionChangeHandler.js:19→27–35, TerminationHandler.js:35→98–100 — incl. Drive upload before validation :50–63, EquipmentRequestHandler.js:35→43–45, InitialRequestHandler.js:21→30–38) — failed validation leaves orphan "In Progress" Workflows rows.
- RequestActionsHandler.js:26–133 — `cancelRequest`/`updateHireDate`/`bumpRequest` never check current status; terminal workflows can be re-cancelled/re-dated/bumped.

### Logic / display drift
- Dashboard.html:543 vs 933–936 — ADP/HR button **count** includes HR Verification step + EOE items; the **filter** doesn't → count and list disagree.
- Dashboard.html:1124–1129 — stepper `phaseAllComplete` treats `N/A` as incomplete → when IT Setup is N/A, later specialist dots never activate and phase numbering shows gaps.
- DashboardDataHandler.js:318 — `getWorkflowMapStats` doesn't exclude `Inactive` (soft-deleted) workflows; inconsistent with `getMyTaskCounts` (:267).
- ITConfirmationHandler.js:246 — step set to 'IT Setup Needed' unconditionally incl. CHANGE_ workflows → regresses out of completion-eligible steps, permanently blocking auto-close.
- TerminationHandler.js:190 — TERM_DATE parsed as UTC midnight then formatted in script TZ → off-by-one-day in negative-offset timezones.
- KonamiStats.js:48 — checks `'Completed'` but writers use `'Complete'` (all 19 call sites) → completed count always 0.
- Specialist.js:68–78 — sheetMap references 8 removed `CONFIG.SHEETS.*` keys (all `undefined`) → every department writes to generic 'Specialist Results'; and :92–100 safety branch writes 7 values into a 6-header sheet (columns shifted).
- Setup.js:35–82 — `initializeSystem()` headers missing `BOSS_TRAINING_ONLY` (IR col 54), `BOSS_DETAILS` (IT col 22), `ATTACHMENT_URL` (Terminations col 28) vs SCHEMA; fresh environments depend on migrations that don't cover all three.
- Setup.js:288–353 — `migratePositionChangesSchema` appends missing headers at `getLastColumn()+1` in iteration order; partial prior migration → silent column misalignment for all positional reads.
- HRVerificationHandler.js:268 — `context.systems` dereferenced without re-guarding null context (guard at :216 doesn't cover this path).
- EmailUtils.js — no HTML escaping anywhere in the email layer (`esVal`/`esRow`/`buildChangesHtml`/subject in `createEmailTemplateV2` :1020); user-entered names/notes containing markup corrupt email layout (HTML injection into internal mail).
- EmailUtils.js:290–316 — unreachable POSITION_CHANGE_APPROVALS enrichment block after `return` (references undeclared `changeContext`; self-documented as dead).
- EmailTemplates.js:231 — `siteDocsBadgeCreated` row can never render: no badge column in SCHEMA.ID_SETUP_RESULTS and `getWorkflowContext` never sets it; the EmployeeIDSetup.html:174 checkbox is dropped server-side.
- '[L' Java-object guard inconsistent — present in SharedComponents.html:236 and RequestDetailsHandler.js:460/756, **absent** from `getWorkflowContext`/`getITContextData` → RequestHeader (≈15 forms) and all emails can still show `[Ljava.lang.Object;@…`.
- StatusChangeApproval.html:29–41 — inline scriptlets dereference `requestData.*` with no null guard; unknown workflowId → template evaluation throws.
- TerminationRequest.html:279–296 — checking "Google Account" force-requires all five sub-fields; :63 manager pattern omits `stgroup.ca` (other fields include it); ITSetup.html:74–79 Email Domain select also lacks `@stgroup.ca`.
- TerminationRequest.html:388–391, PositionSiteChangeRequest.html:692–696 — `FileReader.onerror` silently submits **without** the required attachment.
- PositionSiteChangeRequest.html:601–620 — hidden sub-section fields not cleared before submit (InitialRequest.html:1190–1246 has the clearing block) → stale values leak to the sheet.
- ProdSmokeTest payload keys don't match handler reads (jobTitle/site vs positionTitle/siteName; changeTypes/effectiveDate/titleChange vs changeType/effDate/titleOld+titleNew; equipmentList/systemsList vs equipment/systems) → rows written with blank key columns while weak `row.found` checks still pass; `_smokePurgeByNames` (:374–399) joins cells with a double space and never matches → orphan smoke rows in Initial_Requests.
- SuperDebug.js:652–658 / TestRunner.js:325–337 — AI-close loops count failures as successes; SuperDebug.js:504–518 — redirect-only mode makes all email assertions vacuous (`_sdEmailExtract` only parses `[EMAIL SUPPRESSED]` lines); no suite auto-runs its cleanup (≈a dozen workflows left per full run).

### Performance
- EmailUtils.js:175–531 — `getWorkflowContext()` does up to 4 full-sheet reads and is called once **per outgoing email**; memoize per workflowId per execution. `sendSafetyOnboardingEmail` (:1059–1070) reads ID_SETUP_RESULTS then calls `getWorkflowContext()` which reads it again.
- DashboardDataHandler.js:216–291 — dashboard load = two round-trips (`getDashboardData` + `getMyTaskCounts`) that each bulk-read the same two sheets; merge counts into the first payload.
- AccessControlService.getUserRolePayload — up to ~25 AdminDirectory calls, no caching, rebuilt up to 4× per details fetch/action; memoize per execution.
- Config.js:14–22 / ConfigurationService.js:63–76 — every `CONFIG.SPREADSHEET_ID` access = 2 PropertiesService hits, dozens of times per request; cache `getProperties()` once.
- Per-cell write batches: ITConfirmationHandler.js:69–101 (29 `setValue`s), HRVerificationHandler.js:148–156 (9), ActionItemService.closeActionItem (4–6), WorkflowManager.updateWorkflow — use one `setValues` range write.
- StateSync.manuallySyncAllWorkflows — re-opens spreadsheet and re-reads full ACTION_ITEMS per workflow; WorkflowManager.syncStatusToRequestSheet full-reads up to 3 sheets per status update.
- Full-sheet scans for single rows: getITContextData, getHRVerificationData, submitITConfirmation (reads INITIAL_REQUESTS twice), submitITSetup; SuperDebug `_sdReadRow` re-reads whole sheets per assertion. A shared `findRowByWorkflowId(sheet, id)` (TextFinder, matchEntireCell) is re-implemented ≥8 times and belongs in SheetUtils.
- Konami easter-egg payload: ≈187 KB (Konami + EasterEggMaps + FieldIndex) inlined into all ~20 form pages when enabled — must not ship enabled to prod.
- Tests: ~25 redundant `Utilities.sleep` calls after synchronous `flush()` burn 20–30 s of the 6-minute quota; purges delete rows one at a time.

---

## DUPLICATION (consolidation targets)

1. **BADGE_LABEL / RD_BADGE_LABEL** — hand-maintained duplicate maps in Dashboard.html:1077–1106 vs RequestDetails.html:610–621, already drifted (Dashboard has 6 extra keys); role-gating blocks, checklist-row builders, and modal-close handlers also duplicated. Home: SharedComponents.html (both pages already include it). Unknown categories currently render on RequestDetails but are silently dropped from the Dashboard stepper.
2. **Specialist category source of truth ×3** — triggerSpecialists vs getRequiredSpecialistCats vs StateSync.CAT_ITEMS_KEY (caused C4).
3. **EmailTemplates** — Status Change §4b is a near line-for-line copy of the New Hire IT block (:935–973 vs :300–392; drift caused H6); HR Approval/HR Review sections identical except the title (:563–588 vs :869–894); `_fmtDisp()` copy-pasted between builders; specialist list can push duplicates ('Credit Card', 'Business Cards' via two paths, :138–148); `SPECIALIST_SYSTEMS` lists both `'JONAS'` and `'Jonas'` though comparison is lower-cased.
4. **fmtDate clones ×5** (PositionChangeHandler:216, TerminationHandler:5, ITSetupHandler:72, ReferenceDataService/BOSSReviewHandler) → one `formatSheetDate()`.
5. **Manager-email regex ×3** (PositionChangeHandler.js:224/:408/:925) → `parseManagerEmails()` (also where H7 gets fixed).
6. **Results-sheet bootstrap ×3** (HRVerificationHandler:166, ITSetupHandler:233, ITConfirmationHandler:136) → `ensureResultsSheet(name, headers)`.
7. **Termination context spread ×5** (TerminationHandler.js:340–351/369–380/416–427/445–454/515–527) → `buildTerminationContext()`.
8. **RequestDetailsHandler** — TERM vs CHANGE action-item aggregation ≈55 identical lines (:493–541 vs :801–855).
9. **Tests** — `_purgeWorkflowRows` defined in both SuperDebug.js:1916 and TestRunner.js:456 (GAS load-order collision); three parallel assertion mini-frameworks (TestRunner `_chk*`, SuperDebug `_sdVerify*`, ProdSmokeTest `_smokeCheck`); TestER2–4 re-test what SuperDebug Equipment Phase 5 already covers with current names — TestER1–4 are mostly redundant, TestER4 actively stale.
10. **Frontend** — InitialRequest ↔ PositionSiteChangeRequest systems/equipment blocks ("⚠️ SYNC REQUIRED" comments, already drifted: PSC has DSS checkbox, different field names); 4 submitter guides each inline 100–300 lines of the Styles.html design system plus hardcoded site/JR lists that will drift; ActionItemForm.html:11–25 re-declares CSS that exists in Styles.html:535–593; three inline success-screen variants bypass SuccessScreen.html; header/back-link block repeated in ~18 pages.

---

## DEAD CODE INVENTORY

**Delete (verified zero callers across all .js/.html incl. google.script.run):**
- `BOSSReviewHandler.js` — entire file (C1)
- EmailUtils.js:290–316 (unreachable block), :609–624 `sendBatchEmails`
- ReferenceDataService.js — `getManagersList`, `getRequestersList`, `getAllReferenceData`, `getSiteOptions`, `getJobCodesList`, `getJobNumbersList`, `getBossJobSitesList`, `getBossCostSheetsList`, `getDataLookupColumn`
- AccessControlService.js:161–176 — `getUserAccessFlags`, `_wfEmail`
- TerminationHandler.js:473–504 — `scheduleAccountDeletion` + `parseDurationMonths_` (ActionItemForm does this client-side)
- EquipmentRequestHandler.js:244–371 — `launchRemainingEquipmentTasks` (meant to be in the ER-1 comment block; the block closes at :230 leaving it live-but-uncalled, with orphan end-marker at :371)
- WorkflowManager.js:203–273 — `adminPurgeWorkflows` disabled shell
- SuperDebug.js:345–467 — one-time header-migration fixers (one even mutates the sheet from an "audit"); move to MigrationTools or delete
- Dashboard.html — `openStepDataView` (:1348, identical to `openFullPage`), `dashboardTable` getter (:641), commented scaffolding (:1364), unreachable `STEP_CATEGORY_TERMS` entries (:620)
- InitialRequest.html — `autoFillJobNumber` (:1111), `populateSelect('jonasJobNumbers',…)` no-op (:855), unused datalists (:605–608)
- DashboardDataHandler.js:98–120 — unconsumed payload fields (`requestedItems` JSON.parse per row, `pendingItems`, `canEditDates`)
- Styles.html unused classes — `.theme-toggle-btn`, `.aoda-toggle-btn`, `.checkbox-grid`, `.ticket-info`/`.info-row`, `.requirements-toggle/-content`, `.form-row-3`
- InitialRequestHandler.js:203–207 — orphan docstring; HRVerificationHandler.js:24 — unused `idSheet` lookup

**Orphaned HTML (no template/include reference anywhere):**
- `EasterEggDocs.html` (1016 lines), `SubsidiaryDiscoverySurvey.html` (758 lines)
- Repo-root strays `SharedScripts.html`, `component-styles.html`, `request-header-preview.html` — stale precursors, not duplicates of dev files; safe to archive
- **Reverse-orphan:** `Placeholder.html` is referenced by Specialist.js:23 but doesn't exist → throws for unknown dept

**Quarantine (destructive, unguarded, ships with project):**
- MigrationTools.js — `wipeDevSheets()` clears all 13 sheets of whatever `CONFIG.SPREADSHEET_ID` resolves to; no env guard (TestRunner has `_assertDevOnly()`, this doesn't); `.claspignore` excludes only docs/**. Add an in-code environment guard to it and all `migrate*` one-offs, or move them out of the deployable folder.

---

## LOW (selected)

- EmailTemplates.js:418/985/1000 — `esVal(…, 'complete')` style doesn't exist in the switch (silent fallthrough); :116 stale comment on the fixed hasIt gate; needsIt/Equipment edge (:119/:152) can leave specialists "Queued" forever for hourly/no-access equipment rows.
- EmailUtils.js:184 — `startsWith('TERM')` (vs `'TERM_'`); :368 unguarded Timestamp parse can null the whole context; :984 `calendarDate` substring garbage if hireDate is ever a Date object.
- ChangeNotify.js:18–19 — splits on `', '` exactly (spurious diffs for `'a,b'`); :76 HTML tags in plain-text MIME part; :97–124 Safety/ID-Setup blocks parameterizable.
- PositionChangeHandler.js — :43 unreachable `|| workflowId` fallback (filenames like `CHANGE___doc.pdf`); :505 zero-length all-day calendar event (end date exclusive; ActionItemForm.html:343 does it right); :904 unreachable else-arm; :960 catch without Logger.log; :813–829 broken indentation + `idTid` shadowing.
- TerminationHandler.js:140 — `toLocaleDateString()` locale/TZ-dependent and wrong on Replay; TerminationHandler.js:76 reads `formData.empSerial` which no form field supplies (always 'N/A').
- RequestDetails.html:594 — Edit Start Date not excluded for `EQUIP_REQ_`; :948–1013 error object rendered as literal data rows.
- RequestDetailsHandler.js:104–105 — positional timestamp/submitted-by assumptions per results sheet; :257 TextFinder without `matchEntireCell(true)`; :400 second `openById`.
- Hardcoded values — `davelangohr@team-group.com` ×4 (EquipmentRequestHandler.js:147, HRVerificationHandler.js:274/277, RequestActionsHandler.js:155 — Router.js:92 uses `CONFIG.EMAILS.BUSINESS_CARDS` for the same person); `dbinns@team-group.com` + dev spreadsheet ID + deployment URL hardcoded across test files.
- ValidationUtils.js:104 — formula-injection check rejects values starting with `+`/`-` (blocks `+1 416…` phone numbers); prefix-escape on write instead.
- ConfigurationService.js:82–89 — `saveSettings()` has no admin check despite its comment (latent until a google.script.run bridge exists).
- IDSetup.js:186 / ITSetupHandler.js:311 — `updateWorkflow()` called with 5 args, accepts 4 (trailing actingUser dropped).
- SchemaConstants.js:53/151/277 — column-count comments off by one; ITConfirmationHandler.js:126 outdated "not in base schema" comment (constant exists); ActionItemService.js stale 'WIS User'/'Jonas'/'Fleetio' doc comments (:25, :112–117, :424–428) — these actively mislead audits.
- Category-rename stragglers — WorkflowMap.html:298/308 cards titled "Jonas"/"Fleetio"; Fleetio.html still titled "Fleetio Setup" throughout; Specialist.js:170–174 leaves "Fleetio" in completion email subjects; EmailTemplates.js:37–39 display list.
- TestER1.js:35 — comment contains Cyrillic Е/Р (`TESTЕР1`), invisible to text search; TestER3.js:11 false claim that the `plan306090='No'` branch is covered (it isn't, anywhere); SuperDebug `runSuperDebugCleanup` (:2261) structurally cannot fail; ProdSmokeTest single-suite wrappers return a different shape than `runProdSmokeTest`.
- Dashboard.html:528 — `colspan="11"` vs 12 columns; RequestHeader.html:182/184 — class `rh-f--full` used but never defined; WorkflowMap.html:408 — relies on global `event`; Fleetio.html:28 — `required` checkbox makes Specialist.js's `fleetioCreated === false` path unreachable; InitialRequest.html:1270 — self-XSS via own name in success screen.

---

## What's in good shape

- The known `hasIt` gate issue is **already fixed** (EmailTemplates.js:117, :936) — only a stale comment remains.
- SchemaConstants is consistently used across the backend; AccessControlService compares emails case-insensitively throughout.
- Every live form has paired `google.script.run` success/failure handlers; field-name contracts match on all primary submit paths; the shared component system (Styles/SharedComponents/RequestHeader/SuccessScreen/DirectoryAutocomplete) is genuinely reused.
- Backend category renames (Jonas→Purchasing, Fleetio→Fleet, WIS User→ID Setup/Deactivation) are complete in handlers/services; MigrationTools remaps legacy rows.
- TestER1–5 verify shipped fixes (ER-1 routing, ER-2/3 guards, ER-4 SiteDocs routing, ER-5 bossTrainingOnly), not unimplemented future work — though SuperDebug Equipment Phase 5 now supersedes ER-1–4.

---

## Recommended action order (pre-prod-merge)

1. **Delete `BOSSReviewHandler.js`** (C1) — zero-risk removal, eliminates load-order roulette.
2. **Fix C3** (Initiator Email key) + add `context.status` to onboarding details (H11) + server-side terminal guards in RequestActionsHandler — this is the feature PROJECT_STATE claims is done.
3. **Fix C4** (Purchasing cats in getRequiredSpecialistCats + StateSync).
4. **Mask passwords in New Hire emails** (H1) and fix the §4b BOSS nesting (H6).
5. **Quarantine C2 + wipeDevSheets** — env guards before anything is pushed near prod.
6. XSS escapes (H2–H4) — four small `escapeHtml` edits.
7. Update stale test assertions (H15) so the suites actually gate the merge; make TestRunner abort (not warn) without email suppression (H17); route all test/admin mail through `sendFormEmail` (H18).
8. Add LockService to ID generation, approvals, and closeActionItem (H12–H14) — one shared `withLock(fn)` helper.
9. Everything else per severity as scheduled cleanup; duplication items 1–3 first since they have already produced live bugs.
