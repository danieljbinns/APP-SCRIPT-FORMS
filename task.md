# Employee Request Forms - Project Master Task List

Current Deployment Folder: `employee_forms_deployment/`

## Phase 1: Infrastructure & Environment [COMPLETE]
- [x] Create standardized deployment folder structure
- [x] Consolidate legacy code into `employee_forms_deployment/`
- [x] Initialize Git tracking and remote synchronization
- [x] Document project architecture

## Phase 2: Priority Workflow Forms [COMPLETE]
- [x] **Initial Request Form**: Entry point for all new hires.
- [x] **Employee Setup (HR)**: Automated ID generation and payroll setup.
- [x] **IT Setup**: Equipment assignment and Google account creation.

## Phase 3: Workflow Logic & Gating [COMPLETE]
- [x] Implement Sequential Gating (HR -> IT -> Specialists).
- [x] Configure conditional email triggers based on form results.
- [x] Create Specialist Placeholder logic for 7 secondary departments.

## Phase 4: Employee Request Dashboard [COMPLETE]
- [x] Build premium, dark-mode Admin Dashboard.
- [x] Implement real-time stats (Total, Pending, Complete).
- [x] Add advanced filtering and search.
- [x] **Employee Details View**: High-impact deep-dive for every request.

## Phase 5: Data Visibility & Tracking [COMPLETE]
- [x] **"By Who" Tracking**: Capture staff member email on every submission.
- [x] **Submission Timestamps**: Track start-to-finish durations.
- [x] **Full Data Dump**: Dynamic rendering of every submitted field in the Details view.

## Phase 6: Compatibility & Stability [COMPLETE]
- [x] Refactor HTML templates for maximum Google Apps Script compatibility (ASCII only, string concatenation).
- [x] Fix internal vs public URL navigation issues.
- [x] Implement JSON safety round-trips for robust data serialization.
