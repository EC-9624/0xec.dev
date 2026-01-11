/**
 * Custom Dropdown Component
 * Lightweight vanilla JS dropdown that matches boxy monospace design
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
      if (!this.el.contains(e.target)) this.close();
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
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    this.isOpen = true;
    this.menu.classList.remove('hidden');
    this.trigger.setAttribute('aria-expanded', 'true');
  }

  close() {
    this.isOpen = false;
    this.menu.classList.add('hidden');
    this.trigger.setAttribute('aria-expanded', 'false');
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
}

// Store dropdown instances for external access
window.dropdowns = new Map();

// Auto-init all dropdowns
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-dropdown]').forEach(el => {
    const dropdown = new Dropdown(el);
    // Store by input id for easy access
    const input = el.querySelector('input[type="hidden"]');
    if (input && input.id) {
      window.dropdowns.set(input.id, dropdown);
    }
  });
});
