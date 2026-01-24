/**
 * EditorCore - Abstract interface for content editors
 *
 * This defines the contract that all editor implementations must follow.
 * Allows swapping between different editor backends (textarea, TipTap, etc.)
 * without changing the rest of the application.
 *
 * Usage:
 * 1. Extend this class
 * 2. Implement all abstract methods
 * 3. Register with EditorCore.register('type', YourEditorClass)
 * 4. Create instances with EditorCore.create('type', container, options)
 *
 * Example:
 * class MarkdownEditor extends EditorCore {
 *   constructor(container, options) {
 *     super(container, options);
 *     // Setup textarea, etc.
 *   }
 *   getContent() { return this.textarea.value; }
 *   // ... implement other methods
 * }
 *
 * EditorCore.register('markdown', MarkdownEditor);
 * const editor = EditorCore.create('markdown', container, { placeholder: '...' });
 */

class EditorCore {
  // ============================================
  // STATIC REGISTRY
  // ============================================

  static #registry = new Map();

  /**
   * Register an editor implementation
   * @param {string} type - Editor type identifier
   * @param {typeof EditorCore} EditorClass - Editor class that extends EditorCore
   */
  static register(type, EditorClass) {
    if (!(EditorClass.prototype instanceof EditorCore)) {
      throw new Error(`${EditorClass.name} must extend EditorCore`);
    }
    EditorCore.#registry.set(type, EditorClass);
  }

  /**
   * Create an editor instance
   * @param {string} type - Editor type identifier
   * @param {HTMLElement} container - Container element
   * @param {Object} options - Editor options
   * @returns {EditorCore} Editor instance
   */
  static create(type, container, options = {}) {
    const EditorClass = EditorCore.#registry.get(type);
    if (!EditorClass) {
      throw new Error(`Unknown editor type: ${type}. Available: ${[...EditorCore.#registry.keys()].join(', ')}`);
    }
    return new EditorClass(container, options);
  }

  /**
   * Get all registered editor types
   * @returns {string[]}
   */
  static getRegisteredTypes() {
    return [...EditorCore.#registry.keys()];
  }

  // ============================================
  // INSTANCE PROPERTIES
  // ============================================

  /** @type {HTMLElement} */
  container = null;

  /** @type {Object} */
  options = {};

  /** @type {Function[]} */
  #changeCallbacks = [];

  /** @type {Function[]} */
  #selectionCallbacks = [];

  // ============================================
  // CONSTRUCTOR
  // ============================================

  /**
   * @param {HTMLElement} container - Container element for the editor
   * @param {Object} options - Editor configuration options
   */
  constructor(container, options = {}) {
    if (new.target === EditorCore) {
      throw new Error('EditorCore is abstract and cannot be instantiated directly');
    }
    this.container = container;
    this.options = options;
  }

  // ============================================
  // ABSTRACT METHODS (must be implemented)
  // ============================================

  /**
   * Get the current content
   * @returns {string} The editor content
   * @abstract
   */
  getContent() {
    throw new Error('getContent() must be implemented');
  }

  /**
   * Set the editor content
   * @param {string} content - The content to set
   * @abstract
   */
  setContent(content) {
    throw new Error('setContent() must be implemented');
  }

  /**
   * Get the current selection
   * @returns {{ start: number, end: number, text: string }} Selection info
   * @abstract
   */
  getSelection() {
    throw new Error('getSelection() must be implemented');
  }

  /**
   * Insert text at the current cursor position
   * @param {string} text - Text to insert
   * @abstract
   */
  insertAtCursor(text) {
    throw new Error('insertAtCursor() must be implemented');
  }

  /**
   * Wrap the current selection with prefix and suffix
   * @param {string} prefix - Text to insert before selection
   * @param {string} suffix - Text to insert after selection
   * @param {string} [placeholder] - Default text if no selection
   * @abstract
   */
  wrapSelection(prefix, suffix, placeholder = '') {
    throw new Error('wrapSelection() must be implemented');
  }

  /**
   * Focus the editor
   * @abstract
   */
  focus() {
    throw new Error('focus() must be implemented');
  }

  /**
   * Destroy the editor and clean up resources
   * @abstract
   */
  destroy() {
    throw new Error('destroy() must be implemented');
  }

  // ============================================
  // EVENT METHODS (default implementations)
  // ============================================

  /**
   * Register a callback for content changes
   * @param {Function} callback - Called with (content: string) on change
   */
  onChange(callback) {
    if (typeof callback === 'function') {
      this.#changeCallbacks.push(callback);
    }
  }

  /**
   * Register a callback for selection changes
   * @param {Function} callback - Called with (selection: { start, end, text }) on selection change
   */
  onSelectionChange(callback) {
    if (typeof callback === 'function') {
      this.#selectionCallbacks.push(callback);
    }
  }

  /**
   * Emit a content change event
   * @protected
   */
  _emitChange() {
    const content = this.getContent();
    this.#changeCallbacks.forEach(cb => cb(content));
  }

  /**
   * Emit a selection change event
   * @protected
   */
  _emitSelectionChange() {
    const selection = this.getSelection();
    this.#selectionCallbacks.forEach(cb => cb(selection));
  }

  // ============================================
  // OPTIONAL METHODS (can be overridden)
  // ============================================

  /**
   * Check if the editor is empty
   * @returns {boolean}
   */
  isEmpty() {
    return this.getContent().trim() === '';
  }

  /**
   * Get word count
   * @returns {number}
   */
  getWordCount() {
    const content = this.getContent().trim();
    if (!content) return 0;
    return content.split(/\s+/).length;
  }

  /**
   * Get character count
   * @returns {number}
   */
  getCharacterCount() {
    return this.getContent().length;
  }

  /**
   * Register a slash command (for future /command support)
   * @param {string} trigger - Command trigger (e.g., '/image')
   * @param {Function} handler - Command handler function
   */
  registerCommand(trigger, handler) {
    // Default: no-op, can be overridden by implementations that support commands
    console.warn('Commands not supported by this editor implementation');
  }
}

// Export for use
window.EditorCore = EditorCore;
