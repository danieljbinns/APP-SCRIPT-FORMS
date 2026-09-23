# New Employee Request

<a id="purpose"></a>
## Purpose and who fills it

Use **New Employee Request** to start onboarding for someone who is joining TEAM Group (or returning). Submitting it creates a `NEW_EMP_…` workflow, assigns the employee's **Internal Employee ID**, and emails the ID Setup team to begin. Anyone signed in with a company account can submit it — normally the hiring manager, site manager or their delegate. The requester's name and email are filled in automatically from your login and cannot be edited.

Do **not** use this form for an existing employee who only needs equipment or access — use [Equipment and Systems Request](EQUIPMENT_REQUEST.md) instead.

<a id="before-you-start"></a>
## Before you start

The form opens with a gate: "Before proceeding, please confirm all recruiting requirements have been met." Have ready:

- Legal first and last name (middle and preferred name optional), start date, job title, site and job site number, department (optional).
- The reporting manager's company email — the field autocompletes from the directory and fills the manager's name for you.
- Whether the person is **Hourly or Salary**, **Direct Hire or Agency**, **New Hire or Rehire**.
- Whether they need **system access** beyond the defaults. Every employee automatically gets DSS and SiteDocs; most hourly employees need nothing more.
- If they do need access: which systems (BOSS options, ADP sites, Google account name, Jonas job numbers), which equipment (computer, phone, credit cards with limits, business cards, vehicle, SiteDocs tablet), and whether a 30-60-90 plan or JR title applies.

Fields marked with a red asterisk are required. Dates use the date picker (stored as yyyy-mm-dd).

<a id="field-notes"></a>
## Field notes (the non-obvious parts)

| Field | What to know |
|---|---|
| **Hire Date** | If it is fewer than 3 business days away you see "Notice: < 3 business days. Please contact HR to expedite." It is a warning only; you can still submit. HR can correct the date later during HR Verification (or from the request details page). |
| **New Hire or Rehire** | Recorded on the request and shown in emails. It does not change the routing. A rehire still receives a new Internal Employee ID unless the ID Setup team is told to reuse one (see [ID Setup](ID_SETUP.md#employee-id)). Known issue: this value is blanked if the request later goes through IT Confirmation (see below). |
| **Hourly or Salary** | The main routing switch. Choosing **Salary** automatically sets System Access to Yes and opens the System Access section. **Hourly + System Access = No** is the short path: no IT step; the request completes at HR Verification and the credentials email goes straight to you and the manager. **Hourly + Yes** follows the full path and is tagged `EXPEDITE` in email subjects. |
| **Employee Type** | Direct Hire or Agency. Informational — shown in emails. |
| **Reporting Manager Email** | Must be a company address (`@team-group.com`, `@robinsonsolutions.com`, `@industrialappliedtech.com`, `@stgroup.ca`). The manager receives the credentials / IT Setup Complete / Onboarding Complete emails and the **WIS Assignment** task, so get this right. |
| **System Access Needed?** | If **No**, everything under System Access and Equipment is cleared when you submit, even if you ticked boxes earlier. |
| **ADP Supervisor Access** | Reveals "Salary access" and the ADP job site list. Ticking salary access makes Payroll's email read "HR Verified — Salary Access Required". The job-site list shows an asterisk but is not actually enforced — fill it in anyway; IT and Payroll rely on it. |
| **BOSS** | Reveals BOSS options. **Training User Only? = Yes** hides everything else: the user gets BOSS training access only (no committees, cost sheet, trip reports or grievances) and the manager's WIS task says so. Otherwise choose committees, Cost Sheet access (with job numbers), Trip Reports and Corrective Counselling & Grievances. Ticking BOSS also adds an **IT Confirmation** step after HR Verification. |
| **Google Account** | Requested email defaults to `firstname.lastname`; the domain defaults to the manager's domain. IT uses these as the starting point when creating the account. |
| **Central Purchasing/Jonas** | Purchasing job site numbers and Jonas job numbers each create a line on the Purchasing team's task. The asterisk on purchasing sites is not enforced. |
| **SiteDocs Supervisor** | Adds the SiteDocs admin/login section to the ID Setup form so the ID Setup team creates a training username and password. |
| **Computer** | "New Request" asks for type — Chromebook is the default; **Windows or Mac require IT Director approval** — and, for Windows/Mac, whether an Office 365 licence is needed. "Reassignment" asks for the previous user, type and serial number instead. The Request Type label shows an asterisk but the form does not stop you leaving it blank; IT then has no instruction, so choose one. |
| **Credit Card** | Tick USA, Canada and/or Home Depot and type a monthly limit such as `$1,000`. Known issue: the limit does not reach the Finance team's task; it always reads "Requested limit: Standard". Put the limit in **Comments** as well, or tell the credit-card team directly. Do not start the limit with `-`, `+`, `=` or `@` (see mistakes below). |
| **Mobile Phone** | New or Reassignment (previous user and number). As with Computer, the asterisk is not enforced. |
| **Vehicle** | Adds "Assign company vehicle" to the Fleet task — but only if **Fleetio** is also ticked under Systems; the Fleet task itself is created by the Fleetio tick. |
| **JR Required? / Select JR Title** | Choosing Yes lets you pre-select a JR title and makes HR confirm the verified JR title during HR Verification. It does **not** by itself create a JR task. |
| **30-60-90 Day Plan Required?** | **Yes** creates two tasks after IT Setup: a 30/60/90 Review Plan task (blocks completion) and a JR Assignment task (does not block). If you answered JR Required = No but 30-60-90 = Yes, a JR task is still created. |
| **Comments** | Free text, shown to later steps and in the IT Confirmation review. Must not begin with `-`, `+`, `=` or `@`. |

<a id="on-submit"></a>
## What happens when you submit

1. The system checks the required fields, then creates the workflow (`NEW_EMP_yyyymmdd-hhmmss_nnn`) and assigns the **Internal Employee ID** (a number from 30000 up). The success screen shows "Request Submitted!" with the Request ID.
2. Emails: **ID Setup Required** to `grp.forms.idsetup` with a button to the ID Setup form; **Request Submitted** to you.
3. Status becomes *In Progress — ID Setup Needed*. Nothing else is created yet; specialist tasks come after IT Setup and the Safety task comes at ID Setup (hourly, no access) or after HR Verification.
4. If you submit the same hire twice within about 30 seconds, the second submit returns the same request instead of creating a duplicate.

Track progress on the Workflow Dashboard (filter **New Hires**). You will receive **Credentials Ready** or **IT Setup Complete**, then **Workflow Completed**. See [Statuses and steps](STATUSES_AND_STEPS.md#new-hire).

<a id="common-mistakes"></a>
## Common mistakes and their messages

| What you see | Cause | Fix |
|---|---|---|
| The browser highlights a field and will not submit | A required field is empty (name, date, title, site, job site number, manager, one of the radio choices). | Fill it in. Sections hidden by System Access = No are not required. |
| Manager email field rejected | The address is not on a company domain. | Pick the manager from the autocomplete list. |
| "Error Submitting Form: Missing required fields: …" | The server found a required value missing (rare if the browser checks passed). | Fill the named field. |
| "Error Submitting Form: …" naming a field | Some text field starts with `-`, `+`, `=` or `@` (for example a comment beginning with a dash, or a limit typed as `-500`). This is a spreadsheet-safety guard and applies to **every** text box, not just the required ones. | Reword so the first character is a letter or digit. Known issue #13. |
| Submitted, but the Finance task says "Requested limit: Standard" | Known issue #15. | Tell the credit-card team the limit, or put it in Comments. |
| Success screen shows the Request ID but nobody received an email | See [Troubleshooting — I didn't get the email](TROUBLESHOOTING.md#no-email). | |

<a id="known-issues"></a>
## Known issues affecting this form

- **Hire type blanked on IT Confirmation (#1).** For BOSS hires the IT Confirmation step overwrites the New Hire/Rehire answer with a blank. Downstream emails show nothing there. If the rehire status matters to a later team, mention it in Comments.
- **Credit-card limit not passed to Finance (#15).** See above.
- **Asterisks on ADP sites, purchasing sites, computer and phone request type are not enforced (#14).** Treat them as required anyway.
- **Formula guard rejects any field starting with `-`, `+`, `=` or `@` (#13).**
- **Job site number is never auto-filled from the site (#14).** Pick it yourself.
