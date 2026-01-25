/**
 * Main entry point for JavaScript bundle
 *
 * This file imports all modules and initializes the application.
 * Bundled by esbuild into dist/bundle.js
 */

// ============================================
// CORE UTILITIES
// ============================================
import './utils.js';
import './validation.js';

// ============================================
// PAGE BEHAVIORS
// ============================================
import './prefetch.js';
import './progress-bar.js';
import './filter.js';
import './expandable-row.js';
import './masonry.js';
import './kanban.js';

// ============================================
// WEB COMPONENTS (auto-register via customElements.define)
// ============================================
import './components/ec-toast-container.js';
import './components/ec-dropdown.js';
import './components/ec-drawer.js';
import './components/ec-tag-select.js';
import './components/ec-mobile-nav.js';
import './components/ec-markdown-toolbar.js';

// ============================================
// EDITOR (EditorCore + Markdown implementation)
// ============================================
import './editor/editor-core.js';
import './editor/markdown-editor.js';
import './editor/post-editor.js';
