# IT Setup

<a id="purpose"></a>
## Purpose and who fills it

IT Setup is where the IT team (`grp.forms.it`) records what it provisioned for a New Employee Request, an Equipment and Systems Request, or the IT part of a Position / Site Change: Google account, computer, phone, BOSS access and other system access. Submitting it emails the requester and manager, and — for new hires and equipment requests — creates the specialist action items (credit card, business cards, Fleetio, purchasing, 30/60/90, JR, WIS).

You reach it from **IT Setup Required** (`?form=it_setup&wf=…`). Only IT group members and app admins can open and submit it.

<a id="before-you-start"></a>
## Before you start

The page header shows the request and what was asked for: the requested email address and domain, computer request (type, previous user, serial), phone request, BOSS committees, cost-sheet jobs, trip reports and grievances, plus the Internal Employee ID and any SiteDocs/DSS details from ID Setup. Do the provisioning first, then record the results here. Have the temporary passwords to hand.

<a id="field-notes"></a>
## Field notes

| Section / field | What to know |
|---|---|
| **Email Account Created** (required) | Yes/No. The assigned email is saved only when this is **Yes**. |
| **Email Username / Email Domain / Temporary Email Password** (required) | Username is the part before the `@` (pre-filled from the request); domain is a dropdown (`@team-group.com`, `@robinsonsolutions.com`, `@industrialappliedtech.com`). Quirk: these three fields are required even when Email Account Created = No — enter a placeholder such as `N/A` to get past the browser check. The temporary password is emailed to the requester and manager in **IT Setup Complete**. |
| **Computer Assigned** (required), Serial Number, Model, Type | Type options: Chromebook, Windows PC, Mac. Serial/model/type are optional and default to N/A. |
| **Phone Assigned** (required), Carrier, Model, Phone Number, Voicemail Password | Optional details default to N/A. |
| **BOSS Access Granted** (required) | Yes/No. Below it, one checkbox per committee and cost-sheet job the request asked for, plus Trip Reports and Grievances — tick each once assigned. These are recorded as a BOSS details summary. |
| **Additional System Access** | Incidents, CAA, Delivery App, Net Promoter Score — tick what was granted; unticked means No. |
| **IT Setup Notes** | Optional. |

<a id="on-submit"></a>
## What happens when you submit

Success message: "IT Setup Complete — The requester and specialist teams have been notified."

For a **New Employee** or **Equipment** request (first submission):

1. The step becomes **Specialist Forms Needed**.
2. Action items are created and emailed — see the table in [Statuses and steps](STATUSES_AND_STEPS.md#new-hire): Credit Card Setup, Business Cards, Fleetio Access, Central Purchasing/Jonas Setup, and (new hires only) 30/60/90 Review Plan, JR Assignment and the manager's WIS Assignment. Each group gets one email: **<Task name> Required**, or **Action Items Assigned — Name (N tasks)**.
3. Requester and manager receive **IT Setup Complete** with the assigned email, temporary password and equipment details.
4. If no blocking specialist task was needed, the request may complete straight away and **Workflow Completed** is sent.

For a **Position / Site Change**: submitting closes the IT task on that request (with your form data attached) and sends **IT Setup Complete** to the requester and manager. The request completes when the other status-change tasks are closed.

<a id="editing"></a>
## Submitting a second time

Opening IT Setup again for the same request overwrites your earlier answers in place and logs the edit. It does **not** create specialist tasks again or move the step, but it does re-send **IT Setup Complete** to the requester and manager.

<a id="common-mistakes"></a>
## Common mistakes and their messages

| What you see | Cause | Fix |
|---|---|---|
| Browser will not submit; Email Username/Domain highlighted although no email was created | Static required fields (quirk above). | Enter a placeholder and pick any domain; the assigned email is not saved when Email Account Created = No. |
| Access Denied | Not in `grp.forms.it`. | Ask an IT group member. |
| Specialist tasks were not created | This was a re-submission, or a Position / Site Change (which has its own tasks from HR approval). | Check the dashboard badges; use Remind on the existing task. |
| Fleet task missing although Vehicle was ticked | The Fleet task is only created when **Fleetio** was ticked under Systems; Vehicle just adds a line to it. | Ask Fleet directly, or have the requester submit an Equipment request with Fleetio. |
| Equipment request: no SiteDocs account task appeared | Known issue #3 — the "SiteDocs Supervisor" tick never creates the ID Setup task on equipment requests. | Email `grp.forms.idsetup` with the request ID. |

<a id="known-issues"></a>
## Known issues

- **Position / Site Change writes two IT records (#7).** Your IT Setup for a status change is stored twice (once by the form, once by the task closure). Harmless; do not resubmit to "fix" it.
- **Email fields required even when no email was created** (form quirk, see above).
- **IT Confirmation task never closes (#8).** On BOSS new hires the "IT Confirmation Required" task stays Open on the dashboard even after IT Setup; it does not block completion.

<a id="request-header"></a>
## What the page header tells you

| Shown | Comes from |
|---|---|
| Request ID, type, Hourly/Salary, step tracker (`Init ✓ ID ✓ HR ✓ IT ⏳`) | The request and the ID Setup / HR Verification records |
| Employee name, job title, JR title, site, job site number, department, hire date | The request, as corrected by HR (and by IT Confirmation for BOSS hires and equipment requests) |
| Internal Employee ID, SiteDocs worker ID and job code, DSS username | ID Setup |
| ADP Associate ID | HR Verification |
| "Requested: New — Chromebook · Prev user … · S/N …" callouts under Computer and Phone | The request's computer and phone sections |
| BOSS committees, cost-sheet jobs, trip reports, grievances checkboxes | The request's BOSS section (or the IT Confirmation values) |
| Requested email and domain pre-filled | The request's Google Account section |

If the header shows `HR ⏳` on a new hire, HR Verification has not happened; the request should not normally be at IT Setup unless it is an equipment request (which has no HR step).

<a id="dashboard"></a>
## What IT sees on the dashboard

IT can see every request, Remind on any step, Cancel any request and edit start dates. The **IT SETUP** badge is Pending until IT Results exist for the request ("Pending: IT" in Current Action Pending). On End of Employment requests IT's work is the **IT Systems Deactivation** action item (badge IT SETUP) with its Google offboarding rows and the "Schedule Account Deletion" calendar step — see [Action items](ACTION_ITEMS_AND_CHECKLISTS.md#statuses).
