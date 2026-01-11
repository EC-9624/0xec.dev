/**
 * SimpleMasonry - Lightweight masonry layout for HTMX
 * Designed for append-only infinite scroll without reflowing existing items
 * Handles lazy-loaded images via ResizeObserver
 */
class SimpleMasonry {
  constructor(container, options = {}) {
    this.container = container;
    this.gap = options.gap || 16;
    this.minColumnWidth = options.minColumnWidth || 300;
    this.columnHeights = [];
    this.resizeTimeout = null;
    this.layoutTimeout = null;
    this.itemHeights = new Map(); // Track item heights to detect changes

    this.init();
  }

  init() {
    this.container.style.position = 'relative';

    // Debounced window resize handler
    window.addEventListener('resize', () => {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => this.layout(), 150);
    });

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
    items.forEach(item => {
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

    items.forEach(item => {
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

    newItems.forEach(item => {
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

  // Clean up observers
  destroy() {
    this.resizeObserver.disconnect();
    clearTimeout(this.resizeTimeout);
    clearTimeout(this.layoutTimeout);
  }
}

// Export for use
window.SimpleMasonry = SimpleMasonry;

/**
 * Auto-initialize masonry for bookmark grid
 */
document.addEventListener('DOMContentLoaded', function() {
  const grid = document.getElementById('bookmark-grid');
  if (!grid) return;

  // Initialize masonry immediately - ResizeObserver will handle lazy images
  window.bookmarkMasonry = new SimpleMasonry(grid, {
    gap: 16,
    minColumnWidth: 350
  });

  // Handle HTMX appends (OOB swaps to bookmark-grid)
  document.body.addEventListener('htmx:oobAfterSwap', function(e) {
    // Only handle swaps to bookmark grid
    if (e.detail.target.id !== 'bookmark-grid') return;
    if (!window.bookmarkMasonry) return;

    // Find new items (ones without data-laid-out attribute)
    const newItems = [...grid.querySelectorAll('.masonry-item:not([data-laid-out])')];

    if (newItems.length === 0) return;

    // Append new items - ResizeObserver will handle when images load
    window.bookmarkMasonry.append(newItems);
  });
});
