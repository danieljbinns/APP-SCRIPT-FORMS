# Employee Management System V1.1

## Overview

A comprehensive Google Apps Script application for managing employee onboarding, including:

- Initial Request Form (Managers)
- ID Setup (SiteDocs Team)
- HR Verification (HR)
- IT Setup (IT Team)
- Specialists Notifications (Jonas, Fleetio, Credit Cards, etc.)

## Architecture

- **Frontend**: HTML Service (Bootstrap/Custom CSS)
- **Backend**: Google Apps Script (`.gs`)
- **Database**: Google Sheet (as configured in `Config.gs`)
- **Routing**: `Router.gs` handles all `doGet` requests via `?form=...` parameter.

## Key Files

- `Router.gs`: Entry point.
- `Config.gs`: Single source of truth for URLs and IDs.
- `InitialRequest.html`: The main form.
- `Dashboard.html`: Admin dashboard.

## Setup

1. **Spreadsheet**: Ensure the master spreadsheet has all required tabs (see `SPECIFICATION.md`).
2. **Script Properties**: None (Configuration is currently in `Config.gs`).
3. **Deployment**:
   - `clasp push`
   - Deploy as Web App (Execute as User Accessing, Allow: Any Google Account/Domain).

## Access Control

Managed by `Services/AccessControlService.gs`.

- Checks Google Group membership.
- Checks email domain allowlist.
