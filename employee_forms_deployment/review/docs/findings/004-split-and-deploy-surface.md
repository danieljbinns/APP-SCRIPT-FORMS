# 004 — Split, and what belongs in the deployed project

**Supersedes [002](002-forms-dashboard-split.md), which was wrong.** 002 concluded "84.3% shared,
don't split". That number came from a graph that counted a global as *called* if its name appeared
anywhere in another function's body — comments and string literals included. Rebuilt with real call
sites (comments and strings stripped first, `name(` / `Ns.method(` only), seeded from verified
function declarations and the actual `google.script.run` targets in the HTML.

---

## 1. What each entry point actually reaches

Every request parses **986.9kb** regardless of route. What the route *uses*:

| entry point | globals | files | bytes reached |
|---|---|---|---|
| VIEW `dashboard` | 4 | 4 | **22.0kb** |
| VIEW `initial_request` | 5 | 5 | 63.8kb |
| VIEW `request_details` | 4 | 4 | 66.8kb |
| VIEW `it_setup` | 6 | 5 | 89.3kb |
| VIEW `hr_verification` | 9 | 8 | 208.8kb |
| DATA `dashboard` | 34 | 12 | 192.0kb |
| SUBMIT `hr_verification` | 51 | 18 | 408.2kb |
| `doGet` (whole router) | 69 | 28 | 571.9kb |

**Your point is correct: opening the HR form parses 986.9kb to reach 208.8kb.** Opening the
dashboard parses 986.9kb to reach 22.0kb.

---

## 2. Attribution across three consumers — not two

n8n is a third consumer with its own entry points (`doPost` in `Router.js`, plus 20 `n8n_*`
aliases). Leaving it out distorts everything, which is part of why 002 was wrong.

| bucket | size | files |
|---|---|---|
| **true core** (all three) | **322.4kb** | 15 |
| forms only | 150.9kb | 11 |
| dashboard + n8n | 138.1kb | 7 |
| forms + n8n | 69.1kb | 3 |
| dashboard only | 50.1kb | 3 |
| **reached by nothing** | **256.3kb** | 8 |

The true core is `PositionChangeHandler` (62.2), `EmailUtils` (62.0), `EmailTemplates` (56.9),
`SchemaConstants` (27.5), `TerminationHandler` (26.3), `AccessControlService` (22.2), `StateSync`
(19.0), `WorkflowManager` (13.3), `Router` (9.2), `Config` (6.0), plus five smaller.

n8n calls into the same submit handlers the forms use, which is why the core is genuinely shared
rather than an artifact.

---

## 3. Two moves, in order

### Move 1 — stop deploying what nothing reaches. Free, no architecture change.

**256.3kb, 8 files, 26% of every request's parse cost**, reachable from no route, no
`google.script.run` target, and no n8n alias:

| file | size |
|---|---|
| `SuperDebug.js` | 106.2kb |
| `MigrationTools.js` | 44.3kb |
| `TestRunner.js` | 39.9kb |
| `ProdSmokeTest.js` | 26.2kb |
| `Setup.js` | 22.8kb |
| `ReplayService.js` | 12.7kb |
| `KonamiStats.js` | 4.1kb |
| `DashboardHandler.js` | 0.2kb (tombstone) |

986.9kb → **730.6kb**. This is your "don't deploy one-time scripts" point and it is unambiguously
right.

**How:** a second Apps Script project — *Employee Forms — Admin* — same GCP project, same
spreadsheet via `SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)`, same OAuth scopes. Source lives in
the repo under its own folder with its own `.clasp.json`. Nothing pushes it to prod, ever.

**The catch, and it is real:** `SuperDebug.js`, `TestRunner.js` and `ProdSmokeTest.js` exist to test
the handlers, and Apps Script's one-global-scope model is exactly what lets them reach in. Move them
to another project and they lose the functions under test. Options:

- **(a) Lean on the Node suites.** Seven already exist (159/218/315/27/24/22/600 assertions) and run
  against the real source in a `vm` with mocked GAS globals. Much of the GAS-side harness duplicates
  them. **Recommended** — it is also the only option that doesn't require a prod deploy to test.
- (b) Admin project calls prod through the Execution API. Works (the token is live again), but is a
  network hop per call and re-couples the two projects.
- (c) Push the harness to prod only when running it, then remove. Honest to your "deploy when needed
  and delete" instinct, but it means a prod deploy to run a test — the thing you want to minimise.

A per-file decision is needed here, not a bulk move. `Setup.js`, `MigrationTools.js` and
`ReplayService.js` are clean cuts. The three test files need (a) to be proven first.

### Move 2 — split the web apps. Real, but smaller than it looks after Move 1.

| | today | after Move 1 | after split |
|---|---|---|---|
| Forms project | 986.9kb | 730.6kb | **542.4kb** |
| Dashboard project | 986.9kb | 730.6kb | **510.6kb** |
| n8n project | 986.9kb | 730.6kb | **529.6kb** |

The split buys a further ~190kb per side (−26% on top of Move 1), and costs **322.4kb of core
triplicated** across three projects — three copies of `EmailUtils`, `EmailTemplates`,
`SchemaConstants`, `Config`, every schema change applied three times or coordinated through a
Library version bump.

That trade is defensible but it is not free, and it directly fights finding
[003](003-define-once-architecture.md): triplicating the core is the opposite of define-once. An
Apps Script Library keeps one copy but adds per-call latency and pins every deploy to a version.

**A two-way split is the better shape than three**: Forms+n8n in one project (they share the submit
handlers — 69.1kb of overlap, and n8n exists to drive form submission), Dashboard in the other.
Dashboard-only is just 50.1kb, so the dashboard project is almost entirely core — which argues the
dashboard is the piece that could instead become a thin read-only consumer over time.

---

## 4. The thing I have not measured, and it decides Move 2

**I do not know how much of the ~2.0s page floor is parse time.** The entire case for splitting
rests on "parsing 987kb costs real milliseconds", and that is an assumption, not a measurement.
V8 parses ~1MB of JS in the low tens of milliseconds on warm hardware; Apps Script's floor may be
dominated by container start, auth and the sandbox iframe instead — in which case Move 2 buys
almost nothing user-visible and should not be done at all.

Move 1 does not depend on this. Delete-what-nothing-reaches is right on maintainability grounds
alone, and it reduces the prod attack surface.

**How to settle it without guessing:** push the `refactor/` tree (Move 1 applied) to a *separate
throwaway script project*, deploy it, and time `doGet` against the current project on the same
route. One number ends the argument. It needs a deploy, but to a scratch project, not prod.

---

## 5. On forms calling a backend over the API

You asked whether forms could use an API rather than shipping every function. Mechanically:
`google.script.run` only reaches the project serving the page, so the only cross-project route is
`UrlFetchApp` → another web app's `doPost`. **You already run exactly that pattern** — the `@76`
anonymous `doPost` deployment for n8n.

- **For submit: plausible.** One extra network hop (~300–800ms) on an action the user already waits
  on, and it would let the forms project drop the whole submit closure (`SUBMIT hr_verification`
  reaches 408.2kb vs 208.8kb for the view).
- **For page view: no.** The `serve*` function has to live in the project serving the page.
- **Cost:** a shared secret or OAuth per call, an error path that now includes the network, and
  submits that can fail in a new way. Given no measurement that parse time matters, this is not
  worth it yet.

---

## 6. Recommendation

1. **Do Move 1.** It is right regardless of how the parse-time question resolves.
2. **Measure before Move 2.** One timed comparison on a scratch project.
3. **Don't do §5** until 2 says parse time is real.
4. Keep finding 003's define-once work inside whatever project boundary results — the two are
   independent, and 003 matters more for your stated goal.

## Corrections this supersedes

- 002's "84.3% shared" → the real figure for forms vs dashboard vs n8n is a **322.4kb true core**,
  with 410kb privately owned across the three sides.
- 002's "only 8.5kb is genuinely separable" → **it is 341.1kb** (forms-only + dashboard-only +
  the two-way overlaps).
- 002's "splitting saves only what deleting dev code saves" → **false.** After deleting, a split
  still removes a further ~190kb per side.
