# Agent note — 2026-11-04 — EFX contract enums

For the agent working on the n8n side. Short version of what bit the Hourly Onboarding run.

## What failed

`EFX E_VALIDATION: siteDocsJobCode must be one of Hourly 1|Hourly 2|...`

That list was **not** a portal lookup. It was a hardcoded enum in the EFX contract layer
(`FormContracts.js`), which validates every `n8n_*` call. The portal's `Data_Lookup` sheet does not
feed it, so sheet access makes no difference to it.

## Fixed

`siteDocsJobCode` has **no enum** as of 2026-11-04. Send SiteDocs title codes directly:

`Corp-Exec` · `Corp-Mgmt` · `EHS` · `C-Support` · `Site-Sup – Union` · `Site-Sup` ·
`Site-ADM-U` · `Site-ADM` · `HRLY-U` · `HRLY`

Note `Site-Sup – Union` uses an **en dash** (U+2013), not a hyphen.

Still in `required`, so empty/null is rejected. That is deliberate — it catches an unmatched title
rather than writing a blank.

## Union status is available

`n8n_getWorkflow` returns it in the request data as **`Union`** — `Yes` or `No`. Capital U, inside
the request-data map, not `union`.

Defaults differ: Forms writes `No` when blank; the n8n mapping node defaults *absent* to union.
Rows created before the field existed read as `No`.

Language is `DSS Language` (`English` / `Spanish`) in the same map. It is for DSS learning paths,
not for job codes.

## Two kinds of enum in FormContracts

- **Literal arrays** — enforced. A wrong value is rejected with `E_VALIDATION`.
- **`'reference.sites'` / `'reference.jrs'` / `'reference.jobNumbers'`** — strings, not arrays.
  `validate()` checks `Array.isArray(e)` first, so these are **not enforced at all**. Sheet-backed
  fields pass whatever you send.

## Enforced enums that can still bite

| Form | Field | Allowed |
|---|---|---|
| `new_hire` | `employmentType` | `Hourly` `Salary` |
| | `newHireOrRehire` | `New Hire` `Rehire` |
| | `employeeType` | `Direct Hire` `Agency` |
| | `systemAccess` | `Yes` `No` |
| | `computerRequestType` / `phoneRequestType` | `New` `Reassignment` `` |
| | `computerType` | `Chromebook` `Windows` `Mac` `` |
| | `dssLanguage` | `English` `Spanish` `` |
| | `union` | `Yes` `No` `` |
| `termination` | `empType` | `Hourly` `Salary` |
| | `reason` | `Deceased` `End of contract` `Resigned` `Retired` `Terminated` |
| | `google_duration` | `Default 1 Month then delete` `Longer (Specify in notes)` `Delete Immediately (No forwarding/access)` |
| `change` | `currentClass` / `classOld` / `classNew` | `Hourly` `Salary` (`''` on the Old/New pair) |
| | `unionOld` | `Yes` `No` `Unknown` `` |
| | `unionNew` | `Yes` `No` `` |
| `it_setup` | `Email_Domain` | `@team-group.com` `@robinsonsolutions.com` `@industrialappliedtech.com` `@stgroup.ca` `@ajvac.ca` `` |
| approvals | `decision` | `Approved` `Rejected` |
| `specialist` | `department` | `creditcard` `businesscards` `fleetio` `jonas` `sitedocs` `review` `safety` `safetyterm` `wis` |

`id_setup` → `siteDocsJobCode` is no longer on this list.

## Before wiring a new field

Call `n8n_contracts()` and read the enum for it rather than assuming. If an enum belongs to a
system you own rather than to Forms, say so and we will remove it or point it at a list you can
maintain, instead of you mapping onto our values.

The contract hash returned by `n8n_contracts()` changes whenever a contract changes — including
this one. A changed hash is not a fault.
