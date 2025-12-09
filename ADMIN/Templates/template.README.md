# Template Files for New Forms

This folder contains template files to help you create new forms quickly with consistent structure and naming.

---

## Available Templates

### 1. `template.form-validator.js`
**Purpose:** Form-specific validation logic with custom schemas

**How to use:**
```bash
# 1. Copy to your form folder
cp ADMIN/Templates/template.form-validator.js \
   FORMS/EmployeeRequestForms/forms/YourForm/yourform.validator.js

# 2. Edit the file:
#    - Replace all FORMNAME with yourform
#    - Update formSchema with your fields
#    - Add any form-specific validation logic

# 3. Include in your form HTML:
<script src="../../scripts/validation/shared.validation-engine.js"></script>
<script src="../../scripts/validation/shared.validation-rules.js"></script>
<script src="yourform.validator.js"></script>

# 4. Use in your form:
const result = YourFormValidator.validateForm(formData);
if (!result.isValid) {
  console.log(YourFormValidator.getFirstError(result));
}
```

---

## Naming Convention

### Files You Create Should Follow:

**Form-Specific Files:** `formname.purpose.ext`
- `hr.validator.js` - HR form validator
- `it.config.js` - IT form config
- `fleetio.helper.js` - Fleetio helper functions

**Shared Files (Already Exist):** `shared.purpose.ext`
- `shared.validation-engine.js` - Generic validation engine
- `shared.toast-notifications.js` - Generic UI component

**Template Files (For Copying):** `template.purpose.ext`
- `template.form-validator.js` - Template validator
- `template.config.js` - Template config

---

## Quick Start: Creating a New Form

### Step 1: Create Form Folder
```bash
cd FORMS/EmployeeRequestForms/forms
mkdir MyNewForm
cd MyNewForm
```

### Step 2: Create Basic Files
```bash
# Form HTML
touch Form.html

# Server-side logic
touch Code.gs

# Configuration
touch Config.gs

# Documentation
touch README.md
```

### Step 3: Copy and Customize Template Validator
```bash
# Copy template
cp ../../../ADMIN/Templates/template.form-validator.js mynewform.validator.js

# Edit mynewform.validator.js:
# - Replace FORMNAME with MyNewForm
# - Update formSchema with your fields
```

### Step 4: Set Up Form HTML
```html
<!DOCTYPE html>
<html>
<head>
  <title>My New Form</title>

  <!-- Shared styles from project level -->
  <link rel="stylesheet" href="../../styles/shared.main.css">
  <link rel="stylesheet" href="../../styles/shared.validation.css">
  <link rel="stylesheet" href="../../styles/shared.notifications.css">

  <!-- Shared scripts from project level -->
  <script src="../../scripts/validation/shared.validation-rules.js"></script>
  <script src="../../scripts/validation/shared.validation-engine.js"></script>
  <script src="../../scripts/ui/shared.toast-notifications.js"></script>
  <script src="../../scripts/ui/shared.loading-overlay.js"></script>

  <!-- Form-specific validator (in this folder) -->
  <script src="mynewform.validator.js"></script>
</head>
<body>
  <form id="myNewForm">
    <!-- Your form fields here -->
  </form>

  <script>
    // Initialize UI components
    ToastManager.init();
    LoadingOverlay.init();

    // Handle form submission
    document.getElementById('myNewForm').addEventListener('submit', function(e) {
      e.preventDefault();

      // Get form data
      const formData = {
        field1: document.getElementById('field1').value,
        field2: document.getElementById('field2').value
        // ... more fields
      };

      // Validate using form-specific validator
      const result = MyNewFormValidator.validateForm(formData);

      if (!result.isValid) {
        const errorMsg = MyNewFormValidator.getFirstError(result);
        ToastManager.error(errorMsg);
        return;
      }

      // Submit valid data
      submitForm(formData);
    });

    function submitForm(data) {
      LoadingOverlay.show('Submitting...');

      google.script.run
        .withSuccessHandler(function(response) {
          LoadingOverlay.hide();
          ToastManager.success('Form submitted successfully!');
        })
        .withFailureHandler(function(error) {
          LoadingOverlay.hide();
          ToastManager.error('Submission failed: ' + error.message);
        })
        .submitMyNewForm(data);
    }
  </script>
</body>
</html>
```

---

## Folder Structure Reference

```
FORMS/EmployeeRequestForms/
│
├── styles/                    # SHARED styles (all forms use these)
│   ├── shared.main.css
│   ├── shared.notifications.css
│   └── shared.validation.css
│
├── scripts/                   # SHARED scripts (all forms use these)
│   ├── validation/
│   │   ├── shared.validation-rules.js
│   │   ├── shared.validation-engine.js
│   │   └── shared.form-validator.js
│   │
│   └── ui/
│       ├── shared.toast-notifications.js
│       ├── shared.loading-overlay.js
│       └── shared.error-handler.js
│
└── forms/                     # Individual forms (form-specific files only)
    ├── MyNewForm/
    │   ├── Form.html
    │   ├── Code.gs
    │   ├── Config.gs
    │   ├── mynewform.validator.js    ← Form-specific validator
    │   └── README.md
    │
    └── [Other forms...]
```

---

## Best Practices

### ✅ DO:
- Use `shared.*` modules for generic, reusable functionality
- Create `formname.*` files only for form-specific logic
- Reference shared modules from project level (../../scripts/, ../../styles/)
- Keep forms lightweight - let them use shared modules
- Follow naming convention strictly

### ❌ DON'T:
- Copy shared modules into your form folder
- Create duplicate validation logic
- Hardcode styles in HTML - use shared CSS
- Ignore naming convention

---

## Available Shared Modules

### Validation:
- `shared.validation-rules.js` - 18+ validation rules (required, email, phone, etc.)
- `shared.validation-engine.js` - Generic validation engine
- `shared.form-validator.js` - Real-time form validation with UI

### UI Components:
- `shared.toast-notifications.js` - Success/error/warning toasts
- `shared.loading-overlay.js` - Loading spinners
- `shared.error-handler.js` - Centralized error handling
- `shared.confirmation-dialog.js` - Confirmation dialogs
- `shared.theme-toggle.js` - Dark/light theme switching

### Workflow:
- `shared.workflow-manager.js` - Generic workflow management

### Styles:
- `shared.main.css` - Base styles
- `shared.notifications.css` - Toast notification styles
- `shared.validation.css` - Validation UI styles
- `shared.theme-toggle.css` - Theme toggle styles

---

## Questions?

See:
- `COMPLETE_AUDIT_AND_REORGANIZATION.md` - Full audit and structure explanation
- `MODULE_PLACEMENT_GUIDE.md` - Detailed guide on what goes where
- `FORMS/EmployeeRequestForms/forms/InitialRequest/` - Example form implementation
