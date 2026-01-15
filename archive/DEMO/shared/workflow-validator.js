/**
 * Workflow Validator
 *
 * Validates workflow data against REQUEST_FORMS business rules.
 * Defines schemas for workflows, tasks, and form data.
 *
 * Dependencies: validation-engine.js, validation-rules.js
 *
 * Usage:
 *   const result = WorkflowValidator.validateWorkflow(workflowData);
 *   if (!result.isValid) { console.log(result.errors); }
 */

const WorkflowValidator = (function() {
  'use strict';

  // Workflow validation schema
  const workflowSchema = {
    employee: ['required', 'minLength:2', 'maxLength:100'],
    email: ['required', 'email'],
    position: ['required', 'minLength:2', 'maxLength:100'],
    hireDate: ['required', 'date', 'futureDate'],
    siteName: ['required', 'minLength:2'],
    supervisorName: ['required', 'minLength:2'],
    supervisorEmail: ['required', 'email'],
    employmentType: ['required', 'enum:Hourly,Salary']
  };

  // Optional workflow fields schema
  const optionalWorkflowFields = {
    phone: ['phone'],
    workflowId: ['minLength:5'],
    status: ['enum:Open,In Progress,Complete,Overdue'],
    notes: ['maxLength:1000']
  };

  // Task validation schema
  const taskSchema = {
    id: ['required', 'minLength:2'],
    name: ['required', 'minLength:2'],
    status: ['required', 'enum:Open,In Progress,Complete']
  };

  // Update workflow schema (less strict for updates)
  const updateWorkflowSchema = {
    status: ['enum:Open,In Progress,Complete,Overdue'],
    tasksComplete: ['numeric', 'min:0'],
    tasksTotal: ['numeric', 'min:0'],
    notes: ['maxLength:1000']
  };

  /**
   * Validate a complete workflow object
   */
  function validateWorkflow(data) {
    // First, validate required fields
    const validation = ValidationEngine.validate(data, workflowSchema);

    if (!validation.isValid) {
      return validation;
    }

    // Then validate optional fields if present
    const optionalValidation = ValidationEngine.validate(data, optionalWorkflowFields, {
      allowUnknown: true
    });

    if (!optionalValidation.isValid) {
      return optionalValidation;
    }

    // Cross-field validation
    const crossFieldRules = [
      {
        fields: ['employee', 'supervisorName'],
        test: (data) => data.employee.toLowerCase() !== data.supervisorName.toLowerCase(),
        message: 'Employee and supervisor cannot be the same person'
      },
      {
        fields: ['email', 'supervisorEmail'],
        test: (data) => data.email.toLowerCase() !== data.supervisorEmail.toLowerCase(),
        message: 'Employee and supervisor emails must be different'
      },
      {
        fields: ['hireDate'],
        test: (data) => {
          const hireDate = new Date(data.hireDate);
          const maxDate = new Date();
          maxDate.setFullYear(maxDate.getFullYear() + 2); // Max 2 years in future
          return hireDate <= maxDate;
        },
        message: 'Hire date cannot be more than 2 years in the future'
      }
    ];

    const crossValidation = ValidationEngine.validateCrossField(data, crossFieldRules);

    if (!crossValidation.isValid) {
      return {
        isValid: false,
        errors: {
          _crossField: crossValidation.errors
        },
        validFields: validation.validFields
      };
    }

    return {
      isValid: true,
      errors: {},
      validFields: validation.validFields,
      data: validation.data
    };
  }

  /**
   * Validate workflow update data
   */
  function validateWorkflowUpdate(data) {
    return ValidationEngine.validate(data, updateWorkflowSchema, {
      allowUnknown: true // Allow any fields for updates
    });
  }

  /**
   * Validate a single task
   */
  function validateTask(data) {
    return ValidationEngine.validate(data, taskSchema);
  }

  /**
   * Validate task update
   */
  function validateTaskUpdate(data) {
    const schema = {
      status: ['required', 'enum:Open,In Progress,Complete']
    };

    return ValidationEngine.validate(data, schema, {
      allowUnknown: true
    });
  }

  /**
   * Validate email for reminder
   */
  function validateReminderEmail(email) {
    return ValidationEngine.validateField(email, ['required', 'email'], 'email');
  }

  /**
   * Validate reminder message
   */
  function validateReminderMessage(message) {
    if (!message || message.trim() === '') {
      return { isValid: true, errors: [] }; // Optional
    }

    return ValidationEngine.validateField(message, ['maxLength:500'], 'message');
  }

  /**
   * Validate bulk operation data
   */
  function validateBulkOperation(workflowIds) {
    if (!Array.isArray(workflowIds)) {
      return {
        isValid: false,
        errors: {
          workflowIds: [{
            field: 'workflowIds',
            rule: 'type',
            message: 'Workflow IDs must be an array'
          }]
        }
      };
    }

    if (workflowIds.length === 0) {
      return {
        isValid: false,
        errors: {
          workflowIds: [{
            field: 'workflowIds',
            rule: 'required',
            message: 'At least one workflow ID is required'
          }]
        }
      };
    }

    if (workflowIds.length > 100) {
      return {
        isValid: false,
        errors: {
          workflowIds: [{
            field: 'workflowIds',
            rule: 'max',
            message: 'Cannot process more than 100 workflows at once'
          }]
        }
      };
    }

    return { isValid: true, errors: {}, validFields: ['workflowIds'] };
  }

  /**
   * Validate search/filter parameters
   */
  function validateFilterParams(params) {
    const schema = {
      search: ['maxLength:100'],
      status: ['enum:Open,In Progress,Complete,Overdue'],
      dateFrom: ['date'],
      dateTo: ['date']
    };

    const validation = ValidationEngine.validate(params, schema, {
      allowUnknown: true
    });

    if (!validation.isValid) {
      return validation;
    }

    // Cross-field validation for date range
    if (params.dateFrom && params.dateTo) {
      const from = new Date(params.dateFrom);
      const to = new Date(params.dateTo);

      if (from > to) {
        return {
          isValid: false,
          errors: {
            _dateRange: [{
              fields: ['dateFrom', 'dateTo'],
              message: 'Start date must be before end date'
            }]
          }
        };
      }
    }

    return validation;
  }

  /**
   * Sanitize workflow data before save
   */
  function sanitizeWorkflow(data) {
    return ValidationEngine.sanitize(data, [
      'employee',
      'position',
      'siteName',
      'supervisorName',
      'notes'
    ]);
  }

  /**
   * Validate and sanitize workflow in one step
   */
  function validateAndSanitizeWorkflow(data) {
    // Trim all fields first
    const trimmed = ValidationEngine.trim(data);

    // Validate
    const validation = validateWorkflow(trimmed);

    if (!validation.isValid) {
      return validation;
    }

    // Sanitize
    const sanitized = sanitizeWorkflow(validation.data);

    return {
      ...validation,
      data: sanitized
    };
  }

  /**
   * Quick validation helpers for common cases
   */
  const quick = {
    /**
     * Check if email is valid
     */
    isValidEmail: (email) => {
      const result = ValidationEngine.validateField(email, ['email'], 'email');
      return result.isValid;
    },

    /**
     * Check if date is in future
     */
    isFutureDate: (date) => {
      const result = ValidationEngine.validateField(date, ['futureDate'], 'date');
      return result.isValid;
    },

    /**
     * Check if required field is filled
     */
    isRequired: (value) => {
      const result = ValidationEngine.validateField(value, ['required'], 'field');
      return result.isValid;
    },

    /**
     * Check if string meets length requirements
     */
    meetsLength: (value, min, max) => {
      const rules = [];
      if (min) rules.push(`minLength:${min}`);
      if (max) rules.push(`maxLength:${max}`);

      const result = ValidationEngine.validateField(value, rules, 'field');
      return result.isValid;
    }
  };

  /**
   * Get validation errors as user-friendly messages
   */
  function getErrorMessages(validationResult) {
    if (validationResult.isValid) {
      return [];
    }

    return ValidationEngine.formatErrors(validationResult.errors);
  }

  /**
   * Get first error message
   */
  function getFirstError(validationResult) {
    return ValidationEngine.getFirstError(validationResult.errors);
  }

  // Public API
  return {
    // Validation functions
    validateWorkflow,
    validateWorkflowUpdate,
    validateTask,
    validateTaskUpdate,
    validateReminderEmail,
    validateReminderMessage,
    validateBulkOperation,
    validateFilterParams,

    // Sanitization
    sanitizeWorkflow,
    validateAndSanitizeWorkflow,

    // Helpers
    quick,
    getErrorMessages,
    getFirstError,

    // Expose schemas for custom validation
    schemas: {
      workflow: workflowSchema,
      optionalWorkflow: optionalWorkflowFields,
      task: taskSchema,
      updateWorkflow: updateWorkflowSchema
    }
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WorkflowValidator;
}
