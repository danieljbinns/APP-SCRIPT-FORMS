# APP SCRIPT FORMS

**Google Apps Script form projects and workflow management system**

---

## 📁 Repository Structure

```
APP-SCRIPT-FORMS/
│
├── FORMS/                    # All form collections
│   └── EmployeeRequestForms/ # New employee onboarding forms (10 forms)
│       ├── forms/            # Individual task forms
│       ├── scripts/          # Shared JavaScript modules
│       └── styles/           # Shared CSS stylesheets
│
├── PROJECT_PLANNING/         # Documentation, deployment, planning
│   ├── current-deployment/   # Preserved backend code
│   ├── planning/             # Feature planning (13 documents)
│   ├── setup/                # Setup and configuration guides
│   ├── testing/              # Test plans and strategies
│   └── future-admin-ui/      # Future admin tooling plans
│
├── DEMO/                     # UI/UX prototypes and demo materials
│
└── archive/                  # Deprecated/legacy code
    ├── WMAR/                 # Original legacy system
    ├── REQUEST_FORMS/        # Old monolithic implementation
    └── WORKFLOWS/            # Previous workflow approach
```

---

## 🎯 Primary Project: New Employee Workflow

**Goal:** Replace current manual onboarding process with automated, dynamic workflow system.

**Status:** Active development

**Location:** `FORMS/EmployeeRequestForms/`

### Forms Included (10 total):
1. **InitialRequest** - Workflow initiator
2. **HR** - HR onboarding tasks
3. **IT** - IT setup (email, computer, accounts)
4. **CreditCard** - Credit card requests
5. **Fleetio** - Vehicle/fuel card assignment
6. **ADP_Manager** - ADP manager access
7. **ADP_Supervisor** - ADP supervisor access
8. **Jonas** - JONAS ERP access
9. **Review306090** - 30/60/90 day reviews
10. **SiteDocs** - Safety training

---

## 🚀 Getting Started

### For Deployment:
See `PROJECT_PLANNING/WEEKLY_REVIEW_PLAN.md` for the 7-day deployment strategy (12-16 hours total).

### For Development:
1. Navigate to `FORMS/EmployeeRequestForms/`
2. Each form is a separate Google Apps Script project
3. Shared resources in `styles/` and `scripts/` folders

---

## 📖 Key Documentation

### Deployment & Setup:
- **PROJECT_PLANNING/WEEKLY_REVIEW_PLAN.md** - 7-day deployment strategy ⭐
- **PROJECT_PLANNING/DEPLOYMENT_GUIDE.md** - Complete deployment guide
- **PROJECT_PLANNING/setup/** - Environment setup guides

### Architecture & Planning:
- **PROJECT_PLANNING/ARCHITECTURE.md** - System architecture
- **PROJECT_PLANNING/WORKFLOW_ARCHITECTURE.md** - Workflow design
- **PROJECT_PLANNING/planning/** - Feature planning documents (13 features)

### Testing:
- **PROJECT_PLANNING/testing/** - Test plans and strategies

---

## 🏗️ Architecture Overview

### Design Philosophy:
- **Modular Forms:** Each form is an independent Google Apps Script project
- **Reusable Components:** Forms can be used in multiple workflows or standalone
- **Shared Resources:** Common styles and scripts shared across all forms
- **Dynamic Workflows:** Tasks appear based on previous task outcomes

### Three-Level Hierarchy:
1. **Workflows** - Orchestrate multiple tasks in sequence
2. **Tasks** - Individual forms with sequential steps (reusable)
3. **Steps** - Atomic actions within each task

---

## 🔗 Related Resources

**GitHub Repository:** https://github.com/danieljbinns/APP-SCRIPT-FORMS

**Main Repository:** `P:\Repos\github\danieljbinns\APP SCRIPT FORMS`

**Google Shared Drive:** Team Group Companies (`0AOOOWlqzpUNVUk9PVA`)

---

## ⚠️ Important Notes

- **DEMO** folder contains latest UI/UX examples from senior presentation
- **archive** folder contains deprecated code - keep until deployment successful
- **FORMS/EmployeeRequestForms** is the current, active codebase (updated Dec 9, 2025)
- Previous monolithic approaches (WMAR, REQUEST_FORMS, WORKFLOWS) have been archived
- **All planning/documentation now in PROJECT_PLANNING folder**

---

## 📊 Current Status

**Repository:** Cleaned and reorganized (Dec 12, 2025)
- ✅ Duplicate FORM_* folders removed
- ✅ Documentation consolidated into PROJECT_PLANNING
- ✅ Legacy code moved to archive
- ✅ Clear folder structure (4 top-level folders + README)

**Next Step:** Deploy New Employee Workflow using `PROJECT_PLANNING/WEEKLY_REVIEW_PLAN.md`

---

**Copyright © 2025 Team Group Companies. All rights reserved.**
