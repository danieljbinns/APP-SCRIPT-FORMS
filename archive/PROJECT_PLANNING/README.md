# PROJECT_PLANNING

## Purpose
Centralized location for all project planning, documentation, deployment strategies, and future development plans.

## Structure

### 📁 current-deployment/
**Preserved backend code from initial deployment attempt**
- Google Apps Script (.gs) files from WORKFLOWS/NewEmployee
- Workflow orchestration code (WorkflowTracker, DynamicDashboard, etc.)
- Deployment documentation and configuration
- ⚠️ Unverified deployment - started but never confirmed working

### 📁 planning/
**Feature planning and roadmap documents**
- 00-MASTER-PLAN.md - Overall project master plan
- 01-13: Numbered feature planning docs (error handling, validation, mobile, export, etc.)
- INDEX.md - Planning document index
- PLANNING_COMPLETE.md - Completion status
- Future enhancements and capabilities

### 📁 setup/
**Environment setup and configuration guides**
- GAM7_SETUP_MASTER_GUIDE.md - GAM7 setup instructions
- Other setup documentation

### 📁 testing/
**Testing strategies and plans**
- ERROR_HANDLING_TEST_PLAN.md - Error handling test scenarios
- WEEKLY_REVIEW_PLAN.md - 7-day deployment and testing strategy (duplicate - see root level)

### 📁 future-admin-ui/
**Future admin tooling and UI components** (formerly /ADMIN)
- Dashboard/ - Admin dashboard UI files
- Templates/ - Form templates and validators
- WorkflowBuilder/ - Workflow builder UI components
- ⚠️ Future development - not part of immediate deliverable

### 📄 Top-Level Documents
- **WEEKLY_REVIEW_PLAN.md** ⭐ - Latest rapid 7-day deployment strategy (12-16 hours)
- **QUICK_COMPARISON.md** - Comparison documentation
- **WORK_RECONCILIATION.md** - Work reconciliation notes

## Key Documents

### For Deployment:
1. **WEEKLY_REVIEW_PLAN.md** - Start here for deployment
2. **current-deployment/** - Reference for backend code structure
3. **setup/** - Environment setup guides

### For Planning:
1. **planning/00-MASTER-PLAN.md** - Overall project vision
2. **planning/INDEX.md** - Feature planning index
3. **future-admin-ui/** - Long-term admin tooling plans

### For Testing:
1. **testing/ERROR_HANDLING_TEST_PLAN.md** - Error handling tests
2. **WEEKLY_REVIEW_PLAN.md** - Includes comprehensive testing scenarios

## Folder History
- Consolidated from `/docs` and `/ADMIN` folders (Dec 12, 2025)
- Renamed to PROJECT_PLANNING for clarity
- Reduced top-level folder clutter

## Related Folders
- `/DEMO` - UI/UX prototypes and senior meeting materials
- `/FORM_*` - Individual task form implementations (9 folders)
- `/archive` - Deprecated/legacy code (WMAR, REQUEST_FORMS, WORKFLOWS)

---
**Last Updated:** 2025-12-12
**Consolidation:** docs + ADMIN → PROJECT_PLANNING
**Status:** Active - primary planning and documentation hub
