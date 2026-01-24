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
 * - Supports multiple editor types (markdown, block)
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
  let contentTextarea = null; // Hidden field for form submission
  let titleDisplay = null;
  let statusEl = null;
  let actionField = null;

  // Editor instance (MarkdownEditor or BlockEditor)
  let editorInstance = null;
  let editorType = 'markdown'; // 'markdown' or 'block'

  // ============================================
  // INITIALIZATION
  // ============================================

  function init() {
    editorLayout = document.querySelector("[data-editor]");
    if (!editorLayout) return; // Not on editor page

    form = document.getElementById("post-editor-form");
    if (!form) return;

    isNewPost = editorLayout.dataset.isNew === "true";
    editorType = editorLayout.dataset.editorType || 'markdown';
    
    titleInput = document.getElementById("title");
    contentTextarea = document.getElementById("content");
    titleDisplay = document.querySelector("[data-title-display]");
    statusEl = document.querySelector("[data-status]");
    actionField = document.querySelector("[data-action-field]");

    // Initialize the editor based on type
    initEditor();

    // Store initial content for change detection
    updateLastSavedContent();

    // Setup features
    setupTitleSync();
    setupAutosave();
    setupSidebarSync();
    setupActionButtons();
    setupPublishDropdown();
    setupCoverImagePreview();
    setupRelativeTimeUpdates();
    setupFormSubmission();

    // Auto-generate slug from title for new posts
    if (isNewPost) {
      setupSlugGeneration();
    }
  }

  // ============================================
  // EDITOR INITIALIZATION
  // ============================================

  function initEditor() {
    const editorMount = document.querySelector("[data-editor-mount]");
    if (!editorMount || !window.EditorCore) return;

    // For markdown editor, the textarea is the editor itself
    // For block editor, we need to create a container and hide the textarea
    if (editorType === 'block') {
      // Create a container for the block editor
      const blockContainer = document.createElement('div');
      blockContainer.className = 'block-editor-container';
      blockContainer.id = 'block-editor-container';
      
      // Insert before the textarea
      if (contentTextarea) {
        contentTextarea.style.display = 'none';
        contentTextarea.parentNode.insertBefore(blockContainer, contentTextarea);
      }

      // Create block editor with initial content from textarea
      const initialContent = contentTextarea?.value || '';
      editorInstance = window.EditorCore.create('block', blockContainer, {
        placeholder: 'Start writing...',
        initialData: initialContent,
      });

      // Listen for changes
      if (editorInstance) {
        editorInstance.on('change', handleEditorChange);
      }
    } else {
      // Markdown editor - use textarea directly
      // The MarkdownEditor is auto-registered and handles textarea with data attributes
      // We just need to track changes on the textarea
      if (contentTextarea) {
        contentTextarea.addEventListener('input', handleEditorChange);
      }
    }
  }

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

  async function getContentSnapshot() {
    let content = '';
    
    if (editorType === 'block' && editorInstance) {
      // For block editor, get content asynchronously
      if (typeof editorInstance.getContentAsync === 'function') {
        content = await editorInstance.getContentAsync();
      } else {
        content = editorInstance.getContent();
      }
    } else {
      // For markdown, get from textarea
      content = contentTextarea?.value || '';
    }

    return {
      title: titleInput?.value || "",
      content: content,
      slug: document.getElementById("slug")?.value || "",
      excerpt: document.getElementById("excerpt")?.value || "",
      cover_image: document.getElementById("cover_image")?.value || "",
    };
  }

  function getContentSnapshotSync() {
    // Synchronous version for quick checks (uses cached content for block editor)
    let content = '';
    
    if (editorType === 'block' && editorInstance) {
      content = editorInstance.getContent();
    } else {
      content = contentTextarea?.value || '';
    }

    return {
      title: titleInput?.value || "",
      content: content,
      slug: document.getElementById("slug")?.value || "",
      excerpt: document.getElementById("excerpt")?.value || "",
      cover_image: document.getElementById("cover_image")?.value || "",
    };
  }

  async function updateLastSavedContent() {
    lastSavedContent = await getContentSnapshot();
  }

  function hasUnsavedChanges() {
    if (!lastSavedContent) return false;
    const current = getContentSnapshotSync();
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
      // Sync editor content to hidden field before saving
      await syncEditorToForm();

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
        await updateLastSavedContent();

        // Update status with new timestamp
        updateStatus("saved", data.updated_at);

        // Update UI based on publish state
        if (data.is_draft !== undefined) {
          updatePublishState(data.is_draft);
        }

        // If action was publish/unpublish, may need to reload
        if (action === "publish" || action === "unpublish") {
          // Optionally reload to get fresh state
          // For now, just update the UI
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
  // FORM SUBMISSION
  // ============================================

  function setupFormSubmission() {
    if (!form) return;

    // Intercept form submission to sync editor content
    form.addEventListener('submit', async (e) => {
      // For block editor, we need to sync content before submit
      if (editorType === 'block') {
        e.preventDefault();
        await syncEditorToForm();
        form.submit();
      }
      // For markdown, the textarea is already the form field
    });
  }

  async function syncEditorToForm() {
    if (!contentTextarea) return;

    if (editorType === 'block' && editorInstance) {
      // Get content from block editor and put in hidden field
      let content = '';
      if (typeof editorInstance.getContentAsync === 'function') {
        content = await editorInstance.getContentAsync();
      } else {
        content = editorInstance.getContent();
      }
      contentTextarea.value = content;
    }
    // For markdown, textarea is already synced
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
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        if (isNewPost) {
          // For new posts, submit normally with save action
          if (actionField) actionField.value = "save";
          // Set is_draft to true for save
          const draftInput = document.getElementById("is_draft");
          if (draftInput) draftInput.value = "true";
          await syncEditorToForm();
          form.submit();
        } else {
          performSave("save");
        }
      });
    });

    // Publish button
    document.querySelectorAll('[data-action-btn="publish"]').forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        if (isNewPost) {
          // For new posts, submit normally with publish action
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
    
    // Destroy editor instance
    if (editorInstance && typeof editorInstance.destroy === 'function') {
      editorInstance.destroy();
      editorInstance = null;
    }
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
