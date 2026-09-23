# The JR close, without the password — a plain-English summary

*For anyone, technical or not. Two minutes.*

---

**Two things are ready to hand over: the JR ticket close, and the Employee ID Setup submit.**
This page explains the first; the second works exactly the same way.

## The one-sentence version

When n8n finishes assigning a JR in BOSS, it has to tell the Employee Forms portal "that's done".
Today it does that by posting a **shared password** to a **hidden web address**. We are replacing that
one step with a proper, identified connection — and nothing else about the JR process changes.

---

## What happens today

George's automation ends by calling a web address that looks like this:

```
https://script.google.com/macros/s/AKfycbw…/exec
```

with a password in the message body. That address was published on purpose so automation could reach
it **without logging in**. It works. But it has three properties worth naming:

| | |
|---|---|
| **Anyone who has the address and the password can use it** | There is no "who did this". The portal cannot tell George's automation from anyone else. |
| **The address can change** | A new deployment of the Forms app mints a **new** URL. The old one keeps working, so nothing fails loudly — it just quietly stops being the current one. |
| **It can only do one thing** | It closes a JR task. Anything else automation needs later means building another one of these. |

## What replaces it

The same step, but the call goes through a door that knows who is knocking.

- It runs as a real, named account — `efx-bot` — so the portal records **who** closed the task.
- The address is a **permanent ID**, not a URL. Redeploying the Forms app cannot move it.
- **No shared password.** Authentication is a Google service account, the same mechanism the rest of
  the company's automation already uses.
- The same door can do ~27 other things when they're wanted. Nothing new gets built for the next one.

## What actually changes in George's workflow

**One node.** The last step, `Mark Portal JR Complete`, changes from "post to a web address" to
"call a shared sub-workflow". Every other node stays exactly as it is.

## What does *not* change

- How JRs are requested, reviewed or approved.
- The BOSS assignment itself — same Lambda, same session, same screen-scraping.
- The emails, the tracking sheet, the approval template.
- Any of the rules about who may do what. Those live in Forms and always did.

## Is it proven?

Yes. On 2026-09-18 the entire chain was run end to end against a test copy — started by a genuine
email, driven by a human clicking the real buttons, ending with a real assignment in BOSS staging and
the task closed in the portal. Roughly 210 further automated calls ran earlier with no flaky failures.

Evidence: [`PROOF-2026-09-18.md`](PROOF-2026-09-18.md).

## What it cannot do

- It does not touch BOSS. BOSS access still works exactly as it does today, with the same fragility.
- It does not change any business rule. It is a door, not a decision-maker.
- **Live as of 2026-09-18.** The Forms code and the connection are deployed to production and verified
  against it. The JR close itself was proven end to end on a test copy — see PROOF.

---

## Where to go next

These four documents travel together — they are sent by email, there is nothing to log in to.

| You are | Read |
|---|---|
| Handing this to George or his agent | `HANDOFF.md` |
| Wanting the evidence | `PROOF-2026-09-18.md` |
| Wanting the picture | `FLOW.md` |
| Technical, want the full list of what else the door can do | Ask Binns for the EFX function reference |

## How it is actually delivered

The workflows live in **Daniel Binns' n8n** and are shared **read-only**. Nobody is sent files to
import, and the Google credential that makes the call is never shared — it stays inside Binns'
Router. George's workflow simply calls one shared sub-workflow by name.

That is deliberate: it grants the ability to make one specific call, not a key to the whole system.
