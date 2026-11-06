# 2026-11-05 — enum review + SiteDocs job code deploy

Written 2026-11-04 evening. **Nothing is deployed.** All edits are local files only.

---

## Part 1 — what is already done (local, unpushed)

| File | Change | Copies |
|---|---|---|
| `FormContracts.js` | `siteDocsJobCode` enum deleted, replaced with a comment | prod + EFX fork |
| `EmployeeIDSetup.html` | 6 old options → 10 SiteDocs title codes, grouped union / non-union | prod + EFX fork |
| `__tests__/efx-e2e-test.js` | the assertion that a bad code is rejected now asserts the opposite | prod + EFX fork |
| 7 docs under `docs/efx/` | enum references corrected | prod repo |
| `docs/efx/handoff/AGENT_NOTE_2026-11-04_ENUMS.md` | new — briefing for George's agent | prod repo |

**Tests green on both trees:** `efx-test` 218/0 · `super-test` 159/0 · `form-field-map-test` 315/0 ·
`efx-e2e-test` 602/0.

**EFX fork was refreshed from prod** (2026-11-04). It had drifted badly — no `union`, no
`dssLanguage`, 20+ files behind. `.clasp.json` deliberately **not** copied; it still reads
`REPLACE_ME_efx_test_script_id__NEVER_PROD`. There is no EFX test deployment, so nothing there can
be smoke-tested against a live script.

---

## Part 2 — the enum review

32 enum entries across 9 forms. Two kinds, and the difference matters:

- **ENFORCED** — a literal array. A wrong value returns `E_VALIDATION` and nothing is written.
- **reference** — the string `reference.sites` / `.jrs` / `.jobNumbers`. `validate()` tests
  `Array.isArray(e)` first, so **these are not checked at all**. Any value passes.

### Enforced — 22 entries, these can block n8n

| Form | Field | Values | Whose list is it? | Keep / open / hand over |
|---|---|---|---|---|
| `new_hire` | `employmentType` | Hourly \| Salary | ours | |
| | `newHireOrRehire` | New Hire \| Rehire | ours | |
| | `employeeType` | Direct Hire \| Agency | ours | |
| | `systemAccess` | Yes \| No | ours | |
| | `computerRequestType` | New \| Reassignment \| *(blank)* | ours | |
| | `computerType` | Chromebook \| Windows \| Mac \| *(blank)* | IT | |
| | `phoneRequestType` | New \| Reassignment \| *(blank)* | ours | |
| | `googleDomain` | team-group.com \| robinsonsolutions.com \| industrialappliedtech.com \| stgroup.ca \| ajvac.ca \| *(blank)* | Workspace | |
| | `dssLanguage` | English \| Spanish \| *(blank)* | **DSS** | likely George's |
| | `union` | Yes \| No \| *(blank)* | ours | |
| `termination_request` | `empType` | Hourly \| Salary | ours | |
| | `reason` | Deceased \| End of contract \| Resigned \| Retired \| Terminated | HR | |
| | `google_duration` | Default 1 Month then delete \| Longer (Specify in notes) \| Delete Immediately (No forwarding/access) | IT | |
| `position_change_request` | `currentClass` | Hourly \| Salary | ours | |
| | `classOld` / `classNew` | Hourly \| Salary \| *(blank)* | ours | |
| | `unionOld` | Yes \| No \| Unknown \| *(blank)* | ours | |
| | `unionNew` | Yes \| No \| *(blank)* | ours | |
| `it_setup` | `Email_Domain` | @team-group.com \| @robinsonsolutions.com \| @industrialappliedtech.com \| @stgroup.ca \| @ajvac.ca \| *(blank)* | Workspace | |
| `termination_approval` | `decision` | Approved \| Rejected | ours | |
| `position_change_approval` | `decision` | Approved \| Rejected | ours | |
| `specialist` | `department` | creditcard \| businesscards \| fleetio \| jonas \| sitedocs \| review \| safety \| safetyterm \| wis | ours | |
| `id_setup` | ~~`siteDocsJobCode`~~ | **removed 2026-11-04** | SiteDocs | done |

### Reference — 10 entries, not enforced today

`siteName` (×5 forms) · `jrTitle` (×3) · `jobSiteNumber` · `jrAssignment`

Sheet-backed via `Data_Lookup`, but the validator ignores them. Worth deciding whether that is
intended — a typo in `siteName` currently writes straight through.

### The question to settle

Any row above whose list belongs to a system George owns (SiteDocs, DSS) is the same trap as
`siteDocsJobCode`. `dssLanguage` is the obvious next one. Options per row: leave it, remove the
enum, or point it at a list he can maintain.

---

## Part 3 — plan for 2026-11-05

**Rule: do not touch prod without Binns present.**

1. **Drift check.** Pull remote prod HEAD into a temp dir and diff against the local tree, so a push
   carries nothing unexpected. Read-only.
2. **Decide the enum review** — fill the last column of the table above.
3. **Push to HEAD.** Either `clasp push -f`, or paste the two files in the Apps Script editor
   (surgical — `FormContracts` and `EmployeeIDSetup`).
4. **Test on the `/dev` URL** — `AKfycbwIDtch…`. Submit an ID Setup with `HRLY-U`.
5. **Establish which deployment n8n hits.** Still unverified. n8n calls the Execution API with
   `devMode:false`, so it runs a pinned version, not HEAD. `clasp list-deployments` does not show
   deployment type. This has to be settled or George stays blocked even after a push.
6. **Redeploy** that deployment and the portal `AKfycbyXp4q0…` @80. Never `@76`.
7. **Verify** with one real `n8n_submitIdSetup` carrying a SiteDocs code.
8. **Email George** — draft is written, send only after step 7.

### Open / not verified

- Which of the four prod deployments is the API-executable one n8n calls.
- Whether remote staging (`1A_EPP…`) carries the EFX layer. The local snapshot does not, which
  would mean staging cannot verify this at all.
- George's live n8n node — MCP access is off on *Employee Onboarding (Hourly / Salary Branch)*
  (`mw4aXq7lq5W1EQBy`), so neither its nodes nor its executions are readable.
- Whether `Mark Portal JR Complete` is wired to the success output of `Assign JR in BOSS`.
