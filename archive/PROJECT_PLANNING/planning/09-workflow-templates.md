# Workflow Templates

## Priority: 🟡 MEDIUM (P2)

## Overview
Pre-configured workflow templates for different employee types (standard, contractor, executive, etc.)

## Business Reason
- Faster workflow creation
- Consistency across similar roles
- Reduce setup errors
- Best practices enforcement

## Components (Modular)

### 1. Template Manager
**File:** `shared/template-manager.js` (~300 lines)
- Load templates
- Create from template
- Custom template creation
- Template versioning

### 2. Template Library
**File:** `shared/template-library.js` (~200 lines)
- Default templates
- Custom templates
- Template categories
- Template sharing

### 3. Template UI
**File:** `shared/template-ui.js` (~250 lines)
- Template selector
- Preview template
- Customize before create

## Default Templates

### 1. Standard Employee Onboarding
```javascript
{
  name: 'Standard Employee',
  tasks: ['HR', 'IT', 'FLEETIO', 'CREDITCARD', 'REVIEW',
          'ADP_SUP', 'ADP_MGR', 'JONAS', 'SITEDOCS'],
  timeline: 14 // days
}
```

### 2. Contractor Onboarding
```javascript
{
  name: 'Contractor',
  tasks: ['HR', 'IT', 'SITEDOCS'],
  timeline: 7
}
```

### 3. Executive Onboarding
```javascript
{
  name: 'Executive',
  tasks: ['HR', 'IT', 'CREDITCARD', 'ADP_MGR', 'JONAS'],
  timeline: 21
}
```

## Features
- 📋 Template library
- ➕ Create from template
- ✏️ Customize templates
- 💾 Save custom templates
- 📤 Share templates
- 📊 Template usage analytics

## Implementation: 10-12 hours

## Files to Create
- `shared/template-manager.js`
- `shared/template-library.js`
- `shared/template-ui.js`

**Priority:** P2 - Time savings on creation
**Risk:** Low - Optional feature
