# APP SCRIPT FORMS

**Enterprise-grade Google Apps Script form projects with modular, reusable components**

---

## 📁 Repository Structure

```
APP-SCRIPT-FORMS/
│
├── FORMS/                     # All form projects
│   └── EmployeeRequestForms/  # New employee onboarding project
│       ├── styles/            # Shared CSS (all forms use these)
│       ├── scripts/           # Shared JS modules (all forms use these)
│       └── forms/             # Individual forms (10 forms)
│
├── WORKFLOWS/                 # Workflow orchestration
│   └── NewEmployee/           # New employee workflow engine
│
├── ADMIN/                     # Admin tools & templates
│   ├── Dashboard/             # Master tracker dashboard
│   ├── WorkflowBuilder/       # Workflow builder UI
│   └── Templates/             # Templates for creating new forms
│
├── docs/                      # Documentation
│   ├── setup/                 # Setup guides
│   ├── planning/              # Feature planning (13 features)
│   └── testing/               # Testing workflows
│
└── archive/                   # Old/deprecated files
```

---

## 🎯 Projects in This Repository

### 1. Employee Request Forms
**Location:** `FORMS/EmployeeRequestForms/`
**Purpose:** Complete new employee onboarding workflow

**Forms (10 total):**
- **InitialRequest** - Initial new hire request form
- **HR** - HR onboarding tasks
- **IT** - IT provisioning (laptop, email, accounts)
- **Fleetio** - Vehicle management
- **CreditCard** - Corporate credit card requests
- **Review306090** - 30/60/90 day performance reviews
- **ADP_Supervisor** - ADP supervisor access
- **ADP_Manager** - ADP manager access
- **Jonas** - JONAS ERP access
- **SiteDocs** - Safety training documentation

**Shared Components:**
- Validation system (rules, engine, UI helpers)
- UI components (toasts, loading, error handling, confirmations)
- Workflow management
- Professional styling with dark/light themes

### 2. New Employee Workflow
**Location:** `WORKFLOWS/NewEmployee/`
**Purpose:** Orchestrate 10-step new employee onboarding process

**Features:**
- Workflow builder and tracker
- Email notifications
- Task management
- Progress tracking
- Due date monitoring

### 3. Admin Dashboard
**Location:** `ADMIN/Dashboard/`
**Purpose:** Master tracker for all workflows

**Features:**
- View all workflows
- Filter by status, date, site
- Send reminder emails
- Bulk operations
- Export capabilities

---

## 🚀 Quick Start

### For Developers

```bash
# Clone repository
git clone https://github.com/danieljbinns/APP-SCRIPT-FORMS.git
cd APP-SCRIPT-FORMS

# Explore structure
ls FORMS/EmployeeRequestForms/forms/     # See all 10 forms
ls FORMS/EmployeeRequestForms/scripts/   # See shared modules
ls WORKFLOWS/NewEmployee/                # See workflow engine
```

### Creating a New Form

```bash
# 1. Create form folder
mkdir FORMS/EmployeeRequestForms/forms/NewForm

# 2. Copy template validator
cp ADMIN/Templates/template.form-validator.js \
   FORMS/EmployeeRequestForms/forms/NewForm/newform.validator.js

# 3. Create form files
cd FORMS/EmployeeRequestForms/forms/NewForm
touch Form.html Code.gs Config.gs README.md

# 4. See ADMIN/Templates/template.README.md for complete instructions
```

---

## 📝 Naming Convention

### ✅ Shared Modules (Generic, reusable)
**Format:** `shared.module-name.ext`

Examples:
- `shared.validation-engine.js` - Generic validation engine
- `shared.toast-notifications.js` - Generic toast system
- `shared.notifications.css` - Generic notification styles

**Location:** Project-level `scripts/` or `styles/` folders

### ❌ Form-Specific Modules (Only for one form)
**Format:** `formname.module-name.ext`

Examples:
- `initialrequest.workflow-validator.js` - InitialRequest validator
- `hr.config.js` - HR form configuration
- `it.helper.js` - IT-specific helper functions

**Location:** Inside individual form folders

### 📋 Template Files (Copy & customize)
**Format:** `template.module-name.ext`

Examples:
- `template.form-validator.js` - Validator template
- `template.config.js` - Config template

**Location:** `ADMIN/Templates/`

---

## 🏗️ Architecture

### Modular Design
- **Shared modules** - Used by ALL forms (validation, UI, workflow)
- **Form-specific modules** - Custom logic per form
- **DRY principle** - Write once, use everywhere

### Example: How Forms Use Shared Modules

```html
<!-- forms/HR/Form.html -->
<head>
  <!-- Shared CSS from project level -->
  <link rel="stylesheet" href="../../styles/shared.main.css">
  <link rel="stylesheet" href="../../styles/shared.validation.css">

  <!-- Shared scripts from project level -->
  <script src="../../scripts/validation/shared.validation-engine.js"></script>
  <script src="../../scripts/ui/shared.toast-notifications.js"></script>

  <!-- Form-specific validator (in this folder) -->
  <script src="hr.validator.js"></script>
</head>
```

**Benefits:**
- ✅ One stylesheet used by 10 forms
- ✅ Update validation once, all forms benefit
- ✅ Forms stay lightweight and fast
- ✅ Consistent UX across all forms

---

## 📚 Documentation

### Essential Guides
- **`COMPLETE_AUDIT_AND_REORGANIZATION.md`** - Full structure explanation
- **`MODULE_PLACEMENT_GUIDE.md`** - What goes where and why
- **`ADMIN/Templates/template.README.md`** - Creating new forms
- **`START_NEW_SESSION_HERE.md`** - Continue development guide

### Setup Guides
- **`docs/setup/GAM7_SETUP_MASTER_GUIDE.md`** - GAM7 configuration
- **`docs/setup/GOOGLE_DRIVE_SETUP.md`** - Google Drive setup
- **`WORKFLOWS/NewEmployee/REVIEW_PROCESS.md`** - Testing workflow (7 phases)

### Planning & Development
- **`docs/planning/00-MASTER-PLAN.md`** - 13-feature roadmap
- **`docs/testing/WEEKLY_REVIEW_PLAN.md`** - Week-long testing plan

---

## ✨ Features

### Implemented (Stream A + Stream B)
- ✅ 10-step workflow tracking system
- ✅ Professional error handling & validation
- ✅ Real-time form validation with UI feedback
- ✅ Toast notifications system
- ✅ Loading overlays for async operations
- ✅ Confirmation dialogs
- ✅ Dark/light theme toggle
- ✅ Email notification system
- ✅ Google Groups integration
- ✅ Shared Drive integration
- ✅ Master tracker dashboard
- ✅ Workflow builder UI

### Planned (P1-P3 Features)
- 📋 P1-03: Mobile responsive design
- 📋 P1-04: Export functionality (CSV, Excel, PDF)
- 📋 P2: Search optimization, saved filters, bulk actions
- 📋 P3: Analytics dashboard, workflow templates, undo/redo

See `docs/planning/00-MASTER-PLAN.md` for complete roadmap.

---

## 🛠️ Technology Stack

- **Google Apps Script** - Server-side JavaScript
- **HTML5/CSS3** - Modern web standards
- **Vanilla JavaScript** - No frameworks (fast, lightweight)
- **Google Drive API** - File storage
- **Google Sheets API** - Data storage
- **Gmail API** - Email notifications
- **GAM7** - Google Workspace administration

---

## 📊 Project Stats

### Code Organization
- **10 forms** - All modular and reusable
- **13 shared modules** - ~4,000 lines
- **3 core workflows** - Workflow builder, tracker, manager
- **17 planning documents** - Complete feature roadmap

### File Structure
- **6 root folders** - Clean, logical organization
- **Modular architecture** - Scalable for future forms/workflows
- **Clear naming** - `shared.*`, `formname.*`, `template.*`

---

## 🤝 Contributing

### Adding a New Form

1. Create form folder in `FORMS/EmployeeRequestForms/forms/`
2. Copy template validator from `ADMIN/Templates/`
3. Use shared modules from `scripts/` and `styles/`
4. Follow naming convention: `formname.module.ext`
5. See `ADMIN/Templates/template.README.md` for details

### Modifying Shared Modules

1. Test changes don't break existing forms
2. Update module documentation
3. Notify team of breaking changes
4. All 10 forms will inherit changes

---

## 📧 Support & Questions

### Documentation
- Start with: `START_NEW_SESSION_HERE.md`
- Architecture: `COMPLETE_AUDIT_AND_REORGANIZATION.md`
- Module placement: `MODULE_PLACEMENT_GUIDE.md`

### Testing
- Testing workflow: `WORKFLOWS/NewEmployee/REVIEW_PROCESS.md`
- Weekly plan: `docs/testing/WEEKLY_REVIEW_PLAN.md`

---

## 🎉 Key Benefits

### For Developers
- ✅ **Clear structure** - Know exactly where everything goes
- ✅ **Modular design** - Reuse code, don't duplicate
- ✅ **Easy to extend** - Templates make new forms quick
- ✅ **Well documented** - Comprehensive guides

### For Users
- ✅ **Consistent UX** - All forms look and behave the same
- ✅ **Professional UI** - Modern, polished design
- ✅ **Reliable** - Error handling and validation built-in
- ✅ **Fast** - Lightweight, optimized code

### For Business
- ✅ **Scalable** - Easy to add new forms/workflows
- ✅ **Maintainable** - Update once, benefit everywhere
- ✅ **Professional** - Enterprise-grade quality
- ✅ **Cost-effective** - Built on Google Workspace (no extra cost)

---

## 📈 Roadmap

### Short Term (P1)
- Mobile responsive design
- Export functionality

### Medium Term (P2)
- Advanced filtering and search
- Bulk operations

### Long Term (P3)
- Analytics dashboard
- Workflow templates
- Advanced features (undo/redo, comments)

See `docs/planning/00-MASTER-PLAN.md` for complete roadmap.

---

## 📜 License

Copyright © 2025 Team Group Companies. All rights reserved.

---

**Built with ❤️ for Team Group Companies**
