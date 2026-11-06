# 007 — The field taxonomy, and how the eight main forms drift

Covers `InitialRequest`, `EmployeeIDSetup`, `ITSetup`, `TerminationRequest`,
`PositionSiteChangeRequest`, `TerminationApproval`, `StatusChangeApproval`, `ActionItemForm`.
Front-end only. Companion to [006](006-specialist-forms-divergence.md), which did the nine
specialist forms.

---

## 1. The taxonomy — 17 field types for the whole app

This is the deliverable. Every input across all eight forms collapses to:

short text · readonly auto-filled text · secret text · email (domain-validated) · phone · date ·
select-hardcoded · select-server · yes/no radio · n-way radio · checkbox-group · flag checkbox ·
dual-list multi-select · textarea · file · hidden · segmented choice

The nine specialist forms need five of these. **Seventeen definitions cover the application.**

---

## 2. Defects worth acting on

### 2.1 Every password field is `type="text"`
`EmployeeIDSetup.html:82` (SiteDocs Training Password), `:101` (DSS Password),
`ITSetup.html:87` (Temporary Email Password), `:182` (Voicemail Password),
`ActionItemForm.html:105` (SiteDocs Password).

**Five of five. None uses `type="password"`.** This may well be deliberate — IT staff provisioning
an account need to read back what they typed — but it is undocumented, and it is inconsistent even
with itself: two carry a `<small>` hint, three carry none. If intentional it should be a named field
type (`secret-visible`) with the reason written down. If not, it is a credential rendered in
cleartext on a shared screen.

### 2.2 Asterisk without `required` — the Site Name wipe pattern, again
| field | asterisk | `required` |
|---|---|---|
| `PositionSiteChangeRequest.html:26` reqEmail | yes | **no** |
| `PositionSiteChangeRequest.html:30` reqName | yes | **no** |
| `PositionSiteChangeRequest.html:133` receivingManagerEmail | yes | **no** |
| `TerminationRequest.html:116` hr_approved | yes | set by JS at `:305` only |
| `TerminationRequest.html:54` empWorkEmail | yes | set by JS at `:293` only |

Same root cause as the HR Verification defect: the label and the constraint are two separate things
a human has to remember to keep in sync. A registry makes the asterisk a *consequence* of
`required: true`.

### 2.3 Three encodings of the same email-domain rule
- `pattern=".*@(team-group\.com|robinsonsolutions\.com|…)"` — **11 fields**
- `pattern="[a-zA-Z0-9._%+\-]+@(…)"` — `TerminationRequest.html:63` only, same intent
- **no pattern at all** — `StatusChangeApproval.html:129`, a manager-email field
- `type="text"` carrying the email pattern — `TerminationRequest.html:134`

And three hint texts for the same rule: *"Must be a company domain (e.g., @team-group.com)"* ·
*"Must be a @team-group.com, @robinsonsolutions.com, or @industrialappliedtech.com address"* ·
*"Must be @team-group.com, @robinsonsolutions.com, etc."*

### 2.4 The same five email domains, encoded three ways
- `InitialRequest.html:369` — option values **without** `@`
- `ITSetup.html:74` — option values **with** `@`
- `PositionSiteChangeRequest.html:327-328` — options with **no `value` attribute at all**

### 2.5 `.domain-hint` is styled outside the stylesheet
Used 14 times across three forms. Defined in `DirectoryAutocomplete.html:56-61` with a hardcoded
`color:#6c757d` — a Bootstrap grey, not a theme variable, so it does not follow light or AODA mode.
Any form using the class without also including that partial gets no styling at all.

### 2.6 `required` on hidden inputs — no-op
`TerminationApproval.html:30`, `StatusChangeApproval.html:156`. The attribute does nothing on a
hidden input; the real enforcement is `setDecision()`.

### 2.7 ITSetup's 11 context inputs are never submitted
`ITSetup.html:36-46` — eleven hidden inputs carrying `id` but **no `name`**. Read by JS at
`:315-356`, never serialized. Works today, but they look like form data and are not.

### 2.8 Probable dead call
`InitialRequest.html:881` calls `populateSelect('jonasJobNumbers', …)` but the element is
`jonasJobNumbersCheckboxes` at `:398`. Appears to be a no-op. **Not verified by rendering** — worth
a direct check.

### 2.9 Dead markup
`InitialRequest.html:630-633` declares four `<datalist>` elements (`#managersList`,
`#requestersList`, `#jrsList`, `#jobNumbersList`). **No input anywhere carries `list=`.**

### 2.10 Same data, different field names across forms
`InitialRequest` vs `PositionSiteChangeRequest`, for identical dual-list data:

| InitialRequest | PositionSiteChangeRequest |
|---|---|
| `bossJobSites` | `bossComm` |
| `costSheetJobNumbers` | `bossCostJobs` |
| `jonasJobNumbers` | `jonasJobs` |
| `systems` / `equipment` | `sys` / `equip` |

Serialization drifts too: `getAll('adpSites')` yields an array (`:1229`) while
`getAll('bossJobSites').join(', ')` yields a string (`:1219`) — though the widget always writes one
comma-joined hidden input.

### 2.11 `type="tel"` vs `type="text"` for the same field
`InitialRequest.html:534` and `ITSetup.html:176` use `tel`;
`PositionSiteChangeRequest.html:476` and `TerminationRequest.html:238` use `text`.

---

## 3. The same component rendered differently

### Success screen — four implementations
1. shared `SuccessScreen` include (`InitialRequest:624`, `EmployeeIDSetup:145`, `ITSetup:301`)
2. `InitialRequest` **also** hand-builds two more inline for `it_confirmation` and `equipment` modes (`:1306-1313`, `:1318-1327`)
3. `innerHTML` replacement with a bespoke template literal — `TerminationRequest:358-364`, `PositionSiteChangeRequest:652-664` **and** `:678-685` (two different layouts in one file)
4. card `innerHTML` replacement — `TerminationApproval:74-85`, `StatusChangeApproval:222` (no dashboard link), `ActionItemForm:437-450`

Four different headline treatments: `<h1 style="color:var(--success)">`,
`<h2 style="color:var(--brand-red)">`, `<h2 style="color:var(--success)">`,
`<h1 style="color:var(--accent-green-lt)">`.

### Error display — two models
Three files have a `#statusMessage` region. **Five have none and fall back to `alert()`** —
`TerminationRequest:366`, `PositionSiteChangeRequest:687`, `TerminationApproval:88`,
`StatusChangeApproval:224`.

### `.status-btn` renders in different colours per page
`ActionItemForm.html:9-38` is the only page with a real `<style>` block, and it re-declares eleven
rules `Styles.html` already owns — **with different values**:

| | `Styles.html` | `ActionItemForm` |
|---|---|---|
| `.status-btn.active.pending` | `var(--warning)` `#ffab00` | `var(--accent-amber)` `#fcd34d` |
| `.status-btn.active.complete` | `var(--success)` `#00c853`, white text | `var(--accent-green-lt)` `#6ee7b7`, black text |
| `.status-btn.active.not-returned` | `var(--danger)` `#f44336` | `var(--brand-red)` `#EB1C2D` |

The comment above them reads *"Checklist-specific styles (not in Styles.html)"*. It is wrong — all
eleven are in `Styles.html`.

### Callout — same sentence, three encodings
*"Chromebook is the default option. Windows or Mac require IT Director approval"* appears as
`.callout .callout-info` (`PositionSiteChangeRequest:381`) and as a fully inline-styled div with
hardcoded hex (`InitialRequest:443`). Warning callouts exist in four more variants, including
`AIF:480` using `.callout` with **no modifier**, which renders unstyled.

### `.sub-section` and `.sub-section-label` — defined, then inlined anyway
`InitialRequest` inlines the body of `.sub-section` **seven times** (`:280, 299, 359, 391, 426, 483,
517`), with one difference from the class: `margin-left` is `0` instead of `24px`.
`PositionSiteChangeRequest` inlines `.sub-section-label` **nine times** with values identical to
`Styles.html:461`. The class exists and is used by neither.

### Input styling inlined over the stylesheet
`width:100%;padding:12px;border-radius:6px;background:var(--input-bg);…` appears inline on
**twelve** inputs (`InitialRequest:215, 220, 364, 370, 465, 492, 500, 508, 571, 605, 616`,
`PositionSiteChangeRequest:519`) — exactly what `Styles.html:218-235` already applies.

---

## 4. Classes used but defined nowhere

| class | used | note |
|---|---|---|
| `.new-hire-only` | `InitialRequest:98, 242, 551, 581` | only rule is inside a server-conditional `<style>` not emitted in new-hire mode — a JS hook with no CSS |
| `.systems-only` | `InitialRequest:270` | same |
| `.site-list` | `PositionSiteChangeRequest:123, 124` | pure JS hook |
| `.form-label` | `ITSetup:211, 254` | no definition anywhere; both carry inline styles to compensate |
| `.domain-hint` | 14 uses | defined in `DirectoryAutocomplete.html`, not `Styles.html` — see 2.5 |

And unused in the other direction: `.checkbox-grid` (`Styles.html:323`) defines exactly the grid
that ten dual-list containers inline by hand — and is used by none of them. The inline grid is dead
anyway, because `buildDualList` overwrites `container.style.cssText` at `SharedComponents.html:383`.

---

## 5. What this means

Across seventeen forms now audited, **no defect in either document is a logic error.** Every one is
the same shape: *the same idea expressed twice, and the two copies drifted.* Field names, validation
patterns, option encodings, callout markup, success screens, status colours, required-ness.

A registry does not just reduce the line count. It removes the category — because none of these is
something anyone would type if the field had one definition.

## Unverified

- Variable-count fields (ITSetup BOSS committees `:215`, cost sheets `:225`; all ActionItemForm
  checklist rows) are render-time driven; counts above are per-instance.
- The `populateSelect('jonasJobNumbers')` no-op (2.8) was not confirmed by rendering.
- Whether `type="text"` on passwords is deliberate is a question for you, not something source can
  answer.
