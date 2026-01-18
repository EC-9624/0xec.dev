/**
 * Kanban Board Component
 * Native HTML5 Drag-and-Drop with keyboard accessibility
 */
(function () {
  "use strict";

  // ============================================
  // CONFIGURATION
  // ============================================

  const SCROLL_CONFIG = {
    edgeThreshold: 60,    // px from edge to start scrolling
    maxScrollSpeed: 15,   // max px per frame
    minScrollSpeed: 3,    // min px per frame
  };

  const SELECTION_CONFIG = {
    maxSelection: 50,     // Maximum cards that can be selected
  };

  // ============================================
  // STATE FACTORY FUNCTIONS
  // ============================================

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
      columnContainer: null,
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
      selectedIds: new Set(),
      lastSelectedId: null,
      columnId: null,
    };
  }

  function createMoveMenuState() {
    return {
      isOpen: false,
      focusedIndex: 0,
      collections: [],
      previousFocus: null,
    };
  }

  // ============================================
  // STATE OBJECTS
  // ============================================

  const dragState = createDragState();
  const scrollState = createScrollState();
  const keyboardDragState = createKeyboardDragState();
  const selectionState = createSelectionState();
  const moveMenuState = createMoveMenuState();

  // ============================================
  // STATE RESET FUNCTIONS
  // ============================================

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

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  /**
   * Show error toast or fallback to alert
   */
  function showErrorToast(message) {
    if (typeof window.showToast === "function") {
      window.showToast(message, "error");
    } else {
      alert(message);
    }
  }

  /**
   * Pluralize a word based on count
   */
  function pluralize(count, singular, plural) {
    return count === 1 ? singular : (plural || singular + "s");
  }

  /**
   * Announce a count-based message
   */
  function announceCount(count, action, noun = "item") {
    announce(`${count} ${pluralize(count, noun)} ${action}`);
  }

  /**
   * Get a card element by bookmark ID
   */
  function getCardById(bookmarkId) {
    return document.querySelector(`.kanban-card[data-bookmark-id="${bookmarkId}"]`);
  }

  /**
   * Get the column content element containing a card
   */
  function getColumnContent(card) {
    return card.closest(".kanban-column-content");
  }

  /**
   * Get all cards in a column
   */
  function getColumnCards(columnContent) {
    return Array.from(columnContent.querySelectorAll(".kanban-card"));
  }

  /**
   * Get CSRF token from page (hx-headers or cookie)
   */
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
        // Ignore parse errors
      }
    }
    
    // Fallback: try to get from cookie
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'csrf_token') {
        return value;
      }
    }
    
    return "";
  }

  /**
   * Bulk move bookmarks API call (consolidated)
   * @param {number[]} bookmarkIds - Array of bookmark IDs to move
   * @param {string} collectionId - Target collection ID (empty string for unsorted)
   * @param {Object} options - Optional settings
   * @param {string|null} options.afterBookmarkId - Insert after this bookmark ID
   * @param {Function} options.onSuccess - Callback on success
   * @param {Function} options.onError - Callback on error
   * @returns {Promise}
   */
  function bulkMoveBookmarksAPI(bookmarkIds, collectionId, options = {}) {
    const { afterBookmarkId = null, onSuccess = null, onError = null } = options;
    const csrfToken = getCSRFToken();
    
    const payload = {
      bookmark_ids: bookmarkIds,
      collection_id: collectionId === "" ? null : parseInt(collectionId, 10),
    };
    
    if (afterBookmarkId) {
      payload.after_id = parseInt(afterBookmarkId, 10);
    }

    return fetch("/admin/htmx/bookmarks/bulk/move", {
      method: "POST",
      headers: {
        "X-CSRF-Token": csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to move bookmarks: ${response.status}`);
        }
        if (onSuccess) onSuccess();
        return response;
      })
      .catch((error) => {
        console.error("[Kanban] Error moving bookmarks:", error);
        if (onError) onError(error);
        showErrorToast("Failed to move bookmarks. Please try again.");
        throw error;
      });
  }

  // ============================================
  // SCREEN READER ANNOUNCEMENTS
  // ============================================

  /**
   * Announce message to screen readers via live region
   */
  function announce(message) {
    const liveRegion = document.getElementById("kanban-live-region");
    if (liveRegion) {
      liveRegion.textContent = "";
      requestAnimationFrame(() => {
        liveRegion.textContent = message;
      });
    }
  }

  // ============================================
  // MULTI-SELECT FUNCTIONS
  // ============================================

  /**
   * Get the column ID from a card or column element
   */
  function getColumnId(element) {
    const column = element.closest(".kanban-column");
    return column ? (column.dataset.collectionId || null) : null;
  }

  /**
   * Get bookmark ID from a card element
   */
  function getBookmarkId(card) {
    return card.dataset.bookmarkId;
  }

  /**
   * Check if a card is selected
   */
  function isSelected(card) {
    return selectionState.selectedIds.has(getBookmarkId(card));
  }

  /**
   * Update visual selection state on a card
   */
  function updateCardSelectionVisual(card) {
    if (isSelected(card)) {
      card.classList.add("selected");
      card.setAttribute("aria-selected", "true");
    } else {
      card.classList.remove("selected");
      card.setAttribute("aria-selected", "false");
    }
  }

  /**
   * Clear all selections
   */
  function clearSelection() {
    // Remove visual state from all previously selected cards
    selectionState.selectedIds.forEach((id) => {
      const card = getCardById(id);
      if (card) {
        card.classList.remove("selected");
        card.setAttribute("aria-selected", "false");
      }
    });

    selectionState.selectedIds = new Set();
    selectionState.lastSelectedId = null;
    selectionState.columnId = null;

    updateSelectionToolbar();
  }

  /**
   * Select a single card (optionally clearing others)
   */
  function selectCard(card, options = {}) {
    const { toggle = false, addToSelection = false } = options;
    const bookmarkId = getBookmarkId(card);
    const columnId = getColumnId(card);

    // If clicking in a different column, clear selection first
    if (selectionState.columnId !== null && selectionState.columnId !== columnId && selectionState.selectedIds.size > 0) {
      clearSelection();
    }

    if (toggle) {
      // Toggle mode (Cmd/Ctrl+Click)
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
      // Add to selection (used by range select)
      if (selectionState.selectedIds.size < SELECTION_CONFIG.maxSelection) {
        selectionState.selectedIds.add(bookmarkId);
        selectionState.columnId = columnId;
      }
    } else {
      // Exclusive selection (plain click)
      clearSelection();
      selectionState.selectedIds.add(bookmarkId);
      selectionState.lastSelectedId = bookmarkId;
      selectionState.columnId = columnId;
    }

    updateCardSelectionVisual(card);
    updateSelectionToolbar();
  }

  /**
   * Select a range of cards between lastSelectedId and the target card
   */
  function selectRange(targetCard) {
    const columnId = getColumnId(targetCard);

    // If no previous selection or different column, just select the target
    if (!selectionState.lastSelectedId || selectionState.columnId !== columnId) {
      selectCard(targetCard);
      return;
    }

    const column = targetCard.closest(".kanban-column-content");
    const cards = Array.from(column.querySelectorAll(".kanban-card"));
    const targetId = getBookmarkId(targetCard);

    // Find indices
    const lastIndex = cards.findIndex((c) => getBookmarkId(c) === selectionState.lastSelectedId);
    const targetIndex = cards.findIndex((c) => getBookmarkId(c) === targetId);

    if (lastIndex === -1 || targetIndex === -1) {
      selectCard(targetCard);
      return;
    }

    // Select all cards in range
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

  /**
   * Extend selection in a direction (for Shift+Arrow keys)
   * direction: -1 for up, 1 for down
   */
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

    // If selecting in a different column, clear and start fresh
    if (selectionState.columnId !== null && selectionState.columnId !== columnId) {
      clearSelection();
    }

    // Ensure current card is selected
    if (!selectionState.selectedIds.has(getBookmarkId(card))) {
      selectionState.selectedIds.add(getBookmarkId(card));
      selectionState.lastSelectedId = getBookmarkId(card);
      selectionState.columnId = columnId;
      updateCardSelectionVisual(card);
    }

    // Toggle or add target card to selection
    if (selectionState.selectedIds.has(targetId)) {
      // If target already selected, we might be contracting selection
      // Check if current card should be deselected (contracting)
      const currentId = getBookmarkId(card);
      // Only deselect current if we're moving back toward anchor
      // For simplicity, just move focus without deselecting
      selectionState.selectedIds.delete(currentId);
      updateCardSelectionVisual(card);
    } else {
      // Extend selection to include target
      if (selectionState.selectedIds.size < SELECTION_CONFIG.maxSelection) {
        selectionState.selectedIds.add(targetId);
        updateCardSelectionVisual(targetCard);
      }
    }

    selectionState.lastSelectedId = targetId;
    updateSelectionToolbar();

    // Move focus to target
    targetCard.focus();
    scrollCardIntoView(targetCard);

    const count = selectionState.selectedIds.size;
    announce(`${count} item${count !== 1 ? "s" : ""} selected`);
  }

  /**
   * Select all cards in the current column
   */
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

  /**
   * Get all selected card elements
   */
  function getSelectedCards() {
    const cards = [];
    selectionState.selectedIds.forEach((id) => {
      const card = getCardById(id);
      if (card) cards.push(card);
    });
    return cards;
  }

  /**
   * Get selected bookmark IDs as array of integers
   */
  function getSelectedBookmarkIds() {
    return Array.from(selectionState.selectedIds).map((id) => parseInt(id, 10));
  }

  /**
   * Update the selection toolbar visibility and count
   */
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

  /**
   * Handle card click for selection
   */
  function handleCardClick(e) {
    const card = e.target.closest(".kanban-card");
    if (!card) return;

    // Don't handle selection if clicking on interactive elements inside the card
    if (e.target.closest("button, a, [data-dropdown-trigger], [data-dropdown-option]")) {
      return;
    }

    // Don't handle if we're in keyboard drag mode
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
      // Plain click - select only this card
      selectCard(card);
    }
  }

  /**
   * Handle click on empty space to clear selection
   */
  function handleBoardClick(e) {
    // If click was on empty space (not on a card), clear selection
    if (!e.target.closest(".kanban-card") && 
        !e.target.closest("#kanban-selection-toolbar") &&
        !e.target.closest("#kanban-move-menu")) {
      clearSelection();
    }
  }

  // ============================================
  // KEYBOARD MOVE MENU
  // ============================================

  /**
   * Open the keyboard-navigable move menu
   */
  function openMoveMenu() {
    if (selectionState.selectedIds.size < 2) return;

    // Store current focus to return to later
    moveMenuState.previousFocus = document.activeElement;

    // Build collections list from existing selection toolbar dropdown
    const collections = [];
    const currentColumnId = selectionState.columnId;

    // Add Unsorted first
    collections.push({
      id: "",
      name: "Unsorted",
      color: null,
      isCurrent: currentColumnId === null || currentColumnId === "",
    });

    // Get collections from existing dropdown
    document.querySelectorAll("[data-selection-move-menu] [data-move-collection-id]").forEach((el) => {
      const id = el.dataset.moveCollectionId;
      if (id !== "") {
        const colorEl = el.querySelector(".selection-move-option-color");
        collections.push({
          id: id,
          name: el.querySelector("span:last-child")?.textContent.trim() || "Collection",
          color: colorEl ? colorEl.style.backgroundColor : null,
          isCurrent: id === currentColumnId,
        });
      }
    });

    moveMenuState.collections = collections;
    // Set initial focus to first non-current item, or first item
    moveMenuState.focusedIndex = collections.findIndex((c) => !c.isCurrent);
    if (moveMenuState.focusedIndex === -1) moveMenuState.focusedIndex = 0;

    // Render and show menu
    renderMoveMenu();
    
    const menu = document.getElementById("kanban-move-menu");
    const backdrop = document.getElementById("kanban-move-menu-backdrop");
    if (menu) {
      menu.classList.remove("hidden");
      moveMenuState.isOpen = true;
      // Focus the menu for keyboard events
      menu.focus();
    }
    if (backdrop) {
      backdrop.classList.remove("hidden");
    }

    // Update count in header
    const countEl = document.getElementById("move-menu-count");
    if (countEl) {
      countEl.textContent = selectionState.selectedIds.size;
    }

    announce(`Move menu opened. ${collections.length} options. Use arrow keys to navigate.`);
  }

  /**
   * Close the move menu
   */
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

    // Return focus to previous element
    if (moveMenuState.previousFocus && moveMenuState.previousFocus.focus) {
      moveMenuState.previousFocus.focus();
    }
    moveMenuState.previousFocus = null;
  }

  /**
   * Render the move menu items
   */
  function renderMoveMenu() {
    const list = document.querySelector(".kanban-move-menu-list");
    if (!list) return;

    list.innerHTML = moveMenuState.collections
      .map((item, index) => {
        const isFocused = index === moveMenuState.focusedIndex;
        const shortcut = index < 9 ? index + 1 : null;

        return `
          <div class="kanban-move-menu-item ${item.isCurrent ? "current" : ""} ${isFocused ? "focused" : ""}"
               role="option"
               data-index="${index}"
               data-collection-id="${item.id}"
               aria-selected="${isFocused}"
               ${item.isCurrent ? 'aria-disabled="true"' : ""}>
            ${
              item.color
                ? `<span class="kanban-move-menu-item-color" style="background-color: ${item.color}"></span>`
                : `<svg class="kanban-move-menu-item-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>`
            }
            <span class="kanban-move-menu-item-name">${item.name}</span>
            ${shortcut ? `<span class="kanban-move-menu-item-shortcut">${shortcut}</span>` : ""}
          </div>
        `;
      })
      .join("");

    // Add click handlers to items
    list.querySelectorAll(".kanban-move-menu-item:not(.current)").forEach((el) => {
      el.addEventListener("click", () => {
        const index = parseInt(el.dataset.index, 10);
        moveMenuState.focusedIndex = index;
        selectMoveMenuItem();
      });
    });
  }

  /**
   * Navigate the move menu (up/down)
   */
  function navigateMoveMenu(direction) {
    const { collections, focusedIndex } = moveMenuState;
    let newIndex = focusedIndex;

    // Find next non-current item in direction
    let attempts = 0;
    do {
      newIndex = newIndex + direction;
      // Wrap around
      if (newIndex < 0) newIndex = collections.length - 1;
      if (newIndex >= collections.length) newIndex = 0;
      attempts++;
    } while (collections[newIndex].isCurrent && attempts < collections.length);

    moveMenuState.focusedIndex = newIndex;
    updateMoveMenuFocus();

    const item = collections[newIndex];
    announce(`${item.name}${item.isCurrent ? " (current)" : ""}`);
  }

  /**
   * Update visual focus indicator in move menu
   */
  function updateMoveMenuFocus() {
    const list = document.querySelector(".kanban-move-menu-list");
    if (!list) return;

    list.querySelectorAll(".kanban-move-menu-item").forEach((el, index) => {
      const isFocused = index === moveMenuState.focusedIndex;
      el.classList.toggle("focused", isFocused);
      el.setAttribute("aria-selected", isFocused);
    });

    // Scroll focused item into view
    const focusedEl = list.querySelector(".kanban-move-menu-item.focused");
    if (focusedEl) {
      focusedEl.scrollIntoView({ block: "nearest" });
    }
  }

  /**
   * Select the currently focused menu item and move bookmarks
   */
  function selectMoveMenuItem() {
    const item = moveMenuState.collections[moveMenuState.focusedIndex];
    if (!item || item.isCurrent) return;

    closeMoveMenu();
    handleBulkMove(item.id);
  }

  /**
   * Handle quick select by number (1-9)
   */
  function quickSelectMoveItem(number) {
    const index = number - 1; // 1 = index 0
    if (index < 0 || index >= moveMenuState.collections.length) return;

    const item = moveMenuState.collections[index];
    if (item.isCurrent) {
      announce(`${item.name} is the current column`);
      return;
    }

    moveMenuState.focusedIndex = index;
    selectMoveMenuItem();
  }

  /**
   * Handle keyboard events for move menu
   */
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
        // Trap focus within menu
        e.preventDefault();
        break;
    }
  }

  /**
   * Handle backdrop click to close menu
   */
  function handleMoveMenuBackdropClick() {
    if (moveMenuState.isOpen) {
      closeMoveMenu();
      announce("Move menu closed");
    }
  }

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  /**
   * Get column name from column element
   */
  function getColumnName(column) {
    const header = column.querySelector(".kanban-column-title h3");
    return header ? header.textContent.trim() : "Unknown";
  }

  /**
   * Get card position info within its column
   */
  function getCardPosition(card) {
    const column = card.closest(".kanban-column-content");
    const cards = Array.from(column.querySelectorAll(".kanban-card"));
    const index = cards.indexOf(card);
    return { index: index + 1, total: cards.length };
  }

  /**
   * Get card title for announcements
   */
  function getCardTitle(card) {
    return card.getAttribute("aria-label") || "Bookmark";
  }

  /**
   * Get index of card within its column
   */
  function getCardIndex(card) {
    const column = card.closest(".kanban-column-content");
    const cards = Array.from(column.querySelectorAll(".kanban-card"));
    return cards.indexOf(card);
  }

  // ============================================
  // AUTO-SCROLL DURING DRAG
  // ============================================

  /**
   * Calculate scroll speed based on distance from edge
   * Closer to edge = faster scroll
   */
  function calculateScrollSpeed(distanceFromEdge) {
    const { edgeThreshold, maxScrollSpeed, minScrollSpeed } = SCROLL_CONFIG;
    if (distanceFromEdge >= edgeThreshold) return 0;
    
    // Linear interpolation: closer to edge = faster
    const ratio = 1 - (distanceFromEdge / edgeThreshold);
    return minScrollSpeed + (maxScrollSpeed - minScrollSpeed) * ratio;
  }

  /**
   * Update scroll direction based on cursor position
   */
  function updateScrollDirection(clientX, clientY) {
    const board = document.getElementById("kanban-board");
    if (!board) return;

    const boardRect = board.getBoundingClientRect();
    const { edgeThreshold } = SCROLL_CONFIG;

    // Horizontal scroll (board level)
    let horizontalSpeed = 0;
    const distanceFromLeft = clientX - boardRect.left;
    const distanceFromRight = boardRect.right - clientX;

    if (distanceFromLeft < edgeThreshold && board.scrollLeft > 0) {
      // Near left edge - scroll left
      horizontalSpeed = -calculateScrollSpeed(distanceFromLeft);
    } else if (distanceFromRight < edgeThreshold && 
               board.scrollLeft < board.scrollWidth - board.clientWidth) {
      // Near right edge - scroll right
      horizontalSpeed = calculateScrollSpeed(distanceFromRight);
    }

    // Vertical scroll (column level)
    let verticalSpeed = 0;
    let columnContainer = null;
    const column = document.elementFromPoint(clientX, clientY)?.closest(".kanban-column-content");
    
    if (column) {
      const columnRect = column.getBoundingClientRect();
      const distanceFromTop = clientY - columnRect.top;
      const distanceFromBottom = columnRect.bottom - clientY;

      if (distanceFromTop < edgeThreshold && column.scrollTop > 0) {
        // Near top edge - scroll up
        verticalSpeed = -calculateScrollSpeed(distanceFromTop);
        columnContainer = column;
      } else if (distanceFromBottom < edgeThreshold && 
                 column.scrollTop < column.scrollHeight - column.clientHeight) {
        // Near bottom edge - scroll down
        verticalSpeed = calculateScrollSpeed(distanceFromBottom);
        columnContainer = column;
      }
    }

    scrollState.horizontalSpeed = horizontalSpeed;
    scrollState.verticalSpeed = verticalSpeed;
    scrollState.boardContainer = board;
    scrollState.columnContainer = columnContainer;

    // Start or stop animation based on whether we need to scroll
    if (horizontalSpeed !== 0 || verticalSpeed !== 0) {
      startAutoScroll();
    } else {
      stopAutoScroll();
    }
  }

  /**
   * Start the auto-scroll animation loop
   */
  function startAutoScroll() {
    if (scrollState.animationId !== null) return; // Already running

    function scrollFrame() {
      const { horizontalSpeed, verticalSpeed, boardContainer, columnContainer } = scrollState;

      if (boardContainer && horizontalSpeed !== 0) {
        boardContainer.scrollLeft += horizontalSpeed;
      }

      if (columnContainer && verticalSpeed !== 0) {
        columnContainer.scrollTop += verticalSpeed;
      }

      // Continue animation if still dragging and need to scroll
      if (dragState.isDragging && (horizontalSpeed !== 0 || verticalSpeed !== 0)) {
        scrollState.animationId = requestAnimationFrame(scrollFrame);
      } else {
        scrollState.animationId = null;
      }
    }

    scrollState.animationId = requestAnimationFrame(scrollFrame);
  }

  /**
   * Stop the auto-scroll animation
   */
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

  // ============================================
  // NATIVE DRAG AND DROP
  // ============================================

  /**
   * Create placeholder element for drop position indicator
   */
  function createPlaceholder() {
    const el = document.createElement("div");
    el.className = "kanban-drop-placeholder";
    el.setAttribute("aria-hidden", "true");
    return el;
  }

  /**
   * Remove placeholder from DOM
   */
  function removePlaceholder() {
    if (dragState.placeholder && dragState.placeholder.parentNode) {
      dragState.placeholder.remove();
    }
  }

  /**
   * Remove all drag-over classes from columns
   */
  function removeAllDragOverClasses() {
    document.querySelectorAll(".drag-over").forEach((el) => {
      el.classList.remove("drag-over");
    });
  }

  /**
   * Calculate drop position based on mouse Y coordinate
   * Returns the card element to insert before, or null to append at end
   */
  function getDropPosition(container, mouseY) {
    const cards = Array.from(
      container.querySelectorAll(".kanban-card:not(.dragging)")
    );

    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const cardMiddle = rect.top + rect.height / 2;

      if (mouseY < cardMiddle) {
        return card; // Insert before this card
      }
    }

    return null; // Insert at end
  }

  /**
   * Update placeholder position in the column
   */
  function updatePlaceholder(column, beforeCard) {
    const { placeholder } = dragState;
    if (!placeholder) return;

    // Remove empty state if present
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

  /**
   * Handle drag start event
   */
  function handleDragStart(e) {
    const card = e.target.closest(".kanban-card");
    if (!card) return;

    const bookmarkId = card.dataset.bookmarkId;
    const isCardSelected = selectionState.selectedIds.has(bookmarkId);
    const hasMultipleSelected = selectionState.selectedIds.size > 1;

    // If dragging a card that's NOT selected, clear selection and do single drag
    if (!isCardSelected) {
      clearSelection();
    }

    dragState.isDragging = true;
    dragState.draggedCard = card;
    dragState.sourceColumn = card.closest(".kanban-column-content");
    dragState.sourceIndex = getCardIndex(card);

    // Check if this is a multi-drag scenario
    if (isCardSelected && hasMultipleSelected) {
      dragState.isMultiDrag = true;
      
      // Get all selected cards in DOM order (important for maintaining relative positions)
      const column = card.closest(".kanban-column-content");
      const allCardsInColumn = Array.from(column.querySelectorAll(".kanban-card"));
      dragState.draggedCards = allCardsInColumn.filter((c) => 
        selectionState.selectedIds.has(c.dataset.bookmarkId)
      );

      // Store original positions for potential revert
      dragState.sourcePositions = dragState.draggedCards.map((c) => ({
        card: c,
        column: c.closest(".kanban-column-content"),
        nextSibling: c.nextElementSibling
      }));

      // Add dragging class to all selected cards (with delay to not affect drag image)
      setTimeout(() => {
        dragState.draggedCards.forEach((c, i) => {
          c.classList.add("dragging");
          // Mark secondary cards for hiding
          if (c !== card) {
            c.classList.add("multi-drag-secondary");
          }
        });
        // Add multi-drag badge to primary card
        addMultiDragBadge(card, dragState.draggedCards.length);
      }, 0);
    } else {
      dragState.isMultiDrag = false;
      dragState.draggedCards = [card];
      dragState.sourcePositions = [{
        card: card,
        column: card.closest(".kanban-column-content"),
        nextSibling: card.nextElementSibling
      }];

      // Visual feedback (use timeout to avoid affecting drag image)
      setTimeout(() => {
        card.classList.add("dragging");
      }, 0);
    }

    // Set drag data
    e.dataTransfer.setData("text/plain", bookmarkId);
    e.dataTransfer.effectAllowed = "move";

    // Create placeholder
    dragState.placeholder = createPlaceholder();
  }

  /**
   * Add multi-drag badge showing count of cards being dragged
   */
  function addMultiDragBadge(card, count) {
    // Remove any existing badge
    removeMultiDragBadge();
    
    const badge = document.createElement("div");
    badge.className = "multi-drag-badge";
    badge.textContent = count;
    badge.id = "multi-drag-badge";
    card.style.position = "relative";
    card.appendChild(badge);
  }

  /**
   * Remove multi-drag badge from card
   */
  function removeMultiDragBadge() {
    const badge = document.getElementById("multi-drag-badge");
    if (badge) {
      badge.remove();
    }
  }

  /**
   * Handle drag end event
   */
  function handleDragEnd(e) {
    const card = e.target.closest(".kanban-card");
    if (!card) return;

    // Clean up all dragged cards
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

  /**
   * Handle drag over event - calculate and show drop position
   */
  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    // Update auto-scroll based on cursor position
    if (dragState.isDragging) {
      updateScrollDirection(e.clientX, e.clientY);
    }

    const column = e.target.closest(".kanban-column-content");
    if (!column || !dragState.isDragging) return;

    // Calculate drop position and show placeholder
    const afterCard = getDropPosition(column, e.clientY);
    updatePlaceholder(column, afterCard);
  }

  /**
   * Handle drag enter event - add visual feedback to column
   */
  function handleDragEnter(e) {
    const column = e.target.closest(".kanban-column-content");
    if (!column || !dragState.isDragging) return;

    column.classList.add("drag-over");
  }

  /**
   * Handle drag leave event - remove visual feedback from column
   */
  function handleDragLeave(e) {
    const column = e.target.closest(".kanban-column-content");
    if (!column) return;

    // Only remove if actually leaving the column (not entering a child)
    const relatedTarget = e.relatedTarget;
    if (!column.contains(relatedTarget)) {
      column.classList.remove("drag-over");
    }
  }

  /**
   * Handle drop event - move card to new position
   */
  function handleDrop(e) {
    e.preventDefault();
    stopAutoScroll();

    const column = e.target.closest(".kanban-column-content");
    if (!column || !dragState.draggedCard) return;

    const { draggedCard, draggedCards, sourceColumn, sourceIndex, placeholder, isMultiDrag } = dragState;

    // Get the insert position (the element to insert before)
    const insertBefore = placeholder ? placeholder.nextElementSibling : null;

    // Remove placeholder first
    removePlaceholder();
    removeAllDragOverClasses();

    if (isMultiDrag && draggedCards.length > 1) {
      // Multi-drag: insert all cards at the drop position
      // First, remove secondary cards from their hiding
      draggedCards.forEach((c) => {
        c.classList.remove("dragging");
        c.classList.remove("multi-drag-secondary");
      });
      removeMultiDragBadge();

      // Insert all cards at the position (in order)
      draggedCards.forEach((c) => {
        if (insertBefore) {
          column.insertBefore(c, insertBefore);
        } else {
          column.appendChild(c);
        }
      });

      // Calculate after_id (bookmark ID of card before our first inserted card)
      const firstInsertedCard = draggedCards[0];
      const afterBookmarkId = getAfterBookmarkId(firstInsertedCard);
      const newCollectionId = column.dataset.collectionId || "";

      // Check if position changed
      const positionChanged = column !== sourceColumn || 
        draggedCards.some((c, i) => getCardIndex(c) !== (sourceIndex + i));

      if (positionChanged) {
        // Call bulk move API with position
        const bookmarkIds = draggedCards.map((c) => parseInt(c.dataset.bookmarkId, 10));
        bulkMoveBookmarksWithPosition(bookmarkIds, newCollectionId, afterBookmarkId, draggedCards, sourceColumn);
      }

      // Clear selection after drop
      clearSelection();
    } else {
      // Single card drag (existing behavior)
      draggedCard.classList.remove("dragging");

      // Insert card at placeholder position
      if (insertBefore) {
        column.insertBefore(draggedCard, insertBefore);
      } else {
        column.appendChild(draggedCard);
      }

      // Calculate the new position (after which bookmark)
      const afterBookmarkId = getAfterBookmarkId(draggedCard);
      const newIndex = getCardIndex(draggedCard);

      // Check if position actually changed (different column OR different position in same column)
      const positionChanged = column !== sourceColumn || newIndex !== sourceIndex;

      if (positionChanged) {
        const bookmarkId = draggedCard.dataset.bookmarkId;
        const newCollectionId = column.dataset.collectionId || "";

        moveBookmark(bookmarkId, newCollectionId, afterBookmarkId, draggedCard, sourceColumn, sourceIndex);
      }
    }

    // Update counts
    updateColumnCounts();
  }

  /**
   * Bulk move bookmarks with position support (for multi-drag)
   */
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

  /**
   * Revert cards to their original positions (used on error)
   */
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

  // ============================================
  // KEYBOARD DRAG AND DROP
  // ============================================

  /**
   * Start keyboard drag mode
   */
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

  /**
   * End keyboard drag mode and commit the move
   */
  function endKeyboardDrag(cancelled = false) {
    if (!keyboardDragState.isActive) return;

    const { card, originalColumn, originalNextSibling } = keyboardDragState;
    const currentColumn = card.closest(".kanban-column-content");
    const title = getCardTitle(card);

    if (cancelled) {
      // Restore original position
      if (originalNextSibling) {
        originalColumn.insertBefore(card, originalNextSibling);
      } else {
        originalColumn.appendChild(card);
      }
      announce(`Move cancelled. ${title} returned to original position.`);
    } else {
      // Commit the move
      const columnName = getColumnName(currentColumn.closest(".kanban-column"));
      const position = getCardPosition(card);
      const currentIndex = getCardIndex(card);

      // Check if position actually changed
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

    // Clean up state
    card.classList.remove("keyboard-dragging");
    card.setAttribute("aria-grabbed", "false");
    document.querySelectorAll(".keyboard-drop-target").forEach((el) => {
      el.classList.remove("keyboard-drop-target");
    });

    // Update column counts
    updateColumnCounts();

    resetKeyboardDragState();
    card.focus();
  }

  /**
   * Move card up within column
   */
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

  /**
   * Move card down within column
   */
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

  /**
   * Move card to adjacent column (left or right)
   */
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

    // Get current position to maintain same index
    const currentCards = Array.from(currentContent.querySelectorAll(".kanban-card"));
    const currentPos = currentCards.indexOf(card);

    // Remove empty state from target if present
    const emptyState = targetContent.querySelector(".kanban-empty");
    if (emptyState) {
      emptyState.remove();
    }

    // Find target position (same index or end if fewer cards)
    const targetCards = Array.from(targetContent.querySelectorAll(".kanban-card"));
    const targetPos = Math.min(currentPos, targetCards.length);

    // Move the card
    if (targetPos < targetCards.length) {
      targetContent.insertBefore(card, targetCards[targetPos]);
    } else {
      targetContent.appendChild(card);
    }

    // Update visual feedback
    currentContent.classList.remove("keyboard-drop-target");
    targetContent.classList.add("keyboard-drop-target");

    const columnName = getColumnName(targetColumnEl);
    const position = getCardPosition(card);
    announce(`Moved to ${columnName}, position ${position.index} of ${position.total}`);
    card.focus();
  }

  /**
   * Move card to top of its column
   */
  function moveCardToTop(card) {
    const column = getColumnContent(card);
    const firstCard = column.querySelector(".kanban-card");
    if (firstCard && firstCard !== card) {
      column.insertBefore(card, firstCard);
      announcePosition(card, "Moved to top");
      scrollCardIntoView(card);
    }
  }

  /**
   * Move card to bottom of its column
   */
  function moveCardToBottom(card) {
    const column = getColumnContent(card);
    column.appendChild(card);
    announcePosition(card, "Moved to bottom");
    scrollCardIntoView(card);
  }

  /**
   * Announce card position with prefix
   */
  function announcePosition(card, prefix) {
    const position = getCardPosition(card);
    announce(`${prefix}, position ${position.index} of ${position.total}`);
  }

  // ============================================
  // KEYBOARD NAVIGATION (WITHOUT GRAB MODE)
  // ============================================

  /**
   * Scroll a card into view smoothly
   */
  function scrollCardIntoView(card) {
    if (!card) return;

    // Scroll the card into view within its column
    card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });

    // Also ensure the column is visible in the board
    const column = card.closest(".kanban-column");
    if (column) {
      const board = document.getElementById("kanban-board");
      if (board) {
        const columnRect = column.getBoundingClientRect();
        const boardRect = board.getBoundingClientRect();

        // If column is partially off-screen horizontally, scroll board
        if (columnRect.left < boardRect.left) {
          board.scrollLeft -= (boardRect.left - columnRect.left + 20);
        } else if (columnRect.right > boardRect.right) {
          board.scrollLeft += (columnRect.right - boardRect.right + 20);
        }
      }
    }
  }

  /**
   * Get all columns (excluding the "new column" button)
   */
  function getAllColumns() {
    return Array.from(
      document.querySelectorAll(".kanban-column:not(.kanban-new-column)")
    );
  }

  /**
   * Get all cards in a column
   */
  function getCardsInColumn(column) {
    const content = column.querySelector(".kanban-column-content");
    if (!content) return [];
    return Array.from(content.querySelectorAll(".kanban-card"));
  }

  /**
   * Focus card in vertical direction (up/down within column)
   */
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

  /**
   * Focus card in adjacent column (left/right)
   */
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
      // No cards in target column, try next column in same direction
      // Or just stay where we are
      return false;
    }

    // Try to maintain same index, or go to last card if target has fewer
    const currentIndex = currentCards.indexOf(card);
    const targetIndex = Math.min(currentIndex, targetCards.length - 1);
    const targetCard = targetCards[targetIndex];

    targetCard.focus();
    scrollCardIntoView(targetCard);
    return true;
  }

  /**
   * Focus first card in first column
   */
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

  /**
   * Focus last card in last column
   */
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

  // ============================================
  // QUICK ACTIONS
  // ============================================

  /**
   * Trigger edit action for a card
   */
  function triggerEditAction(card) {
    const editBtn = card.querySelector('[hx-get*="/edit-drawer"]');
    if (editBtn) {
      editBtn.click();
    }
  }

  /**
   * Open URL for a card
   */
  function triggerOpenUrl(card) {
    // Get URL from card's data or find the link in the dropdown
    const openUrlLink = card.querySelector('a[target="_blank"]');
    if (openUrlLink) {
      window.open(openUrlLink.href, "_blank", "noopener,noreferrer");
    }
  }

  /**
   * Trigger delete action for a card
   */
  function triggerDeleteAction(card) {
    const deleteBtn = card.querySelector('[hx-delete]');
    if (deleteBtn) {
      deleteBtn.click();
    }
  }

  // ============================================
  // HELP MODAL
  // ============================================

  /**
   * Toggle help modal visibility
   */
  function toggleHelpModal() {
    const modal = document.getElementById("kanban-help-modal");
    if (!modal) return;

    const isHidden = modal.classList.contains("hidden");
    if (isHidden) {
      modal.classList.remove("hidden");
      // Focus the close button
      const closeBtn = modal.querySelector("[data-close-modal]");
      if (closeBtn) closeBtn.focus();
    } else {
      modal.classList.add("hidden");
      // Return focus to the board
      const firstCard = document.querySelector(".kanban-card");
      if (firstCard) firstCard.focus();
    }
  }

  /**
   * Close help modal
   */
  function closeHelpModal() {
    const modal = document.getElementById("kanban-help-modal");
    if (modal && !modal.classList.contains("hidden")) {
      modal.classList.add("hidden");
      // Return focus to the board
      const firstCard = document.querySelector(".kanban-card");
      if (firstCard) firstCard.focus();
    }
  }

  /**
   * Handle keyboard events on cards
   */
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

  // ============================================
  // API AND STATE UPDATES
  // ============================================

  /**
   * Get the bookmark ID of the card before the given card (for position tracking)
   * Returns empty string if card is at the beginning of the column
   */
  function getAfterBookmarkId(card) {
    const prevSibling = card.previousElementSibling;
    if (prevSibling && prevSibling.classList.contains("kanban-card")) {
      return prevSibling.dataset.bookmarkId || "";
    }
    return "";
  }

  /**
   * Move a bookmark to a new position (possibly in a different collection)
   * afterBookmarkId: ID of the bookmark to insert after (empty = insert at start)
   */
  function moveBookmark(bookmarkId, collectionId, afterBookmarkId, item, fromColumn, oldIndex) {
    const url = `/admin/htmx/bookmarks/${bookmarkId}/collection`;
    const csrfToken = getCSRFToken();

    // Build request body with collection_id and after_id
    let body = `collection_id=${encodeURIComponent(collectionId)}`;
    if (afterBookmarkId) {
      body += `&after_id=${encodeURIComponent(afterBookmarkId)}`;
    }

    fetch(url, {
      method: "POST",
      headers: {
        "X-CSRF-Token": csrfToken,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to move bookmark: ${response.status}`);
        }
        // Update column counts
        updateColumnCounts();
        // Show success feedback
        showMoveSuccess(item);
      })
      .catch((error) => {
        console.error("[Kanban] Error moving bookmark:", error);
        revertMove(item, fromColumn, oldIndex);
        updateColumnCounts();
        showErrorToast("Failed to move bookmark. Please try again.");
      });
  }

  /**
   * Revert a failed move
   */
  function revertMove(item, fromColumn, oldIndex) {
    const children = Array.from(fromColumn.querySelectorAll(".kanban-card"));
    if (oldIndex >= children.length) {
      fromColumn.appendChild(item);
    } else {
      fromColumn.insertBefore(item, children[oldIndex]);
    }
  }

  /**
   * Update column counts after move
   */
  function updateColumnCounts() {
    const columns = document.querySelectorAll(".kanban-column");
    columns.forEach((column) => {
      const content = column.querySelector(".kanban-column-content");
      const countEl = column.querySelector(".kanban-column-count");
      if (content && countEl) {
        const cards = content.querySelectorAll(".kanban-card");
        countEl.textContent = cards.length.toString();

        // Update empty state
        const emptyState = content.querySelector(".kanban-empty");
        if (cards.length === 0 && !emptyState) {
          const isUnsorted = column.dataset.unsorted === "true";
          const emptyDiv = document.createElement("div");
          emptyDiv.className = "kanban-empty";
          emptyDiv.innerHTML = `<p class="kanban-empty-text">${
            isUnsorted ? "No unsorted bookmarks" : "Drop bookmarks here"
          }</p>`;
          content.appendChild(emptyDiv);
        } else if (cards.length > 0 && emptyState) {
          emptyState.remove();
        }
      }
    });
  }

  /**
   * Show success feedback on moved item
   */
  function showMoveSuccess(item) {
    item.classList.add("bg-green-50");
    setTimeout(() => {
      item.classList.remove("bg-green-50");
    }, 500);
  }

  // ============================================
  // BULK OPERATIONS
  // ============================================

  /**
   * Handle bulk delete of selected cards
   */
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
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bookmark_ids: bookmarkIds }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to delete bookmarks: ${response.status}`);
        }
        // Remove cards from DOM
        bookmarkIds.forEach((id) => {
          const card = getCardById(id);
          if (card) card.remove();
        });
        clearSelection();
        updateColumnCounts();
        announceCount(count, "deleted", "bookmark");
      })
      .catch((error) => {
        console.error("[Kanban] Error deleting bookmarks:", error);
        showErrorToast("Failed to delete bookmarks. Please try again.");
      });
  }

  /**
   * Handle bulk move of selected cards to a collection
   */
  function handleBulkMove(collectionId) {
    const count = selectionState.selectedIds.size;
    if (count === 0) return;

    const bookmarkIds = getSelectedBookmarkIds();

    bulkMoveBookmarksAPI(bookmarkIds, collectionId, {
      onSuccess: () => {
        // Move cards in DOM to target column
        const targetColumn = collectionId === ""
          ? document.querySelector('.kanban-column[data-unsorted="true"] .kanban-column-content')
          : document.querySelector(`.kanban-column[data-collection-id="${collectionId}"] .kanban-column-content`);

        if (targetColumn) {
          // Remove empty state from target if present
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

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Handle global keyboard events (for help modal, move menu, etc.)
   */
  function handleGlobalKeydown(e) {
    // Move menu keyboard handling (highest priority when open)
    if (moveMenuState.isOpen) {
      handleMoveMenuKeydown(e);
      return;
    }

    // Help modal toggle with ?
    if (e.key === "?" && !e.target.closest("input, textarea, select")) {
      e.preventDefault();
      toggleHelpModal();
      return;
    }

    // Close help modal with Escape
    if (e.key === "Escape") {
      const modal = document.getElementById("kanban-help-modal");
      if (modal && !modal.classList.contains("hidden")) {
        e.preventDefault();
        closeHelpModal();
        return;
      }
    }
  }

  /**
   * Initialize the Kanban board
   */
  function init() {
    const board = document.getElementById("kanban-board");
    if (!board) return;

    // Native drag and drop events (delegated)
    board.addEventListener("dragstart", handleDragStart);
    board.addEventListener("dragend", handleDragEnd);
    board.addEventListener("dragover", handleDragOver);
    board.addEventListener("dragenter", handleDragEnter);
    board.addEventListener("dragleave", handleDragLeave);
    board.addEventListener("drop", handleDrop);

    // Keyboard navigation on cards
    board.addEventListener("keydown", handleCardKeydown);

    // Multi-select click handling
    board.addEventListener("click", handleCardClick);

    // Clear selection when clicking empty space
    document.addEventListener("click", handleBoardClick);

    // Global keyboard events (help modal, etc.)
    document.addEventListener("keydown", handleGlobalKeydown);

    // Help modal event handlers
    const helpModal = document.getElementById("kanban-help-modal");
    if (helpModal) {
      // Close when clicking backdrop
      helpModal.addEventListener("click", (e) => {
        if (e.target === helpModal) {
          closeHelpModal();
        }
      });
      // Close button
      const closeBtn = helpModal.querySelector("[data-close-modal]");
      if (closeBtn) {
        closeBtn.addEventListener("click", closeHelpModal);
      }
    }

    // Selection toolbar event handlers
    initSelectionToolbar();

    // Move menu backdrop click handler
    const moveMenuBackdrop = document.getElementById("kanban-move-menu-backdrop");
    if (moveMenuBackdrop) {
      moveMenuBackdrop.addEventListener("click", handleMoveMenuBackdropClick);
    }

    // Listen for HTMX events to reinitialize after content changes
    document.body.addEventListener("htmx:afterSwap", handleAfterSwap);
  }

  /**
   * Initialize selection toolbar event handlers
   */
  function initSelectionToolbar() {
    const toolbar = document.getElementById("kanban-selection-toolbar");
    if (!toolbar) return;

    // Clear selection button
    const clearBtn = toolbar.querySelector(".clear-selection");
    if (clearBtn) {
      clearBtn.addEventListener("click", clearSelection);
    }

    // Delete selected button
    const deleteBtn = toolbar.querySelector(".delete-selected");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", handleBulkDelete);
    }

    // Move dropdown
    const moveDropdown = toolbar.querySelector("[data-selection-move-dropdown]");
    if (moveDropdown) {
      const trigger = moveDropdown.querySelector("[data-selection-move-trigger]");
      const menu = moveDropdown.querySelector("[data-selection-move-menu]");

      if (trigger && menu) {
        // Toggle dropdown on trigger click
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

        // Handle move option clicks
        menu.querySelectorAll("[data-move-collection-id]").forEach((option) => {
          option.addEventListener("click", () => {
            const collectionId = option.dataset.moveCollectionId;
            handleBulkMove(collectionId);
            menu.classList.remove("open");
            trigger.setAttribute("aria-expanded", "false");
          });
        });

        // Close dropdown when clicking outside
        document.addEventListener("click", (e) => {
          if (!moveDropdown.contains(e.target)) {
            menu.classList.remove("open");
            trigger.setAttribute("aria-expanded", "false");
          }
        });
      }
    }
  }

  /**
   * Handle HTMX afterSwap to reinitialize if needed
   */
  function handleAfterSwap(evt) {
    // If the kanban board was replaced, reinitialize
    if (
      evt.detail.target.id === "kanban-board" ||
      evt.detail.target.id === "bookmarks-content"
    ) {
      cleanup();
      init();
    }
  }

  /**
   * Cleanup event listeners
   */
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

    // Remove global listeners
    document.removeEventListener("keydown", handleGlobalKeydown);
    document.removeEventListener("click", handleBoardClick);

    // Close help modal if open
    closeHelpModal();

    // Clear selection
    clearSelection();

    // Cancel any active keyboard drag
    if (keyboardDragState.isActive) {
      endKeyboardDrag(true);
    }

    // Stop auto-scroll
    stopAutoScroll();

    // Clean up drag state
    removePlaceholder();
    removeAllDragOverClasses();
    dragState.isDragging = false;
    dragState.draggedCard = null;
    dragState.sourceColumn = null;
    dragState.sourceIndex = null;
    dragState.placeholder = null;
  }

  // Export for global access
  window.kanban = {
    init: init,
    cleanup: cleanup,
    announce: announce,
  };

  // Initialize on DOM ready
  document.addEventListener("DOMContentLoaded", init);
})();
