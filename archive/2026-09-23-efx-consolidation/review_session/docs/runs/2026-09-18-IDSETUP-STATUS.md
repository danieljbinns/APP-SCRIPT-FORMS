# ID Setup — where it stands, and what to test  (2026-09-18, end of day)

---

## The deliverable is proven

`Forms · Submit ID Setup` works end to end through the real chain:

```
HTTP → n8n → EFX Router → Google SA (as efx-bot) → Apps Script Execution API → Forms
```

| Step | Result |
|---|---|
| `n8n_createInitialRequest` via the Router | `NEW_EMP_20260918-155808_686`, employee **500024**, allocated by `efx-bot` |
| `n8n_submitIdSetup` via the Router | `ok:true`, *"Employee ID setup completed successfully"*, `REQ-1D5EDBC4` |
| Verified on the TEST sheet | workflow `In Progress`, `safety_onboarding` task **Open** |

That safety task appearing is **correct** — it matches decision D3 (Safety Onboarding is created at
ID Setup for an hourly hire with no system access). Not a side effect; the documented behaviour.

**So the handover shape for ID Setup is identical to the JR close:** one shared wrapper, called as a
sub-workflow, credential never leaves our side.

---

## The approval gate is a *sample*, not a deliverable

`DEMO · Initial Request → manager approval → ID Setup (PROPOSED)` models a flow that does not exist
today: draft the accounts, email the manager, let them edit or accept, then submit.

It is worth showing George as **one way** to reach the wrapper — but it should be handed over
explicitly as an illustration, with these gaps stated:

- **No reject path.** The only outcome is approve. A real gate needs reject, and probably a reason.
- **No timeout, no reminder, no reassignment** if the manager never responds.
- **`Draft accounts` is a placeholder.** It invents SiteDocs/DSS values locally. Making it real means
  replacing that one node with actual SiteDocs and DSS calls.
- **It is currently broken after the approval** — see the finding below. Fine as a picture of the
  idea; not something to build on as-is.

**Recommendation for the handover:** give him the standalone wrapper as the deliverable, and the
approval flow as a labelled sample to rebuild from, not adopt.

---

## Four things found by running it — none of which a code review would have caught

The demo had never been executed. All four appeared on first contact.

### 1. The approval link pointed at `localhost`

`{{ $execution.resumeUrl }}` is built from the n8n instance's configured base URL, which is **unset**
on this deployment — so the emailed link came out as
`http://localhost:5678/webhook-waiting/…`, unclickable from anywhere but the server.

**This affects any workflow on this n8n that emails a Wait-for-form link, not just ours.**

- *Proper fix:* set `WEBHOOK_URL=https://n8n-staging.team-group.com` on the n8n service. Infrastructure
  change, affects the whole instance.
- *Applied now:* rewrite it at the point of use —
  `{{ $execution.resumeUrl.replace('http://localhost:5678', 'https://n8n-staging.team-group.com') }}`.

### 2. Pre-wait node data is gone after the form resumes  ← this is what blocks the demo

After the manager submits, `Build ID Setup` fails with **"Node 'Draft accounts' hasn't been executed"**.
The execution resumes with only the Wait node's own data; everything before the wait is unavailable
to `$('…')`.

Two ways out, neither applied yet:

- Set `EXECUTIONS_DATA_SAVE_ON_PROGRESS=true` on the instance so intermediate data survives a wait.
  Correct, but an instance-wide setting with a write cost.
- Restructure so nothing pre-wait is needed afterwards — carry the drafted values *through* the form,
  or re-derive them after resuming.

This is the one real blocker, and it is a property of the pattern, not of our wrapper.

### 3. The form showed the manager nothing

`formDescription` used `{{ $json.* }}`, but at the Wait node `$json` is the **Gmail node's output**
(message id, thread id) — not the drafted accounts. Every value rendered blank, so the manager would
have been approving three empty boxes.

Present in the original, never noticed because the form had never been opened. Fixed by referencing
`$('Draft accounts')` explicitly. Also made `SiteDocs Job Code` a dropdown of the six valid codes —
it was free text against a strict enum, so a typo would have returned `E_VALIDATION`.

### 4. Edits to the Gmail nodes were being silently discarded

Every attempt to change those nodes returned **HTTP 200 with nothing changed**. Cause: they bound the
`Gmail account` credential, which lives in the **Team Group** project, while the workflow lives in the
personal project. n8n honours a pre-existing binding but rejects any write that re-establishes it —
silently on an in-place edit, and only errors explicitly once the node is given a new id.

Repointed to `Gmail - dbinns (EFX TEST)`. **Consequence: those two emails now send from
`dbinns@team-group.com` rather than `no-reply@`.**

> **Carry this forward.** The three `DEMO · JR` workflows still bind that Team Group Gmail credential.
> They work today only because the binding predates the project move. The next time anything rewrites
> those nodes, they will fail the same way.

---

## State right now

**Active**

- `EFX · Router`, `Forms · Close JR Task`, `Forms · Create Initial Request`, `Forms · Submit ID Setup`
- `DEMO · JR 1 / 2 / 3` — the JR chain, proven end to end earlier today

**Off, deliberately**

- `DEMO · Initial Request → manager approval → ID Setup` — blocked on finding #2
- `EFX · Test Trigger (API)` — the secret-protected backdoor, back off as it should be
- The canary, the events poller, and the remaining wrappers

---

## What to test when you're back

**1. The deliverable — 2 minutes, nothing to fix first.** Already passed once as described above; run it
again if you want to see it live. It needs the `EFX · Test Trigger` switched on, and switched off after.

**2. The approval gate — only if you want to see the idea.** It will reach the form and the form now
renders correctly; it will fail immediately *after* you submit, on finding #2. Seeing that failure is
arguably the useful part: it is the thing to tell George to design around.

**3. Decide the two instance settings.** `WEBHOOK_URL` and `EXECUTIONS_DATA_SAVE_ON_PROGRESS` are both
n8n service config, both affect every workflow on the box, and both are somebody's call — not mine.

## Test data created today

TEST tier only. Employees `500021`–`500024`, workflows `NEW_EMP_20260918-1550…` through `…-155808_686`,
plus the JR chain's `NEW_EMP_20260918-144101_079` (Diamond Daniels). All disposable.
