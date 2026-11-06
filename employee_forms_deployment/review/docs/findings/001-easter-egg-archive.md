# 001 — Easter-egg subsystem is 57% of every form page's payload

**Severity:** high (load cost) · **Applied to:** `refactor/` · **Not applied to:** `keep/`

## What

Every form route ships `Konami.html` + `EasterEggMaps.html` + `FieldIndex.html` — **185.5kb** —
pulled in by a single `<?!= safeInclude('Konami') ?>` line present in **21 HTML files**.

`Konami.html`'s own header says:

> DEV ONLY — do not migrate to staging or prod

It is in prod.

## Measured effect

| route | baseline | refactor | change |
|---|---|---|---|
| `initial_request` / `equipment_request` / `it_confirmation` | 325.2kb | **139.7kb** | −185.5kb (−57%) |
| `it_setup` | 262.4kb | **77.8kb** | −184.6kb (−70%) |
| `position_site_change` | 310.5kb | **126.4kb** | −184.1kb (−59%) |
| `termination_request` | 279.1kb | **94.5kb** | −184.6kb (−66%) |
| `action_item_view` | 270.4kb | **85.7kb** | −184.7kb (−68%) |

`dashboard` is unchanged at 109.9kb — it never included Konami, which is why it was already the
lightest route.

Server parse path barely moves: 986.9kb → 982.5kb. Only `KonamiStats.js` (4.4kb) is server-side;
HTML partials are not in the server bundle. **This is a client-payload win, not a server one.**

## Gating check — does removing it break theming or accessibility?

This was the condition on archiving. Answer: **no.** Dark, light and accessibility all live in
`Styles.html`, which is untouched.

`Styles.html` (29.8kb, 100% CSS) owns all of it:

| line | what |
|---|---|
| 13 | `:root` — dark is the **default** (`--bg-color: #0c0c0c`, `--text-main: #ffffff`) |
| 720 | light variant (`--bg-color: #f4f4f4`, `--text-main: #1a1a1a`) |
| 753 | high-contrast / AODA (`--bg-color: #ffffff`, `--brand-red: #a50000` — commented *"5.9:1 on white"*) |
| 787 | `body.aoda-mode *:focus-visible` — focus ring |

**`Konami.html` defines zero shared component classes.** Checked all 18 classes an early scan
flagged as shared — `.btn`, `.card`, `.callout`, `.callout-info`, `.callout-warning`,
`.form-section`, `.logo`, `.status-badge`, `.success-icon` are defined in `Styles.html` and matched
`Konami.html=0` every time. The scan's hits were class names appearing inside Konami's JS strings,
not CSS rules.

Konami's 32 `data-theme` occurrences are **all inside `<script>`** (lines 610–788) — JS building the
29 joke theme buttons (TOS, TNG, DS9, Matrix, Mario, F1…). Not CSS selectors.

`EasterEggMaps.html` and `FieldIndex.html` are pure `<script>` — no CSS at all.

The remaining 8 flagged classes (`.header`, `.action-btn`, `.filter-btn`, `.search-box`, `.active`,
`.selected`, `.card-title`, `.filter-group`, `.action-link`) are in **neither** file — each consuming
page defines them in its own `<style>` block. That is a duplication finding of its own, tracked
separately; it is not a Konami dependency.

## Dependency boundary — self-contained

```
Konami.html ──include──> FieldIndex.html
            ──include──> EasterEggMaps.html
            ──google.script.run──> KonamiStats.js : getKonamiStats()
            <──safeInclude── 21 HTML files
safeInclude() in LandingPageHandler.js   — used for nothing else (21/21 calls are 'Konami')
Setup.js : enableEasterEggs() / disableEasterEggs()
EasterEggDocs.html                        — docs only, unreachable from any route
```

Nothing outside this set references any of it.

## What changed in `refactor/`

Removed outright — not commented out:

- `Konami.html`, `EasterEggMaps.html`, `FieldIndex.html`, `EasterEggDocs.html`, `KonamiStats.js`
- 21 × `<?!= safeInclude('Konami') ?>` lines
- `safeInclude()` from `LandingPageHandler.js`
- `enableEasterEggs()` / `disableEasterEggs()` from `Setup.js`

**289,228 bytes (282.4kb) of source removed. Residual reference scan for
`Konami|EasterEgg|FieldIndex|safeInclude|EASTER_EGGS`: zero hits.**

All five files preserved verbatim in `review/archive/easter-eggs/`, together with
`LandingPageHandler.js.orig` and `Setup.js.orig`. Nothing is lost — this stays a live side quest,
restorable by copying the files back and re-adding the 21 include lines.

## Caveat — is this live today?

`safeInclude()` is gated:

```js
if (PropertiesService.getScriptProperties().getProperty('EASTER_EGGS_ENABLED') !== 'true') return '';
```

If that Script Property is not `'true'` on prod, the 185.5kb **is not currently shipping** and this
finding is latent rather than live. The gate itself still costs one `PropertiesService` round trip
per page render either way. Not verified from here — no read-only function exposes Script
Properties, and the two that do (`ProdSmokeTest.js`, `Setup.js`) are behind `_assertTestAdmin_`.

Either way the archive is correct for `refactor/`: dead weight when off, 57% of the payload when on.

## Also worth noting

`safeInclude()` uses `createTemplateFromFile(f).evaluate()` — full template evaluation — where
`include()` uses the cheaper `createHtmlOutputFromFile(f).getContent()`. Any future optional
include should use the latter unless it genuinely needs scriptlet evaluation.
