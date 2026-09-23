# Skill eval — `efx-new-form-review` — task: "n8n sets Preferred Name after submission"

Worked entirely in `%TEMP%\efx-eval-newform` (robocopy of the fork at 23:14:43, `.git`/`node_modules` excluded). No clasp/gcloud/aws/n8n,
no `context/`, no `D:\Credentials`, no git commits, nothing written to the real fork. Stopped before any deployment.

Companion file: `changes.diff` (unified, `a/` = copy-time baseline, `b/` = my copy; restricted to the 17 files I changed; test-logs excluded).

---

## 1. What I built

**Approach: a named non-form alias, not `n8n_submitForm`.**

| Layer | Change |
|---|---|
| Handler | `updatePreferredName(workflowId, preferredName)` in `employee_management_v2_efx/RequestActionsHandler.js`, next to `updateHireDate` — the file that already owns post-submit edits. Auth by **real principal** (`Actor.principal()` → HR/IT/Admin via `AccessControlService.getUserRolePayload`), finds the `Initial Requests` row and the `Preferred Name` column **by header** (like `updateHireDate`), writes that one cell, then `logFormEdit(…, 'Initial Request', Actor.email(), old, new)` (the trail HR Verification / IT Setup edits already use), `writeAuditLog(principal, 'UPDATE_PREFERRED_NAME', …, '"old" → "new" (by <actor>)')`, and a Raw Log event `kind=request.updated` / `source=updatePreferredName` / `{field, previous, value}`. Rejects: empty, leading `= + - @` (the `validateRequiredFields` formula rule), > 100 chars, workflows whose `Workflows.Status` is `Cancelled`, ids with no Initial Requests row (TERM_/CHANGE_). **Idempotent**: same value → `{ success:true, changed:false }`, no writes. No emails, no step change, no `syncWorkflowState` (Dashboard_View has no Preferred Name column). |
| Alias | `n8n_updatePreferredName(actor, workflowId, preferredName)` in `N8n.js`, template `n8n_updateHireDate`/`n8n_cancelWorkflow`: `n8nGuard_` → argument checks (`E_VALIDATION` with `fields[]`) → `Actor.run(n8nActor_(actor), …)` → `n8nMapHandlerError_(r, 'E_UPSTREAM', { codes:['E_NOT_FOUND'] })` → `n8nOk_(r)`. New `N8N_ALIASES` row (`kind:'update'`, no `form`). No new `E_*` code needed. |
| Contracts | `FormContracts.js`: `updatePreferredName` added to `CALLABLE` (efxRunAs allow-list, like `cancelRequest`/`updateHireDate`); `VERSION` `2026.09.16-r2` → `2026.09.17-r3`. **No form entry changed** — all 11 forms' `fn/required/optional/verified/createsWorkflow` are identical to the old lock (checked programmatically). |
| Version | `N8N_API_VERSION` **unchanged** (`2026.09.17-1`) — purely additive. `FormContracts.VERSION` bumped because all three rule documents (root `AGENTS.md` §2, project `AGENTS.md` §2/§4, `FOR_DEVELOPERS.md` §4.6) say to bump on *any* change incl. additive alias additions. Trade-off in §4. |
| Tests | `efx-test.js`: alias count 27→28; new scenario **PREFERRED NAME** (66 assertions): validation writes nothing (missing/blank/formula/too-long/unknown/TERM_), happy path (trimmed value, col 14 only, other 55 columns untouched, `getWorkflowContext` + `getIDSetupRequestData` see it, no emails, step unchanged), Form Edit Log row (`Initial Request`, Changed By = actor, `col14: [] → [Caz]` only), Audit Log row (User = principal, detail names actor), `request.updated` event, idempotent second call (no new rows/events), replace carries `previousPreferredName`, human direct call, **session-spoof** (admin actor + random principal → `E_FORBIDDEN`, value unchanged), Cancelled workflow frozen → `E_UPSTREAM`, surface checks. `efx-e2e-test.js` 9b: chain view incl. `n8n_getWorkflow requestData["Preferred Name"]` (needs the TextFinder mock only e2e patches), `getContext`, Dashboard untouched, Form Edit Log, event; §9 principal-nobody line. |
| Docs | `node tools/gen-contracts.js` → `docs/N8N_CONTRACTS.md` (28 aliases); **hand-edited the Signatures block in `tools/gen-contracts.js`** (not generated); `docs/mapping/INITIAL_REQUEST.md` row 13 note + new §9 "Post-submit edits"; `docs/wiki/FOR_GEORGE.md` §2 paragraph + `kinds` list; `COOKBOOK_FOR_GEORGE.md` R8 sub-table + example; `ALIASES_ADDED_2026-09-17.md` r3 section; `FOR_DEVELOPERS.md` counts; `n8n/README.md` (count, file table, alias table); `employee_management_v2_efx/docs/CHANGELOG.md` Unreleased; `AuditLog.js` header comment. |
| n8n | `n8n/29_Forms_UpdatePreferredName.json` — cloned from `14_Forms_GetWorkflow.json` (not `16_Forms_CloseTask.json` as the skill says; 14 is the minimal 2-arg shape). Inputs `workflowId, preferredName, actor, idempotencyKey`; Code node validates and builds `fn/args`; sticky note lists inputs, result, side effects, errors. `27_Forms_WorkflowActions.json` deliberately untouched (George may have imported it; a new file cannot break it). |
| Lock | `node tools/n8n-check.js --update` accepted `api 2026.09.17-1 / contracts 2026.09.17-r3`, aliases 27→28. |

### Why not generic `n8n_submitForm`
`n8n_submitForm` needs a `FormContracts` *form* entry whose `fn` takes `(formData)`, appears in `n8n_contracts().forms[]` with
`kind/targetSheet/verified`, and is diffed by `n8n-check` as a form. A one-column post-submit edit is not a form: no HTML, no
`format*Data`, no step transition. A pseudo-form `new_hire_edit` would (a) need `verified:true` with no HTML to verify against
(forbidden by the skill/AGENTS), (b) pollute the forms list George reads, (c) not fit the `createsWorkflow` true/false dichotomy
`n8nSubmit_` enforces. The project already has the precedent — `updateHireDate` + `n8n_updateHireDate` — so I mirrored it; this
is also what the skill prescribes for "non-form functions" (`Actor.run` pattern, `n8n_cancelWorkflow` template).

---

## 2. Proof it is safe

### Suites (from `employee_management_v2_efx/`) — baseline → after

| Suite | Baseline (AGENTS.md 2026-09-16 night; re-run on the untouched copy, identical) | After | Δ |
|---|---|---|---|
| `super-test.js` | 159 / 0 | **159 / 0** (12 scenarios) | 0 — untouched handlers |
| `efx-test.js` | 190 / 0 | **256 / 0** | +66 (new scenario) |
| `form-field-map-test.js` | 312 / 0 | **312 / 0** | 0 — no HTML/handler-key/column change |
| `migration-test.js` | 42 / 0 | **42 / 0** | 0 |
| `efx-e2e-test.js` | 580 + 3 recorded defects | **589 + 3 recorded defects** (the same 3) | +9 |

### Gates (from the fork root)

```
$ node tools/gen-contracts.js
wrote docs\N8N_CONTRACTS.md (11 forms, 28 aliases) (lock unchanged — use tools/n8n-check.js --update to accept)

$ node tools/n8n-check.js                      # before accepting
  note  alias added: n8n_updatePreferredName (additive)
  note  new_hire: contract hash changed (types/enums) — review      <- x11, one per form (VERSION is in the hash)
OK: contracts compatible with docs/contracts.lock.json             exit 0

$ node tools/n8n-check.js --update
updated docs/contracts.lock.json @ api 2026.09.17-1 / contracts 2026.09.17-r3   exit 0

$ node tools/n8n-check.js                      # after accepting
OK: contracts compatible with docs/contracts.lock.json             exit 0

$ node tools/n8n-workflows-check.js
  29_Forms_UpdatePreferredName.json   5 nodes  1 fn  0 errors  0 warnings
OK: 26 workflow file(s) lint clean (0 warning(s))                  exit 0
```

Lock delta, checked programmatically: `apiVersion` unchanged; `contractsVersion` r2→r3; aliases 27→28 (`+n8n_updatePreferredName`);
**11/11 forms identical in `fn/required/optional/verified/createsWorkflow`** — each `hash` moved only because `FormContracts.VERSION`
is an input to `hash_({r,o,t,v:VERSION})`. The 11 "contract hash changed (types/enums)" notes are false alarms caused by the bump the
rules require (see §4).

### Non-regression argument for George
- No existing alias, parameter, envelope key, error code, `N8N_ERROR_CODES` row or form field was renamed, removed or made required.
- `27_Forms_WorkflowActions.json` and every other wrapper are byte-identical; lint 26/26 clean.
- `efx-test.js` R6 ("every `E_*` literal is documented") still passes — only `E_VALIDATION`/`E_NOT_FOUND`/`E_UPSTREAM`/`E_FORBIDDEN` reused.
- The Canary alerts on `apiVersion` change only — unchanged, so silent.
- Authorization by real session (`E_FORBIDDEN` + `error.principal` on spoof), attribution by actor — same model as the other aliases.

---

## 3. Could not verify / relied on
- Mock-only: `SpreadsheetApp.flush`, `getRange().setValue`; `TextFinder` is patched only in e2e, so the `n8n_getWorkflow` round-trip
  is asserted there, not in `efx-test.js`.
- Live: efx-bot's HR/IT/Admin membership on the TEST tier — until it exists the alias returns `E_FORBIDDEN` (same as
  `n8n_updateHireDate`). Not deployed; no `efxSelfTest()` / live `n8n_contracts()`.
- Caveat documented in mapping §9: an n8n `it_confirmation` submit with a stale/blank `preferredName` would overwrite an HR edit
  (`ITConfirmationHandler.js:76` writes it back). The UI path is safe (prefills from the sheet).

### Concurrency note (read before applying `changes.diff`)
While I worked, **another session was editing and committing the real fork** (`AGENTS.md`, `README.md`, `EfxApi.js`, `N8nEnvelope.js`,
three other `SKILL.md`s, briefs, `HOW_IT_WORKS.md`, plus `efx-test.js`, `COOKBOOK`, `FOR_DEVELOPERS`, `FOR_GEORGE` — mtimes after
23:14:43; `git status` flipped dirty→clean between two read-only checks). I never touched the fork. A whole-tree diff showed their
changes reversed, so `changes.diff` is restricted to my 17 files; for the 4 that also moved in the fork after my copy the baseline is
my copy with my exact edits mechanically reverted (`build-baseline.js`, marker-checked). `efx-new-form-review/SKILL.md` did **not**
change during the run. **Applying my diff needs a 3-way merge on `efx-test.js`, `COOKBOOK_FOR_GEORGE.md`, `FOR_DEVELOPERS.md`,
`FOR_GEORGE.md`.**

---

## 4. Critique of `agent/efx-new-form-review/SKILL.md`

**Wrong / stale**
1. **Version-bump guidance contradicts the repo.** SKILL: "Additions are free", bump only when breaking. Root `AGENTS.md`, project
   `AGENTS.md` §2/§4 and `FOR_DEVELOPERS.md` §4.6: bump `FormContracts.VERSION` on *any* change, additive included. I followed the
   three docs. State the rule once ("additive alias → bump `FormContracts.VERSION` only, then `--update`; API version untouched") and
   warn that the bump moves every form's `hash`.
2. **`n8n-check` narrative is incomplete.** Omits: an additive alias leaves a perpetual `note alias added` until `--update`; a
   `FormContracts.VERSION` bump prints 11× "contract hash changed (types/enums) — review" (misleading — it's VERSION in the hash);
   `gen-contracts.js` never rewrites the lock (only `--lock`/missing lock) and `n8n-check.js --update` is the only sanctioned writer;
   exit codes 0/1/2. Worked out by reading both tools.
3. **Wrapper template**: "copy `16_Forms_CloseTask.json`" — for a 2-positional-arg alias `14_Forms_GetWorkflow.json` is the right
   minimal shape (16 carries `treatAlreadyClosedAsSuccess`/closer semantics). The "sticky note listing required/optional fields"
   advice assumes a form; for non-form aliases say "inputs, result, side effects, error codes".
4. **cwd**: suites run from `employee_management_v2_efx/`, gates from the fork root. Say so.
5. **The non-form procedure is one sentence** buried inside the *form* alias step, and it omits: add the Forms function to `CALLABLE`;
   opt into `E_NOT_FOUND`/`E_RATE_LIMITED` via `n8nMapHandlerError_(…, { codes:[…] })` ("map handler messages to `E_*` codes" reads
   as if you write the mapping yourself); which handler *messages* the rules regex on (`/permission denied|access denied|…/` →
   `E_FORBIDDEN`, `/not found/`, `/already sent/`). This task was 100% the non-form case.

**Missing entirely (had to discover)**
6. **Where things live after the `N8n.js`/`N8nEnvelope.js` split** beyond the one sentence: `N8N_ERROR_CODES` and `N8N_ALIASES` stay in
   `N8n.js`; `tools/n8n-workflows-check.js` regex-parses `N8n.js` for `^function n8n_*` and `var N8N_ALIASES = [` (formatting
   matters; every `n8n_*` function must have an `N8N_ALIASES` row or lint errors); positional arity comes from the signature.
7. **`tools/gen-contracts.js` has a hand-written Signatures block** that is not generated from `N8N_ALIASES` — new alias = edit that
   template string or the doc silently omits the signature. (And editing it is fiddly: it is a JS template literal with `\n` escapes;
   I lost a space there once and only the diff caught it.)
8. **How to write a test with `efx-fixtures.js`**: `seedBase(rt)`; `rows(name)` via `_rt.captures.getSheet(name)._rows`;
   `_rt.captures.getEmailOptions()` for "no emails"; `vm.runInContext('SCHEMA.…', _ctx)` for column indexes; the `Session` swap idiom
   for principal tests; `ACTOR`/`ADMIN` fixtures; `scenario()` + `eq/truthy/contains`; hard-coded counts (`info lists 27 aliases`)
   that must be bumped; and **the bare mock has no `TextFinder`** (so `getRequestDetails`/`n8n_getWorkflow` return `E_NOT_FOUND` in
   `efx-test.js` but work in `efx-e2e-test.js`, which patches it). Cost one red run.
9. **Which sheets the mock seeds** (`Form Edit Log`, `Audit Log` — so `logFormEdit`/`writeAuditLog` are assertable) and header shapes.
10. **Docs fan-out is incomplete**: also `n8n/README.md` (count + two tables), `COOKBOOK_FOR_GEORGE.md`, `ALIASES_ADDED_*.md`
    (FOR_GEORGE points to it as "what changed"), `FOR_DEVELOPERS.md` counts, `employee_management_v2_efx/docs/CHANGELOG.md`, and
    the hard-coded "27 aliases" strings (grep for them).
11. **Raw Log events for non-form changes**: `rawLogEvent_(kind, source, wf, payload)` is private but is exactly how `task.created` is
    emitted from `ActionItemService`; say "emit `<noun>.updated` for post-submit edits" and add the kind to FOR_GEORGE's `kinds` list.
12. **Idempotency / Cancelled-workflow expectations for update aliases** — only `createWorkflow`/`efxTaskClose` are covered; I inferred
    "same value → `changed:false`, refuse Cancelled" from `efxTaskClose`.
13. **Return shapes**: `getRequestDetails().requestData` is header-keyed (`'Preferred Name'`), `getWorkflowContext` is camelCase — a
    one-line table would have saved a failing assertion.
14. **Concurrency**: `CLAUDE.md` warns other agents write `docs/mapping`, `docs/plans`, `n8n/`, `migration/`; the skill should say
    to snapshot/diff carefully and expect 3-way merges (it bit this run).

**What was right and useful**: the trace order (HTML → payload → handler → sheet), principal-vs-actor warning, the formula-char rule,
"never expose `it_confirmation`/`specialist`", the five-suite + two-gate checklist, and the deprecation policy.
