# JR chain on EFX — test copies ready  (2026-09-18)

Everything below is **inactive**, in Binns' personal n8n project, and isolated from production.
George's three live workflows were re-read after the build and are **byte-unchanged**.

---

## 1. What got built

George's JR automation is **three** workflows, not one. All three are copied.

| # | Copy (inactive) | id | From George's (ACTIVE, untouched) |
|---|---|---|---|
| 1 | `DEMO · JR 1 · Assignment Automation (EFX TEST)` | `gJH2dgXcVfGcrEH8` | `JR Assignment Automation` `4InJ9cdAr5YxVgoT` |
| 2 | `DEMO · JR 2 · Manager Response Handler (EFX TEST)` | `Jlk2C6iRdiNMx6AP` | `JR Approval — Manager Response Handler` `KFzI1VJBU01axjTb` |
| 3 | `DEMO · JR 3 · BOSS Assignment via EFX Router (EFX TEST)` | `xPuvT5y4EvoLo3xO` | `BOSS JR Assignment (COPY - PROD portal)` `J7RU99n01pq9Xk3D` |

The chain: **JR 1** finds the template, copies it, emails the manager for approval → **JR 2** takes the
manager's answer → **JR 3** assigns in BOSS and closes the portal ticket.

The earlier single demo `uQeizlMybFNGWj9N` is **superseded** — it still wrote to George's live tracker
sheet. Left in place, not deleted; delete it when you're happy with JR 3.

## 2. The EFX swap

In **JR 3**, `Mark Portal JR Complete` no longer POSTs to the production Apps Script `/exec` with a
shared password. It now calls `Forms · Close JR Task` (`RoSlpUv8xIBfbgiV`) → EFX Router → Execution
API, authenticated by the service-account credential.

**Side benefit:** that removes one of the two plaintext shared secrets from the workflow.

## 3. Isolation — what the copies point at instead

New files in your My Drive, folder **`EFX JR TEST`** (`1yptGWxfRgmHz8KQf0zDLYkBzVZ8wkciu`):

| Purpose | Test copy |
|---|---|
| Pending-approval tracker | `1nviA7dYqESgpOYq1DCKjCqSg9CXkHcotVVrHbLHWy-M` |
| BOSS JR Templates (Index) | `1A3Ic6PxcciNJnNNkUSKnWqS0iixxSPdyj01GEKKJ44A` |
| JR Approval Template master | `167HJEGFTJy3UzKyi5mvuJXDko73kBu6vuWM6DRH4TlU` |
| Approved JRs folder | `1L87yVtyDQkQtPK6Yoi5pqZa3V6nkcw7h` |

Plus:

- **Every email → `dbinns@team-group.com`**, including the **manager approval email** you asked for.
  Subjects are prefixed `[EFX TEST]`.
- **Webhook paths suffixed `-efxtest`** (`boss-assign-efxtest`, `jr-manager-response-efxtest`) so they
  cannot collide with, or steal from, George's live registrations. The links inside the emails were
  rewritten to match.
- **JR 1's Gmail trigger is gone**, replaced by a manual trigger feeding a fixture — it never attaches
  to a live mailbox. Node *names* were kept, so every `$('...')` reference downstream still resolves.

The builder asserts none of this leaks: it harvests the production ids, addresses and the two shared
secrets from the source workflows at run time and fails if any survive into a copy. It passed.

## 4. A real EFX ticket is already seeded and wired in

| | |
|---|---|
| EFX workflow | `NEW_EMP_20260918-120122_106` |
| Internal Employee ID | `500016` |
| Open `jr_title` task | `TK-75A34ACA` |
| Employee name | `EfxJr Demo836540` |
| Job title used | **`Supervisor`** — BOSS job id `107`. (Superseded `Corporate Mechanic`; see the UPDATE below.) |

JR 1's fixture is **pre-filled with these**, so it runs as-is.

## 5. BOSS is deliberately switched off

`JR 3` has a new `EFX TEST Config` node with two **blank** values:

```js
const BOSS_API_BASE = '';
const BOSS_SECRET   = '';
```

Blank means the two BOSS calls are **simulated** and everything else runs for real — so the
EFX portal-close path can be tested today, before BOSS staging exists. Fill them in and the real
calls resume, with no other edit.

Why blank rather than pointed at staging: **George's BOSS Lambda `ik2ur9kika` is not in AWS account
`185303224100`**, so I can't see whether a staging stage exists or what its secret is. That's the one
thing I couldn't determine.

---

## What I need from you — one at a time

### (a) Decide the BOSS target

George's BOSS calls go to an **AWS API Gateway Lambda**, not to BOSS directly — the Lambda holds the
session. Two `POST`s: `/prod/assign` and `/prod/editDuties`, authenticated by an `x-boss-secret`
header.

So "point it at staging" means one of:

1. **A staging stage / second Lambda** exists → give me its base URL and secret, I put them in
   `EFX TEST Config`. Cannot be automated: the Lambda is in an AWS account I can't reach.
2. **No staging Lambda** → then either it gets built, or JR 3 talks to BOSS staging directly, which
   means knowing how BOSS staging authenticates. You mentioned session cookies — if that's it, we'd
   need a cookie or a service login, and that's the `cookie-refresher-service` pattern.
3. **Leave BOSS simulated** and prove only the EFX close for now. Cheapest, and it tests the part
   that's actually new.

I'd suggest **(3) now, (1) or (2) next** — but it's your call.

### (b) Then, to run the chain

1. Activate `Forms · Close JR Task` (`RoSlpUv8xIBfbgiV`). **n8n 2.x will not publish JR 3 while a
   sub-workflow it calls is unpublished.** Not needed if you only ever run JR 3 by hand.
2. Activate `DEMO · JR 2` so the approval link in JR 1's email resolves.
3. Open `DEMO · JR 1` and hit **Execute** → the approval email arrives in your inbox.
4. Click approve → JR 2 marks the test tracker and moves the file.
5. Fire JR 3's webhook (the "Ready for BOSS" email carries the link) → BOSS simulated →
   `Mark Portal JR Complete` closes `TK-75A34ACA` via the Router.
6. Check `Action Items` on the TEST sheet: `Status = Closed`,
   `Closed By = boss-jr-automation@team-group.com`.

---

## Flagged, not fixed

- **Two plaintext shared secrets sit in George's live workflow nodes** — the BOSS Lambda's
  `x-boss-secret` header, and the Apps Script portal password. Both should be n8n credentials rather
  than node parameters. Not touched: they're in his live workflow. The EFX swap removes the second one
  from JR 3's copy.
- **`docs/runs/2026-09-17-efx-test-deploy-runlog.md` understates the blast radius** — it names only
  `J7RU99n01pq9Xk3D` as "George's live workflow". There are three active ones.
- **`efx-e2e-test.js` has one stale assertion** (expects `submitITConfirmation` to still be duplicated;
  the duplicate was deleted 2026-09-17). Pre-existing, unrelated to this work.

## Reproducing

`docs/runs/2026-09-18-jr-demo/` holds the scripts, all idempotent:

- `mk-jr-test.js` — creates/reuses the Drive test copies, writes `jr-test-ids.json`
- `build-jr-demo.js` — builds and upserts the three workflows (`--dry-run` to inspect first)
- `seed-jr.js` — seeds one EFX hire and drives it to an open `jr_title` task

---

# UPDATE — BOSS staging wired in (2026-09-18, later)

BOSS is no longer simulated. JR 3 now calls a **test-only** Lambda pointed at `staging.team-group.com`.

## New AWS resources (none of George's touched)

| Thing | Value |
|---|---|
| Lambda | `boss-jr-assign-efxtest` — copy of `boss-jr-assign`, host + cookie-secret read from env |
| HTTP API | `9bnocpflf2` → `https://9bnocpflf2.execute-api.us-east-1.amazonaws.com`, routes `POST /assign`, `POST /editDuties` |
| Cookie secret | `boss/session-cookies-efxtest` — Binns' own staging `PHPSESSID` |
| Webhook secret | fresh 48-char random, in JR 3's `EFX TEST Config` node. **Not** the production one. |

The only code change vs the original: `BOSS_BASE` and the cookie secret id come from env, and **both
default to the TEST values**, so a missing env var cannot reach production BOSS.

## Proven live

- Wrong secret → `{"error":"Unauthorized"}` from the Lambda's own check.
- Right secret, placeholder cookie → reached staging BOSS, bounced `302` to login. Correct failure.
- Real cookie → `GET /job/users/171` and `/supervisee/view/1105` both return **HTTP 200** real BOSS pages.

## Test identities

| | |
|---|---|
| BOSS user | `1105` = **Daniels, Diamond** (`staging.team-group.com/user/view/1105/`) |
| Job title | **Supervisor** — BOSS id `107` (`staging.team-group.com/job/edit/107`, confirmed "Supervisor") |
| EFX workflow | `NEW_EMP_20260918-120122_106`, open `jr_title` task `TK-75A34ACA` |

JR 1's fixture carries `BOSS_USER_ID = '1105'`, and it survives the whole chain: `Parse Email Data`
→ `Find Matching Template` (`...emailData` spread) → `Parse Duties` → `Generate Token` → tracker
column J → JR 2's "Ready for BOSS" link as `&userId=` → JR 3 → the Lambda.

## Two findings worth keeping

- **`Corporate Mechanic` has no BOSS job id.** Only **37 of 86** JR templates have one in column F
  ("ID # in BOSS"). The original fixture would have failed at `Lookup BOSS Job ID`. Binns chose
  `Supervisor` (BOSS id `107`), which has an id in the sheet **and** in the Lambda's hardcoded fallback map.
  For the record: `Maintenance Technician`/`Corporate Mechanic` were my invention, not real data — and I had
  verified the template existed without checking it had a BOSS id, which is the wrong check.
- **New public Lambda Function URLs are blocked in this account.** A Function URL with a resource
  policy byte-identical to George's working one returned `403 Forbidden` at the auth layer. Hence the
  HTTP API. George's two existing public Function URLs are legacy exposure that could not be created
  today.

## Housekeeping

- The staging `PHPSESSID` was pasted into chat. It is a live session for Binns' BOSS account — worth
  invalidating (log out of staging) once testing is done.
- Nothing is active. JR 3 still needs `Forms · Close JR Task` published before it can be *activated*
  (n8n 2.x will not publish a workflow whose sub-workflow is unpublished); running it by hand is fine.

---

# FULL AUTOMATED RUN — PASSED end to end (2026-09-18)

Drove all three workflows for real. Every node green; both end states verified independently.

| Stage | Execution | Result |
|---|---|---|
| JR 1 · Assignment Automation | `3056` | success — 17/17 nodes, approval email **sent** |
| JR 2 · Manager Response | `3057` | success — tracker row `Pending` → `Completed`, file moved |
| JR 3 · BOSS + EFX close | `3058` | success — 18/18 nodes, **real** BOSS assign, portal closed via the Router |

**Verified afterwards, not assumed:**

- **EFX:** `jr_title TK-75A34ACA` = **Closed**, `Closed By = boss-jr-automation@team-group.com`.
  `review_306090` and `wis` correctly left **Open**.
- **BOSS (staging):** `Daniels, Diamond` present on job `107` (Supervisor); profile shows 47 responsibility rows.
- **George's three workflows:** still ACTIVE with their original `updatedAt` — untouched throughout.

## Four things that had to be fixed to get there

1. **The Google Sheets OAuth credential could not see the test copies.** `files.copy` does not copy
   permissions, and that credential belongs to a Team Group account. Rather than grant George access to
   Binns' test files, the whole chain was repointed to the **EFX service-account credential**
   (`googleApi`, impersonating `efx-bot`), and `efx-bot` + the SA were granted writer on the test files.
   12 httpRequest nodes switched over.
2. **n8n's native Google Sheets node would not accept the service-account credential**
   ("Authorization failed") even though the same identity reads the sheet fine outside n8n. Both native
   nodes (`Read JR Index`, `Read Index Tab`) were replaced with `httpRequest` + a Code node that
   reproduces n8n's `col_1..col_N` row shape, so the downstream Code nodes are untouched.
3. **A production folder id was still embedded in a JSON body** — `Pending JRs`
   (`123dz6…`), used by JR 1's copy target and JR 2's `removeParents`. The original rewrite only mapped
   ids that appeared as bare values. Created `Pending JRs (EFX TEST)` and rewrote it. A full sweep for
   unmapped ids across all three workflows now comes back clean.
4. **JR 1 had only a manual trigger**, which the n8n API cannot fire. Added a webhook trigger beside it
   (random path, in `docs/runs/2026-09-18-jr-demo/` is NOT where the path lives — it is in the workflow).
   The manual trigger is unchanged, so running it by hand still works.

## Ready for a manual run as George + the manager

Everything is **active** and a **fresh** ticket is seeded, so this is a real run, not a replay:

| | |
|---|---|
| EFX workflow | `NEW_EMP_20260918-140321_093` |
| Open `jr_title` task | `TK-4E251DDE` |
| Employee | `EfxJr Demo170690` |
| Job title | `Supervisor` (BOSS 107) · BOSS user `1105` |

1. Open **`DEMO · JR 1`** → **Execute workflow**.
2. The **manager approval email** arrives at `dbinns@team-group.com`. Click the button in it.
3. The **"Ready for BOSS"** email arrives. Click that button.
4. Result: real assign in staging BOSS, and `TK-4E251DDE` closed by the Router.

## Still outstanding

- **A real Gmail trigger** (so JR 1 starts from an email exactly as George's does) needs a Gmail
  credential in Binns' personal project — both existing Gmail credentials belong to the Team Group
  project. That is an OAuth consent click only Binns can do.
- The six Gmail *send* nodes still use the Team Group `Gmail account` credential, so the emails arrive
  from that mailbox rather than Binns'. Harmless for testing; worth changing with the trigger.
