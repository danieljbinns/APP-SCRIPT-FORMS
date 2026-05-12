# Employee Forms Deployment — Project Summary

> A comprehensive record of the TEAM Group Employee Onboarding & HR Workflow System:
> what was built, how long it took, and the scale of the effort involved.

---

## TL;DR

From a blank repository to a production multi-step workflow engine spanning **3 Google Apps Script
environments**, **331 tracked changes**, **273,598 lines added**, and an estimated
**~174 hours of active human time** across **48 active days** over 5 calendar months — December 2025 through April 2026.

---

## What Was Built

A fully custom HR workflow orchestration system built entirely on **Google Apps Script + Google Sheets**.
The prior process was a series of Excel or Word forms emailed between departments — no tracking, no enforcement,
no audit trail, and no visibility on who had acted or when. Items regularly fell through the gaps. This system
replaces that with a **gated, multi-step request pipeline** where every step is locked until the prior one
completes, every specialist is routed automatically, and every action is timestamped and audited.

### Workflow Types Supported

- **New Hire**
- **Termination / End of Employment (TERM + EOE)**
- **Equipment Request**
- **Status / Position Change**

### Key Capabilities

- **Sequential gating** — each step unlocks only after the prior step completes; no step can be skipped
- **Role-based dashboard** — different views for HR, IT, Safety, and Managers via Google Group membership
- **Specialist action items** — Credit Card, Business Cards, Fleetio, Jonas, SiteDocs, DSS, BOSS, ADP,
  30-60-90 Review — each routed to the correct team automatically
- **Unified Action Items system** — replaced 6 legacy specialist result sheets with a single normalized
  `Action Items` tab (task ID, category, form type, form data JSON, status lifecycle)
- **Form edit mode** — HR Verification and IT Confirmation forms can re-open and modify previously
  submitted data, with a full change-audit email dispatched to requester, manager, safety, and ID setup
- **Email engine** — templated dark-mode HTML emails with contextual subject lines, CC routing, change
  diff tables, and per-step conditional logic
- **Process map tab** — visual flowchart of the current workflow rendered live in the dashboard
- **Dual-list picker** — replaced large checkbox grids for systems/equipment selection with a
  drag-and-drop-style dual-panel UX
- **Migration tooling** — local Node.js script (`tools/migrate-prod-sheet/`) and PowerShell scripts
  (`tools/migrate-from-excel/`) for safe prod sheet migration without touching live GAS code
- **Environment-aware config** — Script Properties drive all environment differences; same codebase
  deploys to prod, staging, and dev with no hardcoded IDs

---

## Repository at a Glance

```
employee_forms_deployment/
  employee_management_v2/           ← Production (live)
  employee_management_v2_staging/   ← Staging (QA / demo)
  employee_management_v2_dev/       ← Dev (next release)
  tools/
    migrate-prod-sheet/             ← Node.js Google Sheets API migration script
    migrate-from-excel/             ← PowerShell Excel data migration
  docs/                             ← Architecture docs, checklists, test plans
```

---

## By the Numbers

### Change History

| Metric | Value |
|---|---|
| **Total tracked changes (git commits + clasp saves)** | 331 |
| **Active days (code changes + QA submissions)** | 48 |
| **First active day** | 2025-12-04 |
| **Last active day** | 2026-04-29 |
| **Active development span** | ~147 days (≈ 5 months) |
| **Total lines added** | 273,598 |
| **Total lines deleted** | 25,173 |
| **Net lines written** | ~248,425 |
| **Unique file paths touched** | 1,426 (includes renames, moves, deletions) |

### Commits by Month

| Month | Commits | Phase |
|---|---|---|
| Dec 2025 | 20 | Foundations, architecture, initial 3-form system |
| Jan 2026 | 26 | V2 architecture consolidation, full system initialization, prod deployment |
| Feb 2026 | 17 | Environment-aware config refactor, staging + dev environments stood up |
| Mar 2026 | 91 | Equipment requests, dashboard optimization, staging feature build |
| **Apr 2026** | **177** | **Action Items refactor + all new workflow types** |
| **Total** | **331** | **48 active dev days · Dec 2025–Apr 2026** |

### April 2026 Commit Velocity

| Date | Commits | Notable Work |
|---|---|---|
| Apr 14 | 2 | Phase 8 QA — regressions R1–R5, form improvements |
| Apr 16 | 26 | Central Purchasing, buildEmailSubject, Groups A–F |
| Apr 17 | 27 | Staging hotfixes — empType, dates, HR verification |
| Apr 20 | 12 | Action Items refactor phases 1–6, safety form, prod fixes |
| Apr 21 | 32 | Status change full build, EOE workflow, form edit mode, ChangeNotify |
| Apr 22 | 16 | Equipment form overhaul, Jonas/Central Purchasing data source fix |
| Apr 23 | 12 | Dual-list picker, BOSS gatekeeper, QA pass across all forms |
| Apr 27 | 20 | Major dev sprint [dev] |
| Apr 28 | 22 | EQUIP_REQ dashboard, email routing, RequestHeader, email bug fixes |
| Apr 29 | 3 | Final dev push [dev] |

> 32 commits in a single day (Apr 21) represents the peak intensity of the project — Status Change
> pipeline, EOE workflow, form edit mode, and ChangeNotify infrastructure all landing in one session.

---

## Codebase Size by Environment

### Production — `employee_management_v2`

| Metric | Value |
|---|---|
| HTML form/page files | 16 |
| JavaScript files | 0 (HTML-embedded) |
| Total lines of code | ~7,393 |
| Deployment state | **Live on prod** |

Production was the first target: the initial system shipped here in December 2025 and received a major
dashboard/UI port from staging in March 2026.

---

### Staging — `employee_management_v2_staging`

| Metric | Value |
|---|---|
| JavaScript files | 21 |
| HTML form/page files | 29 |
| Service manifests | 4 |
| **Total files** | **54** |
| Total lines of code | ~18,639 |
| Deployment state | Fully deployed, used for QA |

Staging became the primary development and testing surface from January through April 2026 — all major
features landed here first before promotion to prod or dev.

---

### Dev — `employee_management_v2_dev`

| Metric | Value |
|---|---|
| JavaScript files | 23 |
| HTML form/page files | 31 |
| Service manifests | 4 |
| **Total files** | **58** |
| Total lines of code | ~19,355 |
| Deployment state | Active development, demo-ready |

Dev is the most complete environment: it contains the full Action Items refactor, all 4 workflow types,
the unified specialist routing engine, change-notification infrastructure, and the next-gen dashboard.

---

### Combined Across All Environments

| Metric | Value |
|---|---|
| Total GAS source files | **232** (.js + .html) |
| Largest single file | `Dashboard.html` (~2,400 lines) |
| Smallest meaningful unit | `ChangeNotify.js` (179 lines, pure utility) |
| Tooling scripts | 3 Node.js + 3 PowerShell |

---

## Architecture Highlights

### The Action Items Refactor
The single largest architectural decision of the project. Six independent specialist result sheets
(Credit Card Results, Business Cards Results, Fleetio Results, JONAS Results, SiteDocs Results,
30-60-90 Review Results) were retired and replaced with a single normalized **Action Items** sheet.

Benefits:
- Every task across every workflow type is now one row in one sheet
- Task lifecycle (Pending → In Progress → Closed) tracked uniformly
- Form data stored as JSON blob — survives schema changes without a migration
- Specialist forms load their prefill from the same source
- Dashboard can aggregate "open tasks" in a single query

Migration was handled by `tools/migrate-prod-sheet/index.js` — a local Node.js script using the
Google Sheets API via service account, with `--dry-run` / `--execute` modes. Zero changes to live
GAS code during the transition.

### Email Engine (`EmailUtils.js` + `ChangeNotify.js`)
~1,200 lines of email infrastructure covering:
- Dark-mode HTML template with inline styles
- Per-workflow subject line builder with 250-char hard cap
  (a bug where Status Change subjects hit ~300 chars caused `Exception: Argument too large: subject` —
  fixed by removing `changeTypes` from the tag, stripping manager emails from the subject, and adding
  a 60-char site truncation guard)
- Change-audit diff tables (field → was → now) dispatched on any HR Verification or IT Confirmation edit
- Conditional CC routing: Safety team notified on SiteDocs/DSS-impacted changes; ID Setup notified on
  credential/name changes

### Sequential Gating Engine
Each workflow type defines its step sequence as a config object. The engine:
1. Evaluates current workflow state from the Workflows sheet
2. Identifies the next pending step
3. Generates (or re-uses) a gated form URL with a pre-signed token
4. Refuses to advance if prior steps are incomplete
5. On completion, triggers the next step's email + task creation

This same engine powers all 4 workflow types with zero duplication of gating logic.

---

## Human Hours — Merged Git + Clasp Timeline

Because this project used AI-assisted development, the relevant number is **human direction time** —
not total lines written. Timestamps from all 331 commits are used as a unified evidence stream.
Each day's active window = earliest to latest commit, whichever comes first/last. Hours include a
modest overhead for context, review, and testing beyond the raw window. Every day was shared with
meetings and other work — no day is treated as an uninterrupted full day.

Each day's base is the first-to-last commit window. Overhead added for prompting, review, and
testing beyond the raw window — more weight where commit density is high. Every day was shared
with meetings and other work; no day is treated as a full uninterrupted session.

### December 2025 — 4 days · ~15 h

| Date | Window (EST) | Est. h | Notes |
|---|---|---|---|
| Dec 04 | 17:59 | ~3 h | 1 commit · Initial commit — complete prototype |
| Dec 08 | 15:17–16:42 | ~3 h | 7 commits · Consolidation, docs, session guides |
| Dec 09 | 16:43–16:50 | ~3 h | 4 commits · MAJOR REORGANIZATION (dense burst behind 7-min window) |
| Dec 17 | 16:48–21:42 | ~6 h | 8 commits · Deploy all 9 forms, clasp pipeline, Styles library |

### January 2026 — 6 days · ~28 h

| Date | Window (EST) | Est. h | Notes |
|---|---|---|---|
| Jan 15 | 10:03–13:27 | ~5.5 h | 4 commits · Phase 8 & 9 — Premium UI refactor, data visibility |
| Jan 16 | 18:19 | ~3 h | 1 commit · V2 architecture consolidation |
| Jan 22 | 20:33 | ~6 h | 2 commits · **Initialize V2** — full module structure, offboarding, dashboards (same-timestamp pair = long single session) |
| Jan 23 | 13:43–17:15 | ~5.5 h | 13 commits · First prod deployment & new hire testing [prod] |
| Jan 27 | 10:30–15:55 | ~7 h | 5 commits · Safety Notification & Config Cleanup · Safety/HR Email Fixes [prod] |
| Jan 28 | 10:22 | ~1.5 h | 1 commit · Fix Dashboard Syntax Error [prod] |

### February 2026 — 2 days · ~10 h

| Date | Window (EST) | Est. h | Notes |
|---|---|---|---|
| Feb 20 | 16:01–17:18 | ~2.5 h | 2 commits · Environment-aware config via Script Properties |
| Feb 24 | 10:37–15:51 | ~7 h | 15 commits · Staging + dev environments stood up from scratch [staging+dev] |

### March 2026 — 11 days · ~46 h

| Date | Window (EST) | Est. h | Notes |
|---|---|---|---|
| Mar 04 | 15:17–15:50 | ~3 h | 7 commits · Port staging to prod, "DASHBOARD ACCESS" |
| Mar 05 | 09:58–10:02 | ~1.5 h | 3 commits · OAuth scope fix |
| Mar 06 | 12:34–17:10 | ~7 h | **27 commits** · Major staging feature build — specialist forms, dashboard [staging] |
| Mar 09 | 11:52–15:50 | ~5.5 h | 10 commits · Staging continued — workflow routing, specialist forms [staging] |
| Mar 17 | 14:10 | ~1 h | 1 commit · Staging checkpoint save |
| Mar 19 | 15:44–16:44 | ~2.5 h | 2 commits · JSON checklist fix — "Working state" checkpoint [staging] |
| Mar 20 | 09:29–14:08 | ~7 h | 19 commits · CSS scaling, empID removal, staging push marathon [staging] |
| Mar 23 | 14:41–17:19 | ~4 h | 5 commits · Action item emails, button groups, dashboard UX [staging] |
| Mar 24 | 14:23 | ~1 h | 1 commit · Minor staging fix |
| Mar 25 | 09:26–16:25 | ~9 h | **17 commits** · Equipment requests, dashboard optimization [staging+prod] |
| Mar 30 | 09:39–13:27 | ~4.5 h | 4 commits · Prod + staging maintenance |

### April 2026 — The Sprint — 10 days · ~75 h

| Date | Window (EST) | Est. h | Notes |
|---|---|---|---|
| Apr 14 | 16:55–17:44 | ~4 h | 2 commits · Phase 8 QA — regressions R1–R5, form improvements |
| Apr 16 | 12:48–17:28 | ~8 h | **26 commits** · Central Purchasing, buildEmailSubject, Groups A–F |
| Apr 17 | 12:12–15:57 | ~8 h | 27 commits · Hotfixes — empType, dates, HR verification [staging] |
| Apr 20 | 10:05–17:31 | ~9.5 h | 12 commits · **Action Items refactor phases 1–6** |
| Apr 21 | 09:45–18:03 | ~9.5 h | **32 commits** · **peak day** — Status Change, EOE, form edit, ChangeNotify |
| Apr 22 | 09:04–15:23 | ~8 h | 16 commits · Equipment form, Jonas/Central Purchasing |
| Apr 23 | 09:43–17:02 | ~9 h | 12 commits · Dual-list picker, BOSS gatekeeper, full QA pass |
| Apr 27 | 09:06–16:35 | ~9 h | **20 commits** · Major dev sprint [dev] |
| Apr 28 | 12:12–18:10 | ~8 h | 22 commits · Email subject overflow fix, EQUIP_REQ dashboard |
| Apr 29 | 18:25–19:42 | ~2 h | 3 commits · Final dev push |

### Summary by Month

| Month | Tracked Changes | Total Hours | Dev Hours | QA Hours |
|---|---|---|---|---|
| Dec 2025 | 20 | ~15 h | ~15 h | — |
| Jan 2026 | 26 | ~28 h | ~24 h | ~4 h |
| Feb 2026 | 17 | ~10 h | ~7 h | ~3 h |
| Mar 2026 | 91 | ~46 h | ~38 h | ~8 h |
| **Apr 2026** | **177** | **~75 h** | **~49 h** | **~26 h** |
| **Total — 48 active dev days** | **331** | **~174 h** | **~133 h dev** | **~41 h QA** |

> Dev hours = architecture, coding, review, and direction. QA hours = deliberate testing sessions
> with form submissions, workflow walkthroughs, and email/edge-case verification.
> Every QA session was developer-run, not automated.

### Cost Avoidance

This was a **solo, part-time effort** — there was no full-time development team available, and
outsourcing was the realistic alternative. A senior contractor building an equivalent system would
charge an estimated **$65,000–$115,000** as a one-time build cost ($125–$175/hr over 500–650 hours),
before any ongoing maintenance. That's the direct cost avoided.

The broader cost avoidance picture: workflow automation platforms with comparable multi-step gating
and approval routing — Kissflow, Process Street, Nintex — run **$10–$25/user/month**, or roughly
**$180,000–$450,000/year** at TEAM Group's scale. Basic HR tools like BambooHR or Rippling are
cheaper at **$6–$9/user/month** (~$108K–$162K/yr) but cover data collection and record-keeping only —
no step enforcement, no specialist routing, no audit trail. This system runs on **Google Workspace
TEAM Group already pays for** — zero incremental licensing cost.

The more important win is operational: tracked, enforced, accountable workflows replacing
emailed spreadsheets with no follow-through mechanism.

---

## QAT & Testing Evidence

All QA was conducted by the developer personally — every form submission, every multi-step workflow
walkthrough, and every email routing and edge-case verification was deliberate solo testing.
Testing ran across three phases as the environment topology evolved:

**Phase 1 — Prod-only (Jan 23 – Feb 24, 2026):** No staging yet. Developer tested directly on prod.
The ~72 NEW_EMP workflows accumulated in the prod spreadsheet during this window.

**Phase 2 — Staging as primary (Feb 24 – Apr 20, 2026):** Staging created as an afterthought once
direct prod testing became unwieldy. Prod was cleaned of test data at the cutover — those ~72 NEW_EMP
entries were moved to staging. From this point prod received real HR submissions only. Staging became
the active development and QA surface, accumulating 30 TERM/EOE + 3 CHANGE submissions on top of the
carried-over NEW_EMP data.

**Phase 3 — Dev for refactor (Apr 21 – Apr 29, 2026):** Dev project (created Feb 24, kept dormant
while staging was the active branch) activated for the Action Items refactor. Dev spreadsheet was seeded
with ~244 NEW_EMP entries imported from prod to provide realistic reference data. Those imported entries
are **not** QA submissions — all dev testing was the developer running the new schema against all 5
workflow types during the Apr 21–29 sprint.

> **Note on the `script.processes` scope:** The original clasp OAuth grant didn't include
> `script.processes`, so raw GCP execution logs aren't accessible from the local toolchain. Sheet rows
> are the durable, observable evidence of every successful end-to-end execution.

### Developer QA Sessions (clasp save cadence as session markers)

| Session | Date | Clasp Saves | Est. Duration | Focus |
|---|---|---|---|---|
| New Hire prod rollout | Jan 23, 2026 | 13 prod | ~3.5 h | First prod deployment; full NEW_EMP workflow end-to-end — produced the ~72 NEW_EMP test records (13:43–17:15 UTC) |
| Staging standup + cutover | Feb 24, 2026 | 10 staging | ~3 h | Staging & dev environments created; prod test data moved to staging; prod cleaned for real use |
| **Termination / EOE sprint** | **Mar 6–9, 2026** | **27+10 staging** | **~7.5 h** | Full TERM + EOE workflow (same workflow type) — gating, Action Items generation, approval routing, specialist routing, email edge cases across two sessions |
| **Action Items refactor QA** | **Apr 21, 2026** | **15 dev** | **~6.7 h** | Unified Action Items schema — all 4 workflow types on new model (14:45–21:29 UTC) |
| Final validation I | Apr 27, 2026 | 20 dev | ~7.5 h | Cross-environment check; email edge cases; status change pipeline (14:06–21:35 UTC) |
| Final validation II | Apr 28, 2026 | 18 dev | ~4.8 h | IT confirmation gate; Equipment Request type; pre-launch final checks (17:12–22:02 UTC) |

### Staging Test Record (all entries are developer QA submissions)

| Sheet | Records | Notes |
|---|---|---|
| Workflows | 105 | 72 new hire (migrated from prod-only phase) · 30 termination/EOE · 3 position change |
| Initial Requests | 70 | New hire form submissions |
| ID Setup Results | 63 | Completed ID provisioning gates |
| HR Verification Results | 47 | HR sign-off submissions (incl. re-submits) |
| IT Results | 8 | IT confirmation completions |
| Action Items | 117 | Generated from TERM/EOE/CHANGE workflows |
| **Total confirmed sheet writes** | **~305** | Each = one successful end-to-end script execution |

Active range: Jan 20 – Apr 20, 2026 (Jan–Feb entries are from the prod-only testing phase, migrated at staging cutover)

### QA Summary

- **6 major developer testing sessions** totaling ~41 hours of active QA time
- **105 staging test workflows** across all 4 workflow types (72 NEW_EMP from prod-only phase + 33 TERM/EOE/CHANGE from staging phase)
- **~305 confirmed staging sheet write events** (form-triggered executions with durable output)
- Every gating step, every email path, and every edge case exercised by the developer directly

---

## Development Timeline

```
Dec 04, 2025  ● Initial commit — REQUEST_FORMS demo system
Dec 08, 2025  ● Repository consolidation, session guides, demo features
Dec 09, 2025  ● MAJOR REORGANIZATION — clean modular structure
Dec 17, 2025  ● Deploy all 9 forms to shared drive, spreadsheet automation
              │
Jan 15, 2026  ● Phase 8 & 9 — Premium UI refactor, data visibility
Jan 16, 2026  ● Consolidate to V2 architecture, archive legacy projects
Jan 22, 2026  ● Initialize comprehensive employee management system (V2)
Jan 23, 2026  ● First prod deployment & new hire testing — 13 iterative pushes [prod]
Jan 27, 2026  ● Safety Notification & Config Cleanup · Safety/HR Email Fixes [prod]
Jan 28, 2026  ● Fix Dashboard Syntax Error [prod]
              │
Feb 20, 2026  ● Environment-aware configuration via Script Properties
Feb 24, 2026  ● Staging + dev environments stood up — 15 iterative pushes [staging+dev]
              │
Mar 04, 2026  ● Port staging to prod — dashboard group-access, UI, specialist forms
Mar 06, 2026  ● Major staging feature build — 27 commits, specialist forms, dashboard [staging]
Mar 09, 2026  ● Staging continued — workflow routing, specialist forms [staging]
Mar 19–20     ● JSON checklist fix, CSS scaling, empID removal, staging push marathon
Mar 23–24     ● Action item emails, button groups, dashboard UX, minor fixes [staging]
Mar 25, 2026  ● Equipment requests, dashboard optimization — 17 commits [staging+prod]
Mar 30, 2026  ● Prod + staging maintenance
              │
Apr 14, 2026  ● Phase 8 QA — regressions R1–R5, form improvements
Apr 16, 2026  ● Central Purchasing, buildEmailSubject, Phase 8 Groups A–F (26 commits)
Apr 17, 2026  ● Staging hotfixes — empType column, date formatting, HR verification
Apr 20, 2026  ● ACTION ITEMS REFACTOR — phases 1–6 (architectural milestone)
Apr 21, 2026  ● Status Change pipeline (full — routing, emails, tasks, dashboard)
Apr 21, 2026  ● EOE workflow (equipment consolidation, process map, My Tasks)
Apr 21, 2026  ● Form edit mode for HR Verification + IT Confirmation
Apr 21, 2026  ● Change notification infrastructure (ChangeNotify.js)
Apr 22, 2026  ● Equipment form overhaul, Jonas/Central Purchasing alignment
Apr 23, 2026  ● Dual-list picker replacing checkbox grids
Apr 23, 2026  ● BOSS gatekeeper, WIS task, EOE/specialist QA pass
Apr 27, 2026  ● Major dev sprint — 20 commits [dev]
Apr 28, 2026  ● Fix email subject overflow (Exception: Argument too large)
Apr 28, 2026  ● EQUIP_REQ dashboard, routing, RequestHeader, IT prefill
Apr 28, 2026  ● Demo data migration (225 prod workflows → dev Google Sheet)
Apr 29, 2026  ● Final dev push [dev]
```

---

## What Makes This Unusual for "No-Code" Infrastructure

Google Apps Script is typically used for simple automations — a form submission hook, a spreadsheet
formula helper. This system is something different:

- **A full multi-tenant workflow engine** running inside a Google Sheet
- **A live HTML/CSS/JS application** served as GAS web app with session state, role checks, and
  client-server RPC via `google.script.run`
- **A normalized relational data model** across 10+ sheets with consistent IDs, joins, and state
  machine transitions — all in a spreadsheet
- **A complete CI-adjacent deployment workflow** using `clasp` for push/pull, three separate GCP projects
  for environment isolation, and local migration tooling for safe data model upgrades
- **Zero external services** — no database, no backend server, no CI pipeline. Everything runs inside
  Google Workspace's free execution tier.

---

## Files of Note

| File | Lines | Purpose |
|---|---|---|
| `Dashboard.html` | ~2,400 | Main operator dashboard — role-gated, multi-view, live status |
| `WorkflowEngine.js` | ~600 | Sequential gating, step transitions, state management |
| `EmailUtils.js` | ~750 | Email templating, subject building, change audit emails |
| `ChangeNotify.js` | ~179 | Change detection diff engine + notification dispatch |
| `ActionItemsManager.js` | ~450 | Unified task CRUD, lifecycle, specialist routing |
| `PositionChangeHandler.js` | ~380 | Status/position change workflow orchestration |
| `InitialRequest.html` | ~900 | New hire request form — dual-list pickers, BOSS, Jonas |
| `tools/migrate-prod-sheet/index.js` | ~325 | Node.js Google Sheets API migration (dry-run/execute) |
| `tools/migrate-from-excel/run.ps1` | ~400 | PowerShell Excel migration for demo data |

---

## Appendix: Key Technical Decisions

| Decision | Rationale |
|---|---|
| `.js` over `.gs` everywhere | Cleaner clasp push/pull; editors treat `.js` as JavaScript properly |
| JSON blobs for form data | Schema-flexible; specialist forms can evolve without a sheet migration |
| Script Properties for config | Environment switching without code changes; no hardcoded IDs |
| Local migration tooling | Prod GAS untouched during data model migrations; safe dry-run workflow |
| Inline styles in emails | Google Workspace strips `<style>` tags from some email clients |
| 250-char subject cap | GAS `MailApp.sendEmail` throws `Argument too large` above ~250 chars |
| EPPlus for Excel migration | `Import-Excel` fails on duplicate column headers; EPPlus is positional |

---

*Generated 2026-04-29 from git history, file analysis, and commit narrative reconstruction.*
*All hour estimates are inferred from commit density, changeset size, and known feature scope.*
