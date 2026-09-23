# WF_TERMINATION — End of Employment

Workflow ID prefix `TERM_` · entry form `FORM_TERMINATION` · registry keys in [`../index.json`](../index.json)

Records what the code does. It makes no claim about whether that is correct or intended — that is
the maintainer's call, made when this flow is reviewed.

---

## Step sequence

| # | Step (`Current Step` value) | Who acts | Form | Opens when |
|---|---|---|---|---|
| 0 | `Initial Request` | ACTOR_REQUESTER (any domain user) | FORM_TERMINATION | always — this creates the workflow |
| 1 | `HR Approval Needed` | GRP_HR (Payroll is notified in advance) | FORM_TERM_APPROVAL | always, immediately on submit |
| 2 | `Action Items Pending` | per-task groups, in parallel | FORM_ACTION_ITEM | when HR **approves** and at least one task is created |
| 3 | `All Action Items Closed` → status `Complete` | system | — | when no blocking task is still open |

**Rejection path:** if HR rejects, status → `Rejected`, step → `Rejected by HR`, and the requester and
manager are told. No tasks are created and the workflow ends there.

**Edge case:** if approval produces no tasks at all, the step is set to `Processing` rather than
`Action Items Pending`.

---

## Step 0 — Request submitted

- **Route** ROUTE_TERMINATION · **submit** `submitTerminationRequest` (`TerminationHandler.js`)
- **What happens:** `createWorkflow` creates the `TERM_` row → the submission (including any uploaded
  supporting document, stored in the termination attachments folder) is written to the `Terminations`
  sheet → `updateWorkflow` sets step `HR Approval Needed` → `syncWorkflowState` →
  `_sendTerminationSubmitEmails`.
- **Emails:** the approval link to GRP_HR, and an advance-notice-only email to GRP_PAYROLL that states
  approval is still pending.

## Step 1 — HR Approval

- **Route** ROUTE_TERM_APPROVAL (GRP_HR or GRP_PAYROLL, + admin) · **submit**
  `submitTerminationApproval` (`TerminationHandler.js`)
- **What happens:** HR records approve or reject, with optional notes, to
  `Termination Approval Results`. On approval the offboarding tasks are created; on rejection the
  workflow ends.

## Step 2 — Offboarding tasks (parallel, created on approval)

Which tasks appear depends on what was selected on the request form.

| Task | Category | Assigned to | Created when |
|---|---|---|---|
| IT Systems Deactivation | `IT` | GRP_IT | at least one IT line was produced (see the IT checklist below) |
| HR Systems Deactivation | `HR` | GRP_HR | `ADP Supervisor Access` is among the systems to remove |
| ADP Deactivation | `Payroll` | GRP_PAYROLL | same condition as the HR task — created alongside it |
| Fleet Systems Deactivation | `Fleet` | GRP_FLEET | `Fleetio` is among the systems to remove |
| Central Purchasing/Jonas Deactivation | `Purchasing` | GRP_PURCHASING | `Central Purchasing/Jonas` is among the systems to remove |
| Employee Deactivation (SiteDocs, DSS, BOSS WIS) | `Deactivation` | GRP_IDSETUP | **always** |
| Complete EOE Process | `EOE` | GRP_HR | **always** |
| Asset Collection Checklist | `Assets` | the requester (manager is copied) | equipment to return is listed and is not `N/A` |

**Safety** receives an FYI email on approval but gets no task — the SiteDocs / DSS / BOSS WIS
deactivation sits with the ID Setup team.

If there is no equipment to return, the requester and manager get a plain "termination approved"
email instead of the asset checklist.

### What goes on the IT checklist

The IT task is assembled line by line, so its content varies:

- Only if **`Google Account`** is among the systems to remove:
  - email forwarding to the named address, if one was given
  - Drive file transfer to the named address, if one was given
  - delegated inbox access to the named address, if one was given
  - vacation responder with the supplied message (a `[RECIPIENT]` placeholder is filled from the
    forwarding address, then the delegate, then the manager, then HR)
  - a calendar marker for the account deletion date, defaulting to one month
- **Mobile phone suspension** — if a mobile phone is on the equipment-to-return list. Conditional on
  the equipment list, not on the Google account.
- **Direct report reassignment** — if the employee has direct reports: both Google and BOSS
  reassignment when they have a Google account, BOSS only when they do not.
- A closing line asking IT to confirm nothing else exists beyond what was listed.

## Step 3 — Completion

`closeActionItem` → `checkWorkflowCompletion`. Terminations do **not** use the required-category
filter, so **every open task blocks completion** except `WIS` and `Manager`, which are never blocking.
When the last one closes: status → `Complete`, step → `All Action Items Closed`, dashboard re-synced,
`notifyWorkflowClosure` sends the summary.

---

## Notifications around approval

On approval, alongside the task emails: Payroll gets a full approval notice with the complete context
block, Safety gets the FYI, and the requester and manager get either the asset checklist or the
approval confirmation.

## Available at any point

- **Cancel** (`cancelRequest`), **Remind** (`bumpRequest`), and the dashboard/step tracker behave the
  same as every other workflow.
