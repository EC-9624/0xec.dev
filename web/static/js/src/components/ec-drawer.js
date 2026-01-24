/**
 * ec-drawer - Slide-out drawer Web Component
 *
 * Features:
 * - Slide-out panel with backdrop
 * - HTMX content loading
 * - Dirty form tracking (warns on close if unsaved changes)
 * - Focus trap for accessibility
 * - Focus restoration on close
 * - Escape key / backdrop click to close
 * - Server-triggered close via custom event
 *
 * Usage:
 * <ec-drawer>
 *   <div data-backdrop></div>
 *   <aside data-panel role="dialog" aria-modal="true">
 *     <header data-header>
 *       <h2 data-title></h2>
 *       <button data-close>X</button>
 *     </header>
 *     <div data-content></div>
 *   </aside>
 * </ec-drawer>
 *
 * API:
 * window.drawerOpen('Title', '/url');  // Open with title and optional URL
 * window.drawerClose();                // Close with dirty check
 * window.drawerClose(true);            // Force close
 * window.drawerIsDirty();              // Check for unsaved changes
 * window.drawerIsOpen();               // Check if open
 */

class EcDrawer extends HTMLElement {
  // ============================================
  // CONFIGURATION
  // ============================================

  static FOCUSABLE_SELECTOR =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
    'textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';

  static ANIMATION_DURATION = 200;

  // ============================================
  // PRIVATE STATE
  // ============================================

  #isOpen = false;
  #initialFormData = null;
  #previouslyFocusedElement = null;
  #abortController = null;
  #focusTrapController = null;

  // Element references
  #backdrop = null;
  #panel = null;
  #title = null;
  #content = null;
  #closeBtn = null;

  // ============================================
  // LIFECYCLE
  // ============================================

  connectedCallback() {
    // Find server-rendered elements
    this.#backdrop = this.querySelector("[data-backdrop]");
    this.#panel = this.querySelector("[data-panel]");
    this.#title = this.querySelector("[data-title]");
    this.#content = this.querySelector("[data-content]");
    this.#closeBtn = this.querySelector("[data-close]");

    if (!this.#backdrop || !this.#panel) {
      console.warn("ec-drawer: Missing [data-backdrop] or [data-panel]", this);
      return;
    }

    // Setup event listeners
    this.#abortController = new AbortController();
    this.#setupListeners(this.#abortController.signal);

    // Register global API
    window.drawerOpen = this.open.bind(this);
    window.drawerClose = this.close.bind(this);
    window.drawerIsDirty = this.isDirty.bind(this);
    window.drawerIsOpen = () => this.#isOpen;
  }

  disconnectedCallback() {
    this.#abortController?.abort();
    this.#focusTrapController?.abort();

    // Clear global references
    if (window.drawerOpen === this.open.bind(this)) {
      window.drawerOpen = null;
      window.drawerClose = null;
      window.drawerIsDirty = null;
      window.drawerIsOpen = null;
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Open the drawer and optionally load content via HTMX
   * @param {string} drawerTitle - Title to display in the drawer header
   * @param {string} [url] - Optional URL to fetch content from
   */
  open(drawerTitle, url) {
    if (!document.body) return;
    if (!this.#backdrop || !this.#panel) return;

    // Set title
    if (this.#title && drawerTitle) {
      this.#title.textContent = drawerTitle;
    }

    // Show loading state and fetch content if URL provided
    if (url && this.#content) {
      this.#content.innerHTML =
        '<div class="p-6 flex items-center justify-center"><span class="animate-spin">&#8635;</span></div>';
      htmx.ajax("GET", url, {
        target: this.#content,
        swap: "innerHTML",
      });
    }

    // Open drawer
    this.#backdrop.classList.add("open");
    this.#panel.classList.add("open");
    this.#isOpen = true;

    // Prevent body scroll
    document.body.style.overflow = "hidden";

    // Store the element that triggered the drawer for focus restoration
    this.#previouslyFocusedElement = document.activeElement;

    // Set up focus trap
    this.#setupFocusTrap();

    // Focus the panel for accessibility
    this.#panel.focus();
  }

  /**
   * Close the drawer, with optional dirty form check
   * @param {boolean} [force=false] - Skip dirty check if true
   * @returns {boolean} - Whether the drawer was closed
   */
  close(force = false) {
    if (!this.#isOpen) return true;

    // Check for unsaved changes
    if (!force && this.isDirty()) {
      const confirmed = confirm(
        "You have unsaved changes. Are you sure you want to close?"
      );
      if (!confirmed) return false;
    }

    if (!this.#backdrop || !this.#panel) return true;

    // Close drawer
    this.#backdrop.classList.remove("open");
    this.#panel.classList.remove("open");
    this.#isOpen = false;

    // Re-enable body scroll
    document.body.style.overflow = "";

    // Remove focus trap
    this.#removeFocusTrap();

    // Restore focus to the element that opened the drawer
    if (
      this.#previouslyFocusedElement &&
      typeof this.#previouslyFocusedElement.focus === "function"
    ) {
      this.#previouslyFocusedElement.focus();
    }
    this.#previouslyFocusedElement = null;

    // Clear content after animation
    setTimeout(() => {
      if (this.#content) this.#content.innerHTML = "";
      this.#initialFormData = null;
    }, EcDrawer.ANIMATION_DURATION);

    return true;
  }

  /**
   * Check if the form has unsaved changes
   * @returns {boolean}
   */
  isDirty() {
    if (!this.#content || !this.#initialFormData) return false;

    const form = this.#content.querySelector("form");
    if (!form) return false;

    const currentData = this.#serializeForm(form);
    return this.#initialFormData !== currentData;
  }

  /**
   * Check if drawer is currently open
   * @returns {boolean}
   */
  get isOpen() {
    return this.#isOpen;
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Setup event listeners
   * @param {AbortSignal} signal
   */
  #setupListeners(signal) {
    // Backdrop click to close
    this.#backdrop?.addEventListener(
      "click",
      () => this.close(),
      { signal }
    );

    // Close button click
    this.#closeBtn?.addEventListener(
      "click",
      () => this.close(),
      { signal }
    );

    // Escape key to close
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape" && this.#isOpen) {
          this.close();
        }
      },
      { signal }
    );

    // Listen for HTMX content swap to capture initial form state
    document.addEventListener(
      "htmx:afterSwap",
      (e) => {
        if (e.detail.target === this.#content) {
          // Small delay to ensure form is fully rendered
          setTimeout(() => {
            this.#captureFormState();

            // Focus the first focusable element in the new content
            if (this.#isOpen && this.#panel) {
              const firstFocusable = this.#panel.querySelector(
                EcDrawer.FOCUSABLE_SELECTOR
              );
              if (firstFocusable) {
                firstFocusable.focus();
              }
            }
          }, 50);
        }
      },
      { signal }
    );

    // Listen for custom closeDrawer event from server (HX-Trigger header)
    document.addEventListener(
      "closeDrawer",
      () => this.close(true),
      { signal }
    );
  }

  /**
   * Set up focus trap within the drawer panel
   */
  #setupFocusTrap() {
    this.#focusTrapController = new AbortController();
    const { signal } = this.#focusTrapController;

    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "Tab" || !this.#isOpen) return;

        const focusableElements = this.#panel.querySelectorAll(
          EcDrawer.FOCUSABLE_SELECTOR
        );
        if (focusableElements.length === 0) return;

        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Shift+Tab: If on first element, wrap to last
          if (
            document.activeElement === firstFocusable ||
            document.activeElement === this.#panel
          ) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          // Tab: If on last element, wrap to first
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      },
      { signal }
    );
  }

  /**
   * Remove focus trap handler
   */
  #removeFocusTrap() {
    this.#focusTrapController?.abort();
    this.#focusTrapController = null;
  }

  /**
   * Capture initial form state for dirty tracking
   */
  #captureFormState() {
    if (!this.#content) return;

    const form = this.#content.querySelector("form");
    if (!form) return;

    this.#initialFormData = this.#serializeForm(form);
  }

  /**
   * Serialize form data to a string for comparison
   * @param {HTMLFormElement} form
   * @returns {string}
   */
  #serializeForm(form) {
    const formData = new FormData(form);
    const entries = [];

    for (const [key, value] of formData.entries()) {
      // Skip CSRF token as it doesn't represent user changes
      if (key === "csrf_token") continue;
      entries.push(`${key}=${value}`);
    }

    return entries.sort().join("&");
  }
}

// ============================================
// REGISTER CUSTOM ELEMENT
// ============================================

customElements.define("ec-drawer", EcDrawer);

// ============================================
// BACKWARD COMPATIBILITY
// ============================================

// Expose class for external use
window.EcDrawer = EcDrawer;
