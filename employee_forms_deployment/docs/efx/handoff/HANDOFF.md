# HANDOFF — George's hourly onboarding through the Employee Forms door

*For George and whoever (or whatever) edits his workflows. Everything needed to build it, verify it, undo it.*

Status at time of writing (2026-09-23): **live in production.** Portal on v78, doors open, reference workflow
built against production and ready to copy. JR swap is second, §7.

---

## 1. Your flow, and what each step uses

| # | Your step | What you use | Status |
|---|---|---|---|
| 1 | Know a hire was submitted | The `ID Setup Required` email. You are a member of `grp.forms.idsetup` as of 2026-09-23. | live |
| 2 | Read the internal employee number | It is **in the email** (Request Details → *Internal ID*). Also `Forms · Get Workflow (PROD)` → `employeeId.internalEmployeeId`. | live |
| 3 | Draft SiteDocs / DSS / BOSS and send your approval email | Your workflow. The reference workflow shows one way. | yours |
| 4 | On approval, do the real setup | Your workflow. Unchanged. | yours |
| 5 | Submit ID Setup back into Forms | `Forms · Submit ID Setup (PROD)` | live |
| 6 | Close a task | `Forms · Close Task (PROD)` for any action item; `Forms · Close JR Task (PROD)` for JR (§7). `Forms · List Tasks (PROD)` to find them. | live |

Nothing else changes. Humans still submit the initial request in the portal; that is by design.

## 2. The trigger: the email

At submit, Forms sends two emails built from the same data:

| Subject | To | Has the form button |
|---|---|---|
| `ID Setup Required` | `grp.forms.idsetup@team-group.com` (you) | yes → `…/exec?form=id_setup&wf=NEW_EMP_…` |
| `Request Submitted` | the requester | no |

Both carry, in the **Request Details** section: `Employee`, `Request ID` (`NEW_EMP_…`), `Internal ID` (4–6 digits),
`Type` (Hourly · Direct Hire), `Job Title`, `Site`, `Start Date`, `Manager`, `Requested By`.

Parse either. The reference workflow uses, on the stripped text of the HTML:

```
Request ID:   /[?&]wf=(NEW_EMP_[A-Za-z0-9_-]+)/   (button URL)   else   /Request ID\s*(NEW_EMP_[A-Za-z0-9_-]+)/
Internal ID:  /Internal ID\s*(\d{4,6})\b/
```

The `ID Setup` section of that email says *In Progress* until the step is actually done — the Internal ID being
present does **not** mean ID Setup happened.

Dedupe: if the same mailbox is both requester and in the group it gets both emails. Key on the Request ID.

## 3. The doors (production)

All are sub-workflows in Binns' n8n. Call them with an **Execute Workflow** node, by id. `callerPolicy` is `any`
on every one, so there is **no allow-list step** — the earlier version of this document said Binns had to add
your workflow id; that is no longer true.

| Sub-workflow | id | Inputs | Returns (flattened, top level) |
|---|---|---|---|
| `Forms · Get Workflow (PROD)` | `A7nqVbqn19kzaSfi` | `workflowId` | `requestData{}` (sheet headers as keys: `First Name`, `Employment Type`, `Position Title`, `Site Name`, `Internal Employee ID`, …), `employeeId{workflowId, internalEmployeeId}`, `checklist[]`, `status`, `type` |
| `Forms · List Tasks (PROD)` | `5HoAXNxCWVF6wtYx` | any of `workflowId`, `taskId`, `formType`, `status`, `assignedTo` | `tasks[]` (`taskId`, `workflowId`, `formType`, `status`, `assignedTo`, `name`, `description[]`, `closedBy`), `count` |
| `Forms · Close Task (PROD)` | `C4oJSaevEqMvSCZe` | `taskId` **or** `workflowId`+`formType`; optional `notes`, `checklist{}`, `formData{}`, `dryRun` | `taskId`, `workflowId`, `success`; with `dryRun:true` → `wouldClose`, no write |
| `Forms · Submit ID Setup (PROD)` | `P3HiVnzoxaRYYTZN` | required `workflowId`, `siteDocsWorkerId`, `siteDocsJobCode`, `dssUsername`, `dssPassword`; optional `siteDocsUsername`, `siteDocsPassword`, `setupNotes`, `bossWisCreated`, `siteDocsBadgeCreated` | `success`, `message` ("Employee ID setup completed successfully") |
| `Forms · Close JR Task (PROD)` | `zxaTLTTNK28LpnNg` | `idOrWorkflow` (`TK-…` or `NEW_EMP_…`), `notes` | `taskId`, `workflowId`, `success`; `alreadyClosed:true` on a repeat |

Every one also accepts `actor` (`{id, email, display}` — recorded as *Submitted By* / *Closed By*, attribution only,
grants nothing) and `idempotencyKey` (safe retry within 10 minutes). Closers accept `treatAlreadyClosedAsSuccess`
(default true).

`siteDocsJobCode` is a **strict enum**: `Hourly 1`, `Hourly 2`, `Salary 1`, `Salary 2`, `Supervisor`, `Manager`.
**Never pass `internalEmployeeId`** to Submit ID Setup — it is pre-assigned; a different value is refused.

### Gotcha that cost us an hour — read this

The **Execute Workflow node must be typeVersion 1.2**, and the item feeding it should carry **exactly the input
names** the sub-workflow declares. At 1.1 the node silently ignores the field mapping you type and passes the
incoming item's fields by name — so a stray `status` field from the previous node became the task filter and
List Tasks returned nothing. Put a small Code node right before each call that outputs only the declared inputs.
The reference workflow does this everywhere.

## 4. What comes back, and errors

Success: the alias result **flattened** to the top level plus `ok:true, fn, requestId, apiVersion, tookMs`.
There is no `.result` wrapper. Anything written against a direct Execution API call breaks here.

Failure: the Router **throws**, so the node errors. Use *On Error → Continue (using error output)* and branch on
the **`[efxCode=…]` tag at the end of `error.message`**. Do not branch on a leading `EFX E_…:` prefix — n8n strips
it and splits the message when it contains JSON.

| Code | Meaning | Do |
|---|---|---|
| `E_VALIDATION` | bad field (`error.fields[]` says which) | fix the mapping; no retry |
| `E_NOT_FOUND` | workflow not found / no open task of that type | check the id; no retry |
| `E_ALREADY_CLOSED` | task already closed | success (closers do this for you) |
| `E_TASK_NOT_OPEN` | task or its workflow is Cancelled | **not** a success; no retry |
| `E_UPSTREAM` | Forms refused (message passed through, e.g. "already submitted") | read the message |
| `E_FORBIDDEN` | efx-bot lacks the role for that alias | tell Binns |
| `E_DISABLED` | an administrator switched the alias/form off (kill switch, §8) | ask the Forms admin |
| `E_TRANSPORT` / `E_INTERNAL` | plumbing | retry once after a minute; then send the `requestId` |

## 5. The reference workflow — your template

`DEMO · ID Setup from submit email (Binns' inbox) (PROD)` — id `52DqtvlqJgO0ABL5`. Exported with credentials
removed as `template_IdSetup_from_submit_email_PROD.json` in this folder. A second copy triggered from your
inbox exists in the Team Group project as `etvSuKXluKGrNQAT` (switched off until you say so).

```
New submit email (Gmail trigger, every minute, subject filter)
→ Parse submit email (Code: Request ID, Internal ID, dedupe)
→ Forms · Get Workflow (PROD)
→ Draft accounts (Code: SiteDocs worker id, job code, DSS user + password — PLACEHOLDER values, stashed by execution id)
→ Email approver (one green button = the Wait node's resume URL)
→ Wait for approval (resume on webhook)
→ Build ID Setup (Code: read the stash, shape the exact inputs)
→ Forms · Submit ID Setup (PROD)
→ Confirm submitted            ↘ error outputs → Report error
```

To make it yours:

- **New submit email** → your Gmail credential. Keep the subject filter to `ID Setup Required`.
- **Email approver** → send to you (or the manager). Drop the cc.
- **Draft accounts** → your real SiteDocs / DSS / BOSS calls. Keep the output keys.
- Add what the sketch lacks: a reject link, a reminder, a timeout on the Wait node.

**The one structural difference from the earlier demo:** that one created the hire itself as a test fixture
(`Create Initial Request`). This one starts from the real submit email, which is your flow. Everything after the
draft is the same pattern.

## 6. Verify

1. Switch your copy on. Have someone submit a hire in the portal (or ask Binns to submit a `Demo Hire`).
2. Your approval email arrives within a minute of the `ID Setup Required` email.
3. Click. In the portal the hire moves to **HR Verification Needed**; for an hourly hire with no system access the
   **Safety Onboarding** task appears. That task is the reliable sign the step landed.
4. Read-only checks any time: `Forms · Get Workflow (PROD)` / `Forms · List Tasks (PROD)`; `Forms · Close Task
   (PROD)` with `dryRun:true` writes nothing.

## 7. JR — the one-node swap

In `BOSS JR Assignment` (`J7RU99n01pq9Xk3D`) the last node `Mark Portal JR Complete` posts a shared password to
an `/exec` address. Replace it with the node in **`snippet_MarkPortalJrComplete_PROD.json`** (this folder): an
Execute Workflow call to `Forms · Close JR Task (PROD)` `zxaTLTTNK28LpnNg`, already mapped to your expressions:

```
idOrWorkflow                 {{ $('Find Row by Employee').first().json.portalTicketId }}
notes                        BOSS job / user ids from Assign JR in BOSS
actor                        { id:'n8n:boss-jr-assignment', email:'efx-bot@team-group.com', display:'BOSS JR Assignment (n8n)' }
idempotencyKey               jr-close-<portalTicketId>-<executionId>
treatAlreadyClosedAsSuccess  true
```

Steps: keep a copy of the old node · delete it (n8n ignores a change of node *type* in place) · paste the
snippet · wire `Apply Duty Changes → Forms · Close JR Task (EFX) → Confirm to George` and its error output to
`Email George — Error` · run one JR. Old rows without a `TK-` id: pass the `NEW_EMP_…` workflow id instead.

**Rollback:** put the old node back. The `/exec` endpoint (`@76`) stays up during the overlap.

`DEMO · Close JR Task via EFX (PROD)` — id `KDlp3JYyY2Q170gX` — is the same node behind a manual trigger, to
try by hand.

## 8. The kill switch

An administrator can disable any form or alias from the Apps Script side (`EFX_ALIASES_OFF` / `EFX_ALIASES_ON`
Script Properties). Calls then return `E_DISABLED` naming what matched. Not a fault in your workflow.

## 9. What stays the same — do not "improve" these

- How requests are submitted, reviewed or approved. The human submits; you run after.
- The BOSS assignment (`boss-jr-assign` Lambda) and its session cookie.
- Every email Forms sends and every recipient.
- All permission rules. They are enforced against the real principal (`efx-bot`), never against `actor`.

## 10. Delivery and access

- The doors and the Google credential stay in Binns' n8n. You call by id; `callerPolicy: any` means no allow-list.
- Read access to the wrappers will be shared to your project after the demo (viewer). Calling does not need it.
- Do not run production on a copy of a wrapper: a copy has no credential and cannot work, by design.

---

# Discovery — things found in the *existing* setup (unchanged since 2026-09-18)

None caused by the change above; yours to triage.

- **No error workflow** on `BOSS JR Assignment`, `JR Assignment Automation`, `JR Approval — Manager Response
  Handler`. `Error Notifications - Global Handler` exists; one setting each.
- **BOSS session cookie never refreshes** (`boss/session-cookies`, single `PHPSESSID`, no rotation). When it dies,
  JR assignment stops quietly.
- **Both approval buttons fire twice** (double click / mail prefetch). Harmless today because BOSS reports
  `alreadyAssigned` and the portal close returns `E_ALREADY_CLOSED`.
- **JR email carries no BOSS user id**; the Lambda falls back to name matching. **49 of 86 JR templates** have no
  BOSS job id in the Index sheet.
- **Two plaintext secrets in node parameters** (`x-boss-secret`, the portal password). Both Lambdas have public
  Function URLs with `AuthType: NONE`. The swap in §7 removes the second secret from your workflow.
- **`portal-complete-jr-item` Lambda** is dead weight; safe to retire.
- **Portal deployment labels lie:** `AKfycbyXp4q0…` (the users' portal, now v78) is described as "PROD JR portal
  automation endpoint"; `AKfycbwAb33…` @75 is a stray duplicate; `@76` is the real anonymous doPost. Do not
  re-version `@76`.
