# Kickoff — deploy EFX to PROD Forms, then re-prove the chain against it

*Paste everything below into a NEW session. Written 2026-09-18 by the session that finished the TEST tier.*

---

## Read these first, in this order

1. `docs/runs/2026-09-18-IDSETUP-STATUS.md` — where ID Setup got to, and four live-found bugs
2. `docs/runs/2026-09-18-JR-DEMO-HANDOFF.md` — the JR chain, the test Lambda, the BOSS staging setup
3. `docs/plans/DEPLOY_NOTES_FROM_TEST_2026-09-17.md` — **the promotion steps; this is the important one**
4. `docs/handoff/` — the four documents being given to George; do not let them drift from reality

Then say where things stand in your own words before touching anything.

## How Binns wants you to work

- **One gate at a time.** State the plan, wait for approval, run that one thing.
- **Short answers, bullets.** See the response-style block at the top of `CLAUDE.md` — it is not optional.
- **Verify, do not assume.** If you have not seen the output, say so.
- **Manual steps:** what, why it cannot be automated, how, with a clickable link. One at a time.
- There is a gate-verifier subagent at `.claude/agents/efx-gate-verifier.md`. Use it at gate boundaries.

---

## Where things actually are

**Nothing is in production. George has been given nothing. His three workflows are untouched.**

| Thing | State |
|---|---|
| TEST tier | Fully working and proven — script, sheet, GCP, DWD, 27 aliases |
| `Forms · Close JR Task` | **Proven end to end**, including a human-driven run and a real BOSS staging assign |
| `Forms · Submit ID Setup` | **Proven end to end**, standalone and behind an approval click |
| PROD Apps Script | **Has none of the EFX layer.** No `N8n.js`, `EfxApi.js`, `FormContracts.js`, `Actor.js`. This deploy is the gap. |
| George's JR workflows | Active, untouched, still using the old `/exec` + shared password |

## Today's objective

1. Put **prod Forms** into maintenance mode so nobody submits during the work.
2. Merge and deploy the **EFX layer** to the prod Apps Script.
3. Migrate the **prod spreadsheet**.
4. Prove the door works against prod.
5. Re-run the JR and ID Setup chains against prod from n8n.

---

## Repo layout — read this before you open anything

The prod git repo root is **`P:\Repos\github\danieljbinns\APP SCRIPT FORMS`**, not the
`employee_forms_deployment` folder inside it. `employee_forms_efx` is a **separate repo nested in the
same tree** (the outer repo lists it as untracked). Work from the outer root so both are reachable.

- Prod Apps Script source: `employee_forms_deployment\employee_management_v2\`
- EFX layer + migration tools + these docs: `employee_forms_efx\`

Branches are not the thing that matters here — **what matters is what is actually deployed on the prod
Apps Script project.** Verify that first.

## Gate 0 — verify what is actually live on prod

Do not trust the repo to match the deployed script. Today we already found the prod deploy runbook
recording a different `/exec` deployment id than the one George's live workflow posts to.

1. `clasp pull` the prod script (`1AuIbJl1jRh1awi-MW-6y_NftHUGtfUNRexZk1gPzvenmIblSZo-lPz66`) into a
   scratch directory. **Do not pull over the repo.**
2. Diff it against `employee_forms_deployment\employee_management_v2\`.
   **Normalise line endings first** — the fork is LF and prod is CRLF, so a raw diff reports thousands
   of false changes. Use `tr -d ''` on both sides.
3. List the script's deployments and versions. Establish which one the web app serves and which one
   the anonymous `doPost` endpoint serves.
4. Report: does the repo match what is deployed, and if not, what differs.

**If the deployed code does not match the repo, stop and tell Binns.** Merging on top of an unknown
base is how you lose someone else's fix.

### What the merge actually is

Measured 2026-09-18, line endings ignored:

- **7 new files** — the EFX layer: `N8n.js`, `N8nEnvelope.js`, `EfxApi.js`, `EfxUtil.js`,
  `FormContracts.js`, `Actor.js`, `EmployeeIdRegistry.js`
- **470 changed lines across 17 existing files** — largest are `MigrationTools.js` (80), `RawLog.js`
  (76), `IDSetup.js` (65), `Setup.js` (50), `InitialRequestHandler.js` (45), `EmailUtils.js` (26),
  `ITConfirmationHandler.js` (24)
- **1 deletion: `BOSSReviewHandler.js`** — the dead duplicate `submitITConfirmation`. Removing it is
  **intended**; that cleanup was deliberate, not an accident of syncing files.

That is a reviewable merge. Treat any number larger than this as a line-ending artefact and check.

## Gate 1 — maintenance mode  (Binns does this; you cannot)

`MAINTENANCE_MODE` is a Script Property on the **prod** Apps Script. `efx-bot` has no access there and
the prod repo is read-only for this workstream — so this is an editor action by Binns, not a tool call.

Three things to tell him before he does it:

- **Set `MAINTENANCE_BYPASS_EMAILS` to his own address at the same time**, or he is locked out too.
- **It blocks the web forms only, and that is intended.** The check lives in `doGet`, so humans get the
  splash page while `doPost` — the anonymous endpoint George's JR workflow posts to — keeps working.
  **Do not pause George's workflow.** His automation is meant to run straight through the maintenance
  window; the point is only to stop people submitting forms by hand while the sheet is being migrated.
- Confirm it took effect by loading the prod web app before continuing.

## Gate 2 — prod sheet migration  (two steps, in this order)

Prod's `Initial Requests` header row stops at `BB`. **Two headers are missing**, and
`migrate-efx-sheet.js` aborts without them.

```powershell
cd migration
node add-missing-headers.js --sheet <PROD_ID> --key <sa.json> --impersonate <bot> --i-know-this-is-prod
node add-missing-headers.js --sheet <PROD_ID> --key <sa.json> --impersonate <bot> --i-know-this-is-prod --apply
node migrate-efx-sheet.js  --sheet <PROD_ID> --key <sa.json> --impersonate <bot> --i-know-this-is-prod
node migrate-efx-sheet.js  --sheet <PROD_ID> --key <sa.json> --impersonate <bot> --i-know-this-is-prod --apply
```

Dry run first, every time. Re-run both after applying — each must report no-op.

**`migration/MIGRATION_PLAN.md` still does not carry the `add-missing-headers` step.** Fix that doc as
part of this work; someone will follow it later and the migration will abort.

## Gate 3 — identity for the prod tier  ← decide before touching anything

The TEST tier uses `efx-bot@team-group.com` and the SA `efx-router@efx-test-teamgroup`. **Do not reuse
them for prod.** The reach of a credential is whatever its service account can touch, so one SA
spanning both tiers means a TEST credential silently gains prod reach.

Open question for Binns, and it blocks Gate 6:

- A **separate prod service account** (and possibly a separate bot), with its own DWD grant, or
- the same bot with a second SA scoped to prod.

Whatever is chosen, the n8n credential that eventually reaches George must be the **prod-tier** one.

## Gate 4 — deploy the code

Merge the EFX layer into the prod Apps Script project and deploy an API-executable version.

**Traps, all learned the hard way:**

- `clasp create --type webapp` **fails on clasp 3**. Use `--type standalone`.
- `clasp create` **silently overwrites `appsscript.json`**, destroying the advanced services, the
  webapp block, the executionApi block and all 10 scopes. **Run `git status appsscript.json`
  immediately afterwards.**
- Linking the script to a GCP project is **editor UI only** — no API, no clasp command.
- One deployment serves both the web app and the Execution API, because the manifest declares both.
- **Never re-version the `@75` anonymous deployment.** Its HEAD manifest is `DOMAIN`, so re-versioning
  flips it to login-required and breaks George's live automation. It must keep working through the
  overlap period.

## Gate 5 — prove the door against prod

Run `efxSelfTest` through the Execution API as the prod bot. Required:

- `principal` = the prod bot, **not** a human and not `efx-bot` if a new one was created
- `env` = `PROD`
- `spreadsheetId` = the prod sheet
- `contracts` = true, `dryRunClose` = `E_NOT_FOUND`

**If `principal` is wrong, stop.** Every role check downstream is meaningless.

## Gate 6 — re-prove the chains against prod

n8n-staging is the only n8n instance, so the workflows stay where they are — but the **credential and
the script id** change to the prod tier.

- Point a copy of the Router at the prod script id, with the prod credential.
- Re-run the ID Setup path, then the JR path.
- **Use a real but disposable hire.** This writes to the production spreadsheet — agree with Binns in
  advance what test data is acceptable and how it gets cleaned up.

## Gate 7 — hand over

Only after Gate 6 passes. `docs/handoff/` is written and ready; check it still matches reality,
especially anything that says "TEST".

---

## Things that will waste your time if you do not know them

**n8n**

- It **keys nodes by `id` and silently ignores a change of node `type`** — PUT returns 200, nothing
  changes. Give the node a fresh `id`.
- A workflow in project A **cannot use a credential owned by project B**. Writes that re-establish such
  a binding are rejected — *silently* on an in-place edit, explicitly once the node id changes. This
  cost an hour today.
- A sub-workflow defaults to `callerPolicy: workflowsFromSameOwner`; a cross-project call is refused
  with *"cannot be called by this workflow"*. Cross-project calls **do not** need the credential — only
  the caller allow-list. That was tested and confirmed.
- Changing a webhook's settings needs a **deactivate/activate cycle** to re-register; activating an
  already-active workflow is a no-op.
- The public API **cannot** move a workflow into a folder, and refuses a transfer whose destination
  project is unchanged. Workaround: hop out to another project and back with `destinationParentFolderId`.
- `$execution.resumeUrl` renders as **`http://localhost:5678`** — the instance's base URL is unset.
  Affects every Wait-for-form workflow on this n8n. Real fix is `WEBHOOK_URL` on the service.
- After a Wait resumes, **pre-wait node data is gone**. Stash anything needed in
  `$getWorkflowStaticData` before the wait.

**Apps Script / Google**

- `scripts.run` serves the **latest saved code immediately** — no redeploy needed, and no version pin.
  A bad push reaches n8n instantly.
- `scripts.run` can call **any top-level function**, not just the `n8n_*` aliases. The kill switch
  (`EFX_ALIASES_OFF` / `EFX_ALIASES_ON`) guards the aliases; nothing guards the rest.
- New **public Lambda Function URLs are blocked** in AWS account `185303224100`. Use an HTTP API.

---

## Open decisions Binns has not made

- **Prod service account** — the Gate 3 question. Blocks Gate 6.
- **Two n8n instance settings** — `WEBHOOK_URL` and `EXECUTIONS_DATA_SAVE_ON_PROGRESS`. Both affect
  every workflow on the box.
- **Test data on the prod sheet** — what is acceptable, and who cleans it up.
- `it_confirmation` and `specialist` stay `verified:false`. Do not un-gate them.

## Leftovers from 2026-09-18

- Test hires **500021–500032** on the TEST sheet, plus several `EfxSuite`/`EfxJr` rows. Disposable,
  but worth clearing before anyone is shown that data.
- A test Lambda `boss-jr-assign-efxtest` and HTTP API `9bnocpflf2` point at `staging.team-group.com`
  using Binns' own BOSS session cookie in `boss/session-cookies-efxtest`. **That cookie was pasted
  into a chat transcript — worth invalidating by logging out of BOSS staging once testing is done.**
- A separate task exists for reviewing non-browser BOSS auth (legacy login / Cognito). Out of scope here.
