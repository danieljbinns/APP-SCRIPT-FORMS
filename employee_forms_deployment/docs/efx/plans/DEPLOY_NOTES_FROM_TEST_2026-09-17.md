# Deploy notes learned from the TEST tier — 2026-09-17

Everything here was found by actually deploying and hammering the TEST tier. None of it was
catchable locally. Apply it to **dev** and **prod** promotions. New file on purpose — other agents
are editing `MIGRATION_PLAN.md` / `PROMOTION_PLAN_CODE.md` concurrently; fold this in when quiet.

---

## 1. Sheet migration is now TWO steps, in this order

```powershell
cd migration
# 1. headers the EFX migration depends on (BOTH were missing on prod)
node add-missing-headers.js --sheet <ID> --key <sa.json> --impersonate <bot>            # dry run
node add-missing-headers.js --sheet <ID> --key <sa.json> --impersonate <bot> --apply

# 2. the EFX migration itself
node migrate-efx-sheet.js  --sheet <ID> --key <sa.json> --impersonate <bot>             # dry run
node migrate-efx-sheet.js  --sheet <ID> --key <sa.json> --impersonate <bot> --apply
```

For prod add `--i-know-this-is-prod` to both.

**Why step 1 exists.** Prod's `Initial Requests` header row stops at `BB`. Two headers are absent:

| Sheet | Cell | Header |
|---|---|---|
| Initial Requests | `BC1` | `BOSS Training User Only` |
| IT Results | `W1` | `BOSS Details` |

`migrate-efx-sheet.js` **aborts** unless `BC1` is correct, so without step 1 the migration never runs.

**Grid width.** `migrate-efx-sheet.js` needed a fix: Apps Script silently widens a sheet when you write
past its last column, the Sheets REST API returns `400 exceeds grid limits`. A stock `Initial Requests`
is exactly 55 columns and the EFX header goes at 56, so **this fails on every un-migrated sheet**.
Fixed by `widenGridIfNeeded()` (appends columns only). Already in the repo.

**Re-run both after applying** — each must report no-op. Verified on TEST.

---

## 2. Workspace doors — one script per tier

```powershell
migration\setup-tier-doors.ps1 -Tier <test|dev|prod> -SheetId <ID>
migration\setup-tier-doors.ps1 -ShowDwd -SaClientId <21-digit uniqueId>
```

Idempotent: bot account, role groups, Groups Reader, Drive ACLs. Run against prod it refuses to create
or modify the real `grp.forms.*` groups.

**Domain-wide delegation stays manual** — Google exposes no API and GAM has no command for it. Deep link
with the client id and all 11 scopes prefilled works well; `-ShowDwd` prints it.

**Cloud Identity cannot join a Shared Drive.** The default attachment folders live in shared drive
`0AOOOWlqzpUNVUk9PVA`, so granting the bot writer on them fails with *"lack the necessary license"*.
Either give the bot a Drive licence, or (what TEST did) create My Drive folders and set
`MAIN_FOLDER_ID`, `TERM_ATTACHMENTS_FOLDER_ID`, `CHANGE_ATTACHMENTS_FOLDER_ID`.
**Those three properties are MANDATORY on any tier using the workaround**, not optional as §5 implies.

---

## 3. Apps Script project — two clasp traps

- `clasp create --type webapp` **fails on clasp 3** ("Invalid container file type"). Any `--type` other
  than `standalone` means a bound container document. Use `--type standalone`; the manifest's `webapp` /
  `executionApi` blocks are what grant those capabilities.
- **`clasp create` silently overwrites `appsscript.json`** with a bare remote template, destroying both
  advanced services (AdminDirectory — every role check needs it), the webapp block, the executionApi
  block and all 10 scopes. There is no prompt in clasp 3.
  **Run `git status appsscript.json` immediately after any `clasp create`** and restore if touched.
- Linking the script to the GCP project is **editor UI only** — no API, no clasp command.
- One deployment serves both the web app and the Execution API because the manifest declares both.

---

## 4. n8n import

- The public API creates in the **API key owner's personal project**; transferring to that same project
  returns `400 ... can't transfer into the same destination`. Treat that as success.
- Strip `active, id, meta, versionId, tags` before POST.
- `settings.errorWorkflow` holding an unresolved `<<ERROR_WORKFLOW_ID>>` makes the create fail — drop it.
- **n8n 2.x will not publish a workflow that references an unpublished sub-workflow.** The Router must be
  activated before anything calling it can be. Safe: its only trigger is `executeWorkflowTrigger`.
- Credential type `googleApi`: `email`, `privateKey`, `inpersonate:true`, `delegatedEmail`,
  `httpNode:true`, `scopes` (space-separated), `allowedHttpRequestDomains:'all'`.
- **Nothing in the EFX set is externally triggerable** (sub-workflows / schedules / manual only, and the
  public API has no "run workflow" endpoint). A small webhook-triggered test workflow was added so the
  aliases can be exercised automatically; keep it secret-protected and out of shared projects.

---

## 5. Router — the envelope is FLATTENED

`Unwrap & guard` does `Object.assign({ok:true}, env.result, meta)`, so `workflowId`,
`internalEmployeeId` etc. sit at the **top level**, not under `.result`. A direct Execution API call
keeps the nested shape. Anything written against the direct shape breaks behind the Router.

**Error codes:** the Router throws on any `ok:false` envelope so n8n marks the execution failed. n8n's
Code node then strips the leading `EFX <CODE>: ` from `error.message` (it survives only in `error.stack`)
and splits the message mid-payload when it contains JSON. The code is now also emitted as a trailing
**`[efxCode=<CODE>]`** tag. **Error workflows and George's docs must branch on that tag**, not on the
leading prefix the old comment advertised.

---

## 6. Prod data check worth doing before promotion

`submitITConfirmation` used to blank ~24 `Initial Requests` columns when called with a partial payload
(fixed in this fork). **The UI always posts the full object, so prod data is very likely intact** — but
it is cheap to confirm. Look for prod `Initial Requests` rows with a `Workflow ID` but a blank
`First Name` / `Last Name`, especially any that reached IT Confirmation. Not checked here: prod is
read-only for this workstream.

---

## 7. Still gated — do not un-gate blind

| Form | State | Why |
|---|---|---|
| `it_confirmation` | `verified:false` | Data-loss bug fixed and re-proven live, duplicate handler deleted. Still does not close its own action item. Flipping to `true` is a one-line change once someone owns that decision. |
| `specialist` | `verified:false` | `targetSheet: 'Specialist Results'` does not exist on the spreadsheet. Feature is long dead. Use `n8n_closeTask` / `n8n_assignSafetyTraining`. |

`verified:false` is **enforced**, not documentation — `n8n_submitForm` returns `E_UNVERIFIED_FORM` and
names the reason, with `options.allowUnverified=true` as a deliberate override. That gate is what stood
between an automation caller and the data loss above. Keep it.
