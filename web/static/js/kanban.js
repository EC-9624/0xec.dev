/**
 * Kanban Board Component
 * Drag-and-drop bookmark management using SortableJS
 * Includes keyboard accessibility support
 */
(function () {
  "use strict";

  // Store Sortable instances for cleanup
  let sortableInstances = [];

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
  // KEYBOARD ACCESSIBILITY FUNCTIONS
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
      // Commit the move - call the existing update logic if column changed
      const columnName = getColumnName(currentColumn.closest(".kanban-column"));
      const position = getCardPosition(card);
      
      if (currentColumn !== originalColumn) {
        const bookmarkId = card.dataset.bookmarkId;
        const newCollectionId = currentColumn.dataset.collectionId || "";
        
        // Use existing moveBookmark function
        moveBookmark(
          bookmarkId,
          newCollectionId,
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
   * @param {HTMLElement} card - The card to move
   * @param {number} direction - -1 for left, 1 for right
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

  /**
   * Initialize the Kanban board
   */
  function init() {
    const board = document.getElementById("kanban-board");
    if (!board) return;

    // Check if SortableJS is loaded
    if (typeof Sortable === "undefined") {
      console.error("SortableJS is not loaded");
      return;
    }

    // Initialize sortable on each column
    const columns = board.querySelectorAll("[data-sortable]");
    columns.forEach(initColumn);

    // Initialize keyboard navigation
    board.addEventListener("keydown", handleCardKeydown);

    // Listen for HTMX events to reinitialize after content changes
    document.body.addEventListener("htmx:afterSwap", handleAfterSwap);
  }

  /**
   * Initialize sortable for a single column
   */
  function initColumn(column) {
    const collectionId = column.dataset.collectionId;

    const sortable = Sortable.create(column, {
      group: "bookmarks", // Allow dragging between columns
      animation: 150,
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      dragClass: "sortable-drag",
      draggable: ".kanban-card",
      
      // Visual feedback when dragging over
      onMove: function (evt) {
        evt.to.classList.add("sortable-drag-over");
      },

      // When item is dropped
      onEnd: function (evt) {
        // Remove drag-over class from all columns
        document.querySelectorAll(".sortable-drag-over").forEach((el) => {
          el.classList.remove("sortable-drag-over");
        });

        // If item moved to different column, update collection
        if (evt.from !== evt.to) {
          const bookmarkId = evt.item.dataset.bookmarkId;
          const newCollectionId = evt.to.dataset.collectionId;
          
          moveBookmark(bookmarkId, newCollectionId, evt.item, evt.from, evt.oldIndex);
        }
      },

      // Clear drag-over when leaving
      onLeave: function (evt) {
        evt.to.classList.remove("sortable-drag-over");
      },
    });

    sortableInstances.push(sortable);
  }

  /**
   * Move a bookmark to a new collection
   */
  function moveBookmark(bookmarkId, collectionId, item, fromColumn, oldIndex) {
    const url = `/admin/htmx/bookmarks/${bookmarkId}/collection`;
    const csrfToken = getCSRFToken();

    // Create form data
    const formData = new FormData();
    formData.append("collection_id", collectionId);

    // Make the request
    fetch(url, {
      method: "POST",
      headers: {
        "X-CSRF-Token": csrfToken,
      },
      body: formData,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to move bookmark");
        }
        // Update column counts
        updateColumnCounts();
        // Show success feedback
        showMoveSuccess(item);
      })
      .catch((error) => {
        console.error("Error moving bookmark:", error);
        // Revert the move
        revertMove(item, fromColumn, oldIndex);
        // Show error toast
        showMoveError();
      });
  }

  /**
   * Revert a failed move
   */
  function revertMove(item, fromColumn, oldIndex) {
    const children = fromColumn.children;
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

  /**
   * Get CSRF token from page
   */
  function getCSRFToken() {
    // Try to get from body hx-headers attribute
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
    return "";
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
   * Cleanup sortable instances and keyboard handlers
   */
  function cleanup() {
    sortableInstances.forEach((instance) => {
      if (instance && typeof instance.destroy === "function") {
        instance.destroy();
      }
    });
    sortableInstances = [];
    
    // Cancel any active keyboard drag
    if (keyboardDragState.isActive) {
      endKeyboardDrag(true);
    }
    
    // Remove keyboard listener
    const board = document.getElementById("kanban-board");
    if (board) {
      board.removeEventListener("keydown", handleCardKeydown);
    }
  }

  // Export for global access
  window.kanban = {
    init: init,
    cleanup: cleanup,
    announce: announce, // Expose for external use if needed
  };

  // Initialize on DOM ready
  document.addEventListener("DOMContentLoaded", init);
})();
