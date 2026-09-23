# Action items and checklists (specialist tasks)

<a id="what-is-an-action-item"></a>
## What an action item is

An **action item** is a task the system creates for a team or person as part of a request: for example "Credit Card Setup — Ada Lovelace" for the credit-card team, "Safety Onboarding — Ada Lovelace" for Safety, "Asset Collection Checklist - Sam Smith" for a manager. Each has a **Task ID** (`TK-` plus 8 characters), a category (shown as a badge on the dashboard: SAFETY, FINANCE, FLEET, PURCHASING, 30/60/90, JR TITLE, WIS, ID SETUP, ADP/HR, DEACTIVATION, ASSETS …), a **checklist** of items, an assignee, and a status of **Open** or **Closed**.

Tasks are created:

- after **IT Setup** for new hires and equipment requests (credit card, business cards, Fleetio, purchasing, 30/60/90, JR, WIS);
- at **ID Setup** or after **HR Verification** for Safety Onboarding;
- when HR **approves** an End of Employment or Position / Site Change request (deactivation, ADP, EOE, asset collection, transfer setup, and so on).

<a id="open"></a>
## How to open your task

Click the red button in the email you received (**<Task name> Required**, or **Action Items Assigned — Name (N tasks)** which has one button per task). The link looks like `?form=action_item_view&tid=TK-…`. You can also open the request on the Workflow Dashboard and click the task badge. Any signed-in user on a company domain can open a task page; the email goes to the group or person the task is assigned to.

The page shows: the task name, "Action Item · TK-…", an **Open/Closed** badge, the request header (employee, site, dates), the **Verification Checklist**, a **General Action Notes** box, and — while the task is Open — the buttons **Save Progress** and **Mark Task Finalized**.

<a id="statuses"></a>
## Checklist statuses: Pending, Complete, Collected, Not Returned

Each checklist row has a status button group and a comments box (and, on asset tasks, a serial-number box for computers, laptops and tablets).

| Status | Where | Meaning |
|---|---|---|
| **Pending** | all tasks | Not done yet (the default). A task cannot be finalized while any row is Pending. |
| **Complete** | all tasks except asset collection | You did this item. |
| **Collected** | asset-collection tasks only (End of Employment, Position / Site Change returns) | The item was physically recovered. Record the serial where the box is shown. |
| **Not Returned** | asset-collection tasks only | The item was not recovered. A **comment is required** explaining why or what happens next. |

Your email address and the time are recorded against each row you change ("By: … · date").

Some tasks have extra rows:

- **Schedule Account Deletion** (IT deactivation tasks with a Google account): a calendar row showing the requested retention ("Default 1 Month then delete", "Longer …", "Delete Immediately"). Click it to open a Google Calendar event, then save the event; the row is marked "Scheduled for <date> — save the event in Google Calendar". It is not counted against finalizing.
- **Effective date** (Incoming Transfer Setup): a callout with the effective date and an "Add Effective Date to Calendar" button.
- **SiteDocs Account** (SiteDocs account setup task on an equipment request): SiteDocs Username, SiteDocs Password and BOSS WIS Created Yes/No. These are saved to the employee's ID Setup record when you finalize.

<a id="save-progress"></a>
## Saving a draft

**Save Progress** saves the row statuses, comments, serials and your notes without closing the task ("✓ Saved"). Use it when you are part way through or waiting on someone. Anyone in your group can open the task later and continue from where you left off; the task stays Open and keeps blocking the request.

<a id="finalize"></a>
## Finalizing (closing) the task

**Mark Task Finalized** closes the task. Checks first:

- "All items must be marked Complete or Not Returned before finalizing." — at least one row is still Pending.
- "Please add a comment for any items marked as 'Not Returned'." — asset tasks.

After success the page shows **Task Finalized** and the task shows as **Closed** with your email as *Closed By*. Reopening it shows everything read-only with "Task Finalized on <date>".

<a id="downstream"></a>
## What finalizing does downstream

- **No email is sent for most tasks.** The exceptions are asset-collection tasks, which email **Assets Returned: IT Equipment / Credit Card / Vehicle and Keys** to IT, the credit-card team or Fleet.
- **Special follow-ons:** finalizing ID Setup's **BOSS WIS User Account Update** (status change) creates the manager's **BOSS WIS Module Assignment** task and emails them; finalizing the **SiteDocs Account Setup** task on an equipment request writes the SiteDocs login to the employee's ID record; IT's status-change task is closed automatically when IT submits the IT Setup form.
- **Request completion.** After every close the system checks whether any *blocking* task is still Open. If none is, the request becomes **Complete** and HR, the requester and the manager receive **Workflow Completed** with a table of all tasks and who closed them.

Which tasks block completion:

| Request type | Blocking | Never blocking |
|---|---|---|
| New Hire | Safety, Finance (credit card), Business Cards, Fleet, 30/60/90 Review, Purchasing | JR Title, WIS (manager), IT Confirmation, ID Setup |
| Equipment | every open task | WIS |
| End of Employment | every open task | — |
| Position / Site Change | every open task | Manager (Incoming Transfer Setup), WIS |

So a New Hire can show **Complete** while its JR Assignment or WIS Assignment task is still Open; that is by design.

<a id="already-closed"></a>
## "This task has already been submitted."

Someone else in your group (or an automation, for JR tasks) finalized the task before you clicked. Nothing you entered was saved. Reload the page: it will show Closed and who closed it. If your notes matter, ask the Forms administrator to add them.

<a id="common-mistakes"></a>
## Common mistakes and messages

| What you see | Cause | Fix |
|---|---|---|
| "All items must be marked Complete or Not Returned before finalizing." | A row is Pending. | Set every row, or use Save Progress if you are not done. |
| "Please add a comment for any items marked as 'Not Returned'." | Asset task rule. | Add the comment. |
| "This task has already been submitted." | Closed by someone else. | See above. |
| "Error saving: …" / "System error: …" | Network or server error. | Retry; if it persists contact the Forms administrator with the TK- ID. |
| Access Denied | You are signed in with a non-company account. | Sign in with your work account. |
| Task page shows all rows Pending although the task is Closed | The task was closed by an automation (JR tasks) — known issue #11 for the older automation path. | Nothing to do; the task is closed. |
| I finalized the last task but no "Workflow Completed" arrived | The request may still have another blocking task open, or the request was already Complete/Cancelled. | Check the request on the dashboard: "Current Action Pending" lists what is still open. |
| Credit card task says "Requested limit: Standard" | Known issue #15. | Ask the requester for the limit. |
| Fleetio task on a status change has no removal lines | Known issue #17. | Read the request's Access Removal list. |
| I never got the JR task email | JR tasks go to `grp.forms.jrtitle` and are handled by an automation; they are created only when the request answered 30-60-90 = Yes, at IT Setup. | Check the dashboard JR TITLE badge. |
