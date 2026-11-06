# 003 — "Define once, inherit everywhere": review, options, effects

**Goal, in your words:** add a new form and it inherits. Change a colour or a box size once and
every form changes. No thing defined twice.

This is a maintainability review, not a performance one. Apps Script's render floor is ~2.0s
regardless; none of what follows makes pages meaningfully faster. The payoff is that a change
happens in one place.

---

## 1. Why it isn't "define once" today — the mechanism

Apps Script gives you two sharing mechanisms and **neither is a module system**:

- **`include('X')` is server-side text inlining.** The file's bytes are pasted into each page's HTML
  at render. There is no URL, so no browser cache and no reuse across pages. "Shared" means shared
  *source*, not shared *load*.
- **Server `.js` files are concatenated into one global scope** and re-parsed on every request. Every
  global is visible everywhere, and two globals with the same name silently collide (last wins).

There is no build step, no imports, no tree-shaking. So "define once" cannot be enforced by tooling.
It has to be enforced by **one source of truth that everything else derives from at render time**.

Measured consequences of not having that today:

| symptom | measured |
|---|---|
| Design tokens defined in **8 separate places** | `Styles.html` + 7 pages with their own `:root` |
| `Styles.html` reached by only **19 of 38** pages | the other 19 carry private stylesheets |
| `buildDualList` ships to 28 pages | **2** call it |
| `renderWorkflowFields` ships to 28 | **2** call it |
| `escapeHtml` / `formatDate` ship to 28 | **3** each |
| `submitSpecialistTask` ships to 28 | **8** |
| `HRVerification.html` | 253 lines, **109 of them script (43%)** |

And the cost of the duplication is not weight, it is **divergence**:

- Light mode fails WCAG AA (≈3.6:1) because `--brand-red` was redefined in the AODA palette but
  missed in the light one. One palette, one place, and this could not have happened.
- Dashboard's AODA mode never redefines `--success` / `--warning` / `--info` → ≈1.9:1 in the mode
  that exists specifically for contrast.
- Role-gated buttons never grey out: `Styles.html:876-946` defines the whole system, but the only
  two pages that set the role classes don't include `Styles.html`.
- `rh-f--full` is applied at `RequestHeader.html:191,193` and defined nowhere.
- `HRVerification.html:143-163` and `168-195` are the same dropdown-populate algorithm written
  twice, and they have already diverged — one has a null guard, the other doesn't.
- The Site Name wipe exists because `required` is a thing each page has to remember to type.
  `#siteName` didn't get it; `#jrTitle` did.

**Every one of those is a "defined twice" bug, not a performance bug.** That is the case for doing
this.

---

## 2. The four layers that need a single owner

| layer | what it owns | today |
|---|---|---|
| **Tokens** | colour, spacing, radius, type scale | 8 `:root` blocks |
| **Field types** | what a text/date/select *looks like* and is *made of* | hand-written markup per form |
| **Behaviour** | submit, validate, populate, escape, format | split between `SharedComponents` and per-page inline script |
| **Contract** | field → sheet column, required, option source | split across `SCHEMA`, `FormContracts`, and HTML attributes |

The contract layer is the important one and it is half-built already: `SchemaConstants.js` holds
field → column, `FormContracts.js` holds form → field list. What's missing is the other half —
type, label, validation, options — and a renderer that reads it.

---

## 3. Options

### Option A — One stylesheet, one palette
Collapse the 8 `:root` blocks into `Styles.html`; make all 38 pages include it; delete the local
overrides that merely restate it.

- **Effect:** change a colour, a radius or a box size once. Fixes the light-mode and AODA contrast
  bugs structurally. Does nothing for markup, validation or behaviour.
- **Effort:** low. **Risk:** low–medium. The 19 non-including pages have local rules that may
  conflict once a real stylesheet lands under them; each needs a visual check.
- **New form inherits:** styling only.

### Option B — A + component partials
Split `SharedComponents` by consumer (`Components.Core` everywhere, `Components.DualList` only
where called), and extract repeated markup — loading overlay, status message, submit block — into
partials.

- **Effect:** colour *and* layout change once; a new form composes from existing pieces. Each page
  carries only what it calls.
- **Effort:** medium. **Risk:** low — it is moving code, not changing behaviour.
- **New form inherits:** styling and chrome. It still hand-writes its own field list, and `required`
  is still per-page.

### Option C — A + B + a field registry  ← the actual goal
One server-side registry, one entry per field:

```js
SITE_NAME: {
  type:     'select',
  label:    'Site',
  required: true,
  options:  'sites',                  // -> getSitesList()
  col:      SCHEMA.INITIAL_REQUESTS.SITE_NAME,   // 15
  sheet:    CONFIG.SHEETS.INITIAL_REQUESTS,
},
```

A `field()` scriptlet renders the markup from it. Server validation reads the same entry. The sheet
write reads the same `col`. The form becomes:

```html
<section class="form-section">
  <h2>Employee</h2>
  <?!= field('FIRST_NAME', requestData) ?>
  <?!= field('SITE_NAME',  requestData) ?>
</section>
```

- **Effect:** a new form is a template plus a list of field keys. Change a field's type, label,
  validation or column in one place and every form that uses it follows. Retiring a form is deleting
  a list, not auditing markup. **The Site Name class of bug becomes structurally impossible** — no
  page can forget `required`, because no page types it.
- **Effort:** high — a real refactor across 19+ forms.
- **Risk:** see §5.
- **New form inherits:** everything.

### Option D — external hosting for genuine load-once
Serve shared CSS/JS from S3 (you already pull the logo from there) with a cache header, so it
downloads once for the whole app rather than being inlined per page.

- **Effect:** real browser caching. Irrelevant to maintainability — A/B/C already give you that.
- **Verdict:** not now. It adds an external dependency and a second deploy step to solve a problem
  you said you don't care about. Revisit only if page weight becomes a complaint.

**Recommended path: A → B → C**, in that order, because each is independently shippable and each
leaves the codebase better than it found it. Prove C on **HR Verification** first, exactly as you
said, then propagate.

---

## 4. Operational effects

- **Deploy is unchanged.** One script project, one `clasp push`, one version cut. These changes
  don't alter how you ship — but see the blast-radius note below.
- **Testing carries more weight.** The seven Node suites (159/218/315/27/24/22/600) currently pass
  against per-page logic. Under C they must cover the registry, because the registry becomes the
  thing that can break everything at once. That is a *feature* — one place to test — but the suites
  need extending before C lands, not after.
- **The contract gate still applies.** `tools/efx/n8n-check.js` must stay green; if field definitions
  move, regenerate with `gen-contracts.js --lock` first. n8n must not break.
- **Review gets easier.** A form PR becomes a diff of a field list rather than a diff of markup.
- **Onboarding gets easier.** "Where is the Site field defined?" has one answer.

---

## 5. Honest costs — read before committing

1. **Indirection.** Reading a form no longer tells you what it renders; you need the registry too.
   That is the price of "define once", and it is real. It's worth paying at 19 forms. It would not
   be at 3.
2. **Blast radius inverts.** Today a bad change breaks one form. Under C a bad change breaks all of
   them. The test suites are the mitigation and they must be extended first.
3. **Some duplication is deliberate.** The four `*-submitter.html` reference guides are standalone
   public pages; they may be duplicated on purpose. `ActionItemForm.html:22-24` redefines status
   colours with *different* values than `Styles.html:559-561` — that is either a bug or an intent
   nobody wrote down. **Each one needs a decision, not a bulk rewrite.** This is the part that
   cannot be automated and is where the time will actually go.
4. **Forms are retiring.** You said some go away. That argues for doing C *before* the next wave of
   changes, not after — but it also means some forms aren't worth migrating at all. Worth marking
   which ones are terminal before starting.
5. **This is a large diff on a live system.** It touches nearly every file, and prod currently serves
   @80 — which already lacks two fixes sitting on HEAD. Sequencing matters: land the pending fixes
   and cut a version before starting a refactor of this size, so there is a clean rollback point.

---

## 6. Where this leaves the two review copies

The split you asked for maps onto this exactly:

- **`keep/`** = Option A, plus the correctness fixes (Site Name wipe, the lock ordering, the
  unguarded `context.systems`, the missing null guard, light-mode contrast). No restructuring. This
  is the tree that could ship soon.
- **`refactor/`** = Option C. Easter eggs already archived. HR Verification is the pilot.

`_baseline/` stays byte-identical to prod HEAD so every claim above stays checkable.
