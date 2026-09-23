# EFX code review — pass 3: verification of the 238dd4c refactor

Read-only verification of commit `238dd4c` ("safe-tier refactor", 2026-09-16 23:01) against its parent range `8ab3a29..238dd4c`,
checked on the working tree at `d6929ab` (the only commits after `238dd4c` are docs/skill files — `git diff 238dd4c..HEAD --stat`
touches nothing under `employee_management_v2_efx/`). Method: mechanical function-body diff (whitespace-normalised) of every top-level
function in `N8n.js` / `RawLog.js` / `EfxApi.js` at `8ab3a29` against `N8n.js` / `N8nEnvelope.js` / `RawLog.js` / `EfxApi.js` /
`EfxUtil.js` now; line-by-line reading of every function the diff marked as changed; column-0 and IIFE-level scan of every `.js` in the
fork for load-time evaluation; regex classification of every `success:false` message the reachable handlers emit under the old per-alias
regexes vs. the new rule table; regeneration of the prod-vs-fork patch; one run of the five suites and both gates.

No `clasp`/`gcloud`/`aws`/n8n calls were made. Nothing under `D:\Credentials` or any `context/` folder was read.

---

## 1. Verdict

**Safe to deploy to TEST tomorrow as-is: YES.**

- Every moved function is byte-identical modulo whitespace (7 of 7): `n8nActor_`, `n8nOk_`, `n8nErr_`, `n8nGuard_` → `N8nEnvelope.js`;
  `efxRedact_` (+ `EFX_SECRET_KEY_RE`), `efxSign_`, `efxJsonSafe` → `EfxUtil.js`.
- Every changed function is changed only at the call sites the refactor log (`CODE_REVIEW_EFX_PASS2.md` §8) says it changed, and the
  only behaviour changes are the three Lows (L1 Cancelled → `E_TASK_NOT_OPEN`, L2 string booleans, L3 `efxRunAs` redaction) plus two
  documented convergences (R2 empty-string payload → fallback; R3 legacy draft lift in `n8n_saveTaskDraft`).
- Nothing in `EfxUtil.js` or `N8nEnvelope.js` is evaluated at load time except regex/array literals; file order cannot break them.
- No handler message that exists as a literal in the code changes error code under `n8nMapHandlerError_`. The only widening is for
  free-text exception messages (finding F1 below) — Low, not a blocker.
- Suites: **159 / 312 / 190 / 42 / 580 + 3 recorded defects**; `n8n-check` **OK**; `n8n-workflows-check` **OK, 1 pre-existing warning**.
- `DIFF_prod_vs_efx.patch` regenerated from the current prod folder is **hunk-for-hunk identical** to the committed one; 28 files; no `.html`.

Findings are all Low or Informational. None needs to be fixed before the TEST deploy; F1 and F2 are worth a follow-up commit.

---

## 2. Findings (ranked)

| # | Sev | Where | What | Minimal fix |
|---|---|---|---|---|
| F1 | Low | `N8nEnvelope.js:70` (`N8N_HANDLER_ERROR_RULES`), used by `n8nSubmit_` `:107`, `n8n_cancelWorkflow` `N8n.js:159`, `n8n_bumpWorkflow` `:167`, `n8n_updateHireDate` `:175` | The forbidden rule is the **union** `/permission\|access denied\|not authori[sz]ed\|forbidden/i`. Old code was `/access denied\|permission denied\|not authori[sz]ed\|forbidden/i` on the submit path (`8ab3a29:N8n.js:104`) and `/[Pp]ermission/` on the three action aliases (`:205,:213,:221`). For every **literal** handler message the code is identical (table in §5). For **dynamic** `e.message` text it widens: on the submit path any message containing "permission" (e.g. Google's `You do not have permission to access the requested document`, `The caller does not have permission`) is now `E_FORBIDDEN` + `principal` instead of `E_UPSTREAM`; on the action aliases "access denied"/"not authorized"/"forbidden" are now `E_FORBIDDEN` instead of `E_UPSTREAM`. n8n then stops retrying and the docs say "lacks the role", which a Drive/Sheets ACL error is not. The refactor log's claim "identical codes for every message the handlers emit" is true for literals only. | Either accept (arguably better: a Drive ACL failure *is* a permission problem) and add one sentence to the `E_FORBIDDEN` row of `N8N_ERROR_CODES`, or restore exactness with `re: /permission denied\|access denied\|not authori[sz]ed\|forbidden/i` (loses nothing: every literal permission message says "Permission denied"). |
| F2 | Low | `EfxApi.js:34,55,270`, `N8n.js:209` (guarded) vs `EfxApi.js:40`, `N8n.js:210`, `RawLog.js:58,62` (unguarded) | The `typeof efxRedact_ === 'function'` guards were written when `efxRedact_` lived in `RawLog.js` and `EfxApi.js` might be pushed without it. After the move all four helpers are in `EfxUtil.js`, which `.claspignore` (only `docs/**`, `__tests__/**`) does **not** exclude, so the guards only matter for a partial push — and in that case `efxRowToRecord_` (`:40`, `efxJsonSafe`), `n8n_getContext` (`:210`) and `rawLogFanOut_` (`:58,:62`) throw anyway (the latter inside its own try/catch, so fan-out would be silently disabled with only a `Logger.log`). The guards are now inconsistent and give false comfort; a partial push would degrade redaction on one path (`efxRunAs` returns `out` unredacted) rather than fail loudly. | Remove the four `typeof` guards and call `efxRedact_` directly (a missing `EfxUtil.js` then fails closed with a `ReferenceError` instead of leaking). Or keep them and add a `super-test` assertion that `EfxUtil.js` is in every `LOAD_ORDER` (already true: `efx-fixtures.js:15`, `super-test.js:36`, `form-field-map-test.js:36`, `migration-test.js:15`). |
| F3 | Low (pre-existing) | `N8n.js:127,131,135,140,143` | `n8nParse_(data, {})` runs **as an argument** to `n8nSubmit_`, i.e. before `n8nGuard_` is entered. Malformed JSON therefore still escapes as a raw `SyntaxError` to the Execution API (Router `E_SCRIPT`), not `E_VALIDATION`/`E_INTERNAL`. Unchanged from `8ab3a29` (the old inline `JSON.parse` was in the same position) and the envelope doc-comment says so deliberately, but it is the one place a caller mistake does not get a `requestId`. | Move the parse inside the guard: `return n8nGuard_(function () { return n8nSubmit_(actor, 'new_hire', n8nParse_(data, {}), true, include \|\| []); });` — or have `n8nSubmit_` accept the raw value and call `n8nParse_` itself. Contract-neutral. |
| F4 | Low (pre-existing) | `EfxApi.js:31-34` | L3 redaction runs `efxRedact_(efxJsonSafe(out))`. Correct for object returns; a **string** return passes through untouched. `getDashboardData` (`FormContracts.js:241`, allow-listed) returns `JSON.stringify(...)` (`DashboardDataHandler.js:202`), so its body is never inspected. Dashboard_View carries no credential columns today, so no leak — but the L3 guarantee is "objects only". | Note it in the `efxRunAs` comment, or `try { out = JSON.parse(out) } catch (e) {}` when `typeof out === 'string' && out[0] === '{'` before redacting. |
| F5 | Low (pre-existing, noted in §8) | `N8n.js:209-210` | `n8n_getContext` redacts **before** `efxJsonSafe`; `efxRedact_` flattens a `Date` to `{}` (`EfxUtil.js:20-26` treats it as a plain object). Harmless while `getWorkflowContext` formats dates as strings. `efxRunAs` and `efxRowToRecord_` already do it in the right order. | Swap: `return n8nOk_(efxRedact_(efxJsonSafe(ctx)));`. |
| F6 | Info (intended) | `N8n.js:189`, `EfxApi.js:95-106` | R3: `n8n_saveTaskDraft` now lifts legacy `{checkedItems:[…]}` and flat-map drafts into `items` instead of discarding them. This is a behaviour change beyond the "three Lows" (the log says so). It is the same lift `efxTaskClose` already applied, so the two paths are now consistent. Side effect: a flat map with non-item keys (e.g. a stray `{notes:'…'}`) would be lifted as items — same as the close path since review F-series. | None required. If it matters, restrict the flat-map branch to values that are objects with a `status` key. |
| F7 | Info (benign) | `EfxApi.js:38-42` vs `8ab3a29:EfxApi.js` `efxReadRecord` | `efxRowToRecord_` uses `efxJsonSafe`, which maps an **invalid** `Date` to `''`; the old inline `toISOString()` would have thrown `RangeError` (→ `recordWarning` on the include path). Strictly an improvement; sheet cells are never nested objects so the deep walk changes nothing else. | None. |
| F8 | Info | `n8nSubmit_` `N8nEnvelope.js:107` vs `8ab3a29:N8n.js:105` | Old code set `principal: undefined` on non-forbidden errors; new code omits the key. Identical after JSON serialisation (Execution API drops `undefined`). Only visible to Node tests doing `'principal' in error`. | None. |
| F9 | Info (process) | `__tests__/efx-e2e-test.js` | The e2e suite writes `docs/test-logs/efx-e2e-<stamp>.md` on every run. This review's run left `docs/test-logs/efx-e2e-20260916-2307.md` **untracked** in the fork (not committed, not deleted — the brief said write exactly one file). Previous logs are committed, so this is the suite's design, but it means "run the suites" is never side-effect-free. | Delete or commit that file; consider `EFX_E2E_LOG=0` to suppress in CI/review runs. |

Nothing above changes the verdict. F1 is the only item where the refactor log's wording ("no message changes code") is stronger than
what the code guarantees.

---

## 3. Per-item verification

### 3.1 Moved functions — body diff (whitespace-normalised)

| Function | From (8ab3a29) | To (now) | Result |
|---|---|---|---|
| `n8nActor_` | `N8n.js` | `N8nEnvelope.js:18-23` | identical — the string special-case (`JSON.parse` → fallback `{ id: String(actor) }`) survived |
| `n8nOk_` | `N8n.js` | `N8nEnvelope.js:24-28` | identical |
| `n8nErr_` | `N8n.js` | `N8nEnvelope.js:29-33` | identical |
| `n8nGuard_` | `N8n.js` | `N8nEnvelope.js:34-36` | identical |
| `EFX_SECRET_KEY_RE` + `efxRedact_` | `RawLog.js` | `EfxUtil.js:17-27` | identical (regex literal identical) |
| `efxSign_` | `RawLog.js` | `EfxUtil.js:41-52` | identical |
| `efxJsonSafe` | `EfxApi.js` | `EfxUtil.js:30-38` | identical |

Functions the mechanical diff reported as **changed**, each read in full and accounted for:

| Function | Change | Classification |
|---|---|---|
| `n8nOptions_` (`N8nEnvelope.js:54-59`) | `allowUnverified: options.allowUnverified === true` → `n8nBool_(options.allowUnverified)` | L2 (intended) |
| `n8nSubmit_` (`:88-115`) | inline regex/`n8nErr_` → `n8nMapHandlerError_(res, 'E_UPSTREAM', { message: c.fn + ' failed' })`; fallback message identical (`(res && res.message) \|\| opts.message`) | R1; see F1, F8 |
| `n8n_listTasks`, `n8n_events`, `n8n_listWorkflows` | `JSON.parse(x \|\| '{}')` → `n8nParse_(x, {})` | R2, equivalent (old already mapped `''` → `{}`) |
| `n8n_createInitialRequest`, `n8n_submitIdSetup`, `n8n_submitHrVerification`, `n8n_createWorkflow`, `n8n_submitForm` | `JSON.parse(data)` → `n8nParse_(data, {})` | R2 convergence: `''` now `{}` → `E_VALIDATION` (was raw `SyntaxError`); see §3.3, F3 |
| `n8n_cancelWorkflow`, `n8n_bumpWorkflow`, `n8n_updateHireDate` | per-alias regex → `n8nMapHandlerError_` with opt-in `codes` (`['E_NOT_FOUND']`, `['E_RATE_LIMITED']`, none); additive `upstream` (+ `principal` on forbidden) | R1; see §5, F1 |
| `n8n_saveTaskDraft` | `JSON.parse(checklist \|\| '{}')` → `n8nParse_`; `prev.items` deep-copy → `efxParseDraft_(existing.draft)` | R2 equivalent + R3 (F6) |
| `n8n_closeTask` | `p.dryRun === true` → `n8nBool_(p.dryRun)` | L2 |
| `n8n_assignSafetyTraining` | `d.force === true` ×2, `d.dryRun === true` → `n8nBool_` | L2 |
| `efxRunAs` (`EfxApi.js:31-34`) | `return Actor.run(...)` → `var out = …; return efxRedact_(efxJsonSafe(out))` (guarded) | L3; see F4 |
| `efxReadRecord` (`:45-59`) | inline header loop → `efxRowToRecord_` | R8; see F7 |
| `efxTaskClose` (`:124-183`) | `closedRow` split into `closedRow`/`otherRow` (`:139-146`); new `efxWorkflowStatus_` check before dry-run (`:157-159`); inline draft parse → `efxParseDraft_` (`:164`) | L1 + R3 |
| `efxListWorkflows` (`:192-222`) | header loop → `efxRowToRecord_` then copy (`:217-218`); precedence unchanged (header key overwrites fixed `workflowId`/`type`, as before — review L6 deliberately untouched) | R8 |

New functions: `n8nParse_`, `n8nBool_`, `n8nMapHandlerError_` (+ `N8N_HANDLER_ERROR_RULES`), `efxRowToRecord_`, `efxParseDraft_`,
`efxWorkflowStatus_`, constant `N8N_ERROR_CODES`. Removed: none (no alias renamed; `N8N_API_VERSION` still `2026.09.17-1`).

### 3.2 Load-order analysis

Apps Script semantics that matter: each file is a separate script evaluated in an order you do not control. Function declarations and
`var`s from a **later** file do not exist while an **earlier** file's top-level code runs (`typeof` → `'undefined'`, a bare reference
throws). Therefore only code that runs at file load can be order-sensitive: top-level `var X = f()`, IIFEs, and anything an IIFE body
does at definition time. Plain `function` declarations and literal `var`s are safe in any order.

**Everything evaluated at load time, per EFX file** (fork-only files first, then the modified prod files; result of a column-0 scan of
every `.js` in the fork plus an IIFE-level scan of the six IIFE files):

| File | Load-time statements | Cross-file reference at load? |
|---|---|---|
| `EfxUtil.js` | `var EFX_SECRET_KEY_RE = /…/i` (`:17`); three `function` declarations | **none** — `Utilities` used only inside `efxSign_` |
| `N8nEnvelope.js` | `var N8N_HANDLER_ERROR_RULES = [ {code, re: /…/i, always}, … ]` (`:69-73`, regex literals); nine `function` declarations | **none** — `N8N_API_VERSION`, `Utilities`, `Actor`, `FormContracts`, `globalThis`, `efxReadRecord` all inside function bodies |
| `N8n.js` | `var N8N_API_VERSION = '…'` (`:22`); `var N8N_ALIASES = [ literals ]` (`:24-56`); `var N8N_ERROR_CODES = [ literals ]` (`:63-74`); `function n8n_*` ×27 | **none** |
| `EfxApi.js` | `function` declarations only | none |
| `RawLog.js` | `var RAW_LOG_SHEET`, `RAW_LOG_MAX_ROWS`, `RAW_LOG_HEADERS` (`:14-16`, literals); `function` declarations | none (`efxRedact_`/`efxSign_` called from `rawLogFanOut_` at runtime) |
| `Actor.js` | IIFE `var Actor = (function(){ var override_ = null; …; return {…}; })()` (`:12-52`) | IIFE body: one `var` literal + function declarations + return. `CONFIG.ADMIN_EMAILS`/`Session` only inside functions. **none** |
| `FormContracts.js` | IIFE `var FormContracts = (function(){ var VERSION; var C = {…}; var CALLABLE = {}; Object.keys(C).forEach(…); […].forEach(…); return {…}; })()` (`:22-301`) | IIFE body builds `CALLABLE` from its **own** `C` (`:239-244`). No external symbol. **none** |
| `EmployeeIdRegistry.js` | IIFE (`:12-…`): `var SHEET`, `HEADERS`, `FLOOR`, `MAX_RETRY` literals + functions | `CONFIG`, `SpreadsheetApp`, `LockService` only inside functions. **none** |
| `Config.js` (modified) | `const ENVIRONMENT = 'TEST'` (`:8`); `const CONFIG = { get SPREADSHEET_ID() {…}, … }` (`:10-…`) | Getters call `ConfigurationService.getSetting` **lazily** (first access), not at load. Pre-existing prod pattern. |
| `SchemaConstants.js` (modified) | `const SCHEMA = { literals }` (`:23`) | none |
| `Services/ConfigurationService.js` (modified) | IIFE: `var DEFAULTS = { literals }` (`:11`) + functions | none |
| `Services/AccessControlService.js` | IIFE: function declarations + return only | none |
| `Services/ActionItemService.js` (modified) | IIFE (`:37-953`): function declarations + return only; `:976-1169` are plain top-level functions | none |
| `EmailUtils.js` (modified) | `var ES = { literals }` (`:717`) | none |
| `MigrationTools.js` (modified) | `var SHEETS_TO_WIPE`, `PROD_SPREADSHEET_ID`, `LEGACY_SHEET_MAP` (literals) | none |
| `ChangeNotify.js`, `EmailTemplates.js`, `ReplayService.js`, `ProdSmokeTest.js`, `SuperDebug.js`, `TestRunner.js` | literal arrays/objects/strings; `var X = function(){…}` **expressions**, never invoked at load | none |
| All other modified prod files (`*Handler.js`, `WorkflowManager.js`, `IDSetup.js`, `Specialist.js`, `Setup.js`, `RequestActionsHandler.js`) | `function` declarations only (some with a BOM at `:1`) | none |

Conclusion: **no statement in any EFX file calls a function or reads a `var` from another file at load time.** `EfxUtil.js` and
`N8nEnvelope.js` may load first, last, or anywhere between. The Node `LOAD_ORDER` (`efx-fixtures.js:14-20`, tail asserted at
`efx-test.js:111`) therefore hides nothing — but it also proves nothing about GAS order, which is why the scan above is the evidence.

`typeof efxRedact_ === 'function'` guards: they no longer defend against order (they never could — they are evaluated at call time),
only against a partial push. See F2 for why they are now inconsistent.

### 3.3 `n8nParse_` convergence

`N8nEnvelope.js:42-45`: string `''` → fallback; other string → `JSON.parse` (throws on malformed); non-string → `v || fallback`.
Old per-site behaviour and what changed:

| Alias(es) | Old | New | Silent acceptance of `''`? |
|---|---|---|---|
| `n8n_listTasks`, `n8n_events`, `n8n_listWorkflows`, `n8n_closeTask`, `n8n_saveTaskDraft` (checklist), `n8n_assignSafetyTraining` (details) | `JSON.parse(x \|\| '{}')` → `{}` | `{}` | unchanged (`''` was already `{}`) |
| `n8n_createInitialRequest`, `n8n_submitIdSetup`, `n8n_submitHrVerification`, `n8n_createWorkflow`, `n8n_submitForm` | `JSON.parse('')` → `SyntaxError` escapes alias (Router `E_SCRIPT`) | `{}` → `FormContracts.validate` → `E_VALIDATION` | **No.** Every contract has a non-empty `required` list (`FormContracts.js:30,62,85,106,140,157,171,191,215,223,232`) and `validate` (`:277-296`) rejects `undefined`, so `{}` never reaches a handler. Edge: `n8n_submitForm(actor,'it_confirmation','',{workflowId, allowUnverified:true})` — `it_confirmation` requires only `workflowId` (`:191`) which `:144` injects — but `'{}'`/`{}` reached the same handler before the refactor, so `''` merely joins the existing `{}` path; no new hole. |
| `n8n_closeTask` with `p = {}` | `efxTaskClose` → `E_VALIDATION` "taskId, or workflowId + formType, is required" (`EfxApi.js:127`) | same | unchanged |

Each call site passes a **fresh literal `{}`** as fallback, so `n8n_submitForm`'s `d.workflowId = …` mutation (`N8n.js:144`) cannot
leak between calls. `'null'` → `JSON.parse` → `null` → same downstream as before (`data || {}` in `n8nSubmit_`; `p.dryRun` throws
inside the guard → `E_INTERNAL`, as before). `n8nActor_` keeps its own try/catch (`N8nEnvelope.js:20`) — verified verbatim.

### 3.4 `n8nMapHandlerError_` — see §5 for the full table

Rule order (`N8nEnvelope.js:79-82`): forbidden (always) → `E_NOT_FOUND` (if opted) → `E_RATE_LIMITED` (if opted) → fallback. Same
precedence as the old nested ternaries (permission first). Opt-ins match the old aliases exactly: cancel `['E_NOT_FOUND']`, bump
`['E_RATE_LIMITED']`, hire-date and all submits none. Result: 42 literal messages, 0 code changes; only free-text `e.message` can move
(F1).

### 3.5 `efxWorkflowStatus_`

`EfxApi.js:109-117` reads `CONFIG.SHEETS.WORKFLOWS` (`'Workflows'`, `Config.js:54`), matches `data[i][SCHEMA.WORKFLOWS.WORKFLOW_ID]`
(col 0) and returns `data[i][SCHEMA.WORKFLOWS.STATUS]` (col 4, `SchemaConstants.js:40-50`). Writers/readers of the same cell:
`updateWorkflow` writes `WF.STATUS + 1` (`WorkflowManager.js:166`); `cancelRequest` calls
`updateWorkflow(workflowId, 'Cancelled', …)` (`RequestActionsHandler.js:36`); StateSync reads `SCHEMA.WORKFLOWS.STATUS`
(`StateSync.js:20,:55,:229`, the last with the comment listing `'Cancelled'`). Same column. Missing sheet → `''` (`:111`); missing row →
loop falls through → `''` (`:116`); empty sheet → `getValues()` is `[[]]`, loop from `SCHEMA.ROW.FIRST_DATA = 1` does not execute. No
throw path. Cost: one extra full read of `Workflows` per close (including dry-run) — negligible at this sheet's size.

### 3.6 Tooling after the split

- `tools/gen-contracts.js:33` vm-loads `SchemaConstants.js, Services/ConfigurationService.js, Config.js, FormContracts.js, N8n.js` —
  **not** `N8nEnvelope.js`. Works because `N8n.js` has no load-time reference to the envelope helpers (§3.2). Error table rendered from
  `ctx.N8N_ERROR_CODES` (`:51-54`), throws if missing (`:52`).
- `tools/n8n-check.js:27-32` runs a temp copy of `gen-contracts.js` with `execFileSync(process.execPath, …)` into `os.tmpdir()`; no
  network unless `--live` is passed (it was not). Result: `OK: contracts compatible with docs/contracts.lock.json`.
- `tools/n8n-workflows-check.js:67-69` regex-extracts `var N8N_ALIASES = [...]` from `N8n.js`; `:79-82` builds the function set from
  `^function n8n_\w+` — the envelope helpers are `n8nActor_`-style (no underscore after `n8n`) so they never matched and their move is
  invisible. Result: `OK: 25 workflow file(s) lint clean (1 warning(s))` — the warning (`90_EFX_E2E_Test.json` `systems: "SiteDocs"`)
  predates the refactor.
- Docs tables vs `N8N_ERROR_CODES` (evaluated from `N8n.js` in a bare vm; backticks normalised): `docs/N8N_CONTRACTS.md` §Error codes
  **10/10 match**; `n8n/README.md` (minus Router `E_TRANSPORT`/`E_SCRIPT`) **10/10 match**; `docs/wiki/FOR_GEORGE.md` §6
  code/meaning/what-to-do **10/10 match** (regenerated in `d6929ab`).

### 3.7 `docs/review/DIFF_prod_vs_efx.patch`

Regenerated read-only with the same command recorded in its headers
(`diff -ruN --strip-trailing-cr --exclude=__tests__ --exclude=docs --exclude=.clasp.json employee_forms_deployment/employee_management_v2 employee_forms_efx/employee_management_v2_efx`)
into the scratchpad and compared after dropping `diff`/`---`/`+++` header lines: **identical** (2171 lines each). File set (28 =
21 modified + 7 fork-only `.js` + `AGENTS.md`): modified — `BOSSReviewHandler, Config, DashboardActionsHandler, EmailUtils,
EquipmentRequestHandler, HRVerificationHandler, IDSetup, ITConfirmationHandler, ITSetupHandler, InitialRequestHandler, MigrationTools,
PositionChangeHandler, RawLog, RequestActionsHandler, SchemaConstants, Services/ActionItemService, Services/ConfigurationService, Setup,
Specialist, TerminationHandler, WorkflowManager`; fork-only — `AGENTS.md, Actor.js, EfxApi.js, EfxUtil.js, EmployeeIdRegistry.js,
FormContracts.js, N8n.js, N8nEnvelope.js`. An independent `diff -rq` of the two folders lists exactly these plus the three excluded paths (`.clasp.json`,
`__tests__/`, `docs/`) and **nothing only in prod**. Zero `.html` headers or hunks; zero `.html` mentions anywhere in the patch.

### 3.8 Suite and gate run (this review, working tree `d6929ab`)

| Command (from `employee_management_v2_efx/__tests__`) | Result | Expected |
|---|---|---|
| `node super-test.js` | 159 passed / 0 failed (12 scenarios) | 159 |
| `node form-field-map-test.js` | 312 passed / 0 failed | 312 |
| `node efx-test.js` | 190 passed / 0 failed | 190 |
| `node migration-test.js` | 42 passed / 0 failed | 42 |
| `node efx-e2e-test.js` | 580 passed / 3 failed, all 3 recorded defects (#15/#16/#17); 122 emails captured, 0 sent; log written to `docs/test-logs/efx-e2e-20260916-2307.md` (untracked, F9) | 580 + 3 |
| `node tools/n8n-check.js` (fork root) | `OK: contracts compatible with docs/contracts.lock.json` | OK |
| `node tools/n8n-workflows-check.js` (fork root) | `OK: 25 workflow file(s) lint clean (1 warning(s))` | OK |

---

## 4. Things checked that turned out fine (so nobody re-checks them)

- `.claspignore` excludes only `docs/**` and `__tests__/**`; `.clasp.json` `rootDir` is `""` — both new files will be pushed.
- `efxTaskClose` by `workflowId+formType` when several rows match: an `Open` row still wins (`break` at `:140`); with both a `Closed`
  and a `Cancelled` row `E_ALREADY_CLOSED` wins (`:145` before `:146`), same code the old code produced for that mix.
- `efxTaskClose` by `taskId` on a `Cancelled` task: `:154` → `E_TASK_NOT_OPEN`, unchanged from before; the new `:157` check adds the
  Open-task-on-Cancelled-workflow case in both lookup modes and before dry-run, as the log claims.
- `n8nBool_` (`N8nEnvelope.js:47-52`) is strict: `true`, `'true'`, `'yes'`, `'1'` (trimmed, case-insensitive) only; `1`, `'TRUE '`
  trimmed OK, `'on'`/`'y'` false. `n8nOptions_` with an array still yields `allowUnverified:false`.
- `efxParseDraft_` with a `Date`/number cell: `JSON.parse(JSON.stringify(date))` → string → not an object → empty draft; old
  `JSON.parse(String(date))` threw → catch → empty draft. Same result.
- `efx-test.js:102-104` fails on any `'E_*'` literal in `N8n.js`/`N8nEnvelope.js`/`EfxApi.js` missing from `N8N_ERROR_CODES` — the
  generated tables cannot drift silently.
- `N8N_ERROR_CODES` is a constant only; not added to the `n8n_contracts()` result (would have been a contract change) — confirmed at
  `N8n.js:92-97`.
- Messages in `WorkflowManager.js:250-260` and `DashboardActionsHandler.js:26-30` (`Permission denied. Admin access required.`,
  `adminPurgeWorkflows is disabled…`) are not reachable through any alias or `efxRunAs` (`adminPurgeWorkflows`/bulk actions are not in
  `CALLABLE`, `FormContracts.js:239-244`).

---

## 5. Handler message → error code table

Codes under the old per-alias regexes (`8ab3a29:N8n.js:104,205,213,221`) vs the new `n8nMapHandlerError_` rule table. `<…>` marks
free text. Handlers reachable via `n8nSubmit_` are the eleven `FormContracts` `fn`s (`FormContracts.js:28-230`).

**Submit path** (`n8nSubmit_` → any `FormContracts` fn; no opt-in codes; old regex `/access denied|permission denied|not authori[sz]ed|forbidden/i`)

| Source | Message | Old | New |
|---|---|---|---|
| `InitialRequestHandler.js:30` | `<validation.message>` (validateRequiredFields) | E_UPSTREAM | E_UPSTREAM |
| `InitialRequestHandler.js:36` | Existing Internal Employee ID must be a 4-6 digit number (got "…"). | E_UPSTREAM | E_UPSTREAM |
| `InitialRequestHandler.js:135` | Error submitting form: `<e.message>` | E_UPSTREAM | E_UPSTREAM (*) |
| `EquipmentRequestHandler.js:51` | `<validation.message>` | E_UPSTREAM | E_UPSTREAM |
| `EquipmentRequestHandler.js:85` | Server Error: `<error>` | E_UPSTREAM | E_UPSTREAM (*) |
| `TerminationHandler.js:67` | Manager must be selected from the directory lookup — please search and select a name. | E_UPSTREAM | E_UPSTREAM |
| `TerminationHandler.js:116` | Error: `<error.message>` | E_UPSTREAM | E_UPSTREAM (*) |
| `TerminationHandler.js:238` | Access denied. | **E_FORBIDDEN** | **E_FORBIDDEN** |
| `TerminationHandler.js:499` | `<e.message>` | E_UPSTREAM | E_UPSTREAM (*) |
| `PositionChangeHandler.js:28/31/34` | Current/New/Previous manager must be selected from the directory lookup — … | E_UPSTREAM | E_UPSTREAM |
| `PositionChangeHandler.js:151` | Error: `<error.message>` | E_UPSTREAM | E_UPSTREAM (*) |
| `PositionChangeHandler.js:379` | Access denied. | **E_FORBIDDEN** | **E_FORBIDDEN** |
| `PositionChangeHandler.js:986` | `<e.message>` | E_UPSTREAM | E_UPSTREAM (*) |
| `IDSetup.js:104` | Workflow ID not found | E_UPSTREAM | E_UPSTREAM (no opt-in → not E_NOT_FOUND, as before; e2e asserts this) |
| `IDSetup.js:107,226` | `<error.message>` | E_UPSTREAM | E_UPSTREAM (*) |
| `IDSetup.js:185` | Internal Employee ID is pre-assigned (…) and cannot be changed here. | E_UPSTREAM | E_UPSTREAM |
| `HRVerificationHandler.js:97` | Access denied. | **E_FORBIDDEN** | **E_FORBIDDEN** |
| `HRVerificationHandler.js:174` | Workflow not found: `<workflowId>` | E_UPSTREAM | E_UPSTREAM |
| `HRVerificationHandler.js:348` | `<error.message>` | E_UPSTREAM | E_UPSTREAM (*) |
| `ITSetupHandler.js:210` | Access denied. | **E_FORBIDDEN** | **E_FORBIDDEN** |
| `ITSetupHandler.js:405` | `<error.message>` | E_UPSTREAM | E_UPSTREAM (*) |
| `ITConfirmationHandler.js:48` | Missing workflow ID. | E_UPSTREAM | E_UPSTREAM |
| `ITConfirmationHandler.js:264` | `<e.message>` | E_UPSTREAM | E_UPSTREAM (*) |
| `Specialist.js:218` | `<error.message>` | E_UPSTREAM | E_UPSTREAM (*) |
| `BOSSReviewHandler.js:185/299/385` (not a FormContracts fn; listed for completeness) | Missing workflow ID. / Could not load workflow context. / `<e.message>` | E_UPSTREAM | E_UPSTREAM |

**`n8n_cancelWorkflow`** (opt-in `E_NOT_FOUND`; old `/[Pp]ermission/` then `/not found/i`)

| Source | Message | Old | New |
|---|---|---|---|
| `RequestActionsHandler.js:30` | Workflow not found. | E_NOT_FOUND | E_NOT_FOUND |
| `RequestActionsHandler.js:33` | Permission denied. HR, IT, Admin, the requester, or the manager can cancel requests. | E_FORBIDDEN | E_FORBIDDEN |
| `RequestActionsHandler.js:64` | `<e.message>` | E_UPSTREAM | E_UPSTREAM (**) |

**`n8n_bumpWorkflow`** (opt-in `E_RATE_LIMITED`; old `/[Pp]ermission/` then `/already sent/i`)

| Source | Message | Old | New |
|---|---|---|---|
| `RequestActionsHandler.js:126` | Workflow not found. | E_UPSTREAM | E_UPSTREAM |
| `RequestActionsHandler.js:129` | Permission denied. HR, IT, Admin, the requester, or the manager can send reminders. | E_FORBIDDEN | E_FORBIDDEN |
| `RequestActionsHandler.js:136` | A reminder was already sent recently for this step. Please wait before sending again. | E_RATE_LIMITED | E_RATE_LIMITED |
| `RequestActionsHandler.js:151` | `<e.message>` | E_UPSTREAM | E_UPSTREAM (**) |
| `RequestActionsHandler.js:223` | Failed to send email: `<e.message>` | E_UPSTREAM | E_UPSTREAM (**) |
| `RequestActionsHandler.js:267` | Unknown action item step: `<targetStep>` | E_UPSTREAM | E_UPSTREAM |
| `RequestActionsHandler.js:271` | Action Items sheet not found | E_UPSTREAM | E_UPSTREAM |
| `RequestActionsHandler.js:311` | Action Item not found or already closed for: `<targetStep>` | E_UPSTREAM | E_UPSTREAM |

**`n8n_updateHireDate`** (no opt-in; old `/[Pp]ermission/`)

| Source | Message | Old | New |
|---|---|---|---|
| `RequestActionsHandler.js:77` | Permission denied. Only HR, IT, or Admin can edit hire dates. | E_FORBIDDEN | E_FORBIDDEN |
| `RequestActionsHandler.js:82` | Initial Requests sheet not found. | E_UPSTREAM | E_UPSTREAM |
| `RequestActionsHandler.js:88` | Required columns not found. | E_UPSTREAM | E_UPSTREAM |
| `RequestActionsHandler.js:106` | Workflow not found in Initial Requests. | E_UPSTREAM | E_UPSTREAM |
| `RequestActionsHandler.js:110` | `<e.message>` | E_UPSTREAM | E_UPSTREAM (**) |

(*) free-text row: **new** yields `E_FORBIDDEN` if the exception text contains "permission" (any form), "access denied",
"not authori[sz]ed" or "forbidden"; **old** required "permission denied". Probe: `You do not have permission to access the requested
document.` → old E_UPSTREAM, new E_FORBIDDEN. This is finding F1.
(**) free-text row: **new** additionally yields `E_FORBIDDEN` for "access denied" / "not authori[sz]ed" / "forbidden"; **old** only for
"[Pp]ermission". Same finding.

Not reachable through any alias (listed so the grep is complete): `DashboardActionsHandler.js:26,30,92`, `DashboardDataHandler.js:30,202`,
`WorkflowManager.js:250,256,260,313`, `RequestDetailsHandler.js` (read path returns `E_NOT_FOUND` unconditionally at `N8n.js:102`),
`Services/ActionItemService.js:184,362,393` (`closeActionItem` — mapped by `efxTaskClose:178-179`: `/already/i` → `E_ALREADY_CLOSED`,
else `E_UPSTREAM`, unchanged), `:1013-1169` (`completeMyTask`/`jrCompleteViaSecret`, legacy doPost path, not aliased).

---

## 6. What to do tomorrow

1. Deploy to TEST as-is. Nothing in this pass blocks it.
2. Optional follow-up commit (no contract change, no version bump): F1 (narrow the forbidden regex or document the widening),
   F2 (drop the vestigial `typeof` guards), F5 (swap redact/jsonSafe order in `n8n_getContext`), F3 (parse inside the guard).
3. Decide what to do with `docs/test-logs/efx-e2e-20260916-2307.md` left by this review's run (commit or delete).


## Fixes applied (2026-09-16 23:15, after this review)
| Finding | Fix |
|---|---|
| F1 | `N8N_HANDLER_ERROR_RULES` forbidden regex tightened to `permission denied|access denied|not authori[sz]ed|forbidden` — all four Forms messages start with `Permission denied.`; Google's `You do not have permission to call …` stays `E_UPSTREAM` |
| F2 | `typeof efxRedact_` guards removed in `EfxApi.js` (3 sites) and `N8n.js`; redaction fails closed if `EfxUtil.js` is missing |
| F3–F5 | left as documented Lows (backlog) |
