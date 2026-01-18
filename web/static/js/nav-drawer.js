/**
 * Nav Drawer - Mobile navigation with scale effect
 * 
 * Opens a bottom sheet drawer while scaling down the main content
 * for a modern "app behind glass" effect.
 */
(function() {
  'use strict';

  var isOpen = false;
  var drawer = null;
  var backdrop = null;

  /**
   * Initialize nav drawer
   */
  function init() {
    drawer = document.getElementById('nav-drawer');
    backdrop = document.getElementById('nav-drawer-backdrop');

    if (!drawer) return;

    // Close on backdrop click
    if (backdrop) {
      backdrop.addEventListener('click', close);
    }

    // Close on escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    });

    // Handle nav link clicks - close drawer and navigate
    var navLinks = drawer.querySelectorAll('a[href]');
    navLinks.forEach(function(link) {
      link.addEventListener('click', function() {
        // Close immediately, navigation will happen naturally
        close();
      });
    });
  }

  /**
   * Open the nav drawer
   */
  function open() {
    if (isOpen || !drawer) return;

    isOpen = true;
    document.body.classList.add('nav-drawer-open');
    drawer.classList.add('open');

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Focus first nav item for accessibility
    var firstLink = drawer.querySelector('a[href]');
    if (firstLink) {
      setTimeout(function() {
        firstLink.focus();
      }, 200);
    }
  }

  /**
   * Close the nav drawer
   */
  function close() {
    if (!isOpen || !drawer) return;

    isOpen = false;
    document.body.classList.remove('nav-drawer-open');
    drawer.classList.remove('open');

    // Restore body scroll
    document.body.style.overflow = '';
  }

  /**
   * Toggle the nav drawer
   */
  function toggle() {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }

  /**
   * Check if drawer is open
   */
  function isDrawerOpen() {
    return isOpen;
  }

  // Expose globally
  window.navDrawer = {
    open: open,
    close: close,
    toggle: toggle,
    isOpen: isDrawerOpen
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-initialize after HTMX swaps
  document.addEventListener('htmx:afterSettle', function() {
    // Close drawer on navigation
    if (isOpen) {
      close();
    }
    // Re-init in case DOM changed
    init();
  });
})();
