# EFX Wiki — Employee Forms ↔ n8n

**EFX** is the integration layer that lets n8n (George's automation platform) drive the Employee Forms Apps Script app *through the same server functions a human uses*, instead of through email parsing, browser cookies or direct spreadsheet writes. It adds a small, stable alias layer (`N8n.js`) plus a declarative field registry (`FormContracts.js`) to the Forms project, and an actor identity (`Actor.js`) so every automated submit is attributable. n8n reaches those functions over the Apps Script **Execution API** using a Google service account, via a shared **Router** sub-workflow/node that reads a registry sheet of exposed projects. As a side effect of the same work, the **Internal Employee ID** is now minted at New Hire submission (not when a human opens ID Setup), and the Raw Log becomes an **event feed**. Everything in this fork is **TEST-only until promoted**; prod (`employee_forms_deployment`) is untouched.

> Status line: **TEST deployment pending; prod untouched.** Spec of record: `P:\Projects\Company\N8N\_agent-bundle\agent-2-full-bundle\agent-2-full-bundle\spec\` (read `00_README.md`, then `12_ROUTER_AS_N8N_NODE.md` — it supersedes the hosted-router parts of `03`/`11`).

---

## Start here, by audience

| You are… | Read |
|---|---|
| George (building n8n workflows) | [FOR_GEORGE.md](FOR_GEORGE.md) → [COOKBOOK_FOR_GEORGE.md](COOKBOOK_FOR_GEORGE.md) (recipes: JR close, Initial Request, onboarding, safety, 30/60/90, digests, termination, position change) → [FAQ.md](FAQ.md) |
| A developer changing Forms | [FOR_DEVELOPERS.md](FOR_DEVELOPERS.md) → [HOW_IT_WORKS.md](HOW_IT_WORKS.md) → `../../AGENTS.md` |
| An AI agent (Claude Code / Gemini) | `../../AGENTS.md` first, then `../../agent/efx-projects/SKILL.md`, then this wiki |
| On call / fixing something | [RUNBOOKS.md](RUNBOOKS.md) |
| Anyone wanting the mental model | [HOW_IT_WORKS.md](HOW_IT_WORKS.md) |

---

## Map of the fork (`employee_forms_efx/`)

| Path | What lives there | Owner / status |
|---|---|---|
| `AGENTS.md` | Rules for AI agents working in this fork (scope, safety, contract rule, tests) | this wiki set |
| `CLAUDE.md` | One-screen pointer to `AGENTS.md`, the spec, and the status line | this wiki set |
| `agent/efx-projects/SKILL.md` | Claude skill: answer "what can n8n call / what fields / draft the wrapper" from `n8n_contracts()` | this wiki set |
| `employee_management_v2_efx/` | The Apps Script project (fork of prod) with the EFX files added. `.clasp.json` scriptId is a placeholder — **never prod** | code |
| `employee_management_v2_efx/AGENTS.md` | Per-project rules: helper files, contract rule, additive-only, deprecation, version bumps | this wiki set |
| `employee_management_v2_efx/__tests__/` | Node mock harness: `super-test.js` (159), `form-field-map-test.js` (312), `efx-test.js` (68), `gas-runtime.js` — see `docs/TEST_RESULTS_LOCAL.md` | code |
| `docs/wiki/` | This wiki: `README`, `HOW_IT_WORKS`, `FOR_GEORGE`, `COOKBOOK_FOR_GEORGE`, `FOR_DEVELOPERS`, `FAQ`, `RUNBOOKS`, `ALIASES_ADDED_2026-09-17` | this wiki set |
| `docs/mapping/*.md` | Per-form field maps: HTML `name=` → handler key → sheet column → contract entry | *another agent, in progress* |
| `docs/plans/*` | Execution plans / sequencing (cutover, JR, Initial Request) | *another agent, in progress* |
| `n8n/*.json` | Router sub-workflow, wrapper sub-workflows, canary, event receiver — importable n8n JSON | *another agent, in progress* |
| `migration/*` | Sheet migration notes and dry-run/apply procedures (pairs with `MigrationTools.js` bottom section) | *another agent, in progress* |
| `router/` | Router node / sub-workflow design and (planned) `n8n-nodes-efx-appscript` package notes | *planned* |
| `tools/` | `gen-contracts.js` (→ `docs/N8N_CONTRACTS.md` + `contracts.lock.json`), `n8n-check.js` (change gate), `exec-api-call.js` (Execution API caller for T1) | code |

Anything marked *planned* does not exist yet; do not link to specific filenames inside those folders until they land.

---

## The EFX files in one glance

| File | Role | Documented in |
|---|---|---|
| `N8n.js` | The **alias layer** George calls: `n8n_*` functions, envelope, `N8N_API_VERSION` | FOR_GEORGE §2, FOR_DEVELOPERS §3 |
| `FormContracts.js` | Declarative **contracts**: per form, `fn`, `required[]`, `optional[]`, `types`, `enums`, `targetSheet`, `verified`, `hash`; `CALLABLE` allow-list | FOR_DEVELOPERS §3, §4 |
| `EfxApi.js` | Low-level primitives: `efxInfo`, `efxRunAs`, `efxReadRecord`, `efxTaskList`, `efxTaskClose`, `efxEventsSince`, `efxEmployeeIdGet/Allocate` | FOR_DEVELOPERS §3 |
| `Actor.js` | Request-scoped identity: `Actor.run(actor, fn)`, `Actor.email()`, `canOverrideEmployeeId()` | HOW_IT_WORKS §4 |
| `EmployeeIdRegistry.js` | Allocates the Internal Employee ID at submit; sheet `Employee IDs`; append-then-verify | HOW_IT_WORKS §5 |
| `RawLog.js` (v2) | Raw Log + `Event ID`/`Kind` columns, `rawLogResult()`, optional signed webhook fan-out | HOW_IT_WORKS §6 |
| Edits: `InitialRequestHandler.js`, `IDSetup.js`, `Config.js`, `Setup.js`, `SchemaConstants.js`, `Services/ConfigurationService.js`, `EmailUtils.js`, `MigrationTools.js` (bottom) | Wiring: mint at submit, use pre-assigned id, EFX flags/setters, `INTERNAL_EMP_ID: 55`, `migrateEfx*` | FOR_DEVELOPERS §3 |

---

## Glossary

| Term | Meaning here |
|---|---|
| **Workflow** | One request through Forms, identified by a workflow id: `NEW_EMP_…` (New Hire), `EQUIP_REQ_…`, `TERM_…`, `CHANGE_…`. Has a status, a current step, and a checklist. |
| **Step** | A gated stage inside a workflow with its own form and submit function, e.g. ID Setup → `submitEmployeeIDSetup`, HR Verification → `submitHRVerification`. |
| **Action item** (task) | A row in the `Action Items` sheet, id `TK-XXXXXXXX`, created by a step (mostly IT Setup) for a specialist group. Has `category`, `formType`, `assignedTo`, `status` Open/Closed, a checklist (`description` JSON), optional `formData`. |
| **formType** | The machine key of an action item: `jr_title`, `review_306090`, `safety_onboarding`, `safety_change`, `creditcard`, `businesscards`, `fleetio`, `jonas`, `wis`, `wis_user`, `it_setup`, `boss_wis_update`. Used to find "the JR task for this workflow". |
| **Contract** | The `FormContracts` entry for a form: which server function it calls, which fields are required/optional, types, enums, target sheet, and a `hash`. It is what n8n validates against and what `n8n_contracts()` returns. |
| **Alias** | An `n8n_*` function in `N8n.js`. Stable, documented, versioned by `N8N_API_VERSION`. Aliases never contain business logic; they validate, set the actor, and call the real handler. |
| **Actor** | `{ id, email, display }` describing who is acting. Humans get it from their Google session; n8n passes it explicitly (`id: 'n8n:<workflow-slug>'`, `email: 'efx-bot@team-group.com'`). Lands in `Submitted By`, `Closed By`, Raw Log `User`. |
| **Registry** | Two different registries: (1) **Employee ID registry** — sheet `Employee IDs`, allocator source of truth; (2) **EFX project registry** *(planned)* — sheet `EFX Registry (<tier>)` listing every Apps Script project n8n may call (`project · scriptId · apiDeploymentId · gcpProject · enabled · contractVersion · owner`). |
| **Tier** | dev / staging / prod. Each tier has its own Apps Script project, spreadsheet, GCP project (`efx-dev`, `efx-staging`, `efx-prod` — planned), n8n instance and registry sheet. This fork targets a new **TEST** script; prod is `employee_forms_deployment`. |
| **Execution API** | Google's `scripts.run` endpoint (`POST https://script.googleapis.com/v1/scripts/{scriptId}:run`). Calls a named top-level function with parameters. Requires an API-executable deployment and a caller whose OAuth client lives in the script's GCP project. |
| **DWD** | Domain-wide delegation. Lets a GCP service account impersonate a Workspace user (`efx-bot@`) so the Execution API call carries a real identity and Forms' `Session`/AdminDirectory checks work. |
| **efx-bot** | `efx-bot@team-group.com` *(planned, does not exist yet)* — bot account in `/Bot Accounts` that the SA impersonates; editor on the tier's spreadsheet; the `email` in every n8n actor. |
| **Raw Log event** | A row in the `Raw Log` sheet: `Timestamp · Source · Workflow ID · User · Raw JSON · Event ID · Kind`. `Kind` is `submit` (pre-mint payload, as before) or `result` (post-mint: workflow id, `internalEmployeeId`, etc.). `Event ID` (`EVT-yyyyMMddHHmmss-8HEX`) is the polling cursor for `n8n_events`. |
| **Router** | The one shared n8n sub-workflow (today) / community node (planned) that every feature workflow calls. It picks the project from the registry, validates against the contract, calls the Execution API, and normalises errors. |
| **Wrapper** | A saved n8n sub-workflow that pre-fills the Router for one alias (e.g. "Forms · Close JR Task"). George uses wrappers; he does not build envelopes. |
| **Contract drift** | The contract n8n cached (by `hash`/version) no longer matches what Forms exposes. Surfaces as `E_CONTRACT_DRIFT` in the Router (planned) or as `E_VALIDATION` "unknown field" from Forms. |
| **Idempotency** | Re-running the same call has no extra effect. Forms guards: `createWorkflow` 30 s same-type+initiator window; `E_ALREADY_CLOSED` on a closed task; `EmployeeIdRegistry.allocate` returns the existing id. Router adds an `idempotencyKey` cache (planned). |
| **@76** | The live prod anonymous `doPost` deployment George's JR closer calls today. Retired after EFX `n8n_closeJrTask` proves out with a one-week overlap. |

## End-user help (not for George or developers)
Plain-English pages for the people who fill the forms and work the tasks: `../help/README.md` (which form do I need), `STATUSES_AND_STEPS.md`, one page per form, `TROUBLESHOOTING.md`, `GLOSSARY.md`. Written 2026-09-16 as Phase 0 of the help chatbot (`../plans/CHATBOT_FORMS_HELP_SPEC.md`).
