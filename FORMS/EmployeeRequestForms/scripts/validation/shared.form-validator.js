/**
 * Form Validator (UI Helper)
 *
 * Provides real-time form validation with visual feedback.
 * Automatically attaches to forms and shows inline error messages.
 *
 * Dependencies: validation-engine.js, validation-rules.js
 *
 * Usage:
 *   FormValidator.init('#myForm', {
 *     email: ['required', 'email'],
 *     name: ['required', 'minLength:2']
 *   });
 */

const FormValidator = (function() {
  'use strict';

  // Active form validators
  const formValidators = new Map();

  // Configuration defaults
  const defaults = {
    validateOnBlur: true,
    validateOnInput: false,
    validateOnSubmit: true,
    showInlineErrors: true,
    showToastOnError: false,
    scrollToFirstError: true,
    errorClass: 'is-invalid',
    validClass: 'is-valid',
    errorMessageClass: 'error-message',
    submitButton: 'button[type="submit"]'
  };

  /**
   * Initialize form validation
   *
   * @param {string|HTMLElement} formSelector - Form selector or element
   * @param {Object} schema - Validation schema
   * @param {Object} options - Configuration options
   * @returns {Object} Validator instance
   */
  function init(formSelector, schema, options = {}) {
    const form = typeof formSelector === 'string'
      ? document.querySelector(formSelector)
      : formSelector;

    if (!form) {
      console.error('Form not found:', formSelector);
      return null;
    }

    const config = { ...defaults, ...options };

    // Create validator instance
    const validator = {
      form,
      schema,
      config,
      errors: {},
      touched: new Set()
    };

    // Attach event listeners
    attachEventListeners(validator);

    // Store validator
    formValidators.set(form, validator);

    return validator;
  }

  /**
   * Attach event listeners to form and fields
   */
  function attachEventListeners(validator) {
    const { form, schema, config } = validator;

    // Form submit handler
    if (config.validateOnSubmit) {
      form.addEventListener('submit', (e) => handleSubmit(e, validator));
    }

    // Field-level validation
    for (const fieldName in schema) {
      const field = form.elements[fieldName];

      if (!field) {
        console.warn(`Field not found in form: ${fieldName}`);
        continue;
      }

      // Blur validation
      if (config.validateOnBlur) {
        field.addEventListener('blur', () => {
          validator.touched.add(fieldName);
          validateSingleField(validator, fieldName);
        });
      }

      // Input validation (real-time)
      if (config.validateOnInput) {
        field.addEventListener('input', () => {
          if (validator.touched.has(fieldName)) {
            validateSingleField(validator, fieldName);
          }
        });
      }
    }
  }

  /**
   * Validate a single field
   */
  function validateSingleField(validator, fieldName) {
    const { form, schema, config } = validator;
    const field = form.elements[fieldName];

    if (!field) return;

    const value = getFieldValue(field);
    const rules = schema[fieldName];

    const result = ValidationEngine.validateField(value, rules, fieldName);

    if (result.isValid) {
      clearFieldError(validator, fieldName);
      if (config.validClass) {
        field.classList.add(config.validClass);
      }
    } else {
      showFieldError(validator, fieldName, result.errors[0].message);
      if (config.validClass) {
        field.classList.remove(config.validClass);
      }
    }

    // Update validator errors
    if (result.isValid) {
      delete validator.errors[fieldName];
    } else {
      validator.errors[fieldName] = result.errors;
    }

    return result.isValid;
  }

  /**
   * Validate entire form
   */
  function validateForm(validator) {
    const { form, schema } = validator;
    const formData = getFormData(form);

    const result = ValidationEngine.validate(formData, schema);

    // Update validator state
    validator.errors = result.errors;

    // Show all errors
    if (!result.isValid && validator.config.showInlineErrors) {
      showAllErrors(validator, result.errors);
    }

    return result;
  }

  /**
   * Handle form submit
   */
  function handleSubmit(event, validator) {
    event.preventDefault();

    const result = validateForm(validator);

    if (!result.isValid) {
      // Show errors
      if (validator.config.showInlineErrors) {
        showAllErrors(validator, result.errors);
      }

      // Show toast notification if available and configured
      if (validator.config.showToastOnError && typeof ToastManager !== 'undefined') {
        const firstError = ValidationEngine.getFirstError(result.errors);
        ToastManager.error(firstError || 'Please fix the errors in the form');
      }

      // Scroll to first error
      if (validator.config.scrollToFirstError) {
        scrollToFirstError(validator);
      }

      // Disable submit button temporarily
      const submitBtn = validator.form.querySelector(validator.config.submitButton);
      if (submitBtn) {
        submitBtn.disabled = true;
        setTimeout(() => {
          submitBtn.disabled = false;
        }, 1000);
      }

      return;
    }

    // Form is valid - trigger custom submit handler if provided
    if (validator.config.onSubmit) {
      validator.config.onSubmit(result.data, event);
    } else {
      // Default behavior - submit form
      validator.form.submit();
    }
  }

  /**
   * Show error for a single field
   */
  function showFieldError(validator, fieldName, message) {
    const { form, config } = validator;
    const field = form.elements[fieldName];

    if (!field) return;

    // Add error class to field
    field.classList.add(config.errorClass);
    field.classList.remove(config.validClass);

    // Find or create error message element
    let errorElement = field.parentElement.querySelector(`.${config.errorMessageClass}`);

    if (!errorElement) {
      errorElement = document.createElement('span');
      errorElement.className = config.errorMessageClass;
      errorElement.setAttribute('role', 'alert');
      errorElement.setAttribute('aria-live', 'polite');

      // Insert after field
      field.parentElement.appendChild(errorElement);
    }

    errorElement.textContent = message;
    errorElement.style.display = 'block';

    // Set aria-invalid
    field.setAttribute('aria-invalid', 'true');
  }

  /**
   * Clear error for a single field
   */
  function clearFieldError(validator, fieldName) {
    const { form, config } = validator;
    const field = form.elements[fieldName];

    if (!field) return;

    // Remove error class
    field.classList.remove(config.errorClass);

    // Hide error message
    const errorElement = field.parentElement.querySelector(`.${config.errorMessageClass}`);
    if (errorElement) {
      errorElement.style.display = 'none';
      errorElement.textContent = '';
    }

    // Remove aria-invalid
    field.removeAttribute('aria-invalid');
  }

  /**
   * Show all errors in the form
   */
  function showAllErrors(validator, errors) {
    for (const fieldName in errors) {
      const fieldErrors = errors[fieldName];
      if (fieldErrors && fieldErrors.length > 0) {
        showFieldError(validator, fieldName, fieldErrors[0].message);
      }
    }
  }

  /**
   * Clear all errors in the form
   */
  function clearAllErrors(validator) {
    const { form, schema } = validator;

    for (const fieldName in schema) {
      clearFieldError(validator, fieldName);
    }

    validator.errors = {};
  }

  /**
   * Scroll to first error field
   */
  function scrollToFirstError(validator) {
    const { form, config } = validator;
    const firstErrorField = form.querySelector(`.${config.errorClass}`);

    if (firstErrorField) {
      firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstErrorField.focus();
    }
  }

  /**
   * Get value from form field
   */
  function getFieldValue(field) {
    if (field.type === 'checkbox') {
      return field.checked;
    } else if (field.type === 'radio') {
      const form = field.form;
      const checked = form.querySelector(`input[name="${field.name}"]:checked`);
      return checked ? checked.value : null;
    } else if (field.tagName === 'SELECT' && field.multiple) {
      return Array.from(field.selectedOptions).map(opt => opt.value);
    } else {
      return field.value;
    }
  }

  /**
   * Get all form data as object
   */
  function getFormData(form) {
    const formData = new FormData(form);
    const data = {};

    for (const [key, value] of formData.entries()) {
      // Handle multiple values (e.g., checkboxes with same name)
      if (data[key]) {
        if (Array.isArray(data[key])) {
          data[key].push(value);
        } else {
          data[key] = [data[key], value];
        }
      } else {
        data[key] = value;
      }
    }

    return data;
  }

  /**
   * Manually validate form
   */
  function validate(formSelector) {
    const form = typeof formSelector === 'string'
      ? document.querySelector(formSelector)
      : formSelector;

    const validator = formValidators.get(form);

    if (!validator) {
      console.error('Form validator not initialized');
      return { isValid: false, errors: {} };
    }

    return validateForm(validator);
  }

  /**
   * Reset form validation state
   */
  function reset(formSelector) {
    const form = typeof formSelector === 'string'
      ? document.querySelector(formSelector)
      : formSelector;

    const validator = formValidators.get(form);

    if (!validator) {
      console.error('Form validator not initialized');
      return;
    }

    clearAllErrors(validator);
    validator.touched.clear();
    form.reset();
  }

  /**
   * Get validator instance
   */
  function getInstance(formSelector) {
    const form = typeof formSelector === 'string'
      ? document.querySelector(formSelector)
      : formSelector;

    return formValidators.get(form);
  }

  /**
   * Destroy validator instance
   */
  function destroy(formSelector) {
    const form = typeof formSelector === 'string'
      ? document.querySelector(formSelector)
      : formSelector;

    const validator = formValidators.get(form);

    if (validator) {
      // Remove event listeners would go here
      // (In practice, might want to keep track of listeners to remove them)
      formValidators.delete(form);
    }
  }

  /**
   * Update validation schema dynamically
   */
  function updateSchema(formSelector, newSchema) {
    const validator = getInstance(formSelector);

    if (validator) {
      validator.schema = { ...validator.schema, ...newSchema };
    }
  }

  /**
   * Manually trigger field validation
   */
  function validateField(formSelector, fieldName) {
    const validator = getInstance(formSelector);

    if (validator) {
      return validateSingleField(validator, fieldName);
    }

    return false;
  }

  /**
   * Check if form is valid
   */
  function isValid(formSelector) {
    const result = validate(formSelector);
    return result.isValid;
  }

  // Public API
  return {
    init,
    validate,
    validateField,
    reset,
    isValid,
    getInstance,
    destroy,
    updateSchema
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormValidator;
}
