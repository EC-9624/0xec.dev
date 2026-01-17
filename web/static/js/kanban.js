/**
 * Kanban Board Component
 * Drag-and-drop bookmark management using SortableJS
 */
(function () {
  "use strict";

  // Store Sortable instances for cleanup
  let sortableInstances = [];

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
      handle: ".kanban-card-drag-handle",
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
   * Cleanup sortable instances
   */
  function cleanup() {
    sortableInstances.forEach((instance) => {
      if (instance && typeof instance.destroy === "function") {
        instance.destroy();
      }
    });
    sortableInstances = [];
  }

  // Export for global access
  window.kanban = {
    init: init,
    cleanup: cleanup,
  };

  // Initialize on DOM ready
  document.addEventListener("DOMContentLoaded", init);
})();
