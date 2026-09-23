# HR Verification

<a id="purpose"></a>
## Purpose and who fills it

HR Verification is the HR team's step in a New Employee Request. HR confirms that the details submitted by the requester match what is on file in ADP, corrects anything that differs, assigns the **ADP Associate ID** and, where a JR was requested, confirms the **JR title**. Submitting it decides the next step: finish (hourly, no system access), IT Confirmation (BOSS requested) or IT Setup (everyone else).

You reach it from the **HR Verification Required** email (`?form=hr_verification&wf=…`). Only members of `grp.forms.hr` and app admins can open **and** submit it. Payroll receives the email for information but cannot open the form.

<a id="before-you-start"></a>
## Before you start

Have the ADP record open. The page header shows the request (employee, title, site, hire date, Internal Employee ID) and pre-fills every field from the request. The banner reads: "Please confirm the employee details below match what is on file in ADP before assigning the Associate ID. Update any fields that differ from the official record."

<a id="field-notes"></a>
## Field notes

| Field | What to know |
|---|---|
| **Site**, **Hire Date**, **Department** (Request Context) | Editable. Changing the hire date is allowed here and is recorded in the notes as `[START DATE CHANGED: old → new]`; the new date replaces the original on the request and in all later emails. |
| **First Name / Last Name** (required) | The verified name overwrites the request and becomes the "Verified Name" used everywhere after this step. |
| **Reporting Manager Name / Email** (required) | Correct these if the requester picked the wrong manager. The manager on record after this step receives the IT Setup Complete / Workflow Completed emails and the WIS Assignment task. |
| **Job Title (HR Title)** (required) | The official title. It replaces the requested position title on the record. |
| **JR Title (Verified Position)** | Shown only when the request answered **JR Required? = Yes**; then it is required. Pre-selected with the requester's choice, marked "(Original)" if that title is no longer in the JR list. Stored as "Job Title / JR Title" on the HR record. |
| **ADP Associate ID** (required) | The employee's ADP ID (e.g. `123456`). Shown in later emails and in the request header as `HR ✓`. |
| **Internal HR Notes** | Optional, kept with the HR record (the start-date flag is prepended automatically). |

<a id="on-submit"></a>
## What happens when you submit

Button: **Submit Verification**. Success message: "HR Verification and ADP ID setup completed successfully."

Routing, in order of precedence:

1. **Hourly and System Access = No** → the request is marked **Complete** (step *HR Verification Complete*). Requester and manager receive **Onboarding Complete** with the DSS/SiteDocs credentials. No IT step, no specialist tasks.
2. Otherwise, if the request's Systems include **BOSS** → step **IT Confirmation Needed**; the IT Confirmation owner receives **IT Confirmation Required — Name** and an IT Confirmation task is created.
3. Otherwise → step **IT Setup Needed**; `grp.forms.it` receives **IT Setup Required**.

In cases 2 and 3, Payroll receives **HR Verified** (with "— Salary Access Required" when ADP salary access was requested) and the **Safety Onboarding** task is created and emailed to `grp.forms.safety`.

If any verified field differs from the original request, the requester and manager receive **Information Updated** listing the changes; Safety and ID Setup are copied when the change could affect them.

<a id="editing"></a>
## Editing after you have submitted

Opening the form again for the same request shows the banner "Previously Submitted — Edit Mode … Changes will update the existing record and be logged for auditing." and the button reads **Update Verification**. An update **only** changes the HR record: it does not move the workflow, re-send any email or re-run the routing. Message: "HR Verification updated successfully. No downstream emails re-sent." If the correction must reach IT or others, tell them directly.

<a id="common-mistakes"></a>
## Common mistakes and their messages

| What you see | Cause | Fix |
|---|---|---|
| Access Denied | You are not in `grp.forms.hr` (Payroll members cannot open this form). | Ask an HR group member to complete it. |
| JR Title dropdown shows "(Original)" next to the value | The requested JR title is not in the current JR list. | Pick the correct current title. |
| Submitted, but IT did not get IT Setup Required | The request includes BOSS, so it went to **IT Confirmation** first; or the hire is hourly with no access, so IT is skipped. | Check the dashboard step; see [Statuses and steps](STATUSES_AND_STEPS.md#new-hire). |
| Requester asks why the New Hire/Rehire value later disappeared | Known issue #1 — IT Confirmation blanks it. | Nothing HR can do; note it in HR Notes if it matters. |

<a id="known-issues"></a>
## Known issues

- **Second ID Setup record (#12).** If ID Setup was submitted twice, the credentials shown to you and in emails may come from either record. Ask ID Setup which is correct.
- **Rehire status blanked after IT Confirmation (#1).**

<a id="request-header"></a>
## Reading the request header

The header above the form shows the request ID, type (`New Hire`) and Hourly/Salary badge, then a step tracker: `Init ✓`, `ID ✓` (an Internal Employee ID exists), `HR ⏳` (turns to `HR ✓` once you submit an ADP Associate ID), `IT ⏳`. Below it: first/last/middle/preferred name, job title, JR title (if requested), site, job site number, department, hire date. If `ID ⏳` is still showing, ID Setup has not been submitted — the request should not have reached you; check the dashboard.

<a id="what-changes-where"></a>
## What your answers change

| You change… | Effect |
|---|---|
| Name, manager, title, site, department, hire date | Replaces the original request values; every later page and email uses your values. |
| JR Title | Stored on the HR record as "Job Title / JR Title" and shown to IT, Safety and in the JR Assignment task context. |
| ADP Associate ID | Shown in all later emails and in the request header. |
| Anything, on a second visit (Edit Mode) | Only the HR record changes; no emails, no step change. |

<a id="dashboard"></a>
## What HR sees on the dashboard

HR can see every request and every step's details, Remind on any step, Cancel any request and edit start dates. The **HR Verification** badge shows Pending until you submit; the **ADP/HR** badge on End of Employment and Position / Site Change requests is HR's ADP / EOE task, which is a separate action item (see [Action items](ACTION_ITEMS_AND_CHECKLISTS.md)).
