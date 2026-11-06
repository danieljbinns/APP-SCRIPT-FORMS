> **SUPERSEDED by [004](004-split-and-deploy-surface.md).** The call graph behind this
> document counted a global as *called* when its name merely appeared in another function's
> body, including inside comments and string literals. That inflated "shared" from 322.4kb
> to 832.4kb and produced the wrong conclusion. Kept for the record; do not act on it.

# 002 — Should Dashboard and Forms be separate Apps Script projects?

**Answer: no. The win you're looking for is real, but splitting isn't how you get it.**

## The question

Every request parses all 986.9kb of server JS, so a dashboard user pays for form handler code and
vice versa. Splitting into two script projects (same GCP project) would let each side parse only
what it needs. Worth doing?

## What the call graph says

Walked the graph from every route entry point plus every server global named in each side's HTML,
then attributed each of the 47 server `.js` files.

| bucket | size | % | files |
|---|---|---|---|
| **shared** | **832.4kb** | **84.3%** | 39 |
| forms-only | 4.1kb | 0.4% | 1 (`KonamiStats.js`) |
| dashboard-only | 4.4kb | 0.4% | 1 (`DashboardActionsHandler.js`) |
| unreachable (dev/admin) | 146.1kb | 14.8% | 6 |

**Only 8.5kb of the codebase is genuinely separable.** The dashboard renders request details, which
needs the same `SCHEMA`, the same `ActionItemService`, the same `EmailUtils`, the same
`PositionChangeHandler`. Forms and dashboard are not two applications sharing a database — they are
one application with two front doors.

## What a split would actually buy

```
today, both sides parse          : 986.9kb
Forms project   = shared + forms : 836.5kb   saves 150.5kb
Dashboard proj  = shared + dash  : 836.7kb   saves 150.2kb
shared code duplicated into both : 832.4kb
```

Each side saves ~150kb — and **that 150kb is almost exactly the 146.1kb of unreachable dev/admin
code**. You get the same saving by deleting those six files, with none of the cost.

What the split would cost: 832.4kb duplicated across two projects (or moved into an Apps Script
Library, which adds its own per-call latency and a version-pinning step to every deploy), two
deployments, two URLs, two version histories, and every shared-code change applied twice or
coordinated through a library version bump. Against 8.5kb of actual separation.

## What to do instead — same win, no architecture change

Delete from the deployed project:

| file | size | what it is |
|---|---|---|
| `MigrationTools.js` | 44.3kb | one-off migration tooling |
| `TestRunner.js` | 39.9kb | test harness |
| `ProdSmokeTest.js` | 26.2kb | smoke tests |
| `Setup.js` | 22.8kb | one-off setup routines |
| `ReplayService.js` | 12.7kb | replay tooling |
| `DashboardHandler.js` | 0.2kb | tombstone — file says *"REMOVED … intentionally left empty"* |
| **total** | **146.1kb** | **14.8% of every request's parse cost** |

These are editor-run and trigger-run tools. Nothing a web-app request reaches. They do not need to
live in the deployed project at all — keep them in a second script project, or in the repo only and
push them when needed.

**This is the bigger of the two server-side wins and it needs no restructuring.** Combined with
finding 001, a form route goes from 986.9kb parsed + 353.0kb delivered to roughly 841kb parsed +
167.2kb delivered.

## On forms going away over time

That argues further against splitting. Forms-only code is 4.1kb today — retiring forms shrinks the
shared core, it does not create a separable forms module. The thing that makes retirement cheap is
the per-route dependency map (this audit), not a project boundary.

If a split ever becomes right, the trigger is a *shared-core* change: the dashboard growing its own
data model, or a second consumer appearing that needs none of the form schema. Neither is true now.

## Confidence and limits

- **"Shared" is an upper bound.** The call graph counts a global as called if its name appears
  anywhere in another global's body, including inside comments and strings. Real shared code is
  somewhat less than 832.4kb. It does not change the conclusion — the separable fraction would have
  to be ~100× larger to make splitting pay.
- Two seeding bugs were found and fixed while producing this: `google.script.run` chains were
  yielding `withSuccessHandler` rather than the real target, which wrongly put
  `DashboardActionsHandler.js` (called from `Dashboard.html:1569`) in the unreachable bucket.
  Numbers above are post-fix.
- The six "unreachable" files are unreachable **from web-app routes**. Confirm none is bound to a
  time-driven trigger before deleting from the deployed project — triggers are configured in the
  Apps Script UI and are not visible in source.
