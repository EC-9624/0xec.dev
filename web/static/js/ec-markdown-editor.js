/**
 * MarkdownEditor - Markdown editor implementation extending EditorCore
 *
 * A simple textarea-based markdown editor with floating toolbar support.
 * Designed to be swappable with richer editors (TipTap) in the future.
 *
 * Usage:
 * const editor = EditorCore.create('markdown', container, {
 *   placeholder: 'Write your story...',
 *   initialContent: '# Hello',
 *   toolbar: document.querySelector('ec-markdown-toolbar')
 * });
 *
 * Features:
 * - Wraps existing textarea or creates one
 * - Integrates with ec-markdown-toolbar for floating toolbar
 * - Keyboard shortcuts (Ctrl/Cmd + B, I, K, `)
 * - Change and selection events
 */

class MarkdownEditor extends EditorCore {
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
    bold: { prefix: '**', suffix: '**', placeholder: 'bold text' },
    italic: { prefix: '_', suffix: '_', placeholder: 'italic text' },
    code: { prefix: '`', suffix: '`', placeholder: 'code' },
    link: { prefix: '[', suffix: '](url)', placeholder: 'link text' },
    heading: { prefix: '## ', suffix: '', placeholder: 'Heading', lineStart: true },
    quote: { prefix: '> ', suffix: '', placeholder: 'quote', lineStart: true },
  };

  static KEYBOARD_SHORTCUTS = {
    'b': 'bold',
    'i': 'italic',
    'k': 'link',
    '`': 'code',
  };

  // ============================================
  // CONSTRUCTOR
  // ============================================

  constructor(container, options = {}) {
    super(container, options);

    // Find or create textarea
    this.#textarea = container.querySelector('textarea') || this.#createTextarea();

    // Set initial content if provided
    if (options.initialContent) {
      this.setContent(options.initialContent);
    }

    // Connect toolbar if provided
    if (options.toolbar) {
      this.#toolbar = options.toolbar;
    }

    // Setup event listeners
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
      text: value.substring(selectionStart, selectionEnd),
    };
  }

  insertAtCursor(text) {
    const { selectionStart, selectionEnd, value } = this.#textarea;
    const before = value.substring(0, selectionStart);
    const after = value.substring(selectionEnd);

    this.#textarea.value = before + text + after;
    
    // Position cursor after inserted text
    const newPos = selectionStart + text.length;
    this.#textarea.setSelectionRange(newPos, newPos);
    
    this._emitChange();
    this.focus();
  }

  wrapSelection(prefix, suffix, placeholder = '') {
    const { selectionStart, selectionEnd, value } = this.#textarea;
    const selectedText = value.substring(selectionStart, selectionEnd) || placeholder;
    const before = value.substring(0, selectionStart);
    const after = value.substring(selectionEnd);

    this.#textarea.value = before + prefix + selectedText + suffix + after;

    // Select the wrapped text (or placeholder)
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
    const action = MarkdownEditor.ACTIONS[actionName];
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

    // Find the start of the current line
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
    const beforeLine = value.substring(0, lineStart);
    const afterSelection = value.substring(selectionEnd);

    this.#textarea.value = beforeLine + action.prefix + selectedText + action.suffix + afterSelection;

    // Select the text
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
    const textarea = document.createElement('textarea');
    textarea.className = 'editor-content';
    textarea.placeholder = this.options.placeholder || 'Write your content...';
    this.container.appendChild(textarea);
    return textarea;
  }

  #setupListeners() {
    const { signal } = this.#abortController;

    // Content changes
    this.#textarea.addEventListener('input', () => {
      this._emitChange();
    }, { signal });

    // Selection changes
    this.#textarea.addEventListener('select', () => {
      this._emitSelectionChange();
    }, { signal });

    this.#textarea.addEventListener('mouseup', () => {
      setTimeout(() => this._emitSelectionChange(), 10);
    }, { signal });

    this.#textarea.addEventListener('keyup', (e) => {
      // Emit selection change on arrow keys
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        this._emitSelectionChange();
      }
    }, { signal });

    // Keyboard shortcuts
    this.#textarea.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;

      const action = MarkdownEditor.KEYBOARD_SHORTCUTS[e.key.toLowerCase()];
      if (action) {
        e.preventDefault();
        this.applyAction(action);
      }
    }, { signal });
  }
}

// Register with EditorCore
EditorCore.register('markdown', MarkdownEditor);

// Expose class for external use
window.MarkdownEditor = MarkdownEditor;
