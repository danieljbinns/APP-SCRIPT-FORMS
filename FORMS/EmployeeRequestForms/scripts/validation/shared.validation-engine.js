/**
 * Validation Engine
 *
 * Core validation system that applies validation rules to data.
 * Schema-based validation with support for single fields and entire objects.
 *
 * Dependencies: validation-rules.js
 *
 * Usage:
 *   const schema = { email: ['required', 'email'], age: ['required', 'min:18'] };
 *   const result = ValidationEngine.validate(data, schema);
 *   if (!result.isValid) { console.log(result.errors); }
 */

const ValidationEngine = (function() {
  'use strict';

  /**
   * Validate a single value against a single rule
   */
  function validateRule(value, ruleName) {
    try {
      const rule = ValidationRules.getRule(ruleName);
      const isValid = rule.test(value);

      return {
        isValid,
        message: isValid ? null : rule.message
      };
    } catch (error) {
      console.error(`Validation error for rule "${ruleName}":`, error);
      return {
        isValid: false,
        message: `Invalid validation rule: ${ruleName}`
      };
    }
  }

  /**
   * Validate a single field against multiple rules
   */
  function validateField(value, rules, fieldName = 'Field') {
    const errors = [];

    // Ensure rules is an array
    const ruleArray = Array.isArray(rules) ? rules : [rules];

    for (const ruleName of ruleArray) {
      const result = validateRule(value, ruleName);

      if (!result.isValid) {
        errors.push({
          field: fieldName,
          rule: ruleName,
          message: result.message
        });

        // Stop on first error (unless configured otherwise)
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate an entire object against a schema
   *
   * @param {Object} data - Data object to validate
   * @param {Object} schema - Validation schema { fieldName: ['rule1', 'rule2'] }
   * @param {Object} options - Validation options
   * @returns {Object} { isValid, errors, validFields }
   */
  function validate(data, schema, options = {}) {
    const defaults = {
      abortEarly: false, // Stop validation on first error
      allowUnknown: true, // Allow fields not in schema
      stripUnknown: false // Remove fields not in schema
    };

    const config = { ...defaults, ...options };
    const errors = {};
    const validFields = [];
    let hasErrors = false;

    // Validate each field in the schema
    for (const fieldName in schema) {
      const rules = schema[fieldName];
      const value = data[fieldName];

      const result = validateField(value, rules, fieldName);

      if (!result.isValid) {
        errors[fieldName] = result.errors;
        hasErrors = true;

        if (config.abortEarly) {
          break;
        }
      } else {
        validFields.push(fieldName);
      }
    }

    // Check for unknown fields
    if (!config.allowUnknown) {
      for (const fieldName in data) {
        if (!schema[fieldName]) {
          hasErrors = true;
          errors[fieldName] = [{
            field: fieldName,
            rule: 'unknown',
            message: 'Unknown field'
          }];
        }
      }
    }

    return {
      isValid: !hasErrors,
      errors,
      validFields,
      data: config.stripUnknown ? stripUnknownFields(data, schema) : data
    };
  }

  /**
   * Validate with custom rules
   */
  function validateWith(data, schema, customRules) {
    // Temporarily register custom rules
    const registeredRules = [];

    for (const ruleName in customRules) {
      ValidationRules.register(ruleName, customRules[ruleName]);
      registeredRules.push(ruleName);
    }

    // Perform validation
    const result = validate(data, schema);

    // Clean up (optional - could leave them registered)
    // In practice, custom rules can stay registered

    return result;
  }

  /**
   * Cross-field validation
   * Validates relationships between multiple fields
   *
   * @param {Object} data - Data object
   * @param {Array} rules - Array of cross-field rules
   * @returns {Object} { isValid, errors }
   *
   * Example:
   *   validateCrossField(data, [
   *     {
   *       fields: ['startDate', 'endDate'],
   *       test: (data) => new Date(data.endDate) > new Date(data.startDate),
   *       message: 'End date must be after start date'
   *     }
   *   ])
   */
  function validateCrossField(data, rules) {
    const errors = [];

    for (const rule of rules) {
      const isValid = rule.test(data);

      if (!isValid) {
        errors.push({
          fields: rule.fields,
          message: rule.message,
          type: 'cross-field'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Async validation (for server-side checks)
   */
  async function validateAsync(data, schema, asyncValidators = []) {
    // First, run synchronous validation
    const syncResult = validate(data, schema);

    if (!syncResult.isValid) {
      return syncResult;
    }

    // Then run async validators
    const asyncErrors = {};
    let hasAsyncErrors = false;

    for (const validator of asyncValidators) {
      try {
        const result = await validator(data);

        if (!result.isValid) {
          asyncErrors[result.field] = [{
            field: result.field,
            rule: 'async',
            message: result.message
          }];
          hasAsyncErrors = true;
        }
      } catch (error) {
        asyncErrors._general = [{
          field: '_general',
          rule: 'async',
          message: 'Validation error: ' + error.message
        }];
        hasAsyncErrors = true;
      }
    }

    return {
      isValid: !hasAsyncErrors,
      errors: hasAsyncErrors ? { ...syncResult.errors, ...asyncErrors } : syncResult.errors,
      validFields: syncResult.validFields,
      data: syncResult.data
    };
  }

  /**
   * Strip unknown fields from data
   */
  function stripUnknownFields(data, schema) {
    const cleaned = {};

    for (const fieldName in schema) {
      if (data.hasOwnProperty(fieldName)) {
        cleaned[fieldName] = data[fieldName];
      }
    }

    return cleaned;
  }

  /**
   * Format errors for display
   * Converts error object to array of messages
   */
  function formatErrors(errors) {
    const messages = [];

    for (const fieldName in errors) {
      const fieldErrors = errors[fieldName];

      for (const error of fieldErrors) {
        messages.push(error.message);
      }
    }

    return messages;
  }

  /**
   * Get first error message
   */
  function getFirstError(errors) {
    for (const fieldName in errors) {
      const fieldErrors = errors[fieldName];
      if (fieldErrors.length > 0) {
        return fieldErrors[0].message;
      }
    }
    return null;
  }

  /**
   * Sanitize input (basic XSS prevention)
   */
  function sanitize(data, fields = []) {
    const sanitized = { ...data };

    // If no fields specified, sanitize all string fields
    const fieldsToSanitize = fields.length > 0 ? fields : Object.keys(data);

    for (const field of fieldsToSanitize) {
      if (typeof sanitized[field] === 'string') {
        // Basic HTML escaping
        sanitized[field] = sanitized[field]
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .replace(/\//g, '&#x2F;');
      }
    }

    return sanitized;
  }

  /**
   * Trim whitespace from all string fields
   */
  function trim(data, fields = []) {
    const trimmed = { ...data };
    const fieldsToTrim = fields.length > 0 ? fields : Object.keys(data);

    for (const field of fieldsToTrim) {
      if (typeof trimmed[field] === 'string') {
        trimmed[field] = trimmed[field].trim();
      }
    }

    return trimmed;
  }

  /**
   * Validate and sanitize in one step
   */
  function validateAndSanitize(data, schema, options = {}) {
    // First trim
    const trimmed = trim(data);

    // Then validate
    const validation = validate(trimmed, schema, options);

    // Then sanitize if valid
    if (validation.isValid) {
      validation.data = sanitize(validation.data);
    }

    return validation;
  }

  /**
   * Create a reusable validator function
   */
  function createValidator(schema, options = {}) {
    return (data) => validate(data, schema, options);
  }

  /**
   * Batch validation for arrays
   */
  function validateBatch(dataArray, schema, options = {}) {
    const results = [];
    let allValid = true;

    for (let i = 0; i < dataArray.length; i++) {
      const result = validate(dataArray[i], schema, options);
      results.push({
        index: i,
        ...result
      });

      if (!result.isValid) {
        allValid = false;
      }
    }

    return {
      isValid: allValid,
      results,
      validCount: results.filter(r => r.isValid).length,
      invalidCount: results.filter(r => !r.isValid).length
    };
  }

  // Public API
  return {
    validate,
    validateField,
    validateRule,
    validateWith,
    validateCrossField,
    validateAsync,
    validateAndSanitize,
    validateBatch,
    createValidator,
    formatErrors,
    getFirstError,
    sanitize,
    trim
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ValidationEngine;
}
