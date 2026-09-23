# WF_NEW_HIRE — New Employee Onboarding

Workflow ID prefix `NEW_EMP_` · entry form `FORM_NEW_HIRE` · registry keys in [`../index.json`](../index.json)

Records what the code does. It makes no claim about whether that is correct or intended — that is
the maintainer's call, made when this flow is reviewed.

---

## Step sequence

| # | Step (`Current Step` value) | Who acts | Form | Opens when |
|---|---|---|---|---|
| 0 | `Initial Request` | ACTOR_REQUESTER (any domain user) | FORM_NEW_HIRE | always — this creates the workflow |
| 1 | `ID Setup Needed` | GRP_IDSETUP | FORM_ID_SETUP | always, immediately on submit |
| 2 | `HR Verification Needed` | GRP_HR (emailed to HR **and** Payroll) | FORM_HR_VERIFICATION | always, when ID Setup is submitted |
| 3 | `IT Confirmation Needed` | GRP_IT_CONFIRMATION | FORM_IT_CONFIRMATION | **only if** `BOSS` is in the requested systems |
| 4 | `IT Setup Needed` | GRP_IT | FORM_IT_SETUP | after HR Verification (or after IT Confirmation when step 3 ran) |
| 5 | `Specialist Forms Needed` | per-task groups, in parallel | FORM_ACTION_ITEM | when IT Setup is submitted for the first time |
| 6 | `All Action Items Closed` → status `Complete` | system | — | when no blocking task is still open |

**Early exit:** an **Hourly** employee with **System Access = No** finishes at step 2. The workflow is
marked `Complete` with step `HR Verification Complete`; steps 3–6 never run.

---

## Step 0 — Initial Request

- **Route** ROUTE_INITIAL_REQUEST · **submit** `submitInitialRequest` (`InitialRequestHandler.js`)
- **What happens:** required fields are validated before anything is written → `createWorkflow`
  creates the `NEW_EMP_` row → `EmployeeIdRegistry.allocate` assigns the internal employee number →
  the submission is written to `Initial Requests` → `updateWorkflow` sets step `ID Setup Needed` →
  `syncWorkflowState` refreshes the dashboard row → `rawLogResult` records the event →
  `sendInitialRequestEmails` sends the submission notifications, including the ID Setup link.
- **Duplicate protection:** the workflow is de-duplicated on employee name + hire date, so a repeated
  submit within the guard window returns the existing workflow rather than creating a second one.
- **Conditional:** if the `SAFETY_TRAINING_AT_SUBMIT` property is on, the **Safety** task is created
  here instead of later. Default is off.

## Step 1 — ID Setup

- **Route** ROUTE_ID_SETUP (GRP_IDSETUP + admin) · **serve** `serveIDSetup` · **submit**
  `submitEmployeeIDSetup` (`IDSetup.js`)
- **What happens:** the page shows the employee number already allocated at submit and proposes a DSS
  username and SiteDocs username → on submit the row is written to `ID Setup Results` →
  `updateWorkflow` sets step `HR Verification Needed` → `syncWorkflowState` →
  `triggerNextStepFromIDSetup` decides what to send.
- **Employee number:** pre-assigned. Submitting a different one is refused unless the user is an
  admin, in which case the override is recorded.

### Branch at the end of ID Setup — `triggerNextStepFromIDSetup`

| Condition | What is sent | Safety task |
|---|---|---|
| Employment Type = `Hourly` **and** System Access = `No` | credentials email to requester + manager, **and** HR Verification link to GRP_HR + GRP_PAYROLL | created here (skipped if one already exists) |
| anything else (Salary, or any system access) | HR Verification link to GRP_HR + GRP_PAYROLL | created later, after HR Verification |

## Step 2 — HR Verification

- **Route** ROUTE_HR_VERIFICATION (GRP_HR + admin) · **submit** `submitHRVerification`
  (`HRVerificationHandler.js`)
- **What happens:** HR confirms the employee details and assigns the ADP Associate ID. The row is
  written to `HR Verification Results`. Changed values are compared against the original request and
  `sendChangeNotifications` tells the affected teams.
- **Re-submitting:** if a row already exists it is updated in place — no step change and no
  downstream emails are re-sent.

### Branch at the end of HR Verification

| Condition | Next step | Who is notified |
|---|---|---|
| Employment Type = `Hourly` **and** System Access = `No` | status `Complete`, step `HR Verification Complete` | requester + manager get the completion email |
| systems include `BOSS` | `IT Confirmation Needed` | GRP_IT_CONFIRMATION, plus an `IT Confirmation` task |
| otherwise | `IT Setup Needed` | GRP_IT |

Also sent on both continuing paths: a Payroll notification (carrying an extra callout when ADP salary
access was flagged), and the **Safety** task via `sendSafetyOnboardingEmail`.

## Step 3 — IT Confirmation *(conditional)*

- **Runs only when** `BOSS` is among the requested systems.
- **Route** ROUTE_IT_CONFIRMATION (GRP_IT_CONFIRMATION + GRP_IT + admin) · **submit**
  `submitITConfirmation` (`ITConfirmationHandler.js`)
- **What happens:** the reviewer confirms the access configuration → the row is written to
  `IT Confirmation Results` → change detection runs → `updateWorkflow` sets `IT Setup Needed` → GRP_IT
  is emailed the IT Setup link.

## Step 4 — IT Setup

- **Route** ROUTE_IT_SETUP (GRP_IT + admin) · **submit** `submitITSetup` (`ITSetupHandler.js`)
- **What happens (first submit):** the row is written to `IT Results` → `updateWorkflow` sets
  `Specialist Forms Needed` → `syncWorkflowState` → `triggerSpecialists` creates the conditional tasks.
- **Re-submitting:** the existing row is overwritten and the edit is logged. Specialists are **not**
  re-triggered and the step does not move.

## Step 5 — Specialist tasks (parallel)

`triggerSpecialists` reads the request plus everything IT just captured, then creates only the tasks
that apply. Credentials (email, SiteDocs and DSS passwords) are stripped from specialist emails and
shown only to the manager/requester. Tasks for the same assignee are combined into one email.

| Task | Category | Assigned to | Created when |
|---|---|---|---|
| Credit Card Setup | `Finance` | GRP_FINANCE | any of USA / Canada / Home Depot card = `Yes` |
| Business Cards | `Business Cards` | GRP_BUSINESS_CARDS | Business Cards = `Yes` |
| Fleetio Access | `Fleet` | GRP_FLEET | Fleetio access = `Yes` (adds a vehicle line if a vehicle was requested) |
| 30/60/90 Review Plan | `30/60/90 Review` | GRP_REVIEW_306090 | 30/60/90 plan = `Yes` |
| JR Assignment | `JR Title` | GRP_JR_TITLE | same condition as 30/60/90 — created as a separate task with its own assignee |
| Central Purchasing/Jonas | `Purchasing` | GRP_PURCHASING | Jonas job numbers **or** purchasing sites are filled in |
| Safety Onboarding | `Safety` | GRP_SAFETY | always (created at step 1 or step 2, not here) |
| WIS Assignment | `WIS` | the employee's manager | a manager email is present |

**Not created for new hires:** the SiteDocs account task — for a new hire the SiteDocs account is
created during ID Setup. It only appears on equipment requests.

## Step 6 — Completion

Closing a task calls `closeActionItem` → `checkWorkflowCompletion`. For a new hire, only the
**required** categories hold completion:

- always: `Safety`
- `Purchasing` — if Jonas job numbers were given
- `Finance` — if any credit card was requested
- `Fleet` — if Fleetio was requested
- `Business Cards` — if requested
- `30/60/90 Review` — if the plan was requested

`WIS`, `Manager`, `JR Title` and `IT Confirmation` are created but never block. When nothing blocking
is left: status → `Complete`, step → `All Action Items Closed`, dashboard re-synced, and
`notifyWorkflowClosure` sends the summary to HR, the initiator and the manager.

---

## Available at any point

- **Cancel** (`cancelRequest`) — admin, HR, IT, or the original requester/manager. Sets status
  `Cancelled`, step `Request Cancelled`.
- **Remind** (`bumpRequest`) — re-sends the notification for whatever is currently open.
- **Edit Start Date** — admin and HR/IT.
- Every step change calls `syncWorkflowState`, so the dashboard reflects the move immediately.
