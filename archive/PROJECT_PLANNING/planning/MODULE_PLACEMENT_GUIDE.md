# Module Placement Guide - What Goes Where?

## The Question
Should a module be:
- **SHARED** (in `scripts/` at project level, used by ALL forms)
- **FORM-SPECIFIC** (in individual form folder, only used by that form)
- **TEMPLATE** (in ADMIN/Templates/, copied and customized per form)

---

## Decision Framework

### ✅ SHARED Modules (Project-level `scripts/`)

**Use when ALL of these are true:**
1. **Generic/Reusable** - Works for any form without modification
2. **No form-specific hardcoding** - No schemas, field names, or business rules baked in
3. **Lightweight** - Small enough that loading it doesn't slow forms down
4. **Stable** - Rarely changes, or changes benefit all forms

**Examples:**
- ✅ `validation-engine.js` - Generic validation engine (takes ANY schema as input)
- ✅ `validation-rules.js` - Generic validation rules library (required, email, phone, etc.)
- ✅ `toast-notifications.js` - Generic UI component
- ✅ `loading-overlay.js` - Generic UI component
- ✅ `error-handler.js` - Generic error handling
- ✅ `confirmation-dialog.js` - Generic UI component
- ✅ `theme-toggle.js` - Generic theme switcher

**Why Shared:**
```javascript
// validation-engine.js is GENERIC
// It doesn't care WHAT you're validating, just HOW
const result = ValidationEngine.validate(anyData, anySchema);

// toast-notifications.js is GENERIC
// Works the same for any form
ToastManager.success('Any message from any form');
```

---

### ❌ FORM-SPECIFIC Modules (In form folder)

**Use when ANY of these are true:**
1. **Hardcoded schemas** - Contains specific field names, validation rules for THIS form only
2. **Business logic** - Contains business rules specific to this form/workflow
3. **Heavy/Large** - Would slow down other forms if included unnecessarily
4. **Frequently changing** - Changes often and only affects this form

**Examples:**
- ❌ `workflow-validator.js` - Has hardcoded `workflowSchema` with specific field names (employee, email, hireDate, etc.)
- ❌ `hr-form-config.js` - HR-specific configuration
- ❌ `it-provisioning-logic.js` - IT-specific business logic

**Why Form-Specific:**
```javascript
// workflow-validator.js is FORM-SPECIFIC
// It has hardcoded schemas for REQUEST_FORMS workflow
const workflowSchema = {
  employee: ['required', 'minLength:2'],
  email: ['required', 'email'],
  hireDate: ['required', 'date', 'futureDate'],
  // ... specific to THIS workflow
};
```

**Where it goes:**
```
FORMS/EmployeeRequestForms/forms/InitialRequest/
  ├── index.html
  ├── Code.gs
  ├── Config.gs
  ├── workflow-validator.js          ← Form-specific, stays here
  └── README.md
```

---

### 📋 TEMPLATE Modules (ADMIN/Templates/)

**Use when:**
1. **Common pattern** - Many forms need similar logic
2. **But customized** - Each form customizes it differently
3. **Copy & customize** - Not loaded, but copied to new forms and modified

**Examples:**
- 📋 `validation-schema-template.js` - Template showing how to create a form schema
- 📋 `form-config-template.js` - Template for form configuration
- 📋 `form-logic-template.gs` - Template for Code.gs with common patterns

**Usage:**
```bash
# When creating a new form, copy template and customize
cp ADMIN/Templates/validation-schema-template.js \
   FORMS/EmployeeRequestForms/forms/NewForm/validation-schema.js

# Then edit validation-schema.js with form-specific fields
```

---

## Current Module Analysis

### From DEMO/shared/ - What Should We Do?

| Module | Type | Placement | Reason |
|--------|------|-----------|--------|
| `validation-rules.js` | ✅ SHARED | `scripts/validation/` | Generic rules, no hardcoding |
| `validation-engine.js` | ✅ SHARED | `scripts/validation/` | Generic engine, takes any schema |
| `workflow-validator.js` | ❌ FORM-SPECIFIC | `forms/InitialRequest/` | Has hardcoded schemas for REQUEST_FORMS |
| `form-validator.js` | ⚠️ DEPENDS | TBD | Need to check if generic or has hardcoding |
| `toast-notifications.js` | ✅ SHARED | `scripts/ui/` | Generic UI component |
| `loading-overlay.js` | ✅ SHARED | `scripts/ui/` | Generic UI component |
| `error-handler.js` | ✅ SHARED | `scripts/ui/` | Generic error handling |
| `confirmation-dialog.js` | ✅ SHARED | `scripts/ui/` | Generic UI component |
| `theme-toggle.js` | ✅ SHARED | `scripts/ui/` | Generic theme switcher |
| `workflow-manager.js` | ⚠️ DEPENDS | TBD | Need to check - workflow specific? |

### Let me check the questionable ones:

**`form-validator.js`** - Need to check if it's generic or has form-specific logic
**`workflow-manager.js`** - Need to check if it's workflow-specific

---

## Proposed Structure with Correct Placement

```
FORMS/EmployeeRequestForms/
│
├── scripts/                               # SHARED - Generic, reusable
│   ├── validation/
│   │   ├── validation-rules.js            ✅ Generic rules library
│   │   └── validation-engine.js           ✅ Generic validation engine
│   │
│   └── ui/
│       ├── toast-notifications.js         ✅ Generic UI
│       ├── loading-overlay.js             ✅ Generic UI
│       ├── error-handler.js               ✅ Generic error handling
│       ├── confirmation-dialog.js         ✅ Generic UI
│       └── theme-toggle.js                ✅ Generic theme
│
├── styles/                                # SHARED - Used by all forms
│   ├── main.css
│   ├── notifications.css
│   └── validation.css
│
└── forms/
    ├── InitialRequest/
    │   ├── index.html
    │   ├── Code.gs
    │   ├── Config.gs
    │   ├── workflow-validator.js          ❌ Form-specific (hardcoded schemas)
    │   └── README.md
    │
    └── HR/
        ├── Form.html
        ├── Code.gs
        ├── Config.gs
        ├── hr-validator.js                ❌ Form-specific (HR schemas)
        └── README.md
```

---

## How to Use

### For Generic Shared Modules:
```html
<!-- Any form can include these -->
<script src="../../scripts/validation/validation-engine.js"></script>
<script src="../../scripts/ui/toast-notifications.js"></script>

<script>
  // Use with form-specific schema
  const mySchema = { email: ['required', 'email'] };
  const result = ValidationEngine.validate(data, mySchema);
</script>
```

### For Form-Specific Modules:
```html
<!-- InitialRequest/index.html -->
<script src="../../scripts/validation/validation-engine.js"></script>  ✅ Shared
<script src="workflow-validator.js"></script>                          ❌ Form-specific

<script>
  // Use form-specific validator that has schemas built-in
  const result = WorkflowValidator.validateWorkflow(data);
</script>
```

---

## Benefits of This Approach

### ✅ Performance
- Forms only load what they need
- No huge generic modules with unused code
- Fast page loads

### ✅ Maintainability
- Shared modules benefit all forms when updated
- Form-specific changes don't break other forms
- Clear separation of concerns

### ✅ Scalability
- New forms can use shared modules immediately
- Can create form-specific logic without affecting others
- Templates make creating new forms easy

---

## Next Steps

1. **Audit remaining modules** - Check `form-validator.js` and `workflow-manager.js`
2. **Categorize each** - Shared vs. Form-specific vs. Template
3. **Place accordingly** - Move to correct locations
4. **Update references** - Fix HTML includes with correct paths
5. **Test** - Ensure forms still work

**Should I audit the remaining modules to determine their correct placement?**
