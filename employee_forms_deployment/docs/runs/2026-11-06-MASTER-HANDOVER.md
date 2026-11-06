# MASTER HANDOVER — Employee Forms deploy, as of 2026-11-06

Everything a fresh session needs to **plan → check → test → deploy**. Consolidates two chat
sessions. Written because the work is spread across three repos, two sessions and six run docs,
and the next person needs one place to start.

**Nothing has been deployed. Users are on `@80`.** No version has been cut. No push has happened
since 2026-10-16.

---

## 0. Read this first — the three facts that change everything

1. **A deploy is all-or-nothing.** `clasp push` is whole-directory and a version snapshots the
   whole project. There is no per-file push and no per-file deploy. Cutting `@81` ships the
   entire Oct 13–19 batch **plus** the Nov 4 SiteDocs work together. The SiteDocs fix George is
   waiting on cannot go out alone.
2. **HEAD already carries ~11 files of October work that has never been live.** It was pushed on
   2026-10-16 and never deployed. `@80` has none of it.
3. **The n8n blocker is unresolved.** n8n calls the Apps Script Execution API with
   `devMode:false`, which runs a **pinned version, not HEAD**. Which of the prod deployments that
   is has never been established. A push alone will not unblock George. See §5.

---

## 1. Where to work

| | Path | Use |
|---|---|---|
| **Work here** | `P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_deployment` | The live repo. `employee_management_v2/` holds the prod `.clasp.json`. |
| **Do not work here** | `P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_efx` | **Archived** 2026-09-23 (`ARCHIVED.md`). No scriptId, cannot deploy. History only. |
| Read-only reference | `P:\Projects\Company\N8N\_agent-bundle\...\spec\` | EFX spec of record |

The EFX fork was refreshed from prod on 2026-11-04. That was wasted effort — it is archived and
cannot ship. Ignore it.

## 2. Hard constraints — do not violate

- **Never push, cut a version, or redeploy without Binns present and saying so in that moment.**
  Stated verbatim 2026-11-04: *"DO NOT TOUCH PROD EVER WITHOUT ME."*
- **Never touch deployment `AKfycbw7fhvI…` `@76`** — JR automation, anonymous `doPost`. Breaking
  it breaks George's live JR flow.
- **Never touch `AKfycbwAb33…` `@75`.**
- **No changes to George's n8n workflows.** We hand over; he edits.
- Editing files in the repo is fine. Touching the Apps Script *project* is not.
- Prod scriptId: `1AuIbJl1jRh1awi-MW-6y_NftHUGtfUNRexZk1gPzvenmIblSZo-lPz66`.
  Never point anything else at it.

## 3. Current state

### Live
- Web app deployment `AKfycbyXp4q0…` pinned to **`@80`**, deployed as `no-reply@team-group.com`.
- `@80` is the highest version that exists.
- `/dev` always serves HEAD:
  `https://script.google.com/a/macros/team-group.com/s/AKfycbwIDtchHssOFkJJ4lwdFSZSjkDG_jaNg5oetT-BKaYd/dev`

### On HEAD but NOT live — pushed 2026-10-16, never deployed

Totals **+429 / −22**. Every deletion has a direct replacement.

| change | files | risk |
|---|---|---|
| IT Setup section gating | `ITSetup.html`, `ITSetupHandler.js` | **medium** — §6 |
| Equipment IT Setup step on tracker | `RequestDetailsHandler.js` | **medium** — §6 |
| Legacy category fix | `DashboardDataHandler.js` | low — **changes visible counts**, §6 |
| Dashboard `ReferenceError` fix | `Dashboard.html` | none — a missing `let` |
| Light / AODA contrast | `Dashboard.html`, `RequestDetails.html`, `WorkflowMap.html` | none |
| Test-admin guard on 29 destructive globals | `TestRunner.js`, `SuperDebug.js`, `ProdSmokeTest.js` | none |
| Read-only audit runners | `DashboardDataHandler.js` | none |

`InitialRequest.html`, `ITConfirmationHandler.js`, `EquipmentRequestHandler.js` are **unchanged**.

### Local working tree differs from HEAD in exactly 3 files

| file | session | what |
|---|---|---|
| `HRVerificationHandler.js` | other session, 19 Oct | narrows the `siteName` write guard; removes over-broad `jobTitle`/`jrTitle` guards. **HEAD still has the wrong version** |
| `FormContracts.js` | this session, 4 Nov | drops the `siteDocsJobCode` enum |
| `EmployeeIDSetup.html` | this session, 4 Nov | 6 old job codes → 10 real SiteDocs title codes |

`__tests__/` and `docs/` are excluded by `.claspignore`, so test and doc edits never reach Apps
Script.

### Git — not a blocker, but back this up

- `employee_forms_deployment` → `github.com/danieljbinns/APP-SCRIPT-FORMS`, branch `main`,
  **4 commits ahead and unpushed**, 16 modified, 10 untracked.
- Not fetched recently — "ahead 4" is against last-known remote.
- **The local tree is the only copy of several days' work.** Consider committing and pushing to
  GitHub before anything touches the script.
- Git state and Apps Script HEAD are **independent**. A file can be pushed to HEAD and still
  uncommitted in git — most of the Oct batch is exactly that.

---

## 4. The SiteDocs / George thread — why this is urgent

**What broke.** George's Hourly Onboarding automation failed with
`EFX E_VALIDATION: siteDocsJobCode must be one of Hourly 1|Hourly 2|...`. That list was a
hardcoded enum in `FormContracts.js`, **not** a portal lookup — so the `Data_Lookup` sheet could
never have fixed it, and giving him sheet access would have changed nothing.

**The fix (local, not yet on HEAD).**

- `FormContracts.js` — `siteDocsJobCode` enum removed entirely. SiteDocs owns that list and it
  keeps changing. Still in `required`, so empty/null is still rejected.
- `EmployeeIDSetup.html` — dropdown replaced with the real SiteDocs title codes, grouped:
  `Corp-Exec` · `Corp-Mgmt` · `EHS` · `C-Support` · `Site-Sup – Union` · `Site-ADM-U` · `HRLY-U` ·
  `Site-Sup` · `Site-ADM` · `HRLY`
  **`Site-Sup – Union` uses an en dash (U+2013)**, encoded `&#8211;` in the option value.
- `__tests__/efx-e2e-test.js` — the assertion that a bad code is rejected now asserts a SiteDocs
  code passes and that empty is still rejected as required.
- 7 docs under `docs/efx/` corrected; `docs/efx/handoff/AGENT_NOTE_2026-11-04_ENUMS.md` written
  for George's agent.

**Email to George was sent on the night of 2026-11-04/05.** It says testing and deploy happen
next and that we will confirm when it is in. **He is waiting on that confirmation.**

**Also true and worth telling him:** union status already flows end to end. `n8n_getWorkflow`
returns it as **`Union`** (capital U, `Yes`/`No`) in the request-data map, and language as
**`DSS Language`** (`English`/`Spanish`). His node comment calling union "blocked on the portal
API" is stale. Note the defaults differ — Forms writes `No` when blank; his mapping node defaults
*absent* to union.

---

## 5. THE OPEN BLOCKER — which deployment does n8n call?

**Unresolved. This is the single thing that decides whether the deploy actually unblocks George.**

- n8n hits `POST https://script.googleapis.com/v1/scripts/<scriptId>:run` with `devMode:false`.
- `devMode:false` runs the **pinned version of the API-executable deployment**, not HEAD.
- `clasp list-deployments` does not report deployment *type*, so the API-executable one has not
  been identified among the four that exist.
- **Consequence:** pushing to HEAD, or even cutting `@81` and repointing the web app, may leave
  George exactly as blocked as he is now.

**Settle this before promising George anything.** Options: inspect the deployments in the Apps
Script editor (Deploy → Manage deployments shows type), or test with one real `n8n_submitIdSetup`
carrying `HRLY-U` after the version is cut.

---

## 6. Not proven by any test — needs a real submit

Suites pass, but no suite reaches these paths.

1. **Nobody has ever submitted a gated IT Setup form.** The eight `|| fallback` values in
   `ITSetupHandler.js` exist because a hidden section no longer posts its fields, and `undefined`
   in a `setValues()` row throws. **One submit on `/dev` settles it.**
2. **The dual-source IT Setup status has never executed.** The tracker marks the step Complete if
   *either* an IT Results row exists *or* the IT action item is Closed. **19 of 20** equipment
   workflows are Closed with no IT Results row — reading IT Results alone would flip them all
   back to Pending. Correct by inspection and by data; never run.
3. **`context.systems` now degrades instead of throwing** (`HRVerificationHandler.js`). It fails
   *differently*, not *less*. Lines `:334`/`:337` already guard `context`, so emails are safe.

**Expected visible change on deploy:** the legacy-category fix makes **6 currently-invisible tasks
appear** — 3 Fleet, 3 Purchasing, across 5 workflows. That is the fix working, not a regression,
but people will notice and should be told.

---

## 7. Checked and found clean — do not re-investigate

- **`refreshDirectoryGroups` "not listable" log entries are NOT a bug.** `BUSINESS_CARDS` and
  `IT_CONFIRMATION` both default to `davelangohr@team-group.com`, a person not a group. Listing a
  person as a group returns exactly that "Not Authorized" error; the `catch` records them as their
  own single member, which is the documented, intended path. Summary `:1` each is correct.
- **No test workflows in prod.** Zero rows matching harness names across Workflows, Initial
  Requests, Terminations, Position Changes, Action Items. Smoke tests write to a separate sheet.
- **EmployeeIDSetup is not a second instance of the IT Setup bug.** Its SiteDocs and DSS fields
  are unconditionally required and that is correct — all 603 ID Setup Results rows have them all
  filled. Now asserted in the render oracle.
- **The `reference.*` enums are not enforced at all.** `validate()` checks `Array.isArray(e)`
  first, so `'reference.sites'` / `'reference.jrs'` / `'reference.jobNumbers'` are strings and
  pass anything. A `siteName` typo writes straight through. Known; not fixed.

---

## 8. Pending decision — the enum review

32 enum entries across 9 forms: **22 enforced** (a literal array → a wrong value returns
`E_VALIDATION`), **10 reference** (not enforced, per §7).

Any enforced enum whose list belongs to a system George owns is the same trap as
`siteDocsJobCode`. **`dssLanguage` (`English`/`Spanish`) is the obvious next one.** Per row the
options are: leave it, remove the enum, or point it at a list he can maintain.

Full table with a blank decision column: `docs/runs/2026-11-05-enum-review-and-deploy.md` §2.

---

## 9. Test commands

From `employee_management_v2/`:

```
node __tests__/super-test.js
node __tests__/efx-test.js
node __tests__/form-field-map-test.js
node __tests__/dashboard-test.js
node __tests__/config-test.js
node __tests__/test-guard-test.js
node __tests__/efx-e2e-test.js
node __tests__/form-render-test.js
```

From `employee_forms_deployment/`:

```
node tools/efx/n8n-check.js
```

**Expected, all green as of 2026-11-05:**
`super-test` 159 · `efx-test` 218 · `form-field-map-test` 315 · `dashboard-test` 27 ·
`config-test` 24 · `test-guard-test` 22 · `efx-e2e-test` **602** · `form-render-test` 64
Contract gate: `OK: contracts compatible with docs/contracts.lock.json`

All suites run on a Node mock of Apps Script (`__tests__/gas-runtime.js`). **No Google calls, no
emails sent** — every message is captured by the MailApp mock and written to `docs/test-logs/`.
`efx-e2e-test` has a `defect()` mechanism that records known prod bugs without failing the run;
pass `--strict` to fail on those too. Last run had **0 recorded defects**.

`form-render-test` is the suite that would have caught the IT Setup bug: it renders each real
template against fixtures and compares against an oracle derived from request data alone, so a
form cannot rubber-stamp itself.

---

## 10. Test links — paste directly, do NOT click through

Base (always serves HEAD):
`https://script.google.com/a/macros/team-group.com/s/AKfycbwIDtchHssOFkJJ4lwdFSZSjkDG_jaNg5oetT-BKaYd/dev`

| what | query |
|---|---|
| IT Setup — the reported case | `?form=it_setup&wf=EQUIP_REQ_20260831-144331_389` |
| IT Setup — control, full systems | `?form=it_setup&wf=EQUIP_REQ_20260824-145859_930` |
| Step tracker | `?form=request_details&wf=EQUIP_REQ_20260831-144331_389` |
| ID Setup — SiteDocs dropdown | `?form=id_setup&wf=<any open workflow>` |

**Every button in the portal is built from `getBaseUrl()`, which returns the pinned `@80` `/exec`
URL.** Any click bounces you out of `/dev` onto the old code and the fix looks broken. This has
already wasted an hour once.

---

## 11. The sequence

Each step needs Binns present. Do not chain them.

1. **Back up.** Commit the prod repo and push to GitHub. The local tree is the only copy.
2. **Drift check.** Copy `employee_management_v2/.clasp.json` into a scratch dir and `clasp pull`
   **there** — never in the repo folder, or it overwrites uncommitted work. Diff against
   `employee_management_v2/`. Confirms nobody edited in the Apps Script editor since 10-16.
3. **Decide the enum review** (§8). Any change here is a code change and must land before the push.
4. **Run all nine checks** (§9). All green or stop.
5. **Push to HEAD** — `clasp push -f` from `employee_management_v2/`. Ships all 3 local files.
6. **Test on `/dev`** (§10). Specifically: submit a gated IT Setup form (settles §6.1), and load
   ID Setup to confirm the SiteDocs dropdown.
7. **Identify the API-executable deployment** (§5). Do not skip — George stays blocked otherwise.
8. **Cut `@81` from HEAD**, repoint web app `AKfycbyXp4q0…` to `@81`.
   **Do not touch `@76` or `@75`.**
9. **Verify live:** dashboard loads, My Open Requests renders, badge counts moved (+6), one
   equipment IT Setup form opens.
10. **Verify n8n:** one real `n8n_submitIdSetup` carrying `HRLY-U`.
11. **Email George** confirming it is live and he can re-run.

**Rollback:** repoint `AKfycbyXp4q0…` back to `@80`. Nothing in this batch migrates data or
changes a schema, so rollback is clean.

---

## 12. Source documents

In `employee_forms_deployment/`:

- `docs/runs/2026-10-19-monday-deploy-plan.md` — the full deploy plan. **Its §1 is stale** (says
  HEAD is one file behind local; it is three). Everything else holds.
- `docs/runs/2026-11-05-handover.md` — the other session's handover; §3 is the collision warning
- `docs/runs/2026-11-05-enum-review-and-deploy.md` — the 32-entry enum table + plan
- `docs/runs/2026-10-16-equipment-it-confirmation.md` — the IT Setup bug, proven against prod data
- `docs/runs/2026-10-14-static-audit.md`, `docs/runs/2026-10-13-audit-and-perf.md`
- `docs/efx/handoff/AGENT_NOTE_2026-11-04_ENUMS.md` — briefing written for George's agent
- `docs/efx/N8N_CONTRACTS.md`, `docs/efx/wiki/FOR_GEORGE.md`, `docs/efx/wiki/COOKBOOK_FOR_GEORGE.md`
- `review/docs/00-INDEX.md` — all findings, ranked list of live defects
- `CLAUDE.md` — prod IDs, constraints, tooling gotchas

**Unrelated to this deploy, do not pull into scope:**
`P:\Projects\Company\N8N\BOSS_SESSION_PLAN.md` and `BOSS_DEV_PROMPT.md` — BOSS login/session work,
handed to the dev separately.

## 13. Reaching the earlier sessions

**Other session** (Oct 13–19 work: IT Setup gating, dashboard, audits):

```
local_89bbbf44-e42e-453a-8d11-63a9458b34eb
```

Transcript zip: `C:\Users\dbinns_robinsonsolut\Downloads\session-export-1793907577145.zip`

**This session** (Oct 13–14 static audit, Nov 3–6 SiteDocs/enum work):

```
8ffa527b-a91e-4a77-9997-d244ae7c7a71
```

Another session can read either with `list_events` or `search_session_transcripts`.

---

## 14. Known, not fixed, not in this deploy

- Quoted email username — `getITContextData:62` strips only leading/trailing quotes
- `RequestDetails` / `Dashboard` keyboard access — `onclick` on non-focusable elements, mouse-only
- Dashboard AODA never redefines `--success`/`--warning`/`--info` → ~1.9:1 in high-contrast mode
- `Placeholder.html` does not exist — `Specialist.js:23` falls back to it for any unmapped dept
- Three incompatible `details` payload shapes across the nine specialist forms
- `input[type="url"]` styled nowhere — `Review306090.html:37` renders white on the dark theme
- `Setup.js:185-213` seeds `Data_Lookup` column B with the six dead job codes and bails if the
  sheet already exists — effectively dead, but it would reseed a stale list on a fresh install

Full inventory: `review/docs/00-INDEX.md`.
