# Position / Site Change (Status Change) and HR approval

<a id="purpose"></a>
## Purpose and who fills it

Use **Position / Site Change** for an existing employee whose site, department, job title, classification (hourly/salary) or reporting manager is changing — including any system access to add or remove and equipment to issue or return, all in one request. It creates a `CHANGE_…` workflow (shown as **Status Change** on the dashboard). HR approves or rejects; approval creates tasks for the receiving manager, IT, ID Setup, Safety, HR/Payroll and any specialists.

Anyone signed in with a company account can submit it — normally the current manager. Your name and email are filled in from your login.

<a id="before-you-start"></a>
## Before you start

Have ready: employee's first and last name, current classification, current title and manager, effective date, current site; the type(s) of change and their old → new values; direct-report changes; whether the employee already has a Google account; systems to add or remove; equipment to request or return; supporting documents.

<a id="field-notes"></a>
## Field notes

| Field | What to know |
|---|---|
| **Current Classification** (required), **Effective Date** (required), **Site Name** (required) | The effective date appears in every subject ("Effective Date: yyyy-mm-dd"). |
| **Current Manager Email / Name** | Optional but recommended: "Current direct manager — will be notified of the change" (**Status Change Initiated** email). Email and name must be given together. |
| **Type of Change** | Tick any of Site Transfer, Position Change, Classification, Manager Change; each opens a section. |
| **Site Transfer / Department Change** | Current Site → New Site ("Same site is valid — use this section for department-only changes"), New Department, **Receiving Manager Email** (asterisk; the manager at the receiving site who will onboard the employee — they receive the Incoming Transfer task). |
| **Position Change** | Current Title → New Title. HR confirms the final title on approval. |
| **Classification Change** | Old → New (Hourly/Salary). Shown in the subject as `Hourly -> Salary`. |
| **Reporting Manager Change** | Old and New manager (email + auto-filled name). Known issue #16: the system's routing check looks for a value the checkbox never sends, so the **Status Change Approved** email and manager tasks can go to the **old** manager unless HR fills in **Confirmed New Manager Email** on the approval page or you fill in **Receiving Manager Email**. Fill in Receiving Manager Email even for a pure manager change. |
| **Reporting Management** (required) | Did the employee have direct reports? (Yes → who takes them). Is the employee gaining reports? (Yes → who they reported to before). These feed the HR/Payroll **ADP Update** task. |
| **Existing Google Account?** (required) | Yes → Existing Email Address (required). |
| **NEW System Access Needed** | ADP Supervisor Access (salary access + ADP sites), BOSS (training-only / committees / cost sheet / trip reports / grievances), CAA, Delivery, DSS, Fleetio (Fleet task), New Google Account (email + domain), Incidents, Central Purchasing/Jonas (Purchasing task), Net Promoter Score, **Sitedocs Supervisor Access** (creates a SiteDocs Account Setup task for ID Setup — note the on-form warning next to it). |
| **JR & Training** | JR Required?, 30-60-90 Plan Required?, Select JR Title. These are stored and shown to HR, but **no** JR or 30/60/90 task is created for a status change (unlike a new hire). HR selects the confirmed JR title on approval. |
| **Equipment Request** | Same options as New Hire (Business Cards, Computer, Credit Card with limits, Mobile Phone, SiteDocs Tablet, Vehicle). Credit Card creates a Finance task; Business Cards a Business Cards task; Computer and Mobile Phone go to the IT task. **Vehicle creates no task on a status change** (the IT task excludes it and there is no Fleet "add vehicle" task for this form) — contact `grp.forms.fleetio` directly. |
| **Equipment to Return** | Computer, Mobile Phone, SiteDocs Tablet, Vehicle (creates a **Vehicle Return** task for Fleet), Credit Card. Any return creates an **Asset Collection** task for the old manager. |
| **Access Removal** | ADP, BOSS, CAA, Delivery, Fleetio (Fleetio Access Removal task), Google Account, SiteDocs (SiteDocs Access Removal task for ID Setup). |
| **Rationale / Additional Comments**, **Upload Supporting Docs** | Attachment is saved to Drive and linked for HR. |

<a id="on-submit"></a>
## What happens when you submit

1. Workflow `CHANGE_…` at step **HR Approval Needed**.
2. Emails: **HR Approval Required** to HR and Payroll (approval button); **Status Change Initiated** to the current manager ("pending HR review; you will be notified of the outcome").

<a id="approval"></a>
## The HR approval page

Reached from the HR email (`?form=position_change_approval&wf=…`). HR and Payroll can open it; only HR (and admins) can submit. Fields:

- **Confirmed New Manager Email** — pre-filled from Receiving Manager / New Manager. "Update if the effective manager has changed." This is the value the tasks and the approval email use, so **check it** (works around #16).
- **Confirmed Job Title** — free text as it should appear on record.
- **Confirmed JR Title** — "JR titles drive safety, learning, and system access assignments. Select the correct JR for the new role." Shown in the emails to Safety and others; not stored on the approval record.
- **Approve Change** / **Reject**, Notes, **Submit Decision**.

On **Approve**: step **Action Items Pending** and these tasks/emails:

| Task (recipient) | Created | Blocks completion? |
|---|---|---|
| Incoming Transfer Setup (receiving/confirmed manager) — **Incoming Transfer Action Required**, with an "Add Effective Date to Calendar" button | when a receiving manager is known | No |
| IT Access & Equipment Setup (`grp.forms.it`) — **IT Action Required**, button opens the IT Setup form | any IT system, equipment or removal | Yes |
| ADP Update Required (HR + Payroll) | always | Yes |
| BOSS WIS User Account Update (ID Setup) — closing it then creates **BOSS WIS Module Assignment** for the manager | always | Yes (the manager's follow-on task: No) |
| Safety System Updates (Safety) | always | Yes |
| Business Cards Order, Credit Card Order, Fleetio Access Update, Vehicle Return, Fleetio Access Removal, Central Purchasing/Jonas Update, SiteDocs Access Removal, SiteDocs Account Setup, Asset Collection | as requested | Yes |

Requester and new manager receive **Status Change Approved**. On **Reject**: status Rejected, **Status Change Rejected** email. A second decision returns "Approval already processed for this workflow."

<a id="common-mistakes"></a>
## Common mistakes and their messages

| What you see | Cause | Fix |
|---|---|---|
| "Status Change Approved" went to the old manager | Known issue #16. | HR: fill Confirmed New Manager Email. Requester: fill Receiving Manager Email. |
| Only one Fleetio task although access was both added and removed | Known issue #17: the add and remove tasks collapse into one; the removal checklist is dropped though both emails are sent. | Fleet: read the request's **Access Removal** list and do the removal as part of the single task; note it in the task notes. |
| Expected a 30/60/90 or JR task | Not created for status changes. | Arrange the review with `grp.forms.review306090` directly, or submit the plan via the manager. |
| Manager email without name error | Autocomplete not used for one of the manager fields. | Pick from the list. |
| Empty "In Progress" row after a failed submit | Known issue #6. | Ask HR/admin to cancel it. |

<a id="known-issues"></a>
## Known issues

- **#16 old-manager routing** and **#4 dead "Reporting Manager Change" branch** — same root cause; use Confirmed New Manager Email.
- **#17 Fleetio add + remove merged into one task.**
- **#5 Yes/No checkboxes stored as lists** (salary access, credit cards) — invisible to users; behaves correctly today.
- **#7 IT results saved twice** when IT completes its task — harmless.
- **JR / 30-60-90 answers have no effect on tasks** for this form.
