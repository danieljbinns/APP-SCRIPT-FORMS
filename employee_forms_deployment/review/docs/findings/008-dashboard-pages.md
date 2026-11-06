# 008 — The four dashboard pages: a crash, invisible text, and a cheap split

`Dashboard.html`, `WorkflowMap.html`, `RequestDetails.html`, `LandingPage.html`.
**None of the four includes `Styles.html`.** They share zero live CSS with the forms.

---

## 1. Live crash — the My Open Requests panel

**`_countsLoaded` is never declared.** Assigned at `Dashboard.html:575`, read at `:586`.

`renderTaskCountsWhenReady()` is called from two places: `loadMyTasks`'s success handler (`:577`,
after the assignment) and `displayData` (`:823`). The two loads were deliberately parallelised — the
comment at `:552-555` says `getDashboardData` usually returns **first**.

On that path, `:586` throws `ReferenceError: _countsLoaded is not defined`, which aborts
`displayData` before it reaches `renderMyRequests(...)` at `:825`. **The My Open Requests panel never
renders.** Every other `let` in the block is declared at `:510-531`; this one was missed.

Worth checking the browser console on a live dashboard load — this should be visible immediately.

---

## 2. Text that is invisible in light and AODA mode

Hardcoded colours, not variables, so no theme can rescue them.

| file:line | rule | result |
|---|---|---|
| `RequestDetails.html:84` | `h2 { color:#fff }` on `var(--card-bg)` = `#ffffff` in light **and** aoda | **white on white** — employee-name heading `:358`, "Flight Check Details" `:467` |
| `RequestDetails.html:331` | `.status-badge { background:#333 }`, text `var(--text-main)` | light `#111` on `#333` ≈1.5:1, aoda `#000` on `#333` ≈1.4:1 — **every Pending/Complete badge on every flow card** |
| `WorkflowMap.html:93-94` | `.tab-btn.active { color:white }` | **active tab invisible in light/aoda** — and it is the only cue for which tab is selected |
| `WorkflowMap.html:162` | `.card h3 { color:#fff }` | every flow-card title disappears |
| `Dashboard.html:168` | `th { background:#252525 }`, text `var(--text-muted)` | light `#555` on `#252525` ≈2.1:1 — **all twelve table headers unreadable in light mode** |
| `Dashboard.html:186` | `tr:hover { background:#222 }` | in light mode the hovered row goes near-black with `#111` text ≈1.1:1 — **the row blanks out on hover** |
| `RequestDetails.html:203` | `.close-btn { color:#fff }` | modal close button invisible |
| `LandingPage.html:63` | `.subtitle { color:#666 }` on the dark gradient | ≈3.0:1 **in the default dark theme** — fails before any toggle is touched |
| `LandingPage.html:336` | `.faq-a strong` overridden for light but **not aoda** | `#a8a8b8` on white ≈2.3:1, in the explicitly-accessible mode |
| `Dashboard.html:861` | `stepColor` hardcoded `#ffab00` | ≈1.8:1 on white, and a literal — no theme can ever fix it |

**Correction to what I said earlier.** I reported light mode failing AA because `Styles.html` never
redefines `--brand-red` for light. That is confirmed — and these pages *do* fix it locally
(`WorkflowMap.html:27`, `RequestDetails.html:25` set `#c41522` ≈6.1:1). **The pages are right and
`Styles.html` is wrong.** `Dashboard.html:23-29` omits it too, so Dashboard inherits the failure.

### Theme-variant fallthrough
`--success`, `--warning` and `--info` are not redefined for light or aoda on any page. On white:
`#00c853` ≈2.2:1, `#ffab00` ≈1.8:1, `#2196f3` ≈3.1:1 — all fail. They hit the Flight Check status
text (`RequestDetails.html:140-146`), the badges (`Dashboard.html:198-211`) and the live badges
(`WorkflowMap.html:180`).

Where they are used as a *background* with explicit `color:#000`, contrast is 9–12:1 and fine.

---

## 3. The split is cheap — cheaper than I estimated

**Total cost to separate the dashboard app from the forms:**

- copy `escapeHtml()` (9 lines) and `formatDate()` (12 lines)
- copy the theme-switcher block, ~230 lines — already written to be self-contained with
  `var(…, fallback)` defaults "so it works on any page regardless of whether Styles.html is
  included" (`SharedComponents.html:5-6`). The shared `localStorage['tg_theme']` key keeps both apps
  in sync for a user who visits both.
- **move** `renderWorkflowFields()` (82 lines) — it is called by exactly two files, both in this set
  (`Dashboard.html:1350`, `RequestDetails.html:781`), and by nothing else. **It is dashboard code
  sitting in the shared file.** Moving it also resolves the oddity that its output CSS
  (`.detail-grid`, `.detail-item`) exists only in the two page stylesheets and not in `Styles.html`.

That is the whole bill. Nothing else is shared in-process. The integration surface is URLs
(`getBaseUrl() + '?form=…'`) and the server API — and the four call **12 functions, all read-or-admin,
not one of them a form submit**. Clean seam.

**Benefit:** nine CSS name collisions stop being latent hazards — `.card`, `.section-title`,
`.status-badge`, `.btn`, `.subtitle`, `.logo`, `.back-link`, `h2`, `h3`. Each is a *different
component sharing a name*: `WorkflowMap`'s `.card` is a fixed-width `240px` flow node, `Styles`' is a
page panel, `LandingPage`'s is a link tile. Merging the stylesheets today would break all three.

### Dead weight these four carry
Of `SharedComponents.html`'s 600 lines, the four use roughly **230**. They load but never call
`submitSpecialistTask()` and `buildDualList()` (~100 lines).

And the formula-injection guard (`SharedComponents.html:550-599`) **actively misfires**: it attaches
to every `input[type="text"]`, which on Dashboard matches the search box (`:383`). Typing a leading
`-`, `=`, `+` or `@` injects a red *"Value cannot start with =, +, -, or @"* next to the search
field. A form validator firing on a search box.

### The role-gating block is dead here too
Both Dashboard (`:812-819`) and RequestDetails (`:568-572`) set `body.is-admin` etc. — but **neither
ever uses `.btn-role-gated` or `[data-role-gate]`**. They re-implement gating with inline styles via
`_dis()` (`Dashboard.html:1157`) and `_rdDis()` (`RequestDetails.html:824`). Confirms finding 002's
note from the other direction: `Styles.html:876-946` has no consumer anywhere.

---

## 4. Duplication between the two dashboard pages

- **`BADGE_LABEL` (`Dashboard.html:1185-1215`) vs `RD_BADGE_LABEL` (`RequestDetails.html:610-622`)** —
  the same category→label taxonomy, declared twice and **already drifted**: Dashboard has
  `'Initial Request'`, `'IT Setup'`, `'HR Verification'`, `'Approval'`, `'HR Approval'`; RD does not.
  A new action-item category must be added in both or one page shows the raw category name.
- `cancelCurrentRequest()` ≡ `cancelRequest()`; `bumpSpecific()` ≡ `bump()`; `_dis()` ≡ `_rdDis()`;
  Escape-close; click-outside-close; the role body-class block; owner/permission resolution;
  sessionStorage persistence; the Remind/View Form/View Data decision tree.
- Flow-map geometry duplicated under two naming schemes — `.arrow-down`/`.branch-connector`
  (`WorkflowMap.html:183-220`) vs `.connector-line`/`.branch-stem` (`RequestDetails.html:293-323`):
  same 2px × 40px line, same transform, different names.
- `var SERVER_BASE_URL` declared three times. And `Dashboard.html` uses **three different mechanisms**
  for the same URL: `SERVER_BASE_URL` (`:1460`) and `<?= getBaseUrl() ?>` inside JS string literals
  (`:1468`, `:1488`).

### Dead code
`FIRST_PAGE_SIZE` (`:545`, never read) · `STEP_CATEGORY_TERMS['IT']` and `['ID Setup']` (`:698-699`,
unreachable — dedicated branches return first) · `WorkflowMap`'s `--info` (defined in all three theme
blocks, zero `var()` references) · the `&vd=` deep link (`Dashboard.html:1461` appends it "for section
auto-open"; `RequestDetails.html` never reads it) · `Dashboard.html:718` looks up `#dashboardTable`,
which does not exist — the table is `#workflowTable` (`:431`); it works by accident via a
`querySelector('table')` fallback.

---

## 5. Accessibility — the dashboard is the worst page in the app

1. **The table is keyboard-inaccessible.** Rows are `<tr onclick="openDetails(...)">` (`:881`) with
   no `tabindex`, no `role`, no key handler, while `cursor:pointer` (`:185`) advertises them as
   clickable. **Opening any request detail is mouse-only.**
2. **Filter buttons signal state by colour alone** — no `aria-pressed` on any of the seven
   (`:387-397`), and five are switched on at load (`:970-975`). A screen-reader user starts with five
   invisible active filters.
3. **No `aria-live` anywhere.** `#tableBody` is replaced on every keystroke, filter, sort and page
   change (`:899`). The debounced search (`:940-944`) changes results silently as you type.
4. **Modals have no dialog semantics and no focus management** — no `role="dialog"`, no
   `aria-modal`, no focus move on open, no restore on close, no trap. Same on `#dataModal`
   (`RequestDetails.html:485`).
5. The process map is mouse-only too — seven static `<div onclick="viewStepData(...)">`
   (`RequestDetails.html:375-449`) plus every dynamic card.
6. `editStartDate()` (`RequestDetails.html:858`) uses `prompt()` — unlabelled, unstyleable, and
   suppressed by some browsers.
7. `Dashboard.html:358` logo `<img>` has **no `alt`** (`LandingPage.html:384` has one).
8. `LandingPage.html` has **exactly one heading element** — the `<h1>` at `:393`. "Dashboards"
   (`:493`) and "Forms" (`:503`) are `<div class="section-title">`.

**Best-behaved control in the whole app:** `LandingPage.html:398` — a real `<button>` with
`aria-expanded` correctly maintained (`:534`). Missing only `aria-controls`.

---

## 6. Static-hosting blockers

29 server scriptlet sites and 16 `google.script.run` calls across the four. `google.script.host`:
**zero occurrences anywhere in the folder.** `google.script.url` used once
(`RequestDetails.html:512`), replaceable with `URLSearchParams`, which `:499` already uses.

Neither of the four defines **any media query**. `Styles.html:867-874` has the only responsive
handling in the app, and these pages don't include it — so Dashboard's 12-column table (`:433-446`)
and WorkflowMap's fixed `width:240px` cards (`:155`) have none.

## Unverified

- Contrast figures are computed estimates, not measured in a browser.
- Whether `getBaseUrl()`/`buildFormUrl()` resolve correctly across two deployments, and whether
  `getDashboardData`'s role resolution (noted as ~8.3s fixed cost at `Dashboard.html:553-554`) is
  reusable from a second script project — both server-side, outside this scope.
