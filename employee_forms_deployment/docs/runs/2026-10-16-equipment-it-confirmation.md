# 2026-10-16 — IT Setup shows and *requires* Google Account fields that were never requested

Both reported issues reproduce from code + prod data. **Neither is legacy** — present in `@78`,
`@79`, `@80` and HEAD. `@80` (what users run) is byte-identical to HEAD for every file involved.

Nothing changed. No test request created — it reproduces on existing data (§4).

> **Two earlier passes in this document aimed at the wrong form.** The complaint is about the form
> the *"IT Confirmation complete"* email opens, which is **IT Setup** (`ITSetup.html`), not the IT
> Confirmation form. IT Confirmation is the step where changes are allowed, so it showing the full
> form is correct by design. Corrected throughout.

---

## 1. The bug — `ITSetup.html` gates nothing

All four sections render unconditionally. There is **no scriptlet conditional anywhere** around
them:

| section | line | conditional? |
|---|---|---|
| **Google Account Setup** | `:49` | **none** |
| Computer Assignment | `:92` | none on the section; only the *detail line* at `:95` |
| Phone Assignment | `:140` | none on the section; only the *detail line* at `:143` |
| BOSS & System Access | `:187` | none on the section; inner items gated |

The only conditionals in the entire file are `:95`, `:143` and the BOSS sub-items at `:204-252` —
and every one of them gates a *display line*, never the section or its inputs.

### It isn't just noise — the fields are `required`

```html
ITSetup.html:56   <input type="radio" name="Email_Created" value="Yes" required>
ITSetup.html:69   <input type="text" id="emailUsername" name="Email_Username" required>
ITSetup.html:74   <select id="emailDomain" name="Email_Domain" required>
ITSetup.html:87   <input type="text" id="emailTempPassword" name="Email_Temp_Password" required>
```

So on a **phone-and-computer-only** equipment request, the IT person is shown a full *Google Account
Setup* block and **cannot submit the form** without inventing an email username, picking a domain,
and typing a temporary password — for an account nobody asked for.

`Computer_Assigned` (`:108`), `Phone_Assigned` (`:155`) and `BOSS_Access` (`:194`) are
unconditionally required in the same way.

### It is identical for new hire and equipment — one template, no branching
`ITSetup.html` contains **zero** references to `NEW_EMP_`, `EQUIP_REQ_`, `baseMode` or any workflow
type. `serveITSetup` (`ITSetupHandler.js:34`) builds the same template from the same
`getITContextData` shape for both. **A new hire who doesn't need a Google account hits exactly the
same wall.**

It surfaced on equipment because that is where it actually happens: a new hire almost always needs
email, whereas of 53 `EQUIP_REQ_` rows **only 2 requested a Google Account** — the rest are
equipment-only with `Systems` blank (eight consecutive `Mobile Phone` rows on 2026-10-01 alone).

---

## 2. The fix — the data is already on the template

`getITContextData()` (`ITSetupHandler.js:50-120`) already supplies everything needed:

```js
ITSetupHandler.js:85   systems: systemsRaw ? systemsRaw.split(',')... : [],
ITSetupHandler.js:87   googleEmail: googleEmailRaw,
ITSetupHandler.js:89   emailRequested: googleEmailRaw + (googleDomain ? '@' + googleDomain : ''),
```

So each section just needs the conditional the file never got — the same pattern `:95` already uses
for the computer detail line:

```html
<? if (requestData.systems.indexOf('Google Account') !== -1 || requestData.googleEmail) { ?>
  <div class="form-section">
    <h2>Google Account Setup</h2>
    ...
  </div>
<? } ?>
```

and likewise `computerReq` for Computer Assignment, `phoneReq` for Phone Assignment, and
`systems` containing `BOSS` for BOSS & System Access.

**Wrapping the section also removes the `required` problem**, because an input that isn't rendered
can't block submit. No separate change needed for that.

### Scope
- **One file**, `ITSetup.html`. Four scriptlet wrappers. No server change — the data already exists.
- `submitITSetup` must tolerate the absent keys. Worth checking before pushing; the handler writes a
  fixed row shape and may assume every field is present.
- New-hire IT Setup behaviour only changes where something genuinely wasn't requested.

---

## 3. The missing portal link

Separate cause, same report. Two things:

**New hire works. Equipment fails — every single one, one way or the other.**

New hire pushes the step unconditionally, and even refines it to `N/A` for hourly-with-no-access:

```js
RequestDetailsHandler.js:131   checklist.push({ name: 'IT Setup', target: 'it_setup', ...itSheetData });
```

That row carries no `tid`, so the button takes the `else` branch at `RequestDetails.html:831` and
opens `?form=it_setup`. Correct.

**3.1 Equipment never pushes an IT Setup step.** For `EQUIP_REQ_` only two steps are explicit —
`Initial Request` (`:661`) and `IT Confirmation` (`:680`/`:685`). Everything else, **including IT
Setup**, has to come from the `Action Items` sheet (`:711-728`).

**3.2 Where an IT action item does exist, the button opens the wrong form.** That row has a `tid`,
so `RequestDetails.html:829` wins and opens `?form=action_item_view&tid=…`, which serves
`ActionItemForm.html` (`Services/ActionItemService.js:941`) — the generic per-item checklist, **not**
`ITSetup.html`. Meanwhile the email links to the real thing:

```js
ITConfirmationHandler.js:271   const itUrl = buildFormUrl('it_setup', { wf: workflowId });
```

### Prod numbers — all 49 affected

| | count |
|---|---|
| equipment workflows | 53 |
| IT Confirmation completed | **49** |
| of those, have an `IT` action item | 20 |
| of those, **no IT Setup row on the tracker at all** | **29** |

So of 49 confirmed equipment requests, **29 show no IT Setup step** and the other **20 show one
whose button opens the wrong form**. None of them can reach IT Setup from the portal — which is
exactly why they are all falling back to the email.

Role gating is **not** the cause — `canViewFormBtn = rp.isAdmin || rp.isIT || isOwner || rp.isSpecialist`
(`RequestDetails.html:585`); an IT user satisfies `rp.isIT`.

**Fix:** push an explicit `{ name: 'IT Setup', target: 'it_setup' }` in the equipment branch, mirroring
`:131`. Smaller than changing the button logic, and makes equipment behave like new hire.

---

## 4. Reproducing without creating anything

A new test request would write a real row and mail the IT group, and it isn't needed. Append to the
portal base URL:

```
?form=it_setup&wf=EQUIP_REQ_20261001-072619_778
```

That workflow (steve Willis) is `Equipment = 'Mobile Phone'`, `Systems = ''` — the Google Account
Setup block should not appear and will, with four required fields.

Others: `EQUIP_REQ_20261005-161931_138` (Dean Buchanan), `EQUIP_REQ_20260925-100804_741` (Jamie
Gosselin).

---

## 5. Deployment check — current, not legacy

| version | `InitialRequest.html` md5 | `RequestDetailsHandler` | `ITConfirmationHandler` |
|---|---|---|---|
| HEAD | `35a17a4b31` | `7e4aaf034b` | `55290cf0a4` |
| **@80 (live)** | `35a17a4b31` | `7e4aaf034b` | `55290cf0a4` |
| @79 | `285bd62fd7` | `d52ea34ab4` | `977aaf96c9` |
| @78 | `1c3a931980` | `aabe8b858f` | `977aaf96c9` |

`@80` is byte-identical to HEAD across all three. The reported behaviour is what the live
deployment does today.

---

## 6. Does a fix help old requests?

**Yes, immediately, with no backfill.** Nothing about the rendering is stored. `getITContextData()`
reads the `Initial Requests` row at view time and the template is evaluated per request, so every
existing workflow — however old — renders under whatever code is being served.

**Caveat:** it only takes effect once a new version is cut *and the live deployment is repointed*.
`clasp push` updates HEAD only; users stay on `@80` until `@81` is deployed.

---

## 7. Status

Nothing changed. Neither fix applied, tested, or deployed.

**Open question for Binns:** §2 assumes IT Setup should show only what was requested. The IT
Confirmation step is where additions happen, so that follows — but confirm that IT never needs to
set up something at the IT Setup step that wasn't on the request.
