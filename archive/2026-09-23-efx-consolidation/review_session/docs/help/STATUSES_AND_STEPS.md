# Statuses and steps — what the labels mean and who is waiting on whom

Each request (workflow) has a **Status** and a **Current Step**. The Workflow Dashboard shows both, plus a more specific "Current Action Pending" line. This page lists every step for each of the four request types, in order, with the email that marks each hand-off.

<a id="status-values"></a>
## Status values

| Status | Meaning | What you can do |
|---|---|---|
| **In Progress** | The request is moving; look at *Current Step* / *Current Action Pending* to see who has it. | Use **Remind** on the dashboard (once per hour per step). |
| **Complete** (the dashboard filter calls it Completed) | Every step is done and every blocking task is closed. HR, the requester and the manager received "Workflow Completed". | Nothing further. Late tasks (for example a JR Title task) can still be finalized but do not change the status. |
| **Rejected** | HR rejected an End of Employment or Position / Site Change request. The step reads *Rejected by HR*. | Submit a corrected request if needed. |
| **Cancelled** | Someone cancelled the request from the request details page. The step reads *Request Cancelled*; all open tasks were marked Cancelled. | Hidden from the default dashboard view; use the **Cancelled** filter to see it. |

Who can cancel: HR, IT, an app admin, the requester or the manager on the request. Cancelling emails nobody, so tell the teams involved yourself if they had already started.

<a id="dashboard-labels"></a>
## Dashboard labels

- **Type** filters: New Hires, End of Employment, Status Change, Equipment.
- **Status** filters: Action Required (anything still open), Completed, Cancelled.
- **Current Action Pending** reads `Pending: ID Setup`, `Pending: HR Verification`, `IT Confirmation Needed` (shown as the raw step name), `Pending: IT`, `Pending: <task categories still open>` (for example `Pending: Safety, Finance` — WIS and IT Confirmation are never listed) or `All Specialists Complete`. For approvals it shows `HR Approval Needed`, then `Pending: <open task categories>` once approved.
- Step badges on a request: Initial Request, ID SETUP, HR Verification, IT CONF, IT SETUP, Approval, and one badge per task category (SAFETY, FINANCE, BUSINESS CARDS, FLEET, 30/60/90, JR TITLE, PURCHASING, ID SETUP, WIS, ADP/HR, DEACTIVATION, ASSETS). Each badge has a **Remind** button that re-sends that step's email to its owner.
- The request details page shows the same checklist with who completed each step and when, a **Cancel Request** button, and (for HR, IT and admins) an editable start date.

<a id="new-hire"></a>
## New Employee Request (`NEW_EMP_…`)

| # | Current Step label | Who is waiting on whom | Email that opens this step | What ends the step |
|---|---|---|---|---|
| 1 | *Initial Request* (momentary) | — | Requester receives **Request Submitted** | Automatic |
| 2 | **ID Setup Needed** | Everyone is waiting on `grp.forms.idsetup` | **ID Setup Required** → ID Setup group (button opens the ID Setup form) | ID Setup submits the form |
| 3 | **HR Verification Needed** | Waiting on `grp.forms.hr` (Payroll is copied) | **HR Verification Required** → HR + Payroll. For hourly hires with **no** system access, the requester and manager also receive **Credentials Ready** (DSS / SiteDocs logins) and Safety receives **Safety Onboarding Required** | HR submits HR Verification |
| 3a | **HR Verification Complete** — Status **Complete** | Only for **Hourly + no system access**: the request ends here | **Onboarding Complete** → requester + manager (includes the credentials) | — |
| 4 | **IT Confirmation Needed** | Only when **BOSS** was requested. Waiting on the IT Confirmation owner (a named IT contact) | **IT Confirmation Required — Name** → IT Confirmation owner. Payroll receives **HR Verified** (with "— Salary Access Required" if ADP salary access was ticked). Safety receives **Safety Onboarding Required** | The owner clicks "Confirm & Send to IT" |
| 5 | **IT Setup Needed** | Waiting on `grp.forms.it` | **IT Setup Required** (or **IT Setup Required — Name** after IT Confirmation) → IT group. If step 4 was skipped, Payroll and Safety receive the emails listed in row 4 now | IT submits IT Setup |
| 6 | **Specialist Forms Needed** | Waiting on whichever specialist tasks are still open (table below). Requester + manager receive **IT Setup Complete** (includes the temporary email password) | One email per specialist group: **<Task name> Required**, or **Action Items Assigned — Name (N tasks)** when a group has several. The manager receives **WIS Assignment — Name Required** | Every *blocking* task is finalized |
| 7 | **All Action Items Closed** — Status **Complete** | — | **Workflow Completed: New Employee Onboarding (NEW_EMP_…)** → HR + requester + manager | — |

Specialist tasks created at step 6, and whether they hold up completion:

| Task | Created when | Goes to | Blocks completion? |
|---|---|---|---|
| Credit Card Setup | Any credit card ticked | `grp.forms.creditcard` | Yes |
| Business Cards | Equipment includes Business Cards | Business Cards owner | Yes |
| Fleetio Access (+ "Assign company vehicle" if Vehicle ticked) | Systems include Fleetio | `grp.forms.fleetio` | Yes |
| 30/60/90 Review Plan | "30-60-90 Day Plan Required?" = Yes | `grp.forms.review306090` | Yes |
| JR Assignment | "30-60-90 Day Plan Required?" = Yes (not the JR question — see note) | `grp.forms.jrtitle` | **No** |
| Central Purchasing/Jonas Setup | Purchasing sites or Jonas job numbers entered | `grp.forms.jonas` | Yes |
| WIS Assignment | Always (manager on the request) | The reporting manager | **No** |
| Safety Onboarding | Created earlier (row 3 or 4) | `grp.forms.safety` | Yes |
| IT Confirmation | Created at row 4 for BOSS hires | IT Confirmation owner | No — and it is never auto-closed (known issue) |

Note: the JR Assignment and 30/60/90 tasks are both created by the **30-60-90** answer. Answering "JR Required? Yes" alone does not create a JR task; it only makes HR pick the verified JR title during HR Verification.

<a id="equipment"></a>
## Equipment and Systems Request (`EQUIP_REQ_…`)

| # | Current Step label | Who is waiting on whom | Email that opens this step | What ends the step |
|---|---|---|---|---|
| 1 | *Initial Request* (momentary) | — | Requester receives **Request Submitted** | Automatic |
| 2 | **IT Confirmation Needed** | Waiting on the IT Confirmation owner | **IT Confirmation Required** → IT Confirmation owner | Owner clicks "Confirm & Send to IT" |
| 3 | **IT Setup Needed** | Waiting on `grp.forms.it` | **IT Setup Required — Name** → IT group | IT submits IT Setup |
| 4 | **Specialist Forms Needed** | Waiting on open specialist tasks. Requester + manager receive **IT Setup Complete** | Specialist emails as for New Hire (Finance, Business Cards, Fleet, Purchasing). No 30/60/90, JR or WIS tasks for equipment requests | Every open task except WIS/Manager is finalized |
| 5 | **All Action Items Closed** — **Complete** | — | **Workflow Completed: System & Equipment Request (EQUIP_REQ_…)** → HR + requester + manager | — |

There is no ID Setup or HR Verification step, and no Internal Employee ID is assigned for an equipment request.

<a id="termination"></a>
## End of Employment Request (`TERM_…`)

| # | Current Step label | Who is waiting on whom | Email that opens this step | What ends the step |
|---|---|---|---|---|
| 1 | **HR Approval Needed** | Waiting on `grp.forms.hr` | **HR Approval Required** → HR (button opens the approval page). Payroll receives **Termination Submitted — Pending HR Approval** as advance notice | HR approves or rejects |
| 2a | **Rejected by HR** — Status **Rejected** | — | **Termination Rejected** → requester + manager | — |
| 2b | **Action Items Pending** | Waiting on every team with an open deactivation task | **IT / HR / Payroll / Fleet / Purchasing Action Required** (as applicable); **Employee Deactivation Required** → ID Setup (always); **EOE Process Required** → HR (always); **FYI — Employee Offboarding** → Safety (information only, no task); **Asset Collection Required** → requester + manager when equipment was listed, otherwise **Termination Approved**; **Termination Approved** → Payroll | Every task is finalized (all termination tasks block) |
| 3 | **All Action Items Closed** — **Complete** | — | **Workflow Completed: End of Employment Request (TERM_…)** → HR + requester + manager | — |

Finalizing the **Asset Collection Checklist** additionally emails **Assets Returned: IT Equipment / Credit Card / Vehicle and Keys** to IT, the credit-card team or Fleet, depending on what was collected.

<a id="position-change"></a>
## Position / Site Change (`CHANGE_…`)

| # | Current Step label | Who is waiting on whom | Email that opens this step | What ends the step |
|---|---|---|---|---|
| 1 | **HR Approval Needed** | Waiting on `grp.forms.hr` | **HR Approval Required** → HR + Payroll (button opens the approval page). The current manager receives **Status Change Initiated** | HR approves or rejects |
| 2a | **Rejected by HR** — **Rejected** | — | **Status Change Rejected** | — |
| 2b | **Action Items Pending** | Waiting on the open tasks | **Status Change Approved** → requester + new manager; **Incoming Transfer Action Required** → receiving manager; **IT Action Required** → IT (opens the IT Setup form); **ADP Update Required — Name** → HR + Payroll (always); **BOSS WIS Account Update Required** → ID Setup (always); **Safety System Updates Required** → Safety (always); plus **Business Cards / Credit Card / Fleetio / Vehicle Return / Fleetio Access Removal / Central Purchasing-Jonas / SiteDocs Access Removal / SiteDocs Account Setup / Asset Collection Required** when the request asked for them | Every task except the manager's transfer task and the WIS task is finalized |
| 2c | (still *Action Items Pending*) | After ID Setup finalizes the BOSS WIS account task, the manager receives **BOSS WIS Assignment Required — Name** | — | Manager finalizes it (non-blocking) |
| 3 | **All Action Items Closed** — **Complete** | — | **Workflow Completed** → HR + requester + manager | — |

<a id="information-updated"></a>
## "Information Updated" emails

When HR Verification or IT Confirmation changes a field compared with the original request (name, start date, manager, title, site, systems), the requester and manager receive **Information Updated** listing the changes. Safety is copied when the change could affect SiteDocs locations or DSS learning paths; ID Setup is copied when it could affect credentials or IDs already created. A start-date change is also written into the HR notes as `[START DATE CHANGED: old → new]`.

<a id="reminders"></a>
## Reminders (the Remind button)

Anyone who is HR, IT, an admin, the requester or the manager can press **Remind** on a step badge. The system re-sends that step's email to its owner with the subject prefixed `REMINDER [Requested: yyyy-mm-dd]:`. Limit: one reminder per step per hour; a second attempt shows "A reminder was already sent recently for this step. Please wait before sending again." Reminding a task that is already closed shows "Action Item not found or already closed".

<a id="safety-timing"></a>
## When the Safety Onboarding task appears

The Safety task is not created when the New Employee Request is submitted. It appears:

- at **ID Setup** for hourly hires with no system access, or
- after **HR Verification** for everyone else.

(The system has an administrator switch that would create it at submission instead; it is off by default.) If you are in Safety and have not received "Safety Onboarding Required" yet, check the request's current step: it is probably still at ID Setup or HR Verification.

<a id="who-can-do-what"></a>
## Who can do what on a request

| You are… | Open the step forms | Cancel | Remind | Edit the start date | See step details |
|---|---|---|---|---|---|
| App admin | any form | any request | any request | yes | all |
| HR (`grp.forms.hr`) | HR forms and approvals | any request | any request | yes | all |
| IT (`grp.forms.it`) | IT Setup, IT Confirmation | any request | any request | yes | all |
| Payroll | approval pages (view only) | no | no | no | all |
| Specialist group member (ID Setup, Safety, Fleet, Credit Card, Business Cards, Jonas, 30/60/90, JR) | your own task pages | requests you requested or manage | same | no | all |
| Requester or manager on the request | none of the step forms | your own requests | your own requests | no | your own requests |
| Any other signed-in company user | none | no | no | no | dashboard and request details only (initial request data) |

Start-date edits are done from the request details page (**Edit Start Date** → "Enter new start date (YYYY-MM-DD)") and are logged. Cancelling is done from the same page (**Cancel Request**); it marks the request Cancelled, marks every open task Cancelled and sends no email.

<a id="where-to-find-ids"></a>
## Where to find the request and task IDs

- The **success screen** after you submit shows "Request ID: NEW_EMP_…" (or TERM_/CHANGE_/EQUIP_REQ_).
- Every system email carries the request ID in its context block, and step-form links contain `wf=<request id>`.
- Task emails and task pages show the **Task ID** (`TK-…`) under the task name; task links contain `tid=TK-…`.
- The dashboard lists requests by employee name; open a row to see the request ID and every task ID.
