# REQUEST_FORMS - Complete Deployment Checklist

**Date:** December 4, 2025
**Location:** `P:\Projects\Company\REQUEST_FORMS_DOCS`
**Projects:** 10 total (1 main + 9 sub-forms)

---

## Pre-Deployment Verification

### ✅ All Files Present

- [x] All 10 projects have correct file structure
- [x] Dark mode CSS template applied to all forms
- [x] Workflow integration in REQUEST_FORMS Code.gs
- [x] WorkflowUtils.gs included in REQUEST_FORMS
- [x] All Config.gs files have SHARED_DRIVE_ID
- [x] All Setup.gs files create spreadsheets in Shared Drive

### ✅ Configuration Check

**Shared Drive:**
- ID: `0AOOOWlqzpUNVUk9PVA`
- Name: Team Group Companies

**Google Groups:**
- grp.forms.hr@team-group.com
- grp.forms.it@team-group.com
- grp.forms.fleetio@team-group.com
- grp.forms.creditcard@team-group.com
- grp.forms.review306090@team-group.com
- grp.forms.adp.supervisor@team-group.com
- grp.forms.adp.manager@team-group.com
- grp.forms.jonas@team-group.com
- grp.forms.sitedocs@team-group.com

---

## Deployment Steps

### Phase 1: Automated Deployment (PowerShell Script)

Run the automated deployment script:

```powershell
cd "P:\Projects\Company\REQUEST_FORMS_DOCS"
.\deploy_all_projects.ps1
```

**This script will:**
- ✅ Create all 10 Apps Script projects
- ✅ Push code to Google Apps Script
- ✅ Display Apps Script Editor URLs

**Estimated time:** 10-15 minutes

---

### Phase 2: Setup Spreadsheets (Manual - Per Project)

For **each of the 10 projects**, do the following:

#### REQUEST_FORMS Main Project

1. **Open Apps Script Editor**
   ```
   https://script.google.com/d/[SCRIPT_ID]/edit
   ```

2. **Run Setup**
   - Select function: `Setup.runSetup()`
   - Click "Run"
   - Authorize the script when prompted
   - Check execution logs

3. **Copy Spreadsheet IDs from logs**
   ```
   SPREADSHEET_ID: '1abc...'
   WORKFLOW_TRACKING_SPREADSHEET_ID: '1xyz...'
   ```

4. **Update Config.gs**
   - Open Config.gs
   - Paste the two spreadsheet IDs
   - Save

5. **Push Updated Config**
   ```bash
   cd "P:\Projects\Company\REQUEST_FORMS_DOCS"
   clasp push
   ```

6. **Verify Spreadsheets**
   - Open Google Drive Shared Drive: Team Group Companies
   - Confirm both spreadsheets are there:
     - REQUEST_FORMS - Initial Requests
     - REQUEST_FORMS - Workflow Tracking

---

#### FORM_HR

1. **Open Apps Script Editor**
   ```
   https://script.google.com/d/[SCRIPT_ID]/edit
   ```

2. **Run Setup**
   - Select function: `Setup.runSetup()`
   - Click "Run"
   - Authorize when prompted
   - Check logs

3. **Copy Spreadsheet ID from logs**
   ```
   SPREADSHEET_ID: '1abc...'
   ```

4. **Get Workflow Tracking ID**
   - Copy from REQUEST_FORMS Config.gs:
   ```
   WORKFLOW_TRACKING_SPREADSHEET_ID: '1xyz...'
   ```

5. **Update Config.gs**
   - Open FORM_HR Config.gs
   - Paste both IDs:
     - SPREADSHEET_ID (from Setup logs)
     - WORKFLOW_TRACKING_SPREADSHEET_ID (from REQUEST_FORMS)
   - Save

6. **Push Updated Config**
   ```bash
   cd "P:\Projects\Company\REQUEST_FORMS_DOCS\FORM_HR"
   clasp push
   ```

7. **Verify Spreadsheet**
   - Open Shared Drive: Team Group Companies
   - Confirm: HR Setup - Data

---

#### Repeat for All 8 Remaining Forms

**FORM_IT:**
- [ ] Run Setup.runSetup()
- [ ] Copy SPREADSHEET_ID
- [ ] Update Config.gs with both IDs
- [ ] clasp push
- [ ] Verify: IT Setup - Data in Shared Drive

**FORM_FLEETIO:**
- [ ] Run Setup.runSetup()
- [ ] Copy SPREADSHEET_ID
- [ ] Update Config.gs with both IDs
- [ ] clasp push
- [ ] Verify: Fleetio - Vehicle Assignment - Data in Shared Drive

**FORM_CREDITCARD:**
- [ ] Run Setup.runSetup()
- [ ] Copy SPREADSHEET_ID
- [ ] Update Config.gs with both IDs
- [ ] clasp push
- [ ] Verify: Credit Card Request - Data in Shared Drive

**FORM_REVIEW306090:**
- [ ] Run Setup.runSetup()
- [ ] Copy SPREADSHEET_ID
- [ ] Update Config.gs with both IDs
- [ ] clasp push
- [ ] Verify: 30-60-90 Day Review - Data in Shared Drive

**FORM_ADP_SUPERVISOR:**
- [ ] Run Setup.runSetup()
- [ ] Copy SPREADSHEET_ID
- [ ] Update Config.gs with both IDs
- [ ] clasp push
- [ ] Verify: ADP Supervisor Setup - Data in Shared Drive

**FORM_ADP_MANAGER:**
- [ ] Run Setup.runSetup()
- [ ] Copy SPREADSHEET_ID
- [ ] Update Config.gs with both IDs
- [ ] clasp push
- [ ] Verify: ADP Manager Setup - Data in Shared Drive

**FORM_JONAS:**
- [ ] Run Setup.runSetup()
- [ ] Copy SPREADSHEET_ID
- [ ] Update Config.gs with both IDs
- [ ] clasp push
- [ ] Verify: JONAS Project Assignment - Data in Shared Drive

**FORM_SITEDOCS:**
- [ ] Run Setup.runSetup()
- [ ] Copy SPREADSHEET_ID
- [ ] Update Config.gs with both IDs
- [ ] clasp push
- [ ] Verify: SiteDocs Safety Training - Data in Shared Drive

---

### Phase 3: Deploy as Web Apps

For **each of the 10 projects**, deploy as web app:

#### REQUEST_FORMS Main Project

```bash
cd "P:\Projects\Company\REQUEST_FORMS_DOCS"
clasp deploy --description "Initial deployment"
```

**Copy the Web App URL from output**

#### All 9 Sub-Forms

```bash
cd "P:\Projects\Company\REQUEST_FORMS_DOCS\FORM_HR"
clasp deploy --description "Initial deployment"
```

```bash
cd "P:\Projects\Company\REQUEST_FORMS_DOCS\FORM_IT"
clasp deploy --description "Initial deployment"
```

(Repeat for all 9 forms)

**OR use the batch script:**

```powershell
$forms = @("FORM_HR", "FORM_IT", "FORM_FLEETIO", "FORM_CREDITCARD", "FORM_REVIEW306090", "FORM_ADP_SUPERVISOR", "FORM_ADP_MANAGER", "FORM_JONAS", "FORM_SITEDOCS")
foreach ($form in $forms) {
    cd "P:\Projects\Company\REQUEST_FORMS_DOCS\$form"
    clasp deploy --description "Initial deployment"
}
```

---

### Phase 4: Configure Deployment Settings

For **each web app deployment**:

1. **Open Apps Script Editor**
2. **Click "Deploy" > "Manage deployments"**
3. **Click the gear icon (⚙️) next to the deployment**
4. **Configure:**
   - Execute as: **Me**
   - Who has access: **Anyone** (or your organization)
5. **Click "Deploy"**
6. **Copy the Web App URL**

---

### Phase 5: Test End-to-End Workflow

#### 1. Test Initial Request Form

- [ ] Open REQUEST_FORMS web app URL
- [ ] Fill out form completely
- [ ] Submit form
- [ ] Verify success message with Workflow ID (e.g., WF-REQ-20251204-A1B2)

#### 2. Verify Spreadsheets Updated

**Initial Requests Spreadsheet:**
- [ ] Open: REQUEST_FORMS - Initial Requests (in Shared Drive)
- [ ] Verify new row with workflow ID
- [ ] Check all fields populated correctly

**Workflow Tracking Spreadsheet:**
- [ ] Open: REQUEST_FORMS - Workflow Tracking (in Shared Drive)
- [ ] Verify 9 rows created (one per form)
- [ ] Check all Status = "Open"
- [ ] Verify Form_URL contains proper links

#### 3. Test Sub-Form

- [ ] Copy one Form_URL from Workflow Tracking sheet
- [ ] Open URL in browser
- [ ] Verify form loads with dark mode CSS
- [ ] Verify workflow ID displays correctly
- [ ] Fill out form
- [ ] Submit
- [ ] Verify success message with Task ID

#### 4. Verify Sub-Form Completion

**Sub-Form Spreadsheet:**
- [ ] Open form's data spreadsheet (e.g., HR Setup - Data)
- [ ] Verify new row with Task ID and Workflow ID
- [ ] Check all fields populated

**Workflow Tracking Update:**
- [ ] Open: REQUEST_FORMS - Workflow Tracking
- [ ] Find the row for this form
- [ ] Verify Status changed to "Complete"
- [ ] Verify Task_ID populated
- [ ] Verify Completed_Date and Completed_By set

#### 5. Test All 9 Sub-Forms

Repeat test for each form:
- [ ] FORM_HR
- [ ] FORM_IT
- [ ] FORM_FLEETIO
- [ ] FORM_CREDITCARD
- [ ] FORM_REVIEW306090
- [ ] FORM_ADP_SUPERVISOR
- [ ] FORM_ADP_MANAGER
- [ ] FORM_JONAS
- [ ] FORM_SITEDOCS

---

## Common Issues & Solutions

### Issue: "Authorization required"
**Solution:**
- Click "Review Permissions"
- Sign in with your Google account
- Click "Advanced" > "Go to [App Name] (unsafe)"
- Click "Allow"

### Issue: "Cannot access Shared Drive"
**Solution:**
- Verify SHARED_DRIVE_ID in Config.gs
- Ensure your Google account has access to Team Group Companies Shared Drive
- Re-run Setup.runSetup()

### Issue: "Spreadsheet not found"
**Solution:**
- Check that Setup.runSetup() completed successfully
- Verify spreadsheet IDs in Config.gs
- Confirm spreadsheets are in Shared Drive

### Issue: "Form doesn't load / white screen"
**Solution:**
- Check browser console for errors
- Verify Styles.html is pushed (clasp push)
- Check that all HTML files use `<?!= HtmlService.createHtmlOutputFromFile('Styles').getContent(); ?>`

### Issue: "Workflow tracking not updating"
**Solution:**
- Verify WORKFLOW_TRACKING_SPREADSHEET_ID in sub-form Config.gs
- Check that WorkflowUtils.gs is in REQUEST_FORMS
- Verify sheet name is "Workflow_Tasks"

---

## Post-Deployment Verification

### All Spreadsheets in Shared Drive

Verify these 11 spreadsheets exist in Team Group Companies Shared Drive:

1. [ ] REQUEST_FORMS - Initial Requests
2. [ ] REQUEST_FORMS - Workflow Tracking
3. [ ] HR Setup - Data
4. [ ] IT Setup - Data
5. [ ] Fleetio - Vehicle Assignment - Data
6. [ ] Credit Card Request - Data
7. [ ] 30-60-90 Day Review - Data
8. [ ] ADP Supervisor Setup - Data
9. [ ] ADP Manager Setup - Data
10. [ ] JONAS Project Assignment - Data
11. [ ] SiteDocs Safety Training - Data

### All Forms Have Dark Mode CSS

Open each form and verify:
- [ ] Black background
- [ ] Dark gray cards
- [ ] Red buttons (#EB1C2D)
- [ ] White text
- [ ] Red focus borders on inputs

### Workflow Integration Working

- [ ] Initial request creates 9 workflow tasks
- [ ] Sub-forms can read workflow data
- [ ] Sub-form submission updates tracking sheet
- [ ] Task IDs and status update correctly

---

## Time Estimates

| Phase | Estimated Time |
|-------|---------------|
| Phase 1: Automated deployment | 10-15 minutes |
| Phase 2: Setup spreadsheets (all 10) | 30-45 minutes |
| Phase 3: Deploy web apps (all 10) | 15-20 minutes |
| Phase 4: Configure deployments (all 10) | 20-30 minutes |
| Phase 5: End-to-end testing | 30-45 minutes |
| **Total** | **1.5 - 2.5 hours** |

---

## Success Criteria

✅ **Deployment is successful when:**

1. All 10 projects deployed as web apps
2. All 11 spreadsheets in Shared Drive
3. Initial request form creates workflow with 9 tasks
4. All 9 sub-forms load with dark mode CSS
5. Sub-form submissions update tracking sheet
6. No errors in execution logs
7. All forms accessible via web app URLs

---

## Next Steps After Deployment

1. **Share URLs with team**
   - Bookmark REQUEST_FORMS URL
   - Add to internal documentation

2. **Train users**
   - Show initial request process
   - Explain workflow tracking

3. **Monitor usage**
   - Check spreadsheets regularly
   - Review execution logs for errors

4. **Iterate**
   - Customize form fields as needed
   - Add validation rules
   - Enhance workflow logic

---

## Support

**Documentation:**
- WORKFLOW_ARCHITECTURE.md - Technical specification
- DARK_MODE_CSS_APPLIED.md - UI design guide
- LOCATION_AND_SHARED_DRIVE_SUMMARY.md - Setup details

**Logs:**
- Apps Script: View > Logs
- Execution logs: View > Executions

**Need help?**
Check the GitHub issues or internal support channels.
