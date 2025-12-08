# WMAR - Workflow Management and Request System v2

## Overview
Enterprise workflow management system for employee onboarding and resource provisioning. Built on Google Apps Script with modular, reusable components.

## Architecture
- **Initial Request Form** - Central intake for new employee requests
- **Sub-Forms** - Department-specific tasks (HR, IT, Fleetio, etc.)
- **Master Sheet** - Consolidated reporting dashboard
- **Modular Utils** - Standalone, copy/paste ready utility functions

## Key Features
- ✅ Server-side rendering for fast page loads
- ✅ Prefilled URLs for sub-forms (no duplicate data entry)
- ✅ Individual sheets per form type
- ✅ Master reporting sheet with compiled data
- ✅ Modular utilities (email, PDF, Drive operations)
- ✅ Domain-restricted access (robinsonsolutions.com)

## Project Structure
```
WMAR_v2/
├── Core/              # Main application logic
├── Forms/             # HTML form templates
├── Shared/            # Reusable UI components
├── Utils/             # Standalone utility modules
└── Docs/              # Documentation
```

## Quick Start
1. Copy `.clasp.json.example` to `.clasp.json`
2. Update `Config.gs` with your settings
3. Run `clasp push` to deploy
4. Run `setupSpreadsheets()` to create sheets
5. Run `setupDriveFolders()` to create folder structure
6. Deploy as web app (Execute as: Me, Access: Domain)

## Documentation
- [Architecture Guide](Docs/ARCHITECTURE.md)
- [Setup Instructions](Docs/SETUP.md)
- [Form Documentation](Docs/FORMS.md)
- [API Reference](Docs/API.md)

## Sub-Forms
1. HR Setup - Employee records, benefits
2. IT Setup - Computer, accounts, software
3. Fleetio - Vehicle assignments
4. Credit Card - Corporate card requests
5. 30-60-90 - Onboarding milestones
6. ADP Supervisor - Payroll supervisor access
7. ADP Manager - Payroll manager access
8. JONAS - ERP system access
9. SiteDocs - Safety documentation access

## Tech Stack
- Google Apps Script (V8 runtime)
- Google Sheets (data storage)
- Google Drive (file storage)
- Google Forms API (prefilled URLs)

## Best Practices Followed
- Server-side HTML generation (fast loads)
- Templated HTML with scriptlets
- Modular, reusable components
- Comprehensive error handling
- Detailed logging for debugging

## Version
2.0.0 - Complete rewrite with modular architecture

## License
Proprietary - Robinson Solutions
