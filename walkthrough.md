# Employee Request Forms: Project Master Walkthrough

This document provides a complete overview of the Employee Onboarding & Request System.

## 📁 Project Structure

All active deployment code is located in the `employee_forms_deployment/` directory:

- `new_employee_request/`: The initial entry point.
- `employee_id_setup/`: HR gatekeeper form (IDs, Payroll).
- `it_setup/`: IT provisioning (Email, Hardware, BOSS).
- `specialist_placeholder/`: Generic form for remaining 7 departments (ADP, Jonas, etc.). Includes the **Specialist Forms Roadmap & Checklist**.
- `admin_dashboard/`: The "Employee Request Dashboard" for management.

---

## 🚀 The Core Workflow

The system uses a "Sequential Gating" logic to ensure data quality:

1. **Initial Submission**: A manager submits the first request.
2. **HR Logic**: Only once HR completes the ID setup does the system notify IT.
3. **IT Logic**: Only once IT completes the hardware/account setup are the Specialist emails triggered.
4. **Specialists**: ADP, Jonas, Fleetio, etc., receive links to pre-filled forms to finalize their setup.

---

## 📊 The Employee Request Dashboard

A premium, dark-mode portal for tracking every hire:

- **Main Grid**: Shows employee name, site, submission time, and the staff member currenty handling the request.
- **Filtering**: Search by name, site, or filter by current workflow status (e.g., "In IT Setup").
- **View Details**: A deep-dive page for every employee.
  - **Timeline**: Visual vertical progress bar showing exactly who finished what and when.
  - **Full Data Dump**: Dynamic section that exposes every single detail from every form submitted—nothing is hidden.

---

## 🛠️ Technical Highlights

- **Compatibility**: All UI code is refactored for 100% compatibility with the Google Apps Script sandbox (no modern string literals or non-ASCII characters).
- **Security**: Forms track the identity of the staff member (`Session.getActiveUser()`).
- **Reliability**: Navigation uses the authoritative Public Macro URL to prevent "Iframe Escape" errors.
- **Permissions**: Visibility is restricted based on your role:
  - **Managers & Requesters**: Can see only the employees they are personally involved with.
  - **Admin, IT, & HR Teams**: Have full visibility into all active requests across the organization via Google Group membership (`grp.forms.it@team-group.com` and `grp.forms.hr@team-group.com`).

---

### Version 24 Release (Current)

- **Security Upgrade**: Aligned all permission groups with `@team-group.com` mailing lists.
- **Visibility Fix**: Corrected data mapping so Requesters and Managers can see their specific requests on the dashboard.
- **Email Enhancements**: Added **Assigned Email** and **Job Site #** to the specialist notification emails (specifically for the 30/60/90 review team).
- **Environment Isolation**: Established a "Staging" environment with a dedicated Git branch and Google Apps Script project.
- **Master Email Redirect**: Implemented a global switch (`EMAIL_REDIRECT_ALL`) to safely redirect all system emails to a test address during development.

### Version 19 Release (Previous)

- **Critical Fix**: Resolved a syntax error in the Dashboard ("Unexpected token") that prevented the details view from loading.

### Version 18 Release (Previous)

- **Bug Fix**: Fixed "BOSS Committees" dropdown incorrectly showing the "Sites" list (Column A). It now correctly shows only the "Committees" list (Column F) as intended.

### Version 16 Release (Previous)

## 📖 Deployment Guide

For a step-by-step guide on how to update or deploy new versions of these scripts, refer to the `PASTE_DEPLOY_GUIDE.md` (if maintained) or follow the standard **Deploy > New Deployment** process in Google Apps Script.
