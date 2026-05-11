# Status Change Workflows Plan

This document outlines the form fields and backend actions needed for the three employee status change workflows in the Employee Management system.

---

## 1. Position / Job Title Change

This workflow is triggered when an employee changes roles, gets promoted, or reports to a new manager.

### Required Fields

- Requester Name (Text Input)
- Effective Date (Date)
- Employee Name (Text Input)
- New Job Title (Text Input) - *Note: If changing*
- New Manager (Text Input) - *Note: If changing*
- Reassign Direct Reports To (Text Input) - *Note: If manager changes*
- System Access Needed? (Radio: Yes/No) - *Note: For additions*
- Equipment Needed? (Radio: Yes/No) - *Note: For new equipment*

### Backend Logic Workflow

```mermaid
graph TD
    A[Form Submitted: Position Change] --> B{HR Verification}
    B -- Approved --> C{Is Manager Changing?}
    C -- Yes --> D[Send Email to New Manager]
    C -- No --> E{Are Direct Reports Changing?}
    D --> E
    E -- Yes --> F[Update Reporting Structure]
    E -- No --> G{Is Job Title Changing?}
    F --> G
    G -- Yes --> H[Send JR Email]
    G -- No --> I{System Access Changed?}
    H --> I
    I -- Yes --> J[Create IT Ticket: Systems]
    I -- No --> K{Equipment Changed?}
    J --> K
    K -- Yes --> L[Create IT Ticket: Equipment]
    K -- No --> M[Send Payroll Notification]
    L --> M
    M --> N[Update Master AppSheet DB]
```

---

## 2. Location Change

This workflow is triggered when an employee changes their physical work location or site.

### Required Fields

- Requester Name (Text Input)
- Effective Date (Date)
- Employee Name (Text Input)
- New Site/Location (Dropdown)
- System Access Needed? (Radio: Yes/No) - *Note: For site-specific apps*

### Backend Logic Workflow

```mermaid
graph TD
    A[Form Submitted: Location Change] --> B{HR Verification}
    B -- Approved --> C{Is Manager Changing?}
    C -- Yes --> D[Send Email to New Manager]
    C -- No --> E{Is Job Title Changing?}
    D --> E
    E -- Yes --> F[Send JR Email]
    E -- No --> G{System Access Changed?}
    F --> G
    G -- Yes --> H[Create IT Ticket: Systems]
    G -- No --> I{Equipment Changed?}
    H --> I
    I -- Yes --> J[Create IT Ticket: Equipment]
    I -- No --> K{Are Direct Reports Changing?}
    J --> K
    K -- Yes --> L[Update Reporting Structure]
    K -- No --> M[Send Payroll Notification]
    L --> M
    M --> N[Update Master AppSheet DB]
```

---

## 3. End of Employment (Termination)

This workflow is triggered when an employee leaves the company (resignation, termination, etc.).

### Required Fields

- Requester Name (Text Input)
- Effective Date (Date)
- Employee Name (Text Input)
- Reassign Direct Reports To (Text Input) - *Note: Required if manager*
- Deactivate All Systems (Checkbox)
- Return Equipment Checklist (Checkbox)

### Backend Logic Workflow

```mermaid
graph TD
    A[Form Submitted: End of Employment] --> B{HR Verification}
    B -- Approved --> C{Has Direct Reports?}
    C -- Yes --> D[Update Reporting Structure]
    C -- No --> E{Deactivate Systems?}
    D --> E
    E -- Yes --> F[URGENT: Ticket to Deactivate ALL]
    E -- No --> G{Return Equipment?}
    F --> G
    G -- Yes --> H[Create IT Ticket: Collect Equipment]
    G -- No --> I[Send Payroll Notification]
    H --> I
    I --> J[Update Master AppSheet DB: Mark Inactive]
```

---

*Note: These workflows are designed to be dynamic. The UnifiedWorkflowPlanner HTML tool can be used to generate the exact JSON configurations that will drive the backend execution of these logic trees.*
