# 006 — The nine specialist forms: one template, twenty divergences

These nine are served by one function (`Specialist.js:24`) with a different template name per dept.
They should be the same page with different content. Any difference between them is drift, not
design — which makes this set the cleanest possible test of "define once".

**Scope correction: there are nine, not ten.** `Placeholder.html` **does not exist**, and
`Specialist.js:23` routes every unmapped dept to it:

```js
const htmlFile = deptMap[dept] || 'Placeholder';
```

So an unknown `?dept=` throws at `HtmlService.createTemplateFromFile`. **Live bug**, unrelated to
the refactor.

---

## 1. Live defects found

### 1.1 `details` payload has three incompatible shapes — data integrity
The submitted `details` JSON differs by form:

| shape | files |
|---|---|
| hardcoded `true`, ignores the actual checkbox | `BusinessCards.html:63`, `WIS.html:63`, `SafetyOnboarding.html:86`, `SafetyTermination.html:89` |
| reads the controls properly | `Fleetio.html:65-71` |
| **no `details` key at all** | `CreditCard.html:46`, `Jonas.html:46`, `SiteDocs.html:46` |
| extra top-level keys instead | `Review306090.html:92-93` |

The three with no `details` fall through `Specialist.js:113` — `formData.details || JSON.stringify(formData)` —
so they write **the entire form payload** into the cell where the other six write a small object.
Three of nine specialist results rows have a different shape to the rest.

The four that hardcode `true` record a confirmation the user never actually gave; they're saved
today only by a JS guard or a `required` attribute sitting elsewhere.

### 1.2 `input[type="url"]` is styled nowhere
`Review306090.html:37`. `Styles.html:217-222` enumerates `text, email, tel, number, date, select,
textarea` — `url` is not in the list. The field renders with browser-default white background
against the dark theme, between a styled `select` above it and a styled `textarea` below.

### 1.3 Checkbox enforcement — three different combinations
| approach | files |
|---|---|
| `required` attr only | `Fleetio.html:28,37` |
| JS guard only, no `required` | `BusinessCards.html:28`/:54, `WIS.html:28`/:54 |
| both | `SafetyOnboarding.html:39,47`/:78, `SafetyTermination.html:31,39`/:80 |

Same control, same intent, three enforcement models. This is the same class of defect as the HR
Verification Site Name wipe.

### 1.4 `formId` is written by 9 of 9 and read by none
Dead input in every file.

---

## 2. SafetyTermination is a different application

Of the twenty divergences catalogued, most are this one file:

| | the other eight | `SafetyTermination.html` |
|---|---|---|
| page skeleton | `.container` → `#form-container.card-form` | `body.card-layout` → `.container-narrow` → `.card` — and `Styles.html:72` marks `card-layout` **`@deprecated — use .container`** |
| submit | shared `submitSpecialistTask()` | hand-rolled copy, `:92-109`, plus a `setTimeout` redirect nothing else has |
| errors | `.callout.callout-warning` | `alert()` — `:81, :97, :107` |
| overlay | `classList.add('active')` per the contract at `Styles.html:606` | `style.display = 'flex'` — bypasses the class |
| success screen | `includeWithData('SuccessScreen', …)` | hand-copied, `:55-59`, missing `#successTitle`, `#successMessage`, `#successRequestId`, `.actions` and both buttons |
| header after success | hidden by `SharedComponents.html:359` | **stays on screen** — it hides `#formSection`, but RequestHeader sits outside at `:20` |
| form listener | `addEventListener('submit', …)` | `.onsubmit =` property assignment |

Every one of these is a rewrite of something that already existed.

---

## 3. Smaller drift, all of it avoidable

- **Submit label:** `Confirm Complete` ×6 vs `Confirm & Complete` ×3
- **Notes label:** `Notes (Optional)` with `.optional` span ×3, `Confirmation Notes` ×4, plain text no span ×2
- **Notes rows:** `rows="3"` ×5, `rows="4"` ×4; wrapper `.form-field` ×8 vs `.form-group` ×1
- **Overlay caption:** `<p>Saving...</p>` ×7, `<p>Saving confirmation...</p>` ×1, `<div style="color:white">` ×1 — the `div` loses `#loading-overlay p { font-size: 14px }` (`Styles.html:616`), which is why it carries an inline colour
- **Checkbox title:** `<strong>` ×6; `SafetyOnboarding.html:41,49` use bare text, losing `Styles.html:495` `.confirm-item strong { display:block; font-size:14px; margin-bottom:4px }` — the title collapses inline with its description
- **Spacing:** `style="margin-top:20px"` (Fleetio) vs `style="margin-top: 20px"` (SafetyOnboarding), nowhere else
- **Head meta:** `charset="UTF-8"`/`initial-scale=1.0` ×8 vs `charset="utf-8"`/`initial-scale=1` ×1
- **Back link:** `getBaseUrl()` ×8 vs `getBaseUrl()?form=dashboard` ×1
- **Dead ternary:** `Fleetio.html:65` guards `#fleetioCreated` which is unconditional at `:28`; the identical guard at `:66` *is* needed because `:35` is scriptlet-conditional. Copy-paste symmetry, half dead.
- **Unmarked optionality:** `Review306090.html:36` is the only labelled field with neither a required nor optional marker.

---

## 4. The common core — what becomes one template

Byte-identical or near-identical across the set:

| piece | n |
|---|---|
| `includeWithData('RequestHeader', {requestData: requestData})` — byte-identical | 9/9 |
| three hidden inputs, identical markup incl. the `formId` ternary | 9/9 |
| `<button type="submit" id="submitBtn" class="btn btn-primary btn-full">` — identical but for label | 9/9 |
| logo block, identical S3 URL | 9/9 |
| `include('SharedComponents')` then `safeInclude('Konami')`, same order, same indent | 9/9 |
| loading overlay structure | 9/9 |
| payload keys `workflowId` + `department` + `notes` | 9/9 |
| `includeWithData('SuccessScreen', …)` — byte-identical | 8/9 |
| `<form id="taskForm" autocomplete="off">` — byte-identical | 7/9 |
| `submitSpecialistTask(e.target, data, '<Title>', 'Submission recorded.')` | 6/9 |

**CreditCard, Jonas and SiteDocs are literally the same file** — they differ in five lines: title,
`h1`, dept value, and success title.

---

## 5. What this means for the component library

The nine forms need exactly **five** field types: `hidden`, `checkbox`, `textarea`, `select`,
`input[type=url]`. That is the whole taxonomy for a third of the app's pages.

Expressed against a registry, each of the nine becomes a title, a dept, and a list of one to three
fields. The twenty divergences above all stop being possible, because none of them is anything a
form author would type.

**No file in this set has a `<style>` block.** All CSS comes from `Styles.html`, and no class is
undefined — the only page-local styling is four inline `style=` attributes in `SafetyTermination.html`,
every one a re-declaration of something `Styles.html` already owns.

## Unverified

- The agent did not audit `Konami.html` (127kb) for late-cascade overrides of `.confirm-item` et al.
- Whether `requestData.vehicleRequested === 'Yes'` ever happens in practice, so whether Fleetio's
  `vehicleAssigned` branch is live, is a server-side question not answered here.
- The `input[type=url]` finding is from reading the selector list, not from rendering the page.
