# JR cutover plan — George's live closer moves from `doPost` @76 to the EFX Router wrapper

Status of the live chain (verified 2026-09-16, memory `efx-bridge-respec-2026-09-16` + spec `02`/`10`):

```
Forms email "JR Assignment — <name>" ──▶ 4InJ9cdAr5YxVgoT  JR Assignment Automation (Gmail trigger, regex tid=TK-…)
   ──▶ BOSS tracker sheet 18prwB6phOIGIjI9V92h_hEXz4fpfwdramri1ziIiAC0 (col K "Ticket ID/#")
   ──▶ manager token link ──▶ KFzI1VJBU01axjTb ──▶ webhook boss-assign
   ──▶ J7RU99n01pq9Xk3D  "BOSS JR Assignment (COPY - PROD portal)"  [n8n-staging, project Team Group kOteX9ImmtqV980I, ACTIVE]
          Assign JR in BOSS ─▶ API GW ik2ur9kika /prod/assign ─▶ Lambda boss-jr-assign (active, updated 2026-09-15)
          Mark Portal JR Complete ─▶ POST https://script.google.com/macros/s/AKfycbw7fhvI…/exec  (prod script deployment @76, ANYONE_ANONYMOUS)
                                      body { secret: <PORTAL_SHARED_SECRET>, action:'completeJrTitle', workflowId: <TK-… or NEW_EMP_…>, itemName }
                                      → Router.doPost → jrCompleteViaSecret → task Closed, closedBy 'JR Automation (n8n)'
Dead: Lambda portal-complete-jr-item (Puppeteer + secret n8n/portal-automation/george-cookies) — last ran 2026-07-16.
```

Target:

```
J7RU99n01pq9Xk3D … Assign JR in BOSS ─(success output)─▶ Execute Workflow: 12_Forms_CloseJrTask { idOrWorkflow: portalTicketId, notes }
                                                          └▶ 00_EFX_Router → Execution API (efx-router SA as efx-bot) → n8n_closeJrTask
                                                             → efxTaskClose → ActionItemService.closeActionItem → Closed, closedBy efx-bot@team-group.com
```

Only the **last hop** changes. The trigger hop (Gmail regex) is a separate, later change (spec 12 §4: Events poller `task.created`).

---

## 0. Gates before any prod cutover step

| Gate | Evidence |
|---|---|
| G1 TEST tier green | `TEST_PLAN.md` T0–T7 PASS, T7 second run `E_ALREADY_CLOSED`. |
| G2 dev tier green | Same on dev script `1VI9tR0GCx…` after the fork is merged to `employee_management_v2_dev/`; George has run his BOSS chain against dev at least once with redirected emails (spec 12 §5 step 4). |
| G3 prod Forms has the alias layer | Fork promoted to `employee_management_v2/` and deployed to the **portal** deployment (`MIGRATION_PLAN.md` §3.3) — `n8n_closeJrTask` exists on prod HEAD; prod `Employee IDs`/headers migrated. |
| G4 prod GCP door | `efx-prod` project, `efx-router@efx-prod` SA + DWD, prod script linked, API-executable deployment `efx-api v1`, n8n **prod-tier** credential `EFX Google SA (prod)` (same `efx-bot`, prod key). Canary `30_EFX_Canary` (prod copy) green for 24 h with `EXPECTED_SHEET_ID = 1kGjw8e…`. |
| G5 George available | He owns `J7RU99n01pq9Xk3D`; he makes the node edits (or approves Binns doing them in the Team Group project). A real hire is scheduled in the week so the parallel run has traffic. |
| G6 Rollback anchor | n8n: export `J7RU99n01pq9Xk3D` JSON before editing (Download) → `team-group-n8n-workflows` repo (`dev` branch) with secrets redacted. Prod script: `clasp list-deployments` snapshot; @76 stays deployed and unchanged throughout the parallel week. |

Hosting note: George's workflows live on **n8n-staging** today. This plan cuts over on staging (where the live chain actually runs) and treats the move to `n8n-prod.team-group.com` as a separate step after retirement (§5), so only one thing changes at a time.

---

## 1. Day 0 — add the Router path in parallel (no behaviour change yet)

Edits in `J7RU99n01pq9Xk3D` (George, with Binns on the call):

1. **Import** `12_Forms_CloseJrTask` and `00_EFX_Router` (prod-tier copies: `<<TIER>>=prod`, `<<EFX_SCRIPT_ID>>` = prod API-executable value, credential `EFX Google SA (prod)`) into the Team Group project if not already there.
2. Add an **Execute Workflow** node `Close Forms JR task (EFX)` → workflow `12_Forms_CloseJrTask`, input `{ "idOrWorkflow": {{ $('Find Row by Employee').first().json.portalTicketId }}, "notes": "JR title verified & assigned via n8n (BOSS ok)" }`. Wire it on the **success** output of `Assign JR in BOSS` (the handover doc flagged that the old close was not coupled to BOSS success — fix that here).
3. Keep `Mark Portal JR Complete` (doPost @76) connected **after** the new node, in series: Router first, doPost second. During the parallel week the second call returns `{"success":false,"message":"No open JR Title task …"}` when the Router already closed it — that is the expected "already closed" no-op and proves both paths reach the same task. Set the doPost node's *Continue on fail* so its no-op never breaks the run.
4. Add a **Set/IF** after the Router node: if `ok !== true` and `error.code !== 'E_ALREADY_CLOSED'` → route to `Email George - Error` with the `requestId` and `error.message` (fail loud; spec 12 §3).
5. Save. Do **not** change the webhook path, the BOSS nodes, or the Gmail nodes. Activate (it stays the only owner of `boss-assign`).
6. Smoke without a hire: `12_Forms_CloseJrTask` manual run with `idOrWorkflow:"TK-DEADBEEF"` → `E_NOT_FOUND` through the prod door (proves credential + deployment; touches nothing).

Rollback (minutes): delete the two new nodes, re-wire `Mark Portal JR Complete` where it was, Save. Or re-import the G6 export.

## 2. Parallel-run week (Day 1–7)

Per real JR event, check (Binns, daily; 5 min):

| Check | Where | Pass |
|---|---|---|
| Router closed the task | `Action Items` (prod sheet): `jr_title` row `Closed`, `Closed By = efx-bot@team-group.com`, `Completed Date` ≈ BOSS success time | yes |
| doPost saw it already closed | J7RU99 execution → `Mark Portal JR Complete` output `success:false, message: No open JR Title task…` | yes (or `success:true` if the Router path failed — then investigate the Router node output) |
| No double-close / wrong task | exactly one `jr_title` row per workflow touched; `review_306090` for the same workflow untouched | yes |
| Canary | `30_EFX_Canary` (prod) green all week | yes |
| Latency | Router path < 10 s per execution (Execution API 6-min cap is far away) | yes |
| George's inbox | `Confirm to George` still arrives; no new error emails except deliberate | yes |

Exit criteria for the week: ≥ 2 real JR events (or 1 real + 1 synthetic via `sdRunJrTitleE2E(false, true)` on **dev**, never prod) all closed by the Router; zero cases where only doPost closed the task. If a Router-path failure occurs: leave both nodes, fix, extend the week by the days lost. If a failure is structural (DWD, quota, deployment): §4 rollback, no time pressure — doPost still closes tasks.

## 3. Day 8 — remove the legacy hop from the workflow

1. Disable (not delete) `Mark Portal JR Complete` in `J7RU99n01pq9Xk3D`; Save. (Disabled node = one-click rollback.)
2. Watch the next real JR event: Router-only close, task `Closed` by `efx-bot`.
3. Day 15 (one more clean week): delete the node. Export the final JSON to `team-group-n8n-workflows`.

## 4. Rollback at any point

| Situation | Action | Time |
|---|---|---|
| Router path failing, doPost still present (Day 0–7) | nothing to do — doPost closes the task on the same run; fix Router at leisure | 0 |
| Router path failing after Day 8 | re-enable `Mark Portal JR Complete` (still points at @76 with the secret in the body; @76 untouched) | 2 min |
| Prod Forms alias layer broken (e.g. `n8n_closeJrTask` throws for every call) | re-enable doPost node (independent code path `jrCompleteViaSecret`) **and** roll the portal deployment back to the anchor version if the portal is affected (`clasp deploy -i <PORTAL_DEPLOYMENT_ID>` pinned) — the doPost branch exists in both old and new code | 5–10 min |
| Task closed twice / wrong task | impossible by construction (`efxTaskClose` requires an Open row and returns `E_ALREADY_CLOSED`), but if seen: reopen via dashboard admin (`reopen`/edit) and stop the parallel run | — |
| @76 accidentally archived (happened 2026-08-07) | re-mint per memory note (manifest flip to `ANYONE_ANONYMOUS`, `clasp deploy -d "JR AUTOMATION DO NOT REMOVE"`, revert manifest, `clasp push`) and re-point the node — **only if we are still before retirement** | 15 min |

## 5. Retirement (after Day 15, all clean)

Order matters: n8n first, then Forms, then AWS, then secrets — each step leaves the previous one still reversible.

1. **n8n**: `Mark Portal JR Complete` deleted (§3). Confirm no other workflow references `AKfycbw7fhvI…` (search workflows for `AKfycbw7fhvI` and `completeJrTitle`; the 2026-08 clones `FSX2QncvHA8MoMeu` (inactive original), `yFfGBQFG7COFDOjk`/`gGczToSKhIHyOaIE`/`nM5Oqrx3a0eEl4t0` were deleted per memory — verify).
2. **Forms prod script**: Deploy → Manage deployments → **archive** `AKfycbw7fhvI…` @76 ("JR AUTOMATION DO NOT REMOVE" — update the description first to "RETIRED <date>" so the name stops lying) and the stray `AKfycbwAb33u…` @75 (domain-401, from the failed un-archive). Leave the portal `AKfycbyXp4q0…` alone. Probe: `curl -L -X POST <@76 url> -d '{"secret":"WRONG"}'` → 404/HTML, no longer `Unauthorized` JSON.
3. **Forms code** (next release, not same day): remove the `doPost` JR branch in `Router.js` and `jrCompleteViaSecret` in `Services/ActionItemService.js`; keep `completeMyTask`/`completeJrTitleForWorkflow` for humans and SuperDebug. Delete Script Property `PORTAL_SHARED_SECRET` (`PropertiesService…deleteProperty`, or a `clearPortalSecret()` setter if added). Update `__tests__/HANDOVER_JR_CLONE.md` → point to `CUTOVER_PLAN_JR.md` (the corrected copy lives in `spec/corrected-docs/HANDOVER_JR_CLONE.v2.md`).
4. **AWS** (account `185303224100`, us-east-1; needs an operator with Lambda/IAM/Secrets rights; none of this is in Terraform — click-ops or CLI):
   - Lambda `portal-complete-jr-item`: `aws lambda delete-function-url-config --function-name portal-complete-jr-item` then `aws lambda delete-function --function-name portal-complete-jr-item`; delete its IAM role if dedicated (`aws iam list-attached-role-policies --role-name <role>` → detach → `aws iam delete-role`). Its CloudWatch log group `/aws/lambda/portal-complete-jr-item` can be set to 30-day retention and left to expire. **Do not touch** `boss-jr-assign` or API GW `ik2ur9kika` — those are George's live BOSS path.
   - Secrets: `aws secretsmanager delete-secret --secret-id n8n/portal-automation/george-cookies --recovery-window-in-days 30` (George's personal Google cookies — the anti-pattern; he should also revoke that browser session in his Google account) and `aws secretsmanager delete-secret --secret-id n8n/portal-complete-jr/webhook-secret --recovery-window-in-days 30` (copy of `PORTAL_SHARED_SECRET`; only after step 3 removed the property). The 30-day window is the rollback.
5. **Docs**: memory `jr-portal-automation-endpoint` → mark retired; `docs/plans` status line; `team-group-n8n-workflows` export of the final `J7RU99n01pq9Xk3D`.
6. **Later, separately**: swap the Gmail-regex trigger in `4InJ9cdAr5YxVgoT` for `20_Forms_EventsPoller` `task.created {formType:'jr_title'}` (spec 12 §4), and move George's workflows to `n8n-prod.team-group.com` with the prod-tier credential — each its own parallel run.

## 6. Communication

- Day −1: message George: what changes (one node, wired on BOSS success), what he'll see (`Closed By` becomes `efx-bot@team-group.com` instead of `JR Automation (n8n)`; a second "No open JR Title task" line in his execution for a week — expected), and that nothing on the BOSS side moves.
- Day 8 and Day 15: one-line status to George + HR ID-Setup lead (they see `Closed By` in the dashboard).
- Any rollback: tell George within the hour; his manager-approval emails keep flowing either way because the trigger hop is untouched.

## 7. Facts assumed here that must be re-verified on cutover day

- `J7RU99n01pq9Xk3D` is still the active owner of webhook `boss-assign`, and its `Mark Portal JR Complete` node points at the @76 URL (not the dead `AKfycbzWms2w…`) — the n8n API key expired 2026-08-30 so this was last confirmed by memory, not live.
- `jrCompleteViaSecret` still sets `closedBy = 'JR Automation (n8n)'` (used in the §2 "who closed it" check).
- ~~The `12_Forms_CloseJrTask` wrapper's input field names~~ — confirmed against the exported wrapper: inputs are `idOrWorkflow`, `notes`, plus optional `actor`, `idempotencyKey`, `treatAlreadyClosedAsSuccess` (default true). A paste-ready replacement node for *Mark Portal JR Complete* (with the sticky explaining the wiring) is `n8n/snippets/George_MarkPortalJrComplete_replacement.json`; its `<<CLOSE_JR_TASK_WORKFLOW_ID>>` is the id n8n gives `12_Forms_CloseJrTask` on import.
- Whether the tracker sheet's `portalTicketId` is a `TK-…` or `NEW_EMP_…` value on current rows (`n8n_closeJrTask` accepts both; `TK-` prefix → by task id, else by workflow id + `jr_title`).
