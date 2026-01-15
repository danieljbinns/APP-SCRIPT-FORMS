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

---

## 📖 Deployment Guide

For a step-by-step guide on how to update or deploy new versions of these scripts, refer to the `PASTE_DEPLOY_GUIDE.md` (if maintained) or follow the standard **Deploy > New Deployment** process in Google Apps Script.
