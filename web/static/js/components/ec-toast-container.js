/**
 * ec-toast-container - Toast notifications Web Component
 *
 * Provides toast notifications with HTMX error handling integration.
 *
 * Usage:
 * <ec-toast-container></ec-toast-container>
 *
 * API:
 * Toast.show('Message', 'error');   // Error toast (default)
 * Toast.show('Message', 'success'); // Success toast
 * Toast.show('Message', 'warning'); // Warning toast
 * Toast.show('Message', 'info');    // Info toast
 * Toast.error('Message');           // Shorthand
 * Toast.success('Message');         // Shorthand
 */

class EcToastContainer extends HTMLElement {
  // ============================================
  // CONFIGURATION
  // ============================================

  static CONFIG = {
    /** Auto-dismiss delay in milliseconds */
    DISMISS_DELAY: 3000,
    /** Exit animation duration in milliseconds */
    EXIT_ANIMATION_DURATION: 200,
    /** Request timeout for inline content areas */
    RETRY_TIMEOUT: 10000,
  };

  static ICONS = {
    error: '<span class="toast-icon" aria-hidden="true">&#x2717;</span>',
    success: '<span class="toast-icon" aria-hidden="true">&#x2713;</span>',
    warning: '<span class="toast-icon" aria-hidden="true">&#x26A0;</span>',
    info: '<span class="toast-icon" aria-hidden="true">&#x2139;</span>',
  };

  // ============================================
  // PRIVATE STATE
  // ============================================

  #abortController = null;
  #requestTimeouts = new WeakMap();

  // ============================================
  // LIFECYCLE
  // ============================================

  connectedCallback() {
    // Set up container attributes
    this.setAttribute("role", "status");
    this.setAttribute("aria-live", "polite");
    this.setAttribute("aria-label", "Notifications");

    // Setup event listeners with AbortController
    this.#abortController = new AbortController();
    this.#setupHtmxHandlers(this.#abortController.signal);

    // Register global instance
    window.Toast = this;
  }

  disconnectedCallback() {
    this.#abortController?.abort();

    // Clear global reference if it points to this instance
    if (window.Toast === this) {
      window.Toast = null;
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Show a toast notification
   * @param {string} message - The message to display
   * @param {string} [type='error'] - Toast type: error, success, warning, info
   * @returns {HTMLElement} The toast element
   */
  show(message, type = "error") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "polite");

    const icon = EcToastContainer.ICONS[type] || EcToastContainer.ICONS.error;
    toast.innerHTML = `${icon} ${this.#escapeHtml(message)}`;

    // Click to dismiss
    toast.addEventListener("click", () => this.dismiss(toast));

    this.appendChild(toast);

    // Auto-dismiss
    setTimeout(
      () => this.dismiss(toast),
      EcToastContainer.CONFIG.DISMISS_DELAY
    );

    return toast;
  }

  /**
   * Dismiss a toast with animation
   * @param {HTMLElement} toast - The toast element to dismiss
   */
  dismiss(toast) {
    if (!toast || toast.classList.contains("toast-exit")) {
      return; // Already dismissing
    }

    toast.classList.add("toast-exit");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, EcToastContainer.CONFIG.EXIT_ANIMATION_DURATION);
  }

  // Convenience methods
  error(msg) {
    return this.show(msg, "error");
  }
  success(msg) {
    return this.show(msg, "success");
  }
  warning(msg) {
    return this.show(msg, "warning");
  }
  info(msg) {
    return this.show(msg, "info");
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Escape HTML to prevent XSS
   * @param {string} text
   * @returns {string}
   */
  #escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Generate inline spinner HTML
   * @returns {string}
   */
  #inlineSpinnerHtml() {
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
   * @returns {string}
   */
  #inlineErrorHtml(message, retryUrl) {
    return `
      <div class="flex items-center justify-center gap-2 py-4 text-sm text-destructive" data-inline-error>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" x2="12" y1="8" y2="12"></line>
          <line x1="12" x2="12.01" y1="16" y2="16"></line>
        </svg>
        <span>${this.#escapeHtml(message)}</span>
        <button type="button" class="btn-ghost btn-sm" data-retry-url="${this.#escapeHtml(retryUrl)}">
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
   * Find the container for inline error display
   * @param {HTMLElement} element
   * @returns {HTMLElement|null}
   */
  #findErrorContainer(element) {
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
   * Setup HTMX event handlers
   * @param {AbortSignal} signal
   */
  #setupHtmxHandlers(signal) {
    // Track request start and set timeout for inline content areas
    document.body.addEventListener(
      "htmx:beforeRequest",
      (event) => {
        const target = event.detail.elt;
        const swapAttr = target.getAttribute("hx-swap");
        const retryUrl = target.getAttribute("hx-get");

        // Only set timeout for inline content areas
        if (swapAttr && swapAttr.includes("innerHTML") && retryUrl) {
          const timeoutId = setTimeout(() => {
            // Abort the request
            if (event.detail.xhr) {
              event.detail.xhr.abort();
            }
            target.innerHTML = this.#inlineErrorHtml(
              "Request timed out",
              retryUrl
            );
          }, EcToastContainer.CONFIG.RETRY_TIMEOUT);

          this.#requestTimeouts.set(target, timeoutId);
        }
      },
      { signal }
    );

    // Clear timeout when request completes (success or error)
    document.body.addEventListener(
      "htmx:afterRequest",
      (event) => {
        const target = event.detail.elt;
        const timeoutId = this.#requestTimeouts.get(target);
        if (timeoutId) {
          clearTimeout(timeoutId);
          this.#requestTimeouts.delete(target);
        }
      },
      { signal }
    );

    // Handle server errors (4xx/5xx)
    document.body.addEventListener(
      "htmx:responseError",
      (event) => {
        const target = event.detail.elt;
        const swapAttr = target.getAttribute("hx-swap");

        // Don't show toast if this is an inline content area
        if (swapAttr && swapAttr.includes("innerHTML")) {
          return;
        }

        this.show("Failed to save", "error");
      },
      { signal }
    );

    // Handle network errors (offline, timeout, etc.)
    document.body.addEventListener(
      "htmx:sendError",
      (event) => {
        const target = event.detail.elt;
        const container = this.#findErrorContainer(target);
        const retryUrl =
          target.getAttribute("hx-get") ||
          target.getAttribute("data-retry-url");

        if (container && retryUrl) {
          container.innerHTML = this.#inlineErrorHtml(
            "Connection error",
            retryUrl
          );
        } else {
          this.show("Connection error", "error");
        }
      },
      { signal }
    );

    // Handle retry button clicks (using event delegation)
    document.body.addEventListener(
      "click",
      (event) => {
        const retryBtn = event.target.closest("[data-retry-url]");
        if (!retryBtn) return;

        const retryUrl = retryBtn.getAttribute("data-retry-url");
        const container = retryBtn.closest('[hx-get][hx-swap="innerHTML"]');

        if (container && retryUrl) {
          // Show spinner while retrying
          container.innerHTML = this.#inlineSpinnerHtml();

          // Set timeout to show error if request takes too long
          const timeoutId = setTimeout(() => {
            container.innerHTML = this.#inlineErrorHtml(
              "Request timed out",
              retryUrl
            );
          }, EcToastContainer.CONFIG.RETRY_TIMEOUT);

          // Trigger the HTMX request
          htmx
            .ajax("GET", retryUrl, { target: container, swap: "innerHTML" })
            .then(() => {
              clearTimeout(timeoutId);
            })
            .catch(() => {
              clearTimeout(timeoutId);
              container.innerHTML = this.#inlineErrorHtml(
                "Connection error",
                retryUrl
              );
            });
        }
      },
      { signal }
    );
  }
}

// ============================================
// REGISTER CUSTOM ELEMENT
// ============================================

customElements.define("ec-toast-container", EcToastContainer);

// ============================================
// BACKWARD COMPATIBILITY
// ============================================

// Expose class for external use
window.EcToastContainer = EcToastContainer;
