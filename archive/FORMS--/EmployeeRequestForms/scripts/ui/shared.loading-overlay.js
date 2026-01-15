/**
 * Loading Overlay System
 *
 * Shows loading spinner during async operations
 * Blocks user interaction to prevent duplicate submissions
 */

const LoadingOverlay = (function() {
  'use strict';

  // Configuration
  let config = {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    spinnerColor: '#EB1C2D',
    zIndex: 9999,
    showText: true,
    minDisplayTime: 300 // Minimum time to show (prevents flashing)
  };

  let overlay = null;
  let showTime = null;
  let isVisible = false;

  /**
   * Initialize loading overlay
   */
  function init(customConfig = {}) {
    config = { ...config, ...customConfig };
  }

  /**
   * Show loading overlay
   */
  function show(message = 'Loading...') {
    if (isVisible) {
      // Update message if already showing
      updateMessage(message);
      return;
    }

    showTime = Date.now();
    isVisible = true;

    // Create overlay if it doesn't exist
    if (!overlay) {
      createOverlay();
    }

    // Update message
    updateMessage(message);

    // Add to DOM and show
    document.body.appendChild(overlay);

    // Trigger animation
    requestAnimationFrame(() => {
      overlay.classList.add('loading-overlay-show');
    });

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  /**
   * Hide loading overlay
   */
  function hide() {
    if (!isVisible || !overlay) return;

    const timeShown = Date.now() - showTime;
    const remainingTime = Math.max(0, config.minDisplayTime - timeShown);

    // Wait minimum display time to prevent flashing
    setTimeout(() => {
      isVisible = false;

      // Animate out
      overlay.classList.remove('loading-overlay-show');
      overlay.classList.add('loading-overlay-hide');

      // Remove from DOM after animation
      setTimeout(() => {
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        overlay.classList.remove('loading-overlay-hide');

        // Restore body scroll
        document.body.style.overflow = '';
      }, 300);
    }, remainingTime);
  }

  /**
   * Create overlay element
   */
  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.style.zIndex = config.zIndex;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-live', 'assertive');
    overlay.setAttribute('aria-label', 'Loading');

    // Spinner container
    const spinnerContainer = document.createElement('div');
    spinnerContainer.className = 'loading-spinner-container';

    // Spinner
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinnerContainer.appendChild(spinner);

    // Message
    if (config.showText) {
      const messageEl = document.createElement('div');
      messageEl.className = 'loading-message';
      messageEl.id = 'loading-message';
      spinnerContainer.appendChild(messageEl);
    }

    overlay.appendChild(spinnerContainer);
  }

  /**
   * Update loading message
   */
  function updateMessage(message) {
    if (!config.showText || !overlay) return;

    const messageEl = overlay.querySelector('#loading-message');
    if (messageEl) {
      messageEl.textContent = message;
    }
  }

  /**
   * Check if overlay is currently visible
   */
  function isShowing() {
    return isVisible;
  }

  /**
   * Wrap an async function with loading overlay
   */
  async function wrap(asyncFn, message = 'Loading...') {
    show(message);
    try {
      const result = await asyncFn();
      hide();
      return result;
    } catch (error) {
      hide();
      throw error;
    }
  }

  /**
   * Wrap a promise with loading overlay
   */
  async function wrapPromise(promise, message = 'Loading...') {
    show(message);
    try {
      const result = await promise;
      hide();
      return result;
    } catch (error) {
      hide();
      throw error;
    }
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
    show,
    hide,
    isShowing,
    wrap,
    wrapPromise,
    updateMessage
  };
})();

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LoadingOverlay;
}
