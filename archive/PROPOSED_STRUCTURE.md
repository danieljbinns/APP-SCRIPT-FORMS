# Proposed Repository Structure

## Current Problem
- Too many folders at root (15+)
- Unclear organization
- FORM_* folders scattered at root
- Mixing forms, workflows, demos, and admin tools
- WMAR is old name, confusing
- DEMO has the new initial request form (index.html)

## Proposed Clean Structure

```
APP-SCRIPT-FORMS/                          # Container for ALL Apps Script projects
│
├── FORMS/                                 # All individual form projects
│   ├── InitialRequest/                    # NEW EMPLOYEE initial request form
│   │   ├── index.html                     # Main form (from DEMO/index.html)
│   │   ├── Code.gs                        # Form logic
│   │   ├── Config.gs                      # Form config
│   │   ├── styles/                        # CSS files
│   │   ├── scripts/                       # JS modules
│   │   ├── .clasp.json                    # Deployment config
│   │   └── README.md                      # Form-specific docs
│   │
│   ├── HR/                                # HR onboarding form
│   │   ├── Form.html
│   │   ├── placeholder.HRForm.html        # Testing placeholder
│   │   ├── Code.gs
│   │   ├── Config.gs
│   │   └── README.md
│   │
│   ├── IT/                                # IT provisioning form
│   ├── Fleetio/                           # Vehicle management
│   ├── CreditCard/                        # Credit card requests
│   ├── Review306090/                      # Performance reviews
│   ├── ADP_Supervisor/                    # ADP supervisor access
│   ├── ADP_Manager/                       # ADP manager access
│   ├── Jonas/                             # JONAS ERP
│   └── SiteDocs/                          # Safety training
│
├── WORKFLOWS/                             # Workflow definitions & orchestration
│   ├── NewEmployee/                       # New employee onboarding workflow
│   │   ├── WorkflowBuilder.gs             # Workflow creation
│   │   ├── WorkflowTracker.gs             # Tracking logic
│   │   ├── WorkflowConfig.gs              # Workflow config
│   │   ├── EmailUtils.gs                  # Email notifications
│   │   ├── ARCHITECTURE.md                # Workflow design docs
│   │   ├── REVIEW_PROCESS.md              # Testing guide
│   │   └── README.md
│   │
│   └── [Future workflows: Termination, Promotion, etc.]
│
├── ADMIN/                                 # Admin tools, dashboards, builders
│   ├── Dashboard/                         # Master tracker dashboard
│   │   ├── MasterTrackerDashboard.gs
│   │   ├── DynamicDashboard.gs
│   │   ├── admin-dashboard.html
│   │   └── README.md
│   │
│   ├── WorkflowBuilder/                   # Workflow builder tool
│   │   ├── WorkflowBuilderUI.html
│   │   ├── WorkflowTrackerUI.html
│   │   └── README.md
│   │
│   └── Shared/                            # Shared utilities for all forms
│       ├── validation/                    # Validation modules
│       │   ├── validation-rules.js
│       │   ├── validation-engine.js
│       │   ├── workflow-validator.js
│       │   ├── form-validator.js
│       │   └── validation.css
│       │
│       ├── ui/                            # UI components
│       │   ├── toast-notifications.js
│       │   ├── loading-overlay.js
│       │   ├── error-handler.js
│       │   ├── confirmation-dialog.js
│       │   ├── theme-toggle.js
│       │   └── notifications.css
│       │
│       └── templates/                     # Form templates for new projects
│           ├── FormTemplate.html
│           ├── CodeTemplate.gs
│           └── ConfigTemplate.gs
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

## Key Changes

### 1. FORMS/ Folder - All Individual Forms
- **InitialRequest/** - The NEW initial form (from DEMO/index.html)
- **HR/, IT/, Fleetio/, etc.** - All 9 sub-forms in clean named folders
- Each form is self-contained with its own scripts, styles, docs
- No more FORM_* prefix pollution at root

### 2. WORKFLOWS/ Folder - Workflow Orchestration
- **NewEmployee/** - The complete workflow system
  - All WorkflowBuilder, WorkflowTracker, etc. files
  - Email utilities
  - Workflow-specific documentation
- Ready for future workflows (Termination, Promotion, Transfer)

### 3. ADMIN/ Folder - Admin Tools & Shared Resources
- **Dashboard/** - Master tracker dashboard
- **WorkflowBuilder/** - Workflow builder UI
- **Shared/** - Shared utilities used by ALL forms:
  - Validation modules (from DEMO/shared/)
  - UI components (toast, loading, error handling)
  - Templates for creating new forms

### 4. docs/ - Repository Documentation
- **setup/** - Setup guides (GAM7, Google Drive, deployment)
- **planning/** - Feature planning documents
- **testing/** - Testing workflows

### 5. archive/ - Old/Deprecated
- **WMAR/** - Old workflow name (deprecated)
- **OLD_DEPLOYMENT/** - Old deployment artifacts
- No clutter at root

## What Gets Moved Where

### From Current Root → FORMS/
```
FORM_HR/                  → FORMS/HR/
FORM_IT/                  → FORMS/IT/
FORM_FLEETIO/             → FORMS/Fleetio/
FORM_CREDITCARD/          → FORMS/CreditCard/
FORM_REVIEW306090/        → FORMS/Review306090/
FORM_ADP_SUPERVISOR/      → FORMS/ADP_Supervisor/
FORM_ADP_MANAGER/         → FORMS/ADP_Manager/
FORM_JONAS/               → FORMS/Jonas/
FORM_SITEDOCS/            → FORMS/SiteDocs/
DEMO/index.html           → FORMS/InitialRequest/index.html
DEMO/admin-dashboard.html → ADMIN/Dashboard/admin-dashboard.html
```

### From REQUEST_FORMS/ → WORKFLOWS/NewEmployee/
```
REQUEST_FORMS/WorkflowBuilder.gs    → WORKFLOWS/NewEmployee/WorkflowBuilder.gs
REQUEST_FORMS/WorkflowTracker.gs    → WORKFLOWS/NewEmployee/WorkflowTracker.gs
REQUEST_FORMS/WorkflowConfig.gs     → WORKFLOWS/NewEmployee/WorkflowConfig.gs
REQUEST_FORMS/EmailUtils.gs         → WORKFLOWS/NewEmployee/EmailUtils.gs
REQUEST_FORMS/REVIEW_PROCESS.md     → WORKFLOWS/NewEmployee/REVIEW_PROCESS.md
REQUEST_FORMS/Code.gs               → WORKFLOWS/NewEmployee/Code.gs
REQUEST_FORMS/Config.gs             → WORKFLOWS/NewEmployee/Config.gs
REQUEST_FORMS/Setup.gs              → WORKFLOWS/NewEmployee/Setup.gs
```

### From REQUEST_FORMS/ → ADMIN/
```
REQUEST_FORMS/MasterTrackerDashboard.gs  → ADMIN/Dashboard/MasterTrackerDashboard.gs
REQUEST_FORMS/DynamicDashboard.gs        → ADMIN/Dashboard/DynamicDashboard.gs
REQUEST_FORMS/WorkflowBuilderUI.html     → ADMIN/WorkflowBuilder/WorkflowBuilderUI.html
REQUEST_FORMS/WorkflowTrackerUI.html     → ADMIN/WorkflowBuilder/WorkflowTrackerUI.html
```

### From DEMO/shared/ → ADMIN/Shared/
```
DEMO/shared/validation-*.js       → ADMIN/Shared/validation/
DEMO/shared/toast-notifications.js → ADMIN/Shared/ui/
DEMO/shared/loading-overlay.js    → ADMIN/Shared/ui/
DEMO/shared/error-handler.js      → ADMIN/Shared/ui/
DEMO/shared/confirmation-dialog.js → ADMIN/Shared/ui/
DEMO/shared/theme-toggle.js       → ADMIN/Shared/ui/
DEMO/shared/*.css                  → ADMIN/Shared/ui/ or /validation/
```

### From DEMO/planning/ → docs/planning/
```
DEMO/planning/*.md → docs/planning/
```

### From root docs/ → docs/
```
docs/WEEKLY_REVIEW_PLAN.md → docs/testing/WEEKLY_REVIEW_PLAN.md
docs/setup/*               → docs/setup/ (keep)
```

### To archive/
```
WMAR/             → archive/WMAR/
REQUEST_FORMS/OLD_DEPLOYMENT/ → archive/OLD_DEPLOYMENT/
```

## Benefits

✅ **Clean Root** - Only 6 folders: FORMS, WORKFLOWS, ADMIN, docs, archive, .git
✅ **Logical Grouping** - Forms together, workflows together, admin tools together
✅ **Scalable** - Easy to add new forms or workflows
✅ **Self-Contained** - Each form has everything it needs in its folder
✅ **Shared Resources** - ADMIN/Shared/ for validation, UI components used by all
✅ **Clear Purpose** - Each top-level folder has a clear, singular purpose
✅ **No More Confusion** - WMAR in archive, InitialRequest is the current form name
✅ **Professional** - Industry-standard monorepo organization

## Next Steps

1. Create new folder structure
2. Move files to new locations
3. Update any hardcoded paths in code
4. Test that everything still works
5. Commit reorganization
6. Update all documentation

Should I proceed with this reorganization?
