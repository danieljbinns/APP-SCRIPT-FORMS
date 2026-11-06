# 2026-10-14 — Static audit, pass 1 (review only, nothing changed)

Scope of this pass: **structural checks across all 47 JS files**, plus a client→server call
cross-check against the 38 HTML files. This is not yet a per-file read of all 85 files — see
*Coverage* at the bottom for exactly what is still unexamined.

## Findings

### 1. IT Confirmation submit makes 29 separate sheet round trips  — worst thing found

`ITConfirmationHandler.js:88-121`. After finding the row, it writes each field with its own
`getRange(row, col).setValue(v)` inside a `forEach` over a 29-entry pair list. In Apps Script each
of those is an individual Sheets API call.

- new hire → Initial Requests: **29 writes**
- change → Position Changes (`:131-151`): **11 writes**
- `HRVerificationHandler.js:134-160`: **9 writes**

All three write a contiguous-ish span of one row and could be a single `setValues()` on a range, or
at minimum grouped. At typical Apps Script round-trip cost this is seconds per submit, every submit.

Not measured live — the forms need a real workflow ID, so I could not time them from the browser.
Worth timing before and after rather than assuming the saving.

### 2. Magic column number bypasses the schema  — latent, currently harmless

`ITConfirmationHandler.js:148`:

```js
[22, csvOrStr(formData.purchasingSites)]  // col 22 — extended field, not in base schema
```

The comment is wrong: `SCHEMA.POSITION_CHANGES.PURCHASING_SITES = 22`. Every other entry in that
same list uses the `PCC.*` constant; this one hardcodes the index. It is correct today by
coincidence. If the schema is ever renumbered, the other 10 writes follow the constants and this one
silently writes purchasing sites into whatever now sits at 22. Should be `PCC.PURCHASING_SITES`.

Swept the rest of the codebase for the same pattern — this is the only instance.

### 3. Stale documentation references a function that does not exist

`EasterEggDocs.html` (lines 310, 388, 882, 890, 899, 989) documents `getStarTrekStats()` as the
server call. No such global exists; the real one is `getKonamiStats()`. Documentation only — the
live easter egg code calls the correct name, so nothing is broken at runtime.

### 4. Safety form: malformed JSON silently records "No"

`Specialist.js:94` and `:103` — `try { details = JSON.parse(formData.details || '{}') } catch(e) {}`
with `details` pre-set to `{}`. A malformed payload therefore records `siteDocsConfirmed: 'No'` and
`dssConfirmed: 'No'` rather than surfacing the problem. Low severity (the UI builds that JSON), but
it is a silent wrong-answer path on a safety record rather than a silent no-op.

## Checked and clean

| Check | Result |
|---|---|
| Duplicate global function names (GAS shares one scope — last wins) | **0** across 367 globals |
| Schema index collisions in `SchemaConstants.js` | **0** across 17 blocks |
| `google.script.run` targets that don't exist server-side | **0** real (31 distinct calls; 1 false positive, see #3) |
| `adminDeleteWorkflows` reachable without admin | No — gated by `AccessControlService.isAdmin` |
| Other magic-number column writes | 1 (finding #2) |

### Swallowed errors — flagged 75, real count ≈ 0

My first detector flagged 75 `catch` blocks as swallowing errors. On inspection that was a bad
detector, not 75 bugs: nearly all assign a documented fallback, push to a failures array, or are
explicitly marked non-fatal (cache misses, best-effort alias lookups, lock release in `finally`).
Only #4 above is worth anything. Reporting this so the number isn't mistaken for a backlog.

## Coverage — what this pass did NOT look at

1. **Per-file read of the 38 HTML files.** Only the `google.script.run` cross-check touched them.
   No review of inline handlers, validation logic, dead markup or duplicated CSS.
2. **Per-file read of ~35 JS files.** The checks above are pattern sweeps over all 47; I have only
   actually read about a dozen.
3. **Eight routes never loaded at all** — `id_setup`, `hr_verification`, `it_setup`, `specialist`,
   `request_details`, `action_item_view`, both approvals, `it_confirmation`. Each needs a real
   workflow ID, so yesterday's fetch sweep skipped them. Findings #1 and #4 both sit on these
   unexercised paths.
4. **No runtime error checking.** Binns notes there are ways to run GAS locally; not set up here.
   The existing Node `vm` harness in `__tests__/` is the obvious starting point — it already loads
   most of the source with stubbed globals.

Nothing in this document has been changed in code.
