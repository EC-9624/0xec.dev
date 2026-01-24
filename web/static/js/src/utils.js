/**
 * Shared Utilities Module
 * Common helper functions used across JavaScript components
 */

/**
 * Execute callback when DOM is ready
 * @param {Function} callback - Function to execute when DOM is ready
 */
export function onReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback);
  } else {
    callback();
  }
}

/**
 * Setup click outside handler with cleanup capability
 * @param {HTMLElement[]} elements - Elements to check if click is inside
 * @param {Function} callback - Callback when click is outside all elements
 * @returns {Function} Cleanup function to remove the listener
 */
export function onClickOutside(elements, callback) {
  const handler = (e) => {
    const isOutside = elements.every(el => !el?.contains(e.target));
    if (isOutside) callback(e);
  };
  document.addEventListener('click', handler);
  return () => document.removeEventListener('click', handler);
}

/**
 * Initialize components on HTMX content updates
 * @param {string} selector - CSS selector for elements to initialize
 * @param {Function} initFn - Initialization function for each element
 * @param {Object} options - Options
 * @param {string} options.event - HTMX event to listen for (default: 'htmx:afterSettle')
 */
export function initOnHtmx(selector, initFn, options = {}) {
  const event = options.event || 'htmx:afterSettle';
  document.addEventListener(event, (e) => {
    const target = e.detail?.elt;
    if (!target) return;

    // Check if target itself matches
    if (target.matches?.(selector)) {
      initFn(target);
    }

    // Check children
    if (target.querySelectorAll) {
      target.querySelectorAll(selector).forEach(initFn);
    }
  });
}

/**
 * Cleanup components before HTMX swaps content
 * @param {string} selector - CSS selector for elements to cleanup
 * @param {Function} cleanupFn - Cleanup function for each element
 */
export function cleanupOnHtmx(selector, cleanupFn) {
  document.addEventListener('htmx:beforeSwap', (e) => {
    const target = e.detail?.elt;
    if (!target?.querySelectorAll) return;

    target.querySelectorAll(selector).forEach(cleanupFn);
  });
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML string
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Debounce function execution
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Generate unique ID
 * @param {string} prefix - Optional prefix for the ID
 * @returns {string} Unique ID string
 */
export function uniqueId(prefix = 'uid') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Expose globally for backward compatibility
window.Utils = {
  onReady,
  onClickOutside,
  initOnHtmx,
  cleanupOnHtmx,
  escapeHtml,
  debounce,
  uniqueId,
};
