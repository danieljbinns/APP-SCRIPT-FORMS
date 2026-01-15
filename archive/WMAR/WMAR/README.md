# WMAR Folder

## Purpose
**LEGACY/OBSOLETE** - Original monolithic workflow system before refactoring into modular FORM_* structure.

## What is "WMAR"?
**Web Module Access Request** - The original name for this system. This term is obsolete but remains embedded in the codebase.

## Contents
- **Workflow Engine:** WorkflowEngine.gs, WorkflowBase.gs, NewHireWorkflow.gs
- **Original Forms:** HR.html, ITSetup.html, CreditCardForm.html, FleetioForm.html, JR306090Form.html, ParallelTaskForm.html
- **Utilities:** EmailUtils.gs, PDFUtils.gs, SheetAccess.gs, Tasks.gs, TaskBase.gs
- **Setup Scripts:** setup_drive_folders.gs, setup_new_spreadsheet.gs, create_new_form.gs
- **Deployment:** deploy_workflow_engine.ps1, deployment_summary.md
- **HTML Pages:** Index.html, Approval.html, Denial.html, SendBack.html, Closed.html
- **Shared Resources:** CSS.html, JavaScript.html
- **Template folder**
- **Documentation:** Project handover, deployment summary, sample prompts

## Important Notes
⚠️ **MAY CONTAIN MOST ACCURATE COPIES OF INITIAL FORM**
- This was the working system before modularization
- Forms here might have the most complete/accurate versions
- Review before deleting to ensure nothing is lost

## Status
**OBSOLETE** - Legacy system replaced by modular FORM_* architecture

## Action Items
1. ✅ Marked as obsolete in README
2. ⏳ Review forms to extract any valuable/accurate versions
3. ⏳ Compare with current FORM_* implementations
4. ⏳ Move to `/archive` folder after verification
5. ⏳ Delete after successful initial deployment

## Related Folders
- See `/FORM_*` folders for current modular task forms
- See `/archive` for other obsolete materials
- See `/WORKFLOWS/NewEmployee` for current workflow implementation

---
**Created:** Original implementation
**Deprecated:** During modularization
**Move to Archive:** After verification and initial deployment
