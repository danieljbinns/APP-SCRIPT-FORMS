# Technical Specification

## Workflow Stages

1. **Initial Request**
    * **Actor**: Hiring Manager
    * **Output**: Row in `Initial Requests` sheet.
    * **Trigger**: Sends email to SiteDocs Team (for ID) and Requester.

2. **ID Setup**
    * **Actor**: SiteDocs Team
    * **Input**: Employee Name, Hire Date.
    * **Action**: Generates Employee ID, SiteDocs ID, DSS Username.
    * **Output**: Row in `ID Setup Results`.
    * **Trigger**: Updates Workflow Status -> `HR Verification Needed`.

3. **HR Verification**
    * **Actor**: HR
    * **Action**: Verifies Job Title, JR number.
    * **Output**: Row in `HR Verification Results`.
    * **Trigger**: Updates Workflow Status -> `IT Setup Needed`.

4. **IT Setup**
    * **Actor**: IT Team
    * **Action**: Assigns Email, Computer, Phone, System Access (BOSS).
    * **Output**: Row in `IT Results`.
    * **Trigger**: Sends emails to all Specialists (Jonas, Fleetio, etc.) based on requirements.

5. **Specialist Fulfillment**
    * **Actors**: Various (Finance, Fleet, etc.)
    * **Action**: Complete specific setup tasks.
    * **Monitoring**: Dashboard shows granular pending status.

## Data Dictionary (Key Columns)

### Initial Requests Sheet

* `Workflow ID` (Col A): Unique UUID.
* `Systems`: Comma-separated list (e.g., "Jonas, Fleetio").
* `Equipment`: Comma-separated list.
* `Credit Card (USA)`: Yes/No.

### Result Sheets

* All result sheets link back via `Workflow ID` in Column A.

## Routing

* `https://.../exec?form=initial_request`
* `https://.../exec?form=dashboard`
* `https://.../exec?form=it_setup&id=[WORKFLOW_ID]`
