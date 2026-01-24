/**
 * Smart Prefetching - Aggressive prefetch strategy for instant navigation
 *
 * Combines three prefetch strategies:
 * 1. Intersection Observer - prefetch links as they enter viewport (background)
 * 2. Touchstart - prefetch on mobile touch before tap completes
 * 3. Mouseenter - prefetch on desktop hover
 *
 * All methods share a deduplication set to avoid redundant requests.
 */

import { onReady } from './utils.js';

// Track prefetched URLs to avoid duplicates
const prefetched = new Set();

// Track observed links for cleanup
let observer = null;

/**
 * Check if a URL should be prefetched
 */
function shouldPrefetch(url) {
  // Must be a string
  if (typeof url !== 'string') return false;

  // Skip if already prefetched
  if (prefetched.has(url)) return false;

  // Only internal links (start with /)
  if (!url.startsWith('/')) return false;

  // Skip static assets
  if (url.startsWith('/static/')) return false;

  // Skip admin routes
  if (url.startsWith('/admin')) return false;

  // Skip feed/XML files
  if (url.endsWith('.xml')) return false;

  // Skip hash links
  if (url.includes('#')) return false;

  // Skip current page
  if (url === window.location.pathname) return false;

  return true;
}

/**
 * Prefetch a URL using <link rel="prefetch">
 * @param {string} url - The URL to prefetch
 * @param {string} source - The source that triggered the prefetch (viewport, touch, hover)
 */
export function prefetch(url, source) {
  if (!shouldPrefetch(url)) return;

  prefetched.add(url);

  // Use <link rel="prefetch"> for browser-optimized caching
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  link.as = 'document';
  document.head.appendChild(link);
}

/**
 * Get the href from a link element or its parent
 */
function getLinkHref(element) {
  const link = element.closest('a[href]');
  return link ? link.getAttribute('href') : null;
}

/**
 * Initialize Intersection Observer for viewport prefetching
 */
function initViewportPrefetch() {
  // Check for IntersectionObserver support
  if (typeof IntersectionObserver === 'undefined') return;

  // Disconnect existing observer if any
  if (observer) {
    observer.disconnect();
  }

  observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          const href = entry.target.getAttribute('href');
          prefetch(href, 'viewport');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      // Start prefetching when link is 100px from viewport
      rootMargin: '100px',
    }
  );

  // Observe all internal links
  observeLinks();
}

/**
 * Observe all prefetchable links on the page
 */
export function observeLinks() {
  if (!observer) return;

  document.querySelectorAll('a[href^="/"]').forEach(function (link) {
    const href = link.getAttribute('href');
    if (shouldPrefetch(href)) {
      observer.observe(link);
    }
  });
}

/**
 * Initialize touchstart prefetching for mobile
 */
function initTouchPrefetch() {
  document.addEventListener(
    'touchstart',
    function (e) {
      const href = getLinkHref(e.target);
      if (href) {
        prefetch(href, 'touch');
      }
    },
    { passive: true }
  );
}

/**
 * Initialize mouseenter prefetching for desktop
 */
function initHoverPrefetch() {
  document.addEventListener(
    'mouseenter',
    function (e) {
      if (e.target.tagName === 'A') {
        const href = e.target.getAttribute('href');
        prefetch(href, 'hover');
      }
    },
    { capture: true, passive: true }
  );
}

/**
 * Initialize all prefetch strategies
 */
export function init() {
  initViewportPrefetch();
  initTouchPrefetch();
  initHoverPrefetch();
}

// Initialize HTMX listener
function initHTMXListener() {
  document.body.addEventListener('htmx:afterSettle', function () {
    // Small delay to ensure DOM is fully updated
    setTimeout(observeLinks, 100);
  });
}

// Initialize when DOM is ready
onReady(function () {
  init();
  initHTMXListener();
});

// Expose for debugging
window.prefetchDebug = {
  prefetched: prefetched,
  prefetch: prefetch,
  observeLinks: observeLinks,
};
