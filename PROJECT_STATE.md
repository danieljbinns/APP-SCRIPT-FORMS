# Employee Forms Deployment — Project State Summary

**Last updated:** 2026-06-10  
**Status:** Dev fully validated & tested; prod data synced to dev; ready for prod merge  
**Git:** `staging` branch, commit `112ae5f`, pushed to origin/staging

---

## Paths & IDs

| Item | Path/ID |
|------|---------|
| Working directory | `P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_deployment` |
| Python runner | `D:\Credentials\google\binns-claude-desktop\gas_runner.py` |
| Dev script ID | `1VI9tR0GCxwTmcuXiGBzTkDJVXXB94Hr3PpdnuDq-aBpDKKQGMKhA9U_L` |
| Prod spreadsheet | `1kGjw8e-uIehaBemlsRZ4Yq1QrYOWkJvWzhKbgfl4Pxo` |
| Code: dev | `employee_management_v2_dev/` |
| Code: prod (to update) | `employee_management_v2/` |

---

## Dev State (as of 2026-06-10)

**Data:**
- Prod copied to dev (407 workflows, 257 action items, 319 initial requests)
- Migration applied: 5 rows (Fleetio→Fleet, Jonas→Purchasing, Finance→Purchasing for TERM_)
- Dashboard_View rebuilt: 403 rows

**Testing:**
- All 4 SuperDebug suites: **191 pass / 0 fail**
- ProdSmokeTest: **19/19 pass**
- Email suppression cleared (redirects to dbinns@team-group.com)

**Code changes completed:**
- ✅ ADP action item for Status Change (HR + Payroll, shared)
- ✅ WIS sequencing on transfer (ID Setup post-close hook fires manager WIS item)
- ✅ Delegation fields (oldReportsTo/newReportsFrom) in Status Change emails & form headers
- ✅ Dashboard steppers for all 4 workflows (badge-label dots, phase numbers)
- ✅ Cancel/Bump button visibility fixed (requester/manager can see)
- ✅ Java object display fix (`[L` guard in form fields)
- ✅ Category renames (Jonas→Purchasing, Fleetio→Fleet, WIS User→Deactivation/ID Setup)
- ✅ jaynepalmer@team-group.com added to ADMIN_EMAILS

---

## Prod Merge — Next Steps

### Prerequisites (completed)
- Dev fully tested and validated
- Prod data copied to dev
- Migration scripts tested & verified (dry run found 5 rows as expected)

### Prod Merge Checklist
1. Copy changed files from `employee_management_v2_dev/` to `employee_management_v2/`
2. `clasp push --force` from `employee_management_v2/`
3. `migrateProdDeploy` dry run (expect ~5 rows)
4. `migrateProdDeployApply` (apply headers + category renames)
5. `migrateProdDeploy` confirm (verify 0 remaining)
6. `syncDashboardViewReset` + `syncDashboardViewNext` ×N until `done=true`
7. `getDashboardViewRowCount` verify row count
8. Manual smoke test:
   - Open dashboard, confirm stepper badge counts
   - Submit Status Change, verify ADP action item with delegation fields
   - Test Cancel/Bump as requester (non-admin)
   - View Data on Fleet/Finance/Purchasing action items
   - Confirm jaynepalmer@ has admin access

### Files to Copy (key changes)

| File | Key Change | Risk |
|------|-----------|------|
| `PositionChangeHandler.js` | ADP item, WIS sequencing, delegation fields | Low |
| `ActionItemService.js` | WIS post-close hook | Low |
| `EmailTemplates.js` | Reports In/Out in Status Change block | Low |
| `EmailUtils.js` | CHANGE_ context includes delegation fields | Low |
| `Dashboard.html` | Full stepper rewrite, all 4 workflows | Medium |
| `RequestDetails.html` | Dynamic flow cards, BADGE_LABEL map | Medium |
| `RequestDetailsHandler.js` | All 4 handlers expose requesterEmail/managerEmail | Low |
| `Config.js` | jaynepalmer@team-group.com added | Low |
| `EquipmentRequestHandler.js` | Finance→Purchasing, Credit Card→Finance | Low |
| `TerminationHandler.js` | Category names updated | Low |
| `DashboardDataHandler.js` | aiCounts keys fixed, openCategoriesMap fix | Low |

---

## Key Architecture Changes

### ADP Action Item (Status Change)
- **Category:** `'HR'` (assigned to HR + Payroll, shared)
- **When:** HR approves Status Change
- **Checklist:**
  - Update [name] in ADP
  - Reassign reports from [oldReportsTo] to: [newReportsTo]
  - Reassign reports to [name] from: [newReportsFrom]
- **Delegation fields:** `context.oldReportsTo`, `context.newReportsFrom` (now in all SC emails + form header)

### WIS Sequencing (Transfer)
- **Pattern:** Post-close hook in `ActionItemService.closeActionItem()`
- **Trigger:** ID Setup item with `formType: 'boss_wis_update'` closes on CHANGE_ workflow
- **Action:** Calls `launchWisAssignment(workflowId)` to fire manager WIS Assignment item
- **Result:** Manager never sees WIS item until ID Setup has updated BOSS account

### Dashboard Stepper
- **All 4 workflows** get steppers (New Hire, Equipment, Status Change, EOE/Termination)
- **Phase numbers:** Sequential steps = unique numbers (1, 2, 3...); parallel steps = same number
- **Badges:** Dynamic badge-label dots from `BADGE_LABEL` map (shared by Dashboard + RequestDetails)
- **Terminal guard:** No Cancel/Bump on Cancelled/Complete workflows
- **Cancel/Bump visible to:** Admin, HR, IT, Specialist, Owner, Requester, Manager (per role)

---

## Known Future Work (not blocking prod)

| Task | Scope | Impact |
|------|-------|--------|
| Fix `hasIt` completion gate | EmailTemplates.js — use `itTimestamp \|\| assignedEmail` | Low risk, fixes IT section display when Email_Created='No' |
| Email 11 (IT Setup Complete) context source | Switch from `getITContextData()` to `getWorkflowContext()` | Low risk, makes mid-flow email more complete |
| Equipment Request (ER series) | 5 items: IT form path, WIS guard, 30/60/90 logic, SiteDocs, Training Only field | Medium risk, scoped separately |

---

## Testing & Validation

**SuperDebug runs (dev, post-migration):**
- `runSuperDebugNewHire`: 51 pass / 0 fail (121s)
- `runSuperDebugEOE`: 33 pass / 0 fail (66s)
- `runSuperDebugEquipment`: 27 pass / 0 fail (49s)
- `runSuperDebugStatusChange`: All pass (156s)

**Dashboard sync:**
- 407 workflows synced in 6 batches of 80 workflows each
- 403 rows final (407 minus 4 Inactive)

**ProdSmokeTest:** 19/19 pass

---

## Recovery / Continuation

If switching to another device:

```bash
cd P:\Repos\github\danieljbinns\APP\ SCRIPT\ FORMS\employee_forms_deployment
git checkout staging
# All context in git log — read commit 112ae5f for full state
```

No uncommitted changes. All code in `employee_management_v2_dev/` ready to copy to prod. Migration scripts stable and verified against real prod data.

---

## Category Name Reference

| Old | New | Applies To |
|-----|-----|-----------|
| Jonas | Purchasing | All workflows |
| Fleetio | Fleet | All workflows |
| WIS User | Deactivation (TERM_) / ID Setup (EQUIP_/CHANGE_) | Termination vs Transfer/Equipment |
| Finance → Purchasing | Purchasing | Termination only |
| (blank) | Manager | Dashboard only (non-blocking acknowledgement role) |

---

## Contact / Questions

**User email:** dbinns@team-group.com  
**Admin group now includes:** jaynepalmer@team-group.com
