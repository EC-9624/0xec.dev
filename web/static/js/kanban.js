/**
 * Kanban Board Component
 * Native HTML5 Drag-and-Drop with keyboard accessibility
 */
(function () {
  "use strict";

  // ============================================
  // DRAG STATE
  // ============================================

  const dragState = {
    isDragging: false,
    draggedCard: null,
    sourceColumn: null,
    sourceIndex: null,
    placeholder: null
  };

  // ============================================
  // KEYBOARD DRAG-AND-DROP STATE
  // ============================================

  const keyboardDragState = {
    isActive: false,
    card: null,
    originalColumn: null,
    originalNextSibling: null,
    originalIndex: null
  };

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
      // Small delay to ensure re-announcement of same message
      requestAnimationFrame(() => {
        liveRegion.textContent = message;
      });
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

  /**
   * Get CSRF token from page
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

    dragState.isDragging = true;
    dragState.draggedCard = card;
    dragState.sourceColumn = card.closest(".kanban-column-content");
    dragState.sourceIndex = getCardIndex(card);

    // Set drag data
    e.dataTransfer.setData("text/plain", card.dataset.bookmarkId);
    e.dataTransfer.effectAllowed = "move";

    // Visual feedback (use timeout to avoid affecting drag image)
    setTimeout(() => {
      card.classList.add("dragging");
    }, 0);

    // Create placeholder
    dragState.placeholder = createPlaceholder();
  }

  /**
   * Handle drag end event
   */
  function handleDragEnd(e) {
    const card = e.target.closest(".kanban-card");
    if (!card) return;

    card.classList.remove("dragging");
    removePlaceholder();
    removeAllDragOverClasses();

    // Reset state
    dragState.isDragging = false;
    dragState.draggedCard = null;
    dragState.sourceColumn = null;
    dragState.sourceIndex = null;
    dragState.placeholder = null;
  }

  /**
   * Handle drag over event - calculate and show drop position
   */
  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

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

    const column = e.target.closest(".kanban-column-content");
    if (!column || !dragState.draggedCard) return;

    const { draggedCard, sourceColumn, sourceIndex, placeholder } = dragState;

    // Insert card at placeholder position
    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.insertBefore(draggedCard, placeholder);
    } else {
      column.appendChild(draggedCard);
    }

    // Remove placeholder and visual feedback
    removePlaceholder();
    removeAllDragOverClasses();
    draggedCard.classList.remove("dragging");

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

    // Update counts
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

    // Reset state
    keyboardDragState.isActive = false;
    keyboardDragState.card = null;
    keyboardDragState.originalColumn = null;
    keyboardDragState.originalNextSibling = null;
    keyboardDragState.originalIndex = null;

    // Keep focus on card
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
   * Handle keyboard events on cards
   */
  function handleCardKeydown(e) {
    const card = e.target.closest(".kanban-card");
    if (!card) return;

    // Don't interfere if focus is on interactive element inside the card
    const isOnCard = e.target === card;
    const isOnDragHandle = e.target.closest(".kanban-card-drag-handle");

    switch (e.key) {
      case " ":
      case "Enter":
        // Only handle if focus is on the card itself (not buttons/links inside)
        if (!isOnCard && !isOnDragHandle) return;

        e.preventDefault();
        if (keyboardDragState.isActive && keyboardDragState.card === card) {
          endKeyboardDrag(false); // Drop
        } else if (!keyboardDragState.isActive) {
          startKeyboardDrag(card); // Pick up
        }
        break;

      case "ArrowUp":
        if (keyboardDragState.isActive && keyboardDragState.card === card) {
          e.preventDefault();
          moveCardUp(card);
        }
        break;

      case "ArrowDown":
        if (keyboardDragState.isActive && keyboardDragState.card === card) {
          e.preventDefault();
          moveCardDown(card);
        }
        break;

      case "ArrowLeft":
        if (keyboardDragState.isActive && keyboardDragState.card === card) {
          e.preventDefault();
          moveCardToColumn(card, -1);
        }
        break;

      case "ArrowRight":
        if (keyboardDragState.isActive && keyboardDragState.card === card) {
          e.preventDefault();
          moveCardToColumn(card, 1);
        }
        break;

      case "Escape":
        if (keyboardDragState.isActive) {
          e.preventDefault();
          endKeyboardDrag(true); // Cancel
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
        // Revert the move
        revertMove(item, fromColumn, oldIndex);
        // Update counts after revert
        updateColumnCounts();
        // Show error toast
        showMoveError();
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

  /**
   * Show error toast
   */
  function showMoveError() {
    if (typeof window.showToast === "function") {
      window.showToast("Failed to move bookmark. Please try again.", "error");
    } else {
      alert("Failed to move bookmark. Please try again.");
    }
  }

  // ============================================
  // INITIALIZATION
  // ============================================

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

    // Keyboard navigation
    board.addEventListener("keydown", handleCardKeydown);

    // Listen for HTMX events to reinitialize after content changes
    document.body.addEventListener("htmx:afterSwap", handleAfterSwap);
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
    }

    // Cancel any active keyboard drag
    if (keyboardDragState.isActive) {
      endKeyboardDrag(true);
    }

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
