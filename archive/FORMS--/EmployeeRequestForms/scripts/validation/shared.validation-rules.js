/**
 * Validation Rules Library
 *
 * Defines reusable validation rules for the validation engine.
 * Each rule has a test function and error message.
 *
 * Usage:
 *   ValidationRules.email.test('user@example.com') // true
 *   ValidationRules.email.message // 'Please enter a valid email address'
 */

const ValidationRules = (function() {
  'use strict';

  // Core validation rules
  const rules = {
    // Required field validation
    required: {
      test: (value) => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim() !== '';
        if (typeof value === 'number') return true;
        if (typeof value === 'boolean') return true;
        if (Array.isArray(value)) return value.length > 0;
        return !!value;
      },
      message: 'This field is required'
    },

    // Email validation
    email: {
      test: (value) => {
        if (!value) return true; // Allow empty (use 'required' for mandatory)
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        return regex.test(value);
      },
      message: 'Please enter a valid email address'
    },

    // Future date validation
    futureDate: {
      test: (value) => {
        if (!value) return true;
        const inputDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today
        return inputDate >= today;
      },
      message: 'Date must be today or in the future'
    },

    // Past date validation
    pastDate: {
      test: (value) => {
        if (!value) return true;
        const inputDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return inputDate < today;
      },
      message: 'Date must be in the past'
    },

    // Valid date format
    date: {
      test: (value) => {
        if (!value) return true;
        const date = new Date(value);
        return date instanceof Date && !isNaN(date);
      },
      message: 'Please enter a valid date'
    },

    // Phone number validation (flexible format)
    phone: {
      test: (value) => {
        if (!value) return true;
        // Remove common separators
        const cleaned = value.replace(/[\s\-\(\)\.]/g, '');
        // Match 10-15 digits, optional country code
        const regex = /^\+?1?\d{10,15}$/;
        return regex.test(cleaned);
      },
      message: 'Please enter a valid phone number (10-15 digits)'
    },

    // URL validation
    url: {
      test: (value) => {
        if (!value) return true;
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      },
      message: 'Please enter a valid URL (e.g., https://example.com)'
    },

    // Numeric validation
    numeric: {
      test: (value) => {
        if (!value && value !== 0) return true;
        return !isNaN(Number(value));
      },
      message: 'Please enter a valid number'
    },

    // Integer validation
    integer: {
      test: (value) => {
        if (!value && value !== 0) return true;
        return Number.isInteger(Number(value));
      },
      message: 'Please enter a whole number'
    },

    // Positive number validation
    positive: {
      test: (value) => {
        if (!value && value !== 0) return true;
        return Number(value) > 0;
      },
      message: 'Please enter a positive number'
    },

    // Alphanumeric validation
    alphanumeric: {
      test: (value) => {
        if (!value) return true;
        const regex = /^[a-zA-Z0-9]+$/;
        return regex.test(value);
      },
      message: 'Only letters and numbers are allowed'
    },

    // Alpha only validation
    alpha: {
      test: (value) => {
        if (!value) return true;
        const regex = /^[a-zA-Z\s]+$/;
        return regex.test(value);
      },
      message: 'Only letters are allowed'
    },

    // ZIP code validation (US and Canada)
    zipCode: {
      test: (value) => {
        if (!value) return true;
        // US: 12345 or 12345-6789
        // CA: A1A 1A1 or A1A1A1
        const regex = /^(\d{5}(-\d{4})?|[A-Z]\d[A-Z]\s?\d[A-Z]\d)$/i;
        return regex.test(value);
      },
      message: 'Please enter a valid ZIP/postal code'
    },

    // SSN validation (XXX-XX-XXXX)
    ssn: {
      test: (value) => {
        if (!value) return true;
        const regex = /^\d{3}-\d{2}-\d{4}$/;
        return regex.test(value);
      },
      message: 'Please enter SSN in format XXX-XX-XXXX'
    }
  };

  /**
   * Create a minLength validation rule
   */
  function minLength(length) {
    return {
      test: (value) => {
        if (!value) return true;
        return String(value).length >= length;
      },
      message: `Must be at least ${length} character${length !== 1 ? 's' : ''}`
    };
  }

  /**
   * Create a maxLength validation rule
   */
  function maxLength(length) {
    return {
      test: (value) => {
        if (!value) return true;
        return String(value).length <= length;
      },
      message: `Must be no more than ${length} character${length !== 1 ? 's' : ''}`
    };
  }

  /**
   * Create a min value validation rule
   */
  function min(minValue) {
    return {
      test: (value) => {
        if (!value && value !== 0) return true;
        return Number(value) >= minValue;
      },
      message: `Must be at least ${minValue}`
    };
  }

  /**
   * Create a max value validation rule
   */
  function max(maxValue) {
    return {
      test: (value) => {
        if (!value && value !== 0) return true;
        return Number(value) <= maxValue;
      },
      message: `Must be no more than ${maxValue}`
    };
  }

  /**
   * Create an enum validation rule
   */
  function enumValues(allowedValues) {
    return {
      test: (value) => {
        if (!value) return true;
        return allowedValues.includes(value);
      },
      message: `Must be one of: ${allowedValues.join(', ')}`
    };
  }

  /**
   * Create a pattern (regex) validation rule
   */
  function pattern(regex, message = 'Invalid format') {
    return {
      test: (value) => {
        if (!value) return true;
        return regex.test(value);
      },
      message
    };
  }

  /**
   * Create a custom validation rule
   */
  function custom(testFn, message) {
    return {
      test: testFn,
      message
    };
  }

  /**
   * Get a rule by name or parse a rule string
   * Examples:
   *   'required' -> returns required rule
   *   'minLength:5' -> returns minLength(5) rule
   *   'enum:A,B,C' -> returns enumValues(['A','B','C']) rule
   */
  function getRule(ruleName) {
    // Direct rule lookup
    if (rules[ruleName]) {
      return rules[ruleName];
    }

    // Parse parameterized rules
    const parts = ruleName.split(':');
    const name = parts[0];
    const param = parts[1];

    switch (name) {
      case 'minLength':
        return minLength(parseInt(param, 10));
      case 'maxLength':
        return maxLength(parseInt(param, 10));
      case 'min':
        return min(parseFloat(param));
      case 'max':
        return max(parseFloat(param));
      case 'enum':
        return enumValues(param.split(',').map(v => v.trim()));
      default:
        throw new Error(`Unknown validation rule: ${ruleName}`);
    }
  }

  /**
   * Register a custom rule
   */
  function register(name, rule) {
    if (rules[name]) {
      console.warn(`Overwriting existing validation rule: ${name}`);
    }
    rules[name] = rule;
  }

  // Public API
  return {
    // Direct access to rules
    ...rules,

    // Rule factories
    minLength,
    maxLength,
    min,
    max,
    enum: enumValues,
    pattern,
    custom,

    // Utilities
    getRule,
    register,

    // Get all rule names
    getRuleNames: () => Object.keys(rules)
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ValidationRules;
}
