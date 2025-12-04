# 🚀 REQUEST_FORMS - START HERE

**Everything you need to deploy in ONE command!**

---

## ⚡ Quick Deploy (Automated)

Run this ONE script to do EVERYTHING:

```powershell
cd "P:\Projects\Company\REQUEST_FORMS_DOCS"
.\deploy_complete.ps1
```

**This script will:**
1. ✅ Upload all documentation to Shared Drive (using GAM)
2. ✅ Create all 10 Apps Script projects (using clasp)
3. ✅ Push all code to Google (using clasp)

**Time:** 20-30 minutes (mostly automated)

---

## 📋 What Gets Created

### In Google Shared Drive

**Folder structure:**
```
Team Group Companies/
└── REQUEST_FORMS/
    ├── Documentation/ (7 files)
    └── Scripts/ (6 files)
```

**Access at:** https://drive.google.com/drive/folders/0AOOOWlqzpUNVUk9PVA

### In Google Apps Script

**10 projects created:**
- REQUEST_FORMS (main workflow)
- FORM_HR
- FORM_IT
- FORM_FLEETIO
- FORM_CREDITCARD
- FORM_REVIEW306090
- FORM_ADP_SUPERVISOR
- FORM_ADP_MANAGER
- FORM_JONAS
- FORM_SITEDOCS

**Access at:** https://script.google.com

---

## 🔄 After Running the Script

The script will show you the Apps Script Editor URLs. For **each project**:

### 1. Run Setup (5 minutes per project)

Open the URL → Select `Setup.runSetup()` → Click "Run"

**This creates spreadsheets in your Shared Drive**

### 2. Update Config (2 minutes per project)

Copy the spreadsheet IDs from logs → Paste into `Config.gs`

### 3. Push & Deploy (2 minutes per project)

```bash
cd "P:\Projects\Company\REQUEST_FORMS_DOCS\[PROJECT]"
clasp push
clasp deploy
```

**Total time for all 10 projects:** ~90 minutes

---

## 📚 Documentation

All documentation is now in your Shared Drive:

| File | What It Does |
|------|-------------|
| **READY_FOR_DEPLOYMENT.md** | Complete overview |
| **DEPLOYMENT_CHECKLIST.md** | Step-by-step guide |
| **WORKFLOW_ARCHITECTURE.md** | How it works |
| **DARK_MODE_CSS_APPLIED.md** | UI design guide |
| **GOOGLE_DRIVE_SETUP.md** | Drive upload guide |

**Access:** Team Group Companies > REQUEST_FORMS > Documentation

---

## 🎯 Alternative: Step-by-Step

If you prefer manual control:

### Option 1: Upload to Drive First
```powershell
.\upload_with_gam.ps1
```
Uploads documentation using GAM

### Option 2: Deploy Apps Script First
```powershell
.\deploy_all_projects.ps1
```
Deploys all 10 projects using clasp

### Option 3: Complete Automation
```powershell
.\deploy_complete.ps1
```
Does BOTH (recommended!)

---

## ✅ Success Checklist

After running `deploy_complete.ps1`:

- [ ] Documentation uploaded to Shared Drive
- [ ] All 10 Apps Script projects created
- [ ] Code pushed to Google Apps Script
- [ ] Apps Script Editor URLs displayed
- [ ] Ready for Setup.runSetup() phase

---

## 🆘 Need Help?

**Check these files in Shared Drive:**
- DEPLOYMENT_CHECKLIST.md (detailed steps)
- READY_FOR_DEPLOYMENT.md (complete guide)

**Common issues:**
- GAM not found → Install GAM7
- clasp not found → Run `npm install -g @google/clasp`
- Authorization needed → Follow OAuth prompts

---

## 🎉 You're Ready!

Just run:
```powershell
.\deploy_complete.ps1
```

And follow the prompts! 🚀
