# WF_POSITION_CHANGE — Position / Site Change

Workflow ID prefix `CHANGE_` · entry form `FORM_POSITION_CHANGE` · registry keys in [`../index.json`](../index.json)

Role change, site transfer, manager change, classification change — and the access added or removed
because of it.

Records what the code does. It makes no claim about whether that is correct or intended — that is
the maintainer's call, made when this flow is reviewed.

---

## Step sequence

| # | Step (`Current Step` value) | Who acts | Form | Opens when |
|---|---|---|---|---|
| 0 | `Initial Request` | ACTOR_REQUESTER (any domain user) | FORM_POSITION_CHANGE | always — this creates the workflow |
| 1 | `HR Approval Needed` | GRP_HR (Payroll may also open it) | FORM_CHANGE_APPROVAL | always, immediately on submit |
| 2 | `Action Items Pending` | per-task groups, in parallel | FORM_ACTION_ITEM | when HR **approves** and at least one task is created |
| 3 | `All Action Items Closed` → status `Complete` | system | — | when no blocking task is still open |

**Rejection path:** status → `Rejected`, step → `Rejected by HR`. No tasks created.

**Edge case:** if approval somehow creates no tasks, the step is set to `Change Processed`. In
practice two tasks are unconditional, so this does not arise.

**One sequenced pair:** the manager's WIS task is *not* created at approval. It is created when the
ID Setup BOSS WIS task closes — see "Sequenced hand-off" below.

---

## Step 0 — Request submitted

- **Route** ROUTE_POSITION_CHANGE · **submit** `submitPositionChangeRequest`
  (`PositionChangeHandler.js`)
- **What happens:** `createWorkflow` creates the `CHANGE_` row → the submission (including any
  attachment, stored in the position change attachments folder) is written to the `Position Changes`
  sheet → `updateWorkflow` sets step `HR Approval Needed` → `syncWorkflowState` → the approval link
  goes to HR.
- The form captures old and new values side by side (site, title, classification, manager), plus
  three separate access lists: systems/equipment **added**, equipment to **return**, and access to
  **remove**.

## Step 1 — HR Approval

- **Route** ROUTE_CHANGE_APPROVAL (GRP_HR or GRP_PAYROLL, + admin) · **submit**
  `submitPositionChangeApproval` (`PositionChangeHandler.js`)
- **What happens:** the decision and notes are written to `Position Change Approval Result`. On
  approval every applicable task below is created in one pass, each with its own email; on rejection
  the workflow ends and the requester and manager are told.

## Step 2 — Tasks created on approval

### Always created

| Task | Category | Assigned to |
|---|---|---|
| BOSS WIS User Account Update | `ID Setup` | GRP_IDSETUP |
| ADP Update Required | `HR` | GRP_HR **and** GRP_PAYROLL share one task and one closure |

The ADP checklist is assembled from what actually changed — always an "update the employee record"
line, plus a line for reports being taken away (`oldReportsTo`) and a line for reports being gained
(`newReportsFrom`) when either is present.

### Created conditionally

| Task | Category | Assigned to | Created when |
|---|---|---|---|
| Incoming Transfer Setup | `Manager` | the receiving manager | a receiving manager email is present |
| Business Cards Order | `Business Cards` | GRP_BUSINESS_CARDS | `Business Cards` is in the equipment list |
| Credit Card Order | `Finance` | GRP_FINANCE | `Credit Card` is in the equipment list (card types and limits are itemised from the USA / Canada / Home Depot answers; if none were ticked the task asks the specialist to confirm with the requester) |
| Fleetio Access Update | `Fleet` | GRP_FLEET | `Fleetio` is in the systems being added |
| Vehicle Return | `Assets` | GRP_FLEET | `Vehicle` is in the return list |
| Fleetio Access Removal | `Fleet` | GRP_FLEET | `Fleetio` is in the removal list |
| Central Purchasing/Jonas Update | `Purchasing` | GRP_PURCHASING | `Central Purchasing/Jonas` is in the systems, **or** purchasing sites or Jonas job numbers are filled in |
| IT Access & Equipment Setup | `IT` | GRP_IT | any IT-handled system, equipment or removal remains after the specialist-routed ones are excluded |
| Asset Collection | `Assets` | the old manager (requester copied) | anything is on the equipment return list |
| SiteDocs Access Removal | `ID Setup` | GRP_IDSETUP | `SiteDocs` is in the removal list |
| SiteDocs supervisor account | `ID Setup` | GRP_IDSETUP | `SiteDocs` is in the systems being added |
| Safety — DSS / SiteDocs site update | `Safety` | GRP_SAFETY | `SiteDocs` is in the systems being added (Safety updates the existing record; ID Setup owns account creation) |

The old manager is also notified separately when they differ from both the receiving manager and the
requester.

The IT checklist is itemised from the remaining systems — for example `ADP Supervisor Access` and
`BOSS` each produce their own lines, and a BOSS training-only flag changes what is asked for. Systems
routed to a specialist (Fleetio, SiteDocs) are excluded from the IT list.

## Sequenced hand-off — ID Setup then manager

The manager's `WIS` task is not created at approval. The code comment gives the reason as sequencing:
the manager cannot assign the right BOSS WIS modules until ID Setup has moved the employee onto the
correct site.

1. ID Setup closes **BOSS WIS User Account Update** (form type `boss_wis_update`).
2. `closeActionItem` recognises that form type on a `CHANGE_` workflow and calls
   `launchWisAssignment` (`PositionChangeHandler.js`).
3. That creates **BOSS WIS Module Assignment** in category `WIS`, assigned to the manager, and emails
   them.

Because it is category `WIS`, that task never blocks completion.

## IT Setup on a change workflow

IT does not get a separate `IT Setup Needed` step here. IT opens the standard IT Setup form from their
action item; submitting it writes the row to `IT Results` and closes the `IT` task in one move, and
the same data is written again by the post-close hook so the closure email has full context whichever
route was used.

## Step 3 — Completion

`closeActionItem` → `checkWorkflowCompletion`. Position changes do **not** use the required-category
filter, so **every open task blocks completion** except `WIS` and `Manager`. When the last one closes:
status → `Complete`, step → `All Action Items Closed`, dashboard re-synced, `notifyWorkflowClosure`
sends the summary.

---

## Available at any point

- **Cancel** (`cancelRequest`), **Remind** (`bumpRequest`), and the dashboard/step tracker behave the
  same as every other workflow.
