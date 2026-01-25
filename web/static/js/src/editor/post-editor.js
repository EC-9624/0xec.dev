/**
 * Post Editor - Orchestrator for the post editor experience
 *
 * Features:
 * - Title sync (content input -> header display)
 * - Auto-save with debouncing (2 seconds after typing stops)
 * - Save/Publish/Unpublish actions
 * - Status indicator with relative time
 * - Sidebar field sync to hidden form fields
 * - Cover image preview
 * - Publish dropdown toggle
 */

(function () {
  "use strict";

  // ============================================
  // CONFIGURATION
  // ============================================

  const AUTOSAVE_DELAY = 2000; // 2 seconds after typing stops
  const COVER_PREVIEW_DELAY = 500; // Debounce for cover image preview
  const TIME_UPDATE_INTERVAL = 60000; // Update relative time every minute

  // ============================================
  // STATE
  // ============================================

  let autosaveTimeout = null;
  let coverPreviewTimeout = null;
  let timeUpdateInterval = null;
  let lastSavedContent = null;
  let isNewPost = false;

  // Element references
  let editorLayout = null;
  let form = null;
  let titleInput = null;
  let contentTextarea = null;
  let titleDisplay = null;
  let statusEl = null;
  let actionField = null;

  // ============================================
  // INITIALIZATION
  // ============================================

  function init() {
    editorLayout = document.querySelector("[data-editor]");
    if (!editorLayout) return; // Not on editor page

    form = document.getElementById("post-editor-form");
    if (!form) return;

    isNewPost = editorLayout.dataset.isNew === "true";
    
    titleInput = document.getElementById("title");
    contentTextarea = document.getElementById("content");
    titleDisplay = document.querySelector("[data-title-display]");
    statusEl = document.querySelector("[data-status]");
    actionField = document.querySelector("[data-action-field]");

    // Setup change tracking on textarea
    if (contentTextarea) {
      contentTextarea.addEventListener('input', handleEditorChange);
    }

    // Store initial content for change detection
    lastSavedContent = getContentSnapshot();

    // Setup features
    setupTitleSync();
    setupAutosave();
    setupSidebarSync();
    setupActionButtons();
    setupPublishDropdown();
    setupCoverImagePreview();
    setupRelativeTimeUpdates();

    // Auto-generate slug from title for new posts
    if (isNewPost) {
      setupSlugGeneration();
    }
  }

  // ============================================
  // EDITOR CHANGE HANDLING
  // ============================================

  function handleEditorChange() {
    // Show unsaved indicator
    checkForUnsavedChanges();

    // Clear any pending autosave
    if (autosaveTimeout) {
      clearTimeout(autosaveTimeout);
    }

    // Schedule new autosave (only for existing posts)
    if (!isNewPost) {
      autosaveTimeout = setTimeout(() => {
        performSave("save");
      }, AUTOSAVE_DELAY);
    }
  }

  // ============================================
  // CONTENT SNAPSHOT
  // ============================================

  function getContentSnapshot() {
    return {
      title: titleInput?.value || "",
      content: contentTextarea?.value || "",
      slug: document.getElementById("slug")?.value || "",
      excerpt: document.getElementById("excerpt")?.value || "",
      cover_image: document.getElementById("cover_image")?.value || "",
    };
  }

  function hasUnsavedChanges() {
    if (!lastSavedContent) return false;
    const current = getContentSnapshot();
    return (
      current.title !== lastSavedContent.title ||
      current.content !== lastSavedContent.content ||
      current.slug !== lastSavedContent.slug ||
      current.excerpt !== lastSavedContent.excerpt ||
      current.cover_image !== lastSavedContent.cover_image
    );
  }

  function checkForUnsavedChanges() {
    if (hasUnsavedChanges()) {
      updateStatus("unsaved");
    }
  }

  // ============================================
  // TITLE SYNC
  // ============================================

  function setupTitleSync() {
    if (!titleInput || !titleDisplay) return;

    titleInput.addEventListener("input", () => {
      const title = titleInput.value.trim() || "Untitled";
      titleDisplay.textContent = title;
    });
  }

  // ============================================
  // AUTO-SAVE
  // ============================================

  function setupAutosave() {
    if (isNewPost) return; // No autosave for new posts

    const autosaveUrl = form.dataset.autosave;
    if (!autosaveUrl) return;

    // Listen for changes on main inputs
    titleInput?.addEventListener("input", handleEditorChange);

    // Also listen on sidebar inputs
    document.querySelectorAll("[data-sync]").forEach((input) => {
      input.addEventListener("input", handleEditorChange);
    });
  }

  async function performSave(action) {
    if (isNewPost && action === "save") {
      // For new posts, we need to submit the form normally
      // Auto-save doesn't work for unsaved posts
      return;
    }

    const autosaveUrl = form.dataset.autosave;
    if (!autosaveUrl) return;

    // Update status
    updateStatus("saving");

    try {
      // Get CSRF token
      const csrfInput = form.querySelector('input[name="csrf_token"]');
      const csrfToken = csrfInput?.value || "";

      // Set action
      if (actionField) {
        actionField.value = action;
      }

      // Collect all form data
      const formData = new FormData(form);

      const response = await fetch(autosaveUrl, {
        method: "PATCH",
        headers: {
          "X-CSRF-Token": csrfToken,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        lastSavedContent = getContentSnapshot();

        // Update status with new timestamp
        updateStatus("saved", data.updated_at);

        // Update UI based on publish state
        if (data.is_draft !== undefined) {
          updatePublishState(data.is_draft);
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

  // ============================================
  // STATUS DISPLAY
  // ============================================

  function updateStatus(state, timestamp, errorMessage) {
    if (!statusEl) return;

    switch (state) {
      case "saving":
        statusEl.innerHTML = '<span class="editor-status-saving">Saving...</span>';
        break;
      case "saved":
        const timeStr = timestamp ? formatRelativeTime(new Date(timestamp)) : "just now";
        statusEl.innerHTML = `<span class="editor-status-saved" data-updated-at="${timestamp || new Date().toISOString()}">Last saved: ${timeStr}</span>`;
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
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
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
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }

  function setupRelativeTimeUpdates() {
    // Update relative time every minute
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

  // ============================================
  // ACTION BUTTONS
  // ============================================

  function setupActionButtons() {
    // Save button
    document.querySelectorAll('[data-action-btn="save"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        if (isNewPost) {
          // For new posts, submit normally with save action
          if (actionField) actionField.value = "save";
          // Set is_draft to true for save
          const draftInput = document.getElementById("is_draft");
          if (draftInput) draftInput.value = "true";
          form.submit();
        } else {
          performSave("save");
        }
      });
    });

    // Publish button
    document.querySelectorAll('[data-action-btn="publish"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        if (isNewPost) {
          // For new posts, submit normally with publish action
          if (actionField) actionField.value = "publish";
          const draftInput = document.getElementById("is_draft");
          if (draftInput) draftInput.value = "false";
          form.submit();
        } else {
          performSave("publish");
        }
      });
    });

    // Unpublish button
    document.querySelectorAll('[data-action-btn="unpublish"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        performSave("unpublish");
      });
    });
  }

  function updatePublishState(isDraft) {
    // This would update the publish button UI
    // For now, we might need to reload to reflect the state
    // In future, we can swap the button dynamically
  }

  // ============================================
  // PUBLISH DROPDOWN
  // ============================================

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

    // Close on outside click
    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove("open");
      }
    });

    // Close on escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        dropdown.classList.remove("open");
      }
    });
  }

  // ============================================
  // SIDEBAR SYNC
  // ============================================

  function setupSidebarSync() {
    // Sync sidebar inputs to hidden form fields
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

    // Handle tag selection sync
    const tagSelect = document.querySelector("ec-tag-select");
    if (tagSelect) {
      tagSelect.addEventListener("change", () => {
        syncTagsToForm();
      });

      // Also listen for checkbox changes inside the tag select
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

    // Clear existing tag inputs
    container.innerHTML = "";

    // Get selected tags from sidebar
    const selectedTags = document.querySelectorAll(
      'input[name="sidebar_tag_ids"]:checked'
    );

    // Add hidden inputs for each selected tag
    selectedTags.forEach((tag) => {
      const hiddenInput = document.createElement("input");
      hiddenInput.type = "hidden";
      hiddenInput.name = "tag_ids";
      hiddenInput.value = tag.value;
      hiddenInput.dataset.tagId = tag.value;
      container.appendChild(hiddenInput);
    });
  }

  // ============================================
  // COVER IMAGE PREVIEW
  // ============================================

  function setupCoverImagePreview() {
    const coverInput = document.querySelector("[data-preview-trigger]");
    const previewContainer = document.querySelector("[data-cover-preview]");

    if (!coverInput || !previewContainer) return;

    coverInput.addEventListener("input", () => {
      // Debounce
      if (coverPreviewTimeout) {
        clearTimeout(coverPreviewTimeout);
      }

      coverPreviewTimeout = setTimeout(() => {
        updateCoverPreview(coverInput.value, previewContainer);
      }, COVER_PREVIEW_DELAY);
    });
  }

  function updateCoverPreview(url, container) {
    // Remove existing image
    const existingImg = container.querySelector("img");
    if (existingImg) {
      existingImg.remove();
    }

    // Reset error state
    container.classList.remove("error");

    if (!url) return;

    // Create new image
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

  // ============================================
  // SLUG GENERATION
  // ============================================

  function setupSlugGeneration() {
    if (!titleInput) return;

    const slugInput = document.getElementById("slug");
    const sidebarSlug = document.getElementById("sidebar-slug");

    let userEditedSlug = false;

    // Track if user manually edits slug
    if (sidebarSlug) {
      sidebarSlug.addEventListener("input", () => {
        userEditedSlug = true;
      });
    }

    titleInput.addEventListener("input", () => {
      // Only auto-generate if user hasn't manually edited
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
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "") // Remove non-word chars
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single
      .substring(0, 100); // Limit length
  }

  // ============================================
  // CLEANUP
  // ============================================

  function cleanup() {
    if (autosaveTimeout) clearTimeout(autosaveTimeout);
    if (coverPreviewTimeout) clearTimeout(coverPreviewTimeout);
    if (timeUpdateInterval) clearInterval(timeUpdateInterval);
  }

  // ============================================
  // STARTUP
  // ============================================

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Cleanup on page unload
  window.addEventListener("beforeunload", cleanup);

  // Re-initialize on HTMX content swaps
  document.addEventListener("htmx:afterSettle", init);
})();
