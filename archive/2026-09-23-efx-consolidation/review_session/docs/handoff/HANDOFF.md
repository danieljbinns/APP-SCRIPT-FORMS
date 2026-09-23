# HANDOFF — replacing `Mark Portal JR Complete`

*For George and whoever (or whatever) edits his workflows. Everything needed to make the change,
verify it, and undo it.*

Status at time of writing: **proven on a test tier, not yet applied to anything George owns.**

---

## 1. The change, in full

**Exactly one node changes** in `BOSS JR Assignment` (`J7RU99n01pq9Xk3D`): the final
`Mark Portal JR Complete`.

| | Before | After |
|---|---|---|
| Node type | `httpRequest` | `executeWorkflow` |
| Target | `https://script.google.com/macros/s/AKfycbw…/exec` | sub-workflow **`Forms · Close JR Task`** |
| Auth | shared password in the JSON body | Google service account (n8n credential) |
| Identity recorded | none | `efx-bot@team-group.com`, plus whatever `actor` you pass |
| Address stability | new deployment = new URL | permanent script id; redeploys cannot move it |

Everything upstream of that node is untouched.

## 2. How this is delivered — you are not given files

There is no repo to clone and nothing to import. The moving parts live in **Daniel Binns' n8n**, and
you are given **read-only** access to them.

| Thing | Who owns it | What you do with it |
|---|---|---|
| **`EFX · Router`** | Binns | Nothing. You never call it directly. |
| **`Forms · Close JR Task`** | Binns | Your workflow calls it as a sub-workflow, by id. |
| The Google service-account credential | Binns, inside the Router | **Nothing — you never hold it.** |

**You may copy the shared workflows to read them. Do not run production on a copy.** A copy has no
credential attached, so it cannot work; and the credential is deliberately not shared, because
holding it would let any workflow call the Forms app directly and bypass every guard in the Router.

That is the point of the design: **you get the ability to make one specific call, not a key to the
building.**

This was verified, not assumed: a workflow in a *different* n8n project successfully called
`Forms · Close JR Task` and got a correct `E_NOT_FOUND` back for a bogus task id — with **no Google
credential anywhere in the calling project**.

### What Binns has to do once, per workflow of yours

`Forms · Close JR Task` defaults to "callable only by workflows with the same owner", so a call from
your project is refused with *"The sub-workflow … cannot be called by this workflow"*.

Binns sets the sub-workflow's **caller policy** to an allow-list naming your workflow id. If you see
that error, it is this — send him the workflow id, it is a 30-second change on his side.

## 3. Order of operations

1. **Binns** shares `Forms · Close JR Task` with you read-only and adds your workflow id to its
   caller allow-list.
2. **You** change one node in `BOSS JR Assignment`: `Mark Portal JR Complete` becomes an
   `executeWorkflow` node pointing at `Forms · Close JR Task`, with the field mapping in §4.
   **Keep a copy of the old node** before you replace it — that is your rollback.
3. Run one JR end to end and confirm the task closes in the portal.

**Gotcha:** n8n keys nodes by `id` and will **silently ignore** a change of node `type` on an existing
node — the API returns 200 and nothing changes. Delete the old node and add the new one, rather than
editing the existing one in place.

## 4. What the node expects and returns

Inputs (all optional except the first):

| Field | Meaning |
|---|---|
| `idOrWorkflow` | The task id (`TK-…`) **or** the workflow id (`NEW_EMP_…`). Either works. |
| `notes` | Free text written to the task's completion notes. |
| `actor` | `{id, email, display}` — recorded as `Closed By`. Attribution only; it cannot grant permission. |
| `idempotencyKey` | Safe-retry key. |
| `treatAlreadyClosedAsSuccess` | Default `true`. Leave it on. |

The mapping to set on the node (these are the exact expressions used in the proven run):

```
idOrWorkflow                 {{ $('Find Row by Employee').first().json.portalTicketId }}
notes                        JR title verified & assigned in BOSS
actor                        {{ { "id": "n8n:boss-jr",
                                  "email": "boss-jr-automation@team-group.com",
                                  "display": "BOSS JR Automation" } }}
idempotencyKey               {{ $('Find Row by Employee').first().json.portalTicketId }}
treatAlreadyClosedAsSuccess  true
```

On success the envelope is **flattened** — `taskId`, `workflowId`, `success` sit at the **top level**,
not under `.result`. Anything written against a direct Execution API call will break here.

## 5. Errors

The Router throws on failure, so the execution fails in n8n and routes to the error workflow.

**Branch on the `[efxCode=…]` tag at the end of the message.** Do *not* branch on a leading
`EFX E_…:` prefix — n8n strips it, and when the message contains JSON it splits mid-payload.

Codes worth handling: `E_ALREADY_CLOSED` (treat as success — the node does this for you by default),
`E_NOT_FOUND` (check the id, don't retry), `E_TASK_NOT_OPEN` (the workflow was cancelled — **not** a
success), `E_DISABLED` (an administrator switched this off — see §7), `E_VALIDATION` (fix the mapping).

Full table: ask Binns for the EFX error-code reference (`FOR_GEORGE.md` §6).

## 6. Rollback

Under a minute, no coordination needed:

1. Put the old `httpRequest` node back — the one you kept a copy of in §3 — with its `/exec` URL
   and password.
2. Everything else is untouched, so nothing else needs reverting.

The old endpoint is **not** being switched off as part of this change. Both paths work during
overlap. Retire the old one only once you're satisfied.

## 7. The kill switch — so a failure isn't a mystery

An administrator can disable any form or alias **from the Apps Script side**, without touching n8n,
via the `EFX_ALIASES_OFF` / `EFX_ALIASES_ON` Script Properties.

If that happens, calls return **`E_DISABLED`** and the message names what matched. That is deliberate
and it is not a fault in George's workflow — ask whoever administers the Forms app.

## 8. What stays the same — do not "improve" these

- The Gmail trigger, the parsing, the JR Index lookup, the approval template, the tracking sheet.
- The BOSS assignment (`boss-jr-assign` Lambda) and its session cookie.
- Every email and every recipient.
- All permission rules. They live in Forms and are enforced against the real signed-in principal, not
  against the `actor` field.


## 8b. The second wrapper — `Forms · Submit ID Setup`

Identical in shape to the JR close. Your workflow calls it as a sub-workflow; it submits the
Employee ID Setup step into Forms.

| Field | Meaning |
|---|---|
| `workflowId` | The hire's workflow id (`NEW_EMP_…`). Required. |
| `siteDocsWorkerId` | Required. |
| `siteDocsJobCode` | Required. **Strict enum**: `Hourly 1`, `Hourly 2`, `Salary 1`, `Salary 2`, `Supervisor`, `Manager`. Anything else returns `E_VALIDATION`. |
| `dssUsername` / `dssPassword` | Required. |

On success Forms replies *"Employee ID setup completed successfully"*, and — for an hourly hire with
no system access — creates the **Safety Onboarding** task. That task appearing is the reliable sign
the step actually landed.

**An approval gate before this is optional and is yours to design.** We built one as an illustration
(email the manager, wait for a click, then submit) and it works, but it is deliberately minimal:
no reject path, no timeout or reminder, and the account values are invented locally rather than
drafted from SiteDocs and DSS. Treat it as a sketch of the idea, not a component to adopt.

## 9. The same pattern for everything else

This is not a one-off arrangement for the JR close. **Binns owns every EFX workflow and shares them
read-only**; the service-account credential stays on his side in all cases.

| Available now | Status |
|---|---|
| `Forms · Close JR Task` | Proven end to end, ready to hand over |
| `Forms · Submit ID Setup` | Proven end to end, ready to hand over |

There are ~25 further wrappers built against the same Router (create a hire, submit HR verification,
list tasks, cancel a workflow, and so on). They are **not** being handed over yet — each gets proven
the same way first. If you need one, ask; the work is enabling and testing it, not building it.

The rule stays the same for all of them: you call a shared sub-workflow by id, Binns adds your
workflow to its caller allow-list, and the credential never leaves his project.

---

# Discovery — things we found in the *existing* setup

**None of these are caused by the change above.** They were found while testing around it, and they
are George's to triage or ignore. Recorded because they cost real time to discover.

### Silent failure modes

- **Nothing is wired to an error workflow.** `BOSS JR Assignment`, `JR Assignment Automation` and
  `JR Approval — Manager Response Handler` all have bare `settings` — no `errorWorkflow`. Failures
  appear in the executions list and nobody is told. There is already an active
  `Error Notifications - Global Handler` to point at; it is a one-field change per workflow.
- **The BOSS session cookie never refreshes.** `boss/session-cookies` in AWS Secrets Manager holds a
  single `PHPSESSID`, no expiry, rotation disabled, and no scheduled job renews it (the existing
  `cookie-refresher` schedules are for Looker and the printing bot). When it dies, JR assignment stops
  — quietly. Last renewed by hand.

### Duplicate execution

- **Both approval buttons fire twice.** Observed live on 2026-09-18: JR 2 ran at 18:53:43 *and*
  18:53:50; JR 3 at 18:55:17 *and* 18:55:30. Cause is a double-click or a mail client prefetching the
  link — normal, and it will happen to real managers.
- It was harmless *this time* because BOSS reported `alreadyAssigned` and the portal close returned
  `E_ALREADY_CLOSED` and was treated as success. Worth knowing the protection is doing real work.

### Data gaps that will bite

- **The JR email carries no BOSS user id.** The parser has nowhere to get one, so `bossUserId` in the
  tracking sheet is blank and the Lambda falls back to matching `"Lastname, Firstname"` on the BOSS
  job page. If a name doesn't match BOSS exactly, the assignment fails with
  *"Could not find … on BOSS"*.
- **Only 37 of 86 JR templates have a BOSS job id** in column F of the Index sheet. A JR for any of the
  other 49 fails at `Lookup BOSS Job ID` with *"Unknown job title"*. Worth filling in, or worth a
  friendlier error.

### Security exposure

- **Two plaintext shared secrets sit in node parameters** — the BOSS Lambda's `x-boss-secret` header
  and the Apps Script portal password. Both should be n8n credentials rather than fields in a node.
  The change above removes the second one from this workflow.
- **Both Lambdas have public Function URLs with `AuthType: NONE`** — `boss-jr-assign` and
  `portal-complete-jr-item` are invokable from anywhere on the internet, protected only by that header
  secret. Worth noting: the account now **blocks** creating new public Function URLs, so these are
  legacy exposure that could not be created today.

### Dead weight

- **`portal-complete-jr-item` is no longer called by anything.** It is a 73MB Lambda running headless
  Chromium to drive the portal with borrowed Google cookies — the generation before the current
  `/exec` call. Safe to retire.
- **A landmine on the current endpoint:** the `@75` anonymous deployment must never be re-versioned
  ("edit deployment → set latest version"). Its HEAD manifest is `DOMAIN`, so re-versioning flips it to
  login-required and breaks the anonymous POST — i.e. it breaks George's automation. Documented in the
  prod runbook; repeating it here because it is easy to do by accident.
- **The runbook's URL is out of date.** It records the `@75` endpoint as one deployment id, but the
  live workflow posts to a **different** one. Either it was redeployed since, or the doc is stale —
  either way, don't trust the doc over the workflow. (Ids deliberately not reproduced here.)
