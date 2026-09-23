# 00 — What this system is and how it's put together

Orientation pass. Plain description only — no judgements, no findings, no recommendations.
Written so a reviewer or a respec conversation can start from shared ground.

Per-workflow detail is in [workflows/](workflows/); the key registry is in [index.json](index.json).

> **Standing context — deployments.** There are several deployments: dev, staging, various test
> projects, and prod. **Only prod is user-facing.** They share the same code structure; each has its
> own spreadsheet and its own script properties. They are lifecycle environments, not different
> products, so this documentation describes one system.
>
> **Standing context — n8n.** The n8n / EFX automation is a new addition, currently being enabled
> across several flows. It is **mostly outside the scope of this review**, though review findings may
> end up informing it. It is described here and in the registry for completeness, not because it is
> under review.

---

## 1. What it is

A Google Apps Script web app — one script project serving a small internal portal for TEAM Group,
Robinson Solutions and Industrial Applied Tech. People sign in with their work Google account, pick a
form from a landing page, fill it in, and the system runs the rest of the process for them: it emails
the right people in the right order, tracks who has finished their part, and shows everything on a
dashboard.

Everything is stored in one Google Sheet. There is no database and no server beyond Apps Script
itself.

## 2. The four things it handles

- **New Employee Request** — onboarding someone new.
- **Equipment and Systems Request** — access, software or hardware for someone who already works here.
- **End of Employment** — offboarding, returns and deactivations.
- **Position / Site Change** — role change, site transfer, manager change, classification change.

## 3. The forms people fill in

Four choices on the landing page, but **three form templates** — Equipment reuses the New Employee
template in `mode = 'equipment'`, which hides the hiring-only parts.

| Form | Template | Input fields | Marked required |
|---|---|---|---|
| New Employee Request | `InitialRequest.html` | 76 | 39 |
| Equipment and Systems | `InitialRequest.html` (equipment mode) | same template | fewer, mode-dependent |
| End of Employment | `TerminationRequest.html` | 40 | 29 |
| Position / Site Change | `PositionSiteChangeRequest.html` | 107 | 27 |

Then there are the **staff-facing forms** — the screens the back-office people fill in once a request
is moving:

| Form | Template | Fields | Who fills it |
|---|---|---|---|
| Employee ID Setup | `EmployeeIDSetup.html` | 12 | ID Setup group |
| HR Verification | `HRVerification.html` | 15 | HR group |
| IT Confirmation | (handler-served) | — | IT / Dave Langohr |
| IT Setup | `ITSetup.html` | 41 | IT group |
| Action Item | `ActionItemForm.html` | 7 | whichever specialist it's assigned to |
| Termination Approval | `TerminationApproval.html` | — | HR / Payroll |
| Position Change Approval | `StatusChangeApproval.html` | — | HR / Payroll |

There are also five **read-only reference guides** linked from the landing page (portal overview plus
one per request type), served from `?form=ref_*`.

## 4. How work gets handed out — Google Groups

Work is not assigned to individual people. Each stage and each specialist task is addressed to a
**Google Group**, and whoever is in that group can pick it up. Group addresses come from config, not
from hardcoded names, so membership changes without a code change.

| Group | Handles |
|---|---|
| `grp.forms.hr@` | HR verification, HR approvals, HR deactivations |
| `grp.forms.it@` | IT setup, IT deactivations |
| `grp.forms.idsetup@` | Employee ID setup, SiteDocs, deactivations |
| `grp.forms.safety@` | Safety onboarding / termination |
| `grp.forms.fleetio@` | Fleet — vehicle and Fleetio access |
| `grp.forms.creditcard@` | Finance — credit card applications |
| `grp.forms.jonas@` | Purchasing / Jonas job numbers |
| `grp.forms.review306090@` | 30/60/90 day review plans |
| `grp.forms.jrtitle@` | JR title verification |
| `payroll@` | ADP and payroll deactivations |
| `davelangohr@` (personal) | Business cards, IT confirmation |

Permissions use the same groups. `AccessControlService` asks the Google Directory
"is this person a member of this group?" and works through eight role tiers, first match wins:

1. **Admin** — fixed list in config. Can do everything.
2. **HR** — edit dates, cancel anything, remind anyone, view all step data.
3. **IT** — same powers as HR.
4. **Payroll** — view everything, change nothing.
5. **Specialist** — member of any specialist group. Can act on their own items.
6. **Requester** — the person who submitted it. Can cancel/remind their own.
7. **Manager** — named as the employee's manager. Same as requester.
8. **Any signed-in domain user** — can see the dashboard and request details, nothing more.

## 5. Conditional fields and conditional workflow

Two different kinds of "it depends" are at work.

**On the form** — sections appear and disappear as you answer. The New Employee form has around 35
show/hide rules driven by what you pick (employment type, site, whether a vehicle is needed, whether
a credit card is needed, and so on). The stated intent on the landing page is that you never need to
read instructions first: required fields are marked and conditional sections surface themselves.

**In the workflow** — what you ticked on the form decides which tasks get created later. After IT
Setup is submitted, `triggerSpecialists()` reads the saved request and fans out only the tasks that
apply:

- Credit card requested (USA / Canada / Home Depot) → **Finance** task, with the requested limits
- Business cards ticked → **Business Cards** task
- Fleetio access → **Fleet** task, plus a vehicle line if one was requested
- 30/60/90 plan = Yes → **30/60/90 Review** task
- SiteDocs / tablet → **ID Setup** task
- Jonas job numbers filled in → **Purchasing** task
- New hire → **Safety** onboarding task

The same pattern runs for the other request types — Termination creates IT, HR, Payroll/ADP, Fleet,
Purchasing, Deactivation, EOE and Asset Collection tasks depending on what was on the form; Position
Change creates its own set plus an "Incoming Transfer Setup" task for the receiving manager when
someone moves teams.

Task categories in use: Finance, Fleet, Purchasing, Business Cards, ID Setup, Safety, 30/60/90
Review, JR Title, WIS, IT Confirmation, IT, HR, Payroll, Assets, Deactivation, EOE, Manager.

## 6. Sequential steps — the gates

Each request type walks a fixed order. A step cannot start until the one before it is submitted, and
the system emails the next group automatically when a step closes.

- **New Employee:** Initial Request → ID Setup → HR Verification → IT Confirmation → IT Setup →
  Specialist tasks (parallel) → Complete
- **Equipment:** Request → IT Confirmation → Email Setup → Action Items → Complete
- **End of Employment:** Request → HR Approval → Action Items → Complete (or Rejected)
- **Position / Site Change:** Request → HR Approval → Action Items → Complete (or Rejected)

The specialist tasks at the end are the only part that runs in parallel — they all open at once, and
the workflow closes itself when the last required one is closed.

## 7. Action items

Specialist work used to be its own set of forms. It now runs through a single **Action Items** sheet
and a single screen (`ActionItemForm.html`):

- Each task has a workflow ID, a category, a name, a checklist, an assignee (group or person), and a
  status of Open or Closed.
- The assignee opens it from an email link or the dashboard, works the checklist, adds comments and
  closes it.
- Partial progress can be **saved as a draft** and picked up later.
- When a task closes, the system checks whether every required task on that workflow is closed, and
  if so marks the whole request Complete and sends the closure notice.
- Which tasks count as "required" comes from what was originally requested, so an unticked option
  never blocks completion.

## 8. The dashboard

One page (`?form=dashboard`) showing every request. It reads a pre-built flat sheet
(`Dashboard_View`) rather than joining the other tabs, so it loads quickly.

**Table columns:** Type, Employee, Emp Type, Status, Current Action Pending, Requester, Site, Start
Date, Effective Date, Date Requested, Last Updated.

**Controls:**

- Free-text search across employee and requester
- Type filter — New Hires / End of Employment / Status Change / Equipment
- Status filter — Action Required / Completed / Cancelled
- Sort — Newest, Oldest, Name A–Z, Status
- Category chip — click a pending category to filter to it, click again to clear
- Pagination with page counts
- Refresh
- Hide Selected (admin only, multi-select, soft-delete)

**Personal panels** above the table:

- **My Pending Tasks** — open task counts per category for the signed-in user, clickable through to
  the work
- **My Open Requests** — workflows where the user is the requester or the named manager

## 9. Request details — the step tracker

Clicking a row opens `?form=request_details`, which draws a **Live Request Flow**: one card per step
in order, each showing whether it is done, current or still ahead. Cards are clickable to view the
data that step captured (subject to role). Alongside it:

- **Remind** — re-sends the notification to whoever is holding the open item
- **Cancel Request** — for admins, HR/IT, or the original requester
- **Edit Start Date** — admins and HR/IT
- **Flight Check Details** — the summary panel of the request itself

There is also a **Process Map** page (`?form=workflow_map`) showing the whole flow diagrammatically,
with stats.

## 10. Emails

Email is how the process moves. Notifications are built from shared templates with a per-workflow
context block (`buildNewHireContextBlock`, `buildTerminationContextBlock`,
`buildStatusChangeContextBlock`), so every message carries the same summary of the request plus
whatever is specific to that step.

Behaviours worth knowing: passwords and credentials are stripped from specialist emails and shown
only to the manager/requester; all outbound mail can be redirected to a single address for testing;
mail can be suppressed entirely with a script property; and change notifications go out when an
already-submitted form is edited.

## 11. Where the data lives

One Google Sheet, roughly 17 tabs:

- `Workflows` — the master record, one row per request, holds status and current step
- `Dashboard_View` — the flat pre-computed table the dashboard reads
- `Initial Requests`, `Terminations`, `Position Changes`, `Equipment_Requests` — raw submissions
- `ID Setup Results`, `HR Verification Results`, `IT Results`, `IT Confirmation Results`,
  `Termination Approval Results`, `Position Change Approval Result` — per-step captures
- `Action Items` — all specialist tasks
- `Reference_Sites`, `Reference_JobCodes`, `Reference_Managers`, `Reference_Requesters`,
  `Reference_JRs`, `Reference_JobsJonas` — dropdown lookups
- `Employee IDs` — the employee-number allocator
- `Audit Log`, `Form Edit Log`, `Raw Log` — history

Column positions are centralised in `SchemaConstants.js` as one `SCHEMA` object, so sheet layout is
described in one place rather than scattered through the handlers.

## 12. Other ways in

Besides people using a browser, two automation paths exist for n8n:

- A **POST endpoint** on the same script, authorised by a shared secret sent in the request body.
- A set of **`n8n_*` functions** callable through the Apps Script Execution API, with a
  validation layer (`FormContracts`) and an on/off list controlled by script properties.

## 13. How the files are organised

Server-side is all `.js` — there are no `.gs` files. Apps Script loads every server file into one
shared global scope. Four files use a namespace pattern (`var X = (function(){ ... })()`); the rest
are plain top-level functions.

**The conventions in use:**

| Kind | Where | Naming |
|---|---|---|
| Entry point | `Router.js` | `doGet` / `doPost`, one `switch` on `?form=` |
| Serve a page | the matching handler | `serve*()` — `serveDashboard`, `serveITSetup` |
| Receive a submit | the matching handler | `submit*()` — `submitInitialRequest`, `submitITSetup` |
| One handler per form | `*Handler.js` | `InitialRequestHandler`, `TerminationHandler`, … |
| Shared services | `Services/` | `*Service.js`, namespaced, exposing a small API |
| Cross-cutting helpers | root | `*Utils.js` — `EmailUtils`, `SheetUtils`, `ValidationUtils` |
| Column positions | `SchemaConstants.js` | one `SCHEMA` object, 17 blocks |
| Settings | `Config.js` + `Services/ConfigurationService.js` | `CONFIG.*` getters → script properties → defaults |
| Global CSS | `Styles.html` | design-system variables + shared classes, included by 19 pages |
| Shared UI components | `SharedComponents.html` | theme switcher (Dark / Light / AODA), included by 28 |
| Reusable page parts | `RequestHeader.html`, `SuccessScreen.html`, `DirectoryAutocomplete.html`, `FieldIndex.html` | pulled in with `includeWithData(name, data)` |
| Page templates | one `.html` per screen | markup + page-specific `<style>` + page `<script>` |
| Reference guides | `*-submitter.html`, `Employee-Portal-Training-Deck.html` | static, served via `?form=ref_*` |

**The separation you set out to keep:** design tokens and shared classes live in `Styles.html`;
reusable components live in their own partials and are included with data; per-page markup, styling
and behaviour stay inside that page's file; server logic is split one-file-per-form with shared
concerns pulled out into `Services/` and `*Utils.js`.

**Also in the project, outside the main flow:**

- Operator tooling run from the script editor — `Setup.js` (about 25 small setters for script
  properties), `MigrationTools.js`, `ReplayService.js`
- Test and diagnostic harnesses — `TestRunner.js`, `SuperDebug.js`, `ProdSmokeTest.js`
- Easter eggs — `Konami.html`, `EasterEggDocs.html`, `EasterEggMaps.html`, `KonamiStats.js`, all
  behind an `EASTER_EGGS_ENABLED` script property and included with `safeInclude()`
- A maintenance splash page with a bypass list, for taking the portal down without breaking links

## 14. Numbers at a glance

- 86 files, ~38,000 lines
- 45 server files (41 root + 4 in `Services/`), 38 HTML files, 1 manifest
- 411 top-level symbols in the shared global scope; 6 namespaced modules
- 20 routes on `?form=`
- ~30 server functions called from the browser via `google.script.run`
- 17 task categories, 11 routing groups, 8 permission tiers
- 19 pages include `Styles`, 28 include `SharedComponents`, 21 include the easter egg
- Runtime V8, timezone America/New_York, runs as the deploying user, web app limited to the domain
