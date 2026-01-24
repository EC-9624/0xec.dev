/**
 * Theme Toggle - Dark/Light/System mode switching with localStorage persistence
 *
 * This script runs synchronously in <head> before DOM renders to prevent FOUC.
 * It also exposes a simple API for toggling modes.
 */
(function () {
  "use strict";

  var STORAGE_MODE = "theme-mode";
  var DARK = "dark";
  var LIGHT = "light";
  var SYSTEM = "system";

  // Current mode (light/dark/system)
  var currentMode = SYSTEM;

  /**
   * Get the effective mode (resolves 'system' to actual light/dark)
   */
  function getEffectiveMode() {
    if (currentMode === SYSTEM) {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? DARK
        : LIGHT;
    }
    return currentMode;
  }

  /**
   * Apply mode class to html element
   */
  function applyMode() {
    var effectiveMode = getEffectiveMode();
    var html = document.documentElement;
    
    // Disable transitions during theme switch
    html.classList.add("no-transitions");
    html.classList.remove(DARK, LIGHT);
    html.classList.add(effectiveMode);
    
    // Re-enable transitions after paint
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        html.classList.remove("no-transitions");
      });
    });

    // Update UI buttons if they exist
    updateUI();
  }

  /**
   * Update toggle button states
   */
  function updateUI() {
    var buttons = document.querySelectorAll("[data-theme-mode]");
    buttons.forEach(function(btn) {
      var isActive = btn.dataset.themeMode === currentMode;
      btn.classList.toggle("mode-btn-active", isActive);
    });
  }

  /**
   * Set the mode (light/dark/system)
   */
  function setMode(mode) {
    if (mode !== LIGHT && mode !== DARK && mode !== SYSTEM) return;
    currentMode = mode;
    localStorage.setItem(STORAGE_MODE, mode);
    applyMode();
  }

  /**
   * Get current mode
   */
  function getMode() {
    return currentMode;
  }

  /**
   * Cycle through modes: light -> dark -> system -> light
   */
  function cycle() {
    if (currentMode === LIGHT) {
      setMode(DARK);
    } else if (currentMode === DARK) {
      setMode(SYSTEM);
    } else {
      setMode(LIGHT);
    }
  }

  /**
   * Simple 2-way toggle: light ↔ dark (for mobile)
   */
  function toggle() {
    var newMode = getEffectiveMode() === DARK ? LIGHT : DARK;
    setMode(newMode);
  }

  /**
   * Initialize from localStorage
   */
  function init() {
    var stored = localStorage.getItem(STORAGE_MODE);
    if (stored === DARK || stored === LIGHT || stored === SYSTEM) {
      currentMode = stored;
    }
    applyMode();
  }

  // Listen for system preference changes
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function() {
      if (currentMode === SYSTEM) {
        applyMode();
      }
    });
  }

  // Initialize immediately (before DOM loads)
  init();

  // Update UI when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateUI);
  }

  // Expose API globally
  window.themeToggle = {
    setMode: setMode,
    getMode: getMode,
    cycle: cycle,
    toggle: toggle,
    LIGHT: LIGHT,
    DARK: DARK,
    SYSTEM: SYSTEM
  };
})();
