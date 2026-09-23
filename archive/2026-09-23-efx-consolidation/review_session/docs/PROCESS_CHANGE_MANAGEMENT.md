## Process Document: Changing Employee Forms without breaking n8n (EFX change management)
**Owner:** David Binns (Forms) | **Last Updated:** 2026-09-17 | **Review Cadence:** Quarterly, and after any breaking change

### Purpose
Forms will keep changing (new fields, new forms, refactors, redeploys) and George's n8n workflows must keep running without him touching them. This process makes every Forms change either invisible to n8n (additive) or explicitly announced and shimmed (breaking), with the contract gate as the enforcement point.

### Scope
Included: any change under `employee_management_v2_efx/` (later the prod folder) that touches a form field, a `submit*`/`close*`/`get*` function, a sheet column, an email subject/recipient, an action item type, or an `n8n_*` alias; registry/tier changes; TEST/prod deployments of the API-executable version.
Excluded: pure UI/CSS changes with no field or payload impact; n8n workflow edits on George's side; BOSS/SiteDocs/Litmos systems.

### RACI Matrix
| Step | Responsible | Accountable | Consulted | Informed |
|---|---|---|---|---|
| Classify the change (additive / breaking) | Forms dev (or agent) | David Binns | — | — |
| Update `FormContracts`, alias, tests, mapping doc | Forms dev / agent | David Binns | George (if behaviour changes) | — |
| Run gates (suites + `n8n-check`) | Forms dev / agent | David Binns | — | — |
| Version bump + deprecation shim (breaking only) | Forms dev | David Binns | George | HR/IT leads if a step's behaviour changes |
| Announce (breaking only) | David Binns | David Binns | — | George, IT (`grp.forms.it`) |
| TEST deploy + `90_EFX_E2E_Test` | David Binns | David Binns | George (runs his flows against TEST) | — |
| Prod promotion (runbook) | David Binns | David Binns | George (go/no-go) | HR/IT/ID Setup groups |
| Registry / API-executable version bump | David Binns | David Binns | — | George |

### Process Flow
```
change request ──▶ classify ──┬─ additive ──▶ contract + alias + tests ──▶ gates green ──▶ docs regen ──▶ commit ──▶ TEST deploy ──▶ prod (runbook)
                              └─ breaking ──▶ shim old name/key ──▶ bump N8N_API_VERSION ──▶ gates (--update) ──▶ ANNOUNCE ──▶ TEST ──▶ George verifies ──▶ prod ──▶ remove shim after window
```

### Detailed Steps

#### Step 1: Classify
- **Who**: Forms dev/agent · **When**: before editing
- **How**: Additive = new optional field, new alias, new event kind, new form. Breaking = rename/remove a field or alias, new **required** field, handler renamed, return shape changed, step semantics changed (new gate, different email recipients).
- **Output**: one line in the PR/commit: `EFX: additive` or `EFX: BREAKING — <what>`.

#### Step 2: Implement with the contract
- **Who**: Forms dev/agent · **When**: with the code change
- **How**: follow skill `efx-new-form-review`: trace HTML → payload → handler → sheet; update `FormContracts.js` (bump `VERSION`); add/adjust `n8n_*` alias; add tests in `efx-test.js`; update `docs/mapping/<FORM>.md`. Never write to sheets directly from an alias; never use `actor.email` for authorization (use `Actor.principal()`).
- **Output**: code + tests + mapping doc.

#### Step 3: Gates
- **Who**: Forms dev/agent · **When**: before commit
- **How**: `node --check` all files; `super-test`, `form-field-map-test`, `efx-test`, `efx-e2e-test` green; `node tools/gen-contracts.js`; `node tools/n8n-check.js` → OK (additive) or exit 1/2 (breaking).
- **Output**: green run recorded in `docs/TEST_RESULTS_LOCAL.md` (append a line).

#### Step 4 (breaking only): Shim, bump, announce
- **Who**: Forms dev + David · **When**: same change
- **How**: keep the old alias/key working for one release (`function oldName(){ return newName(...); }`, accept old payload key and map it), mark `deprecated`/`replacedBy` in `N8N_ALIASES`; bump `N8N_API_VERSION`; `node tools/n8n-check.js --update`; write the change in `docs/CHANGELOG.md` and message George with: what changed, old→new mapping, the date the shim is removed (≥ 30 days), and which of his workflows are affected (grep his exports for the alias/field).
- **Output**: announcement sent; changelog entry; shim in code.

#### Step 5: TEST deployment and verification
- **Who**: David · **When**: after Step 3/4
- **How**: `clasp push` to the TEST script only; new API-executable deployment version; update the registry row (`apiVersion`); run `90_EFX_E2E_Test` on staging n8n; George runs his affected flows against TEST with redirected emails.
- **Output**: E2E pass + George's go.

#### Step 6: Prod promotion
- **Who**: David · **When**: after Step 5
- **How**: per `__tests__/PROD_DEPLOY_RUNBOOK.md` + `migration/MIGRATION_PLAN.md` (dry-run → apply for any sheet change); publish the new API-executable version; update prod registry row; canary green; watch `n8n_events` for the first real submissions.
- **Output**: prod live; runbook post-deploy section updated.

### Exceptions and Edge Cases
| Scenario | What to Do |
|---|---|
| Hotfix must ship before George can verify | Only if additive. If breaking, ship with the shim so his flows keep working; announce after. |
| A field must be renamed in the sheet header | Header rename is breaking for `record` read-back and mapping docs: keep both headers for a release or map in `efxReadRecord`; never move columns (positional writes). |
| George reports `E_CONTRACT_DRIFT`/`E_VALIDATION` after a release | Compare `docs/contracts.lock.json` history; if we shipped without the gate, treat as incident: restore compatibility shim same day. |
| Prod defect fix changes behaviour (e.g. KNOWN_DEFECTS #3 creating the SiteDocs task) | Behaviour change = announce; new `task.created` events will start flowing — George's poller must expect them. |
| n8n is down | Forms unaffected; events queue in Raw Log; poller catches up via `afterEventId`/`pruned` resync. |
| Emergency: disable automation | Set the project's registry row `enabled=false` (n8n side) — no Forms change; or revoke the bot's sheet access. |

### Metrics
| Metric | Target | How to Measure |
|---|---|---|
| Gate compliance | 100% of commits touching the listed paths ran `n8n-check` | commit message + `TEST_RESULTS_LOCAL.md` lines |
| Unannounced breaking changes | 0 | George-reported `E_VALIDATION`/`E_CONTRACT_DRIFT` after releases |
| Time from Forms change to George-verified TEST | ≤ 2 working days | dates in changelog |
| Automation attribution correctness | 100% of automated rows show a bot/actor identity | sample `Action Items.Closed By`, `Employee IDs.Allocated By` |

### Related Documents
- `AGENTS.md`, `employee_management_v2_efx/AGENTS.md` — the rules agents follow
- `agent/efx-new-form-review`, `agent/efx-check-test-validate`, `agent/efx-logs` — skills
- `docs/N8N_CONTRACTS.md`, `docs/contracts.lock.json` — the contract and its baseline
- `docs/TESTING_STRATEGY.md`, `docs/plans/TEST_PLAN.md`, `docs/plans/CUTOVER_PLAN_JR.md`, `migration/MIGRATION_PLAN.md`
- `docs/review/CODE_REVIEW_EFX.md`, `docs/review/KNOWN_DEFECTS_PROD.md`
