# FORMS Folder

## Purpose
Container for all form collections organized by workflow or purpose.

## Structure
```
FORMS/
└── EmployeeRequestForms/
    ├── forms/           (Individual task forms)
    ├── scripts/         (Shared scripts)
    └── styles/          (Shared styles)
```

## Current Contents

### EmployeeRequestForms/
Collection of all forms related to the New Employee Workflow.

#### Forms (EmployeeRequestForms/forms/):
1. **InitialRequest** - Main workflow initiator form
2. **HR** - HR Setup task form
3. **IT** - IT Setup task form
4. **CreditCard** - Credit Card Request task form
5. **Fleetio** - Fleetio/Vehicle Assignment task form
6. **ADP_Manager** - ADP Manager Access task form
7. **ADP_Supervisor** - ADP Supervisor Access task form
8. **Jonas** - JONAS ERP Access task form
9. **Review306090** - 30-60-90 Day Review task form
10. **SiteDocs** - SiteDocs Safety Training task form

Each form folder contains:
- `Code.gs` - Google Apps Script backend logic
- `Config.gs` - Form-specific configuration
- `Setup.gs` - Setup and initialization
- `Form.html` - Main form HTML
- `Styles.html` - Form-specific styles
- `placeholder.*.html` - Placeholder form template
- `appsscript.json` - Apps Script manifest
- `README.md` - Form documentation

#### Shared Resources:
- **scripts/** - Shared JavaScript utilities
- **styles/** - Shared CSS styles

## Important Notes
✅ **This is the CORRECT and CURRENT location for all forms** (updated Dec 9, 2025)

❌ **Old duplicates removed:**
- FORM_* folders at root level (deleted Dec 12, 2025)
- These were older versions from Dec 4, 2025

## Design Philosophy
- **Forms folder** = Collection of all forms (organized by purpose/workflow)
- **EmployeeRequestForms** = All forms for employee request workflow
- **Future:** Other form collections can be added (e.g., VendorForms, EquipmentForms, etc.)

## Deployment
Each form is a separate Google Apps Script project that can be:
- Deployed independently
- Reused across multiple workflows
- Updated without affecting other forms

See `/PROJECT_PLANNING/WEEKLY_REVIEW_PLAN.md` for deployment strategy.

## Related Folders
- `/DEMO` - UI/UX prototypes and demo materials
- `/PROJECT_PLANNING` - Planning, documentation, deployment strategy
- `/archive` - Deprecated/legacy code

---
**Structure Confirmed:** 2025-12-12
**Status:** Active - primary location for all form implementations
