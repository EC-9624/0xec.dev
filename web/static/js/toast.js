/**
 * Toast Notifications Module
 * Provides simple toast notifications for user feedback.
 * 
 * @module Toast
 * 
 * Usage:
 * Toast.show('Message', 'error');   // Error toast (default)
 * Toast.show('Message', 'success'); // Success toast
 * Toast.show('Message', 'warning'); // Warning toast
 * Toast.show('Message', 'info');    // Info toast
 * 
 * Requires a container element with id="toast-container" in the DOM.
 */

(function() {
  'use strict';

  /**
   * Configuration constants
   */
  const CONFIG = {
    /** ID of the toast container element */
    CONTAINER_ID: 'toast-container',
    /** Auto-dismiss delay in milliseconds */
    DISMISS_DELAY: 3000,
    /** Exit animation duration in milliseconds */
    EXIT_ANIMATION_DURATION: 200,
    /** CSS class prefix for toast type */
    TYPE_PREFIX: 'toast-',
    /** CSS class for exit animation */
    EXIT_CLASS: 'toast-exit'
  };

  /**
   * Icons for each toast type
   */
  const ICONS = {
    error: '<span class="toast-icon" aria-hidden="true">&#x2717;</span>',
    success: '<span class="toast-icon" aria-hidden="true">&#x2713;</span>',
    warning: '<span class="toast-icon" aria-hidden="true">&#x26A0;</span>',
    info: '<span class="toast-icon" aria-hidden="true">&#x2139;</span>'
  };

  /**
   * Get or validate toast container
   * @returns {HTMLElement|null}
   */
  function getContainer() {
    const container = document.getElementById(CONFIG.CONTAINER_ID);
    if (!container) {
      console.warn(`[Toast] Container #${CONFIG.CONTAINER_ID} not found`);
    }
    return container;
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text 
   * @returns {string}
   */
  function escapeHtml(text) {
    if (typeof Utils !== 'undefined' && Utils.escapeHtml) {
      return Utils.escapeHtml(text);
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Dismiss a toast with animation
   * @param {HTMLElement} toast - The toast element to dismiss
   */
  function dismiss(toast) {
    if (!toast || toast.classList.contains(CONFIG.EXIT_CLASS)) {
      return; // Already dismissing
    }
    
    toast.classList.add(CONFIG.EXIT_CLASS);
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, CONFIG.EXIT_ANIMATION_DURATION);
  }

  /**
   * Show a toast notification
   * @param {string} message - The message to display
   * @param {string} [type='error'] - The type of toast (error, success, warning, info)
   * @returns {HTMLElement|null} The toast element, or null if container not found
   */
  function show(message, type = 'error') {
    const container = getContainer();
    if (!container) return null;
    
    const toast = document.createElement('div');
    toast.className = `toast ${CONFIG.TYPE_PREFIX}${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    
    const icon = ICONS[type] || ICONS.error;
    toast.innerHTML = `${icon} ${escapeHtml(message)}`;
    
    // Click to dismiss
    toast.addEventListener('click', () => dismiss(toast));
    
    container.appendChild(toast);
    
    // Auto-dismiss
    setTimeout(() => dismiss(toast), CONFIG.DISMISS_DELAY);
    
    return toast;
  }

  /**
   * Setup HTMX error handlers
   */
  function setupHtmxHandlers() {
    // Handle server errors (4xx/5xx)
    document.body.addEventListener('htmx:responseError', function() {
      show('Failed to save', 'error');
    });

    // Handle network errors (offline, timeout, etc.)
    document.body.addEventListener('htmx:sendError', function() {
      show('Connection error', 'error');
    });
  }

  // Initialize HTMX handlers on DOM ready
  if (typeof Utils !== 'undefined') {
    Utils.onReady(setupHtmxHandlers);
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHtmxHandlers);
  } else {
    setupHtmxHandlers();
  }

  // Export to window
  window.Toast = {
    show: show,
    dismiss: dismiss,
    
    // Convenience methods
    error: (msg) => show(msg, 'error'),
    success: (msg) => show(msg, 'success'),
    warning: (msg) => show(msg, 'warning'),
    info: (msg) => show(msg, 'info')
  };
})();
