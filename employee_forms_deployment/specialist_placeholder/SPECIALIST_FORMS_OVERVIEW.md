# Specialist Forms Roadmap & Checklist

This document tracks the status and requirements for the secondary specialist forms currently handled by the **Specialist Placeholder** form.

## 🔄 Workflow Logic

* **Trigger**: All specialist emails are triggered simultaneously once the **IT Setup Form** is submitted.
* **Target**: Emails are sent to department-specific contacts with a link to the setup form.
* **Current State**: All departments use the `specialist_placeholder` project via a URL parameter (`?dept=xyz`).

---

## 📋 Specialist Forms Checklist

### [ ] ADP Setup

* **Trigger**: IT Setup Complete
* **Group**: Payroll / HR
* **Status**: 🟠 Placeholder
* **Key Fields Needed**: ADP Account #, Employment Status, Pay Rate Confirmation.

### [ ] Credit Card Issuance

* **Trigger**: IT Setup Complete
* **Group**: Finance / Accounting
* **Status**: 🟠 Placeholder
* **Key Fields Needed**: Card Limit, Card Type, Shipping Address.

### [ ] Business Cards

* **Trigger**: IT Setup Complete
* **Group**: Marketing / Admin
* **Status**: 🟠 Placeholder
* **Key Fields Needed**: Title on Card, Phone Number Preference, Quantity.

### [ ] Fleetio Access

* **Trigger**: IT Setup Complete
* **Group**: Fleet Management
* **Status**: 🟠 Placeholder
* **Key Fields Needed**: Vehicle ID, Driver License Verification, Fuel Pin.

### [ ] JONAS Enterprise Setup

* **Trigger**: IT Setup Complete
* **Group**: Operations / Finance
* **Status**: 🟠 Placeholder
* **Key Fields Needed**: Module Access Repo, Permissions Level.

### [ ] SiteDocs Worker Profile

* **Trigger**: IT Setup Complete
* **Group**: Safety / Compliance
* **Status**: 🟠 Placeholder
* **Key Fields Needed**: Certificate Uploads, Safety Role.

### [ ] 30/60/90 & JR Review

* **Trigger**: IT Setup Complete
* **Group**: Reporting Manager
* **Status**: 🟠 Placeholder
* **Key Fields Needed**: Initial 30-day goals, Job Responsibility (JR) acknowledgement.

---

## 🛠️ Implementation Plan for Custom Forms

When moving from placeholder to custom form:

1. **Duplicate** the standard form template.
2. **Add** the specific fields identified above.
3. **Update** the `CONFIG.EMAILS` and `URL` variables in the `it_setup` project to point to the new standalone form.
4. **Update** this checklist to 🟢 COMPLETE.
