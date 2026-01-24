/**
 * ec-markdown-toolbar - Floating markdown formatting toolbar Web Component
 *
 * Features:
 * - Shows on text selection in target textarea
 * - Positions above selection
 * - Inserts markdown syntax around selected text
 * - Keyboard shortcuts (Ctrl/Cmd + B, I, K, `)
 *
 * Usage:
 * <ec-markdown-toolbar target="content">
 *   <button type="button" data-action="bold" title="Bold (Ctrl+B)">B</button>
 *   <button type="button" data-action="italic" title="Italic (Ctrl+I)">I</button>
 *   <button type="button" data-action="code" title="Code (Ctrl+`)"><code>&lt;/&gt;</code></button>
 *   <button type="button" data-action="link" title="Link (Ctrl+K)">Link</button>
 *   <button type="button" data-action="heading" title="Heading">H</button>
 *   <button type="button" data-action="quote" title="Quote">"</button>
 * </ec-markdown-toolbar>
 *
 * Attributes:
 * - target: ID of the textarea to attach to
 */

class EcMarkdownToolbar extends HTMLElement {
  // ============================================
  // CONFIGURATION
  // ============================================

  static MARKDOWN_ACTIONS = {
    bold: { prefix: "**", suffix: "**", placeholder: "bold text" },
    italic: { prefix: "_", suffix: "_", placeholder: "italic text" },
    code: { prefix: "`", suffix: "`", placeholder: "code" },
    link: { prefix: "[", suffix: "](url)", placeholder: "link text" },
    heading: { prefix: "## ", suffix: "", placeholder: "Heading", lineStart: true },
    quote: { prefix: "> ", suffix: "", placeholder: "quote", lineStart: true },
  };

  static KEYBOARD_SHORTCUTS = {
    "b": "bold",
    "i": "italic",
    "k": "link",
    "`": "code",
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

    // Wait for DOM to be ready
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
    // Listen for selection changes on the textarea
    this.#targetTextarea.addEventListener(
      "select",
      () => this.#handleSelection(),
      { signal }
    );

    // Also listen for mouseup to catch selection via mouse
    this.#targetTextarea.addEventListener(
      "mouseup",
      () => setTimeout(() => this.#handleSelection(), 10),
      { signal }
    );

    // Hide on blur (with delay to allow button clicks)
    this.#targetTextarea.addEventListener(
      "blur",
      () => this.#scheduleHide(),
      { signal }
    );

    // Cancel hide if focusing on toolbar
    this.addEventListener(
      "mousedown",
      (e) => {
        e.preventDefault(); // Prevent textarea blur
        this.#clearHideTimeout();
      },
      { signal }
    );

    // Handle toolbar button clicks
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

    // Keyboard shortcuts
    this.#targetTextarea.addEventListener(
      "keydown",
      (e) => this.#handleKeydown(e),
      { signal }
    );

    // Hide on scroll
    this.#targetTextarea.addEventListener(
      "scroll",
      () => this.#hide(),
      { signal }
    );

    // Re-position on window resize
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

    // Get textarea position
    const textareaRect = textarea.getBoundingClientRect();

    // Create a temporary span to measure cursor position
    // This is a common technique to position elements relative to cursor in textarea
    const textBeforeCursor = textarea.value.substring(0, selectionStart);
    const lines = textBeforeCursor.split("\n");
    const lineNumber = lines.length - 1;
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 24;

    // Calculate approximate position
    const scrollTop = textarea.scrollTop;
    const paddingTop = parseInt(getComputedStyle(textarea).paddingTop) || 0;
    const paddingLeft = parseInt(getComputedStyle(textarea).paddingLeft) || 0;

    // Position toolbar above the selection
    const top = textareaRect.top + paddingTop + (lineNumber * lineHeight) - scrollTop - this.offsetHeight - 8;
    const left = textareaRect.left + paddingLeft + Math.min(100, lines[lineNumber].length * 8);

    // Ensure toolbar stays within viewport
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
    const action = EcMarkdownToolbar.MARKDOWN_ACTIONS[actionName];
    if (!action) return;

    const textarea = this.#targetTextarea;
    const { selectionStart, selectionEnd, value } = textarea;
    const selectedText = value.substring(selectionStart, selectionEnd);

    let newText;
    let newCursorStart;
    let newCursorEnd;

    if (action.lineStart) {
      // For line-start actions (heading, quote), insert at start of line
      const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
      const beforeLine = value.substring(0, lineStart);
      const afterSelection = value.substring(selectionEnd);
      const lineContent = selectedText || action.placeholder;

      newText = beforeLine + action.prefix + lineContent + action.suffix + afterSelection;
      newCursorStart = lineStart + action.prefix.length;
      newCursorEnd = newCursorStart + lineContent.length;
    } else {
      // For wrap actions (bold, italic, code, link)
      const before = value.substring(0, selectionStart);
      const after = value.substring(selectionEnd);
      const content = selectedText || action.placeholder;

      newText = before + action.prefix + content + action.suffix + after;
      newCursorStart = selectionStart + action.prefix.length;
      newCursorEnd = newCursorStart + content.length;
    }

    // Update textarea
    textarea.value = newText;

    // Restore selection
    textarea.setSelectionRange(newCursorStart, newCursorEnd);
    textarea.focus();

    // Trigger input event for any listeners (like auto-save)
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    // Hide toolbar
    this.#hide();
  }

  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================

  #handleKeydown(e) {
    // Check for Ctrl/Cmd + key
    if (!(e.ctrlKey || e.metaKey)) return;

    const action = EcMarkdownToolbar.KEYBOARD_SHORTCUTS[e.key.toLowerCase()];
    if (action) {
      e.preventDefault();
      this.#applyAction(action);
    }
  }
}

// ============================================
// REGISTER CUSTOM ELEMENT
// ============================================

customElements.define("ec-markdown-toolbar", EcMarkdownToolbar);

// Expose class for external use
window.EcMarkdownToolbar = EcMarkdownToolbar;
