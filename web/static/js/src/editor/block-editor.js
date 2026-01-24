/**
 * BlockEditor - Editor.js implementation extending EditorCore
 *
 * A block-based WYSIWYG editor using Editor.js library.
 * Stores content as JSON for structured data.
 *
 * Usage:
 * const editor = EditorCore.create('block', container, {
 *   placeholder: 'Write your story...',
 *   initialData: { blocks: [...] }
 * });
 *
 * Features:
 * - Block-based editing (paragraphs, headers, lists, code, quotes)
 * - JSON storage format
 * - Async content retrieval
 * - Change events
 */

import { EditorJS, Header, List, Quote, Code, Delimiter } from '../../vendor/editorjs/index.mjs';
import { EditorCore } from './editor-core.js';

class BlockEditor extends EditorCore {
  // ============================================
  // PRIVATE STATE
  // ============================================

  /** @type {EditorJS} */
  #editor = null;

  /** @type {boolean} */
  #isReady = false;

  /** @type {Promise} */
  #readyPromise = null;

  /** @type {Object} */
  #lastSavedData = null;

  // ============================================
  // CONSTRUCTOR
  // ============================================

  constructor(container, options = {}) {
    super(container, options);

    // Parse initial data if it's a string
    let initialData = options.initialData;
    if (typeof initialData === 'string' && initialData.trim()) {
      try {
        initialData = JSON.parse(initialData);
      } catch (e) {
        console.warn('[BlockEditor] Failed to parse initial data as JSON:', e);
        initialData = null;
      }
    }

    // Create editor container
    const editorHolder = document.createElement('div');
    editorHolder.className = 'block-editor-holder';
    editorHolder.id = `block-editor-${Date.now()}`;
    container.appendChild(editorHolder);

    // Initialize Editor.js
    this.#readyPromise = this.#initEditor(editorHolder.id, initialData);
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  async #initEditor(holderId, initialData) {
    this.#editor = new EditorJS({
      holder: holderId,
      
      tools: {
        header: {
          class: Header,
          config: {
            levels: [2, 3, 4],
            defaultLevel: 2,
          },
        },
        list: {
          class: List,
          inlineToolbar: true,
        },
        quote: {
          class: Quote,
          inlineToolbar: true,
        },
        code: Code,
        delimiter: Delimiter,
      },

      data: initialData || { blocks: [] },

      placeholder: this.options.placeholder || 'Start writing or press Tab for commands...',

      onChange: async () => {
        this._emitChange();
      },

      onReady: () => {
        this.#isReady = true;
      },
    });

    await this.#editor.isReady;
    this.#isReady = true;
    
    // Store initial data for comparison
    this.#lastSavedData = await this.#editor.save();
    
    return this.#editor;
  }

  // ============================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // ============================================

  /**
   * Get content as JSON string
   * Note: This is async internally but returns a promise that resolves to string
   * @returns {string} JSON string of editor data
   */
  getContent() {
    // Return cached data synchronously if available
    // The actual content will be fetched in getContentAsync
    if (this.#lastSavedData) {
      return JSON.stringify(this.#lastSavedData);
    }
    return '{"blocks":[]}';
  }

  /**
   * Get content asynchronously (preferred method)
   * @returns {Promise<string>} JSON string of editor data
   */
  async getContentAsync() {
    if (!this.#isReady) {
      await this.#readyPromise;
    }
    const data = await this.#editor.save();
    this.#lastSavedData = data;
    return JSON.stringify(data);
  }

  /**
   * Set editor content from JSON string or object
   * @param {string|Object} content - JSON string or data object
   */
  setContent(content) {
    if (!this.#isReady) {
      // Queue for when ready
      this.#readyPromise.then(() => this.setContent(content));
      return;
    }

    let data = content;
    if (typeof content === 'string') {
      try {
        data = JSON.parse(content);
      } catch (e) {
        console.warn('[BlockEditor] Failed to parse content as JSON:', e);
        data = { blocks: [] };
      }
    }

    this.#editor.render(data);
    this.#lastSavedData = data;
  }

  /**
   * Get selection - not applicable for block editor
   * @returns {{ start: number, end: number, text: string }}
   */
  getSelection() {
    // Editor.js doesn't expose selection in the same way
    return { start: 0, end: 0, text: '' };
  }

  /**
   * Insert text - not directly supported, use blocks instead
   * @param {string} text
   */
  insertAtCursor(text) {
    // For block editor, we'd need to create a paragraph block
    console.warn('[BlockEditor] insertAtCursor not supported, use block API instead');
  }

  /**
   * Wrap selection - not applicable for block editor
   */
  wrapSelection(prefix, suffix, placeholder = '') {
    console.warn('[BlockEditor] wrapSelection not supported, use inline tools instead');
  }

  /**
   * Focus the editor
   */
  focus() {
    if (this.#isReady && this.#editor) {
      // Focus the last block or create a new one
      const blocks = this.#editor.blocks;
      if (blocks.getBlocksCount() > 0) {
        blocks.getBlockByIndex(blocks.getBlocksCount() - 1)?.holder?.focus();
      }
    }
  }

  /**
   * Destroy the editor
   */
  destroy() {
    if (this.#editor) {
      this.#editor.destroy();
      this.#editor = null;
    }
    this.#isReady = false;
  }

  // ============================================
  // BLOCK EDITOR SPECIFIC METHODS
  // ============================================

  /**
   * Check if editor is ready
   * @returns {boolean}
   */
  get isReady() {
    return this.#isReady;
  }

  /**
   * Wait for editor to be ready
   * @returns {Promise}
   */
  async whenReady() {
    if (this.#isReady) return;
    await this.#readyPromise;
  }

  /**
   * Get the underlying Editor.js instance
   * @returns {EditorJS}
   */
  getEditorInstance() {
    return this.#editor;
  }

  /**
   * Check if content is empty
   * @returns {boolean}
   */
  isEmpty() {
    if (!this.#lastSavedData) return true;
    return !this.#lastSavedData.blocks || this.#lastSavedData.blocks.length === 0;
  }

  /**
   * Get block count
   * @returns {number}
   */
  getBlockCount() {
    if (!this.#lastSavedData?.blocks) return 0;
    return this.#lastSavedData.blocks.length;
  }
}

// Register with EditorCore
EditorCore.register('block', BlockEditor);

// Export for ES modules
export { BlockEditor };

// Also expose globally
window.BlockEditor = BlockEditor;
