# EFX FAQ

Short answers, with pointers. *Planned* = designed, not built.

---

### General

**1. What is EFX, in one line?**
A stable set of `n8n_*` functions inside Employee Forms, called by n8n over the Apps Script Execution API, that
run the same server code a human's button click runs. See [HOW_IT_WORKS.md](HOW_IT_WORKS.md).

**2. Is anything live?**
No. This fork targets a **TEST** Apps Script project that has not been created yet (`.clasp.json` says
`REPLACE_ME…`). Prod (`employee_forms_deployment`) is untouched. George's JR closer still calls `doPost` @76.

**3. Where is the spec?**
`P:\Projects\Company\N8N\_agent-bundle\agent-2-full-bundle\agent-2-full-bundle\spec\`. Read `00_README.md`,
then `12_ROUTER_AS_N8N_NODE.md` (current direction). `03`/`11` describe an earlier hosted-router/HMAC-bridge
variant; their **project-side** parts (contracts, Actor, ID-at-submit, events) still apply; their AWS router,
`ApprovalService`, approval page and `INITIAL_APPROVAL_MODE` do **not**.

**4. Why a fork instead of editing dev?**
So nothing here can reach a live deployment by accident. The fork has its own `.clasp.json`, its own TEST sheet,
its own git history. Promotion to dev/prod is a deliberate runbook step, not a push.

---

### For George / n8n

**5. Why does George see `E_ALREADY_CLOSED`?**
The task was already Closed — by a human, by an earlier run, or by the legacy `doPost` path during the overlap
period. Nothing was written. **Treat it as success.** If it happens on the *first* attempt, check whether a
human closed it from the portal (`Closed By` in `n8n_listTasks`).

**6. Why `E_NOT_FOUND` for a JR task on a brand-new hire?**
The `jr_title` action item is created at **IT Setup** (`ITSetupHandler.triggerSpecialists`, only when
`plan306090 === 'Yes'`), not at submission. Poll `n8n_events` / `n8n_listTasks({workflowId, formType:'jr_title', status:'Open'})`
or keep the "JR Assignment —" email trigger until the task exists.

**7. Why `E_VALIDATION` with `unknown field (not in contract)`?**
You sent a key the contract does not list. Contracts are strict on purpose so a typo cannot land in the wrong
column. Run `n8n_contracts()` and compare. If the field genuinely exists on the form, the contract is wrong —
tell us; it is probably a `verified:false` entry.

**8. Can n8n change the Internal Employee ID?**
No. `n8n_submitIdSetup` ignores/uses the pre-assigned id; sending a different value returns `E_UPSTREAM` with
"Internal Employee ID is pre-assigned (…) and cannot be changed here." Only app admins (`CONFIG.ADMIN_EMAILS`)
via the UI can override, and it is logged.

**9. What actor should I use?**
`{ id:'n8n:<workflow-slug>', email:'efx-bot@team-group.com', display:'<label> (n8n)' }`. Never a person's
email. `efx-bot@` does not exist yet (*planned*, `/Bot Accounts` OU) — TEST wrappers use a test address we give you.

**10. What if n8n is down?**
Nothing in Forms waits for n8n. Humans keep using the portal; emails still go out; the Raw Log keeps recording
events with `Event ID`s. When n8n is back, `n8n_events({afterEventId})` catches up (up to the 5000-row prune
window, ~months). The optional push webhook is fire-and-forget and never blocks a submit.

**11. What if Forms is redeployed?**
The Execution API targets a **scriptId + API-executable deployment**, not the web-app URL, so web-app redeploys
(@75/@76 style) do not affect EFX calls. A new API-executable deployment gets a new deploymentId → update the
registry row (*planned*) or the Router's fixed id. Contract changes ship with a version bump; see Q13.

**12. Why is the 6-minute limit relevant?**
Every Execution API call is one Apps Script execution, capped at 6 minutes (same as the UI). Today's aliases
take seconds. The Router (*planned*) surfaces a timeout as `E_TIMEOUT`; before retrying a mutating call, read
state first (`n8n_getWorkflow` / `n8n_listTasks`) — the write may have succeeded.

**13. What is contract drift and how do I notice?**
The field list n8n was built against differs from what Forms exposes now. Symptoms: `E_VALIDATION unknown
field`, missing data in results, or (Router, *planned*) `E_CONTRACT_DRIFT` from a `hash` mismatch. Fix by
refreshing from `n8n_contracts()`. We never remove/rename without a deprecation window and a heads-up.

**14. Can I read the spreadsheet directly with a Sheets node "just for reads"?**
Please don't. `Dashboard_View` is a cache, `Action Items.Description` is JSON, `Raw Log` is pruned. Use
`n8n_getWorkflow`, `n8n_listTasks`, `n8n_events`. If a read you need is missing, ask — reads are cheap to add.

---

**15. I created two Initial Requests from n8n within a few seconds and got two workflows — I expected the second to be rejected as a duplicate?**
Correct behaviour. Forms has a 30-second double-submit guard. For Initial Requests it keys on *requester + employee name + hire date*
(since 2026-09-17): the **same** hire submitted twice returns the same `workflowId` and the same `internalEmployeeId`; a **different**
hire from the same requester gets its own workflow. Other request types (Equipment, Termination, Position Change) still dedupe on
requester only — space those out or vary `requesterEmail` when you test.

**16. I got `E_FORBIDDEN` with a `principal` of `efx-bot@team-group.com` — but my `actor.email` is an HR person?**
Authorization is decided by the real Google session (the impersonated `efx-bot`), never by `actor` (that is attribution only).
`efx-bot` must be in the matching `grp.forms.*` group or `CONFIG.ADMIN_EMAILS` for HR Verification, IT Setup and both approvals.
Ask us to add it per tier; do not try to work around it with a different `actor`.

**17. `n8n_ping` now returns `principal` — what should it say?**
Through the Router it must be `efx-bot@team-group.com`. From the Apps Script editor it is whoever is logged in. Anything else
means the service-account impersonation is wrong and every role check is unreliable — stop and tell us.

**18. I saved a task draft from n8n and a human's earlier checklist notes disappeared?**
Fixed 2026-09-17: `n8n_saveTaskDraft` now merges into the existing draft and keeps the Notes when you omit them. Only the items
you send are (re)written.

**19. Where do I see credentials (SiteDocs / DSS passwords) that ID Setup created?**
Nowhere through the API — every read path (`n8n_getContext`, `n8n_events`, `include:['record']`, `efxRunAs`) redacts keys that look
like passwords/secrets to `[REDACTED]`. Humans see them in the "Credentials Ready" email as today.

### Identity, GCP, security

**20. Why can't the service account live in a different GCP project?**
Google's Execution API rule: the OAuth client that calls `scripts.run` must belong to the **same GCP project the
script is linked to**. Hence one `efx-<tier>` project per tier, every registered script linked to it, and the SA
created inside it. This also explains why `gas_runner` / `clasp run` are dead today — prod Forms has no linked
standard project.

**21. Why domain-wide delegation?**
The SA alone has no Workspace identity; with DWD it impersonates `efx-bot@`, so the Execution API runs *as* that
user: `Session.getActiveUser()` is populated, AdminDirectory group checks work, and sheet access is the bot's
editor grant — no `ANYONE_ANONYMOUS` deployment, no shared secret.

**22. Where are secrets?**
SA key: in the n8n *Google Service Account* credential (encrypted by `N8N_ENCRYPTION_KEY`); its name/location in
Secrets Manager per `team-n8n-infra`. Forms holds **no** inbound secret. Optional outbound `EFX_EVENT_SECRET` is
a Script Property set via `setEfxEventWebhook`, never in the repo. See FOR_DEVELOPERS §7.

**23. What happened to the HMAC envelope / `kid` / `E_STALE` / `E_REPLAY` from `04_API_SPEC.md`?**
That was the anonymous-bridge transport (phase 1 of `03`). Superseded by the Execution API for inbound calls.
The same signing scheme is still used **outbound** by `RawLog.rawLogFanOut_` when the event webhook is enabled,
and the error-code names remain reserved for the Router.

**24. Does n8n get admin powers?**
No. `efx-bot@` is an editor on the tier's sheet and a member of nothing special. `Actor.canOverrideEmployeeId()`
is false for it. `efxRunAs` refuses any function not in `FormContracts.CALLABLE`. The Router (*planned*) adds a
per-project `enabled` switch.

---

### Operating

**25. Where are the logs?**
- n8n: every call is an execution (inputs, outputs, error code); the error workflow gets failures.
- Forms: `Logger.log` → Cloud Logging of the tier's GCP project (once linked); `Raw Log` sheet for every submit
  and result (`Event ID`, `Kind`, `User`); `Audit Log` for cancel/bump/hire-date; `Form Edit Log` for field diffs.
- Every EFX response has a `requestId` (`REQ-…`) — quote it.

**26. How do I turn a project off?**
*Planned*: set `enabled = FALSE` on its row in `EFX Registry (<tier>)`; the Router refuses with `E_FORBIDDEN`.
Today (pre-registry): disable the wrapper sub-workflows in n8n, or archive the API-executable deployment in the
Apps Script editor. Emergency: revoke the SA key (RUNBOOKS §1). Never flip the web-app manifest to do this.

**27. How do I test without emailing real people?**
TEST script has `EMAIL_REDIRECT_ALL=dbinns@team-group.com`. Confirm with `n8n_ping()` → `env` and
`spreadsheetId` before any run. Use `dryRun:true` on closes. Use fake names. Clone-and-redirect any workflow
that emails before pointing it at TEST. See FOR_GEORGE §7.

**28. Which contracts are trustworthy right now?**
`new_hire` and `id_setup` (`verified:true`). The other nine (`equipment_request`, `termination_request`,
`position_change_request`, `hr_verification`, `it_setup`, `it_confirmation`, `termination_approval`,
`position_change_approval`, `specialist`) are best-effort from handler code and must be reconciled via
`docs/mapping/` + `form-field-map-test.js` before an alias is exposed. Two known Forms bugs the contracts route
around: `submitITConfirmation` is defined twice (prod vs dev differ), and `submitSpecialistForm`'s sheet map is
dead (prefer `n8n_closeTask` for specialist items).

**29. Does the Internal Employee ID change affect old requests?**
No migration required. Old `NEW_EMP_` workflows have no registry row: the ID Setup page falls back to the
legacy prediction, and submit allocates through the registry from then on. Optional `migrateEfxBackfillEmployeeIds`
seeds the registry from `ID Setup Results` so `max()` reads are cheap. Downstream readers still read
`ID Setup Results` col D.

**30. What does `SAFETY_TRAINING_AT_SUBMIT` do?**
Off by default. When on (`setSafetyTrainingAtSubmit(true)`), the Safety Onboarding action item is created at New
Hire submission instead of at ID Setup (hourly) / after HR Verification (salary), so training can be assigned
immediately. `n8n_assignSafetyTraining` closes whichever exists.

**31. `n8n_events` returned `pruned:true`. Now what?**
Your `afterEventId` is no longer in the sheet (Raw Log keeps the newest 5000 rows). Re-sync with `afterTs` set
to your last processed timestamp, then continue with `nextAfterEventId`. RUNBOOKS §5.

**32. Can I call `submitInitialRequest` directly through `efxRunAs` instead of the alias?**
It is allow-listed, so technically yes — but you lose contract validation, the envelope and `include:['record']`.
Use `n8n_createInitialRequest`. `efxRunAs` exists for the Router's generic "Call Function" operation.

**33. The response says `success:true` but no email arrived.**
Check `EMAIL_REDIRECT_ALL` (all mail goes to one inbox on TEST) and `SUPPRESS_EMAILS_OVERRIDE`. On prod, the
handler's email step is inside the same execution, so a `success:true` means the send call ran; look in Cloud
Logging for `[EmailUtils]` lines by `requestId` timestamp.

**34. What is `apiVersion` vs `contractsVersion` vs `libraryVersion`?**
`apiVersion` = `N8N_API_VERSION` (alias surface, bump on breaking). `contractsVersion` = `FormContracts.VERSION`
(field lists, bump on any change). `libraryVersion` in `n8n_ping` currently mirrors `FormContracts.VERSION`.

**35. Who do I contact?**
dbinns@team-group.com (Forms + EFX). George owns the n8n workflows. Include the `requestId` and the alias name.
