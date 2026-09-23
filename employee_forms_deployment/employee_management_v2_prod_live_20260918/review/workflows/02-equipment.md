# WF_EQUIPMENT — System & Equipment Request

Workflow ID prefix `EQUIP_REQ_` · entry form `FORM_EQUIPMENT` · registry keys in [`../index.json`](../index.json)

For someone who already works here and needs access, software or hardware.

Records what the code does. It makes no claim about whether that is correct or intended — that is
the maintainer's call, made when this flow is reviewed.

---

## Step sequence

| # | Step (`Current Step` value) | Who acts | Form | Opens when |
|---|---|---|---|---|
| 0 | `Initial Request` | ACTOR_REQUESTER (any domain user) | FORM_EQUIPMENT | always — this creates the workflow |
| 1 | `IT Confirmation Needed` | GRP_IT_CONFIRMATION | FORM_IT_CONFIRMATION | always, immediately on submit |
| 2 | `IT Setup Needed` | GRP_IT | FORM_IT_SETUP | when IT Confirmation is submitted |
| 3 | `Specialist Forms Needed` | per-task groups, in parallel | FORM_ACTION_ITEM | when IT Setup is submitted for the first time |
| 4 | `All Action Items Closed` → status `Complete` | system | — | when no blocking task is still open |

There is **no ID Setup and no HR Verification step** — the employee already exists. There is also no
approval gate; IT Confirmation is the only review.

---

## Step 0 — Request submitted

- **Route** ROUTE_EQUIPMENT_REQUEST · **submit** `submitEquipmentRequest`
  (`EquipmentRequestHandler.js`)
- **Form:** the same template as the new hire form, served with `mode = 'equipment'`, which hides the
  hiring-only sections.
- **What happens:** a script lock is taken → `createWorkflow` creates the `EQUIP_REQ_` row →
  `updateWorkflow` sets step `IT Confirmation Needed` → required fields are validated → the aliased
  field names the equipment form posts are normalised to the standard names → `System Access` is
  forced to `Yes` → the row is written to the **`Initial Requests`** sheet (the same sheet and columns
  as a new hire) → `_sendEquipmentRequestSubmitEmails` → `syncWorkflowState`.
- **Emails:** a confirmation to the requester, and the IT Confirmation link to GRP_IT_CONFIRMATION.

## Step 1 — IT Confirmation

- **Route** ROUTE_IT_CONFIRMATION (GRP_IT_CONFIRMATION + GRP_IT + admin) · **submit**
  `submitITConfirmation` (`ITConfirmationHandler.js`)
- **What happens:** the reviewer confirms the requested access → the row is written to
  `IT Confirmation Results` → change detection compares the identity and access fields against the
  original request and notifies if anything moved → `updateWorkflow` sets `IT Setup Needed` → GRP_IT
  gets the IT Setup link.
- Equipment and new hire share this handler; the equipment branch of the change comparison uses its
  own field list.

## Step 2 — IT Setup

- **Route** ROUTE_IT_SETUP (GRP_IT + admin) · **submit** `submitITSetup` (`ITSetupHandler.js`)
- **What happens (first submit):** the row is written to `IT Results` → `updateWorkflow` sets
  `Specialist Forms Needed` → `syncWorkflowState` → `triggerSpecialists`.
- **Re-submitting:** the row is overwritten and logged; specialists are not re-triggered.

## Step 3 — Specialist tasks (parallel)

Equipment runs through the same `triggerSpecialists` function as a new hire, but several tasks are
explicitly skipped for `EQUIP_REQ_` workflows and one is added.

| Task | Category | Assigned to | Created when |
|---|---|---|---|
| Credit Card Setup | `Finance` | GRP_FINANCE | any of USA / Canada / Home Depot card = `Yes` |
| Business Cards | `Business Cards` | GRP_BUSINESS_CARDS | Business Cards = `Yes` |
| Fleetio Access | `Fleet` | GRP_FLEET | Fleetio access = `Yes` (adds a vehicle line if requested) |
| Central Purchasing/Jonas | `Purchasing` | GRP_PURCHASING | Jonas job numbers **or** purchasing sites are filled in |
| SiteDocs Account Setup | `ID Setup` | GRP_IDSETUP | SiteDocs is among the requested systems — **equipment only** |

**Skipped on equipment requests:**

- `30/60/90 Review` and `JR Title` — both are gated on the request not being an `EQUIP_REQ_` workflow
- `WIS Assignment` — same gate
- `Safety Onboarding` — it is created from the ID Setup or HR Verification steps, neither of which
  equipment runs

## Step 4 — Completion

`closeActionItem` → `checkWorkflowCompletion`. Equipment does **not** use the required-category filter
that new hires use, so **every open task blocks completion** except the two categories that are never
blocking (`WIS`, `Manager`). When the last one closes: status → `Complete`, step →
`All Action Items Closed`, dashboard re-synced, `notifyWorkflowClosure` sends the summary.

---

## Also present in the code

`Email Setup Needed` exists as a step label. `launchEquipmentActionItems` and
`launchRemainingEquipmentTasks` exist in `EquipmentRequestHandler.js`, both commented out, as is the
`Email Setup Needed` branch in `checkWorkflowCompletion`. The comments attribute this to a two-phase
equipment design that predates the move onto the shared IT Setup path. The sequence documented above
is what the uncommented code does. Recorded as `R1` in the [behaviour register](../OBSERVATIONS-PARKED.md).

---

## Available at any point

- **Cancel** (`cancelRequest`), **Remind** (`bumpRequest`), and the dashboard/step tracker behave the
  same as every other workflow.
