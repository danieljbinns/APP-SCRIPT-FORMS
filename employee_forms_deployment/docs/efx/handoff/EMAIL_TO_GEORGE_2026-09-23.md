**Subject:** Employee Forms — the two calls you need, live in production

Hi George,

Here is exactly what you asked for: the two sub-workflows that close the Employee Forms side of your onboarding and JR flows, what to send them, and confirmation that both work in production today. Everything else I built was only a harness to test these against production without touching your workflows; it is switched off and nothing of yours depends on it.

**1. ID Setup close — `Forms · Submit ID Setup (PROD)`, id `P3HiVnzoxaRYYTZN`**

Call it at the end of your onboarding workflow with an **Execute Workflow** node (version 1.2, "By ID", "Wait for sub-workflow" on). Feed it a Code node that outputs exactly these fields:

| Field | Value |
|---|---|
| `workflowId` | the Request ID from the email, `NEW_EMP_…` |
| `siteDocsWorkerId` | the SiteDocs worker id you created |
| `siteDocsJobCode` | one of `Hourly 1`, `Hourly 2`, `Salary 1`, `Salary 2`, `Supervisor`, `Manager` |
| `dssUsername` | the DSS login you created |
| `dssPassword` | its password |
| `setupNotes` | optional free text |
| `actor` | `{ "id": "n8n:george-onboarding", "email": "efx-bot@team-group.com", "display": "Hourly Onboarding (n8n)" }` |

Do not send `internalEmployeeId`; it is already assigned. This one call does the whole ID Setup step: writes the ID Setup row, moves the hire to HR Verification, emails HR, and creates the Safety Onboarding task. Reply on success: `{ ok: true, success: true, message: "Employee ID setup completed successfully" }`.

**2. JR close — `Forms · Close JR Task (PROD)`, id `zxaTLTTNK28LpnNg`**

Same node type, replacing `Mark Portal JR Complete` in BOSS JR Assignment:

| Field | Value |
|---|---|
| `idOrWorkflow` | `{{ $('Find Row by Employee').first().json.portalTicketId }}` (the `TK-…`), or the hire's `NEW_EMP_…` id |
| `notes` | free text, e.g. BOSS job and user ids |
| `actor` | `{ "id": "n8n:boss-jr-assignment", "email": "efx-bot@team-group.com", "display": "BOSS JR Assignment (n8n)" }` |
| `idempotencyKey` | `jr-close-<portalTicketId>-<executionId>` |
| `treatAlreadyClosedAsSuccess` | `true` |

Reply on success: `{ ok: true, taskId, workflowId, success: true }`. A repeat click returns `alreadyClosed: true`, not an error. A paste-ready copy of this node is attached (`snippet_MarkPortalJrComplete_PROD.json`).

**What the trigger email gives you**

You are now in `grp.forms.idsetup`, so every new hire sends you `ID Setup Required`. Its Request Details section carries `Request ID` (`NEW_EMP_…`) and `Internal ID` (the employee number, 4–6 digits), and the button link carries the same id as `wf=`. Parse those two and you have everything the ID Setup call needs besides your own SiteDocs and DSS values.

**Confirmed working, today, in production**

- Submit ID Setup, called as a sub-workflow: `Employee ID setup completed successfully`, request `REQ-52353C33`. The hire advanced and the Safety task was created.
- Close JR Task, called as a sub-workflow: task `TK-6A093E83` closed, `Closed By efx-bot@team-group.com`, request `REQ-B06D69B7`.
- Both have `callerPolicy: any`, so you can call them from your project right now with no further setup on my side. I have also shared them with you as viewer so you can open them.

**Errors**

On the node's error output, read the `[efxCode=…]` tag at the end of the message: `E_VALIDATION` (a field is wrong), `E_NOT_FOUND` (wrong id or no open task), `E_UPSTREAM` (Forms refused; the message says why, usually "already submitted"), `E_TASK_NOT_OPEN` (the hire was cancelled), `E_DISABLED` (switched off by an admin; tell me).

**Documentation**

- `HANDOFF.md` — full field reference, errors, rollback
- `AGENT.md` — the same as a compact contract for whatever edits your workflows
- `snippet_MarkPortalJrComplete_PROD.json` — the JR node, paste-ready
- `template_IdSetup_from_submit_email_PROD.json` — a complete working example, email in to ID Setup submitted, if useful; not required

Keep your old `Mark Portal JR Complete` node as your rollback; the old endpoint stays up during the overlap.

Thanks,
Daniel
