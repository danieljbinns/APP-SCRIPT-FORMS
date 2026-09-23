# "Forms Help" chatbot — product + technical spec (draft 1, 2026-09-16)

**Status:** planning only. Nothing built, nothing deployed, no Workspace/GCP/n8n/AWS change. Depends on the EFX TEST tier
(`docs/DELIVERY_BRIEF_2026-09-17.md`) existing first. Every alias, group, file and defect named here exists in this fork or in
`spec/` (`P:\Projects\Company\N8N\_agent-bundle\…\spec\`); anything not verifiable is marked **[unverified]**.

Ask from the user: *"plan a chat bot for help with form use, integrable to BOSS or portal or Google Chat hook."*

---

## 1. Problem

Employee Forms (Apps Script web app + Google Sheets) drives four workflows (`NEW_EMP_`, `EQUIP_REQ_`, `TERM_`, `CHANGE_`) through
gated steps, templated emails with fixed subjects, and specialist **action items** (`Action Items` sheet, `formType` keys).
The rules are real but invisible to users: when a task is created, who owns it, why an email did or did not arrive, what a field
does downstream, why a task is still Open. Today those questions land on HR (`grp.forms.hr`), IT (`grp.forms.it` = dbinns +
dexingcheng) and ID Setup (`grp.forms.idsetup`) by email, and on dbinns for anything technical. The knowledge exists — in
`docs/wiki/`, `docs/mapping/*.md`, `docs/N8N_CONTRACTS.md`, `docs/review/KNOWN_DEFECTS_PROD.md` — but only in engineering form.

EFX now gives a machine-callable, contract-validated, attributable surface (`employee_management_v2_efx/N8n.js`, 27 `n8n_*`
aliases). A help bot can sit on that surface without touching the forms' UI.

## 2. Users and the questions they actually ask

Derived from `docs/wiki/FAQ.md`, `RUNBOOKS.md`, `COOKBOOK_FOR_GEORGE.md`, `docs/mapping/*.md`, `KNOWN_DEFECTS_PROD.md`.

| User | Identity source | Typical questions | Source of the answer |
|---|---|---|---|
| **Requester** (site manager) | Workspace user; `requesterEmail` / `reportingManagerEmail` on the request | "What's the status of Ada's onboarding?" · "What happens after I submit?" · "Why is `jobSiteNumber` required?" · "Why did my submit fail?" (formula guard: any field starting `-` `+` `=` `@`, defect #13) · "Can I change the hire date?" | `n8n_getWorkflow`, `n8n_getContext`, `INITIAL_REQUEST.md`, `n8n_updateHireDate` (HR/IT/Admin only) |
| **HR** (`grp.forms.hr`) | group member | "What's still open on NEW_EMP_…?" · "What's the next step after HR Verification?" (IT Confirmation when Systems contains BOSS, else IT Setup; Hourly+No system access skips IT) · "Why was `New Hire/Rehire` blanked?" (defect #1) · "Why two ID Setup rows?" (defect #12) | `n8n_listTasks`, `n8n_getWorkflow`, `ID_SETUP.md`, `KNOWN_DEFECTS_PROD.md` |
| **IT** (`grp.forms.it`) | group member | "Which IT tasks are mine?" · "Why is `IT Confirmation` still Open?" (never closed by code, non-blocking — defect #8) · "Where does `Email_Temp_Password` go?" | `n8n_listTasks({assignedTo})`, `ACTION_ITEMS.md`, `it_setup` contract |
| **ID Setup** (`grp.forms.idsetup`) | group member | "Which `siteDocsJobCode` values are allowed?" (`Hourly 1 \| Hourly 2 \| Salary 1 \| Salary 2 \| Supervisor \| Manager`) · "What is the pre-assigned Internal Employee ID for this workflow?" · "Why can't I change the ID?" (pre-assigned at submit; admin override only) | `n8n_contracts`, `n8n_getEmployeeId`, FAQ Q8 |
| **Specialists** (`grp.forms.safety`, `review306090`, `fleetio`, `creditcard`, `jonas`, `payroll@`) | group member | "What do I still need to do?" · "Why is the credit-card limit always 'Standard'?" (defect #15) · "Why one Fleetio task for add *and* remove?" (defect #17) · "Is my task blocking completion?" (`JR Title`, `WIS`, `Manager`, `IT Confirmation` never block; `Safety` always does) | `n8n_listTasks`, `ACTION_ITEMS.md` §3 |
| **George** (`grp.forms.jrtitle`, `review306090`; n8n owner) | person + n8n | "Who closes the JR task?" (his automation; `jr_title` created at IT Setup only when `plan306090 === 'Yes'`; non-blocking) · "Which alias / error code?" · "Is the canary green?" | `JR.md`, `FOR_GEORGE.md` §6, `n8n_ping` |
| **Admins** (`CONFIG.ADMIN_EMAILS`) | list in `Config.js` | "Show me everything open for site X" · "Bump this workflow" · "Cancel this request" | `n8n_listWorkflows`, `n8n_bumpWorkflow`, `n8n_cancelWorkflow` |

Cross-cutting: **"why didn't I get the email"** — closes send no email except `Assets` and workflow completion; JR/Safety/Review
tasks are emailed to the *group* not the person; TEST redirects everything to dbinns (`EMAIL_REDIRECT_ALL`); `SUPPRESS_EMAILS_OVERRIDE`;
the Safety task is created at ID Setup (Hourly+No) or after HR Verification (everyone else), so "after Initial Request" is too early.
**Guided form filling** — "help me fill a New Hire for a salaried supervisor at Aurora" → the 13 required `new_hire` keys, enums, the
clearing rules (`systemAccess = No` clears `systems`/`equipment`), the consequence of `plan306090 = Yes` (creates `review_306090` + `jr_title`).

## 3. Goals / non-goals

**Goals** — (G1) deflect the repeat questions above from HR/IT/ID Setup; (G2) give any Workspace user *their own* live status
without opening the dashboard; (G3) make form filling right the first time (fewer `E_VALIDATION` / formula-guard failures, fewer
duplicate ID Setup rows); (G4) let task owners close their *own* tasks from chat with full attribution; (G5) reuse EFX — no second
API, no sheet reads, no new Forms business logic.

**Non-goals** — no change to the forms' HTML/CSS/layout (standing rule; the portal channel is a later, separately approved phase);
no submitting a workflow-creating form on a user's behalf; no HR/IT/approval actions from chat in v1; no replacement for the
dashboard; no new email templates; no writing to sheets; no BOSS-side changes (George's Lambda/API GW untouched).

## 4. Capability tiers

| Tier | What the bot does | Aliases / tools | Forms change? | Authorization |
|---|---|---|---|---|
| **T0 Docs** | Answers from a curated knowledge base (what each step/field/task does, who owns it, known quirks). No live data. | none (retrieval only); `n8n_contracts` for field lists | none | none — public to the domain |
| **T1 Read (scoped)** | Live status *for the asking user*: status/step/checklist, their open tasks, employee id, recent events. | `n8n_getWorkflow`, `n8n_listTasks`, `n8n_listWorkflows`, `n8n_getContext`, `n8n_getEmployeeId`, `n8n_events`, `n8n_ping` | none | **bot-side** (see §5) — the read aliases have no role checks and return everything |
| **T2 Draft + hand-off** | Builds a contract-valid payload, shows it, links to the real form. Never submits. | `n8n_contracts` (validate keys/enums), `efxRunAs('getSitesList'|'getJRsList'|'getInitialFormData')` via Router *Call Function* **[unverified as wrapper]** | none for link-only hand-off. **URL prefill needs a Forms change** — the HTML forms do not read field values from query params in the sources; a `?form=…&draft=<id>` route would be new (additive `Router.js` route + server-side draft store). | none (no writes) |
| **T3 Gated actions** | Close *own* task, save a draft on *own* task, bump a workflow the user requested/manages. Explicit confirm card, then call. | `n8n_closeTask` (with `dryRun:true` first), `n8n_saveTaskDraft`, `n8n_bumpWorkflow`, `n8n_closeJrTask` (George only) | none for the calls; **one additive alias** recommended for logging (`n8n_logEvent`, §7) | **bot-side + Forms** (§5): own-task rule enforced by the bot; Forms' own checks run against the bot principal |

Out of tier / never from chat: `n8n_createWorkflow`/`n8n_createInitialRequest` and the other creates, `n8n_submitIdSetup`,
`n8n_submitHrVerification`, `n8n_submitItSetup`, both approvals, `n8n_cancelWorkflow`, `n8n_updateHireDate`, `n8n_assignSafetyTraining`
(these belong to humans in the UI or to George's approved n8n flows).

## 5. Permission model — the hard part

**Facts from the code.** `Actor.js`: `Actor.email()` is *attribution* (Submitted By / Closed By / Raw Log User); `Actor.principal()`
is *authorization* = `Session.getActiveUser()` = the impersonated bot under the Execution API. Role checks (`isHR/isAdmin`, `canCancel`,
`canBump` in `Services/AccessControlService.js`) use the principal, never the caller-asserted actor (`N8n.js` maps their failures to
`E_FORBIDDEN`). `efxTaskClose` performs **no** assignee check ("same trust level as `doPost`", `JR.md` §3c). The read aliases have **no**
scoping. So: with a shared bot principal, a requester chatting "close the HR task" *would succeed* unless the bot stops it.

| Option | How | Pros | Cons | Verdict |
|---|---|---|---|---|
| **P1 Per-user OAuth** — chat user consents once; the bot calls `scripts.run` with *the user's* token | Google Chat app "acting as the user" (user-authorization flow) **[unverified — Chat API user-auth scopes must be checked against the Forms manifest scopes]**; or a one-time OAuth consent page hosted by the bot | Forms' own role checks apply exactly (`Session.getActiveUser()` = the human). Attribution and authorization coincide. No allow-list to maintain. | Every user consents to the Forms scopes (Sheets/Gmail/Admin Directory as declared in the manifest — heavy). Token storage. OAuth client must live in the script's GCP project (FAQ Q15). Apps Script quotas per user. | **Target for T3 in a later phase**; too heavy for v1 |
| **P2 Allow-list sheet** `(userEmail, action, scope)` maintained by admins | Bot reads a `Chat ACL` sheet; refuses anything not listed | Simple, auditable, no Workspace work | Duplicates and drifts from `grp.forms.*` and `CONFIG.ADMIN_EMAILS`; someone must maintain it | Use only as an **override/deny list** (e.g. temporarily block a user), not as the primary model |
| **P3 Bot-side ownership checks** (recommended v1) | Before any T1 read or T3 action the bot resolves the chat user's email and computes `scope = {own emails} ∪ {grp.forms.* groups they belong to} ∪ {admin?}`; filters `n8n_listTasks` results by `assignedTo ∈ scope`, `n8n_listWorkflows`/`getWorkflow` by `requesterEmail`/`managerEmail`/`reportingManagerEmail` from `n8n_getContext` ∈ scope; T3 only on tasks with `assignedTo ∈ scope` | No consent flow; maps exactly onto how Forms already routes work (`Assigned To` is a group or a person). Admins/HR/IT see all by group membership. | Needs group membership lookup (Admin SDK Directory `members.hasMember`, or a GAM-refreshed mirror sheet — decision Q26). Reads still *fetch* everything then filter → PII passes through the bot process (not the LLM if filtered before the model sees it). | **v1 for T1 + T3** |
| **P4 Separate least-privilege principal** `forms-help-bot@` (not George's `efx-bot@`) | Second DWD impersonation target; **not** in `grp.forms.hr/it`; editor on the sheet; own API-executable deployment or same script | Defense in depth: even if the bot is tricked, HR/IT/approval aliases return `E_FORBIDDEN`. Separate Apps Script quota from George's automations. Separate `Closed By` fingerprint. | One more bot account + DWD scope grant (Workspace admin); neither bot exists yet (`10_ACCESS_AND_ACCOUNTS.md` §2) | **Do it** — combine with P3 |

**Rule set for v1 (P3 + P4):**
1. Identity = the Workspace user from the channel (Google Chat gives `user.email` on every event; portal gives `Session.getActiveUser()`).
   Never trust an email typed in the message.
2. Scope resolution cached 10 min per user. Groups checked: the eleven in `10_ACCESS_AND_ACCOUNTS.md` §1 (`grp.forms.hr/it/idsetup/
   jrtitle/review306090/safety/fleetio/creditcard/jonas`, `payroll@`) plus `CONFIG.ADMIN_EMAILS`.
3. T1: a workflow is visible if the user is requester, manager, an assignee of one of its tasks (person or via group), or HR/IT/admin.
   Otherwise the bot answers "I can see that workflow exists but you're not on it — ask <requester name>" (existence only, no data).
4. T3: only `n8n_closeTask`/`n8n_saveTaskDraft` on tasks where `assignedTo ∈ scope`; `n8n_bumpWorkflow` only when requester/manager/HR/IT/admin
   (mirrors `canBump`). Always `dryRun:true` → confirmation card showing `taskId`, task name, checklist that will be marked Complete,
   and the note text → user taps **Confirm** → real call. `E_ALREADY_CLOSED` reported as "already closed by <closedBy>".
5. Attribution: `actor = { id:'chat:google:<userEmail>', email:<userEmail>, display:'<Name> (Forms Help)' }`. This puts the *human* in
   `Closed By`, which is the truthful record. It deviates from `FOR_GEORGE.md` §4 ("email always the bot") because that rule targets
   unattended automations — decision **Q25**.
6. Defense in depth: the bot principal is `forms-help-bot@` with no HR/IT membership, so even a bypass of rule 4 cannot submit
   HR Verification, approvals, cancels or hire-date changes.

## 6. Channels

| Channel | Integration sketch | Identity / authz | Cost | Latency | George-maintainable? | Blast radius |
|---|---|---|---|---|---|---|
| **(a) Google Chat app** — DM + `Forms Help` space, slash commands (`/status NEW_EMP_…`, `/mytasks`, `/field siteDocsJobCode`, `/close TK-…`), cards with Confirm buttons | Two builds: **a1** Apps Script-native Chat app (`onMessage`, `onCardClick` in a *separate* Apps Script project, so no change to the Forms project); **a2** Cloud Run service (Node/TS, Anthropic SDK) registered as the Chat app HTTP endpoint. Both call EFX via the Execution API. | **Strongest**: Chat delivers the verified Workspace user on every event. Chat app config in Admin console (Workspace admin task). | Chat: free. LLM: §7. a1: Apps Script quotas (6-min limit, UrlFetch quota to the Anthropic API — the LLM call must fit in the 30 s Chat response window or use async reply). a2: small Cloud Run bill. | a1: 3–8 s (GAS cold start + LLM). a2: 2–5 s. | a1 partly (it is Apps Script + a config sheet); a2 no (TypeScript service). | Low: separate project/service; can be disabled in Admin console without touching Forms. |
| **(b) Portal embed** — help panel inside the web app | **Not now** (standing rule: no UI/layout changes). Later options that avoid touching existing pages: a new `doGet` route `?form=help` (additive line in `Router.js`) rendering its own page, or a `HtmlService` dialog. `google.script.run` gives `Session.getActiveUser()` = the human, so authz could be Forms-native. | Excellent (real session) | LLM only | 2–5 s | No (Forms code) | **Medium**: lives in the prod script; every change is a Forms deploy (`PROCESS_CHANGE_MANAGEMENT.md`). Phase 4 at the earliest. |
| **(c) BOSS** — George's side | The sources show BOSS as an intranet George drives via Lambda `boss-jr-assign` behind API GW `ik2ur9kika` (`POST /assign`, `POST /editDuties`); **no BOSS chat surface is documented [unverified]**. Realistic shape: the bot runs as an n8n workflow (see d) exposed on an n8n **Webhook** node; BOSS (or George's flows) POST `{userEmail, text}` and receive the answer JSON. Identity would be *asserted by the caller* → **T0/T1-for-groups only, no T3** unless BOSS can pass a verified Workspace identity. | Weak (caller-asserted) | LLM only | 2–5 s | **Yes** — it is an n8n workflow | Low if read-only |
| **(d) n8n as the orchestration layer for all channels** — Chat app HTTP endpoint → n8n Webhook → intent/LLM → EFX wrappers (`14`,`15`,`25`,`26`,`16`,`27`,`28`) → reply | Chat app registered with an n8n webhook URL (Chat requires the endpoint to answer in ~30 s; n8n *Respond to Webhook* node). LLM via n8n's Anthropic chat-model / AI Agent nodes **[version-dependent — verify on staging n8n]** or an HTTP Request node to the Anthropic API. Credentials in n8n. | Chat still supplies the verified user; n8n must **verify the Chat request** (Google-signed bearer token) before trusting `user.email` — a Code node step **[to verify]**. | LLM + nothing new (n8n exists) | 3–8 s (webhook hop + Router sub-workflow hop + LLM) | **Yes** — same kit George already uses; wrappers are the tools | Low; uses the existing Router credential model. Risk: one workflow doing auth, LLM, tools and formatting gets big. |

**Compared on the five axes:**

| | Auth | Cost | Latency | Non-dev maintainability | Blast radius |
|---|---|---|---|---|---|
| a1 Chat app (Apps Script) | strong | lowest | medium | medium | low |
| a2 Chat app (Cloud Run) | strong | low | best | low | low |
| b Portal | strong | low | good | low | **medium** |
| c BOSS webhook | weak | low | good | high | low |
| d n8n orchestration | strong (if token verified) | lowest | medium | **high** | low |

## 7. LLM layer

**Models (Anthropic Claude).** Chat/answering: `claude-sonnet-5` with `thinking: {type:"adaptive"}` and `output_config.effort: "low"`
(chat is not a coding task; raise to `medium` only if evals show misses). Intent routing / scope classification / PII pre-filter:
`claude-haiku-4-5-20251001` (fast and cheap; structured output only, never free text to the user). Escalate to
`claude-opus-5` only for the guided-form-filling turn if Sonnet 5 gets enums/clearing rules wrong in evals; `claude-fable-5-1` not
needed. Prefill is unavailable on these models — use `output_config.format` (structured outputs) for the router's
`{intent, workflowId?, taskId?, field?, needsLiveData}` and `strict: true` on every tool.

**Tools = EFX aliases, one to one**, JSON schemas generated from `docs/contracts.lock.json` + the signatures in `N8N_CONTRACTS.md`
(`n8n_getWorkflow(workflowId)`, `n8n_listTasks(filter)`, …). The tool handler injects `actor` and applies §5 scope *before* returning
results to the model. Mutating tools are only registered in T3 sessions and always run `dryRun:true` first; the real call happens on
the card's Confirm button, outside the model loop.

**Knowledge (T0).** Retrieval over a *curated* corpus built from `docs/wiki/HOW_IT_WORKS.md`, `FAQ.md`, `docs/mapping/*.md`,
`docs/review/KNOWN_DEFECTS_PROD.md`, `docs/N8N_CONTRACTS.md` — **rewritten for end users** (the current docs are for George/developers;
no end-user guide exists — gap, Phase 0 work). Store as Markdown in the repo (`docs/help/`), synced to a Drive folder the bot reads;
chunk by heading; cite the section in every answer. Field names are validated against `n8n_contracts()` before they appear in an answer.

**Prompt caching.** Render order `tools → system → messages`; keep the system prompt + contracts summary + top retrieved chunks as the
stable prefix with one `cache_control` breakpoint; user turn last. Sonnet 5 does not support mid-conversation system messages — per-turn
reminders go in the user turn.

**Guardrails.**
- Credentials: `efxRedact_` already strips `password|passwd|pwd|secret|token|apikey|api_key|vm_?pin|Email_Temp_Password` from
  `n8n_getContext`, `n8n_events`, `include:['record']`. The bot adds the same regex on *its* side and never asks for or repeats passwords
  ("credentials arrive in the *Credentials Ready* email; I can't show them").
- Never invent field names/enums: every field mentioned must exist in the contract for that form; otherwise say so.
- User text is data: quoted and fenced in the prompt; instructions inside a message or inside sheet data (task notes, comments) are
  not followed; the only actions are the registered tools; no URLs are fetched from user text.
- PII minimisation: the model sees only the rows the user is allowed to see (§5 rule 3), only the fields needed for the question
  (name, workflow id, step, task names, dates, assignee — not full request rows); nothing is stored by the bot beyond the telemetry
  in §8. Employee data stays in Workspace (sheets); the LLM call is transient.
- Rate limits: per user 20 turns / 10 min, 5 mutating actions / hour; global cap aligned with Apps Script Execution API quota on the
  bot principal (separate principal, §5 P4). Bump is additionally rate-limited by Forms (`E_RATE_LIMITED`).
- Stop reasons handled: `end_turn`, `tool_use`, `max_tokens` (truncate → ask to narrow), `refusal` (apologise, log).
- Every tool error code (`E_VALIDATION`, `E_NOT_FOUND`, `E_ALREADY_CLOSED`, `E_TASK_NOT_OPEN`, `E_FORBIDDEN`, `E_RATE_LIMITED`,
  `E_UPSTREAM`, `E_INTERNAL`, Router `E_TRANSPORT`/`E_SCRIPT`) has a fixed plain-English rendering (from `COOKBOOK_FOR_GEORGE.md` §4).

**Cost sketch.** 200 turns/day, ~2K uncached + ~6K cached input, ~500 output tokens on Sonnet 5 ≈ **$50–100/month**; Haiku routing
adds ~10%. Cloud Run (if a2) ≈ $10–20/month. Negligible next to one HR/IT hour a day.

## 8. Data model & telemetry

| Store | What | Where | Notes |
|---|---|---|---|
| **Chat Log** sheet (bot-owned spreadsheet, not the Forms sheet) | `ts · channel · userEmail · space/thread · intent · question (redacted) · answer (redacted) · toolsCalled[] · requestIds[] · latencyMs · model · tokensIn/out · feedback` | New spreadsheet owned by `forms-help-bot@` | Keeps the Forms `Raw Log` (pruned at 5000 rows) free for form events. Retention 90 days, then prune. |
| **Raw Log events** (Forms) | Only for T3 actions: `chat.action.dryRun`, `chat.action.confirm`, `chat.action.result` with `{userEmail, taskId, workflowId, alias, requestId}` | Forms `Raw Log` via a new additive alias `n8n_logEvent(actor, kind, workflowId, payload)` → `rawLogEvent_` (`RawLog.js`) | `rawLogEvent_` is private today; the alias is a ~10-line addition + `N8N_API_VERSION` bump. Optional: T3 is already visible as `Closed By` on the task. |
| **Feedback** | Thumbs up/down on each answer card; optional free text | Column on Chat Log | Weekly review by dbinns/HR. |
| **Unanswered / low-confidence** | Router marks `intent = unknown` or the answer cites no source → row flagged `needsDoc = TRUE` | Chat Log filter → feeds `docs/help/` and `docs/wiki/FAQ.md` | The deflection flywheel. |
| **Scope cache** | `userEmail → {groups[], isAdmin, at}` | In-memory/CacheService, 10 min | Never persisted. |

Proposed Raw Log `Kind` values (additive to `submit`, `result`, `task.created`, `task.closed`): `chat.action.dryRun`, `chat.action.confirm`,
`chat.action.result`, `chat.denied` (scope refusal — useful audit).

## 9. Recommendation

**Build (d) n8n-orchestrated Google Chat app for T0/T1, then T3 with P3+P4; keep (a2) Cloud Run as the fallback if n8n's Chat-token
verification or the 30 s response window proves awkward on staging; portal (b) only as a later, separately approved phase.**

Why: Chat gives the verified identity the permission model needs; n8n reuses the exact Router/wrapper kit George already runs
(`00_EFX_Router.json`, `14`–`16`, `25`–`28`) and stays maintainable by him; a BOSS entry point falls out for free as a second Webhook
trigger on the same workflow (read-only unless BOSS can pass a verified identity); no Forms change is needed for T0–T2 and only one
additive alias for T3 logging. Everything else in this spec holds for (a2) unchanged.

## 10. Phases

| Phase | Scope | Size | Depends on | Needs Forms change | Needs Workspace admin | Needs George |
|---|---|---|---|---|---|---|
| **0 Knowledge base** | Write `docs/help/` (end-user guide: steps, emails, tasks, fields, known quirks) from the mapping docs; 60-question eval set with expected sources | **M** | nothing | no | no | review of JR/30-60-90 answers |
| **1 T0 bot on staging n8n** | Chat app (dev-only visibility) → n8n webhook → Haiku router → Sonnet answer with citations → Chat card; Chat Log + thumbs; eval ≥ 85% source-correct | **M** | Phase 0; Anthropic API key in n8n credentials; Chat app registration | no | **yes** (Chat app in Admin console, `forms-help-bot@` account) | no |
| **2 T1 scoped reads on EFX TEST** | Tools `n8n_getWorkflow`, `n8n_listTasks`, `n8n_listWorkflows`, `n8n_getContext`, `n8n_getEmployeeId`, `n8n_events`; scope resolver (P3); `/status`, `/mytasks` | **M–L** | EFX TEST tier live (`SETUP_PLAN_TOMORROW.md`); DWD for `forms-help-bot@`; group lookup decision (Q26) | no | **yes** (DWD scope, Directory read or GAM mirror) | test flows against TEST sheet |
| **3 T2 guided filling** | Contract-driven interview for `new_hire` (then `termination_request`, `position_change_request`); shows validated payload + link to the real form | **M** | Phase 2; reference lists (`getSitesList`/`getJRsList` via Router *Call Function*, or a new `n8n_reference` read alias) | optional additive read alias; **URL prefill = Forms change, deferred** | no | no |
| **4 T3 own-task actions** | `n8n_closeTask` (dryRun → confirm), `n8n_saveTaskDraft`, `n8n_bumpWorkflow`; `chat.*` events; per-user rate limits | **L** | Phase 2; `n8n_logEvent` alias; Q25 attribution decision | **yes** (one additive alias + version bump, via `PROCESS_CHANGE_MANAGEMENT.md`) | no | George opts in for `n8n_closeJrTask` from chat (probably no — his flow already closes it) |
| **5 Prod** | Chat app visible to the domain; Router pointed at prod EFX (after `CUTOVER_PLAN_JR.md` gates G1–G6 equivalents for the help principal); canary | **M** | prod EFX door exists (GCP `efx-prod`, DWD) | no | yes | no |
| **6 Portal / BOSS** | `?form=help` route or dialog (separate approval); BOSS webhook entry (read-only) | **M / S** | Phase 5; UI-change approval | **yes** (route) / no | no | BOSS: yes |

Sizes: S ≤ 2 days · M ≈ 1 week · L ≈ 2–3 weeks of focused work, excluding waits on admin steps.

## 11. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Read aliases return everything; a scope bug leaks another site's hires | Filter before the model sees data; unit tests on the scope resolver; `chat.denied` audit; T1 launches to HR/IT/admins first (they may see all anyway), then requesters |
| R2 | Shared principal lets a requester close an HR task | P3 own-task rule **and** P4 least-privilege principal (not in `grp.forms.hr/it`) |
| R3 | Bot repeats a password from task notes / `Form Data` | `efxRedact_` on the Forms side + same regex bot-side + system rule; eval case for it |
| R4 | Wrong tier — bot points at prod sheet during testing | Every session starts with `n8n_ping` and asserts `env`/`spreadsheetId` (canary pattern, `30_EFX_Canary.json`); refuse tools on mismatch |
| R5 | Chat 30 s response window vs GAS + LLM latency | Acknowledge immediately, reply asynchronously via Chat API `messages.create` in the thread; Haiku router keeps simple turns fast |
| R6 | Hallucinated field names / steps | Field names validated against `n8n_contracts()`; answers must cite a `docs/help/` section; eval set |
| R7 | Apps Script quota exhaustion shared with George's automations | Separate principal (P4); per-user rate limits; cache reads 60 s per workflow |
| R8 | Prompt injection via task notes/comments (sheet data) | Sheet data rendered as quoted data blocks; tools are the only actions; no free-text-driven writes |
| R9 | Docs drift (contract changes) | KB build step runs `node tools/gen-contracts.js` + `tools/n8n-check.js`; `apiVersion` from `n8n_info` checked at session start |
| R10 | Users treat bot answers as HR policy | Footer: "Process help only — policy questions go to HR"; no answers on pay, discipline, legal |

## 12. Open questions (continuing from Q23 in `spec/07_OPEN_QUESTIONS.md`)

**Q24 — Channel & orchestrator.** Confirm (d) n8n-orchestrated Google Chat app over (a2) Cloud Run. Needs: does staging n8n's version
ship an Anthropic chat-model / AI Agent node, and can a Code node verify the Google-signed Chat request token? [unverified]
**Q25 — Attribution from chat.** `actor.email` = the chat user (truthful `Closed By`) vs. the bot email (FOR_GEORGE §4 rule). Recommend the
user, with `actor.id = chat:google:<email>`; attribution grants nothing (`Actor.principal()` still governs).
**Q26 — Group membership lookup.** Admin SDK Directory read scope on `forms-help-bot@` via DWD, or a GAM-refreshed mirror sheet
(`grp.forms.*` → members, nightly)? Mirror is simpler and read-only; Directory is live.
**Q27 — Second bot principal.** Create `forms-help-bot@team-group.com` in `/Bot Accounts` alongside the planned `efx-bot@`, with its own
DWD grant and no HR/IT membership? (Neither exists yet — `10_ACCESS_AND_ACCOUNTS.md` §2.)
**Q28 — T1 visibility for requesters.** Requester/manager see *their* workflows only; HR/IT/admins see all. Should site-level roll-ups
("everything open at Aurora") be admin-only?
**Q29 — URL prefill.** Approve a future additive `?form=new_hire&draft=<id>` route (server-side draft store) so T2 can hand off a prefilled
form, or keep hand-off as "validated payload + link"? This is a Forms change with UI-adjacent effect.
**Q30 — `n8n_logEvent` alias.** Add it (additive, version bump) for `chat.*` events in the Forms Raw Log, or keep chat telemetry only in the
bot's own sheet and rely on `Closed By` for T3 attribution?
**Q31 — Which T3 actions, for whom.** v1 proposal: `closeTask`/`saveTaskDraft` on own tasks; `bumpWorkflow` for requester/manager/HR/IT.
Should specialists be allowed to close via chat at all, given the UI checklist (`ActionItemForm.html`) captures per-item comments/serials
that a chat close would default to `Complete`? (`Assets` tasks: no — they need `Collected`/`Not Returned` + serials.)
**Q32 — Knowledge-base ownership.** Who reviews `docs/help/` content for HR/ID Setup accuracy before it answers real users?
**Q33 — PII/retention.** 90-day Chat Log retention and redaction acceptable to HR? Any need to exclude termination (`TERM_`) workflows from
chat entirely?
**Q34 — Prod door timing.** T1/T3 on prod require the prod EFX Execution-API door (`efx-prod`, DWD). Is the help bot allowed to be the
second consumer after George, or must it wait for JR cutover completion?
**Q35 — Data residency of the LLM call.** Confirm sending redacted, scoped employee names/dates/ids to the Anthropic API is acceptable to
TEAM Group; if not, T0 only (no live data to the model) or `inference_geo` pinning.

## 13. Success metrics

| Metric | Baseline (to measure in Phase 0) | Target after Phase 2 | Target after Phase 4 |
|---|---|---|---|
| Deflection: status/"what's next"/field questions reaching `grp.forms.hr` / `grp.forms.it` / dbinns | count from a 2-week inbox sample | −50% | −70% |
| Time-to-answer for "what's the status of X" | minutes–hours (email) | < 10 s, in chat | same |
| Answer quality (eval set, source-correct) | — | ≥ 85% | ≥ 90% |
| Thumbs-up rate | — | ≥ 75% | ≥ 80% |
| `E_VALIDATION` / formula-guard failures on New Hire submits (from Raw Log `submit` vs `result` pairs) | measure | −30% | −50% |
| Duplicate `ID Setup Results` rows per workflow (defect #12) | measure | −50% | — |
| Task closure latency (Created → Completed) for `review_306090`, `safety_onboarding`, `fleetio`, `creditcard` | measure from `Action Items` | — | −25% |
| Unanswered-question backlog turned into docs | — | ≤ 10 open/week | ≤ 5 |
| Security: scope refusals (`chat.denied`) with no false negatives in monthly audit | — | 0 leaks | 0 leaks |

---

## Appendix A — Example conversations (tool + authorization per turn)

Identity in every example comes from Google Chat (`user.email`). `scope()` = §5 rule 2.

**A1 — Requester, status (T1).**
> **Kelly (site manager):** what's the status of Ada Lovelace's onboarding?
> *Router (Haiku):* `{intent:"status", employeeName:"Ada Lovelace"}` → `n8n_listWorkflows({type:"Onboarding", employeeName:"Ada Lovelace", limit:5})` → 1 hit `NEW_EMP_…` → `n8n_getContext(wf)` → `requesterEmail === kelly@…` ✔ in scope → `n8n_getWorkflow(wf)`.
> **Bot:** Ada's request `NEW_EMP_20261005-…` is **In Progress — HR Verification Needed**. Done: Initial Request, ID Setup (by dan.anger). Pending: HR Verification (grp.forms.hr). Because she's Hourly with system access, IT Setup follows HR. Nothing is waiting on you. *(source: How it works §3)*

**A2 — Specialist, "what do I still need to do" (T1).**
> **Nick (grp.forms.fleetio):** what do I still need to do?
> `scope()` → groups include `grp.forms.fleetio` → `n8n_listTasks({status:"Open", assignedTo:"grp.forms.fleetio@team-group.com"})`.
> **Bot:** 2 open Fleet tasks: `TK-8247F3AB` *Fleetio Access — Ada Lovelace* (created 3 d ago, checklist: Create Fleetio account, Assign company vehicle) → [Open task]; `TK-19C0…` *Fleetio Access Update* (CHANGE_…). Fleet tasks **block** completion for New Hire and Status Change. Note: on Status Change, add *and* remove collapse into one task (known defect #17) — check the request's Removed Access too.

**A3 — Out-of-scope read refused (T1 denial).**
> **Kelly:** show me everything open at Aurora
> `scope()` → not HR/IT/admin → site roll-up refused (Q28).
> **Bot:** I can only show workflows you requested or manage. For a site-wide view use the dashboard, or ask HR. *(logged `chat.denied`)*

**A4 — Field meaning + guided filling (T0 → T2).**
> **Kelly:** filling a new hire for a salaried supervisor at Aurora — what do I need?
> `n8n_contracts()` → `new_hire.required` (13 keys) + enums; `efxRunAs('getSitesList')` for site values [Router *Call Function*].
> **Bot:** Required: first/last name, hireDate, requester + reporting manager (name + email), positionTitle, siteName=`Aurora`, jobSiteNumber (pick from the list), employmentType=`Salary`, employeeType (`Direct Hire`/`Agency`), newHireOrRehire, systemAccess. Choosing **Salary** switches systemAccess to Yes and opens Systems/Equipment. Set `plan306090 = Yes` only if you want the 30/60/90 review **and** JR title tasks created at IT Setup. Don't start any field with `-`, `+`, `=` or `@` — the whole submit is rejected. Here is your draft payload … → [Open the New Hire form] *(no submit; prefill deferred — Q29)*

**A5 — "Why didn't I get the email" (T0 + T1).**
> **Pamela (grp.forms.idsetup, grp.forms.safety):** I never got the Safety email for Ada
> `n8n_getWorkflow(wf)` (Pamela is a task assignee via group ✔) → step = *ID Setup Needed*; `n8n_listTasks({workflowId:wf, formType:"safety_onboarding"})` → 0.
> **Bot:** The Safety task doesn't exist yet. For Hourly hires without system access it's created at **ID Setup**; for everyone else **after HR Verification** — Ada is still at ID Setup. Nothing is lost; the email goes to `grp.forms.safety`, not to you personally. *(source: mapping/SAFETY.md §2)*

**A6 — Own-task close (T3, confirmed).**
> **Jayne (grp.forms.review306090):** close the 30/60/90 task for Ada, plan doc shared with the manager
> `n8n_listTasks({workflowId:wf, formType:"review_306090", status:"Open"})` → `TK-5A…`, `assignedTo = grp.forms.review306090` ∈ scope ✔ → `n8n_closeTask({taskId:"TK-5A…", notes:"Plan doc shared with manager (via Forms Help)", dryRun:true})` → card: *Will mark "Create 30/60/90 day review plan" and "Schedule review meetings with manager" Complete. Closed By: jaynepalmer@… Confirm?*
> **Jayne:** confirm → real call with `actor {id:"chat:google:jaynepalmer@…", email:"jaynepalmer@…", display:"Jayne Palmer (Forms Help)"}` → `ok:true`; `chat.action.result` logged.
> **Bot:** Closed `TK-5A…`. 30/60/90 is a blocking task — if it was the last one, Forms has emailed *Workflow Completed* to HR, requester and manager.

**A7 — Not-own-task close refused (T3 denial).**
> **Kelly:** close the HR verification for Ada, they're slow
> HR Verification is a **step**, not a task; and `grp.forms.hr` ∉ Kelly's scope.
> **Bot:** I can't do that — HR Verification is submitted by HR in the form. You *can* send the step reminder as the requester: **Bump** `NEW_EMP_…`? (Forms allows one reminder per period.) → on confirm `n8n_bumpWorkflow(wf)`; `E_RATE_LIMITED` → "a reminder was already sent recently".

**A8 — George, alias/error help (T0).**
> **George:** JR close returned E_NOT_FOUND for NEW_EMP_… but the hire exists
> **Bot:** `E_NOT_FOUND` from `n8n_closeJrTask` means no *open* `jr_title` task for that workflow. It's created at **IT Setup** and only when `plan306090 === 'Yes'` — check with `15_Forms_ListTasks` `{workflowId, formType:"jr_title"}`; if IT Setup hasn't happened, wait for the `submitITSetup` event. Already-closed comes back as `E_ALREADY_CLOSED` (treat as success). *(source: FOR_GEORGE §6, mapping/JR.md §5)*

## Appendix B — Alias → tool matrix

| Alias | Tier | Registered for | Scope filter applied to |
|---|---|---|---|
| `n8n_ping`, `n8n_info`, `n8n_contracts` | T0 | all sessions (session start / field validation) | — |
| `n8n_getWorkflow`, `n8n_getContext`, `n8n_getEmployeeId` | T1 | all | requester/manager/assignee/HR/IT/admin |
| `n8n_listTasks` | T1 | all | `assignedTo ∈ scope` |
| `n8n_listWorkflows` | T1 | all | rows whose context matches scope; site roll-ups admin/HR/IT only |
| `n8n_events` | T1 | admins/HR/IT | `workflowId` in visible set |
| `n8n_closeTask`, `n8n_saveTaskDraft` | T3 | task assignees (person or via group) | own tasks; `Assets` excluded |
| `n8n_bumpWorkflow` | T3 | requester/manager/HR/IT/admin | own workflows |
| `n8n_closeJrTask` | T3 | `grp.forms.jrtitle` only (George) | — (his flow already does it; likely unused) |
| all creates, step submits, approvals, `n8n_cancelWorkflow`, `n8n_updateHireDate`, `n8n_assignSafetyTraining` | — | **never registered** | — |
