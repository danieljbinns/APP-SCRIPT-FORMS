# EFX testing strategy

Applies to the fork `employee_management_v2_efx/` and the n8n workflows in `n8n/`. Goal: change Forms freely while George's n8n flows keep working — proven by tests, not by hope.

## Pyramid
```
        /  Live TEST script E2E (T0–T11, manual, once per release)   \   few · slow · real Google/n8n
       /  n8n 90_EFX_E2E_Test (one node per step, staging)             \  some · minutes · real Execution API
      /   Node GAS-mock E2E chains  (efx-e2e-test.js)                    \ many · seconds · all workflow types, emails captured
     /    Node GAS-mock unit/contract (efx-test.js, super-test.js, field-map) \ most · seconds · every alias, every field
    /     Static gates (node --check, tools/n8n-check.js, gen-contracts, inventory) \ instant · run on every change
```

## What each layer proves
| Layer | Proves | Cannot prove | Cadence |
|---|---|---|---|
| Static gates | syntax; contract compatibility (additive vs breaking); every alias/handler exists | behaviour | every edit (pre-commit) |
| `form-field-map-test.js` (312) | HTML `name=` → payload key → sheet column → email context, for every form | server logic | every edit |
| `super-test.js` (159) | prod behaviour preserved across 12 real scenarios (New Hire, HR, IT, Termination, Equipment, idempotency, validation, JR split) | EFX additions | every edit |
| `efx-test.js` (120) | alias envelope; contract validation writes nothing; ID minted at submit + continuity + idempotency + race recovery; **authorization = session principal, not actor**; admin override synced; JR/Safety/generic close semantics (`E_ALREADY_CLOSED`, `E_TASK_NOT_OPEN`, formType enforcement); draft shape; redaction on API surface; events + cursor; other forms create/approve; cancel/bump/hire date; list/context; unverified-form gate | Script-Property flags (mock ConfigurationService ignores them); real emails; Execution API auth | every edit |
| `efx-e2e-test.js` | full chains per workflow type from create to `Complete` through aliases + handlers; every email captured and logged (`docs/test-logs/`) with recipients; side-effects (`IT Results`, `ID Setup Results` special cases, WIS sequencing) | anything requiring Google | every edit / nightly |
| n8n `90_EFX_E2E_Test` | Execution API auth (SA + DWD), envelope unwrap, guard, wrapper input mapping, idempotency cache | Forms internals | after every TEST deploy |
| Live T0–T11 (`docs/plans/TEST_PLAN.md`) | end-to-end on real Sheets with redirected emails; flags; migration; canary | — | release gate |

## Coverage targets
- 100% of `n8n_*` aliases have at least: happy path, validation failure (no writes), idempotent/no-op case, forbidden case where a role applies.
- 100% of `FormContracts` forms exercised by at least one alias test with a UI-shaped payload (currently 9/11; `it_confirmation` and `specialist` deliberately unverified — see `docs/review/KNOWN_DEFECTS_PROD.md`).
- Every `E_*` code emitted somewhere is asserted somewhere (`grep -o "E_[A-Z_]*" N8n.js EfxApi.js | sort -u` vs the suites).
- Every email subject that a chain can send appears in the E2E log with a non-empty recipient list.

## Test data rules
- Never real people: requester/manager emails are `*@team-group.com` test addresses; the mock never sends; the TEST script has `EMAIL_REDIRECT_ALL` + `ENVIRONMENT='TEST'`.
- Vary `requesterEmail` when creating several workflows in one test (30-second idempotency guard).
- `employeeType` ∈ {Direct Hire, Agency}; `employmentType` ∈ {Hourly, Salary}; `siteDocsJobCode` ∈ the HTML enum.
- Seed `ID Setup Results` with a known max (30410) so ID continuity is asserted, not assumed.

## Security-focused tests (must stay)
- Actor spoofing: admin `actor.email` + non-admin session → refused (`efx-test` ID SETUP).
- Redaction: passwords never leave via `n8n_events`/`n8n_getContext`; raw sheet unchanged.
- Allow-list: `efxRunAs` refuses non-contract functions (add a test when the generic runner is exposed).
- Cancelled tasks cannot be closed; JR closer refuses non-`jr_title` tasks.

## Gaps and how they're closed
| Gap | Closed by |
|---|---|
| Script-Property flags (`SAFETY_TRAINING_AT_SUBMIT`, webhook fan-out) | live T8 / T9 on the TEST script |
| `Dashboard_View` writer (StateSync) under the mock | live T4/T5 (list after create) |
| Execution API return serialisation with real Dates | live T1–T3 (`efxJsonSafe` guards; verify `n8n_getContext`, `n8n_listWorkflows`) |
| Library/Execution quotas, 6-minute limit | live soak: 20 sequential creates via n8n |
| Emails' actual rendering | live, redirected mailbox review |

## Definition of done for any change
`node --check` clean → 4 suites green → `tools/n8n-check.js` OK (or version bumped + `--update` + announcement) → docs regenerated (`gen-contracts`) → mapping doc touched if a field changed → local commit. Then TEST deploy + `90_EFX_E2E_Test` before anyone tells George.
