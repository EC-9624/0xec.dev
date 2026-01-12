/**
 * Tag Select Component
 * Multi-select dropdown with filtering and inline tag creation
 * 
 * Features:
 * - Multi-select with checkboxes
 * - Live filtering
 * - Inline tag creation via API
 * - Chip display of selected tags
 * - Keyboard navigation
 * - HTMX integration with proper cleanup
 * 
 * @example
 * // Required HTML structure:
 * <div data-tag-select data-field-name="tag_ids">
 *   <div data-tag-trigger>
 *     <div data-tag-chips></div>
 *     <span data-tag-placeholder>Select tags...</span>
 *   </div>
 *   <div data-tag-dropdown class="hidden">
 *     <input type="text" data-tag-filter placeholder="Search...">
 *     <div data-tag-options>
 *       <label data-tag-option data-tag-name="Tag Name">
 *         <input type="checkbox" data-tag-id="1" value="1">
 *         <span>Tag Name</span>
 *       </label>
 *     </div>
 *     <div data-tag-create class="hidden">
 *       <button data-create-tag-btn>Create "<span data-create-tag-name></span>"</button>
 *     </div>
 *   </div>
 * </div>
 * 
 * @module TagSelect
 */

(function() {
  'use strict';

  // ============================================
  // CONFIGURATION
  // ============================================

  const CONFIG = {
    /** API endpoint for creating new tags */
    CREATE_TAG_ENDPOINT: '/admin/tags/create-inline',
    /** Default placeholder text */
    DEFAULT_PLACEHOLDER: 'Select tags...',
    /** Default field name for form submission */
    DEFAULT_FIELD_NAME: 'tag_ids'
  };

  // ============================================
  // TAG SELECT INSTANCES REGISTRY
  // ============================================

  /** @type {Map<HTMLElement, TagSelectInstance>} */
  const instances = new Map();

  // ============================================
  // TAG SELECT CLASS
  // ============================================

  /**
   * Tag Select instance data and methods
   */
  class TagSelectInstance {
    /**
     * Create a tag select instance
     * @param {HTMLElement} container - Container element
     */
    constructor(container) {
      this.container = container;
      this.trigger = container.querySelector('[data-tag-trigger]');
      this.dropdown = container.querySelector('[data-tag-dropdown]');
      this.filterInput = container.querySelector('[data-tag-filter]');
      this.optionsContainer = container.querySelector('[data-tag-options]');
      this.chipsContainer = container.querySelector('[data-tag-chips]');
      this.placeholder = container.querySelector('[data-tag-placeholder]');
      this.createSection = container.querySelector('[data-tag-create]');
      this.createBtn = container.querySelector('[data-create-tag-btn]');
      this.createNameSpan = container.querySelector('[data-create-tag-name]');
      this.fieldName = container.dataset.fieldName || CONFIG.DEFAULT_FIELD_NAME;
      this.isOpen = false;

      // Event handler references for cleanup
      this._handlers = {
        triggerClick: null,
        chipsClick: null,
        filterInput: null,
        filterClick: null,
        optionsChange: null,
        createClick: null,
        documentClick: null,
        containerKeydown: null
      };

      // Validate required elements
      if (!this._validate()) {
        return;
      }

      this._init();
    }

    /**
     * Validate required elements exist
     * @private
     * @returns {boolean}
     */
    _validate() {
      if (!this.trigger) {
        console.warn('TagSelect: Missing [data-tag-trigger] element', this.container);
        return false;
      }
      if (!this.dropdown) {
        console.warn('TagSelect: Missing [data-tag-dropdown] element', this.container);
        return false;
      }
      return true;
    }

    /**
     * Initialize event listeners
     * @private
     */
    _init() {
      // Trigger click
      this._handlers.triggerClick = (e) => {
        if (e.target.closest('[data-remove-tag]')) return;
        this._toggleDropdown();
      };
      this.trigger.addEventListener('click', this._handlers.triggerClick);

      // Chips container click (for remove buttons)
      if (this.chipsContainer) {
        this._handlers.chipsClick = (e) => {
          const removeBtn = e.target.closest('[data-remove-tag]');
          if (removeBtn) {
            e.stopPropagation();
            this._removeTag(removeBtn.dataset.removeTag);
          }
        };
        this.chipsContainer.addEventListener('click', this._handlers.chipsClick);
      }

      // Filter input
      if (this.filterInput) {
        this._handlers.filterInput = (e) => {
          this._filterOptions(e.target.value);
        };
        this.filterInput.addEventListener('input', this._handlers.filterInput);

        this._handlers.filterClick = (e) => {
          e.stopPropagation();
        };
        this.filterInput.addEventListener('click', this._handlers.filterClick);
      }

      // Options change
      if (this.optionsContainer) {
        this._handlers.optionsChange = (e) => {
          if (e.target.matches('input[type="checkbox"]')) {
            this._updateChips();
          }
        };
        this.optionsContainer.addEventListener('change', this._handlers.optionsChange);
      }

      // Create button
      if (this.createBtn) {
        this._handlers.createClick = (e) => {
          e.stopPropagation();
          const name = this.createNameSpan?.textContent?.trim();
          if (name) {
            this._createTag(name);
          }
        };
        this.createBtn.addEventListener('click', this._handlers.createClick);
      }

      // Click outside to close
      this._handlers.documentClick = (e) => {
        if (this.isOpen && !this.container.contains(e.target)) {
          this._toggleDropdown(false);
        }
      };
      document.addEventListener('click', this._handlers.documentClick);

      // Keyboard navigation
      this._handlers.containerKeydown = (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this._toggleDropdown(false);
          this.trigger.focus();
        }
        if (e.key === 'Enter' && this.filterInput === document.activeElement) {
          e.preventDefault();
          if (this.createSection && !this.createSection.classList.contains('hidden')) {
            const name = this.createNameSpan?.textContent?.trim();
            if (name) this._createTag(name);
          }
        }
      };
      this.container.addEventListener('keydown', this._handlers.containerKeydown);
    }

    /**
     * Toggle dropdown visibility
     * @private
     * @param {boolean} [open] - Force open/closed state
     */
    _toggleDropdown(open) {
      this.isOpen = open !== undefined ? open : !this.isOpen;
      this.dropdown.classList.toggle('hidden', !this.isOpen);
      
      if (this.isOpen && this.filterInput) {
        this.filterInput.focus();
        this.filterInput.value = '';
        this._filterOptions('');
      }
    }

    /**
     * Filter options based on search query
     * @private
     * @param {string} query - Search query
     */
    _filterOptions(query) {
      if (!this.optionsContainer) return;

      const normalizedQuery = query.toLowerCase().trim();
      const options = this.optionsContainer.querySelectorAll('[data-tag-option]');
      let hasExactMatch = false;

      options.forEach(option => {
        const name = option.dataset.tagName?.toLowerCase() || '';
        const matches = normalizedQuery === '' || name.includes(normalizedQuery);
        option.hidden = !matches;
        if (name === normalizedQuery) hasExactMatch = true;
      });

      // Show/hide create option
      if (this.createSection && this.createNameSpan) {
        if (normalizedQuery && !hasExactMatch) {
          this.createSection.classList.remove('hidden');
          this.createNameSpan.textContent = query.trim();
        } else {
          this.createSection.classList.add('hidden');
        }
      }
    }

    /**
     * Update chips display based on selected checkboxes
     * @private
     */
    _updateChips() {
      if (!this.chipsContainer || !this.optionsContainer) return;

      const checkboxes = this.optionsContainer.querySelectorAll('input[type="checkbox"]:checked');
      this.chipsContainer.innerHTML = '';

      checkboxes.forEach(cb => {
        const option = cb.closest('[data-tag-option]');
        const name = option?.dataset.tagName || '';
        const id = cb.dataset.tagId;

        const chip = document.createElement('span');
        chip.className = 'tag-chip';
        chip.dataset.tagId = id;
        chip.innerHTML = `
          ${escapeHtml(name)}
          <button type="button" class="tag-chip-remove" data-remove-tag="${id}" aria-label="Remove ${escapeHtml(name)}">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 6 6 18"></path>
              <path d="m6 6 12 12"></path>
            </svg>
          </button>
        `;
        this.chipsContainer.appendChild(chip);
      });

      // Update placeholder visibility
      if (this.placeholder) {
        this.placeholder.textContent = checkboxes.length === 0 ? CONFIG.DEFAULT_PLACEHOLDER : '';
      }
    }

    /**
     * Remove a tag by ID
     * @private
     * @param {string} tagId - Tag ID to remove
     */
    _removeTag(tagId) {
      if (!this.optionsContainer) return;

      const checkbox = this.optionsContainer.querySelector(`input[data-tag-id="${tagId}"]`);
      if (checkbox) {
        checkbox.checked = false;
        this._updateChips();
      }
    }

    /**
     * Create a new tag via API
     * @private
     * @param {string} name - Tag name
     */
    async _createTag(name) {
      const slug = slugify(name);

      try {
        const response = await fetch(CONFIG.CREATE_TAG_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRF-Token': getCSRFToken()
          },
          body: `name=${encodeURIComponent(name)}&slug=${encodeURIComponent(slug)}`
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const tag = await response.json();

        // Add new option to the list
        if (this.optionsContainer) {
          const newOption = document.createElement('label');
          newOption.className = 'tag-select-option';
          newOption.dataset.tagOption = '';
          newOption.dataset.tagName = tag.name;
          newOption.innerHTML = `
            <input type="checkbox" name="${this.fieldName}" value="${tag.id}" 
                   data-tag-checkbox data-tag-id="${tag.id}" checked />
            <span>${escapeHtml(tag.name)}</span>
          `;
          this.optionsContainer.appendChild(newOption);
        }

        // Update UI
        this._updateChips();
        if (this.filterInput) this.filterInput.value = '';
        if (this.createSection) this.createSection.classList.add('hidden');
        this._filterOptions('');

      } catch (error) {
        console.error('Failed to create tag:', error);
        // Use toast if available, otherwise fallback to console
        if (typeof Toast !== 'undefined' && Toast.show) {
          Toast.show('Failed to create tag. Please try again.', 'error');
        }
      }
    }

    /**
     * Destroy the instance and clean up event listeners
     */
    destroy() {
      // Close dropdown
      this._toggleDropdown(false);

      // Remove all event listeners
      if (this._handlers.triggerClick) {
        this.trigger.removeEventListener('click', this._handlers.triggerClick);
      }
      if (this._handlers.chipsClick && this.chipsContainer) {
        this.chipsContainer.removeEventListener('click', this._handlers.chipsClick);
      }
      if (this._handlers.filterInput && this.filterInput) {
        this.filterInput.removeEventListener('input', this._handlers.filterInput);
      }
      if (this._handlers.filterClick && this.filterInput) {
        this.filterInput.removeEventListener('click', this._handlers.filterClick);
      }
      if (this._handlers.optionsChange && this.optionsContainer) {
        this.optionsContainer.removeEventListener('change', this._handlers.optionsChange);
      }
      if (this._handlers.createClick && this.createBtn) {
        this.createBtn.removeEventListener('click', this._handlers.createClick);
      }
      if (this._handlers.documentClick) {
        document.removeEventListener('click', this._handlers.documentClick);
      }
      if (this._handlers.containerKeydown) {
        this.container.removeEventListener('keydown', this._handlers.containerKeydown);
      }

      // Clear references
      this._handlers = null;
    }
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  /**
   * Convert string to URL-safe slug
   * @param {string} str - String to slugify
   * @returns {string} Slugified string
   */
  function slugify(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped HTML
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
   * Get CSRF token from body hx-headers or form input
   * @returns {string} CSRF token
   */
  function getCSRFToken() {
    // Try body hx-headers first
    const hxHeaders = document.body?.getAttribute('hx-headers');
    if (hxHeaders) {
      try {
        const headers = JSON.parse(hxHeaders);
        if (headers['X-CSRF-Token']) {
          return headers['X-CSRF-Token'];
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
    // Fallback to form hidden input
    const input = document.querySelector('input[name="csrf_token"]');
    return input?.value || '';
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Initialize a tag select element
   * @param {HTMLElement} container - Container element
   * @returns {TagSelectInstance|null}
   */
  function initTagSelect(container) {
    // Skip if already initialized
    if (instances.has(container)) {
      return instances.get(container);
    }

    const instance = new TagSelectInstance(container);
    instances.set(container, instance);
    return instance;
  }

  /**
   * Cleanup a tag select element
   * @param {HTMLElement} container - Container element
   */
  function cleanupTagSelect(container) {
    if (instances.has(container)) {
      instances.get(container).destroy();
      instances.delete(container);
    }
  }

  /**
   * Initialize all tag selects on page
   */
  function initAll() {
    document.querySelectorAll('[data-tag-select]').forEach(initTagSelect);
  }

  // Auto-init on DOM ready
  if (typeof Utils !== 'undefined' && Utils.onReady) {
    Utils.onReady(initAll);
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // Re-initialize after HTMX swaps
  document.addEventListener('htmx:afterSwap', (e) => {
    if (e.detail?.target?.querySelectorAll) {
      e.detail.target.querySelectorAll('[data-tag-select]').forEach(initTagSelect);
    }
  });

  // Cleanup before HTMX swaps
  document.addEventListener('htmx:beforeSwap', (e) => {
    if (e.detail?.elt?.querySelectorAll) {
      e.detail.elt.querySelectorAll('[data-tag-select]').forEach(cleanupTagSelect);
    }
  });

  // Export for manual initialization
  window.TagSelect = {
    init: initAll,
    initElement: initTagSelect,
    cleanup: cleanupTagSelect,
    instances
  };
})();
