# Quick Start Guide - Using New Features

This guide shows you how to use the newly implemented Error Handling and Data Validation features in your REQUEST_FORMS application.

---

## 🚀 Getting Started

### 1. Include Required Files

Add these files to your HTML in this order:

```html
<!-- Validation (optional but recommended) -->
<link rel="stylesheet" href="shared/validation.css">
<script src="shared/validation-rules.js"></script>
<script src="shared/validation-engine.js"></script>
<script src="shared/workflow-validator.js"></script>
<script src="shared/form-validator.js"></script>

<!-- Error Handling & Notifications -->
<link rel="stylesheet" href="shared/notifications.css">
<script src="shared/toast-notifications.js"></script>
<script src="shared/loading-overlay.js"></script>
<script src="shared/error-handler.js"></script>
<script src="shared/confirmation-dialog.js"></script>

<!-- Your existing files -->
<script src="shared/workflow-manager.js"></script>
```

### 2. Initialize on Page Load

```javascript
document.addEventListener('DOMContentLoaded', function() {
  // Initialize error handling
  ErrorHandler.init({
    showStack: false,
    logErrors: true,
    showToast: true
  });

  ToastManager.init({
    duration: 3000,
    position: 'top-right'
  });

  LoadingOverlay.init({
    minDisplayTime: 300
  });

  ConfirmDialog.init();
});
```

---

## 💡 Common Use Cases

### Show Success Message

```javascript
ToastManager.success('Workflow created successfully!');
```

### Show Error Message

```javascript
ToastManager.error('Failed to send reminder');
```

### Show Loading Spinner

```javascript
async function saveWorkflow(data) {
  LoadingOverlay.show('Saving workflow...');

  try {
    await WorkflowManager.createWorkflow(data);
    LoadingOverlay.hide();
    ToastManager.success('Workflow saved!');
  } catch (error) {
    LoadingOverlay.hide();
    ToastManager.error('Failed to save workflow');
  }
}
```

### Ask for Confirmation

```javascript
async function deleteWorkflow(id) {
  const confirmed = await ConfirmDialog.confirmDanger(
    'Delete Workflow',
    'This action cannot be undone. Are you sure?'
  );

  if (confirmed) {
    // Delete the workflow
    ToastManager.success('Workflow deleted');
  }
}
```

### Validate Form Data

```javascript
// Define validation schema
const schema = {
  employee: ['required', 'minLength:2'],
  email: ['required', 'email'],
  hireDate: ['required', 'date', 'futureDate'],
  position: ['required']
};

// Initialize form validator
FormValidator.init('#myForm', schema, {
  validateOnBlur: true,
  scrollToFirstError: true,
  onSubmit: async (data) => {
    await WorkflowManager.createWorkflow(data);
  }
});
```

### Validate Data Manually

```javascript
const workflowData = {
  employee: 'John Smith',
  email: 'john@example.com',
  hireDate: '2025-12-15'
  // ... more fields
};

const result = WorkflowValidator.validateWorkflow(workflowData);

if (!result.isValid) {
  const errors = WorkflowValidator.getErrorMessages(result);
  ToastManager.error(errors[0]);
} else {
  // Create workflow
  await WorkflowManager.createWorkflow(workflowData);
}
```

---

## 📝 Form Integration Example

### HTML Form

```html
<form id="newWorkflowForm">
  <div class="form-group">
    <label for="employee" class="required">Employee Name</label>
    <input type="text" id="employee" name="employee" required>
    <span class="error-message"></span>
  </div>

  <div class="form-group">
    <label for="email" class="required">Email</label>
    <input type="email" id="email" name="email" required>
    <span class="error-message"></span>
  </div>

  <div class="form-group">
    <label for="hireDate" class="required">Hire Date</label>
    <input type="date" id="hireDate" name="hireDate" required>
    <span class="error-message"></span>
  </div>

  <button type="submit">Create Workflow</button>
</form>
```

### JavaScript

```javascript
// Initialize form validation
FormValidator.init('#newWorkflowForm', {
  employee: ['required', 'minLength:2', 'maxLength:100'],
  email: ['required', 'email'],
  hireDate: ['required', 'date', 'futureDate'],
  position: ['required', 'minLength:2'],
  siteName: ['required'],
  supervisorName: ['required', 'minLength:2'],
  supervisorEmail: ['required', 'email'],
  employmentType: ['required', 'enum:Hourly,Salary']
}, {
  validateOnBlur: true,
  validateOnInput: false,
  scrollToFirstError: true,
  onSubmit: handleFormSubmit
});

async function handleFormSubmit(data) {
  try {
    await WorkflowManager.createWorkflow(data);
    // Success handled by WorkflowManager (shows toast)
    document.getElementById('newWorkflowForm').reset();
  } catch (error) {
    // Error handled by ErrorHandler (shows toast)
  }
}
```

---

## 🎨 Styling Validation

### Error States

Fields with errors automatically get the `.is-invalid` class:

```css
.is-invalid {
  border-color: #db4437 !important;
  border-width: 2px !important;
  background-color: rgba(219, 68, 55, 0.05);
}
```

Error messages have the `.error-message` class:

```css
.error-message {
  color: #db4437;
  font-size: 0.875rem;
  margin-top: 4px;
}
```

### Success States (Optional)

To show success states on valid fields:

```javascript
FormValidator.init('#myForm', schema, {
  validClass: 'is-valid' // Enable success states
});
```

---

## 🔧 Customization

### Custom Validation Rule

```javascript
// Register a custom rule
ValidationRules.register('phoneExtension', {
  test: (value) => {
    if (!value) return true;
    return /^\d{3,5}$/.test(value);
  },
  message: 'Extension must be 3-5 digits'
});

// Use in schema
const schema = {
  extension: ['phoneExtension']
};
```

### Custom Toast Position

```javascript
ToastManager.init({
  position: 'bottom-right', // or 'top-left', 'top-center', etc.
  duration: 5000 // 5 seconds
});
```

### Custom Loading Message

```javascript
LoadingOverlay.show('Please wait while we process your request...');
```

### Custom Confirmation Dialog

```javascript
const confirmed = await ConfirmDialog.confirm({
  title: 'Are you sure?',
  message: 'This will send emails to 50 people',
  confirmText: 'Send Emails',
  cancelText: 'Cancel',
  type: 'warning' // 'default', 'danger', or 'warning'
});
```

---

## 🐛 Troubleshooting

### Validation Not Working

1. **Check file order** - Validation files must load before workflow-manager.js
2. **Check schema** - Make sure field names match HTML input names
3. **Check console** - Look for JavaScript errors

### Toasts Not Appearing

1. **Check initialization** - Call `ToastManager.init()` on page load
2. **Check CSS** - Make sure notifications.css is included
3. **Check z-index** - Toasts use z-index: 10000

### Form Not Submitting

1. **Check validation** - Form won't submit if invalid
2. **Check errors** - Look for `.error-message` elements
3. **Check console** - Look for validation error logs

### Loading Overlay Stuck

1. **Check error handling** - Make sure `LoadingOverlay.hide()` is called in finally/catch
2. **Check async** - Ensure all promises resolve or reject

---

## 📚 Full API Documentation

For complete API reference, see:
- **Error Handling:** `IMPLEMENTATION_SUMMARY_ERROR_HANDLING.md`
- **Data Validation:** `IMPLEMENTATION_SUMMARY_DATA_VALIDATION.md`
- **Testing:** `ERROR_HANDLING_TEST_PLAN.md`

---

## ✅ Checklist for New Forms

When creating a new form, follow these steps:

- [ ] Include validation CSS and JS files
- [ ] Include notification CSS and JS files
- [ ] Add `.error-message` spans below each input
- [ ] Initialize FormValidator with schema
- [ ] Define validation rules for each field
- [ ] Add `required` class to required field labels
- [ ] Implement onSubmit handler
- [ ] Test all validation scenarios
- [ ] Test error messages display correctly
- [ ] Test success flow end-to-end

---

## 🎯 Best Practices

1. **Always validate** - Both client-side (FormValidator) and server-side (WorkflowValidator)
2. **Show clear feedback** - Use toasts for success/error, inline errors for form fields
3. **Use loading states** - Always show loading overlay for async operations
4. **Confirm destructive actions** - Use ConfirmDialog.confirmDanger() for deletes
5. **Sanitize data** - WorkflowValidator.validateAndSanitizeWorkflow() does this automatically
6. **Handle all errors** - Wrap async operations in try-catch
7. **Keep it accessible** - Error handling is built-in, just use the tools correctly

---

**Need Help?** Check the full documentation or review the example code in `admin-dashboard.html`
