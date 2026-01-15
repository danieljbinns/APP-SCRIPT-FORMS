/**
 * Error Handler Module
 *
 * Centralized error handling with user-friendly messages
 * Integrates with ToastManager for notifications
 */

const ErrorHandler = (function() {
  'use strict';

  // Configuration
  let config = {
    showStack: false,          // Show stack trace in console
    logErrors: true,           // Log to console
    showToast: true,           // Show error toast
    defaultMessage: 'An unexpected error occurred. Please try again.'
  };

  // Error type mappings to user-friendly messages
  const errorMessages = {
    // Network errors
    'NetworkError': 'Network connection failed. Please check your internet connection.',
    'TypeError': 'A technical error occurred. Please refresh and try again.',

    // Validation errors
    'ValidationError': 'Please check your input and try again.',

    // Permission errors
    'PermissionError': 'You do not have permission to perform this action.',
    'AuthenticationError': 'Please log in to continue.',

    // Not found errors
    'NotFoundError': 'The requested item could not be found.',

    // Timeout errors
    'TimeoutError': 'The request timed out. Please try again.',

    // API errors
    'APIError': 'Server error. Please try again later.',

    // Custom errors
    'WorkflowNotFoundError': 'Workflow not found.',
    'ReminderFailedError': 'Failed to send reminder. Please try again.'
  };

  /**
   * Initialize error handler
   */
  function init(customConfig = {}) {
    config = { ...config, ...customConfig };

    // Set up global error handlers
    if (config.logErrors) {
      setupGlobalHandlers();
    }
  }

  /**
   * Handle error with appropriate user feedback
   */
  function handle(error, context = '') {
    // Log to console if enabled
    if (config.logErrors) {
      logError(error, context);
    }

    // Get user-friendly message
    const message = getUserMessage(error, context);

    // Show toast if enabled and ToastManager available
    if (config.showToast && typeof ToastManager !== 'undefined') {
      ToastManager.error(message);
    } else {
      // Fallback to alert
      console.error(message);
    }

    return message;
  }

  /**
   * Get user-friendly error message
   */
  function getUserMessage(error, context = '') {
    let message = config.defaultMessage;

    if (typeof error === 'string') {
      message = error;
    } else if (error instanceof Error) {
      // Check for custom error types
      const errorType = error.constructor.name;
      if (errorMessages[errorType]) {
        message = errorMessages[errorType];
      } else if (error.message) {
        // Use error message if it's user-friendly
        message = isUserFriendly(error.message) ? error.message : config.defaultMessage;
      }
    } else if (error && error.message) {
      message = error.message;
    }

    // Add context if provided
    if (context) {
      message = `${context}: ${message}`;
    }

    return message;
  }

  /**
   * Check if message is user-friendly
   */
  function isUserFriendly(message) {
    // Simple heuristic: user-friendly messages are complete sentences
    // Technical messages often contain code-like text
    const technicalPatterns = /undefined|null|cannot read|TypeError|ReferenceError/i;
    return !technicalPatterns.test(message) && message.length > 10;
  }

  /**
   * Log error to console
   */
  function logError(error, context) {
    const timestamp = new Date().toISOString();
    console.group(`%c[Error] ${timestamp}`, 'color: #db4437; font-weight: bold');

    if (context) {
      console.log('%cContext:', 'font-weight: bold', context);
    }

    if (error instanceof Error) {
      console.error(error);
      if (config.showStack && error.stack) {
        console.log('%cStack trace:', 'font-weight: bold');
        console.log(error.stack);
      }
    } else {
      console.error('Error:', error);
    }

    console.groupEnd();
  }

  /**
   * Wrap async function with error handling
   */
  async function wrapAsync(asyncFn, context = '') {
    try {
      return await asyncFn();
    } catch (error) {
      handle(error, context);
      throw error;
    }
  }

  /**
   * Wrap promise with error handling
   */
  async function wrapPromise(promise, context = '') {
    try {
      return await promise;
    } catch (error) {
      handle(error, context);
      throw error;
    }
  }

  /**
   * Try-catch wrapper for sync functions
   */
  function tryCatch(fn, context = '', fallbackValue = null) {
    try {
      return fn();
    } catch (error) {
      handle(error, context);
      return fallbackValue;
    }
  }

  /**
   * Setup global error handlers
   */
  function setupGlobalHandlers() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      event.preventDefault();
      handle(event.reason, 'Unhandled Promise Rejection');
    });

    // Handle global errors
    window.addEventListener('error', (event) => {
      if (event.error) {
        handle(event.error, 'Global Error');
      }
    });
  }

  /**
   * Create custom error class
   */
  function createErrorClass(name, defaultMessage) {
    class CustomError extends Error {
      constructor(message = defaultMessage) {
        super(message);
        this.name = name;
      }
    }

    // Register in error messages
    if (defaultMessage) {
      errorMessages[name] = defaultMessage;
    }

    return CustomError;
  }

  /**
   * Parse API error response
   */
  function parseAPIError(response) {
    if (response && response.error) {
      return response.error;
    }

    if (response && response.message) {
      return response.message;
    }

    if (response && response.status) {
      const statusMessages = {
        400: 'Bad request. Please check your input.',
        401: 'Authentication required. Please log in.',
        403: 'Permission denied.',
        404: 'Resource not found.',
        500: 'Server error. Please try again later.',
        503: 'Service temporarily unavailable.'
      };

      return statusMessages[response.status] || config.defaultMessage;
    }

    return config.defaultMessage;
  }

  /**
   * Register custom error message
   */
  function registerErrorMessage(errorType, message) {
    errorMessages[errorType] = message;
  }

  /**
   * Update configuration
   */
  function configure(newConfig) {
    config = { ...config, ...newConfig };
  }

  // Public API
  return {
    init,
    configure,
    handle,
    wrapAsync,
    wrapPromise,
    tryCatch,
    createErrorClass,
    parseAPIError,
    registerErrorMessage,
    getUserMessage
  };
})();

// Common custom errors
const ValidationError = ErrorHandler.createErrorClass(
  'ValidationError',
  'Please check your input and try again.'
);

const WorkflowNotFoundError = ErrorHandler.createErrorClass(
  'WorkflowNotFoundError',
  'Workflow not found.'
);

const ReminderFailedError = ErrorHandler.createErrorClass(
  'ReminderFailedError',
  'Failed to send reminder.'
);

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ErrorHandler,
    ValidationError,
    WorkflowNotFoundError,
    ReminderFailedError
  };
}
