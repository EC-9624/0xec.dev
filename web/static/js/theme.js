/**
 * Theme Init - Prevents flash of wrong theme on page load
 *
 * This script runs synchronously in <head> before DOM renders.
 * It applies the saved mode class immediately to prevent FOUC.
 * 
 * Full theme switching is handled by theme-switcher.js
 */
(function () {
  "use strict";

  var STORAGE_MODE = "theme-mode";
  var DARK = "dark";
  var LIGHT = "light";
  var SYSTEM = "system";

  /**
   * Get the effective mode from storage or system preference
   */
  function getEffectiveMode() {
    var stored = localStorage.getItem(STORAGE_MODE);
    
    // If explicit light or dark, use that
    if (stored === DARK) return DARK;
    if (stored === LIGHT) return LIGHT;
    
    // Otherwise (system or no preference), check system
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return DARK;
    }
    return LIGHT;
  }

  /**
   * Apply mode class to prevent flash
   */
  function applyInitialMode() {
    var mode = getEffectiveMode();
    var html = document.documentElement;
    html.classList.remove(DARK, LIGHT);
    html.classList.add(mode);
  }

  // Apply immediately (before DOM loads)
  applyInitialMode();
})();
