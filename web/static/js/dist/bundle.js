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
  function setProgress(n) {
    n = Math.max(0, Math.min(1, n));
    currentProgress = n;
    const inner = bar.querySelector(".progress-bar-inner");
    if (inner) {
      inner.style.transform = "translateX(" + (-100 + n * 100) + "%)";
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
      const lastIndex = cards.findIndex((c) => getBookmarkId(c) === selectionState.lastSelectedId);
      const targetIndex = cards.findIndex((c) => getBookmarkId(c) === targetId);
      if (lastIndex === -1 || targetIndex === -1) {
        selectCard(targetCard);
        return;
      }
      const startIndex = Math.min(lastIndex, targetIndex);
      const endIndex = Math.max(lastIndex, targetIndex);
      for (let i = startIndex; i <= endIndex && selectionState.selectedIds.size < SELECTION_CONFIG.maxSelection; i++) {
        const card = cards[i];
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
      for (let i = 0; i < maxToSelect; i++) {
        selectionState.selectedIds.add(getBookmarkId(cards[i]));
        updateCardSelectionVisual(cards[i]);
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
      moveMenuState.focusedIndex = collections.findIndex((c) => !c.isCurrent);
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
          (c) => selectionState.selectedIds.has(c.dataset.bookmarkId)
        );
        dragState.sourcePositions = dragState.draggedCards.map((c) => ({
          card: c,
          column: c.closest(".kanban-column-content"),
          nextSibling: c.nextElementSibling
        }));
        setTimeout(() => {
          dragState.draggedCards.forEach((c, i) => {
            c.classList.add("dragging");
            if (c !== card) {
              c.classList.add("multi-drag-secondary");
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
      dragState.draggedCards.forEach((c) => {
        c.classList.remove("dragging");
        c.classList.remove("multi-drag-secondary");
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
        draggedCards.forEach((c) => {
          c.classList.remove("dragging");
          c.classList.remove("multi-drag-secondary");
        });
        removeMultiDragBadge();
        draggedCards.forEach((c) => {
          if (insertBefore) {
            column.insertBefore(c, insertBefore);
          } else {
            column.appendChild(c);
          }
        });
        const firstInsertedCard = draggedCards[0];
        const afterBookmarkId = getAfterBookmarkId(firstInsertedCard);
        const newCollectionId = column.dataset.collectionId || "";
        const positionChanged = column !== sourceColumn || draggedCards.some((c, i) => getCardIndex(c) !== sourceIndex + i);
        if (positionChanged) {
          const bookmarkIds = draggedCards.map((c) => parseInt(c.dataset.bookmarkId, 10));
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
      for (let i = columns.length - 1; i >= 0; i--) {
        const cards = getCardsInColumn(columns[i]);
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
        (o) => o.getAttribute("data-selected") === "true"
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
      this.#options.forEach((o) => {
        o.removeAttribute("data-selected");
        o.setAttribute("aria-selected", "false");
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
      const opt = this.#options.find((o) => o.dataset.value === value);
      if (opt) {
        if (this.#labelEl) {
          this.#labelEl.textContent = opt.textContent.trim();
        }
        this.#options.forEach((o) => {
          o.removeAttribute("data-selected");
          o.setAttribute("aria-selected", "false");
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
        (o) => o === document.activeElement || o.getAttribute("data-selected") === "true"
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
    function init4() {
      editorLayout = document.querySelector("[data-editor]");
      if (!editorLayout) return;
      form = document.getElementById("post-editor-form");
      if (!form) return;
      isNewPost = editorLayout.dataset.isNew === "true";
      titleInput = document.getElementById("title");
      contentTextarea = document.getElementById("content");
      titleDisplay = document.querySelector("[data-title-display]");
      statusEl = document.querySelector("[data-status]");
      actionField = document.querySelector("[data-action-field]");
      lastSavedContent = getContentSnapshot();
      setupTitleSync();
      setupAutosave();
      setupSidebarSync();
      setupActionButtons();
      setupPublishDropdown();
      setupCoverImagePreview();
      setupRelativeTimeUpdates();
      if (isNewPost) {
        setupSlugGeneration();
      }
    }
    function getContentSnapshot() {
      return {
        title: titleInput?.value || "",
        content: contentTextarea?.value || "",
        slug: document.getElementById("slug")?.value || "",
        excerpt: document.getElementById("excerpt")?.value || "",
        cover_image: document.getElementById("cover_image")?.value || ""
      };
    }
    function hasUnsavedChanges() {
      if (!lastSavedContent) return false;
      const current = getContentSnapshot();
      return current.title !== lastSavedContent.title || current.content !== lastSavedContent.content || current.slug !== lastSavedContent.slug || current.excerpt !== lastSavedContent.excerpt || current.cover_image !== lastSavedContent.cover_image;
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
      const handleChange = () => {
        if (hasUnsavedChanges()) {
          updateStatus("unsaved");
        }
        if (autosaveTimeout) {
          clearTimeout(autosaveTimeout);
        }
        autosaveTimeout = setTimeout(() => {
          performSave("save");
        }, AUTOSAVE_DELAY);
      };
      titleInput?.addEventListener("input", handleChange);
      contentTextarea?.addEventListener("input", handleChange);
      document.querySelectorAll("[data-sync]").forEach((input) => {
        input.addEventListener("input", handleChange);
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
          lastSavedContent = getContentSnapshot();
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
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          if (isNewPost) {
            if (actionField) actionField.value = "save";
            const draftInput = document.getElementById("is_draft");
            if (draftInput) draftInput.value = "true";
            form.submit();
          } else {
            performSave("save");
          }
        });
      });
      document.querySelectorAll('[data-action-btn="publish"]').forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          if (isNewPost) {
            if (actionField) actionField.value = "publish";
            const draftInput = document.getElementById("is_draft");
            if (draftInput) draftInput.value = "false";
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
//# sourceMappingURL=bundle.js.map
