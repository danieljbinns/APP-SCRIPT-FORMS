# Revised Repository Structure - Modular & Reusable

## Key Principle: Modular, Reusable Components
- **Styles & Scripts** - Shared libraries at project level
- **Forms** - Only form-specific .html, Code.gs, Config.gs, README
- **No duplication** - One stylesheet used by many forms

## Proposed Clean Structure

```
APP-SCRIPT-FORMS/                          # Container for ALL Apps Script projects
│
├── FORMS/                                 # All form projects
│   │
│   ├── EmployeeRequestForms/              # NEW EMPLOYEE REQUEST project
│   │   │
│   │   ├── styles/                        # Shared stylesheets for this project
│   │   │   ├── main.css                   # Main stylesheet
│   │   │   ├── form-layout.css            # Form layout styles
│   │   │   ├── notifications.css          # Toast/notification styles
│   │   │   ├── validation.css             # Validation UI styles
│   │   │   └── theme-toggle.css           # Dark/light theme
│   │   │
│   │   ├── scripts/                       # Shared JS modules for this project
│   │   │   ├── validation/                # Validation modules
│   │   │   │   ├── validation-rules.js
│   │   │   │   ├── validation-engine.js
│   │   │   │   ├── workflow-validator.js
│   │   │   │   └── form-validator.js
│   │   │   │
│   │   │   ├── ui/                        # UI component modules
│   │   │   │   ├── toast-notifications.js
│   │   │   │   ├── loading-overlay.js
│   │   │   │   ├── error-handler.js
│   │   │   │   ├── confirmation-dialog.js
│   │   │   │   └── theme-toggle.js
│   │   │   │
│   │   │   └── workflow-manager.js        # Workflow management logic
│   │   │
│   │   ├── forms/                         # Individual forms (form-specific only)
│   │   │   ├── InitialRequest/
│   │   │   │   ├── index.html             # Form HTML (includes styles/scripts via <link>/<script>)
│   │   │   │   ├── Code.gs                # Form-specific logic
│   │   │   │   ├── Config.gs              # Form-specific config
│   │   │   │   └── README.md              # Form-specific docs
│   │   │   │
│   │   │   ├── HR/
│   │   │   │   ├── Form.html
│   │   │   │   ├── Code.gs
│   │   │   │   ├── Config.gs
│   │   │   │   ├── placeholder.HRForm.html
│   │   │   │   └── README.md
│   │   │   │
│   │   │   ├── IT/
│   │   │   ├── Fleetio/
│   │   │   ├── CreditCard/
│   │   │   ├── Review306090/
│   │   │   ├── ADP_Supervisor/
│   │   │   ├── ADP_Manager/
│   │   │   ├── Jonas/
│   │   │   └── SiteDocs/
│   │   │
│   │   └── README.md                      # Project-level documentation
│   │
│   └── [Future form projects: Termination, Promotion, etc.]
│
├── WORKFLOWS/                             # Workflow definitions & orchestration
│   │
│   ├── NewEmployee/                       # New employee onboarding workflow
│   │   │
│   │   ├── styles/                        # Workflow-specific styles (if needed)
│   │   │   └── dashboard.css
│   │   │
│   │   ├── scripts/                       # Workflow-specific scripts
│   │   │   ├── workflow-builder.js
│   │   │   └── workflow-tracker.js
│   │   │
│   │   ├── WorkflowBuilder.gs             # Workflow creation
│   │   ├── WorkflowTracker.gs             # Tracking logic
│   │   ├── WorkflowConfig.gs              # Workflow config
│   │   ├── Code.gs                        # Main routing
│   │   ├── Config.gs                      # Configuration
│   │   ├── Setup.gs                       # Setup functions
│   │   ├── EmailUtils.gs                  # Email notifications
│   │   ├── .clasp.json                    # Deployment config
│   │   ├── appsscript.json                # OAuth scopes
│   │   ├── ARCHITECTURE.md                # Workflow design docs
│   │   ├── REVIEW_PROCESS.md              # Testing guide
│   │   └── README.md
│   │
│   └── [Future: Termination/, Promotion/, etc.]
│
├── ADMIN/                                 # Admin tools, dashboards, builders
│   │
│   ├── Dashboard/                         # Master tracker dashboard
│   │   ├── styles/
│   │   │   └── dashboard.css
│   │   ├── scripts/
│   │   │   └── dashboard.js
│   │   ├── admin-dashboard.html
│   │   ├── MasterTrackerDashboard.gs
│   │   ├── DynamicDashboard.gs
│   │   └── README.md
│   │
│   ├── WorkflowBuilder/                   # Workflow builder tool
│   │   ├── styles/
│   │   ├── scripts/
│   │   ├── WorkflowBuilderUI.html
│   │   ├── WorkflowTrackerUI.html
│   │   └── README.md
│   │
│   └── Templates/                         # Templates for creating new forms/workflows
│       ├── FormTemplate.html
│       ├── CodeTemplate.gs
│       ├── ConfigTemplate.gs
│       └── README.md
│
├── docs/                                  # Repository-level documentation
│   ├── setup/                             # Setup guides
│   │   ├── GAM7_SETUP_MASTER_GUIDE.md
│   │   ├── GOOGLE_DRIVE_SETUP.md
│   │   └── DEPLOYMENT_GUIDE.md
│   │
│   ├── planning/                          # Feature planning
│   │   ├── 00-MASTER-PLAN.md
│   │   ├── 01-error-handling-feedback.md
│   │   ├── 02-data-validation.md
│   │   └── [all planning docs]
│   │
│   └── testing/                           # Testing documentation
│       ├── WEEKLY_REVIEW_PLAN.md
│       └── ERROR_HANDLING_TEST_PLAN.md
│
├── archive/                               # Old/deprecated files
│   ├── WMAR/                              # Old WMAR workflow (deprecated)
│   ├── OLD_DEPLOYMENT/
│   └── old-docs/
│
├── README.md                              # Main repo README
├── ARCHITECTURE.md                        # Overall architecture
├── GETTING_STARTED.md                     # Quick start guide
└── .gitignore
```

## Key Concepts

### 1. **Project-Level Shared Resources**
Each major project (like EmployeeRequestForms) has:
- **`styles/`** - Shared CSS used by ALL forms in this project
- **`scripts/`** - Shared JS modules used by ALL forms in this project
- **`forms/`** - Individual forms that USE those shared resources

**Example:**
```html
<!-- FORMS/EmployeeRequestForms/forms/InitialRequest/index.html -->
<link rel="stylesheet" href="../../styles/main.css">
<link rel="stylesheet" href="../../styles/notifications.css">
<script src="../../scripts/ui/toast-notifications.js"></script>
<script src="../../scripts/validation/validation-engine.js"></script>
```

### 2. **Forms Contain ONLY Form-Specific Files**
Each form folder has ONLY:
- ✅ `.html` file (the form itself)
- ✅ `Code.gs` (form-specific server-side logic)
- ✅ `Config.gs` (form-specific configuration)
- ✅ `README.md` (form-specific documentation)
- ✅ Optional: `placeholder.*.html` (for testing)

**NO duplicate stylesheets or scripts!**

### 3. **Modular & Reusable**
```
One stylesheet (styles/main.css)
  → Used by: InitialRequest, HR, IT, Fleetio, etc.

One validation module (scripts/validation/validation-engine.js)
  → Used by: All 10 forms

One toast notification module (scripts/ui/toast-notifications.js)
  → Used by: All forms that need notifications
```

### 4. **Form-Specific Code ONLY When Needed**
If a form needs something unique:
```javascript
// FORMS/EmployeeRequestForms/forms/IT/Code.gs
// IT-specific logic that ONLY IT form needs

function validateITSpecificField() {
  // This function is ONLY in IT form
}
```

But it still uses shared validation:
```html
<!-- FORMS/EmployeeRequestForms/forms/IT/Form.html -->
<script src="../../scripts/validation/validation-engine.js"></script>
<script>
  // Use shared validation engine
  ValidationEngine.validate(data, schema);
</script>
```

## What Gets Moved Where

### Current → New Structure

**Individual Forms:**
```
FORM_HR/                          → FORMS/EmployeeRequestForms/forms/HR/
FORM_IT/                          → FORMS/EmployeeRequestForms/forms/IT/
FORM_FLEETIO/                     → FORMS/EmployeeRequestForms/forms/Fleetio/
FORM_CREDITCARD/                  → FORMS/EmployeeRequestForms/forms/CreditCard/
FORM_REVIEW306090/                → FORMS/EmployeeRequestForms/forms/Review306090/
FORM_ADP_SUPERVISOR/              → FORMS/EmployeeRequestForms/forms/ADP_Supervisor/
FORM_ADP_MANAGER/                 → FORMS/EmployeeRequestForms/forms/ADP_Manager/
FORM_JONAS/                       → FORMS/EmployeeRequestForms/forms/Jonas/
FORM_SITEDOCS/                    → FORMS/EmployeeRequestForms/forms/SiteDocs/
DEMO/index.html                   → FORMS/EmployeeRequestForms/forms/InitialRequest/index.html
```

**Shared Styles & Scripts:**
```
DEMO/shared/validation-*.js       → FORMS/EmployeeRequestForms/scripts/validation/
DEMO/shared/toast-notifications.js → FORMS/EmployeeRequestForms/scripts/ui/
DEMO/shared/loading-overlay.js    → FORMS/EmployeeRequestForms/scripts/ui/
DEMO/shared/error-handler.js      → FORMS/EmployeeRequestForms/scripts/ui/
DEMO/shared/confirmation-dialog.js → FORMS/EmployeeRequestForms/scripts/ui/
DEMO/shared/theme-toggle.js       → FORMS/EmployeeRequestForms/scripts/ui/
DEMO/shared/workflow-manager.js   → FORMS/EmployeeRequestForms/scripts/
DEMO/shared/*.css                  → FORMS/EmployeeRequestForms/styles/
```

**Workflow Files:**
```
REQUEST_FORMS/WorkflowBuilder.gs  → WORKFLOWS/NewEmployee/WorkflowBuilder.gs
REQUEST_FORMS/WorkflowTracker.gs  → WORKFLOWS/NewEmployee/WorkflowTracker.gs
REQUEST_FORMS/WorkflowConfig.gs   → WORKFLOWS/NewEmployee/WorkflowConfig.gs
REQUEST_FORMS/Code.gs             → WORKFLOWS/NewEmployee/Code.gs
REQUEST_FORMS/Config.gs           → WORKFLOWS/NewEmployee/Config.gs
REQUEST_FORMS/Setup.gs            → WORKFLOWS/NewEmployee/Setup.gs
REQUEST_FORMS/EmailUtils.gs       → WORKFLOWS/NewEmployee/EmailUtils.gs
REQUEST_FORMS/.clasp.json         → WORKFLOWS/NewEmployee/.clasp.json
REQUEST_FORMS/appsscript.json     → WORKFLOWS/NewEmployee/appsscript.json
```

**Admin/Dashboard:**
```
REQUEST_FORMS/MasterTrackerDashboard.gs → ADMIN/Dashboard/MasterTrackerDashboard.gs
REQUEST_FORMS/DynamicDashboard.gs       → ADMIN/Dashboard/DynamicDashboard.gs
REQUEST_FORMS/WorkflowBuilderUI.html    → ADMIN/WorkflowBuilder/WorkflowBuilderUI.html
REQUEST_FORMS/WorkflowTrackerUI.html    → ADMIN/WorkflowBuilder/WorkflowTrackerUI.html
DEMO/admin-dashboard.html               → ADMIN/Dashboard/admin-dashboard.html
```

**Documentation:**
```
DEMO/planning/*.md                → docs/planning/
docs/WEEKLY_REVIEW_PLAN.md        → docs/testing/WEEKLY_REVIEW_PLAN.md
REQUEST_FORMS/REVIEW_PROCESS.md   → WORKFLOWS/NewEmployee/REVIEW_PROCESS.md
```

**Archive:**
```
WMAR/                             → archive/WMAR/
REQUEST_FORMS/OLD_DEPLOYMENT/     → archive/OLD_DEPLOYMENT/
```

## Benefits

✅ **DRY (Don't Repeat Yourself)** - One stylesheet, used by all forms
✅ **Modular** - Scripts are reusable components
✅ **Scalable** - Easy to add new forms (just add folder, reuse scripts/styles)
✅ **Clean Separation** - Form-specific vs. shared resources is crystal clear
✅ **Maintainable** - Update validation once, all forms benefit
✅ **Professional** - Industry-standard monorepo with shared libraries
✅ **Clean Root** - Only 6 folders: FORMS, WORKFLOWS, ADMIN, docs, archive, .git
✅ **No Duplication** - No more copying CSS/JS to every form

## Example: How Forms Reference Shared Resources

```html
<!-- FORMS/EmployeeRequestForms/forms/HR/Form.html -->
<!DOCTYPE html>
<html>
<head>
  <!-- Shared styles from project level -->
  <link rel="stylesheet" href="../../styles/main.css">
  <link rel="stylesheet" href="../../styles/notifications.css">
  <link rel="stylesheet" href="../../styles/validation.css">

  <!-- Shared scripts from project level -->
  <script src="../../scripts/ui/toast-notifications.js"></script>
  <script src="../../scripts/ui/loading-overlay.js"></script>
  <script src="../../scripts/validation/validation-engine.js"></script>
  <script src="../../scripts/validation/form-validator.js"></script>
</head>
<body>
  <!-- HR form content here -->
  <form id="hrForm">
    <!-- Form fields -->
  </form>

  <script>
    // Use shared modules
    ToastManager.init();
    FormValidator.init('#hrForm');
  </script>
</body>
</html>
```

## Next Steps

1. Create new folder structure
2. Move files to new locations
3. Update HTML files to reference shared resources with correct paths
4. Test that forms still load shared CSS/JS
5. Commit reorganization

**Is this structure what you want?** The key difference:
- Shared `styles/` and `scripts/` at PROJECT level (EmployeeRequestForms)
- Individual `forms/` folders contain ONLY form-specific files
- Forms reference shared resources via relative paths
