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

## Phase 7: Specialist Form Customization [IN PROGRESS]

- [x] Create Specialist Forms Roadmap & Checklist
- [x] **HR Verification & ADP Step**: Created form and conditional routing logic
- [ ] Deploy HR Verification form and test both paths
- [ ] Develop standalone ADP Setup Form (note: ADP ID now captured in HR Verification)
- [ ] Develop standalone Fleetio Form
- [ ] Develop remaining custom specialist forms

## Phase 10: Version 16 Release [COMPLETE]

- [x] **Safety Notification**: Add full request details (Requester, Manager, Site).
- [x] **HR Verification Email**: Fix "N/A" credentials by fetching ID Setup results.
- [x] **IT Setup Email**: Remove "button" text, add Phone VM Pin.
- [x] **Deploy Version 16** (ID: `AKfycbzvoe...`)

## Phase 11: Version 18 Release [COMPLETE]

- [x] **Fix Committee Validation**: Removed code incorrectly populating Committees with Site list.
- [x] **Deploy Version 18** (ID: `AKfycbyXp...`)

## Phase 12: Version 19 Release [IN PROGRESS]

- [x] **Fix Dashboard Error**: Resolved "Unexpected token" syntax error by restoring missing loop logic.
- [x] **Deploy Version 19** (ID: `AKfycbwTM...`)

## Phase 13: Future Roadmap Planning [IN PROGRESS]

- [x] Research `_FUTURE_CONCEPTS` directory for roadmap candidates.
- [x] Create `future_concepts_roadmap.md` summary.
- [x] **Audit Dashboard View Filters**: Researched permissions and visibility logic.
- [x] **Align Permission Groups**: Updated visibility groups to match mailing lists.
- [x] **Fix Dashboard Visibility**: Fixed requester/manager mapping for filtered views.
- [x] **Update 30/60/90 Email**: Added Employee Email and Job # to specialist notifications.
- [x] **Master Email Redirect**: Added a global switch for safe environment testing.
- [/] **Staging Environment Setup**: Planning environment isolation and parallel sync.
- [ ] **Unified Dashboard (VNext)**: Plan implementation.
- [ ] **Asset Manager**: Plan implementation.
- [ ] **Org Chart**: Plan implementation.
- [ ] **Admin Tools**: Plan implementation.
