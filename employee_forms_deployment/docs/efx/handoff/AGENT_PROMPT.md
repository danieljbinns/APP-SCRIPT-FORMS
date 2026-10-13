# Agent prompt — Employee Forms ⇄ n8n (EFX)

Paste everything below the line into a fresh agent session. It is self-contained: it assumes no
memory of previous work and names every file, id and gotcha the agent needs.

---

You are working on the **Employee Forms ⇄ n8n integration** for TEAM Group / Robinson Solutions.

## What this is

A Google Apps Script web app ("Employee Forms") runs new-hire onboarding, terminations, status
changes and equipment requests. It writes to a Google Sheet and emails each team as a request moves
through its steps. An **alias layer** (`N8n.js`, `FormContracts.js`, `EfxApi.js`, `Actor.js`) exposes
27 `n8n_*` functions over the Apps Script Execution API so n8n can drive the same handlers a human
form would, with the same validation and the same side effects.

George Anthony owns the n8n side. He does **not** have the repo. He gets documentation by email and
a shared n8n node he can copy but not edit.

## The facts you need

| Thing | Value |
|---|---|
| Prod script id | `1AuIbJl1jRh1awi-MW-6y_NftHUGtfUNRexZk1gPzvenmIblSZo-lPz66` |
| Prod spreadsheet | `1kGjw8e-uIehaBemlsRZ4Yq1QrYOWkJvWzhKbgfl4Pxo` ("Employee Managment Forms") |
| Live web app deployment | `AKfycbyXp4q0…` **@79** — "LIVE REAL PROD UPDATE DONT DELETE" |
| HEAD deployment (`/dev`) | `AKfycbwIDtch…` — runs current saved code |
| JR automation endpoint | `AKfycbw7fhvI…` **@76**, anonymous `doPost` — **DO NOT re-version or delete** |
| Stray duplicate | `AKfycbwAb33…` @75 — unused, leave alone |
| Local repo | `P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_deployment` |
| Source dir | `employee_management_v2/` (the EFX fork was folded in on 2026-09-23) |

## How to actually run things

- **Push code:** `clasp push -f` from `employee_management_v2/`. Pushing updates **HEAD only** —
  @79 keeps serving its pinned version until someone re-cuts it in the editor.
- **Run a function on prod:** `python gas_runner.py <functionName> --env prod` from
  `D:\Credentials\google\binns-claude-desktop`. It takes **no arguments** and expects a return shaped
  `{pass, fail, warn, emailTotal, failures, gasLog}` — anything else crashes its log writer. Wrap what
  you need in a `…ForRunner()` function. The client often times out on long runs; **the script still
  finishes server-side**, so re-read state rather than assuming failure.
- **`clasp run` does NOT work** — the Execution API needs the calling OAuth client and the script to
  share a GCP project, and clasp's default client does not. Use gas_runner.
- **Tests** (from `employee_management_v2/`): `node __tests__/super-test.js`, `efx-test.js`,
  `form-field-map-test.js`, `dashboard-test.js`, `config-test.js`, `efx-e2e-test.js`. All six should
  be green before you push. Expect 159 / 218 / 315 / 27 / 24 / 600.

## Testing against prod safely

`ConfigurationService.setRuntimeOverride(key, value)` sets **execution-scoped** overrides — visible
only inside the run that set them. Use these, never the Script Properties of the same name:
`TEST_SPREADSHEET_ID` (writes to the dev sheet), `EMAIL_REDIRECT_ALL`, `SUPPRESS_EMAILS_OVERRIDE`.

> The Script Property versions are **global and live**. A smoke run that sets them sends every real
> user's email to the tester and writes their rows to the dev sheet, silently. That was a real bug.

Ready-made entry points:

- `runProdSmokeIsolatedForRunner()` — 4 suites, dev sheet, mail redirected. Zero prod impact.
- `runSuperDebugUnionIsolatedForRunner()` — New Hire + Status Change, same isolation.
- `runSuperDebugUnionOpenableForRunner()` — writes to the **live** sheet so the rows can be opened in
  a real form. Creates real prod rows; `cleanupSuperDebugAll()` removes them.
- `clearSmokeEmailRedirect()` — safety valve if a run was interrupted.

## The contracts

`FormContracts.js` is a hand-maintained allowlist of what each form accepts. It is a real gate:
`validate()` **rejects any key not listed** (`unknown field (not in contract)`). Adding a field to a
form without adding it here means n8n gets rejected where the UI succeeds.

After any field change: `node tools/efx/gen-contracts.js --lock`, then `node tools/efx/n8n-check.js`
(CI gate). Docs land in `docs/efx/N8N_CONTRACTS.md`.

`enums` holds either a literal array (**validated**) or a `'reference.*'` string (**documentation
only — not validated**, resolved nowhere). Sites, JRs and job numbers are the pointer kind.

## Traps that have already cost time

1. **Checklist item names are keys, not labels.** `N8n.js:259-260` closes Safety items by exact
   string. Renaming one means n8n can never close it and the task stays open forever.
2. **`Current Step` is a single overwritable string.** Every handler stamps it. Never derive "what is
   outstanding" from it — use `computeOnboardingPendingStep_()`, which reads the result sheets.
3. **Sheet columns are positional.** Append only. Initial Requests is 58 wide, Position Changes 62.
   Inserting a column shifts every index in `SchemaConstants.js`.
4. **Role checks read `Reference_Groups`**, a snapshot written by `refreshDirectoryGroups()` on an
   hourly trigger. If a group is missing from the sheet it falls back to the live Admin Directory —
   slow but correct. Never wrong.
5. **MailApp cannot set a From.** The sender is whoever executes. The web app runs as
   `USER_DEPLOYING`, so re-cutting @79 under a different account changes every email's sender. It is
   currently `no-reply@team-group.com`.
6. **Closing a task by `workflowId + formType` is ambiguous for Fleetio** — a Status Change can
   create both an Update and a Removal task under `fleetio`. Close by `taskId`.

## Where to read next

- `docs/efx/handoff/README.md` — plain-English overview, including the 2026-10-13 field additions
- `docs/efx/handoff/HANDOFF.md` — the full handover
- `docs/efx/handoff/FLOW.md` — the flow diagram
- `docs/efx/N8N_CONTRACTS.md` — generated contract reference (27 aliases, 11 forms)
- `docs/efx/handoff/PROOF-2026-09-23.md` — what was proven live, with ids

## How to work

State the plan, do one thing, show the evidence, wait. Do not chain steps that look obviously next.
Never claim something passed that you did not see pass. If you change a test so your code passes,
say so explicitly and explain why the test was wrong.
