/**
 * Theme Toggle - Dark/Light mode switching with localStorage persistence
 *
 * This script runs synchronously in <head> to prevent flash of wrong theme.
 * It supports:
 * - localStorage preference (explicit user choice)
 * - System preference fallback (prefers-color-scheme)
 * - Manual toggle via toggleTheme()
 */
(function () {
  "use strict";

  var STORAGE_KEY = "theme";
  var DARK = "dark";
  var LIGHT = "light";

  /**
   * Get the current theme from localStorage or system preference
   * @returns {string} 'dark' or 'light'
   */
  function getPreferredTheme() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored === DARK || stored === LIGHT) {
      return stored;
    }
    // Fallback to system preference
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return DARK;
    }
    return LIGHT;
  }

  /**
   * Apply the theme to the document
   * @param {string} theme - 'dark' or 'light'
   */
  function applyTheme(theme) {
    var html = document.documentElement;

    // Disable ALL transitions during theme switch
    html.classList.add("no-transitions");
    html.classList.remove(DARK, LIGHT);
    html.classList.add(theme);

    // Re-enable transitions after paint
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        html.classList.remove("no-transitions");
      });
    });

    // Update toggle button icons if they exist
    updateToggleButton(theme);

    // Update meta theme-color
    updateThemeColor(theme);
  }

  /**
   * Update the meta theme-color tag
   * @param {string} theme - current theme
   */
  function updateThemeColor(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      // Warm cream for light, cool dark blue for dark
      meta.content = theme === DARK ? "#1e1e24" : "#faf9f7";
    }
  }

  /**
   * Update the toggle button to show the correct icon
   * @param {string} theme - current theme
   */
  function updateToggleButton(theme) {
    var sunIcon = document.getElementById("theme-icon-sun");
    var moonIcon = document.getElementById("theme-icon-moon");

    if (sunIcon && moonIcon) {
      if (theme === DARK) {
        // In dark mode, show sun (to switch to light)
        sunIcon.classList.remove("hidden");
        moonIcon.classList.add("hidden");
      } else {
        // In light mode, show moon (to switch to dark)
        sunIcon.classList.add("hidden");
        moonIcon.classList.remove("hidden");
      }
    }
  }

  /**
   * Toggle between dark and light themes
   */
  function toggleTheme() {
    var current = document.documentElement.classList.contains(DARK)
      ? DARK
      : LIGHT;
    var next = current === DARK ? LIGHT : DARK;
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  // Apply theme immediately (before DOM loads) to prevent flash
  applyTheme(getPreferredTheme());

  // Listen for system preference changes (when no explicit preference is set)
  if (window.matchMedia) {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", function (e) {
        // Only react if user hasn't set an explicit preference
        if (!localStorage.getItem(STORAGE_KEY)) {
          applyTheme(e.matches ? DARK : LIGHT);
        }
      });
  }

  // Update toggle button when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      updateToggleButton(getPreferredTheme());
    });
  } else {
    updateToggleButton(getPreferredTheme());
  }

  // Expose toggle function globally
  window.toggleTheme = toggleTheme;
})();
