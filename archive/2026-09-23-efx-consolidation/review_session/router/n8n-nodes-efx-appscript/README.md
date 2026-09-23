# n8n-nodes-efx-appscript (SCAFFOLD — not built, not tested)

Community node package for the team n8n (self-hosted 2.28.x, ECS `n8n-staging-*` / `n8n-prod-*`).
It packages the "EFX · Router" pattern (`../../n8n/00_EFX_Router.json`) as two nodes so George gets
dropdowns instead of sub-workflow ids:

| Node | What it does |
|---|---|
| **Apps Script Router (Employee Forms)** `efxRouter` | Project dropdown (from the EFX Registry sheet) → Function dropdown (live from `n8n_contracts()`) → args/actor JSON, or typed presets (Create Workflow, Submit ID Setup, Get Workflow, Get Employee ID, List Tasks, Close Task, Close JR Task, Assign Safety Training, Health, Contracts). Calls `scripts.run` on the Execution API with the built-in **Google Service Account** credential and applies the same unwrap/guard rule as the Router sub-workflow. |
| **Apps Script Router Trigger (Employee Forms)** `efxRouterTrigger` | Polling trigger over `n8n_events` (Raw Log feed). Cursor + seen-set in node static data; `pruned` → resync from `now - lookback`. |

Layout follows [n8n-nodes-starter](https://github.com/n8n-io/n8n-nodes-starter): `nodes/<Node>/<Node>.node.ts`, `package.json > n8n.nodes`, `gulp build:icons`.
Written against the `n8n-workflow` types (`IExecuteFunctions`, `IPollFunctions`, `httpRequestWithAuthentication`). **Nothing here has been compiled or run yet** — expect small type fixes on first `npm run build`.

## Design notes / assumptions
- **Credential reuse.** No custom credential type; `package.json > n8n.credentials` is empty on purpose. Both nodes declare the built-in `googleApi` (Google Service Account) credential. Because community nodes are not in n8n's internal node→scope map, the credential must have **"Set up for use in HTTP Request node"** enabled with the scopes listed in `nodes/shared/transport.ts` (`REQUIRED_SCOPES`), and **Impersonate a user = `efx-bot@team-group.com`**.
- **Execution API rules.** The target script must be linked to the **same GCP project** as the service account and have an **API Executable** deployment. `devMode:false` (default) runs that deployment.
- **Guard rule** (identical to the Router sub-workflow): non-JSON / HTTP error / `done!=true` → `EFX E_TRANSPORT`; script threw → `EFX E_SCRIPT`; envelope `ok:false` → `EFX <code>` thrown, except `E_ALREADY_CLOSED` → `{ok:true, alreadyClosed:true}` when the option is on (default). Success output = alias `result` flattened + `ok, fn, requestId, apiVersion, tookMs` (+ `record`, `employeeId`).
- **Actor** is always `parameters[0]` (N8n.js contract `n8n_<name>(actor, ...args)`). Default `{ id: 'n8n:<workflow name>', email: 'efx-bot@team-group.com', display: '<workflow name> (n8n)' }`.
- **Registry sheet** columns (header row): `project · scriptId · apiDeploymentId · gcpProject · enabled · contractVersion · owner · registeredAt · notes` on a tab named `Registry`. Rows with `enabled=false` are hidden from the dropdown.
- Idempotency-key caching is **not** in the node yet (the Router sub-workflow has it); add via `getWorkflowStaticData('node')` if needed.

## Build
```powershell
cd router\n8n-nodes-efx-appscript
npm install
npm run build        # tsc + copy icons → dist/
npm run lint
```

## Install on the self-hosted n8n
**Option A — Community node (fastest, staging first).** Publish to the GitLab npm registry (or a private npm scope), then in n8n: *Settings → Community nodes → Install* → `n8n-nodes-efx-appscript`. Requires `N8N_COMMUNITY_PACKAGES_ENABLED=true` (default) on the ECS task definition. Community packages are installed into the container's `~/.n8n/nodes` volume; on ECS that directory must be on the EFS volume or the install is lost on redeploy.

**Option B — Baked into the image (recommended for prod).** Extend `team-group-n8n-environments/update_n8n.ps1`: after `docker pull n8nio/n8n:$Version`, build a thin layer instead of re-tagging:
```dockerfile
FROM n8nio/n8n:<version>
USER root
RUN mkdir -p /home/node/.n8n/nodes && cd /home/node/.n8n/nodes \
 && npm install --omit=dev n8n-nodes-efx-appscript@<pkg-version> \
 && chown -R node:node /home/node/.n8n
USER node
```
then tag/push `n8n-main-service` and `n8n-worker-service` exactly as the script does today, and `--force-new-deployment` staging, then prod with `-Prod`. Workers need the package too (executions run there).

**Option C — Dev loop.** `npm run build`, then `npm link` into a local n8n (`~/.n8n/custom/`) per the starter README.

## Not yet done
- Compile + lint pass; unit tests for `unwrapAndGuard` (port the Router harness cases: ok / already-closed / strict / validation / script error / 401 / HTML / empty).
- Verify `httpRequestWithAuthentication('googleApi', …)` picks up the credential's `scopes` field for a community node on 2.28.x (if not, fall back to a custom credential type that wraps the SA key and mints the JWT itself).
- Trigger: n8n polling triggers run on the schedule set in the node's *Poll Times*; confirm `getWorkflowStaticData('node')` persists across worker executions (queue mode) — it does for polling triggers on main.
- Add `E_CONTRACT_DRIFT` check: compare `contractVersion` in the registry with `n8n_contracts().contractsVersion` and warn.
