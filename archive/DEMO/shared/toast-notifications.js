/**
 * Toast Notification System
 *
 * Provides non-intrusive notifications for user feedback
 * Supports: success, error, warning, info types
 * Features: Auto-dismiss, queue management, positioning
 */

const ToastManager = (function() {
  'use strict';

  // Configuration
  let config = {
    duration: 3000,           // Default duration in ms
    position: 'top-right',    // top-left, top-right, bottom-left, bottom-right, top-center
    maxToasts: 5,             // Maximum simultaneous toasts
    dismissible: true         // Show close button
  };

  // Toast queue
  const toastQueue = [];
  let toastCounter = 0;

  /**
   * Initialize toast manager with custom config
   */
  function init(customConfig = {}) {
    config = { ...config, ...customConfig };

    // Create toast container if it doesn't exist
    if (!document.getElementById('toast-container')) {
      createContainer();
    }
  }

  /**
   * Create toast container element
   */
  function createContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = `toast-container toast-${config.position}`;
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Notifications');
    document.body.appendChild(container);
  }

  /**
   * Show success toast
   */
  function success(message, options = {}) {
    return show(message, 'success', options);
  }

  /**
   * Show error toast
   */
  function error(message, options = {}) {
    return show(message, 'error', options);
  }

  /**
   * Show warning toast
   */
  function warning(message, options = {}) {
    return show(message, 'warning', options);
  }

  /**
   * Show info toast
   */
  function info(message, options = {}) {
    return show(message, 'info', options);
  }

  /**
   * Show toast with custom type
   */
  function show(message, type = 'info', options = {}) {
    const toast = createToast(message, type, options);
    addToQueue(toast);
    return toast.id;
  }

  /**
   * Create toast element
   */
  function createToast(message, type, options) {
    const id = `toast-${++toastCounter}`;
    const duration = options.duration || config.duration;
    const dismissible = options.dismissible !== undefined ? options.dismissible : config.dismissible;

    const toast = {
      id,
      message,
      type,
      duration,
      dismissible,
      element: null,
      timer: null
    };

    // Create DOM element
    const element = document.createElement('div');
    element.id = id;
    element.className = `toast toast-${type}`;
    element.setAttribute('role', 'alert');
    element.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    // Icon
    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.innerHTML = getIcon(type);
    element.appendChild(icon);

    // Message
    const messageEl = document.createElement('span');
    messageEl.className = 'toast-message';
    messageEl.textContent = message;
    element.appendChild(messageEl);

    // Close button
    if (dismissible) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'toast-close';
      closeBtn.innerHTML = '×';
      closeBtn.setAttribute('aria-label', 'Close notification');
      closeBtn.onclick = () => dismiss(id);
      element.appendChild(closeBtn);
    }

    toast.element = element;
    return toast;
  }

  /**
   * Get icon for toast type
   */
  function getIcon(type) {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    return icons[type] || icons.info;
  }

  /**
   * Add toast to queue and display
   */
  function addToQueue(toast) {
    // Remove oldest if at max capacity
    if (toastQueue.length >= config.maxToasts) {
      const oldest = toastQueue.shift();
      dismiss(oldest.id, false);
    }

    toastQueue.push(toast);
    displayToast(toast);
  }

  /**
   * Display toast on screen
   */
  function displayToast(toast) {
    const container = getContainer();
    container.appendChild(toast.element);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.element.classList.add('toast-show');
    });

    // Auto-dismiss after duration
    if (toast.duration > 0) {
      toast.timer = setTimeout(() => {
        dismiss(toast.id);
      }, toast.duration);
    }
  }

  /**
   * Dismiss toast by ID
   */
  function dismiss(toastId, removeFromQueue = true) {
    const index = toastQueue.findIndex(t => t.id === toastId);

    if (index === -1) return;

    const toast = toastQueue[index];

    // Clear timer
    if (toast.timer) {
      clearTimeout(toast.timer);
    }

    // Animate out
    toast.element.classList.remove('toast-show');
    toast.element.classList.add('toast-hide');

    // Remove from DOM after animation
    setTimeout(() => {
      if (toast.element.parentNode) {
        toast.element.parentNode.removeChild(toast.element);
      }
    }, 300);

    // Remove from queue
    if (removeFromQueue) {
      toastQueue.splice(index, 1);
    }
  }

  /**
   * Dismiss all toasts
   */
  function dismissAll() {
    [...toastQueue].forEach(toast => {
      dismiss(toast.id);
    });
  }

  /**
   * Get or create container
   */
  function getContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
      createContainer();
      container = document.getElementById('toast-container');
    }
    return container;
  }

  /**
   * Update configuration
   */
  function configure(newConfig) {
    config = { ...config, ...newConfig };

    // Update container position if it exists
    const container = document.getElementById('toast-container');
    if (container) {
      container.className = `toast-container toast-${config.position}`;
    }
  }

  /**
   * Promise-based toast for async operations
   */
  async function promise(promise, messages = {}) {
    const defaultMessages = {
      loading: 'Processing...',
      success: 'Success!',
      error: 'An error occurred'
    };

    const msgs = { ...defaultMessages, ...messages };

    // Show loading toast
    const loadingId = show(msgs.loading, 'info', { duration: 0 });

    try {
      const result = await promise;
      dismiss(loadingId);
      success(msgs.success);
      return result;
    } catch (error) {
      dismiss(loadingId);
      ToastManager.error(msgs.error + ': ' + error.message);
      throw error;
    }
  }

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  return {
    init,
    configure,
    success,
    error,
    warning,
    info,
    show,
    dismiss,
    dismissAll,
    promise
  };
})();

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ToastManager;
}
