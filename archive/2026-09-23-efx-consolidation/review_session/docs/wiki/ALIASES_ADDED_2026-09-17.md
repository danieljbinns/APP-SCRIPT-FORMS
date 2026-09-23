# Aliases added 2026-09-17 (API version `2026.09.17-1`)

Additive only — nothing existing changed. Full generated reference: `docs/N8N_CONTRACTS.md`.

| Alias | What it does | Notes for George |
|---|---|---|
| `n8n_createWorkflow(actor, form, data, options)` | Generic create for any workflow-creating form (`new_hire`, `equipment_request`, `termination_request`, `position_change_request`) | Same as the named ones below; use when the form name is data-driven |
| `n8n_submitForm(actor, form, data, options)` | Generic step submit (`id_setup`, `hr_verification`, `it_setup`, `termination_approval`, `position_change_approval`) | Refuses unverified forms (`E_UNVERIFIED_FORM`) unless `options.allowUnverified:true` |
| `n8n_createEquipmentRequest` | Equipment/systems request → IT Confirmation | required: firstName, lastName, siteName, managerEmail, managerName, position |
| `n8n_createTerminationRequest` | End-of-employment request → HR approval | required: reqName, reqEmail, empName, empType, siteName, termDate, lastDayWorked, reason, managerName, managerEmail, has_reports (checkbox groups are comma-joined strings) |
| `n8n_submitTerminationApproval` | `{workflowId, decision:'Approved'\|'Rejected', notes}` → creates offboarding action items | duplicate approval = safe no-op; principal must be HR/Admin |
| `n8n_createPositionChangeRequest` | Status/position/site change → HR approval | required: firstName, lastName, currentClass, effDate, siteName |
| `n8n_submitPositionChangeApproval` | `{workflowId, decision, notes, confirmedTitle, confirmedNewManager, confirmedJrTitle}` | principal must be HR/Admin |
| `n8n_submitItSetup` | IT Setup step (creates JR / 30-60-90 / WIS / specialist tasks) | Snake_Case keys; required: workflowId, Email_Created, Computer_Assigned, Phone_Assigned, BOSS_Access; principal must be IT/Admin |
| `n8n_cancelWorkflow(actor, workflowId)` | Cancel + close open tasks, audited | `E_FORBIDDEN` unless principal is HR/IT/Admin/requester/manager |
| `n8n_bumpWorkflow(actor, workflowId, targetStep?)` | Send the reminder for the current step | `E_RATE_LIMITED` if sent recently |
| `n8n_updateHireDate(actor, workflowId, 'yyyy-MM-dd')` | Change hire date | principal HR/IT/Admin |
| `n8n_saveTaskDraft(actor, taskId, notes, checklist)` | Save partial checklist without closing | stored in the UI's `{items:{…}}` shape |
| `n8n_listWorkflows(actor, filter)` | List from `Dashboard_View` — `type`, `status`, `step`, `since`, `employeeName`, `limit`, `offset` | header-keyed rows + `type` |
| `n8n_getContext(actor, workflowId)` | The full context the emails use | credentials redacted; JSON-safe |

## Behaviour changes worth knowing (security review)
- **Authorization uses the real session** (`Actor.principal()`), i.e. the impersonated `efx-bot`. `actor.email` is attribution only and cannot grant rights.
- `n8n_events` and `n8n_getContext` redact password-like keys; the sheet keeps raw payloads.
- `n8n_closeJrTask` enforces `formType: jr_title` even when given a `TK-` id; Cancelled tasks return `E_TASK_NOT_OPEN`.
- `n8n_assignSafetyTraining` refuses a `'No'` confirmation unless `force:true`.
- New Raw Log events: `task.created`, `task.closed`.
