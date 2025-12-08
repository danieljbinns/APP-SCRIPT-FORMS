# REQUEST_FORMS - Weekly Review & Testing Plan

**Purpose:** Comprehensive review and testing of the REQUEST_FORMS workflow system
**Timeline:** This Week (5-7 days)
**Status:** Ready to begin

---

## 📅 Weekly Schedule

### Day 1: Initial Setup & Review (Monday)
**Time:** 2-3 hours

#### Morning: Environment Verification
- [ ] Verify GAM7 is working: `gam info domain`
- [ ] Verify Google Groups exist (9 groups)
- [ ] Verify Shared Drive access (Team Group Companies)
- [ ] Verify Apps Script project is accessible
- [ ] Check all 9 sub-form project folders exist

#### Afternoon: Code Review
- [ ] Review `WorkflowUtils.gs` - Workflow management logic
- [ ] Review `Code.gs` - Main routing and form handling
- [ ] Review `Config.gs` - Configuration and constants
- [ ] Review email templates - Notification formatting
- [ ] Check all 9 sub-form `Config.gs` files for consistency

---

### Day 2: Phase 1 - Workflow Tracking Setup (Tuesday)
**Time:** 1-2 hours

#### Setup Workflow Tracking Spreadsheet
- [ ] Open REQUEST_FORMS Apps Script project
- [ ] Run `Setup.gs` → `runSetup()` function
- [ ] Copy WORKFLOW_TRACKING_SPREADSHEET_ID from output
- [ ] Update `Config.gs` line 26 with spreadsheet ID
- [ ] Verify spreadsheet created in Shared Drive
- [ ] Check spreadsheet headers match WORKFLOW_TASK_FIELDS

#### Deploy Updated Code
- [ ] Run `clasp push` to update Apps Script
- [ ] Run `clasp deploy --description "Workflow tracking v1"`
- [ ] Verify deployment successful
- [ ] Get web app URL from `clasp deployments`

---

### Day 3: Phase 2 - Create Sub-Form Spreadsheets (Wednesday)
**Time:** 1-2 hours

#### Create 9 Form Data Spreadsheets

**For each form, create spreadsheet in Shared Drive:**

1. **FORM_HR_DATA**
   - [ ] Create spreadsheet: "HR Setup Tasks"
   - [ ] Add headers from FORM_HR Config.FORM_FIELDS
   - [ ] Share with grp.forms.hr@team-group.com (Editor)
   - [ ] Copy spreadsheet ID to FORM_HR Config.gs

2. **FORM_IT_DATA**
   - [ ] Create spreadsheet: "IT Setup Tasks"
   - [ ] Add headers from FORM_IT Config.FORM_FIELDS
   - [ ] Share with grp.forms.it@team-group.com (Editor)
   - [ ] Copy spreadsheet ID to FORM_IT Config.gs

3. **FORM_FLEETIO_DATA**
   - [ ] Create spreadsheet: "Fleetio - Vehicle Assignment Tasks"
   - [ ] Add headers
   - [ ] Share with grp.forms.fleetio@team-group.com
   - [ ] Update Config.gs

4. **FORM_CREDITCARD_DATA**
   - [ ] Create spreadsheet: "Credit Card Request Tasks"
   - [ ] Add headers
   - [ ] Share with grp.forms.creditcard@team-group.com
   - [ ] Update Config.gs

5. **FORM_REVIEW306090_DATA**
   - [ ] Create spreadsheet: "30-60-90 Day Review Tasks"
   - [ ] Add headers
   - [ ] Share with grp.forms.review306090@team-group.com
   - [ ] Update Config.gs

6. **FORM_ADP_SUPERVISOR_DATA**
   - [ ] Create spreadsheet: "ADP Supervisor Access Tasks"
   - [ ] Add headers
   - [ ] Share with grp.forms.adp-supervisor@team-group.com
   - [ ] Update Config.gs

7. **FORM_ADP_MANAGER_DATA**
   - [ ] Create spreadsheet: "ADP Manager Access Tasks"
   - [ ] Add headers
   - [ ] Share with grp.forms.adp-manager@team-group.com
   - [ ] Update Config.gs

8. **FORM_JONAS_DATA**
   - [ ] Create spreadsheet: "JONAS ERP Access Tasks"
   - [ ] Add headers
   - [ ] Share with grp.forms.jonas@team-group.com
   - [ ] Update Config.gs

9. **FORM_SITEDOCS_DATA**
   - [ ] Create spreadsheet: "SiteDocs - Safety Training Tasks"
   - [ ] Add headers
   - [ ] Share with grp.forms.sitedocs@team-group.com
   - [ ] Update Config.gs

---

### Day 4: Phase 3 - Deploy Sub-Form Projects (Thursday)
**Time:** 2-3 hours

#### Deploy Each Form Project (10-15 minutes per form)

**For FORM_HR:**
```bash
cd "P:\Repos\github\danieljbinns\APP SCRIPT FORMS\FORM_HR"
clasp login
clasp create --type webapp --title "FORM_HR" --rootDir .
# Update Config.gs with SPREADSHEET_ID
clasp push
clasp deploy --description "Initial deployment"
clasp deployments  # Get web app URL
```

- [ ] Deploy FORM_HR
- [ ] Deploy FORM_IT
- [ ] Deploy FORM_FLEETIO
- [ ] Deploy FORM_CREDITCARD
- [ ] Deploy FORM_REVIEW306090
- [ ] Deploy FORM_ADP_SUPERVISOR
- [ ] Deploy FORM_ADP_MANAGER
- [ ] Deploy FORM_JONAS
- [ ] Deploy FORM_SITEDOCS

#### Document Web App URLs
- [ ] Create spreadsheet with all 9 web app URLs
- [ ] Share with team
- [ ] Test each URL opens correctly

---

### Day 5: Phase 4 - Testing & Validation (Friday)
**Time:** 3-4 hours

#### Test 1: Initial Request Submission

**Setup:**
- [ ] Open REQUEST_FORMS web app
- [ ] Verify form loads correctly
- [ ] Check auto-prefill is working (test mode)

**Execute:**
- [ ] Fill out initial request form
- [ ] Submit form
- [ ] Note the Workflow ID generated (e.g., WF-REQ-20251208-001)

**Verify:**
- [ ] Confirmation page displays
- [ ] Check REQUEST_FORMS_DATA spreadsheet - new row added
- [ ] Check WORKFLOW_TRACKING spreadsheet - 9 task rows created
- [ ] All tasks have status = "Open"
- [ ] All tasks have correct Workflow_ID

**Check Emails:**
- [ ] Email received at grp.forms.hr@team-group.com
- [ ] Email received at all 9 group addresses
- [ ] Emails contain correct Workflow ID
- [ ] Links in emails are correct format
- [ ] Links include `?wfid=WF-REQ-...` parameter

---

#### Test 2: Sub-Form Completion (HR Form)

**Setup:**
- [ ] Open email from grp.forms.hr@team-group.com
- [ ] Click link to FORM_HR

**Execute:**
- [ ] Verify form loads with workflow data
- [ ] Verify employee information displays (from main request)
- [ ] Fill out HR-specific fields
- [ ] Submit form

**Verify:**
- [ ] Confirmation page displays
- [ ] Task ID generated (e.g., TASK-HR-20251208-A1B2)
- [ ] Check FORM_HR_DATA spreadsheet - new row added
- [ ] Check WORKFLOW_TRACKING spreadsheet:
  - [ ] HR task status = "Complete"
  - [ ] Task_ID populated
  - [ ] Completion_Date populated
  - [ ] Other 8 tasks still "Open"

---

#### Test 3: Multiple Sub-Form Completions

**Execute:**
- [ ] Complete FORM_IT (from email link)
- [ ] Complete FORM_FLEETIO (from email link)
- [ ] Complete FORM_CREDITCARD (from email link)

**Verify After Each:**
- [ ] Task ID generated
- [ ] Data saved to correct spreadsheet
- [ ] WORKFLOW_TRACKING status updated to "Complete"
- [ ] Completion percentage calculates correctly:
  - After IT: 2/9 = 22%
  - After FLEETIO: 3/9 = 33%
  - After CREDITCARD: 4/9 = 44%

---

#### Test 4: Workflow Progress Tracking

**Execute:**
- [ ] Create function to check workflow status:
  ```javascript
  function testWorkflowStatus() {
    const wfId = 'WF-REQ-20251208-001';
    const status = getWorkflowStatus(wfId);
    Logger.log(status);
  }
  ```

**Verify:**
- [ ] Function returns correct completion count (4/9)
- [ ] Function returns correct completion percentage (44%)
- [ ] Function returns list of completed tasks
- [ ] Function returns list of open tasks

---

#### Test 5: Error Handling

**Test Invalid Workflow ID:**
- [ ] Open FORM_HR with `?wfid=INVALID-ID`
- [ ] Verify error message displays
- [ ] Verify form doesn't crash

**Test Missing Workflow ID:**
- [ ] Open FORM_HR without `?wfid=` parameter
- [ ] Verify appropriate message displays
- [ ] Form handles gracefully

**Test Duplicate Submission:**
- [ ] Submit same form twice for same workflow
- [ ] Verify system handles appropriately
- [ ] Check for duplicate prevention

---

### Day 6: Integration Testing (Saturday - Optional)
**Time:** 2-3 hours

#### Complete End-to-End Workflow

**Test Full Workflow (All 9 Forms):**
1. [ ] Submit new initial request (get new Workflow ID)
2. [ ] Complete all 9 sub-forms in sequence:
   - [ ] HR
   - [ ] IT
   - [ ] Fleetio
   - [ ] Credit Card
   - [ ] 30-60-90 Review
   - [ ] ADP Supervisor
   - [ ] ADP Manager
   - [ ] JONAS
   - [ ] SiteDocs
3. [ ] Verify final WORKFLOW_TRACKING status: 9/9 Complete (100%)

#### Cross-Spreadsheet Data Validation

**Verify Data Consistency:**
- [ ] Compare initial request data in REQUEST_FORMS_DATA
- [ ] Compare workflow tracking in WORKFLOW_TRACKING
- [ ] Compare sub-form data in each FORM_*_DATA spreadsheet
- [ ] Ensure Workflow IDs match across all sheets
- [ ] Ensure Task IDs are unique and correctly formatted

---

### Day 7: Documentation & Cleanup (Sunday - Optional)
**Time:** 1-2 hours

#### Update Documentation

- [ ] Update IMPLEMENTATION_SUMMARY.md with test results
- [ ] Document any issues found during testing
- [ ] Update Config.gs with production settings
- [ ] Create user guide for form submission
- [ ] Create admin guide for monitoring workflows

#### Production Readiness

- [ ] Disable test default values in Config.gs:
  ```javascript
  ENABLE_DEFAULT_VALUES: false
  ```
- [ ] Update email addresses from test to production
- [ ] Verify all Google Groups have correct members
- [ ] Test with real user account (not admin)
- [ ] Create backup of all spreadsheets

---

## ✅ Success Criteria

### Phase 1 Complete When:
- [ ] WORKFLOW_TRACKING spreadsheet created
- [ ] Spreadsheet accessible from Shared Drive
- [ ] Config.gs updated with spreadsheet ID
- [ ] Code deployed successfully

### Phase 2 Complete When:
- [ ] All 9 form data spreadsheets created
- [ ] All spreadsheets have correct headers
- [ ] All spreadsheets shared with correct groups
- [ ] All Config.gs files updated with spreadsheet IDs

### Phase 3 Complete When:
- [ ] All 9 sub-form projects deployed
- [ ] All web app URLs documented
- [ ] All forms accessible via URL
- [ ] All forms load without errors

### Phase 4 Complete When:
- [ ] Initial request creates 9 workflow tasks
- [ ] Email notifications sent to all groups
- [ ] Sub-form completion updates workflow tracking
- [ ] Task IDs generated correctly
- [ ] Completion percentage calculates correctly
- [ ] All 5 tests pass successfully

---

## 🐛 Issue Tracking

### Issues Found During Testing

| Issue # | Description | Severity | Status | Resolution |
|---------|-------------|----------|--------|------------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

---

## 📊 Testing Results Summary

### Test 1: Initial Request Submission
- **Status:** ⏳ Not Started / ✅ Passed / ❌ Failed
- **Notes:**

### Test 2: Sub-Form Completion
- **Status:** ⏳ Not Started / ✅ Passed / ❌ Failed
- **Notes:**

### Test 3: Multiple Completions
- **Status:** ⏳ Not Started / ✅ Passed / ❌ Failed
- **Notes:**

### Test 4: Workflow Progress
- **Status:** ⏳ Not Started / ✅ Passed / ❌ Failed
- **Notes:**

### Test 5: Error Handling
- **Status:** ⏳ Not Started / ✅ Passed / ❌ Failed
- **Notes:**

### Integration Test: Full Workflow
- **Status:** ⏳ Not Started / ✅ Passed / ❌ Failed
- **Notes:**

---

## 🎯 Key Metrics to Track

### Performance Metrics
- [ ] Initial request submission time: _____ seconds
- [ ] Sub-form submission time: _____ seconds
- [ ] Email delivery time: _____ seconds
- [ ] Workflow tracking update time: _____ seconds

### Data Quality Metrics
- [ ] Number of workflows created: _____
- [ ] Number of tasks completed: _____
- [ ] Percentage of successful submissions: _____%
- [ ] Number of errors encountered: _____

---

## 📞 Support & Resources

### If Issues Arise

**Spreadsheet Issues:**
- Check Shared Drive permissions
- Verify spreadsheet IDs in Config.gs
- Check Apps Script service quotas

**Email Issues:**
- Verify Google Groups exist: `gam info group grp.forms.hr@team-group.com`
- Check group email settings
- Verify member list: `gam print group-members group grp.forms.hr@team-group.com`

**Deployment Issues:**
- Check `.clasp.json` has correct scriptId
- Verify OAuth scopes in `appsscript.json`
- Re-authorize if needed: `clasp login --creds [file]`

**Workflow Tracking Issues:**
- Check WorkflowUtils.gs functions
- Verify WORKFLOW_TRACKING_SPREADSHEET_ID is correct
- Test functions in Apps Script editor directly

---

## 📝 Daily Log Template

### [Date]: _____________

**Tasks Completed:**
-

**Issues Found:**
-

**Blockers:**
-

**Notes:**
-

**Tomorrow's Plan:**
-

---

## 🎉 Completion Checklist

When all phases are complete:

- [ ] All tests passed successfully
- [ ] All issues resolved or documented
- [ ] Documentation updated
- [ ] Production settings configured
- [ ] Team trained on system usage
- [ ] Backup procedures in place
- [ ] Monitoring/alerting configured
- [ ] Go-live date scheduled

---

**Created:** 2025-12-08
**Owner:** David Binns
**Status:** Ready to Begin
**Estimated Time:** 12-16 hours total
**Completion Target:** End of week
