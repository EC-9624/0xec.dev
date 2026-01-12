/**
 * Custom Dropdown Component with Portal Pattern
 * Renders dropdown menus in a portal container to escape overflow constraints.
 * Features:
 * - Portal rendering (escapes overflow:hidden)
 * - Close on click outside
 * - Keyboard navigation
 * - HTMX cleanup support
 */
class Dropdown {
  constructor(el) {
    this.el = el;
    this.trigger = el.querySelector('[data-dropdown-trigger]');
    this.menu = el.querySelector('[data-dropdown-menu]');
    this.input = el.querySelector('input[type="hidden"]');
    this.labelEl = el.querySelector('[data-dropdown-label]');
    this.options = el.querySelectorAll('[data-dropdown-option]');
    this.isOpen = false;
    this.portal = document.getElementById('dropdown-portal');

    // Move menu to portal if portal exists
    if (this.portal && this.menu) {
      this.menu.remove();
      this.portal.appendChild(this.menu);
    }

    this.init();
  }

  init() {
    // Toggle on trigger click
    this.trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggle();
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!this.el.contains(e.target) && !this.menu.contains(e.target)) {
        this.close();
      }
    });

    // Handle option selection
    this.options.forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.preventDefault();
        this.select(opt);
      });
    });

    // Keyboard navigation
    this.el.addEventListener('keydown', (e) => this.handleKeydown(e));
    this.menu.addEventListener('keydown', (e) => this.handleKeydown(e));
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    // Close any other open dropdowns first
    window.dropdowns.forEach((dropdown, key) => {
      if (dropdown !== this && dropdown.isOpen) {
        dropdown.close();
      }
    });

    this.isOpen = true;
    this.menu.style.display = 'block';
    this.positionMenu();
    this.trigger.setAttribute('aria-expanded', 'true');

    // Close on scroll (except scrolling within the dropdown menu itself)
    this._scrollHandler = (e) => {
      // Don't close if scrolling inside the dropdown menu
      if (this.menu.contains(e.target)) return;
      this.close();
    };
    window.addEventListener('scroll', this._scrollHandler, true);
  }

  close() {
    this.isOpen = false;
    this.menu.style.display = 'none';
    this.trigger.setAttribute('aria-expanded', 'false');

    // Remove scroll listener
    if (this._scrollHandler) {
      window.removeEventListener('scroll', this._scrollHandler, true);
      this._scrollHandler = null;
    }
  }

  positionMenu() {
    const triggerRect = this.trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - triggerRect.bottom - 4; // 4px margin from viewport edge
    const spaceAbove = triggerRect.top - 4; // 4px margin from viewport top
    const defaultMaxHeight = 240;

    // Set width
    this.menu.style.width = `${triggerRect.width}px`;
    this.menu.style.left = `${triggerRect.left}px`;

    // Decide direction: open upward if not enough space below but more space above
    if (spaceBelow < defaultMaxHeight && spaceAbove > spaceBelow) {
      // Open upward
      const maxHeight = Math.min(defaultMaxHeight, spaceAbove);
      this.menu.style.maxHeight = `${maxHeight}px`;
      this.menu.style.top = `${triggerRect.top - Math.min(this.menu.scrollHeight, maxHeight) - 2}px`;
    } else {
      // Open downward (default)
      const maxHeight = Math.min(defaultMaxHeight, spaceBelow);
      this.menu.style.maxHeight = `${maxHeight}px`;
      this.menu.style.top = `${triggerRect.bottom + 2}px`;
    }
  }

  select(opt) {
    const value = opt.dataset.value;
    const label = opt.textContent.trim();

    // Update trigger label
    this.labelEl.textContent = label;

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

  // Reset dropdown to a specific value (used by clearFilters)
  reset(value = '') {
    const opt = [...this.options].find(o => o.dataset.value === value);
    if (opt) {
      this.labelEl.textContent = opt.textContent.trim();
      this.options.forEach(o => o.removeAttribute('data-selected'));
      opt.setAttribute('data-selected', 'true');
      if (this.input) {
        this.input.value = value;
      }
    }
  }

  handleKeydown(e) {
    if (e.key === 'Escape') {
      this.close();
      this.trigger.focus();
    }
    if (e.key === 'Enter' && !this.isOpen) {
      e.preventDefault();
      this.open();
    }
    // Arrow key navigation
    if (this.isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      const items = [...this.options];
      const current = items.findIndex(o => o.getAttribute('data-selected') === 'true');
      let next;
      if (e.key === 'ArrowDown') {
        next = current < items.length - 1 ? current + 1 : 0;
      } else {
        next = current > 0 ? current - 1 : items.length - 1;
      }
      items[next].focus();
    }
  }

  // Cleanup method for HTMX integration
  destroy() {
    this.close();
    // Remove menu from portal
    if (this.menu && this.menu.parentNode === this.portal) {
      this.menu.remove();
    }
  }
}

// Store dropdown instances for external access
window.dropdowns = new Map();

// Initialize a single dropdown element
function initDropdown(el) {
  // Skip if already initialized
  const input = el.querySelector('input[type="hidden"]');
  if (input && input.id && window.dropdowns.has(input.id)) {
    return window.dropdowns.get(input.id);
  }

  const dropdown = new Dropdown(el);
  if (input && input.id) {
    window.dropdowns.set(input.id, dropdown);
  }
  return dropdown;
}

// Auto-init all dropdowns on page load
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-dropdown]').forEach(initDropdown);
});

// Re-initialize dropdowns after HTMX settles new content
document.addEventListener('htmx:afterSettle', (e) => {
  const target = e.detail.elt;
  if (!target) return;
  
  // Check if the settled element itself is a dropdown
  if (target.matches && target.matches('[data-dropdown]')) {
    initDropdown(target);
  }
  // Also check for dropdowns inside the settled content
  if (target.querySelectorAll) {
    target.querySelectorAll('[data-dropdown]').forEach(initDropdown);
  }
});

// Clean up dropdowns before HTMX swaps content (prevents orphan menus in portal)
document.addEventListener('htmx:beforeSwap', (e) => {
  const target = e.detail.elt;
  if (!target || !target.querySelectorAll) return;
  
  // Find dropdowns being removed and destroy them
  target.querySelectorAll('[data-dropdown]').forEach(el => {
    const input = el.querySelector('input[type="hidden"]');
    if (input && input.id && window.dropdowns.has(input.id)) {
      window.dropdowns.get(input.id).destroy();
      window.dropdowns.delete(input.id);
    }
  });
});
