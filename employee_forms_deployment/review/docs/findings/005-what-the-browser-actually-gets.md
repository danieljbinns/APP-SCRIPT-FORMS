# 005 — What the browser actually gets, and where GAS should sit

Brainstorm response. Starts by correcting a premise, because it changes which problem is worth
solving.

---

## 1. The browser never receives a single server function

> "when you load a form via email ie hr verify your browser loads all html views components
> functions data validate not related"

Half true, and the half that's false is the important half.

- **Server `.js` never leaves Google.** Verified: there are **zero** `<script src>` tags pointing at
  server code anywhere in the project. `google.script.run.submitHRVerification(data)` sends the
  function *name* and the payload over the wire. The body stays on the server.
- **`doGet` parses 986.9kb** of server JS on every request, but that is a *time-to-first-byte* cost.
  The browser never sees those bytes.

So **the thing you already wanted is already true**: the browser gets a function name, not a
function list. Two separate problems have been merged:

| problem | size | who pays | fix |
|---|---|---|---|
| server parse | 986.9kb | TTFB | separate project (004) |
| client payload | 289.1kb | render | this document |

The client payload is the one the user feels, and it is the one nobody has looked at.

---

## 2. What HR Verification actually ships

| file | bytes | why it's there |
|---|---|---|
| `Konami.html` | 127,327 | easter eggs |
| `EasterEggMaps.html` | 52,094 | easter eggs |
| `Styles.html` | 33,848 | base CSS, whole app |
| `SharedComponents.html` | 28,180 | shared client JS + theme switcher |
| `RequestHeader.html` | 26,666 | header, server-rendered |
| **`HRVerification.html`** | **11,045** | **the actual form** |
| `FieldIndex.html` | 8,181 | easter eggs |
| `SuccessScreen.html` | 1,768 | shared |
| **total** | **289,109** | |

**The form is 3.8% of its own page.**

Of `SharedComponents.html`'s 18 functions, **none is called by `HRVerification.html`'s own code**.
`buildDualList` (~5kb) ships; 2 of 28 pages call it. What does run is the self-initialising theme
switcher and formula guard — so the file isn't dead, but most of it is.

---

## 3. Your questions, answered

**"Can shared files be the same project, a different deploy, a library, loaded on use?"**
**No** to deploy — a version is a whole-project snapshot (`@76` and `@80` each carry all 86 files).
**Library is a different project**, server-side only, and does nothing for client payload. There is
no lazy loading of code in Apps Script.

**"Call data lookup for fields on load, ie dropdown?"** — **already how it works.** `getSitesList()`
and `getJRsList()` are post-load `google.script.run` calls. Which is also the cause of the Site Name
wipe: the page is submittable before they resolve.

**"The full function list doesn't load client side, function name does, and submits?"**
**Yes — that is already the current behaviour.** Nothing to change.

**"Can submit be an API endpoint same as n8n — forms are dumb render + fetch?"**
Mechanically yes; `doPost` exists and n8n uses it. **But it would break your auth model.**
`google.script.run` carries the user's Google session, and the app leans on it everywhere —
`Session.getActiveUser()`, `AccessControlService.canViewForm()`, `Actor.email()`. The `@76` endpoint
is anonymous with a shared secret, and **you cannot ship a shared secret to a browser.** Moving
submits to `fetch` means real browser OAuth, not a config change.

**"One deploy per HTML in a forms project?"** — **No.** Same whole-project constraint.

**"Would email links all use the same data source?"** — **Yes**, and that part is already clean.
`buildFormUrl` (`Router.js:181`) is the single place URLs are built. If forms move hosts, that one
function changes.

---

## 4. Is GAS slow for HTML/CSS compared to static?

**Yes, by roughly an order of magnitude**, and it is the honest reason to consider moving.

Measured: **~2.0s floor per page**, for a route doing no sheet work. A static file from CloudFront
is typically 50–150ms warm. Apps Script's floor is container start + script parse + template
evaluation + the sandbox iframe, and **none of it is cacheable** — `include()` inlines bytes into
the HTML, so there is no URL for the browser to cache. Every form open re-downloads the same 33kb
stylesheet.

**What I have not measured:** the breakdown of that 2.0s. If it is dominated by container start and
the iframe, trimming parsed bytes (004 Move 2) buys little, and *only* moving the assets off GAS
helps. That single measurement gates both decisions and is worth taking before either.

---

## 5. Three tiers, cheapest first

### Tier 1 — static assets on CloudFront, GAS still serves the page
`Styles.html` and the shared client JS become `<link>` / `<script src>` to CloudFront. You already
pull the logo from S3, so the pattern exists.

- Browser caches them **once for the whole app** instead of re-downloading per form.
- HR Verification's payload drops from 289kb to roughly **40kb** (form + header + the egg removal).
- Auth untouched. `google.script.run` untouched. No rework.
- Cost: a second deploy target and cache-busting discipline.
- **Best effort-to-benefit in this document.**

### Tier 2 — static forms, GAS as pure API
Forms become static pages on CloudFront; GAS keeps only `doPost` and the handlers.

- Kills the 2.0s floor entirely. Real build tooling, so define-once (003) becomes enforceable by a
  bundler rather than by discipline.
- **Cost: the auth rework is the whole project.** Google Identity Services in the browser, ID token
  to `doPost`, token verification server-side, and every `Session.getActiveUser()` call rewritten to
  read a verified identity instead. That is the real work, not the hosting.

### Tier 3 — leave it
If the 2.0s floor is acceptable for a form someone fills once, Tier 1 plus the define-once work is
genuinely enough. Worth saying out loud: nobody has complained about speed.

---

## 6. The strongest idea here: handlers are the product

> "should it be designed as if any number of things can call the functions but the user view is
> separate?"

**Yes — and you have already half-built it.** n8n calls `submitHRVerification` through `doPost`; the
form calls the same function through `google.script.run`. The handler already serves two clients
that know nothing about each other.

Make that explicit and the architecture falls out:

```
          handlers  (the product — one copy, one contract, one validation)
             |
   +---------+---------+-----------+
   |         |         |           |
 forms    dashboard   n8n     future apps
```

Consequences worth taking seriously:

- **Validation belongs in the handler, not the page.** The Site Name wipe happens because `required`
  lives in HTML — so the n8n path never had it either. One rule in the handler fixes both clients at
  once. This is finding 003's field registry, and it is the same work.
- **A new client costs nothing.** A mobile view, a Slack action, a scheduled job — all just call the
  handler.
- **Retiring a form stops being scary.** Delete a client, not a tangle.
- **It makes the hosting question reversible.** If handlers are a clean API, Tier 1 → Tier 2 is a
  front-end swap, not a rewrite.

And yes — some functions would serve non-HTML clients only (reporting, exports, integrations) and
never need a view. That is the natural shape, not a special case.

---

## 7. What I'd actually do

1. **Measure the 2.0s breakdown.** One number decides Tier 1 vs 2 and 004's Move 2.
2. **004 Move 1** — stop deploying the 256.3kb nothing reaches. Right regardless.
3. **Tier 1** — assets to CloudFront. Large, cheap, reversible.
4. **003's field registry, handler-side** — the define-once win and the fix for a real class of bug.
5. **Revisit Tier 2 and 004 Move 2 only if step 1 says parse and render time actually matter.**

Steps 2–4 are worth doing whatever step 1 says.
