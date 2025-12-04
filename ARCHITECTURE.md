# REQUEST_FORMS - System Architecture

## 📊 Visual Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INTERACTION LAYER                          │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         WEB APP (Google Apps Script)                      │
│  URL: https://script.google.com/.../exec                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────┐                                                     │
│  │   doGet(e)      │  ◄───── Routes requests to appropriate form         │
│  │   Router        │                                                     │
│  └────────┬────────┘                                                     │
│           │                                                               │
│           ├─── No params? ───► InitialRequest.html (Main Form)           │
│           │                                                               │
│           ├─── ?form=hr&id=XXX ───► PlaceholderForm.html (HR)            │
│           ├─── ?form=it&id=XXX ───► PlaceholderForm.html (IT)            │
│           ├─── ?form=fleetio&id=XXX ───► PlaceholderForm.html            │
│           └─── ... (9 sub-form routes)                                   │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         PROCESSING LAYER (Code.gs)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Form Renderers:                    Form Processors:                     │
│  ┌──────────────────────┐          ┌──────────────────────┐             │
│  │ renderInitialForm()  │          │ processInitialReq()  │             │
│  │ renderPlaceholder()  │          │ processPlaceholder() │             │
│  └──────────────────────┘          └──────────────────────┘             │
│                                                                           │
│  Helpers:                                                                 │
│  ┌──────────────────────┐                                                │
│  │ generateRequestId()  │  ◄───── Creates unique ID                     │
│  │ include()            │  ◄───── Loads HTML partials                   │
│  └──────────────────────┘                                                │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CONFIGURATION (Config.gs)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  • SHARED_DRIVE_ID                  • JOB_CODES                          │
│  • SPREADSHEET_ID                   • DEPARTMENTS                        │
│  • MAIN_FOLDER_ID                   • EQUIPMENT                          │
│  • FORM_FIELDS                      • STATUS values                      │
│  • EMAILS                           • COMPANY_NAME / LOGO                │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA STORAGE LAYER                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  📊 GOOGLE SHEETS                   📁 GOOGLE DRIVE                      │
│  ┌─────────────────────┐           ┌─────────────────────┐             │
│  │  Spreadsheet:       │           │  Shared Drive:      │             │
│  │  REQUEST_FORMS Data │           │  0AOOOWlqzpUNVUk9PVA│             │
│  ├─────────────────────┤           ├─────────────────────┤             │
│  │                     │           │                     │             │
│  │ Tabs:               │           │ /REQUEST_FORMS/     │             │
│  │  • Initial Requests │           │   ├─ PDFs/          │             │
│  │  • HR Setup         │           │   ├─ Requests/      │             │
│  │  • IT Setup         │           │   ├─ Reports/       │             │
│  │  • Fleetio          │           │   ├─ Templates/     │             │
│  │  • Credit Card      │           │   └─ Archives/      │             │
│  │  • 30-60-90         │           │                     │             │
│  │  • ADP Supervisor   │           └─────────────────────┘             │
│  │  • ADP Manager      │                                                │
│  │  • JONAS            │                                                │
│  │  • SiteDocs         │                                                │
│  │  • Master Dashboard │                                                │
│  │  • Job Codes        │                                                │
│  │                     │                                                │
│  └─────────────────────┘                                                │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Workflow Sequence Diagram

```
┌─────────┐         ┌─────────┐         ┌─────────┐         ┌─────────┐
│ User    │         │ Web App │         │Code.gs  │         │ Sheets  │
└────┬────┘         └────┬────┘         └────┬────┘         └────┬────┘
     │                   │                   │                   │
     │  1. Access URL    │                   │                   │
     ├──────────────────►│                   │                   │
     │                   │                   │                   │
     │                   │  2. doGet()       │                   │
     │                   ├──────────────────►│                   │
     │                   │                   │                   │
     │                   │  3. renderInitialRequestForm()        │
     │                   │◄──────────────────┤                   │
     │                   │                   │                   │
     │  4. Display Form  │                   │                   │
     │◄──────────────────┤                   │                   │
     │                   │                   │                   │
     │  5. Fill & Submit │                   │                   │
     ├──────────────────►│                   │                   │
     │                   │                   │                   │
     │                   │  6. processInitialRequest(formData)   │
     │                   ├──────────────────►│                   │
     │                   │                   │                   │
     │                   │                   │  7. generateRequestId()
     │                   │                   ├────┐              │
     │                   │                   │◄───┘              │
     │                   │                   │                   │
     │                   │                   │  8. appendRow()   │
     │                   │                   ├──────────────────►│
     │                   │                   │                   │
     │                   │                   │  9. Success       │
     │                   │                   │◄──────────────────┤
     │                   │                   │                   │
     │                   │  10. {success: true, requestId: XXX}  │
     │                   │◄──────────────────┤                   │
     │                   │                   │                   │
     │  11. Show Success │                   │                   │
     │◄──────────────────┤                   │                   │
     │                   │                   │                   │
     │  (Request ID: WMAR-20250128-A3F9)     │                   │
     │                   │                   │                   │
```

---

## 🗂️ File Structure & Responsibilities

```
REQUEST_FORMS/
│
├── Config.gs                    ► All configuration constants
│   ├─ SHARED_DRIVE_ID          ► Points to shared drive
│   ├─ SPREADSHEET_ID           ► Points to data spreadsheet
│   ├─ MAIN_FOLDER_ID           ► Points to REQUEST_FORMS folder
│   ├─ FORM_FIELDS              ► Column headers for sheets
│   ├─ JOB_CODES                ► Site → Job mappings
│   ├─ DEPARTMENTS              ► Available departments
│   ├─ EQUIPMENT                ► Equipment options
│   └─ EMAILS                   ► Notification recipients
│
├── Setup.gs                     ► One-time setup functions
│   ├─ runSetup()               ► Main setup orchestrator
│   ├─ createSpreadsheet()      ► Creates sheets with headers
│   ├─ createMainFolder()       ► Creates REQUEST_FORMS folder
│   └─ testConfig()             ► Validates configuration
│
├── Code.gs                      ► Main application logic
│   ├─ doGet(e)                 ► Entry point & router
│   ├─ renderInitialRequestForm() ► Loads main form
│   ├─ renderPlaceholderForm()  ► Loads test sub-form
│   ├─ processInitialRequest()  ► Saves main form data
│   ├─ processPlaceholder()     ► Handles test submissions
│   ├─ generateRequestId()      ► Creates unique IDs
│   ├─ include()                ► Loads HTML partials
│   └─ Helper functions
│
├── Styles.html                  ► All CSS (shared by all forms)
│   ├─ Base styles
│   ├─ Form elements
│   ├─ Responsive design
│   └─ Print styles
│
├── InitialRequest.html          ► Main employee request form
│   ├─ Gatekeeper question
│   ├─ Requester info section
│   ├─ Employee info section
│   ├─ Site/Job dropdowns
│   ├─ Equipment checkboxes
│   └─ Client-side validation
│
├── PlaceholderForm.html         ► Test sub-form (all departments)
│   ├─ Display prefilled data
│   ├─ Simple "Complete" button
│   └─ Success message
│
├── appsscript.json              ► Apps Script manifest
│   ├─ OAuth scopes
│   ├─ Web app settings
│   └─ Runtime version
│
├── ARCHITECTURE.md              ► This file
├── README_CLEAN_RESTART.md      ► Setup documentation
│
└── OLD_DEPLOYMENT/              ► Archived previous version
```

---

## 🎯 Data Flow

### Phase 1: Initial Form Submission

```
User fills form
      │
      ▼
Form validates (client-side)
      │
      ▼
google.script.run.processInitialRequest(formData)
      │
      ▼
Code.gs generates unique Request ID
      │
      ▼
Data saved to "Initial Requests" sheet
      │
      ▼
Success response with Request ID
      │
      ▼
User sees confirmation message
```

### Phase 2: Sub-form (Placeholder) Submission

```
User clicks placeholder form link
      │
      ▼
doGet() receives ?form=hr&id=WMAR-XXX
      │
      ▼
Renders PlaceholderForm.html with Request ID
      │
      ▼
User clicks "Complete"
      │
      ▼
processPlaceholder(requestId, formType)
      │
      ▼
Data saved to respective sheet
      │
      ▼
Success message displayed
```

---

## 📋 Google Sheets Structure

### Sheet: "Initial Requests"
| Column | Data Type | Source |
|--------|-----------|--------|
| Request ID | Text | Auto-generated (WMAR-YYYYMMDD-XXXX) |
| Submission Timestamp | DateTime | Auto (new Date()) |
| Requester Name | Text | Form input |
| Requester Email | Email | Form input |
| Requester Phone | Text | Form input |
| First Name | Text | Form input |
| Last Name | Text | Form input |
| Hire Date | Date | Form input |
| Site Name | Dropdown | Form selection |
| Department | Dropdown | Form selection |
| Position/Title | Dropdown | Form selection (job code) |
| Hourly or Salary | Dropdown | Form selection |
| Reporting Manager Email | Email | Form input |
| Laptop | Yes/No | Checkbox |
| Monitor | Yes/No | Checkbox |
| Keyboard | Yes/No | Checkbox |
| Mouse | Yes/No | Checkbox |
| Phone | Yes/No | Checkbox |
| Workflow Status | Text | Auto (default: "Submitted") |

### Sheet: "HR Setup" (Placeholder Phase)
| Column | Data Type | Source |
|--------|-----------|--------|
| Request ID | Text | From URL parameter |
| Completed At | DateTime | Auto |
| Completed By | Email | Session.getActiveUser() |
| Notes | Text | "Placeholder completed" |

*Similar structure for other 8 sub-form sheets*

---

## 🔐 Security & Permissions

### Web App Access
- **Execute as**: User accessing the web app
- **Access**: Anyone at robinsonsolutions.com (domain restricted)

### OAuth Scopes Required
```json
[
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/script.external_request"
]
```

### Future Scope (Phase 2+)
```json
"https://www.googleapis.com/auth/script.send_mail"
```

---

## 🚀 Deployment Architecture

```
Local Development               GitHub                Apps Script
┌─────────────────┐            ┌─────────────────┐   ┌─────────────────┐
│                 │            │                 │   │                 │
│  P:\Repos\...   │            │  REQUEST_FORMS  │   │  Script Project │
│  REQUEST_FORMS\       │   git push │  (Private)      │   │                 │
│                 ├───────────►│                 │   │  Deployment:    │
│  • Config.gs    │            │  • Config.gs    │   │  - Version 1    │
│  • Code.gs      │            │  • Code.gs      │   │  - Version 2    │
│  • Setup.gs     │   clasp    │  • Setup.gs     │   │  ...            │
│  • *.html       │   push     │  • *.html       │   │                 │
│                 ├────────────┼────────────────►│   │  Web App URL:   │
│                 │            │                 │   │  https://...    │
│                 │            │                 │   │                 │
└─────────────────┘            └─────────────────┘   └─────────────────┘
```

### Deployment Steps
1. **Local Development**: Edit files locally
2. **Git Commit**: Commit changes to local repo
3. **Git Push**: Push to GitHub (backup/version control)
4. **Clasp Push**: Push to Apps Script project
5. **Deploy**: Create new deployment version
6. **Test**: Access web app URL

---

## 📊 Request ID Format

```
WMAR-YYYYMMDD-XXXX

Examples:
- WMAR-20250128-A3F9
- WMAR-20250128-B7K2
- WMAR-20250129-C1M8

Components:
- WMAR: Project identifier
- YYYYMMDD: Date of submission
- XXXX: Random alphanumeric (4 chars)
```

---

## 🎨 UI/UX Flow

### Initial Form
1. User accesses web app URL
2. Sees gatekeeper question: "Have all Recruiting Requirements been met?"
3. Selects "Yes" → Form appears
4. Selects "No" → Warning message, form hidden
5. Fills out requester info (name, email, phone)
6. Fills out employee info (name, hire date, etc.)
7. Selects site → Job codes populate automatically
8. Checks equipment boxes
9. Clicks "Submit"
10. Sees success message with Request ID
11. Form resets

### Placeholder Form (Sub-form Testing)
1. User clicks link: `?form=hr&id=WMAR-XXX`
2. Sees employee info (read-only)
3. Sees department name (e.g., "HR Setup")
4. Clicks "Complete" button
5. Data saves to sheet
6. Success message appears

---

## 📈 Future Enhancements (Not Yet Built)

### Phase 2: Email Notifications
- Send emails after initial form submission
- Include prefilled links to sub-forms
- Template-based emails with employee info

### Phase 3: Full Sub-forms
- Replace placeholder with actual department forms
- Custom fields per department
- Task checklists
- Notes fields

### Phase 4: Master Dashboard
- Formulas to compile all sub-form data
- Visual status tracking
- Progress indicators
- Completion metrics

### Phase 5: Advanced Features
- PDF generation
- File attachments
- Reminder emails
- Status notifications
- Workflow automation

---

**Last Updated**: 2025-01-28
**Version**: 1.0 - Phase 1 (Initial Form + Placeholder)
**Status**: Architecture Complete, Implementation In Progress
