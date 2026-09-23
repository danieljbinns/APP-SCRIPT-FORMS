# Equipment and Systems Request

<a id="purpose"></a>
## Purpose and who fills it

Use **Equipment and Systems Request** to request one-off systems, software or hardware for an **existing** employee ("Request equipment or system access for an existing employee"). It creates an `EQUIP_REQ_…` workflow that goes to IT Confirmation, then IT Setup, then any specialist tasks. Anyone signed in with a company account can submit it — usually the employee's manager.

For a brand-new employee use [New Employee Request](NEW_HIRE_REQUEST.md); for changes of role, site or manager use [Position / Site Change](POSITION_CHANGE_REQUEST.md).

<a id="before-you-start"></a>
## Before you start

The form is the New Employee form with the hiring-only questions removed. Have ready: the employee's first and last name, job title, site, and the manager's company email (autocompletes and fills the name). Then the systems and equipment needed, with the same detail as a new hire (BOSS options, ADP sites, Google account, Jonas job numbers, computer/phone type, credit cards and limits).

<a id="field-notes"></a>
## Field notes

| Field | What to know |
|---|---|
| **Hire Date, New Hire/Rehire, Employee Type, Hourly/Salary, Job Site Number, System Access, JR, 30-60-90** | Hidden and not asked. The System Access section is always open. |
| **Job Title** | Required — this is the employee's current title. |
| **Reporting Manager Email / Name** | Required; company domain only. The manager receives IT Setup Complete and Workflow Completed. |
| **Systems** | Same options as New Hire. **BOSS** reveals training-only / committees / cost sheet / trip reports / grievances. **Fleetio** creates a Fleet task. **Central Purchasing/Jonas** creates a Purchasing task with one line per site or job number. |
| **SiteDocs Supervisor** | Known issue #3: ticking it does **not** create a SiteDocs account task for the ID Setup team on equipment requests. Email `grp.forms.idsetup` separately if a SiteDocs login is needed. |
| **Equipment** | Computer (New / Reassignment; Chromebook default, Windows/Mac need IT Director approval), Mobile Phone, Credit Card (USA / Canada / Home Depot with monthly limit), Business Cards, SiteDocs Tablet, Vehicle (adds a line to the Fleet task only if Fleetio is also ticked). |
| **Credit card limits** | Known issue #15: the limit does not reach the Finance task ("Requested limit: Standard"). Repeat it in Comments. |
| **Comments** and every other text box | Must not start with `-`, `+`, `=` or `@` (the whole submit is rejected). |

<a id="on-submit"></a>
## What happens when you submit

1. The workflow `EQUIP_REQ_…` is created and the success screen shows the Request ID. No Internal Employee ID is assigned (the employee already has one).
2. Emails: **Request Submitted** to you; **IT Confirmation Required** to the IT Confirmation owner with a button to review the request.
3. Step: **IT Confirmation Needed** → after confirmation **IT Setup Needed** (`grp.forms.it` receives **IT Setup Required — Name**) → after IT Setup **Specialist Forms Needed** with tasks for Finance, Business Cards, Fleet and Purchasing as requested. You and the manager receive **IT Setup Complete**.
4. The request completes when every open task is finalized; HR, you and the manager receive **Workflow Completed: System & Equipment Request**.

Equipment requests never create 30/60/90, JR or WIS tasks, and there is no HR step.

<a id="common-mistakes"></a>
## Common mistakes and their messages

| What you see | Cause | Fix |
|---|---|---|
| Browser blocks submit on Job Title / Site / Manager / names | Required fields. | Fill them. |
| "Error Submitting Form: …" naming a field | A text box starts with `-`, `+`, `=` or `@` (#13), or a required value is missing. | Reword / fill in. Note: a rejected equipment submit can still leave an empty "In Progress" row on the dashboard (#6); ignore it or ask an admin to cancel it. |
| Same request appears twice | You submitted twice more than 30 seconds apart, or another requester submitted the same thing. Two submits from the **same** requester within 30 seconds are merged, even for different employees (#19 — fixed only for new hires). | Cancel the duplicate from its request details page. |
| No credentials email arrives | Equipment requests skip ID Setup, so there is no "Credentials Ready"; account details come in **IT Setup Complete**. | Wait for IT Setup. |

<a id="known-issues"></a>
## Known issues

- **SiteDocs account task never created (#3).** Workaround above.
- **Credit-card limit shows "Standard" (#15).** Workaround above.
- **Validation happens after the workflow row is created (#6).** A rejected submit can leave an orphan "In Progress" request with step *Initial Request* on the dashboard.
- **30-second duplicate guard keys on the requester only (#19, prod).** Space out submissions for different employees by more than 30 seconds.

<a id="differences"></a>
## How it differs from the New Employee form

| | New Employee Request | Equipment and Systems Request |
|---|---|---|
| Page heading | "New Employee Request" with the recruiting-requirements gate | "Equipment and Systems Request — Request equipment or system access for an existing employee." |
| Hire date, New Hire/Rehire, Employee Type, Hourly/Salary, Job Site Number, System Access, JR, 30-60-90 | Asked | Hidden; System Access section always open |
| Internal Employee ID | Assigned at submit | Not assigned |
| First team step | ID Setup | IT Confirmation |
| HR step | HR Verification | None |
| Credentials email | Credentials Ready (hourly, no access) or IT Setup Complete | IT Setup Complete only |
| Specialist tasks | Finance, Business Cards, Fleet, Purchasing, 30/60/90, JR, WIS, Safety | Finance, Business Cards, Fleet, Purchasing |
| Which tasks block completion | Only the blocking categories | Every open task except WIS |
| Email subject tag | `[New Hire \| Hourly]` etc. | `[Equipment Request]` |
| Dashboard type filter | New Hires | Equipment |

<a id="tracking"></a>
## Tracking it

Open the Workflow Dashboard, filter **Equipment**, and find the employee. "Current Action Pending" reads `IT Confirmation Needed`, then `Pending: IT`, then `Pending: <open task categories>` (for example `Pending: Finance, Fleet`). As requester you can press **Remind** on any badge (once per hour per step) and **Cancel Request** from the request details page. The Equipment step badges are Initial Request, IT CONF, IT SETUP and one per task category.
