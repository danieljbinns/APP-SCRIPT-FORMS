# AGENTS.md — `employee_management_v2_efx` (an EFX-registered Apps Script project)

These are the rules for **this Apps Script project**. Every project exposed to n8n through EFX carries a copy
of this file. Repo-wide rules are in `../AGENTS.md`; read that first.

## 1. What the EFX helper files are

| File | Role | May you edit it? |
|---|---|---|
| `N8n.js` | The public surface n8n calls: `n8n_*` aliases, `N8N_API_VERSION`, `N8N_ALIASES[]`, `N8N_ERROR_CODES[]` (nothing private lives here) | Yes — add aliases; follow §3–§5 |
| `N8nEnvelope.js` | Private helpers behind the aliases: `n8nActor_`, `n8nOk_`/`n8nErr_`, `n8nGuard_`, `n8nOptions_`, `n8nSubmit_`, `n8nBool_` (string booleans), `n8nParse_` (string\|object), `n8nMapHandlerError_` (handler message → code) | Rarely; changes affect every alias |
| `FormContracts.js` | Declares, per form, the handler `fn`, `required[]`, `optional[]`, `types`, `enums`, `targetSheet`, `verified`, `responseFields`; `CALLABLE` allow-list; `validate()`; `hash` | Yes — this is the file you must keep in sync (§2) |
| `EfxApi.js` | Primitives: `efxInfo`, `efxRunAs`, `efxReadRecord`, `efxTaskList`, `efxTaskClose`, `efxEmployeeIdGet/Allocate`, `efxEventsSince` | Rarely; changes here affect every alias |
| `Actor.js` | Request-scoped identity (`Actor.run`, `Actor.email`, `canOverrideEmployeeId`) | No (shared across projects) |
| `EmployeeIdRegistry.js` | Internal Employee ID allocator; sheet `Employee IDs` | No, except FLOOR/sheet name per project |
| `RawLog.js` | Event feed (`Event ID`, `Kind`, `rawLogResult`, optional signed fan-out) — logging only | No, except `RAW_LOG_MAX_ROWS` |
| `EfxUtil.js` | Pure helpers shared by RawLog/EfxApi/N8n: `EFX_SECRET_KEY_RE`, `efxRedact_`, `efxJsonSafe`, `efxSign_` | No (shared across projects) |
| `Setup.js` (EFX section), `Config.js` (EFX flags), `Services/ConfigurationService.js` (EFX defaults), `MigrationTools.js` (`migrateEfx*`) | Wiring | Yes, additively |

Handlers use `Actor.email()` instead of `Session.getActiveUser().getEmail()`. Keep it that way in any new
handler code.

## 2. The contract rule

`FormContracts.js` is the single source of truth for what n8n may send. When a change touches any of:

- a `submit*` / `close*` / `get*` function's parameters or return object,
- a form field: HTML `name=`, handler key, `format*Data` array order, sheet column/`SCHEMA` index,
- an action-item `formType` string,
- an `n8n_*` alias,

then **the same commit** must:

1. update the affected `FormContracts` entry (`required`, `optional`, `types`, `enums`, `responseFields`,
   `targetSheet`, `verified`);
2. bump `FormContracts.VERSION`;
3. if breaking (see §4), bump `N8N_API_VERSION` in `N8n.js` and add a deprecation shim (§5);
4. update `N8N_ALIASES[]` if an alias was added/changed;
5. pass `node __tests__/super-test.js`, `node __tests__/efx-test.js`, `node __tests__/form-field-map-test.js`;
6. update `../docs/wiki/FOR_GEORGE.md` §2 and `../docs/mapping/<form>.md`.

Do not set `verified:true` on a contract unless its keys were checked against the form HTML and handler
(that is what `form-field-map-test.js` proves). Do not add an alias for a `verified:false` form.

## 3. Additive-only rule

Changes to the n8n-facing surface are **additive by default**:

- New optional field → allowed. New alias → allowed. New optional return field → allowed. New enum value → allowed.
- Making a field required, renaming/removing a field, removing/renaming an alias, changing the envelope keys
  (`ok, apiVersion, requestId, result, error{code,message}`), changing an error code's meaning → **breaking**;
  needs §4 + §5.
- `FormContracts.validate` rejects unknown keys, so *removing* a field from a contract breaks any wrapper that
  still sends it. Remove only after the deprecation window.
- Never change `efxTaskClose` semantics ("identical to Complete in ActionItemForm.html") — extend via new
  parameters with defaults.

## 4. Version bumps

| Constant | Format | Bump when |
|---|---|---|
| `FormContracts.VERSION` | `'YYYY.MM.DD'` (`-proto` until first TEST deploy) | any contract change, additive or not |
| `N8N_API_VERSION` (`N8n.js`) | `'YYYY.MM.DD-n'` | breaking change to aliases/envelope/contracts, or alias deprecation start/removal |

Both are returned by `n8n_contracts()` (`contractsVersion`, `apiVersion`) and by `n8n_ping` (`apiVersion`,
`libraryVersion`). The Router / `n8n-check` compare `hash` per form; a bump without a real change is harmless, a
change without a bump is a drift incident (`../docs/wiki/RUNBOOKS.md` §6).

## 5. Alias deprecation policy

1. Add the new alias. Keep the old one as a one-line shim that calls the new one and adds `deprecated: true`
   and `replacedBy: 'n8n_newName'` to the envelope via the `extra` argument of `n8nOk_`.
2. Mark the old row in `N8N_ALIASES` with `deprecated: true, until: 'YYYY-MM-DD'` (≥ 30 days; ≥ 7 days for
   TEST-only aliases).
3. Bump `N8N_API_VERSION`; note it in `../docs/wiki/FOR_GEORGE.md` §2 and tell the n8n owner.
4. After the date, remove the shim and the row; bump `N8N_API_VERSION` again.

The same policy applies to contract field renames: accept both keys in the alias (map old → new before
`validate`) during the window.

## 6. Project-specific facts

- Environment: `Config.js` `ENVIRONMENT` string; sheet from Script Property `SPREADSHEET_ID` (coded default is
  the **dev** sheet — never rely on it). `.clasp.json` scriptId must be the TEST script, never prod/dev.
- Self-check from the editor: `efxSelfTest()` (no writes). Migrations: `migrateEfxDryRun()` → `migrateEfxApply()`;
  optional `migrateEfxBackfillDryRun()` → `…Apply()`.
- EFX Script Properties (via `Setup.js` setters only): `SAFETY_TRAINING_AT_SUBMIT`, `EFX_EVENT_WEBHOOK_URL`,
  `EFX_EVENT_KID`, `EFX_EVENT_SECRET`. Non-prod must also have `EMAIL_REDIRECT_ALL`.
- Sheets created on demand: `Employee IDs`, `Raw Log`. Appended header: `Initial Requests` col 56
  `Internal Employee ID` (`SCHEMA.INITIAL_REQUESTS.INTERNAL_EMP_ID = 55`).
- Known handler issues the contracts route around (do not "fix" as a side effect of EFX work; file separately):
  `submitITConfirmation` defined twice (`BOSSReviewHandler.js`, `ITConfirmationHandler.js`);
  `submitSpecialistForm` sheet map dead (all → `Specialist Results`).
