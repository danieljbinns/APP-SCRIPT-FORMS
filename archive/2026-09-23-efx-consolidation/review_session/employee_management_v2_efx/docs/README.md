# Employee Management Forms V2 - Single Project Architecture

## Overview

This is the **consolidated V2 architecture** for the Team Group Companies Employee Management System. It replaces the legacy multi-project setup with a single, unified Google Apps Script project.

**Current Version:** 23
**Deployment Status:** Active (robinsonsolutions.com domain)

### Key Features

* **Unified Workflow**: Single `workflowId` tracks an employee from Request -> ID -> HR -> IT -> Specialists.
* **Centralized Dashboard**: Real-time status tracking via `Dashboard.html` (form=dashboard).
* **Robust Routing**: Handles distinct paths for Salary vs Hourly (No System Access).
* **Standardized Forms**: All forms use a consistent UI and error handling.
* **Specialist Confirmations**: 6 simplified confirmation forms for support departments.

---

## File Structure

```
employee_management_v2/
├── Config.gs              # Global configuration (Spreadsheet IDs, Email map, URLs)
├── Router.gs              # Main request dispatcher (doGet)
│
├── Handlers/
│   ├── InitialRequestHandler.gs
│   ├── DashboardHandler.gs
│   ├── IDSetup.gs
│   ├── HRVerificationHandler.gs
│   ├── ITSetupHandler.gs
│   └── Specialist.gs
│
├── Utilities/
│   ├── EmailUtils.gs
│   ├── SheetUtils.gs
│   ├── ValidationUtils.gs
│   └── WorkflowManager.gs
│
└── Views (HTML)/
    ├── Dashboard.html
    ├── InitialRequest.html
    ├── EmployeeIDSetup.html
    ├── HRVerification.html
    ├── ITSetup.html
    └── Specialists/
        ├── CreditCard.html
        ├── BusinessCards.html
        ├── Fleetio.html
        ├── Jonas.html
        ├── SiteDocs.html
        └── Review306090.html
```

---

## Access URLs

| Interface | URL Pattern |
|:----------|:------------|
| **Dashboard** | `.../exec?form=dashboard` |
| **New Request** | `.../exec?form=initial_request` |
| **ID Setup** | `.../exec?form=id_setup&wf=[WORKFLOW_ID]` |
| **HR Verification** | `.../exec?form=hr_verification&wf=[WORKFLOW_ID]` |
| **IT Setup** | `.../exec?form=it_setup&wf=[WORKFLOW_ID]` |
| **Specialist** | `.../exec?form=specialist&wf=[WORKFLOW_ID]&dept=[DEPT]` |

---

## Setup & Configuration

1. **Config.gs**: Ensure `SPREADSHEET_ID` points to the V2 Master Sheet.
2. **Deployment**: Ensure `DEPLOYMENT_URL` in `Config.gs` matches the active web app URL to generate correct email links.
3. **Permissions**: Web App must be deployed as `Execute as: Me` and `Access: Anyone` (for internal employee access).

---

## Recent Updates (V13-V23)

* **Fixed Dashboard**: Added null-safety checks for robust loading.
* **Fixed ID Setup**: Added explicit error page if request data is missing.
* **Fixed Routing**: Correctly handles `formId` generation to prevent ReferenceErrors.
* **Standardized Specialists**: Replaced placeholder fields with "Confirm Complete" + Notes interface.
* **Domain Update**: Configured for `robinsonsolutions.com`.

---

## Workflow Paths

### Path A: Salary / System Access

1. **Initial Request** -> Email to ID Setup (SiteDocs)
2. **ID Setup** -> Email to HR
3. **HR Verification** -> Email to IT
4. **IT Setup** -> Emails to 6 Specialists
5. **Specialists** -> Confirm Completion

### Path B: Hourly (No System Access)

1. **Initial Request** -> Email to ID Setup
2. **ID Setup** -> Email to HR (Final Step)
3. **HR Verification** -> Email to Requester (Complete) -> No IT/Specialists involved.
