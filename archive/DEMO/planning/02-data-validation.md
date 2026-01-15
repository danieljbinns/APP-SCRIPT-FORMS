# Data Validation

## Priority: 🔴 HIGH (P1)

## Overview
Implement comprehensive client-side and server-side data validation to prevent bad data entry and ensure data integrity.

## Business Reason
- Invalid emails cause reminder failures
- Past hire dates create logical errors
- Missing required fields break workflows
- Poor data quality affects reporting
- Support burden from fixing bad data

## Technical Reason
- Data integrity at source
- Prevent database corruption
- Reduce error handling complexity
- Improve system reliability
- Better user experience with immediate feedback

## Components (Modular)

### 1. Validation Engine
**File:** `shared/validation-engine.js`
**Dependencies:** None (standalone)
**Size:** ~300 lines

```javascript
const ValidationEngine = (function() {
  // Rule-based validation system
  // Email, date, phone, required field validators
  // Custom validation rules
  // Multi-field validation (cross-field)
})();
```

### 2. Workflow Validator
**File:** `shared/workflow-validator.js`
**Dependencies:** `validation-engine.js`
**Size:** ~150 lines

```javascript
const WorkflowValidator = (function() {
  // Workflow-specific validation rules
  // Validates complete workflow objects
  // Returns structured error objects
})();
```

### 3. Form Validator (UI Helper)
**File:** `shared/form-validator.js`
**Dependencies:** `validation-engine.js`
**Size:** ~200 lines

```javascript
const FormValidator = (function() {
  // Real-time form validation
  // Shows inline error messages
  // Field-level validation on blur
  // Form-level validation on submit
})();
```

### 4. Validation Rules Library
**File:** `shared/validation-rules.js`
**Dependencies:** None (data file)
**Size:** ~100 lines

```javascript
const ValidationRules = {
  email: { regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
  required: { test: (v) => v && v.trim() !== '', message: 'Required field' },
  futureDate: { test: (v) => new Date(v) > new Date(), message: 'Must be future date' },
  phone: { regex: /^\+?1?\d{10,15}$/, message: 'Invalid phone number' },
  // ... more rules
};
```

## Validation Schema

### Workflow Schema
```javascript
const workflowSchema = {
  employee: ['required', 'minLength:2', 'maxLength:100'],
  email: ['required', 'email'],
  position: ['required', 'minLength:2'],
  hireDate: ['required', 'futureDate'],
  siteName: ['required'],
  employmentType: ['required', 'enum:Hourly,Salary']
};
```

## Integration Points

### Workflow Manager Integration
```javascript
// Update workflow-manager.js
async function createWorkflow(data) {
  const validation = WorkflowValidator.validate(data);

  if (!validation.isValid) {
    throw new ValidationError(validation.errors);
  }

  // Proceed with creation...
}
```

### Form Integration
```javascript
// In form HTML
<form id="requestForm" onsubmit="handleSubmit(event)">
  <input type="email" name="email" id="email" required>
  <span class="error-message" id="email-error"></span>
</form>

<script>
FormValidator.init('#requestForm', {
  email: ['required', 'email'],
  employee: ['required', 'minLength:2']
});
</script>
```

## CSS Requirements
**File:** `shared/validation.css`
- Error message styles (red text, icon)
- Invalid field borders (red)
- Valid field indicators (green checkmark - optional)
- Tooltip error messages

## Implementation Steps
1. Create `validation-rules.js` (1 hour)
2. Create `validation-engine.js` (3 hours)
3. Create `workflow-validator.js` (1.5 hours)
4. Create `form-validator.js` (2.5 hours)
5. Create `validation.css` (1 hour)
6. Integrate into workflow-manager.js (1 hour)
7. Integrate into index.html (main form) (1.5 hours)
8. Integrate into all 9 sub-forms (2 hours)
9. Add backend validation to ReminderService.gs (1.5 hours)
10. Test all validation scenarios (2 hours)

**Total Effort:** ~17 hours

## Validation Rules Coverage

### Required Validations
- Email format
- Required fields
- Future dates (hire date)
- Phone numbers
- Text length (min/max)
- Enum values (dropdowns)
- Numeric ranges

### Optional Validations
- URL format
- SSN format (if needed)
- ZIP code format
- Custom regex patterns
- Cross-field validation (e.g., end date > start date)

## Error Message Strategy

### User-Friendly Messages
```javascript
{
  'email': 'Please enter a valid email address',
  'required': 'This field is required',
  'futureDate': 'Hire date must be in the future',
  'minLength:2': 'Must be at least 2 characters',
  'phone': 'Please enter a valid phone number (10-15 digits)'
}
```

### Inline vs Toast
- **Inline**: Field-level validation errors (shown below field)
- **Toast**: Form-level submission errors (shown at top)

## Testing Requirements
- Valid data passes all checks
- Invalid email rejected
- Past dates rejected
- Required fields enforced
- Error messages display correctly
- Multi-field validation works
- Backend validation matches frontend

## Success Metrics
- Zero invalid workflows created
- Reduced support tickets for data errors
- Better data quality in reports
- Improved user experience with real-time feedback

## Files to Create
- `shared/validation-engine.js`
- `shared/workflow-validator.js`
- `shared/form-validator.js`
- `shared/validation-rules.js`
- `shared/validation.css`

## Files to Modify
- `shared/workflow-manager.js` (add validation calls)
- `index.html` (add form validation)
- All 9 form files (add validation)
- `backend/ReminderService.gs` (add server validation)

## Dependencies
- None for core validation
- Optional: `toast-notifications.js` for error display (from P1)

## Risk Assessment
**Low Risk** - Validation is additive and non-breaking. Can be rolled out incrementally per form.

## Rollout Strategy
1. **Phase 1**: Add to workflow-manager.js (backend validation)
2. **Phase 2**: Add to main form (index.html)
3. **Phase 3**: Add to admin dashboard
4. **Phase 4**: Add to all 9 sub-forms
