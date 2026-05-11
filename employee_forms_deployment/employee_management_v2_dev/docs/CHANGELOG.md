# Changelog

## [Unreleased]

## [V23] - 2026-01-16

### Changed

- **Specialist Forms**: Standardized all specialist forms (Credit Card, Business Cards, Fleetio, Jonas, SiteDocs, Review) to a unified "Confirm Complete" interface.
- **Removed**: Detailed placeholder fields from specialist forms.
- **Added**: "Notes" field to all specialist confirmations.

## [V21] - 2026-01-16

### Fixed

- **ReferenceError**: Fixed "formId is not defined" error across ID Setup, HR Verification, and IT Setup forms. Only previously defined on submission, now defined on view.

## [V19] - 2026-01-16

### Added

- **Error Handling**: Added robust null checks for request data in `IDSetup.gs`. Returns specific "Data Not Found" page instead of crashing if initial request row is missing.

## [V17] - 2026-01-16

### Fixed

- **Dashboard**: Fixed "Cannot read properties of null" error.
- **Serialization**: Added server-side date-to-string conversion to prevent JSON serialization issues with Date objects.
- **Client**: Added defensive null checks in `Dashboard.html`.

## [V15] - 2026-01-16

### Changed

- **New Deployment**: Redeployed to fresh ID (`...VhZ3`) after legacy deployment broke.
- **Config**: Updated `DEPLOYMENT_URL` to match `robinsonsolutions.com` domain.
- **Debugging**: Added raw URLs to email templates for easier debugging.

## [V1-V12] - Previous V2 Migration steps

- Consolidated 5 projects into 1.
- Implemented `workflowId` routing.
- Created `Dashboard.html` reading from `Workflows` sheet.
- Implemented Hourly vs Salary routing logic.
