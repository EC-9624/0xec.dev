/**
 * ec-dropdown - Custom dropdown Web Component (Light DOM)
 *
 * Features:
 * - Portal rendering (escapes overflow:hidden)
 * - Smart dropup detection (opens upward if near viewport bottom)
 * - Close on scroll (except within dropdown)
 * - Close on click outside
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - HTMX integration (auto cleanup on swap)
 * - Full ARIA support
 *
 * @example
 * <ec-dropdown>
 *   <input type="hidden" id="my-dropdown" value="">
 *   <button data-trigger>
 *     <span data-label>Select...</span>
 *   </button>
 *   <div data-menu class="hidden">
 *     <button data-option data-value="1">Option 1</button>
 *     <button data-option data-value="2">Option 2</button>
 *   </div>
 * </ec-dropdown>
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  /** Maximum height of dropdown menu in pixels */
  DEFAULT_MAX_HEIGHT: 240,
  /** Minimum height to ensure dropdown is usable */
  MIN_HEIGHT: 100,
  /** Margin from viewport edge in pixels */
  VIEWPORT_MARGIN: 4,
  /** Gap between trigger and menu in pixels */
  TRIGGER_GAP: 2,
  /** Z-index for dropdown menu */
  Z_INDEX: 100,
};

// ============================================
// GLOBAL REGISTRY
// ============================================

/** @type {Map<string, EcDropdown>} Store dropdown instances for external access */
const dropdownRegistry = new Map();

// ============================================
// WEB COMPONENT
// ============================================

class EcDropdown extends HTMLElement {
  // Private state
  #abortController = null;
  #scrollAbortController = null;
  #isOpen = false;

  // Element references
  #trigger = null;
  #menu = null;
  #input = null;
  #labelEl = null;
  #options = [];
  #portal = null;
  #menuOriginalParent = null;

  // ============================================
  // LIFECYCLE
  // ============================================

  connectedCallback() {
    // Find child elements
    this.#trigger = this.querySelector("[data-trigger]");
    this.#menu = this.querySelector("[data-menu]");
    this.#input = this.querySelector('input[type="hidden"]');
    this.#labelEl = this.querySelector("[data-label]");
    this.#options = [...this.querySelectorAll("[data-option]")];
    this.#portal = document.getElementById("dropdown-portal");

    // Validate required elements
    if (!this.#trigger || !this.#menu) {
      console.warn("ec-dropdown: Missing [data-trigger] or [data-menu]", this);
      return;
    }

    // Setup with AbortController for easy cleanup
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    this.#initAria();
    this.#setupListeners(signal);
    this.#moveToPortal();

    // Register in global registry
    const id = this.#input?.id;
    if (id) {
      dropdownRegistry.set(id, this);
    }
  }

  disconnectedCallback() {
    // Abort all listeners
    this.#abortController?.abort();
    this.#scrollAbortController?.abort();

    // Restore menu from portal before element is removed
    this.#restoreFromPortal();

    // Close if open
    if (this.#isOpen) {
      this.#isOpen = false;
    }

    // Unregister from global registry
    const id = this.#input?.id;
    if (id) {
      dropdownRegistry.delete(id);
    }
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  #initAria() {
    // Generate unique IDs for ARIA references
    const baseId = this.#input?.id || `dropdown-${Date.now()}`;
    const menuId = `${baseId}-listbox`;

    // Set up trigger as a combobox/listbox opener
    this.#trigger.setAttribute("aria-haspopup", "listbox");
    this.#trigger.setAttribute("aria-controls", menuId);
    this.#trigger.setAttribute("aria-expanded", "false");

    // Set up menu as listbox
    this.#menu.setAttribute("role", "listbox");
    this.#menu.setAttribute("id", menuId);
    this.#menu.setAttribute("tabindex", "-1");

    // Set up each option
    this.#options.forEach((opt, index) => {
      const optionId = `${baseId}-option-${index}`;
      opt.setAttribute("role", "option");
      opt.setAttribute("id", optionId);

      // Set aria-selected based on data-selected attribute
      const isSelected = opt.getAttribute("data-selected") === "true";
      opt.setAttribute("aria-selected", isSelected ? "true" : "false");
    });

    // Set initial aria-activedescendant on trigger
    const selectedOption = this.#options.find(
      (o) => o.getAttribute("data-selected") === "true"
    );
    if (selectedOption) {
      this.#trigger.setAttribute("aria-activedescendant", selectedOption.id);
    }
  }

  #setupListeners(signal) {
    // Toggle on trigger click
    this.#trigger.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
      },
      { signal }
    );

    // Handle option selection
    this.#options.forEach((opt) => {
      opt.addEventListener(
        "click",
        (e) => {
          // Check if this option has HTMX attributes - if so, let HTMX handle the click
          const hasHtmx =
            opt.hasAttribute("hx-post") ||
            opt.hasAttribute("hx-get") ||
            opt.hasAttribute("hx-put") ||
            opt.hasAttribute("hx-delete") ||
            opt.hasAttribute("hx-patch");

          if (!hasHtmx) {
            e.preventDefault();
          }

          this.select(opt, hasHtmx);
        },
        { signal }
      );
    });

    // Keyboard navigation on container and menu
    this.addEventListener("keydown", (e) => this.#handleKeydown(e), { signal });
    this.#menu.addEventListener("keydown", (e) => this.#handleKeydown(e), {
      signal,
    });

    // Click outside to close
    document.addEventListener(
      "click",
      (e) => {
        if (
          this.#isOpen &&
          !this.contains(e.target) &&
          !this.#menu.contains(e.target)
        ) {
          this.close();
        }
      },
      { signal }
    );
  }

  #moveToPortal() {
    // Skip if any option has HTMX attributes (needs DOM tree for "closest" selectors to work)
    const hasHtmxOptions = this.#options.some(
      (opt) =>
        opt.hasAttribute("hx-post") ||
        opt.hasAttribute("hx-get") ||
        opt.hasAttribute("hx-put") ||
        opt.hasAttribute("hx-delete") ||
        opt.hasAttribute("hx-patch")
    );

    if (this.#portal && this.#menu && !hasHtmxOptions) {
      // Store original parent for restoration
      this.#menuOriginalParent = this.#menu.parentElement;
      this.#menu.remove();
      this.#portal.appendChild(this.#menu);
    }
  }

  #restoreFromPortal() {
    // Restore menu to original position before element is removed
    if (
      this.#menu &&
      this.#menu.parentElement === this.#portal &&
      this.#menuOriginalParent
    ) {
      this.#menu.remove();
      this.#menuOriginalParent.appendChild(this.#menu);
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  toggle() {
    this.#isOpen ? this.close() : this.open();
  }

  open() {
    // Close any other open dropdowns first
    dropdownRegistry.forEach((dropdown) => {
      if (dropdown !== this && dropdown.isOpen) {
        dropdown.close();
      }
    });

    this.#isOpen = true;
    this.#menu.style.display = "block";
    this.#positionMenu();
    this.#trigger.setAttribute("aria-expanded", "true");

    // Close on scroll (except scrolling within the dropdown menu itself)
    this.#scrollAbortController = new AbortController();
    window.addEventListener(
      "scroll",
      (e) => {
        if (!this.#menu.contains(e.target)) {
          this.close();
        }
      },
      { capture: true, passive: true, signal: this.#scrollAbortController.signal }
    );
  }

  close() {
    if (!this.#isOpen) return;

    this.#isOpen = false;
    this.#menu.style.display = "none";
    this.#trigger.setAttribute("aria-expanded", "false");

    // Remove scroll listener
    this.#scrollAbortController?.abort();
    this.#scrollAbortController = null;
  }

  /**
   * Select an option
   * @param {HTMLElement} opt - Option element to select
   * @param {boolean} isHtmx - Whether this option has HTMX attributes
   */
  select(opt, isHtmx = false) {
    // For HTMX options, just close - HTMX will handle the rest and replace the element
    if (isHtmx) {
      this.close();
      return;
    }

    const value = opt.dataset.value;
    const label = opt.textContent.trim();

    // Update trigger label
    if (this.#labelEl) {
      this.#labelEl.textContent = label;
    }

    // Update hidden input and dispatch change event
    if (this.#input) {
      this.#input.value = value;
      this.#input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // Update selected state and ARIA
    this.#options.forEach((o) => {
      o.removeAttribute("data-selected");
      o.setAttribute("aria-selected", "false");
    });
    opt.setAttribute("data-selected", "true");
    opt.setAttribute("aria-selected", "true");

    // Update aria-activedescendant on trigger
    this.#trigger.setAttribute("aria-activedescendant", opt.id);

    this.close();
  }

  /**
   * Reset dropdown to a specific value
   * @param {string} value - Value to reset to (default: empty string)
   */
  reset(value = "") {
    const opt = this.#options.find((o) => o.dataset.value === value);
    if (opt) {
      if (this.#labelEl) {
        this.#labelEl.textContent = opt.textContent.trim();
      }
      // Update selected state and ARIA
      this.#options.forEach((o) => {
        o.removeAttribute("data-selected");
        o.setAttribute("aria-selected", "false");
      });
      opt.setAttribute("data-selected", "true");
      opt.setAttribute("aria-selected", "true");
      this.#trigger.setAttribute("aria-activedescendant", opt.id);
      if (this.#input) {
        this.#input.value = value;
      }
    }
  }

  // Getters
  get isOpen() {
    return this.#isOpen;
  }

  get value() {
    return this.#input?.value ?? "";
  }

  set value(val) {
    this.reset(val);
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  #positionMenu() {
    const triggerRect = this.#trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow =
      viewportHeight - triggerRect.bottom - CONFIG.VIEWPORT_MARGIN;
    const spaceAbove = triggerRect.top - CONFIG.VIEWPORT_MARGIN;

    // Set width - use minWidth to allow CSS to override, or match trigger if wider
    const menuMinWidth =
      parseInt(getComputedStyle(this.#menu).minWidth) || 0;
    const menuWidth = Math.max(triggerRect.width, menuMinWidth);
    this.#menu.style.width = `${menuWidth}px`;
    this.#menu.style.left = `${triggerRect.left}px`;

    // Decide direction: open upward if not enough space below but more space above
    if (spaceBelow < CONFIG.DEFAULT_MAX_HEIGHT && spaceAbove > spaceBelow) {
      // Open upward
      const maxHeight = Math.max(
        CONFIG.MIN_HEIGHT,
        Math.min(CONFIG.DEFAULT_MAX_HEIGHT, spaceAbove)
      );
      this.#menu.style.maxHeight = `${maxHeight}px`;
      this.#menu.style.top = `${
        triggerRect.top -
        Math.min(this.#menu.scrollHeight, maxHeight) -
        CONFIG.TRIGGER_GAP
      }px`;
    } else {
      // Open downward (default)
      const maxHeight = Math.max(
        CONFIG.MIN_HEIGHT,
        Math.min(CONFIG.DEFAULT_MAX_HEIGHT, spaceBelow)
      );
      this.#menu.style.maxHeight = `${maxHeight}px`;
      this.#menu.style.top = `${triggerRect.bottom + CONFIG.TRIGGER_GAP}px`;
    }
  }

  #handleKeydown(e) {
    switch (e.key) {
      case "Escape":
        this.close();
        this.#trigger.focus();
        break;

      case "Enter":
        if (!this.#isOpen) {
          e.preventDefault();
          this.open();
        } else {
          // Select focused option
          const focused = this.#menu.querySelector("[data-option]:focus");
          if (focused) {
            e.preventDefault();
            this.select(focused);
          }
        }
        break;

      case "ArrowDown":
      case "ArrowUp":
        if (this.#isOpen) {
          e.preventDefault();
          this.#navigateOptions(e.key === "ArrowDown" ? 1 : -1);
        }
        break;
    }
  }

  #navigateOptions(direction) {
    const items = this.#options;
    const currentIndex = items.findIndex(
      (o) =>
        o === document.activeElement ||
        o.getAttribute("data-selected") === "true"
    );
    let nextIndex;

    if (direction === 1) {
      nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
    } else {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
    }

    const nextItem = items[nextIndex];
    if (nextItem) {
      nextItem.focus();
      // Update aria-activedescendant on trigger for screen readers
      this.#trigger.setAttribute("aria-activedescendant", nextItem.id);
    }
  }
}

// ============================================
// REGISTER CUSTOM ELEMENT
// ============================================

customElements.define("ec-dropdown", EcDropdown);

// ============================================
// BACKWARD COMPATIBILITY
// ============================================

// Expose for external access
window.EcDropdown = EcDropdown;
window.dropdowns = dropdownRegistry;

// Legacy API (for gradual migration)
window.Dropdown = EcDropdown;
window.initDropdown = (el) => {
  // Web Components auto-initialize, this is a no-op
  if (el.tagName === "EC-DROPDOWN") return el;
  console.warn(
    "initDropdown() called on non-ec-dropdown element. Migrate to <ec-dropdown>."
  );
  return null;
};
