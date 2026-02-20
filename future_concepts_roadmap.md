# Future Concepts Roadmap

This document outlines "real things" and concepts found in the `_FUTURE_CONCEPTS` directory, representing the future roadmap for the Robinson Solutions application suite.

## 1. Unified Employee Dashboard (Dashboard V.Next)

**Path:** `Previews/preview_DashboardVNext.html`

A high-fidelity, dark-mode re-imagining of the current Admin Dashboard, focusing on operational clarity and speed.

### Key Features

* **Inline Editing**: Update employee status and fields directly from the table without opening a detail view.
* **"Time Open" Metrics**: Dedicated column and conditional formatting (red borders) for requests open longer than 3 days.
* **Resend Functionality**: One-click action to resend stage-specific emails (e.g., resend "IT Setup" email).
* **Dark Mode UI**: Professional, low-strain interface with verified color palettes (`#0c0c0c` background, `#EB1C2D` branding).
* **Optimistic Updates**: Immediate UI feedback while background save operations complete.

---

## 2. Asset & Device Command Center

**Path:** `Previews/preview_AssetManager.html`

A centralized dashboard to visualize hardware and security status across the organization, unifying data from multiple sources.

### Key Features

* **Unified Source of Truth**: Aggregates data from **Google MDM** (Mobile Device Management), **CrowdStrike** (Endpoint Protection), and **Hexnode**.
* **Compliance Tracking**: Visual indicators for sync status, protection status, and policy compliance.
* **Cross-Platform**: Handles Windows, macOS, and Android devices in a single view.
* **Risk Metrics**: Top-level stats for "Vulnerabilities" and "Critical Alerts".

---

## 3. Live Organizational Chart

**Path:** `Previews/preview_OrgChart.html`

A dynamic, automated visualization of the company structure, likely sourced from Google Directory data.

### Key Features

* **Automated Hierarchy**: Visualizes reporting lines (Manager -> Direct Report) automatically.
* **Rich Employee Cards**: Displays profile photo, name, job title, and department codings.
* **Dark Mode Visualization**: Custom styling overrides for the standard Google Charts library to match the application theme.
* **Export Capabilities**: Placeholder functionality to export the chart as a PDF.

---

## 4. Super Admin Tools

**Path:** `Previews/preview_AdminTools.html`

A power-user suite designed for the IT/DevOps team to manage the application and Google Workspace environment without touching code.

### Key Features

* **GAM Console Integration**: A browser-based terminal emulator to run Google Apps Manager (GAM) commands (e.g., `gam info user...`).
* **User Impersonation**: "Launch Session" capability to generate delegation tokens and view the app as another user.
* **Mail Audit**: Search interface for email metadata (Sender, Recipient, Time, Status) to debug notification delivery.
* **Dynamic System Config**: UI-based management of:
  * **Permission Groups**: Define who is in "HR Team", "IT Team", or "Super Admin" groups.
  * **Email Routing**: Change target email addresses for notifications without redeploying code.

---

## 5. Automated Offboarding

**Path:** `Previews/preview_Offboarding.html` & `Handlers/OffboardingHandler.gs`

*[Inferred from file presence]*
A structured workflow for responsibly removing access and recovering assets when an employee leaves.

### Key Features

* **Checklist Driven**: Likely follows a reverse workflow of the onboarding process.
* **Asset Recovery**: Tied to the Asset Manager to ensure laptops/phones are returned.
* **Account Suspension**: automated steps to suspend Google Workspace accounts.
