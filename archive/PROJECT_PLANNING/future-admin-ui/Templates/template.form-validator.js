/**
 * TEMPLATE: Form-Specific Validator
 *
 * Copy this file when creating a new form.
 * Replace FORMNAME with your form name (lowercase, e.g., hr, it, fleetio).
 * Update the schema with your form's specific fields and validation rules.
 *
 * Dependencies:
 *   - ../../scripts/validation/shared.validation-engine.js
 *   - ../../scripts/validation/shared.validation-rules.js
 *
 * Usage:
 *   1. Copy to your form folder: forms/YourForm/formname.validator.js
 *   2. Replace all instances of FORMNAME with your form's name
 *   3. Update formSchema with your form's specific fields
 *   4. Include in your form HTML:
 *      <script src="../../scripts/validation/shared.validation-engine.js"></script>
 *      <script src="formname.validator.js"></script>
 *
 * Example:
 *   For HR form: hr.validator.js with HRValidator
 */

const FORMNAMEValidator = (function() {
  'use strict';

  // ==========================================================================
  // CUSTOMIZE THIS: Your form's validation schema
  // ==========================================================================

  const formSchema = {
    // Example fields - replace with your form's actual fields
    fieldName1: ['required', 'email'],
    fieldName2: ['required', 'minLength:2', 'maxLength:100'],
    fieldName3: ['required', 'date', 'futureDate'],
    fieldName4: ['required', 'enum:Option1,Option2,Option3']
    // Add more fields as needed
  };

  // Optional fields (validated only if present)
  const optionalFields = {
    optionalField1: ['phone'],
    optionalField2: ['maxLength:500'],
    notes: ['maxLength:1000']
  };

  // ==========================================================================
  // Validation Functions
  // ==========================================================================

  /**
   * Validate complete form data
   * @param {Object} data - Form data to validate
   * @returns {Object} { isValid, errors, validFields, data }
   */
  function validateForm(data) {
    // Validate required fields
    const validation = ValidationEngine.validate(data, formSchema);

    if (!validation.isValid) {
      return validation;
    }

    // Validate optional fields if present
    for (const fieldName in optionalFields) {
      if (data[fieldName]) {
        const rules = optionalFields[fieldName];
        const fieldValidation = ValidationEngine.validateField(data[fieldName], rules, fieldName);

        if (!fieldValidation.isValid) {
          validation.isValid = false;
          validation.errors[fieldName] = fieldValidation.errors;
        }
      }
    }

    return validation;
  }

  /**
   * Validate and sanitize form data
   * Removes extra whitespace, normalizes data
   */
  function validateAndSanitizeForm(data) {
    // Sanitize data first
    const sanitized = ValidationEngine.sanitize(data);

    // Then validate
    return validateForm(sanitized);
  }

  /**
   * Get the first error message (useful for showing single error)
   */
  function getFirstError(validation) {
    if (validation.isValid) return null;

    const firstField = Object.keys(validation.errors)[0];
    const firstError = validation.errors[firstField][0];

    return firstError ? firstError.message : 'Validation failed';
  }

  /**
   * Get all error messages as array
   */
  function getAllErrors(validation) {
    if (validation.isValid) return [];

    const messages = [];
    for (const fieldName in validation.errors) {
      const fieldErrors = validation.errors[fieldName];
      fieldErrors.forEach(error => {
        messages.push(`${fieldName}: ${error.message}`);
      });
    }

    return messages;
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  return {
    validateForm,
    validateAndSanitizeForm,
    getFirstError,
    getAllErrors,
    formSchema,
    optionalFields
  };
})();
