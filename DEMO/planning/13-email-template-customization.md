# Email Template Customization

## Priority: 🟢 LOW (P3)

## Overview
Allow administrators to customize reminder email templates with variables and branding.

## Business Reason
- Brand consistency
- Customize messaging per audience
- A/B test email effectiveness
- Localization support

## Components (Modular)

### 1. Template Engine
**File:** `shared/template-engine.js` (~300 lines)
- Variable substitution
- Conditional blocks
- Loops for lists
- HTML rendering

### 2. Template Editor UI
**File:** `shared/template-editor.js` (~350 lines)
- Visual template editor
- Live preview
- Variable picker
- Save/load templates

### 3. Backend Template Renderer
**File:** Update `backend/ReminderService.gs` (~100 lines)
- Load custom templates
- Render with workflow data
- Fallback to default

## Features
- ✏️ Visual template editor
- 📧 Multiple template types (reminder, welcome, overdue)
- 🔤 Variable system ({{employee}}, {{hireDate}})
- 👁️ Live preview
- 💾 Save custom templates
- 📋 Template library
- 🌍 Multi-language support

## Template Variables
```
{{employee}}         - Employee name
{{workflowId}}       - Workflow ID
{{position}}         - Job position
{{hireDate}}         - Hire date
{{daysUntilHire}}    - Days until hire
{{incompleteTasks}}  - List of tasks
{{siteN ame}}         - Job site
{{managerName}}      - Manager name
```

## Implementation: 12-15 hours

## Files to Create
- `shared/template-engine.js`
- `shared/template-editor.js`
- `email-templates/` (folder with default templates)

## Files to Modify
- `backend/ReminderService.gs` (use templates)

**Priority:** P3 - Customization feature
**Risk:** Medium - Affects email sending
**Testing:** Extensive email testing required
