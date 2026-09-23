# Review documentation — employee_management_v2, PROD snapshot 2026-09-18

Descriptive documentation of the system as it stands in this snapshot. It records **what the code
does**, never whether that is correct, intended, or a defect — behaviour that reads oddly from
outside is often a deliberate business rule, and intent is not readable from source. Those calls are
the maintainer's, made per flow during review.

## The model

- **Workflow** (`WF_*`) — one end-to-end flow. **The unit of review.** Each is reviewed on its own,
  even where it shares forms with another flow.
- **Form** (`FORM_*`) — a form as a user meets it. A reusable **step component**, which may appear in
  any number of workflows.
- **Step instance** (`SI_<WORKFLOW>_<n>_<SLUG>`) — one form used at one point in one workflow. The
  same form in two workflows is **two step instances**, each with its own entry condition, actor and
  effects, and each reviewed separately. This is what the workflow docs walk through.
- **Field** (`FIELD_<TEMPLATE>_<control>`) — defined once per template, never duplicated per workflow.

So a form page answers "what is on this form, and where is it used as a step"; a workflow page
answers "what happens, in order, in this flow".

## Contents

| File | What it covers |
|---|---|
| [00-ORIENTATION.md](00-ORIENTATION.md) | What the system is, how it's organised, the conventions in use |
| [index.json](index.json) | Machine-readable registry — every stable key used by these docs |
| [OBSERVATIONS-PARKED.md](OBSERVATIONS-PARKED.md) | Behaviour register + per-flow review status. **No verdicts** |
| [workflows/01-new-hire.md](workflows/01-new-hire.md) | New Employee Onboarding, step by step |
| [workflows/02-equipment.md](workflows/02-equipment.md) | System & Equipment Request, step by step |
| [workflows/03-end-of-employment.md](workflows/03-end-of-employment.md) | End of Employment, step by step |
| [workflows/04-position-site-change.md](workflows/04-position-site-change.md) | Position / Site Change, step by step |
| [fields/](fields/) | Per-form field inventories — one page per form |
| [tools/](tools/) | The generators that build the field pages |

## Field inventories

One page per **form as a user meets it**. Six forms come from three templates:

| Page | Template | Mode |
|---|---|---|
| [FORM_NEW_HIRE.md](fields/FORM_NEW_HIRE.md) | `InitialRequest.html` | `new_hire` |
| [FORM_EQUIPMENT.md](fields/FORM_EQUIPMENT.md) | `InitialRequest.html` | `equipment` |
| [FORM_IT_CONFIRMATION.md](fields/FORM_IT_CONFIRMATION.md) | `InitialRequest.html` | `it_confirmation` |
| [FORM_TERMINATION.md](fields/FORM_TERMINATION.md) | `TerminationRequest.html` | — |
| [FORM_POSITION_CHANGE.md](fields/FORM_POSITION_CHANGE.md) | `PositionSiteChangeRequest.html` | — |
| [FORM_IT_CONFIRMATION_CHANGE.md](fields/FORM_IT_CONFIRMATION_CHANGE.md) | `PositionSiteChangeRequest.html` | `it_confirmation` |

Template sharing is deliberate — one definition per field, edited once. Each mode is still its own
form, with its own route, audience and visible/required set, so each gets its own page and each page
states which other modes an edit would also land on.

### How a field page is built

```
InitialRequest.html                     the snapshot (read-only, never touched)
   │  node review/tools/extract-fields.js --all
   ▼
fields/InitialRequest.extracted.json    machine facts — safe to regenerate
   +
fields/InitialRequest.notes.json        hand-written effects — never overwritten
   │  node review/tools/render-fields.js
   ▼
fields/FORM_NEW_HIRE.md  …              the merged page — safe to regenerate
```

Re-run both after a new `clasp pull` and the pages rebuild; a diff then shows real change rather than
reformatting. **Edit the notes, not the `.md`.**

What the extractor resolves that a plain read of the markup does not: mode gating that lives on
wrapper elements rather than on the control, show/hide rules where the handler holds the element in a
variable, controls with no markup at all because the page builds them from reference data, and
whether the page's submit step actually posts a given control.

`snapshotLine` is recorded for convenience but is valid only for this snapshot — `control` is the
durable identifier.

## How the keys work

`index.json` is the single registry. Everything else refers to it by key rather than repeating
details, so a later script can diff one file to detect drift instead of parsing prose.

| Prefix | Group | Example | Holds |
|---|---|---|---|
| `WF_` | workflows | `WF_NEW_HIRE` | ID prefix, entry form, step count, doc path |
| `STEP_` | step labels | `STEP_ID_SETUP` | the exact string written to the Workflows sheet |
| `FORM_` | forms | `FORM_IT_SETUP` | template, handler file, serve/submit functions, target sheet |
| `ROUTE_` | URL routes | `ROUTE_DASHBOARD` | `?form=` value, serve function, access rule |
| `GRP_` / `ACTOR_` | assignees | `GRP_FLEET`, `ACTOR_MANAGER` | address, config key, role tier, what they handle |
| `ROLE_` | permission tiers | `ROLE_SPECIALIST` | what that tier may do |
| `TASK_` | action item categories | `TASK_FINANCE` | category string, group, form types, whether it blocks completion |
| `SHEET_` | spreadsheet tabs | `SHEET_ACTION_ITEMS` | tab name and role |
| `HOOK_` | post-close behaviour | `HOOK_CHANGE_WIS_SEQUENCE` | trigger condition and effect |

Other top-level sections in the registry: `completionRules`, `coreFunctions`, `scriptProperties`,
`automation`, `environments`, `meta`.

## Key names reserved for later passes

`index.json` carries a `plannedIndexes` block so later work slots in without renaming anything:

- `FIELD_<FORM>_<name>` — per-form field inventory, mapping form control → sheet column → schema
  constant. One file per form, same shape as the workflow docs.
- `FN_<name>` — full function index with file, callers and callees.
- `VAR_<name>` — global and config variable index.

## Two pieces of standing context

**n8n / EFX automation is a new addition** being enabled across several flows. It is largely outside
the scope of this review, though review findings may end up informing it. It is recorded in the
registry under `automation` so the workflow docs can reference it, not because it is being reviewed.

**There are several deployments** — dev, staging, various test projects, and prod. Only prod is
user-facing. They share the same code structure; each has its own spreadsheet and its own script
properties. They are lifecycle environments rather than different products, so for documentation
purposes they are treated as one system.

## Ground rules for this folder

This snapshot is read-only. Source files are never edited here; new files are only ever created under
`review/`. See [`../CLAUDE.md`](../CLAUDE.md) for the full contract.
