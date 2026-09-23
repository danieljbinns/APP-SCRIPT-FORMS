# IT Confirmation

<a id="purpose"></a>
## Purpose and who fills it

IT Confirmation is a review step before IT provisioning. The reviewer re-reads the original request, corrects anything that is wrong or has changed, adds review notes and clicks **Confirm & Send to IT**. It happens:

- for **New Employee Requests** that ticked **BOSS** (after HR Verification), and
- for **every Equipment and Systems Request** (immediately after submission).

It is assigned to a named IT contact (the "IT Confirmation owner"), not to a group. The page can be opened by that person, by members of `grp.forms.it`, and by app admins. You reach it from **IT Confirmation Required** (`?form=it_confirmation&wf=…`).

<a id="what-you-see"></a>
## What you see

The page is the original request form, headed **IT Confirmation — "Review and confirm all details before IT proceeds with provisioning."**, pre-filled with everything the requester entered (and, for new hires, the HR-verified name, title and manager). A request header shows who the request is for. At the bottom is a **Review Notes (Optional)** box ("Any changes made, decisions, or context for IT...") and the **Confirm & Send to IT** button.

For a Position / Site Change the same idea applies with the status-change form, but that route is reached only through the IT task email, not normally used.

<a id="before-you-start"></a>
## Before you start

Check with the requester or manager whether anything has changed since submission: systems needed, BOSS committees and cost-sheet jobs, computer or phone type, purchasing sites, department. Edit the form to reflect the current truth — what you confirm here is what IT will see on the IT Setup page.

<a id="field-notes"></a>
## Field notes

| Area | What to know |
|---|---|
| Employee, title, site, job site number, manager, department | Editable; your changes replace the request values. |
| Systems, equipment, Google email/domain, computer and phone request type, BOSS options, Jonas job numbers, ADP sites, purchasing sites | Editable and written back to the request. |
| Hire date, credit-card choices and limits, previous computer/phone user details, Office 365, JR / 30-60-90 answers, comments, ADP salary access, BOSS training-only | Shown, but **not** written back — changes you make to these here are not saved. Put them in Review Notes for IT. |
| **Review Notes** | Saved with the confirmation record and visible to IT. |

<a id="on-submit"></a>
## What happens when you submit

1. A confirmation record is saved (BOSS options, computer/phone request type, your notes, your email).
2. If anything differs from the original request, the requester and manager receive **Information Updated**; Safety and ID Setup are copied when relevant.
3. The step becomes **IT Setup Needed** and `grp.forms.it` receives **IT Setup Required — Name** with the IT Setup button.
4. The "IT Confirmation Required" **action item is not closed** — see known issues.

<a id="common-mistakes"></a>
## Common mistakes and their messages

| What you see | Cause | Fix |
|---|---|---|
| Access Denied | You are not the IT Confirmation owner, in `grp.forms.it`, or an admin. | Forward to the owner or an IT group member. |
| A change you made did not appear on the IT Setup page | The field is one of the not-written-back ones (table above). | Add it to Review Notes and tell IT. |
| Requester received "Information Updated" listing a purchasing-sites change they did not expect | Known oddity: the way purchasing sites are compared can flag an unchanged list as changed. | Ignore if the list is in fact the same. |

<a id="known-issues"></a>
## Known issues

- **New Hire/Rehire answer is blanked (#1).** Confirming a new hire overwrites the "New Hire or Rehire" value with a blank, so later emails show nothing there. If the rehire status matters (for example an ID to reuse), write it in Review Notes.
- **The IT Confirmation task never closes (#8).** The task created at HR Verification stays **Open** on the dashboard after you confirm and after IT Setup. It does not block completion; the request still finishes. Ignore the open badge, or use the task page to finalize it manually if you want the dashboard tidy.
- **Equipment requests: SiteDocs account task is never created (#3).** Even when "SiteDocs Supervisor" is ticked, no ID Setup task is created for an equipment request. If a SiteDocs login is needed, email `grp.forms.idsetup` with the request ID.

<a id="when-it-applies"></a>
## When IT Confirmation happens, by request type

| Request | IT Confirmation? | Triggered by | Email you receive |
|---|---|---|---|
| New Employee — Systems include **BOSS** | Yes, after HR Verification | HR submitting HR Verification | **IT Confirmation Required — Name** (with an IT Confirmation task on the dashboard) |
| New Employee — no BOSS | No; HR Verification goes straight to IT Setup | — | — |
| New Employee — hourly with no system access | No; the request completes at HR Verification | — | — |
| Equipment and Systems Request | Yes, always, immediately | The requester submitting | **IT Confirmation Required** |
| Position / Site Change | Not as a step; IT gets an **IT Action Required** task that opens IT Setup directly | — | — |

<a id="afterwards"></a>
## What others see after you confirm

- **IT** receives **IT Setup Required — Name**; the IT Setup page header shows your confirmed values (email address and domain, computer and phone request, BOSS committees and cost-sheet jobs).
- **Requester and manager** receive **Information Updated** only if you changed something; otherwise they hear nothing until IT Setup Complete.
- **Dashboard**: the step moves from `IT Confirmation Needed` to `Pending: IT`. The IT CONF badge may stay open because of known issue #8; it does not hold anything up.
