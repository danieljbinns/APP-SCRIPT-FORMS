# AGENT.md — machine-oriented handoff for whatever edits George's workflows

Scope: n8n instance `https://n8n-staging.team-group.com` (the live one). Production Employee Forms. Read
`HANDOFF.md` for the narrative; this file is the contract.

## Identifiers

| Thing | Value |
|---|---|
| Router (never call directly) | `ZOFcqwdAjXNHfsbH` `EFX · Router (PROD)` |
| Get Workflow | `A7nqVbqn19kzaSfi` |
| List Tasks | `5HoAXNxCWVF6wtYx` |
| Close Task | `C4oJSaevEqMvSCZe` |
| Submit ID Setup | `P3HiVnzoxaRYYTZN` |
| Close JR Task | `zxaTLTTNK28LpnNg` |
| Reference workflow (Binns' inbox) | `52DqtvlqJgO0ABL5` |
| Reference workflow (George's inbox, Team Group project) | `etvSuKXluKGrNQAT` |
| JR node demo | `KDlp3JYyY2Q170gX` |
| George's live JR workflows — DO NOT EDIT without George | `J7RU99n01pq9Xk3D`, `4InJ9cdAr5YxVgoT`, `KFzI1VJBU01axjTb` |
| Trigger mailbox group | `grp.forms.idsetup@team-group.com` |
| Principal the calls run as | `efx-bot@team-group.com` (fixed; `actor` is attribution only) |
| API version | `2026.09.17-1` · contracts `2026.09.16-r2` |

## Calling convention

- Node: `n8n-nodes-base.executeWorkflow`, **`typeVersion: 1.2`**, `workflowId: {__rl:true, mode:'id', value:'<id>'}`,
  `workflowInputs: {mappingMode:'defineBelow', value:{…}, schema:[{id,displayName,type,…} per declared input]}`,
  `options.waitForSubWorkflow: true`, `onError: 'continueErrorOutput'`.
- **Precede every call with a Code node that emits exactly the declared input names.** At 1.1 the mapping is
  ignored and fields are matched by name from the incoming item; do not rely on either alone.
- `callerPolicy` is `any` on all five wrappers. No allow-list request needed.
- Success item = alias result flattened + `{ok:true, fn, requestId, apiVersion, tookMs}`. No `.result`.
- Failure = thrown error → error output. Code is the trailing `[efxCode=E_…]` in `error.message`.

## Input schemas (declared trigger inputs; all optional unless stated)

```
Get Workflow     : workflowId*:string, actor:object, idempotencyKey:string
List Tasks       : workflowId, formType, status, assignedTo, taskId :string, actor:object, idempotencyKey:string
Close Task       : taskId | (workflowId + formType) :string, notes:string, checklist:object, formData:object,
                   dryRun:boolean, actor:object, idempotencyKey:string, treatAlreadyClosedAsSuccess:boolean
Submit ID Setup  : workflowId*, siteDocsWorkerId*, siteDocsJobCode*, dssUsername*, dssPassword* :string,
                   siteDocsUsername, siteDocsPassword, setupNotes, bossWisCreated, siteDocsBadgeCreated :string,
                   extra:object, includeRecord:boolean, actor:object, idempotencyKey:string
Close JR Task    : idOrWorkflow*:string (TK-… | NEW_EMP_…), notes:string, actor:object, idempotencyKey:string,
                   treatAlreadyClosedAsSuccess:boolean
```

Enums: `siteDocsJobCode ∈ {Hourly 1, Hourly 2, Salary 1, Salary 2, Supervisor, Manager}`. `status ∈ {Open, Closed, Cancelled}`.
`formType` examples: `safety_onboarding`, `jr_title`, `wis`, `review_306090`, `sitedocs`, `it_confirmation`.

Rules: never send `internalEmployeeId` to Submit ID Setup (pre-assigned; refused if different). `actor` shape
`{id:'n8n:<slug>', email:'efx-bot@team-group.com', display:'<name> (n8n)'}`. `idempotencyKey` unique per intent
(e.g. `idsetup-<workflowId>`), replays within 10 min return the cached result.

## Output shapes (observed on production 2026-09-23)

```
Get Workflow  → { ok, type:'Onboarding', status:'In Progress'|'Complete'|'Cancelled', requestData:{ 'First Name','Last Name',
                 'Employment Type','Employee Type','Position Title','Site Name','Hire Date','Manager Email','Requester Email',
                 'System Access','Systems','Internal Employee ID','Workflow ID', … 57 sheet headers }, checklist:[{name,status,target,by,time,tid}],
                 employeeId:{ workflowId, internalEmployeeId|null }, requesterEmail, managerEmail, fn, requestId, apiVersion, tookMs }
List Tasks    → { ok, count, tasks:[{ taskId, workflowId, category, name, description:[…], assignedTo, status, createdDate, completedDate, notes, closedBy, formType, draft }] }
Close Task    → { ok, taskId, workflowId, success }   dryRun:true → { ok, dryRun:true, taskId, workflowId, wouldClose:true, draft }
Submit ID Setup → { ok, success:true, message:'Employee ID setup completed successfully' }
Close JR Task → { ok, taskId, workflowId, success }   repeat → { ok, alreadyClosed:true, code:'E_ALREADY_CLOSED', message }
```

`employeeId.internalEmployeeId` is `null` for hires created before 2026-09 (id lived only in ID Setup Results);
fall back to `requestData['Internal Employee ID']`, then to the email.

## Trigger email contract

Subjects: `ID Setup Required` (to the group; has button `…?form=id_setup&wf=<workflowId>`), `Request Submitted`
(to requester; no button). Request Details rows (label then value, in HTML table cells): `Employee`, `Request ID`,
`Internal ID`, `Type`, `Job Title`, `Site`, `Department`, `Start Date`, `Manager`, `Requested By`. Regexes on
tag-stripped text: `Request ID\s*(NEW_EMP_[A-Za-z0-9_-]+)`, `Internal ID\s*(\d{4,6})\b`. Prefer the `wf=` URL
parameter when present. Dedupe by Request ID for 7 days.

## Error codes → handling

`E_VALIDATION` fix, no retry · `E_NOT_FOUND` check id, no retry · `E_ALREADY_CLOSED` success · `E_TASK_NOT_OPEN`
not success, no retry · `E_UPSTREAM` read `error.upstream.message` · `E_FORBIDDEN` escalate · `E_DISABLED` escalate
(admin kill switch) · `E_RATE_LIMITED` retry later · `E_TRANSPORT`/`E_INTERNAL` retry once after 60 s then
report `requestId`.

## Do / Don't

- DO keep new workflows **inactive** until a human switches them on.
- DO put real SiteDocs / DSS / BOSS calls in place of `Draft accounts`; keep its output keys.
- DON'T call the Router, the Execution API, or the spreadsheet directly. DON'T copy a wrapper to run it (no credential).
- DON'T edit the shared wrappers. DON'T re-version Apps Script deployment `@76`.
- DON'T pass `internalEmployeeId`. DON'T branch on the `EFX E_…:` prefix.
- Attribution ≠ authorization: permission checks use the real principal, never `actor`.
