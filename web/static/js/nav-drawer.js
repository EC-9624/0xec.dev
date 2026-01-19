/**
 * Nav Drawer - Mobile navigation with scale effect
 * 
 * Features:
 * - Bottom sheet drawer with scale effect on content
 * - Auto-hide bottom bar on scroll down
 * - Close drawer on scroll attempt
 * - Loading indicator during navigation
 */
(function() {
  'use strict';

  // ===== STATE =====
  var isOpen = false;
  var isBarHidden = false;
  var lastScrollY = 0;
  var ticking = false;
  
  // ===== ELEMENTS =====
  var drawer = null;
  var backdrop = null;
  var bottomBar = null;
  var loadingIndicator = null;
  var scrollContainer = null;

  // ===== CONSTANTS =====
  var SCROLL_THRESHOLD = 10;
  var SCROLL_TOP_ZONE = 50;

  // ===== INITIALIZATION =====
  function init() {
    drawer = document.getElementById('nav-drawer');
    backdrop = document.getElementById('nav-drawer-backdrop');
    bottomBar = document.querySelector('.mobile-bottom-bar');
    loadingIndicator = document.getElementById('nav-loading-indicator');
    
    if (!drawer) return;

    // Find scroll container
    scrollContainer = findScrollContainer();

    // Set up event listeners
    setupEventListeners();
  }

  function findScrollContainer() {
    var mainScroll = document.querySelector('.main-content-scroll');
    if (mainScroll && mainScroll.scrollHeight > mainScroll.clientHeight) {
      return mainScroll;
    }
    return window;
  }

  function setupEventListeners() {
    // Close on backdrop click
    if (backdrop) {
      backdrop.addEventListener('click', close);
    }

    // Close on escape key
    document.addEventListener('keydown', handleEscape);

    // Handle nav link clicks (internal links only)
    var navLinks = drawer.querySelectorAll('a[href^="/"]');
    navLinks.forEach(function(link) {
      link.addEventListener('click', handleNavClick);
    });

    // Scroll hide for bottom bar
    if (scrollContainer === window) {
      window.addEventListener('scroll', onScroll, { passive: true });
    } else if (scrollContainer) {
      scrollContainer.addEventListener('scroll', onScroll, { passive: true });
    }
  }

  // ===== DRAWER CONTROLS =====
  function open() {
    if (isOpen || !drawer) return;

    isOpen = true;
    document.body.classList.add('nav-drawer-open');
    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Show bottom bar when drawer opens (if it was hidden)
    showBar();

    // Add scroll listener to close drawer on scroll attempt
    document.addEventListener('wheel', closeOnScroll, { passive: true });
    document.addEventListener('touchmove', closeOnScroll, { passive: true });

    // Focus first nav item for accessibility
    setTimeout(function() {
      var firstLink = drawer.querySelector('a[href]');
      if (firstLink) firstLink.focus();
    }, 200);
  }

  function close() {
    if (!isOpen || !drawer) return;

    isOpen = false;
    document.body.classList.remove('nav-drawer-open');
    drawer.classList.remove('open');
    document.body.style.overflow = '';

    // Remove scroll listeners
    document.removeEventListener('wheel', closeOnScroll);
    document.removeEventListener('touchmove', closeOnScroll);
  }

  function toggle() {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }

  function closeOnScroll() {
    if (isOpen) {
      close();
    }
  }

  // ===== NAVIGATION HANDLING =====
  function handleNavClick(e) {
    // Show loading indicator
    showLoading();
    
    // Close drawer immediately
    close();
    
    // Navigation happens via htmx-boost, view transition handles the animation
  }

  function showLoading() {
    if (loadingIndicator) {
      loadingIndicator.classList.add('active');
    }
  }

  function hideLoading() {
    if (loadingIndicator) {
      loadingIndicator.classList.remove('active');
    }
  }

  // ===== SCROLL HIDE =====
  function onScroll(e) {
    // Don't process scroll if drawer is open
    if (isOpen) return;

    if (!ticking) {
      requestAnimationFrame(function() {
        updateBarVisibility(e);
        ticking = false;
      });
      ticking = true;
    }
  }

  function updateBarVisibility(e) {
    var currentScrollY;
    
    if (e.target === document || e.target === window || !e.target.scrollTop) {
      currentScrollY = window.scrollY || window.pageYOffset;
    } else {
      currentScrollY = e.target.scrollTop;
    }

    var scrollDelta = currentScrollY - lastScrollY;

    // Only act if scroll exceeds threshold
    if (Math.abs(scrollDelta) < SCROLL_THRESHOLD) {
      return;
    }

    // At top of page - always show
    if (currentScrollY < SCROLL_TOP_ZONE) {
      showBar();
    }
    // Scrolling down - hide
    else if (scrollDelta > 0) {
      hideBar();
    }
    // Scrolling up - show
    else {
      showBar();
    }

    lastScrollY = currentScrollY;
  }

  function hideBar() {
    if (!isBarHidden && bottomBar) {
      bottomBar.classList.add('scroll-hidden');
      isBarHidden = true;
    }
  }

  function showBar() {
    if (isBarHidden && bottomBar) {
      bottomBar.classList.remove('scroll-hidden');
      isBarHidden = false;
    }
  }

  // ===== EVENT HANDLERS =====
  function handleEscape(e) {
    if (e.key === 'Escape' && isOpen) {
      close();
    }
  }

  // ===== HTMX INTEGRATION =====
  // Hide loading and re-init after page swap
  document.addEventListener('htmx:afterSettle', function() {
    hideLoading();
    
    if (isOpen) {
      close();
    }
    
    // Reset scroll tracking
    lastScrollY = 0;
    showBar();
    
    // Re-init for new DOM
    init();
  });

  // ===== EXPOSE API =====
  window.navDrawer = {
    open: open,
    close: close,
    toggle: toggle,
    isOpen: function() { return isOpen; }
  };

  // ===== INIT =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
