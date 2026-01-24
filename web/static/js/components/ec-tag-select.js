/**
 * ec-tag-select - Multi-select tag dropdown Web Component
 *
 * Features:
 * - Multi-select with checkboxes
 * - Live filtering as user types
 * - Inline tag creation via API
 * - Chip display of selected tags
 * - Keyboard navigation (Escape to close, Enter to create)
 * - Click outside to close
 * - HTMX integration
 *
 * Usage:
 * <ec-tag-select field-name="tag_ids">
 *   <div data-trigger>
 *     <div data-chips>...</div>
 *     <span data-placeholder>Select tags...</span>
 *   </div>
 *   <div data-dropdown class="hidden">
 *     <input data-filter placeholder="Filter...">
 *     <div data-options>
 *       <label data-option data-name="Tag Name">
 *         <input type="checkbox" data-id="1" value="1">
 *         <span>Tag Name</span>
 *       </label>
 *     </div>
 *     <div data-create class="hidden">
 *       <button data-create-btn>Create "<span data-create-name></span>"</button>
 *     </div>
 *   </div>
 * </ec-tag-select>
 */

class EcTagSelect extends HTMLElement {
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
    // Find server-rendered elements
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

    // Setup event listeners
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
    // Trigger click - open/close dropdown
    this.#trigger.addEventListener(
      "click",
      (e) => {
        // Don't toggle if clicking remove button
        if (e.target.closest("[data-remove]")) return;
        this.#toggleDropdown();
      },
      { signal }
    );

    // Chips container click - handle remove buttons
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

    // Filter input
    if (this.#filterInput) {
      this.#filterInput.addEventListener(
        "input",
        (e) => this.#filterOptions(e.target.value),
        { signal }
      );

      // Prevent click from closing dropdown
      this.#filterInput.addEventListener(
        "click",
        (e) => e.stopPropagation(),
        { signal }
      );
    }

    // Options change - update chips when checkbox changes
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

    // Create button
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

    // Click outside to close
    document.addEventListener(
      "click",
      (e) => {
        if (this.#isOpen && !this.contains(e.target)) {
          this.#toggleDropdown(false);
        }
      },
      { signal }
    );

    // Keyboard navigation
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
    this.#isOpen = open !== undefined ? open : !this.#isOpen;
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

    // Show/hide create option
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

    // Update placeholder visibility
    if (this.#placeholder) {
      this.#placeholder.textContent =
        checkboxes.length === 0 ? EcTagSelect.DEFAULT_PLACEHOLDER : "";
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
      const response = await fetch(EcTagSelect.CREATE_TAG_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-CSRF-Token": this.#getCSRFToken(),
        },
        body: `name=${encodeURIComponent(name)}&slug=${encodeURIComponent(slug)}`,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const tag = await response.json();

      // Add new option to the list
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

      // Update UI
      this.#updateChips();
      if (this.#filterInput) this.#filterInput.value = "";
      if (this.#createSection) this.#createSection.classList.add("hidden");
      this.#filterOptions("");
    } catch (error) {
      console.error("Failed to create tag:", error);
      // Use toast if available
      if (typeof window.showToast === "function") {
        window.showToast("Failed to create tag. Please try again.", "error");
      }
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  #slugify(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  #escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  #getCSRFToken() {
    // Try body hx-headers first
    const hxHeaders = document.body?.getAttribute("hx-headers");
    if (hxHeaders) {
      try {
        const headers = JSON.parse(hxHeaders);
        if (headers["X-CSRF-Token"]) {
          return headers["X-CSRF-Token"];
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
    // Fallback to form hidden input
    const input = document.querySelector('input[name="csrf_token"]');
    return input?.value || "";
  }
}

// Register custom element
customElements.define("ec-tag-select", EcTagSelect);
