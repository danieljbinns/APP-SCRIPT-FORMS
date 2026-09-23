# Glossary

Short definitions of the terms used in the forms, emails and dashboard.

<a id="ids"></a>
## Identifiers

| Term | Meaning |
|---|---|
| **Workflow ID / Request ID** | The identifier of one request, shown on the success screen, in every email and on the dashboard. Prefix tells the type: `NEW_EMP_` new employee, `EQUIP_REQ_` equipment and systems, `TERM_` end of employment, `CHANGE_` position/site (status) change. Format: prefix + date-time + three digits, e.g. `NEW_EMP_20260916-141500_123`. |
| **Internal Employee ID** | TEAM Group's own employee number (30000 and up). Assigned automatically when a New Employee Request is submitted (since 2026-09-17), shown on the ID Setup page and in later emails. Not the ADP ID. Only app admins can override it. |
| **ADP Associate ID** | The employee's ID in ADP, entered by HR at HR Verification. |
| **Task ID** | `TK-` plus 8 characters, e.g. `TK-8247F3AB`. Identifies one action item; appears in the task page subtitle and the button link. |
| **Form ID** | Internal record number of one submitted step (e.g. `INIT_REQ_…`, `ID_SETUP_…`); you rarely need it. |

<a id="roles"></a>
## People and roles

| Term | Meaning |
|---|---|
| **Requester** | The person who submitted the request; filled in automatically from their login. Receives "Request Submitted", credentials/IT Setup Complete, and "Workflow Completed"; can Remind and Cancel their own requests. |
| **Reporting manager / manager** | The employee's manager as entered on the request (and corrected by HR). Receives the same completion emails as the requester, plus the WIS Assignment task for new hires and the asset checklist on terminations. |
| **Receiving manager** | On a site transfer, the manager at the new site; receives the Incoming Transfer Setup task. |
| **Specialist** | A team that gets an action item near the end of a request: Finance (credit card), Business Cards, Fleet (Fleetio), Purchasing (Jonas), 30/60/90 Review, JR Title, Safety, ID Setup, WIS. |
| **HR Verification** | The HR step on a new hire: confirm details against ADP, assign the ADP Associate ID, confirm the JR title; decides whether the request goes to IT Confirmation, IT Setup or finishes. |
| **IT Confirmation** | A review of the original request by a named IT contact before IT Setup — for BOSS new hires and all equipment requests. |
| **ID Setup** | The team and step that create the employee's SiteDocs and DSS accounts and record the Internal Employee ID. |
| **App admin** | A small list of administrators who can open any form, cancel or remind on any request, edit start dates and override the employee ID. |

<a id="tasks"></a>
## Tasks and statuses

| Term | Meaning |
|---|---|
| **Action item** | A task with a checklist created for a team or person; Open until finalized (Closed). See [Action items](ACTION_ITEMS_AND_CHECKLISTS.md). |
| **Blocking task** | A task that must be closed before the request can become Complete. JR Title, WIS, Manager and IT Confirmation tasks never block. |
| **Pending / Complete** | Checklist row statuses on a normal task. |
| **Collected / Not Returned** | Checklist row statuses on asset-collection tasks; "Not Returned" needs a comment. |
| **Save Progress / Mark Task Finalized** | Save a draft without closing, or close the task. |
| **Remind (bump)** | Dashboard button that re-sends a step's email to its owner; limited to one per step per hour. Subject starts `REMINDER [Requested: date]:`. |
| **Current Action Pending** | Dashboard column that names who has the request now, e.g. `Pending: HR Verification`, `Pending: Safety, Finance`. |

<a id="systems"></a>
## Systems named on the forms

| Term | Meaning |
|---|---|
| **SiteDocs** | The safety documentation system every employee gets a worker record in. ID Setup records the SiteDocs Worker ID, Job Code (`Hourly 1/2`, `Salary 1/2`, `Supervisor`, `Manager`) and badge link; Safety assigns SiteDocs locations. "SiteDocs Supervisor" on a request means an admin/training login is also needed. |
| **DSS (DSS+)** | The training platform every employee gets an account in. ID Setup sets the username (`first.last`) and a temporary password; Safety assigns DSS learning paths. (The mapping notes refer to it alongside Litmos, the learning-management product it runs on.) |
| **BOSS** | The internal operations system with committees, cost-sheet, trip-report and corrective-counselling/grievance modules, a training-only user type, and the WIS module. Requesting BOSS on a new hire adds the IT Confirmation step. |
| **WIS** | Work Instructions & Safety — a BOSS module. The manager receives a "WIS Assignment" task to assign WIS modules to the new employee (or training modules only, for a BOSS training-only user). ID Setup confirms the "BOSS WIS account". |
| **ADP** | Payroll/HR system. "ADP Supervisor Access" and "salary access" on a request create Payroll/HR actions; HR assigns the ADP Associate ID. |
| **Jonas / Central Purchasing** | The purchasing system; access is set up per purchasing site or job number by `grp.forms.jonas`. |
| **Fleetio** | Fleet management system; `grp.forms.fleetio` creates the account and assigns vehicles. |
| **CAA, Delivery, Incidents, Net Promoter Score** | Additional apps IT can grant; recorded as Yes/No on IT Setup. |
| **Google Account** | The employee's company email; IT creates it during IT Setup. On termination, forwarding, Drive transfer, delegation, retention period and vacation responder are handled by IT. |

<a id="hr-terms"></a>
## HR terms

| Term | Meaning |
|---|---|
| **JR title** | A standardised job-role title chosen from a list. "JR titles drive safety, learning, and system access assignments." Requested on the New Hire form, confirmed by HR at HR Verification (or on a status-change approval), and the subject of the JR Assignment task. |
| **30/60/90 (30-60-90 Day Plan)** | A structured review plan for a new hire at 30, 60 and 90 days. Answering Yes on the New Hire form creates a 30/60/90 Review Plan task (blocking) and a JR Assignment task (non-blocking) after IT Setup. |
| **EXPEDITE** | Email-subject flag for hourly hires who need system access and therefore follow the full HR → IT path. |
| **EOE** | End of employment; HR's "Complete EOE Process" task on every approved termination. |
| **Rehire** | A returning employee. Marked on the New Hire form; does not change routing and gets a new Internal Employee ID unless an admin overrides it. |
