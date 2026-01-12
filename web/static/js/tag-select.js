/**
 * Tag Select Component
 * Multi-select dropdown with filtering and inline tag creation
 */

(function() {
  'use strict';

  /**
   * Initialize a tag select component
   * @param {HTMLElement} container - The tag-select container element
   */
  function initTagSelect(container) {
    const trigger = container.querySelector('[data-tag-trigger]');
    const dropdown = container.querySelector('[data-tag-dropdown]');
    const filterInput = container.querySelector('[data-tag-filter]');
    const optionsContainer = container.querySelector('[data-tag-options]');
    const chipsContainer = container.querySelector('[data-tag-chips]');
    const placeholder = container.querySelector('[data-tag-placeholder]');
    const createSection = container.querySelector('[data-tag-create]');
    const createBtn = container.querySelector('[data-create-tag-btn]');
    const createNameSpan = container.querySelector('[data-create-tag-name]');
    const fieldName = container.dataset.fieldName || 'tag_ids';

    if (!trigger || !dropdown) return;

    let isOpen = false;

    // Toggle dropdown
    function toggleDropdown(open) {
      isOpen = open !== undefined ? open : !isOpen;
      dropdown.classList.toggle('hidden', !isOpen);
      if (isOpen && filterInput) {
        filterInput.focus();
        filterInput.value = '';
        filterOptions('');
      }
    }

    // Filter options based on input
    function filterOptions(query) {
      const normalizedQuery = query.toLowerCase().trim();
      const options = optionsContainer.querySelectorAll('[data-tag-option]');
      let hasExactMatch = false;
      let visibleCount = 0;

      options.forEach(option => {
        const name = option.dataset.tagName.toLowerCase();
        const matches = normalizedQuery === '' || name.includes(normalizedQuery);
        option.hidden = !matches;
        if (matches) visibleCount++;
        if (name === normalizedQuery) hasExactMatch = true;
      });

      // Show/hide create option
      if (createSection && createNameSpan) {
        if (normalizedQuery && !hasExactMatch) {
          createSection.classList.remove('hidden');
          createNameSpan.textContent = query.trim();
        } else {
          createSection.classList.add('hidden');
        }
      }
    }

    // Update chips display
    function updateChips() {
      const checkboxes = optionsContainer.querySelectorAll('input[type="checkbox"]:checked');
      chipsContainer.innerHTML = '';
      
      checkboxes.forEach(cb => {
        const option = cb.closest('[data-tag-option]');
        const name = option.dataset.tagName;
        const id = cb.dataset.tagId;
        
        const chip = document.createElement('span');
        chip.className = 'tag-chip';
        chip.dataset.tagId = id;
        chip.innerHTML = `
          ${escapeHtml(name)}
          <button type="button" class="tag-chip-remove" data-remove-tag="${id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18"></path>
              <path d="m6 6 12 12"></path>
            </svg>
          </button>
        `;
        chipsContainer.appendChild(chip);
      });

      // Update placeholder visibility
      if (placeholder) {
        placeholder.textContent = checkboxes.length === 0 ? 'Select tags...' : '';
      }
    }

    // Remove a tag by ID
    function removeTag(tagId) {
      const checkbox = optionsContainer.querySelector(`input[data-tag-id="${tagId}"]`);
      if (checkbox) {
        checkbox.checked = false;
        updateChips();
      }
    }

    // Create a new tag via HTMX
    async function createTag(name) {
      const slug = slugify(name);
      
      try {
        const response = await fetch('/admin/tags/create-inline', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRF-Token': getCSRFToken()
          },
          body: `name=${encodeURIComponent(name)}&slug=${encodeURIComponent(slug)}`
        });

        if (!response.ok) {
          throw new Error('Failed to create tag');
        }

        const tag = await response.json();
        
        // Add new option to the list
        const newOption = document.createElement('label');
        newOption.className = 'tag-select-option';
        newOption.dataset.tagOption = '';
        newOption.dataset.tagName = tag.name;
        newOption.innerHTML = `
          <input type="checkbox" name="${fieldName}" value="${tag.id}" 
                 data-tag-checkbox data-tag-id="${tag.id}" checked />
          <span>${escapeHtml(tag.name)}</span>
        `;
        optionsContainer.appendChild(newOption);
        
        // Update chips
        updateChips();
        
        // Clear filter and hide create
        if (filterInput) filterInput.value = '';
        if (createSection) createSection.classList.add('hidden');
        
        filterOptions('');
      } catch (error) {
        console.error('Failed to create tag:', error);
        alert('Failed to create tag. Please try again.');
      }
    }

    // Event: Trigger click
    trigger.addEventListener('click', (e) => {
      if (e.target.closest('[data-remove-tag]')) return;
      toggleDropdown();
    });

    // Event: Remove tag via chip button
    chipsContainer.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('[data-remove-tag]');
      if (removeBtn) {
        e.stopPropagation();
        removeTag(removeBtn.dataset.removeTag);
      }
    });

    // Event: Filter input
    if (filterInput) {
      filterInput.addEventListener('input', (e) => {
        filterOptions(e.target.value);
      });

      // Prevent dropdown close when clicking in filter
      filterInput.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Event: Checkbox change
    optionsContainer.addEventListener('change', (e) => {
      if (e.target.matches('input[type="checkbox"]')) {
        updateChips();
      }
    });

    // Event: Create tag button
    if (createBtn) {
      createBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = createNameSpan.textContent.trim();
        if (name) {
          createTag(name);
        }
      });
    }

    // Event: Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (isOpen && !container.contains(e.target)) {
        toggleDropdown(false);
      }
    });

    // Event: Keyboard navigation
    container.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) {
        toggleDropdown(false);
        trigger.focus();
      }
      if (e.key === 'Enter' && filterInput === document.activeElement) {
        e.preventDefault();
        // If create option is visible, create the tag
        if (createSection && !createSection.classList.contains('hidden')) {
          const name = createNameSpan.textContent.trim();
          if (name) createTag(name);
        }
      }
    });
  }

  // Utility: Slugify a string
  function slugify(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Utility: Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Utility: Get CSRF token from body hx-headers or meta tag
  function getCSRFToken() {
    // Try body hx-headers first
    const body = document.body;
    const hxHeaders = body.getAttribute('hx-headers');
    if (hxHeaders) {
      try {
        const headers = JSON.parse(hxHeaders);
        if (headers['X-CSRF-Token']) {
          return headers['X-CSRF-Token'];
        }
      } catch (e) {}
    }
    // Fallback to form hidden input
    const input = document.querySelector('input[name="csrf_token"]');
    return input ? input.value : '';
  }

  // Initialize all tag selects on page load
  function initAll() {
    document.querySelectorAll('[data-tag-select]').forEach(initTagSelect);
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // Re-initialize after HTMX swaps
  document.addEventListener('htmx:afterSwap', (e) => {
    if (e.detail && e.detail.target && e.detail.target.querySelectorAll) {
      e.detail.target.querySelectorAll('[data-tag-select]').forEach(initTagSelect);
    }
  });

  // Export for manual initialization
  window.TagSelect = {
    init: initAll,
    initElement: initTagSelect
  };
})();
