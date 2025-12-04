# Getting REQUEST_FORMS into Google Drive

**Shared Drive:** Team Group Companies
**Drive ID:** `0AOOOWlqzpUNVUk9PVA`
**URL:** https://drive.google.com/drive/folders/0AOOOWlqzpUNVUk9PVA

---

## Two Options

### Option 1: Automated (If you have Google Drive Desktop)

Run the upload script:
```powershell
cd "P:\Projects\Company\REQUEST_FORMS_DOCS"
.\upload_to_drive.ps1
```

This will automatically:
- Create folder structure in Shared Drive
- Upload all documentation
- Upload all scripts

---

### Option 2: Manual Upload (Recommended for First Time)

#### Step 1: Open Google Drive

Go to: https://drive.google.com/drive/folders/0AOOOWlqzpUNVUk9PVA

Or:
1. Open Google Drive
2. Click "Shared drives" in left sidebar
3. Click "Team Group Companies"

#### Step 2: Create Folder Structure

Create these folders in the Shared Drive:

```
Team Group Companies/
└── REQUEST_FORMS/
    ├── Documentation/
    └── Scripts/
```

**How to create:**
1. Click "New" button
2. Select "Folder"
3. Name it "REQUEST_FORMS"
4. Open the REQUEST_FORMS folder
5. Create "Documentation" folder inside
6. Create "Scripts" folder inside

#### Step 3: Upload Documentation

**Upload to Documentation/ folder:**

From: `P:\Projects\Company\REQUEST_FORMS_DOCS\`

Files to upload:
- ✅ `READY_FOR_DEPLOYMENT.md` - Start here guide
- ✅ `DEPLOYMENT_CHECKLIST.md` - Step-by-step deployment
- ✅ `WORKFLOW_ARCHITECTURE.md` - Technical specification
- ✅ `DARK_MODE_CSS_APPLIED.md` - UI design guide
- ✅ `LOCATION_AND_SHARED_DRIVE_SUMMARY.md` - Setup details
- ✅ `FORM_PREVIEW_DARK.html` - Visual preview

**How to upload:**
1. Open the Documentation folder
2. Click "New" > "File upload"
3. Select all 6 files above
4. Click "Open"

#### Step 4: Upload Scripts

**Upload to Scripts/ folder:**

From: `P:\Projects\Company\REQUEST_FORMS_DOCS\`

Files to upload:
- ✅ `deploy_all_projects.ps1` - Automated deployment
- ✅ `upload_to_drive.ps1` - This upload script
- ✅ `create_form_projects.py` - Form generator
- ✅ `add_setup_to_forms.py` - Setup.gs copier
- ✅ `copy_pretty_forms.py` - UI copier

**How to upload:**
1. Open the Scripts folder
2. Click "New" > "File upload"
3. Select all 5 files above
4. Click "Open"

---

## What About the Apps Script Code?

**The Apps Script projects (REQUEST_FORMS and 9 sub-forms) are NOT uploaded as regular files.**

They are deployed using `clasp` which creates them directly in Google Apps Script.

**Deployment happens in 3 steps:**

1. **Local code** (P:\Projects\Company\REQUEST_FORMS_DOCS)
   - You have all .gs, .html, .json files locally
   - This is your source code

2. **Deploy with clasp** (`clasp create` and `clasp push`)
   - Creates Apps Script projects in Google
   - Uploads your .gs and .html files
   - Projects appear at: script.google.com

3. **Spreadsheets created** (Setup.runSetup())
   - Creates data spreadsheets in Shared Drive
   - 11 total spreadsheets (1 initial + 1 tracking + 9 forms)

---

## What Will Be In Google Drive

### Documentation & Scripts (Manual Upload)

```
Team Group Companies/
└── REQUEST_FORMS/
    ├── Documentation/
    │   ├── READY_FOR_DEPLOYMENT.md
    │   ├── DEPLOYMENT_CHECKLIST.md
    │   ├── WORKFLOW_ARCHITECTURE.md
    │   ├── DARK_MODE_CSS_APPLIED.md
    │   ├── LOCATION_AND_SHARED_DRIVE_SUMMARY.md
    │   └── FORM_PREVIEW_DARK.html
    └── Scripts/
        ├── deploy_all_projects.ps1
        ├── upload_to_drive.ps1
        ├── create_form_projects.py
        ├── add_setup_to_forms.py
        └── copy_pretty_forms.py
```

### Spreadsheets (Created by Setup.runSetup())

```
Team Group Companies/ (root)
├── REQUEST_FORMS - Initial Requests
├── REQUEST_FORMS - Workflow Tracking
├── HR Setup - Data
├── IT Setup - Data
├── Fleetio - Vehicle Assignment - Data
├── Credit Card Request - Data
├── 30-60-90 Day Review - Data
├── ADP Supervisor Setup - Data
├── ADP Manager Setup - Data
├── JONAS Project Assignment - Data
└── SiteDocs Safety Training - Data
```

Note: Spreadsheets will be in the **root** of the Shared Drive, not in a subfolder.

### Apps Script Projects (Created by clasp)

These appear at https://script.google.com, not in Drive:
- REQUEST_FORMS
- FORM_HR
- FORM_IT
- FORM_FLEETIO
- FORM_CREDITCARD
- FORM_REVIEW306090
- FORM_ADP_SUPERVISOR
- FORM_ADP_MANAGER
- FORM_JONAS
- FORM_SITEDOCS

---

## Quick Upload Checklist

### ✅ Before Upload

- [ ] All documentation files exist in `P:\Projects\Company\REQUEST_FORMS_DOCS\`
- [ ] You have access to Team Group Companies Shared Drive
- [ ] You're signed into Google Drive with your work account

### ✅ Upload Process

- [ ] Created REQUEST_FORMS folder in Shared Drive
- [ ] Created Documentation subfolder
- [ ] Created Scripts subfolder
- [ ] Uploaded 6 documentation files
- [ ] Uploaded 5 script files
- [ ] Verified all files uploaded successfully

### ✅ After Upload

- [ ] Team members can access the folders
- [ ] Documentation is readable in Google Drive
- [ ] Ready to proceed with `deploy_all_projects.ps1`

---

## Sharing & Permissions

**The Shared Drive already has permissions set.**

Anyone with access to "Team Group Companies" Shared Drive can:
- ✅ View all documentation
- ✅ Run scripts (if they download them)
- ✅ Access deployed forms (after deployment)
- ✅ View all spreadsheets (after creation)

**Google Groups that will receive permissions:**
- grp.forms.hr@team-group.com → HR Setup - Data
- grp.forms.it@team-group.com → IT Setup - Data
- grp.forms.fleetio@team-group.com → Fleetio data
- (etc. for all 9 groups)

---

## Next Steps After Upload

1. ✅ Upload documentation and scripts (this guide)
2. ⏭️ Run `deploy_all_projects.ps1` (deploys Apps Script code)
3. ⏭️ Follow `DEPLOYMENT_CHECKLIST.md` (creates spreadsheets)
4. ⏭️ Test the complete workflow

---

## Verification

After uploading, verify you can access:

**In Google Drive:**
```
https://drive.google.com/drive/folders/0AOOOWlqzpUNVUk9PVA
```

You should see:
- REQUEST_FORMS folder
  - Documentation (6 files)
  - Scripts (5 files)

**Share the link with your team:**
```
https://drive.google.com/drive/folders/0AOOOWlqzpUNVUk9PVA
```

They can bookmark it for easy access to documentation.

---

## Troubleshooting

### "I don't have access to the Shared Drive"

**Solution:**
1. Ask your Google Workspace admin
2. They need to add you to "Team Group Companies" Shared Drive
3. Drive ID to give them: `0AOOOWlqzpUNVUk9PVA`

### "I can't create folders in the Shared Drive"

**Solution:**
Check your permission level:
- Need: **Contributor** or **Content Manager**
- If you only have **Viewer**, ask admin to upgrade

### "Upload failed / files not showing"

**Solution:**
1. Refresh the browser (F5)
2. Check internet connection
3. Try uploading one file at a time
4. Clear browser cache

### "Google Drive Desktop path is different"

**Solution:**
Edit the upload script and change:
```powershell
$drivePath = "G:\"  # Change to your actual path
```

Common paths:
- `G:\`
- `C:\Users\[username]\Google Drive\`
- `D:\Google Drive\`

---

## Summary

**What to upload manually:**
- Documentation (6 files) → Documentation/ folder
- Scripts (5 files) → Scripts/ folder

**What gets created automatically:**
- Apps Script projects → Created by `clasp`
- Spreadsheets (11 total) → Created by `Setup.runSetup()`

**Total time:** 5-10 minutes for manual upload

Ready to upload? Follow **Option 2** above! 🚀
