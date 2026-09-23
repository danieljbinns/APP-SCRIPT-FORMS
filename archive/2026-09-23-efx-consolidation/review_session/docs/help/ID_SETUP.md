# ID Setup (Employee ID Setup form)

<a id="purpose"></a>
## Purpose and who fills it

ID Setup is the first team step after a New Employee Request is submitted. The ID Setup team (`grp.forms.idsetup`) records the employee's identifiers and training-platform logins: the Internal Employee ID, SiteDocs worker ID and job code, DSS username and password, optional SiteDocs admin login, and confirmations that the BOSS WIS account and SiteDocs badge link were created.

You reach it from the button in the **ID Setup Required** email (`?form=id_setup&wf=NEW_EMP_…`). Only members of the ID Setup group (and app admins) can open it; anyone else sees Access Denied. Equipment requests do not have this step.

<a id="before-you-start"></a>
## Before you start

The page header shows the request: employee, job title, site, job site number, department, hire date and the step tracker (`Init ✓  ID ⏳  HR ⏳  IT ⏳`). Before you fill in the form, create the accounts in the external systems:

- SiteDocs worker record (you will need the **Worker ID** it assigns).
- DSS training account (username defaults to `first.last`; you set a temporary password).
- If the request asked for **SiteDocs Supervisor**, a SiteDocs admin/training login (username defaults to the requested Google address, e.g. `first.last@team-group.com`).
- BOSS WIS account and SiteDocs badge link, if you create those at this stage.

<a id="employee-id"></a>
## The Internal Employee ID

Since 2026-09-17 the Internal Employee ID is **assigned when the New Employee Request is submitted**, not when you open this page. The number you see in the form is that pre-assigned ID; it is also on the request record and is what every later email and page shows. Older requests (submitted before the change) show a *predicted* number instead; the final number is assigned when you submit. If the two differ, the submit is rejected with the message below, which names the assigned number — type that number into the field and submit again.

The field still carries the hint "Auto-generated. Modify if needed or use existing ID for rehires", but **changing it is only honoured for app admins**. Anyone else who submits a different number gets:

> Internal Employee ID is pre-assigned (30417) and cannot be changed here.

Leave the value as shown. If a rehire genuinely must keep an old ID, ask an app admin (see [Troubleshooting — who do I contact](TROUBLESHOOTING.md#who-to-contact)); the override is logged.

<a id="field-notes"></a>
## Field notes

| Field | What to know |
|---|---|
| **SiteDocs Worker ID** (required) | The worker ID from SiteDocs. Free text; no format check. |
| **SiteDocs Job Code** (required) | One of: `Hourly 1`, `Hourly 2`, `Salary 1`, `Salary 2`, `Supervisor`, `Manager`. This is the job classification for SiteDocs permissions and is shown to Safety in their onboarding email. |
| **SiteDocs Training Username / Password** | Only shown when the request ticked **SiteDocs Supervisor**; both required when shown. The password is a temporary one for first login and is stored and emailed in clear text to the requester and manager (in "Credentials Ready" / "Onboarding Complete" / "Workflow Completed"). |
| **DSS Username / Password** (required) | Username pre-filled as `first.last` in lower case; change it if DSS assigned something else. Password is temporary, stored and emailed like the SiteDocs one. |
| **BOSS WIS Account Created** | Tick to confirm you set up the BOSS WIS account. Recorded as Yes/No. |
| **SiteDocs Badge Link Created** | Tick to confirm the badge link exists. Recorded as Yes/No. |
| **Additional Comments / Notes** | Free text, kept with the ID Setup record. |

There is no server-side check on these values beyond the ID rule above: what you type is what later teams see.

<a id="on-submit"></a>
## What happens when you submit

Button: **Complete Employee ID Setup**. On success the page shows "ID Setup Complete — HR and relevant teams have been notified."

- The request moves to **HR Verification Needed**.
- If the employee is **Hourly with no system access**: the requester and manager receive **Credentials Ready** (with the DSS and SiteDocs logins and a calendar link for the start date); HR and Payroll receive **HR Verification Required** ("IT setup will be skipped"); the **Safety Onboarding** task is created and `grp.forms.safety` receives **Safety Onboarding Required**.
- Everyone else: HR and Payroll receive **HR Verification Required** ("IT setup will be triggered after HR verification"). No credentials email yet — those go out with IT Setup Complete — and the Safety task is created after HR Verification instead.

<a id="common-mistakes"></a>
## Common mistakes and their messages

| What you see | Cause | Fix |
|---|---|---|
| "Internal Employee ID is pre-assigned (…) and cannot be changed here." | You edited the ID and are not an app admin. | Put the shown value back and resubmit. |
| "Submission failed: Could not fetch request data…" | The workflow ID in the link does not match a New Employee Request (wrong or truncated link). | Open the form again from the original email or from the dashboard. |
| Access Denied | You are not in `grp.forms.idsetup`. | Ask the group owner to add you, or forward the task to a member. |
| Form shows a different Internal Employee ID than an email you received | Only possible for requests submitted before 2026-09-17, where the page predicted a number. | Submit as shown. If you get "Internal Employee ID is pre-assigned (…)", copy the number from the message into the field and resubmit; that number is the final one. |

<a id="known-issues"></a>
## Known issues

- **Resubmitting creates a duplicate record (#12).** The ID Setup form does not update in place: a second submission for the same request adds a second ID Setup record, and different pages read either the first or the last one. Submit once. If you must correct something, tell HR (they see the values on HR Verification) and the Forms administrator, rather than resubmitting.
- **The ID hint text is out of date.** "Modify if needed or use existing ID for rehires" no longer applies to non-admins (see above).
- **Passwords are stored and emailed in clear text.** Use temporary passwords the employee must change on first login.
