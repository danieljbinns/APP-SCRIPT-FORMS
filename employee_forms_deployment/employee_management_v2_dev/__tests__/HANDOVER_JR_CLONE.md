# Handover / prompt — "BOSS JR Assignment (COPY - PROD portal)" n8n workflow

> **You are helping George finalize an n8n workflow that closes an Employee-Forms task.**
> Everything you need is below. Nothing here contains live secrets — the two secrets
> (our portal secret, and George's `x-boss-secret`) are already embedded in the nodes.

**From:** Employee Forms side (Binns) · **Date:** 2026-08-06 · **Status:** live & working, needs George's review + one real-employee end-to-end test.

---

## 1. What this is (30-second version)
The Employee-Forms portal split **"Verify and assign JR title"** out of the old combined *30/60/90 Review* item into its **own standalone task** — its own Google group `grp.forms.jrtitle@team-group.com`, its own dashboard badge, internal `formType = jr_title`.

To let George's BOSS automation **close that Forms task** once the JR title is assigned, we **cloned George's existing `BOSS JR Assignment` workflow** and changed **exactly one node** so it calls the Forms portal's completion endpoint. The clone is live and has already closed a test task correctly.

George's job: review it, confirm the BOSS side runs against **prod**, and run **one real end-to-end test**.

## 2. The workflow
| | |
|---|---|
| Name | `BOSS JR Assignment (COPY - PROD portal)` |
| Workflow ID | `J7RU99n01pq9Xk3D` |
| n8n instance | `n8n-staging.team-group.com` |
| Project | **Team Group** (`kOteX9ImmtqV980I`) — visible/editable here |
| Active | **Yes** — owns webhook path `boss-assign` |
| Origin | Faithful copy of George's `BOSS JR Assignment` (`FSX2QncvHA8MoMeu`), which is now **deactivated** (only one workflow can own `boss-assign` at a time) |

**Only ONE node differs from the original:** `Mark Portal JR Complete`. Every BOSS node
(`Assign JR in BOSS`, `Apply Duty Changes`, the Google-Sheets writes, the Gmail confirmations)
is identical to the original — so the BOSS side already points wherever the original did (prod).

Full node list (16): `Assign in BOSS Webhook` → `Parse & Validate` → `Assign JR in BOSS`
→ `Update Sheet - BOSS Assigned` → `Find Row by Employee` → `Write BOSS Assigned Status`
→ `Confirm to George` / `Return Success Page`; error branch `Email George - Error` / `Return Error Page`;
plus `Read Approval Template` → `Parse Duty Changes` → `Apply Duty Changes`, `Read Index Tab`,
`Lookup BOSS Job ID`, and **`Mark Portal JR Complete`**.

## 3. The one changed node — `Mark Portal JR Complete`
- **Method:** `POST`
- **URL:** `https://script.google.com/macros/s/AKfycbzWms2wnt0Z6VsxE2S_iF2IpCguulhKGi7O-nl6c14WszXl3TwJAqluOe63wKNW3PR8sw/exec`
- **Body (JSON):**
  ```js
  {{ JSON.stringify({
      secret: '<already set in the node>',
      action: 'completeJrTitle',
      workflowId: $('Find Row by Employee').first().json.portalTicketId,
      itemName: 'Verify and assign JR title'
  }) }}
  ```
- `workflowId` is the **`TK-…` ticket id** the ingestion wrote to the tracking sheet. The endpoint
  accepts either that `TK-` id **or** the Forms `NEW_EMP_…` id — it auto-detects, so no change needed.
- **Secret:** already embedded in this node; also in AWS Secrets Manager as
  `n8n/portal-complete-jr/webhook-secret`. **Keep it out of chats/docs.**
- **Follow-redirects is ON** on purpose — Apps Script 302-redirects a POST to a `googleusercontent`
  echo URL, and the node follows it to read the JSON result. Leave it on.
- **Why body, not header:** Apps Script `doPost` **cannot read custom request headers**, so the
  secret must live in the JSON body (unlike the BOSS calls, which use an `x-boss-secret` header).

**Endpoint response contract:**
- `{"success":true, ...}` → task closed (`closedBy = "JR Automation (n8n)"`)
- `{"success":false,"message":"Unauthorized"}` → wrong/missing secret
- `{"success":false,"message":"No open JR Title task ..."}` → already closed / not found (safe no-op)

Non-destructive smoke test (should return **Unauthorized** — proves the endpoint is up, touches no data):
```bash
curl -L -X POST 'https://script.google.com/macros/s/AKfycbzWms2wnt0Z6VsxE2S_iF2IpCguulhKGi7O-nl6c14WszXl3TwJAqluOe63wKNW3PR8sw/exec' \
  -H 'Content-Type: application/json' \
  -d '{"secret":"WRONG","action":"completeJrTitle","workflowId":"TK-000"}'
```

## 4. How the whole chain fits together
1. **New hire submitted** in Forms → a **"JR Assignment — <name>"** email goes to
   `grp.forms.jrtitle@team-group.com`. (Subject **always contains the phrase "JR Assignment".**)
2. George's **`JR Assignment Automation`** workflow (`4InJ9cdAr5YxVgoT`, active) reads that email,
   regexes `tid=TK-…` from the body, and writes it to the BOSS tracking sheet
   (`18prwB6phOIGIjI9V92h_hEXz4fpfwdramri1ziIiAC0`, Sheet1, "Ticket ID/#" column).
3. **Manager approves** → the `boss-assign` webhook fires → **this clone** runs:
   assigns in BOSS **and** `Mark Portal JR Complete` closes the Forms task.

## 5. Test result so far (2026-08-06)
- Fired a test with a **fake** employee **"GA Videos" / "SD Test Site"**. It ran 4 times (retries);
  **one execution succeeded (10:40:27)** and Forms task `TK-8247F3AB` closed correctly.
- The **`Assign JR in BOSS` call errored** on the other runs — **expected**, because "GA Videos"
  is not a real BOSS employee. A **real** employee will assign fine.
- ⚠️ **Design note:** on the successful run, the Forms task closed even though BOSS had errored on
  other attempts. **Check the node connections** — if `Mark Portal JR Complete` is *not* wired onto
  the **success output** of `Assign JR in BOSS`, a BOSS failure can still mark the Forms task
  "JR assigned." If you want them strictly coupled, put the portal-close on the BOSS-success path.

## 6. What George should do
1. Open the clone in the **Team Group** project.
2. Review `Mark Portal JR Complete` (section 3 above).
3. Confirm `Assign JR in BOSS` / `Apply Duty Changes` hit **prod** BOSS
   (`https://ik2ur9kika.execute-api.us-east-1.amazonaws.com/prod/assign` and `/prod/editDuties`) —
   they're copied from the original, so they should already.
4. *(Recommended)* wire the portal-close onto the BOSS-**success** path so the Forms task only
   closes when BOSS actually assigned.
5. Run **one real new hire** end-to-end and confirm: assigned in BOSS **and** Forms task = Closed.
6. When happy, this clone is the permanent JR closer. If George would rather fold the one-node
   change back into the original `FSX2QncvHA8MoMeu` and reactivate that instead, that's fine —
   just make sure **only one** workflow owns the `boss-assign` webhook path.

## 7. Gotchas
- **Don't change the JR email subject** away from containing "JR Assignment" — the Gmail trigger
  (`subject:"JR Assignment" is:unread`) depends on it.
- **Identical test emails thread together in Gmail.** If you re-test with the same name, parse the
  specific **unread** triggering message's own body for its `tid=`, not the thread root (the root
  may carry an older ticket id).
- **Forms is LIVE** now (real portal, real emails) — test deliberately, with a real hire.

## 8. Who to ping
Questions on the Forms endpoint / the JR task model → Binns (`dbinns@team-group.com`).
