/**
 * Expandable Row Module
 * Reusable expand/collapse functionality for table rows with lazy-loaded content.
 * Used by Tags and Collections admin pages for treeview patterns.
 * 
 * @module ExpandableRow
 * 
 * Usage:
 * 1. Add data attributes to your rows:
 *    - data-expandable-id="<id>" on the main row
 *    - data-expandable-type="<type>" (e.g., "tag" or "collection")
 *    - role="button" for expandable rows
 * 
 * 2. Add content container with:
 *    - id="<type>-content-<id>" 
 *    - hx-get="<endpoint>"
 *    - hx-trigger="fetchContent"
 * 
 * 3. Add hidden details row with:
 *    - id="<type>-details-<id>"
 *    - class="hidden"
 * 
 * 4. Add expand button with:
 *    - class="expand-btn" inside the main row
 */

(function() {
  'use strict';

  /**
   * Configuration constants
   */
  const CONFIG = {
    /** CSS class for expand button */
    EXPAND_BTN_CLASS: 'expand-btn',
    /** CSS class for rotation animation */
    ROTATE_CLASS: 'rotate-90',
    /** CSS class to hide elements */
    HIDDEN_CLASS: 'hidden',
    /** Data attribute for expanded state */
    EXPANDED_ATTR: 'data-expanded',
    /** Data attribute for expandable ID */
    ID_ATTR: 'data-expandable-id',
    /** Data attribute for expandable type */
    TYPE_ATTR: 'data-expandable-type',
    /** Data attribute to mark content as loaded */
    LOADED_ATTR: 'data-loaded',
    /** HTMX trigger event name for lazy loading */
    FETCH_TRIGGER: 'fetchContent'
  };

  /**
   * Track initialized rows to prevent duplicate setup
   * @type {Set<string>}
   */
  const initializedRows = new Set();

  /**
   * Prefetch content for a row (only once)
   * @param {string} type - The type of expandable (e.g., "tag", "collection")
   * @param {string} id - The unique ID of the row
   */
  function prefetchRow(type, id) {
    const contentDiv = document.getElementById(`${type}-content-${id}`);
    if (contentDiv && !contentDiv.hasAttribute(CONFIG.LOADED_ATTR)) {
      contentDiv.setAttribute(CONFIG.LOADED_ATTR, 'true');
      if (typeof htmx !== 'undefined') {
        htmx.trigger(contentDiv, CONFIG.FETCH_TRIGGER);
      }
    }
  }

  /**
   * Toggle expand/collapse for a row
   * @param {string} type - The type of expandable (e.g., "tag", "collection")
   * @param {string} id - The unique ID of the row
   */
  function toggleRow(type, id) {
    const row = document.querySelector(`[${CONFIG.ID_ATTR}="${id}"][${CONFIG.TYPE_ATTR}="${type}"]`);
    const detailsRow = document.getElementById(`${type}-details-${id}`);
    
    if (!row || !detailsRow) {
      console.warn(`[ExpandableRow] Missing elements for ${type}-${id}`);
      return;
    }
    
    const expandBtn = row.querySelector(`.${CONFIG.EXPAND_BTN_CLASS}`);
    const isExpanded = row.getAttribute(CONFIG.EXPANDED_ATTR) === 'true';
    
    if (isExpanded) {
      // Collapse
      row.setAttribute(CONFIG.EXPANDED_ATTR, 'false');
      row.setAttribute('aria-expanded', 'false');
      detailsRow.classList.add(CONFIG.HIDDEN_CLASS);
      if (expandBtn) {
        expandBtn.classList.remove(CONFIG.ROTATE_CLASS);
      }
    } else {
      // Expand - trigger fetch if not already loaded
      prefetchRow(type, id);
      row.setAttribute(CONFIG.EXPANDED_ATTR, 'true');
      row.setAttribute('aria-expanded', 'true');
      detailsRow.classList.remove(CONFIG.HIDDEN_CLASS);
      if (expandBtn) {
        expandBtn.classList.add(CONFIG.ROTATE_CLASS);
      }
    }
  }

  /**
   * Handle keyboard events for expandable rows
   * @param {KeyboardEvent} event - The keyboard event
   * @param {string} type - The type of expandable
   * @param {string} id - The unique ID
   */
  function handleKeydown(event, type, id) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleRow(type, id);
    }
  }

  /**
   * Setup prefetch on hover/focus for a row
   * @param {HTMLElement} row - The row element
   * @param {string} type - The type of expandable
   * @param {string} id - The unique ID
   */
  function setupPrefetch(row, type, id) {
    const key = `${type}-${id}`;
    if (initializedRows.has(key)) return;
    
    // Only add listeners if row is expandable
    if (row.getAttribute('role') === 'button') {
      row.addEventListener('mouseenter', function() {
        prefetchRow(type, id);
      }, { once: true });
      
      row.addEventListener('focus', function() {
        prefetchRow(type, id);
      }, { once: true });
      
      initializedRows.add(key);
    }
  }

  /**
   * Initialize all expandable rows of a given type
   * @param {string} type - The type of expandable (e.g., "tag", "collection")
   */
  function initType(type) {
    const rows = document.querySelectorAll(`[${CONFIG.TYPE_ATTR}="${type}"]`);
    rows.forEach(row => {
      const id = row.getAttribute(CONFIG.ID_ATTR);
      if (id) {
        setupPrefetch(row, type, id);
      }
    });
  }

  /**
   * Initialize all expandable rows on the page
   */
  function init() {
    // Find all types currently on the page
    const rows = document.querySelectorAll(`[${CONFIG.TYPE_ATTR}]`);
    const types = new Set();
    
    rows.forEach(row => {
      const type = row.getAttribute(CONFIG.TYPE_ATTR);
      if (type) types.add(type);
    });
    
    types.forEach(type => initType(type));
  }

  // Initialize on DOM ready
  if (typeof Utils !== 'undefined') {
    Utils.onReady(init);
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-initialize after HTMX swaps (for dynamic content)
  document.addEventListener('htmx:afterSettle', function(e) {
    if (e.detail?.elt) {
      const rows = e.detail.elt.querySelectorAll?.(`[${CONFIG.TYPE_ATTR}]`) || [];
      rows.forEach(row => {
        const type = row.getAttribute(CONFIG.TYPE_ATTR);
        const id = row.getAttribute(CONFIG.ID_ATTR);
        if (type && id) {
          setupPrefetch(row, type, id);
        }
      });
    }
  });

  // Export to window for use by templ onclick handlers
  window.ExpandableRow = {
    toggle: toggleRow,
    prefetch: prefetchRow,
    handleKeydown: handleKeydown,
    init: init,
    initType: initType
  };
})();
