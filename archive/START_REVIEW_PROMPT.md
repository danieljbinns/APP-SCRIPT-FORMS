# Prompt to Start Review Session

**Copy and paste this exact prompt to start your review session in a new Claude Code window:**

---

```
I'm starting a review and testing session for the APP-SCRIPT-FORMS repository, specifically the EmployeeRequestForms workflow project.

IMPORTANT - Verify Environment:
- Current directory should be: P:\Repos\github\danieljbinns\APP SCRIPT FORMS
- Git branch should be: main
- Remote should be: https://github.com/danieljbinns/APP-SCRIPT-FORMS.git

Please verify the above, then read the following files in order:

1. README.md - Complete repository overview
2. REORGANIZATION_COMPLETE.md - What was just completed
3. WORKFLOWS/NewEmployee/REVIEW_PROCESS.md - Comprehensive testing workflow (7 phases)

PROJECT CONTEXT:
- Repository was just completely reorganized (commit 675048c)
- Clean modular structure with clear naming convention
- 10 forms in FORMS/EmployeeRequestForms/forms/
- Shared modules in scripts/ and styles/ (with shared.* prefix)
- Form-specific modules use formname.* prefix
- Workflow engine in WORKFLOWS/NewEmployee/
- Admin dashboard in ADMIN/Dashboard/

CURRENT STATUS:
✅ Repository reorganized (238 files moved)
✅ Clear naming applied (shared.*, formname.*, template.*)
✅ All files committed and pushed to remote
✅ Documentation complete (6 comprehensive guides)
⏳ Old folders still exist (need to delete after verification)
⏳ Ready to begin review/testing phase

WHAT I WANT TO DO:
Begin the comprehensive review and testing process following WORKFLOWS/NewEmployee/REVIEW_PROCESS.md.

Start with Phase 1: Environment Setup & Verification.
- Verify GCP project exists and is configured
- Check Apps Script projects are deployed
- Verify Google Groups exist
- Check Shared Drive setup
- Verify all configurations

After completing Phase 1 verification, guide me through each subsequent phase:
- Phase 2: Code Review & Analysis
- Phase 3: Deployment Validation
- Phase 4: Workflow System Testing
- Phase 5: Form Testing
- Phase 6: Integration Testing
- Phase 7: Documentation & Sign-off

Please confirm you understand the project structure and are ready to begin the review process.
```

---

## Alternative: Quick Review Start

If you want a shorter prompt:

```
Start review of APP-SCRIPT-FORMS repository. Verify I'm in P:\Repos\github\danieljbinns\APP SCRIPT FORMS on branch main.

Read:
1. README.md
2. REORGANIZATION_COMPLETE.md
3. WORKFLOWS/NewEmployee/REVIEW_PROCESS.md

Begin Phase 1 of review process: Environment Setup & Verification. Guide me through testing the EmployeeRequestForms workflow system.
```

---

## What Will Happen

When you start the new session, Claude will:

1. ✅ **Verify environment** (directory, branch, remote)
2. ✅ **Read project documentation** (README, completion summary, review process)
3. ✅ **Understand structure** (new organization, naming convention)
4. ✅ **Begin Phase 1** (Environment verification)
5. ✅ **Guide you through** each testing phase systematically

---

## Files Claude Will Reference

### Primary Guides:
- `WORKFLOWS/NewEmployee/REVIEW_PROCESS.md` - 7-phase testing workflow (50KB)
- `docs/testing/WEEKLY_REVIEW_PLAN.md` - Week-long structured testing
- `README.md` - Complete project overview

### Technical Reference:
- `COMPLETE_AUDIT_AND_REORGANIZATION.md` - Structure explanation
- `MODULE_PLACEMENT_GUIDE.md` - What goes where
- `WORKFLOWS/NewEmployee/ARCHITECTURE.md` - Workflow design

### Configuration:
- `WORKFLOWS/NewEmployee/Config.gs` - Main configuration
- `WORKFLOWS/NewEmployee/.clasp.json` - Apps Script deployment
- `WORKFLOWS/NewEmployee/appsscript.json` - OAuth scopes

---

## Testing Phases Overview

**Phase 1: Environment Setup (30-60 min)**
- Verify GCP project
- Check Apps Script deployment
- Verify Google Groups
- Check Shared Drive

**Phase 2: Code Review (1-2 hours)**
- Review .gs files
- Check HTML forms
- Verify configurations

**Phase 3: Deployment Validation (30 min)**
- Test clasp deployment
- Verify web app access
- Check permissions

**Phase 4: Workflow Testing (1-2 hours)**
- Test workflow creation
- Test tracking
- Verify notifications

**Phase 5: Form Testing (2-3 hours)**
- Test all 10 forms
- Verify data collection
- Check validation

**Phase 6: Integration Testing (1-2 hours)**
- End-to-end workflow
- Cross-form communication
- Dashboard functionality

**Phase 7: Sign-off (30 min)**
- Update documentation
- Production readiness
- Sign-off checklist

---

## Tips for Review Session

1. **Take notes** - Document issues found
2. **Test incrementally** - Complete each phase before moving on
3. **Verify fixes** - Test after making changes
4. **Update docs** - Keep documentation current
5. **Ask questions** - Claude has full context

---

**Ready to start? Copy the prompt above into a new Claude Code session!**
