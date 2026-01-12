/**
 * Custom Dropdown Component with Portal Pattern
 * 
 * Renders dropdown menus in a portal container to escape overflow constraints.
 * 
 * Features:
 * - Portal rendering (escapes overflow:hidden)
 * - Smart dropup detection (opens upward if near viewport bottom)
 * - Close on scroll (except within dropdown)
 * - Close on click outside
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - HTMX cleanup support
 * 
 * @example
 * // Required HTML structure:
 * <div data-dropdown>
 *   <input type="hidden" id="my-dropdown" value="">
 *   <button data-dropdown-trigger>
 *     <span data-dropdown-label>Select...</span>
 *   </button>
 *   <div data-dropdown-menu class="dropdown-menu hidden">
 *     <button data-dropdown-option data-value="1">Option 1</button>
 *     <button data-dropdown-option data-value="2">Option 2</button>
 *   </div>
 * </div>
 * 
 * @module Dropdown
 */

(function() {
  'use strict';

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
    Z_INDEX: 100
  };

  // ============================================
  // DROPDOWN CLASS
  // ============================================

  /**
   * Dropdown component class
   * @class
   */
  class Dropdown {
    /**
     * Create a dropdown instance
     * @param {HTMLElement} el - Container element with [data-dropdown] attribute
     */
    constructor(el) {
      this.el = el;
      this.trigger = el.querySelector('[data-dropdown-trigger]');
      this.menu = el.querySelector('[data-dropdown-menu]');
      this.input = el.querySelector('input[type="hidden"]');
      this.labelEl = el.querySelector('[data-dropdown-label]');
      this.options = el.querySelectorAll('[data-dropdown-option]');
      this.isOpen = false;
      this.portal = document.getElementById('dropdown-portal');
      
      // Event handler references for cleanup
      this._handlers = {
        triggerClick: null,
        optionClicks: [],
        keydownEl: null,
        keydownMenu: null,
        clickOutside: null,
        scroll: null
      };

      // Validate required elements
      if (!this._validate()) {
        return;
      }

      // Move menu to portal if portal exists
      if (this.portal && this.menu) {
        this.menu.remove();
        this.portal.appendChild(this.menu);
      }

      this._init();
    }

    /**
     * Validate required DOM elements exist
     * @private
     * @returns {boolean} True if all required elements exist
     */
    _validate() {
      if (!this.trigger) {
        console.warn('Dropdown: Missing [data-dropdown-trigger] element', this.el);
        return false;
      }
      if (!this.menu) {
        console.warn('Dropdown: Missing [data-dropdown-menu] element', this.el);
        return false;
      }
      return true;
    }

    /**
     * Initialize event listeners
     * @private
     */
    _init() {
      // Toggle on trigger click
      this._handlers.triggerClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
      };
      this.trigger.addEventListener('click', this._handlers.triggerClick);

      // Handle option selection
      this.options.forEach(opt => {
        const handler = (e) => {
          e.preventDefault();
          this.select(opt);
        };
        this._handlers.optionClicks.push({ element: opt, handler });
        opt.addEventListener('click', handler);
      });

      // Keyboard navigation
      this._handlers.keydownEl = (e) => this._handleKeydown(e);
      this._handlers.keydownMenu = (e) => this._handleKeydown(e);
      this.el.addEventListener('keydown', this._handlers.keydownEl);
      this.menu.addEventListener('keydown', this._handlers.keydownMenu);

      // Click outside to close
      this._handlers.clickOutside = (e) => {
        if (this.isOpen && !this.el.contains(e.target) && !this.menu.contains(e.target)) {
          this.close();
        }
      };
      document.addEventListener('click', this._handlers.clickOutside);
    }

    /**
     * Toggle dropdown open/closed state
     */
    toggle() {
      this.isOpen ? this.close() : this.open();
    }

    /**
     * Open the dropdown
     */
    open() {
      // Close any other open dropdowns first
      if (window.dropdowns) {
        window.dropdowns.forEach((dropdown) => {
          if (dropdown !== this && dropdown.isOpen) {
            dropdown.close();
          }
        });
      }

      this.isOpen = true;
      this.menu.style.display = 'block';
      this._positionMenu();
      this.trigger.setAttribute('aria-expanded', 'true');

      // Close on scroll (except scrolling within the dropdown menu itself)
      this._handlers.scroll = (e) => {
        if (!this.menu.contains(e.target)) {
          this.close();
        }
      };
      window.addEventListener('scroll', this._handlers.scroll, true);
    }

    /**
     * Close the dropdown
     */
    close() {
      this.isOpen = false;
      this.menu.style.display = 'none';
      this.trigger.setAttribute('aria-expanded', 'false');

      // Remove scroll listener
      if (this._handlers.scroll) {
        window.removeEventListener('scroll', this._handlers.scroll, true);
        this._handlers.scroll = null;
      }
    }

    /**
     * Position the dropdown menu relative to trigger
     * Opens upward if insufficient space below viewport
     * @private
     */
    _positionMenu() {
      const triggerRect = this.trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - triggerRect.bottom - CONFIG.VIEWPORT_MARGIN;
      const spaceAbove = triggerRect.top - CONFIG.VIEWPORT_MARGIN;

      // Set width
      this.menu.style.width = `${triggerRect.width}px`;
      this.menu.style.left = `${triggerRect.left}px`;

      // Decide direction: open upward if not enough space below but more space above
      if (spaceBelow < CONFIG.DEFAULT_MAX_HEIGHT && spaceAbove > spaceBelow) {
        // Open upward
        const maxHeight = Math.max(CONFIG.MIN_HEIGHT, Math.min(CONFIG.DEFAULT_MAX_HEIGHT, spaceAbove));
        this.menu.style.maxHeight = `${maxHeight}px`;
        this.menu.style.top = `${triggerRect.top - Math.min(this.menu.scrollHeight, maxHeight) - CONFIG.TRIGGER_GAP}px`;
      } else {
        // Open downward (default)
        const maxHeight = Math.max(CONFIG.MIN_HEIGHT, Math.min(CONFIG.DEFAULT_MAX_HEIGHT, spaceBelow));
        this.menu.style.maxHeight = `${maxHeight}px`;
        this.menu.style.top = `${triggerRect.bottom + CONFIG.TRIGGER_GAP}px`;
      }
    }

    /**
     * Select an option
     * @param {HTMLElement} opt - Option element to select
     */
    select(opt) {
      const value = opt.dataset.value;
      const label = opt.textContent.trim();

      // Update trigger label
      if (this.labelEl) {
        this.labelEl.textContent = label;
      }

      // Update hidden input and dispatch change event
      if (this.input) {
        this.input.value = value;
        this.input.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Update selected state
      this.options.forEach(o => o.removeAttribute('data-selected'));
      opt.setAttribute('data-selected', 'true');

      this.close();
    }

    /**
     * Reset dropdown to a specific value
     * @param {string} value - Value to reset to (default: empty string)
     */
    reset(value = '') {
      const opt = [...this.options].find(o => o.dataset.value === value);
      if (opt) {
        if (this.labelEl) {
          this.labelEl.textContent = opt.textContent.trim();
        }
        this.options.forEach(o => o.removeAttribute('data-selected'));
        opt.setAttribute('data-selected', 'true');
        if (this.input) {
          this.input.value = value;
        }
      }
    }

    /**
     * Handle keyboard events
     * @private
     * @param {KeyboardEvent} e - Keyboard event
     */
    _handleKeydown(e) {
      switch (e.key) {
        case 'Escape':
          this.close();
          this.trigger.focus();
          break;
          
        case 'Enter':
          if (!this.isOpen) {
            e.preventDefault();
            this.open();
          } else {
            // Select focused option
            const focused = this.menu.querySelector('[data-dropdown-option]:focus');
            if (focused) {
              e.preventDefault();
              this.select(focused);
            }
          }
          break;
          
        case 'ArrowDown':
        case 'ArrowUp':
          if (this.isOpen) {
            e.preventDefault();
            this._navigateOptions(e.key === 'ArrowDown' ? 1 : -1);
          }
          break;
      }
    }

    /**
     * Navigate through options with arrow keys
     * @private
     * @param {number} direction - 1 for down, -1 for up
     */
    _navigateOptions(direction) {
      const items = [...this.options];
      const currentIndex = items.findIndex(o => o === document.activeElement || o.getAttribute('data-selected') === 'true');
      let nextIndex;
      
      if (direction === 1) {
        nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      } else {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      }
      
      items[nextIndex]?.focus();
    }

    /**
     * Cleanup and destroy the dropdown instance
     * Removes all event listeners and DOM references
     */
    destroy() {
      this.close();

      // Remove trigger click handler
      if (this._handlers.triggerClick) {
        this.trigger.removeEventListener('click', this._handlers.triggerClick);
      }

      // Remove option click handlers
      this._handlers.optionClicks.forEach(({ element, handler }) => {
        element.removeEventListener('click', handler);
      });

      // Remove keydown handlers
      if (this._handlers.keydownEl) {
        this.el.removeEventListener('keydown', this._handlers.keydownEl);
      }
      if (this._handlers.keydownMenu) {
        this.menu.removeEventListener('keydown', this._handlers.keydownMenu);
      }

      // Remove click outside handler
      if (this._handlers.clickOutside) {
        document.removeEventListener('click', this._handlers.clickOutside);
      }

      // Remove menu from portal
      if (this.menu && this.menu.parentNode === this.portal) {
        this.menu.remove();
      }

      // Clear references
      this._handlers = null;
    }
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  /** @type {Map<string, Dropdown>} Store dropdown instances for external access */
  window.dropdowns = new Map();

  /**
   * Initialize a single dropdown element
   * @param {HTMLElement} el - Dropdown container element
   * @returns {Dropdown|null} Dropdown instance or null if already initialized
   */
  function initDropdown(el) {
    const input = el.querySelector('input[type="hidden"]');
    const id = input?.id;
    
    // Skip if already initialized
    if (id && window.dropdowns.has(id)) {
      return window.dropdowns.get(id);
    }

    const dropdown = new Dropdown(el);
    
    if (id) {
      window.dropdowns.set(id, dropdown);
    }
    
    return dropdown;
  }

  /**
   * Cleanup a dropdown element
   * @param {HTMLElement} el - Dropdown container element
   */
  function cleanupDropdown(el) {
    const input = el.querySelector('input[type="hidden"]');
    const id = input?.id;
    
    if (id && window.dropdowns.has(id)) {
      window.dropdowns.get(id).destroy();
      window.dropdowns.delete(id);
    }
  }

  // Auto-init all dropdowns on page load
  if (typeof Utils !== 'undefined') {
    Utils.onReady(() => {
      document.querySelectorAll('[data-dropdown]').forEach(initDropdown);
    });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('[data-dropdown]').forEach(initDropdown);
    });
  }

  // Re-initialize dropdowns after HTMX settles new content
  document.addEventListener('htmx:afterSettle', (e) => {
    const target = e.detail?.elt;
    if (!target) return;
    
    if (target.matches?.('[data-dropdown]')) {
      initDropdown(target);
    }
    if (target.querySelectorAll) {
      target.querySelectorAll('[data-dropdown]').forEach(initDropdown);
    }
  });

  // Clean up dropdowns before HTMX swaps content
  document.addEventListener('htmx:beforeSwap', (e) => {
    const target = e.detail?.elt;
    if (!target?.querySelectorAll) return;
    
    target.querySelectorAll('[data-dropdown]').forEach(cleanupDropdown);
  });

  // Export for manual use
  window.Dropdown = Dropdown;
  window.initDropdown = initDropdown;
})();
