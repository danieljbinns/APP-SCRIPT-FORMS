# REQUEST_FORMS - Interactive Demo

**A fully functional, standalone demo of the workflow system**

---

## 🎯 What This Is

An interactive demo showing the complete REQUEST_FORMS workflow with:
- ✅ Dark mode theme (brand red #EB1C2D)
- ✅ Initial request form
- ✅ Workflow dashboard with progress tracking
- ✅ Process flow diagram
- ✅ 9 sub-form examples
- ✅ Button navigation (no emails)
- ✅ Pre-populated demo data

---

## 🚀 How to Use

### Start the Demo

Open `index.html` in your browser:
```
P:\Projects\Company\REQUEST_FORMS_DOCS\DEMO\index.html
```

### Demo Flow

1. **Initial Request Form** (`index.html`)
   - Fill out new employee request
   - Submit creates workflow ID
   - Redirects to dashboard

2. **Workflow Dashboard** (`dashboard.html`)
   - Shows workflow progress (3/9 complete for demo)
   - Visual process flow diagram
   - 9 task cards with statuses:
     - ✅ HR Setup - Complete
     - ✅ IT Setup - Complete
     - 🔄 Fleetio - In Progress
     - ✅ Credit Card - Complete
     - ⏳ 30-60-90 Review - Open
     - ⏳ ADP Supervisor - Open
     - ⏳ ADP Manager - Open
     - 🔄 JONAS - In Progress
     - ⏳ SiteDocs - Open

3. **Sub-Form** (`form.html`)
   - Click "Open Form" on any open/in-progress task
   - Complete the form
   - Submit shows success
   - Return to dashboard

---

## 🎨 Features

### Dark Theme
- Pure black background (#000000)
- Dark gray cards (#1a1a1a)
- Brand red buttons (#EB1C2D)
- Professional, consistent styling

### Process Flow Diagram
Visual representation showing:
```
[Initial Request] → [9 Sub-Tasks] → [Complete]
```

### Interactive Navigation
- Back buttons on all pages
- Dashboard navigation to forms
- Return to dashboard after completion

### Demo Data
- Pre-set workflow ID: WF-REQ-YYYYMMDD-XXXX
- Employee: John Smith
- Some tasks marked complete for demo

---

## 📁 Files

| File | Purpose |
|------|---------|
| **index.html** | Initial request form |
| **dashboard.html** | Workflow tracking dashboard |
| **form.html** | Dynamic sub-form page |
| **README.md** | This file |

---

## 🔄 Workflow Demonstration

### Initial Request Creates:
- Workflow ID (WF-REQ format)
- Employee data stored in sessionStorage
- 9 sub-tasks created

### Dashboard Shows:
- Workflow info card
- Process flow diagram
- Progress counter (X/9 Complete)
- Task cards with:
  - Title
  - Status badge
  - Description
  - Action button

### Sub-Forms Include:
1. **HR Setup** - Benefits, I-9, Emergency Contacts
2. **IT Setup** - Email, Computer, Phone
3. **Fleetio** - Vehicle, Fuel Card
4. **Credit Card** - Corporate card request
5. **30-60-90 Review** - Performance schedule
6. **ADP Supervisor** - Supervisor permissions
7. **ADP Manager** - Manager permissions
8. **JONAS** - Project assignments
9. **SiteDocs** - Safety training

---

## 💡 Customization

### Change Demo Statuses

Edit `dashboard.html`, line ~140:
```javascript
const tasks = [
  { id: 'HR', title: 'HR Setup', status: 'Complete', ... },
  { id: 'IT', title: 'IT Setup', status: 'In Progress', ... },
  // Change 'Complete', 'In Progress', or 'Open'
];
```

### Add More Form Fields

Edit `form.html`, formConfigs object:
```javascript
HR: {
  fields: [
    { name: 'newField', label: 'New Field', type: 'text' },
    // Add more fields
  ]
}
```

### Change Theme Colors

Edit CSS variables in any file:
```css
:root {
  --brand-red: #EB1C2D;  /* Change this */
  --bg-color: #000000;   /* Or this */
}
```

---

## 🎬 Demo Presentation Tips

### Show the Process
1. Start at initial form
2. Fill out with sample data
3. Submit → Dashboard appears
4. Point out:
   - Workflow ID generated
   - 9 tasks created
   - Some pre-completed for demo
   - Process diagram

### Walk Through a Form
1. Click "Open Form" on In Progress task
2. Show workflow info at top
3. Fill out form fields
4. Submit
5. Show success with Task ID
6. Return to dashboard

### Highlight Features
- Dark professional theme
- Real-time progress tracking
- Clear visual flow
- Easy navigation
- Status badges

---

## 📊 Demo Statistics

**Forms:** 10 total (1 initial + 9 sub-forms)
**Demo Data:** 3 completed, 2 in progress, 4 open
**Navigation:** Fully button-based
**Theme:** 100% dark mode
**Standalone:** No server/database required

---

## 🚀 Converting to Production

This demo uses sessionStorage for data. For production:

1. Replace sessionStorage with:
   - Google Sheets API calls
   - Apps Script backend

2. Add authentication:
   - Google OAuth
   - User permissions

3. Enable emails:
   - Google Apps Script MailApp
   - Workflow notifications

4. Deploy as:
   - Apps Script Web App
   - Hosted on script.google.com

See `DEPLOYMENT_CHECKLIST.md` in parent directory for full deployment.

---

## ✅ Demo Checklist

Use this when presenting:

- [ ] Open index.html
- [ ] Fill sample data
- [ ] Submit form
- [ ] Show dashboard
- [ ] Point out workflow ID
- [ ] Explain process diagram
- [ ] Show progress (3/9)
- [ ] Open a sub-form
- [ ] Complete and submit
- [ ] Show success message
- [ ] Return to dashboard
- [ ] Highlight dark theme

---

## 🎉 Ready to Demo!

Just open `index.html` in your browser and start clicking! Everything is connected and works offline.

No setup. No configuration. Just demo! 🚀
