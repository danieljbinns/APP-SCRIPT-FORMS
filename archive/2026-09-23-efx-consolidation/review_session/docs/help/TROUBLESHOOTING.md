# Troubleshooting

Symptom → likely cause → what to do. Request IDs (`NEW_EMP_…`, `TERM_…`, `CHANGE_…`, `EQUIP_REQ_…`) and Task IDs (`TK-…`) are in every email subject or button link; quote them when you ask for help.

<a id="no-email"></a>
## I didn't get the email

| Check | Explanation |
|---|---|
| Is it your step yet? | Each email is sent only when the previous step finishes. Safety's "Safety Onboarding Required" is sent at ID Setup (hourly, no access) or after HR Verification — not at submission. Specialist emails (credit card, Fleetio, purchasing, 30/60/90, JR, WIS) are sent after **IT Setup**. Payroll's "HR Verified" is sent after HR Verification. Look up the request on the dashboard: "Current Action Pending" tells you who has it. |
| Was it sent to your group, not you? | Step and task emails go to the group address (`grp.forms.hr`, `grp.forms.it`, `grp.forms.idsetup`, `grp.forms.safety`, `grp.forms.fleetio`, `grp.forms.creditcard`, `grp.forms.jonas`, `grp.forms.review306090`, `grp.forms.jrtitle`, `payroll@`). Check the group inbox or your group filters. |
| Are you expecting an email that does not exist? | Finalizing a task sends **no** email (except asset returns). IT Confirmation emails only IT (the requester and manager hear about it only if details changed, via "Information Updated"). Cancelling sends nothing. HR Verification **updates** send nothing. Equipment requests have no "Credentials Ready" — details come in "IT Setup Complete". |
| Did the routing skip you? | Hourly + no system access skips IT entirely (HR receives "IT setup will be skipped"). IT Confirmation happens only when BOSS was requested (new hires) or for every equipment request. A New Hire with 30-60-90 = No has no 30/60/90 or JR task. Vehicle without Fleetio creates no Fleet task. |
| Subject has `[TEST]` or you received someone else's mail | A test copy of the system redirects all mail to one inbox. Ignore test mail; report it if you see it in production. |
| Still nothing | Ask an HR/IT/admin user to press **Remind** on the step (one per hour per step), or contact the Forms administrator with the request ID. |

<a id="access-denied"></a>
## I can't open the form ("Access Denied — You do not have permission to view this resource.")

| Form | Who can open it |
|---|---|
| New Employee, Equipment, End of Employment, Position / Site Change requests; Dashboard; request details; task pages | Anyone signed in on `team-group.com`, `robinsonsolutions.com` or `industrialappliedtech.com` |
| ID Setup | `grp.forms.idsetup` members, app admins |
| HR Verification | `grp.forms.hr` members, app admins |
| IT Setup | `grp.forms.it` members, app admins |
| Termination approval, Position change approval | `grp.forms.hr` or `payroll@` members can **open**; only HR (and admins) can **submit** |
| IT Confirmation | the IT Confirmation owner, `grp.forms.it`, app admins |

Fixes: sign in with your work account (a personal Google account gives Access Denied everywhere); if you should be in the group, ask the group owner (see who-to-contact); otherwise forward the email to a member of the right group. Note: `stgroup.ca` is accepted as a manager email but is not a sign-in domain for the portal.

<a id="field-rejected"></a>
## My field was rejected / "Error Submitting Form: …"

- **A text box starts with `-`, `+`, `=` or `@`.** New Employee and Equipment requests reject the whole submit if *any* text field begins with one of those characters — a comment like "- see below", a limit like "-500", an address typed into a name box. Reword so the first character is a letter or digit. (Known issue #13.)
- **"Missing required fields: …"** — fill in the named field; required fields have a red asterisk.
- **Manager/email field rejected in the browser** — must be a company domain; pick from the autocomplete list so the name fills in.
- **"Internal Employee ID is pre-assigned (…) and cannot be changed here."** (ID Setup) — leave the pre-assigned number.
- **IT Setup will not submit with Email Account Created = No** — the username/domain/password boxes are still required; enter a placeholder.
- **"All items must be marked Complete or Not Returned before finalizing." / "Please add a comment for any items marked as 'Not Returned'."** — task checklist rules.

<a id="wrong-manager"></a>
## The request shows the wrong manager

| Situation | What to do |
|---|---|
| New hire, before HR Verification | HR can correct the manager name and email on the HR Verification form; the corrected manager is used from then on (WIS task, completion email). Tell HR. |
| New hire, after HR Verification | The IT Confirmation reviewer (BOSS hires) can change it; otherwise contact the Forms administrator. The manager's WIS task, once created, stays with the original assignee. |
| Position / Site Change: "Status Change Approved" or the transfer task went to the **old** manager | Known issue #16. HR should set **Confirmed New Manager Email** on the approval page; requesters should always fill **Receiving Manager Email**. If already approved, forward the email to the right manager. |
| The requester picked themselves as manager | Cancel and resubmit, or ask HR to fix it at HR Verification. |

<a id="employee-id-mismatch"></a>
## The ID Setup page shows a different employee ID than the email

Since **2026-09-17** the Internal Employee ID is assigned the moment the New Employee Request is submitted, and the same number is shown on the request record, the ID Setup page and every later email. A mismatch can only happen for requests submitted **before** that date, where the ID Setup page used to predict the next number when it was opened. For those, the number the server assigns at ID Setup **submit** is the final one. If the page's predicted number differs from it, the submit is rejected with "Internal Employee ID is pre-assigned (…) and cannot be changed here." — copy the number from that message into the field and resubmit. Otherwise do not edit the field; non-admin edits are rejected. The final number is the one that appears in "Credentials Ready" / "IT Setup Complete".

<a id="already-closed"></a>
## The task says "This task has already been submitted."

Someone else finalized it first — another member of your group, or the JR automation for JR tasks. Reload to see *Closed By*. Nothing you typed was saved; if your notes matter, send them to the Forms administrator with the TK- ID. A reminder on a closed task shows "Action Item not found or already closed".

<a id="duplicates"></a>
## The same request appears twice / two ID Setup records

- Two submissions of the same hire within ~30 seconds are merged into one request. Different requests from the same requester within 30 seconds may also be merged for Equipment, End of Employment and Position / Site Change (known issue #19) — wait between submissions.
- Two **ID Setup** records for one request (known issue #12) come from submitting the ID Setup form twice; pages may show either. Ask ID Setup which is right and do not resubmit.
- A request stuck at step *Initial Request* with no data is an orphan from a failed submit (known issue #6); ask HR/IT/admin to cancel it.

<a id="stuck"></a>
## The request is stuck

1. Open it on the dashboard; read **Current Action Pending**.
2. Press **Remind** on that step (HR, IT, admins, the requester or the manager can; one per hour per step).
3. If the **IT CONF** badge is still open after IT Setup was done, that is the never-closing IT Confirmation task (known issue #8) — it does not block and is left out of the "Pending:" list; the request will still complete.
4. If it is Complete but a JR TITLE or WIS badge is open, that is normal: those never block.

<a id="who-to-contact"></a>
## Who do I contact

| About | Contact |
|---|---|
| A New Hire's HR Verification, approvals, EOE, ADP updates, cancelling on your behalf | `grp.forms.hr@team-group.com` |
| IT Setup, IT deactivation, access to the portal, technical errors on any page | `grp.forms.it@team-group.com` |
| ID Setup, SiteDocs / DSS accounts, Employee Deactivation, BOSS WIS accounts, Internal Employee IDs | `grp.forms.idsetup@team-group.com` |
| Safety Onboarding, SiteDocs locations, DSS learning paths | `grp.forms.safety@team-group.com` |
| Fleetio, vehicles | `grp.forms.fleetio@team-group.com` |
| Credit cards | `grp.forms.creditcard@team-group.com` |
| Central Purchasing / Jonas | `grp.forms.jonas@team-group.com` |
| 30/60/90 review plans | `grp.forms.review306090@team-group.com` |
| JR title assignment | `grp.forms.jrtitle@team-group.com` (handled by an automation) |
| Payroll / ADP deactivation | `payroll@team-group.com` |
| Business cards, IT Confirmation | a named IT contact — reach them via `grp.forms.it@team-group.com` |
| The forms system itself (bugs, orphan rows, ID overrides, notes on a closed task) | the Forms administrator, `dbinns@team-group.com` — include the request ID or TK- ID |

Process help only: pay, discipline and policy questions go to HR, not to this system.

<a id="not-on-dashboard"></a>
## I submitted, but the request is not on the dashboard

- The dashboard hides **Cancelled** requests by default — click the **Cancelled** filter.
- Check the **Type** filter: New Hires, End of Employment, Status Change, Equipment.
- Press **Refresh**; the dashboard reads a cached view that is updated after each step.
- Admins can **Hide** requests from the list; if a request has vanished for everyone, ask the Forms administrator.

<a id="lost-credentials"></a>
## I lost the email with the passwords

Temporary passwords appear only in emails sent to the requester and manager: **Credentials Ready** (hourly, no system access — DSS and SiteDocs), **Onboarding Complete**, **IT Setup Complete** (Google account temporary password) and **Workflow Completed** (also sent to HR). They are not shown on the dashboard or task pages, and nobody can look them up for you through the system. Ask the team that created the account (`grp.forms.idsetup` for DSS/SiteDocs, `grp.forms.it` for the Google account) to reset it.

<a id="change-start-date"></a>
## I need to change the start date

HR, IT or an admin can open the request details page and click **Edit Start Date** (format YYYY-MM-DD). HR can also change it on the HR Verification form, which records `[START DATE CHANGED: old → new]` in the HR notes and emails **Information Updated** to the requester and manager. Requesters and managers cannot change it themselves — ask HR. A start date under 3 business days away only shows a warning on the New Employee form; nothing enforces it later.

<a id="cancel-request"></a>
## I need to cancel a request

Open the request from the dashboard and click **Cancel Request**. Allowed for HR, IT, admins, the requester and the manager; anyone else sees "Permission denied. HR, IT, Admin, the requester, or the manager can cancel requests." Cancelling marks the request and all its open tasks Cancelled and sends **no email** — tell the teams that had already started. A cancelled request cannot be reopened; submit a new one.

<a id="missing-task"></a>
## A task I expected was never created

| Expected task | Why it may be missing |
|---|---|
| Fleet (Fleetio Access) on a new hire or equipment request | Created only when **Fleetio** is ticked under Systems; ticking Vehicle alone does nothing. |
| SiteDocs Account Setup on an equipment request | Known issue #3 — never created. Email `grp.forms.idsetup`. |
| 30/60/90 or JR task | Created only on **New Hire** requests with "30-60-90 Day Plan Required? = Yes", and only after **IT Setup**. Never on status changes or equipment requests. |
| Safety Onboarding | Created at ID Setup (hourly, no access) or after HR Verification — not at submission. |
| Any specialist task on a new hire | Created at IT Setup; a hire that is hourly with no system access never reaches IT Setup and gets no specialist tasks (Safety excepted). |
| IT task on a status change | Created only if some IT system, equipment or removal was requested (Jonas, Fleetio, SiteDocs, business cards, credit card and vehicle are handled elsewhere — and Vehicle on a status change creates no task at all). |
| Vehicle on a status change | No task; contact `grp.forms.fleetio`. |
