# Current Deployment - Backend Code Archive

## Purpose
**Preservation of working deployment backend code** from WORKFLOWS/NewEmployee that was deployed to Google Apps Script.

## Status
⚠️ **UNVERIFIED DEPLOYMENT** - This deployment was started but never confirmed as working/good.

## What's Here
This folder contains the Google Apps Script backend (.gs files) from the monolithic WORKFLOWS/NewEmployee deployment:

### Core Backend Files
- **Code.gs** - Main application logic and routing
- **Config.gs** - Configuration and constants
- **WorkflowConfig.gs** - Workflow-specific configuration
- **Setup.gs** - Initialization and setup scripts

### Workflow Management
- **WorkflowTracker.gs** - Workflow instance tracking, filtering, KPIs
- **DynamicDashboard.gs** - Auto-generated dashboards per form/workflow
- **MasterTrackerDashboard.gs** - Master tracking across all workflows
- **WorkflowBuilder.gs** - Workflow construction logic
- **AssignmentManagement.gs** - Task assignment logic

### Utilities
- **EmailUtils.gs** - Email notification system
- **DeploymentAutomation.gs** - Deployment automation
- **CSSFramework.gs** - CSS framework backend

### Configuration
- **appsscript.json** - OAuth scopes and manifest

### Documentation
- **DEPLOYMENT_STATUS.md** - Deployment details (Script ID, Spreadsheet ID, etc.)
- **ENTERPRISE_PLATFORM_INTEGRATION.md** - Enterprise integration docs
- **ENTERPRISE_WORKFLOW_BUILDER.md** - Workflow builder documentation
- **REVIEW_PROCESS.md** - Review process documentation
- **WORKFLOW_TRACKER_README.md** - Tracker usage guide

## Deployment Info (from DEPLOYMENT_STATUS.md)
- **Script ID:** 1tDvetPic3GavG6jdNKXLP1hOCpUArtputFcfDfEWmPgNsFteWcvXqM6_
- **Spreadsheet ID:** 18dLtNYOymmjbm-dGrY9pm41SQAi1QQIVP1e1KFNAgAQ
- **Folder ID:** 15DRzYdFGTJba5O1eg5UbeWqPifLrZWVF
- **Shared Drive:** 0AOOOWlqzpUNVUk9PVA (Team Group Companies)

## Important Notes
1. This was a **monolithic approach** - all forms in one Apps Script project
2. **Never confirmed working** in production
3. Backend orchestration logic may be valuable for new implementation
4. Forms (HTML) are outdated compared to DEMO folder
5. Current strategy uses **modular FORM_* folders** instead

## Why Preserved
- Contains comprehensive workflow orchestration code not present in DEMO or FORM_* folders
- May contain valuable logic for tracking, dashboards, and workflow management
- Reference for understanding attempted deployment approach
- Deployment IDs may still be active in Google Apps Script

## Next Steps
1. Review if this deployment is still active/accessible
2. Determine if any backend logic should be adapted for new modular approach
3. If deployment is dead/abandoned, document lessons learned
4. Keep as reference until new deployment is confirmed working

---
**Copied From:** P:\Repos\github\danieljbinns\APP SCRIPT FORMS\WORKFLOWS\NewEmployee
**Date Preserved:** 2025-12-12
**Reason:** Preserve backend code before archiving monolithic WORKFLOWS folder
