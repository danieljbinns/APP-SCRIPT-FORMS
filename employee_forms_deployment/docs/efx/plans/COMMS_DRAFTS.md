# Communication drafts — EFX (nothing here has been sent; Binns sends when ready)

Plain text, ready to paste. Placeholders in `<angle brackets>`. Keep the "what changes for you" first, details last.

## 1. To George — the day after the TEST tier works (Day −1 for the JR parallel run)

Subject: Employee Forms ↔ n8n — the reusable door is live on TEST; JR is the first thing to move

George,

The Forms side now has one permanent, reusable way for n8n to call it. No cookies, no secrets in bodies, one Google
service-account credential, and it will not break when we change Forms.

What changes for you
- One credential: **EFX Google SA (test)** on n8n staging (already created). Same pattern later for prod.
- One router sub-workflow (**00_EFX_Router**) and one small wrapper per action (**10–28 …**). You call the wrapper,
  it calls Forms, Forms does exactly what a human click does (tasks close, next step unlocks, same emails).
- JR: **12_Forms_CloseJrTask** replaces the "Mark Portal JR Complete" node. Input is the tracker's `portalTicketId`
  (TK-…) or the `NEW_EMP_…` workflow id. A paste-ready replacement node is in `n8n/snippets/`.
- Initial Request from n8n: **10_Forms_CreateInitialRequest**. The response carries `workflowId` and the
  **`internalEmployeeId`** — it is now minted at submission, so you get it immediately (this is the webhook/email you asked for,
  without the email).

How we roll it out
- This week: everything points at the **TEST** tier only (its own sheet, all emails redirected to me). Play freely.
- Next: the JR node runs **in series before** your existing doPost node for a week (parallel run). Nothing else in your
  workflow changes. Then we disable the old node, then delete it.
- I will never change a function you call without an alias keeping the old name working. `n8n_info` tells you the API
  version; **30_EFX_Canary** alerts if it changes.

Where to read
- `docs/wiki/COOKBOOK_FOR_GEORGE.md` — 10 recipes (JR, Initial Request from an approved email, safety training,
  digests, 30/60/90, termination, hire-date change …) with the exact JSON each wrapper needs.
- `docs/wiki/FOR_GEORGE.md` — the short reference; `n8n/README.md` — every wrapper ↔ function, error codes.

Ask me for
- Anything that needs a new field/form/enum value, or `efx-bot` in a group (HR/IT approvals return `E_FORBIDDEN` until then).

David

## 2. To HR / ID-Setup leads — heads-up before the JR parallel week

Subject: Small change in the New Hire dashboard: "Closed By" on JR tasks

Starting <date>, the JR Title task on new-hire workflows will show **Closed By: efx-bot@team-group.com** instead of
"JR Automation (n8n)". Same automation, safer plumbing. Nothing changes in your steps, forms or emails. If a JR task ever
looks wrong (closed twice, wrong hire), reply to this email — we can reopen it from the dashboard within minutes.

## 3. To the super-admin — DWD request (if someone else holds the Admin console)

Subject: Domain-wide delegation for the Employee Forms automation service account (TEST)

Please add a Domain-wide delegation entry (Admin console → Security → Access and data control → API controls):
- Client ID: `<SA_CLIENT_ID — 21 digits>`
- Scopes (one line): `<paste the scope line from docs/plans/SETUP_PLAN_TOMORROW.md §3>`
It lets the `efx-router` service account act as `efx-bot@team-group.com` only (a bot user in `/Bot Accounts`), for the
Employee Forms TEST project. Rollback is deleting the row. Thanks.

## 4. Status note template — end of the TEST day (paste into the ticket / chat)

EFX TEST — <date> 16:00
- Door: n8n → Router → TEST Forms: <PASS/FAIL> (`n8n_ping` principal = efx-bot: <yes/no>)
- Migration on TEST sheet: <applied / dry-run only>; backfill <N> ids
- Smoke: T2 <..> T3 <..> T4 <..> T5 <..> T7 <..>; canary <active/not>
- Emails: all redirected to dbinns (<count> received), 0 leaked
- Prod: untouched (deployments unchanged at 16:00 check)
- Open: <D1–D5 decisions>, <blockers>, <tomorrow>

## 5. Rollback notice template (only if needed)

EFX TEST rolled back at <time>: <what was undone — imported workflows / credential / TEST script / sheet copy>. Prod
was never involved. Cause: <one line>. Next attempt: <date>.
