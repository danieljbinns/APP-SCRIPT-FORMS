To: george.anthony@team-group.com
Subject: Employee Forms — the two calls you need, live in production

Hi George,

Here are the two sub-workflows that close the Employee Forms side of your onboarding and JR flows, what to send them, and confirmation that both work in production today. Forms does not create anything in SiteDocs, DSS or BOSS. That work stays yours, manual or automated. These calls only record your results in Forms and move the hire to the next step, the same as a person filling in the form.

How it fits together

1. A manager submits the Initial Request in the portal. Forms creates the Internal Employee ID right there and emails it to you.
2. You create the SiteDocs worker and the DSS user using that Internal ID. Your side, unchanged.
3. You call Submit ID Setup with the values you created. Forms records them and moves the hire on.
4. For JR, after the BOSS assignment, you call Close JR Task instead of posting to the old web address.

1. ID Setup — Forms · Submit ID Setup (PROD), id P3HiVnzoxaRYYTZN

Execute Workflow node, version 1.2, "By ID", "Wait for sub-workflow" on. Feed it a Code node that outputs exactly these fields:

- workflowId: the Request ID from the email, NEW_EMP_…
- siteDocsWorkerId: the SiteDocs worker id you created
- siteDocsJobCode: one of Hourly 1, Hourly 2, Salary 1, Salary 2, Supervisor, Manager
- dssUsername: the DSS login you created
- dssPassword: its password
- setupNotes: optional free text
- actor: { "id": "n8n:george-onboarding", "email": "efx-bot@team-group.com", "display": "Hourly Onboarding (n8n)" }

Do not send internalEmployeeId; it is already assigned. What Forms then does: writes the ID Setup row with your values, moves the hire to HR Verification Needed, emails HR, and creates the Safety Onboarding task. Reply on success: { ok: true, success: true, message: "Employee ID setup completed successfully" }.

2. JR — Forms · Close JR Task (PROD), id zxaTLTTNK28LpnNg

Same node type, replacing Mark Portal JR Complete in BOSS JR Assignment:

- idOrWorkflow: {{ $('Find Row by Employee').first().json.portalTicketId }} (the TK-…), or the hire's NEW_EMP_… id
- notes: free text, e.g. BOSS job and user ids
- actor: { "id": "n8n:boss-jr-assignment", "email": "efx-bot@team-group.com", "display": "BOSS JR Assignment (n8n)" }
- idempotencyKey: jr-close-<portalTicketId>-<executionId>
- treatAlreadyClosedAsSuccess: true

Reply on success: { ok: true, taskId, workflowId, success: true }. A repeat click returns alreadyClosed: true, not an error. A paste-ready copy of this node is attached.

What the trigger email gives you

You are in grp.forms.idsetup, so every new hire sends you "ID Setup Required". Its Request Details section shows Request ID (NEW_EMP_…) and Internal ID (the employee number), and the button link carries the same id as wf=. Those two values plus your own SiteDocs and DSS results are everything the ID Setup call needs.

Confirmed working today in production

- Submit ID Setup, called as a sub-workflow: "Employee ID setup completed successfully", request REQ-52353C33. The hire advanced and the Safety task was created.
- Close JR Task, called as a sub-workflow: task TK-6A093E83 closed, Closed By efx-bot@team-group.com, request REQ-B06D69B7.
- Both are callable from your project right now with no setup on my side, and both are shared with you as viewer.

Errors

On the node's error output, read the [efxCode=…] tag at the end of the message: E_VALIDATION (a field is wrong), E_NOT_FOUND (wrong id or no open task), E_UPSTREAM (Forms refused; the message says why, usually "already submitted"), E_TASK_NOT_OPEN (the hire was cancelled), E_DISABLED (switched off by an admin; tell me).

Attached

- HANDOFF.md — full field reference, errors, rollback
- AGENT.md — the same as a compact contract for whatever edits your workflows
- snippet_MarkPortalJrComplete_PROD.json — the JR node, paste-ready
- template_IdSetup_from_submit_email_PROD.json — a working example of the whole sequence, optional

Keep your old Mark Portal JR Complete node as your rollback; the old endpoint stays up during the overlap.

Thanks,
Daniel
