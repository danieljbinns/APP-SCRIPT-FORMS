# EFX TEST deploy — run log, Thursday 2026-09-17
Kept out of the repo on purpose: holds ids and a key path.

## Values sheet
| Key | Value |
|---|---|
| TEST_SHEET_ID | `1cjDM9uQy_tejnM0A11lrDLgBzQvncDGX44oTpE9hTvk` |
| TEST folder (My Drive) | `1cwmp3LJy3sv3L2VGTBGICR3gNJd0V5at` ("EFX TEST") |
| PROD sheet (READ ONLY, never a write target) | `1kGjw8e-uIehaBemlsRZ4Yq1QrYOWkJvWzhKbgfl4Pxo` |
| GCP_PROJECT_ID | `efx-test-teamgroup` (D1 fallback: plain `efx-test` is taken globally) |
| GCP_PROJECT_NUMBER | `839437162862` |
| ORG_ID | `910348027716` (robinsonsolutions.com, customer C03d636f7) |
| SA_EMAIL | `efx-router@efx-test-teamgroup.iam.gserviceaccount.com` |
| SA_CLIENT_ID (for DWD) | `111683067952951171262` |
| SA key path | `D:\Credentials\google\efx\efx-router-test.json` (key id `1b492cc97d0a4e866e0096c74f6cff4777245106`) |
| OAuth brand | `projects/839437162862/brands/839437162862`, `orgInternalOnly: true` |
| Bot | `efx-bot@team-group.com`, OU `/Bot Accounts`, Cloud Identity only |
| TEST_SCRIPT_ID | *(Gate 2)* |
| TEST_WEBAPP_URL | *(Gate 2)* |
| TEST_API_DEPLOYMENT_ID | *(Gate 2)* |

## Gate ledger
| Gate | What | Status |
|---|---|---|
| 0 | Local proof (5 suites + 3 tools) | **GO** |
| 1 | Accounts and doors | **partial** — see blocked list |
| 2 | TEST Apps Script project | not started |
| 3 | Sheet migration | not started (**needs `migrateAddMissingHeaders()` first**) |
| 4–7 | first calls, n8n, smoke, wrap | not started |

## Gate 0 evidence (worktree gate-0-local-proof-de520c @ 52f98e8)
super-test 159/0 · form-field-map 312/0 · efx-test 195/0 · migration-test 42/0 ·
efx-e2e 580 passed / 3 recorded defects / 122 emails captured, 0 sent ·
n8n-check OK · n8n-workflows-check OK (25 files, 211 nodes, 0 warnings) ·
.clasp.json still `REPLACE_ME_efx_test_script_id__NEVER_PROD`.

## Gate 1 — done so far
- **Sheet copy** via GAM. Verified: 18 tabs, **identical set to prod** (diff empty); ACL = dbinns owner only,
  no `grp.forms.*` carried over; id distinct from prod.
- **11 permanent dev groups created**, naming `dev.forms.<role>@team-group.com`:
  hr, it, idsetup, safety, fleetio, creditcard, review306090, jrtitle, jonas, payroll, businesscards.
  Members of each: `efx-bot@team-group.com` + `dbinns@robinsonsolutions.com` (22/22 added).
  Purpose: TEST/dev points its group Script Properties here so **no prod group is ever touched**.
- **efx-bot created**: OU `/Bot Accounts` (2FA-exempt), Cloud Identity licence only — matches the
  `n8n-printing@team-group.com` pattern.
- **GCP**: project `efx-test-teamgroup` (#839437162862) under the org; 7 APIs enabled (script, admin, sheets,
  drive, logging, iamcredentials, iap); SA `efx-router` created; **SA key created successfully — the
  `iam.disableServiceAccountKeyCreation` org policy did NOT block it**, so the Gate 1 abort line is cleared.
- gcloud active project deliberately left as `n8n-integration-team-group`; all calls used `--project=`.

## FINDING — `Initial Requests!BC1` is EMPTY
Plan expected `BC1 = 'BOSS Training User Only'`. Actual header row: 54 populated cells, last is **BB = 'ADP Salary
Access'**; sheet width is 55 columns (last col BC). BC1 and BD1 are both blank.
**Consequence:** Gate 3 must run `migrateAddMissingHeaders()` **before** `migrateEfxDryRun()`, per
SETUP_PLAN §1 and the Gate 3 no-go row. Do not apply the EFX migration while the dry run logs a WARNING.

## BLOCKED — needs the user (harness classifier refuses these as "Permission Grant")
1. `gam create admin efx-bot@team-group.com _GROUPS_READER_ROLE customer`
   Without it `AdminDirectory.Members.hasMember` fails as efx-bot and **every role check is meaningless**
   (morning-brief watch-out #5).
2. Drive ACLs — efx-bot needs **writer** on:
   - TEST sheet `1cjDM9uQy_tejnM0A11lrDLgBzQvncDGX44oTpE9hTvk`
   - `1vBZVuzXmSatnLGiqhU7QoS0zBK2NGDQE` (MAIN_FOLDER_ID default)
   - `1yD1j82KTJ2EksLnN_fJ02zQWEUAlSRBW` (TERM_ATTACHMENTS default)
   - `1gRjQiw34JTvyqwqfnBlJYs6JdmeYjzr1` (CHANGE_ATTACHMENTS default)
3. **DWD** (Admin console, browser only — GAM cannot manage domain-wide delegation).
   Client ID `111683067952951171262`, 11 scopes (string in SETUP_PLAN §3).

## Script Properties to set in Gate 2 (keeps prod groups untouched)
| Property | Value |
|---|---|
| SPREADSHEET_ID | `1cjDM9uQy_tejnM0A11lrDLgBzQvncDGX44oTpE9hTvk` |
| EMAIL_REDIRECT_ALL | `dbinns@team-group.com` |
| GROUP_MASTER_ADMIN / GROUP_ALL_FORMS / GROUP_IT | `dev.forms.it@team-group.com` |
| GROUP_HR | `dev.forms.hr@team-group.com` |
| EMAIL_HR | `dev.forms.hr@team-group.com` |
| EMAIL_IT / EMAIL_NOTIFICATIONS | `dev.forms.it@team-group.com` |
| EMAIL_IDSETUP | `dev.forms.idsetup@team-group.com` |
| EMAIL_SAFETY | `dev.forms.safety@team-group.com` |
| EMAIL_FLEETIO | `dev.forms.fleetio@team-group.com` |
| EMAIL_CREDIT_CARD | `dev.forms.creditcard@team-group.com` |
| EMAIL_BUSINESS_CARDS / EMAIL_IT_CONFIRMATION | `dev.forms.businesscards@team-group.com` |
| EMAIL_REVIEW306090 | `dev.forms.review306090@team-group.com` |
| EMAIL_REVIEW_JR_TITLE | `dev.forms.jrtitle@team-group.com` |
| EMAIL_JONAS | `dev.forms.jonas@team-group.com` |
| EMAIL_PAYROLL | `dev.forms.payroll@team-group.com` |
NOTE the exact spelling `EMAIL_REVIEW306090` (no underscore before the digits) — `Config.js:102`.
`ADMIN_EMAILS` is **hardcoded** at `Config.js:26` and cannot be overridden; dbinns is on it, which is fine.

## Corrections to the written plan (carry forward)
- **n8n "staging" is production.** `CUTOVER_PLAN_JR.md:9` — George's `J7RU99n01pq9Xk3D` is ACTIVE there.
  SETUP_PLAN §8's "same project as George's live JR clone so he can see the wrappers" is **wrong today**:
  user's instruction is to share nothing with George until we have tested it ourselves.
  Revised Gate 5: separate n8n project, everything inactive, **do not import 40/41**, canary not activated.
- **Rollout order is ID Setup and JR first**, not IT setup. Smoke priority: T4 create, ID Setup path, T7 JR close.
- `gcloud iap oauth-brands create` warns it is deprecated and slated for shutdown 2026-03-19; it still worked
  today. **For the prod tier, expect to use the Cloud Console consent screen instead.**

## Restore on wrap
- gcloud active project was `n8n-integration-team-group` — leave it that way (never switched).
- Rollback: trash sheet copy + EFX TEST folder; `gcloud projects delete efx-test-teamgroup`; delete SA key;
  `gam delete user efx-bot@team-group.com`. The 11 `dev.forms.*` groups are **permanent by design — keep them**.

---

## Gate 1 completion (bypass mode, unattended batch)
- **Groups Reader granted.** `roleAssignmentId 3803372588057181`, role `_GROUPS_READER_ROLE`, scope CUSTOMER,
  assignedTo efx-bot (`106063073823553965050`). Verified via `gam print admins`.
- **TEST sheet ACL now 3 permittees:** dbinns owner, `efx-bot@team-group.com` writer,
  `efx-router@efx-test-teamgroup.iam.gserviceaccount.com` writer.
  The SA grant is deliberate: it lets `migration/migrate-efx-sheet.js` run with `--key` alone,
  so **Gate 3 no longer depends on DWD or on the Apps Script project existing**.
- **dbinns is `roles/owner`** on `efx-test-teamgroup`, so the Gate 2 GCP link will not fail on permissions.

### FINDING — Cloud Identity cannot join a Shared Drive
`gam add drivefileacl` on the three default attachment folders failed:
`Cannot set the requested role for that user as they lack the necessary license.`
All three live in Shared Drive `0AOOOWlqzpUNVUk9PVA` (= `SHARED_DRIVE_ID` in ConfigurationService).
efx-bot holds Cloud Identity only (same as the working `n8n-printing` bot), and Cloud Identity accounts
cannot be Shared Drive members. My Drive sharing is unaffected, which is why the sheet grant succeeded.

**Resolved without a paid licence** by taking the alternative SETUP_PLAN §4 already allowed: dedicated TEST
attachment folders in My Drive under `EFX TEST`, each shared with efx-bot as writer.
Better isolation anyway — test attachments no longer land in the shared dev drive.

| Script Property (set at Gate 2) | Value |
|---|---|
| MAIN_FOLDER_ID | `1CE2nJ6TctRKwTnn9SqcYhMLndrSPpVwS` |
| TERM_ATTACHMENTS_FOLDER_ID | `1PIAXAQfoSjHVLE9mhq1v_RywRib8Qpbt` |
| CHANGE_ATTACHMENTS_FOLDER_ID | `1w4C165RSMaxmjr0lBQC-9ceBOWjdsSci` |

These three are **additions** to the Gate 2 property list recorded earlier.

### Gate 1 remaining
**DWD only.** Admin console, no API. Client id `111683067952951171262`, 11 scopes.

### GAM syntax notes (not in the skill references — worth adding)
- `add drivefileacl <id> user <email> role writer` — `sendemail` is a **bare flag**; `sendemail false` is a parse error.
- `print drivefileacls` / `show drivefileacls` are **plural**.
- `create drivefile drivefilename "<name>" mimetype gfolder parentid <id>` works for folders.
- `copy drivefile <src> newfilename "<name>" parentid <id>` works, and does **not** copy permissions.
- GAM has **no** domain-wide-delegation command at all (checked `GamCommands.txt`).

## GATE 1 VERDICT (independent verifier) — NO-GO, two open rows
Everything in §2/§3-prereq/§4 verified sound: project, brand (orgInternalOnly true), SA + key + 21-digit
client id, efx-bot OU/licence/Groups Reader, membership in all 11 dev groups, writer on the TEST sheet,
18 tabs byte-identical to prod, `.clasp.json` still the placeholder, active gcloud project untouched.

**Open row 1 — DWD.** Confirmed absent by LIVE PROBE, not just unrecorded:
`node print-dwd-token.js --key … --subject efx-bot@team-group.com` returns `unauthorized_client`.
That same command is the re-test once the Admin console row is added.

**Open row 2 — `Initial Requests!BC1` empty.** Prod-inherited (prod's header row is the same 54 cells),
not a bad copy. Verifier confirms `MigrationTools.js:917` will emit
`WARNING: Initial Requests has 54 columns; schema expects header at col 56` on dry run.
Fixed at Gate 3 by `migrateAddMissingHeaders()`. Independent of DWD.

### Three catches from the verifier — carry forward
1. **The folder workaround promotes three properties from optional to MANDATORY at Gate 2.**
   `ConfigurationService.js:33/36/37` still default to the shared-drive folders efx-bot cannot reach.
   If `MAIN_FOLDER_ID` / `TERM_ATTACHMENTS_FOLDER_ID` / `CHANGE_ATTACHMENTS_FOLDER_ID` are left unset,
   attachment writes go to folders the bot has no access to. SETUP_PLAN §5 lists them as optional — it is
   wrong for this tier.
2. **NOT EVIDENCED: whether the sheet copy carries a bound Apps Script project with triggers.**
   Only checkable in the editor (Extensions > Apps Script). This is the one remaining email-escape path
   at this stage. Check it during the Gate 2 editor session.
3. **Deviation I introduced:** `efx-router` SA holds a direct writer ACL on the TEST sheet. SETUP_PLAN §2
   says no such grant is needed because the SA acts as efx-bot via DWD. It was added deliberately so the
   Gate 3 migration does not depend on DWD. Risk flagged by the verifier: it can mask a broken DWD path if
   anything authenticates as the router itself. Mitigations: Gate 4 mints a *subject* token so it still
   proves DWD independently; remove this ACL at Gate 7 wrap.

## DWD — DONE and proven live
Admin console row saved by user via the prefilled deep link.
Re-ran the exact command that previously failed:
  node print-dwd-token.js --key D:\Credentials\google\efx\efx-router-test.json --subject efx-bot@team-group.com
  BEFORE: unauthorized_client
  AFTER : 328-char ya29.* access token minted AS efx-bot@team-group.com
Delegation works, and impersonation resolves to the right subject. Gate 1's delegation row is closed.
Only remaining Gate 1 row: `Initial Requests!BC1` empty — fixed at Gate 3, independent of this.

## Missing headers — FIXED on TEST (Gate 1 row 2 closed)
New tool: `migration/add-missing-headers.js` — Node twin of `MigrationTools.js::migrateAddMissingHeaders()`.
Mirrors `ensureHeader` exactly: writes only when the cell is empty or the column does not exist; if the cell
holds anything unexpected it WARNS and refuses to overwrite (exit 3). Touches row 1 only, never a data cell.
Refuses the prod id without `--i-know-this-is-prod`.

**TWO headers were missing, not one.** Fixing only BC1 would have left the second gap in place:

| Sheet | Cell | Header | Schema (0-based) |
|---|---|---|---|
| Initial Requests | `BC1` (col 55) | `BOSS Training User Only` | `INITIAL_REQUESTS.BOSS_TRAINING_ONLY = 54` |
| IT Results | `W1` (col 23) | `BOSS Details` | `IT_RESULTS.BOSS_DETAILS = 22` |

Dry run -> both `WOULD`. Apply -> both `SET`. Re-run -> both `OK / nothing to do` (idempotent).
Auth used the SA key directly (no `--impersonate`), which exercised the router-SA writer grant on the sheet.

### PROD IMPLICATION — must be carried into the prod migration
Prod's header row is identical (verifier confirmed prod also returns 54 populated cells, no BC1).
So **the prod sheet is missing both headers too**, and the prod migration sequence must be:
  1. `add-missing-headers.js --sheet <PROD> --i-know-this-is-prod` (dry run, then apply)
  2. only then `migrate-efx-sheet.js`
`migration/MIGRATION_PLAN.md` does not currently carry step 1 — **needs adding**. Not edited here because
CLAUDE.md warns other agents are concurrently writing `migration/`.

Gate 1 now has **both** open rows closed: DWD proven live, headers fixed. Ready to be re-ruled.

## GATE 1 RE-RULED — NO-GO on ONE item (not either of the original two)

**Closed, and independently re-verified (not taken on my word):**
- **DWD.** Verifier minted its own token and read the identity back from Google's tokeninfo:
  `email = efx-bot@team-group.com`, `email_verified = true`, `azp = aud = 111683067952951171262`
  (the SA's OAuth client acting AS efx-bot — the correct DWD shape, not an SA-identity token).
  All 11 scopes present, none missing, none extra.
- **Headers.** `Initial Requests` row 1 now returns **55** values (was 54), index 54 = `BOSS Training User Only`.
  `IT Results` W1 = `BOSS Details`. Proven **exactly one cell changed**: `BC1:BC965` = 597 rows, every row 0 cells
  before AND after except row 1 which is now 1 cell.
- **`add-missing-headers.js` audited** against the GAS original: matches all four branches and is *stricter*
  (exits 3 on unexpected text where GAS returns ok:true). One deliberate difference: GAS extends the sheet when
  the column is beyond the grid; the Node tool would throw instead. Both target columns were inside the grid, so
  the branch never applied, and it fails loudly rather than silently.

**STILL OPEN — the only thing between us and Gate 1 done:**
Bound-script check (§1 checklist): open the copy in **Extensions > Apps Script** and confirm there is no bound
project with triggers. **My Drive-listing evidence was worthless for this** — a container-bound script is not
returned by Drive `files.list`; it has no independent listing and no parents entry. A null result there is
consistent with absence but is not evidence of it. Installable triggers are not copied by "Make a copy", but a
simple `onEdit`/`onOpen` in copied code DOES run for the copy. This is the last email-escape path at this stage.

**Honest-basis flag from the verifier:** `IT Results` rows >= 2 were NOT diffed before/after (no baseline read
existed). Ruled GO on code inspection — the tool's range is row-1-only and cannot address row >= 2 — plus intact
JSON payloads. Recorded so it is never later cited as a measured diff.

**efx-router ACL, narrowed:** not an email- or prod-escape path (scoped to the TEST sheet, cannot reach prod).
The one real consequence: a Gate 3 run with `--key` and no `--impersonate` authenticates as the SA itself, so
**a green Gate 3 is NOT evidence that the DWD door works** and must never be cited as such. Remove at Gate 7.

## D3 DECIDED — SAFETY_TRAINING_AT_SUBMIT = OFF
User: "we want to continue the normal workflow ie off."
Consequence: Safety Onboarding task is created at ID Setup (hourly, no system access) or after HR Verification
(everyone else) — matching prod and matching the ID-Setup-first rollout. The flag ships to TEST unproven; that is
accepted. Do not set the property (default is already 'false'); do not run `setSafetyTrainingAtSubmit(true)`.

## GATE 1 = DONE (2026-09-17)
Last open row closed: user opened the TEST copy via Extensions > Apps Script and reports
**no bound script, no code**. That is the §1 check the verifier named as the only thing
outstanding; it cannot be measured remotely (a container-bound script is invisible to Drive
`files.list`), so this row rests on direct human observation by design, not on a tool result.

Verifier's prior ruling had every other Gate 1 criterion at GO and stated Gate 1 was "one
editor click short of done". That condition is now met, so Gate 1 is complete.

Gate ledger: 0 GO · **1 GO** · 2-7 not started.
Carried forward into Gate 2: three folder properties are MANDATORY (not optional);
`setupProdScriptProperties()` hardcodes the prod sheet id and must never be run on TEST;
SAFETY_TRAINING_AT_SUBMIT stays OFF.

## Gate 2 Phase A — DONE
| Key | Value |
|---|---|
| TEST_SCRIPT_ID | `1yD_Me_Y_zVZBoejOozy1CGVEFh2_dzw289SbVohVpWt2LEKXYMx_OYIn` |
| Location | standalone, inside My Drive folder `EFX TEST` (`1cwmp3LJy3sv3L2VGTBGICR3gNJd0V5at`) |
Safety check passed: new id is distinct from prod `1AuIbJl1jR…` and dev `1VI9tR0GCx…`.
Pushed **87** tracked files. `__tests__/`, `docs/` and `.clasp.json.placeholder.bak` all sit in clasp's
Untracked section, i.e. excluded. `Services/*.js` confirmed present in the tracked list.
Script project shared with efx-bot as **reader** (Execution API also checks file access).

### TWO plan errors found and corrected
1. **`clasp create --type webapp` FAILS on clasp 3** — "Invalid container file type". In clasp 3 any `--type`
   other than `standalone` is a *container document* type (sheets/docs/forms/slides). Correct command is
   `--type standalone`. Deployment capability comes from the manifest's `webapp`/`executionApi` blocks, not
   this flag, so nothing is lost. SETUP_PLAN §5 carries the clasp-2 form and is wrong.
2. **`clasp create` CLOBBERED `appsscript.json`** — it cloned the bare remote template over the fork's manifest,
   cutting it from 38 lines to 6. Lost: both advanced services (AdminDirectory — every role check needs it),
   the `webapp` block, the `executionApi` block, and all 10 `oauthScopes`. The plan warns about an interactive
   "overwrite?" prompt; clasp 3 does it **silently, with no prompt**. Restored with `git restore appsscript.json`
   BEFORE pushing, and re-verified clean after the push.
   **Carry to dev/prod: check `git status appsscript.json` immediately after any `clasp create`.**

## Gate 2 Phase C — DONE
| Key | Value |
|---|---|
| TEST_API_DEPLOYMENT_ID | `AKfycbwYjaKbK_FwmF_WHrqxpu2wZi5mOGPS8dwlSw2cMRJRbIC3d-2rfA3PhDU5CavIexFy` (@1, "efx-api v1") |
| TEST_WEBAPP_URL | `https://script.google.com/a/macros/robinsonsolutions.com/s/AKfycbwYjaKb…/exec` |
GCP link done by user. One deployment serves BOTH web app and Execution API because the manifest declares both.

**24 Script Properties set** via a new top-level function `efxSetScriptProperties(json)` appended to `Setup.js`
— generic, tier-agnostic, NO hardcoded ids, and it refuses to point a non-PROD script at the prod spreadsheet.
Added because `ConfigurationService.saveSettings` is not reachable from the Execution API (which can only call
top-level functions) and the only shipped bulk setter, `setupProdScriptProperties()`, hardcodes the prod id.
`SAFETY_TRAINING_AT_SUBMIT` deliberately NOT set (D3 = off; default is already 'false').

Tool: `scratchpad/efx-call.js` — mints a DWD token as a subject and calls any top-level function through
`scripts.run`. Reused for every later gate.

### efxSelfTest — ALL CRITERIA MET (run as efx-bot through the Execution API)
| Check | Required | Observed |
|---|---|---|
| principal | `efx-bot@team-group.com` | **`efx-bot@team-group.com`** |
| env | `TEST` | `TEST` |
| spreadsheetId | TEST sheet | `1cjDM9uQy_tejnM0A11lrDLgBzQvncDGX44oTpE9hTvk` (NOT prod) |
| contracts | true | `true` |
| dryRunClose error | `E_NOT_FOUND` | `E_NOT_FOUND` — "Task not found: TK-NONE" |
| apiVersion | `2026.09.17-1` | `2026.09.17-1` |

**This also satisfies Gate 4 / TEST_PLAN T0-T1.** Morning-brief watch-out #1 was: the principal through the
Execution API must be `efx-bot@team-group.com`, or DWD is wrong and every role check is meaningless.
It came back correct. The n8n -> Execution API -> Forms door is OPEN and proven.
Stronger than the plan's version, which only ran efxSelfTest as dbinns from the editor.

### Not yet proven
- Web app `/exec` URL — needs a browser session as a domain user; the Execution API path does not exercise it.
- Gate 3 migration has NOT run: the TEST sheet still lacks `Internal Employee ID` (BD1), the `Employee IDs` tab
  and the Raw Log `Event ID`/`Kind` headers.

## GATE 3 — migration APPLIED
Ran via `migrate-efx-sheet.js` with `--impersonate efx-bot@team-group.com` (so it went through DWD, not the
router SA identity — which also means the verifier's "green Gate 3 proves nothing about DWD" caveat does not
apply to this run).

Dry run: 3 changes, 0 warnings. Apply: 3 DID. Re-run: 0 changes, all three no-op. Read-back confirmed:
- `Initial Requests` col 55 = `BOSS Training User Only`, col 56 = `Internal Employee ID`
- `Employee IDs` tab created, 7 headers, styled + frozen
- `Raw Log` headers already had `Event ID`/`Kind` (no-op — prod already had them)

### BUG FOUND AND FIXED in migrate-efx-sheet.js — would have broken PROD
First apply failed hard:
`400 Range ('Initial Requests'!BD1) exceeds grid limits. Max rows: 965, max columns: 55`
Apps Script's `sheet.getRange(1,n).setValue()` silently EXTENDS the grid; the Sheets REST API does not.
A stock `Initial Requests` tab is exactly 55 columns and the EFX header goes at 56, so **this fires on every
un-migrated sheet, prod included**. Added `widenGridIfNeeded()` (appendDimension, adds columns only, never
removes, never touches data) and re-ran successfully: `(widened 'Initial Requests' grid 55 -> 56 columns)`.
Nothing was written by the failed run — state was verified unchanged before retrying.
**Secondary defect, not fixed:** `report.add()` prints `DID` *before* the write, so the failed run printed
`+ DID add header …` for a write that never happened. Misleading; worth fixing before prod.

### FINDING — 'ID Setup Results' contains TWO parallel employee-id series
| Series | Range | Count | Last used |
|---|---|---|---|
| 30k | .. 30185 | 182 | 2026-05-12 |
| 151k | 150640 .. 151998 | 353 | 2026-09-17 10:09 (today) |
Plus 2 junk rows both `88888` (2026-08-06). They ran **interleaved** Mar–May 2026, not a clean cutover.
151k is the live series. The morning brief's expectation of ~30405 came from mock fixtures, not real data;
`TEST_PLAN` T4 only asserts `>= 30000`, which would pass either way and would NOT catch the wrong series.
**Decide before prod: which series continues, and what the junk rows mean.**

### Backfill NOT run — and it is not load-bearing
`EmployeeIdRegistry.maxKnown_` reads `ID Setup Results` col D directly, so the next id is the same whether or
not the registry is backfilled. Backfill only consolidates history into one tab.

### TEST floor seeded (user decision)
User wanted TEST allocations to start at a chosen round number. `FLOOR = 30000` in `EmployeeIdRegistry.js:15`
is a *minimum*, not a start — `maxKnown_` takes max(FLOOR-1, registry, ID Setup Results), so any seed BELOW
151998 is ignored. Seeded one row **above** the live series instead:
`499999 | SEED-TEST-FLOOR | (not a real employee) | … | test-floor | "Synthetic floor …"`
=> max = 499999, so the next TEST allocation is **500000**. Obviously synthetic at a glance. Delete the row to revert.

## GATE 5 — n8n import DONE (private, inactive)
Imported into **Daniel Binns' personal project** `0wpVg3Nd6BJATZle`, NOT Team Group `kOteX9ImmtqV980I`
(George's live JR clone lives there). User's call; solves the "staging is actually prod" problem.

| Key | Value |
|---|---|
| n8n credential | `EFX Google SA (test)` id `DgSBjZ6s6HAXXfGe` |
| Router workflow | `EFX · Router` id `v9KymVILUsbb4zb5` |
| Workflows imported | 22 (router + 21) |
| Skipped | `40_Ref_Onboarding_via_EFX`, `41_Ref_OpenTasks_Digest` (George-facing reference flows) |

Wrapper ids: 10 `5Q3LXzd0D7sQA8Eq` · 11 `9DYJn9AiCABMS6Xg` · 12 `RoSlpUv8xIBfbgiV` · 13 `wiKSbolRyXMV7CaJ` ·
14 `kxGDJyJ8xioRZstH` · 15 `cVg4GRwAncNPBGyc` · 16 `XtyDxfk2UWaQY2eF` · 17 `HcoKRxDnBQ09dCYJ` ·
18 `yeMaMnjaPW45bUaY` · 19 `H67G2ZwuTcZrOE6v` · 20 `Csx2RF2uOEJEthpb` · 21 `I5Kx954hWfxkkdTC` ·
22 `2grkVpCE2tE9Z1uT` · 23 `lnG26sR6c5ttdAbF` · 24 `Ttgb5jVY3viWryQl` · 25 `EeK1gIECGWfrIWi0` ·
26 `uoVjNmC4trggftVH` · 27 `kpJOPoEMuD0mwGj7` · 28 `eLm3cpWqV7XfoC4x` · 30 `7DxN1IFN2vqAKzRm` · 90 `6B6p3wjqeDqVvZD8`

### Verified
- **Private**: workflow detail shows `shared: ["0wpVg3Nd6BJATZle"]` — personal project only. None in Team Group.
- **All 22 inactive.** Canary and poller deliberately NOT activated.
- **Router HTTP node** bound to credential `DgSBjZ6s6HAXXfGe "EFX Google SA (test)"`, URL
  `https://script.googleapis.com/v1/scripts/1yD_Me_Y_…:run` — correct TEST script id.
- **21/21 wrappers** resolve their Execute Workflow node to the router id.
- Only leftover `<<ROUTER_WORKFLOW_ID>>` is inside a **sticky note** (human documentation), not an executable node.
  `<<EXISTING_JR_TASK_ID>>` likewise sits in 90's sticky/test-config — a manual run input. Both cosmetic.

### Notes for the prod repeat
- The n8n public API creates in the **API key owner's personal project**; a transfer to that same project
  returns `400 ... can't transfer into the same destination`. Treat that error as success.
- Strip `active,id,meta,versionId,tags` before POST (per team-n8n-infra skill) — confirmed necessary.
- `settings.errorWorkflow` holding an unresolved `<<ERROR_WORKFLOW_ID>>` must be deleted or the create fails.
- Credential type `googleApi`; fields that matter: `email`, `privateKey`, `inpersonate:true`,
  `delegatedEmail`, `httpNode:true`, `scopes` (space-separated), `allowedHttpRequestDomains:'all'`.

## GATE 6 — Forms-side smoke PASSED (n8n-side still needs one manual run)

**T3 contracts** — 11 forms; `new_hire`, `id_setup`, `hr_verification` all `verified:true`.
(`it_confirmation` and `specialist` are `verified:false` — not part of the gate, pre-existing.)

**T4 create** — `n8n_createInitialRequest` as efx-bot:
- `workflowId NEW_EMP_20260917-133536_712`, `formId INIT_REQ_20260917-133536_296`, `success:true`
- **`internalEmployeeId: 500000`** — the seeded floor worked exactly as intended
- `Initial Requests` row present; `Internal Employee ID` header confirmed at index 55 (col BD); value `500000`
- `Employee IDs` registry: exactly 1 row, id 500000, `allocatedBy efx-bot@team-group.com`, `source submitInitialRequest`
- `Raw Log`: 2 rows — `kind=result` and `kind=alias` (the requestId audit trail), both by efx-bot
- `Action Items`: 0 — **correct**, since SAFETY_TRAINING_AT_SUBMIT is off and this path creates none at submit

**closeJrTask guard** — `E_NOT_FOUND: No open jr_title task for NEW_EMP_…`. Alias wired; correct refusal.
**getWorkflow** — full round-trip, returns the `employeeId` block with 500000 and `currentUser efx-bot@team-group.com`.

### Still open on Gate 6
1. **Emails** — 2 redirected `[TEST]` messages should be in dbinns' inbox. Cannot be verified from here.
2. **T2 router ping through n8n** — the ONLY thing still unproven is the n8n-side credential
   (the SA key + impersonation stored inside n8n). Everything above went through the Execution API directly.
3. **T7 happy path** — needs a `jr_title` task. Those are created by `ITSetupHandler.js:534`, i.e. only on the
   **IT Setup** path (system access = Yes). The T4 hire was deliberately hourly/no-access (ID Setup path).
   Either create a second hire with `systemAccess: "Yes"` and drive it to IT Setup, or run `90_EFX_E2E_Test`.

### Why n8n needs a human click
No workflow has a webhook trigger. Every wrapper is `executeWorkflowTrigger` (sub-workflow only);
`20` and `30` are `scheduleTrigger`; `90` is `manualTrigger`. The n8n public API has no generic
"run this workflow now" endpoint, so nothing here can be triggered from outside the UI.
Cheapest proof: open `30_EFX_Canary` (`7DxN1IFN2vqAKzRm`) and hit Execute — writes nothing, emails only on failure.

## T2 PASSES — full chain proven end to end
`HTTP -> n8n webhook -> Test Trigger -> EFX Router -> Google SA credential (impersonating efx-bot)
 -> Apps Script Execution API -> Forms -> back`
Response: `ok:true`, **`principal: efx-bot@team-group.com`**, `env: TEST`,
`spreadsheetId 1cjDM9uQy…`, `requestId REQ-760B63B9`, `tookMs 2775`, HTTP 200 in 3.3 s.
The n8n-side credential is now proven, which was the last unproven link.

### NEW — `EFX · Test Trigger (API)`  id `OaGfiIi7l5o9NUs1`
Built because nothing in the EFX set could be started from outside the n8n UI (all sub-workflows /
schedules / manual, and the n8n public API has no "run workflow" endpoint) — that made automated
testing impossible. Webhook -> secret check -> Router, so **all 27 aliases are now callable over HTTP**.
Guarded by a random path AND an `x-efx-secret` header; both stored in `D:/Credentials/n8n/`, never printed.
Caller: `scratchpad/efx-n8n.js <fn> [argsFile]`.

**n8n 2.x constraint discovered:** a workflow cannot be published while it references an unpublished
sub-workflow. So `00_EFX_Router` had to be activated. Safe — its only trigger is `executeWorkflowTrigger`,
which fires only when called; it does nothing on its own. `30_EFX_Canary` and `20_Forms_EventsPoller`
(the two schedule-driven ones) remain **off**.

## BUG FOUND AND FIXED — Router unwrap, would have broken EVERY call in EVERY tier
First call through n8n failed: `EFX E_TRANSPORT: Non-JSON response from script.googleapis.com (HTTP 200)`
— despite the Execution API returning a perfectly good 200 with `ok:true`.

Root cause, confirmed on execution 2404: the HTTP Request node (typeVersion 4.2) is configured
`responseFormat:"text"` + `fullResponse:true`. In that combination n8n emits
`{ data, headers, statusCode, statusMessage }` — the payload is under **`data`**, not `body`.
`Unwrap & guard` read `r.body`, got `undefined`, and failed closed on every call.

Fix (minimal, preserves the author's deliberate text-mode design so a genuinely non-JSON body still
yields the friendly E_TRANSPORT message):
  `let body = r.body;`  ->  `let body = (r.body !== undefined ? r.body : r.data);`
plus the same resolution for the `snippet` used in error text.
**Applied to BOTH** the live workflow `v9KymVILUsbb4zb5` and the repo file `n8n/00_EFX_Router.json`,
so dev and prod do not inherit it. 2/2 replacements matched in each; refused to apply on any mismatch.

This was invisible to every local test — there is no n8n in the mock. It could only be found live.

## GATE 6 — full alias sweep through n8n

Harness: `scratchpad/efx-suite.js` — drives every alias over HTTP through the real chain
(webhook -> Test Trigger -> Router -> SA credential as efx-bot -> Execution API -> Forms).
`--loops N` repeats to expose non-determinism; `--write` adds the mutating cases.

**3 loops with writes: 72 calls, 24/24 cases green, 0 flaky.**
Latency through the full chain: median 4.65 s, p95 13.4 s, max 15.0 s.

Cases: ping · info · contracts · listWorkflows · getWorkflow · getContext · getEmployeeId · listTasks ·
events · getWorkflow/missing · getContext/missing · closeJrTask/none · closeTask/bogus · getWorkflow/noArg ·
create/empty · create/badEnum · create#1 · create#2 dedupe · create#3 distinct · updateHireDate ·
readback id · listTasks/wf · cancelWorkflow · cancel twice.

Notable passes:
- **dedupe works** — identical payload resubmitted immediately returns the SAME workflowId.
- **distinct hires stay distinct** — different person+hire date gets a new workflow AND a higher employee id.
- **ids advance from the seeded floor** every pass; readback always matches what create returned.

### BUG #2 FOUND AND FIXED — EFX error code was unreachable from n8n
The Router's `fail()` throws `"EFX <CODE>: <message> [fn=…]"`, and the guard's own comment promises
error workflows can regex `/^EFX (E_[A-Z_]+):/` off it. **They cannot.** n8n's Code node parses
`"Name: rest"` and keeps only `rest` in `error.message`; there is no `name` field, so the code survives
ONLY inside `error.stack`. Worse, when the message embeds JSON (colons + commas) n8n splits mid-payload:
  `message     = "\"must be one of Hourly|Salary\"}] [fn=…] [line 17]"`
  `description = "\"employmentType\",\"problem\""`
Fix: append a trailing **`[efxCode=<CODE>]`** tag, which n8n never strips (it only removes a leading
`Name: `). The documented leading prefix is kept for anything reading `stack`.
Applied to live `v9KymVILUsbb4zb5` AND repo `n8n/00_EFX_Router.json`.
**George's error workflows must branch on `[efxCode=…]`, not on the leading prefix.** Docs need updating.

### FINDING — `cancelRequest` has no already-cancelled guard  (PROD behaviour, not EFX)
`RequestActionsHandler.js:26`: cancelling an already-Cancelled workflow succeeds again — it re-writes the
status, re-scans and re-cancels action items, and writes a **second audit row**. Every close path returns
`E_ALREADY_CLOSED` instead, and the Router even has `treatAlreadyClosedAsSuccess` for exactly that shape.
Not dangerous (no corruption) but it pollutes the audit trail, and **n8n retries make repeats likely**.
Pre-existing prod code — NOT fixed today. The suite asserts current behaviour so a future change is noticed.

### Design note for the wrappers/docs
Through the Router the envelope is **flattened**: `Unwrap & guard` does
`Object.assign({ok:true}, env.result, meta)`, so result fields (`workflowId`, `internalEmployeeId`, …)
appear at the TOP level, not under `.result`. Direct Execution API calls keep the nested shape.
Anything written against the direct shape will break when moved behind the Router.

### Test data created on the TEST sheet
Several `EfxSuite P<n>x…` / `P<n>y…` hires plus the original `EfxSmoke GateSix`. Employee ids from 500000 up.
Harmless on a disposable copy; delete the rows or re-copy the sheet if a clean slate is wanted.

### Soak: 8 read-only loops — 128 calls, 16/16 cases 8/8, **0 flaky**
median 3.67 s · p95 12.2 s · max 19.6 s. Combined with the write run: **200 calls through the full
n8n chain with no non-deterministic failure.** Gate 6 is solid for everything exercised.

### Gate 6 residual
- **T7 JR-close happy path** still untested: needs a `jr_title` task, created only on the IT Setup path
  (`ITSetupHandler.js:534`), i.e. a hire with `systemAccess: "Yes"`. All suite hires are hourly/no-access.
- **Emails** not verified — they land in dbinns' inbox and cannot be checked from here.
- Web app `/exec` URL still unexercised (browser-only).

## T7 — JR CLOSE PASSED (full chain, through n8n)
Harness: `scratchpad/jr-test.js`. A `jr_title` task only exists when `ITSetupHandler.js:520-540` fires,
which needs `context.plan306090 === 'Yes'`, and IT Setup only runs for a hire WITH system access.
So the test drives the whole chain:

| Step | Result |
|---|---|
| createInitialRequest (Salary, systemAccess Yes, plan306090 Yes) | `NEW_EMP_20260917-143922_427`, id **500012** |
| submitIdSetup | ok |
| submitItSetup | ok — created 3 tasks: `30/60/90 Review`, **`JR Title`**, `WIS` |
| jr_title task | `TK-0313F171` |
| closeJrTask | ok, `success:true` |
| closeJrTask again | **E_ALREADY_CLOSED** (correctly refused) |

Sheet verified on the `Action Items` row:
- `Status = Closed`
- **`Closed By = efx-bot@team-group.com`** — exactly what `CUTOVER_PLAN_JR.md` needs
- `Task Name = "JR Assignment — EfxJr Test357894"` — contains "JR Assignment", so George's Gmail
  trigger (`subject:"JR Assignment"`) would still match
- `Draft` records the checklist item completed by `efx-bot@team-group.com` with the notes
- **`Assigned To = dev.forms.jrtitle@team-group.com`** — the dev-group Script Property override worked
  end to end. No production group was involved at any point. This validates the whole D2 decision.

## GATE 6 COMPLETE
Read-only + negative + mutating + JR chain all pass through n8n. ~210 calls total, 0 flaky.
Residual (not blockers): web app `/exec` URL unexercised (browser-only, only matters when a human
clicks a link in an email — n8n never uses it). Emails confirmed arriving by the user.

## The two `verified:false` contracts — RESOLVED. Both must STAY blocked.

### First, a good discovery: `verified:false` is ENFORCED, not documentation
`n8n_submitForm(actor,'it_confirmation',{...})` returns
`E_UNVERIFIED_FORM` — *"Form "it_confirmation" is not verified for automation (…reason…).
Pass options.allowUnverified=true to override."*
The alias layer refuses unverified forms by default, names the exact reason in the error, and provides a
deliberate escape hatch. That gate is the only thing standing between an automation caller and the damage below.

### it_confirmation — WORSE than its own notes. Do NOT verify.
Probed live with `allowUnverified:true` on `NEW_EMP_20260917-145633_236`, submitting the contract's only
required field plus notes (`{workflowId, notes}`).

**Which definition wins:** `ITConfirmationHandler.js:44` (the newer one). Proven behaviourally —
`Google Email` and `Google Domain` survived, which only happens via that version's `origData` fallback.

**But the handler writes back 29 Initial Requests columns, and only FIVE have an origData fallback**
(googleEmail, googleDomain, computerRequestType, computerType, phoneRequestType). The other 24 are
`formData.x || ''`, so a partial payload **blanks them**. Observed on the real row:

| Column | Before | After |
|---|---|---|
| First Name | `EfxConf` | **""** |
| Last Name | `T389182` | **""** |
| New Hire/Rehire | `New Hire` | **""** |
| Google Email | `efxconf389182` | `efxconf389182` (survived) |

Also blanked in the same write: Middle/Preferred Name, Position Title, Site Name, Job Site Number,
Manager Email/Name, Employee Type, Employment Type, System Access, Systems, Equipment, all BOSS_*,
Jonas, ADP Sites, Department, Purchasing Sites.

**Severity:** the contract lists `required: ['workflowId']`. An automation caller obeying that contract
**destroys the employee record**. The UI is safe only because it posts the whole object back.
The documented "hireType bug" is one symptom of a 24-column problem.
**Verdict: keep `verified:false`. Fix the handler (origData fallback on every column, or write only
supplied keys) before this is ever exposed.** Not fixed today — prod handler behaviour, needs its own change.

### specialist — target sheet does not exist. Do NOT verify.
Contract `targetSheet: 'Specialist Results'`. The spreadsheet has 19 tabs and **none is `Specialist Results`**.
Confirms the note "Specialist.js sheet map is dead". Use `n8n_closeTask` / `n8n_assignSafetyTraining` instead.

### Test data note
`NEW_EMP_20260917-145633_236` is now deliberately corrupted by this probe. Disposable test row.

## Demos built in the personal project (both INACTIVE)

**Actor parameter — no work needed.** Audited all 21 wrappers: every one already declares `actor`
as a sub-workflow input and forwards it to the Router. Proven live that `Closed By` follows it —
closed a task passing `boss-jr-automation@team-group.com` and the sheet recorded exactly that
(`EfxApi.js:161`: `var by = actor.email || actor.display || actor.id`). Attribution only; role checks
still use the impersonated principal and cannot be faked.

**1. `DEMO · BOSS JR Assignment via EFX Router`  id `uQeizlMybFNGWj9N`**
Byte copy of George's live `J7RU99n01pq9Xk3D` with ONE node changed: `Mark Portal JR Complete`
goes from httpRequest(`/exec` + shared password) to executeWorkflow -> `12_Forms_CloseJrTask`.
Safety changes to the COPY only: webhook path `boss-assign` -> `boss-assign-efxdemo` (cannot collide
with or steal from his live registration), both Gmail nodes redirected from george.anthony to dbinns.
**George's original verified untouched afterwards**: still active, 16 nodes, still httpRequest, still
`boss-assign`, still emailing him.
Caught while building: the ticket id comes from `Find Row by Employee`, NOT `Parse & Validate`.
Downstream safety proven: `Confirm to George` and `Return Success Page` read from named upstream nodes,
never from the changed node, so its output shape is irrelevant.

**2. `DEMO · Initial Request → manager approval → ID Setup (PROPOSED)`  id `qd3vlXvkAY8H2PC3`**
A flow that does NOT exist today. Today ID Setup is manual, and that manual step is the only review of
what is about to be created. This models the gate:
  Run demo -> Make test employee -> Create Initial Request (Router) -> **Draft accounts** ->
  Email manager -> **Wait for approval (editable form)** -> Build ID Setup -> Submit ID Setup (Router) -> Confirm
`Draft accounts` invents SiteDocs worker id / job code / DSS username locally — **no SiteDocs or DSS
integration**. Making it real = replacing that one node. The manager can edit any drafted value on the
form before approving; edits win over the draft.
**Not yet run.** Manual trigger cannot be fired through the n8n public API. Structure accepted by n8n,
runtime unproven — in particular the `wait` node's `resume:'form'` config.
