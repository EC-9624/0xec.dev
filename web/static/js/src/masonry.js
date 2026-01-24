/**
 * SimpleMasonry - Lightweight masonry layout for HTMX
 * Designed for append-only infinite scroll without reflowing existing items
 * Handles lazy-loaded images via ResizeObserver
 */

import { onReady } from './utils.js';

export class SimpleMasonry {
  constructor(container, options = {}) {
    this.container = container;
    this.gap = options.gap || 16;
    // Responsive min column width - smaller on mobile
    this.minColumnWidthDesktop = options.minColumnWidth || 300;
    this.minColumnWidthMobile = options.minColumnWidthMobile || 280;
    this.columnHeights = [];
    this.resizeTimeout = null;
    this.layoutTimeout = null;
    this.itemHeights = new Map(); // Track item heights to detect changes

    this.init();
  }

  // Get responsive min column width based on viewport
  get minColumnWidth() {
    // Use smaller columns on mobile (< 640px)
    if (window.innerWidth < 640) {
      return this.minColumnWidthMobile;
    }
    return this.minColumnWidthDesktop;
  }

  init() {
    this.container.style.position = 'relative';

    // Store bound handler for cleanup
    this._resizeHandler = () => {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => this.layout(), 150);
    };

    // Debounced window resize handler
    window.addEventListener('resize', this._resizeHandler);

    // Use ResizeObserver to detect when items change size (e.g., lazy images load)
    this.resizeObserver = new ResizeObserver((entries) => {
      let needsRelayout = false;

      for (const entry of entries) {
        const item = entry.target;
        const oldHeight = this.itemHeights.get(item) || 0;
        const newHeight = item.offsetHeight;

        // Only relayout if height changed significantly (more than 5px)
        if (Math.abs(newHeight - oldHeight) > 5) {
          needsRelayout = true;
          this.itemHeights.set(item, newHeight);
        }
      }

      if (needsRelayout) {
        // Debounce relayout to batch multiple image loads
        clearTimeout(this.layoutTimeout);
        this.layoutTimeout = setTimeout(() => this.layout(), 100);
      }
    });

    // Mark existing items and start observing
    const items = this.container.querySelectorAll('.masonry-item');
    items.forEach((item) => {
      item.setAttribute('data-laid-out', 'true');
      this.resizeObserver.observe(item);
    });

    this.layout();
  }

  getColumnCount() {
    const containerWidth = this.container.offsetWidth;
    return Math.max(1, Math.floor((containerWidth + this.gap) / (this.minColumnWidth + this.gap)));
  }

  getColumnWidth() {
    const columnCount = this.getColumnCount();
    const containerWidth = this.container.offsetWidth;
    return (containerWidth - (columnCount - 1) * this.gap) / columnCount;
  }

  // Full layout - used on init, resize, and when items change size
  layout() {
    const items = [...this.container.querySelectorAll('.masonry-item')];
    const columnCount = this.getColumnCount();
    const columnWidth = this.getColumnWidth();

    // Reset column heights
    this.columnHeights = Array(columnCount).fill(0);

    items.forEach((item) => {
      this.positionItem(item, columnWidth);
      // Update tracked height
      this.itemHeights.set(item, item.offsetHeight);
    });

    this.updateContainerHeight();
  }

  // Position a single item in the shortest column
  positionItem(item, columnWidth) {
    // Find shortest column
    const minHeight = Math.min(...this.columnHeights);
    const columnIndex = this.columnHeights.indexOf(minHeight);

    // Position item absolutely
    item.style.position = 'absolute';
    item.style.width = `${columnWidth}px`;
    item.style.left = `${columnIndex * (columnWidth + this.gap)}px`;
    item.style.top = `${minHeight}px`;

    // Update column height
    this.columnHeights[columnIndex] += item.offsetHeight + this.gap;
  }

  // Append new items without reflowing existing ones
  append(newItems) {
    const columnWidth = this.getColumnWidth();

    newItems.forEach((item) => {
      item.setAttribute('data-laid-out', 'true');
      this.positionItem(item, columnWidth);
      this.itemHeights.set(item, item.offsetHeight);
      // Start observing new items for size changes
      this.resizeObserver.observe(item);
    });

    this.updateContainerHeight();
  }

  updateContainerHeight() {
    const maxHeight = Math.max(...this.columnHeights, 0);
    this.container.style.height = `${maxHeight}px`;
  }

  // Clean up observers and event listeners
  destroy() {
    this.resizeObserver.disconnect();
    clearTimeout(this.resizeTimeout);
    clearTimeout(this.layoutTimeout);

    // Remove window resize listener
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
  }
}

// Export for use
window.SimpleMasonry = SimpleMasonry;

/**
 * Initialize masonry for a grid element
 */
export function initMasonry() {
  const grid = document.getElementById('bookmark-grid');
  if (!grid) return;

  // If masonry already exists for this grid, destroy it first
  if (window.bookmarkMasonry) {
    // Check if it's the same grid element
    if (window.bookmarkMasonry.container === grid) {
      return; // Already initialized for this grid
    }
    // Different grid (page navigation), destroy old instance
    window.bookmarkMasonry.destroy();
    window.bookmarkMasonry = null;
  }

  // Initialize masonry - ResizeObserver will handle lazy images
  // Responsive column widths: 350px on desktop, 280px on mobile
  window.bookmarkMasonry = new SimpleMasonry(grid, {
    gap: 16,
    minColumnWidth: 350,
    minColumnWidthMobile: 280,
  });
}

/**
 * Auto-initialize masonry for bookmark grid
 */
onReady(function () {
  initMasonry();

  // Handle HTMX appends (OOB swaps to bookmark-grid)
  document.body.addEventListener('htmx:oobAfterSwap', function (e) {
    // Only handle swaps to bookmark grid
    if (e.detail.target.id !== 'bookmark-grid') return;
    if (!window.bookmarkMasonry) return;

    const grid = document.getElementById('bookmark-grid');
    // Find new items (ones without data-laid-out attribute)
    const newItems = [...grid.querySelectorAll('.masonry-item:not([data-laid-out])')];

    if (newItems.length === 0) return;

    // Append new items - ResizeObserver will handle when images load
    window.bookmarkMasonry.append(newItems);
  });

  // Handle HTMX navigation - re-initialize masonry when content is swapped in
  document.body.addEventListener('htmx:afterSettle', function (e) {
    const grid = document.getElementById('bookmark-grid');
    if (!grid) return;

    // Always destroy old instance and reinitialize
    // After HTMX swap, the grid is a new DOM element even if it has the same ID
    if (window.bookmarkMasonry) {
      window.bookmarkMasonry.destroy();
      window.bookmarkMasonry = null;
    }

    initMasonry();
  });
});
