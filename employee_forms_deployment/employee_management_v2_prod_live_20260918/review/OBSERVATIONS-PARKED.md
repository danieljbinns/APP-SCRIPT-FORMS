# Behaviour register

Plain statements of what the code does at points where behaviour is conditional, or differs between
flows. **No verdicts.** Nothing here is called correct, incorrect, intended, unintended, dead or a
defect — behaviour that looks odd from outside is often a business rule, and intent is not readable
from source. Adjudication happens per flow, by the maintainer, during review.

Each row says only: what happens, where, and which flows it touches.

---

## Raised by the maintainer

Recorded as raised. The judgement is theirs.

| # | Flow(s) | Raised | Behaviour as coded | Doc |
|---|---|---|---|---|
| M1 | WF_NEW_HIRE | IT Confirmation should trigger on any extra requirements | At `SI_NEW_HIRE_3_HR_VERIFICATION`, the branch to `IT Confirmation Needed` is taken when the requested systems list contains `BOSS`; otherwise the workflow advances to `IT Setup Needed`. | [01-new-hire.md](workflows/01-new-hire.md) |
| M2 | all | "others are wrong too" — further step/condition mismatches expected, not yet enumerated | — | [workflows/](workflows/) |

---

## Recorded while documenting

Facts noted in passing. Listed so each flow's review can pick them up in its own context.

| # | Flow(s) | Behaviour as coded | Where |
|---|---|---|---|
| R1 | WF_EQUIPMENT | The step label `Email Setup Needed` exists, and `launchEquipmentActionItems` / `launchRemainingEquipmentTasks` are present and commented out, as is the matching branch in `checkWorkflowCompletion`. The live path routes through `submitITSetup` instead. | `EquipmentRequestHandler.js`, `Services/ActionItemService.js` |
| R2 | all | At the completion check, `WF_NEW_HIRE` filters blocking tasks through `getRequiredSpecialistCats`. The other three do not, so every open task blocks except `WIS` and `Manager`. `WF_EQUIPMENT` runs the same specialist fan-out as `WF_NEW_HIRE` but is excluded from the filter by its ID prefix. | `Services/ActionItemService.js` |
| R3 | WF_NEW_HIRE | The `JR Title` task is created whenever the 30/60/90 plan is requested, and is not among the categories returned by `getRequiredSpecialistCats`. | `ITSetupHandler.js`, `Services/ActionItemService.js` |
| R4 | WF_POSITION_CHANGE | `serveITConfirmation` has a `CHANGE_` branch that serves `PositionSiteChangeRequest.html` in `it_confirmation` mode. No documented `CHANGE_` step sets `IT Confirmation Needed`; IT reaches its form from the action item instead (`SI_POSITION_CHANGE_3A_IT_SETUP`). | `ITConfirmationHandler.js`, `PositionChangeHandler.js` |
| R5 | WF_NEW_HIRE, WF_EQUIPMENT, WF_IT_CONFIRMATION forms | `adpSites`, `purchasingSites`, `jonasJobNumbers`, `bossJobSites` and `costSheetJobNumbers` have no markup; the page renders them from reference data via `buildDualList()`. `purchasingSites` and `jonasJobNumbers` drive the Purchasing task. | [fields/FORM_NEW_HIRE.md](fields/FORM_NEW_HIRE.md) |
| R6 | all | `InitialRequest.html` submits a hand-built object, so only listed controls reach the handler. `TerminationRequest.html` and `PositionSiteChangeRequest.html` submit every named control. | each form page's "Submit contract" row |
| R7 | WF_NEW_HIRE, WF_EQUIPMENT | The control `notes` ("Review Notes (Optional)") is present in every mode of `InitialRequest.html` and is not in the submitted payload. | [fields/FORM_NEW_HIRE.md](fields/FORM_NEW_HIRE.md) |
| R8 | — | The class `systems-only` is referenced by the mode CSS in `InitialRequest.html` and matches no control in the current markup. | `InitialRequest.extracted.json` |
| R9 | — | `adminPurgeWorkflows` returns before its body, which is commented out and carries a `TODO: confirm if still needed` dated 2026-05-14. | `WorkflowManager.js` |
| R10 | — | `Actor.js`, `EfxApi.js`, `FormContracts.js` and `EmployeeIdRegistry.js` open with a `(PROTOTYPE / NON-PRODUCTION)` header comment. `Config.js` sets `ENVIRONMENT = 'PROD'`. | [00-ORIENTATION.md](00-ORIENTATION.md) |
| R11 | WF_NEW_HIRE | `IT Confirmation` and `WIS` categories are skipped when `Dashboard_View` builds its "Pending:" list, so they do not appear in the dashboard's pending text. | `StateSync.js` |

---

## Per-flow review status

Each workflow and each form is reviewed on its own, even where a form is shared. Shared forms are
reviewed once per step instance, because the entry condition, actor and effects differ per flow.

| Unit | Key | Status |
|---|---|---|
| New Employee Onboarding | `WF_NEW_HIRE` | not started |
| System & Equipment Request | `WF_EQUIPMENT` | not started |
| End of Employment | `WF_TERMINATION` | not started |
| Position / Site Change | `WF_POSITION_CHANGE` | not started |
| New Employee Request form | `FORM_NEW_HIRE` | not started |
| Equipment form | `FORM_EQUIPMENT` | not started |
| IT Confirmation form | `FORM_IT_CONFIRMATION` | not started |
| IT Confirmation form (change) | `FORM_IT_CONFIRMATION_CHANGE` | not started |
| End of Employment form | `FORM_TERMINATION` | not started |
| Position / Site Change form | `FORM_POSITION_CHANGE` | not started |

Remaining documentation gaps, for reference: field effects are written for the `InitialRequest.html`
family only. `TerminationRequest.html` (24 fields) and `PositionSiteChangeRequest.html` (67 fields)
have complete mechanical inventories with effects not yet authored. The staff-facing forms
(`FORM_ID_SETUP`, `FORM_HR_VERIFICATION`, `FORM_IT_SETUP`, `FORM_TERM_APPROVAL`,
`FORM_CHANGE_APPROVAL`, `FORM_ACTION_ITEM`) have no field inventory yet.
