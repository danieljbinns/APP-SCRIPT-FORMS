# Deployment Guide

## Prerequisites

* **Node.js** & **Clasp** installed globally.
* **Google Apps Script API** enabled.
* Logged in via `clasp login`.

## Deployment Steps

1. **Navigate to Project Directory**:

    ```powershell
    cd "p:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_deployment\employee_management_v2"
    ```

2. **Push Code**:

    ```powershell
    clasp push
    ```

3. **Create Version**:

    ```powershell
    clasp version "Description of changes"
    ```

4. **Deploy to Active ID**:
    * **Important**: Always deploy to the *same* Deployment ID to keep URLs consistent.
    * **Current ID**: `AKfycbzpYfZvZ2irw_DVe24NgFGyNcad2XiX5jTQOO9m0wQIWxo3oln9LjDttuoXDBjjVhZ3` ([robinsonsolutions.com](http://robinsonsolutions.com) domain)

    ```powershell
    clasp deploy -i "AKfycbzpYfZvZ2irw_DVe24NgFGyNcad2XiX5jTQOO9m0wQIWxo3oln9LjDttuoXDBjjVhZ3" -V [VERSION_NUMBER] -d "Description"
    ```

## Post-Deployment Checks

1. **Check Config.gs**:
    * Ensure `DEPLOYMENT_URL` matches the deployed URL.
    * If you change the Deployment ID, you MUST update `Config.gs` and redeploy.

2. **Verify Web App Permissions**:
    * Go to Script Editor -> Deploy -> Manage Deployments.
    * Ensure "Execute as" is **Me**.
    * Ensure "Who has access" is **Anyone**.

## Troubleshooting

* **"Requested entity was not found"**: The Deployment ID is wrong or deleted. List deployments with `clasp deployments` to find the correct active one.
* **"ScriptError"**: Check Stackdriver logs in Apps Script dashboard. Often due to missing library or permission issues.
* **"formId is not defined"**: Ensure all `HtmlTemplate` objects have variables assigned in the `.gs` handler functions.
