/**
 * TableFilter - Reusable client-side table filtering
 *
 * Usage:
 *   const filter = new TableFilter({
 *     tableBodyId: 'bookmarks-tbody',
 *     searchId: 'bookmark-search',
 *     filters: [
 *       { id: 'status-filter', dataAttr: 'isPublic', match: (value, filterValue) => ... },
 *       { id: 'collection-filter', dataAttr: 'collectionId' }
 *     ],
 *     searchFields: ['title', 'url', 'domain'],
 *     storageKey: 'bookmarkFilters',
 *     tableCardSelector: '.card:has(#bookmarks-table)'
 *   });
 */
export class TableFilter {
  /**
   * @param {Object} options
   * @param {string} options.tableBodyId - ID of the table tbody element
   * @param {string} options.searchId - ID of the search input
   * @param {Array<Object>} options.filters - Array of filter configurations
   * @param {Array<string>} options.searchFields - Data attributes to search in
   * @param {string} options.storageKey - Session storage key for persistence
   * @param {string} options.tableCardSelector - CSS selector for table container (for hide/show)
   */
  constructor(options) {
    this.tableBodyId = options.tableBodyId;
    this.searchId = options.searchId;
    this.filters = options.filters || [];
    this.searchFields = options.searchFields || [];
    this.storageKey = options.storageKey;
    this.tableCardSelector = options.tableCardSelector;

    this._initialized = false;
  }

  /**
   * Initialize the filter - call after DOM is ready
   */
  init() {
    if (this._initialized) return;
    this._initialized = true;

    // Restore saved filters
    this.restore();

    // Set up search input listener
    const searchInput = document.getElementById(this.searchId);
    if (searchInput) {
      searchInput.addEventListener('input', () => this.apply());
    }

    // Set up filter dropdowns - listen for changes on hidden inputs
    this.filters.forEach((filter) => {
      const input = document.getElementById(filter.id);
      if (input) {
        input.addEventListener('change', () => this.apply());
      }
    });

    // Initial filter application
    this.apply();
  }

  /**
   * Apply all filters to the table
   * @returns {number} Count of visible rows
   */
  apply() {
    const searchValue = document.getElementById(this.searchId)?.value.toLowerCase() || '';
    const rows = document.querySelectorAll(`#${this.tableBodyId} tr`);
    let visibleCount = 0;

    // Get current filter values
    const filterValues = {};
    this.filters.forEach((filter) => {
      filterValues[filter.id] = document.getElementById(filter.id)?.value || '';
    });

    rows.forEach((row) => {
      let visible = true;

      // Search filter
      if (searchValue) {
        const searchMatch = this.searchFields.some((field) => {
          const value = row.dataset[field]?.toLowerCase() || '';
          return value.includes(searchValue);
        });
        if (!searchMatch) visible = false;
      }

      // Apply each filter
      if (visible) {
        this.filters.forEach((filter) => {
          const filterValue = filterValues[filter.id];
          if (!filterValue) return; // Empty filter = no filtering

          if (filter.match) {
            // Custom match function
            if (!filter.match(row, filterValue)) {
              visible = false;
            }
          } else {
            // Default: exact match on data attribute
            const dataValue = row.dataset[filter.dataAttr] || '';
            if (dataValue !== filterValue) {
              visible = false;
            }
          }
        });
      }

      row.style.display = visible ? '' : 'none';
      if (visible) visibleCount++;
    });

    // Show/hide no results message and table
    this._updateVisibility(visibleCount, rows.length);

    // Save state
    this.save();

    return visibleCount;
  }

  /**
   * Clear all filters
   */
  clear() {
    // Clear search
    const searchInput = document.getElementById(this.searchId);
    if (searchInput) searchInput.value = '';

    // Reset dropdowns
    if (window.dropdowns) {
      this.filters.forEach((filter) => {
        const dropdown = window.dropdowns.get(filter.id);
        if (dropdown) dropdown.reset('');
      });
    }

    // Clear storage
    if (this.storageKey) {
      sessionStorage.removeItem(this.storageKey);
    }

    // Re-apply (will show all)
    this.apply();
  }

  /**
   * Save current filter state to session storage
   */
  save() {
    if (!this.storageKey) return;

    const state = {
      search: document.getElementById(this.searchId)?.value || '',
    };

    this.filters.forEach((filter) => {
      state[filter.id] = document.getElementById(filter.id)?.value || '';
    });

    sessionStorage.setItem(this.storageKey, JSON.stringify(state));
  }

  /**
   * Restore filter state from session storage
   */
  restore() {
    if (!this.storageKey) return;

    const saved = sessionStorage.getItem(this.storageKey);
    if (!saved) return;

    try {
      const state = JSON.parse(saved);

      // Restore search
      const searchInput = document.getElementById(this.searchId);
      if (searchInput && state.search) {
        searchInput.value = state.search;
      }

      // Restore dropdowns - need to wait for dropdown.js to initialize
      setTimeout(() => {
        if (window.dropdowns) {
          this.filters.forEach((filter) => {
            const value = state[filter.id];
            if (value) {
              const dropdown = window.dropdowns.get(filter.id);
              if (dropdown) dropdown.reset(value);
            }
          });
        }
        this.apply();
      }, 10);
    } catch (e) {
      console.warn('Failed to restore filter state:', e);
    }
  }

  /**
   * Update visibility of table and no-results message
   * @private
   */
  _updateVisibility(visibleCount, totalCount) {
    const noResults = document.getElementById('no-results');
    const table = this.tableCardSelector ? document.querySelector(this.tableCardSelector) : null;

    if (visibleCount === 0 && totalCount > 0) {
      noResults?.classList.remove('hidden');
      table?.classList.add('hidden');
    } else {
      noResults?.classList.add('hidden');
      table?.classList.remove('hidden');
    }
  }
}

// ============================================
// COMMON FILTER MATCHERS
// ============================================

/**
 * Matcher for boolean data attributes
 * @param {string} dataAttr - The data attribute name (e.g., 'isPublic')
 * @param {Object} valueMap - Maps filter values to expected boolean strings
 */
TableFilter.booleanMatcher = function (dataAttr, valueMap) {
  return function (row, filterValue) {
    const dataValue = row.dataset[dataAttr];
    if (valueMap && valueMap[filterValue] !== undefined) {
      return dataValue === String(valueMap[filterValue]);
    }
    return dataValue === filterValue;
  };
};

/**
 * Matcher for public/private status
 * Expects data-is-public="true" or "false"
 */
TableFilter.publicPrivateMatcher = function (row, filterValue) {
  const isPublic = row.dataset.isPublic === 'true';
  if (filterValue === 'public') return isPublic;
  if (filterValue === 'private') return !isPublic;
  return true;
};

/**
 * Matcher for draft/published status
 * Expects data-is-draft="true" or "false"
 */
TableFilter.draftPublishedMatcher = function (row, filterValue) {
  const isDraft = row.dataset.isDraft === 'true';
  if (filterValue === 'published') return !isDraft;
  if (filterValue === 'draft') return isDraft;
  return true;
};

/**
 * Matcher for bookmark status (public/private/favorite)
 */
TableFilter.bookmarkStatusMatcher = function (row, filterValue) {
  const isPublic = row.dataset.isPublic === 'true';
  const isFavorite = row.dataset.isFavorite === 'true';

  if (filterValue === 'public') return isPublic;
  if (filterValue === 'private') return !isPublic;
  if (filterValue === 'favorite') return isFavorite;
  return true;
};

/**
 * Matcher for collection filter with "none" support
 * Expects data-collection-id="" for unsorted, or a numeric ID
 */
TableFilter.collectionMatcher = function (row, filterValue) {
  const collectionId = row.dataset.collectionId || '';

  if (filterValue === 'none') return collectionId === '';
  return collectionId === filterValue;
};

// Export for use
window.TableFilter = TableFilter;
