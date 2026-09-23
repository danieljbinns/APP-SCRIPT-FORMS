# CLAUDE.md — employee_forms_efx

## How to answer Binns (applies to EVERY reply, not just summaries)

**Bullets. Short. No walls of text.** This has been asked for repeatedly and drifted every time.

- **Default shape:** 3–6 bullets under at most 2–3 short headings. One idea per bullet, one line each where possible.
- **Hard ceiling:** ~15 lines of prose per reply. Over that, you are doing it wrong — cut, don't reorganise.
- **Lead with the answer.** The conclusion is the first bullet. Evidence only if it changes the decision.
- **No tables** unless comparing 3+ things on 2+ axes. No nested bullets beyond one level.
- **Don't re-explain** what was covered earlier in the session. Assume he remembers.
- **Detail is opt-in.** End with one line offering it ("say the word and I'll go deeper") rather than pre-empting it.
- **A question gets an answer, not a briefing.** "Is X a risk?" → yes/no + why, in two bullets.
- **Long-form belongs in a file**, not the chat — write `docs/runs/…`, then link it in one bullet.
- **One task at a time.** State the plan, wait for approval, run that one thing. Do not chain steps that look obviously next.
- **Manual steps:** what, why it can't be automated, how — one item at a time, with a clickable link.
- **Never imply something passed that you did not see.** Say "not verified" plainly.

**Read `AGENTS.md` first.** It has the safety rules, the contract-maintenance rule, the tests and the naming
conventions. This file is only a pointer.

- **What this is:** the EFX fork of Employee Forms — the Apps Script ↔ n8n integration layer (`N8n.js`,
  `FormContracts.js`, `EfxApi.js`, `Actor.js`, `EmployeeIdRegistry.js`, `RawLog.js` v2) on top of a copy of the
  Forms app in `employee_management_v2_efx/`.
- **Status:** `TEST deployment pending; prod untouched.` (`.clasp.json` scriptId is `REPLACE_ME…`; create a NEW
  script — never point at prod `1AuIbJl1jR…` or dev `1VI9tR0GCx…`.)
- **Prod repo (read-only, never touch):** `P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_deployment`
- **Spec of record:** `P:\Projects\Company\N8N\_agent-bundle\agent-2-full-bundle\agent-2-full-bundle\spec\` —
  start with `00_README.md`, then `12_ROUTER_AS_N8N_NODE.md` (current direction; supersedes the hosted-router
  parts of `03`/`11`). `04_API_SPEC.md` for error codes, `05_…` for the Employee-ID timing change,
  `08_…` for George's automation candidates.
- **Human docs:** `docs/wiki/README.md` (map + glossary) → `HOW_IT_WORKS.md`, `FOR_GEORGE.md`,
  `FOR_DEVELOPERS.md`, `FAQ.md`, `RUNBOOKS.md`.
- **Skill:** `agent/efx-projects/SKILL.md` — how to answer "what can n8n call on project X / what fields does
  form Y need / draft the wrapper" from `n8n_contracts()`.
- **Tests (from `employee_management_v2_efx/`):** `node __tests__/super-test.js`, `node __tests__/efx-test.js`,
  `node __tests__/form-field-map-test.js`.
- **Per-project rules:** `employee_management_v2_efx/AGENTS.md`.
- Other agents are concurrently writing `docs/mapping/`, `docs/plans/`, `n8n/`, `migration/` — link by path,
  do not overwrite.
