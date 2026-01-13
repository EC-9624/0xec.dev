/**
 * Drawer Component
 * Slide-out panel with dirty form tracking and HTMX integration
 */
(function () {
  "use strict";

  let isOpen = false;
  let initialFormData = null;
  let previouslyFocusedElement = null;
  let focusTrapHandler = null;

  const backdrop = () => document.getElementById("drawer-backdrop");
  const panel = () => document.getElementById("drawer-panel");
  const title = () => document.getElementById("drawer-title");
  const content = () => document.getElementById("drawer-content");
  
  // Selector for focusable elements within the drawer
  const FOCUSABLE_SELECTOR = 
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
    'textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';

  /**
   * Open the drawer and optionally load content via HTMX
   * @param {string} drawerTitle - Title to display in the drawer header
   * @param {string} [url] - Optional URL to fetch content from
   */
  function open(drawerTitle, url) {
    // Ensure body exists before manipulating it
    if (!document.body) return;
    const backdropEl = backdrop();
    const panelEl = panel();
    const titleEl = title();
    const contentEl = content();

    if (!backdropEl || !panelEl) return;

    // Set title
    if (titleEl && drawerTitle) {
      titleEl.textContent = drawerTitle;
    }

    // Show loading state and fetch content if URL provided
    if (url && contentEl) {
      contentEl.innerHTML =
        '<div class="p-6 flex items-center justify-center"><span class="animate-spin">↻</span></div>';
      htmx.ajax("GET", url, { target: "#drawer-content", swap: "innerHTML" });
    }

    // Open drawer
    backdropEl.classList.add("open");
    panelEl.classList.add("open");
    isOpen = true;

    // Prevent body scroll
    document.body.style.overflow = "hidden";

    // Store the element that triggered the drawer for focus restoration
    previouslyFocusedElement = document.activeElement;

    // Set up focus trap
    setupFocusTrap(panelEl);

    // Focus the panel for accessibility (first focusable will be focused after content loads)
    panelEl.focus();

    // Add escape key listener
    document.addEventListener("keydown", handleEscape);
  }

  /**
   * Set up focus trap within the drawer panel
   * @param {HTMLElement} panelEl - The drawer panel element
   */
  function setupFocusTrap(panelEl) {
    focusTrapHandler = (e) => {
      if (e.key !== 'Tab' || !isOpen) return;

      const focusableElements = panelEl.querySelectorAll(FOCUSABLE_SELECTOR);
      if (focusableElements.length === 0) return;

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: If on first element, wrap to last
        if (document.activeElement === firstFocusable || document.activeElement === panelEl) {
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
    };

    document.addEventListener('keydown', focusTrapHandler);
  }

  /**
   * Remove focus trap handler
   */
  function removeFocusTrap() {
    if (focusTrapHandler) {
      document.removeEventListener('keydown', focusTrapHandler);
      focusTrapHandler = null;
    }
  }

  /**
   * Close the drawer, with optional dirty form check
   * @param {boolean} [force=false] - Skip dirty check if true
   * @returns {boolean} - Whether the drawer was closed
   */
  function close(force = false) {
    if (!isOpen) return true;

    // Check for unsaved changes
    if (!force && isDirty()) {
      const confirmed = confirm(
        "You have unsaved changes. Are you sure you want to close?"
      );
      if (!confirmed) return false;
    }

    const backdropEl = backdrop();
    const panelEl = panel();
    const contentEl = content();

    if (!backdropEl || !panelEl) return true;

    // Close drawer
    backdropEl.classList.remove("open");
    panelEl.classList.remove("open");
    isOpen = false;

    // Re-enable body scroll
    document.body.style.overflow = "";

    // Remove focus trap
    removeFocusTrap();

    // Restore focus to the element that opened the drawer
    if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
      previouslyFocusedElement.focus();
    }
    previouslyFocusedElement = null;

    // Clear content after animation
    setTimeout(() => {
      if (contentEl) contentEl.innerHTML = "";
      initialFormData = null;
    }, 200);

    // Remove escape key listener
    document.removeEventListener("keydown", handleEscape);

    return true;
  }

  /**
   * Handle escape key press
   */
  function handleEscape(e) {
    if (e.key === "Escape" && isOpen) {
      close();
    }
  }

  /**
   * Capture initial form state for dirty tracking
   */
  function captureFormState() {
    const contentEl = content();
    if (!contentEl) return;

    const form = contentEl.querySelector("form");
    if (!form) return;

    initialFormData = serializeForm(form);
  }

  /**
   * Check if the form has unsaved changes
   * @returns {boolean}
   */
  function isDirty() {
    const contentEl = content();
    if (!contentEl || !initialFormData) return false;

    const form = contentEl.querySelector("form");
    if (!form) return false;

    const currentData = serializeForm(form);
    return initialFormData !== currentData;
  }

  /**
   * Serialize form data to a string for comparison
   * @param {HTMLFormElement} form
   * @returns {string}
   */
  function serializeForm(form) {
    const formData = new FormData(form);
    const entries = [];

    for (const [key, value] of formData.entries()) {
      // Skip CSRF token as it doesn't represent user changes
      if (key === "csrf_token") continue;
      entries.push(`${key}=${value}`);
    }

    return entries.sort().join("&");
  }

  /**
   * Check if drawer is currently open
   * @returns {boolean}
   */
  function isDrawerOpen() {
    return isOpen;
  }

  // Expose functions globally FIRST so they're available immediately
  // This must happen before any event listeners that might fail
  window.drawerOpen = open;
  window.drawerClose = close;
  window.drawerIsDirty = isDirty;
  window.drawerIsOpen = isDrawerOpen;

  // Listen for HTMX content swap to capture initial form state and focus first element
  document.addEventListener("htmx:afterSwap", function (e) {
    if (e.detail.target.id === "drawer-content") {
      // Small delay to ensure form is fully rendered
      setTimeout(() => {
        captureFormState();
        
        // Focus the first focusable element in the new content
        if (isOpen) {
          const panelEl = panel();
          if (panelEl) {
            const firstFocusable = panelEl.querySelector(FOCUSABLE_SELECTOR);
            if (firstFocusable) {
              firstFocusable.focus();
            }
          }
        }
      }, 50);
    }
  });

  // Listen for custom closeDrawer event from server (HX-Trigger header)
  // Use document instead of document.body since script runs in <head>
  document.addEventListener("closeDrawer", function () {
    close(true); // Force close without dirty check
  });
})();
