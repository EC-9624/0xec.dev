/**
 * Image Event Handlers using Event Delegation
 * 
 * Replaces inline onload/onerror handlers for CSP compliance.
 * Uses data attributes to identify which images need handling.
 * 
 * Data attributes:
 * - data-loaded-class: Add 'loaded' class to parent on successful load
 * - data-show-fallback: Show next sibling fallback element on error
 */

(function() {
  'use strict';

  // Handle successful image loads
  // Adds 'loaded' class to parent element for CSS transitions
  document.addEventListener('load', function(e) {
    if (e.target.tagName === 'IMG' && e.target.hasAttribute('data-loaded-class')) {
      e.target.parentElement.classList.add('loaded');
    }
  }, true); // Use capture phase to catch all load events

  // Handle image load errors
  // Hides the broken image and shows the fallback element
  document.addEventListener('error', function(e) {
    if (e.target.tagName === 'IMG' && e.target.hasAttribute('data-show-fallback')) {
      e.target.style.display = 'none';
      var fallback = e.target.nextElementSibling;
      if (fallback && fallback.classList.contains('bookmark-card-fallback')) {
        fallback.style.display = 'flex';
      }
    }
  }, true); // Use capture phase to catch all error events

  // Handle change events for filter inputs (used by collection dropdown)
  document.addEventListener('change', function(e) {
    if (e.target.id === 'collection-filter' && window.bookmarksFilter) {
      window.bookmarksFilter.apply();
    }
  });
})();
