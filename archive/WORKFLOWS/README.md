# WORKFLOWS Folder

## Purpose
**LEGACY** - Original monolithic workflow implementation approach (single Apps Script project containing all forms).

## Contents
- **NewEmployee/** - Monolithic New Employee Workflow implementation

## Status
**SUPERSEDED** - This approach has been replaced by modular FORM_* architecture.

## Important Notes
✅ **Backend code (.gs files) has been preserved** in `/docs/current-deployment/`

⚠️ **This deployment was started but never confirmed as working**

## What Was Here
The NewEmployee folder contained:
- All 9 task forms as HTML files within ONE Apps Script project
- Comprehensive backend orchestration code (WorkflowTracker, DynamicDashboard, etc.)
- Deployment to Google Apps Script (Script ID: 1tDvetPic3GavG6jdNKXLP1hOCpUArtputFcfDfEWmPgNsFteWcvXqM6_)
- Older versions of forms (less comprehensive than DEMO)

## Why Superseded
**Old Approach (Monolithic):**
- All forms in ONE Apps Script project
- Tightly coupled
- Harder to maintain individual forms

**New Approach (Modular):**
- Each task is its own FORM_* folder with separate Apps Script project
- Loosely coupled, reusable tasks
- Each form can be deployed/updated independently

## Backend Code Preservation
All valuable .gs backend files have been copied to:
`/docs/current-deployment/`

This includes:
- Workflow tracking logic
- Dashboard generation
- Email utilities
- Assignment management
- Configuration and setup

## Action Items
1. ✅ Backend code preserved in `/docs/current-deployment/`
2. ⏳ Move entire WORKFLOWS folder to `/archive/` after final verification
3. ⏳ Delete after successful new modular deployment

## Related
- See `/docs/current-deployment/` for preserved backend code
- See `/DEMO/` for latest UI/UX examples
- See `/FORM_*` folders for current modular task implementations
- See `/archive/` for other deprecated materials

---
**Original Purpose:** Monolithic workflow implementation
**Superseded By:** Modular FORM_* architecture
**Backend Preserved In:** /docs/current-deployment/
**Move to Archive:** After verification
