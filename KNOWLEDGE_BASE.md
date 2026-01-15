# Employee Request Forms: Knowledge Base

This document serves as the project's "memory," capturing clarified assumptions, evolved logic, and technical standards established during development.

---

## 🧠 Core Concept: Sequential Gating

The most critical architectural decision made was to move away from parallel notifications to a **Sequential Gating** workflow.

* **Original Assumption**: All departments should be notified immediately upon hire request.
* **Revised Logic**: To prevent data silos and ensure technical accuracy (e.g., IT needs the Employee ID from HR before they can name a computer account), the workflow is now gated:
    1. **HR (ID Setup)** must finish first.
    2. **IT (Hardware/Email)** is triggered only after HR finishes.
    3. **Specialists (ADP, Jonas, etc.)** are triggered only after IT finishes (so they have the new email address).

---

## 🛠️ Technical Standards

### 1. Google Apps Script Compatibility (The "ASCII Standard")

* **Issue**: Modern ES6 Template Literals (using backticks `` ` ``) and non-ASCII characters (✓, •, —) caused intermittent `SyntaxError` and `document.write` failures in the GAS "sandboxed" iframe.
* **Solution**: All UI code must use **standard string concatenation** (`'str' + var`) and **ASCII characters only**. Use `[DONE]` instead of `✓` and `|` instead of `•`.

### 2. Navigation & Redirects

* **Issue**: `window.location.href` inside a GAS iframe points to a restricted internal Google URL, breaking "Back to Dashboard" buttons.
* **Solution**: Always pass the authoritative Public Macro URL (via `ScriptApp.getService().getUrl()`) from the server to the template and use that for all `href` attributes.

### 3. Data Serialization ("The JSON Round-Trip")

* **Issue**: Passing complex objects (like `Date` or nested Classes) through `google.script.run` often results in `null` on the client side.
* **Solution**: Always use a "JSON Safety Round-trip" before returning data to the client:

    ```javascript
    return JSON.parse(JSON.stringify(data));
    ```

---

## 🗺️ Master Workflow Diagram

### Step 1: Initial Request (Manager)

* **Trigger**: Form Submission.
* **Target**: `Initial Requests` Sheet.
* **Action**: Generates `Request ID` (e.g., `NEW_EMP_12345`). Sends link to **HR ID Setup**.

### Step 2: ID & Payroll Setup (HR Gatekeeper)

* **Trigger**: HR hits "Submit".
* **Target**: `ID Setup Results` Sheet.
* **Action**: Sets `Workflow Status` to "ID Setup Complete". Triggers **IT Setup Email**.

### Step 3: IT Setup & Provisioning (IT)

* **Trigger**: IT hits "Submit".
* **Target**: `IT Results` Sheet.
* **Action**: Sets `Workflow Status` to "IT Setup Complete". Triggers **7 Specialist Emails** simultaneously.

### Step 4: Specialist Setup (Multi-Department)

* **Trigger**: Individual Specialist hits "Submit".
* **Target**: `Specialist Results` Sheet.
* **Action**: Dashboard updates to show "[DONE] Department Name".

---

## 📑 Logical Field Mapping (Object IDs)

*This mapping ensures consistent data retrieval across all 4 data sheets.*

| Logical Name | Shared ID Key | Source Form |
| :--- | :--- | :--- |
| Unique Request Pointer | `Request ID` | Initial Request |
| Employee Full Name | `First Name` + `Last Name` | Initial Request |
| Technical Employee ID | `Internal Employee ID` | HR Setup |
| SiteDocs Portal ID | `SiteDocs Worker ID` | HR Setup |
| Company Email | `Assigned Email` | IT Setup |
| Computer/Hardware | `Computer Type` | IT Setup |
| Responsible Staff | `Submitted By` | All Results Sheets |
| Completion Time | `Submission Timestamp` | All Results Sheets |
