/**
 * Split Markdown Editor
 * 
 * A full-featured markdown editor with:
 * - Split view (editor + live preview)
 * - Fixed toolbar with formatting actions
 * - Image upload via drag & drop
 * - Keyboard shortcuts
 * - Auto-save
 * - Syntax highlighting in preview
 */

(function () {
  "use strict";

  // ============================================
  // CONFIGURATION
  // ============================================

  const AUTOSAVE_DELAY = 2000; // 2 seconds after typing stops
  const PREVIEW_DELAY = 300; // 300ms debounce for preview updates
  const COVER_PREVIEW_DELAY = 500;
  const TIME_UPDATE_INTERVAL = 60000;

  // Markdown formatting actions
  const MARKDOWN_ACTIONS = {
    bold: { prefix: "**", suffix: "**", placeholder: "bold text" },
    italic: { prefix: "_", suffix: "_", placeholder: "italic text" },
    strikethrough: { prefix: "~~", suffix: "~~", placeholder: "strikethrough" },
    code: { prefix: "`", suffix: "`", placeholder: "code" },
    link: { prefix: "[", suffix: "](url)", placeholder: "link text" },
    image: { prefix: "![", suffix: "](url)", placeholder: "alt text" },
    heading: { prefix: "## ", suffix: "", placeholder: "Heading", lineStart: true },
    quote: { prefix: "> ", suffix: "", placeholder: "quote", lineStart: true },
    ul: { prefix: "- ", suffix: "", placeholder: "list item", lineStart: true },
    ol: { prefix: "1. ", suffix: "", placeholder: "list item", lineStart: true },
    hr: { prefix: "\n---\n", suffix: "", placeholder: "", insert: true },
    codeblock: { 
      prefix: "```\n", 
      suffix: "\n```", 
      placeholder: "code here",
      block: true 
    },
    table: {
      prefix: "",
      suffix: "",
      placeholder: "",
      template: `| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |`,
      insert: true
    }
  };

  const KEYBOARD_SHORTCUTS = {
    "b": "bold",
    "i": "italic",
    "k": "link",
    "`": "code",
    "h": "heading",
    "p": "toggle-preview"
  };

  // ============================================
  // STATE
  // ============================================

  let editorLayout = null;
  let form = null;
  let titleInput = null;
  let contentTextarea = null;
  let titleDisplay = null;
  let previewTitle = null;
  let previewContent = null;
  let previewPane = null;
  let sidebar = null;
  let toolbar = null;
  let statusEl = null;
  let actionField = null;
  let dropzone = null;
  let dropzoneOverlay = null;
  let imageInput = null;

  let autosaveTimeout = null;
  let previewTimeout = null;
  let coverPreviewTimeout = null;
  let timeUpdateInterval = null;
  let lastSavedContent = null;
  let isNewPost = false;
  let uploadUrl = "";
  let previewVisible = true;
  let sidebarVisible = true;

  // ============================================
  // INITIALIZATION
  // ============================================

  function init() {
    editorLayout = document.querySelector('[data-editor-type="split-markdown"]');
    if (!editorLayout) return;

    form = document.getElementById("post-editor-form");
    if (!form) return;

    // Get configuration
    isNewPost = editorLayout.dataset.isNew === "true";
    uploadUrl = editorLayout.dataset.uploadUrl || "/admin/uploads/image";

    // Get elements
    titleInput = document.getElementById("title");
    contentTextarea = document.getElementById("content");
    titleDisplay = document.querySelector("[data-title-display]");
    previewTitle = document.querySelector("[data-preview-title]");
    previewContent = document.querySelector("[data-preview-content]");
    previewPane = document.querySelector("[data-preview-pane]");
    sidebar = document.querySelector("[data-sidebar]");
    toolbar = document.querySelector("[data-toolbar]");
    statusEl = document.querySelector("[data-status]");
    actionField = document.querySelector("[data-action-field]");
    dropzone = document.querySelector("[data-dropzone]");
    dropzoneOverlay = document.querySelector("[data-dropzone-overlay]");
    imageInput = document.querySelector("[data-image-input]");

    // Store initial content
    lastSavedContent = getContentSnapshot();

    // Setup features
    setupTitleSync();
    setupPreview();
    setupToolbar();
    setupKeyboardShortcuts();
    setupAutosave();
    setupSidebarSync();
    setupActionButtons();
    setupPublishDropdown();
    setupCoverImagePreview();
    setupRelativeTimeUpdates();
    setupImageUpload();
    setupToggleButtons();

    // Auto-generate slug from title for new posts
    if (isNewPost) {
      setupSlugGeneration();
    }

    // Initial preview render
    updatePreview();

    console.log("Split Markdown Editor initialized");
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

  // ============================================
  // TITLE SYNC
  // ============================================

  function setupTitleSync() {
    if (!titleInput) return;

    titleInput.addEventListener("input", () => {
      const title = titleInput.value.trim() || "Untitled";
      if (titleDisplay) titleDisplay.textContent = title;
      if (previewTitle) previewTitle.textContent = title;
    });
  }

  // ============================================
  // LIVE PREVIEW
  // ============================================

  function setupPreview() {
    if (!contentTextarea || !previewContent) return;

    contentTextarea.addEventListener("input", () => {
      if (previewTimeout) clearTimeout(previewTimeout);
      previewTimeout = setTimeout(updatePreview, PREVIEW_DELAY);
    });
  }

  function updatePreview() {
    if (!contentTextarea || !previewContent) return;

    const markdown = contentTextarea.value;
    
    if (!markdown.trim()) {
      previewContent.innerHTML = '<p class="text-muted-foreground">Start writing to see preview...</p>';
      return;
    }

    if (typeof marked !== "undefined") {
      try {
        const html = marked.parse(markdown);
        previewContent.innerHTML = html;
        
        // Apply syntax highlighting to code blocks
        if (typeof hljs !== "undefined") {
          previewContent.querySelectorAll("pre code").forEach((block) => {
            hljs.highlightElement(block);
          });
        }
      } catch (e) {
        console.error("Markdown parse error:", e);
        previewContent.innerHTML = '<p class="text-destructive">Error rendering preview</p>';
      }
    } else {
      // Fallback if marked.js not loaded
      previewContent.innerHTML = '<pre class="text-sm">' + escapeHtml(markdown) + '</pre>';
    }
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================
  // TOOLBAR
  // ============================================

  function setupToolbar() {
    if (!toolbar) return;

    toolbar.addEventListener("click", (e) => {
      const button = e.target.closest("button[data-action]");
      if (!button) return;

      const action = button.dataset.action;
      if (action === "toggle-preview") {
        togglePreview();
      } else if (MARKDOWN_ACTIONS[action]) {
        applyMarkdownAction(action);
      }
    });
  }

  function applyMarkdownAction(actionName) {
    const action = MARKDOWN_ACTIONS[actionName];
    if (!action || !contentTextarea) return;

    // Special handling for image action - trigger file picker
    if (actionName === "image") {
      if (imageInput) {
        imageInput.click();
      }
      return;
    }

    const { selectionStart, selectionEnd, value } = contentTextarea;
    const selectedText = value.substring(selectionStart, selectionEnd);

    let newText;
    let newCursorStart;
    let newCursorEnd;

    if (action.insert || action.template) {
      // Insert template at cursor
      const template = action.template || action.prefix;
      const before = value.substring(0, selectionStart);
      const after = value.substring(selectionEnd);

      newText = before + template + after;
      newCursorStart = selectionStart + template.length;
      newCursorEnd = newCursorStart;
    } else if (action.lineStart) {
      // Insert at start of line
      const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
      const beforeLine = value.substring(0, lineStart);
      const afterSelection = value.substring(selectionEnd);
      const content = selectedText || action.placeholder;

      newText = beforeLine + action.prefix + content + action.suffix + afterSelection;
      newCursorStart = lineStart + action.prefix.length;
      newCursorEnd = newCursorStart + content.length;
    } else if (action.block) {
      // Block format (e.g., code block)
      const before = value.substring(0, selectionStart);
      const after = value.substring(selectionEnd);
      const content = selectedText || action.placeholder;

      newText = before + action.prefix + content + action.suffix + after;
      newCursorStart = selectionStart + action.prefix.length;
      newCursorEnd = newCursorStart + content.length;
    } else {
      // Wrap selection
      const before = value.substring(0, selectionStart);
      const after = value.substring(selectionEnd);
      const content = selectedText || action.placeholder;

      newText = before + action.prefix + content + action.suffix + after;
      newCursorStart = selectionStart + action.prefix.length;
      newCursorEnd = newCursorStart + content.length;
    }

    contentTextarea.value = newText;
    contentTextarea.setSelectionRange(newCursorStart, newCursorEnd);
    contentTextarea.focus();

    // Trigger input event for preview update and autosave
    contentTextarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================

  function setupKeyboardShortcuts() {
    if (!contentTextarea) return;

    contentTextarea.addEventListener("keydown", (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;

      const action = KEYBOARD_SHORTCUTS[e.key.toLowerCase()];
      if (action) {
        e.preventDefault();
        if (action === "toggle-preview") {
          togglePreview();
        } else {
          applyMarkdownAction(action);
        }
      }
    });
  }

  // ============================================
  // TOGGLE BUTTONS
  // ============================================

  function setupToggleButtons() {
    // Preview toggle is handled in toolbar click handler
    
    // Sidebar toggle
    const sidebarToggle = document.querySelector('[data-action-btn="toggle-sidebar"]');
    if (sidebarToggle) {
      sidebarToggle.addEventListener("click", toggleSidebar);
    }
  }

  function togglePreview() {
    previewVisible = !previewVisible;
    
    if (previewPane) {
      previewPane.style.display = previewVisible ? "" : "none";
    }
    
    const toggleBtn = document.querySelector("[data-preview-toggle]");
    if (toggleBtn) {
      toggleBtn.classList.toggle("active", previewVisible);
    }

    // Update editor layout class
    if (editorLayout) {
      editorLayout.classList.toggle("preview-hidden", !previewVisible);
    }
  }

  function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
    
    if (sidebar) {
      sidebar.style.display = sidebarVisible ? "" : "none";
    }

    if (editorLayout) {
      editorLayout.classList.toggle("sidebar-hidden", !sidebarVisible);
    }
  }

  // ============================================
  // IMAGE UPLOAD
  // ============================================

  function setupImageUpload() {
    if (!dropzone || !contentTextarea) return;

    // Drag and drop
    dropzone.addEventListener("dragenter", handleDragEnter);
    dropzone.addEventListener("dragover", handleDragOver);
    dropzone.addEventListener("dragleave", handleDragLeave);
    dropzone.addEventListener("drop", handleDrop);

    // File input
    if (imageInput) {
      imageInput.addEventListener("change", handleFileSelect);
    }
  }

  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    if (dropzoneOverlay) dropzoneOverlay.classList.add("active");
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Only hide overlay if we're leaving the dropzone completely
    const rect = dropzone.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      if (dropzoneOverlay) dropzoneOverlay.classList.remove("active");
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    if (dropzoneOverlay) dropzoneOverlay.classList.remove("active");

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      uploadImages(files);
    }
  }

  function handleFileSelect(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadImages(files);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  }

  async function uploadImages(files) {
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        showToast("error", `${file.name} is not an image`);
        continue;
      }

      try {
        const url = await uploadImage(file);
        insertImageMarkdown(file.name, url);
        showToast("success", "Image uploaded successfully");
      } catch (error) {
        console.error("Upload failed:", error);
        showToast("error", `Failed to upload ${file.name}`);
      }
    }
  }

  async function uploadImage(file) {
    const formData = new FormData();
    formData.append("image", file);

    // Get CSRF token
    const csrfInput = form?.querySelector('input[name="csrf_token"]');
    const csrfToken = csrfInput?.value || "";

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "X-CSRF-Token": csrfToken
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Upload failed");
    }

    const data = await response.json();
    return data.url;
  }

  function insertImageMarkdown(filename, url) {
    if (!contentTextarea) return;

    const { selectionStart, value } = contentTextarea;
    const before = value.substring(0, selectionStart);
    const after = value.substring(selectionStart);

    // Insert on a new line if not at the start of a line
    const needsNewline = before.length > 0 && !before.endsWith("\n");
    const imageMarkdown = `${needsNewline ? "\n" : ""}![${filename}](${url})\n`;

    contentTextarea.value = before + imageMarkdown + after;
    
    // Position cursor after the inserted image
    const newPos = selectionStart + imageMarkdown.length;
    contentTextarea.setSelectionRange(newPos, newPos);
    contentTextarea.focus();

    // Trigger input event
    contentTextarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // ============================================
  // AUTO-SAVE
  // ============================================

  function setupAutosave() {
    if (isNewPost) return;

    const autosaveUrl = form?.dataset.autosave;
    if (!autosaveUrl) return;

    const handleChange = () => {
      if (hasUnsavedChanges()) {
        updateStatus("unsaved");
      }

      if (autosaveTimeout) clearTimeout(autosaveTimeout);
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
    if (isNewPost && action === "save") return;

    const autosaveUrl = form?.dataset.autosave;
    if (!autosaveUrl) return;

    updateStatus("saving");

    try {
      const csrfInput = form?.querySelector('input[name="csrf_token"]');
      const csrfToken = csrfInput?.value || "";

      if (actionField) actionField.value = action;

      const formData = new FormData(form);

      const response = await fetch(autosaveUrl, {
        method: "PATCH",
        headers: { "X-CSRF-Token": csrfToken },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        lastSavedContent = getContentSnapshot();
        updateStatus("saved", data.updated_at);

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
    document.querySelectorAll('[data-action-btn="save"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        if (isNewPost) {
          if (actionField) actionField.value = "save";
          const draftInput = document.getElementById("is_draft");
          if (draftInput) draftInput.value = "true";
          form?.submit();
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
          form?.submit();
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
    // Could update button UI dynamically here
    // For now, state change takes effect on page reload
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

  // ============================================
  // SIDEBAR SYNC
  // ============================================

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

    // Tag selection sync
    const tagSelect = document.querySelector("ec-tag-select");
    if (tagSelect) {
      tagSelect.addEventListener("change", syncTagsToForm);
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

    const selectedTags = document.querySelectorAll('input[name="sidebar_tag_ids"]:checked');
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
      if (coverPreviewTimeout) clearTimeout(coverPreviewTimeout);
      coverPreviewTimeout = setTimeout(() => {
        updateCoverPreview(coverInput.value, previewContainer);
      }, COVER_PREVIEW_DELAY);
    });
  }

  function updateCoverPreview(url, container) {
    const existingImg = container.querySelector("img");
    if (existingImg) existingImg.remove();

    container.classList.remove("error");

    if (!url) return;

    const img = document.createElement("img");
    img.src = url;
    img.alt = "Cover preview";
    img.className = "cover-image-preview-img";

    img.onload = () => container.classList.remove("error");
    img.onerror = () => container.classList.add("error");

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

    if (sidebarSlug) {
      sidebarSlug.addEventListener("input", () => {
        userEditedSlug = true;
      });
    }

    titleInput.addEventListener("input", () => {
      if (userEditedSlug) return;

      const slug = generateSlug(titleInput.value);
      if (slugInput) slugInput.value = slug;
      if (sidebarSlug) sidebarSlug.value = slug;
    });
  }

  function generateSlug(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 100);
  }

  // ============================================
  // TOAST HELPER
  // ============================================

  function showToast(type, message) {
    const toastContainer = document.querySelector("ec-toast-container");
    if (toastContainer && typeof toastContainer.show === "function") {
      toastContainer.show(message, type);
    } else {
      console.log(`[${type}] ${message}`);
    }
  }

  // ============================================
  // CLEANUP
  // ============================================

  function cleanup() {
    if (autosaveTimeout) clearTimeout(autosaveTimeout);
    if (previewTimeout) clearTimeout(previewTimeout);
    if (coverPreviewTimeout) clearTimeout(coverPreviewTimeout);
    if (timeUpdateInterval) clearInterval(timeUpdateInterval);
  }

  // ============================================
  // STARTUP
  // ============================================

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("beforeunload", cleanup);
  document.addEventListener("htmx:afterSettle", init);
})();
