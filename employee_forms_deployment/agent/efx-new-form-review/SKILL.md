---
name: efx-new-form-review
description: >
  Add, change, expose or review an Employee Forms form, field, or server function so n8n can use it through
  EFX without breaking George's workflows: trace HTML name= → client payload → handler → sheet column, write
  or update the FormContracts entry, add an n8n_* alias (form-based or a post-submit update), tests, docs, and
  pass tools/n8n-check.js and the n8n workflow lint. Use whenever a form or field is added / renamed / removed,
  a submit* / close* / update* / get* function changes, someone asks to 'expose X to n8n', 'let George set Y
  after submission', 'add a field', 'new form', 'can n8n call this', or a contract-drift error appears —
  even for small field tweaks.
---

# EFX — new form / field / function review

Fork: `P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_efx\` (Apps Script project `employee_management_v2_efx\`). Never
edit the live prod folder. No UI/layout changes (backend only). A complete worked example — a post-submit update alias with handler,
contract, tests, wrapper and docs — is `docs/review/EXAMPLE_ADD_ALIAS_updatePreferredName.diff` (+ `_REPORT.md`); read it once.

## 0. Where things live after the 2026-09-16 split (get this right first)
| Thing | File |
|---|---|
| Public aliases `n8n_*`, `N8N_ALIASES` (name/kind/desc/form), `N8N_API_VERSION`, `N8N_ERROR_CODES` | `N8n.js` — the tools regex-parse **this file only** |
| Envelope plumbing: `n8nSubmit_`, `n8nActor_`, `n8nOk_/n8nErr_`, `n8nGuard_` (+ requestId audit), `n8nBool_`, `n8nParse_`, `n8nOptions_`, `n8nMapHandlerError_` | `N8nEnvelope.js` |
| Redaction (`efxRedact_`, `EFX_SECRET_KEY_RE`), `efxJsonSafe`, `efxSign_` | `EfxUtil.js` |
| Contracts, `CALLABLE` allow-list, `validate()`, `VERSION` | `FormContracts.js` |
| Task/list/events/record read-write primitives | `EfxApi.js` |
| Shared test fixtures (`LOAD_ORDER`, headers, `seedBase(rt)`) | `__tests__/efx-fixtures.js` |
| Generated docs + lock | `tools/gen-contracts.js` → `docs/N8N_CONTRACTS.md`; `tools/n8n-check.js --update` → `docs/contracts.lock.json` (gen-contracts never writes the lock) |
| n8n side | `n8n/<NN>_Forms_<Name>.json` + `n8n/README.md` (three places: file table, alias table, import order); `tools/n8n-workflows-check.js` |

Commands: suites run from `employee_management_v2_efx/__tests__`; gates (`gen-contracts`, `n8n-check`, `n8n-workflows-check`) from the fork root.

## 1. The versioning rule (matches `AGENTS.md`)
- **Any** contract or callable change (new field, new alias, new `CALLABLE` entry, notes) → bump `FormContracts.VERSION` (`YYYY.MM.DD-rN`).
  Because VERSION is inside every form hash, `n8n-check` then prints eleven "hash changed (types/enums)" notes — expected; run
  `node tools/n8n-check.js --update` once to re-baseline. Until you do, it keeps printing "alias added (additive)".
- **Breaking** (alias/form/field removed, handler renamed, new *required* field, return shape changed) → also bump `N8N_API_VERSION`
  (`N8n.js`), keep the old name as a forwarding alias for one release (`deprecated`, `replacedBy` in `N8N_ALIASES`), `--update`, announce.
- Additive never breaks George; do not bump `N8N_API_VERSION` for additions.

## 2. Procedure A — adding or changing a **form field / form** (contract-driven, goes through `n8nSubmit_`)
1. **Trace the real path** (quote file:line): HTML `grep -o 'name="[^"]*"' <Form>.html` + the submit script (key renames, arrays vs CSV,
   hidden-section clearing) → handler `submit<X>(formData)` (`validateRequiredFields`, every `formData.<key>`, role check → **principal**,
   sheet target, `updateWorkflow` step, `sendFormEmail` subjects, `createActionItem` category/formType/assignee/condition) → `SchemaConstants.js` + header row.
2. **Contract** in `FormContracts.js`: `form, kind, prefix?, createsWorkflow, verified, fn, targetSheet, required[], optional[], types{}, enums{}, dynamicPrefixes?, notes`.
   `verified:true` only when every link is confirmed against the HTML (`form-field-map-test.js` is the proof).
3. **Alias** in `N8n.js`: `function n8n_<verb><Form>(actor, data, options) { return n8nSubmit_(actor, '<form>', n8nParse_(data, {}), createsWorkflow, options); }`
   + a row in `N8N_ALIASES` (`kind`: create|update; `form`). Every `n8n_*` function needs its row — the lint checks arity against the signature.
4. **Tests** in `__tests__/efx-test.js` (uses `efx-fixtures.js`: `seedBase(rt)`, `rows(sheet)`, `_rt.captures.getEmailOptions()`, swap `_ctx.Session` to test roles): UI-shaped payload → `ok`, sheet row, step, emails captured (subjects), events, validation failure writes nothing, idempotency. Note the **bare mock has no `TextFinder`**: `n8n_getWorkflow` works only where the e2e suite seeds it — assert via sheets/`n8n_listTasks` instead.
5. **Docs**: `node tools/gen-contracts.js`; `docs/mapping/<FORM>.md`; George-facing line in `docs/wiki/FOR_GEORGE.md` + cookbook recipe if it is something he will call; `docs/wiki/ALIASES_ADDED_<date>.md`; update the "27 aliases" count strings (`grep -rn "27 aliases\|27 \`n8n_" docs README.md agent`).
6. **Gate**: `node tools/n8n-check.js` → additive notes → `--update` after the VERSION bump. Then the suites (see `efx-check-test-validate`).
7. **n8n wrapper**: copy the closest wrapper by arity (`14_Forms_GetWorkflow.json` for 2-arg aliases, `10_…` for form payloads, `16_…` for closers), rename nodes/sticky, list required/optional fields; add it to all three places in `n8n/README.md`; `node tools/n8n-workflows-check.js` must be clean.

## 3. Procedure B — exposing a **non-form server function** (post-submit update, action, lookup)
Template pair: `updateHireDate()` in `RequestActionsHandler.js` ↔ `n8n_updateHireDate` in `N8n.js`; the worked example above adds `updatePreferredName` the same way.
1. **Handler** (backend only): role check by **principal** (`Actor.principal()` via `AccessControlService`); header-keyed column lookup (never a hard index for a new column); validate (empty, leading `= + - @`, length, Cancelled workflow → reject, wrong id prefix → reject); **idempotent** (`changed:false`, no writes when equal); write `Form Edit Log` + `Audit Log <ACTION>` + `rawLogEvent_('<noun>.updated', …)`; return `{ success, message, changed }`. No emails, no step change unless the mapping doc says so.
2. **Allow-list**: add the handler to `CALLABLE` in `FormContracts.js` (this is what lets `efxRunAs` and the tests reach it) and bump `FormContracts.VERSION`.
3. **Alias**: `function n8n_<verb><Noun>(actor, workflowId, value) { return n8nGuard_(function () { var r = Actor.run(n8nActor_(actor), function () { return <handler>(workflowId, value); }); if (!r || r.success === false) return n8nMapHandlerError_(r, 'E_UPSTREAM', { codes: ['E_NOT_FOUND'] }); return n8nOk_(r); }); }`
   `n8nMapHandlerError_` maps `Permission denied.` / `Access denied.` → `E_FORBIDDEN` (+`principal`) everywhere; `not found` → `E_NOT_FOUND` and `already sent` → `E_RATE_LIMITED` **only** when you opt in via `codes`. A new `E_*` code must be added to `N8N_ERROR_CODES` (efx-test fails on undocumented codes; the docs tables are generated from it).
   Add the `N8N_ALIASES` row (`kind: 'update'`, no `form`), and the hand-written **Signatures** block in `tools/gen-contracts.js`.
4. **Tests**: happy path, idempotent second call, `E_FORBIDDEN` under a non-privileged `Session` swap, Cancelled workflow rejected, bad value rejected with nothing written, Raw Log event present; e2e scenario if it touches a chain.
5. **Docs + wrapper + gates** as in Procedure A steps 5–7 (`27_Forms_WorkflowActions.json` is for cancel/bump/hireDate only — give a new action its own wrapper).

## 4. Changing an existing function
Keep the old name working for one release; a changed return shape is breaking (`responseFields`); a changed step behaviour (new email, new task) is allowed but goes in the mapping doc and changelog — event-keyed n8n flows see new `task.created` events automatically.

## 5. Things that bite
- `validateRequiredFields` rejects any string starting with `= + - @` (defect #13) — mention it in the contract `notes`.
- Authorization = `Actor.principal()` (real session, i.e. `efx-bot` under the Execution API); `actor.email` is attribution only. Tests must swap `_ctx.Session`, not the actor.
- Arrays vs CSV: New Hire posts arrays; termination comma-joined strings; position change arrays for checkbox groups. `requestData` from the sheet is header-keyed; `getWorkflowContext()` is camelCase.
- `createWorkflow` dedupe: 30 s on (type, requester, **employee|hireDate**) for New Hire; (type, requester) for the others.
- `efxRedact_` keys: any new credential-like field name must match `EFX_SECRET_KEY_RE` or it will leak through `record`/`events`/`getContext`.
- Never expose `it_confirmation` or `specialist` as verified until prod defects #1/#10 are fixed.
- **Concurrency**: other agents may be editing the fork; before applying a prepared diff run `git status`, and 3-way merge `efx-test.js`, `FOR_GEORGE.md`, `FOR_DEVELOPERS.md`, `COOKBOOK_FOR_GEORGE.md` rather than overwriting.

## 6. Done means
Five suites green (numbers up, never down) · `n8n-check` OK after `--update` · `n8n-workflows-check` clean · `docs/N8N_CONTRACTS.md` regenerated · mapping doc + George-facing line written · wrapper in `n8n/` with README rows · no HTML diff · nothing deployed.
