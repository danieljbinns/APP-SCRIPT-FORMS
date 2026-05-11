# Project Status & Roadmap

**Date:** 2026-02-20
**Version:** V24
**Architecture:** V2 (Consolidated Single-Project)

---

## 🟢 Current State

The system is **fully functional** and deployed using the V2 architecture. It successfully handles the end-to-end employee onboarding workflow.

### Core Capabilities

* **Unified Workflow Engine**: Single `workflowId` tracks progress across all stages.
* **Routing Logic**:
  * **Salary**: Request -> ID -> HR -> IT -> Specialists.
  * **Hourly (No System)**: Request -> ID -> HR -> Complete.
* **Dashboard**: Centralized view of all active and completed workflows.
* **Robustness**: Error handling added for missing data, null responses, and concurrency issues.
* **Standardization**: All forms use a consistent UI/UX.

### Forms Implemented

1. **Initial Request**: Starts the workflow.
2. **Dashboard**: view status.
3. **ID Setup**: Generates Employee ID & DSS credentials.
4. **HR Verification**: Captures ADP ID, verifies hire dat.
5. **IT Setup**: Assigns Email, Computer, Phone, Access.
6. **Specialist Confirmations** (x6): Credit Card, Business Cards, Fleetio, Jonas, SiteDocs, 30/60/90.

---

## 🟡 Known Limitations

These are intentional design choices or current constraints:

1. **Generic Specialist Forms**: The 6 specialist forms currently use a standardized "Confirm Complete + Notes" interface. They do **not** capture specific fields (e.g., `Card Type` for Credit Cards, `Driver License` for Fleetio) as these were replaced with the simpler confirmation model for V2 launch.
2. **No "Edit" Workflow**: Once a form is submitted, data is written to the results sheet. There is no UI to "Edit" a previous submission (must be done in Google Sheets directly).
3. **Security Model**: Implements Role-Based Access Control (RBAC) via Google Groups.

* **Global Admins/IT**: Access controlled by `grp.forms.it@team-group.com`.
* **HR**: Access controlled by `grp.forms.hr@team-group.com`.
* **Individuals**: Requesters and Managers have visibility limited to their specific workflows.
* **Service Bypasses**: Hardcoded bypasses for system accounts and lead developer.

1. **Dashboard Scaling**: The dashboard loads *all* workflows (last 500 rows). As the dataset searches 10,000+ rows, pagination logic will be needed.

---

## 📋 Remaining Known Items (Roadmap)

### High Priority

* [ ] **Customize Specialist Forms**: Re-introduce specific fields for Credit Cards and Fleetio if "Confirm Complete" proves insufficient for business needs.
* [ ] **Email Polish**: Enhance email templates with better branding or HTML layouts (currently functional but basic).

### Medium Priority

* [ ] **Dashboard Enhancements**: Add "Date Range" filters and CSV export.
* [ ] **Retry Logic**: Add a "Resend Email" button on the Dashboard for stuck workflows.

### Low Priority / Future

* [ ] **Google Admin Integration**: Automate actual Google Workspace account creation (currently manual IT task).
* [ ] **ADP Integration**: Automate ADP ID creation via API (currently manual HR task).
