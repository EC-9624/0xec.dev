/**
 * Scroll Hide - Hide header/nav on scroll down, show on scroll up
 * 
 * This provides a modern mobile experience where UI chrome hides
 * while reading content, but reappears when user scrolls up.
 */
(function() {
  'use strict';

  var SCROLL_THRESHOLD = 10; // Minimum scroll distance to trigger hide/show
  var lastScrollY = 0;
  var ticking = false;
  var header = null;
  var nav = null;

  /**
   * Initialize scroll hide functionality
   */
  function init() {
    header = document.querySelector('.mobile-header');
    nav = document.querySelector('.bottom-nav');

    // Only run on mobile (when these elements are visible)
    if (!header && !nav) return;

    // Find the scrollable container - could be window or a specific element
    var scrollContainer = findScrollContainer();
    
    if (scrollContainer === window) {
      window.addEventListener('scroll', onScroll, { passive: true });
    } else if (scrollContainer) {
      scrollContainer.addEventListener('scroll', onScroll, { passive: true });
    }

    // Reset on page visibility change (e.g., returning to tab)
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible') {
        showUI();
      }
    });
  }

  /**
   * Find the main scrollable container
   */
  function findScrollContainer() {
    // Check for main-content-scroll first (used in three-column layout)
    var mainScroll = document.querySelector('.main-content-scroll');
    if (mainScroll && mainScroll.scrollHeight > mainScroll.clientHeight) {
      return mainScroll;
    }
    
    // Fallback to window
    return window;
  }

  /**
   * Handle scroll event with requestAnimationFrame for performance
   */
  function onScroll(e) {
    if (!ticking) {
      requestAnimationFrame(function() {
        updateUI(e);
        ticking = false;
      });
      ticking = true;
    }
  }

  /**
   * Update UI based on scroll direction
   */
  function updateUI(e) {
    var currentScrollY;
    
    if (e.target === document || e.target === window) {
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
    if (currentScrollY < 50) {
      showUI();
    }
    // Scrolling down - hide
    else if (scrollDelta > 0) {
      hideUI();
    }
    // Scrolling up - show
    else {
      showUI();
    }

    lastScrollY = currentScrollY;
  }

  /**
   * Hide header and nav
   */
  function hideUI() {
    if (header) header.classList.add('scroll-hidden');
    if (nav) nav.classList.add('scroll-hidden');
  }

  /**
   * Show header and nav
   */
  function showUI() {
    if (header) header.classList.remove('scroll-hidden');
    if (nav) nav.classList.remove('scroll-hidden');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-initialize after HTMX swaps (for SPA-like navigation)
  function initHTMXListener() {
    document.body.addEventListener('htmx:afterSettle', function() {
      // Reset scroll position tracking
      lastScrollY = 0;
      showUI();
      
      // Re-find scroll container in case DOM changed
      init();
    });
  }

  // Initialize HTMX listener when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHTMXListener);
  } else {
    initHTMXListener();
  }
})();
