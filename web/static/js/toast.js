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

(function () {
  "use strict";

  /**
   * Configuration constants
   */
  const CONFIG = {
    /** ID of the toast container element */
    CONTAINER_ID: "toast-container",
    /** Auto-dismiss delay in milliseconds */
    DISMISS_DELAY: 3000,
    /** Exit animation duration in milliseconds */
    EXIT_ANIMATION_DURATION: 200,
    /** CSS class prefix for toast type */
    TYPE_PREFIX: "toast-",
    /** CSS class for exit animation */
    EXIT_CLASS: "toast-exit",
  };

  /**
   * Icons for each toast type
   */
  const ICONS = {
    error: '<span class="toast-icon" aria-hidden="true">&#x2717;</span>',
    success: '<span class="toast-icon" aria-hidden="true">&#x2713;</span>',
    warning: '<span class="toast-icon" aria-hidden="true">&#x26A0;</span>',
    info: '<span class="toast-icon" aria-hidden="true">&#x2139;</span>',
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
    if (typeof Utils !== "undefined" && Utils.escapeHtml) {
      return Utils.escapeHtml(text);
    }
    const div = document.createElement("div");
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
  function show(message, type = "error") {
    const container = getContainer();
    if (!container) return null;

    const toast = document.createElement("div");
    toast.className = `toast ${CONFIG.TYPE_PREFIX}${type}`;
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "polite");

    const icon = ICONS[type] || ICONS.error;
    toast.innerHTML = `${icon} ${escapeHtml(message)}`;

    // Click to dismiss
    toast.addEventListener("click", () => dismiss(toast));

    container.appendChild(toast);

    // Auto-dismiss
    setTimeout(() => dismiss(toast), CONFIG.DISMISS_DELAY);

    return toast;
  }

  /**
   * Retry timeout in milliseconds
   */
  const RETRY_TIMEOUT = 10000;

  /**
   * Generate inline spinner HTML
   * @returns {string} HTML string
   */
  function inlineSpinnerHtml() {
    return `
      <div class="flex items-center justify-center py-4 text-muted-foreground">
        <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
        </svg>
      </div>
    `;
  }

  /**
   * Generate inline error HTML for network errors
   * @param {string} message - Error message
   * @param {string} retryUrl - URL to retry
   * @returns {string} HTML string
   */
  function inlineErrorHtml(message, retryUrl) {
    return `
      <div class="flex items-center justify-center gap-2 py-4 text-sm text-destructive" data-inline-error>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" x2="12" y1="8" y2="12"></line>
          <line x1="12" x2="12.01" y1="16" y2="16"></line>
        </svg>
        <span>${escapeHtml(message)}</span>
        <button type="button" class="btn-ghost btn-sm" data-retry-url="${escapeHtml(
          retryUrl
        )}">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
            <path d="M21 3v5h-5"></path>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
            <path d="M8 16H3v5"></path>
          </svg>
        </button>
      </div>
    `;
  }

  /**
   * Find the original container that should receive error/retry content
   * Looks for parent element with hx-get and hx-swap="innerHTML"
   * @param {HTMLElement} element - The element that triggered the error
   * @returns {HTMLElement|null} The container element
   */
  function findErrorContainer(element) {
    // If this is inside an inline error, find the parent container
    const inlineError = element.closest("[data-inline-error]");
    if (inlineError) {
      const container = inlineError.closest('[hx-get][hx-swap="innerHTML"]');
      if (container) return container;
    }

    // Check if the element itself is a valid container
    const swapAttr = element.getAttribute("hx-swap");
    if (swapAttr && swapAttr.includes("innerHTML")) {
      return element;
    }

    return null;
  }

  /**
   * Track active request timeouts by element
   */
  const requestTimeouts = new WeakMap();

  /**
   * Setup HTMX error handlers
   */
  function setupHtmxHandlers() {
    // Track request start and set timeout for inline content areas
    document.body.addEventListener("htmx:beforeRequest", function (event) {
      const target = event.detail.elt;
      const swapAttr = target.getAttribute("hx-swap");
      const retryUrl = target.getAttribute("hx-get");

      // Only set timeout for inline content areas
      if (swapAttr && swapAttr.includes("innerHTML") && retryUrl) {
        const timeoutId = setTimeout(function () {
          // Abort the request
          if (event.detail.xhr) {
            event.detail.xhr.abort();
          }
          target.innerHTML = inlineErrorHtml("Request timed out", retryUrl);
        }, RETRY_TIMEOUT);

        requestTimeouts.set(target, timeoutId);
      }
    });

    // Clear timeout when request completes (success or error)
    document.body.addEventListener("htmx:afterRequest", function (event) {
      const target = event.detail.elt;
      const timeoutId = requestTimeouts.get(target);
      if (timeoutId) {
        clearTimeout(timeoutId);
        requestTimeouts.delete(target);
      }
    });

    // Handle server errors (4xx/5xx)
    // Note: Server returns InlineErrorWithRetry for inline content, so we only
    // show toast for errors that aren't handled inline (e.g., form submissions)
    document.body.addEventListener("htmx:responseError", function (event) {
      const target = event.detail.elt;
      const swapAttr = target.getAttribute("hx-swap");

      // Don't show toast if this is an inline content area (server handles error display)
      if (swapAttr && swapAttr.includes("innerHTML")) {
        return;
      }

      show("Failed to save", "error");
    });

    // Handle network errors (offline, timeout, etc.)
    document.body.addEventListener("htmx:sendError", function (event) {
      const target = event.detail.elt;
      const container = findErrorContainer(target);
      const retryUrl =
        target.getAttribute("hx-get") || target.getAttribute("data-retry-url");

      if (container && retryUrl) {
        container.innerHTML = inlineErrorHtml("Connection error", retryUrl);
      } else {
        show("Connection error", "error");
      }
    });

    // Handle retry button clicks (using event delegation)
    document.body.addEventListener("click", function (event) {
      const retryBtn = event.target.closest("[data-retry-url]");
      if (!retryBtn) return;

      const retryUrl = retryBtn.getAttribute("data-retry-url");
      const container = retryBtn.closest('[hx-get][hx-swap="innerHTML"]');

      if (container && retryUrl) {
        // Show spinner while retrying
        container.innerHTML = inlineSpinnerHtml();

        // Set timeout to show error if request takes too long
        const timeoutId = setTimeout(function () {
          container.innerHTML = inlineErrorHtml("Request timed out", retryUrl);
        }, RETRY_TIMEOUT);

        // Trigger the HTMX request
        htmx
          .ajax("GET", retryUrl, { target: container, swap: "innerHTML" })
          .then(function () {
            clearTimeout(timeoutId);
          })
          .catch(function () {
            clearTimeout(timeoutId);
            container.innerHTML = inlineErrorHtml("Connection error", retryUrl);
          });
      }
    });
  }

  // Initialize HTMX handlers on DOM ready
  if (typeof Utils !== "undefined") {
    Utils.onReady(setupHtmxHandlers);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupHtmxHandlers);
  } else {
    setupHtmxHandlers();
  }

  // Export to window
  window.Toast = {
    show: show,
    dismiss: dismiss,

    // Convenience methods
    error: (msg) => show(msg, "error"),
    success: (msg) => show(msg, "success"),
    warning: (msg) => show(msg, "warning"),
    info: (msg) => show(msg, "info"),
  };
})();
