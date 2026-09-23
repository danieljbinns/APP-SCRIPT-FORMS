# Function inventory — employee_management_v2_efx (top-level functions)

Generated from source (2026-09-16, pre-refactor line numbers except where noted). **Refactor 2026-09-16 night** (see `CODE_REVIEW_EFX_PASS2.md` §8): new files `EfxUtil.js` and `N8nEnvelope.js`; new helpers `efxRowToRecord_`, `efxParseDraft_`, `efxWorkflowStatus_` (EfxApi.js) and `n8nBool_`, `n8nParse_`, `n8nMapHandlerError_` (N8nEnvelope.js); `efxSign_`/`efxRedact_`/`efxJsonSafe` moved out of RawLog.js/EfxApi.js; the five `n8n*_` envelope helpers moved out of N8n.js — their sections below are updated with current line numbers. 318 top-level functions across 46 files at generation time (now 324 across 48). "client" = called from HTML via google.script.run; "efx" = alias (n8n_*), exposed via FormContracts allow-list, or efx-api surface; "refs" = call sites elsewhere in .js (0 = only reachable from client/API/editor).

| Category | Count |
|---|---|
| efx | 27 |
| entry | 2 |
| internal | 238 |
| serve | 18 |
| ui-handler | 33 |

## By file


### `Services\ActionItemService.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 972 | `closeActionItemWithNotes` | `taskId, notes, draftJSON, formDataJSON` | ui-handler | exposed | ✓ | 2 |
| 985 | `saveActionItemDraft` | `taskId, notes, draftJSON` | ui-handler | exposed | ✓ | 2 |
| 1006 | `completeMyTask` | `taskId, comments` | internal |  |  | 8 |
| 1087 | `completeJrTitleForWorkflow` | `workflowId, comments` | internal |  |  | 2 |
| 1127 | `jrCompleteViaSecret` | `idOrWorkflow, comments` | internal |  |  | 1 |

### `Services\ReferenceDataService.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 12 | `getDataLookupColumn` | `columnName` | internal |  |  | 2 |
| 46 | `getSitesList` | `` | ui-handler | exposed | ✓ | 2 |
| 54 | `getJobCodesList` | `` | internal |  |  | 1 |
| 62 | `getJRsList` | `` | ui-handler | exposed | ✓ | 1 |
| 70 | `getJobNumbersList` | `` | internal |  |  | 1 |
| 78 | `getBossJobSitesList` | `` | internal |  |  | 0 |
| 86 | `getBossCostSheetsList` | `` | internal |  |  | 0 |
| 95 | `getManagersList` | `` | internal |  |  | 1 |
| 150 | `getRequestersList` | `` | internal |  |  | 0 |
| 158 | `getAllReferenceData` | `` | internal |  |  | 0 |
| 171 | `getInitialFormData` | `` | ui-handler | exposed | ✓ | 8 |
| 204 | `getSiteOptions` | `` | internal |  |  | 0 |
| 215 | `getDataLookupByIndex` | `colIndex` | internal |  |  | 4 |
| 246 | `getFullNewHireData` | `workflowId` | internal |  |  | 14 |
| 330 | `getFullPositionChangeData` | `workflowId` | internal |  |  | 7 |

### `employee_management_v2_efx\AuditLog.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 14 | `writeAuditLog` | `userEmail, action, workflowId, detail, result` | internal |  |  | 8 |

### `employee_management_v2_efx\BOSSReviewHandler.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 12 | `serveITConfirmation` | `workflowId` | serve |  |  | 2 |
| 44 | `getFullNewHireData` | `workflowId` | internal |  |  | 14 |
| 122 | `getFullEquipmentRequestData` | `workflowId` | internal |  |  | 2 |
| 128 | `getFullPositionChangeData` | `workflowId` | internal |  |  | 7 |
| 181 | `submitITConfirmation` | `formData` | ui-handler | exposed | ✓ | 6 |
| 393 | `getITConfirmationData` | `workflowId` | internal |  |  | 2 |

### `employee_management_v2_efx\ChangeNotify.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 12 | `diffFormFields` | `original, submitted, fieldMap` | internal |  |  | 7 |
| 35 | `buildChangesHtml` | `step, changes` | internal |  |  | 1 |
| 69 | `sendChangeNotifications` | `workflowId, step, changes, context, opts` | internal |  |  | 6 |

### `employee_management_v2_efx\DashboardActionsHandler.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 22 | `adminDeleteWorkflows` | `workflowIds` | ui-handler |  | ✓ | 4 |

### `employee_management_v2_efx\DashboardDataHandler.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 24 | `getDashboardData` | `` | ui-handler | exposed | ✓ | 4 |
| 216 | `getMyTaskCounts` | `` | ui-handler | exposed | ✓ | 6 |
| 312 | `getWorkflowMapStats` | `` | ui-handler |  | ✓ | 4 |

### `employee_management_v2_efx\DashboardUIHandler.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 12 | `serveDashboard` | `` | serve |  |  | 1 |
| 24 | `serveWorkflowMap` | `` | serve |  |  | 1 |

### `employee_management_v2_efx\DirectoryService.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 13 | `searchDirectoryUsers` | `query` | ui-handler | exposed | ✓ | 0 |
| 52 | `testDirectorySearch` | `` | internal |  |  | 0 |
| 87 | `getCurrentUserDetails` | `` | ui-handler |  | ✓ | 0 |

### `employee_management_v2_efx\EfxApi.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 9 | `efxInfo` | `` | efx | efx-api |  | 2 |
| 20 | `efxContracts` | `` | efx | efx-api |  | 0 |
| 21 | `efxContract` | `form` | efx | efx-api |  | 0 |
| 22 | `efxValidate` | `form, data` | efx | efx-api |  | 0 |
| 25 | `efxRunAs` | `actorJson, fnName, argsJson` | efx | efx-api |  | 0 |
| 38 | `efxRowToRecord_` | `headers, row` | internal |  |  | 2 |
| 45 | `efxReadRecord` | `sheetName, workflowId` | efx | efx-api |  | 1 |
| 62 | `efxTaskList` | `p` | efx | efx-api |  | 2 |
| 95 | `efxParseDraft_` | `cell` | internal |  |  | 2 |
| 109 | `efxWorkflowStatus_` | `ss, workflowId` | internal |  |  | 1 |
| 124 | `efxTaskClose` | `actorJson, p, dryRun` | efx | efx-api |  | 3 |
| 185 | `efxEmployeeIdGet` | `workflowId` | efx | efx-api |  | 0 |
| 192 | `efxListWorkflows` | `f` | efx | efx-api |  | 1 |
| 224 | `efxEmployeeIdAllocate` | `actorJson, workflowId, employeeName` | efx | efx-api |  | 0 |
| 233 | `efxEventsSince` | `p` | efx | efx-api |  | 1 |

### `employee_management_v2_efx\EfxUtil.js`  *(new 2026-09-16 night — moved verbatim from RawLog.js / EfxApi.js)*

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 18 | `efxRedact_` | `v, depth` | internal | efx-api |  | 6 |
| 30 | `efxJsonSafe` | `v, depth` | internal | efx-api |  | 4 |
| 41 | `efxSign_` | `secret, env` | internal | efx-api |  | 1 |

### `employee_management_v2_efx\EmailTemplates.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 44 | `_isSpecialist` | `sys` | internal |  |  | 3 |
| 107 | `buildNewHireContextBlock` | `context, opts` | internal |  |  | 6 |
| 481 | `buildTerminationContextBlock` | `context, opts` | internal |  |  | 3 |
| 747 | `buildStatusChangeContextBlock` | `context, opts` | internal |  |  | 2 |

### `employee_management_v2_efx\EmailUtils.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 20 | `buildEmailSubject` | `action, contextData, opts` | internal |  |  | 2 |
| 175 | `getWorkflowContext` | `workflowId` | internal |  |  | 55 |
| 538 | `sendFormEmail` | `options` | internal |  |  | 64 |
| 614 | `sendBatchEmails` | `emailList` | internal |  |  | 0 |
| 642 | `sendInitialRequestEmails` | `config` | internal |  |  | 2 |
| 807 | `esBadge` | `status, text` | internal |  |  | 1 |
| 826 | `esVal` | `value, style` | internal |  |  | 130 |
| 843 | `esRow` | `label, value` | internal |  |  | 118 |
| 855 | `esDivider` | `` | internal |  |  | 23 |
| 868 | `esSection` | `title, status, badgeText, actorText, bodyHtml` | internal |  |  | 19 |
| 901 | `esBtn` | `url, text` | internal |  |  | 1 |
| 917 | `esCalBtn` | `dateStr, empName, siteName, adpId, label` | internal |  |  | 1 |
| 938 | `esBtnRow` | `formUrl, opts` | internal |  |  | 2 |
| 958 | `createContextBlockV2` | `context, opts` | internal |  |  | 6 |
| 981 | `createEmailTemplateV2` | `subject, body, formUrl, contextData, opts` | internal |  |  | 3 |
| 1062 | `sendSafetyOnboardingEmail` | `workflowId, requestData, setupData` | internal |  |  | 6 |
| 1123 | `notifyAdminActionItemFailure` | `workflowId, category, taskName, assignedTo, errorMsg` | internal |  |  | 2 |

### `employee_management_v2_efx\EquipmentRequestHandler.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 19 | `serveEquipmentRequest` | `` | serve |  |  | 1 |
| 31 | `submitEquipmentRequest` | `formData` | ui-handler | exposed | ✓ | 2 |
| 94 | `getEquipmentRequestData` | `workflowId` | internal |  |  | 2 |
| 120 | `_sendEquipmentRequestSubmitEmails` | `workflowId` | internal |  |  | 2 |
| 177 | `launchEquipmentActionItems` | `workflowId` | internal |  |  | 2 |
| 254 | `launchRemainingEquipmentTasks` | `workflowId, skipIT` | internal |  |  | 4 |
| 392 | `_notifyEquipmentTask` | `workflowId, taskId, teamLabel, assignedTo, context, bodyHtml` | internal |  |  | 7 |

### `employee_management_v2_efx\HRVerificationHandler.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 5 | `serveHRVerification` | `workflowId` | serve |  |  | 1 |
| 20 | `getHRVerificationData` | `workflowId` | internal |  |  | 3 |
| 93 | `submitHRVerification` | `formData` | ui-handler | exposed | ✓ | 3 |

### `employee_management_v2_efx\IDSetup.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 5 | `serveIDSetup` | `workflowId` | serve |  |  | 1 |
| 37 | `getIDSetupRequestData` | `workflowId` | internal |  |  | 3 |
| 109 | `generateEmployeeId` | `` | internal |  |  | 1 |
| 142 | `generateDssUsername` | `firstName, lastName` | internal |  |  | 1 |
| 147 | `submitEmployeeIDSetup` | `formData` | ui-handler | exposed | ✓ | 5 |
| 230 | `buildStartDateCalendarLink_` | `requestData` | internal |  |  | 1 |
| 251 | `triggerNextStepFromIDSetup` | `workflowId, setupData, requestData` | internal |  |  | 1 |

### `employee_management_v2_efx\ITConfirmationHandler.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 12 | `serveITConfirmation` | `workflowId` | serve |  |  | 2 |
| 44 | `submitITConfirmation` | `formData` | ui-handler | exposed | ✓ | 6 |
| 272 | `getITConfirmationData` | `workflowId` | internal |  |  | 2 |

### `employee_management_v2_efx\ITSetupHandler.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 34 | `serveITSetup` | `workflowId` | serve |  |  | 2 |
| 50 | `getITContextData` | `workflowId` | internal |  |  | 5 |
| 206 | `submitITSetup` | `formData` | ui-handler | exposed | ✓ | 29 |
| 449 | `triggerSpecialists` | `workflowId, itData` | internal |  |  | 9 |

### `employee_management_v2_efx\InitialRequestHandler.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 5 | `serveInitialRequest` | `` | serve |  |  | 1 |
| 17 | `submitInitialRequest` | `formData` | ui-handler | exposed | ✓ | 4 |
| 138 | `_sendInitialRequestSubmitEmails` | `workflowId` | internal |  |  | 1 |
| 174 | `formatInitialRequestData` | `data` | internal |  |  | 2 |

### `employee_management_v2_efx\KonamiStats.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 7 | `getKonamiStats` | `` | ui-handler |  | ✓ | 1 |

### `employee_management_v2_efx\LandingPageHandler.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 5 | `serveLandingPage` | `` | serve |  |  | 1 |
| 12 | `getCurrentUserEmail` | `` | ui-handler |  | ✓ | 0 |
| 16 | `include` | `filename` | internal |  |  | 1 |
| 25 | `safeInclude` | `filename` | internal |  |  | 0 |
| 34 | `includeWithData` | `filename, data` | internal |  |  | 0 |

### `employee_management_v2_efx\MigrationTools.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 34 | `wipeDevSheets` | `` | internal |  |  | 5 |
| 74 | `migrateFromProd` | `` | internal |  |  | 1 |
| 103 | `_copySheet` | `prod, dev, sheetName` | internal |  |  | 3 |
| 128 | `_copySheetWithExtraCols` | `prod, dev, sheetName, extraCols` | internal |  |  | 1 |
| 162 | `migrateInitialRequests` | `` | internal |  |  | 0 |
| 217 | `migrateActionItems` | `` | internal |  |  | 0 |
| 305 | `buildDashboardView` | `` | internal |  |  | 0 |
| 423 | `fixIDSetupCompleteSteps` | `` | internal |  |  | 0 |
| 481 | `migrateEquipmentRequestsToInitialRequests` | `` | internal |  |  | 1 |
| 598 | `migrateFromProdFull` | `` | internal |  |  | 0 |
| 665 | `syncDashboardViewBatch` | `offset, batchSize` | internal |  |  | 1 |
| 696 | `syncDashboardViewNext` | `` | internal |  |  | 0 |
| 705 | `syncDashboardViewReset` | `` | internal |  |  | 1 |
| 711 | `getDashboardViewRowCount` | `` | internal |  |  | 0 |
| 736 | `migrateActionItemCategories` | `dryRun` | internal |  |  | 5 |
| 817 | `migrateActionItemCategoriesDryRun` | `` | internal |  |  | 0 |
| 818 | `migrateActionItemCategoriesApply` | `` | internal |  |  | 0 |
| 835 | `migrateAddMissingHeaders` | `` | internal |  |  | 1 |
| 878 | `migrateProdDeploy` | `` | internal |  |  | 1 |
| 887 | `migrateProdDeployApply` | `` | internal |  |  | 1 |
| 904 | `migrateEfx` | `dryRun` | internal |  |  | 2 |
| 948 | `migrateEfxDryRun` | `` | internal |  |  | 1 |
| 949 | `migrateEfxApply` | `` | internal |  |  | 2 |
| 952 | `migrateEfxBackfillEmployeeIds` | `dryRun` | internal |  |  | 3 |
| 973 | `migrateEfxBackfillDryRun` | `` | internal |  |  | 0 |
| 974 | `migrateEfxBackfillApply` | `` | internal |  |  | 0 |

### `employee_management_v2_efx\N8n.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 79 | `n8n_ping` | `` | efx | alias |  | 1 |
| 87 | `n8n_info` | `` | efx | alias |  | 0 |
| 93 | `n8n_contracts` | `` | efx | alias |  | 2 |
| 99 | `n8n_getWorkflow` | `actor, workflowId` | efx | alias |  | 0 |
| 108 | `n8n_getEmployeeId` | `actor, workflowId` | efx | alias |  | 0 |
| 114 | `n8n_listTasks` | `actor, filter` | efx | alias |  | 0 |
| 120 | `n8n_events` | `actor, params` | efx | alias |  | 0 |
| 129 | `n8n_createInitialRequest` | `actor, data, include` | efx | alias |  | 0 |
| 134 | `n8n_submitIdSetup` | `actor, data, include` | efx | alias |  | 0 |
| 139 | `n8n_submitHrVerification` | `actor, data, include` | efx | alias |  | 0 |
| 146 | `n8n_closeTask` | `actor, params` | efx | alias |  | 1 |
| 155 | `n8n_closeJrTask` | `actor, idOrWorkflow, notes` | efx | alias |  | 0 |
| 173 | `n8n_assignSafetyTraining` | `actor, workflowId, details` | efx | alias |  | 0 |

### `employee_management_v2_efx\N8nEnvelope.js`  *(new 2026-09-16 night — the private helpers moved out of N8n.js, plus the three new ones)*

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 18 | `n8nActor_` | `actor` | internal |  |  | 12 |
| 24 | `n8nOk_` | `result, extra` | internal |  |  | 24 |
| 29 | `n8nErr_` | `code, message, extra` | internal |  |  | 20 |
| 34 | `n8nGuard_` | `fn` | internal |  |  | 20 |
| 42 | `n8nParse_` | `v, fallback` | internal |  |  | 11 |
| 47 | `n8nBool_` | `v` | internal |  |  | 5 |
| 54 | `n8nOptions_` | `options` | internal |  |  | 1 |
| 74 | `n8nMapHandlerError_` | `res, fallbackCode, opts` | internal |  |  | 4 |
| 88 | `n8nSubmit_` | `actor, form, data, expectCreate, options` | internal |  |  | 5 |

### `employee_management_v2_efx\PositionChangeHandler.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 5 | `servePositionSiteChange` | `` | serve |  |  | 1 |
| 16 | `submitPositionChangeRequest` | `formData` | ui-handler | exposed | ✓ | 10 |
| 160 | `_sendPositionChangeSubmitEmails` | `workflowId` | internal |  |  | 2 |
| 203 | `servePositionChangeApproval` | `workflowId` | serve |  |  | 1 |
| 210 | `getPositionChangeData` | `workflowId` | internal |  |  | 12 |
| 375 | `submitPositionChangeApproval` | `formData` | ui-handler | exposed | ✓ | 12 |
| 1011 | `launchWisAssignment` | `workflowId` | internal |  |  | 3 |

### `employee_management_v2_efx\ProdSmokeTest.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 32 | `runProdSmokeTest` | `` | internal |  |  | 1 |
| 47 | `runProdSmokeNewHire` | `` | internal |  |  | 1 |
| 48 | `runProdSmokeTermination` | `` | internal |  |  | 1 |
| 49 | `runProdSmokeChange` | `` | internal |  |  | 1 |
| 50 | `runProdSmokeEquipment` | `` | internal |  |  | 1 |
| 52 | `checkProdSmokeOverrides` | `` | internal |  |  | 1 |
| 60 | `cleanupProdSmokeTest` | `` | internal |  |  | 2 |
| 69 | `_smokeSetup` | `` | internal |  |  | 5 |
| 80 | `_smokeTeardown` | `` | internal |  |  | 5 |
| 88 | `_smokeNewHire` | `` | internal |  |  | 2 |
| 150 | `_smokeTermination` | `` | internal |  |  | 2 |
| 213 | `_smokeChange` | `` | internal |  |  | 2 |
| 280 | `_smokeEquipment` | `` | internal |  |  | 2 |
| 324 | `_smokeCheck` | `label, pass, detail` | internal |  |  | 23 |
| 331 | `_smokeSuiteResult` | `tag, wfId, checks` | internal |  |  | 4 |
| 338 | `_smokeSummary` | `results` | internal |  |  | 5 |
| 357 | `_smokeReadRow` | `sheetName, workflowId` | internal |  |  | 7 |
| 378 | `_smokePurgeByNames` | `sentinelNames` | internal |  |  | 1 |

### `employee_management_v2_efx\RawLog.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 16 | `rawLog` | `source, formData` | internal |  |  | 13 |
| 18 | `rawLogResult` | `source, workflowId, result` | internal |  |  | 3 |
| 20 | `rawLogEvent_` | `kind, source, workflowId, payload` | internal |  |  | 2 |
| 53 | `rawLogFanOut_` | `event` | internal |  |  | 1 |
| — | *(`efxSign_` moved to `EfxUtil.js`)* |  |  |  |  |  |

### `employee_management_v2_efx\ReplayService.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 51 | `replayPlan` | `` | internal |  |  | 0 |
| 56 | `replaySend` | `` | internal |  |  | 0 |
| 69 | `replayWorkflowEmails` | `input` | internal |  |  | 4 |
| 134 | `planWorkflowEmailReplay` | `input` | internal |  |  | 3 |
| 226 | `_planNewEmpEmails` | `workflowId` | internal |  |  | 1 |
| 237 | `_planTermEmails` | `workflowId` | internal |  |  | 1 |
| 246 | `_planChangeEmails` | `workflowId` | internal |  |  | 1 |
| 259 | `_planEquipReqEmails` | `workflowId` | internal |  |  | 1 |
| 272 | `_replayGetWorkflowRow` | `workflowId` | internal |  |  | 2 |

### `employee_management_v2_efx\RequestActionsHandler.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 26 | `cancelRequest` | `workflowId` | ui-handler | exposed | ✓ | 0 |
| 72 | `updateHireDate` | `workflowId, newDateStr` | ui-handler | exposed | ✓ | 0 |
| 120 | `bumpRequest` | `workflowId, targetStep` | ui-handler | exposed | ✓ | 0 |
| 157 | `_sendBumpEmail` | `workflowId, targetStep` | internal |  |  | 1 |
| 227 | `_sendActionItemBump` | `workflowId, targetStep` | internal |  |  | 2 |

### `employee_management_v2_efx\RequestDetailsHandler.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 20 | `serveRequestDetails` | `workflowId` | serve |  |  | 1 |
| 36 | `getRequestDetails` | `workflowId` | ui-handler | exposed | ✓ | 4 |
| 240 | `getStepResultData` | `workflowId, stepTarget` | ui-handler | exposed | ✓ | 0 |
| 441 | `getTerminationDetails` | `workflowId` | ui-handler | exposed | ✓ | 1 |
| 566 | `getEquipmentRequestDetails` | `workflowId` | ui-handler | exposed | ✓ | 1 |
| 736 | `getChangeDetails` | `workflowId` | internal |  |  | 1 |

### `employee_management_v2_efx\Router.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 6 | `doGet` | `e` | entry |  |  | 1 |
| 137 | `doPost` | `e` | entry |  |  | 0 |
| 165 | `getBaseUrl` | `` | ui-handler |  | ✓ | 9 |
| 181 | `buildFormUrl` | `formName, params` | internal |  |  | 38 |
| 197 | `serveRefPage` | `filename, title` | serve |  |  | 5 |
| 204 | `serveAccessDenied` | `` | serve |  |  | 10 |

### `employee_management_v2_efx\Setup.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 9 | `initializeSystem` | `` | internal |  |  | 0 |
| 143 | `initSheet` | `ss, sheetName, headers` | internal |  |  | 12 |
| 169 | `createDataLookupSheet` | `` | internal |  |  | 1 |
| 252 | `setupProdScriptProperties` | `` | internal |  |  | 0 |
| 288 | `migratePositionChangesSchema` | `` | internal |  |  | 1 |
| 361 | `migratePositionChangesAttachmentUrl` | `` | internal |  |  | 1 |
| 386 | `listScriptProperties` | `` | internal |  |  | 0 |
| 394 | `prodHealthPing` | `` | internal |  |  | 0 |
| 425 | `setEmailRedirect` | `addr` | internal |  |  | 0 |
| 426 | `clearEmailRedirect` | `` | internal |  |  | 0 |
| 427 | `enableEasterEggs` | `` | internal |  |  | 0 |
| 428 | `disableEasterEggs` | `` | internal |  |  | 0 |
| 431 | `enableMaintenanceMode` | `` | internal |  |  | 0 |
| 432 | `disableMaintenanceMode` | `` | internal |  |  | 0 |
| 433 | `setMaintenanceBypass` | `emails` | internal |  |  | 0 |
| 434 | `clearMaintenanceBypass` | `` | internal |  |  | 0 |
| 435 | `suppressEmails` | `` | internal |  |  | 0 |
| 438 | `setJrTaskClosers` | `csv` | internal |  |  | 1 |
| 439 | `getJrTaskClosers` | `` | internal |  |  | 0 |
| 441 | `setPortalSecret` | `s` | internal |  |  | 0 |
| 444 | `setSafetyTrainingAtSubmit` | `on` | internal |  |  | 0 |
| 445 | `setEfxEventWebhook` | `url, kid, secret` | internal |  |  | 1 |
| 450 | `clearEfxEventWebhook` | `` | internal |  |  | 0 |
| 452 | `efxSelfTest` | `` | efx | efx-api |  | 0 |
| 457 | `getPortalSecretLen` | `` | internal |  |  | 0 |
| 458 | `unsuppressEmails` | `` | internal |  |  | 0 |

### `employee_management_v2_efx\SheetUtils.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 13 | `addSheetRow` | `spreadsheetId, sheetName, values` | internal |  |  | 7 |
| 41 | `setupSheetHeaders` | `spreadsheetId, sheetName, headers, headerColor` | internal |  |  | 0 |
| 84 | `getRowByRequestId` | `spreadsheetId, sheetName, requestId, requestIdColumn` | internal |  |  | 4 |

### `employee_management_v2_efx\Specialist.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 6 | `serveSpecialist` | `workflowId, dept` | serve |  |  | 1 |
| 58 | `submitSpecialistForm` | `formData` | ui-handler | exposed | ✓ | 0 |

### `employee_management_v2_efx\StateSync.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 8 | `manuallySyncAllWorkflows` | `` | internal |  |  | 3 |
| 44 | `recheckStuckSpecialistCompletions` | `` | internal |  |  | 1 |
| 78 | `syncWorkflowState` | `workflowId` | internal |  |  | 30 |

### `employee_management_v2_efx\SuperDebug.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 67 | `_sdLog` | `level, tag, msg, dataObj` | internal |  |  | 127 |
| 77 | `_sdSection` | `phaseNum, title` | internal |  |  | 48 |
| 85 | `_sdSummary` | `suiteName` | internal |  |  | 8 |
| 128 | `_sdEmailCapture` | `` | internal |  |  | 24 |
| 140 | `_sdEmailExtract` | `phaseLabel` | internal |  |  | 23 |
| 171 | `_sdReadRow` | `sheetName, workflowId` | internal |  |  | 3 |
| 198 | `_sdVerifyRow` | `tag, sheetName, workflowId, expectedMap` | internal |  |  | 13 |
| 231 | `_sdDumpRow` | `tag, sheetName, workflowId` | internal |  |  | 25 |
| 250 | `_sdVerifyAI` | `workflowId, expectedCategories` | internal |  |  | 6 |
| 302 | `_sdVerifyWorkflow` | `workflowId, expectedStatus, expectedStep` | internal |  |  | 19 |
| 333 | `_sdVerifyDashboardView` | `workflowId, expectedMap` | internal |  |  | 9 |
| 350 | `checkSuperDebugEmailSafety` | `` | internal |  |  | 8 |
| 371 | `sdFindTask` | `taskId` | internal |  |  | 0 |
| 448 | `_sdCloseAllAI` | `workflowId, phaseLabel` | internal |  |  | 14 |
| 692 | `runSuperDebugNewHire` | `` | internal |  |  | 3 |
| 914 | `sdRunJrTitleE2E` | `byWorkflow, createOnly, ov` | internal |  |  | 0 |
| 997 | `sdCheckGroupMembership` | `` | internal |  |  | 0 |
| 1048 | `runSuperDebugEOE` | `` | internal |  |  | 2 |
| 1158 | `_sdChangePayload` | `overrides` | internal |  |  | 3 |
| 1240 | `runSuperDebugStatusChange_Title` | `` | internal |  |  | 2 |
| 1332 | `runSuperDebugStatusChange_Site` | `` | internal |  |  | 2 |
| 1419 | `runSuperDebugStatusChange_Full` | `` | internal |  |  | 2 |
| 1528 | `runSuperDebugStatusChange` | `` | internal |  |  | 2 |
| 1640 | `runSuperDebugEquipment` | `` | internal |  |  | 2 |
| 1822 | `runSuperDebugAll` | `autoCleanup` | internal |  |  | 1 |
| 1877 | `listSuperDebugWorkflows` | `` | internal |  |  | 2 |
| 1907 | `_purgeWorkflowRows` | `workflowIds` | internal |  |  | 5 |
| 1938 | `cleanupSuperDebugAll` | `` | internal |  |  | 5 |
| 1953 | `cleanupSuperDebugWorkflow` | `wfId` | internal |  |  | 2 |
| 1970 | `runSuperDebugAggregation` | `` | internal |  |  | 1 |

### `employee_management_v2_efx\TerminationHandler.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 5 | `fmtDate_` | `iso` | internal |  |  | 16 |
| 18 | `parseDurationMonths_` | `durationStr` | internal |  |  | 1 |
| 24 | `serveTerminationRequest` | `` | serve |  |  | 1 |
| 32 | `submitTerminationRequest` | `formData` | ui-handler | exposed | ✓ | 4 |
| 125 | `_sendTerminationSubmitEmails` | `workflowId` | internal |  |  | 2 |
| 174 | `serveTerminationApproval` | `workflowId` | serve |  |  | 1 |
| 181 | `getTerminationData` | `workflowId` | internal |  |  | 10 |
| 234 | `submitTerminationApproval` | `formData` | ui-handler | exposed | ✓ | 4 |
| 511 | `scheduleAccountDeletion` | `taskId, duration, confirmWith` | internal |  |  | 0 |
| 547 | `sendActionItemEmail` | `to, subject, tid, termData, items` | internal |  |  | 7 |

### `employee_management_v2_efx\TestRunner.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 35 | `testEmailSend` | `` | internal |  |  | 0 |
| 48 | `_assertDevOnly` | `` | internal |  |  | 7 |
| 247 | `setTestEmailRedirect` | `` | internal |  |  | 1 |
| 259 | `restoreEmailRedirect` | `` | internal |  |  | 4 |
| 273 | `_getTestWorkflowIds` | `` | internal |  |  | 2 |
| 291 | `_step` | `label, fn` | internal |  |  | 9 |
| 313 | `_closeAllActionItems` | `workflowId` | internal |  |  | 1 |
| 359 | `runFullTestWorkflow` | `` | internal |  |  | 3 |
| 426 | `cleanupAllTestWorkflows` | `` | internal |  |  | 7 |
| 443 | `cleanupTestWorkflow` | `workflowId` | internal |  |  | 0 |
| 456 | `_purgeWorkflowRows` | `workflowIds` | internal |  |  | 5 |
| 498 | `listTestWorkflows` | `` | internal |  |  | 0 |
| 509 | `_chkPass` | `label, val` | internal |  |  | 6 |
| 514 | `_chkFail` | `label, detail` | internal |  |  | 8 |
| 521 | `_chkNotEmpty` | `label, val` | internal |  |  | 15 |
| 529 | `_chkEquals` | `label, actual, expected` | internal |  |  | 3 |
| 537 | `_chkContains` | `label, actual, substr` | internal |  |  | 2 |
| 548 | `checkDevEmailSuppression` | `` | internal |  |  | 2 |
| 570 | `_checkPositionChangeSheet` | `workflowId, expectAttachmentUrl` | internal |  |  | 1 |
| 610 | `_checkTerminationSheet` | `workflowId, expectAttachmentUrl` | internal |  |  | 1 |
| 642 | `_checkActionItemsExist` | `workflowId, expectedCategories` | internal |  |  | 2 |
| 778 | `runPositionChangeTest` | `` | internal |  |  | 2 |
| 884 | `runTerminationTest` | `` | internal |  |  | 2 |
| 955 | `runAllTests` | `` | internal |  |  | 2 |

### `employee_management_v2_efx\ValidationUtils.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 11 | `isValidEmail` | `email` | internal |  |  | 0 |
| 27 | `validateHireDate` | `hireDate, requestDate, minDays` | internal |  |  | 0 |
| 64 | `sanitizeInput` | `input` | internal |  |  | 1 |
| 82 | `isValidPhone` | `phone` | internal |  |  | 0 |
| 101 | `validateRequiredFields` | `formData, requiredFields` | internal |  |  | 2 |
| 134 | `isFutureDate` | `date` | internal |  |  | 0 |
| 147 | `validateName` | `name` | internal |  |  | 0 |

### `employee_management_v2_efx\WorkflowManager.js`

| Line | Function | Params | Category | EFX | Client | Refs |
|---|---|---|---|---|---|---|
| 15 | `logFormEdit` | `workflowId, formType, changedBy, oldRow, newRow` | internal |  |  | 3 |
| 51 | `generateWorkflowId` | `workflowType` | internal |  |  | 1 |
| 60 | `generateFormId` | `formType` | internal |  |  | 12 |
| 69 | `createWorkflow` | `workflowType, workflowName, initiatorEmail` | internal |  |  | 4 |
| 130 | `updateWorkflow` | `workflowId, status, currentStep, employeeName, actingUser` | internal |  |  | 21 |
| 171 | `syncStatusToRequestSheet` | `ss, workflowId, status` | internal |  |  | 1 |
| 222 | `adminPurgeWorkflows` | `workflowIds` | internal |  |  | 0 |
| 297 | `getWorkflow` | `workflowId` | efx | exposed |  | 11 |

## EFX surface cross-check

Aliases in N8n.js: n8n_assignSafetyTraining, n8n_closeJrTask, n8n_closeTask, n8n_contracts, n8n_createInitialRequest, n8n_events, n8n_getEmployeeId, n8n_getWorkflow, n8n_info, n8n_listTasks, n8n_ping, n8n_submitHrVerification, n8n_submitIdSetup

FormContracts callable/handler names with NO top-level function definition: none
