# End of Employment Request (and HR approval)

<a id="purpose"></a>
## Purpose and who fills it

Use **End of Employment Request** when someone is leaving for any reason (resignation, retirement, end of contract, termination, death). It creates a `TERM_…` workflow. HR reviews and approves or rejects it; approval fans out deactivation tasks to IT, HR, Payroll, Fleet, Purchasing, ID Setup and Safety, and an asset-collection checklist to the requester and manager.

Anyone signed in with a company account can submit the request — normally the employee's manager. Your name and email are filled in from your login.

<a id="before-you-start"></a>
## Before you start

Have ready: the employee's name, work email (if they have one), site, hourly/salary, effective termination date and last day worked, the reason, the manager's company email, whether they have direct reports (and who takes them over), which systems to remove, Google account offboarding choices, equipment to collect, and **supporting documentation** — the form states "HR requires documentation for all end of employment actions".

<a id="field-notes"></a>
## Field notes

| Field | What to know |
|---|---|
| **Does employee have a work email?** | Toggle. When on, **Current Work Email** is required and must be a company domain. |
| **Manager Email / Name** (required) | Company domain; autocompletes and fills the name. If an email is given the name must be present too, or the submit is rejected. The manager receives the approval outcome and the asset checklist. |
| **Effective Date of Termination** and **Last Day Worked** (required) | Date pickers. The termination date appears in every email subject ("Termination Date: yyyy-mm-dd"). |
| **Reason for Leaving** (required) | Deceased, End of contract, Resigned, Retired, Terminated. Choosing **Terminated** reveals **Has HR Approved this Termination?** (Yes/No, then required). The reason appears in email subjects. |
| **Does employee have direct reports?** (required) | Yes reveals **Who will these reports report to?** (required). The new manager is written into the IT and HR tasks ("Reassign Google/BOSS direct reports to …", "Update ADP reporting structure"). |
| **System Access Removal** | Tick each system: ADP Supervisor Access (creates HR and Payroll tasks), BOSS / CAA / Delivery / Google Account / Incidents (IT task), Fleetio (Fleet task), Central Purchasing/Jonas (Purchasing task). |
| **Google Account Offboarding** (shown when Google Account is ticked) | Email Forwarding To, Transfer Drive Files To, Delegated Inbox Access To (company addresses); **Keep Account Active For**: `Default 1 Month then delete`, `Longer (Specify in notes)`, `Delete Immediately (No forwarding/access)`; **Vacation Responder Message** — the `[RECIPIENT]` placeholder is replaced with the forwarding address. These become lines on the IT task, including a "Schedule Account Deletion" calendar step. |
| **Equipment & Assets** | Computer/Laptop, Mobile Phone (reveals Phone Number), Tablet, Credit Card, Vehicle and Keys, Building Access Card/Keys. "Checked items will automatically generate an asset collection checklist for the manager." |
| **Upload Documentation** | Saved to Drive and linked in HR's email. Large files upload before the submit ("Uploading file..."). |
| **Additional Comments / Notes** | Free text. Use it for "Longer (Specify in notes)". |

<a id="on-submit"></a>
## What happens when you submit

1. The workflow `TERM_…` is created at step **HR Approval Needed**; the page shows "Submission Successful".
2. Emails: **HR Approval Required** to `grp.forms.hr` with the approval button; **Termination Submitted — Pending HR Approval** to Payroll ("advance notification only — HR approval is still pending").
3. Nothing is deactivated until HR approves.

<a id="approval"></a>
## The HR approval page

Reached from the HR email (`?form=termination_approval&wf=…`). HR and Payroll group members can **open** it, but only HR group members (and admins) can **submit** — Payroll gets an error on submit. The page shows the request header, **Approve Termination** / **Reject / Need Info** buttons and a Notes box; button **Process Approval**.

On **Approve**:

- Step → **Action Items Pending**. Tasks (all block completion): IT Systems Deactivation (if any IT system, phone or reports), HR Systems Deactivation and ADP Deactivation (if ADP Supervisor Access), Fleet Systems Deactivation (Fleetio), Central Purchasing/Jonas Deactivation, **Employee Deactivation** for ID Setup (always: remove from SiteDocs, DSS, BOSS WIS), **Complete EOE Process** for HR (always), **Asset Collection Checklist** for the requester (if equipment listed).
- Emails: the matching **… Action Required** emails; **Employee Deactivation Required** → ID Setup; **EOE Process Required** → HR; **FYI — Employee Offboarding: Name** → Safety (no task); **Asset Collection Required** (or **Termination Approved** if no equipment) → requester + manager; **Termination Approved** → Payroll.
- Message: "End of employment approved. N checklists generated."

On **Reject**: status **Rejected**, step *Rejected by HR*; requester and manager receive **Termination Rejected** with HR's notes. Submit a corrected request if needed.

A second approval attempt for the same request returns "Approval already processed for this workflow."

The request completes when every task is finalized; HR, requester and manager receive **Workflow Completed: End of Employment Request**. See [Action items](ACTION_ITEMS_AND_CHECKLISTS.md#assets) for the Collected / Not Returned checklist.

<a id="common-mistakes"></a>
## Common mistakes and their messages

| What you see | Cause | Fix |
|---|---|---|
| "Error: …manager name…" on submit | Manager email given without a name (autocomplete not used). | Pick the manager from the list so the name fills in. |
| "File upload failed. Please try again or remove the attachment." | The attachment could not be read by the browser. | Retry or attach a smaller file. |
| Payroll cannot approve | Only HR can submit the approval. | Ask `grp.forms.hr`. |
| Request rejected but a row remains on the dashboard | Expected: status Rejected. | Filter it out or submit a new request. |
| Empty "In Progress" request after a failed submit | Known issue #6: the request row is created before checks run. | Ask an admin/HR to cancel it. |

<a id="known-issues"></a>
## Known issues

- **"Has HR Approved this Termination?" is overwritten.** The Yes/No you enter is later replaced by the workflow status in the stored record; HR sees your answer only in the approval email. Mention it in Comments if it matters.
- **Orphan requests on failed submit (#6).**
- **Duplicate guard by requester only (#19).** Two different terminations from the same person within 30 seconds merge into one — wait between submissions.
- **Computer serial number is not collected**; IT gets the equipment list only. Add serials in Comments if known.
