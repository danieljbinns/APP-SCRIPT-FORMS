# George's onboarding automation and the Employee Forms door — plain English

*For anyone, technical or not. Two minutes.*

---

## The one-sentence version

When a manager submits a new hire in the Employee Forms portal, George's automation can now pick that up from
the email Forms already sends, read the employee number off it, do the SiteDocs / DSS / BOSS setup after his own
approval step, and hand the result straight back to Forms — through a door that knows who is knocking. The JR
close uses the same door.

## What was blocking hourly onboarding since August

George's design always had a human submit the initial request. His automation runs **after** that. It needed
three things it did not have:

| Needed | Was | Now |
|---|---|---|
| To know a hire was submitted | No signal he could use | He is in the **ID Setup** group; Forms emails it at every submit |
| The internal employee number | Minted only when someone opened the ID Setup page | Minted **at submit** and printed in that email |
| A way to hand ID Setup back | A password posted to a hidden web address, JR only | Named, permanent calls: Submit ID Setup, Close Task, Get Workflow, List Tasks, Close JR Task |

## What changed on 2026-09-23

- The two submit emails (`ID Setup Required` to the ID Setup team, `Request Submitted` to the requester) now show
  **Request ID** and **Internal ID**.
- George (and Binns' robinsonsolutions account) were added to `grp.forms.idsetup`.
- Three more doors were opened in production: **Get Workflow**, **List Tasks**, **Close Task**.
- A working reference workflow — email in, approval click, ID Setup submitted — was built against production and
  is George's to copy.
- The production portal was updated so people submitting requests run the same code.

## What George does with it

1. Trigger on the `ID Setup Required` email in his inbox.
2. Read the Request ID and Internal ID off it (and, if he wants everything, call **Get Workflow**).
3. Draft the SiteDocs / DSS / BOSS setup, email himself for approval.
4. On approval, do the real setup — **his side, unchanged**.
5. Call **Submit ID Setup**. Forms advances the hire, writes the sheets, sends the emails, creates the Safety task.
6. For JR: one node in `BOSS JR Assignment` becomes **Close JR Task**. Nothing else there changes.

## What it cannot do

- It does not touch SiteDocs, DSS or BOSS. Those stay George's.
- It does not change any business rule. Who may do what, which team gets emailed, how numbers are issued: all
  in Forms, as before.
- It cannot be pointed at the wrong spreadsheet from n8n. The door decides.

## Where to go next

| You are | Read |
|---|---|
| George, or editing his workflows | `HANDOFF.md` |
| George's agent | `AGENT.md` |
| Running the live demo | `DEMO_2026-09-23.md` |
| Wanting the picture | `FLOW.md` |
| Wanting the evidence | `PROOF-2026-09-23.md`, `PROOF-2026-09-18.md` |

## How it is delivered

The doors live in **Daniel Binns' n8n**. George calls them by id from his own workflows. The Google credential
that makes the call stays inside Binns' Router and is never shared. A copy of the reference workflow is provided
as a template with credentials removed.
