/**
 * Confirmation Dialog
 *
 * Promise-based confirmation dialogs for destructive actions
 * Replaces native confirm() with better UX
 */

const ConfirmDialog = (function() {
  'use strict';

  // Configuration
  let config = {
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    dangerousConfirmText: 'Yes, Delete',
    type: 'default' // default, danger, warning
  };

  let currentDialog = null;
  let currentResolve = null;

  /**
   * Initialize confirmation dialog
   */
  function init(customConfig = {}) {
    config = { ...config, ...customConfig };
  }

  /**
   * Show confirmation dialog
   */
  function confirm(options = {}) {
    return new Promise((resolve) => {
      // Close existing dialog if any
      if (currentDialog) {
        closeDialog(false);
      }

      currentResolve = resolve;

      const dialogOptions = {
        title: options.title || 'Confirm Action',
        message: options.message || 'Are you sure?',
        confirmText: options.confirmText || config.confirmText,
        cancelText: options.cancelText || config.cancelText,
        type: options.type || config.type,
        html: options.html || false
      };

      createDialog(dialogOptions);
    });
  }

  /**
   * Show danger confirmation (for destructive actions)
   */
  function confirmDanger(title, message) {
    return confirm({
      title,
      message,
      type: 'danger',
      confirmText: config.dangerousConfirmText
    });
  }

  /**
   * Show warning confirmation
   */
  function confirmWarning(title, message) {
    return confirm({
      title,
      message,
      type: 'warning'
    });
  }

  /**
   * Create dialog element
   */
  function createDialog(options) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'confirm-dialog-overlay';
    overlay.onclick = () => closeDialog(false);

    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = `confirm-dialog confirm-dialog-${options.type}`;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-labelledby', 'confirm-dialog-title');
    dialog.setAttribute('aria-describedby', 'confirm-dialog-message');
    dialog.onclick = (e) => e.stopPropagation();

    // Icon
    const icon = document.createElement('div');
    icon.className = 'confirm-dialog-icon';
    icon.innerHTML = getIcon(options.type);
    dialog.appendChild(icon);

    // Title
    const title = document.createElement('h2');
    title.id = 'confirm-dialog-title';
    title.className = 'confirm-dialog-title';
    title.textContent = options.title;
    dialog.appendChild(title);

    // Message
    const message = document.createElement('div');
    message.id = 'confirm-dialog-message';
    message.className = 'confirm-dialog-message';

    if (options.html) {
      message.innerHTML = options.message;
    } else {
      message.textContent = options.message;
    }

    dialog.appendChild(message);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'confirm-dialog-actions';

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'confirm-dialog-btn confirm-dialog-btn-cancel';
    cancelBtn.textContent = options.cancelText;
    cancelBtn.onclick = () => closeDialog(false);
    actions.appendChild(cancelBtn);

    // Confirm button
    const confirmBtn = document.createElement('button');
    confirmBtn.className = `confirm-dialog-btn confirm-dialog-btn-confirm confirm-dialog-btn-${options.type}`;
    confirmBtn.textContent = options.confirmText;
    confirmBtn.onclick = () => closeDialog(true);
    actions.appendChild(confirmBtn);

    dialog.appendChild(actions);
    overlay.appendChild(dialog);

    // Add to DOM
    document.body.appendChild(overlay);
    currentDialog = overlay;

    // Focus confirm button
    setTimeout(() => {
      cancelBtn.focus();
    }, 100);

    // Handle keyboard
    const handleKeyboard = (e) => {
      if (e.key === 'Escape') {
        closeDialog(false);
      } else if (e.key === 'Enter') {
        closeDialog(true);
      }
    };

    dialog.addEventListener('keydown', handleKeyboard);

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Animate in
    requestAnimationFrame(() => {
      overlay.classList.add('confirm-dialog-show');
    });
  }

  /**
   * Get icon for dialog type
   */
  function getIcon(type) {
    const icons = {
      default: '❓',
      danger: '⚠️',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || icons.default;
  }

  /**
   * Close dialog and resolve promise
   */
  function closeDialog(confirmed) {
    if (!currentDialog) return;

    // Animate out
    currentDialog.classList.remove('confirm-dialog-show');
    currentDialog.classList.add('confirm-dialog-hide');

    // Remove after animation
    setTimeout(() => {
      if (currentDialog && currentDialog.parentNode) {
        currentDialog.parentNode.removeChild(currentDialog);
      }

      currentDialog = null;

      // Restore body scroll
      document.body.style.overflow = '';

      // Resolve promise
      if (currentResolve) {
        currentResolve(confirmed);
        currentResolve = null;
      }
    }, 200);
  }

  /**
   * Simple confirm (boolean result)
   */
  async function ask(message, title = 'Confirm') {
    return await confirm({ title, message });
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
    confirm,
    confirmDanger,
    confirmWarning,
    ask
  };
})();

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConfirmDialog;
}
