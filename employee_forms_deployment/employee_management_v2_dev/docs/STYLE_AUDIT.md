# Style Audit — New Hire Related Forms
_New hire workflow forms only. TerminationRequest.html and PositionSiteChangeRequest.html excluded._

Legend:  
`DUPE` — identical rule already exists in Styles.html  
`OVERLAP` — similar rule in Styles.html but values differ  
`UNIQUE` — not in Styles.html at all

---

## Styles.html — Master Class Inventory

All classes available globally to any form that includes `<?!= include('Styles') ?>`.

| Class / Selector | Applies To | Notes |
|---|---|---|
| `:root` vars | All elements via CSS custom properties | 29 variables total |
| `*` reset | Every element | box-sizing, margin 0, padding 0 |
| `body` | `<body>` | font, bg, color, line-height, min-height, padding |
| `.container` | `<div class="container">` — page wrapper | max-width 1800px, centered |
| `.container-wide` | `<div>` — deprecated wider wrapper | max-width 1600px |
| `.container-narrow` | `<div>` — narrow column | max-width 960px |
| `body.card-layout` | `<body>` with card-layout | deprecated flex-center layout |
| `.card` | `<div class="card">` — floating card | rounded 12px, heavy shadow |
| `.card-form` | `<div class="card-form">` — form body | 8px radius, light shadow |
| `.logo-container` | `<div>` wrapping `<img>` logo | centered, margin-bottom |
| `.logo` | `<img>` logo | height 120px |
| `h1` | `<h1>` page title | 22px, center, bold |
| `.subtitle` | `<p class="subtitle">` | muted, centered, 14px |
| `.page-header` | `<div>` wrapping h1 + subtitle | centered block |
| `.section-title` | `<div>` or `<p>` section label | red, 12px, uppercase, underline |
| `h2` | `<h2>` section divider | 1.2rem, border-bottom, white |
| `h3` | `<h3>` sub-section label | 14px, white |
| `hr` | `<hr>` | border-top only |
| `.form-group` | `<div>` wrapping label + input | margin-bottom 20px |
| `.form-section` | `<div>` grouping multiple fields | margin-bottom 30px |
| `.question-wrapper` | `<div>` for a single question block | margin-bottom 25px |
| `.form-field` | `<div>` flex column label+input pair | flex column |
| `.form-row` | `<div>` — auto-fit grid row | auto-fit minmax 250px |
| `.form-row-2` | `<div>` — 2-col grid row | 1fr 1fr |
| `.form-row-3` | `<div>` — 3-col grid row | 2fr 1fr 2fr |
| `.form-row-4` | `<div>` — 4-col grid row | repeat(4,1fr) |
| `label` | `<label>` | bold, 0.9rem, white |
| `.required` | `<span class="required">*</span>` | red asterisk |
| `small` | `<small>` | 0.8rem, italic, muted |
| `input[type=text/email/tel/number/date]` | All standard text inputs | full-width, dark bg, padding 12px |
| `select` | `<select>` | same as inputs |
| `textarea` | `<textarea>` | same as inputs, resize vertical |
| `input:focus / select:focus / textarea:focus` | focused controls | red outline |
| `input[type="date"]` picker | date inputs | full-clickable invisible icon |
| `input[readonly]` | read-only inputs | muted color |
| `.radio-group` | `<div class="radio-group">` | flex row, border, overflow hidden |
| `.radio-group label` | `<label>` inside radio group | flex:1, no margin |
| `.radio-button` | `<span class="radio-button">` inside radio label | display block, padded, clickable |
| `input[type="radio"]:checked + .radio-button` | checked radio span | red bg, white text |
| `.checkbox-group` | `<div class="checkbox-group">` | auto-fit grid of tiles |
| `.checkbox-label` | `<label class="checkbox-label">` | tiled checkbox with border |
| `.checkbox-label input[type="checkbox"]` | checkbox inside tile | 20×20, red accent |
| `.checkbox-label:has(input:checked)` | checked tile | red bg tint, red border |
| `.checkbox-label:has(input:checked) span` | text inside checked tile | red, bold |
| `.checkbox-grid` | `<div class="checkbox-grid">` — compact inline grid | auto-fill minmax 160px |
| `.checkbox-grid label` | `<label>` inside compact grid | flex row, 0.85rem, normal weight |
| `.checkbox-grid input[type="checkbox"]` | checkbox in compact grid | red accent, no shrink |
| `.dual-list-wrapper` | `<div>` outer dual-list container | flex row, gap 10px |
| `.dual-list-panel` | `<div>` available/selected panel | flex column, dark bg, border |
| `.dual-list-panel-header` | `<div>` panel title bar | dark bg, 0.75rem, uppercase |
| `.dual-list-search` | `<input>` filter box inside panel | transparent bg, border-bottom only |
| `.dual-list-list` | `<div>` scrollable item list | flex:1, overflow-y auto |
| `.dual-list-item` | `<div>` individual list entry | 0.9rem, padded, hover bg |
| `.dual-list-item.selected` | highlighted item | red tint bg |
| `.dual-list-footer` | `<div>` panel footer bar | flex row, border-top |
| `.dual-list-btn` | `<button>` Add All / Remove All | full-width, dark bg |
| `.dual-list-arrows` | `<div>` middle arrow column | flex column, centered |
| `.dual-list-arrow` | `<button>` › ‹ arrows | 40×40, dark bg |
| `.add-arrow` | `<button class="add-arrow">` | green color/border |
| `.remove-arrow` | `<button class="remove-arrow">` | red color/border |
| `.sub-section` | `<div class="sub-section">` — expands under checkbox | hidden by default, indented |
| `.sub-section-label` | `<span>` label inside sub-section | 0.85rem, muted, bold |
| `.confirm-item` | `<div class="confirm-item">` — green-accent task row | flex, border, pointer |
| `.confirm-item:has(input:checked)` | checked confirm row | green border + bg |
| `.confirm-item input[type="checkbox"]` | checkbox in confirm row | 20×20, green accent |
| `.confirm-item strong` | `<strong>` task title | block, 14px |
| `.confirm-item span` | `<span>` task subtitle | 12px, muted |
| `.logic-section` | `<div class="logic-section">` — conditional panel | hidden, red left border |
| `.btn` | `<button class="btn">` or `<a class="btn">` | base button |
| `.btn-primary` | `.btn.btn-primary` | red bg, white text |
| `.btn-secondary` | `.btn.btn-secondary` | dark bg, white text |
| `.btn-success` | `.btn.btn-success` | green bg |
| `.btn-full` | `.btn.btn-full` | full width block |
| `.actions` | `<div class="actions">` — 2-button row | 2-col grid |
| `.status-btn-group` | `<div class="status-btn-group">` | flex row pill group |
| `.status-btn` | `<button class="status-btn">` inside group | transparent, uppercase, 11px |
| `.status-btn.active.pending` | pending state button | warning (amber) bg |
| `.status-btn.active.complete` | complete state button | success (green) bg |
| `.status-btn.active.not-returned` | not-returned state button | danger (red) bg |
| `.status-btn:disabled` | disabled button | not-allowed, 0.5 opacity |
| `.status-badge` | `<span class="status-badge">` — Open/Closed pill | 11px, rounded, uppercase |
| `.status-open` | `.status-badge.status-open` | red tint |
| `.status-closed` | `.status-badge.status-closed` | green tint |
| `.checklist-section` | `<div>` wrapping checklist | margin-bottom 24px |
| `.checklist-table` | `<table class="checklist-table">` | full width, collapse, 14px |
| `.checklist-table th` | `<th>` | left align, 12px padding, muted, 12px font |
| `.checklist-table td` | `<td>` | 12px padding, border-bottom |
| `.item-name` | `<span class="item-name">` inside td | bold, block, margin-bottom 4px |
| `.audit-info` | `<span class="audit-info">` inside td | 10px, muted, block |
| `#loading-overlay` | `<div id="loading-overlay">` | fixed fullscreen, dark bg, flex |
| `#loading-overlay.active` | active state | display flex |
| `.spinner` | `<div class="spinner">` | animated red border-top circle |
| `#success-screen` | `<div id="success-screen">` | centered, padded, hidden |
| `.success-icon` | `<div class="success-icon">` — emoji icon | 56px |
| `.callout` | `<div class="callout">` | padded banner |
| `.callout-warning` | `.callout.callout-warning` | amber tint |
| `.callout-info` | `.callout.callout-info` | blue tint |
| `.callout-success` | `.callout.callout-success` | green tint |
| `.help-text` | `<span class="help-text">` or `<small>` | 11px, muted, italic, block |
| `.warn-text` | `<span class="warn-text">` | 0.82rem, warning amber |
| `.read-only-box` | `<div class="read-only-box">` | dark bg box for locked data |
| `.info-grid` | `<div class="info-grid">` | flex wrap, key-value pairs |
| `.info-grid-item` | `<div>` inside info-grid | flex column |
| `.info-label` | `<span class="info-label">` | 11px, muted, uppercase |
| `.info-value` | `<span class="info-value">` | bold, 13px, white |
| `.back-link` | `<a class="back-link">` | red, inline-block, 16px |
| `.ticket-info` | `<div class="ticket-info">` | 2-col grid info block |
| `.info-row` | `<div class="info-row">` | flex column, 13px |
| `.info-row .label` | `<span class="label">` inside info-row | 11px, muted, uppercase |
| `.info-row .value` | `<span class="value">` inside info-row | bold, white |
| `.info-row.span-2` | 2-column spanning info-row | grid-column span 2 |
| `.info-row.comments` | comments info-row | border-top, italic |

---

## Inline Styles — Per Form

---

### `InitialRequest.html`

| Selector | Applies To | Status |
|---|---|---|
| `#gatekeeperSection` | `<div id="gatekeeperSection">` — intro/prereq screen | UNIQUE |
| `#gatekeeperSection h1` | `<h1>` inside gatekeeper | UNIQUE (overrides base h1) |
| `.requirements-toggle` | `<details>` prereq accordion wrapper | UNIQUE |
| `.requirements-toggle summary` | `<summary>` accordion trigger | UNIQUE |
| `.requirements-toggle summary:hover` | hovered summary | UNIQUE |
| `.requirements-toggle summary::-webkit-details-marker` | removes default arrow | UNIQUE |
| `.requirements-toggle summary::before` | custom ▶ arrow via pseudo | UNIQUE |
| `.requirements-toggle[open] summary::before` | rotated arrow when open | UNIQUE |
| `.requirements-content` | `<div>` inside `<details>` | UNIQUE |
| `.requirements-content ul` | `<ul>` inside requirements | UNIQUE |
| `.confirm-button` | `<button class="confirm-button">` — large gatekeeper CTA | UNIQUE — named differently from `.btn`, different sizing |
| `.confirm-button:hover` | hovered CTA | UNIQUE |
| `#mainForm` | `<form id="mainForm">` | UNIQUE — controls initial hidden/fade state |
| `#mainForm.show` | form visible state | UNIQUE |
| `#equipmentSection` | `<div id="equipmentSection">` | UNIQUE |
| `#submit-container` | `<div id="submit-container">` | UNIQUE |
| `.loading-text` | `<p class="loading-text">` | UNIQUE — differs from `.help-text` (no italic treatment) |
| _(conditional)_ `#gatekeeperSection` display override | equipment/it_confirmation mode | UNIQUE — mode-specific override |
| _(conditional)_ `#mainForm` display override | equipment/it_confirmation mode | UNIQUE — mode-specific override |
| _(conditional)_ `.new-hire-only` | `<div class="new-hire-only">` sections | UNIQUE — mode-specific hide |
| _(conditional)_ `#systemAccessSection` | equipment-specific section | UNIQUE — mode-specific show |
| _(conditional)_ `.systems-only` | `<div class="systems-only">` | UNIQUE — mode-specific hide |

---

### `BusinessCards.html`

| Selector | Applies To | Status |
|---|---|---|
| `.confirm-item` | `<div class="confirm-item">` task row | **DUPE** — exact match in Styles.html |
| `.confirm-item:has(input:checked)` | checked confirm row | **DUPE** — exact match |
| `.confirm-item input[type="checkbox"]` | checkbox inside row | **DUPE** — exact match |
| `.confirm-item label` | `<label>` inside confirm row | OVERLAP — adds `cursor: pointer; margin: 0` (Styles.html targets `strong`/`span` directly) |
| `.confirm-item label strong` | `<strong>` task title | OVERLAP — same values but selector specificity differs (Styles uses `.confirm-item strong`) |
| `.confirm-item label span` | `<span>` task subtitle | OVERLAP — same values but selector specificity differs |

---

### `Fleetio.html`

| Selector | Applies To | Status |
|---|---|---|
| `.confirm-item` | `<div class="confirm-item">` task row | **DUPE** — identical to BusinessCards and Styles.html |
| `.confirm-item:has(input:checked)` | checked confirm row | **DUPE** |
| `.confirm-item input[type="checkbox"]` | checkbox inside row | **DUPE** |
| `.confirm-item label` | `<label>` inside confirm row | OVERLAP — same as BusinessCards |
| `.confirm-item label strong` | `<strong>` task title | OVERLAP — same as BusinessCards |
| `.confirm-item label span` | `<span>` task subtitle | OVERLAP — same as BusinessCards |

---

### `WIS.html`

| Selector | Applies To | Status |
|---|---|---|
| `.confirm-item` | `<div class="confirm-item">` task row | **DUPE** — identical to BusinessCards and Styles.html |
| `.confirm-item:has(input:checked)` | checked confirm row | **DUPE** |
| `.confirm-item input[type="checkbox"]` | checkbox inside row | **DUPE** |
| `.confirm-item label` | `<label>` inside confirm row | OVERLAP — same as BusinessCards |
| `.confirm-item label strong` | `<strong>` task title | OVERLAP — same as BusinessCards |
| `.confirm-item label span` | `<span>` task subtitle | OVERLAP — same as BusinessCards |

---

### `Review306090.html`

| Selector | Applies To | Status |
|---|---|---|
| `.help-text` | `<span class="help-text">` hint text | **DUPE** — identical to Styles.html (11px, muted, margin-top 4px) |

---

### `ActionItemForm.html`

| Selector | Applies To | Status |
|---|---|---|
| `.checklist-table` | `<table class="checklist-table">` | OVERLAP — Styles.html has it; inline version adds `margin-top: 8px` |
| `.checklist-table th` | `<th>` | OVERLAP — inline uses `10px 12px` padding, Styles uses `12px`; inline adds `letter-spacing: 0.5px` |
| `.checklist-table td` | `<td>` | OVERLAP — inline uses `10px 12px` padding, Styles uses `12px`; inline uses `--border-subtle` instead of `--border-color` |
| `.checklist-table tr:last-child td` | last `<td>` in table | UNIQUE — not in Styles.html |
| `.item-name` | `<span class="item-name">` | OVERLAP — inline adds `color: var(--text-main)` explicitly |
| `.audit-info` | `<span class="audit-info">` | OVERLAP — inline adds `margin-top: 2px`; Styles uses `color: var(--text-muted)`, inline uses `var(--text-dim)` |
| `.status-btn-group` | `<div class="status-btn-group">` | OVERLAP — identical shape; inline uses `var(--border-color)`, Styles uses `var(--input-border)` |
| `.status-btn` | `<button class="status-btn">` | OVERLAP — inline uses `7px 12px` padding, Styles uses `8px 12px`; same otherwise |
| `.status-btn:last-child` | last button in group | **DUPE** — identical |
| `.status-btn:hover:not(.active)` | hovered non-active button | **DUPE** — identical |
| `.status-btn.active.pending` | pending state | OVERLAP — inline uses `var(--accent-amber)` (yellow); Styles uses `var(--warning)` (same token, same value) — effectively same |
| `.status-btn.active.complete` | complete state | OVERLAP — inline uses `var(--accent-green-lt)` + `color: #000`; Styles uses `var(--success)` + `color: white` — **different appearance** |
| `.status-btn.active.not-returned` | not-returned state | OVERLAP — inline uses `var(--brand-red)` + `color: #fff`; Styles uses `var(--danger)` + `color: white` — different token, different red value |
| `.status-btn:disabled` | disabled state | **DUPE** — identical |
| `.serial-input` | `<input class="serial-input">` — serial number field | UNIQUE — dark input, no class equivalent in Styles |
| `.item-comment` | `<textarea class="item-comment">` | UNIQUE — min-height 38px, resize vertical |
| `.task-badge` | `<span class="task-badge">` — Open/Closed pill | UNIQUE — differs from `.status-badge` (no margin, different padding) |
| `.task-badge.open` | open state badge | UNIQUE — red tint (`.status-open` is the equivalent but on different class name) |
| `.task-badge.closed` | closed state badge | UNIQUE — green tint (`.status-closed` is the equivalent but different class name) |
| `.actions-grid` | `<div class="actions-grid">` — 2-col action row | UNIQUE — similar to `.actions` in Styles but different class name |

---

### `RequestHeader.html`

Self-contained component. All styles are `rh-*` namespaced. None in Styles.html. Not a candidate for consolidation — intentionally scoped.

| Class | Applies To |
|---|---|
| `.rh` | Outer wrapper div |
| `.rh-top` | Top badge bar |
| `.rh-name` | Employee name (unused in current markup) |
| `.rh-badges` | Flex row of badge pills |
| `.rh-badge` | Base badge pill (WF ID, type, emp type) |
| `.rh-badge-wf` | Workflow ID badge (blue/purple tint) |
| `.rh-badge-typ` | Workflow type badge (green tint) |
| `.rh-badge-emp` | Employment type badge (red tint) |
| `.rh-sec` | Content section block |
| `.rh-hdr` | Section header row (title + step pills) |
| `.rh-title` | Section label (red uppercase) |
| `.rh-steps` | Row of step status pills |
| `.rh-step` | Individual step pill |
| `.rh-s-init` | Step pill — initial/pending (red tint) |
| `.rh-s-done` | Step pill — done (green tint) |
| `.rh-s-asgn` | Step pill — assigned/waiting (amber tint) |
| `.rh-s-req` | Step pill — required later (blue tint) |
| `.rh-g` | Standard field grid (140px min) |
| `.rh-gw` | Wide field grid (180px min) |
| `.rh-f` | Individual field container (label + value) |
| `.rh-l` | Field label (10px, muted, uppercase) |
| `.rh-v` | Field value (12px, bold, white) |
| `.rh-v.dim` | Empty/placeholder value (dim color) |
| `.rh-v.mono` | Monospace value (green, credentials) |
| `.rh-v.cred` | Credential value (same as mono) |
| `.rh-v.link` | Link-style value |
| `.rh-annot` | Inline annotation (e.g. "HR ✓") |
| `.rh-tags` | Flex wrap tag row |
| `.rh-tag` | Individual tag pill (systems, equipment) |
| `.rh-subdiv` | Horizontal rule with label |
| `.rh-hs` | Hover stamp (tooltip popup on field hover) |
| `.rh-hs-hdr` | Hover stamp section header |
| `.rh-hr` | Hover stamp row |
| `.rh-hl` | Hover stamp row label |
| `.rh-hv` | Hover stamp row value |
| `.rh-hv.mono` | Monospace hover value (amber) |
| `hr.rh-hd` | Divider inside hover stamp |

---

## Summary — What Can Be Removed

| Form | Can Delete | Reason |
|---|---|---|
| `BusinessCards.html` | Entire `<style>` block | All 6 rules are DUPE or OVERLAP of Styles.html `.confirm-item` |
| `Fleetio.html` | Entire `<style>` block | Identical to BusinessCards — same outcome |
| `WIS.html` | Entire `<style>` block | Identical to BusinessCards — same outcome |
| `Review306090.html` | Entire `<style>` block | Single rule `.help-text` already in Styles.html |
| `ActionItemForm.html` | Partial — remove DUPE rules | `.status-btn:last-child`, `.status-btn:hover:not(.active)`, `.status-btn:disabled` can go; rest need decision on OVERLAP values |
| `InitialRequest.html` | Nothing | All rules are page-specific (IDs, mode overrides, gatekeeper) |
| `RequestHeader.html` | Nothing | Self-contained component namespace |

> Note: The `.confirm-item label` selector in BusinessCards/Fleetio/WIS adds `margin: 0` that Styles.html does not set. When the inline block is removed, `label { margin-bottom: 8px }` from Styles.html will apply — confirm-item labels will have an 8px gap below them. Either add `.confirm-item label { margin: 0; }` to Styles.html, or verify visually that it doesn't affect layout.
