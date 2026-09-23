# 30-minute walkthrough for George — script (run after the TEST tier passes T2–T7)

Goal: George leaves able to (1) call any Forms action from n8n with one credential, (2) replace his JR node, (3) know
what will never break and what to ask us for. Everything on **TEST**; emails redirected; nothing touches prod.

| Min | Show | Say | Proof on screen |
|---|---|---|---|
| 0–3 | `docs/wiki/COOKBOOK_FOR_GEORGE.md` §1 (mental model) | "Trigger → wrapper → Router → Forms. You never touch Forms code. Every call has actor, data, options." | the diagram |
| 3–6 | n8n staging: credential `EFX Google SA (test)`, workflow `00_EFX_Router` | "One credential, one router. It impersonates a bot user; Forms decides permissions by that user, your `actor` is just the name written in the sheet." | Router HTTP node → credential dropdown |
| 6–10 | Run `30_EFX_Canary` manually | "`n8n_ping` tells you env, sheet, API version and the principal. The canary alerts if the version changes." | output: `env: TEST`, `principal: efx-bot@…`, `apiVersion: 2026.09.17-1` |
| 10–15 | **JR**: open `12_Forms_CloseJrTask`, run with the E2E-created `TK-…` | "This is your `Mark Portal JR Complete` replacement. Same effect as a human clicking Complete. Run it twice: second time `alreadyClosed:true`, nothing breaks." | `Action Items` row → `Closed`, `Closed By efx-bot@…`; second run `E_ALREADY_CLOSED` treated as success |
| 15–19 | `n8n/snippets/George_MarkPortalJrComplete_replacement.json` | "Paste this node where your doPost node is. Input = tracker column K. We run both in series for a week, then disable the old one." | the sticky note inside the snippet; `CUTOVER_PLAN_JR.md` §1 |
| 19–24 | **Initial Request**: `10_Forms_CreateInitialRequest` with the cookbook R2 payload | "Your approval gate stays in n8n. When approved, one call creates the request; the response has the `internalEmployeeId` right away — no waiting for ID Setup." | response `workflowId`, `internalEmployeeId`; `Employee IDs` row; `[TEST]` emails in dbinns' inbox |
| 24–27 | `n8n_listTasks` / `n8n_getWorkflow` / `20_Forms_EventsPoller` | "Read anything: open tasks, workflow status, events since a cursor. Poll events to trigger instead of parsing emails." | `15_Forms_ListTasks` output; poller Switch outputs |
| 27–30 | Errors + "ask us" list (cookbook §4–§5) | "`E_VALIDATION` = your payload; `E_FORBIDDEN` = the bot needs a group; `E_ALREADY_CLOSED` = fine. New field / form / enum = ask us; we add an alias, nothing you built breaks." | cookbook troubleshooting table |

## Leave-behinds
- `COOKBOOK_FOR_GEORGE.md`, `FOR_GEORGE.md`, `n8n/README.md` (wrapper ↔ alias table).
- Which wrappers are imported on staging and their ids (from the values sheet).
- The one rule: **build against TEST until we say dev/prod**; `n8n_ping.env` tells you where you are.

## Questions he will ask (prepared answers)
- *"Can I still use the email trigger?"* — Yes; nothing about emails changed. The poller is optional and better.
- *"What if you redeploy Forms?"* — Aliases keep working; `n8n_info` shows the version; the canary alerts. Breaking changes get a new alias and a heads-up.
- *"Can I close HR tasks?"* — Only if the bot is in `grp.forms.hr` (decision D2). Otherwise `E_FORBIDDEN`, by design.
- *"Where are the passwords ID Setup created?"* — Not in the API. Redacted everywhere; humans get them by email as today.
