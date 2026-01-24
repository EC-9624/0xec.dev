(() => {
  // web/static/js/src/utils.js
  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
    } else {
      callback();
    }
  }
  function onClickOutside(elements, callback) {
    const handler = (e) => {
      const isOutside = elements.every((el) => !el?.contains(e.target));
      if (isOutside) callback(e);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }
  function initOnHtmx(selector, initFn, options = {}) {
    const event = options.event || "htmx:afterSettle";
    document.addEventListener(event, (e) => {
      const target = e.detail?.elt;
      if (!target) return;
      if (target.matches?.(selector)) {
        initFn(target);
      }
      if (target.querySelectorAll) {
        target.querySelectorAll(selector).forEach(initFn);
      }
    });
  }
  function cleanupOnHtmx(selector, cleanupFn) {
    document.addEventListener("htmx:beforeSwap", (e) => {
      const target = e.detail?.elt;
      if (!target?.querySelectorAll) return;
      target.querySelectorAll(selector).forEach(cleanupFn);
    });
  }
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
  function debounce(fn, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  }
  function uniqueId(prefix = "uid") {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  window.Utils = {
    onReady,
    onClickOutside,
    initOnHtmx,
    cleanupOnHtmx,
    escapeHtml,
    debounce,
    uniqueId
  };

  // web/static/js/src/validation.js
  var URL_PATTERN = /^https?:\/\/.+/i;
  function validateField(input) {
    const value = input.value.trim();
    const type = input.type;
    if (input.hasAttribute("required") && value === "") {
      return input.dataset.errorRequired || "This field is required";
    }
    if (value === "") {
      return null;
    }
    if (input.hasAttribute("maxlength")) {
      const maxLen = parseInt(input.getAttribute("maxlength"), 10);
      if (value.length > maxLen) {
        return input.dataset.errorMaxlength || `Cannot exceed ${maxLen} characters`;
      }
    }
    if (input.hasAttribute("pattern")) {
      const pattern = new RegExp("^" + input.getAttribute("pattern") + "$");
      if (!pattern.test(value)) {
        return input.dataset.errorPattern || "Invalid format";
      }
    }
    if (type === "url" && value !== "") {
      if (!URL_PATTERN.test(value)) {
        return input.dataset.errorUrl || "Must be a valid URL";
      }
    }
    return null;
  }
  function showError(input, message) {
    input.classList.add("input-error");
    input.classList.remove("input-valid");
    let errorEl = input.parentElement.querySelector(".field-error");
    if (!errorEl) {
      errorEl = document.createElement("p");
      errorEl.className = "field-error";
      input.parentElement.appendChild(errorEl);
    }
    errorEl.textContent = message;
    errorEl.style.display = "block";
  }
  function clearError(input, showValid = false) {
    input.classList.remove("input-error");
    if (showValid && input.value.trim() !== "") {
      input.classList.add("input-valid");
    } else {
      input.classList.remove("input-valid");
    }
    const errorEl = input.parentElement.querySelector(".field-error");
    if (errorEl) {
      errorEl.style.display = "none";
    }
  }
  function validateForm(form) {
    let isValid = true;
    const inputs = form.querySelectorAll("input, textarea, select");
    inputs.forEach((input) => {
      if (input.type === "hidden" || input.type === "submit" || input.type === "button") {
        return;
      }
      const error = validateField(input);
      if (error) {
        showError(input, error);
        isValid = false;
      } else {
        clearError(input);
      }
    });
    if (!isValid) {
      const firstError = form.querySelector(".input-error");
      if (firstError) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        firstError.focus();
      }
    }
    return isValid;
  }
  function initForm(form) {
    form.addEventListener(
      "blur",
      function(e) {
        const input = e.target;
        if (input.tagName === "INPUT" || input.tagName === "TEXTAREA") {
          const error = validateField(input);
          if (error) {
            showError(input, error);
          } else {
            clearError(input, true);
          }
        }
      },
      true
    );
    form.addEventListener(
      "input",
      function(e) {
        const input = e.target;
        if (input.classList.contains("input-error")) {
          const error = validateField(input);
          if (!error) {
            clearError(input, true);
          }
        }
      },
      true
    );
    form.addEventListener("submit", function(e) {
      if (!validateForm(form)) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }
  function init() {
    const forms = document.querySelectorAll("form[data-validate]");
    forms.forEach(initForm);
  }
  onReady(init);
  document.addEventListener("htmx:afterSwap", function(e) {
    if (e.detail && e.detail.target) {
      const forms = e.detail.target.querySelectorAll("form[data-validate]");
      forms.forEach(initForm);
    }
  });
  window.FormValidation = {
    init,
    initForm,
    validateForm,
    validateField
  };

  // web/static/js/src/prefetch.js
  var prefetched = /* @__PURE__ */ new Set();
  var observer = null;
  function shouldPrefetch(url) {
    if (typeof url !== "string") return false;
    if (prefetched.has(url)) return false;
    if (!url.startsWith("/")) return false;
    if (url.startsWith("/static/")) return false;
    if (url.startsWith("/admin")) return false;
    if (url.endsWith(".xml")) return false;
    if (url.includes("#")) return false;
    if (url === window.location.pathname) return false;
    return true;
  }
  function prefetch(url, source) {
    if (!shouldPrefetch(url)) return;
    prefetched.add(url);
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = url;
    link.as = "document";
    document.head.appendChild(link);
  }
  function getLinkHref(element) {
    const link = element.closest("a[href]");
    return link ? link.getAttribute("href") : null;
  }
  function initViewportPrefetch() {
    if (typeof IntersectionObserver === "undefined") return;
    if (observer) {
      observer.disconnect();
    }
    observer = new IntersectionObserver(
      function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            const href = entry.target.getAttribute("href");
            prefetch(href, "viewport");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        // Start prefetching when link is 100px from viewport
        rootMargin: "100px"
      }
    );
    observeLinks();
  }
  function observeLinks() {
    if (!observer) return;
    document.querySelectorAll('a[href^="/"]').forEach(function(link) {
      const href = link.getAttribute("href");
      if (shouldPrefetch(href)) {
        observer.observe(link);
      }
    });
  }
  function initTouchPrefetch() {
    document.addEventListener(
      "touchstart",
      function(e) {
        const href = getLinkHref(e.target);
        if (href) {
          prefetch(href, "touch");
        }
      },
      { passive: true }
    );
  }
  function initHoverPrefetch() {
    document.addEventListener(
      "mouseenter",
      function(e) {
        if (e.target.tagName === "A") {
          const href = e.target.getAttribute("href");
          prefetch(href, "hover");
        }
      },
      { capture: true, passive: true }
    );
  }
  function init2() {
    initViewportPrefetch();
    initTouchPrefetch();
    initHoverPrefetch();
  }
  function initHTMXListener() {
    document.body.addEventListener("htmx:afterSettle", function() {
      setTimeout(observeLinks, 100);
    });
  }
  onReady(function() {
    init2();
    initHTMXListener();
  });
  window.prefetchDebug = {
    prefetched,
    prefetch,
    observeLinks
  };

  // web/static/js/src/progress-bar.js
  var bar = null;
  var timeout = null;
  var isRunning = false;
  var currentProgress = 0;
  var CONFIG = {
    minimum: 0.1,
    // Start at 10%
    trickleSpeed: 200,
    // Trickle every 200ms
    trickleAmount: 0.02,
    // Increase by 2% each trickle
    speed: 200,
    // Animation speed
    easing: "ease-out"
  };
  function createBar() {
    if (bar) return bar;
    bar = document.createElement("div");
    bar.className = "progress-bar";
    bar.innerHTML = '<div class="progress-bar-inner"></div>';
    document.body.appendChild(bar);
    return bar;
  }
  function setProgress(n2) {
    n2 = Math.max(0, Math.min(1, n2));
    currentProgress = n2;
    const inner = bar.querySelector(".progress-bar-inner");
    if (inner) {
      inner.style.transform = "translateX(" + (-100 + n2 * 100) + "%)";
    }
  }
  function trickle() {
    if (currentProgress >= 1) return;
    let amount = CONFIG.trickleAmount;
    if (currentProgress > 0.5) amount = 0.01;
    if (currentProgress > 0.8) amount = 5e-3;
    setProgress(currentProgress + Math.random() * amount);
  }
  function start() {
    if (isRunning) return;
    isRunning = true;
    createBar();
    setProgress(CONFIG.minimum);
    bar.classList.add("active");
    timeout = setInterval(trickle, CONFIG.trickleSpeed);
  }
  function done() {
    if (!isRunning) return;
    clearInterval(timeout);
    setProgress(1);
    setTimeout(function() {
      bar.classList.remove("active");
      isRunning = false;
      setTimeout(function() {
        setProgress(0);
      }, CONFIG.speed);
    }, CONFIG.speed);
  }
  function initHTMXListeners() {
    document.body.addEventListener("htmx:beforeRequest", function(e) {
      if (e.detail.boosted || e.detail.elt.hasAttribute("hx-indicator")) {
        start();
      }
    });
    document.body.addEventListener("htmx:afterSettle", function() {
      done();
    });
    document.body.addEventListener("htmx:responseError", function() {
      done();
    });
    document.body.addEventListener("htmx:sendError", function() {
      done();
    });
  }
  window.addEventListener("beforeunload", function() {
    start();
  });
  onReady(initHTMXListeners);
  window.progressBar = {
    start,
    done,
    set: setProgress
  };

  // web/static/js/src/filter.js
  var TableFilter = class {
    /**
     * @param {Object} options
     * @param {string} options.tableBodyId - ID of the table tbody element
     * @param {string} options.searchId - ID of the search input
     * @param {Array<Object>} options.filters - Array of filter configurations
     * @param {Array<string>} options.searchFields - Data attributes to search in
     * @param {string} options.storageKey - Session storage key for persistence
     * @param {string} options.tableCardSelector - CSS selector for table container (for hide/show)
     */
    constructor(options) {
      this.tableBodyId = options.tableBodyId;
      this.searchId = options.searchId;
      this.filters = options.filters || [];
      this.searchFields = options.searchFields || [];
      this.storageKey = options.storageKey;
      this.tableCardSelector = options.tableCardSelector;
      this._initialized = false;
    }
    /**
     * Initialize the filter - call after DOM is ready
     */
    init() {
      if (this._initialized) return;
      this._initialized = true;
      this.restore();
      const searchInput = document.getElementById(this.searchId);
      if (searchInput) {
        searchInput.addEventListener("input", () => this.apply());
      }
      this.filters.forEach((filter) => {
        const input = document.getElementById(filter.id);
        if (input) {
          input.addEventListener("change", () => this.apply());
        }
      });
      this.apply();
    }
    /**
     * Apply all filters to the table
     * @returns {number} Count of visible rows
     */
    apply() {
      const searchValue = document.getElementById(this.searchId)?.value.toLowerCase() || "";
      const rows = document.querySelectorAll(`#${this.tableBodyId} tr`);
      let visibleCount = 0;
      const filterValues = {};
      this.filters.forEach((filter) => {
        filterValues[filter.id] = document.getElementById(filter.id)?.value || "";
      });
      rows.forEach((row) => {
        let visible = true;
        if (searchValue) {
          const searchMatch = this.searchFields.some((field) => {
            const value = row.dataset[field]?.toLowerCase() || "";
            return value.includes(searchValue);
          });
          if (!searchMatch) visible = false;
        }
        if (visible) {
          this.filters.forEach((filter) => {
            const filterValue = filterValues[filter.id];
            if (!filterValue) return;
            if (filter.match) {
              if (!filter.match(row, filterValue)) {
                visible = false;
              }
            } else {
              const dataValue = row.dataset[filter.dataAttr] || "";
              if (dataValue !== filterValue) {
                visible = false;
              }
            }
          });
        }
        row.style.display = visible ? "" : "none";
        if (visible) visibleCount++;
      });
      this._updateVisibility(visibleCount, rows.length);
      this.save();
      return visibleCount;
    }
    /**
     * Clear all filters
     */
    clear() {
      const searchInput = document.getElementById(this.searchId);
      if (searchInput) searchInput.value = "";
      if (window.dropdowns) {
        this.filters.forEach((filter) => {
          const dropdown = window.dropdowns.get(filter.id);
          if (dropdown) dropdown.reset("");
        });
      }
      if (this.storageKey) {
        sessionStorage.removeItem(this.storageKey);
      }
      this.apply();
    }
    /**
     * Save current filter state to session storage
     */
    save() {
      if (!this.storageKey) return;
      const state = {
        search: document.getElementById(this.searchId)?.value || ""
      };
      this.filters.forEach((filter) => {
        state[filter.id] = document.getElementById(filter.id)?.value || "";
      });
      sessionStorage.setItem(this.storageKey, JSON.stringify(state));
    }
    /**
     * Restore filter state from session storage
     */
    restore() {
      if (!this.storageKey) return;
      const saved = sessionStorage.getItem(this.storageKey);
      if (!saved) return;
      try {
        const state = JSON.parse(saved);
        const searchInput = document.getElementById(this.searchId);
        if (searchInput && state.search) {
          searchInput.value = state.search;
        }
        setTimeout(() => {
          if (window.dropdowns) {
            this.filters.forEach((filter) => {
              const value = state[filter.id];
              if (value) {
                const dropdown = window.dropdowns.get(filter.id);
                if (dropdown) dropdown.reset(value);
              }
            });
          }
          this.apply();
        }, 10);
      } catch (e) {
        console.warn("Failed to restore filter state:", e);
      }
    }
    /**
     * Update visibility of table and no-results message
     * @private
     */
    _updateVisibility(visibleCount, totalCount) {
      const noResults = document.getElementById("no-results");
      const table = this.tableCardSelector ? document.querySelector(this.tableCardSelector) : null;
      if (visibleCount === 0 && totalCount > 0) {
        noResults?.classList.remove("hidden");
        table?.classList.add("hidden");
      } else {
        noResults?.classList.add("hidden");
        table?.classList.remove("hidden");
      }
    }
  };
  TableFilter.booleanMatcher = function(dataAttr, valueMap) {
    return function(row, filterValue) {
      const dataValue = row.dataset[dataAttr];
      if (valueMap && valueMap[filterValue] !== void 0) {
        return dataValue === String(valueMap[filterValue]);
      }
      return dataValue === filterValue;
    };
  };
  TableFilter.publicPrivateMatcher = function(row, filterValue) {
    const isPublic = row.dataset.isPublic === "true";
    if (filterValue === "public") return isPublic;
    if (filterValue === "private") return !isPublic;
    return true;
  };
  TableFilter.draftPublishedMatcher = function(row, filterValue) {
    const isDraft = row.dataset.isDraft === "true";
    if (filterValue === "published") return !isDraft;
    if (filterValue === "draft") return isDraft;
    return true;
  };
  TableFilter.bookmarkStatusMatcher = function(row, filterValue) {
    const isPublic = row.dataset.isPublic === "true";
    const isFavorite = row.dataset.isFavorite === "true";
    if (filterValue === "public") return isPublic;
    if (filterValue === "private") return !isPublic;
    if (filterValue === "favorite") return isFavorite;
    return true;
  };
  TableFilter.collectionMatcher = function(row, filterValue) {
    const collectionId = row.dataset.collectionId || "";
    if (filterValue === "none") return collectionId === "";
    return collectionId === filterValue;
  };
  window.TableFilter = TableFilter;

  // web/static/js/src/expandable-row.js
  var CONFIG2 = {
    /** CSS class for expand button */
    EXPAND_BTN_CLASS: "expand-btn",
    /** CSS class for rotation animation */
    ROTATE_CLASS: "rotate-90",
    /** CSS class to hide elements */
    HIDDEN_CLASS: "hidden",
    /** Data attribute for expanded state */
    EXPANDED_ATTR: "data-expanded",
    /** Data attribute for expandable ID */
    ID_ATTR: "data-expandable-id",
    /** Data attribute for expandable type */
    TYPE_ATTR: "data-expandable-type",
    /** Data attribute to mark content as loaded */
    LOADED_ATTR: "data-loaded",
    /** HTMX trigger event name for lazy loading */
    FETCH_TRIGGER: "fetchContent"
  };
  var initializedRows = /* @__PURE__ */ new Set();
  function prefetchRow(type, id) {
    const contentDiv = document.getElementById(`${type}-content-${id}`);
    if (contentDiv && !contentDiv.hasAttribute(CONFIG2.LOADED_ATTR)) {
      contentDiv.setAttribute(CONFIG2.LOADED_ATTR, "true");
      if (typeof htmx !== "undefined") {
        htmx.trigger(contentDiv, CONFIG2.FETCH_TRIGGER);
      }
    }
  }
  function toggleRow(type, id) {
    const row = document.querySelector(`[${CONFIG2.ID_ATTR}="${id}"][${CONFIG2.TYPE_ATTR}="${type}"]`);
    const detailsRow = document.getElementById(`${type}-details-${id}`);
    if (!row || !detailsRow) {
      console.warn(`[ExpandableRow] Missing elements for ${type}-${id}`);
      return;
    }
    const expandBtn = row.querySelector(`.${CONFIG2.EXPAND_BTN_CLASS}`);
    const isExpanded = row.getAttribute(CONFIG2.EXPANDED_ATTR) === "true";
    if (isExpanded) {
      row.setAttribute(CONFIG2.EXPANDED_ATTR, "false");
      row.setAttribute("aria-expanded", "false");
      detailsRow.classList.add(CONFIG2.HIDDEN_CLASS);
      if (expandBtn) {
        expandBtn.classList.remove(CONFIG2.ROTATE_CLASS);
      }
    } else {
      prefetchRow(type, id);
      row.setAttribute(CONFIG2.EXPANDED_ATTR, "true");
      row.setAttribute("aria-expanded", "true");
      detailsRow.classList.remove(CONFIG2.HIDDEN_CLASS);
      if (expandBtn) {
        expandBtn.classList.add(CONFIG2.ROTATE_CLASS);
      }
    }
  }
  function handleKeydown(event, type, id) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleRow(type, id);
    }
  }
  function setupPrefetch(row, type, id) {
    const key = `${type}-${id}`;
    if (initializedRows.has(key)) return;
    if (row.getAttribute("role") === "button") {
      row.addEventListener(
        "mouseenter",
        function() {
          prefetchRow(type, id);
        },
        { once: true }
      );
      row.addEventListener(
        "focus",
        function() {
          prefetchRow(type, id);
        },
        { once: true }
      );
      initializedRows.add(key);
    }
  }
  function initType(type) {
    const rows = document.querySelectorAll(`[${CONFIG2.TYPE_ATTR}="${type}"]`);
    rows.forEach((row) => {
      const id = row.getAttribute(CONFIG2.ID_ATTR);
      if (id) {
        setupPrefetch(row, type, id);
      }
    });
  }
  function init3() {
    const rows = document.querySelectorAll(`[${CONFIG2.TYPE_ATTR}]`);
    const types = /* @__PURE__ */ new Set();
    rows.forEach((row) => {
      const type = row.getAttribute(CONFIG2.TYPE_ATTR);
      if (type) types.add(type);
    });
    types.forEach((type) => initType(type));
  }
  onReady(init3);
  document.addEventListener("htmx:afterSettle", function(e) {
    if (e.detail?.elt) {
      const rows = e.detail.elt.querySelectorAll?.(`[${CONFIG2.TYPE_ATTR}]`) || [];
      rows.forEach((row) => {
        const type = row.getAttribute(CONFIG2.TYPE_ATTR);
        const id = row.getAttribute(CONFIG2.ID_ATTR);
        if (type && id) {
          setupPrefetch(row, type, id);
        }
      });
    }
  });
  window.ExpandableRow = {
    toggle: toggleRow,
    prefetch: prefetchRow,
    handleKeydown,
    init: init3,
    initType
  };

  // web/static/js/src/masonry.js
  var SimpleMasonry = class {
    constructor(container, options = {}) {
      this.container = container;
      this.gap = options.gap || 16;
      this.minColumnWidthDesktop = options.minColumnWidth || 300;
      this.minColumnWidthMobile = options.minColumnWidthMobile || 280;
      this.columnHeights = [];
      this.resizeTimeout = null;
      this.layoutTimeout = null;
      this.itemHeights = /* @__PURE__ */ new Map();
      this.init();
    }
    // Get responsive min column width based on viewport
    get minColumnWidth() {
      if (window.innerWidth < 640) {
        return this.minColumnWidthMobile;
      }
      return this.minColumnWidthDesktop;
    }
    init() {
      this.container.style.position = "relative";
      this._resizeHandler = () => {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => this.layout(), 150);
      };
      window.addEventListener("resize", this._resizeHandler);
      this.resizeObserver = new ResizeObserver((entries) => {
        let needsRelayout = false;
        for (const entry of entries) {
          const item = entry.target;
          const oldHeight = this.itemHeights.get(item) || 0;
          const newHeight = item.offsetHeight;
          if (Math.abs(newHeight - oldHeight) > 5) {
            needsRelayout = true;
            this.itemHeights.set(item, newHeight);
          }
        }
        if (needsRelayout) {
          clearTimeout(this.layoutTimeout);
          this.layoutTimeout = setTimeout(() => this.layout(), 100);
        }
      });
      const items = this.container.querySelectorAll(".masonry-item");
      items.forEach((item) => {
        item.setAttribute("data-laid-out", "true");
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
      const items = [...this.container.querySelectorAll(".masonry-item")];
      const columnCount = this.getColumnCount();
      const columnWidth = this.getColumnWidth();
      this.columnHeights = Array(columnCount).fill(0);
      items.forEach((item) => {
        this.positionItem(item, columnWidth);
        this.itemHeights.set(item, item.offsetHeight);
      });
      this.updateContainerHeight();
    }
    // Position a single item in the shortest column
    positionItem(item, columnWidth) {
      const minHeight = Math.min(...this.columnHeights);
      const columnIndex = this.columnHeights.indexOf(minHeight);
      item.style.position = "absolute";
      item.style.width = `${columnWidth}px`;
      item.style.left = `${columnIndex * (columnWidth + this.gap)}px`;
      item.style.top = `${minHeight}px`;
      this.columnHeights[columnIndex] += item.offsetHeight + this.gap;
    }
    // Append new items without reflowing existing ones
    append(newItems) {
      const columnWidth = this.getColumnWidth();
      newItems.forEach((item) => {
        item.setAttribute("data-laid-out", "true");
        this.positionItem(item, columnWidth);
        this.itemHeights.set(item, item.offsetHeight);
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
      if (this._resizeHandler) {
        window.removeEventListener("resize", this._resizeHandler);
        this._resizeHandler = null;
      }
    }
  };
  window.SimpleMasonry = SimpleMasonry;
  function initMasonry() {
    const grid = document.getElementById("bookmark-grid");
    if (!grid) return;
    if (window.bookmarkMasonry) {
      if (window.bookmarkMasonry.container === grid) {
        return;
      }
      window.bookmarkMasonry.destroy();
      window.bookmarkMasonry = null;
    }
    window.bookmarkMasonry = new SimpleMasonry(grid, {
      gap: 16,
      minColumnWidth: 350,
      minColumnWidthMobile: 280
    });
  }
  onReady(function() {
    initMasonry();
    document.body.addEventListener("htmx:oobAfterSwap", function(e) {
      if (e.detail.target.id !== "bookmark-grid") return;
      if (!window.bookmarkMasonry) return;
      const grid = document.getElementById("bookmark-grid");
      const newItems = [...grid.querySelectorAll(".masonry-item:not([data-laid-out])")];
      if (newItems.length === 0) return;
      window.bookmarkMasonry.append(newItems);
    });
    document.body.addEventListener("htmx:afterSettle", function(e) {
      const grid = document.getElementById("bookmark-grid");
      if (!grid) return;
      if (window.bookmarkMasonry) {
        window.bookmarkMasonry.destroy();
        window.bookmarkMasonry = null;
      }
      initMasonry();
    });
  });

  // web/static/js/src/kanban.js
  (function() {
    "use strict";
    const SCROLL_CONFIG = {
      edgeThreshold: 60,
      // px from edge to start scrolling
      maxScrollSpeed: 15,
      // max px per frame
      minScrollSpeed: 3
      // min px per frame
    };
    const SELECTION_CONFIG = {
      maxSelection: 50
      // Maximum cards that can be selected
    };
    function createDragState() {
      return {
        isDragging: false,
        draggedCard: null,
        draggedCards: [],
        sourceColumn: null,
        sourceIndex: null,
        sourcePositions: [],
        placeholder: null,
        isMultiDrag: false
      };
    }
    function createScrollState() {
      return {
        animationId: null,
        horizontalSpeed: 0,
        verticalSpeed: 0,
        boardContainer: null,
        columnContainer: null
      };
    }
    function createKeyboardDragState() {
      return {
        isActive: false,
        card: null,
        originalColumn: null,
        originalNextSibling: null,
        originalIndex: null
      };
    }
    function createSelectionState() {
      return {
        selectedIds: /* @__PURE__ */ new Set(),
        lastSelectedId: null,
        columnId: null
      };
    }
    function createMoveMenuState() {
      return {
        isOpen: false,
        focusedIndex: 0,
        collections: [],
        previousFocus: null
      };
    }
    const dragState = createDragState();
    const scrollState = createScrollState();
    const keyboardDragState = createKeyboardDragState();
    const selectionState = createSelectionState();
    const moveMenuState = createMoveMenuState();
    function resetDragState() {
      Object.assign(dragState, createDragState());
    }
    function resetScrollState() {
      Object.assign(scrollState, createScrollState());
    }
    function resetKeyboardDragState() {
      Object.assign(keyboardDragState, createKeyboardDragState());
    }
    function resetSelectionState() {
      Object.assign(selectionState, createSelectionState());
    }
    function resetMoveMenuState() {
      Object.assign(moveMenuState, createMoveMenuState());
    }
    function showErrorToast(message) {
      if (typeof window.showToast === "function") {
        window.showToast(message, "error");
      } else {
        alert(message);
      }
    }
    function pluralize(count, singular, plural) {
      return count === 1 ? singular : plural || singular + "s";
    }
    function announceCount(count, action, noun = "item") {
      announce(`${count} ${pluralize(count, noun)} ${action}`);
    }
    function getCardById(bookmarkId) {
      return document.querySelector(`.kanban-card[data-bookmark-id="${bookmarkId}"]`);
    }
    function getColumnContent(card) {
      return card.closest(".kanban-column-content");
    }
    function getColumnCards(columnContent) {
      return Array.from(columnContent.querySelectorAll(".kanban-card"));
    }
    function getCSRFToken() {
      const body = document.body;
      const headers = body.getAttribute("hx-headers");
      if (headers) {
        try {
          const parsed = JSON.parse(headers);
          if (parsed["X-CSRF-Token"]) {
            return parsed["X-CSRF-Token"];
          }
        } catch (e) {
        }
      }
      const cookies = document.cookie.split(";");
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split("=");
        if (name === "csrf_token") {
          return value;
        }
      }
      return "";
    }
    function bulkMoveBookmarksAPI(bookmarkIds, collectionId, options = {}) {
      const { afterBookmarkId = null, onSuccess = null, onError = null } = options;
      const csrfToken = getCSRFToken();
      const payload = {
        bookmark_ids: bookmarkIds,
        collection_id: collectionId === "" ? null : parseInt(collectionId, 10)
      };
      if (afterBookmarkId) {
        payload.after_id = parseInt(afterBookmarkId, 10);
      }
      return fetch("/admin/htmx/bookmarks/bulk/move", {
        method: "POST",
        headers: {
          "X-CSRF-Token": csrfToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }).then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to move bookmarks: ${response.status}`);
        }
        if (onSuccess) onSuccess();
        return response;
      }).catch((error) => {
        console.error("[Kanban] Error moving bookmarks:", error);
        if (onError) onError(error);
        showErrorToast("Failed to move bookmarks. Please try again.");
        throw error;
      });
    }
    function announce(message) {
      const liveRegion = document.getElementById("kanban-live-region");
      if (liveRegion) {
        liveRegion.textContent = "";
        requestAnimationFrame(() => {
          liveRegion.textContent = message;
        });
      }
    }
    function getColumnId(element) {
      const column = element.closest(".kanban-column");
      return column ? column.dataset.collectionId || null : null;
    }
    function getBookmarkId(card) {
      return card.dataset.bookmarkId;
    }
    function isSelected(card) {
      return selectionState.selectedIds.has(getBookmarkId(card));
    }
    function updateCardSelectionVisual(card) {
      if (isSelected(card)) {
        card.classList.add("selected");
        card.setAttribute("aria-selected", "true");
      } else {
        card.classList.remove("selected");
        card.setAttribute("aria-selected", "false");
      }
    }
    function clearSelection() {
      selectionState.selectedIds.forEach((id) => {
        const card = getCardById(id);
        if (card) {
          card.classList.remove("selected");
          card.setAttribute("aria-selected", "false");
        }
      });
      selectionState.selectedIds = /* @__PURE__ */ new Set();
      selectionState.lastSelectedId = null;
      selectionState.columnId = null;
      updateSelectionToolbar();
    }
    function selectCard(card, options = {}) {
      const { toggle = false, addToSelection = false } = options;
      const bookmarkId = getBookmarkId(card);
      const columnId = getColumnId(card);
      if (selectionState.columnId !== null && selectionState.columnId !== columnId && selectionState.selectedIds.size > 0) {
        clearSelection();
      }
      if (toggle) {
        if (selectionState.selectedIds.has(bookmarkId)) {
          selectionState.selectedIds.delete(bookmarkId);
          if (selectionState.selectedIds.size === 0) {
            selectionState.columnId = null;
            selectionState.lastSelectedId = null;
          }
        } else {
          if (selectionState.selectedIds.size < SELECTION_CONFIG.maxSelection) {
            selectionState.selectedIds.add(bookmarkId);
            selectionState.lastSelectedId = bookmarkId;
            selectionState.columnId = columnId;
          }
        }
      } else if (addToSelection) {
        if (selectionState.selectedIds.size < SELECTION_CONFIG.maxSelection) {
          selectionState.selectedIds.add(bookmarkId);
          selectionState.columnId = columnId;
        }
      } else {
        clearSelection();
        selectionState.selectedIds.add(bookmarkId);
        selectionState.lastSelectedId = bookmarkId;
        selectionState.columnId = columnId;
      }
      updateCardSelectionVisual(card);
      updateSelectionToolbar();
    }
    function selectRange(targetCard) {
      const columnId = getColumnId(targetCard);
      if (!selectionState.lastSelectedId || selectionState.columnId !== columnId) {
        selectCard(targetCard);
        return;
      }
      const column = targetCard.closest(".kanban-column-content");
      const cards = Array.from(column.querySelectorAll(".kanban-card"));
      const targetId = getBookmarkId(targetCard);
      const lastIndex = cards.findIndex((c4) => getBookmarkId(c4) === selectionState.lastSelectedId);
      const targetIndex = cards.findIndex((c4) => getBookmarkId(c4) === targetId);
      if (lastIndex === -1 || targetIndex === -1) {
        selectCard(targetCard);
        return;
      }
      const startIndex = Math.min(lastIndex, targetIndex);
      const endIndex = Math.max(lastIndex, targetIndex);
      for (let i2 = startIndex; i2 <= endIndex && selectionState.selectedIds.size < SELECTION_CONFIG.maxSelection; i2++) {
        const card = cards[i2];
        selectionState.selectedIds.add(getBookmarkId(card));
        updateCardSelectionVisual(card);
      }
      selectionState.columnId = columnId;
      updateSelectionToolbar();
      const count = selectionState.selectedIds.size;
      announce(`${count} item${count !== 1 ? "s" : ""} selected`);
    }
    function extendSelectionInDirection(card, direction) {
      const column = card.closest(".kanban-column-content");
      const columnId = getColumnId(card);
      const cards = Array.from(column.querySelectorAll(".kanban-card"));
      const currentIndex = cards.indexOf(card);
      const targetIndex = currentIndex + direction;
      if (targetIndex < 0 || targetIndex >= cards.length) {
        announce(direction < 0 ? "At top of column" : "At bottom of column");
        return;
      }
      const targetCard = cards[targetIndex];
      const targetId = getBookmarkId(targetCard);
      if (selectionState.columnId !== null && selectionState.columnId !== columnId) {
        clearSelection();
      }
      if (!selectionState.selectedIds.has(getBookmarkId(card))) {
        selectionState.selectedIds.add(getBookmarkId(card));
        selectionState.lastSelectedId = getBookmarkId(card);
        selectionState.columnId = columnId;
        updateCardSelectionVisual(card);
      }
      if (selectionState.selectedIds.has(targetId)) {
        const currentId = getBookmarkId(card);
        selectionState.selectedIds.delete(currentId);
        updateCardSelectionVisual(card);
      } else {
        if (selectionState.selectedIds.size < SELECTION_CONFIG.maxSelection) {
          selectionState.selectedIds.add(targetId);
          updateCardSelectionVisual(targetCard);
        }
      }
      selectionState.lastSelectedId = targetId;
      updateSelectionToolbar();
      targetCard.focus();
      scrollCardIntoView(targetCard);
      const count = selectionState.selectedIds.size;
      announce(`${count} item${count !== 1 ? "s" : ""} selected`);
    }
    function selectAllInColumn(card) {
      const column = card.closest(".kanban-column-content");
      const columnId = getColumnId(card);
      const cards = Array.from(column.querySelectorAll(".kanban-card"));
      clearSelection();
      const maxToSelect = Math.min(cards.length, SELECTION_CONFIG.maxSelection);
      for (let i2 = 0; i2 < maxToSelect; i2++) {
        selectionState.selectedIds.add(getBookmarkId(cards[i2]));
        updateCardSelectionVisual(cards[i2]);
      }
      selectionState.columnId = columnId;
      if (cards.length > 0) {
        selectionState.lastSelectedId = getBookmarkId(cards[maxToSelect - 1]);
      }
      updateSelectionToolbar();
      const count = selectionState.selectedIds.size;
      announce(`${count} item${count !== 1 ? "s" : ""} selected`);
    }
    function getSelectedCards() {
      const cards = [];
      selectionState.selectedIds.forEach((id) => {
        const card = getCardById(id);
        if (card) cards.push(card);
      });
      return cards;
    }
    function getSelectedBookmarkIds() {
      return Array.from(selectionState.selectedIds).map((id) => parseInt(id, 10));
    }
    function updateSelectionToolbar() {
      const toolbar = document.getElementById("kanban-selection-toolbar");
      if (!toolbar) return;
      const count = selectionState.selectedIds.size;
      if (count === 0) {
        toolbar.classList.add("hidden");
      } else {
        toolbar.classList.remove("hidden");
        const countEl = toolbar.querySelector(".selection-count");
        if (countEl) {
          countEl.textContent = `${count} selected`;
        }
      }
    }
    function handleCardClick(e) {
      const card = e.target.closest(".kanban-card");
      if (!card) return;
      if (e.target.closest("button, a, [data-dropdown-trigger], [data-dropdown-option]")) {
        return;
      }
      if (keyboardDragState.isActive) return;
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isModifierPressed = isMac ? e.metaKey : e.ctrlKey;
      const isShiftPressed = e.shiftKey;
      if (isShiftPressed) {
        e.preventDefault();
        selectRange(card);
      } else if (isModifierPressed) {
        e.preventDefault();
        selectCard(card, { toggle: true });
      } else {
        selectCard(card);
      }
    }
    function handleBoardClick(e) {
      if (!e.target.closest(".kanban-card") && !e.target.closest("#kanban-selection-toolbar") && !e.target.closest("#kanban-move-menu")) {
        clearSelection();
      }
    }
    function openMoveMenu() {
      if (selectionState.selectedIds.size < 2) return;
      moveMenuState.previousFocus = document.activeElement;
      const collections = [];
      const currentColumnId = selectionState.columnId;
      collections.push({
        id: "",
        name: "Unsorted",
        color: null,
        isCurrent: currentColumnId === null || currentColumnId === ""
      });
      document.querySelectorAll("[data-selection-move-menu] [data-move-collection-id]").forEach((el) => {
        const id = el.dataset.moveCollectionId;
        if (id !== "") {
          const colorEl = el.querySelector(".selection-move-option-color");
          collections.push({
            id,
            name: el.querySelector("span:last-child")?.textContent.trim() || "Collection",
            color: colorEl ? colorEl.style.backgroundColor : null,
            isCurrent: id === currentColumnId
          });
        }
      });
      moveMenuState.collections = collections;
      moveMenuState.focusedIndex = collections.findIndex((c4) => !c4.isCurrent);
      if (moveMenuState.focusedIndex === -1) moveMenuState.focusedIndex = 0;
      renderMoveMenu();
      const menu = document.getElementById("kanban-move-menu");
      const backdrop = document.getElementById("kanban-move-menu-backdrop");
      if (menu) {
        menu.classList.remove("hidden");
        moveMenuState.isOpen = true;
        menu.focus();
      }
      if (backdrop) {
        backdrop.classList.remove("hidden");
      }
      const countEl = document.getElementById("move-menu-count");
      if (countEl) {
        countEl.textContent = selectionState.selectedIds.size;
      }
      announce(`Move menu opened. ${collections.length} options. Use arrow keys to navigate.`);
    }
    function closeMoveMenu() {
      const menu = document.getElementById("kanban-move-menu");
      const backdrop = document.getElementById("kanban-move-menu-backdrop");
      if (menu) {
        menu.classList.add("hidden");
      }
      if (backdrop) {
        backdrop.classList.add("hidden");
      }
      moveMenuState.isOpen = false;
      if (moveMenuState.previousFocus && moveMenuState.previousFocus.focus) {
        moveMenuState.previousFocus.focus();
      }
      moveMenuState.previousFocus = null;
    }
    function renderMoveMenu() {
      const list = document.querySelector(".kanban-move-menu-list");
      if (!list) return;
      list.innerHTML = moveMenuState.collections.map((item, index) => {
        const isFocused = index === moveMenuState.focusedIndex;
        const shortcut = index < 9 ? index + 1 : null;
        return `
          <div class="kanban-move-menu-item ${item.isCurrent ? "current" : ""} ${isFocused ? "focused" : ""}"
               role="option"
               data-index="${index}"
               data-collection-id="${item.id}"
               aria-selected="${isFocused}"
               ${item.isCurrent ? 'aria-disabled="true"' : ""}>
            ${item.color ? `<span class="kanban-move-menu-item-color" style="background-color: ${item.color}"></span>` : `<svg class="kanban-move-menu-item-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>`}
            <span class="kanban-move-menu-item-name">${item.name}</span>
            ${shortcut ? `<span class="kanban-move-menu-item-shortcut">${shortcut}</span>` : ""}
          </div>
        `;
      }).join("");
      list.querySelectorAll(".kanban-move-menu-item:not(.current)").forEach((el) => {
        el.addEventListener("click", () => {
          const index = parseInt(el.dataset.index, 10);
          moveMenuState.focusedIndex = index;
          selectMoveMenuItem();
        });
      });
    }
    function navigateMoveMenu(direction) {
      const { collections, focusedIndex } = moveMenuState;
      let newIndex = focusedIndex;
      let attempts = 0;
      do {
        newIndex = newIndex + direction;
        if (newIndex < 0) newIndex = collections.length - 1;
        if (newIndex >= collections.length) newIndex = 0;
        attempts++;
      } while (collections[newIndex].isCurrent && attempts < collections.length);
      moveMenuState.focusedIndex = newIndex;
      updateMoveMenuFocus();
      const item = collections[newIndex];
      announce(`${item.name}${item.isCurrent ? " (current)" : ""}`);
    }
    function updateMoveMenuFocus() {
      const list = document.querySelector(".kanban-move-menu-list");
      if (!list) return;
      list.querySelectorAll(".kanban-move-menu-item").forEach((el, index) => {
        const isFocused = index === moveMenuState.focusedIndex;
        el.classList.toggle("focused", isFocused);
        el.setAttribute("aria-selected", isFocused);
      });
      const focusedEl = list.querySelector(".kanban-move-menu-item.focused");
      if (focusedEl) {
        focusedEl.scrollIntoView({ block: "nearest" });
      }
    }
    function selectMoveMenuItem() {
      const item = moveMenuState.collections[moveMenuState.focusedIndex];
      if (!item || item.isCurrent) return;
      closeMoveMenu();
      handleBulkMove(item.id);
    }
    function quickSelectMoveItem(number) {
      const index = number - 1;
      if (index < 0 || index >= moveMenuState.collections.length) return;
      const item = moveMenuState.collections[index];
      if (item.isCurrent) {
        announce(`${item.name} is the current column`);
        return;
      }
      moveMenuState.focusedIndex = index;
      selectMoveMenuItem();
    }
    function handleMoveMenuKeydown(e) {
      if (!moveMenuState.isOpen) return;
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          navigateMoveMenu(-1);
          break;
        case "ArrowDown":
          e.preventDefault();
          navigateMoveMenu(1);
          break;
        case "Enter":
          e.preventDefault();
          selectMoveMenuItem();
          break;
        case "Escape":
          e.preventDefault();
          closeMoveMenu();
          announce("Move menu closed");
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          e.preventDefault();
          quickSelectMoveItem(parseInt(e.key, 10));
          break;
        case "Tab":
          e.preventDefault();
          break;
      }
    }
    function handleMoveMenuBackdropClick() {
      if (moveMenuState.isOpen) {
        closeMoveMenu();
        announce("Move menu closed");
      }
    }
    function getColumnName(column) {
      const header = column.querySelector(".kanban-column-title h3");
      return header ? header.textContent.trim() : "Unknown";
    }
    function getCardPosition(card) {
      const column = card.closest(".kanban-column-content");
      const cards = Array.from(column.querySelectorAll(".kanban-card"));
      const index = cards.indexOf(card);
      return { index: index + 1, total: cards.length };
    }
    function getCardTitle(card) {
      return card.getAttribute("aria-label") || "Bookmark";
    }
    function getCardIndex(card) {
      const column = card.closest(".kanban-column-content");
      const cards = Array.from(column.querySelectorAll(".kanban-card"));
      return cards.indexOf(card);
    }
    function calculateScrollSpeed(distanceFromEdge) {
      const { edgeThreshold, maxScrollSpeed, minScrollSpeed } = SCROLL_CONFIG;
      if (distanceFromEdge >= edgeThreshold) return 0;
      const ratio = 1 - distanceFromEdge / edgeThreshold;
      return minScrollSpeed + (maxScrollSpeed - minScrollSpeed) * ratio;
    }
    function updateScrollDirection(clientX, clientY) {
      const board = document.getElementById("kanban-board");
      if (!board) return;
      const boardRect = board.getBoundingClientRect();
      const { edgeThreshold } = SCROLL_CONFIG;
      let horizontalSpeed = 0;
      const distanceFromLeft = clientX - boardRect.left;
      const distanceFromRight = boardRect.right - clientX;
      if (distanceFromLeft < edgeThreshold && board.scrollLeft > 0) {
        horizontalSpeed = -calculateScrollSpeed(distanceFromLeft);
      } else if (distanceFromRight < edgeThreshold && board.scrollLeft < board.scrollWidth - board.clientWidth) {
        horizontalSpeed = calculateScrollSpeed(distanceFromRight);
      }
      let verticalSpeed = 0;
      let columnContainer = null;
      const column = document.elementFromPoint(clientX, clientY)?.closest(".kanban-column-content");
      if (column) {
        const columnRect = column.getBoundingClientRect();
        const distanceFromTop = clientY - columnRect.top;
        const distanceFromBottom = columnRect.bottom - clientY;
        if (distanceFromTop < edgeThreshold && column.scrollTop > 0) {
          verticalSpeed = -calculateScrollSpeed(distanceFromTop);
          columnContainer = column;
        } else if (distanceFromBottom < edgeThreshold && column.scrollTop < column.scrollHeight - column.clientHeight) {
          verticalSpeed = calculateScrollSpeed(distanceFromBottom);
          columnContainer = column;
        }
      }
      scrollState.horizontalSpeed = horizontalSpeed;
      scrollState.verticalSpeed = verticalSpeed;
      scrollState.boardContainer = board;
      scrollState.columnContainer = columnContainer;
      if (horizontalSpeed !== 0 || verticalSpeed !== 0) {
        startAutoScroll();
      } else {
        stopAutoScroll();
      }
    }
    function startAutoScroll() {
      if (scrollState.animationId !== null) return;
      function scrollFrame() {
        const { horizontalSpeed, verticalSpeed, boardContainer, columnContainer } = scrollState;
        if (boardContainer && horizontalSpeed !== 0) {
          boardContainer.scrollLeft += horizontalSpeed;
        }
        if (columnContainer && verticalSpeed !== 0) {
          columnContainer.scrollTop += verticalSpeed;
        }
        if (dragState.isDragging && (horizontalSpeed !== 0 || verticalSpeed !== 0)) {
          scrollState.animationId = requestAnimationFrame(scrollFrame);
        } else {
          scrollState.animationId = null;
        }
      }
      scrollState.animationId = requestAnimationFrame(scrollFrame);
    }
    function stopAutoScroll() {
      if (scrollState.animationId !== null) {
        cancelAnimationFrame(scrollState.animationId);
        scrollState.animationId = null;
      }
      scrollState.horizontalSpeed = 0;
      scrollState.verticalSpeed = 0;
      scrollState.boardContainer = null;
      scrollState.columnContainer = null;
    }
    function createPlaceholder() {
      const el = document.createElement("div");
      el.className = "kanban-drop-placeholder";
      el.setAttribute("aria-hidden", "true");
      return el;
    }
    function removePlaceholder() {
      if (dragState.placeholder && dragState.placeholder.parentNode) {
        dragState.placeholder.remove();
      }
    }
    function removeAllDragOverClasses() {
      document.querySelectorAll(".drag-over").forEach((el) => {
        el.classList.remove("drag-over");
      });
    }
    function getDropPosition(container, mouseY) {
      const cards = Array.from(
        container.querySelectorAll(".kanban-card:not(.dragging)")
      );
      for (const card of cards) {
        const rect = card.getBoundingClientRect();
        const cardMiddle = rect.top + rect.height / 2;
        if (mouseY < cardMiddle) {
          return card;
        }
      }
      return null;
    }
    function updatePlaceholder(column, beforeCard) {
      const { placeholder } = dragState;
      if (!placeholder) return;
      const emptyState = column.querySelector(".kanban-empty");
      if (emptyState) {
        emptyState.remove();
      }
      if (beforeCard) {
        beforeCard.parentNode.insertBefore(placeholder, beforeCard);
      } else {
        column.appendChild(placeholder);
      }
    }
    function handleDragStart(e) {
      const card = e.target.closest(".kanban-card");
      if (!card) return;
      const bookmarkId = card.dataset.bookmarkId;
      const isCardSelected = selectionState.selectedIds.has(bookmarkId);
      const hasMultipleSelected = selectionState.selectedIds.size > 1;
      if (!isCardSelected) {
        clearSelection();
      }
      dragState.isDragging = true;
      dragState.draggedCard = card;
      dragState.sourceColumn = card.closest(".kanban-column-content");
      dragState.sourceIndex = getCardIndex(card);
      if (isCardSelected && hasMultipleSelected) {
        dragState.isMultiDrag = true;
        const column = card.closest(".kanban-column-content");
        const allCardsInColumn = Array.from(column.querySelectorAll(".kanban-card"));
        dragState.draggedCards = allCardsInColumn.filter(
          (c4) => selectionState.selectedIds.has(c4.dataset.bookmarkId)
        );
        dragState.sourcePositions = dragState.draggedCards.map((c4) => ({
          card: c4,
          column: c4.closest(".kanban-column-content"),
          nextSibling: c4.nextElementSibling
        }));
        setTimeout(() => {
          dragState.draggedCards.forEach((c4, i2) => {
            c4.classList.add("dragging");
            if (c4 !== card) {
              c4.classList.add("multi-drag-secondary");
            }
          });
          addMultiDragBadge(card, dragState.draggedCards.length);
        }, 0);
      } else {
        dragState.isMultiDrag = false;
        dragState.draggedCards = [card];
        dragState.sourcePositions = [{
          card,
          column: card.closest(".kanban-column-content"),
          nextSibling: card.nextElementSibling
        }];
        setTimeout(() => {
          card.classList.add("dragging");
        }, 0);
      }
      e.dataTransfer.setData("text/plain", bookmarkId);
      e.dataTransfer.effectAllowed = "move";
      dragState.placeholder = createPlaceholder();
    }
    function addMultiDragBadge(card, count) {
      removeMultiDragBadge();
      const badge = document.createElement("div");
      badge.className = "multi-drag-badge";
      badge.textContent = count;
      badge.id = "multi-drag-badge";
      card.style.position = "relative";
      card.appendChild(badge);
    }
    function removeMultiDragBadge() {
      const badge = document.getElementById("multi-drag-badge");
      if (badge) {
        badge.remove();
      }
    }
    function handleDragEnd(e) {
      const card = e.target.closest(".kanban-card");
      if (!card) return;
      dragState.draggedCards.forEach((c4) => {
        c4.classList.remove("dragging");
        c4.classList.remove("multi-drag-secondary");
      });
      removeMultiDragBadge();
      removePlaceholder();
      removeAllDragOverClasses();
      stopAutoScroll();
      resetDragState();
    }
    function handleDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragState.isDragging) {
        updateScrollDirection(e.clientX, e.clientY);
      }
      const column = e.target.closest(".kanban-column-content");
      if (!column || !dragState.isDragging) return;
      const afterCard = getDropPosition(column, e.clientY);
      updatePlaceholder(column, afterCard);
    }
    function handleDragEnter(e) {
      const column = e.target.closest(".kanban-column-content");
      if (!column || !dragState.isDragging) return;
      column.classList.add("drag-over");
    }
    function handleDragLeave(e) {
      const column = e.target.closest(".kanban-column-content");
      if (!column) return;
      const relatedTarget = e.relatedTarget;
      if (!column.contains(relatedTarget)) {
        column.classList.remove("drag-over");
      }
    }
    function handleDrop(e) {
      e.preventDefault();
      stopAutoScroll();
      const column = e.target.closest(".kanban-column-content");
      if (!column || !dragState.draggedCard) return;
      const { draggedCard, draggedCards, sourceColumn, sourceIndex, placeholder, isMultiDrag } = dragState;
      const insertBefore = placeholder ? placeholder.nextElementSibling : null;
      removePlaceholder();
      removeAllDragOverClasses();
      if (isMultiDrag && draggedCards.length > 1) {
        draggedCards.forEach((c4) => {
          c4.classList.remove("dragging");
          c4.classList.remove("multi-drag-secondary");
        });
        removeMultiDragBadge();
        draggedCards.forEach((c4) => {
          if (insertBefore) {
            column.insertBefore(c4, insertBefore);
          } else {
            column.appendChild(c4);
          }
        });
        const firstInsertedCard = draggedCards[0];
        const afterBookmarkId = getAfterBookmarkId(firstInsertedCard);
        const newCollectionId = column.dataset.collectionId || "";
        const positionChanged = column !== sourceColumn || draggedCards.some((c4, i2) => getCardIndex(c4) !== sourceIndex + i2);
        if (positionChanged) {
          const bookmarkIds = draggedCards.map((c4) => parseInt(c4.dataset.bookmarkId, 10));
          bulkMoveBookmarksWithPosition(bookmarkIds, newCollectionId, afterBookmarkId, draggedCards, sourceColumn);
        }
        clearSelection();
      } else {
        draggedCard.classList.remove("dragging");
        if (insertBefore) {
          column.insertBefore(draggedCard, insertBefore);
        } else {
          column.appendChild(draggedCard);
        }
        const afterBookmarkId = getAfterBookmarkId(draggedCard);
        const newIndex = getCardIndex(draggedCard);
        const positionChanged = column !== sourceColumn || newIndex !== sourceIndex;
        if (positionChanged) {
          const bookmarkId = draggedCard.dataset.bookmarkId;
          const newCollectionId = column.dataset.collectionId || "";
          moveBookmark(bookmarkId, newCollectionId, afterBookmarkId, draggedCard, sourceColumn, sourceIndex);
        }
      }
      updateColumnCounts();
    }
    function bulkMoveBookmarksWithPosition(bookmarkIds, collectionId, afterBookmarkId) {
      bulkMoveBookmarksAPI(bookmarkIds, collectionId, {
        afterBookmarkId,
        onSuccess: () => {
          announceCount(bookmarkIds.length, "moved", "bookmark");
        },
        onError: () => {
          revertCardsToOriginalPositions();
        }
      });
    }
    function revertCardsToOriginalPositions() {
      dragState.sourcePositions.forEach(({ card, column, nextSibling }) => {
        if (nextSibling && nextSibling.parentNode === column) {
          column.insertBefore(card, nextSibling);
        } else {
          column.appendChild(card);
        }
      });
      updateColumnCounts();
    }
    function startKeyboardDrag(card) {
      const column = card.closest(".kanban-column-content");
      keyboardDragState.isActive = true;
      keyboardDragState.card = card;
      keyboardDragState.originalColumn = column;
      keyboardDragState.originalNextSibling = card.nextElementSibling;
      keyboardDragState.originalIndex = Array.from(
        column.querySelectorAll(".kanban-card")
      ).indexOf(card);
      card.classList.add("keyboard-dragging");
      card.setAttribute("aria-grabbed", "true");
      column.classList.add("keyboard-drop-target");
      const title = getCardTitle(card);
      announce(
        `Grabbed ${title}. Use arrow keys to move, Enter or Space to drop, Escape to cancel.`
      );
    }
    function endKeyboardDrag(cancelled = false) {
      if (!keyboardDragState.isActive) return;
      const { card, originalColumn, originalNextSibling } = keyboardDragState;
      const currentColumn = card.closest(".kanban-column-content");
      const title = getCardTitle(card);
      if (cancelled) {
        if (originalNextSibling) {
          originalColumn.insertBefore(card, originalNextSibling);
        } else {
          originalColumn.appendChild(card);
        }
        announce(`Move cancelled. ${title} returned to original position.`);
      } else {
        const columnName = getColumnName(currentColumn.closest(".kanban-column"));
        const position = getCardPosition(card);
        const currentIndex = getCardIndex(card);
        const positionChanged = currentColumn !== originalColumn || currentIndex !== keyboardDragState.originalIndex;
        if (positionChanged) {
          const bookmarkId = card.dataset.bookmarkId;
          const newCollectionId = currentColumn.dataset.collectionId || "";
          const afterBookmarkId = getAfterBookmarkId(card);
          moveBookmark(
            bookmarkId,
            newCollectionId,
            afterBookmarkId,
            card,
            originalColumn,
            keyboardDragState.originalIndex
          );
        }
        announce(
          `${title} dropped in ${columnName} at position ${position.index} of ${position.total}.`
        );
      }
      card.classList.remove("keyboard-dragging");
      card.setAttribute("aria-grabbed", "false");
      document.querySelectorAll(".keyboard-drop-target").forEach((el) => {
        el.classList.remove("keyboard-drop-target");
      });
      updateColumnCounts();
      resetKeyboardDragState();
      card.focus();
    }
    function moveCardUp(card) {
      const prev = card.previousElementSibling;
      if (prev && prev.classList.contains("kanban-card")) {
        card.parentNode.insertBefore(card, prev);
        const position = getCardPosition(card);
        announce(`Moved to position ${position.index} of ${position.total}`);
        card.focus();
      } else {
        announce("Already at top of column");
      }
    }
    function moveCardDown(card) {
      const next = card.nextElementSibling;
      if (next && next.classList.contains("kanban-card")) {
        card.parentNode.insertBefore(next, card);
        const position = getCardPosition(card);
        announce(`Moved to position ${position.index} of ${position.total}`);
        card.focus();
      } else {
        announce("Already at bottom of column");
      }
    }
    function moveCardToColumn(card, direction) {
      const currentColumnEl = card.closest(".kanban-column");
      const columns = Array.from(
        document.querySelectorAll(".kanban-column:not(.kanban-new-column)")
      );
      const currentIndex = columns.indexOf(currentColumnEl);
      const targetIndex = currentIndex + direction;
      if (targetIndex < 0 || targetIndex >= columns.length) {
        announce(direction < 0 ? "Already in first column" : "Already in last column");
        return;
      }
      const targetColumnEl = columns[targetIndex];
      const targetContent = targetColumnEl.querySelector(".kanban-column-content");
      const currentContent = currentColumnEl.querySelector(".kanban-column-content");
      const currentCards = Array.from(currentContent.querySelectorAll(".kanban-card"));
      const currentPos = currentCards.indexOf(card);
      const emptyState = targetContent.querySelector(".kanban-empty");
      if (emptyState) {
        emptyState.remove();
      }
      const targetCards = Array.from(targetContent.querySelectorAll(".kanban-card"));
      const targetPos = Math.min(currentPos, targetCards.length);
      if (targetPos < targetCards.length) {
        targetContent.insertBefore(card, targetCards[targetPos]);
      } else {
        targetContent.appendChild(card);
      }
      currentContent.classList.remove("keyboard-drop-target");
      targetContent.classList.add("keyboard-drop-target");
      const columnName = getColumnName(targetColumnEl);
      const position = getCardPosition(card);
      announce(`Moved to ${columnName}, position ${position.index} of ${position.total}`);
      card.focus();
    }
    function moveCardToTop(card) {
      const column = getColumnContent(card);
      const firstCard = column.querySelector(".kanban-card");
      if (firstCard && firstCard !== card) {
        column.insertBefore(card, firstCard);
        announcePosition(card, "Moved to top");
        scrollCardIntoView(card);
      }
    }
    function moveCardToBottom(card) {
      const column = getColumnContent(card);
      column.appendChild(card);
      announcePosition(card, "Moved to bottom");
      scrollCardIntoView(card);
    }
    function announcePosition(card, prefix) {
      const position = getCardPosition(card);
      announce(`${prefix}, position ${position.index} of ${position.total}`);
    }
    function scrollCardIntoView(card) {
      if (!card) return;
      card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      const column = card.closest(".kanban-column");
      if (column) {
        const board = document.getElementById("kanban-board");
        if (board) {
          const columnRect = column.getBoundingClientRect();
          const boardRect = board.getBoundingClientRect();
          if (columnRect.left < boardRect.left) {
            board.scrollLeft -= boardRect.left - columnRect.left + 20;
          } else if (columnRect.right > boardRect.right) {
            board.scrollLeft += columnRect.right - boardRect.right + 20;
          }
        }
      }
    }
    function getAllColumns() {
      return Array.from(
        document.querySelectorAll(".kanban-column:not(.kanban-new-column)")
      );
    }
    function getCardsInColumn(column) {
      const content = column.querySelector(".kanban-column-content");
      if (!content) return [];
      return Array.from(content.querySelectorAll(".kanban-card"));
    }
    function focusCardInDirection(card, direction) {
      const column = card.closest(".kanban-column");
      const cards = getCardsInColumn(column);
      const currentIndex = cards.indexOf(card);
      const targetIndex = currentIndex + direction;
      if (targetIndex >= 0 && targetIndex < cards.length) {
        const targetCard = cards[targetIndex];
        targetCard.focus();
        scrollCardIntoView(targetCard);
        return true;
      }
      return false;
    }
    function focusCardInAdjacentColumn(card, direction) {
      const columns = getAllColumns();
      const currentColumn = card.closest(".kanban-column");
      const currentColumnIndex = columns.indexOf(currentColumn);
      const targetColumnIndex = currentColumnIndex + direction;
      if (targetColumnIndex < 0 || targetColumnIndex >= columns.length) {
        return false;
      }
      const targetColumn = columns[targetColumnIndex];
      const currentCards = getCardsInColumn(currentColumn);
      const targetCards = getCardsInColumn(targetColumn);
      if (targetCards.length === 0) {
        return false;
      }
      const currentIndex = currentCards.indexOf(card);
      const targetIndex = Math.min(currentIndex, targetCards.length - 1);
      const targetCard = targetCards[targetIndex];
      targetCard.focus();
      scrollCardIntoView(targetCard);
      return true;
    }
    function focusFirstCard() {
      const columns = getAllColumns();
      for (const column of columns) {
        const cards = getCardsInColumn(column);
        if (cards.length > 0) {
          cards[0].focus();
          scrollCardIntoView(cards[0]);
          return true;
        }
      }
      return false;
    }
    function focusLastCard() {
      const columns = getAllColumns();
      for (let i2 = columns.length - 1; i2 >= 0; i2--) {
        const cards = getCardsInColumn(columns[i2]);
        if (cards.length > 0) {
          const lastCard = cards[cards.length - 1];
          lastCard.focus();
          scrollCardIntoView(lastCard);
          return true;
        }
      }
      return false;
    }
    function triggerEditAction(card) {
      const editBtn = card.querySelector('[hx-get*="/edit-drawer"]');
      if (editBtn) {
        editBtn.click();
      }
    }
    function triggerOpenUrl(card) {
      const openUrlLink = card.querySelector('a[target="_blank"]');
      if (openUrlLink) {
        window.open(openUrlLink.href, "_blank", "noopener,noreferrer");
      }
    }
    function triggerDeleteAction(card) {
      const deleteBtn = card.querySelector("[hx-delete]");
      if (deleteBtn) {
        deleteBtn.click();
      }
    }
    function toggleHelpModal() {
      const modal = document.getElementById("kanban-help-modal");
      if (!modal) return;
      const isHidden = modal.classList.contains("hidden");
      if (isHidden) {
        modal.classList.remove("hidden");
        const closeBtn = modal.querySelector("[data-close-modal]");
        if (closeBtn) closeBtn.focus();
      } else {
        modal.classList.add("hidden");
        const firstCard = document.querySelector(".kanban-card");
        if (firstCard) firstCard.focus();
      }
    }
    function closeHelpModal() {
      const modal = document.getElementById("kanban-help-modal");
      if (modal && !modal.classList.contains("hidden")) {
        modal.classList.add("hidden");
        const firstCard = document.querySelector(".kanban-card");
        if (firstCard) firstCard.focus();
      }
    }
    function handleCardKeydown(e) {
      const card = e.target.closest(".kanban-card");
      if (!card) return;
      const isOnCard = e.target === card;
      const isOnDragHandle = e.target.closest(".kanban-card-drag-handle");
      const isOnInteractiveElement = !isOnCard && !isOnDragHandle;
      const isGrabbed = keyboardDragState.isActive && keyboardDragState.card === card;
      const hasModifier = e.metaKey || e.ctrlKey;
      const hasMultiSelection = selectionState.selectedIds.size > 1;
      switch (e.key) {
        case " ":
        case "Enter":
          if (isOnInteractiveElement) return;
          e.preventDefault();
          isGrabbed ? endKeyboardDrag(false) : startKeyboardDrag(card);
          break;
        case "ArrowUp":
          e.preventDefault();
          if (hasModifier) {
            isGrabbed ? moveCardToTop(card) : focusFirstCard();
          } else if (e.shiftKey && !isGrabbed) {
            extendSelectionInDirection(card, -1);
          } else if (isGrabbed) {
            moveCardUp(card);
            scrollCardIntoView(card);
          } else {
            focusCardInDirection(card, -1);
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          if (hasModifier) {
            isGrabbed ? moveCardToBottom(card) : focusLastCard();
          } else if (e.shiftKey && !isGrabbed) {
            extendSelectionInDirection(card, 1);
          } else if (isGrabbed) {
            moveCardDown(card);
            scrollCardIntoView(card);
          } else {
            focusCardInDirection(card, 1);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          isGrabbed ? moveCardToColumn(card, -1) : focusCardInAdjacentColumn(card, -1);
          if (isGrabbed) scrollCardIntoView(card);
          break;
        case "ArrowRight":
          e.preventDefault();
          isGrabbed ? moveCardToColumn(card, 1) : focusCardInAdjacentColumn(card, 1);
          if (isGrabbed) scrollCardIntoView(card);
          break;
        case "Home":
          e.preventDefault();
          if (isGrabbed && hasModifier) {
            moveCardToTop(card);
          } else if (!isGrabbed) {
            focusFirstCard();
          }
          break;
        case "End":
          e.preventDefault();
          if (isGrabbed && hasModifier) {
            moveCardToBottom(card);
          } else if (!isGrabbed) {
            focusLastCard();
          }
          break;
        case "Escape":
          if (isGrabbed) {
            e.preventDefault();
            endKeyboardDrag(true);
          } else if (selectionState.selectedIds.size > 0) {
            e.preventDefault();
            clearSelection();
            announce("Selection cleared");
          }
          break;
        case "a":
        case "A":
          if (hasModifier && !isGrabbed && isOnCard) {
            e.preventDefault();
            selectAllInColumn(card);
          }
          break;
        case "e":
        case "E":
          if (!isGrabbed && isOnCard) {
            e.preventDefault();
            triggerEditAction(card);
          }
          break;
        case "o":
        case "O":
          if (!isGrabbed && isOnCard) {
            e.preventDefault();
            triggerOpenUrl(card);
          }
          break;
        case "Delete":
        case "Backspace":
          if (!isGrabbed && isOnCard) {
            e.preventDefault();
            hasMultiSelection ? handleBulkDelete() : triggerDeleteAction(card);
          }
          break;
        case "m":
        case "M":
          if (!isGrabbed && hasMultiSelection) {
            e.preventDefault();
            openMoveMenu();
          }
          break;
      }
    }
    function getAfterBookmarkId(card) {
      const prevSibling = card.previousElementSibling;
      if (prevSibling && prevSibling.classList.contains("kanban-card")) {
        return prevSibling.dataset.bookmarkId || "";
      }
      return "";
    }
    function moveBookmark(bookmarkId, collectionId, afterBookmarkId, item, fromColumn, oldIndex) {
      const url = `/admin/htmx/bookmarks/${bookmarkId}/collection`;
      const csrfToken = getCSRFToken();
      let body = `collection_id=${encodeURIComponent(collectionId)}`;
      if (afterBookmarkId) {
        body += `&after_id=${encodeURIComponent(afterBookmarkId)}`;
      }
      fetch(url, {
        method: "POST",
        headers: {
          "X-CSRF-Token": csrfToken,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      }).then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to move bookmark: ${response.status}`);
        }
        updateColumnCounts();
        showMoveSuccess(item);
      }).catch((error) => {
        console.error("[Kanban] Error moving bookmark:", error);
        revertMove(item, fromColumn, oldIndex);
        updateColumnCounts();
        showErrorToast("Failed to move bookmark. Please try again.");
      });
    }
    function revertMove(item, fromColumn, oldIndex) {
      const children = Array.from(fromColumn.querySelectorAll(".kanban-card"));
      if (oldIndex >= children.length) {
        fromColumn.appendChild(item);
      } else {
        fromColumn.insertBefore(item, children[oldIndex]);
      }
    }
    function updateColumnCounts() {
      const columns = document.querySelectorAll(".kanban-column");
      columns.forEach((column) => {
        const content = column.querySelector(".kanban-column-content");
        const countEl = column.querySelector(".kanban-column-count");
        if (content && countEl) {
          const cards = content.querySelectorAll(".kanban-card");
          countEl.textContent = cards.length.toString();
          const emptyState = content.querySelector(".kanban-empty");
          if (cards.length === 0 && !emptyState) {
            const isUnsorted = column.dataset.unsorted === "true";
            const emptyDiv = document.createElement("div");
            emptyDiv.className = "kanban-empty";
            emptyDiv.innerHTML = `<p class="kanban-empty-text">${isUnsorted ? "No unsorted bookmarks" : "Drop bookmarks here"}</p>`;
            content.appendChild(emptyDiv);
          } else if (cards.length > 0 && emptyState) {
            emptyState.remove();
          }
        }
      });
    }
    function showMoveSuccess(item) {
      item.classList.add("bg-green-50");
      setTimeout(() => {
        item.classList.remove("bg-green-50");
      }, 500);
    }
    function handleBulkDelete() {
      const count = selectionState.selectedIds.size;
      if (count === 0) return;
      const confirmed = confirm(`Are you sure you want to delete ${count} ${pluralize(count, "bookmark")}?`);
      if (!confirmed) return;
      const bookmarkIds = getSelectedBookmarkIds();
      const csrfToken = getCSRFToken();
      fetch("/admin/htmx/bookmarks/bulk/delete", {
        method: "DELETE",
        headers: {
          "X-CSRF-Token": csrfToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ bookmark_ids: bookmarkIds })
      }).then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to delete bookmarks: ${response.status}`);
        }
        bookmarkIds.forEach((id) => {
          const card = getCardById(id);
          if (card) card.remove();
        });
        clearSelection();
        updateColumnCounts();
        announceCount(count, "deleted", "bookmark");
      }).catch((error) => {
        console.error("[Kanban] Error deleting bookmarks:", error);
        showErrorToast("Failed to delete bookmarks. Please try again.");
      });
    }
    function handleBulkMove(collectionId) {
      const count = selectionState.selectedIds.size;
      if (count === 0) return;
      const bookmarkIds = getSelectedBookmarkIds();
      bulkMoveBookmarksAPI(bookmarkIds, collectionId, {
        onSuccess: () => {
          const targetColumn = collectionId === "" ? document.querySelector('.kanban-column[data-unsorted="true"] .kanban-column-content') : document.querySelector(`.kanban-column[data-collection-id="${collectionId}"] .kanban-column-content`);
          if (targetColumn) {
            const emptyState = targetColumn.querySelector(".kanban-empty");
            if (emptyState) emptyState.remove();
            bookmarkIds.forEach((id) => {
              const card = getCardById(id);
              if (card) {
                targetColumn.appendChild(card);
              }
            });
          }
          clearSelection();
          updateColumnCounts();
          announceCount(count, "moved", "bookmark");
        }
      });
    }
    function handleGlobalKeydown(e) {
      if (moveMenuState.isOpen) {
        handleMoveMenuKeydown(e);
        return;
      }
      if (e.key === "?" && !e.target.closest("input, textarea, select")) {
        e.preventDefault();
        toggleHelpModal();
        return;
      }
      if (e.key === "Escape") {
        const modal = document.getElementById("kanban-help-modal");
        if (modal && !modal.classList.contains("hidden")) {
          e.preventDefault();
          closeHelpModal();
          return;
        }
      }
    }
    function init4() {
      const board = document.getElementById("kanban-board");
      if (!board) return;
      board.addEventListener("dragstart", handleDragStart);
      board.addEventListener("dragend", handleDragEnd);
      board.addEventListener("dragover", handleDragOver);
      board.addEventListener("dragenter", handleDragEnter);
      board.addEventListener("dragleave", handleDragLeave);
      board.addEventListener("drop", handleDrop);
      board.addEventListener("keydown", handleCardKeydown);
      board.addEventListener("click", handleCardClick);
      document.addEventListener("click", handleBoardClick);
      document.addEventListener("keydown", handleGlobalKeydown);
      const helpModal = document.getElementById("kanban-help-modal");
      if (helpModal) {
        helpModal.addEventListener("click", (e) => {
          if (e.target === helpModal) {
            closeHelpModal();
          }
        });
        const closeBtn = helpModal.querySelector("[data-close-modal]");
        if (closeBtn) {
          closeBtn.addEventListener("click", closeHelpModal);
        }
      }
      initSelectionToolbar();
      const moveMenuBackdrop = document.getElementById("kanban-move-menu-backdrop");
      if (moveMenuBackdrop) {
        moveMenuBackdrop.addEventListener("click", handleMoveMenuBackdropClick);
      }
      document.body.addEventListener("htmx:afterSwap", handleAfterSwap);
    }
    function initSelectionToolbar() {
      const toolbar = document.getElementById("kanban-selection-toolbar");
      if (!toolbar) return;
      const clearBtn = toolbar.querySelector(".clear-selection");
      if (clearBtn) {
        clearBtn.addEventListener("click", clearSelection);
      }
      const deleteBtn = toolbar.querySelector(".delete-selected");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", handleBulkDelete);
      }
      const moveDropdown = toolbar.querySelector("[data-selection-move-dropdown]");
      if (moveDropdown) {
        const trigger = moveDropdown.querySelector("[data-selection-move-trigger]");
        const menu = moveDropdown.querySelector("[data-selection-move-menu]");
        if (trigger && menu) {
          trigger.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = menu.classList.contains("open");
            if (isOpen) {
              menu.classList.remove("open");
              trigger.setAttribute("aria-expanded", "false");
            } else {
              menu.classList.add("open");
              trigger.setAttribute("aria-expanded", "true");
            }
          });
          menu.querySelectorAll("[data-move-collection-id]").forEach((option) => {
            option.addEventListener("click", () => {
              const collectionId = option.dataset.moveCollectionId;
              handleBulkMove(collectionId);
              menu.classList.remove("open");
              trigger.setAttribute("aria-expanded", "false");
            });
          });
          document.addEventListener("click", (e) => {
            if (!moveDropdown.contains(e.target)) {
              menu.classList.remove("open");
              trigger.setAttribute("aria-expanded", "false");
            }
          });
        }
      }
    }
    function handleAfterSwap(evt) {
      if (evt.detail.target.id === "kanban-board" || evt.detail.target.id === "bookmarks-content") {
        cleanup();
        init4();
      }
    }
    function cleanup() {
      const board = document.getElementById("kanban-board");
      if (board) {
        board.removeEventListener("dragstart", handleDragStart);
        board.removeEventListener("dragend", handleDragEnd);
        board.removeEventListener("dragover", handleDragOver);
        board.removeEventListener("dragenter", handleDragEnter);
        board.removeEventListener("dragleave", handleDragLeave);
        board.removeEventListener("drop", handleDrop);
        board.removeEventListener("keydown", handleCardKeydown);
        board.removeEventListener("click", handleCardClick);
      }
      document.removeEventListener("keydown", handleGlobalKeydown);
      document.removeEventListener("click", handleBoardClick);
      closeHelpModal();
      clearSelection();
      if (keyboardDragState.isActive) {
        endKeyboardDrag(true);
      }
      stopAutoScroll();
      removePlaceholder();
      removeAllDragOverClasses();
      dragState.isDragging = false;
      dragState.draggedCard = null;
      dragState.sourceColumn = null;
      dragState.sourceIndex = null;
      dragState.placeholder = null;
    }
    window.kanban = {
      init: init4,
      cleanup,
      announce
    };
    document.addEventListener("DOMContentLoaded", init4);
  })();

  // web/static/js/src/components/ec-toast-container.js
  var EcToastContainer = class _EcToastContainer extends HTMLElement {
    // ============================================
    // CONFIGURATION
    // ============================================
    static CONFIG = {
      /** Auto-dismiss delay in milliseconds */
      DISMISS_DELAY: 3e3,
      /** Exit animation duration in milliseconds */
      EXIT_ANIMATION_DURATION: 200,
      /** Request timeout for inline content areas */
      RETRY_TIMEOUT: 1e4
    };
    static ICONS = {
      error: '<span class="toast-icon" aria-hidden="true">&#x2717;</span>',
      success: '<span class="toast-icon" aria-hidden="true">&#x2713;</span>',
      warning: '<span class="toast-icon" aria-hidden="true">&#x26A0;</span>',
      info: '<span class="toast-icon" aria-hidden="true">&#x2139;</span>'
    };
    // ============================================
    // PRIVATE STATE
    // ============================================
    #abortController = null;
    #requestTimeouts = /* @__PURE__ */ new WeakMap();
    // ============================================
    // LIFECYCLE
    // ============================================
    connectedCallback() {
      this.setAttribute("role", "status");
      this.setAttribute("aria-live", "polite");
      this.setAttribute("aria-label", "Notifications");
      this.#abortController = new AbortController();
      this.#setupHtmxHandlers(this.#abortController.signal);
      window.Toast = this;
    }
    disconnectedCallback() {
      this.#abortController?.abort();
      if (window.Toast === this) {
        window.Toast = null;
      }
    }
    // ============================================
    // PUBLIC API
    // ============================================
    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} [type='error'] - Toast type: error, success, warning, info
     * @returns {HTMLElement} The toast element
     */
    show(message, type = "error") {
      const toast = document.createElement("div");
      toast.className = `toast toast-${type}`;
      toast.setAttribute("role", "alert");
      toast.setAttribute("aria-live", "polite");
      const icon = _EcToastContainer.ICONS[type] || _EcToastContainer.ICONS.error;
      toast.innerHTML = `${icon} ${this.#escapeHtml(message)}`;
      toast.addEventListener("click", () => this.dismiss(toast));
      this.appendChild(toast);
      setTimeout(
        () => this.dismiss(toast),
        _EcToastContainer.CONFIG.DISMISS_DELAY
      );
      return toast;
    }
    /**
     * Dismiss a toast with animation
     * @param {HTMLElement} toast - The toast element to dismiss
     */
    dismiss(toast) {
      if (!toast || toast.classList.contains("toast-exit")) {
        return;
      }
      toast.classList.add("toast-exit");
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, _EcToastContainer.CONFIG.EXIT_ANIMATION_DURATION);
    }
    // Convenience methods
    error(msg) {
      return this.show(msg, "error");
    }
    success(msg) {
      return this.show(msg, "success");
    }
    warning(msg) {
      return this.show(msg, "warning");
    }
    info(msg) {
      return this.show(msg, "info");
    }
    // ============================================
    // PRIVATE METHODS
    // ============================================
    /**
     * Escape HTML to prevent XSS
     * @param {string} text
     * @returns {string}
     */
    #escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }
    /**
     * Generate inline spinner HTML
     * @returns {string}
     */
    #inlineSpinnerHtml() {
      return `
      <div class="flex items-center justify-center py-4 text-muted-foreground">
        <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
        </svg>
      </div>
    `;
    }
    /**
     * Generate inline error HTML for network errors
     * @param {string} message - Error message
     * @param {string} retryUrl - URL to retry
     * @returns {string}
     */
    #inlineErrorHtml(message, retryUrl) {
      return `
      <div class="flex items-center justify-center gap-2 py-4 text-sm text-destructive" data-inline-error>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" x2="12" y1="8" y2="12"></line>
          <line x1="12" x2="12.01" y1="16" y2="16"></line>
        </svg>
        <span>${this.#escapeHtml(message)}</span>
        <button type="button" class="btn-ghost btn-sm" data-retry-url="${this.#escapeHtml(retryUrl)}">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
            <path d="M21 3v5h-5"></path>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
            <path d="M8 16H3v5"></path>
          </svg>
        </button>
      </div>
    `;
    }
    /**
     * Find the container for inline error display
     * @param {HTMLElement} element
     * @returns {HTMLElement|null}
     */
    #findErrorContainer(element) {
      const inlineError = element.closest("[data-inline-error]");
      if (inlineError) {
        const container = inlineError.closest('[hx-get][hx-swap="innerHTML"]');
        if (container) return container;
      }
      const swapAttr = element.getAttribute("hx-swap");
      if (swapAttr && swapAttr.includes("innerHTML")) {
        return element;
      }
      return null;
    }
    /**
     * Setup HTMX event handlers
     * @param {AbortSignal} signal
     */
    #setupHtmxHandlers(signal) {
      document.body.addEventListener(
        "htmx:beforeRequest",
        (event) => {
          const target = event.detail.elt;
          const swapAttr = target.getAttribute("hx-swap");
          const retryUrl = target.getAttribute("hx-get");
          if (swapAttr && swapAttr.includes("innerHTML") && retryUrl) {
            const timeoutId = setTimeout(() => {
              if (event.detail.xhr) {
                event.detail.xhr.abort();
              }
              target.innerHTML = this.#inlineErrorHtml(
                "Request timed out",
                retryUrl
              );
            }, _EcToastContainer.CONFIG.RETRY_TIMEOUT);
            this.#requestTimeouts.set(target, timeoutId);
          }
        },
        { signal }
      );
      document.body.addEventListener(
        "htmx:afterRequest",
        (event) => {
          const target = event.detail.elt;
          const timeoutId = this.#requestTimeouts.get(target);
          if (timeoutId) {
            clearTimeout(timeoutId);
            this.#requestTimeouts.delete(target);
          }
        },
        { signal }
      );
      document.body.addEventListener(
        "htmx:responseError",
        (event) => {
          const target = event.detail.elt;
          const swapAttr = target.getAttribute("hx-swap");
          if (swapAttr && swapAttr.includes("innerHTML")) {
            return;
          }
          this.show("Failed to save", "error");
        },
        { signal }
      );
      document.body.addEventListener(
        "htmx:sendError",
        (event) => {
          const target = event.detail.elt;
          const container = this.#findErrorContainer(target);
          const retryUrl = target.getAttribute("hx-get") || target.getAttribute("data-retry-url");
          if (container && retryUrl) {
            container.innerHTML = this.#inlineErrorHtml(
              "Connection error",
              retryUrl
            );
          } else {
            this.show("Connection error", "error");
          }
        },
        { signal }
      );
      document.body.addEventListener(
        "click",
        (event) => {
          const retryBtn = event.target.closest("[data-retry-url]");
          if (!retryBtn) return;
          const retryUrl = retryBtn.getAttribute("data-retry-url");
          const container = retryBtn.closest('[hx-get][hx-swap="innerHTML"]');
          if (container && retryUrl) {
            container.innerHTML = this.#inlineSpinnerHtml();
            const timeoutId = setTimeout(() => {
              container.innerHTML = this.#inlineErrorHtml(
                "Request timed out",
                retryUrl
              );
            }, _EcToastContainer.CONFIG.RETRY_TIMEOUT);
            htmx.ajax("GET", retryUrl, { target: container, swap: "innerHTML" }).then(() => {
              clearTimeout(timeoutId);
            }).catch(() => {
              clearTimeout(timeoutId);
              container.innerHTML = this.#inlineErrorHtml(
                "Connection error",
                retryUrl
              );
            });
          }
        },
        { signal }
      );
    }
  };
  customElements.define("ec-toast-container", EcToastContainer);
  window.EcToastContainer = EcToastContainer;

  // web/static/js/src/components/ec-dropdown.js
  var CONFIG3 = {
    /** Maximum height of dropdown menu in pixels */
    DEFAULT_MAX_HEIGHT: 240,
    /** Minimum height to ensure dropdown is usable */
    MIN_HEIGHT: 100,
    /** Margin from viewport edge in pixels */
    VIEWPORT_MARGIN: 4,
    /** Gap between trigger and menu in pixels */
    TRIGGER_GAP: 2,
    /** Z-index for dropdown menu */
    Z_INDEX: 100
  };
  var dropdownRegistry = /* @__PURE__ */ new Map();
  var EcDropdown = class extends HTMLElement {
    // Private state
    #abortController = null;
    #scrollAbortController = null;
    #isOpen = false;
    // Element references
    #trigger = null;
    #menu = null;
    #input = null;
    #labelEl = null;
    #options = [];
    #portal = null;
    #menuOriginalParent = null;
    // ============================================
    // LIFECYCLE
    // ============================================
    connectedCallback() {
      this.#trigger = this.querySelector("[data-trigger]");
      this.#menu = this.querySelector("[data-menu]");
      this.#input = this.querySelector('input[type="hidden"]');
      this.#labelEl = this.querySelector("[data-label]");
      this.#options = [...this.querySelectorAll("[data-option]")];
      this.#portal = document.getElementById("dropdown-portal");
      if (!this.#trigger || !this.#menu) {
        console.warn("ec-dropdown: Missing [data-trigger] or [data-menu]", this);
        return;
      }
      this.#abortController = new AbortController();
      const { signal } = this.#abortController;
      this.#initAria();
      this.#setupListeners(signal);
      this.#moveToPortal();
      const id = this.#input?.id;
      if (id) {
        dropdownRegistry.set(id, this);
      }
    }
    disconnectedCallback() {
      this.#abortController?.abort();
      this.#scrollAbortController?.abort();
      this.#restoreFromPortal();
      if (this.#isOpen) {
        this.#isOpen = false;
      }
      const id = this.#input?.id;
      if (id) {
        dropdownRegistry.delete(id);
      }
    }
    // ============================================
    // INITIALIZATION
    // ============================================
    #initAria() {
      const baseId = this.#input?.id || `dropdown-${Date.now()}`;
      const menuId = `${baseId}-listbox`;
      this.#trigger.setAttribute("aria-haspopup", "listbox");
      this.#trigger.setAttribute("aria-controls", menuId);
      this.#trigger.setAttribute("aria-expanded", "false");
      this.#menu.setAttribute("role", "listbox");
      this.#menu.setAttribute("id", menuId);
      this.#menu.setAttribute("tabindex", "-1");
      this.#options.forEach((opt, index) => {
        const optionId = `${baseId}-option-${index}`;
        opt.setAttribute("role", "option");
        opt.setAttribute("id", optionId);
        const isSelected = opt.getAttribute("data-selected") === "true";
        opt.setAttribute("aria-selected", isSelected ? "true" : "false");
      });
      const selectedOption = this.#options.find(
        (o3) => o3.getAttribute("data-selected") === "true"
      );
      if (selectedOption) {
        this.#trigger.setAttribute("aria-activedescendant", selectedOption.id);
      }
    }
    #setupListeners(signal) {
      this.#trigger.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggle();
        },
        { signal }
      );
      this.#options.forEach((opt) => {
        opt.addEventListener(
          "click",
          (e) => {
            const hasHtmx = opt.hasAttribute("hx-post") || opt.hasAttribute("hx-get") || opt.hasAttribute("hx-put") || opt.hasAttribute("hx-delete") || opt.hasAttribute("hx-patch");
            if (!hasHtmx) {
              e.preventDefault();
            }
            this.select(opt, hasHtmx);
          },
          { signal }
        );
      });
      this.addEventListener("keydown", (e) => this.#handleKeydown(e), { signal });
      this.#menu.addEventListener("keydown", (e) => this.#handleKeydown(e), {
        signal
      });
      document.addEventListener(
        "click",
        (e) => {
          if (this.#isOpen && !this.contains(e.target) && !this.#menu.contains(e.target)) {
            this.close();
          }
        },
        { signal }
      );
    }
    #moveToPortal() {
      const hasHtmxOptions = this.#options.some(
        (opt) => opt.hasAttribute("hx-post") || opt.hasAttribute("hx-get") || opt.hasAttribute("hx-put") || opt.hasAttribute("hx-delete") || opt.hasAttribute("hx-patch")
      );
      if (this.#portal && this.#menu && !hasHtmxOptions) {
        this.#menuOriginalParent = this.#menu.parentElement;
        this.#menu.remove();
        this.#portal.appendChild(this.#menu);
      }
    }
    #restoreFromPortal() {
      if (this.#menu && this.#menu.parentElement === this.#portal && this.#menuOriginalParent) {
        this.#menu.remove();
        this.#menuOriginalParent.appendChild(this.#menu);
      }
    }
    // ============================================
    // PUBLIC API
    // ============================================
    toggle() {
      this.#isOpen ? this.close() : this.open();
    }
    open() {
      dropdownRegistry.forEach((dropdown) => {
        if (dropdown !== this && dropdown.isOpen) {
          dropdown.close();
        }
      });
      this.#isOpen = true;
      this.#menu.style.display = "block";
      this.#positionMenu();
      this.#trigger.setAttribute("aria-expanded", "true");
      this.#scrollAbortController = new AbortController();
      window.addEventListener(
        "scroll",
        (e) => {
          if (!this.#menu.contains(e.target)) {
            this.close();
          }
        },
        { capture: true, passive: true, signal: this.#scrollAbortController.signal }
      );
    }
    close() {
      if (!this.#isOpen) return;
      this.#isOpen = false;
      this.#menu.style.display = "none";
      this.#trigger.setAttribute("aria-expanded", "false");
      this.#scrollAbortController?.abort();
      this.#scrollAbortController = null;
    }
    /**
     * Select an option
     * @param {HTMLElement} opt - Option element to select
     * @param {boolean} isHtmx - Whether this option has HTMX attributes
     */
    select(opt, isHtmx = false) {
      if (isHtmx) {
        this.close();
        return;
      }
      const value = opt.dataset.value;
      const label = opt.textContent.trim();
      if (this.#labelEl) {
        this.#labelEl.textContent = label;
      }
      if (this.#input) {
        this.#input.value = value;
        this.#input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      this.#options.forEach((o3) => {
        o3.removeAttribute("data-selected");
        o3.setAttribute("aria-selected", "false");
      });
      opt.setAttribute("data-selected", "true");
      opt.setAttribute("aria-selected", "true");
      this.#trigger.setAttribute("aria-activedescendant", opt.id);
      this.close();
    }
    /**
     * Reset dropdown to a specific value
     * @param {string} value - Value to reset to (default: empty string)
     */
    reset(value = "") {
      const opt = this.#options.find((o3) => o3.dataset.value === value);
      if (opt) {
        if (this.#labelEl) {
          this.#labelEl.textContent = opt.textContent.trim();
        }
        this.#options.forEach((o3) => {
          o3.removeAttribute("data-selected");
          o3.setAttribute("aria-selected", "false");
        });
        opt.setAttribute("data-selected", "true");
        opt.setAttribute("aria-selected", "true");
        this.#trigger.setAttribute("aria-activedescendant", opt.id);
        if (this.#input) {
          this.#input.value = value;
        }
      }
    }
    // Getters
    get isOpen() {
      return this.#isOpen;
    }
    get value() {
      return this.#input?.value ?? "";
    }
    set value(val) {
      this.reset(val);
    }
    // ============================================
    // PRIVATE METHODS
    // ============================================
    #positionMenu() {
      const triggerRect = this.#trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - triggerRect.bottom - CONFIG3.VIEWPORT_MARGIN;
      const spaceAbove = triggerRect.top - CONFIG3.VIEWPORT_MARGIN;
      const menuMinWidth = parseInt(getComputedStyle(this.#menu).minWidth) || 0;
      const menuWidth = Math.max(triggerRect.width, menuMinWidth);
      this.#menu.style.width = `${menuWidth}px`;
      this.#menu.style.left = `${triggerRect.left}px`;
      if (spaceBelow < CONFIG3.DEFAULT_MAX_HEIGHT && spaceAbove > spaceBelow) {
        const maxHeight = Math.max(
          CONFIG3.MIN_HEIGHT,
          Math.min(CONFIG3.DEFAULT_MAX_HEIGHT, spaceAbove)
        );
        this.#menu.style.maxHeight = `${maxHeight}px`;
        this.#menu.style.top = `${triggerRect.top - Math.min(this.#menu.scrollHeight, maxHeight) - CONFIG3.TRIGGER_GAP}px`;
      } else {
        const maxHeight = Math.max(
          CONFIG3.MIN_HEIGHT,
          Math.min(CONFIG3.DEFAULT_MAX_HEIGHT, spaceBelow)
        );
        this.#menu.style.maxHeight = `${maxHeight}px`;
        this.#menu.style.top = `${triggerRect.bottom + CONFIG3.TRIGGER_GAP}px`;
      }
    }
    #handleKeydown(e) {
      switch (e.key) {
        case "Escape":
          this.close();
          this.#trigger.focus();
          break;
        case "Enter":
          if (!this.#isOpen) {
            e.preventDefault();
            this.open();
          } else {
            const focused = this.#menu.querySelector("[data-option]:focus");
            if (focused) {
              e.preventDefault();
              this.select(focused);
            }
          }
          break;
        case "ArrowDown":
        case "ArrowUp":
          if (this.#isOpen) {
            e.preventDefault();
            this.#navigateOptions(e.key === "ArrowDown" ? 1 : -1);
          }
          break;
      }
    }
    #navigateOptions(direction) {
      const items = this.#options;
      const currentIndex = items.findIndex(
        (o3) => o3 === document.activeElement || o3.getAttribute("data-selected") === "true"
      );
      let nextIndex;
      if (direction === 1) {
        nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      } else {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      }
      const nextItem = items[nextIndex];
      if (nextItem) {
        nextItem.focus();
        this.#trigger.setAttribute("aria-activedescendant", nextItem.id);
      }
    }
  };
  customElements.define("ec-dropdown", EcDropdown);
  window.EcDropdown = EcDropdown;
  window.dropdowns = dropdownRegistry;
  window.Dropdown = EcDropdown;
  window.initDropdown = (el) => {
    if (el.tagName === "EC-DROPDOWN") return el;
    console.warn(
      "initDropdown() called on non-ec-dropdown element. Migrate to <ec-dropdown>."
    );
    return null;
  };

  // web/static/js/src/components/ec-drawer.js
  var EcDrawer = class _EcDrawer extends HTMLElement {
    // ============================================
    // CONFIGURATION
    // ============================================
    static FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';
    static ANIMATION_DURATION = 200;
    // ============================================
    // PRIVATE STATE
    // ============================================
    #isOpen = false;
    #initialFormData = null;
    #previouslyFocusedElement = null;
    #abortController = null;
    #focusTrapController = null;
    // Element references
    #backdrop = null;
    #panel = null;
    #title = null;
    #content = null;
    #closeBtn = null;
    // ============================================
    // LIFECYCLE
    // ============================================
    connectedCallback() {
      this.#backdrop = this.querySelector("[data-backdrop]");
      this.#panel = this.querySelector("[data-panel]");
      this.#title = this.querySelector("[data-title]");
      this.#content = this.querySelector("[data-content]");
      this.#closeBtn = this.querySelector("[data-close]");
      if (!this.#backdrop || !this.#panel) {
        console.warn("ec-drawer: Missing [data-backdrop] or [data-panel]", this);
        return;
      }
      this.#abortController = new AbortController();
      this.#setupListeners(this.#abortController.signal);
      window.drawerOpen = this.open.bind(this);
      window.drawerClose = this.close.bind(this);
      window.drawerIsDirty = this.isDirty.bind(this);
      window.drawerIsOpen = () => this.#isOpen;
    }
    disconnectedCallback() {
      this.#abortController?.abort();
      this.#focusTrapController?.abort();
      if (window.drawerOpen === this.open.bind(this)) {
        window.drawerOpen = null;
        window.drawerClose = null;
        window.drawerIsDirty = null;
        window.drawerIsOpen = null;
      }
    }
    // ============================================
    // PUBLIC API
    // ============================================
    /**
     * Open the drawer and optionally load content via HTMX
     * @param {string} drawerTitle - Title to display in the drawer header
     * @param {string} [url] - Optional URL to fetch content from
     */
    open(drawerTitle, url) {
      if (!document.body) return;
      if (!this.#backdrop || !this.#panel) return;
      if (this.#title && drawerTitle) {
        this.#title.textContent = drawerTitle;
      }
      if (url && this.#content) {
        this.#content.innerHTML = '<div class="p-6 flex items-center justify-center"><span class="animate-spin">&#8635;</span></div>';
        htmx.ajax("GET", url, {
          target: this.#content,
          swap: "innerHTML"
        });
      }
      this.#backdrop.classList.add("open");
      this.#panel.classList.add("open");
      this.#isOpen = true;
      document.body.style.overflow = "hidden";
      this.#previouslyFocusedElement = document.activeElement;
      this.#setupFocusTrap();
      this.#panel.focus();
    }
    /**
     * Close the drawer, with optional dirty form check
     * @param {boolean} [force=false] - Skip dirty check if true
     * @returns {boolean} - Whether the drawer was closed
     */
    close(force = false) {
      if (!this.#isOpen) return true;
      if (!force && this.isDirty()) {
        const confirmed = confirm(
          "You have unsaved changes. Are you sure you want to close?"
        );
        if (!confirmed) return false;
      }
      if (!this.#backdrop || !this.#panel) return true;
      this.#backdrop.classList.remove("open");
      this.#panel.classList.remove("open");
      this.#isOpen = false;
      document.body.style.overflow = "";
      this.#removeFocusTrap();
      if (this.#previouslyFocusedElement && typeof this.#previouslyFocusedElement.focus === "function") {
        this.#previouslyFocusedElement.focus();
      }
      this.#previouslyFocusedElement = null;
      setTimeout(() => {
        if (this.#content) this.#content.innerHTML = "";
        this.#initialFormData = null;
      }, _EcDrawer.ANIMATION_DURATION);
      return true;
    }
    /**
     * Check if the form has unsaved changes
     * @returns {boolean}
     */
    isDirty() {
      if (!this.#content || !this.#initialFormData) return false;
      const form = this.#content.querySelector("form");
      if (!form) return false;
      const currentData = this.#serializeForm(form);
      return this.#initialFormData !== currentData;
    }
    /**
     * Check if drawer is currently open
     * @returns {boolean}
     */
    get isOpen() {
      return this.#isOpen;
    }
    // ============================================
    // PRIVATE METHODS
    // ============================================
    /**
     * Setup event listeners
     * @param {AbortSignal} signal
     */
    #setupListeners(signal) {
      this.#backdrop?.addEventListener(
        "click",
        () => this.close(),
        { signal }
      );
      this.#closeBtn?.addEventListener(
        "click",
        () => this.close(),
        { signal }
      );
      document.addEventListener(
        "keydown",
        (e) => {
          if (e.key === "Escape" && this.#isOpen) {
            this.close();
          }
        },
        { signal }
      );
      document.addEventListener(
        "htmx:afterSwap",
        (e) => {
          if (e.detail.target === this.#content) {
            setTimeout(() => {
              this.#captureFormState();
              if (this.#isOpen && this.#panel) {
                const firstFocusable = this.#panel.querySelector(
                  _EcDrawer.FOCUSABLE_SELECTOR
                );
                if (firstFocusable) {
                  firstFocusable.focus();
                }
              }
            }, 50);
          }
        },
        { signal }
      );
      document.addEventListener(
        "closeDrawer",
        () => this.close(true),
        { signal }
      );
    }
    /**
     * Set up focus trap within the drawer panel
     */
    #setupFocusTrap() {
      this.#focusTrapController = new AbortController();
      const { signal } = this.#focusTrapController;
      document.addEventListener(
        "keydown",
        (e) => {
          if (e.key !== "Tab" || !this.#isOpen) return;
          const focusableElements = this.#panel.querySelectorAll(
            _EcDrawer.FOCUSABLE_SELECTOR
          );
          if (focusableElements.length === 0) return;
          const firstFocusable = focusableElements[0];
          const lastFocusable = focusableElements[focusableElements.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === firstFocusable || document.activeElement === this.#panel) {
              e.preventDefault();
              lastFocusable.focus();
            }
          } else {
            if (document.activeElement === lastFocusable) {
              e.preventDefault();
              firstFocusable.focus();
            }
          }
        },
        { signal }
      );
    }
    /**
     * Remove focus trap handler
     */
    #removeFocusTrap() {
      this.#focusTrapController?.abort();
      this.#focusTrapController = null;
    }
    /**
     * Capture initial form state for dirty tracking
     */
    #captureFormState() {
      if (!this.#content) return;
      const form = this.#content.querySelector("form");
      if (!form) return;
      this.#initialFormData = this.#serializeForm(form);
    }
    /**
     * Serialize form data to a string for comparison
     * @param {HTMLFormElement} form
     * @returns {string}
     */
    #serializeForm(form) {
      const formData = new FormData(form);
      const entries = [];
      for (const [key, value] of formData.entries()) {
        if (key === "csrf_token") continue;
        entries.push(`${key}=${value}`);
      }
      return entries.sort().join("&");
    }
  };
  customElements.define("ec-drawer", EcDrawer);
  window.EcDrawer = EcDrawer;

  // web/static/js/src/components/ec-tag-select.js
  var EcTagSelect = class _EcTagSelect extends HTMLElement {
    // ============================================
    // CONFIGURATION
    // ============================================
    static CREATE_TAG_ENDPOINT = "/admin/tags/create-inline";
    static DEFAULT_PLACEHOLDER = "Select tags...";
    // ============================================
    // PRIVATE STATE
    // ============================================
    #isOpen = false;
    #abortController = null;
    // Element references
    #trigger = null;
    #dropdown = null;
    #filterInput = null;
    #optionsContainer = null;
    #chipsContainer = null;
    #placeholder = null;
    #createSection = null;
    #createBtn = null;
    #createNameSpan = null;
    // ============================================
    // LIFECYCLE
    // ============================================
    connectedCallback() {
      this.#trigger = this.querySelector("[data-trigger]");
      this.#dropdown = this.querySelector("[data-dropdown]");
      this.#filterInput = this.querySelector("[data-filter]");
      this.#optionsContainer = this.querySelector("[data-options]");
      this.#chipsContainer = this.querySelector("[data-chips]");
      this.#placeholder = this.querySelector("[data-placeholder]");
      this.#createSection = this.querySelector("[data-create]");
      this.#createBtn = this.querySelector("[data-create-btn]");
      this.#createNameSpan = this.querySelector("[data-create-name]");
      if (!this.#trigger || !this.#dropdown) {
        console.warn("ec-tag-select: Missing [data-trigger] or [data-dropdown]", this);
        return;
      }
      this.#abortController = new AbortController();
      this.#setupListeners(this.#abortController.signal);
    }
    disconnectedCallback() {
      this.#abortController?.abort();
    }
    // ============================================
    // GETTERS
    // ============================================
    get fieldName() {
      return this.getAttribute("field-name") || "tag_ids";
    }
    // ============================================
    // PRIVATE METHODS
    // ============================================
    #setupListeners(signal) {
      this.#trigger.addEventListener(
        "click",
        (e) => {
          if (e.target.closest("[data-remove]")) return;
          this.#toggleDropdown();
        },
        { signal }
      );
      if (this.#chipsContainer) {
        this.#chipsContainer.addEventListener(
          "click",
          (e) => {
            const removeBtn = e.target.closest("[data-remove]");
            if (removeBtn) {
              e.stopPropagation();
              this.#removeTag(removeBtn.dataset.remove);
            }
          },
          { signal }
        );
      }
      if (this.#filterInput) {
        this.#filterInput.addEventListener(
          "input",
          (e) => this.#filterOptions(e.target.value),
          { signal }
        );
        this.#filterInput.addEventListener(
          "click",
          (e) => e.stopPropagation(),
          { signal }
        );
      }
      if (this.#optionsContainer) {
        this.#optionsContainer.addEventListener(
          "change",
          (e) => {
            if (e.target.matches('input[type="checkbox"]')) {
              this.#updateChips();
            }
          },
          { signal }
        );
      }
      if (this.#createBtn) {
        this.#createBtn.addEventListener(
          "click",
          (e) => {
            e.stopPropagation();
            const name = this.#createNameSpan?.textContent?.trim();
            if (name) {
              this.#createTag(name);
            }
          },
          { signal }
        );
      }
      document.addEventListener(
        "click",
        (e) => {
          if (this.#isOpen && !this.contains(e.target)) {
            this.#toggleDropdown(false);
          }
        },
        { signal }
      );
      this.addEventListener(
        "keydown",
        (e) => {
          if (e.key === "Escape" && this.#isOpen) {
            this.#toggleDropdown(false);
            this.#trigger.focus();
          }
          if (e.key === "Enter" && this.#filterInput === document.activeElement) {
            e.preventDefault();
            if (this.#createSection && !this.#createSection.classList.contains("hidden")) {
              const name = this.#createNameSpan?.textContent?.trim();
              if (name) this.#createTag(name);
            }
          }
        },
        { signal }
      );
    }
    #toggleDropdown(open) {
      this.#isOpen = open !== void 0 ? open : !this.#isOpen;
      this.#dropdown.classList.toggle("hidden", !this.#isOpen);
      if (this.#isOpen && this.#filterInput) {
        this.#filterInput.focus();
        this.#filterInput.value = "";
        this.#filterOptions("");
      }
    }
    #filterOptions(query) {
      if (!this.#optionsContainer) return;
      const normalizedQuery = query.toLowerCase().trim();
      const options = this.#optionsContainer.querySelectorAll("[data-option]");
      let hasExactMatch = false;
      options.forEach((option) => {
        const name = option.dataset.name?.toLowerCase() || "";
        const matches = normalizedQuery === "" || name.includes(normalizedQuery);
        option.hidden = !matches;
        if (name === normalizedQuery) hasExactMatch = true;
      });
      if (this.#createSection && this.#createNameSpan) {
        if (normalizedQuery && !hasExactMatch) {
          this.#createSection.classList.remove("hidden");
          this.#createNameSpan.textContent = query.trim();
        } else {
          this.#createSection.classList.add("hidden");
        }
      }
    }
    #updateChips() {
      if (!this.#chipsContainer || !this.#optionsContainer) return;
      const checkboxes = this.#optionsContainer.querySelectorAll(
        'input[type="checkbox"]:checked'
      );
      this.#chipsContainer.innerHTML = "";
      checkboxes.forEach((cb) => {
        const option = cb.closest("[data-option]");
        const name = option?.dataset.name || "";
        const id = cb.dataset.id;
        const chip = document.createElement("span");
        chip.className = "tag-chip";
        chip.dataset.tagId = id;
        chip.innerHTML = `
        ${this.#escapeHtml(name)}
        <button type="button" class="tag-chip-remove" data-remove="${id}" aria-label="Remove ${this.#escapeHtml(name)}">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 6 6 18"></path>
            <path d="m6 6 12 12"></path>
          </svg>
        </button>
      `;
        this.#chipsContainer.appendChild(chip);
      });
      if (this.#placeholder) {
        this.#placeholder.textContent = checkboxes.length === 0 ? _EcTagSelect.DEFAULT_PLACEHOLDER : "";
      }
    }
    #removeTag(tagId) {
      if (!this.#optionsContainer) return;
      const checkbox = this.#optionsContainer.querySelector(
        `input[data-id="${tagId}"]`
      );
      if (checkbox) {
        checkbox.checked = false;
        this.#updateChips();
      }
    }
    async #createTag(name) {
      const slug = this.#slugify(name);
      try {
        const response = await fetch(_EcTagSelect.CREATE_TAG_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-CSRF-Token": this.#getCSRFToken()
          },
          body: `name=${encodeURIComponent(name)}&slug=${encodeURIComponent(slug)}`
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const tag = await response.json();
        if (this.#optionsContainer) {
          const newOption = document.createElement("label");
          newOption.className = "tag-select-option";
          newOption.dataset.option = "";
          newOption.dataset.name = tag.name;
          newOption.innerHTML = `
          <input type="checkbox" name="${this.fieldName}" value="${tag.id}" 
                 data-id="${tag.id}" checked />
          <span>${this.#escapeHtml(tag.name)}</span>
        `;
          this.#optionsContainer.appendChild(newOption);
        }
        this.#updateChips();
        if (this.#filterInput) this.#filterInput.value = "";
        if (this.#createSection) this.#createSection.classList.add("hidden");
        this.#filterOptions("");
      } catch (error) {
        console.error("Failed to create tag:", error);
        if (typeof window.showToast === "function") {
          window.showToast("Failed to create tag. Please try again.", "error");
        }
      }
    }
    // ============================================
    // UTILITY METHODS
    // ============================================
    #slugify(str) {
      return str.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
    }
    #escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }
    #getCSRFToken() {
      const hxHeaders = document.body?.getAttribute("hx-headers");
      if (hxHeaders) {
        try {
          const headers = JSON.parse(hxHeaders);
          if (headers["X-CSRF-Token"]) {
            return headers["X-CSRF-Token"];
          }
        } catch (e) {
        }
      }
      const input = document.querySelector('input[name="csrf_token"]');
      return input?.value || "";
    }
  };
  customElements.define("ec-tag-select", EcTagSelect);

  // web/static/js/src/components/ec-mobile-nav.js
  var EcMobileNav = class _EcMobileNav extends HTMLElement {
    // ============================================
    // CONFIGURATION
    // ============================================
    static SCROLL_THRESHOLD = 10;
    static SCROLL_TOP_ZONE = 50;
    // ============================================
    // PRIVATE STATE
    // ============================================
    #isOpen = false;
    #isBarHidden = false;
    #lastScrollY = 0;
    #ticking = false;
    #abortController = null;
    // Element references
    #drawer = null;
    #backdrop = null;
    #bar = null;
    #loadingIndicator = null;
    #scrollContainer = null;
    // ============================================
    // LIFECYCLE
    // ============================================
    connectedCallback() {
      this.#drawer = this.querySelector(".nav-drawer");
      this.#backdrop = this.querySelector(".nav-drawer-backdrop");
      this.#bar = this.querySelector(".mobile-bottom-bar");
      this.#loadingIndicator = this.querySelector(".nav-loading-indicator");
      if (!this.#drawer) {
        console.warn("ec-mobile-nav: Missing .nav-drawer", this);
        return;
      }
      this.#scrollContainer = this.#findScrollContainer();
      this.#abortController = new AbortController();
      this.#setupListeners(this.#abortController.signal);
      window.navDrawer = {
        open: this.open.bind(this),
        close: this.close.bind(this),
        toggle: this.toggle.bind(this),
        isOpen: () => this.#isOpen
      };
    }
    disconnectedCallback() {
      this.#abortController?.abort();
      if (this.#isOpen) {
        document.body.classList.remove("nav-drawer-open");
        document.body.style.overflow = "";
      }
      if (window.navDrawer?.open === this.open.bind(this)) {
        window.navDrawer = null;
      }
    }
    // ============================================
    // PRIVATE METHODS
    // ============================================
    #findScrollContainer() {
      const mainScroll = document.querySelector(".main-content-scroll");
      if (mainScroll && mainScroll.scrollHeight > mainScroll.clientHeight) {
        return mainScroll;
      }
      return window;
    }
    #setupListeners(signal) {
      const toggleBtn = this.#bar?.querySelector("[data-toggle]");
      if (toggleBtn) {
        toggleBtn.addEventListener("click", () => this.toggle(), { signal });
      }
      if (this.#backdrop) {
        this.#backdrop.addEventListener("click", () => this.close(), { signal });
      }
      document.addEventListener("keydown", (e) => this.#handleEscape(e), {
        signal
      });
      const navLinks = this.#drawer.querySelectorAll('a[href^="/"]');
      navLinks.forEach((link) => {
        link.addEventListener("click", (e) => this.#handleNavClick(e), {
          signal
        });
      });
      if (this.#scrollContainer === window) {
        window.addEventListener("scroll", (e) => this.#onScroll(e), {
          passive: true,
          signal
        });
      } else if (this.#scrollContainer) {
        this.#scrollContainer.addEventListener(
          "scroll",
          (e) => this.#onScroll(e),
          { passive: true, signal }
        );
      }
      document.addEventListener(
        "htmx:afterSettle",
        () => {
          this.#hideLoading();
          if (this.#isOpen) {
            this.close();
          }
          this.#lastScrollY = 0;
          this.#showBar();
          this.#scrollContainer = this.#findScrollContainer();
        },
        { signal }
      );
    }
    #handleEscape(e) {
      if (e.key === "Escape" && this.#isOpen) {
        this.close();
      }
    }
    #handleNavClick(e) {
      this.#showLoading();
      this.close();
    }
    #closeOnScroll = () => {
      if (this.#isOpen) {
        this.close();
      }
    };
    #onScroll(e) {
      if (this.#isOpen) return;
      if (!this.#ticking) {
        requestAnimationFrame(() => {
          this.#updateBarVisibility(e);
          this.#ticking = false;
        });
        this.#ticking = true;
      }
    }
    #updateBarVisibility(e) {
      let currentScrollY;
      if (e.target === document || e.target === window || !e.target.scrollTop) {
        currentScrollY = window.scrollY || window.pageYOffset;
      } else {
        currentScrollY = e.target.scrollTop;
      }
      const scrollDelta = currentScrollY - this.#lastScrollY;
      if (Math.abs(scrollDelta) < _EcMobileNav.SCROLL_THRESHOLD) {
        return;
      }
      if (currentScrollY < _EcMobileNav.SCROLL_TOP_ZONE) {
        this.#showBar();
      } else if (scrollDelta > 0) {
        this.#hideBar();
      } else {
        this.#showBar();
      }
      this.#lastScrollY = currentScrollY;
    }
    #showBar() {
      if (this.#isBarHidden && this.#bar) {
        this.#bar.classList.remove("scroll-hidden");
        this.#isBarHidden = false;
      }
    }
    #hideBar() {
      if (!this.#isBarHidden && this.#bar) {
        this.#bar.classList.add("scroll-hidden");
        this.#isBarHidden = true;
      }
    }
    #showLoading() {
      if (this.#loadingIndicator) {
        this.#loadingIndicator.classList.add("active");
      }
    }
    #hideLoading() {
      if (this.#loadingIndicator) {
        this.#loadingIndicator.classList.remove("active");
      }
    }
    // ============================================
    // PUBLIC API
    // ============================================
    open() {
      if (this.#isOpen || !this.#drawer) return;
      this.#isOpen = true;
      document.body.classList.add("nav-drawer-open");
      this.#drawer.classList.add("open");
      document.body.style.overflow = "hidden";
      this.#showBar();
      document.addEventListener("wheel", this.#closeOnScroll, { passive: true });
      document.addEventListener("touchmove", this.#closeOnScroll, {
        passive: true
      });
      setTimeout(() => {
        const firstLink = this.#drawer.querySelector("a[href]");
        if (firstLink) firstLink.focus();
      }, 200);
    }
    close() {
      if (!this.#isOpen || !this.#drawer) return;
      this.#isOpen = false;
      document.body.classList.remove("nav-drawer-open");
      this.#drawer.classList.remove("open");
      document.body.style.overflow = "";
      document.removeEventListener("wheel", this.#closeOnScroll);
      document.removeEventListener("touchmove", this.#closeOnScroll);
    }
    toggle() {
      if (this.#isOpen) {
        this.close();
      } else {
        this.open();
      }
    }
  };
  customElements.define("ec-mobile-nav", EcMobileNav);

  // web/static/js/src/components/ec-markdown-toolbar.js
  var EcMarkdownToolbar = class _EcMarkdownToolbar extends HTMLElement {
    // ============================================
    // CONFIGURATION
    // ============================================
    static MARKDOWN_ACTIONS = {
      bold: { prefix: "**", suffix: "**", placeholder: "bold text" },
      italic: { prefix: "_", suffix: "_", placeholder: "italic text" },
      code: { prefix: "`", suffix: "`", placeholder: "code" },
      link: { prefix: "[", suffix: "](url)", placeholder: "link text" },
      heading: { prefix: "## ", suffix: "", placeholder: "Heading", lineStart: true },
      quote: { prefix: "> ", suffix: "", placeholder: "quote", lineStart: true }
    };
    static KEYBOARD_SHORTCUTS = {
      "b": "bold",
      "i": "italic",
      "k": "link",
      "`": "code"
    };
    // ============================================
    // PRIVATE STATE
    // ============================================
    #targetTextarea = null;
    #abortController = null;
    #isVisible = false;
    #hideTimeout = null;
    // ============================================
    // LIFECYCLE
    // ============================================
    connectedCallback() {
      const targetId = this.getAttribute("target");
      if (!targetId) {
        console.warn("ec-markdown-toolbar: Missing 'target' attribute");
        return;
      }
      requestAnimationFrame(() => {
        this.#targetTextarea = document.getElementById(targetId);
        if (!this.#targetTextarea) {
          console.warn(`ec-markdown-toolbar: Target #${targetId} not found`);
          return;
        }
        this.#abortController = new AbortController();
        this.#setupListeners(this.#abortController.signal);
      });
    }
    disconnectedCallback() {
      this.#abortController?.abort();
      this.#clearHideTimeout();
    }
    // ============================================
    // EVENT LISTENERS
    // ============================================
    #setupListeners(signal) {
      this.#targetTextarea.addEventListener(
        "select",
        () => this.#handleSelection(),
        { signal }
      );
      this.#targetTextarea.addEventListener(
        "mouseup",
        () => setTimeout(() => this.#handleSelection(), 10),
        { signal }
      );
      this.#targetTextarea.addEventListener(
        "blur",
        () => this.#scheduleHide(),
        { signal }
      );
      this.addEventListener(
        "mousedown",
        (e) => {
          e.preventDefault();
          this.#clearHideTimeout();
        },
        { signal }
      );
      this.addEventListener(
        "click",
        (e) => {
          const button = e.target.closest("[data-action]");
          if (button) {
            const action = button.dataset.action;
            this.#applyAction(action);
          }
        },
        { signal }
      );
      this.#targetTextarea.addEventListener(
        "keydown",
        (e) => this.#handleKeydown(e),
        { signal }
      );
      this.#targetTextarea.addEventListener(
        "scroll",
        () => this.#hide(),
        { signal }
      );
      window.addEventListener(
        "resize",
        () => {
          if (this.#isVisible) this.#updatePosition();
        },
        { signal }
      );
    }
    // ============================================
    // SELECTION HANDLING
    // ============================================
    #handleSelection() {
      const { selectionStart, selectionEnd } = this.#targetTextarea;
      const hasSelection = selectionStart !== selectionEnd;
      if (hasSelection) {
        this.#show();
        this.#updatePosition();
      } else {
        this.#hide();
      }
    }
    #updatePosition() {
      if (!this.#targetTextarea) return;
      const textarea = this.#targetTextarea;
      const { selectionStart, selectionEnd } = textarea;
      const textareaRect = textarea.getBoundingClientRect();
      const textBeforeCursor = textarea.value.substring(0, selectionStart);
      const lines = textBeforeCursor.split("\n");
      const lineNumber = lines.length - 1;
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 24;
      const scrollTop = textarea.scrollTop;
      const paddingTop = parseInt(getComputedStyle(textarea).paddingTop) || 0;
      const paddingLeft = parseInt(getComputedStyle(textarea).paddingLeft) || 0;
      const top = textareaRect.top + paddingTop + lineNumber * lineHeight - scrollTop - this.offsetHeight - 8;
      const left = textareaRect.left + paddingLeft + Math.min(100, lines[lineNumber].length * 8);
      const maxLeft = window.innerWidth - this.offsetWidth - 16;
      const maxTop = Math.max(8, top);
      this.style.top = `${maxTop}px`;
      this.style.left = `${Math.min(left, maxLeft)}px`;
    }
    // ============================================
    // SHOW/HIDE
    // ============================================
    #show() {
      this.#clearHideTimeout();
      if (!this.#isVisible) {
        this.classList.add("visible");
        this.#isVisible = true;
      }
    }
    #hide() {
      this.#clearHideTimeout();
      if (this.#isVisible) {
        this.classList.remove("visible");
        this.#isVisible = false;
      }
    }
    #scheduleHide() {
      this.#clearHideTimeout();
      this.#hideTimeout = setTimeout(() => this.#hide(), 150);
    }
    #clearHideTimeout() {
      if (this.#hideTimeout) {
        clearTimeout(this.#hideTimeout);
        this.#hideTimeout = null;
      }
    }
    // ============================================
    // MARKDOWN ACTIONS
    // ============================================
    #applyAction(actionName) {
      const action = _EcMarkdownToolbar.MARKDOWN_ACTIONS[actionName];
      if (!action) return;
      const textarea = this.#targetTextarea;
      const { selectionStart, selectionEnd, value } = textarea;
      const selectedText = value.substring(selectionStart, selectionEnd);
      let newText;
      let newCursorStart;
      let newCursorEnd;
      if (action.lineStart) {
        const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
        const beforeLine = value.substring(0, lineStart);
        const afterSelection = value.substring(selectionEnd);
        const lineContent = selectedText || action.placeholder;
        newText = beforeLine + action.prefix + lineContent + action.suffix + afterSelection;
        newCursorStart = lineStart + action.prefix.length;
        newCursorEnd = newCursorStart + lineContent.length;
      } else {
        const before = value.substring(0, selectionStart);
        const after = value.substring(selectionEnd);
        const content = selectedText || action.placeholder;
        newText = before + action.prefix + content + action.suffix + after;
        newCursorStart = selectionStart + action.prefix.length;
        newCursorEnd = newCursorStart + content.length;
      }
      textarea.value = newText;
      textarea.setSelectionRange(newCursorStart, newCursorEnd);
      textarea.focus();
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      this.#hide();
    }
    // ============================================
    // KEYBOARD SHORTCUTS
    // ============================================
    #handleKeydown(e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const action = _EcMarkdownToolbar.KEYBOARD_SHORTCUTS[e.key.toLowerCase()];
      if (action) {
        e.preventDefault();
        this.#applyAction(action);
      }
    }
  };
  customElements.define("ec-markdown-toolbar", EcMarkdownToolbar);
  window.EcMarkdownToolbar = EcMarkdownToolbar;

  // web/static/js/src/editor/editor-core.js
  var EditorCore2 = class _EditorCore {
    // ============================================
    // STATIC REGISTRY
    // ============================================
    static #registry = /* @__PURE__ */ new Map();
    /**
     * Register an editor implementation
     * @param {string} type - Editor type identifier
     * @param {typeof EditorCore} EditorClass - Editor class that extends EditorCore
     */
    static register(type, EditorClass) {
      if (!(EditorClass.prototype instanceof _EditorCore)) {
        throw new Error(`${EditorClass.name} must extend EditorCore`);
      }
      _EditorCore.#registry.set(type, EditorClass);
    }
    /**
     * Create an editor instance
     * @param {string} type - Editor type identifier
     * @param {HTMLElement} container - Container element
     * @param {Object} options - Editor options
     * @returns {EditorCore} Editor instance
     */
    static create(type, container, options = {}) {
      const EditorClass = _EditorCore.#registry.get(type);
      if (!EditorClass) {
        throw new Error(`Unknown editor type: ${type}. Available: ${[..._EditorCore.#registry.keys()].join(", ")}`);
      }
      return new EditorClass(container, options);
    }
    /**
     * Get all registered editor types
     * @returns {string[]}
     */
    static getRegisteredTypes() {
      return [..._EditorCore.#registry.keys()];
    }
    // ============================================
    // INSTANCE PROPERTIES
    // ============================================
    /** @type {HTMLElement} */
    container = null;
    /** @type {Object} */
    options = {};
    /** @type {Function[]} */
    #changeCallbacks = [];
    /** @type {Function[]} */
    #selectionCallbacks = [];
    // ============================================
    // CONSTRUCTOR
    // ============================================
    /**
     * @param {HTMLElement} container - Container element for the editor
     * @param {Object} options - Editor configuration options
     */
    constructor(container, options = {}) {
      if (new.target === _EditorCore) {
        throw new Error("EditorCore is abstract and cannot be instantiated directly");
      }
      this.container = container;
      this.options = options;
    }
    // ============================================
    // ABSTRACT METHODS (must be implemented)
    // ============================================
    /**
     * Get the current content
     * @returns {string} The editor content
     * @abstract
     */
    getContent() {
      throw new Error("getContent() must be implemented");
    }
    /**
     * Set the editor content
     * @param {string} content - The content to set
     * @abstract
     */
    setContent(content) {
      throw new Error("setContent() must be implemented");
    }
    /**
     * Get the current selection
     * @returns {{ start: number, end: number, text: string }} Selection info
     * @abstract
     */
    getSelection() {
      throw new Error("getSelection() must be implemented");
    }
    /**
     * Insert text at the current cursor position
     * @param {string} text - Text to insert
     * @abstract
     */
    insertAtCursor(text) {
      throw new Error("insertAtCursor() must be implemented");
    }
    /**
     * Wrap the current selection with prefix and suffix
     * @param {string} prefix - Text to insert before selection
     * @param {string} suffix - Text to insert after selection
     * @param {string} [placeholder] - Default text if no selection
     * @abstract
     */
    wrapSelection(prefix, suffix, placeholder = "") {
      throw new Error("wrapSelection() must be implemented");
    }
    /**
     * Focus the editor
     * @abstract
     */
    focus() {
      throw new Error("focus() must be implemented");
    }
    /**
     * Destroy the editor and clean up resources
     * @abstract
     */
    destroy() {
      throw new Error("destroy() must be implemented");
    }
    // ============================================
    // EVENT METHODS (default implementations)
    // ============================================
    /**
     * Register a callback for content changes
     * @param {Function} callback - Called with (content: string) on change
     */
    onChange(callback) {
      if (typeof callback === "function") {
        this.#changeCallbacks.push(callback);
      }
    }
    /**
     * Register a callback for selection changes
     * @param {Function} callback - Called with (selection: { start, end, text }) on selection change
     */
    onSelectionChange(callback) {
      if (typeof callback === "function") {
        this.#selectionCallbacks.push(callback);
      }
    }
    /**
     * Emit a content change event
     * @protected
     */
    _emitChange() {
      const content = this.getContent();
      this.#changeCallbacks.forEach((cb) => cb(content));
    }
    /**
     * Emit a selection change event
     * @protected
     */
    _emitSelectionChange() {
      const selection = this.getSelection();
      this.#selectionCallbacks.forEach((cb) => cb(selection));
    }
    // ============================================
    // OPTIONAL METHODS (can be overridden)
    // ============================================
    /**
     * Check if the editor is empty
     * @returns {boolean}
     */
    isEmpty() {
      return this.getContent().trim() === "";
    }
    /**
     * Get word count
     * @returns {number}
     */
    getWordCount() {
      const content = this.getContent().trim();
      if (!content) return 0;
      return content.split(/\s+/).length;
    }
    /**
     * Get character count
     * @returns {number}
     */
    getCharacterCount() {
      return this.getContent().length;
    }
    /**
     * Register a slash command (for future /command support)
     * @param {string} trigger - Command trigger (e.g., '/image')
     * @param {Function} handler - Command handler function
     */
    registerCommand(trigger, handler) {
      console.warn("Commands not supported by this editor implementation");
    }
  };
  window.EditorCore = EditorCore2;

  // web/static/js/src/editor/markdown-editor.js
  var MarkdownEditor = class _MarkdownEditor extends EditorCore {
    // ============================================
    // PRIVATE STATE
    // ============================================
    /** @type {HTMLTextAreaElement} */
    #textarea = null;
    /** @type {AbortController} */
    #abortController = null;
    /** @type {HTMLElement} */
    #toolbar = null;
    // Markdown formatting actions
    static ACTIONS = {
      bold: { prefix: "**", suffix: "**", placeholder: "bold text" },
      italic: { prefix: "_", suffix: "_", placeholder: "italic text" },
      code: { prefix: "`", suffix: "`", placeholder: "code" },
      link: { prefix: "[", suffix: "](url)", placeholder: "link text" },
      heading: { prefix: "## ", suffix: "", placeholder: "Heading", lineStart: true },
      quote: { prefix: "> ", suffix: "", placeholder: "quote", lineStart: true }
    };
    static KEYBOARD_SHORTCUTS = {
      "b": "bold",
      "i": "italic",
      "k": "link",
      "`": "code"
    };
    // ============================================
    // CONSTRUCTOR
    // ============================================
    constructor(container, options = {}) {
      super(container, options);
      this.#textarea = container.querySelector("textarea") || this.#createTextarea();
      if (options.initialContent) {
        this.setContent(options.initialContent);
      }
      if (options.toolbar) {
        this.#toolbar = options.toolbar;
      }
      this.#abortController = new AbortController();
      this.#setupListeners();
    }
    // ============================================
    // ABSTRACT METHOD IMPLEMENTATIONS
    // ============================================
    getContent() {
      return this.#textarea.value;
    }
    setContent(content) {
      this.#textarea.value = content;
      this._emitChange();
    }
    getSelection() {
      const { selectionStart, selectionEnd, value } = this.#textarea;
      return {
        start: selectionStart,
        end: selectionEnd,
        text: value.substring(selectionStart, selectionEnd)
      };
    }
    insertAtCursor(text) {
      const { selectionStart, selectionEnd, value } = this.#textarea;
      const before = value.substring(0, selectionStart);
      const after = value.substring(selectionEnd);
      this.#textarea.value = before + text + after;
      const newPos = selectionStart + text.length;
      this.#textarea.setSelectionRange(newPos, newPos);
      this._emitChange();
      this.focus();
    }
    wrapSelection(prefix, suffix, placeholder = "") {
      const { selectionStart, selectionEnd, value } = this.#textarea;
      const selectedText = value.substring(selectionStart, selectionEnd) || placeholder;
      const before = value.substring(0, selectionStart);
      const after = value.substring(selectionEnd);
      this.#textarea.value = before + prefix + selectedText + suffix + after;
      const newStart = selectionStart + prefix.length;
      const newEnd = newStart + selectedText.length;
      this.#textarea.setSelectionRange(newStart, newEnd);
      this._emitChange();
      this.focus();
    }
    focus() {
      this.#textarea.focus();
    }
    destroy() {
      this.#abortController?.abort();
      this.#toolbar = null;
    }
    // ============================================
    // MARKDOWN-SPECIFIC METHODS
    // ============================================
    /**
     * Apply a markdown formatting action
     * @param {string} actionName - Name of the action (bold, italic, etc.)
     */
    applyAction(actionName) {
      const action = _MarkdownEditor.ACTIONS[actionName];
      if (!action) return;
      if (action.lineStart) {
        this.#applyLineStartAction(action);
      } else {
        this.wrapSelection(action.prefix, action.suffix, action.placeholder);
      }
    }
    /**
     * Apply an action that affects the start of a line
     * @private
     */
    #applyLineStartAction(action) {
      const { selectionStart, selectionEnd, value } = this.#textarea;
      const selectedText = value.substring(selectionStart, selectionEnd) || action.placeholder;
      const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
      const beforeLine = value.substring(0, lineStart);
      const afterSelection = value.substring(selectionEnd);
      this.#textarea.value = beforeLine + action.prefix + selectedText + action.suffix + afterSelection;
      const newStart = lineStart + action.prefix.length;
      const newEnd = newStart + selectedText.length;
      this.#textarea.setSelectionRange(newStart, newEnd);
      this._emitChange();
      this.focus();
    }
    // ============================================
    // PRIVATE METHODS
    // ============================================
    #createTextarea() {
      const textarea = document.createElement("textarea");
      textarea.className = "editor-content";
      textarea.placeholder = this.options.placeholder || "Write your content...";
      this.container.appendChild(textarea);
      return textarea;
    }
    #setupListeners() {
      const { signal } = this.#abortController;
      this.#textarea.addEventListener("input", () => {
        this._emitChange();
      }, { signal });
      this.#textarea.addEventListener("select", () => {
        this._emitSelectionChange();
      }, { signal });
      this.#textarea.addEventListener("mouseup", () => {
        setTimeout(() => this._emitSelectionChange(), 10);
      }, { signal });
      this.#textarea.addEventListener("keyup", (e) => {
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
          this._emitSelectionChange();
        }
      }, { signal });
      this.#textarea.addEventListener("keydown", (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        const action = _MarkdownEditor.KEYBOARD_SHORTCUTS[e.key.toLowerCase()];
        if (action) {
          e.preventDefault();
          this.applyAction(action);
        }
      }, { signal });
    }
  };
  EditorCore.register("markdown", MarkdownEditor);
  window.MarkdownEditor = MarkdownEditor;

  // web/static/js/vendor/editorjs/editor.mjs
  var Rt = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
  function Pe(s) {
    return s && s.__esModule && Object.prototype.hasOwnProperty.call(s, "default") ? s.default : s;
  }
  function Te() {
  }
  Object.assign(Te, {
    default: Te,
    register: Te,
    revert: function() {
    },
    __esModule: true
  });
  Element.prototype.matches || (Element.prototype.matches = Element.prototype.matchesSelector || Element.prototype.mozMatchesSelector || Element.prototype.msMatchesSelector || Element.prototype.oMatchesSelector || Element.prototype.webkitMatchesSelector || function(s) {
    const e = (this.document || this.ownerDocument).querySelectorAll(s);
    let t = e.length;
    for (; --t >= 0 && e.item(t) !== this; )
      ;
    return t > -1;
  });
  Element.prototype.closest || (Element.prototype.closest = function(s) {
    let e = this;
    if (!document.documentElement.contains(e))
      return null;
    do {
      if (e.matches(s))
        return e;
      e = e.parentElement || e.parentNode;
    } while (e !== null);
    return null;
  });
  Element.prototype.prepend || (Element.prototype.prepend = function(e) {
    const t = document.createDocumentFragment();
    Array.isArray(e) || (e = [e]), e.forEach((o3) => {
      const i2 = o3 instanceof Node;
      t.appendChild(i2 ? o3 : document.createTextNode(o3));
    }), this.insertBefore(t, this.firstChild);
  });
  Element.prototype.scrollIntoViewIfNeeded || (Element.prototype.scrollIntoViewIfNeeded = function(s) {
    s = arguments.length === 0 ? true : !!s;
    const e = this.parentNode, t = window.getComputedStyle(e, null), o3 = parseInt(t.getPropertyValue("border-top-width")), i2 = parseInt(t.getPropertyValue("border-left-width")), n2 = this.offsetTop - e.offsetTop < e.scrollTop, r2 = this.offsetTop - e.offsetTop + this.clientHeight - o3 > e.scrollTop + e.clientHeight, a4 = this.offsetLeft - e.offsetLeft < e.scrollLeft, l4 = this.offsetLeft - e.offsetLeft + this.clientWidth - i2 > e.scrollLeft + e.clientWidth, d4 = n2 && !r2;
    (n2 || r2) && s && (e.scrollTop = this.offsetTop - e.offsetTop - e.clientHeight / 2 - o3 + this.clientHeight / 2), (a4 || l4) && s && (e.scrollLeft = this.offsetLeft - e.offsetLeft - e.clientWidth / 2 - i2 + this.clientWidth / 2), (n2 || r2 || a4 || l4) && !s && this.scrollIntoView(d4);
  });
  window.requestIdleCallback = window.requestIdleCallback || function(s) {
    const e = Date.now();
    return setTimeout(function() {
      s({
        didTimeout: false,
        timeRemaining: function() {
          return Math.max(0, 50 - (Date.now() - e));
        }
      });
    }, 1);
  };
  window.cancelIdleCallback = window.cancelIdleCallback || function(s) {
    clearTimeout(s);
  };
  var Dt = (s = 21) => crypto.getRandomValues(new Uint8Array(s)).reduce((e, t) => (t &= 63, t < 36 ? e += t.toString(36) : t < 62 ? e += (t - 26).toString(36).toUpperCase() : t > 62 ? e += "-" : e += "_", e), "");
  var at = /* @__PURE__ */ ((s) => (s.VERBOSE = "VERBOSE", s.INFO = "INFO", s.WARN = "WARN", s.ERROR = "ERROR", s))(at || {});
  var v = {
    BACKSPACE: 8,
    TAB: 9,
    ENTER: 13,
    SHIFT: 16,
    CTRL: 17,
    ALT: 18,
    ESC: 27,
    SPACE: 32,
    LEFT: 37,
    UP: 38,
    DOWN: 40,
    RIGHT: 39,
    DELETE: 46,
    META: 91,
    SLASH: 191
  };
  var Pt = {
    LEFT: 0,
    WHEEL: 1,
    RIGHT: 2,
    BACKWARD: 3,
    FORWARD: 4
  };
  function me(s, e, t = "log", o3, i2 = "color: inherit") {
    if (!("console" in window) || !window.console[t])
      return;
    const n2 = ["info", "log", "warn", "error"].includes(t), r2 = [];
    switch (me.logLevel) {
      case "ERROR":
        if (t !== "error")
          return;
        break;
      case "WARN":
        if (!["error", "warn"].includes(t))
          return;
        break;
      case "INFO":
        if (!n2 || s)
          return;
        break;
    }
    o3 && r2.push(o3);
    const a4 = "Editor.js 2.29.1", l4 = `line-height: 1em;
            color: #006FEA;
            display: inline-block;
            font-size: 11px;
            line-height: 1em;
            background-color: #fff;
            padding: 4px 9px;
            border-radius: 30px;
            border: 1px solid rgba(56, 138, 229, 0.16);
            margin: 4px 5px 4px 0;`;
    s && (n2 ? (r2.unshift(l4, i2), e = `%c${a4}%c ${e}`) : e = `( ${a4} )${e}`);
    try {
      n2 ? o3 ? console[t](`${e} %o`, ...r2) : console[t](e, ...r2) : console[t](e);
    } catch {
    }
  }
  me.logLevel = "VERBOSE";
  function Ft(s) {
    me.logLevel = s;
  }
  var T = me.bind(window, false);
  var Y = me.bind(window, true);
  function oe(s) {
    return Object.prototype.toString.call(s).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
  }
  function M(s) {
    return oe(s) === "function" || oe(s) === "asyncfunction";
  }
  function D(s) {
    return oe(s) === "object";
  }
  function G(s) {
    return oe(s) === "string";
  }
  function Ht(s) {
    return oe(s) === "boolean";
  }
  function Je(s) {
    return oe(s) === "number";
  }
  function Qe(s) {
    return oe(s) === "undefined";
  }
  function W(s) {
    return s ? Object.keys(s).length === 0 && s.constructor === Object : true;
  }
  function lt(s) {
    return s > 47 && s < 58 || // number keys
    s === 32 || s === 13 || // Space bar & return key(s)
    s === 229 || // processing key input for certain languages — Chinese, Japanese, etc.
    s > 64 && s < 91 || // letter keys
    s > 95 && s < 112 || // Numpad keys
    s > 185 && s < 193 || // ;=,-./` (in order)
    s > 218 && s < 223;
  }
  async function zt(s, e = () => {
  }, t = () => {
  }) {
    async function o3(i2, n2, r2) {
      try {
        await i2.function(i2.data), await n2(Qe(i2.data) ? {} : i2.data);
      } catch {
        r2(Qe(i2.data) ? {} : i2.data);
      }
    }
    return s.reduce(async (i2, n2) => (await i2, o3(n2, e, t)), Promise.resolve());
  }
  function ct(s) {
    return Array.prototype.slice.call(s);
  }
  function xe(s, e) {
    return function() {
      const t = this, o3 = arguments;
      window.setTimeout(() => s.apply(t, o3), e);
    };
  }
  function Ut(s) {
    return s.name.split(".").pop();
  }
  function jt(s) {
    return /^[-\w]+\/([-+\w]+|\*)$/.test(s);
  }
  function et(s, e, t) {
    let o3;
    return (...i2) => {
      const n2 = this, r2 = () => {
        o3 = null, t || s.apply(n2, i2);
      }, a4 = t && !o3;
      window.clearTimeout(o3), o3 = window.setTimeout(r2, e), a4 && s.apply(n2, i2);
    };
  }
  function Ie(s, e, t = void 0) {
    let o3, i2, n2, r2 = null, a4 = 0;
    t || (t = {});
    const l4 = function() {
      a4 = t.leading === false ? 0 : Date.now(), r2 = null, n2 = s.apply(o3, i2), r2 || (o3 = i2 = null);
    };
    return function() {
      const d4 = Date.now();
      !a4 && t.leading === false && (a4 = d4);
      const u2 = e - (d4 - a4);
      return o3 = this, i2 = arguments, u2 <= 0 || u2 > e ? (r2 && (clearTimeout(r2), r2 = null), a4 = d4, n2 = s.apply(o3, i2), r2 || (o3 = i2 = null)) : !r2 && t.trailing !== false && (r2 = setTimeout(l4, u2)), n2;
    };
  }
  function $t() {
    const s = {
      win: false,
      mac: false,
      x11: false,
      linux: false
    }, e = Object.keys(s).find((t) => window.navigator.appVersion.toLowerCase().indexOf(t) !== -1);
    return e && (s[e] = true), s;
  }
  function re(s) {
    return s[0].toUpperCase() + s.slice(1);
  }
  function Me(s, ...e) {
    if (!e.length)
      return s;
    const t = e.shift();
    if (D(s) && D(t))
      for (const o3 in t)
        D(t[o3]) ? (s[o3] || Object.assign(s, { [o3]: {} }), Me(s[o3], t[o3])) : Object.assign(s, { [o3]: t[o3] });
    return Me(s, ...e);
  }
  function ye(s) {
    const e = $t();
    return s = s.replace(/shift/gi, "\u21E7").replace(/backspace/gi, "\u232B").replace(/enter/gi, "\u23CE").replace(/up/gi, "\u2191").replace(/left/gi, "\u2192").replace(/down/gi, "\u2193").replace(/right/gi, "\u2190").replace(/escape/gi, "\u238B").replace(/insert/gi, "Ins").replace(/delete/gi, "\u2421").replace(/\+/gi, " + "), e.mac ? s = s.replace(/ctrl|cmd/gi, "\u2318").replace(/alt/gi, "\u2325") : s = s.replace(/cmd/gi, "Ctrl").replace(/windows/gi, "WIN"), s;
  }
  function Wt(s) {
    try {
      return new URL(s).href;
    } catch {
    }
    return s.substring(0, 2) === "//" ? window.location.protocol + s : window.location.origin + s;
  }
  function Yt() {
    return Dt(10);
  }
  function Kt(s) {
    window.open(s, "_blank");
  }
  function Xt(s = "") {
    return `${s}${Math.floor(Math.random() * 1e8).toString(16)}`;
  }
  function Le(s, e, t) {
    const o3 = `\xAB${e}\xBB is deprecated and will be removed in the next major release. Please use the \xAB${t}\xBB instead.`;
    s && Y(o3, "warn");
  }
  function le(s, e, t) {
    const o3 = t.value ? "value" : "get", i2 = t[o3], n2 = `#${e}Cache`;
    if (t[o3] = function(...r2) {
      return this[n2] === void 0 && (this[n2] = i2.apply(this, ...r2)), this[n2];
    }, o3 === "get" && t.set) {
      const r2 = t.set;
      t.set = function(a4) {
        delete s[n2], r2.apply(this, a4);
      };
    }
    return t;
  }
  var dt = 650;
  function te() {
    return window.matchMedia(`(max-width: ${dt}px)`).matches;
  }
  var tt = typeof window < "u" && window.navigator && window.navigator.platform && (/iP(ad|hone|od)/.test(window.navigator.platform) || window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  function Vt(s, e) {
    const t = Array.isArray(s) || D(s), o3 = Array.isArray(e) || D(e);
    return t || o3 ? JSON.stringify(s) === JSON.stringify(e) : s === e;
  }
  var c = class _c {
    /**
     * Check if passed tag has no closed tag
     *
     * @param {HTMLElement} tag - element to check
     * @returns {boolean}
     */
    static isSingleTag(e) {
      return e.tagName && [
        "AREA",
        "BASE",
        "BR",
        "COL",
        "COMMAND",
        "EMBED",
        "HR",
        "IMG",
        "INPUT",
        "KEYGEN",
        "LINK",
        "META",
        "PARAM",
        "SOURCE",
        "TRACK",
        "WBR"
      ].includes(e.tagName);
    }
    /**
     * Check if element is BR or WBR
     *
     * @param {HTMLElement} element - element to check
     * @returns {boolean}
     */
    static isLineBreakTag(e) {
      return e && e.tagName && [
        "BR",
        "WBR"
      ].includes(e.tagName);
    }
    /**
     * Helper for making Elements with class name and attributes
     *
     * @param  {string} tagName - new Element tag name
     * @param  {string[]|string} [classNames] - list or name of CSS class name(s)
     * @param  {object} [attributes] - any attributes
     * @returns {HTMLElement}
     */
    static make(e, t = null, o3 = {}) {
      const i2 = document.createElement(e);
      Array.isArray(t) ? i2.classList.add(...t) : t && i2.classList.add(t);
      for (const n2 in o3)
        Object.prototype.hasOwnProperty.call(o3, n2) && (i2[n2] = o3[n2]);
      return i2;
    }
    /**
     * Creates Text Node with the passed content
     *
     * @param {string} content - text content
     * @returns {Text}
     */
    static text(e) {
      return document.createTextNode(e);
    }
    /**
     * Append one or several elements to the parent
     *
     * @param  {Element|DocumentFragment} parent - where to append
     * @param  {Element|Element[]|DocumentFragment|Text|Text[]} elements - element or elements list
     */
    static append(e, t) {
      Array.isArray(t) ? t.forEach((o3) => e.appendChild(o3)) : e.appendChild(t);
    }
    /**
     * Append element or a couple to the beginning of the parent elements
     *
     * @param {Element} parent - where to append
     * @param {Element|Element[]} elements - element or elements list
     */
    static prepend(e, t) {
      Array.isArray(t) ? (t = t.reverse(), t.forEach((o3) => e.prepend(o3))) : e.prepend(t);
    }
    /**
     * Swap two elements in parent
     *
     * @param {HTMLElement} el1 - from
     * @param {HTMLElement} el2 - to
     * @deprecated
     */
    static swap(e, t) {
      const o3 = document.createElement("div"), i2 = e.parentNode;
      i2.insertBefore(o3, e), i2.insertBefore(e, t), i2.insertBefore(t, o3), i2.removeChild(o3);
    }
    /**
     * Selector Decorator
     *
     * Returns first match
     *
     * @param {Element} el - element we searching inside. Default - DOM Document
     * @param {string} selector - searching string
     * @returns {Element}
     */
    static find(e = document, t) {
      return e.querySelector(t);
    }
    /**
     * Get Element by Id
     *
     * @param {string} id - id to find
     * @returns {HTMLElement | null}
     */
    static get(e) {
      return document.getElementById(e);
    }
    /**
     * Selector Decorator.
     *
     * Returns all matches
     *
     * @param {Element|Document} el - element we searching inside. Default - DOM Document
     * @param {string} selector - searching string
     * @returns {NodeList}
     */
    static findAll(e = document, t) {
      return e.querySelectorAll(t);
    }
    /**
     * Returns CSS selector for all text inputs
     */
    static get allInputsSelector() {
      return "[contenteditable=true], textarea, input:not([type]), " + ["text", "password", "email", "number", "search", "tel", "url"].map((t) => `input[type="${t}"]`).join(", ");
    }
    /**
     * Find all contenteditable, textarea and editable input elements passed holder contains
     *
     * @param holder - element where to find inputs
     */
    static findAllInputs(e) {
      return ct(e.querySelectorAll(_c.allInputsSelector)).reduce((t, o3) => _c.isNativeInput(o3) || _c.containsOnlyInlineElements(o3) ? [...t, o3] : [...t, ..._c.getDeepestBlockElements(o3)], []);
    }
    /**
     * Search for deepest node which is Leaf.
     * Leaf is the vertex that doesn't have any child nodes
     *
     * @description Method recursively goes throw the all Node until it finds the Leaf
     * @param {Node} node - root Node. From this vertex we start Deep-first search
     *                      {@link https://en.wikipedia.org/wiki/Depth-first_search}
     * @param {boolean} [atLast] - find last text node
     * @returns {Node} - it can be text Node or Element Node, so that caret will able to work with it
     */
    static getDeepestNode(e, t = false) {
      const o3 = t ? "lastChild" : "firstChild", i2 = t ? "previousSibling" : "nextSibling";
      if (e && e.nodeType === Node.ELEMENT_NODE && e[o3]) {
        let n2 = e[o3];
        if (_c.isSingleTag(n2) && !_c.isNativeInput(n2) && !_c.isLineBreakTag(n2))
          if (n2[i2])
            n2 = n2[i2];
          else if (n2.parentNode[i2])
            n2 = n2.parentNode[i2];
          else
            return n2.parentNode;
        return this.getDeepestNode(n2, t);
      }
      return e;
    }
    /**
     * Check if object is DOM node
     *
     * @param {*} node - object to check
     * @returns {boolean}
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static isElement(e) {
      return Je(e) ? false : e && e.nodeType && e.nodeType === Node.ELEMENT_NODE;
    }
    /**
     * Check if object is DocumentFragment node
     *
     * @param {object} node - object to check
     * @returns {boolean}
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static isFragment(e) {
      return Je(e) ? false : e && e.nodeType && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
    }
    /**
     * Check if passed element is contenteditable
     *
     * @param {HTMLElement} element - html element to check
     * @returns {boolean}
     */
    static isContentEditable(e) {
      return e.contentEditable === "true";
    }
    /**
     * Checks target if it is native input
     *
     * @param {*} target - HTML element or string
     * @returns {boolean}
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static isNativeInput(e) {
      const t = [
        "INPUT",
        "TEXTAREA"
      ];
      return e && e.tagName ? t.includes(e.tagName) : false;
    }
    /**
     * Checks if we can set caret
     *
     * @param {HTMLElement} target - target to check
     * @returns {boolean}
     */
    static canSetCaret(e) {
      let t = true;
      if (_c.isNativeInput(e))
        switch (e.type) {
          case "file":
          case "checkbox":
          case "radio":
          case "hidden":
          case "submit":
          case "button":
          case "image":
          case "reset":
            t = false;
            break;
        }
      else
        t = _c.isContentEditable(e);
      return t;
    }
    /**
     * Checks node if it is empty
     *
     * @description Method checks simple Node without any childs for emptiness
     * If you have Node with 2 or more children id depth, you better use {@link Dom#isEmpty} method
     * @param {Node} node - node to check
     * @param {string} [ignoreChars] - char or substring to treat as empty
     * @returns {boolean} true if it is empty
     */
    static isNodeEmpty(e, t) {
      let o3;
      return this.isSingleTag(e) && !this.isLineBreakTag(e) ? false : (this.isElement(e) && this.isNativeInput(e) ? o3 = e.value : o3 = e.textContent.replace("\u200B", ""), t && (o3 = o3.replace(new RegExp(t, "g"), "")), o3.trim().length === 0);
    }
    /**
     * checks node if it is doesn't have any child nodes
     *
     * @param {Node} node - node to check
     * @returns {boolean}
     */
    static isLeaf(e) {
      return e ? e.childNodes.length === 0 : false;
    }
    /**
     * breadth-first search (BFS)
     * {@link https://en.wikipedia.org/wiki/Breadth-first_search}
     *
     * @description Pushes to stack all DOM leafs and checks for emptiness
     * @param {Node} node - node to check
     * @param {string} [ignoreChars] - char or substring to treat as empty
     * @returns {boolean}
     */
    static isEmpty(e, t) {
      e.normalize();
      const o3 = [e];
      for (; o3.length > 0; )
        if (e = o3.shift(), !!e) {
          if (this.isLeaf(e) && !this.isNodeEmpty(e, t))
            return false;
          e.childNodes && o3.push(...Array.from(e.childNodes));
        }
      return true;
    }
    /**
     * Check if string contains html elements
     *
     * @param {string} str - string to check
     * @returns {boolean}
     */
    static isHTMLString(e) {
      const t = _c.make("div");
      return t.innerHTML = e, t.childElementCount > 0;
    }
    /**
     * Return length of node`s text content
     *
     * @param {Node} node - node with content
     * @returns {number}
     */
    static getContentLength(e) {
      return _c.isNativeInput(e) ? e.value.length : e.nodeType === Node.TEXT_NODE ? e.length : e.textContent.length;
    }
    /**
     * Return array of names of block html elements
     *
     * @returns {string[]}
     */
    static get blockElements() {
      return [
        "address",
        "article",
        "aside",
        "blockquote",
        "canvas",
        "div",
        "dl",
        "dt",
        "fieldset",
        "figcaption",
        "figure",
        "footer",
        "form",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "header",
        "hgroup",
        "hr",
        "li",
        "main",
        "nav",
        "noscript",
        "ol",
        "output",
        "p",
        "pre",
        "ruby",
        "section",
        "table",
        "tbody",
        "thead",
        "tr",
        "tfoot",
        "ul",
        "video"
      ];
    }
    /**
     * Check if passed content includes only inline elements
     *
     * @param {string|HTMLElement} data - element or html string
     * @returns {boolean}
     */
    static containsOnlyInlineElements(e) {
      let t;
      G(e) ? (t = document.createElement("div"), t.innerHTML = e) : t = e;
      const o3 = (i2) => !_c.blockElements.includes(i2.tagName.toLowerCase()) && Array.from(i2.children).every(o3);
      return Array.from(t.children).every(o3);
    }
    /**
     * Find and return all block elements in the passed parent (including subtree)
     *
     * @param {HTMLElement} parent - root element
     * @returns {HTMLElement[]}
     */
    static getDeepestBlockElements(e) {
      return _c.containsOnlyInlineElements(e) ? [e] : Array.from(e.children).reduce((t, o3) => [...t, ..._c.getDeepestBlockElements(o3)], []);
    }
    /**
     * Helper for get holder from {string} or return HTMLElement
     *
     * @param {string | HTMLElement} element - holder's id or holder's HTML Element
     * @returns {HTMLElement}
     */
    static getHolder(e) {
      return G(e) ? document.getElementById(e) : e;
    }
    /**
     * Returns true if element is anchor (is A tag)
     *
     * @param {Element} element - element to check
     * @returns {boolean}
     */
    static isAnchor(e) {
      return e.tagName.toLowerCase() === "a";
    }
    /**
     * Return element's offset related to the document
     *
     * @todo handle case when editor initialized in scrollable popup
     * @param el - element to compute offset
     */
    static offset(e) {
      const t = e.getBoundingClientRect(), o3 = window.pageXOffset || document.documentElement.scrollLeft, i2 = window.pageYOffset || document.documentElement.scrollTop, n2 = t.top + i2, r2 = t.left + o3;
      return {
        top: n2,
        left: r2,
        bottom: n2 + t.height,
        right: r2 + t.width
      };
    }
  };
  var qt = {
    blockTunes: {
      toggler: {
        "Click to tune": "",
        "or drag to move": ""
      }
    },
    inlineToolbar: {
      converter: {
        "Convert to": ""
      }
    },
    toolbar: {
      toolbox: {
        Add: ""
      }
    },
    popover: {
      Filter: "",
      "Nothing found": ""
    }
  };
  var Zt = {
    Text: "",
    Link: "",
    Bold: "",
    Italic: ""
  };
  var Gt = {
    link: {
      "Add a link": ""
    },
    stub: {
      "The block can not be displayed correctly.": ""
    }
  };
  var Jt = {
    delete: {
      Delete: "",
      "Click to delete": ""
    },
    moveUp: {
      "Move up": ""
    },
    moveDown: {
      "Move down": ""
    }
  };
  var ht = {
    ui: qt,
    toolNames: Zt,
    tools: Gt,
    blockTunes: Jt
  };
  var ie = class {
    /**
     * Type-safe translation for internal UI texts:
     * Perform translation of the string by namespace and a key
     *
     * @example I18n.ui(I18nInternalNS.ui.blockTunes.toggler, 'Click to tune')
     * @param internalNamespace - path to translated string in dictionary
     * @param dictKey - dictionary key. Better to use default locale original text
     */
    static ui(s, e) {
      return ie._t(s, e);
    }
    /**
     * Translate for external strings that is not presented in default dictionary.
     * For example, for user-specified tool names
     *
     * @param namespace - path to translated string in dictionary
     * @param dictKey - dictionary key. Better to use default locale original text
     */
    static t(s, e) {
      return ie._t(s, e);
    }
    /**
     * Adjust module for using external dictionary
     *
     * @param dictionary - new messages list to override default
     */
    static setDictionary(s) {
      ie.currentDictionary = s;
    }
    /**
     * Perform translation both for internal and external namespaces
     * If there is no translation found, returns passed key as a translated message
     *
     * @param namespace - path to translated string in dictionary
     * @param dictKey - dictionary key. Better to use default locale original text
     */
    static _t(s, e) {
      const t = ie.getNamespace(s);
      return !t || !t[e] ? e : t[e];
    }
    /**
     * Find messages section by namespace path
     *
     * @param namespace - path to section
     */
    static getNamespace(s) {
      return s.split(".").reduce((t, o3) => !t || !Object.keys(t).length ? {} : t[o3], ie.currentDictionary);
    }
  };
  var z = ie;
  z.currentDictionary = ht;
  var ut = class extends Error {
  };
  var Ee = class {
    constructor() {
      this.subscribers = {};
    }
    /**
     * Subscribe any event on callback
     *
     * @param eventName - event name
     * @param callback - subscriber
     */
    on(e, t) {
      e in this.subscribers || (this.subscribers[e] = []), this.subscribers[e].push(t);
    }
    /**
     * Subscribe any event on callback. Callback will be called once and be removed from subscribers array after call.
     *
     * @param eventName - event name
     * @param callback - subscriber
     */
    once(e, t) {
      e in this.subscribers || (this.subscribers[e] = []);
      const o3 = (i2) => {
        const n2 = t(i2), r2 = this.subscribers[e].indexOf(o3);
        return r2 !== -1 && this.subscribers[e].splice(r2, 1), n2;
      };
      this.subscribers[e].push(o3);
    }
    /**
     * Emit callbacks with passed data
     *
     * @param eventName - event name
     * @param data - subscribers get this data when they were fired
     */
    emit(e, t) {
      W(this.subscribers) || !this.subscribers[e] || this.subscribers[e].reduce((o3, i2) => {
        const n2 = i2(o3);
        return n2 !== void 0 ? n2 : o3;
      }, t);
    }
    /**
     * Unsubscribe callback from event
     *
     * @param eventName - event name
     * @param callback - event handler
     */
    off(e, t) {
      if (this.subscribers[e] === void 0) {
        console.warn(`EventDispatcher .off(): there is no subscribers for event "${e.toString()}". Probably, .off() called before .on()`);
        return;
      }
      for (let o3 = 0; o3 < this.subscribers[e].length; o3++)
        if (this.subscribers[e][o3] === t) {
          delete this.subscribers[e][o3];
          break;
        }
    }
    /**
     * Destroyer
     * clears subscribers list
     */
    destroy() {
      this.subscribers = {};
    }
  };
  function ee(s) {
    Object.setPrototypeOf(this, {
      /**
       * Block id
       *
       * @returns {string}
       */
      get id() {
        return s.id;
      },
      /**
       * Tool name
       *
       * @returns {string}
       */
      get name() {
        return s.name;
      },
      /**
       * Tool config passed on Editor's initialization
       *
       * @returns {ToolConfig}
       */
      get config() {
        return s.config;
      },
      /**
       * .ce-block element, that wraps plugin contents
       *
       * @returns {HTMLElement}
       */
      get holder() {
        return s.holder;
      },
      /**
       * True if Block content is empty
       *
       * @returns {boolean}
       */
      get isEmpty() {
        return s.isEmpty;
      },
      /**
       * True if Block is selected with Cross-Block selection
       *
       * @returns {boolean}
       */
      get selected() {
        return s.selected;
      },
      /**
       * Set Block's stretch state
       *
       * @param {boolean} state — state to set
       */
      set stretched(t) {
        s.stretched = t;
      },
      /**
       * True if Block is stretched
       *
       * @returns {boolean}
       */
      get stretched() {
        return s.stretched;
      },
      /**
       * True if Block has inputs to be focused
       */
      get focusable() {
        return s.focusable;
      },
      /**
       * Call Tool method with errors handler under-the-hood
       *
       * @param {string} methodName - method to call
       * @param {object} param - object with parameters
       * @returns {unknown}
       */
      call(t, o3) {
        return s.call(t, o3);
      },
      /**
       * Save Block content
       *
       * @returns {Promise<void|SavedData>}
       */
      save() {
        return s.save();
      },
      /**
       * Validate Block data
       *
       * @param {BlockToolData} data - data to validate
       * @returns {Promise<boolean>}
       */
      validate(t) {
        return s.validate(t);
      },
      /**
       * Allows to say Editor that Block was changed. Used to manually trigger Editor's 'onChange' callback
       * Can be useful for block changes invisible for editor core.
       */
      dispatchChange() {
        s.dispatchChange();
      }
    });
  }
  var Fe = class {
    constructor() {
      this.allListeners = [];
    }
    /**
     * Assigns event listener on element and returns unique identifier
     *
     * @param {EventTarget} element - DOM element that needs to be listened
     * @param {string} eventType - event type
     * @param {Function} handler - method that will be fired on event
     * @param {boolean|AddEventListenerOptions} options - useCapture or {capture, passive, once}
     */
    on(e, t, o3, i2 = false) {
      const n2 = Xt("l"), r2 = {
        id: n2,
        element: e,
        eventType: t,
        handler: o3,
        options: i2
      };
      if (!this.findOne(e, t, o3))
        return this.allListeners.push(r2), e.addEventListener(t, o3, i2), n2;
    }
    /**
     * Removes event listener from element
     *
     * @param {EventTarget} element - DOM element that we removing listener
     * @param {string} eventType - event type
     * @param {Function} handler - remove handler, if element listens several handlers on the same event type
     * @param {boolean|AddEventListenerOptions} options - useCapture or {capture, passive, once}
     */
    off(e, t, o3, i2) {
      const n2 = this.findAll(e, t, o3);
      n2.forEach((r2, a4) => {
        const l4 = this.allListeners.indexOf(n2[a4]);
        l4 > -1 && (this.allListeners.splice(l4, 1), r2.element.removeEventListener(r2.eventType, r2.handler, r2.options));
      });
    }
    /**
     * Removes listener by id
     *
     * @param {string} id - listener identifier
     */
    offById(e) {
      const t = this.findById(e);
      t && t.element.removeEventListener(t.eventType, t.handler, t.options);
    }
    /**
     * Finds and returns first listener by passed params
     *
     * @param {EventTarget} element - event target
     * @param {string} [eventType] - event type
     * @param {Function} [handler] - event handler
     * @returns {ListenerData|null}
     */
    findOne(e, t, o3) {
      const i2 = this.findAll(e, t, o3);
      return i2.length > 0 ? i2[0] : null;
    }
    /**
     * Return all stored listeners by passed params
     *
     * @param {EventTarget} element - event target
     * @param {string} eventType - event type
     * @param {Function} handler - event handler
     * @returns {ListenerData[]}
     */
    findAll(e, t, o3) {
      let i2;
      const n2 = e ? this.findByEventTarget(e) : [];
      return e && t && o3 ? i2 = n2.filter((r2) => r2.eventType === t && r2.handler === o3) : e && t ? i2 = n2.filter((r2) => r2.eventType === t) : i2 = n2, i2;
    }
    /**
     * Removes all listeners
     */
    removeAll() {
      this.allListeners.map((e) => {
        e.element.removeEventListener(e.eventType, e.handler, e.options);
      }), this.allListeners = [];
    }
    /**
     * Module cleanup on destruction
     */
    destroy() {
      this.removeAll();
    }
    /**
     * Search method: looks for listener by passed element
     *
     * @param {EventTarget} element - searching element
     * @returns {Array} listeners that found on element
     */
    findByEventTarget(e) {
      return this.allListeners.filter((t) => {
        if (t.element === e)
          return t;
      });
    }
    /**
     * Search method: looks for listener by passed event type
     *
     * @param {string} eventType - event type
     * @returns {ListenerData[]} listeners that found on element
     */
    findByType(e) {
      return this.allListeners.filter((t) => {
        if (t.eventType === e)
          return t;
      });
    }
    /**
     * Search method: looks for listener by passed handler
     *
     * @param {Function} handler - event handler
     * @returns {ListenerData[]} listeners that found on element
     */
    findByHandler(e) {
      return this.allListeners.filter((t) => {
        if (t.handler === e)
          return t;
      });
    }
    /**
     * Returns listener data found by id
     *
     * @param {string} id - listener identifier
     * @returns {ListenerData}
     */
    findById(e) {
      return this.allListeners.find((t) => t.id === e);
    }
  };
  var y = class _y {
    /**
     * @class
     * @param options - Module options
     * @param options.config - Module config
     * @param options.eventsDispatcher - Common event bus
     */
    constructor({ config: e, eventsDispatcher: t }) {
      if (this.nodes = {}, this.listeners = new Fe(), this.readOnlyMutableListeners = {
        /**
         * Assigns event listener on DOM element and pushes into special array that might be removed
         *
         * @param {EventTarget} element - DOM Element
         * @param {string} eventType - Event name
         * @param {Function} handler - Event handler
         * @param {boolean|AddEventListenerOptions} options - Listening options
         */
        on: (o3, i2, n2, r2 = false) => {
          this.mutableListenerIds.push(
            this.listeners.on(o3, i2, n2, r2)
          );
        },
        /**
         * Clears all mutable listeners
         */
        clearAll: () => {
          for (const o3 of this.mutableListenerIds)
            this.listeners.offById(o3);
          this.mutableListenerIds = [];
        }
      }, this.mutableListenerIds = [], new.target === _y)
        throw new TypeError("Constructors for abstract class Module are not allowed.");
      this.config = e, this.eventsDispatcher = t;
    }
    /**
     * Editor modules setter
     *
     * @param {EditorModules} Editor - Editor's Modules
     */
    set state(e) {
      this.Editor = e;
    }
    /**
     * Remove memorized nodes
     */
    removeAllNodes() {
      for (const e in this.nodes) {
        const t = this.nodes[e];
        t instanceof HTMLElement && t.remove();
      }
    }
    /**
     * Returns true if current direction is RTL (Right-To-Left)
     */
    get isRtl() {
      return this.config.i18n.direction === "rtl";
    }
  };
  var b = class _b {
    constructor() {
      this.instance = null, this.selection = null, this.savedSelectionRange = null, this.isFakeBackgroundEnabled = false, this.commandBackground = "backColor", this.commandRemoveFormat = "removeFormat";
    }
    /**
     * Editor styles
     *
     * @returns {{editorWrapper: string, editorZone: string}}
     */
    static get CSS() {
      return {
        editorWrapper: "codex-editor",
        editorZone: "codex-editor__redactor"
      };
    }
    /**
     * Returns selected anchor
     * {@link https://developer.mozilla.org/ru/docs/Web/API/Selection/anchorNode}
     *
     * @returns {Node|null}
     */
    static get anchorNode() {
      const e = window.getSelection();
      return e ? e.anchorNode : null;
    }
    /**
     * Returns selected anchor element
     *
     * @returns {Element|null}
     */
    static get anchorElement() {
      const e = window.getSelection();
      if (!e)
        return null;
      const t = e.anchorNode;
      return t ? c.isElement(t) ? t : t.parentElement : null;
    }
    /**
     * Returns selection offset according to the anchor node
     * {@link https://developer.mozilla.org/ru/docs/Web/API/Selection/anchorOffset}
     *
     * @returns {number|null}
     */
    static get anchorOffset() {
      const e = window.getSelection();
      return e ? e.anchorOffset : null;
    }
    /**
     * Is current selection range collapsed
     *
     * @returns {boolean|null}
     */
    static get isCollapsed() {
      const e = window.getSelection();
      return e ? e.isCollapsed : null;
    }
    /**
     * Check current selection if it is at Editor's zone
     *
     * @returns {boolean}
     */
    static get isAtEditor() {
      return this.isSelectionAtEditor(_b.get());
    }
    /**
     * Check if passed selection is at Editor's zone
     *
     * @param selection - Selection object to check
     */
    static isSelectionAtEditor(e) {
      if (!e)
        return false;
      let t = e.anchorNode || e.focusNode;
      t && t.nodeType === Node.TEXT_NODE && (t = t.parentNode);
      let o3 = null;
      return t && t instanceof Element && (o3 = t.closest(`.${_b.CSS.editorZone}`)), o3 ? o3.nodeType === Node.ELEMENT_NODE : false;
    }
    /**
     * Check if passed range at Editor zone
     *
     * @param range - range to check
     */
    static isRangeAtEditor(e) {
      if (!e)
        return;
      let t = e.startContainer;
      t && t.nodeType === Node.TEXT_NODE && (t = t.parentNode);
      let o3 = null;
      return t && t instanceof Element && (o3 = t.closest(`.${_b.CSS.editorZone}`)), o3 ? o3.nodeType === Node.ELEMENT_NODE : false;
    }
    /**
     * Methods return boolean that true if selection exists on the page
     */
    static get isSelectionExists() {
      return !!_b.get().anchorNode;
    }
    /**
     * Return first range
     *
     * @returns {Range|null}
     */
    static get range() {
      return this.getRangeFromSelection(this.get());
    }
    /**
     * Returns range from passed Selection object
     *
     * @param selection - Selection object to get Range from
     */
    static getRangeFromSelection(e) {
      return e && e.rangeCount ? e.getRangeAt(0) : null;
    }
    /**
     * Calculates position and size of selected text
     *
     * @returns {DOMRect | ClientRect}
     */
    static get rect() {
      let e = document.selection, t, o3 = {
        x: 0,
        y: 0,
        width: 0,
        height: 0
      };
      if (e && e.type !== "Control")
        return e = e, t = e.createRange(), o3.x = t.boundingLeft, o3.y = t.boundingTop, o3.width = t.boundingWidth, o3.height = t.boundingHeight, o3;
      if (!window.getSelection)
        return T("Method window.getSelection is not supported", "warn"), o3;
      if (e = window.getSelection(), e.rangeCount === null || isNaN(e.rangeCount))
        return T("Method SelectionUtils.rangeCount is not supported", "warn"), o3;
      if (e.rangeCount === 0)
        return o3;
      if (t = e.getRangeAt(0).cloneRange(), t.getBoundingClientRect && (o3 = t.getBoundingClientRect()), o3.x === 0 && o3.y === 0) {
        const i2 = document.createElement("span");
        if (i2.getBoundingClientRect) {
          i2.appendChild(document.createTextNode("\u200B")), t.insertNode(i2), o3 = i2.getBoundingClientRect();
          const n2 = i2.parentNode;
          n2.removeChild(i2), n2.normalize();
        }
      }
      return o3;
    }
    /**
     * Returns selected text as String
     *
     * @returns {string}
     */
    static get text() {
      return window.getSelection ? window.getSelection().toString() : "";
    }
    /**
     * Returns window SelectionUtils
     * {@link https://developer.mozilla.org/ru/docs/Web/API/Window/getSelection}
     *
     * @returns {Selection}
     */
    static get() {
      return window.getSelection();
    }
    /**
     * Set focus to contenteditable or native input element
     *
     * @param element - element where to set focus
     * @param offset - offset of cursor
     */
    static setCursor(e, t = 0) {
      const o3 = document.createRange(), i2 = window.getSelection();
      return c.isNativeInput(e) ? c.canSetCaret(e) ? (e.focus(), e.selectionStart = e.selectionEnd = t, e.getBoundingClientRect()) : void 0 : (o3.setStart(e, t), o3.setEnd(e, t), i2.removeAllRanges(), i2.addRange(o3), o3.getBoundingClientRect());
    }
    /**
     * Check if current range exists and belongs to container
     *
     * @param container - where range should be
     */
    static isRangeInsideContainer(e) {
      const t = _b.range;
      return t === null ? false : e.contains(t.startContainer);
    }
    /**
     * Adds fake cursor to the current range
     */
    static addFakeCursor() {
      const e = _b.range;
      if (e === null)
        return;
      const t = c.make("span", "codex-editor__fake-cursor");
      t.dataset.mutationFree = "true", e.collapse(), e.insertNode(t);
    }
    /**
     * Check if passed element contains a fake cursor
     *
     * @param el - where to check
     */
    static isFakeCursorInsideContainer(e) {
      return c.find(e, ".codex-editor__fake-cursor") !== null;
    }
    /**
     * Removes fake cursor from a container
     *
     * @param container - container to look for
     */
    static removeFakeCursor(e = document.body) {
      const t = c.find(e, ".codex-editor__fake-cursor");
      t && t.remove();
    }
    /**
     * Removes fake background
     */
    removeFakeBackground() {
      this.isFakeBackgroundEnabled && (this.isFakeBackgroundEnabled = false, document.execCommand(this.commandRemoveFormat));
    }
    /**
     * Sets fake background
     */
    setFakeBackground() {
      document.execCommand(this.commandBackground, false, "#a8d6ff"), this.isFakeBackgroundEnabled = true;
    }
    /**
     * Save SelectionUtils's range
     */
    save() {
      this.savedSelectionRange = _b.range;
    }
    /**
     * Restore saved SelectionUtils's range
     */
    restore() {
      if (!this.savedSelectionRange)
        return;
      const e = window.getSelection();
      e.removeAllRanges(), e.addRange(this.savedSelectionRange);
    }
    /**
     * Clears saved selection
     */
    clearSaved() {
      this.savedSelectionRange = null;
    }
    /**
     * Collapse current selection
     */
    collapseToEnd() {
      const e = window.getSelection(), t = document.createRange();
      t.selectNodeContents(e.focusNode), t.collapse(false), e.removeAllRanges(), e.addRange(t);
    }
    /**
     * Looks ahead to find passed tag from current selection
     *
     * @param  {string} tagName       - tag to found
     * @param  {string} [className]   - tag's class name
     * @param  {number} [searchDepth] - count of tags that can be included. For better performance.
     * @returns {HTMLElement|null}
     */
    findParentTag(e, t, o3 = 10) {
      const i2 = window.getSelection();
      let n2 = null;
      return !i2 || !i2.anchorNode || !i2.focusNode ? null : ([
        /** the Node in which the selection begins */
        i2.anchorNode,
        /** the Node in which the selection ends */
        i2.focusNode
      ].forEach((a4) => {
        let l4 = o3;
        for (; l4 > 0 && a4.parentNode && !(a4.tagName === e && (n2 = a4, t && a4.classList && !a4.classList.contains(t) && (n2 = null), n2)); )
          a4 = a4.parentNode, l4--;
      }), n2);
    }
    /**
     * Expands selection range to the passed parent node
     *
     * @param {HTMLElement} element - element which contents should be selected
     */
    expandToTag(e) {
      const t = window.getSelection();
      t.removeAllRanges();
      const o3 = document.createRange();
      o3.selectNodeContents(e), t.addRange(o3);
    }
  };
  function Qt(s, e) {
    const { type: t, target: o3, addedNodes: i2, removedNodes: n2 } = s;
    if (o3 === e)
      return true;
    if (["characterData", "attributes"].includes(t)) {
      const l4 = o3.nodeType === Node.TEXT_NODE ? o3.parentNode : o3;
      return e.contains(l4);
    }
    const r2 = Array.from(i2).some((l4) => e.contains(l4)), a4 = Array.from(n2).some((l4) => e.contains(l4));
    return r2 || a4;
  }
  var Ae = "redactor dom changed";
  var pt = "block changed";
  var ft = "fake cursor is about to be toggled";
  var gt = "fake cursor have been set";
  function ot(s, e) {
    return s.mergeable && s.name === e.name;
  }
  function eo(s, e) {
    const t = e == null ? void 0 : e.export;
    return M(t) ? t(s) : G(t) ? s[t] : (t !== void 0 && T("Conversion \xABexport\xBB property must be a string or function. String means key of saved data object to export. Function should export processed string to export."), "");
  }
  function to(s, e) {
    const t = e == null ? void 0 : e.import;
    return M(t) ? t(s) : G(t) ? {
      [t]: s
    } : (t !== void 0 && T("Conversion \xABimport\xBB property must be a string or function. String means key of tool data to import. Function accepts a imported string and return composed tool data."), {});
  }
  var X = /* @__PURE__ */ ((s) => (s.APPEND_CALLBACK = "appendCallback", s.RENDERED = "rendered", s.MOVED = "moved", s.UPDATED = "updated", s.REMOVED = "removed", s.ON_PASTE = "onPaste", s))(X || {});
  var R = class _R extends Ee {
    /**
     * @param options - block constructor options
     * @param [options.id] - block's id. Will be generated if omitted.
     * @param options.data - Tool's initial data
     * @param options.tool — block's tool
     * @param options.api - Editor API module for pass it to the Block Tunes
     * @param options.readOnly - Read-Only flag
     * @param [eventBus] - Editor common event bus. Allows to subscribe on some Editor events. Could be omitted when "virtual" Block is created. See BlocksAPI@composeBlockData.
     */
    constructor({
      id: e = Yt(),
      data: t,
      tool: o3,
      api: i2,
      readOnly: n2,
      tunesData: r2
    }, a4) {
      super(), this.cachedInputs = [], this.toolRenderedElement = null, this.tunesInstances = /* @__PURE__ */ new Map(), this.defaultTunesInstances = /* @__PURE__ */ new Map(), this.unavailableTunesData = {}, this.inputIndex = 0, this.editorEventBus = null, this.handleFocus = () => {
        this.dropInputsCache(), this.updateCurrentInput();
      }, this.didMutated = (l4 = void 0) => {
        const d4 = l4 === void 0, u2 = l4 instanceof InputEvent;
        !d4 && !u2 && this.detectToolRootChange(l4);
        let h3;
        d4 || u2 ? h3 = true : h3 = !(l4.length > 0 && l4.every((x) => {
          const { addedNodes: p, removedNodes: m, target: L } = x;
          return [
            ...Array.from(p),
            ...Array.from(m),
            L
          ].some((S) => (c.isElement(S) || (S = S.parentElement), S && S.closest('[data-mutation-free="true"]') !== null));
        })), h3 && (this.dropInputsCache(), this.updateCurrentInput(), this.call(
          "updated"
          /* UPDATED */
        ), this.emit("didMutated", this));
      }, this.name = o3.name, this.id = e, this.settings = o3.settings, this.config = o3.settings.config || {}, this.api = i2, this.editorEventBus = a4 || null, this.blockAPI = new ee(this), this.tool = o3, this.toolInstance = o3.create(t, this.blockAPI, n2), this.tunes = o3.tunes, this.composeTunes(r2), this.holder = this.compose(), window.requestIdleCallback(() => {
        this.watchBlockMutations(), this.addInputEvents();
      });
    }
    /**
     * CSS classes for the Block
     *
     * @returns {{wrapper: string, content: string}}
     */
    static get CSS() {
      return {
        wrapper: "ce-block",
        wrapperStretched: "ce-block--stretched",
        content: "ce-block__content",
        selected: "ce-block--selected",
        dropTarget: "ce-block--drop-target"
      };
    }
    /**
     * Find and return all editable elements (contenteditable and native inputs) in the Tool HTML
     *
     * @returns {HTMLElement[]}
     */
    get inputs() {
      if (this.cachedInputs.length !== 0)
        return this.cachedInputs;
      const e = c.findAllInputs(this.holder);
      return this.inputIndex > e.length - 1 && (this.inputIndex = e.length - 1), this.cachedInputs = e, e;
    }
    /**
     * Return current Tool`s input
     *
     * @returns {HTMLElement}
     */
    get currentInput() {
      return this.inputs[this.inputIndex];
    }
    /**
     * Set input index to the passed element
     *
     * @param {HTMLElement | Node} element - HTML Element to set as current input
     */
    set currentInput(e) {
      const t = this.inputs.findIndex((o3) => o3 === e || o3.contains(e));
      t !== -1 && (this.inputIndex = t);
    }
    /**
     * Return first Tool`s input
     *
     * @returns {HTMLElement}
     */
    get firstInput() {
      return this.inputs[0];
    }
    /**
     * Return first Tool`s input
     *
     * @returns {HTMLElement}
     */
    get lastInput() {
      const e = this.inputs;
      return e[e.length - 1];
    }
    /**
     * Return next Tool`s input or undefined if it doesn't exist
     *
     * @returns {HTMLElement}
     */
    get nextInput() {
      return this.inputs[this.inputIndex + 1];
    }
    /**
     * Return previous Tool`s input or undefined if it doesn't exist
     *
     * @returns {HTMLElement}
     */
    get previousInput() {
      return this.inputs[this.inputIndex - 1];
    }
    /**
     * Get Block's JSON data
     *
     * @returns {object}
     */
    get data() {
      return this.save().then((e) => e && !W(e.data) ? e.data : {});
    }
    /**
     * Returns tool's sanitizer config
     *
     * @returns {object}
     */
    get sanitize() {
      return this.tool.sanitizeConfig;
    }
    /**
     * is block mergeable
     * We plugin have merge function then we call it mergeable
     *
     * @returns {boolean}
     */
    get mergeable() {
      return M(this.toolInstance.merge);
    }
    /**
     * If Block contains inputs, it is focusable
     */
    get focusable() {
      return this.inputs.length !== 0;
    }
    /**
     * Check block for emptiness
     *
     * @returns {boolean}
     */
    get isEmpty() {
      const e = c.isEmpty(this.pluginsContent, "/"), t = !this.hasMedia;
      return e && t;
    }
    /**
     * Check if block has a media content such as images, iframe and other
     *
     * @returns {boolean}
     */
    get hasMedia() {
      const e = [
        "img",
        "iframe",
        "video",
        "audio",
        "source",
        "input",
        "textarea",
        "twitterwidget"
      ];
      return !!this.holder.querySelector(e.join(","));
    }
    /**
     * Set selected state
     * We don't need to mark Block as Selected when it is empty
     *
     * @param {boolean} state - 'true' to select, 'false' to remove selection
     */
    set selected(e) {
      var i2, n2;
      this.holder.classList.toggle(_R.CSS.selected, e);
      const t = e === true && b.isRangeInsideContainer(this.holder), o3 = e === false && b.isFakeCursorInsideContainer(this.holder);
      (t || o3) && ((i2 = this.editorEventBus) == null || i2.emit(ft, { state: e }), t ? b.addFakeCursor() : b.removeFakeCursor(this.holder), (n2 = this.editorEventBus) == null || n2.emit(gt, { state: e }));
    }
    /**
     * Returns True if it is Selected
     *
     * @returns {boolean}
     */
    get selected() {
      return this.holder.classList.contains(_R.CSS.selected);
    }
    /**
     * Set stretched state
     *
     * @param {boolean} state - 'true' to enable, 'false' to disable stretched state
     */
    set stretched(e) {
      this.holder.classList.toggle(_R.CSS.wrapperStretched, e);
    }
    /**
     * Return Block's stretched state
     *
     * @returns {boolean}
     */
    get stretched() {
      return this.holder.classList.contains(_R.CSS.wrapperStretched);
    }
    /**
     * Toggle drop target state
     *
     * @param {boolean} state - 'true' if block is drop target, false otherwise
     */
    set dropTarget(e) {
      this.holder.classList.toggle(_R.CSS.dropTarget, e);
    }
    /**
     * Returns Plugins content
     *
     * @returns {HTMLElement}
     */
    get pluginsContent() {
      return this.toolRenderedElement;
    }
    /**
     * Calls Tool's method
     *
     * Method checks tool property {MethodName}. Fires method with passes params If it is instance of Function
     *
     * @param {string} methodName - method to call
     * @param {object} params - method argument
     */
    call(e, t) {
      if (M(this.toolInstance[e])) {
        e === "appendCallback" && T(
          "`appendCallback` hook is deprecated and will be removed in the next major release. Use `rendered` hook instead",
          "warn"
        );
        try {
          this.toolInstance[e].call(this.toolInstance, t);
        } catch (o3) {
          T(`Error during '${e}' call: ${o3.message}`, "error");
        }
      }
    }
    /**
     * Call plugins merge method
     *
     * @param {BlockToolData} data - data to merge
     */
    async mergeWith(e) {
      await this.toolInstance.merge(e);
    }
    /**
     * Extracts data from Block
     * Groups Tool's save processing time
     *
     * @returns {object}
     */
    async save() {
      const e = await this.toolInstance.save(this.pluginsContent), t = this.unavailableTunesData;
      [
        ...this.tunesInstances.entries(),
        ...this.defaultTunesInstances.entries()
      ].forEach(([n2, r2]) => {
        if (M(r2.save))
          try {
            t[n2] = r2.save();
          } catch (a4) {
            T(`Tune ${r2.constructor.name} save method throws an Error %o`, "warn", a4);
          }
      });
      const o3 = window.performance.now();
      let i2;
      return Promise.resolve(e).then((n2) => (i2 = window.performance.now(), {
        id: this.id,
        tool: this.name,
        data: n2,
        tunes: t,
        time: i2 - o3
      })).catch((n2) => {
        T(`Saving process for ${this.name} tool failed due to the ${n2}`, "log", "red");
      });
    }
    /**
     * Uses Tool's validation method to check the correctness of output data
     * Tool's validation method is optional
     *
     * @description Method returns true|false whether data passed the validation or not
     * @param {BlockToolData} data - data to validate
     * @returns {Promise<boolean>} valid
     */
    async validate(e) {
      let t = true;
      return this.toolInstance.validate instanceof Function && (t = await this.toolInstance.validate(e)), t;
    }
    /**
     * Returns data to render in tunes menu.
     * Splits block tunes settings into 2 groups: popover items and custom html.
     */
    getTunes() {
      const e = document.createElement("div"), t = [], o3 = typeof this.toolInstance.renderSettings == "function" ? this.toolInstance.renderSettings() : [], i2 = [
        ...this.tunesInstances.values(),
        ...this.defaultTunesInstances.values()
      ].map((n2) => n2.render());
      return [o3, i2].flat().forEach((n2) => {
        c.isElement(n2) ? e.appendChild(n2) : Array.isArray(n2) ? t.push(...n2) : t.push(n2);
      }), [t, e];
    }
    /**
     * Update current input index with selection anchor node
     */
    updateCurrentInput() {
      this.currentInput = c.isNativeInput(document.activeElement) || !b.anchorNode ? document.activeElement : b.anchorNode;
    }
    /**
     * Allows to say Editor that Block was changed. Used to manually trigger Editor's 'onChange' callback
     * Can be useful for block changes invisible for editor core.
     */
    dispatchChange() {
      this.didMutated();
    }
    /**
     * Call Tool instance destroy method
     */
    destroy() {
      this.unwatchBlockMutations(), this.removeInputEvents(), super.destroy(), M(this.toolInstance.destroy) && this.toolInstance.destroy();
    }
    /**
     * Tool could specify several entries to be displayed at the Toolbox (for example, "Heading 1", "Heading 2", "Heading 3")
     * This method returns the entry that is related to the Block (depended on the Block data)
     */
    async getActiveToolboxEntry() {
      const e = this.tool.toolbox;
      if (e.length === 1)
        return Promise.resolve(this.tool.toolbox[0]);
      const t = await this.data;
      return e.find((i2) => Object.entries(i2.data).some(([n2, r2]) => t[n2] && Vt(t[n2], r2)));
    }
    /**
     * Exports Block data as string using conversion config
     */
    async exportDataAsString() {
      const e = await this.data;
      return eo(e, this.tool.conversionConfig);
    }
    /**
     * Make default Block wrappers and put Tool`s content there
     *
     * @returns {HTMLDivElement}
     */
    compose() {
      const e = c.make("div", _R.CSS.wrapper), t = c.make("div", _R.CSS.content), o3 = this.toolInstance.render();
      e.dataset.id = this.id, this.toolRenderedElement = o3, t.appendChild(this.toolRenderedElement);
      let i2 = t;
      return [...this.tunesInstances.values(), ...this.defaultTunesInstances.values()].forEach((n2) => {
        if (M(n2.wrap))
          try {
            i2 = n2.wrap(i2);
          } catch (r2) {
            T(`Tune ${n2.constructor.name} wrap method throws an Error %o`, "warn", r2);
          }
      }), e.appendChild(i2), e;
    }
    /**
     * Instantiate Block Tunes
     *
     * @param tunesData - current Block tunes data
     * @private
     */
    composeTunes(e) {
      Array.from(this.tunes.values()).forEach((t) => {
        (t.isInternal ? this.defaultTunesInstances : this.tunesInstances).set(t.name, t.create(e[t.name], this.blockAPI));
      }), Object.entries(e).forEach(([t, o3]) => {
        this.tunesInstances.has(t) || (this.unavailableTunesData[t] = o3);
      });
    }
    /**
     * Adds focus event listeners to all inputs and contenteditable
     */
    addInputEvents() {
      this.inputs.forEach((e) => {
        e.addEventListener("focus", this.handleFocus), c.isNativeInput(e) && e.addEventListener("input", this.didMutated);
      });
    }
    /**
     * removes focus event listeners from all inputs and contenteditable
     */
    removeInputEvents() {
      this.inputs.forEach((e) => {
        e.removeEventListener("focus", this.handleFocus), c.isNativeInput(e) && e.removeEventListener("input", this.didMutated);
      });
    }
    /**
     * Listen common editor Dom Changed event and detect mutations related to the  Block
     */
    watchBlockMutations() {
      var e;
      this.redactorDomChangedCallback = (t) => {
        const { mutations: o3 } = t;
        o3.some((n2) => Qt(n2, this.toolRenderedElement)) && this.didMutated(o3);
      }, (e = this.editorEventBus) == null || e.on(Ae, this.redactorDomChangedCallback);
    }
    /**
     * Remove redactor dom change event listener
     */
    unwatchBlockMutations() {
      var e;
      (e = this.editorEventBus) == null || e.off(Ae, this.redactorDomChangedCallback);
    }
    /**
     * Sometimes Tool can replace own main element, for example H2 -> H4 or UL -> OL
     * We need to detect such changes and update a link to tools main element with the new one
     *
     * @param mutations - records of block content mutations
     */
    detectToolRootChange(e) {
      e.forEach((t) => {
        if (Array.from(t.removedNodes).includes(this.toolRenderedElement)) {
          const i2 = t.addedNodes[t.addedNodes.length - 1];
          this.toolRenderedElement = i2;
        }
      });
    }
    /**
     * Clears inputs cached value
     */
    dropInputsCache() {
      this.cachedInputs = [];
    }
  };
  var oo = class extends y {
    constructor() {
      super(...arguments), this.insert = (e = this.config.defaultBlock, t = {}, o3 = {}, i2, n2, r2, a4) => {
        const l4 = this.Editor.BlockManager.insert({
          id: a4,
          tool: e,
          data: t,
          index: i2,
          needToFocus: n2,
          replace: r2
        });
        return new ee(l4);
      }, this.composeBlockData = async (e) => {
        const t = this.Editor.Tools.blockTools.get(e);
        return new R({
          tool: t,
          api: this.Editor.API,
          readOnly: true,
          data: {},
          tunesData: {}
        }).data;
      }, this.update = async (e, t) => {
        const { BlockManager: o3 } = this.Editor, i2 = o3.getBlockById(e);
        if (i2 === void 0)
          throw new Error(`Block with id "${e}" not found`);
        const n2 = await o3.update(i2, t);
        return new ee(n2);
      }, this.convert = (e, t, o3) => {
        var h3, f;
        const { BlockManager: i2, Tools: n2 } = this.Editor, r2 = i2.getBlockById(e);
        if (!r2)
          throw new Error(`Block with id "${e}" not found`);
        const a4 = n2.blockTools.get(r2.name), l4 = n2.blockTools.get(t);
        if (!l4)
          throw new Error(`Block Tool with type "${t}" not found`);
        const d4 = ((h3 = a4 == null ? void 0 : a4.conversionConfig) == null ? void 0 : h3.export) !== void 0, u2 = ((f = l4.conversionConfig) == null ? void 0 : f.import) !== void 0;
        if (d4 && u2)
          i2.convert(r2, t, o3);
        else {
          const x = [
            d4 ? false : re(r2.name),
            u2 ? false : re(t)
          ].filter(Boolean).join(" and ");
          throw new Error(`Conversion from "${r2.name}" to "${t}" is not possible. ${x} tool(s) should provide a "conversionConfig"`);
        }
      }, this.insertMany = (e, t = this.Editor.BlockManager.blocks.length - 1) => {
        this.validateIndex(t);
        const o3 = e.map(({ id: i2, type: n2, data: r2 }) => this.Editor.BlockManager.composeBlock({
          id: i2,
          tool: n2 || this.config.defaultBlock,
          data: r2
        }));
        return this.Editor.BlockManager.insertMany(o3, t), o3.map((i2) => new ee(i2));
      };
    }
    /**
     * Available methods
     *
     * @returns {Blocks}
     */
    get methods() {
      return {
        clear: () => this.clear(),
        render: (e) => this.render(e),
        renderFromHTML: (e) => this.renderFromHTML(e),
        delete: (e) => this.delete(e),
        swap: (e, t) => this.swap(e, t),
        move: (e, t) => this.move(e, t),
        getBlockByIndex: (e) => this.getBlockByIndex(e),
        getById: (e) => this.getById(e),
        getCurrentBlockIndex: () => this.getCurrentBlockIndex(),
        getBlockIndex: (e) => this.getBlockIndex(e),
        getBlocksCount: () => this.getBlocksCount(),
        stretchBlock: (e, t = true) => this.stretchBlock(e, t),
        insertNewBlock: () => this.insertNewBlock(),
        insert: this.insert,
        insertMany: this.insertMany,
        update: this.update,
        composeBlockData: this.composeBlockData,
        convert: this.convert
      };
    }
    /**
     * Returns Blocks count
     *
     * @returns {number}
     */
    getBlocksCount() {
      return this.Editor.BlockManager.blocks.length;
    }
    /**
     * Returns current block index
     *
     * @returns {number}
     */
    getCurrentBlockIndex() {
      return this.Editor.BlockManager.currentBlockIndex;
    }
    /**
     * Returns the index of Block by id;
     *
     * @param id - block id
     */
    getBlockIndex(e) {
      const t = this.Editor.BlockManager.getBlockById(e);
      if (!t) {
        Y("There is no block with id `" + e + "`", "warn");
        return;
      }
      return this.Editor.BlockManager.getBlockIndex(t);
    }
    /**
     * Returns BlockAPI object by Block index
     *
     * @param {number} index - index to get
     */
    getBlockByIndex(e) {
      const t = this.Editor.BlockManager.getBlockByIndex(e);
      if (t === void 0) {
        Y("There is no block at index `" + e + "`", "warn");
        return;
      }
      return new ee(t);
    }
    /**
     * Returns BlockAPI object by Block id
     *
     * @param id - id of block to get
     */
    getById(e) {
      const t = this.Editor.BlockManager.getBlockById(e);
      return t === void 0 ? (Y("There is no block with id `" + e + "`", "warn"), null) : new ee(t);
    }
    /**
     * Call Block Manager method that swap Blocks
     *
     * @param {number} fromIndex - position of first Block
     * @param {number} toIndex - position of second Block
     * @deprecated — use 'move' instead
     */
    swap(e, t) {
      T(
        "`blocks.swap()` method is deprecated and will be removed in the next major release. Use `block.move()` method instead",
        "info"
      ), this.Editor.BlockManager.swap(e, t);
    }
    /**
     * Move block from one index to another
     *
     * @param {number} toIndex - index to move to
     * @param {number} fromIndex - index to move from
     */
    move(e, t) {
      this.Editor.BlockManager.move(e, t);
    }
    /**
     * Deletes Block
     *
     * @param {number} blockIndex - index of Block to delete
     */
    delete(e = this.Editor.BlockManager.currentBlockIndex) {
      try {
        const t = this.Editor.BlockManager.getBlockByIndex(e);
        this.Editor.BlockManager.removeBlock(t);
      } catch (t) {
        Y(t, "warn");
        return;
      }
      this.Editor.BlockManager.blocks.length === 0 && this.Editor.BlockManager.insert(), this.Editor.BlockManager.currentBlock && this.Editor.Caret.setToBlock(this.Editor.BlockManager.currentBlock, this.Editor.Caret.positions.END), this.Editor.Toolbar.close();
    }
    /**
     * Clear Editor's area
     */
    async clear() {
      await this.Editor.BlockManager.clear(true), this.Editor.InlineToolbar.close();
    }
    /**
     * Fills Editor with Blocks data
     *
     * @param {OutputData} data — Saved Editor data
     */
    async render(e) {
      if (e === void 0 || e.blocks === void 0)
        throw new Error("Incorrect data passed to the render() method");
      this.Editor.ModificationsObserver.disable(), await this.Editor.BlockManager.clear(), await this.Editor.Renderer.render(e.blocks), this.Editor.ModificationsObserver.enable();
    }
    /**
     * Render passed HTML string
     *
     * @param {string} data - HTML string to render
     * @returns {Promise<void>}
     */
    renderFromHTML(e) {
      return this.Editor.BlockManager.clear(), this.Editor.Paste.processText(e, true);
    }
    /**
     * Stretch Block's content
     *
     * @param {number} index - index of Block to stretch
     * @param {boolean} status - true to enable, false to disable
     * @deprecated Use BlockAPI interface to stretch Blocks
     */
    stretchBlock(e, t = true) {
      Le(
        true,
        "blocks.stretchBlock()",
        "BlockAPI"
      );
      const o3 = this.Editor.BlockManager.getBlockByIndex(e);
      o3 && (o3.stretched = t);
    }
    /**
     * Insert new Block
     * After set caret to this Block
     *
     * @todo remove in 3.0.0
     * @deprecated with insert() method
     */
    insertNewBlock() {
      T("Method blocks.insertNewBlock() is deprecated and it will be removed in the next major release. Use blocks.insert() instead.", "warn"), this.insert();
    }
    /**
     * Validated block index and throws an error if it's invalid
     *
     * @param index - index to validate
     */
    validateIndex(e) {
      if (typeof e != "number")
        throw new Error("Index should be a number");
      if (e < 0)
        throw new Error("Index should be greater than or equal to 0");
      if (e === null)
        throw new Error("Index should be greater than or equal to 0");
    }
  };
  var io = class extends y {
    constructor() {
      super(...arguments), this.setToFirstBlock = (e = this.Editor.Caret.positions.DEFAULT, t = 0) => this.Editor.BlockManager.firstBlock ? (this.Editor.Caret.setToBlock(this.Editor.BlockManager.firstBlock, e, t), true) : false, this.setToLastBlock = (e = this.Editor.Caret.positions.DEFAULT, t = 0) => this.Editor.BlockManager.lastBlock ? (this.Editor.Caret.setToBlock(this.Editor.BlockManager.lastBlock, e, t), true) : false, this.setToPreviousBlock = (e = this.Editor.Caret.positions.DEFAULT, t = 0) => this.Editor.BlockManager.previousBlock ? (this.Editor.Caret.setToBlock(this.Editor.BlockManager.previousBlock, e, t), true) : false, this.setToNextBlock = (e = this.Editor.Caret.positions.DEFAULT, t = 0) => this.Editor.BlockManager.nextBlock ? (this.Editor.Caret.setToBlock(this.Editor.BlockManager.nextBlock, e, t), true) : false, this.setToBlock = (e, t = this.Editor.Caret.positions.DEFAULT, o3 = 0) => this.Editor.BlockManager.blocks[e] ? (this.Editor.Caret.setToBlock(this.Editor.BlockManager.blocks[e], t, o3), true) : false, this.focus = (e = false) => e ? this.setToLastBlock(this.Editor.Caret.positions.END) : this.setToFirstBlock(this.Editor.Caret.positions.START);
    }
    /**
     * Available methods
     *
     * @returns {Caret}
     */
    get methods() {
      return {
        setToFirstBlock: this.setToFirstBlock,
        setToLastBlock: this.setToLastBlock,
        setToPreviousBlock: this.setToPreviousBlock,
        setToNextBlock: this.setToNextBlock,
        setToBlock: this.setToBlock,
        focus: this.focus
      };
    }
  };
  var no = class extends y {
    /**
     * Available methods
     *
     * @returns {Events}
     */
    get methods() {
      return {
        emit: (e, t) => this.emit(e, t),
        off: (e, t) => this.off(e, t),
        on: (e, t) => this.on(e, t)
      };
    }
    /**
     * Subscribe on Events
     *
     * @param {string} eventName - event name to subscribe
     * @param {Function} callback - event handler
     */
    on(e, t) {
      this.eventsDispatcher.on(e, t);
    }
    /**
     * Emit event with data
     *
     * @param {string} eventName - event to emit
     * @param {object} data - event's data
     */
    emit(e, t) {
      this.eventsDispatcher.emit(e, t);
    }
    /**
     * Unsubscribe from Event
     *
     * @param {string} eventName - event to unsubscribe
     * @param {Function} callback - event handler
     */
    off(e, t) {
      this.eventsDispatcher.off(e, t);
    }
  };
  var He = class _He extends y {
    /**
     * Return namespace section for tool or block tune
     *
     * @param tool - tool object
     */
    static getNamespace(e) {
      return e.isTune() ? `blockTunes.${e.name}` : `tools.${e.name}`;
    }
    /**
     * Return I18n API methods with global dictionary access
     */
    get methods() {
      return {
        t: () => {
          Y("I18n.t() method can be accessed only from Tools", "warn");
        }
      };
    }
    /**
     * Return I18n API methods with tool namespaced dictionary
     *
     * @param tool - Tool object
     */
    getMethodsForTool(e) {
      return Object.assign(
        this.methods,
        {
          t: (t) => z.t(_He.getNamespace(e), t)
        }
      );
    }
  };
  var so = class extends y {
    /**
     * Editor.js Core API modules
     */
    get methods() {
      return {
        blocks: this.Editor.BlocksAPI.methods,
        caret: this.Editor.CaretAPI.methods,
        events: this.Editor.EventsAPI.methods,
        listeners: this.Editor.ListenersAPI.methods,
        notifier: this.Editor.NotifierAPI.methods,
        sanitizer: this.Editor.SanitizerAPI.methods,
        saver: this.Editor.SaverAPI.methods,
        selection: this.Editor.SelectionAPI.methods,
        styles: this.Editor.StylesAPI.classes,
        toolbar: this.Editor.ToolbarAPI.methods,
        inlineToolbar: this.Editor.InlineToolbarAPI.methods,
        tooltip: this.Editor.TooltipAPI.methods,
        i18n: this.Editor.I18nAPI.methods,
        readOnly: this.Editor.ReadOnlyAPI.methods,
        ui: this.Editor.UiAPI.methods
      };
    }
    /**
     * Returns Editor.js Core API methods for passed tool
     *
     * @param tool - tool object
     */
    getMethodsForTool(e) {
      return Object.assign(
        this.methods,
        {
          i18n: this.Editor.I18nAPI.getMethodsForTool(e)
        }
      );
    }
  };
  var ro = class extends y {
    /**
     * Available methods
     *
     * @returns {InlineToolbar}
     */
    get methods() {
      return {
        close: () => this.close(),
        open: () => this.open()
      };
    }
    /**
     * Open Inline Toolbar
     */
    open() {
      this.Editor.InlineToolbar.tryToShow();
    }
    /**
     * Close Inline Toolbar
     */
    close() {
      this.Editor.InlineToolbar.close();
    }
  };
  var ao = class extends y {
    /**
     * Available methods
     *
     * @returns {Listeners}
     */
    get methods() {
      return {
        on: (e, t, o3, i2) => this.on(e, t, o3, i2),
        off: (e, t, o3, i2) => this.off(e, t, o3, i2),
        offById: (e) => this.offById(e)
      };
    }
    /**
     * Ads a DOM event listener. Return it's id.
     *
     * @param {HTMLElement} element - Element to set handler to
     * @param {string} eventType - event type
     * @param {() => void} handler - event handler
     * @param {boolean} useCapture - capture event or not
     */
    on(e, t, o3, i2) {
      return this.listeners.on(e, t, o3, i2);
    }
    /**
     * Removes DOM listener from element
     *
     * @param {Element} element - Element to remove handler from
     * @param eventType - event type
     * @param handler - event handler
     * @param {boolean} useCapture - capture event or not
     */
    off(e, t, o3, i2) {
      this.listeners.off(e, t, o3, i2);
    }
    /**
     * Removes DOM listener by the listener id
     *
     * @param id - id of the listener to remove
     */
    offById(e) {
      this.listeners.offById(e);
    }
  };
  var _e = {};
  var lo = {
    get exports() {
      return _e;
    },
    set exports(s) {
      _e = s;
    }
  };
  (function(s, e) {
    (function(t, o3) {
      s.exports = o3();
    })(window, function() {
      return function(t) {
        var o3 = {};
        function i2(n2) {
          if (o3[n2])
            return o3[n2].exports;
          var r2 = o3[n2] = { i: n2, l: false, exports: {} };
          return t[n2].call(r2.exports, r2, r2.exports, i2), r2.l = true, r2.exports;
        }
        return i2.m = t, i2.c = o3, i2.d = function(n2, r2, a4) {
          i2.o(n2, r2) || Object.defineProperty(n2, r2, { enumerable: true, get: a4 });
        }, i2.r = function(n2) {
          typeof Symbol < "u" && Symbol.toStringTag && Object.defineProperty(n2, Symbol.toStringTag, { value: "Module" }), Object.defineProperty(n2, "__esModule", { value: true });
        }, i2.t = function(n2, r2) {
          if (1 & r2 && (n2 = i2(n2)), 8 & r2 || 4 & r2 && typeof n2 == "object" && n2 && n2.__esModule)
            return n2;
          var a4 = /* @__PURE__ */ Object.create(null);
          if (i2.r(a4), Object.defineProperty(a4, "default", { enumerable: true, value: n2 }), 2 & r2 && typeof n2 != "string")
            for (var l4 in n2)
              i2.d(a4, l4, function(d4) {
                return n2[d4];
              }.bind(null, l4));
          return a4;
        }, i2.n = function(n2) {
          var r2 = n2 && n2.__esModule ? function() {
            return n2.default;
          } : function() {
            return n2;
          };
          return i2.d(r2, "a", r2), r2;
        }, i2.o = function(n2, r2) {
          return Object.prototype.hasOwnProperty.call(n2, r2);
        }, i2.p = "/", i2(i2.s = 0);
      }([function(t, o3, i2) {
        i2(1), /*!
        * Codex JavaScript Notification module
        * https://github.com/codex-team/js-notifier
        */
        t.exports = function() {
          var n2 = i2(6), r2 = "cdx-notify--bounce-in", a4 = null;
          return { show: function(l4) {
            if (l4.message) {
              (function() {
                if (a4)
                  return true;
                a4 = n2.getWrapper(), document.body.appendChild(a4);
              })();
              var d4 = null, u2 = l4.time || 8e3;
              switch (l4.type) {
                case "confirm":
                  d4 = n2.confirm(l4);
                  break;
                case "prompt":
                  d4 = n2.prompt(l4);
                  break;
                default:
                  d4 = n2.alert(l4), window.setTimeout(function() {
                    d4.remove();
                  }, u2);
              }
              a4.appendChild(d4), d4.classList.add(r2);
            }
          } };
        }();
      }, function(t, o3, i2) {
        var n2 = i2(2);
        typeof n2 == "string" && (n2 = [[t.i, n2, ""]]);
        var r2 = { hmr: true, transform: void 0, insertInto: void 0 };
        i2(4)(n2, r2), n2.locals && (t.exports = n2.locals);
      }, function(t, o3, i2) {
        (t.exports = i2(3)(false)).push([t.i, `.cdx-notify--error{background:#fffbfb!important}.cdx-notify--error::before{background:#fb5d5d!important}.cdx-notify__input{max-width:130px;padding:5px 10px;background:#f7f7f7;border:0;border-radius:3px;font-size:13px;color:#656b7c;outline:0}.cdx-notify__input:-ms-input-placeholder{color:#656b7c}.cdx-notify__input::placeholder{color:#656b7c}.cdx-notify__input:focus:-ms-input-placeholder{color:rgba(101,107,124,.3)}.cdx-notify__input:focus::placeholder{color:rgba(101,107,124,.3)}.cdx-notify__button{border:none;border-radius:3px;font-size:13px;padding:5px 10px;cursor:pointer}.cdx-notify__button:last-child{margin-left:10px}.cdx-notify__button--cancel{background:#f2f5f7;box-shadow:0 2px 1px 0 rgba(16,19,29,0);color:#656b7c}.cdx-notify__button--cancel:hover{background:#eee}.cdx-notify__button--confirm{background:#34c992;box-shadow:0 1px 1px 0 rgba(18,49,35,.05);color:#fff}.cdx-notify__button--confirm:hover{background:#33b082}.cdx-notify__btns-wrapper{display:-ms-flexbox;display:flex;-ms-flex-flow:row nowrap;flex-flow:row nowrap;margin-top:5px}.cdx-notify__cross{position:absolute;top:5px;right:5px;width:10px;height:10px;padding:5px;opacity:.54;cursor:pointer}.cdx-notify__cross::after,.cdx-notify__cross::before{content:'';position:absolute;left:9px;top:5px;height:12px;width:2px;background:#575d67}.cdx-notify__cross::before{transform:rotate(-45deg)}.cdx-notify__cross::after{transform:rotate(45deg)}.cdx-notify__cross:hover{opacity:1}.cdx-notifies{position:fixed;z-index:2;bottom:20px;left:20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen,Ubuntu,Cantarell,"Fira Sans","Droid Sans","Helvetica Neue",sans-serif}.cdx-notify{position:relative;width:220px;margin-top:15px;padding:13px 16px;background:#fff;box-shadow:0 11px 17px 0 rgba(23,32,61,.13);border-radius:5px;font-size:14px;line-height:1.4em;word-wrap:break-word}.cdx-notify::before{content:'';position:absolute;display:block;top:0;left:0;width:3px;height:calc(100% - 6px);margin:3px;border-radius:5px;background:0 0}@keyframes bounceIn{0%{opacity:0;transform:scale(.3)}50%{opacity:1;transform:scale(1.05)}70%{transform:scale(.9)}100%{transform:scale(1)}}.cdx-notify--bounce-in{animation-name:bounceIn;animation-duration:.6s;animation-iteration-count:1}.cdx-notify--success{background:#fafffe!important}.cdx-notify--success::before{background:#41ffb1!important}`, ""]);
      }, function(t, o3) {
        t.exports = function(i2) {
          var n2 = [];
          return n2.toString = function() {
            return this.map(function(r2) {
              var a4 = function(l4, d4) {
                var u2 = l4[1] || "", h3 = l4[3];
                if (!h3)
                  return u2;
                if (d4 && typeof btoa == "function") {
                  var f = (p = h3, "/*# sourceMappingURL=data:application/json;charset=utf-8;base64," + btoa(unescape(encodeURIComponent(JSON.stringify(p)))) + " */"), x = h3.sources.map(function(m) {
                    return "/*# sourceURL=" + h3.sourceRoot + m + " */";
                  });
                  return [u2].concat(x).concat([f]).join(`
`);
                }
                var p;
                return [u2].join(`
`);
              }(r2, i2);
              return r2[2] ? "@media " + r2[2] + "{" + a4 + "}" : a4;
            }).join("");
          }, n2.i = function(r2, a4) {
            typeof r2 == "string" && (r2 = [[null, r2, ""]]);
            for (var l4 = {}, d4 = 0; d4 < this.length; d4++) {
              var u2 = this[d4][0];
              typeof u2 == "number" && (l4[u2] = true);
            }
            for (d4 = 0; d4 < r2.length; d4++) {
              var h3 = r2[d4];
              typeof h3[0] == "number" && l4[h3[0]] || (a4 && !h3[2] ? h3[2] = a4 : a4 && (h3[2] = "(" + h3[2] + ") and (" + a4 + ")"), n2.push(h3));
            }
          }, n2;
        };
      }, function(t, o3, i2) {
        var n2, r2, a4 = {}, l4 = (n2 = function() {
          return window && document && document.all && !window.atob;
        }, function() {
          return r2 === void 0 && (r2 = n2.apply(this, arguments)), r2;
        }), d4 = /* @__PURE__ */ function(k) {
          var g2 = {};
          return function(w) {
            if (typeof w == "function")
              return w();
            if (g2[w] === void 0) {
              var E = function(I) {
                return document.querySelector(I);
              }.call(this, w);
              if (window.HTMLIFrameElement && E instanceof window.HTMLIFrameElement)
                try {
                  E = E.contentDocument.head;
                } catch {
                  E = null;
                }
              g2[w] = E;
            }
            return g2[w];
          };
        }(), u2 = null, h3 = 0, f = [], x = i2(5);
        function p(k, g2) {
          for (var w = 0; w < k.length; w++) {
            var E = k[w], I = a4[E.id];
            if (I) {
              I.refs++;
              for (var C = 0; C < I.parts.length; C++)
                I.parts[C](E.parts[C]);
              for (; C < E.parts.length; C++)
                I.parts.push(H(E.parts[C], g2));
            } else {
              var O = [];
              for (C = 0; C < E.parts.length; C++)
                O.push(H(E.parts[C], g2));
              a4[E.id] = { id: E.id, refs: 1, parts: O };
            }
          }
        }
        function m(k, g2) {
          for (var w = [], E = {}, I = 0; I < k.length; I++) {
            var C = k[I], O = g2.base ? C[0] + g2.base : C[0], B = { css: C[1], media: C[2], sourceMap: C[3] };
            E[O] ? E[O].parts.push(B) : w.push(E[O] = { id: O, parts: [B] });
          }
          return w;
        }
        function L(k, g2) {
          var w = d4(k.insertInto);
          if (!w)
            throw new Error("Couldn't find a style target. This probably means that the value for the 'insertInto' parameter is invalid.");
          var E = f[f.length - 1];
          if (k.insertAt === "top")
            E ? E.nextSibling ? w.insertBefore(g2, E.nextSibling) : w.appendChild(g2) : w.insertBefore(g2, w.firstChild), f.push(g2);
          else if (k.insertAt === "bottom")
            w.appendChild(g2);
          else {
            if (typeof k.insertAt != "object" || !k.insertAt.before)
              throw new Error(`[Style Loader]

 Invalid value for parameter 'insertAt' ('options.insertAt') found.
 Must be 'top', 'bottom', or Object.
 (https://github.com/webpack-contrib/style-loader#insertat)
`);
            var I = d4(k.insertInto + " " + k.insertAt.before);
            w.insertBefore(g2, I);
          }
        }
        function A(k) {
          if (k.parentNode === null)
            return false;
          k.parentNode.removeChild(k);
          var g2 = f.indexOf(k);
          g2 >= 0 && f.splice(g2, 1);
        }
        function S(k) {
          var g2 = document.createElement("style");
          return k.attrs.type === void 0 && (k.attrs.type = "text/css"), Z(g2, k.attrs), L(k, g2), g2;
        }
        function Z(k, g2) {
          Object.keys(g2).forEach(function(w) {
            k.setAttribute(w, g2[w]);
          });
        }
        function H(k, g2) {
          var w, E, I, C;
          if (g2.transform && k.css) {
            if (!(C = g2.transform(k.css)))
              return function() {
              };
            k.css = C;
          }
          if (g2.singleton) {
            var O = h3++;
            w = u2 || (u2 = S(g2)), E = ce.bind(null, w, O, false), I = ce.bind(null, w, O, true);
          } else
            k.sourceMap && typeof URL == "function" && typeof URL.createObjectURL == "function" && typeof URL.revokeObjectURL == "function" && typeof Blob == "function" && typeof btoa == "function" ? (w = function(B) {
              var j = document.createElement("link");
              return B.attrs.type === void 0 && (B.attrs.type = "text/css"), B.attrs.rel = "stylesheet", Z(j, B.attrs), L(B, j), j;
            }(g2), E = function(B, j, de) {
              var Q = de.css, Ce = de.sourceMap, Ot = j.convertToAbsoluteUrls === void 0 && Ce;
              (j.convertToAbsoluteUrls || Ot) && (Q = x(Q)), Ce && (Q += `
/*# sourceMappingURL=data:application/json;base64,` + btoa(unescape(encodeURIComponent(JSON.stringify(Ce)))) + " */");
              var Nt = new Blob([Q], { type: "text/css" }), Ge = B.href;
              B.href = URL.createObjectURL(Nt), Ge && URL.revokeObjectURL(Ge);
            }.bind(null, w, g2), I = function() {
              A(w), w.href && URL.revokeObjectURL(w.href);
            }) : (w = S(g2), E = function(B, j) {
              var de = j.css, Q = j.media;
              if (Q && B.setAttribute("media", Q), B.styleSheet)
                B.styleSheet.cssText = de;
              else {
                for (; B.firstChild; )
                  B.removeChild(B.firstChild);
                B.appendChild(document.createTextNode(de));
              }
            }.bind(null, w), I = function() {
              A(w);
            });
          return E(k), function(B) {
            if (B) {
              if (B.css === k.css && B.media === k.media && B.sourceMap === k.sourceMap)
                return;
              E(k = B);
            } else
              I();
          };
        }
        t.exports = function(k, g2) {
          if (typeof DEBUG < "u" && DEBUG && typeof document != "object")
            throw new Error("The style-loader cannot be used in a non-browser environment");
          (g2 = g2 || {}).attrs = typeof g2.attrs == "object" ? g2.attrs : {}, g2.singleton || typeof g2.singleton == "boolean" || (g2.singleton = l4()), g2.insertInto || (g2.insertInto = "head"), g2.insertAt || (g2.insertAt = "bottom");
          var w = m(k, g2);
          return p(w, g2), function(E) {
            for (var I = [], C = 0; C < w.length; C++) {
              var O = w[C];
              (B = a4[O.id]).refs--, I.push(B);
            }
            for (E && p(m(E, g2), g2), C = 0; C < I.length; C++) {
              var B;
              if ((B = I[C]).refs === 0) {
                for (var j = 0; j < B.parts.length; j++)
                  B.parts[j]();
                delete a4[B.id];
              }
            }
          };
        };
        var U, J = (U = [], function(k, g2) {
          return U[k] = g2, U.filter(Boolean).join(`
`);
        });
        function ce(k, g2, w, E) {
          var I = w ? "" : E.css;
          if (k.styleSheet)
            k.styleSheet.cssText = J(g2, I);
          else {
            var C = document.createTextNode(I), O = k.childNodes;
            O[g2] && k.removeChild(O[g2]), O.length ? k.insertBefore(C, O[g2]) : k.appendChild(C);
          }
        }
      }, function(t, o3) {
        t.exports = function(i2) {
          var n2 = typeof window < "u" && window.location;
          if (!n2)
            throw new Error("fixUrls requires window.location");
          if (!i2 || typeof i2 != "string")
            return i2;
          var r2 = n2.protocol + "//" + n2.host, a4 = r2 + n2.pathname.replace(/\/[^\/]*$/, "/");
          return i2.replace(/url\s*\(((?:[^)(]|\((?:[^)(]+|\([^)(]*\))*\))*)\)/gi, function(l4, d4) {
            var u2, h3 = d4.trim().replace(/^"(.*)"$/, function(f, x) {
              return x;
            }).replace(/^'(.*)'$/, function(f, x) {
              return x;
            });
            return /^(#|data:|http:\/\/|https:\/\/|file:\/\/\/|\s*$)/i.test(h3) ? l4 : (u2 = h3.indexOf("//") === 0 ? h3 : h3.indexOf("/") === 0 ? r2 + h3 : a4 + h3.replace(/^\.\//, ""), "url(" + JSON.stringify(u2) + ")");
          });
        };
      }, function(t, o3, i2) {
        var n2, r2, a4, l4, d4, u2, h3, f, x;
        t.exports = (n2 = "cdx-notifies", r2 = "cdx-notify", a4 = "cdx-notify__cross", l4 = "cdx-notify__button--confirm", d4 = "cdx-notify__button--cancel", u2 = "cdx-notify__input", h3 = "cdx-notify__button", f = "cdx-notify__btns-wrapper", { alert: x = function(p) {
          var m = document.createElement("DIV"), L = document.createElement("DIV"), A = p.message, S = p.style;
          return m.classList.add(r2), S && m.classList.add(r2 + "--" + S), m.innerHTML = A, L.classList.add(a4), L.addEventListener("click", m.remove.bind(m)), m.appendChild(L), m;
        }, confirm: function(p) {
          var m = x(p), L = document.createElement("div"), A = document.createElement("button"), S = document.createElement("button"), Z = m.querySelector("." + a4), H = p.cancelHandler, U = p.okHandler;
          return L.classList.add(f), A.innerHTML = p.okText || "Confirm", S.innerHTML = p.cancelText || "Cancel", A.classList.add(h3), S.classList.add(h3), A.classList.add(l4), S.classList.add(d4), H && typeof H == "function" && (S.addEventListener("click", H), Z.addEventListener("click", H)), U && typeof U == "function" && A.addEventListener("click", U), A.addEventListener("click", m.remove.bind(m)), S.addEventListener("click", m.remove.bind(m)), L.appendChild(A), L.appendChild(S), m.appendChild(L), m;
        }, prompt: function(p) {
          var m = x(p), L = document.createElement("div"), A = document.createElement("button"), S = document.createElement("input"), Z = m.querySelector("." + a4), H = p.cancelHandler, U = p.okHandler;
          return L.classList.add(f), A.innerHTML = p.okText || "Ok", A.classList.add(h3), A.classList.add(l4), S.classList.add(u2), p.placeholder && S.setAttribute("placeholder", p.placeholder), p.default && (S.value = p.default), p.inputType && (S.type = p.inputType), H && typeof H == "function" && Z.addEventListener("click", H), U && typeof U == "function" && A.addEventListener("click", function() {
            U(S.value);
          }), A.addEventListener("click", m.remove.bind(m)), L.appendChild(S), L.appendChild(A), m.appendChild(L), m;
        }, getWrapper: function() {
          var p = document.createElement("DIV");
          return p.classList.add(n2), p;
        } });
      }]);
    });
  })(lo);
  var co = /* @__PURE__ */ Pe(_e);
  var ho = class {
    /**
     * Show web notification
     *
     * @param {NotifierOptions | ConfirmNotifierOptions | PromptNotifierOptions} options - notification options
     */
    show(e) {
      co.show(e);
    }
  };
  var uo = class extends y {
    /**
     * @param moduleConfiguration - Module Configuration
     * @param moduleConfiguration.config - Editor's config
     * @param moduleConfiguration.eventsDispatcher - Editor's event dispatcher
     */
    constructor({ config: e, eventsDispatcher: t }) {
      super({
        config: e,
        eventsDispatcher: t
      }), this.notifier = new ho();
    }
    /**
     * Available methods
     */
    get methods() {
      return {
        show: (e) => this.show(e)
      };
    }
    /**
     * Show notification
     *
     * @param {NotifierOptions} options - message option
     */
    show(e) {
      return this.notifier.show(e);
    }
  };
  var po = class extends y {
    /**
     * Available methods
     */
    get methods() {
      const e = () => this.isEnabled;
      return {
        toggle: (t) => this.toggle(t),
        get isEnabled() {
          return e();
        }
      };
    }
    /**
     * Set or toggle read-only state
     *
     * @param {boolean|undefined} state - set or toggle state
     * @returns {boolean} current value
     */
    toggle(e) {
      return this.Editor.ReadOnly.toggle(e);
    }
    /**
     * Returns current read-only state
     */
    get isEnabled() {
      return this.Editor.ReadOnly.isEnabled;
    }
  };
  var Oe = {};
  var fo = {
    get exports() {
      return Oe;
    },
    set exports(s) {
      Oe = s;
    }
  };
  (function(s, e) {
    (function(t, o3) {
      s.exports = o3();
    })(Rt, function() {
      function t(h3) {
        var f = h3.tags, x = Object.keys(f), p = x.map(function(m) {
          return typeof f[m];
        }).every(function(m) {
          return m === "object" || m === "boolean" || m === "function";
        });
        if (!p)
          throw new Error("The configuration was invalid");
        this.config = h3;
      }
      var o3 = ["P", "LI", "TD", "TH", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "PRE"];
      function i2(h3) {
        return o3.indexOf(h3.nodeName) !== -1;
      }
      var n2 = ["A", "B", "STRONG", "I", "EM", "SUB", "SUP", "U", "STRIKE"];
      function r2(h3) {
        return n2.indexOf(h3.nodeName) !== -1;
      }
      t.prototype.clean = function(h3) {
        const f = document.implementation.createHTMLDocument(), x = f.createElement("div");
        return x.innerHTML = h3, this._sanitize(f, x), x.innerHTML;
      }, t.prototype._sanitize = function(h3, f) {
        var x = a4(h3, f), p = x.firstChild();
        if (p)
          do {
            if (p.nodeType === Node.TEXT_NODE)
              if (p.data.trim() === "" && (p.previousElementSibling && i2(p.previousElementSibling) || p.nextElementSibling && i2(p.nextElementSibling))) {
                f.removeChild(p), this._sanitize(h3, f);
                break;
              } else
                continue;
            if (p.nodeType === Node.COMMENT_NODE) {
              f.removeChild(p), this._sanitize(h3, f);
              break;
            }
            var m = r2(p), L;
            m && (L = Array.prototype.some.call(p.childNodes, i2));
            var A = !!f.parentNode, S = i2(f) && i2(p) && A, Z = p.nodeName.toLowerCase(), H = l4(this.config, Z, p), U = m && L;
            if (U || d4(p, H) || !this.config.keepNestedBlockElements && S) {
              if (!(p.nodeName === "SCRIPT" || p.nodeName === "STYLE"))
                for (; p.childNodes.length > 0; )
                  f.insertBefore(p.childNodes[0], p);
              f.removeChild(p), this._sanitize(h3, f);
              break;
            }
            for (var J = 0; J < p.attributes.length; J += 1) {
              var ce = p.attributes[J];
              u2(ce, H, p) && (p.removeAttribute(ce.name), J = J - 1);
            }
            this._sanitize(h3, p);
          } while (p = x.nextSibling());
      };
      function a4(h3, f) {
        return h3.createTreeWalker(
          f,
          NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT,
          null,
          false
        );
      }
      function l4(h3, f, x) {
        return typeof h3.tags[f] == "function" ? h3.tags[f](x) : h3.tags[f];
      }
      function d4(h3, f) {
        return typeof f > "u" ? true : typeof f == "boolean" ? !f : false;
      }
      function u2(h3, f, x) {
        var p = h3.name.toLowerCase();
        return f === true ? false : typeof f[p] == "function" ? !f[p](h3.value, x) : typeof f[p] > "u" || f[p] === false ? true : typeof f[p] == "string" ? f[p] !== h3.value : false;
      }
      return t;
    });
  })(fo);
  var go = Oe;
  function bt(s, e) {
    return s.map((t) => {
      const o3 = M(e) ? e(t.tool) : e;
      return W(o3) || (t.data = ze(t.data, o3)), t;
    });
  }
  function V(s, e = {}) {
    const t = {
      tags: e
    };
    return new go(t).clean(s);
  }
  function ze(s, e) {
    return Array.isArray(s) ? bo(s, e) : D(s) ? mo(s, e) : G(s) ? ko(s, e) : s;
  }
  function bo(s, e) {
    return s.map((t) => ze(t, e));
  }
  function mo(s, e) {
    const t = {};
    for (const o3 in s) {
      if (!Object.prototype.hasOwnProperty.call(s, o3))
        continue;
      const i2 = s[o3], n2 = vo(e[o3]) ? e[o3] : e;
      t[o3] = ze(i2, n2);
    }
    return t;
  }
  function ko(s, e) {
    return D(e) ? V(s, e) : e === false ? V(s, {}) : s;
  }
  function vo(s) {
    return D(s) || Ht(s) || M(s);
  }
  var xo = class extends y {
    /**
     * Available methods
     *
     * @returns {SanitizerConfig}
     */
    get methods() {
      return {
        clean: (e, t) => this.clean(e, t)
      };
    }
    /**
     * Perform sanitizing of a string
     *
     * @param {string} taintString - what to sanitize
     * @param {SanitizerConfig} config - sanitizer config
     * @returns {string}
     */
    clean(e, t) {
      return V(e, t);
    }
  };
  var wo = class extends y {
    /**
     * Available methods
     *
     * @returns {Saver}
     */
    get methods() {
      return {
        save: () => this.save()
      };
    }
    /**
     * Return Editor's data
     *
     * @returns {OutputData}
     */
    save() {
      const e = "Editor's content can not be saved in read-only mode";
      return this.Editor.ReadOnly.isEnabled ? (Y(e, "warn"), Promise.reject(new Error(e))) : this.Editor.Saver.save();
    }
  };
  var yo = class extends y {
    /**
     * Available methods
     *
     * @returns {SelectionAPIInterface}
     */
    get methods() {
      return {
        findParentTag: (e, t) => this.findParentTag(e, t),
        expandToTag: (e) => this.expandToTag(e)
      };
    }
    /**
     * Looks ahead from selection and find passed tag with class name
     *
     * @param {string} tagName - tag to find
     * @param {string} className - tag's class name
     * @returns {HTMLElement|null}
     */
    findParentTag(e, t) {
      return new b().findParentTag(e, t);
    }
    /**
     * Expand selection to passed tag
     *
     * @param {HTMLElement} node - tag that should contain selection
     */
    expandToTag(e) {
      new b().expandToTag(e);
    }
  };
  var Eo = class extends y {
    /**
     * Exported classes
     */
    get classes() {
      return {
        /**
         * Base Block styles
         */
        block: "cdx-block",
        /**
         * Inline Tools styles
         */
        inlineToolButton: "ce-inline-tool",
        inlineToolButtonActive: "ce-inline-tool--active",
        /**
         * UI elements
         */
        input: "cdx-input",
        loader: "cdx-loader",
        button: "cdx-button",
        /**
         * Settings styles
         */
        settingsButton: "cdx-settings-button",
        settingsButtonActive: "cdx-settings-button--active"
      };
    }
  };
  var Bo = class extends y {
    /**
     * Available methods
     *
     * @returns {Toolbar}
     */
    get methods() {
      return {
        close: () => this.close(),
        open: () => this.open(),
        toggleBlockSettings: (e) => this.toggleBlockSettings(e),
        toggleToolbox: (e) => this.toggleToolbox(e)
      };
    }
    /**
     * Open toolbar
     */
    open() {
      this.Editor.Toolbar.moveAndOpen();
    }
    /**
     * Close toolbar and all included elements
     */
    close() {
      this.Editor.Toolbar.close();
    }
    /**
     * Toggles Block Setting of the current block
     *
     * @param {boolean} openingState —  opening state of Block Setting
     */
    toggleBlockSettings(e) {
      if (this.Editor.BlockManager.currentBlockIndex === -1) {
        Y("Could't toggle the Toolbar because there is no block selected ", "warn");
        return;
      }
      e ?? !this.Editor.BlockSettings.opened ? (this.Editor.Toolbar.moveAndOpen(), this.Editor.BlockSettings.open()) : this.Editor.BlockSettings.close();
    }
    /**
     * Open toolbox
     *
     * @param {boolean} openingState - Opening state of toolbox
     */
    toggleToolbox(e) {
      if (this.Editor.BlockManager.currentBlockIndex === -1) {
        Y("Could't toggle the Toolbox because there is no block selected ", "warn");
        return;
      }
      e ?? !this.Editor.Toolbar.toolbox.opened ? (this.Editor.Toolbar.moveAndOpen(), this.Editor.Toolbar.toolbox.open()) : this.Editor.Toolbar.toolbox.close();
    }
  };
  var Ne = {};
  var Co = {
    get exports() {
      return Ne;
    },
    set exports(s) {
      Ne = s;
    }
  };
  (function(s, e) {
    (function(t, o3) {
      s.exports = o3();
    })(window, function() {
      return function(t) {
        var o3 = {};
        function i2(n2) {
          if (o3[n2])
            return o3[n2].exports;
          var r2 = o3[n2] = { i: n2, l: false, exports: {} };
          return t[n2].call(r2.exports, r2, r2.exports, i2), r2.l = true, r2.exports;
        }
        return i2.m = t, i2.c = o3, i2.d = function(n2, r2, a4) {
          i2.o(n2, r2) || Object.defineProperty(n2, r2, { enumerable: true, get: a4 });
        }, i2.r = function(n2) {
          typeof Symbol < "u" && Symbol.toStringTag && Object.defineProperty(n2, Symbol.toStringTag, { value: "Module" }), Object.defineProperty(n2, "__esModule", { value: true });
        }, i2.t = function(n2, r2) {
          if (1 & r2 && (n2 = i2(n2)), 8 & r2 || 4 & r2 && typeof n2 == "object" && n2 && n2.__esModule)
            return n2;
          var a4 = /* @__PURE__ */ Object.create(null);
          if (i2.r(a4), Object.defineProperty(a4, "default", { enumerable: true, value: n2 }), 2 & r2 && typeof n2 != "string")
            for (var l4 in n2)
              i2.d(a4, l4, function(d4) {
                return n2[d4];
              }.bind(null, l4));
          return a4;
        }, i2.n = function(n2) {
          var r2 = n2 && n2.__esModule ? function() {
            return n2.default;
          } : function() {
            return n2;
          };
          return i2.d(r2, "a", r2), r2;
        }, i2.o = function(n2, r2) {
          return Object.prototype.hasOwnProperty.call(n2, r2);
        }, i2.p = "", i2(i2.s = 0);
      }([function(t, o3, i2) {
        t.exports = i2(1);
      }, function(t, o3, i2) {
        i2.r(o3), i2.d(o3, "default", function() {
          return n2;
        });
        class n2 {
          constructor() {
            this.nodes = { wrapper: null, content: null }, this.showed = false, this.offsetTop = 10, this.offsetLeft = 10, this.offsetRight = 10, this.hidingDelay = 0, this.handleWindowScroll = () => {
              this.showed && this.hide(true);
            }, this.loadStyles(), this.prepare(), window.addEventListener("scroll", this.handleWindowScroll, { passive: true });
          }
          get CSS() {
            return { tooltip: "ct", tooltipContent: "ct__content", tooltipShown: "ct--shown", placement: { left: "ct--left", bottom: "ct--bottom", right: "ct--right", top: "ct--top" } };
          }
          show(a4, l4, d4) {
            this.nodes.wrapper || this.prepare(), this.hidingTimeout && clearTimeout(this.hidingTimeout);
            const u2 = Object.assign({ placement: "bottom", marginTop: 0, marginLeft: 0, marginRight: 0, marginBottom: 0, delay: 70, hidingDelay: 0 }, d4);
            if (u2.hidingDelay && (this.hidingDelay = u2.hidingDelay), this.nodes.content.innerHTML = "", typeof l4 == "string")
              this.nodes.content.appendChild(document.createTextNode(l4));
            else {
              if (!(l4 instanceof Node))
                throw Error("[CodeX Tooltip] Wrong type of \xABcontent\xBB passed. It should be an instance of Node or String. But " + typeof l4 + " given.");
              this.nodes.content.appendChild(l4);
            }
            switch (this.nodes.wrapper.classList.remove(...Object.values(this.CSS.placement)), u2.placement) {
              case "top":
                this.placeTop(a4, u2);
                break;
              case "left":
                this.placeLeft(a4, u2);
                break;
              case "right":
                this.placeRight(a4, u2);
                break;
              case "bottom":
              default:
                this.placeBottom(a4, u2);
            }
            u2 && u2.delay ? this.showingTimeout = setTimeout(() => {
              this.nodes.wrapper.classList.add(this.CSS.tooltipShown), this.showed = true;
            }, u2.delay) : (this.nodes.wrapper.classList.add(this.CSS.tooltipShown), this.showed = true);
          }
          hide(a4 = false) {
            if (this.hidingDelay && !a4)
              return this.hidingTimeout && clearTimeout(this.hidingTimeout), void (this.hidingTimeout = setTimeout(() => {
                this.hide(true);
              }, this.hidingDelay));
            this.nodes.wrapper.classList.remove(this.CSS.tooltipShown), this.showed = false, this.showingTimeout && clearTimeout(this.showingTimeout);
          }
          onHover(a4, l4, d4) {
            a4.addEventListener("mouseenter", () => {
              this.show(a4, l4, d4);
            }), a4.addEventListener("mouseleave", () => {
              this.hide();
            });
          }
          destroy() {
            this.nodes.wrapper.remove(), window.removeEventListener("scroll", this.handleWindowScroll);
          }
          prepare() {
            this.nodes.wrapper = this.make("div", this.CSS.tooltip), this.nodes.content = this.make("div", this.CSS.tooltipContent), this.append(this.nodes.wrapper, this.nodes.content), this.append(document.body, this.nodes.wrapper);
          }
          loadStyles() {
            const a4 = "codex-tooltips-style";
            if (document.getElementById(a4))
              return;
            const l4 = i2(2), d4 = this.make("style", null, { textContent: l4.toString(), id: a4 });
            this.prepend(document.head, d4);
          }
          placeBottom(a4, l4) {
            const d4 = a4.getBoundingClientRect(), u2 = d4.left + a4.clientWidth / 2 - this.nodes.wrapper.offsetWidth / 2, h3 = d4.bottom + window.pageYOffset + this.offsetTop + l4.marginTop;
            this.applyPlacement("bottom", u2, h3);
          }
          placeTop(a4, l4) {
            const d4 = a4.getBoundingClientRect(), u2 = d4.left + a4.clientWidth / 2 - this.nodes.wrapper.offsetWidth / 2, h3 = d4.top + window.pageYOffset - this.nodes.wrapper.clientHeight - this.offsetTop;
            this.applyPlacement("top", u2, h3);
          }
          placeLeft(a4, l4) {
            const d4 = a4.getBoundingClientRect(), u2 = d4.left - this.nodes.wrapper.offsetWidth - this.offsetLeft - l4.marginLeft, h3 = d4.top + window.pageYOffset + a4.clientHeight / 2 - this.nodes.wrapper.offsetHeight / 2;
            this.applyPlacement("left", u2, h3);
          }
          placeRight(a4, l4) {
            const d4 = a4.getBoundingClientRect(), u2 = d4.right + this.offsetRight + l4.marginRight, h3 = d4.top + window.pageYOffset + a4.clientHeight / 2 - this.nodes.wrapper.offsetHeight / 2;
            this.applyPlacement("right", u2, h3);
          }
          applyPlacement(a4, l4, d4) {
            this.nodes.wrapper.classList.add(this.CSS.placement[a4]), this.nodes.wrapper.style.left = l4 + "px", this.nodes.wrapper.style.top = d4 + "px";
          }
          make(a4, l4 = null, d4 = {}) {
            const u2 = document.createElement(a4);
            Array.isArray(l4) ? u2.classList.add(...l4) : l4 && u2.classList.add(l4);
            for (const h3 in d4)
              d4.hasOwnProperty(h3) && (u2[h3] = d4[h3]);
            return u2;
          }
          append(a4, l4) {
            Array.isArray(l4) ? l4.forEach((d4) => a4.appendChild(d4)) : a4.appendChild(l4);
          }
          prepend(a4, l4) {
            Array.isArray(l4) ? (l4 = l4.reverse()).forEach((d4) => a4.prepend(d4)) : a4.prepend(l4);
          }
        }
      }, function(t, o3) {
        t.exports = `.ct{z-index:999;opacity:0;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;pointer-events:none;-webkit-transition:opacity 50ms ease-in,-webkit-transform 70ms cubic-bezier(.215,.61,.355,1);transition:opacity 50ms ease-in,-webkit-transform 70ms cubic-bezier(.215,.61,.355,1);transition:opacity 50ms ease-in,transform 70ms cubic-bezier(.215,.61,.355,1);transition:opacity 50ms ease-in,transform 70ms cubic-bezier(.215,.61,.355,1),-webkit-transform 70ms cubic-bezier(.215,.61,.355,1);will-change:opacity,top,left;-webkit-box-shadow:0 8px 12px 0 rgba(29,32,43,.17),0 4px 5px -3px rgba(5,6,12,.49);box-shadow:0 8px 12px 0 rgba(29,32,43,.17),0 4px 5px -3px rgba(5,6,12,.49);border-radius:9px}.ct,.ct:before{position:absolute;top:0;left:0}.ct:before{content:"";bottom:0;right:0;background-color:#1d202b;z-index:-1;border-radius:4px}@supports(-webkit-mask-box-image:url("")){.ct:before{border-radius:0;-webkit-mask-box-image:url('data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path d="M10.71 0h2.58c3.02 0 4.64.42 6.1 1.2a8.18 8.18 0 013.4 3.4C23.6 6.07 24 7.7 24 10.71v2.58c0 3.02-.42 4.64-1.2 6.1a8.18 8.18 0 01-3.4 3.4c-1.47.8-3.1 1.21-6.11 1.21H10.7c-3.02 0-4.64-.42-6.1-1.2a8.18 8.18 0 01-3.4-3.4C.4 17.93 0 16.3 0 13.29V10.7c0-3.02.42-4.64 1.2-6.1a8.18 8.18 0 013.4-3.4C6.07.4 7.7 0 10.71 0z"/></svg>') 48% 41% 37.9% 53.3%}}@media (--mobile){.ct{display:none}}.ct__content{padding:6px 10px;color:#cdd1e0;font-size:12px;text-align:center;letter-spacing:.02em;line-height:1em}.ct:after{content:"";width:8px;height:8px;position:absolute;background-color:#1d202b;z-index:-1}.ct--bottom{-webkit-transform:translateY(5px);transform:translateY(5px)}.ct--bottom:after{top:-3px;left:50%;-webkit-transform:translateX(-50%) rotate(-45deg);transform:translateX(-50%) rotate(-45deg)}.ct--top{-webkit-transform:translateY(-5px);transform:translateY(-5px)}.ct--top:after{top:auto;bottom:-3px;left:50%;-webkit-transform:translateX(-50%) rotate(-45deg);transform:translateX(-50%) rotate(-45deg)}.ct--left{-webkit-transform:translateX(-5px);transform:translateX(-5px)}.ct--left:after{top:50%;left:auto;right:0;-webkit-transform:translate(41.6%,-50%) rotate(-45deg);transform:translate(41.6%,-50%) rotate(-45deg)}.ct--right{-webkit-transform:translateX(5px);transform:translateX(5px)}.ct--right:after{top:50%;left:0;-webkit-transform:translate(-41.6%,-50%) rotate(-45deg);transform:translate(-41.6%,-50%) rotate(-45deg)}.ct--shown{opacity:1;-webkit-transform:none;transform:none}`;
      }]).default;
    });
  })(Co);
  var To = /* @__PURE__ */ Pe(Ne);
  var F = null;
  function Ue() {
    F || (F = new To());
  }
  function So(s, e, t) {
    Ue(), F == null || F.show(s, e, t);
  }
  function Re(s = false) {
    Ue(), F == null || F.hide(s);
  }
  function ge(s, e, t) {
    Ue(), F == null || F.onHover(s, e, t);
  }
  function Io() {
    F == null || F.destroy(), F = null;
  }
  var Mo = class extends y {
    /**
     * @class
     * @param moduleConfiguration - Module Configuration
     * @param moduleConfiguration.config - Editor's config
     * @param moduleConfiguration.eventsDispatcher - Editor's event dispatcher
     */
    constructor({ config: e, eventsDispatcher: t }) {
      super({
        config: e,
        eventsDispatcher: t
      });
    }
    /**
     * Available methods
     */
    get methods() {
      return {
        show: (e, t, o3) => this.show(e, t, o3),
        hide: () => this.hide(),
        onHover: (e, t, o3) => this.onHover(e, t, o3)
      };
    }
    /**
     * Method show tooltip on element with passed HTML content
     *
     * @param {HTMLElement} element - element on which tooltip should be shown
     * @param {TooltipContent} content - tooltip content
     * @param {TooltipOptions} options - tooltip options
     */
    show(e, t, o3) {
      So(e, t, o3);
    }
    /**
     * Method hides tooltip on HTML page
     */
    hide() {
      Re();
    }
    /**
     * Decorator for showing Tooltip by mouseenter/mouseleave
     *
     * @param {HTMLElement} element - element on which tooltip should be shown
     * @param {TooltipContent} content - tooltip content
     * @param {TooltipOptions} options - tooltip options
     */
    onHover(e, t, o3) {
      ge(e, t, o3);
    }
  };
  var Lo = class extends y {
    /**
     * Available methods / getters
     */
    get methods() {
      return {
        nodes: this.editorNodes
        /**
         * There can be added some UI methods, like toggleThinMode() etc
         */
      };
    }
    /**
     * Exported classes
     */
    get editorNodes() {
      return {
        /**
         * Top-level editor instance wrapper
         */
        wrapper: this.Editor.UI.nodes.wrapper,
        /**
         * Element that holds all the Blocks
         */
        redactor: this.Editor.UI.nodes.redactor
      };
    }
  };
  function mt(s, e) {
    const t = {};
    return Object.entries(s).forEach(([o3, i2]) => {
      if (D(i2)) {
        const n2 = e ? `${e}.${o3}` : o3;
        Object.values(i2).every((a4) => G(a4)) ? t[o3] = n2 : t[o3] = mt(i2, n2);
        return;
      }
      t[o3] = i2;
    }), t;
  }
  var K = mt(ht);
  function Ao(s, e) {
    const t = {};
    return Object.keys(s).forEach((o3) => {
      const i2 = e[o3];
      i2 !== void 0 ? t[i2] = s[o3] : t[o3] = s[o3];
    }), t;
  }
  var _o = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M9 12L9 7.1C9 7.04477 9.04477 7 9.1 7H10.4C11.5 7 14 7.1 14 9.5C14 9.5 14 12 11 12M9 12V16.8C9 16.9105 9.08954 17 9.2 17H12.5C14 17 15 16 15 14.5C15 11.7046 11 12 11 12M9 12H11"/></svg>';
  var kt = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M7 10L11.8586 14.8586C11.9367 14.9367 12.0633 14.9367 12.1414 14.8586L17 10"/></svg>';
  var Oo = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M7 15L11.8586 10.1414C11.9367 10.0633 12.0633 10.0633 12.1414 10.1414L17 15"/></svg>';
  var No = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M8 8L12 12M12 12L16 16M12 12L16 8M12 12L8 16"/></svg>';
  var Ro = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"/></svg>';
  var Do = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M13.34 10C12.4223 12.7337 11 17 11 17"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M14.21 7H14.2"/></svg>';
  var it = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M7.69998 12.6L7.67896 12.62C6.53993 13.7048 6.52012 15.5155 7.63516 16.625V16.625C8.72293 17.7073 10.4799 17.7102 11.5712 16.6314L13.0263 15.193C14.0703 14.1609 14.2141 12.525 13.3662 11.3266L13.22 11.12"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M16.22 11.12L16.3564 10.9805C17.2895 10.0265 17.3478 8.5207 16.4914 7.49733V7.49733C15.5691 6.39509 13.9269 6.25143 12.8271 7.17675L11.3901 8.38588C10.0935 9.47674 9.95706 11.4241 11.0888 12.6852L11.12 12.72"/></svg>';
  var Po = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2.6" d="M9.40999 7.29999H9.4"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2.6" d="M14.6 7.29999H14.59"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2.6" d="M9.30999 12H9.3"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2.6" d="M14.6 12H14.59"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2.6" d="M9.40999 16.7H9.4"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2.6" d="M14.6 16.7H14.59"/></svg>';
  var Fo = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M12 7V12M12 17V12M17 12H12M12 12H7"/></svg>';
  var Ho = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" stroke-width="2"/><line x1="15.4142" x2="19" y1="15" y2="18.5858" stroke="currentColor" stroke-linecap="round" stroke-width="2"/></svg>';
  var zo = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M15.7795 11.5C15.7795 11.5 16.053 11.1962 16.5497 10.6722C17.4442 9.72856 17.4701 8.2475 16.5781 7.30145V7.30145C15.6482 6.31522 14.0873 6.29227 13.1288 7.25073L11.8796 8.49999"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M8.24517 12.3883C8.24517 12.3883 7.97171 12.6922 7.47504 13.2161C6.58051 14.1598 6.55467 15.6408 7.44666 16.5869V16.5869C8.37653 17.5731 9.93744 17.5961 10.8959 16.6376L12.1452 15.3883"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M17.7802 15.1032L16.597 14.9422C16.0109 14.8624 15.4841 15.3059 15.4627 15.8969L15.4199 17.0818"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M6.39064 9.03238L7.58432 9.06668C8.17551 9.08366 8.6522 8.58665 8.61056 7.99669L8.5271 6.81397"/><line x1="12.1142" x2="11.7" y1="12.2" y2="11.7858" stroke="currentColor" stroke-linecap="round" stroke-width="2"/></svg>';
  var Uo = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><rect width="14" height="14" x="5" y="5" stroke="currentColor" stroke-width="2" rx="4"/><line x1="12" x2="12" y1="9" y2="12" stroke="currentColor" stroke-linecap="round" stroke-width="2"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M12 15.02V15.01"/></svg>';
  var _ = class __ {
    /**
     * Constructs popover item instance
     *
     * @param params - popover item construction params
     */
    constructor(e) {
      this.nodes = {
        root: null,
        icon: null
      }, this.confirmationState = null, this.removeSpecialFocusBehavior = () => {
        this.nodes.root.classList.remove(__.CSS.noFocus);
      }, this.removeSpecialHoverBehavior = () => {
        this.nodes.root.classList.remove(__.CSS.noHover);
      }, this.onErrorAnimationEnd = () => {
        this.nodes.icon.classList.remove(__.CSS.wobbleAnimation), this.nodes.icon.removeEventListener("animationend", this.onErrorAnimationEnd);
      }, this.params = e, this.nodes.root = this.make(e);
    }
    /**
     * True if item is disabled and hence not clickable
     */
    get isDisabled() {
      return this.params.isDisabled;
    }
    /**
     * Exposes popover item toggle parameter
     */
    get toggle() {
      return this.params.toggle;
    }
    /**
     * Item title
     */
    get title() {
      return this.params.title;
    }
    /**
     * True if popover should close once item is activated
     */
    get closeOnActivate() {
      return this.params.closeOnActivate;
    }
    /**
     * True if confirmation state is enabled for popover item
     */
    get isConfirmationStateEnabled() {
      return this.confirmationState !== null;
    }
    /**
     * True if item is focused in keyboard navigation process
     */
    get isFocused() {
      return this.nodes.root.classList.contains(__.CSS.focused);
    }
    /**
     * Popover item CSS classes
     */
    static get CSS() {
      return {
        container: "ce-popover-item",
        title: "ce-popover-item__title",
        secondaryTitle: "ce-popover-item__secondary-title",
        icon: "ce-popover-item__icon",
        active: "ce-popover-item--active",
        disabled: "ce-popover-item--disabled",
        focused: "ce-popover-item--focused",
        hidden: "ce-popover-item--hidden",
        confirmationState: "ce-popover-item--confirmation",
        noHover: "ce-popover-item--no-hover",
        noFocus: "ce-popover-item--no-focus",
        wobbleAnimation: "wobble"
      };
    }
    /**
     * Returns popover item root element
     */
    getElement() {
      return this.nodes.root;
    }
    /**
     * Called on popover item click
     */
    handleClick() {
      if (this.isConfirmationStateEnabled) {
        this.activateOrEnableConfirmationMode(this.confirmationState);
        return;
      }
      this.activateOrEnableConfirmationMode(this.params);
    }
    /**
     * Toggles item active state
     *
     * @param isActive - true if item should strictly should become active
     */
    toggleActive(e) {
      this.nodes.root.classList.toggle(__.CSS.active, e);
    }
    /**
     * Toggles item hidden state
     *
     * @param isHidden - true if item should be hidden
     */
    toggleHidden(e) {
      this.nodes.root.classList.toggle(__.CSS.hidden, e);
    }
    /**
     * Resets popover item to its original state
     */
    reset() {
      this.isConfirmationStateEnabled && this.disableConfirmationMode();
    }
    /**
     * Method called once item becomes focused during keyboard navigation
     */
    onFocus() {
      this.disableSpecialHoverAndFocusBehavior();
    }
    /**
     * Constructs HTML element corresponding to popover item params
     *
     * @param params - item construction params
     */
    make(e) {
      const t = c.make("div", __.CSS.container);
      return e.name && (t.dataset.itemName = e.name), this.nodes.icon = c.make("div", __.CSS.icon, {
        innerHTML: e.icon || Ro
      }), t.appendChild(this.nodes.icon), t.appendChild(c.make("div", __.CSS.title, {
        innerHTML: e.title || ""
      })), e.secondaryLabel && t.appendChild(c.make("div", __.CSS.secondaryTitle, {
        textContent: e.secondaryLabel
      })), e.isActive && t.classList.add(__.CSS.active), e.isDisabled && t.classList.add(__.CSS.disabled), t;
    }
    /**
     * Activates confirmation mode for the item.
     *
     * @param newState - new popover item params that should be applied
     */
    enableConfirmationMode(e) {
      const t = {
        ...this.params,
        ...e,
        confirmation: e.confirmation
      }, o3 = this.make(t);
      this.nodes.root.innerHTML = o3.innerHTML, this.nodes.root.classList.add(__.CSS.confirmationState), this.confirmationState = e, this.enableSpecialHoverAndFocusBehavior();
    }
    /**
     * Returns item to its original state
     */
    disableConfirmationMode() {
      const e = this.make(this.params);
      this.nodes.root.innerHTML = e.innerHTML, this.nodes.root.classList.remove(__.CSS.confirmationState), this.confirmationState = null, this.disableSpecialHoverAndFocusBehavior();
    }
    /**
     * Enables special focus and hover behavior for item in confirmation state.
     * This is needed to prevent item from being highlighted as hovered/focused just after click.
     */
    enableSpecialHoverAndFocusBehavior() {
      this.nodes.root.classList.add(__.CSS.noHover), this.nodes.root.classList.add(__.CSS.noFocus), this.nodes.root.addEventListener("mouseleave", this.removeSpecialHoverBehavior, { once: true });
    }
    /**
     * Disables special focus and hover behavior
     */
    disableSpecialHoverAndFocusBehavior() {
      this.removeSpecialFocusBehavior(), this.removeSpecialHoverBehavior(), this.nodes.root.removeEventListener("mouseleave", this.removeSpecialHoverBehavior);
    }
    /**
     * Executes item's onActivate callback if the item has no confirmation configured
     *
     * @param item - item to activate or bring to confirmation mode
     */
    activateOrEnableConfirmationMode(e) {
      if (e.confirmation === void 0)
        try {
          e.onActivate(e), this.disableConfirmationMode();
        } catch {
          this.animateError();
        }
      else
        this.enableConfirmationMode(e.confirmation);
    }
    /**
     * Animates item which symbolizes that error occured while executing 'onActivate()' callback
     */
    animateError() {
      this.nodes.icon.classList.contains(__.CSS.wobbleAnimation) || (this.nodes.icon.classList.add(__.CSS.wobbleAnimation), this.nodes.icon.addEventListener("animationend", this.onErrorAnimationEnd));
    }
  };
  var he = class {
    /**
     * @param {HTMLElement[]} nodeList — the list of iterable HTML-items
     * @param {string} focusedCssClass - user-provided CSS-class that will be set in flipping process
     */
    constructor(s, e) {
      this.cursor = -1, this.items = [], this.items = s || [], this.focusedCssClass = e;
    }
    /**
     * Returns Focused button Node
     *
     * @returns {HTMLElement}
     */
    get currentItem() {
      return this.cursor === -1 ? null : this.items[this.cursor];
    }
    /**
     * Sets cursor to specified position
     *
     * @param cursorPosition - new cursor position
     */
    setCursor(s) {
      s < this.items.length && s >= -1 && (this.dropCursor(), this.cursor = s, this.items[this.cursor].classList.add(this.focusedCssClass));
    }
    /**
     * Sets items. Can be used when iterable items changed dynamically
     *
     * @param {HTMLElement[]} nodeList - nodes to iterate
     */
    setItems(s) {
      this.items = s;
    }
    /**
     * Sets cursor next to the current
     */
    next() {
      this.cursor = this.leafNodesAndReturnIndex(he.directions.RIGHT);
    }
    /**
     * Sets cursor before current
     */
    previous() {
      this.cursor = this.leafNodesAndReturnIndex(he.directions.LEFT);
    }
    /**
     * Sets cursor to the default position and removes CSS-class from previously focused item
     */
    dropCursor() {
      this.cursor !== -1 && (this.items[this.cursor].classList.remove(this.focusedCssClass), this.cursor = -1);
    }
    /**
     * Leafs nodes inside the target list from active element
     *
     * @param {string} direction - leaf direction. Can be 'left' or 'right'
     * @returns {number} index of focused node
     */
    leafNodesAndReturnIndex(s) {
      if (this.items.length === 0)
        return this.cursor;
      let e = this.cursor;
      return e === -1 ? e = s === he.directions.RIGHT ? -1 : 0 : this.items[e].classList.remove(this.focusedCssClass), s === he.directions.RIGHT ? e = (e + 1) % this.items.length : e = (this.items.length + e - 1) % this.items.length, c.canSetCaret(this.items[e]) && xe(() => b.setCursor(this.items[e]), 50)(), this.items[e].classList.add(this.focusedCssClass), e;
    }
  };
  var ne = he;
  ne.directions = {
    RIGHT: "right",
    LEFT: "left"
  };
  var q = class _q {
    /**
     * @param {FlipperOptions} options - different constructing settings
     */
    constructor(e) {
      this.iterator = null, this.activated = false, this.flipCallbacks = [], this.onKeyDown = (t) => {
        if (this.isEventReadyForHandling(t))
          switch (_q.usedKeys.includes(t.keyCode) && t.preventDefault(), t.keyCode) {
            case v.TAB:
              this.handleTabPress(t);
              break;
            case v.LEFT:
            case v.UP:
              this.flipLeft();
              break;
            case v.RIGHT:
            case v.DOWN:
              this.flipRight();
              break;
            case v.ENTER:
              this.handleEnterPress(t);
              break;
          }
      }, this.iterator = new ne(e.items, e.focusedItemClass), this.activateCallback = e.activateCallback, this.allowedKeys = e.allowedKeys || _q.usedKeys;
    }
    /**
     * True if flipper is currently activated
     */
    get isActivated() {
      return this.activated;
    }
    /**
     * Array of keys (codes) that is handled by Flipper
     * Used to:
     *  - preventDefault only for this keys, not all keydowns (@see constructor)
     *  - to skip external behaviours only for these keys, when filler is activated (@see BlockEvents@arrowRightAndDown)
     */
    static get usedKeys() {
      return [
        v.TAB,
        v.LEFT,
        v.RIGHT,
        v.ENTER,
        v.UP,
        v.DOWN
      ];
    }
    /**
     * Active tab/arrows handling by flipper
     *
     * @param items - Some modules (like, InlineToolbar, BlockSettings) might refresh buttons dynamically
     * @param cursorPosition - index of the item that should be focused once flipper is activated
     */
    activate(e, t) {
      this.activated = true, e && this.iterator.setItems(e), t !== void 0 && this.iterator.setCursor(t), document.addEventListener("keydown", this.onKeyDown, true);
    }
    /**
     * Disable tab/arrows handling by flipper
     */
    deactivate() {
      this.activated = false, this.dropCursor(), document.removeEventListener("keydown", this.onKeyDown);
    }
    /**
     * Focus first item
     */
    focusFirst() {
      this.dropCursor(), this.flipRight();
    }
    /**
     * Focuses previous flipper iterator item
     */
    flipLeft() {
      this.iterator.previous(), this.flipCallback();
    }
    /**
     * Focuses next flipper iterator item
     */
    flipRight() {
      this.iterator.next(), this.flipCallback();
    }
    /**
     * Return true if some button is focused
     */
    hasFocus() {
      return !!this.iterator.currentItem;
    }
    /**
     * Registeres function that should be executed on each navigation action
     *
     * @param cb - function to execute
     */
    onFlip(e) {
      this.flipCallbacks.push(e);
    }
    /**
     * Unregisteres function that is executed on each navigation action
     *
     * @param cb - function to stop executing
     */
    removeOnFlip(e) {
      this.flipCallbacks = this.flipCallbacks.filter((t) => t !== e);
    }
    /**
     * Drops flipper's iterator cursor
     *
     * @see DomIterator#dropCursor
     */
    dropCursor() {
      this.iterator.dropCursor();
    }
    /**
     * This function is fired before handling flipper keycodes
     * The result of this function defines if it is need to be handled or not
     *
     * @param {KeyboardEvent} event - keydown keyboard event
     * @returns {boolean}
     */
    isEventReadyForHandling(e) {
      return this.activated && this.allowedKeys.includes(e.keyCode);
    }
    /**
     * When flipper is activated tab press will leaf the items
     *
     * @param {KeyboardEvent} event - tab keydown event
     */
    handleTabPress(e) {
      switch (e.shiftKey ? ne.directions.LEFT : ne.directions.RIGHT) {
        case ne.directions.RIGHT:
          this.flipRight();
          break;
        case ne.directions.LEFT:
          this.flipLeft();
          break;
      }
    }
    /**
     * Enter press will click current item if flipper is activated
     *
     * @param {KeyboardEvent} event - enter keydown event
     */
    handleEnterPress(e) {
      this.activated && (this.iterator.currentItem && (e.stopPropagation(), e.preventDefault(), this.iterator.currentItem.click()), M(this.activateCallback) && this.activateCallback(this.iterator.currentItem));
    }
    /**
     * Fired after flipping in any direction
     */
    flipCallback() {
      this.iterator.currentItem && this.iterator.currentItem.scrollIntoViewIfNeeded(), this.flipCallbacks.forEach((e) => e());
    }
  };
  var pe = class _pe {
    /**
     * Styles
     */
    static get CSS() {
      return {
        wrapper: "cdx-search-field",
        icon: "cdx-search-field__icon",
        input: "cdx-search-field__input"
      };
    }
    /**
     * @param options - available config
     * @param options.items - searchable items list
     * @param options.onSearch - search callback
     * @param options.placeholder - input placeholder
     */
    constructor({ items: e, onSearch: t, placeholder: o3 }) {
      this.listeners = new Fe(), this.items = e, this.onSearch = t, this.render(o3);
    }
    /**
     * Returns search field element
     */
    getElement() {
      return this.wrapper;
    }
    /**
     * Sets focus to the input
     */
    focus() {
      this.input.focus();
    }
    /**
     * Clears search query and results
     */
    clear() {
      this.input.value = "", this.searchQuery = "", this.onSearch("", this.foundItems);
    }
    /**
     * Clears memory
     */
    destroy() {
      this.listeners.removeAll();
    }
    /**
     * Creates the search field
     *
     * @param placeholder - input placeholder
     */
    render(e) {
      this.wrapper = c.make("div", _pe.CSS.wrapper);
      const t = c.make("div", _pe.CSS.icon, {
        innerHTML: Ho
      });
      this.input = c.make("input", _pe.CSS.input, {
        placeholder: e,
        /**
         * Used to prevent focusing on the input by Tab key
         * (Popover in the Toolbar lays below the blocks,
         * so Tab in the last block will focus this hidden input if this property is not set)
         */
        tabIndex: -1
      }), this.wrapper.appendChild(t), this.wrapper.appendChild(this.input), this.listeners.on(this.input, "input", () => {
        this.searchQuery = this.input.value, this.onSearch(this.searchQuery, this.foundItems);
      });
    }
    /**
     * Returns list of found items for the current search query
     */
    get foundItems() {
      return this.items.filter((e) => this.checkItem(e));
    }
    /**
     * Contains logic for checking whether passed item conforms the search query
     *
     * @param item - item to be checked
     */
    checkItem(e) {
      var i2;
      const t = ((i2 = e.title) == null ? void 0 : i2.toLowerCase()) || "", o3 = this.searchQuery.toLowerCase();
      return t.includes(o3);
    }
  };
  var ue = class {
    /**
     * Locks body element scroll
     */
    lock() {
      tt ? this.lockHard() : document.body.classList.add(ue.CSS.scrollLocked);
    }
    /**
     * Unlocks body element scroll
     */
    unlock() {
      tt ? this.unlockHard() : document.body.classList.remove(ue.CSS.scrollLocked);
    }
    /**
     * Locks scroll in a hard way (via setting fixed position to body element)
     */
    lockHard() {
      this.scrollPosition = window.pageYOffset, document.documentElement.style.setProperty(
        "--window-scroll-offset",
        `${this.scrollPosition}px`
      ), document.body.classList.add(ue.CSS.scrollLockedHard);
    }
    /**
     * Unlocks hard scroll lock
     */
    unlockHard() {
      document.body.classList.remove(ue.CSS.scrollLockedHard), this.scrollPosition !== null && window.scrollTo(0, this.scrollPosition), this.scrollPosition = null;
    }
  };
  var vt = ue;
  vt.CSS = {
    scrollLocked: "ce-scroll-locked",
    scrollLockedHard: "ce-scroll-locked--hard"
  };
  var jo = Object.defineProperty;
  var $o = Object.getOwnPropertyDescriptor;
  var Wo = (s, e, t, o3) => {
    for (var i2 = o3 > 1 ? void 0 : o3 ? $o(e, t) : e, n2 = s.length - 1, r2; n2 >= 0; n2--)
      (r2 = s[n2]) && (i2 = (o3 ? r2(e, t, i2) : r2(i2)) || i2);
    return o3 && i2 && jo(e, t, i2), i2;
  };
  var be = /* @__PURE__ */ ((s) => (s.Close = "close", s))(be || {});
  var N = class extends Ee {
    /**
     * Constructs the instance
     *
     * @param params - popover construction params
     */
    constructor(s) {
      super(), this.scopeElement = document.body, this.listeners = new Fe(), this.scrollLocker = new vt(), this.nodes = {
        wrapper: null,
        popover: null,
        nothingFoundMessage: null,
        customContent: null,
        items: null,
        overlay: null
      }, this.messages = {
        nothingFound: "Nothing found",
        search: "Search"
      }, this.onFlip = () => {
        this.items.find((t) => t.isFocused).onFocus();
      }, this.items = s.items.map((e) => new _(e)), s.scopeElement !== void 0 && (this.scopeElement = s.scopeElement), s.messages && (this.messages = {
        ...this.messages,
        ...s.messages
      }), s.customContentFlippableItems && (this.customContentFlippableItems = s.customContentFlippableItems), this.make(), s.customContent && this.addCustomContent(s.customContent), s.searchable && this.addSearch(), this.initializeFlipper();
    }
    /**
     * Popover CSS classes
     */
    static get CSS() {
      return {
        popover: "ce-popover",
        popoverOpenTop: "ce-popover--open-top",
        popoverOpened: "ce-popover--opened",
        search: "ce-popover__search",
        nothingFoundMessage: "ce-popover__nothing-found-message",
        nothingFoundMessageDisplayed: "ce-popover__nothing-found-message--displayed",
        customContent: "ce-popover__custom-content",
        customContentHidden: "ce-popover__custom-content--hidden",
        items: "ce-popover__items",
        overlay: "ce-popover__overlay",
        overlayHidden: "ce-popover__overlay--hidden"
      };
    }
    /**
     * Returns HTML element corresponding to the popover
     */
    getElement() {
      return this.nodes.wrapper;
    }
    /**
     * Returns true if some item inside popover is focused
     */
    hasFocus() {
      return this.flipper.hasFocus();
    }
    /**
     * Open popover
     */
    show() {
      this.shouldOpenBottom || (this.nodes.popover.style.setProperty("--popover-height", this.height + "px"), this.nodes.popover.classList.add(N.CSS.popoverOpenTop)), this.nodes.overlay.classList.remove(N.CSS.overlayHidden), this.nodes.popover.classList.add(N.CSS.popoverOpened), this.flipper.activate(this.flippableElements), this.search !== void 0 && requestAnimationFrame(() => {
        var s;
        (s = this.search) == null || s.focus();
      }), te() && this.scrollLocker.lock();
    }
    /**
     * Closes popover
     */
    hide() {
      this.nodes.popover.classList.remove(N.CSS.popoverOpened), this.nodes.popover.classList.remove(N.CSS.popoverOpenTop), this.nodes.overlay.classList.add(N.CSS.overlayHidden), this.flipper.deactivate(), this.items.forEach((s) => s.reset()), this.search !== void 0 && this.search.clear(), te() && this.scrollLocker.unlock(), this.emit(
        "close"
        /* Close */
      );
    }
    /**
     * Clears memory
     */
    destroy() {
      this.flipper.deactivate(), this.listeners.removeAll(), te() && this.scrollLocker.unlock();
    }
    /**
     * Constructs HTML element corresponding to popover
     */
    make() {
      this.nodes.popover = c.make("div", [N.CSS.popover]), this.nodes.nothingFoundMessage = c.make("div", [N.CSS.nothingFoundMessage], {
        textContent: this.messages.nothingFound
      }), this.nodes.popover.appendChild(this.nodes.nothingFoundMessage), this.nodes.items = c.make("div", [N.CSS.items]), this.items.forEach((s) => {
        this.nodes.items.appendChild(s.getElement());
      }), this.nodes.popover.appendChild(this.nodes.items), this.listeners.on(this.nodes.popover, "click", (s) => {
        const e = this.getTargetItem(s);
        e !== void 0 && this.handleItemClick(e);
      }), this.nodes.wrapper = c.make("div"), this.nodes.overlay = c.make("div", [N.CSS.overlay, N.CSS.overlayHidden]), this.listeners.on(this.nodes.overlay, "click", () => {
        this.hide();
      }), this.nodes.wrapper.appendChild(this.nodes.overlay), this.nodes.wrapper.appendChild(this.nodes.popover);
    }
    /**
     * Adds search to the popover
     */
    addSearch() {
      this.search = new pe({
        items: this.items,
        placeholder: this.messages.search,
        onSearch: (e, t) => {
          this.items.forEach((i2) => {
            const n2 = !t.includes(i2);
            i2.toggleHidden(n2);
          }), this.toggleNothingFoundMessage(t.length === 0), this.toggleCustomContent(e !== "");
          const o3 = e === "" ? this.flippableElements : t.map((i2) => i2.getElement());
          this.flipper.isActivated && (this.flipper.deactivate(), this.flipper.activate(o3));
        }
      });
      const s = this.search.getElement();
      s.classList.add(N.CSS.search), this.nodes.popover.insertBefore(s, this.nodes.popover.firstChild);
    }
    /**
     * Adds custom html content to the popover
     *
     * @param content - html content to append
     */
    addCustomContent(s) {
      this.nodes.customContent = s, this.nodes.customContent.classList.add(N.CSS.customContent), this.nodes.popover.insertBefore(s, this.nodes.popover.firstChild);
    }
    /**
     * Retrieves popover item that is the target of the specified event
     *
     * @param event - event to retrieve popover item from
     */
    getTargetItem(s) {
      return this.items.find((e) => s.composedPath().includes(e.getElement()));
    }
    /**
     * Handles item clicks
     *
     * @param item - item to handle click of
     */
    handleItemClick(s) {
      s.isDisabled || (this.items.filter((e) => e !== s).forEach((e) => e.reset()), s.handleClick(), this.toggleItemActivenessIfNeeded(s), s.closeOnActivate && this.hide());
    }
    /**
     * Creates Flipper instance which allows to navigate between popover items via keyboard
     */
    initializeFlipper() {
      this.flipper = new q({
        items: this.flippableElements,
        focusedItemClass: _.CSS.focused,
        allowedKeys: [
          v.TAB,
          v.UP,
          v.DOWN,
          v.ENTER
        ]
      }), this.flipper.onFlip(this.onFlip);
    }
    /**
     * Returns list of elements available for keyboard navigation.
     * Contains both usual popover items elements and custom html content.
     */
    get flippableElements() {
      const s = this.items.map((t) => t.getElement());
      return (this.customContentFlippableItems || []).concat(s);
    }
    get height() {
      let s = 0;
      if (this.nodes.popover === null)
        return s;
      const e = this.nodes.popover.cloneNode(true);
      return e.style.visibility = "hidden", e.style.position = "absolute", e.style.top = "-1000px", e.classList.add(N.CSS.popoverOpened), document.body.appendChild(e), s = e.offsetHeight, e.remove(), s;
    }
    /**
     * Checks if popover should be opened bottom.
     * It should happen when there is enough space below or not enough space above
     */
    get shouldOpenBottom() {
      const s = this.nodes.popover.getBoundingClientRect(), e = this.scopeElement.getBoundingClientRect(), t = this.height, o3 = s.top + t, i2 = s.top - t, n2 = Math.min(window.innerHeight, e.bottom);
      return i2 < e.top || o3 <= n2;
    }
    /**
     * Toggles nothing found message visibility
     *
     * @param isDisplayed - true if the message should be displayed
     */
    toggleNothingFoundMessage(s) {
      this.nodes.nothingFoundMessage.classList.toggle(N.CSS.nothingFoundMessageDisplayed, s);
    }
    /**
     * Toggles custom content visibility
     *
     * @param isDisplayed - true if custom content should be displayed
     */
    toggleCustomContent(s) {
      var e;
      (e = this.nodes.customContent) == null || e.classList.toggle(N.CSS.customContentHidden, s);
    }
    /**
     * - Toggles item active state, if clicked popover item has property 'toggle' set to true.
     *
     * - Performs radiobutton-like behavior if the item has property 'toggle' set to string key.
     * (All the other items with the same key get inactive, and the item gets active)
     *
     * @param clickedItem - popover item that was clicked
     */
    toggleItemActivenessIfNeeded(s) {
      if (s.toggle === true && s.toggleActive(), typeof s.toggle == "string") {
        const e = this.items.filter((t) => t.toggle === s.toggle);
        if (e.length === 1) {
          s.toggleActive();
          return;
        }
        e.forEach((t) => {
          t.toggleActive(t === s);
        });
      }
    }
  };
  var je = N;
  Wo([
    le
  ], je.prototype, "height", 1);
  var Yo = class extends y {
    constructor() {
      super(...arguments), this.opened = false, this.selection = new b(), this.onPopoverClose = () => {
        this.close();
      };
    }
    /**
     * Module Events
     *
     * @returns {{opened: string, closed: string}}
     */
    get events() {
      return {
        opened: "block-settings-opened",
        closed: "block-settings-closed"
      };
    }
    /**
     * Block Settings CSS
     */
    get CSS() {
      return {
        settings: "ce-settings"
      };
    }
    /**
     * Getter for inner popover's flipper instance
     *
     * @todo remove once BlockSettings becomes standalone non-module class
     */
    get flipper() {
      var e;
      return (e = this.popover) == null ? void 0 : e.flipper;
    }
    /**
     * Panel with block settings with 2 sections:
     *  - Tool's Settings
     *  - Default Settings [Move, Remove, etc]
     */
    make() {
      this.nodes.wrapper = c.make("div", [this.CSS.settings]);
    }
    /**
     * Destroys module
     */
    destroy() {
      this.removeAllNodes();
    }
    /**
     * Open Block Settings pane
     *
     * @param targetBlock - near which Block we should open BlockSettings
     */
    open(e = this.Editor.BlockManager.currentBlock) {
      this.opened = true, this.selection.save(), this.Editor.BlockSelection.selectBlock(e), this.Editor.BlockSelection.clearCache();
      const [t, o3] = e.getTunes();
      this.eventsDispatcher.emit(this.events.opened), this.popover = new je({
        searchable: true,
        items: t.map((i2) => this.resolveTuneAliases(i2)),
        customContent: o3,
        customContentFlippableItems: this.getControls(o3),
        scopeElement: this.Editor.API.methods.ui.nodes.redactor,
        messages: {
          nothingFound: z.ui(K.ui.popover, "Nothing found"),
          search: z.ui(K.ui.popover, "Filter")
        }
      }), this.popover.on(be.Close, this.onPopoverClose), this.nodes.wrapper.append(this.popover.getElement()), this.popover.show();
    }
    /**
     * Returns root block settings element
     */
    getElement() {
      return this.nodes.wrapper;
    }
    /**
     * Close Block Settings pane
     */
    close() {
      this.opened && (this.opened = false, b.isAtEditor || this.selection.restore(), this.selection.clearSaved(), !this.Editor.CrossBlockSelection.isCrossBlockSelectionStarted && this.Editor.BlockManager.currentBlock && this.Editor.BlockSelection.unselectBlock(this.Editor.BlockManager.currentBlock), this.eventsDispatcher.emit(this.events.closed), this.popover && (this.popover.off(be.Close, this.onPopoverClose), this.popover.destroy(), this.popover.getElement().remove(), this.popover = null));
    }
    /**
     * Returns list of buttons and inputs inside specified container
     *
     * @param container - container to query controls inside of
     */
    getControls(e) {
      const { StylesAPI: t } = this.Editor, o3 = e.querySelectorAll(
        `.${t.classes.settingsButton}, ${c.allInputsSelector}`
      );
      return Array.from(o3);
    }
    /**
     * Resolves aliases in tunes menu items
     *
     * @param item - item with resolved aliases
     */
    resolveTuneAliases(e) {
      const t = Ao(e, { label: "title" });
      return e.confirmation && (t.confirmation = this.resolveTuneAliases(e.confirmation)), t;
    }
  };
  var $ = class _$ extends y {
    constructor() {
      super(...arguments), this.opened = false, this.tools = [], this.flipper = null, this.togglingCallback = null;
    }
    /**
     * CSS getter
     */
    static get CSS() {
      return {
        conversionToolbarWrapper: "ce-conversion-toolbar",
        conversionToolbarShowed: "ce-conversion-toolbar--showed",
        conversionToolbarTools: "ce-conversion-toolbar__tools",
        conversionToolbarLabel: "ce-conversion-toolbar__label",
        conversionTool: "ce-conversion-tool",
        conversionToolHidden: "ce-conversion-tool--hidden",
        conversionToolIcon: "ce-conversion-tool__icon",
        conversionToolSecondaryLabel: "ce-conversion-tool__secondary-label",
        conversionToolFocused: "ce-conversion-tool--focused",
        conversionToolActive: "ce-conversion-tool--active"
      };
    }
    /**
     * Create UI of Conversion Toolbar
     */
    make() {
      this.nodes.wrapper = c.make("div", [
        _$.CSS.conversionToolbarWrapper,
        ...this.isRtl ? [this.Editor.UI.CSS.editorRtlFix] : []
      ]), this.nodes.tools = c.make("div", _$.CSS.conversionToolbarTools);
      const e = c.make("div", _$.CSS.conversionToolbarLabel, {
        textContent: z.ui(K.ui.inlineToolbar.converter, "Convert to")
      });
      return this.addTools(), this.enableFlipper(), c.append(this.nodes.wrapper, e), c.append(this.nodes.wrapper, this.nodes.tools), this.nodes.wrapper;
    }
    /**
     * Deactivates flipper and removes all nodes
     */
    destroy() {
      this.flipper && (this.flipper.deactivate(), this.flipper = null), this.removeAllNodes();
    }
    /**
     * Toggle conversion dropdown visibility
     *
     * @param {Function} [togglingCallback] — callback that will accept opening state
     */
    toggle(e) {
      this.opened ? this.close() : this.open(), M(e) && (this.togglingCallback = e);
    }
    /**
     * Shows Conversion Toolbar
     */
    open() {
      this.filterTools(), this.opened = true, this.nodes.wrapper.classList.add(_$.CSS.conversionToolbarShowed), window.requestAnimationFrame(() => {
        this.flipper.activate(this.tools.map((e) => e.button).filter((e) => !e.classList.contains(_$.CSS.conversionToolHidden))), this.flipper.focusFirst(), M(this.togglingCallback) && this.togglingCallback(true);
      });
    }
    /**
     * Closes Conversion Toolbar
     */
    close() {
      this.opened = false, this.flipper.deactivate(), this.nodes.wrapper.classList.remove(_$.CSS.conversionToolbarShowed), M(this.togglingCallback) && this.togglingCallback(false);
    }
    /**
     * Returns true if it has more than one tool available for convert in
     */
    hasTools() {
      return this.tools.length === 1 ? this.tools[0].name !== this.config.defaultBlock : true;
    }
    /**
     * Replaces one Block with another
     * For that Tools must provide import/export methods
     *
     * @param {string} replacingToolName - name of Tool which replaces current
     * @param blockDataOverrides - If this conversion fired by the one of multiple Toolbox items, extend converted data with this item's "data" overrides
     */
    async replaceWithBlock(e, t) {
      const { BlockManager: o3, BlockSelection: i2, InlineToolbar: n2, Caret: r2 } = this.Editor;
      o3.convert(this.Editor.BlockManager.currentBlock, e, t), i2.clearSelection(), this.close(), n2.close(), window.requestAnimationFrame(() => {
        r2.setToBlock(this.Editor.BlockManager.currentBlock, r2.positions.END);
      });
    }
    /**
     * Iterates existing Tools and inserts to the ConversionToolbar
     * if tools have ability to import
     */
    addTools() {
      const e = this.Editor.Tools.blockTools;
      Array.from(e.entries()).forEach(([t, o3]) => {
        var n2;
        const i2 = o3.conversionConfig;
        !i2 || !i2.import || (n2 = o3.toolbox) == null || n2.forEach(
          (r2) => this.addToolIfValid(t, r2)
        );
      });
    }
    /**
     * Inserts a tool to the ConversionToolbar if the tool's toolbox config is valid
     *
     * @param name - tool's name
     * @param toolboxSettings - tool's single toolbox setting
     */
    addToolIfValid(e, t) {
      W(t) || !t.icon || this.addTool(e, t);
    }
    /**
     * Add tool to the Conversion Toolbar
     *
     * @param toolName - name of Tool to add
     * @param toolboxItem - tool's toolbox item data
     */
    addTool(e, t) {
      var r2;
      const o3 = c.make("div", [_$.CSS.conversionTool]), i2 = c.make("div", [_$.CSS.conversionToolIcon]);
      o3.dataset.tool = e, i2.innerHTML = t.icon, c.append(o3, i2), c.append(o3, c.text(z.t(K.toolNames, t.title || re(e))));
      const n2 = (r2 = this.Editor.Tools.blockTools.get(e)) == null ? void 0 : r2.shortcut;
      if (n2) {
        const a4 = c.make("span", _$.CSS.conversionToolSecondaryLabel, {
          innerText: ye(n2)
        });
        c.append(o3, a4);
      }
      c.append(this.nodes.tools, o3), this.tools.push({
        name: e,
        button: o3,
        toolboxItem: t
      }), this.listeners.on(o3, "click", async () => {
        await this.replaceWithBlock(e, t.data);
      });
    }
    /**
     * Hide current Tool and show others
     */
    async filterTools() {
      const { currentBlock: e } = this.Editor.BlockManager, t = await e.getActiveToolboxEntry();
      function o3(i2, n2) {
        return i2.icon === n2.icon && i2.title === n2.title;
      }
      this.tools.forEach((i2) => {
        let n2 = false;
        if (t) {
          const r2 = o3(t, i2.toolboxItem);
          n2 = i2.button.dataset.tool === e.name && r2;
        }
        i2.button.hidden = n2, i2.button.classList.toggle(_$.CSS.conversionToolHidden, n2);
      });
    }
    /**
     * Prepare Flipper to be able to leaf tools by arrows/tab
     */
    enableFlipper() {
      this.flipper = new q({
        focusedItemClass: _$.CSS.conversionToolFocused
      });
    }
  };
  var De = {};
  var Ko = {
    get exports() {
      return De;
    },
    set exports(s) {
      De = s;
    }
  };
  (function(s, e) {
    (function(t, o3) {
      s.exports = o3();
    })(window, function() {
      return function(t) {
        var o3 = {};
        function i2(n2) {
          if (o3[n2])
            return o3[n2].exports;
          var r2 = o3[n2] = { i: n2, l: false, exports: {} };
          return t[n2].call(r2.exports, r2, r2.exports, i2), r2.l = true, r2.exports;
        }
        return i2.m = t, i2.c = o3, i2.d = function(n2, r2, a4) {
          i2.o(n2, r2) || Object.defineProperty(n2, r2, { enumerable: true, get: a4 });
        }, i2.r = function(n2) {
          typeof Symbol < "u" && Symbol.toStringTag && Object.defineProperty(n2, Symbol.toStringTag, { value: "Module" }), Object.defineProperty(n2, "__esModule", { value: true });
        }, i2.t = function(n2, r2) {
          if (1 & r2 && (n2 = i2(n2)), 8 & r2 || 4 & r2 && typeof n2 == "object" && n2 && n2.__esModule)
            return n2;
          var a4 = /* @__PURE__ */ Object.create(null);
          if (i2.r(a4), Object.defineProperty(a4, "default", { enumerable: true, value: n2 }), 2 & r2 && typeof n2 != "string")
            for (var l4 in n2)
              i2.d(a4, l4, function(d4) {
                return n2[d4];
              }.bind(null, l4));
          return a4;
        }, i2.n = function(n2) {
          var r2 = n2 && n2.__esModule ? function() {
            return n2.default;
          } : function() {
            return n2;
          };
          return i2.d(r2, "a", r2), r2;
        }, i2.o = function(n2, r2) {
          return Object.prototype.hasOwnProperty.call(n2, r2);
        }, i2.p = "", i2(i2.s = 0);
      }([function(t, o3, i2) {
        function n2(l4, d4) {
          for (var u2 = 0; u2 < d4.length; u2++) {
            var h3 = d4[u2];
            h3.enumerable = h3.enumerable || false, h3.configurable = true, "value" in h3 && (h3.writable = true), Object.defineProperty(l4, h3.key, h3);
          }
        }
        function r2(l4, d4, u2) {
          return d4 && n2(l4.prototype, d4), u2 && n2(l4, u2), l4;
        }
        i2.r(o3);
        var a4 = function() {
          function l4(d4) {
            var u2 = this;
            (function(h3, f) {
              if (!(h3 instanceof f))
                throw new TypeError("Cannot call a class as a function");
            })(this, l4), this.commands = {}, this.keys = {}, this.name = d4.name, this.parseShortcutName(d4.name), this.element = d4.on, this.callback = d4.callback, this.executeShortcut = function(h3) {
              u2.execute(h3);
            }, this.element.addEventListener("keydown", this.executeShortcut, false);
          }
          return r2(l4, null, [{ key: "supportedCommands", get: function() {
            return { SHIFT: ["SHIFT"], CMD: ["CMD", "CONTROL", "COMMAND", "WINDOWS", "CTRL"], ALT: ["ALT", "OPTION"] };
          } }, { key: "keyCodes", get: function() {
            return { 0: 48, 1: 49, 2: 50, 3: 51, 4: 52, 5: 53, 6: 54, 7: 55, 8: 56, 9: 57, A: 65, B: 66, C: 67, D: 68, E: 69, F: 70, G: 71, H: 72, I: 73, J: 74, K: 75, L: 76, M: 77, N: 78, O: 79, P: 80, Q: 81, R: 82, S: 83, T: 84, U: 85, V: 86, W: 87, X: 88, Y: 89, Z: 90, BACKSPACE: 8, ENTER: 13, ESCAPE: 27, LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, INSERT: 45, DELETE: 46, ".": 190 };
          } }]), r2(l4, [{ key: "parseShortcutName", value: function(d4) {
            d4 = d4.split("+");
            for (var u2 = 0; u2 < d4.length; u2++) {
              d4[u2] = d4[u2].toUpperCase();
              var h3 = false;
              for (var f in l4.supportedCommands)
                if (l4.supportedCommands[f].includes(d4[u2])) {
                  h3 = this.commands[f] = true;
                  break;
                }
              h3 || (this.keys[d4[u2]] = true);
            }
            for (var x in l4.supportedCommands)
              this.commands[x] || (this.commands[x] = false);
          } }, { key: "execute", value: function(d4) {
            var u2, h3 = { CMD: d4.ctrlKey || d4.metaKey, SHIFT: d4.shiftKey, ALT: d4.altKey }, f = true;
            for (u2 in this.commands)
              this.commands[u2] !== h3[u2] && (f = false);
            var x, p = true;
            for (x in this.keys)
              p = p && d4.keyCode === l4.keyCodes[x];
            f && p && this.callback(d4);
          } }, { key: "remove", value: function() {
            this.element.removeEventListener("keydown", this.executeShortcut);
          } }]), l4;
        }();
        o3.default = a4;
      }]).default;
    });
  })(Ko);
  var Xo = /* @__PURE__ */ Pe(De);
  var Vo = class {
    constructor() {
      this.registeredShortcuts = /* @__PURE__ */ new Map();
    }
    /**
     * Register shortcut
     *
     * @param shortcut - shortcut options
     */
    add(e) {
      if (this.findShortcut(e.on, e.name))
        throw Error(
          `Shortcut ${e.name} is already registered for ${e.on}. Please remove it before add a new handler.`
        );
      const o3 = new Xo({
        name: e.name,
        on: e.on,
        callback: e.handler
      }), i2 = this.registeredShortcuts.get(e.on) || [];
      this.registeredShortcuts.set(e.on, [...i2, o3]);
    }
    /**
     * Remove shortcut
     *
     * @param element - Element shortcut is set for
     * @param name - shortcut name
     */
    remove(e, t) {
      const o3 = this.findShortcut(e, t);
      if (!o3)
        return;
      o3.remove();
      const i2 = this.registeredShortcuts.get(e);
      this.registeredShortcuts.set(e, i2.filter((n2) => n2 !== o3));
    }
    /**
     * Get Shortcut instance if exist
     *
     * @param element - Element shorcut is set for
     * @param shortcut - shortcut name
     * @returns {number} index - shortcut index if exist
     */
    findShortcut(e, t) {
      return (this.registeredShortcuts.get(e) || []).find(({ name: i2 }) => i2 === t);
    }
  };
  var ae = new Vo();
  var qo = Object.defineProperty;
  var Zo = Object.getOwnPropertyDescriptor;
  var xt = (s, e, t, o3) => {
    for (var i2 = o3 > 1 ? void 0 : o3 ? Zo(e, t) : e, n2 = s.length - 1, r2; n2 >= 0; n2--)
      (r2 = s[n2]) && (i2 = (o3 ? r2(e, t, i2) : r2(i2)) || i2);
    return o3 && i2 && qo(e, t, i2), i2;
  };
  var ke = /* @__PURE__ */ ((s) => (s.Opened = "toolbox-opened", s.Closed = "toolbox-closed", s.BlockAdded = "toolbox-block-added", s))(ke || {});
  var wt = class extends Ee {
    /**
     * Toolbox constructor
     *
     * @param options - available parameters
     * @param options.api - Editor API methods
     * @param options.tools - Tools available to check whether some of them should be displayed at the Toolbox or not
     */
    constructor({ api: s, tools: e, i18nLabels: t }) {
      super(), this.opened = false, this.nodes = {
        toolbox: null
      }, this.onPopoverClose = () => {
        this.opened = false, this.emit(
          "toolbox-closed"
          /* Closed */
        );
      }, this.api = s, this.tools = e, this.i18nLabels = t;
    }
    /**
     * Returns True if Toolbox is Empty and nothing to show
     *
     * @returns {boolean}
     */
    get isEmpty() {
      return this.toolsToBeDisplayed.length === 0;
    }
    /**
     * CSS styles
     *
     * @returns {Object<string, string>}
     */
    static get CSS() {
      return {
        toolbox: "ce-toolbox"
      };
    }
    /**
     * Makes the Toolbox
     */
    make() {
      return this.popover = new je({
        scopeElement: this.api.ui.nodes.redactor,
        searchable: true,
        messages: {
          nothingFound: this.i18nLabels.nothingFound,
          search: this.i18nLabels.filter
        },
        items: this.toolboxItemsToBeDisplayed
      }), this.popover.on(be.Close, this.onPopoverClose), this.enableShortcuts(), this.nodes.toolbox = this.popover.getElement(), this.nodes.toolbox.classList.add(wt.CSS.toolbox), this.nodes.toolbox;
    }
    /**
     * Returns true if the Toolbox has the Flipper activated and the Flipper has selected button
     */
    hasFocus() {
      var s;
      return (s = this.popover) == null ? void 0 : s.hasFocus();
    }
    /**
     * Destroy Module
     */
    destroy() {
      var s;
      super.destroy(), this.nodes && this.nodes.toolbox && (this.nodes.toolbox.remove(), this.nodes.toolbox = null), this.removeAllShortcuts(), (s = this.popover) == null || s.off(be.Close, this.onPopoverClose);
    }
    /**
     * Toolbox Tool's button click handler
     *
     * @param toolName - tool type to be activated
     * @param blockDataOverrides - Block data predefined by the activated Toolbox item
     */
    toolButtonActivated(s, e) {
      this.insertNewBlock(s, e);
    }
    /**
     * Open Toolbox with Tools
     */
    open() {
      var s;
      this.isEmpty || ((s = this.popover) == null || s.show(), this.opened = true, this.emit(
        "toolbox-opened"
        /* Opened */
      ));
    }
    /**
     * Close Toolbox
     */
    close() {
      var s;
      (s = this.popover) == null || s.hide(), this.opened = false, this.emit(
        "toolbox-closed"
        /* Closed */
      );
    }
    /**
     * Close Toolbox
     */
    toggle() {
      this.opened ? this.close() : this.open();
    }
    get toolsToBeDisplayed() {
      const s = [];
      return this.tools.forEach((e) => {
        e.toolbox && s.push(e);
      }), s;
    }
    get toolboxItemsToBeDisplayed() {
      const s = (e, t) => ({
        icon: e.icon,
        title: z.t(K.toolNames, e.title || re(t.name)),
        name: t.name,
        onActivate: () => {
          this.toolButtonActivated(t.name, e.data);
        },
        secondaryLabel: t.shortcut ? ye(t.shortcut) : ""
      });
      return this.toolsToBeDisplayed.reduce((e, t) => (Array.isArray(t.toolbox) ? t.toolbox.forEach((o3) => {
        e.push(s(o3, t));
      }) : t.toolbox !== void 0 && e.push(s(t.toolbox, t)), e), []);
    }
    /**
     * Iterate all tools and enable theirs shortcuts if specified
     */
    enableShortcuts() {
      this.toolsToBeDisplayed.forEach((s) => {
        const e = s.shortcut;
        e && this.enableShortcutForTool(s.name, e);
      });
    }
    /**
     * Enable shortcut Block Tool implemented shortcut
     *
     * @param {string} toolName - Tool name
     * @param {string} shortcut - shortcut according to the ShortcutData Module format
     */
    enableShortcutForTool(s, e) {
      ae.add({
        name: e,
        on: this.api.ui.nodes.redactor,
        handler: (t) => {
          t.preventDefault();
          const o3 = this.api.blocks.getCurrentBlockIndex(), i2 = this.api.blocks.getBlockByIndex(o3);
          if (i2)
            try {
              this.api.blocks.convert(i2.id, s), window.requestAnimationFrame(() => {
                this.api.caret.setToBlock(o3, "end");
              });
              return;
            } catch {
            }
          this.insertNewBlock(s);
        }
      });
    }
    /**
     * Removes all added shortcuts
     * Fired when the Read-Only mode is activated
     */
    removeAllShortcuts() {
      this.toolsToBeDisplayed.forEach((s) => {
        const e = s.shortcut;
        e && ae.remove(this.api.ui.nodes.redactor, e);
      });
    }
    /**
     * Inserts new block
     * Can be called when button clicked on Toolbox or by ShortcutData
     *
     * @param {string} toolName - Tool name
     * @param blockDataOverrides - predefined Block data
     */
    async insertNewBlock(s, e) {
      const t = this.api.blocks.getCurrentBlockIndex(), o3 = this.api.blocks.getBlockByIndex(t);
      if (!o3)
        return;
      const i2 = o3.isEmpty ? t : t + 1;
      let n2;
      if (e) {
        const a4 = await this.api.blocks.composeBlockData(s);
        n2 = Object.assign(a4, e);
      }
      const r2 = this.api.blocks.insert(
        s,
        n2,
        void 0,
        i2,
        void 0,
        o3.isEmpty
      );
      r2.call(X.APPEND_CALLBACK), this.api.caret.setToBlock(i2), this.emit("toolbox-block-added", {
        block: r2
      }), this.api.toolbar.close();
    }
  };
  var $e = wt;
  xt([
    le
  ], $e.prototype, "toolsToBeDisplayed", 1);
  xt([
    le
  ], $e.prototype, "toolboxItemsToBeDisplayed", 1);
  var yt = "block hovered";
  async function Go(s, e) {
    const t = navigator.keyboard;
    return t && (await t.getLayoutMap()).get(s) || e;
  }
  var Jo = class extends y {
    /**
     * @class
     * @param moduleConfiguration - Module Configuration
     * @param moduleConfiguration.config - Editor's config
     * @param moduleConfiguration.eventsDispatcher - Editor's event dispatcher
     */
    constructor({ config: e, eventsDispatcher: t }) {
      super({
        config: e,
        eventsDispatcher: t
      }), this.toolboxInstance = null;
    }
    /**
     * CSS styles
     *
     * @returns {object}
     */
    get CSS() {
      return {
        toolbar: "ce-toolbar",
        content: "ce-toolbar__content",
        actions: "ce-toolbar__actions",
        actionsOpened: "ce-toolbar__actions--opened",
        toolbarOpened: "ce-toolbar--opened",
        openedToolboxHolderModifier: "codex-editor--toolbox-opened",
        plusButton: "ce-toolbar__plus",
        plusButtonShortcut: "ce-toolbar__plus-shortcut",
        settingsToggler: "ce-toolbar__settings-btn",
        settingsTogglerHidden: "ce-toolbar__settings-btn--hidden"
      };
    }
    /**
     * Returns the Toolbar opening state
     *
     * @returns {boolean}
     */
    get opened() {
      return this.nodes.wrapper.classList.contains(this.CSS.toolbarOpened);
    }
    /**
     * Public interface for accessing the Toolbox
     */
    get toolbox() {
      var e;
      return {
        opened: (e = this.toolboxInstance) == null ? void 0 : e.opened,
        close: () => {
          var t;
          (t = this.toolboxInstance) == null || t.close();
        },
        open: () => {
          if (this.toolboxInstance === null) {
            T("toolbox.open() called before initialization is finished", "warn");
            return;
          }
          this.Editor.BlockManager.currentBlock = this.hoveredBlock, this.toolboxInstance.open();
        },
        toggle: () => {
          if (this.toolboxInstance === null) {
            T("toolbox.toggle() called before initialization is finished", "warn");
            return;
          }
          this.toolboxInstance.toggle();
        },
        hasFocus: () => {
          var t;
          return (t = this.toolboxInstance) == null ? void 0 : t.hasFocus();
        }
      };
    }
    /**
     * Block actions appearance manipulations
     */
    get blockActions() {
      return {
        hide: () => {
          this.nodes.actions.classList.remove(this.CSS.actionsOpened);
        },
        show: () => {
          this.nodes.actions.classList.add(this.CSS.actionsOpened);
        }
      };
    }
    /**
     * Methods for working with Block Tunes toggler
     */
    get blockTunesToggler() {
      return {
        hide: () => this.nodes.settingsToggler.classList.add(this.CSS.settingsTogglerHidden),
        show: () => this.nodes.settingsToggler.classList.remove(this.CSS.settingsTogglerHidden)
      };
    }
    /**
     * Toggles read-only mode
     *
     * @param {boolean} readOnlyEnabled - read-only mode
     */
    toggleReadOnly(e) {
      e ? (this.destroy(), this.Editor.BlockSettings.destroy(), this.disableModuleBindings()) : window.requestIdleCallback(() => {
        this.drawUI(), this.enableModuleBindings();
      }, { timeout: 2e3 });
    }
    /**
     * Move Toolbar to the passed (or current) Block
     *
     * @param block - block to move Toolbar near it
     */
    moveAndOpen(e = this.Editor.BlockManager.currentBlock) {
      if (this.toolboxInstance === null) {
        T("Can't open Toolbar since Editor initialization is not finished yet", "warn");
        return;
      }
      if (this.toolboxInstance.opened && this.toolboxInstance.close(), this.Editor.BlockSettings.opened && this.Editor.BlockSettings.close(), !e)
        return;
      this.hoveredBlock = e;
      const t = e.holder, { isMobile: o3 } = this.Editor.UI, i2 = e.pluginsContent, n2 = window.getComputedStyle(i2), r2 = parseInt(n2.paddingTop, 10), a4 = t.offsetHeight;
      let l4;
      o3 ? l4 = t.offsetTop + a4 : l4 = t.offsetTop + r2, this.nodes.wrapper.style.top = `${Math.floor(l4)}px`, this.Editor.BlockManager.blocks.length === 1 && e.isEmpty ? this.blockTunesToggler.hide() : this.blockTunesToggler.show(), this.open();
    }
    /**
     * Close the Toolbar
     */
    close() {
      var e, t;
      this.Editor.ReadOnly.isEnabled || ((e = this.nodes.wrapper) == null || e.classList.remove(this.CSS.toolbarOpened), this.blockActions.hide(), (t = this.toolboxInstance) == null || t.close(), this.Editor.BlockSettings.close(), this.reset());
    }
    /**
     * Reset the Toolbar position to prevent DOM height growth, for example after blocks deletion
     */
    reset() {
      this.nodes.wrapper.style.top = "unset";
    }
    /**
     * Open Toolbar with Plus Button and Actions
     *
     * @param {boolean} withBlockActions - by default, Toolbar opens with Block Actions.
     *                                     This flag allows to open Toolbar without Actions.
     */
    open(e = true) {
      this.nodes.wrapper.classList.add(this.CSS.toolbarOpened), e ? this.blockActions.show() : this.blockActions.hide();
    }
    /**
     * Draws Toolbar elements
     */
    async make() {
      this.nodes.wrapper = c.make("div", this.CSS.toolbar), ["content", "actions"].forEach((n2) => {
        this.nodes[n2] = c.make("div", this.CSS[n2]);
      }), c.append(this.nodes.wrapper, this.nodes.content), c.append(this.nodes.content, this.nodes.actions), this.nodes.plusButton = c.make("div", this.CSS.plusButton, {
        innerHTML: Fo
      }), c.append(this.nodes.actions, this.nodes.plusButton), this.readOnlyMutableListeners.on(this.nodes.plusButton, "click", () => {
        Re(true), this.plusButtonClicked();
      }, false);
      const e = c.make("div");
      e.appendChild(document.createTextNode(z.ui(K.ui.toolbar.toolbox, "Add"))), e.appendChild(c.make("div", this.CSS.plusButtonShortcut, {
        textContent: "/"
      })), ge(this.nodes.plusButton, e, {
        hidingDelay: 400
      }), this.nodes.settingsToggler = c.make("span", this.CSS.settingsToggler, {
        innerHTML: Po
      }), c.append(this.nodes.actions, this.nodes.settingsToggler);
      const t = c.make("div"), o3 = c.text(z.ui(K.ui.blockTunes.toggler, "Click to tune")), i2 = await Go("Slash", "/");
      t.appendChild(o3), t.appendChild(c.make("div", this.CSS.plusButtonShortcut, {
        textContent: ye(`CMD + ${i2}`)
      })), ge(this.nodes.settingsToggler, t, {
        hidingDelay: 400
      }), c.append(this.nodes.actions, this.makeToolbox()), c.append(this.nodes.actions, this.Editor.BlockSettings.getElement()), c.append(this.Editor.UI.nodes.wrapper, this.nodes.wrapper);
    }
    /**
     * Creates the Toolbox instance and return it's rendered element
     */
    makeToolbox() {
      return this.toolboxInstance = new $e({
        api: this.Editor.API.methods,
        tools: this.Editor.Tools.blockTools,
        i18nLabels: {
          filter: z.ui(K.ui.popover, "Filter"),
          nothingFound: z.ui(K.ui.popover, "Nothing found")
        }
      }), this.toolboxInstance.on(ke.Opened, () => {
        this.Editor.UI.nodes.wrapper.classList.add(this.CSS.openedToolboxHolderModifier);
      }), this.toolboxInstance.on(ke.Closed, () => {
        this.Editor.UI.nodes.wrapper.classList.remove(this.CSS.openedToolboxHolderModifier);
      }), this.toolboxInstance.on(ke.BlockAdded, ({ block: e }) => {
        const { BlockManager: t, Caret: o3 } = this.Editor, i2 = t.getBlockById(e.id);
        i2.inputs.length === 0 && (i2 === t.lastBlock ? (t.insertAtEnd(), o3.setToBlock(t.lastBlock)) : o3.setToBlock(t.nextBlock));
      }), this.toolboxInstance.make();
    }
    /**
     * Handler for Plus Button
     */
    plusButtonClicked() {
      var e;
      this.Editor.BlockManager.currentBlock = this.hoveredBlock, (e = this.toolboxInstance) == null || e.toggle();
    }
    /**
     * Enable bindings
     */
    enableModuleBindings() {
      this.readOnlyMutableListeners.on(this.nodes.settingsToggler, "mousedown", (e) => {
        var t;
        e.stopPropagation(), this.settingsTogglerClicked(), (t = this.toolboxInstance) != null && t.opened && this.toolboxInstance.close(), Re(true);
      }, true), te() || this.eventsDispatcher.on(yt, (e) => {
        var t;
        this.Editor.BlockSettings.opened || (t = this.toolboxInstance) != null && t.opened || this.moveAndOpen(e.block);
      });
    }
    /**
     * Disable bindings
     */
    disableModuleBindings() {
      this.readOnlyMutableListeners.clearAll();
    }
    /**
     * Clicks on the Block Settings toggler
     */
    settingsTogglerClicked() {
      this.Editor.BlockManager.currentBlock = this.hoveredBlock, this.Editor.BlockSettings.opened ? this.Editor.BlockSettings.close() : this.Editor.BlockSettings.open(this.hoveredBlock);
    }
    /**
     * Draws Toolbar UI
     *
     * Toolbar contains BlockSettings and Toolbox.
     * That's why at first we draw its components and then Toolbar itself
     *
     * Steps:
     *  - Make Toolbar dependent components like BlockSettings, Toolbox and so on
     *  - Make itself and append dependent nodes to itself
     *
     */
    drawUI() {
      this.Editor.BlockSettings.make(), this.make();
    }
    /**
     * Removes all created and saved HTMLElements
     * It is used in Read-Only mode
     */
    destroy() {
      this.removeAllNodes(), this.toolboxInstance && this.toolboxInstance.destroy();
    }
  };
  var Be = /* @__PURE__ */ ((s) => (s[s.Block = 0] = "Block", s[s.Inline = 1] = "Inline", s[s.Tune = 2] = "Tune", s))(Be || {});
  var ve = /* @__PURE__ */ ((s) => (s.Shortcut = "shortcut", s.Toolbox = "toolbox", s.EnabledInlineTools = "inlineToolbar", s.EnabledBlockTunes = "tunes", s.Config = "config", s))(ve || {});
  var Et = /* @__PURE__ */ ((s) => (s.Shortcut = "shortcut", s.SanitizeConfig = "sanitize", s))(Et || {});
  var se = /* @__PURE__ */ ((s) => (s.IsEnabledLineBreaks = "enableLineBreaks", s.Toolbox = "toolbox", s.ConversionConfig = "conversionConfig", s.IsReadOnlySupported = "isReadOnlySupported", s.PasteConfig = "pasteConfig", s))(se || {});
  var We = /* @__PURE__ */ ((s) => (s.IsInline = "isInline", s.Title = "title", s))(We || {});
  var Bt = /* @__PURE__ */ ((s) => (s.IsTune = "isTune", s))(Bt || {});
  var Ye = class {
    /**
     * @class
     * @param {ConstructorOptions} options - Constructor options
     */
    constructor({
      name: e,
      constructable: t,
      config: o3,
      api: i2,
      isDefault: n2,
      isInternal: r2 = false,
      defaultPlaceholder: a4
    }) {
      this.api = i2, this.name = e, this.constructable = t, this.config = o3, this.isDefault = n2, this.isInternal = r2, this.defaultPlaceholder = a4;
    }
    /**
     * Returns Tool user configuration
     */
    get settings() {
      const e = this.config.config || {};
      return this.isDefault && !("placeholder" in e) && this.defaultPlaceholder && (e.placeholder = this.defaultPlaceholder), e;
    }
    /**
     * Calls Tool's reset method
     */
    reset() {
      if (M(this.constructable.reset))
        return this.constructable.reset();
    }
    /**
     * Calls Tool's prepare method
     */
    prepare() {
      if (M(this.constructable.prepare))
        return this.constructable.prepare({
          toolName: this.name,
          config: this.settings
        });
    }
    /**
     * Returns shortcut for Tool (internal or specified by user)
     */
    get shortcut() {
      const e = this.constructable.shortcut;
      return this.config.shortcut || e;
    }
    /**
     * Returns Tool's sanitizer configuration
     */
    get sanitizeConfig() {
      return this.constructable.sanitize || {};
    }
    /**
     * Returns true if Tools is inline
     */
    isInline() {
      return this.type === 1;
    }
    /**
     * Returns true if Tools is block
     */
    isBlock() {
      return this.type === 0;
    }
    /**
     * Returns true if Tools is tune
     */
    isTune() {
      return this.type === 2;
    }
  };
  var Qo = class extends y {
    /**
     * @class
     * @param moduleConfiguration - Module Configuration
     * @param moduleConfiguration.config - Editor's config
     * @param moduleConfiguration.eventsDispatcher - Editor's event dispatcher
     */
    constructor({ config: e, eventsDispatcher: t }) {
      super({
        config: e,
        eventsDispatcher: t
      }), this.CSS = {
        inlineToolbar: "ce-inline-toolbar",
        inlineToolbarShowed: "ce-inline-toolbar--showed",
        inlineToolbarLeftOriented: "ce-inline-toolbar--left-oriented",
        inlineToolbarRightOriented: "ce-inline-toolbar--right-oriented",
        inlineToolbarShortcut: "ce-inline-toolbar__shortcut",
        buttonsWrapper: "ce-inline-toolbar__buttons",
        actionsWrapper: "ce-inline-toolbar__actions",
        inlineToolButton: "ce-inline-tool",
        inputField: "cdx-input",
        focusedButton: "ce-inline-tool--focused",
        conversionToggler: "ce-inline-toolbar__dropdown",
        conversionTogglerArrow: "ce-inline-toolbar__dropdown-arrow",
        conversionTogglerHidden: "ce-inline-toolbar__dropdown--hidden",
        conversionTogglerContent: "ce-inline-toolbar__dropdown-content",
        togglerAndButtonsWrapper: "ce-inline-toolbar__toggler-and-button-wrapper"
      }, this.opened = false, this.toolbarVerticalMargin = te() ? 20 : 6, this.buttonsList = null, this.width = 0, this.flipper = null;
    }
    /**
     * Toggles read-only mode
     *
     * @param {boolean} readOnlyEnabled - read-only mode
     */
    toggleReadOnly(e) {
      e ? (this.destroy(), this.Editor.ConversionToolbar.destroy()) : window.requestIdleCallback(() => {
        this.make();
      }, { timeout: 2e3 });
    }
    /**
     *  Moving / appearance
     *  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     */
    /**
     * Shows Inline Toolbar if something is selected
     *
     * @param [needToClose] - pass true to close toolbar if it is not allowed.
     *                                  Avoid to use it just for closing IT, better call .close() clearly.
     * @param [needToShowConversionToolbar] - pass false to not to show Conversion Toolbar
     */
    async tryToShow(e = false, t = true) {
      e && this.close(), this.allowedToShow() && (await this.addToolsFiltered(t), this.move(), this.open(t), this.Editor.Toolbar.close());
    }
    /**
     * Hides Inline Toolbar
     */
    close() {
      this.opened && (this.Editor.ReadOnly.isEnabled || (this.nodes.wrapper.classList.remove(this.CSS.inlineToolbarShowed), Array.from(this.toolsInstances.entries()).forEach(([e, t]) => {
        const o3 = this.getToolShortcut(e);
        o3 && ae.remove(this.Editor.UI.nodes.redactor, o3), M(t.clear) && t.clear();
      }), this.reset(), this.opened = false, this.flipper.deactivate(), this.Editor.ConversionToolbar.close()));
    }
    /**
     * Check if node is contained by Inline Toolbar
     *
     * @param {Node} node — node to check
     */
    containsNode(e) {
      return this.nodes.wrapper === void 0 ? false : this.nodes.wrapper.contains(e);
    }
    /**
     * Removes UI and its components
     */
    destroy() {
      this.flipper && (this.flipper.deactivate(), this.flipper = null), this.removeAllNodes();
    }
    /**
     * Making DOM
     */
    make() {
      this.nodes.wrapper = c.make("div", [
        this.CSS.inlineToolbar,
        ...this.isRtl ? [this.Editor.UI.CSS.editorRtlFix] : []
      ]), this.nodes.togglerAndButtonsWrapper = c.make("div", this.CSS.togglerAndButtonsWrapper), this.nodes.buttons = c.make("div", this.CSS.buttonsWrapper), this.nodes.actions = c.make("div", this.CSS.actionsWrapper), this.listeners.on(this.nodes.wrapper, "mousedown", (e) => {
        e.target.closest(`.${this.CSS.actionsWrapper}`) || e.preventDefault();
      }), c.append(this.nodes.wrapper, [this.nodes.togglerAndButtonsWrapper, this.nodes.actions]), c.append(this.Editor.UI.nodes.wrapper, this.nodes.wrapper), this.addConversionToggler(), c.append(this.nodes.togglerAndButtonsWrapper, this.nodes.buttons), this.prepareConversionToolbar(), window.requestAnimationFrame(() => {
        this.recalculateWidth();
      }), this.enableFlipper();
    }
    /**
     * Shows Inline Toolbar
     */
    open() {
      if (this.opened)
        return;
      this.nodes.wrapper.classList.add(this.CSS.inlineToolbarShowed), this.buttonsList = this.nodes.buttons.querySelectorAll(`.${this.CSS.inlineToolButton}`), this.opened = true;
      let e = Array.from(this.buttonsList);
      e.unshift(this.nodes.conversionToggler), e = e.filter((t) => !t.hidden), this.flipper.activate(e);
    }
    /**
     * Move Toolbar to the selected text
     */
    move() {
      const e = b.rect, t = this.Editor.UI.nodes.wrapper.getBoundingClientRect(), o3 = {
        x: e.x - t.x,
        y: e.y + e.height - // + window.scrollY
        t.top + this.toolbarVerticalMargin
      };
      o3.x + this.width + t.x > this.Editor.UI.contentRect.right && (o3.x = this.Editor.UI.contentRect.right - this.width - t.x), this.nodes.wrapper.style.left = Math.floor(o3.x) + "px", this.nodes.wrapper.style.top = Math.floor(o3.y) + "px";
    }
    /**
     * Clear orientation classes and reset position
     */
    reset() {
      this.nodes.wrapper.classList.remove(
        this.CSS.inlineToolbarLeftOriented,
        this.CSS.inlineToolbarRightOriented
      ), this.nodes.wrapper.style.left = "0", this.nodes.wrapper.style.top = "0";
    }
    /**
     * Need to show Inline Toolbar or not
     */
    allowedToShow() {
      const e = ["IMG", "INPUT"], t = b.get(), o3 = b.text;
      if (!t || !t.anchorNode || t.isCollapsed || o3.length < 1)
        return false;
      const i2 = c.isElement(t.anchorNode) ? t.anchorNode : t.anchorNode.parentElement;
      if (t && e.includes(i2.tagName) || i2.closest('[contenteditable="true"]') === null)
        return false;
      const r2 = this.Editor.BlockManager.getBlock(t.anchorNode);
      return r2 ? r2.tool.inlineTools.size !== 0 : false;
    }
    /**
     * Recalculate inline toolbar width
     */
    recalculateWidth() {
      this.width = this.nodes.wrapper.offsetWidth;
    }
    /**
     * Create a toggler for Conversion Dropdown
     * and prepend it to the buttons list
     */
    addConversionToggler() {
      this.nodes.conversionToggler = c.make("div", this.CSS.conversionToggler), this.nodes.conversionTogglerContent = c.make("div", this.CSS.conversionTogglerContent);
      const e = c.make("div", this.CSS.conversionTogglerArrow, {
        innerHTML: kt
      });
      this.nodes.conversionToggler.appendChild(this.nodes.conversionTogglerContent), this.nodes.conversionToggler.appendChild(e), this.nodes.togglerAndButtonsWrapper.appendChild(this.nodes.conversionToggler), this.listeners.on(this.nodes.conversionToggler, "click", () => {
        this.Editor.ConversionToolbar.toggle((t) => {
          !t && this.opened ? this.flipper.activate() : this.opened && this.flipper.deactivate();
        });
      }), te() === false && ge(this.nodes.conversionToggler, z.ui(K.ui.inlineToolbar.converter, "Convert to"), {
        placement: "top",
        hidingDelay: 100
      });
    }
    /**
     * Changes Conversion Dropdown content for current block's Tool
     */
    async setConversionTogglerContent() {
      const { BlockManager: e } = this.Editor, { currentBlock: t } = e, o3 = t.name, i2 = t.tool.conversionConfig, n2 = i2 && i2.export;
      this.nodes.conversionToggler.hidden = !n2, this.nodes.conversionToggler.classList.toggle(this.CSS.conversionTogglerHidden, !n2);
      const r2 = await t.getActiveToolboxEntry() || {};
      this.nodes.conversionTogglerContent.innerHTML = r2.icon || r2.title || re(o3);
    }
    /**
     * Makes the Conversion Dropdown
     */
    prepareConversionToolbar() {
      const e = this.Editor.ConversionToolbar.make();
      c.append(this.nodes.wrapper, e);
    }
    /**
     *  Working with Tools
     *  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     */
    /**
     * Append only allowed Tools
     *
     * @param {boolean} needToShowConversionToolbar - pass false to not to show Conversion Toolbar (e.g. for Footnotes-like tools)
     */
    async addToolsFiltered(e = true) {
      const t = b.get(), o3 = this.Editor.BlockManager.getBlock(t.anchorNode);
      this.nodes.buttons.innerHTML = "", this.nodes.actions.innerHTML = "", this.toolsInstances = /* @__PURE__ */ new Map(), Array.from(o3.tool.inlineTools.values()).forEach((i2) => {
        this.addTool(i2);
      }), e && this.Editor.ConversionToolbar.hasTools() ? await this.setConversionTogglerContent() : this.nodes.conversionToggler.hidden = true, this.recalculateWidth();
    }
    /**
     * Add tool button and activate clicks
     *
     * @param {InlineTool} tool - InlineTool object
     */
    addTool(e) {
      const t = e.create(), o3 = t.render();
      if (!o3) {
        T("Render method must return an instance of Node", "warn", e.name);
        return;
      }
      if (o3.dataset.tool = e.name, this.nodes.buttons.appendChild(o3), this.toolsInstances.set(e.name, t), M(t.renderActions)) {
        const a4 = t.renderActions();
        this.nodes.actions.appendChild(a4);
      }
      this.listeners.on(o3, "click", (a4) => {
        this.toolClicked(t), a4.preventDefault();
      });
      const i2 = this.getToolShortcut(e.name);
      if (i2)
        try {
          this.enableShortcuts(t, i2);
        } catch {
        }
      const n2 = c.make("div"), r2 = z.t(
        K.toolNames,
        e.title || re(e.name)
      );
      n2.appendChild(c.text(r2)), i2 && n2.appendChild(c.make("div", this.CSS.inlineToolbarShortcut, {
        textContent: ye(i2)
      })), te() === false && ge(o3, n2, {
        placement: "top",
        hidingDelay: 100
      }), t.checkState(b.get());
    }
    /**
     * Get shortcut name for tool
     *
     * @param toolName — Tool name
     */
    getToolShortcut(e) {
      const { Tools: t } = this.Editor, o3 = t.inlineTools.get(e), i2 = t.internal.inlineTools;
      return Array.from(i2.keys()).includes(e) ? this.inlineTools[e][Et.Shortcut] : o3.shortcut;
    }
    /**
     * Enable Tool shortcut with Editor Shortcuts Module
     *
     * @param {InlineTool} tool - Tool instance
     * @param {string} shortcut - shortcut according to the ShortcutData Module format
     */
    enableShortcuts(e, t) {
      ae.add({
        name: t,
        handler: (o3) => {
          const { currentBlock: i2 } = this.Editor.BlockManager;
          i2 && i2.tool.enabledInlineTools && (o3.preventDefault(), this.toolClicked(e));
        },
        on: this.Editor.UI.nodes.redactor
      });
    }
    /**
     * Inline Tool button clicks
     *
     * @param {InlineTool} tool - Tool's instance
     */
    toolClicked(e) {
      const t = b.range;
      e.surround(t), this.checkToolsState(), e.renderActions !== void 0 && this.flipper.deactivate();
    }
    /**
     * Check Tools` state by selection
     */
    checkToolsState() {
      this.toolsInstances.forEach((e) => {
        e.checkState(b.get());
      });
    }
    /**
     * Get inline tools tools
     * Tools that has isInline is true
     */
    get inlineTools() {
      const e = {};
      return Array.from(this.Editor.Tools.inlineTools.entries()).forEach(([t, o3]) => {
        e[t] = o3.create();
      }), e;
    }
    /**
     * Allow to leaf buttons by arrows / tab
     * Buttons will be filled on opening
     */
    enableFlipper() {
      this.flipper = new q({
        focusedItemClass: this.CSS.focusedButton,
        allowedKeys: [
          v.ENTER,
          v.TAB
        ]
      });
    }
  };
  var ei = class extends y {
    /**
     * All keydowns on Block
     *
     * @param {KeyboardEvent} event - keydown
     */
    keydown(e) {
      switch (this.beforeKeydownProcessing(e), e.keyCode) {
        case v.BACKSPACE:
          this.backspace(e);
          break;
        case v.DELETE:
          this.delete(e);
          break;
        case v.ENTER:
          this.enter(e);
          break;
        case v.DOWN:
        case v.RIGHT:
          this.arrowRightAndDown(e);
          break;
        case v.UP:
        case v.LEFT:
          this.arrowLeftAndUp(e);
          break;
        case v.TAB:
          this.tabPressed(e);
          break;
      }
      e.key === "/" && !e.ctrlKey && !e.metaKey && this.slashPressed(), e.code === "Slash" && (e.ctrlKey || e.metaKey) && (e.preventDefault(), this.commandSlashPressed());
    }
    /**
     * Fires on keydown before event processing
     *
     * @param {KeyboardEvent} event - keydown
     */
    beforeKeydownProcessing(e) {
      this.needToolbarClosing(e) && lt(e.keyCode) && (this.Editor.Toolbar.close(), this.Editor.ConversionToolbar.close(), e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || this.Editor.BlockSelection.clearSelection(e));
    }
    /**
     * Key up on Block:
     * - shows Inline Toolbar if something selected
     * - shows conversion toolbar with 85% of block selection
     *
     * @param {KeyboardEvent} event - keyup event
     */
    keyup(e) {
      e.shiftKey || this.Editor.UI.checkEmptiness();
    }
    /**
     * Add drop target styles
     *
     * @param {DragEvent} event - drag over event
     */
    dragOver(e) {
      const t = this.Editor.BlockManager.getBlockByChildNode(e.target);
      t.dropTarget = true;
    }
    /**
     * Remove drop target style
     *
     * @param {DragEvent} event - drag leave event
     */
    dragLeave(e) {
      const t = this.Editor.BlockManager.getBlockByChildNode(e.target);
      t.dropTarget = false;
    }
    /**
     * Copying selected blocks
     * Before putting to the clipboard we sanitize all blocks and then copy to the clipboard
     *
     * @param {ClipboardEvent} event - clipboard event
     */
    handleCommandC(e) {
      const { BlockSelection: t } = this.Editor;
      t.anyBlockSelected && t.copySelectedBlocks(e);
    }
    /**
     * Copy and Delete selected Blocks
     *
     * @param {ClipboardEvent} event - clipboard event
     */
    handleCommandX(e) {
      const { BlockSelection: t, BlockManager: o3, Caret: i2 } = this.Editor;
      t.anyBlockSelected && t.copySelectedBlocks(e).then(() => {
        const n2 = o3.removeSelectedBlocks(), r2 = o3.insertDefaultBlockAtIndex(n2, true);
        i2.setToBlock(r2, i2.positions.START), t.clearSelection(e);
      });
    }
    /**
     * Tab pressed inside a Block.
     *
     * @param {KeyboardEvent} event - keydown
     */
    tabPressed(e) {
      const { InlineToolbar: t, ConversionToolbar: o3, Caret: i2 } = this.Editor;
      if (o3.opened || t.opened)
        return;
      (e.shiftKey ? i2.navigatePrevious(true) : i2.navigateNext(true)) && e.preventDefault();
    }
    /**
     * '/' + 'command' keydown inside a Block
     */
    commandSlashPressed() {
      this.Editor.BlockSelection.selectedBlocks.length > 1 || this.activateBlockSettings();
    }
    /**
     * '/' keydown inside a Block
     */
    slashPressed() {
      this.Editor.BlockManager.currentBlock.isEmpty && this.activateToolbox();
    }
    /**
     * ENTER pressed on block
     *
     * @param {KeyboardEvent} event - keydown
     */
    enter(e) {
      const { BlockManager: t, UI: o3 } = this.Editor;
      if (t.currentBlock.tool.isLineBreaksEnabled || o3.someToolbarOpened && o3.someFlipperButtonFocused || e.shiftKey)
        return;
      let n2 = this.Editor.BlockManager.currentBlock;
      this.Editor.Caret.isAtStart && !this.Editor.BlockManager.currentBlock.hasMedia ? this.Editor.BlockManager.insertDefaultBlockAtIndex(this.Editor.BlockManager.currentBlockIndex) : this.Editor.Caret.isAtEnd ? n2 = this.Editor.BlockManager.insertDefaultBlockAtIndex(this.Editor.BlockManager.currentBlockIndex + 1) : n2 = this.Editor.BlockManager.split(), this.Editor.Caret.setToBlock(n2), this.Editor.Toolbar.moveAndOpen(n2), e.preventDefault();
    }
    /**
     * Handle backspace keydown on Block
     *
     * @param {KeyboardEvent} event - keydown
     */
    backspace(e) {
      const { BlockManager: t, Caret: o3 } = this.Editor, { currentBlock: i2, previousBlock: n2 } = t;
      if (!b.isCollapsed || !o3.isAtStart)
        return;
      if (e.preventDefault(), this.Editor.Toolbar.close(), !(i2.currentInput === i2.firstInput)) {
        o3.navigatePrevious();
        return;
      }
      if (n2 === null)
        return;
      if (n2.isEmpty) {
        t.removeBlock(n2);
        return;
      }
      if (i2.isEmpty) {
        t.removeBlock(i2);
        const l4 = t.currentBlock;
        o3.setToBlock(l4, o3.positions.END);
        return;
      }
      ot(i2, n2) ? this.mergeBlocks(n2, i2) : o3.setToBlock(n2, o3.positions.END);
    }
    /**
     * Handles delete keydown on Block
     * Removes char after the caret.
     * If caret is at the end of the block, merge next block with current
     *
     * @param {KeyboardEvent} event - keydown
     */
    delete(e) {
      const { BlockManager: t, Caret: o3 } = this.Editor, { currentBlock: i2, nextBlock: n2 } = t;
      if (!b.isCollapsed || !o3.isAtEnd)
        return;
      if (e.preventDefault(), this.Editor.Toolbar.close(), !(i2.currentInput === i2.lastInput)) {
        o3.navigateNext();
        return;
      }
      if (n2 === null)
        return;
      if (n2.isEmpty) {
        t.removeBlock(n2);
        return;
      }
      if (i2.isEmpty) {
        t.removeBlock(i2), o3.setToBlock(n2, o3.positions.START);
        return;
      }
      ot(i2, n2) ? this.mergeBlocks(i2, n2) : o3.setToBlock(n2, o3.positions.START);
    }
    /**
     * Merge passed Blocks
     *
     * @param targetBlock - to which Block we want to merge
     * @param blockToMerge - what Block we want to merge
     */
    mergeBlocks(e, t) {
      const { BlockManager: o3, Caret: i2, Toolbar: n2 } = this.Editor;
      i2.createShadow(e.pluginsContent), o3.mergeBlocks(e, t).then(() => {
        window.requestAnimationFrame(() => {
          i2.restoreCaret(e.pluginsContent), e.pluginsContent.normalize(), n2.close();
        });
      });
    }
    /**
     * Handle right and down keyboard keys
     *
     * @param {KeyboardEvent} event - keyboard event
     */
    arrowRightAndDown(e) {
      const t = q.usedKeys.includes(e.keyCode) && (!e.shiftKey || e.keyCode === v.TAB);
      if (this.Editor.UI.someToolbarOpened && t)
        return;
      this.Editor.Toolbar.close();
      const o3 = this.Editor.Caret.isAtEnd || this.Editor.BlockSelection.anyBlockSelected;
      if (e.shiftKey && e.keyCode === v.DOWN && o3) {
        this.Editor.CrossBlockSelection.toggleBlockSelectedState();
        return;
      }
      if (e.keyCode === v.DOWN || e.keyCode === v.RIGHT && !this.isRtl ? this.Editor.Caret.navigateNext() : this.Editor.Caret.navigatePrevious()) {
        e.preventDefault();
        return;
      }
      xe(() => {
        this.Editor.BlockManager.currentBlock && this.Editor.BlockManager.currentBlock.updateCurrentInput();
      }, 20)(), this.Editor.BlockSelection.clearSelection(e);
    }
    /**
     * Handle left and up keyboard keys
     *
     * @param {KeyboardEvent} event - keyboard event
     */
    arrowLeftAndUp(e) {
      if (this.Editor.UI.someToolbarOpened) {
        if (q.usedKeys.includes(e.keyCode) && (!e.shiftKey || e.keyCode === v.TAB))
          return;
        this.Editor.UI.closeAllToolbars();
      }
      this.Editor.Toolbar.close();
      const t = this.Editor.Caret.isAtStart || this.Editor.BlockSelection.anyBlockSelected;
      if (e.shiftKey && e.keyCode === v.UP && t) {
        this.Editor.CrossBlockSelection.toggleBlockSelectedState(false);
        return;
      }
      if (e.keyCode === v.UP || e.keyCode === v.LEFT && !this.isRtl ? this.Editor.Caret.navigatePrevious() : this.Editor.Caret.navigateNext()) {
        e.preventDefault();
        return;
      }
      xe(() => {
        this.Editor.BlockManager.currentBlock && this.Editor.BlockManager.currentBlock.updateCurrentInput();
      }, 20)(), this.Editor.BlockSelection.clearSelection(e);
    }
    /**
     * Cases when we need to close Toolbar
     *
     * @param {KeyboardEvent} event - keyboard event
     */
    needToolbarClosing(e) {
      const t = e.keyCode === v.ENTER && this.Editor.Toolbar.toolbox.opened, o3 = e.keyCode === v.ENTER && this.Editor.BlockSettings.opened, i2 = e.keyCode === v.ENTER && this.Editor.InlineToolbar.opened, n2 = e.keyCode === v.ENTER && this.Editor.ConversionToolbar.opened, r2 = e.keyCode === v.TAB;
      return !(e.shiftKey || r2 || t || o3 || i2 || n2);
    }
    /**
     * If Toolbox is not open, then just open it and show plus button
     */
    activateToolbox() {
      this.Editor.Toolbar.opened || this.Editor.Toolbar.moveAndOpen(), this.Editor.Toolbar.toolbox.open();
    }
    /**
     * Open Toolbar and show BlockSettings before flipping Tools
     */
    activateBlockSettings() {
      this.Editor.Toolbar.opened || this.Editor.Toolbar.moveAndOpen(), this.Editor.BlockSettings.opened || this.Editor.BlockSettings.open();
    }
  };
  var Se = class {
    /**
     * @class
     * @param {HTMLElement} workingArea — editor`s working node
     */
    constructor(e) {
      this.blocks = [], this.workingArea = e;
    }
    /**
     * Get length of Block instances array
     *
     * @returns {number}
     */
    get length() {
      return this.blocks.length;
    }
    /**
     * Get Block instances array
     *
     * @returns {Block[]}
     */
    get array() {
      return this.blocks;
    }
    /**
     * Get blocks html elements array
     *
     * @returns {HTMLElement[]}
     */
    get nodes() {
      return ct(this.workingArea.children);
    }
    /**
     * Proxy trap to implement array-like setter
     *
     * @example
     * blocks[0] = new Block(...)
     * @param {Blocks} instance — Blocks instance
     * @param {PropertyKey} property — block index or any Blocks class property key to set
     * @param {Block} value — value to set
     * @returns {boolean}
     */
    static set(e, t, o3) {
      return isNaN(Number(t)) ? (Reflect.set(e, t, o3), true) : (e.insert(+t, o3), true);
    }
    /**
     * Proxy trap to implement array-like getter
     *
     * @param {Blocks} instance — Blocks instance
     * @param {PropertyKey} property — Blocks class property key
     * @returns {Block|*}
     */
    static get(e, t) {
      return isNaN(Number(t)) ? Reflect.get(e, t) : e.get(+t);
    }
    /**
     * Push new Block to the blocks array and append it to working area
     *
     * @param {Block} block - Block to add
     */
    push(e) {
      this.blocks.push(e), this.insertToDOM(e);
    }
    /**
     * Swaps blocks with indexes first and second
     *
     * @param {number} first - first block index
     * @param {number} second - second block index
     * @deprecated — use 'move' instead
     */
    swap(e, t) {
      const o3 = this.blocks[t];
      c.swap(this.blocks[e].holder, o3.holder), this.blocks[t] = this.blocks[e], this.blocks[e] = o3;
    }
    /**
     * Move a block from one to another index
     *
     * @param {number} toIndex - new index of the block
     * @param {number} fromIndex - block to move
     */
    move(e, t) {
      const o3 = this.blocks.splice(t, 1)[0], i2 = e - 1, n2 = Math.max(0, i2), r2 = this.blocks[n2];
      e > 0 ? this.insertToDOM(o3, "afterend", r2) : this.insertToDOM(o3, "beforebegin", r2), this.blocks.splice(e, 0, o3);
      const a4 = this.composeBlockEvent("move", {
        fromIndex: t,
        toIndex: e
      });
      o3.call(X.MOVED, a4);
    }
    /**
     * Insert new Block at passed index
     *
     * @param {number} index — index to insert Block
     * @param {Block} block — Block to insert
     * @param {boolean} replace — it true, replace block on given index
     */
    insert(e, t, o3 = false) {
      if (!this.length) {
        this.push(t);
        return;
      }
      e > this.length && (e = this.length), o3 && (this.blocks[e].holder.remove(), this.blocks[e].call(X.REMOVED));
      const i2 = o3 ? 1 : 0;
      if (this.blocks.splice(e, i2, t), e > 0) {
        const n2 = this.blocks[e - 1];
        this.insertToDOM(t, "afterend", n2);
      } else {
        const n2 = this.blocks[e + 1];
        n2 ? this.insertToDOM(t, "beforebegin", n2) : this.insertToDOM(t);
      }
    }
    /**
     * Replaces block under passed index with passed block
     *
     * @param index - index of existed block
     * @param block - new block
     */
    replace(e, t) {
      if (this.blocks[e] === void 0)
        throw Error("Incorrect index");
      this.blocks[e].holder.replaceWith(t.holder), this.blocks[e] = t;
    }
    /**
     * Inserts several blocks at once
     *
     * @param blocks - blocks to insert
     * @param index - index to insert blocks at
     */
    insertMany(e, t) {
      const o3 = new DocumentFragment();
      for (const i2 of e)
        o3.appendChild(i2.holder);
      if (this.length > 0) {
        if (t > 0) {
          const i2 = Math.min(t - 1, this.length - 1);
          this.blocks[i2].holder.after(o3);
        } else
          t === 0 && this.workingArea.prepend(o3);
        this.blocks.splice(t, 0, ...e);
      } else
        this.blocks.push(...e), this.workingArea.appendChild(o3);
      e.forEach((i2) => i2.call(X.RENDERED));
    }
    /**
     * Remove block
     *
     * @param {number} index - index of Block to remove
     */
    remove(e) {
      isNaN(e) && (e = this.length - 1), this.blocks[e].holder.remove(), this.blocks[e].call(X.REMOVED), this.blocks.splice(e, 1);
    }
    /**
     * Remove all blocks
     */
    removeAll() {
      this.workingArea.innerHTML = "", this.blocks.forEach((e) => e.call(X.REMOVED)), this.blocks.length = 0;
    }
    /**
     * Insert Block after passed target
     *
     * @todo decide if this method is necessary
     * @param {Block} targetBlock — target after which Block should be inserted
     * @param {Block} newBlock — Block to insert
     */
    insertAfter(e, t) {
      const o3 = this.blocks.indexOf(e);
      this.insert(o3 + 1, t);
    }
    /**
     * Get Block by index
     *
     * @param {number} index — Block index
     * @returns {Block}
     */
    get(e) {
      return this.blocks[e];
    }
    /**
     * Return index of passed Block
     *
     * @param {Block} block - Block to find
     * @returns {number}
     */
    indexOf(e) {
      return this.blocks.indexOf(e);
    }
    /**
     * Insert new Block into DOM
     *
     * @param {Block} block - Block to insert
     * @param {InsertPosition} position — insert position (if set, will use insertAdjacentElement)
     * @param {Block} target — Block related to position
     */
    insertToDOM(e, t, o3) {
      t ? o3.holder.insertAdjacentElement(t, e.holder) : this.workingArea.appendChild(e.holder), e.call(X.RENDERED);
    }
    /**
     * Composes Block event with passed type and details
     *
     * @param {string} type - event type
     * @param {object} detail - event detail
     */
    composeBlockEvent(e, t) {
      return new CustomEvent(e, {
        detail: t
      });
    }
  };
  var nt = "block-removed";
  var st = "block-added";
  var ti = "block-moved";
  var rt = "block-changed";
  var oi = class {
    constructor() {
      this.completed = Promise.resolve();
    }
    /**
     * Add new promise to queue
     *
     * @param operation - promise should be added to queue
     */
    add(e) {
      return new Promise((t, o3) => {
        this.completed = this.completed.then(e).then(t).catch(o3);
      });
    }
  };
  var ii = class extends y {
    constructor() {
      super(...arguments), this._currentBlockIndex = -1, this._blocks = null;
    }
    /**
     * Returns current Block index
     *
     * @returns {number}
     */
    get currentBlockIndex() {
      return this._currentBlockIndex;
    }
    /**
     * Set current Block index and fire Block lifecycle callbacks
     *
     * @param {number} newIndex - index of Block to set as current
     */
    set currentBlockIndex(e) {
      this._currentBlockIndex = e;
    }
    /**
     * returns first Block
     *
     * @returns {Block}
     */
    get firstBlock() {
      return this._blocks[0];
    }
    /**
     * returns last Block
     *
     * @returns {Block}
     */
    get lastBlock() {
      return this._blocks[this._blocks.length - 1];
    }
    /**
     * Get current Block instance
     *
     * @returns {Block}
     */
    get currentBlock() {
      return this._blocks[this.currentBlockIndex];
    }
    /**
     * Set passed Block as a current
     *
     * @param block - block to set as a current
     */
    set currentBlock(e) {
      this.currentBlockIndex = this.getBlockIndex(e);
    }
    /**
     * Returns next Block instance
     *
     * @returns {Block|null}
     */
    get nextBlock() {
      return this.currentBlockIndex === this._blocks.length - 1 ? null : this._blocks[this.currentBlockIndex + 1];
    }
    /**
     * Return first Block with inputs after current Block
     *
     * @returns {Block | undefined}
     */
    get nextContentfulBlock() {
      return this.blocks.slice(this.currentBlockIndex + 1).find((t) => !!t.inputs.length);
    }
    /**
     * Return first Block with inputs before current Block
     *
     * @returns {Block | undefined}
     */
    get previousContentfulBlock() {
      return this.blocks.slice(0, this.currentBlockIndex).reverse().find((t) => !!t.inputs.length);
    }
    /**
     * Returns previous Block instance
     *
     * @returns {Block|null}
     */
    get previousBlock() {
      return this.currentBlockIndex === 0 ? null : this._blocks[this.currentBlockIndex - 1];
    }
    /**
     * Get array of Block instances
     *
     * @returns {Block[]} {@link Blocks#array}
     */
    get blocks() {
      return this._blocks.array;
    }
    /**
     * Check if each Block is empty
     *
     * @returns {boolean}
     */
    get isEditorEmpty() {
      return this.blocks.every((e) => e.isEmpty);
    }
    /**
     * Should be called after Editor.UI preparation
     * Define this._blocks property
     */
    prepare() {
      const e = new Se(this.Editor.UI.nodes.redactor);
      this._blocks = new Proxy(e, {
        set: Se.set,
        get: Se.get
      }), this.listeners.on(
        document,
        "copy",
        (t) => this.Editor.BlockEvents.handleCommandC(t)
      );
    }
    /**
     * Toggle read-only state
     *
     * If readOnly is true:
     *  - Unbind event handlers from created Blocks
     *
     * if readOnly is false:
     *  - Bind event handlers to all existing Blocks
     *
     * @param {boolean} readOnlyEnabled - "read only" state
     */
    toggleReadOnly(e) {
      e ? this.disableModuleBindings() : this.enableModuleBindings();
    }
    /**
     * Creates Block instance by tool name
     *
     * @param {object} options - block creation options
     * @param {string} options.tool - tools passed in editor config {@link EditorConfig#tools}
     * @param {string} [options.id] - unique id for this block
     * @param {BlockToolData} [options.data] - constructor params
     * @returns {Block}
     */
    composeBlock({
      tool: e,
      data: t = {},
      id: o3 = void 0,
      tunes: i2 = {}
    }) {
      const n2 = this.Editor.ReadOnly.isEnabled, r2 = this.Editor.Tools.blockTools.get(e), a4 = new R({
        id: o3,
        data: t,
        tool: r2,
        api: this.Editor.API,
        readOnly: n2,
        tunesData: i2
      }, this.eventsDispatcher);
      return n2 || window.requestIdleCallback(() => {
        this.bindBlockEvents(a4);
      }, { timeout: 2e3 }), a4;
    }
    /**
     * Insert new block into _blocks
     *
     * @param {object} options - insert options
     * @param {string} [options.id] - block's unique id
     * @param {string} [options.tool] - plugin name, by default method inserts the default block type
     * @param {object} [options.data] - plugin data
     * @param {number} [options.index] - index where to insert new Block
     * @param {boolean} [options.needToFocus] - flag shows if needed to update current Block index
     * @param {boolean} [options.replace] - flag shows if block by passed index should be replaced with inserted one
     * @returns {Block}
     */
    insert({
      id: e = void 0,
      tool: t = this.config.defaultBlock,
      data: o3 = {},
      index: i2,
      needToFocus: n2 = true,
      replace: r2 = false,
      tunes: a4 = {}
    } = {}) {
      let l4 = i2;
      l4 === void 0 && (l4 = this.currentBlockIndex + (r2 ? 0 : 1));
      const d4 = this.composeBlock({
        id: e,
        tool: t,
        data: o3,
        tunes: a4
      });
      return r2 && this.blockDidMutated(nt, this.getBlockByIndex(l4), {
        index: l4
      }), this._blocks.insert(l4, d4, r2), this.blockDidMutated(st, d4, {
        index: l4
      }), n2 ? this.currentBlockIndex = l4 : l4 <= this.currentBlockIndex && this.currentBlockIndex++, d4;
    }
    /**
     * Inserts several blocks at once
     *
     * @param blocks - blocks to insert
     * @param index - index where to insert
     */
    insertMany(e, t = 0) {
      this._blocks.insertMany(e, t);
    }
    /**
     * Update Block data.
     *
     * Currently we don't have an 'update' method in the Tools API, so we just create a new block with the same id and type
     * Should not trigger 'block-removed' or 'block-added' events
     *
     * @param block - block to update
     * @param data - new data
     */
    async update(e, t) {
      const o3 = await e.data, i2 = this.composeBlock({
        id: e.id,
        tool: e.name,
        data: Object.assign({}, o3, t),
        tunes: e.tunes
      }), n2 = this.getBlockIndex(e);
      return this._blocks.replace(n2, i2), this.blockDidMutated(rt, i2, {
        index: n2
      }), i2;
    }
    /**
     * Replace passed Block with the new one with specified Tool and data
     *
     * @param block - block to replace
     * @param newTool - new Tool name
     * @param data - new Tool data
     */
    replace(e, t, o3) {
      const i2 = this.getBlockIndex(e);
      this.insert({
        tool: t,
        data: o3,
        index: i2,
        replace: true
      });
    }
    /**
     * Insert pasted content. Call onPaste callback after insert.
     *
     * @param {string} toolName - name of Tool to insert
     * @param {PasteEvent} pasteEvent - pasted data
     * @param {boolean} replace - should replace current block
     */
    paste(e, t, o3 = false) {
      const i2 = this.insert({
        tool: e,
        replace: o3
      });
      try {
        window.requestIdleCallback(() => {
          i2.call(X.ON_PASTE, t);
        });
      } catch (n2) {
        T(`${e}: onPaste callback call is failed`, "error", n2);
      }
      return i2;
    }
    /**
     * Insert new default block at passed index
     *
     * @param {number} index - index where Block should be inserted
     * @param {boolean} needToFocus - if true, updates current Block index
     *
     * TODO: Remove method and use insert() with index instead (?)
     * @returns {Block} inserted Block
     */
    insertDefaultBlockAtIndex(e, t = false) {
      const o3 = this.composeBlock({ tool: this.config.defaultBlock });
      return this._blocks[e] = o3, this.blockDidMutated(st, o3, {
        index: e
      }), t ? this.currentBlockIndex = e : e <= this.currentBlockIndex && this.currentBlockIndex++, o3;
    }
    /**
     * Always inserts at the end
     *
     * @returns {Block}
     */
    insertAtEnd() {
      return this.currentBlockIndex = this.blocks.length - 1, this.insert();
    }
    /**
     * Merge two blocks
     *
     * @param {Block} targetBlock - previous block will be append to this block
     * @param {Block} blockToMerge - block that will be merged with target block
     * @returns {Promise} - the sequence that can be continued
     */
    async mergeBlocks(e, t) {
      const o3 = await t.data;
      W(o3) || await e.mergeWith(o3), this.removeBlock(t), this.currentBlockIndex = this._blocks.indexOf(e);
    }
    /**
     * Remove passed Block
     *
     * @param block - Block to remove
     * @param addLastBlock - if true, adds new default block at the end. @todo remove this logic and use event-bus instead
     */
    removeBlock(e, t = true) {
      return new Promise((o3) => {
        const i2 = this._blocks.indexOf(e);
        if (!this.validateIndex(i2))
          throw new Error("Can't find a Block to remove");
        e.destroy(), this._blocks.remove(i2), this.blockDidMutated(nt, e, {
          index: i2
        }), this.currentBlockIndex >= i2 && this.currentBlockIndex--, this.blocks.length ? i2 === 0 && (this.currentBlockIndex = 0) : (this.currentBlockIndex = -1, t && this.insert()), o3();
      });
    }
    /**
     * Remove only selected Blocks
     * and returns first Block index where started removing...
     *
     * @returns {number|undefined}
     */
    removeSelectedBlocks() {
      let e;
      for (let t = this.blocks.length - 1; t >= 0; t--)
        this.blocks[t].selected && (this.removeBlock(this.blocks[t]), e = t);
      return e;
    }
    /**
     * Attention!
     * After removing insert the new default typed Block and focus on it
     * Removes all blocks
     */
    removeAllBlocks() {
      for (let e = this.blocks.length - 1; e >= 0; e--)
        this._blocks.remove(e);
      this.currentBlockIndex = -1, this.insert(), this.currentBlock.firstInput.focus();
    }
    /**
     * Split current Block
     * 1. Extract content from Caret position to the Block`s end
     * 2. Insert a new Block below current one with extracted content
     *
     * @returns {Block}
     */
    split() {
      const e = this.Editor.Caret.extractFragmentFromCaretPosition(), t = c.make("div");
      t.appendChild(e);
      const o3 = {
        text: c.isEmpty(t) ? "" : t.innerHTML
      };
      return this.insert({ data: o3 });
    }
    /**
     * Returns Block by passed index
     *
     * @param {number} index - index to get. -1 to get last
     * @returns {Block}
     */
    getBlockByIndex(e) {
      return e === -1 && (e = this._blocks.length - 1), this._blocks[e];
    }
    /**
     * Returns an index for passed Block
     *
     * @param block - block to find index
     */
    getBlockIndex(e) {
      return this._blocks.indexOf(e);
    }
    /**
     * Returns the Block by passed id
     *
     * @param id - id of block to get
     * @returns {Block}
     */
    getBlockById(e) {
      return this._blocks.array.find((t) => t.id === e);
    }
    /**
     * Get Block instance by html element
     *
     * @param {Node} element - html element to get Block by
     */
    getBlock(e) {
      c.isElement(e) || (e = e.parentNode);
      const t = this._blocks.nodes, o3 = e.closest(`.${R.CSS.wrapper}`), i2 = t.indexOf(o3);
      if (i2 >= 0)
        return this._blocks[i2];
    }
    /**
     * 1) Find first-level Block from passed child Node
     * 2) Mark it as current
     *
     * @param {Node} childNode - look ahead from this node.
     * @returns {Block | undefined} can return undefined in case when the passed child note is not a part of the current editor instance
     */
    setCurrentBlockByChildNode(e) {
      c.isElement(e) || (e = e.parentNode);
      const t = e.closest(`.${R.CSS.wrapper}`);
      if (!t)
        return;
      const o3 = t.closest(`.${this.Editor.UI.CSS.editorWrapper}`);
      if (o3 != null && o3.isEqualNode(this.Editor.UI.nodes.wrapper))
        return this.currentBlockIndex = this._blocks.nodes.indexOf(t), this.currentBlock.updateCurrentInput(), this.currentBlock;
    }
    /**
     * Return block which contents passed node
     *
     * @param {Node} childNode - node to get Block by
     * @returns {Block}
     */
    getBlockByChildNode(e) {
      if (!e || !(e instanceof Node))
        return;
      c.isElement(e) || (e = e.parentNode);
      const t = e.closest(`.${R.CSS.wrapper}`);
      return this.blocks.find((o3) => o3.holder === t);
    }
    /**
     * Swap Blocks Position
     *
     * @param {number} fromIndex - index of first block
     * @param {number} toIndex - index of second block
     * @deprecated — use 'move' instead
     */
    swap(e, t) {
      this._blocks.swap(e, t), this.currentBlockIndex = t;
    }
    /**
     * Move a block to a new index
     *
     * @param {number} toIndex - index where to move Block
     * @param {number} fromIndex - index of Block to move
     */
    move(e, t = this.currentBlockIndex) {
      if (isNaN(e) || isNaN(t)) {
        T("Warning during 'move' call: incorrect indices provided.", "warn");
        return;
      }
      if (!this.validateIndex(e) || !this.validateIndex(t)) {
        T("Warning during 'move' call: indices cannot be lower than 0 or greater than the amount of blocks.", "warn");
        return;
      }
      this._blocks.move(e, t), this.currentBlockIndex = e, this.blockDidMutated(ti, this.currentBlock, {
        fromIndex: t,
        toIndex: e
      });
    }
    /**
     * Converts passed Block to the new Tool
     * Uses Conversion Config
     *
     * @param blockToConvert - Block that should be converted
     * @param targetToolName - name of the Tool to convert to
     * @param blockDataOverrides - optional new Block data overrides
     */
    async convert(e, t, o3) {
      if (!await e.save())
        throw new Error("Could not convert Block. Failed to extract original Block data.");
      const n2 = this.Editor.Tools.blockTools.get(t);
      if (!n2)
        throw new Error(`Could not convert Block. Tool \xAB${t}\xBB not found.`);
      const r2 = await e.exportDataAsString(), a4 = V(
        r2,
        n2.sanitizeConfig
      );
      let l4 = to(a4, n2.conversionConfig);
      o3 && (l4 = Object.assign(l4, o3)), this.replace(e, n2.name, l4);
    }
    /**
     * Sets current Block Index -1 which means unknown
     * and clear highlights
     */
    dropPointer() {
      this.currentBlockIndex = -1;
    }
    /**
     * Clears Editor
     *
     * @param {boolean} needToAddDefaultBlock - 1) in internal calls (for example, in api.blocks.render)
     *                                             we don't need to add an empty default block
     *                                        2) in api.blocks.clear we should add empty block
     */
    async clear(e = false) {
      const t = new oi();
      this.blocks.forEach((o3) => {
        t.add(async () => {
          await this.removeBlock(o3, false);
        });
      }), await t.completed, this.dropPointer(), e && this.insert(), this.Editor.UI.checkEmptiness();
    }
    /**
     * Cleans up all the block tools' resources
     * This is called when editor is destroyed
     */
    async destroy() {
      await Promise.all(this.blocks.map((e) => e.destroy()));
    }
    /**
     * Bind Block events
     *
     * @param {Block} block - Block to which event should be bound
     */
    bindBlockEvents(e) {
      const { BlockEvents: t } = this.Editor;
      this.readOnlyMutableListeners.on(e.holder, "keydown", (o3) => {
        t.keydown(o3);
      }), this.readOnlyMutableListeners.on(e.holder, "keyup", (o3) => {
        t.keyup(o3);
      }), this.readOnlyMutableListeners.on(e.holder, "dragover", (o3) => {
        t.dragOver(o3);
      }), this.readOnlyMutableListeners.on(e.holder, "dragleave", (o3) => {
        t.dragLeave(o3);
      }), e.on("didMutated", (o3) => this.blockDidMutated(rt, o3, {
        index: this.getBlockIndex(o3)
      }));
    }
    /**
     * Disable mutable handlers and bindings
     */
    disableModuleBindings() {
      this.readOnlyMutableListeners.clearAll();
    }
    /**
     * Enables all module handlers and bindings for all Blocks
     */
    enableModuleBindings() {
      this.readOnlyMutableListeners.on(
        document,
        "cut",
        (e) => this.Editor.BlockEvents.handleCommandX(e)
      ), this.blocks.forEach((e) => {
        this.bindBlockEvents(e);
      });
    }
    /**
     * Validates that the given index is not lower than 0 or higher than the amount of blocks
     *
     * @param {number} index - index of blocks array to validate
     * @returns {boolean}
     */
    validateIndex(e) {
      return !(e < 0 || e >= this._blocks.length);
    }
    /**
     * Block mutation callback
     *
     * @param mutationType - what happened with block
     * @param block - mutated block
     * @param detailData - additional data to pass with change event
     */
    blockDidMutated(e, t, o3) {
      const i2 = new CustomEvent(e, {
        detail: {
          target: new ee(t),
          ...o3
        }
      });
      return this.eventsDispatcher.emit(pt, {
        event: i2
      }), t;
    }
  };
  var ni = class extends y {
    constructor() {
      super(...arguments), this.anyBlockSelectedCache = null, this.needToSelectAll = false, this.nativeInputSelected = false, this.readyToBlockSelection = false;
    }
    /**
     * Sanitizer Config
     *
     * @returns {SanitizerConfig}
     */
    get sanitizerConfig() {
      return {
        p: {},
        h1: {},
        h2: {},
        h3: {},
        h4: {},
        h5: {},
        h6: {},
        ol: {},
        ul: {},
        li: {},
        br: true,
        img: {
          src: true,
          width: true,
          height: true
        },
        a: {
          href: true
        },
        b: {},
        i: {},
        u: {}
      };
    }
    /**
     * Flag that identifies all Blocks selection
     *
     * @returns {boolean}
     */
    get allBlocksSelected() {
      const { BlockManager: e } = this.Editor;
      return e.blocks.every((t) => t.selected === true);
    }
    /**
     * Set selected all blocks
     *
     * @param {boolean} state - state to set
     */
    set allBlocksSelected(e) {
      const { BlockManager: t } = this.Editor;
      t.blocks.forEach((o3) => {
        o3.selected = e;
      }), this.clearCache();
    }
    /**
     * Flag that identifies any Block selection
     *
     * @returns {boolean}
     */
    get anyBlockSelected() {
      const { BlockManager: e } = this.Editor;
      return this.anyBlockSelectedCache === null && (this.anyBlockSelectedCache = e.blocks.some((t) => t.selected === true)), this.anyBlockSelectedCache;
    }
    /**
     * Return selected Blocks array
     *
     * @returns {Block[]}
     */
    get selectedBlocks() {
      return this.Editor.BlockManager.blocks.filter((e) => e.selected);
    }
    /**
     * Module Preparation
     * Registers Shortcuts CMD+A and CMD+C
     * to select all and copy them
     */
    prepare() {
      this.selection = new b(), ae.add({
        name: "CMD+A",
        handler: (e) => {
          const { BlockManager: t, ReadOnly: o3 } = this.Editor;
          if (o3.isEnabled) {
            e.preventDefault(), this.selectAllBlocks();
            return;
          }
          t.currentBlock && this.handleCommandA(e);
        },
        on: this.Editor.UI.nodes.redactor
      });
    }
    /**
     * Toggle read-only state
     *
     *  - Remove all ranges
     *  - Unselect all Blocks
     */
    toggleReadOnly() {
      b.get().removeAllRanges(), this.allBlocksSelected = false;
    }
    /**
     * Remove selection of Block
     *
     * @param {number?} index - Block index according to the BlockManager's indexes
     */
    unSelectBlockByIndex(e) {
      const { BlockManager: t } = this.Editor;
      let o3;
      isNaN(e) ? o3 = t.currentBlock : o3 = t.getBlockByIndex(e), o3.selected = false, this.clearCache();
    }
    /**
     * Clear selection from Blocks
     *
     * @param {Event} reason - event caused clear of selection
     * @param {boolean} restoreSelection - if true, restore saved selection
     */
    clearSelection(e, t = false) {
      const { BlockManager: o3, Caret: i2, RectangleSelection: n2 } = this.Editor;
      this.needToSelectAll = false, this.nativeInputSelected = false, this.readyToBlockSelection = false;
      const r2 = e && e instanceof KeyboardEvent, a4 = r2 && lt(e.keyCode);
      if (this.anyBlockSelected && r2 && a4 && !b.isSelectionExists) {
        const l4 = o3.removeSelectedBlocks();
        o3.insertDefaultBlockAtIndex(l4, true), i2.setToBlock(o3.currentBlock), xe(() => {
          const d4 = e.key;
          i2.insertContentAtCaretPosition(d4.length > 1 ? "" : d4);
        }, 20)();
      }
      if (this.Editor.CrossBlockSelection.clear(e), !this.anyBlockSelected || n2.isRectActivated()) {
        this.Editor.RectangleSelection.clearSelection();
        return;
      }
      t && this.selection.restore(), this.allBlocksSelected = false;
    }
    /**
     * Reduce each Block and copy its content
     *
     * @param {ClipboardEvent} e - copy/cut event
     * @returns {Promise<void>}
     */
    copySelectedBlocks(e) {
      e.preventDefault();
      const t = c.make("div");
      this.selectedBlocks.forEach((n2) => {
        const r2 = V(n2.holder.innerHTML, this.sanitizerConfig), a4 = c.make("p");
        a4.innerHTML = r2, t.appendChild(a4);
      });
      const o3 = Array.from(t.childNodes).map((n2) => n2.textContent).join(`

`), i2 = t.innerHTML;
      return e.clipboardData.setData("text/plain", o3), e.clipboardData.setData("text/html", i2), Promise.all(this.selectedBlocks.map((n2) => n2.save())).then((n2) => {
        try {
          e.clipboardData.setData(this.Editor.Paste.MIME_TYPE, JSON.stringify(n2));
        } catch {
        }
      });
    }
    /**
     * Select Block by its index
     *
     * @param {number?} index - Block index according to the BlockManager's indexes
     */
    selectBlockByIndex(e) {
      const { BlockManager: t } = this.Editor, o3 = t.getBlockByIndex(e);
      o3 !== void 0 && this.selectBlock(o3);
    }
    /**
     * Select passed Block
     *
     * @param {Block} block - Block to select
     */
    selectBlock(e) {
      this.selection.save(), b.get().removeAllRanges(), e.selected = true, this.clearCache(), this.Editor.InlineToolbar.close();
    }
    /**
     * Remove selection from passed Block
     *
     * @param {Block} block - Block to unselect
     */
    unselectBlock(e) {
      e.selected = false, this.clearCache();
    }
    /**
     * Clear anyBlockSelected cache
     */
    clearCache() {
      this.anyBlockSelectedCache = null;
    }
    /**
     * Module destruction
     * De-registers Shortcut CMD+A
     */
    destroy() {
      ae.remove(this.Editor.UI.nodes.redactor, "CMD+A");
    }
    /**
     * First CMD+A selects all input content by native behaviour,
     * next CMD+A keypress selects all blocks
     *
     * @param {KeyboardEvent} event - keyboard event
     */
    handleCommandA(e) {
      if (this.Editor.RectangleSelection.clearSelection(), c.isNativeInput(e.target) && !this.readyToBlockSelection) {
        this.readyToBlockSelection = true;
        return;
      }
      const t = this.Editor.BlockManager.getBlock(e.target), o3 = t.inputs;
      if (o3.length > 1 && !this.readyToBlockSelection) {
        this.readyToBlockSelection = true;
        return;
      }
      if (o3.length === 1 && !this.needToSelectAll) {
        this.needToSelectAll = true;
        return;
      }
      this.needToSelectAll ? (e.preventDefault(), this.selectAllBlocks(), this.needToSelectAll = false, this.readyToBlockSelection = false, this.Editor.ConversionToolbar.close()) : this.readyToBlockSelection && (e.preventDefault(), this.selectBlock(t), this.needToSelectAll = true);
    }
    /**
     * Select All Blocks
     * Each Block has selected setter that makes Block copyable
     */
    selectAllBlocks() {
      this.selection.save(), b.get().removeAllRanges(), this.allBlocksSelected = true, this.Editor.InlineToolbar.close();
    }
  };
  var we = class _we extends y {
    /**
     * Allowed caret positions in input
     *
     * @static
     * @returns {{START: string, END: string, DEFAULT: string}}
     */
    get positions() {
      return {
        START: "start",
        END: "end",
        DEFAULT: "default"
      };
    }
    /**
     * Elements styles that can be useful for Caret Module
     */
    static get CSS() {
      return {
        shadowCaret: "cdx-shadow-caret"
      };
    }
    /**
     * Get's deepest first node and checks if offset is zero
     *
     * @returns {boolean}
     */
    get isAtStart() {
      const { currentBlock: e } = this.Editor.BlockManager;
      if (!e.focusable)
        return true;
      const t = b.get(), o3 = c.getDeepestNode(e.currentInput);
      let i2 = t.focusNode;
      if (c.isNativeInput(o3))
        return o3.selectionEnd === 0;
      if (!t.anchorNode)
        return false;
      let n2 = i2.textContent.search(/\S/);
      n2 === -1 && (n2 = 0);
      let r2 = t.focusOffset;
      return i2.nodeType !== Node.TEXT_NODE && i2.childNodes.length && (i2.childNodes[r2] ? (i2 = i2.childNodes[r2], r2 = 0) : (i2 = i2.childNodes[r2 - 1], r2 = i2.textContent.length)), (c.isLineBreakTag(o3) || c.isEmpty(o3)) && this.getHigherLevelSiblings(i2, "left").every((d4) => {
        const u2 = c.isLineBreakTag(d4), h3 = d4.children.length === 1 && c.isLineBreakTag(d4.children[0]), f = u2 || h3;
        return c.isEmpty(d4) && !f;
      }) && r2 === n2 ? true : o3 === null || i2 === o3 && r2 <= n2;
    }
    /**
     * Get's deepest last node and checks if offset is last node text length
     *
     * @returns {boolean}
     */
    get isAtEnd() {
      const { currentBlock: e } = this.Editor.BlockManager;
      if (!e.focusable)
        return true;
      const t = b.get();
      let o3 = t.focusNode;
      const i2 = c.getDeepestNode(e.currentInput, true);
      if (c.isNativeInput(i2))
        return i2.selectionEnd === i2.value.length;
      if (!t.focusNode)
        return false;
      let n2 = t.focusOffset;
      if (o3.nodeType !== Node.TEXT_NODE && o3.childNodes.length && (o3.childNodes[n2 - 1] ? (o3 = o3.childNodes[n2 - 1], n2 = o3.textContent.length) : (o3 = o3.childNodes[0], n2 = 0)), c.isLineBreakTag(i2) || c.isEmpty(i2)) {
        const a4 = this.getHigherLevelSiblings(o3, "right");
        if (a4.every((d4, u2) => u2 === a4.length - 1 && c.isLineBreakTag(d4) || c.isEmpty(d4) && !c.isLineBreakTag(d4)) && n2 === o3.textContent.length)
          return true;
      }
      const r2 = i2.textContent.replace(/\s+$/, "");
      return o3 === i2 && n2 >= r2.length;
    }
    /**
     * Method gets Block instance and puts caret to the text node with offset
     * There two ways that method applies caret position:
     *   - first found text node: sets at the beginning, but you can pass an offset
     *   - last found text node: sets at the end of the node. Also, you can customize the behaviour
     *
     * @param {Block} block - Block class
     * @param {string} position - position where to set caret.
     *                            If default - leave default behaviour and apply offset if it's passed
     * @param {number} offset - caret offset regarding to the text node
     */
    setToBlock(e, t = this.positions.DEFAULT, o3 = 0) {
      var d4;
      const { BlockManager: i2, BlockSelection: n2 } = this.Editor;
      if (n2.clearSelection(), !e.focusable) {
        (d4 = window.getSelection()) == null || d4.removeAllRanges(), n2.selectBlock(e), i2.currentBlock = e;
        return;
      }
      let r2;
      switch (t) {
        case this.positions.START:
          r2 = e.firstInput;
          break;
        case this.positions.END:
          r2 = e.lastInput;
          break;
        default:
          r2 = e.currentInput;
      }
      if (!r2)
        return;
      const a4 = c.getDeepestNode(r2, t === this.positions.END), l4 = c.getContentLength(a4);
      switch (true) {
        case t === this.positions.START:
          o3 = 0;
          break;
        case t === this.positions.END:
        case o3 > l4:
          o3 = l4;
          break;
      }
      this.set(a4, o3), i2.setCurrentBlockByChildNode(e.holder), i2.currentBlock.currentInput = r2;
    }
    /**
     * Set caret to the current input of current Block.
     *
     * @param {HTMLElement} input - input where caret should be set
     * @param {string} position - position of the caret.
     *                            If default - leave default behaviour and apply offset if it's passed
     * @param {number} offset - caret offset regarding to the text node
     */
    setToInput(e, t = this.positions.DEFAULT, o3 = 0) {
      const { currentBlock: i2 } = this.Editor.BlockManager, n2 = c.getDeepestNode(e);
      switch (t) {
        case this.positions.START:
          this.set(n2, 0);
          break;
        case this.positions.END:
          this.set(n2, c.getContentLength(n2));
          break;
        default:
          o3 && this.set(n2, o3);
      }
      i2.currentInput = e;
    }
    /**
     * Creates Document Range and sets caret to the element with offset
     *
     * @param {HTMLElement} element - target node.
     * @param {number} offset - offset
     */
    set(e, t = 0) {
      const { top: i2, bottom: n2 } = b.setCursor(e, t), { innerHeight: r2 } = window;
      i2 < 0 ? window.scrollBy(0, i2 - 30) : n2 > r2 && window.scrollBy(0, n2 - r2 + 30);
    }
    /**
     * Set Caret to the last Block
     * If last block is not empty, append another empty block
     */
    setToTheLastBlock() {
      const e = this.Editor.BlockManager.lastBlock;
      if (e)
        if (e.tool.isDefault && e.isEmpty)
          this.setToBlock(e);
        else {
          const t = this.Editor.BlockManager.insertAtEnd();
          this.setToBlock(t);
        }
    }
    /**
     * Extract content fragment of current Block from Caret position to the end of the Block
     */
    extractFragmentFromCaretPosition() {
      const e = b.get();
      if (e.rangeCount) {
        const t = e.getRangeAt(0), o3 = this.Editor.BlockManager.currentBlock.currentInput;
        if (t.deleteContents(), o3)
          if (c.isNativeInput(o3)) {
            const i2 = o3, n2 = document.createDocumentFragment(), r2 = i2.value.substring(0, i2.selectionStart), a4 = i2.value.substring(i2.selectionStart);
            return n2.textContent = a4, i2.value = r2, n2;
          } else {
            const i2 = t.cloneRange();
            return i2.selectNodeContents(o3), i2.setStart(t.endContainer, t.endOffset), i2.extractContents();
          }
      }
    }
    /**
     * Set's caret to the next Block or Tool`s input
     * Before moving caret, we should check if caret position is at the end of Plugins node
     * Using {@link Dom#getDeepestNode} to get a last node and match with current selection
     *
     * @param {boolean} force - pass true to skip check for caret position
     */
    navigateNext(e = false) {
      const { BlockManager: t } = this.Editor, { currentBlock: o3, nextBlock: i2 } = t, { nextInput: n2 } = o3, r2 = this.isAtEnd;
      let a4 = i2;
      const l4 = e || r2;
      if (n2 && l4)
        return this.setToInput(n2, this.positions.START), true;
      if (a4 === null) {
        if (o3.tool.isDefault || !l4)
          return false;
        a4 = t.insertAtEnd();
      }
      return l4 ? (this.setToBlock(a4, this.positions.START), true) : false;
    }
    /**
     * Set's caret to the previous Tool`s input or Block
     * Before moving caret, we should check if caret position is start of the Plugins node
     * Using {@link Dom#getDeepestNode} to get a last node and match with current selection
     *
     * @param {boolean} force - pass true to skip check for caret position
     */
    navigatePrevious(e = false) {
      const { currentBlock: t, previousBlock: o3 } = this.Editor.BlockManager;
      if (!t)
        return false;
      const { previousInput: i2 } = t, n2 = e || this.isAtStart;
      return i2 && n2 ? (this.setToInput(i2, this.positions.END), true) : o3 !== null && n2 ? (this.setToBlock(o3, this.positions.END), true) : false;
    }
    /**
     * Inserts shadow element after passed element where caret can be placed
     *
     * @param {Element} element - element after which shadow caret should be inserted
     */
    createShadow(e) {
      const t = document.createElement("span");
      t.classList.add(_we.CSS.shadowCaret), e.insertAdjacentElement("beforeend", t);
    }
    /**
     * Restores caret position
     *
     * @param {HTMLElement} element - element where caret should be restored
     */
    restoreCaret(e) {
      const t = e.querySelector(`.${_we.CSS.shadowCaret}`);
      if (!t)
        return;
      new b().expandToTag(t);
      const i2 = document.createRange();
      i2.selectNode(t), i2.extractContents();
    }
    /**
     * Inserts passed content at caret position
     *
     * @param {string} content - content to insert
     */
    insertContentAtCaretPosition(e) {
      const t = document.createDocumentFragment(), o3 = document.createElement("div"), i2 = b.get(), n2 = b.range;
      o3.innerHTML = e, Array.from(o3.childNodes).forEach((d4) => t.appendChild(d4)), t.childNodes.length === 0 && t.appendChild(new Text());
      const r2 = t.lastChild;
      n2.deleteContents(), n2.insertNode(t);
      const a4 = document.createRange(), l4 = r2.nodeType === Node.TEXT_NODE ? r2 : r2.firstChild;
      l4 !== null && l4.textContent !== null && a4.setStart(l4, l4.textContent.length), i2.removeAllRanges(), i2.addRange(a4);
    }
    /**
     * Get all first-level (first child of [contenteditable]) siblings from passed node
     * Then you can check it for emptiness
     *
     * @example
     * <div contenteditable>
     * <p></p>                            |
     * <p></p>                            | left first-level siblings
     * <p></p>                            |
     * <blockquote><a><b>adaddad</b><a><blockquote>       <-- passed node for example <b>
     * <p></p>                            |
     * <p></p>                            | right first-level siblings
     * <p></p>                            |
     * </div>
     * @param {HTMLElement} from - element from which siblings should be searched
     * @param {'left' | 'right'} direction - direction of search
     * @returns {HTMLElement[]}
     */
    getHigherLevelSiblings(e, t) {
      let o3 = e;
      const i2 = [];
      for (; o3.parentNode && o3.parentNode.contentEditable !== "true"; )
        o3 = o3.parentNode;
      const n2 = t === "left" ? "previousSibling" : "nextSibling";
      for (; o3[n2]; )
        o3 = o3[n2], i2.push(o3);
      return i2;
    }
  };
  var si = class extends y {
    constructor() {
      super(...arguments), this.onMouseUp = () => {
        this.listeners.off(document, "mouseover", this.onMouseOver), this.listeners.off(document, "mouseup", this.onMouseUp);
      }, this.onMouseOver = (e) => {
        const { BlockManager: t, BlockSelection: o3 } = this.Editor;
        if (e.relatedTarget === null && e.target === null)
          return;
        const i2 = t.getBlockByChildNode(e.relatedTarget) || this.lastSelectedBlock, n2 = t.getBlockByChildNode(e.target);
        if (!(!i2 || !n2) && n2 !== i2) {
          if (i2 === this.firstSelectedBlock) {
            b.get().removeAllRanges(), i2.selected = true, n2.selected = true, o3.clearCache();
            return;
          }
          if (n2 === this.firstSelectedBlock) {
            i2.selected = false, n2.selected = false, o3.clearCache();
            return;
          }
          this.Editor.InlineToolbar.close(), this.toggleBlocksSelectedState(i2, n2), this.lastSelectedBlock = n2;
        }
      };
    }
    /**
     * Module preparation
     *
     * @returns {Promise}
     */
    async prepare() {
      this.listeners.on(document, "mousedown", (e) => {
        this.enableCrossBlockSelection(e);
      });
    }
    /**
     * Sets up listeners
     *
     * @param {MouseEvent} event - mouse down event
     */
    watchSelection(e) {
      if (e.button !== Pt.LEFT)
        return;
      const { BlockManager: t } = this.Editor;
      this.firstSelectedBlock = t.getBlock(e.target), this.lastSelectedBlock = this.firstSelectedBlock, this.listeners.on(document, "mouseover", this.onMouseOver), this.listeners.on(document, "mouseup", this.onMouseUp);
    }
    /**
     * return boolean is cross block selection started
     */
    get isCrossBlockSelectionStarted() {
      return !!this.firstSelectedBlock && !!this.lastSelectedBlock;
    }
    /**
     * Change selection state of the next Block
     * Used for CBS via Shift + arrow keys
     *
     * @param {boolean} next - if true, toggle next block. Previous otherwise
     */
    toggleBlockSelectedState(e = true) {
      const { BlockManager: t, BlockSelection: o3 } = this.Editor;
      this.lastSelectedBlock || (this.lastSelectedBlock = this.firstSelectedBlock = t.currentBlock), this.firstSelectedBlock === this.lastSelectedBlock && (this.firstSelectedBlock.selected = true, o3.clearCache(), b.get().removeAllRanges());
      const i2 = t.blocks.indexOf(this.lastSelectedBlock) + (e ? 1 : -1), n2 = t.blocks[i2];
      n2 && (this.lastSelectedBlock.selected !== n2.selected ? (n2.selected = true, o3.clearCache()) : (this.lastSelectedBlock.selected = false, o3.clearCache()), this.lastSelectedBlock = n2, this.Editor.InlineToolbar.close(), n2.holder.scrollIntoView({
        block: "nearest"
      }));
    }
    /**
     * Clear saved state
     *
     * @param {Event} reason - event caused clear of selection
     */
    clear(e) {
      const { BlockManager: t, BlockSelection: o3, Caret: i2 } = this.Editor, n2 = t.blocks.indexOf(this.firstSelectedBlock), r2 = t.blocks.indexOf(this.lastSelectedBlock);
      if (o3.anyBlockSelected && n2 > -1 && r2 > -1 && e && e instanceof KeyboardEvent)
        switch (e.keyCode) {
          case v.DOWN:
          case v.RIGHT:
            i2.setToBlock(t.blocks[Math.max(n2, r2)], i2.positions.END);
            break;
          case v.UP:
          case v.LEFT:
            i2.setToBlock(t.blocks[Math.min(n2, r2)], i2.positions.START);
            break;
          default:
            i2.setToBlock(t.blocks[Math.max(n2, r2)], i2.positions.END);
        }
      this.firstSelectedBlock = this.lastSelectedBlock = null;
    }
    /**
     * Enables Cross Block Selection
     *
     * @param {MouseEvent} event - mouse down event
     */
    enableCrossBlockSelection(e) {
      const { UI: t } = this.Editor;
      b.isCollapsed || this.Editor.BlockSelection.clearSelection(e), t.nodes.redactor.contains(e.target) ? this.watchSelection(e) : this.Editor.BlockSelection.clearSelection(e);
    }
    /**
     * Change blocks selection state between passed two blocks.
     *
     * @param {Block} firstBlock - first block in range
     * @param {Block} lastBlock - last block in range
     */
    toggleBlocksSelectedState(e, t) {
      const { BlockManager: o3, BlockSelection: i2 } = this.Editor, n2 = o3.blocks.indexOf(e), r2 = o3.blocks.indexOf(t), a4 = e.selected !== t.selected;
      for (let l4 = Math.min(n2, r2); l4 <= Math.max(n2, r2); l4++) {
        const d4 = o3.blocks[l4];
        d4 !== this.firstSelectedBlock && d4 !== (a4 ? e : t) && (o3.blocks[l4].selected = !o3.blocks[l4].selected, i2.clearCache());
      }
    }
  };
  var ri = class extends y {
    constructor() {
      super(...arguments), this.isStartedAtEditor = false;
    }
    /**
     * Toggle read-only state
     *
     * if state is true:
     *  - disable all drag-n-drop event handlers
     *
     * if state is false:
     *  - restore drag-n-drop event handlers
     *
     * @param {boolean} readOnlyEnabled - "read only" state
     */
    toggleReadOnly(e) {
      e ? this.disableModuleBindings() : this.enableModuleBindings();
    }
    /**
     * Add drag events listeners to editor zone
     */
    enableModuleBindings() {
      const { UI: e } = this.Editor;
      this.readOnlyMutableListeners.on(e.nodes.holder, "drop", async (t) => {
        await this.processDrop(t);
      }, true), this.readOnlyMutableListeners.on(e.nodes.holder, "dragstart", () => {
        this.processDragStart();
      }), this.readOnlyMutableListeners.on(e.nodes.holder, "dragover", (t) => {
        this.processDragOver(t);
      }, true);
    }
    /**
     * Unbind drag-n-drop event handlers
     */
    disableModuleBindings() {
      this.readOnlyMutableListeners.clearAll();
    }
    /**
     * Handle drop event
     *
     * @param {DragEvent} dropEvent - drop event
     */
    async processDrop(e) {
      const {
        BlockManager: t,
        Caret: o3,
        Paste: i2
      } = this.Editor;
      e.preventDefault(), t.blocks.forEach((r2) => {
        r2.dropTarget = false;
      }), b.isAtEditor && !b.isCollapsed && this.isStartedAtEditor && document.execCommand("delete"), this.isStartedAtEditor = false;
      const n2 = t.setCurrentBlockByChildNode(e.target);
      if (n2)
        this.Editor.Caret.setToBlock(n2, o3.positions.END);
      else {
        const r2 = t.setCurrentBlockByChildNode(t.lastBlock.holder);
        this.Editor.Caret.setToBlock(r2, o3.positions.END);
      }
      await i2.processDataTransfer(e.dataTransfer, true);
    }
    /**
     * Handle drag start event
     */
    processDragStart() {
      b.isAtEditor && !b.isCollapsed && (this.isStartedAtEditor = true), this.Editor.InlineToolbar.close();
    }
    /**
     * @param {DragEvent} dragEvent - drag event
     */
    processDragOver(e) {
      e.preventDefault();
    }
  };
  var ai = class extends y {
    /**
     * Prepare the module
     *
     * @param options - options used by the modification observer module
     * @param options.config - Editor configuration object
     * @param options.eventsDispatcher - common Editor event bus
     */
    constructor({ config: e, eventsDispatcher: t }) {
      super({
        config: e,
        eventsDispatcher: t
      }), this.disabled = false, this.batchingTimeout = null, this.batchingOnChangeQueue = /* @__PURE__ */ new Map(), this.batchTime = 400, this.mutationObserver = new MutationObserver((o3) => {
        this.redactorChanged(o3);
      }), this.eventsDispatcher.on(pt, (o3) => {
        this.particularBlockChanged(o3.event);
      }), this.eventsDispatcher.on(ft, () => {
        this.disable();
      }), this.eventsDispatcher.on(gt, () => {
        this.enable();
      });
    }
    /**
     * Enables onChange event
     */
    enable() {
      this.mutationObserver.observe(
        this.Editor.UI.nodes.redactor,
        {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true
        }
      ), this.disabled = false;
    }
    /**
     * Disables onChange event
     */
    disable() {
      this.mutationObserver.disconnect(), this.disabled = true;
    }
    /**
     * Call onChange event passed to Editor.js configuration
     *
     * @param event - some of our custom change events
     */
    particularBlockChanged(e) {
      this.disabled || !M(this.config.onChange) || (this.batchingOnChangeQueue.set(`block:${e.detail.target.id}:event:${e.type}`, e), this.batchingTimeout && clearTimeout(this.batchingTimeout), this.batchingTimeout = setTimeout(() => {
        let t;
        this.batchingOnChangeQueue.size === 1 ? t = this.batchingOnChangeQueue.values().next().value : t = Array.from(this.batchingOnChangeQueue.values()), this.config.onChange && this.config.onChange(this.Editor.API.methods, t), this.batchingOnChangeQueue.clear();
      }, this.batchTime));
    }
    /**
     * Fired on every blocks wrapper dom change
     *
     * @param mutations - mutations happened
     */
    redactorChanged(e) {
      this.eventsDispatcher.emit(Ae, {
        mutations: e
      });
    }
  };
  var Ct = class extends y {
    constructor() {
      super(...arguments), this.MIME_TYPE = "application/x-editor-js", this.toolsTags = {}, this.tagsByTool = {}, this.toolsPatterns = [], this.toolsFiles = {}, this.exceptionList = [], this.processTool = (s) => {
        try {
          const e = s.create({}, {}, false);
          if (s.pasteConfig === false) {
            this.exceptionList.push(s.name);
            return;
          }
          if (!M(e.onPaste))
            return;
          this.getTagsConfig(s), this.getFilesConfig(s), this.getPatternsConfig(s);
        } catch (e) {
          T(
            `Paste handling for \xAB${s.name}\xBB Tool hasn't been set up because of the error`,
            "warn",
            e
          );
        }
      }, this.handlePasteEvent = async (s) => {
        const { BlockManager: e, Toolbar: t } = this.Editor, o3 = e.setCurrentBlockByChildNode(s.target);
        !o3 || this.isNativeBehaviour(s.target) && !s.clipboardData.types.includes("Files") || o3 && this.exceptionList.includes(o3.name) || (s.preventDefault(), this.processDataTransfer(s.clipboardData), t.close());
      };
    }
    /**
     * Set onPaste callback and collect tools` paste configurations
     */
    async prepare() {
      this.processTools();
    }
    /**
     * Set read-only state
     *
     * @param {boolean} readOnlyEnabled - read only flag value
     */
    toggleReadOnly(s) {
      s ? this.unsetCallback() : this.setCallback();
    }
    /**
     * Handle pasted or dropped data transfer object
     *
     * @param {DataTransfer} dataTransfer - pasted or dropped data transfer object
     * @param {boolean} isDragNDrop - true if data transfer comes from drag'n'drop events
     */
    async processDataTransfer(s, e = false) {
      const { Tools: t } = this.Editor, o3 = s.types;
      if ((o3.includes ? o3.includes("Files") : o3.contains("Files")) && !W(this.toolsFiles)) {
        await this.processFiles(s.files);
        return;
      }
      const n2 = s.getData(this.MIME_TYPE), r2 = s.getData("text/plain");
      let a4 = s.getData("text/html");
      if (n2)
        try {
          this.insertEditorJSData(JSON.parse(n2));
          return;
        } catch {
        }
      e && r2.trim() && a4.trim() && (a4 = "<p>" + (a4.trim() ? a4 : r2) + "</p>");
      const l4 = Object.keys(this.toolsTags).reduce((h3, f) => (h3[f.toLowerCase()] = this.toolsTags[f].sanitizationConfig ?? {}, h3), {}), d4 = Object.assign({}, l4, t.getAllInlineToolsSanitizeConfig(), { br: {} }), u2 = V(a4, d4);
      !u2.trim() || u2.trim() === r2 || !c.isHTMLString(u2) ? await this.processText(r2) : await this.processText(u2, true);
    }
    /**
     * Process pasted text and divide them into Blocks
     *
     * @param {string} data - text to process. Can be HTML or plain.
     * @param {boolean} isHTML - if passed string is HTML, this parameter should be true
     */
    async processText(s, e = false) {
      const { Caret: t, BlockManager: o3 } = this.Editor, i2 = e ? this.processHTML(s) : this.processPlain(s);
      if (!i2.length)
        return;
      if (i2.length === 1) {
        i2[0].isBlock ? this.processSingleBlock(i2.pop()) : this.processInlinePaste(i2.pop());
        return;
      }
      const r2 = o3.currentBlock && o3.currentBlock.tool.isDefault && o3.currentBlock.isEmpty;
      i2.map(
        async (a4, l4) => this.insertBlock(a4, l4 === 0 && r2)
      ), o3.currentBlock && t.setToBlock(o3.currentBlock, t.positions.END);
    }
    /**
     * Set onPaste callback handler
     */
    setCallback() {
      this.listeners.on(this.Editor.UI.nodes.holder, "paste", this.handlePasteEvent);
    }
    /**
     * Unset onPaste callback handler
     */
    unsetCallback() {
      this.listeners.off(this.Editor.UI.nodes.holder, "paste", this.handlePasteEvent);
    }
    /**
     * Get and process tool`s paste configs
     */
    processTools() {
      const s = this.Editor.Tools.blockTools;
      Array.from(s.values()).forEach(this.processTool);
    }
    /**
     * Get tags name list from either tag name or sanitization config.
     *
     * @param {string | object} tagOrSanitizeConfig - tag name or sanitize config object.
     * @returns {string[]} array of tags.
     */
    collectTagNames(s) {
      return G(s) ? [s] : D(s) ? Object.keys(s) : [];
    }
    /**
     * Get tags to substitute by Tool
     *
     * @param tool - BlockTool object
     */
    getTagsConfig(s) {
      if (s.pasteConfig === false)
        return;
      const e = s.pasteConfig.tags || [], t = [];
      e.forEach((o3) => {
        const i2 = this.collectTagNames(o3);
        t.push(...i2), i2.forEach((n2) => {
          if (Object.prototype.hasOwnProperty.call(this.toolsTags, n2)) {
            T(
              `Paste handler for \xAB${s.name}\xBB Tool on \xAB${n2}\xBB tag is skipped because it is already used by \xAB${this.toolsTags[n2].tool.name}\xBB Tool.`,
              "warn"
            );
            return;
          }
          const r2 = D(o3) ? o3[n2] : null;
          this.toolsTags[n2.toUpperCase()] = {
            tool: s,
            sanitizationConfig: r2
          };
        });
      }), this.tagsByTool[s.name] = t.map((o3) => o3.toUpperCase());
    }
    /**
     * Get files` types and extensions to substitute by Tool
     *
     * @param tool - BlockTool object
     */
    getFilesConfig(s) {
      if (s.pasteConfig === false)
        return;
      const { files: e = {} } = s.pasteConfig;
      let { extensions: t, mimeTypes: o3 } = e;
      !t && !o3 || (t && !Array.isArray(t) && (T(`\xABextensions\xBB property of the onDrop config for \xAB${s.name}\xBB Tool should be an array`), t = []), o3 && !Array.isArray(o3) && (T(`\xABmimeTypes\xBB property of the onDrop config for \xAB${s.name}\xBB Tool should be an array`), o3 = []), o3 && (o3 = o3.filter((i2) => jt(i2) ? true : (T(`MIME type value \xAB${i2}\xBB for the \xAB${s.name}\xBB Tool is not a valid MIME type`, "warn"), false))), this.toolsFiles[s.name] = {
        extensions: t || [],
        mimeTypes: o3 || []
      });
    }
    /**
     * Get RegExp patterns to substitute by Tool
     *
     * @param tool - BlockTool object
     */
    getPatternsConfig(s) {
      s.pasteConfig === false || !s.pasteConfig.patterns || W(s.pasteConfig.patterns) || Object.entries(s.pasteConfig.patterns).forEach(([e, t]) => {
        t instanceof RegExp || T(
          `Pattern ${t} for \xAB${s.name}\xBB Tool is skipped because it should be a Regexp instance.`,
          "warn"
        ), this.toolsPatterns.push({
          key: e,
          pattern: t,
          tool: s
        });
      });
    }
    /**
     * Check if browser behavior suits better
     *
     * @param {EventTarget} element - element where content has been pasted
     * @returns {boolean}
     */
    isNativeBehaviour(s) {
      return c.isNativeInput(s);
    }
    /**
     * Get files from data transfer object and insert related Tools
     *
     * @param {FileList} items - pasted or dropped items
     */
    async processFiles(s) {
      const { BlockManager: e } = this.Editor;
      let t;
      t = await Promise.all(
        Array.from(s).map((n2) => this.processFile(n2))
      ), t = t.filter((n2) => !!n2);
      const i2 = e.currentBlock.tool.isDefault && e.currentBlock.isEmpty;
      t.forEach(
        (n2, r2) => {
          e.paste(n2.type, n2.event, r2 === 0 && i2);
        }
      );
    }
    /**
     * Get information about file and find Tool to handle it
     *
     * @param {File} file - file to process
     */
    async processFile(s) {
      const e = Ut(s), t = Object.entries(this.toolsFiles).find(([n2, { mimeTypes: r2, extensions: a4 }]) => {
        const [l4, d4] = s.type.split("/"), u2 = a4.find((f) => f.toLowerCase() === e.toLowerCase()), h3 = r2.find((f) => {
          const [x, p] = f.split("/");
          return x === l4 && (p === d4 || p === "*");
        });
        return !!u2 || !!h3;
      });
      if (!t)
        return;
      const [o3] = t;
      return {
        event: this.composePasteEvent("file", {
          file: s
        }),
        type: o3
      };
    }
    /**
     * Split HTML string to blocks and return it as array of Block data
     *
     * @param {string} innerHTML - html string to process
     * @returns {PasteData[]}
     */
    processHTML(s) {
      const { Tools: e } = this.Editor, t = c.make("DIV");
      return t.innerHTML = s, this.getNodes(t).map((i2) => {
        let n2, r2 = e.defaultTool, a4 = false;
        switch (i2.nodeType) {
          case Node.DOCUMENT_FRAGMENT_NODE:
            n2 = c.make("div"), n2.appendChild(i2);
            break;
          case Node.ELEMENT_NODE:
            n2 = i2, a4 = true, this.toolsTags[n2.tagName] && (r2 = this.toolsTags[n2.tagName].tool);
            break;
        }
        const { tags: l4 } = r2.pasteConfig || { tags: [] }, d4 = l4.reduce((f, x) => (this.collectTagNames(x).forEach((m) => {
          const L = D(x) ? x[m] : null;
          f[m.toLowerCase()] = L || {};
        }), f), {}), u2 = Object.assign({}, d4, r2.baseSanitizeConfig);
        if (n2.tagName.toLowerCase() === "table") {
          const f = V(n2.outerHTML, u2);
          n2 = c.make("div", void 0, {
            innerHTML: f
          }).firstChild;
        } else
          n2.innerHTML = V(n2.innerHTML, u2);
        const h3 = this.composePasteEvent("tag", {
          data: n2
        });
        return {
          content: n2,
          isBlock: a4,
          tool: r2.name,
          event: h3
        };
      }).filter((i2) => {
        const n2 = c.isEmpty(i2.content), r2 = c.isSingleTag(i2.content);
        return !n2 || r2;
      });
    }
    /**
     * Split plain text by new line symbols and return it as array of Block data
     *
     * @param {string} plain - string to process
     * @returns {PasteData[]}
     */
    processPlain(s) {
      const { defaultBlock: e } = this.config;
      if (!s)
        return [];
      const t = e;
      return s.split(/\r?\n/).filter((o3) => o3.trim()).map((o3) => {
        const i2 = c.make("div");
        i2.textContent = o3;
        const n2 = this.composePasteEvent("tag", {
          data: i2
        });
        return {
          content: i2,
          tool: t,
          isBlock: false,
          event: n2
        };
      });
    }
    /**
     * Process paste of single Block tool content
     *
     * @param {PasteData} dataToInsert - data of Block to insert
     */
    async processSingleBlock(s) {
      const { Caret: e, BlockManager: t } = this.Editor, { currentBlock: o3 } = t;
      if (!o3 || s.tool !== o3.name || !c.containsOnlyInlineElements(s.content.innerHTML)) {
        this.insertBlock(s, (o3 == null ? void 0 : o3.tool.isDefault) && o3.isEmpty);
        return;
      }
      e.insertContentAtCaretPosition(s.content.innerHTML);
    }
    /**
     * Process paste to single Block:
     * 1. Find patterns` matches
     * 2. Insert new block if it is not the same type as current one
     * 3. Just insert text if there is no substitutions
     *
     * @param {PasteData} dataToInsert - data of Block to insert
     */
    async processInlinePaste(s) {
      const { BlockManager: e, Caret: t } = this.Editor, { content: o3 } = s;
      if (e.currentBlock && e.currentBlock.tool.isDefault && o3.textContent.length < Ct.PATTERN_PROCESSING_MAX_LENGTH) {
        const n2 = await this.processPattern(o3.textContent);
        if (n2) {
          const r2 = e.currentBlock && e.currentBlock.tool.isDefault && e.currentBlock.isEmpty, a4 = e.paste(n2.tool, n2.event, r2);
          t.setToBlock(a4, t.positions.END);
          return;
        }
      }
      if (e.currentBlock && e.currentBlock.currentInput) {
        const n2 = e.currentBlock.tool.baseSanitizeConfig;
        document.execCommand(
          "insertHTML",
          false,
          V(o3.innerHTML, n2)
        );
      } else
        this.insertBlock(s);
    }
    /**
     * Get patterns` matches
     *
     * @param {string} text - text to process
     * @returns {Promise<{event: PasteEvent, tool: string}>}
     */
    async processPattern(s) {
      const e = this.toolsPatterns.find((o3) => {
        const i2 = o3.pattern.exec(s);
        return i2 ? s === i2.shift() : false;
      });
      return e ? {
        event: this.composePasteEvent("pattern", {
          key: e.key,
          data: s
        }),
        tool: e.tool.name
      } : void 0;
    }
    /**
     * Insert pasted Block content to Editor
     *
     * @param {PasteData} data - data to insert
     * @param {boolean} canReplaceCurrentBlock - if true and is current Block is empty, will replace current Block
     * @returns {void}
     */
    insertBlock(s, e = false) {
      const { BlockManager: t, Caret: o3 } = this.Editor, { currentBlock: i2 } = t;
      let n2;
      if (e && i2 && i2.isEmpty) {
        n2 = t.paste(s.tool, s.event, true), o3.setToBlock(n2, o3.positions.END);
        return;
      }
      n2 = t.paste(s.tool, s.event), o3.setToBlock(n2, o3.positions.END);
    }
    /**
     * Insert data passed as application/x-editor-js JSON
     *
     * @param {Array} blocks — Blocks' data to insert
     * @returns {void}
     */
    insertEditorJSData(s) {
      const { BlockManager: e, Caret: t, Tools: o3 } = this.Editor;
      bt(
        s,
        (n2) => o3.blockTools.get(n2).sanitizeConfig
      ).forEach(({ tool: n2, data: r2 }, a4) => {
        let l4 = false;
        a4 === 0 && (l4 = e.currentBlock && e.currentBlock.tool.isDefault && e.currentBlock.isEmpty);
        const d4 = e.insert({
          tool: n2,
          data: r2,
          replace: l4
        });
        t.setToBlock(d4, t.positions.END);
      });
    }
    /**
     * Fetch nodes from Element node
     *
     * @param {Node} node - current node
     * @param {Node[]} nodes - processed nodes
     * @param {Node} destNode - destination node
     */
    processElementNode(s, e, t) {
      const o3 = Object.keys(this.toolsTags), i2 = s, { tool: n2 } = this.toolsTags[i2.tagName] || {}, r2 = this.tagsByTool[n2 == null ? void 0 : n2.name] || [], a4 = o3.includes(i2.tagName), l4 = c.blockElements.includes(i2.tagName.toLowerCase()), d4 = Array.from(i2.children).some(
        ({ tagName: h3 }) => o3.includes(h3) && !r2.includes(h3)
      ), u2 = Array.from(i2.children).some(
        ({ tagName: h3 }) => c.blockElements.includes(h3.toLowerCase())
      );
      if (!l4 && !a4 && !d4)
        return t.appendChild(i2), [...e, t];
      if (a4 && !d4 || l4 && !u2 && !d4)
        return [...e, t, i2];
    }
    /**
     * Recursively divide HTML string to two types of nodes:
     * 1. Block element
     * 2. Document Fragments contained text and markup tags like a, b, i etc.
     *
     * @param {Node} wrapper - wrapper of paster HTML content
     * @returns {Node[]}
     */
    getNodes(s) {
      const e = Array.from(s.childNodes);
      let t;
      const o3 = (i2, n2) => {
        if (c.isEmpty(n2) && !c.isSingleTag(n2))
          return i2;
        const r2 = i2[i2.length - 1];
        let a4 = new DocumentFragment();
        switch (r2 && c.isFragment(r2) && (a4 = i2.pop()), n2.nodeType) {
          case Node.ELEMENT_NODE:
            if (t = this.processElementNode(n2, i2, a4), t)
              return t;
            break;
          case Node.TEXT_NODE:
            return a4.appendChild(n2), [...i2, a4];
          default:
            return [...i2, a4];
        }
        return [...i2, ...Array.from(n2.childNodes).reduce(o3, [])];
      };
      return e.reduce(o3, []);
    }
    /**
     * Compose paste event with passed type and detail
     *
     * @param {string} type - event type
     * @param {PasteEventDetail} detail - event detail
     */
    composePasteEvent(s, e) {
      return new CustomEvent(s, {
        detail: e
      });
    }
  };
  var Tt = Ct;
  Tt.PATTERN_PROCESSING_MAX_LENGTH = 450;
  var li = class extends y {
    constructor() {
      super(...arguments), this.toolsDontSupportReadOnly = [], this.readOnlyEnabled = false;
    }
    /**
     * Returns state of read only mode
     */
    get isEnabled() {
      return this.readOnlyEnabled;
    }
    /**
     * Set initial state
     */
    async prepare() {
      const { Tools: e } = this.Editor, { blockTools: t } = e, o3 = [];
      Array.from(t.entries()).forEach(([i2, n2]) => {
        n2.isReadOnlySupported || o3.push(i2);
      }), this.toolsDontSupportReadOnly = o3, this.config.readOnly && o3.length > 0 && this.throwCriticalError(), this.toggle(this.config.readOnly);
    }
    /**
     * Set read-only mode or toggle current state
     * Call all Modules `toggleReadOnly` method and re-render Editor
     *
     * @param {boolean} state - (optional) read-only state or toggle
     */
    async toggle(e = !this.readOnlyEnabled) {
      e && this.toolsDontSupportReadOnly.length > 0 && this.throwCriticalError();
      const t = this.readOnlyEnabled;
      this.readOnlyEnabled = e;
      for (const i2 in this.Editor)
        this.Editor[i2].toggleReadOnly && this.Editor[i2].toggleReadOnly(e);
      if (t === e)
        return this.readOnlyEnabled;
      const o3 = await this.Editor.Saver.save();
      return await this.Editor.BlockManager.clear(), await this.Editor.Renderer.render(o3.blocks), this.readOnlyEnabled;
    }
    /**
     * Throws an error about tools which don't support read-only mode
     */
    throwCriticalError() {
      throw new ut(
        `To enable read-only mode all connected tools should support it. Tools ${this.toolsDontSupportReadOnly.join(", ")} don't support read-only mode.`
      );
    }
  };
  var fe = class _fe extends y {
    constructor() {
      super(...arguments), this.isRectSelectionActivated = false, this.SCROLL_SPEED = 3, this.HEIGHT_OF_SCROLL_ZONE = 40, this.BOTTOM_SCROLL_ZONE = 1, this.TOP_SCROLL_ZONE = 2, this.MAIN_MOUSE_BUTTON = 0, this.mousedown = false, this.isScrolling = false, this.inScrollZone = null, this.startX = 0, this.startY = 0, this.mouseX = 0, this.mouseY = 0, this.stackOfSelected = [], this.listenerIds = [];
    }
    /**
     * CSS classes for the Block
     *
     * @returns {{wrapper: string, content: string}}
     */
    static get CSS() {
      return {
        overlay: "codex-editor-overlay",
        overlayContainer: "codex-editor-overlay__container",
        rect: "codex-editor-overlay__rectangle",
        topScrollZone: "codex-editor-overlay__scroll-zone--top",
        bottomScrollZone: "codex-editor-overlay__scroll-zone--bottom"
      };
    }
    /**
     * Module Preparation
     * Creating rect and hang handlers
     */
    prepare() {
      this.enableModuleBindings();
    }
    /**
     * Init rect params
     *
     * @param {number} pageX - X coord of mouse
     * @param {number} pageY - Y coord of mouse
     */
    startSelection(e, t) {
      const o3 = document.elementFromPoint(e - window.pageXOffset, t - window.pageYOffset);
      o3.closest(`.${this.Editor.Toolbar.CSS.toolbar}`) || (this.Editor.BlockSelection.allBlocksSelected = false, this.clearSelection(), this.stackOfSelected = []);
      const n2 = [
        `.${R.CSS.content}`,
        `.${this.Editor.Toolbar.CSS.toolbar}`,
        `.${this.Editor.InlineToolbar.CSS.inlineToolbar}`
      ], r2 = o3.closest("." + this.Editor.UI.CSS.editorWrapper), a4 = n2.some((l4) => !!o3.closest(l4));
      !r2 || a4 || (this.mousedown = true, this.startX = e, this.startY = t);
    }
    /**
     * Clear all params to end selection
     */
    endSelection() {
      this.mousedown = false, this.startX = 0, this.startY = 0, this.overlayRectangle.style.display = "none";
    }
    /**
     * is RectSelection Activated
     */
    isRectActivated() {
      return this.isRectSelectionActivated;
    }
    /**
     * Mark that selection is end
     */
    clearSelection() {
      this.isRectSelectionActivated = false;
    }
    /**
     * Sets Module necessary event handlers
     */
    enableModuleBindings() {
      const { container: e } = this.genHTML();
      this.listeners.on(e, "mousedown", (t) => {
        this.processMouseDown(t);
      }, false), this.listeners.on(document.body, "mousemove", Ie((t) => {
        this.processMouseMove(t);
      }, 10), {
        passive: true
      }), this.listeners.on(document.body, "mouseleave", () => {
        this.processMouseLeave();
      }), this.listeners.on(window, "scroll", Ie((t) => {
        this.processScroll(t);
      }, 10), {
        passive: true
      }), this.listeners.on(document.body, "mouseup", () => {
        this.processMouseUp();
      }, false);
    }
    /**
     * Handle mouse down events
     *
     * @param {MouseEvent} mouseEvent - mouse event payload
     */
    processMouseDown(e) {
      if (e.button !== this.MAIN_MOUSE_BUTTON)
        return;
      e.target.closest(c.allInputsSelector) !== null || this.startSelection(e.pageX, e.pageY);
    }
    /**
     * Handle mouse move events
     *
     * @param {MouseEvent} mouseEvent - mouse event payload
     */
    processMouseMove(e) {
      this.changingRectangle(e), this.scrollByZones(e.clientY);
    }
    /**
     * Handle mouse leave
     */
    processMouseLeave() {
      this.clearSelection(), this.endSelection();
    }
    /**
     * @param {MouseEvent} mouseEvent - mouse event payload
     */
    processScroll(e) {
      this.changingRectangle(e);
    }
    /**
     * Handle mouse up
     */
    processMouseUp() {
      this.clearSelection(), this.endSelection();
    }
    /**
     * Scroll If mouse in scroll zone
     *
     * @param {number} clientY - Y coord of mouse
     */
    scrollByZones(e) {
      if (this.inScrollZone = null, e <= this.HEIGHT_OF_SCROLL_ZONE && (this.inScrollZone = this.TOP_SCROLL_ZONE), document.documentElement.clientHeight - e <= this.HEIGHT_OF_SCROLL_ZONE && (this.inScrollZone = this.BOTTOM_SCROLL_ZONE), !this.inScrollZone) {
        this.isScrolling = false;
        return;
      }
      this.isScrolling || (this.scrollVertical(this.inScrollZone === this.TOP_SCROLL_ZONE ? -this.SCROLL_SPEED : this.SCROLL_SPEED), this.isScrolling = true);
    }
    /**
     * Generates required HTML elements
     *
     * @returns {Object<string, Element>}
     */
    genHTML() {
      const { UI: e } = this.Editor, t = e.nodes.holder.querySelector("." + e.CSS.editorWrapper), o3 = c.make("div", _fe.CSS.overlay, {}), i2 = c.make("div", _fe.CSS.overlayContainer, {}), n2 = c.make("div", _fe.CSS.rect, {});
      return i2.appendChild(n2), o3.appendChild(i2), t.appendChild(o3), this.overlayRectangle = n2, {
        container: t,
        overlay: o3
      };
    }
    /**
     * Activates scrolling if blockSelection is active and mouse is in scroll zone
     *
     * @param {number} speed - speed of scrolling
     */
    scrollVertical(e) {
      if (!(this.inScrollZone && this.mousedown))
        return;
      const t = window.pageYOffset;
      window.scrollBy(0, e), this.mouseY += window.pageYOffset - t, setTimeout(() => {
        this.scrollVertical(e);
      }, 0);
    }
    /**
     * Handles the change in the rectangle and its effect
     *
     * @param {MouseEvent} event - mouse event
     */
    changingRectangle(e) {
      if (!this.mousedown)
        return;
      e.pageY !== void 0 && (this.mouseX = e.pageX, this.mouseY = e.pageY);
      const { rightPos: t, leftPos: o3, index: i2 } = this.genInfoForMouseSelection(), n2 = this.startX > t && this.mouseX > t, r2 = this.startX < o3 && this.mouseX < o3;
      this.rectCrossesBlocks = !(n2 || r2), this.isRectSelectionActivated || (this.rectCrossesBlocks = false, this.isRectSelectionActivated = true, this.shrinkRectangleToPoint(), this.overlayRectangle.style.display = "block"), this.updateRectangleSize(), this.Editor.Toolbar.close(), i2 !== void 0 && (this.trySelectNextBlock(i2), this.inverseSelection(), b.get().removeAllRanges());
    }
    /**
     * Shrink rect to singular point
     */
    shrinkRectangleToPoint() {
      this.overlayRectangle.style.left = `${this.startX - window.pageXOffset}px`, this.overlayRectangle.style.top = `${this.startY - window.pageYOffset}px`, this.overlayRectangle.style.bottom = `calc(100% - ${this.startY - window.pageYOffset}px`, this.overlayRectangle.style.right = `calc(100% - ${this.startX - window.pageXOffset}px`;
    }
    /**
     * Select or unselect all of blocks in array if rect is out or in selectable area
     */
    inverseSelection() {
      const t = this.Editor.BlockManager.getBlockByIndex(this.stackOfSelected[0]).selected;
      if (this.rectCrossesBlocks && !t)
        for (const o3 of this.stackOfSelected)
          this.Editor.BlockSelection.selectBlockByIndex(o3);
      if (!this.rectCrossesBlocks && t)
        for (const o3 of this.stackOfSelected)
          this.Editor.BlockSelection.unSelectBlockByIndex(o3);
    }
    /**
     * Updates size of rectangle
     */
    updateRectangleSize() {
      this.mouseY >= this.startY ? (this.overlayRectangle.style.top = `${this.startY - window.pageYOffset}px`, this.overlayRectangle.style.bottom = `calc(100% - ${this.mouseY - window.pageYOffset}px`) : (this.overlayRectangle.style.bottom = `calc(100% - ${this.startY - window.pageYOffset}px`, this.overlayRectangle.style.top = `${this.mouseY - window.pageYOffset}px`), this.mouseX >= this.startX ? (this.overlayRectangle.style.left = `${this.startX - window.pageXOffset}px`, this.overlayRectangle.style.right = `calc(100% - ${this.mouseX - window.pageXOffset}px`) : (this.overlayRectangle.style.right = `calc(100% - ${this.startX - window.pageXOffset}px`, this.overlayRectangle.style.left = `${this.mouseX - window.pageXOffset}px`);
    }
    /**
     * Collects information needed to determine the behavior of the rectangle
     *
     * @returns {object} index - index next Block, leftPos - start of left border of Block, rightPos - right border
     */
    genInfoForMouseSelection() {
      const t = document.body.offsetWidth / 2, o3 = this.mouseY - window.pageYOffset, i2 = document.elementFromPoint(t, o3), n2 = this.Editor.BlockManager.getBlockByChildNode(i2);
      let r2;
      n2 !== void 0 && (r2 = this.Editor.BlockManager.blocks.findIndex((h3) => h3.holder === n2.holder));
      const a4 = this.Editor.BlockManager.lastBlock.holder.querySelector("." + R.CSS.content), l4 = Number.parseInt(window.getComputedStyle(a4).width, 10) / 2, d4 = t - l4, u2 = t + l4;
      return {
        index: r2,
        leftPos: d4,
        rightPos: u2
      };
    }
    /**
     * Select block with index index
     *
     * @param index - index of block in redactor
     */
    addBlockInSelection(e) {
      this.rectCrossesBlocks && this.Editor.BlockSelection.selectBlockByIndex(e), this.stackOfSelected.push(e);
    }
    /**
     * Adds a block to the selection and determines which blocks should be selected
     *
     * @param {object} index - index of new block in the reactor
     */
    trySelectNextBlock(e) {
      const t = this.stackOfSelected[this.stackOfSelected.length - 1] === e, o3 = this.stackOfSelected.length, i2 = 1, n2 = -1, r2 = 0;
      if (t)
        return;
      const a4 = this.stackOfSelected[o3 - 1] - this.stackOfSelected[o3 - 2] > 0;
      let l4 = r2;
      o3 > 1 && (l4 = a4 ? i2 : n2);
      const d4 = e > this.stackOfSelected[o3 - 1] && l4 === i2, u2 = e < this.stackOfSelected[o3 - 1] && l4 === n2, f = !(d4 || u2 || l4 === r2);
      if (!f && (e > this.stackOfSelected[o3 - 1] || this.stackOfSelected[o3 - 1] === void 0)) {
        let m = this.stackOfSelected[o3 - 1] + 1 || e;
        for (m; m <= e; m++)
          this.addBlockInSelection(m);
        return;
      }
      if (!f && e < this.stackOfSelected[o3 - 1]) {
        for (let m = this.stackOfSelected[o3 - 1] - 1; m >= e; m--)
          this.addBlockInSelection(m);
        return;
      }
      if (!f)
        return;
      let x = o3 - 1, p;
      for (e > this.stackOfSelected[o3 - 1] ? p = () => e > this.stackOfSelected[x] : p = () => e < this.stackOfSelected[x]; p(); )
        this.rectCrossesBlocks && this.Editor.BlockSelection.unSelectBlockByIndex(this.stackOfSelected[x]), this.stackOfSelected.pop(), x--;
    }
  };
  var ci = class extends y {
    /**
     * Renders passed blocks as one batch
     *
     * @param blocksData - blocks to render
     */
    async render(e) {
      return new Promise((t) => {
        const { Tools: o3, BlockManager: i2 } = this.Editor;
        if (e.length === 0)
          i2.insert();
        else {
          const n2 = e.map(({ type: r2, data: a4, tunes: l4, id: d4 }) => {
            o3.available.has(r2) === false && (Y(`Tool \xAB${r2}\xBB is not found. Check 'tools' property at the Editor.js config.`, "warn"), a4 = this.composeStubDataForTool(r2, a4, d4), r2 = o3.stubTool);
            let u2;
            try {
              u2 = i2.composeBlock({
                id: d4,
                tool: r2,
                data: a4,
                tunes: l4
              });
            } catch (h3) {
              T(`Block \xAB${r2}\xBB skipped because of plugins error`, "error", {
                data: a4,
                error: h3
              }), a4 = this.composeStubDataForTool(r2, a4, d4), r2 = o3.stubTool, u2 = i2.composeBlock({
                id: d4,
                tool: r2,
                data: a4,
                tunes: l4
              });
            }
            return u2;
          });
          i2.insertMany(n2);
        }
        window.requestIdleCallback(() => {
          t();
        }, { timeout: 2e3 });
      });
    }
    /**
     * Create data for the Stub Tool that will be used instead of unavailable tool
     *
     * @param tool - unavailable tool name to stub
     * @param data - data of unavailable block
     * @param [id] - id of unavailable block
     */
    composeStubDataForTool(e, t, o3) {
      const { Tools: i2 } = this.Editor;
      let n2 = e;
      if (i2.unavailable.has(e)) {
        const r2 = i2.unavailable.get(e).toolbox;
        r2 !== void 0 && r2[0].title !== void 0 && (n2 = r2[0].title);
      }
      return {
        savedData: {
          id: o3,
          type: e,
          data: t
        },
        title: n2
      };
    }
  };
  var di = class extends y {
    /**
     * Composes new chain of Promises to fire them alternatelly
     *
     * @returns {OutputData}
     */
    async save() {
      const { BlockManager: e, Tools: t } = this.Editor, o3 = e.blocks, i2 = [];
      try {
        o3.forEach((a4) => {
          i2.push(this.getSavedData(a4));
        });
        const n2 = await Promise.all(i2), r2 = await bt(n2, (a4) => t.blockTools.get(a4).sanitizeConfig);
        return this.makeOutput(r2);
      } catch (n2) {
        Y("Saving failed due to the Error %o", "error", n2);
      }
    }
    /**
     * Saves and validates
     *
     * @param {Block} block - Editor's Tool
     * @returns {ValidatedData} - Tool's validated data
     */
    async getSavedData(e) {
      const t = await e.save(), o3 = t && await e.validate(t.data);
      return {
        ...t,
        isValid: o3
      };
    }
    /**
     * Creates output object with saved data, time and version of editor
     *
     * @param {ValidatedData} allExtractedData - data extracted from Blocks
     * @returns {OutputData}
     */
    makeOutput(e) {
      const t = [];
      return e.forEach(({ id: o3, tool: i2, data: n2, tunes: r2, isValid: a4 }) => {
        if (!a4) {
          T(`Block \xAB${i2}\xBB skipped because saved data is invalid`);
          return;
        }
        if (i2 === this.Editor.Tools.stubTool) {
          t.push(n2);
          return;
        }
        const l4 = {
          id: o3,
          type: i2,
          data: n2,
          ...!W(r2) && {
            tunes: r2
          }
        };
        t.push(l4);
      }), {
        time: +/* @__PURE__ */ new Date(),
        blocks: t,
        version: "2.29.1"
      };
    }
  };
  (function() {
    try {
      if (typeof document < "u") {
        var s = document.createElement("style");
        s.appendChild(document.createTextNode(".ce-paragraph{line-height:1.6em;outline:none}.ce-paragraph[data-placeholder]:empty:before{content:attr(data-placeholder);color:#707684;font-weight:400;opacity:0}.codex-editor--empty .ce-block:first-child .ce-paragraph[data-placeholder]:empty:before{opacity:1}.codex-editor--toolbox-opened .ce-block:first-child .ce-paragraph[data-placeholder]:empty:before,.codex-editor--empty .ce-block:first-child .ce-paragraph[data-placeholder]:empty:focus:before{opacity:0}.ce-paragraph p:first-of-type{margin-top:0}.ce-paragraph p:last-of-type{margin-bottom:0}")), document.head.appendChild(s);
      }
    } catch (e) {
      console.error("vite-plugin-css-injected-by-js", e);
    }
  })();
  var hi = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M8 9V7.2C8 7.08954 8.08954 7 8.2 7L12 7M16 9V7.2C16 7.08954 15.9105 7 15.8 7L12 7M12 7L12 17M12 17H10M12 17H14"/></svg>';
  var Ke = class _Ke {
    /**
     * Default placeholder for Paragraph Tool
     *
     * @returns {string}
     * @class
     */
    static get DEFAULT_PLACEHOLDER() {
      return "";
    }
    /**
     * Render plugin`s main Element and fill it with saved data
     *
     * @param {object} params - constructor params
     * @param {ParagraphData} params.data - previously saved data
     * @param {ParagraphConfig} params.config - user config for Tool
     * @param {object} params.api - editor.js api
     * @param {boolean} readOnly - read only mode flag
     */
    constructor({ data: e, config: t, api: o3, readOnly: i2 }) {
      this.api = o3, this.readOnly = i2, this._CSS = {
        block: this.api.styles.block,
        wrapper: "ce-paragraph"
      }, this.readOnly || (this.onKeyUp = this.onKeyUp.bind(this)), this._placeholder = t.placeholder ? t.placeholder : _Ke.DEFAULT_PLACEHOLDER, this._data = {}, this._element = null, this._preserveBlank = t.preserveBlank !== void 0 ? t.preserveBlank : false, this.data = e;
    }
    /**
     * Check if text content is empty and set empty string to inner html.
     * We need this because some browsers (e.g. Safari) insert <br> into empty contenteditanle elements
     *
     * @param {KeyboardEvent} e - key up event
     */
    onKeyUp(e) {
      if (e.code !== "Backspace" && e.code !== "Delete")
        return;
      const { textContent: t } = this._element;
      t === "" && (this._element.innerHTML = "");
    }
    /**
     * Create Tool's view
     *
     * @returns {HTMLElement}
     * @private
     */
    drawView() {
      const e = document.createElement("DIV");
      return e.classList.add(this._CSS.wrapper, this._CSS.block), e.contentEditable = false, e.dataset.placeholder = this.api.i18n.t(this._placeholder), this._data.text && (e.innerHTML = this._data.text), this.readOnly || (e.contentEditable = true, e.addEventListener("keyup", this.onKeyUp)), e;
    }
    /**
     * Return Tool's view
     *
     * @returns {HTMLDivElement}
     */
    render() {
      return this._element = this.drawView(), this._element;
    }
    /**
     * Method that specified how to merge two Text blocks.
     * Called by Editor.js by backspace at the beginning of the Block
     *
     * @param {ParagraphData} data
     * @public
     */
    merge(e) {
      const t = {
        text: this.data.text + e.text
      };
      this.data = t;
    }
    /**
     * Validate Paragraph block data:
     * - check for emptiness
     *
     * @param {ParagraphData} savedData — data received after saving
     * @returns {boolean} false if saved data is not correct, otherwise true
     * @public
     */
    validate(e) {
      return !(e.text.trim() === "" && !this._preserveBlank);
    }
    /**
     * Extract Tool's data from the view
     *
     * @param {HTMLDivElement} toolsContent - Paragraph tools rendered view
     * @returns {ParagraphData} - saved data
     * @public
     */
    save(e) {
      return {
        text: e.innerHTML
      };
    }
    /**
     * On paste callback fired from Editor.
     *
     * @param {PasteEvent} event - event with pasted data
     */
    onPaste(e) {
      const t = {
        text: e.detail.data.innerHTML
      };
      this.data = t;
    }
    /**
     * Enable Conversion Toolbar. Paragraph can be converted to/from other tools
     */
    static get conversionConfig() {
      return {
        export: "text",
        // to convert Paragraph to other block, use 'text' property of saved data
        import: "text"
        // to covert other block's exported string to Paragraph, fill 'text' property of tool data
      };
    }
    /**
     * Sanitizer rules
     */
    static get sanitize() {
      return {
        text: {
          br: true
        }
      };
    }
    /**
     * Returns true to notify the core that read-only mode is supported
     *
     * @returns {boolean}
     */
    static get isReadOnlySupported() {
      return true;
    }
    /**
     * Get current Tools`s data
     *
     * @returns {ParagraphData} Current data
     * @private
     */
    get data() {
      if (this._element !== null) {
        const e = this._element.innerHTML;
        this._data.text = e;
      }
      return this._data;
    }
    /**
     * Store data in plugin:
     * - at the this._data property
     * - at the HTML
     *
     * @param {ParagraphData} data — data to set
     * @private
     */
    set data(e) {
      this._data = e || {}, this._element !== null && this.hydrate();
    }
    /**
     * Fill tool's view with data
     */
    hydrate() {
      window.requestAnimationFrame(() => {
        this._element.innerHTML = this._data.text || "";
      });
    }
    /**
     * Used by Editor paste handling API.
     * Provides configuration to handle P tags.
     *
     * @returns {{tags: string[]}}
     */
    static get pasteConfig() {
      return {
        tags: ["P"]
      };
    }
    /**
     * Icon and title for displaying at the Toolbox
     *
     * @returns {{icon: string, title: string}}
     */
    static get toolbox() {
      return {
        icon: hi,
        title: "Text"
      };
    }
  };
  var Xe = class {
    constructor() {
      this.commandName = "bold", this.CSS = {
        button: "ce-inline-tool",
        buttonActive: "ce-inline-tool--active",
        buttonModifier: "ce-inline-tool--bold"
      }, this.nodes = {
        button: void 0
      };
    }
    /**
     * Sanitizer Rule
     * Leave <b> tags
     *
     * @returns {object}
     */
    static get sanitize() {
      return {
        b: {}
      };
    }
    /**
     * Create button for Inline Toolbar
     */
    render() {
      return this.nodes.button = document.createElement("button"), this.nodes.button.type = "button", this.nodes.button.classList.add(this.CSS.button, this.CSS.buttonModifier), this.nodes.button.innerHTML = _o, this.nodes.button;
    }
    /**
     * Wrap range with <b> tag
     */
    surround() {
      document.execCommand(this.commandName);
    }
    /**
     * Check selection and set activated state to button if there are <b> tag
     *
     * @returns {boolean}
     */
    checkState() {
      const e = document.queryCommandState(this.commandName);
      return this.nodes.button.classList.toggle(this.CSS.buttonActive, e), e;
    }
    /**
     * Set a shortcut
     *
     * @returns {boolean}
     */
    get shortcut() {
      return "CMD+B";
    }
  };
  Xe.isInline = true;
  Xe.title = "Bold";
  var Ve = class {
    constructor() {
      this.commandName = "italic", this.CSS = {
        button: "ce-inline-tool",
        buttonActive: "ce-inline-tool--active",
        buttonModifier: "ce-inline-tool--italic"
      }, this.nodes = {
        button: null
      };
    }
    /**
     * Sanitizer Rule
     * Leave <i> tags
     *
     * @returns {object}
     */
    static get sanitize() {
      return {
        i: {}
      };
    }
    /**
     * Create button for Inline Toolbar
     */
    render() {
      return this.nodes.button = document.createElement("button"), this.nodes.button.type = "button", this.nodes.button.classList.add(this.CSS.button, this.CSS.buttonModifier), this.nodes.button.innerHTML = Do, this.nodes.button;
    }
    /**
     * Wrap range with <i> tag
     */
    surround() {
      document.execCommand(this.commandName);
    }
    /**
     * Check selection and set activated state to button if there are <i> tag
     */
    checkState() {
      const e = document.queryCommandState(this.commandName);
      return this.nodes.button.classList.toggle(this.CSS.buttonActive, e), e;
    }
    /**
     * Set a shortcut
     */
    get shortcut() {
      return "CMD+I";
    }
  };
  Ve.isInline = true;
  Ve.title = "Italic";
  var qe = class {
    /**
     * @param api - Editor.js API
     */
    constructor({ api: e }) {
      this.commandLink = "createLink", this.commandUnlink = "unlink", this.ENTER_KEY = 13, this.CSS = {
        button: "ce-inline-tool",
        buttonActive: "ce-inline-tool--active",
        buttonModifier: "ce-inline-tool--link",
        buttonUnlink: "ce-inline-tool--unlink",
        input: "ce-inline-tool-input",
        inputShowed: "ce-inline-tool-input--showed"
      }, this.nodes = {
        button: null,
        input: null
      }, this.inputOpened = false, this.toolbar = e.toolbar, this.inlineToolbar = e.inlineToolbar, this.notifier = e.notifier, this.i18n = e.i18n, this.selection = new b();
    }
    /**
     * Sanitizer Rule
     * Leave <a> tags
     *
     * @returns {object}
     */
    static get sanitize() {
      return {
        a: {
          href: true,
          target: "_blank",
          rel: "nofollow"
        }
      };
    }
    /**
     * Create button for Inline Toolbar
     */
    render() {
      return this.nodes.button = document.createElement("button"), this.nodes.button.type = "button", this.nodes.button.classList.add(this.CSS.button, this.CSS.buttonModifier), this.nodes.button.innerHTML = it, this.nodes.button;
    }
    /**
     * Input for the link
     */
    renderActions() {
      return this.nodes.input = document.createElement("input"), this.nodes.input.placeholder = this.i18n.t("Add a link"), this.nodes.input.classList.add(this.CSS.input), this.nodes.input.addEventListener("keydown", (e) => {
        e.keyCode === this.ENTER_KEY && this.enterPressed(e);
      }), this.nodes.input;
    }
    /**
     * Handle clicks on the Inline Toolbar icon
     *
     * @param {Range} range - range to wrap with link
     */
    surround(e) {
      if (e) {
        this.inputOpened ? (this.selection.restore(), this.selection.removeFakeBackground()) : (this.selection.setFakeBackground(), this.selection.save());
        const t = this.selection.findParentTag("A");
        if (t) {
          this.selection.expandToTag(t), this.unlink(), this.closeActions(), this.checkState(), this.toolbar.close();
          return;
        }
      }
      this.toggleActions();
    }
    /**
     * Check selection and set activated state to button if there are <a> tag
     */
    checkState() {
      const e = this.selection.findParentTag("A");
      if (e) {
        this.nodes.button.innerHTML = zo, this.nodes.button.classList.add(this.CSS.buttonUnlink), this.nodes.button.classList.add(this.CSS.buttonActive), this.openActions();
        const t = e.getAttribute("href");
        this.nodes.input.value = t !== "null" ? t : "", this.selection.save();
      } else
        this.nodes.button.innerHTML = it, this.nodes.button.classList.remove(this.CSS.buttonUnlink), this.nodes.button.classList.remove(this.CSS.buttonActive);
      return !!e;
    }
    /**
     * Function called with Inline Toolbar closing
     */
    clear() {
      this.closeActions();
    }
    /**
     * Set a shortcut
     */
    get shortcut() {
      return "CMD+K";
    }
    /**
     * Show/close link input
     */
    toggleActions() {
      this.inputOpened ? this.closeActions(false) : this.openActions(true);
    }
    /**
     * @param {boolean} needFocus - on link creation we need to focus input. On editing - nope.
     */
    openActions(e = false) {
      this.nodes.input.classList.add(this.CSS.inputShowed), e && this.nodes.input.focus(), this.inputOpened = true;
    }
    /**
     * Close input
     *
     * @param {boolean} clearSavedSelection — we don't need to clear saved selection
     *                                        on toggle-clicks on the icon of opened Toolbar
     */
    closeActions(e = true) {
      if (this.selection.isFakeBackgroundEnabled) {
        const t = new b();
        t.save(), this.selection.restore(), this.selection.removeFakeBackground(), t.restore();
      }
      this.nodes.input.classList.remove(this.CSS.inputShowed), this.nodes.input.value = "", e && this.selection.clearSaved(), this.inputOpened = false;
    }
    /**
     * Enter pressed on input
     *
     * @param {KeyboardEvent} event - enter keydown event
     */
    enterPressed(e) {
      let t = this.nodes.input.value || "";
      if (!t.trim()) {
        this.selection.restore(), this.unlink(), e.preventDefault(), this.closeActions();
        return;
      }
      if (!this.validateURL(t)) {
        this.notifier.show({
          message: "Pasted link is not valid.",
          style: "error"
        }), T("Incorrect Link pasted", "warn", t);
        return;
      }
      t = this.prepareLink(t), this.selection.restore(), this.selection.removeFakeBackground(), this.insertLink(t), e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation(), this.selection.collapseToEnd(), this.inlineToolbar.close();
    }
    /**
     * Detects if passed string is URL
     *
     * @param {string} str - string to validate
     * @returns {boolean}
     */
    validateURL(e) {
      return !/\s/.test(e);
    }
    /**
     * Process link before injection
     * - sanitize
     * - add protocol for links like 'google.com'
     *
     * @param {string} link - raw user input
     */
    prepareLink(e) {
      return e = e.trim(), e = this.addProtocol(e), e;
    }
    /**
     * Add 'http' protocol to the links like 'vc.ru', 'google.com'
     *
     * @param {string} link - string to process
     */
    addProtocol(e) {
      if (/^(\w+):(\/\/)?/.test(e))
        return e;
      const t = /^\/[^/\s]/.test(e), o3 = e.substring(0, 1) === "#", i2 = /^\/\/[^/\s]/.test(e);
      return !t && !o3 && !i2 && (e = "http://" + e), e;
    }
    /**
     * Inserts <a> tag with "href"
     *
     * @param {string} link - "href" value
     */
    insertLink(e) {
      const t = this.selection.findParentTag("A");
      t && this.selection.expandToTag(t), document.execCommand(this.commandLink, false, e);
    }
    /**
     * Removes <a> tag
     */
    unlink() {
      document.execCommand(this.commandUnlink);
    }
  };
  qe.isInline = true;
  qe.title = "Link";
  var St = class {
    /**
     * @param options - constructor options
     * @param options.data - stub tool data
     * @param options.api - Editor.js API
     */
    constructor({ data: e, api: t }) {
      this.CSS = {
        wrapper: "ce-stub",
        info: "ce-stub__info",
        title: "ce-stub__title",
        subtitle: "ce-stub__subtitle"
      }, this.api = t, this.title = e.title || this.api.i18n.t("Error"), this.subtitle = this.api.i18n.t("The block can not be displayed correctly."), this.savedData = e.savedData, this.wrapper = this.make();
    }
    /**
     * Returns stub holder
     *
     * @returns {HTMLElement}
     */
    render() {
      return this.wrapper;
    }
    /**
     * Return original Tool data
     *
     * @returns {BlockToolData}
     */
    save() {
      return this.savedData;
    }
    /**
     * Create Tool html markup
     *
     * @returns {HTMLElement}
     */
    make() {
      const e = c.make("div", this.CSS.wrapper), t = Uo, o3 = c.make("div", this.CSS.info), i2 = c.make("div", this.CSS.title, {
        textContent: this.title
      }), n2 = c.make("div", this.CSS.subtitle, {
        textContent: this.subtitle
      });
      return e.innerHTML = t, o3.appendChild(i2), o3.appendChild(n2), e.appendChild(o3), e;
    }
  };
  St.isReadOnlySupported = true;
  var ui = class extends Ye {
    constructor() {
      super(...arguments), this.type = Be.Inline;
    }
    /**
     * Returns title for Inline Tool if specified by user
     */
    get title() {
      return this.constructable[We.Title];
    }
    /**
     * Constructs new InlineTool instance from constructable
     */
    create() {
      return new this.constructable({
        api: this.api.getMethodsForTool(this),
        config: this.settings
      });
    }
  };
  var pi = class extends Ye {
    constructor() {
      super(...arguments), this.type = Be.Tune;
    }
    /**
     * Constructs new BlockTune instance from constructable
     *
     * @param data - Tune data
     * @param block - Block API object
     */
    create(e, t) {
      return new this.constructable({
        api: this.api.getMethodsForTool(this),
        config: this.settings,
        block: t,
        data: e
      });
    }
  };
  var P = class _P extends Map {
    /**
     * Returns Block Tools collection
     */
    get blockTools() {
      const e = Array.from(this.entries()).filter(([, t]) => t.isBlock());
      return new _P(e);
    }
    /**
     * Returns Inline Tools collection
     */
    get inlineTools() {
      const e = Array.from(this.entries()).filter(([, t]) => t.isInline());
      return new _P(e);
    }
    /**
     * Returns Block Tunes collection
     */
    get blockTunes() {
      const e = Array.from(this.entries()).filter(([, t]) => t.isTune());
      return new _P(e);
    }
    /**
     * Returns internal Tools collection
     */
    get internalTools() {
      const e = Array.from(this.entries()).filter(([, t]) => t.isInternal);
      return new _P(e);
    }
    /**
     * Returns Tools collection provided by user
     */
    get externalTools() {
      const e = Array.from(this.entries()).filter(([, t]) => !t.isInternal);
      return new _P(e);
    }
  };
  var fi = Object.defineProperty;
  var gi = Object.getOwnPropertyDescriptor;
  var It = (s, e, t, o3) => {
    for (var i2 = o3 > 1 ? void 0 : o3 ? gi(e, t) : e, n2 = s.length - 1, r2; n2 >= 0; n2--)
      (r2 = s[n2]) && (i2 = (o3 ? r2(e, t, i2) : r2(i2)) || i2);
    return o3 && i2 && fi(e, t, i2), i2;
  };
  var Ze = class extends Ye {
    constructor() {
      super(...arguments), this.type = Be.Block, this.inlineTools = new P(), this.tunes = new P();
    }
    /**
     * Creates new Tool instance
     *
     * @param data - Tool data
     * @param block - BlockAPI for current Block
     * @param readOnly - True if Editor is in read-only mode
     */
    create(e, t, o3) {
      return new this.constructable({
        data: e,
        block: t,
        readOnly: o3,
        api: this.api.getMethodsForTool(this),
        config: this.settings
      });
    }
    /**
     * Returns true if read-only mode is supported by Tool
     */
    get isReadOnlySupported() {
      return this.constructable[se.IsReadOnlySupported] === true;
    }
    /**
     * Returns true if Tool supports linebreaks
     */
    get isLineBreaksEnabled() {
      return this.constructable[se.IsEnabledLineBreaks];
    }
    /**
     * Returns Tool toolbox configuration (internal or user-specified).
     *
     * Merges internal and user-defined toolbox configs based on the following rules:
     *
     * - If both internal and user-defined toolbox configs are arrays their items are merged.
     * Length of the second one is kept.
     *
     * - If both are objects their properties are merged.
     *
     * - If one is an object and another is an array than internal config is replaced with user-defined
     * config. This is made to allow user to override default tool's toolbox representation (single/multiple entries)
     */
    get toolbox() {
      const e = this.constructable[se.Toolbox], t = this.config[ve.Toolbox];
      if (!W(e) && t !== false)
        return t ? Array.isArray(e) ? Array.isArray(t) ? t.map((o3, i2) => {
          const n2 = e[i2];
          return n2 ? {
            ...n2,
            ...o3
          } : o3;
        }) : [t] : Array.isArray(t) ? t : [
          {
            ...e,
            ...t
          }
        ] : Array.isArray(e) ? e : [e];
    }
    /**
     * Returns Tool conversion configuration
     */
    get conversionConfig() {
      return this.constructable[se.ConversionConfig];
    }
    /**
     * Returns enabled inline tools for Tool
     */
    get enabledInlineTools() {
      return this.config[ve.EnabledInlineTools] || false;
    }
    /**
     * Returns enabled tunes for Tool
     */
    get enabledBlockTunes() {
      return this.config[ve.EnabledBlockTunes];
    }
    /**
     * Returns Tool paste configuration
     */
    get pasteConfig() {
      return this.constructable[se.PasteConfig] ?? {};
    }
    get sanitizeConfig() {
      const e = super.sanitizeConfig, t = this.baseSanitizeConfig;
      if (W(e))
        return t;
      const o3 = {};
      for (const i2 in e)
        if (Object.prototype.hasOwnProperty.call(e, i2)) {
          const n2 = e[i2];
          D(n2) ? o3[i2] = Object.assign({}, t, n2) : o3[i2] = n2;
        }
      return o3;
    }
    get baseSanitizeConfig() {
      const e = {};
      return Array.from(this.inlineTools.values()).forEach((t) => Object.assign(e, t.sanitizeConfig)), Array.from(this.tunes.values()).forEach((t) => Object.assign(e, t.sanitizeConfig)), e;
    }
  };
  It([
    le
  ], Ze.prototype, "sanitizeConfig", 1);
  It([
    le
  ], Ze.prototype, "baseSanitizeConfig", 1);
  var bi = class {
    /**
     * @class
     * @param config - tools config
     * @param editorConfig - EditorJS config
     * @param api - EditorJS API module
     */
    constructor(e, t, o3) {
      this.api = o3, this.config = e, this.editorConfig = t;
    }
    /**
     * Returns Tool object based on it's type
     *
     * @param name - tool name
     */
    get(e) {
      const { class: t, isInternal: o3 = false, ...i2 } = this.config[e], n2 = this.getConstructor(t);
      return new n2({
        name: e,
        constructable: t,
        config: i2,
        api: this.api,
        isDefault: e === this.editorConfig.defaultBlock,
        defaultPlaceholder: this.editorConfig.placeholder,
        isInternal: o3
      });
    }
    /**
     * Find appropriate Tool object constructor for Tool constructable
     *
     * @param constructable - Tools constructable
     */
    getConstructor(e) {
      switch (true) {
        case e[We.IsInline]:
          return ui;
        case e[Bt.IsTune]:
          return pi;
        default:
          return Ze;
      }
    }
  };
  var Mt = class {
    /**
     * MoveDownTune constructor
     *
     * @param {API} api — Editor's API
     */
    constructor({ api: e }) {
      this.CSS = {
        animation: "wobble"
      }, this.api = e;
    }
    /**
     * Tune's appearance in block settings menu
     */
    render() {
      return {
        icon: kt,
        title: this.api.i18n.t("Move down"),
        onActivate: () => this.handleClick(),
        name: "move-down"
      };
    }
    /**
     * Handle clicks on 'move down' button
     */
    handleClick() {
      const e = this.api.blocks.getCurrentBlockIndex(), t = this.api.blocks.getBlockByIndex(e + 1);
      if (!t)
        throw new Error("Unable to move Block down since it is already the last");
      const o3 = t.holder, i2 = o3.getBoundingClientRect();
      let n2 = Math.abs(window.innerHeight - o3.offsetHeight);
      i2.top < window.innerHeight && (n2 = window.scrollY + o3.offsetHeight), window.scrollTo(0, n2), this.api.blocks.move(e + 1), this.api.toolbar.toggleBlockSettings(true);
    }
  };
  Mt.isTune = true;
  var Lt = class {
    /**
     * DeleteTune constructor
     *
     * @param {API} api - Editor's API
     */
    constructor({ api: e }) {
      this.api = e;
    }
    /**
     * Tune's appearance in block settings menu
     */
    render() {
      return {
        icon: No,
        title: this.api.i18n.t("Delete"),
        name: "delete",
        confirmation: {
          title: this.api.i18n.t("Click to delete"),
          onActivate: () => this.handleClick()
        }
      };
    }
    /**
     * Delete block conditions passed
     */
    handleClick() {
      this.api.blocks.delete();
    }
  };
  Lt.isTune = true;
  var At = class {
    /**
     * MoveUpTune constructor
     *
     * @param {API} api - Editor's API
     */
    constructor({ api: e }) {
      this.CSS = {
        animation: "wobble"
      }, this.api = e;
    }
    /**
     * Tune's appearance in block settings menu
     */
    render() {
      return {
        icon: Oo,
        title: this.api.i18n.t("Move up"),
        onActivate: () => this.handleClick(),
        name: "move-up"
      };
    }
    /**
     * Move current block up
     */
    handleClick() {
      const e = this.api.blocks.getCurrentBlockIndex(), t = this.api.blocks.getBlockByIndex(e), o3 = this.api.blocks.getBlockByIndex(e - 1);
      if (e === 0 || !t || !o3)
        throw new Error("Unable to move Block up since it is already the first");
      const i2 = t.holder, n2 = o3.holder, r2 = i2.getBoundingClientRect(), a4 = n2.getBoundingClientRect();
      let l4;
      a4.top > 0 ? l4 = Math.abs(r2.top) - Math.abs(a4.top) : l4 = Math.abs(r2.top) + a4.height, window.scrollBy(0, -1 * l4), this.api.blocks.move(e - 1), this.api.toolbar.toggleBlockSettings(true);
    }
  };
  At.isTune = true;
  var mi = Object.defineProperty;
  var ki = Object.getOwnPropertyDescriptor;
  var vi = (s, e, t, o3) => {
    for (var i2 = o3 > 1 ? void 0 : o3 ? ki(e, t) : e, n2 = s.length - 1, r2; n2 >= 0; n2--)
      (r2 = s[n2]) && (i2 = (o3 ? r2(e, t, i2) : r2(i2)) || i2);
    return o3 && i2 && mi(e, t, i2), i2;
  };
  var _t = class extends y {
    constructor() {
      super(...arguments), this.stubTool = "stub", this.toolsAvailable = new P(), this.toolsUnavailable = new P();
    }
    /**
     * Returns available Tools
     */
    get available() {
      return this.toolsAvailable;
    }
    /**
     * Returns unavailable Tools
     */
    get unavailable() {
      return this.toolsUnavailable;
    }
    /**
     * Return Tools for the Inline Toolbar
     */
    get inlineTools() {
      return this.available.inlineTools;
    }
    /**
     * Return editor block tools
     */
    get blockTools() {
      return this.available.blockTools;
    }
    /**
     * Return available Block Tunes
     *
     * @returns {object} - object of Inline Tool's classes
     */
    get blockTunes() {
      return this.available.blockTunes;
    }
    /**
     * Returns default Tool object
     */
    get defaultTool() {
      return this.blockTools.get(this.config.defaultBlock);
    }
    /**
     * Returns internal tools
     */
    get internal() {
      return this.available.internalTools;
    }
    /**
     * Creates instances via passed or default configuration
     *
     * @returns {Promise<void>}
     */
    async prepare() {
      if (this.validateTools(), this.config.tools = Me({}, this.internalTools, this.config.tools), !Object.prototype.hasOwnProperty.call(this.config, "tools") || Object.keys(this.config.tools).length === 0)
        throw Error("Can't start without tools");
      const e = this.prepareConfig();
      this.factory = new bi(e, this.config, this.Editor.API);
      const t = this.getListOfPrepareFunctions(e);
      if (t.length === 0)
        return Promise.resolve();
      await zt(t, (o3) => {
        this.toolPrepareMethodSuccess(o3);
      }, (o3) => {
        this.toolPrepareMethodFallback(o3);
      }), this.prepareBlockTools();
    }
    getAllInlineToolsSanitizeConfig() {
      const e = {};
      return Array.from(this.inlineTools.values()).forEach((t) => {
        Object.assign(e, t.sanitizeConfig);
      }), e;
    }
    /**
     * Calls each Tool reset method to clean up anything set by Tool
     */
    destroy() {
      Object.values(this.available).forEach(async (e) => {
        M(e.reset) && await e.reset();
      });
    }
    /**
     * Returns internal tools
     * Includes Bold, Italic, Link and Paragraph
     */
    get internalTools() {
      return {
        bold: {
          class: Xe,
          isInternal: true
        },
        italic: {
          class: Ve,
          isInternal: true
        },
        link: {
          class: qe,
          isInternal: true
        },
        paragraph: {
          class: Ke,
          inlineToolbar: true,
          isInternal: true
        },
        stub: {
          class: St,
          isInternal: true
        },
        moveUp: {
          class: At,
          isInternal: true
        },
        delete: {
          class: Lt,
          isInternal: true
        },
        moveDown: {
          class: Mt,
          isInternal: true
        }
      };
    }
    /**
     * Tool prepare method success callback
     *
     * @param {object} data - append tool to available list
     */
    toolPrepareMethodSuccess(e) {
      const t = this.factory.get(e.toolName);
      if (t.isInline()) {
        const i2 = ["render", "surround", "checkState"].filter((n2) => !t.create()[n2]);
        if (i2.length) {
          T(
            `Incorrect Inline Tool: ${t.name}. Some of required methods is not implemented %o`,
            "warn",
            i2
          ), this.toolsUnavailable.set(t.name, t);
          return;
        }
      }
      this.toolsAvailable.set(t.name, t);
    }
    /**
     * Tool prepare method fail callback
     *
     * @param {object} data - append tool to unavailable list
     */
    toolPrepareMethodFallback(e) {
      this.toolsUnavailable.set(e.toolName, this.factory.get(e.toolName));
    }
    /**
     * Binds prepare function of plugins with user or default config
     *
     * @returns {Array} list of functions that needs to be fired sequentially
     * @param config - tools config
     */
    getListOfPrepareFunctions(e) {
      const t = [];
      return Object.entries(e).forEach(([o3, i2]) => {
        t.push({
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          function: M(i2.class.prepare) ? i2.class.prepare : () => {
          },
          data: {
            toolName: o3,
            config: i2.config
          }
        });
      }), t;
    }
    /**
     * Assign enabled Inline Tools and Block Tunes for Block Tool
     */
    prepareBlockTools() {
      Array.from(this.blockTools.values()).forEach((e) => {
        this.assignInlineToolsToBlockTool(e), this.assignBlockTunesToBlockTool(e);
      });
    }
    /**
     * Assign enabled Inline Tools for Block Tool
     *
     * @param tool - Block Tool
     */
    assignInlineToolsToBlockTool(e) {
      if (this.config.inlineToolbar !== false) {
        if (e.enabledInlineTools === true) {
          e.inlineTools = new P(
            Array.isArray(this.config.inlineToolbar) ? this.config.inlineToolbar.map((t) => [t, this.inlineTools.get(t)]) : Array.from(this.inlineTools.entries())
          );
          return;
        }
        Array.isArray(e.enabledInlineTools) && (e.inlineTools = new P(
          e.enabledInlineTools.map((t) => [t, this.inlineTools.get(t)])
        ));
      }
    }
    /**
     * Assign enabled Block Tunes for Block Tool
     *
     * @param tool — Block Tool
     */
    assignBlockTunesToBlockTool(e) {
      if (e.enabledBlockTunes !== false) {
        if (Array.isArray(e.enabledBlockTunes)) {
          const t = new P(
            e.enabledBlockTunes.map((o3) => [o3, this.blockTunes.get(o3)])
          );
          e.tunes = new P([...t, ...this.blockTunes.internalTools]);
          return;
        }
        if (Array.isArray(this.config.tunes)) {
          const t = new P(
            this.config.tunes.map((o3) => [o3, this.blockTunes.get(o3)])
          );
          e.tunes = new P([...t, ...this.blockTunes.internalTools]);
          return;
        }
        e.tunes = this.blockTunes.internalTools;
      }
    }
    /**
     * Validate Tools configuration objects and throw Error for user if it is invalid
     */
    validateTools() {
      for (const e in this.config.tools)
        if (Object.prototype.hasOwnProperty.call(this.config.tools, e)) {
          if (e in this.internalTools)
            return;
          const t = this.config.tools[e];
          if (!M(t) && !M(t.class))
            throw Error(
              `Tool \xAB${e}\xBB must be a constructor function or an object with function in the \xABclass\xBB property`
            );
        }
    }
    /**
     * Unify tools config
     */
    prepareConfig() {
      const e = {};
      for (const t in this.config.tools)
        D(this.config.tools[t]) ? e[t] = this.config.tools[t] : e[t] = { class: this.config.tools[t] };
      return e;
    }
  };
  vi([
    le
  ], _t.prototype, "getAllInlineToolsSanitizeConfig", 1);
  var xi = `:root{--selectionColor: #e1f2ff;--inlineSelectionColor: #d4ecff;--bg-light: #eff2f5;--grayText: #707684;--color-dark: #1D202B;--color-active-icon: #388AE5;--color-gray-border: rgba(201, 201, 204, .48);--content-width: 650px;--narrow-mode-right-padding: 50px;--toolbox-buttons-size: 26px;--toolbox-buttons-size--mobile: 36px;--icon-size: 20px;--icon-size--mobile: 28px;--block-padding-vertical: .4em;--color-line-gray: #EFF0F1 }.codex-editor{position:relative;-webkit-box-sizing:border-box;box-sizing:border-box;z-index:1}.codex-editor .hide{display:none}.codex-editor__redactor [contenteditable]:empty:after{content:"\\feff"}@media (min-width: 651px){.codex-editor--narrow .codex-editor__redactor{margin-right:50px}}@media (min-width: 651px){.codex-editor--narrow.codex-editor--rtl .codex-editor__redactor{margin-left:50px;margin-right:0}}@media (min-width: 651px){.codex-editor--narrow .ce-toolbar__actions{right:-5px}}.codex-editor-copyable{position:absolute;height:1px;width:1px;top:-400%;opacity:.001}.codex-editor-overlay{position:fixed;top:0px;left:0px;right:0px;bottom:0px;z-index:999;pointer-events:none;overflow:hidden}.codex-editor-overlay__container{position:relative;pointer-events:auto;z-index:0}.codex-editor-overlay__rectangle{position:absolute;pointer-events:none;background-color:#2eaadc33;border:1px solid transparent}.codex-editor svg{max-height:100%}.codex-editor path{stroke:currentColor}.codex-editor ::-moz-selection{background-color:#d4ecff}.codex-editor ::selection{background-color:#d4ecff}.codex-editor--toolbox-opened [contentEditable=true][data-placeholder]:focus:before{opacity:0!important}.ce-scroll-locked{overflow:hidden}.ce-scroll-locked--hard{overflow:hidden;top:calc(-1 * var(--window-scroll-offset));position:fixed;width:100%}.ce-toolbar{position:absolute;left:0;right:0;top:0;-webkit-transition:opacity .1s ease;transition:opacity .1s ease;will-change:opacity,top;display:none}.ce-toolbar--opened{display:block}.ce-toolbar__content{max-width:650px;margin:0 auto;position:relative}.ce-toolbar__plus{color:#1d202b;cursor:pointer;width:26px;height:26px;border-radius:7px;display:-webkit-inline-box;display:-ms-inline-flexbox;display:inline-flex;-webkit-box-pack:center;-ms-flex-pack:center;justify-content:center;-webkit-box-align:center;-ms-flex-align:center;align-items:center;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;-ms-flex-negative:0;flex-shrink:0}@media (max-width: 650px){.ce-toolbar__plus{width:36px;height:36px}}@media (hover: hover){.ce-toolbar__plus:hover{background-color:#eff2f5}}.ce-toolbar__plus--active{background-color:#eff2f5;-webkit-animation:bounceIn .75s 1;animation:bounceIn .75s 1;-webkit-animation-fill-mode:forwards;animation-fill-mode:forwards}.ce-toolbar__plus-shortcut{opacity:.6;word-spacing:-2px;margin-top:5px}@media (max-width: 650px){.ce-toolbar__plus{position:absolute;background-color:#fff;border:1px solid #E8E8EB;-webkit-box-shadow:0 3px 15px -3px rgba(13,20,33,.13);box-shadow:0 3px 15px -3px #0d142121;border-radius:6px;z-index:2;position:static}.ce-toolbar__plus--left-oriented:before{left:15px;margin-left:0}.ce-toolbar__plus--right-oriented:before{left:auto;right:15px;margin-left:0}}.ce-toolbar__actions{position:absolute;right:100%;opacity:0;display:-webkit-box;display:-ms-flexbox;display:flex;padding-right:5px}.ce-toolbar__actions--opened{opacity:1}@media (max-width: 650px){.ce-toolbar__actions{right:auto}}.ce-toolbar__settings-btn{color:#1d202b;width:26px;height:26px;border-radius:7px;display:-webkit-inline-box;display:-ms-inline-flexbox;display:inline-flex;-webkit-box-pack:center;-ms-flex-pack:center;justify-content:center;-webkit-box-align:center;-ms-flex-align:center;align-items:center;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;margin-left:3px;cursor:pointer;user-select:none}@media (max-width: 650px){.ce-toolbar__settings-btn{width:36px;height:36px}}@media (hover: hover){.ce-toolbar__settings-btn:hover{background-color:#eff2f5}}.ce-toolbar__settings-btn--active{background-color:#eff2f5;-webkit-animation:bounceIn .75s 1;animation:bounceIn .75s 1;-webkit-animation-fill-mode:forwards;animation-fill-mode:forwards}@media (min-width: 651px){.ce-toolbar__settings-btn{width:24px}}.ce-toolbar__settings-btn--hidden{display:none}@media (max-width: 650px){.ce-toolbar__settings-btn{position:absolute;background-color:#fff;border:1px solid #E8E8EB;-webkit-box-shadow:0 3px 15px -3px rgba(13,20,33,.13);box-shadow:0 3px 15px -3px #0d142121;border-radius:6px;z-index:2;position:static}.ce-toolbar__settings-btn--left-oriented:before{left:15px;margin-left:0}.ce-toolbar__settings-btn--right-oriented:before{left:auto;right:15px;margin-left:0}}.ce-toolbar__plus svg,.ce-toolbar__settings-btn svg{width:24px;height:24px}@media (min-width: 651px){.codex-editor--narrow .ce-toolbar__plus{left:5px}}@media (min-width: 651px){.codex-editor--narrow .ce-toolbox .ce-popover{right:0;left:auto;left:initial}}.ce-inline-toolbar{--y-offset: 8px;position:absolute;background-color:#fff;border:1px solid #E8E8EB;-webkit-box-shadow:0 3px 15px -3px rgba(13,20,33,.13);box-shadow:0 3px 15px -3px #0d142121;border-radius:6px;z-index:2;opacity:0;visibility:hidden;-webkit-transition:opacity .25s ease;transition:opacity .25s ease;will-change:opacity,left,top;top:0;left:0;z-index:3}.ce-inline-toolbar--left-oriented:before{left:15px;margin-left:0}.ce-inline-toolbar--right-oriented:before{left:auto;right:15px;margin-left:0}.ce-inline-toolbar--showed{opacity:1;visibility:visible}.ce-inline-toolbar [hidden]{display:none!important}.ce-inline-toolbar__toggler-and-button-wrapper{display:-webkit-box;display:-ms-flexbox;display:flex;width:100%;padding:0 6px}.ce-inline-toolbar__buttons{display:-webkit-box;display:-ms-flexbox;display:flex}.ce-inline-toolbar__dropdown{display:-webkit-box;display:-ms-flexbox;display:flex;padding:6px;margin:0 6px 0 -6px;-webkit-box-align:center;-ms-flex-align:center;align-items:center;cursor:pointer;border-right:1px solid rgba(201,201,204,.48);-webkit-box-sizing:border-box;box-sizing:border-box}@media (hover: hover){.ce-inline-toolbar__dropdown:hover{background:#eff2f5}}.ce-inline-toolbar__dropdown--hidden{display:none}.ce-inline-toolbar__dropdown-content,.ce-inline-toolbar__dropdown-arrow{display:-webkit-box;display:-ms-flexbox;display:flex}.ce-inline-toolbar__dropdown-content svg,.ce-inline-toolbar__dropdown-arrow svg{width:20px;height:20px}.ce-inline-toolbar__shortcut{opacity:.6;word-spacing:-3px;margin-top:3px}.ce-inline-tool{display:-webkit-inline-box;display:-ms-inline-flexbox;display:inline-flex;-webkit-box-align:center;-ms-flex-align:center;align-items:center;-webkit-box-pack:center;-ms-flex-pack:center;justify-content:center;padding:6px 1px;cursor:pointer;border:0;outline:none;background-color:transparent;vertical-align:bottom;color:inherit;margin:0;border-radius:0;line-height:normal}.ce-inline-tool svg{width:20px;height:20px}@media (max-width: 650px){.ce-inline-tool svg{width:28px;height:28px}}@media (hover: hover){.ce-inline-tool:hover{background-color:#eff2f5}}.ce-inline-tool--active{color:#388ae5}.ce-inline-tool--focused{background:rgba(34,186,255,.08)!important}.ce-inline-tool--focused{-webkit-box-shadow:inset 0 0 0px 1px rgba(7,161,227,.08);box-shadow:inset 0 0 0 1px #07a1e314}.ce-inline-tool--focused-animated{-webkit-animation-name:buttonClicked;animation-name:buttonClicked;-webkit-animation-duration:.25s;animation-duration:.25s}.ce-inline-tool--link .icon--unlink,.ce-inline-tool--unlink .icon--link{display:none}.ce-inline-tool--unlink .icon--unlink{display:inline-block;margin-bottom:-1px}.ce-inline-tool-input{outline:none;border:0;border-radius:0 0 4px 4px;margin:0;font-size:13px;padding:10px;width:100%;-webkit-box-sizing:border-box;box-sizing:border-box;display:none;font-weight:500;border-top:1px solid rgba(201,201,204,.48);-webkit-appearance:none;font-family:inherit}@media (max-width: 650px){.ce-inline-tool-input{font-size:15px;font-weight:500}}.ce-inline-tool-input::-webkit-input-placeholder{color:#707684}.ce-inline-tool-input::-moz-placeholder{color:#707684}.ce-inline-tool-input:-ms-input-placeholder{color:#707684}.ce-inline-tool-input::-ms-input-placeholder{color:#707684}.ce-inline-tool-input::placeholder{color:#707684}.ce-inline-tool-input--showed{display:block}.ce-conversion-toolbar{position:absolute;background-color:#fff;border:1px solid #E8E8EB;-webkit-box-shadow:0 3px 15px -3px rgba(13,20,33,.13);box-shadow:0 3px 15px -3px #0d142121;border-radius:6px;z-index:2;opacity:0;visibility:hidden;will-change:transform,opacity;-webkit-transition:opacity .1s ease,-webkit-transform .1s ease;transition:opacity .1s ease,-webkit-transform .1s ease;transition:transform .1s ease,opacity .1s ease;transition:transform .1s ease,opacity .1s ease,-webkit-transform .1s ease;-webkit-transform:translateY(-8px);transform:translateY(-8px);left:-1px;width:190px;margin-top:5px;-webkit-box-sizing:content-box;box-sizing:content-box}.ce-conversion-toolbar--left-oriented:before{left:15px;margin-left:0}.ce-conversion-toolbar--right-oriented:before{left:auto;right:15px;margin-left:0}.ce-conversion-toolbar--showed{opacity:1;visibility:visible;-webkit-transform:none;transform:none}.ce-conversion-toolbar [hidden]{display:none!important}.ce-conversion-toolbar__buttons{display:-webkit-box;display:-ms-flexbox;display:flex}.ce-conversion-toolbar__label{color:#707684;font-size:11px;font-weight:500;letter-spacing:.33px;padding:10px 10px 5px;text-transform:uppercase}.ce-conversion-tool{display:-webkit-box;display:-ms-flexbox;display:flex;padding:5px 10px;font-size:14px;line-height:20px;font-weight:500;cursor:pointer;-webkit-box-align:center;-ms-flex-align:center;align-items:center}.ce-conversion-tool--hidden{display:none}.ce-conversion-tool--focused{background:rgba(34,186,255,.08)!important}.ce-conversion-tool--focused{-webkit-box-shadow:inset 0 0 0px 1px rgba(7,161,227,.08);box-shadow:inset 0 0 0 1px #07a1e314}.ce-conversion-tool--focused-animated{-webkit-animation-name:buttonClicked;animation-name:buttonClicked;-webkit-animation-duration:.25s;animation-duration:.25s}.ce-conversion-tool:hover{background:#eff2f5}.ce-conversion-tool__icon{display:-webkit-inline-box;display:-ms-inline-flexbox;display:inline-flex;width:26px;height:26px;-webkit-box-shadow:0 0 0 1px rgba(201,201,204,.48);box-shadow:0 0 0 1px #c9c9cc7a;border-radius:5px;-webkit-box-align:center;-ms-flex-align:center;align-items:center;-webkit-box-pack:center;-ms-flex-pack:center;justify-content:center;background:#fff;-webkit-box-sizing:content-box;box-sizing:content-box;-ms-flex-negative:0;flex-shrink:0;margin-right:10px}.ce-conversion-tool__icon svg{width:20px;height:20px}@media (max-width: 650px){.ce-conversion-tool__icon{width:36px;height:36px;border-radius:8px}.ce-conversion-tool__icon svg{width:28px;height:28px}}.ce-conversion-tool--last{margin-right:0!important}.ce-conversion-tool--active{color:#388ae5!important}.ce-conversion-tool--active{-webkit-animation:bounceIn .75s 1;animation:bounceIn .75s 1;-webkit-animation-fill-mode:forwards;animation-fill-mode:forwards}.ce-conversion-tool__secondary-label{color:#707684;font-size:12px;margin-left:auto;white-space:nowrap;letter-spacing:-.1em;padding-right:5px;margin-bottom:-2px;opacity:.6}@media (max-width: 650px){.ce-conversion-tool__secondary-label{display:none}}.ce-settings__button{display:-webkit-inline-box;display:-ms-inline-flexbox;display:inline-flex;-webkit-box-align:center;-ms-flex-align:center;align-items:center;-webkit-box-pack:center;-ms-flex-pack:center;justify-content:center;padding:6px 1px;border-radius:3px;cursor:pointer;border:0;outline:none;background-color:transparent;vertical-align:bottom;color:inherit;margin:0;line-height:32px}.ce-settings__button svg{width:20px;height:20px}@media (max-width: 650px){.ce-settings__button svg{width:28px;height:28px}}@media (hover: hover){.ce-settings__button:hover{background-color:#eff2f5}}.ce-settings__button--active{color:#388ae5}.ce-settings__button--focused{background:rgba(34,186,255,.08)!important}.ce-settings__button--focused{-webkit-box-shadow:inset 0 0 0px 1px rgba(7,161,227,.08);box-shadow:inset 0 0 0 1px #07a1e314}.ce-settings__button--focused-animated{-webkit-animation-name:buttonClicked;animation-name:buttonClicked;-webkit-animation-duration:.25s;animation-duration:.25s}.ce-settings__button:not(:nth-child(3n+3)){margin-right:3px}.ce-settings__button:nth-child(n+4){margin-top:3px}.ce-settings__button--disabled{cursor:not-allowed!important}.ce-settings__button--disabled{opacity:.3}.ce-settings__button--selected{color:#388ae5}@media (min-width: 651px){.codex-editor--narrow .ce-settings .ce-popover{right:0;left:auto;left:initial}}@-webkit-keyframes fade-in{0%{opacity:0}to{opacity:1}}@keyframes fade-in{0%{opacity:0}to{opacity:1}}.ce-block{-webkit-animation:fade-in .3s ease;animation:fade-in .3s ease;-webkit-animation-fill-mode:none;animation-fill-mode:none;-webkit-animation-fill-mode:initial;animation-fill-mode:initial}.ce-block:first-of-type{margin-top:0}.ce-block--selected .ce-block__content{background:#e1f2ff}.ce-block--selected .ce-block__content [contenteditable]{-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none}.ce-block--selected .ce-block__content img,.ce-block--selected .ce-block__content .ce-stub{opacity:.55}.ce-block--stretched .ce-block__content{max-width:none}.ce-block__content{position:relative;max-width:650px;margin:0 auto;-webkit-transition:background-color .15s ease;transition:background-color .15s ease}.ce-block--drop-target .ce-block__content:before{content:"";position:absolute;top:100%;left:-20px;margin-top:-1px;height:8px;width:8px;border:solid #388AE5;border-width:1px 1px 0 0;-webkit-transform-origin:right;transform-origin:right;-webkit-transform:rotate(45deg);transform:rotate(45deg)}.ce-block--drop-target .ce-block__content:after{content:"";position:absolute;top:100%;height:1px;width:100%;color:#388ae5;background:repeating-linear-gradient(90deg,#388AE5,#388AE5 1px,#fff 1px,#fff 6px)}.ce-block a{cursor:pointer;-webkit-text-decoration:underline;text-decoration:underline}.ce-block b{font-weight:700}.ce-block i{font-style:italic}@-webkit-keyframes bounceIn{0%,20%,40%,60%,80%,to{-webkit-animation-timing-function:cubic-bezier(.215,.61,.355,1);animation-timing-function:cubic-bezier(.215,.61,.355,1)}0%{-webkit-transform:scale3d(.9,.9,.9);transform:scale3d(.9,.9,.9)}20%{-webkit-transform:scale3d(1.03,1.03,1.03);transform:scale3d(1.03,1.03,1.03)}60%{-webkit-transform:scale3d(1,1,1);transform:scaleZ(1)}}@keyframes bounceIn{0%,20%,40%,60%,80%,to{-webkit-animation-timing-function:cubic-bezier(.215,.61,.355,1);animation-timing-function:cubic-bezier(.215,.61,.355,1)}0%{-webkit-transform:scale3d(.9,.9,.9);transform:scale3d(.9,.9,.9)}20%{-webkit-transform:scale3d(1.03,1.03,1.03);transform:scale3d(1.03,1.03,1.03)}60%{-webkit-transform:scale3d(1,1,1);transform:scaleZ(1)}}@-webkit-keyframes selectionBounce{0%,20%,40%,60%,80%,to{-webkit-animation-timing-function:cubic-bezier(.215,.61,.355,1);animation-timing-function:cubic-bezier(.215,.61,.355,1)}50%{-webkit-transform:scale3d(1.01,1.01,1.01);transform:scale3d(1.01,1.01,1.01)}70%{-webkit-transform:scale3d(1,1,1);transform:scaleZ(1)}}@keyframes selectionBounce{0%,20%,40%,60%,80%,to{-webkit-animation-timing-function:cubic-bezier(.215,.61,.355,1);animation-timing-function:cubic-bezier(.215,.61,.355,1)}50%{-webkit-transform:scale3d(1.01,1.01,1.01);transform:scale3d(1.01,1.01,1.01)}70%{-webkit-transform:scale3d(1,1,1);transform:scaleZ(1)}}@-webkit-keyframes buttonClicked{0%,20%,40%,60%,80%,to{-webkit-animation-timing-function:cubic-bezier(.215,.61,.355,1);animation-timing-function:cubic-bezier(.215,.61,.355,1)}0%{-webkit-transform:scale3d(.95,.95,.95);transform:scale3d(.95,.95,.95)}60%{-webkit-transform:scale3d(1.02,1.02,1.02);transform:scale3d(1.02,1.02,1.02)}80%{-webkit-transform:scale3d(1,1,1);transform:scaleZ(1)}}@keyframes buttonClicked{0%,20%,40%,60%,80%,to{-webkit-animation-timing-function:cubic-bezier(.215,.61,.355,1);animation-timing-function:cubic-bezier(.215,.61,.355,1)}0%{-webkit-transform:scale3d(.95,.95,.95);transform:scale3d(.95,.95,.95)}60%{-webkit-transform:scale3d(1.02,1.02,1.02);transform:scale3d(1.02,1.02,1.02)}80%{-webkit-transform:scale3d(1,1,1);transform:scaleZ(1)}}.cdx-block{padding:.4em 0}.cdx-block::-webkit-input-placeholder{line-height:normal!important}.cdx-input{border:1px solid rgba(201,201,204,.48);-webkit-box-shadow:inset 0 1px 2px 0 rgba(35,44,72,.06);box-shadow:inset 0 1px 2px #232c480f;border-radius:3px;padding:10px 12px;outline:none;width:100%;-webkit-box-sizing:border-box;box-sizing:border-box}.cdx-input[data-placeholder]:before{position:static!important}.cdx-input[data-placeholder]:before{display:inline-block;width:0;white-space:nowrap;pointer-events:none}.cdx-settings-button{display:-webkit-inline-box;display:-ms-inline-flexbox;display:inline-flex;-webkit-box-align:center;-ms-flex-align:center;align-items:center;-webkit-box-pack:center;-ms-flex-pack:center;justify-content:center;padding:6px 1px;border-radius:3px;cursor:pointer;border:0;outline:none;background-color:transparent;vertical-align:bottom;color:inherit;margin:0;min-width:26px;min-height:26px}.cdx-settings-button svg{width:20px;height:20px}@media (max-width: 650px){.cdx-settings-button svg{width:28px;height:28px}}@media (hover: hover){.cdx-settings-button:hover{background-color:#eff2f5}}.cdx-settings-button--focused{background:rgba(34,186,255,.08)!important}.cdx-settings-button--focused{-webkit-box-shadow:inset 0 0 0px 1px rgba(7,161,227,.08);box-shadow:inset 0 0 0 1px #07a1e314}.cdx-settings-button--focused-animated{-webkit-animation-name:buttonClicked;animation-name:buttonClicked;-webkit-animation-duration:.25s;animation-duration:.25s}.cdx-settings-button--active{color:#388ae5}.cdx-settings-button svg{width:auto;height:auto}@media (max-width: 650px){.cdx-settings-button{width:36px;height:36px;border-radius:8px}}.cdx-loader{position:relative;border:1px solid rgba(201,201,204,.48)}.cdx-loader:before{content:"";position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-11px 0 0 -11px;border:2px solid rgba(201,201,204,.48);border-left-color:#388ae5;border-radius:50%;-webkit-animation:cdxRotation 1.2s infinite linear;animation:cdxRotation 1.2s infinite linear}@-webkit-keyframes cdxRotation{0%{-webkit-transform:rotate(0deg);transform:rotate(0)}to{-webkit-transform:rotate(360deg);transform:rotate(360deg)}}@keyframes cdxRotation{0%{-webkit-transform:rotate(0deg);transform:rotate(0)}to{-webkit-transform:rotate(360deg);transform:rotate(360deg)}}.cdx-button{padding:13px;border-radius:3px;border:1px solid rgba(201,201,204,.48);font-size:14.9px;background:#fff;-webkit-box-shadow:0 2px 2px 0 rgba(18,30,57,.04);box-shadow:0 2px 2px #121e390a;color:#707684;text-align:center;cursor:pointer}@media (hover: hover){.cdx-button:hover{background:#FBFCFE;-webkit-box-shadow:0 1px 3px 0 rgba(18,30,57,.08);box-shadow:0 1px 3px #121e3914}}.cdx-button svg{height:20px;margin-right:.2em;margin-top:-2px}.ce-stub{display:-webkit-box;display:-ms-flexbox;display:flex;-webkit-box-align:center;-ms-flex-align:center;align-items:center;padding:12px 18px;margin:10px 0;border-radius:10px;background:#eff2f5;border:1px solid #EFF0F1;color:#707684;font-size:14px}.ce-stub svg{width:20px;height:20px}.ce-stub__info{margin-left:14px}.ce-stub__title{font-weight:500;text-transform:capitalize}.codex-editor.codex-editor--rtl{direction:rtl}.codex-editor.codex-editor--rtl .cdx-list{padding-left:0;padding-right:40px}.codex-editor.codex-editor--rtl .ce-toolbar__plus{right:-26px;left:auto}.codex-editor.codex-editor--rtl .ce-toolbar__actions{right:auto;left:-26px}@media (max-width: 650px){.codex-editor.codex-editor--rtl .ce-toolbar__actions{margin-left:0;margin-right:auto;padding-right:0;padding-left:10px}}.codex-editor.codex-editor--rtl .ce-settings{left:5px;right:auto}.codex-editor.codex-editor--rtl .ce-settings:before{right:auto;left:25px}.codex-editor.codex-editor--rtl .ce-settings__button:not(:nth-child(3n+3)){margin-left:3px;margin-right:0}.codex-editor.codex-editor--rtl .ce-conversion-tool__icon{margin-right:0;margin-left:10px}.codex-editor.codex-editor--rtl .ce-inline-toolbar__dropdown{border-right:0px solid transparent;border-left:1px solid rgba(201,201,204,.48);margin:0 -6px 0 6px}.codex-editor.codex-editor--rtl .ce-inline-toolbar__dropdown .icon--toggler-down{margin-left:0;margin-right:4px}@media (min-width: 651px){.codex-editor--narrow.codex-editor--rtl .ce-toolbar__plus{left:0px;right:5px}}@media (min-width: 651px){.codex-editor--narrow.codex-editor--rtl .ce-toolbar__actions{left:-5px}}.cdx-search-field{--icon-margin-right: 10px;background:rgba(232,232,235,.49);border:1px solid rgba(226,226,229,.2);border-radius:6px;padding:2px;display:grid;grid-template-columns:auto auto 1fr;grid-template-rows:auto}.cdx-search-field__icon{width:26px;height:26px;display:-webkit-box;display:-ms-flexbox;display:flex;-webkit-box-align:center;-ms-flex-align:center;align-items:center;-webkit-box-pack:center;-ms-flex-pack:center;justify-content:center;margin-right:var(--icon-margin-right)}.cdx-search-field__icon svg{width:20px;height:20px;color:#707684}.cdx-search-field__input{font-size:14px;outline:none;font-weight:500;font-family:inherit;border:0;background:transparent;margin:0;padding:0;line-height:22px;min-width:calc(100% - 26px - var(--icon-margin-right))}.cdx-search-field__input::-webkit-input-placeholder{color:#707684;font-weight:500}.cdx-search-field__input::-moz-placeholder{color:#707684;font-weight:500}.cdx-search-field__input:-ms-input-placeholder{color:#707684;font-weight:500}.cdx-search-field__input::-ms-input-placeholder{color:#707684;font-weight:500}.cdx-search-field__input::placeholder{color:#707684;font-weight:500}.ce-popover{--border-radius: 6px;--width: 200px;--max-height: 270px;--padding: 6px;--offset-from-target: 8px;--color-border: #e8e8eb;--color-shadow: rgba(13,20,33,.13);--color-background: white;--color-text-primary: black;--color-text-secondary: #707684;--color-border-icon: rgba(201, 201, 204, .48);--color-border-icon-disabled: #EFF0F1;--color-text-icon-active: #388AE5;--color-background-icon-active: rgba(56, 138, 229, .1);--color-background-item-focus: rgba(34, 186, 255, .08);--color-shadow-item-focus: rgba(7, 161, 227, .08);--color-background-item-hover: #eff2f5;--color-background-item-confirm: #E24A4A;--color-background-item-confirm-hover: #CE4343;min-width:var(--width);width:var(--width);max-height:var(--max-height);border-radius:var(--border-radius);overflow:hidden;-webkit-box-sizing:border-box;box-sizing:border-box;-webkit-box-shadow:0 3px 15px -3px var(--color-shadow);box-shadow:0 3px 15px -3px var(--color-shadow);position:absolute;left:0;top:calc(100% + var(--offset-from-target));background:var(--color-background);display:-webkit-box;display:-ms-flexbox;display:flex;-webkit-box-orient:vertical;-webkit-box-direction:normal;-ms-flex-direction:column;flex-direction:column;z-index:4;opacity:0;max-height:0;pointer-events:none;padding:0;border:none}.ce-popover--opened{opacity:1;padding:var(--padding);max-height:var(--max-height);pointer-events:auto;-webkit-animation:panelShowing .1s ease;animation:panelShowing .1s ease;border:1px solid var(--color-border)}@media (max-width: 650px){.ce-popover--opened{-webkit-animation:panelShowingMobile .25s ease;animation:panelShowingMobile .25s ease}}.ce-popover__items{overflow-y:auto;-ms-scroll-chaining:none;overscroll-behavior:contain}@media (max-width: 650px){.ce-popover__overlay{position:fixed;top:0;bottom:0;left:0;right:0;background:#1D202B;z-index:3;opacity:.5;-webkit-transition:opacity .12s ease-in;transition:opacity .12s ease-in;will-change:opacity;visibility:visible}}.ce-popover__overlay--hidden{display:none}.ce-popover--open-top{top:calc(-1 * (var(--offset-from-target) + var(--popover-height)))}@media (max-width: 650px){.ce-popover{--offset: 5px;position:fixed;max-width:none;min-width:calc(100% - var(--offset) * 2);left:var(--offset);right:var(--offset);bottom:calc(var(--offset) + env(safe-area-inset-bottom));top:auto;border-radius:10px}.ce-popover .ce-popover__search{display:none}}.ce-popover__search,.ce-popover__custom-content:not(:empty){margin-bottom:5px}.ce-popover__nothing-found-message{color:#707684;display:none;cursor:default;padding:3px;font-size:14px;line-height:20px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ce-popover__nothing-found-message--displayed{display:block}.ce-popover__custom-content:not(:empty){padding:4px}@media (min-width: 651px){.ce-popover__custom-content:not(:empty){padding:0}}.ce-popover__custom-content--hidden{display:none}.ce-popover-item{--border-radius: 6px;--icon-size: 20px;--icon-size-mobile: 28px;border-radius:var(--border-radius);display:-webkit-box;display:-ms-flexbox;display:flex;-webkit-box-align:center;-ms-flex-align:center;align-items:center;padding:3px;color:var(--color-text-primary);-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none}@media (max-width: 650px){.ce-popover-item{padding:4px}}.ce-popover-item:not(:last-of-type){margin-bottom:1px}.ce-popover-item__icon{border-radius:5px;width:26px;height:26px;-webkit-box-shadow:0 0 0 1px var(--color-border-icon);box-shadow:0 0 0 1px var(--color-border-icon);background:#fff;display:-webkit-box;display:-ms-flexbox;display:flex;-webkit-box-align:center;-ms-flex-align:center;align-items:center;-webkit-box-pack:center;-ms-flex-pack:center;justify-content:center;margin-right:10px}.ce-popover-item__icon svg{width:20px;height:20px}@media (max-width: 650px){.ce-popover-item__icon{width:36px;height:36px;border-radius:8px}.ce-popover-item__icon svg{width:var(--icon-size-mobile);height:var(--icon-size-mobile)}}.ce-popover-item__title{font-size:14px;line-height:20px;font-weight:500;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}@media (max-width: 650px){.ce-popover-item__title{font-size:16px}}.ce-popover-item__secondary-title{color:var(--color-text-secondary);font-size:12px;margin-left:auto;white-space:nowrap;letter-spacing:-.1em;padding-right:5px;margin-bottom:-2px;opacity:.6}@media (max-width: 650px){.ce-popover-item__secondary-title{display:none}}.ce-popover-item--active{background:var(--color-background-icon-active);color:var(--color-text-icon-active)}.ce-popover-item--active .ce-popover-item__icon{-webkit-box-shadow:none;box-shadow:none}.ce-popover-item--disabled{color:var(--color-text-secondary);cursor:default;pointer-events:none}.ce-popover-item--disabled .ce-popover-item__icon{-webkit-box-shadow:0 0 0 1px var(--color-border-icon-disabled);box-shadow:0 0 0 1px var(--color-border-icon-disabled)}.ce-popover-item--focused:not(.ce-popover-item--no-focus){background:var(--color-background-item-focus)!important}.ce-popover-item--focused:not(.ce-popover-item--no-focus){-webkit-box-shadow:inset 0 0 0px 1px var(--color-shadow-item-focus);box-shadow:inset 0 0 0 1px var(--color-shadow-item-focus)}.ce-popover-item--hidden{display:none}@media (hover: hover){.ce-popover-item:hover{cursor:pointer}.ce-popover-item:hover:not(.ce-popover-item--no-hover){background-color:var(--color-background-item-hover)}.ce-popover-item:hover .ce-popover-item__icon{-webkit-box-shadow:none;box-shadow:none}}.ce-popover-item--confirmation{background:var(--color-background-item-confirm)}.ce-popover-item--confirmation .ce-popover-item__icon{color:var(--color-background-item-confirm)}.ce-popover-item--confirmation .ce-popover-item__title{color:#fff}@media (hover: hover){.ce-popover-item--confirmation:not(.ce-popover-item--no-hover):hover{background:var(--color-background-item-confirm-hover)}}.ce-popover-item--confirmation:not(.ce-popover-item--no-focus).ce-popover-item--focused{background:var(--color-background-item-confirm-hover)!important}.ce-popover-item--confirmation .ce-popover-item__icon,.ce-popover-item--active .ce-popover-item__icon,.ce-popover-item--focused .ce-popover-item__icon{-webkit-box-shadow:none;box-shadow:none}@-webkit-keyframes panelShowing{0%{opacity:0;-webkit-transform:translateY(-8px) scale(.9);transform:translateY(-8px) scale(.9)}70%{opacity:1;-webkit-transform:translateY(2px);transform:translateY(2px)}to{-webkit-transform:translateY(0);transform:translateY(0)}}@keyframes panelShowing{0%{opacity:0;-webkit-transform:translateY(-8px) scale(.9);transform:translateY(-8px) scale(.9)}70%{opacity:1;-webkit-transform:translateY(2px);transform:translateY(2px)}to{-webkit-transform:translateY(0);transform:translateY(0)}}@-webkit-keyframes panelShowingMobile{0%{opacity:0;-webkit-transform:translateY(14px) scale(.98);transform:translateY(14px) scale(.98)}70%{opacity:1;-webkit-transform:translateY(-4px);transform:translateY(-4px)}to{-webkit-transform:translateY(0);transform:translateY(0)}}@keyframes panelShowingMobile{0%{opacity:0;-webkit-transform:translateY(14px) scale(.98);transform:translateY(14px) scale(.98)}70%{opacity:1;-webkit-transform:translateY(-4px);transform:translateY(-4px)}to{-webkit-transform:translateY(0);transform:translateY(0)}}.wobble{-webkit-animation-name:wobble;animation-name:wobble;-webkit-animation-duration:.4s;animation-duration:.4s}@-webkit-keyframes wobble{0%{-webkit-transform:translate3d(0,0,0);transform:translateZ(0)}15%{-webkit-transform:translate3d(-9%,0,0);transform:translate3d(-9%,0,0)}30%{-webkit-transform:translate3d(9%,0,0);transform:translate3d(9%,0,0)}45%{-webkit-transform:translate3d(-4%,0,0);transform:translate3d(-4%,0,0)}60%{-webkit-transform:translate3d(4%,0,0);transform:translate3d(4%,0,0)}75%{-webkit-transform:translate3d(-1%,0,0);transform:translate3d(-1%,0,0)}to{-webkit-transform:translate3d(0,0,0);transform:translateZ(0)}}@keyframes wobble{0%{-webkit-transform:translate3d(0,0,0);transform:translateZ(0)}15%{-webkit-transform:translate3d(-9%,0,0);transform:translate3d(-9%,0,0)}30%{-webkit-transform:translate3d(9%,0,0);transform:translate3d(9%,0,0)}45%{-webkit-transform:translate3d(-4%,0,0);transform:translate3d(-4%,0,0)}60%{-webkit-transform:translate3d(4%,0,0);transform:translate3d(4%,0,0)}75%{-webkit-transform:translate3d(-1%,0,0);transform:translate3d(-1%,0,0)}to{-webkit-transform:translate3d(0,0,0);transform:translateZ(0)}}
`;
  var wi = class extends y {
    constructor() {
      super(...arguments), this.isMobile = false, this.contentRectCache = void 0, this.resizeDebouncer = et(() => {
        this.windowResize();
      }, 200);
    }
    /**
     * Editor.js UI CSS class names
     *
     * @returns {{editorWrapper: string, editorZone: string}}
     */
    get CSS() {
      return {
        editorWrapper: "codex-editor",
        editorWrapperNarrow: "codex-editor--narrow",
        editorZone: "codex-editor__redactor",
        editorZoneHidden: "codex-editor__redactor--hidden",
        editorEmpty: "codex-editor--empty",
        editorRtlFix: "codex-editor--rtl"
      };
    }
    /**
     * Return Width of center column of Editor
     *
     * @returns {DOMRect}
     */
    get contentRect() {
      if (this.contentRectCache)
        return this.contentRectCache;
      const e = this.nodes.wrapper.querySelector(`.${R.CSS.content}`);
      return e ? (this.contentRectCache = e.getBoundingClientRect(), this.contentRectCache) : {
        width: 650,
        left: 0,
        right: 0
      };
    }
    /**
     * Making main interface
     */
    async prepare() {
      this.checkIsMobile(), this.make(), this.loadStyles();
    }
    /**
     * Toggle read-only state
     *
     * If readOnly is true:
     *  - removes all listeners from main UI module elements
     *
     * if readOnly is false:
     *  - enables all listeners to UI module elements
     *
     * @param {boolean} readOnlyEnabled - "read only" state
     */
    toggleReadOnly(e) {
      e ? this.disableModuleBindings() : window.requestIdleCallback(() => {
        this.enableModuleBindings();
      }, {
        timeout: 2e3
      });
    }
    /**
     * Check if Editor is empty and set CSS class to wrapper
     */
    checkEmptiness() {
      const { BlockManager: e } = this.Editor;
      this.nodes.wrapper.classList.toggle(this.CSS.editorEmpty, e.isEditorEmpty);
    }
    /**
     * Check if one of Toolbar is opened
     * Used to prevent global keydowns (for example, Enter) conflicts with Enter-on-toolbar
     *
     * @returns {boolean}
     */
    get someToolbarOpened() {
      const { Toolbar: e, BlockSettings: t, InlineToolbar: o3, ConversionToolbar: i2 } = this.Editor;
      return t.opened || o3.opened || i2.opened || e.toolbox.opened;
    }
    /**
     * Check for some Flipper-buttons is under focus
     */
    get someFlipperButtonFocused() {
      return this.Editor.Toolbar.toolbox.hasFocus() ? true : Object.entries(this.Editor).filter(([e, t]) => t.flipper instanceof q).some(([e, t]) => t.flipper.hasFocus());
    }
    /**
     * Clean editor`s UI
     */
    destroy() {
      this.nodes.holder.innerHTML = "";
    }
    /**
     * Close all Editor's toolbars
     */
    closeAllToolbars() {
      const { Toolbar: e, BlockSettings: t, InlineToolbar: o3, ConversionToolbar: i2 } = this.Editor;
      t.close(), o3.close(), i2.close(), e.toolbox.close();
    }
    /**
     * Check for mobile mode and cache a result
     */
    checkIsMobile() {
      this.isMobile = window.innerWidth < dt;
    }
    /**
     * Makes Editor.js interface
     */
    make() {
      this.nodes.holder = c.getHolder(this.config.holder), this.nodes.wrapper = c.make("div", [
        this.CSS.editorWrapper,
        ...this.isRtl ? [this.CSS.editorRtlFix] : []
      ]), this.nodes.redactor = c.make("div", this.CSS.editorZone), this.nodes.holder.offsetWidth < this.contentRect.width && this.nodes.wrapper.classList.add(this.CSS.editorWrapperNarrow), this.nodes.redactor.style.paddingBottom = this.config.minHeight + "px", this.nodes.wrapper.appendChild(this.nodes.redactor), this.nodes.holder.appendChild(this.nodes.wrapper);
    }
    /**
     * Appends CSS
     */
    loadStyles() {
      const e = "editor-js-styles";
      if (c.get(e))
        return;
      const t = c.make("style", null, {
        id: e,
        textContent: xi.toString()
      });
      this.config.style && !W(this.config.style) && this.config.style.nonce && t.setAttribute("nonce", this.config.style.nonce), c.prepend(document.head, t);
    }
    /**
     * Bind events on the Editor.js interface
     */
    enableModuleBindings() {
      this.readOnlyMutableListeners.on(this.nodes.redactor, "click", (o3) => {
        this.redactorClicked(o3);
      }, false), this.readOnlyMutableListeners.on(this.nodes.redactor, "mousedown", (o3) => {
        this.documentTouched(o3);
      }, {
        capture: true,
        passive: true
      }), this.readOnlyMutableListeners.on(this.nodes.redactor, "touchstart", (o3) => {
        this.documentTouched(o3);
      }, {
        capture: true,
        passive: true
      }), this.readOnlyMutableListeners.on(document, "keydown", (o3) => {
        this.documentKeydown(o3);
      }, true), this.readOnlyMutableListeners.on(document, "mousedown", (o3) => {
        this.documentClicked(o3);
      }, true);
      const t = et(() => {
        this.selectionChanged();
      }, 180);
      this.readOnlyMutableListeners.on(document, "selectionchange", t, true), this.readOnlyMutableListeners.on(window, "resize", () => {
        this.resizeDebouncer();
      }, {
        passive: true
      }), this.watchBlockHoveredEvents();
    }
    /**
     * Listen redactor mousemove to emit 'block-hovered' event
     */
    watchBlockHoveredEvents() {
      let e;
      this.readOnlyMutableListeners.on(this.nodes.redactor, "mousemove", Ie((t) => {
        const o3 = t.target.closest(".ce-block");
        this.Editor.BlockSelection.anyBlockSelected || o3 && e !== o3 && (e = o3, this.eventsDispatcher.emit(yt, {
          block: this.Editor.BlockManager.getBlockByChildNode(o3)
        }));
      }, 20), {
        passive: true
      });
    }
    /**
     * Unbind events on the Editor.js interface
     */
    disableModuleBindings() {
      this.readOnlyMutableListeners.clearAll();
    }
    /**
     * Resize window handler
     */
    windowResize() {
      this.contentRectCache = null, this.checkIsMobile();
    }
    /**
     * All keydowns on document
     *
     * @param {KeyboardEvent} event - keyboard event
     */
    documentKeydown(e) {
      switch (e.keyCode) {
        case v.ENTER:
          this.enterPressed(e);
          break;
        case v.BACKSPACE:
        case v.DELETE:
          this.backspacePressed(e);
          break;
        case v.ESC:
          this.escapePressed(e);
          break;
        default:
          this.defaultBehaviour(e);
          break;
      }
    }
    /**
     * Ignore all other document's keydown events
     *
     * @param {KeyboardEvent} event - keyboard event
     */
    defaultBehaviour(e) {
      const { currentBlock: t } = this.Editor.BlockManager, o3 = e.target.closest(`.${this.CSS.editorWrapper}`), i2 = e.altKey || e.ctrlKey || e.metaKey || e.shiftKey;
      if (t !== void 0 && o3 === null) {
        this.Editor.BlockEvents.keydown(e);
        return;
      }
      o3 || t && i2 || (this.Editor.BlockManager.dropPointer(), this.Editor.Toolbar.close());
    }
    /**
     * @param {KeyboardEvent} event - keyboard event
     */
    backspacePressed(e) {
      const { BlockManager: t, BlockSelection: o3, Caret: i2 } = this.Editor;
      if (o3.anyBlockSelected && !b.isSelectionExists) {
        const n2 = t.removeSelectedBlocks(), r2 = t.insertDefaultBlockAtIndex(n2, true);
        i2.setToBlock(r2, i2.positions.START), o3.clearSelection(e), e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation();
      }
    }
    /**
     * Escape pressed
     * If some of Toolbar components are opened, then close it otherwise close Toolbar
     *
     * @param {Event} event - escape keydown event
     */
    escapePressed(e) {
      this.Editor.BlockSelection.clearSelection(e), this.Editor.Toolbar.toolbox.opened ? (this.Editor.Toolbar.toolbox.close(), this.Editor.Caret.setToBlock(this.Editor.BlockManager.currentBlock, this.Editor.Caret.positions.END)) : this.Editor.BlockSettings.opened ? this.Editor.BlockSettings.close() : this.Editor.ConversionToolbar.opened ? this.Editor.ConversionToolbar.close() : this.Editor.InlineToolbar.opened ? this.Editor.InlineToolbar.close() : this.Editor.Toolbar.close();
    }
    /**
     * Enter pressed on document
     *
     * @param {KeyboardEvent} event - keyboard event
     */
    enterPressed(e) {
      const { BlockManager: t, BlockSelection: o3 } = this.Editor, i2 = t.currentBlockIndex >= 0;
      if (o3.anyBlockSelected && !b.isSelectionExists) {
        o3.clearSelection(e), e.preventDefault(), e.stopImmediatePropagation(), e.stopPropagation();
        return;
      }
      if (!this.someToolbarOpened && i2 && e.target.tagName === "BODY") {
        const n2 = this.Editor.BlockManager.insert();
        this.Editor.Caret.setToBlock(n2), this.Editor.Toolbar.moveAndOpen(n2);
      }
      this.Editor.BlockSelection.clearSelection(e);
    }
    /**
     * All clicks on document
     *
     * @param {MouseEvent} event - Click event
     */
    documentClicked(e) {
      var a4, l4;
      if (!e.isTrusted)
        return;
      const t = e.target;
      this.nodes.holder.contains(t) || b.isAtEditor || (this.Editor.BlockManager.dropPointer(), this.Editor.Toolbar.close());
      const i2 = (a4 = this.Editor.BlockSettings.nodes.wrapper) == null ? void 0 : a4.contains(t), n2 = (l4 = this.Editor.Toolbar.nodes.settingsToggler) == null ? void 0 : l4.contains(t), r2 = i2 || n2;
      if (this.Editor.BlockSettings.opened && !r2) {
        this.Editor.BlockSettings.close();
        const d4 = this.Editor.BlockManager.getBlockByChildNode(t);
        this.Editor.Toolbar.moveAndOpen(d4);
      }
      this.Editor.BlockSelection.clearSelection(e);
    }
    /**
     * First touch on editor
     * Fired before click
     *
     * Used to change current block — we need to do it before 'selectionChange' event.
     * Also:
     * - Move and show the Toolbar
     * - Set a Caret
     *
     * @param {MouseEvent | TouchEvent} event - touch or mouse event
     */
    documentTouched(e) {
      let t = e.target;
      if (t === this.nodes.redactor) {
        const o3 = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX, i2 = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;
        t = document.elementFromPoint(o3, i2);
      }
      try {
        this.Editor.BlockManager.setCurrentBlockByChildNode(t);
      } catch {
        this.Editor.RectangleSelection.isRectActivated() || this.Editor.Caret.setToTheLastBlock();
      }
      this.Editor.Toolbar.moveAndOpen();
    }
    /**
     * All clicks on the redactor zone
     *
     * @param {MouseEvent} event - click event
     * @description
     * - By clicks on the Editor's bottom zone:
     *      - if last Block is empty, set a Caret to this
     *      - otherwise, add a new empty Block and set a Caret to that
     */
    redactorClicked(e) {
      if (!b.isCollapsed)
        return;
      const t = e.target, o3 = e.metaKey || e.ctrlKey;
      if (c.isAnchor(t) && o3) {
        e.stopImmediatePropagation(), e.stopPropagation();
        const i2 = t.getAttribute("href"), n2 = Wt(i2);
        Kt(n2);
        return;
      }
      this.processBottomZoneClick(e);
    }
    /**
     * Check if user clicks on the Editor's bottom zone:
     *  - set caret to the last block
     *  - or add new empty block
     *
     * @param event - click event
     */
    processBottomZoneClick(e) {
      const t = this.Editor.BlockManager.getBlockByIndex(-1), o3 = c.offset(t.holder).bottom, i2 = e.pageY, { BlockSelection: n2 } = this.Editor;
      if (e.target instanceof Element && e.target.isEqualNode(this.nodes.redactor) && /**
      * If there is cross block selection started, target will be equal to redactor so we need additional check
      */
      !n2.anyBlockSelected && /**
      * Prevent caret jumping (to last block) when clicking between blocks
      */
      o3 < i2) {
        e.stopImmediatePropagation(), e.stopPropagation();
        const { BlockManager: a4, Caret: l4, Toolbar: d4 } = this.Editor;
        (!a4.lastBlock.tool.isDefault || !a4.lastBlock.isEmpty) && a4.insertAtEnd(), l4.setToTheLastBlock(), d4.moveAndOpen(a4.lastBlock);
      }
    }
    /**
     * Handle selection changes on mobile devices
     * Uses for showing the Inline Toolbar
     */
    selectionChanged() {
      const { CrossBlockSelection: e, BlockSelection: t } = this.Editor, o3 = b.anchorElement;
      if (e.isCrossBlockSelectionStarted && t.anyBlockSelected && b.get().removeAllRanges(), !o3) {
        b.range || this.Editor.InlineToolbar.close();
        return;
      }
      const i2 = o3.closest(`.${R.CSS.content}`) === null;
      if (i2 && (this.Editor.InlineToolbar.containsNode(o3) || this.Editor.InlineToolbar.close(), !(o3.dataset.inlineToolbar === "true")))
        return;
      this.Editor.BlockManager.currentBlock || this.Editor.BlockManager.setCurrentBlockByChildNode(o3);
      const n2 = i2 !== true;
      this.Editor.InlineToolbar.tryToShow(true, n2);
    }
  };
  var yi = {
    // API Modules
    BlocksAPI: oo,
    CaretAPI: io,
    EventsAPI: no,
    I18nAPI: He,
    API: so,
    InlineToolbarAPI: ro,
    ListenersAPI: ao,
    NotifierAPI: uo,
    ReadOnlyAPI: po,
    SanitizerAPI: xo,
    SaverAPI: wo,
    SelectionAPI: yo,
    StylesAPI: Eo,
    ToolbarAPI: Bo,
    TooltipAPI: Mo,
    UiAPI: Lo,
    // Toolbar Modules
    BlockSettings: Yo,
    ConversionToolbar: $,
    Toolbar: Jo,
    InlineToolbar: Qo,
    // Modules
    BlockEvents: ei,
    BlockManager: ii,
    BlockSelection: ni,
    Caret: we,
    CrossBlockSelection: si,
    DragNDrop: ri,
    ModificationsObserver: ai,
    Paste: Tt,
    ReadOnly: li,
    RectangleSelection: fe,
    Renderer: ci,
    Saver: di,
    Tools: _t,
    UI: wi
  };
  var Ei = class {
    /**
     * @param {EditorConfig} config - user configuration
     */
    constructor(e) {
      this.moduleInstances = {}, this.eventsDispatcher = new Ee();
      let t, o3;
      this.isReady = new Promise((i2, n2) => {
        t = i2, o3 = n2;
      }), Promise.resolve().then(async () => {
        this.configuration = e, this.validate(), this.init(), await this.start(), await this.render();
        const { BlockManager: i2, Caret: n2, UI: r2, ModificationsObserver: a4 } = this.moduleInstances;
        r2.checkEmptiness(), a4.enable(), this.configuration.autofocus && n2.setToBlock(i2.blocks[0], n2.positions.START), t();
      }).catch((i2) => {
        T(`Editor.js is not ready because of ${i2}`, "error"), o3(i2);
      });
    }
    /**
     * Setting for configuration
     *
     * @param {EditorConfig|string} config - Editor's config to set
     */
    set configuration(e) {
      var o3, i2;
      D(e) ? this.config = {
        ...e
      } : this.config = {
        holder: e
      }, Le(!!this.config.holderId, "config.holderId", "config.holder"), this.config.holderId && !this.config.holder && (this.config.holder = this.config.holderId, this.config.holderId = null), this.config.holder == null && (this.config.holder = "editorjs"), this.config.logLevel || (this.config.logLevel = at.VERBOSE), Ft(this.config.logLevel), Le(!!this.config.initialBlock, "config.initialBlock", "config.defaultBlock"), this.config.defaultBlock = this.config.defaultBlock || this.config.initialBlock || "paragraph", this.config.minHeight = this.config.minHeight !== void 0 ? this.config.minHeight : 300;
      const t = {
        type: this.config.defaultBlock,
        data: {}
      };
      this.config.placeholder = this.config.placeholder || false, this.config.sanitizer = this.config.sanitizer || {
        p: true,
        b: true,
        a: true
      }, this.config.hideToolbar = this.config.hideToolbar ? this.config.hideToolbar : false, this.config.tools = this.config.tools || {}, this.config.i18n = this.config.i18n || {}, this.config.data = this.config.data || { blocks: [] }, this.config.onReady = this.config.onReady || (() => {
      }), this.config.onChange = this.config.onChange || (() => {
      }), this.config.inlineToolbar = this.config.inlineToolbar !== void 0 ? this.config.inlineToolbar : true, (W(this.config.data) || !this.config.data.blocks || this.config.data.blocks.length === 0) && (this.config.data = { blocks: [t] }), this.config.readOnly = this.config.readOnly || false, (o3 = this.config.i18n) != null && o3.messages && z.setDictionary(this.config.i18n.messages), this.config.i18n.direction = ((i2 = this.config.i18n) == null ? void 0 : i2.direction) || "ltr";
    }
    /**
     * Returns private property
     *
     * @returns {EditorConfig}
     */
    get configuration() {
      return this.config;
    }
    /**
     * Checks for required fields in Editor's config
     */
    validate() {
      const { holderId: e, holder: t } = this.config;
      if (e && t)
        throw Error("\xABholderId\xBB and \xABholder\xBB param can't assign at the same time.");
      if (G(t) && !c.get(t))
        throw Error(`element with ID \xAB${t}\xBB is missing. Pass correct holder's ID.`);
      if (t && D(t) && !c.isElement(t))
        throw Error("\xABholder\xBB value must be an Element node");
    }
    /**
     * Initializes modules:
     *  - make and save instances
     *  - configure
     */
    init() {
      this.constructModules(), this.configureModules();
    }
    /**
     * Start Editor!
     *
     * Get list of modules that needs to be prepared and return a sequence (Promise)
     *
     * @returns {Promise<void>}
     */
    async start() {
      await [
        "Tools",
        "UI",
        "BlockManager",
        "Paste",
        "BlockSelection",
        "RectangleSelection",
        "CrossBlockSelection",
        "ReadOnly"
      ].reduce(
        (t, o3) => t.then(async () => {
          try {
            await this.moduleInstances[o3].prepare();
          } catch (i2) {
            if (i2 instanceof ut)
              throw new Error(i2.message);
            T(`Module ${o3} was skipped because of %o`, "warn", i2);
          }
        }),
        Promise.resolve()
      );
    }
    /**
     * Render initial data
     */
    render() {
      return this.moduleInstances.Renderer.render(this.config.data.blocks);
    }
    /**
     * Make modules instances and save it to the @property this.moduleInstances
     */
    constructModules() {
      Object.entries(yi).forEach(([e, t]) => {
        try {
          this.moduleInstances[e] = new t({
            config: this.configuration,
            eventsDispatcher: this.eventsDispatcher
          });
        } catch (o3) {
          T("[constructModules]", `Module ${e} skipped because`, "error", o3);
        }
      });
    }
    /**
     * Modules instances configuration:
     *  - pass other modules to the 'state' property
     *  - ...
     */
    configureModules() {
      for (const e in this.moduleInstances)
        Object.prototype.hasOwnProperty.call(this.moduleInstances, e) && (this.moduleInstances[e].state = this.getModulesDiff(e));
    }
    /**
     * Return modules without passed name
     *
     * @param {string} name - module for witch modules difference should be calculated
     */
    getModulesDiff(e) {
      const t = {};
      for (const o3 in this.moduleInstances)
        o3 !== e && (t[o3] = this.moduleInstances[o3]);
      return t;
    }
  };
  var Bi = class {
    /** Editor version */
    static get version() {
      return "2.29.1";
    }
    /**
     * @param {EditorConfig|string|undefined} [configuration] - user configuration
     */
    constructor(e) {
      let t = () => {
      };
      D(e) && M(e.onReady) && (t = e.onReady);
      const o3 = new Ei(e);
      this.isReady = o3.isReady.then(() => {
        this.exportAPI(o3), t();
      });
    }
    /**
     * Export external API methods
     *
     * @param {Core} editor — Editor's instance
     */
    exportAPI(e) {
      const t = ["configuration"], o3 = () => {
        Object.values(e.moduleInstances).forEach((n2) => {
          M(n2.destroy) && n2.destroy(), n2.listeners.removeAll();
        }), Io(), e = null;
        for (const n2 in this)
          Object.prototype.hasOwnProperty.call(this, n2) && delete this[n2];
        Object.setPrototypeOf(this, null);
      };
      t.forEach((n2) => {
        this[n2] = e[n2];
      }), this.destroy = o3, Object.setPrototypeOf(this, e.moduleInstances.API.methods), delete this.exportAPI, Object.entries({
        blocks: {
          clear: "clear",
          render: "render"
        },
        caret: {
          focus: "focus"
        },
        events: {
          on: "on",
          off: "off",
          emit: "emit"
        },
        saver: {
          save: "save"
        }
      }).forEach(([n2, r2]) => {
        Object.entries(r2).forEach(([a4, l4]) => {
          this[l4] = e.moduleInstances.API.methods[n2][a4];
        });
      });
    }
  };

  // web/static/js/vendor/editorjs/header.mjs
  (function() {
    "use strict";
    try {
      if (typeof document < "u") {
        var e = document.createElement("style");
        e.appendChild(document.createTextNode(".ce-header{padding:.6em 0 3px;margin:0;line-height:1.25em;outline:none}.ce-header p,.ce-header div{padding:0!important;margin:0!important}")), document.head.appendChild(e);
      }
    } catch (n2) {
      console.error("vite-plugin-css-injected-by-js", n2);
    }
  })();
  var a = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M6 7L6 12M6 17L6 12M6 12L12 12M12 7V12M12 17L12 12"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M19 17V10.2135C19 10.1287 18.9011 10.0824 18.836 10.1367L16 12.5"/></svg>';
  var l = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M6 7L6 12M6 17L6 12M6 12L12 12M12 7V12M12 17L12 12"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M16 11C16 10 19 9.5 19 12C19 13.9771 16.0684 13.9997 16.0012 16.8981C15.9999 16.9533 16.0448 17 16.1 17L19.3 17"/></svg>';
  var o = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M6 7L6 12M6 17L6 12M6 12L12 12M12 7V12M12 17L12 12"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M16 11C16 10.5 16.8323 10 17.6 10C18.3677 10 19.5 10.311 19.5 11.5C19.5 12.5315 18.7474 12.9022 18.548 12.9823C18.5378 12.9864 18.5395 13.0047 18.5503 13.0063C18.8115 13.0456 20 13.3065 20 14.8C20 16 19.5 17 17.8 17C17.8 17 16 17 16 16.3"/></svg>';
  var h = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M6 7L6 12M6 17L6 12M6 12L12 12M12 7V12M12 17L12 12"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M18 10L15.2834 14.8511C15.246 14.9178 15.294 15 15.3704 15C16.8489 15 18.7561 15 20.2 15M19 17C19 15.7187 19 14.8813 19 13.6"/></svg>';
  var d = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M6 7L6 12M6 17L6 12M6 12L12 12M12 7V12M12 17L12 12"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M16 15.9C16 15.9 16.3768 17 17.8 17C19.5 17 20 15.6199 20 14.7C20 12.7323 17.6745 12.0486 16.1635 12.9894C16.094 13.0327 16 12.9846 16 12.9027V10.1C16 10.0448 16.0448 10 16.1 10H19.8"/></svg>';
  var u = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M6 7L6 12M6 17L6 12M6 12L12 12M12 7V12M12 17L12 12"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M19.5 10C16.5 10.5 16 13.3285 16 15M16 15V15C16 16.1046 16.8954 17 18 17H18.3246C19.3251 17 20.3191 16.3492 20.2522 15.3509C20.0612 12.4958 16 12.6611 16 15Z"/></svg>';
  var g = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M9 7L9 12M9 17V12M9 12L15 12M15 7V12M15 17L15 12"/></svg>';
  var c2 = class {
    constructor({ data: e, config: t, api: s, readOnly: r2 }) {
      this.api = s, this.readOnly = r2, this._settings = t, this._data = this.normalizeData(e), this._element = this.getTag();
    }
    /**
     * Styles
     */
    get _CSS() {
      return {
        block: this.api.styles.block,
        wrapper: "ce-header"
      };
    }
    /**
     * Check if data is valid
     * 
     * @param {any} data - data to check
     * @returns {data is HeaderData}
     * @private
     */
    isHeaderData(e) {
      return e.text !== void 0;
    }
    /**
     * Normalize input data
     *
     * @param {HeaderData} data - saved data to process
     *
     * @returns {HeaderData}
     * @private
     */
    normalizeData(e) {
      const t = { text: "", level: this.defaultLevel.number };
      return this.isHeaderData(e) && (t.text = e.text || "", e.level !== void 0 && !isNaN(parseInt(e.level.toString())) && (t.level = parseInt(e.level.toString()))), t;
    }
    /**
     * Return Tool's view
     *
     * @returns {HTMLHeadingElement}
     * @public
     */
    render() {
      return this._element;
    }
    /**
     * Returns header block tunes config
     *
     * @returns {Array}
     */
    renderSettings() {
      return this.levels.map((e) => ({
        icon: e.svg,
        label: this.api.i18n.t(`Heading ${e.number}`),
        onActivate: () => this.setLevel(e.number),
        closeOnActivate: true,
        isActive: this.currentLevel.number === e.number,
        render: () => document.createElement("div")
      }));
    }
    /**
     * Callback for Block's settings buttons
     *
     * @param {number} level - level to set
     */
    setLevel(e) {
      this.data = {
        level: e,
        text: this.data.text
      };
    }
    /**
     * Method that specified how to merge two Text blocks.
     * Called by Editor.js by backspace at the beginning of the Block
     *
     * @param {HeaderData} data - saved data to merger with current block
     * @public
     */
    merge(e) {
      const t = {
        text: this.data.text + e.text,
        level: this.data.level
      };
      this.data = t;
    }
    /**
     * Validate Text block data:
     * - check for emptiness
     *
     * @param {HeaderData} blockData — data received after saving
     * @returns {boolean} false if saved data is not correct, otherwise true
     * @public
     */
    validate(e) {
      return e.text.trim() !== "";
    }
    /**
     * Extract Tool's data from the view
     *
     * @param {HTMLHeadingElement} toolsContent - Text tools rendered view
     * @returns {HeaderData} - saved data
     * @public
     */
    save(e) {
      return {
        text: e.innerHTML,
        level: this.currentLevel.number
      };
    }
    /**
     * Allow Header to be converted to/from other blocks
     */
    static get conversionConfig() {
      return {
        export: "text",
        // use 'text' property for other blocks
        import: "text"
        // fill 'text' property from other block's export string
      };
    }
    /**
     * Sanitizer Rules
     */
    static get sanitize() {
      return {
        level: false,
        text: {}
      };
    }
    /**
     * Returns true to notify core that read-only is supported
     *
     * @returns {boolean}
     */
    static get isReadOnlySupported() {
      return true;
    }
    /**
     * Get current Tools`s data
     *
     * @returns {HeaderData} Current data
     * @private
     */
    get data() {
      return this._data.text = this._element.innerHTML, this._data.level = this.currentLevel.number, this._data;
    }
    /**
     * Store data in plugin:
     * - at the this._data property
     * - at the HTML
     *
     * @param {HeaderData} data — data to set
     * @private
     */
    set data(e) {
      if (this._data = this.normalizeData(e), e.level !== void 0 && this._element.parentNode) {
        const t = this.getTag();
        t.innerHTML = this._element.innerHTML, this._element.parentNode.replaceChild(t, this._element), this._element = t;
      }
      e.text !== void 0 && (this._element.innerHTML = this._data.text || "");
    }
    /**
     * Get tag for target level
     * By default returns second-leveled header
     *
     * @returns {HTMLElement}
     */
    getTag() {
      const e = document.createElement(this.currentLevel.tag);
      return e.innerHTML = this._data.text || "", e.classList.add(this._CSS.wrapper), e.contentEditable = this.readOnly ? "false" : "true", e.dataset.placeholder = this.api.i18n.t(this._settings.placeholder || ""), e;
    }
    /**
     * Get current level
     *
     * @returns {level}
     */
    get currentLevel() {
      let e = this.levels.find((t) => t.number === this._data.level);
      return e || (e = this.defaultLevel), e;
    }
    /**
     * Return default level
     *
     * @returns {level}
     */
    get defaultLevel() {
      if (this._settings.defaultLevel) {
        const e = this.levels.find((t) => t.number === this._settings.defaultLevel);
        if (e)
          return e;
        console.warn("(\u0E07'\u0300-'\u0301)\u0E07 Heading Tool: the default level specified was not found in available levels");
      }
      return this.levels[1];
    }
    /**
     * @typedef {object} level
     * @property {number} number - level number
     * @property {string} tag - tag corresponds with level number
     * @property {string} svg - icon
     */
    /**
     * Available header levels
     *
     * @returns {level[]}
     */
    get levels() {
      const e = [
        {
          number: 1,
          tag: "H1",
          svg: a
        },
        {
          number: 2,
          tag: "H2",
          svg: l
        },
        {
          number: 3,
          tag: "H3",
          svg: o
        },
        {
          number: 4,
          tag: "H4",
          svg: h
        },
        {
          number: 5,
          tag: "H5",
          svg: d
        },
        {
          number: 6,
          tag: "H6",
          svg: u
        }
      ];
      return this._settings.levels ? e.filter(
        (t) => this._settings.levels.includes(t.number)
      ) : e;
    }
    /**
     * Handle H1-H6 tags on paste to substitute it with header Tool
     *
     * @param {PasteEvent} event - event with pasted content
     */
    onPaste(e) {
      const t = e.detail;
      if ("data" in t) {
        const s = t.data;
        let r2 = this.defaultLevel.number;
        switch (s.tagName) {
          case "H1":
            r2 = 1;
            break;
          case "H2":
            r2 = 2;
            break;
          case "H3":
            r2 = 3;
            break;
          case "H4":
            r2 = 4;
            break;
          case "H5":
            r2 = 5;
            break;
          case "H6":
            r2 = 6;
            break;
        }
        this._settings.levels && (r2 = this._settings.levels.reduce((n2, i2) => Math.abs(i2 - r2) < Math.abs(n2 - r2) ? i2 : n2)), this.data = {
          level: r2,
          text: s.innerHTML
        };
      }
    }
    /**
     * Used by Editor.js paste handling API.
     * Provides configuration to handle H1-H6 tags.
     *
     * @returns {{handler: (function(HTMLElement): {text: string}), tags: string[]}}
     */
    static get pasteConfig() {
      return {
        tags: ["H1", "H2", "H3", "H4", "H5", "H6"]
      };
    }
    /**
     * Get Tool toolbox settings
     * icon - Tool icon's SVG
     * title - title to show in toolbox
     *
     * @returns {{icon: string, title: string}}
     */
    static get toolbox() {
      return {
        icon: g,
        title: "Heading"
      };
    }
  };

  // web/static/js/vendor/editorjs/list.mjs
  (function() {
    "use strict";
    try {
      if (typeof document < "u") {
        var e = document.createElement("style");
        e.appendChild(document.createTextNode(".cdx-list{margin:0;padding-left:40px;outline:none}.cdx-list__item{padding:5.5px 0 5.5px 3px;line-height:1.6em}.cdx-list--unordered{list-style:disc}.cdx-list--ordered{list-style:decimal}.cdx-list-settings{display:flex}.cdx-list-settings .cdx-settings-button{width:50%}")), document.head.appendChild(e);
      }
    } catch (t) {
      console.error("vite-plugin-css-injected-by-js", t);
    }
  })();
  var a2 = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><line x1="9" x2="19" y1="7" y2="7" stroke="currentColor" stroke-linecap="round" stroke-width="2"/><line x1="9" x2="19" y1="12" y2="12" stroke="currentColor" stroke-linecap="round" stroke-width="2"/><line x1="9" x2="19" y1="17" y2="17" stroke="currentColor" stroke-linecap="round" stroke-width="2"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M5.00001 17H4.99002"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M5.00001 12H4.99002"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M5.00001 7H4.99002"/></svg>';
  var o2 = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><line x1="12" x2="19" y1="7" y2="7" stroke="currentColor" stroke-linecap="round" stroke-width="2"/><line x1="12" x2="19" y1="12" y2="12" stroke="currentColor" stroke-linecap="round" stroke-width="2"/><line x1="12" x2="19" y1="17" y2="17" stroke="currentColor" stroke-linecap="round" stroke-width="2"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M7.79999 14L7.79999 7.2135C7.79999 7.12872 7.7011 7.0824 7.63597 7.13668L4.79999 9.5"/></svg>';
  var d2 = class {
    /**
     * Notify core that read-only mode is supported
     *
     * @returns {boolean}
     */
    static get isReadOnlySupported() {
      return true;
    }
    /**
     * Allow to use native Enter behaviour
     *
     * @returns {boolean}
     * @public
     */
    static get enableLineBreaks() {
      return true;
    }
    /**
     * Get Tool toolbox settings
     * icon - Tool icon's SVG
     * title - title to show in toolbox
     *
     * @returns {{icon: string, title: string}}
     */
    static get toolbox() {
      return {
        icon: a2,
        title: "List"
      };
    }
    /**
     * Render plugin`s main Element and fill it with saved data
     *
     * @param {object} params - tool constructor options
     * @param {ListData} params.data - previously saved data
     * @param {object} params.config - user config for Tool
     * @param {object} params.api - Editor.js API
     * @param {boolean} params.readOnly - read-only mode flag
     */
    constructor({ data: e, config: t, api: r2, readOnly: s }) {
      this._elements = {
        wrapper: null
      }, this.api = r2, this.readOnly = s, this.settings = [
        {
          name: "unordered",
          label: this.api.i18n.t("Unordered"),
          icon: a2,
          default: t.defaultStyle === "unordered" || false
        },
        {
          name: "ordered",
          label: this.api.i18n.t("Ordered"),
          icon: o2,
          default: t.defaultStyle === "ordered" || true
        }
      ], this._data = {
        style: this.settings.find((i2) => i2.default === true).name,
        items: []
      }, this.data = e;
    }
    /**
     * Returns list tag with items
     *
     * @returns {Element}
     * @public
     */
    render() {
      return this._elements.wrapper = this.makeMainTag(this._data.style), this._data.items.length ? this._data.items.forEach((e) => {
        this._elements.wrapper.appendChild(this._make("li", this.CSS.item, {
          innerHTML: e
        }));
      }) : this._elements.wrapper.appendChild(this._make("li", this.CSS.item)), this.readOnly || this._elements.wrapper.addEventListener("keydown", (e) => {
        const [t, r2] = [13, 8];
        switch (e.keyCode) {
          case t:
            this.getOutofList(e);
            break;
          case r2:
            this.backspace(e);
            break;
        }
      }, false), this._elements.wrapper;
    }
    /**
     * @returns {ListData}
     * @public
     */
    save() {
      return this.data;
    }
    /**
     * Allow List Tool to be converted to/from other block
     *
     * @returns {{export: Function, import: Function}}
     */
    static get conversionConfig() {
      return {
        /**
         * To create exported string from list, concatenate items by dot-symbol.
         *
         * @param {ListData} data - list data to create a string from thats
         * @returns {string}
         */
        export: (e) => e.items.join(". "),
        /**
         * To create a list from other block's string, just put it at the first item
         *
         * @param {string} string - string to create list tool data from that
         * @returns {ListData}
         */
        import: (e) => ({
          items: [e],
          style: "unordered"
        })
      };
    }
    /**
     * Sanitizer rules
     *
     * @returns {object}
     */
    static get sanitize() {
      return {
        style: {},
        items: {
          br: true
        }
      };
    }
    /**
     * Settings
     *
     * @public
     * @returns {Array}
     */
    renderSettings() {
      return this.settings.map((e) => ({
        ...e,
        isActive: this._data.style === e.name,
        closeOnActivate: true,
        onActivate: () => this.toggleTune(e.name)
      }));
    }
    /**
     * On paste callback that is fired from Editor
     *
     * @param {PasteEvent} event - event with pasted data
     */
    onPaste(e) {
      const t = e.detail.data;
      this.data = this.pasteHandler(t);
    }
    /**
     * List Tool on paste configuration
     *
     * @public
     */
    static get pasteConfig() {
      return {
        tags: ["OL", "UL", "LI"]
      };
    }
    /**
     * Creates main <ul> or <ol> tag depended on style
     *
     * @param {string} style - 'ordered' or 'unordered'
     * @returns {HTMLOListElement|HTMLUListElement}
     */
    makeMainTag(e) {
      const t = e === "ordered" ? this.CSS.wrapperOrdered : this.CSS.wrapperUnordered, r2 = e === "ordered" ? "ol" : "ul";
      return this._make(r2, [this.CSS.baseBlock, this.CSS.wrapper, t], {
        contentEditable: !this.readOnly
      });
    }
    /**
     * Toggles List style
     *
     * @param {string} style - 'ordered'|'unordered'
     */
    toggleTune(e) {
      const t = this.makeMainTag(e);
      for (; this._elements.wrapper.hasChildNodes(); )
        t.appendChild(this._elements.wrapper.firstChild);
      this._elements.wrapper.replaceWith(t), this._elements.wrapper = t, this._data.style = e;
    }
    /**
     * Styles
     *
     * @private
     */
    get CSS() {
      return {
        baseBlock: this.api.styles.block,
        wrapper: "cdx-list",
        wrapperOrdered: "cdx-list--ordered",
        wrapperUnordered: "cdx-list--unordered",
        item: "cdx-list__item"
      };
    }
    /**
     * List data setter
     *
     * @param {ListData} listData
     */
    set data(e) {
      e || (e = {}), this._data.style = e.style || this.settings.find((r2) => r2.default === true).name, this._data.items = e.items || [];
      const t = this._elements.wrapper;
      t && t.parentNode.replaceChild(this.render(), t);
    }
    /**
     * Return List data
     *
     * @returns {ListData}
     */
    get data() {
      this._data.items = [];
      const e = this._elements.wrapper.querySelectorAll(`.${this.CSS.item}`);
      for (let t = 0; t < e.length; t++)
        e[t].innerHTML.replace("<br>", " ").trim() && this._data.items.push(e[t].innerHTML);
      return this._data;
    }
    /**
     * Helper for making Elements with attributes
     *
     * @param  {string} tagName           - new Element tag name
     * @param  {Array|string} classNames  - list or name of CSS classname(s)
     * @param  {object} attributes        - any attributes
     * @returns {Element}
     */
    _make(e, t = null, r2 = {}) {
      const s = document.createElement(e);
      Array.isArray(t) ? s.classList.add(...t) : t && s.classList.add(t);
      for (const i2 in r2)
        s[i2] = r2[i2];
      return s;
    }
    /**
     * Returns current List item by the caret position
     *
     * @returns {Element}
     */
    get currentItem() {
      let e = window.getSelection().anchorNode;
      return e.nodeType !== Node.ELEMENT_NODE && (e = e.parentNode), e.closest(`.${this.CSS.item}`);
    }
    /**
     * Get out from List Tool
     * by Enter on the empty last item
     *
     * @param {KeyboardEvent} event
     */
    getOutofList(e) {
      const t = this._elements.wrapper.querySelectorAll("." + this.CSS.item);
      if (t.length < 2)
        return;
      const r2 = t[t.length - 1], s = this.currentItem;
      s === r2 && !r2.textContent.trim().length && (s.parentElement.removeChild(s), this.api.blocks.insert(), this.api.caret.setToBlock(this.api.blocks.getCurrentBlockIndex()), e.preventDefault(), e.stopPropagation());
    }
    /**
     * Handle backspace
     *
     * @param {KeyboardEvent} event
     */
    backspace(e) {
      const t = this._elements.wrapper.querySelectorAll("." + this.CSS.item), r2 = t[0];
      r2 && t.length < 2 && !r2.innerHTML.replace("<br>", " ").trim() && e.preventDefault();
    }
    /**
     * Select LI content by CMD+A
     *
     * @param {KeyboardEvent} event
     */
    selectItem(e) {
      e.preventDefault();
      const t = window.getSelection(), r2 = t.anchorNode.parentNode, s = r2.closest("." + this.CSS.item), i2 = new Range();
      i2.selectNodeContents(s), t.removeAllRanges(), t.addRange(i2);
    }
    /**
     * Handle UL, OL and LI tags paste and returns List data
     *
     * @param {HTMLUListElement|HTMLOListElement|HTMLLIElement} element
     * @returns {ListData}
     */
    pasteHandler(e) {
      const { tagName: t } = e;
      let r2;
      switch (t) {
        case "OL":
          r2 = "ordered";
          break;
        case "UL":
        case "LI":
          r2 = "unordered";
      }
      const s = {
        style: r2,
        items: []
      };
      if (t === "LI")
        s.items = [e.innerHTML];
      else {
        const i2 = Array.from(e.querySelectorAll("LI"));
        s.items = i2.map((n2) => n2.innerHTML).filter((n2) => !!n2.trim());
      }
      return s;
    }
  };

  // web/static/js/vendor/editorjs/quote.mjs
  (function() {
    "use strict";
    try {
      if (typeof document < "u") {
        var t = document.createElement("style");
        t.appendChild(document.createTextNode(".cdx-quote-icon svg{transform:rotate(180deg)}.cdx-quote{margin:0}.cdx-quote__text{min-height:158px;margin-bottom:10px}.cdx-quote [contentEditable=true][data-placeholder]:before{position:absolute;content:attr(data-placeholder);color:#707684;font-weight:400;opacity:0}.cdx-quote [contentEditable=true][data-placeholder]:empty:before{opacity:1}.cdx-quote [contentEditable=true][data-placeholder]:empty:focus:before{opacity:0}.cdx-quote-settings{display:flex}.cdx-quote-settings .cdx-settings-button{width:50%}")), document.head.appendChild(t);
      }
    } catch (e) {
      console.error("vite-plugin-css-injected-by-js", e);
    }
  })();
  var a3 = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M18 7L6 7"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M18 17H6"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M16 12L8 12"/></svg>';
  var c3 = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M17 7L5 7"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M17 17H5"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M13 12L5 12"/></svg>';
  var l2 = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 10.8182L9 10.8182C8.80222 10.8182 8.60888 10.7649 8.44443 10.665C8.27998 10.5651 8.15181 10.4231 8.07612 10.257C8.00043 10.0909 7.98063 9.90808 8.01922 9.73174C8.0578 9.55539 8.15304 9.39341 8.29289 9.26627C8.43275 9.13913 8.61093 9.05255 8.80491 9.01747C8.99889 8.98239 9.19996 9.00039 9.38268 9.0692C9.56541 9.13801 9.72159 9.25453 9.83147 9.40403C9.94135 9.55353 10 9.72929 10 9.90909L10 12.1818C10 12.664 9.78929 13.1265 9.41421 13.4675C9.03914 13.8084 8.53043 14 8 14"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 10.8182L15 10.8182C14.8022 10.8182 14.6089 10.7649 14.4444 10.665C14.28 10.5651 14.1518 10.4231 14.0761 10.257C14.0004 10.0909 13.9806 9.90808 14.0192 9.73174C14.0578 9.55539 14.153 9.39341 14.2929 9.26627C14.4327 9.13913 14.6109 9.05255 14.8049 9.01747C14.9989 8.98239 15.2 9.00039 15.3827 9.0692C15.5654 9.13801 15.7216 9.25453 15.8315 9.40403C15.9414 9.55353 16 9.72929 16 9.90909L16 12.1818C16 12.664 15.7893 13.1265 15.4142 13.4675C15.0391 13.8084 14.5304 14 14 14"/></svg>';
  var i = class _i {
    /**
     * Notify core that read-only mode is supported
     *
     * @returns {boolean}
     */
    static get isReadOnlySupported() {
      return true;
    }
    /**
     * Get Tool toolbox settings
     * icon - Tool icon's SVG
     * title - title to show in toolbox
     *
     * @returns {{icon: string, title: string}}
     */
    static get toolbox() {
      return {
        icon: l2,
        title: "Quote"
      };
    }
    /**
     * Empty Quote is not empty Block
     *
     * @public
     * @returns {boolean}
     */
    static get contentless() {
      return true;
    }
    /**
     * Allow to press Enter inside the Quote
     *
     * @public
     * @returns {boolean}
     */
    static get enableLineBreaks() {
      return true;
    }
    /**
     * Default placeholder for quote text
     *
     * @public
     * @returns {string}
     */
    static get DEFAULT_QUOTE_PLACEHOLDER() {
      return "Enter a quote";
    }
    /**
     * Default placeholder for quote caption
     *
     * @public
     * @returns {string}
     */
    static get DEFAULT_CAPTION_PLACEHOLDER() {
      return "Enter a caption";
    }
    /**
     * Allowed quote alignments
     *
     * @public
     * @returns {{left: string, center: string}}
     */
    static get ALIGNMENTS() {
      return {
        left: "left",
        center: "center"
      };
    }
    /**
     * Default quote alignment
     *
     * @public
     * @returns {string}
     */
    static get DEFAULT_ALIGNMENT() {
      return _i.ALIGNMENTS.left;
    }
    /**
     * Allow Quote to be converted to/from other blocks
     */
    static get conversionConfig() {
      return {
        /**
         * To create Quote data from string, simple fill 'text' property
         */
        import: "text",
        /**
         * To create string from Quote data, concatenate text and caption
         *
         * @param {QuoteData} quoteData
         * @returns {string}
         */
        export: function(t) {
          return t.caption ? `${t.text} \u2014 ${t.caption}` : t.text;
        }
      };
    }
    /**
     * Tool`s styles
     *
     * @returns {{baseClass: string, wrapper: string, quote: string, input: string, caption: string}}
     */
    get CSS() {
      return {
        baseClass: this.api.styles.block,
        wrapper: "cdx-quote",
        text: "cdx-quote__text",
        input: this.api.styles.input,
        caption: "cdx-quote__caption"
      };
    }
    /**
     * Tool`s settings properties
     *
     * @returns {*[]}
     */
    get settings() {
      return [
        {
          name: "left",
          icon: c3
        },
        {
          name: "center",
          icon: a3
        }
      ];
    }
    /**
     * Render plugin`s main Element and fill it with saved data
     *
     * @param {{data: QuoteData, config: QuoteConfig, api: object}}
     *   data — previously saved data
     *   config - user config for Tool
     *   api - Editor.js API
     *   readOnly - read-only mode flag
     */
    constructor({ data: t, config: e, api: n2, readOnly: r2 }) {
      const { ALIGNMENTS: o3, DEFAULT_ALIGNMENT: s } = _i;
      this.api = n2, this.readOnly = r2, this.quotePlaceholder = e.quotePlaceholder || _i.DEFAULT_QUOTE_PLACEHOLDER, this.captionPlaceholder = e.captionPlaceholder || _i.DEFAULT_CAPTION_PLACEHOLDER, this.data = {
        text: t.text || "",
        caption: t.caption || "",
        alignment: Object.values(o3).includes(t.alignment) && t.alignment || e.defaultAlignment || s
      };
    }
    /**
     * Create Quote Tool container with inputs
     *
     * @returns {Element}
     */
    render() {
      const t = this._make("blockquote", [this.CSS.baseClass, this.CSS.wrapper]), e = this._make("div", [this.CSS.input, this.CSS.text], {
        contentEditable: !this.readOnly,
        innerHTML: this.data.text
      }), n2 = this._make("div", [this.CSS.input, this.CSS.caption], {
        contentEditable: !this.readOnly,
        innerHTML: this.data.caption
      });
      return e.dataset.placeholder = this.quotePlaceholder, n2.dataset.placeholder = this.captionPlaceholder, t.appendChild(e), t.appendChild(n2), t;
    }
    /**
     * Extract Quote data from Quote Tool element
     *
     * @param {HTMLDivElement} quoteElement - element to save
     * @returns {QuoteData}
     */
    save(t) {
      const e = t.querySelector(`.${this.CSS.text}`), n2 = t.querySelector(`.${this.CSS.caption}`);
      return Object.assign(this.data, {
        text: e.innerHTML,
        caption: n2.innerHTML
      });
    }
    /**
     * Sanitizer rules
     */
    static get sanitize() {
      return {
        text: {
          br: true
        },
        caption: {
          br: true
        },
        alignment: {}
      };
    }
    /**
     * Create wrapper for Tool`s settings buttons:
     * 1. Left alignment
     * 2. Center alignment
     *
     * @returns {TunesMenuConfig}
     *
     */
    renderSettings() {
      const t = (e) => e[0].toUpperCase() + e.substr(1);
      return this.settings.map((e) => ({
        icon: e.icon,
        label: this.api.i18n.t(`Align ${t(e.name)}`),
        onActivate: () => this._toggleTune(e.name),
        isActive: this.data.alignment === e.name,
        closeOnActivate: true
      }));
    }
    /**
     * Toggle quote`s alignment
     *
     * @param {string} tune - alignment
     * @private
     */
    _toggleTune(t) {
      this.data.alignment = t;
    }
    /**
     * Helper for making Elements with attributes
     *
     * @param  {string} tagName           - new Element tag name
     * @param  {Array|string} classNames  - list or name of CSS classname(s)
     * @param  {object} attributes        - any attributes
     * @returns {Element}
     */
    _make(t, e = null, n2 = {}) {
      const r2 = document.createElement(t);
      Array.isArray(e) ? r2.classList.add(...e) : e && r2.classList.add(e);
      for (const o3 in n2)
        r2[o3] = n2[o3];
      return r2;
    }
  };

  // web/static/js/vendor/editorjs/code.mjs
  (function() {
    "use strict";
    try {
      if (typeof document < "u") {
        var e = document.createElement("style");
        e.appendChild(document.createTextNode(".ce-code__textarea{min-height:200px;font-family:Menlo,Monaco,Consolas,Courier New,monospace;color:#41314e;line-height:1.6em;font-size:12px;background:#f8f7fa;border:1px solid #f1f1f4;box-shadow:none;white-space:pre;word-wrap:normal;overflow-x:auto;resize:vertical}")), document.head.appendChild(e);
      }
    } catch (o3) {
      console.error("vite-plugin-css-injected-by-js", o3);
    }
  })();
  function l3(c4, t) {
    let r2 = "";
    for (; r2 !== `
` && t > 0; )
      t = t - 1, r2 = c4.substr(t, 1);
    return r2 === `
` && (t += 1), t;
  }
  var h2 = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 8L5 12L9 16"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 8L19 12L15 16"/></svg>';
  var d3 = class _d {
    /**
     * Notify core that read-only mode is supported
     *
     * @returns {boolean}
     */
    static get isReadOnlySupported() {
      return true;
    }
    /**
     * Allow to press Enter inside the CodeTool textarea
     *
     * @returns {boolean}
     * @public
     */
    static get enableLineBreaks() {
      return true;
    }
    /**
     * @typedef {object} CodeData — plugin saved data
     * @property {string} code - previously saved plugin code
     */
    /**
     * Render plugin`s main Element and fill it with saved data
     *
     * @param {object} options - tool constricting options
     * @param {CodeData} options.data — previously saved plugin code
     * @param {object} options.config - user config for Tool
     * @param {object} options.api - Editor.js API
     * @param {boolean} options.readOnly - read only mode flag
     */
    constructor({ data: t, config: e, api: r2, readOnly: a4 }) {
      this.api = r2, this.readOnly = a4, this.placeholder = this.api.i18n.t(e.placeholder || _d.DEFAULT_PLACEHOLDER), this.CSS = {
        baseClass: this.api.styles.block,
        input: this.api.styles.input,
        wrapper: "ce-code",
        textarea: "ce-code__textarea"
      }, this.nodes = {
        holder: null,
        textarea: null
      }, this.data = {
        code: t.code || ""
      }, this.nodes.holder = this.drawView();
    }
    /**
     * Create Tool's view
     *
     * @returns {HTMLElement}
     * @private
     */
    drawView() {
      const t = document.createElement("div"), e = document.createElement("textarea");
      return t.classList.add(this.CSS.baseClass, this.CSS.wrapper), e.classList.add(this.CSS.textarea, this.CSS.input), e.textContent = this.data.code, e.placeholder = this.placeholder, this.readOnly && (e.disabled = true), t.appendChild(e), e.addEventListener("keydown", (r2) => {
        switch (r2.code) {
          case "Tab":
            this.tabHandler(r2);
            break;
        }
      }), this.nodes.textarea = e, t;
    }
    /**
     * Return Tool's view
     *
     * @returns {HTMLDivElement} this.nodes.holder - Code's wrapper
     * @public
     */
    render() {
      return this.nodes.holder;
    }
    /**
     * Extract Tool's data from the view
     *
     * @param {HTMLDivElement} codeWrapper - CodeTool's wrapper, containing textarea with code
     * @returns {CodeData} - saved plugin code
     * @public
     */
    save(t) {
      return {
        code: t.querySelector("textarea").value
      };
    }
    /**
     * onPaste callback fired from Editor`s core
     *
     * @param {PasteEvent} event - event with pasted content
     */
    onPaste(t) {
      const e = t.detail.data;
      this.data = {
        code: e.textContent
      };
    }
    /**
     * Returns Tool`s data from private property
     *
     * @returns {CodeData}
     */
    get data() {
      return this._data;
    }
    /**
     * Set Tool`s data to private property and update view
     *
     * @param {CodeData} data - saved tool data
     */
    set data(t) {
      this._data = t, this.nodes.textarea && (this.nodes.textarea.textContent = t.code);
    }
    /**
     * Get Tool toolbox settings
     * icon - Tool icon's SVG
     * title - title to show in toolbox
     *
     * @returns {{icon: string, title: string}}
     */
    static get toolbox() {
      return {
        icon: h2,
        title: "Code"
      };
    }
    /**
     * Default placeholder for CodeTool's textarea
     *
     * @public
     * @returns {string}
     */
    static get DEFAULT_PLACEHOLDER() {
      return "Enter a code";
    }
    /**
     *  Used by Editor.js paste handling API.
     *  Provides configuration to handle CODE tag.
     *
     * @static
     * @returns {{tags: string[]}}
     */
    static get pasteConfig() {
      return {
        tags: ["pre"]
      };
    }
    /**
     * Automatic sanitize config
     *
     * @returns {{code: boolean}}
     */
    static get sanitize() {
      return {
        code: true
        // Allow HTML tags
      };
    }
    /**
     * Handles Tab key pressing (adds/removes indentations)
     *
     * @private
     * @param {KeyboardEvent} event - keydown
     * @returns {void}
     */
    tabHandler(t) {
      t.stopPropagation(), t.preventDefault();
      const e = t.target, r2 = t.shiftKey, a4 = e.selectionStart, s = e.value, n2 = "  ";
      let i2;
      if (!r2)
        i2 = a4 + n2.length, e.value = s.substring(0, a4) + n2 + s.substring(a4);
      else {
        const o3 = l3(s, a4);
        if (s.substr(o3, n2.length) !== n2)
          return;
        e.value = s.substring(0, o3) + s.substring(o3 + n2.length), i2 = a4 - n2.length;
      }
      e.setSelectionRange(i2, i2);
    }
  };

  // web/static/js/vendor/editorjs/delimiter.mjs
  (function() {
    "use strict";
    try {
      if (typeof document < "u") {
        var e = document.createElement("style");
        e.appendChild(document.createTextNode('.ce-delimiter{line-height:1.6em;width:100%;text-align:center}.ce-delimiter:before{display:inline-block;content:"***";font-size:30px;line-height:65px;height:30px;letter-spacing:.2em}')), document.head.appendChild(e);
      }
    } catch (t) {
      console.error("vite-plugin-css-injected-by-js", t);
    }
  })();
  var r = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><line x1="6" x2="10" y1="12" y2="12" stroke="currentColor" stroke-linecap="round" stroke-width="2"/><line x1="14" x2="18" y1="12" y2="12" stroke="currentColor" stroke-linecap="round" stroke-width="2"/></svg>';
  var n = class {
    /**
     * Notify core that read-only mode is supported
     * @return {boolean}
     */
    static get isReadOnlySupported() {
      return true;
    }
    /**
     * Allow Tool to have no content
     * @return {boolean}
     */
    static get contentless() {
      return true;
    }
    /**
     * Render plugin`s main Element and fill it with saved data
     *
     * @param {{data: DelimiterData, config: object, api: object}}
     *   data — previously saved data
     *   config - user config for Tool
     *   api - Editor.js API
     */
    constructor({ data: t, config: s, api: e }) {
      this.api = e, this._CSS = {
        block: this.api.styles.block,
        wrapper: "ce-delimiter"
      }, this._element = this.drawView(), this.data = t;
    }
    /**
     * Create Tool's view
     * @return {HTMLDivElement}
     * @private
     */
    drawView() {
      let t = document.createElement("div");
      return t.classList.add(this._CSS.wrapper, this._CSS.block), t;
    }
    /**
     * Return Tool's view
     * @returns {HTMLDivElement}
     * @public
     */
    render() {
      return this._element;
    }
    /**
     * Extract Tool's data from the view
     * @param {HTMLDivElement} toolsContent - Paragraph tools rendered view
     * @returns {DelimiterData} - saved data
     * @public
     */
    save(t) {
      return {};
    }
    /**
     * Get Tool toolbox settings
     * icon - Tool icon's SVG
     * title - title to show in toolbox
     *
     * @return {{icon: string, title: string}}
     */
    static get toolbox() {
      return {
        icon: r,
        title: "Delimiter"
      };
    }
    /**
     * Delimiter onPaste configuration
     *
     * @public
     */
    static get pasteConfig() {
      return { tags: ["HR"] };
    }
    /**
     * On paste callback that is fired from Editor
     *
     * @param {PasteEvent} event - event with pasted data
     */
    onPaste(t) {
      this.data = {};
    }
  };

  // web/static/js/src/editor/block-editor.js
  var BlockEditor = class extends EditorCore2 {
    // ============================================
    // PRIVATE STATE
    // ============================================
    /** @type {EditorJS} */
    #editor = null;
    /** @type {boolean} */
    #isReady = false;
    /** @type {Promise} */
    #readyPromise = null;
    /** @type {Object} */
    #lastSavedData = null;
    // ============================================
    // CONSTRUCTOR
    // ============================================
    constructor(container, options = {}) {
      super(container, options);
      let initialData = options.initialData;
      if (typeof initialData === "string" && initialData.trim()) {
        try {
          initialData = JSON.parse(initialData);
        } catch (e) {
          console.warn("[BlockEditor] Failed to parse initial data as JSON:", e);
          initialData = null;
        }
      }
      const editorHolder = document.createElement("div");
      editorHolder.className = "block-editor-holder";
      editorHolder.id = `block-editor-${Date.now()}`;
      container.appendChild(editorHolder);
      this.#readyPromise = this.#initEditor(editorHolder.id, initialData);
    }
    // ============================================
    // INITIALIZATION
    // ============================================
    async #initEditor(holderId, initialData) {
      this.#editor = new Bi({
        holder: holderId,
        tools: {
          header: {
            class: c2,
            config: {
              levels: [2, 3, 4],
              defaultLevel: 2
            }
          },
          list: {
            class: d2,
            inlineToolbar: true
          },
          quote: {
            class: i,
            inlineToolbar: true
          },
          code: d3,
          delimiter: n
        },
        data: initialData || { blocks: [] },
        placeholder: this.options.placeholder || "Start writing or press Tab for commands...",
        onChange: async () => {
          this._emitChange();
        },
        onReady: () => {
          this.#isReady = true;
        }
      });
      await this.#editor.isReady;
      this.#isReady = true;
      this.#lastSavedData = await this.#editor.save();
      return this.#editor;
    }
    // ============================================
    // ABSTRACT METHOD IMPLEMENTATIONS
    // ============================================
    /**
     * Get content as JSON string
     * Note: This is async internally but returns a promise that resolves to string
     * @returns {string} JSON string of editor data
     */
    getContent() {
      if (this.#lastSavedData) {
        return JSON.stringify(this.#lastSavedData);
      }
      return '{"blocks":[]}';
    }
    /**
     * Get content asynchronously (preferred method)
     * @returns {Promise<string>} JSON string of editor data
     */
    async getContentAsync() {
      if (!this.#isReady) {
        await this.#readyPromise;
      }
      const data = await this.#editor.save();
      this.#lastSavedData = data;
      return JSON.stringify(data);
    }
    /**
     * Set editor content from JSON string or object
     * @param {string|Object} content - JSON string or data object
     */
    setContent(content) {
      if (!this.#isReady) {
        this.#readyPromise.then(() => this.setContent(content));
        return;
      }
      let data = content;
      if (typeof content === "string") {
        try {
          data = JSON.parse(content);
        } catch (e) {
          console.warn("[BlockEditor] Failed to parse content as JSON:", e);
          data = { blocks: [] };
        }
      }
      this.#editor.render(data);
      this.#lastSavedData = data;
    }
    /**
     * Get selection - not applicable for block editor
     * @returns {{ start: number, end: number, text: string }}
     */
    getSelection() {
      return { start: 0, end: 0, text: "" };
    }
    /**
     * Insert text - not directly supported, use blocks instead
     * @param {string} text
     */
    insertAtCursor(text) {
      console.warn("[BlockEditor] insertAtCursor not supported, use block API instead");
    }
    /**
     * Wrap selection - not applicable for block editor
     */
    wrapSelection(prefix, suffix, placeholder = "") {
      console.warn("[BlockEditor] wrapSelection not supported, use inline tools instead");
    }
    /**
     * Focus the editor
     */
    focus() {
      if (this.#isReady && this.#editor) {
        const blocks = this.#editor.blocks;
        if (blocks.getBlocksCount() > 0) {
          blocks.getBlockByIndex(blocks.getBlocksCount() - 1)?.holder?.focus();
        }
      }
    }
    /**
     * Destroy the editor
     */
    destroy() {
      if (this.#editor) {
        this.#editor.destroy();
        this.#editor = null;
      }
      this.#isReady = false;
    }
    // ============================================
    // BLOCK EDITOR SPECIFIC METHODS
    // ============================================
    /**
     * Check if editor is ready
     * @returns {boolean}
     */
    get isReady() {
      return this.#isReady;
    }
    /**
     * Wait for editor to be ready
     * @returns {Promise}
     */
    async whenReady() {
      if (this.#isReady) return;
      await this.#readyPromise;
    }
    /**
     * Get the underlying Editor.js instance
     * @returns {EditorJS}
     */
    getEditorInstance() {
      return this.#editor;
    }
    /**
     * Check if content is empty
     * @returns {boolean}
     */
    isEmpty() {
      if (!this.#lastSavedData) return true;
      return !this.#lastSavedData.blocks || this.#lastSavedData.blocks.length === 0;
    }
    /**
     * Get block count
     * @returns {number}
     */
    getBlockCount() {
      if (!this.#lastSavedData?.blocks) return 0;
      return this.#lastSavedData.blocks.length;
    }
  };
  EditorCore2.register("block", BlockEditor);
  window.BlockEditor = BlockEditor;

  // web/static/js/src/editor/post-editor.js
  (function() {
    "use strict";
    const AUTOSAVE_DELAY = 2e3;
    const COVER_PREVIEW_DELAY = 500;
    const TIME_UPDATE_INTERVAL = 6e4;
    let autosaveTimeout = null;
    let coverPreviewTimeout = null;
    let timeUpdateInterval = null;
    let lastSavedContent = null;
    let isNewPost = false;
    let editorLayout = null;
    let form = null;
    let titleInput = null;
    let contentTextarea = null;
    let titleDisplay = null;
    let statusEl = null;
    let actionField = null;
    let editorInstance = null;
    let editorType = "markdown";
    function init4() {
      editorLayout = document.querySelector("[data-editor]");
      if (!editorLayout) return;
      form = document.getElementById("post-editor-form");
      if (!form) return;
      isNewPost = editorLayout.dataset.isNew === "true";
      editorType = editorLayout.dataset.editorType || "markdown";
      titleInput = document.getElementById("title");
      contentTextarea = document.getElementById("content");
      titleDisplay = document.querySelector("[data-title-display]");
      statusEl = document.querySelector("[data-status]");
      actionField = document.querySelector("[data-action-field]");
      initEditor();
      updateLastSavedContent();
      setupTitleSync();
      setupAutosave();
      setupSidebarSync();
      setupActionButtons();
      setupPublishDropdown();
      setupCoverImagePreview();
      setupRelativeTimeUpdates();
      setupFormSubmission();
      if (isNewPost) {
        setupSlugGeneration();
      }
    }
    function initEditor() {
      const editorMount = document.querySelector("[data-editor-mount]");
      if (!editorMount || !window.EditorCore) return;
      if (editorType === "block") {
        const blockContainer = document.createElement("div");
        blockContainer.className = "block-editor-container";
        blockContainer.id = "block-editor-container";
        if (contentTextarea) {
          contentTextarea.style.display = "none";
          contentTextarea.parentNode.insertBefore(blockContainer, contentTextarea);
        }
        const initialContent = contentTextarea?.value || "";
        editorInstance = window.EditorCore.create("block", blockContainer, {
          placeholder: "Start writing...",
          initialData: initialContent
        });
        if (editorInstance) {
          editorInstance.on("change", handleEditorChange);
        }
      } else {
        if (contentTextarea) {
          contentTextarea.addEventListener("input", handleEditorChange);
        }
      }
    }
    function handleEditorChange() {
      checkForUnsavedChanges();
      if (autosaveTimeout) {
        clearTimeout(autosaveTimeout);
      }
      if (!isNewPost) {
        autosaveTimeout = setTimeout(() => {
          performSave("save");
        }, AUTOSAVE_DELAY);
      }
    }
    async function getContentSnapshot() {
      let content = "";
      if (editorType === "block" && editorInstance) {
        if (typeof editorInstance.getContentAsync === "function") {
          content = await editorInstance.getContentAsync();
        } else {
          content = editorInstance.getContent();
        }
      } else {
        content = contentTextarea?.value || "";
      }
      return {
        title: titleInput?.value || "",
        content,
        slug: document.getElementById("slug")?.value || "",
        excerpt: document.getElementById("excerpt")?.value || "",
        cover_image: document.getElementById("cover_image")?.value || ""
      };
    }
    function getContentSnapshotSync() {
      let content = "";
      if (editorType === "block" && editorInstance) {
        content = editorInstance.getContent();
      } else {
        content = contentTextarea?.value || "";
      }
      return {
        title: titleInput?.value || "",
        content,
        slug: document.getElementById("slug")?.value || "",
        excerpt: document.getElementById("excerpt")?.value || "",
        cover_image: document.getElementById("cover_image")?.value || ""
      };
    }
    async function updateLastSavedContent() {
      lastSavedContent = await getContentSnapshot();
    }
    function hasUnsavedChanges() {
      if (!lastSavedContent) return false;
      const current = getContentSnapshotSync();
      return current.title !== lastSavedContent.title || current.content !== lastSavedContent.content || current.slug !== lastSavedContent.slug || current.excerpt !== lastSavedContent.excerpt || current.cover_image !== lastSavedContent.cover_image;
    }
    function checkForUnsavedChanges() {
      if (hasUnsavedChanges()) {
        updateStatus("unsaved");
      }
    }
    function setupTitleSync() {
      if (!titleInput || !titleDisplay) return;
      titleInput.addEventListener("input", () => {
        const title = titleInput.value.trim() || "Untitled";
        titleDisplay.textContent = title;
      });
    }
    function setupAutosave() {
      if (isNewPost) return;
      const autosaveUrl = form.dataset.autosave;
      if (!autosaveUrl) return;
      titleInput?.addEventListener("input", handleEditorChange);
      document.querySelectorAll("[data-sync]").forEach((input) => {
        input.addEventListener("input", handleEditorChange);
      });
    }
    async function performSave(action) {
      if (isNewPost && action === "save") {
        return;
      }
      const autosaveUrl = form.dataset.autosave;
      if (!autosaveUrl) return;
      updateStatus("saving");
      try {
        await syncEditorToForm();
        const csrfInput = form.querySelector('input[name="csrf_token"]');
        const csrfToken = csrfInput?.value || "";
        if (actionField) {
          actionField.value = action;
        }
        const formData = new FormData(form);
        const response = await fetch(autosaveUrl, {
          method: "PATCH",
          headers: {
            "X-CSRF-Token": csrfToken
          },
          body: formData
        });
        if (response.ok) {
          const data = await response.json();
          await updateLastSavedContent();
          updateStatus("saved", data.updated_at);
          if (data.is_draft !== void 0) {
            updatePublishState(data.is_draft);
          }
          if (action === "publish" || action === "unpublish") {
          }
        } else {
          const errorText = await response.text();
          console.error("Save failed:", errorText);
          updateStatus("error", null, errorText);
        }
      } catch (error) {
        console.error("Save error:", error);
        updateStatus("error", null, error.message);
      }
    }
    function setupFormSubmission() {
      if (!form) return;
      form.addEventListener("submit", async (e) => {
        if (editorType === "block") {
          e.preventDefault();
          await syncEditorToForm();
          form.submit();
        }
      });
    }
    async function syncEditorToForm() {
      if (!contentTextarea) return;
      if (editorType === "block" && editorInstance) {
        let content = "";
        if (typeof editorInstance.getContentAsync === "function") {
          content = await editorInstance.getContentAsync();
        } else {
          content = editorInstance.getContent();
        }
        contentTextarea.value = content;
      }
    }
    function updateStatus(state, timestamp, errorMessage) {
      if (!statusEl) return;
      switch (state) {
        case "saving":
          statusEl.innerHTML = '<span class="editor-status-saving">Saving...</span>';
          break;
        case "saved":
          const timeStr = timestamp ? formatRelativeTime(new Date(timestamp)) : "just now";
          statusEl.innerHTML = `<span class="editor-status-saved" data-updated-at="${timestamp || (/* @__PURE__ */ new Date()).toISOString()}">Last saved: ${timeStr}</span>`;
          break;
        case "unsaved":
          statusEl.innerHTML = '<span class="editor-status-unsaved">Unsaved changes</span>';
          break;
        case "error":
          const msg = errorMessage || "Save failed";
          statusEl.innerHTML = `<span class="editor-status-error">${msg}</span>`;
          break;
      }
    }
    function formatRelativeTime(date) {
      const now = /* @__PURE__ */ new Date();
      const diff = now - date;
      const seconds = Math.floor(diff / 1e3);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      if (seconds < 60) return "just now";
      if (minutes === 1) return "1 minute ago";
      if (minutes < 60) return `${minutes} minutes ago`;
      if (hours === 1) return "1 hour ago";
      if (hours < 24) return `${hours} hours ago`;
      if (days === 1) return "yesterday";
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : void 0
      });
    }
    function setupRelativeTimeUpdates() {
      timeUpdateInterval = setInterval(() => {
        const savedSpan = statusEl?.querySelector("[data-updated-at]");
        if (savedSpan) {
          const timestamp = savedSpan.dataset.updatedAt;
          if (timestamp) {
            const timeStr = formatRelativeTime(new Date(timestamp));
            savedSpan.textContent = `Last saved: ${timeStr}`;
          }
        }
      }, TIME_UPDATE_INTERVAL);
    }
    function setupActionButtons() {
      document.querySelectorAll('[data-action-btn="save"]').forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          if (isNewPost) {
            if (actionField) actionField.value = "save";
            const draftInput = document.getElementById("is_draft");
            if (draftInput) draftInput.value = "true";
            await syncEditorToForm();
            form.submit();
          } else {
            performSave("save");
          }
        });
      });
      document.querySelectorAll('[data-action-btn="publish"]').forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          if (isNewPost) {
            if (actionField) actionField.value = "publish";
            const draftInput = document.getElementById("is_draft");
            if (draftInput) draftInput.value = "false";
            await syncEditorToForm();
            form.submit();
          } else {
            performSave("publish");
          }
        });
      });
      document.querySelectorAll('[data-action-btn="unpublish"]').forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          performSave("unpublish");
        });
      });
    }
    function updatePublishState(isDraft) {
    }
    function setupPublishDropdown() {
      const dropdown = document.querySelector("[data-dropdown-container]");
      if (!dropdown) return;
      const trigger = dropdown.querySelector("[data-dropdown-trigger]");
      const menu = dropdown.querySelector("[data-dropdown-menu]");
      if (!trigger || !menu) return;
      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("open");
      });
      document.addEventListener("click", (e) => {
        if (!dropdown.contains(e.target)) {
          dropdown.classList.remove("open");
        }
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          dropdown.classList.remove("open");
        }
      });
    }
    function setupSidebarSync() {
      document.querySelectorAll("[data-sync]").forEach((input) => {
        const targetId = input.dataset.sync;
        const hiddenInput = document.getElementById(targetId);
        if (!hiddenInput) return;
        input.addEventListener("input", () => {
          if (input.type === "checkbox") {
            hiddenInput.value = input.checked ? "true" : "false";
          } else {
            hiddenInput.value = input.value;
          }
        });
      });
      const tagSelect = document.querySelector("ec-tag-select");
      if (tagSelect) {
        tagSelect.addEventListener("change", () => {
          syncTagsToForm();
        });
        tagSelect.addEventListener("click", (e) => {
          if (e.target.type === "checkbox") {
            setTimeout(syncTagsToForm, 0);
          }
        });
      }
    }
    function syncTagsToForm() {
      const container = document.getElementById("tag-ids-container");
      if (!container) return;
      container.innerHTML = "";
      const selectedTags = document.querySelectorAll(
        'input[name="sidebar_tag_ids"]:checked'
      );
      selectedTags.forEach((tag) => {
        const hiddenInput = document.createElement("input");
        hiddenInput.type = "hidden";
        hiddenInput.name = "tag_ids";
        hiddenInput.value = tag.value;
        hiddenInput.dataset.tagId = tag.value;
        container.appendChild(hiddenInput);
      });
    }
    function setupCoverImagePreview() {
      const coverInput = document.querySelector("[data-preview-trigger]");
      const previewContainer = document.querySelector("[data-cover-preview]");
      if (!coverInput || !previewContainer) return;
      coverInput.addEventListener("input", () => {
        if (coverPreviewTimeout) {
          clearTimeout(coverPreviewTimeout);
        }
        coverPreviewTimeout = setTimeout(() => {
          updateCoverPreview(coverInput.value, previewContainer);
        }, COVER_PREVIEW_DELAY);
      });
    }
    function updateCoverPreview(url, container) {
      const existingImg = container.querySelector("img");
      if (existingImg) {
        existingImg.remove();
      }
      container.classList.remove("error");
      if (!url) return;
      const img = document.createElement("img");
      img.src = url;
      img.alt = "Cover preview";
      img.className = "cover-image-preview-img";
      img.onload = () => {
        container.classList.remove("error");
      };
      img.onerror = () => {
        container.classList.add("error");
      };
      container.insertBefore(img, container.firstChild);
    }
    function setupSlugGeneration() {
      if (!titleInput) return;
      const slugInput = document.getElementById("slug");
      const sidebarSlug = document.getElementById("sidebar-slug");
      let userEditedSlug = false;
      if (sidebarSlug) {
        sidebarSlug.addEventListener("input", () => {
          userEditedSlug = true;
        });
      }
      titleInput.addEventListener("input", () => {
        if (userEditedSlug) return;
        const slug = generateSlug(titleInput.value);
        if (slugInput) {
          slugInput.value = slug;
        }
        if (sidebarSlug) {
          sidebarSlug.value = slug;
        }
      });
    }
    function generateSlug(text) {
      return text.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").substring(0, 100);
    }
    function cleanup() {
      if (autosaveTimeout) clearTimeout(autosaveTimeout);
      if (coverPreviewTimeout) clearTimeout(coverPreviewTimeout);
      if (timeUpdateInterval) clearInterval(timeUpdateInterval);
      if (editorInstance && typeof editorInstance.destroy === "function") {
        editorInstance.destroy();
        editorInstance = null;
      }
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init4);
    } else {
      init4();
    }
    window.addEventListener("beforeunload", cleanup);
    document.addEventListener("htmx:afterSettle", init4);
  })();
})();
/*!
 * CodeX.Tooltips
 * 
 * @version 1.0.5
 * 
 * @licence MIT
 * @author CodeX <https://codex.so>
 * 
 * 
 */
/*!
 * Library for handling keyboard shortcuts
 * @copyright CodeX (https://codex.so)
 * @license MIT
 * @author CodeX (https://codex.so)
 * @version 1.2.0
 */
/**
 * Base Paragraph Block for the Editor.js.
 * Represents a regular text block
 *
 * @author CodeX (team@codex.so)
 * @copyright CodeX 2018
 * @license The MIT License (MIT)
 */
/**
 * Editor.js
 *
 * @license Apache-2.0
 * @see Editor.js <https://editorjs.io>
 * @author CodeX Team <https://codex.so>
 */
/**
 * Header block for the Editor.js.
 *
 * @author CodeX (team@ifmo.su)
 * @copyright CodeX 2018
 * @license MIT
 * @version 2.0.0
 */
/**
 * CodeTool for Editor.js
 *
 * @author CodeX (team@ifmo.su)
 * @copyright CodeX 2018
 * @license MIT
 * @version 2.0.0
 */
/**
 * Delimiter Block for the Editor.js.
 *
 * @author CodeX (team@ifmo.su)
 * @copyright CodeX 2018
 * @license The MIT License (MIT)
 * @version 2.0.0
 */
//# sourceMappingURL=bundle.js.map
