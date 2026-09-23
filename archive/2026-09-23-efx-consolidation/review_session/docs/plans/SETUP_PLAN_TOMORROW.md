# Setup plan — Thursday 2026-09-17: EFX TEST tier deployed and callable from n8n staging by 16:00

Owner of every step: **Binns (dbinns@team-group.com)** unless marked otherwise. Steps marked **[SUPER-ADMIN]** need a
Google Workspace super-admin session (Admin console); GAM `role-admin` covers the directory writes but Admin console
DWD is UI-only. George is **not** required today (T7/T8 in `TEST_PLAN.md` can run without him).

Hard rules for the day: prod spreadsheet `1kGjw8e-uIehaBemlsRZ4Yq1QrYOWkJvWzhKbgfl4Pxo` and prod script
`1AuIbJl1jRh1awi-MW-6y_NftHUGtfUNRexZk1gPzvenmIblSZo-lPz66` are never opened for edit, never pushed to, never
migrated. Every id you create today gets written into the **Values sheet** below before moving on.

Tools verified on binns-t14 (2026-09-16): `node v25.2.0`, `clasp 3.1.3` (`create-script|create`, `push`, `create-deployment|deploy`,
`list-deployments`, `open-script`, `show-authorized-user`, `status`), `gcloud` (Chocolatey SDK), `gam` at `C:\GAM7`. The fork has a
`.claspignore` excluding `__tests__/**` and `docs/**`, so `clasp push` will not upload the Node test files.

## Values sheet (fill as you go — keep in the ticket/scratchpad, NOT in the repo)

| Key | Value | From step |
|---|---|---|
| `TEST_SHEET_ID` | | §1 |
| `GCP_PROJECT_ID` (`efx-test` or fallback) | | §2 |
| `GCP_PROJECT_NUMBER` | | §2 |
| `SA_EMAIL` `efx-router@<project>.iam.gserviceaccount.com` | | §2 |
| `SA_CLIENT_ID` (uniqueId, 21 digits) | | §2 |
| SA key path `D:\Credentials\google\efx\efx-router-test.json` | | §2 |
| `TEST_SCRIPT_ID` | | §5 |
| `TEST_WEBAPP_URL` (`/exec`) | | §5 |
| `TEST_API_DEPLOYMENT_ID` | | §5 |
| n8n credential name `EFX Google SA (test)` | | §8 |
| n8n workflow ids after import (`00_EFX_Router` first) | | §8 |

---

## Timeline

| Time | § | Step | Est. |
|---|---|---|---|
| 08:30 | 0 | Pre-flight | 15 min |
| 08:45 | 1 | Copy prod spreadsheet → TEST | 15 min |
| 09:00 | 2 | GCP project, APIs, consent screen, SA, key | 30 min |
| 09:30 | 3 | Domain-wide delegation **[SUPER-ADMIN]** | 15 min |
| 09:45 | 4 | `efx-bot` user, Groups Reader, sharing (GAM) | 25 min |
| 10:10 | 5 | TEST Apps Script project: create, push, link GCP, properties, deployments | 45 min |
| 10:55 | 6 | Sheet migration on TEST | 15 min |
| 11:10 | 7 | First calls: `efxSelfTest()`, DWD token, Execution API curl (T0/T1) | 30 min |
| 11:40 | — | Buffer / lunch | 50 min |
| 12:30 | 8 | n8n staging: credential, import workflows, placeholders | 60 min |
| 13:30 | 9 | Smoke from n8n (T2–T4) | 60 min |
| 14:30 | — | Buffer for anything that slipped | 60 min |
| 15:30 | 10 | Wrap: values sheet complete, redirect confirmed, status note | 30 min |
| 16:00 | | **Deployed TEST tier: n8n → Router → TEST Forms → TEST sheet, emails redirected** | |

---

## §0 Pre-flight (08:30, 15 min)

- [ ] PowerShell as your normal user. `node --version` → `v25.x`; `clasp --version` → `3.1.3`; `gcloud --version`; `gam version` (with `GAMCFGDIR` set — see §4).
- [ ] `clasp show-authorized-user` → shows `dbinns@team-group.com`. If not: `clasp login` (browser consent). *Expected:* email printed.
- [ ] `gcloud auth list` → `dbinns@team-group.com` active. If not: `gcloud auth login`. *Expected:* `*  dbinns@team-group.com`.
- [ ] `gcloud organizations list` → note `ORG_ID` for team-group.com. *If empty:* your account is not an Org Viewer — a project can still be created without `--organization` but the OAuth consent screen then cannot be "Internal" → **stop and get org access** (super-admin can grant `roles/resourcemanager.organizationViewer` + `roles/resourcemanager.projectCreator`).
- [ ] Confirm the fork's `.clasp.json` still says `REPLACE_ME_efx_test_script_id__NEVER_PROD` (nothing has been created yet): `Get-Content "P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_efx\employee_management_v2_efx\.clasp.json"`.
- [ ] Node tool deps installed: `cd …\employee_forms_efx\migration; npm install; npm run check` → `SYNTAX OK` equivalent (no output = ok).
- [ ] Read `TEST_PLAN.md` T0–T4 once so you know what "done" looks like.

**Abort line:** any tool missing → fix before 09:00 or push the whole day; nothing below works without clasp + gcloud + gam.

---

## §1 Copy the prod spreadsheet for TEST (08:45, 15 min)

Drive UI (simplest, and you can see the result):
- [ ] Open `https://docs.google.com/spreadsheets/d/1kGjw8e-uIehaBemlsRZ4Yq1QrYOWkJvWzhKbgfl4Pxo` (read-only in your head: do not type into it).
- [ ] **File → Make a copy**. Name: `Employee Managment Forms — EFX TEST` (keep the existing spelling so title searches match). Folder: My Drive → new folder `EFX TEST`. **Untick "Share it with the same people"** (the prod sheet is shared with HR/IT/ID-Setup groups; the copy must not be). Untick "Copy comments". Strip nothing else — all tabs, all rows, all reference tabs come along.
- [ ] Wait for the copy to open (large sheet: 1–2 min). Copy the id from the URL → `TEST_SHEET_ID`.

GAM alternative (runs as you, no browser): `gam user dbinns@team-group.com copy drivefile 1kGjw8e-uIehaBemlsRZ4Yq1QrYOWkJvWzhKbgfl4Pxo newfilename "Employee Managment Forms — EFX TEST"` — *syntax not in the GAM skill references; if it errors, use the UI.*

Verify:
- [ ] Tab count equals prod (open both, compare the tab strip; expect `Workflows`, `Dashboard_View`, `Initial Requests`, `ID Setup Results`, `HR Verification Results`, `IT Results`, `Action Items`, `Terminations`, `Position Changes`, `Reference_*`, `Raw Log`, `Audit Log`, …).
- [ ] `Extensions → Apps Script` on the **copy** opens an empty bound project or nothing — prod's script is standalone, so the copy must **not** carry a bound script with triggers. If it does: delete that bound project's triggers (Triggers page) — otherwise the copy could send emails on edit.
- [ ] `Initial Requests` row 1 col **BC** = `BOSS Training User Only`, col **BD** empty. If BC is blank → note it; §6 handles it (`migrateAddMissingHeaders()`).
- [ ] Sharing on the copy = only you. (Add `efx-bot` in §4.)

**Rollback/abort:** trash the copy. Nothing else depends on it yet.

---

## §2 GCP project `efx-test` (09:00, 30 min)

```powershell
$ORG_ID = "<from §0>"
gcloud projects create efx-test --name="EFX Test" --organization=$ORG_ID
```
*Expected:* `Waiting for [operations/cp…] to finish...done. Enabling service [cloudapis.googleapis.com]…`.
*If* `The project ID you specified is already in use by another project` → project ids are global: use `efx-test-teamgroup` (and later `efx-dev-teamgroup` …) and put that id everywhere `<project>` appears below. Record `GCP_PROJECT_ID`.

```powershell
gcloud config set project <GCP_PROJECT_ID>
gcloud projects describe <GCP_PROJECT_ID> --format="value(projectNumber)"          # → GCP_PROJECT_NUMBER (12 digits)
gcloud services enable script.googleapis.com admin.googleapis.com sheets.googleapis.com drive.googleapis.com logging.googleapis.com iamcredentials.googleapis.com iap.googleapis.com
```
*Expected:* `Operation "operations/acat…" finished successfully.` (~1 min). No billing account is needed for these APIs.

OAuth consent screen — **required** before Apps Script will accept the project link:
```powershell
gcloud iap oauth-brands create --application_title="Employee Forms EFX TEST" --support_email=dbinns@team-group.com
gcloud iap oauth-brands list
```
*Expected:* `name: projects/<number>/brands/<number>`, `orgInternalOnly: true`. *If* `oauth-brands create` is rejected (some SDK builds gate it): Console → `https://console.cloud.google.com/apis/credentials/consent?project=<GCP_PROJECT_ID>` → User type **Internal** → app name / support email / developer email → Save. Same result.

Service account + key:
```powershell
gcloud iam service-accounts create efx-router --display-name="EFX Router (test)"
gcloud iam service-accounts describe efx-router@<GCP_PROJECT_ID>.iam.gserviceaccount.com --format="value(uniqueId)"   # → SA_CLIENT_ID
New-Item -ItemType Directory -Force D:\Credentials\google\efx | Out-Null
gcloud iam service-accounts keys create D:\Credentials\google\efx\efx-router-test.json --iam-account=efx-router@<GCP_PROJECT_ID>.iam.gserviceaccount.com
```
*Expected:* `created key [<40 hex>] of type [json] as [D:\Credentials\google\efx\efx-router-test.json] for [efx-router@…]`.
*If* `FAILED_PRECONDITION: Key creation is not allowed on this service account` → org policy `iam.disableServiceAccountKeyCreation` is enforced. n8n's Google Service Account credential needs a private key, so this is a **blocker**: an Org Policy Admin must add a project-level exception for `<GCP_PROJECT_ID>` (Console → IAM & Admin → Organization Policies → "Disable service account key creation" → Manage policy → Customize → Add rule → Enforcement Off, at project scope). **[SUPER-ADMIN / Org Admin]**

No IAM role grant is needed on the SA — with DWD it acts as `efx-bot`, and the Execution API authorises by GCP project membership of the OAuth client, not by IAM.

- [ ] Values sheet: `GCP_PROJECT_ID`, `GCP_PROJECT_NUMBER`, `SA_EMAIL`, `SA_CLIENT_ID`, key path.

**Rollback/abort:** `gcloud projects delete <GCP_PROJECT_ID>` (30-day soft delete). Key file → `gcloud iam service-accounts keys delete <keyId> --iam-account=…` and shred the JSON.

---

## §3 Domain-wide delegation **[SUPER-ADMIN]** (09:30, 15 min)

Admin console → `https://admin.google.com` → **Security → Access and data control → API controls → Manage Domain Wide Delegation** → **Add new**.

- Client ID: `SA_CLIENT_ID` (the 21-digit `uniqueId` — *not* the email).
- OAuth scopes (one comma-separated line — the fork's `appsscript.json` `oauthScopes` + `script.projects`):

```
https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/drive,https://www.googleapis.com/auth/script.external_request,https://www.googleapis.com/auth/script.send_mail,https://www.googleapis.com/auth/userinfo.email,https://www.googleapis.com/auth/userinfo.profile,https://www.googleapis.com/auth/admin.directory.user.readonly,https://www.googleapis.com/auth/admin.directory.group.member.readonly,https://www.googleapis.com/auth/directory.readonly,https://www.googleapis.com/auth/contacts.readonly,https://www.googleapis.com/auth/script.projects
```
- **Authorize**. *Expected:* a row with the client id and "11 scopes".

Verification happens in §7 (token mint as `efx-bot`); DWD changes can take a few minutes to propagate.

**Rollback/abort:** delete the row. No other state.

---

## §4 `efx-bot@team-group.com`, Groups Reader, sharing (09:45, 25 min)

Every GAM call in one PowerShell session, profile set first (per the gam-workspace-admin skill — the default config path is broken):
```powershell
$env:GAMCFGDIR = "D:\Credentials\google\gam\role-admin"
gam info domain                 # live smoke: customer C03d636f7, primary domain robinsonsolutions.com
```

Create the bot (Cloud Identity licence is enough — it never reads mail; confirm licensing behaviour against an existing bot):
```powershell
gam info user n8n-printing@team-group.com          # look at the "Licenses" block — this is the pattern to match
gam create user efx-bot@team-group.com firstname EFX lastname Bot password random changepassword off org "/Bot Accounts"
gam info user efx-bot@team-group.com                # OU must be /Bot Accounts; note Licenses
```
*Expected:* `User: efx-bot@team-group.com, Created`. *If* the tenant auto-assigns a paid Workspace licence and you want Cloud Identity only: `gam user efx-bot@team-group.com delete license <SKU-shown>` then `gam user efx-bot@team-group.com add license cloudidentity` — *licence verbs are not in the skill references; verify against the GAM wiki before running, or just leave whatever auto-assign gave it for today.*
*Why `/Bot Accounts`:* org-wide security resets sweep the root OU (team-n8n-infra skill).

Groups Reader admin role (needed for `AdminDirectory.Members.hasMember` when Forms code runs as `efx-bot`):
```powershell
gam print adminroles                                              # find the Groups Reader role: expect roleName _GROUPS_READER_ROLE
gam create admin efx-bot@team-group.com _GROUPS_READER_ROLE customer
gam print admins user efx-bot@team-group.com                     # verify: one row, role _GROUPS_READER_ROLE, scope CUSTOMER
```
*Expected:* `Admin: efx-bot@team-group.com, Role: _GROUPS_READER_ROLE, Created`.
**Verification note:** the `gam create admin <user> <role> customer` form is the GAM7 wiki syntax; it is **not** covered by the three reference files in the gam-workspace-admin skill (`gam_syntax_gotchas.md`, `lookups_and_queries.md`, `offboarding_checklist.md` — I read all three; they cover clears, vacation, datatransfer, lookups only). If `_GROUPS_READER_ROLE` is rejected, use the numeric `roleId` from `gam print adminroles` in its place. Assigning admin roles requires the `role-admin` profile's user to be a super-admin — if you get `403 Not Authorized to access this resource/api`, this step is **[SUPER-ADMIN]** via Admin console → Account → Admin roles → Groups Reader → Assign users.

Share the TEST sheet and the attachment folders with the bot as **Editor**:
```powershell
gam user dbinns@team-group.com add drivefileacl <TEST_SHEET_ID> user efx-bot@team-group.com role writer
gam user dbinns@team-group.com add drivefileacl 1vBZVuzXmSatnLGiqhU7QoS0zBK2NGDQE user efx-bot@team-group.com role writer   # MAIN_FOLDER_ID default (dev)
gam user dbinns@team-group.com add drivefileacl 1yD1j82KTJ2EksLnN_fJ02zQWEUAlSRBW user efx-bot@team-group.com role writer   # TERM_ATTACHMENTS_FOLDER_ID default (dev)
gam user dbinns@team-group.com add drivefileacl 1gRjQiw34JTvyqwqfnBlJYs6JdmeYjzr1 user efx-bot@team-group.com role writer   # CHANGE_ATTACHMENTS_FOLDER_ID default (dev)
```
*Expected per line:* `User: dbinns@team-group.com, Drive File/Folder ACL … Added`. *If* the `drivefileacl` syntax errors (also not in the skill references): Drive UI → Share → `efx-bot@team-group.com` → Editor → untick "Notify". The three folder ids are the `ConfigurationService.DEFAULTS` (dev attachment folders) — the TEST script inherits them if you set no folder properties in §5; sharing dev folders with the bot is fine. If you prefer dedicated TEST folders, create two in `My Drive/EFX TEST` and set `TERM_ATTACHMENTS_FOLDER_ID` / `CHANGE_ATTACHMENTS_FOLDER_ID` in §5 instead.

- [ ] Values sheet: nothing new, but tick: bot exists in `/Bot Accounts`, Groups Reader shows in `print admins`, sheet ACL shows `efx-bot` writer.

**Rollback/abort:** `gam delete admin <roleAssignmentId>` (id from `print admins`), `gam delete user efx-bot@team-group.com` (or `gam update user … suspended on` if you want to keep it), remove the ACLs (`gam user dbinns@team-group.com delete drivefileacl <id> efx-bot@team-group.com`).

---

## §5 TEST Apps Script project (10:10, 45 min)

```powershell
cd "P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_efx\employee_management_v2_efx"
Copy-Item .clasp.json .clasp.json.placeholder.bak         # keep the placeholder file for reference
Remove-Item .clasp.json                                   # clasp create refuses to run if a .clasp.json exists
clasp create --type webapp --title "Employee Forms EFX TEST"
```
*Expected:* `Created new webapp script: https://script.google.com/d/<TEST_SCRIPT_ID>/edit` and a fresh `.clasp.json` with that id. If clasp asks to overwrite `appsscript.json` from the remote template, answer **No** — the fork's manifest is the one we want.
- [ ] Open the new `.clasp.json`; make sure it contains `"scriptId": "<TEST_SCRIPT_ID>"` and `"rootDir": ""` (or omitted). Re-add `"skipSubdirectories": false` if absent so `Services/` is pushed. Record `TEST_SCRIPT_ID`. **Compare with prod id `1AuIbJl1jR…` — they must differ.**

```powershell
clasp status          # lists files to push — sanity: Services/*.js present, __tests__/ and docs/ absent
clasp push -f
```
*Expected:* `Pushed N files.` (≈ 90). *If* `Manifest file has been updated. Do you want to push and overwrite?` → `y`. *If* a push error names a file: `node --check <file>` locally first — the fork should be clean.

Link the GCP project (editor UI — no CLI for this):
```powershell
clasp open-script
```
- [ ] Editor → ⚙ **Project Settings → Google Cloud Platform (GCP) Project → Change project** → paste `GCP_PROJECT_NUMBER` → **Set project**. *Expected:* the settings page shows project number + `<GCP_PROJECT_ID>`. *If* "The Cloud project you selected does not have a configured OAuth consent screen" → §2 consent screen missing. *If* "You do not have permission" → your user is not Owner/Editor on the project (`gcloud projects add-iam-policy-binding <GCP_PROJECT_ID> --member=user:dbinns@team-group.com --role=roles/owner`).

Script Properties (Project Settings → Script properties → Add script property):

| Property | Value | Why first |
|---|---|---|
| `EMAIL_REDIRECT_ALL` | `dbinns@team-group.com` | **Set this before any function runs.** The fork's `Config.js` has `ENVIRONMENT = 'TEST'`, so `sendFormEmail` already force-redirects to dbinns when this property is unset — set it anyway (belt and braces, and it is what prod relies on). |
| `SPREADSHEET_ID` | `TEST_SHEET_ID` | otherwise `ConfigurationService.DEFAULTS` points at the **dev** sheet `1o2Kul…` |
| `DEPLOYMENT_URL` | *(after the web-app deploy below)* | form links in emails |
| `TERM_ATTACHMENTS_FOLDER_ID`, `CHANGE_ATTACHMENTS_FOLDER_ID`, `MAIN_FOLDER_ID` | *(only if you made dedicated TEST folders in §4)* | else dev defaults apply |

- [ ] Editor → select `listScriptProperties` → **Run** → first run prompts OAuth consent for the 10 manifest scopes as `dbinns` → Allow. *Expected log:* `EMAIL_REDIRECT_ALL = dbinns@team-group.com`, `SPREADSHEET_ID = <TEST_SHEET_ID>`. *If* the consent screen says "unverified app" → it is Internal; proceed.
- [ ] Run `efxSelfTest` → log JSON with `ping.result.spreadsheetId === TEST_SHEET_ID`, `ping.result.env === 'TEST'`, `contracts: true`, `dryRunClose.error.code: 'E_NOT_FOUND'`. **Stop if `spreadsheetId` is the prod id** — you typed the wrong id in `SPREADSHEET_ID`.

Deployments (editor → **Deploy → New deployment**):
- [ ] Type **Web app** · Description `EFX TEST portal` · Execute as **Me** · Who has access **Anyone within TEAM Group (team-group.com)** → Deploy → copy the `/exec` URL → `TEST_WEBAPP_URL` → set `DEPLOYMENT_URL` property to it.
- [ ] Type ⚙ **API Executable** · Description `efx-api v1` · Who has access **Anyone within TEAM Group** (the manifest says `ANYONE`; narrowing per-deployment is fine — `efx-bot` is in-domain) → Deploy → copy the **Deployment ID** → `TEST_API_DEPLOYMENT_ID`.
- [ ] `clasp list-deployments` → both ids listed with `@1`/`@2`. Record.
- [ ] Editor **Share** (top right) → `efx-bot@team-group.com` → Viewer → untick notify. (Belt-and-braces: the Execution API also checks the caller can access the script file.)

**Rollback/abort:** the TEST script is disposable — Drive → trash the script file. Restore `.clasp.json` from the `.bak` placeholder so the fork cannot accidentally point at anything.

---

## §6 Sheet migration on TEST (10:55, 15 min)

Editor path (script already points at TEST):
- [ ] Run `migrateEfxDryRun` → Execution log: `[migrateEfx] WOULD add header 'Internal Employee ID' at Initial Requests col 56`, `WOULD create sheet 'Employee IDs' with headers`, and for Raw Log either `WOULD add headers 'Event ID','Kind' at Raw Log cols 6-7` or `Raw Log sheet absent … (no-op)`.
  *If* the log has `WARNING: Initial Requests has N columns; schema expects header at col 56` → `BC1` isn't `BOSS Training User Only` → run `migrateAddMissingHeaders` first, re-run the dry run.
- [ ] Run `migrateEfxApply` → same lines with `DID`.
- [ ] Run `migrateEfxBackfillDryRun` → `[migrateEfxBackfill] WOULD add ~400, skipped M` → `migrateEfxBackfillApply`.

Node path (equivalent; also proves the SA/DWD chain against the Sheets API — do it as a cross-check even if you used the editor; it should print all `=` no-ops):
```powershell
cd "P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_efx\migration"
node migrate-efx-sheet.js --sheet <TEST_SHEET_ID> --key D:\Credentials\google\efx\efx-router-test.json --impersonate efx-bot@team-group.com --backfill
```
*Expected:* `Auth: efx-router@… impersonating efx-bot@team-group.com`, `Title: "Employee Managment Forms — EFX TEST"`, then `=` lines, `DRY RUN complete — 0 change(s)`. *If* `unauthorized_client` → §3 DWD not propagated yet (wait 5 min) or scope list mismatch. *If* `403 … share the spreadsheet` → §4 ACL missing.

- [ ] Sheet check: `Initial Requests!BD1 = Internal Employee ID`; `Employee IDs` tab with red header + ~400 backfill rows; `Raw Log!F1:G1 = Event ID | Kind` (if the tab exists).

**Rollback/abort:** `migration/MIGRATION_PLAN.md` §2.4 — clear `BD1`, delete `Employee IDs`, clear `F1:G1`.

---

## §7 First calls (11:10, 30 min) — TEST_PLAN T0 + T1

- [ ] `efxSelfTest` again (post-migration) → same as §5.
- [ ] DWD token as efx-bot:
  ```powershell
  cd "P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_efx\migration"
  $TOKEN = node print-dwd-token.js --key D:\Credentials\google\efx\efx-router-test.json --subject efx-bot@team-group.com
  $TOKEN.Length     # ~200+ chars
  ```
- [ ] Execution API ping:
  ```powershell
  $body = '{"function":"n8n_ping","parameters":[],"devMode":false}'
  Invoke-RestMethod -Method Post -Uri "https://script.googleapis.com/v1/scripts/<TEST_SCRIPT_ID>:run" -Headers @{Authorization="Bearer $TOKEN"} -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 8
  ```
  *Expected:* `done: true`, `response.result.ok: true`, `response.result.result.spreadsheetId == TEST_SHEET_ID`, `apiVersion: 2026.09.17-1`, `callerSession: authenticated`.
  *If* `404 Requested entity was not found` → retry with `<TEST_API_DEPLOYMENT_ID>` in place of the script id (Google's docs say the deployment id is the right value when created in the new IDE) — whichever works is the value for `<<EFX_SCRIPT_ID>>` in §8; record it.
  *If* `403 PERMISSION_DENIED … caller does not have permission` → the script is not linked to `<GCP_PROJECT_ID>` (§5) or the API-executable deployment is missing / not visible to efx-bot.
  *If* `401` → token expired/invalid (re-mint) or DWD scopes missing `script.projects`… (actually the run call needs the *script's* scopes; check the 11-scope list in §3).
  Full expected/failure matrix: `TEST_PLAN.md` T1.

**Abort line:** if T1 cannot be made to pass by 12:30, do §8 anyway (n8n import is independent) but the 16:00 target degrades to "n8n imported, GCP door still closed" — write that down rather than debugging into the evening.

---

## §8 n8n staging (12:30, 60 min)

Login `https://n8n-staging.team-group.com` (password login; no SSO). Project: **Team Group** (`kOteX9ImmtqV980I`) — same project as George's live JR clone so he can see the wrappers.

Credential:
- [ ] Credentials → **Add credential** → search **Google Service Account API** → name **`EFX Google SA (test)`**.
  - Service Account Email: `SA_EMAIL`
  - Private Key: the `private_key` value from the JSON, pasted verbatim including `-----BEGIN PRIVATE KEY-----` and the `\n` sequences (n8n accepts either literal newlines or `\n`).
  - **Impersonate a User: ON** → `efx-bot@team-group.com`
  - **Set up for use in HTTP Request node: ON** → Scopes: the same 11 scopes as §3, space-separated.
  - Save. *Expected:* saved without error (this credential type has no "Test" button; T2 is the test).
- [ ] Optional but useful for later automation: Settings → **n8n API** → Create API key (label `efx-agent-2026-09`) → store the value in your password manager / scratchpad, **not** in any repo (the previous key expired 2026-08-30 per memory).

Workflows (from the fork's `n8n/` folder — written by the other agent; import in this order):
- [ ] Replace placeholders in copies (never edit the repo files in place with real ids):
  ```powershell
  $src = "P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_efx\n8n"
  $out = "$env:TEMP\efx-n8n-import"; New-Item -ItemType Directory -Force $out | Out-Null
  # phase 1: import 00_EFX_Router.json (below) and copy its id from the URL → $ROUTER_ID; then run this replace for everything else
  $ROUTER_ID = "<id n8n gave 00_EFX_Router>"
  Get-ChildItem "$src\*.json" | ForEach-Object {
    (Get-Content $_.FullName -Raw) -replace '<<EFX_SCRIPT_ID>>','<value that worked in §7>' -replace '<<TIER>>','test' -replace '<<EXPECTED_TEST_SHEET_ID>>','<TEST_SHEET_ID>' -replace '<<ROUTER_WORKFLOW_ID>>',$ROUTER_ID |
      Set-Content -Encoding utf8 (Join-Path $out $_.Name)
  }
  Select-String -Path "$out\*.json" -Pattern '<<' | Select-Object -First 5     # expect no output — no placeholders left (see the full placeholder list in n8n/README.md; 40/41 also carry SiteDocs/Litmos credential placeholders that may stay unresolved today — they are inactive)
  ```
- [ ] Workflows → **Create workflow** → ⋯ (top right) → **Import from File** → `00_EFX_Router.json` → Save. Open the HTTP Request node(s): credential dropdown must show `EFX Google SA (test)` (select it if the import left it blank). Note the new workflow id → Values sheet.
- [ ] Import `10_…` through `28_…` (one wrapper per alias; `10–16` are the ones T4–T8 use, the rest can wait if time is short), `20_Forms_EventsPoller.json`, `30_EFX_Canary.json`, `90_EFX_E2E_Test.json`, and — **inactive, do not activate** — `40_Ref_Onboarding_via_EFX.json`, `41_Ref_OpenTasks_Digest.json` the same way. Run `node tools/n8n-workflows-check.js` from the fork root first (lint gate for the JSON). For each wrapper open its **Execute Workflow** node: if it references the Router by **id**, the id changed on import → re-select `00_EFX_Router` from the list; if it references by name, confirm it resolved. Save each.
- [ ] Do **not** activate anything yet except `30_EFX_Canary` (schedule) once T2 passes; `20_Forms_EventsPoller` activates for T9 only.
- [ ] Error workflow: Settings on `00_EFX_Router` → Error workflow → pick an existing "alert dbinns" workflow if one exists, else skip today.

**Rollback/abort:** delete the imported workflows and the credential — nothing on the Forms side knows about n8n (poller model: n8n calls in, Forms never calls out; `EFX_EVENT_WEBHOOK_URL` stays empty).

---

## §9 Smoke from n8n (13:30, 60 min) — TEST_PLAN T2, T3, T4

Run manually (Test workflow / Execute step) in this order; details and pass criteria in `TEST_PLAN.md`:
- [ ] **T2** Router ping → `ok:true`, `spreadsheetId == TEST_SHEET_ID`.
- [ ] **T3** contracts → `forms[]` contains `new_hire`, `id_setup` with `verified:true`.
- [ ] **T4** create initial request → `workflowId NEW_EMP_…`, `internalEmployeeId ≥ 30000`; row in `Initial Requests` (col BD filled), row in `Employee IDs` (`Source = submitInitialRequest`), `Raw Log` `result` row, and **redirected** emails in dbinns' inbox with `[REDIRECT]`-style markers.
- [ ] Activate `30_EFX_Canary` → wait one interval → execution green.

If time allows: T5 (ID Setup via n8n) and T6 (human UI on `TEST_WEBAPP_URL`).

---

## §10 Wrap (15:30, 30 min)

- [ ] Values sheet complete; SA key only at `D:\Credentials\google\efx\` (and inside the n8n credential); nothing in git: `git -C "P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_efx" status --short` shows only the intended `.clasp.json` change (and it holds the **TEST** id).
- [ ] `listScriptProperties` on TEST one last time: `EMAIL_REDIRECT_ALL = dbinns@team-group.com` still set.
- [ ] Prod untouched: `clasp list-deployments 1AuIbJl1jRh1awi-MW-6y_NftHUGtfUNRexZk1gPzvenmIblSZo-lPz66` still shows the same deployments as this morning (portal `AKfycbyXp4q0…`, anon `AKfycbw7fhvI…` @76). Read-only check.
- [ ] Fill the results table in `TEST_PLAN.md` for whatever ran; open items → tomorrow.

---

## Things I could not verify while writing this (check live, do not assume)

1. `gam create admin … _GROUPS_READER_ROLE customer`, `gam create user … org "/Bot Accounts"`, `gam user … add drivefileacl …`, `gam user … copy drivefile …`, licence add/delete — the GAM skill references do not cover these verbs; they are GAM7 wiki syntax. `gam print adminroles` / `gam print admins` are the pre-checks.
2. Whether `efx-test` is free as a global GCP project id (fallback `efx-test-teamgroup`).
3. Whether `iam.disableServiceAccountKeyCreation` is enforced on the org (blocks §2 key creation).
4. Whether the Execution API `:run` accepts the script id or requires the API-executable deployment id for a project created in the new IDE (§7 handles both).
5. ~~Which of the fork's `n8n/*.json` files reference the Router by id vs name~~ — resolved: every wrapper's Execute Workflow node references the router **by id** (`workflowId.value = <<ROUTER_WORKFLOW_ID>>`, mode `id`), so §8 is two-phase: import `00_EFX_Router` first, copy its id from the URL, then run the placeholder replace including `<<ROUTER_WORKFLOW_ID>>` before importing the wrappers (or re-select `00_EFX_Router` in each wrapper's Execute Workflow node by hand).
6. Prod copy's `Raw Log` shape (exists / 5 cols) and `BC1` header — §6 dry-run reveals it.
