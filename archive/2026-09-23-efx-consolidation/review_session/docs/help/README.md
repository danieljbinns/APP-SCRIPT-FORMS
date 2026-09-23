# Employee Forms — Help for people who use the forms

This is the end-user guide to TEAM Group's Employee Forms portal (the "Employee Management Portal"). It is for the people who submit requests and work the resulting tasks: site managers and other requesters, HR, IT, ID Setup, Payroll/Finance, Fleet, Purchasing and Safety. It is not a developer guide.

Everything here describes what the system actually does today, including a few known problems. Where something is a known issue we say so and give you the workaround.

<a id="which-form"></a>
## Which form do I need?

| Your situation | Form to open | Who fills it | What happens next | Timing rules the system applies |
|---|---|---|---|---|
| Someone new is joining (or a former employee is coming back) | **New Employee Request** | The hiring/site manager or their delegate (any signed-in user) | ID Setup → HR Verification → (IT Confirmation if BOSS was requested) → IT Setup → specialist tasks → Complete. Hourly hires with **no** system access skip IT and finish at HR Verification. | A yellow notice appears if the start date is under 3 business days away ("Please contact HR to expedite"). No other deadline is enforced. |
| An **existing** employee needs new systems, software or hardware | **Equipment and Systems Request** | The employee's manager or requester | IT Confirmation → IT Setup → specialist tasks (credit card, business cards, Fleetio, purchasing) → Complete. | None enforced. |
| Someone is leaving | **End of Employment Request** | The employee's manager or requester | HR approves or rejects → deactivation tasks for IT, HR, Payroll, Fleet, Purchasing, ID Setup, Safety; asset-collection checklist for the requester/manager → Complete when every task is closed. | None enforced. HR requires supporting documentation to be attached. |
| Role, site, classification or manager is changing | **Position / Site Change** | The current manager or requester | HR approves or rejects → tasks for the receiving manager, IT, ID Setup, Safety, HR/Payroll (ADP) and any specialists → Complete when every task is closed. | None enforced. |
| I have been assigned a task by email | **Action item** (link in the email, or from the Workflow Dashboard) | The person or group named in the email | Finalizing the task may complete the whole request and email "Workflow Completed" to HR, the requester and the manager. | Reminders can be sent at most once per hour per step. |
| I want to see where a request is | **Workflow Dashboard** | Anyone signed in on a company domain | Shows every request, its status, and "Current Action Pending". Open a row for the step-by-step checklist, Remind and Cancel buttons. | — |

There is no service-level clock in the system: "typical time" depends on the people working each step. Use the **Remind** button on the dashboard to nudge whoever is holding the current step.

<a id="pages"></a>
## Pages in this guide

| Page | Read it when |
|---|---|
| [Statuses and steps](STATUSES_AND_STEPS.md) | You want to know what a status or step label means, who is waiting on whom, and which email marks each hand-off. |
| [New Employee Request](NEW_HIRE_REQUEST.md) | You are hiring someone. Field notes for the tricky parts (system access, BOSS options, credit cards, JR / 30-60-90). |
| [ID Setup](ID_SETUP.md) | You are on the ID Setup team and received "ID Setup Required". |
| [HR Verification](HR_VERIFICATION.md) | You are in HR and received "HR Verification Required". |
| [IT Setup](IT_SETUP.md) | You are in IT and received "IT Setup Required". |
| [IT Confirmation](IT_CONFIRMATION.md) | You received "IT Confirmation Required" (BOSS new hires and all Equipment requests). |
| [Equipment and Systems Request](EQUIPMENT_REQUEST.md) | An existing employee needs equipment or access. |
| [End of Employment Request](TERMINATION_REQUEST.md) | Someone is leaving; also covers the HR approval page. |
| [Position / Site Change](POSITION_CHANGE_REQUEST.md) | Transfers, promotions, classification and manager changes; also covers the HR approval page. |
| [Action items and checklists](ACTION_ITEMS_AND_CHECKLISTS.md) | You have a task to work: how to open it, save progress, mark items Complete/Collected, and what finalizing does. |
| [Troubleshooting](TROUBLESHOOTING.md) | Something looks wrong: no email, Access Denied, a rejected field, wrong manager, a task that says it is already closed. |
| [Glossary](GLOSSARY.md) | Short definitions: Internal Employee ID, Workflow ID, Task ID, JR title, 30/60/90, SiteDocs, DSS, BOSS, WIS, ADP, Jonas and more. |

<a id="how-requests-move"></a>
## How a request moves, in one paragraph

Every submitted form creates a **workflow** with an ID you will see in every email and on the dashboard (`NEW_EMP_…`, `EQUIP_REQ_…`, `TERM_…`, `CHANGE_…`). The workflow moves through **steps**; each step is a form that one team fills in. When a team submits its form, the system records the result, moves the workflow to the next step and emails the next team a button that opens their form. Near the end, the system creates **action items** (tasks with a `TK-` ID) for specialist teams. When the last blocking task is finalized, the workflow becomes **Complete** and HR, the requester and the manager receive "Workflow Completed".

<a id="who-does-what"></a>
## Who does what

| Team (Google group) | Steps and tasks they receive |
|---|---|
| `grp.forms.hr` | HR Verification; approval of End of Employment and Position / Site Change requests; HR deactivation, EOE and ADP update tasks |
| `grp.forms.it` | IT Setup; IT deactivation; IT access and equipment tasks on status changes |
| `grp.forms.idsetup` | ID Setup; SiteDocs account setup and removal; Employee Deactivation; BOSS WIS account updates |
| `grp.forms.safety` | Safety Onboarding (SiteDocs locations, DSS learning paths); Safety System Updates on status changes; FYI on offboarding |
| `grp.forms.review306090` | 30/60/90 Review Plan tasks |
| `grp.forms.jrtitle` | JR Assignment tasks (worked by an automation) |
| `grp.forms.fleetio` | Fleetio access, vehicle assignment and return |
| `grp.forms.creditcard` | Credit card setup and orders |
| `grp.forms.jonas` | Central Purchasing / Jonas access |
| `payroll@team-group.com` | Copied on HR approvals and verifications; ADP deactivation and ADP update tasks |
| Business Cards / IT Confirmation | Assigned to a named individual in IT rather than a group; reach them via `grp.forms.it` |

If you are not in the group for a step, the form for that step shows **Access Denied**. See [Troubleshooting](TROUBLESHOOTING.md#access-denied).

<a id="emails-at-a-glance"></a>
## Emails at a glance

Every system email has a subject in a fixed shape, so you can filter on it:

    [New Hire | Hourly] ID Setup Required: Ada Lovelace | Aurora | Start Date: 2026-10-05 | Manager: requester@team-group.com
    [Termination | Salary] HR Approval Required: Sam Smith | Aurora | Termination Date: 2026-10-31 | Resigned | manager@team-group.com
    [Status Change | Hourly] HR Approval Required: Sam Smith | Aurora -> Barrie | Hourly -> Salary | Effective Date: 2026-11-01
    REMINDER [Requested: 2026-10-01]: [New Hire | Salary] HR Verification Required: Ada Lovelace | ...

- `EXPEDITE` appears in the tag for **hourly** hires that **do** need system access, so HR and Payroll do not treat them as the usual skip-IT hourly case.
- A `[TEST]` prefix means the email came from a test copy of the system, not production.
- Emails go to the **group** for a step, not to individuals. The sender name is "TEAM Group - Employee Onboarding".
- Finalizing a task does **not** send an email (except asset-return tasks). You only hear back when the whole request completes.
